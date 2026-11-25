# /// script
# requires-python = ">=3.10"
# dependencies = ["shapely>=2.1,<3"]
# ///
"""Intersect browser-exported road triangles with building volume ranges."""
import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path

from shapely import union_all
from shapely.geometry import LineString, Polygon
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
VERTICAL_TOLERANCE_M = .20
MIN_CONTACT_M2 = .25


def read(path):
    return json.loads(path.read_text())


def surface_geometry(records, walkway):
    surfaces = []
    for record in records:
        vertices = record["xyz"]
        polygon = Polygon([(x, z) for x, _, z in vertices])
        if not polygon.is_valid or polygon.area < .25:
            continue
        elevation = [v[1] for v in vertices]
        name = record["source"]
        if name.startswith(("湖滨北路 · 湖东桥", "白鹭洲公园")):
            if walkway is None:
                continue
            polygon = polygon.intersection(walkway)
            if polygon.is_empty:
                continue
        surfaces.append((polygon, vertices, elevation, record["ground"], name))
    return surfaces


def intersection_vertices(item):
    if item.geom_type == "Polygon":
        yield from item.exterior.coords
    elif hasattr(item, "geoms"):
        for part in item.geoms:
            yield from intersection_vertices(part)


def height_at(vertices, values, point):
    (x0, _, z0), (x1, _, z1), (x2, _, z2) = vertices
    x, z = point
    area2 = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2)
    a = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / area2
    b = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / area2
    return a * values[0] + b * values[1] + (1 - a - b) * values[2]


def classify(building, surface, overlap):
    _, xyz, levels, ground, _ = surface
    points = list(intersection_vertices(overlap))
    roads = [height_at(xyz, levels, p) for p in points]
    minimum, maximum = min(roads), max(roads)
    tolerance = VERTICAL_TOLERANCE_M
    if maximum < building["bottom"] - tolerance or minimum > building["top"] + tolerance:
        return "verticallySeparated"
    delta = [y - height_at(xyz, ground, p) for p, y in zip(points, roads)]
    return "elevatedConflict" if min(delta) >= 2 else "sameLevelConflict"


def audit(surfaces_file, volumes_file, baseline=False):
    exported = read(surfaces_file)["triangles"]
    volume_groups = read(volumes_file)
    hubin = read(ROOT / "src/hubin-plan.json")
    walkway = union_all([LineString(hubin["lakeside"]).buffer(3), LineString(hubin["footbridge"]).buffer(2.5)])
    report = {}
    for name, records in exported.items():
        surfaces = surface_geometry(records, walkway if name == "yundang" else None)
        tree = STRtree([s[0] for s in surfaces])
        hits, counts, new = [], Counter(), []
        for b in volume_groups[name]:
            if baseline and not b["historic"]:
                continue
            if abs(b["visibleHeight"] - b["top"]) > max(4, .09 * b["height"]):
                counts["unconfirmedRenderedFootprints"] += 1
                if b["historic"]:
                    continue
                raise ValueError(f'{b["id"]}: model did not appear at expected height')
            footprint = Polygon(b["ring"], b["holes"]).buffer(0)
            areas = defaultdict(list)
            sources = set()
            if not b["historic"]:
                new.append({"id": b["id"], "minPlanarClearanceM": round(footprint.distance(surfaces[tree.nearest(footprint)][0]), 2),
                            "visibleHeightM": round(b["visibleHeight"], 2)})
            for index in tree.query(footprint, predicate="intersects"):
                surface = surfaces[index]
                overlap = footprint.intersection(surface[0])
                if overlap.area <= 1e-7:
                    continue
                areas[classify(b, surface, overlap)].append(overlap)
                sources.add(surface[-1])
            total = {kind: round(union_all(polygons).area, 2) for kind, polygons in areas.items()}
            total = {kind: area for kind, area in total.items() if area >= MIN_CONTACT_M2}
            if total:
                scope = "historical" if b["historic"] else "added"
                counts.update(f"{scope}-{kind}" for kind in total)
                hits.append({"id": b["id"], "centroid": b["center"], "scope": scope,
                             "estimatedFrontage": b.get("frontage", False),
                             "overlapM2": total, "meshSources": sorted(sources)})
        report[name] = {"triangles": len(surfaces), "count": dict(counts), "contacts": hits, "newVolumes": new}
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("surfaces", type=Path)
    parser.add_argument("volumes", type=Path)
    parser.add_argument("--baseline", action="store_true")
    args = parser.parse_args()
    results = audit(args.surfaces, args.volumes, args.baseline)
    print(json.dumps(results, ensure_ascii=False, indent=2))
    if any(count for area in results.values() for kind, count in area["count"].items()
           if kind in {"added-sameLevelConflict", "added-elevatedConflict"}):
        raise SystemExit(1)
