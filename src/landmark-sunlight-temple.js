import { cylinder, groundY, litSurface, prism } from './scenery-mesh.js';
import { foundation, localFrame, paveFootprint, rect, sweptRoof, up } from './landmark-forms.js';
import { footprintFrame } from './gulangyu-layout.js';
import { monolith, stairFlight } from './landmark-gulangyu.js';
import { sunlight } from './sunlight-layout.js';

// The temple stands on the east side of the hill. Across the inscription, u runs
// towards the north and v towards the courtyard.
const angle = -1.42;
const stone = '#aa9c88', white = '#d9cfb9', red = '#923e30', timber = '#703e30';
const tile = '#477667', ridge = '#a0a788';

function inscribedRock(batch, geo, obstacles) {
  const xy = localFrame(sunlight.inscription, angle);
  const height = u => 69.9 - 16.9 * Math.abs(u / 17) ** 3.85 - .11*u
    + 1.25*Math.cos(.16*u+.6) + .80*Math.sin(.32*u-.6);
  function front(u, t) {
    const taper = 1 - (u / 17) ** 2;
    const v = -4.6 + taper * (6.5 - 4.4*t*t + .66*Math.cos(.22*u) + .34*Math.sin(.47*u + 2*t));
    return up(xy(u * (1 - .055*t*t), v), 36 + (height(u) - 36) * t);
  }
  function normal(u, t) {
    const a = front(u - .02,t), b = front(u + .02,t);
    const c = front(u,t - .001), d = front(u,t + .001);
    const [ux,uy,uz] = b.map((n,i) => n-a[i]), [tx,ty,tz] = d.map((n,i) => n-c[i]);
    const n = [uy*tz-uz*ty, uz*tx-ux*tz, ux*ty-uy*tx];
    const len = Math.hypot(...n);
    return n.map(v => v/len);
  }
  const color = '#a3907e', columns = 32, rows = 12;
  // A continuous curved face carries the inscriptions. Clamped black margins
  // on the painted mask leave all the surrounding rock exposed.
  function back(u) {
    const t = 1 - .70*(u/17)**2;
    return [front(u,1), up(xy(.936*u,-4.8-3.7*t),height(u)+1.12*t),
      up(xy(.96*u,-5.6-9.2*t),height(u)-3.5*t),
      up(xy(u,-6.1-15.2*t),36)];
  }
  for (let i=0;i<columns;i++) {
    const u = -17 + 34*i/columns, next = -17 + 34*(i+1)/columns;
    for (let j=0;j<rows;j++) {
      const t=j/rows, end=(j+1)/rows;
      const corners=[[u,t],[next,t],[next,end],[u,end]];
      batch.face(corners.map(([x,y])=>front(x,y)),color,litSurface.sunlightCliff,34.7,
        corners.map(([x,y])=>[.5+x/14.8,(y-.22)/.65]),corners.map(([x,y])=>normal(x,y)));
    }
    const a=back(u), b=back(next);
    for (let k=1;k<a.length;k++)
      batch.top([a[k-1],b[k-1],b[k],a[k]],color,13,34.7);
    const outer=front(u,0), outerNext=front(next,0);
    obstacles.add([outer,outerNext,b.at(-1),a.at(-1)].map(p=>[p[0],p[2]]),
      Math.max(a[1][1],b[1][1]));
  }
  for (const u of [-17,17]) {
    const edge=Array.from({length:rows+1},(_,j)=>front(u,j/rows));
    const rim=[...edge,...back(u).slice(1)];
    const center=up(xy(u+Math.sign(u)*1.6,-6.0),46);
    for(let i=0;i<rim.length;i++) batch.face([rim[i],rim[(i+1)%rim.length],center],color,13,34.7);
  }
  monolith(batch,geo,xy(-15.2,.6),6.5,4.8,.46,50.3,2.3,'#a69880',obstacles);
  monolith(batch,geo,xy(15,-.5),5.6,3.9,-.21,49.6,3.8,'#ae9c83',obstacles);
}

function lantern(batch, lamps, p, top, size) {
  const [x,z]=p;
  for(const [upper,lower,ru,rl,c] of [[0,-.13,.022,.022,timber],[-.13,-.23,.23,.44,'#c67937'],
    [-.23,-.48,.44,.52,'#ca4432'],[-.48,-.73,.52,.40,'#b53529'],[-.73,-.83,.40,.20,'#be793d'],
    [-.83,-1,.04,.03,'#b88846']])
    cylinder(batch,x,z,top+lower*size,top+upper*size,rl*size,ru*size,c,12);
  lamps.add(x,top-.5*size,z,'#ff9457',.55*size);
}

function hall(batch, geo, lamps, obstacles, ring, facadeAngle, mainHall) {
  const {xy,width:w,depth:d}=footprintFrame(ring,facadeAngle);
  const floor=Math.max(...ring.map(p=>groundY(geo,...p)))+.28;
  const eave=floor+(mainHall?3.95:3.28), wall=d*.50;
  foundation(batch,geo,ring,floor,stone,'#c9bba6');
  const core=rect(xy,0,-d*.16,w-.46,wall+.48);
  prism(batch,core,floor,eave-.14,'#ab7057','#797967',14,.77);
  const facade=-d*.16+(wall+.48)/2;
  const bays=3, span=(w-.95)/bays;
  for (let i=0;i<bays;i++) {
    const u=(i-1)*span;
    prism(batch,rect(xy,u,facade+.03,span*.68,.14),floor+.06,eave-.72,timber,red);
    prism(batch,rect(xy,u,facade+.10,span*.57,.08),floor+.9,eave-.91,'#554a40');
    for(let j=-2;j<=2;j++)
      prism(batch,rect(xy,u+j*span*.105,facade+.16,.046,.055),floor+.9,eave-.87,'#aa7656');
    for(const f of [.43,.64,.84])
      prism(batch,rect(xy,u,facade+.16,span*.60,.06),floor+(eave-floor)*f,floor+(eave-floor)*f+.049,'#aa7656');
  }
  for (let i=0;i<=bays;i++) {
    const u=(i-bays/2)*span, p=xy(u,d*.40);
    cylinder(batch,...p,floor,floor+.34,.28,.22,'#a69e8c',12);
    cylinder(batch,...p,floor+.32,eave-.25,.162,.147,red,12);
    prism(batch,rect(xy,u,d*.40,.54,.51),eave-.48,eave-.15,'#a28a5a',white);
  }
  prism(batch,rect(xy,0,d*.40,w-.3,.49),eave-.32,eave+.02,'#6e5240',red);
  sweptRoof(batch,xy,0,0,w+1.30,d+1.32,eave,mainHall?1.68:1.27,tile,ridge,mainHall?.53:.36);
  obstacles.add(ring,eave+(mainHall?2.52:1.85));
  const approach=xy(0,d*.5+2.5);
  stairFlight(batch,xy(0,d*.49),floor,approach,groundY(geo,...approach)+.24,
    Math.min(3.75,w*.62),.72,'#bfb39c',false,(x,z)=>groundY(geo,x,z),obstacles);
  if(mainHall)
    for(const u of [-w*.28,w*.28]) lantern(batch,lamps,xy(u,d*.45),eave-.25,.85);
}

function templeGate(batch, geo, lamps, obstacles) {
  const ring=sunlight.templeGate, {xy,width:w,depth:d}=footprintFrame(ring,angle);
  const floor=Math.max(...ring.map(p=>groundY(geo,...p)))+.20;
  foundation(batch,geo,ring,floor,stone,'#c7bda8');
  const front=d*.41, rear=-front, centerWidth=w*.40, wing=(w-centerWidth)/2;
  for(const [u,bay,central] of [[0,centerWidth,true],[-(centerWidth+wing)/2,wing,false],[(centerWidth+wing)/2,wing,false]]) {
    const spring=floor+(central?2.06:1.63), top=floor+(central?4.55:3.46), radius=bay*.40;
    const edge=bay/2;
    for (const side of [-1,1]) {
      const pier=rect(xy,u+side*(radius+edge)/2,0,edge-radius,d*.82);
      prism(batch,pier,floor,top,white,white);
      obstacles.add(pier,top);
    }
    for (let i=0;i<12;i++) {
      const ta=Math.PI*(1-i/12), tb=Math.PI*(1-(i+1)/12);
      const a=u+radius*Math.cos(ta), b=u+radius*Math.cos(tb);
      const ya=spring+radius*Math.sin(ta), yb=spring+radius*Math.sin(tb);
      for(const v of [front,rear])
        batch.face([up(xy(a,v),ya),up(xy(b,v),yb),up(xy(b,v),top),up(xy(a,v),top)],white);
      batch.face([up(xy(a,rear),ya),up(xy(a,front),ya),up(xy(b,front),yb),up(xy(b,rear),yb)],'#b1a68d');
    }
    prism(batch,rect(xy,u,0,bay+.06,d*.89),top-.17,top+.05,'#ab9475',white);
    sweptRoof(batch,xy,u,0,bay+.84,d+1.06,top+.08,central?.98:.70,tile,ridge,central?.37:.24);
    if(central) {
      prism(batch,rect(xy,u,front+.04,bay*.58,.10),top-.55,top-.20,'#645343');
      lantern(batch,lamps,xy(u,front*.35),spring+radius-.16,.64);
    }
  }
}

export function buildSunlightTemple(batch, geo, lamps, obstacles) {
  inscribedRock(batch,geo,obstacles);
  paveFootprint(batch,sunlight.templeCourt,(x,z)=>groundY(geo,x,z)+.24,'#b1aa99');
  // The main hall looks east. The other three open north or south into the court.
  const facades=[angle,angle-Math.PI/2,angle+Math.PI/2,angle-Math.PI/2];
  sunlight.templeHalls.forEach((ring,i)=>hall(batch,geo,lamps,obstacles,ring,facades[i],i===0));
  sunlight.templeAnnexes.forEach((ring,i)=>hall(batch,geo,lamps,obstacles,ring,i===0?angle:angle+Math.PI/2,false));
  templeGate(batch,geo,lamps,obstacles);
}
