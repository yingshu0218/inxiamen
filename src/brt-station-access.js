import { alongFrame } from './old-town-layout.js';
import { rect, up } from './landmark-forms.js';
import { cylinder, groundY, litSurface, mix, prism } from './scenery-mesh.js';
import { pathTube } from './landmark-haicang.js';
import { brtEntranceStation, brtRoadHeight, brtStairLateral } from './brt-layout.js';
import { stationWalks, wucunWalkDeck } from './wucun-layout.js';

const stone = '#a7b8b6', frameSteel = '#6c9fae', dark = '#46636a', railing = '#b6c6c1';
const glass = '#7ba4a9', landingFloor = '#b9beb3', width = 4.06;

function panel(batch, point, a,b, side, bottom, top, color, style = 0) {
  batch.face([point(a,side,bottom),point(b,side,bottom),point(b,side,top),point(a,side,top)],color,style);
}

function stairFlight(batch, lamps, obstacles, frame, start, v, finish, top, bottom, { covered = true, escalator = false } = {}) {
  const travel = finish - start, run = Math.abs(travel), steps = Math.max(5, Math.ceil((top - bottom) / .176));
  const at = (t,w,height = 0) => up(frame(start + travel*t, v+w), mix(top,bottom,t)+height);
  const riser = (top-bottom)/steps;
  const risingDirection = travel < 0 ? -1 : 1;
  for (let i=0; i<steps; i++) {
    const t = (i+.5)/steps, level = top-(i+1)*riser, u = start + travel*t;
    const stairWidth = escalator ? width*.63 : width;
    const stepV = v+(escalator ? -.74 : 0);
    prism(batch,rect(frame,u,stepV,run/steps+.014,stairWidth),level-.30,level,'#879592',i%4 ? '#b0b9b2' : '#c3c9b9');
    const nose = rect(frame,u+risingDirection*(run/steps/2-.037),stepV,.062,stairWidth-.12);
    batch.top(nose.map(p=>up(p,level+.008)), '#8e9381');
    if (escalator) {
      const lane = rect(frame,u,v+1.21,run/steps+.014,1.18);
      prism(batch,lane,level-.26,level-.016,'#475a5b','#626d69');
      const stripe = rect(frame,u+risingDirection*(run/steps/2-.035),v+1.21,.037,1.14);
      batch.top(stripe.map(p=>up(p,level+.002)), '#b99e54');
    }
  }
  for (const w of [-width/2,width/2]) {
    panel(batch,at,0,1,w,-.61,.155,stone);
    panel(batch,at,0,1,w,.208,.984,glass,litSurface.ferryGlass);
    pathTube(batch,[at(0,w,1.045),at(1,w,1.045)],.043,railing,6);
    for (let i=0; i<=5; i++)
      pathTube(batch,[at(i/5,w,.075),at(i/5,w,1.03)],.047,frameSteel,5);
  }
  if (escalator) {
    for (const w of [.55,1.88]) {
      panel(batch,at,0,1,w,.10,.86,glass,litSurface.ferryGlass);
      pathTube(batch,[at(0,w,.92),at(1,w,.92)],.051,'#526d72',6);
    }
  }
  if (covered) {
    const roof = (t,f) => at(t,2.32*f,2.42+.55*(1-f*f));
    for (let i=0; i<5; i++) {
      const a=i/5,b=(i+1)/5;
      for (let j=0; j<8; j++) {
        const x=j/4-1,y=(j+1)/4-1;
        batch.top([roof(a,x),roof(b,x),roof(b,y),roof(a,y)],
          j===3 || j===4 ? '#b1c8cc' : '#cbd4cf',litSurface.railRoof,.67);
      }
    }
    for (let i=0; i<=5; i++) {
      const t=i/5;
      const beam = Array.from({length: 9}, (_,k)=>roof(t,k/4-1));
      pathTube(batch,[at(t,-2.08,.10),...beam,at(t,2.08,.10)],.083,frameSteel,6);
      if (i%2===0) lamps.add(...at(t,0,2.57),'#d8f0ff',1.03);
    }
  }
  obstacles.add(rect(frame,(start+finish)/2,v,run,width+.52),top+(covered ? 2.97 : 1.03));
}

function landing(batch, lamps, obstacles, frame, u, v, span, depth, deck, roof) {
  const floor = rect(frame,u,v,span,depth);
  prism(batch,floor,deck-.48,deck,stone,landingFloor);
  for (const end of [-1,1]) {
    const edge = u + end*(span/2-.10);
    const a = frame(edge,v-depth/2+.10), b = frame(edge,v+depth/2-.10);
    pathTube(batch,[up(a,deck+1.04),up(b,deck+1.04)],.045,railing,6);
    for (const pt of [a,b]) cylinder(batch,pt[0],pt[1],deck,deck+(roof?2.57:1.04),.073,.061,frameSteel,7);
  }
  if (roof) {
    prism(batch,rect(frame,u,v,span+.28,depth+.24),deck+2.55,deck+2.74,frameSteel,'#c0ced0',litSurface.railEave);
    lamps.add(...up(frame(u,v),deck+2.45),'#d8f0ff',1.36);
  }
  obstacles.add(floor,deck+(roof?2.74:1.04));
}

function wingLanding(batch,lamps,obstacles,frame,u,p,v,deck) {
  const middle=(p.outer+Math.abs(v)+1.42)*.5;
  const width=Math.abs(v)-p.outer+3.1;
  landing(batch,lamps,obstacles,frame,u,p.side*middle,4.2,width,deck,true);
}

function portal(batch, geo, lamps, obstacles, frame, u, v, side, floor, sign) {
  const a = frame(u+side*2.55,v+side*2.49), b = frame(u+side*2.55,v-side*2.49);
  const canopy = rect(frame,u,v,4.9,5.33);
  prism(batch,canopy,floor+2.72,floor+2.96,frameSteel,'#c5d2cd',litSurface.railEave);
  for (const p of [a,b]) cylinder(batch,p[0],p[1],groundY(geo,...p)-.12,floor+2.86,.115,.086,frameSteel,8);
  sign(a,b,floor+2.78,.52);
  lamps.add(...up(frame(u+.83*side,v),floor+2.65),'#e2f4fc',1.3);
  obstacles.add(canopy,floor+2.97);
}

function toStreet(batch,geo,lamps,obstacles,stop,p,sign) {
  const s = brtEntranceStation(p), frame = alongFrame(stop.link.path.sample(s));
  const y = brtRoadHeight(geo,stop.link,s)+.24, d=p.side, v=d*brtStairLateral(stop,p);
  const floor = Math.min(y-1.1,groundY(geo,...frame(25*d,v))+.23);
  const stairs = Math.max(12,Math.min(22,(y-floor)*2.04));
  const middle = (y+floor)/2, u = d*(2.08+stairs/2), last=d*(4.72+stairs);
  wingLanding(batch,lamps,obstacles,frame,0,p,v,y);
  stairFlight(batch,lamps,obstacles,frame,2.1*d,v,u,y,middle);
  landing(batch,lamps,obstacles,frame,u+1.31*d,v,2.62,width,middle,true);
  stairFlight(batch,lamps,obstacles,frame,u+2.62*d,v,last,middle,floor,{escalator:stop.form==='airport'});
  for (const u0 of [0,u+1.3*d]) {
    const [x,z]=frame(u0,v);
    cylinder(batch,x,z,groundY(geo,x,z)-.24,(u0?middle:y)-.45,.37,.47,stone,10);
  }
  portal(batch,geo,lamps,obstacles,frame,last+2.11*d,v,d,floor,sign);
}

function railwayWalk(batch,geo,lamps,obstacles,stop,p) {
  const frame=alongFrame(stop.link.path.sample(stop.s));
  const v=p.side*(p.outer+3.1), end=0, start=-p.side*10.7;
  const deck=brtRoadHeight(geo,stop.link,stop.s+start)+.24, bottom=wucunWalkDeck(geo,stationWalks[0]);
  landing(batch,lamps,obstacles,frame,start-p.side*1.8,p.side*(p.outer+2.11),3.6,5.83,deck,true);
  stairFlight(batch,lamps,obstacles,frame,start,v,end,deck,Math.min(deck-.35,bottom),{escalator:true});
}

function transferHall(batch,geo,lamps,obstacles,stop,sign) {
  const { link,s,boarding } = stop, frame = alongFrame(link.path.sample(s));
  const deck=brtRoadHeight(geo,link,s)+.24, level=deck-4.56;
  const across=Math.max(...boarding.map(p=>brtStairLateral(stop,p)))+2.35;
  const floor=rect(frame,0,0,9,across*2+.32);
  prism(batch,floor,level-.67,level,frameSteel,landingFloor,litSurface.paleStone);
  prism(batch,rect(frame,0,0,9.34,across*2+.52),level+2.19,level+2.44,frameSteel,'#b7c8c6');
  for (const side of [-1,1]) {
    for (let v=-across;v<across-.6;v+=2.05) {
      const atStair=boarding.some(p=>Math.abs(v+1.025-p.side*brtStairLateral(stop,p))<3.12);
      if (atStair) continue;
      const a=frame(side*4.43,v), b=frame(side*4.43,v+2.05);
      batch.face([up(a,level+.32),up(b,level+.32),up(b,level+2.16),up(a,level+2.16)],glass,litSurface.ferryGlass);
      cylinder(batch,a[0],a[1],level,level+2.29,.078,.078,frameSteel,7);
    }
    const inner=frame(side*4.44,4.26*side), outer=frame(side*4.44,-4.26*side);
    sign(inner,outer,level+1.50,.65);
  }
  for (const p of boarding) {
    const d=p.side, v=d*brtStairLateral(stop,p);
    const first=-d*14.4, bottom = Math.min(level-.6,groundY(geo,...frame(d*24,v))+.28);
    wingLanding(batch,lamps,obstacles,frame,first-d*2.1,p,v,deck);
    stairFlight(batch,lamps,obstacles,frame,first,v,-d*4.3,deck,level,{escalator:true});
    stairFlight(batch,lamps,obstacles,frame,d*4.3,v,d*24.6,level,bottom,{escalator:true});
    portal(batch,geo,lamps,obstacles,frame,d*27,v,d,bottom,sign);
  }
  obstacles.add(floor,level+2.45);
}

export function addBrtAccess(batch,geo,lamps,obstacles,stop,sign) {
  if (stop.form==='transfer') {
    transferHall(batch,geo,lamps,obstacles,stop,sign);
    return;
  }
  for (const p of stop.boarding) {
    if (!p.access) continue;
    if (stop.form==='railway') railwayWalk(batch,geo,lamps,obstacles,stop,p);
    else toStreet(batch,geo,lamps,obstacles,stop,p,sign);
  }
}
