"""Fuse mapped building outlines with the Xiamen CMAB release for the offline city.

Run prepare-urban-buildings.py for the CMAB extract, then pass its XMB1 file as
--buildings. OSM comes from the same cached OpenMapTiles release as prepare-geo.
"""
import argparse
from collections import Counter
from dataclasses import dataclass
import json
import math
from pathlib import Path
import runpy
import struct
import tempfile

import numpy as np
import shapely
from scipy.spatial import cKDTree
from shapely.geometry import Point, Polygon, box, shape
from shapely.strtree import STRtree


geo = runpy.run_path(str(Path(__file__).with_name("prepare-geo.py")))
ROOT = Path(__file__).resolve().parents[1] / "public" / "geo"
PUBLISHED, OSM, CMAB, LOCAL = 3, 2, 1, 0


@dataclass
class Building:
    polygon: Polygon
    height: float
    use: int
    source: int
    base: float = 0
    osm: bool = False
    frontage: bool = False


def read_records(path, merged=False):
    with path.open("rb") as stream:
        magic, count = struct.unpack("<4sI", stream.read(8))
        expected = b"XMC1" if merged else b"XMB1"
        if magic != expected:
            raise ValueError(f"Expected {expected!r}, got {magic!r}")
        for _ in range(count):
            if merged:
                h, base, use, source, count_rings = struct.unpack("<HHBBH",stream.read(8))
            else:
                h, use, source, count_rings = struct.unpack("<HBBH",stream.read(6))
                base = 0
            rings = []
            for _ in range(count_rings):
                n = struct.unpack("<H",stream.read(2))[0]
                rings.append(np.frombuffer(stream.read(n*4), dtype="<i2").reshape(n,2)*.5)
            poly = Polygon(rings[0], rings[1:])
            if not poly.is_valid:
                poly = poly.buffer(0)
            for part in geo["as_polygons"](poly):
                if not part.is_empty and part.area > 1:
                    yield Building(part,h*.1,use,source & 3,base*.1,bool(source & 16),bool(source & 128))
        if stream.read(1):
            raise ValueError("Unparsed building records")


def mapped_footprints(cache):
    candidates = []
    for tile in geo["tiles"](14,geo["BUILDING_BOUNDS"]):
        transform = geo["world_converter"](tile)
        nw,se = transform(np.array([[0,0],[4096,4096]]))
        core = box(*nw,*se)
        for feature in geo["vector_tile"](cache,tile).get("building",{}).get("features",[]):
            tags = feature["properties"]
            if tags.get("hide_3d"):
                continue
            h = float(tags.get("render_height",0))
            # OpenMapTiles synthesizes 5 m where no height/levels were supplied.
            h = 0 if h <= 0 or h == 5 else h
            base = max(0,float(tags.get("render_min_height",0)))
            geometry = shapely.transform(shape(feature["geometry"]),transform)
            for polygon in geo["as_polygons"](geometry):
                if not 18 < polygon.area < 170000 or not core.covers(polygon.representative_point()):
                    continue
                poly = polygon.simplify(.62,preserve_topology=True)
                if not poly.is_valid: poly=poly.buffer(0)
                for part in geo["as_polygons"](poly):
                    candidates.append(Building(part,h,0,OSM if h else LOCAL,min(base,max(0,h-2.5)),True))
    # Tiles can contain buffered versions of the same ring, including a clipped
    # end of a large podium. Dedupe only at the same vertical level.
    candidates.sort(key=lambda b:-b.polygon.area)
    index = STRtree([b.polygon for b in candidates])
    drop = set()
    for i,b in enumerate(candidates):
        if i in drop: continue
        for j in index.query(b.polygon):
            if j<=i or j in drop: continue
            other=candidates[j]
            if abs(b.base-other.base)>1 or abs(b.height-other.height)>1: continue
            if b.polygon.intersection(other.polygon).area > .88*other.polygon.area:
                drop.add(j)
    return [b for i,b in enumerate(candidates) if i not in drop]


def quantize(poly):
    fixed=shapely.set_precision(poly,.5)
    for p in geo["as_polygons"](fixed):
        if p.area<12: continue
        yield [np.round(np.asarray(r.coords[:-1])*2).astype("<i2") for r in [p.exterior,*p.interiors]]

def set_tower_heights(accepted):
    polygons=[Polygon(rings[0]*.5,[r*.5 for r in rings[1:]]) for _,rings in accepted]
    index=STRtree(polygons)
    assigned=set()
    for tower in json.loads((ROOT/'tower-heights.json').read_text())['towers']:
        anchor=Point((tower['lon']-118.125)*101220,(24.48-tower['lat'])*111100)
        candidates=index.query(anchor,predicate='covered_by')
        if not len(candidates):
            raise ValueError(f"Unmatched published tower: {tower['name']}")
        i=min(candidates,key=lambda k:(-accepted[k][0].base,polygons[k].area))
        b=accepted[i][0]
        if id(b) in assigned:
            raise ValueError(f"Ambiguous tower footprint: {tower['name']}")
        assigned.add(id(b))
        b.height,b.source,b.use=tower['height'],PUBLISHED,5

def clean_image_outlines(records, stats):
    # Tile seams in the image extract occasionally leave long, sub-metre spikes
    # attached to an otherwise valid roof, or detach them as separate buildings.
    for building in records:
        p = building.polygon
        radius = min(2.0, max(1.1, building.height * .065))
        core = p.buffer(-radius, join_style="mitre", mitre_limit=2)
        if core.is_empty:
            stats["thinImageFragmentsRemoved"] += 1
            continue
        cleaned = core.buffer(radius, join_style="mitre", mitre_limit=2).intersection(p)
        if p.hausdorff_distance(cleaned) < 4.5:
            yield building
            continue
        stats["spikedImageOutlinesTrimmed"] += 1
        for part in geo["as_polygons"](cleaned):
            if part.area >= 15:
                yield Building(part, building.height, building.use, building.source)


def main(cache, buildings):
    stats=Counter()
    raw=list(read_records(buildings))
    imagery=list(clean_image_outlines(raw, stats))
    if not imagery:
        raise ValueError("No source polygons")
    geo["cache_vectors_and_heights"](cache,include_heights=False)
    osm=mapped_footprints(cache)
    index=STRtree([b.polygon for b in imagery])
    used=set()
    fused=[]
    for b in osm:
        p=b.polygon
        matches=[]
        for k in index.query(p,predicate="intersects"):
            q=imagery[k].polygon
            shared=p.intersection(q).area
            if shared>3:
                matches.append((k,shared,shared/(p.area+q.area-shared)))
        matches.sort(key=lambda m:-m[2])
        # The imagery can distinguish multiple roofs inside a generalized map
        # outline. Retain those divisions unless the map describes a known 3D part.
        occupants=[k for k,a,iou in matches if a>.68*imagery[k].polygon.area and a>.035*p.area]
        if (not b.height and len(occupants)>=2 and not p.interiors and
            sum(imagery[k].polygon.area for k in occupants)>.49*p.area and
            max(imagery[k].polygon.area for k in occupants)<.69*p.area):
            stats["splitMappedOutline"]+=1
            continue
        if matches:
            k,shared,iou=matches[0]; mate=imagery[k]
            if iou>.19 or shared>.56*min(p.area,mate.polygon.area):
                b.use=mate.use
                if not b.height and mate.height:
                    b.height,b.source=mate.height,mate.source
                    stats["heightTransferred"]+=1
            for k,shared,iou in matches:
                if iou>.11 or shared>.36*min(p.area,imagery[k].polygon.area):
                    used.add(k)
        fused.append(b)
    fused.extend(b for i,b in enumerate(imagery) if i not in used)
    heights=[b for b in imagery if b.height>=2.7]
    centers=np.array([[b.polygon.centroid.x,b.polygon.centroid.y] for b in heights])
    sizes=np.array([b.polygon.area for b in heights])
    known=np.array([b.height for b in heights])
    tree=cKDTree(centers)
    terrain=np.fromfile(ROOT/"terrain.bin",dtype="<i2").reshape(geo["GRID_H"],geo["GRID_W"])
    coast=np.asarray(geo["Image"].open(ROOT/"coast-distance.png"))
    photo=np.asarray(geo["Image"].open(ROOT/"ground.webp").convert("RGB"))
    water=json.loads((ROOT/"inland-water.json").read_text())["water"]
    rings_by_lake=[[list(zip(r[::2],r[1::2])) for r in body["rings"]] for body in water]
    lake_islets=STRtree([Polygon(r) for rings in rings_by_lake for r in rings[1:]])
    lake_domain=STRtree([Polygon(rings[0]).buffer(22) for rings in rings_by_lake])
    lakes=STRtree([Polygon(rings[0],rings[1:]) for rings in rings_by_lake])
    accepted=[]
    for b in fused:
        p=b.polygon; point=p.representative_point();x,z=point.x,point.y
        if not (geo["XMIN"]<=x<geo["XMAX"] and geo["ZMIN"]<=z<geo["ZMAX"]): continue
        ix=int((x-geo["XMIN"])/(geo["XMAX"]-geo["XMIN"])*coast.shape[1])
        iz=int((z-geo["ZMIN"])/(geo["ZMAX"]-geo["ZMIN"])*coast.shape[0])
        water_here=(len(lakes.query(point,predicate='covered_by')) if len(lake_domain.query(point,predicate='covered_by'))
                    else coast[iz,ix]<127)
        if water_here and not (b.osm and b.base>0):
            stats["waterExcluded"]+=1
            continue
        # An isolated tall, tiny satellite-only roof in lake woodland can be a
        # tree crown. Check a 3×3 Sentinel neighbourhood for dark vegetation.
        if not b.osm and b.height>=12 and p.area<180 and len(lake_islets.query(point,predicate='covered_by')):
            py=round((z-geo['ZMIN'])/(geo['ZMAX']-geo['ZMIN'])*photo.shape[0]-.5)
            px=round((x-geo['XMIN'])/(geo['XMAX']-geo['XMIN'])*photo.shape[1]-.5)
            red,green,blue=np.median(photo[py-1:py+2,px-1:px+2],axis=(0,1))
            if red<100 and green>red*1.16 and green>blue+5:
                stats["unlikelyLakeCanopyRoof"]+=1
                continue
        if b.height<=0:
            dist,idx=tree.query([x,z],k=min(20,len(heights)))
            similar=(dist<340)&(sizes[idx]>p.area*.42)&(sizes[idx]<p.area*2.4)
            if similar.any():
                b.height=float(np.median(known[idx[similar]]))
            else:
                yi=round((z-geo["ZMIN"])/geo["GRID_STEP"]);xi=round((x-geo["XMIN"])/geo["GRID_STEP"])
                b.height=6 if terrain[yi,xi]>85 or p.area<55 else min(18,6+.31*math.sqrt(p.area))
            b.source=LOCAL
        for rings in quantize(p):
            accepted.append((b,rings))
    set_tower_heights(accepted)
    frontages = runpy.run_path(str(Path(__file__).with_name('street_frontages.py')))['street_frontages']
    surveyed = list(accepted)
    for polygon, height, use in frontages(geo, ROOT, cache, surveyed):
        for rings in quantize(polygon):
            accepted.append((Building(polygon, height, use, LOCAL, frontage=True), rings))
    accepted.sort(key=lambda p:(p[1][0][0,1]//1800,p[1][0][0,0]//1800))
    counts=Counter()
    with (ROOT/"city-layout.bin").open("wb") as f:
        f.write(struct.pack("<4sI",b"XMC1",len(accepted)))
        for b,rings in accepted:
            counts["frontageOutline" if b.frontage else "osmOutline" if b.osm else "imageOutline"]+=1
            counts[("localHeight","imageHeight","mappedHeight","publishedHeight")[b.source]]+=1
            counts["courtyards"]+=len(rings)-1
            pt=b.polygon.representative_point()
            py=min(photo.shape[0]-1,max(0,round((pt.y-geo["ZMIN"])/(geo["ZMAX"]-geo["ZMIN"])*photo.shape[0]-.5)))
            px=min(photo.shape[1]-1,max(0,round((pt.x-geo["XMIN"])/(geo["XMAX"]-geo["XMIN"])*photo.shape[1]-.5)))
            red,green,blue=map(int,photo[py,px])
            tone=1 if red>green*1.12 and red-blue>17 else 2 if blue>red*1.10 and blue-green>2 else 0
            flags=b.source|(16 if b.osm else 0)|(tone<<5)|(128 if b.frontage else 0)
            f.write(struct.pack("<HHBBH",round(b.height*10),round(b.base*10),b.use,flags,len(rings)))
            for ring in rings:
                f.write(struct.pack("<H",len(ring))); f.write(ring.tobytes())
    out={"file":"city-layout.bin","features":len(accepted),"sourceRecords":{"image":len(raw),"map":len(osm)},
         **dict(counts),"fusion":dict(stats),"coordinateUnitMetres":.5,"heightUnitMetres":.1,
         "heightSources":{"0":"nearby similar footprints or conservative fallback","1":"remote sensing estimate","2":"mapped height or levels","3":"published tower height, matched inside footprint"},
         "sources":["/geo/urban-buildings.json","/geo/tower-heights.json","/geo/credits.json"]}
    (ROOT/"city-layout.json").write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n")
    print(json.dumps(out,ensure_ascii=False))


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache",type=Path,default=Path(tempfile.gettempdir())/"xm-geo-cache")
    parser.add_argument("--buildings",type=Path,default=Path(tempfile.gettempdir())/"xm-urban-source/cmab-buildings.bin")
    args=parser.parse_args()
    main(args.cache,args.buildings)
