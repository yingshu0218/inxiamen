import { cylinder, groundY, inRing, litSurface, prism, randomSource } from './scenery-mesh.js';
import { localFrame, rect, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { alongFrame, carriageways, offset, plan, ribbon, shore, street } from './old-town-layout.js';

const metal='#b5c2c1', enamel='#edf0df', teal='#497e83', stone='#bab5a8';
const landingStations=plan.gangways.map(g=>shore.nearest(...g.at(-1)).s);
const atLanding=s=>landingStations.some(d=>Math.abs(d-s)<3);
const quayLevel=(geo,x,z)=>Math.max(3.45,groundY(geo,x,z)+.63);
const roadLevel=(geo,x,z)=>groundY(geo,x,z)+.71;
function axis(a,b){const dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz);return {xy:localFrame([(a[0]+b[0])/2,(a[1]+b[1])/2],Math.atan2(dz,dx)),len};}
function post(batch,p,base,height,r,color,style=0){cylinder(batch,...p,base,base+height,r,r*.92,color,7,0,color,style);}
function light(batch,lamps,xy,y,arm=1){
  const p=xy(0,0), tip=xy(0,arm*1.54);
  post(batch,p,y,6.1,.125,'#687977');
  pathTube(batch,[up(p,y+5.87),up(xy(0,arm*.54),y+6.5),up(tip,y+6.55)],.084,'#97a5a1',5);
  prism(batch,rect(xy,0,arm*1.53,.44,1.05),y+6.32,y+6.54,'#c0bb9e','#948e7d',litSurface.portico);
  lamps.add(tip[0],y+6.32,tip[1],'#ffe2ae',1.08);
}

// A pair of overlapping shallow, swept metal roofs is the ferry terminal's
// silhouette on approach. Cross ribs, fascia and soffit follow the same profile.
function canopy(batch,xy,u,v,width,depth,y,sweep,finish=metal) {
  const p=(s,t,layer=0)=>up(xy(u+s*width*.5,v+t*depth*.5),
    y+sweep*(.72*s*s+.48*t*t+.33*t+.15*s*t)+layer);
  const tint=['#b5c0bb','#c4cdca','#bec9c5','#c4ceca'];
  const divisions=12;
  for(let i=0;i<divisions;i++){
    const a=i/divisions*2-1,b=(i+1)/divisions*2-1;
    for(const [l,r] of [[-1,-.12],[-.12,1]]){
      batch.top([p(a,l),p(b,l),p(b,r),p(a,r)],tint[i%4],21,.4);
      batch.face([p(a,r,-.42),p(b,r,-.42),p(b,l,-.42),p(a,l,-.42)],'#adb5ab',litSurface.portico);
      if((i===0||i===divisions-1)){
        const end=i===0?a:b;
        batch.face([p(end,l,-.42),p(end,r,-.42),p(end,r),p(end,l)],finish,litSurface.paleStone);
      }
    }
    for(const t of [-1,1]){
      batch.face([p(a,t,-.34),p(b,t,-.34),p(b,t),p(a,t)],finish,litSurface.paleStone);
      batch.face([p(a,t,-.45),p(b,t,-.45),p(b,t,-.34),p(a,t,-.34)],'#f4e4c4',litSurface.canopyLight);
    }
    if(i%2===0)pathTube(batch,[p(a,-1,-.47),p(a,-.12,-.66),p(a,1,-.47)],.13,enamel,5);
  }
}

export function buildFerry(batch,geo,lamps,obstacles,signs) {
  const xy=localFrame([-5748.74,2514.48],Math.atan2(62.3,44.1)), base=4.23;
  const slab=(u,v,w,d,lo,hi,wall,roof=wall,style=0)=>prism(batch,rect(xy,u,v,w,d),lo,hi,wall,roof,style,.54);
  // The forecourt slopes into the west pavement of Lujiang Avenue.
  const court=rect(xy,0,-16,88,24);
  prism(batch,court,base-.81,base-.15,'#a29d8d','#c7beaa',0,0,0,17);
  prism(batch,plan.terminal,base-1,base+.10,'#8d9790','#c9c5b5');
  for(const u of [-19,19]){
    const label=u>0?'1号候船厅':'2号候船厅';
    slab(u,-.44,35.7,10.65,base+.1,base+.70,'#bec3b8');
    slab(u,-.44,35.7,10.65,base+.70,base+6.36,'#85aaa8','#a8b6af',litSurface.ferryGlass);
    slab(u,-.36,36.4,11.23,base+4.14,base+4.64,teal,metal);
    for(let j=-16;j<=16;j+=4){
      const p=xy(u+j,5.18);post(batch,p,base,6.5,.16,enamel,litSurface.paleStone);
      if(j%8===0)lamps.add(p[0],base+4.75,p[1],'#ffe1b0',.75);
    }
    signs.push({label,a:xy(u-5.9,5.39),b:xy(u+5.9,5.39),y:base+4.16,height:1.49});
    signs.push({label,a:xy(u+5.9,-6.02),b:xy(u-5.9,-6.02),y:base+3.05,height:1.4});
    canopy(batch,xy,u,-.48,39,17.9,base+6.23,.88);
  }
  slab(-3,-.75,27,9,base+6.17,base+10.0,'#7d9696','#9fada4',litSurface.ferryGlass);
  for(const u of [-17,-9,-1,7,13]){
    post(batch,xy(u,4.23),base+5.9,4.28,.20,enamel);
    for(const v of [-1,1])pathTube(batch,[up(xy(u,2.84*v),base+6.65),up(xy(u,8*v),base+10.11)],.15,enamel,5);
  }
  canopy(batch,xy,-3,0,43.5,22.6,base+9.45,1.79,enamel);
  for(const u of [-14,9])post(batch,xy(u,-1.8),base+9.7,3.95,.24,'#a3aaa1');
  for(const v of [-1,1]){
    slab(-3,v*5.02,20.7,.4,base+6.88,base+9.03,'#285466');
    signs.push({label:'厦门轮渡',a:xy(-3-v*8.85,v*5.26),b:xy(-3+v*8.85,v*5.26),y:base+6.99,height:1.94});
  }
  obstacles.add(plan.terminal,base+12.5);
  for(const [i,ring] of plan.pontoons.entries()){
    const a=ring[0],b=ring[1], end=ring.at(-1);
    const dx=end[0]-a[0],dz=end[1]-a[1];
    const width=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const len=Math.hypot(dx,dz), centre=[(a[0]+b[0]+dx)/2,(a[1]+b[1]+dz)/2];
    const f=localFrame(centre,Math.atan2(dz,dx));
    prism(batch,ring,-.40,1.48,'#4d5e60','#aaa99b',0,0,0,17);
    for(let u=-len/2+2;u<len/2;u+=5.6){
      for(const side of [-1,1]){
        const p=f(u,side*(width/2+.03));post(batch,p,.1,1.35,.40,'#424e4d');
        if(side<0)post(batch,f(u,side*2.2),1.48,2.9,.12,enamel);
      }
    }
    canopy(batch,f,0,0,len*.78,6.8,4.5,.33,'#d0d0bc');
    const guide=f(-len/2+1,-width*.53);
    post(batch,guide,-2,9.5,.49,'#647974');
    lamps.add(guide[0],7.7,guide[1],i===0?'#9dd7c4':'#ffdba9',.94);
    obstacles.add(ring,6.0);
  }
  for(const [dock,land] of plan.gangways){
    const {xy:f,len}=axis(dock,land), lo=-len/2,hi=len/2, width=2.6;
    const pt=(u,v,rise)=>up(f(u,v),1.50+(base-1.5)*(u-lo)/len+rise);
    batch.top([pt(lo,-width/2,0),pt(hi,-width/2,0),pt(hi,width/2,0),pt(lo,width/2,0)],'#bab7a9');
    for(const v of [-width/2,width/2]){
      batch.face([pt(lo,v,-.38),pt(hi,v,-.38),pt(hi,v,0),pt(lo,v,0)],'#547875');
      for(const lift of [.49,1.05])pathTube(batch,[pt(lo,v,lift),pt(hi,v,lift)],.081,enamel,5);
      for(let u=lo+.25;u<hi;u+=3.5)pathTube(batch,[pt(u,v,0),pt(u,v,1.05)],.062,enamel,5);
    }
    obstacles.add(rect(f,0,0,len,width),base+1.05);
  }
}

// Plantings are generated once, shared with the game's existing tree instancer.
export const waterfrontTrees=[];
const parkRandom=randomSource(7421);
for(let i=0;i<580;i++){
  const x=-5910+parkRandom()*160,z=2183+parkRandom()*274;
  if(!inRing(x,z,plan.park))continue;
  const k=shore.nearest(x,z);
  if(k.side>-9 || Math.abs(k.side+22)<3.4 || waterfrontTrees.some(p=>Math.hypot(x-p[0],z-p[1])<6.65))continue;
  waterfrontTrees.push([x,z,1.2+.68*parkRandom(),false]);
}
for(let s=14;s<shore.length-6;s+=15.7){
  if(s>315&&s<452)continue;
  const p=offset(shore.sample(s),-5.65);
  waterfrontTrees.push([...p,.86+.14*parkRandom(),true]);
}

function avenueTraffic(geo) {
  const length=carriageways[0].length;
  // At bends, pair each seaward sample with the nearest point on the inland
  // carriageway rather than using a fixed-size parallel offset.
  const rows=carriageways[0].sections(12).map(r=>{
    const p=carriageways[0].sample(r.s), near=carriageways[1].nearest(p.x,p.z), q=carriageways[1].sample(near.s);
    return {...r, innerX:q.x,innerZ:q.z,h:roadLevel(geo,r.x,r.z),innerH:roadLevel(geo,q.x,q.z),rx:-p.uz,rz:p.ux};
  });
  function step(t){
    const target=t*length;
    let lo=0,hi=rows.length-1;
    while(hi-lo>1){const m=(lo+hi)>>1; if(rows[m].s<=target)lo=m;else hi=m;}
    const a=rows[lo],b=rows[hi],f=(target-a.s)/(b.s-a.s), mix=k=>a[k]+f*(b[k]-a[k]);
    return {x:mix('x'),z:mix('z'),innerX:mix('innerX'),innerZ:mix('innerZ'),h:mix('h'),innerH:mix('innerH'),rx:mix('rx'),rz:mix('rz')};
  }
  function at(p,offset,extra){
    const sea=offset>0, lateral=(Math.abs(offset)>4.5?3.48:0)*(sea?1:-1);
    return [(sea?p.x:p.innerX)+lateral*p.rx,(sea?p.h:p.innerH)+extra,(sea?p.z:p.innerZ)+lateral*p.rz];
  }
  return {length,step,at,center:step(.5),surfaceStreet:true};
}

// Clip the landward sidewalk at the mapped Zhongshan Road junction. Use
// the street's two edges so the opening follows the oblique approach.
function inlandSidewalk(batch, lane, sections, curb) {
  const mouth = street.sample(0);
  const atSide = (row, width) => [row.x - width * row.rx, row.z - width * row.rz];
  const lateral = ([x, z]) => (z - mouth.z) * mouth.ux - (x - mouth.x) * mouth.uz;
  const crossing = lane.nearest(mouth.x, mouth.z).s;
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1], b = sections[i];
    if (Math.abs(a.s - crossing) > 25) {
      ribbon(batch, [a, b], -5.32, -6.76, curb, '#c0b6a1', 17);
      continue;
    }
    const quad = [atSide(a, 5.32), atSide(a, 6.76), atSide(b, 6.76), atSide(b, 5.32)];
    for (const sign of [-1, 1]) {
      const kept = [];
      for (let j = 0; j < quad.length; j++) {
        const p = quad[j], q = quad[(j + 1) % quad.length];
        const d = sign * lateral(p) - 5.05, e = sign * lateral(q) - 5.05;
        if (d >= 0) kept.push(p);
        if ((d < 0) !== (e < 0)) {
          const t = d / (d - e);
          kept.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
      }
      if (kept.length >= 3) batch.top(kept.map(([x, z]) => [x, curb(x, z), z]), '#c0b6a1', 17);
    }
  }
}

function avenuePaving(batch,geo){
  const asphalt=(x,z)=>roadLevel(geo,x,z), curb=(x,z)=>asphalt(x,z)+.115;
  for(const [i,lane] of carriageways.entries()){
    const sections=lane.sections(7);
    ribbon(batch,sections,-5.32,5.32,asphalt,'#666b69',litSurface.carriageway);
    const outer=i===0?1:-1;
    if (i===1) inlandSidewalk(batch,lane,sections,curb);
    else ribbon(batch,sections,outer*5.32,outer*6.76,curb,'#c0b6a1',17);
    ribbon(batch,sections,-outer*5.32,-outer*5.65,curb,'#c4b9a4');
    for(const s of plan.crosswalks[i]){
      const xy=alongFrame(lane.sample(s));
      for(let d=-4.68;d<5;d+=.88){
        const stripe=rect(xy,0,d,3.25,.43);
        batch.top(stripe.map(p=>up(p,asphalt(...p)+.07)),'#d7d2bf');
      }
    }
  }
  const sea=carriageways[0], inland=carriageways[1];
  const median=sea.sections(5).map(p=>{
    const near=inland.nearest(p.x,p.z), q=inland.sample(near.s);
    const a=[p.x-5.65*p.rx,p.z-5.65*p.rz], b=offset(q,5.65);
    return {s:p.s, a:up(a,curb(...a)), b:up(b,curb(...b)), width:near.distance-11.3};
  });
  for(let i=1;i<median.length;i++){
    const a=median[i-1], b=median[i];
    if(Math.min(a.width,b.width)<.08)continue;
    const junction=plan.medianBreaks.some(s=>s>a.s-6.5 && s<b.s+6.5);
    const color=junction?'#777b73':b.width>1.25?'#7f8b62':'#b5aa96';
    batch.top([a.a,a.b,b.b,b.a],color);
  }
}

function customsClock(batch,geo,lamps,obstacles){
  const ring=plan.customs, [west,northEast,southEast,southWest]=ring;
  const mid=(a,b)=>[(a[0]+b[0])*.5,(a[1]+b[1])*.5];
  const {xy,len}=axis(mid(west,southWest),mid(northEast,southEast));
  const base=Math.max(...ring.map(p=>groundY(geo,...p)))+.30;
  const ivory='#dcd9c9', stonework='#bcbcad', glass='#73969a';
  const podium=(u,v,w,d,lo,hi,wall,roof=wall,style=0)=>
    prism(batch,rect(xy,u,v,w,d),base+lo,base+hi,wall,roof,style,.62);
  prism(batch,ring,base-1.8,base+5.1,stonework,'#c8c7b8',litSurface.shopfront,.45);
  // The long wing runs inland from the stone frame and the clock facing the harbour.
  const tower=-len/2+12.2;
  podium(6.9,0,len-17.7,17.1,5.1,53.7,'#9ea9a4','#b8b7a8',litSurface.office);
  for(let s=0;s<=len-19;s+=7.1){
    const u=-len/2+16+s;
    podium(u,0,.64,17.54,5.15,55.1,ivory);
  }
  podium(7,0,len-16.9,18.0,53.7,55.0,stonework,ivory);
  podium(tower,0,22.1,19.1,5.1,61.1,ivory);
  podium(tower-11.12,0,.28,11.15,5.6,54.4,glass,'#749698',litSurface.office);
  for(const side of [-1,1]){
    podium(tower,side*9.60,10.7,.30,7.7,51.6,'#96a9a5',glass,2);
    podium(tower+9.55,side*9.67,1.3,.57,5.1,60.9,stonework);
  }
  podium(tower,0,22.7,19.65,58.65,60.03,'#c7c4b2',ivory);
  podium(tower-.18,0,15.8,15.0,61.1,66.1,'#777f77',stonework,1);
  podium(tower-.18,0,17.55,16.70,66.1,67.24,ivory);
  const centre=tower-1.2;
  podium(centre,0,8.88,8.88,67.24,81.1,ivory);
  const faces=rect(xy,centre,0,9.02,9.02);
  for(let i=0;i<faces.length;i++){
    const next=(i+1)%faces.length, a=faces[i],b=faces[next];
    batch.face([up(a,base+72.58),up(a,base+81.06),up(b,base+81.06),up(b,base+72.58)],ivory,
      litSurface.clockFace,0,[[1,0],[1,1],[0,1],[0,0]]);
    const p=mid(a,b);lamps.add(p[0],base+68.2,p[1],'#ffe4b7',.79);
    const cap=[up(a,base+81.05),up(b,base+81.05),up(b,base+82.92),up(p,base+81.80),up(a,base+82.92)];
    batch.face([cap[0],cap[1],cap[2],cap[3]],ivory,litSurface.paleStone);
    batch.face([cap[0],cap[3],cap[4]],ivory,litSurface.paleStone);
  }
  obstacles.add(ring,base+55.1);
  obstacles.add(rect(xy,tower,0,22.7,19.65),base+67.24);
  obstacles.add(faces,base+82.92);
}

export function buildLujiang(batch,geo,lamps,obstacles,signs) {
  const rows=shore.sections(7), top=(x,z)=>quayLevel(geo,x,z), road=(x,z)=>roadLevel(geo,x,z);
  const parkLevel=4.04;
  prism(batch,plan.park,2.2,parkLevel,'#948d72','#8d9a70');
  const parkRows=rows.filter(r=>r.s>=22&&r.s<=277);
  ribbon(batch,parkRows,-23.5,-20.6,(x,z)=>Math.max(parkLevel+.08,top(x,z)),'#c3b49a',17);
  ribbon(batch,rows,-8.1,.55,top,'#c5bbab',17);
  ribbon(batch,rows,-1.15,-.85,(x,z)=>top(x,z)+.04,'#a08d77');
  ribbon(batch,rows,-.22,.73,(x,z)=>top(x,z)+.14,'#d2c5af');
  const edge=(r,d)=>[r.x+r.rx*d,r.z+r.rz*d];
  for(let i=1;i<rows.length;i++){
    const a=edge(rows[i-1],.67),b=edge(rows[i],.67),ha=top(...a),hb=top(...b);
    batch.face([up(a,-3.5),up(b,-3.5),up(b,hb+.12),up(a,ha+.12)],'#897e6c',13,.43,
      [[rows[i-1].s,-3.5],[rows[i].s,-3.5],[rows[i].s,hb],[rows[i-1].s,ha]]);
    if(atLanding((rows[i-1].s+rows[i].s)*.5))continue;
    pathTube(batch,[up(a,ha+1.12),up(b,hb+1.12)],.115,stone,5);
    pathTube(batch,[up(a,ha+.54),up(b,hb+.54)],.058,'#727e77',4);
    post(batch,a,ha,.99,.15,'#b8b5a6');
  }
  for(let s=7;s<shore.length-8;s+=33){
    if(s>312&&s<452)continue;
    const p=shore.sample(s),[x,z]=offset(p,-3.9),xy=alongFrame({...p,x,z});
    light(batch,lamps,xy,top(x,z),1);
    prism(batch,rect(xy,2.8,-.55,2.36,.68),top(x,z)+.16,top(x,z)+.52,'#8c806a','#a38b70');
  }
  avenuePaving(batch,geo);
  customsClock(batch,geo,lamps,obstacles);
  for(let s=17;s<carriageways[0].length-10;s+=43){
    const p=carriageways[0].sample(s),[x,z]=offset(p,6.18),xy=alongFrame({...p,x,z});
    light(batch,lamps,xy,road(x,z),-1);
    if(s%301<44){
      signs.push({label:'鹭江道',a:xy(-.94,.16),b:xy(.94,.16),y:road(x,z)+3.54,height:.57});
    }
  }
  return [avenueTraffic(geo)];
}
