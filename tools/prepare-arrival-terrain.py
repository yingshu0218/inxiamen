"""Bake the low-resolution mainland and bay visible beyond the island scenery."""

import argparse
import io
import runpy
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import rasterio
import shapely
import tifffile
from affine import Affine
from PIL import Image, ImageEnhance
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from rasterio.warp import reproject
from shapely.geometry import shape

geo = SimpleNamespace(**{k: v for k, v in runpy.run_path(
    str(Path(__file__).with_name("prepare-geo.py"))
).items() if not k.startswith("__")})
xmin, xmax, zmin, zmax = -42000, 42000, -35000, 32500
bounds = (geo.ORIGIN_LON + xmin / geo.METRES_LON, geo.ORIGIN_LAT - zmax / geo.METRES_LAT,
          geo.ORIGIN_LON + xmax / geo.METRES_LON, geo.ORIGIN_LAT - zmin / geo.METRES_LAT)
width, height = 2240, 1800


def optical(tile):
    # Read the 40 m overview stored at the front of each cloud-optimized GeoTIFF.
    uri = geo.sentinel_uri(tile)
    head = geo.get(uri, {"Range": "bytes=0-65535"}).content
    with tifffile.TiffFile(io.BytesIO(head)) as tif:
        level = tif.pages[2]
        last = max(o + n for o, n in zip(level.dataoffsets, level.databytecounts))
        size = level.imagelength
    data = geo.get(uri, {"Range": f"bytes=0-{last - 1}"}).content
    with rasterio.MemoryFile(data) as f, f.open() as src:
        small = src.read(out_shape=(3, size, size), resampling=Resampling.nearest)
        result = np.zeros((3, height, width), np.uint8)
        reproject(small, result, src_crs=src.crs, src_nodata=0,
                  src_transform=src.transform * Affine.scale(src.width / size, src.height / size),
                  dst_crs="EPSG:4326", dst_transform=from_bounds(*bounds, width, height),
                  resampling=Resampling.bilinear)
    return result


def main(cache):
    xs, zs = np.arange(xmin, xmax + 1, 250), np.arange(zmin, zmax + 1, 250)
    heights = geo.elevation_grid(cache, 11, xs, zs)

    water = []
    for tile in geo.tiles(10, bounds):
        path = geo.local_path(cache, "osm", tile)
        if not path.exists():
            z, x, y = tile
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(geo.get(geo.OSM.format(z=z, x=x, y=y)).content)
        convert = geo.world_converter(tile)
        for feature in geo.vector_tile(cache, tile).get("water", {}).get("features", []):
            # Reservoirs in the hills retain their own height and satellite colour.
            if feature["properties"].get("class") == "ocean":
                water.append((shapely.transform(shape(feature["geometry"]), convert), 0))
    land = rasterize(water, (height, width), fill=255, dtype="uint8",
                     transform=Affine((xmax-xmin)/width, 0, xmin, 0, (zmax-zmin)/height, zmin))
    mosaic = np.zeros((3, height, width), np.uint8)
    with ThreadPoolExecutor(4) as pool:
        for patch in pool.map(optical, ["50QNM", "50QPM", "50RNN", "50RPN"]):
            valid = patch.max(axis=0) > 0
            mosaic[:, valid] = patch[:, valid]
    if np.any((land > 0) & (mosaic.max(axis=0) == 0)):
        raise ValueError("Missing satellite imagery over land")
    image = ImageEnhance.Color(Image.fromarray(np.moveaxis(mosaic, 0, -1))).enhance(.88)
    image = image.point([round(10 + (n / 255) ** .95 * 239) for n in range(256)] * 3)
    image.putalpha(Image.fromarray(land))
    image.save(geo.OUTPUT / "arrival-coast.webp", quality=83, method=5)
    with (geo.OUTPUT / "arrival-relief.bin").open("wb") as f:
        np.array([xmin, xmax, zmin, zmax, len(xs), len(zs)], dtype="<i4").tofile(f)
        np.round(heights).astype("<i2").tofile(f)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    main(parser.parse_args().cache)
