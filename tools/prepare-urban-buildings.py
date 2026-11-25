# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy>=1.26", "pyshp>=3.1,<4", "requests>=2.31", "shapely>=2.1,<3"]
# ///
"""Extract the Xiamen records from CMAB for the flight world's building merge.

Run with `uv run tools/prepare-urban-buildings.py --cache-dir /tmp/xm-urban-source`.
The archive and the source shapefile components are cached outside the distributed game.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import struct
import tempfile
import time
import zipfile
import zlib
from collections import Counter

import numpy as np
import requests
import shapefile
import shapely
from shapely.geometry import Polygon, shape
from shapely.geometry.polygon import orient

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "public" / "geo"
ARCHIVE = "https://ndownloader.figshare.com/files/53666771"
ARCHIVE_SIZE = 509253695
BASENAME = "processed_xiamen20230318_all"
# Published member CRCs and lengths also identify the source geometry in a local cache.
MEMBERS = {
    "cpg": (5, 0x0E813C50),
    "dbf": (41643144, 0x441285EE),
    "prj": (425, 0x25B1F528),
    "shp": (125535444, 0x8319C568),
    "shx": (752116, 0x7FD30FC8),
}
FUNCTIONS = {
    "Residence": 1,
    "Business": 2,
    "Public service": 3,
    "Industry": 4,
    "Office": 5,
    "Other": 0,
}
EARTH_RADIUS = 6378137.0
CELL = 0.5
SHORE_BUFFER = 45.0
SIMPLIFY = 0.85
# The island-wide roof-mask correlation peaks 11.35 m east and 1.16 m north.
EAST_SHIFT, SOUTH_SHIFT = 11.0, -1.0


def remote_range(start, end):
    for attempt in range(5):
        try:
            response = requests.get(
                ARCHIVE,
                params={"xiamen-range": f"{start}-{end}-{attempt}"},
                headers={"Range": f"bytes={start}-{end}", "Accept-Encoding": "identity"},
                timeout=(12, 90),
            )
            response.raise_for_status()
            expected = f"bytes {start}-{end}/{ARCHIVE_SIZE}"
            if response.status_code != 206 or response.headers.get("Content-Range") != expected:
                raise OSError(f"The source did not return the requested ZIP range {expected}")
            if len(response.content) != end - start + 1:
                raise OSError("Incomplete archive range")
            return response.content
        except (requests.RequestException, OSError):
            if attempt == 4:
                raise
            time.sleep(1 + attempt)


def valid_member(path, expected):
    if not path.exists() or path.stat().st_size != expected[0]:
        return False
    crc = 0
    with path.open("rb") as file:
        for block in iter(lambda: file.read(2**20), b""):
            crc = zlib.crc32(block, crc)
    return crc == expected[1]


def fetch_city(cache):
    folder = cache / "cmab-input"
    folder.mkdir(parents=True, exist_ok=True)
    files = {ext: folder / f"{BASENAME}.{ext}" for ext in MEMBERS}
    if all(valid_member(path, MEMBERS[ext]) for ext, path in files.items()):
        return files
    # The official province ZIP places the five contiguous Xiamen members at its end.
    # Fetch its central directory first, then only the selected city's actual compressed bytes.
    with tempfile.TemporaryFile(dir=cache) as archive:
        tail = ARCHIVE_SIZE - 131072
        archive.seek(tail)
        archive.write(remote_range(tail, ARCHIVE_SIZE - 1))
        archive.flush()
        with zipfile.ZipFile(archive) as source:
            infos = source.infolist()
            chosen = {
                Path(info.filename).suffix[1:]: (index, info)
                for index, info in enumerate(infos)
                if Path(info.filename).stem == BASENAME
            }
            if set(chosen) != set(files):
                raise ValueError("Unexpected members in the official Fujian archive")
            positions = sorted(i for i, _ in chosen.values())
            if positions[-1] - positions[0] + 1 != len(positions):
                raise ValueError("Expected the five city files in adjacent ZIP entries")
            first = infos[positions[0]].header_offset
            end = (
                infos[positions[-1] + 1].header_offset
                if positions[-1] + 1 < len(infos)
                else source.start_dir
            )
            step = 4 * 2**20
            spans = [(a, min(a + step, end) - 1) for a in range(first, end, step)]
            with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
                tasks = {pool.submit(remote_range, a, b): a for a, b in spans}
                for task in concurrent.futures.as_completed(tasks):
                    archive.seek(tasks[task])
                    archive.write(task.result())
            archive.flush()
            for ext, (_, info) in chosen.items():
                if (info.file_size, info.CRC) != MEMBERS[ext]:
                    raise ValueError(f"Unexpected size or CRC of {info.filename}")
                with tempfile.NamedTemporaryFile(dir=folder, delete=False) as dest:
                    tmp = Path(dest.name)
                    try:
                        with source.open(info) as origin:
                            shutil.copyfileobj(origin, dest, 2**20)
                    except BaseException:
                        tmp.unlink(missing_ok=True)
                        raise
                os.replace(tmp, files[ext])
    return files


def to_world(xy):
    lon = np.rad2deg(xy[:, 0] / EARTH_RADIUS)
    lat = np.rad2deg(np.arctan(np.sinh(xy[:, 1] / EARTH_RADIUS)))
    return np.column_stack(
        ((lon - 118.125) * 101220.0 + EAST_SHIFT, (24.48 - lat) * 111100.0 + SOUTH_SHIFT)
    )


def mercator_bounds(bounds):
    x0, z0, x1, z1 = bounds

    def mx(x):
        return EARTH_RADIUS * math.radians(118.125 + (x - EAST_SHIFT) / 101220.0)

    def my(z):
        return EARTH_RADIUS * math.asinh(
            math.tan(math.radians(24.48 - (z - SOUTH_SHIFT) / 111100.0))
        )

    return mx(x0), my(z1), mx(x1), my(z0)


def polygons(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type == "Polygon":
        yield geometry
    elif geometry.geom_type in ("MultiPolygon", "GeometryCollection"):
        for part in geometry.geoms:
            yield from polygons(part)


def extract(files, islands):
    if "WGS_1984_Web_Mercator_Auxiliary_Sphere" not in files["prj"].read_text():
        raise ValueError(
            "Source CRS changed; refuse to use the Web Mercator inverse without verification"
        )
    region = shapely.union_all(list(islands.values())).buffer(SHORE_BUFFER)
    shapely.prepare(region)
    bbox = mercator_bounds(region.bounds)
    rows, stats = [], Counter()
    with shapefile.Reader(str(files["shp"]), encoding="utf-8") as reader:
        stats["sourceCityRecords"] = len(reader)
        for feature in reader.iterShapeRecords(
            fields=["merged_id", "Height", "Function"], bbox=bbox
        ):
            attrs = feature.record.as_dict()
            geometry = shapely.transform(shape(feature.shape.__geo_interface__), to_world)
            if not geometry.is_valid:
                geometry = shapely.make_valid(geometry)
            if not region.intersects(geometry):
                continue
            stats["sourceRecordsIntersectingIslands"] += 1
            height = attrs["Height"]
            height_dm = (
                int(round(float(height) * 10))
                if height is not None and math.isfinite(height) and 0 < height < 1000
                else 0
            )
            kind = FUNCTIONS[attrs["Function"]]
            for part in polygons(geometry):
                if not region.covers(part.representative_point()):
                    continue
                stats["inputVertices"] += (
                    len(part.exterior.coords) - 1 + sum(len(r.coords) - 1 for r in part.interiors)
                )
                stats["inputCourtyards"] += len(part.interiors)
                quantized = shapely.set_precision(
                    part.simplify(SIMPLIFY, preserve_topology=True), CELL
                )
                for polygon in polygons(quantized):
                    if polygon.area >= 6.0:
                        rows.append((polygon, height_dm, kind, attrs["merged_id"]))
                    else:
                        stats["underSixSquareMetres"] += 1
    return rows, stats


def remove_duplicates(rows, stats):
    shapes = [r[0] for r in rows]
    tree = shapely.STRtree(shapes)
    removed = set()
    # Keep known height, then the better preserved courtyard or the larger roof in a pair.
    order = sorted(
        range(len(rows)),
        key=lambda i: (-bool(rows[i][1]), -len(shapes[i].interiors), -shapes[i].area, rows[i][3]),
    )
    rank = {idx: priority for priority, idx in enumerate(order)}
    for i in order:
        if i in removed:
            continue
        a = shapes[i]
        for j in tree.query(a):
            if rank[j] <= rank[i] or j in removed:
                continue
            b = shapes[j]
            if min(a.area, b.area) < 0.86 * max(a.area, b.area):
                continue
            overlap = a.intersection(b).area
            if overlap / (a.area + b.area - overlap) >= 0.86:
                removed.add(j)
    stats["overlappingDuplicatePolygons"] = len(removed)
    return [r for i, r in enumerate(rows) if i not in removed]


def write_buildings(path, rows, stats):
    path.parent.mkdir(parents=True, exist_ok=True)
    rows.sort(
        key=lambda r: (
            round(r[0].centroid.y / 400),
            round(r[0].centroid.x / 400),
            r[3],
            tuple(r[0].bounds),
        )
    )
    temp = path.with_suffix(".tmp")
    try:
        with temp.open("wb") as out:
            out.write(struct.pack("<4sI", b"XMB1", len(rows)))
            for geom, height, kind, _ in rows:
                geom = orient(geom, sign=1.0)
                rings = [geom.exterior, *geom.interiors]
                out.write(struct.pack("<HBBH", height, kind, 1 if height else 0, len(rings)))
                for ring in rings:
                    coords = np.rint(np.asarray(ring.coords[:-1]) / CELL)
                    if len(coords) < 3 or len(coords) > 65535 or np.any(np.abs(coords) > 32767):
                        raise ValueError("Footprint exceeds XMB1 range")
                    out.write(struct.pack("<H", len(coords)))
                    out.write(coords.astype("<i2").tobytes())
                    stats["outputVertices"] += len(coords)
                stats["courtyards"] += len(geom.interiors)
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def geometry_qa(rows, islands, osm_path):
    from shapely.affinity import translate

    geoms = [r[0] for r in rows]
    tree = shapely.STRtree(geoms)
    osm = []
    for record in json.loads(osm_path.read_text())["items"]:
        polygon = Polygon(np.array(record[1:]).reshape(-1, 2))
        if (
            polygon.is_valid
            and 30 <= polygon.area <= 80000
            and any(island.covers(polygon.centroid) for island in islands.values())
        ):
            osm.append(polygon)
    # A before/after comparison uses the same unambiguous one-to-one overlap matches.
    proposals = []
    for i, polygon in enumerate(osm):
        candidates = tree.query(shapely.box(*polygon.buffer(16, quad_segs=1).bounds))
        if not len(candidates):
            continue
        original_frame = translate(polygon, xoff=EAST_SHIFT, yoff=SOUTH_SHIFT)
        for j in candidates:
            other = geoms[j]
            if min(polygon.area, other.area) < 0.5 * max(polygon.area, other.area):
                continue
            total = polygon.area + other.area

            def iou(reference):
                a = reference.intersection(other).area
                return a / (total - a)

            after, before = iou(polygon), iou(original_frame)
            confidence = max(after, before)
            if confidence >= 0.48:
                proposals.append((confidence, i, int(j), before, after))
    used_o, used_c, matched = set(), set(), []
    for _, i, j, before, after in sorted(proposals, reverse=True):
        if i in used_o or j in used_c:
            continue
        used_o.add(i)
        used_c.add(j)
        origin, actual = osm[i].centroid, geoms[j].centroid
        matched.append(
            (before, after, actual.x - origin.x, actual.y - origin.y, origin.x, origin.y)
        )
    matches = np.array(matched)

    def summary(m):
        if not len(m):
            return {"pairs": 0}
        v = m[:, 2:4]
        return {
            "pairs": len(m),
            "medianIoUBefore": round(float(np.median(m[:, 0])), 3),
            "medianIoUAfter": round(float(np.median(m[:, 1])), 3),
            "medianCentroidErrorBeforeMetres": round(
                float(np.median(np.linalg.norm(v - [EAST_SHIFT, SOUTH_SHIFT], axis=1))), 2
            ),
            "medianCentroidErrorAfterMetres": round(float(np.median(np.linalg.norm(v, axis=1))), 2),
            "p90CentroidErrorAfterMetres": round(
                float(np.percentile(np.linalg.norm(v, axis=1), 90)), 2
            ),
            "medianResidualEastSouthMetres": [round(float(x), 2) for x in np.median(v, axis=0)],
        }

    reports = {"all": summary(matches)}
    for name, box in {
        "airport": (-3000, -10300, 3900, -4900),
        "southwestCity": (-5900, 1100, -1200, 5150),
        "eastCoast": (2800, -4700, 8500, 3500),
        "centralCity": (-3600, -4400, 3100, 800),
    }.items():
        x, z, X, Z = box
        zone = matches[
            (matches[:, 4] >= x)
            & (matches[:, 4] <= X)
            & (matches[:, 5] >= z)
            & (matches[:, 5] <= Z)
        ]
        reports[name] = summary(zone)
    return {
        "method": "One-to-one polygon pairs selected by IoU >= 0.48 in either frame, on bundled OSM building footprints. Both medians use exactly the same pairs. OSM serves as a horizontal cross-check, not as height ground truth.",
        "eligibleOsmFootprints": len(osm),
        "regions": reports,
    }


def build(args):
    cache = args.cache_dir
    files = fetch_city(cache)
    masks = json.loads(args.islands.read_text())
    islands = {name: Polygon(masks[name]) for name in ["xiamen", "gulangyu"]}
    rows, stats = extract(files, islands)
    rows = remove_duplicates(rows, stats)
    if not rows:
        raise ValueError("No source buildings intersect the requested islands")
    out = args.output or cache / "cmab-buildings.bin"
    write_buildings(out, rows, stats)
    print(
        f"Wrote {len(rows):,} building polygons and {stats['courtyards']:,} inner rings to {out}",
        flush=True,
    )
    known_heights = np.array([r[1] / 10 for r in rows if r[1]])
    centers = shapely.points(
        [(r[0].representative_point().x, r[0].representative_point().y) for r in rows]
    )
    island_counts = {
        name: int(np.count_nonzero(shapely.covers(island, centers)))
        for name, island in islands.items()
    }
    stats["unbufferedIslandCounts"] = island_counts
    stats["sourceRecordsOnShoreStrip"] = len(rows) - sum(island_counts.values())
    stats["records"] = len(rows)
    stats["heightsFromModel"] = len(known_heights)
    stats["heightsMissing"] = len(rows) - len(known_heights)
    stats["heightMetres"] = dict(
        zip(
            ["min", "p25", "median", "p75", "p95", "max"],
            [round(float(v), 2) for v in np.percentile(known_heights, [0, 25, 50, 75, 95, 100])],
        )
    )
    stats["useCounts"] = dict(sorted(Counter(r[2] for r in rows).items()))
    metadata = {
        "title": "厦门岛与鼓浪屿城市建筑数据提取",
        "source": {
            "title": "CMAB – The World’s First National-Scale Multi-Attribute Building Dataset",
            "authors": ["Yecheng Zhang", "Huimin Zhao", "Ying Long"],
            "release": "Figshare V7 (author-processed release)",
            "url": "https://doi.org/10.6084/m9.figshare.27992417.v7",
            "sourceArchive": ARCHIVE,
            "archiveFile": "fujian.zip",
            "archiveMd5": "e47bc4b6e731c8aee751aab04a8d9398",
            "shapefile": f"福建省/{BASENAME}.shp",
            "imageryDateFromFilename": "2023-03-18",
            "sourceGeometry": "Polygonal rooftops extracted from satellite imagery. They approximate building ground footprints; roof parallax can remain, especially for tall buildings.",
            "heightSource": "CMAB Height field in metres, based on modelling and combined source data. This Xiamen file does not attribute individually surveyed heights. Missing values remain zero.",
            "license": "CC BY 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
            "originalRelease": "https://doi.org/10.17632/b4t2wxhn2y.5",
            "paper": "https://doi.org/10.1038/s41597-025-04730-5",
        },
        "processing": {
            "sourceCRS": "EPSG:3857 (explicit source .prj; WGS 84 / Web Mercator Auxiliary Sphere)",
            "projection": "Inverse Web Mercator to WGS84, then x=(lon-118.125)*101220, z=(24.48-lat)*111100.",
            "worldRegistrationEastSouthMetres": [EAST_SHIFT, SOUTH_SHIFT],
            "registrationMethod": "A single translation after reprojection, fixed from island-wide building-mask correlation against OSM. No rubber-sheet, scale or rotation adjustment.",
            "shoreBufferMetres": SHORE_BUFFER,
            "simplificationToleranceMetres": SIMPLIFY,
            "coordinateStepMetres": CELL,
            "scope": "Whole source polygons whose interior point lies within the buffered Xiamen or Gulangyu polygons in islands.json.",
            "topology": "Make invalid polygons valid, simplify preserving topology, snap to half-metre coordinates, retain interior rings and polygon parts of at least 6 square metres. Remove coincident roofs with IoU >= 0.86.",
            "heightProcessing": "Nearest decimetre, metres above local ground. Missing data retain source code 0.",
            "osmAttribution": "© OpenStreetMap contributors. Used for the existing island boundary and the georegistration cross-check. https://www.openstreetmap.org/copyright",
        },
        "format": {
            "role": "Input to the offline city-layout merge",
            "magic": "XMB1",
            "byteOrder": "little-endian",
            "header": "4 ASCII bytes, uint32 polygon count",
            "record": "uint16 heightDecimetres, uint8 function, uint8 heightSource, uint16 ringCount",
            "ring": "uint16 vertexCount, then vertexCount pairs of signed int16 x,z at 0.5 metres. Exterior first, interior rings follow; rings omit the repeated closing vertex. Exterior is CCW in XZ.",
            "functionCodes": {
                "0": "other/unknown",
                "1": "residential",
                "2": "business",
                "3": "public service",
                "4": "industry",
                "5": "office",
            },
            "heightCodes": {
                "0": "missing",
                "1": "CMAB model/combined",
                "2": "explicitly surveyed (unused in this source)",
            },
        },
        "counts": dict(stats),
        "intermediateBytes": out.stat().st_size,
        "intermediateSha256": hashlib.sha256(out.read_bytes()).hexdigest(),
        "alignment": geometry_qa(rows, islands, args.osm),
    }
    args.metadata.parent.mkdir(parents=True, exist_ok=True)
    args.metadata.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    print(
        json.dumps(
            {"counts": dict(stats), "alignment": metadata["alignment"]["regions"]["all"]}, indent=2
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cache-dir", type=Path, default=Path(tempfile.gettempdir()) / "xm-urban-source"
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Intermediate XMB1; defaults to cmab-buildings.bin in the cache directory",
    )
    parser.add_argument("--islands", type=Path, default=GEO / "islands.json")
    parser.add_argument("--osm", type=Path, default=GEO / "buildings.json")
    parser.add_argument("--metadata", type=Path, default=GEO / "urban-buildings.json")
    build(parser.parse_args())
