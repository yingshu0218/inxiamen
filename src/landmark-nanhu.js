import { cylinder, groundY, litSurface, mix, prism, randomSource, TAU } from './scenery-mesh.js';
import { ellipse, localFrame, rect, sweptRoof, up } from './landmark-forms.js';
import { measuredPath, ribbon } from './old-town-layout.js';
import { nanhuBridgeWalks, nanhuCrossing, nanhuGardenBridges, nanhuPavilion, peachIsland } from './downtown-landmark-layout.js';

const sandstone = '#b9a992';
const rail = '#d2c3a7';

function lakePavilion(batch, geo, lamps, obstacles) {
  const xy = localFrame(nanhuPavilion, .17);
  const base = Math.max(1.2, groundY(geo, ...nanhuPavilion) + .33);
  const terrace = ellipse(xy, 0, 0, 9.2, 7.3, 20);
  prism(batch, terrace, -.42, base, '#9c957d', '#b9b3a1', litSurface.stone);
  prism(batch, rect(xy, .25, 0, 11.45, 8.35), base, base + .45, '#dbd2bd', '#c9bfab', litSurface.paleStone);
  prism(batch, rect(xy, 1.4, 0, 5.25, 6.7), base + 3.35, base + 3.73, '#e4dcc9', '#bbb5a7', litSurface.paleStone);
  for (const [u, width, roofHeight] of [[-2.32, 4.9, 3.9], [1.4, 6.15, 6.8]]) {
    const colU = u - width / 2 + .55, end = u + width / 2 - .5;
    for (const x of [colU, end]) for (const z of [-3.14, 0, 3.14]) {
      prism(batch, rect(xy, x, z, .34, .33), base + .45, base + roofHeight,
        '#e1ded0', null, litSurface.paleStone);
      if (roofHeight > 5) prism(batch, rect(xy, x, z, .66, .65),
        base + .45, base + .91, '#d5c9b1', null, litSurface.paleStone);
    }
    sweptRoof(batch, xy, u, 0, width, 7.8, base + roofHeight, 1.85,
      '#848e86', '#d0cfc0', .28);
    lamps.add(...up(xy(u, -2.6), base + 2.5), '#fff0c8', .78);
    lamps.add(...up(xy(u, 2.6), base + 2.5), '#fff0c8', .78);
  }
  for (const v of [-3.12, 3.12]) {
    for (const [u, y, width] of [[-2.5, 1.39, 4.25], [1.45, 1.39, 5.05], [1.45, 4.64, 5.05]]) {
      prism(batch, rect(xy, u, v, width, .14), base + y, base + y + .11, '#d4cebb', null);
    }
  }
  const path = measuredPath([xy(7.4, 0), [-2377, -76], [-2370, -68], [-2359, -63]]);
  ribbon(batch, path.sections(2.8), -.92, .92, (x, z, s) =>
    mix(base, Math.max(.94, groundY(geo, x, z) + .17), s / path.length), '#c0b099', 22);
  obstacles.add(terrace, base + 8.9);
}

function stoneBridge(batch, a, b, main, lamps, obstacles) {
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const xy = localFrame(a, Math.atan2(b[1] - a[1], b[0] - a[0]));
  const halfWidth = main ? 1.38 : 1.02;
  const deck = (t) => 1.27 + (main ? 2.05 : .47) * Math.sin(Math.PI * t);
  const underside = (t) => main ? -.58 + 2.78 * Math.sin(Math.PI * t) ** .62 : deck(t) - .42;
  const p = (t, d, y) => up(xy(t * (span + 2.8) - 1.4, d), y);
  const joints = main ? 22 : 10;
  for (let i = 1; i <= joints; i++) {
    const t = (i - 1) / joints, next = i / joints;
    batch.top([p(t, -halfWidth, deck(t)), p(next, -halfWidth, deck(next)),
      p(next, halfWidth, deck(next)), p(t, halfWidth, deck(t))], '#cec0a8', litSurface.stone);
    batch.face([p(t, -halfWidth, underside(t)), p(t, halfWidth, underside(t)),
      p(next, halfWidth, underside(next)), p(next, -halfWidth, underside(next))], '#978775');
    for (const side of [-halfWidth, halfWidth]) {
      batch.face([p(t, side, underside(t)), p(t, side, deck(t)), p(next, side, deck(next)),
        p(next, side, underside(next))], sandstone, litSurface.graniteFacing);
      batch.face([p(t, side, deck(t) + .76), p(t, side, deck(t) + .93),
        p(next, side, deck(next) + .93), p(next, side, deck(next) + .76)], rail, litSurface.paleStone);
      if (i % 2) prism(batch, rect(xy, t * (span + 2.8) - 1.4, side, .24, .21),
        deck(t), deck(t) + 1.01, rail, '#e3d5b9', litSurface.paleStone);
    }
  }
  if (main) for (const u of [0, span]) {
    lamps.add(...up(xy(u, -halfWidth), 2.55), '#f9eacb', .86);
  }
  obstacles.add(rect(xy, span / 2, 0, span + 2.8, halfWidth * 2), deck(.5) + 1.01);
}

const walkHeight = (geo, x, z) => Math.max(.96, groundY(geo, x, z) + .1);

function creekBridge(batch, geo, lamps, obstacles) {
  const path = measuredPath(nanhuCrossing), rows = path.sections(.45);
  const [a, b] = nanhuCrossing;
  const west = walkHeight(geo, ...a) + .16, east = walkHeight(geo, ...b) + .16;
  const xy = localFrame(a, Math.atan2(b[1] - a[1], b[0] - a[0]));
  const height = (x, z, s) => {
    const t = s / path.length;
    return mix(west, east, t) + .52 * Math.sin(Math.PI * t);
  };
  for (const [at, direction, level] of [[0, -1, west], [path.length, 1, east]]) {
    const pad = rect(xy, at + direction * 1.6, 0, 3.55, 4.9);
    prism(batch, pad, -.52, level, '#a6a59a', '#c6c1b1', litSurface.paleStone);
    for (const side of [-1, 1]) {
      const cheek = rect(xy, at + direction * .7, side * 2.16, 2.6, .43);
      prism(batch, cheek, -.52, level + .27, '#a7a69a', '#c1baab', litSurface.graniteFacing);
    }
  }
  ribbon(batch, rows, -1.7, 1.7, height, '#9e7f63', litSurface.stone);
  const faceAt = (row, side, y) => [row.x + row.rx * side, height(row.x, row.z, row.s) + y, row.z + row.rz * side];
  const wave = (t, side) => .92 + .53 * Math.sin(Math.PI * 2 * t - side * .37) ** 2
    + .28 * Math.sin(Math.PI * t);
  for (let i = 1; i < rows.length; i++) {
    const p = rows[i - 1], q = rows[i], along = p.s / path.length;
    for (const side of [-1, 1]) {
      const w = side * 1.73;
      batch.face([faceAt(p, w, -.42), faceAt(p, w, .06), faceAt(q, w, .06), faceAt(q, w, -.42)],
        '#9ea8a2', litSurface.crownMetal);
      const finWidth = { ...p, x: mix(p.x, q.x, .74), z: mix(p.z, q.z, .74) };
      for (const [low, high, inset, outset] of [[.04, .54, 0, .09], [.54, 1, .09, -.13]]) {
        const top = wave(along, side);
        batch.face([faceAt(p, w + side * inset, low * top), faceAt(p, w + side * outset, high * top),
          faceAt(finWidth, w + side * outset, high * top), faceAt(finWidth, w + side * inset, low * top)],
          i % 5 === 0 ? '#d5d8d1' : '#b8c8c9', litSurface.crownMetal);
      }
      if (i % 3 === 1) {
        const x = p.x + p.rx * side * 1.72, z = p.z + p.rz * side * 1.72;
        const y = height(p.x, p.z, p.s) + .07;
        cylinder(batch, x, z, y, y + .31, .075, .24, '#678352', 5, 0, i % 2 ? '#bd7189' : '#a84673');
      }
      if (i % 9 === 3) lamps.add(...faceAt(p, w - side * .15, .33), '#ffe2aa', .6);
    }
  }
  obstacles.add(rect(xy, path.length / 2, 0, path.length, 3.8), Math.max(west, east) + 2.3);
}

function garden(batch, lamps) {
  const top = 1.16;
  prism(batch, peachIsland, -.48, top, '#9e9a7b', '#859d69', litSurface.stone, 0, 0, 17);
  const walk = measuredPath([
    [-2466, -50.2], [-2472, -61], [-2481, -76], [-2491, -94], [-2482, -109],
    [-2477, -124], [-2468, -137], [-2460, -126], [-2448, -110], [-2447, -91],
    [-2455, -75], [-2472, -61],
  ]);
  ribbon(batch, walk.sections(2.6), -1, 1, () => top + .055, '#baad91', litSurface.stone);
  const branch = measuredPath([[-2496, -95.7], [-2491, -94]]);
  ribbon(batch, branch.sections(2.6), -.94, .94, () => top + .055, '#baad91', litSurface.stone);
  const rng = randomSource(4108);
  for (const [x, z] of [[-2461, -69], [-2475, -76], [-2456, -86], [-2468, -93],
    [-2482, -95], [-2463, -108], [-2451, -110], [-2467, -119], [-2479, -116]]) {
    const y = top + 2.7 + .6 * rng();
    cylinder(batch, x, z, top, y, .15, .09, '#8e735f', 6);
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + .42 * rng(), r = 1.5 + rng();
      const cx = x + Math.cos(a) * 1.3, cz = z + Math.sin(a) * 1.4;
      const mid = y + .07 + .93 * rng();
      cylinder(batch, cx, cz, mid - .92, mid, .52, r, '#a7788b', 7, a);
      cylinder(batch, cx, cz, mid, mid + 1.32, r, .51,
        i % 2 === 0 ? '#cea2b0' : '#b8899b', 7, a, '#dbb3bd');
    }
  }
  for (const [x, z] of [[-2475, -57], [-2488, -81], [-2484, -120], [-2451, -82]]) {
    cylinder(batch, x, z, top, top + 2.13, .075, .052, '#60665a', 7);
    lamps.add(x, top + 2.17, z, '#ffe9c7', .7);
  }
}

function lakefrontPaths(batch, geo, obstacles) {
  const gardenPath = [[-2548, -124], [-2531, -113], [-2519, -106], [-2511.2, -96.5]];
  for (const points of [gardenPath, ...nanhuBridgeWalks]) {
    const path = measuredPath(points);
    const halfWidth = points === gardenPath ? .83 : 1.38;
    ribbon(batch, path.sections(2.4), -halfWidth, halfWidth, (x, z) => walkHeight(geo, x, z),
      '#baa88f', 22);
  }
  for (const [x, z, w, d, angle, roof] of [
    [-2539, -112, 12.4, 21.5, -.24, '#779298'],
    [-2540, -173, 10.6, 14.3, -.28, '#8d9a8b'],
  ]) {
    const p = rect(localFrame([x, z], angle), 0, 0, w, d);
    const base = Math.max(.92, groundY(geo, x, z));
    prism(batch, p, base - .43, base + 3.15, '#bdb7a5', roof, litSurface.studioRibbon, .45, .9, litSurface.railRoof);
    obstacles.add(p, base + 4.1);
  }
}

export function buildNanhu(batch, geo, lamps, obstacles) {
  garden(batch, lamps);
  lakefrontPaths(batch, geo, obstacles);
  lakePavilion(batch, geo, lamps, obstacles);
  for (const [i, [a, b]] of nanhuGardenBridges.entries()) stoneBridge(batch, a, b, i === 0, lamps, obstacles);
  creekBridge(batch, geo, lamps, obstacles);
}
