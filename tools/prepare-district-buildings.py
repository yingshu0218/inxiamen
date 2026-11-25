# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "pyshp>=3.1,<4", "requests", "shapely>=2.1,<3"]
# ///
"""Refine the XMC1 written by prepare-city-layout.py. See docs/urban-review/README.md."""

import argparse
import gzip
from collections import Counter
from contextlib import ExitStack
import zipfile
from dataclasses import dataclass
import json
import math
from pathlib import Path
from statistics import median
import struct
import runpy
import xml.etree.ElementTree as ET

import shapely
from shapely.affinity import rotate, translate
from PIL import Image
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "public/geo"
REGIONS = {
    "wucun": (118.104, 24.466, 118.122, 24.484),
    "zhongshan": (118.071, 24.451, 118.088, 24.462),
    "huli": (118.090, 24.502, 118.107, 24.519),
    "jimei": (118.076, 24.567, 118.090, 24.578),
}
# XMC1 keeps its height source in bits 0..1. Bit 2 identifies Overture outlines.
OVERTURE, REVIEWED, MAP, FRONTAGE = 4, 8, 16, 128


def world(lon, lat):
    return (lon - 118.125) * 101220, (24.48 - lat) * 111100


@dataclass
class Roof:
    poly: Polygon
    height: float
    base: float
    use: int
    flags: int
    original: bytes = b""

    def pack(self):
        if self.original:
            return self.original
        rings = [self.poly.exterior, *self.poly.interiors]
        data = bytearray(
            struct.pack(
                "<HHBBH",
                round(self.height * 10),
                round(self.base * 10),
                self.use,
                self.flags,
                len(rings),
            )
        )
        for ring in rings:
            pts = ring.coords[:-1]
            data.extend(struct.pack("<H", len(pts)))
            for x, z in pts:
                data.extend(struct.pack("<hh", round(2 * x), round(2 * z)))
        return data


def read_city(path):
    data = path.read_bytes()
    magic, count = struct.unpack_from("<4sI", data)
    assert magic == b"XMC1"
    i = 8
    for _ in range(count):
        start = i
        h, base, use, flags, n = struct.unpack_from("<HHBBH", data, i)
        i += 8
        rings = []
        for _ in range(n):
            (size,) = struct.unpack_from("<H", data, i)
            i += 2
            rings.append(
                [
                    (x * 0.5, z * 0.5)
                    for x, z in struct.iter_unpack("<hh", data[i : i + 4 * size])
                ]
            )
            i += size * 4
        yield Roof(
            Polygon(rings[0], rings[1:]), h * 0.1, base * 0.1, use, flags, data[start:i]
        )
    assert i == len(data)


def plan(name):
    return json.loads((ROOT / "src" / f"{name}-plan.json").read_text())


def reservations(region, osm):
    nodes = {
        n.get("id"): world(float(n.get("lon")), float(n.get("lat")))
        for n in osm.findall("node")
    }
    compounds, protected = [], []
    for w in osm.findall("way"):
        tags = {t.get("k"): t.get("v") for t in w.findall("tag")}
        pts = [nodes[p.get("ref")] for p in w.findall("nd")]
        if len(pts) < 2:
            continue
        if pts[0] == pts[-1] and len(pts) > 3:
            p = Polygon(pts).buffer(0)
            if tags.get("landuse") in ("residential", "industrial"):
                compounds.append((p, tags["landuse"]))
            if (
                tags.get("leisure") in ("pitch", "track")
                or tags.get("natural") == "water"
            ):
                protected.append(p)
        if tags.get("tunnel") == "yes" or tags.get("covered") == "yes":
            continue
        width = {
            "trunk": 12,
            "primary": 8,
            "secondary": 6,
            "tertiary": 4,
            "residential": 3,
            "service": 2,
            "living_street": 2,
            "pedestrian": 3,
        }.get(tags.get("highway"), 0)
        if tags.get("railway") in ("rail", "light_rail"):
            width = 3
        if width:
            protected.append(LineString(pts).buffer(width))
    if region == "wucun":
        r, w = plan("railway"), plan("wucun")
        c, s = math.cos(r["angle"]), math.sin(r["angle"])

        def coords(pts):
            return [
                (r["origin"][0] + u * c - v * s, r["origin"][1] + u * s + v * c)
                for u, v in pts
            ]

        for pts in [
            *(r[k] for k in ("hall", "northApron", "northSquare", "southSquare")),
            *r["serviceBuildings"],
            *w["parking"],
            *(
                w[k]
                for k in (
                    "robinson",
                    "yuyue",
                    "eastHousing",
                    "coachHouse",
                    "transitYard",
                    "hotelBlock",
                    "school",
                )
            ),
        ]:
            protected.append(Polygon(coords(pts)).buffer(0.75))
        for line in r["tracks"]:
            protected.append(LineString(coords(line)).buffer(3.2))
        protected.append(LineString(plan("brt")["links"]["xiahe"]).buffer(6))
    elif region == "zhongshan":
        town = plan("old-town")
        protected.append(LineString(town["zhongshan"]).buffer(30))
        protected.extend(
            Polygon(town[k]) for k in ("hotel", "park", "customs", "terminal")
        )
    for lake in json.loads((GEO / "inland-water.json").read_text())["water"]:
        rings = [list(zip(v[::2], v[1::2])) for v in lake["rings"]]
        protected.append(Polygon(rings[0], rings[1:]).buffer(0.5))
    if region == "jimei":
        north = plan("north-crossings")
        for key, width in [("xiamenBridge", 12), ("gaojiRoad", 10), ("gaojiMetro", 5)]:
            protected.append(
                LineString([world(*pt) for pt in north[key]]).buffer(width)
            )
    return compounds, STRtree(protected)


def mainland_roofs(cache, area, local, mask):
    # At the bridge landing, 17 size-and-shape matched OSM roofs cluster at
    # (-22,-2) m relative to the island registration. Retain existing map geometry.
    source = runpy.run_path(str(Path(__file__).with_name("prepare-urban-buildings.py")))
    cache.mkdir(exist_ok=True, parents=True)
    records, stats = source["extract"](source["fetch_city"](cache), {"jimei": area})
    records = source["remove_duplicates"](records, stats)
    polys = [r.poly.buffer(0) for r in local]
    tree = STRtree(polys)
    inserted = []
    transferred = 0
    for poly, h, use, _ in sorted(records, key=lambda v: -v[0].area):
        p = translate(poly, -22, -2)
        if not h or not area.covers(p) or not p.is_valid:
            continue
        overlaps = [(p.intersection(polys[i]).area, i) for i in tree.query(p)]
        for a, i in overlaps:
            r = local[i]
            if r.base or r.flags & 3 or a < 0.54 * max(p.area, polys[i].area):
                continue
            r.height = h * 0.1
            r.flags |= 1
            r.use = r.use or use
            if r.original:
                r.original = (
                    struct.pack("<H", h)
                    + r.original[2:4]
                    + bytes([r.use, r.flags])
                    + r.original[6:]
                )
            transferred += 1
        if (
            p.intersects(mask)
            or any(a > 1 for a, _ in overlaps)
            or any(p.intersects(r.poly) for r in inserted)
        ):
            continue
        inserted.append(Roof(p, h * 0.1, 0, use, REVIEWED | 1))
    return inserted, transferred


def fuse(region, rows, cache, cmab_cache):
    bounds = REGIONS[region]
    area = box(*world(*bounds[:2]), *world(*bounds[2:]))
    local = [r for r in rows if area.covers(r.poly)]
    polygons = [r.poly.buffer(0) for r in local]
    tree = STRtree(polygons)
    boundary = STRtree(
        [r.poly.buffer(0) for r in rows if area.boundary.intersects(r.poly)]
    )
    compounds, protected = reservations(
        region, ET.fromstring((cache / f"{region}.osm").read_bytes())
    )
    mask = shapely.union_all(
        [protected.geometries[i] for i in protected.query(area)]
    ).buffer(0.5)
    oldtown = (
        LineString(plan("old-town")["zhongshan"]).buffer(34)
        if region == "zhongshan"
        else None
    )
    data = json.loads((cache / f"{region}-overture.json").read_text())
    removed = set()
    added = []
    occupied = []
    stats = Counter()
    # Keep authored vertical parts, mapped masses and courtyard holes. Consider
    # surveyed OSM first, followed by larger East Asian Buildings roof detections.
    candidates = []
    for feature in data["features"]:
        f = dict(feature["properties"])
        f["id"] = feature.get("id") or f["id"]
        if f.get("is_underground"):
            continue
        geom = shapely.transform(shape(feature["geometry"]), world, interleaved=False)
        for p in shapely.get_parts(geom):
            if p.geom_type != "Polygon" or not p.is_valid or not area.covers(p):
                continue
            p = shapely.set_precision(p, 0.5)
            if p.geom_type == "Polygon" and p.area >= 28:
                candidates.append((f["sources"][0]["dataset"] == "OpenStreetMap", p, f))
    for mapped, p, f in sorted(
        candidates, key=lambda a: (-a[0], -a[1].area, a[2]["id"])
    ):
        if p.intersects(mask) or len(boundary.query(p, predicate="intersects")):
            continue
        # Guard against source objects straddling the batch limit.
        if not area.buffer(-25).covers(p):
            continue
        if any(p.intersection(q).area > 2 for q in occupied if p.intersects(q)):
            continue
        matches = []
        for i in tree.query(p, predicate="intersects"):
            q = polygons[i]
            shared = q.intersection(p).area
            if shared > 1:
                matches.append((i, shared))
        # Retain detailed existing rings over a conflicting generalized rectangle.
        # A source roof can replace multiple fragments, or split one fused mass.
        if any(
            local[i].flags & MAP
            or local[i].base
            or polygons[i].geom_type != "Polygon"
            or polygons[i].interiors
            or local[i].flags & 3 >= 2
            for i, _ in matches
        ):
            continue
        if any(a / min(p.area, polygons[i].area) < 0.22 and a > 4 for i, a in matches):
            continue
        if any(
            a / polygons[i].area < 0.40 and a / p.area < 0.62 and a > 4
            for i, a in matches
        ):
            continue
        # If only a small portion of a larger existing roof is supported,
        # defer replacement until the full cluster of source polygons is known.
        occupied.append(p)
        added.append((p, f, mapped, matches))
    support = Counter()
    for _, _, _, matches in added:
        for i, a in matches:
            support[i] += a
    # Reject an entire linked group if adopting it would erase a poorly matched roof.
    while True:
        kept = [
            a
            for a in added
            if all(
                local[i].flags & FRONTAGE or support[i] >= 0.43 * polygons[i].area
                for i, v in a[3]
                if v > 2
            )
        ]
        if len(kept) == len(added):
            break
        added = kept
        support = Counter()
        for *_, matches in kept:
            for i, a in matches:
                support[i] += a
    result = []
    for p, f, mapped, matches in added:
        good = [
            (a, local[i])
            for i, a in matches
            if not local[i].flags & FRONTAGE and a > max(4, p.area * 0.14)
        ]
        use = {"industrial": 4, "commercial": 2, "residential": 1, "education": 3}.get(
            f.get("subtype"), 0
        )
        group = min(
            (
                (site, kind)
                for site, kind in compounds
                if site.covers(p.representative_point())
            ),
            key=lambda v: v[0].area,
            default=None,
        )
        if not use and group:
            use = 1 if group[1] == "residential" else 4
        roof = max(good, key=lambda v: v[0])[1] if good else None
        flags = OVERTURE | (MAP if mapped else 0)
        if roof:
            flags |= roof.flags & 96
        h = f.get("height") or (f.get("num_floors") or 0) * 3.1
        if h:
            flags |= 2
        elif roof and roof.flags & 3:
            h = roof.height
            flags |= roof.flags & 3
        else:
            nearby = []
            for i in tree.query(p, predicate="dwithin", distance=190):
                r = local[i]
                if not r.flags & 3 or r.base or not 0.45 < r.poly.area / p.area < 2.2:
                    continue
                if use and r.use and use != r.use:
                    continue
                if group and not group[0].covers(r.poly.representative_point()):
                    continue
                nearby.append((p.distance(r.poly), r.height))
            h = (
                median([v for _, v in sorted(nearby)[:7]])
                if nearby
                else (12 if use == 4 else 18 if use == 1 else 9)
            )
        result.append(Roof(p, h, 0, use or (roof.use if roof else 0), flags))
        removed.update(i for i, a in matches if a > 2)
        stats["matched" if good else "newOrFrontage"] += 1
    for i, r in enumerate(local):
        if i in removed:
            continue
        if oldtown is not None and oldtown.intersects(r.poly):
            continue  # keyed arcade cuts
        if r.flags & FRONTAGE:
            removed.add(i)
            stats["uncorroboratedFrontage"] += 1
        elif not r.flags & MAP and not r.base and polygons[i].intersects(mask):
            pieces = shapely.set_precision(polygons[i].difference(mask), 0.5)
            removed.add(i)
            for p in shapely.get_parts(pieces):
                if p.geom_type == "Polygon" and p.area > max(
                    24, 0.20 * polygons[i].area
                ):
                    result.append(Roof(p, r.height, r.base, r.use, r.flags))
            stats["reservedSpaceCuts"] += 1
    for i, r in enumerate(local):
        if i in removed or r.flags & 3 or r.base or r.flags & FRONTAGE:
            continue
        site = min(
            (g for g, _ in compounds if g.covers(r.poly.representative_point())),
            key=lambda g: g.area,
            default=None,
        )
        if site is None:
            continue
        peers = [
            local[j].height
            for j in tree.query(site)
            if local[j].flags & 3
            and not local[j].base
            and (not r.use or not local[j].use or r.use == local[j].use)
            and 0.5 < polygons[j].area / r.poly.area < 2
            and site.covers(polygons[j].representative_point())
        ]
        if peers:
            r.height = median(peers)
            r.original = struct.pack("<H", round(r.height * 10)) + r.original[2:]
            stats["regroupedExistingHeight"] += 1
    for r in local + result:
        r.flags |= REVIEWED
        if r.original:
            r.original = r.original[:5] + bytes([r.flags]) + r.original[6:]
    if region == "jimei":
        mainland, count = mainland_roofs(
            cmab_cache,
            area,
            [r for i, r in enumerate(local) if i not in removed] + result,
            mask,
        )
        # The mainland shore shares the base world's coast-distance raster.
        coast = Image.open(GEO / "coast-distance.png")
        bounds = json.loads((GEO / "manifest.json").read_text())

        def on_land(r):
            point = r.poly.representative_point()
            col = int(
                (point.x - bounds["xmin"])
                / (bounds["xmax"] - bounds["xmin"])
                * coast.width
            )
            row = int(
                (point.y - bounds["zmin"])
                / (bounds["zmax"] - bounds["zmin"])
                * coast.height
            )
            return coast.getpixel((col, row)) >= 127

        mainland = [r for r in mainland if on_land(r)]
        result.extend(mainland)
        stats.update(
            {"mainlandImageAdditions": len(mainland), "mainlandHeightTransfers": count}
        )
    for r in result:
        if r.flags & OVERTURE:
            stats[
                ("estimatedHeight", "imageHeight", "mapHeight", "publishedHeight")[
                    r.flags & 3
                ]
            ] += 1
    ids = {id(local[i]) for i in removed}
    stats.update(
        {
            "input": len(local),
            "overture": len(added),
            "removed": len(ids),
            "output": len(local) - len(ids) + len(result),
        }
    )
    return [r for r in rows if id(r) not in ids] + result, dict(stats)


# Combining the two legacy outline bits identifies a shape interpreted from
# multiple sources. Its height bits remain independent of its outline.
INTERPRETED = OVERTURE | FRONTAGE


def repair_lvquan(rows):
    # Only these three georeferenced fragments share a continuous eave in the
    # south row. The separate eastern building has its own end wall and access.
    centers = [(-1539.5, 486), (-1522.8, 481.2), (-1511.2, 481.4)]
    parts = []
    for x, z in centers:
        found = [
            r
            for r in rows
            if r.poly.bounds[0] <= x <= r.poly.bounds[2]
            and r.poly.centroid.distance(Point(x, z)) < 1
        ]
        if len(found) != 1:
            raise ValueError("The reviewed Lvquan fragments have changed")
        parts.extend(found)
    # The two western fragments and the visible eave agree on a 16° north
    # of east long axis. Keep the shallow return at the eastern end.
    pivot = (-1525, 482)
    west, middle, east = [rotate(part.poly, 16, origin=pivot).bounds for part in parts]
    left, right = west[0], east[2]
    back = median([west[1], middle[1], east[1]])
    front = median([west[3], middle[3], east[3]])
    ring = Polygon(
        [
            (left, back),
            (right, back),
            (right, front + 2),
            (east[0], front + 2),
            (east[0], front),
            (left, front),
        ]
    )
    roof = shapely.set_precision(rotate(ring, -16, origin=pivot), 0.5)
    building = Roof(roof, median(r.height for r in parts), 0, 1, REVIEWED | INTERPRETED)
    replaced = {id(p) for p in parts}
    return [r for r in rows if id(r) not in replaced] + [building]


def add_lehai(rows, cache):
    package = json.loads(
        gzip.decompress((ROOT / "tools/data/lehai-plots.json.gz").read_bytes())
    )

    def polygon(rings):
        return Polygon(rings[0], rings[1:])

    plots = {k: polygon(rings) for k, rings in package["plots"].items()}
    domain = shapely.union_all(list(plots.values()))
    open_ground = [polygon(rings) for rings in package["openSpace"]]
    north = plan("north-crossings")
    for line in [north["jimei"], north["jimeiApproach"], *north["jimeiRamps"]]:
        open_ground.append(LineString([world(*pt) for pt in line]).buffer(13))
    mask = shapely.union_all(open_ground).buffer(0.6)
    cmab = runpy.run_path(str(Path(__file__).with_name("prepare-urban-buildings.py")))
    cache.mkdir(parents=True, exist_ok=True)
    raw, stats = cmab["extract"](
        cmab["fetch_city"](cache), {"lehai": domain.buffer(25)}
    )
    # Mode of nearby similar outlines: 47 independent centre-pair votes in
    # a 6 m neighbourhood, relative to the original island registration.
    roofs = [
        (translate(p, -12, 0.5), h / 10)
        for p, h, _, _ in cmab["remove_duplicates"](raw, stats)
    ]
    source = STRtree([p for p, h in roofs])
    occupied = [r.poly.buffer(0) for r in rows if domain.intersects(r.poly)]
    base_count = len(occupied)
    candidates = []
    for feature in package["overture"]:
        p = polygon(feature["rings"])
        candidates.append(
            (p, feature["height"] or (feature["floors"] or 0) * 3.1, OVERTURE)
        )
    # Keep the rectangular source roof rows ahead of image-mask fragments.
    candidates.sort(key=lambda v: -v[0].area)
    candidates.extend((p, h, 0) for p, h in sorted(roofs, key=lambda v: -v[0].area))
    added = []
    for p, h, flag in candidates:
        p = shapely.set_precision(p, 0.5)
        if p.geom_type != "Polygon" or p.area < 85 or p.intersects(mask):
            continue
        lot = next((k for k, v in plots.items() if v.covers(p)), None)
        if not lot or any(
            p.intersects(q) and p.intersection(q).area > 0.5 for q in occupied
        ):
            continue
        source_code = (2 if flag else 1) if h else 0
        if not h:
            matches = []
            for j in source.query(p, predicate="intersects"):
                q, known = roofs[j]
                overlap = p.intersection(q).area
                if known and overlap > 0.48 * p.area and overlap > 0.32 * q.area:
                    matches.append((overlap, known))
            if matches:
                h = max(matches)[1]
                source_code = 1
        occupied.append(p)
        added.append((lot, Roof(p, h, 0, 1, flag | REVIEWED | source_code)))
    for lot, r in added:
        if r.height:
            continue
        peers = [
            (q.poly.distance(r.poly), q.height)
            for site, q in added
            if site == lot and q.flags & 3 and 0.5 < q.poly.area / r.poly.area < 2
        ]
        if peers:
            r.height = median(h for _, h in sorted(peers)[:7])
        elif r.poly.area < 210:
            r.height = 9
        elif lot in ("1568015907", "1568015908", "675481353", "675481356"):
            r.height = 48
        else:
            r.height = 18
    records = [r for _, r in added]
    return rows + records, dict(
        plots=len(plots),
        plotAreaM2=round(domain.area),
        existingIntersecting=base_count,
        added=len(records),
        overtureOutline=sum(bool(r.flags & OVERTURE) for r in records),
        imageOutline=sum(not r.flags & OVERTURE for r in records),
        modeledHeight=sum((r.flags & 3) == 1 for r in records),
        mappedHeight=sum((r.flags & 3) == 2 for r in records),
        estimatedHeight=sum(not r.flags & 3 for r in records),
    )


def add_xiangan_estate(rows):
    # D07 ground positions and dimensions are approximate. Four paired-wing
    # towers and four longer slabs recur in the image, with open space between.
    towers = [
        (7794, -10254, 35, 13.5, -20),
        (7778, -10204, 35, 13.5, -20),
        (7760, -10156, 35, 13.5, -20),
        (7746, -10108, 35, 13.5, -20),
        (7856, -10220, 46, 11.5, 12),
        (7902, -10164, 54, 11.5, 12),
        (7844, -10118, 53, 11.5, 12),
        (7810, -10070, 44, 11.5, 12),
    ]
    existing = STRtree(
        [
            r.poly.buffer(0)
            for r in rows
            if 7600 < r.poly.bounds[0] < 8000 and -10400 < r.poly.bounds[1] < -9900
        ]
    )
    added = []
    for i, (x, z, w, d, angle) in enumerate(towers):
        # Relative rather than measured per-address levels. Use one band for
        # this estate; preserve the different wing depths and end returns.
        h = [99, 96, 96, 93, 99, 96, 93, 90][i]
        if i < 4:
            outline = [
                (-0.5, -0.34),
                (-0.12, -0.25),
                (-0.08, -0.49),
                (0.09, -0.49),
                (0.14, -0.25),
                (0.5, -0.34),
                (0.5, 0.30),
                (0.19, 0.48),
                (0.11, 0.27),
                (-0.11, 0.27),
                (-0.19, 0.48),
                (-0.5, 0.30),
            ]
        else:
            outline = [
                (-0.50, -0.42),
                (-0.12, -0.42),
                (-0.12, -0.50),
                (0.10, -0.50),
                (0.10, -0.42),
                (0.5, -0.42),
                (0.5, 0.42),
                (0.27, 0.42),
                (0.27, 0.50),
                (0.12, 0.50),
                (0.12, 0.38),
                (-0.10, 0.38),
                (-0.10, 0.5),
                (-0.25, 0.5),
                (-0.25, 0.42),
                (-0.5, 0.42),
            ]
        a = math.radians(angle)
        p = Polygon(
            [
                (
                    x + w * u * math.cos(a) - d * v * math.sin(a),
                    z + w * u * math.sin(a) + d * v * math.cos(a),
                )
                for u, v in outline
            ]
        )
        p = shapely.set_precision(p, 0.5)
        if len(existing.query(p, predicate="intersects")) or any(
            p.intersects(r.poly) for r in added
        ):
            raise ValueError(
                "D07 has acquired overlapping source geometry; review before rebuilding"
            )
        added.append(Roof(p, h, 0, 1, REVIEWED | INTERPRETED))
    return rows + added


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "cache",
        nargs="?",
        type=Path,
        help="Optional directory overriding the bundled source snapshot",
    )
    parser.add_argument("--regions", nargs="+", choices=REGIONS, default=list(REGIONS))
    parser.add_argument("--input", type=Path, default=GEO / "city-layout.bin")
    parser.add_argument("--manifest", type=Path, default=GEO / "city-layout.json")
    parser.add_argument("--cmab-cache", type=Path, default=Path("/tmp/xm-urban-source"))
    parser.add_argument(
        "--bridge-districts-only",
        action="store_true",
        help="Extend the completed first four districts",
    )
    args = parser.parse_args()
    rows = list(read_city(args.input))
    meta = json.loads(args.manifest.read_text())
    if args.bridge_districts_only and (
        set(meta.get("districtBatches", {})) != set(REGIONS)
        or meta.get("bridgeDistricts")
    ):
        raise ValueError("Expected a completed, unextended first batch")
    if meta.get("districtBatches") and not args.bridge_districts_only:
        raise ValueError(
            "Use the original prepare-city-layout output for a fresh merge."
        )
    stats = meta.get("districtBatches", {})
    with ExitStack() as stack:
        source = args.cache
        if source is None:
            archive = stack.enter_context(
                zipfile.ZipFile(ROOT / "tools/data/district-sources.zip")
            )
            source = zipfile.Path(archive)
        for region in [] if args.bridge_districts_only else args.regions:
            rows, stats[region] = fuse(region, rows, source, args.cmab_cache)
            print(region, stats[region], flush=True)
    if set(stats) == set(REGIONS):
        rows = repair_lvquan(rows)
        rows, lehai = add_lehai(rows, args.cmab_cache)
        rows = add_xiangan_estate(rows)
        from bridge_court_ground import bake_bridge_courts

        bake_bridge_courts(ROOT, rows)
        meta["bridgeDistricts"] = {
            "lvquan": {"sourceParts": 3, "continuousRoofs": 1, "estimatedHeight": 1},
            "lehai": lehai,
            "xianganD07": {"interpretedOutline": 8, "estimatedHeight": 8},
        }
    payload = b"".join(r.pack() for r in rows)
    (GEO / "city-layout.bin").write_bytes(
        struct.pack("<4sI", b"XMC1", len(rows)) + payload
    )
    counts = Counter()
    for r in rows:
        counts[
            "interpretedOutline"
            if r.flags & INTERPRETED == INTERPRETED
            else "overtureOutline"
            if r.flags & OVERTURE
            else "frontageOutline"
            if r.flags & FRONTAGE
            else "osmOutline"
            if r.flags & MAP
            else "imageOutline"
        ] += 1
        counts[
            ("localHeight", "imageHeight", "mappedHeight", "publishedHeight")[
                r.flags & 3
            ]
        ] += 1
        counts["courtyards"] += len(r.poly.interiors)
    meta.update(
        counts,
        features=len(rows),
        districtBatches=stats,
        overtureRelease="2026-11-18.0",
    )
    (GEO / "city-layout.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False) + "\n"
    )


if __name__ == "__main__":
    main()
