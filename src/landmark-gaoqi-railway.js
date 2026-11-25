import { ShapeUtils, Vector2 } from 'three';
import { alongFrame, offset, ribbon } from './old-town-layout.js';
import { localFrame, rect, sweptRoof, up } from './landmark-forms.js';
import { cylinder, groundY, litSurface, prism, randomSource } from './scenery-mesh.js';
import {
  coveredTracks, forecourt, forecourtCanopy, gaoqiRailGrade, gaoqiRailwayPlan, gaoqiTracks,
  northernSheds, serviceDrive, stationBuildings, stationFrame, westSheds,
} from './gaoqi-railway-layout.js';

const baseStone='#a9a69b', paved='#888d88', concrete='#b4b2a5', wall='#d0c7b3';
const railColor='#b1aaa2', steel='#52635e', shelterRed='#99624e';
const railDatum=(x,z)=>gaoqiRailGrade(x,z);
const slab=(batch,frame,u,v,w,d,bottom,top,color,roof=color,style=0)=>
  prism(batch,rect(frame,u,v,w,d),bottom,top,color,roof,style);

function tracks(batch,geo,obstacles) {
  const rng=randomSource(34574);
  for (const {id,path,main,bridge} of gaoqiTracks) {
    const cuts=path.sections(main?10:8);
    const h=(x,z)=>railDatum(x,z);
    if(bridge){
      ribbon(batch,cuts,-1.96,1.96,(x,z)=>h(x,z)-.14,'#a0a5a2');
      for(const side of [-1.96,1.96]){
        const edge=(p,drop)=>[p.x+p.rx*side,h(p.x,p.z)-drop,p.z+p.rz*side];
        for(let j=1;j<cuts.length;j++){
          const a=cuts[j-1],b=cuts[j];
          const face=[edge(a,1.54),edge(a,.14),edge(b,.14),edge(b,1.54)];
          batch.face(side<0?face:face.toReversed(),'#929a99');
        }
      }
      for(let s=27;s<path.length;s+=39){
        const p=path.sample(s), frame=alongFrame(p), top=h(p.x,p.z)-1.51;
        slab(batch,frame,0,0,1.8,2.45,Math.min(groundY(geo,p.x,p.z)-.4,top-.1),top,'#9da6a3');
      }
    }
    ribbon(batch,cuts,-1.69,1.69,(x,z)=>h(x,z)-.125-(id%5)*.004,
      main?'#695c50':'#746353',litSurface.railBallast);
    for (const side of [-.735,.735]) {
      ribbon(batch,cuts,side-.052,side+.052,(x,z)=>h(x,z)+.09,railColor);
      // Match the rail top at bends by using the section's miter vector.
      const edge=(p,height)=>[p.x+p.rx*side,h(p.x,p.z)+height,p.z+p.rz*side];
      for(let j=1;j<cuts.length;j++){
        const a=cuts[j-1],b=cuts[j];
        batch.face([edge(a,-.047),edge(a,.09),edge(b,.09),edge(b,-.047)],'#6d5d52');
      }
    }
    for(let s=.4;s<path.length-.15;s+=main?.73:.86){
      const p=path.sample(s), y=h(p.x,p.z)-.037;
      batch.top(rect(alongFrame(p),0,0,main?.24:.19,2.43).map(q=>up(q,y)),
        rng()<.46?'#9c9080':'#837566');
    }
    if(id===1226070290){
      const a=path.sample(0),b=path.sample(path.length);
      const ring=[offset(a,-2.62),offset(b,-2.62),offset(b,2.62),offset(a,2.62)];
      prism(batch,ring,h(a.x,a.z)-1.02,h(a.x,a.z)-.125,'#73838a','#858a83');
      obstacles.add(ring,h(a.x,a.z)+.23);
    }
    if(!main)continue;
    ribbon(batch,cuts,-.035,.035,(x,z)=>h(x,z)+5.78,'#747875');
    for(let s=34;s<path.length-9;s+=55){
      const p=path.sample(s);
      const [cx,cz]=stationFrame(3,37.8);
      if(Math.hypot(p.x-cx,p.z-cz)<62)continue;
      const side=id===1492165172 || id===1492165173 || id===627497895?1:-1;
      const frame=alongFrame(p), d=side*(bridge?1.69:2.64), from=frame(0,d), y=h(p.x,p.z);
      const foot=bridge?y-.16:groundY(geo,...from);
      slab(batch,frame,0,d,.31,.32,foot-.24,y+6.63,steel);
      slab(batch,frame,0,d,.75,.72,foot-.17,foot+.25,baseStone);
      slab(batch,frame,0,d/2,.082,Math.abs(d)+.14,y+5.99,y+6.08,'#58645d');
      const a=up(from,y+6.57), b=up(frame(0,0),y+6.05);
      batch.face([a,b,[b[0],b[1]-.045,b[2]],[a[0],a[1]-.045,a[2]]],steel);
    }
  }
}

function platform(batch, ring) {
  const a=ring[0],b=ring.at(-1);
  const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
  const start=([x,z])=>up([x,z],railDatum(x,z)+.87);
  for(let i=1;i<ring.length-1;i++) batch.top([start(a),start(ring[i]),start(ring[i+1])],'#a9a79c');
  for(let i=0;i<ring.length;i++){
    const p=ring[i],q=ring[(i+1)%ring.length];
    batch.face([up(p,railDatum(...p)-.12),start(p),start(q),up(q,railDatum(...q)-.12)],baseStone);
    const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);
    if(len<12)continue;
    const frame=localFrame(p,Math.atan2(dz,dx)), d=Math.sin(Math.atan2(dz,dx)-angle)>.4?-.41:.41;
    const stripe=rect(frame,len/2,d,len-.85,.10);
    batch.top(stripe.map(r=>up(r,railDatum(...r)+.906)),'#bfb38a');
  }
}

function depotShed(batch, geo, obstacles, [center,w,d,theta,color], tall=5.5) {
  const frame=localFrame(center,theta), y=groundY(geo,...center)+.29;
  const ring=rect(frame,0,0,w,d);
  prism(batch,ring,y-.65,y+tall,'#b5b0a0',color,0,0,1.02,litSurface.railRoof);
  for(let u=-w/2+4;u<w/2-1;u+=7){
    for(const side of [-1,1]){
      slab(batch,frame,u,side*(d/2+.022),3.38,.055,y+.19,y+3.71,'#7b857f','#8a9490',litSurface.northFascia);
      slab(batch,frame,u-1.82,side*(d/2+.16),.112,.35,y+.0,y+4.11,'#a5aaa0');
    }
  }
  obstacles.add(ring,y+tall+1.08);
}

function stationHouse(batch,geo,obstacles) {
  const y=groundY(geo,...stationFrame(0,0))+.25;
  for(const {u,v,width,depth,height,rise,finish} of stationBuildings){
    const ring=rect(stationFrame,u,v,width,depth);
    prism(batch,ring,y-.91,y+.76,baseStone,'#b9b5a5');
    prism(batch,ring,y+.76,y+height,wall,finish==='tile'?null:'#c4c6b7',0,0,rise,litSurface.railRoof);
    if(finish==='tile') sweptRoof(batch,stationFrame,u,v,width+1.48,depth+1.32,
      y+height-.04,rise,'#a36550','#815247',.13);
    for(let a=u-width/2+3;a<u+width/2-1.8;a+=4.4) for(const side of [-1,1]){
      const edge=v+side*(depth/2+.057);
      slab(batch,stationFrame,a,edge,2.17,.065,y+2.41,y+4.0,'#596c68','#647c75');
      slab(batch,stationFrame,a,edge,.07,.092,y+2.4,y+4.07,'#b7b8aa');
      slab(batch,stationFrame,a,edge,2.28,.22,y+2.33,y+2.41,'#b9b7aa');
    }
    obstacles.add(ring,y+height+rise);
  }
}

function canopy(batch,geo,lamps,obstacles,{u,v,width,depth},overRails) {
  const origin=stationFrame(u,v);
  const base=overRails?railDatum(...origin)+6.15:groundY(geo,...origin)+5.53;
  const rise=overRails?1.68:.68;
  const a=u-width/2,b=u+width/2,l=v-depth/2,r=v+depth/2;
  const point=(s,t,lift=0)=>up(stationFrame(s,v+t*depth/2),base+rise*(1-t*t)+lift);
  const num=overRails?18:10;
  for(let i=0;i<num;i++){
    const lo=a+width*i/num,hi=a+width*(i+1)/num;
    for(let k=0;k<10;k++){
      const p=k/5-1,q=(k+1)/5-1;
      const sky=overRails&&k>=2&&k<=7;
      const color=sky?(k%2?'#6d7772':'#7b8580'):overRails?shelterRed:(k%3?'#aeb9b5':'#bec4bb');
      batch.top([point(lo,p),point(hi,p),point(hi,q),point(lo,q)],color,
        sky?litSurface.railGlass:litSurface.railRoof,.53);
      if(i%2===0)batch.top([point(lo-.045,p,.033),point(lo+.045,p,.033),
        point(lo+.045,q,.033),point(lo-.045,q,.033)],overRails?'#b39b86':'#cbd2c7');
    }
  }
  for(const e of [l,r]){
    slab(batch,stationFrame,u,e,width,.22,base-.31,base+.02,overRails?'#78574c':'#b7c0b6');
    for(let s=a+2.2;s<b-1.1;s+=overRails?10.2:8.2){
      const d=e+(e===l?.28:-.28),[x,z]=stationFrame(s,d);
      const h=overRails?railDatum(x,z)-.31:groundY(geo,x,z);
      cylinder(batch,x,z,h-.21,base-.09,overRails?.185:.13,.12,'#9aa79f',7);
      if(!overRails)lamps.add(x,base-.31,z,'#e5ebdc',.75);
    }
  }
  obstacles.add(rect(stationFrame,u,v,width,depth),base+rise+.05);
}

function forecourtSurface(batch,geo,lamps,obstacles){
  const h=(x,z)=>groundY(geo,x,z)+.095;
  const midpoint=([ax,az],[bx,bz])=>[(ax+bx)/2,(az+bz)/2];
  function pave(a,b,c,splits){
    if(splits===0){
      batch.top([a,b,c].map(p=>up(p,h(...p))),paved,litSurface.streetAsphalt);
      return;
    }
    const ab=midpoint(a,b), bc=midpoint(b,c), ca=midpoint(c,a);
    // Sample the same terrain heights along the edges of adjacent triangles.
    pave(a,ab,ca,splits-1);
    pave(ab,b,bc,splits-1);
    pave(ca,bc,c,splits-1);
    pave(ab,bc,ca,splits-1);
  }
  const outline=forecourt.map(([x,z])=>new Vector2(x,z));
  for(const [a,b,c] of ShapeUtils.triangulateShape(outline,[]))pave(forecourt[a],forecourt[b],forecourt[c],3);
  ribbon(batch,serviceDrive.sections(3.5),-2.75,2.75,(x,z,s)=>h(x,z)+.30*Math.max(0,1-s/10),
    '#818a86',litSurface.streetAsphalt);
  canopy(batch,geo,lamps,obstacles,forecourtCanopy,false);
  const parking=localFrame([-1503,-6709],.02), colors=['#c8cbc4','#566269','#abaea3','#767d80','#bbb8ae'];
  for(let i=0;i<7;i++) for(const side of [-1,1]){
    const u=(i-3)*3.18, v=side*8.9, p=parking(u,v), y=h(...p)+.02;
    const stripe=rect(parking,u-1.56,v,.075,4.80);
    batch.top(stripe.map(q=>up(q,h(...q)+.012)),'#b6b8a3');
    if((i+side+8)%3===0)continue;
    slab(batch,parking,u,v,1.83,4.22,y+.26,y+.96,colors[(i+side+5)%5]);
    slab(batch,parking,u,v+.16,1.54,2.16,y+.94,y+1.55,'#728284',colors[(i+side+5)%5]);
  }
}

function freight(batch) {
  const palette=['#a45d4d','#547c8c','#777f67','#9c784f','#377b83'];
  for (const [id,start,num] of [[129196705,118,8],[129196700,115,6]]) {
    const {path}=gaoqiTracks.find(track=>track.id===id);
    for(let i=0;i<num;i++){
      const p=path.sample(start+15.35*i), frame=alongFrame(p), y=railDatum(p.x,p.z)+.08;
      slab(batch,frame,0,0,14.15,2.58,y+.43,y+1.08,'#424b48');
      for(const u of [-5.4,5.4])slab(batch,frame,u,0,1.75,2.23,y+.07,y+.52,'#3b403b');
      if(i%3===0){
        slab(batch,frame,0,0,12.58,2.70,y+1.05,y+2.57,'#656754','#837966');
        for(let u=-5.7;u<=5.7;u+=1.29) for(const side of [-1,1])
          slab(batch,frame,u,side*1.363,.09,.047,y+1.14,y+2.66,'#929082');
      }else{
        const color=palette[(i+(id%5))%palette.length];
        slab(batch,frame,0,0,12.14,2.42,y+1.05,y+3.67,color,color,litSurface.railRoof);
        for(let u=-5.8;u<=5.8;u+=.49)for(const side of [-1,1])
          slab(batch,frame,u,side*1.219,.048,.055,y+1.24,y+3.52,'#a19880');
      }
    }
  }
}

export function buildGaoqiRailway(batch,geo,lamps,obstacles) {
  tracks(batch,geo,obstacles);
  for (const ring of gaoqiRailwayPlan.platforms) platform(batch,ring);
  stationHouse(batch,geo,obstacles);
  canopy(batch,geo,lamps,obstacles,coveredTracks,true);
  forecourtSurface(batch,geo,lamps,obstacles);
  for(const shed of [...westSheds,...northernSheds]) depotShed(batch,geo,obstacles,shed);
  for(const ring of gaoqiRailwayPlan.westBuildings){
    const pts=ring.map(([x,z])=>groundY(geo,x,z)).sort((a,b)=>a-b), y=pts[pts.length>>1];
    prism(batch,ring,y-.6,y+4.2,'#b4a991','#b7a895',0,0,.7,litSurface.railRoof);
    obstacles.add(ring,y+4.9);
  }
  freight(batch);
}
