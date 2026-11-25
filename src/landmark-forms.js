import { ShapeUtils, Vector2 } from 'three';
import { TAU, groundY, litSurface } from './scenery-mesh.js';

export function localFrame([x, z], angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return (u, v) => [x + c * u - s * v, z + s * u + c * v];
}

export const up = ([x, z], y) => [x, y, z];
export const rect = (xy, u, v, w, d) => [
  xy(u - w / 2, v - d / 2),
  xy(u + w / 2, v - d / 2),
  xy(u + w / 2, v + d / 2),
  xy(u - w / 2, v + d / 2),
];
export const ellipse = (xy, u, v, rx, rz, steps = 20, phase = 0) =>
  Array.from({ length: steps }, (_, i) => {
    const a = phase + (i * TAU) / steps;
    return xy(u + rx * Math.cos(a), v + rz * Math.sin(a));
  });

export function inRect(x, z, centre, angle, halfWidth, halfDepth) {
  const dx = x - centre[0],
    dz = z - centre[1];
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return Math.abs(dx * c + dz * s) < halfWidth && Math.abs(-dx * s + dz * c) < halfDepth;
}

export function foundation(batch, geo, ring, top, wall, paving, style = 13) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const bottomA = Math.min(groundY(geo, ...a) - 1.2, top - 0.35);
    const bottomB = Math.min(groundY(geo, ...b) - 1.2, top - 0.35);
    batch.face([up(a, bottomA), up(a, top), up(b, top), up(b, bottomB)], wall, style);
  }
  batch.top(
    ring.map((p) => up(p, top)),
    paving,
    style
  );
}

// A cut-stone terrace follows its hillside round the rim. The slab above is level.
export function terrace(batch, geo, ring, clearance = 0.42, paving = '#bbb09c') {
  const top = Math.max(...ring.map((p) => groundY(geo, ...p))) + clearance;
  foundation(batch, geo, ring, top, '#9c9485', paving);
  return top;
}

export function paveFootprint(batch, ring, height, color, subdivisions=2) {
  const triangles=ShapeUtils.triangulateShape(ring.map(([x,z])=>new Vector2(x,z)),[]);
  const half=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  function tileTriangle(a,b,c,depth) {
    if (!depth) {
      batch.top([a,b,c].map(p=>up(p,height(...p))),color,22);
      return;
    }
    const ab=half(a,b), bc=half(b,c), ca=half(c,a);
    for(const corners of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]]) tileTriangle(...corners,depth-1);
  }
  for(const [a,b,c] of triangles) tileTriangle(ring[a],ring[b],ring[c],subdivisions);
}

export function groundPaving(batch, geo, xy, [u0, u1, v0, v1], color) {
  const cols = Math.ceil((u1 - u0) / 10), rows = Math.ceil((v1 - v0) / 10);
  const points = Array.from({ length: rows + 1 }, (_, row) =>
    Array.from({ length: cols + 1 }, (_, col) => {
      const p = xy(u0 + (u1 - u0) * col / cols, v0 + (v1 - v0) * row / rows);
      return up(p, groundY(geo, ...p) + .22);
    })
  );
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++)
      batch.top([points[row][col], points[row][col + 1], points[row + 1][col + 1], points[row + 1][col]],
        color, 22);
}

// Hipped Fujian tile roof. The courses curve up from the drip edge to a long ridge.
// Both the eave and the end of the ridge sweep upward at the gables.
export function sweptRoof(batch, xy, u, v, w, d, eave, rise, tile, trim, lift = 1) {
  const a = w / 2,
    b = d / 2,
    ridge = Math.max(w * 0.19, a - b * 0.64);
  const corners = [
    [-a, -b],
    [a, -b],
    [a, b],
    [-a, b],
  ];
  const apex = [
    [-ridge, 0],
    [ridge, 0],
    [ridge, 0],
    [-ridge, 0],
  ];
  const levels = [0, 0.27, 0.57, 0.82, 1];
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4,
      endFace = side % 2 === 1;
    const point = (s, t) => {
      const outer = corners[side].map((n, i) => n + (corners[next][i] - n) * s);
      const inner = apex[side].map((n, i) => n + (apex[next][i] - n) * s);
      const tip = Math.pow(Math.abs(2 * s - 1), 4);
      const curve = (1 - t) * tip * 1.08 + t * (endFace ? 1 : tip) * 1.38;
      return up(
        xy(u + outer[0] * (1 - t) + inner[0] * t, v + outer[1] * (1 - t) + inner[1] * t),
        eave + rise * (0.43 * t + 0.57 * t * t) + lift * curve
      );
    };
    for (let i = 0; i < 10; i++) {
      const s = i / 10,
        end = (i + 1) / 10;
      const l = point(s, 0),
        r = point(end, 0);
      batch.face(
        [[l[0], l[1] - 0.34, l[2]], l, r, [r[0], r[1] - 0.34, r[2]]],
        trim,
        litSurface.portico
      );
      for (let j = 1; j < levels.length; j++) {
        const t = levels[j - 1],
          t1 = levels[j];
        const face = [point(s, t), point(end, t), point(end, t1), point(s, t1)];
        // The narrow gable slopes close in a triangular fan at the ridge.
        if (j === levels.length - 1 && endFace) face.pop();
        batch.top(
          face,
          tile,
          litSurface.glazedTile,
          0.38,
          [
            [s * w, t * d * 0.62],
            [end * w, t * d * 0.62],
            [end * w, t1 * d * 0.62],
            [s * w, t1 * d * 0.62],
          ].slice(0, face.length)
        );
      }
    }
    const rib = levels.map((t) => point(0, t));
    for (let i = 1; i < rib.length; i++) bead(batch, rib[i - 1], rib[i], 0.16, trim);
  }
  const main = Array.from({ length: 17 }, (_, i) => {
    const t = (i - 8) / 8;
    return up(xy(u + t * ridge, v), eave + rise + lift * 1.38 * t ** 4 + 0.12);
  });
  for (let i = 1; i < main.length; i++) bead(batch, main[i - 1], main[i], 0.25, trim);
  for (const side of [-1, 1]) {
    const start = main[side < 0 ? 0 : 16];
    const end = up(xy(u + side * (ridge + 1.45 * lift), v), start[1] + 1.15 * lift);
    bead(batch, start, end, 0.16, trim);
  }
}

// Narrow architectural trim. A triangular section stays readable at grazing angles.
function bead(batch, a, b, radius, color) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    length = Math.hypot(dx, dz);
  if (length < 0.001) return;
  const x = (-dz / length) * radius,
    z = (dx / length) * radius;
  const ring = (p) => [
    [p[0] + x, p[1], p[2] + z],
    [p[0], p[1] + radius * 1.3, p[2]],
    [p[0] - x, p[1], p[2] - z],
  ];
  const l = ring(a),
    r = ring(b);
  for (let i = 0; i < 2; i++) batch.top([l[i], r[i], r[i + 1], l[i + 1]], color);
}
