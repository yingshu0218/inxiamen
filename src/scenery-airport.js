import { ShapeUtils, Vector2 } from 'three';
import { MeshBatch, cylinder, inRing, litSurface, mix, randomSource, TAU } from './scenery-mesh.js';
import { airportFrame, arrivalStandLine, sampleTaxiRoute, taxiRoutes } from './airport-layout.js';
import { buildAirportBuildings } from './airport-buildings.js';
import { buildAirportForecourts } from './airport-forecourt.js';
import { buildAirportIndustry } from './airport-industry.js';
import pavement from './airport-pavement.json' with { type: 'json' };

const white = '#e7e4d8', yellow = '#e7b94d', concrete = '#ada691';
const movementPolygons = [...pavement.apron, ...pavement.asphalt, ...pavement.concrete];
const segments = {
  a: [[-2.6, 8.6], [2.6, 8.6], [3.4, 7.8], [2.5, 7], [-2.5, 7], [-3.4, 7.8]],
  g: [[-2.5, .82], [2.5, .82], [3.3, 0], [2.5, -.82], [-2.5, -.82], [-3.3, 0]],
  d: [[-2.5, -7], [2.5, -7], [3.4, -7.8], [2.6, -8.6], [-2.6, -8.6], [-3.4, -7.8]],
  b: [[3.4, 7.7], [3.4, 1], [2.6, .1], [1.8, 1], [1.8, 6.9]],
  c: [[3.4, -1], [3.4, -7.7], [1.8, -6.9], [1.8, -1], [2.6, -.1]],
};
segments.f = segments.b.map(([x, y]) => [-x, y]);
segments.e = segments.c.map(([x, y]) => [-x, y]);
const digits = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgcde', 'abc', 'abcdefg', 'abfgcd'];

function alongPath(path, step, sample) {
  let walked = 0, next = step * .5;
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (next < walked + length) {
      const t = (next - walked) / length;
      sample(mix(a[0], b[0], t), mix(a[1], b[1], t), (b[0] - a[0]) / length, (b[1] - a[1]) / length);
      next += step;
    }
    walked += length;
  }
}

function nearestOnPath(path, s, r) {
  let point, distance = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], ds = b[0] - a[0], dr = b[1] - a[1];
    const fraction = Math.max(0, Math.min(1, ((s - a[0]) * ds + (r - a[1]) * dr) / (ds * ds + dr * dr)));
    const x = mix(a[0], b[0], fraction), z = mix(a[1], b[1], fraction);
    const gap = (x - s) ** 2 + (z - r) ** 2;
    if (gap < distance) {
      distance = gap;
      point = [x, z, Math.atan2(dr, ds)];
    }
  }
  return point;
}

function pavedAt(s, r) {
  return movementPolygons.some(([edge, ...holes]) =>
    inRing(s, r, edge) && !holes.some(hole => inRing(s, r, hole)));
}

export function buildAirport(parent, geo, runway, material, lamps, obstacles) {
  const ground = new MeshBatch(), structures = new MeshBatch();
  const frame = airportFrame(runway), { world, len } = frame;
  const base = runway.elevation, deck = runway.surfaceHeight, half = runway.width / 2;
  const apron = base + .15, taxi = base + .22, paint = deck + .048;
  const runwayEnd = len - 60;
  const at = (s, r, y) => {
    const [x, z] = world(s, r);
    return [x, y, z];
  };
  const terrain = (s, r) => geo.heightAt(...world(s, r));
  const light = (s, r, y, tint, radius) => lamps.add(...at(s, r, y), tint, radius);
  const column = (s, r, bottom, top, rb, rt, color, sides = 8) =>
    cylinder(structures, ...world(s, r), bottom, top, rb, rt, color, sides);
  function tile(points, y, color, style = 0, seed = 0) {
    ground.top(points.map(([s, r]) => at(s, r, y)), color, style, seed, points.map(([s, r]) => [r, s]));
  }
  function surface(polygons, y, color, style, seed = 0) {
    for (const polygon of polygons) {
      const [edge, ...holes] = polygon.map(ring => ring.map(point => new Vector2(...point)));
      const points = polygon.flat();
      for (const triangle of ShapeUtils.triangulateShape(edge, holes)) {
        tile(triangle.map(i => points[i]), y, color, style, seed);
      }
    }
  }
  function rect(s, r, length, width, y, color, style = 0, seed = 0) {
    const a = s - length / 2, b = s + length / 2, l = r - width / 2, h = r + width / 2;
    tile([[a, l], [a, h], [b, h], [b, l]], y, color, style, seed);
  }
  function stroke(path, width, y, color) {
    const pairs = path.map(([s, r], i) => {
      const prev = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
      const ds = next[0] - prev[0], dr = next[1] - prev[1], l = Math.hypot(ds, dr);
      return [-width / 2, width / 2].map(offset => [s - dr * offset / l, r + ds * offset / l]);
    });
    for (let i = 1; i < pairs.length; i++) {
      tile([pairs[i - 1][0], pairs[i][0], pairs[i][1], pairs[i - 1][1]], y, color);
    }
  }
  function number(value, s, r, height, heading, y, color) {
    const co = Math.cos(heading), si = Math.sin(heading), scale = height / 17.2;
    // The shape's vertical axis points away from the approach and its horizontal axis points right.
    const items = String(value).split('');
    items.forEach((digit, i) => {
      const offset = 9.1 * (i - (items.length - 1) / 2);
      for (const section of digit === '-' ? 'g' : digits[Number(digit)]) {
        const points = segments[section].map(([x, v]) => {
          const u = (x + offset) * scale, t = v * scale;
          return [s + co * t - si * u, r + si * t + co * u];
        });
        tile(points, y, color);
      }
    });
  }

  surface(pavement.turf, base + .045, '#767454', litSurface.airportTurf);
  surface(pavement.shoulder, base + .103, '#777466', 7);
  surface(pavement.asphalt, taxi, '#575953', 7);
  surface(pavement.concrete, taxi, concrete, litSurface.airportConcrete, .17);
  surface(pavement.apron, apron, concrete, litSurface.airportConcrete, .17);
  rect(runwayEnd / 2, 0, runwayEnd, runway.width, deck, '#44494a', 7, 1);
  rect((runwayEnd + len) / 2, 0, len - runwayEnd, runway.width, deck, '#53574f', 7);
  for (const offset of [13, 37]) {
    const start = runwayEnd + offset;
    stroke([[start + 15,-half + 3.2], [start,0], [start + 15,half - 3.2]], 1.18, paint, '#c6a254');
  }

  const threshold05 = runway.threshold05Offset, threshold23 = runwayEnd - 200;
  const centerStart = threshold05 + 122, centerEnd = threshold23 - 120;
  for (let s = centerStart; s <= centerEnd; s += 60) rect(s, 0, 30.5, .92, paint, white);
  for (const side of [-1, 1]) {
    rect(runwayEnd / 2, side * (half - 1), runwayEnd - 8, .62, paint, white);
  }
  for (const [threshold, direction] of [[threshold05, 1], [threshold23, -1]]) {
    const station = offset => threshold + offset * direction;
    rect(threshold, 0, 1.7, runway.width - 2.6, paint, white);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) rect(station(22), side * (2.05 + i * 3.13), 30, 1.78, paint, white);
      rect(station(388), side * (half - 9.6), 45, 6.2, paint, white);
      for (const [distance, count] of [[154, 3], [296, 2], [546, 2], [690, 1]]) {
        for (let i = 0; i < count; i++) rect(station(distance), side * (half - 3 - 2.92 * i), 19, 1.36, paint, white);
      }
    }
    number(direction === 1 ? '05' : '23', station(65), 0, 15, direction === 1 ? 0 : Math.PI, paint, white);
    const displacement = direction === 1 ? threshold : runwayEnd - threshold;
    for (let distance = 29; distance < displacement - 27; distance += 51) {
      const s = station(-distance);
      rect(s - direction * 7, 0, 16, .81, paint, white);
      tile([[s + direction * 6, 0], [s - direction * 4, -2.8], [s - direction * 2, 0],
        [s - direction * 4, 2.8]], paint, white);
    }
    for (let r = -20; r <= 20; r += 4) {
      light(threshold, r, deck + .10, '#8df5b0', 1.85);
      light(direction === 1 ? runwayEnd - 2 : 2, r, deck + .15, '#ff5139', 1.65);
      rect(threshold, r, .25, .30, paint + .016, '#94ad9f');
    }
    for (let i = 0; i < 4; i++) {
      const s = station(337), r = direction === 1 ? -57 - i * 5.1 : 57 + i * 5.1;
      rect(s, r, 2.3, 1.65, base + .11, '#8c8c7f', litSurface.airportConcrete);
      column(s, r, base + .09, base + .91, .26, .22, '#aaa99c', 6);
      light(s, r, base + .85, i < 2 ? '#ff6553' : '#fff1dc', 2);
    }
    for (let i = 0; i < 9; i++) {
      const s = direction === 1 ? -14 - i * 28 : len + 15 + i * 28;
      const arms = i === 3 ? [-13, -8, -4, 0, 4, 8, 13] : [-1, 1];
      for (const r of arms) {
        const y = Math.max(terrain(s, r) + .8, base + .62);
        column(s, r, terrain(s, r), y, .14, .10, '#a47357', 5);
        light(s, r, y, '#fff0d4', 2.1);
      }
    }
  }
  for (let s = 17; s < runwayEnd - 10; s += 47) {
    for (const side of [-1, 1]) {
      const r = side * (half + 1.7);
      column(s, r, base + .16, base + .51, .115, .09, '#c4b89e', 6);
      const color = s < threshold05 || s > threshold23 ? '#ffd18d' : '#fff1db';
      light(s, r, base + .52, color, 1.85);
    }
  }
  for (let s = threshold05 + 10; s < threshold23; s += 29) {
    const color = s > threshold23 - 290 || s < threshold05 + 290 ? '#ffd7b5' : '#fff4dc';
    light(s, 0, deck + .08, color, 1.05);
  }
  for (const route of taxiRoutes) {
    const { width, primary, holdAt } = route, { path } = sampleTaxiRoute(route);
    stroke(path, .32, taxi + .026, yellow);
    alongPath(path, primary ? 28 : 25, (s, r, ds, dr) => {
      if (r < half + 12) return;
      light(s, r, taxi + .065, '#72e9b5', .95);
      if (primary) {
        for (const sign of [-1, 1]) {
          const d = sign * (width / 2 + .9);
          const edgeS = s - dr * d, edgeR = r + ds * d;
          if (!pavedAt(edgeS, edgeR)) light(edgeS, edgeR, taxi + .15, '#6ba2ff', 1.4);
        }
      }
    });
    if (!holdAt) continue;
    const [s, r, angle] = nearestOnPath(path, ...holdAt);
    const co = Math.cos(angle), si = Math.sin(angle);
    const holding = (u, v) => [s + u * co - v * si, r + u * si + v * co];
    for (const offset of [.3, .85]) {
      stroke([holding(offset,-width / 2 + 1), holding(offset,width / 2 - 1)], .23, taxi + .037, yellow);
    }
    for (let v = -9; v <= 9; v += 2.5) {
      for (const offset of [-.8, -.25]) {
        stroke([holding(offset,v - .68), holding(offset,v + .68)], .23, taxi + .037, yellow);
      }
    }
    for (const side of [-1, 1]) light(...holding(0, side * (width / 2 + 1.9)), taxi + .3, '#ffc65b', 1.65);
    tile([holding(5,-10.5),holding(5,-2.3),holding(9.2,-2.3),holding(9.2,-10.5)], taxi + .034, '#963c36');
    number('05-23', ...holding(7.15, -6.4), 2.55, angle + Math.PI, taxi + .043, white);
  }

  stroke(sampleTaxiRoute({ points: arrivalStandLine }).path, .32, apron + .044, yellow);
  const [standS, standR] = arrivalStandLine.at(-1);
  rect(standS, standR, 4.2, .36, apron + .045, yellow);
  const rng = randomSource(7819);
  for (const [s, r] of [[329, -67], [len - 500, -70]]) {
    column(s, r, terrain(s, r), base + 6.1, .13, .08, '#d3ccbb', 7);
    const rows = Array.from({ length: 8 }, (_, j) => Array.from({ length: 10 }, (_, i) => {
      const a = i * TAU / 10, radius = .54 - j * .052;
      return at(s + j * .57, r + Math.cos(a) * radius, base + 5.86 - j * j * .024 + Math.sin(a) * radius);
    }));
    for (let j = 1; j < rows.length; j++) {
      for (let i = 0; i < 10; i++) {
        const k = (i + 1) % 10;
        structures.face([rows[j - 1][i], rows[j][i], rows[j][k], rows[j - 1][k]], j % 2 ? '#d67947' : '#ece6d1');
      }
    }
  }
  buildAirportBuildings(parent, {
    batch: structures, world, at, stroke, number, light, column, terrain, obstacles, rng, apron, base,
  });
  buildAirportForecourts(parent, frame, runway, material, lamps);
  buildAirportIndustry(parent, geo, material, obstacles);

  ground.finish(parent, material, '高崎 · 05/23 跑道与机坪').receiveShadow = true;
  const buildings = structures.finish(parent, material, '高崎 · T3、T4、塔台与机位');
  buildings.castShadow = buildings.receiveShadow = true;
  return frame;
}
