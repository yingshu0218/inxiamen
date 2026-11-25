import { TAU, box, cylinder, geoPoint, groundY, inRing, litSurface, prism, randomSource, signedArea } from './scenery-mesh.js';

import { inIslandBounds, islandSiteReserved, huangFrame, plan as islandPlan } from './gulangyu-layout.js';
import { eastLandingLevel, slabLandingLevel, sunlight, summitPoint } from './sunlight-layout.js';
import { cutSummitPaths, sculptSummitStone } from './sunlight-geology.js';
import { apronEntry, apronLevel, crownLookout, ridgeBalcony, ridgeBridge, ridgeStairs } from './sunlight-terraces.js';
import { localFrame, paveFootprint, up, rect, ellipse, inRect, foundation } from './landmark-forms.js';

// Locations and course from the local OpenStreetMap extract. References for the
// architecture: UNESCO Kulangsu nomination, Annex A, drawings A-4-291–300 and
// A-4-347–354; UNESCO photograph 158224; Xiamen's Gulangyu visitor centre.
// https://whc.unesco.org/en/documents/158224/
// https://www.fjdaily.com/app/content/2023-05/06/content_1872600.html
// https://www.bjnews.com.cn/detail/1757898944019883.html
// https://mzj.sh.gov.cn/lnb-lyxx/20260616/19ddd401ff844b559dab2365524d0b35.html
const MANSION = geoPoint(118.06323, 24.45013);
const SUMMIT = geoPoint(118.062247, 24.444615);
const MANSION_ANGLE = 0.815;
const GRANITE = 13,
  BRICK = 14,
  RED_DOME = 15;
const C = {
  cream: '#deceb1',
  lime: '#dacdaf',
  edge: '#f0dfc1',
  shadow: '#8c8174',
  granite: '#b7ac97',
  redBrick: '#a85c47',
  oak: '#6a4436',
  glass: '#3b4b48',
  roof: '#c98157',
  rail: '#859997',
  plinth: '#ac9a81',
};

const mansionXY = localFrame(MANSION, MANSION_ANGLE);
function tube(batch, a, b, radius, color, sides = 5) {
  if (radius < 0.087) sides = Math.min(sides, 3);
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz),
    flat = Math.hypot(dx, dz);
  if (len < 0.001) return;
  const tx = dx / len,
    ty = dy / len,
    tz = dz / len;
  const ux = flat > 0.0001 ? -dz / flat : 1,
    uz = flat > 0.0001 ? dx / flat : 0;
  const vx = ty * uz,
    vy = tz * ux - tx * uz,
    vz = -ty * ux;
  const ring = (centre, i) => {
    const t = (TAU * i) / sides,
      c = radius * Math.cos(t),
      s = radius * Math.sin(t);
    return [centre[0] + ux * c + vx * s, centre[1] + vy * s, centre[2] + uz * c + vz * s];
  };
  for (let i = 0; i < sides; i++)
    batch.face([ring(a, i), ring(a, i + 1), ring(b, i + 1), ring(b, i)], color);
}

function tuscan(batch, p, low, high) {
  const [x, z] = p,
    h = high - low;
  const profile = [
    [0, 0.66],
    [0.16, 0.66],
    [0.23, 0.55],
    [0.39, 0.5],
    [h - 0.52, 0.41],
    [h - 0.39, 0.54],
    [h - 0.26, 0.62],
    [h - 0.19, 0.63],
  ];
  for (let j = 1; j < profile.length; j++) {
    const [y0, r0] = profile[j - 1],
      [y1, r1] = profile[j];
    for (let i = 0; i < 8; i++) {
      const a = (TAU * i) / 8,
        b = (TAU * (i + 1)) / 8;
      const point = (t, r, y) => [x + r * Math.cos(t), low + y, z + r * Math.sin(t)];
      const normal = (t) => {
        const slope = (r0 - r1) / (y1 - y0),
          norm = Math.hypot(1, slope);
        return [Math.cos(t) / norm, slope / norm, Math.sin(t) / norm];
      };
      batch.face(
        [point(a, r0, y0), point(a, r1, y1), point(b, r1, y1), point(b, r0, y0)],
        j === 4 ? '#c8c4b5' : '#d7cdb8',
        0,
        0,
        undefined,
        [normal(a), normal(a), normal(b), normal(b)]
      );
    }
  }
  box(batch, x, z, 1.41, 1.41, high - 0.19, high, C.lime, C.edge, 0, 0, MANSION_ANGLE);
}

// A pitched, four-plane roof with a real ridge, returned hip edges and a deep eave.
export function hipRoof(batch, xy, u, v, width, depth, eave, rise, color, ridgeColor) {
  const ring = rect(xy, u, v, width, depth);
  const roots = ring.map((p) => up(p, eave));
  const half = Math.max(0.08, (width - depth) * 0.5);
  const ends = [up(xy(u - half, v), eave + rise), up(xy(u + half, v), eave + rise)];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      a = i === 0 || i === 3 ? 0 : 1,
      b = j === 0 || j === 3 ? 0 : 1;
    const verts = a === b ? [roots[i], roots[j], ends[a]] : [roots[i], roots[j], ends[b], ends[a]];
    const dx = roots[j][0] - roots[i][0],
      dz = roots[j][2] - roots[i][2],
      edgeLength = Math.hypot(dx, dz);
    const uv = verts.map((p) => [
      ((p[0] - roots[i][0]) * dx + (p[2] - roots[i][2]) * dz) / edgeLength,
      (p[1] - eave) * 1.9,
    ]);
    batch.top(verts, color, 5, 0, uv);
    batch.face(
      [up(ring[i], eave - 0.22), up(ring[i], eave), up(ring[j], eave), up(ring[j], eave - 0.22)],
      ridgeColor
    );
    tube(batch, roots[i], ends[a], 0.12, ridgeColor, 5);
  }
  tube(batch, ends[0], ends[1], 0.16, ridgeColor, 6);
}

export function archWindow(batch, a, b, t, low, width, height, trim = C.lime) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz);
  const sx = dx / len,
    sz = dz / len,
    ox = sz,
    oz = -sx;
  const frame = (w, y, d) => [a[0] + dx * t + sx * w + ox * d, low + y, a[1] + dz * t + sz * w + oz * d];
  const r = width * 0.5,
    spring = height - r,
    slices = width < 1.4 ? 6 : 9;
  const crown = (radius, i, d) =>
    frame(
      radius * Math.cos((i * Math.PI) / slices),
      spring + radius * Math.sin((i * Math.PI) / slices),
      d
    );
  const points = [
    frame(-r, 0, 0.04),
    frame(r, 0, 0.04),
    ...Array.from({ length: slices + 1 }, (_, i) => crown(r, i, 0.04)),
  ];
  batch.face(points, C.glass);
  for (const side of [-1, 1]) {
    batch.face(
      [
        frame(side * r, 0, 0.13),
        frame(side * r, spring, 0.13),
        frame(side * (r + 0.105), spring, 0.13),
        frame(side * (r + 0.105), 0, 0.13),
      ],
      trim
    );
    batch.face(
      [
        frame(side * r, 0, 0.04),
        frame(side * r, spring, 0.04),
        frame(side * r, spring, 0.13),
        frame(side * r, 0, 0.13),
      ],
      C.shadow
    );
  }
  for (let i = 0; i < slices; i++)
    batch.face(
      [
        crown(r, i, 0.13),
        crown(r + 0.105, i, 0.13),
        crown(r + 0.105, i + 1, 0.13),
        crown(r, i + 1, 0.13),
      ],
      trim
    );
  tube(batch, frame(0, 0.04, 0.07), frame(0, height - 0.05, 0.07), 0.033, C.oak, 4);
  tube(batch, frame(-r, spring, 0.08), frame(r, spring, 0.08), 0.038, C.oak, 4);
}

function dome(batch, y) {
  const xy = mansionXY,
    phase = MANSION_ANGLE + Math.PI / 8;
  const ring = ellipse(xy, 0, 0, 6.85, 6.85, 8, Math.PI / 8);
  prism(batch, ring, y + 17.35, y + 22.05, '#e0d5bb', '#a28b70');
  for (let i = 0; i < 8; i++) {
    const a = ring[i],
      b = ring[(i + 1) % 8];
    for (const t of [0.22, 0.5, 0.78]) archWindow(batch, a, b, t, y + 18.02, 0.86, 2.76);
  }
  for (const [lo, hi, rb, rt, color] of [
    [17.18, 17.48, 7.13, 7.13, C.edge],
    [17.48, 17.82, 7.03, 6.82, C.shadow],
    [21.64, 21.87, 6.83, 7.13, C.shadow],
    [21.87, 22.13, 7.17, 7.17, C.edge],
    [22.13, 22.34, 7.19, 7.04, '#b88872'],
  ])
    cylinder(batch, ...MANSION, y + lo, y + hi, rb, rt, color, 8, phase);
  const radius = 6.92,
    rise = 8.05;
  const shell = (a, lat, rib = 0) => {
    const sector = (((a / (Math.PI / 4)) % 1) + 1) % 1;
    const radiusAt = radius * (1 - 0.045 * Math.sin(Math.PI * sector) ** 2);
    const r = radiusAt * Math.cos(lat) + rib * Math.cos(lat);
    return up(xy(r * Math.cos(a), r * Math.sin(a)), y + 22.31 + (rise + rib) * Math.sin(lat));
  };
  const normal = (a, t) => {
    const h = Math.cos(t),
      s = (Math.sin(t) * radius) / rise,
      n = Math.hypot(h, s);
    return [(h * Math.cos(a + MANSION_ANGLE)) / n, s / n, (h * Math.sin(a + MANSION_ANGLE)) / n];
  };
  const tones = ['#a54240', '#a43e3a', '#a74740', '#a34239', '#a94642', '#a3423d', '#a9443e', '#ab4941'];
  const sectors = 48,
    bands = 12;
  for (let i = 0; i < sectors; i++) {
    const a = (i * TAU) / sectors,
      b = ((i + 1) * TAU) / sectors;
    for (let j = 0; j < bands; j++) {
      const lo = (j * Math.PI) / (2 * bands),
        hi = ((j + 1) * Math.PI) / (2 * bands);
      const verts = [shell(a, lo), shell(a, hi), shell(b, hi), shell(b, lo)];
      const uv = [
        [(i / 48) * 42, lo * 6.4],
        [(i / 48) * 42, hi * 6.4],
        [((i + 1) / 48) * 42, hi * 6.4],
        [((i + 1) / 48) * 42, lo * 6.4],
      ];
      const normals = [normal(a, lo), normal(a, hi), normal(b, hi), normal(b, lo)];
      if (j === bands - 1) {
        batch.face(
          [verts[0], verts[1], verts[3]],
          tones[Math.floor(i / 6)],
          RED_DOME,
          0,
          [uv[0], uv[1], uv[3]],
          [normals[0], normals[1], normals[3]]
        );
      } else batch.face(verts, tones[Math.floor(i / 6)], RED_DOME, 0, uv, normals);
    }
  }
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < bands; j++)
      tube(
        batch,
        shell((i * TAU) / 8, (j * Math.PI) / (2 * bands), 0.025),
        shell((i * TAU) / 8, ((j + 1) * Math.PI) / (2 * bands), 0.025),
        0.095,
        '#a65a4e',
        5
      );
  cylinder(batch, ...MANSION, y + 30.30, y + 30.57, 0.32, 0.19, '#a28364', 9);
  cylinder(batch, ...MANSION, y + 30.55, y + 31.29, 0.08, 0.035, '#b0a38c', 6);
}

// The restored corner bays have rectangular red-brown timber shutters.
function mansionShutter(batch, a, b, t, low) {
  const run = Math.hypot(b[0]-a[0], b[1]-a[1]);
  const xy = localFrame(a, Math.atan2(b[1]-a[1], b[0]-a[0]));
  const panel = (left, right, sill, head, depth, color) => {
    const l = xy(t*run+left,-depth), r = xy(t*run+right,-depth);
    batch.face([up(l,low+sill),up(l,low+head),up(r,low+head),up(r,low+sill)],color);
  };
  panel(-.83,.83,0,3.18,.035,C.edge);
  panel(-.69,.69,.12,3.03,.058,'#713e35');
  for (let i=0;i<10;i++) panel(-.63,.63,.26+i*.265,.33+i*.265,.087,'#925a45');
  for(const rail of [.85,1.55,2.25])panel(-.67,.67,rail,rail+.085,.102,'#60382e');
  panel(-.045,.045,.14,3.03,.105,'#563b32');
}

function buildMansion(batch, geo, lamps, obstacles) {
  const xy = mansionXY,
    foot = rect(xy, 0, 0, 54.5, 35.8);
  const highest = Math.max(...foot.map((p) => groundY(geo, ...p)));
  const y = Math.max(groundY(geo, ...MANSION), highest - 1.15);
  const floor = 2.6,
    gallery = 7.65,
    cornice = 12.65;
  foundation(batch, geo, foot, y + floor, '#bcae99', '#c8b99c');
  // Segmental basement openings sit below the long galleries wherever the
  // natural hillside drops away; the central bay leads to the entrance steps.
  for (const side of [0, 2]) {
    const a = foot[side],
      b = foot[(side + 1) % 4];
    for (let bay = 1; bay <= 11; bay++) {
      if (bay === 6) continue;
      const t = bay / 12,
        p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      if (groundY(geo, ...p) > y + floor - 1.18) continue;
      archWindow(batch, a, b, t, y + floor - 2.43, 2.55, 2.12, '#c3b099');
    }
  }
  prism(batch, rect(xy, 0, 0, 47.0, 28.2), y + floor, y + cornice, '#b09b80', '#bead93', 4, 0.84);
  const slab = (w, d, lo, hi, color, top) =>
    prism(batch, rect(xy, 0, 0, w, d), y + lo, y + hi, color, top);
  slab(54.9, 36.2, 2.43, 2.7, C.edge, '#d3c3a7');
  slab(54.4, 35.7, gallery - 0.45, gallery - 0.22, '#ac997c', C.lime);
  slab(55, 36.1, gallery - 0.22, gallery + 0.04, C.edge, '#c5af94');
  slab(54.9, 35.9, cornice - 0.25, cornice + 0.1, '#a18f77', C.lime);
  slab(55.3, 36.3, cornice + 0.1, cornice + 0.37, C.edge, '#cfb49a');
  for (const side of [-1, 1])
    for (const end of [-1, 1]) {
      const [cx, cz] = xy(side * 23.47, end * 14.0);
      box(
        batch,
        cx,
        cz,
        6.7,
        6.9,
        y + floor,
        y + cornice,
        C.redBrick,
        '#c3ab94',
        BRICK,
        0.35,
        MANSION_ANGLE
      );
      const corner = rect(xy, side * 23.47, end * 14.0, 6.7, 6.9);
      for (let i = 0; i < corner.length; i++)
        for (const level of [3.15, 8.15])
          for (const t of [0.32, 0.68])
            mansionShutter(batch, corner[i], corner[(i + 1) % 4], t, y + level);
    }
  const columns = [];
  for (const face of [-1, 1]) {
    for (let i = 0; i < 13; i++) columns.push(xy(-25.0 + (i * 50.0) / 12, face * 17.12));
    for (const station of [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5]) columns.push(xy(face * 26.0, station));
  }
  // A bowed central loggia faces the harbour along the northeast facade.
  const bowed = Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI + (i * Math.PI) / 12;
    return xy(7.45 * Math.cos(a), -16.75 + 3.85 * Math.sin(a));
  });
  for (const i of [2, 5, 7, 10]) tuscan(batch,bowed[i],y+floor+.05,y+cornice-.12);
  for (const p of columns) {
    tuscan(batch, p, y + floor + 0.05, y + gallery - 0.37);
    tuscan(batch, p, y + gallery + 0.05, y + cornice - 0.25);
  }
  for (const h of [floor, cornice + 0.3])
    prism(batch, bowed, y + h - 0.25, y + h + 0.08, '#b7a58b', '#ddc7aa');
  const railExt = rect(xy, 0, 0, 54, 35.25);
  for (let side = 0; side < 4; side++) {
    const a = railExt[side],
      b = railExt[(side + 1) % 4],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const at = (s, h) => [a[0] + (b[0] - a[0]) * s, y + h, a[1] + (b[1] - a[1]) * s];
    for (const level of [floor, gallery, cornice + 0.37]) {
      const lowRoof = level > cornice,
        top = level + (lowRoof ? 0.5 : 0.83);
      // The ground-level stair passes between the central bays.
      const gaps =
        level === floor && (side === 0 || side === 2)
          ? [
              [0, 0.437],
              [0.563, 1],
            ]
          : [[0, 1]];
      for (const [lo, hi] of gaps) {
        tube(batch, at(lo, top), at(hi, top), lowRoof ? 0.11 : 0.105, C.edge, 4);
        tube(batch, at(lo, level + 0.16), at(hi, level + 0.16), 0.1, C.lime, 4);
        const count = Math.ceil((len * (hi - lo)) / (lowRoof ? 1.75 : 1.12));
        for (let i = 0; i <= count; i++) {
          const p = at(lo + ((hi - lo) * i) / count, level + 0.13);
          cylinder(
            batch,
            p[0],
            p[2],
            p[1],
            y + top,
            0.1,
            0.12,
            lowRoof ? '#bcb39f' : '#d1c5ab',
            4,
            MANSION_ANGLE
          );
        }
      }
    }
  }
  hipRoof(batch, xy, 0, 0, 48.3, 29.4, y + 13.0, 3.1, '#c98258', '#ce946e');
  const deck = ellipse(xy, 0, 0, 15.9, 15.4, 8, Math.PI / 8);
  prism(batch, deck, y + 13.8, y + 17.12, '#ddd3bd', '#d0a88c');
  for (let i = 0; i < 8; i++) {
    const a = deck[i],
      b = deck[(i + 1) % 8];
    for (const t of [0.25, 0.5, 0.75]) archWindow(batch, a, b, t, y + 14.73, 1.14, 1.58);
    tube(batch, up(a, y + 17.32), up(b, y + 17.32), 0.18, C.edge, 5);
  }
  prism(
    batch,
    ellipse(xy, 0, 0, 16.12, 15.62, 8, Math.PI / 8),
    y + 16.98,
    y + 17.2,
    '#b3a58e',
    '#d7b397'
  );
  // Recessed roof behind the octagonal cornice, rising to the lantern.
  const neck=ellipse(xy,0,0,7.05,7.05,8,Math.PI/8);
  for(let i=0;i<8;i++){
    const j=(i+1)%8;
    batch.top([up(deck[i],y+17.21),up(deck[j],y+17.21),up(neck[j],y+18.0),up(neck[i],y+18.0)],'#a65c4b');
    tube(batch,up(deck[i],y+17.27),up(neck[i],y+18.05),.09,'#bb7862');
  }
  dome(batch, y);
  const stairEnd = xy(0, -27.3),
    stairStart = xy(0, -19.6);
  stairFlight(
    batch,
    stairStart,
    y + floor + 0.08,
    stairEnd,
    groundY(geo, ...stairEnd) + 0.14,
    5.5,
    3.66,
    '#bdb099',
    false,
    (x, z) => groundY(geo, x, z)
  );
  // Cut granite cheeks follow the entrance stair down the seaward slope.
  for(const side of [-1,1]){
    const a=xy(side*3.12,-19.5), b=xy(side*3.12,-27.4);
    const bottom=groundY(geo,...stairEnd)+.14;
    const outer=xy(side*3.62,-27.4), inner=xy(side*3.62,-19.5);
    batch.face([up(a,y+floor+.84),up(b,bottom+.84),up(outer,bottom+.84),up(inner,y+floor+.84)],C.lime);
    for(const [start,end] of [[a,b],[inner,outer]])
      batch.face([up(start,groundY(geo,...start)-.3),up(start,y+floor+.84),up(end,bottom+.84),up(end,groundY(geo,...end)-.3)],'#aa9b87',GRANITE);
    cylinder(batch,...b,bottom,bottom+1.14,.39,.36,C.granite,8);
  }
  obstacles.add(foot, y + 16.1);
  obstacles.add(deck, y + 17.38);
  obstacles.add(ellipse(xy, 0, 0, 7.1, 7.1, 12), y + 31.29);
  for (const end of [-1, 1])
    for (const station of [-19.5, -8.2, 8.2, 19.5]) {
      const p = xy(station, end * 16.0);
      lamps.add(p[0], y + 7.05, p[1], '#ffcf9c', 1.18);
    }
}

export function stairFlight(batch, a, ya, b, yb, width, seed, color, rail, support, obstacles, ironRail = false) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    run = Math.hypot(dx, dz);
  if (run < 0.1) return;
  const nx = -dz / run,
    nz = dx / run;
  const plan = (t, s) => [a[0] + dx * t + nx * s, a[1] + dz * t + nz * s];
  const elevation = (t) => {
    t = Math.min(1, Math.max(0, t));
    const p = plan(t, 0),
      l = plan(t, -width / 2),
      r = plan(t, width / 2);
    return Math.max(
      ya + (yb - ya) * t,
      support ? Math.max(support(...p), support(...l), support(...r)) + 0.09 : -Infinity
    );
  };
  const n = Math.max(1, Math.min(Math.ceil(Math.abs(ya - yb) / 0.21), Math.ceil(run / 0.22)));
  for (let i = 0; i < n; i++) {
    const t = i / n,
      t1 = (i + 1) / n,
      h = elevation((t + t1) * 0.5),
      next = elevation(t1 + 0.48 / n);
    const ring = [plan(t, -width / 2), plan(t1, -width / 2), plan(t1, width / 2), plan(t, width / 2)];
    batch.top(
      ring.map((p) => up(p, h)),
      color,
      GRANITE,
      seed
    );
    batch.face(
      [up(ring[1], h), up(ring[2], h), up(ring[2], next - 0.025), up(ring[1], next - 0.025)],
      '#a59987',
      GRANITE,
      seed
    );
    for (const [from, to] of [
      [0, 1],
      [2, 3],
    ]) {
      const l = ring[from],
        r = ring[to];
      const lower = (p) => {
        if (!support) return h - 0.55;
        const footing = Math.min(h - 0.25, support(...p) - 0.18);
        return rail ? Math.max(h - 0.9, footing) : footing;
      };
      batch.face([up(l, lower(l)), up(l, h), up(r, h), up(r, lower(r))], color, GRANITE, seed);
    }
  }
  if (rail)
    for (const side of [-1, 1]) {
      const posts = Math.max(1, Math.ceil(run / 1.75));
      for (let i = 0; i <= posts; i++) {
        const t = i / posts,
          p = plan(t, side * width * 0.47),
          h = elevation(t);
        if (!ironRail && (i === 0 || i === posts || i % 3 === 0)) {
          box(
            batch,
            p[0],
            p[1],
            0.23,
            0.24,
            h - 0.1,
            h + 1.07,
            '#b5aa94',
            '#cabda8',
            0,
            0,
            Math.atan2(dz, dx)
          );
        } else cylinder(batch, ...p, h - 0.02, h + 1.03, 0.051, 0.049, ironRail ? '#4e5853' : '#7a8687', ironRail ? 6 : 5);
        if (i === posts) continue;
        const q = plan((i + 1) / posts, side * width * 0.47),
          hn = elevation((i + 1) / posts);
        for (const level of [0.45, 1.025])
          tube(batch, up(p, h + level), up(q, hn + level), level < 0.6 ? 0.037 : 0.054, ironRail ? '#525d56' : '#99a3a1', 6);
      }
    }
  // Short flights crossing the joint in the granite bear on stone piers at
  // intervals. The fissure between the two natural blocks remains visible.
  if (rail && support) {
    const bays = Math.max(1, Math.ceil(run / 3.1));
    for (let i = 0; i <= bays; i++) {
      const t = i / bays,
        p = plan(t, 0),
        top = elevation(t) - 0.43;
      const foot = Math.min(...[-0.37, 0, 0.37].map((side) => support(...plan(t, width * side)))) - 0.14;
      if (top - foot > 0.4)
        box(
          batch,
          ...p,
          0.46,
          width * 0.75,
          foot,
          top,
          '#afa79a',
          '#b8ad9f',
          GRANITE,
          seed,
          Math.atan2(dz, dx)
        );
    }
  }
  if (obstacles) {
    const divisions = Math.max(1, Math.ceil(run / 4));
    for (let i = 0; i < divisions; i++) {
      const t = i / divisions,
        q = (i + 1) / divisions;
      obstacles.add(
        [plan(t, -width / 2), plan(q, -width / 2), plan(q, width / 2), plan(t, width / 2)],
        Math.max(elevation(t), elevation((t + q) / 2), elevation(q)) + (rail ? 1.1 : 0.1)
      );
    }
  }
}

// A jointed granite exfoliation dome. The same analytic upper surface supports
// the steps, stone landings and obstruction volumes; the lower ring is buried.
export function monolith(batch, geo, centre, rx, rz, bearing, peak, seed, color, obstacles, outline) {
  const xy = localFrame(centre, bearing),
    c = Math.cos(bearing),
    s = Math.sin(bearing);
  const rim = outline ?? ellipse(xy, 0, 0, rx, rz, 18);
  const measured = outline?.map(([x,z]) => {
    const dx=x-centre[0], dz=z-centre[1];
    return [(c*dx+s*dz)/rx,(-s*dx+c*dz)/rz];
  });
  const bed = (p) => geo.rawHeightAt?.(...p) ?? groundY(geo, ...p);
  const base = Math.min(...rim.map(bed), bed(centre)) - 2.25;
  const h = peak - base,
    power = 3.35 + 0.38 * Math.cos(seed * 0.91);
  const radialScale = (a) => {
    if (measured) {
      const dx=Math.cos(a), dz=Math.sin(a);
      let radius=Infinity;
      for (let i=0;i<measured.length;i++) {
        const [x,z]=measured[i], next=measured[(i+1)%measured.length];
        const ex=next[0]-x, ez=next[1]-z, cross=dx*ez-dz*ex;
        if (Math.abs(cross)<1e-8) continue;
        const t=(x*dz-z*dx)/cross, distance=(x*ez-z*ex)/cross;
        if (t>=0 && t<=1 && distance>0) radius=Math.min(radius,distance);
      }
      if (Number.isFinite(radius)) return radius;
    }
    const square = (Math.abs(Math.cos(a)) ** power + Math.abs(Math.sin(a)) ** power) ** (-1 / power);
    return square * (1 + 0.038 * Math.sin(3 * a + seed) + 0.023 * Math.sin(5 * a - seed * 1.7));
  };
  const surfaceY = (r, a) => {
    // Intersect the weathered crown with two uneven planar joints. The result
    // has a tilted shoulder and an upright face even in distant silhouette.
    const rough =
      (0.58 * Math.sin(a * 3 + 0.62 + seed) + 0.38 * Math.sin(a * 5 - seed)) *
      Math.sin(Math.min(1, r) * Math.PI);
    const lean = Math.cos(a - seed * 0.72);
    const dome = Math.pow(Math.max(0, 1 - r ** (2.75 + 0.68 * lean)), 0.39 - 0.035 * lean);
    const bevelA = 1.018 - 0.235 * Math.max(0, r * lean - 0.08);
    const bevelB = 1.034 - 0.29 * Math.max(0, r * Math.cos(a - seed * 0.72 - 2.12) - 0.15);
    return base + h * Math.min(dome, bevelA, bevelB) + rough;
  };
  const vertex = (r, a) => {
    const rr = r * radialScale(a);
    return up(xy(rx * rr * Math.cos(a), rz * rr * Math.sin(a)), surfaceY(r, a));
  };
  const normal = (r, a) => {
    const p = vertex(r, a - 0.003),
      q = vertex(r, a + 0.003);
    const l = vertex(Math.max(0.0001, r - 0.002), a),
      u = vertex(Math.min(1, r + 0.002), a);
    const ax = q[0] - p[0],
      ay = q[1] - p[1],
      az = q[2] - p[2],
      bx = u[0] - l[0],
      by = u[1] - l[1],
      bz = u[2] - l[2];
    const x = ay * bz - az * by,
      y = az * bx - ax * bz,
      z = ax * by - ay * bx,
      len = Math.hypot(x, y, z) || 1;
    return [x / len, y / len, z / len];
  };
  const count = measured ? 72 : rx > 11 ? 36 : rx > 8 ? 26 : 20;
  const levels =
    rx > 8
      ? [0.045, 0.18, 0.34, 0.5, 0.65, 0.77, 0.86, 0.93, 0.968, 0.989, 0.998, 1]
      : [0.055, 0.23, 0.44, 0.63, 0.79, 0.9, 0.96, 0.991, 1];
  const exposedRockSeed = 32 + seed;
  let previous;
  for (const r of levels) {
    const ring = Array.from({ length: count }, (_, i) => {
      const t = (i * TAU) / count;
      return { p: vertex(r, t), n: normal(r, t) };
    });
    if (!previous)
      batch.top(
        ring.map((item) => item.p),
        color,
        GRANITE,
        exposedRockSeed
      );
    else
      for (let i = 0; i < count; i++) {
        const j = (i + 1) % count;
        const panel = [previous[i], previous[j], ring[j], ring[i]];
        batch.face(
          panel.map((item) => item.p),
          color,
          GRANITE,
          exposedRockSeed,
          undefined,
          panel.map((item) => item.n)
        );
      }
    previous = ring;
  }
  if (obstacles) {
    const bands = [1, 0.994, 0.978, 0.95, 0.9, 0.82, 0.69, 0.52, 0.31, 0.15, 0];
    for (let j = 0; j < bands.length - 1; j++) {
      const r = bands[j],
        inner = bands[j + 1];
      const ring = Array.from({ length: 20 }, (_, i) => {
        const [x, , z] = vertex(r, (i * TAU) / 20);
        return [x, z];
      });
      const highest = Math.max(...ring.map((_, i) => surfaceY(inner, (i * TAU) / ring.length)));
      obstacles.add(ring, Math.min(peak + 0.19, highest + 0.19));
    }
  }
  return (x, z) => {
    const dx = x - centre[0],
      dz = z - centre[1];
    const u = (c * dx + s * dz) / rx,
      v = (-s * dx + c * dz) / rz,
      a = Math.atan2(v, u);
    const r = Math.hypot(u, v) / radialScale(a);
    return r <= 1 ? surfaceY(r, a) : -Infinity;
  };
}

export function stoneLookout(batch, ring, y, support, stone, openEdge = -1) {
  batch.top(
    ring.map((p) => up(p, y)),
    stone,
    GRANITE,
    0.71
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const low = (p) => Math.min(y - 0.4, support(...p) - 0.18);
    batch.face([up(a, low(a)), up(a, y), up(b, y), up(b, low(b))], '#ada48c', GRANITE, 0.71);
    if (i === openEdge) continue;
    const n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 1.45));
    for (let j = 0; j < n; j++) {
      const t = j / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      if (i % 3 === 0 && j === 0) box(batch, x, z, 0.29, 0.28, y, y + 1.11, '#afa68e', '#c9bfaa', 0, 0);
      else cylinder(batch, x, z, y, y + 1.06, 0.05, 0.047, '#839293', 5);
    }
    for (const h of [0.42, 0.72, 1.055])
      tube(batch, up(a, y + h), up(b, y + h), h > 1 ? 0.055 : 0.037, '#93a0a0', 6);
  }
}

// The mapped outlines trace the exposed crowns. Below them a lower, connected
// granite ridge carries the steps down to the wooded slope on the 10 m terrain grid.
function summitBedrock(batch, geo, obstacles, profiles, ledges, bridge, cut) {
  const segments=[];
  for(const profile of profiles) {
    for(let i=1;i<profile.length;i++) {
      const [[x,z],h,w]=profile[i-1], [[qx,qz],end,width]=profile[i];
      const dx=qx-x, dz=qz-z;
      segments.push({x,z,dx,dz,lengthSq:dx*dx+dz*dz,h,end,w,width});
    }
  }
  const [mx,mz]=[(bridge[0][0]+bridge.at(-1)[0])/2,(bridge[0][1]+bridge.at(-1)[1])/2];
  const shelves=ledges.map(({start,end,y,radius,depth,skirt})=>{
    const dx=end[0]-start[0],dz=end[1]-start[1],len=Math.hypot(dx,dz);
    return {x:start[0],z:start[1],ux:dx/len,uz:dz/len,len,y,radius,depth,skirt};
  });
  function height(x,z) {
    const base=groundY(geo,x,z)-.49;
    let y=base;
    for(const s of segments) {
      const t=Math.min(1,Math.max(0,((x-s.x)*s.dx+(z-s.z)*s.dz)/s.lengthSq));
      const distance=Math.hypot(x-s.x-t*s.dx,z-s.z-t*s.dz);
      const r=distance/(s.w+(s.width-s.w)*t);
      if(r>=1)continue;
      const uneven=.70*Math.sin(.68*(x-mx)+.29*(z-mz))+.53*Math.sin(.56*(z-mz));
      const fall=Math.sqrt(1-r**2.3)*(1-.34*r*r);
      y=Math.max(y,base+fall*(s.h+t*(s.end-s.h)-base+uneven*r));
    }
    // A broad granite shoulder runs underneath each masonry lookout. Its
    // rounded lip continues beyond the parapet before dipping into the cleft.
    for(const s of shelves) {
      const dx=x-s.x,dz=z-s.z, along=dx*s.ux+dz*s.uz, across=dz*s.ux-dx*s.uz;
      const beyond=Math.max(-along,along-s.len,0);
      const d=Math.hypot(beyond,across)-s.radius;
      if(d>=s.skirt)continue;
      const t=Math.max(0,d)/s.skirt;
      const roll=1-t*t*(3-2*t);
      const cap=s.y-s.depth-.10*across-.19*Math.sin(.83*across+.38*along);
      y=Math.max(y,base+(cap-base)*roll);
    }
    const cleft=((x-mx)*.68+(z-mz)*.73)/1.55, along=(-(x-mx)*.73+(z-mz)*.68)/5;
    return cut(x,z,Math.max(base,y-5.7*Math.exp(-cleft*cleft-along*along)));
  }
  const ends=profiles.flat();
  for(const s of ledges) for(const p of [s.start,s.end]) ends.push([p,s.y,s.radius+s.skirt+1]);
  const ext=axis=>ends.map(([p,,r])=>[p[axis]-r,p[axis]+r]);
  const bx=ext(0), bz=ext(1), step=1.15;
  const left=Math.floor(Math.min(...bx.map(e=>e[0]))), top=Math.floor(Math.min(...bz.map(e=>e[0])));
  const cols=Math.ceil((Math.max(...bx.map(e=>e[1]))-left)/step), rows=Math.ceil((Math.max(...bz.map(e=>e[1]))-top)/step);
  const grid=Array.from({length:rows+1},(_,j)=>Array.from({length:cols+1},(_,i)=>{
    const x=left+i*step, z=top+j*step, y=height(x,z);
    return {p:[x,y,z],rock:y-groundY(geo,x,z)};
  }));
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++) {
    const corners=[grid[j][i],grid[j+1][i],grid[j+1][i+1],grid[j][i+1]];
    if(corners.every(v=>v.rock<-.25))continue;
    for(const v of corners) {
      if(v.n)continue;
      const [x,,z]=v.p, n=[height(x-.24,z)-height(x+.24,z),.48,height(x,z-.24)-height(x,z+.24)];
      const length=Math.hypot(...n);
      v.n=n.map(c=>c/length);
    }
    batch.face(corners.map(v=>v.p),'#bca58a',litSurface.sunlightStone,6.2,corners.map(v=>[v.rock,0]),corners.map(v=>v.n));
  }
  // Coarser collision cells keep the obstacle index light. They include the notch.
  for(let j=0;j<rows;j+=3)for(let i=0;i<cols;i+=3) {
    const ii=Math.min(i+3,cols), jj=Math.min(j+3,rows);
    const points=[grid[j][i],grid[jj][i],grid[jj][ii],grid[j][ii]];
    const mid=grid[(j+jj)>>1][(i+ii)>>1];
    if(Math.max(mid.rock,...points.map(v=>v.rock))<.20)continue;
    obstacles.add(points.map(({p})=>[p[0],p[2]]),Math.max(mid.p[1],...points.map(v=>v.p[1])));
  }
  return height;
}

function buildSunlightRock(batch, geo, lamps, obstacles, plantings) {
  const site=sunlight, xy=localFrame(summitPoint);
  const upper=[apronEntry,...site.upperSteps.slice(1)], bridge=site.bridge, join=bridge.at(-1);
  const ascent=[join,...site.ascent], descent=[join,...site.eastDescent], slab=site.slabWalk;
  const eastEntry=[upper[2][0]-.24,upper[2][1]-.78];
  const bridgeY=80.4, landingY=eastLandingLevel, slabY=slabLandingLevel;
  const upperY=[apronLevel,landingY,landingY,bridgeY+.18,bridgeY];
  const ascentY=[bridgeY,bridgeY-.36,55.95,...ascent.slice(3).map((p,i)=>groundY(geo,...p)+[.60,.46,.38,.15][i])];
  const descentY=[bridgeY,bridgeY-.58,74.25,70.95,66.4,61.35,56.75,53.1,groundY(geo,...descent.at(-1))+.18];
  const slabLevels=[bridgeY,81.42,slabY,slabY];
  const trails=[
    {path:upper,levels:upperY,width:2.45,middle:true,branch:{index:2,side:-1}},
    {path:ascent,levels:ascentY,width:1.88},
    {path:descent,levels:descentY,width:1.52},
    {path:slab,levels:slabLevels,width:1.90},
  ];
  const cut=cutSummitPaths(trails);
  const hips=[
    [site.outcrops[0],xy(-1.3,-.4),89.35,'#bbac99',2.7,[-.18,-.045],94],
    [site.outcrops[1],xy(25.7,12.6),80.64,'#c3b39e',5.2,[-.10,-.12],86],
    [site.outcrops[2],xy(29.4,-21.5),74.65,'#b5a89a',3.6,[-.13,.055],64],
  ];
  // Lower rock skirts disappear into the wooded hillside. They leave the
  // mapped fissure open between the upright crown and the southeastern slab.
  for(const [u,v,rx,rz,angle,peak,seed] of [
    [-6.6,10.8,15,7.4,-.38,70.2,1.55],[-11.8,2.9,8.2,8.4,.40,72.4,5.3],
    [40.3,-6.8,14,8.1,-.25,65.1,3.1],[53.2,-3.9,11.8,7.1,.4,54.6,6.3],
  ]) {
    const centre=xy(u,v),ring=ellipse(localFrame(centre,angle),0,0,rx,rz,16,.15);
    hips.push([ring,centre,peak,'#baa58b',seed,[-.09,.08],32]);
  }
  const rock=hips.map(([ring,centre,peak,color,seed,tilt,detail])=>
    sculptSummitStone(batch,geo,obstacles,ring,centre,peak,color,seed,tilt,cut,detail));
  const profile=(path,levels,widths)=>widths.map((w,i)=>[path[i],levels[i]-.85,w]);
  const ridge=summitBedrock(batch,geo,obstacles,[
    profile(upper,upperY,[10.4,8.5,8.0,5.8,4.3]),
    profile(ascent,ascentY,[4.7,6.9,7.6,5.1]),
    profile(descent,descentY,[4.5,5.5,7.4,7.0,6.0,4.4,3.5,2.4]),
    profile([...slab,site.slabViewpoint],[...slabLevels,slabY-.65],[3.6,4.4,4.8,4.5,3.9]),
    profile(site.upperLanding,[landingY,landingY,landingY-1.0],[5.2,4.3,4.1]),
  ],[
    {start:xy(-2,5),end:xy(28,7),y:65.6,radius:4.7,depth:1.6,skirt:17.5},
    {start:xy(-1,0),end:xy(4.5,0),y:apronLevel,radius:4.7,depth:1.75,skirt:7.1},
    {start:eastEntry,end:site.eastViewpoint,y:landingY,radius:1.70,depth:.75,skirt:4.6},
    {start:slab.at(-1),end:site.slabViewpoint,y:slabY,radius:3.25,depth:.95,skirt:7.5},
  ],bridge,cut);
  const support=(x,z)=>Math.max(groundY(geo,x,z),ridge(x,z),...rock.map(height=>height(x,z)));
  crownLookout(batch,obstacles,lamps,support);
  for(const trail of trails)
    ridgeStairs(batch,obstacles,trail.path,trail.levels,trail.width,support,trail);
  ridgeBridge(batch,obstacles,bridge,bridgeY);
  ridgeBalcony(batch,obstacles,eastEntry,site.eastViewpoint,landingY,1.15,support,true);
  ridgeBalcony(batch,obstacles,slab.at(-1),site.slabViewpoint,slabY,2.42,support);
  for(const p of [upper[1],upper[3],ascent[2],descent[4]])
    lamps.add(p[0],support(...p)+.45,p[1],'#ffdfa6',.60);
  if(plantings) {
    const random=randomSource(7062);
    // Only sheltered fissures carry shrubs. The lookout floors, exposed
    // crowns, stone stairways and short bridge stay clear.
    for(const [u,v,r,size,count] of [
      [8.2,-5.3,1.58,1.35,8],[8.9,3.55,1.25,1.14,5],[9.2,12.1,2.5,1.83,7],
      [-8,15,4.4,5.45,7],[1.7,19.3,3.8,5.2,6],[11.9,21.2,2.8,3.5,8],
      [20.6,28,4.6,5.3,9],[34.2,28.2,4.5,5.1,8],[44.4,19.3,4.1,4.3,7],
      [33,-28,4.6,4.5,6],[-7.9,-9.8,3.7,3.7,6],[-11,18,7,5.1,11],
      [2.9,24,8,6.4,14],[11,28,8,5.7,12],[24,32,8,5.5,12],[39,34,7,5.7,12],
    ]) for(let j=0;j<count;j++) {
      const a=TAU*random(),d=r*Math.sqrt(random()), h=size*(.66+.61*random());
      const [x,z]=xy(u+d*Math.cos(a),v+d*Math.sin(a));
      if(trails.some(t=>lineDistance(x,z,t.path)<t.width/2+.66*h) ||
        Math.hypot(x-summitPoint[0],z-summitPoint[1])<6.15) continue;
      const floor=support(x,z), shrub=size<3;
      const slope=Math.hypot(support(x+.5,z)-support(x-.5,z),support(x,z+.5)-support(x,z-.5));
      if(shrub && slope>2.45)continue;
      const y=shrub ? floor : Math.min(floor,groundY(geo,x,z)+2.9);
      plantings.push([x,y-.14*h,z,h,(shrub?8:4)+j%4,(shrub?.57:.46)+.15*random()]);
    }
  }
}

// Named OSM 44 Bridge centreline plus the two paths that join it to the shore.
const FORTY_FOUR = [
  [-6138, 4269],
  [-6141, 4287],
  [-6149, 4287],
  [-6152, 4309],
  [-6159, 4316],
  [-6157, 4340],
  [-6150, 4347],
  [-6144, 4352],
  [-6138, 4352],
  [-6136, 4349],
];
const BOULDER_WALK = [
  [-6134, 4257],
  [-6142, 4255],
  [-6147, 4258],
  [-6149, 4265],
  [-6147, 4268],
  [-6138, 4269],
  [-6131, 4264],
  [-6134, 4257],
];
const NORTH_WALK = [
  [-6160, 4225],
  [-6152, 4234],
  [-6146, 4248],
  [-6142, 4255],
];
const SOUTH_WALK = [
  [-6136, 4349],
  [-6128, 4343],
  [-6121, 4339],
  [-6114, 4332],
];
const GARDEN_WALKS = [FORTY_FOUR, BOULDER_WALK, NORTH_WALK, SOUTH_WALK];
const GARDEN_ROOMS = [
  { c: [-6148, 4203], a: 0, w: 11, d: 8.0 },
  { c: [-6087, 4278], a: 0, w: 31, d: 16 },
  { c: [-6091, 4334], a: 0.53, w: 22, d: 11 },
];

function lineDistance(x, z, points) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
  }
  return best;
}

export function gulangyuReserved(x, z) {
  if (!inIslandBounds(x, z)) return false;
  if (islandSiteReserved(x, z)) return true;
  if (
    inRect(x, z, MANSION, MANSION_ANGLE, 30.1, 21.2) ||
    inRect(x, z, mansionXY(0, -22), MANSION_ANGLE, 5, 7)
  )
    return true;
  const u = x - SUMMIT[0],
    v = z - SUMMIT[1];
  if (((u - 7) / 36) ** 2 + ((v - 1) / 26.5) ** 2 < 1 || (Math.abs(u - 1) < 9 && v > 10 && v < 29))
    return true;
  if (x < -6210 || x > -6055 || z < 4185 || z > 4370) return false;
  if (GARDEN_ROOMS.some((r) => inRect(x, z, r.c, r.a, r.w / 2 + 2, r.d / 2 + 2))) return true;
  if (Math.hypot(x + 6130, z - 4225) < 6 || Math.hypot(x + 6113, z - 4357) < 6) return true;
  if (Math.hypot(x + 6140, z - 4263) < 11 || Math.hypot(x + 6161, z - 4316) < 7) return true;
  return GARDEN_WALKS.some((path) => lineDistance(x, z, path) < 3.2);
}

export function gardenWalk(batch, geo, lamps, obstacles, path, width, arch = false) {
  const normal = (a, b) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz);
    return [-dz / l, dx / l];
  };
  const norms = path.map((here, i) => {
    if (i === 0) return normal(here, path[1]);
    if (i === path.length - 1) return normal(path[i - 1], here);
    const a = normal(path[i - 1], here),
      b = normal(here, path[i + 1]);
    const dot = 1 + a[0] * b[0] + a[1] * b[1];
    return [(a[0] + b[0]) / Math.max(0.73, dot), (a[1] + b[1]) / Math.max(0.73, dot)];
  });
  const bed = (x, z) => (geo.rawHeightAt ? geo.rawHeightAt(x, z) : groundY(geo, x, z) - 1);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      n0 = norms[i - 1],
      n1 = norms[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      hump = arch && i === 1;
    const locate = (t, side) => [
      a[0] + (b[0] - a[0]) * t + (n0[0] + (n1[0] - n0[0]) * t) * side,
      a[1] + (b[1] - a[1]) * t + (n0[1] + (n1[1] - n0[1]) * t) * side,
    ];
    const height = (t) => {
      const p = locate(t, 0),
        base = Math.max(2.55, groundY(geo, ...p) + 0.3);
      return base + (hump ? 1.12 * Math.sin(Math.PI * t) ** 2 : 0);
    };
    const divisions = Math.max(1, Math.ceil(len / 2.35));
    for (let j = 0; j < divisions; j++) {
      const t = j / divisions,
        s = (j + 1) / divisions,
        ya = height(t),
        yb = height(s),
        r = width * 0.5;
      const l = locate(t, -r),
        lf = locate(s, -r),
        rf = locate(s, r),
        rr = locate(t, r);
      batch.top([up(l, ya), up(lf, yb), up(rf, yb), up(rr, ya)], '#c2b7a7', GRANITE, 3.0);
      if(hump){
        const archY=v=>.1+2.35*Math.sqrt(Math.max(0,1-(2*v-1)**2));
        batch.face([up(l,archY(t)),up(rr,archY(t)),up(rf,archY(s)),up(lf,archY(s))],'#887f70',GRANITE);
        for(const side of [-1,1]){
          const p=locate(t,side*(r+.045)),q=locate(s,side*(r+.045));
          batch.face([up(p,archY(t)),up(q,archY(s)),up(q,archY(s)+.28),up(p,archY(t)+.28)],j%2?'#beafa0':'#cbbda8',GRANITE);
        }
      }
      for (const side of [-1, 1]) {
        const p = locate(t, r * side),
          q = locate(s, r * side);
        const soffit = (t, h) =>
          hump ? 0.1 + 2.35 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) : h - 0.39;
        batch.face(
          [up(p, soffit(t, ya)), up(p, ya), up(q, yb), up(q, soffit(s, yb))],
          '#aca398',
          GRANITE,
          1.8
        );
        // Open the seaward rail where the half-moon terrace meets the turn.
        if(arch && side===1 && ((i===4 && (1-t)*len<2.8) || (i===5 && t*len<2.8)))continue;
        box(batch, ...p, 0.25, 0.25, ya - 0.05, ya + 1.03, '#d7ccb7', '#eee1cd', 0, 0);
        tube(batch, up(p, ya + 0.92), up(q, yb + 0.92), 0.117, '#e8deca', 4);
        tube(batch, up(p, ya + 0.28), up(q, yb + 0.28), 0.075, '#ddd4c2', 4);
        const half = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        tube(batch, up(p, ya + 0.3), up(half, (ya + yb) * 0.5 + 0.88), 0.065, '#d7cebb', 4);
        tube(batch, up(half, (ya + yb) * 0.5 + 0.88), up(q, yb + 0.3), 0.065, '#d7cebb', 4);
      }
      obstacles.add([l, lf, rf, rr], Math.max(ya, yb) + 1.03);
    }
    if (!hump) {
      const piers = Math.max(1, Math.ceil(len / 5.7));
      for (let j = 0; j < piers; j++) {
        const t = j / piers,
          p = locate(t, 0),
          deck = height(t);
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        box(
          batch,
          ...p,
          0.78,
          width * 0.82,
          Math.min(deck - 0.47, bed(...p) - 0.36),
          deck - 0.26,
          '#918e80',
          '#b8ac97',
          GRANITE,
          0,
          angle
        );
        box(
          batch,
          ...p,
          0.98,
          width * 0.95,
          deck - 0.62,
          deck - 0.31,
          '#b6ad9b',
          '#d0c5ae',
          0,
          0,
          angle
        );
      }
    }
    if (i % 3 === 1) {
      const p = locate(0.5, width * 0.5);
      lamps.add(p[0], height(0.5) + 0.66, p[1], '#f5c291', 0.85);
    }
  }
}

// Each glazed roof face gently rises into its ridge and sweeps upwards at its
// four corners. The underside and pale corner caps remain visible over the sea.
function sweptRoof(batch, xy, width, depth, y, rise, tint) {
  const ring = rect(xy, 0, 0, width, depth),
    half = Math.max(0.04, (width - depth) * 0.49);
  const ends = [xy(-half, 0), xy(half, 0)];
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4,
      a = ring[i],
      b = ring[k],
      r0 = ends[i === 0 || i === 3 ? 0 : 1],
      r1 = ends[k === 0 || k === 3 ? 0 : 1];
    const peak = (u, v) => {
      const edge = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      const ridge = [r0[0] + (r1[0] - r0[0]) * u, r0[1] + (r1[1] - r0[1]) * u];
      const lift = (0.33 + depth * 0.027) * Math.abs(2 * u - 1) ** 3.3 * (1 - v) ** 1.75;
      return [
        edge[0] + (ridge[0] - edge[0]) * v,
        y + rise * (0.18 * v + 0.82 * v ** 1.53) + lift,
        edge[1] + (ridge[1] - edge[1]) * v,
      ];
    };
    const bays = 8,
      bands = 4;
    for (let u = 0; u < bays; u++) {
      const s = u / bays,
        t = (u + 1) / bays;
      const p = peak(s, 0),
        q = peak(t, 0);
      batch.face([[p[0], p[1] - 0.19, p[2]], p, q, [q[0], q[1] - 0.19, q[2]]], '#c9cebd');
      tube(batch, p, q, 0.11, '#e3dfc7', 5);
      for (let v = 0; v < bands; v++) {
        const a0 = v / bands,
          a1 = (v + 1) / bands;
        const panel = [peak(s, a0), peak(t, a0), peak(t, a1), peak(s, a1)];
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          ln = Math.hypot(dx, dz);
        const uv = panel.map((p) => [((p[0] - a[0]) * dx + (p[2] - a[1]) * dz) / ln, (p[1] - y) * 2.3]);
        // The two triangular hips collapse to a point precisely at the ridge.
        if (v === bands - 1 && r0 === r1) batch.top(panel.slice(0, 3), tint, 5, 0.3, uv.slice(0, 3));
        else batch.top(panel, tint, 5, 0.3, uv);
      }
    }
    for (let v = 0; v < bands; v++)
      tube(batch, peak(0, v / bands), peak(0, (v + 1) / bands), 0.14, '#d3d1b9', 5);
  }
  tube(batch, up(ends[0], y + rise), up(ends[1], y + rise), 0.15, '#d8d3bc', 6);
}

function pavilion(batch, geo, lamps, obstacles, centre, width, depth, a, base, tint) {
  // Zhenlü Pavilion has four equal sides meeting at alternating acute and
  // obtuse corners. Carry the same diamond plan into its piers and tile roof.
  const place = localFrame(centre, a),
    xy = (u, v) => place(u + 0.38 * v, 0.925 * v);
  const ground = rect(xy, 0, 0, width, depth);
  foundation(batch, geo, ground, base, '#aea394', '#c4baaa');
  for (const p of rect(xy, 0, 0, width - 0.85, depth - 0.85)) {
    cylinder(batch, ...p, base, base + 0.26, 0.23, 0.22, '#c7bb9f', 9);
    cylinder(batch, ...p, base + 0.25, base + 2.67, 0.142, 0.125, '#9b4937', 10);
    box(batch, ...p, 0.48, 0.45, base + 2.49, base + 2.79, '#945541', '#b79470', 0, 0, a);
  }
  const rail = rect(xy, 0, 0, width - 0.72, depth - 0.72);
  for (let i = 0; i < 3; i++) {
    const p = rail[i],
      q = rail[(i + 1) % 4];
    tube(batch, up(p, base + 0.47), up(q, base + 0.47), 0.14, '#b67753', 4);
    tube(batch, up(p, base + 2.62), up(q, base + 2.62), 0.22, '#8f5743', 4);
  }
  sweptRoof(batch, xy, width + 1.38, depth + 1.42, base + 2.72, 1.65, tint);
  obstacles.add(rect(xy, 0, 0, width + 1.35, depth + 1.4), base + 4.56);
  lamps.add(centre[0], base + 2.48, centre[1], '#ffcea0', 0.94);
}

function fanPavilion(batch, geo, lamps, obstacles) {
  const centre = [-6113, 4357],
    frame = localFrame(centre, 0.37);
  const halfAngle = 0.61,
    inner = 2.15,
    outer = 5.86,
    bays = 9;
  const xy = (r, a) => frame(r * Math.sin(a), r * Math.cos(a) - 3.62);
  const arc = (i) => ((2 * i) / bays - 1) * halfAngle;
  const arcPoints = (r) => Array.from({ length: bays + 1 }, (_, i) => xy(r, arc(i)));
  const floor = [...arcPoints(outer), ...arcPoints(inner).reverse()];
  const y = Math.max(groundY(geo, ...centre) + 0.29, ...floor.map((p) => groundY(geo, ...p) - 0.2));
  // The curved inner boundary makes this floor concave, so prism triangulates
  // the paving while its separate battered walls follow the terrain.
  prism(batch, floor, y - 0.28, y, '#ad9d87', '#c3b49f');
  for (let i = 0; i < floor.length; i++) {
    const p = floor[i],
      q = floor[(i + 1) % floor.length];
    batch.face(
      [
        up(p, Math.min(y - 0.18, groundY(geo, ...p) - 0.45)),
        up(p, y - 0.2),
        up(q, y - 0.2),
        up(q, Math.min(y - 0.18, groundY(geo, ...q) - 0.45)),
      ],
      '#ac9e89',
      GRANITE
    );
  }
  for (const r of [inner + 0.19, outer - 0.25])
    for (const a of [-0.53, 0.53]) {
      const p = xy(r, a);
      cylinder(batch, ...p, y, y + 0.23, 0.23, 0.2, '#c4b8a3', 8);
      cylinder(batch, ...p, y + 0.21, y + 2.66, 0.145, 0.135, '#a45440', 8);
    }
  const edgeNear = inner - 0.33,
    edgeFar = outer + 0.62,
    ridge = (inner + outer) / 2;
  const surface = (a, t, edge) => {
    const radius = edge + (ridge - edge) * t;
    const sweep = 0.37 * Math.abs(a / halfAngle) ** 3 * (1 - t) ** 1.6;
    return up(xy(radius, a), y + 2.61 + 1.2 * t ** 1.45 + sweep);
  };
  for (let i = 0; i < bays; i++) {
    const a = arc(i),
      b = arc(i + 1);
    for (const edge of [edgeNear, edgeFar]) {
      const e = surface(a, 0, edge),
        f = surface(b, 0, edge);
      tube(batch, e, f, 0.115, '#e1deca', 5);
      batch.face([[e[0], e[1] - 0.17, e[2]], e, f, [f[0], f[1] - 0.17, f[2]]], '#bccaad');
      const meshBands = 3;
      for (let step = 0; step < meshBands; step++) {
        const t = step / meshBands,
          q = (step + 1) / meshBands;
        batch.top(
          [surface(a, t, edge), surface(b, t, edge), surface(b, q, edge), surface(a, q, edge)],
          '#586e64',
          5,
          0.26,
          [
            [i * 0.54, t * 2.3],
            [(i + 1) * 0.54, t * 2.3],
            [(i + 1) * 0.54, q * 2.3],
            [i * 0.54, q * 2.3],
          ]
        );
      }
    }
    tube(batch, surface(a, 1, edgeFar), surface(b, 1, edgeFar), 0.14, '#d4d1b9', 6);
    if (i === 0 || i === bays - 1)
      for (const edge of [edgeNear, edgeFar]) {
        const angle = i === 0 ? a : b;
        tube(batch, surface(angle, 0, edge), surface(angle, 0.5, edge), 0.12, '#d1cfb8', 5);
        tube(batch, surface(angle, 0.5, edge), surface(angle, 1, edge), 0.12, '#d1cfb8', 5);
      }
    if (i > 0 && i < bays - 1)
      tube(
        batch,
        up(xy(outer - 0.2, a), y + 0.48),
        up(xy(outer - 0.2, b), y + 0.48),
        0.125,
        '#b47b58',
        4
      );
  }
  obstacles.add(floor, y + 3.96);
  lamps.add(centre[0], y + 2.41, centre[1], '#f7ca9c', 0.88);
}

function moonWall(batch, a, b, base, height, diameter, color) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    w = Math.hypot(dx, dz) / 2,
    sx = dx / (w * 2),
    sz = dz / (w * 2);
  const mx = (a[0] + b[0]) * 0.5,
    mz = (a[1] + b[1]) * 0.5,
    cy = diameter * 0.5 + 0.085;
  const p = (x, y, depth) => [mx + sx * x + sz * depth, base + y, mz + sz * x - sx * depth];
  const angles = Array.from({ length: 28 }, (_, i) => (i * TAU) / 28);
  for (const xx of [-w, w])
    for (const yy of [-cy, height - cy]) angles.push((Math.atan2(yy, xx) + TAU) % TAU);
  angles.sort((a, b) => a - b);
  const inner = (angle, d) =>
    p(diameter * 0.5 * Math.cos(angle), cy + diameter * 0.5 * Math.sin(angle), d);
  const outer = (angle, d) => {
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const dist = Math.min(
      w / Math.max(0.0001, Math.abs(c)),
      (s > 0 ? height - cy : cy) / Math.max(0.0001, Math.abs(s))
    );
    return p(c * dist, cy + s * dist, d);
  };
  for (let i = 0; i < angles.length; i++) {
    const aa = angles[i],
      bb = angles[(i + 1) % angles.length];
    for (const d of [-0.22, 0.22])
      batch.face([inner(aa, d), outer(aa, d), outer(bb, d), inner(bb, d)], color);
    batch.face([inner(aa, -0.22), inner(aa, 0.22), inner(bb, 0.22), inner(bb, -0.22)], '#a7a493');
    tube(batch, inner(aa, 0.24), inner(bb, 0.24), 0.075, '#a5aca0', 5);
  }
  tube(batch, up(a, base + height + 0.035), up(b, base + height + 0.035), 0.15, '#78877c', 4);
}

function gardenHall(batch, geo, lamps, obstacles, room, green, moon = false) {
  const { c, a, w, d } = room,
    xy = localFrame(c, a),
    ground = rect(xy, 0, 0, w + 0.8, d + 0.8);
  const base = Math.max(
    groundY(geo, ...c) + 0.5,
    Math.max(...ground.map((p) => groundY(geo, ...p))) - 0.55
  );
  const eave = base + (green ? 3.1 : 6.45);
  if (moon) {
    // The poetry pavilion extends over the water on stone piers.
    prism(batch, ground, base - 0.36, base, '#a59d89', '#cec0a7');
    for (const u of [-w * 0.43, 0, w * 0.43])
      for (const v of [-d * 0.42, d * 0.42]) {
        const p = xy(u, v),
          bed = geo.rawHeightAt ? geo.rawHeightAt(...p) : groundY(geo, ...p);
        box(
          batch,
          ...p,
          0.63,
          0.65,
          Math.min(base - 0.49, bed - 0.55),
          base - 0.29,
          '#9e998a',
          '#b7ab94',
          GRANITE
        );
      }
  } else foundation(batch, geo, ground, base, '#a59d89', '#cec0a7');
  if (moon) {
    const ring = rect(xy, 0, 0, w - 0.5, d - 0.5);
    for (let i = 0; i < 4; i++) {
      const p = ring[i],
        q = ring[(i + 1) % 4];
      if (i === 0 || i === 1) moonWall(batch, p, q, base, 3.04, 2.43, '#dfdcc9');
      else {
        batch.face([up(p, base), up(p, eave), up(q, eave), up(q, base)], '#dddbc7');
        archWindow(batch, p, q, 0.5, base + 0.48, 0.96, 1.89);
      }
    }
  } else {
    const body = rect(xy, 0, 0, w - 1.9, d - 1.6);
    prism(batch, body, base, eave, '#e0d5c3', '#bead94');
    for (let i = 0; i < 4; i++) {
      const p = body[i],
        q = body[(i + 1) % 4],
        bays = i % 2 === 0 ? (green ? 5 : 9) : 3;
      for (const lower of green ? [0.36] : [0.48, 3.56]) {
        for (let k = 0; k < bays; k++)
          archWindow(
            batch,
            p,
            q,
            (k + 0.5) / bays,
            base + lower,
            green ? 0.99 : 1.13,
            green ? 2.0 : 2.03,
            '#d8bea4'
          );
      }
    }
    if (!green) {
      prism(batch, rect(xy, 0, 0, w - 0.8, d - 0.8), base + 3.15, base + 3.36, '#b9a087', '#d7c5ad');
      const front = rect(xy, 0, 0, w, d)[0];
      lamps.add(front[0], base + 3.0, front[1], '#f7cda4', 1.0);
    }
  }
  if (moon) {
    sweptRoof(batch, xy, w + 1.0, d + 1.2, eave, 1.13, '#556d64');
    const upper = rect(xy, 0, 0, w - 2.3, d - 2.3);
    prism(batch, upper, eave + 0.43, eave + 1.45, '#b3a58c', '#c4c3ad');
    for (let i = 0; i < 4; i++)
      tube(batch, up(upper[i], eave + 1.32), up(upper[(i + 1) % 4], eave + 1.32), 0.09, '#9a6554', 4);
    sweptRoof(batch, xy, w - 0.55, d - 1.13, eave + 1.44, 1.73, '#50685d');
  } else if (green) sweptRoof(batch, xy, w + 1.0, d + 1.2, eave, 1.95, '#536b63');
  else hipRoof(batch, xy, 0, 0, w + 0.3, d + 0.65, eave, 3.05, '#c37d5b', '#d99b79');
  obstacles.add(ground, eave + (moon ? 3.38 : green ? 2.16 : 3.31));
}

function gardenShore(batch,geo,obstacles) {
  const wall=islandPlan.gardenSeaWall;
  const terraceY=(x,z)=>Math.max(2.18,groundY(geo,x,z)+.27);
  paveFootprint(batch,islandPlan.gardenTerrace,terraceY,'#bcb0a1',4);
  for(const ring of islandPlan.gardenGateWings){
    const lowest=Math.min(...ring.map(p=>groundY(geo,...p)))-.45;
    const eave=Math.max(...ring.map(p=>groundY(geo,...p)))+3.05;
    prism(batch,ring,lowest,eave,'#d2cbbb','#738078');
    const exterior=signedArea(ring)>0 ? ring : ring.toReversed();
    for(let i=0;i<exterior.length;i++){
      const a=exterior[i],b=exterior[(i+1)%exterior.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const face=localFrame(a,Math.atan2(b[1]-a[1],b[0]-a[0]));
      for(let u=1.65;u<len-1.25;u+=3.1){
        const outside=face(u,-.38);
        if(islandPlan.gardenGateWings.some(r=>inRing(...outside,r)))continue;
        const left=face(u-.63,-.045),right=face(u+.63,-.045);
        const sill=Math.max(groundY(geo,...outside)+.65,eave-2.18);
        batch.face([up(left,sill),up(left,eave-.58),up(right,eave-.58),up(right,sill)],'#555e54');
        tube(batch,up(face(u,-.07),sill),up(face(u,-.07),eave-.58),.052,'#a5957b',4);
        tube(batch,up(left,eave-.98),up(right,eave-.98),.044,'#a5957b',4);
      }
    }
    // Low roof sections share the party walls. The larger west wing returns
    // toward the seawall around a small open passage.
    const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
    const w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs);
    const mid=[(Math.max(...xs)+Math.min(...xs))/2,(Math.max(...zs)+Math.min(...zs))/2];
    const frame=localFrame(mid,w>=d?0:Math.PI/2);
    hipRoof(batch,frame,0,0,Math.max(w,d)*.91,Math.min(w,d)*.74,eave+.16,1.10,'#64716a','#abb4a5');
    obstacles.add(ring,eave+1.35);
  }
  const walk=islandPlan.gardenGateWalk;
  for(let i=1;i<walk.length;i++){
    const a=walk[i-1],b=walk[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const frame=localFrame(a,Math.atan2(b[1]-a[1],b[0]-a[0]));
    paveFootprint(batch,rect(frame,len/2,0,len+.02,1.85),terraceY,'#b2aa96');
  }
  const bed=(x,z)=>geo.rawHeightAt?.(x,z) ?? groundY(geo,x,z);
  for(let i=1;i<wall.length;i++){
    const a=wall[i-1],b=wall[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const xy=localFrame(a,Math.atan2(b[1]-a[1],b[0]-a[0])), count=Math.ceil(len/1.95);
    for(let j=0;j<count;j++){
      const start=j*len/count,end=(j+1)*len/count;
      const p=xy(start,0),q=xy(end,0);
      const crest=v=>Math.max(2.28,groundY(geo,...v)+.42);
      const y=crest(p),z=crest(q);
      for(const side of [-.42,.42]){
        const l=xy(start,side),r=xy(end,side);
        batch.face([up(l,Math.min(y-.65,bed(...l)-.36)),up(l,y),up(r,z),up(r,Math.min(z-.65,bed(...r)-.36))],
          j%3?'#9d9385':'#ac9e8c',GRANITE);
      }
      const panel=rect(xy,(start+end)/2,0,end-start,.92);
      batch.top([up(panel[0],y),up(panel[1],z),up(panel[2],z),up(panel[3],y)],'#c9c1ad',GRANITE);
      if(i===5 || i===6) {
        prism(batch,rect(xy,start,0,.34,.36),y-.08,y+.81,'#ac9f8e','#c6b8a6');
        tube(batch,up(p,y+.69),up(q,z+.69),.10,'#b7ab9a',4);
        tube(batch,up(p,y+.32),up(q,z+.32),.075,'#c1b6a6',4);
      }
      obstacles.add(panel,Math.max(y,z)+(i===5 || i===6?.81:0));
    }
  }
  // The mapped west gate is open through the middle; its wings meet the beach.
  const ring=islandPlan.gardenWestGate;
  const [cx,cz]=ring.reduce(([x,z],p)=>[x+p[0]/ring.length,z+p[1]/ring.length],[0,0]);
  const xy=localFrame([cx,cz],.035), y=terraceY(cx,cz);
  for(const p of rect(xy,0,0,3.20,4.9))cylinder(batch,...p,y-.2,y+4.04,.20,.17,'#785848',9);
  sweptRoof(batch,xy,5.5,6.4,y+4.0,1.5,'#56615b');
  obstacles.add(ring,y+5.7);
}

function garden(batch, geo, lamps, obstacles) {
  gardenShore(batch,geo,obstacles);
  // A split boulder inside the north loop and the small tidal rock under Duyue Pavilion.
  monolith(batch, geo, [-6140.5, 4263.5], 7.35, 5.15, -0.56, 4.12, 3.18, '#c0a890', obstacles);
  monolith(batch, geo, [-6141.2, 4261.65], 4.7, 4.35, -0.66, 9.4, 5.17, '#b9a18a', obstacles);
  monolith(batch, geo, [-6161.1, 4317.2], 5.65, 3.75, 0.56, 2.68, 4.41, '#b09b84', obstacles);
  for (const walk of GARDEN_WALKS)
    gardenWalk(
      batch,
      geo,
      lamps,
      obstacles,
      walk,
      walk === FORTY_FOUR ? 2.52 : 2.12,
      walk === FORTY_FOUR
    );

  // The moon-viewing structure on the bridge is a roofless half-moon room. The
  // traditional swept tile roofs belong to the other garden rooms up the shore.
  const moon = localFrame([-6160.2, 4316.4], -0.16);
  const shell = Array.from({ length: 17 }, (_, i) => {
    const angle = Math.PI * 0.5 + (Math.PI * i) / 16;
    return moon(4.35 * Math.cos(angle), 4.0 * Math.sin(angle));
  });
  const deck = 2.86;
  prism(batch, shell, Math.min(-.46,...shell.map(p=>geo.rawHeightAt?.(...p) ?? 0))-.35, deck, '#a89987', '#c4b39d', GRANITE);
  for (let i = 1; i < shell.length; i++) {
    const a = shell[i - 1],
      b = shell[i];
    batch.face([up(a, deck), up(a, deck + 1.04), up(b, deck + 1.04), up(b, deck)], '#c6b6a4');
    if (i % 4 === 1 || i % 4 === 0)
      batch.face(
        [up(a, deck + 1.04), up(a, deck + 2.17), up(b, deck + 2.17), up(b, deck + 1.04)],
        '#c7b8a8'
      );
    batch.face(
      [up(a, deck + 2.08), up(a, deck + 2.34), up(b, deck + 2.34), up(b, deck + 2.08)],
      '#d6c6b6'
    );
    tube(batch, up(a, deck + 2.34), up(b, deck + 2.34), 0.13, '#aaa49a', 5);
  }
  obstacles.add(shell, deck + 2.48);
  pavilion(
    batch,
    geo,
    lamps,
    obstacles,
    [-6130, 4225],
    4.2,
    4.2,
    0.52,
    groundY(geo, -6130, 4225) + 0.24,
    '#536e61'
  );
  fanPavilion(batch, geo, lamps, obstacles);
  gardenHall(batch, geo, lamps, obstacles, GARDEN_ROOMS[0], true, true);
  for (const room of GARDEN_ROOMS.slice(1)) gardenHall(batch, geo, lamps, obstacles, room, false);
}

export function buildGulangyu(batch, geo, lamps, obstacles, _signs, plantings) {
  buildMansion(batch, geo, lamps, obstacles);
  buildSunlightRock(batch, geo, lamps, obstacles, plantings);
  garden(batch, geo, lamps, obstacles);
  if (plantings) {
    // Low planting beds frame the axis between the entrance steps and the pond.
    for (const side of [-1,1]) for (let j=0;j<9;j++) {
      const [x,z]=huangFrame.xy(-1+side*(6.3+.36*Math.cos(1.2*j)),18+j*1.3);
      plantings.push([x,groundY(geo,x,z),z,1.05+.24*Math.sin(j*2.3),8+j%4,.63]);
    }
  }
}

// Geometry stays batched with the other landmarks. These material indices only
// affect the island asset. Granite grain is filtered into its average at distance.
const SURFACE_FUNCTIONS = `
uniform sampler2D sunlightInk;
uniform sampler2D sunlightGranite;
// Project the same physical grain across crowns, cliff faces and sloping
// shoulders. R contains luminance, GB the two tangent-space normal components.
vec4 glgStoneScan(vec3 p,vec3 n) {
  vec3 w=pow(abs(n),vec3(5.));
  w/=max(.0001,w.x+w.y+w.z);
  vec3 s=sign(n);
  vec3 x=texture2D(sunlightGranite,vec2(-p.z*s.x,p.y)).rgb;
  vec3 y=texture2D(sunlightGranite,vec2(p.x,-p.z*s.y)).rgb;
  vec3 z=texture2D(sunlightGranite,vec2(p.x*s.z,p.y)).rgb;
  vec2 nx=x.gb*2.-1.,ny=y.gb*2.-1.,nz=z.gb*2.-1.;
  vec3 bump=w.x*vec3(0.,nx.y,-s.x*nx.x)+w.y*vec3(ny.x,0.,-s.y*ny.y)+w.z*vec3(s.z*nz.x,nz.y,0.);
  return vec4(bump-n*dot(bump,n),dot(w,vec3(x.r,y.r,z.r)));
}
float glgHash(vec3 q) {
  q=fract(q*vec3(.1031,.11369,.13787));
  q+=dot(q,q.yxz+19.19);
  return fract((q.x+q.y)*q.z);
}
float glgNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(mix(glgHash(i),glgHash(i+vec3(1,0,0)),f.x),
                 mix(glgHash(i+vec3(0,1,0)),glgHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(glgHash(i+vec3(0,0,1)),glgHash(i+vec3(1,0,1)),f.x),
                 mix(glgHash(i+vec3(0,1,1)),glgHash(i+vec3(1)),f.x),f.y),f.z);
}
`;
const SURFACE_COLOR = `
bool carvedStatue=abs(surfaceKind.x-${litSurface.statueStone}.)<.25;
bool inscribedCliff=abs(surfaceKind.x-${litSurface.sunlightCliff}.)<.25;
bool summitMasonry=abs(surfaceKind.x-${litSurface.summitMasonry}.)<.25;
bool summitRock=abs(surfaceKind.x-${litSurface.sunlightStone}.)<.25;
bool summitTread=abs(surfaceKind.x-${litSurface.sunlightTread}.)<.25;
bool summitSteel=abs(surfaceKind.x-${litSurface.sunlightSteel}.)<.25;
bool summitLamp=abs(surfaceKind.x-${litSurface.sunlightLamp}.)<.25;
vec3 stoneBump=vec3(0.);
if(summitRock || inscribedCliff || summitMasonry || summitTread) {
  vec3 p=scenePos-vec3(-6351.5,80.,3928.6), n=normalize(sceneNormal);
  float seed=surfaceKind.y;
  float warm=glgNoise(p*.17+vec3(6.1));
  vec3 detailPos=p*(summitMasonry || summitTread ? 1.30 : .57)+vec3(.37,.13,.63)*seed;
  detailPos+=.62*vec3(warm,glgNoise(p*.29),glgNoise(p*.21-3.));
  vec4 scan=glgStoneScan(detailPos,n);
  float grains=clamp((scan.w-.615)*2.85,-.54,.62);
  if(summitRock || inscribedCliff) {
    float varnish=glgNoise(p*vec3(.24,.045,.23)+5.1);
    float seam=sin(dot(p.xz,vec2(.61,.32))+.44*p.y*.09+2.8*warm);
    float vertical=1.-smoothstep(.30,.95,abs(n.y));
    float runoff=smoothstep(.41,.76,varnish+.09*seam)*(.30+.70*vertical);
    vec3 c=diffuseColor.rgb*(.99+.99*grains);
    c*=mix(vec3(1.18,1.06,.93),vec3(.58,.56,.51),runoff);
    float veins=glgNoise(p*vec3(1.13,.16,.97)+1.8*warm);
    float wet=smoothstep(.45,.77,.56*varnish+.44*veins)*(.25+.75*vertical);
    c*=1.-.47*wet;
    float joint=abs(fract(dot(p.xz,vec2(.094,.043))+.020*p.y+.23*warm+.068*glgNoise(p*.63))-.5);
    float crack=(1.-smoothstep(.006,.023,joint))*smoothstep(.35,.69,varnish)*vertical;
    c*=1.-.31*crack;
    if(summitRock) {
      // A shallow exfoliation joint crosses the eastern flank in short runs.
      float plane=p.y-7.1+.12*(p.x-4.)-.065*p.z+.41*(warm-.5)+.12*veins;
      float feather=max(.026,fwidth(plane));
      float line=(1.-smoothstep(.028,.078+feather,abs(plane)));
      float lip=1.-smoothstep(.012,.064+feather,abs(plane-.115));
      float exposed=smoothstep(.31,.64,varnish+.17*veins)*smoothstep(.5,5.5,p.x)*(.45+.55*vertical);
      c*=1.+(.21*lip-.57*line)*exposed;
    }
    if(summitRock) {
      // Broad vertical stains remain discontinuous on dry, exposed granite.
      float dry=glgNoise(p*.32+vec3(.7,4.,1.));
      c=mix(c,diffuseColor.rgb*vec3(1.07,1.065,1.055)*(.93+.85*grains),
        .32*smoothstep(.27,.72,dry));
    }
    float mineral=smoothstep(.58,.78,scan.w+.12*warm);
    c=mix(c,c*vec3(1.18,1.13,1.08),mineral*.48);
    float moss=smoothstep(.57,.80,.64*varnish+.36*glgNoise(p*.51))*
      smoothstep(-.04,.48,n.y)*(1.-smoothstep(6.0,10.5,p.y));
    c=mix(c,c*vec3(.57,.69,.38),moss*.53);
    if(summitRock && abs(surfaceUV.y)<.2) {
      float soil=1.-smoothstep(.15,4.4+5.2*warm,surfaceUV.x+.70*veins);
      vec3 foot=mix(vec3(.079,.090,.046),vec3(.18,.138,.083),warm)*(.82+.30*veins+.26*grains);
      c=mix(c,foot,.93*soil);
    }
    stoneBump=scan.xyz*.61;
    if(inscribedCliff) {
      float ink=texture2D(sunlightInk,surfaceUV).r;
      vec2 h=vec2(1./512.,1./576.);
      float du=texture2D(sunlightInk,surfaceUV+vec2(h.x,0.)).r-texture2D(sunlightInk,surfaceUV-vec2(h.x,0.)).r;
      float dv=texture2D(sunlightInk,surfaceUV+vec2(0.,h.y)).r-texture2D(sunlightInk,surfaceUV-vec2(0.,h.y)).r;
      stoneBump+=.66*(du*vec3(.15,0.,-.989)+dv*vec3(0.,1.,0.));
      c=mix(c,vec3(.67,.071,.045)*(.84+.22*warm+.17*grains),ink*(.95+.04*varnish));
    }
    diffuseColor.rgb=c;
  } else {
    float stains=glgNoise(p*vec3(1.13,.16,.95));
    diffuseColor.rgb*=(.93+.43*grains)*(1.-.24*smoothstep(.54,.79,stains));
    stoneBump=scan.xyz*.38;
    if(summitTread && all(greaterThanEqual(surfaceUV,vec2(-.01))) && all(lessThanEqual(surfaceUV,vec2(1.01)))) {
      float wear=(1.-smoothstep(.055,.17,abs(abs(surfaceUV.x-.5)-.26)));
      float lip=1.-smoothstep(.028,.095,min(surfaceUV.y,1.-surfaceUV.y));
      diffuseColor.rgb*=.86+.14*wear+.19*lip;
    }
  }
}
if(summitSteel) {
  vec3 r=reflect(normalize(scenePos-cameraPosition),normalize(sceneNormal));
  vec3 reflected=mix(vec3(.105,.125,.108),vec3(.64,.74,.78),smoothstep(-.13,.18,r.y));
  float polish=step(.8,surfaceKind.y);
  diffuseColor.rgb=mix(diffuseColor.rgb,reflected,.28+.59*polish);
}
if ((surfaceKind.x>12.5 && surfaceKind.x<15.5) || carvedStatue) {
  vec3 p=scenePos-vec3(-6351.,0.,3931.);
  float footprint=max(length(dFdx(p)),length(dFdy(p)));
  if (surfaceKind.x<13.5 || carvedStatue) {
    vec3 n=normalize(sceneNormal);
    float warm=glgNoise(p*.205+vec3(3.4));
    float stains=glgNoise(p*vec3(.32,.045,.31)+vec3(1.4,7.1,8.));
    float coarse=glgNoise(p*.72+warm*1.8);
    float streak=sin(dot(p.xz,vec2(.77,.31))+1.7*stains+1.45*glgNoise(p*.13));
    float vertical=(1.-smoothstep(.48,.96,abs(n.y)));
    float damp=smoothstep(.62,.97,streak)*smoothstep(.35,.76,stains)*vertical;
    vec3 granite=diffuseColor.rgb*(.76+.22*warm+.13*coarse);
    float exposed=step(31.,surfaceKind.y);
    granite=mix(granite,granite*vec3(.56,.61,.60),damp*(.28+.63*exposed));
    if(exposed>.5) {
      // Broad streaks of rain-darkened granite and broken vertical fissures.
      float split=abs(fract(.084*p.x+.047*p.z+.012*p.y+.24*stains+.047*coarse)-.5);
      float crack=(1.-smoothstep(.009,.046,split))*smoothstep(.15,.74,coarse+.23*stains);
      float runOff=smoothstep(.57,.78,stains+.11*coarse)*smoothstep(.25,.75,vertical);
      granite*=1.-(.37*crack+.32*runOff)*(1.-smoothstep(1.1,5.6,footprint));
    }
    granite*=mix(vec3(1.04,1.,.97),vec3(.94,1.,1.035),smoothstep(.29,.72,warm));
    float vein=abs(glgNoise(p*.34+coarse*.55)-.52);
    granite+=vec3(.037,.031,.022)*(1.-smoothstep(.018,.055,vein))*(1.-smoothstep(.34,1.25,footprint));
    float mineral=glgNoise(p*3.65+vec3(4.7,.3,8.1));
    granite*=1.+.23*(mineral-.48)*(1.-smoothstep(.09,.64,footprint));
    float grain=glgHash(floor(p*26.7));
    float resolve=1.-smoothstep(.014,.089,footprint);
    granite*=1.+resolve*(.24*smoothstep(.72,.95,grain)-.37*(1.-smoothstep(.06,.29,grain)));
    diffuseColor.rgb=granite;
  } else if(surfaceKind.x<14.5) {
    vec2 row=vec2(surfaceUV.x/.53+.5*mod(floor(surfaceUV.y/.22),2.),surfaceUV.y/.22);
    vec2 f=fract(row),edge=min(f,1.-f);
    float m=1.-smoothstep(.023,.090,min(edge.x,edge.y));
    float resolve=1.-smoothstep(.05,.52,footprint);
    float brick=glgHash(vec3(floor(row),surfaceKind.y));
    diffuseColor.rgb*=1.+(.22*brick-.11)*resolve;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.39,.30,.23),m*resolve*.63);
  } else {
    vec2 uv=surfaceUV;
    float resolve=1.-smoothstep(.06,.74,footprint);
    float seam=1.-smoothstep(.025,.12,min(fract(uv.y*3.7),1.-fract(uv.y*3.7)));
    diffuseColor.rgb*=.96+.07*glgNoise(p*1.1)-.112*seam*resolve;
  }
}
`;

export function applyGulangyuMaterials(material, inscriptionMask, graniteDetail) {
  if (material.userData.gulangyuFinish) return material;
  material.userData.gulangyuFinish = true;
  const previous = material.onBeforeCompile;
  const programKey = material.customProgramCacheKey.bind(material);
  const baseKey = programKey();
  material.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer);
    shader.uniforms.sunlightInk = { value: inscriptionMask };
    shader.uniforms.sunlightGranite = { value: graniteDetail };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SURFACE_FUNCTIONS)
      .replace(
        '#include <roughnessmap_fragment>',
        SURFACE_COLOR +
          '\n#include <roughnessmap_fragment>\nif(abs(surfaceKind.x-13.)<.25 || carvedStatue || summitRock || inscribedCliff)roughnessFactor=.92; if(summitSteel)roughnessFactor=mix(.41,.19,step(.8,surfaceKind.y));'
      )
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nif(summitRock || inscribedCliff || summitTread || summitMasonry) normal=normalize(normal+mat3(viewMatrix)*stoneBump*(gl_FrontFacing?1.:-1.));')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if(abs(surfaceKind.x-15.)<.25) totalEmissiveRadiance+=vec3(.16,.032,.016)*sceneryDarkness*(.6+.4*max(0.,-normalize(sceneNormal).x));
        if(inscribedCliff || summitRock) {
          vec3 n=normalize(sceneNormal);
          float wash=max(0.,dot(n,normalize(vec3(.75,-.30,.48))));
          totalEmissiveRadiance+=diffuseColor.rgb*vec3(.90,.65,.39)*sceneryDarkness*(.15+.52*wash);
        }
        if(summitLamp) totalEmissiveRadiance+=vec3(2.6,1.64,.69)*sceneryDarkness;
        if(summitMasonry || summitTread || summitSteel) {
            vec3 n=normalize(sceneNormal);
            float wash=.25+.62*max(0.,dot(n,normalize(vec3(.83,.29,-.54))));
            totalEmissiveRadiance+=diffuseColor.rgb*vec3(.94,.71,.45)*sceneryDarkness*wash;
        }
        if(carvedStatue) {
          vec3 p=scenePos-vec3(-5386.4,29.5,4015.), n=normalize(sceneNormal);
          float key=max(0.,dot(n,normalize(vec3(7.,.5,-5.)-p)));
          float fill=max(0.,dot(n,normalize(vec3(2.,.4,7.)-p)));
          totalEmissiveRadiance+=diffuseColor.rgb*vec3(1.05,.77,.48)*sceneryDarkness*(.19+.90*key+.44*fill);
        }`
      );
  };
  material.customProgramCacheKey = () => baseKey + '-gulangyu-summit-scan-v5';
  material.needsUpdate = true;
  return material;
}
