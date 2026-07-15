import { useState } from "react";
import { Download, RotateCcw, Eye, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { btnPrimary, btnSecondary, chip } from "@/lib/ui";

const FILTERS = [
  { id: "warm", label: "Warm" },
  { id: "none", label: "Natural" },
  { id: "bw", label: "B&W" },
  { id: "vintage", label: "Vintage" },
  { id: "cool", label: "Cool" },
];

const FRAMES = [
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "film", label: "Film" },
  { id: "polaroid", label: "Polaroid" },
];

export default function ResultPanel({
  image,
  onDownload,
  onRetake,
  filterName,
  onChangeFilter,
  frameName,
  onChangeFrame,
  applyingFilter,
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-5 animate-strip-reveal" data-testid="result-panel">
      <img
        src={image}
        alt="Your photo strip"
        className="max-h-[70vh] w-auto max-w-full rounded-lg shadow-soft-lg"
        data-testid="result-strip-image"
        style={applyingFilter ? { opacity: 0.6 } : undefined}
      />

      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium text-plumgray flex items-center gap-2">
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
              className={`${chip(filterName === opt.id)} disabled:opacity-60`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium text-plumgray">Frame</span>
        <div className="flex flex-wrap justify-center gap-2">
          {FRAMES.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeFrame(opt.id)}
              disabled={applyingFilter}
              data-testid={`frame-option-${opt.id}`}
              className={`${chip(frameName === opt.id)} disabled:opacity-60`}
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
          className={btnSecondary}
        >
          <Eye size={18} /> Preview
        </button>
        <button
          type="button"
          onClick={onDownload}
          data-testid="download-strip-btn"
          className={btnPrimary}
        >
          <Download size={18} /> Download
        </button>
        <button
          type="button"
          onClick={onRetake}
          data-testid="retake-btn"
          className={btnSecondary}
        >
          <RotateCcw size={18} /> Take another
        </button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-blush rounded-2xl border border-plum/10" data-testid="preview-dialog">
          <DialogTitle className="font-heading font-bold text-plum">Your photo strip</DialogTitle>
          <DialogDescription className="sr-only">Preview of your combined photo strip, ready to download.</DialogDescription>
          <img src={image} alt="Preview" className="w-auto max-w-full max-h-[65vh] mx-auto rounded-lg" />
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            data-testid="preview-close-btn"
            className={`${btnSecondary} mx-auto`}
          >
            <X size={18} /> Close
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
