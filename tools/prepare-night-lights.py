"""Bake urban planting, ground contact, the flight chart and night lighting from the flown geometry."""
import argparse
import json
from pathlib import Path
import random
import runpy
import tempfile

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter, map_coordinates
from scipy.spatial import cKDTree
import shapely
from shapely.geometry import box, shape

GEO=Path(__file__).resolve().parents[1]/"public/geo"
SCENERY=GEO.parent/"scenery"
project=runpy.run_path(str(Path(__file__).with_name("prepare-geo.py")))
read_buildings=runpy.run_path(str(Path(__file__).with_name("prepare-city-layout.py")))["read_records"]


def pixels(bounds,size):
    return lambda ring:[((x-bounds['xmin'])*size[0]/(bounds['xmax']-bounds['xmin']),
                         (z-bounds['zmin'])*size[1]/(bounds['zmax']-bounds['zmin'])) for x,z in ring]


def paint_polygon(draw,p,raster,ink):
    boundary=raster(p.exterior.coords)
    if len(boundary)<3:
        return
    draw.polygon(boundary,fill=ink)
    for hole in p.interiors:
        ring=raster(hole.coords)
        if len(ring)>=3: draw.polygon(ring,fill=0)

def bank_canopies(fine,main,green,domain,wet,plots):
    # Place trees only where mapped riparian woodland or parkland also has a
    # vegetation signal in the optical image. Keep the previous crowns and paths clear.
    rng=np.random.default_rng(14327)
    y,x=np.nonzero((np.asarray(domain)>0)&(np.asarray(wet)==0)&(np.asarray(green)>=125)&(np.asarray(plots)<45))
    minimum_gap=9
    selected=(x%2==0)&(y%2==0)
    x=x[selected]; y=y[selected]
    wx=fine['xmin']+(x+.22+.55*rng.random(len(x)))*(fine['xmax']-fine['xmin'])/green.width
    wz=fine['zmin']+(y+.22+.55*rng.random(len(y)))*(fine['zmax']-fine['zmin'])/green.height
    photo=np.asarray(Image.open(GEO/'ground.webp').convert('RGB')).astype(float)
    py=np.clip(((wz-main['zmin'])/(main['zmax']-main['zmin'])*photo.shape[0]).astype(int),0,photo.shape[0]-1)
    px=np.clip(((wx-main['xmin'])/(main['xmax']-main['xmin'])*photo.shape[1]).astype(int),0,photo.shape[1]-1)
    red,g,b=photo[py,px].T
    woods=np.asarray(green)[y,x]>=220
    old=np.fromfile(SCENERY/'canopies.bin',dtype='<i2').reshape(-1,3)
    gap=cKDTree(old[:,:2]).query(np.column_stack((wx,wz)),k=1)[0]
    keep=(gap>minimum_gap)&(g>red*1.045)&(g>b*1.025)&(woods|(red<79))&(rng.random(len(x))<np.where(woods,.91,.40))
    wx,wz=wx[keep],wz[keep]
    crown=rng.uniform(10.,18.,len(wx))
    species=rng.integers(0,4,len(wx))
    records=np.column_stack([np.rint(wx),np.rint(wz),np.rint(crown*8)+species*256]).astype('<i2')
    records.tofile(GEO/'lake-canopies.bin')


def bake(cache):
    rng=random.Random(6715)
    main=json.loads((GEO/"manifest.json").read_text())
    fine=json.loads((GEO/"xiamen-relief.json").read_text())
    buildings=sorted(read_buildings(GEO/"city-layout.bin",merged=True),key=lambda b:-b.polygon.area)
    roads=json.loads((GEO/"urban-streets.json").read_text())["roads"]
    water=json.loads((GEO/"inland-water.json").read_text())["water"]
    city_bounds=box(fine['xmin'],fine['zmin'],fine['xmax'],fine['zmax'])
    size=(2048,round(2048*(fine['zmax']-fine['zmin'])/(fine['xmax']-fine['xmin'])))
    whole=(3072,round(3072*(main['zmax']-main['zmin'])/(main['xmax']-main['xmin'])))
    detail_px,world_px=pixels(fine,size),pixels(main,whole)
    green=Image.new("L",size)
    water_size=(size[0]*4,size[1]*4)
    water_hi=Image.new("L",water_size)
    water_px=pixels(fine,water_size)
    g=ImageDraw.Draw(green);wet=ImageDraw.Draw(water_hi)
    lake_area=Image.new('L',size); jurisdiction=ImageDraw.Draw(lake_area)
    blocks=Image.new('L',size); blocks_draw=ImageDraw.Draw(blocks)
    greens=[]
    for tile in project['tiles'](14,project['BUILDING_BOUNDS']):
        convert=project['world_converter'](tile)
        northwest,southeast=convert(np.array([[0,0],[4096,4096]]))
        clip=box(*northwest,*southeast).intersection(city_bounds)
        if clip.is_empty: continue
        layers=project['vector_tile'](cache,tile)
        for layer in ['landcover','landuse']:
            for item in layers.get(layer,{}).get('features',[]):
                props=item['properties']
                code=project['land_class'](layer,props)
                if code not in (1,2,3,5): continue
                polygon=shapely.make_valid(shapely.transform(shape(item['geometry']),convert)).intersection(clip)
                for p in project['as_polygons'](polygon):
                    if code==1: paint_polygon(blocks_draw,p,detail_px,190)
                    else: greens.append((235 if code==2 else 151 if code==3 else 104,p))
    for k,p in sorted(greens,key=lambda pair:pair[0]):paint_polygon(g,p,detail_px,k)
    for lake in water:
        exterior=lake['rings'][0]
        jurisdiction.polygon(detail_px(zip(exterior[::2],exterior[1::2])),fill=255)
        for j,ring in enumerate(lake['rings']):
            wet.polygon(water_px(zip(ring[::2],ring[1::2])),fill=(255 if lake['h']>.45 else 125) if j==0 else 0)
    # Fractional coverage preserves oblique shorelines and the narrow lake dyke
    # when the GPU interpolates between neighbouring ~7 m surface-map samples.
    wmask=water_hi.resize(size,Image.Resampling.BOX).filter(ImageFilter.GaussianBlur(.24))
    del water_hi,wet
    plots=Image.new("L",size);pd=ImageDraw.Draw(plots)
    footprint=Image.new("L",whole);foot=ImageDraw.Draw(footprint)
    lit=Image.new("L",whole);win=ImageDraw.Draw(lit)
    for b in buildings:
        p=b.polygon
        if city_bounds.intersects(p):paint_polygon(pd,p,detail_px,255)
        if b.base>3:continue
        paint_polygon(foot,p,world_px,min(180,94+round(b.height*.45)))
        if rng.random() < (.92 if b.height>23 else .63):
            paint_polygon(win,p,world_px,rng.randint(80,215))
    roads_layer=Image.new("L",whole);rd=ImageDraw.Draw(roads_layer)
    for kind,flags,layer,*coords in roads:
        points=list(zip(coords[::2],coords[1::2]))
        if len(points)<2:continue
        world=world_px(points)
        rd.line(world,fill=min(221,33+(kind+1)*26+rng.randrange(13)),width=2 if kind>=4 else 1)
        if kind>=0:pd.line(detail_px(points),fill=max(65,100+kind*20),width=2 if kind>=3 else 1)
    soft=gaussian_filter(np.asarray(footprint,dtype=float),.85)
    occlusion=np.clip(255-.52*soft-.26*gaussian_filter(soft,1.7),96,255).astype('uint8')
    Image.fromarray(occlusion).save(SCENERY/'city-occlusion.webp',quality=88,method=5)
    # Emission follows the sampled roofs and road centerlines, including the dark
    # silhouettes of mountains and the open water between illuminated blocks.
    streets=np.asarray(roads_layer,dtype=float); windows=np.asarray(lit,dtype=float)
    low=np.clip(.78*streets+.61*gaussian_filter(streets,1.2),0,255)
    medium=np.clip(.50*windows+.53*gaussian_filter(windows,.8),0,255)
    scatter=np.clip(1.1*gaussian_filter(streets,4)+1.7*gaussian_filter(windows,6),0,255)
    Image.fromarray(np.stack([low,medium,scatter],-1).astype('uint8')).save(SCENERY/'night-lights.webp',quality=89,method=5)
    # The coarse Sentinel photo has baked roof highlights and building shadows.
    # Extend the city mask onto adjacent courtyards so they can be relit in game.
    context=plots.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(4))
    lots=ImageChops.lighter(blocks,ImageChops.lighter(context,plots.filter(ImageFilter.GaussianBlur(.85))))
    lake_area=lake_area.filter(ImageFilter.MaxFilter(7))
    island_mask=Image.new('L',size)
    ImageDraw.Draw(island_mask).polygon(detail_px(json.loads((GEO/'islands.json').read_text())['xiamen']),fill=255)
    lake_area=ImageChops.darker(lake_area,island_mask)
    bank_canopies(fine,main,green,lake_area,wmask,plots)
    # Keep all RGB surface data opaque enough to survive browser image decoding.
    alpha=lake_area.point(lambda p:201 if p else 255)
    Image.merge('RGBA',(green.filter(ImageFilter.GaussianBlur(.4)),wmask,lots,alpha)).save(GEO/'urban-surface.webp',lossless=True,method=5)

    # A north-up shaded relief chart shares the world's coordinates with the route.
    chart=(1520,1280);zz,xx=np.mgrid[:chart[1],:chart[0]]
    x=main['xmin']+(xx+.5)*(main['xmax']-main['xmin'])/chart[0]
    z=main['zmin']+(zz+.5)*(main['zmax']-main['zmin'])/chart[1]
    def field(arr,grid):
        return map_coordinates(arr.astype(np.float32),[
            (z-grid['zmin'])/(grid['zmax']-grid['zmin'])*(arr.shape[0]-1),
            (x-grid['xmin'])/(grid['xmax']-grid['xmin'])*(arr.shape[1]-1)],order=1,mode="nearest")
    elevation=field(np.fromfile(GEO/'terrain.bin',dtype='<i2').reshape(main['height'],main['width']),main)
    local=np.fromfile(GEO/fine['file'],dtype='<i2').reshape(fine['height'],fine['width'])*fine['scale']
    inside=(x>=fine['xmin'])&(x<fine['xmax'])&(z>=fine['zmin'])&(z<fine['zmax'])
    elevation=np.where(inside,field(local,fine),elevation)
    wet_pixels=np.asarray(Image.open(GEO/'coast-distance.png').resize(chart,Image.Resampling.BILINEAR))<128
    lake_pixels=inside&(field(np.asarray(lake_area),fine)>128)
    wet_pixels=np.where(lake_pixels,field(np.asarray(wmask),fine)>64,wet_pixels)
    woods=np.where(inside,field(np.asarray(green),fine)/255,0)
    texture=np.asarray(roads_layer.resize(chart,Image.Resampling.LANCZOS))/255
    houses=np.asarray(footprint.resize(chart,Image.Resampling.LANCZOS))/255
    dy,dx=np.gradient(gaussian_filter(np.maximum(elevation,0),.86)/25)
    slope=np.clip(-.65*dx-.54*dy,-.38,.38)
    contours=np.exp(-((np.minimum(np.mod(elevation,40),40-np.mod(elevation,40)))/1.4)**2)*np.clip(elevation/70,0,1)
    base=np.array([92.,111.,96.])[None,None,:]+woods[:,:,None]*[-21,-13,-14]
    base+=slope[:,:,None]*71-contours[:,:,None]*10+texture[:,:,None]*[42,36,24]+houses[:,:,None]*[13,9,4]
    image=np.where(wet_pixels[:,:,None],np.array([37,61,63]),base).clip(0,255).astype('uint8')
    Image.fromarray(image).save(GEO/'relief-chart.webp',quality=88,method=5)


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache",type=Path,default=Path(tempfile.gettempdir())/"xm-geo-cache")
    bake(parser.parse_args().cache)
