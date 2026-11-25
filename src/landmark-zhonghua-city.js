import { cylinder, groundY, litSurface, prism } from './scenery-mesh.js';
import { ellipse, localFrame, rect, up } from './landmark-forms.js';
import { measuredPath, ribbon } from './old-town-layout.js';
import { ccChapel, ccNorth, ccSouth } from './mall-landmark-layout.js';

const limestone='#d0c0a5', walls='#ad957f', cap='#d7c9af', glass='#657b78';

function block(batch,geo,ring,base,height) {
  prism(batch,ring,Math.min(...ring.map(p=>groundY(geo,...p)))-.45,base+1.35,
    '#a29987',null,litSurface.stone);
  prism(batch,ring,base+1.35,base+5.5,'#8d8070',null,litSurface.shopfront,.48);
  prism(batch,ring,base+5.5,base+height-.6,walls,null,litSurface.graniteFacing,.57);
  prism(batch,ring,base+height-.6,base+height,cap,'#a8a697',litSurface.railEave,.7,0,22);
}

function arcade(batch,points,base,height,lamps) {
  for(let i=1;i<points.length;i++){
    const a=points[i-1], b=points[i], dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz);
    const xy=localFrame(a,Math.atan2(dz,dx));
    const p=(u,v,y)=>up(xy(u,v),base+y);
    const outward=-1;
    const bays=Math.max(1,Math.round(len/4.6)), w=len/bays;
    for(const y of [5.37,9.75,14.0,height-.6]){
      batch.face([p(0,outward*.34,y-.48),p(0,outward*.34,y),p(len,outward*.34,y),p(len,outward*.34,y-.48)],
        limestone,litSurface.railEave);
    }
    for(let k=0;k<bays;k++){
      const u=w*(k+.5);
      prism(batch,rect(xy,w*k,outward*.49,.62,.74),base+.05,base+height-.6,limestone,cap,litSurface.paleStone);
      for(const y of [.85,6.45,10.8]){
        const run=w*.34, spring=y+(y<5?2.9:1.63), radius=y<5?1.15:.82;
        for(let j=0;j<8;j++){
          const q=(n)=>{const s=n/4-1;return [u+run*s, spring+radius*Math.sqrt(Math.max(0,1-s*s))];};
          const [x0,y0]=q(j),[x1,y1]=q(j+1);
          batch.face([p(x0,outward*.06,y),p(x0,outward*.06,y0),p(x1,outward*.06,y1),p(x1,outward*.06,y)],
            y<5?'#6d7672':glass,y<5?litSurface.shopfront:litSurface.hallWindow,.21);
          batch.face([p(x0,outward*.16,y0),p(x0,outward*.16,y0+.21),p(x1,outward*.16,y1+.21),p(x1,outward*.16,y1)],
            cap,litSurface.paleStone);
        }
      }
      if(k%3===1)lamps.add(...p(u,outward*.8,4.39),'#ffdfb0',1.05);
    }
  }
}

function cupola(batch,centre,base,radius,scale,obstacles) {
  cylinder(batch,...centre,base-1,base+1.1*scale,radius*1.23,radius*1.23,cap,20);
  cylinder(batch,...centre,base+1.1*scale,base+4.05*scale,radius,radius,
    '#bdae96',20,0,limestone,litSurface.studioRibbon);
  cylinder(batch,...centre,base+3.93*scale,base+4.35*scale,radius*1.14,radius*1.14,cap,24,0,cap,litSurface.railEave);
  const colors=['#859491','#7e8e8b','#778784','#798681'];
  for(let i=0;i<4;i++){
    const [a,b]=[i,i+1].map(k=>k*Math.PI/8);
    cylinder(batch,...centre,base+(4.35+2.55*Math.sin(a))*scale,base+(4.35+2.55*Math.sin(b))*scale,
      radius*Math.cos(a),radius*Math.cos(b),colors[i],28);
  }
  cylinder(batch,...centre,base+6.83*scale,base+7.5*scale,.14,.09,'#a7a697',8);
  obstacles.add(ellipse(localFrame(centre),0,0,radius*1.24,radius*1.24,20),base+7.5*scale);
}

function roofVault(batch,center,base,length,width,rise) {
  const xy=localFrame(center,.79);
  const p=(u,v)=>up(xy(u,v),base+rise*(1-(2*v/width)**2));
  for(let i=0;i<8;i++){
    const a=-length*.5+i*length/8,b=a+length/8;
    for(let j=0;j<12;j++){
      const c=-width*.5+j*width/12,d=c+width/12;
      batch.top([p(a,c),p(b,c),p(b,d),p(a,d)],i%2?'#768882':'#7d8c86',litSurface.railRoof,.43,
        [[a,c],[b,c],[b,d],[a,d]]);
    }
  }
  for(const u of [-length*.5,length*.5]){
    const ring=Array.from({length:13},(_,i)=>p(u,-width*.5+i*width/12));
    for(let i=1;i<ring.length;i++){
      const a=ring[i-1],b=ring[i];
      batch.face([[a[0],base-.1,a[2]],a,b,[b[0],base-.1,b[2]]],glass,litSurface.railGlass);
    }
  }
}

function chapel(batch,geo,obstacles) {
  const [x,z]=ccChapel, xy=localFrame(ccChapel,.80), base=groundY(geo,x,z)+.32;
  const footprint=rect(xy,0,0,30,16.2), stone='#c0b8a4', roof='#ab6858';
  prism(batch,footprint,base-.8,base+9.1,'#d1c7ae',null,litSurface.paleStone);
  for(const side of [-1,1]){
    batch.top([up(xy(-15.45,side*8.53),base+9.1),up(xy(15.45,side*8.53),base+9.1),
      up(xy(15.45,0),base+13.45),up(xy(-15.45,0),base+13.45)],roof,litSurface.railRoof);
    batch.face([up(xy(side*15,-8.1),base+9.1),up(xy(side*15,0),base+13.45),
      up(xy(side*15,8.1),base+9.1)],stone,litSurface.paleStone);
  }
  for(let i=0;i<4;i++){
    prism(batch,rect(xy,-17.4-i*.45,0,4.9+i*.9,16.8+i*.6),base-1,base+1.15-i*.28,stone,cap,litSurface.stone);
  }
  for(let i=0;i<6;i++){
    const p=xy(-18.65,(i-2.5)*2.58);
    cylinder(batch,...p,base+1.15,base+7.9,.33,.29,cap,12,0,cap,litSurface.paleStone);
    cylinder(batch,...p,base+7.85,base+8.25,.42,.42,cap,12);
  }
  prism(batch,rect(xy,-17.1,0,4.75,16.8),base+8.2,base+9.0,limestone,cap,litSurface.railEave);
  obstacles.add(footprint,base+13.45);
}

export function buildZhonghuaCity(batch,geo,lamps,obstacles,signs) {
  const north=groundY(geo,-4902,2630)+.45, south=groundY(geo,-4759,2790)+.38;
  block(batch,geo,ccNorth,north,20.7);
  block(batch,geo,ccSouth,south,23.4);
  arcade(batch,ccNorth.slice(0,8).toReversed(),north,20.7,lamps);
  arcade(batch,ccSouth.slice(0,4).toReversed(),south,23.4,lamps);
  for(const [centre,radius,scale] of [[[-4907,2624],4.9,1.21],[[-4882,2690],3.65,.85]]){
    cupola(batch,centre,north+20.7,radius,scale,obstacles);
  }
  cupola(batch,[-4824,2728],south+23.4,4.7,1.02,obstacles);
  roofVault(batch,[-4767,2750],south+23.36,43,37,4.25);
  roofVault(batch,[-4719,2801],south+23.36,53,39,4.8);
  const seq=localFrame([-4788,2762],.79);
  for(let u=-19;u<24;u+=9.25){
    prism(batch,rect(seq,u,0,1.46,17.8),south+23.35,south+24.43,limestone,cap,litSurface.railRoof);
  }
  for(const [a,b,y,size] of [
    [[-4913,2632],[-4917,2617],north+20.72,3.85],
    [[-4812,2753],[-4834,2732],south+15.1,3.91],
  ]) signs.push({label:'中华城',a,b,y,height:size,ink:'#c45042'});
  const alley=measuredPath([[-4900,2619],[-4884,2645],[-4864,2659],[-4849,2656]]);
  ribbon(batch,alley.sections(3),-1.95,1.95,(x,z)=>groundY(geo,x,z)+.16,'#b1a58f',22);
  chapel(batch,geo,obstacles);
  obstacles.add(ccNorth,north+20.7);
  obstacles.add(ccSouth,south+28.2);
}
