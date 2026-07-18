"""
Server-side photo strip compositor.

Photos are decoded fully in memory, composited into a single strip image,
and the resulting bytes are handed back to the caller. Nothing is written
to disk at any point -- the caller (server.py) is responsible for discarding
all references immediately after sending the result to both clients.
"""
import base64
from io import BytesIO

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

def _decode(data_url: str) -> Image.Image:
    payload = data_url.split(",", 1)[-1]
    raw = base64.b64decode(payload)
    return Image.open(BytesIO(raw))


def _cover_fit(img: Image.Image, w: int, h: int) -> Image.Image:
    src_ratio = img.width / img.height
    target_ratio = w / h
    if src_ratio > target_ratio:
        new_h = h
        new_w = max(1, int(h * src_ratio))
    else:
        new_w = w
        new_h = max(1, int(w / src_ratio))
    img = img.resize((new_w, new_h))
    left = (new_w - w) // 2
    top = (new_h - h) // 2
    return img.crop((left, top, left + w, top + h))


def _load_font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


PHOTO_W = 200           # each half of a duo frame (280 made 2x2 grid too wide to be "roughly square")
PHOTO_H = 210
DIVIDER_W = 2           # thin line between you & partner
GAP = 8                 # gap between frames (was 26)
BORDER_W = 2
FOOTER_H = 84
INK = "#1A1A19"
TEXT_SECONDARY = "#4A4A48"


def _f_none(img):
    return ImageOps.exif_transpose(img).convert("RGB")


def _f_warm(img):
    img = _f_none(img)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.06)
    img = ImageEnhance.Brightness(img).enhance(1.04)
    r, g, b = img.split()
    r = r.point(lambda i: min(255, int(i * 1.06)))
    b = b.point(lambda i: int(i * 0.93))
    return Image.merge("RGB", (r, g, b))


def _f_bw(img):
    img = _f_none(img).convert("L")
    img = ImageEnhance.Contrast(img).enhance(1.12)
    return img.convert("RGB")


def _f_vintage(img):
    img = _f_none(img)
    gray = img.convert("L")
    sepia = Image.merge("RGB", (
        gray.point(lambda i: min(255, int(i * 1.07) + 14)),
        gray.point(lambda i: min(255, int(i * 0.93) + 8)),
        gray.point(lambda i: int(i * 0.78)),
    ))
    img = Image.blend(img, sepia, 0.65)
    return ImageEnhance.Contrast(img).enhance(0.95)


def _f_cool(img):
    img = _f_none(img)
    r, g, b = img.split()
    r = r.point(lambda i: int(i * 0.94))
    b = b.point(lambda i: min(255, int(i * 1.08)))
    return ImageEnhance.Color(Image.merge("RGB", (r, g, b))).enhance(1.02)


def _f_golden(img):
    # Golden-hour glow in the spirit of Instagram's Juno/Valencia: warm reds,
    # lifted saturation and brightness, cooled-down blues.
    img = _f_none(img)
    img = ImageEnhance.Color(img).enhance(1.18)
    img = ImageEnhance.Brightness(img).enhance(1.06)
    img = ImageEnhance.Contrast(img).enhance(1.05)
    r, g, b = img.split()
    r = r.point(lambda i: min(255, int(i * 1.10) + 6))
    b = b.point(lambda i: int(i * 0.88))
    return Image.merge("RGB", (r, g, b))


def _f_fade(img):
    # Soft film fade (Gingham-like): gentle desaturation, lifted blacks and
    # compressed whites via a shared tone curve.
    img = _f_none(img)
    img = ImageEnhance.Color(img).enhance(0.82)
    img = ImageEnhance.Contrast(img).enhance(0.92)
    lut = [min(255, int(18 + i * 0.90)) for i in range(256)]
    r, g, b = img.split()
    return Image.merge("RGB", (r.point(lut), g.point(lut), b.point(lut)))


def _f_dramatic(img):
    # Punchy Lo-Fi/X-Pro II-style grade: deep contrast and saturated colors.
    img = _f_none(img)
    img = ImageEnhance.Contrast(img).enhance(1.25)
    img = ImageEnhance.Color(img).enhance(1.25)
    return ImageEnhance.Brightness(img).enhance(0.98)


FILTERS = {
    "none": _f_none,
    "warm": _f_warm,
    "bw": _f_bw,
    "vintage": _f_vintage,
    "cool": _f_cool,
    "golden": _f_golden,
    "fade": _f_fade,
    "dramatic": _f_dramatic,
}

FRAME_STYLES = {
    "classic":  {"bg": "#FFFDF9", "border": True,  "text": INK,       "sub": TEXT_SECONDARY, "margin": 14},
    "minimal":  {"bg": "#FFFFFF", "border": False, "text": INK,       "sub": TEXT_SECONDARY, "margin": 6},
    "film":     {"bg": "#141412", "border": False, "text": "#FDFBF7", "sub": "#B8B6AF",      "margin": 30},
    "polaroid": {"bg": "#FFFFFF", "border": False, "text": INK,       "sub": TEXT_SECONDARY, "margin": 22},
}


def _duo_frame(host_url: str, guest_url: str, filter_fn) -> Image.Image:
    # Clients send raw camera frames. On screen each person sees themselves on
    # the left and their partner on the right, so both gesture toward their own
    # right, which lands on the same side in both raw frames. The host occupies
    # the left half of the strip, so their frame is mirrored to turn them inward;
    # the guest is already facing inward on the right half. Without this the two
    # of them point the same way instead of at each other.
    host = ImageOps.mirror(_cover_fit(filter_fn(_decode(host_url)), PHOTO_W, PHOTO_H))
    guest = _cover_fit(filter_fn(_decode(guest_url)), PHOTO_W, PHOTO_H)
    frame = Image.new("RGB", (PHOTO_W * 2 + DIVIDER_W, PHOTO_H), INK)
    frame.paste(host, (0, 0))
    frame.paste(guest, (PHOTO_W + DIVIDER_W, 0))
    return frame


def _draw_sprockets(draw: ImageDraw.ImageDraw, width: int, height: int):
    hole_w, hole_h, step = 14, 10, 34
    for y in range(16, height - FOOTER_H, step):
        draw.rounded_rectangle([8, y, 8 + hole_w, y + hole_h], radius=3, fill="#FDFBF7")
        draw.rounded_rectangle([width - 8 - hole_w, y, width - 8, y + hole_h], radius=3, fill="#FDFBF7")


def generate_strip(host_photos: list, guest_photos: list, layout: str = "1x3",
                   frame: str = "classic", filter_name: str = "warm") -> bytes:
    rounds = min(len(host_photos), len(guest_photos))
    style = FRAME_STYLES.get(frame, FRAME_STYLES["classic"])
    filter_fn = FILTERS.get(filter_name, _f_warm)
    margin = style["margin"]
    frame_w = PHOTO_W * 2 + DIVIDER_W

    duos = [_duo_frame(host_photos[i], guest_photos[i], filter_fn) for i in range(rounds)]

    if layout == "2x2":
        cols = 2
        width = margin * 2 + cols * frame_w + GAP
        rows = (rounds + cols - 1) // cols
        height = margin * 2 + rows * PHOTO_H + (rows - 1) * GAP + FOOTER_H
        positions = [
            (margin + (i % cols) * (frame_w + GAP), margin + (i // cols) * (PHOTO_H + GAP))
            for i in range(rounds)
        ]
    else:
        width = margin * 2 + frame_w
        height = margin * 2 + rounds * PHOTO_H + (rounds - 1) * GAP + FOOTER_H
        positions = [(margin, margin + i * (PHOTO_H + GAP)) for i in range(rounds)]

    if frame == "polaroid":
        height += 26  # extra-wide bottom matte

    canvas = Image.new("RGB", (width, height), style["bg"])
    draw = ImageDraw.Draw(canvas)

    for duo, (x, y) in zip(duos, positions):
        canvas.paste(duo, (x, y))
        if style["border"]:
            draw.rectangle([x, y, x + frame_w - 1, y + PHOTO_H - 1], outline=INK, width=BORDER_W)

    if frame == "film":
        _draw_sprockets(draw, width, height)
    if frame == "classic":
        draw.rectangle([0, 0, width - 1, height - 1], outline=INK, width=BORDER_W + 1)

    footer_y = height - FOOTER_H - (26 if frame == "polaroid" else 0) + 24
    title_font = _load_font(30)
    title = "together, apart"
    tw = draw.textlength(title, font=title_font)
    draw.text(((width - tw) / 2, footer_y), title, fill=style["text"], font=title_font)

    buf = BytesIO()
    canvas.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def generate_strip_data_url(host_photos: list, guest_photos: list, layout: str = "1x3",
                            frame: str = "classic", filter_name: str = "warm") -> str:
    raw = generate_strip(host_photos, guest_photos, layout=layout, frame=frame, filter_name=filter_name)
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"
