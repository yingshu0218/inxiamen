"""Extract the mapped Gaoqi railway ways from local OpenStreetMap XML extracts."""
import argparse
import json
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
MAIN = (1492165172, 1492165174, 1492165173, 1492165175)
BRIDGE_HEAD = (627497895, 346692332)
EAST = (773642124, 775651547, 1189742595, 129196699, 129196700, 129196701,
        129196708, 773642125, 773642126, 775651537, 775651538, 775651545,
        775651546, 775651535, 775651536, 775651539, 775651540, 775651541,
        775651542, 775651543, 775651544, 129196678, 129196686, 129196690,
        129196696, 127474890, 1226070291, 1226070290)
WEST = (127162643, 128159903, 129196681, 129196683, 129196689, 129196697,
        129196703, 129196705, 129196707, 242791176, 365435845, 1189742596,
        1189742597, 1189742598, 1189742599, 1189742600, 129196684,
        129196693, 129196695, 129196698, 129196704, 129196706)


def read_files(path):
    nodes, ways = {}, {}
    for file in sorted(path.glob('osm-*.xml')):
        tree = ET.parse(file)
        for node in tree.findall('node'):
            lon, lat = float(node.get('lon')), float(node.get('lat'))
            nodes[int(node.get('id'))] = (round((lon - 118.125) * 101220, 2),
                                          round((24.48 - lat) * 111100, 2))
        for way in tree.findall('way'):
            ways[int(way.get('id'))] = [int(n.get('ref')) for n in way.findall('nd')]
    return nodes, ways


def make_plan(path):
    nodes, ways = read_files(path)

    def line(i):
        return [nodes[n] for n in ways[i]]

    def ring(i):
        points = line(i)
        return points[:-1] if points[-1] == points[0] else points

    def clip_south(points, limit):
        # Way 127474890 continues well beyond the station area.
        clipped = [points[0]]
        for a, b in zip(points, points[1:]):
            if b[1] <= limit:
                clipped.append(b)
                continue
            t = (limit - a[1]) / (b[1] - a[1])
            clipped.append((round(a[0] + (b[0] - a[0]) * t, 2), limit))
            break
        return clipped

    return {
        'source': '© OpenStreetMap contributors, ODbL 1.0',
        'stationNode': 2502478744,
        'main': [[i, line(i)] for i in MAIN],
        'bridgeHeads': [[i, line(i)[:4]] for i in BRIDGE_HEAD],
        'yards': [[i, clip_south(line(i), -5720) if i == 127474890 else line(i)] for i in EAST + WEST],
        'platforms': [ring(i) for i in (365436460, 365436474)],
        'parcels': [ring(i) for i in (777021088, 1025085535, 1025085534)],
        'westBuildings': [ring(i) for i in (569181058, 569181059)],
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('extracts', type=Path, help='Directory with OSM XML files named osm-*.xml')
    args = parser.parse_args()
    plan = make_plan(args.extracts)
    (ROOT / 'src/gaoqi-railway-plan.json').write_text(json.dumps(plan, ensure_ascii=False, separators=(',', ':')) + '\n')
