import { cylinder, groundY, litSurface, prism, randomSource } from './scenery-mesh.js';
import { localFrame, rect, up } from './landmark-forms.js';
import { alongFrame, carriageways, offset, plan, ribbon, street } from './old-town-layout.js';

const plaster = ['#e1d3b9','#d9baa5','#d9c9ae','#c7c9b7','#e7dac3','#d3b39c','#d6c4b7'];
const redTiles = ['#9e6150','#ad6c51','#95705c','#ae7459'];
const cornice = '#e4d8bc', granite = '#b9ada0';

function front(batch, xy, u0, u1, v, y0, y1, color, style=0, seed=0, repeat=1, floors=1) {
  batch.face([up(xy(u0,v),y0),up(xy(u1,v),y0),up(xy(u1,v),y1),up(xy(u0,v),y1)],
    color,style,seed,[[0,0],[repeat,0],[repeat,floors],[0,floors]]);
}

// Go through the portico at pavement level. The shops close the back of the
// gallery while the residential floors span the masonry piers above it.
function shophouse(batch, geo, lamps, obstacles, signs, lot, index, random) {
  const [s,side,width,depth,setback]=lot, centre=street.sample(s);
  const [x,z]=offset(centre,side*setback), xy=alongFrame({...centre,x,z},-side);
  const h=groundY(geo,x,z)+.5, arcade=3.2, lintel=h+4.45;
  const floors=random()<.57?2:random()<.79?3:1;
  const floorH=3.42+random()*.27, roof=lintel+floorH*floors, half=width/2;
  const bays=Math.max(2,Math.round(width/3.7)), pitch=width/bays, seed=random();
  const wall=plaster[Math.floor(random()*plaster.length)];
  const tile=redTiles[Math.floor(random()*redTiles.length)];
  const arched=seed<.64, hip=random()>.39;
  const footprint=rect(xy,0,-depth/2,width,depth);
  const block=(u,v,w,d,lo,hi,color,cap=color,style=0) => prism(batch,rect(xy,u,v,w,d),lo,hi,color,cap,style,seed);
  block(0,-depth/2,width,depth,h-1.5,h,'#a39583','#c3b4a4');
  block(0,-(depth+arcade)/2,width,depth-arcade,h,lintel,'#6a6358',null,litSurface.shopfront);
  batch.face([up(xy(-half,0),lintel),up(xy(half,0),lintel),up(xy(half,-arcade),lintel),up(xy(-half,-arcade),lintel)],'#b3a188',litSurface.portico);
  prism(batch,footprint,lintel,roof,wall,hip?tile:'#bab2a2',1,seed,hip?1.4+1.2*seed:0,hip?litSurface.pantile:0);
  front(batch,xy,-half,half,.035,lintel,roof,wall,litSurface.qilou,seed,bays,floors);
  for(let i=0;i<=bays;i++) {
    const u=-half+i*pitch, edge=i===0||i===bays;
    const pierWidth=edge?.32:.48, shift=edge?(i===0?.16:-.16):0;
    block(u+shift,-.29,pierWidth,.58,h,lintel,wall,cornice,litSurface.portico);
    block(u+shift,-.29,pierWidth+.14,.74,h,h+.46,granite);
    if(edge || seed<.36){
      const pos=u+shift, w=edge?.40:.27;
      block(pos,.105,w,.31,lintel+.12,roof-.17,cornice);
      block(pos,.14,w+.20,.42,roof-.54,roof-.26,cornice);
    }
    if(i===bays) continue;
    if(arched) {
      const l=u+(.23), r=u+pitch-.23, spring=h+2.43, rise=Math.min(1.03,(r-l)*.38);
      // Build just the spandrel above the opening, leaving a physical void beneath.
      for(let j=0;j<6;j++) {
        const p0=j/6,p1=(j+1)/6;
        const arc=t=>spring+rise*Math.sin(t*Math.PI);
        const a=l+(r-l)*p0, b=l+(r-l)*p1;
        batch.face([up(xy(a,.022),arc(p0)),up(xy(b,.022),arc(p1)),up(xy(b,.022),lintel),up(xy(a,.022),lintel)],wall,litSurface.portico);
        batch.face([up(xy(a,.036),arc(p0)),up(xy(b,.036),arc(p1)),up(xy(b,.036),arc(p1)+.14),up(xy(a,.036),arc(p0)+.14)],cornice,litSurface.paleStone);
      }
      if(seed<.36)block((l+r)/2,.07,.29,.26,spring+rise-.06,spring+rise+.35,cornice);
    }
  }
  for(let i=0;i<=floors;i++){
    const y=lintel+i*floorH;
    block(0,-.03,width,.47,y-.08,y+(i===floors?.31:.13),cornice,cornice,litSurface.portico);
  }
  if (seed>.50 && seed<.89) {
    const cloth=['#546e61','#ad6a51','#c3a577','#863f38'][index%4];
    for(let j=0;j<bays;j++){
      const a=-half+j*pitch+.34, b=a+pitch-.68, y=h+3.12;
      batch.top([up(xy(a,.06),y+.27),up(xy(b,.06),y+.27),up(xy(b,1.12),y),up(xy(a,1.12),y)],cloth);
      front(batch,xy,a,b,1.12,y-.19,y,cloth);
    }
  }
  // The party walls rise into a front-facing, stepped or scalloped parapet.
  const crest=seed<.34?[[0,.68],[.21,.68],[.21,1.06],[.35,1.06],[.35,1.57],[.65,1.57],[.65,1.06],[.79,1.06],[.79,.68],[1,.68]]:
    seed<.76?[[0,.58],[.21,.58],[.30,.77],[.38,1.25],[.5,1.53],[.62,1.25],[.70,.77],[.79,.58],[1,.58]]:[[0,.61],[.12,.61],[.12,.88],[.88,.88],[.88,.61],[1,.61]];
  for(let i=1;i<crest.length;i++){
    const [x0,y0]=crest[i-1],[x1,y1]=crest[i], a=(x0-.5)*width, b=(x1-.5)*width;
    if(b-a<.01) continue;
    batch.face([up(xy(a,.08),roof+.12),up(xy(b,.08),roof+.12),up(xy(b,.08),roof+y1),up(xy(a,.08),roof+y0)],wall,litSurface.portico);
    batch.top([up(xy(a,.18),roof+y0),up(xy(b,.18),roof+y1),up(xy(b,-.34),roof+y1),up(xy(a,-.34),roof+y0)],cornice,litSurface.paleStone);
  }
  if(!hip && seed>.35)block(-width*.16,-depth*.67,width*.4,depth*.4,roof,roof+1.85,wall,'#a1a398');
  if(seed>.65 && bays>2){
    const w=Math.min(width*.56,8), y=lintel+floorH;
    block(0,.47,w,1.28,y-.14,y+.08,'#c9b99c');
    front(batch,xy,-w/2,w/2,1.10,y+.08,y+.91,'#ded1b9',litSurface.balustrade,seed,w/1.32,1);
  }
  if(index%3===1 || s<116){
    const label=['花生汤','茶莊','餅舖','海味行'][index%4], signWidth=Math.min(width-1,5.2);
    signs.push({label,a:xy(-signWidth/2,.18),b:xy(signWidth/2,.18),y:lintel-.96,height:.83});
  }
  if(index%4===0){const [px,pz]=xy(0,-.95); lamps.add(px,lintel-.51,pz,'#ffd7a0',.66);}
  obstacles.add(footprint,roof+(hip?2.6:2));
}

function harbourHotel(batch,geo,lamps,obstacles,signs) {
  const ring=plan.hotel, h=Math.max(...ring.map(p=>groundY(geo,...p)))+.44;
  const ground=h+7.55, upper=ground+4*3.80, eave=upper+3.25, brick='#ac8171';
  prism(batch,ring,h-2.1,ground,'#b7a48f','#c9b49d',0);
  prism(batch,ring,ground,eave,brick,'#a39784',1,.43);
  // The seaward frontage fans around the corner. Keep the inner court open.
  for(let i=9;i<ring.length;i++){
    const a=ring[i], b=ring[(i+1)%ring.length];
    const dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz);
    const xy=localFrame([(a[0]+b[0])/2,(a[1]+b[1])/2],Math.atan2(-dz,-dx));
    const wing=i<13||i>15, bays=Math.max(1,Math.round(len/3.45));
    front(batch,xy,-len/2,len/2,.04,h+.43,ground,'#a7927b',litSurface.qilou,.41,bays,1);
    front(batch,xy,-len/2,len/2,.045,ground,eave,brick,litSurface.qilou,.17,bays,5);
    const ledge=(v,depth,y,thick,color,style=0)=>prism(batch,rect(xy,0,v,len+.1,depth),y,y+thick,color,color,style);
    ledge(.22,.72,ground,.35,cornice,litSurface.paleStone);
    ledge(.18,.68,upper,.33,cornice,litSurface.portico);
    ledge(.4,1.35,eave,.43,'#d9cdb5',litSurface.portico);
    ledge(.35,1.52,eave+.43,.28,'#805d4c');
    if(wing){
      for(let fl=1;fl<=3;fl++){
        const y=ground+fl*3.8, w=len*.72;
        prism(batch,rect(xy,0,.55,w,1.18),y-.2,y+.04,cornice,cornice);
        front(batch,xy,-w/2,w/2,1.13,y+.04,y+.89,'#d9d1ba',litSurface.balustrade,.18,Math.max(2,w/1.1));
      }
    }else{
      const [x,z]=xy(-len/2,.86);
      cylinder(batch,x,z,h,ground,.66,.51,'#d9d1bc',12,0,cornice,litSurface.paleStone);
      cylinder(batch,x,z,ground-.55,ground+.05,.72,.73,cornice,12);
      lamps.add(x,ground+.15,z,'#ffd5a0',.72);
    }
    if(i===14)signs.push({label:'鹭江宾馆',a:xy(-len*.46,.61),b:xy(len*.46,.61),y:ground+.52,height:1.5});
  }
  const roofline=ring.map(([x,z])=>[-5597+(x+5597)*.96,2626+(z-2626)*.96]);
  prism(batch,roofline,eave+.04,eave+1.14,'#8f7663','#ad9e8b');
  const xy=localFrame([-5615,2608],-.38);
  prism(batch,rect(xy,0,0,26,9),eave+1,eave+3.28,'#ac9584','#986e55',1,.26,1.38);
  obstacles.add(ring,eave+4.7);
}

export function buildZhongshan(batch,geo,lamps,obstacles,signs) {
  const y=(x,z)=>groundY(geo,x,z)+.56;
  // Explicit joints at the ends of the pedestrianised stretch prevent a lane
  // stripe from running through the granite mall.
  const rows=street.sections(8);
  for(const s of plan.pedestrian){const p=street.sample(s);rows.push({...p,s,rx:-p.uz,rz:p.ux});}
  rows.sort((a,b)=>a.s-b.s);
  const [start,end]=plan.pedestrian;
  const paving=rows.filter(r=>r.s>=start && r.s<=end);
  ribbon(batch,paving,-9.6,9.6,y,'#bfb7a7',litSurface.graniteMall);
  for(const curb of [-1,1])ribbon(batch,paving,curb*5.05-.13,curb*5.05+.13,(x,z)=>y(x,z)+.042,'#837f74');
  for(const part of [rows.filter(r=>r.s<=start),rows.filter(r=>r.s>=end)]){
    const sidewalk=(x,z)=>y(x,z)+.12;
    ribbon(batch,part,-8.55,-5.05,sidewalk,'#bcb4a3',17);
    ribbon(batch,part,5.05,8.55,sidewalk,'#bcb4a3',17);
    // Match the avenue's +0.71 m surface at its edge. The approach starts
    // inside that carriageway, so keep its overlapping tip below the asphalt.
    const approachLevel = (x, z, s) => {
      if (s > 24) return y(x, z);
      const fromEdge = carriageways[1].nearest(x, z).distance - 5.32;
      return y(x, z) + .15 * Math.max(0, 1 - Math.abs(fromEdge) / 7);
    };
    ribbon(batch,part,-5.05,5.05,approachLevel,'#797971',litSurface.carriageway);
  }
  for(let s=start+7;s<end-5;s+=42){
    const p=street.sample(s), xy=alongFrame(p);
    for(const side of [-1,1]){
      const [x,z]=xy(0,side*6.15), base=y(x,z);
      cylinder(batch,x,z,base,base+3.81,.081,.066,'#525b51',6);
      cylinder(batch,x,z,base+3.8,base+4.2,.18,.26,'#f0d7a7',6,0,'#605b50',litSurface.portico);
      lamps.add(x,base+3.99,z,'#ffe0b4',.92);
      if(side<0){const curb=rect(xy,1.7,-6.2,2.05,.57);prism(batch,curb,base+.21,base+.48,'#887560','#a98c69');}
    }
  }
  const rand=randomSource(32184);
  plan.frontages.forEach((lot,index)=>shophouse(batch,geo,lamps,obstacles,signs,lot,index,rand));
  harbourHotel(batch,geo,lamps,obstacles,signs);
  for(const s of [start+2,end-2]){
    const p=street.sample(s), xy=alongFrame(p), y0=y(p.x,p.z);
    for(const v of [-4.6,-2.3,0,2.3,4.6]){const [x,z]=xy(0,v);cylinder(batch,x,z,y0,y0+.57,.21,.19,granite,8);}
    const q=xy(-1,-6.4); cylinder(batch,...q,y0,y0+3.1,.073,.071,'#4e5d52',7);
    signs.push({label:'中山路',a:xy(-1.96,-6.32),b:xy(-.04,-6.32),y:y0+2.55,height:.56});
  }
}
