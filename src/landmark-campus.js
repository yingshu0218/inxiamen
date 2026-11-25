import { cylinder, groundY, litSurface, prism } from './scenery-mesh.js';
import { foundation, groundPaving, localFrame, rect, sweptRoof, terrace, up } from './landmark-forms.js';
import { ribbon } from './old-town-layout.js';
import { pathTube } from './landmark-haicang.js';
import { baicheng, campusRoads, furongHouses, inCampus, jiageng, qunxian, yanwuCourts, yanwuField } from './campus-layout.js';
import { paintOval } from './campus-fields.js';

const granite='#c5bdb0', cream='#ded2b9', terracotta='#ad583d', tile='#b65e42';
const greenTile='#516755', ridge='#998969', dark='#353d36';
const stone=litSurface.graniteFacing, glass=litSurface.hallWindow;

function box(batch, xy, u,v,w,d,y,h, color, style=0, top=color) {
  prism(batch,rect(xy,u,v,w,d),y,y+h,color,top,style);
}
function front(batch,xy,u0,u1,v,y0,y1,color,style=0) {
  batch.face([up(xy(u0,v),y0),up(xy(u1,v),y0),up(xy(u1,v),y1),up(xy(u0,v),y1)],color,style,.63,
    [[u0,y0],[u1,y0],[u1,y1],[u0,y1]]);
}
function label(signs,xy,u,v,w,y,h,name,ink='#d7ba7e') {
  signs.push({label:name,a:xy(u-w/2,v+.018),b:xy(u+w/2,v+.018),y,height:h,ink});
}
function openings(batch,xy,u,v,width,count,base,levels,span,color='#47544f') {
  for(let j=0;j<levels;j++) for(let i=0;i<count;i++){
    const x=u+width*((i+.5)/count-.5), y=base+j*span, w=Math.min(1.96,width/count*.51);
    front(batch,xy,x-w/2,x+w/2,v,y,y+span*.56,color,glass);
    box(batch,xy,x,v,w+.28,.3,y-.13,.14,granite);
  }
}

// The masonry above each arch is assembled from wedge-shaped faces; the space
// below it stays open, with a recessed wall on the teaching buildings.
function arch(batch,xy,u,v,y,width,spring,rise,top,depth,color) {
  for(let i=0;i<18;i++){
    const a=Math.PI*(1-i/18), b=Math.PI*(1-(i+1)/18);
    const x=u+width*.5*Math.cos(a), X=u+width*.5*Math.cos(b);
    const lo=y+spring+rise*Math.sin(a), hi=y+spring+rise*Math.sin(b);
    for(const z of [v,v-depth])batch.face([up(xy(x,z),lo),up(xy(X,z),hi),up(xy(X,z),y+top),up(xy(x,z),y+top)],
      color,stone,.55,[[x,lo],[X,hi],[X,y+top],[x,y+top]]);
    batch.face([up(xy(x,v),lo),up(xy(X,v),hi),up(xy(X,v-depth),hi),up(xy(x,v-depth),lo)],'#b1a89a',stone);
    const band=.27;
    batch.face([up(xy(x,v+.045),lo),up(xy(X,v+.045),hi),up(xy(X,v+.045),hi+band),up(xy(x,v+.045),lo+band)],cream);
  }
}

function qunxianBlock(batch,geo,lamps,obstacles,signs,xy, {u,v=3,w,d,h,n,kind}) {
  const main=kind===2,end=kind===0, face=v+d/2;
  const y=terrace(batch,geo,rect(xy,u,v,w+1.4,d+1.5),.28,'#c3bbae');
  const title=main ? '群賢樓' : n;
  const openDepth=end?.25:1.42;
  box(batch,xy,u,v-openDepth/2,w,d-openDepth,y,h,cream,stone);
  if(main)box(batch,xy,u,-12.8,14.2,16.5,y,8.7,'#cbbfa9',stone);
  const bays=main?17:end?13:11, pitch=w/bays;
  for(let i=0;i<bays;i++){
    const x=u+(i-(bays-1)/2)*pitch;
    if(!end){
      const middle=main&&Math.abs(x-u)<6.8, spring=middle?2.26:1.86, rise=middle?1.20:.97;
      front(batch,xy,x-pitch*.45,x+pitch*.45,face-openDepth-.04,y+.22,y+3.92,dark,glass);
      arch(batch,xy,x,face,y,pitch*.72,spring,rise,4.42,.48,cream);
      box(batch,xy,x-pitch/2,face-.18,pitch*.28,.95,y,4.42,granite,stone);
      if(i%3===1)lamps.add(...up(xy(x,face-.84),y+2.88),'#e4aa70',.48);
    }
    if(end||!main||Math.abs(x-u)>7.5) {
      const floor=end?y+1.22:y+5.22;
      openings(batch,xy,x,face+.025,pitch,1,floor,end?3:1,end?3.17:3.4,'#594e43');
    }
    openings(batch,xy,x,v-d/2-.027,pitch,1,y+1.0,end?3:2,3.3);
  }
  box(batch,xy,u+w/2,face-.15,.48,.86,y,4.42,cream,stone);
  for(const h0 of [4.37,h-.35])box(batch,xy,u,v,w+.54,d+.45,y+h0,.24,granite);
  sweptRoof(batch,xy,u,v,w+1.8,d+1.6,y+h,end?3.45:2.7,end?tile:greenTile,ridge,end?.18:.64);
  if(end){
    for(const side of [-1,1]){
      const x=u+side*(w/2-5);
      box(batch,xy,x,v+.05,8.2,d+1.6,y,h+.63,'#ded9c6',stone);
      const turn=localFrame(xy(x,v+.05),qunxian.a+Math.PI/2);
      sweptRoof(batch,turn,0,0,d+3,9.8,y+h+.62,3.18,tile,ridge,.14);
      openings(batch,xy,x,face+1.0,7.6,3,y+1.1,3,3.14,'#693e31');
    }
    for(let i=0;i<8;i++){
      const [x,z]=xy(u-15+30*i/7,face+.49);
      cylinder(batch,x,z,y+6.8,y+h+.07,.21,.18,granite,8);
    }
  }
  if(main){
    const central=13.7;
    box(batch,xy,u,2.9,central,14.8,y+4.37,7.1,cream,stone);
    openings(batch,xy,u,10.32,11.8,3,y+5.27,1,3.4,'#70483a');
    for(const du of [-5,-1.67,1.67,5])box(batch,xy,u+du,10.51,.40,.6,y+4.42,7.07,cream);
    sweptRoof(batch,xy,u,2.7,18.4,17.4,y+11.45,3.2,greenTile,ridge,1.08);
    box(batch,xy,u,2.7,13.8,9.5,y+13.88,2.05,'#823c2d');
    sweptRoof(batch,xy,u,2.7,16.2,12.2,y+15.72,2.15,greenTile,ridge,.85);
    box(batch,xy,u,10.6,5.9,.46,y+8.54,1.31,'#3c4742');
    label(signs,xy,u,10.85,5.46,y+8.69,1.02,title);
  }
  const roofHeight=y+h+4.05;
  obstacles.add(rect(xy,u,v,w,d),roofHeight);
  if(main)obstacles.add(rect(xy,u,2.7,17.3,15.6),y+18.95);
  return y;
}

function historicGroup(batch,geo,lamps,obstacles,signs,plantings) {
  const xy=localFrame(qunxian.p,qunxian.a);
  const bodies=[
    {u:-149.4,v:7.5,w:50.4,d:18.4,h:10.65,n:'囊萤楼',kind:0},
    {u:-80.8,v:4.15,w:53.3,d:13.5,h:8.42,n:'同安楼',kind:1},
    {u:-1.13,v:3.4,w:76,d:13,h:8.85,n:'群贤楼',kind:2},
    {u:80.9,v:2.66,w:53.2,d:13.5,h:8.42,n:'集美楼',kind:1},
    {u:148.8,v:7.08,w:50,d:17.2,h:10.65,n:'映雪楼',kind:0},
  ];
  const level=bodies.map(b=>qunxianBlock(batch,geo,lamps,obstacles,signs,xy,b));
  for(let i=1;i<bodies.length;i++){
    const a=bodies[i-1], b=bodies[i];
    const left=a.u+a.w/2-.44,right=b.u-b.w/2+.44;
    const z=4.35,width=right-left,base=Math.max(level[i-1],level[i])+.07;
    const u=(left+right)/2;
    foundation(batch,geo,rect(xy,u,z,width,5.2),base,'#a89b84','#a26a51',stone);
    for(const v of [z-2.25,z+2.25])for(let k=0;k<=Math.ceil(width/3.2);k++)
      box(batch,xy,left+width*k/Math.ceil(width/3.2),v,.33,.33,base,2.9,'#8c5e46');
    sweptRoof(batch,xy,u,z,width+1.4,6.15,base+3.0,1.62,tile,ridge,.19);
    obstacles.add(rect(xy,u,z,width,5.2),base+4.65);
  }
  groundPaving(batch,geo,xy,[-98,99,24,60],'#b5ad98');
  for(const side of [-1,1]){
    for(const u of [29,45,66,84,120,138,159]){
      const [x,z]=xy(u*side,19.9);
      plantings.push([x,groundY(geo,x,z),z,5.3+(u%3)*.48,4+u%3,.60]);
    }
  }
}

function hipAndPediment(batch,xy,u,v,w,d,y,finish=tile) {
  sweptRoof(batch,xy,u,v,w,d,y,4.15,finish,'#c79c77',.48);
  for(const side of [-1,1]){
    const z=v+side*d*.38;
    batch.face([up(xy(u-3.2,z),y),up(xy(u+3.2,z),y),up(xy(u,z),y+4.1)],cream);
    box(batch,xy,u,z,6.8,.6,y+1.55,.33,'#b07d64');
  }
}

function jiagengWing(batch,geo,obstacles,xy,u,v,w,d) {
  const y=terrace(batch,geo,rect(xy,u,v,w+1.1,d+.8),.28);
  const top=y+20.25, frontEdge=v+d/2;
  box(batch,xy,u,v,w,d,y,20.25,'#dad5c3',stone);
  for(const face of [frontEdge+.025,v-d/2-.027]){
    openings(batch,xy,u,face,w-2,7,y+1.4,5,3.32,'#436265');
    box(batch,xy,u,face-.16,7.9,1.15,y,21.9,'#af624f');
    front(batch,xy,u-2.7,u+2.7,face+1.03,y+3.7,y+18.35,'#365d5b',litSurface.greenGlass);
    for(const n of [8.25,12.6,16.8])box(batch,xy,u,face+1.06,5.58,.16,y+n,.20,cream);
    arch(batch,xy,u,face+1.08,y+15.5,5.4,2.2,2.22,5.1,.24,'#e1c9a9');
  }
  for(const side of [-1,1]){
    const wall=localFrame(xy(u+side*w/2,v),jiageng.a+Math.PI/2);
    openings(batch,wall,0,side*.03,d-3,12,y+1.42,6,3.15,'#435a5d');
  }
  const cross=localFrame(xy(u,v),jiageng.a+Math.PI/2);
  hipAndPediment(batch,cross,0,0,d+2.7,w+1.7,top);
  for(const n of [-1,1])sweptRoof(batch,xy,u,v+n*(d/2-3.35),10.6,10.1,top+1.58,2.52,tile,ridge,.45);
  obstacles.add(rect(xy,u,v,w,d),top+4.65);
}

function songen(batch,geo,lamps,obstacles,signs,xy) {
  const [u,v]=jiageng.tower;
  const y=terrace(batch,geo,rect(xy,u,v,32,36),.35);
  box(batch,xy,u,v,30.5,35,y,68.7,'#d2d1bd',stone);
  box(batch,xy,u,v,27.9,29.0,y+68.4,9.9,'#ddd8c0',stone);
  const deck=v+17.5;
  for(const side of [-1,1]){
    const face=v+side*17.5;
    front(batch,xy,u-9.3,u+9.3,face+side*.09,y+10.3,y+65.3,'#2e6c6b',litSurface.greenGlass);
    for(let j=0;j<=17;j++)box(batch,xy,u,face+side*.16,18.75,.23,y+10.37+j*3.22,.30,'#babdab');
    for(let k=-4;k<=4;k++)box(batch,xy,u+k*1.92,face+side*.17,.17,.2,y+10.37,55.1,'#c3c5af');
    for(const a of [-1,1]){
      openings(batch,xy,u+a*12.2,face+side*.32,4.7,2,y+4.6,19,3.26,'#4d5e62');
      box(batch,xy,u+a*14.8,face+side*.07,1.0,.92,y+6.4,61.8,cream);
    }
    front(batch,xy,u-7.2,u+7.2,v+side*14.58,y+67.8,y+77.8,'#2f7770',litSurface.greenGlass);
    arch(batch,xy,u,v+side*14.77,y+67.8,14.4,5.1,4.3,10.7,.29,cream);
  }
  for(const s of [-1,1]){
    const flank=localFrame(xy(u+s*15.25,v),jiageng.a+Math.PI/2);
    openings(batch,flank,0,s*.06,28,8,y+4.6,20,3.15,'#485c5e');
    for(const v0 of [-8.3,8.3])box(batch,xy,u+s*15.63,v+v0,.82,2.25,y+6.5,62.4,cream);
    for(const v0 of [-11,11])sweptRoof(batch,xy,u+s*10.6,v+v0,12.2,12.9,y+73.9,2.8,tile,ridge,.45);
  }
  for(const cap of [68.6,77.8])box(batch,xy,u,v,30.7,31.2,y+cap,.72,'#d8cfb6');
  sweptRoof(batch,xy,u,v,31.9,30.7,y+78.4,8.7,'#b7553b','#e1b187',1.76);
  box(batch,xy,u,v,14.4,13.9,y+85.25,2.3,'#b99276');
  sweptRoof(batch,xy,u,v,16.7,16.2,y+87.4,2.25,'#9f6950','#b5a785',.72);
  lamps.add(...up(xy(u,v),y+89.93),'#c06054',.43);
  box(batch,xy,u,deck+3.6,18.3,7.4,y,5.8,'#d0cbad',stone);
  front(batch,xy,u-7.7,u+7.7,deck+7.34,y+.63,y+5.42,'#376765',litSurface.greenGlass);
  arch(batch,xy,u,deck+7.7,y,15.4,2.8,2.2,5.8,.45,cream);
  label(signs,xy,u,deck+7.78,8.2,y+5.19,.83,'頌恩樓','#473a2e');
  obstacles.add(rect(xy,u,v,31,35),y+90.3);
}

function lakesideGroup(batch,geo,lamps,obstacles,signs,plantings) {
  const xy=localFrame(jiageng.p,jiageng.a), u=jiageng.tower[0];
  const wings=[[-130.45,15.25,17.45,55.5],[-84.5,6.1,17.25,53.9],[26.7,7.55,20.4,55.5],[72.3,14,20.95,55.5]];
  for(const wing of wings)jiagengWing(batch,geo,obstacles,xy,...wing);
  songen(batch,geo,lamps,obstacles,signs,xy);

  // The crest of the long stairs and the concourse connect the five buildings.
  const terraceY=groundY(geo,...xy(u,48))+.37;
  const concourse=rect(xy,u,27.2,214,6.35);
  foundation(batch,geo,concourse,terraceY,'#a69f8f','#c4b8a0');
  for(let i=0;i<48;i++){
    const here=u-105+i*4.43;
    box(batch,xy,here,29.8,.34,.56,terraceY,3.15,cream,stone);
  }
  box(batch,xy,u,27.25,214,6.9,terraceY+3.10,.34,'#c6bda6',stone);
  sweptRoof(batch,xy,u,27.25,215.6,7.63,terraceY+3.46,1.63,tile,ridge,.16);
  obstacles.add(concourse,terraceY+5.1);
  // A white granite stair fronts the central court. The land behind the
  // lower risers is retained as an inclined approach across Boxue Road.
  const top=Math.max(terraceY+.85,groundY(geo,...xy(u,49))+.9);
  for(let j=0;j<10;j++){
    const z=46.2+j*.57,h=top-j*.135;
    const strip=rect(xy,u,z,120,.59);
    foundation(batch,geo,strip,h,'#bcb1a0',j%3===0?'#dad0ba':'#cbbfa9',stone);
  }
  const lake=geo.lakes.find(body=>body.name==='芙蓉湖');
  if(!lake)return;
  const waterY=lake.h+.13;
  const at=(a,t)=>{
    const taper=(1-t)*60+t*48, depth=52.0+(29.5+18*(1-a*a))*t;
    const q=xy(u+a*taper,depth), earth=groundY(geo,...q);
    return up(q,Math.max(waterY+.69,earth+.33));
  };
  for(let j=0;j<13;j++){
    const a=-1+j*2/13,b=a+2/13;
    for(let i=0;i<10;i++){
      const v=i/10,n=(i+1)/10;
      const points=[at(a,v),at(b,v),at(b,n),at(a,n)];
      batch.top(points,(i+j)%3===0?'#c6baa6':'#bbb6a5',litSurface.railPlaza);
    }
    const p=at(a,1),q=at(b,1);
    batch.face([p,q,[q[0],waterY-.42,q[2]],[p[0],waterY-.42,p[2]]],'#a49c83',stone);
    pathTube(batch,[[p[0],p[1]+.13,p[2]],[q[0],q[1]+.13,q[2]]],.17,'#d0c4ac',5);
  }
  for(const side of [-1,1])for(let i=0;i<9;i++){
    const t=(i+.5)/9, xz=xy(u+side*(13+i*4.2),89+10*(1-t*t));
    if(!geo.waterAt(...xz))plantings.push([xz[0],groundY(geo,...xz),xz[1],i%3===0?5.7:2.5,i%3===0?3:8,.55]);
  }
  for(const side of [-1,1])for(const d of [8.8,24.0,42.5]){
    const p=xy(u+side*d,54.9);
    lamps.add(...up(p,groundY(geo,...p)+1.9),'#e2b681',.51);
  }
}

function furongHall(batch,geo,obstacles,[, ,p,a,w,d]) {
  const xy=localFrame(p,a), y=terrace(batch,geo,rect(xy,0,0,w+1.35,d+1.35),.23);
  const height=12.4;
  box(batch,xy,0,0,w,d,y,height,'#95493a',litSurface.portico);
  const bays=Math.max(10,Math.floor(w/4.65));
  for(const side of [-1,1]){
    const face=side*(d/2+.045);
    openings(batch,xy,0,face,w-3,bays,y+1.21,3,3.84,'#5f6758');
    for(const h of [3.71,7.68,11.53])box(batch,xy,0,face,w,.26,y+h,.24,'#c7a686');
    for(let i=0;i<=bays;i++)
      box(batch,xy,w*(i/bays-.5),face,.49,.59,y,.16+height,'#c7ab8e',stone);
  }
  sweptRoof(batch,xy,0,0,w+2.1,d+2.1,y+height,4.2,'#a97658','#d2a27e',.43);
  obstacles.add(rect(xy,0,0,w,d),y+height+4.5);
}

function palms(batch,geo,xy) {
  for(const s of [-1,1])for(let i=0;i<6;i++){
    const [x,z]=xy(s*(6.85+.28*i),-17-i*8.4);
    const y=groundY(geo,x,z), h=6.4+Math.sin(i*2.29)*.78;
    cylinder(batch,x,z,y-.2,y+h,.21,.105,'#97856a',7);
    for(let j=0;j<9;j++){
      const a=j*Math.PI*2/9+.14*i,dx=Math.cos(a),dz=Math.sin(a), r=2.85+.5*Math.sin(j*4.6+i);
      const A=[x,y+h,z], B=[x+dx*r*.38,y+h+.48,z+dz*r*.38], C=[x+dx*r,y+h-.77,z+dz*r];
      batch.top([A,[B[0]-dz*.51,B[1],B[2]+dx*.51],C,[B[0]+dz*.45,B[1]-.14,B[2]-dx*.45]],j%3===1?'#697750':'#46613e');
      pathTube(batch,[A,B,C],.023,'#9e9d60',4);
    }
  }
}

function baichengGate(batch,geo,lamps,obstacles,signs) {
  const xy=localFrame(baicheng.p,baicheng.a), base=groundY(geo,...baicheng.p)+.11;
  const width=16.5, opening=9.7, half=width/2, y=base;
  for(const side of [-1,1]){
    const u=side*(half+opening/2)/2,w=half-opening/2;
    const ring=rect(xy,u,-.62,w,3.50);
    foundation(batch,geo,ring,base,'#bcb39e',granite,stone);
    box(batch,xy,u,-.62,w,3.50,base,12.1,'#d7cec1',stone);
    for(let j=1;j<10;j++){
      box(batch,xy,u,1.15,w,.043,y+j*1.11,.035,'#9d968a');
      box(batch,xy,u,-2.39,w,.045,y+j*1.11,.032,'#aaa090');
    }
    obstacles.add(ring,base+13.3);
    const guard=side*(half+5.5), guardRing=rect(xy,guard,-3.6,10.6,8.0);
    const sill=terrace(batch,geo,guardRing,.13,'#b6b1a8');
    box(batch,xy,guard,-3.6,10.5,7.8,sill,3.08,'#a8a79d',stone);
    box(batch,xy,guard,-3.6,11.0,8.55,sill+3.09,.36,'#c0bcaf',stone);
    front(batch,xy,guard-4,guard+4,.33,sill+.7,sill+2.56,'#46575b',glass);
    for(let i=-4;i<=4;i++)box(batch,xy,guard+i*.92,.38,.10,.16,sill+1.1,1.62,'#53554d');
    obstacles.add(guardRing,sill+3.46);
    lamps.add(...up(xy(side*6.12,.66),base+2.28),'#d8ae75',.42);
  }
  arch(batch,xy,0,1.13,y,opening,8.03,2.35,12.19,3.5,'#d3cabc');
  for(let k=0;k<3;k++){
    const w=width-2.37*k;
    box(batch,xy,0,-.62,w,3.61- .19*k,y+12.1+k*.83,.86,'#d7cbbb',stone);
    box(batch,xy,0,-.61,w+.18,3.74-.17*k,y+12.85+k*.83,.14,cream);
  }
  obstacles.add(rect(xy,0,-.62,width,3.5),base+14.65);
  label(signs,xy,0,1.17,7.98,y+11.10,.83,'廈 門 大 學','#786c56');
  palms(batch,geo,xy);
}

function yanwuBallCourts(batch,geo) {
  for (const [,p,a,w,d] of yanwuCourts) {
    const xy=localFrame(p,a), u=w/2-.32, v=d/2-.32;
    groundPaving(batch,geo,xy,[-u,u,-v,v],'#7e5346');
    const trace=(x1,z1,x2,z2)=>{
      const q=xy(x1,z1), r=xy(x2,z2);
      const y=point=>groundY(geo,...point)+.29;
      pathTube(batch,[up(q,y(q)),up(r,y(r))],.037,'#ded1bb',4);
    };
    for (const z of [-v+.36,v-.36])trace(-u+.4,z,u-.4,z);
    for (const x of [-u+.4,0,u-.4])trace(x,-v+.36,x,v-.36);
    for(const s of [-1,1]) {
      const x=s*(u-.6), key=x-s*5.5, edge=key+s*3.5;
      trace(x,-2.45,key,-2.45);
      trace(key,-2.45,key,2.45);
      trace(key,2.45,x,2.45);
      const [tx,tz]=xy(edge,0),y=groundY(geo,tx,tz)+.25;
      cylinder(batch,tx,tz,y,y+3.15,.071,.051,'#52605d',6);
      box(batch,xy,edge-s*.68,0,.09,1.65,y+2.78,.85,'#c0cac2');
    }
  }
}

export function buildCampus(batch,geo,lamps,obstacles,signs,plantings=[]) {
  historicGroup(batch,geo,lamps,obstacles,signs,plantings);
  lakesideGroup(batch,geo,lamps,obstacles,signs,plantings);
  for(const hall of furongHouses)furongHall(batch,geo,obstacles,hall);
  baichengGate(batch,geo,lamps,obstacles,signs);
  paintOval(batch,yanwuField,8,'#527b51','#3b7192',geo);
  yanwuBallCourts(batch,geo);
  for(const {width,path} of campusRoads){
    const rows=path.sections(5.3);
    const height=(x,z)=>groundY(geo,x,z)+.43;
    const paved=width>=4.2;
    ribbon(batch,rows,-width/2,width/2,height,paved?'#6a6e66':'#aca88d',paved?litSurface.streetAsphalt:litSurface.stone,.52);
    if(paved){
      for(const side of [-1,1]){
        ribbon(batch,rows,side*(width/2-.05),side*(width/2+.20),(x,z)=>height(x,z)+.07,'#bbb3a0');
      }
    }
    if(width<2.7)continue;
    for(let s=27;s<path.length-12;s+=53){
      const q=path.sample(s), x=q.x-q.uz*(width/2+1.4),z=q.z+q.ux*(width/2+1.4);
      if(!inCampus(x,z)||geo.waterAt(x,z)||obstacles.heightAt(x,z)>groundY(geo,x,z)+1)continue;
      const y=groundY(geo,x,z);
      cylinder(batch,x,z,y,y+3.1,.115,.064,'#736d50',6);
      lamps.add(x,y+3.13,z,'#ecd7a2',.30);
    }
  }
}
