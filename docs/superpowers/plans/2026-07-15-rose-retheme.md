# Rose Retheme + $0/FREE Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the coral/orange palette with a rose pink theme, add graphic $0/FREE branding, and add a sticky nav — per `docs/superpowers/specs/2026-07-15-rose-retheme-design.md`.

**Architecture:** Approach A — rename Tailwind color tokens honestly and sweep all usages. No layout changes outside Landing's new nav bar, hero sticker, trust row, and footer CTA.

**Tech Stack:** CRA + Tailwind (config-token colors), React 18, lucide-react.

## Global Constraints

- Palette: `rose #E64980`, `rose-dark #C2255C`, `plum #4A1D3F`, `plumgray #5C4A55`, `sun #FFD43B`, `blush #FFF9FB`, `success #37B24C`.
- `sun` appears ONLY in FREE/$0 branding.
- No `coral`, `gold`, `sage`, `cream`, `ink`, `warmgray` class names may remain in `frontend/src` or `frontend/public`.
- Do not touch `frontend/src/components/ui/form.jsx` — its grep hit is the substring "sage" inside "FormMessage".
- Keep all `data-testid` attributes unchanged.

## Token substitution map (applies to every task)

| Old class fragment | New class fragment |
|---|---|
| `cream` | `blush` |
| `ink` | `plum` |
| `coral-dark` | `rose-dark` |
| `coral` | `rose` |
| `gold` | `sun` (branding) or `rose` (status icons in CameraStage) |
| `sage` | `success` |
| `warmgray` | `plumgray` |

---

### Task 1: Tokens — tailwind.config.js, index.css, ui.js

**Files:** Modify `frontend/tailwind.config.js`, `frontend/src/index.css`, `frontend/src/lib/ui.js`

**Produces:** Tailwind classes `bg-rose`, `bg-rose-dark`, `text-plum`, `text-plumgray`, `bg-sun`, `bg-blush`, `text-success` for all later tasks.

- [ ] **Step 1:** In `tailwind.config.js` replace the custom color block with:

```js
colors: {
  blush: '#FFF9FB',
  plum: '#4A1D3F',
  rose: {
    DEFAULT: '#E64980',
    dark: '#C2255C',
  },
  sun: '#FFD43B',
  success: '#37B24C',
  plumgray: '#5C4A55',
  // ...(shadcn hsl vars unchanged)
```

Also update `boxShadow` rgba tints from `rgba(26,26,25,…)` to `rgba(74,29,63,…)` (same alphas).

- [ ] **Step 2:** In `index.css` change `body { background-color: #FDFBF7 }` to `#FFF9FB`.

- [ ] **Step 3:** In `ui.js` apply the substitution map (`bg-coral`→`bg-rose`, `text-cream`→`text-blush`, `bg-ink`→`bg-plum`, `text-warmgray`→`text-plumgray`, `border-ink/*`→`border-plum/*`, hover `coral-dark`→`rose-dark`).

- [ ] **Step 4:** Commit: `git commit -m "retheme: rose palette tokens"`

### Task 2: Landing page — recolor + nav + $0 sticker + trust row + footer CTA

**Files:** Modify `frontend/src/pages/Landing.jsx`

- [ ] **Step 1:** Apply the substitution map to all existing classes.
- [ ] **Step 2:** Replace the bare logo `<p>` with a sticky nav bar:

```jsx
<header className="sticky top-0 z-50 -mx-6 sm:-mx-12 px-6 sm:px-12 py-3 bg-blush/90 backdrop-blur-sm">
  <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
    <p className="font-heading font-black text-xl text-plum">
      together<span className="font-accent italic font-medium text-rose">, apart</span>
    </p>
    <div className="flex items-center gap-3 sm:gap-5">
      <span className="hidden sm:inline-flex items-center rounded-full bg-rose/10 text-rose text-xs font-bold px-3 py-1 uppercase tracking-wide">100% free</span>
      <a href="#how-it-works" className="hidden md:block text-sm font-medium text-plumgray hover:text-plum transition-colors">How it works</a>
      <button type="button" onClick={handleStartSession} disabled={creating} className="rounded-full bg-rose text-blush font-heading font-bold text-sm px-5 py-2 shadow-soft hover:bg-rose-dark transition-all disabled:opacity-60">
        Start a booth
      </button>
    </div>
  </div>
</header>
```

- [ ] **Step 3:** Add the $0 sticker overlapping the sample-strip column (inside the `relative` strip container):

```jsx
<div className="absolute -top-6 -left-6 sm:-left-10 z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-sun shadow-soft-lg rotate-[-8deg] flex flex-col items-center justify-center text-plum">
  <span className="font-heading font-black text-4xl sm:text-5xl leading-none">$0</span>
  <span className="font-heading font-bold text-[10px] sm:text-xs tracking-widest uppercase mt-1">Free forever</span>
</div>
```

- [ ] **Step 4:** Add trust row under the Start button (replacing the "Free, no sign-up" caption):

```jsx
<p className="text-xs text-plumgray/80 text-center font-body">
  ✓ Free forever&nbsp;&nbsp;✓ No signup&nbsp;&nbsp;✓ No watermark
</p>
```

- [ ] **Step 5:** Add `id="how-it-works"` to the How-it-works section and a footer CTA block before the closing footer note:

```jsx
<div className="max-w-6xl mx-auto mt-16 flex flex-col items-center gap-3">
  <button type="button" onClick={handleStartSession} disabled={creating} className={`${btnPrimary} text-lg`}>
    {creating ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
    {creating ? "Creating…" : "Start a booth, it's $0"}
  </button>
</div>
```

- [ ] **Step 6:** Commit: `git commit -m "retheme: landing nav, $0 sticker, trust row"`

### Task 3: Room + components recolor

**Files:** Modify `frontend/src/pages/Room.jsx`, `frontend/src/components/CameraStage.jsx`, `frontend/src/components/SessionCodeBadge.jsx`, `frontend/src/components/PrivacyBanner.jsx`, `frontend/src/components/ResultPanel.jsx`, `frontend/src/components/SampleStrip.jsx`

- [ ] **Step 1:** Apply the substitution map file by file. In CameraStage, `text-gold` status icons become `text-rose`; `text-sage` CheckCircle2 becomes `text-success`. PrivacyBanner `sage` classes become `success`.
- [ ] **Step 2:** Commit: `git commit -m "retheme: room and components to rose palette"`

### Task 4: Assets

**Files:** Modify `frontend/public/favicon.svg`, `frontend/public/index.html`

- [ ] **Step 1:** favicon.svg: background `#FDFBF7`→`#FFF9FB`, body `#1A1A19`→`#4A1D3F`, top frame `#E07A5F`→`#E64980`, bottom frame `#81B29A`→`#FFD43B`, divider stroke `#FDFBF7`→`#FFF9FB`.
- [ ] **Step 2:** index.html: `<meta name="theme-color" content="#FFF9FB" />`.
- [ ] **Step 3:** Commit: `git commit -m "retheme: favicon and theme-color"`

### Task 5: Verification

- [ ] **Step 1:** `grep -rnE "\b(coral|sage|ink|cream|warmgray|gold)\b|E07A5F|F2CC8F|81B29A|FDFBF7" frontend/src frontend/public --include="*.js" --include="*.jsx" --include="*.css" --include="*.svg" --include="*.html"` — expect no hits (word boundaries exclude FormMessage).
- [ ] **Step 2:** `cd frontend && npm run build` — expect "Compiled successfully".
- [ ] **Step 3:** Start dev server, screenshot Landing and Room at 1280w and 390w via Chrome DevTools; check sticker legibility, nav, no clipping.
- [ ] **Step 4:** Commit any fixes; final commit.
