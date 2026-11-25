import { cylinder, groundY, litSurface, prism } from './scenery-mesh.js';
import { localFrame, rect, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { alongFrame, offset, ribbon } from './old-town-layout.js';
import { buildHubinFrontage } from './hubin-transit.js';
import { avenue, nearBusStop, parkConnection, eastRoad, footbridge, jinqiao, plan, shoreWalk } from './hubin-layout.js';

const granite='#b4b1a2', kerb='#c5c1b3', asphalt='#616865', steel='#8a9692';
const clamp01=v=>Math.min(1,Math.max(0,v));
function streetlamp(batch,lights,p,base,side,tall=true){
  const xy=alongFrame(p), h=tall?8.6:3.85, arm=tall?1.9:.42;
  const pos=(d,dy)=>up(xy(0,d),base+dy);
  cylinder(batch,p.x,p.z,base,base+.35,tall?.24:.15,tall?.19:.10,steel,7);
  pathTube(batch,[pos(0,.22),pos(0,h-.8),pos(-side*arm*.34,h-.21),pos(-side*arm,h)],tall?.115:.072,steel,6);
  prism(batch,rect(xy,0,-side*arm,.48,tall?1.04:.52),base+h-.085,base+h+.11,'#dbd7bf','#b0b5a9',litSurface.portico);
  const [x,z]=xy(0,-side*arm);
  lights.add(x,base+h-.14,z,tall?'#ffe1ae':'#e5c390',tall?1.55:.72);
}

const grade=(geo,x,z)=>Math.max(1.1,groundY(geo,x,z))+.34;
function bridgeLevel(s) {
  const [start,end]=plan.bridge;
  return 4.75+1.14*Math.sin(Math.PI*clamp01((s-start)/(end-start)));
}
function roadHeight(geo,path,x,z,s) {
  const land=grade(geo,x,z);
  if(path!==eastRoad) return land;
  const [a,b]=plan.bridge, distance=Math.max(a-s,s-b,0);
  const f=clamp01(1-distance/43);
  return land+(bridgeLevel(s)-land)*f*f*(3-2*f);
}

function crossingStripes(batch,path,s,geo,span){
  const p=path.sample(s), xy=alongFrame(p);
  for(let d=-span+.42;d<span;d+=1.0){
    const ring=rect(xy,0,d,3.55,.53);
    batch.top(ring.map(pt=>up(pt,roadHeight(geo,path,...pt,s)+.118)),'#dedbd0');
  }
}

function boulevard(batch,geo,lights,path,junctions,name) {
  const rows=path.sections(5.5), broad=path===avenue, median=broad?1.05:.80, halfLane=5.32;
  const edge=median+2*halfLane, sidewalk=broad?3.6:2.5;
  const y=(x,z,s)=>roadHeight(geo,path,x,z,s);
  const roadBreak=(s,margin)=>junctions.some(j=>Math.abs(s-j)<margin);
  // Use the entire crossing area as asphalt. Kerbs and lane paint end before
  // the junction, with transverse stripes on all four approaches.
  ribbon(batch,rows,-edge,edge,(x,z,s)=>y(x,z,s)+(broad?.025:0),asphalt);
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1], b=rows[i], mid=(a.s+b.s)/2;
    if(roadBreak(mid,14))continue;
    const part=[a,b], shift=median+halfLane;
    ribbon(batch,part,-median,median,(x,z,s)=>y(x,z,s)+.137,kerb);
    if(median>1)ribbon(batch,part,-.72,.72,(x,z,s)=>y(x,z,s)+.15,'#818c68');
    for(const sign of [-1,1]){
      const center=part.map(p=>({...p,x:p.x+sign*shift*p.rx,z:p.z+sign*shift*p.rz}));
      ribbon(batch,center,-halfLane,halfLane,(x,z,s)=>y(x,z,s)+.071,asphalt,litSurface.carriageway);
      ribbon(batch,part,sign*edge,sign*(edge+sidewalk),(x,z,s)=>y(x,z,s)+.203,granite,17);
      ribbon(batch,part,sign*edge,sign*(edge+.26),(x,z,s)=>y(x,z,s)+.216,kerb);
    }
  }
  for(const j of junctions){
    for(const side of [-1,1]) crossingStripes(batch,path,j+16.5*side,geo,edge-.22);
  }
  for(let s=20;s<path.length-9;s+=37.3){
    if(roadBreak(s,22))continue;
    for(const side of [-1,1]){
      if(broad && nearBusStop(s,side))continue;
      const p=path.sample(s), [x,z]=offset(p,side*(edge+1.18));
      streetlamp(batch,lights,{...p,x,z},y(x,z,s)+.19,side);
    }
  }
  function step(t){
    const s=clamp01(t)*path.length, p=path.sample(s);
    return {...p,s,rx:-p.uz,rz:p.ux};
  }
  function at(p,lateral,extra){
    const d=Math.sign(lateral)*(median+(Math.abs(lateral)>4.5?(broad?2.04:8.82):5.32));
    const x=p.x+p.rx*d, z=p.z+p.rz*d;
    return [x,y(x,z,p.s)+.07+extra,z];
  }
  return {name,surfaceStreet:true,length:path.length,step,at,center:step(.5)};
}

function bridgeStructure(batch,lights,obstacles,path,lo,hi,half,level,park=false){
  const bays=park?5:6, sides=[-1,1], depth=park?.72:1.28, topRail=park?1.04:1.22;
  const pt=(s,d,h=0)=>up(offset(path.sample(s),d),level(s)+h);
  for(let j=0;j<bays;j++){
    const a=lo+(hi-lo)*j/bays,b=lo+(hi-lo)*(j+1)/bays;
    if(park)batch.top([pt(a,-half),pt(a,half),pt(b,half),pt(b,-half)],'#b3ac96',17);
    for(const side of sides){
      const d=side*half, h=park?0:.20;
      batch.face([pt(a,d,h),pt(b,d,h),pt(b,d,-depth),pt(a,d,-depth)],'#a5aca4',litSurface.portico);
      pathTube(batch,[pt(a,d,topRail),pt(b,d,topRail)],park?.095:.14,park?'#877c66':'#cbd0c5',6);
      pathTube(batch,[pt(a,d,.50),pt(b,d,.50)],.074,steel,5);
      const n=Math.ceil((b-a)/2.7);
      for(let i=0;i<n;i++){
        const s=a+(b-a)*i/n;
        pathTube(batch,[pt(s,d,h),pt(s,d,topRail)],i===0?.123:.064,steel,5);
      }
    }
    if(j>0){
      const xy=alongFrame(path.sample(a));
      prism(batch,rect(xy,0,0,park?.93:1.78,2*half-1.4),level(a)-depth-.55,level(a)-depth+.06,'#969f96','#a9b0a6');
      for(const side of sides){
        const [x,z]=xy(0,side*half*.57);
        cylinder(batch,x,z,-1.8,level(a)-depth-.37,park?.4:1.0,park?.48:1.19,'#98a299',10);
      }
    }
    const boundary=[offset(path.sample(a),-half),offset(path.sample(a),half),offset(path.sample(b),half),offset(path.sample(b),-half)];
    obstacles.add(boundary,Math.max(level(a),level(b))+topRail);
  }
  if(park){
    for(const t of [.15,.5,.85]){
      const s=lo+t*(hi-lo), [x,z]=offset(path.sample(s),half);
      lights.add(x,level(s)+.87,z,'#ffcf8f',.63);
    }
  }
}

function promenade(batch,geo,lights){
  const rows=shoreWalk.sections(6);
  const ground=(x,z)=>Math.max(1.33,groundY(geo,x,z))+.24;
  ribbon(batch,rows,-1.94,1.94,ground,'#b4aa94',17);
  ribbon(batch,rows,1.94,2.25,(x,z)=>ground(x,z)+.045,'#cbc3ac');
  const landing=shoreWalk.nearest(...plan.footbridge.at(-1)).s;
  // The coping follows the surveyed water ring. Its vertical face closes the
  // bank down to the water even where a coarse terrain cell rounds off the edge.
  const bank=plan.bankEdge.map(([s,x,z])=>{
    const p=shoreWalk.sample(s), inside=offset(p,1.86);
    const h=ground(...inside)+.054;
    return {s,p,inside,shore:[x,z],edge:[x-.16*p.uz,z+.16*p.ux],h};
  });
  for(let i=1;i<bank.length;i++){
    const a=bank[i-1],b=bank[i];
    if(Math.abs((a.s+b.s)/2-landing)<2.45)continue;
    batch.top([up(a.inside,a.h),up(b.inside,b.h),up(b.shore,b.h),up(a.shore,a.h)],'#b7b09a',17);
    batch.top([up(a.shore,a.h+.031),up(b.shore,b.h+.031),up(b.edge,b.h+.031),up(a.edge,a.h+.031)],'#d1c5ad');
    batch.face([up(a.edge,-.72),up(a.edge,a.h),up(b.edge,b.h),up(b.edge,-.72)],'#9d9e8e',litSurface.paleStone);
  }
  const pathFloor=(x,z,s)=>{
    const curb=grade(geo,x,z)+.215, t=clamp01(s/8.7);
    return curb+(ground(x,z)+.069-curb)*t;
  };
  const link=parkConnection.sections(1.7);
  ribbon(batch,link,-1.82,1.82,pathFloor,'#bcb5a0',17);
  for(const sign of [-1,1])ribbon(batch,link,sign*1.82,sign*2.03,(x,z,s)=>pathFloor(x,z,s)+.04,'#cfc8b4');
  const overlook=shoreWalk.sample(landing-19), xy=alongFrame(overlook);
  const terrace=rect(xy,0,-3.35,11.85,3.55);
  const h=ground(...xy(0,-3.3))+.042;
  prism(batch,terrace,h-.86,h,'#9e9c8a','#bdb49b',0,0,0,17);
  for(const u of [-3.83,.24,4.36]){
    for(const d of [-.65,.65])prism(batch,rect(xy,u+d,-4.54,.18,.49),h,h+.40,steel,steel);
    prism(batch,rect(xy,u,-4.5,2.06,.56),h+.40,h+.50,'#8a765a','#a08765');
    prism(batch,rect(xy,u,-4.82,2.06,.105),h+.47,h+.92,'#948063','#a08765');
  }
  for(let s=13;s<shoreWalk.length-9;s+=37){
    const p=shoreWalk.sample(s);
    const [x,z]=offset(p,-2.46);
    streetlamp(batch,lights,{...p,x,z},ground(x,z),-1,false);
    if(Math.floor(s/37)%2===0){
      const xy=alongFrame(p), h=ground(x,z);
      for(const u of [-.65,.65])prism(batch,rect(xy,u,-2.57,.18,.47),h-.38,h+.40,steel,steel);
      prism(batch,rect(xy,0,-2.55,2.07,.55),h+.40,h+.50,'#8b7256','#a08562');
      prism(batch,rect(xy,0,-2.81,2.07,.09),h+.45,h+.91,'#967d5e','#a08562');
    }
  }
}

function subwayEntry(batch,geo,signs,point){
  const xy=localFrame(point,-.29), h=grade(geo,...point)+.02;
  prism(batch,rect(xy,0,0,9.4,3.0),h-.35,h+.10,'#938f83','#555b57');
  for(const d of [-1.55,1.55]){
    prism(batch,rect(xy,0,d,9.65,.19),h-.05,h+.84,granite,kerb);
    for(const u of [-4.55,0,4.55]){
      const [x,z]=xy(u,d); cylinder(batch,x,z,h+.8,h+3.33,.084,.084,steel,6);
    }
  }
  prism(batch,rect(xy,0,0,10,3.63),h+3.32,h+3.49,'#afbab6','#8ea8a8');
  signs.push({label:'体育中心',a:xy(-4.7,1.824),b:xy(-.23,1.824),y:h+2.67,height:.78});
}

export function buildHubinRoad(batch,geo,lights,obstacles,signs){
  const eastJunction=eastRoad.nearest(...offset(avenue.sample(plan.junctions[1]),0)).s;
  const roads=[boulevard(batch,geo,lights,avenue,plan.junctions,'湖滨北路双向车流'),
    boulevard(batch,geo,lights,eastRoad,[eastJunction],'湖东桥双向车流')];
  const jinqiaoRows=jinqiao.sections(4).filter(r=>r.s>4 && avenue.nearest(r.x,r.z).distance>11.4);
  const localGrade=(x,z)=>grade(geo,x,z)+.06;
  ribbon(batch,jinqiaoRows,-4.15,4.15,localGrade,asphalt);
  ribbon(batch,jinqiaoRows,-.08,.08,(x,z)=>localGrade(x,z)+.035,'#bdb28e');
  for(const side of [-1,1]){
    const junction=jinqiao.nearest(-2792.8,-786.4).s;
    for(const rows of [jinqiaoRows.filter(r=>r.s<junction-5),jinqiaoRows.filter(r=>r.s>junction+5)])
      ribbon(batch,rows,side*4.15,side*7.15,(x,z)=>localGrade(x,z)+.14,granite,17);
  }
  crossingStripes(batch,jinqiao,jinqiaoRows.at(-1).s-4.3,geo,3.9);
  bridgeStructure(batch,lights,obstacles,eastRoad,...plan.bridge,13.94,bridgeLevel);
  // The planted bank opposite the centre is narrower than a terrain cell.
  // Give its mapped outline a physical bank that meets the footbridge landing.
  prism(batch,plan.islet,-1.1,.72,'#7d8271','#9b9b7f');
  prism(batch,plan.isletGarden,.69,1.24,'#7e8869','#81925d');
  const lo=groundY(geo,...plan.footbridge[0]),hi=groundY(geo,...plan.footbridge.at(-1));
  const parkLevel=s=>Math.max(1.62,lo+(hi-lo)*s/footbridge.length+.27)+.74*Math.sin(Math.PI*s/footbridge.length);
  bridgeStructure(batch,lights,obstacles,footbridge,0,footbridge.length,2.1,parkLevel,true);
  promenade(batch,geo,lights);
  buildHubinFrontage(batch,geo,lights,obstacles,signs);
  for(const pt of plan.metro)subwayEntry(batch,geo,signs,pt);
  const p=avenue.sample(plan.junctions[0]-20), xy=alongFrame(p), [x,z]=xy(0,-14.9), h=grade(geo,x,z);
  cylinder(batch,x,z,h,h+3.9,.073,.073,steel,6);
  signs.push({label:'湖滨北路',a:xy(-1.53,-14.83),b:xy(1.53,-14.83),y:h+3.0,height:.81});
  return roads;
}
