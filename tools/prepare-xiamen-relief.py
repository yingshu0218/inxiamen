"""Bake the main island's Copernicus DSM into the game's 25 m terrain patch.

    python tools/prepare-xiamen-relief.py --source /path/to/n24e118.tif

Uses tools/geo-requirements.txt and the existing base-map / inland-water assets.
Without --source the public, checksum-pinned GeoTIFF is cached locally. Only the
two xiamen-relief files are written to the project. All coordinates are metres.
"""

import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path

import numpy as np
import rasterio
import requests
import shapely
from affine import Affine
from PIL import Image
from rasterio.features import rasterize
from rasterio.windows import Window
from scipy.ndimage import (
    distance_transform_edt, gaussian_filter, grey_opening, map_coordinates, median_filter, rank_filter,
)
from shapely.geometry import Polygon


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public' / 'geo'
TILE = 'Copernicus_DSM_COG_10_N24_00_E118_00_DEM'
TILE_URL = f'https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/{TILE}/{TILE}.tif'
TILE_MD5 = '97f696420b2a634b82da0856e7456dd9'
TILE_BYTES = 19_627_671
STEP = 25
SCALE = .1
XMIN, XMAX, ZMIN, ZMAX = -6250, 7750, -9150, 6500
XS = np.arange(XMIN, XMAX + STEP, STEP)
ZS = np.arange(ZMIN, ZMAX + STEP, STEP)
X, Z = np.meshgrid(XS, ZS)
SHAPE = X.shape
FINE_TRANSFORM = Affine(STEP, 0, XMIN - STEP / 2, 0, STEP, ZMIN - STEP / 2)
PARENT_TRANSFORM = Affine(2 * STEP, 0, XMIN, 0, 2 * STEP, ZMIN)
PARENT_SHAPE = (len(ZS) // 2, len(XS) // 2)
PEAKS = [
    ('云顶岩山脊', 2350, 1600, 275, 339.6, 'https://xm.fjdsfzw.org.cn/2024-09-05/content_151790.html'),
    ('仙岳山', -2975, -2125, 300, 213, 'https://xm.fjdsfzw.org.cn/2024-10-15/content_152651.html'),
    ('狐尾山气象站山脊', -4500, -700, 240, 139.4, 'https://zjt.fujian.gov.cn/ztzl/wqzt/gcjsbzzl/dfbz/xxfb/201107/P020180606543597388150.pdf'),
    ('东坪山公园东侧山脊', 1100, 2375, 250, None, None),
    ('梧村山', -901, 1748, 205, None, None),
    ('五老峰片区', -2650, 3325, 230, None, None),
]
PROFILES = [
    ('仙岳山南北坡', (-2975, -3100), (-2975, -1200), 100),
    ('东坪山区库谷—山脊', (100, 3125), (1600, 2000), 105),
    ('云顶岩东西坡', (1350, 1600), (3300, 1600), 100),
    ('狐尾山东西坡', (-5150, -700), (-3925, -700), 100),
]


def read_json(path):
    return json.loads(path.read_text())


def digest(path, algorithm='sha256'):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, algorithm).hexdigest()


def get_source(explicit, cache):
    local = Path(explicit) if explicit else cache / 'n24e118.tif'
    if not explicit and not local.exists():
        cache.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=cache, delete=False) as tmp:
                temporary = Path(tmp.name)
                with requests.get(TILE_URL, stream=True, timeout=(15, 90)) as response:
                    response.raise_for_status()
                    for block in response.iter_content(1024 * 1024):
                        tmp.write(block)
            if temporary.stat().st_size != TILE_BYTES or digest(temporary, 'md5') != TILE_MD5:
                raise ValueError('Incomplete or unexpected Copernicus source tile')
            os.replace(temporary, local)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    if local.stat().st_size != TILE_BYTES or digest(local, 'md5') != TILE_MD5:
        raise ValueError(f'{local}: the source must be the pinned AWS GLO-30 N24E118 GeoTIFF')
    return local


def smoothstep(low, high, values):
    t = np.clip((values - low) / (high - low), 0., 1.)
    return t * t * (3. - 2. * t)


def interpolate(grid, rows, cols, order=1):
    return map_coordinates(grid, [rows, cols], order=order, mode='nearest', prefilter=order > 1)


def dsm_on_grid(path, manifest):
    """Read a small raster window. GDAL's affine puts point pixels at half offsets."""
    lon = manifest['origin'][0] + X / manifest['axisMetresPerDegree'][0]
    lat = manifest['origin'][1] - Z / manifest['axisMetresPerDegree'][1]
    with rasterio.open(path) as source:
        if source.crs.to_epsg() != 4326 or source.tags().get('AREA_OR_POINT') != 'Point':
            raise ValueError('Unexpected GLO-30 horizontal coordinates')
        cols = (lon - source.transform.c) / source.transform.a - .5
        rows = (lat - source.transform.f) / source.transform.e - .5
        i, j = int(np.floor(rows.min())) - 5, int(np.floor(cols.min())) - 5
        nr, nc = int(np.ceil(rows.max())) + 6 - i, int(np.ceil(cols.max())) + 6 - j
        window = Window(j, i, nc, nr)
        native = source.read(1, window=window, masked=True)
        if np.any(np.ma.getmaskarray(native)):
            raise ValueError('The main-island sample window contains no-data')
        native = np.asarray(native, np.float32)
        transform = source.window_transform(window)
    rows -= i
    cols -= j
    r, c = rows.astype(int), cols.astype(int)
    neighbors = [native[r, c], native[r+1, c], native[r, c+1], native[r+1, c+1]]
    # Preserve shoulders and valley inflections without cubic overshoot at a
    # sharp shoreline, summit or building edge.
    cubic = np.clip(interpolate(native, rows, cols, 3), np.minimum.reduce(neighbors), np.maximum.reduce(neighbors))
    sampled = .68 * cubic + .32 * interpolate(native, rows, cols)
    return sampled, native, transform


def base_inputs(assets, manifest):
    width, height = manifest['width'], manifest['height']
    sx = (width - 1) / (manifest['xmax'] - manifest['xmin'])
    sz = (height - 1) / (manifest['zmax'] - manifest['zmin'])
    u, v = (X - manifest['xmin']) * sx, (Z - manifest['zmin']) * sz
    base = np.fromfile(assets / manifest['terrain'], '<i2').reshape(height, width)
    landcover = np.fromfile(assets / manifest['landcover'], 'u1').reshape(height, width)
    old = interpolate(base.astype(np.float32), v, u)
    cover = interpolate(landcover, v, u, 0)
    # Existing daytime RGB combines actual optical imagery with the road overlay.
    # Green/red is only a secondary hint for the filter, alongside OSM and relief.
    with Image.open(assets / manifest['texture']) as image:
        rgb = np.asarray(image.convert('RGB'))
    h, w = rgb.shape[:2]
    su = (X - manifest['xmin']) * w / (manifest['xmax'] - manifest['xmin']) - .5
    sv = (Z - manifest['zmin']) * h / (manifest['zmax'] - manifest['zmin']) - .5
    red, green = [interpolate(rgb[:, :, k].astype(np.float32), sv, su) for k in (0, 1)]
    greenness = (green - red) / np.maximum(2, green + red)
    return old, cover, greenness


def disk(radius):
    u = np.arange(-radius, radius + 1)
    return u[:, None] ** 2 + u[None, :] ** 2 <= radius ** 2


def ground_from_surface(raw, cover, greenness):
    """Lower compact objects progressively; keep connected wooded ridge profiles."""
    opened_50 = grey_opening(raw, footprint=disk(2), mode='nearest')
    opened_125 = grey_opening(opened_50, footprint=disk(5), mode='nearest')
    opened_225 = grey_opening(opened_125, footprint=disk(9), mode='nearest')
    slope = np.hypot(*np.gradient(gaussian_filter(opened_125, 3.2), STEP))
    wood = gaussian_filter((cover == 2).astype(np.float32), 1.15)
    green = gaussian_filter(smoothstep(.015, .085, greenness), 1.35)
    upland = np.maximum(
        smoothstep(30, 85, opened_125),
        smoothstep(.055, .19, slope) * smoothstep(12, 43, opened_125),
    )
    natural = np.clip(.97 * upland + .52 * wood + .29 * green, 0, 1)
    # The lower envelope handles built-up blocks which include multiple source
    # pixels per roof. Genuine broad slopes survive a planar morphological opening.
    city = .24 * opened_50 + .76 * opened_125 + .95 + 13 * slope
    city -= .65 * np.maximum(0, opened_125 - opened_225 - 2.8 - 82 * slope)
    city = gaussian_filter(np.minimum(raw, city), .65)
    local_median = median_filter(raw, footprint=disk(2), mode='nearest')
    peak_allowance = 3.6 + 18 * np.minimum(slope, .45)
    # Three separate neighbouring samples support a genuine crest better than
    # the median of a 100 m disk does. An isolated single-cell spike has none.
    neighbors = np.ones((3, 3), dtype=bool)
    neighbors[1, 1] = False
    crest_support = rank_filter(raw, rank=-3, footprint=neighbors, mode='nearest')
    ceiling = np.maximum(local_median + peak_allowance, crest_support + 2.6 + 11 * np.minimum(slope, .4))
    # No blanket canopy-height deduction. Suppress isolated positive returns in
    # the forest while retaining naturally steep rock and broad true summits.
    natural_ground = raw - .86 * np.maximum(0, raw - ceiling)
    return city + natural * (natural_ground - city), natural


def active_cells(main, others, detail):
    domain = main.buffer(120)
    active = rasterize([(domain, 1)], out_shape=PARENT_SHAPE, transform=PARENT_TRANSFORM,
                       all_touched=True, dtype='uint8').astype(bool)
    if others:
        neighbor = rasterize([(p, 1) for p in others], out_shape=PARENT_SHAPE,
                             transform=PARENT_TRANSFORM, all_touched=True, dtype='uint8')
        active &= neighbor == 0
    cx, cz = np.meshgrid(XS[:-1:2] + STEP, ZS[:-1:2] + STEP)
    active &= ~((cx >= detail['xmin']) & (cx < detail['xmax']) &
                (cz >= detail['zmin']) & (cz < detail['zmax']))
    fine = np.repeat(np.repeat(active, 2, axis=0), 2, axis=1)
    padded = np.pad(fine, 1)
    # A vertex belongs to the interior only if all four adjacent subcells do.
    interior = padded[:-1, :-1] & padded[1:, :-1] & padded[:-1, 1:] & padded[1:, 1:]
    return active, smoothstep(25, 100, distance_transform_edt(interior) * STEP)


def row_runs(active):
    rows = []
    for row in active:
        padded = np.pad(row, 1)
        rows.append(np.flatnonzero(padded[1:] != padded[:-1]).tolist())
    return rows


def seam_checks(active, field, old):
    # 50 m edges subdivide an integer 50 m base interval at 25 m; their
    # midpoints are half-integers, exactly representable in decimetres.
    cells = np.pad(active.astype(np.uint8).repeat(2, 0).repeat(2, 1), 1)
    count = cells[:-1, :-1] + cells[1:, :-1] + cells[:-1, 1:] + cells[1:, 1:]
    boundary = (count > 0) & (count < 4)
    seam = np.abs(field - old)
    if np.any(seam[boundary] > .0001) or np.any(seam[count == 0] > SCALE / 2 + .0001):
        raise ValueError('The replacement terrain differs from the original at the coarse mesh seam')
    return {'boundaryVertices': int(boundary.sum()), 'maxSeamErrorMetres': round(float(seam[boundary].max()), 3),
            'maxInactiveStorageErrorMetres': round(float(seam[count == 0].max()), 3)}


def hydrography(terrain, bodies):
    """Join each terrain bank to its corresponding in-game horizontal plane."""
    hmap = terrain.copy()
    strongest = np.zeros(SHAPE, dtype=np.float32)
    summary = []
    for body in bodies:
        rings = [np.array(r).reshape(-1, 2) for r in body['rings']]
        polygon = Polygon(rings[0], rings[1:])
        if not polygon.is_valid:
            polygon = shapely.make_valid(polygon)
        h = float(body['h'])
        l, t, r, b = polygon.bounds
        ix = np.flatnonzero((XS >= l - 55) & (XS <= r + 55))
        iz = np.flatnonzero((ZS >= t - 55) & (ZS <= b + 55))
        if not len(ix) or not len(iz):
            continue
        crop = np.ix_(iz, ix)
        x, z = X[crop], Z[crop]
        inside = shapely.contains_xy(polygon, x, z)
        distance = shapely.distance(polygon.boundary, shapely.points(x, z))
        # Geometry is the observed surface, not bathymetry. A shallow sealed bed
        # beneath each plane also avoids z-fighting at oblique viewing angles.
        local_floor = np.where(inside, h - .8 - np.minimum(1.2, .026 * distance),
                               h - .55 + .10 * distance)
        strength = np.where(inside, 1., 1. - smoothstep(0, 43, distance))
        select = strength > strongest[crop]
        hmap[crop] = np.where(select, terrain[crop] + strength * (local_floor - terrain[crop]), hmap[crop])
        strongest[crop] = np.maximum(strongest[crop], strength)
        if body.get('name') or h > 115:
            point = polygon.representative_point()
            summary.append({'name': body.get('name'), 'xz': [round(point.x), round(point.y)],
                            'surfaceMetres': h, 'terrainSamplesInside': int(inside.sum())})
    return hmap, summary


def runway_flatten(terrain, runway):
    a, b = np.array(runway['threshold05']), np.array(runway['threshold23'])
    direction = b - a
    t = np.clip(((X-a[0])*direction[0] + (Z-a[1])*direction[1]) / (direction @ direction), -.025, 1.025)
    d = np.hypot(X-a[0]-t*direction[0], Z-a[1]-t*direction[1])
    return runway['ground'] + smoothstep(135, 315, d) * (terrain-runway['ground'])


def peak_checks(field, old, native, transform, manifest):
    result = []
    lon0, lat0 = manifest['origin']
    mx, mz = manifest['axisMetresPerDegree']
    nr, nc = np.indices(native.shape)
    nx = (transform.c + (nc + .5) * transform.a - lon0) * mx
    nz = (lat0 - transform.f - (nr + .5) * transform.e) * mz
    for name, cx, cz, radius, reference, link in PEAKS:
        patch = (X - cx)**2 + (Z - cz)**2 <= radius**2
        source = (nx - cx)**2 + (nz - cz)**2 <= radius**2
        j, i = np.unravel_index(np.argmax(np.where(patch, field, -1000)), SHAPE)
        info = {'name': name, 'sampledCrestXZ': [int(X[j, i]), int(Z[j, i])], 'searchRadiusMetres': radius,
                'nativeDsmMax': round(float(native[source].max()), 1),
                'oldGridMax': round(float(old[patch].max()), 1), 'newGridMax': round(float(field[j, i]), 1)}
        if reference is not None:
            info['publishedLocalHeight'] = reference
            info['reference'] = link
        result.append(info)
    return result


def profile_checks(field, old):
    profiles = []
    for name, start, end, nominal in PROFILES:
        length = np.hypot(end[0]-start[0], end[1]-start[1])
        n = round(length / nominal)
        u = (np.linspace(start[0], end[0], n+1)-XMIN) / STEP
        v = (np.linspace(start[1], end[1], n+1)-ZMIN) / STEP
        profiles.append({'name': name, 'fromXZ': start, 'toXZ': end,
                         'oldMetres': np.round(interpolate(old, v, u), 1).astype(float).round(1).tolist(),
                         'newMetres': np.round(interpolate(field, v, u), 1).astype(float).round(1).tolist()})
    return profiles


def bake(source, assets, output):
    manifest = read_json(assets / 'manifest.json')
    islands = read_json(assets / manifest['islands'])
    water_file = assets / 'inland-water.json'
    water = read_json(water_file)['water']
    main = Polygon(islands['xiamen'])
    others = [Polygon(r) for r in [islands['gulangyu'], *islands['neighbors']]]
    raw, native, transform = dsm_on_grid(source, manifest)
    old, cover, greenness = base_inputs(assets, manifest)
    ground, natural = ground_from_surface(raw, cover, greenness)
    active, edge = active_cells(main, others, manifest['gulangyuDetail'])
    on_island = rasterize([(main, 1)], out_shape=SHAPE, transform=FINE_TRANSFORM, dtype='uint8').astype(bool)
    shore = distance_transform_edt(on_island) * STEP - STEP / 2
    # The polygon used here may be simplified by 26 m. Both it and the original
    # coast mask thus keep a shared strip of the already-aligned base coast.
    shoreline_blend = smoothstep(38, 142, shore)
    terrain = old + shoreline_blend * (np.maximum(.95, ground) - old)
    terrain, water_stats = hydrography(terrain, water)
    terrain = runway_flatten(terrain, manifest['runway'])
    field = old + edge * (terrain - old)
    encoded = np.rint(field / SCALE).astype('<i2')
    field = encoded.astype(np.float32) * SCALE
    output.mkdir(parents=True, exist_ok=True)
    binary = output / 'xiamen-relief.bin'
    encoded.tofile(binary)
    runs = row_runs(active)
    interior_city = on_island & (shore > 150) & (cover == 1) & (natural < .45)
    delta = raw[interior_city] - ground[interior_city]
    metadata = {
        'v': 1, 'file': binary.name, 'xmin': XMIN, 'xmax': XMAX, 'zmin': ZMIN, 'zmax': ZMAX,
        'width': len(XS), 'height': len(ZS), 'spacingX': STEP, 'spacingZ': STEP, 'stepMetres': STEP,
        'scale': SCALE, 'metresPerUnit': SCALE, 'offset': 0, 'noData': None, 'byteOrder': 'little',
        'format': 'int16', 'grid': 'vertex samples, north to south rows, west to east columns; north is -z',
        'parentCellMetres': STEP*2, 'activeRows': runs,
        'activeRowsEncoding': 'one row per local 50 m parent-cell row; paired x indices [start,end) relative to xmin/zmin',
        'activeParentCellCount': int(active.sum()), 'sha256': digest(binary),
        'crs': {'horizontal': 'WGS84 in the game local plane', 'originLonLat': manifest['origin'],
                'metresPerDegree': manifest['axisMetresPerDegree'], 'sourceVertical': 'EGM2008, metres',
                'editedAreas': 'Local hydrography and the 16 m runway share game-world heights.'},
        'coverage': 'Only Xiamen Island is reprocessed. Marine transition and inactive cells are resampled from terrain.bin. Gulangyu retains its original 10 m priority patch.',
        'method': 'Clipped monotone cubic / bilinear sampling of GLO-30; progressive 50, 125 and 225 m-radius opening in built districts; slope, OSM woodland and existing Sentinel RGB distinguish broad landforms. A slope-tolerant local-median ceiling suppresses isolated high returns in wooded uplands. No empirical summit anchoring.',
        'coastAndSeams': 'Original outer coast retained within about 38 m of the island outline, full new relief by 142 m. 50 m cell edges of the active area and its first 25 m interior row use the original terrain. Gulangyu detail rectangle excluded.',
        'water': {'source': water_file.name, 'inputSha256': digest(water_file), 'waterBodies': len(water),
                  'reference': 'Heights from the matching water-surface dataset. A synthetic 0.8–2 m shallow floor lies under the plane and banks transition over 43 m. No surveyed bathymetry.',
                  'examples': water_stats},
        'runway': {'threshold05': manifest['runway']['threshold05'], 'threshold23': manifest['runway']['threshold23'],
                   'height': manifest['runway']['ground'], 'halfWidthFlatMetres': 135, 'outerBlendMetres': 315},
        'source': {'dataset': 'Copernicus DEM GLO-30 Public, 2021 release, 1 arc-second point spacing',
                   'file': TILE_URL, 'md5': TILE_MD5, 'doi': 'https://doi.org/10.5270/ESA-c5d3d65',
                   'archive': 'https://registry.opendata.aws/copernicus-dem/',
                   'license': 'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf',
                   'credit': 'produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved',
                   'notice': 'The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.',
                   'otherInputCredits': ['credits.json', 'inland-water.json']},
        'accuracy': '25 m is output vertex spacing. 0.1 m is storage precision. Copernicus measures the reflective surface; local terrain filtering, nearshore grading and synthetic beds are approximations. Published summit/station heights are independent comparisons.',
        'checks': {'seams': seam_checks(active, field, old), 'peaks': peak_checks(field, old, native, transform, manifest),
                   'profiles': profile_checks(field, old),
                   'urbanPositiveReturnReductionMetres': {str(p): round(float(np.percentile(delta, p)), 1) for p in (50, 90, 99, 100)}},
    }
    (output / 'xiamen-relief.json').write_text(json.dumps(metadata, ensure_ascii=False, separators=(',', ':'))+'\n')
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='exact original AWS N24E118 TIFF')
    parser.add_argument('--cache', type=Path, default=Path(tempfile.gettempdir())/'xm-geo-cache'/'relief')
    parser.add_argument('--assets', type=Path, default=ASSETS)
    parser.add_argument('--output', type=Path, default=ASSETS)
    args = parser.parse_args()
    result = bake(get_source(args.source, args.cache), args.assets, args.output)
    print(f"25 m relief: {result['width']} × {result['height']} vertices; {result['activeParentCellCount']} active parent cells")
    for p in result['checks']['peaks']:
        print(f"{p['name']}: {p['oldGridMax']} m → {p['newGridMax']} m; native DSM {p['nativeDsmMax']} m")


if __name__ == '__main__':
    main()
