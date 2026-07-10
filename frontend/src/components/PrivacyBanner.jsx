import { ShieldCheck } from "lucide-react";

export default function PrivacyBanner({ compact = false }) {
  return (
    <div
      data-testid="privacy-banner"
      className={`flex items-center gap-3 rounded-xl bg-sage/15 border border-sage/30 ${compact ? "px-3 py-2" : "px-5 py-3.5"}`}
    >
      <ShieldCheck className="shrink-0 text-sage" size={compact ? 18 : 22} strokeWidth={2.5} />
      <p className={`font-body font-medium text-ink ${compact ? "text-xs" : "text-sm sm:text-base"}`}>
        Nothing is stored - your photos exist only on your two devices, and only if you download them.
      </p>
    </div>
  );
}
