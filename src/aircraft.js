import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { canvasOf, canvasMap, standard, surface, sectionAt, mesh, ellipsoid, rod, batch };

const PI = Math.PI;
const TAU = 2 * PI;
const { clamp, lerp, smoothstep } = THREE.MathUtils;
const IVORY = '#f4ead2';
const INK = '#203f49';
const OCHRE = '#cf8742';
const WING_SPAN = 5.29;
const WHEEL_LEVEL = -1.025;
const WHEEL_RADIUS = 0.305;
const GROUND_CLEARANCE = WHEEL_RADIUS - WHEEL_LEVEL;

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

function canvasMap(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function path(context, points, paint, closed = false) {
  context.beginPath();
  points.forEach(([x, y], i) => (i ? context.lineTo(x, y) : context.moveTo(x, y)));
  if (closed) context.closePath();
  if (closed) {
    context.fillStyle = paint;
    context.fill();
  } else {
    context.strokeStyle = paint;
    context.stroke();
  }
}

function tern(context, x, y, size, color) {
  context.save();
  context.translate(x, y);
  context.scale(size, size);
  path(
    context,
    [
      [-0.98, -0.31],
      [-0.44, -0.28],
      [-0.08, -0.08],
      [0.27, -0.41],
      [0.99, -0.57],
      [0.43, -0.22],
      [0.2, -0.04],
      [0.4, -0.06],
      [0.03, 0.28],
      [-0.28, 0.05],
    ],
    color,
    true
  );
  context.restore();
}

const firstZ = -2.43;
const lastZ = 4.48;
const paintBottom = -0.66;
const paintTop = 1.04;

function makeHullMap() {
  const [canvas, c] = canvasOf(2048, 1024);
  const rowH = 512;
  const px = (z) => ((z - firstZ) / (lastZ - firstZ)) * canvas.width;
  const py = (y) => ((paintTop - y) / (paintTop - paintBottom)) * rowH;
  const line = (z) =>
    -0.135 - 0.107 * Math.exp(-((z + 0.15) ** 2) / 1.95) + 0.402 * smoothstep(z, 0.25, 4.57);
  function band(color, from, to) {
    const pts = [];
    for (let i = 0; i <= 96; i++) {
      const z = lerp(firstZ, lastZ, i / 96);
      pts.push([px(z), py(from(z))]);
    }
    for (let i = 96; i >= 0; i--) {
      const z = lerp(firstZ, lastZ, i / 96);
      pts.push([px(z), py(to(z))]);
    }
    path(c, pts, color, true);
  }
  for (let side = 0; side < 2; side++) {
    c.save();
    c.translate(0, side * rowH);
    c.fillStyle = IVORY;
    c.fillRect(0, 0, canvas.width, rowH);
    band(INK, line, () => paintBottom);
    band('#7b9692', (z) => line(z) + 0.012, line);
    band(
      OCHRE,
      (z) => line(z) + 0.071,
      (z) => line(z) + 0.025
    );
    band(
      '#e4b66e',
      (z) => line(z) + 0.082,
      (z) => line(z) + 0.071
    );
    const seam = (points) => {
      c.lineWidth = 1.1;
      path(
        c,
        points.map(([z, y]) => [px(z), py(y)]),
        'rgba(45,55,52,.46)'
      );
    };
    seam([
      [-2.27, 0.17],
      [-2.21, 0.07],
      [-1.89, 0.015],
      [-1.37, 0.06],
      [-1.32, 0.18],
    ]);
    seam([
      [-1.32, 0.19],
      [-1.39, -0.12],
      [-1.27, -0.35],
    ]);
    seam([
      [-0.97, 0.18],
      [-0.985, -0.19],
      [-0.93, -0.35],
      [-0.73, -0.415],
      [0.38, -0.411],
      [0.54, -0.338],
      [0.63, 0.19],
    ]);
    seam([
      [1.18, 0.69],
      [1.27, 0.31],
      [1.32, -0.18],
    ]);
    seam([
      [2.66, 0.52],
      [2.69, 0.3],
      [2.71, 0.02],
    ]);
    // Flush Dzus fasteners and the painted cowling access cover.
    for (let j = 0; j < 9; j++) {
      const z = -2.22 + j * 0.093;
      const y = 0.052 + 0.017 * Math.cos(j * 0.7);
      c.fillStyle = '#9e9d8e';
      c.beginPath();
      c.arc(px(z), py(y), 1.45, 0, TAU);
      c.fill();
      c.fillStyle = '#fcf6df';
      c.fillRect(px(z) - 0.7, py(y) - 0.9, 1, 0.55);
    }
    c.save();
    c.translate(px(2.2), py(0.265));
    if (side === 1) c.scale(-1, 1);
    c.fillStyle = INK;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = 'italic 600 62px "Arial Narrow", Arial, sans-serif';
    c.fillText('B-LD24', 0, 0, 426);
    c.restore();
    c.save();
    c.translate(px(-1.58), py(0.153));
    if (side === 1) c.scale(-1, 1);
    tern(c, -28, 0, 18, INK);
    c.fillStyle = INK;
    c.font = '600 11px Arial,sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('L U D A O', -8, 0);
    c.restore();
    c.restore();
  }
  return canvasMap(canvas);
}

function makeWingMap() {
  const [canvas, c] = canvasOf(2048, 768);
  const h = 384;
  const xAt = (x) => (x / WING_SPAN + 1) * 1024;
  for (let face = 0; face < 2; face++) {
    c.save();
    c.translate(0, h * face);
    c.fillStyle = face === 0 ? IVORY : '#e5dfcd';
    c.fillRect(0, 0, 2048, h);
    for (const side of [-1, 1]) {
      const strip = (a, b, slant, color) =>
        path(
          c,
          [
            [xAt(side * a), 0],
            [xAt(side * b), 0],
            [xAt(side * (b + slant)), h],
            [xAt(side * (a + slant)), h],
          ],
          color,
          true
        );
      strip(4.71, 5.66, -0.1, INK);
      strip(4.5, 4.69, -0.1, OCHRE);
      strip(4.43, 4.456, -0.1, '#bea76f');
      c.lineWidth = 1.4;
      path(
        c,
        [
          [xAt(side * 0.68), h * 0.715],
          [xAt(side * 4.81), h * 0.715],
        ],
        'rgba(41,58,58,.68)'
      );
      c.lineWidth = 1;
      for (const s of [0.65, 1.61, 2.66, 3.33, 4.12]) {
        path(
          c,
          [
            [xAt(side * s), h * 0.04],
            [xAt(side * s), h * 0.708],
          ],
          'rgba(55,68,60,.19)'
        );
        for (let q = 0.08; q < 0.69; q += 0.038) {
          c.fillStyle = 'rgba(70,79,70,.28)';
          c.fillRect(xAt(side * s) + 1.9, h * q, 1.1, 1.2);
        }
      }
      for (const s of [0.71, 2.68, 4.76]) {
        path(
          c,
          [
            [xAt(side * s), h * 0.713],
            [xAt(side * (s + 0.012)), h * 0.98],
          ],
          'rgba(33,54,56,.60)'
        );
      }
      for (const s of [1.48, 1.78]) {
        c.strokeStyle = 'rgba(45,65,65,.37)';
        c.lineWidth = 1.4;
        c.beginPath();
        c.ellipse(xAt(side * s), h * 0.47, 7, 13, 0, 0, TAU);
        c.stroke();
      }
    }
    c.save();
    c.translate(xAt(face === 0 ? -2.77 : 2.77), h * 0.386);
    if (face === 1) c.scale(-1, 1);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#344d52';
    c.font = 'italic 500 ' + (face === 0 ? '79' : '104') + 'px Arial,sans-serif';
    c.fillText('B-LD24', 0, 0, 566);
    c.restore();
    for (const side of [-1, 1]) {
      c.fillStyle = 'rgba(128,132,112,.42)';
      c.fillRect(xAt(side * 0.53) - 4, h * 0.64, 8, h * 0.26);
    }
    c.restore();
  }
  return canvasMap(canvas);
}

function makeFinMap() {
  const [canvas, c] = canvasOf(1024, 512);
  for (let side = 0; side < 2; side++) {
    c.save();
    c.translate(side * 512, 0);
    c.fillStyle = IVORY;
    c.fillRect(0, 0, 512, 512);
    path(
      c,
      [
        [0, 0],
        [512, 0],
        [512, 104],
        [0, 246],
      ],
      INK,
      true
    );
    path(
      c,
      [
        [0, 249],
        [512, 108],
        [512, 130],
        [0, 274],
      ],
      OCHRE,
      true
    );
    c.lineWidth = 1.6;
    path(
      c,
      [
        [392, 4],
        [414, 506],
      ],
      'rgba(51,64,62,.5)'
    );
    c.save();
    c.translate(264, 93);
    if (side === 1) c.scale(-1, 1);
    tern(c, 0, 0, 70, '#f8e7c6');
    c.restore();
    c.lineWidth = 1;
    for (const y of [294, 385])
      path(
        c,
        [
          [412, y],
          [512, y - 3],
        ],
        'rgba(75,80,70,.28)'
      );
    c.restore();
  }
  return canvasMap(canvas);
}

const standard = (color, roughness = 0.54, metalness = 0.05, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

function surface(nU, nV, point, reverse = false) {
  const positions = [],
    uvs = [],
    indices = [];
  for (let i = 0; i <= nU; i++)
    for (let j = 0; j <= nV; j++) {
      const [x, y, z, u, v] = point(i / nU, j / nV);
      positions.push(x, y, z);
      uvs.push(u ?? i / nU, v ?? j / nV);
    }
  for (let i = 0; i < nU; i++)
    for (let j = 0; j < nV; j++) {
      const a = i * (nV + 1) + j,
        b = a + nV + 1,
        c = b + 1,
        d = a + 1;
      if (reverse) indices.push(a, d, b, b, d, c);
      else indices.push(a, b, d, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// Shape stations: longitudinal position, half breadth, window sill, crown and keel.
const hullStations = [
  [-2.43, 0.337, 0.004, 0.219, -0.238],
  [-2.34, 0.426, 0.024, 0.264, -0.305],
  [-2.08, 0.488, 0.063, 0.301, -0.389],
  [-1.7, 0.548, 0.111, 0.323, -0.452],
  [-1.31, 0.592, 0.167, 0.342, -0.494],
  [-0.73, 0.636, 0.161, 0.838, -0.553],
  [-0.13, 0.655, 0.151, 0.868, -0.554],
  [0.5, 0.648, 0.151, 0.856, -0.511],
  [0.91, 0.623, 0.155, 0.813, -0.446],
  [1.3, 0.578, 0.161, 0.702, -0.368],
  [1.8, 0.492, 0.166, 0.608, -0.264],
  [2.49, 0.366, 0.174, 0.492, -0.131],
  [3.1, 0.25, 0.184, 0.401, -0.038],
  [3.77, 0.144, 0.192, 0.338, 0.066],
  [4.24, 0.087, 0.205, 0.306, 0.123],
  [4.43, 0.065, 0.214, 0.271, 0.176],
  [4.48, 0.018, 0.22, 0.239, 0.206],
];

// Cubic interpolation preserves smooth panel lines through closely spaced formers.
function sectionAt(table, x) {
  let hi = 1;
  while (hi < table.length - 1 && x > table[hi][0]) hi++;
  const a = table[hi - 1],
    b = table[hi],
    p = table[Math.max(0, hi - 2)],
    q = table[Math.min(table.length - 1, hi + 1)];
  const d = b[0] - a[0],
    t = clamp((x - a[0]) / d, 0, 1),
    t2 = t * t,
    t3 = t2 * t;
  return a.slice(1).map((v, k) => {
    const col = k + 1;
    const m0 = ((b[col] - p[col]) * d) / (b[0] - p[0]),
      m1 = ((q[col] - a[col]) * d) / (q[0] - a[0]);
    return (
      (2 * t3 - 3 * t2 + 1) * v + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b[col] + (t3 - t2) * m1
    );
  });
}

function mesh(group, g, m, position) {
  const o = new THREE.Mesh(g, m);
  if (position) o.position.fromArray(position);
  group.add(o);
  return o;
}

function ellipsoid(group, material, position, radius) {
  const extent = Math.max(...radius),
    width = extent > 0.14 ? 22 : extent > 0.08 ? 16 : extent > 0.035 ? 12 : 8;
  const o = mesh(
    group,
    new THREE.SphereGeometry(1, width, Math.max(5, Math.round(width * 0.56))),
    material,
    position
  );
  o.scale.fromArray(radius);
  return o;
}

function rounded(group, material, position, size, r = 0.025) {
  return mesh(group, new RoundedBoxGeometry(...size, 2, r), material, position);
}

function rod(group, material, aa, bb, rA, rB = rA, segments = 10) {
  const a = new THREE.Vector3(...aa),
    b = new THREE.Vector3(...bb),
    direction = b.clone().sub(a);
  const o = mesh(group, new THREE.CylinderGeometry(rB, rA, direction.length(), segments), material);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  o.position.copy(a).add(b).multiplyScalar(0.5);
  return o;
}

function tube(group, material, points, radius, steps = 18) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return mesh(group, new THREE.TubeGeometry(curve, steps, radius, 7, false), material);
}

// Streamlined struts carry a real airfoil section, with their chord facing the airflow.
function strut(group, material, aa, bb, chordA, chordB, thickness) {
  const a = new THREE.Vector3(...aa),
    b = new THREE.Vector3(...bb),
    axis = b.clone().sub(a).normalize();
  const across = axis
    .clone()
    .cross(new THREE.Vector3(0, 0, 1))
    .normalize();
  const chord = across.clone().cross(axis).normalize();
  const g = surface(
    2,
    18,
    (u, v) => {
      const q = v * TAU,
        breadth = lerp(chordA, chordB, u);
      const p = a
        .clone()
        .lerp(b, u)
        .addScaledVector(chord, Math.cos(q) * breadth * 0.5)
        .addScaledVector(across, Math.sin(q) * thickness * (1 - 0.23 * Math.cos(q)));
      return [p.x, p.y, p.z];
    },
    true
  );
  return mesh(group, g, material);
}

function spinSolid(group, material, profile, position, axis = 'z') {
  const g = new THREE.LatheGeometry(
    profile.map(([r, a]) => new THREE.Vector2(r, a)),
    40
  );
  const o = mesh(group, g, material, position);
  if (axis === 'z') o.rotation.x = PI / 2;
  if (axis === 'x') o.rotation.z = -PI / 2;
  return o;
}

// All static parts sharing paint are one draw call. Glass and moving systems stay independent.
function batch(group, castShadow = true) {
  const batches = new Map(),
    finishes = new Map();
  for (const part of [...group.children]) {
    if (!part.isMesh) continue;
    part.updateMatrix();
    const original = part.geometry;
    const g = original.index ? original.toNonIndexed() : original;
    g.applyMatrix4(part.matrix);
    if (!g.attributes.uv)
      g.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 2).fill(0), 2)
      );
    let m = part.material;
    if (m.isMeshStandardMaterial && !m.transparent && !m.map && m.emissive.getHex() === 0) {
      const roughness = Math.round(m.roughness * 6) / 6,
        metalness = Math.round(m.metalness * 6) / 6;
      const key = roughness + ',' + metalness;
      if (!finishes.has(key))
        finishes.set(key, standard(0xffffff, roughness, metalness, { vertexColors: true }));
      const colors = new Float32Array(g.attributes.position.count * 3);
      for (let k = 0; k < colors.length; k += 3) m.color.toArray(colors, k);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      m = finishes.get(key);
    }
    if (!batches.has(m)) batches.set(m, []);
    batches.get(m).push(g);
    group.remove(part);
    if (g !== original) original.dispose();
  }
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    const body = mesh(group, geometry, material);
    body.castShadow = castShadow && !material.transparent;
    for (const old of geometries) old.dispose();
  }
}

function hull(group, m) {
  for (const side of [-1, 1]) {
    function shell(z0, z1, upper, subdivisions) {
      const g = surface(
        subdivisions,
        17,
        (u, v) => {
          const z = lerp(z0, z1, u),
            [w, sill, top, bottom] = sectionAt(hullStations, z),
            q = (v * PI) / 2;
          const x = side * w * Math.cos(q) ** (upper ? 0.82 : 0.74);
          const y = upper
            ? sill + (top - sill) * Math.sin(q) ** 0.78
            : sill - (sill - bottom) * Math.sin(q) ** 0.78;
          const texV = (y - paintBottom) / (paintTop - paintBottom);
          return [x, y, z, (z - firstZ) / (lastZ - firstZ), (side === 1 ? 0 : 0.5) + texV * 0.5];
        },
        upper ? side === 1 : side === -1
      );
      mesh(group, g, m.hull);
    }
    shell(firstZ, lastZ, false, 100);
    shell(firstZ, -1.31, true, 18);
    shell(1.3, lastZ, true, 52);
  }
  ellipsoid(group, m.cream, [0, 0.002, -2.425], [0.335, 0.222, 0.023]);
  for (const s of [-1, 1]) {
    const rim = ellipsoid(group, m.metal, [s * 0.241, 0.04, -2.45], [0.096, 0.063, 0.018]);
    rim.rotation.z = -s * 0.14;
    const inlet = ellipsoid(group, m.black, [s * 0.242, 0.04, -2.463], [0.082, 0.049, 0.014]);
    inlet.rotation.z = -s * 0.14;
    for (let j = 0; j < 3; j++)
      rod(
        group,
        m.graphite,
        [s * 0.244 - 0.055, 0.02 + j * 0.015, -2.477],
        [s * 0.244 + 0.054, 0.02 + j * 0.015, -2.477],
        0.0023
      );
    const handle = rounded(group, m.metal, [s * 0.657, 0.075, 0.37], [0.017, 0.024, 0.115], 0.009);
    handle.rotation.x = -0.06;
  }
  tube(
    group,
    m.exhaust,
    [
      [-0.37, -0.3, -1.85],
      [-0.414, -0.401, -1.81],
      [-0.44, -0.471, -1.71],
      [-0.437, -0.476, -1.57],
    ],
    0.047,
    12
  );
  ellipsoid(group, m.black, [-0.437, -0.474, -1.566], [0.04, 0.037, 0.01]);
}

const wingStations = [
  [0, -0.814, 0.99, 0.934, 1],
  [0.67, -0.812, 0.986, 0.934, 1],
  [2.42, -0.765, 0.923, 0.995, 0.98],
  [3.54, -0.679, 0.844, 1.047, 0.96],
  [4.66, -0.565, 0.727, 1.107, 0.94],
  [4.97, -0.503, 0.664, 1.121, 0.89],
  [5.15, -0.425, 0.545, 1.132, 0.77],
  [5.25, -0.304, 0.385, 1.137, 0.57],
  [5.29, -0.116, 0.139, 1.138, 0.2],
];
function aerofoil(t, ratio) {
  return (
    5 * ratio * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1015 * t ** 4)
  );
}
function wingPoint(side, s, t, face) {
  const [front, back, mid, thick] = sectionAt(wingStations, s),
    chord = back - front;
  const camber = t < 0.4 ? (0.022 / 0.16) * (0.8 * t - t * t) : (0.022 / 0.36) * (0.2 + 0.8 * t - t * t);
  const y = mid + chord * (camber + face * aerofoil(t, 0.132) * thick);
  const x = side * s;
  return [x, y, front + t * chord, (x / WING_SPAN + 1) * 0.5, (face === 1 ? 0.5 : 0) + (1 - t) * 0.5];
}
function wings(group, m) {
  for (const s of [-1, 1]) {
    for (const face of [-1, 1]) {
      const g = surface(
        35,
        28,
        (u, v) => wingPoint(s, u * WING_SPAN, (1 - Math.cos(v * PI)) * 0.5, face),
        s === face
      );
      mesh(group, g, m.wing);
    }
    const end = surface(
      20,
      1,
      (u, v) => {
        const p = wingPoint(s, WING_SPAN, (1 - Math.cos(u * PI)) * 0.5, v === 0 ? -1 : 1);
        return p;
      },
      s === 1
    );
    mesh(group, end, m.navy);
    strut(group, m.cream, [s * 0.551, -0.313, 0.005], [s * 3.23, 0.97, -0.052], 0.129, 0.145, 0.029);
    ellipsoid(group, m.cream, [s * 0.559, -0.306, 0.006], [0.062, 0.055, 0.105]);
    ellipsoid(group, m.cream, [s * 3.225, 0.955, -0.047], [0.078, 0.047, 0.118]);
    // Little flap-track fairings are visible from the side windows.
    for (const span of [1.14, 2.13, 3.42, 4.39]) {
      const p = wingPoint(s, span, 0.75, -1);
      ellipsoid(group, m.cream, [p[0], p[1] - 0.018, p[2]], [0.02, 0.025, 0.091]);
    }
  }
  // Brass pitot mast forward and below the port wing.
  tube(
    group,
    m.metal,
    [
      [-2.52, 0.954, -0.044],
      [-2.52, 0.813, -0.051],
      [-2.52, 0.792, -0.15],
      [-2.52, 0.792, -0.3],
    ],
    0.012,
    10
  );
  const fair = ellipsoid(group, m.cream, [-3.92, 1.101, -0.612], [0.172, 0.061, 0.083]);
  fair.rotation.y = -0.1;
  ellipsoid(group, m.landing, [-3.92, 1.107, -0.667], [0.137, 0.044, 0.029]);
}

function tail(group, m) {
  const stages = [
    [0.255, 2.56, 4.38, 0.118],
    [0.49, 2.75, 4.445, 0.107],
    [0.85, 3.022, 4.46, 0.081],
    [1.18, 3.239, 4.468, 0.061],
    [1.48, 3.419, 4.449, 0.053],
    [1.64, 3.53, 4.391, 0.042],
    [1.691, 3.62, 4.301, 0.037],
    [1.712, 3.72, 4.185, 0.017],
  ];
  for (const side of [-1, 1]) {
    const fin = surface(
      24,
      24,
      (u, v) => {
        const y = lerp(0.255, 1.712, u),
          [lead, trail, breadth] = sectionAt(stages, y);
        const t = (1 - Math.cos(v * PI)) * 0.5;
        const x = side * breadth * (0.045 + aerofoil(t, 0.16) * 12.45);
        return [x, y, lerp(lead, trail, t), (side === 1 ? 0.5 : 0) + t * 0.5, u];
      },
      side === -1
    );
    mesh(group, fin, m.fin);
    for (const face of [-1, 1]) {
      const stab = surface(
        22,
        17,
        (u, v) => {
          const q = (1 - Math.cos(v * PI)) * 0.5,
            span = u * 1.72;
          const cap = 0.25 * smoothstep(u, 0.84, 1);
          const lead = 3.08 + 0.62 * u + cap,
            trail = 4.43 - 0.13 * u - 0.13 * smoothstep(u, 0.92, 1);
          const y = 0.304 + 0.059 * u + (trail - lead) * aerofoil(q, 0.088) * face;
          return [side * span, y, lerp(lead, trail, q)];
        },
        side === face
      );
      mesh(group, stab, m.cream);
    }
    const hinge = [];
    for (let i = 0; i < 11; i++) {
      const u = 0.19 + 0.074 * i,
        lead = 3.08 + 0.62 * u + 0.25 * smoothstep(u, 0.84, 1),
        trail = 4.43 - 0.13 * u - 0.13 * smoothstep(u, 0.92, 1);
      hinge.push([
        side * u * 1.72,
        0.304 + 0.059 * u + (trail - lead) * aerofoil(0.68, 0.088) + 0.001,
        lerp(lead, trail, 0.68),
      ]);
    }
    tube(group, m.panelSeam, hinge, 0.0037);
  }
}

function wheel(group, m, x, y, z, radius, width) {
  const tyreProfile = [
    [0.48, -0.42],
    [0.62, -0.5],
    [0.79, -0.5],
    [0.935, -0.365],
    [0.995, -0.18],
    [1, 0.04],
    [0.99, 0.24],
    [0.93, 0.38],
    [0.8, 0.49],
    [0.63, 0.5],
    [0.48, 0.42],
    [0.48, -0.42],
  ];
  const profile = tyreProfile.map(([r, a]) => [r * radius, a * width]);
  spinSolid(group, m.tyre, profile, [x, y, z], 'x');
  for (const n of [-1, 1]) {
    const outer = x + n * width * 0.46;
    spinSolid(
      group,
      m.metal,
      [
        [0.005, -0.005],
        [radius * 0.43, -0.005],
        [radius * 0.48, 0.007],
        [radius * 0.45, 0.017],
        [0, 0.019],
      ],
      [outer, y, z],
      'x'
    );
    ellipsoid(group, m.graphite, [x + n * width * 0.58, y, z], [0.012, 0.061, 0.061]);
    for (let j = 0; j < 5; j++) {
      const a = (j * TAU) / 5;
      ellipsoid(
        group,
        m.graphite,
        [x + n * width * 0.55, y + Math.cos(a) * radius * 0.29, z + Math.sin(a) * radius * 0.29],
        [0.006, 0.009, 0.009]
      );
    }
  }
  // Recessed circumferential tread. Slightly varying radii follow the tyre crown.
  for (const offset of [-0.19, 0.08, 0.24]) {
    const ring = mesh(
      group,
      new THREE.TorusGeometry(radius * (1 - 0.028 * Math.abs(offset) * 2), 0.0025, 5, 40),
      m.tread,
      [x + offset * width, y, z]
    );
    ring.rotation.y = PI / 2;
  }
}

function landingGear(group, m) {
  for (const s of [-1, 1]) {
    const root = [s * 0.406, -0.367, 0.105],
      knee = [s * 0.901, -0.817, 0.217],
      axle = [s * 1.001, WHEEL_LEVEL, 0.257];
    strut(group, m.cream, root, knee, 0.205, 0.136, 0.038);
    strut(group, m.metal, knee, axle, 0.105, 0.078, 0.034);
    rod(group, m.metal, [s * 0.96, WHEEL_LEVEL, 0.258], [s * 1.086, WHEEL_LEVEL, 0.258], 0.039);
    wheel(group, m, s * 1.065, WHEEL_LEVEL, 0.258, WHEEL_RADIUS, 0.174);
    tube(
      group,
      m.graphite,
      [
        [s * 0.45, -0.412, 0.19],
        [s * 0.73, -0.663, 0.24],
        [s * 0.886, -0.82, 0.26],
        [s * 0.982, -0.99, 0.28],
      ],
      0.008,
      12
    );
    rounded(group, m.grip, [s * 0.817, -0.704, 0.27], [0.18, 0.025, 0.088], 0.008);
  }
  const noseR = 0.227,
    noseY = -GROUND_CLEARANCE + noseR,
    noseZ = -1.585;
  rod(group, m.graphite, [0, -0.385, -1.75], [0, -0.715, -1.667], 0.064, 0.045);
  rod(group, m.metal, [0, -0.68, -1.676], [0, -0.908, -1.626], 0.034, 0.032);
  for (const s of [-1, 1]) {
    tube(
      group,
      m.cream,
      [
        [s * 0.027, -0.864, -1.632],
        [s * 0.09, -0.906, -1.623],
        [s * 0.108, -1.012, -1.598],
        [s * 0.1, noseY, noseZ],
      ],
      0.023,
      10
    );
  }
  wheel(group, m, 0, noseY, noseZ, noseR, 0.133);
}

function makeGlass() {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    forceSinglePass: true,
    uniforms: { night: { value: 0 }, interior: { value: 0 } },
    vertexShader: [
      '#include <common>',
      '#include <logdepthbuf_pars_vertex>',
      'varying vec3 wNormal; varying vec3 wPosition;',
      'void main(){',
      'vec4 world=modelMatrix*vec4(position,1.); wPosition=world.xyz;',
      'wNormal=normalize(mat3(modelMatrix)*normal);',
      'gl_Position=projectionMatrix*viewMatrix*world;',
      '#include <logdepthbuf_vertex>',
      '}',
    ].join('\n'),
    fragmentShader: [
      '#include <common>',
      '#include <logdepthbuf_pars_fragment>',
      'uniform float night; uniform float interior; varying vec3 wNormal; varying vec3 wPosition;',
      'void main(){',
      '#include <logdepthbuf_fragment>',
      'vec3 N=normalize(wNormal); vec3 V=normalize(cameraPosition-wPosition);',
      'float facing=abs(dot(N,V)); float edge=pow(1.-facing,2.4);',
      'vec3 R=reflect(-V,N); float skyline=exp(-abs(R.y-.08)*8.0);',
      'vec3 sky=mix(vec3(.062,.157,.165),vec3(.40,.62,.68),smoothstep(-.15,.8,R.y));',
      'sky=mix(sky,vec3(.74,.64,.43),skyline*.43);',
      'sky=mix(sky,vec3(.043,.078,.14),night*.74);',
      'float alpha=(.122+edge*.41+skyline*.060)*mix(1.,.32,interior);',
      'gl_FragColor=vec4(sky,alpha);',
      '#include <tonemapping_fragment>',
      '#include <colorspace_fragment>',
      '}',
    ].join('\n'),
  });
}

function canopy(shell, inside, glazing, m) {
  const crown = (x, sill, top) =>
    sill + (top - sill) * Math.max(0, 1 - Math.abs(x) ** (2 / 0.82)) ** (0.78 / 2);
  function front(x, t) {
    const z = lerp(-1.31, -0.716, t) + 0.046 * t * x * x - 0.043 * Math.sin(PI * t) * (1 - x * x);
    const y = lerp(crown(x, 0.167, 0.342), 0.846 - 0.048 * x * x, t);
    return [lerp(0.592, 0.54, t) * x, y, z];
  }
  function rear(x, t) {
    const z = lerp(1.3, 0.678, t) + 0.021 * t * x * x + 0.034 * Math.sin(t * PI) * (1 - x * x);
    const y = lerp(crown(x, 0.161, 0.702), 0.851 - 0.047 * x * x, t);
    return [lerp(0.578, 0.553, t) * x, y, z];
  }
  function sidePane(side, h, t) {
    const a = front(side, t),
      b = rear(side, t);
    const p = a.map((v, i) => lerp(v, b[i], h));
    const breadth = sectionAt(hullStations, lerp(-1.31, 1.3, h))[0];
    p[0] += side * (1 - t) * (breadth - lerp(0.592, 0.578, h));
    p[0] += side * 0.009 * Math.sin(t * PI) * Math.sin(h * PI);
    return p;
  }
  const line = (fn, count = 22) => Array.from({ length: count + 1 }, (_, i) => fn(i / count));
  mesh(
    glazing,
    surface(34, 12, (u, t) => front(u * 2 - 1, t)),
    m.glass
  );
  mesh(
    glazing,
    surface(32, 10, (u, t) => rear(u * 2 - 1, t), true),
    m.glass
  );
  for (const s of [-1, 1]) {
    mesh(
      glazing,
      surface(26, 9, (u, t) => sidePane(s, u, t), s === -1),
      m.glass
    );
    tube(
      shell,
      m.gasket,
      line((u) => sidePane(s, u, 0)),
      0.021,
      28
    );
    tube(
      shell,
      m.cream,
      line((u) => sidePane(s, u, 1)),
      0.034,
      24
    );
    for (const [fraction, r] of [
      [0, 0.028],
      [0.647, 0.029],
      [1, 0.033],
    ]) {
      const points = line((t) => sidePane(s, fraction, t), 12);
      tube(shell, m.gasket, points, r + 0.006, 12);
      tube(
        shell,
        m.cream,
        points.map(([x, y, z]) => [x + s * 0.009, y, z]),
        r,
        12
      );
      tube(
        inside,
        m.trim,
        points.map(([x, y, z]) => [x - s * 0.014, y, z]),
        r * 0.8,
        12
      );
    }
    // Recessed rear window divider and the opening quarter-light latch.
    const latch = sidePane(s, 0.26, 0.08);
    rounded(inside, m.metal, [latch[0] - s * 0.023, latch[1], latch[2]], [0.031, 0.023, 0.083], 0.008);
  }
  for (const fn of [front, rear]) {
    tube(
      shell,
      m.gasket,
      line((u) => fn(u * 2 - 1, 0), 38),
      0.014,
      36
    );
    tube(
      shell,
      m.cream,
      line((u) => fn(u * 2 - 1, 1), 32),
      0.024,
      26
    );
  }
  function roof(u, v) {
    const a = front(u * 2 - 1, 1),
      b = rear(u * 2 - 1, 1);
    return [lerp(a[0], b[0], v), lerp(a[1], b[1], v) + 0.037 * Math.sin(v * PI), lerp(a[2], b[2], v)];
  }
  mesh(shell, surface(20, 12, roof, true), m.cream);
  mesh(
    inside,
    surface(20, 12, (u, v) => {
      const p = roof(u, v);
      p[1] -= 0.023;
      return p;
    }),
    m.headliner
  );
  rod(shell, m.cream, [0, 0.94, 0.72], [0, 1.3, 0.8], 0.022, 0.009, 10);
  rod(shell, m.graphite, [0, 1.293, 0.8], [0, 1.432, 0.84], 0.005, 0.004, 8);
  rod(shell, m.metal, [0.006, 0.632, 1.92], [0.006, 0.794, 2.06], 0.008, 0.005);
}

function addInterior(cabin, pilot, m) {
  rounded(cabin, m.carpet, [0, -0.365, -0.04], [1.1, 0.049, 2.03], 0.023);
  // Curved inner skins follow the fuselage cross-section even at the tapered
  // forward edge of the doors. Their visible face points into the cockpit.
  function innerWidth(z, y) {
    const [w, sill, , keel] = sectionAt(hullStations, z);
    const f = clamp((sill - y) / (sill - keel), 0, 0.995);
    return w * (1 - f ** (2 / 0.78)) ** (0.74 / 2) - 0.015;
  }
  function doorInset(s, material, za, zb, low, high, inset, corner) {
    const g = surface(
      24,
      16,
      (u, v) => {
        const y = lerp(low, high, v);
        const trim = (corner * Math.max(0, Math.abs(2 * v - 1) - 0.65) ** 2) / 0.123;
        const z = lerp(za + trim, zb - trim, u);
        const crown = Math.sin(PI * u) ** 0.4 * Math.sin(PI * v) ** 0.4;
        return [s * (innerWidth(z, y) - inset - 0.012 * crown), y, z];
      },
      s === -1
    );
    mesh(cabin, g, material);
  }
  for (const s of [-1, 1]) {
    const liner = surface(
      34,
      18,
      (u, v) => {
        const z = lerp(-1.4, 1.36, u),
          [, sill, , keel] = sectionAt(hullStations, z),
          y = lerp(sill - 0.011, Math.max(-0.455, keel + 0.023), v);
        return [s * innerWidth(z, y), y, z];
      },
      s === 1
    );
    mesh(cabin, liner, m.trim);
    doorInset(s, m.leather, -0.998, 0.62, -0.31, 0.08, 0.006, 0.06);
    doorInset(s, m.fawn, -0.775, 0.472, -0.218, 0.047, 0.016, 0.052);
    const innerLatchX = innerWidth(-0.61, 0.061);
    rod(
      cabin,
      m.metal,
      [s * (innerLatchX - 0.037), 0.057, -0.687],
      [s * (innerLatchX - 0.035), 0.069, -0.539],
      0.011
    );
    const x = 0.287 * s;
    const cushion = rounded(cabin, m.leather, [x, -0.166, -0.02], [0.466, 0.148, 0.57], 0.061);
    cushion.rotation.x = -0.073;
    const insert = rounded(cabin, m.fawn, [x, -0.098, -0.052], [0.337, 0.056, 0.383], 0.027);
    insert.rotation.x = -0.07;
    const back = rounded(cabin, m.leather, [x, 0.086, 0.277], [0.456, 0.562, 0.124], 0.058);
    back.rotation.x = 0.146;
    const pad = rounded(cabin, m.fawn, [x, 0.119, 0.209], [0.327, 0.414, 0.036], 0.017);
    pad.rotation.x = 0.146;
    for (const dx of [-0.061, 0.061])
      rod(cabin, m.metal, [x + dx, 0.332, 0.309], [x + dx, 0.432, 0.322], 0.008);
    rounded(cabin, m.leather, [x, 0.433, 0.324], [0.274, 0.134, 0.094], 0.044);
    const belt = rounded(cabin, m.webbing, [x - s * 0.037, 0.121, 0.184], [0.045, 0.398, 0.012], 0.005);
    belt.rotation.z = -s * 0.341;
    belt.rotation.x = 0.14;
    rounded(cabin, m.metal, [x + s * 0.072, -0.097, -0.103], [0.048, 0.021, 0.063], 0.006);
    rounded(cabin, m.graphite, [s * 0.553, -0.04, -0.145], [0.094, 0.06, 0.424], 0.029);
    for (const dx of [-0.089, 0.086]) {
      const pedal = rounded(cabin, m.graphite, [x + dx, -0.241, -1.005], [0.13, 0.105, 0.029], 0.014);
      pedal.rotation.x = -0.47;
      for (let j = 0; j < 3; j++)
        rod(
          cabin,
          m.metal,
          [x + dx - 0.046, -0.272 + j * 0.026, -0.988],
          [x + dx + 0.046, -0.272 + j * 0.026, -0.988],
          0.0045
        );
    }
    // Yokes sit forward of the seats, with a continuous curved horn and a centre badge.
    rod(cabin, m.metal, [x, 0.085, -1.025], [x, 0.085, -0.785], 0.016);
    tube(
      cabin,
      m.grip,
      [
        [x - 0.128, 0.16, -0.756],
        [x - 0.129, 0.106, -0.752],
        [x - 0.11, 0.044, -0.754],
        [x - 0.072, 0.027, -0.767],
        [x, 0.045, -0.789],
        [x + 0.072, 0.027, -0.767],
        [x + 0.11, 0.044, -0.754],
        [x + 0.129, 0.106, -0.752],
        [x + 0.128, 0.16, -0.756],
      ],
      0.016,
      30
    );
    rounded(cabin, m.graphite, [x, 0.062, -0.775], [0.107, 0.068, 0.041], 0.018);
    ellipsoid(cabin, m.brass, [x, 0.064, -0.752], [0.024, 0.017, 0.004]);
  }
  const firewall = surface(
    1,
    30,
    (u, v) => {
      const z = -1.321,
        [w, sill, top, keel] = sectionAt(hullStations, z),
        q = (v - 0.5) * PI;
      const x = w * Math.sin(q),
        upper = sill + (top - sill) * Math.cos(q) ** 0.78,
        lower = sill - (sill - keel) * Math.cos(q) ** 0.78;
      return [x, lerp(lower, upper, u), z];
    },
    true
  );
  mesh(cabin, firewall, m.graphite);
  const brow = surface(
    24,
    4,
    (u, v) => {
      const t = 2 * u - 1,
        w = Math.abs(t);
      const yFront = 0.168 + 0.166 * Math.max(0, 1 - w ** (2 / 0.82)) ** (0.78 / 2);
      const yBack = 0.337 - 0.013 * w * w - 0.111 * w ** 12;
      return [
        t * lerp(0.592, 0.546, v),
        lerp(yFront, yBack, v) - 0.004 * Math.sin(v * PI),
        lerp(-1.312, -1.022, v),
      ];
    },
    true
  );
  mesh(cabin, brow, m.graphite);
  // The pilot is viewed through the glazing from outside. The first-person camera occupies this seat.
  const x = -0.287;
  const torso = rounded(pilot, m.jacket, [x, 0.118, -0.003], [0.355, 0.393, 0.218], 0.072);
  torso.rotation.x = 0.04;
  rounded(pilot, m.collar, [x, 0.31, -0.009], [0.153, 0.055, 0.132], 0.026);
  ellipsoid(pilot, m.skin, [x, 0.428, -0.052], [0.1, 0.139, 0.107]);
  ellipsoid(pilot, m.hair, [x, 0.453, -0.015], [0.102, 0.114, 0.092]);
  ellipsoid(pilot, m.skin, [x, 0.418, -0.148], [0.024, 0.031, 0.031]);
  ellipsoid(pilot, m.jacket, [x, 0.519, -0.058], [0.111, 0.061, 0.109]);
  const peak = ellipsoid(pilot, m.jacket, [x, 0.516, -0.148], [0.107, 0.013, 0.089]);
  peak.rotation.x = -0.08;
  for (const s of [-1, 1]) {
    const arm = [x + s * 0.141, 0.22, -0.006],
      elbow = [x + s * 0.192, -0.005, -0.157],
      wrist = [x + s * 0.126, 0.079, -0.469];
    rod(pilot, m.jacket, arm, elbow, 0.059, 0.048);
    rod(pilot, m.jacket, elbow, wrist, 0.049, 0.035);
    ellipsoid(pilot, m.skin, [wrist[0], 0.081, -0.497], [0.034, 0.033, 0.061]);
    ellipsoid(pilot, m.graphite, [x + s * 0.107, 0.427, -0.042], [0.028, 0.054, 0.049]);
  }
  tube(
    pilot,
    m.black,
    [
      [x - 0.116, 0.436, -0.041],
      [x - 0.098, 0.527, -0.033],
      [x, 0.585, -0.035],
      [x + 0.098, 0.527, -0.033],
      [x + 0.116, 0.436, -0.041],
    ],
    0.007,
    16
  );
  tube(
    pilot,
    m.graphite,
    [
      [x - 0.123, 0.415, -0.055],
      [x - 0.12, 0.384, -0.113],
      [x - 0.068, 0.371, -0.157],
    ],
    0.005,
    12
  );
}

const dialPositions = [
  [138, 138, 91],
  [345, 138, 91],
  [552, 138, 91],
  [138, 341, 80],
  [345, 341, 80],
  [552, 341, 80],
];
function disc(c, x, y, r, fill) {
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}
function dialText(c, text, x, y, size, color = '#e5e6d9') {
  c.fillStyle = color;
  c.textBaseline = 'middle';
  c.textAlign = 'center';
  c.font = '550 ' + size + 'px Arial,sans-serif';
  c.fillText(text, x, y);
}
function radial(c, cx, cy, angle, r) {
  return [cx + Math.sin(angle) * r, cy - Math.cos(angle) * r];
}
function needle(c, x, y, a, r, color = '#f7f4df', tail = 0.14) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  path(
    c,
    [
      [0, -r],
      [-2.7, -r * 0.73],
      [-3.1, r * tail],
      [3.1, r * tail],
      [2.7, -r * 0.73],
    ],
    color,
    true
  );
  disc(c, 0, 0, 5.3, '#a6aba2');
  disc(c, 0, 0, 2.7, '#464f50');
  c.restore();
}
function dialTicks(c, x, y, r, start, sweep, count, major, labels) {
  for (let i = 0; i <= count; i++) {
    if (sweep >= TAU - 0.001 && i === count) break;
    const a = start + (sweep * i) / count,
      long = i % major === 0;
    c.lineWidth = long ? 2.8 : 1.3;
    path(c, [radial(c, x, y, a, r - 4), radial(c, x, y, a, r - (long ? 12 : 8))], '#e6e7d9');
    if (long && labels) {
      const [tx, ty] = radial(c, x, y, a, r - 26);
      dialText(c, labels(i / major), tx, ty, 16);
    }
  }
}
function ringArc(c, x, y, r, a, b, color) {
  c.lineWidth = 3.4;
  c.strokeStyle = color;
  c.beginPath();
  c.arc(x, y, r, a - PI / 2, b - PI / 2);
  c.stroke();
}

function instrumentDeck(group, m) {
  const [face, c] = canvasOf(1152, 464),
    [display, d] = canvasOf(1152, 464);
  const panel = c.createLinearGradient(0, 0, 0, 464);
  panel.addColorStop(0, '#263431');
  panel.addColorStop(0.45, '#35413b');
  panel.addColorStop(1, '#26322f');
  c.fillStyle = panel;
  c.fillRect(0, 0, 1152, 464);
  for (let y = 6; y < 464; y += 6)
    for (let x = 5; x < 1152; x += 9) {
      c.fillStyle = (x + y) % 4 === 0 ? 'rgba(247,239,216,.07)' : 'rgba(5,14,15,.12)';
      c.fillRect(x + (y % 4), y, 0.9, 0.8);
    }
  for (const [i, [x, y, r]] of dialPositions.entries()) {
    c.fillStyle = '#192421';
    c.fillRect(x - r - 6, y - r - 6, r * 2 + 12, r * 2 + 12);
    const bevel = c.createLinearGradient(x - r, y - r, x + r, y + r);
    bevel.addColorStop(0, '#a8b0a1');
    bevel.addColorStop(0.38, '#4c5551');
    bevel.addColorStop(0.61, '#25302d');
    bevel.addColorStop(1, '#748177');
    disc(c, x, y, r + 3, bevel);
    disc(c, x, y, r, '#11191a');
    disc(c, x, y, r - 5, '#202627');
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const xx = x + sx * (r - 7),
          yy = y + sy * (r - 7);
        disc(c, xx, yy, 4.2, '#8c9489');
        c.lineWidth = 1.4;
        path(
          c,
          [
            [xx - 2.2, yy + 1.4],
            [xx + 2.2, yy - 1.4],
          ],
          '#323b34'
        );
      }
    if (i === 0) {
      dialTicks(c, x, y, r - 6, -2.39, 4.84, 32, 4, (n) => String(n * 20));
      ringArc(c, x, y, r - 8, -0.92, 1.47, '#7dba8b');
      ringArc(c, x, y, r - 8, 1.49, 2.1, '#d2aa52');
      dialText(c, 'AIRSPEED', x, y - 24, 11);
      dialText(c, 'KNOTS', x, y + 25, 10, '#b8c2b3');
    } else if (i === 2) {
      dialTicks(c, x, y, r - 6, 0, TAU, 50, 5, (n) => String(n));
      dialText(c, 'ALT', x, y - 25, 16);
      dialText(c, 'FEET', x, y + 24, 10, '#b5bfaf');
    } else if (i === 3) {
      dialText(c, 'TURN COORDINATOR', x, y + 24, 10);
      dialText(c, 'L', x - 45, y - 8, 14);
      dialText(c, 'R', x + 45, y - 8, 14);
      ringArc(c, x, y + 10, r * 0.63, 0.68 * PI, 1.32 * PI, '#d6d6b9');
    } else if (i === 5) {
      dialTicks(c, x, y, r - 4, -2.5, 5, 40, 5, (n) => String(Math.abs(n - 4) * 5));
      dialText(c, 'VERTICAL SPEED', x, y - 20, 10);
      dialText(c, '100 FT/MIN', x, y + 22, 9, '#b5bfaf');
    }
  }
  // VHF, transponder and engine monitor share one recessed avionics stack.
  c.fillStyle = '#141f20';
  c.fillRect(690, 45, 278, 290);
  c.fillStyle = '#23302f';
  c.fillRect(696, 50, 266, 278);
  for (const [index, title] of ['COM 1', 'ALT  ·  XPDR', 'ENGINE'].entries()) {
    const cy = 64 + index * 90;
    c.fillStyle = '#0a171a';
    c.fillRect(710, cy, 177, 50);
    dialText(c, title, 751, cy + 11, 10, '#afbbac');
    if (index === 0) dialText(c, '118.400', 806, cy + 34, 30, '#e9cd83');
    if (index === 1) dialText(c, '1200', 810, cy + 34, 29, '#d2c388');
    for (let j = 0; j < 2; j++) {
      const kx = 912 + j * 27;
      disc(c, kx, cy + 27, 12, '#829081');
      disc(c, kx, cy + 27, 9, '#243130');
      c.fillStyle = '#dbe0ca';
      c.fillRect(kx - 1, cy + 18, 2, 5);
    }
  }
  const engX = 1036,
    engY = 142,
    engR = 63;
  disc(c, engX, engY, engR + 4, '#829080');
  disc(c, engX, engY, engR, '#182324');
  dialTicks(c, engX, engY, engR - 5, -2.3, 4.6, 30, 5, (n) => String(n * 5));
  dialText(c, 'RPM', engX, engY - 15, 11);
  c.fillStyle = '#172120';
  c.fillRect(992, 248, 107, 50);
  dialText(c, 'B-LD24', 1045, 273, 20, '#dce0ce');
  for (let i = 0; i < 7; i++) {
    const xx = 716 + i * 52;
    disc(c, xx, 386, 12, '#879183');
    disc(c, xx, 386, 9, '#21302d');
    path(
      c,
      [
        [xx - 3, 385],
        [xx + 3, 380],
      ],
      '#b9c0b0'
    );
  }
  dialText(
    c,
    'MASTER       LIGHTS        NAV         PUMP        PITOT       RADIO       AUX',
    869,
    414,
    10
  );
  const gauges = canvasMap(display);
  gauges.minFilter = THREE.LinearFilter;
  gauges.generateMipmaps = false;
  const mat = new THREE.MeshBasicMaterial({ map: gauges, color: 0xe9eadf, toneMapped: false });
  const dayPanel = mat.color.clone(), nightPanel = new THREE.Color(0xd9aa7b);
  const width = 1.096,
    bottom = -0.146,
    top = 0.337,
    h = top - bottom,
    half = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half + 0.054, bottom);
  shape.quadraticCurveTo(-half, bottom, -half, bottom + 0.07);
  shape.lineTo(-half, 0.203);
  shape.quadraticCurveTo(-half, 0.3, -0.442, 0.32);
  shape.quadraticCurveTo(-0.23, 0.351, 0.035, 0.333);
  shape.lineTo(0.425, 0.316);
  shape.quadraticCurveTo(half, 0.306, half, 0.21);
  shape.lineTo(half, bottom + 0.073);
  shape.quadraticCurveTo(half, bottom, half - 0.054, bottom);
  shape.closePath();
  const hood = mesh(
    group,
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      bevelSegments: 2,
      curveSegments: 18,
    }),
    m.graphite,
    [0, 0, -1.09]
  );
  hood.rotation.x = -0.07;
  const sheet = new THREE.ShapeGeometry(shape, 24),
    positions = sheet.attributes.position,
    uv = sheet.attributes.uv;
  for (let i = 0; i < positions.count; i++)
    uv.setXY(i, (positions.getX(i) + half) / width, (positions.getY(i) - bottom) / h);
  const screen = mesh(group, sheet, mat, [0, 0, -0.993]);
  screen.rotation.x = -0.07;
  tube(
    group,
    m.grip,
    [
      [-0.544, 0.216, -1.027],
      [-0.519, 0.284, -1.029],
      [-0.415, 0.324, -1.028],
      [-0.19, 0.343, -1.027],
      [0.12, 0.341, -1.027],
      [0.423, 0.316, -1.03],
      [0.511, 0.287, -1.03],
      [0.55, 0.216, -1.027],
    ],
    0.017,
    30
  );
  for (const [i, color] of [m.graphite, m.mixture].entries()) {
    const x = 0.05 + i * 0.061;
    rod(group, m.metal, [x, -0.112, -1.014], [x, -0.111, -0.958], 0.009);
    const knob = rounded(group, color, [x, -0.109, -0.952], [0.044, 0.038, 0.037], 0.015);
    knob.rotation.x = -0.09;
  }
  function draw(state, night = 0) {
    mat.color.copy(dayPanel).lerp(nightPanel, night);
    const speed = state.speed ?? 0,
      alt = state.altitude ?? 0;
    const hdg = state.heading ?? -(state.yaw ?? 0),
      pitch = state.pitch ?? 0,
      bank = state.bank ?? 0,
      throttle = clamp(state.throttle ?? 0, 0, 1);
    const rpm = speed < 0.8 && throttle < 0.035 ? 740 : 780 + 1850 * throttle;
    d.drawImage(face, 0, 0);
    needle(d, 138, 138, -2.39 + 4.84 * clamp((speed * 1.94384) / 160, 0, 1), 67);
    const [ax, ay, ar] = dialPositions[1];
    d.save();
    d.beginPath();
    d.arc(ax, ay, ar - 7, 0, TAU);
    d.clip();
    d.translate(ax, ay);
    d.rotate(-bank);
    const offset = clamp(pitch, -0.7, 0.7) * 120;
    d.fillStyle = '#688d98';
    d.fillRect(-190, -300, 380, 300 + offset);
    d.fillStyle = '#9e7953';
    d.fillRect(-190, offset, 380, 300);
    d.fillStyle = '#e7e2cb';
    d.fillRect(-160, offset - 1, 320, 2);
    for (let k = -3; k <= 3; k++)
      if (k) {
        const yy = offset + 12 * k;
        const len = k % 2 ? 15 : 28;
        d.fillRect(-len / 2, yy, len, 1.4);
      }
    d.restore();
    d.lineWidth = 4;
    path(
      d,
      [
        [ax - 41, ay],
        [ax - 15, ay],
        [ax - 10, ay + 5],
        [ax, ay + 3],
        [ax + 10, ay + 5],
        [ax + 15, ay],
        [ax + 41, ay],
      ],
      '#f5b952'
    );
    for (let k = -3; k <= 3; k++) {
      const a = (k * PI) / 9;
      d.lineWidth = k % 3 === 0 ? 3 : 1.5;
      path(d, [radial(d, ax, ay, a, ar - 13), radial(d, ax, ay, a, ar - 22)], '#eee7d2');
    }
    const feet = Math.max(0, alt * 3.28084);
    needle(d, 552, 138, ((feet % 10000) / 10000) * TAU, 40, '#c0c3ac');
    needle(d, 552, 138, ((feet % 1000) / 1000) * TAU, 68);
    d.save();
    d.translate(138, 341);
    d.rotate(-clamp(bank, -0.6, 0.6) * 0.7);
    d.lineWidth = 4.4;
    path(
      d,
      [
        [-39, -2],
        [-11, -2],
        [-5, 1],
        [0, -2],
        [5, 1],
        [11, -2],
        [39, -2],
      ],
      '#e6dfbd'
    );
    d.fillStyle = '#e6dfbd';
    d.fillRect(-2, -10, 4, 18);
    d.restore();
    d.fillStyle = '#bfc9b1';
    d.beginPath();
    d.roundRect(114, 382, 48, 8, 4);
    d.fill();
    disc(d, 138 + Math.sin(bank) * 9, 386, 3.5, '#293434');
    d.save();
    d.translate(345, 341);
    d.rotate(-hdg);
    dialTicks(
      d,
      0,
      0,
      75,
      0,
      TAU,
      36,
      3,
      (n) => ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'][n]
    );
    d.restore();
    d.lineWidth = 2.8;
    path(
      d,
      [
        [345, 300],
        [345, 375],
      ],
      '#e7cd84'
    );
    path(
      d,
      [
        [319, 340],
        [345, 335],
        [371, 340],
      ],
      '#e7cd84'
    );
    const vsi = state.verticalSpeed ?? state.climbRate ?? speed * Math.sin(pitch);
    needle(d, 552, 341, clamp((vsi * 196.85) / 2000, -1, 1) * 2.5, 56);
    needle(d, engX, engY, -2.3 + (rpm / 3000) * 4.6, 43);
    dialText(d, Math.round(rpm) + ' RPM', 798, 278, 23, '#d3cc8c');
    gauges.needsUpdate = true;
  }
  draw({});
  return draw;
}

function propeller(group, m) {
  const spinner = [
    [0.002, -0.36],
    [0.049, -0.337],
    [0.094, -0.296],
    [0.125, -0.238],
    [0.147, -0.168],
    [0.158, -0.073],
    [0.161, -0.014],
    [0.156, 0.044],
    [0.139, 0.058],
    [0.005, 0.059],
  ];
  const hub = [0, 0.024, -2.459];
  spinSolid(group, m.spinner, spinner, hub);
  spinSolid(
    group,
    m.brass,
    [
      [0.156, -0.03],
      [0.162, -0.024],
      [0.163, -0.013],
      [0.158, -0.009],
    ],
    hub
  );
  const rotor = new THREE.Group();
  rotor.position.fromArray(hub);
  group.add(rotor);
  const bladeStations = [
    [0.126, 0.038, -0.008, 0.049],
    [0.235, 0.059, 0.013, 0.038],
    [0.432, 0.077, 0.035, 0.027],
    [0.68, 0.069, 0.037, 0.019],
    [0.864, 0.054, 0.022, 0.013],
    [0.962, 0.037, 0.003, 0.009],
    [1.008, 0.018, -0.009, 0.007],
    [1.022, 0.003, -0.018, 0.004],
  ];
  const paints = [m.prop, m.propTip, m.propIvory, m.propTip];
  const cuts = [0.126, 0.876, 0.932, 0.98, 1.022];
  for (let s = 0; s < 2; s++)
    for (let part = 0; part < 4; part++) {
      const g = surface(part === 0 ? 23 : 6, 14, (u, v) => {
        const r = lerp(cuts[part], cuts[part + 1], u),
          [w, sweep, thick] = sectionAt(bladeStations, r),
          q = v * TAU;
        const x = sweep + w * Math.cos(q),
          y = r,
          z = thick * Math.sin(q) - 0.8 * (1 - 0.73 * r) * w * Math.cos(q);
        return s === 0 ? [x, y, z] : [-x, -y, z];
      });
      mesh(rotor, g, paints[part]);
    }
  batch(rotor, false);
  const [map, c] = canvasOf(192, 192),
    buffer = c.createImageData(192, 192);
  for (let y = 0; y < 192; y++)
    for (let x = 0; x < 192; x++) {
      const xx = (x - 95.5) / 96,
        yy = (y - 95.5) / 96,
        r = Math.hypot(xx, yy),
        angle = Math.atan2(yy, xx);
      const tip = smoothstep(r, 0.86, 0.95);
      const arc = 0.22 + 0.78 * Math.pow(0.5 + 0.5 * Math.cos(angle * 2 + r * 0.82), 2.2);
      const edge = clamp((1 - r) * 84, 0, 1) * smoothstep(r, 0.14, 0.32);
      const i = (y * 192 + x) * 4;
      buffer.data[i] = lerp(117, 236, tip);
      buffer.data[i + 1] = lerp(129, 211, tip);
      buffer.data[i + 2] = lerp(120, 160, tip);
      buffer.data[i + 3] = Math.round(255 * arc * edge * (0.36 + 0.54 * tip));
    }
  c.putImageData(buffer, 0, 0);
  const discMat = new THREE.MeshBasicMaterial({
    map: canvasMap(map),
    transparent: true,
    depthWrite: false,
    opacity: 0,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const blur = mesh(group, new THREE.PlaneGeometry(2.045, 2.045), discMat, [
    hub[0],
    hub[1],
    hub[2] - 0.001,
  ]);
  blur.renderOrder = 2;
  return (dt, state) => {
    const throttle = clamp(state.throttle ?? 0, 0, 1);
    const rpm = 760 + throttle * 1860;
    rotor.rotation.z = (rotor.rotation.z + (dt * rpm * TAU) / 60) % TAU;
    const blend = smoothstep(rpm, 740, 1740);
    for (const p of [m.prop, m.propTip, m.propIvory]) p.opacity = lerp(0.53, 0.034, blend);
    blur.rotation.z = (blur.rotation.z + dt * (0.8 + 0.7 * throttle)) % TAU;
    discMat.opacity = 0.09 + 0.16 * blend;
  };
}

function lights(shell, lighting, m) {
  const [image, ctx] = canvasOf(64, 64),
    g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.16, 'rgba(255,255,255,.80)');
  g.addColorStop(0.37, 'rgba(255,255,255,.21)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const map = canvasMap(image);
  const lamps = [];
  function lamp(position, color, radius, flashes = false) {
    const bulb = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    ellipsoid(shell, bulb, position, [radius * 0.8, radius * 0.72, radius * 1.25]);
    const material = new THREE.SpriteMaterial({
      map,
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const halo = new THREE.Sprite(material);
    halo.position.fromArray(position);
    halo.renderOrder = 4;
    lighting.add(halo);
    lamps.push({ bulb, halo, radius, flashes, color: new THREE.Color(color) });
  }
  for (const s of [-1, 1]) {
    ellipsoid(shell, m.navy, [s * 5.266, 1.142, -0.084], [0.042, 0.03, 0.08]);
    lamp([s * 5.29, 1.15, -0.098], s === -1 ? 0xff5844 : 0x46e4a0, 0.035);
  }
  lamp([0, 1.717, 3.94], 0xff7147, 0.024, true);
  lamp([0, 0.225, 4.484], 0xffe2a9, 0.018);
  let time = 0;
  return (dt, night) => {
    time = (time + dt) % 1.57;
    for (const l of lamps) {
      const pulse = l.flashes ? Math.exp(-((time - 0.14) ** 2) / 0.0015) : 1;
      l.bulb.color.copy(l.color).multiplyScalar(l.flashes ? 0.38 + 0.76 * pulse : 0.78 + 0.27 * night);
      l.halo.material.opacity = (0.12 + 0.5 * night) * pulse;
      l.halo.scale.setScalar(l.radius * (5.9 + night * 3.2));
    }
    m.landing.emissiveIntensity = 0.08 + night * 0.9;
  };
}

function materials() {
  const propPaint = (color) =>
    standard(color, 0.44, 0.19, {
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    });
  return {
    hull: standard(0xffffff, 0.35, 0.2, { map: makeHullMap() }),
    wing: standard(0xffffff, 0.42, 0.16, { map: makeWingMap() }),
    fin: standard(0xffffff, 0.39, 0.16, { map: makeFinMap() }),
    glass: makeGlass(),
    cream: standard(IVORY, 0.4, 0.14),
    navy: standard(INK, 0.36, 0.18),
    brass: standard('#c69854', 0.34, 0.44),
    metal: standard('#aab4ad', 0.31, 0.52),
    spinner: standard('#e8e4cc', 0.29, 0.43),
    exhaust: standard('#75695c', 0.61, 0.39),
    black: standard('#182124', 0.88),
    tyre: standard('#2c3030', 0.94),
    tread: standard('#202727', 0.87),
    panelSeam: standard('#858d81', 0.69),
    gasket: standard('#283333', 0.75),
    graphite: standard('#35423f', 0.63, 0.15),
    grip: standard('#222d2e', 0.77),
    trim: standard('#827e6c', 0.74),
    headliner: standard('#c6bfa6', 0.85),
    carpet: standard('#3d4946', 0.93),
    leather: standard('#9b724d', 0.69),
    fawn: standard('#b2936c', 0.76),
    webbing: standard('#4d574f', 0.95),
    jacket: standard('#314b55', 0.91),
    collar: standard('#e3dcc6', 0.9),
    skin: standard('#c79572', 0.87),
    hair: standard('#39322e', 0.88),
    mixture: standard('#963e31', 0.5),
    prop: propPaint('#373f3e'),
    propTip: propPaint(OCHRE),
    propIvory: propPaint(IVORY),
    landing: standard('#f0e5c0', 0.24, 0.22, {
      emissive: new THREE.Color('#ffce83'),
      emissiveIntensity: 0.1,
    }),
  };
}

/**
 * A metre-scale, high-wing touring aircraft. Local forward is -Z. The parent may
 * position/rotate the returned group directly; no camera or flight state is owned here.
 */
export function createAircraft() {
  const group = new THREE.Group(),
    shell = new THREE.Group(),
    cabin = new THREE.Group(),
    glazing = new THREE.Group();
  const pilot = new THREE.Group(),
    lighting = new THREE.Group(),
    prop = new THREE.Group();
  group.name = 'B-LD24';
  shell.name = 'Airframe';
  cabin.name = 'Flight deck';
  glazing.name = 'Cabin glazing';
  pilot.name = 'Pilot';
  lighting.name = 'Navigation lights';
  prop.name = 'Powerplant';
  const m = materials();
  hull(shell, m);
  wings(shell, m);
  tail(shell, m);
  landingGear(shell, m);
  canopy(shell, cabin, glazing, m);
  addInterior(cabin, pilot, m);
  const drawDeck = instrumentDeck(cabin, m);
  const updateProp = propeller(prop, m),
    updateLights = lights(shell, lighting, m);
  batch(shell);
  batch(cabin, false);
  batch(pilot, false);
  batch(glazing, false);
  glazing.renderOrder = 3;
  for (const glass of glazing.children) glass.renderOrder = 3;
  group.add(shell, cabin, pilot, glazing, prop, lighting);
  const cockpitAnchor = new THREE.Vector3(-0.265, 0.519, -0.024);
  let currentMode = 'chase',
    deckTime = 0;
  function setCameraMode(mode) {
    currentMode = mode;
    group.visible = mode !== 'aerial';
    pilot.visible = mode !== 'cockpit';
    m.glass.uniforms.interior.value = mode === 'cockpit' ? 1 : 0;
    deckTime = 1;
  }
  function update(dt, state = {}, darkness = 0) {
    const step = Number.isFinite(dt) ? clamp(dt, 0, 0.25) : 0;
    const night = Number.isFinite(darkness) ? clamp(darkness, 0, 1) : 0;
    m.glass.uniforms.night.value = night;
    if (!group.visible) return;
    updateProp(step, state);
    updateLights(step, night);
    deckTime += step;
    if (deckTime >= (currentMode === 'cockpit' ? 0.12 : 0.8)) {
      drawDeck(state, night);
      deckTime = 0;
    }
  }
  return { group, update, cockpitAnchor, groundClearance: GROUND_CLEARANCE, setCameraMode };
}
