import plan from './hubin-plan.json' with { type: 'json' };
import { inRing } from './scenery-mesh.js';
import { localFrame, rect } from './landmark-forms.js';
import { measuredPath, offset } from './old-town-layout.js';

export { plan };
export const avenue = measuredPath(plan.avenue), eastRoad = measuredPath(plan.crossing);
export const jinqiao = measuredPath(plan.jinqiao);
export const shoreWalk = measuredPath(plan.lakeside), footbridge = measuredPath(plan.footbridge);
export const forecourt = [[-2751,-691],[-2607,-733],[-2593,-677],[-2733,-635]];
export const busStops = plan.busStops.map(point => {
  const near = avenue.nearest(...point);
  return {s: near.s, side: Math.sign(near.side)};
});
export const nearBusStop = (s,side,margin=10.5) => busStops.some(stop=>side===stop.side && Math.abs(s-stop.s)<margin);
export const annexFrame=localFrame([-2579.7,-705.1],-.288);
export const annexFootprint=rect(annexFrame,0,0,17.8,27.2);
const pathStart=avenue.sample(busStops[1].s-14);
const landing=plan.footbridge.at(-1);
export const parkConnection=measuredPath([offset(pathStart,14.9),offset(pathStart,18.65),
  [-2648.6,-614.5],[-2649.9,-610.1],landing]);
const boxes = [plan.stadium, plan.training, ...plan.courts, plan.building, forecourt, plan.telecom, annexFootprint].map(ring => {
  const xs=ring.map(p=>p[0]), zs=ring.map(p=>p[1]);
  return {ring, x0:Math.min(...xs), x1:Math.max(...xs), z0:Math.min(...zs), z1:Math.max(...zs)};
});
const inDistrict = (x,z) => x>-3130 && x<-1990 && z>-1130 && z<-405;
const corridors = [[avenue,12.6],[eastRoad,12.7],[jinqiao,6],[shoreWalk,3.0],[footbridge,2.5],[parkConnection,2.35]];

export function hubinReserved(x,z) {
  if (!inDistrict(x,z)) return false;
  return boxes.some(b=>x>=b.x0 && x<=b.x1 && z>=b.z0 && z<=b.z1 && inRing(x,z,b.ring)) ||
    corridors.some(([path,width])=>path.nearest(x,z).distance<width);
}

export function replacesHubinStreet(x,z,ux,uz) {
  if (!inDistrict(x,z)) return false;
  return corridors.some(([path,width])=>{
    const near=path.nearest(x,z);
    return near.distance<width && Math.abs(ux*near.ux+uz*near.uz)>.83;
  });
}

// The lakeside is close to sea level. Remove roof returns only on the block
// and sports grounds. Preserve the mapped water and the two narrow islets.
export function gradeHubin(grid, samples) {
  const dx=(grid.xmax-grid.xmin)/(grid.width-1), dz=(grid.zmax-grid.zmin)/(grid.height-1);
  const unit=grid.metresPerUnit??1;
  const fade=(v,a,b)=>{const t=Math.max(0,Math.min(1,(b-v)/(b-a)));return t*t*(3-2*t);};
  for(let j=Math.max(0,Math.ceil((-1160-grid.zmin)/dz)); j<grid.height && grid.zmin+dz*j<-430; j++){
    const z=grid.zmin+dz*j;
    for(let i=Math.max(0,Math.ceil((-3140-grid.xmin)/dx)); i<grid.width && grid.xmin+dx*i<-1970; i++){
      const x=grid.xmin+dx*i, idx=j*grid.width+i;
      let h=samples[idx]*unit;
      const a=avenue.nearest(x,z);
      const blend=(target,weight)=>{h+=(target-h)*weight;};
      // Exclude the shore side beyond the sidewalk so lake-bed vertices stay submerged.
      if(a.side<17) blend(3.9,fade(a.distance,18,49));
      const site=Math.max(Math.abs(x+2678)/95,Math.abs(z+718)/79);
      if(a.side<0) blend(4.25,fade(site,.85,1.15));
      const bowl=Math.hypot((x+2165)/115,(z+995)/125);
      blend(5.1,fade(bowl,.99,1.32));
      const sports=Math.max(Math.abs(x+2260)/174,Math.abs(z+867)/66);
      if(a.side<0) blend(4.15,fade(sports,.92,1.22));
      samples[idx]=Math.round(h/unit);
    }
  }
}

export const hubinTrees=[];
for(let s=15;s<jinqiao.length-22;s+=17.4){
  const p=jinqiao.sample(s);
  if(Math.abs(p.z+786)<12 || Math.abs(p.z+657)<9)continue;
  for(const side of [-1,1])hubinTrees.push([...offset(p,side*6.35),1.14+.24*Math.cos(s),false]);
}
for(let s=10;s<shoreWalk.length-13;s+=10.6){
  const p=shoreWalk.sample(s);
  if(parkConnection.nearest(p.x,p.z).distance<10 || footbridge.nearest(p.x,p.z).distance<9 || eastRoad.nearest(p.x,p.z).distance<26)continue;
  const gap=avenue.nearest(p.x,p.z).distance;
  if(gap>22)hubinTrees.push([...offset(p,-4.3-.9*Math.sin(s)),1.12+.42*Math.cos(s*.44),false]);
}
for(let s=10; s<avenue.length-6; s+=13.4){
  if(plan.junctions.some(j=>Math.abs(s-j)<23)) continue;
  for(const side of [-1,1]){
    const p=avenue.sample(s+(side>0?2.5:0)), xy=offset(p,side*14.15);
    if(nearBusStop(s,side,11) || (xy[0]>-2549 && xy[0]<-2487 && side<0))continue;
    if(side<0 && xy[0]>-2750 && xy[0]<-2609) continue;
    hubinTrees.push([...xy,1.04+.17*Math.sin(s*1.6),false]);
  }
}
for(const [x,z,s,palm] of [[-2736,-652,1.27,true],[-2725,-655,1.05,true],[-2713,-656,1.23,true],
  [-2698,-663,1.11,true],[-2661,-669,1.35,true],[-2649,-672,1.16,true],[-2634,-677,1.1,true],
  [-2614,-680,1.12,false],[-2756,-700,1.25,false],[-2760,-727,1.4,false],
  [-2714,-765,1.8,false],[-2721,-758,1.65,false],[-2726,-769,1.42,false],[-2708,-773,1.64,false],
  [-2748,-672,1.34,false],[-2749,-679,1.52,false],[-2739,-634,1.38,false],
  [-2610,-693,1.03,false],[-2591,-722,1.40,false],[-2598,-753,1.23,false]]) hubinTrees.push([x,z,s,palm]);
