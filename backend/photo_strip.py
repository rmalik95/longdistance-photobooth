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

STRIP_WIDTH = 900
PHOTO_H = 300
PADDING = 26
BORDER_W = 3
FOOTER_H = 110
BG_COLOR = "#FFFDF9"
BORDER_COLOR = "#1A1A19"
TEXT_PRIMARY = "#1A1A19"
TEXT_SECONDARY = "#4A4A48"


def _decode(data_url: str) -> Image.Image:
    payload = data_url.split(",", 1)[-1]
    raw = base64.b64decode(payload)
    return Image.open(BytesIO(raw))


def _apply_consistent_filter(img: Image.Image) -> Image.Image:
    """Apply a shared warm-tone treatment so photos from mismatched cameras
    (phone vs laptop webcam) look visually consistent side by side."""
    img = ImageOps.exif_transpose(img).convert("RGB")
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.06)
    img = ImageEnhance.Brightness(img).enhance(1.04)
    r, g, b = img.split()
    r = r.point(lambda i: min(255, int(i * 1.06)))
    b = b.point(lambda i: int(i * 0.93))
    return Image.merge("RGB", (r, g, b))


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


def generate_strip(host_photos: list, guest_photos: list) -> bytes:
    rounds = min(len(host_photos), len(guest_photos))
    col_w = (STRIP_WIDTH - PADDING * 3) // 2
    strip_h = PADDING + rounds * (PHOTO_H + PADDING) + FOOTER_H

    canvas = Image.new("RGB", (STRIP_WIDTH, strip_h), BG_COLOR)
    draw = ImageDraw.Draw(canvas)

    for i in range(rounds):
        y = PADDING + i * (PHOTO_H + PADDING)
        host_img = _cover_fit(_apply_consistent_filter(_decode(host_photos[i])), col_w, PHOTO_H)
        guest_img = _cover_fit(_apply_consistent_filter(_decode(guest_photos[i])), col_w, PHOTO_H)
        x1 = PADDING
        x2 = PADDING * 2 + col_w
        canvas.paste(host_img, (x1, y))
        canvas.paste(guest_img, (x2, y))
        draw.rectangle([x1, y, x1 + col_w, y + PHOTO_H], outline=BORDER_COLOR, width=BORDER_W)
        draw.rectangle([x2, y, x2 + col_w, y + PHOTO_H], outline=BORDER_COLOR, width=BORDER_W)

    draw.rectangle([0, 0, STRIP_WIDTH - 1, strip_h - 1], outline=BORDER_COLOR, width=BORDER_W)

    footer_y = strip_h - FOOTER_H + 22
    title_font = _load_font(34)
    sub_font = _load_font(18)
    title = "together, apart"
    sub = "captured live \u2022 nothing saved"
    tw = draw.textlength(title, font=title_font)
    sw = draw.textlength(sub, font=sub_font)
    draw.text(((STRIP_WIDTH - tw) / 2, footer_y), title, fill=TEXT_PRIMARY, font=title_font)
    draw.text(((STRIP_WIDTH - sw) / 2, footer_y + 46), sub, fill=TEXT_SECONDARY, font=sub_font)

    buf = BytesIO()
    canvas.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def generate_strip_data_url(host_photos: list, guest_photos: list) -> str:
    raw = generate_strip(host_photos, guest_photos)
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"
