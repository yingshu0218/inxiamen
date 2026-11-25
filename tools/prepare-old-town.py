"""Bake the old town's mapped waterfront and street frontages for offline flight.

Run after prepare-city-layout.py. The cached OSM extracts may also be supplied
with --cache; no network is needed on subsequent runs. Coordinates are metres
in the game's local east/south frame. Facade subdivisions are artistic.
"""
import argparse
import json
import math
import random
import struct
from pathlib import Path
from xml.etree import ElementTree as ET

import requests
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import linemerge, substring, unary_union

ROOT = Path(__file__).resolve().parents[1]
EXTRACTS = {'old-town': '118.068,24.447,118.0885,24.462', 'harbour': '118.0633,24.4500,118.0745,24.4675'}


def read_map(cache):
    ways = {}
    crossings = {}
    for name, bounds in EXTRACTS.items():
        path = cache / (name + '.osm')
        if not path.exists():
            response = requests.get('https://api.openstreetmap.org/api/0.6/map', params={'bbox': bounds},
                                    headers={'User-Agent': 'Xiamen sightseeing game scenery'}, timeout=45)
            response.raise_for_status()
            path.write_bytes(response.content)
        tree = ET.parse(path)
        nodes = {n.get('id'): ((float(n.get('lon'))-118.125)*101220, (24.48-float(n.get('lat')))*111100)
                 for n in tree.findall('node')}
        for n in tree.findall("node/tag[@k='highway'][@v='crossing']/.."):
            crossings[n.get('id')] = Point(nodes[n.get('id')])
        for w in tree.findall('way'):
            coords = [nodes[n.get('ref')] for n in w.findall('nd')]
            tags = {t.get('k'): t.get('v') for t in w.findall('tag')}
            ways[int(w.get('id'))] = (LineString(coords), tags)
    return ways, list(crossings.values())


def coords(line):
    return [[round(x, 1), round(z, 1)] for x, z in line.coords]


def intervals(line, blockers):
    pieces = line.difference(unary_union(blockers))
    pieces = list(pieces.geoms) if hasattr(pieces, 'geoms') else [pieces]
    return sorted(sorted((line.project(Point(s.coords[0])), line.project(Point(s.coords[-1]))))
                  for s in pieces if s.geom_type == 'LineString' and s.length > 5)


def city_cuts(mask):
    # Subtract only the occupied part of a footprint. This preserves the rear
    # wings of department stores, courtyards and buildings on cross streets.
    cuts = {}
    buf = (ROOT/'public/geo/city-layout.bin').read_bytes()
    count, = struct.unpack_from('<I', buf, 4)
    cursor = 8
    for _ in range(count):
        nr, = struct.unpack_from('<H', buf, cursor+6)
        cursor += 8
        rings = []
        for _ in range(nr):
            n, = struct.unpack_from('<H', buf, cursor)
            cursor += 2
            rings.append(list(struct.iter_unpack('<hh', buf[cursor:cursor+4*n])))
            cursor += 4*n
        ring = rings[0]
        if not (-12300 < ring[0][0] < -8500 and 2850 < ring[0][1] < 7550):
            continue
        rs = [[(x/2, z/2) for x,z in r] for r in rings]
        polygon = Polygon(rs[0], rs[1:]).buffer(0)
        if mask.disjoint(polygon) or polygon.intersection(mask).area < 1:
            continue
        rest = polygon.difference(mask)
        parts = list(rest.geoms) if hasattr(rest, 'geoms') else [rest]
        kept = []
        for part in parts:
            if part.geom_type == 'Polygon' and part.area > max(20, polygon.area*.014) and not part.buffer(-1.35).is_empty:
                kept.append([coords(r)[:-1] for r in [part.exterior, *part.interiors]])
        key = ','.join(map(str, (*ring[0], *ring[1], len(ring))))
        cuts[key] = kept
    return cuts


def make_plan(ways, crossings):
    way = lambda i: ways[i][0]
    west = way(127162454).reverse()
    street = linemerge([west, way(127162549), way(1217657899)]).simplify(.65)
    if street.coords[0][0] > street.coords[-1][0]:
        street = street.reverse()
    pedestrian = [round(west.length), round(west.length + way(127162549).length)]
    lanes = []
    for ids in [[72230911,183328702], [911418001,183328696,72239230]]:
        ln = linemerge([way(i) for i in ids])
        ln = substring(ln, ln.project(Point(-5820,2150)), ln.project(Point(-4940,3440)))
        if ln.coords[0][1] > ln.coords[-1][1]: ln = ln.reverse()
        lanes.append(ln.simplify(.7))
    crosswalks = [sorted(round(l.project(p), 1) for p in crossings if l.distance(p)<1.8) for l in lanes]
    # Preserve every mapped road that crosses the divider, including turnarounds.
    sea, inland = lanes
    middle = []
    for s in range(0, math.ceil(sea.length)+8, 8):
        p = sea.interpolate(s)
        q = inland.interpolate(inland.project(p))
        middle.append(((p.x+q.x)/2, (p.y+q.y)/2))
    divider = LineString(middle)
    breaks = []
    for ln,tags in ways.values():
        if tags.get('highway') not in {'primary','primary_link','secondary','tertiary','residential','service','unclassified'}:
            continue
        if tags.get('layer','0')!='0' or tags.get('tunnel')=='yes': continue
        hit = divider.intersection(ln)
        if hit.geom_type=='Point' and not hit.is_empty:
            breaks.append(round(sea.project(hit),1))
    coast = way(334467999).intersection(box(-6120,2195,-4700,3450)).simplify(1)
    hotel, terminal = (Polygon(way(i).coords) for i in [484696392,732161916])
    customs = Polygon(way(1035586789).coords)
    park = Polygon(way(539949217).coords)
    docks = [way(i) for i in [128680513, 128680528]]
    gangways = [way(i) for i in [128680405,128680386,128680408,128680393]]
    masks = [street.buffer(8.6,cap_style='flat'), hotel.buffer(1.2), customs.buffer(.7), terminal.buffer(4), park.buffer(-.5)]
    rng = random.Random(217)
    frontages = []
    for side in [-1,1]:
        line = street.offset_curve(12*side)
        # A side passage opens only its own frontage. The divided avenue through
        # Siming Nan Lu interrupts both sides. Preserve the hotel's corner.
        blockers = [hotel.buffer(6)]
        for ln,tags in ways.values():
            kind = tags.get('highway','')
            if not kind or tags.get('name')=='中山路' or ln.equals(way(127162454)) or ln.distance(street)>38: continue
            width = 6.5 if kind in ['primary','secondary'] else 4.8 if kind=='tertiary' else 3.25 if kind=='residential' else 2.1
            blockers.append(ln.buffer(width+1.1))
        for lo,hi in intervals(line, blockers):
            a=street.project(line.interpolate(lo)); b=street.project(line.interpolate(hi))
            a=max(a,pedestrian[0]+1.2); b=min(b,street.length-5.0)
            if b-a<9: continue
            n=max(1,round((b-a)/14.7)); ws=[rng.uniform(.69,1.47) for _ in range(n)]; unit=(b-a)/sum(ws)
            for weight in ws:
                length=weight*unit;s=a+length*.5
                p=street.interpolate(s); dx,dz=street.interpolate(min(s+.6,street.length)).coords[0]; angle=math.atan2(dz-p.y,dx-p.x)
                depth=rng.uniform(9.2,17.5); setback=rng.uniform(8.4,9.5)
                if s>pedestrian[1]: depth*=.8
                x=p.x-math.sin(angle)*side*(setback+depth*.5); z=p.y+math.cos(angle)*side*(setback+depth*.5)
                def vertex(u,v):return(x+u*math.cos(angle)-v*math.sin(angle),z+u*math.sin(angle)+v*math.cos(angle))
                rect=Polygon([vertex(u,v) for u,v in [(-length/2,-depth/2),(length/2,-depth/2),(length/2,depth/2),(-length/2,depth/2)]])
                # The back of a shop also stops at the cross-street, even at an oblique junction.
                if any(rect.intersection(st).area>max(4,rect.area*.08) for st in blockers): a+=length;continue
                frontages.append([round(s,1),side,round(length,1),round(depth,1),round(setback,1)])
                masks.append(rect.buffer(.55));a+=length
    # Only the quay and the actual roadbeds are cleared along the waterfront.
    masks.extend([coast.buffer(8.3),*[ln.buffer(5.8,cap_style='flat') for ln in lanes]])
    return dict(zhongshan=coords(street), pedestrian=pedestrian, frontages=frontages, lanes=[coords(l) for l in lanes],
                crosswalks=crosswalks, medianBreaks=sorted(set(breaks)),
                shoreline=coords(coast), hotel=coords(hotel.exterior)[:-1], customs=coords(customs.exterior)[:-1],
                terminal=coords(terminal.exterior)[:-1],
                park=coords(park.simplify(1).exterior)[:-1], pontoons=[coords(l.simplify(.4))[:-1] for l in docks],
                gangways=[coords(l.simplify(.5)) for l in gangways], cityCuts=city_cuts(unary_union(masks)))


if __name__ == '__main__':
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--cache',type=Path,default=Path('/tmp/xm-old-town-map'))
    cache=cli.parse_args().cache;cache.mkdir(parents=True,exist_ok=True)
    plan=make_plan(*read_map(cache))
    compact=lambda v: json.dumps(v,ensure_ascii=False,separators=(',',':'))
    (ROOT/'src/old-town-plan.json').write_text('{\n'+',\n'.join('  '+compact(k)+':'+compact(v) for k,v in plan.items())+'\n}\n')
    print(f"Baked {len(plan['frontages'])} shop houses and {len(plan['cityCuts'])} footprint adjustments.")
