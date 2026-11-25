"""Refine the island's existing terrain vertices, leaving the summit models in place."""
import runpy
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.features import rasterize
from affine import Affine
from scipy.ndimage import distance_transform_edt, gaussian_filter, map_coordinates


def smooth(low, high, value):
    t = np.clip((value - low) / (high - low), 0, 1)
    return t*t*(3 - 2*t)


def refine_island(base, x, z, shore, public):
    # Correct relative shape on wooded hills. The radar surface includes crowns
    # and roofs, so do not transplant its absolute heights into the ground mesh.
    with rasterio.open(Path(__file__).parent / 'data/gulangyu-glo30.tif') as ds:
        col, row = ~ds.transform * (118.125 + x/101220, 24.48 - z/111100)
        radar = map_coordinates(ds.read(1), [row-.5, col-.5], order=1, mode='nearest')
    residual = radar - base
    inland = smooth(25, 60, shore)
    trend = gaussian_filter(residual*inland, 11) / np.maximum(.001, gaussian_filter(inland, 11))
    shape = gaussian_filter(np.clip(residual-trend, -10, 10), 1.25)
    def hill(cx, cz, rx, rz):
        return 1-smooth(.50, 1, np.hypot((x-cx)/rx, (z-cz)/rz))
    ridge = np.maximum(hill(-6560, 3860, 385, 250), hill(-6960, 3670, 240, 265))
    ridge *= smooth(68, 110, np.hypot(x+6351, z-3928))
    change = .85*inland*ridge*shape

    # The two ends of Gangzihou are bedrock headlands. Use the mapped
    # sand channel to confine the shallow beach profile between them.
    mask = np.asarray(Image.open(public/'scenery/gulangyu-ground.webp'))
    rows = (z-z.min()) / (z.max()-z.min()) * mask.shape[0] - .5
    cols = (x-x.min()) / (x.max()-x.min()) * mask.shape[1] - .5
    sand = map_coordinates(mask[:,:,1].astype(float)/255, [rows,cols], order=1, mode='nearest')
    # Ease the upper beach into the hillside across several mesh cells.
    # A hard land-cover boundary would put a 10 m escarpment behind the sand.
    backshore = distance_transform_edt(sand < .45)*10
    beach = hill(-6440, 4220, 280, 170)*(1-smooth(0, 60, backshore))
    beach *= smooth(-2, 3, shore)*(1-smooth(32, 62, shore))
    change += beach*(np.minimum(base, .52+.095*np.maximum(0,shore))-base)

    # Stepped granite toes, inboard of the existing waterline. Leave the
    # statue plinth and the forty-four bridge and garden foundations alone.
    headland = np.maximum(hill(-6620, 4260, 66, 76), hill(-6215, 4225, 53, 66))
    fuding = hill(-5400, 4017, 99, 100)*smooth(23, 47, np.hypot(x+5386.4, z-4015))
    apron = np.maximum(headland, fuding)*(1-beach)*smooth(2, 7, shore)*(1-smooth(26, 48, shore))
    shelf = .62 + .10*shore + 2.0*smooth(10, 17, shore)
    change += apron*np.clip(shelf-base, -7, 2)

    # Preserve mapped foundations plus one full cell around each footprint.
    # The 10 m grid is node-centred, with the same origin as the renderer.
    records = runpy.run_path(str(Path(__file__).with_name('prepare-city-layout.py')))['read_records']
    buildings = records(public/'geo/city-layout.bin', merged=True)
    footprints = []
    west, east, north, south = x.min(), x.max(), z.min(), z.max()
    for building in buildings:
        left, top, right, bottom = building.polygon.bounds
        if left <= east and right >= west and top <= south and bottom >= north:
            footprints.append(building.polygon)
    occupied = rasterize(footprints, out_shape=x.shape, all_touched=True,
                         transform=Affine(10, 0, west-5, 0, 10, north-5))
    clearance = distance_transform_edt(occupied==0)*10
    return base + change*smooth(15, 42, clearance)
