import { ShieldCheck } from "lucide-react";

export default function PrivacyBanner({ compact = false }) {
  return (
    <div
      data-testid="privacy-banner"
      className={`flex items-center gap-3 border-2 border-[#1A1A19] bg-[#81B29A]/20 ${compact ? "px-3 py-2" : "px-5 py-3.5"}`}
    >
      <ShieldCheck className="shrink-0 text-[#1A1A19]" size={compact ? 18 : 22} strokeWidth={2.5} />
      <p className={`font-body font-semibold text-[#1A1A19] ${compact ? "text-xs" : "text-sm sm:text-base"}`}>
        We don't store anything. Your photos live only on your own devices, once you download them.
      </p>
    </div>
  );
}
