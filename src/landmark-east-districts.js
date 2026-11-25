import { groundPaving, localFrame, rect } from './landmark-forms.js';
import { measuredPath, ribbon } from './old-town-layout.js';
import { inRing, litSurface, prism, ringRect } from './scenery-mesh.js';
import { districtRoads, guanyinBuildings, phaseOneBuildings, phaseTwoBuildings } from './east-district-layout.js';

const finishes = {
  silver: ['#96a5a5','#dedbd0','#d8d8ce',litSurface.office, 4],
  terrace: ['#a5afb0','#e4dfd0','#d0cbbd',litSurface.office, 5],
  warm: ['#b5aaa0','#ceb8aa','#bcb0a4',1, 4],
  office: ['#a5a99e','#cbc6b9','#c3bdb0',litSurface.office, 5],
  stone: ['#b6aea1','#c5bbac','#a39e90',litSurface.graniteMall, 6],
  hotel: ['#9aadb1','#d7d7cf','#bdc1b7',litSurface.office, 4.1],
  grey: ['#67818d','#9da8a8','#869798',litSurface.office, 9],
  blue: ['#537586','#8c9c9e','#7f949b',litSurface.office, 10],
  pearl: ['#526e84','#a9b0aa','#a4aeac',litSurface.office, 12],
  podium: ['#828e8d','#b5b8ac','#989c96',litSurface.shopfront, 5],
  bank: ['#5b7789','#adb8b9','#8c989f',litSurface.office, 13],
  plaza: ['#68818c','#a2b3b4','#8f9fa0',litSurface.office, 10],
  stepped: ['#517583','#a0b0ad','#889d9b',litSurface.office, 9],
};

function buildingDatum(geo, ring) {
  const samples = ring.map(([x,z]) => geo.heightAt(x,z)).sort((a,b)=>a-b);
  return { floor:samples[samples.length >> 1], low:samples[0], high:samples.at(-1) };
}

function crownRing(ring, scale) {
  const x = ring.reduce((sum,p)=>sum+p[0],0)/ring.length;
  const z = ring.reduce((sum,p)=>sum+p[1],0)/ring.length;
  return ring.map(p=>[x+(p[0]-x)*scale,z+(p[1]-z)*scale]);
}

function roofRoom(batch, ring, holes, roofHeight, color) {
  const centre = crownRing(ring,0)[0];
  const [a,b] = ring.reduce((best, p, i)=>{
    const q=ring[(i+1)%ring.length];
    return Math.hypot(p[0]-q[0],p[1]-q[1]) > Math.hypot(best[0][0]-best[1][0],best[0][1]-best[1][1]) ? [p,q] : best;
  },[ring[0],ring[1]]);
  const angle = Math.atan2(b[1]-a[1],b[0]-a[0]);
  // Test the whole service room against the roof and any inner court.
  const anchor = centre.map((v,i)=>v*.75+(a[i]+b[i])*.125);
  const width = Math.min(17, Math.hypot(b[0]-a[0],b[1]-a[1])*.24);
  const room = ringRect(...anchor,width,width*.52,angle);
  if (width > 4 && room.every(([x,z])=>inRing(x,z,ring) && !holes.some(hole=>inRing(x,z,hole)))) {
    prism(batch,room,roofHeight,roofHeight+1.6,color,'#c4c2b5');
    return room;
  }
}

function drawBank(batch, ring, floor, sill, top) {
  // The photo shows silvery vertical ribs below a darker glazed upper shaft,
  // with two mechanical recesses and a shallow dip in the side of the crown.
  const steps = [[sill-floor,1],[19,1],[91,1],[94,.955],[98,1],[148,1],[151,.955],[155,.99],[204,.99],[210,.99]];
  const rows = steps.map(([level,scale],i)=>crownRing(ring,scale).map(([x,z],j)=>{
    const wave = i === steps.length-1 ? 3*Math.cos(j*4*Math.PI/ring.length)**2 - 3 : 0;
    return [x,Math.min(floor+level+wave,top),z];
  }));
  for (let row = 1; row < rows.length; row++) {
    for (let i = 0; i < ring.length; i++) {
      const j=(i+1)%ring.length, a=rows[row-1][i], b=rows[row][i], c=rows[row][j], d=rows[row-1][j];
      const width=Math.hypot(a[0]-d[0],a[2]-d[2]);
      const recess=row===3||row===4||row===6||row===7;
      const color=recess?'#485b65':row>=8?'#587586':i%4===0?'#81969e':'#738995';
      batch.face([a,b,c,d],color,litSurface.office,.42,[[i*width,a[1]-floor],[i*width,b[1]-floor],[(i+1)*width,c[1]-floor],[(i+1)*width,d[1]-floor]]);
    }
  }
  const last=rows.at(-1), middle=ring[0].map((_,i)=>ring.reduce((sum,p)=>sum+p[i],0)/ring.length);
  for (let i=0;i<last.length;i++) batch.top([[middle[0],top-3,middle[1]],last[i],last[(i+1)%last.length]],'#a9b2af');
}

function drawPearl(batch, ring, sill, top, wall, roof) {
  const shoulder=top-34;
  prism(batch,ring,sill,shoulder,wall,null,litSurface.office,.35);
  const sections=[[shoulder,1],[shoulder+8,.95],[top-12,1.01],[top-4,1.13],[top,1.19]];
  const rings=sections.map(([level,scale])=>crownRing(ring,scale).map(([x,z])=>[x,level,z]));
  for(let r=1;r<rings.length;r++) for(let i=0;i<ring.length;i++) {
    const j=(i+1)%ring.length, a=rings[r-1][i], b=rings[r][i], c=rings[r][j], d=rings[r-1][j];
    const width=Math.hypot(a[0]-d[0],a[2]-d[2]);
    batch.face([a,b,c,d],'#798785',litSurface.office,.18,[[0,a[1]-shoulder],[0,b[1]-shoulder],[width,c[1]-shoulder],[width,d[1]-shoulder]]);
  }
  batch.top(rings.at(-1),roof,22);
  return crownRing(ring,1.19);
}

function drawBuildings(batch, geo, index, buildings) {
  const datums = new Map();
  for (const [i, building] of buildings.entries()) {
    const { rings:[ring,...holes], finish, height, crown, datum } = building;
    const [wall,roof,trim,style,bandSpacing] = finishes[finish];
    const own = buildingDatum(geo,ring);
    const lower = datum ? datums.get(datum).floor + datum.height - .07 : Math.min(own.low-.40,own.floor);
    const floor = datum ? datums.get(datum).floor : own.floor;
    const top = Math.max(floor+height, own.high+1.1);
    const sill = datum ? lower+1.3 : Math.min(top-crown-0.5,Math.max(floor+1.4,own.high+.18));
    const seed = (i*0.617) % 1;
    datums.set(building,own);
    prism(batch,ring,lower,sill,finish==='bank'?'#65787d':'#9e9d92',null,litSurface.graniteFacing,seed,0,0,holes);
    if (finish === 'bank') {
      drawBank(batch,ring,floor,sill,top);
      index.add(ring,top);
      continue;
    }
    if (finish === 'pearl') {
      index.add(drawPearl(batch,ring,sill,top,wall,roof),top);
      continue;
    }
    const mainTop = top-crown;
    if (finish === 'stepped') {
      const transition = floor+height*.83;
      const tapered = crownRing(ring,.82);
      prism(batch,ring,sill,transition,wall,roof,style,seed);
      prism(batch,tapered,transition,mainTop,wall,roof,style,seed);
      prism(batch,tapered,mainTop,top,trim,roof,litSurface.crownMetal,seed);
    } else {
      prism(batch,ring,sill,mainTop,wall,crown?null:roof,style,seed,0,22,holes);
      if (crown) prism(batch,ring,mainTop,top,trim,roof,litSurface.crownMetal,seed,0,22,holes);
    }
    if (crown && finish!=='stepped') {
      const room=roofRoom(batch,ring,holes,top,trim);
      if (room) index.add(room,top+1.6);
    }
    if (finish==='hotel'||finish==='silver'||finish==='terrace'||finish==='office') {
      for(let y=sill+bandSpacing;y<mainTop-.4;y+=bandSpacing) {
        prism(batch,crownRing(ring,1.008),y,y+.19,trim,null,0,seed,0,0,holes.map(hole=>crownRing(hole,.992)));
      }
    }
    index.add(ring,top,holes);
  }
}

function surfacePath(batch, geo, points, width, color, lift = .29) {
  const path=measuredPath(points);
  ribbon(batch,path.sections(4),-width/2,width/2,(x,z)=>geo.heightAt(x,z)+lift,color);
  return path;
}

export function buildSoftwareOne(batch, geo, lamps, index) {
  drawBuildings(batch,geo,index,phaseOneBuildings);
  // Internal forecourt paths follow the eastward fall of the two parcels.
  surfacePath(batch,geo,[[-1368,5059],[-1365,5029],[-1375,5008],[-1365,4974],[-1338,4956]],8,'#c6c0b0');
  surfacePath(batch,geo,[[-1405,4953],[-1379,4951],[-1345,4947],[-1307,4937],[-1275,4929]],6.5,'#b5ad9f');
  surfacePath(batch,geo,[[-1555,5257],[-1527,5259],[-1483,5267],[-1462,5243],[-1459,5178],[-1462,5147]],7.4,'#aba89a');
  surfacePath(batch,geo,[[-1483,5267],[-1465,5309],[-1460,5330]],5.3,'#b8ae9d');
  const forecourt = localFrame([-1464,5160],.07);
  groundPaving(batch,geo,forecourt,[-14,15,-20,20],'#bab6a8');
}

function westExit(batch, geo) {
  // Surface infill between the mapped divided sections opens the left turn at
  // Jinshan Road. Paint is placed above the regular city street in this junction.
  const outbound=districtRoads.guanriOutbound.slice(-5).toReversed();
  const path=surfacePath(batch,geo,[[4594,-1433],[4615,-1424],[4636,-1411],[4664,-1396],[4691,-1376]],19,'#757873',.58);
  const ground=(x,z)=>geo.heightAt(x,z)+.635;
  for(const offset of [-3.9,0,3.9]) {
    for(let s=14;s<path.length-7;s+=12) {
      const rows=[s,s+5].map(n=>{ const p=path.sample(n);return {...p,rx:-p.uz,rz:p.ux,s:n}; });
      ribbon(batch,rows,offset-.11,offset+.11,ground,'#d6d6c7');
    }
  }
  const [x,z]=outbound[2];
  const gantry = localFrame([x+2,z+4],-.89);
  const level = Math.max(geo.heightAt(...gantry(-10,0)),geo.heightAt(...gantry(10,0)));
  for(const u of [-10,10]) prism(batch,rect(gantry,u,0,.35,.35),level-1.8,level+7.2,'#8b9795',null);
  prism(batch,rect(gantry,0,0,20.5,.45),level+6.9,level+7.32,'#929d98','#a2a8a2');
  for(const u of [-3.4,3.4]) prism(batch,rect(gantry,u,0,5.5,.32),level+5.2,level+6.9,'#3e6a81','#507786');
}

function crescentSquare(batch, geo) {
  // Steps face Guanri Road and span the garden opening visible in the aerial.
  const frame=localFrame([5304,-1038],.31);
  const court=Array.from({length:19},(_,i)=>{
    const a=-Math.PI+i*Math.PI/18;
    return frame(33*Math.cos(a),23*Math.sin(a));
  });
  const levels=Array.from({length:4},(_,row)=>court.map(p=>{
    const [cx,cz]=frame(0,0);
    return [cx+(p[0]-cx)*(1-row*.095),cz+(p[1]-cz)*(1-row*.095)];
  }));
  for(let row=0;row<levels.length-1;row++) for(let i=1;i<court.length;i++) {
    const poly=[levels[row][i-1],levels[row][i],levels[row+1][i],levels[row+1][i-1]];
    batch.top(poly.map(([x,z])=>[x,geo.heightAt(x,z)+.75-row*.1,z]),row===1?'#b9b2a4':'#d0c9b9',litSurface.railPlaza);
  }
  groundPaving(batch,geo,frame,[-23,23,-7,10],'#bfbaac');
}

export function buildSoftwareTwo(batch, geo, lamps, index) {
  drawBuildings(batch,geo,index,phaseTwoBuildings);
  westExit(batch,geo);
  crescentSquare(batch,geo);
  surfacePath(batch,geo,[[5231,-1134],[5252,-1114],[5261,-1085],[5285,-1069]],3.5,'#b2a899');
  surfacePath(batch,geo,[[5198,-1193],[5208,-1181],[5227,-1156]],3.2,'#b9ad9a');
  groundPaving(batch,geo,localFrame([5231,-1291],.29),[-25,25,-22,27],'#bbb8a8');
}

export function buildGuanyinBusiness(batch, geo, lamps, index) {
  drawBuildings(batch,geo,index,guanyinBuildings);
  // The tower courts are inland of Huandao East Road. The road, promenade and
  // sand bridge have their own coastal scene, including the Taipadong connection.
  groundPaving(batch,geo,localFrame([6178,-1724],-.19),[-36,34,-14,13],'#afaea0');
  groundPaving(batch,geo,localFrame([6664,-1663],.41),[-24,20,-9,13],'#b9b8ac');
  groundPaving(batch,geo,localFrame([6742,-1557],-.23),[-17,12,-37,29],'#b6b6a8');
  groundPaving(batch,geo,localFrame([6122,-1191],.2),[-39,31,-13,13],'#b7b2a4');
  surfacePath(batch,geo,[[6674,-1466],[6676,-1460],[6723,-1446],[6748,-1435]],5.7,'#b2afa1');
}
