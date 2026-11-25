#!/usr/bin/env node
// Run from the repository root with Node and Python 3 + Pillow.
// Reports source road candidates, not missing connections in the real network.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { elevationField, reliefCoverage } from '../src/geography.js';
import { gradeOldTown } from '../src/old-town-layout.js';
import { gradeShapoweiBank } from '../src/shapowei-bank.js';
import { gradeAirport } from '../src/airport-layout.js';
import { gradeHubin } from '../src/hubin-layout.js';
import { gradeRailway } from '../src/railway-layout.js';
import { gradeGaoqiRailway } from '../src/gaoqi-railway-layout.js';
import { gradeCampusPlayingFields } from '../src/campus-layout.js';
import { refineShoreTerrain } from '../src/shore-grading.js';
import { mazeWater } from '../src/parks/layout.js';
import { readLakes } from '../src/inland-water.js';
import { inRing } from '../src/scenery-mesh.js';
import { buildYundangPaths, yundangPaths } from '../src/yundang-paths.js';
import { MeshBatch } from '../src/scenery-mesh.js';
import { runway } from '../src/route.js';
import {
  bridgeWaterFloor, layMainlandStrip, mainlandRoadWater, mainlandStreet, roadVegetationMask,
} from '../src/mainland-street-surface.js';

const dir = 'public/geo/';
const read = name => readFileSync(dir + name);
const json = name => JSON.parse(read(name));
const i16 = name => {
  const bytes = read(name);
  return new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
};
const bounds = json('manifest.json');
const relief = json('xiamen-relief.json');
const outline = json('islands.json').xiamen;
const samples = i16('xiamen-relief.bin');
const outer = i16('terrain.bin');
for (const [grid, values] of [[relief, samples], [bounds, outer]]) {
  gradeAirport(runway, grid, values);
  gradeOldTown(grid, values);
  if (grid === relief) gradeShapoweiBank(grid, values);
  gradeHubin(grid, values);
  gradeRailway(grid, values);
  gradeGaoqiRailway(grid, values);
  gradeCampusPlayingFields(grid, values);
}
const { lakes, waterAt, isletAt } = readLakes([...json('inland-water.json').water, mazeWater]);
const { width, height } = bounds.coastDistanceEncoding;
const coastRaster = execFileSync('python3', ['-c',
  'import sys; from PIL import Image; sys.stdout.buffer.write(Image.open(sys.argv[1]).convert("L").tobytes())',
  dir + 'coast-distance.png'], { maxBuffer: width * height + 1000 });
const distanceAt = elevationField({ ...bounds, width, height }, coastRaster);
const coastDistance = (x, z) => (distanceAt(x, z) - 128) * 2;
const step = (relief.xmax - relief.xmin) / (relief.width - 1);
const islandDisplay = Float32Array.from(samples, (sample, i) => {
  const y = sample * relief.metresPerUnit;
  if (y <= -5 || y >= .88) return Math.max(-12, y);
  const x = relief.xmin + i % relief.width * step;
  const z = relief.zmin + Math.floor(i / relief.width) * step;
  return waterAt(x, z) ? y : .88;
});
const islandHeight = elevationField(relief, samples, relief.metresPerUnit);
const outerHeight = elevationField(bounds, outer);
const islandTerrain = elevationField(relief, islandDisplay);
const inRelief = reliefCoverage(relief);
const rendered = (x, z) => inRelief(x, z) ? islandTerrain(x, z) : outerHeight(x, z);
const refinements = refineShoreTerrain(lakes, coastDistance, rendered, elevationField);
const refinement = (x, z) => refinements.find(patch => patch.contains(x, z))?.sample(x, z);
const roadTerrainAt = (x, z) => refinement(x, z) ?? rendered(x, z);
const heightAt = (x, z) => waterAt(x, z)?.h ??
  Math.max(isletAt(x, z) ? .88 : 0, refinement(x, z) ?? (inRelief(x, z) ? islandHeight(x, z) : outerHeight(x, z)));
const onMainland = (x, z) => inRing(x, z, outline);
const geo = { coastDistance, heightAt, roadTerrainAt, onMainland, waterAt };
const records = json('urban-streets.json').roads.filter(record => mainlandStreet(record[1]));
const roadWidths = [1.6, 3.6, 5.4, 7.7, 10.5, 13.6, 18];
const raised = record => Boolean(record[1] & 1) || record[2] > 0;
const key = (x, z) => x + ',' + z;
const tile = (x, z) => key(Math.floor(x / 2000), Math.floor(z / 2000));
const points = flat => Array.from({ length: flat.length / 2 }, (_, i) => flat.slice(2 * i, 2 * i + 2));
const endpoints = new Map(), table = new Map(), hot = [], residual = [];
for (const record of records) {
  const [kind, flags, layer, ...flat] = record;
  const line = points(flat);
  for (const [p, next] of [[line[0], line[1]], [line.at(-1), line.at(-2)]]) {
    const id = key(...p);
    if (!endpoints.has(id)) endpoints.set(id, []);
    endpoints.get(id).push({ p, next, kind, flags, layer, deck: raised(record) });
  }
}

function grid(x, z) {
  const id = tile(x, z);
  if (!table.has(id)) table.set(id, {
    lengths: Array(7).fill(0), grade: 0, water: 0, bridgeWater: 0, mixedNodes: 0,
    gapCandidates: 0, probed: 0, buriedBefore: 0, buriedAfter: 0, wetBefore: 0, wetAfter: 0,
  });
  return table.get(id);
}

const singleton = [...endpoints.values()].filter(items => items.length === 1).map(items => items[0]);
const unpaired = new Map();
for (const item of singleton) {
  const id = key(Math.floor(item.p[0] / 8), Math.floor(item.p[1] / 8));
  if (!unpaired.has(id)) unpaired.set(id, []);
  unpaired.get(id).push(item);
}
for (const items of endpoints.values()) {
  const { p, next, kind, layer, deck } = items[0];
  if (!onMainland(...p)) continue;
  if (items.some(item => item.deck !== deck || item.layer !== layer)) grid(...p).mixedNodes++;
  if (items.length > 1 || kind < 2) continue;
  const [i, j] = p.map(v => Math.floor(v / 8));
  for (let x = i - 1; x <= i + 1; x++) {
    for (let z = j - 1; z <= j + 1; z++) {
      for (const item of unpaired.get(key(x, z)) ?? []) {
        if (key(...p) >= key(...item.p) || deck !== item.deck || kind !== item.kind || layer !== item.layer) continue;
        const dx = item.p[0] - p[0], dz = item.p[1] - p[1], distance = Math.hypot(dx, dz);
        if (distance < 1 || distance > 8) continue;
        const faces = (a, b, sx, sz) => {
          const vx = a[0] - b[0], vz = a[1] - b[1];
          return (vx * sx + vz * sz) / (Math.hypot(vx, vz) * distance) > .8;
        };
        if (faces(p, next, dx, dz) && faces(item.p, item.next, -dx, -dz)) {
          grid(...p).gapCandidates++;
          hot.push({ type: 'near endpoints', kind, p, to: item.p, metres: +distance.toFixed(2) });
        }
      }
    }
  }
}

function coversTriangle(x, z, a, b, c) {
  const area = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-7) return null;
  const t = ((x - a[0]) * (c[2] - a[2]) - (z - a[2]) * (c[0] - a[0])) / area;
  const u = ((b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0])) / area;
  return t >= -1e-7 && u >= -1e-7 && t + u <= 1.0000001 ? a[1] + t * (b[1] - a[1]) + u * (c[1] - a[1]) : null;
}
function surfaceAt(x, z, quads) {
  let top = -Infinity;
  for (const [a, b, c, d] of quads) {
    for (const face of [[a, b, c], [a, c, d]]) top = Math.max(top, coversTriangle(x, z, ...face) ?? -Infinity);
  }
  return top;
}

let index = 0;
for (const record of records) {
  const [kind, , , ...flat] = record;
  const line = points(flat);
  const bridge = raised(record);
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const dx = b[0] - a[0], dz = b[1] - a[1], distance = Math.hypot(dx, dz);
    if (!distance) continue;
    const n = Math.ceil(distance / 24);
    const p = (t, width) => [a[0] + dx * t - dz / distance * width, a[1] + dz * t + dx / distance * width];
    for (let j = 0; j < n; j++) {
      const from = j / n, to = (j + 1) / n, mid = p((from + to) / 2, 0);
      if (!onMainland(...mid)) continue;
      const stepLength = distance / n;
      const bucket = grid(...mid);
      bucket.lengths[kind + 1] += stepLength;
      const wet = mainlandRoadWater(geo, ...mid);
      if (wet) bucket[bridge ? 'bridgeWater' : 'water'] += stepLength;
      if (!bridge && !wet && Math.abs(heightAt(...p(from, 0)) - heightAt(...p(to, 0))) / stepLength > .15) {
        bucket.grade++;
        if (kind >= 3 && hot.length < 120) hot.push({ type: 'surface DEM grade >15%', kind, p: mid.map(Math.round) });
      }
      if (bridge || ++index % 3) continue;
      const half = roadWidths[kind + 1] / 2;
      const quad = [p(from, -half), p(from, half), p(to, half), p(to, -half)]
        .map(([x, z]) => [x, heightAt(x, z) + .39, z]);
      const beforeVisible = [p(from, 0), p(to, 0)].every(([x, z]) =>
        !waterAt(x, z) && (heightAt(x, z) >= .12 || isletAt(x, z)));
      const fragments = [];
      layMainlandStrip({ top: q => fragments.push(q) }, geo, quad);
      for (const along of [.25, .5, .75]) {
        for (const lateral of [-.85, 0, .85]) {
          const [x, z] = p(from + (to - from) * along, half * lateral);
          const before = beforeVisible ? surfaceAt(x, z, [quad]) : -Infinity;
          const after = surfaceAt(x, z, fragments);
          bucket.probed++;
          if (mainlandRoadWater(geo, x, z)) {
            if (Number.isFinite(before)) bucket.wetBefore++;
            if (Number.isFinite(after)) {
              bucket.wetAfter++;
              residual.push({ type: 'water edge', kind, x, z });
            }
          } else {
            const ground = roadTerrainAt(x, z);
            if (before < ground && Number.isFinite(before)) bucket.buriedBefore++;
            if (after < ground && Number.isFinite(after)) {
              bucket.buriedAfter++;
              residual.push({ type: 'terrain near bend', kind, x, z, depth: ground - after });
            }
          }
        }
      }
    }
  }
}

const canopy = roadVegetationMask(geo);
canopy.add([[-1, 1, -10], [1, 1, -10], [1, 1, 10], [-1, 1, 10]]);
if (!canopy.blocks(0, 0, 0) || canopy.blocks(12, 0, 1)) throw new Error('road canopy mask regression');
const coreWater = { h: 3 };
const dry = { waterAt: () => undefined, coastDistance: () => 12 };
const wet = { waterAt: () => coreWater, coastDistance: () => 12 };
if (bridgeWaterFloor(dry, 0, 0) !== -Infinity || bridgeWaterFloor(wet, 0, 0) !== 4.2)
  throw new Error('bridge water floor regression');
const survey = new MeshBatch();
buildYundangPaths(survey, geo);
const plane = [];
for (let i = 0; i < survey.indices.length; i += 3) {
  plane.push(survey.indices.slice(i, i + 3).map(k => survey.positions.slice(k * 3, k * 3 + 3)));
}
let surveyedPoints = 0;
for (const { points, line } of yundangPaths) {
  for (let s = 1; s < line.length - 1; s += 2) {
    const { x, z } = line.sample(s);
    const top = Math.max(...plane.map(face => coversTriangle(x, z, ...face) ?? -Infinity));
    if (!Number.isFinite(top) || top < heightAt(x, z)) throw new Error('surveyed path surface has a gap');
    surveyedPoints++;
  }
  for (const p of [points[0], points.at(-1)]) {
    if (!plane.some(face => coversTriangle(...p, ...face) !== null)) throw new Error('surveyed path endpoint has no deck');
  }
}
const header = 'x_cell,z_cell,path_m,service_m,local_m,tertiary_m,secondary_m,primary_m,expressway_m,grade_gt_15pct,mapped_surface_in_water_m,mapped_deck_over_water_m,coincident_elevation_endpoints,gap_candidates,probes,buried_before,buried_after,wet_before,wet_after';
console.log(header);
for (const [id, row] of [...table.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log([id, ...row.lengths.map(Math.round), row.grade, Math.round(row.water), Math.round(row.bridgeWater),
    row.mixedNodes, row.gapCandidates, row.probed, row.buriedBefore, row.buriedAfter, row.wetBefore, row.wetAfter].join(','));
}
console.error(JSON.stringify({ records: records.length, surveyedPoints, issues: hot, residual }, null, 2));
