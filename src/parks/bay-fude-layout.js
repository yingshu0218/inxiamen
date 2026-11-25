import bay from './bay.json' with { type: 'json' };
import { inRing } from '../scenery-mesh.js';

export { bay };
export const inBay=(x,z)=>x>=-5654 && x<=-5238 && z>=103 && z<=772 && inRing(x,z,bay.boundary);
const clamp=t=>Math.max(0,Math.min(1,t));
export const fudeCourt=(x,z)=>x>=-2064 && x<=-1860 && z>=-2598 && z<=-2556;
export function siteReserved(x,z){
  if(fudeCourt(x,z))return true;
  if(!inBay(x,z))return false;
  return z<500 || (x>-5465 && z<669 && x<-5340);
}
export function hillRadius(x,z){
  const dx=x+5335,dz=z-239;
  return Math.hypot((dx*.82+dz*.57)/30,(dz*.82-dx*.57)/43);
}
export const landscapeGrades=[
  {bounds:[-5700,50,-5150,850],grade(x,z,original){
    if(!inBay(x,z))return original;
    const r=hillRadius(x,z);
    const hill=9*Math.max(0,1-r*r)**1.35;
    const blend=clamp((1.25-r)*4);
    // Small north-garden knoll, with a lower platform between it and the promenade.
    if(blend)return original+(4.65+hill-original)*blend;
    const garden=clamp((x+5450)/12)*clamp((-5295-x)/12)*clamp((z-482)/12)*clamp((690-z)/12);
    if(garden)return original+(5.6-original)*garden;
    const axisZ=461-(x+5300)*.06;
    const axial=clamp((26-Math.abs(z-axisZ))/11)*clamp((x+5570)/12)*clamp((-5240-x)/15);
    return original+(5.05-original)*axial;
  }},
  {bounds:[-2150,-2700,-1750,-2450],grade(x,z,original){
    const dz=Math.abs(z+2577),w=clamp((30-dz)/10)*clamp((x+2079)/20)*clamp((-1848-x)/14);
    const landing=93.5+clamp((x+1930)/30)*4.1;
    return original+w*(landing-original);
  }},
];
