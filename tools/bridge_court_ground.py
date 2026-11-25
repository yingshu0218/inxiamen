"""Bake the two residential ground patches into adjacent transparent atlas cells."""

import gzip
import json

import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union


def bake_bridge_courts(root, rows):
    survey = json.loads(
        gzip.decompress((root / "tools/data/lehai-plots.json.gz").read_bytes())
    )
    # Approximate the landscaped D07 parcel inside the checked perimeter roads.
    # The perimeter encloses all eight tower bases and follows the disclosed area.
    d07 = Polygon(
        [
            (7769, -10256),
            (7718, -10131),
            (7723, -10105),
            (7750, -10071),
            (7813, -10012),
            (7931, -10128),
            (7935, -10164),
            (7880, -10229),
            (7796, -10303),
        ]
    )
    plots = [Polygon(rings[0], rings[1:]) for rings in survey["plots"].values()]
    size = 768
    atlas = Image.new("RGBA", (size * 2, size))
    for n, sites in enumerate([plots, [d07]]):
        xmin, zmin, xmax, zmax = survey["groundBounds"][n]

        def uv(p):
            return (
                (p[0] - xmin) * size / (xmax - xmin),
                (p[1] - zmin) * size / (zmax - zmin),
            )

        image = Image.new("RGBA", (size, size))
        draw = ImageDraw.Draw(image)

        def paint(p, color):
            for poly in getattr(p, "geoms", [p]):
                if poly.geom_type != "Polygon" or poly.is_empty:
                    continue
                draw.polygon([uv(pt) for pt in poly.exterior.coords], fill=color)
                for ring in poly.interiors:
                    draw.polygon([uv(pt) for pt in ring.coords], fill=(0, 0, 0, 0))

        area = unary_union(sites)
        reach = area.buffer(65)
        for site in sites:
            paint(site, (157, 152, 137, 217))
            paint(site.buffer(-3), (113, 127, 100, 216))
        for r in rows:
            if area.covers(r.poly.representative_point()):
                paint(
                    r.poly.buffer(3.3, join_style="mitre").intersection(area),
                    (169, 161, 145, 230),
                )
        for width, points in survey[("lehaiRoads", "west-estateRoads")[n]]:
            line = LineString(points)
            if not reach.intersects(line):
                continue
            for half_width, color in [
                (width / 2 + 1.3, (167, 164, 152, 225)),
                (width / 2, (105, 110, 108, 240)),
            ]:
                paint(line.buffer(half_width), color)
        pixels = np.array(image)
        luminance = np.random.default_rng(480 + n).normal(0, 1.6, (size, size, 1))
        pixels[:, :, :3] = np.clip(pixels[:, :, :3] + luminance, 0, 255)
        # Feather the reach of roads at the edge of the surveyed cells.
        iy, ix = np.indices((size, size))
        border = np.minimum.reduce([iy, ix, size - 1 - iy, size - 1 - ix])
        pixels[:, :, 3] = (pixels[:, :, 3] * np.clip(border / 12, 0, 1)).astype("uint8")
        atlas.paste(Image.fromarray(pixels), (n * size, 0))
    atlas.save(root / "public/scenery/bridge-court-ground.webp", quality=84, method=5)
