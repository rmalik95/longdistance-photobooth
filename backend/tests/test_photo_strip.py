import base64
from io import BytesIO

import pytest
from PIL import Image

from photo_strip import generate_strip


def _photo(color):
    img = Image.new("RGB", (640, 480), color)
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _photos(n):
    return [_photo("red")] * n, [_photo("blue")] * n


@pytest.mark.parametrize("layout,rounds", [("1x4", 4), ("1x3", 3), ("2x2", 4), ("1x2", 2)])
@pytest.mark.parametrize("frame", ["classic", "minimal", "film", "polaroid"])
@pytest.mark.parametrize("filter_name", ["none", "warm", "bw", "vintage", "cool"])
def test_all_combinations_render(layout, rounds, frame, filter_name):
    host, guest = _photos(rounds)
    raw = generate_strip(host, guest, layout=layout, frame=frame, filter_name=filter_name)
    img = Image.open(BytesIO(raw))
    assert img.format == "JPEG"
    assert img.width > 0 and img.height > 0


def test_vertical_strip_is_taller_than_wide():
    host, guest = _photos(4)
    raw = generate_strip(host, guest, layout="1x4")
    img = Image.open(BytesIO(raw))
    assert img.height > img.width * 1.5


def test_grid_is_roughly_square():
    host, guest = _photos(4)
    raw = generate_strip(host, guest, layout="2x2")
    img = Image.open(BytesIO(raw))
    assert 0.6 < img.width / img.height < 1.7


def test_bw_filter_is_grayscale():
    host, guest = _photos(2)
    raw = generate_strip(host, guest, layout="1x2", filter_name="bw")
    img = Image.open(BytesIO(raw)).convert("RGB")
    px = img.getpixel((img.width // 4, img.height // 3))
    assert max(px) - min(px) < 12
