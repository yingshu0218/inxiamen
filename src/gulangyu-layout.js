import plan from './gulangyu-plan.json' with { type: 'json' };
import { inRing, ObstacleIndex } from './scenery-mesh.js';
import { ellipse, localFrame, rect } from './landmark-forms.js';
import { measuredPath } from './old-town-layout.js';
import { sunlight } from './sunlight-layout.js';

export { plan };
export const inIslandBounds = (x, z) => x > -7420 && x < -5250 && z > 2520 && z < 4750;
export const market = measuredPath(plan.marketStreet);
export const villageLanes = plan.villageLanes.map(measuredPath);

export const bearing = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);

// Fit a rectangle along a measured facade, including footprints with an apse or side wings.
export function footprintFrame(ring, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const along = ring.map(([x, z]) => x * c + z * s);
  const across = ring.map(([x, z]) => -x * s + z * c);
  const u = (Math.min(...along) + Math.max(...along)) / 2;
  const v = (Math.min(...across) + Math.max(...across)) / 2;
  const center = [u * c - v * s, u * s + v * c];
  return { xy: localFrame(center, angle), center, angle,
    width: Math.max(...along) - Math.min(...along), depth: Math.max(...across) - Math.min(...across) };
}

// For each quay, the first axis runs along the berths and the second points out to sea.
const san = plan.sanqiutian.pontoon, west = plan.neicuoao.pontoon, piano = plan.piano.hall;
export const sanqiutian = footprintFrame(san, bearing(san[0], san[1]));
export const neicuoao = footprintFrame(west, bearing(west[0], west[1]));
export const pianoWharf = footprintFrame(piano, bearing(piano[3], piano[1]));
export const moorings = [
  { name: '三丘田', quay: sanqiutian, along: 24, across: 14.2 },
  { name: '内厝澳', quay: neicuoao, along: 5, across: 13.8 },
  { name: '钢琴', quay: pianoWharf, along: 1, across: 48.4 },
];

// The 10 m height grid includes the hillside at the back of the west terminal.
// Cut a level entrance into the slope, then blend the approach back to the lane.
export function gradeNeicuoaoEntrance(grid, samples) {
  const [cx, cz] = neicuoao.xy(0, -52);
  const c = Math.cos(neicuoao.angle), s = Math.sin(neicuoao.angle);
  const step = grid.stepMetres, unit = grid.metresPerUnit;
  for (let row = Math.max(0, Math.ceil((cz - 68 - grid.zmin)/step)); row < grid.height; row++) {
    const dz = grid.zmin + row*step - cz;
    if (dz > 68) break;
    for (let col = Math.max(0, Math.ceil((cx - 68 - grid.xmin)/step)); col < grid.width; col++) {
      const dx = grid.xmin + col*step - cx;
      if (dx > 68) break;
      const u = c*dx + s*dz, v = -s*dx + c*dz;
      const distance = Math.hypot(Math.max(0,Math.abs(u)-34), Math.max(0,Math.abs(v)-13));
      if (distance >= 20) continue;
      const i = row*grid.width+col, existing = samples[i]*unit;
      const target = 3.64 + .14*Math.max(0,-v-13);
      if (existing <= target) continue;
      const t = distance/20, weight = t*t*(3-2*t);
      samples[i] = Math.round((target + weight*(existing-target))/unit);
    }
  }
}

const reservations = new ObstacleIndex();
const reserve = ring => reservations.add(ring, 1);
for (const ring of [...sunlight.outcrops, ...sunlight.templeHalls, ...sunlight.templeAnnexes, sunlight.templeGate, sunlight.templeCourt]) reserve(ring);
// Keep the inscribed face and the walk up to it clear of generic trees and rooftops.
reserve(rect(localFrame(sunlight.inscription,-1.42),0,-8,37,25));
for (const path of [sunlight.ascent,sunlight.eastDescent]) {
  for (let i=1;i<path.length;i++) {
    const a=path[i-1], b=path[i], frame=localFrame(a,bearing(a,b));
    const run=Math.hypot(b[0]-a[0],b[1]-a[1]);
    reserve(rect(frame,run/2,0,run+.6,3.1));
  }
}
for (const ring of [plan.trinity, plan.catholic, plan.consulate, plan.huangVilla, plan.gardenWestGate, ...plan.gardenGateWings, plan.gardenTerrace, plan.seaPavilion, ...plan.haitian, ...plan.tidalRocks]) reserve(ring);
export const huangFrame = footprintFrame(plan.huangVilla,bearing(plan.huangVilla[0],plan.huangVilla[1]));
reserve(rect(huangFrame.xy,-1,17,15,18));
reserve(ellipse(huangFrame.xy,-1,27,6,5,20));
export const estateCourt = footprintFrame(plan.haitian[0], bearing(plan.haitian[0][0],plan.haitian[0][1])).xy;
reserve(rect(estateCourt,0,-32,6,39));
reserve(rect(estateCourt,0,-20,62,4));
export const trinityFrame = footprintFrame(plan.trinity,bearing(plan.trinity[3],plan.trinity[4])+Math.PI/2);
reserve(rect(trinityFrame.xy,0,0,trinityFrame.width+4,trinityFrame.depth+4));
reserve(ellipse(localFrame(plan.statue, -.32), -3, 0, 27.5, 18.5, 24));
for (let i = 1; i < plan.seaWalk.length; i++) {
  const a = plan.seaWalk[i - 1], b = plan.seaWalk[i];
  const xy = localFrame([(a[0]+b[0])/2, (a[1]+b[1])/2], bearing(a,b));
  reserve(rect(xy, 0, 0, Math.hypot(b[0]-a[0], b[1]-a[1])+1, 4));
}
reserve(rect(sanqiutian.xy, 7, -27, 92, 72));
for (const [start, end] of [[0, 1], [2, 3]]) {
  const a = plan.sanqiutian.shoreEnds[start], b = plan.sanqiutian.shoreEnds[end];
  const xy = localFrame([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], sanqiutian.angle);
  reserve(rect(xy, 0, 23, Math.hypot(a[0] - b[0], a[1] - b[1]) + 1, 52));
}
reserve(plan.neicuoao.hall);
reserve(rect(neicuoao.xy, 0, -13, 63, 42));
reserve(rect(pianoWharf.xy, 18, 17, 66, 56));
// A concave gate wing surrounds an open passage. The average of its vertices
// lies in that passage, so the ordinary building's centre misses its own lot.
const gateBuildings=[plan.gardenWestGate,...plan.gardenGateWings];
export function replacesGardenBuilding(ring) {
  const [x,z]=ring[0];
  if(x < -6210 || x > -6160 || z < 4185 || z > 4212)return false;
  return gateBuildings.some(wing=>ring.every(([px,pz])=>inRing(px,pz,wing) || wing.some((a,i)=>{
    const b=wing[(i+1)%wing.length], dx=b[0]-a[0], dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz)));
    return Math.hypot(px-a[0]-t*dx,pz-a[1]-t*dz)<.55;
  })));
}

export const islandSiteReserved = (x, z) => inIslandBounds(x, z) && reservations.heightAt(x, z) > 0;
