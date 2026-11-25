import plan from './old-town-plan.json' with { type: 'json' };
import xiagang from './xiagang-plan.json' with { type: 'json' };
import { measuredPath, ribbon } from './measured-path.js';
import { xiagangReserved } from './xiagang-layout.js';
import { inRing } from './scenery-mesh.js';

export { measuredPath, plan, ribbon };
export const street = measuredPath(plan.zhongshan);
export const carriageways = plan.lanes.map((lane, i) => measuredPath([...lane, ...xiagang.avenueEnds[i]]));
export const shore = measuredPath([...plan.shoreline, ...xiagang.shoreEnd]);
export const offset = (p, meters) => [p.x - p.uz*meters, p.z + p.ux*meters];
export const alongFrame = (p, side = 1) => (u, v) => [p.x + side*(p.ux*u - p.uz*v), p.z + side*(p.uz*u + p.ux*v)];
const inDistrict = (x,z) => x >= -6020 && x <= -4415 && z >= 2040 && z <= 3550;
export function oldTownReserved(x,z) {
  if (xiagangReserved(x, z)) return true;
  if (!inDistrict(x,z)) return false;
  return street.nearest(x,z).distance < 25 || shore.nearest(x,z).distance < 12 ||
    carriageways.some(r => r.nearest(x,z).distance < 9) || inRing(x,z,plan.hotel) || inRing(x,z,plan.park) || inRing(x,z,plan.terminal);
}
export function replacesStreet(x,z,ux,uz) {
  if (!inDistrict(x,z) && !(x > -4960 && x < -4895 && z > 3530 && z < 3570)) return false;
  for (const path of [street,...carriageways]) {
    const k = path.nearest(x,z);
    if (k.distance < (path===street?5:6.5) && Math.abs(ux*k.ux + uz*k.uz)>.83) return true;
  }
  return false;
}
export function oldTownFootprints(building) {
  const r=building.rings[0], [a,b]=r;
  if (a[0] < -6150 || a[0] > -4250 || a[1] < 1425 || a[1] > 3775) return undefined;
  return plan.cityCuts[[2*a[0],2*a[1],2*b[0],2*b[1],r.length].join(',')];
}

// The elevation sources include roof returns. Grade the two street corridors
// on the actual terrain vertices so doors, traffic and the flight surface agree.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b-a)*t;
export function gradeOldTown(grid, data) {
  const sx=(grid.xmax-grid.xmin)/(grid.width-1), sz=(grid.zmax-grid.zmin)/(grid.height-1);
  const unit=grid.metresPerUnit ?? 1;
  const fade = (d,inner,outer) => {const t=clamp((outer-d)/(outer-inner),0,1); return t*t*(3-2*t);};
  for(let iz=Math.max(0, Math.ceil((2040-grid.zmin)/sz)); iz<grid.height && grid.zmin+iz*sz<=3550; iz++) {
    const z=grid.zmin+iz*sz;
    for(let ix=Math.max(0, Math.ceil((-6020-grid.xmin)/sx)); ix<grid.width && grid.xmin+ix*sx<=-4415; ix++) {
      const x=grid.xmin+ix*sx, idx=iz*grid.width+ix;
      let h=data[idx]*unit;
      const avenue=Math.min(...carriageways.map(lane=>lane.nearest(x,z).distance));
      const quay=shore.nearest(x,z), road=street.nearest(x,z);
      // The old town rises gently from the waterfront towards Xinhua Road.
      h=lerp(h,4.9+10*(road.s/street.length),fade(road.distance,22,77));
      h=lerp(h,4.4,fade(avenue,19,63));
      if (quay.side<=1.3 && quay.distance<81) h=lerp(h,3.15+Math.min(1.45,quay.distance*.032),fade(quay.distance,15,81));
      if (quay.side>1.3 && quay.distance<35) h=Math.min(h,lerp(2.8,-6,Math.min(1,(quay.distance-1.3)/16)));
      data[idx]=Math.round(h/unit);
    }
  }
}
