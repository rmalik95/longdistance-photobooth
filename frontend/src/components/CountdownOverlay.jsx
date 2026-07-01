export default function CountdownOverlay({ value }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none bg-[#1A1A19]/40">
      <span
        key={value}
        data-testid="countdown-number"
        className="font-heading font-black text-[#FDFBF7] text-[7rem] sm:text-[10rem] leading-none animate-pop-in"
        style={{ textShadow: "6px 6px 0px rgba(0,0,0,0.35)" }}
      >
        {value > 0 ? value : "GO!"}
      </span>
    </div>
  );
}
