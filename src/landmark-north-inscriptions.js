import { ShapeUtils, Vector2 } from 'three';
import strokes from './north-inscription-strokes.json' with { type: 'json' };
import { ellipse, foundation, rect, up } from './landmark-forms.js';
import { TAU, litSurface, prism, randomSource, signedArea } from './scenery-mesh.js';

const stone = litSurface.monumentStone;
const carvedFace = litSurface.monumentFace;
const upright = (ring) => signedArea(ring) > 0 ? ring : ring.toReversed();

function roundedPanel(w, h, radius, bottom) {
  const corners = [[w / 2 - radius, bottom + h - radius], [-w / 2 + radius, bottom + h - radius],
    [-w / 2 + radius, bottom + radius], [w / 2 - radius, bottom + radius]];
  return corners.flatMap(([u, y], i) => Array.from({ length: 5 }, (_, j) => {
    const a = (i + j / 4) * TAU / 4;
    return [u + radius * Math.cos(a), y + radius * Math.sin(a)];
  }));
}

function panelSurface(batch, point, ring, holes, v, color, kind = 0, seed = 0, reverse = false) {
  const vector = (ring) => ring.map(([u, y]) => new Vector2(u, y));
  const vertices = ring.concat(...holes);
  const faces = ShapeUtils.triangulateShape(vector(ring), holes.map(vector));
  for (const face of faces) {
    const uv = upright(face.map(i => vertices[i]));
    if (reverse) uv.reverse();
    batch.face(uv.map(([u, y]) => point(u, y, v)), color, kind, seed, uv);
  }
}

function panelEdges(batch, point, a, b, rear, front, color, inside = false, kind = 0) {
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    const face = [point(...a[i], rear), point(...a[j], rear), point(...b[j], front), point(...b[i], front)];
    if (inside) face.reverse();
    batch.face(face, color, kind);
  }
}

function stoneSlab(batch, point, rim, edge, rear, front, color, trim, faceOpen = false) {
  const bevel = Math.min(.11, (front - rear) * .28);
  panelEdges(batch, point, edge, edge, rear, front - bevel, color, false, stone);
  panelEdges(batch, point, edge, rim, front - bevel, front, trim, false, stone);
  panelSurface(batch, point, edge, [], rear, color, stone, 0, true);
  if (!faceOpen) panelSurface(batch, point, rim, [], front, color, stone);
}

function inscribe(batch, point, site, finish) {
  const { width, height, bottom, front, radius } = site.plate;
  const rim = roundedPanel(width, height, radius, bottom);
  const edge = roundedPanel(width + .17, height + .17, radius + .04, bottom - .085);
  const glyphs = strokes[site.id].map(shape => shape.map(ring => upright(ring.map(([u, y]) => [
    width * (u / 1000 - .5), bottom + height * (1 - y / 1000),
  ]))));
  const raised = finish.relief > 0;
  stoneSlab(batch, point, rim, edge, front - finish.thickness, front, finish.stone, finish.rim, true);
  panelSurface(batch, point, rim, raised ? [] : glyphs.map(([outline]) => outline), front, finish.stone, carvedFace, finish.texture);
  for (const [outline, ...counters] of glyphs) {
    const depth = front + finish.relief;
    panelSurface(batch, point, outline, counters, depth, finish.letter, carvedFace);
    panelEdges(batch, point, outline, outline, Math.min(depth, front), Math.max(depth, front), finish.edge, !raised);
    for (const inner of counters) {
      panelEdges(batch, point, inner, inner, Math.min(depth, front), Math.max(depth, front), finish.edge, raised);
      if (!raised) panelSurface(batch, point, inner, [], front, finish.stone, carvedFace, finish.texture);
    }
  }
}

function masonry(batch, frame, base, layers) {
  let bottom = base;
  for (const [top, width, depth, color, texture = 0] of layers) {
    prism(batch, rect(frame, 0, 0, width, depth), bottom, base + top, color, color, stone, texture, 0, stone);
    bottom = base + top;
  }
}

function gardenBed(batch, frame, base, { v, width, depth, seed }) {
  const rng = randomSource(seed);
  const leaves = ['#425a31', '#5d753a', '#667d40', '#788949', '#526936'];
  const petals = ['#9a3d4c', '#b04460', '#bd6270'];
  const ring = rect(frame, 0, v, width + .3, depth + .25);
  prism(batch, ring, base - .12, base + .13, '#978576', '#a89783', stone);
  for (let i = 0; i < Math.ceil(width / .47); i++) {
    const x = -width / 2 + .18 + i * .465 + (rng() - .5) * .14;
    const z = v + (rng() - .5) * depth * .30;
    const h = .36 + rng() * .25, rx = .35 + rng() * .18, rz = depth * (.31 + .06 * rng());
    const turn = rng() * TAU;
    const layers = [[.04, .69], [.45, 1], [.79, .81], [1, .37]].map(([lift, s]) =>
      ellipse(frame, x, z, rx * s, rz * s, 8, turn).map((p, j) => up(p, base + .14 + h * lift + .065 * Math.cos(j * 2.7 + turn))));
    for (let row = 1; row < layers.length; row++) {
      const lower = layers[row - 1], upper = layers[row];
      for (let j = 0; j < upper.length; j++) {
        const k = (j + 1) % upper.length;
        const tint = leaves[(i + 2 * j + row) % leaves.length];
        batch.face([lower[j], upper[j], upper[k], lower[k]], tint);
      }
    }
    batch.top(layers.at(-1), leaves[(i + 2) % leaves.length]);
    if (rng() > .34) {
      for (const [dx, dz] of [[-.12, 0], [.08, .06], [.02, -.13]]) {
        const bloom = ellipse(frame, x + dx, z + dz, .07 + rng() * .04, .065, 5, rng() * TAU);
        batch.top(bloom.map(p => up(p, base + .20 + h)), petals[Math.floor(rng() * petals.length)]);
      }
    }
  }
}

function landscapedVerge(batch, geo, frame, radius, tint) {
  const edge = ellipse(frame, 0, 0, ...radius, 22);
  const top = p => up(p, geo.heightAt(...p) + .16);
  const center = top(frame(0, 0));
  edge.forEach((p, i) => batch.top([center, top(p), top(edge[(i + 1) % edge.length])], tint));
}

function buildXianganPlaque(batch, geo, site, base, point, index) {
  const { frame } = site;
  landscapedVerge(batch, geo, frame, [8.3, 11.85], '#6b794c');
  const plinth = rect(frame, 0, 0, 5.15, 2.82);
  foundation(batch, geo, plinth, base + .16, '#9b9a8c', '#b8b4a4');
  masonry(batch, frame, base + .16, [
    [.24, 4.92, 2.65, '#b8b5a8'], [11.70, 4.63, 2.32, '#c9c7b9', 1],
    [11.92, 4.92, 2.49, '#c0bfb1'], [12.53, 3.66, 1.83, '#bcbbae', 1],
  ]);
  const rim = roundedPanel(8.82, 2.79, .25, 12.47), edge = roundedPanel(9, 3, .27, 12.36);
  stoneSlab(batch, point, rim, edge, -.70, .43, '#c6c5b7', '#d8d4c5');
  inscribe(batch, point, site, { thickness: .24, relief: -.035,
    stone: '#e6dfd4', rim: '#e3dccb', letter: '#bb302a', edge: '#76201f' });
  gardenBed(batch, frame, base, { v: 2.02, width: 6.8, depth: 1.26, seed: 326 });
  index.add(rect(frame, 0, 0, 4.65, 2.35), base + 12.69);
  index.add(rect(frame, 0, 0, 9.1, 1.47), base + 15.45);
}

function buildJimeiPlaque(batch, geo, site, base, point, index) {
  const { frame } = site;
  landscapedVerge(batch, geo, frame, [9.7, 10.9], '#65794f');
  const plinth = rect(frame, 0, 0, 10.3, 7.2);
  foundation(batch, geo, plinth, base + .31, '#8a6a5d', '#a68c81', stone);
  const layers = [[.31, .44, 3.27, 2.49], [.44, .60, 2.99, 2.28], [.60, .80, 2.67, 2.09]];
  for (const [bottom, top, rx, rz] of layers) {
    const ring = ellipse(frame, 0, 0, rx, rz, 44);
    prism(batch, ring, base + bottom, base + top, '#876354', '#a28577', stone);
  }
  // Fine vertical flutes were cut into the reddish cylindrical pedestal.
  const columns = 88, radius = [2.46, 1.74];
  const foot = Array.from({ length: columns * 2 }, (_, i) => {
    const a = i * TAU / (columns * 2), flute = i % 2 ? 1 : .982;
    return frame(Math.cos(a) * radius[0] * flute, Math.sin(a) * radius[1] * flute);
  });
  for (let i = 0; i < foot.length; i++) {
    const a = foot[i], b = foot[(i + 1) % foot.length];
    batch.face([up(a, base + .80), up(a, base + 4.03), up(b, base + 4.03), up(b, base + .80)], '#8b6a60', stone);
  }
  inscribe(batch, point, site, { thickness: 1.04, relief: -.045,
    stone: '#e0d7ce', rim: '#e3dbcc', letter: '#b52c25', edge: '#751c19' });
  gardenBed(batch, frame, base, { v: 4.48, width: 12.1, depth: 1.72, seed: 21 });
  index.add(ellipse(frame, 0, 0, radius[0], radius[1]), base + 4.03);
  index.add(rect(frame, 0, 0, 9.12, 1.1), base + 7.01);
}

function buildXiamenPlaque(batch, geo, site, base, point, index) {
  const { frame } = site;
  const court = rect(frame, 0, 3.36, 17.10, 8.90);
  foundation(batch, geo, court, base + .42, '#997e70', '#a8947d', 22);
  masonry(batch, frame, base + .41, [
    [.24, 14.45, 2.62, '#8f7266'], [.93, 13.71, 1.62, '#9a6b5d'],
  ]);
  inscribe(batch, point, site, { thickness: 1.64, relief: .090, texture: 2,
    stone: '#9e6d5e', rim: '#a8796a', letter: '#e8bd70', edge: '#9d733d' });
  gardenBed(batch, frame, base + .42, { v: 1.64, width: 14.45, depth: 1.20, seed: 105 });
  gardenBed(batch, frame, base + .42, { v: 6.62, width: 15.3, depth: 1.25, seed: 12 });
  index.add(rect(frame, 0, 0, 13.78, 1.7), base + 4.60);
}

function buildGaojiStele(batch, geo, site, base, point, index) {
  const { frame, plate: p } = site;
  const plaza = rect(frame, 0, 1.65, 13.4, 13.1);
  foundation(batch, geo, plaza, base + .13, '#9c8b74', '#b5a78c', 22);
  masonry(batch, frame, base, [
    [.27, 5.70, 5.72, '#a59a80'], [.43, 5.32, 5.35, '#b8aa8e'], [.60, 4.94, 4.97, '#b1a184'],
    [.80, 2.92, 2.90, '#aa997b'], [.93, 2.64, 2.66, '#b5a68a'], [1.04, 2.44, 2.44, '#a79377'],
    [1.73, 2.31, 2.31, '#a7977f', 1], [1.88, 2.37, 2.37, '#b5a487'], [2.03, 2.59, 2.59, '#a7977d'],
    [2.15, 2.68, 2.67, '#b9a789'], [2.29, 2.22, 2.22, '#a9957a'], [2.43, 1.89, 1.89, '#b8a487'],
    [2.58, 1.64, 1.66, '#a79072'], [2.70, 1.47, 1.47, '#ad997c'], [2.82, 1.22, 1.22, '#b6a383'],
    [5.23, 1.06, .86, '#ab9a7b'], [5.41, 1.10, 1.11, '#ad9b7d'], [5.75, 1.22, 1.27, '#b3a085'],
    [5.90, 1.26, 1.30, '#a69376'], [6.03, 1.40, 1.42, '#baa88e'], [6.15, 1.44, 1.46, '#b7a389'],
    [6.45, 1.20, 1.20, '#ac9c84', 1], [6.50, 1.11, 1.11, '#b6a48a'],
  ]);
  inscribe(batch, point, site, { thickness: .092, relief: -.027,
    stone: '#baaa8e', rim: '#b1a086', letter: '#6c5b43', edge: '#685741' });
  for (const u of [-.48, .48]) {
    const side = rect(frame, u, .459, .105, .10);
    prism(batch, side, base + p.bottom, base + p.bottom + p.height, '#ad9a7c', '#b5a386', stone);
  }
  for (const u of [-5.91, 5.91]) {
    for (const v of [-3.85, -.98, 1.9, 4.78]) {
      const post = rect(frame, u, v, .37, .39);
      prism(batch, post, base + .13, base + .92, '#a89a82', '#bcaf96', stone);
    }
    for (const v of [-2.415, .46, 3.34])
      prism(batch, rect(frame, u, v, .18, 2.83), base + .57, base + .74, '#b4a587', '#beaf94', stone);
  }
  gardenBed(batch, frame, base + .13, { v: -4.0, width: 11.5, depth: 1.03, seed: 130 });
  index.add(rect(frame, 0, 0, 2.9, 2.9), base + 2.15);
  index.add(rect(frame, 0, 0, 1.5, 1.5), base + 6.50);
}

const builders = {
  xiangan: buildXianganPlaque,
  jimei: buildJimeiPlaque,
  'xiamen-bridge': buildXiamenPlaque,
  gaoji: buildGaojiStele,
};

export function buildNorthInscription(batch, geo, index, site) {
  const base = geo.heightAt(...site.center);
  const point = (u, y, v) => up(site.frame(u, v), base + y);
  builders[site.id](batch, geo, site, base, point, index);
}

