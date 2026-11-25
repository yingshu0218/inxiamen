"""Extract the island BRT alignment and boarding areas from OpenStreetMap."""
import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
API = 'https://www.openstreetmap.org/api/0.6/'
ROUTES = (2334379, 2334378, 2378231, 2378230)
# Each set starts at the end of the preceding set. The wharf has a one-way loop.
LINKS = {
    'wharfIn': (1408154770, (667765194,)),
    'wharfOut': (13821735049, (667765193,)),
    'xiahe': (1408154770, (178136080,)),
    'qianpu': (1408187250, (376948529, 127162491)),
    'airport': (1408187250, (127165442, 376948528, 177694966, 164570760)),
}
STOPS = [
    ('wharf', '第一码头', 'wharfIn', 1761717410),
    ('kaihe', '开禾路口', 'xiahe', 1408154694),
    ('sibei', '思北', 'xiahe', 1408154720),
    ('douxi', '斗西路', 'xiahe', 1408154800),
    ('ershi', '二市', 'xiahe', 1408154858),
    ('wenzao', '文灶', 'xiahe', 4525605884),
    ('jinbang', '金榜公园', 'xiahe', 1408155020),
    ('railway', '火车站', 'xiahe', 1408187203),
    ('lianban', '莲坂', 'xiahe', 1408187238),
    ('longshan', '龙山桥', 'xiahe', 1840796394),
    ('wolong', '卧龙晓城', 'xiahe', 1408187281),
    ('dongfang', '东芳山庄', 'xiahe', 1408187255),
    ('hongwen', '洪文', 'qianpu', 1849541339),
    ('qianpu', '前埔枢纽', 'qianpu', 1849543674),
    ('caitang', '蔡塘', 'airport', 1408187296),
    ('jinshan', '金山', 'airport', 1408187328),
    ('service', '市政务服务中心', 'airport', 1410454121),
    ('shuangshi', '双十中学', 'airport', 1410454140),
    ('xianhou', '县后', 'airport', 1761901217),
    ('gaoqi', '高崎机场', 'airport', 1410454191),
    ('t4', 'T4候机楼', 'airport', 1410454274),
]


def read_osm(cache, filename, endpoint):
    path = cache / (str(filename) + '.osm')
    if not path.exists():
        request = Request(API + endpoint, headers={'User-Agent': 'Xiamen offline BRT scenery'})
        with urlopen(request, timeout=60) as response:
            path.write_bytes(response.read())
    return ET.parse(path).getroot()


def make_plan(cache):
    data = {}

    def collect(root):
        data.update(((element.tag, int(element.get('id'))), element)
                    for element in root if element.tag in ('node', 'way', 'relation'))

    for route in ROUTES:
        collect(read_osm(cache, route, f'relation/{route}/full'))
    for key, endpoint in [
        ('wenzao', 'node/4525605884'),
        ('gaoqi', 'map?bbox=118.14801,24.54259,118.1500,24.54399'),
    ]:
        collect(read_osm(cache, key, endpoint))

    def point(node):
        element = data['node', node]
        lon, lat = float(element.get('lon')), float(element.get('lat'))
        return [round((lon - 118.125) * 101220, 2), round((24.48 - lat) * 111100, 2)]

    def vertices(way):
        return [int(n.get('ref')) for n in data['way', way].findall('nd')]

    def alignment(first, ways):
        nodes = [first]
        for way in ways:
            refs = vertices(way)
            if refs[-1] == nodes[-1]:
                refs.reverse()
            if refs[0] != nodes[-1]:
                raise ValueError(f'BRT way {way} is disconnected at node {nodes[-1]}')
            nodes.extend(refs[1:])
        return [point(n) for n in nodes]

    edges = {key: alignment(first, ways) for key, (first, ways) in LINKS.items()}
    platforms = {}
    for route in ROUTES:
        stop = None
        for member in data['relation', route].findall('member'):
            role = member.get('role')
            if role == 'stop':
                stop = int(member.get('ref'))
            if stop and role == 'platform' and member.get('type') == 'way':
                platforms.setdefault(stop, set()).add(int(member.get('ref')))
    platforms[1410454191] = {850804763, 850804764}
    stops = []
    for key, name, link, node in STOPS:
        rings = []
        for way in sorted(platforms.get(node, [])):
            refs = vertices(way)
            if refs[0] == refs[-1]:
                refs.pop()
            rings.append([point(n) for n in refs])
        stops.append({'id': key, 'name': name, 'link': link, 'point': point(node), 'platforms': rings})
    return {
        'source': '© OpenStreetMap contributors, ODbL 1.0',
        'relations': ROUTES,
        'links': edges,
        'airportRamp': point(1422599114),
        'stops': stops,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cache', type=Path, help='Directory for the downloaded OSM extracts')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    plan = make_plan(args.cache)
    (ROOT / 'src/brt-plan.json').write_text(json.dumps(plan, ensure_ascii=False, separators=(',', ':')) + '\n')
