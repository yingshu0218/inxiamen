"""Rebuild the coast beach mask in memory and sample the production distance texture."""
from pathlib import Path
import json
import math
from PIL import Image, ImageDraw, ImageChops

root = Path(__file__).resolve().parents[1]
north = json.loads((root / 'src/coast/north.json').read_text())
survey = json.loads((root / 'src/coast/survey.json').read_text())
mask = Image.open(root / 'public/scenery/huandao-beaches.png').convert('L')
distance = Image.open(root / 'public/geo/coast-distance.png').convert('L')
wanted = Image.new('L', (2100, 2560))
draw = ImageDraw.Draw(wanted)
for polygon in [b['points'] for b in survey['beaches']] + [north['sand']]:
    draw.polygon([((x + 3150) / 5, (z + 6500) / 5) for x, z in polygon], fill=255)
assert not ImageChops.difference(mask, wanted).getbbox(), 'Beach polygons and production mask differ'


def shore_metres(x, z):
    # Match the triangular interpolation of elevationField used by loadGeography.
    col = (x + 19000) / 38000 * (distance.width - 1)
    row = (z + 16000) / 32000 * (distance.height - 1)
    i, j = math.floor(col), math.floor(row)
    u, v = col - i, row - j
    a, b, c, d = [distance.getpixel(p) for p in [(i, j), (i+1, j), (i, j+1), (i+1, j+1)]]
    sample = a + u*(b-a) + v*(c-a) if u+v <= 1 else d + (1-u)*(c-d) + (1-v)*(b-d)
    return (sample - 128) * 2


def sample(line):
    for (x,z), (ex,ez) in zip(line, line[1:]):
        count = math.ceil(math.hypot(ex-x, ez-z) / 5)
        for j in range(count):
            yield x+(ex-x)*j/count, z+(ez-z)*j/count
    yield line[-1]


def sand(x,z):
    return mask.getpixel((int((x+3150)/5), int((z+6500)/5)))


park = [p for key in ['parkWalk', 'parkBranch'] for p in sample(north[key])]
minimum = min(shore_metres(*p) for p in park)
road = [p for feature in survey['roads'] for p in sample(feature['points']) if -6450 < p[1] < -1800]
assert minimum > 3 and all(sand(*p) == 0 for p in road)
print(json.dumps({'beachPolygons': len(survey['beaches'])+1, 'beachMaskPixelDifferences': 0,
                  'parkPathSamples': len(park), 'parkMinimumDistanceInlandM': round(minimum, 2),
                  'northernRoadSamplesInMaskExtent': len(road), 'roadCentersOnSand': 0}, indent=2))
