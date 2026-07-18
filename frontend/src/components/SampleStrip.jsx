// Decorative sample Polaroid for the landing page hero. Photos are the
// user's own curated selection (frontend/src/assets/samples), imported so
// webpack fingerprints and optimizes them. None show an identifiable face
// (silhouettes, hands, or a face obscured by balloons), so there's no
// likeness/copyright concern.

export default function SampleStrip({ src, rotate = 0, caption = "", className = "" }) {
  return (
    <div
      className={`bg-white rounded-[3px] shadow-photo p-2.5 pb-3 w-[150px] sm:w-[180px] ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden="true"
    >
      <span
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-16 h-5 rotate-[-2deg] bg-[#E9DFC9]/90 shadow-sm"
        aria-hidden="true"
      />
      <div className="overflow-hidden rounded-[2px] aspect-[4/5]">
        <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
      </div>
      {caption && <p className="font-hand text-center text-xl leading-none mt-1.5 text-ink/80">{caption}</p>}
    </div>
  );
}
