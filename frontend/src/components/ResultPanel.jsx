import { useState } from "react";
import { Download, RotateCcw, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const FILTERS = [
  { id: "warm", label: "Warm" },
  { id: "none", label: "Natural" },
  { id: "bw", label: "B&W" },
  { id: "vintage", label: "Vintage" },
  { id: "cool", label: "Cool" },
];

export default function ResultPanel({ image, onDownload, onRetake, filterName, onChangeFilter, applyingFilter }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const btnBase =
    "flex items-center gap-2 border-2 border-[#1A1A19] shadow-[4px_4px_0px_0px_rgba(26,26,25,1)] hover:shadow-[2px_2px_0px_0px_rgba(26,26,25,1)] hover:translate-y-[2px] hover:translate-x-[2px] transition-all px-6 py-3 uppercase tracking-widest text-sm font-bold";

  return (
    <div className="flex flex-col items-center gap-5 animate-strip-reveal" data-testid="result-panel">
      <img
        src={image}
        alt="Your photo strip"
        className="max-h-[70vh] w-auto max-w-full border-2 border-[#1A1A19] shadow-[6px_6px_0px_0px_rgba(26,26,25,1)]"
        data-testid="result-strip-image"
        style={applyingFilter ? { opacity: 0.6 } : undefined}
      />

      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#4A4A48] flex items-center gap-2">
          Filter {applyingFilter && <Loader2 className="animate-spin" size={12} />}
        </span>
        <div className="flex flex-wrap justify-center gap-2">
          {FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeFilter(opt.id)}
              disabled={applyingFilter}
              data-testid={`filter-option-${opt.id}`}
              className={`border-2 border-[#1A1A19] px-4 py-2 font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-60 ${
                filterName === opt.id ? "bg-[#1A1A19] text-[#FDFBF7]" : "bg-white text-[#1A1A19]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          data-testid="preview-strip-btn"
          className={`${btnBase} bg-[#FDFBF7] text-[#1A1A19]`}
        >
          <Eye size={18} /> Preview
        </button>
        <button
          type="button"
          onClick={onDownload}
          data-testid="download-strip-btn"
          className={`${btnBase} bg-[#E07A5F] text-[#FDFBF7]`}
        >
          <Download size={18} /> Download
        </button>
        <button
          type="button"
          onClick={onRetake}
          data-testid="retake-btn"
          className={`${btnBase} bg-[#FDFBF7] text-[#1A1A19]`}
        >
          <RotateCcw size={18} /> Retake
        </button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg bg-[#FDFBF7] border-2 border-[#1A1A19]" data-testid="preview-dialog">
          <DialogTitle className="font-heading font-bold text-[#1A1A19]">Your photo strip</DialogTitle>
          <DialogDescription className="sr-only">Preview of your combined photo strip, ready to download.</DialogDescription>
          <img src={image} alt="Preview" className="w-full h-auto" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
