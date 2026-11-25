import survey from './winland-ifc-layout.json' with { type: 'json' };
import { surveyedFootprintFilter } from './survey-footprints.js';
import { litSurface, prism, signedArea } from './scenery-mesh.js';

export const replacesWinlandFootprint = surveyedFootprintFilter(survey);

function drawTower(batch, geo, index, datum, { ring, height, drift }) {
  const outline = signedArea(ring)<0 ? ring.toReversed() : ring;
  const centre = [0,1].map(i => outline.reduce((sum,p) => sum+p[i],0)/outline.length);
  const profile = [[0,1],[9,1],[36,.94],[75,.91],[120,.93],[height-7,1],[height,1]];
  const rows = profile.map(([level, scale]) => outline.map(([x,z]) => {
    const sway = level/height;
    return [centre[0]+(x-centre[0])*scale+drift[0]*sway,datum+level,
      centre[1]+(z-centre[1])*scale+drift[1]*sway];
  }));
  const ground = Math.min(datum,...outline.map(p=>geo.heightAt(...p))) - .4;
  prism(batch,outline,ground,datum,'#667a7c',null,litSurface.graniteFacing,.45);
  const facing = ['#51818c','#61939f','#548592','#6297a5'];
  let u = 0;
  for (let j=0;j<outline.length;j++) {
    const k=(j+1)%outline.length;
    const width=Math.hypot(outline[j][0]-outline[k][0],outline[j][1]-outline[k][1]);
    for (let i=1;i<rows.length;i++) {
      const a=rows[i-1][j], b=rows[i][j], c=rows[i][k], d=rows[i-1][k];
      const crown=i===rows.length-1;
      batch.face([a,b,c,d],crown?'#9eaeb0':facing[j%facing.length],
        crown?litSurface.crownMetal:litSurface.office,.56,
        [[u,a[1]-datum],[u,b[1]-datum],[u+width,c[1]-datum],[u+width,d[1]-datum]]);
    }
    u+=width;
  }
  const top = rows.at(-1);
  // Split the cap around its centre so short, nearly collinear edges stay visible.
  const capCentre = [centre[0]+drift[0],datum+height,centre[1]+drift[1]];
  for (let i=0;i<top.length;i++) batch.top([capCentre,top[i],top[(i+1)%top.length]],'#adb7b7',22);
  // Use the convex envelope of the ground and cap profiles for flight clearance.
  const clearanceRing = outline.map(([x,z]) => {
    const dx=x-centre[0], dz=z-centre[1];
    const distance=Math.hypot(dx,dz);
    return [x+dx*4/distance,z+dz*4/distance];
  });
  index.add(clearanceRing,datum+height);
}

export function buildWinlandIfc(batch, geo, lamps, index) {
  const elevations=survey.towers.flatMap(({ ring }) => ring.map(p=>geo.heightAt(...p))).sort((a,b)=>a-b);
  const datum=elevations[elevations.length>>1];
  for (const [i,{ ring, height }] of survey.podiums.entries()) {
    const upper=i%2===1;
    const top=datum+height+(upper?12:0);
    const bottom=upper?datum+12:Math.min(datum,...ring.map(p=>geo.heightAt(...p)))-.4;
    prism(batch,ring,bottom,top,upper?'#899a9b':'#637f82','#a8a99e',litSurface.shopfront,.43,0,22);
    index.add(ring,top);
  }
  for (const tower of survey.towers) drawTower(batch,geo,index,datum,tower);
  const { ring, bottom, height }=survey.bridge;
  prism(batch,ring,datum+bottom,datum+height,'#396d7d','#9aa7aa',litSurface.office,.81,0,22);
  index.add(ring,datum+height);
}
