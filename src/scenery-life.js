import * as THREE from 'three';
import {
  MeshBatch,
  LampBatch,
  prism,
  box,
  cylinder,
  randomSource,
  geoPoint,
  TAU,
  groundY,
  litSurface,
  mix,
} from './scenery-mesh.js';
import { templePlantings } from './landmark-nanputuo.js';
import { campusPlantings } from './landmark-jiannan.js';
import { parkPlantings } from './landmark-bailuzhou.js';
import { landmarkReserved } from './scenery-landmarks.js';
import { oldTownReserved } from './old-town-layout.js';
import { waterfrontTrees } from './landmark-lujiang.js';
import { hubinTrees } from './hubin-layout.js';
import { pathTube } from './landmark-haicang.js';
import { railwayTrees } from './railway-layout.js';
import { wucunTrees } from './wucun-layout.js';
import { airportWorksReserved } from './airport-layout.js';
import { huangFrame, moorings } from './gulangyu-layout.js';
import { dongduPontoons } from './west-landmark-layout.js';

const dummy = new THREE.Object3D();
const rnd = randomSource(1987);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function leafGeometry(palm, random) {
  const batch = new MeshBatch();
  if (palm) {
    const trunk = [
      [0, 0.0, 0.18],
      [0.09, 3.0, 0.155],
      [0.36, 6.5, 0.13],
      [0.68, 8.5, 0.105],
    ];
    for (let j = 1; j < trunk.length; j++) {
      for (let i = 0; i < 8; i++) {
        const a = (TAU * i) / 8,
          b = (TAU * (i + 1)) / 8;
        const pt = (k, an) => [
          trunk[k][0] + Math.cos(an) * trunk[k][2],
          trunk[k][1],
          Math.sin(an) * trunk[k][2],
        ];
        batch.face([pt(j - 1, a), pt(j, a), pt(j, b), pt(j - 1, b)], '#988468');
      }
    }
    for (let n = 0; n < 11; n++) {
      const a = (TAU * n) / 11 + 0.19 * Math.cos(n * 3),
        f = 0.83 + 0.22 * random(),
        ar = n % 3 === 0 ? 1.25 : 1;
      const at = (v, lift, side) => {
        const length = 4.26 * f * v,
          y = 8.45 + ar * (2.2 * Math.sin(Math.PI * v * 0.96) - 1.4 * v * v) + lift;
        return [
          0.68 + length * Math.cos(a) - side * Math.sin(a),
          y,
          length * Math.sin(a) + side * Math.cos(a),
        ];
      };
      for (let j = 0; j < 7; j++) {
        const lo = j / 7,
          hi = (j + 1) / 7,
          mid = (lo + hi) / 2;
        const width = 0.54 * Math.pow(Math.sin(Math.PI * mid), 0.7);
        const color = n % 3 === 0 ? '#77935e' : n % 3 === 1 ? '#608653' : '#527849';
        for (const side of [-1, 1]) {
          batch.top([at(lo, 0, 0), at(hi, 0, 0), at(hi + 0.065, -0.14, side * width)], color);
          batch.top([at(mid, 0, 0), at(hi, 0, 0), at(hi + 0.105, -0.26, side * width * 0.9)], color);
        }
      }
    }
  } else {
    cylinder(batch, 0, 0, 0, 4, 0.34, 0.17, '#8c785c', 6);
    for (const [cx, cz, rx, rz, offset] of [
      [0, 0, 3.3, 2.8, 0],
      [1.7, 0.4, 2.3, 2.0, -0.95],
      [-0.8, -1.4, 2.4, 1.95, -0.57],
    ]) {
      const rings = [];
      for (const [y, radius] of [
        [3.1, 0.29],
        [3.6, 0.78],
        [5.1, 1],
        [6.4, 0.8],
        [7.15, 0.39],
      ]) {
        rings.push(
          Array.from({ length: 8 }, (_, i) => {
            const a = (TAU * i) / 8 + 0.1 * radius,
              warp = 1 + 0.14 * Math.sin(a * 3 + cx);
            return [
              cx + rx * radius * warp * Math.cos(a),
              offset + y + 0.29 * Math.sin(a * 2 + 0.6),
              cz + rz * radius * warp * Math.sin(a),
            ];
          })
        );
      }
      const shades = ['#516849', '#637d54', '#759166', '#899e6d'];
      for (let j = 0; j < rings.length - 1; j++)
        for (let i = 0; i < 8; i++) {
          const k = (i + 1) % 8;
          batch.face([rings[j][i], rings[j + 1][i], rings[j + 1][k], rings[j][k]], shades[j]);
        }
      batch.top(rings.at(-1), '#8b9b6c');
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(batch.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(batch.normals, 3));
  g.setAttribute('color', new THREE.Uint8BufferAttribute(batch.colors, 3, true));
  g.setIndex(batch.indices);
  return g;
}
export function treeInstances(parent, places, palm, random = rnd) {
  if (!places.length) return;
  const groups = new Map();
  for (const tree of places) {
    const key = Math.floor(tree[0] / 2700) + ',' + Math.floor(tree[2] / 2700);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tree);
  }
  const g = leafGeometry(palm, random);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const tint = new THREE.Color();
  for (const group of groups.values()) {
    const instances = new THREE.InstancedMesh(g, mat, group.length);
    group.forEach(([x, y, z, scale, angle, hue], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(
        scale,
        scale * (0.83 + (0.08 + Math.cos(angle) * 0.08)),
        scale * (0.9 + 0.12 * Math.sin(angle))
      );
      dummy.updateMatrix();
      instances.setMatrixAt(i, dummy.matrix);
      tint.setRGB(0.77 + 0.23 * hue, 0.8 + 0.2 * hue, 0.71 + 0.19 * hue);
      instances.setColorAt(i, tint);
    });
    instances.computeBoundingSphere();
    instances.name = palm ? '滨海棕榈' : '山林树冠';
    parent.add(instances);
  }
}

export function vegetate(parent, geo, airport, obstacles, material, roadVegetationBlocked) {
  const trees = [],
    palms = [],
    props = new MeshBatch();
  function plant(x, z, scale, palm = false, planted = false) {
    if (
      (!planted && (geo.coverAt(x, z) === 0 || landmarkReserved(x,z) || oldTownReserved(x,z)
        || roadVegetationBlocked(x, z, scale * 2.2))) ||
      airportWorksReserved(airport, x, z) ||
      obstacles.heightAt(x, z) > geo.heightAt(x, z) + 2
    )
      return;
    (palm ? palms : trees).push([x, groundY(geo, x, z) - 0.1, z, scale, rnd() * TAU, rnd()]);
  }
  for (const [x,z,scale,palm] of [...parkPlantings, ...templePlantings, ...campusPlantings, ...waterfrontTrees,
    ...railwayTrees, ...wucunTrees, ...hubinTrees.filter(tree=>tree[3])]) plant(x,z,scale,palm,true);
  // Woodland clusters are retained as actual canopies at sightseeing altitude.
  for (let i = 0; i < 1050; i++) {
    const x = -6700 + rnd() * 14400,
      z = -9300 + rnd() * 15100,
      cover = geo.coverAt(x, z);
    if (cover !== 2 && !(cover === 3 && rnd() < 0.38)) continue;
    const n = 3 + Math.floor(rnd() * 6);
    for (let j = 0; j < n; j++) {
      const dx = (rnd() - 0.5) * 78,
        dz = (rnd() - 0.5) * 78,
        c = geo.coverAt(x + dx, z + dz);
      if (c === 2 || c === 3) plant(x + dx, z + dz, 1.15 + rnd() * 1.2);
    }
  }
  // Gulangyu's gardens sit between red roofs, with denser stands on the central hill.
  for (let i = 0; i < 1230; i++) {
    const x = -7570 + rnd() * 2340,
      z = 2270 + rnd() * 2510,
      c = geo.coverAt(x, z);
    if (c === 0 || c === 4 || c === 5) continue;
    if (c === 1 && rnd() > 0.42) continue;
    plant(x, z, 0.91 + rnd() * 1.16);
  }
  // Find the game shoreline at each station rather than guessing the waterline in metres.
  for (let j = 0; j < 56; j++) {
    const f = j / 55,
      [x, z] = geoPoint(mix(118.1465, 118.1689, f), mix(24.4375, 24.4536, f));
    let shore = null;
    for (let d = -380; d < 520; d += 5) {
      const xx = x + 0.62 * d,
        zz = z + 0.78 * d;
      if (geo.rawHeightAt(xx, zz) <= 0) {
        shore = [xx, zz];
        break;
      }
    }
    if (!shore) continue;
    const drift = 37 + 10 * Math.sin(f * 13);
    for (let k = 0; k < 3; k++)
      plant(
        shore[0] - 0.62 * drift + (rnd() - 0.5) * 22,
        shore[1] - 0.78 * drift + (rnd() - 0.5) * 22,
        0.85 + 0.41 * rnd(),
        true
      );
    if (j % 3 === 0)
      for (let k = 0; k < 5; k++) {
        const inset = 19 + rnd() * 18,
          along = (rnd() - 0.5) * 46;
        const bx = shore[0] - inset * 0.62 + along * 0.78,
          bz = shore[1] - inset * 0.78 - along * 0.62,
          by = geo.heightAt(bx, bz);
        if (by < 0.5 || geo.coverAt(bx, bz) === 0) continue;
        cylinder(props, bx, bz, by, by + 2.3, 0.07, 0.065, '#af9674', 5);
        const radius = 1.65;
        for (let m = 0; m < 8; m++) {
          const a = (m * TAU) / 8,
            b = ((m + 1) * TAU) / 8;
          props.top(
            [
              [bx, by + 2.85, bz],
              [bx + radius * Math.cos(a), by + 2.15, bz + radius * Math.sin(a)],
              [bx + radius * Math.cos(b), by + 2.15, bz + radius * Math.sin(b)],
            ],
            m % 2 ? '#eee0b7' : k % 2 ? '#bd7e55' : '#668c8a'
          );
        }
      }
    if (j === 13 || j === 37) {
      const bx = shore[0] - 20,
        bz = shore[1] - 22,
        by = geo.heightAt(bx, bz);
      if (by > 0) {
        box(props, bx, bz, 4.4, 3.3, by, by + 1.7, '#a49273', '#c5b093');
        prism(
          props,
          [
            [bx - 2.6, bz - 2],
            [bx + 2.6, bz - 2],
            [bx + 2.6, bz + 2],
            [bx - 2.6, bz + 2],
          ],
          by + 1.7,
          by + 3.6,
          '#d6cbb0',
          '#b46e50',
          4,
          0.5,
          1.2
        );
      }
    }
  }
  props.finish(parent, material, '黄厝海滨活动与瞭望亭');
  treeInstances(parent, trees, false);
  // Pair of tall palms framing the public entrance in the 2025 courtyard photograph.
  for (const [u,v,scale,angle] of [[-7.5,18.2,1.86,.87],[5.9,18.8,1.77,2.1]]) {
    const [x,z]=huangFrame.xy(u,v);
    palms.push([x,groundY(geo,x,z)-.14,z,scale,angle,.48]);
  }
  treeInstances(parent, palms, true);
}

// Chamfered deckhouses follow the prow and leave usable exterior decks at
// the bow and stern. The wheelhouse windscreen slopes in towards the roof.
function passengerDecks(batch, variant, rim) {
  const ivory='#eae8d7', steel='#d3ded9', trim=variant?'#3d727b':'#a34c3c';
  function outline(width, bow, stern) {
    const r=width*.5;
    return [[-r+.5,stern],[-r,stern-.8],[-r,bow+3.2],[-r*.84,bow+1.45],[-r*.49,bow+.26],
      [0,bow],[r*.49,bow+.26],[r*.84,bow+1.45],[r,bow+3.2],[r,stern-.8],[r-.5,stern]];
  }
  function deck(width,bow,stern,lo,hi,color,cap=color,style=0){
    prism(batch,outline(width,bow,stern),lo,hi,color,cap,style,variant?.77:.34);
  }
  function guardrail(points,base,height){
    for(const h of [height*.48,height])pathTube(batch,points.map(([x,z])=>[x,base+h,z]),.046,ivory,5);
    for(let i=1;i<points.length;i++){
      const [x,z]=points[i-1], [bx,bz]=points[i], n=Math.ceil(Math.hypot(bx-x,bz-z)/2.0);
      for(let j=0;j<n;j++)cylinder(batch,x+(bx-x)*j/n,z+(bz-z)*j/n,base,base+height,.043,.043,steel,5);
    }
  }
  // The lower saloon is continuous glazing between a painted waist and the
  // shelter deck. Wide white trim appears as two distinct lines from the air.
  deck(8.74,-12.05,12.65,1.88,2.82,ivory);
  deck(8.65,-11.91,12.52,2.82,4.43,'#456671',null,litSurface.ferryGlass);
  deck(9.05,-12.23,13.18,4.43,4.74,trim);
  deck(9.30,-12.46,13.48,4.74,4.99,ivory,'#a9a99a');
  const stern=variant?6.5:4.55;
  deck(7.87,-10.83,stern,4.99,5.61,ivory);
  const low=outline(7.82,-10.85,stern), high=outline(7.48,-9.55,stern-.16);
  for(let i=0;i<low.length;i++){
    const j=(i+1)%low.length, len=Math.hypot(low[i][0]-low[j][0],low[i][1]-low[j][1]);
    batch.face([[low[i][0],5.61,low[i][1]],[high[i][0],7.12,high[i][1]],
      [high[j][0],7.12,high[j][1]],[low[j][0],5.61,low[j][1]]],
      '#344e56',litSurface.ferryGlass,.63,[[0,0],[0,1.51],[len,1.51],[len,0]]);
  }
  deck(8.24,-10.07,stern+.5,7.12,7.46,ivory,'#d4d6c5');
  for(const x of [-2.97,2.97]){
    box(batch,x,2.0,.90,4.56,7.46,7.74,'#9a988c','#e3deca');
    for(const z of [7.9,10.4])box(batch,x,z,.71,1.65,4.99,5.48,'#857b67','#af926b');
  }
  for(const x of [-3.7,3.7])for(const z of [stern+1.2,11.2]){
    cylinder(batch,x,z,4.99,6.70,.074,.068,steel,6);
  }
  deck(8.42,stern+.7,12.07,6.67,6.86,steel,'#dcd9c8');
  for(const x of [-1.67,1.67]){
    cylinder(batch,x,3.15,7.46,8.45,.50,.47,trim,12);
    cylinder(batch,x,3.15,8.45,8.68,.49,.49,'#455256',12);
  }
  cylinder(batch,0,-3.93,7.46,10.08,.10,.06,steel,8);
  box(batch,0,-3.93,2.1,.16,9.67,9.84,ivory,ivory);
  const bowRail=rim.slice(2,7).map(([x,,z])=>[x*.97,z*.98]);
  guardrail(bowRail,2.22,.90);
  guardrail([[-4.4,5.2],[-4.34,12.68],[-3.83,13.0],[3.83,13.0],[4.34,12.68],[4.4,5.2]],4.99,.97);
  // A pair of lifebuoys hangs broadside, with four pale straps on each ring.
  for(const side of [-1,1]){
    for(let i=0;i<16;i++){
      const point=a=>[side*4.44,3.51+.30*Math.sin(a),7.32+.30*Math.cos(a)];
      pathTube(batch,[point(i*TAU/16),point((i+1)*TAU/16)],.072,i%4===0?ivory:'#c85b37',5);
    }
  }
}

function ferryHull(material, variant, darkness, harbour = false) {
  const group = new THREE.Group(),
    b = new MeshBatch();
  const outline = [
    [-4.7, 15],
    [-5.0, 10],
    [-4.5, -7.6],
    [-2.7, -13],
    [0, -16],
    [2.7, -13],
    [4.5, -7.6],
    [5, 10],
    [4.7, 15],
  ];
  const bottom = outline.map(([x, z]) => [x * 0.76, -0.35, z * 0.94]);
  const rim = outline.map(([x, z]) => [x, 2.0 + (z < -9 ? (-9 - z) * 0.075 : 0), z]);
  for (let i = 0; i < rim.length; i++) {
    const k = (i + 1) % rim.length;
    b.face([bottom[i], rim[i], rim[k], bottom[k]], variant ? '#3a6270' : '#784d40');
    const stripe = (it) => [rim[it][0] * 0.97, 0.85, rim[it][2] * 0.985];
    b.face([stripe(i), [rim[i][0], 1.2, rim[i][2]], [rim[k][0], 1.2, rim[k][2]], stripe(k)], '#e4cea2');
  }
  b.top(rim, '#c5b897');
  if (harbour) passengerDecks(b,variant,rim);
  else {
    box(b, 0, 0.4, 8.65, 22.4, 1.75, 4.95, '#e1dec8', '#c8c6b3', 2, 0.55);
    box(b, 0, 1.1, 7.5, 15.9, 4.85, 7.25, '#deceaa', '#e1d9bc', 2, 0.36);
    box(b, 0, 2.9, 7.9, 12.3, 7.2, 7.58, '#ccbc9d', '#d5cab0');
    box(b, 0, 5.8, 1.7, 2.1, 7.5, 8.8, '#b77855', '#525e60');
    cylinder(b, 0, -4.9, 7.12, 10.25, 0.105, 0.06, '#b2aa90', 6);
    for (let i = 0; i < 15; i++)
      for (const side of [-1, 1]) {
        const z = -10.8 + i * 1.65,
          x = side * (4.4 - Math.max(0, -8 - z) * 0.24);
        cylinder(b, x, z, 2.1, 3.0, 0.055, 0.055, '#e0d7b9', 4);
      }
  }
  b.finish(group, material, '客轮船身');
  const lamps = new LampBatch();
  lamps.add(-4.3, 4.9, -4.8, '#ff4c41', .80);
  lamps.add(4.3, 4.9, -4.8, '#69edb7', .80);
  lamps.add(0, 9.9, -4.9, '#ffe8bc', 1.15);
  for (const side of [-1, 1]) {
    for (let z = -7; z <= 9; z += 3.2) lamps.add(side * 4.39, 3.6, z, '#ffcf8b', .57);
  }
  lamps.finish(group, darkness);
  // Two long tapered sheets and a foamy transom wash all move with the boat.
  const wake = new THREE.BufferGeometry(),
    v = [],
    c = [];
  const shade = new THREE.Color('#e9e7d4');
  function wakeTri(a, b, d, alpha) {
    v.push(...a, ...b, ...d);
    for (const weight of alpha) c.push(shade.r, shade.g, shade.b, weight);
  }
  for (const side of [-1, 1]) {
    for (let j = 0; j < 24; j++) {
      const a = j / 24,
        b = (j + 1) / 24;
      const pt = (t, w) => [
        side * (1 + t * 19 + w * Math.sin(Math.PI * t) * 0.85 + Math.sin(t * 20) * 0.65),
        0.19,
        12 + t * 86,
      ];
      wakeTri(pt(a, -1), pt(b, -1), pt(b, 1), [0.55 * (1 - a), 0.55 * (1 - b), 0]);
      wakeTri(pt(a, -1), pt(b, 1), pt(a, 1), [0.55 * (1 - a), 0, 0]);
    }
  }
  wakeTri([-3.7, 0.2, 14], [3.7, 0.2, 14], [0, 0.2, 51], [0.64, 0.64, 0]);
  wake.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  wake.setAttribute('color', new THREE.Float32BufferAttribute(c, 4));
  const surface = new THREE.Mesh(
    wake,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  surface.renderOrder = 2;
  group.add(surface);
  return { ship: group, wake: surface.material };
}

export function maritime(parent, geo, material, roads, darkness) {
  const vessels = [];
  const routes = [
    [
      [118.0714, 24.4516],
      [118.073, 24.4477],
      [118.0751, 24.4433],
      [118.0742, 24.438],
      [118.0729, 24.435],
      [118.0715, 24.4375],
      [118.0739, 24.4445],
      [118.07125, 24.4501],
    ],
    [
      [118.0814, 24.4269],
      [118.0751, 24.431],
      [118.067, 24.4316],
      [118.059, 24.4318],
      [118.0567, 24.428],
      [118.07, 24.4285],
    ],
    [
      [118.1769, 24.5445],
      [118.182, 24.541],
      [118.191, 24.5417],
      [118.1874, 24.5456],
      [118.181, 24.5444],
    ],
  ];
  for (const [route, points] of routes.entries()) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((ll) => {
        const [x, z] = geoPoint(...ll);
        return new THREE.Vector3(x, 0, z);
      }),
      true,
      'centripetal'
    );
    const length = curve.getLength();
    for (let i = 0; i < (route === 0 ? 3 : 2); i++) {
      const { ship, wake } = ferryHull(material, i % 2, darkness);
      ship.scale.setScalar(0.8 + i * 0.12);
      parent.add(ship);
      vessels.push({
        ship, wake,
        curve,
        length,
        speed: 5.5 + i * 0.55,
        phase: (route === 0 ? 0.15 : 0.2) + i / (route === 0 ? 3 : 2),
      });
    }
  }
  // One ferry lies alongside the northern pontoon. The southern berth has a
  // slow harbour circuit, including time alongside and a gentle departure.
  const moored = ferryHull(material,1,darkness,true);
  moored.ship.name = '轮渡码头 · 靠泊客轮';
  moored.ship.scale.setScalar(1.15);
  moored.ship.position.set(-5805.35,.05,2522.05);
  moored.ship.rotation.y=Math.atan2(-.579,-.815);
  moored.wake.visible=false;
  parent.add(moored.ship);
  const islandFerries = moorings.map(({name,quay,along,across}) => {
    const ship = moored.ship.clone();
    ship.name = name+'码头 · 靠泊客轮';
    const [x,z] = quay.xy(along,across);
    ship.scale.setScalar(1);
    ship.position.set(x,.06,z);
    ship.rotation.set(0, -Math.PI / 2 - quay.angle, 0);
    parent.add(ship);
    return ship;
  });
  for (const { a, b, width } of dongduPontoons.slice(0, 2)) {
    const ship = moored.ship.clone();
    ship.name = '东渡客运码头 · 靠泊客轮';
    const dx = b[0] - a[0], dz = b[1] - a[1], distance = Math.hypot(dx, dz);
    const clearance = width / 2 + 6.25;
    ship.scale.setScalar(1);
    ship.position.set((a[0] + b[0]) / 2 - dz / distance * clearance, .06,
      (a[1] + b[1]) / 2 + dx / distance * clearance);
    ship.rotation.y = Math.atan2(-dx, -dz);
    parent.add(ship);
    islandFerries.push(ship);
  }
  const shuttle = ferryHull(material,0,darkness,true);
  shuttle.ship.name = '鹭江客轮'; shuttle.ship.scale.setScalar(1.10);
  const harbour = new THREE.CatmullRomCurve3([
    [-5773,2575],[-5745,2628],[-5727,2730],[-5710,2878],[-5720,3075],[-5787,3230],
    [-5874,3226],[-5903,3075],[-5914,2855],[-5882,2665],[-5835,2539],[-5797,2544],
  ].map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
  parent.add(shuttle.ship);
  vessels.push({...shuttle,curve:harbour,length:harbour.getLength(),speed:5.3,phase:.007,berth:true});
  const traffic = [];
  const colors = ['#e2d9bc', '#68777a', '#b28267', '#c3bca8', '#73928f'];
  for (const road of roads) {
    const cars = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.75, 1.36, 4.05),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
      24
    );
    const phases = [],
      tint = new THREE.Color();
    for (let i = 0; i < cars.count; i++) {
      phases.push(rnd());
      cars.setColorAt(i, tint.set(colors[i % 5]));
    }
    cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cars.frustumCulled = false;
    cars.name = road.name ?? (road.surfaceStreet ? '鹭江道双向车流' : '桥上车流');
    parent.add(cars);
    const bulbs = new LampBatch();
    for (let i = 0; i < cars.count; i++) {
      for (const end of [1, -1])
        for (let side = 0; side < 2; side++) bulbs.add(0, 0, 0, end > 0 ? '#ffeed4' : '#f54228', .73);
    }
    const carLights = bulbs.finish(parent, darkness);
    carLights.frustumCulled = false;
    carLights.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    traffic.push({ road, center: road.center ?? road.step(.5), cars, phases, carLights });
  }
  let lastMove = -10, lastDarkness = -1;
  function update(time, plane) {
    if (Math.abs(time - lastMove) < 0.06 && Math.abs(darkness.value - lastDarkness) < .01) return;
    lastMove = time;
    lastDarkness = darkness.value;
    moored.ship.position.y=.05+.055*Math.sin(time*.48);
    for(const [i,ship] of islandFerries.entries()) {
      ship.visible = !plane || Math.hypot(plane.x-ship.position.x,plane.z-ship.position.z)<5800;
      if(ship.visible) ship.position.y=.06+.06*Math.sin(time*.48+i*1.3);
    }
    for (const { ship, wake, curve, length, speed, phase, berth } of vessels) {
      let u = (((phase + (time * speed) / length) % 1) + 1) % 1;
      let running=1;
      if(berth){
        const t=clamp((u-.075)/.925);
        u=t-Math.sin(t*TAU)/TAU*.94;
        running=t===0?0:clamp((1-.94*Math.cos(t*TAU))*.85);
      }
      wake.opacity = (1-.85*darkness.value)*running;
      const p = curve.getPointAt(u),
        ahead = curve.getTangentAt(u);
      ship.visible = !plane || Math.hypot(plane.x - p.x, plane.z - p.z) < 7000;
      if (!ship.visible) continue;
      ship.position.set(p.x, 0.05 + 0.15 * Math.sin(time * 0.72 + phase * 32), p.z);
      ship.rotation.set(
        0.008 * Math.sin(time * 0.55 + phase),
        Math.atan2(-ahead.x, -ahead.z),
        0.013 * Math.cos(time * 0.49 + phase * 5),
        'YXZ'
      );
    }
    for (const { road, center, cars, phases, carLights } of traffic) {
      cars.visible = !plane || Math.hypot(plane.x - center.x, plane.z - center.z) < 4800;
      carLights.visible = cars.visible && darkness.value > .025;
      if (!cars.visible) continue;
      for (let i = 0; i < cars.count; i++) {
        const sign = i % 2 === 0 ? 1 : -1;
        const t = (((phases[i] + (time * (10 + (i % 5)) * sign) / road.length) % 1) + 1) % 1,
          n = road.step(t);
        const lane = road.carOffsets?.[Math.floor(i / 2) % road.carOffsets.length] ?? (i % 3 === 0 ? 6.5 : 2.6);
        const p = road.at(n, (road.carCenter ?? 0) + sign * lane, 0.77);
        dummy.position.set(...p);
        dummy.rotation.set(0, Math.atan2(n.rz, -n.rx), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        cars.setMatrixAt(i, dummy.matrix);
        if (carLights.visible) {
          let bulb = i * 4;
          for (const end of [1, -1]) for (const side of [-.64, .64]) {
            const along = end * sign * 2.09;
            carLights.geometry.attributes.position.setXYZ(bulb++,
              p[0] + n.rz*along + n.rx*side, p[1] + .14, p[2] - n.rx*along + n.rz*side
            );
          }
        }
      }
      cars.instanceMatrix.needsUpdate = true;
      if (carLights.visible) carLights.geometry.attributes.position.needsUpdate = true;
    }
  }
  update(0, null);
  return update;
}
