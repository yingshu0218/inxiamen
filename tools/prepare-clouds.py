"""Bake the repeating weather chart, cloud banks and fine turbulence."""

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
from scipy.spatial import cKDTree


DEST = Path(__file__).resolve().parents[1] / "public" / "art"
rng = np.random.default_rng(15182)


def normalized(field):
    low, high = np.percentile(field, [1, 99])
    return np.clip((field - low) / (high - low), 0, 1)


def value_noise(coords, cells):
    seeds = rng.uniform(0, 1, size=cells)
    pos = [coord * n for coord, n in zip(coords, cells)]
    return map_coordinates(seeds, pos, order=3, mode="grid-wrap")


def cellular(size, cells):
    grid = np.mgrid[:cells, :cells, :cells].reshape(3, -1).T
    centers = (grid + rng.uniform(.07, .93, grid.shape)) / cells
    lookup = cKDTree(centers, boxsize=1.)
    samples = np.mgrid[:size, :size, :size].reshape(3, -1).T / size
    distances = lookup.query(samples, workers=-1)[0].reshape((size,) * 3)
    return np.clip(1. - distances * cells, 0, 1)


def cumulus_banks():
    # The volume is stored in WebGL's Z, Y, X order. Y is altitude and does not tile.
    random = np.random.default_rng(7043)
    tips = np.random.default_rng(1307)
    width, levels, period = 160, 48, 7125.
    axis = (np.arange(width, dtype=np.float32) + .5) * period / width
    altitude = ((np.arange(levels, dtype=np.float32) + .5) * 1440 / levels - 140)[None, :, None]
    hull = np.full((width, levels, width), -420., dtype=np.float32)

    def lobe(x, y, z, rx, ry, rz):
        dx = (axis - x + period / 2) % period - period / 2
        dz = (axis - z + period / 2) % period - period / 2
        radius = np.sqrt((dx[None, None, :] / rx) ** 2 + ((altitude - y) / ry) ** 2
                         + (dz[:, None, None] / rz) ** 2)
        np.maximum(hull, (1 - radius) * min(rx, ry, rz), out=hull)

    for row, col in np.ndindex(4, 4):
        x, z = (np.array([col, row]) + random.uniform(.12, .88, 2)) * period / 4
        rx, rz = random.uniform(630, 1120, 2)
        lift = random.uniform(430, 990)
        lobe(x, 145, z, rx, 225, rz)
        # A bank grows around several updrafts, each with smaller caps on its flanks.
        lean = random.uniform(-.22, .22)
        for tower in range(random.integers(6, 11)):
            az = random.uniform(0, 2 * np.pi)
            radius = 0 if tower == 0 else random.uniform(.30, 1.05)
            height = lift * (1 - .36 * radius) * random.uniform(.72, 1.14)
            px = x + np.cos(az) * radius * rx + height * lean
            pz = z + np.sin(az) * radius * rz
            a, b, c = rx * random.uniform(.29, .55), height * .53, rz * random.uniform(.29, .55)
            y = height - b
            lobe(px, y, pz, a, b, c)
            for _ in range(random.integers(4, 8)):
                angle = random.uniform(0, 2 * np.pi)
                rise = random.uniform(.04, .95)
                reach = np.sqrt(1 - rise ** 2) * random.uniform(.72, .96)
                scale = random.uniform(.33, .62)
                cx, cy, cz = px + reach * a * np.cos(angle), y + rise * b, pz + reach * c * np.sin(angle)
                ca, cb, cc = a * scale, b * scale * random.uniform(.79, 1.16), c * scale
                lobe(cx, cy, cz, ca, cb, cc)
                for _ in range(3):
                    turn = tips.uniform(0, 2 * np.pi)
                    up = tips.uniform(.18, .94)
                    side = .88 * np.sqrt(1 - up ** 2)
                    lobe(cx + ca * side * np.cos(turn), cy + cb * up, cz + cc * side * np.sin(turn),
                         ca * .46, cb * .48, cc * .46)

    grid = np.indices(hull.shape, dtype=np.float32)
    coordinates = (grid + .5) / np.array(hull.shape, dtype=np.float32)[:, None, None, None]

    def displacement(cells):
        samples = random.uniform(-1, 1, cells).astype(np.float32)
        return map_coordinates(samples, coordinates * np.array(cells)[:, None, None, None],
                               order=3, mode="grid-wrap")

    warped = grid + np.stack([2.2 * displacement((12, 4, 12)) + .85 * displacement((29, 8, 29))
                              for _ in range(3)])
    warped[1] = np.clip(warped[1], 0, levels - 1)
    hull = map_coordinates(hull, warped, order=1, mode="grid-wrap")
    hull = np.minimum(hull, (altitude + 30 + 36 * displacement((11, 2, 11))) * 1.6)
    packed = np.rint(np.clip(.5 + hull / 840, 0, 1) * 255).astype("uint8")
    packed.tofile(DEST / "cloud-banks.r8")
    return packed.max(axis=1)


def main():
    size = 64
    coords = np.mgrid[:size, :size, :size] / size
    billows = .49 * cellular(size, 5) + .32 * cellular(size, 9) + .19 * cellular(size, 17)
    shape = normalized(.48 * value_noise(coords, (3, 3, 3)) + .52 * billows)
    erosion = normalized(.62 * cellular(size, 9) + .38 * cellular(size, 19))
    np.round(np.stack([shape, erosion], axis=-1) * 255).astype("uint8").tofile(DEST / "cloud-shape.rg8")

    y, x = np.mgrid[:512, :512] / 512.
    drift = value_noise([y, x], (4, 4))
    field = [y + .023 * drift, x + .043 * drift]
    cover = normalized(sum(weight * value_noise(field, (n, n)) for n, weight in
                           [(5, .39), (12, .35), (25, .19), (58, .07)]))
    height = normalized(.59 * value_noise(field, (7, 9)) + .41 * value_noise(field, (17, 21)))
    wisps = normalized(.64 * value_noise([y + x + .11 * drift, x], (33, 5))
                       + .36 * value_noise([y + x + .11 * drift, x], (67, 11)))
    # Pack the projected bank into the weather map's spare channel. This keeps
    # the sea and terrain shaders within the WebGL 2 texture-unit limit.
    columns = cumulus_banks()
    column_uv = np.stack([1 - y - .5 / 512, x + .5 / 512]) * len(columns) - .5
    column = map_coordinates(columns.astype(np.float32), column_uv, order=1, mode="grid-wrap")
    # Keep alpha above .5 to retain RGB precision in browser image decoders.
    data = np.rint(np.stack([cover * 255, height * 255, wisps * 255, 128 + column * (127 / 255)],
                            axis=-1)).astype("uint8")
    Image.fromarray(data).save(DEST / "cloud-weather.webp", lossless=True, method=5)


if __name__ == "__main__":
    main()
