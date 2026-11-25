import plan from './old-town-plan.json' with { type: 'json' };
import { inRing } from './scenery-mesh.js';

export { plan };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Use engineering station (metres along the alignment) for paving, plots and furniture.
export function measuredPath(points) {
  let length = 0;
  const spans = [];
  for (let i = 1; i < points.length; i++) {
    const [x, z] = points[i - 1];
    const dx = points[i][0] - x, dz = points[i][1] - z, len = Math.hypot(dx, dz);
    if (len < .01) continue;
    spans.push({ x, z, ux: dx / len, uz: dz / len, s: length, len });
    length += len;
  }
  function sample(s) {
    const d = clamp(s, 0, length);
    const line = spans.find(k => d <= k.s + k.len) || spans.at(-1);
    return { x: line.x + line.ux * (d-line.s), z: line.z + line.uz * (d-line.s), ux: line.ux, uz: line.uz };
  }
  function nearest(x, z) {
    let best = Infinity, station = 0, side = 0, ux = 0, uz = 0;
    for (const k of spans) {
      const dx = x-k.x, dz = z-k.z;
      const local = clamp(dx*k.ux+dz*k.uz, 0, k.len);
      const sq = (dx-local*k.ux)**2 + (dz-local*k.uz)**2;
      if (sq >= best) continue;
      best = sq; station = k.s+local; side = dz*k.ux-dx*k.uz; ux = k.ux; uz = k.uz;
    }
    return { s: station, distance: Math.sqrt(best), side, ux, uz };
  }
  // Miter joins keep a ribbon closed at a bend, including at its sampled vertices.
  function sections(maxStep) {
    const rows = [];
    for (const [i, k] of spans.entries()) {
      const prev = spans[Math.max(0, i-1)], dot = 1 + prev.ux*k.ux + prev.uz*k.uz;
      const pieces = Math.ceil(k.len/maxStep);
      for (let j=0; j<pieces; j++) {
        const d = k.len*j/pieces;
        rows.push({x:k.x+d*k.ux, z:k.z+d*k.uz, rx:j ? -k.uz : -(prev.uz+k.uz)/Math.max(.5,dot),
          rz:j ? k.ux : (prev.ux+k.ux)/Math.max(.5,dot), s:k.s+d});
      }
    }
    const last = sample(length);
    rows.push({...last, rx:-last.uz, rz:last.ux, s:length});
    return rows;
  }
  return { length, sample, nearest, sections };
}

export const street = measuredPath(plan.zhongshan);
export const carriageways = plan.lanes.map(measuredPath);
export const shore = measuredPath(plan.shoreline);
export const offset = (p, meters) => [p.x - p.uz*meters, p.z + p.ux*meters];
export const alongFrame = (p, side = 1) => (u, v) => [p.x + side*(p.ux*u - p.uz*v), p.z + side*(p.uz*u + p.ux*v)];
const inDistrict = (x,z) => x >= -6020 && x <= -4415 && z >= 2040 && z <= 3550;
export function oldTownReserved(x,z) {
  if (!inDistrict(x,z)) return false;
  return street.nearest(x,z).distance < 25 || shore.nearest(x,z).distance < 12 ||
    carriageways.some(r => r.nearest(x,z).distance < 9) || inRing(x,z,plan.hotel) || inRing(x,z,plan.park) || inRing(x,z,plan.terminal);
}
export function replacesStreet(x,z,ux,uz) {
  if (!inDistrict(x,z)) return false;
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

export function ribbon(batch, rows, left, right, height, color, style = 0, seed = 0) {
  const pair = (p) => [left,right].map(lateral => {
    const x=p.x+lateral*p.rx, z=p.z+lateral*p.rz;
    return [x,height(x,z,p.s,lateral),z];
  });
  let prev=pair(rows[0]);
  for(let i=1;i<rows.length;i++) {
    const next=pair(rows[i]), a=rows[i-1].s, b=rows[i].s;
    batch.top([prev[0],prev[1],next[1],next[0]],color,style,seed,[[left,a],[right,a],[right,b],[left,b]]);
    prev=next;
  }
}
