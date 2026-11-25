import { cylinder, groundY, litSurface, prism, signedArea, TAU } from './scenery-mesh.js';
import { ellipse, foundation, groundPaving, localFrame, rect, sweptRoof, terrace, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { archWindow, gardenWalk, hipRoof, monolith, stairFlight, stoneLookout } from './landmark-gulangyu.js';
import { bearing, estateCourt, huangFrame, footprintFrame, plan, trinityFrame } from './gulangyu-layout.js';

const brick = '#aa604c', ivory = '#e7deca', tile = '#b36a4d', stone = '#b7aa96';

function gable(batch,xy,length,span,eave,rise,wall,roof) {
  const half = length/2, w = span/2;
  for (const side of [-1,1]) {
    const edge = [up(xy(-half,side*w),eave), up(xy(half,side*w),eave)];
    const ridge = [up(xy(-half,0),eave+rise), up(xy(half,0),eave+rise)];
    batch.top([edge[0],edge[1],ridge[1],ridge[0]],roof,16,.36,[[0,0],[length,0],[length,w],[0,w]]);
    batch.face([up(xy(side*half,-w),eave-.07),up(xy(side*half,0),eave+rise),up(xy(side*half,w),eave-.07)],wall);
    pathTube(batch,[up(xy(side*half,-w),eave),up(xy(side*half,0),eave+rise),up(xy(side*half,w),eave)],.16,ivory,5);
  }
}

function cross(batch,xy,u,v,y,h) {
  prism(batch,rect(xy,u,v,h*.08,h*.09),y,y+h,'#655b4e','#b8a17d');
  prism(batch,rect(xy,u,v,h*.52,h*.10),y+h*.62,y+h*.71,'#655b4e','#b8a17d');
}

function medallion(batch,xy,u,v,y,r) {
  const rim = [], glass = '#475b5a';
  for(let i=0;i<=20;i++) {
    const a=TAU*i/20;
    rim.push(up(xy(u+r*Math.cos(a),v),y+r*Math.sin(a)));
  }
  batch.face(rim.slice(0,-1),glass,litSurface.hallWindow);
  pathTube(batch,rim,.12,ivory,6);
  for(let i=0;i<8;i++) {
    const a=TAU*i/8;
    pathTube(batch,[up(xy(u,v),y),up(xy(u+r*Math.cos(a),v),y+r*Math.sin(a))],.048,ivory,4);
  }
}

function trinity(batch,geo,lamps,obstacles) {
  const ring = plan.trinity, { xy,width,depth,center,angle } = trinityFrame;
  const base = Math.max(...ring.map(p=>groundY(geo,...p)))+.45, eave=base+9.1, ridge=eave+3.4;
  const court = rect(xy,0,0,width+3.8,depth+3.8);
  foundation(batch,geo,court,base,stone,'#c6bdab');
  obstacles.add(court,base+1.05);
  // Two flights climb the downhill faces. Leave an opening in each balustrade.
  for (let i=0;i<4;i++) {
    const a=court[i], b=court[(i+1)%4], hasStairs=i===1 || i===2;
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const frame=localFrame([(a[0]+b[0])/2,(a[1]+b[1])/2],bearing(a,b));
    if (hasStairs) {
      const edge=frame(0,0), foot=frame(0,-8);
      stairFlight(batch,edge,base,foot,groundY(geo,...foot)+.13,6.4,.33,stone,true,
        (x,z)=>groundY(geo,x,z),obstacles);
    }
    for (const [l,r] of hasStairs ? [[-len/2,-3.35],[3.35,len/2]] : [[-len/2,len/2]]) {
      prism(batch,rect(frame,(l+r)/2,0,r-l,.39),base+.83,base+1.04,'#bcb19d',ivory);
      const n=Math.ceil((r-l)/.87);
      for (let j=0;j<=n;j++)
        cylinder(batch,...frame(l+(r-l)*j/n,0),base,base+.84,.125,.095,'#bcb4a1',6);
    }
  }
  prism(batch,ring,base,eave,brick,ivory,14,.33);
  const bounds= signedArea(ring)>0 ? ring : ring.toReversed();
  for(let i=0;i<bounds.length;i++) {
    const a=bounds[i], b=bounds[(i+1)%bounds.length], len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const bays=Math.max(1,Math.floor(len/3.75));
    if(len>6) for(let k=0;k<bays;k++) {
      const t=(k+.5)/bays;
      archWindow(batch,a,b,t,base+.75,1.75,5.95,ivory);
      const jamb = localFrame([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],bearing(a,b));
      const crown = eave-1.62;
      batch.face([up(jamb(-1.2,-.17),crown),up(jamb(0,-.17),crown+.65),up(jamb(1.2,-.17),crown)],ivory);
      if(k>0) {
        const p=[a[0]+(b[0]-a[0])*k/bays,a[1]+(b[1]-a[1])*k/bays];
        prism(batch,rect(localFrame(p,bearing(a,b)),0,0,.71,.62),base,eave-.32,'#aa634e',ivory,14);
      }
    }
    pathTube(batch,[up(a,eave-.4),up(b,eave-.4)],.25,ivory,4);
  }
  // The two roof ridges cross at the octagonal lantern, leaving all four
  // triangular pediments visible instead of roofing across the re-entrant corners.
  gable(batch,xy,width+.6,14.95,eave,3.4,ivory,tile);
  gable(batch,(u,v)=>xy(-v,u),depth+.6,16.55,eave,3.4,ivory,'#bc7554');
  const lantern=ellipse(xy,0,0,3.8,3.8,8,Math.PI/8);
  prism(batch,lantern,ridge-.5,ridge+.32,ivory,ivory);
  cylinder(batch,...center,ridge+.3,ridge+2.72,3.45,3.45,'#724f40',8,angle+Math.PI/8,'#baa083',litSurface.hallWindow);
  for(const p of lantern)cylinder(batch,...p,ridge+.26,ridge+2.78,.17,.16,ivory,6);
  cylinder(batch,...center,ridge+2.72,ridge+2.96,4.0,4.0,ivory,8,angle+Math.PI/8);
  cylinder(batch,...center,ridge+2.95,ridge+4.77,4.04,.34,tile,8,angle+Math.PI/8);
  cross(batch,xy,0,0,ridge+4.74,1.7);
  obstacles.add(ring,ridge);
  obstacles.add(lantern,ridge+6.44);
  for(const p of [xy(0,depth/2),xy(width/2,0)])lamps.add(...up(p,eave-.7),'#ffdab0',.95);
}

function catholic(batch,geo,lamps,obstacles) {
  const ring=plan.catholic, {xy,width,depth}=footprintFrame(ring,bearing(ring[0],ring[1]));
  const base=terrace(batch,geo,ring,.33), eave=base+6.7, face=depth/2, tower=face-2.8;
  prism(batch,ring,base,eave,'#e5e0ce',ivory);
  gable(batch,(u,v)=>xy(v,u+1.1),depth-4.9,width+.38,eave,2.25,ivory,'#886e61');
  const nave= signedArea(ring)>0 ? ring : ring.toReversed();
  for(let i=0;i<nave.length;i++) {
    const a=nave[i], b=nave[(i+1)%nave.length], length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<16) continue;
    for(const t of [.18,.40,.62,.82]) archWindow(batch,a,b,t,base+1.7,1.18,3.5,'#c6c2ac');
  }
  const front=rect(xy,0,tower,5.65,5.85);
  prism(batch,front,base,base+10.05,'#ece8d8',ivory);
  archWindow(batch,front[2],front[3],.5,base+.08,2.32,3.7,'#c5c4b6');
  medallion(batch,xy,0,tower+3.0,base+6.55,1.08);
  for(const h of [4.45,8.65,10.0,13.75])
    prism(batch,rect(xy,0,tower,6.1,6.32),base+h-.28,base+h,ivory,'#c8c6b8');
  for(const p of rect(xy,0,tower,4.94,5.13)) {
    const col=localFrame(p);
    prism(batch,rect(col,0,0,.65,.65),base+10,base+13.8,'#dfdece',ivory);
    cylinder(batch,...p,base+13.75,base+15.25,.49,0,ivory,4);
  }
  const [bx,bz]=xy(0,tower);
  cylinder(batch,bx,bz,base+11.15,base+12.65,.82,.46,'#756754',12);
  const cap=rect(xy,0,tower,5.5,5.65), apex=up(xy(0,tower),base+19.7);
  for(let i=0;i<4;i++)batch.top([up(cap[i],base+13.75),up(cap[(i+1)%4],base+13.75),apex],'#cacbbd');
  cross(batch,xy,0,tower,base+19.68,1.44);
  obstacles.add(ring,eave+2.25); obstacles.add(front,base+21.12);
  lamps.add(bx,base+12.1,bz,'#ffd998',1.15);
}

function column(batch,p,base,height,r) {
  cylinder(batch,...p,base,base+.31,r*1.42,r*1.28,ivory,8);
  cylinder(batch,...p,base+.30,base+height-.32,r,r*.86,'#d1c6ac',10);
  cylinder(batch,...p,base+height-.32,base+height,r*.98,r*1.42,ivory,8);
}

function haitian(batch,geo,lamps,obstacles) {
  groundPaving(batch,geo,estateCourt,[-2.9,2.9,-52,-12],'#b9aa95');
  for (const [a,b] of [[-31,-2.9],[2.9,31]])
    groundPaving(batch,geo,estateCourt,[a,b,-22,-18],'#c0b19d');
  for(const [i,ring] of plan.haitian.entries()) {
    const {xy,width:w,depth:d}=footprintFrame(ring,bearing(ring[0],ring[1]));
    const y=terrace(batch,geo,ring,.25), main=i===0, eave=y+(main?9.6:8.75);
    // Each of the four flanking villas keeps its own surveyed lot and floor elevation.
    prism(batch,rect(xy,0,.7,w-2.3,d-1.8),y+.15,eave,main?'#b2664b':'#bf9271',null,4,.62);
    for(const slab of [y+.32,y+4.26,eave]) prism(batch,ring,slab-.28,slab,ivory,'#c4a286');
    for(const v of [-1,1]) for(let j=0;j<5;j++) {
      const p=xy((j/4-.5)*(w-1.22),v*(d/2-.49));
      column(batch,p,y+.32,3.67,.22); column(batch,p,y+4.27,eave-y-4.3,.21);
    }
    if(main) {
      const door = xy(0,-d*.5), foot = xy(0,-d*.5-4.2);
      stairFlight(batch,door,y+.33,foot,groundY(geo,...foot)+.22,6.1,.32,stone,true,
        (x,z)=>groundY(geo,x,z),obstacles);
      sweptRoof(batch,xy,0,0,w+1.15,d+1.1,eave,2.85,'#8d765c','#c0ac87',.47);
      const porch=rect(xy,0,-d*.38,w*.44,d*.29);
      prism(batch,porch,eave+1.14,eave+3.25,'#a8634a',ivory,4);
      sweptRoof(batch,xy,0,-d*.38,w*.53,d*.37,eave+3.25,2.86,'#97825c','#d2b98f',.62);
      obstacles.add(porch,eave+6.98);
    } else hipRoof(batch,xy,0,0,w+.64,d+.74,eave,3.05,i>2?'#b7835b':'#957962','#bd9a75');
    obstacles.add(ring,eave+(main?3.55:3.22));
    for(const u of [-w*.34,w*.34])lamps.add(...up(xy(u,-d*.49),y+4.0),'#ffd6a2',.83);
  }
}

function huangVilla(batch,geo,lamps,obstacles) {
  const {xy}=huangFrame, ring=plan.huangVilla;
  const floor=Math.max(...ring.map(p=>groundY(geo,...p)))+1.25, eave=floor+8.7;
  const plinth=rect(xy,-.5,1,23.3,22.5);
  foundation(batch,geo,plinth,floor,'#a09a8c','#c5bdac');
  obstacles.add(plinth,floor);
  // Set back the central facade behind the mapped projection. Its open front
  // carries a two-storey Tuscan order, with no intermediate slab across it.
  const core=[...ring.slice(0,8),xy(4,5.8),xy(-5.5,5.8),...ring.slice(10)];
  prism(batch,core,floor,eave,'#aaa193','#afa69a');
  const outer=signedArea(core)>0?core:core.toReversed();
  for(let i=0;i<outer.length;i++){
    const a=outer[i],b=outer[(i+1)%outer.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(len<3)continue;
    const bays=Math.max(1,Math.round(len/3.2));
    for(let j=0;j<bays;j++)for(const h of [.40,4.68])
      archWindow(batch,a,b,(j+.5)/bays,floor+h,1.45,3.0,'#e1d5bd');
  }
  const front=(u,v,h)=>up(xy(u,v),floor+h);
  const doorWall=rect(xy,-.8,5.75,4.5,.34);
  prism(batch,doorWall,floor,eave,'#9f9181','#b4a797');
  for(const [lo,hi] of [[.06,3.83],[4.65,8.13]]){
    batch.face([front(-2.08,5.95,lo),front(.48,5.95,lo),front(.48,5.95,hi),front(-2.08,5.95,hi)],'#543d32');
    for(const u of [-1.93,-.95])batch.face([front(u,5.97,lo+.20),front(u+.86,5.97,lo+.20),
      front(u+.86,5.97,hi-.25),front(u,5.97,hi-.25)],'#514a40');
  }
  const balcony=rect(xy,-.8,6.45,4.7,1.4);
  prism(batch,balcony,floor+4.17,floor+4.45,'#8e8276',stone);
  for(let i=0;i<3;i++){
    const a=balcony[i+1],b=balcony[(i+2)%4],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.28);
    pathTube(batch,[up(a,floor+5.33),up(b,floor+5.33)],.065,'#574c42');
    for(let j=0;j<n;j++)cylinder(batch,a[0]+j*(b[0]-a[0])/n,a[1]+j*(b[1]-a[1])/n,
      floor+4.45,floor+5.33,.028,.028,'#574c42',5);
  }
  const porch=Array.from({length:19},(_,i)=>{
    const a=i*Math.PI/18;
    return xy(-.8+5.0*Math.cos(a),5.3+5.65*Math.sin(a));
  });
  for(const y of [floor,eave])
    prism(batch,porch,y-.32,y+.14,'#baad98',ivory);
  for(const i of [2,7,11,16])column(batch,porch[i],floor+.14,8.24,.44);
  for(let i=1;i<porch.length;i++){
    const a=porch[i-1],b=porch[i];
    pathTube(batch,[up(a,eave+.85),up(b,eave+.85)],.115,ivory,5);
    cylinder(batch,...a,eave+.13,eave+.81,.115,.085,ivory,7);
  }
  // The recessed top floor opens to a three-bay loggia above the bowed porch.
  const attic=rect(xy,-1,-2.5,13.2,8.2);
  prism(batch,attic,eave,eave+3.16,'#ab9c8d',ivory);
  for(let i=0;i<4;i++)for(const t of [.22,.5,.78])
    archWindow(batch,attic[i],attic[(i+1)%4],t,eave+.4,1.14,2.16);
  for(const u of [-7.1,-3.25,1.25,5.1])column(batch,xy(u,5.2),eave+.14,3.04,.23);
  const atticRoof=rect(xy,-1,-.5,13.65,12.05);
  prism(batch,atticRoof,eave+3.10,eave+3.44,ivory,'#aa9c8d');
  for(let i=0;i<4;i++){
    const a=atticRoof[i],b=atticRoof[(i+1)%4];
    pathTube(batch,[up(a,eave+4.06),up(b,eave+4.06)],.10,'#b1a696',5);
    for(let j=0;j<15;j++)cylinder(batch,a[0]+(b[0]-a[0])*j/15,a[1]+(b[1]-a[1])*j/15,eave+3.44,eave+4.02,.085,.063,ivory,6);
  }
  // Small belvedere at the southeast corner of the roof terrace.
  const roof=rect(xy,7.5,-.7,3.8,3.8);
  for(const p of roof)column(batch,p,eave,2.72,.16);
  const apex=up(xy(7.5,-.7),eave+4.55);
  for(let i=0;i<4;i++)batch.top([up(roof[i],eave+2.72),up(roof[(i+1)%4],eave+2.72),apex],'#82766b');
  obstacles.add(ring,eave+.92); obstacles.add(atticRoof,eave+4.16); obstacles.add(roof,eave+4.55);
  const stair=xy(-.8,12.25),foot=xy(-.8,17.5);
  stairFlight(batch,stair,floor,foot,groundY(geo,...foot)+.20,5.2,.33,stone,true,(x,z)=>groundY(geo,x,z),obstacles);
  for(const [a,b] of [[-11.8,-3.7],[2.1,10.8]]){
    const frame=rect(xy,(a+b)/2,12.15,b-a,.30);
    prism(batch,frame,floor+.83,floor+1.02,ivory,ivory);
    const n=Math.ceil((b-a)/.8);
    for(let j=0;j<=n;j++)cylinder(batch,...xy(a+j*(b-a)/n,12.15),floor,floor+.86,.13,.10,stone,7);
  }
  for(const side of [-1,1]){
    const walkU=-1+side*6.15;
    groundPaving(batch,geo,xy,[walkU-.75,walkU+.75,16.8,32.9],'#b8ad9b');
    groundPaving(batch,geo,xy,[Math.min(walkU,-1),Math.max(walkU,-1),18.2,19.45],'#b8ad9b');
  }
  const pond=xy(-1,26), basin=ellipse(xy,-1,26,5.0,4.2,32), water=groundY(geo,...pond)+.37;
  foundation(batch,geo,basin,water+.14,'#9a9281',ivory);
  prism(batch,ellipse(xy,-1,26,4.65,3.85,32),water+.145,water+.16,'#748e81','#739080');
  const innerBasin=ellipse(xy,-1.5,26.1,1.48,1.35,24);
  prism(batch,innerBasin,water+.11,water+.32,'#968d7d','#aca18d');
  prism(batch,ellipse(xy,-1.5,26.1,1.27,1.14,24),water+.32,water+.34,'#73776b','#767d6d');
  for(const [u,v,r,h,seed] of [[-1.4,26,.88,3.05,1],[-2,26.5,.67,1.74,2],[-.8,25.6,.66,2.15,4]])
    monolith(batch,geo,xy(u,v),r,.74*r,.42,water+h,seed,'#867d6f',obstacles);
  // Wall along the mapped courtyard. The Fujian Road side opens to the forecourt.
  for(let i=0;i<plan.huangCourt.length;i++){
    const a=plan.huangCourt[i],b=plan.huangCourt[(i+1)%plan.huangCourt.length];
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]),frame=localFrame(a,bearing(a,b)),bays=Math.ceil(len/3.5);
    for(let j=0;j<bays;j++){
      if(i===1 || (i===0 && j===bays-1))continue;
      const p=frame(j*len/bays,0),q=frame((j+1)*len/bays,0),h=groundY(geo,...p),k=groundY(geo,...q);
      batch.face([up(p,h-.25),up(q,k-.25),up(q,k+.66),up(p,h+.66)],'#ab9e8b');
      pathTube(batch,[up(p,h+.74),up(q,k+.74)],.13,ivory,5);
      prism(batch,rect(frame,j*len/bays,0,.46,.48),h-.2,h+1.16,stone,ivory);
    }
  }
  lamps.add(...up(porch[3],eave-.42),'#ffdbaf',.8);
}

function consulate(batch,geo,lamps,obstacles) {
  const ring=plan.consulate,{xy,width:w,depth:d}=footprintFrame(ring,bearing(ring[0],ring[1]));
  const y=terrace(batch,geo,ring,.6), cornice=y+10.2;
  prism(batch,rect(xy,0,1.2,w-.75,d-2.9),y,cornice,'#c99b81',null,4,.3);
  for (const h of [y+.35,y+5.0,cornice]) prism(batch,ring,h-.32,h,ivory,'#caba9c');
  for(let i=0;i<8;i++)column(batch,xy((i/7-.5)*(w-1.25),-d/2+.44),y+.35,9.83,.35);
  hipRoof(batch,xy,0,0,w+1.1,d+.95,cornice,3.8,'#a6634c','#c09471');
  gable(batch,(u,v)=>xy(v,-d*.40+u),d*.3,w*.46,cornice+.08,2.65,ivory,tile);
  obstacles.add(ring,cornice+4);
  lamps.add(...up(xy(0,-d*.45),y+8.3),'#fbd5a3',1.12);
}

function koxinga(batch,geo,lamps,obstacles) {
  const center=plan.statue, xy=localFrame(center,1.19), deck=29.5;
  const rock=monolith(batch,geo,center,20.8,15.4,-.36,deck-.25,3.8,'#b7a391',obstacles);
  const shoulder=monolith(batch,geo,[center[0]-16,center[1]+5],20.5,12,-.34,deck-6.8,1.5,'#b5a28b',obstacles);
  const support=(x,z)=>Math.max(groundY(geo,x,z),rock(x,z),shoulder(x,z));
  const terraceRing=plan.statueTerrace;
  const open=terraceRing.reduce((best,p,i)=>p[0]<terraceRing[best][0]?i:best,0);
  stoneLookout(batch,terraceRing,deck,support,'#b8a795',open);
  obstacles.add(terraceRing,deck+1.1);
  const start=terraceRing[open], end=[center[0]-44,center[1]+15];
  stairFlight(batch,start,deck,end,groundY(geo,...end)+.15,2.25,.65,stone,true,support,obstacles);

  // A carved, armoured figure faces the channel. Offset cross-sections define
  // the long cloak, forward boot, belt, helmet and the hand resting on the hilt.
  const robe='#d7cdb7', shade='#b8ad99', face='#ded2b9';
  const carve=(layers,tint,folds=0)=>{
    let prev;
    for(const [h,u,v,rx,rz] of layers){
      const rim=Array.from({length:20},(_,i)=>{
        const t=TAU*i/20, r=1+folds*Math.cos(7*t+.24*h);
        return up(xy(u+r*rx*Math.cos(t),v+r*rz*Math.sin(t)),deck+h);
      });
      if(prev)for(let i=0;i<rim.length;i++){
        const j=(i+1)%rim.length;
        batch.face([prev[i],rim[i],rim[j],prev[j]],tint,litSurface.statueStone);
      }
      prev=rim;
    }
    batch.top(prev,tint,litSurface.statueStone);
  };
  carve([[.02,0,0,3.30,2.4],[.56,0,0,3.06,2.28],[.82,0,0,2.88,2.12]],'#c8baa1');
  for(const side of [-1,1])
    carve([[.8,side*1.42,-.50,1.04,1.33],[1.22,side*1.42,-.62,1.11,1.47],[2.1,side*1.34,-.18,.9,1.02]],shade);
  carve([[1.05,-.18,.26,2.87,1.76],[2.15,-.12,.12,2.96,1.84],[4.85,-.05,.03,2.42,1.66],[7.75,.12,-.04,1.65,1.09],[8.27,.05,-.05,1.78,1.17]],robe,.095);
  carve([[7.80,.06,-.03,1.78,1.18],[8.23,.06,-.03,1.86,1.22],[8.48,0,-.02,1.82,1.2]],shade);
  carve([[8.32,.02,-.03,1.78,1.16],[9.55,-.03,-.04,2.02,1.34],[11.55,-.16,.02,2.29,1.24],[12.10,-.23,.07,1.56,.99],[12.42,-.22,0,.69,.69]],robe);
  carve([[1.1,-.32,1.19,2.82,1.20],[4.2,-.25,1.27,2.36,1.04],[8.5,-.12,1.17,2.11,.88],[11.74,-.18,.73,2.53,.88],[12.14,-.25,.37,1.63,.84]],'#c7bda8',.08);
  carve([[12.04,-.23,0,.66,.68],[12.43,-.28,-.27,.74,.73],[13.08,-.34,-.40,.94,.89],[13.84,-.38,-.31,1.0,.94],[14.38,-.38,-.17,.88,.84]],face);
  carve([[12.84,-.39,.13,1.04,.87],[13.7,-.38,.08,1.12,.99],[14.25,-.36,-.20,1.16,1.04],[14.51,-.38,-.19,1.02,.94],[15.18,-.38,-.17,.85,.82],[15.7,-.4,-.13,.18,.17]],'#c9bea8');
  carve([[12.64,-.37,-1.17,.22,.16],[13.13,-.34,-1.23,.29,.24],[13.51,-.34,-1.12,.19,.18]],face);
  const line = (points, radius, tint) => pathTube(batch,points.map(([u,v,h])=>up(xy(u,v),deck+h)),radius,tint,6,litSurface.statueStone);
  // The helmet visor, turned face and breastplate are visible in silhouette from the sea.
  carve([[13.94,-.38,-.36,1.13,1.07],[14.09,-.39,-.39,1.20,1.13],[14.21,-.38,-.32,1.13,1.05]],shade);
  line([[-.92,-.90,13.53],[-.65,-1.15,13.56],[-.45,-1.23,13.48]],.10,shade);
  line([[-.18,-1.24,13.48],[.02,-1.16,13.51],[.32,-1.00,13.46]],.10,shade);
  line([[-.75,-1.03,12.91],[-.49,-1.19,12.98],[-.31,-1.27,13.01],[.02,-1.06,12.87]],.09,shade);
  line([[-2.22,-.14,11.60],[-1.44,-.85,11.90],[-.52,-1.13,11.80],[.52,-1.12,11.49],[2.12,-.48,11.22]],.22,shade);
  for (const side of [-1,1]) {
    for (const u of [.50,.96,1.39])
      line([[side*u,-1.13,10.94],[side*u,-1.34,10.26],[side*u,-1.17,9.71]],.09,shade);
  }
  for(const s of [-1,1]){
    carve([[8.2,s*1.78,-.85,.57,.6],[8.8,s*1.95,-.54,.69,.74],[9.55,s*2.08,.0,.74,.70],[11.35,s*1.81,.08,.84,.79],[11.91,s*1.64,.06,.72,.73]],robe);
    carve([[7.84,s*1.76,-.94,.40,.42],[8.22,s*1.76,-1.01,.53,.52],[8.56,s*1.80,-.88,.49,.43]],face);
  }
  pathTube(batch,[up(xy(1.72,-.99),deck+8.42),up(xy(2.00,-.92),deck+6.75),up(xy(2.78,-.44),deck+2.00)],.20,shade,7);
  pathTube(batch,[up(xy(1.35,-.94),deck+7.65),up(xy(2.29,-.94),deck+7.73)],.13,robe,6);
  obstacles.add(ellipse(xy,0,0,3.35,2.45,16),deck+15.7);
  for(const u of [-3.8,3.8])lamps.add(...up(xy(u,-2.9),deck+.22),'#ffe1ad',1.05);

  gardenWalk(batch,geo,lamps,obstacles,plan.seaWalk,2.25);
  const hut=plan.seaPavilion, f=footprintFrame(hut,bearing(hut[0],hut[1]));
  const base=3.45;
  prism(batch,hut,-1.5,base,'#aa9884','#c4b196',13);
  for(const p of rect(f.xy,0,0,f.width-1.2,f.depth-1.2))column(batch,p,base,3.12,.19);
  hipRoof(batch,f.xy,0,0,f.width+.55,f.depth+.55,base+3.12,1.95,'#ad7854','#c5a078');
  obstacles.add(hut,base+5.24);
}

export function buildIslandHeritage(batch,geo,lamps,obstacles) {
  trinity(batch,geo,lamps,obstacles);
  catholic(batch,geo,lamps,obstacles);
  haitian(batch,geo,lamps,obstacles);
  huangVilla(batch,geo,lamps,obstacles);
  consulate(batch,geo,lamps,obstacles);
  koxinga(batch,geo,lamps,obstacles);
}
