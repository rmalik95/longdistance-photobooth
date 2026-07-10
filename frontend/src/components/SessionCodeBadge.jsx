import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function SessionCodeBadge({ code }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/room/${code}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied, send it to the other person!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy automatically. Share this code instead: " + code);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-white rounded-full shadow-soft border border-ink/5 px-4 py-2.5">
      <span
        className="font-heading font-black text-lg tracking-[0.15em] text-ink"
        data-testid="session-code-display"
      >
        {code}
      </span>
      <button
        type="button"
        onClick={copyLink}
        data-testid="copy-link-btn"
        className="flex items-center gap-1.5 text-xs font-medium text-coral hover:text-coral-dark transition-colors"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
