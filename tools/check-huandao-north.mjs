import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group,Raycaster,Vector3,MeshStandardMaterial} from 'three';
import {addStreets} from '../src/scenery-streets.js';
import {LampBatch} from '../src/scenery-mesh.js';
import {airportFrame} from '../src/airport-layout.js';
import {runway} from '../src/route.js';
import {sections} from '../src/coast/geometry.js';
import {survey,replacesNorthernRecord} from '../src/coast/layout.js';
import {wuyuanLanes,wuyuanDeckRecord,westBridgeWalk} from '../src/coast/wuyuan-layout.js';
import north from '../src/coast/north.json' with {type:'json'};

const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const length=line=>line.slice(1).reduce((n,p,i)=>n+distance(line[i],p),0);
const round=n=>+n.toFixed(3);
function intersections(first,second){
  const points=[];
  for(let i=1;i<first.length;i++)for(let j=1;j<second.length;j++){
    const [ax,az]=first[i-1],[bx,bz]=second[j-1];
    const dx=first[i][0]-ax,dz=first[i][1]-az,ex=second[j][0]-bx,ez=second[j][1]-bz;
    const det=dx*ez-dz*ex;
    if(Math.abs(det)<1e-8)continue;
    const t=((bx-ax)*ez-(bz-az)*ex)/det,u=((bx-ax)*dz-(bz-az)*dx)/det;
    if(t>=0 && t<=1 && u>=0 && u<=1)points.push([ax+t*dx,az+t*dz]);
  }
  return points;
}

export function northernChecks(group,geo){
  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  const [roads,paths,details]=group.children.slice(-3);
  function hits(mesh,x,z){
    ray.ray.origin.set(x,150,z);
    return ray.intersectObject(mesh,true).map(hit=>hit.point.y);
  }
  const streets=JSON.parse(readFileSync('public/geo/urban-streets.json')).roads;
  const ends=r=>[r.slice(3,5),r.slice(-2)];
  const joined=streets.filter(r=>ends(r).some(p=>north.abutments.some(a=>distance(p,a.bridge)<.01)));
  const bridges=joined.filter(r=>r[1]&1);
  assert.equal(bridges.length,2); assert.equal(joined.length,4);
  const existing=new Group();
  const bridgeDeck=group.getObjectByName('五缘大桥 · 双幅连续桥面');
  const bridgeSteel=group.getObjectByName('五缘大桥 · 提篮拱与引桥');
  assert(bridgeDeck && bridgeSteel);
  let pierRays=0;
  function checkPierClearance(line,p,mesh,halfWidth){
    const frames=sections(line,3).filter(f=>Math.hypot(f.x-p[0],f.z-p[1])<23);
    for(const w of [-halfWidth,0,halfWidth]){
      let last;
      for(const f of frames){
        const x=f.x+w*f.nx,z=f.z+w*f.nz,y=hits(mesh,x,z)[0];
        const point=new Vector3(x,y+1.5,z);
        if(last && Number.isFinite(last.y) && Number.isFinite(y)){
          const delta=point.clone().sub(last);
          const probe=new Raycaster(last,delta.clone().normalize(),0,delta.length());
          assert.equal(probe.intersectObject(bridgeSteel).length,0,'pier on lower path at '+x+','+z);
          pierRays++;
        }
        last=point;
      }
    }
  }
  const westEnds=wuyuanLanes.map(l=>l.points[0]);
  const local=streets.filter(r=>ends(r).some(p=>westEnds.some(e=>distance(e,p)<.01))
    || r.slice(3).some((x,i)=>i%2===0 && x>4450 && x<4650 && r[i+4]>-7000 && r[i+4]<-6840));
  addStreets(existing,geo,
    [...new Set([...local,...joined])],new MeshStandardMaterial(),airportFrame(runway),new LampBatch(),[]);
  existing.updateMatrixWorld();group.updateMatrixWorld();
  const seams=north.abutments.map(a=>{
    const [x,z]=a.bridge,dx=x-a.next[0],dz=z-a.next[1],l=Math.hypot(dx,dz);
    let worst=0;
    for(const offset of [-6.55,-5,0,5,6.55]){
      const px=x-offset*dz/l,pz=z+offset*dx/l;
      const land=hits(roads,px+.15*dx/l,pz+.15*dz/l)[0], span=hits(bridgeDeck,px-.15*dx/l,pz-.15*dz/l)[0];
      assert(Number.isFinite(land) && Number.isFinite(span),'joint surface missing');
      worst=Math.max(worst,Math.abs(land-span));
    }
    assert(worst<.10,'joint step '+worst);
    const source=survey.roads.find(r=>r.id===a.road).points;
    return {center:a.bridge,sourceSnapM:round(distance(a.bridge,source[a.end==='first'?0:source.length-1])),
      sampledJointStepM:round(worst)};
  });
  const frontage=north.frontages[1].points,blue=survey.bikes.find(f=>f.id===129281162).points;
  const underpasses=[];
  for(const r of bridges){
    const axis=r.slice(3).filter((_,i)=>i%2===0).map((x,i)=>[x,r[4+i*2]]);
    for(const [name,line,mesh] of [['机动车掉头',frontage,roads],['步行骑行折返',blue,paths]]){
      const pts=intersections(line,axis);assert.equal(pts.length,1);
      const [x,z]=pts[0],top=hits(bridgeDeck,x,z)[0],road=hits(mesh,x,z)[0];
      const clearance=top-1.33-road;
      assert(clearance>(mesh===roads?3.0:2.1),name+' clearance '+clearance);
      checkPierClearance(line,[x,z],mesh,mesh===roads?3.1:1.4);
      underpasses.push({name,at:[round(x),round(z)],soffitClearanceM:round(clearance)});
    }
  }
  const fullCrossing=wuyuanLanes.map(lane=>{
    const [x,z]=lane.points[0],dx=x-lane.west[0],dz=z-lane.west[1],l=Math.hypot(dx,dz);
    let westStep=0;
    for(const w of [-8.75,-6,0,6,8.75]){
      const px=x-w*dz/l,pz=z+w*dx/l;
      const span=hits(bridgeDeck,px+.15*dx/l,pz+.15*dz/l)[0],land=hits(existing,px-.15*dx/l,pz-.15*dz/l)[0];
      assert(Number.isFinite(span)&&Number.isFinite(land),'west road seam');
      westStep=Math.max(westStep,Math.abs(span-land));
    }
    assert(westStep<.12,'west seam step '+westStep);
    let probes=0;
    for(const f of sections(lane.points,1).slice(1,-1))for(const w of [-5,0,5]){
      const y=hits(bridgeDeck,f.x+w*f.nx,f.z+w*f.nz)[0];
      assert(Number.isFinite(y)&&y>0,'gap at '+f.x+','+f.z);
      probes++;
    }
    return {way:lane.id,approachToApproachM:round(length(lane.points)),deckRayHits:probes,westJointStepM:round(westStep)};
  });
  const clipped=streets.filter(([k,flags,layer,...flat])=>wuyuanDeckRecord(k,Boolean(flags&1)||layer>0,flat));
  assert.equal(clipped.length,4);
  const westUnderpasses=[];
  for(const r of local.filter(r=>r[0]>=-1 && r[0]<4 && r[2]===0)){
    const axis=r.slice(3).filter((_,i)=>i%2===0).map((x,i)=>[x,r[4+i*2]]);
    for(const p of intersections(axis,wuyuanLanes[0].points)){
      const y=hits(existing,...p)[0],deckY=hits(bridgeDeck,...p)[0];
      if (!Number.isFinite(y))continue;
      const clearance=deckY-1.33-y;
      assert(clearance>3,'west underpass '+p+' '+clearance);
      checkPierClearance(axis,p,existing,r[0]>=2?3.1:2.1);
      westUnderpasses.push({at:p.map(round),clearanceM:round(clearance)});
    }
  }
  for(const lane of wuyuanLanes){
    const [p]=intersections(westBridgeWalk,lane.points);
    const clearance=hits(bridgeDeck,...p)[0]-1.33-hits(paths,...p)[0];
    assert(clearance>2.1);
    checkPierClearance(westBridgeWalk,p,paths,1.4);
    westUnderpasses.push({name:'西岸步骑线',at:p.map(round),clearanceM:round(clearance)});
  }
  assert(westUnderpasses.length>=6);
  const main=survey.roads.filter(r=>north.abutments.some(a=>a.road===r.id)).map(r=>r.points);
  const traffic=[...main,north.frontages[0].points,north.frontages[2].points];
  const mupu=traffic.map(line=>{
    const pts=intersections(line,north.mupu.points);assert.equal(pts.length,1);
    const [x,z]=pts[0], deck=hits(details,x,z)[0], asphalt=hits(roads,x,z)[0], gap=deck-.55-asphalt;
    assert(gap>4.5,'木浦净空 '+gap);
    return round(gap);
  });
  assert.equal(intersections(north.crossing,traffic[0]).length,1);
  assert.equal(intersections(north.crossing,traffic[1]).length,1);
  const removed=streets.filter(([k,flags,layer,...flat])=>replacesNorthernRecord(k,Boolean(flags&1)||layer>0,flat));
  assert.equal(removed.length,7);
  const connected=north.frontages.slice(1).map((f,i)=>distance(north.frontages[i].points.at(-1),f.points[0]));
  assert(connected.every(g=>g===0));
  const coast=sections(blue.slice(9),12).slice(1,-1);
  let supported=0;
  for(const f of coast){
    const levels=hits(paths,f.x,f.z);
    if(levels.some(height=>height<levels[0]-.02)||geo.heightAt(f.x,f.z)>.5)supported++;
  }
  assert.equal(supported,coast.length,'unsupported quay samples');
  let minSkin=Infinity,samples=0;
  for (const line of [...traffic,north.frontages[1].points,north.turnLeft]){
    for(const f of sections(line,10).slice(1,-1)){
      if(f.z> -1820 || f.x<5198)continue;
      const top=hits(roads,f.x,f.z)[0];assert(Number.isFinite(top),'missing at '+f.x+','+f.z);
      minSkin=Math.min(minSkin,top-geo.heightAt(f.x,f.z));samples++;
    }
  }
  assert(minSkin>0,'terrain penetrates road '+minSkin);
  return {seams,pierRays,fullCrossing,westUnderpasses,underpasses,mupuUnderdeckM:mupu,frontageJoinGapsM:connected,frontageKm:round(north.frontages.reduce((n,f)=>n+length(f.points),0)/1000),
    parkWalkM:round(length(north.parkWalk)),parkBranchM:round(length(north.parkBranch)),quayWalkSamples:supported,
    roadTerrainSamples:samples,minimumRoadSkinM:round(minSkin)};
}
