import plan from './brt-plan.json' with { type: 'json' };
import { alongFrame, measuredPath } from './old-town-layout.js';
import { brt as wucunPath, brtStop as wucunStop } from './wucun-layout.js';
import { groundY, inRing, mix } from './scenery-mesh.js';
import { localFrame, rect } from './landmark-forms.js';

const clamp = (v, low, high) => Math.min(high, Math.max(low, v));
const smooth = (t) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
export const brtDeck = 10.15;
export const laneOffset = 1.92;
export const roadHalf = 4.15;
export const turnRadius = 11.4;

export const brtLinks = Object.fromEntries(Object.entries(plan.links).map(([id, points]) => {
  const surveyed = measuredPath(points);
  const end = surveyed.sample(surveyed.length);
  // The game needs room beyond the last platform for its short turning apron.
  const alignment = id === 'qianpu' ? [...points, alongFrame(end)(22, 0)] : points;
  const path = alignment === points ? surveyed : measuredPath(alignment);
  const oneWay = id === 'wharfIn' || id === 'wharfOut';
  return [id, { id, points, path, oneWay, turn: id === 'qianpu' || id === 'airport', stops: [] }];
}));
const { xiahe, airport } = brtLinks;
const atXiahe = (p) => xiahe.path.nearest(p.x, p.z).s;
xiahe.detail = [atXiahe(wucunPath.sample(0)), atXiahe(wucunPath.sample(wucunPath.length))];
const rampBottom = airport.path.nearest(...plan.airportRamp).s;
const rampTop = rampBottom - 235;

export function brtClearance(link, s) {
  return link === airport ? mix(brtDeck, .48, smooth((s - rampTop) / (rampBottom - rampTop))) : brtDeck;
}

export function brtRoadHeight(geo, link, s) {
  const p = link.path.sample(s);
  const centre = groundY(geo, p.x, p.z);
  if (link.detail && s >= link.detail[0] - .02 && s <= link.detail[1] + .02) return centre + brtDeck;
  const a = link.path.sample(s - 17), b = link.path.sample(s + 17);
  const adjacent = (groundY(geo, a.x, a.z) + groundY(geo, b.x, b.z)) / 2;
  const clearance = brtClearance(link, s);
  const seam = smooth(Math.min(s, link.path.length - s) / 17);
  const detail = link.detail ? smooth(Math.min(...link.detail.map(d => Math.abs(s - d))) / 29) : 1;
  // Keep the ramp above the local street while smoothing short terrain bumps on the viaduct.
  return centre + clearance + clamp((adjacent - centre) * .42, -.55, .85) * smooth((clearance - .48) / 3) * seam * detail;
}

export function brtLaneWidth(link, s) {
  return link.turn ? mix(laneOffset, turnRadius, smooth((s - link.path.length + 36) / 36)) : laneOffset;
}

export function brtTurnPoint(link, angle, radius = turnRadius) {
  const end = link.path.sample(link.path.length);
  return alongFrame(end)(radius * Math.sin(angle), radius * Math.cos(angle));
}

const defaultLengths = { wharf: 66, wenzao: 72, qianpu: 43, gaoqi: 72 };
const stationForms = {
  wharf: 'terminal', wenzao: 'transfer', caitang: 'transfer', railway: 'railway',
  qianpu: 'terminal', gaoqi: 'airport', t4: 'ground',
};
// Outer edges of the game streets at the station approaches, indexed by platform side.
const streetEdges = {
  kaihe:[18,17.4], sibei:[18.2,18.9], douxi:[17.7,17.7], ershi:[19.3,20.4],
  wenzao:[17.2,19.6], jinbang:[12.5,20.2], lianban:[22.8,19.4], longshan:[17.2,20.1],
  wolong:[13,24.8], dongfang:[31.5,0], hongwen:[13.4,17.9], qianpu:[28.7,10.4],
  caitang:[10.8,21.3], jinshan:[27.7,0], service:[16.8,20.7], shuangshi:[14,18.6], xianhou:[16.5,16.3],
};
export const brtStops = plan.stops.map(({ id, name, link: key, point, platforms }) => {
  const link = brtLinks[key];
  const { path } = link;
  let s = path.nearest(...point).s;
  if (id === 'railway') s = atXiahe(wucunPath.sample(wucunStop));
  const boarding = (link.oneWay ? [1] : [-1, 1]).map(side => {
    const survey = platforms.map(ring => {
      const rows = ring.map(([x, z]) => path.nearest(x, z));
      const along = rows.map(row => row.s), across = rows.map(row => row.side);
      return {
        start: Math.min(...along), end: Math.max(...along),
        across: across.reduce((sum, d) => sum + d, 0) / across.length,
        width: Math.max(...across) - Math.min(...across),
      };
    }).find(p => Math.sign(p.across) === side);
    const measured = survey && !defaultLengths[id] && id !== 'railway';
    const centre = measured ? (survey.start + survey.end) / 2 : s;
    const length = measured ? clamp(survey.end - survey.start, 45, 85) : defaultLengths[id] ?? 68;
    const inner = link.oneWay ? 2.24 : 3.42;
    const width = measured ? clamp(survey.width, 3.7, 5.2) : id === 'gaoqi' || id === 'wharf' ? 6.1 : 4.8;
    const access = id !== 't4';
    return { side, centre, length, inner, outer: inner + width, access };
  });
  const stop = { id, name, link, s, boarding, form: stationForms[id] ?? 'classic' };
  link.stops.push(stop);
  return stop;
});

export function brtPlatformAt(link, side, s) {
  return link.stops.some(stop => stop.boarding.some(platform =>
    platform.side === side && Math.abs(s - platform.centre) < platform.length / 2));
}

export const brtEntranceStation = ({ centre, side, length }) => centre + side * (length / 2 - 2.8);

export function brtStairLateral(stop, platform) {
  const edge = streetEdges[stop.id]?.[platform.side < 0 ? 0 : 1] ?? 0;
  return Math.max(platform.outer + 8.7, edge + 2.52);
}

export function brtConcourse(stop) {
  if (stop.id === 'wharf') {
    return { frame: localFrame([-5885, 1736]), u: 0, v: 0, width: 54, depth: 23 };
  }
  if (stop.id === 'gaoqi') {
    const p = stop.link.path.sample(stop.s);
    return { frame: alongFrame(p), u: -9, v: 20.6, width: 65, depth: 20.6 };
  }
}

// Insert exact endpoints so pavements, station edges and both approaches meet at the same level.
export function brtRows(path, rows, from, to) {
  const edge = (s) => {
    const p = path.sample(s);
    return { ...p, rx: -p.uz, rz: p.ux, s };
  };
  return [edge(from), ...rows.filter(row => row.s > from + .01 && row.s < to - .01), edge(to)];
}

const gridSize = 75;
const gridKey = (x, z) => Math.floor(x / gridSize) * 2048 + Math.floor(z / gridSize);
function nearGrid(grid, x, z, radius, value) {
  for (let i = Math.floor((x - radius) / gridSize); i <= Math.floor((x + radius) / gridSize); i++) {
    for (let j = Math.floor((z - radius) / gridSize); j <= Math.floor((z + radius) / gridSize); j++) {
      const key = i * 2048 + j;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(value);
    }
  }
}

const alignments = new Map(), stationLots = new Map();
for (const link of Object.values(brtLinks)) {
  for (const row of link.path.sections(8)) {
    const p = link.path.sample(row.s);
    const ramp = brtClearance(link, row.s) < 3.5;
    const radius = link.oneWay ? 3.2 : 5.5;
    nearGrid(alignments, p.x, p.z, radius + 4, { ...p, radius, ramp });
  }
  if (link.turn) {
    const end = link.path.sample(link.path.length);
    const ring = rect(alongFrame(end), -3, 0, 32, (turnRadius + 2.4) * 2);
    nearGrid(stationLots, end.x, end.z, 25, ring);
  }
}
for (const stop of brtStops) {
  if (stop.id === 'railway') continue;
  const hall = brtConcourse(stop);
  if (hall) {
    const { frame, u, v, width, depth } = hall;
    const [x, z] = frame(u, v);
    const envelope = rect(frame, u, v, width + 34, depth + 16);
    nearGrid(stationLots, x, z, 69, envelope);
  }
  for (const p of stop.boarding) {
    const origin = stop.link.path.sample(p.centre), at = alongFrame(origin);
    const platform = rect(at, 0, p.side * (p.inner + p.outer) / 2, p.length + 1, p.outer - p.inner + 1.4);
    nearGrid(stationLots, origin.x, origin.z, p.length / 2 + 16, platform);
    if (p.access) {
      const lateral = brtStairLateral(stop,p);
      if (stop.form === 'transfer') {
        const anchor = stop.link.path.sample(stop.s), frame = alongFrame(anchor);
        const access = rect(frame, 0, p.side * lateral, 58, 6.4);
        nearGrid(stationLots, anchor.x, anchor.z, lateral+31, access);
        continue;
      }
      const end = stop.link.path.sample(brtEntranceStation(p)), foot = alongFrame(end);
      const walk = rect(foot, 0, p.side * (p.outer + lateral) / 2, 5.3, lateral-p.outer+3.5);
      const stair = rect(foot, p.side * 13.8, p.side * lateral, 29.8, 6);
      nearGrid(stationLots, end.x, end.z, lateral+21, walk);
      nearGrid(stationLots, end.x, end.z, lateral+30, stair);
    }
  }
}

export function replacesBrtRoad(x, z, dx, dz, bridge, kind) {
  return alignments.get(gridKey(x, z))?.some(p => {
    if (!bridge && !(p.ramp && kind === 0)) return false;
    const along = (x - p.x) * p.ux + (z - p.z) * p.uz;
    const side = (z - p.z) * p.ux - (x - p.x) * p.uz;
    return Math.abs(along) < 6 && Math.abs(side) < p.radius && Math.abs(dx * p.ux + dz * p.uz) > .94;
  });
}

export function brtReserved(x, z) {
  return stationLots.get(gridKey(x, z))?.some(ring => inRing(x, z, ring));
}

const viewAngles = {
  wharf: [46, -108, 65], sibei: [-74, 16, 45], wenzao: [-74, 16, 39], railway: [-68, 24, 35],
  qianpu: [65, 45, 36], jinshan: [65, 21, 53], gaoqi: [-83, -57, 60], t4: [-54, 35, 29],
};
export const brtViews = brtStops.map(({ id, name, link, s }) => {
  const p = link.path.sample(s), frame = alongFrame(p);
  const [along, across, height] = viewAngles[id] ?? [-66, 26, 34];
  const [x, z] = frame(along, across);
  const [px, pz] = frame(along * 1.05, across * (id === 'wharf' ? .78 : .62));
  return {
    id: 'brt-' + id, name, x: p.x, z: p.z, groundRelative: true,
    focusHeight: brtClearance(link, s) + 1.5, fov: 55, portraitFovBoost: 15,
    view: { x, y: height, z }, portraitView: { x: px, y: height + 6, z: pz },
  };
});
export const brtChartLines = Object.values(brtLinks).map(({ points }) => points);

const wenzao = brtStops.find(stop => stop.id === 'wenzao');
const wenzaoPoint = wenzao.link.path.sample(wenzao.s);
const wenzaoFrame = alongFrame(wenzaoPoint);
export const brtDetailViews = [
  { id:'brt-viaduct', name:'文灶 · 高架桥下', camera:[-57,17.8,4.7], focusHeight:7.0, fov:60 },
  { id:'brt-platform', name:'文灶 · 站台近景', camera:[14.6,6.65,12.47], focusHeight:11.7, fov:67 },
].map(({camera:[along,across,y],...entry}) => {
  const [x,z] = wenzaoFrame(along,across);
  return {...entry,x:wenzaoPoint.x,z:wenzaoPoint.z,groundRelative:true,view:{x,y,z}};
});
