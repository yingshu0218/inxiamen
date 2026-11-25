import { groundY, litSurface, mix, prism, cylinder } from './scenery-mesh.js';
import { ellipse, localFrame, rect, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { smOne, smTwo, smTwoBridgeWing, smBridge, smTopaz, smThree, smThreeBridge,
  smFourB, smFourC } from './mall-landmark-layout.js';

const silver = '#bec8c9', glass = '#719aa9', trim = '#e0e0d4';

function mallShell(batch, geo, ring, base, wall, floor, top, roof) {
  prism(batch, ring, Math.min(...ring.map(p=>groundY(geo,...p))) - .6, base + 5.3,
    '#829798', null, litSurface.shopfront, .57);
  prism(batch, ring, base + 5.3, base + floor, wall, null, litSurface.crownMetal, .61);
  prism(batch, ring, base + floor, base + top - .85, wall, null, litSurface.crownMetal, .64);
  prism(batch, ring, base + top - .85, base + top, silver, roof, litSurface.railEave, .64, 0, 22);
}

function facadeBand(batch, a, b, bottom, top, color, kind) {
  const length = Math.hypot(b[0]-a[0],b[1]-a[1]);
  batch.face([up(a,bottom),up(a,top),up(b,top),up(b,bottom)],color,kind,.61,
    [[0,0],[0,top-bottom],[length,top-bottom],[length,0]]);
}

function phaseOne(batch, geo, base, obstacles, signs) {
  const xy = localFrame([-309,-2627],-.178);
  const roof = base + 28.25;
  mallShell(batch,geo,smOne,base,'#849dad',13,28.25,'#828e90');
  const road = [[-379.45,-2714.5],[-342.45,-2515.9]];
  const p = (t) => road[0].map((n,i)=>mix(n,road[1][i],t));
  for (const [a,b] of [[.05,.22],[.39,.49],[.68,.75],[.88,.98]]) {
    facadeBand(batch,p(a),p(b),base+2,base+23,'#6d919c',litSurface.railGlass);
  }
  facadeBand(batch,p(.015),p(.985),base+25.5,base+26.35,trim,litSurface.railEave);
  facadeBand(batch,[-341.5,-2515.8],[-284.1,-2526.4],base+20,base+21.4,'#aeb9b7',litSurface.crownMetal);
  signs.push({label:'SM 城市广场',a:p(.72),b:p(.51),y:base+18.7,height:4.9,ink:'#f4f3e9'});
  for (const [u,v,w,d] of [[-9,-57,39,15],[4,13,38,28],[-12,58,18,24]]) {
    const ring=rect(xy,u,v,w,d);
    prism(batch,ring,roof,roof+2.15,'#acaeaa','#b6b5aa',litSurface.crownMetal,.61,0,22);
    const ridge=rect(xy,u,v,w*.72,d*.32);
    prism(batch,ridge,roof+2.15,roof+2.62,'#aebcb8','#8fa5a6',litSurface.railGlass);
  }
  // White painted bays are visible on the long roof deck.
  for (const u of [25,35]) for (let v=-58;v<75;v+=3.8) {
    const line=rect(xy,u,v,6.2,.14);
    batch.top(line.map(p=>up(p,roof+.035)),'#aaa9a0');
  }
  obstacles.add(smOne,roof+2.65);
}

function phaseTwo(batch, geo, base, obstacles, signs) {
  mallShell(batch,geo,smTwo,base,'#aaa89f',10.5,19.4,'#989997');
  mallShell(batch,geo,smTwoBridgeWing,base,'#aa9990',10.5,21.2,'#9f9e94');
  const xy=localFrame([-534,-2434],-.176);
  const sapphire=rect(xy,0,1,37,145);
  prism(batch,sapphire,base+18.5,base+30.6,'#b6b6ac','#898f91',litSurface.crownMetal,.51,0,22);
  facadeBand(batch,xy(-18.4,73.7),xy(18.4,73.7),base+22,base+26.9,'#779cae',litSurface.railGlass);
  for (const z of [-43,25]) {
    prism(batch,rect(xy,-3,z,8,38),base+30.6,base+31.25,'#aaadaa','#c0c4bd',litSurface.crownMetal);
  }
  const ruby=rect(xy,54,-88,67,25);
  prism(batch,ruby,base+20.65,base+26.3,'#9e706a','#8f918c',litSurface.crownMetal,.57,0,22);
  for (const [bottom,top,color,style] of [
    [-.5,5.1,'#819698',litSurface.shopfront],
    [5.1,10.25,'#aca696',litSurface.crownMetal],
    [10.25,12.45,'#6e8388',litSurface.railGlass],
    [12.45,18.55,'#c2baaa',litSurface.crownMetal],
    [18.55,20.5,'#788786',litSurface.railGlass],
    [20.5,26.55,'#bdb7ab',litSurface.crownMetal],
  ]) {
    cylinder(batch,...smTopaz,base+bottom,base+top,33.4,33.4,color,56,0,color,style);
  }
  const [x,z]=smTopaz;
  cylinder(batch,x,z,base+26.55,base+27.3,34,34,'#d3cec2',56,0,'#69726f',litSurface.railEave);
  cylinder(batch,x,z,base+27.3,base+28.65,16.3,15.5,'#a5aca3',40,0,'#dcddd2',litSurface.crownMetal);
  signs.push({label:'SM 新生活广场',a:xy(-13,73.78),b:xy(16,73.78),y:base+27.25,height:2.8,ink:'#587d96'});
  obstacles.add(smTwo,base+28.2);
  obstacles.add(smTwoBridgeWing,base+21.2);
  obstacles.add(sapphire,base+31.3);
  obstacles.add(ruby,base+26.3);
  obstacles.add(ellipse(localFrame(smTopaz),0,0,34,34,36),base+28.65);
}

function link(batch, start, end, leftY, rightY, width, lamps, obstacles) {
  const dx=end[0]-start[0], dz=end[1]-start[1], length=Math.hypot(dx,dz);
  const xy=localFrame(start,Math.atan2(dz,dx));
  const height=4.75, half=width/2, bays=Math.ceil(length/5.5);
  const p=(s,v,k)=>up(xy(s,v),mix(leftY,rightY,s/length)+k);
  for(let i=0;i<bays;i++){
    const a=i*length/bays,b=(i+1)*length/bays;
    for(const k of [0,height]) {
      batch.top([p(a,-half,k),p(b,-half,k),p(b,half,k),p(a,half,k)],k?trim:'#b7afa0',litSurface.railEave);
    }
    for(const v of [-half,half]){
      batch.face([p(a,v,-.62),p(a,v,height),p(b,v,height),p(b,v,-.62)],glass,litSurface.railGlass,.27,
        [[a,0],[a,height],[b,height],[b,0]]);
      for (const k of [0,height-.26]) {
        batch.face([p(a,v*1.013,k-.21),p(a,v*1.013,k+.26),p(b,v*1.013,k+.26),p(b,v*1.013,k-.21)],trim,litSurface.crownMetal);
      }
      pathTube(batch,i%2 ? [p(a,v*1.027,height-.25),p(b,v*1.027,.2)] : [p(a,v*1.027,.2),p(b,v*1.027,height-.25)],
        .145,trim,5,litSurface.crownMetal);
    }
    if(i%4===0)lamps.add(...p((a+b)*.5,0,height-.4),'#fff1db',1.22);
  }
  obstacles.add(rect(xy,length/2,0,length,width),Math.max(leftY,rightY)+height);
}

function phaseThree(batch, geo, base, obstacles, signs) {
  const roof=base+23.2;
  mallShell(batch,geo,smThree,base,'#b7bdbb',10.5,23.2,'#9fa7a0');
  for (const [a,b] of [[[-523.8,-2657.1],[-496.1,-2564.15]], [[-520.4,-2666.8],[-455.9,-2665.8]],
    [[-495.9,-2563.8],[-555.5,-2557.8]]]) {
    facadeBand(batch,a,b,base+6.4,base+11.2,'#739299',litSurface.railGlass);
    facadeBand(batch,a,b,base+14.5,base+18.5,'#6f9198',litSurface.railGlass);
  }
  const xy=localFrame([-573,-2661],-.174);
  for (const [u,v,w,d] of [[14,18,16,67],[34,-61,58,18],[29,68,20,15]]) {
    const garden=rect(xy,u,v,w,d);
    prism(batch,garden,roof,roof+.55,'#b0afa0','#748c70',litSurface.paleStone);
  }
  const hotel=rect(xy,-8,-9,28,97), crown=base+76.5;
  prism(batch,hotel,roof,crown,'#628892','#b5bfc0',litSurface.office,.43,0,litSurface.railRoof);
  for (let i=0;i<14;i++) {
    const y=roof+i*3.72+.95;
    facadeBand(batch,xy(6.17,-57.5),xy(6.17,39.5),y,y+.73,'#c0c3b7',litSurface.crownMetal);
    facadeBand(batch,xy(-22.17,39.5),xy(-22.17,-57.5),y,y+.73,'#b1b8b0',litSurface.crownMetal);
  }
  prism(batch,rect(xy,-8,-9,27,96),crown,crown+.89,'#c7c9bf','#a5b0ad',litSurface.railEave);
  prism(batch,rect(xy,-10,-19,12,42),crown+.89,crown+3.1,'#a4aaa2','#aab2ab',litSurface.crownMetal);
  signs.push({label:'voco',a:xy(6.35,19),b:xy(6.35,36),y:crown-4.6,height:3.25,ink:'#f8ead1'});
  obstacles.add(smThree,roof+.55);
  obstacles.add(hotel,crown+3.1);
}

function chaoWalkway(batch, a, b, y, width, obstacles) {
  const dx=b[0]-a[0], dz=b[1]-a[1], length=Math.hypot(dx,dz);
  const xy=localFrame(a,Math.atan2(dz,dx));
  const deck=rect(xy,length/2,0,length,width);
  prism(batch,deck,y-.82,y,'#216da8','#b2b4ab',litSurface.crownMetal);
  for (const v of [-width/2,width/2]) {
    prism(batch,rect(xy,length/2,v,length,.12),y,y+1.24,'#3296ca',null,litSurface.crownMetal);
  }
  obstacles.add(deck,y+1.24);
}

function phaseFour(batch, geo, base, obstacles, signs) {
  const xy=localFrame([-218,-2641],-.168);
  mallShell(batch,geo,smFourB,base,'#c3c7c2',8.4,17.8,'#a4adab');
  for (const [v,w,d,h] of [[-72,37,48,64],[-1,40,47,69],[69,40,45,73]]) {
    const tower=rect(xy,5,v,w,d), y=base+h;
    prism(batch,tower,base+9.2,y,'#547c91','#bac4c3',litSurface.office,.42,0,litSurface.railRoof);
    for (let floor=base+11;floor<y-.9;floor+=3.72) {
      const halfW=w/2+.11, halfD=d/2+.11;
      for (const [a,b] of [[xy(5-halfW,v-halfD),xy(5+halfW,v-halfD)],
        [xy(5+halfW,v-halfD),xy(5+halfW,v+halfD)], [xy(5+halfW,v+halfD),xy(5-halfW,v+halfD)],
        [xy(5-halfW,v+halfD),xy(5-halfW,v-halfD)]]) {
        facadeBand(batch,a,b,floor,floor+.54,'#bec4be',litSurface.crownMetal);
      }
    }
    prism(batch,rect(xy,5,v,w+.28,d+.28),y,y+.72,'#d1d2cb','#879fa7',litSurface.railEave);
    prism(batch,rect(xy,4,v-3,22,16),y+.72,y+2.55,'#a4b0b0','#b6b9b0',litSurface.crownMetal);
    obstacles.add(tower,y+2.55);
  }
  const plaza=localFrame([-266,-2524],-.177);
  const plazaRing=rect(plaza,0,10,92,32);
  const grade=Math.max(...plazaRing.map(p=>groundY(geo,...p)))+.13;
  prism(batch,plazaRing,grade-.65,grade,'#a8a49a','#b1aca0',litSurface.paleStone);
  for (const u of [-31,-20,-9,2,13,24]) {
    for (const v of [6,18]) {
      batch.top(rect(plaza,u,v,.17,4.8).map(p=>up(p,grade+.02)),'#d5cbb6');
    }
  }
  for (const [a,b] of [[[-241,-2549],[-214,-2535]],[[-243,-2566],[-218,-2563]],
    [[-251,-2611],[-225,-2604]],[[-263,-2682],[-240,-2670]]]) {
    chaoWalkway(batch,a,b,base+7.9,4.3,obstacles);
  }
  const entry=localFrame([-222,-2534],-.168);
  const entryGrade=groundY(geo,...entry(1,9.5)), steps=30;
  for (let step=1;step<=steps;step++) {
    prism(batch,rect(entry,1,9.5-step*.46,8.2,.475),entryGrade-.28,
      mix(entryGrade,base+7.9,step/steps),'#a8a9a0','#bfc2b8',litSurface.paleStone);
  }
  signs.push({label:'CHAO BLOCK',a:[-214,-2521.45],b:[-192,-2525.57],
    y:base+8.25,height:2.55,ink:'#2987bf'});
  obstacles.add(smFourB,base+17.8);

  // The northern 4C plot was still under construction at the opening of CHAO BLOCK.
  const level=Math.max(...smFourC.map(p=>groundY(geo,...p)))+.13;
  prism(batch,smFourC,level-.7,level,'#939084','#a6a08a',litSurface.stone);
  for (let i=0;i<smFourC.length;i++) {
    const a=smFourC[i], b=smFourC[(i+1)%smFourC.length];
    facadeBand(batch,a,b,level,level+2.1,'#788d86',litSurface.crownMetal);
  }
}

export function buildSmXiamen(batch, geo, lamps, obstacles, signs) {
  const east=groundY(geo,-309,-2627), west=groundY(geo,-507,-2432);
  const north=groundY(geo,-543,-2658), chao=groundY(geo,-218,-2641);
  phaseOne(batch,geo,east,obstacles,signs);
  phaseTwo(batch,geo,west,obstacles,signs);
  phaseThree(batch,geo,north,obstacles,signs);
  phaseFour(batch,geo,chao,obstacles,signs);
  const [a,b]=smBridge, deck=west+11.2;
  link(batch,a,b,deck,east+11.6,7.5,lamps,obstacles);
  link(batch,...smThreeBridge,north+10.5,east+11.6,6.1,lamps,obstacles);
}
