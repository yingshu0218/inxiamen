import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MeshBatch,LampBatch,ObstacleIndex,inRing} from '../../../../src/scenery-mesh.js';
import {elevationField} from '../../../../src/geography.js';
import {buildGulangyu} from '../../../../src/landmark-gulangyu.js';
import {buildIslandHeritage} from '../../../../src/gulangyu-heritage.js';
import {buildIslandWharves} from '../../../../src/gulangyu-wharves.js';
import {plan,huangFrame,replacesGardenBuilding} from '../../../../src/gulangyu-layout.js';
import {landmarkReserved} from '../../../../src/scenery-landmarks.js';
import {decodeCityLayout} from '../../../../src/city-layout.js';
import {islandViews,stations} from '../../../../src/route.js';

const file=p=>readFileSync(new URL('../../../../public/'+p,import.meta.url));
const meta=JSON.parse(file('geo/manifest.json')).gulangyuDetail, pixels=file('geo/'+meta.file);
const rawHeightAt=elevationField(meta,new Int16Array(pixels.buffer,pixels.byteOffset,pixels.length/2),meta.metresPerUnit);
const geo={rawHeightAt,heightAt:(x,z)=>Math.max(0,rawHeightAt(x,z))};
const lamps=new LampBatch(),obstacles=new ObstacleIndex(),triangles={},land=new MeshBatch();
for(const build of [buildGulangyu,buildIslandHeritage,buildIslandWharves]){
  const batch=build===buildGulangyu?land:new MeshBatch();
  build(batch,geo,lamps,obstacles,[],[]);
  for(const a of [batch.positions,batch.normals,batch.uvs,batch.surfaces])assert.ok(a.every(Number.isFinite));
  assert.ok(batch.indices.every(i=>i>=0&&i<batch.positions.length/3));
  triangles[build.name]=batch.indices.length/3;
}
// Intersect actual generated faces at each test coordinate, including submerged solids.
function levels(x,z){
  const p=land.positions, hits=[];
  for(let i=0;i<land.indices.length;i+=3){
    const [a,b,c]=land.indices.slice(i,i+3).map(j=>3*j);
    const ax=p[a],az=p[a+2], bx=p[b]-ax,bz=p[b+2]-az,cx=p[c]-ax,cz=p[c+2]-az;
    const det=bx*cz-cx*bz;
    if(Math.abs(det)<1e-6)continue;
    const u=((x-ax)*cz-(z-az)*cx)/det,v=(bx*(z-az)-bz*(x-ax))/det;
    if(u>=-.000001&&v>=-.000001&&u+v<1.000001)hits.push(p[a+1]+u*(p[b+1]-p[a+1])+v*(p[c+1]-p[a+1]));
  }
  return [...new Set(hits.map(h=>+h.toFixed(2)))].sort((a,b)=>a-b);
}
const points={wallWest:[-6209.6,4222.4],wallEast:[-6155.3,4233.7],westGate:[-6178.1,4195.8],
  northBridge:[-6152,4234],archSpan:[-6139.5,4278],midPier:[-6148.99,4287.03],
  moonRoom:[-6162.3,4316.4],southLanding:[-6114.15,4332.17]};
const shore=Object.fromEntries(Object.entries(points).map(([id,p])=>[id,{xz:p,ground:+rawHeightAt(...p).toFixed(2),meshY:levels(...p)}]));
assert.ok(shore.archSpan.meshY.length>=2&&shore.archSpan.meshY[0]>.12);
const [px,pz]=points.midPier, feet=[];
for(let i=0;i<land.positions.length;i+=3){
  const [x,y,z]=land.positions.slice(i,i+3);
  if(Math.hypot(x-px,z-pz)<1.2)feet.push(y);
}
shore.midPier.lowestVertex=+Math.min(...feet).toFixed(2);
assert.ok(shore.midPier.lowestVertex<shore.midPier.ground);
assert.ok(shore.moonRoom.meshY.at(-1)>2.4);
assert.ok(shore.wallWest.meshY.length&&shore.wallEast.meshY.length&&shore.southLanding.meshY.length);
const raw=file('geo/city-layout.bin'),city=decodeCityLayout(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
const centres=city.map(({rings:[ring]})=>ring.reduce(([x,z],p)=>[x+p[0]/ring.length,z+p[1]/ring.length],[0,0]));
const dedup={};
for(const [name,rings] of [['huangVilla',[plan.huangVilla]],['westGate',[plan.gardenWestGate,...plan.gardenGateWings]],['haitian',plan.haitian]]){
  const base=centres.filter(p=>rings.some(r=>inRing(...p,r)));
  const surviving=base.filter(p=>!landmarkReserved(...p));
  assert.equal(surviving.length,0);
  dedup[name]={base:base.length,surviving:surviving.length};
}
const gateMatches=city.filter(b=>replacesGardenBuilding(b.rings[0]));
assert.equal(gateMatches.length,6);
dedup.westGate={base:gateMatches.length,surviving:0,byFootprintOnly:gateMatches.filter(b=>{
  const ring=b.rings[0];
  return !landmarkReserved(...ring.reduce(([x,z],p)=>[x+p[0]/ring.length,z+p[1]/ring.length],[0,0]));
}).length};
assert.equal(dedup.westGate.byFootprintOnly,1);
const tests=['island','sanqiutian','rock','rock-profile','huangrongyuan','bagua-gallery','garden','garden-shore','garden-bridge','neicuoao-roofs','bishan-lane'];
const names=Object.fromEntries(tests.map(id=>{
  const station=[...stations,...islandViews].filter(s=>s.id===id);assert.equal(station.length,1);
  return [id,station[0].name];
}));
console.log(JSON.stringify({date:'2026-11-25',terrainSHA256:createHash('sha256').update(pixels).digest('hex'),triangles,dedup,
  villaCentre:huangFrame.center,villaObstacleY:obstacles.heightAt(...huangFrame.center),shore,names},null,2));
