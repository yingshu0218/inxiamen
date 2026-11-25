import { TAU, cylinder, groundY, litSurface, prism } from './scenery-mesh.js';
import { localFrame, ellipse, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';

// The mapped sculpture sits off the mainland bank of the tidal lake.
const statue = [-3642, 474],
  xy = localFrame(statue, 0.5);
const plazaPoint = xy(-67, 0),
  warmStone = '#cbb89a',
  kerb = '#c1b8a6';
export function parkReserved(x, z) {
  if (x < -3830 || x > -3627 || z < 340 || z > 525) return false;
  const u = (x - statue[0]) * Math.cos(0.5) + (z - statue[1]) * Math.sin(0.5);
  const v = -(x - statue[0]) * Math.sin(0.5) + (z - statue[1]) * Math.cos(0.5);
  if (u > -52 && u < 13 && Math.abs(v) < 11) return true;
  return ((u + 100) / 83) ** 2 + (v / 44) ** 2 < 1;
}
function walkPoint(u, v, geo, offset = 0.52) {
  const [x, z] = xy(u, v);
  return [x, Math.max(1.13, groundY(geo, x, z) + offset), z];
}
function groundRibbon(batch, geo, points, width, color) {
  let last;
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)],
      next = points[Math.min(points.length - 1, i + 1)],
      p = points[i];
    const du = next[0] - prev[0],
      dv = next[1] - prev[1],
      length = Math.hypot(du, dv) || 1;
    const left = walkPoint(p[0] - (width * dv) / length / 2, p[1] + (width * du) / length / 2, geo);
    const right = walkPoint(
      p[0] + (width * dv) / length / 2,
      p[1] - (width * du) / length / 2,
      geo
    );
    if (last) batch.top([last[0], last[1], right, left], color, 17);
    last = [left, right];
  }
}
function sculpture(batch, geo, index) {
  const p = (u, y, v) => up(xy(u, v), y);
  // Section lofts model the seated figure, tilted head and the locks gathered to one side.
  // Keeping contiguous surfaces also keeps the silhouette legible at the standard fly-by distance.
  const body = (layers, color, sides = 20, warp = 0, style = litSurface.paleStone) => {
    const rings = layers.map(([y, u, v, rx, rz]) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (TAU * i) / sides,
          shape = 1 + warp * (Math.sin(3 * a + 0.2) + 0.4 * Math.cos(5 * a));
        return p(u + rx * shape * Math.cos(a), y, v + rz * shape * Math.sin(a));
      })
    );
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < sides; i++) {
        const k = (i + 1) % sides;
        batch.face([rings[j - 1][i], rings[j][i], rings[j][k], rings[j - 1][k]], color, style);
      }
    batch.top(rings.at(-1), color, style);
  };
  const stone = '#ddd3ba',
    hair = '#a9a394',
    shadow = '#c3baa3';
  cylinder(batch, ...statue, -1.2, 1.23, 8.6, 8.6, '#998c7c', 36, 0, '#bdaf99');
  cylinder(batch, ...statue, 1.2, 1.62, 7.3, 7.15, '#b7aa92', 36);
  body(
    [
      [1.6, 0, 0, 5.0, 4.1],
      [2.65, -0.5, 0, 5.2, 4.0],
      [4.25, -0.1, 0.3, 4.65, 3.5],
      [5.15, 0.34, 0, 3.65, 2.45],
    ],
    '#a99e89',
    14,
    0.103
  );
  body(
    [
      [4.7, -0.32, 0.31, 2.16, 1.74],
      [5.4, -0.12, 0.53, 2.32, 1.68],
      [6.36, -0.32, 0.25, 1.92, 1.44],
      [7.31, -0.55, -0.2, 1.42, 1.02],
      [8.23, -0.45, -0.12, 1.19, 0.9],
      [9.33, -0.21, 0.03, 1.52, 0.96],
      [10.22, 0.05, 0.08, 1.63, 0.98],
      [10.62, 0.21, 0.15, 1.04, 0.7],
      [11.15, 0.35, 0.27, 0.54, 0.52],
    ],
    stone,
    24
  );
  body(
    [
      [4.8, 1.25, 1.0, 0.6, 0.72],
      [5.19, 1.65, 1.23, 1.05, 1.12],
      [5.95, 1.8, 1.4, 1.03, 0.84],
      [6.35, 1.61, 1.05, 0.82, 0.83],
      [6.64, 0.69, 0.54, 0.88, 0.65],
    ],
    stone
  );
  body(
    [
      [10.73, 0.42, 0.28, 0.44, 0.49],
      [11.05, 0.62, 0.43, 0.63, 0.65],
      [11.47, 0.63, 0.34, 0.83, 0.78],
      [12.02, 0.46, 0.1, 0.89, 0.79],
      [12.55, 0.22, -0.02, 0.71, 0.66],
      [12.78, 0.15, -0.1, 0.35, 0.34],
    ],
    stone
  );
  body(
    [
      [6.38, -1.11, -0.65, 0.38, 0.35],
      [7.5, -1.39, -0.64, 0.64, 0.55],
      [9.25, -1.29, -0.55, 0.74, 0.64],
      [10.65, -0.92, -0.52, 0.72, 0.65],
      [11.65, -0.22, -0.49, 0.8, 0.66],
      [12.46, 0.1, -0.31, 0.8, 0.67],
      [12.92, 0.05, -0.24, 0.42, 0.4],
    ],
    hair,
    20
  );
  const strand = (points, r, c, style = litSurface.paleStone) =>
    pathTube(
      batch,
      points.map((a) => p(...a)),
      r,
      c,
      10,
      style
    );
  for (let i = 0; i < 5; i++)
    strand(
      [
        [-0.1 + i * 0.13, 12.3, -0.85],
        [-0.64 + i * 0.09, 11.3, -0.94],
        [-1.35 + i * 0.14, 9.84, -0.96],
        [-1.63 + i * 0.13, 8.3, -1.03],
        [-1.1 + i * 0.06, 6.75, -0.69],
      ],
      0.075,
      '#b9b0a0'
    );
  strand(
    [
      [-1.18, 10.06, 0.06],
      [-1.69, 9.74, 0.42],
      [-2.15, 8.85, 1.0],
      [-2.1, 8.63, 1.14],
      [-1.48, 9.39, 1.38],
      [-1.03, 10.22, 0.88],
    ],
    (t) => 0.23 + 0.15 * Math.sin(Math.PI * t),
    stone
  );
  strand(
    [
      [1.29, 10.1, 0.24],
      [1.8, 9.66, 0.74],
      [2.02, 8.45, 1.05],
      [1.91, 8.08, 1.22],
      [1.1, 7.82, 1.6],
      [0.64, 7.82, 1.53],
    ],
    (t) => 0.23 + 0.16 * Math.sin(Math.PI * t),
    stone
  );
  strand(
    [
      [0.7, 11.9, 1.02],
      [0.79, 11.63, 1.24],
      [0.79, 11.52, 1.05],
    ],
    0.094,
    shadow
  );
  // Folded wings, a long recurved neck and a sharp bill make the shoulder bird read in profile.
  const bird = '#f0e8cd';
  body(
    [
      [10.65, 1.13, 0, 0.07, 0.12],
      [10.98, 1.3, -0.16, 0.43, 0.26],
      [11.35, 1.3, 0.01, 0.61, 0.37],
      [11.58, 1.44, 0.05, 0.3, 0.18],
    ],
    bird,
    14
  );
  strand(
    [
      [1.58, 11.34, 0.1],
      [1.84, 11.72, 0.12],
      [1.53, 12.17, 0.08],
      [1.46, 12.6, 0.08],
      [1.67, 12.86, 0.13],
      [1.89, 12.85, 0.17],
    ],
    (t) => 0.135 + 0.055 * Math.sin(t * Math.PI),
    bird
  );
  strand(
    [
      [1.86, 12.85, 0.17],
      [2.5, 12.74, 0.24],
    ],
    (t) => 0.12 * (1 - t) + 0.015,
    '#b4a278'
  );
  strand(
    [
      [1.16, 11.14, -0.19],
      [0.46, 10.82, -0.32],
      [0.14, 10.63, -0.4],
    ],
    (t) => 0.16 * (1 - t) + 0.03,
    bird
  );
  index.add(ellipse(xy, 0, 0, 5.3, 4.3, 14), 12.95);
}
function parkGardens(batch, geo, lamps) {
  // A pair of curving walks open towards the viewing terrace. Position plantings
  // inside the loops so the avenues survive both close and overhead views.
  const lawn = (i, j) => {
    const t = i / 35,
      extent = 8 + 29 * Math.sin(t * Math.PI) ** 0.67;
    return walkPoint(-177 + 117 * t, (extent * j) / 8, geo, 0.29);
  };
  for (let i = 0; i < 35; i++)
    for (let j = -8; j < 8; j++) {
      batch.top([lawn(i, j), lawn(i + 1, j), lawn(i + 1, j + 1), lawn(i, j + 1)], '#74905d');
    }
  for (const side of [-1, 1]) {
    const walk = [];
    for (let i = 0; i <= 46; i++) {
      const t = i / 46,
        u = -172 + 114 * t;
      walk.push([u, side * (7 + 22 * Math.sin(t * Math.PI))]);
    }
    groundRibbon(batch, geo, walk, 3.5, '#bcae92');
    const bed = [];
    for (let i = 0; i <= 40; i++) {
      const a = (TAU * i) / 40;
      bed.push([-115 + 48 * Math.cos(a), side * (14 + 8.2 * Math.sin(a))]);
    }
    groundRibbon(batch, geo, bed, 1.2, side === 1 ? '#87965b' : '#8a996b');
  }
  const middle = Array.from({ length: 37 }, (_, i) => [
    -174 + (111 * i) / 36,
    1.2 * Math.sin((i / 36) * TAU),
  ]);
  groundRibbon(batch, geo, middle, 4.8, '#cab99a');
  const y = Math.max(2.05, groundY(geo, ...plazaPoint) + 0.62),
    plaza = ellipse(xy, -65, 0, 19.5, 16, 64);
  prism(batch, plaza, -0.45, y, '#a59a86', '#cfbea0');
  for (const r of [7.6, 12.4, 15.2]) {
    const ring = ellipse(xy, -65, 0, r, r * 0.84, 64).map((p) => up(p, y + 0.06));
    pathTube(batch, [...ring, ring[0]], 0.105, '#9d907d', 4);
  }
  const pier = [];
  for (let i = 0; i <= 22; i++) {
    const t = i / 22,
      u = -54 + 48 * t,
      v = -2.8 * Math.sin(t * Math.PI);
    pier.push([u, v, y + (1.4 - y) * t]);
  }
  for (let i = 1; i < pier.length; i++) {
    const left = (k, side, dy = 0) => up(xy(pier[k][0], pier[k][1] + side * 2.65), pier[k][2] + dy);
    batch.top([left(i - 1, -1), left(i - 1, 1), left(i, 1), left(i, -1)], warmStone, 17);
    for (const side of [-1, 1]) {
      batch.face(
        [left(i - 1, side, -0.45), left(i - 1, side), left(i, side), left(i, side, -0.45)],
        kerb
      );
      pathTube(batch, [left(i - 1, side, 0.89), left(i, side, 0.89)], 0.095, '#b9a184', 5);
      if (i % 2 === 0) {
        const [x, h, z] = left(i, side);
        cylinder(batch, x, z, h - 0.1, h + 1.0, 0.105, 0.105, kerb, 6);
        if (i % 6 === 0) {
          cylinder(batch, x, z, -1, h - 0.2, 0.31, 0.31, '#918779', 8);
          lamps.add(x, h + 0.97, z, '#ffd99b', 0.59);
        }
      }
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (TAU * i) / 8,
      p = xy(-65 + 17.7 * Math.cos(a), 14.3 * Math.sin(a));
    cylinder(batch, ...p, y, y + 0.72, 0.17, 0.2, '#7d7466', 8);
    cylinder(
      batch,
      ...p,
      y + 0.73,
      y + 0.95,
      0.25,
      0.24,
      '#ead6b1',
      8,
      0,
      '#f1dcab',
      litSurface.stone
    );
    lamps.add(...up(p, y + 0.94), '#ffe2a8', 0.85);
  }
}
export const parkPlantings = Array.from({ length: 24 }, (_, i) => {
  const side = i % 2 ? 1 : -1,
    t = (Math.floor(i / 2) + 0.5) / 12;
  const p = xy(-165 + 93 * t, side * (10 + 10 * Math.sin(Math.PI * t)));
  return [...p, 0.9 + 0.22 * Math.sin(i * 2.3) ** 2, i % 3 !== 0];
});
export function buildBailuzhou(batch, geo, lamps, index) {
  parkGardens(batch, geo, lamps);
  sculpture(batch, geo, index);
  for (const v of [-3.4, 3.4]) lamps.add(...up(xy(3.5, v), 2.35), '#ffe4bf', 0.82);
}
