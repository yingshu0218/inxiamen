import { cylinder, groundY, litSurface, MeshBatch, prism, TAU } from './scenery-mesh.js';
import { localFrame, rect, up } from './landmark-forms.js';
import { alongFrame, measuredPath, offset } from './old-town-layout.js';
import { annexFootprint, annexFrame, avenue, busStops, plan } from './hubin-layout.js';
import { pathTube } from './landmark-haicang.js';

function telecomHall(batch,geo,lights,obstacles,signs){
  const h=groundY(geo,-2521,-706)+.34, satin='#c5c9c5', metal=litSurface.crownMetal;
  prism(batch,plan.telecom,h-.65,h+.20,'#9c9a8d','#c0bbac',0,0,0,17);
  prism(batch,plan.telecomLobby,h+.20,h+3.79,'#56716f',null,litSurface.ferryGlass,.34);
  prism(batch,plan.telecomLobby,h+3.79,h+4.61,'#c9cdc7','#aab2ad',metal);
  prism(batch,plan.telecomLobby,h+4.61,h+8.64,'#56716f','#9baba4',litSurface.ferryGlass,.54);
  prism(batch,plan.telecomEave,h+8.64,h+8.78,'#646e68','#adaea2');
  prism(batch,plan.telecomEave,h+8.78,h+9.52,'#cbd0c9','#a7a99d',metal,0,0,litSurface.studioRoof);
  obstacles.add(plan.telecomEave,h+9.52);
  const streetEdge=[plan.telecom.at(-1),...plan.telecom.slice(0,5)], edge=measuredPath(streetEdge);
  const rim=edge.sections(3.8);
  for(let i=1;i<rim.length;i++){
    const prev=rim[i-1],cur=rim[i];
    const edgePoint=row=>[row.x+.55*row.rx,h+9.51,row.z+.55*row.rz];
    pathTube(batch,[edgePoint(prev),edgePoint(cur)],.095,'#dde0d9',5);
  }
  for(let s=2;s<edge.length-.7;s+=6.05){
    const p=edge.sample(s), [x,z]=offset(p,-.15);
    cylinder(batch,x,z,h+.18,h+8.64,.34,.32,'#c5c8c0',12);
    const xy=alongFrame(p);
    for(const u of [-2.6,-.68,1.38])
      prism(batch,rect(xy,u,-1.16,.095,.12),h+.22,h+8.51,'#73837f','#85938d');
    if(s%12.1<4){
      const [lx,lz]=offset(p,-.65);
      lights.add(lx,h+8.47,lz,'#ffe7c4',.63);
    }
  }
  const p=edge.sample(19),xy=alongFrame(p);
  prism(batch,rect(xy,0,-.87,10.9,.37),h+3.73,h+4.85,'#d6d9cf','#c9cabe',metal);
  signs.push({label:'中国电信',a:xy(-5.28,-.67),b:xy(5.28,-.67),y:h+3.81,height:.97});
  const store=alongFrame(edge.sample(34.7));
  prism(batch,rect(store,0,-.87,10.4,.37),h+3.73,h+4.85,'#cdd1c7','#c9cabe',metal);
  signs.push({label:'滨北手机城',a:store(-5.04,-.67),b:store(5.04,-.67),y:h+3.79,height:.99});
  for(const direction of [-1,1]){
    const p=edge.sample(22+direction*9),xy=alongFrame(p);
    for(const u of [-1.12,0,1.12])
      prism(batch,rect(xy,u,-1.19,.105,.24),h+.24,h+3.62,'#b5b9b2',satin);
  }
}

// Shallow vaulted service roof in the gap between the studios and shop.
function serviceCourt(batch,geo,lights,obstacles){
  const xy=annexFrame, h=groundY(geo,...xy(0,0))+.25;
  prism(batch,rect(xy,0,1.5,21.6,32.4),h-.65,h+.13,'#a2a294','#b2afa0');
  prism(batch,annexFootprint,h+.12,h+4.76,'#acb2a9','#9aa39a',litSurface.studioRibbon,.32);
  const roof=(u,v)=>up(xy(u,v),h+4.86+1.20*(1-(u/9.14)**2));
  const eave=14.04;
  for(let i=0;i<10;i++){
    const u=-9.14+18.28*i/10,w=u+1.828;
    batch.top([roof(u,-eave),roof(w,-eave),roof(w,eave),roof(u,eave)],'#c6ccbe',litSurface.studioRoof);
    for(const v of [-eave,eave])
      batch.face([up(xy(u,v),h+4.66),roof(u,v),roof(w,v),up(xy(w,v),h+4.66)],'#b5bbb1');
  }
  for(const u of [-8.1,-5.6,-3.15,-.8,1.62,4.08,6.5,8.7])
    pathTube(batch,[roof(u,-eave),roof(u,eave)],.062,'#d5d9cd',5);
  const item=(u,v,w,d,b,t,c,cap=c)=>prism(batch,rect(xy,u,v,w,d),h+b,h+t,c,cap);
  item(0,13.70,11.88,.31,.2,3.91,'#8c9a97');
  for(let i=0;i<6;i++)item(0,13.91,11.68,.12,.51+i*.55,.56+i*.55,'#aab4a9');
  item(0,14.3,13.26,2.6,3.91,4.15,'#b0afa0','#bac2b3');
  const door=xy(0,15.1);
  lights.add(door[0],h+3.79,door[1],'#f5d3a0',.73);
  obstacles.add(annexFootprint,h+6.06);

  const aisle=localFrame([-2574.5,-748.2],-.278);
  const floor=groundY(geo,...aisle(0,0))+.36;
  prism(batch,rect(aisle,0,0,47.3,13.7),floor-.53,floor,'#96988b','#8e938c');
  for(let u=-20;u<=21;u+=2.75){
    batch.top(rect(aisle,u,-3.6,.10,4.8).map(pt=>up(pt,floor+.036)),'#c4c3af');
    if(Math.cos(u*1.15)<.1)continue;
    prism(batch,rect(aisle,u+1.30,-3.66,1.70,3.92),floor+.27,floor+1.03,'#91a1a2','#b2b8ae');
    prism(batch,rect(aisle,u+1.30,-3.69,1.52,2.01),floor+1.03,floor+1.46,'#697c7c','#b9bdaf');
  }
}

function shelter(batch,geo,lights,signs,{s,side}){
  const lane=avenue.sample(s), [x,z]=offset(lane,side*14.68), p={...lane,x,z};
  // Local +v faces the carriageway for both shelters. Leave a through path behind the seats.
  const xy=alongFrame(p,-side), h=Math.max(1.1,groundY(geo,x,z))+.54;
  const item=(u,v,w,d,b,t,c,roof=c,style=0)=>prism(batch,rect(xy,u,v,w,d),h+b,h+t,c,roof,style);
  item(0,0,14.6,2.44,-.14,.11,'#a39e90','#c5bdab',17);
  for(const u of [-5.86,-1.94,1.94,5.86]){
    const [sx,sz]=xy(u,-.66);
    cylinder(batch,sx,sz,h+.10,h+3.12,.104,.097,'#71847f',8);
  }
  item(0,.04,13.3,2.68,2.99,3.21,'#82948d','#9eb1a3');
  item(0,.08,13.61,2.85,3.21,3.39,'#557569','#9caaa0');
  item(0,1.47,13.61,.13,3.11,3.28,'#b5bdad','#cccfb9',litSurface.portico);
  for(const center of [-3.94,3.94]){
    item(center,-.69,3.65,.095,1.41,1.61,'#93aaa4');
    item(center,-.39,2.65,.50,.57,.68,'#aa8e6b');
    for(const u of [-.91,.91])item(center+u,-.39,.13,.37,.10,.57,'#667168');
  }
  item(0,-.69,2.32,.18,.59,2.8,'#607873','#82968a');
  item(0,-.58,2.13,.03,.74,2.62,'#d3d2bf');
  for(const u of [-.51,.44]){
    item(u,-.55,.082,.035,.91,2.38,'#7c9687');
    for(let i=0;i<5;i++)item(u+.19,-.52,.30,.032,1.01+i*.25,1.055+i*.25,'#8e978e');
  }
  const [px,pz]=xy(6.82,.76);
  cylinder(batch,px,pz,h+.08,h+3.07,.09,.09,'#71877d',8);
  item(6.82,.76,1.16,.21,1.74,3.19,'#648275');
  item(-3.9,.98,4.75,.13,2.32,3.07,'#56756c');
  signs.push({label:'广电中心',a:xy(-6.18,1.055),b:xy(-1.62,1.055),y:h+2.40,height:.64});
  for(const u of [-3.87,3.84]){
    const e=xy(u,.51);
    lights.add(e[0],h+2.92,e[1],'#f7d5a6',.67);
  }
}
export function buildHubinFrontage(batch,geo,lights,obstacles,signs){
  telecomHall(batch,geo,lights,obstacles,signs);
  serviceCourt(batch,geo,lights,obstacles);
  for(const stop of busStops)shelter(batch,geo,lights,signs,stop);
}

export function busBody(batch, paint = '#458594') {
  const xy=localFrame([0,0]);
  const ring=[[-5.22,-1.22],[4.82,-1.22],[5.33,-.90],[5.40,.82],[5.02,1.22],[-5.22,1.22],[-5.44,.98],[-5.44,-.98]];
  const slab=(u,v,w,d,b,t,wall,roof=wall,style=0)=>prism(batch,rect(xy,u,v,w,d),b,t,wall,roof,style);
  prism(batch,ring,.51,1.28,'#d1d4c4','#c3c7bc');
  prism(batch,ring,1.28,2.02,paint,'#78979a');
  prism(batch,ring,2.02,3.03,'#405d62','#455d63');
  prism(batch,ring,3.03,3.23,'#d4d4c4','#c5c8b9');
  slab(-1.35,0,4.18,1.41,3.22,3.55,'#b3b9ad','#bbc0b5');
  for(const side of [-1,1]){
    for(let i=0;i<7;i++)slab(-4.82+i*1.44,1.23*side,.095,.07,1.97,3.02,'#c4c6b8');
    slab(-.1,1.24*side,9.6,.035,2.74,2.79,'#697c78');
    for(const u of [-3.38,3.28]){
      const hub=(angle,r,v)=>[u+r*Math.cos(angle),.545+r*Math.sin(angle),side*v];
      const disk=(radius,v,color)=>batch.face(Array.from({length:14},(_,j)=>hub(TAU*j/14,radius,v)),color);
      for(let j=0;j<14;j++){
        const a=j*TAU/14,b=(j+1)*TAU/14;
        batch.face([hub(a,.51,1.08),hub(b,.51,1.08),hub(b,.51,1.28),hub(a,.51,1.28)],'#424541');
      }
      disk(.51,1.28,'#3c403c');disk(.253,1.31,'#a1a69a');
    }
    const lampX=5.29;
    slab(lampX,side*.65,.17,.35,.84,1.00,'#eadcb2','#f0e5c4',litSurface.portico);
    slab(-5.39,side*.73,.125,.28,.85,1.17,'#995449');
  }
  for(const u of [-.14,4.50]){
    slab(u,1.24,.99,.062,.72,2.96,'#465e61');
    slab(u,1.295,.07,.044,.73,2.96,'#9ba9a1');
  }
  slab(5.27,0,.16,.98,2.73,2.98,'#433f32','#9b865b');
}

// Integrate a constant-speed approach, gentle braking, a dwell and departure.
// The stop is in metres from the entrance of this carriageway.
export function busProgress(time, length, stop){
  const speed=9.4, brake=5.6, dwell=8, slowing=.5*speed*brake;
  const start=(stop-slowing)/speed, period=length/speed+brake+dwell;
  const t=((time%period)+period)%period;
  if(t<start)return t*speed;
  const phase=t-start;
  if(phase<brake)return stop-slowing*(1-phase/brake)**2;
  if(phase<=brake+dwell)return stop;
  const moving=phase-brake-dwell;
  if(moving<brake)return stop+slowing*(moving/brake)**2;
  return stop+slowing+(moving-brake)*speed;
}

export function hubinBuses(parent,geo,material){
  const batch=new MeshBatch();busBody(batch);
  const first=batch.finish(parent,material,'湖滨北路 · 公交车');
  first.castShadow=first.receiveShadow=true;
  const second=first.clone();parent.add(second);
  const vehicles=[first,second];
  const offsets=busStops.map(({side,s},i)=>(side>0?s:avenue.length-s)/9.4+4.5-i*7);
  return (time,eye)=>{
    const visible=Math.hypot(eye.x+2635,eye.z+650)<1500;
    for(const [i,mesh] of vehicles.entries()){
      mesh.visible=visible;
      if(!visible)continue;
      const {side,s}=busStops[i], station=side>0?s:avenue.length-s;
      const travelled=busProgress(time+offsets[i],avenue.length,station);
      const p=avenue.sample(side>0?travelled:avenue.length-travelled), [x,z]=offset(p,side*9.79);
      mesh.position.set(x,Math.max(1.1,groundY(geo,x,z))+.415,z);
      mesh.rotation.y=Math.atan2(-p.uz*side,p.ux*side);
    }
  };
}
