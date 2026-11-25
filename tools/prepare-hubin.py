"""Bake the mapped broadcast centre and eastern Yundang Lake into local metres."""
import argparse
import json
import random
import struct
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import linemerge, unary_union, nearest_points
from hubin_reflection import bake_facade_view

ROOT = Path(__file__).resolve().parents[1]


def read_extract(cache):
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / 'hubin.osm'
    if not path.exists():
        response = requests.get('https://api.openstreetmap.org/api/0.6/map',
                                params={'bbox': '118.091,24.478,118.108,24.493'}, timeout=60,
                                headers={'User-Agent': 'Xiamen sightseeing game scenery'})
        response.raise_for_status()
        path.write_bytes(response.content)
    tree = ET.parse(path)
    nodes = {int(n.get('id')): ((float(n.get('lon'))-118.125)*101220, (24.48-float(n.get('lat')))*111100)
             for n in tree.findall('node')}
    ways = {int(w.get('id')): LineString([nodes[int(n.get('ref'))] for n in w.findall('nd')])
            for w in tree.findall('way')}
    roads = [(ways[int(w.get('id'))], w.find("tag[@k='highway']").get('v'))
             for w in tree.findall("way/tag[@k='highway']/..")]
    return nodes, ways, roads


def points(line):
    return [[round(x, 1), round(z, 1)] for x, z in line.coords]


def midline(a, b, axis, start, end):
    # A section across both carriageways gives the actual centre of the reservation.
    positions = sorted({start, end} | {p[axis] for lane in (a, b) for p in lane.coords if start < p[axis] < end})
    result = []
    for pos in positions:
        cut = LineString([(pos, -5000), (pos, 5000)] if axis == 0 else [(-5000, pos), (5000, pos)])
        left, right = a.intersection(cut), b.intersection(cut)
        if left.geom_type == right.geom_type == 'Point' and not left.is_empty and not right.is_empty:
            result.append(((left.x+right.x)/2, (left.y+right.y)/2))
    return LineString(result).simplify(.55)


def block_surfaces(plan, roads, parcels):
    # A metre-scale map of planting, courtyards and street reservations, drawn
    # from vector footprints. Keep the original island terrain at its edges.
    x0, z0, x1, z1 = bounds = (-3090, -1140, -2010, -466)
    extent = box(*bounds)
    size = (x1-x0, z1-z0)
    image = Image.new('RGB', size, '#858882')
    gardens = Image.new('L', size, 0)
    cover = Image.new('L', size, 0)
    def paint(im, geom, fill):
        draw = ImageDraw.Draw(im)
        for g in getattr(geom, 'geoms', [geom]):
            if g.geom_type != 'Polygon' or g.is_empty:
                continue
            draw.polygon([(round(x-x0),round(z-z0)) for x,z in g.exterior.coords], fill=fill)

    buf = (ROOT/'public/geo/city-layout.bin').read_bytes()
    count, = struct.unpack_from('<I', buf, 4)
    index, buildings = 8, []
    for _ in range(count):
        rings, = struct.unpack_from('<H', buf, index+6)
        index += 8
        for j in range(rings):
            n, = struct.unpack_from('<H', buf, index)
            index += 2
            if j == 0:
                x, z = struct.unpack_from('<hh', buf, index)
                if x0-120 < x/2 < x1+120 and z0-100 < z/2 < z1+100:
                    ring = struct.iter_unpack('<hh', buf[index:index+4*n])
                    poly = Polygon([(u/2,v/2) for u,v in ring]).buffer(0)
                    if poly.intersects(extent):
                        buildings.append(poly)
            index += 4*n
    for b in buildings:
        paint(cover,b.buffer(24),207)
    for p in parcels:
        paint(image,p,'#89987b')
        paint(gardens,p,150)
        paint(cover,p,235)
    # The strip between the south pavement and lake walk forms one planted verge.
    shore = LineString(plan['lakeside'])
    street = LineString(plan['avenue'])
    back, front = [], []
    for station in np.arange(24.,646.,6.):
        p = shore.interpolate(station)
        q = street.interpolate(street.project(p))
        delta = np.array([q.x-p.x,q.y-p.y])
        gap = np.linalg.norm(delta)
        if gap < 20: continue
        unit = delta/gap
        back.append(np.array(p.coords[0])+unit*2.45)
        front.append(np.array(q.coords[0])-unit*15.2)
    verge = Polygon([*back,*reversed(front)]).buffer(0)
    paint(image,verge,'#91a078')
    paint(cover,verge,251)
    service = Polygon([(-2607,-753),(-2557,-769),(-2544,-698),(-2590,-681)])
    paint(image,service,'#a4a599')
    paint(cover,service,245)
    for b in buildings:
        paint(image,b.buffer(8,join_style=2),'#74866c')
        paint(gardens,b.buffer(8,join_style=2),211)
    for b in buildings:
        paint(image,b.buffer(2.7,join_style=2),'#b1afa0')
        paint(gardens,b.buffer(4.6),0)
        paint(image,b,'#8d8e85')
    for path,kind in roads:
        if not path.intersects(extent): continue
        width = {'primary':7.,'secondary':6.4,'tertiary':5.0,'residential':3.5,'service':2.7}.get(kind,1.15)
        if path.is_ring: continue
        paint(image,path.buffer(width+2.9),'#aea99b')
        paint(image,path.buffer(width),'#686e69')
        paint(cover,path.buffer(width+3.2),246)
        paint(gardens,path.buffer(width+3.9),0)
    for ring in [plan['stadium'],plan['training'],*plan['courts'],plan['building']]:
        paint(gardens,Polygon(ring).buffer(3.5),0)
    paint(gardens,Polygon([(-2754,-711),(-2604,-751),(-2584,-674),(-2733,-630)]),0)
    rng = random.Random(1947123)
    trees = []
    occupied = unary_union(buildings)
    shop = min(buildings,key=lambda polygon: polygon.centroid.distance(Point(-2521,-706)))
    plan['telecom'] = [[round(x,1),round(z,1)] for x,z in list(shop.exterior.coords)[:-1]]
    plan['telecomLobby'] = points(shop.buffer(-1.35,join_style=2).exterior)[:-1]
    plan['telecomEave'] = points(shop.buffer(.48,quad_segs=4).exterior)[:-1]
    for iz in range(5,size[1]-5,9):
        for ix in range(5,size[0]-5,9):
            u,v=ix+rng.randrange(-4,5), iz+rng.randrange(-4,5)
            if gardens.getpixel((u,v))<100 or rng.random()>.55: continue
            x,z=x0+u,z0+v
            if occupied.distance(Point(x,z))<4.1: continue
            trees.append([x,z,round(6.2+4.6*rng.random(),1)])
    # Low-frequency variation and a soft boundary keep neighbouring city tiles continuous.
    yy,xx = np.indices((size[1],size[0]))
    edge = np.minimum.reduce([xx,yy,size[0]-1-xx,size[1]-1-yy])
    grain = np.random.default_rng(7834).normal(0,2.2,size=(size[1],size[0],1))
    rgb = np.uint8(np.clip(np.asarray(image,dtype=float)+grain,0,255))
    out=Image.fromarray(rgb)
    alpha=np.asarray(cover.filter(ImageFilter.GaussianBlur(1.25)))*np.clip(edge/38.,0,1)
    out.putalpha(Image.fromarray(np.uint8(alpha)))
    out.save(ROOT/'public/scenery/hubin-ground.webp',quality=86,method=6)
    plan['groundBounds'], plan['groves'] = bounds, trees


def build(cache):
    nodes, w, roads = read_extract(cache)
    chain = lambda *ids: linemerge([w[i] for i in ids])
    west = midline(chain(431530420, 510208844), chain(540207562, 474934989, 128826830), 0, -3105, -2331)
    east = w[129252217].intersection(box(-2400, -1100, -2025, -650))
    avenue = linemerge([west, LineString([west.coords[-1], east.coords[0]]), east])
    crossing = midline(chain(436816939, 128826968, 128827190),
                       chain(474934990, 128827207, 128826916, 435316239), 1, -896, -433)
    shore = w[370944566].intersection(box(-3105, -790, -2397, -415)).simplify(.65)
    if shore.geom_type != 'LineString':
        shore = max(shore.geoms, key=lambda line: line.length)
    stadium = 165644302
    courts = [165644289, 165644295, 238237501, 238237502, 238237505, 238237506, 238237508,
              238237510, 238237511, 238237513, 238237514, 238237516]
    circle = lambda i: points(w[i])[:-1]
    junctions = [round(avenue.project(Point(p)), 1) for p in [(-2742,-609), (-2443,-700)]]
    shell = list(w[539711834].coords)
    a, b = [min(shell,key=lambda p: Point(p).distance(Point(hint))) for hint in [(-2711.5,-684.2),(-2684.7,-669.1)]]
    axis = np.array(b)-a
    axis /= np.linalg.norm(axis)
    inward = np.array([axis[1],-axis[0]])
    # The diagonal separates the two roof pitches. The east elevation follows
    # the mapped return behind B; the street photograph shows its full depth.
    c = np.array(a)+axis*.70+inward*29.45
    side_end = min(shell,key=lambda p: Point(p).distance(Point(np.array(b)+inward*21.7)))
    d = np.array(b)+(np.array(side_end)-b)*30.1/np.linalg.norm(np.array(side_end)-b)
    tower = Polygon([a,b,d,c])
    podium = Polygon(shell).difference(tower.buffer(.075,join_style=2))
    result = dict(building=circle(539711834), towerFoot=points(tower.exterior)[:-1], studio=points(podium.exterior)[:-1], canopy=circle(539711835),
                  avenue=points(avenue.simplify(.5)), crossing=points(crossing), junctions=junctions,
                  jinqiao=points(chain(502367181,540207559).simplify(.45)),
                  bridge=[round(crossing.project(Point(p)), 1) for p in [(-2422.8,-650.2),(-2358.7,-551.4)]],
                  lakeside=points(shore), footbridge=points(w[435321216]),
                  stadium=points(w[stadium].simplify(.7))[:-1], pitch=circle(160424907), training=circle(165644304),
                  courts=[circle(i) for i in courts], metro=[[round(n,1) for n in nodes[i]] for i in [7149187460,7149187462]])
    # The three projecting arcs meet in a single folded-metal entrance canopy.
    angle = np.arctan2(15.1, 26.8)
    def entrance_disc(u, v, radius):
        x = -2711.5 + np.cos(angle)*u - np.sin(angle)*v
        z = -684.2 + np.sin(angle)*u + np.cos(angle)*v
        return Point(x, z).buffer(radius, quad_segs=12)
    eave = unary_union([entrance_disc(*arc) for arc in [(21.8,1.7,4.04),(28.35,2.7,4.96),(31.7,-3.1,4.07)]])
    result['eave'] = points(eave.exterior)[:-1]
    water = json.loads((ROOT/'public/geo/inland-water.json').read_text())['water']
    lake = next(record for record in water if record.get('name') == '筼筜湖')['rings'][0]
    bank = LineString(zip(lake[::2],lake[1::2]))
    result['bankEdge'] = []
    for station in np.arange(25.,653.,4.):
        q = nearest_points(shore.interpolate(station),bank)[1]
        result['bankEdge'].append([int(station),round(q.x,2),round(q.y,2)])
    result['busStops'] = [[round(n,1) for n in nodes[i]] for i in [4363184472,4812729671]]
    block_surfaces(result, roads, [Polygon(w[i].coords) for i in [425975409,1323822898,1323822899]])
    islet = Polygon(w[129252358].coords).simplify(.55)
    planted = islet.buffer(-1.65)
    result['islet'] = points(islet.exterior)[:-1]
    result['isletGarden'] = points(planted.simplify(.45).exterior)[:-1]
    rng = random.Random(256021)
    x0,z0,x1,z1 = (int(n) for n in islet.bounds)
    for x in range(x0,x1,6):
        for z in range(z0,z1,6):
            p = Point(x+rng.uniform(-2,2),z+rng.uniform(-2,2))
            if planted.contains(p) and p.distance(w[435321216])>4 and rng.random()<.77:
                result['groves'].append([round(p.x),round(p.y),round(rng.uniform(4.3,8.9),1)])
    bake_facade_view(ROOT,result)
    (ROOT/'src/hubin-plan.json').write_text(json.dumps(result, separators=(',', ':'))+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path('/tmp/xm-hubin-map'))
    build(parser.parse_args().cache)
