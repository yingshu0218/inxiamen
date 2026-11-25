"""Bake what a window at three heights sees across the actual Yundang district.

The panorama contains only opaque scenery. Transparent pixels are filled by
the live sky in the game. Day and night share silhouettes and window positions.
"""
import json
import struct

import numpy as np
from PIL import Image, ImageDraw


def bake_facade_view(root, plan):
    geo = root / 'public/geo'
    grid = json.loads((geo/'xiamen-relief.json').read_text())
    dem = np.fromfile(geo/'xiamen-relief.bin', dtype='<i2').reshape(grid['height'], grid['width'])
    cx, cz = -2699., -687.
    radius, metres = 2592, 3
    xmin, zmin = cx-radius, cz-radius
    side = 2*radius//metres
    def pixel(x,z):
        return (x-xmin)/metres, (z-zmin)/metres
    xs = xmin + np.arange(side)*metres
    zs = zmin + np.arange(side)*metres
    ix = np.rint((xs-grid['xmin'])*(grid['width']-1)/(grid['xmax']-grid['xmin'])).astype(int)
    iz = np.rint((zs-grid['zmin'])*(grid['height']-1)/(grid['zmax']-grid['zmin'])).astype(int)
    base = np.maximum(0,dem[np.ix_(iz,ix)]*grid['metresPerUnit']).astype('float32')
    relief = Image.fromarray(base.copy())
    land = Image.new('L', (side,side), 1)
    roof = Image.new('L', (side,side))
    relief_pen, land_pen, roof_pen = ImageDraw.Draw(relief), ImageDraw.Draw(land), ImageDraw.Draw(roof)
    for lake in json.loads((geo/'inland-water.json').read_text())['water']:
        for i, flat in enumerate(lake['rings']):
            path = [pixel(x,z) for x,z in zip(flat[::2],flat[1::2])]
            land_pen.polygon(path,fill=1 if i else 2)
            relief_pen.polygon(path,fill=1.35 if i else lake['h'])

    def building(ring,height,tone):
        path = [pixel(x,z) for x,z in ring]
        u,v = (int(np.mean(axis)) for axis in zip(*path))
        if not (0<=u<side and 0<=v<side): return
        relief_pen.polygon(path,fill=float(base[v,u]+height))
        land_pen.polygon(path,fill=4)
        roof_pen.polygon(path,fill=tone)

    buf = (geo/'city-layout.bin').read_bytes()
    count, = struct.unpack_from('<I',buf,4)
    cursor = 8
    for _ in range(count):
        height,_,_,flags,nrings = struct.unpack_from('<HHBBH',buf,cursor)
        cursor += 8
        for j in range(nrings):
            n, = struct.unpack_from('<H',buf,cursor)
            cursor += 2
            x,z = struct.unpack_from('<hh',buf,cursor)
            if j==0 and abs(x/2-cx)<radius+80 and abs(z/2-cz)<radius+80:
                ring = [(x/2,z/2) for x,z in struct.iter_unpack('<hh',buf[cursor:cursor+4*n])]
                building(ring,height*.1,70+(flags>>5)*20+(n*13)%32)
            cursor += 4*n
    building(plan['building'],14.7,112)
    plantings = [(x,z,h) for x,z,h in plan['groves']]
    for file in [root/'public/scenery/canopies.bin', geo/'lake-canopies.bin']:
        for x,z,bits in struct.iter_unpack('<hhH',file.read_bytes()):
            if abs(x-cx)<radius and abs(z-cz)<radius and not bits&16384:
                plantings.append((x,z,(bits&255)/8))
    for x,z,h in plantings:
        u,v = pixel(x,z)
        if not (0<=u<side and 0<=v<side) or land.getpixel((int(u),int(v))) in (2,4): continue
        r = max(.55,.46*h/metres)
        bounds = (u-r,v-r,u+r,v+r)
        land_pen.ellipse(bounds,fill=3)
        relief_pen.ellipse(bounds,fill=float(base[int(v),int(u)]+h))

    heights, cover, tones = np.asarray(relief), np.asarray(land), np.asarray(roof)
    width, rows = 768, 126
    azimuth = (np.arange(width)+.5)*2*np.pi/width-np.pi
    cos, sin = np.cos(azimuth), np.sin(azimuth)
    pitch = np.tan(np.deg2rad(-86.+(np.arange(rows)+.5)*148./rows))[:,None]
    ranges = np.r_[np.arange(21.,275.,1.6),np.arange(275.,900.,3.2),np.arange(900.,radius,7.)]
    layers = []
    for eye in [14.,56.,98.]:
        day = np.zeros((rows,width,4),dtype=np.uint8)
        night = np.zeros_like(day)
        filled = np.zeros((rows,width),dtype=bool)
        for distance in ranges:
            xx,zz = cx+distance*cos, cz+distance*sin
            u,v = (np.clip(np.rint(c).astype(int),0,side-1) for c in pixel(xx,zz))
            top=heights[v,u]
            hits = (eye+distance*pitch<=top[None,:]) & ~filled
            rr,aa=np.nonzero(hits)
            if not len(rr): continue
            filled[rr,aa]=True
            world_y=eye+distance*pitch[rr,0]
            kind=cover[v[aa],u[aa]]
            hue=tones[v[aa],u[aa]].astype(float)/255.
            grain=np.sin(xx[aa]*.27+zz[aa]*.16+world_y*.13)*.5+.5
            albedo=np.tile([106.,118.,97.],(len(rr),1))
            after=np.tile([23.,30.,30.],(len(rr),1))
            water=kind==2
            albedo[water]=[97.,144.,143.]
            after[water]=[29.,40.,48.]
            tree=kind==3
            albedo[tree]=np.array([79.,110.,81.])*(.83+.24*grain[tree,None])
            after[tree]=[19.,30.,28.]
            built=kind==4
            albedo[built]=np.array([157.,157.,148.])*(.74+.42*hue[built,None])
            after[built]=[42.,47.,51.]
            wall=built & (top[aa]-world_y>1.15)
            along=xx[aa]*.92-zz[aa]*.39
            window=wall & (np.mod(along/3.8,1)>.40) & (np.mod(world_y/3.4,1)>.36)
            albedo[window]=[89.,117.,126.]
            lights=np.mod(np.sin(np.floor(along/4.)*12.37+np.floor(world_y/3.4)*79.1)*4325.,1.)
            after[window & (lights>.68)]=[180.,155.,107.]
            haze=.43*(1-np.exp(-distance/1740.))
            day[rr,aa,:3]=albedo*(1-haze)+np.array([165,180,184])*haze
            night[rr,aa,:3]=after
            day[rr,aa,3]=night[rr,aa,3]=255
        # Duplicate the top and bottom scanline so filtering never samples a neighbouring layer.
        layers.append([np.pad(img,((1,1),(0,0),(0,0)),mode='edge') for img in [day,night]])
    atlas=np.concatenate([pair[i] for i in (0,1) for pair in layers],axis=0)
    Image.fromarray(atlas[::-1]).save(root/'public/scenery/hubin-reflection.webp',lossless=True,method=6)
