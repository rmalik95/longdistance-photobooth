// Shared editorial style primitives. The design language is flat and analog:
// hairline borders, paper/ink contrast, mono uppercase labels — no soft
// pastel cards or drop-shadowed boxes.

export const btnPrimary =
  "inline-flex items-center justify-center gap-2.5 rounded-full bg-ink text-paper font-mono text-sm font-medium uppercase tracking-[0.14em] px-8 py-4 transition-colors duration-200 hover:bg-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-ink/30 bg-transparent text-ink font-mono text-sm font-medium uppercase tracking-[0.14em] px-6 py-3 transition-colors duration-200 hover:border-ink hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

// Flat hairline panel — replaces the old soft-shadow card. Used sparingly
// (e.g. the reconnect panel in the room); sections are separated by
// hairline rules, not boxes.
export const card = "border border-ink/15 bg-paper";

export const chip = (selected) =>
  `rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] transition-colors duration-200 cursor-pointer ${
    selected
      ? "border-ink bg-ink text-paper"
      : "border-ink/25 text-inksoft hover:border-ink hover:text-ink"
  }`;

// For dense option grids (e.g. a 4-up strip/frame picker) where longer labels
// can wrap. The reserved min-height keeps two-line labels vertically centered.
export const chipTight = (selected) =>
  `rounded-2xl border px-2 py-2.5 min-h-[2.75rem] flex items-center justify-center text-center font-mono text-[11px] sm:text-xs uppercase tracking-[0.08em] leading-tight break-words transition-colors duration-200 cursor-pointer ${
    selected
      ? "border-ink bg-ink text-paper"
      : "border-ink/25 text-inksoft hover:border-ink hover:text-ink"
  }`;
