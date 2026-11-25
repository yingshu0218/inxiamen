import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Group, MeshBasicMaterial, PerspectiveCamera, Raycaster, Vector3 } from 'three';
import { airportFrame } from '../src/airport-layout.js';
import { buildCity, decodeCityLayout } from '../src/city-layout.js';
import { neicuoaoGrade } from '../src/gulangyu-neighborhoods.js';
import { elevationField } from '../src/geography.js';
import { gradeNeicuoaoEntrance, inIslandBounds, plan } from '../src/gulangyu-layout.js';
import { buildGulangyu } from '../src/landmark-gulangyu.js';
import { buildIslandHeritage } from '../src/gulangyu-heritage.js';
import { buildIslandWharves } from '../src/gulangyu-wharves.js';
import { buildSunlightTemple } from '../src/landmark-sunlight-temple.js';
import { neicuoaoFootprintKey, neicuoaoImageHouses, neicuoaoPieces, neicuoaoSurvey } from '../src/gulangyu-neicuoao.js';
import { runway, tourStops } from '../src/route.js';
import { landmarkReserved } from '../src/scenery-landmarks.js';
import { inRing, LampBatch, MeshBatch, ObstacleIndex, signedArea } from '../src/scenery-mesh.js';

const read = path => fs.readFileSync(new URL('../'+path, import.meta.url));
const arrayBuffer = buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset+buffer.length);
const input = read('public/geo/city-layout.bin');
const detail = JSON.parse(read('public/geo/manifest.json')).gulangyuDetail;
const island = JSON.parse(read('public/geo/islands.json')).gulangyu;
const samples = new Int16Array(arrayBuffer(read('public/geo/'+detail.file)));
gradeNeicuoaoEntrance(detail,samples);
const rawHeightAt = elevationField(detail,samples,detail.metresPerUnit);
const heightAt = (x,z) => Math.max(0,rawHeightAt(x,z));
const geo = { heightAt,rawHeightAt,islands:{gulangyu:island} };
const buildings = decodeCityLayout(arrayBuffer(input));
const centre = ring => [0,1].map(i => ring.reduce((sum,p) => sum+p[i],0)/ring.length);
const selected = [];
const matched = new Map();
const before = [];
const after = [];
let offset = 8;
for (const building of buildings) {
  const end = offset+8+building.rings.reduce((size,ring)=>size+2+4*ring.length,0);
  const [ring] = building.rings;
  const [x,z] = centre(ring);
  if (inIslandBounds(x,z)) selected.push(input.subarray(offset,end));
  offset = end;
  const pieces = neicuoaoPieces(building);
  if (!pieces) continue;
  const key = neicuoaoFootprintKey(ring);
  matched.set(key,(matched.get(key)??0)+1);
  before.push(building);
  after.push(...pieces);
}
assert.equal(offset,input.length);
for (const record of neicuoaoSurvey.buildings) assert.equal(matched.get(record.match),1,`OSM ${record.osm}`);
after.push(...neicuoaoImageHouses);
const header = Buffer.alloc(8);
header.write('XMC1');
header.writeUInt32LE(selected.length,4);
const scene = new Group();
const index = new ObstacleIndex();
const material = new MeshBasicMaterial();
const batch = new MeshBatch(), lamps=new LampBatch();
buildGulangyu(batch,geo,lamps,index,[],[]);
buildSunlightTemple(batch,geo,lamps,index);
buildIslandHeritage(batch,geo,lamps,index);
buildIslandWharves(batch,geo,lamps,index,[]);
const landmarks = batch.finish(scene,material,'鼓浪屿手工地标');
assert(landmarks.geometry.index.count>0);
for (const site of [plan.trinity,plan.catholic,plan.haitian[0]]) {
  const point = centre(site);
  assert(index.heightAt(...point)>heightAt(...point)+2);
}
await buildCity(scene,geo,airportFrame(runway),material,index,
  arrayBuffer(Buffer.concat([header,...selected])));
scene.updateMatrixWorld(true);
assert(scene.children.length && scene.children.every(mesh =>
  mesh.geometry.attributes.position.array.every(Number.isFinite)));

const obstacleSamples = after.map(({rings:[ring],neicuoaoRoof:profile}) => {
  const p = centre(ring);
  // Non-convex rings can have their average outside the wall.
  const target = inRing(...p,ring)?p:ring[0].map((v,i)=>v*.97+p[i]*.03);
  const {eaves,grade} = neicuoaoGrade(ring,heightAt,profile[1]);
  const roof = eaves+profile[2];
  const hit = index.heightAt(...target);
  const wallSamples = samplesAlong([...ring,ring[0]],1);
  assert(![p,...wallSamples].some(point=>landmarkReserved(...point)),`Landmark at ${p}`);
  assert(hit >= roof-.01,`Missing obstacle at ${p}: ${hit} vs ${roof}`);
  return {ring,target,roof:+roof.toFixed(2),grade};
});

function samplesAlong(path,step) {
  const points = [];
  for (let i=1;i<path.length;i++) {
    const a=path[i-1],b=path[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step);
    for(let k=0;k<n;k++)points.push(a.map((v,j)=>v+(b[j]-v)*k/n));
  }
  points.push(path.at(-1));
  return points;
}
const streets = neicuoaoSurvey.streets.map(({osm,paths})=>{
  const points = paths.flatMap(path=>samplesAlong(path,.5));
  const block = points.filter(p=>after.some(({rings:[ring]})=>inRing(...p,ring)));
  assert(!block.length,`Street ${osm} blocked at ${block[0]}`);
  const standingObstacles = points.filter(p=>index.heightAt(...p)>heightAt(...p)+1.6).length;
  const rise = points.map(p=>heightAt(...p));
  return {osm,samples:points.length,standingObstacles,low:+Math.min(...rise).toFixed(2),high:+Math.max(...rise).toFixed(2)};
});

const cameras = tourStops.filter(s=>['neicuoao-roofs','bishan-lane'].includes(s.id)).flatMap(s =>
  [[s.view,16/9],[s.portraitView??s.view,390/844]].map(([view,aspect])=>{
    const {x,y,z}=view;
    const portrait=Math.min(1,Math.max(0,(.98-aspect)/.5));
    const camera=new PerspectiveCamera(s.fov+portrait*(s.portraitFovBoost??14),aspect,0.1,600);
    camera.position.set(x,y,z);
    camera.lookAt(s.x,s.focusHeight,s.z);
    camera.updateMatrixWorld();
    const clearance=y-Math.max(heightAt(x,z),index.heightAt(x,z));
    assert(clearance>1.75,`Camera ${s.id} blocked`);
    let inFrame=0,visible=0;
    for(const {target:[u,v],roof} of obstacleSamples) {
      const target=new Vector3(u,roof+.5,v);
      const ndc=target.clone().project(camera);
      if(Math.abs(ndc.x)>1 || Math.abs(ndc.y)>1 || Math.abs(ndc.z)>1)continue;
      inFrame++;
      const ray=target.sub(camera.position);
      if(!new Raycaster(camera.position,ray.clone().normalize(),.1,ray.length()-1.2)
        .intersectObjects(scene.children).length)visible++;
    }
    return {id:s.id,aspect:+aspect.toFixed(2),clearance:+clearance.toFixed(2),inFrame,visible};
  }));
const sumArea = rows=>rows.reduce((sum,{rings:[ring,...holes]})=>
  sum+Math.abs(signedArea(ring))-holes.reduce((area,hole)=>area+Math.abs(signedArea(hole)),0),0);
const grade = obstacleSamples.map(s=>s.grade);
const counts = Object.fromEntries(['flat','gable','hip'].map(form=>[form,after.filter(b=>b.neicuoaoRoof[3]===form).length]));
const islandData = buildings.filter(({rings:[ring]})=>inRing(...centre(ring),island));
const stats = {islandLandmarkTriangles:landmarks.geometry.index.count/3, islandRecords:islandData.length, landmarkExclusions:islandData.filter(({rings:[ring]})=>landmarkReserved(...centre(ring))).length,
  before:before.length, after:after.length, imageOnly:neicuoaoImageHouses.length,
  originalMappedHeights:before.filter(b=>b.mappedHeight).length, roofCounts:counts,
  areaBefore:+sumArea(before).toFixed(1), areaAfter:+sumArea(after).toFixed(1), streetSamples:streets.reduce((n,s)=>n+s.samples,0),
  foundationGradeMax:+Math.max(...grade).toFixed(2), streets, cameras};
console.log(JSON.stringify(stats,null,2));

if (process.argv[2]) {
  const label = '© OpenStreetMap contributors · Vantor LG04, 2025-03-20 · north up';
  function panel(rows,heading,xPos) {
    const at = ([x,z])=>[+(xPos+(x+6750)*2.1).toFixed(2),+(68+(z-3405)*2.1).toFixed(2)].join(',');
    const poly=(ring,props)=>`<polygon points="${ring.map(at).join(' ')}" ${props}/>`;
    const roads=neicuoaoSurvey.streets.flatMap(s=>s.paths).map(path=>
      `<polyline points="${path.map(at).join(' ')}" fill="none" stroke="#78958a" stroke-width="3.4"/>`).join('');
    const roofs=rows.map(({rings:[ring],neicuoaoRoof:roof})=>{
      const tones={flat:'#b7babe',hip:'#c2735a',gable:'#a58966'};
      const fill=roof?tones[roof[3]]:'#b87c65';
      if(!roof || !roof[2])return poly(ring,`fill="${fill}" stroke="#5e5650"`);
      const [x,z]=centre(ring), a=roof[0]*Math.PI/180;
      const dx=Math.cos(a), dz=Math.sin(a), width=Math.sqrt(Math.abs(signedArea(ring)))*.28;
      return poly(ring,`fill="${fill}" stroke="#5e5650"`)+
        `<line x1="${at([x-dx*width,z-dz*width]).split(',')[0]}" y1="${at([x-dx*width,z-dz*width]).split(',')[1]}" x2="${at([x+dx*width,z+dz*width]).split(',')[0]}" y2="${at([x+dx*width,z+dz*width]).split(',')[1]}" stroke="#fff5dc" />`;
    }).join('');
    return `<text x="${xPos}" y="54" font-size="20">${heading}</text>`+
      poly(neicuoaoSurvey.bounds,'fill="#e6e4da" stroke="#c5c9be"')+roads+roofs+
      `<path d="M${xPos+10} 453 h105" stroke="#3d5853" stroke-width="2"/><text x="${xPos+10}" y="474" font-size="13">50 m</text>`;
  }
  fs.writeFileSync(process.argv[2],`<svg xmlns="http://www.w3.org/2000/svg" width="1090" height="532" viewBox="0 0 1090 532"><rect width="1090" height="532" fill="#f6f3eb"/><g font-family="sans-serif" fill="#293b39"><text x="30" y="27" font-size="19">内厝澳路南段 / 笔山洞西侧坡巷</text>${panel(before,`原有 ${before.length} 条建筑轮廓`,30)}${panel(after,`复核后 ${after.length} 个屋面体量`,563)}<text x="30" y="509" font-size="13">${label}</text><text x="563" y="509" font-size="13">坡屋顶脊线示意 · 灰色为平顶 · 绿色为步行街巷</text></g></svg>\n`);
}
