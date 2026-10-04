"""Prepare sourced cat photos for the web UI without generating new imagery."""
from collections import deque
from pathlib import Path
from PIL import Image

SOURCE = Path("client/assets/cats")
PIXEL_SIZE = 180


def pixelate(image: Image.Image) -> Image.Image:
    image.thumbnail((PIXEL_SIZE, PIXEL_SIZE), Image.Resampling.LANCZOS)
    return image.resize((image.width * 4, image.height * 4), Image.Resampling.NEAREST)


def cut_out_yellow_backdrop(image: Image.Image) -> Image.Image:
    """Remove the connected studio-yellow backdrop around the tabby photograph."""
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    queue = deque()
    seen = set()

    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))

    while queue:
        x, y = queue.popleft()
        if (x, y) in seen:
            continue
        seen.add((x, y))
        red, green, blue, _alpha = pixels[x, y]
        # Studio backdrop is warm yellow; requiring a connected path prevents the
        # similarly warm tabby coat from being stripped out.
        is_backdrop = red > 120 and green > 85 and blue < 120 and red < green * 1.8
        if not is_backdrop:
            continue
        pixels[x, y] = (red, green, blue, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in seen:
                queue.append((nx, ny))
    return rgba


for source in SOURCE.glob("*.jpg"):
    image = Image.open(source)
    processed = pixelate(image)
    processed.save(source.with_suffix(".png"), optimize=True)

tabby = Image.open(SOURCE / "tabby.jpg")
pixelate(cut_out_yellow_backdrop(tabby)).save(SOURCE / "tabby-cutout.png", optimize=True)
