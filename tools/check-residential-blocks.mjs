import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Frustum, Group, MeshBasicMaterial, PerspectiveCamera, WebGLCoordinateSystem } from 'three';
import { airportFrame } from '../src/airport-layout.js';
import { buildCity, decodeCityLayout } from '../src/city-layout.js';
import { elevationField, reliefCoverage } from '../src/geography.js';
import { applyResidentialBlocks } from '../src/residential-blocks.js';
import { runway } from '../src/route.js';
import { landmarkReserved } from '../src/scenery-landmarks.js';
import { inRing, ObstacleIndex } from '../src/scenery-mesh.js';

const read = name => readFileSync(new URL('../public/geo/' + name, import.meta.url));
const json = name => JSON.parse(read(name));
const arrayBuffer = data => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
const binary = arrayBuffer(read('city-layout.bin'));
const overlay = json('residential-blocks.json');
const { blocks: plans, protectedOldTownBounds } = overlay;
const islands = json('islands.json');
const original = decodeCityLayout(binary);
const updated = [...applyResidentialBlocks(original, plans)];
const originalRings = new Set(original.map(row => row.rings));
const byRings = new Map(updated.map(row => [row.rings, row]));
const added = updated.filter(row => !originalRings.has(row.rings));
const removed = original.filter(row => !byRings.has(row.rings));
const modified = original.filter(row => byRings.has(row.rings) && byRings.get(row.rings) !== row);
const centre = ring => ring.reduce(([x, z], p) => [x + p[0] / ring.length, z + p[1] / ring.length], [0, 0]);
const protectedAt = (x, z) => protectedOldTownBounds.some(([w, n, e, s]) =>
  x >= w && x <= e && z >= n && z <= s);
const pilot = plans.filter(plan => plan.kind === 'pilot');

assert.equal(added.length, plans.reduce((count, plan) => count + plan.roofs.length, 0));
assert.ok(removed.every(row => row.streetFrontage && row.use === 1 && !row.base));
for (const row of [...added, ...removed, ...modified]) {
  const [x, z] = centre(row.rings[0]);
  assert.ok(inRing(x, z, islands.xiamen));
  assert.ok(!protectedAt(x, z));
}
assert.ok(added.every(row => !landmarkReserved(...centre(row.rings[0]))));
for (const row of modified) {
  const { residentialFinish, ...rest } = byRings.get(row.rings);
  assert.ok(residentialFinish);
  assert.deepEqual(rest, { ...row, reviewedDistrict: row.reviewedDistrict ||
    pilot.some(plan => row.rings[0].every(point => inRing(...point, plan.ring))) });
}

// An added outline is suppressed once a future base dataset already contains it.
const laterRoof = { ...added[0], reviewedDistrict: false };
const refreshed = [...applyResidentialBlocks([laterRoof], plans)];
assert.equal(refreshed.length, added.length);
assert.equal(refreshed.filter(row => row.rings === laterRoof.rings).length, 1);
// Every vertex is in this concave parcel, but an edge crosses its open recess.
const acrossSchool = {
  use: 1, height: 17, base: 0, streetFrontage: true,
  rings: [[[870, -1980], [1020, -1980], [1030, -1970], [865, -1970]]],
};
assert.equal([...applyResidentialBlocks([acrossSchool], [plans[1]])][0], acrossSchool);

const relief = json('xiamen-relief.json');
const sample = elevationField(relief, new Int16Array(arrayBuffer(read(relief.file))), relief.metresPerUnit);
const inRelief = reliefCoverage(relief);
const broad = elevationField(json('manifest.json'), new Int16Array(arrayBuffer(read('terrain.bin'))));
const geo = { islands, heightAt: (x, z) => inRelief(x, z) ? sample(x, z) : broad(x, z) };
const frame = airportFrame(runway);

async function meshStats(blocks) {
  const scene = new Group();
  const material = new MeshBasicMaterial();
  const index = new ObstacleIndex();
  const update = await buildCity(scene, geo, frame, material, index, binary, undefined, blocks);
  const outside = [];
  let vertices = 0, triangles = 0;
  const views = {};
  const cameras = [
    ['luling', [965, 520, -1885], [965, 15, -1905], 58],
    ['hongwen', [3695, 580, -176], [3695, 18, -258], 54],
    ['lulingFar', [-6100, 1600, -1885], [965, 15, -1905], 35],
  ];
  for (const [name, position, target, fov] of cameras) {
    update(position[0], position[2]);
    const camera = new PerspectiveCamera(fov, 1003 / 646, 4, 82000);
    camera.position.set(...position);
    camera.lookAt(...target);
    camera.updateMatrixWorld();
    const view = new Frustum().setFromProjectionMatrix(
      camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse), WebGLCoordinateSystem,
    );
    const active = scene.children.filter(mesh => mesh.visible && view.intersectsObject(mesh));
    views[name] = {
      batches: active.length,
      triangles: active.reduce((total, mesh) => total + mesh.geometry.index.count / 3, 0),
    };
  }
  for (const mesh of scene.children) {
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();
    vertices += geometry.attributes.position.count;
    triangles += geometry.index.count / 3;
    const { min, max } = geometry.boundingBox;
    if (max.x < -6000 || min.x > 7400 || min.z > 6250 || max.z < -8900) {
      const hash = createHash('sha256');
      for (const { array } of [...Object.values(geometry.attributes), geometry.index]) {
        hash.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
      }
      outside.push(hash.digest('hex'));
    }
    geometry.dispose();
  }
  material.dispose();
  const oldTown = new Set([...index.cells.values()].flat().filter(object =>
    protectedAt(...centre(object.points))));
  return { batches: scene.children.length, vertices, triangles, views, outside: outside.sort(),
    oldTown: [...oldTown].map(object => JSON.stringify(object)).sort() };
}

const before = await meshStats([]);
const after = await meshStats(plans);
assert.deepEqual(after.outside, before.outside);
assert.deepEqual(after.oldTown, before.oldTown);
const { outside: checked, oldTown: town, ...beforeStats } = before;
const { outside: _, oldTown: __, ...afterStats } = after;
console.log(JSON.stringify({
  records: { before: original.length, after: updated.length, added: added.length, removed: removed.length, styledExisting: modified.length },
  unchangedOffIslandBatches: checked.length, unchangedOldTownObstacles: town.length, before: beforeStats, after: afterStats,
}, null, 2));
