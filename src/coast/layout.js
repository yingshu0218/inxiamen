import survey from './survey.json' with {type:'json'};
import north from './north.json' with {type:'json'};
import {wuyuanDeckRecord} from './wuyuan-layout.js';
export {survey};

// Match position, class, grade and heading so abutting cross streets survive.
const cells=new Map();
const layers={roads:[...survey.roads,...north.frontages],walks:survey.walks,bikes:survey.bikes,bridges:survey.bridges};
for (const [group, records] of Object.entries(layers)) {
  for (const {points} of records) for (let i=1; i<points.length; i++) {
    const [x,z]=points[i-1], dx=points[i][0]-x, dz=points[i][1]-z, len=Math.hypot(dx,dz);
    if (!len) continue;
    const item={x,z,dx:dx/len,dz:dz/len,len,group};
    for (let cx=Math.floor((Math.min(x,x+dx)-5)/100);cx<=Math.floor((Math.max(x,x+dx)+5)/100);cx++)
      for(let cz=Math.floor((Math.min(z,z+dz)-5)/100);cz<=Math.floor((Math.max(z,z+dz)+5)/100);cz++){
        const key=cx*2048+cz;
        if(!cells.has(key))cells.set(key,[]);
        cells.get(key).push(item);
      }
  }
}
export function replacesCoastStreet(x,z,dx,dz,bridge,kind) {
  return cells.get(Math.floor(x/100)*2048+Math.floor(z/100))?.some(s=>{
    if ((s.group==='bridges')!==bridge || (s.group==='roads')!==(kind>=2) || Math.abs(dx*s.dx+dz*s.dz)<.94) return false;
    const along=Math.max(0,Math.min(s.len,(x-s.x)*s.dx+(z-s.z)*s.dz));
    return Math.hypot(x-s.x-along*s.dx,z-s.z-along*s.dz)<(kind>=2?4.3:2.9);
  });
}

// The bulk map generalizes these complete records. Replace them by endpoint
// pairs so the old zebra and right-only geometry cannot survive at a sharp bend.
export function replacesNorthernRecord(kind,bridge,flat){
  if(wuyuanDeckRecord(kind,bridge,flat))return true;
  if(flat[0]<6000 || flat[0]>6500 || flat[1]<-5650 || flat[1]>-5210)return false;
  const same=(x,z,p)=>Math.hypot(x-p[0],z-p[1])<1.4;
  for(const [record,k,b] of [[north.mupu,-1,true],[north.formerCrossing,-1,false],[north.eastApproach,1,false]]){
    if(kind!==k || bridge!==b)continue;
    const a=record.points[0],e=record.points.at(-1);
    if((same(flat[0],flat[1],a)&&same(flat.at(-2),flat.at(-1),e)) ||
      (same(flat[0],flat[1],e)&&same(flat.at(-2),flat.at(-1),a)))return true;
  }
  return false;
}
