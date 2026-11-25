import { ShapeUtils, Vector2 } from 'three';
import survey from './torch-huizhi-layout.json' with { type: 'json' };
import { surveyedFootprintFilter } from './survey-footprints.js';
import { litSurface, prism } from './scenery-mesh.js';

export const replacesHuizhiFootprint = surveyedFootprintFilter(survey);
const paving = { forecourt:'#b2ada1',court:'#909998',island:'#687958' };

export function buildTorchHuizhi(batch, geo, lamps, index) {
  const { ring,height,outdoor }=survey.building;
  const ground=ring.map(p=>geo.heightAt(...p)).sort((a,b)=>a-b);
  const datum=ground[ground.length>>1], roof=datum+height;
  prism(batch,ring,ground[0]-.35,datum+3,'#8c7366',null,litSurface.shopfront,.41);
  prism(batch,ring,datum+3,roof,'#c6c4b8','#bbb6a3',1,.36,0,22);
  index.add(ring,roof);

  // West entrance panel follows the straight frontage between the two wings.
  const [south,north]=[ring.at(-1),ring[0]];
  const dx=north[0]-south[0], dz=north[1]-south[1], length=Math.hypot(dx,dz);
  const point=(t,y)=>[south[0]+t*dx+.16*dz/length,y,south[1]+t*dz-.16*dx/length];
  const lo=datum+6, hi=roof-.7, panelWidth=length*.36;
  batch.face([point(.32,lo),point(.32,hi),point(.68,hi),point(.68,lo)],
    '#a5846c',1,.34,[[0,0],[0,hi-lo],[panelWidth,hi-lo],[panelWidth,0]]);

  for (const panel of survey.solar) {
    // The photo and aerial image show roof racks. Group adjacent modules in strips.
    batch.top(panel.map(([x,z],i)=>[x,roof+(i<2?.85:.42),z]),'#4e6a7d',22,.28);
    index.add(panel,roof+.85);
  }
  for (const { ring:surface,kind } of outdoor) {
    const triangles=ShapeUtils.triangulateShape(surface.map(p=>new Vector2(...p)),[]);
    for (const triangle of triangles) batch.top(triangle.map(i => {
      const [x,z]=surface[i];
      return [x,geo.heightAt(x,z)+(kind==='island'?.55:.33),z];
    }),paving[kind],litSurface.railPlaza);
  }
}
