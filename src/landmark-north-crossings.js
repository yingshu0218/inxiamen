import plan from './north-crossings-plan.json' with { type: 'json' };
import { bridgeRoute, framePoint, pathTube } from './landmark-haicang.js';
import { geoPoint, litSurface, mix, prism } from './scenery-mesh.js';

const clamp = (v) => Math.max(0, Math.min(1, v));
function profile(knots, d) {
  const i = knots.findIndex(([s]) => s >= d);
  if (i < 0) return knots.at(-1)[1];
  if (i === 0) return knots[0][1];
  const [a, low] = knots[i - 1], [b, high] = knots[i];
  const t = (d - a) / (b - a);
  return mix(low, high, t * t * (3 - 2 * t));
}

function makeRoad(points, height) {
  const line = points.map((p) => geoPoint(...p));
  const length = line.slice(1).reduce((d, p, i) => d + Math.hypot(p[0] - line[i][0], p[1] - line[i][1]), 0);
  return bridgeRoute(line, (t, p) => height(t * length, p.x, p.z, length));
}
const at = (road, d) => road.step(d / road.length);
const ground = (geo, [lon, lat]) => geo.heightAt(...geoPoint(lon, lat));
const regular = (start, end, spacing) =>
  Array.from({ length: Math.max(0, Math.ceil((end - start) / spacing)) }, (_, i) => start + i * spacing);

function band(batch, road, a, b, left, right, color, style = 0, seed = 0, u = [0, 1]) {
  // Bands share an edge. Lane markings are sampled in the surface shader.
  const points = [road.at(a, ...left(a)), road.at(a, ...right(a)), road.at(b, ...right(b)), road.at(b, ...left(b))];
  batch.top(points, color, style, seed, [[u[0], a.d], [u[1], a.d], [u[1], b.d], [u[0], b.d]]);
}

function fascia(batch, road, a, b, outer, inner, color, light) {
  const points = [road.at(a, ...outer(a)), road.at(b, ...outer(b)), road.at(b, ...inner(b)), road.at(a, ...inner(a))];
  batch.face(points, color, light ? litSurface.northFascia : 0, light, [[a.d, 1], [b.d, 1], [b.d, 0], [a.d, 0]]);
}

function barrier(batch, road, a, b, side, edge, height = .92, color = '#c4ccc7') {
  const base = (p) => [edge(p) - side * .56, 0];
  const crown = (p) => [edge(p) - side * .25, height];
  const cap = (p) => [edge(p) - side * .06, height];
  const outside = (p) => [edge(p), 0];
  band(batch, road, a, b, base, crown, color);
  band(batch, road, a, b, crown, cap, '#d4d9cc');
  band(batch, road, a, b, cap, outside, '#a4b6b5');
}

function buildDeck(batch, road, obstacles, options) {
  const { half, lanes, halves = [0], median = .54, depth, light = 0, edgeOpen, start = 0, end = road.length } = options;
  road.deckEdge = halves.length > 1 ? (d) => 2 * half(d) + median : half;
  if (end - start < .1) return;
  const count = Math.ceil((end - start) / 17);
  const samples = Array.from({ length: count + 1 }, (_, i) => {
    const d = mix(start, end, i / count);
    return { ...at(road, d), d, half: half(d), depth: depth(d) };
  });
  for (let i = 1; i <= count; i++) {
    const a = samples[i - 1], b = samples[i], d = (a.d + b.d) * .5;
    for (const side of halves) {
      const offset = (p) => side * (p.half + median);
      const left = (p) => offset(p) - p.half, right = (p) => offset(p) + p.half;
      const outside = (p) => [right(p), 0], inside = (p) => [left(p), 0];
      const leftPave = (p) => [left(p) + .56, 0], rightPave = (p) => [right(p) - .56, 0];
      if (options.paving) options.paving(batch, road, a, b);
      else band(batch, road, a, b, leftPave, rightPave, '#606b70', litSurface.northLanes, lanes, [0, lanes]);
      if (!edgeOpen?.(d, -1, side)) barrier(batch, road, a, b, -1, left);
      else band(batch, road, a, b, inside, leftPave, '#606b70');
      if (!edgeOpen?.(d, 1, side)) barrier(batch, road, a, b, 1, right);
      else band(batch, road, a, b, rightPave, outside, '#606b70');
      for (const flank of [-1, 1]) {
        const edge = flank < 0 ? left : right;
        const top = (p) => [edge(p), 0];
        const brow = (p) => [edge(p), -.62];
        const shoulder = (p) => [offset(p) + flank * p.half * (options.girderWidth ?? .59), -.86];
        const soffit = (p) => [shoulder(p)[0] - flank * .72, -p.depth];
        fascia(batch, road, a, b, top, brow, options.fascia ?? '#adbbba', light);
        fascia(batch, road, a, b, brow, shoulder, '#95a9ac', light);
        fascia(batch, road, a, b, shoulder, soffit, options.girder ?? '#82989e', 0);
        fascia(batch, road, a, b, soffit, (p) => [offset(p), -p.depth], '#75898e', 0);
      }
      if (obstacles) {
        const polygon = [road.at(a, left(a)), road.at(a, right(a)), road.at(b, right(b)), road.at(b, left(b))];
        obstacles.add(polygon.map(([x, , z]) => [x, z]), Math.max(a.h, b.h) + 1);
      }
    }
  }
}

function beamDeckPaving(batch, road, a, b, centralBus = false) {
  const left = (p) => [-p.half + .56, 0], right = (p) => [p.half - .56, 0];
  const inner = centralBus ? 4.95 : .58;
  const white = '#d2d5c8';
  for (const side of [-1, 1]) {
    const outside = side < 0 ? left : right;
    band(batch, road, a, b, outside, () => [side * (inner + .56), 0], '#5e666b',
      litSurface.northLanes, centralBus ? 3 : 4, [0, centralBus ? 3 : 4]);
    const edge = () => side * inner;
    barrier(batch, road, a, b, -side, edge, centralBus ? .82 : .72, white);
  }
  if (centralBus)
    band(batch, road, a, b, () => [-inner, 0], () => [inner, 0],
      '#626c70', litSurface.northLanes, 2, [0, 2]);
  else band(batch, road, a, b, () => [-inner, .05], () => [inner, .05], '#909b92');
}

function gaugeRing(n, across, y, length, width, bevel) {
  return [[-length + bevel, -width], [length - bevel, -width], [length, -width + bevel],
    [length, width - bevel], [length - bevel, width], [-length + bevel, width],
    [-length, width - bevel], [-length, -width + bevel]]
    .map(([l, w]) => framePoint(n, l, across + w, y));
}

function support(batch, n, across, sections, color) {
  let lower;
  for (const [level, length, width] of sections) {
    const ring = gaugeRing(n, across, level, length, width, Math.min(.48, width * .33, length * .33));
    if (lower) for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      batch.face([lower[i], lower[j], ring[j], ring[i]], color);
    }
    lower = ring;
  }
  batch.top(lower, color);
}

function dockPiers(batch, geo, road, stations, depth, options) {
  const { columns = [0], width, span, cap, flair = 0, footing = false, color = '#b1c2c5' } = options;
  for (const d of stations) {
    const n = at(road, d);
    for (const l of columns) {
      const [x, , z] = road.at(n, l);
      const bottom = Math.max(-3.0, geo.rawHeightAt(x, z) - .8);
      const top = n.h - depth(d) + .06;
      if (top < bottom + .4) continue;
      const flareStart = Math.max(bottom + .04, top - flair - .8);
      support(batch, n, l, [
        [bottom, span, width], [flareStart, span * .88, width * .86],
        [top - .18, span, cap], [top, span, cap],
      ], color);
      if (footing && bottom < -.5) support(batch, n, l, [
        [-2.15, span + 1.8, width + 2.4], [1.45, span + 1.8, width + 2.4], [1.66, span + 1.39, width + 2.01],
      ], '#8d9c96');
    }
  }
}

function lightsOnDeck(batch, road, lamps, options) {
  const { spacing = 45, sides, end = road.length, start = 18, color, lift = 7.2 } = options;
  for (const d of regular(start, end, spacing)) {
    const n = at(road, d);
    for (const side of sides) {
      const l = side.offset(d), inner = l - side.facing * 2.6;
      const top = [road.at(n, l, lift - .74), road.at(n, inner, lift)];
      pathTube(batch, [road.at(n, l, .56), ...top], (t) => mix(.142, .082, t), '#849497', 5);
      pathTube(batch, [top[1], road.at(n, inner - side.facing * .56, lift)], .16, '#cbd1c6', 5);
      lamps.add(...road.at(n, inner - side.facing * .31, lift - .19), color, 1.32);
    }
  }
}

function nearestAlong(road, x, z) {
  let best = Infinity, nearest = 0;
  function scan(start, end, step) {
    for (let d = start; d <= end; d += step) {
      const n = at(road, d);
      const sq = (n.x - x) ** 2 + (n.z - z) ** 2;
      if (sq < best) { best = sq; nearest = d; }
    }
  }
  scan(0, road.length, 22);
  scan(Math.max(0, nearest - 24), Math.min(road.length, nearest + 24), 1.5);
  return nearest;
}

function ramp(batch, geo, points, main, { width, groundEnd = .52, light, above = 0, paving }) {
  const [x, z] = geoPoint(...points[0]);
  const join = nearestAlong(main, x, z);
  const joinHeight = at(main, join).h;
  const end = ground(geo, points.at(-1)) + groundEnd;
  const way = makeRoad(points, (d, px, pz, length) => {
    const t = clamp(d / length);
    const h = mix(joinHeight, end, t * t * (3 - 2 * t)) + Math.sin(t * Math.PI) * above;
    return Math.max(h, geo.heightAt(px, pz) + .6);
  });
  const depth = () => 1.55;
  // The longitudinal strip within a merge is part of the main asphalt surface.
  // Starting beyond that overlap also keeps coincident girders out of the reflection.
  let start = 0;
  while (start < way.length - 10 && start < 420) {
    const n = at(way, start);
    const along = nearestAlong(main, n.x, n.z);
    const centre = at(main, along);
    const across = Math.abs((n.x - centre.x) * centre.rx + (n.z - centre.z) * centre.rz);
    if (across + width * .5 >= main.deckEdge(along) ||
      Math.hypot(centre.x - n.x, centre.z - n.z) > main.deckEdge(along)) break;
    start += 6;
  }
  buildDeck(batch, way, null, { half: () => width * .5, lanes: width >= 8 ? 2 : 1,
    depth, light, start, paving, edgeOpen: (d) => d < start + 44 || d > way.length - 14 });
  dockPiers(batch, geo, way, regular(start + 29, way.length - 10, 40), depth, { width: 1.17, span: 1.3, cap: 2.55, flair: .65 });
  return Object.assign(way, { streetClearance: Math.max(5.8, width * .68) });
}

const endLights = (half) => [-1, 1].map((side) => ({ offset: (d) => side * (half(d) - .32), facing: side }));
function traffic(road, name, offsets, streetClearance, approaches = []) {
  return Object.assign(road, { name, carOffsets: offsets, streetClearance, approaches });
}

export function buildXiangan(batch, geo, lamps, obstacles) {
  const points = plan.xiangan;
  const heights = [
    [0, ground(geo, points[0]) + .72], [590, 16.1], [1400, 20.8],
    [2065, 27.3], [2520, 27.6], [2977, 32.4], [3480, 29.2], [4132, 26.7],
    [4680, 18.5], [5400, 15.4], [6180, 19.4], [6900, 27], [8050, 32.2],
    [8700, 39.8], [9380, ground(geo, points.at(-1)) + .65],
  ];
  const road = makeRoad(points, (d, x, z) => Math.max(geo.heightAt(x, z) + 1.1, profile(heights, d)));
  const half = (d) => profile([[0, 15], [250, 18.5], [700, 20], [1600, 18.5], [2827, 18.5], [2977, 19.7],
    [3127, 18.5], [4570, 18.5], [5000, 21.5], [5880, 16.8], [6500, 15.3], [9230, 15.3]], d);
  // West, middle and east fairways. The middle unit is 2x90 + 2x150 + 2x90 m.
  const middlePiers = [2647, 2737, 2827, 2977, 3127, 3217, 3307];
  const channels = [[2015, 2115], [2827, 2977], [2977, 3127], [4082, 4182]];
  const depth = (d) => 2.65 + Math.max(...channels.map(([a, b], i) =>
    (i === 1 || i === 2 ? 4.25 : 2.8) * (1 - clamp(Math.min(Math.abs(d - a), Math.abs(d - b)) / 111)) ** 2));
  const piers = [73, 157, 248, ...regular(347, 1900, 105), ...channels[0],
    ...regular(2220, 2630, 108), ...middlePiers, ...regular(3414, 3990, 107), ...channels.at(-1), ...regular(4279, 5180, 98),
    ...regular(5194, 6200, 63), ...regular(6214, road.length - 39, 54)].sort((a, b) => a - b);
  buildDeck(batch, road, obstacles, { half, lanes: 4, depth, light: 1, fascia: '#a3bec4', girder: '#779fa8',
    girderWidth: .62, paving: beamDeckPaving, edgeOpen: (d) => d < 125 || d > road.length - 70 ||
      (d > 610 && d < 1370) || (d > 5040 && d < 5740) || (d > 6000 && d < 6490) });
  dockPiers(batch, geo, road, piers, depth, { width: 3.75, span: 2.34, cap: 10.7, flair: 3.8, footing: true, color: '#bccacd' });
  for (const [a, b] of [channels[0], [2827, 3127], channels.at(-1)]) for (const [d, color] of [[a, '#fda87a'], [b, '#a7f3cc']]) {
    const n = at(road, d);
    for (const worldSide of [-1, 1]) lamps.add(...road.at(n, worldSide * 3.9, -n.h + 5.0), color, .9);
  }
  lightsOnDeck(batch, road, lamps, { sides: endLights(half), spacing: 51, color: '#ffebcc', lift: 8.75 });
  const approaches = plan.xianganRamps.map((line, i) => ramp(batch, geo, line, road,
    { width: i === 1 ? 9.3 : 7.5, above: i === 1 ? 4.8 : i >= 3 && i <= 6 ? 3.0 : 1.0, light: 1 }));
  approaches.push(ramp(batch, geo, plan.xianganAirportBranch, approaches[1], { width: 7.4, light: 1, above: 2.2 }));
  return [traffic(road, '翔安大桥车流', [2.65, 6.45, 10.2, 13.9], 23, approaches)];
}

export function buildJimei(batch, geo, lamps, obstacles) {
  const points = plan.jimei;
  const heights = [
    [0, ground(geo, points[0]) + .78], [270, 12.4], [800, 14.7],
    [1620, 18.9], [2280, 21.3], [2920, 18.5], [3540, 15.8],
    [4020, 13.4], [4355, ground(geo, points.at(-1)) + .50],
  ];
  const road = makeRoad(points, (d) => profile(heights, d));
  const half = (d) => profile([[0, 16.9], [220, 18.2], [340, 20.15], [760, 20.15], [920, 18], [3980, 18], [4330, 16.6]], d);
  const depth = () => 2.42;
  buildDeck(batch, road, obstacles, { half, lanes: 3, depth, light: 2,
    paving: (b, r, a, c) => beamDeckPaving(b, r, a, c, true),
    edgeOpen: (d, side) => (side > 0 && d > 320 && d < 890) || d < 22 || d > road.length - 25 });
  dockPiers(batch, geo, road, regular(211, 4225, 55), depth,
    { columns: [-8.5, 8.5], width: 2.32, span: 1.86, cap: 3.43, flair: .48, color: '#adbdbd' });
  lightsOnDeck(batch, road, lamps, { sides: endLights(half), spacing: 47, color: '#ffd69d', lift: 8.15 });
  const approaches = plan.jimeiRamps.map((line, i) => ramp(batch, geo, line, road,
    { width: i === 0 ? 9.6 : 6.8, above: i === 3 ? 2.4 : 0, light: 2 }));
  approaches.push(ramp(batch, geo, plan.jimeiApproach, road, {
    width: 33.8, paving: (b, r, a, c) => beamDeckPaving(b, r, a, c, true),
  }));
  return [Object.assign(traffic(road, '集美大桥车流', [7.1, 10.6, 14.11], 22, approaches), { brt: true })];
}

export function buildXiamenBridge(batch, geo, lamps, obstacles) {
  const points = plan.xiamenBridge;
  const heights = [
    [0, ground(geo, points[0]) + .56], [340, 10.2], [900, 13.7], [1210, 14.1],
    [1790, 11.7], [2220, 10.9], [2550, 10.4],
  ];
  const road = makeRoad(points, (d) => profile(heights, d));
  const half = (d) => profile([[0, 5.6], [170, 5.86], [2250, 5.86], [2470, 6.9], [2600, 7.35]], d);
  const depth = () => 1.83;
  buildDeck(batch, road, obstacles, { half, lanes: 3, halves: [-1, 1], median: .24, depth,
    light: 3, fascia: '#b1b9b0', girderWidth: .71,
    edgeOpen: (d) => d < 16 || d > road.length - 22 });
  const piers = [53, ...Array.from({ length: 47 }, (_, i) => 94 + 45 * i), ...regular(2210, road.length - 15, 36)];
  dockPiers(batch, geo, road, piers, depth,
    { columns: [-6.1, 6.1], width: 2.26, span: 1.10, cap: 3.05, flair: .24, color: '#a7b1ae' });
  lightsOnDeck(batch, road, lamps, { sides: endLights((d) => half(d) * 2 + .24), spacing: 48, color: '#ffe2ac', lift: 7.6 });
  const approaches = plan.xiamenRamps.map((line, i) => ramp(batch, geo, line, road,
    { width: i === 0 ? 8.8 : 7, above: i === 0 ? 4.25 : 1.55, light: 3 }));
  return [traffic(road, '厦门大桥车流', [2.65, 6.1, 9.65], 17, approaches)];
}

// Distances along 海堤路 from Gaoqi toward Jimei. Solid portions fill the
// spaces between the two openings in the existing ocean mask.
const gaoqiCut = [150, 1000], jimeiCut = [1370, 1580];

function revetment(batch, geo, road, start, end, metro, width) {
  const sections = Math.ceil((end - start) / 13);
  // The railway is on the west side. The old bank extends under both routes.
  function section(d) {
    const n = at(road, d), shoulder = width(d);
    const west = at(metro, nearestAlong(metro, n.x, n.z));
    const offset = (west.x - n.x) * n.rx + (west.z - n.z) * n.rz;
    const bank = Math.max(3.8, Math.min(n.h - .35, geo.heightAt(n.x, n.z) + .52));
    return [
      road.at(n, offset - 9.8 - shoulder, -n.h - .82),
      road.at(n, offset - 6.4 - shoulder, .56 - n.h),
      road.at(n, offset - 2.5 - shoulder, bank - n.h - .63),
      road.at(n, -8.8, bank - n.h),
      road.at(n, 8.8, bank - n.h),
      road.at(n, 10.2 + shoulder, bank - n.h - .55),
      road.at(n, 13.9 + shoulder, .66 - n.h),
      road.at(n, 17.4 + shoulder, -n.h - .85),
    ];
  }
  let prev = section(start);
  batch.face(prev, '#839289', litSurface.seaWall);
  for (let i = 1; i <= sections; i++) {
    const next = section(mix(start, end, i / sections));
    for (let edge = 1; edge < next.length; edge++) {
      const grass = edge === 3 || edge === 4 || edge === 5;
      const vertices = [prev[edge - 1], next[edge - 1], next[edge], prev[edge]];
      if (grass) batch.top(vertices, edge === 4 ? '#737c60' : '#85936a');
      else batch.face(vertices, '#a7aa99', litSurface.seaWall);
    }
    prev = next;
  }
  batch.face(prev.toReversed(), '#839289', litSurface.seaWall);
}

function metroPaving(batch, road, a, b) {
  band(batch, road, a, b, () => [-4.88, 0], () => [4.88, 0], '#746c60', litSurface.northRail, 0, [-4.88, 4.88]);
}

function causewayPaving(batch, road, a, b) {
  // The flat paving on the east shoulder is the pedestrian and cycle path.
  band(batch, road, a, b, () => [-7.94, 0], () => [2.56, 0], '#666d70', litSurface.northLanes, 2, [0, 2]);
  band(batch, road, a, b, () => [2.56, 0], () => [2.89, .12], '#c4cbbd');
  band(batch, road, a, b, () => [2.89, .12], () => [7.94, 0], '#9d8b72');
}

function metroStation(batch, geo, metro, obstacles) {
  const outline = plan.jimeiMetroStation.map((p) => geoPoint(...p));
  const start = metro.length - 128, end = metro.length;
  const middle = at(metro, (start + end) * .5);
  const footprint = (from, to, left, right) => {
    const a = at(metro, from), b = at(metro, to);
    return [metro.at(a, left), metro.at(b, left), metro.at(b, right), metro.at(a, right)]
      .map(([x, , z]) => [x, z]);
  };
  // The rail deck passes between the open ends of the red-roofed elevated station.
  const sill = Math.min(geo.heightAt(middle.x, middle.z), middle.h - 2.8) - .63;
  const lowerRoof = middle.h - 1.35, eave = middle.h + 5.85;
  prism(batch, outline, sill, lowerRoof, '#ad8d76', '#c5b9a1', 3, .36);
  prism(batch, footprint(start, end, -7.15, 7.6), eave - .47, eave,
    '#c1a58d', '#9b5540', 0, .47, 3.0, litSurface.pantile);
  for (const side of [-1, 1]) {
    const x = side * 6.38;
    for (const d of regular(start + 3, end - 1, 9.4)) {
      const n = at(metro, d);
      support(batch, n, x, [[lowerRoof, .43, .47], [eave - .43, .37, .40]], '#ac7362');
    }
    const sideWall = footprint(start + 12, end - 11, x - .28, x + .28);
    prism(batch, sideWall, middle.h + .29, middle.h + 1.60, '#b8886c', '#d1bc9f');
  }
  obstacles.add(outline, eave + 3);
}

export function buildGaoji(batch, geo, lamps, obstacles) {
  const points = plan.gaojiRoad, railPoints = plan.gaojiMetro;
  const heights = [
    [0, ground(geo, points[0]) + .46], [150, 6.1], [352, 10.2], [641, 15.2],
    [810, 12.1], [1000, 5.5], [1270, 5.3], [1370, 6.5], [1465, 8.3],
    [1580, 6.1], [1820, 6.2], [2070, ground(geo, points.at(-1)) + .46],
  ];
  const railHeights = [
    [0, ground(geo, railPoints[0]) - .05], [170, 8.2], [350, 11], [785, 15.8],
    [952, 14.8], [1190, 9], [1400, 8], [1560, 9],
    [1780, 10.4], [2100, 10.6], [2320, ground(geo, railPoints.at(-1)) + 2.75],
  ];
  const road = makeRoad(points, (d) => profile(heights, d));
  const metro = makeRoad(railPoints, (d) => profile(railHeights, d));
  const half = () => 8.5;
  const depth = (d) => d > gaoqiCut[0] && d < gaoqiCut[1]
    ? 2.15 + 1.72 * (1 - clamp(Math.abs(Math.abs(d - 615) - 60) / 70)) ** 2 : 1.64;
  buildDeck(batch, road, obstacles, { half, lanes: 2, depth, light: 3, paving: causewayPaving,
    edgeOpen: (d) => d < 20 || d > road.length - 19 });
  const gaoqiPiers = [...regular(176, 520, 43), 555, 675, ...regular(732, 993, 45)];
  dockPiers(batch, geo, road, [...gaoqiPiers, ...regular(1394, 1580, 39)], depth,
    { columns: [-3.8, 3.1], width: 1.5, span: 1.42, cap: 2.23, flair: .7 });
  const railDepth = () => 1.88;
  buildDeck(batch, metro, obstacles, { half: () => 5.44, lanes: 1, depth: railDepth,
    light: 4, paving: metroPaving, girderWidth: .68 });
  dockPiers(batch, geo, metro, regular(79, metro.length - 21, 34), railDepth,
    { width: 1.65, span: 1.34, cap: 3.45, flair: 1.8, color: '#a6b3af' });
  metroStation(batch, geo, metro, obstacles);
  revetment(batch, geo, road, 49, gaoqiCut[0], metro, () => 2.5);
  revetment(batch, geo, road, gaoqiCut[1], jimeiCut[0], metro, (d) =>
    profile([[1000, 2.6], [1038, 12.5], [1150, 4.5], [1280, 6.2], [1368, 1.8]], d));
  revetment(batch, geo, road, jimeiCut[1], 1700, metro, () => 3);
  lightsOnDeck(batch, road, lamps, { sides: [{ offset: () => 2.73, facing: -1 }], spacing: 53,
    color: '#ffdeb0', lift: 5.65, start: 38, end: road.length - 23 });
  metro.streetClearance = 11;
  return [Object.assign(traffic(road, '海堤路车流', [1.45], 7.4), { metro, carCenter: -2.7 })];
}
