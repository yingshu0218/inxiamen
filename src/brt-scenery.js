import { alongFrame, offset } from './old-town-layout.js';
import { ellipse, rect, up } from './landmark-forms.js';
import { cylinder, groundY, litSurface, MeshBatch, prism } from './scenery-mesh.js';
import { brtLinks, brtStops, brtPlatformAt, brtRows, brtRoadHeight, brtLaneWidth, brtTurnPoint,
  laneOffset, roadHalf, turnRadius } from './brt-layout.js';
import { buildBrtStations } from './brt-stations.js';
import { streets as wucunStreets } from './wucun-layout.js';

const asphalt = '#43484b', concrete = '#aeb5af', soffit = '#899994', blue = '#8dabb2';
const span = 30;
const halfWidth = (link, s) => link.oneWay ? 2.24 : roadHalf + brtLaneWidth(link, s) - laneOffset;
const deckPoint = (p, d, h = 0) => [p.x + d * p.rx, p.y + h, p.z + d * p.rz];

function loft(batch, a, b, section, style = 0) {
  const A = section(a), B = section(b);
  for (let i = 1; i < A.length; i++) {
    const [x, y, color] = A[i], [u, v] = A[i - 1];
    const [xx, yy] = B[i], [uu, vv] = B[i - 1];
    batch.face([deckPoint(a, u, v), deckPoint(b, uu, vv), deckPoint(b, xx, yy), deckPoint(a, x, y)], color, style);
  }
}

function girder(batch, a, b) {
  loft(batch, a, b, ({ half, depth }) => {
    const lip = half + .47, haunch = half * .64, web = half * .52;
    return [
      [-half, -.011], [-lip, -.10, concrete], [-lip, -.30, blue],
      [-half, -.49 * depth, concrete], [-haunch, -.63 * depth, concrete],
      [-web, -depth, '#a1ada7'], [web, -depth, soffit],
      [haunch, -.63 * depth, '#a1ada7'], [half, -.49 * depth, concrete],
      [lip, -.30, concrete], [lip, -.10, blue], [half, -.011, concrete],
    ];
  }, litSurface.paleStone);
}

function parapet(batch, a, b, side, low) {
  const profile = p => {
    const d = p.half;
    const full = [
      [d + .43, -.13], [d + .43, .77, '#a9b6b2'], [d + .38, .87, '#c0cbc5'],
      [d + .02, .87, '#c8cebf'], [d - .04, .78, '#b0b9b2'],
      [d - .06, .31, '#aeb5ac'], [d - .27, .009, '#9ca8a3'],
    ];
    const curb = [[d + .43, -.13], [d + .43, .16, concrete], [d + .12, .16, '#b6c2bb'], [d + .10, .005, concrete]];
    const faces = low ? curb : full;
    if (side > 0) return faces;
    return faces.map(([x, y], i) => [-x, y, faces[i + 1]?.[2]]).reverse();
  };
  loft(batch, a, b, profile, litSurface.paleStone);
}

function paint(batch, a, b, loA, hiA, loB, hiB, color) {
  batch.top([deckPoint(a, loA, .025), deckPoint(a, hiA, .025),
    deckPoint(b, hiB, .025), deckPoint(b, loB, .025)], color);
}

function pier(batch, frame, ground, underside, narrow) {
  const y = underside - .21;
  if (y - ground < 1) return;
  const across = narrow ? .81 : 1;
  const profile = [
    [ground - .43, .98, 1.20], [ground + .37, .91, 1.02],
    [ground + (y - ground) * .57, .71, .80], [y - .71, .93, 1.48], [y - .13, 1.15, 1.87],
  ];
  for (let j = 1; j < profile.length; j++) {
    const [bottom, a, b] = profile[j - 1], [top, A, B] = profile[j];
    if (top <= bottom) continue;
    const low = ellipse(frame, 0, 0, a, b * across, 12), high = ellipse(frame, 0, 0, A, B * across, 12);
    for (let i = 0; i < low.length; i++) {
      const k = (i + 1) % low.length;
      batch.face([up(low[i], bottom), up(high[i], top), up(high[k], top), up(low[k], bottom)],
        j === 1 ? '#9caaa2' : '#a7b5b0', litSurface.paleStone);
    }
  }
  prism(batch, ellipse(frame, 0, 0, 1.24, 1.89 * across, 12), y - .21, y - .08, concrete, '#bac1b9');
  for (const side of [-1, 1]) {
    const d = side * .99 * across;
    prism(batch, rect(frame, 0, d, .78, .68), y - .075, underside + .024, '#505b57', '#737d75');
  }
  const [x, z] = frame(.63, .23);
  cylinder(batch, x, z, ground + .24, y - 1.1, .045, .045, '#869995', 6);
}

function bridgeLamp(batch, lamps, p, side) {
  const frame = alongFrame(p);
  const d = side * (p.half + .21), reach = side * 1.17;
  const [x,z] = frame(0, d), [lx,lz] = frame(0, d - reach);
  const base = p.y + (p.depth < 1.55 ? .15 : .84);
  cylinder(batch, x, z, base, base + .24, .13, .105, concrete, 8);
  cylinder(batch, x, z, base + .19, p.y + 5.02, .068, .050, '#849897', 8);
  prism(batch, rect(frame, 0, d - reach / 2, .09, 1.18), p.y + 4.94, p.y + 5.05, '#92a39e');
  prism(batch, rect(frame, 0, d - reach, .42, .51), p.y + 4.85, p.y + 5.06, '#b5c6bc', '#809692', litSurface.canopyLight);
  lamps.add(lx, p.y + 4.85, lz, '#fff0d8', 1.35);
}

function roadMesh(batch, geo, lamps, obstacles, link, rows, from, to) {
  const { path, detail } = link;
  const section = row => {
    const y = brtRoadHeight(geo, link, row.s), ground = groundY(geo, row.x, row.z);
    return { ...row, y, half: halfWidth(link, row.s), depth: Math.max(.52, Math.min(1.76, y - ground + .19)) };
  };
  const points = brtRows(path, rows, from, to).map(section);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const ring = [deckPoint(a, -a.half), deckPoint(a, a.half), deckPoint(b, b.half), deckPoint(b, -b.half)];
    batch.top(ring, asphalt, litSurface.streetAsphalt, .63, [[-a.half,a.s],[a.half,a.s],[b.half,b.s],[-b.half,b.s]]);
    girder(batch, a, b);
    const mid = (a.s + b.s) / 2;
    const atJunction = mid < 7.5 || (!link.turn && mid > path.length - 7.5);
    if (!link.oneWay && !atJunction && !(link.turn && mid > path.length - 8)) {
      for (const d of [-.109, .109]) paint(batch, a, b, d - .047, d + .047, d - .047, d + .047, '#e1ae53');
    }
    for (const side of [-1, 1]) {
      if (brtPlatformAt(link, side, mid) || atJunction) continue;
      const da = side * (a.half - .42), db = side * (b.half - .42);
      paint(batch, a, b, da, da + side * .093, db, db + side * .093, '#d1cfbc');
      parapet(batch, a, b, side, a.depth < 1.55);
    }
    obstacles.add(ring.map(([x, , z]) => [x, z]), Math.max(a.y, b.y) + .88);
  }
  const at = s => {
    const p = path.sample(s);
    return section({ ...p, s, rx: -p.uz, rz: p.ux });
  };
  for (let s = Math.ceil(Math.max(from, 8) / span) * span; s < Math.min(to, path.length - 10); s += span) {
    const p = at(s), ground = groundY(geo, p.x, p.z), frame = alongFrame(p);
    const inWucun = detail && s >= detail[0] && s <= detail[1];
    const overStreet = inWucun && wucunStreets.some(({ path, width }) => path.nearest(p.x, p.z).distance < width / 2 + .8);
    if (!overStreet && p.y - ground > 3.2) pier(batch, frame, ground, p.y - p.depth, link.oneWay);
    const bay = Math.round(s / span);
    if (bay % 2 === 0) {
      const side = bay % 4 ? 1 : -1;
      if (!brtPlatformAt(link, side, s)) bridgeLamp(batch, lamps, p, side);
      const a = at(s - .047), b = at(s + .047);
      paint(batch, a, b, -a.half + .31, a.half - .31, -b.half + .31, b.half - .31, '#666762');
    }
  }
}

function turnaround(batch, geo, lamps, obstacles, link) {
  const { path } = link;
  const y = brtRoadHeight(geo, link, path.length), radius = turnRadius + roadHalf - laneOffset;
  const last = path.sample(path.length), centre = [last.x, last.z];
  const elevated = y - groundY(geo, ...centre) > 3.2;
  const depth = elevated ? 1.76 : .54;
  const rows = Array.from({ length: 27 }, (_, i) => {
    const angle = Math.PI * i / 26, [x,z] = brtTurnPoint(link, angle, radius);
    return { x, y, z, depth, half: 0, rx: (x - centre[0]) / radius, rz: (z - centre[1]) / radius };
  });
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    batch.top([up(centre, y), deckPoint(a, 0), deckPoint(b, 0)], asphalt);
    const bottom = [[centre[0], y - depth, centre[1]], deckPoint(b, -.8, -depth), deckPoint(a, -.8, -depth)];
    batch.face(bottom, soffit);
    loft(batch, a, b, () => [[-.8,-depth], [.28,-.34,concrete], [.43,-.13,blue]]);
    parapet(batch, a, b, 1, !elevated);
    if (i % 7 === 0) lamps.add(...deckPoint(a, .25, .84), '#f4bc80', .70);
  }
  if (elevated) for (const i of [5, 13, 21]) {
    const p = rows[i], x = p.x - p.rx * 4.2, z = p.z - p.rz * 4.2;
    pier(batch, alongFrame({ x, z, ux: p.rz, uz: -p.rx }), groundY(geo, x, z), y - depth, true);
  }
  obstacles.add(rows.map(({x,z}) => [x,z]), y + .88);
}

function junction(parent, geo, material, links) {
  const centre = links[0][0].path.sample(links[0][1]);
  const y = brtRoadHeight(geo, ...links[0]) - .03;
  const boundary = links.flatMap(([link, s]) => {
    const inside = link.path.sample(s < 1 ? 4 : s - 4), half = halfWidth(link, s);
    return [offset(inside, -half), offset(inside, half)];
  }).sort((a, b) => Math.atan2(a[1] - centre.z, a[0] - centre.x) - Math.atan2(b[1] - centre.z, b[0] - centre.x));
  const batch = new MeshBatch();
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length];
    batch.top([[centre.x, y, centre.z], up(a, y), up(b, y)], asphalt);
  }
  batch.finish(parent, material, 'BRT · 高架合流');
}

export function buildBrtScenery(parent, geo, material, lamps, obstacles) {
  for (const link of Object.values(brtLinks)) {
    const { path } = link;
    const rows = path.sections(5.8);
    for (const stop of link.stops) for (const platform of stop.boarding) {
      for (const end of [-1, 1]) {
        const s = platform.centre + end * platform.length / 2;
        if (rows.some(row => Math.abs(row.s - s) < .012)) continue;
        const p = path.sample(s);
        rows.push({ ...p, s, rx: -p.uz, rz: p.ux });
      }
    }
    rows.sort((a,b) => a.s - b.s);
    for (let from = 0; from < path.length; from += 620) {
      const to = Math.min(path.length, from + 620), batch = new MeshBatch();
      roadMesh(batch, geo, lamps, obstacles, link, rows, from, to);
      if (link.turn && to === path.length) turnaround(batch, geo, lamps, obstacles, link);
      const mesh = batch.finish(parent, material, 'BRT · 箱梁与专用道');
      mesh.receiveShadow = mesh.castShadow = true;
    }
  }
  const { wharfIn, wharfOut, xiahe, qianpu, airport } = brtLinks;
  junction(parent, geo, material, [[xiahe, 0], [wharfIn, 0], [wharfOut, wharfOut.path.length]]);
  junction(parent, geo, material, [[wharfIn, wharfIn.path.length], [wharfOut, 0]]);
  junction(parent, geo, material, [[xiahe, xiahe.path.length], [qianpu, 0], [airport, 0]]);
  return buildBrtStations(parent, geo, material, lamps, obstacles, brtStops);
}
