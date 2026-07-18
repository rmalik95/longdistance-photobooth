"""
Regenerates the filter/frame preview thumbnails shown on the result page.

Run from the backend directory with the project venv:

    .venv/bin/python scripts/generate_previews.py

Filter swatches are rendered by applying photo_strip.FILTERS to one of the
landing-page sample photos, so the thumbnail a user taps is exactly the grade
the server will apply. Frame swatches are real mini photo strips produced by
generate_strip with each FRAME_STYLES style. Re-run this whenever a filter or
frame is added or tuned, and commit the updated images under
frontend/src/assets/filters and frontend/src/assets/frames.
"""
import base64
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from photo_strip import FILTERS, FRAME_STYLES, generate_strip  # noqa: E402

SAMPLES_DIR = REPO_ROOT / "frontend" / "src" / "assets" / "samples"
FILTERS_OUT = REPO_ROOT / "frontend" / "src" / "assets" / "filters"
FRAMES_OUT = REPO_ROOT / "frontend" / "src" / "assets" / "frames"

# The sample photos are polaroids with a white matte; these crops keep only the
# photo area so swatches look like real camera output.
INNER_CROPS = {
    "sunset-jump.jpg": (45, 50, 700, 725),
    "balloons-walk.jpg": (45, 45, 685, 720),
}

FILTER_SWATCH_PX = 112
FRAME_SWATCH_HEIGHT = 132


def load_inner(name: str) -> Image.Image:
    img = Image.open(SAMPLES_DIR / name).convert("RGB")
    return img.crop(INNER_CROPS[name])


def to_data_url(img: Image.Image) -> str:
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def square_crop(img: Image.Image) -> Image.Image:
    side = min(img.width, img.height)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    return img.crop((left, top, left + side, top + side))


def main():
    FILTERS_OUT.mkdir(parents=True, exist_ok=True)
    FRAMES_OUT.mkdir(parents=True, exist_ok=True)

    base = load_inner("sunset-jump.jpg")
    for name, filter_fn in FILTERS.items():
        swatch = square_crop(filter_fn(base.copy())).resize((FILTER_SWATCH_PX, FILTER_SWATCH_PX))
        swatch.save(FILTERS_OUT / f"{name}.jpg", format="JPEG", quality=88)
        print(f"filter  {name}.jpg")

    host_photo = to_data_url(load_inner("sunset-jump.jpg"))
    guest_photo = to_data_url(load_inner("balloons-walk.jpg"))
    for frame in FRAME_STYLES:
        raw = generate_strip(
            [host_photo] * 3, [guest_photo] * 3,
            layout="1x3", frame=frame, filter_name="warm",
        )
        strip = Image.open(BytesIO(raw))
        w = max(1, round(strip.width * FRAME_SWATCH_HEIGHT / strip.height))
        strip.resize((w, FRAME_SWATCH_HEIGHT)).save(FRAMES_OUT / f"{frame}.jpg", format="JPEG", quality=88)
        print(f"frame   {frame}.jpg")


if __name__ == "__main__":
    main()
