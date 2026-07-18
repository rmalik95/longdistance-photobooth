import { useState } from "react";
import { Download, RotateCcw, Eye, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import filterWarm from "@/assets/filters/warm.jpg";
import filterNone from "@/assets/filters/none.jpg";
import filterBw from "@/assets/filters/bw.jpg";
import filterVintage from "@/assets/filters/vintage.jpg";
import filterCool from "@/assets/filters/cool.jpg";
import filterGolden from "@/assets/filters/golden.jpg";
import filterFade from "@/assets/filters/fade.jpg";
import filterDramatic from "@/assets/filters/dramatic.jpg";
import frameClassic from "@/assets/frames/classic.jpg";
import frameMinimal from "@/assets/frames/minimal.jpg";
import frameFilm from "@/assets/frames/film.jpg";
import framePolaroid from "@/assets/frames/polaroid.jpg";

// Swatches are pre-rendered by backend/scripts/generate_previews.py using the
// same PIL code that produces the strip, so a thumbnail is exactly what the
// server will apply. Re-run that script if a filter or frame is re-tuned.
const FILTERS = [
  { id: "warm", label: "Warm", img: filterWarm },
  { id: "none", label: "Natural", img: filterNone },
  { id: "bw", label: "B&W", img: filterBw },
  { id: "vintage", label: "Vintage", img: filterVintage },
  { id: "cool", label: "Cool", img: filterCool },
  { id: "golden", label: "Golden", img: filterGolden },
  { id: "fade", label: "Fade", img: filterFade },
  { id: "dramatic", label: "Dramatic", img: filterDramatic },
];

const FRAMES = [
  { id: "classic", label: "Classic", img: frameClassic },
  { id: "minimal", label: "Minimal", img: frameMinimal },
  { id: "film", label: "Film", img: frameFilm },
  { id: "polaroid", label: "Polaroid", img: framePolaroid },
];

// Flat hairline option button carrying a visual swatch: selected gets the
// ink treatment (like `chip`), unselected stays on hairline borders.
const swatchBtn = (selected) =>
  `flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-colors duration-200 cursor-pointer ${
    selected
      ? "border-ink bg-ink text-paper"
      : "border-ink/25 text-inksoft hover:border-ink hover:text-ink"
  } disabled:opacity-60`;

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
    <div className="flex flex-col items-center gap-6 animate-strip-reveal" data-testid="result-panel">
      <img
        src={image}
        alt="Your photo strip"
        className="max-h-[70vh] w-auto max-w-full bg-white p-2 sm:p-2.5 rounded-[3px] shadow-photo"
        data-testid="result-strip-image"
        style={applyingFilter ? { opacity: 0.6 } : undefined}
      />

      <div className="flex flex-col items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-inksoft flex items-center gap-2">
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
              aria-pressed={filterName === opt.id}
              className={swatchBtn(filterName === opt.id)}
            >
              <img
                src={opt.img}
                alt=""
                className="h-14 w-14 rounded-[4px] object-cover"
                loading="lazy"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em]">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-inksoft">Frame</span>
        <div className="flex flex-wrap justify-center gap-2">
          {FRAMES.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeFrame(opt.id)}
              disabled={applyingFilter}
              data-testid={`frame-option-${opt.id}`}
              aria-pressed={frameName === opt.id}
              className={swatchBtn(frameName === opt.id)}
            >
              <img
                src={opt.img}
                alt=""
                className="h-20 w-auto rounded-[2px]"
                loading="lazy"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em]">{opt.label}</span>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-paper border border-ink/15 rounded-2xl shadow-lift" data-testid="preview-dialog">
          <DialogTitle className="font-display text-ink">Your photo strip</DialogTitle>
          <DialogDescription className="sr-only">Preview of your combined photo strip, ready to download.</DialogDescription>
          <img src={image} alt="Preview" className="w-auto max-w-full max-h-[65vh] mx-auto rounded-[3px] shadow-photo bg-white p-2" />
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
