# Together, Apart

A photobooth for two people in two different places. Start a session, send the link to
whoever you want in the shot, and count down together to the same moment, captured live
from both cameras and merged into one photo strip.

Built for long-distance couples, friends, and family in different time zones or on the
other side of the world. Really, all you need is two people with two phones.

- No accounts, no sign-up
- No storage: photos and session state live in memory only and are purged once the
  session ends or times out
- Works on Chrome & Safari, laptop or phone

## How it works

1. One person starts a session and picks a countdown length (3s or 5s).
2. They share the short session code or link with the other person.
3. Both cameras connect over a WebSocket; once both are ready, a synchronized countdown
   fires on both screens at once.
4. Each side captures a photo automatically when the countdown hits zero, across 3 rounds.
5. The server merges both sides' photos into one photo strip (host left, guest right, per
   round) and sends it back to both people to preview, download, or retake.

## Tech stack

**Backend** (`backend/`)
- FastAPI + WebSockets for the realtime session/countdown/capture flow
- Pillow for server-side photo strip compositing (adds a shared warm-tone filter to even
  out camera differences between devices)
- Pure in-memory session state (`session_manager.py`), no database

**Frontend** (`frontend/`)
- React (Create React App via craco)
- Tailwind CSS + Radix UI primitives
- `pages/Landing.jsx` (start/join a session), `pages/Room.jsx` (camera + countdown state
  machine), `components/` (camera stage, countdown overlay, result panel, etc.)

## Getting started

### Prerequisites
- Node.js 18+ and Yarn
- Python 3.10+

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

Optional environment variables (create a `.env` file in `backend/`):

| Variable       | Default | Purpose                                   |
|----------------|---------|--------------------------------------------|
| `CORS_ORIGINS` | `*`     | Comma-separated list of allowed origins    |

### Frontend

```bash
cd frontend
yarn install
yarn start
```

Create a `.env` file in `frontend/` pointing at your backend:

```
REACT_APP_BACKEND_URL=http://localhost:8000
```

The app will be available at `http://localhost:3000`.

### Running tests

```bash
# Backend (pytest, fixed 2 xdist workers)
cd backend
pytest

# Frontend
cd frontend
yarn test
```

## Project layout

```
backend/
  server.py            REST + WebSocket API
  session_manager.py    In-memory session state, cleanup/abandonment logic
  photo_strip.py         Pillow-based photo strip compositor
  tests/                 Backend test suite
frontend/
  src/pages/              Landing and Room (camera/session) pages
  src/components/         Camera stage, countdown, result panel, etc.
  src/lib/                REST + WebSocket helpers
```
