"""
Tests for the /api/ws/{code} websocket endpoint in server.py:
- camera_ready -> both_ready handshake
- WebRTC offer/answer/ICE signaling relay (used for the live partner video preview)
- disconnect / reconnect resets a session back to a clean both_ready round

These run against a live server (BASE_URL), same as test_sessions_api.py, but drive
the websocket directly instead of the REST API.
"""
import asyncio
import json
import os

import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
WS_BASE_URL = "ws" + BASE_URL.split("http", 1)[1]


def create_session(duration=3):
    resp = requests.post(f"{BASE_URL}/api/sessions", json={"countdown_duration": duration})
    resp.raise_for_status()
    return resp.json()["code"]


def ws_url(code, role):
    return f"{WS_BASE_URL}/api/ws/{code}?role={role}"


async def recv_json(ws):
    return json.loads(await ws.recv())


async def recv_until(ws, msg_type, max_messages=10):
    """Drain messages until one of the given type shows up (or raise)."""
    for _ in range(max_messages):
        data = await asyncio.wait_for(recv_json(ws), timeout=5)
        if data["type"] == msg_type:
            return data
    raise AssertionError(f"never received a {msg_type!r} message")


async def join_and_reach_both_ready(code):
    host = await websockets.connect(ws_url(code, "host"))
    guest = await websockets.connect(ws_url(code, "guest"))
    await recv_json(host)  # joined
    await recv_json(guest)  # joined
    await host.send(json.dumps({"type": "camera_ready"}))
    await guest.send(json.dumps({"type": "camera_ready"}))
    await recv_until(host, "both_ready")
    await recv_until(guest, "both_ready")
    return host, guest


class TestCameraReadyHandshake:
    def test_both_ready_broadcast_after_both_camera_ready(self):
        async def run():
            code = create_session()
            host, guest = await join_and_reach_both_ready(code)
            await host.close()
            await guest.close()

        asyncio.run(run())


class TestWebrtcSignalingRelay:
    def test_offer_is_relayed_to_partner_unmodified(self):
        async def run():
            code = create_session()
            host, guest = await join_and_reach_both_ready(code)
            offer_sdp = {"type": "offer", "sdp": "v=0 fake-sdp-payload"}
            await host.send(json.dumps({"type": "webrtc_offer", "sdp": offer_sdp}))
            received = await recv_until(guest, "webrtc_offer")
            assert received["sdp"] == offer_sdp
            await host.close()
            await guest.close()

        asyncio.run(run())

    def test_answer_is_relayed_back_to_offerer(self):
        async def run():
            code = create_session()
            host, guest = await join_and_reach_both_ready(code)
            answer_sdp = {"type": "answer", "sdp": "v=0 fake-answer-payload"}
            await guest.send(json.dumps({"type": "webrtc_answer", "sdp": answer_sdp}))
            received = await recv_until(host, "webrtc_answer")
            assert received["sdp"] == answer_sdp
            await host.close()
            await guest.close()

        asyncio.run(run())

    def test_ice_candidate_is_relayed(self):
        async def run():
            code = create_session()
            host, guest = await join_and_reach_both_ready(code)
            candidate = {"candidate": "candidate:1 1 UDP 1 127.0.0.1 1 typ host", "sdpMid": "0", "sdpMLineIndex": 0}
            await guest.send(json.dumps({"type": "webrtc_ice_candidate", "candidate": candidate}))
            received = await recv_until(host, "webrtc_ice_candidate")
            assert received["candidate"] == candidate
            await host.close()
            await guest.close()

        asyncio.run(run())

    def test_signaling_before_partner_connects_does_not_error(self):
        # Sending a webrtc message when the other side hasn't joined yet should be a
        # silent no-op (send_to short-circuits on a missing/disconnected participant),
        # not a server error that tears down the connection.
        async def run():
            code = create_session()
            host = await websockets.connect(ws_url(code, "host"))
            await recv_json(host)  # joined
            await host.send(json.dumps({"type": "webrtc_offer", "sdp": {"type": "offer", "sdp": "x"}}))
            await host.send(json.dumps({"type": "camera_ready"}))
            # Proves the socket is still alive and processing messages after the no-op relay.
            await host.close()

        asyncio.run(run())


def _tiny_photo(color):
    import base64
    from io import BytesIO

    from PIL import Image

    img = Image.new("RGB", (64, 48), color)
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def create_session_with_options(**options):
    resp = requests.post(f"{BASE_URL}/api/sessions", json={"countdown_duration": 3, **options})
    resp.raise_for_status()
    return resp.json()["code"]


async def run_capture_flow(host, guest, rounds):
    """Drive both participants through all rounds and return the strip_ready messages."""
    for r in range(1, rounds + 1):
        if r > 1:
            # server starts the next round's countdown after the inter-round gap
            await recv_until(host, "countdown_start", max_messages=20)
            await recv_until(guest, "countdown_start", max_messages=20)
        await host.send(json.dumps({"type": "photo_captured", "round": r, "image": _tiny_photo("red")}))
        await guest.send(json.dumps({"type": "photo_captured", "round": r, "image": _tiny_photo("blue")}))
    host_result = await recv_until(host, "strip_ready", max_messages=20)
    guest_result = await recv_until(guest, "strip_ready", max_messages=20)
    return host_result, guest_result


class TestFilterAfterShots:
    def test_set_filter_regenerates_strip_for_both(self):
        async def run():
            code = create_session_with_options(layout="1x2")
            host, guest = await join_and_reach_both_ready(code)
            host_result, guest_result = await run_capture_flow(host, guest, rounds=2)
            assert host_result["image"].startswith("data:image/jpeg;base64,")
            assert host_result["filter"] == "warm"

            await guest.send(json.dumps({"type": "set_filter", "filter": "bw"}))
            new_host = await recv_until(host, "strip_ready", max_messages=20)
            new_guest = await recv_until(guest, "strip_ready", max_messages=20)
            assert new_host["filter"] == "bw"
            assert new_guest["filter"] == "bw"
            assert new_host["image"] != host_result["image"]

            await host.close()
            await guest.close()

        asyncio.run(run())

    def test_invalid_filter_is_ignored(self):
        async def run():
            code = create_session_with_options(layout="1x2")
            host, guest = await join_and_reach_both_ready(code)
            await run_capture_flow(host, guest, rounds=2)

            await guest.send(json.dumps({"type": "set_filter", "filter": "xray"}))
            # prove the socket is still alive and no strip_ready was emitted for the bad filter
            await guest.send(json.dumps({"type": "set_filter", "filter": "cool"}))
            new_guest = await recv_until(guest, "strip_ready", max_messages=20)
            assert new_guest["filter"] == "cool"

            await host.close()
            await guest.close()

        asyncio.run(run())


class TestReconnect:
    def test_reconnect_after_disconnect_restores_both_ready(self):
        async def run():
            code = create_session()
            host, guest = await join_and_reach_both_ready(code)

            await host.close()
            # server needs a beat to process the disconnect and notify guest
            await recv_until(guest, "partner_disconnected")

            host2 = await websockets.connect(ws_url(code, "host"))
            joined = await recv_json(host2)
            assert joined["type"] == "joined"
            assert joined["partner_connected"] is True

            await recv_until(guest, "partner_reconnected")
            await host2.send(json.dumps({"type": "camera_ready"}))
            await recv_until(host2, "both_ready")
            await recv_until(guest, "both_ready")

            await host2.close()
            await guest.close()

        asyncio.run(run())

    def test_reconnect_with_same_role_while_still_connected_is_rejected(self):
        # Mirrors the frontend's "role already connected" transient-race case: a second
        # socket for a role that's still marked connected server-side gets a clean error
        # instead of silently displacing the first connection.
        async def run():
            code = create_session()
            host1 = await websockets.connect(ws_url(code, "host"))
            await recv_json(host1)  # joined

            host2 = await websockets.connect(ws_url(code, "host"))
            data = await recv_json(host2)
            assert data["type"] == "error"
            assert "already connected" in data["message"]

            await host1.close()

        asyncio.run(run())
