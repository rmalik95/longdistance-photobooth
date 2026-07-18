import { ShieldCheck } from "lucide-react";

export default function PrivacyBanner({ compact = false }) {
  return (
    <div
      data-testid="privacy-banner"
      className={
        compact
          ? "flex items-center gap-2"
          : "flex items-center gap-3 border-y border-ink/15 py-3.5"
      }
    >
      <ShieldCheck className="shrink-0 text-sage" size={compact ? 16 : 22} strokeWidth={2.5} />
      <p className={compact ? "text-xs text-inksoft" : "font-body font-medium text-ink text-sm sm:text-base"}>
        Nothing is stored - your photos exist only on your two devices, and only if you download them.
      </p>
    </div>
  );
}
