import { useState } from "react";
import { Download, RotateCcw, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function ResultPanel({ image, onDownload, onRetake }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const btnBase =
    "flex items-center gap-2 border-2 border-[#1A1A19] shadow-[4px_4px_0px_0px_rgba(26,26,25,1)] hover:shadow-[2px_2px_0px_0px_rgba(26,26,25,1)] hover:translate-y-[2px] hover:translate-x-[2px] transition-all px-6 py-3 uppercase tracking-widest text-sm font-bold";

  return (
    <div className="flex flex-col items-center gap-8 animate-strip-reveal" data-testid="result-panel">
      <div className="bg-white border-2 border-[#1A1A19] shadow-[6px_6px_0px_0px_rgba(26,26,25,1)] p-3 sm:p-4 max-w-sm">
        <img src={image} alt="Your photo strip" className="w-full h-auto" data-testid="result-strip-image" />
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
          <img src={image} alt="Preview" className="w-full h-auto" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
