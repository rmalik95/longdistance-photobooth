# Long Distance Couples Photobooth — PRD & Build Log

## Original Problem Statement
A web app that lets two people in different locations take a synchronized photo strip
together using their own device cameras. One partner starts a session, shares a link/code,
both cameras activate, and a synchronized countdown triggers capture on both sides.
Photos combine into a photo strip with Preview / Download / Retake actions.
No accounts, no storage — nothing persists on the server after the session ends.
(Full PRD text provided by user covers goals, non-goals, user flow, tech stack,
known risks, privacy positioning, design principles, and post-MVP roadmap.)

## User Choices (gathered via ask_human)
- Photo strip format: Classic strip, 3 rounds (3 photos per person, 6 total)
- Visual theme: No preference — design agent decided (Pastel/Soft + Neo-Brutalist)
- Joining method: Short code + shareable link
- Countdown duration: Selectable 3s or 5s (chosen at session creation by host)
- Photo filter: Yes — automatic consistent warm-tone filter applied server-side to
  reduce camera quality mismatch between devices

## Architecture
**Backend (FastAPI, `/app/backend/`)**
- `session_manager.py` — In-memory `Session` / `SessionManager` (NO database, by design —
  matches PRD's "we don't store anything" commitment). TTL-based cleanup loop, abandonment
  grace window (90s).
- `photo_strip.py` — Pillow-based compositor. Decodes 3 host + 3 guest photo data URLs,
  applies a shared warm-tone/contrast filter to both sides, composites into one vertical
  JPEG strip (host left, guest right, per round), returns as a base64 data URL. No disk I/O.
- `server.py` — REST: `POST /api/sessions` (create, returns code), `GET /api/sessions/{code}`
  (status check). WebSocket: `/api/ws/{code}?role=host|guest` drives the whole realtime flow
  (camera_ready → both_ready → countdown_start → capture_now → photo_captured → auto-advance
  rounds → finalize_strip → strip_ready → retake). Captures are purged from memory
  immediately after the strip is broadcast.

**Frontend (React, `/app/frontend/src/`)**
- `pages/Landing.jsx` — Start session (with 3s/5s countdown toggle) or join via code.
- `pages/Room.jsx` — Full client state machine (checking → join_prompt/permission →
  waiting_partner → both_ready → countdown → captured_wait → processing → result/abandoned/error).
- `components/CameraStage.jsx`, `CountdownOverlay.jsx`, `ResultPanel.jsx`,
  `SessionCodeBadge.jsx`, `PrivacyBanner.jsx`.
- `lib/api.js`, `lib/wsUrl.js` — REST + WebSocket URL helpers.
- Design: Pastel & Soft + Neo-Brutalist tactile aesthetic per `/app/design_guidelines.json`
  (Cabinet Grotesk / Satoshi / Cormorant Garamond fonts, hard charcoal borders + offset
  shadows, warm peach/pink palette).

## Code Review Fixes (2026-02-XX, post-launch review)
- **HIGH (confirmed & fixed)**: Self-camera preview and captured photos were coming out
  blank/black. Root cause: `videoRef.current.srcObject` was assigned before the `<video>`
  element mounted (it only mounts once phase reaches `waiting_partner`). Fixed with a
  `useEffect` keyed on `phase` in `Room.jsx` that re-attaches the stream whenever the video
  element (re)mounts. Verified via pixel-level sampling by testing_agent_v3 (not just DOM
  state) — both host and guest camera feeds and the final strip now contain real content.
- **MEDIUM (fixed)**: Reconnecting after abandonment mid-round no longer resumes with stale
  captures/round — `server.py` now calls `session.reset_for_retake()` on reconnect.
- **MEDIUM (fixed)**: `finalize_strip()` now builds photo lists inside the `try` block so a
  `KeyError` correctly triggers the error/purge path instead of skipping it.
- **MEDIUM (fixed)**: Client-side `ws.onclose` was a no-op leaving a disconnected user's own
  UI stuck; now transitions to an `abandoned` state with a distinct "Connection lost" message
  (verified via code review; could not be triggered via browser automation due to tooling
  limitations forcing a live WebSocket close).
- Minor dead-code cleanup (unused `btnSecondary` in Room.jsx).

## What's Been Implemented (2026-02-XX, initial build)
- Full session creation + short-code join flow (no accounts)
- Camera permission UX with explicit tap-to-enable (iOS Safari compatible)
- WebSocket-synchronized 3-2-1 countdown broadcast from server to both clients
- Automatic 3-round capture loop (no manual re-trigger needed per round)
- Server-side photo strip merge (Pillow) with consistent warm-tone filter
- Preview (dialog) / Download (local file save) / Retake actions
- Session abandonment detection + "abandoned" UI state with reconnect grace window
- Invalid/expired session code handling ("not found" state)
- Mobile-first responsive split-screen camera layout (stacks vertically on small screens)
- Zero persistence: no MongoDB usage, no disk writes — all session/photo state is
  in-memory Python objects, purged after strip generation or session timeout
- Tested end-to-end by testing_agent_v3: 100% pass rate (backend 8/8 pytest, full
  two-party happy path + abandonment + invalid code + mobile layout on frontend)

## Prioritized Backlog / Next Steps
- P1: Real device testing on iOS Safari / Android Chrome (simulated via fake camera in
  automated testing so far — real-device camera permission quirks should be spot-checked)
- P1: Add DialogDescription for accessibility (fixed post-test)
- P2: Post-MVP roadmap (not in scope for V1, per PRD): additional strip templates/layouts,
  selectable filters (vintage, B&W), multi-page photo books, session scheduling/reminders,
  optional short-lived shareable result link
- P2: Optional "copy code" fallback UI if clipboard API is blocked (currently shows a toast
  with the code as manual fallback)

## Known Accepted Limitations (per PRD Section 7, intentional — not bugs)
- Countdown/capture sync is not frame-perfect (network delay dependent) — positioned
  honestly in-app as "take the moment together," not pixel-perfect sync
- No WebRTC video preview of the partner's live camera — partner side shows connection/
  readiness status only, matching PRD's user flow description
