// Decorative sample Polaroid for the landing page hero. Photos are the
// user's own curated selection (frontend/src/assets/samples), imported so
// webpack fingerprints and optimizes them. None show an identifiable face
// (silhouettes, hands, or a face obscured by balloons), so there's no
// likeness/copyright concern.

export default function SampleStrip({ src, rotate = 0, caption = "", className = "" }) {
  return (
    <div
      className={`bg-white rounded-lg shadow-soft-lg p-2.5 w-[150px] sm:w-[180px] ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden="true"
    >
      <div className="overflow-hidden rounded-[3px] aspect-[4/5]">
        <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
      </div>
      {caption && <p className="font-accent italic text-center text-sm mt-2 text-plum">{caption}</p>}
    </div>
  );
}
