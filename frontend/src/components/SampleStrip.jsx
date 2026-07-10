// Illustrated sample photo strip for the landing page. Each frame shows two
// duotone silhouettes separated by a faint seam — one person from each place,
// merged into a single shot — so first-time visitors instantly see what the
// booth produces without us shipping real photos.

const VARIANTS = {
  warm: { bg: "#F6E3D5", far: "#E07A5F", near: "#C96449" },
  sage: { bg: "#E4EDE7", far: "#81B29A", near: "#5F8F77" },
  gold: { bg: "#F9EED8", far: "#E0B15C", near: "#C99A45" },
};

// Two head-and-shoulders silhouettes; pose varies a little per frame index so
// stacked frames read as different moments, not copies.
function Frame({ index, palette }) {
  const tilt = [0, 1.5, -1.5, 1][index % 4];
  const bob = [0, 1.5, -1, 0.5][index % 4];
  return (
    <svg viewBox="0 0 120 90" className="w-full h-auto block" aria-hidden="true">
      <rect width="120" height="90" fill={palette.bg} />
      {/* left person */}
      <g transform={`translate(0 ${bob}) rotate(${tilt} 30 60)`}>
        <circle cx="30" cy="42" r="13" fill={palette.far} />
        <path d="M8 90 Q8 62 30 62 Q52 62 52 90 Z" fill={palette.far} />
      </g>
      {/* right person */}
      <g transform={`translate(0 ${-bob}) rotate(${-tilt} 90 60)`}>
        <circle cx="90" cy="44" r="12" fill={palette.near} />
        <path d="M69 90 Q69 64 90 64 Q111 64 111 90 Z" fill={palette.near} />
      </g>
      {/* seam where the two halves meet */}
      <line x1="60" y1="0" x2="60" y2="90" stroke="#FDFBF7" strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

export default function SampleStrip({
  frames = 3,
  rotate = 0,
  caption = "together, apart",
  variant = "warm",
  className = "",
}) {
  const palette = VARIANTS[variant] ?? VARIANTS.warm;
  return (
    <div
      className={`bg-white rounded-lg shadow-soft-lg p-3 w-[130px] sm:w-[160px] ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden="true"
    >
      <div className="flex flex-col gap-1.5 bg-ink/90 p-1.5 rounded-sm">
        {Array.from({ length: frames }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[3px]">
            <Frame index={i} palette={palette} />
          </div>
        ))}
      </div>
      {caption && <p className="font-accent italic text-center text-sm mt-2 text-ink">{caption}</p>}
    </div>
  );
}
