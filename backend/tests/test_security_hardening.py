import asyncio
import base64
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from server import (
    MAX_JSON_MESSAGE_BYTES,
    MAX_PHOTO_BYTES,
    allowed_ws_origins,
    app,
    decode_photo_data_url,
    parse_origins,
)
from session_manager import Session, generate_code, generate_token, manager


def _jpeg_data_url(size=(8, 8)):
    buf = BytesIO()
    Image.new("RGB", size, "red").save(buf, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def test_session_uses_long_secure_code_and_separate_capabilities():
    session = Session(generate_code(), 3)
    assert len(session.code) >= 8
    assert session.host_token != session.guest_token
    assert len(session.host_token) >= 32
    assert len(session.guest_token) >= 32
    assert generate_token() != generate_token()


def test_origin_configuration_rejects_wildcard_and_normalizes_values():
    assert parse_origins(" https://example.test/ ,http://localhost:3000 ") == {
        "https://example.test",
        "http://localhost:3000",
    }
    with pytest.raises(ValueError):
        parse_origins("*")
    assert "*" not in allowed_ws_origins


def test_photo_data_url_is_strictly_validated_and_bounded():
    image = decode_photo_data_url(_jpeg_data_url())
    assert image.size == (8, 8)
    image.close()

    for invalid in (
        "not-a-data-url",
        "data:image/gif;base64," + base64.b64encode(b"gif").decode(),
        "data:image/jpeg;base64,!!!!",
    ):
        with pytest.raises(ValueError):
            decode_photo_data_url(invalid)

    oversized = "data:image/jpeg;base64," + base64.b64encode(b"x" * (MAX_PHOTO_BYTES + 1)).decode()
    with pytest.raises(ValueError):
        decode_photo_data_url(oversized)


def test_capture_is_ignored_outside_capture_state_and_duplicate_is_idempotent():
    from server import handle_message

    async def run():
        session = Session(generate_code(), 3)
        session.participants = {
            "host": {"connected": True, "camera_ready": True, "ws": None},
            "guest": {"connected": True, "camera_ready": True, "ws": None},
        }
        image = _jpeg_data_url()
        await handle_message(session, "host", {"type": "photo_captured", "round": 1, "image": image})
        assert session.captures[1] == {}

        session.state = "awaiting_capture"
        await handle_message(session, "host", {"type": "photo_captured", "round": 1, "image": image})
        await handle_message(session, "host", {"type": "photo_captured", "round": 1, "image": image})
        assert list(session.captures[1]) == ["host"]

    asyncio.run(run())


def test_json_message_limit_is_bounded_above_photo_payload_limit():
    assert MAX_JSON_MESSAGE_BYTES > MAX_PHOTO_BYTES > 0


def test_session_contract_and_websocket_require_role_capability_and_origin():
    manager.sessions.clear()
    client = TestClient(app)
    created = client.post("/api/sessions", json={}).json()
    assert {"host_token", "guest_token"}.issubset(created)
    status = client.get(f"/api/sessions/{created['code']}").json()
    assert "host_token" not in status
    assert "guest_token" not in status

    with pytest.raises(Exception):
        with client.websocket_connect(
            f"/api/ws/{created['code']}?role=host&join_token=wrong",
            headers={"Origin": "http://localhost:3000"},
        ) as websocket:
            websocket.receive_json()
    with pytest.raises(Exception):
        with client.websocket_connect(
            f"/api/ws/{created['code']}?role=host&join_token={created['host_token']}",
            headers={"Origin": "https://evil.example"},
        ) as websocket:
            websocket.receive_json()

    with client.websocket_connect(
        f"/api/ws/{created['code']}?role=host&join_token={created['host_token']}",
        headers={"Origin": "http://localhost:3000"},
    ) as websocket:
        assert websocket.receive_json()["type"] == "joined"
