import { cylinder, groundY, litSurface, prism, TAU } from './scenery-mesh.js';
import { localFrame, rect, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { plan } from './hubin-layout.js';

const chalk='#e1e2cf';
function fieldFrame(ring){
  const center=ring.reduce(([x,z],p)=>[x+p[0]/ring.length,z+p[1]/ring.length],[0,0]);
  const edges=ring.map((p,i)=>{const q=ring[(i+1)%ring.length];return [q[0]-p[0],q[1]-p[1]];});
  const across=edges.reduce((a,b)=>Math.hypot(...a)<Math.hypot(...b)?a:b);
  const angle=Math.atan2(across[1],across[0])+(across[0]<0?Math.PI:0);
  return {xy:localFrame(center,angle),width:Math.hypot(...across),length:Math.max(...edges.map(e=>Math.hypot(...e)))};
}
function stripe(batch,xy,u,v,w,d,y,color=chalk){
  batch.top(rect(xy,u,v,w,d).map(pt=>up(pt,y)),color);
}
function paintedArc(batch,xy,u,v,r,thickness,y,start=0,end=TAU){
  const steps=Math.ceil(36*(end-start)/TAU);
  const p=(a,d)=>up(xy(u+d*Math.cos(a),v+d*Math.sin(a)),y);
  for(let i=0;i<steps;i++){
    const a=start+(end-start)*i/steps,b=start+(end-start)*(i+1)/steps;
    batch.top([p(a,r),p(b,r),p(b,r+thickness),p(a,r+thickness)],chalk);
  }
}
function football(batch,ring,y){
  const {xy,width,length}=fieldFrame(ring), w=Math.min(68,width-2), d=Math.min(105,length-2.5);
  for(let i=0;i<12;i++)stripe(batch,xy,0,-length/2+length*(i+.5)/12,width,length/12+.015,y,
    i%2?'#71905e':'#7c9765');
  const ink=y+.039;
  for(const side of [-1,1]){
    stripe(batch,xy,w*side/2,0,.19,d,ink);
    stripe(batch,xy,0,side*d/2,w,.19,ink);
    for(const [boxWidth,depth] of [[40.3,16.5],[18.32,5.5]]){
      for(const end of [-1,1])stripe(batch,xy,end*boxWidth/2,side*(d/2-depth/2),.18,depth,ink);
      stripe(batch,xy,0,side*(d/2-depth),boxWidth,.18,ink);
    }
    const goal=(u,v,h)=>up(xy(u,side*(d/2+v)),y+h);
    pathTube(batch,[goal(-3.66,0,.06),goal(-3.66,0,2.44),goal(3.66,0,2.44),goal(3.66,0,.06)],.091,chalk,5);
    for(const u of [-3.66,3.66]) pathTube(batch,[goal(u,0,2.44),goal(u,1.6,2.24),goal(u,2.2,.04)],.065,chalk,4);
    pathTube(batch,[goal(-3.66,1.6,2.24),goal(3.66,1.6,2.24)],.065,chalk,4);
  }
  stripe(batch,xy,0,0,w,.19,ink);
  paintedArc(batch,xy,0,0,9.15,.19,ink);
}

function basketball(batch,ring,y){
  const {xy,width,length}=fieldFrame(ring), w=Math.min(15,width-1.8), d=Math.min(28,length-2.8);
  stripe(batch,xy,0,0,width,length,y,'#81927c');
  stripe(batch,xy,0,0,w,d,y+.025,'#b38267');
  const ink=y+.067;
  for(const sign of [-1,1]){
    stripe(batch,xy,sign*w*.5,0,.13,d,ink);
    stripe(batch,xy,0,sign*d*.5,w,.13,ink);
    stripe(batch,xy,0,sign*(d*.5-2.87),4.84,5.72,y+.046,'#8b9d85');
    paintedArc(batch,xy,0,sign*(d*.5-1.58),6.55,.14,ink,sign>0?Math.PI:0,sign>0?TAU:Math.PI);
    const [x,z]=xy(0,sign*(d/2+.8));
    cylinder(batch,x,z,y,y+3.25,.11,.1,'#77958b',6);
    prism(batch,rect(xy,0,sign*(d/2-.60),1.7,.11),y+2.76,y+3.75,'#d2d7cb','#c0c5bb');
  }
  stripe(batch,xy,0,0,w,.14,ink);
  paintedArc(batch,xy,0,0,1.74,.14,ink);
}

// Use the mapped stadium rim and the pitch's own bearing. A radial section
// meets both the oval building and the straight sides of a 400 m running track.
function stadium(batch,geo,lights,obstacles){
  const {xy}=fieldFrame(plan.pitch), [cx,cz]=xy(0,0), h=groundY(geo,cx,cz)+.27;
  const sectors=96, straight=41.3, rows=10, green=['#7b9e85','#6a907e','#739684'];
  const sections=[];
  for(let i=0;i<=sectors;i++){
    const theta=i*TAU/sectors, co=Math.cos(theta), si=Math.sin(theta);
    const p=xy(co,si), dx=p[0]-cx, dz=p[1]-cz;
    let outer=Infinity;
    for(let j=0;j<plan.stadium.length;j++){
      const a=plan.stadium[j], b=plan.stadium[(j+1)%plan.stadium.length];
      const ux=b[0]-a[0], uz=b[1]-a[1], det=dx*uz-dz*ux;
      if(Math.abs(det)<1e-6)continue;
      const s=((a[0]-cx)*uz-(a[1]-cz)*ux)/det, t=((a[0]-cx)*dz-(a[1]-cz)*dx)/det;
      if(s>0 && t>=0 && t<=1)outer=Math.min(outer,s);
    }
    const track=r=>{
      const wall=r/Math.max(.00001,Math.abs(co));
      return Math.abs(wall*si)<=straight?wall:straight*Math.abs(si)+Math.sqrt(Math.max(0,r*r-straight*straight*co*co));
    };
    sections.push({outer,track,pt:(r,y)=>[cx+dx*r,h+y,cz+dz*r]});
  }
  prism(batch,plan.stadium,h-1.15,h,'#aaa798','#b9b29f');
  for(let i=0;i<sectors;i++){
    const l=sections[i], r=sections[i+1];
    const panel=(ra,rb,ya,yb,color,style=0)=>{
      batch.top([l.pt(ra(l),ya),r.pt(ra(r),ya),r.pt(rb(r),yb),l.pt(rb(l),yb)],color,style);
    };
    const turf=k=>k.track(36.5), trackEnd=k=>k.track(46.25);
    batch.top([[cx,h+.08,cz],l.pt(turf(l),.08),r.pt(turf(r),.08)],'#7c975e');
    panel(turf,trackEnd,.13,.13,'#bb8065');
    for(let lane=0;lane<=8;lane++){
      const radius=36.50+1.211*lane;
      panel(k=>k.track(radius),k=>k.track(radius+.105),.153,.153,'#e4c8a9');
    }
    const seat=(k,f)=>k.track(48.7)+(k.outer-7.3-k.track(48.7))*f;
    const aisle=i%6===0, tunnel=i%12===3;
    for(let j=0;j<rows;j++){
      const y=.94+.95*j,a=j/rows,b=(j+1)/rows;
      panel(k=>seat(k,a),k=>seat(k,b),y,y+.19,aisle?'#b4b1a0':tunnel&&j<4?'#696e63':green[(j>>1)%3]);
      const q=[l.pt(seat(l,b),y+.19),r.pt(seat(r,b),y+.19),r.pt(seat(r,b),y+.95),l.pt(seat(l,b),y+.95)];
      batch.face(q,aisle?'#ada99a':'#779180');
    }
    panel(k=>seat(k,1),k=>k.outer-3.4,10.44,10.5,'#c5c3b3');
    batch.face([l.pt(l.outer-3.4,.09),l.pt(l.outer-3.4,10.5),r.pt(r.outer-3.4,10.5),r.pt(r.outer-3.4,.09)],'#bcbcaf',litSurface.studioRibbon,.48);
    // Two scalloped banks of white tensile roofs, with the goal ends open to the sky.
    const c=Math.cos((i+.5)*TAU/sectors);
    if(Math.abs(c)<.54)continue;
    const peak=s=>Math.abs((s%4)-2)/2;
    const inner=(k,j)=>k.pt(seat(k,.38)+.7*peak(j),14.35+1.10*peak(j));
    const outer=(k,j)=>k.pt(k.outer-1.15,14.95+.83*peak(j));
    const ridge=(k,j)=>k.pt(seat(k,.77),16.45+4.33*(1-peak(j)));
    const li=inner(l,i), ri=inner(r,i+1), lo=outer(l,i), ro=outer(r,i+1);
    const a=ridge(l,i),b=ridge(r,i+1);
    batch.top([li,ri,b],'#e8e5d4',litSurface.paleStone); batch.top([li,b,a],'#dcdccc',litSurface.paleStone);
    batch.top([a,b,ro],'#e8e5d5',litSurface.paleStone); batch.top([a,ro,lo],'#d5d7c9',litSurface.paleStone);
    batch.face([li,ri,[ri[0],ri[1]-.44,ri[2]],[li[0],li[1]-.44,li[2]]],'#a8b8b1');
    if(i%4===2){
      const toe=l.pt(l.outer-4.2,9.5);
      pathTube(batch,[toe,a],.24,'#b7bcb4',6);
      pathTube(batch,[toe,li],.18,'#b7bcb4',5);
      lights.add(li[0],li[1]-.46,li[2],'#f1e5c4',1.05);
    }
    obstacles.add([li,ri,ro,lo].map(v=>[v[0],v[2]]),h+21);
  }
  const inside=sections.slice(0,-1).map(k=>{const p=k.pt(k.track(48.7),0);return [p[0],p[2]];});
  obstacles.add(plan.stadium,h+10.5,[inside]);
  football(batch,plan.pitch,h+.21);
  // The stadium's freestanding scoreboard sits beyond the south goal.
  for(const u of [-6.45,6.45])prism(batch,rect(xy,u,97.6,1.12,1.38),h+4.9,h+15.8,'#cecfc2','#a6aea1');
  prism(batch,rect(xy,0,97.6,18.4,1.9),h+11.8,h+21.1,'#d9d9cd','#b2b7ac');
  const panel=[up(xy(-7.68,96.63),h+13.1),up(xy(7.68,96.63),h+13.1),up(xy(7.68,96.63),h+19.82),up(xy(-7.68,96.63),h+19.82)];
  batch.face(panel,'#76949b',litSurface.portico);
  obstacles.add(rect(xy,0,97.6,18.4,1.9),h+21.1);
}

export function buildHubinSports(batch,geo,lights,obstacles){
  stadium(batch,geo,lights,obstacles);
  // A level terrace carries each mapped pitch so paint follows the actual playing surface.
  for(const [i,ring] of [plan.training,...plan.courts].entries()){
    const h=Math.max(...ring.map(p=>groundY(geo,...p)))+.19;
    prism(batch,ring,h-2.1,h,'#9d9f8b','#85957c');
    if(i===0)football(batch,ring,h+.04);
    else basketball(batch,ring,h+.04);
  }
}
