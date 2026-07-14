// Shared soft-minimal style primitives. Keep every interactive surface
// rounded and softly shadowed, no hard borders or offset shadows.

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-rose text-blush font-heading font-bold px-8 py-4 shadow-soft hover:bg-rose-dark hover:shadow-soft-lg transition-all disabled:opacity-60 disabled:pointer-events-none";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-white text-plum border border-plum/10 font-heading font-bold px-6 py-3 shadow-soft hover:shadow-soft-lg hover:border-plum/20 transition-all disabled:opacity-60 disabled:pointer-events-none";

export const card = "bg-white rounded-2xl shadow-soft border border-plum/5";

export const chip = (selected) =>
  `rounded-full px-4 py-2 text-sm font-medium transition-all ${
    selected
      ? "bg-plum text-blush shadow-soft"
      : "bg-white text-plumgray border border-plum/10 hover:border-plum/25"
  }`;

// For dense option grids (e.g. a 4-up strip/frame picker) where a full pill
// shape and fixed vertical padding can make longer labels wrap and collide
// with the rounded border. Rectangular corners plus a reserved min-height
// keep two-line labels clear of the edge at any container width.
export const chipTight = (selected) =>
  `rounded-xl px-2 py-2.5 min-h-[2.75rem] flex items-center justify-center text-center text-xs sm:text-sm font-medium leading-tight break-words transition-all ${
    selected
      ? "bg-plum text-blush shadow-soft"
      : "bg-white text-plumgray border border-plum/10 hover:border-plum/25"
  }`;
