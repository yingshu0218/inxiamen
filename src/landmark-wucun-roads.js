import { cylinder, groundY, litSurface, mix, prism } from './scenery-mesh.js';
import { rect, up } from './landmark-forms.js';
import { alongFrame, offset, ribbon } from './old-town-layout.js';
import { pathTube } from './landmark-haicang.js';
import { stationPoint } from './railway-layout.js';
import { districtRing, plan, south, stationWalks, streets, xiahe, wucunWalkDeck } from './wucun-layout.js';

const asphalt = '#575f5f', lanePaint = '#e0ddcf', curb = '#c3c1b2', sidewalk = '#b4b2a3';
const concrete = '#a6b0ac', rail = '#788e90';
export const streetHeight = (geo, x, z) => groundY(geo, x, z) + .46;
const joinPoints = [[-2, -204], [538, -204], [-293, 103], [310, 122], [151, 165], [-47, 165]]
  .map(([u, v]) => stationPoint(u, v));
const onRoad = (x, z) => streets.some(({ path, width }) => path.nearest(x, z).distance < width / 2 + .96);

function lamp(batch, lights, p, y, direction = 1, tall = true) {
  const h = tall ? 8.45 : 4.5, reach = tall ? 2.02 : .65;
  const a = [p.x, p.z], b = offset(p, reach * direction);
  cylinder(batch, ...a, y, y + .38, .22, .17, '#929e99', 7);
  pathTube(batch, [up(a, y + .26), up(a, y + h - .64), up(offset(p, reach * direction * .45), y + h - .12), up(b, y + h)],
    tall ? .113 : .085, '#8d9998', 6);
  const body = alongFrame({ ...p, x: b[0], z: b[1] });
  prism(batch, rect(body, 0, 0, .49, .97), y + h - .09, y + h + .11, '#aab0a6', '#b9c0b4', litSurface.canopyLight);
  lights.add(...up(b, y + h - .18), '#ffe4b3', tall ? 1.55 : .84);
}

function pavedStripe(batch, point, u, v, w, d, height, color = lanePaint) {
  const rng = rect(alongFrame(point), u, v, w, d);
  batch.top(rng.map(pos => up(pos, height(...pos) + .023)), color);
}

function crossing(batch, path, s, half, height) {
  if (s < 5 || s > path.length - 5) return;
  const p = path.sample(s);
  for (let v = -half + .58; v < half - .35; v += .88) pavedStripe(batch, p, 0, v, 3.2, .48, height);
  pavedStripe(batch, p, -3.4, 0, .27, half * 2 - .55, height);
}

function arrow(batch, p, lateral, height) {
  const frame = alongFrame(p);
  const points = [[1.75, 0], [.2, .68], [.2, -.68]].map(([u, v]) => frame(u, v + lateral));
  batch.top(points.map(pos => up(pos, height(...pos) + .026)), '#ded9c9');
  pavedStripe(batch, p, -.88, lateral, 2.12, .17, height);
}

function junctionSignals(batch, geo, lamps) {
  for (const [u,v,turn] of [[-23,-188,-1],[24,-184,1],[-22,-228,1],[23,-227,-1],[517,-193,1],[552,-214,-1]]) {
    const [x,z]=stationPoint(u,v), y=streetHeight(geo,x,z)+.16;
    const at=(a,b,h)=>up(stationPoint(u+a,v+b),y+h);
    pathTube(batch,[at(0,0,0),at(0,0,4.52),at(turn*1.52,0,5.03),at(turn*4.8,0,5.19)],.128,'#748887',7);
    prism(batch,rect(stationPoint,u+turn*4.2,v,.62,.28),y+4.58,y+5.15,'#3d4846','#62716b');
    for(const [n,color] of ['#b3593f','#937b42','#709962'].entries()) {
      const [lx,h,lz]=at(turn*4.39+n*.19,-.17,4.85);
      const point = rect(stationPoint,u+turn*4.39+n*.19,v-.17,.13,.06);
      prism(batch,point,h-.057,h+.057,color,color);
      if(n===2)lamps.add(lx,h,lz,'#b0d486',.52);
    }
  }
}

function drawStreet(batch, geo, lights, street) {
  const { key, width, lanes, sidewalk: walk, path, direction } = street;
  const half = width / 2, minor = key === 'service' || key === 'dropOff';
  const y = (x, z) => streetHeight(geo, x, z) - (minor ? .038 : 0);
  const gaps = joinPoints.map(p => path.nearest(...p)).filter(n => n.distance < 34 && n.s > 1 && n.s < path.length - 1).map(n => n.s);
  const insideJunction = (s, width = minor ? 8 : 15) => gaps.some(t => Math.abs(s - t) < width);
  const rows = path.sections(minor ? 2.3 : 5.3);
  ribbon(batch, rows, -half, half, y, minor ? '#646966' : asphalt, litSurface.streetAsphalt, lanes);
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (insideJunction((a.s + b.s) / 2)) continue;
    const pair = [a, b];
    for (const side of [-1, 1]) {
      const edge = side * half;
      ribbon(batch, pair, edge, edge + side * walk, (x, z) => y(x, z) + .165, sidewalk, 17);
      ribbon(batch, pair, edge, edge + side * .28, (x, z) => y(x, z) + .185, curb);
      if (!minor) ribbon(batch, pair, edge - side * .25, edge - side * .39, (x, z) => y(x, z) + .022, '#c6c4b2');
    }
  }
  if (minor) return;
  const laneWidth = width / lanes;
  for (let s = 4; s < path.length - 5; s += 10.5) {
    if (insideJunction(s, 16)) continue;
    const p = path.sample(s);
    for (let l = 1; l < lanes; l++) pavedStripe(batch, p, 0, l * laneWidth - half, 4.25, .14, y, '#c8c8bc');
  }
  for (let s = 31; s < path.length - 17; s += 53) {
    if (insideJunction(s, 18)) continue;
    const p = path.sample(s), [x, z] = offset(p, half + .82);
    lamp(batch, lights, { ...p, x, z }, y(x, z) + .15, -1);
  }
  for (const s of gaps) {
    crossing(batch, path, s - 17.5, half, y);
    crossing(batch, path, s + 17.5, half, y);
    const approach = s - direction * 29;
    if (approach < 4 || approach > path.length - 4) continue;
    const p = path.sample(approach);
    const heading = { ...p, ux:p.ux * direction, uz:p.uz * direction };
    for (let i = 0; i < lanes; i++) arrow(batch, heading, (i + .5) * laneWidth - half, y);
  }
}

function bridgeEdges(batch, rows, half, height, fascia, guard, openGuard) {
  const edge = (p, d, extra = 0) => {
    const x = p.x + p.rx * d, z = p.z + p.rz * d;
    return [x, height(p.x, p.z, p.s) + extra, z];
  };
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    for (const side of [-1, 1]) {
      const v = side * half, t = fascia > 1 ? 1.08 : 1.24;
      batch.face([edge(a, v), edge(b, v), edge(b, v, -fascia), edge(a, v, -fascia)], concrete, litSurface.paleStone);
      if (openGuard?.((a.s + b.s) / 2)) continue;
      batch.face([edge(a, v, .12), edge(a, v, t - .195), edge(b, v, t - .195), edge(b, v, .12)], guard);
      batch.face([edge(a, v, t - .17), edge(a, v, t), edge(b, v, t), edge(b, v, t - .17)], '#cad0c3');
    }
  }
}

function overpasses(batch, geo, lights, obstacles) {
  for (const [i, path] of stationWalks.entries()) {
    const half = i === 0 ? 2.5 : 1.83;
    const deck = wucunWalkDeck(geo, path);
    const level = (_x, _z, s) => {
      const p = path.sample(s);
      const land = streetHeight(geo, p.x, p.z);
      return Math.max(deck, land + 1);
    };
    const rows = path.sections(4.5);
    ribbon(batch, rows, -half, half, level, '#a5b0a8', 17);
    bridgeEdges(batch, rows, half, level, .64, '#80a3a6');
    for (let s = 6.3; s < path.length - 5; s += 17.1) {
      const p = path.sample(s), y = level(p.x, p.z, s);
      if (!onRoad(p.x,p.z)) cylinder(batch, p.x, p.z, groundY(geo, p.x, p.z) - .38, y - .43, .365, .48, '#9daaa0', 8);
      if (i === 0 || s > 18) lights.add(p.x, y + .75, p.z, '#d5eccb', .85);
    }
    for (const end of [0, path.length]) {
      const p = path.sample(end), xy = alongFrame(p), finish = level(p.x, p.z, end);
      const side = i % 2 ? -1 : 1;
      const [x, z] = xy(0, side * 14.4), base = groundY(geo, x, z) + .24;
      const count = Math.max(3, Math.ceil((finish - base) / .21));
      const run = 15 / count;
      for (let step = 0; step < count; step++) {
        const top = mix(finish, base, step / count), first = mix(finish, base, (step + 1) / count) - .12;
        prism(batch, rect(xy, 0, side * (half - .15 + run * (step + .5)), 2.95, run + .015), first, top, '#9ca8a0', '#aab5a9');
      }
      pathTube(batch, [up(xy(-1.47, side * half), finish + 1.08), up(xy(-1.47, side * (half + 15)), base + 1.09)], .08, rail, 6);
      pathTube(batch, [up(xy(1.47, side * half), finish + 1.08), up(xy(1.47, side * (half + 15)), base + 1.09)], .08, rail, 6);
    }
    const a = path.sample(0), b = path.sample(path.length);
    obstacles.add([offset(a, -half), offset(a, half), offset(b, half), offset(b, -half)], deck + 1.9);
  }
}

function median(batch, geo) {
  const outline = districtRing(plan.southVerge);
  const floor = Math.max(...outline.map(([x, z]) => groundY(geo, x, z))) + .13;
  // Planting beds sit close to the road surface; their longitudinal grade is in the terrain.
  for (const [a, b, depth] of [[-190, -96, 6], [-40, 36, 8.1], [42, 93, 9], [111, 164, 6.0]]) {
    const v = 186, ring = districtRing([[a, v + 1.2], [a + 4, v - depth / 2], [b - 3, v - depth / 2],
      [b, v - 1.0], [b - 4, v + depth / 2], [a + 4, v + depth / 2]]);
    const y = Math.min(floor, Math.max(...ring.map(p => groundY(geo, ...p))) + .27);
    prism(batch, ring, Math.min(...ring.map(p => groundY(geo, ...p))) - .2, y, curb, '#819363', 0, .2, 0, 22);
  }
}

function trafficRoad(geo, [north, southRoad], name) {
  const path = north.path;
  function step(t) {
    const p = path.sample(path.length * t);
    return { ...p, rx: -p.uz, rz: p.ux, t };
  }
  function at(p, lateral, extra) {
    const road = lateral > 0 ? southRoad : north;
    const q = road.path.sample(road.path.length * p.t);
    const lane = road.width / road.lanes;
    const [x, z] = offset(q, Math.abs(lateral) > 4 ? lane * .87 : -lane * .62);
    return [x, streetHeight(geo, x, z) + extra, z];
  }
  return { name, surfaceStreet: true, length: path.length, step, at, center: step(.5) };
}

export function buildWucunRoads(batch, geo, lamps, obstacles) {
  for (const street of streets) drawStreet(batch, geo, lamps, street);
  median(batch, geo);
  junctionSignals(batch, geo, lamps);
  overpasses(batch, geo, lamps, obstacles);
  return [trafficRoad(geo, xiahe, '厦禾路 · 地面车流'), trafficRoad(geo, south, '站南路 · 地面车流')];
}
