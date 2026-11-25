import {MeshBatch, box} from '../scenery-mesh.js';
import {survey} from './layout.js';
import {sections,pointAt,ribbon,wuyuanPaving} from './geometry.js';
import {pedestrianBridge,beachWorks,wavePlaza,sandBridge} from './landmarks.js';
import {abutmentSections,northernShore} from './northern.js';
import {buildWuyuanBridge,westWaterfront} from './wuyuan-bridge.js';

function carriageway(batch, road, terrain, lights) {
  const {frames,ground}=abutmentSections(road,terrain);
  const joint=frames.some(f=>f.jointBlend>0);
  if(joint){
    for(let i=1;i<frames.length;i++){
      const a=frames[i-1],b=frames[i];
      for(const [half,widen,lift,rise,tone] of [[4.6,2.2,.42,-.03,'#9d9d90'],[4.35,1.85,.46,-.044,'#666c69']]){
        const edge=(f,d)=>pointAt(f,d*(half+widen*f.jointBlend),ground,lift+rise*f.jointBlend);
        batch.top([edge(a,-1),edge(a,1),edge(b,1),edge(b,-1)],tone);
      }
    }
  } else {
    ribbon(batch,frames,-4.6,4.6,ground,'#9d9d90',.42);
    ribbon(batch,frames,-4.35,4.35,ground,'#666c69',.46);
  }
  let lastLight=-50;
  for(let i=1;i<frames.length;i++){
    const a=frames[i-1],b=frames[i];
    // Keep painted dashes in longitudinal metres through way splits.
    if(Math.floor(a.distance/12)!==Math.floor(b.distance/12)){
      const end={...a,x:a.x+3*a.nz,z:a.z-3*a.nx};
      ribbon(batch,[a,end],-.08,.08,ground,'#c8c4ad',.50);
    }
    if(b.distance-lastLight>62){
      lights.add(...pointAt(b,-4.6,ground,6),'#ffdb9b',1.15);
      lastLight=b.distance;
    }
  }
}

function coastalWalk(batch, feature, ground, lights) {
  const frames=sections(feature.points,5);
  const timber=feature.id===231451787 || feature.id===231452218;
  const surface=(x,z)=>Math.max(1.25,ground(x,z)+.54);
  ribbon(batch,frames,-1.65,1.65,surface,timber?'#998273':'#c4b7a2');
  // The 204 m closure follows the fort's western revetment. Chainage is estimated.
  if(feature.id===1444709497){
    const works=frames.filter(f=>f.distance>=120 && f.distance<=324);
    for(let i=1;i<works.length;i++){
      const a=works[i-1],b=works[i];
      batch.face([pointAt(a,-1.5,surface),pointAt(a,-1.5,surface,1.85),
        pointAt(b,-1.5,surface,1.85),pointAt(b,-1.5,surface)],'#a6b5af');
    }
    for(const f of [works[0],works.at(-1)]){
      const [x,y,z]=pointAt(f,0,surface);
      box(batch,x,z,3.6,.27,y,y+1.85,'#a8b5b0','#bdc4b9',0,0,Math.atan2(f.nz,f.nx));
    }
  }
  if(feature.id===231451787){
    // Closest chainage of the mapped coastal walk to the Jiali site. The exact
    // limits of the 107.74 m reopening are not published.
    const restored=frames.filter(f=>Math.abs(f.distance-1942.6)<53.87);
    ribbon(batch,restored,-1.65,1.65,surface,'#b8b4a8',.045);
    ribbon(batch,restored,1.65,2.30,surface,'#999786',-.20);
  }
  if(timber){
    let previous;
    for(const f of frames){
      const a=pointAt(f,1.6,surface,.78),b=pointAt(f,1.6,surface,1.02);
      const granite=feature.id===231451787 && Math.abs(f.distance-1942.6)<53.87;
      if(previous) batch.face([...previous,b,a],granite?'#b9b9af':'#8a7665');
      box(batch,a[0],a[2],.13,.13,a[1]-.79,b[1]+.06,'#816f60','#938575');
      previous=[a,b];
    }
  }
  if(feature.id===1444709497)for(let i=0;i<frames.length;i+=8){
    if(frames[i].distance<120)lights.add(...pointAt(frames[i],-1.4,surface,2.6),'#ffe0aa',.8);
  }
}

export function buildHuandao(group,geo,material,lights,obstacles) {
  const ground=(x,z)=>Math.max(.89,geo.heightAt(x,z));
  const shoreGround=(x,z)=>{
    const blend=Math.min(1,Math.max(0,(5530-x)/55),Math.max(0,(z+7100)/40),Math.max(0,(-6320-z)/40));
    const base=ground(x,z);
    if(!blend)return base;
    return base+blend*(Math.max(.89,geo.islandSurfaceHeightAt(x,z))-base);
  };
  const roads=new MeshBatch(),paths=new MeshBatch(),details=new MeshBatch();
  for(const road of survey.roads)carriageway(roads,road,ground,lights);
  for(const {center:[x,z],along} of survey.markedCrossings){
    const nx=-Math.sin(along),nz=Math.cos(along);
    for(let stripe=-4;stripe<=4;stripe++){
      const cx=x+stripe*.9*nx,cz=z+stripe*.9*nz;
      const ends=[-1.8,1.8].map(d=>({x:cx+d*nz,z:cz-d*nx,nx,nz}));
      ribbon(roads,ends,-.22,.22,ground,'#d2ccbc',.58);
    }
  }
  for(const walk of survey.walks)coastalWalk(paths,walk,ground,lights);
  for(const bike of survey.bikes){
    const frames=sections(bike.points);
    if(bike.id===129281162)wuyuanPaving(paths,frames,-1.8,1.8,shoreGround,'#7293a6',.51);
    else ribbon(paths,frames,-1.8,1.8,ground,'#aba18e',.51);
  }
  // Landward beach margins guide the unsurveyed portion of the Huangcuo trail.
  const beach=survey.beaches.find(f=>f.id===279531052).points;
  const walk=sections([[1956.1,4850],[2019,4821],...beach.slice(54,89)]);
  ribbon(paths,walk,-1.5,1.5,ground,'#c6b69a',.48);
  // The marina inlet and the sand-bridge construction site interrupt the beach path.
  // Trace each visible approach independently so no path crosses the harbour water.
  const guanyinWalks=[
    [[7207,-663],[7167,-718],[7136,-815],[7103,-949],[7066,-1004],
      [7054,-1102],[7038,-1190],[7051,-1288],[7042,-1366],[7022,-1432],[7014,-1589]],
    [[7079,-2271],[7070,-2342],[7056,-2454],[7064,-2555],[7056,-2658],
      [7044,-2750],[7040,-2847],[7039,-2921],[7032,-3032],[7028,-3092]],
  ];
  for(const line of guanyinWalks) ribbon(paths,sections(line),-1.7,1.7,ground,'#c1b29a',.51);
  for(const bridge of survey.bridges)pedestrianBridge(details,bridge,ground,lights,obstacles);
  beachWorks(details,ground,lights);
  const sign=wavePlaza(group,details,ground);
  sandBridge(details,obstacles);
  northernShore(roads,paths,details,ground,obstacles,shoreGround);
  westWaterfront(paths,details,shoreGround);
  buildWuyuanBridge(group,ground,material,lights,obstacles);
  roads.finish(group,material,'环岛南路、环岛东路 · 分幅机动车道');
  paths.finish(group,material,'白城至五缘湾 · 滨海步道与骑行线');
  details.finish(group,material,'环岛路沿线天桥、海浪平台、观音山施工段与五通岸墙');
  return sign;
}
