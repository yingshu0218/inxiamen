import { groundY, litSurface, mix, prism, signedArea } from './scenery-mesh.js';

// The survey fixes the orientation of each rounded triangular floor plate. The inclined
// crown and the bowed outer faces follow Gensler's project views and Shimao's photographs.
const towers = [
  {
    x: -4224.5,
    z: 4576.3,
    yaw: 0.48,
    crest: 296.5,
    shoulder: 248,
    pitch: 3.85,
    seed: 0.37,
    belly: 0.21,
    peakShift: 5.1,
    outline: [
      [-1.5, -32.3],
      [6.5, -28.3],
      [13.5, -22.3],
      [20.5, -14.3],
      [25.5, -4.3],
      [28.5, 5.7],
      [29.5, 15.7],
      [21.5, 21.7],
      [8.5, 24.7],
      [-7.5, 23.7],
      [-16.5, 20.7],
      [-22.5, 17.7],
      [-29.5, 12.7],
      [-28.5, 3.7],
      [-25.5, -6.3],
      [-21.5, -14.3],
      [-10.5, -26.3],
    ],
  },
  {
    x: -4119.1,
    z: 4689.8,
    yaw: 0.69,
    crest: 299.1,
    shoulder: 244.5,
    pitch: 4.2,
    seed: 0.78,
    belly: 0.25,
    peakShift: 4.2,
    outline: [
      [-13.9, -29.8],
      [-0.9, -27.8],
      [7.1, -24.8],
      [16.1, -19.8],
      [24.1, -11.8],
      [29.1, -2.8],
      [32.1, 5.2],
      [26.1, 12.2],
      [17.1, 18.2],
      [8.1, 22.2],
      [-13.9, 30.2],
      [-21.9, 17.2],
      [-24.9, 8.2],
      [-24.9, -1.8],
      [-23.9, -10.8],
      [-19.9, -19.8],
    ],
  },
];
const siteX = -4171.8,
  siteZ = 4633.05,
  siteCos = 0.6805,
  siteSin = 0.73275;
const reserve = [
  [-139, -24],
  [-116, -51],
  [-69, -55],
  [-59, -63],
  [67, -63],
  [79, -55],
  [115, -50],
  [139, -23],
  [139, 23],
  [116, 46],
  [87, 52],
  [50, 48],
  [29, 44],
  [-26, 44],
  [-62, 50],
  [-99, 51],
  [-121, 43],
  [-139, 23],
];
const lowerPlan = [
  [-130, -12],
  [-119, -32],
  [-98, -43],
  [-65, -42],
  [-42, -38],
  [-22, -41],
  [11, -43],
  [40, -45],
  [69, -42],
  [96, -43],
  [118, -33],
  [129, -14],
  [130, 11],
  [119, 29],
  [98, 41],
  [76, 43],
  [52, 38],
  [30, 33],
  [7, 32],
  [-21, 34],
  [-52, 40],
  [-77, 43],
  [-103, 38],
  [-120, 29],
  [-130, 13],
];
const hallPlan = [
  [-72, -22],
  [-62, -35],
  [-37, -37],
  [-8, -34],
  [19, -37],
  [45, -39],
  [64, -31],
  [73, -18],
  [66, -1],
  [57, 12],
  [39, 19],
  [20, 18],
  [6, 14],
  [-12, 13],
  [-31, 18],
  [-48, 23],
  [-65, 15],
];
const bays = 22;
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const blend3 = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (p) => {
  const l = Math.hypot(...p) || 1;
  return p.map((v) => v / l);
};
const site = (u, v) => [siteX + siteCos * u - siteSin * v, siteZ + siteSin * u + siteCos * v];
const sitePoint = (u, v, h) => {
  const [x, z] = site(u, v);
  return [x, h, z];
};

export function towersReserved(x, z) {
  const dx = x - siteX,
    dz = z - siteZ;
  if (Math.abs(dx) > 145 || Math.abs(dz) > 148) return false;
  const u = dx * siteCos + dz * siteSin,
    v = dz * siteCos - dx * siteSin;
  if (Math.abs(u) > 139 || v < -63 || v > 52) return false;
  let inside = false;
  for (let i = 0, j = reserve.length - 1; i < reserve.length; j = i++) {
    const a = reserve[i],
      b = reserve[j];
    if (a[1] > v !== b[1] > v && u < a[0] + ((b[0] - a[0]) * (v - a[1])) / (b[1] - a[1])) inside = !inside;
  }
  return inside;
}

// Quadratic fillets preserve the long straight sections on the retail complex.
function rounded(plan, radius = 3, slices = 3) {
  const result = [];
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i],
      before = plan[(i + plan.length - 1) % plan.length],
      after = plan[(i + 1) % plan.length];
    const a = Math.hypot(before[0] - p[0], before[1] - p[1]),
      b = Math.hypot(after[0] - p[0], after[1] - p[1]);
    const d = Math.min(radius, a * 0.46, b * 0.46);
    const left = [p[0] + ((before[0] - p[0]) * d) / a, p[1] + ((before[1] - p[1]) * d) / a];
    const right = [p[0] + ((after[0] - p[0]) * d) / b, p[1] + ((after[1] - p[1]) * d) / b];
    for (let j = 0; j <= slices; j++) {
      const t = j / slices;
      result.push(left.map((n, k) => mix(mix(n, p[k], t), mix(p[k], right[k], t), t)));
    }
  }
  return result;
}

// A folded section gives the metal a face, a shadow side and an actual reveal.
// Each station carries its own surface normal so a single extrusion can follow a curved facade.
function rib(batch, path, width, depth, metal, side = metal, style = 0) {
  let previous;
  for (let i = 0; i < path.length; i++) {
    const station = path[i],
      tangent = unit(sub(path[Math.min(i + 1, path.length - 1)].p, path[Math.max(0, i - 1)].p));
    let sideways = cross(tangent, station.n);
    if (Math.hypot(...sideways) < 0.001) sideways = cross(tangent, [0, 0, 1]);
    sideways = unit(sideways);
    const outward = unit(cross(sideways, tangent));
    const w = width * (station.scale ?? 1),
      d = depth * (station.scale ?? 1);
    const face = add(station.p, outward, d);
    const section = [
      add(station.p, sideways, -w * 0.5),
      add(station.p, sideways, w * 0.5),
      add(face, sideways, w * 0.25),
      add(face, sideways, -w * 0.25),
    ];
    if (previous) {
      for (let j = 0; j < 4; j++) {
        const k = (j + 1) % 4;
        batch.face(
          [previous[j], section[j], section[k], previous[k]],
          j === 2 ? metal : side,
          j === 2 ? style : 0
        );
      }
    } else batch.face(section, side);
    if (i === path.length - 1) batch.face(section.toReversed(), metal);
    previous = section;
  }
}

// Include projecting mullions and cope with the point-in-polygon test's open boundary.
function offsetFootprint(points, clearance) {
  const ring = signedArea(points) < 0 ? points.toReversed() : points;
  return ring.map((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length],
      b = ring[(i + 1) % ring.length];
    const left = unit([p[1] - a[1], a[0] - p[0]]),
      right = unit([b[1] - p[1], p[0] - b[0]]);
    const miter = clearance / Math.max(0.75, 1 + left[0] * right[0] + left[1] * right[1]);
    return [p[0] + (left[0] + right[0]) * miter, p[1] + (left[1] + right[1]) * miter];
  });
}

function podium(batch, geo, lamps, obstacles, base) {
  const floor = rounded(lowerPlan, 8),
    solid = floor.map((p) => site(...p));
  const bottom = Math.min(base, ...solid.map((p) => groundY(geo, ...p))) - 1.4;
  function volume(plan, low, high, color, top, kind = 0, seed = 0.35, scaleU = 1, scaleV = 1) {
    const ring = plan.map(([u, v]) => site(u * scaleU, v * scaleV));
    prism(batch, ring, low, high, color, top, kind, seed);
    if (top) obstacles.add(offsetFootprint(ring, 0.65), high + 0.44);
  }
  volume(floor, bottom, base + 1.7, '#857c6a', '#c7bea1');
  volume(floor, base + 1.64, base + 8.95, '#6a8584', null, 2, 0.62, 0.983, 0.948);
  volume(floor, base + 8.93, base + 10.05, '#d1c5a5', '#baad90');
  const second = floor.map(([u, v]) => [u * 0.96, v * 0.89 - 1.2]);
  volume(second, base + 10.02, base + 19.1, '#788c89', null, 2, 0.32);
  volume(second, base + 19.04, base + 20.16, '#adad9b', '#b6b09e', 0, 0.38, 1.004, 1.014);

  const hall = rounded(hallPlan, 9);
  volume(hall, base + 13, base + 28.82, '#648385', null, 2, 0.47);
  volume(hall, base + 28.78, base + 30.35, '#c9be9f', '#c9c0a9', 0, 0.45, 1.012, 1.025);
  const upper = rounded(
    [
      [-59, -18],
      [-55, -28],
      [-34, -31],
      [-10, -30],
      [12, -32],
      [33, -31],
      [43, -26],
      [47, -15],
      [40, -6],
      [24, -5],
      [0, -8],
      [-23, -4],
      [-48, -1],
    ],
    5
  );
  volume(upper, base + 30.31, base + 32.65, '#9d9d88', '#c2b9a1');

  // Seaward roof terraces flank a sweeping skylight. Each garden sits on a raised stone edging.
  for (const garden of [
    [
      [-49, 23],
      [-33, 18],
      [-14, 15],
      [-7, 18],
      [-10, 24],
      [-32, 29],
      [-47, 32],
      [-56, 31],
    ],
    [
      [4, 18],
      [12, 17],
      [26, 21],
      [40, 22],
      [50, 19],
      [55, 23],
      [48, 28],
      [36, 30],
      [17, 27],
      [6, 25],
    ],
  ]) {
    const patio = rounded(garden, 2.5);
    volume(patio, base + 20.15, base + 20.69, '#a59c81', '#74815c');
    const center = patio.reduce((a, p) => [a[0] + p[0] / patio.length, a[1] + p[1] / patio.length], [0, 0]);
    const planting = patio.map((p) => p.map((n, k) => mix(center[k], n, 0.91)));
    volume(planting, base + 20.67, base + 21.02, '#667452', '#79895a');
  }
  const skylight = rounded(
    [
      [-41, -21],
      [-34, -25],
      [20, -25],
      [30, -22],
      [23, -16],
      [-28, -15],
    ],
    3
  );
  volume(skylight, base + 32.6, base + 33.6, '#647471', '#7a9794');
  for (let u = -32; u <= 20; u += 5.2) {
    rib(
      batch,
      [
        { p: sitePoint(u, -24.3, base + 33.61), n: [0, 1, 0] },
        { p: sitePoint(u + 1.6, -16.3, base + 33.61), n: [0, 1, 0] },
      ],
      0.25,
      0.23,
      '#c0bdad'
    );
  }

  // Horizontal sunshades belong only to the shop windows on the recessed north wing.
  const northCurve = [
    [-59, -35],
    [-47, -36.8],
    [-36, -37.2],
    [-23, -35.9],
    [-12, -34.4],
  ];
  for (const h of [16.5, 20.65, 24.8, 28.45]) {
    for (let i = 1; i < northCurve.length; i++) {
      const [au, av] = northCurve[i - 1],
        [bu, bv] = northCurve[i];
      batch.top(
        [
          sitePoint(au, av + 0.4, base + h),
          sitePoint(bu, bv + 0.4, base + h),
          sitePoint(bu, bv - 1.9, base + h + 0.35),
          sitePoint(au, av - 1.9, base + h + 0.35),
        ],
        '#bab9a6'
      );
      batch.face(
        [
          sitePoint(au, av - 1.9, base + h - 0.4),
          sitePoint(au, av - 1.9, base + h + 0.35),
          sitePoint(bu, bv - 1.9, base + h + 0.35),
          sitePoint(bu, bv - 1.9, base + h - 0.4),
        ],
        '#989d93'
      );
    }
  }
  const sunshades = [
    ...northCurve.map(([u, v]) => site(u, v + 0.4)),
    ...northCurve.toReversed().map(([u, v]) => site(u, v - 1.9)),
  ];
  obstacles.add(offsetFootprint(sunshades, 0.5), base + 29.05);
  function entrance(u0, u1, side, reach, baysCount) {
    const inward = side < 0 ? -38.5 : 31;
    function section(t) {
      const u = mix(u0, u1, t),
        open = Math.sin(t * Math.PI);
      const v = inward + side * (reach * (0.39 + 0.61 * open));
      const h = base + 8.12 + 1.25 * Math.sin((t * 2.24 - 0.27) * Math.PI);
      return { back: sitePoint(u, inward - side * 0.7, base + 10.5), outer: sitePoint(u, v, h), u, v, h };
    }
    const path = [],
      cover = [];
    let a = section(0);
    for (let i = 0; i <= baysCount; i++) {
      const b = section(i / baysCount);
      const normal = [-siteSin * side, 0, siteCos * side];
      path.push({ p: add(b.outer, [0, 1, 0], 0.02), n: normal });
      if (i) {
        const panel = [a.back, b.back, b.outer, a.outer];
        batch.top(panel, i % 4 === 0 ? '#92a9a3' : '#a0b3ab');
        batch.face(panel.map((p) => add(p, [0, 1, 0], -0.31)).reverse(), '#ac9f82');
        batch.face(
          [a.outer, b.outer, add(b.outer, [0, 1, 0], -0.33), add(a.outer, [0, 1, 0], -0.33)],
          '#bdb69b'
        );
        if (i % 2 === 0)
          rib(
            batch,
            [
              { p: b.outer, n: [0, 1, 0] },
              { p: b.back, n: [0, 1, 0] },
            ],
            0.26,
            0.13,
            '#cdccba',
            '#77857c'
          );
        cover.push([a.outer[0], a.outer[2]]);
      }
      if (i % 4 === 2) {
        const heel = sitePoint(b.u, b.v - side * 3.5, base + 0.85);
        for (const du of [-2.25, 2.25]) {
          rib(
            batch,
            [
              { p: heel, n: normal },
              { p: sitePoint(b.u + du, b.v - side * 0.8, b.h - 0.34), n: normal },
            ],
            0.45,
            0.37,
            '#b8ad8f',
            '#958b75'
          );
        }
        lamps.add(b.outer[0], b.h - 0.48, b.outer[2], '#ffd092', 1.2);
      }
      a = b;
    }
    rib(batch, path, 0.5, 0.28, '#d6c4a0', '#a19782', litSurface.spine);
    cover.push([a.outer[0], a.outer[2]], site(u1, inward - side * 0.7), site(u0, inward - side * 0.7));
    obstacles.add(offsetFootprint(cover, 0.6), base + 10.95);
  }
  entrance(-57, 66, -1, 17, 24);
  entrance(-56, 53, 1, 8.4, 20);
}

// Intersect the surveyed outline with parallel chords; opposite stations then join the
// sloping lantern with longitudinal glazing bays, including its two pointed ends.
function sectionOf(tower) {
  const c = Math.cos(tower.yaw),
    s = Math.sin(tower.yaw);
  const poly = rounded(tower.outline, 2.0).map(([x, z]) => [x * c + z * s, -x * s + z * c]);
  const low = poly.reduce((a, p) => (p[0] < a[0] ? p : a)),
    high = poly.reduce((a, p) => (p[0] > a[0] ? p : a));
  const left = [],
    right = [];
  for (let i = 0; i <= bays; i++) {
    const f = (1 - Math.cos((Math.PI * i) / bays)) * 0.5,
      u = mix(low[0], high[0], f),
      hits = [];
    if (i === 0 || i === bays) hits.push(i === 0 ? low[1] : high[1]);
    else
      for (let j = 0; j < poly.length; j++) {
        const a = poly[j],
          b = poly[(j + 1) % poly.length];
        if ((a[0] <= u && u < b[0]) || (b[0] <= u && u < a[0]))
          hits.push(mix(a[1], b[1], (u - a[0]) / (b[0] - a[0])));
      }
    left.push({ u, v: Math.min(...hits), f });
    right.push({ u, v: Math.max(...hits), f });
  }
  const plan = [...left, ...right.slice(1, -1).reverse()];
  let length = 0;
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i],
      a = plan[(i + plan.length - 1) % plan.length],
      b = plan[(i + 1) % plan.length];
    const tangent = unit([b.u - a.u, 0, b.v - a.v]);
    p.out = [tangent[2], -tangent[0]];
    p.distance = length;
    length += Math.hypot(b.u - p.u, b.v - p.v);
  }
  left[0] = right[0] = plan[0];
  left[bays] = right[bays] = plan[bays];
  return { c, s, plan, left, right, length, high: high[0] };
}

function hull(points) {
  const sorted = points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  function chain(sequence) {
    const side = [];
    for (const p of sequence) {
      while (side.length >= 2) {
        const a = side[side.length - 2],
          b = side[side.length - 1];
        if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) > 1e-6) break;
        side.pop();
      }
      side.push(p);
    }
    return side.slice(0, -1);
  }
  return [...chain(sorted), ...chain(sorted.toReversed())];
}

function indexShaft(obstacles, panels, base, peak) {
  // Each interval is clipped against both the curtain and the roof. This keeps the upper
  // airspace above the low end of the crown usable, including beside the convex midsection.
  const cuts = [0, 43, 83, 123, 160, 192, 218, 235, 246, 253, 260, 267, 274, 281, 287, 292, 296, peak + 1.35]
    .filter((v, i, a) => i === a.length - 1 || v < peak + 0.7)
    .map((h) => base + h);
  const layers = cuts.slice(1).map(() => []);
  for (const panel of panels) {
    const floor = Math.min(...panel.map((p) => p[1])),
      ceiling = Math.max(...panel.map((p) => p[1]));
    for (let j = 0; j < layers.length; j++) {
      const lo = cuts[j],
        hi = cuts[j + 1];
      if (ceiling < lo || floor > hi) continue;
      const points = layers[j];
      for (let k = 0; k < panel.length; k++) {
        const a = panel[k],
          b = panel[(k + 1) % panel.length];
        if (a[1] >= lo && a[1] <= hi) points.push([a[0], a[2]]);
        for (const y of [lo, hi])
          if ((a[1] < y && b[1] > y) || (a[1] > y && b[1] < y)) {
            const t = (y - a[1]) / (b[1] - a[1]);
            points.push([mix(a[0], b[0], t), mix(a[2], b[2], t)]);
          }
      }
    }
  }
  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i].length < 3) continue;
    obstacles.add(offsetFootprint(hull(layers[i]), 1.05), cuts[i + 1] + 0.55);
  }
}

function shaft(batch, lamps, obstacles, base, tower) {
  const { plan, left, right, length, high, c, s } = sectionOf(tower),
    count = plan.length;
  const shell = [];
  function roofHeight(p) {
    const arch = Math.sin(Math.PI * p.f);
    return mix(tower.shoulder, tower.crest, p.f) + arch * (4.2 + (3.15 * p.v) / 29);
  }
  function outside(p) {
    return [p.out[0] * c - p.out[1] * s, 0, p.out[0] * s + p.out[1] * c];
  }
  function surface(p, h, relief = 0) {
    const t = clamp(h / tower.crest),
      swell = Math.sin(Math.PI * t),
      turn = clamp((t - 0.53) / 0.47);
    const width = 1 + tower.belly * swell - 0.34 * Math.pow(turn, 1.62);
    const depth = 1 + (0.13 + tower.belly * 0.22) * swell - 0.43 * Math.pow(turn, 1.58);
    const u = high + (p.u - high) * width + tower.peakShift * t + p.out[0] * relief;
    const v = p.v * depth + (2.6 * swell - 2.1 * turn) * (1 - p.f) + p.out[1] * relief;
    return [tower.x + c * u - s * v, base + h, tower.z + s * u + c * v];
  }
  function interpolation(side, f) {
    if (f <= 0) return side[0];
    if (f >= 1) return side[bays];
    const j = clamp(Math.floor((Math.acos(1 - 2 * f) / Math.PI) * bays), 0, bays - 1);
    const a = side[j],
      b = side[j + 1],
      t = clamp((f - a.f) / (b.f - a.f));
    const n = unit([mix(a.out[0], b.out[0], t), 0, mix(a.out[1], b.out[1], t)]);
    return { u: mix(a.u, b.u, t), v: mix(a.v, b.v, t), out: [n[0], n[2]], f };
  }
  const levels = [
    [0, 0, 'glass'],
    [10.85, 0, 'lobby'],
    [11.28, 0.24, 'lip'],
    [11.82, 0, 'edge'],
    [27, 0, 'glass'],
    [46, 0, 'glass'],
    [66, 0, 'glass'],
    [84, 0, 'glass'],
    [101.0, 0, 'glass'],
    [101.34, -0.78, 'shade'],
    [103.68, -0.78, 'vent'],
    [104.15, 0.18, 'lip'],
    [104.48, 0, 'edge'],
    [125, 0, 'glass'],
    [147, 0, 'glass'],
    [168, 0, 'glass'],
    [185.7, 0, 'glass'],
    [186.08, -0.72, 'shade'],
    [188.0, -0.72, 'vent'],
    [188.48, 0.16, 'lip'],
    [188.77, 0, 'edge'],
    [205.5, 0, 'glass'],
    [222, 0, 'glass'],
    [(p) => mix(222, roofHeight(p) - 14, 0.56), 0, 'glass'],
    [(p) => roofHeight(p) - 14, 0, 'glass'],
    [(p) => roofHeight(p) - 13.57, -0.35, 'shade'],
    [(p) => roofHeight(p) - 12.72, -0.35, 'clerestory'],
    [(p) => roofHeight(p) - 12.15, 0.16, 'lip'],
    [(p) => roofHeight(p) - 11.65, -1.12, 'edge'],
    [(p) => roofHeight(p) - 6.7, -1.28, 'lantern'],
    [(p) => roofHeight(p) - 1.15, -1.14, 'lantern'],
    [(p) => roofHeight(p) - 0.82, 0.55, 'shade'],
    [(p) => roofHeight(p), 0.55, 'crown'],
  ];
  const rings = levels.map(([h, offset]) =>
    plan.map((p) => surface(p, typeof h === 'number' ? h : h(p), offset))
  );
  const normals = rings.map((ring, j) =>
    ring.map((p, i) => {
      const tangent = sub(ring[(i + 1) % count], ring[(i + count - 1) % count]);
      const vertical = sub(rings[Math.min(j + 1, rings.length - 1)][i], rings[Math.max(0, j - 1)][i]);
      return unit(cross(vertical, tangent));
    })
  );
  const metal = {
    shade: '#59666a',
    vent: '#586b70',
    lip: '#aeb9b1',
    edge: '#819392',
    clerestory: '#bbbaa1',
    crown: '#aebbb5',
  };
  for (let j = 1; j < rings.length; j++) {
    const kind = levels[j][2];
    for (let i = 0; i < count; i++) {
      const k = (i + 1) % count,
        p = plan[i];
      const panel = [rings[j - 1][i], rings[j][i], rings[j][k], rings[j - 1][k]];
      const u0 = (p.distance * 218) / length,
        u1 = ((k === 0 ? length : plan[k].distance) * 218) / length;
      const uv = panel.map((pt, corner) => [corner < 2 ? u0 : u1, ((pt[1] - base) * 3.85) / tower.pitch]);
      const glass = kind === 'glass' || kind === 'lantern' || kind === 'lobby';
      if (glass) {
        const land = p.out[1] < -0.21,
          seaward = p.out[1] > 0.44;
        const color =
          kind === 'lantern'
            ? land
              ? '#839899'
              : '#90a1a0'
            : kind === 'lobby'
              ? '#718783'
              : land
                ? '#526e7d'
                : seaward
                  ? '#5d7c89'
                  : '#6a8389';
        batch.face(panel, color, kind === 'lobby' ? 2 : 6, tower.seed, uv, [
          normals[j - 1][i],
          normals[j][i],
          normals[j][k],
          normals[j - 1][k],
        ]);
      } else batch.face(panel, metal[kind], kind === 'clerestory' ? litSurface.stone : 0, tower.seed, uv);
      shell.push(panel);
    }
  }

  const roofNormal = unit([-c * 0.8, 0.98, -s * 0.8]);
  function roofPoint(i, q) {
    const a = left[i],
      b = right[i];
    const l = surface(a, roofHeight(a), 0.55),
      r = surface(b, roofHeight(b), 0.55);
    const p = blend3(l, r, q);
    // A shallow recessed lantern sits inside the sloping perimeter weather screen.
    p[1] -= 3.5 * Math.sin(Math.PI * q) * Math.sin(Math.PI * a.f);
    return p;
  }
  const across = 8;
  for (let i = 0; i < bays; i++)
    for (let j = 0; j < across; j++) {
      const q = j / across,
        r = (j + 1) / across;
      const panel =
        i === 0
          ? [roofPoint(0, 0.5), roofPoint(1, q), roofPoint(1, r)]
          : i === bays - 1
            ? [roofPoint(i, q), roofPoint(bays, 0.5), roofPoint(i, r)]
            : [roofPoint(i, q), roofPoint(i + 1, q), roofPoint(i + 1, r), roofPoint(i, r)];
      const color = j === 0 || j === across - 1 ? '#8e9a93' : j === 3 ? '#5c777e' : '#738c90';
      const uv = panel.map((p) => [
        (p[0] - tower.x) * c + (p[2] - tower.z) * s + 32,
        (p[2] - tower.z) * c - (p[0] - tower.x) * s + 44,
      ]);
      batch.top(panel, color, 2, tower.seed * 0.76, uv);
      shell.push(panel);
    }
  // Parallel seams form a long lantern. They meet narrow weather caps at both ends.
  for (const q of [0, 0.25, 0.5, 0.75, 1]) {
    const path = [];
    for (let i = 0; i <= bays; i++)
      path.push({
        p: add(roofPoint(i, q), roofNormal, 0.085),
        n: roofNormal,
        scale: Math.max(0.32, Math.sin((i * Math.PI) / bays) ** 0.4),
      });
    const edge = q === 0 || q === 1,
      glazedRidge = q === 0.5;
    rib(
      batch,
      path,
      edge ? 1.4 : glazedRidge ? 0.8 : 0.35,
      edge ? 0.45 : 0.2,
      edge ? '#c5c9b9' : '#a9b2ac',
      '#677a7b',
      edge ? litSurface.spine : 0
    );
  }
  for (let i = 3; i < bays - 1; i += 2) {
    const path = [];
    for (let j = 0; j <= across; j++)
      path.push({ p: add(roofPoint(i, j / across), roofNormal, 0.025), n: roofNormal });
    rib(batch, path, 0.27, 0.16, '#a4aeaa', '#6a7d7d');
  }
  // The lantern has a recessed glass windscreen behind a crossed, freestanding outer screen.
  for (let i = 0; i < count; i += 2) {
    const a = plan[i],
      mid = plan[(i + 1) % count],
      b = plan[(i + 2) % count];
    const start = { p: surface(a, roofHeight(a) - 12.22, 0.27), n: outside(a) };
    const end = { p: surface(b, roofHeight(b) - 0.92, 0.39), n: outside(b) };
    const waist = { p: surface(mid, roofHeight(mid) - 6.5, 0.38), n: outside(mid) };
    rib(batch, [start, waist, end], 0.37, 0.25, '#a8b7b1', '#748785');
    rib(
      batch,
      [
        { p: surface(a, roofHeight(a) - 0.92, 0.39), n: outside(a) },
        waist,
        { p: surface(b, roofHeight(b) - 12.22, 0.27), n: outside(b) },
      ],
      0.29,
      0.2,
      '#9caaa5',
      '#74817e'
    );
  }
  const screenLevels = [-12.22, -6.5, -0.92];
  for (let j = 1; j < screenLevels.length; j++)
    for (let i = 0; i < count; i++) {
      const a = plan[i],
        b = plan[(i + 1) % count],
        lo = screenLevels[j - 1],
        hi = screenLevels[j];
      shell.push([
        surface(a, roofHeight(a) + lo, 0.67),
        surface(a, roofHeight(a) + hi, 0.67),
        surface(b, roofHeight(b) + hi, 0.67),
        surface(b, roofHeight(b) + lo, 0.67),
      ]);
    }
  // Two banks of weather louvres sit in one bay at the heel of the sloping skylight.
  const ventStart = tower.seed < 0.5 ? 4 : 6;
  for (const q of [0.31, 0.61]) {
    for (let i = ventStart; i < ventStart + 4; i++) {
      const a = roofPoint(i, q),
        b = roofPoint(i, q + 0.105),
        c = roofPoint(i + 1, q + 0.105),
        d = roofPoint(i + 1, q);
      const blade = [
        add(a, roofNormal, 0.46),
        add(b, roofNormal, 0.46),
        add(blend3(b, c, 0.74), roofNormal, 0.13),
        add(blend3(a, d, 0.74), roofNormal, 0.13),
      ];
      batch.top(blade, '#91a19b');
      batch.face([a, b, blade[1], blade[0]], '#617575');
    }
  }

  // Three main folds pick up the changing radius of the glass. The single leading edge
  // carries a warm narrow bead; the other creases catch the sky in brushed aluminum.
  for (const [side, f, lit] of [
    [right, 0.992, true],
    [left, 0.47, false],
    [right, 0.12, false],
  ]) {
    const p = interpolation(side, f),
      n = outside(p),
      hTop = roofHeight(p) - 0.2;
    const heights = [11.8, 28, 48, 69, 90, 111, 132, 153, 174, 195, 216, 235, hTop - 4, hTop].filter(
      (h, i, a) => i >= a.length - 2 || h < hTop - 5
    );
    const path = heights.map((h) => ({ p: surface(p, h, 0.3), n, scale: 0.77 + (0.25 * h) / tower.crest }));
    rib(batch, path, lit ? 1.34 : 1.04, lit ? 0.77 : 0.62, '#afc1be', '#6b8487', lit ? litSurface.spine : 0);
  }

  // The two lower petal fronts sweep into the mall. Individual blades are deepest at
  // the occupied floors and die into the diagonal seam rather than running to the crown.
  for (const [side, fanRange, tall, number] of [
    [left, 0.85, 148, 15],
    [right, 0.88, 119, 15],
  ]) {
    const fanTop = (t) => 25 + tall * (1 - Math.pow(t, 0.64)) + 0.9 * Math.sin(Math.PI * 2 * t);
    const joint = [];
    for (let i = 0; i <= number; i++) {
      const t = i / number,
        f = 0.075 + fanRange * t,
        p = interpolation(side, f),
        n = outside(p),
        peak = fanTop(t);
      joint.push({ p: surface(p, peak, 0.33), n, scale: 0.7 + 0.3 * Math.sin(t * Math.PI) });
      const path = [];
      for (const v of [0, 0.24, 0.5, 0.75, 0.93, 1]) {
        const h = mix(11.9, peak - 0.45, v),
          lowerEdge = 0.028 * (1 - v) * (1 - v) * Math.sin(t * Math.PI);
        const blade = interpolation(side, f - lowerEdge);
        path.push({ p: surface(blade, h, 0.2), n: outside(blade), scale: mix(1.13, 0.36, v) });
      }
      rib(
        batch,
        path,
        i % 3 === 0 ? 0.96 : 0.65,
        0.55,
        '#adada0',
        '#798787',
        i % 3 === 1 ? litSurface.spine : 0
      );
    }
    rib(batch, joint, 0.85, 0.51, '#b1b7ad', '#748585', litSurface.spine);
  }

  for (const h of [102.55, 186.99]) {
    for (const side of [left, right]) {
      for (let i = 3; i < bays - 3; i += 3) {
        const f = side[i].f,
          g = side[i + 2].f,
          a = interpolation(side, f),
          b = interpolation(side, g);
        rib(
          batch,
          [
            { p: surface(a, h - 0.86, -0.6), n: outside(a) },
            { p: surface(b, h + 0.82, -0.6), n: outside(b) },
          ],
          0.35,
          0.2,
          '#8f9b95',
          '#657675'
        );
      }
    }
  }
  const peak = roofPoint(bays, 0.5);
  lamps.add(peak[0], peak[1] + 0.46, peak[2], '#ffe4af', 1.45);
  const shoulder = roofPoint(0, 0.5);
  lamps.add(shoulder[0], shoulder[1] + 0.3, shoulder[2], '#bcdedd', 1.15);
  indexShaft(obstacles, shell, base, tower.crest);
}

export function buildTowers(batch, geo, lamps, obstacles) {
  const base = groundY(geo, siteX, siteZ);
  podium(batch, geo, lamps, obstacles, base);
  for (const tower of towers) shaft(batch, lamps, obstacles, base, tower);
}
