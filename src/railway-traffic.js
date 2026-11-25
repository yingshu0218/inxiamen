import * as THREE from 'three';
import { box, litSurface, MeshBatch, mix } from './scenery-mesh.js';
import { plan, railHeight, stationPoint, stationTracks } from './railway-layout.js';

const carLength = 24.8;
const carSpacing = 25.18;
const carCount = 8;
const flank = '#e4e7e3', roof = '#bdc6c6', stripe = '#286d9d', sill = '#626d72';

function buildCar(parent, material, cab) {
  const batch = new MeshBatch(), half = carLength / 2;
  // The streamlined cab narrows to a rounded nose and rises into the main body.
  const profile = cab ? [
    [-half, .32, 1.40, .70], [-half + .55, .55, 1.78, .60], [-half + 2.0, .80, 2.39, .55],
    [-half + 3.9, .96, 3.20, .50], [-half + 6.1, 1, 3.79, .53], [-half + 8.2, 1, 3.90, .57],
    [half - .3, 1, 3.90, .57], [half, .94, 3.80, .61],
  ] : [[-half, .95, 3.8, .58], [-half + .22, 1, 3.9, .57], [half - .22, 1, 3.9, .57], [half, .95, 3.8, .58]];
  const cross = [[-.83, 0], [-.99, .18], [-1, .36], [-1, .45], [-.995, .78], [-.91, .92],
    [-.60, 1], [.60, 1], [.91, .92], [.995, .78], [1, .45], [1, .36], [.99, .18], [.83, 0]];
  const rings = profile.map(([x, width, y, base]) => cross.map(([v, h]) => [x, mix(base, y, h), v * width * 1.58]));
  const colors = [sill, flank, stripe, flank, flank, roof, roof, roof, flank, flank, stripe, flank, sill];
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1], b = rings[i];
    for (let j = 1; j < a.length; j++) {
      const windshield = cab && i >= 3 && i <= 4 && j >= 5 && j <= 9;
      batch.face([a[j - 1], b[j - 1], b[j], a[j]], windshield ? '#20333d' : colors[j - 1]);
    }
  }
  batch.face(rings[0], cab ? flank : sill);
  batch.face(rings.at(-1), sill);
  // A dark gangway fills the short gap between adjacent cars.
  box(batch, half, 0, .29, 1.95, .82, 3.23, '#343d41', '#434d52');
  if (!cab) box(batch, -half, 0, .29, 1.95, .82, 3.23, '#343d41', '#434d52');
  for (const x of [-8, 8]) box(batch, x, 0, 4.1, 2.14, .22, .86, '#333a3c', '#505657');
  const start = cab ? -4.1 : -9.9;
  for (const side of [-1, 1]) {
    const window = (x0, x1, bottom, top, color, style = 0, seed = 0) => {
      const z = side * 1.595;
      batch.face([[x0, bottom, z], [x1, bottom, z], [x1, top, z], [x0, top, z]], color, style, seed);
    };
    window(start - .27, 9.4, 2.32, 3.20, '#263b43');
    for (let x = start; x < 9; x += 1.86) {
      window(x, Math.min(x + 1.51, 9.28), 2.41, 3.08, '#668096', litSurface.railGlass, .5);
      window(x - .20, x - .03, 2.32, 3.20, '#839194');
    }
    for (const x of cab ? [10.85] : [-11.04, 10.85]) {
      window(x - .49, x + .49, 1.09, 3.38, '#b4c1c4');
      window(x - .31, x + .31, 2.47, 3.07, '#273c48');
    }
    if (cab) batch.face([
      [-half - .025, .98, side * .19], [-half - .025, .98, side * .38],
      [-half - .025, 1.12, side * .37], [-half - .025, 1.12, side * .18],
    ], '#ffddad', litSurface.canopyLight);
  }
  box(batch, cab ? -.4 : 0, 0, 4.6, .96, 3.85, 4.01, '#9da9a9', '#aeb8b8');
  return batch.finish(parent, material, cab ? '动车组驾驶端' : '动车组客车');
}

export function addRailwayTrains(parent, geo, material) {
  const group = new THREE.Group();
  group.name = '厦门站 · 动车组';
  parent.add(group);
  const cab = buildCar(group, material, true), coach = buildCar(group, material, false);
  const createTrain = track => {
    const cars = Array.from({ length: carCount }, (_, i) => {
      const car = new THREE.Mesh((i === 0 || i === carCount - 1 ? cab : coach).geometry, material);
      car.castShadow = car.receiveShadow = true;
      group.add(car);
      return car;
    });
    return head => {
      for (const [i, car] of cars.entries()) {
        const s = head + carLength / 2 + i * carSpacing;
        car.visible = s > 0 && s < track.length;
        if (!car.visible) continue;
        const point = track.sample(s);
        const a = track.sample(s - carLength * .42), b = track.sample(s + carLength * .42);
        car.position.set(point.x, railHeight(geo, point.x, point.z), point.z);
        car.rotation.y = Math.atan2(a.z - b.z, b.x - a.x) + (i === carCount - 1 ? Math.PI : 0);
      }
    };
  };
  const main = stationTracks[1], siding = stationTracks[7];
  const move = createTrain(main), park = createTrain(siding);
  cab.removeFromParent();
  coach.removeFromParent();
  park(siding.nearest(...stationPoint(59, 43)).s);

  const brakeAt = main.nearest(...stationPoint(-228, -23)).s;
  return (seconds, plane) => {
    group.visible = (plane.x - plan.origin[0]) ** 2 + (plane.z - plan.origin[1]) ** 2 < 2900 ** 2;
    if (!group.visible) return;
    const phase = (seconds + 18) % 154;
    const head = phase < 56 ? mix(main.length + 34, brakeAt, 1 - (1 - phase / 56) ** 1.65)
      : phase < 91 ? brakeAt
      : mix(brakeAt, -carCount * carSpacing - 40, Math.min(1, (phase - 91) / 61) ** 1.6);
    move(head);
  };
}
