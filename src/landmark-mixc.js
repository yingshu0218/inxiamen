import { groundY, litSurface, mix, prism } from './scenery-mesh.js';
import { ellipse, localFrame, rect, up } from './landmark-forms.js';
import { measuredPath } from './old-town-layout.js';
import { pathTube } from './landmark-haicang.js';
import { mixc, mixcLink, mixcNorth, mixcNorthFrame, mixcSouthPlaza, mixcStationCanopy, mixcStationKiosk,
  mixcTowers } from './downtown-landmark-layout.js';

const stone = '#b2aaa0';
const champagne = '#a3947c';
const storefront = '#66878a';
const roof = '#9a9e96';

function podium(batch, geo, ring, base, floors) {
  const bottom = Math.min(...ring.map((p) => groundY(geo, ...p))) - .5;
  prism(batch, ring, bottom, base + .6, '#a9a094', null, litSurface.graniteFacing);
  prism(batch, ring, base + .6, base + 6.8, storefront, null, litSurface.shopfront, .74);
  let y = base + 6.8;
  for (const [height, color] of floors) {
    prism(batch, ring, y, y + .42, champagne, null, litSurface.crownMetal);
    prism(batch, ring, y + .42, y + height, color, null, litSurface.ribbedReturn, .66);
    y += height;
  }
  prism(batch, ring, y, y + .85, '#c0bcb0', roof, litSurface.railEave, .64, 0, 22);
  return y + .85;
}

function glazedBay(batch, a, b, y, height, columns, rows) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const at = (s, t, outset = .22) => [
    mix(a[0], b[0], s) - dz / length * outset,
    y + height * t,
    mix(a[1], b[1], s) + dx / length * outset,
  ];
  const panel = (s0, s1, t0, t1, color, style = 0, outset) => batch.face(
    [at(s0, t0, outset), at(s0, t1, outset), at(s1, t1, outset), at(s1, t0, outset)],
    color, style, .58, [[s0 * length, t0 * height], [s0 * length, t1 * height],
      [s1 * length, t1 * height], [s1 * length, t0 * height]]
  );
  panel(0, 1, 0, 1, '#73979d', litSurface.railGlass);
  for (let i = 0; i <= columns; i++) {
    const d = i / columns;
    panel(Math.max(0, d - .004), Math.min(1, d + .004), 0, 1, '#a39986', litSurface.crownMetal, .28);
  }
  for (let i = 1; i < rows; i++) {
    const d = i / rows;
    panel(0, 1, d - .006, d + .006, '#9a9288', litSurface.crownMetal, .28);
  }
}

function officeTower(batch, ring, base, top, seed, obstacles, lamps) {
  const centre = [0, 1].map((axis) => ring.reduce((sum, vertex) => sum + vertex[axis], 0) / ring.length);
  const layer = (scale) => ring.map(([x, z]) => [
    mix(centre[0], x, scale), mix(centre[1], z, scale),
  ]);
  const panels = layer(1.006);
  const mullions = layer(1.013);
  const west = Math.min(...ring.map(([x]) => x));
  const roofHeight = ([x]) => top - (x - west) * .085;
  const glass = ['#557583', '#597d8b', '#64848e', '#526d7b', '#6a8c95', '#577c8b'];
  for (let i = 0; i < ring.length; i++) {
    const next = (i + 1) % ring.length;
    const a = panels[i], b = panels[next];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const y0 = roofHeight(a), y1 = roofHeight(b);
    batch.face([up(a, base), up(a, y0 - 1), up(b, y1 - 1), up(b, base)],
      glass[i], litSurface.office, seed, [[0, 0], [0, y0 - base], [len, y1 - base], [len, 0]]);
    batch.face([up(a, y0 - 1.2), up(a, y0), up(b, y1), up(b, y1 - 1.2)], '#c2b6a2', litSurface.crownMetal);
    const bays = Math.ceil(len / 3.4);
    const u = mullions[i], v = mullions[next];
    const at = (d) => [mix(u[0], v[0], d), mix(u[1], v[1], d)];
    for (let j = 0; j < bays; j++) {
      const q = at(j / bays), r = at((j + .09) / bays);
      batch.face([up(q, base), up(q, roofHeight(q) - 1), up(r, roofHeight(r) - 1), up(r, base)],
        '#8b9c9b', litSurface.crownMetal);
    }
    lamps.add(...up(a, y0 - .25), '#ffecc4', 1.45);
  }
  batch.top(panels.map((p) => up(p, roofHeight(p))), '#a2a9a5', litSurface.railRoof);
  const service = localFrame(centre, -.27);
  prism(batch, rect(service, 0, 0, 13, 9), roofHeight(centre) - 1.1, roofHeight(centre) + 2.2,
    '#8b9697', '#b2bbb6', litSurface.crownMetal);
  obstacles.add(ring, top + 2.2);
}

function skylight(batch, [x, z], y, radius, garden) {
  const xy = localFrame([x, z], -.26);
  if (garden) {
    const outer = ellipse(xy, 0, 0, radius + 12, radius + 6, 28);
    prism(batch, outer, y, y + .38, '#b4a58d', '#7d8e56', litSurface.paleStone);
    for (const [u, v] of [[-13, 0], [-7, 6], [7, -7], [15, 1]]) {
      prism(batch, ellipse(xy, u, v, 2.1, 1.55, 10), y + .38, y + 1.1, '#69814d', '#849960');
    }
  }
  const rim = ellipse(xy, 0, 0, radius + .85, radius, 24);
  const inset = ellipse(xy, 0, 0, radius * .34, radius * .32, 24);
  prism(batch, rim, y, y + 1.1, '#bfc0b4', null, litSurface.railEave);
  for (let i = 0; i < rim.length; i++) {
    const j = (i + 1) % rim.length;
    batch.top([up(rim[i], y + 1.1), up(rim[j], y + 1.1), up(inset[j], y + 3.3), up(inset[i], y + 3.3)],
      i % 2 ? '#94adac' : '#a2b8b6', litSurface.railGlass);
  }
  batch.top(inset.map((p) => up(p, y + 3.3)), '#bfd0c7', litSurface.railGlass);
}

function connectingBridge(batch, y, obstacles, lamps) {
  const path = measuredPath(mixcLink);
  const rows = path.sections(3.35);
  const bottom = y - .72, top = y + 4.15, halfWidth = 3.05;
  const p = (row, d, h) => [row.x + row.rx * d, h, row.z + row.rz * d];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    for (const [h, shade] of [[y, '#c5b5a0'], [top, '#cdd1ca']]) {
      batch.top([p(a, -halfWidth, h), p(b, -halfWidth, h), p(b, halfWidth, h), p(a, halfWidth, h)], shade, litSurface.railEave);
    }
    for (const side of [-1, 1]) {
      const d = side * halfWidth;
      for (const [low, high, color, style] of [
        [bottom, y + .25, '#ad9381', litSurface.railEave],
        [y + .25, top - .36, '#91aba5', litSurface.railGlass],
        [top - .36, top, '#d2d4c8', litSurface.railEave],
      ]) {
        batch.face([p(a, d, low), p(a, d, high), p(b, d, high), p(b, d, low)], color, style,
          .61, [[a.s, 0], [a.s, high - low], [b.s, high - low], [b.s, 0]]);
      }
      const joint = (h) => p(a, d + side * .08, h);
      const next = (h) => [mix(a.x, b.x, .055) + a.rx * (d + side * .08), h,
        mix(a.z, b.z, .055) + a.rz * (d + side * .08)];
      batch.face([joint(y), joint(top), next(top), next(y)], '#b6a18b', litSurface.crownMetal);
    }
    batch.face([p(a, -halfWidth, bottom), p(b, -halfWidth, bottom), p(b, halfWidth, bottom), p(a, halfWidth, bottom)],
      '#a9a89f', litSurface.crownMetal);
    obstacles.add([p(a, -halfWidth, y), p(b, -halfWidth, y), p(b, halfWidth, y), p(a, halfWidth, y)]
      .map(([x, , z]) => [x, z]), top);
    if (i % 4 === 0) lamps.add(b.x, y + 3, b.z, '#ffe2b1', 1.6);
  }
  const main = measuredPath(mixcLink.slice(0, 2));
  for (const offset of [-2.45, 2.45]) {
    const tie = main.sections(5.6).map(row => p(row, offset, bottom - 1.24 * Math.sin(Math.PI * row.s / main.length)));
    pathTube(batch, tie, .115, '#a4a69e', 6, litSurface.crownMetal);
    for (const point of tie.slice(1, -1)) {
      pathTube(batch, [point, [point[0], bottom, point[2]]], .077, '#a4a69e', 5, litSurface.crownMetal);
    }
  }
}

function northPodium(batch, geo, base, obstacles, lamps, signs) {
  const xy = mixcNorthFrame;
  const top = podium(batch, geo, mixcNorth, base,
    [[5.9, '#a28170'], [5.5, '#a57e66'], [5.2, '#996b52']]);
  const level = top - 12.2;
  // Recessed glazing separates the terracotta volumes on the road frontage.
  for (const [a, b] of [[mixcNorth[7], mixcNorth[8]], [mixcNorth[9], mixcNorth[8]],
    [mixcNorth[6], mixcNorth[5]]]) {
    glazedBay(batch, a, b, base + .75, top - base - 2.25, 9, 6);
  }
  for (const [a, b] of [[mixcNorth[7], mixcNorth[6]], [mixcNorth[10], mixcNorth[11]],
    [mixcNorth[12], mixcNorth[0]]]) {
    const xz = localFrame(a, Math.atan2(b[1] - a[1], b[0] - a[0]));
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    prism(batch, rect(xz, len / 2, .28, len, 1.35), level - .38, level, '#594d42', null, litSurface.crownMetal);
    for (let u = 1; u < len - 1; u += 1.38) {
      prism(batch, rect(xz, u, .29, .26, .78), level, top + .5, '#b68161', null, litSurface.crownMetal);
    }
    prism(batch, rect(xz, len / 2, .18, len, .7), top + .38, top + .94, '#8a6650', null);
  }
  for (const [u, v, w, d] of [[-36, 24, 22, 17], [0, -18, 26, 18], [63, 1, 23, 24]]) {
    prism(batch, rect(xy, u, v, w, d), top, top + .42, '#afa79b', '#849469', litSurface.paleStone);
  }
  for (const [u, v] of [[-59, 10], [36, 23]]) skylight(batch, xy(u, v), top, 5.4, false);
  for (const [u, v, w, d, height] of [[-62,-27,37,26,179], [34,-21,41,25,198], [5,16,39,26,187]]) {
    const ring = rect(xy, u, v, w, d);
    const towerTop = base + height;
    prism(batch, ring, top, towerTop - .85, '#617278', '#a2a8a3', litSurface.office, .58, 0, litSurface.railRoof);
    for (const offset of [-.45, -.23, .23, .45]) for (const side of [-1, 1]) {
      const rib = rect(xy, u + w * offset, v + side * (d / 2 + .13), offset > .3 ? .55 : .32, .58);
      prism(batch, rib, top + 2.8, towerTop - .78, '#b3a797', null, litSurface.crownMetal);
    }
    prism(batch, ring, towerTop - .85, towerTop, '#c2b4a1', '#a9aaa0', litSurface.railEave);
    prism(batch, rect(xy, u, v - 2, w * .59, d * .55), towerTop, towerTop + 1.92,
      '#9d9c93', '#b6b6a8', litSurface.crownMetal);
    lamps.add(...up(xy(u + w / 2, v + d / 2), towerTop), '#fce1b0', 1.32);
    obstacles.add(ring, towerTop + 1.92);
  }
  signs.push({ label: '厦门万象城', a: [-1969.2, 345.4], b: [-1974.7, 350.4],
    y: top - 5.2, height: 1.55, ink: '#fbebd1' });
  obstacles.add(mixcNorth, top + .94);
}

function stationForecourt(batch, geo, obstacles) {
  const xy = localFrame([-1934, 311], -.285);
  const level = Math.max(...mixcStationCanopy.map(p => groundY(geo, ...p)));
  const roadHeight = Math.max(...mixcStationKiosk.map(p => groundY(geo, ...p)));
  prism(batch, mixcStationKiosk, roadHeight - .42, roadHeight + 3.9,
    '#b9b7a9', '#9e9f96', litSurface.shopfront);
  prism(batch, mixcStationCanopy, level + 4.8, level + 5.05, '#cecfbd', null);
  prism(batch, mixcStationCanopy, level + 5.05, level + 5.62, '#aa5149', '#735b52', litSurface.crownMetal);
  for (const u of [-12, -4, 5, 13]) {
    prism(batch, rect(xy, u, 0, .58, .61), level - .25, level + 4.8, '#c1c2b5', null);
  }
  obstacles.add(mixcStationCanopy, level + 5.62);
  obstacles.add(mixcStationKiosk, roadHeight + 3.9);
}

export function buildMixc(batch, geo, lamps, obstacles, signs) {
  const base = Math.max(...mixc.flat().map((p) => groundY(geo, ...p))) + .25;
  const northBase = Math.max(...mixcNorth.map((p) => groundY(geo, ...p))) + .25;
  const westRoof = podium(batch, geo, mixc[0], base, [[6.1, stone], [6, '#9b9388'], [5.4, '#aca296']]);
  const mallRoof = podium(batch, geo, mixc[1], base, [[5.3, '#a8a698'], [6.1, '#909a98'],
    [5.2, '#b2aaa0'], [6.4, '#959d9a'], [4.3, '#9e9e92']]);
  northPodium(batch, geo, northBase, obstacles, lamps, signs);
  stationForecourt(batch, geo, obstacles);
  const plazaLevel = Math.max(...mixcSouthPlaza.map((p) => groundY(geo, ...p))) + .15;
  prism(batch, mixcSouthPlaza, plazaLevel - 1.9, plazaLevel, '#94988e', '#bdb4a6', litSurface.stone, .66, 0, 17);
  glazedBay(batch, [-1859.8, 483.4], [-1845.6, 456.2], base + .85, 26.4, 7, 6);
  glazedBay(batch, [-1812, 622.2], [-1803.1, 602.4], base + 1, 23.5, 6, 5);
  glazedBay(batch, [-1802, 636.9], [-1801.4, 644.7], base + .95, 20.5, 2, 4);
  glazedBay(batch, [-1889, 676.2], [-1861, 668.35], base + 1.2, 18.9, 7, 4);
  glazedBay(batch, [-1897.5, 400.4], [-1915.2, 392.8], base + 1.1, 20.9, 6, 4);
  for (const [x, z, radius, garden] of [
    [-1892, 444, 9.8, false], [-1903, 545, 10.8, true], [-1837, 628, 10.5, false],
  ]) skylight(batch, [x, z], mallRoof, radius, garden);
  for (const [i, ring] of mixcTowers.entries()) {
    officeTower(batch, ring, base + 1, base + [167.4, 109.85][i], .43 + i * .23, obstacles, lamps);
  }
  connectingBridge(batch, Math.max(base, northBase) + 12.5, obstacles, lamps);
  signs.push({ label: '厦门万象城', a: [-1835.5, 659.2], b: [-1813.5, 650.1],
    y: base + 23.5, height: 2.7, ink: '#f0d9a8' });
  obstacles.add(mixc[0], westRoof);
  obstacles.add(mixc[1], mallRoof + 3.3);
}
