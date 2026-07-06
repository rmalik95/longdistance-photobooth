import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

from photo_strip import generate_strip_data_url
from session_manager import (
    ABANDON_GRACE_SECONDS, DEFAULT_FILTER, DEFAULT_FRAME, DEFAULT_LAYOUT,
    LAYOUT_ROUNDS, ROUND_GAP_SECONDS, VALID_FILTERS, VALID_FRAMES, Session, manager,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# REST: session creation / lookup
# ---------------------------------------------------------------------------
class CreateSessionRequest(BaseModel):
    countdown_duration: int = 3
    layout: str = DEFAULT_LAYOUT
    frame: str = DEFAULT_FRAME
    filter: str = DEFAULT_FILTER


@api_router.get("/")
async def root():
    return {"message": "Long Distance Couples Photobooth API"}


@api_router.post("/sessions")
async def create_session(payload: CreateSessionRequest):
    duration = payload.countdown_duration if payload.countdown_duration in (3, 5) else 3
    layout = payload.layout if payload.layout in LAYOUT_ROUNDS else DEFAULT_LAYOUT
    frame = payload.frame if payload.frame in VALID_FRAMES else DEFAULT_FRAME
    filter_name = payload.filter if payload.filter in VALID_FILTERS else DEFAULT_FILTER
    session = await manager.create_session(duration, layout, frame, filter_name)
    return {
        "code": session.code,
        "countdown_duration": session.countdown_duration,
        "layout": session.layout,
        "frame": session.frame,
        "filter": session.filter_name,
        "total_rounds": session.total_rounds,
    }


@api_router.get("/sessions/{code}")
async def get_session_status(code: str):
    session = manager.get(code.upper())
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "exists": True,
        "full": session.both_connected(),
        "countdown_duration": session.countdown_duration,
        "layout": session.layout,
        "frame": session.frame,
        "filter": session.filter_name,
        "total_rounds": session.total_rounds,
        "state": session.state,
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def start_cleanup_task():
    asyncio.create_task(manager.cleanup_loop())


# ---------------------------------------------------------------------------
# WebSocket helpers
# ---------------------------------------------------------------------------
async def send_to(session: Session, role: str, message: dict):
    p = session.participants.get(role)
    if not p or not p.get("connected") or not p.get("ws"):
        return
    try:
        await p["ws"].send_json(message)
    except Exception:
        p["connected"] = False


async def broadcast(session: Session, message: dict):
    await send_to(session, "host", message)
    await send_to(session, "guest", message)


async def start_round_countdown(session: Session):
    session.state = "countdown"
    session.touch()
    await broadcast(
        session,
        {
            "type": "countdown_start",
            "round": session.round,
            "total_rounds": session.total_rounds,
            "duration": session.countdown_duration,
        },
    )
    asyncio.create_task(schedule_capture(session, session.round, session.countdown_duration))


async def schedule_capture(session: Session, expected_round: int, duration: float):
    await asyncio.sleep(duration)
    if session.round == expected_round and session.state == "countdown":
        session.state = "awaiting_capture"
        await broadcast(session, {"type": "capture_now", "round": expected_round})


async def finalize_strip(session: Session):
    session.state = "processing"
    await broadcast(session, {"type": "processing"})
    try:
        host_photos = [session.captures[r]["host"] for r in range(1, session.total_rounds + 1)]
        guest_photos = [session.captures[r]["guest"] for r in range(1, session.total_rounds + 1)]
        data_url = await asyncio.to_thread(generate_strip_data_url, host_photos, guest_photos)
    except Exception as exc:
        logger.error("Failed to generate photo strip: %s", exc)
        await broadcast(session, {"type": "error", "message": "Could not generate the photo strip. Please retake."})
        session.reset_for_retake()
        return
    finally:
        # Discard raw photo bytes from memory immediately -- they are no
        # longer needed once the merge has happened (or failed).
        session.captures = {r: {} for r in range(1, session.total_rounds + 1)}

    session.state = "result"
    await broadcast(session, {"type": "strip_ready", "image": data_url})
    # The image has already been delivered to both clients; drop our
    # reference so nothing lingers server-side.
    del data_url


async def handle_message(session: Session, role: str, data: dict):
    msg_type = data.get("type")
    session.touch()

    if msg_type == "camera_ready":
        session.participants[role]["camera_ready"] = True
        await send_to(session, session.other_role(role), {"type": "partner_camera_ready"})
        if session.both_camera_ready() and session.state == "waiting":
            session.state = "both_ready"
            await broadcast(session, {"type": "both_ready"})

    elif msg_type == "start_countdown":
        if session.state == "both_ready":
            await start_round_countdown(session)

    elif msg_type == "photo_captured":
        round_num = data.get("round")
        image = data.get("image")
        if round_num != session.round or not image:
            return
        async with session.lock:
            session.captures[round_num][role] = image
            round_captures = session.captures[round_num]
            if len(round_captures) < 2:
                await send_to(session, role, {"type": "round_captured", "round": round_num, "waiting_for_partner": True})
                return

        if session.round < session.total_rounds:
            await broadcast(session, {"type": "round_captured", "round": round_num, "waiting_for_partner": False})
            await asyncio.sleep(ROUND_GAP_SECONDS)
            session.round += 1
            await start_round_countdown(session)
        else:
            await finalize_strip(session)

    elif msg_type == "retake":
        if session.state == "result":
            session.reset_for_retake()
            await broadcast(session, {"type": "retake_started"})
            if session.state == "both_ready":
                await broadcast(session, {"type": "both_ready"})

    elif msg_type in ("webrtc_offer", "webrtc_answer", "webrtc_ice_candidate"):
        # Pure signaling relay for the live peer-to-peer video preview --
        # the server never inspects or stores SDP/ICE payloads, it just
        # forwards them to the other participant.
        await send_to(session, session.other_role(role), data)


async def handle_disconnect(session: Session, role: str):
    if role not in session.participants:
        return
    session.participants[role]["connected"] = False
    session.touch()
    other = session.other_role(role)
    if session.is_connected(other):
        session.state = "abandoned"
        await send_to(session, other, {"type": "partner_disconnected"})

    async def purge_if_not_reconnected():
        await asyncio.sleep(ABANDON_GRACE_SECONDS)
        if not session.is_connected(role) and not session.both_connected():
            await manager.remove(session.code)

    session.abandon_task = asyncio.create_task(purge_if_not_reconnected())


@app.websocket("/api/ws/{code}")
async def websocket_endpoint(websocket: WebSocket, code: str, role: str = Query(...)):
    await websocket.accept()
    session = manager.get(code.upper())

    if not session:
        await websocket.send_json({"type": "error", "message": "Session not found."})
        await websocket.close()
        return
    if role not in ("host", "guest"):
        await websocket.send_json({"type": "error", "message": "Invalid role."})
        await websocket.close()
        return
    if session.is_connected(role):
        await websocket.send_json({"type": "error", "message": "That role is already connected in this session."})
        await websocket.close()
        return

    was_abandoned = session.state == "abandoned"
    existing = session.participants.get(role, {})
    session.participants[role] = {
        "ws": websocket,
        "connected": True,
        "camera_ready": existing.get("camera_ready", False),
    }
    session.touch()
    if session.abandon_task:
        session.abandon_task.cancel()
        session.abandon_task = None

    other = session.other_role(role)
    other_connected = session.is_connected(other)

    await websocket.send_json(
        {
            "type": "joined",
            "role": role,
            "countdown_duration": session.countdown_duration,
            "layout": session.layout,
            "frame": session.frame,
            "filter": session.filter_name,
            "total_rounds": session.total_rounds,
            "partner_connected": other_connected,
            "partner_camera_ready": session.participants.get(other, {}).get("camera_ready", False),
        }
    )

    if other_connected:
        await send_to(session, other, {"type": "partner_reconnected" if was_abandoned else "partner_joined"})
        if was_abandoned:
            # A fresh reconnect after abandonment should not resume mid-round
            # with stale captures -- restart the round sequence cleanly.
            session.reset_for_retake()
            if session.state == "both_ready":
                await broadcast(session, {"type": "both_ready"})

    try:
        while True:
            data = await websocket.receive_json()
            await handle_message(session, role, data)
    except WebSocketDisconnect:
        await handle_disconnect(session, role)
    except Exception as exc:
        logger.warning("WebSocket error for %s/%s: %s", code, role, exc)
        await handle_disconnect(session, role)


@app.on_event("shutdown")
async def shutdown_event():
    manager.sessions.clear()
