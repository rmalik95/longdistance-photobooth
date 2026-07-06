# Photobooth v2 — Two-Way Live Video, Layouts, Frames & Filters

**Date:** 2026-07-06
**Status:** Approved

## Problem

1. Live video in a session is one-directional: one participant sees the other, the other sees nothing. Root cause candidates: ICE candidates dropped when they arrive before `setRemoteDescription` completes, one-shot host-only offer with no renegotiation path, fire-and-forget async offer handling.
2. No choice of strip layout, frame style, or filter.
3. The generated strip has oversized gaps (26px padding) and doesn't look like a real booth strip.
4. UI needs polish (keep the existing retro/neubrutalist style).

## Decisions (confirmed with user)

- Filters apply to the **final strip only** (server-side, Pillow). Live video stays natural.
- Layouts offered: **1x4 vertical, 1x3 vertical, 2x2 grid, 1x2**.
- **Host picks** layout, frame, and filter at session creation; guest joins read-only.
- Design revamp = **polish existing style**, not a full rebrand.

## 1. Two-way live video fix (frontend/src/pages/Room.jsx)

Replace the current host-offers-once flow with **perfect negotiation**:

- Roles: host = impolite, guest = polite. Both peers attach local tracks and may trigger renegotiation via `onnegotiationneeded`. The polite peer rolls back on offer collision; the impolite peer ignores incoming offers while it has a pending local offer.
- **ICE candidate queue**: incoming `webrtc_ice_candidate` messages received before the remote description is set are buffered in a ref and flushed after `setRemoteDescription` resolves. This is the primary suspected cause of the one-way bug.
- Offer/answer handling becomes properly awaited sequential async (no un-awaited IIFE).
- On WebSocket reconnect or peer connection failure (`connectionState` failed/disconnected), tear down and renegotiate so **both** sides rebuild.
- Backend signaling relay (`server.py` `webrtc_*` passthrough) is unchanged.

## 2. Session options

- `POST /api/sessions` accepts `layout` (`"1x4" | "1x3" | "2x2" | "1x2"`, default `"1x3"`), `frame` (`"classic" | "minimal" | "film" | "polaroid"`, default `"classic"`), `filter` (`"none" | "warm" | "bw" | "vintage" | "cool"`, default `"warm"`). Invalid values fall back to defaults.
- `Session` stores these; `total_rounds` derives from layout: 1x4→4, 1x3→3, 2x2→4, 1x2→2.
- `GET /api/sessions/{code}` and the `joined` WS message include layout/frame/filter/total_rounds so the guest UI can display them read-only and the room can show the right round count.

## 3. Strip generation (backend/photo_strip.py)

- Padding between frames drops from 26px to 6–8px; thin divider between the two halves of each duo frame.
- Layout-aware compositing:
  - **1x4 / 1x3 / 1x2**: narrow vertical strip (booth-style), frames stacked.
  - **2x2**: square card, four duo frames in a grid.
- Filters (applied per photo before compositing): none, warm (current treatment), bw (grayscale + contrast), vintage (sepia + slight fade), cool (blue shift).
- Frames (compositing style): classic (current black borders), minimal (borderless, hairline gaps), film (dark background + sprocket holes on the rails), polaroid (white matte, wider bottom caption area). Footer text adapts to frame style.

## 4. Frontend UX

- **Landing**: create flow gains a setup step with visual pickers for layout, frame, and filter (small preview swatches/diagrams), plus existing countdown choice. Join flow unchanged.
- **Room**: camera stage remains the hero; statuses/controls tightened; round indicator reflects the session's `total_rounds`; result panel shows the strip at realistic proportions with download/retake.
- Better mobile stacking; keep retro palette/typography.

## Testing

- Backend: extend `test_sessions_api.py` for new creation params, validation fallbacks, and status payload; extend `photo_strip` coverage for each layout/frame/filter combination (dimension + smoke assertions); WS relay tests unchanged.
- Frontend/live: verify two-way video manually with two browser contexts via Chrome DevTools; verify full capture flow per layout.

## Out of scope

- Audio, TURN servers, mid-session option changes, persisting strips server-side.
