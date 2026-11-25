"""Prepare the mapped streets and offline ground texture around Xiamen Station."""
import argparse
import json
import math
import re
import urllib.request
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import LineString, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
STATION = json.loads((ROOT / 'src/railway-plan.json').read_text())
OX, OZ = STATION['origin']
C, S = math.cos(STATION['angle']), math.sin(STATION['angle'])
BOUNDS = (-2075, 405, -730, 1660)


def to_local(lon, lat):
    x, z = (lon - 118.125) * 101220 - OX, (24.48 - lat) * 111100 - OZ
    return x * C + z * S, -x * S + z * C


def to_world(u, v):
    return OX + u * C - v * S, OZ + u * S + v * C


def points(coords):
    return [[round(x, 1), round(z, 1)] for x, z in coords]


def read_map(cache):
    if not cache.exists():
        query = 'https://www.openstreetmap.org/api/0.6/map?bbox=118.1020,24.4660,118.1205,24.4780'
        req = urllib.request.Request(query, headers={'User-Agent': 'Xiamen flight scenery preparation'})
        with urllib.request.urlopen(req, timeout=60) as response:
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_bytes(response.read())
    tree = ET.parse(cache)
    nodes = {int(n.get('id')): to_local(float(n.get('lon')), float(n.get('lat'))) for n in tree.findall('node')}
    ways = {int(w.get('id')): ([nodes[int(n.get('ref'))] for n in w.findall('nd')],
                              {t.get('k'): t.get('v') for t in w.findall('tag')})
            for w in tree.findall('way')}
    return ways


def make_plan(ways):
    def road(ids, bounds, axis=0, direction=1):
        chain = []
        for key in ids:
            line, _ = ways[key]
            line = line if direction * (line[-1][axis] - line[0][axis]) > 0 else line[::-1]
            chain.extend(line[1:] if chain and line[0] == chain[-1] else line)
        line = LineString(chain).intersection(box(*bounds))
        if line.geom_type == 'MultiLineString':
            line = max(line.geoms, key=lambda l: l.length)
        return points(line.simplify(.32).coords)

    def area(key, tolerance=.65):
        return points(list(Polygon(ways[key][0]).simplify(tolerance).exterior.coords)[:-1])

    def access(key, width, kind='service'):
        return [kind, width, points(LineString(ways[key][0]).simplify(.25).coords)]

    xiahe_bounds = (-508, -480, 581, -127)
    hubin_bounds = (-45, -425, 55, -170)
    south_bounds = (-438, 28, 539, 223)
    return {
        'groundBounds': list(BOUNDS),
        'xiahe': [road([441793413, 441793414, 651888361, 472081154], xiahe_bounds),
                  road([406895755, 1260575116, 406442267], xiahe_bounds)],
        'hubin': [road([441793403], hubin_bounds, 1, -1)[::-1],
                  road([164551389], hubin_bounds, 1, -1)[::-1]],
        'south': [road([651879256], south_bounds), road([651843853, 651879264], south_bounds)],
        'east': [road([761095193], (519, -221, 623, 64), 1), road([127162252], (519, -221, 623, 64), 1)],
        'brt': road([178136080], (-565, -460, 602, -140)),
        'access': [access(1076501994, 7.5, 'dropOff'), access(702391554, 6.0), access(456279175, 5.5),
                   access(702391562, 7.4), access(702391563, 4.1), access(702391564, 6.6),
                   access(702391565, 3.9), access(702391566, 3.9), access(702391556, 4.1),
                   access(702391558, 4.1), access(702391561, 4.5), access(761360760, 4.4),
                   access(761360761, 4.4), access(702327037, 4.3)],
        'brtWalk': points(ways[174709383][0][:6]),
        'transitYard': area(1460191177),
        'school': area(1362815611),
        'robinson': area(1336352386),
        'robinsonTowers': [area(w) for w in range(1336352387, 1336352392)],
        'yuyue': [[-249,-194],[-221,-218],[-201,-222],[-169,-211],[-121,-197],[-96,-189],[-92,-100],[-119,-91],[-242,-96]],
        'coachHouse': [[54,-323],[124,-310],[112,-224],[90,-224],[87,-217],[49,-225],[34,-232]],
        'hotelBlock': [[76,-155],[87,-167],[137,-168],[144,-150],[142,-70],[133,-55],[78,-55],[74,-91]],
        'eastHousing': [[154,-158],[246,-156],[254,-147],[254,-80],[229,-58],[158,-58],[150,-70]],
        'southVerge': [[-206,161],[-145,174],[-72,179],[-61,174],[-51,178],[50,177],[124,178],[173,176],
                       [187,175],[183,186],[126,195],[53,198],[-48,198],[-68,194],[-81,195],[-146,187],[-193,176]],
        'parking': [[[-225,77],[-172,80],[-171,144],[-206,133],[-239,112]], [[243,88],[265,81],[291,89],[301,106],
                                                                              [291,123],[243,130]]],
    }


def bake_ground(ways, plan):
    xmin, zmin, xmax, zmax = BOUNDS
    size = xmax - xmin, zmax - zmin
    img = Image.new('RGB', size, '#9e9c8b')
    draw = ImageDraw.Draw(img)

    def paint(shape, color):
        for poly in getattr(shape, 'geoms', [shape]):
            if poly.geom_type != 'Polygon' or poly.is_empty:
                continue
            draw.polygon([(round(x - xmin), round(z - zmin)) for x, z in map(lambda p: to_world(*p), poly.exterior.coords)], fill=color)

    extent = box(-635, -475, 650, 380)
    for coords, tags in ways.values():
        if len(coords) < 4 or coords[0] != coords[-1]:
            continue
        if tags.get('natural') == 'wood' or tags.get('landuse') in ('forest', 'grass', 'cemetery') or tags.get('leisure') in ('park', 'garden', 'pitch'):
            paint(Polygon(coords).buffer(0).intersection(extent), '#778561')
    paint(Polygon([(-235,217),(-185,218),(-92,218),(102,216),(142,220),(164,226),(140,322),(-61,365),(-159,336)]), '#788663')
    for key in ['robinson', 'yuyue', 'coachHouse', 'transitYard', 'school', 'hotelBlock', 'eastHousing']:
        ring = Polygon(plan[key]).buffer(0)
        paint(ring.buffer(8), '#8e9980')
        paint(ring.buffer(3), '#b5b0a0')
        paint(ring, '#a5a594')
    for ring in [*plan['parking'], *STATION['serviceBuildings']]:
        print_area = Polygon(ring)
        paint(print_area.buffer(2.4), '#b0ab98')
        paint(print_area, '#898d84')
    for key in ['xiahe', 'hubin', 'south', 'east']:
        for row in plan[key]:
            path = LineString(row)
            radius = 7 if key == 'xiahe' else 5.1
            paint(path.buffer(radius + 3.7), '#a9a590')
            paint(path.buffer(radius), '#686c64')
    for _, width, line in plan['access']:
        path = LineString(line)
        paint(path.buffer(width * .5 + 1.5), '#a8a591')
        paint(path.buffer(width * .5), '#73766c')
    paint(Polygon(plan['southVerge']), '#85926d')
    rng = np.random.default_rng(41)
    soft = Image.fromarray(rng.integers(90, 160, (110, 125), dtype=np.uint8)).resize(size, Image.Resampling.BICUBIC)
    texture = np.asarray(img, dtype=np.int16)
    variation = ((np.asarray(soft, dtype=np.int16) - 125) / 4 + rng.normal(0, 1.5, size[::-1])).astype(np.int16)
    img = Image.fromarray(np.clip(texture + variation[:, :, None], 0, 255).astype(np.uint8))
    zz, xx = np.indices(size[::-1], dtype=np.float32)
    x, z = xx + xmin - OX, zz + zmin - OZ
    u, v = C * x + S * z, -S * x + C * z
    edge = np.minimum.reduce([u + 575, 590 - u, v + 406, 306 - v, xx, zz, size[0] - 1 - xx, size[1] - 1 - zz])
    t = np.clip(edge / 91, 0, 1)
    img.putalpha(Image.fromarray(np.uint8(255 * t * t * (3 - 2 * t))).filter(ImageFilter.GaussianBlur(3)))
    img.save(ROOT / 'public/scenery/wucun-ground.webp', quality=81, method=6)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--map', type=Path, default=Path('/tmp/xm-wucun-map/district.osm'))
    args = parser.parse_args()
    ways = read_map(args.map)
    plan = make_plan(ways)
    dumped = json.dumps(plan, ensure_ascii=False, indent=2)
    dumped = re.sub(r'\[\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*\]', r'[\1, \2]', dumped)
    (ROOT / 'src/wucun-plan.json').write_text(dumped + '\n')
    bake_ground(ways, plan)


if __name__ == '__main__':
    main()
