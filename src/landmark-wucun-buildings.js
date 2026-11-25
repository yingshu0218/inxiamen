import { ellipse, rect, up } from './landmark-forms.js';
import { cylinder, groundY, litSurface, mix, prism, signedArea } from './scenery-mesh.js';
import { stationPoint } from './railway-layout.js';
import { districtRing, plan, transitYard, transitYardLevels } from './wucun-layout.js';

const limestone = '#c8c1b3', aluminum = '#c5ccca', darkGlass = '#6b858d';
const slab = (u, v, w, d) => rect(stationPoint, u, v, w, d);
const pos = (u, v, y) => up(stationPoint(u, v), y);
const deck = (geo, ring) => {
  const heights = ring.map(p => groundY(geo, ...p)).sort((a, b) => a - b);
  return [heights[0] - .55, heights[heights.length >> 1] + .30];
};

function block(batch, u, v, w, d, bottom, top, wall, roof = wall, style = 0) {
  prism(batch, slab(u, v, w, d), bottom, top, wall, roof, style);
}

function scaleRing(ring, scale) {
  const [x, z] = ring.reduce(([a, b], p) => [a + p[0] / ring.length, b + p[1] / ring.length], [0, 0]);
  return ring.map(p => [mix(x, p[0], scale), mix(z, p[1], scale)]);
}

function clippedTower(u, v, width, depth, cut = 2.1) {
  const a = width / 2, b = depth / 2;
  return districtRing([[u-a+cut,v-b],[u+a-cut,v-b],[u+a,v-b+cut],[u+a,v+b-cut],
    [u+a-cut,v+b],[u-a+cut,v+b],[u-a,v+b-cut],[u-a,v-b+cut]]);
}

function tower(batch, obstacles, input, base, top, wall, ribs, kind = litSurface.office, seed = .4) {
  const ring = signedArea(input) > 0 ? input : input.toReversed();
  const shoulder = top - 2.7;
  prism(batch, ring, base, shoulder, wall, '#a3aeaa', kind, seed);
  prism(batch, scaleRing(ring, 1.013), shoulder - .42, shoulder + .49, ribs, aluminum);
  prism(batch, scaleRing(ring, .79), shoulder + .46, top - .62, '#989d96', '#c1c0ad', litSurface.graniteFacing);
  prism(batch, scaleRing(ring, .82), top - .64, top + .22, aluminum, '#b1b7b0');
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ln = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (ln < 7) continue;
    const ox = (b[1] - a[1]) / ln, oz = (a[0] - b[0]) / ln;
    const p = (t, y, offset = .20) => [mix(a[0], b[0], t) + ox * offset, y, mix(a[1], b[1], t) + oz * offset];
    const bays = Math.max(3, Math.round(ln / 5.2));
    for (let j = 0; j <= bays; j++) {
      const t = .036 + j / bays * .928, half = (j === 0 || j === bays ? .40 : .225) / ln;
      batch.face([p(t-half, base), p(t+half, base), p(t+half, shoulder-.12), p(t-half, shoulder-.12)], ribs);
    }
    for (let y = base + 12.2; y < shoulder - 2; y += 15.1) {
      batch.face([p(.007,y),p(.993,y),p(.993,y+.38),p(.007,y+.38)], ribs);
    }
  }
  obstacles.add(ring, top + .24);
}

function podium(batch, geo, index, ring, levels, stone = limestone, windows = darkGlass) {
  const [bottom, ground] = deck(geo, ring), top = ground + levels * 3.58 + 1.14;
  const trim = scaleRing(ring, 1.010);
  prism(batch, ring, bottom, ground + .35, '#97998d', stone);
  prism(batch, ring, ground + .34, top - .7, windows, '#adb1a9', litSurface.shopfront, .52);
  for (let y = ground + 4.07; y < top - 1.0; y += 3.58) {
    prism(batch, trim, y, y + .56, stone, null, litSurface.graniteFacing);
  }
  prism(batch, trim, top - .90, top, stone, '#b2b5a9', litSurface.graniteFacing, .2, 0, 22);
  index.add(ring, top);
  return { ground, top };
}

function sign(signs, label, left, right, y, height) {
  signs.push({ label, a: stationPoint(...left), b: stationPoint(...right), y, height });
}

function yuyue(batch, geo, lights, obstacles, signs) {
  const ring = districtRing(plan.yuyue);
  const { ground, top } = podium(batch, geo, obstacles, ring, 5, '#b9b5ae', '#7a929d');
  const towers = [
    [clippedTower(-216.7, -179, 37.9, 39.1, 3.7), 128, '#8d9ba7', '#b9c0bb'],
    [clippedTower(-136.2, -151.6, 36.5, 40.4, 4.9), 138, '#748a99', '#c3c6ba'],
  ];
  for (const [shape, height, glass, columns] of towers) tower(batch, obstacles, shape, top-.15, ground+height, glass, columns, litSurface.office, .58);
  const gallery = slab(-178, -113, 52.4, 21.3);
  prism(batch, gallery, top-.10, top+4.12, '#849599', '#7f9296', litSurface.ferryGlass, .43);
  prism(batch, scaleRing(gallery, 1.03), top+4.07, top+4.44, aluminum, '#acb9bc');
  block(batch, -145.4, -184.5, 68, 5.4, ground+3.1, ground+3.46, '#a55e69', '#c99a9a');
  for (const [u, v] of [[-150,-186],[-140,-186],[-130,-186],[-120,-186],[-110,-186]]) {
    lights.add(...pos(u,v,ground+4.01),'#f6cfb4',1.1);
  }
  // The mapped edge is broken by a broad entry and a separate shopfront terrace.
  block(batch, -127, -171, 34.5, 2.1, ground+4.5, ground+10.2, '#797e83', '#949894');
  sign(signs, '禹悦汇', [-105.8,-192.8], [-145.4,-205], ground+8.9, 4.05);
}

function robinson(batch, geo, lights, obstacles, signs) {
  const outline = districtRing(plan.robinson);
  const { ground, top } = podium(batch, geo, obstacles, outline, 4, '#cecabc', '#6a7b80');
  const heights = [91, 93, 107, 109, 94];
  for (const [i, ring] of plan.robinsonTowers.entries()) {
    const shape = scaleRing(districtRing(ring), .98);
    tower(batch, obstacles, shape, top, ground + heights[i], i % 2 ? '#bdb7a9' : '#b0ac9d', '#d4cbbc', 20, .27+i*.09);
  }
  for (const [u,v,w,d] of [[-205,-320,26,7.6],[-179,-304,13,10],[-121,-276,12,14],[-104,-294,8,19]]) {
    block(batch,u,v,w,d,top-.05,top+.45,'#b4b6aa','#7d8e64');
    block(batch,u,v,w*.73,d*.66,top+.35,top+1.04,'#6f845a','#9ba578');
  }
  const a = stationPoint(-189,-282.2), b = stationPoint(-145,-263.3);
  signs.push({label:'罗宾森广场',a,b,y:ground+8.9,height:3.7});
  for (const t of [.10,.34,.62,.89]) lights.add(mix(a[0],b[0],t),ground+5.05,mix(a[1],b[1],t),'#fde0be',1.15);
}

function coachStation(batch, geo, lights, obstacles, signs) {
  const outline = districtRing(plan.coachHouse);
  const { ground, top } = podium(batch, geo, obstacles, outline, 3, '#c1bcb0', '#7c929b');
  tower(batch, obstacles, clippedTower(67,-266,34,53,3.2), top, ground+82, '#8f9a9e', '#b9c1bf', 20, .37);
  tower(batch, obstacles, clippedTower(103,-294,32,40,1.6), top, ground+88, '#9ca4a2', '#c6c6b8', 20, .46);
  block(batch, 64, -223.5, 46, 4.03, ground+4.15, ground+4.49, '#a4ada5', '#b9beb2');
  sign(signs, '梧村汽车站', [47.6,-224.8], [84.4,-216.85], ground+5.06, 3.8);
  for (const u of [47, 59, 71, 83]) lights.add(...pos(u,-221.4,ground+4.05),'#fddfb6',1.24);

  const [bottom, y] = transitYardLevels(geo);
  prism(batch, transitYard, bottom, y, '#90968b', '#646c68', 0, .2, 0, litSurface.streetAsphalt);
  block(batch, 191, -281, 117, 15.6, y + 4.3, y + 5.02, '#aeb7b3', '#bfc6bf');
  for (let u=136;u<248;u+=8.4) {
    const [x,z]=stationPoint(u,-277.5);
    cylinder(batch,x,z,y,y+4.4,.225,.195,'#a8b0a6',7);
    batch.top(slab(u,-263.1,.16,21).map(p=>up(p,y+.022)), '#ccc4a2');
    if (Math.round(u)%3!==0) lights.add(...pos(u,-278.1,y+4.22),'#e6e9d3',.94);
  }
  block(batch, 198, -302, 95, 17, y-.12, y+6.4, '#a1aaa1', '#bbc2b8', litSurface.studioRibbon);
  obstacles.add(slab(191,-281,117,16),y+5.15);
  obstacles.add(slab(198,-302,95,17),y+6.5);
}

function eastBlocks(batch, geo, lights, obstacles, signs) {
  const hotel = districtRing(plan.hotelBlock);
  const { ground, top } = podium(batch, geo, obstacles, hotel, 3, '#c5beb0', '#8b9b9d');
  tower(batch, obstacles, clippedTower(118,-115,34,54,3), top, ground+55, '#b0a596', '#cec7b4', 20, .31);
  block(batch, 100, -91, 10, 12.4, top+.05, top+.18, '#a5b4a6', '#618992');
  block(batch, 106, -149, 24, 4.4, ground+4.01, ground+4.41, '#b9beb1', '#d4d0c1');
  sign(signs, '东南亚大酒店', [135,-168.8], [89.4,-167.6], ground+6, 3.6);
  lights.add(...pos(103,-156,ground+5.1),'#f6d5aa',1.26);
  const court = districtRing(plan.eastHousing);
  const residence = podium(batch,geo,obstacles,court,3,'#a7afa8','#73878b');
  for (const [i, [u,v,w,d,h]] of [[169,-121,27,42,59],[212,-120,29,46,66],[228,-82,27,28,54]].entries()) {
    tower(batch,obstacles,clippedTower(u,v,w,d,2.7),residence.top,residence.ground+h,
      i%2?'#a6b0b1':'#abb4ad','#d0c8b9',20,.44+i*.12);
  }
  block(batch,192,-95,19.5,18,residence.top-.12,residence.top+.44,'#a1aa97','#83906b');
}

function school(batch, geo, lights, obstacles, signs) {
  const outline = districtRing(plan.school);
  const [, ground] = deck(geo, outline);
  const p = (u,v,y) => pos(u,v,ground+y);
  const turf = ellipse(stationPoint,-356,-156,17.25,34.2,42);
  const track = ellipse(stationPoint,-356,-156,21.1,39.3,42);
  prism(batch, track, ground - .77, ground + .36, '#a37e6a', '#a47766', 0, .12, 0, 17);
  batch.top(turf.map(q=>up(q,ground+.41)), '#708a5c');
  for (let j=0;j<4;j++) {
    const a=ellipse(stationPoint,-356,-156,17.7+j*1.05,35.03+j*1.16,42);
    const b=ellipse(stationPoint,-356,-156,17.81+j*1.05,35.14+j*1.16,42);
    for (let i=0;i<a.length;i++) {
      const k=(i+1)%a.length;
      batch.top([up(a[i],ground+.425),up(a[k],ground+.425),up(b[k],ground+.425),up(b[i],ground+.425)],'#ddd1be');
    }
  }
  block(batch,-356,-157,21,50,ground+.39,ground+.44,'#748d5e','#7b925e');
  batch.top([p(-366,-156,.455),p(-346,-156,.455),p(-346,-155.82,.455),p(-366,-155.82,.455)], '#d3d3ae');
  for (const v of [-180.4,-133.6]) {
    for(const u of [-358,-354]) cylinder(batch,...stationPoint(u,v),ground+.43,ground+2.05,.061,.049,'#ded9bd',6);
    block(batch,-356,v,4.15,.11,ground+1.94,ground+2.08,'#dadac5');
  }
  for (const [u,v,w,d] of [[-316,-173,24.5,39.7],[-297,-180,12,26]]) {
    block(batch,u,v,w,d,ground-.65,ground+.34,'#8e9281','#5e8399');
    for (const e of [-1,1]) {
      block(batch,u+e*(w/2-1.45),v,.14,d-3,ground+.343,ground+.356,'#d9d8bc');
      block(batch,u,v+e*(d/2-1.6),w-2.8,.14,ground+.343,ground+.356,'#d9d8bc');
    }
    block(batch,u,v,w-2.8,.15,ground+.343,ground+.356,'#d9d8bc');
  }
  for (const [u,v,w,d,h] of [[-305,-223,57,18,16.8],[-272,-198,17,49,18.7],[-305,-142,42,13.5,13.3]]) {
    const ring = slab(u,v,w,d);
    const [bottom,y] = deck(geo,ring);
    prism(batch,ring,bottom,y+h,'#c5baaa','#a6755e',1,.44,1.38,litSurface.pantile);
    for (let z=y+1;z<y+h;z+=3.78) prism(batch,scaleRing(ring,1.011),z,z+.31,'#d8cabb',null);
    obstacles.add(ring,y+h+1.4);
  }
  block(batch,-289,-131,16,2.5,ground-.45,ground+3.03,'#c6b8a4','#d2c6b2');
  sign(signs,'梧村小学',[-296.5,-129.68],[-281.5,-129.68],ground+.91,1.43);
  for (const [u,v] of [[-340,-112],[-280,-141],[-283,-234]]) lights.add(...pos(u,v,ground+5.2),'#f1d3a3',1.12);
}

function parking(batch, geo) {
  for (const [i, lot] of plan.parking.entries()) {
    const positions = districtRing(lot), [bottom, y] = deck(geo,positions);
    prism(batch,positions,bottom,y,'#81857a','#777d73',0,0,0,litSurface.streetAsphalt);
    const v = i ? 107 : 101, u = i ? 250 : -220;
    for (let j=0;j<12;j++) {
      block(batch,u+j*2.84,v,.107,5.8,y,y+.027,'#c7c5ad');
      if (j%5===2||j%7===5)continue;
      const color=['#9da9a8','#bdbaaa','#6a7d87','#927b70','#d2cdc0'][j%5];
      block(batch,u+j*2.84+1.35,v,1.76,4.15,y+.11,y+.86,color,color);
      block(batch,u+j*2.84+1.35,v-.13,1.53,1.92,y+.85,y+1.31,'#515f62',color);
    }
  }
}

export function buildWucunBuildings(batch, geo, lights, obstacles, signs) {
  yuyue(batch,geo,lights,obstacles,signs);
  robinson(batch,geo,lights,obstacles,signs);
  coachStation(batch,geo,lights,obstacles,signs);
  eastBlocks(batch,geo,lights,obstacles,signs);
  school(batch,geo,lights,obstacles,signs);
  parking(batch,geo);
}
