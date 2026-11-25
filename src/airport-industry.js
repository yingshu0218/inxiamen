import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, ShapeUtils, SRGBColorSpace, Vector2 } from 'three';
import { industryBuildings, industryYards } from './airport-industry-layout.js';
import { localFrame, rect, up } from './landmark-forms.js';
import { MeshBatch, groundY, inRing, litSurface, mix, prism, randomSource, ringRect, signedArea } from './scenery-mesh.js';
import { treeInstances } from './scenery-life.js';

const styles = {
  factory:   ['#c4c3b9', '#9b9e96', 3],
  research:  ['#c6c4b9', '#a6a8a0', litSurface.office],
  service:   ['#b4b9b6', '#c6c7bc', 3],
  materials: ['#c9c2b2', '#c4c0b3', 0],
  office:    ['#97a7aa', '#c3bfb3', 0],
};

function roofDetails(batch, ring, top, kind, obstacles) {
  const centre = ring.reduce(([x, z], [a, b]) => [x + a / ring.length, z + b / ring.length], [0, 0]);
  const longest = ring.map(([x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return [Math.hypot(a - x, b - z), Math.atan2(b - z, a - x)];
  }).reduce((a, b) => a[0] >= b[0] ? a : b);
  const [length, angle] = longest;
  const xy = localFrame(centre, angle);
  const width = Math.max(...ring.map(([x, z]) => Math.abs(-(x - centre[0]) * Math.sin(angle) + (z - centre[1]) * Math.cos(angle)))) * 2;
  function fitting(u, v, w, d) {
    const patch = rect(xy, u, v, w, d);
    return patch.every(([x, z]) => inRing(x, z, ring)) ? patch : null;
  }
  for (const side of [-1, 1]) {
    const strip = fitting(0, side * width * .29, length * .66, Math.min(width * .18, 6.2));
    if (strip) batch.top(strip.map(p => up(p, top + .05)),
      kind === 'service' ? '#7f8986' : '#aaa89b', 21);
    const head = fitting(side * length * .24, side * width * .24, Math.min(length * .19, 13), Math.min(width * .24, 9));
    if (head) {
      const cap = top + (kind === 'office' ? 2.8 : 1.8);
      prism(batch, head, top, cap, '#969c96', '#c7c7bd');
      obstacles.add(head, cap);
    }
  }
  const boundary = signedArea(ring) > 0 ? ring : ring.toReversed();
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], size = Math.hypot(dx, dz);
    if (size < 3) continue;
    const kerb = ringRect((a[0] + b[0]) / 2 - dz * .29 / size, (a[1] + b[1]) / 2 + dx * .29 / size,
      size - .16, .56, Math.atan2(dz, dx));
    prism(batch, kerb, top - .05, top + .77, '#b5b6ad', '#dedbd0');
  }
}

function checkedFacade(batch, ring, base, top, office) {
  const boundary = signedArea(ring) > 0 ? ring : ring.toReversed();
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], size = Math.hypot(dx, dz);
    const columns = Math.max(1, Math.round(size / (office ? 2.8 : 4.1)));
    const rows = office ? 8 : 5;
    const point = (t, y) => [a[0] + dx * t + dz * .065 / size, y, a[1] + dz * t - dx * .065 / size];
    for (let row = 0; row < rows; row++) {
      const lo = mix(base + 1.1, top - 1.05, row / rows) + (office ? .26 : .55);
      const hi = mix(base + 1.1, top - 1.05, (row + 1) / rows) - (office ? .21 : .42);
      for (let col = 0; col < columns; col++) {
        const left = (col + (office ? .05 : .13)) / columns, right = (col + (office ? .95 : .87)) / columns;
        const glass = (row * 5 + col * 3 + i) % 11 === 0 ? '#688490' : office ? '#4b7080' : '#677678';
        batch.face([point(left, lo), point(left, hi), point(right, hi), point(right, lo)], glass);
      }
    }
  }
}

function paintYards(batch, geo) {
  const point = ([x, z], lift) => [x, groundY(geo, x, z) + lift, z];
  function patch([a, b, c], lift, color, style) {
    if (Math.max(Math.hypot(a[0]-b[0], a[1]-b[1]), Math.hypot(b[0]-c[0], b[1]-c[1]),
      Math.hypot(c[0]-a[0], c[1]-a[1])) <= 16) {
      batch.top([a, b, c].map(p => point(p, lift)), color, style);
      return;
    }
    const mid = (p, q) => [(p[0]+q[0]) * .5, (p[1]+q[1]) * .5];
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    for (const t of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]]) patch(t, lift, color, style);
  }
  for (const { edge, lanes } of industryYards) {
    const points = edge.map(p => new Vector2(...p));
    for (const triangle of ShapeUtils.triangulateShape(points, []))
      patch(triangle.map(i => edge[i]), .16, '#a7a598', 22);
    for (const lane of lanes) {
      const edges = lane.map(([x, z], i) => {
        const a = lane[Math.max(0, i - 1)], b = lane[Math.min(lane.length - 1, i + 1)];
        const dx = b[0] - a[0], dz = b[1] - a[1], k = 3.15 / Math.hypot(dx, dz);
        return [[x - dz * k, z + dx * k], [x + dz * k, z - dx * k]];
      });
      for (let i = 1; i < edges.length; i++) {
        const [a, b] = edges[i - 1], [c, d] = edges[i];
        patch([a,b,d], .24, '#757a74', litSurface.streetAsphalt);
        patch([a,d,c], .24, '#757a74', litSurface.streetAsphalt);
      }
    }
  }
}

function materialsSign(parent, batch, geo) {
  const centre = [1791.5, -6752.3], angle = -.66;
  const base = groundY(geo, ...centre);
  prism(batch, ringRect(...centre, 14, 1.3, angle), base - .2, base + 1.52, '#a7a7a0', '#c4c1b8');
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 112;
  const context = canvas.getContext('2d');
  context.fillStyle = '#38464b';
  context.font = 'bold 64px "PingFang SC", "Microsoft YaHei", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('厦门国际航材中心', 512, 56);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  const sign = new Mesh(new PlaneGeometry(13.6, 1.48), new MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
  const [x, z] = localFrame(centre, angle)(0, -.66);
  sign.position.set(x, base + .79, z);
  sign.rotation.y = Math.PI - angle;
  sign.name = '厦门国际航材中心';
  parent.add(sign);
}

export function buildAirportIndustry(parent, geo, material, obstacles) {
  const buildings = new MeshBatch(), yards = new MeshBatch();
  const rng = randomSource(7724);
  for (const { ring, kind, h } of industryBuildings) {
    const levels = ring.map(p => groundY(geo, ...p)).sort((a, b) => a - b);
    const base = levels[levels.length >> 1], top = base + h;
    const [wall, roof, facade] = styles[kind];
    const office = kind === 'office', materials = kind === 'materials';
    prism(buildings, ring, levels[0] - .8, base + .65, '#a9a69a');
    prism(buildings, ring, base + .65, top, wall, roof, facade, rng(), 0, 22);
    if (office || materials) checkedFacade(buildings, ring, base, top, office);
    obstacles.add(ring, top + .77);
    roofDetails(buildings, ring, top, kind, obstacles);
  }
  paintYards(yards, geo);
  materialsSign(parent, buildings, geo);
  const roofs = buildings.finish(parent, material, '高崎 · 航空产业园楼群');
  roofs.castShadow = roofs.receiveShadow = true;
  yards.finish(parent, material, '高崎 · 航空产业园街廓与庭院').receiveShadow = true;
  const trees = industryYards.flatMap(yard => yard.trees.map(([x, z]) =>
    [x, groundY(geo, x, z), z, .7 + rng() * .48, rng() * Math.PI * 2, rng()]));
  treeInstances(parent, trees, false, rng);
}
