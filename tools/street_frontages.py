"""Fill unmapped street frontage inside mapped Xiamen urban blocks, in metres."""
from collections import defaultdict
import json
import math
import random

import numpy as np
import shapely
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.strtree import STRtree


ROAD_WIDTH = [1.6, 3.6, 5.4, 7.7, 10.5, 13.6, 18]


def street_frontages(geo, root, cache, buildings):
    rng = random.Random(860319)
    records = json.loads((root / 'urban-streets.json').read_text())['roads']
    island = Polygon(json.loads((root / 'islands.json').read_text())['xiamen']).buffer(-35)
    roofs = STRtree([b.polygon for b, _ in buildings if not b.base])
    relief = json.loads((root / 'xiamen-relief.json').read_text())
    heights = np.fromfile(root / relief['file'], '<i2').reshape(relief['height'], relief['width']) * relief['scale']
    zones, uses, excluded = [], [], []
    for tile in geo['tiles'](14, geo['BUILDING_BOUNDS']):
        transform = geo['world_converter'](tile)
        layers = geo['vector_tile'](cache, tile)
        for layer in ['landuse', 'landcover', 'park', 'aeroway']:
            for f in layers.get(layer, {}).get('features', []):
                cls = f['properties'].get('class', '')
                geometry = shape(f['geometry'])
                if geometry.geom_type not in ('Polygon', 'MultiPolygon'):
                    continue
                area = shapely.transform(geometry, transform)
                if layer == 'landuse' and cls in ('residential', 'retail', 'commercial'):
                    zones.append(area)
                    uses.append(cls)
                elif layer in ('park', 'aeroway') or cls in ('railway','cemetery','industrial','hospital','school','university','college','wood','forest','grass','garden','pitch','recreation_ground','park','stadium','sand','farmland'):
                    excluded.append(area)
    for lake in json.loads((root / 'inland-water.json').read_text())['water']:
        outer = lake['rings'][0]
        excluded.append(Polygon(list(zip(outer[::2], outer[1::2]))).buffer(16))
    excluded += [box(-3970,270,-3585,590), box(-3600,3720,-2890,5030),
                 LineString([geo['RUNWAY_05'],geo['RUNWAY_23']]).buffer(620)]
    zoning, protected = STRtree(zones), STRtree(excluded)
    roads = [(r, LineString(list(zip(r[3::2], r[4::2])))) for r in records if len(r) >= 7]
    road_space = STRtree([line.buffer(ROAD_WIDTH[r[0]+1]/2+1.8) for r, line in roads])
    placed = defaultdict(list)
    for record, road in roads:
        kind, flags, layer = record[:3]
        if kind not in (1, 2, 3, 4) or flags & 3 or layer or road.length < 30:
            continue
        along = rng.uniform(14, 29)
        while along+10 < road.length:
            p, a, b = (road.interpolate(s) for s in (along, along-6, along+6))
            along += rng.uniform(25, 38)
            dx, dz = b.x-a.x, b.y-a.y
            length = math.hypot(dx, dz)
            if length < 10:
                continue
            dx, dz = dx/length, dz/length
            for side in (-1, 1):
                normal_x, normal_z = -side*dz, side*dx
                target = Point(p.x+normal_x*18, p.y+normal_z*18)
                match = zoning.query(target, predicate='covered_by')
                if not len(match):
                    continue
                use = uses[min(match,key=lambda j: zones[j].area)]
                near = roofs.query(target, predicate='dwithin', distance=110)
                if len(near) < 2:
                    continue
                # Neighbouring households often share the same orientation and height band.
                scale = .5+.5*math.sin(target.x*.014+target.y*.010)
                if use == 'residential':
                    purpose, w, depth = 1, rng.uniform(13,28), rng.uniform(8.5,14)
                    height = round(3+scale*(8 if kind>=2 else 3)+rng.uniform(-1.2,1.2))*3.05
                elif use == 'commercial' and kind>=2 and rng.random()<.52:
                    purpose, w, depth = 5, rng.uniform(17,28), rng.uniform(13,21)
                    height = round(5+scale*10+rng.uniform(0,3))*3.75
                else:
                    purpose, w, depth = 2, rng.uniform(21,39), rng.uniform(14,23)
                    height = rng.randint(2,5)*4.1
                offset = ROAD_WIDTH[kind+1]/2 + depth/2 + rng.uniform(3.2,7.5)
                x, z = p.x+normal_x*offset, p.y+normal_z*offset
                polygon = Polygon([(x+u*dx-v*dz,z+u*dz+v*dx) for u,v in
                    [(-w/2,-depth/2),(w/2,-depth/2),(w/2,depth/2),(-w/2,depth/2)]])
                if not island.covers(polygon) or not any(zones[j].covers(polygon) for j in match):
                    continue
                if (len(protected.query(polygon, predicate='intersects')) or
                    len(road_space.query(polygon, predicate='intersects')) or
                    len(roofs.query(polygon, predicate='dwithin', distance=3.25))):
                    continue
                samples = [heights[round((vz-relief['zmin'])/25), round((vx-relief['xmin'])/25)] for vx,vz in polygon.exterior.coords]
                if min(samples)<1 or max(samples)>78 or max(samples)-min(samples)>3.5:
                    continue
                cx, cz = math.floor(x/80), math.floor(z/80)
                if any(other.distance(polygon)<3.4 for ix in range(cx-1,cx+2) for iz in range(cz-1,cz+2) for other in placed.get((ix,iz),())):
                    continue
                placed[cx,cz].append(polygon)
                yield polygon, height, purpose
