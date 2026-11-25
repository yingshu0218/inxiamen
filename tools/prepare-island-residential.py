# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "shapely>=2.1,<3", "mapbox-vector-tile", "mercantile"]
# ///
"""Bake the island residential overlay and baseline/updated coverage inventory."""
import argparse
from collections import Counter, defaultdict
import json
import math
from pathlib import Path
import runpy
import statistics
import subprocess

import mapbox_vector_tile
import mercantile
import numpy as np
import shapely
from shapely.geometry import Point, Polygon, LineString, box, shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "public/geo"
TOOLS = ROOT / "tools"
TILE_SNAPSHOT = "20261122_124456_pt"
RELEASE = "2026-11-18.0"
SOURCE_BOUNDS = (118.065, 24.423, 118.200, 24.561)
OLD_TOWN = [(-6400, 1330, -4050, 3890), (-4850, 3670, -2800, 5230)]
ROAD_HALFWIDTH = [0.8, 1.8, 2.7, 3.85, 5.25, 6.8, 9]
TILE_ROADS = {"motorway": 13, "trunk": 11, "primary": 9, "secondary": 7,
              "tertiary": 6, "minor": 4, "service": 3, "path": 1.8, "track": 2.5}
PROTECTED_USE = {
    "school", "kindergarten", "university", "college", "hospital", "pitch", "track",
    "sports_centre", "stadium", "playground", "cemetery", "industrial", "commercial",
    "retail", "bus_station", "railway", "construction", "landfill",
}


def read(path):
    return json.loads(path.read_text())


def world(lon, lat):
    return (lon - 118.125) * 101220, (24.48 - lat) * 111100


def project(geometry):
    return shapely.transform(geometry, world, interleaved=False)


def polygons(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type == "Polygon":
        yield geometry
    elif geometry.geom_type in {"MultiPolygon", "GeometryCollection"}:
        for part in geometry.geoms:
            yield from polygons(part)


def union(items):
    return shapely.union_all(list(items))


def make_ring(ring):
    return [[x, z] for x, z in list(ring.coords)[:-1]]


def mapped_features(cache, land):
    areas, no_build, streets, dividers = [], [], [], []
    for tile in mercantile.tiles(*SOURCE_BOUNDS, [14]):
        path = cache / f"{tile.x}-{tile.y}.pbf"
        content = mapbox_vector_tile.decode(path.read_bytes(), default_options={"y_coord_down": True})
        bounds = mercantile.bounds(tile)
        tile_land = box(*world(bounds.west, bounds.north), *world(bounds.east, bounds.south)).intersection(land)
        if tile_land.is_empty:
            continue

        def coordinates(x, y):
            lon = (tile.x + x / 4096) / 2**14 * 360 - 180
            lat = np.rad2deg(np.arctan(np.sinh(np.pi * (1 - 2 * (tile.y + y / 4096) / 2**14))))
            return world(lon, lat)

        for layer in ("landuse", "landcover", "park", "aeroway", "water", "transportation"):
            for feature in content.get(layer, {}).get("features", []):
                props = feature["properties"]
                kind = props.get("class")
                if layer == "transportation":
                    if kind not in TILE_ROADS or props.get("brunnel") == "tunnel":
                        continue
                    geom = shapely.transform(shape(feature["geometry"]), coordinates, interleaved=False)
                    street = geom.buffer(TILE_ROADS[kind]).intersection(tile_land)
                    streets.append(street)
                    if kind not in {"service", "path", "track"} and props.get("brunnel") != "bridge":
                        dividers.append(street)
                    continue
                geom = shapely.transform(shape(feature["geometry"]), coordinates, interleaved=False)
                if geom.geom_type not in {"Polygon", "MultiPolygon"}:
                    continue
                geom = shapely.make_valid(geom).intersection(tile_land)
                if layer == "landuse" and kind == "residential":
                    areas.append(geom)
                elif layer in {"park", "aeroway", "water"} or kind in PROTECTED_USE or props.get("subclass") in {
                    "forest", "wood", "park", "recreation_ground", "wetland", "garden",
                }:
                    no_build.append(geom)
    return union(areas), union(no_build), union(streets), dividers


def load_city():
    read_city = runpy.run_path(str(TOOLS / "prepare-district-buildings.py"))["read_city"]
    return list(read_city(GEO / "city-layout.bin"))


def landscape(land, streets, dividers, excluded):
    for kind, flags, layer, *flat in read(GEO / "urban-streets.json")["roads"]:
        if len(flat) < 4:
            continue
        road = LineString(list(zip(flat[::2], flat[1::2])))
        if not land.intersects(road):
            continue
        reserved = road.buffer(ROAD_HALFWIDTH[kind + 1] + 2)
        streets.append(reserved)
        if kind >= 1 and not flags & 3 and not layer:
            dividers.append(reserved)
    for lake in read(GEO / "inland-water.json")["water"]:
        rings = [list(zip(flat[::2], flat[1::2])) for flat in lake["rings"]]
        excluded.append(Polygon(rings[0], rings[1:]).buffer(8))
    excluded.append(LineString([(-1071.9, -6080.3), (1652.9, -8214.2)]).buffer(615))
    return union(streets), union(dividers), union(excluded)


def candidate_parcels(mapped, land, divided, protected, pilots, city, city_tree):
    pilot_mask = union(pilots).buffer(0.6)
    allowed = land.buffer(-30).difference(protected.union(pilot_mask))
    mapped_blocks = mapped.intersection(allowed).difference(divided)
    inferred_blocks = allowed.difference(mapped.buffer(2)).difference(divided)
    street_edges = divided.buffer(3.4)
    accepted = []
    for mode, areas in (("mapped", mapped_blocks), ("road-supported", inferred_blocks)):
        for original in polygons(areas):
            if original.area < 1800 or (mode == "road-supported" and original.area > 275000):
                continue
            # Leave room for the simplified, half-metre boundaries at shared edges.
            for block in polygons(shapely.set_precision(original.buffer(-1.6).simplify(0.65), 0.5)):
                if block.area < 1500:
                    continue
                confirmed = city_tree.query(block, predicate="contains_properly")
                homes = [city[i] for i in confirmed if city[i].use == 1 and not city[i].base and (city[i].flags & 132) != 128]
                if mode == "road-supported":
                    if len(homes) < 6 or len(homes) * 2 < len(confirmed):
                        continue
                    if sum(r.poly.area for r in homes) < block.area * 0.09:
                        continue
                    # A naturally isolated bay, hillside or edge of the city is not a road block.
                    if block.boundary.intersection(street_edges).length < block.length * 0.58:
                        continue
                accepted.append((mode, block, homes))
    return sorted(accepted, key=lambda item: (item[0], item[1].bounds))


def axes(poly):
    rectangle = list(poly.minimum_rotated_rectangle.exterior.coords)[:4]
    dx, dz = rectangle[1][0] - rectangle[0][0], rectangle[1][1] - rectangle[0][1]
    vx, vz = rectangle[2][0] - rectangle[1][0], rectangle[2][1] - rectangle[1][1]
    u, v = math.hypot(dx, dz), math.hypot(vx, vz)
    return math.atan2(dz, dx) if u >= v else math.atan2(vz, vx), max(u, v) / max(0.01, min(u, v))


def neighboring_height(roof, homes):
    neighbors = sorted(
        (roof.distance(home.poly), home.height) for home in homes
        if 0.52 * roof.area <= home.poly.area <= 1.9 * roof.area and 8 <= home.height <= 135
    )
    if not neighbors or neighbors[0][0] > 105:
        return None
    return round(statistics.median(h for distance, h in neighbors[:5] if distance <= 105), 1)


def fits_neighbors(roof, homes):
    angle, aspect = axes(roof)
    support = 0
    for home in homes:
        distance = roof.distance(home.poly)
        if not 0.55 * roof.area <= home.poly.area <= 1.8 * roof.area or distance > 72:
            continue
        other_angle, other_aspect = axes(home.poly)
        difference = abs((angle - other_angle + math.pi / 2) % math.pi - math.pi / 2)
        row_match = aspect >= 1.45 and other_aspect >= 1.35 and difference < math.radians(13)
        compact_match = aspect < 1.45 and other_aspect < 1.65 and distance < 46
        if row_match or compact_match:
            support += 1
            if support >= 2:
                return True
    return False


def landmark_hits(records):
    check = """
      import fs from 'node:fs';
      import {landmarkReserved} from './src/scenery-landmarks.js';
      import {nanhuBuildingsReserved} from './src/downtown-landmark-layout.js';
      import {siliReserved} from './src/sili-layout.js';
      import {airportWorksReserved,airportFrame} from './src/airport-layout.js';
      import {airportIndustryBuilding} from './src/airport-industry-layout.js';
      import {runway} from './src/route.js';
      const frame=airportFrame(runway);
      const groups=JSON.parse(fs.readFileSync(0,'utf8'));
      const covered=([x,z])=>landmarkReserved(x,z)||nanhuBuildingsReserved(x,z)||
        siliReserved(x,z)||airportWorksReserved(frame,x,z)||airportIndustryBuilding(x,z);
      console.log(JSON.stringify(groups.map(points=>points.some(covered))));
    """
    result = subprocess.run(
        ["node", "--input-type=module", "-e", check], input=json.dumps(records),
        text=True, capture_output=True, check=True, cwd=ROOT,
    )
    return json.loads(result.stdout)


def suggest_roofs(features, blocks, footprints, streets, height):
    shapely.prepare(streets)
    parcel_index = STRtree([p for _, p, _ in blocks])
    confirmed = []
    counts = Counter()
    candidate_order = []
    for feature in features:
        props = feature["properties"]
        source = (props["sources"] or [{}])[0].get("dataset")
        if source == "OpenStreetMap" and props["subtype"] == "residential":
            candidate_order.append((0, feature))
        elif source == "OpenStreetMap" and not props["subtype"] and not props["class"]:
            candidate_order.append((1, feature))
        elif source == "doi:10.5281/zenodo.8174931":
            candidate_order.append((2, feature))
    for rank, feature in sorted(candidate_order, key=lambda item: (item[0], item[1]["id"])):
        geometry = project(shape(feature["geometry"]))
        if not geometry.is_valid or geometry.geom_type != "Polygon" or not 85 <= geometry.area <= 4000:
            continue
        owners = parcel_index.query(geometry, predicate="within")
        if len(owners) != 1:
            continue
        block_id = int(owners[0])
        mode, block, homes = blocks[block_id]
        props = feature["properties"]
        if rank and (mode != "mapped" or len(homes) < 3):
            continue
        roof = shapely.set_precision(geometry, 0.5)
        if roof.geom_type != "Polygon" or not block.contains_properly(roof):
            continue
        if streets.intersects(roof) or len(footprints.query(roof.buffer(1), predicate="intersects")):
            counts["roadOrExisting"] += 1
            continue
        if rank and not fits_neighbors(roof, homes):
            counts["weakRemoteEvidence"] += 1
            continue
        shell = make_ring(roof.exterior)
        samples = shell + [[roof.centroid.x, roof.centroid.y]]
        for a, b in zip(shell, shell[1:] + shell[:1]):
            steps = math.ceil(math.dist(a, b) / 8)
            samples.extend([[a[0] + (b[0] - a[0]) * t / steps, a[1] + (b[1] - a[1]) * t / steps] for t in range(1, steps)])
        ground = [height(x, z) for x, z in samples]
        if min(ground) < 2.1 or max(ground) - min(ground) > 5:
            counts["steepOrLow"] += 1
            continue
        grade = max(math.hypot(height(x + 1, z) - height(x - 1, z),
                               height(x, z + 1) - height(x, z - 1)) / 2 for x, z in samples)
        if grade > 0.18:
            counts["steepOrLow"] += 1
            continue
        mapped_height = props.get("height") or (props["num_floors"] * 3.05 if props["num_floors"] else None)
        use_height = mapped_height or neighboring_height(roof, homes)
        if rank and not use_height:
            counts["weakRemoteEvidence"] += 1
            continue
        confirmed.append((block_id, roof, samples, {
            "id": feature["id"], "source": ("osm-residential", "osm-untagged-building", "east-asian-roofprint")[rank],
            "height": round(use_height or 12.2, 1), "heightSource": "mapped" if mapped_height else "neighbor" if use_height else "typology",
            "rings": [shell, *map(make_ring, roof.interiors)],
        }))
    roofs = defaultdict(list)
    occupied = defaultdict(list)
    for (block_id, roof, samples, record), hit in zip(confirmed, landmark_hits([item[2] for item in confirmed])):
        if hit or any(roof.intersects(other) for other in occupied[block_id]):
            counts["landmarkOrCandidateOverlap"] += 1
            continue
        occupied[block_id].append(roof)
        roofs[block_id].append(record)
        counts[record["source"]] += 1
    print("candidate screening:", dict(counts), flush=True)
    return roofs, counts


def coverage(land, mapped, active, additions, city, city_tree, protected):
    active_polys = [polygon for _, polygon, _ in active]
    active_domain = union(active_polys)
    centers = STRtree([p.representative_point() for p in active_polys])
    dwelling_points = [r.poly.representative_point() for r in city if r.use == 1 and (r.flags & 132) != 128]
    existing_homes = STRtree(dwelling_points)
    new_points = STRtree([roof.representative_point() for roofs in additions for roof in roofs])
    supported, baseline_supported, baseline_gaps, remaining_gaps = [], [], [], []
    for (mode, parcel, homes), roofs in zip(active, additions):
        x, z = parcel.representative_point().coords[0]
        count = len(homes) + len(roofs)
        existing_area = sum(home.poly.area for home in homes)
        share = (existing_area + sum(roof.area for roof in roofs)) / parcel.area
        if count >= 3 and share >= 0.04:
            supported.append(parcel)
        elif mode != "road-supported" and parcel.area >= 7000:
            remaining_gaps.append({"x": round(x), "z": round(z), "areaHa": round(parcel.area / 10000, 2),
                                   "existingRoofs": len(homes), "addedRoofs": len(roofs)})
        if len(homes) >= 3 and existing_area >= 0.04 * parcel.area:
            baseline_supported.append(parcel)
        elif mode != "road-supported" and parcel.area >= 7000:
            baseline_gaps.append({"x": round(x), "z": round(z), "areaHa": round(parcel.area / 10000, 2),
                                  "existingRoofs": len(homes)})
    supported_domain = union(supported)
    baseline_domain = union(baseline_supported)
    cells = []
    for x in range(-6000, 8000, 1000):
        for z in range(-9000, 7000, 1000):
            window = box(x, z, x + 1000, z + 1000)
            ground = window.intersection(land)
            if ground.area < 100:
                continue
            known = ground.intersection(mapped)
            covered = ground.intersection(active_domain)
            deferred = known.intersection(protected)
            counted = len(existing_homes.query(ground, predicate="covers"))
            cells.append({
                "x": x, "z": z, "landHa": round(ground.area / 10000, 2),
                "mappedResidentialHa": round(known.area / 10000, 2),
                "insideResidentialLayerHa": round(covered.area / 10000, 2),
                "baselineWithRoofEvidenceHa": round(ground.intersection(baseline_domain).area / 10000, 2),
                "layerWithRoofEvidenceHa": round(ground.intersection(supported_domain).area / 10000, 2),
                "mappedOutsideLayerHa": round(known.difference(active_domain).area / 10000, 2),
                "protectedMappedHa": round(deferred.area / 10000, 2),
                "baseResidentialRoofs": counted,
                "addedRoofs": len(new_points.query(ground, predicate="covers")),
                "blocks": len(centers.query(window, predicate="contains")),
            })
    gaps = []
    for polygon in polygons(mapped.difference(active_domain.buffer(2)).intersection(land)):
        if polygon.area < 5500:
            continue
        x, z = polygon.representative_point().coords[0]
        gaps.append({"x": round(x), "z": round(z), "areaHa": round(polygon.area / 10000,2),
                     "parallelProtectionHa": round(polygon.intersection(protected).area / 10000, 2),
                     "existingFootprints": len(city_tree.query(polygon, predicate="intersects"))})
    return {
        "landHa": round(land.area / 10000, 2), "mappedResidentialHa": round(mapped.area / 10000, 2),
        "mappedResidentialInLayerHa": round(mapped.intersection(active_domain).area / 10000, 2),
        "mappedResidentialWithRoofEvidenceHa": round(mapped.intersection(supported_domain).area / 10000, 2),
        "mappedResidentialWithBaselineRoofEvidenceHa": round(mapped.intersection(baseline_domain).area / 10000, 2),
        "layerWithRoofEvidenceHa": round(supported_domain.area / 10000, 2),
        "baseResidentialRoofs": len(dwelling_points),
        "roadSupportedHa": round(union(polygon for mode, polygon, _ in active if mode == "road-supported").area / 10000, 2),
        "parallelProtectionMappedHa": round(mapped.intersection(protected).area / 10000, 2),
        "blocksBySource": dict(Counter(mode for mode, _, _ in active)),
        "baselineRoofGaps": sorted(baseline_gaps, key=lambda v: -v["areaHa"]),
        "remainingSparseBlocks": sorted(remaining_gaps, key=lambda v: -v["areaHa"]),
        "mappedGapFragments": sorted(gaps, key=lambda v: -v["areaHa"]), "grid": cells,
    }


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--tiles", type=Path, required=True)
    cli.add_argument("--overture", type=Path, required=True)
    cli.add_argument("--output", type=Path, default=GEO / "residential-blocks.json")
    cli.add_argument("--coverage", type=Path, default=ROOT / "docs/urban-review/island-residential-coverage.json")
    args = cli.parse_args()
    land = Polygon(read(GEO / "islands.json")["xiamen"])
    old_town_mask = union(box(*bounds) for bounds in OLD_TOWN)
    shapely.prepare(land)
    city = [r for r in load_city() if land.intersects(r.poly.buffer(0))]
    shapes = [r.poly.buffer(0) for r in city]
    city_tree = STRtree(shapes)
    pilots = read(TOOLS / "data/residential-pilot.json")["blocks"]
    pilot_polys = [Polygon(item["ring"]) for item in pilots]
    mapped_area, no_build, map_streets, dividers = mapped_features(args.tiles, land)
    mapped_area = mapped_area.intersection(land)
    streets, dividers, reserved = landscape(land, [map_streets], dividers, [no_build, old_town_mask.buffer(2)])
    blocks = candidate_parcels(mapped_area, land, dividers, reserved, pilot_polys, city, city_tree)
    active = [
        ("pilot", p, [city[i] for i in city_tree.query(p, predicate="intersects")
                      if (city[i].flags & 132) != 128 and city[i].use == 1])
        for p in pilot_polys
    ] + blocks
    height = runpy.run_path(str(TOOLS / "check-residential-blocks.py"))["terrain"]()
    roofs, screening = suggest_roofs(read(args.overture)["features"], blocks, city_tree, streets, height)
    generated = []
    for i, (mode, polygon, homes) in enumerate(blocks):
        x, z = polygon.representative_point().coords[0]
        group = {
            "kind": mode,
            "ring": make_ring(polygon.exterior),
            "style": ["sunlit", "warm", "cool"][(round(x / 79) + round(z / 89)) % 3],
            "roofs": roofs[i],
        }
        if polygon.interiors:
            group["holes"] = list(map(make_ring, polygon.interiors))
        # Keep uncertain street framing until mapped building evidence covers enough of the block.
        if mode == "road-supported" or len(homes) < 4 or sum(r.poly.area for r in homes) < 0.10 * polygon.area:
            group["keepFrontage"] = True
        generated.append(group)
    rows = [{"kind": "pilot", **item} for item in pilots] + generated
    additions = [[Polygon(roof["rings"][0], roof["rings"][1:]) for roof in group["roofs"]] for group in rows]
    inventory = coverage(land, mapped_area, active, additions, city, city_tree, old_town_mask)
    print("coverage:", {k:v for k,v in inventory.items() if not isinstance(v,list)}, flush=True)
    inventory["source"] = {"openFreeMap": TILE_SNAPSHOT, "overture": RELEASE, "gridMetres": 1000}
    inventory["sourceFeatures"] = len(city)
    inventory["screening"] = dict(screening)
    args.coverage.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n")
    header = {
        "license": "https://opendatacommons.org/licenses/odbl/1-0/",
        "boundarySource": f"© OpenStreetMap contributors · OpenFreeMap {TILE_SNAPSHOT}; seven pilot boundaries from OSM API 2026-11-25",
        "roofSource": f"Overture Buildings {RELEASE}; OpenStreetMap and Qian Shi et al., East Asian Buildings (CC BY 4.0)",
        "protectedOldTownBounds": OLD_TOWN,
    }
    with args.output.open("w") as out:
        out.write(json.dumps(header, ensure_ascii=False, indent=2)[:-2] + ',\n  "blocks": [\n')
        out.write(",\n".join("    " + json.dumps(group, ensure_ascii=False, separators=(",", ":")) for group in rows))
        out.write("\n  ]\n}\n")


if __name__ == "__main__":
    main()
