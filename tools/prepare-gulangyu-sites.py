"""Extract the island outline, heritage buildings and ferry landings in local metres.

Run after prepare-geo.py. Pass --osm to reuse an OSM map extract offline.
"""
import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
MAP = "https://api.openstreetmap.org/api/0.6/map?bbox=118.0488,24.4359,118.0748,24.4599"


def extract(root):
    nodes = {n.get("id"): [round((float(n.get("lon")) - 118.125) * 101220, 1),
                            round((24.48 - float(n.get("lat"))) * 111100, 1)]
             for n in root.findall("node")}
    ways = {int(w.get("id")): [nodes[n.get("ref")] for n in w.findall("nd")]
            for w in root.findall("way")}

    def ring(i):
        points = ways[i]
        assert points[0] == points[-1], f"Open footprint on way {i}"
        return points[:-1]

    # All dock frames use the outer pontoon's alongshore axis. Positive across
    # points out to sea. The piano terminal has two independently surveyed berths.
    def corners(i, *indices):
        return [ways[i][j] for j in indices]

    san = 718086997
    west = 1010019541
    coast = ways[164669117]
    south = ways[993673314]
    assert coast[-1] == south[0] and coast[0] == south[-1]
    plan = {
        "sunlight": {
            "outcrops": [ring(i) for i in (905748511, 1526504622, 1526504642)],
            "lookout": ring(1526504626),
            "upperSteps": ways[1526504629][::-1] + ways[1526504630][1:2] + ways[1526504628][-2::-1],
            "bridge": ways[1526504631],
            "upperLanding": ways[1526504630],
            "slabWalk": ways[1526504632] + ways[1526504633][1:],
            "slabViewpoint": nodes["1762860266"],
            "eastViewpoint": nodes["13912926516"],
            "ascent": ways[300721737][::-1],
            "eastDescent": ways[300722081],
            "inscription": nodes["13912926581"],
            "templeCourt": ring(1526504647),
            "templeHalls": [ring(i) for i in (1526504643, 174196000, 174195992, 1526504644)],
            "templeAnnexes": [ring(i) for i in (1526504649, 1526504645)],
            "templeGate": ring(174195989),
        },
        "sanqiutian": {"pontoon": corners(san, 14, 11, 10, 15),
                       "shoreEnds": corners(san, 22, 24, 0, 2)},
        "neicuoao": {"pontoon": corners(west, 1, 2, 3, 0), "hall": ring(718087004)},
        "piano": {"hall": ring(732161909),
                  "pontoons": [ring(732161911), ring(732161912)],
                  "gangways": [ways[732161910], ways[732161913][::-1],
                               ways[732161914], ways[732161915]]},
        "historicLanding": ways[927166856],
        "promenade": coast[67:80],
        "trinity": ring(642501322),
        "catholic": ring(164669122),
        "haitian": [ring(i) for i in (642485024, 642485021, 642485018, 642485023, 642485022)],
        "huangVilla": ring(642493152),
        "huangCourt": ring(1243692709),
        "gardenWestGate": ring(1526657604),
        "gardenSeaWall": ways[1526657613],
        "gardenTerrace": ring(1243692687),
        "gardenGateWings": [ring(i) for i in (1526657598, 1526657599, 1526657600, 1526657601, 1526657602)],
        "gardenGateWalk": ways[1526657606] + ways[1526657607][1:] + ways[1526657610][1:] + ways[1526657614][1:],
        "consulate": ring(642501153),
        "statue": nodes["1762860406"],
        "statueTerrace": ring(164669118),
        "seaWalk": ways[164669124][:-1] + ways[791636431],
        "seaPavilion": ring(1243692638),
        "tidalRocks": [ring(i) for i in (1010019550, 1010019551, 1010019552)],
        "marketStreet": ways[164652576],
        "villageLanes": [ways[i] for i in (905736888, 231880766, 903045441, 642504810, 902673162)],
    }
    lines = [f'  "{key}": ' + json.dumps(value, separators=(",", ":")) for key, value in plan.items()]
    (ROOT / "src/gulangyu-plan.json").write_text("{\n" + ",\n".join(lines) + "\n}\n")
    islands_file = ROOT / "public/geo/islands.json"
    islands = json.loads(islands_file.read_text())
    islands["gulangyu"] = coast[:-1] + south[:-1]
    islands_file.write_text(json.dumps(islands, separators=(",", ":")))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--osm", type=Path)
    args = parser.parse_args()
    if args.osm:
        extract(ElementTree.parse(args.osm).getroot())
    else:
        with urlopen(Request(MAP, headers={"User-Agent": "Xiamen sightseeing game scenery"}), timeout=45) as source:
            extract(ElementTree.parse(source).getroot())
