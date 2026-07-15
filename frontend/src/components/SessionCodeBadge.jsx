import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function SessionCodeBadge({ code }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/room/${code}`;

  // iOS Safari's async clipboard API rejects intermittently (it requires the
  // document to be focused and the write to stay within the user gesture),
  // so fall back to the legacy execCommand path, then to the native share
  // sheet, before giving up.
  const legacyCopy = (text) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  };

  const copyLink = async () => {
    let copiedOk = false;
    try {
      await navigator.clipboard.writeText(link);
      copiedOk = true;
    } catch {
      copiedOk = legacyCopy(link);
    }
    if (copiedOk) {
      setCopied(true);
      toast.success("Link copied, send it to the other person!");
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: "together, apart", url: link });
        return;
      } catch {
        // user dismissed the sheet or share failed; fall through
      }
    }
    toast.error("Could not copy automatically. Share this code instead: " + code);
  };

  return (
    <div className="flex items-center gap-3 bg-white rounded-full shadow-soft border border-plum/5 px-4 py-2.5">
      <span
        className="font-heading font-black text-lg tracking-[0.15em] text-plum"
        data-testid="session-code-display"
      >
        {code}
      </span>
      <button
        type="button"
        onClick={copyLink}
        data-testid="copy-link-btn"
        className="flex items-center gap-1.5 text-xs font-medium text-rose hover:text-rose-dark transition-colors"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
