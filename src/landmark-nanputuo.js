import { cylinder, prism, groundY, litSurface, ringRect } from './scenery-mesh.js';
import {
  localFrame,
  up,
  rect,
  ellipse,
  inRect,
  foundation,
  terrace,
  sweptRoof,
} from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';

// The OSM hall centres and the sides of the square release pond define this axis.
const angle = 0.466;
const halls = [
  { center: [-3361, 4064], w: 25, d: 16, height: 5.8, roof: '#678b73' },
  { center: [-3341, 4026], w: 30, d: 23, height: 8.2, roof: '#527f73', double: true },
  { center: [-3318, 3983], w: 22, d: 22, height: 6.4, octagon: true },
  { center: [-3298, 3943], w: 34, d: 20, height: 10, roof: '#668975', double: true },
];
const axis = localFrame(halls[1].center, angle);
const pond = [-3382, 4117];
const pagodas = [
  [-3421, 4093],
  [-3351, 4132],
];
const granite = '#c4bbad',
  rail = '#d4cab5',
  wood = '#a64932',
  gold = '#d4aa60';
export function templeReserved(x, z) {
  if (x < -3435 || x > -3246 || z < 3895 || z > 4148) return false;
  return (
    inRect(x, z, axis(0, -13), angle, 46, 94) ||
    inRect(x, z, pond, 0.36, 19, 19) ||
    pagodas.some((p) => Math.hypot(x - p[0], z - p[1]) < 9)
  );
}

function porch(batch, xy, w, d, y, eave, lamps) {
  for (const side of [-1, 1]) {
    const v = side * d * 0.42;
    for (let i = -3; i <= 3; i++) {
      const [x, z] = xy(i * w * 0.125, v);
      cylinder(batch, x, z, y, y + 0.53, 0.53, 0.42, granite, 8);
      cylinder(batch, x, z, y + 0.5, eave, 0.38, 0.3, wood, 9);
      cylinder(batch, x, z, eave - 0.54, eave, 0.52, 0.74, '#ae8755', 8);
      if (Math.abs(i) === 2) lamps.add(x, eave - 0.95, z, '#ffb668', 0.62);
    }
    prism(
      batch,
      rect(xy, 0, v, w * 0.88, 0.42),
      eave - 0.55,
      eave,
      '#955340',
      gold,
      litSurface.stone
    );
  }
}
function roundEave(batch, xy, y, radius, topRadius, rise) {
  const rings = [];
  for (const t of [0, 0.27, 0.59, 1]) {
    const outer = ellipse(xy, 0, 0, radius, radius, 8, Math.PI / 8);
    const inner = ellipse(xy, 0, 0, topRadius, topRadius, 8, Math.PI / 8);
    const ring = [];
    for (let i = 0; i < 8; i++) {
      const next = (i + 1) % 8;
      for (let j = 0; j < 4; j++) {
        const s = j / 4,
          vertex = outer[i].map(
            (n, k) =>
              (1 - t) * (n + (outer[next][k] - n) * s) +
              t * (inner[i][k] + (inner[next][k] - inner[i][k]) * s)
          );
        ring.push(
          up(
            vertex,
            y + rise * (0.42 * t + 0.58 * t * t) + 0.94 * Math.abs(2 * s - 1) ** 3 * (1 - t)
          )
        );
      }
    }
    rings.push(ring);
  }
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < 32; i++) {
      const k = (i + 1) % 32;
      batch.top(
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        '#537e69',
        litSurface.glazedTile
      );
    }
  pathTube(batch, [...rings[0], rings[0][0]], 0.14, gold, 5);
  for (let i = 0; i < 32; i += 4)
    pathTube(
      batch,
      rings.map((level) => level[i]),
      0.15,
      '#d3b277',
      5
    );
}
function hallStairs(batch, geo, xy, y, w, d) {
  const front = d * 0.5 + 1.4;
  const run = Math.min(14, Math.max(3.8, (y - groundY(geo, ...xy(0, front + 10))) * 1.75));
  const bottom = Math.min(y - 0.68, groundY(geo, ...xy(0, front + run)) + 0.46);
  const count = Math.max(4, Math.ceil((y - bottom) / 0.24));
  const halfWidth = w * 0.26,
    tread = run / count;
  for (let i = 0; i < count; i++) {
    const depth = front + (i + 0.5) * tread,
      top = y - ((y - bottom) * (i + 1)) / count;
    const step = rect(xy, 0, depth, 2 * halfWidth, tread + 0.04);
    foundation(batch, geo, step, top, granite, '#d1c1a8');
  }
  for (const side of [-1, 1]) {
    const u = side * (halfWidth + 0.1);
    const upper = up(xy(u, front), y + 0.53),
      lower = up(xy(u, front + run), bottom + 0.53);
    pathTube(batch, [upper, lower], 0.18, rail, 6);
    for (let i = 0; i <= 4; i++) {
      const t = i / 4,
        [x, z] = xy(u, front + run * t),
        h = y + (bottom - y) * t;
      cylinder(batch, x, z, h - 0.2, h + 0.7, 0.21, 0.19, granite, 6);
    }
  }
}
function mainHall(batch, geo, lamps, index, hall) {
  const { center, w, d, height } = hall,
    xy = localFrame(center, angle);
  const pad = hall.octagon
    ? ellipse(xy, 0, 0, 13.4, 13.4, 8, Math.PI / 8)
    : rect(xy, 0, 0, w + 4, d + 3);
  const y = terrace(batch, geo, pad, 0.55, '#c5b7a1'),
    eave = y + height;
  if (hall.octagon) {
    for (let i = 0; i < 3; i++) {
      const base = y + i * 4.35,
        r = 10.8 - i * 2.32;
      prism(
        batch,
        ellipse(xy, 0, 0, r - 0.9, r - 0.9, 8, Math.PI / 8),
        base,
        base + (i ? 3.65 : 5.45),
        wood,
        wood,
        litSurface.portico
      );
      roundEave(
        batch,
        xy,
        base + (i ? 2.65 : 4.65),
        r + 1.45,
        i === 2 ? 0.5 : r - 3.5,
        i === 2 ? 5 : 3.1
      );
    }
    cylinder(batch, ...center, y + 16.15, y + 18.5, 0.46, 0.04, gold, 10);
    index.add(pad, y + 18.5);
  } else {
    const body = rect(xy, 0, 0, w * 0.79, d * 0.67);
    prism(batch, body, y, eave, '#ab573a', '#75654b', litSurface.portico);
    for (let i = -3; i <= 3; i++) {
      const u = i * w * 0.1,
        v = d * 0.336,
        panel = w * 0.072;
      prism(
        batch,
        rect(xy, u, v, panel, 0.2),
        y + 0.23,
        eave - 0.98,
        '#594838',
        '#6b4e36',
        litSurface.hallWindow
      );
      for (const f of [-0.3, 0, 0.3])
        prism(
          batch,
          rect(xy, u + panel * f, v + 0.14, 0.1, 0.09),
          y + 1.6,
          eave - 1.02,
          wood,
          wood
        );
      for (const h of [1.58, height * 0.62])
        prism(batch, rect(xy, u, v + 0.14, panel + 0.12, 0.13), y + h, y + h + 0.14, wood, gold);
    }
    porch(batch, xy, w, d, y, eave, lamps);
    sweptRoof(batch, xy, 0, 0, w + 1.2, d + 2, eave, hall.double ? 3.6 : 5.0, hall.roof, gold, 1.3);
    if (hall.double) {
      prism(
        batch,
        rect(xy, 0, 0, w * 0.72, d * 0.61),
        eave + 1,
        eave + 5.0,
        '#a44b31',
        '#74644b',
        litSurface.portico
      );
      sweptRoof(batch, xy, 0, 0, w * 0.85, d * 0.78, eave + 4.8, 5.45, hall.roof, '#cfaa70', 1.55);
    }
    index.add(pad, eave + (hall.double ? 12.5 : 7.2));
  }
  hallStairs(batch, geo, xy, y, w, d);
}
function pagoda(batch, geo, lamps, index, center) {
  const xy = localFrame(center, angle),
    y = terrace(batch, geo, ellipse(xy, 0, 0, 7.6, 7.6, 8), 0.2);
  cylinder(batch, ...center, y, y + 1.16, 5.6, 5.1, granite, 8, angle);
  for (let i = 0; i < 11; i++) {
    const base = y + 1.13 + i * 1.34,
      r = 4.9 * (1 - i * 0.069);
    cylinder(batch, ...center, base, base + 0.94, r * 0.73, r * 0.68, '#a99e8d', 8, angle);
    cylinder(batch, ...center, base + 0.94, base + 1.41, r, r * 0.5, granite, 8, angle);
  }
  cylinder(batch, ...center, y + 15.9, y + 17.2, 0.49, 0.06, rail, 8);
  lamps.add(center[0] - 2, y + 2.0, center[1] + 2, '#ffd18d', 1.15);
  index.add(ellipse(xy, 0, 0, 5.4, 5.4, 8), y + 17.2);
}
export const templePlantings = [-60, -18, 22, 57].flatMap((v) =>
  [-1, 1].map((side) => [...axis(side * 17.8, v), 0.85, false])
);

export function buildNanputuo(batch, geo, lamps, index) {
  // Contoured paving joins the raised plinths. A narrow granite aisle stays
  // visible between the gates, with small enclosed gardens on either side.
  const paving = (u, v) => {
    const p = axis(u, v);
    return up(p, groundY(geo, ...p) + 0.46);
  };
  for (let u = -44; u < 44; u += 4)
    for (let v = -101; v < 71; v += 4) {
      const garden =
        Math.abs(u) > 12 && Math.abs(u) < 24 && [-58, -20, 22, 59].some((m) => Math.abs(v - m) < 7);
      const tone = garden ? '#899566' : Math.abs(u + 2) < 5 ? '#c6b89f' : '#b8aa90';
      batch.top([paving(u, v), paving(u + 4, v), paving(u + 4, v + 4), paving(u, v + 4)], tone, 17);
    }
  for (const side of [-1, 1])
    for (const v of [-70, -53, -23, -6, 24, 41]) {
      const xy = localFrame(axis(36 * side, v), angle + Math.PI / 2);
      const ring = rect(xy, 0, 0, 16.3, 8),
        y = terrace(batch, geo, ring, 0.62);
      prism(batch, ring, y, y + 3.7, '#bb8867', '#a78a67', litSurface.portico);
      sweptRoof(batch, xy, 0, 0, 17.6, 9.8, y + 3.6, 2.3, '#72877a', '#c0a47c', 0.58);
      index.add(ring, y + 7.1);
    }
  // Colonnaded side galleries frame the central patios.
  for (const sign of [-1, 1])
    for (const [v, length] of [
      [-28.5, 21],
      [-7.5, 21],
      [17.5, 19],
      [36.5, 19],
    ]) {
      const center = axis(sign * 24, v),
        xy = localFrame(center, angle + Math.PI / 2);
      const ring = rect(xy, 0, 0, length, 5.6),
        y = terrace(batch, geo, ring, 0.25);
      for (let i = 0; i <= 6; i++)
        for (const side of [-1, 1]) {
          const [x, z] = xy(length * (i / 6 - 0.5) * 0.91, side * 2);
          cylinder(batch, x, z, y, y + 3.1, 0.21, 0.18, wood, 6);
        }
      sweptRoof(batch, xy, 0, 0, length + 1, 6.3, y + 3.1, 1.9, '#698374', '#b89668', 0.45);
      index.add(ring, y + 5.7);
    }
  const rim = ringRect(...pond, 34.8, 32.4, 0.36),
    water = geo.waterAt(...pond)?.h ?? groundY(geo, ...pond);
  const embankment = ringRect(...pond, 41.6, 39.2, 0.36);
  prism(batch, embankment, water - 1.25, water + 0.46, '#a3937d', '#c9baa3', 0, 0, 0, 0, [rim]);
  // Connect the steps, paired pagodas and release pond across the sloping forecourt.
  const walk = (a, b, width) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      n = Math.ceil(len / 3);
    const point = (i, side) => {
      const x = a[0] + (dx * i) / n - (((side * dz) / len) * width) / 2,
        z = a[1] + (dz * i) / n + (((side * dx) / len) * width) / 2;
      return [x, Math.max(water + 0.44, groundY(geo, x, z) + 0.51), z];
    };
    for (let i = 0; i < n; i++)
      batch.top([point(i, -1), point(i + 1, -1), point(i + 1, 1), point(i, 1)], '#bcad95');
  };
  const poolFrame = localFrame(pond, 0.36);
  walk(axis(0, 66), poolFrame(0, -18), 8.4);
  for (let i = 0; i < 2; i++) walk(pagodas[i], poolFrame((i ? 1 : -1) * 19, 0), 4.8);
  for (let k = 0; k < 4; k++) {
    const a = rim[k],
      b = rim[(k + 1) % 4];
    pathTube(batch, [up(a, water + 0.8), up(b, water + 0.8)], 0.39, rail, 6);
    for (let j = 0; j < 9; j++) {
      const t = j / 9,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      cylinder(batch, x, z, water + 0.33, water + 1.1, 0.18, 0.18, rail, 5);
    }
  }
  for (const hall of halls) mainHall(batch, geo, lamps, index, hall);
  for (const p of pagodas) pagoda(batch, geo, lamps, index, p);
}
