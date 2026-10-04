"""Extract the countertop and tintable cat layers from the supplied art sheet."""

from pathlib import Path

from PIL import Image


SOURCE = Path("/Users/jodiec/Downloads/UntitledArtwork2.png")
OUTPUT = Path("client/assets/tilemap")

# Measured from the transparent source sheet.  Keeping this explicit means the
# assets can be re-created exactly if the source art is replaced.
COUNTER_BOX = (560, 485, 1215, 1130)
CAT_BOX = (1360, 720, 1665, 1180)


def tight_crop(image: Image.Image, padding: int = 8) -> Image.Image:
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        return image
    left = max(0, bounds[0] - padding)
    top = max(0, bounds[1] - padding)
    right = min(image.width, bounds[2] + padding)
    bottom = min(image.height, bounds[3] + padding)
    return image.crop((left, top, right, bottom))


def make_eye_layer(cat: Image.Image) -> Image.Image:
    """Keep the source's pale eye pixels above the runtime fur-color tint."""
    pixels = cat.load()
    eyes = Image.new("RGBA", cat.size)
    output = eyes.load()
    for y in range(cat.height):
        for x in range(cat.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha and red > 115 and green > 90 and blue > 130:
                output[x, y] = (red, green, blue, alpha)
    return eyes


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    OUTPUT.mkdir(parents=True, exist_ok=True)

    counter = tight_crop(source.crop(COUNTER_BOX))
    cat = tight_crop(source.crop(CAT_BOX))
    counter.save(OUTPUT / "purple-counter.png")
    cat.save(OUTPUT / "cat-base.png")
    make_eye_layer(cat).save(OUTPUT / "cat-eyes.png")


if __name__ == "__main__":
    main()
