"""Bake Xiamen Island's complete mapped surface street and inland water network.

    python tools/prepare-urban-hydrography.py --cache /tmp/xm-geo-cache \
        --dem /tmp/xm-urban-source/copernicus-n24e118.tif

All geometry uses the metre frame in public/geo/manifest.json. OSM/OMT from
the same dated OpenFreeMap survey as the terrain; Copernicus DEM GLO-30
heights are orthometric (EGM2008). Dependencies are in geo-requirements.txt.
"""
import argparse
import importlib.util
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import rasterio
from rasterio.mask import mask
import shapely
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import orient, polygonize

SPEC = importlib.util.spec_from_file_location("flight_geo", Path(__file__).with_name("prepare-geo.py"))
geo = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(geo)
SITE = Path(__file__).resolve().parents[1] / "public"
COPERNICUS = ("https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N24_00_E118_00_DEM/"
              "Copernicus_DSM_COG_10_N24_00_E118_00_DEM.tif")
ROAD_KIND = {"motorway": 5, "trunk": 5, "primary": 4, "secondary": 3, "tertiary": 2,
             "busway": 2, "minor": 1, "residential": 1, "service": 0, "track": 0, "path": -1}
BRIDGE, RAMP, LEGACY = 1, 2, 4
TIDAL = {"筼筜湖", "篔簹湖", "松柏湖", "天地湖", "江头天地湖"}
# The lake authority's post-intake operating level (Yellow Sea elevation) is 0 m.
# https://www.xmrd.gov.cn/rdlz/dbjygk/dbjy/201704/t20170401_239835.htm
# The operator keeps Shangli at 58 m, with a spillway above this elevation.
# https://xm.fjsen.com/2026-09/21/content_32256684.htm
MANAGED_LEVELS = {"筼筜湖": 0, "篔簹湖": 0, "上李水库": 58}
# Dongpingshan and Dongshan are separate reservoirs in the Siming district record.
# The published Dongpingshan POI falls inside this surveyed OSM ring after GCJ-02
# conversion (the public POI is used only to identify the existing feature).
# https://xm.fjdsfzw.org.cn/2024-11-06/content_152910.html
# https://www.trip.com/travel-guide/attraction/xiamen/dongping-mountain-reservoir-133953907/
VERIFIED_NAMES = {10876279252: "东坪山水库"}
WATER_CLASSES = {"lake", "pond", "river"}


def json_write(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".part")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False))
    temporary.replace(path)


def as_lines(geometry):
    if geometry.geom_type == "LineString":
        yield geometry
    elif geometry.geom_type in ("MultiLineString", "GeometryCollection"):
        for child in geometry.geoms:
            yield from as_lines(child)


def wgs(points):
    return np.column_stack((geo.ORIGIN_LON + points[:, 0] / geo.METRES_LON,
                            geo.ORIGIN_LAT - points[:, 1] / geo.METRES_LAT))


def raw_tiles(cache):
    outlines = json.loads((SITE / "geo/islands.json").read_text())
    approximate = Polygon(outlines["xiamen"])
    x0, z0, x1, z1 = approximate.buffer(1000).bounds
    ends = wgs(np.array([[x0, z1], [x1, z0]]))
    bounds = (*ends[0], *ends[1])
    ocean, water, names, roadways = [], defaultdict(list), {}, defaultdict(list)
    extents = []
    for tile in geo.tiles(14, bounds):
        source = geo.local_path(cache, "osm", tile)
        if not source.exists():
            source.parent.mkdir(parents=True, exist_ok=True)
            source.write_bytes(geo.get(geo.OSM.format(z=tile[0], x=tile[1], y=tile[2])).content)
        layers = geo.vector_tile(cache, tile)
        convert = geo.world_converter(tile)
        nw, se = convert(np.array([[0, 0], [4096, 4096]]))
        extent = box(*nw, *se)
        extents.append(extent)

        def clipped(feature):
            result = shapely.transform(shape(feature["geometry"]), convert)
            if not result.is_valid:
                result = shapely.make_valid(result)
            return result.intersection(extent)

        for feature in layers.get("water", {}).get("features", []):
            props = feature["properties"]
            kind, key = props.get("class"), feature["id"]
            if kind == "ocean":
                ocean.extend(geo.as_polygons(clipped(feature)))
            elif kind in WATER_CLASSES and not props.get("intermittent", 0):
                water[(key, kind)].extend(geo.as_polygons(clipped(feature)))
        for feature in layers.get("water_name", {}).get("features", []):
            props = feature["properties"]
            name = props.get("name:zh-Hans") or props.get("name:zh") or props.get("name")
            if name:
                names[feature["id"]] = name
        for feature in layers.get("transportation", {}).get("features", []):
            props = feature["properties"]
            kind, brunnel = props.get("class"), props.get("brunnel")
            layer = int(props.get("layer", 0))
            if (kind not in ROAD_KIND or brunnel == "tunnel" or layer < 0 or props.get("level", 0) < 0 or
                    props.get("subclass") in {"platform", "corridor"} or
                    feature["geometry"]["type"] not in {"LineString", "MultiLineString"}):
                continue
            flags = (BRIDGE if brunnel == "bridge" else 0) | (RAMP if props.get("ramp") else 0)
            roadways[(ROAD_KIND[kind], flags, layer)].extend(as_lines(clipped(feature)))

    water_mask = shapely.union_all(ocean, grid_size=.25)
    land = shapely.union_all(extents).envelope.difference(water_mask)
    island = next(p for p in geo.as_polygons(land) if p.covers(Point(0, 0)))
    # The adopted outer coast includes interior lakes. Minor offshore carriageways
    # in the narrow ribbon remain attached; it is narrower than the Gulangyu channel.
    island = Polygon(island.exterior)
    seams = tuple(sorted({extent.bounds[a] for extent in extents for a in (axis, axis + 2)})
                  for axis in (0, 1))
    return island, water, names, roadways, seams


def integer_path(line, closed=False):
    coordinates = np.rint(np.asarray(line.coords)).astype(np.int32)
    keep = np.r_[True, (coordinates[1:] != coordinates[:-1]).any(axis=1)]
    result = coordinates[keep]
    if closed and len(result) and np.array_equal(result[0], result[-1]):
        result = result[:-1]
    return result.ravel().tolist()


def sew_tile_edges(lines, seams):
    # Opposite MVT tiles occasionally round a seam crossing one or two grid units
    # apart. Join only opposing, aligned ends of the same kind, brunnel and level.
    endpoints = defaultdict(list)
    coords = [np.array(line.coords) for line in lines]
    for i, path in enumerate(coords):
        for end, neighbor in ((0, 1), (-1, -2)):
            point = path[end]
            travel = path[neighbor] - point
            length = np.linalg.norm(travel)
            if length < .01:
                continue
            for axis, boundaries in enumerate(seams):
                boundary = min(boundaries, key=lambda v: abs(v - point[axis]))
                if abs(point[axis] - boundary) < .06:
                    endpoints[(axis, boundary)].append((point[1-axis], i, end, travel / length))
    for (axis, boundary), entries in endpoints.items():
        used = set()
        entries.sort(key=lambda item: item[:3])
        for i, (transverse, index, end, direction) in enumerate(entries):
            if i in used:
                continue
            best, spacing = None, 2.85
            for j in range(i + 1, len(entries)):
                at, other, _, inward = entries[j]
                if at - transverse > spacing:
                    break
                if (j in used or index == other or inward[axis]*direction[axis] >= 0 or
                        np.dot(inward, direction) > -.64):
                    continue
                best, spacing = j, at - transverse
            if best is None:
                continue
            at, other, other_end, _ = entries[best]
            common = [boundary, (transverse + at) / 2]
            if axis:
                common.reverse()
            coords[index][end] = common
            coords[other][other_end] = common
            used.update((i, best))
    return [LineString(path) for path in coords]


def street_records(island, roadways, seams):
    scope = shapely.set_precision(island.buffer(55, quad_segs=2), 1)
    result = []
    for (kind, flags, layer), lines in sorted(roadways.items()):
        # Tile buffers often repeat a road for over 50 m. Core clipping in raw_tiles
        # plus integer-grid noding dissolves exact shared vertices and seam fragments.
        cut = [part for line in lines if scope.intersects(line)
               for part in as_lines(line.intersection(scope)) if part.length > .05]
        if not cut:
            continue
        welded = shapely.line_merge(shapely.union_all(sew_tile_edges(cut, seams), grid_size=1))
        for line in as_lines(welded):
            if line.length < 1:
                continue
            coords = integer_path(line)
            if len(coords) >= 4:
                result.append([kind, flags, layer, *coords])
    old_rows = json.loads((SITE / "scenery/streets.json").read_text())
    for kind, *flat in old_rows:
        line = LineString(np.reshape(flat, (-1, 2)))
        if scope.disjoint(line):
            result.append([kind, LEGACY, 0, *flat])
        elif not scope.covers(line):
            for part in as_lines(line.difference(scope)):
                coords = integer_path(part)
                if len(coords) >= 4:
                    result.append([kind, LEGACY, 0, *coords])
    return sorted(result)


def elevation(dataset, polygon):
    # Interior pixel centres avoid water/rock mixtures at sloped reservoir shores.
    # Narrow ponds may have no full DEM pixel; their representative sample is the
    # measured DSM at that point and has much lower vertical confidence.
    for inset in (35, 15, 0):
        inside = polygon.buffer(-inset) if inset else polygon
        if inside.is_empty:
            continue
        surface = shapely.transform(inside, wgs)
        raster, _ = mask(dataset, [mapping(surface)], crop=True, filled=False, indexes=1)
        values = raster.compressed()
        if len(values) >= (3 if inset else 1):
            return float(np.median(values))
    mark = shapely.transform(polygon.representative_point(), wgs)
    return float(next(dataset.sample([(mark.x, mark.y)]))[0])


def water_records(island, groups, names, dem):
    candidates = []
    for (key, raw_kind), pieces in sorted(groups.items()):
        combined = shapely.union_all(pieces, grid_size=.25)
        name = names.get(key) or VERIFIED_NAMES.get(key)
        if name in {"泳池", "游泳池", "游泳馆"}:
            continue
        for part in geo.as_polygons(combined):
            if not island.covers(part.representative_point()) or part.area < (125 if name else 775):
                continue
            # The threshold is roughly one native DEM cell for anonymous water;
            # developed swimming pools and intermittent channels were excluded upstream.
            rounded = shapely.set_precision(part.simplify(.9, preserve_topology=True), 1)
            for polygon in geo.as_polygons(rounded):
                if polygon.is_empty or polygon.area < 10:
                    continue
                polygon = orient(polygon, sign=1)
                measured = elevation(dem, polygon)
                level = MANAGED_LEVELS.get(name, max(.15, round(measured, 1)))
                kind = ("tidal" if name in TIDAL else "reservoir" if name and
                        ("水库" in name or "水庫" in name) else raw_kind)
                candidates.append((key, name, kind, level, polygon))
    # The wide Yundang OSM relation overlaps much of separately named Songbai
    # Lake, and a few shoreline metres of its river inlet. Follow the controlled
    # water level across that contiguous survey and draw the shared area once.
    basin = shapely.union_all([p for _, n, _, _, p in candidates if n in {"筼筜湖","篔簹湖"}])
    candidates.sort(key=lambda item: item[-1].area)
    linework = shapely.union_all([item[-1].boundary for item in candidates], grid_size=1)
    faces = defaultdict(list)
    for face in polygonize(linework):
        interior = face.representative_point()
        for i, candidate in enumerate(candidates):
            if candidate[-1].covers(interior):
                faces[i].append(face)
                break
    records = []
    for i, (key, name, kind, level, polygon) in enumerate(candidates):
        if name in {"松柏湖", "后埭溪"} and polygon.intersects(basin):
            level = 0
        visible = shapely.union_all(faces[i])
        for index, part in enumerate(sorted(geo.as_polygons(visible), key=lambda p: -p.area)):
            if part.area < 100:
                continue
            part = orient(part, sign=1)
            record = {"kind": kind}
            if name and index == 0:
                record["name"] = name
            record["h"] = level
            record["rings"] = [integer_path(ring, closed=True) for ring in
                               [part.exterior, *part.interiors]]
            records.append(record)
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path("/tmp/xm-geo-cache"))
    parser.add_argument("--dem", type=Path, default=Path("/tmp/xm-urban-source/copernicus-n24e118.tif"))
    parser.add_argument("--output", type=Path, default=SITE / "geo")
    args = parser.parse_args()
    if not args.dem.exists():
        args.dem.parent.mkdir(parents=True, exist_ok=True)
        args.dem.write_bytes(geo.get(COPERNICUS, timeout=100).content)
    island, groups, names, roadways, seams = raw_tiles(args.cache)
    with rasterio.open(args.dem) as dem:
        lakes = water_records(island, groups, names, dem)
    json_write(args.output / "inland-water.json", {"v": 1, "water": lakes})
    roads = street_records(island, roadways, seams)
    json_write(args.output / "urban-streets.json", {"v": 1, "roads": roads})
    print(f"{len(lakes)} water polygons, {len(roads)} street polylines. "
          f"Road classes {dict(sorted(Counter(r[0] for r in roads).items()))}.")


if __name__ == "__main__":
    main()
