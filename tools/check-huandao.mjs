// Run from the repository root with Node and Python 3 + Pillow.
import assert from 'node:assert/strict';
import {DoubleSide,Group,MeshStandardMaterial} from 'three';
import {loadMainlandRoadGeography} from './mainland-road-geography.mjs';
import {Flight} from '../src/flight.js';
import {nearestRoute,routePoint,tourStops} from '../src/route.js';
import {ObstacleIndex,LampBatch} from '../src/scenery-mesh.js';
import {buildHuandao} from '../src/coast/scenery.js';
import {coastalFlight,coastalViews} from '../src/coast/views.js';
import northData from '../src/coast/north.json' with {type:'json'};
import {lowerPavingChecks} from './check-wuyuan-paving.mjs';
import {northernChecks} from './check-huandao-north.mjs';
import {survey} from '../src/coast/layout.js';

const geo=loadMainlandRoadGeography();
const group=new Group(), obstacles=new ObstacleIndex();
globalThis.document={createElement:()=>({getContext:()=>({fillText(){}})})}; // Sign rasterization belongs to browser QA.
buildHuandao(group,geo,new MeshStandardMaterial({side:DoubleSide}),new LampBatch(),obstacles);
const meshes=group.children.map(mesh=>{
  const positions=mesh.geometry.attributes.position;
  assert(positions.array.every(Number.isFinite));
  return {name:mesh.name,vertices:positions.count};
});
const start=tourStops.find(s=>s.id==='huandao');
const end=nearestRoute(...coastalFlight.at(-1).slice(0,2),start.distance,start.distance+25000);
assert(end.gap<1);
const flight=new Flight(geo,{obstacleHeight:(x,z)=>obstacles.heightAt(x,z)},1.2);
flight.spawnAt(start.distance);
let minClearance=Infinity, assists=0;
const input={pitch:0,roll:0,throttle:0,brake:false};
while(flight.progress<end.distance && flight.elapsed<650){
  flight.update(1/30,input,{x:0,z:0});
  minClearance=Math.min(minClearance,flight.altitude-flight.surface(flight.x,flight.z));
  if(flight.assisted)assists++;
}
assert(flight.progress>=end.distance && flight.autopilot && !assists);
const views=coastalViews.map(site=>{
  assert(tourStops.some(s=>s.id===site.id));
  const {x,y,z}=site.view, clearance=y-flight.surface(x,z);
  assert(clearance>1);
  return {id:site.id,clearanceM:Math.round(clearance)};
});
const lengths=survey.roads.map(r=>r.points.slice(1).reduce((sum,[x,z],i)=>sum+Math.hypot(x-r.points[i][0],z-r.points[i][1]),0));
const links=survey.roads.flatMap(({points})=>[points[0],points.at(-1)]).map(p=>p.join(','));
const ends=links.filter(p=>links.indexOf(p)===links.lastIndexOf(p));
assert.equal(ends.length,4);
assert(Math.hypot(routePoint(start.distance).x+2950,routePoint(start.distance).z-5270)<.01);
console.log(JSON.stringify({carriageways:survey.roads.length,meanDirectionKm:+(lengths.reduce((a,b)=>a+b)/2000).toFixed(2),
  roadEnds:ends,beachPolygons:survey.beaches.length+Number(northData.sand.length>2),flightKm:+((end.distance-start.distance)/1000).toFixed(2),
  elapsedSeconds:Math.round(flight.elapsed),minimumClearanceM:Math.round(minClearance),assists,views,meshes,north:northernChecks(group,geo),lowerPaving:lowerPavingChecks(group,geo)},null,2));
