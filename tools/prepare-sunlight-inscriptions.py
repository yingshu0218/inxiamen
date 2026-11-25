"""Draw the original ink mask for the eastern face of Sunlight Rock."""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("font", type=Path, help="a typeface with Traditional Chinese glyphs")
    parser.add_argument("--index", type=int, default=0, help="face index in a font collection")
    args = parser.parse_args()
    image = Image.new("L", (512, 576))
    draw = ImageDraw.Draw(image)

    def character(text, x, y, size):
        face = ImageFont.truetype(str(args.font), size, index=args.index)
        l, t, r, b = face.getbbox(text)
        draw.text((x - (l + r) / 2, y - (t + b) / 2), text, font=face, fill=246)

    # The upper inscription is read from the right. The two lower titles are vertical.
    for i, glyph in enumerate("濤海風天"):
        character(glyph, 74 + 102 * i, 80, 71)
    for x, words, size in [(417, "鼓浪洞天", 84), (291, "鷺江第一", 77), (115, "林鍼", 54)]:
        for i, glyph in enumerate(words):
            character(glyph, x, 196 + i * 92, size)
    path = Path(__file__).resolve().parents[1] / "public/scenery/sunlight-inscriptions.png"
    image.save(path, optimize=True)


if __name__ == "__main__":
    main()
