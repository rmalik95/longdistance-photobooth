# Photobooth v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix one-way WebRTC live video, add host-picked strip layout/frame/filter options, generate tight-gap booth-style strips, and polish the UI.

**Architecture:** FastAPI backend is a pure signaling relay + Pillow strip compositor; React frontend owns camera capture and the WebRTC peer connection. Session options flow: Landing → `POST /api/sessions` → stored on `Session` → surfaced via REST status + `joined` WS message → used by Room UI and by `photo_strip.py` at finalize time.

**Tech Stack:** React 18 + Tailwind (CRA/craco), FastAPI + Pillow, pytest, WebRTC (perfect negotiation), WebSocket signaling.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-06-photobooth-v2-design.md`
- Layouts: `"1x4" | "1x3" | "2x2" | "1x2"`, default `"1x3"`; rounds 4/3/4/2 respectively.
- Frames: `"classic" | "minimal" | "film" | "polaroid"`, default `"classic"`.
- Filters: `"none" | "warm" | "bw" | "vintage" | "cool"`, default `"warm"`; applied server-side only.
- Invalid option values fall back to defaults (never 4xx).
- No persistence: photos/strips stay in memory only.
- Padding between strip frames: 8px (was 26px).
- Keep the retro palette: bg `#FDFBF7`, ink `#1A1A19`, accent `#E07A5F`, sand `#F2CC8F`, sage `#81B29A`.
- Backend tests run from `backend/`: `.venv/bin/python -m pytest tests/ -q`.
- Commit after every task with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Session options in session_manager + REST API

**Files:**
- Modify: `backend/session_manager.py`
- Modify: `backend/server.py` (CreateSessionRequest, create_session, get_session_status, `joined` payload, finalize_strip captures reset)
- Test: `backend/tests/test_sessions_api.py`

**Interfaces:**
- Produces: `Session.__init__(code, countdown_duration, layout="1x3", frame="classic", filter_name="warm")`; `Session.total_rounds` derived from layout; `Session.captures` keyed `1..total_rounds`; `manager.create_session(countdown_duration, layout, frame, filter_name)`; module constants `LAYOUT_ROUNDS`, `VALID_FRAMES`, `VALID_FILTERS` in `session_manager.py`.
- REST: `POST /api/sessions` accepts `{countdown_duration, layout, frame, filter}` → returns `{code, countdown_duration, layout, frame, filter, total_rounds}`. `GET /api/sessions/{code}` returns the same option fields. WS `joined` message includes `layout`, `frame`, `filter`, `total_rounds`.

- [ ] **Step 1: Write failing tests** — append to `backend/tests/test_sessions_api.py`:

```python
def test_create_session_with_options(client):
    res = client.post("/api/sessions", json={
        "countdown_duration": 5, "layout": "1x4", "frame": "film", "filter": "bw",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["layout"] == "1x4"
    assert body["frame"] == "film"
    assert body["filter"] == "bw"
    assert body["total_rounds"] == 4


def test_create_session_defaults_and_invalid_options_fallback(client):
    res = client.post("/api/sessions", json={
        "countdown_duration": 3, "layout": "9x9", "frame": "gold", "filter": "xray",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["layout"] == "1x3"
    assert body["frame"] == "classic"
    assert body["filter"] == "warm"
    assert body["total_rounds"] == 3

    res2 = client.post("/api/sessions", json={"countdown_duration": 3})
    assert res2.json()["layout"] == "1x3"


def test_session_status_includes_options(client):
    code = client.post("/api/sessions", json={
        "countdown_duration": 3, "layout": "2x2", "frame": "polaroid", "filter": "vintage",
    }).json()["code"]
    res = client.get(f"/api/sessions/{code}")
    body = res.json()
    assert body["layout"] == "2x2"
    assert body["frame"] == "polaroid"
    assert body["filter"] == "vintage"
    assert body["total_rounds"] == 4
```

(Match the existing fixture name in the file — if it uses a module-level `client = TestClient(app)` instead of a fixture, drop the `client` parameter accordingly.)

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_sessions_api.py -q`
Expected: new tests FAIL (missing keys / TypeError).

- [ ] **Step 3: Implement `session_manager.py` changes**

Add below `ROUND_GAP_SECONDS`:

```python
LAYOUT_ROUNDS = {"1x4": 4, "1x3": 3, "2x2": 4, "1x2": 2}
DEFAULT_LAYOUT = "1x3"
VALID_FRAMES = {"classic", "minimal", "film", "polaroid"}
DEFAULT_FRAME = "classic"
VALID_FILTERS = {"none", "warm", "bw", "vintage", "cool"}
DEFAULT_FILTER = "warm"
```

Update `Session.__init__` signature and fields:

```python
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
    self.participants = {}
    self.captures = {r: {} for r in range(1, self.total_rounds + 1)}
    self.created_at = time.time()
    self.last_activity = time.time()
    self.abandon_task = None
    self.lock = asyncio.Lock()
```

Update `reset_for_retake` to rebuild captures dynamically:

```python
def reset_for_retake(self):
    self.round = 1
    self.captures = {r: {} for r in range(1, self.total_rounds + 1)}
    self.state = "both_ready" if self.both_camera_ready() else "waiting"
```

Update `SessionManager.create_session`:

```python
async def create_session(self, countdown_duration: int, layout: str = DEFAULT_LAYOUT,
                         frame: str = DEFAULT_FRAME, filter_name: str = DEFAULT_FILTER) -> Session:
    async with self._lock:
        code = generate_code()
        while code in self.sessions:
            code = generate_code()
        session = Session(code, countdown_duration, layout, frame, filter_name)
        self.sessions[code] = session
        return session
```

- [ ] **Step 4: Implement `server.py` changes**

Import the new constants:

```python
from session_manager import (
    ABANDON_GRACE_SECONDS, DEFAULT_FILTER, DEFAULT_FRAME, DEFAULT_LAYOUT,
    LAYOUT_ROUNDS, ROUND_GAP_SECONDS, VALID_FILTERS, VALID_FRAMES, Session, manager,
)
```

Request model + create endpoint:

```python
class CreateSessionRequest(BaseModel):
    countdown_duration: int = 3
    layout: str = DEFAULT_LAYOUT
    frame: str = DEFAULT_FRAME
    filter: str = DEFAULT_FILTER


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
```

Status endpoint — add to the returned dict:

```python
        "layout": session.layout,
        "frame": session.frame,
        "filter": session.filter_name,
        "total_rounds": session.total_rounds,
```

`joined` WS payload — add the same four fields.

In `finalize_strip`, replace the hardcoded reset `session.captures = {1: {}, 2: {}, 3: {}}` with:

```python
        session.captures = {r: {} for r in range(1, session.total_rounds + 1)}
```

- [ ] **Step 5: Run tests**

Run: `cd backend && .venv/bin/python -m pytest tests/ -q`
Expected: all PASS (including pre-existing suites).

- [ ] **Step 6: Commit** — `git add backend/ && git commit -m "feat(backend): session-level layout/frame/filter options"`

---

### Task 2: Layout/frame/filter-aware strip generation

**Files:**
- Modify: `backend/photo_strip.py` (rewrite composition; keep `_decode`, `_cover_fit`, `_load_font`)
- Test: `backend/tests/test_photo_strip.py` (create)

**Interfaces:**
- Produces: `generate_strip(host_photos, guest_photos, layout="1x3", frame="classic", filter_name="warm") -> bytes` and `generate_strip_data_url(...)` with the same keyword args. Consumed by Task 3.

- [ ] **Step 1: Write failing tests** — create `backend/tests/test_photo_strip.py`:

```python
import base64
from io import BytesIO

import pytest
from PIL import Image

from photo_strip import generate_strip


def _photo(color):
    img = Image.new("RGB", (640, 480), color)
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _photos(n):
    return [_photo("red")] * n, [_photo("blue")] * n


@pytest.mark.parametrize("layout,rounds", [("1x4", 4), ("1x3", 3), ("2x2", 4), ("1x2", 2)])
@pytest.mark.parametrize("frame", ["classic", "minimal", "film", "polaroid"])
@pytest.mark.parametrize("filter_name", ["none", "warm", "bw", "vintage", "cool"])
def test_all_combinations_render(layout, rounds, frame, filter_name):
    host, guest = _photos(rounds)
    raw = generate_strip(host, guest, layout=layout, frame=frame, filter_name=filter_name)
    img = Image.open(BytesIO(raw))
    assert img.format == "JPEG"
    assert img.width > 0 and img.height > 0


def test_vertical_strip_is_taller_than_wide():
    host, guest = _photos(4)
    raw = generate_strip(host, guest, layout="1x4")
    img = Image.open(BytesIO(raw))
    assert img.height > img.width * 1.5


def test_grid_is_roughly_square():
    host, guest = _photos(4)
    raw = generate_strip(host, guest, layout="2x2")
    img = Image.open(BytesIO(raw))
    assert 0.6 < img.width / img.height < 1.7


def test_bw_filter_is_grayscale():
    host, guest = _photos(2)
    raw = generate_strip(host, guest, layout="1x2", filter_name="bw")
    img = Image.open(BytesIO(raw)).convert("RGB")
    px = img.getpixel((img.width // 4, img.height // 3))
    assert max(px) - min(px) < 12
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_photo_strip.py -q`
Expected: FAIL (unexpected keyword argument `layout`).

- [ ] **Step 3: Rewrite `photo_strip.py` composition**

Replace the constants, `_apply_consistent_filter`, `generate_strip`, and `generate_strip_data_url` with (keep `_decode`, `_cover_fit`, `_load_font` as-is):

```python
PHOTO_W = 280           # each half of a duo frame
PHOTO_H = 210
DIVIDER_W = 2           # thin line between you & partner
GAP = 8                 # gap between frames (was 26)
BORDER_W = 2
FOOTER_H = 84
INK = "#1A1A19"
TEXT_SECONDARY = "#4A4A48"


def _f_none(img):
    return ImageOps.exif_transpose(img).convert("RGB")


def _f_warm(img):
    img = _f_none(img)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.06)
    img = ImageEnhance.Brightness(img).enhance(1.04)
    r, g, b = img.split()
    r = r.point(lambda i: min(255, int(i * 1.06)))
    b = b.point(lambda i: int(i * 0.93))
    return Image.merge("RGB", (r, g, b))


def _f_bw(img):
    img = _f_none(img).convert("L")
    img = ImageEnhance.Contrast(img).enhance(1.12)
    return img.convert("RGB")


def _f_vintage(img):
    img = _f_none(img)
    gray = img.convert("L")
    sepia = Image.merge("RGB", (
        gray.point(lambda i: min(255, int(i * 1.07) + 14)),
        gray.point(lambda i: min(255, int(i * 0.93) + 8)),
        gray.point(lambda i: int(i * 0.78)),
    ))
    img = Image.blend(img, sepia, 0.65)
    return ImageEnhance.Contrast(img).enhance(0.95)


def _f_cool(img):
    img = _f_none(img)
    r, g, b = img.split()
    r = r.point(lambda i: int(i * 0.94))
    b = b.point(lambda i: min(255, int(i * 1.08)))
    return ImageEnhance.Color(Image.merge("RGB", (r, g, b))).enhance(1.02)


FILTERS = {"none": _f_none, "warm": _f_warm, "bw": _f_bw, "vintage": _f_vintage, "cool": _f_cool}

FRAME_STYLES = {
    "classic":  {"bg": "#FFFDF9", "border": True,  "text": INK,       "sub": TEXT_SECONDARY, "margin": 14},
    "minimal":  {"bg": "#FFFFFF", "border": False, "text": INK,       "sub": TEXT_SECONDARY, "margin": 6},
    "film":     {"bg": "#141412", "border": False, "text": "#FDFBF7", "sub": "#B8B6AF",      "margin": 30},
    "polaroid": {"bg": "#FFFFFF", "border": False, "text": INK,       "sub": TEXT_SECONDARY, "margin": 22},
}


def _duo_frame(host_url: str, guest_url: str, filter_fn) -> Image.Image:
    host = _cover_fit(filter_fn(_decode(host_url)), PHOTO_W, PHOTO_H)
    guest = _cover_fit(filter_fn(_decode(guest_url)), PHOTO_W, PHOTO_H)
    frame = Image.new("RGB", (PHOTO_W * 2 + DIVIDER_W, PHOTO_H), INK)
    frame.paste(host, (0, 0))
    frame.paste(guest, (PHOTO_W + DIVIDER_W, 0))
    return frame


def _draw_sprockets(draw: ImageDraw.ImageDraw, width: int, height: int):
    hole_w, hole_h, step = 14, 10, 34
    for y in range(16, height - FOOTER_H, step):
        draw.rounded_rectangle([8, y, 8 + hole_w, y + hole_h], radius=3, fill="#FDFBF7")
        draw.rounded_rectangle([width - 8 - hole_w, y, width - 8, y + hole_h], radius=3, fill="#FDFBF7")


def generate_strip(host_photos: list, guest_photos: list, layout: str = "1x3",
                   frame: str = "classic", filter_name: str = "warm") -> bytes:
    rounds = min(len(host_photos), len(guest_photos))
    style = FRAME_STYLES.get(frame, FRAME_STYLES["classic"])
    filter_fn = FILTERS.get(filter_name, _f_warm)
    margin = style["margin"]
    frame_w = PHOTO_W * 2 + DIVIDER_W

    duos = [_duo_frame(host_photos[i], guest_photos[i], filter_fn) for i in range(rounds)]

    if layout == "2x2":
        cols = 2
        width = margin * 2 + cols * frame_w + GAP
        rows = (rounds + cols - 1) // cols
        height = margin * 2 + rows * PHOTO_H + (rows - 1) * GAP + FOOTER_H
        positions = [
            (margin + (i % cols) * (frame_w + GAP), margin + (i // cols) * (PHOTO_H + GAP))
            for i in range(rounds)
        ]
    else:
        width = margin * 2 + frame_w
        height = margin * 2 + rounds * PHOTO_H + (rounds - 1) * GAP + FOOTER_H
        positions = [(margin, margin + i * (PHOTO_H + GAP)) for i in range(rounds)]

    if frame == "polaroid":
        height += 26  # extra-wide bottom matte

    canvas = Image.new("RGB", (width, height), style["bg"])
    draw = ImageDraw.Draw(canvas)

    for duo, (x, y) in zip(duos, positions):
        canvas.paste(duo, (x, y))
        if style["border"]:
            draw.rectangle([x, y, x + frame_w - 1, y + PHOTO_H - 1], outline=INK, width=BORDER_W)

    if frame == "film":
        _draw_sprockets(draw, width, height)
    if frame == "classic":
        draw.rectangle([0, 0, width - 1, height - 1], outline=INK, width=BORDER_W + 1)

    footer_y = height - FOOTER_H - (26 if frame == "polaroid" else 0) + 16
    title_font = _load_font(30)
    sub_font = _load_font(16)
    title = "together, apart"
    sub = "captured live • nothing saved"
    tw = draw.textlength(title, font=title_font)
    sw = draw.textlength(sub, font=sub_font)
    draw.text(((width - tw) / 2, footer_y), title, fill=style["text"], font=title_font)
    draw.text(((width - sw) / 2, footer_y + 42), sub, fill=style["sub"], font=sub_font)

    buf = BytesIO()
    canvas.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def generate_strip_data_url(host_photos: list, guest_photos: list, layout: str = "1x3",
                            frame: str = "classic", filter_name: str = "warm") -> str:
    raw = generate_strip(host_photos, guest_photos, layout=layout, frame=frame, filter_name=filter_name)
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"
```

Delete the old `STRIP_WIDTH`, `PADDING`, `BG_COLOR`, `BORDER_COLOR`, `TEXT_PRIMARY` constants and `_apply_consistent_filter`.

- [ ] **Step 4: Run tests** — `cd backend && .venv/bin/python -m pytest tests/test_photo_strip.py -q` → PASS (80 combination cases + 3 shape/filter cases).

- [ ] **Step 5: Visual sanity check** — render one sample per frame style into the scratchpad and eyeball with Read:

```bash
cd backend && .venv/bin/python - <<'EOF'
import base64
from io import BytesIO
from PIL import Image
from photo_strip import generate_strip

def photo(color):
    img = Image.new("RGB", (640, 480), color)
    buf = BytesIO(); img.save(buf, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

host, guest = [photo("salmon")] * 4, [photo("steelblue")] * 4
out = "/private/tmp/claude-502/-Users-rishabhmalik-Documents-repos-rmalik-longdistance-photobooth/a069e0e3-2981-450e-b1d5-a42f89b104f6/scratchpad"
for f in ["classic", "minimal", "film", "polaroid"]:
    open(f"{out}/strip_{f}.jpg", "wb").write(generate_strip(host, guest, layout="1x4", frame=f))
EOF
```

Read the four JPEGs; confirm thin gaps and correct frame styling. Adjust constants if anything looks off.

- [ ] **Step 6: Commit** — `git add backend/ && git commit -m "feat(backend): layout/frame/filter-aware strip compositor with tight gaps"`

---

### Task 3: Wire session options into finalize_strip

**Files:**
- Modify: `backend/server.py` (`finalize_strip`)
- Test: existing `backend/tests/test_websocket_relay.py` must stay green

**Interfaces:**
- Consumes: `generate_strip_data_url(host, guest, layout=..., frame=..., filter_name=...)` from Task 2; `session.layout/frame/filter_name/total_rounds` from Task 1.

- [ ] **Step 1: Update `finalize_strip`**

```python
        host_photos = [session.captures[r]["host"] for r in range(1, session.total_rounds + 1)]
        guest_photos = [session.captures[r]["guest"] for r in range(1, session.total_rounds + 1)]
        data_url = await asyncio.to_thread(
            generate_strip_data_url, host_photos, guest_photos,
            session.layout, session.frame, session.filter_name,
        )
```

- [ ] **Step 2: Run full backend suite** — `cd backend && .venv/bin/python -m pytest tests/ -q` → all PASS.

- [ ] **Step 3: Commit** — `git add backend/server.py && git commit -m "feat(backend): generate strips using session layout/frame/filter"`

---

### Task 4: Landing page options picker + API client

**Files:**
- Modify: `frontend/src/lib/api.js`
- Modify: `frontend/src/pages/Landing.jsx`

**Interfaces:**
- Produces: `createSession({ countdownDuration, layout, frame, filter })` (object arg replaces the old positional number).
- Consumes: Task 1's REST contract.

- [ ] **Step 1: Update `api.js`**

```javascript
export async function createSession({ countdownDuration = 3, layout = "1x3", frame = "classic", filter = "warm" } = {}) {
  const res = await axios.post(`${API}/sessions`, {
    countdown_duration: countdownDuration,
    layout,
    frame,
    filter,
  });
  return res.data;
}
```

- [ ] **Step 2: Add option pickers to `Landing.jsx`**

State + option metadata inside the component:

```javascript
const [layout, setLayout] = useState("1x3");
const [frame, setFrame] = useState("classic");
const [filter, setFilter] = useState("warm");
```

Module-level constants above the component:

```javascript
const LAYOUTS = [
  { id: "1x4", label: "1×4", frames: 4, cols: 1 },
  { id: "1x3", label: "1×3", frames: 3, cols: 1 },
  { id: "2x2", label: "2×2", frames: 4, cols: 2 },
  { id: "1x2", label: "1×2", frames: 2, cols: 1 },
];
const FRAMES = [
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "film", label: "Film" },
  { id: "polaroid", label: "Polaroid" },
];
const FILTERS = [
  { id: "warm", label: "Warm" },
  { id: "none", label: "Natural" },
  { id: "bw", label: "B&W" },
  { id: "vintage", label: "Vintage" },
  { id: "cool", label: "Cool" },
];
```

Update `handleStartSession`:

```javascript
const { code } = await createSession({ countdownDuration: duration, layout, frame, filter });
```

Inside the "Start a session" card, after the Countdown block, add three picker rows using the countdown-button toggle pattern (selected = `bg-[#1A1A19] text-[#FDFBF7]`). Layout row includes a mini strip glyph:

```jsx
<div className="flex flex-col gap-2">
  <span className="text-xs font-bold uppercase tracking-wider text-[#4A4A48]">Strip</span>
  <div className="grid grid-cols-4 gap-2">
    {LAYOUTS.map((opt) => (
      <button
        key={opt.id}
        type="button"
        onClick={() => setLayout(opt.id)}
        data-testid={`layout-option-${opt.id}`}
        className={`flex flex-col items-center gap-1.5 border-2 border-[#1A1A19] py-2 font-bold text-xs transition-colors ${
          layout === opt.id ? "bg-[#1A1A19] text-[#FDFBF7]" : "bg-white text-[#1A1A19]"
        }`}
      >
        <span className={`grid gap-[2px] ${opt.cols === 2 ? "grid-cols-2" : "grid-cols-1"}`} aria-hidden>
          {Array.from({ length: opt.frames }).map((_, i) => (
            <span key={i} className={`block w-4 h-[5px] ${layout === opt.id ? "bg-[#FDFBF7]" : "bg-[#1A1A19]"}`} />
          ))}
        </span>
        {opt.label}
      </button>
    ))}
  </div>
</div>
<div className="flex flex-col gap-2">
  <span className="text-xs font-bold uppercase tracking-wider text-[#4A4A48]">Frame</span>
  <div className="grid grid-cols-4 gap-2">
    {FRAMES.map((opt) => (
      <button
        key={opt.id}
        type="button"
        onClick={() => setFrame(opt.id)}
        data-testid={`frame-option-${opt.id}`}
        className={`border-2 border-[#1A1A19] py-2 font-bold text-xs transition-colors ${
          frame === opt.id ? "bg-[#1A1A19] text-[#FDFBF7]" : "bg-white text-[#1A1A19]"
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
</div>
<div className="flex flex-col gap-2">
  <span className="text-xs font-bold uppercase tracking-wider text-[#4A4A48]">Filter</span>
  <div className="grid grid-cols-5 gap-2">
    {FILTERS.map((opt) => (
      <button
        key={opt.id}
        type="button"
        onClick={() => setFilter(opt.id)}
        data-testid={`filter-option-${opt.id}`}
        className={`border-2 border-[#1A1A19] py-2 font-bold text-[11px] transition-colors ${
          filter === opt.id ? "bg-[#1A1A19] text-[#FDFBF7]" : "bg-white text-[#1A1A19]"
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Verify build** — `cd frontend && yarn build 2>&1 | tail -5` → compiles without errors.

- [ ] **Step 4: Commit** — `git add frontend/src && git commit -m "feat(frontend): host picks strip layout, frame, and filter at creation"`

---

### Task 5: Two-way WebRTC fix (perfect negotiation) + dynamic rounds

**Files:**
- Modify: `frontend/src/pages/Room.jsx`

**Interfaces:**
- Consumes: `joined` WS message now carries `layout`, `frame`, `filter`, `total_rounds` (Task 1); signaling messages relayed verbatim by the server (unchanged).
- Produces: symmetric two-way video; `totalRounds` state replaces the hardcoded `const totalRounds = 3`.

- [ ] **Step 1: Replace the WebRTC plumbing in `Room.jsx`**

Remove `startWebrtcOffer` and `isPeerConnectionUsable`. Add refs:

```javascript
const makingOfferRef = useRef(false);
const ignoreOfferRef = useRef(false);
const politeRef = useRef(false);
const pendingCandidatesRef = useRef([]);
```

Replace `teardownPeerConnection`/`createPeerConnection` and add the negotiation handlers:

```javascript
const teardownPeerConnection = useCallback(() => {
  if (pcRef.current) {
    pcRef.current.onnegotiationneeded = null;
    pcRef.current.close();
    pcRef.current = null;
  }
  makingOfferRef.current = false;
  ignoreOfferRef.current = false;
  pendingCandidatesRef.current = [];
  setPartnerVideoLive(false);
  if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
}, []);

const createPeerConnection = useCallback((ws) => {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.onicecandidate = (e) => {
    if (e.candidate && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "webrtc_ice_candidate", candidate: e.candidate }));
    }
  };
  pc.ontrack = (e) => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    setPartnerVideoLive(true);
  };
  pc.onconnectionstatechange = () => {
    if (["failed", "closed"].includes(pc.connectionState)) setPartnerVideoLive(false);
  };
  pc.onnegotiationneeded = async () => {
    try {
      makingOfferRef.current = true;
      await pc.setLocalDescription();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "webrtc_offer", sdp: pc.localDescription }));
      }
    } catch (err) {
      console.error("negotiation failed", err);
    } finally {
      makingOfferRef.current = false;
    }
  };
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => pc.addTrack(track, streamRef.current));
  }
  return pc;
}, []);

const ensurePeerConnection = useCallback(
  (ws) => {
    if (pcRef.current && !["failed", "closed"].includes(pcRef.current.connectionState)) {
      return pcRef.current;
    }
    teardownPeerConnection();
    pcRef.current = createPeerConnection(ws);
    return pcRef.current;
  },
  [createPeerConnection, teardownPeerConnection]
);

const flushPendingCandidates = useCallback(async (pc) => {
  const pending = pendingCandidatesRef.current;
  pendingCandidatesRef.current = [];
  for (const candidate of pending) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      if (!ignoreOfferRef.current) console.warn("addIceCandidate failed", err);
    }
  }
}, []);

const handleOffer = useCallback(
  async (sdp, ws) => {
    const pc = ensurePeerConnection(ws);
    const offerCollision = makingOfferRef.current || pc.signalingState !== "stable";
    ignoreOfferRef.current = !politeRef.current && offerCollision;
    if (ignoreOfferRef.current) return;
    if (offerCollision) {
      await Promise.all([
        pc.setLocalDescription({ type: "rollback" }),
        pc.setRemoteDescription(new RTCSessionDescription(sdp)),
      ]);
    } else {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
    await flushPendingCandidates(pc);
    await pc.setLocalDescription();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "webrtc_answer", sdp: pc.localDescription }));
    }
  },
  [ensurePeerConnection, flushPendingCandidates]
);

const handleAnswer = useCallback(
  async (sdp) => {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await flushPendingCandidates(pc);
  },
  [flushPendingCandidates]
);

const handleRemoteCandidate = useCallback(async (candidate) => {
  const pc = pcRef.current;
  if (!pc || !pc.remoteDescription) {
    pendingCandidatesRef.current.push(candidate);
    return;
  }
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    if (!ignoreOfferRef.current) console.warn("addIceCandidate failed", err);
  }
}, []);
```

- [ ] **Step 2: Update `handleServerMessage` cases**

```javascript
case "joined":
  politeRef.current = data.role === "guest";
  setPartnerConnected(data.partner_connected);
  setPartnerCameraReady(data.partner_camera_ready);
  setCountdownDuration(data.countdown_duration);
  if (data.total_rounds) setTotalRounds(data.total_rounds);
  ws.send(JSON.stringify({ type: "camera_ready" }));
  break;
case "both_ready":
  setWaitingForPartnerShot(false);
  setPhase("both_ready");
  // Host initiates; addTrack in ensurePeerConnection fires onnegotiationneeded.
  if (role === "host") ensurePeerConnection(ws);
  break;
case "webrtc_offer":
  handleOffer(data.sdp, ws).catch((err) => console.error("offer handling failed", err));
  break;
case "webrtc_answer":
  handleAnswer(data.sdp).catch((err) => console.error("answer handling failed", err));
  break;
case "webrtc_ice_candidate":
  if (data.candidate) handleRemoteCandidate(data.candidate);
  break;
case "partner_reconnected":
  setPartnerConnected(true);
  setPhase((p) => (p === "abandoned" ? "waiting_partner" : p));
  teardownPeerConnection(); // clean renegotiation on next both_ready
  break;
```

Update the `handleServerMessage` dependency array to `[runLocalCountdown, capturePhoto, role, ensurePeerConnection, handleOffer, handleAnswer, handleRemoteCandidate, teardownPeerConnection]`.

Also:
- Replace `const totalRounds = 3;` with `const [totalRounds, setTotalRounds] = useState(3);` and set it from `status.total_rounds` in the initial `fetchSessionStatus` effect when present.
- In `connectWebSocket`'s `ws.onclose`, call `teardownPeerConnection()` before the reconnect logic so a reconnect renegotiates from scratch.

- [ ] **Step 3: Build check** — `cd frontend && yarn build 2>&1 | tail -5` → compiles.

- [ ] **Step 4: Live two-browser verification**

Start backend (`cd backend && .venv/bin/uvicorn server:app --port 8000`) and frontend (`cd frontend && yarn start`). Via Chrome DevTools MCP, open two pages (fake media flags if needed: `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`). Create a session in page 1, join from page 2, screenshot **both** pages: each must show both live panes ("You" + "Partner"). Run the full capture flow through `strip_ready`.

Expected: both sides show partner video; strip reflects chosen layout/frame/filter.

- [ ] **Step 5: Commit** — `git add frontend/src && git commit -m "fix(frontend): two-way live video via perfect negotiation with ICE queueing"`

---

### Task 6: UI polish (CameraStage, ResultPanel)

**Files:**
- Modify: `frontend/src/components/CameraStage.jsx`
- Modify: `frontend/src/components/ResultPanel.jsx`

**Interfaces:**
- Consumes: `totalRounds` prop already passed from Room (Task 5 keeps it wired).

- [ ] **Step 1: CameraStage polish**

- Change the pane divider from `border-b-2 sm:border-b-0 sm:border-r-2` to `border-b sm:border-b-0 sm:border-r` (thin 1px divider).
- Add a round progress chip inside the stage root, above the countdown overlay line:

```jsx
{["both_ready", "countdown", "captured_wait"].includes(phase) && (
  <span className="absolute top-3 right-3 z-30 bg-[#1A1A19] text-[#FDFBF7] border-2 border-[#1A1A19] px-3 py-1 text-xs font-heading font-bold uppercase tracking-wider">
    Shot {round}/{totalRounds}
  </span>
)}
```

- [ ] **Step 2: ResultPanel polish** — Read the file first, then constrain the strip preview to booth proportions:

```jsx
<img src={image} alt="Your photo strip" className="max-h-[70vh] w-auto max-w-full border-2 border-[#1A1A19] shadow-[6px_6px_0px_0px_rgba(26,26,25,1)]" />
```

Keep download/retake buttons; wrap in a centered column (`flex flex-col items-center gap-5`).

- [ ] **Step 3: Build + live screenshot check** — rebuild, reload both pages, screenshot landing, room (both_ready), and result. Confirm pickers, thin divider, round chip, and strip proportions look right.

- [ ] **Step 4: Full backend suite** — `cd backend && .venv/bin/python -m pytest tests/ -q` → PASS.

- [ ] **Step 5: Commit** — `git add frontend/src && git commit -m "polish: thin-strip camera stage, round chip, booth-proportion result"`
