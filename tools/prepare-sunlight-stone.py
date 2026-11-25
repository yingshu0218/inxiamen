"""Pack the CC0 Poly Haven Rock Boulder Dry diffuse and OpenGL normal maps for the island."""
import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("diffuse", type=Path)
    parser.add_argument("normal_gl", type=Path)
    args = parser.parse_args()
    with Image.open(args.diffuse) as diffuse, Image.open(args.normal_gl) as normal:
        if diffuse.size != normal.size:
            raise ValueError("The source maps must have matching dimensions")
        nx, ny, _ = normal.convert("RGB").split()
        # The scan supplies mineral grain. Larger rain stains belong to the
        # mountain, otherwise the same dark patch repeats across every face.
        luma = diffuse.convert("L")
        grain = ImageChops.subtract(luma, luma.filter(ImageFilter.GaussianBlur(19)), offset=157)
        detail = Image.merge("RGB", (Image.blend(grain, luma, .30), nx, ny))
        detail = detail.resize((768, 768), Image.Resampling.LANCZOS)
        destination = Path(__file__).resolve().parents[1] / "public/scenery/sunlight-granite.webp"
        detail.save(destination, quality=88, method=6)


if __name__ == "__main__":
    main()
