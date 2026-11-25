"""Bake the Xiamen flight area into offline assets. Use Python 3.12+ and geo-requirements.txt.

    python tools/prepare-geo.py --cache /tmp/xm-geo-cache

Distances and heights are metres. North is the first raster row. All source
requests are for this small flight area. A subsequent run reuses the cache.
"""

import argparse
import json
import math
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import mapbox_vector_tile
import numpy as np
import rasterio
import requests
import shapely
import tifffile
from affine import Affine
from PIL import Image, ImageEnhance, ImageFilter
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds as window_from_bounds
from scipy.ndimage import distance_transform_edt, gaussian_filter, map_coordinates
from scipy.spatial import cKDTree
from shapely.geometry import Point, box, shape
from shapely.ops import unary_union


OUTPUT = Path(__file__).resolve().parents[1] / "public" / "geo"
ORIGIN_LON, ORIGIN_LAT = 118.125, 24.48
METRES_LON, METRES_LAT = 101220.0, 111100.0
XMIN, XMAX, ZMIN, ZMAX = -19000, 19000, -16000, 16000
GRID_W, GRID_H = 761, 641
TEX_W, TEX_H = 4096, 3450
COAST_W = 3072
COAST_H = round(COAST_W * (ZMAX - ZMIN) / (XMAX - XMIN))
COAST_METADATA = {
    "coastDistance": "coast-distance.png",
    "coastDistanceEncoding": {
        "width": COAST_W, "height": COAST_H,
        "pixelMetres": [(XMAX - XMIN) / COAST_W, (ZMAX - ZMIN) / COAST_H],
        "shoreValue": 128, "metresPerStep": 2, "positive": "land",
        "format": "8-bit grayscale data, north up, northwest pixel first; shared texture bounds",
    },
}
BOUNDS = (
    ORIGIN_LON + XMIN / METRES_LON, ORIGIN_LAT - ZMAX / METRES_LAT,
    ORIGIN_LON + XMAX / METRES_LON, ORIGIN_LAT - ZMIN / METRES_LAT,
)
BUILDING_BOUNDS = (118.006, 24.397, 118.221, 24.600)
WORLD = box(XMIN, ZMIN, XMAX, ZMAX)
GRID_STEP = (XMAX - XMIN) / (GRID_W - 1)
# rasterize() samples cell centres. Elevation samples are the terrain mesh vertices.
GRID_TRANSFORM = Affine(GRID_STEP, 0, XMIN - GRID_STEP / 2, 0, GRID_STEP, ZMIN - GRID_STEP / 2)
TEXTURE_TRANSFORM = from_bounds(*BOUNDS, TEX_W, TEX_H)
OSM = "https://tiles.openfreemap.org/planet/20261115_080022_pt/{z}/{x}/{y}.pbf"
DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
TILE_SET = ("50RNN", "50RPN")
RUNWAY_05 = np.array([-1071.9, -6080.3])
RUNWAY_23 = np.array([1652.9, -8214.2])
RUNWAY_ELEVATION = 16
NETWORK = threading.local()


def save_json(name, data):
    (OUTPUT / name).write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))


def session():
    if not hasattr(NETWORK, "client"):
        NETWORK.client = requests.Session()
        NETWORK.client.headers["User-Agent"] = "Xiamen-Coastal-Flight/1.0 offline area bake"
    return NETWORK.client


def get(url, headers=None, timeout=35):
    for attempt in range(4):
        try:
            result = session().get(url, headers=headers, timeout=timeout)
            result.raise_for_status()
            return result
        except requests.RequestException:
            if attempt == 3:
                raise
            time.sleep(1 + 2 * attempt)


def slippy(z, lon, lat):
    scale = 2 ** z
    return (lon + 180) / 360 * scale, (1 - np.arcsinh(np.tan(np.deg2rad(lat))) / np.pi) * scale / 2


def tiles(z, bounds):
    west, south, east, north = bounds
    x0, y0 = slippy(z, west, north)
    x1, y1 = slippy(z, east, south)
    return [(z, x, y) for x in range(int(x0), int(x1) + 1) for y in range(int(y0), int(y1) + 1)]


def local_path(cache, kind, tile):
    return cache / kind / "-".join(map(str, tile))


def cache_vectors_and_heights(cache, include_heights=True):
    jobs = [("osm", t) for t in tiles(12, BOUNDS) + tiles(14, BUILDING_BOUNDS)]
    if include_heights:
        jobs += [("dem", t) for t in tiles(12, BOUNDS)]

    def download(job):
        kind, tile = job
        target = local_path(cache, kind, tile)
        if target.is_file():
            return
        z, x, y = tile
        url = (OSM if kind == "osm" else DEM).format(z=z, x=x, y=y)
        data = get(url).content
        target.parent.mkdir(exist_ok=True, parents=True)
        target.write_bytes(data)

    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(download, jobs))


def world_converter(tile):
    z, x, y = tile
    scale = 2 ** z

    def convert(xy):
        lon = (x + xy[:, 0] / 4096) / scale * 360 - 180
        norm_y = (y + xy[:, 1] / 4096) / scale
        lat = np.rad2deg(np.arctan(np.sinh(np.pi * (1 - 2 * norm_y))))
        return np.column_stack(((lon - ORIGIN_LON) * METRES_LON, (ORIGIN_LAT - lat) * METRES_LAT))

    return convert


def vector_tile(cache, tile):
    data = local_path(cache, "osm", tile).read_bytes()
    return mapbox_vector_tile.decode(data, default_options={"y_coord_down": True})


def as_polygons(geom):
    if geom.geom_type == "Polygon":
        yield geom
    elif geom.geom_type in ("MultiPolygon", "GeometryCollection"):
        for part in geom.geoms:
            yield from as_polygons(part)


def land_class(layer, props):
    primary = props.get("class", "")
    specific = props.get("subclass", "")
    if primary in ("wood", "woodland", "forest") or specific == "forest":
        return 2
    if primary in ("sand", "rock", "bare_rock") or specific in ("beach", "sand", "bare_rock"):
        return 4
    if primary in ("farmland", "farm", "vineyard", "orchard") or specific in ("farmland", "orchard"):
        return 5
    if primary in ("grass", "grassland", "scrub", "heath", "garden", "pitch", "park", "recreation_ground"):
        return 3
    if layer == "landuse" and primary in ("industrial", "residential", "commercial", "retail", "railway"):
        return 1
    return None


def collect_land(cache):
    ocean, inland, ground = [], [], []
    for tile in tiles(12, BOUNDS):
        layers = vector_tile(cache, tile)
        convert = world_converter(tile)
        nw, se = convert(np.array([[0, 0], [4096, 4096]]))
        extent = box(nw[0], nw[1], se[0], se[1]).intersection(WORLD)
        for layer in ("water", "landuse", "landcover"):
            for feature in layers.get(layer, {}).get("features", []):
                props = feature["properties"]
                code = 0 if layer == "water" else land_class(layer, props)
                if code is None:
                    continue
                geom = shapely.transform(shape(feature["geometry"]), convert)
                if not geom.is_valid:
                    geom = shapely.make_valid(geom)
                geom = geom.intersection(extent)
                if geom.is_empty:
                    continue
                if layer == "water":
                    (ocean if props.get("class") == "ocean" else inland).append(geom)
                else:
                    ground.append((geom, code))
    return unary_union(ocean), inland, ground


def coast_outlines(ocean):
    land = [poly for poly in as_polygons(WORLD.difference(ocean)) if poly.area > 18000]
    locate = lambda lon, lat: Point((lon - ORIGIN_LON) * METRES_LON, (ORIGIN_LAT - lat) * METRES_LAT)
    xiamen = min(land, key=lambda p: p.distance(locate(118.114, 24.47)))
    gulangyu = min(land, key=lambda p: p.distance(locate(118.064, 24.445)))

    def outline(poly):
        ring = list(poly.simplify(26, preserve_topology=True).exterior.coords)[:-1]
        return [[round(x), round(z)] for x, z in ring]

    neighbors = [outline(p) for p in sorted(land, key=lambda poly: -poly.area)
                 if p is not xiamen and p is not gulangyu and p.area > 150000]
    save_json("islands.json", {"xiamen": outline(xiamen), "gulangyu": outline(gulangyu), "neighbors": neighbors})
    return gulangyu


def detailed_water(cache, ocean, inland):
    """Use native z14 harbour/island boundaries throughout the high-detail flight area."""
    detail = []
    extents = []
    for tile in tiles(14, BUILDING_BOUNDS):
        convert = world_converter(tile)
        nw, se = convert(np.array([[0, 0], [4096, 4096]]))
        extent = box(nw[0], nw[1], se[0], se[1]).intersection(WORLD)
        extents.append(extent)
        layers = vector_tile(cache, tile)
        for feature in layers.get("water", {}).get("features", []):
            poly = shapely.transform(shape(feature["geometry"]), convert)
            if not poly.is_valid:
                poly = shapely.make_valid(poly)
            detail.extend(as_polygons(poly.intersection(extent)))
    detail_region = unary_union(extents).envelope
    surroundings = unary_union([ocean, *inland]).difference(detail_region)
    # Dissolve tile buffers and seams before measuring any shoreline distances.
    return shapely.union_all([surroundings, *detail], grid_size=.05)


def write_coast_distance(water):
    """Linear, unsigned-byte encoding of signed metres from the true vector shoreline.

    Values are clamp(round(128 + d/2), 0, 255). Land is positive and sea/ponds
    negative. Pixel centres are ~12.37 m apart; coverage matches ground.webp.
    Boundary samples spaced at most 2 m apart limit distance error to 1 m before
    byte quantization. Bilinear sampling produces a continuous edge for whitewater.
    """
    pixel_x = (XMAX - XMIN) / COAST_W
    pixel_z = (ZMAX - ZMIN) / COAST_H
    transform = Affine(pixel_x, 0, XMIN, 0, pixel_z, ZMIN)
    wet = rasterize([(water, 1)], out_shape=(COAST_H, COAST_W), transform=transform, dtype="uint8")
    # The sides of the flight chart are artificial clipping edges, never shorelines.
    boundary = water.boundary.difference(WORLD.boundary.buffer(.25))
    coordinates = shapely.get_coordinates(shapely.segmentize(boundary, 2.0))
    tree = cKDTree(coordinates)
    result = np.empty((COAST_H, COAST_W), dtype=np.uint8)
    x = XMIN + (np.arange(COAST_W) + .5) * pixel_x
    for first in range(0, COAST_H, 48):
        last = min(first + 48, COAST_H)
        z = ZMIN + (np.arange(first, last) + .5) * pixel_z
        xx, zz = np.meshgrid(x, z)
        points = np.column_stack((xx.ravel(), zz.ravel()))
        distance, _ = tree.query(points, distance_upper_bound=256, workers=2)
        distance = np.minimum(distance, 256).reshape(last - first, COAST_W)
        distance[wet[first:last] != 0] *= -1
        result[first:last] = np.clip(np.rint(128 + distance * .5), 0, 255).astype(np.uint8)
    Image.fromarray(result).save(OUTPUT / "coast-distance.png", optimize=True)


def elevation_grid(cache, zoom=12, xs=None, zs=None):
    if xs is None:
        xs = np.linspace(XMIN, XMAX, GRID_W)
        zs = np.linspace(ZMIN, ZMAX, GRID_H)
    bounds = (ORIGIN_LON + xs[0] / METRES_LON, ORIGIN_LAT - zs[-1] / METRES_LAT,
              ORIGIN_LON + xs[-1] / METRES_LON, ORIGIN_LAT - zs[0] / METRES_LAT)
    area = tiles(zoom, bounds)
    x_tiles = [t[1] for t in area]
    y_tiles = [t[2] for t in area]
    left, top = min(x_tiles), min(y_tiles)
    mosaic = np.zeros(((max(y_tiles) - top + 1) * 256, (max(x_tiles) - left + 1) * 256), np.float32)
    for z, x, y in area:
        path = local_path(cache, "dem", (z, x, y))
        if not path.is_file():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(get(DEM.format(z=z, x=x, y=y)).content)
        rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
        tile_h = rgb[:, :, 0] * 256 + rgb[:, :, 1] + rgb[:, :, 2] / 256 - 32768
        row, col = 256 * (y - top), 256 * (x - left)
        mosaic[row:row + 256, col:col + 256] = tile_h
    longitudes = ORIGIN_LON + xs / METRES_LON
    latitudes = ORIGIN_LAT - zs / METRES_LAT
    tx, ty = slippy(zoom, longitudes, latitudes)
    u, v = np.meshgrid((tx - left) * 256 - .5, (ty - top) * 256 - .5)
    return map_coordinates(mosaic, [v, u], order=1, mode="nearest")


def write_gulangyu_terrain(cache):
    # The patch boundary falls on coarse mesh grid lines in the surrounding sea.
    xs = np.arange(-7500, -5199, 10)
    zs = np.arange(2450, 4801, 10)
    heights = elevation_grid(cache, 14, xs, zs)
    x, z = np.meshgrid(xs, zs)
    coast = np.asarray(Image.open(OUTPUT / "coast-distance.png"), dtype=np.float32)
    u = (x - XMIN) * coast.shape[1] / (XMAX - XMIN) - .5
    v = (z - ZMIN) * coast.shape[0] / (ZMAX - ZMIN) - .5
    shore = (map_coordinates(coast, [v, u], order=1, mode="nearest") - 128) * 2
    land = np.minimum(np.maximum(heights, 1.15), 1.15 + .64 * np.maximum(shore, 0))
    patch = np.where(shore >= 0, land, -.65 + .38 * np.maximum(-82, shore))
    main = np.fromfile(OUTPUT / "terrain.bin", dtype="<i2").reshape(GRID_H, GRID_W)
    old = map_coordinates(main.astype(np.float32), [(z - ZMIN)/GRID_STEP, (x - XMIN)/GRID_STEP], order=1)
    edge = np.minimum.reduce([x - xs[0], xs[-1] - x, z - zs[0], zs[-1] - z])
    blend = np.clip(edge / 95., 0, 1)
    patch = patch * blend + old * (1 - blend)
    from gulangyu_relief import refine_island
    patch = refine_island(np.rint(patch*10)*.1, x, z, shore, OUTPUT.parent)
    np.rint(patch * 10).astype("<i2").tofile(OUTPUT / "gulangyu-heights.bin")
    return {"file": "gulangyu-heights.bin", "xmin": int(xs[0]), "xmax": int(xs[-1]),
            "zmin": int(zs[0]), "zmax": int(zs[-1]), "width": len(xs), "height": len(zs),
            "metresPerUnit": .1, "stepMetres": 10, "source": "Mapzen Terrarium z14, local Copernicus GLO-30 relative relief, mapped sand and coastline"}


def write_terrain(cache, ocean, inland, ground):
    alt = elevation_grid(cache)
    grid_args = {"out_shape": (GRID_H, GRID_W), "transform": GRID_TRANSFORM, "dtype": "uint8"}
    sea = rasterize([(ocean, 1)], **grid_args).astype(bool)
    ponds = rasterize([(p, 1) for p in inland], **grid_args).astype(bool)
    # Keep hillside reservoirs at their measured elevation. Tidal lakes may share the sea plane.
    sea |= ponds & (alt <= 8)
    ground.sort(key=lambda item: {1: 0, 5: 1, 3: 2, 2: 3, 4: 4}[item[1]])
    categories = rasterize(ground, fill=1, **grid_args)
    categories[sea | ponds] = 0
    shore_distance = distance_transform_edt(~sea)
    terrain = gaussian_filter(np.maximum(alt, 1.8), .42)
    terrain = np.minimum(terrain, 3.2 + 37 * shore_distance)
    terrain[sea] = -(3 + np.minimum(30, distance_transform_edt(sea)[sea] * 3.5))
    xs, zs = np.meshgrid(np.linspace(XMIN, XMAX, GRID_W), np.linspace(ZMIN, ZMAX, GRID_H))
    delta = RUNWAY_23 - RUNWAY_05
    along = ((xs - RUNWAY_05[0]) * delta[0] + (zs - RUNWAY_05[1]) * delta[1]) / np.dot(delta, delta)
    along = np.clip(along, -.025, 1.025)
    distance = np.hypot(xs - RUNWAY_05[0] - along * delta[0], zs - RUNWAY_05[1] - along * delta[1])
    blend = np.clip((distance - 135) / 180, 0, 1)
    blend = blend * blend * (3 - 2 * blend)
    terrain = terrain * blend + RUNWAY_ELEVATION * (1 - blend)
    categories[distance < 140] = 1
    np.rint(terrain).astype("<i2").tofile(OUTPUT / "terrain.bin")
    categories.tofile(OUTPUT / "landcover.bin")
    return terrain, categories


def estimated_height(poly, gulangyu, terrain_h):
    centre = poly.centroid
    x, z = centre.x, centre.y
    # OpenMapTiles supplies 5 m when OSM has no height. Shape- and neighbourhood-based
    # heights are only a game approximation. Seed from ground position to keep repeatable.
    seed = ((round(x) * 73856093) ^ (round(z) * 19349663)) & 65535
    variation = seed / 65535
    area = poly.area
    if gulangyu.covers(centre):
        return round(5 + min(4, area / 95) + 4.8 * variation)
    if terrain_h > 94 or area < 72:
        return round(4 + variation * 6)
    if area > 2600:
        return round(9 + 13 * variation)
    if area < 180:
        return round(6 + area / 70 + variation * 9)
    built = (z < 2900 and abs(x) < 6100 and terrain_h < 85)
    if built and 260 < area < 1600:
        return round(17 + min(12, area / 70) + 37 * variation ** 1.7)
    return round(9 + min(14, area / 80) + 18 * variation ** 1.6)


def write_buildings(cache, gulangyu, terrain):
    result = []
    seen = set()
    estimated = 0
    for tile in tiles(14, BUILDING_BOUNDS):
        layers = vector_tile(cache, tile)
        convert = world_converter(tile)
        for feat in layers.get("building", {}).get("features", []):
            height = feat["properties"].get("render_height", 5)
            for outline in as_polygons(shape(feat["geometry"])):
                # Vector-tile buffers retain footprints spanning tile boundaries; own them by centre.
                local = outline.centroid
                if not (0 <= local.x < 4096 and 0 <= local.y < 4096):
                    continue
                world = shapely.transform(outline, convert)
                if not world.is_valid:
                    world = world.buffer(0)
                for poly in as_polygons(world):
                    if not 22 <= poly.area <= 135000:
                        continue
                    poly = poly.simplify(1.15, preserve_topology=True)
                    centre = poly.centroid
                    col = round((centre.x - XMIN) / GRID_STEP)
                    row = round((centre.y - ZMIN) / GRID_STEP)
                    if not (0 <= row < GRID_H and 0 <= col < GRID_W) or terrain[row, col] < -3:
                        continue
                    key = (round(centre.x / 3), round(centre.y / 3), round(poly.area / 14))
                    if key in seen:
                        continue
                    seen.add(key)
                    inferred = height == 5 or height <= 0
                    h = estimated_height(poly, gulangyu, terrain[row, col]) if inferred else round(height)
                    coords = [[round(x), round(z)] for x, z in list(poly.exterior.coords)[:-1]]
                    coords = [p for i, p in enumerate(coords) if p != coords[i - 1]]
                    if len(coords) < 3:
                        continue
                    result.append([h] + [axis for point in coords for axis in point])
                    estimated += inferred
    save_json("buildings.json", {"items": result})
    return len(result), estimated


def sentinel_uri(tile):
    return (f"https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/50/{tile[2]}/"
            f"{tile[-2:]}/2025/3/S2B_{tile}_20250323_0_L2A/TCI.tif")


def local_cog_window(cache, tile):
    """Fetch just the full-resolution COG blocks covering the area, in adjacent byte ranges."""
    uri = sentinel_uri(tile)
    filename = cache / (tile + "-flight-region.tif")
    marker = filename.with_suffix(".ready")
    if marker.exists() and filename.is_file():
        return filename
    head = get(uri, headers={"Range": "bytes=0-196607"})
    if head.status_code != 206:
        raise RuntimeError("The Sentinel COG server did not honour the range request.")
    length = int(head.headers["Content-Range"].split("/")[-1])
    with filename.open("wb") as f:
        f.write(head.content)
        f.truncate(length)
    # The eastern tile covers the island. The western tile only supplies a short
    # strip; limiting its block range avoids downloading nearly all of both overlaps.
    west, south, east, north = BOUNDS
    if tile == "50RNN":
        east = west + (east - west) * .29
    with rasterio.open(filename) as dataset:
        projected = transform_bounds("EPSG:4326", dataset.crs, west, south, east, north)
        window = window_from_bounds(*projected, transform=dataset.transform)
        bh, bw = dataset.block_shapes[0]
        cols = math.ceil(dataset.width / bw)
        rows = math.ceil(dataset.height / bh)
    with tifffile.TiffFile(filename) as source:
        page = source.pages[0]
        offsets, counts = page.dataoffsets, page.databytecounts
    col0 = max(0, math.floor((window.col_off - 3) / bw))
    col1 = min(cols, math.ceil((window.col_off + window.width + 3) / bw))
    row0 = max(0, math.floor((window.row_off - 3) / bh))
    row1 = min(rows, math.ceil((window.row_off + window.height + 3) / bh))
    spans = []
    for row in range(row0, row1):
        indices = range(row * cols + col0, row * cols + col1)
        for index in indices:
            start, end = offsets[index], offsets[index] + counts[index]
            if spans and start - spans[-1][1] < 64 and end - spans[-1][0] < 2200000:
                spans[-1] = (spans[-1][0], end)
            else:
                spans.append((start, end))

    def fetch_blocks(span):
        start, end = span
        r = get(uri, {"Range": f"bytes={start}-{end - 1}"})
        if r.status_code != 206 or len(r.content) != end - start:
            raise RuntimeError("Incomplete optical COG range")
        with filename.open("r+b") as f:
            f.seek(start)
            f.write(r.content)

    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(fetch_blocks, spans))
    marker.write_text("10 m blocks for Xiamen flight region")
    return filename


def optical_mosaic(cache):
    path = cache / "optical.png"
    if path.exists():
        return Image.open(path).convert("RGB")
    mosaic = np.zeros((TEX_H, TEX_W, 3), np.uint8)
    for tile in TILE_SET:
        file = local_cog_window(cache, tile)
        # Never ask GDAL to substitute an unfetched overview for a full-resolution block.
        with rasterio.open(file, overview_level="NONE") as dataset, WarpedVRT(
            dataset, crs="EPSG:4326", transform=TEXTURE_TRANSFORM, width=TEX_W,
            height=TEX_H, src_nodata=0, nodata=0, resampling=Resampling.bilinear,
            tolerance=.05, warp_extras={"OVR_LEVEL": "NONE"}
        ) as project:
            if tile == "50RNN":
                cut = int(TEX_W * .285)
                data = np.moveaxis(project.read([1, 2, 3], window=((0, TEX_H), (0, cut))), 0, -1)
                mosaic[:, :cut] = data
            else:
                data = np.moveaxis(project.read([1, 2, 3]), 0, -1)
                valid = data.max(axis=2) > 0
                mosaic[valid] = data[valid]
    if np.mean(mosaic.max(axis=2) == 0) > .0001:
        raise RuntimeError("Incomplete optical coverage")
    image = Image.fromarray(mosaic)
    image.save(path)
    return image


def write_optical(cache):
    image = optical_mosaic(cache)
    # A neutral albedo keeps small urban lights, beach sand, roof shapes and greenery
    # legible under the game's low sun without baking golden-hour illumination into it.
    image = ImageEnhance.Color(image).enhance(.88)
    image = image.point([round(10 + (n / 255) ** .95 * 239) for n in range(256)] * 3)
    image = image.filter(ImageFilter.UnsharpMask(radius=.85, percent=68, threshold=4))
    image.save(OUTPUT / "ground.webp", quality=89, method=5)
    categories = np.fromfile(OUTPUT / "landcover.bin", np.uint8).reshape((GRID_H, GRID_W))
    small = np.asarray(image.resize((GRID_W, GRID_H), Image.Resampling.BOX), np.float32)
    red, green, blue = np.moveaxis(small, -1, 0)
    terrain = np.fromfile(OUTPUT / "terrain.bin", "<i2").reshape((GRID_H, GRID_W))
    # Sparse OSM landcover is supplemented only where the optical colour also agrees.
    sap = (green - red > 5) & (green > blue * 1.07) & (red < 137)
    categories[(categories == 1) & sap & (terrain > 3)] = 3
    categories[(categories == 3) & sap & (terrain > 45) & (red < 112)] = 2
    categories.tofile(OUTPUT / "landcover.bin")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path(tempfile.gettempdir()) / "xm-geo-cache")
    parser.add_argument("--part", choices=("terrain", "imagery", "coast", "gulangyu", "all"), default="all")
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    args.cache.mkdir(parents=True, exist_ok=True)
    if args.part in ("terrain", "coast", "all"):
        cache_vectors_and_heights(args.cache, include_heights=args.part != "coast")
        ocean, inland, land = collect_land(args.cache)
    if args.part in ("terrain", "all"):
        gulangyu = coast_outlines(ocean)
        terrain, _ = write_terrain(args.cache, ocean, inland, land)
        count, estimated = write_buildings(args.cache, gulangyu, terrain)
        save_json("manifest.json", {
            "xmin": XMIN, "xmax": XMAX, "zmin": ZMIN, "zmax": ZMAX,
            "width": GRID_W, "height": GRID_H, "texWidth": TEX_W, "texHeight": TEX_H,
            "terrain": "terrain.bin", "texture": "ground.webp", "landcover": "landcover.bin",
            "buildings": "buildings.json", "islands": "islands.json",
            "origin": [ORIGIN_LON, ORIGIN_LAT], "axisMetresPerDegree": [METRES_LON, METRES_LAT],
            "grid": "north-to-south rows, west-to-east columns; end vertices on the bounding box",
            "heightFormat": "signed int16 little-endian metres; negative beneath sea plane",
            "landcoverCodes": {"water": 0, "built": 1, "wood": 2, "green": 3, "sandRock": 4, "farmland": 5},
            "buildingCount": count, "estimatedHeights": estimated,
            "runway": {"threshold05": RUNWAY_05.tolist(), "threshold23": RUNWAY_23.tolist(), "ground": RUNWAY_ELEVATION},
            **COAST_METADATA,
            "credits": "credits.json",
        })
        print(f"Terrain range {terrain.min():.1f} to {terrain.max():.1f} m; {count} footprints.", flush=True)
    if args.part in ("coast", "all"):
        write_coast_distance(detailed_water(args.cache, ocean, inland))
        manifest = OUTPUT / "manifest.json"
        if args.part == "coast" and manifest.exists():
            save_json("manifest.json", {**json.loads(manifest.read_text()), **COAST_METADATA})
        print(f"Wrote {COAST_W}×{COAST_H} signed-distance coast texture.", flush=True)
    if args.part in ("gulangyu", "terrain", "coast", "all") and (OUTPUT / "coast-distance.png").is_file():
        detail = write_gulangyu_terrain(args.cache)
        manifest = OUTPUT / "manifest.json"
        save_json("manifest.json", {**json.loads(manifest.read_text()), "gulangyuDetail": detail})
        print("Wrote Gulangyu terrain on a 10 m grid.", flush=True)
    if args.part in ("imagery", "all"):
        write_optical(args.cache)
        print("Wrote 10 m true-colour ground texture.", flush=True)


if __name__ == "__main__":
    main()
