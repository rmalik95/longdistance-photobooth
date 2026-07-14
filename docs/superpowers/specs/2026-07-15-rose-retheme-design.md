# Rose Retheme + $0/FREE Branding — Design

**Date:** 2026-07-15
**Status:** Approved (Approach A: rename tokens and sweep)

## Goal

Move the site off the coral/orange palette to a rose pink theme, make the
"free" selling point explicit with graphic $0 branding, and tighten landing
page navigation. Keep the existing light, minimalist structure: same fonts,
radii, soft shadows, and animations.

## Palette

| Token | Hex | Replaces | Role |
|---|---|---|---|
| `rose` | `#E64980` | `coral` | Primary action color (buttons, links, accents) |
| `rose-dark` | `#C2255C` | `coral-dark` | Hover state for rose surfaces |
| `plum` | `#4A1D3F` | `ink` (headings/dark surfaces) | Headings, dark chips, badge text |
| `sun` | `#FFD43B` | `gold` | Reserved for FREE/$0 branding only |
| `blush` | `#FFF9FB` | `cream` `#FDFBF7` | Page background |
| green `#37B24C` | — | `sage` | "Connected" status indicators |

Body text stays a near-black plum-gray for AA contrast. Cards stay pure
white with existing `shadow-soft`. Rose on white is used only for large/bold
text and filled buttons (passes contrast at those sizes).

Token names are renamed honestly (Approach A) — no `coral` class may remain
with a pink value.

## Changes by area

### 1. Tokens (`tailwind.config.js`, `src/index.css`, `src/lib/ui.js`)
- Replace `coral`/`gold`/`sage`/`cream`/`ink`/`warmgray` color definitions
  with the palette above (`ink` → `plum`, `warmgray` → `plumgray` `#5C4A55`).
- `body` background becomes `#FFF9FB`.
- `ui.js` primitives (`btnPrimary`, `btnSecondary`, `card`, `chip`,
  `chipTight`) recolored: primary buttons `bg-rose hover:bg-rose-dark`,
  selected chips `bg-plum`.

### 2. $0 / FREE branding (`src/pages/Landing.jsx`)
- **Hero sticker:** rotated sticker-style badge next to the headline —
  sun-yellow circle/burst, "$0" huge, "FREE FOREVER" beneath, slight tilt,
  soft shadow.
- **Nav pill:** small "100% FREE" pill in rose beside the logo.
- **Trust row** under the main CTA: "✓ Free forever ✓ No signup
  ✓ No watermark" in muted text.
- CTA copy stays action-first ("Start a booth"); the sticker carries price.

### 3. Navigation (`src/pages/Landing.jsx`)
- Sticky top bar: logo left; FREE pill; anchor links (How it works ·
  Samples) on desktop, hidden on mobile; single "Start a booth" button right.
- Footer repeats the CTA.

### 4. Room recolor (`src/pages/Room.jsx`, `components/CameraStage.jsx`,
`components/SessionCodeBadge.jsx`, `components/PrivacyBanner.jsx`,
countdown/result via shared tokens)
- Pure token substitution, no layout changes. Primary actions rose, session
  code badge plum-on-blush, countdown numerals rose, connected indicators
  green `#37B24C`.

### 5. Assets (`public/favicon.svg`, `public/index.html`)
- Favicon accent recolored to rose.
- `<meta name="theme-color">` and any inline background colors updated.

## Out of scope

- No layout or copy restructuring beyond the hero sticker, nav bar, and
  trust row.
- No dark mode work.
- No changes to backend or photo compositing.

## Verification

1. `grep -rn "coral\|sage\|E07A5F\|F2CC8F\|81B29A\|FDFBF7" frontend/src frontend/public` returns nothing.
2. Dev server screenshots (Chrome DevTools) of Landing and Room at desktop
   (1280w) and mobile (390w): palette consistent, sticker legible, nav
   usable, no clipped elements.
3. Frontend builds cleanly (`npm run build` or CRA equivalent).
