import { replacesCoastStreet, replacesNorthernRecord } from './coast/layout.js';
import { insidePark } from './parks/layout.js';
import { replacesXiagangStreet } from './xiagang-layout.js';
import { replacesStreet } from './old-town-layout.js';
import { replacesHubinStreet } from './hubin-layout.js';
import { railwayReserved } from './railway-layout.js';
import { replacesWucunStreet } from './wucun-layout.js';
import { replacesBrtRoad } from './brt-layout.js';
import { replacesCampusStreet } from './campus-layout.js';
import { MeshBatch, litSurface, cylinder, inRing } from './scenery-mesh.js';
import { airportRoadReserved } from './airport-layout.js';
import { gulangyuReserved } from './landmark-gulangyu.js';
import { inIslandBounds } from './gulangyu-layout.js';
import { reachesYanwuFromLujiang, replacesYanwuPlatformTile } from './yanwu-layout.js';

const roadTones = ['#a2957d', '#787a71', '#777d73', '#737a72', '#717775', '#6f7472', '#67706e'];
const widths = [1.6, 3.6, 5.4, 7.7, 10.5, 13.6, 18];
function islandPaving(batch, a, b, distance, station, width) {
  const y0 = 0.5 * (a.lo[1] + a.hi[1]),
    y1 = 0.5 * (b.lo[1] + b.hi[1]);
  const height = Math.abs(y1 - y0),
    steps = width < 3 && height / distance > 0.15 ? Math.ceil(height / 0.21) : 1;
  const interp = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
  for (let k = 0; k < steps; k++) {
    const t = k / steps,
      end = (k + 1) / steps;
    const l = interp(a.lo, b.lo, t),
      r = interp(a.hi, b.hi, t),
      q = interp(a.hi, b.hi, end),
      p = interp(a.lo, b.lo, end);
    const uv = [
      [station + t * distance, 0],
      [station + t * distance, width],
      [station + end * distance, width],
      [station + end * distance, 0],
    ];
    if (steps > 1) {
      const level = Math.max(y0 + (y1 - y0) * t, y0 + (y1 - y0) * end) + 0.035;
      for (const point of [l, r, q, p]) point[1] = level;
      const downhill = y1 > y0 ? [l, r] : [q, p];
      const [u, v] = downhill;
      batch.face(
        [u, v, [v[0], v[1] - height / steps - 0.04, v[2]], [u[0], u[1] - height / steps - 0.04, u[2]]],
        '#958977'
      );
    }
    batch.top([l, r, q, p], steps > 1 ? '#bfae96' : '#b8ae9c', 17, 0, uv);
  }
  if (width > 3) {
    batch.top([a.lo, a.inL, b.inL, b.lo], '#d4c3aa');
    batch.top([a.inR, a.hi, b.hi, b.inR], '#d4c3aa');
  }
}

function islandLantern(batch, lights, point) {
  const [x, ground, z] = point;
  cylinder(batch, x, z, ground - 0.14, ground + 0.25, 0.18, 0.13, '#746e61', 6);
  cylinder(batch, x, z, ground + 0.23, ground + 3.08, 0.083, 0.056, '#55594e', 6);
  cylinder(
    batch,
    x,
    z,
    ground + 3.08,
    ground + 3.53,
    0.17,
    0.21,
    '#e3cc9a',
    5,
    0,
    '#908475',
    litSurface.spine
  );
  cylinder(batch, x, z, ground + 3.53, ground + 3.77, 0.24, 0.02, '#575747', 5);
  lights.add(x, ground + 3.35, z, '#ffce86', 1.18);
}

export function bridgeCorridors(roads) {
  const cells=new Map(),cell=85;
  for(const road of roads.flatMap((r) => [r, ...(r.approaches ?? [])])){
    if(road.surfaceStreet)continue;
    const reach = road.streetClearance ?? 24;
    const n=Math.ceil(road.length/Math.min(13, reach * .61));
    for(let i=0;i<=n;i++){
      const point=road.step(i/n);
      point.reach2 = reach * reach;
      for(let cx=Math.floor((point.x-reach)/cell);cx<=Math.floor((point.x+reach)/cell);cx++)
        for(let cz=Math.floor((point.z-reach)/cell);cz<=Math.floor((point.z+reach)/cell);cz++){
          const key=cx*2048+cz;
          if(!cells.has(key))cells.set(key,[]);
          cells.get(key).push(point);
        }
    }
  }
  return (x,z,dx,dz)=>{
    const points=cells.get(Math.floor(x/cell)*2048+Math.floor(z/cell));
    return points?.some(p=>(p.x-x)**2+(p.z-z)**2<p.reach2 && (dx === undefined || Math.abs(dx*p.rz-dz*p.rx)>.72));
  };
}

function streetJunctions(records,geo) {
  const nodes=new Map();
  for(const r of records){
    const elevated=Boolean(r[1]&1)||r[2]>0;
    for(const i of [3,r.length-2]){
      const x=r[i],z=r[i+1],key=x+','+z;
      const h=geo.heightAt(x,z);
      const proposal=elevated?h+4.8+Math.max(0,r[2]-1)*4.6:h;
      nodes.set(key,Math.min(nodes.get(key)??Infinity,proposal));
    }
  }
  return nodes;
}

export function addStreets(parent, geo, records, material, frame, lights, modeledRoads) {
  const reserved=bridgeCorridors(modeledRoads);
  const junctions=streetJunctions(records,geo);
  const sectors = new Map();
  for (const [kind, flags, layer, ...flat] of records) {
    const bridge=Boolean(flags&1)||layer>0;
    if (flat.length < 4 || replacesNorthernRecord(kind,bridge,flat)) continue;
    if (bridge && kind < 1 && replacesYanwuPlatformTile(flat)) continue;
    const yanwuContinuation = !bridge && kind === 4 && reachesYanwuFromLujiang(flat);
    const island = kind <= 1 && inIslandBounds(flat[0], flat[1])
      && (inRing(flat[0],flat[1],geo.islands.gulangyu) || inRing(flat.at(-2),flat.at(-1),geo.islands.gulangyu));
    const points = [],
      width = island ? (kind === -1 ? 2.05 : kind === 0 ? 3.25 : 4.35) : widths[kind + 1],
      shade = roadTones[kind + 1];
    for (let i = 2; i < flat.length; i += 2) {
      const x0 = flat[i - 2],
        z0 = flat[i - 1],
        dx = flat[i] - x0,
        dz = flat[i + 1] - z0,
        steps = Math.ceil(Math.hypot(dx, dz) / (island ? 7.5 : 24));
      for (let j = 0; j < steps; j++) points.push([x0 + (dx * j) / steps, z0 + (dz * j) / steps]);
    }
    points.push(flat.slice(-2));
    if (points.length < 2) continue;
    const m = points[Math.floor(points.length / 2)];
    const key = Math.floor(m[0] / 2900) + ',' + Math.floor(m[1] / 2900);
    if (!sectors.has(key)) sectors.set(key, new MeshBatch());
    const batch = sectors.get(key);
    const span=bridge ? points.slice(1).reduce((d,p,i)=>d+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0) : 0;
    const head=junctions.get(flat[0]+','+flat[1]),tail=junctions.get(flat.at(-2)+','+flat.at(-1));
    let station=0, nextPier=20;
    let prev,
      along = 0;
    const spacing = kind < 0 ? 69 : 44;
    let nextLantern = 7 + (Math.abs(flat[0] * 13 + flat[1] * 7) % spacing);
    for (let i = 0; i < points.length; i++) {
      const p = points[i],
        last = points[Math.max(0, i - 1)],
        next = points[Math.min(points.length - 1, i + 1)];
      const dx = next[0] - last[0],
        dz = next[1] - last[1],
        l = Math.hypot(dx, dz);
      if(i)station+=Math.hypot(p[0]-last[0],p[1]-last[1]);
      if (l < .03 || (kind < 0 && insidePark(...p)) || airportRoadReserved(frame, ...p, bridge, kind)
          || (!bridge && (geo.waterAt(...p) || (geo.rawHeightAt(...p)<.12 && !geo.isletAt(...p))))
          || (!bridge && (replacesStreet(...p,dx/l,dz/l) || (!layer && replacesXiagangStreet(...p,dx/l,dz/l,kind))))
          || replacesHubinStreet(...p,dx/l,dz/l)
          || replacesCoastStreet(...p,dx/l,dz/l,bridge,kind)
          || replacesWucunStreet(...p,dx/l,dz/l,bridge)
          || replacesBrtRoad(...p,dx/l,dz/l,bridge,kind)
          || (!bridge && replacesCampusStreet(...p,dx/l,dz/l))
          || (!bridge && kind <= 1 && railwayReserved(...p))
          || (kind>=1 && !yanwuContinuation && reserved(...p,dx/l,dz/l)) || gulangyuReserved(...p)) {
        prev = undefined;
        continue;
      }
      let deck;
      if(bridge){
        const t=span>0?station/span:0;
        const rise=Math.min(1,station/52,(span-station)/52);
        deck=Math.max(head*(1-t)+tail*t,geo.heightAt(...p)+rise*(5.2+Math.max(0,layer-1)*4.5));
      }
      const at = (r, extra = 0) => {
        const x = p[0] - (dz / l) * r,
          z = p[1] + (dx / l) * r;
        return [x, Math.max(0.12, (deck??geo.heightAt(x, z)) + 0.39 + extra), z];
      };
      const road = { p, station, lo: at(-width / 2), hi: at(width / 2) };
      if(bridge && prev){
        for(const side of ['lo','hi']){
          const a=prev[side],b=road[side];
          batch.face([a,b,[b[0],b[1]-.82,b[2]],[a[0],a[1]-.82,a[2]]],'#9caaa8');
        }
        if(station>=nextPier && deck>geo.heightAt(...p)+2.2){
          const ground=Math.max(-2,geo.rawHeightAt(...p));
          cylinder(batch,p[0],p[1],ground-.3,deck-.43,Math.max(.55,width*.085),Math.max(.67,width*.106),'#a6afa7',7);
          nextPier=station+43;
        }
      }
      if (island) {
        if (width > 3) {
          road.inL = at(-width / 2 + 0.23, 0.035);
          road.inR = at(width / 2 - 0.23, 0.035);
        }
        if (prev) {
          const length = Math.hypot(p[0] - prev.p[0], p[1] - prev.p[1]);
          if (length > 0.03) islandPaving(batch, prev, road, length, along, width);
          along += length;
          if (along >= nextLantern && (kind >= 0 || geo.coverAt(...p) !== 2)) {
            islandLantern(batch, lights, at(width / 2 + 0.35, -0.39));
            nextLantern = along + spacing;
          }
        }
        prev = road;
        continue;
      }
      if (kind >= 2) {
        road.a = at(-width / 2 + 0.6, 0.026);
        road.b = at(width / 2 - 0.6, 0.026);
      }
      if (prev) {
        if (kind >= 2) {
          // Share the asphalt edges with the shoulders, including on sloping ground.
          batch.top([prev.lo, prev.a, road.a, road.lo], '#aeaa99');
          batch.top([prev.b, prev.hi, road.hi, road.b], '#aeaa99');
          // Metres along the centreline keep dash and light spacing continuous through bends.
          const uv=[[-1,prev.station],[1,prev.station],[1,station],[-1,station]];
          batch.top([prev.a, prev.b, road.b, road.a], shade, litSurface.avenue, kind, uv);
        } else batch.top([prev.lo, prev.hi, road.hi, road.lo], shade);
      }
      if (kind >= 2 && i % (kind >= 4 ? 3 : 5) === 0 && Math.abs(p[0]) < 8000 && p[1] > -9900)
        lights.add(...at(width / 2, 4.4), kind >= 4 ? '#ffc685' : '#ffe7c4', kind >= 4 ? 1.55 : 1.1);
      prev = road;
    }
  }
  for (const [key, batch] of sectors) {
    const mesh = batch.finish(parent, material, '滨海街巷 ' + key);
    if (mesh) mesh.receiveShadow = true;
  }
}
