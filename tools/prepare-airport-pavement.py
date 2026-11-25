"""Build the Gaoqi movement-area polygons in runway-aligned metres."""

import json
import subprocess
from pathlib import Path

from shapely import set_precision
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GRID = 0.002


def layout():
    script = """
import { apronOutlines, taxiRoutes, sampleTaxiRoute } from './src/airport-layout.js';
import { runway } from './src/route.js';
const taxiways = taxiRoutes.map(route => ({ width: route.width, ...sampleTaxiRoute(route) }));
console.log(JSON.stringify({ apronOutlines, taxiways, length: runway.length, width: runway.width }));
"""
    result = subprocess.run(
        ['node', '--input-type=module', '-e', script], cwd=ROOT, check=True, capture_output=True, text=True
    )
    return json.loads(result.stdout)


def rounded_junctions(geometry, radius):
    joined = geometry.buffer(radius, quad_segs=8).buffer(-radius, quad_segs=8)
    outline = joined.union(geometry).simplify(0.13, preserve_topology=True)
    return set_precision(set_precision(outline, GRID), 0)


def as_rings(geometry):
    polygons = [geometry] if geometry.geom_type == 'Polygon' else geometry.geoms
    return [
        [list(ring.coords)[:-1] for ring in (polygon.exterior, *polygon.interiors)]
        for polygon in polygons if polygon.geom_type == 'Polygon' and polygon.area >= 0.015
    ]


def build_surfaces(data):
    width, length = data['width'], data['length']
    runway = box(0, -width / 2, length, width / 2)
    apron = rounded_junctions(unary_union([Polygon(ring) for ring in data['apronOutlines']]), 5)

    # The concrete turnout flares south of the 23 end, before the eastern taxiway.
    turnout = Polygon([(3292, 9), (3393, 9), (3403, 24), (3403, 44), (3397, 64),
                       (3374, 66), (3363, 55), (3339, 42), (3297, 37), (3292, 29)])
    taxiways, dark_pavement = [turnout], []
    for route in data['taxiways']:
        path, thickness, transition = route['path'], route['width'] / 2, route['transition']
        taxiways.append(LineString(path).buffer(thickness, cap_style='flat'))
        if transition > 0:
            dark_pavement.append(LineString(path[:transition + 1]).buffer(thickness + 1, cap_style='flat'))

    taxi = rounded_junctions(unary_union(taxiways), 11)
    movement_area = unary_union([runway, apron, taxi])
    open_taxiway = taxi.difference(runway.union(apron))
    asphalt = open_taxiway.intersection(rounded_junctions(unary_union(dark_pavement), 7))
    concrete = open_taxiway.difference(asphalt)
    verge = taxi.buffer(4.4, quad_segs=6).simplify(0.09).union(
        box(-2, -width / 2 - 8, length + 2, width / 2 + 8))
    shoulder = verge.difference(movement_area)
    turf = Polygon([
        (-7, -44), (47, -56), (1160, -57), (2410, -58), (length - 17, -55), (length + 8, -42),
        (length + 7, 259), (2760, 266), (2085, 269), (540, 269), (159, 264), (48, 227), (-7, 171),
    ]).difference(movement_area.union(shoulder))
    return {'turf': turf, 'shoulder': shoulder, 'asphalt': asphalt, 'concrete': concrete, 'apron': apron}


if __name__ == '__main__':
    surfaces = build_surfaces(layout())
    destination = ROOT / 'src/airport-pavement.json'
    destination.write_text(json.dumps({name: as_rings(geometry) for name, geometry in surfaces.items()},
                                      separators=(',', ':')) + '\n')
