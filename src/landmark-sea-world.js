import { box, cylinder, groundY, litSurface, mix, prism, TAU } from './scenery-mesh.js';
import { ellipse, localFrame, rect, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { measuredPath, ribbon } from './old-town-layout.js';
import { seaAnnex, seaDeck, seaMall, seaPromenade, seaWheel } from './mall-landmark-layout.js';

const shell = '#aabbbd', metal = '#c0cacc', beige = '#c3b6a3', glass = '#7b9ca1';

function waterfront(batch,geo,ring,base,height,tint) {
  prism(batch,ring,Math.min(...ring.map(p=>groundY(geo,...p)))-.65,base+2.2,
    '#b3ada0',null,litSurface.stone);
  prism(batch,ring,base+2.2,base+7.2,'#739197',null,litSurface.shopfront,.64);
  prism(batch,ring,base+7.2,base+height-.74,tint,null,litSurface.crownMetal,.63);
  prism(batch,ring,base+height-.74,base+height,metal,'#a4a9a0',litSurface.railEave,.45,0,22);
}

function seaFront(batch,base,lamps,signs) {
  const border=[seaMall[0],seaMall[14],seaMall[13],seaMall[12]];
  const alignment=measuredPath(border);
  const p=(s,y,out=.31)=>{
    const q=alignment.sample(s);
    return [q.x-q.uz*out,base+y,q.z+q.ux*out];
  };
  for (const [from,to,low,high,tint] of [
    [12,106,7.35,22.75,'#819c9f'],[112,179,9.3,21.5,'#829d9b'],
    [232,282,7.35,23.14,'#7a9ea9'],[309,365,8.1,21.8,'#93aeb1'],
    [387,411,8.9,23.48,'#7194a1'],[456,536,6.9,22.8,'#749da8'],
  ]) {
    const rows=Math.ceil((to-from)/6.5);
    for(let j=0;j<rows;j++){
      const a=from+(to-from)*j/rows,b=from+(to-from)*(j+1)/rows;
      batch.face([p(a,low),p(a,high),p(b,high),p(b,low)],tint,litSurface.railGlass,.68,
        [[a,0],[a,high-low],[b,high-low],[b,0]]);
      batch.face([p(a,low-.6,.5),p(a,low,.5),p(b,low,.5),p(b,low-.6,.5)],beige,litSurface.railEave);
      if(j%4===0)lamps.add(...p(a,low-.35,1.2),'#ffdcaa',1.35);
    }
  }
  // Upper dining terraces and the ocean-facing entrance canopy project from
  // the coastal facade at different levels.
  for(const [start,end,height,depth] of [[38,111,10.8,5.4],[239,287,13.5,6.8],[451,521,9.15,7.2]]){
    const bays=Math.ceil((end-start)/8);
    for(let i=0;i<bays;i++){
      const a=mix(start,end,i/bays), b=mix(start,end,(i+1)/bays);
      const outer=(s)=>depth*(.68+.32*Math.sin(Math.PI*(s-start)/(end-start)));
      const d0=outer(a),d1=outer(b);
      batch.top([p(a,height,.08),p(b,height,.08),p(b,height,d1),p(a,height,d0)],'#bdb7a8',22);
      batch.face([p(a,height-.6,d0),p(a,height+.11,d0),p(b,height+.11,d1),p(b,height-.6,d1)],
        '#bbc6c3',litSurface.railEave);
      batch.face([p(a,height+.13,d0-.15),p(a,height+1.01,d0-.15),
        p(b,height+1.01,d1-.15),p(b,height+.13,d1-.15)],glass,litSurface.railGlass,.49);
      if(i%2===0){
        const [x,,z]=p(a,height,d0-1.3);
        cylinder(batch,x,z,base-.25,base+height-.4,.38,.28,metal,8);
      }
    }
  }
  const label=alignment.sample(289), end=alignment.sample(326);
  signs.push({label:'厦门海上世界',a:[label.x-label.uz*.7,label.z+label.ux*.7],
    b:[end.x-end.uz*.7,end.z+end.ux*.7],y:base+24.1,height:3.05,ink:'#f2e8d3'});
}

function roofDecks(batch,roof) {
  const xy=localFrame([-5410,-1752],1.718);
  const track=measuredPath([xy(-35,-23),xy(-38,-7),xy(-34,17),xy(-23,22),xy(12,22),xy(35,13),
    xy(36,-11),xy(24,-22),xy(9,-19),xy(2,6),xy(-11,7),xy(-16,-14),xy(-35,-23)]);
  const rows=track.sections(2.8), level=()=>roof+.18;
  ribbon(batch,rows,-4.3,4.3,level,'#767d77',22);
  ribbon(batch,rows,-4.35,-3.86,()=>roof+.21,'#cabe9f');
  ribbon(batch,rows,3.86,4.35,()=>roof+.21,'#cabe9f');
  for(const [x,z,width,depth,height,finish] of [
    [-5420,-1668,28,30,1.25,'#a9aca1'],[-5445,-1610,28,46,1.8,'#9aaea9'],
    [-5412,-1562,12,33,1.25,'#8c9d9d'],[-5465,-1394,24,47,1.16,'#91a097'],
    [-5452,-1353,17,24,1.45,'#748f70'],[-5505,-1301,14,39,.72,'#758c6c'],
  ]) {
    const pad=rect(localFrame([x,z],1.718),0,0,depth,width);
    prism(batch,pad,roof,roof+height,metal,finish,litSurface.railEave);
  }
  const pavilion=localFrame([-5449,-1478],-.145);
  prism(batch,ellipse(pavilion,0,0,14.6,19.65,36),roof,roof+2.8,glass,'#758e88',litSurface.railGlass);
  const court=localFrame([-5481,-1300],1.718);
  for(const u of [-11.8,11.8]){
    const footing=rect(court,u,0,22.7,19.1);
    prism(batch,footing,roof,roof+.19,'#80a17c','#a77378');
    for(const [a,b,w,d] of [[0,0,.13,17.8],[-10.7,0,.14,17.8],[10.7,0,.14,17.8],
        [0,-8.83,21.55,.14],[0,8.83,21.55,.14]]){
      batch.top(rect(court,u+a,b,w,d).map(p=>up(p,roof+.2)),'#d3bdb1');
    }
  }
}

function ferrisWheel(batch,roof,lamps,obstacles) {
  const xy=localFrame(seaWheel,.68), hub=roof+31.45, radius=28.7;
  const at=(angle,r=radius,face=0) => up(xy(Math.cos(angle)*r,face),hub+Math.sin(angle)*r);
  const rows=Array.from({length:97},(_,i)=>i*TAU/96);
  const white='#d8ddd3', grey='#b6c4c1';
  for(const face of [-.76,.76]){
    pathTube(batch,rows.map(t=>at(t,radius,face)),.36,white,7,litSurface.crownMetal);
    pathTube(batch,rows.map(t=>at(t,radius-1.29,face)),.19,grey,6);
  }
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1],b=rows[i];
    pathTube(batch,[at(a,radius-.03,-.74),at(b,radius-1.3,-.74)],.135,white,5);
    pathTube(batch,[at(a,radius-.03,.74),at(b,radius-1.3,.74)],.135,white,5);
    if(i%3!==1)continue;
    for(const face of [-1,1]){
      pathTube(batch,[up(xy(Math.cos(a)*2.3,face*2.7),hub+Math.sin(a)*2.3),
        at(a,radius-1.28,face*.73)],.105,grey,5);
    }
    const [x,y,z]=at(a), pod=y+.5;
    cylinder(batch,x,z,pod-1.53,pod-1.0,.82,1.48,'#a6b1ab',10,.11,'#c4c4b5');
    cylinder(batch,x,z,pod-1.0,pod+.68,1.48,1.5,'#789799',12,.11,'#8caaac',litSurface.railGlass);
    cylinder(batch,x,z,pod+.68,pod+1.18,1.5,.71,white,10,.11,white);
    lamps.add(x,pod-.62,z,'#ffe6c1',.53);
  }
  for(const side of [-1,1]){
    const p=(u,v,y)=>up(xy(u,side*v),y);
    const footL=p(-10.4,10.05,roof+.32), footR=p(10.4,10.05,roof+.32), axle=p(0,1.75,hub);
    pathTube(batch,[footL,axle,footR],.81,white,8,litSurface.crownMetal);
    pathTube(batch,[p(-8.65,9.32,roof+5.6),p(0,6.32,roof+11.5),p(8.65,9.32,roof+5.6)],.38,grey,6);
    const a=p(-3.65,5.75,roof+16.9), b=p(3.65,5.75,roof+16.9);
    batch.face([a,axle,b], '#bcd1d1',litSurface.crownMetal);
    pathTube(batch,[p(0,10.1,roof+.4),p(0,1.75,hub)],.44,white,7);
  }
  const plinth=rect(xy,0,0,25,24);
  prism(batch,plinth,roof-.12,roof+.42,beige,'#bfbbb0',litSurface.stone);
  pathTube(batch,[up(xy(0,-3.05),hub),up(xy(0,3.05),hub)],1.46,white,16);
  obstacles.add(rect(xy,0,0,61.2,12),roof+62);
}

export function buildSeaWorld(batch,geo,lamps,obstacles,signs) {
  const base=Math.max(3.3,groundY(geo,-5460,-1510));
  const roof=base+26.8;
  waterfront(batch,geo,seaMall,base,26.8,shell);
  waterfront(batch,geo,seaAnnex,base,13.2,'#b8bdb2');
  waterfront(batch,geo,seaDeck,base,8.5,'#b0b8b1');
  seaFront(batch,base,lamps,signs);
  roofDecks(batch,roof);
  ferrisWheel(batch,roof,lamps,obstacles);
  const walk=measuredPath(seaPromenade), rows=walk.sections(8);
  const top=(x,z)=>Math.max(2,groundY(geo,x,z)+.28);
  ribbon(batch,rows,-6.45,6.45,top,'#b2a999',22);
  ribbon(batch,rows,-6.5,-6.23,(x,z)=>top(x,z)+.27,'#a6a496',litSurface.seaWall);
  for(let i=2;i<rows.length;i+=6){
    const {x,z,rx,rz}=rows[i];
    const px=x+rx*4.3,pz=z+rz*4.3,y=top(px,pz);
    box(batch,px,pz,.13,.13,y,y+3.1,'#7b8584');
    lamps.add(px,y+3.12,pz,'#ffe2b2',.96);
  }
  obstacles.add(seaMall,roof+2.8);
  obstacles.add(seaAnnex,base+13.2);
  obstacles.add(seaDeck,base+8.5);
}
