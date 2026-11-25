import plan from './campus-plan.json' with { type: 'json' };
import { inRing } from './scenery-mesh.js';
import { inRect, localFrame } from './landmark-forms.js';
import { measuredPath } from './old-town-layout.js';

export const shangxian = {p: [-3263, 4874], a: .183, straight: 55, radius: 34, width: 6.3, level: 7.6, surfaceLift: .54};
export const yanwuField = {p: [-3505, 4685], a: -1.104, straight: 44, radius: 37, width: 8.3, level: 6.8};
export const qunxian = {p: [-3500, 4517], a: .458};
export const jiageng = {p: [-3305, 4433], a: -1.153, tower: [-23.4, -6.4]};
export const baicheng = {p: [-2814.7, 4921.6], a: .125};
export const furongHouses = plan.furong;
export const yanwuCourts = plan.courts;
export const campusRoads = plan.roads.map(([id, width, points]) => ({id, width, path: measuredPath(points)}));
export const inCampus = (x,z) => inRing(x,z,plan.boundary);

const toLocal = (x, z, {p,a}) => {
  const dx=x-p[0], dz=z-p[1], c=Math.cos(a), s=Math.sin(a);
  return [dx*c+dz*s,dz*c-dx*s];
};
export function ovalDistance(x,z,site) {
  const [u,v]=toLocal(x,z,site);
  return Math.hypot(Math.max(0,Math.abs(u)-site.straight),v);
}
export function campusInfillReserved(x,z) {
  if (x < -3730 || x > -2750 || z < 4310 || z > 4951) return false;
  if (ovalDistance(x,z,yanwuField) < 51) return true;
  if (x < -3552 && z > 4525 && z < 4720 &&
      yanwuCourts.some(([,p,a,w,d])=>inRect(x,z,p,a,w/2+1.5,d/2+1.5))) return true;
  if (inRect(x,z,qunxian.p,qunxian.a,181,23) ||
      inRect(x,z,localFrame(qunxian.p,qunxian.a)(0,45),qunxian.a,111,20)) return true;
  const [u,v]=toLocal(x,z,jiageng);
  if (u > -144 && u < 88 && v > -28 && v < 51) return true;
  if (u > -84 && u < 38 && v > 51 && v < 106) return true;
  if (inRect(x,z,localFrame(baicheng.p,baicheng.a)(0,-5),baicheng.a,20,18)) return true;
  return furongHouses.some(([, ,p,a,w,d])=>inRect(x,z,p,a,w/2+3,d/2+3));
}
export function replacesCampusStreet(x,z,dx,dz) {
  if (x < -3680 || x > -2760 || z < 4230 || z > 4937) return false;
  if (!inCampus(x,z)) return false;
  return campusRoads.some(({path,width}) => {
    const p=path.nearest(x,z);
    return p.distance < width/2 + 1.8 && Math.abs(p.ux*dx+p.uz*dz) > .79;
  });
}

// The pitches occupy surveyed map footprints. Their gameplay levels are
// estimated from the existing terrain and blend into its surrounding slopes.
export function gradeCampusPlayingFields(grid, data) {
  const {xmin,zmin,xmax,zmax,width,height}=grid, scale=grid.metresPerUnit ?? 1;
  const sx=(xmax-xmin)/(width-1),sz=(zmax-zmin)/(height-1);
  for (const site of [shangxian,yanwuField]) {
    const [x,z]=site.p, extent=site.straight+site.radius+site.width+45;
    const i0=Math.max(0,Math.ceil((x-extent-xmin)/sx)), i1=Math.min(width-1,Math.floor((x+extent-xmin)/sx));
    const j0=Math.max(0,Math.ceil((z-extent-zmin)/sz)), j1=Math.min(height-1,Math.floor((z+extent-zmin)/sz));
    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
      const px=xmin+i*sx,pz=zmin+j*sz;
      if(!inCampus(px,pz))continue;
      const d=ovalDistance(px,pz,site);
      const t=Math.min(1,Math.max(0,(d-site.radius-site.width-13)/26));
      const weight=1-t*t*(3-2*t), idx=j*width+i;
      data[idx]=Math.round((1-weight)*data[idx]+weight*site.level/scale);
    }
  }
}
