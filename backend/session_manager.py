"""
In-memory session state for the Long Distance Couples Photobooth.

By design there is NO persistence layer here (no MongoDB, no disk writes).
Everything -- session codes, connection state, and captured photo bytes --
lives only in this process's memory for the lifetime of the session, and is
purged as soon as the session completes, is abandoned, or times out.
"""
import asyncio
import random
import string
import time
import uuid

SESSION_TTL_SECONDS = 30 * 60          # purge any session idle this long
ABANDON_GRACE_SECONDS = 90             # time allowed for a partner to reconnect
ROUND_GAP_SECONDS = 1.6                # pause between rounds before next countdown

LAYOUT_ROUNDS = {"1x4": 4, "1x3": 3, "2x2": 4, "1x2": 2}
DEFAULT_LAYOUT = "1x3"
VALID_FRAMES = {"classic", "minimal", "film", "polaroid"}
DEFAULT_FRAME = "classic"
VALID_FILTERS = {"none", "warm", "bw", "vintage", "cool"}
DEFAULT_FILTER = "warm"

_CODE_CHARS = "".join(c for c in (string.ascii_uppercase + string.digits) if c not in "0O1I")


def generate_code(length: int = 5) -> str:
    return "".join(random.choices(_CODE_CHARS, k=length))


class Session:
    def __init__(self, code: str, countdown_duration: int,
                 layout: str = DEFAULT_LAYOUT, frame: str = DEFAULT_FRAME,
                 filter_name: str = DEFAULT_FILTER):
        self.code = code
        self.session_id = str(uuid.uuid4())
        self.countdown_duration = countdown_duration
        self.layout = layout
        self.frame = frame
        self.filter_name = filter_name
        self.total_rounds = LAYOUT_ROUNDS[layout]
        self.round = 1
        # waiting | both_ready | countdown | awaiting_capture | processing | result | abandoned
        self.state = "waiting"
        self.participants = {}   # role -> {"ws": WebSocket, "connected": bool, "camera_ready": bool}
        self.captures = {r: {} for r in range(1, self.total_rounds + 1)}  # round -> {role: data_url}
        self.created_at = time.time()
        self.last_activity = time.time()
        self.abandon_task = None
        self.lock = asyncio.Lock()

    def touch(self):
        self.last_activity = time.time()

    @staticmethod
    def other_role(role: str) -> str:
        return "guest" if role == "host" else "host"

    def is_connected(self, role: str) -> bool:
        p = self.participants.get(role)
        return bool(p and p.get("connected"))

    def both_connected(self) -> bool:
        return self.is_connected("host") and self.is_connected("guest")

    def both_camera_ready(self) -> bool:
        return (
            self.both_connected()
            and self.participants["host"].get("camera_ready")
            and self.participants["guest"].get("camera_ready")
        )

    def reset_for_retake(self):
        self.round = 1
        self.captures = {r: {} for r in range(1, self.total_rounds + 1)}
        self.state = "both_ready" if self.both_camera_ready() else "waiting"


class SessionManager:
    def __init__(self):
        self.sessions: dict[str, Session] = {}
        self._lock = asyncio.Lock()

    async def create_session(self, countdown_duration: int, layout: str = DEFAULT_LAYOUT,
                             frame: str = DEFAULT_FRAME, filter_name: str = DEFAULT_FILTER) -> Session:
        async with self._lock:
            code = generate_code()
            while code in self.sessions:
                code = generate_code()
            session = Session(code, countdown_duration, layout, frame, filter_name)
            self.sessions[code] = session
            return session

    def get(self, code: str):
        return self.sessions.get(code)

    async def remove(self, code: str):
        async with self._lock:
            self.sessions.pop(code, None)

    async def cleanup_loop(self):
        while True:
            await asyncio.sleep(30)
            now = time.time()
            stale = [c for c, s in self.sessions.items() if now - s.last_activity > SESSION_TTL_SECONDS]
            for c in stale:
                await self.remove(c)


manager = SessionManager()
