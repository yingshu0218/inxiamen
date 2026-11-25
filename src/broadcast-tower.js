import { ShapeUtils, Vector2 } from 'three';
import { cylinder, litSurface, prism, TAU } from './scenery-mesh.js';
import { localFrame, rect, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { plan } from './hubin-layout.js';
import { curtainDatum, curtainStorey } from './broadcast-glass.js';

// A and B are the mapped ends of the lake facade. D is behind B on the
// windowed street side, and C is the back end of the fluted west return.
const [a,b,d,c]=plan.towerFoot;
const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
export const towerFrame=localFrame(a,angle);
const width=Math.hypot(b[0]-a[0],b[1]-a[1]), co=Math.cos(angle), si=Math.sin(angle);
const local=p=>[(p[0]-a[0])*co+(p[1]-a[1])*si, -(p[0]-a[0])*si+(p[1]-a[1])*co];
const rear=local(c), farEast=local(d);
const at=towerFrame, bay=width/24;
const toRing=points=>points.map(([u,v])=>at(u,v));
const ivory='#d4d4c9', reveal='#677679';
const metal=litSurface.crownMetal, stone=litSurface.graniteFacing, glass=litSurface.mediaGlass;

function wallFrame(base,start,end){
  const [x,z]=at(...start), [ex,ez]=at(...end), length=Math.hypot(ex-x,ez-z);
  const ux=(ex-x)/length, uz=(ez-z)/length;
  return {length, point:(s,h,d=0)=>[x+s*ux-d*uz,base+h,z+s*uz+d*ux]};
}

function wallFace(batch,wall,points,color,style=0,seed=.5,offset=0,reverse=false){
  const order=reverse?points.toReversed():points;
  batch.face(order.map(([s,h])=>wall.point(s,h,offset)),color,style,seed,order);
}
const opening=(s,h,w,t)=>[[s-w/2,h],[s+w/2,h],[s+w/2,h+t],[s-w/2,h+t]];
const glassUV=outline=>outline.map(([s,h])=>[s/bay,h]);
function glazedFace(batch,wall,outline,seed){
  batch.face(outline.map(([s,h])=>wall.point(s,h)),'#477a96',glass,seed,glassUV(outline));
}

// Cut the apertures out of the stone itself. All visible returns lead back to
// the inner pane; their shadows and the depth of the opening survive an oblique flyby.
function piercedWall(batch,wall,outline,openings,color,finish,depth=.32){
  const holes=openings.map(o=>o.loop);
  const points=[outline,...holes].flat(), vec=ring=>ring.map(p=>new Vector2(...p));
  for(const tri of ShapeUtils.triangulateShape(vec(outline),holes.map(vec)))
    wallFace(batch,wall,tri.map(i=>points[i]),color,finish);
  for(const [i,slot] of openings.entries()){
    const ring=slot.loop, inset=slot.depth??depth;
    for(let j=0;j<ring.length;j++){
      const k=(j+1)%ring.length;
      if(inset>0)batch.face([wall.point(...ring[j]),wall.point(...ring[k]),wall.point(...ring[k],-inset),wall.point(...ring[j],-inset)],
        j===0?'#b9bbb0':reveal);
    }
    if(!slot.open)wallFace(batch,wall,ring,'#344951',litSurface.recessGlass,slot.light??(.5+.48*Math.cos(i*4.91)),-inset);
  }
}

function stoneElevation(batch,wall,nearTop,farTop){
  const L=wall.length;
  // Seven columns of square windows, a wide blind pier at the near corner,
  // and two more widely spaced levels immediately above the podium.
  const slots=[];
  const low=[.081,.178,.273,.370,.465,.561,.658,.754,.851];
  for(const f of low)slots.push({loop:opening(f*L,21.85,L*.040,1.07),light:.2+.64*f});
  for(const [floor,h] of [26.8,31.9,...Array.from({length:17},(_,i)=>37.0+i*3.73)].entries()){
    for(let k=0;k<7;k++){
      const s=L*(.204+k*.102);
      if(h+1.46>nearTop+(farTop-nearTop)*(s/L+.024)-1.22)continue;
      slots.push({loop:opening(s,h,L*.048,1.46),light:.5+.48*Math.sin((floor+1)*8.48+k*3.58)});
    }
  }
  // The lower return is mostly stone. Only the last bays are exposed above the adjoining studios.
  for(const f of [.51,.61,.76])slots.push({loop:opening(f*L,15.5,1.23,1.04),light:.49});
  piercedWall(batch,wall,[[0,.01],[L,.01],[L,farTop],[0,nearTop]],slots,'#c6c9c4',stone,.34);
}

function rearElevation(batch,wall,startTop,endTop){
  const L=wall.length, slots=[];
  for(let row=0;row<18;row++){
    const h=29.54+3.73*row;
    for(const f of [.17,.30,.43,.56,.69,.82]){
      if(h+2.4>startTop+(endTop-startTop)*f)continue;
      slots.push({loop:opening(f*L,h,1.39,1.35),light:.48+.38*Math.cos(row+f*17)});
    }
  }
  piercedWall(batch,wall,[[0,0],[L,0],[L,endTop],[0,startTop]],slots,'#b6bdb8',stone,.30);
}

function westReturn(batch,base,outerHeight){
  const wall=wallFrame(base,rear,[0,0]), L=wall.length;
  const slots=[];
  for(let row=0;row<13;row++){
    const h=24.75+row*3.72;
    for(const s of [2.42,L-2.06]){
      if(h+1.1>outerHeight(s/L)-.5)continue;
      slots.push({loop:opening(s,h,1.48,.97),light:.38+.27*Math.sin(row*.72)});
    }
  }
  piercedWall(batch,wall,[[0,0],[L,0],[L,outerHeight(1)],[0,outerHeight(0)]],slots,'#abb5ba',litSurface.ribbedReturn,.24);
}

function plinth(batch,base){
  const slab=(u,v,w,d,lo,hi,color,style=0,cap=color)=>
    prism(batch,rect(towerFrame,u,v,w,d),base+lo,base+hi,color,cap,style);
  for(const [l,r,top] of [[0,9.14,9.15],[9.14,15.46,15.12],[15.46,width-.24,21.48]]){
    const lo=l>15?6.96:.02;
    slab((l+r)/2,.16,r-l,.53,lo,top,'#c9c6b6',stone,'#babbb1');
    slab((l+r)/2,.19,r-l+.01,.60,top,top+.12,'#d3d1c4');
  }
  slab(18.9,.16,6.86,.53,.02,6.96,'#c9c6b6',stone);
  for(const u of [23.6,25.32,27.04,28.76])slab(u,.11,.10,.14,.16,6.65,'#687a80');
  slab(26.28,.10,8.19,.16,3.42,3.56,'#a1aca6');
}

// Match the operating sashes to the same mullions as the curtain-wall shader.
// Shut casements still have a recessed outline. Open ones pivot at their head.
function casements(batch,wall){
  const pitch=curtainStorey;
  const rows=[
    [-2,[6,8,13,16],[4,10]],
    [0,[13,16,18],[6,11,20]],
    [1,[11],[6,8,13,16,19]],
    [2,[8,11,18],[6,13,16]],
    [3,[13],[9,11,16,18]],
    [4,[6,17],[9,14,19]],
    [5,[11,13,16],[5,9,19]],
    [6,[11,18],[8,13,16]],
    [7,[11,13,18],[7,16]],
    [8,[16],[11,13,18,21]],
    [9,[20,21],[15,17]],
  ];
  const w=bay*.88,t=.78;
  for(const [row,opened,shut] of rows){
    const head=curtainDatum+row*pitch;
    for(const col of [...opened,...shut]){
      const s=(col+.5)*bay, limit=60.5+(81.6-60.5)*s/width;
      if(head>limit-.25)continue;
      const spread=opened.includes(col)?.17+.16*(.5+.5*Math.sin(col*5.1+head)):.015;
      const x=s-w/2,X=s+w/2,lo=head-t;
      wallFace(batch,wall,[[x,lo],[X,lo],[X,head],[x,head]],'#343e41',0,.5,.034);
      const p=(u,y,d)=>wall.point(u,y,d), A=p(x,head-.06,.06),B=p(X,head-.06,.06);
      const C=p(X,lo+.08,.057+spread),D=p(x,lo+.08,.057+spread);
      batch.face([D,C,B,A],'#477a96',glass,.73,glassUV([[x,lo+.08],[X,lo+.08],[X,head-.06],[x,head-.06]]));
      if(spread>.1){
        batch.face([p(x,lo,.04),p(X,lo,.04),C,D],'#253337');
        batch.face([D,A,p(x,lo,.04)],'#394748');batch.face([C,p(X,lo,.04),B],'#394748');
        pathTube(batch,[D,C],.042,'#424c4c',4);
      }
      pathTube(batch,[A,B],.032,'#899c9c',4);
    }
  }
}

function mechanicalCrown(batch,base,deck,obstacles){
  const v=-7.70, platform=wallFrame(base,[0,v],[width,v]);
  const lower=[[8.48,deck],[22.48,deck],[22.48,deck+2.98],[8.48,deck+2.98]];
  const windows=[9.68,12.24,15.48,18.44].map((s,i)=>({loop:opening(s,deck+.66,i===1?.89:1.13,.77),light:.16+i*.10}));
  piercedWall(batch,platform,lower,windows,'#cbcfc4',metal,.35);
  const roof=(ring,h,color)=>batch.top(ring.map(([u,d])=>up(at(u,d),base+h)),color);
  const lip=deck+2.98;
  const tier=[[8.48,v],[22.48,v],[20.34,-10.63],[8.48,-10.63]];
  roof(tier,lip,'#a6aea6');
  obstacles.add(toRing(tier),base+lip);
  const p=(u,d,h)=>up(at(u,d),base+h);
  for(let i=1;i<tier.length;i++){
    const a=tier[i],b=tier[(i+1)%tier.length];
    batch.face([p(...a,deck),p(...a,lip),p(...b,lip),p(...b,deck)],'#c1c7be',metal);
  }
  const y=lip, u0=9.02, u1=17.22, frontV=-8.03, backV=-9.37;
  const low=y+3.45, high=y+7.28;
  const section=[[u0,y],[u1,y],[u1,high],[u0,low]];
  const openingLoop=[[9.88,y+.77],[14.82,y+.77],[14.82,y+4.42],[9.88,y+1.74]];
  const gable=wallFrame(base,[0,frontV],[width,frontV]);
  const back=wallFrame(base,[0,backV],[width,backV]);
  piercedWall(batch,gable,section,[{loop:openingLoop,open:true}],ivory,metal,frontV-backV);
  piercedWall(batch,back,section,[{loop:openingLoop,open:true}],ivory,metal,0);
  batch.top([p(u0,frontV,low),p(u1,frontV,high),p(u1,backV,high),p(u0,backV,low)],'#d3d5ca');
  for(const [u,h] of [[u0,low],[u1,high]])
    batch.face([p(u,frontV,y),p(u,frontV,h),p(u,backV,h),p(u,backV,y)],'#c1c6bd',metal);
  for(const u of [11.38,12.84]){
    const height=y+1.45+(u-9.88)*.59;
    pathTube(batch,[p(u,frontV-.55,y+.74),p(u,frontV-.55,height)],.063,'#71807e',5);
  }

  // The taller plant room is set obliquely behind the open triangular frame.
  // Its highest corner has glazing on both faces.
  const left=[9.48,-13.18],right=[17.18,-8.87];
  const upperWall=wallFrame(base,left,right), span=upperWall.length;
  const eave=104.5, apex=109.8, depth=2.43;
  const wallRing=[[0,y],[span,y],[span,apex],[0,eave]], highWindow=opening(span-1.56,apex-3.83,1.65,1.32);
  piercedWall(batch,upperWall,wallRing,[{loop:highWindow,light:.18}],ivory,metal,.19);
  wallFace(batch,upperWall,wallRing,'#bdc5bf',metal,.4,-depth,true);
  const dark='#333e40';
  for(const [m,n] of [[upperWall.point(span-1.56,apex-3.82,-.13),upperWall.point(span-1.56,apex-2.52,-.13)],
      [upperWall.point(span-2.38,apex-3.14,-.13),upperWall.point(span-.74,apex-3.14,-.13)]])
    pathTube(batch,[m,n],.041,dark,4);
  const cornerAt=(s,d)=>{const pt=upperWall.point(s,0,-d);return local([pt[0],pt[2]]);};
  const innerRight=cornerAt(span,depth), innerLeft=cornerAt(0,depth);
  const flank=wallFrame(base,right,innerRight);
  piercedWall(batch,flank,[[0,y],[depth,y],[depth,apex],[0,apex]],
    [{loop:opening(depth/2,apex-3.52,depth*.76,.77),light:.12}],ivory,metal,.12);
  batch.face([p(...left,y),p(...left,eave),p(...innerLeft,eave),p(...innerLeft,y)],'#c2c7bc',metal);
  batch.top([p(...left,eave),p(...right,apex),p(...innerRight,apex),p(...innerLeft,eave)],'#d1d3c8');
  obstacles.add(toRing([left,right,innerRight,innerLeft]),base+apex);

  // A lower rectangular plant enclosure sits against the high end of the gable.
  const cabinet=[[17.23,-8.43],[21.48,-8.43],[20.02,-12.4],[17.23,-13.24]];
  const top=y+4.46;
  roof(cabinet,top,'#a9afa4');
  piercedWall(batch,wallFrame(base,[0,-8.43],[width,-8.43]),[[17.23,y],[21.48,y],[21.48,top],[17.23,top]],
    [{loop:opening(19.0,y+.85,.92,1.1),light:.35},{loop:opening(19.37,top-.80,3.02,.31),light:.12}],ivory,metal,.24);
  for(let i=1;i<cabinet.length;i++){
    const a=cabinet[i],b=cabinet[(i+1)%cabinet.length];
    batch.face([p(...a,y),p(...a,top),p(...b,top),p(...b,y)],'#c2c8bd',metal);
  }
  batch.top([p(17.25,-8.45,top-.56),p(21.4,-8.45,top-.56),p(21.4,-8.03,top-.56),p(17.25,-8.03,top-.56)],'#747d77');
  obstacles.add(toRing([[u0,frontV],[u1,frontV],[u1,backV],[u0,backV]]),base+high);
  obstacles.add(toRing(cabinet),base+top);
  // Lattice mast visible above the penthouse. The cap and aerial are separate silhouettes.
  const mast=at(14.32,-12.75), mastTop=119.1, bottom=deck+.1;
  for(let k=0;k<3;k++){
    const theta=k*TAU/3;
    const leg=(h,a)=>{const r=.57-.46*(h-bottom)/(mastTop-bottom);return [mast[0]+r*Math.cos(a),base+h,mast[1]+r*Math.sin(a)];};
    pathTube(batch,[leg(bottom,theta),leg(mastTop,theta)],.058,'#6f7977',5);
    for(let h=bottom+.35;h<mastTop-2.4;h+=2.65)
      pathTube(batch,[leg(h,theta),leg(h+2.61,theta+TAU/3)],.033,'#929890',4);
  }
  cylinder(batch,...mast,base+mastTop-.28,base+mastTop+1.73,.08,.028,'#9b9f95',6);
  cylinder(batch,...mast,base+bottom,base+mastTop,.17,.063,'#92958a',7);
  for(const h of [108.1,111.1,114.1]){
    const left=p(13.12,-12.85,h),right=p(15.55,-12.59,h+.16);
    pathTube(batch,[left,right],.054,'#7b8885',5);
    pathTube(batch,[left,p(14.32,-12.75,h-1.13),right],.035,'#72807d',4);
  }
  obstacles.add(rect(towerFrame,14.32,-12.75,1.18,1.18),base+mastTop+1.73);
}

export function buildBroadcastTower(batch,base,lights,obstacles){
  const A=[0,0], B=[width,0], C=rear, D=farEast, main=wallFrame(base,A,B);
  const E=[width+(D[0]-width)*.061,D[1]*.061];
  const foot=60.5, crest=81.6, upper=91.0;
  const h=([u,v])=>foot+(crest-foot)*(u/width+(1-rear[0]/width)*v/rear[1]);
  const roofPt=q=>main.point(q[0],h(q),q[1]);
  glazedFace(batch,main,[[0,0],[width,0],[width,crest],[0,foot]],.73);
  westReturn(batch,base,t=>crest+(foot-crest)*t);
  const topE=105.6, topC=105.6, topD=90.2;
  stoneElevation(batch,wallFrame(base,E,D),topE,topD);
  rearElevation(batch,wallFrame(base,D,C),topD,topC);
  // The long punched elevation faces east. A separate blank diagonal face
  // rises behind the blue roof and meets that elevation at its sharp tip.
  const ridge=wallFrame(base,C,E), L=ridge.length;
  wallFace(batch,ridge,[[0,h(C)-.16],[L,h(E)-.16],[L,topE],[0,topC]],ivory,metal);
  const roofCorner=(p,y)=>up(at(...p),base+y);
  batch.top([roofCorner(E,topE),roofCorner(D,topD),roofCorner(C,topC)],'#a4afaa',litSurface.broadcastRoof,.86,[E,D,C]);
  pathTube(batch,[roofCorner(E,topE),roofCorner(C,topC)],.078,'#c7cbc2',5);
  const deckV=-7.48, deckU=8.16, T=[deckU,deckV];
  const U=[E[0]+(C[0]-E[0])*(deckV-E[1])/(C[1]-E[1]),deckV];
  const V=[deckU,E[1]+(C[1]-E[1])*(deckU-E[0])/(C[0]-E[0])];
  // Both pieces of the blue metal return end at the upper floor. There is no
  // horizontal lid across the offices or an oversized coping along the diagonal.
  for(const ring of [[A,B,E,U,T],[A,T,V,C]])
    batch.top(ring.map(roofPt),'#70a9ac',litSurface.broadcastRoof,.4,ring.map(([u,v])=>[u-deckU,v-deckV]));
  pathTube(batch,[roofPt(A),roofPt(B)],.089,'#709497',5);
  pathTube(batch,[roofPt(A),roofPt(C)],.078,'#839b9e',5);
  const upperFace=wallFrame(base,[0,deckV],[width,deckV]);
  glazedFace(batch,upperFace,[[deckU,h(T)],[U[0],h(U)],[U[0],upper],[deckU,upper]],.36);
  const side=wallFrame(base,V,T);
  wallFace(batch,side,[[0,h(V)],[side.length,h(T)],[side.length,upper],[0,upper]],'#a2aeb2',litSurface.ribbedReturn,.35);
  batch.top([T,U,V].map(q=>up(at(...q),base+upper)),'#aab2a8');
  mechanicalCrown(batch,base,upper,obstacles);
  plinth(batch,base);
  // Narrow cobalt glass return beside the light stone pier at the front point.
  wallFace(batch,main,[[width-.40,6.65],[width,6.65],[width,crest],[width-.40,crest-.28]],'#25466e',0,.4,.06);
  const corner=wallFrame(base,B,E);
  wallFace(batch,corner,[[0,0],[corner.length,0],[corner.length,h(E)],[0,crest]],'#29527e');
  pathTube(batch,[corner.point(0,.2),corner.point(0,crest)],.062,'#8e9ea1',5);
  casements(batch,main);
  for(let i=0;i<5;i++){
    const f=i/5,t=(i+1)/5;
    const ring=f?[[width*f,0],[width*t,0],[rear[0]*t,rear[1]*t],[rear[0]*f,rear[1]*f]]:[A,[width*t,0],[rear[0]*t,rear[1]*t]];
    obstacles.add(toRing(ring),base+foot+(crest-foot)*t);
  }
  obstacles.add(toRing([T,U,V]),base+upper);
  obstacles.add(toRing([B,E,C]),base+h(E));
  const toward=(p,f)=>p.map((n,i)=>n+(D[i]-n)*f);
  for(let i=0;i<6;i++){
    const f=i/6,t=(i+1)/6, ring=[toward(E,f),toward(C,f),toward(C,t)];
    if(i<5)ring.push(toward(E,t));
    obstacles.add(toRing(ring),base+topE+(topD-topE)*f);
  }
  const beacon=ridge.point(L-.25,topE+.09,-.15);
  lights.add(beacon[0],beacon[1],beacon[2],'#df7559',.65);
}
