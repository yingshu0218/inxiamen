"""Bake Gulangyu's surveyed garden/rock/beach cover and an offline planting layer.

Run after prepare-geo.py with the same --cache directory. The broadleaf crowns and
individual tidal boulders are scenic placements, guided by mapped features and imagery.
"""
import argparse
import json
import runpy
import tempfile
from pathlib import Path

import numpy as np
import shapely
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import distance_transform_edt, gaussian_filter, map_coordinates
from shapely.geometry import box, shape

geo = runpy.run_path(str(Path(__file__).with_name("prepare-geo.py")))
root = Path(__file__).resolve().parents[1] / "public"
output = root / "scenery"
rng = np.random.default_rng(450255)


def main(cache):
    data = json.loads((root / "geo/manifest.json").read_text())["gulangyuDetail"]
    xmin, xmax, zmin, zmax = (data[k] for k in ("xmin", "xmax", "zmin", "zmax"))
    step = 2.5
    width, height = round((xmax - xmin) / step), round((zmax - zmin) / step)
    envelope = box(xmin, zmin, xmax, zmax)
    atlas = Image.new("L", (width, height))
    draw = ImageDraw.Draw(atlas)

    def image_points(coords):
        return [((x - xmin) / step, (z - zmin) / step) for x,z in coords]

    def map_polygon(polygon, target, code):
        target.polygon(image_points(polygon.exterior.coords), fill=code)
        for hole in polygon.interiors:
            target.polygon(image_points(hole.coords), fill=0)

    def lon(x): return geo["ORIGIN_LON"] + x / geo["METRES_LON"]
    def lat(z): return geo["ORIGIN_LAT"] - z / geo["METRES_LAT"]
    features = []
    for tile in geo["tiles"](14, (lon(xmin), lat(zmax), lon(xmax), lat(zmin))):
        converted = geo["world_converter"](tile)
        layers = geo["vector_tile"](cache, tile)
        for layer in ("landcover", "landuse"):
            for feature in layers.get(layer, {}).get("features", []):
                props = feature["properties"]
                code = {"grass": 1, "wood": 2, "sand": 3, "rock": 4, "pitch": 5, "track": 5}.get(props.get("class"))
                if code is None: continue
                geom = shapely.make_valid(shapely.transform(shape(feature["geometry"]), converted))
                if not envelope.intersects(geom): continue
                for polygon in geo["as_polygons"](geom.intersection(envelope)):
                    features.append((code, polygon))
    for code, polygon in sorted(features, key=lambda feature: feature[0]):
        map_polygon(polygon,draw,code)
    cover = np.asarray(atlas)

    hard = Image.new("L",(width,height))
    hard_draw = ImageDraw.Draw(hard)
    for _h,*coords in json.loads((root/"geo/buildings.json").read_text())["items"]:
        points = np.asarray(coords).reshape(-1,2)
        cx,cz = points.mean(axis=0)
        if xmin < cx < xmax and zmin < cz < zmax:
            hard_draw.polygon(image_points(points), fill=1)
    for kind,*coords in json.loads((output/"streets.json").read_text()):
        points = np.asarray(coords).reshape(-1,2)
        if points[:,0].min() > xmax or points[:,0].max() < xmin or points[:,1].min() > zmax or points[:,1].max() < zmin:
            continue
        hard_draw.line(image_points(points),fill=1,width=1 if kind<0 else 2)
    distance = distance_transform_edt(np.asarray(hard) == 0)*step
    rr,cc = np.mgrid[:height,:width]
    x = xmin + (cc+.5)*step
    z = zmin + (rr+.5)*step

    def sample_main(image):
        v = (z-geo["ZMIN"]) / (geo["ZMAX"]-geo["ZMIN"])*image.shape[0]-.5
        u = (x-geo["XMIN"]) / (geo["XMAX"]-geo["XMIN"])*image.shape[1]-.5
        return map_coordinates(image.astype(np.float32),[v,u],order=1,mode="nearest")

    coast = (sample_main(np.asarray(Image.open(root/"geo/coast-distance.png")))-128)*2
    photo = np.asarray(Image.open(root/"geo/ground.webp").convert("RGB"))
    red,green,blue = [sample_main(photo[:,:,channel]) for channel in range(3)]
    optical = np.clip((green-.63*red-.37*blue+3)/20,0,1)
    grain = gaussian_filter(rng.random((height,width)),5)
    variation = np.clip((grain-.5)*19,-.42,.42)
    planted = np.clip(.24+.55*optical+variation+np.clip((distance-3)/35,0,.23),.08,.94)
    planted = np.where(cover==2,.96,np.where(cover==1,.85,planted))
    planted *= np.clip((distance+.65)/5.1,0,1)*np.clip((coast-2)/9,0,1)
    planted[(cover==3)|(cover==4)|(cover==5)] *= .085
    rock = gaussian_filter((cover==4).astype(float),1)
    sand = gaussian_filter((cover==3).astype(float),1)
    stamps = Image.new("L",(width,height),255)
    shade = ImageDraw.Draw(stamps)
    items = []

    def spot(px,pz):
        return min(height-1,int((pz-zmin)/step)),min(width-1,int((px-xmin)/step))

    # One jittered placement per cell keeps neighbouring crowns from coinciding.
    spacing = 9.4
    for pz0 in np.arange(zmin,zmax-spacing,spacing):
        for px0 in np.arange(xmin,xmax-spacing,spacing):
            px = px0+spacing*rng.uniform(.11,.89); pz = pz0+spacing*rng.uniform(.11,.89)
            i,j=spot(px,pz); intensity=planted[i,j]
            if coast[i,j]<4 or distance[i,j]<2.6 or rng.random()>intensity**1.35*.89: continue
            size=rng.uniform(8.3,15.8)*(1.13 if cover[i,j]==2 else .95)
            if distance[i,j]<4.1: size*=.79
            variety=int(rng.integers(0,4))
            items.append((round(px),round(pz),variety*256+round(size*8)))
            r=size*.52/step
            shade.ellipse((j-r,i-r*.82,j+r,i+r*.82),fill=int(rng.integers(116,157)))

    for pz0 in np.arange(zmin,zmax-9,9):
        for px0 in np.arange(xmin,xmax-9,9):
            px=px0+rng.uniform(1,8);pz=pz0+rng.uniform(1,8);i,j=spot(px,pz)
            if coast[i,j]<-5 or coast[i,j]>12 or sand[i,j]>.27: continue
            if rock[i,j]<.20 and not (z[i,j]>4100 and x[i,j]<-5960 and x[i,j]>-6630): continue
            if rng.random()>.70: continue
            radius=rng.uniform(1.5,5.7)
            items.append((round(px),round(pz),16384+int(rng.integers(0,4))*256+round(radius*8)))
    alpha=np.asarray(stamps.filter(ImageFilter.GaussianBlur(1.3)))
    masks=np.stack([np.uint8(np.round(255*level)) for level in (planted,sand,rock)]+[alpha],axis=-1)
    Image.fromarray(masks).save(output/"gulangyu-ground.webp",lossless=True,method=5)
    np.asarray(items,dtype="<i2").tofile(output/"gulangyu-cover.bin")
    print(f"{len(features)} cover polygons, {sum(i[2]<16384 for i in items)} crowns and {sum(i[2]>=16384 for i in items)} foreshore rocks")


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache",type=Path,default=Path(tempfile.gettempdir())/"xm-geo-cache")
    main(parser.parse_args().cache)
