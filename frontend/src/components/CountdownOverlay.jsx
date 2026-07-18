export default function CountdownOverlay({ value }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none bg-ink/45">
      <span
        key={value}
        data-testid="countdown-number"
        className={`${
          value > 0 ? "font-display text-paper" : "font-hand text-stamp"
        } text-[7rem] sm:text-[10rem] leading-none animate-pop-in`}
        style={{ textShadow: "0 8px 32px rgba(0,0,0,0.35)" }}
      >
        {value > 0 ? value : "Smile!"}
      </span>
    </div>
  );
}
