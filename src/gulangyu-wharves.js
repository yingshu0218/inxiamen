import { cylinder, groundY, litSurface, mix, prism } from './scenery-mesh.js';
import { foundation, localFrame, rect, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { measuredPath } from './old-town-layout.js';
import { bearing, footprintFrame, neicuoao, pianoWharf, plan, sanqiutian } from './gulangyu-layout.js';

const cream = '#e8e2ce', steel = '#819492', granite = '#baafa0', glass = '#708e8c';
const floatLevel = 1.55;
const shifted = (xy, u, v) => (x, z) => xy(x + u, z + v);

function vault(batch, xy, length, width, spring, rise, color) {
  // A shallow rolled roof. Spring height can change along a sloping passenger bridge.
  const point = (u, t, drop = 0) => up(xy(u, t * width / 2), spring(u) + rise * (1 - t * t) - drop);
  const l = -length / 2, r = -l;
  for (let i = 0; i < 8; i++) {
    const t = i / 4 - 1, next = t + .25;
    batch.top([point(l,t), point(r,t), point(r,next), point(l,next)], color);
    for (const end of [l,r])
      batch.face([point(end,t,.22), point(end,t), point(end,next), point(end,next,.22)], cream);
  }
  for (const side of [-1, 1])
    batch.face([point(l,side,.24), point(l,side), point(r,side), point(r,side,.24)], steel);
}

function pontoon(batch, lamps, obstacles, xy, length, width, roofLength, roofWidth, profile = 'vault') {
  const hull = rect(xy, 0, 0, length, width);
  // Neicuo'ao has two tensile sails with a low point between them.
  const roofY = (u, v) => profile === 'sails'
    ? 4.75 + 1.15 * Math.sin(2 * Math.PI * Math.abs(u) / roofLength) + .25 * (2*v/roofWidth)**2
    : 5.28 + .75 * (1 - (2*v/roofWidth)**2);
  prism(batch, hull, -.72, floatLevel - .22, '#3f5051', null);
  prism(batch, hull, floatLevel - .22, floatLevel, '#b7b5a5', '#bcb8a9');
  for (const side of [-1, 1]) {
    for (let u = 2 - length / 2; u < length / 2 - .6; u += 4.7) {
      prism(batch, rect(xy,u,side * (width / 2 + .11),1.22,.47), .14, 1.22, '#3f4140', '#55534c');
    }
    const bays = Math.ceil(roofLength / 8.5);
    for (let i = 0; i <= bays; i++) {
      const u = roofLength * (i / bays - .5) * .96, p = xy(u, side * (roofWidth / 2 - .4));
      const y = roofY(u, side * (roofWidth / 2 - .4));
      cylinder(batch, ...p, floatLevel, y, .15, .13, cream, 6);
      if (i % 2 === 1) lamps.add(p[0], y-.25, p[1], '#ffe0af', .8);
    }
    for (const u of [-length / 2 + 1.5,length / 2 - 1.5]) {
      const p = xy(u, side * (width / 2 - .95));
      cylinder(batch,...p,floatLevel,floatLevel+.49,.24,.28,'#675f4e',7);
    }
  }
  if (profile === 'sails') {
    const tip = roofWidth / 2;
    const p = (u,v) => up(xy(u,v),roofY(u,v));
    for (let i = 0; i < 20; i++) {
      const a = roofLength * (i/20-.5), b = a + roofLength/20;
      for (const v of [-tip,tip]) {
        batch.top([p(a,0),p(a,v),p(b,v),p(b,0)],'#e4d8c1');
        pathTube(batch,[p(a,v),p(b,v)],.14,steel,5);
        if (i%2 === 0) pathTube(batch,[p(a,0),p(a,v)],.075,cream,5);
      }
    }
  } else {
    vault(batch, xy, roofLength, roofWidth, () => 5.28, .75, '#dedcca');
    if (profile === 'striped') {
      // Painted chevrons curve over the crown of the Sanqiutian berth.
      for (const side of [-1,1]) for (let i=0;i<16;i++) {
        const paint = (t,offset) => {
          const u=(t-.5)*roofLength*.972, v=side*(roofWidth*(.04+.35*Math.abs(2*t-1))+offset);
          return up(xy(u,v),roofY(u,v)+.055);
        };
        const a=i/16, b=(i+1)/16;
        batch.top([paint(a,-.49),paint(a,.49),paint(b,.49),paint(b,-.49)],'#c4a56d');
      }
    }
  }
  obstacles.add(hull, floatLevel);
  obstacles.add(rect(xy,0,0,roofLength,roofWidth),6.03);
}

function guardrail(batch, a, b, level) {
  const bays = Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3.2);
  for (const h of [.48,1.04]) pathTube(batch,[up(a,level+h),up(b,level+h)],.075,cream,5);
  for (let i=0;i<=bays;i++) {
    const t=i/bays;
    cylinder(batch,mix(a[0],b[0],t),mix(a[1],b[1],t),level,level+1.07,.082,.082,steel,5);
  }
}

function gangway(batch, obstacles, shore, float, level, width, covered) {
  const run = Math.hypot(float[0] - shore[0], float[1] - shore[1]);
  const center = [(shore[0] + float[0]) / 2, (shore[1] + float[1]) / 2];
  const xy = localFrame(center, bearing(shore, float));
  const y = u => mix(level, floatLevel + .06, u / run + .5);
  const p = (u, v, h) => up(xy(u, v), y(u) + h);
  const l = -run / 2, r = -l, w = width / 2;
  batch.top([p(l,-w,0),p(r,-w,0),p(r,w,0),p(l,w,0)], '#afa997', 17);
  for (const v of [-w,w]) {
    batch.face([p(l,v,-.65),p(l,v,.04),p(r,v,.04),p(r,v,-.65)], steel);
    for (const h of [.48,1.1]) pathTube(batch,[p(l,v,h),p(r,v,h)],.075,cream,5);
    const bays = Math.ceil(run / 3.5);
    for (let i = 0; i <= bays; i++) {
      const u = l + run * i / bays;
      const h = covered && (i % 2 === 0 || i === bays) ? 3.12 : 1.1;
      pathTube(batch,[p(u,v,0),p(u,v,h)],h > 2 ? .095 : .055,steel,5);
      if (i < bays) pathTube(batch,[p(u,v,.08),p(u+run/bays,v,1.04)],.048,steel,4);
    }
  }
  if (covered) vault(batch, xy, run, width+.62, u => y(u)+3.13, .68, cream);
  // Separate spans keep collision close to the grade at both ends.
  for (let i = 0; i < 4; i++) {
    const u = run * ((i+.5)/4 - .5);
    obstacles.add(rect(xy,u,0,run/4,width+.3), Math.max(y(u-run/8),y(u+run/8)) + (covered ? 3.81 : 1.1));
  }
}

function accessDeck(batch, obstacles, ring, y) {
  prism(batch, ring, y-.65, y, '#a69f90', '#c3baa7', 0, 0, 0, 17);
  for (const p of ring) cylinder(batch,...p,-1.8,y-.62,.54,.47,'#888c80',8);
  obstacles.add(ring,y);
}

function berthSign(signs, xy, u, v, y, width, height, label) {
  // Increasing u reads left-to-right from the water in the quay's local frame.
  signs.push({ label, a: xy(u-width/2,v), b: xy(u+width/2,v), y, height });
}

function buildSanqiutian(batch, geo, lamps, obstacles, signs) {
  const { xy } = sanqiutian, level = 3.75;
  const { shoreEnds } = plan.sanqiutian;
  const floor = rect(xy,0,-48.6,68,33);
  accessDeck(batch,obstacles,floor,level);
  accessDeck(batch,obstacles,rect(xy,40,-39.3,12,14.4),level);
  // The rebuilt berth has five covered bridges, one long passenger pontoon and
  // two distinct approaches across open water to Yanping Road.
  for (const [i, u] of [-15.2,14].entries()) {
    const a = shoreEnds[i*2], b = shoreEnds[i*2+1];
    const land = [(a[0]+b[0])/2,(a[1]+b[1])/2];
    const width = Math.hypot(a[0]-b[0],a[1]-b[1]);
    const hall = shifted(xy,u,-87);
    accessDeck(batch,obstacles,[a,b,xy(u+width/2,-62),xy(u-width/2,-62)],level);
    guardrail(batch,a,xy(u-width/2,-62),level);
    guardrail(batch,b,xy(u+width/2,-62),level);
    if (i===0) {
      const roofFrame = (along,across) => hall(-across,along);
      vault(batch,roofFrame,54,width-.7,()=>level+3.65,1.1,cream);
      for (let v=-111; v<=-63; v+=8)
        for (const du of [-1,1]) cylinder(batch,...xy(u+du*(width*.5-.8),v),level,level+3.66,.17,.15,cream,7);
      obstacles.add(rect(hall,0,0,width,54),level+4.75);
    }
    const inland = [land[0]-(xy(0,9)[0]-xy(0,0)[0]),land[1]-(xy(0,9)[1]-xy(0,0)[1])];
    const foot = localFrame(inland,sanqiutian.angle);
    const landing = rect(foot,0,0,width,18.5);
    foundation(batch,geo,landing,Math.max(level,...landing.map(p=>groundY(geo,...p)+.12)),granite,'#c2b6a2');
  }
  for (const u of [-25,-9.5,6,21.5,37]) gangway(batch,obstacles,xy(u,-32.2),xy(u,-7.4),level,4.8,true);
  for (const [a,b] of [[-34,-28],[-22.2,-12.3],[-6.7,3.2],[8.8,18.7],[24.3,34.1],[40,46]])
    guardrail(batch,xy(a,-32.3),xy(b,-32.3),level);
  pontoon(batch,lamps,obstacles,shifted(xy,7.5,0),90,15.1,90.4,14.4,'striped');
  const gate = shifted(xy,-13,-54.2);
  prism(batch,rect(gate,0,0,32,10.7),level,level+3.75,glass,'#beb7a4',litSurface.ferryGlass);
  vault(batch,gate,34,12.3,()=>level+3.78,.92,'#b9bfb1');
  obstacles.add(rect(gate,0,0,34,12.3),level+4.7);
  berthSign(signs,gate,0,5.43,level+1.78,13,1.56,'三丘田码头');
}

function buildNeicuoao(batch,geo,lamps,obstacles,signs) {
  const { xy } = neicuoao, level = 3.9;
  accessDeck(batch,obstacles,plan.neicuoao.hall,level);
  const apron = rect(xy,0,-58.1,62,10.5);
  foundation(batch,geo,apron,level,granite,'#c6bbab');
  const wall = '#ad8a79', trim = '#d9c7ac';
  // A broad arched central hall rises between two lower arcades. The piers
  // project above the curved parapets on both faces.
  for (const [u, span, depth, eave, rise] of [[-22,17,15.5,4.5,1.2],[22,17,15.5,4.5,1.2],[0,31,18.4,6.5,3.45]]) {
    const hall = shifted(xy,u,-47.6);
    const footprint = rect(hall,0,0,span,depth);
    prism(batch,footprint,level,level+eave,glass,trim,litSurface.ferryGlass);
    const roof = (v,x) => hall(x,v);
    vault(batch,roof,depth+1.2,span+1,()=>level+eave,rise,'#ac9c86');
    for (const v of [-depth/2-.035,depth/2+.035]) {
      for (let j=0;j<10;j++) {
        const x=(j/5-1)*span/2, next=x+span/10;
        const y = t => level+eave+rise*(1-(2*t/span)**2);
        batch.face([up(hall(x,v),y(x)-1.05),up(hall(x,v),y(x)),up(hall(next,v),y(next)),up(hall(next,v),y(next)-1.05)],wall);
      }
    }
    obstacles.add(footprint,level+eave+rise);
  }
  for (const u of [-30,-15,-7.4,7.4,15,30]) {
    const h = level+(Math.abs(u)>24 ? 6.3 : Math.abs(u)>10 ? 9.25 : 11.25);
    for (const v of [-54.8,-38.6]) {
      prism(batch,rect(xy,u,v,1.2,1.3),level,h,wall,trim,14);
      prism(batch,rect(xy,u,v,1.65,1.65),h-.56,h,trim,cream);
      lamps.add(...up(xy(u,v),h-.63),'#fdd79d',.8);
    }
  }
  berthSign(signs,xy,0,-38.30,level+5.3,14.2,2,'内厝澳码头');
  for (const u of [-23,-8,7,22]) gangway(batch,obstacles,xy(u,-34),xy(u,-7.25),level,4.5,false);
  pontoon(batch,lamps,obstacles,xy,61.8,14.8,48,8.5,'sails');
}

function buildPiano(batch,geo,lamps,obstacles,signs) {
  const { xy, angle } = pianoWharf, level = 3.65;
  const apron = rect(xy,17,.85,63,16.6);
  foundation(batch,geo,apron,level,granite,'#c4b9a7');
  obstacles.add(apron,level);
  // The two halls meet the same quay. The raised white lid is an asymmetric
  // shell with an open, louvred gable toward the island square.
  for (const [u, length, lift] of [[0,19.3,1.1],[32.2,23,3.2]]) {
    const hall = shifted(xy,u,0);
    const base = rect(hall,0,0,length,13.8);
    prism(batch,base,level,level+3.45,'#deddd0','#c5cac3',litSurface.ferryGlass);
    const p = (x,v,drop=0) => {
      const t = (x / length + .5);
      return up(hall(x,v),level+3.8+lift*Math.sin(Math.PI*t*.86)**1.4+.038*(v+7)-drop);
    };
    for(let i=0;i<12;i++) {
      const a=length*(i/12-.5), b=a+length/12;
      batch.top([p(a,-7.6),p(b,-7.6),p(b,8.1),p(a,8.1)],'#ebe9db');
      for(const v of [-7.6,8.1]) {
        batch.face([p(a,v,.28),p(a,v),p(b,v),p(b,v,.28)],cream);
        batch.face([up(hall(a,v),level+3.46),p(a,v,.30),p(b,v,.30),up(hall(b,v),level+3.46)],'#56696b');
      }
      if(i%2===1) {
        const q=hall(a,7.95);
        cylinder(batch,...q,level, p(a,7.95)[1]-.24,.13,.11,cream,6);
      }
    }
    for(const v of [-7.65,8.15]) for(const h of [.16,.78,1.4,2.02]){
      const from = h>.9 ? -.12*length : -.30*length;
      if (h+.55>lift) continue;
      pathTube(batch,[up(hall(from,v),level+3.85+h),up(hall(length*.49,v),level+3.85+h)],.09,cream,5);
    }
    obstacles.add(rect(hall,0,0,length,16.2),level+4.42+lift);
  }
  berthSign(signs,xy,32,8.24,level+2.25,12.6,1.52,'钢琴码头');
  for (const [shore,float] of plan.piano.gangways) gangway(batch,obstacles,shore,float,level,3.05,true);
  for (const ring of plan.piano.pontoons) {
    const f = footprintFrame(ring,angle);
    pontoon(batch,lamps,obstacles,f.xy,f.width,f.depth,f.width-.4,f.depth-.8);
  }
}

export function buildIslandWharves(batch,geo,lamps,obstacles,signs) {
  buildSanqiutian(batch,geo,lamps,obstacles,signs);
  buildPiano(batch,geo,lamps,obstacles,signs);
  buildNeicuoao(batch,geo,lamps,obstacles,signs);
  const shore = measuredPath(plan.promenade), historic = plan.historicLanding;
  const landing = shore.nearest(...historic[0]).s;
  const deck = shore.sections(5).map(row => {
    const inner=[row.x-3*row.rx,row.z-3*row.rz], outer=[row.x+.35*row.rx,row.z+.35*row.rz];
    return { inner,outer,s:row.s,y:Math.max(2.65,groundY(geo,...inner)+.19) };
  });
  for(let i=1;i<deck.length;i++) {
    const a=deck[i-1], b=deck[i];
    if(Math.abs((a.s+b.s)/2-landing)<4) continue;
    const edgeA=up(a.outer,a.y), edgeB=up(b.outer,b.y);
    batch.top([up(a.inner,a.y),edgeA,edgeB,up(b.inner,b.y)],'#c4b9a4',17);
    batch.face([up(a.outer,-.7),edgeA,edgeB,up(b.outer,-.7)],'#9a9482',13);
    pathTube(batch,[up(a.outer,a.y+.85),up(b.outer,b.y+.85)],.095,cream,5);
    cylinder(batch,...a.outer,a.y-.05,a.y+.90,.13,.13,granite,6);
    obstacles.add([a.inner,a.outer,b.outer,b.inner],Math.max(a.y,b.y)+.85);
  }
  const [a,b]=historic, length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const f=localFrame(a,bearing(a,b)), top=Math.max(2.9,groundY(geo,...a)+.35);
  for(let i=0;i<16;i++){
    const ring=rect(f,(i+.5)*length/16,0,length/16+.04,5.2);
    const y=mix(top,.12,i/15);
    prism(batch,ring,-.85,y,'#9d9282','#c7b9a2',13);
    obstacles.add(ring,y);
  }
}
