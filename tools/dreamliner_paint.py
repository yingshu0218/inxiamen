"""Project B-7838's paint onto the FlightGear exterior's original panel atlas."""

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


def egret(draw, box, ink, mirror=False):
    # The beak, lifted outer wing and long, forked tail share one silhouette.
    x, y, w, h = box
    curves = [
        ((0, .46), (.13, .43), (.25, .32), (.36, .30)),
        ((.36, .30), (.40, .32), (.43, .50), (.52, .53)),
        ((.52, .53), (.67, .59), (.77, .24), (.87, .09)),
        ((.87, .09), (.91, .035), (.95, .015), (1, 0)),
        ((1, 0), (.86, .16), (.78, .52), (.61, .76)),
        ((.61, .76), (.49, .96), (.36, 1), (.04, .95)),
        ((.04, .95), (.19, .92), (.35, .91), (.365, .78)),
        ((.365, .78), (.38, .65), (.26, .49), (.13, .49)),
        ((.13, .49), (.075, .49), (.045, .48), (0, .46)),
    ]
    points = []
    for a, b, c, d in curves:
        for t in np.linspace(0, 1, 18):
            u, v = (1-t)**3*np.array(a) + 3*(1-t)**2*t*np.array(b) + 3*(1-t)*t*t*np.array(c) + t**3*np.array(d)
            points.append((x + w * (1-u if mirror else u), y+h*v))
    draw.polygon(points, fill=ink)


def lettering(text, font, size, ink):
    """Rasterize the outline once, before wrapping it around the nose."""
    face = ImageFont.truetype(str(font), 144)
    l, t, r, b = face.getbbox(text)
    tile = Image.new("RGBA", (r-l+4, b-t+4))
    ImageDraw.Draw(tile).text((2-l, 2-t), text, font=face, fill=ink)
    return tile.resize(size, Image.Resampling.LANCZOS)


PX = 90
Z0, YTOP = -32, 13


def elevation_paint(side, fonts):
    width, height = 64*PX, 19*PX
    z = np.arange(width)[None, :] / PX + Z0
    y = YTOP - np.arange(height)[:, None] / PX
    stations = [-32, -29, -24, -11, 1, 10, 15, 19, 23, 28, 32]
    edge = np.interp(z, stations, [-1.65, -.84, -.67, -.55, -.30, -.09, -.18, -.50, -.90, -1.28, -1.5])
    depth = edge-y
    image = np.full((height, width, 3), 255, np.uint8)
    for threshold, color in [(0, (68,186,216)), (.19, (5,153,202)), (.49, (6,105,174)), (.88, (12,68,137))]:
        image[depth > threshold] = color
    # The forward stripe tapers to a point at the radome. The aft ribbons run
    # out on the upswept white tail cone, as seen from either side of B-7838.
    paint = Image.fromarray(image)
    def mark(tile, zz, yy):
        if side > 0:
            tile = tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        center = ((zz-Z0)*PX, (YTOP-yy)*PX)
        paint.paste(tile, (round(center[0]-tile.width/2), round(center[1]-tile.height/2)), tile)

    navy = (22, 55, 97, 255)
    wordmark = Image.new("RGBA", (1130, 115))
    wordmark.alpha_composite(lettering("XIAMENAIR", fonts/"Arial Bold.ttf", (555,62), navy), (0,33))
    wordmark.alpha_composite(lettering("厦门航空", fonts/"Songti.ttc", (320,78), navy), (595,18))
    egret(ImageDraw.Draw(wordmark), (950,8,158,87), (0,136,195,255))
    mark(wordmark, -16.6, 1.89)
    mark(lettering("B-7838", fonts/"Arial.ttf", (223,39), navy), 16.7, 1.62)
    mark(lettering("DREAMLINER", fonts/"Arial Italic.ttf", (157,21), (50,75,96,255)), 19.8, .04)
    return np.asarray(paint)


def fin_paint():
    paint = Image.new("RGB", (12*PX, 13*PX))
    base = np.zeros((paint.height, paint.width, 3), dtype=np.uint8)
    y, x = np.mgrid[0:paint.height, 0:paint.width]
    t = np.clip(.75*x/paint.width + .25*(1-y/paint.height), 0, 1)[:, :, None]
    base[:] = np.array([5,105,180]) + t*(np.array([0,161,211])-np.array([5,105,180]))
    paint = Image.fromarray(base)
    egret(ImageDraw.Draw(paint), (2.6*PX, 5.36*PX, 5.2*PX, 2.85*PX), "white", mirror=True)
    return np.asarray(paint)


def apply_livery(parts, source, output, fonts):
    size = 4096
    base = Image.open(source).convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
    ink = np.full((size, size, 3), 255, np.uint8)
    body = {side: elevation_paint(side, fonts) for side in [-1, 1]}
    tail = fin_paint()
    for name, xyz, uv, faces in parts:
        fin = name in ("fin", "rudder")
        for tri in faces:
            vertices = xyz[tri]
            # Only the vertical fin and fuselage receive this side projection.
            coords = uv[tri] * size - .5
            lo = np.maximum(0, np.floor(coords.min(0)).astype(int))
            hi = np.minimum(size-1, np.ceil(coords.max(0)).astype(int))
            a, b, c = coords
            ab, ac = b-a, c-a
            det = ab[0]*ac[1] - ab[1]*ac[0]
            if abs(det) < 1e-5 or (lo > hi).any():
                continue
            py, px = np.mgrid[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
            s = ((px-a[0])*ac[1]-(py-a[1])*ac[0])/det
            t = ((py-a[1])*ab[0]-(px-a[0])*ab[1])/det
            keep = (s >= -.002) & (t >= -.002) & (s+t <= 1.002)
            if not keep.any():
                continue
            pt = vertices[0] + s[keep,None]*(vertices[1]-vertices[0]) + t[keep,None]*(vertices[2]-vertices[0])
            side = 1 if vertices[:,0].mean() > 0 else -1
            palette = tail if fin else body[side]
            u = (pt[:,2] - (18.4 if fin else Z0))*PX
            v = ((12.2 if fin else YTOP) - pt[:,1])*PX
            color = palette[np.clip(v.astype(int),0,len(palette)-1), np.clip(u.astype(int),0,palette.shape[1]-1)]
            ink[py[keep], px[keep]] = color
    # Bleed by one texel across UV islands to survive mipmapping at altitude.
    tinted = np.asarray(Image.fromarray(ink).filter(ImageFilter.MinFilter(3)))
    result = (np.asarray(base).astype(np.uint16)*tinted // 255).astype(np.uint8)
    Image.fromarray(result).save(output, quality=95, subsampling=0, optimize=True)
