import {survey} from './layout.js';
import {inRing} from '../scenery-mesh.js';

const outline=survey.beaches.find(f=>f.id===164688343).points;
export function baichengGrade(coastDistance) {
  return {bounds:[-3050,4900,-2350,5500], grade(x,z,original){
    let ground=original;
    if(inRing(x,z,outline)){
      // Blend from sea level to the DEM berm over the mapped beach.
      const shore=Math.max(0,coastDistance(x,z)), blend=Math.min(1,shore/36);
      ground=Math.min(original,.55+.045*shore+(original-.55)*blend*blend);
    }
    // Local revetment at the new beach access. Preserve the upper walk grade.
    const dx=x+2612,dz=z-5075, along=.915*dx+.404*dz, seaward=-.404*dx+.915*dz;
    const side=Math.max(0,Math.min(1,(17-Math.abs(along))/7));
    const apron=Math.max(0,Math.min(1,seaward/5.5,(22-seaward)/10));
    return ground-1.6*side*apron;
  }};
}
