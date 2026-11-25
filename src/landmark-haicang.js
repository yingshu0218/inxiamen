import * as THREE from 'three';
import { anchorStation, center, deckControls, eastAxis, fairwayPoint, halfSpan } from './haicang-layout.js';
import { geoPoint, litSurface, mix, TAU } from './scenery-mesh.js';

// The fairway bridge is a suspension bridge. Its six-lane, 32 m deck and
// 230 / 648 / 230 m spans follow the owner's description and design elevation.
// https://www.xmlqgc.com/About/detail/27494
// https://ptmc.tongji.edu.cn/yyljs/article/pdf/200403001
// The approaches and the two anchor positions follow OpenStreetMap / OpenFreeMap.
const cableLight = 18,
  towerFlood = 19;
const saturate = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => {
  const t = saturate(value);
  return t * t * (3 - 2 * t);
};

// Fixed arc-length samples are shared by the mesh, lane traffic and obstacle grid.
// The normal is the driver's right-hand side when travelling down the course.
export function bridgeRoute(points, height) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  curve.arcLengthDivisions = Math.max(250, points.length * 48);
  const length = curve.getLength();
  const count = Math.max(12, Math.ceil(length / 5));
  const table = Array.from({ length: count + 1 }, (_, i) => {
    const p = curve.getPointAt(i / count),
      tangent = curve.getTangentAt(i / count);
    return { x: p.x, z: p.z, h: height(i / count, p), rx: -tangent.z, rz: tangent.x };
  });
  function step(t) {
    const v = saturate(t) * count,
      i = Math.min(count - 1, Math.floor(v));
    const a = table[i],
      b = table[i + 1],
      q = v - i;
    const rx = mix(a.rx, b.rx, q),
      rz = mix(a.rz, b.rz, q),
      d = Math.hypot(rx, rz) || 1;
    return { x: mix(a.x, b.x, q), z: mix(a.z, b.z, q), h: mix(a.h, b.h, q), rx: rx / d, rz: rz / d };
  }
  function at(n, lateral, above = 0) {
    return [n.x + n.rx * lateral, n.h + above, n.z + n.rz * lateral];
  }
  return { curve, length, step, at, center: step(0.5) };
}

// Longitudinal displacement, transverse displacement, and absolute elevation.
export function framePoint(n, s, l, y) {
  return [n.x + n.rz * s + n.rx * l, y, n.z - n.rx * s + n.rz * l];
}

export function pathTube(batch, points, radius, color, sides = 7, style = 0) {
  let previousRing, previousNormals;
  for (let k = 0; k < points.length; k++) {
    const a = points[Math.max(0, k - 1)],
      b = points[Math.min(k + 1, points.length - 1)];
    const tangent = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const right =
      Math.hypot(tangent.x, tangent.z) > 0.001
        ? new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
        : new THREE.Vector3(0, 0, 1);
    const up = right.clone().cross(tangent).normalize();
    const ring = [],
      normals = [],
      p = points[k],
      r = typeof radius === 'function' ? radius(k / (points.length - 1)) : radius;
    for (let i = 0; i < sides; i++) {
      const angle = (TAU * i) / sides,
        c = Math.cos(angle),
        s = Math.sin(angle);
      const x = right.x * c + up.x * s,
        y = right.y * c + up.y * s,
        z = right.z * c + up.z * s;
      ring.push([p[0] + r * x, p[1] + r * y, p[2] + r * z]);
      normals.push([x, y, z]);
    }
    if (previousRing)
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        batch.face([previousRing[i], ring[i], ring[j], previousRing[j]], color, style, 0, undefined, [
          previousNormals[i],
          normals[i],
          normals[j],
          previousNormals[j],
        ]);
      }
    previousRing = ring;
    previousNormals = normals;
  }
}

export function bridgeColumn(batch, n, s, l, levels, color, sides = 12) {
  let prior;
  for (const [y, longRadius, sideRadius, along = 0, lateral = 0] of levels) {
    const ring = Array.from({ length: sides }, (_, i) => {
      const a = (TAU * i) / sides;
      return framePoint(n, s + along + longRadius * Math.cos(a), l + lateral + sideRadius * Math.sin(a), y);
    });
    if (prior)
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        batch.face([prior[i], ring[i], ring[j], prior[j]], color);
      }
    prior = ring;
  }
  batch.top(prior, color);
}

export function strip(batch, road, a, b, l1, l2, h, color, style = 0, seed = 0) {
  batch.top(
    [road.at(a, l1, h), road.at(b, l1, h), road.at(b, l2, h), road.at(a, l2, h)],
    color,
    style,
    seed
  );
}

function surfaceBand(batch, road, a, b, sa, sb, la, ha, lb, hb, color, style = 0, uvLow = 0, uvHigh = 1) {
  batch.face(
    [road.at(a, la, ha), road.at(a, lb, hb), road.at(b, lb, hb), road.at(b, la, ha)],
    color,
    style,
    0,
    [
      [sa, uvLow],
      [sa, uvHigh],
      [sb, uvHigh],
      [sb, uvLow],
    ]
  );
}

function edgeBarrier(batch, road, a, b, sa, sb, side, half, tall) {
  const outer = side * (half - 0.09),
    inner = side * (half - 0.68),
    topOuter = side * (half - 0.17),
    topInner = side * (half - 0.43);
  const h = tall ? 1.08 : 0.8;
  surfaceBand(batch, road, a, b, sa, sb, inner, 0.05, topInner, h, '#b6bcb6');
  strip(batch, road, a, b, topInner, topOuter, h + 0.009, '#e5e2d1', tall ? cableLight : 0);
  surfaceBand(batch, road, a, b, sa, sb, topOuter, h, outer, 0.05, '#cbd1c9');
}

// The highway and the low coastal bridge use different visible girder sections.
export function highwayDeck(batch, road, obstacles, options = {}) {
  const half = (options.width ?? 32) * 0.5,
    fish = options.fish ?? false,
    lanes = options.lanes ?? 3,
    depthScale = options.depthScale ?? 1;
  const segs = Math.ceil(road.length / (options.spacing ?? 16));
  let a = road.step(0);
  for (let i = 1; i <= segs; i++) {
    const b = road.step(i / segs),
      sa = ((i - 1) * road.length) / segs,
      sb = (i * road.length) / segs;
    strip(batch, road, a, b, -half, half, 0, options.roadColor ?? '#626969', litSurface.road, 0.95);
    const section = fish
      ? [
          [1, -0.035],
          [1, -0.36],
          [0.966, -0.57],
          [0.85, -0.8],
          [0.65, -1.2],
          [0.38, -1.57],
          [0, -1.76],
        ]
      : [
          [1, -0.04],
          [1, -0.65],
          [0.955, -0.9],
          [0.889, -1.08],
          [0.71, -2.6],
          [0.54, -3.15],
          [0, -3.15],
        ];
    for (const side of [-1, 1]) {
      for (let j = 1; j < section.length; j++) {
        const p = section[j - 1],
          q = section[j];
        const color = fish
          ? ['#d1d3c8', '#e7e7d9', '#d9dbd0', '#c4cdc4', '#b6c0ba', '#a4b1af'][j - 1]
          : ['#99afaf', '#d5dace', '#78959a', '#789497', '#8ba0a0', '#8c9a98'][j - 1];
        const nightStyle = j === 1 ? litSurface.bridge : !fish && j === 2 ? cableLight : 0;
        surfaceBand(
          batch,
          road,
          a,
          b,
          sa,
          sb,
          side * half * p[0],
          p[1] * depthScale,
          side * half * q[0],
          q[1] * depthScale,
          color,
          nightStyle,
          1,
          0
        );
      }
      if (!options.openEdge?.((i - 0.5) / segs, side)) {
        if (options.barriers !== false) edgeBarrier(batch, road, a, b, sa, sb, side, half, !fish);
        strip(batch, road, a, b, side * (half - 1.26), side * (half - 1.05), 0.052, '#e4dfcb');
      }
    }
    if (lanes >= 2) {
      strip(batch, road, a, b, -0.31, 0.31, 0.27, '#c8c5b3');
      for (const side of [-1, 1]) {
        surfaceBand(batch, road, a, b, sa, sb, side * 0.48, 0.03, side * 0.31, 0.27, '#a7ada4');
        strip(batch, road, a, b, side * 0.75, side * 0.95, 0.055, '#d0b36d');
      }
    }
    if (obstacles)
      obstacles.add(
        [road.at(a, -half), road.at(a, half), road.at(b, half), road.at(b, -half)].map((p) => [p[0], p[2]]),
        Math.max(a.h, b.h) + 1.1
      );
    a = b;
  }
  const marks = lanes === 3 ? [0.315, 0.581] : lanes === 2 ? [0.535] : [];
  for (let distance = 2; distance < road.length - 1; distance += 16.5) {
    const start = road.step(distance / road.length),
      end = road.step(Math.min(1, (distance + 5.5) / road.length));
    for (const fraction of marks)
      for (const s of [-1, 1]) {
        const x = s * fraction * half;
        strip(batch, road, start, end, x - 0.105, x + 0.105, 0.061, '#d7d6c9');
      }
  }
}

function fairwayFrame(s) {
  const [x, z] = fairwayPoint(s);
  return { x, z, rx: -eastAxis.y, rz: eastAxis.x, h: 60.35 - 3.75 * Math.min(1, (s / anchorStation) ** 2) };
}

function makeMainRoad(geo) {
  const westEnd = deckControls[0],
    eastEnd = deckControls.at(-1);
  const ground = (p) => Math.max(0.75, geo.heightAt(p[0], p[1]) + 0.16);
  const approach = (s, dist, grade, from, to) =>
    mix(from, to, ease(s / dist)) + grade * Math.sin(Math.PI * saturate(s / dist));
  return bridgeRoute(deckControls, (_t, p) => {
    const s = (p.x - center[0]) * eastAxis.x + (p.z - center[1]) * eastAxis.y;
    if (Math.abs(s) <= anchorStation) return fairwayFrame(s).h;
    const end = s < 0 ? westEnd : eastEnd,
      dist =
        Math.abs((end[0] - center[0]) * eastAxis.x + (end[1] - center[1]) * eastAxis.y) - anchorStation;
    const run = Math.abs(s) - anchorStation,
      datum = ground(end);
    return Math.max(approach(run, dist, s < 0 ? 1.8 : 2.8, 56.6, datum), geo.heightAt(p.x, p.z) + 0.13);
  });
}

function shaftRing(n, y, side, centerL, along, across, chamfer, capSlope = 0) {
  return [
    [-along + chamfer, -across],
    [along - chamfer, -across],
    [along, -across + chamfer],
    [along, across - chamfer],
    [along - chamfer, across],
    [-along + chamfer, across],
    [-along, across - chamfer],
    [-along, -across + chamfer],
  ].map(([s, l]) => framePoint(n, s, side * centerL + l, y + (capSlope * l * side) / across));
}
function connectRings(batch, lower, upper, colors, styles = []) {
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length;
    batch.face([lower[i], upper[i], upper[j], lower[j]], colors[i % colors.length], styles[i] ?? 0);
  }
}
function rectObstacle(obstacles, n, s, l, long, wide, h) {
  const pts = [
    [-long, -wide],
    [long, -wide],
    [long, wide],
    [-long, wide],
  ]
    .map(([a, b]) => framePoint(n, s + a, l + b, h))
    .map((p) => [p[0], p[2]]);
  obstacles.add(pts, h);
}

function portalLintel(batch, n, top, depth, rise) {
  let prev;
  for (let i = 0; i <= 18; i++) {
    const lateral = mix(-18.2, 18.2, i / 18),
      arch = Math.max(0, 1 - (lateral / 18.2) ** 2);
    const bottom = top - depth + rise * arch,
      upper = top + arch * 0.54;
    const ring = [
      [-2.62, bottom + 0.38],
      [-2.31, bottom],
      [2.31, bottom],
      [2.62, bottom + 0.38],
      [2.62, upper - 0.25],
      [2.23, upper],
      [-2.23, upper],
      [-2.62, upper - 0.25],
    ].map(([s, y]) => framePoint(n, s, lateral, y));
    if (!prev || i === 18) batch.face(i === 0 ? ring.toReversed() : ring, '#c8d1cb', towerFlood);
    if (prev)
      connectRings(
        batch,
        prev,
        ring,
        ['#a3b2b2', '#9eafaf', '#acbbbb', '#c0cace', '#cfdbd7', '#d6ddd9', '#c3cfce', '#b7c6ca'],
        [towerFlood, 0, towerFlood, litSurface.stone, towerFlood, 0, towerFlood, litSurface.stone]
      );
    prev = ring;
  }
}

// A compact, readable brush-stroke inscription across each upper lintel.
const letterStrokes = [
  [
    [
      [0.08, 0.94],
      [0.22, 0.84],
    ],
    [
      [0.05, 0.66],
      [0.2, 0.6],
    ],
    [
      [0.05, 0.12],
      [0.22, 0.38],
    ],
    [
      [0.45, 0.96],
      [0.34, 0.75],
    ],
    [
      [0.4, 0.84],
      [0.9, 0.84],
    ],
    [
      [0.44, 0.67],
      [0.36, 0.21],
      [0.86, 0.21],
    ],
    [
      [0.43, 0.67],
      [0.89, 0.67],
      [0.82, 0.09],
      [0.7, 0.07],
    ],
    [
      [0.24, 0.43],
      [0.97, 0.43],
    ],
    [
      [0.59, 0.6],
      [0.7, 0.51],
    ],
    [
      [0.55, 0.37],
      [0.66, 0.28],
    ],
  ],
  [
    [
      [0.05, 0.94],
      [0.19, 0.84],
    ],
    [
      [0.03, 0.67],
      [0.18, 0.61],
    ],
    [
      [0.05, 0.13],
      [0.22, 0.39],
    ],
    [
      [0.61, 0.96],
      [0.47, 0.77],
      [0.26, 0.61],
    ],
    [
      [0.62, 0.92],
      [0.76, 0.76],
      [0.96, 0.63],
    ],
    [
      [0.43, 0.62],
      [0.82, 0.62],
      [0.79, 0.4],
      [0.65, 0.34],
    ],
    [
      [0.41, 0.61],
      [0.4, 0.18],
      [0.49, 0.1],
      [0.85, 0.11],
      [0.91, 0.25],
    ],
  ],
  [
    [
      [0.07, 0.66],
      [0.93, 0.66],
    ],
    [
      [0.54, 0.97],
      [0.51, 0.67],
      [0.46, 0.49],
      [0.33, 0.29],
      [0.1, 0.11],
    ],
    [
      [0.53, 0.6],
      [0.62, 0.4],
      [0.76, 0.23],
      [0.93, 0.13],
    ],
  ],
  [
    [
      [0.05, 0.69],
      [0.38, 0.69],
    ],
    [
      [0.23, 0.98],
      [0.23, 0.08],
    ],
    [
      [0.23, 0.67],
      [0.13, 0.46],
      [0.04, 0.37],
    ],
    [
      [0.24, 0.58],
      [0.38, 0.43],
    ],
    [
      [0.48, 0.82],
      [0.85, 0.94],
    ],
    [
      [0.4, 0.67],
      [0.95, 0.67],
    ],
    [
      [0.66, 0.83],
      [0.62, 0.67],
      [0.52, 0.52],
      [0.4, 0.43],
    ],
    [
      [0.66, 0.65],
      [0.77, 0.52],
      [0.97, 0.43],
    ],
    [
      [0.56, 0.45],
      [0.55, 0.28],
      [0.49, 0.11],
    ],
    [
      [0.8, 0.46],
      [0.8, 0.08],
    ],
  ],
];
function bridgeName(batch, n, face) {
  for (let i = 0; i < 4; i++)
    for (const stroke of letterStrokes[i]) {
      const base = (i - 1.5) * 4.3;
      for (let k = 1; k < stroke.length; k++) {
        const [ax, ay] = stroke[k - 1],
          [bx, by] = stroke[k],
          len = Math.hypot(bx - ax, by - ay);
        const ox = (-(by - ay) / len) * 0.035,
          oy = ((bx - ax) / len) * 0.035;
        const point = (a, b) =>
          framePoint(n, face * 2.654, -face * (base + 3.18 * (a - 0.5)), 124.8 + b * 2.85);
        batch.face(
          [
            point(ax + ox, ay + oy),
            point(bx + ox, by + oy),
            point(bx - ox, by - oy),
            point(ax - ox, ay - oy),
          ],
          '#b85d3d',
          litSurface.spine
        );
      }
    }
}

function tower(batch, n, geo, lamps, obstacles) {
  for (const side of [-1, 1]) {
    const foot = framePoint(n, 0, side * 21.5, 0),
      floor = Math.max(-6, Math.min(5.2, geo.heightAt(foot[0], foot[2])));
    bridgeColumn(
      batch,
      n,
      0,
      side * 21.3,
      [
        [floor - 3, 11.1, 9.9],
        [2.6, 11.1, 9.9],
        [4.9, 9.1, 8.4],
        [5.8, 8.3, 7.6],
      ],
      '#a8b8b9',
      18
    );
    const levels = [
      [4.6, 21.4, 5.52, 3.86, 0.79],
      [12, 21.5, 5.22, 3.68, 0.77],
      [43, 20.5, 4.55, 3.21, 0.7],
      [58.5, 19.7, 4.2, 3.01, 0.68],
      [97, 18.02, 3.54, 2.69, 0.59],
      [122.5, 17.48, 3.33, 2.74, 0.6],
      [129.9, 17.4, 3.55, 2.87, 0.68],
      [133.0, 17.38, 3.52, 2.78, 0.76],
    ];
    let prior;
    for (const [y, l, s, w, c] of levels) {
      const ring = shaftRing(n, y, side, l, s, w, c, y > 132 ? 1.05 : 0);
      if (prior)
        connectRings(
          batch,
          prior,
          ring,
          ['#a5b8bc', '#d3d9d3', '#b5c2c5', '#e1e0d2', '#bac8c9', '#d0d8d4', '#afbdc2', '#d7dcd6'],
          [towerFlood, 0, 0, litSurface.stone, towerFlood, 0, 0, litSurface.stone]
        );
      prior = ring;
    }
    batch.top(prior, '#c6d0c9');
    const footL = side * 21.1,
      crownL = side * 17.4;
    rectObstacle(obstacles, n, 0, (footL + crownL) / 2, 5.65, 5.7, 134.4);
    for (const y of [6.2, 53.8, 124.1]) {
      const l = side * (y < 60 ? 20.4 : 17.5);
      lamps.add(...framePoint(n, -3.9, l, y), '#bedee6', y < 20 ? 3.1 : 2.1);
      lamps.add(...framePoint(n, 3.9, l, y), '#fbd5a3', 2.25);
    }
    lamps.add(...framePoint(n, 0.05, side * 17.55, 134.55), '#ff8e5f', 1.45);
    // A rounded cable saddle casing sits between the sloping outer cheeks.
    bridgeColumn(
      batch,
      n,
      0,
      crownL,
      [
        [128.3, 3.84, 1.3],
        [131.15, 3.66, 1.3],
        [132.0, 2.25, 0.9],
      ],
      '#82949c',
      12
    );
  }
  portalLintel(batch, n, 53.5, 8.65, 3.3);
  portalLintel(batch, n, 127.6, 7.2, 3.06);
  rectObstacle(obstacles, n, 0, 0, 2.75, 18.7, 128.1);
  for (const face of [-1, 1]) bridgeName(batch, n, face);
}

function cableY(s) {
  const absolute = Math.abs(s);
  if (absolute <= halfSpan) return 66.5 + (130.0 - 66.5) * (s / halfSpan) ** 2;
  const u = saturate((absolute - halfSpan) / (anchorStation - halfSpan));
  return mix(130, 47.0, u) - 16 * u * (1 - u);
}
function cableOffset(s) {
  return 17.4 + 1.65 * ease((Math.abs(s) - halfSpan) / (anchorStation - halfSpan));
}
function suspendedSystem(batch, lamps, obstacles) {
  for (const side of [-1, 1]) {
    const cableAt = (s) => framePoint(fairwayFrame(s), 0, side * cableOffset(s), cableY(s));
    for (const [from, to] of [
      [-anchorStation, -halfSpan],
      [-halfSpan, halfSpan],
      [halfSpan, anchorStation],
    ]) {
      const count = Math.ceil((to - from) / 10),
        points = Array.from({ length: count + 1 }, (_, i) => cableAt(mix(from, to, i / count)));
      pathTube(batch, points, 0.73, '#bec8c6', 8, cableLight);
      // Coarse obstacle strips follow the drooping cable rather than blocking the entire sky above the deck.
      for (let i = 1; i <= count; i += 2) {
        const a = mix(from, to, (i - 1) / count),
          b = mix(from, to, Math.min(i + 1, count) / count),
          width = 1.9;
        const obs = [
          [a, -width],
          [a, width],
          [b, width],
          [b, -width],
        ].map(([s, l]) => {
          const p = framePoint(fairwayFrame(s), 0, side * cableOffset(s) + l, 0);
          return [p[0], p[2]];
        });
        obstacles.add(obs, Math.max(cableY(a), cableY(b)) + 0.9);
      }
    }
    for (let s = -540; s <= 540; s += 12) {
      if (Math.abs(Math.abs(s) - halfSpan) < 3) continue;
      const n = fairwayFrame(s),
        attach = cableAt(s),
        deck = framePoint(n, 0, side * 16.5, n.h - 0.45);
      if (attach[1] > deck[1] + 1.9) {
        const illuminated = side > 0 ? s % 36 === 0 : s % 72 === 0;
        pathTube(
          batch,
          [deck, attach],
          illuminated ? 0.29 : 0.205,
          '#a6b5b7',
          5,
          illuminated ? cableLight : 0
        );
        if (s % 24 === 0) {
          const clampA = framePoint(n, -0.6, side * cableOffset(s), attach[1]),
            clampB = framePoint(n, 0.6, side * cableOffset(s), attach[1]);
          pathTube(batch, [clampA, clampB], 0.77, '#9eaaa8', 7);
        }
      }
      if (s % 24 === 0)
        lamps.add(
          attach[0],
          attach[1] + 0.57,
          attach[2],
          Math.abs(s) % 48 === 0 ? '#ffba75' : '#ffdca1',
          1.82
        );
    }
  }
}

function anchorHouse(batch, sign, geo, lamps, obstacles) {
  const n = fairwayFrame(sign * anchorStation),
    inside = -sign;
  const terrain = Math.max(1, geo.heightAt(n.x, n.z));
  const bottom = Math.min(terrain - 0.75, 35),
    low = Math.max(3.25, bottom + 1.1),
    top = 49.0;
  for (const side of [-1, 1]) {
    const along = [
      [-32, low],
      [-32, low + 6.3],
      [8, top],
      [24, top],
      [27, low],
    ];
    const opening = [
      [-15, low + 4],
      [16, low + 4],
      [14, top - 9],
    ];
    const outline = along.map((p) => new THREE.Vector2(...p)),
      hole = opening.map((p) => new THREE.Vector2(...p));
    const triangles = THREE.ShapeUtils.triangulateShape(outline, [hole]);
    const verts = [...along, ...opening];
    const pos = (point, l) => framePoint(n, inside * point[0], l, point[1]);
    const outside = side * 21.85,
      inner = side * 15.7;
    for (const tri of triangles)
      for (const l of [outside, inner])
        batch.face(
          tri.map((i) => pos(verts[i], l)),
          '#b8c2c0'
        );
    for (const ring of [along, opening])
      for (let j = 0; j < ring.length; j++) {
        const a = ring[j],
          b = ring[(j + 1) % ring.length];
        batch.face([pos(a, outside), pos(b, outside), pos(b, inner), pos(a, inner)], '#a4b0ad');
      }
    lamps.add(...framePoint(n, inside * 15, side * 19, top + 0.42), '#f5ce89', 1.5);
  }
  const cap = shaftRing(n, low + 2.3, 1, 0, 33.5, 23, 2.1),
    bed = shaftRing(n, bottom - 1.8, 1, 0, 33.8, 23.4, 2.1);
  connectRings(batch, bed, cap, ['#a9b1a9']);
  batch.top(cap, '#b8bdb4');
  rectObstacle(obstacles, n, 0, 0, 34, 23, top);
}

export function bridgeLanterns(batch, road, lamps, spacing = 42) {
  for (let d = 22; d < road.length; d += spacing)
    for (const side of [-1, 1]) {
      const n = road.step(d / road.length),
        lateral = side * 15.34;
      const foot = road.at(n, lateral, 0.36),
        bend = road.at(n, side * 15.38, 7.9);
      const toe = road.at(n, side * 14.92, 8.69),
        head = road.at(n, side * 12.89, 9.02);
      pathTube(batch, [foot, bend, toe, head], (t) => mix(0.22, 0.108, t), '#74898b', 5);
      pathTube(batch, [head, road.at(n, side * 12.05, 9.03)], 0.22, '#bcbeac', 5);
      lamps.add(...road.at(n, side * 12.3, 8.87), '#ffdc9b', 1.78);
    }
}

function approachPiers(batch, road, geo) {
  for (let d = 46; d < road.length - 14; d += 64) {
    const n = road.step(d / road.length);
    const s = (n.x - center[0]) * eastAxis.x + (n.z - center[1]) * eastAxis.y;
    if (Math.abs(s) < anchorStation + 34) continue;
    for (const l of [-8.7, 8.7]) {
      const p = road.at(n, l),
        base = Math.max(-4.2, geo.heightAt(p[0], p[2]) - 0.85);
      if (base >= n.h - 4.25) continue;
      const shoulder = Math.max(base + 0.05, n.h - 6.2),
        neck = Math.max(shoulder + 0.05, n.h - 4.65);
      bridgeColumn(
        batch,
        n,
        0,
        l,
        [
          [base, 2.15, 1.8],
          [shoulder, 1.7, 1.55],
          [neck, 2.15, 3.1],
          [n.h - 3.0, 2.6, 5.0],
        ],
        '#acb9ba',
        10
      );
    }
  }
}

// Reserve the two anchor foundations and the four individual tower footings.
// Existing waterfront buildings beside the viaduct retain their positions.
export function haicangReserved(x, z) {
  const dx = x - center[0],
    dz = z - center[1];
  const station = Math.abs(dx * eastAxis.x + dz * eastAxis.y);
  const across = Math.abs(-dx * eastAxis.y + dz * eastAxis.x);
  if (Math.abs(station - anchorStation) < 34.3 && across < 23.9) return true;
  return ((station - halfSpan) / 11.7) ** 2 + ((across - 21.3) / 10.5) ** 2 < 1;
}

/** Adds the sea crossing and returns its route for the game's existing two-way car traffic. */
export function buildHaicang(batch, geo, lamps, obstacles) {
  const road = makeMainRoad(geo);
  highwayDeck(batch, road, obstacles);
  approachPiers(batch, road, geo);
  for (const sign of [-1, 1]) {
    tower(batch, fairwayFrame(sign * halfSpan), geo, lamps, obstacles);
    anchorHouse(batch, sign, geo, lamps, obstacles);
  }
  suspendedSystem(batch, lamps, obstacles);
  bridgeLanterns(batch, road, lamps);
  return [road];
}
