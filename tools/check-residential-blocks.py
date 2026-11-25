# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "shapely>=2.1,<3"]
# ///
"""Offline checks for the published Hongwen and Lüling residential plans."""

import itertools
import json
import math
from pathlib import Path
import runpy

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box
from shapely.strtree import STRtree


TOOLS = Path(__file__).resolve().parent
GEO = TOOLS.parent / "public/geo"


def read(name):
    return json.loads((GEO / name).read_text())


def points(flat):
    return list(zip(flat[::2], flat[1::2]))


def terrain():
    grid = read("xiamen-relief.json")
    step = grid["stepMetres"]
    values = np.fromfile(GEO / grid["file"], "<i2").reshape(
        grid["height"], grid["width"]
    ) * grid["scale"]

    def height(x, z):
        u, v = (x - grid["xmin"]) / step, (z - grid["zmin"]) / step
        i, j = int(u), int(v)
        a, b = u - i, v - j
        assert 0 <= j < grid["height"] - 1 and 0 <= i < grid["width"] - 1
        nw, ne = values[j, i : i + 2]
        sw, se = values[j + 1, i : i + 2]
        if a + b <= 1:
            return nw + a * (ne - nw) + b * (sw - nw)
        return se + (1 - a) * (sw - se) + (1 - b) * (ne - se)

    return height


def measure():
    read_city = runpy.run_path(str(TOOLS / "prepare-district-buildings.py"))["read_city"]
    existing = STRtree([r.poly.buffer(0) for r in read_city(GEO / "city-layout.bin")])
    island = Polygon(read("islands.json")["xiamen"]).buffer(0)
    coast = island.boundary
    water_areas = [list(map(points, lake["rings"])) for lake in read("inland-water.json")["water"]]
    water = STRtree([Polygon(rings[0], rings[1:]).buffer(0) for rings in water_areas])
    # Half widths of the rendered road meshes, with 2 m for their joins and verges.
    half_widths = [0.8, 1.8, 2.7, 3.85, 5.25, 6.8, 9]
    streets = [
        LineString(points(flat)).buffer(half_widths[kind + 1] + 2)
        for kind, _, _, *flat in read("urban-streets.json")["roads"]
        if len(flat) >= 4
    ]
    road_space = STRtree(streets)
    height = terrain()
    plans = read("residential-blocks.json")["blocks"]
    results, all_roofs, parcels = [], [], []
    # Explicit pilot windows in game metres. The western waterfront and the
    # Sha Pow Wei extension are outside both, including their source footprints.
    scope = [box(750, -2300, 1180, -1630), box(3550, -400, 3870, -105)]
    for plan in plans:
        parcel = Polygon(plan["ring"])
        assert parcel.is_valid and any(window.contains(parcel) for window in scope)
        parcels.append(parcel)
        for record in plan["roofs"]:
            roof = Polygon(record["rings"][0], record["rings"][1:])
            assert roof.is_valid and roof.area > 0 and parcel.contains(roof), record["id"]
            assert not len(existing.query(roof, predicate="intersects")), record["id"]
            assert not len(road_space.query(roof, predicate="intersects")), record["id"]
            assert not len(water.query(roof, predicate="intersects")), record["id"]
            assert island.contains(roof) and coast.distance(roof) > 35, record["id"]
            all_roofs.append(roof)
            x0, z0, x1, z1 = roof.bounds
            samples = list(roof.exterior.coords)
            samples.extend(
                (x, z)
                for x in range(int(x0), int(x1) + 1, 2)
                for z in range(int(z0), int(z1) + 1, 2)
                if roof.covers(Point(x, z))
            )
            ground = [height(x, z) for x, z in samples]
            grade = max(
                math.hypot(height(x + 1, z) - height(x - 1, z), height(x, z + 1) - height(x, z - 1)) / 2
                for x, z in samples
            )
            relief = float(max(ground) - min(ground))
            assert min(ground) > 2 and relief < 4 and grade < 0.16, record["id"]
            results.append({
                "id": record["id"],
                "areaM2": round(roof.area, 1),
                "roadClearanceM": round(roof.distance(streets[road_space.nearest(roof)]), 1),
                "shoreClearanceM": round(coast.distance(roof), 1),
                "groundRangeM": [round(float(min(ground)), 1), round(float(max(ground)), 1)],
                "maxGroundGradePercent": round(100 * grade, 1),
            })
    for a, b in itertools.combinations(parcels, 2):
        assert a.intersection(b).area == 0
    for a, b in itertools.combinations(all_roofs, 2):
        assert not a.intersects(b)
    # Interior garden gaps at Hongwen and the kindergarten recess at Lüling.
    courts = [Point(3699, -275).buffer(7), Point(3718, -273).buffer(5), Point(950, -1960).buffer(15)]
    assert all(not roof.intersects(court) for roof in all_roofs for court in courts)
    assert parcels[0].contains(courts[0]) and parcels[0].contains(courts[1])
    assert not parcels[1].intersects(courts[2])
    return {"parcels": len(parcels), "roofs": results}


if __name__ == "__main__":
    print(json.dumps(measure(), ensure_ascii=False, indent=2))
