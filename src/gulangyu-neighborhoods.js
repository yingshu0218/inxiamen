import { ShapeUtils, Vector2 } from 'three';
import { litSurface, prism, signedArea } from './scenery-mesh.js';
import { up } from './landmark-forms.js';
import { islandSiteReserved, market, plan, villageLanes } from './gulangyu-layout.js';

function clipRoof(points, signedDistance) {
  const cut = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const da = signedDistance(a),
      db = signedDistance(b);
    if (da >= 0) cut.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      cut.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return cut;
}

// Intersect each roof plane with the surveyed footprint. This also covers L-shaped
// houses without extending the roof across their open courtyards.
function tiledRoof(batch, ring, cx, cz, ax, az, eaves, rise, color, seed, hip, raisedGable) {
  const local = ring.map(([x, z]) => [(x - cx) * ax + (z - cz) * az, (z - cz) * ax - (x - cx) * az]);
  const us = local.map((p) => p[0]),
    vs = local.map((p) => p[1]);
  const left = Math.min(...us),
    right = Math.max(...us),
    front = Math.min(...vs),
    back = Math.max(...vs);
  const slope = 2 / Math.max(1, back - front);
  const endSlope = 1 / Math.max(1, Math.min((back - front) * 0.62, (right - left) * 0.3));
  const planes = [(p) => (p[1] - front) * slope, (p) => (back - p[1]) * slope];
  if (hip)
    planes.push(
      (p) => (p[0] - left) * endSlope,
      (p) => (right - p[0]) * endSlope
    );
  const xyz = (p, fraction) => [
    cx + ax * p[0] - az * p[1],
    eaves + rise * fraction,
    cz + az * p[0] + ax * p[1],
  ];
  const height = (p) => Math.min(...planes.map((plane) => plane(p)));
  // Most houses are quadrilaterals. Concave plans need clipping per triangle.
  const convex = local.every((a, i) => {
    const b = local[(i + 1) % local.length],
      c = local[(i + 2) % local.length];
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) >= -0.002;
  });
  const pieces = convex
    ? [local]
    : ShapeUtils.triangulateShape(
        local.map((p) => new Vector2(...p)),
        []
      ).map((ids) => ids.map((i) => local[i]));
  const sections = [];
  for (let i = 0; i < planes.length; i++) {
    for (const piece of pieces) {
      let polygon = piece;
      for (let j = 0; j < planes.length && polygon.length >= 3; j++) {
        if (i !== j) polygon = clipRoof(polygon, (p) => planes[j](p) - planes[i](p));
      }
      if (polygon.length < 3) continue;
      batch.top(
        polygon.map((p) => xyz(p, planes[i](p))),
        color,
        16,
        seed,
        polygon
      );
      // Cap the actual shared crest on each occupied roof segment, including split wings.
      if (i === 0) {
        const ridge = polygon.filter((p) => planes[0](p) > 0.9998);
        if (ridge.length >= 2)
          sections.push([Math.min(...ridge.map((p) => p[0])), Math.max(...ridge.map((p) => p[0]))]);
      }
    }
  }
  for (let i = 0; i < local.length; i++) {
    const a = local[i],
      b = local[(i + 1) % local.length],
      ha = height(a),
      hb = height(b);
    // Close cut gables even when a ridge crests halfway along a footprint edge.
    const points = [0, 1];
    for (let m = 0; m < planes.length; m++)
      for (let n = m + 1; n < planes.length; n++) {
        const start = planes[m](a) - planes[n](a),
          end = planes[m](b) - planes[n](b);
        if (start * end < 0) points.push(start / (start - end));
      }
    points.sort((u, v) => u - v);
    const along = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (let j = 1; j < points.length; j++) {
      if (points[j] - points[j - 1] < 0.001) continue;
      const p = along(points[j - 1]),
        q = along(points[j]);
      const yp = j === 1 ? ha : height(p),
        yq = j === points.length - 1 ? hb : height(q);
      if (Math.max(yp, yq) < 0.012) continue;
      const bottomP = xyz(p, -0.01),
        bottomQ = xyz(q, -0.01);
      batch.face([bottomP, xyz(p, yp), xyz(q, yq)], '#c8ad90');
      batch.face([bottomP, xyz(q, yq), bottomQ], '#c8ad90');
      if (raisedGable && Math.abs(a[0]-b[0]) < Math.abs(a[1]-b[1])*.28) {
        const lo = xyz(p,yp), hi = xyz(q,yq);
        const cap = (v,h) => [v[0],v[1]+.26+.47*(1-h)**2,v[2]];
        batch.face([lo,cap(lo,yp),cap(hi,yq),hi],'#d5c9b1');
      }
    }
  }
  const mid = (front + back) * 0.5;
  for (const [a, b] of sections) {
    if (b - a < 0.5) continue;
    for (const side of [-1, 1]) {
      const onRidge = (u, v) => {
        const p = xyz([u, mid + v], 1);
        p[1] += v === 0 ? 0.24 : -0.03;
        return p;
      };
      batch.top(
        [onRidge(a, 0), onRidge(b, 0), onRidge(b, side * 0.19), onRidge(a, side * 0.19)],
        '#b77958'
      );
    }
  }
}

function veranda(batch, a, b, ground, height, seed) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const bays = Math.max(2, Math.min(5, Math.round((length * 0.67) / 3.6)));
  const landing = ground + Math.min(4.15, height * 0.46);
  const p = (t, y, depth) => [
    a[0] + dx * t + (dz / length) * depth,
    y,
    a[1] + dz * t - (dx / length) * depth,
  ];
  const finish = seed > 0.7 ? '#e2cbaa' : '#cbb496';
  const balcony = [p(0.13, 0, -0.04), p(0.87, 0, -0.04), p(0.87, 0, 1.58), p(0.13, 0, 1.58)].map(
    ([x, , z]) => [x, z]
  );
  prism(batch, balcony, landing - 0.27, landing + 0.12, finish, '#d8bc9b');
  for (let i = 0; i < bays; i++) {
    const u = 0.13 + (0.74 * i) / bays,
      v = 0.13 + (0.74 * (i + 1)) / bays;
    const w = 0.24 / length,
      start = u + w,
      end = v - w,
      spring = landing - 1.35;
    for (const [lo, hi] of i === bays - 1
      ? [
          [u, start],
          [end, v],
        ]
      : [[u, start]]) {
      const footing = [p(lo, 0, 1.25), p(hi, 0, 1.25), p(hi, 0, 1.59), p(lo, 0, 1.59)].map(([x, , z]) => [
        x,
        z,
      ]);
      prism(batch, footing, ground - 0.3, landing - 0.16, finish, null);
    }
    let previous = p(start, spring, 1.58);
    for (let j = 1; j <= 6; j++) {
      const angle = (Math.PI * j) / 6,
        t = start + ((end - start) * (1 - Math.cos(angle))) / 2;
      const cur = p(t, spring + 0.97 * Math.sin(angle), 1.58);
      batch.face(
        [previous, [previous[0], landing - 0.19, previous[2]], [cur[0], landing - 0.19, cur[2]], cur],
        finish
      );
      previous = cur;
    }
  }
  // The balcony remains open above the arcaded ground floor.
  batch.face([p(.13,landing+.76,1.55),p(.13,landing+.95,1.55),
    p(.87,landing+.95,1.55),p(.87,landing+.76,1.55)],finish);
  for(let j=0;j<=bays*3;j++) {
    const t=.13+.74*j/(bays*3), w=.075/length;
    batch.face([p(t-w,landing+.1,1.54),p(t-w,landing+.8,1.54),
      p(t+w,landing+.8,1.54),p(t+w,landing+.1,1.54)],finish);
  }
  return balcony;
}

function shopAwning(batch, polygon, street, y, seed, index) {
  let front, nearest = 9;
  for (let i=0;i<polygon.length;i++) {
    const a=polygon[i], b=polygon[(i+1)%polygon.length];
    const dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz);
    if(len<4.5) continue;
    const x=(a[0]+b[0])/2, z=(a[1]+b[1])/2;
    const vx=street.x-x, vz=street.z-z, dist=Math.hypot(vx,vz);
    // Only the wall looking onto Longtou Road gets a shopfront.
    if(dist<nearest && vx*dz-vz*dx>len*dist*.56) {
      front={a,dx,dz,len}; nearest=dist;
    }
  }
  if(!front) return false;
  const {a,dx,dz,len}=front;
  const p=(t,out)=>[a[0]+dx*t+dz/len*out, a[1]+dz*t-dx/len*out];
  const out=Math.max(.38,Math.min(1.25,nearest-1.3));
  const shade=seed>.55?'#748879':seed>.27?'#a87655':'#8e6255';
  const slots=Math.max(1,Math.round(len/5.3));
  for(let i=0;i<slots;i++) {
    const l=(i+.075)/slots, r=(i+.925)/slots;
    const line=[p(l,.05),p(r,.05),p(r,out),p(l,out)];
    batch.face([up(line[0],y+.30),up(line[0],y+2.62),up(line[1],y+2.62),up(line[1],y+.30)],
      '#987253',litSurface.shopfront,seed,[[0,0],[0,2.32],[len/slots,2.32],[len/slots,0]]);
    const lip=y+2.72;
    batch.top([up(line[0],lip+.43),up(line[1],lip+.43),up(line[2],lip),up(line[3],lip)],shade);
    batch.face([up(line[3],lip-.19),up(line[3],lip),up(line[2],lip),up(line[2],lip-.19)],shade);
    index.add(line,lip+.43);
  }
  return true;
}

const neicuoaoFinishes = {
  terracotta: {wall:'#b6836a', tiles:'#b3755f'},
  ochre: {wall:'#beaa91', tiles:'#ad8267'},
  slate: {wall:'#a69e8d', tiles:'#737971'},
  weathered: {wall:'#afa08c', tiles:'#8c7f6f'},
  concrete: {wall:'#b7afa1', tiles:'#a3a49a'},
};

export function neicuoaoGrade(polygon,heightAt,wallHeight) {
  const boundary=polygon.flatMap((a,i)=>{
    const b=polygon[(i+1)%polygon.length];
    const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2.5);
    return Array.from({length:n},(_,j)=>a.map((v,k)=>v+(b[k]-v)*j/n));
  });
  const ground=boundary.map(p=>heightAt(...p));
  const low=Math.min(...ground), high=Math.max(...ground);
  const datum=(low+high)/2;
  return {boundary,ground,datum,eaves:Math.max(datum+wallHeight,high+2.4),grade:high-low};
}

function surveyedHouse(batch,polygon,cx,cz,seed,index,holes,profile,heightAt) {
  const [degrees,wallHeight,rise,form,finish] = profile;
  const {boundary,ground,datum,eaves}=neicuoaoGrade(polygon,heightAt,wallHeight);
  const angle=degrees*Math.PI/180;
  const {wall,tiles} = neicuoaoFinishes[finish];
  const fascia=form==='flat'?'#b4ad9f':'#c7b192';
  // The low wall follows the slope while the upper masonry and roof stay level.
  // Keep façades and eaves inside the reviewed outlines along the narrow lanes.
  let station=0;
  for (let i=0;i<boundary.length;i++) {
    const j=(i+1)%boundary.length, a=boundary[i], b=boundary[j];
    const aSill=Math.min(datum+.7,ground[i]+1.15);
    const bSill=Math.min(datum+.7,ground[j]+1.15);
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    batch.face([up(a,Math.min(ground[i],aSill)-.65),up(a,aSill),up(b,bSill),
      up(b,Math.min(ground[j],bSill)-.65)],'#938878',13,seed);
    batch.face([up(a,aSill),up(a,eaves-.25),up(b,eaves-.25),up(b,bSill)],
      wall,litSurface.islandHouse,seed,[[station,aSill-datum],[station,eaves-.25-datum],
        [station+len,eaves-.25-datum],[station+len,bSill-datum]]);
    station+=len;
  }
  prism(batch,polygon,eaves-.25,eaves,fascia,rise ? null : tiles,0,seed,0,22,holes);
  if (rise) tiledRoof(batch,polygon,cx,cz,Math.cos(angle),Math.sin(angle),eaves,rise,
    tiles,seed,form==='hip',false);
  index.add(polygon,eaves+rise+(rise?.24:0),holes);
}

export function islandHouse(batch, ring, cx, cz, floor, top, base, h, area, wall, roof, seed, index, holes = [], profile, heightAt) {
  const polygon = signedArea(ring) < 0 ? ring.toReversed() : ring;
  if (profile) {
    surveyedHouse(batch,polygon,cx,cz,seed,index,holes,profile,heightAt);
    return;
  }
  const tiled = !holes.length && h < 28 && area < 1300;
  const village = tiled && h < 15 && cx < -6420 && villageLanes.some(lane => lane.nearest(cx,cz).distance<55);
  let longest = 0,
    a,
    b;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i],
      q = polygon[(i + 1) % polygon.length];
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (length > longest) {
      longest = length;
      a = p;
      b = q;
    }
  }
  if (!a || longest < 0.1) return;
  const ax = (b[0] - a[0]) / longest,
    az = (b[1] - a[1]) / longest;
  const lip = Math.min(0.042, 0.56 / Math.max(4, Math.sqrt(area) * 0.58));
  const cornice = polygon.map(([x, z]) => [x + (x - cx) * lip, z + (z - cz) * lip]);
  const trim = seed > 0.7 ? '#dfc9a8' : '#d2bc9e';
  const across = polygon.map(([x, z]) => (z - cz) * ax - (x - cx) * az);
  const rise = tiled
    ? Math.min(5.9, h*.30, Math.max(1.1, (Math.max(...across) - Math.min(...across)) * (0.18 + 0.095 * seed)))
    : 0;
  const eaves = top-rise, sill=Math.min(base+.36,eaves-.68);
  if(sill>floor) prism(batch,polygon,floor,sill,'#ab9f8e',null,13,seed,0,0,holes);
  prism(batch, polygon, Math.max(sill,floor), eaves-.04, village?'#b6775c':wall, null, litSurface.islandHouse, seed,0,0,holes);
  prism(batch, cornice, eaves-.32, eaves, trim, tiled ? null : roof,0,seed,0,0,holes);
  if (tiled) tiledRoof(batch, cornice, cx, cz, ax, az, eaves, rise, village && seed<.43?'#82796b':roof, seed, !village && seed>.31, village);
  index.add(cornice,top+(village?.73:tiled?.26:0),holes);
  const road=cx>-6240 && cz>3410 && cz<3880 ? market.nearest(cx,cz) : null;
  const shop=road?.distance<26 && eaves-base>3.8 && shopAwning(batch,polygon,market.sample(road.s),base,seed,index);
  if (!shop && !village && longest > 12 && area > 118 && area < 690 && h >= 6 && h < 21 && seed > 0.64) {
    const balcony = veranda(batch, a, b, base, h, seed);
    index.add(balcony, base + Math.min(4.15, h * 0.46) + 0.95);
  }
}

export function islandForeshore(batch, packed, geo, index) {
  // The intertidal shelves below Neicuo'ao follow the mapped outlines. The
  // darker apron falls below sea level before the smaller dry crown starts.
  for (const rock of plan.tidalRocks) {
    const ring=signedArea(rock)>0?rock:rock.toReversed();
    const cx=ring.reduce((s,p)=>s+p[0],0)/ring.length, cz=ring.reduce((s,p)=>s+p[1],0)/ring.length;
    const inner=ring.map(([x,z])=>[cx+.66*(x-cx),cz+.66*(z-cz)]);
    const peak=Math.max(1.9,geo.heightAt(cx,cz)+1.18);
    prism(batch,ring,-1.4,.32,'#777567',null,13);
    for(let i=0;i<ring.length;i++){
      const j=(i+1)%ring.length;
      batch.top([up(ring[i],.32),up(ring[j],.32),up(inner[j],peak),up(inner[i],peak)],'#ab9c85',13,i*.17);
    }
    prism(batch,inner,peak-.10,peak,'#ab9c85','#b7ab93',13,0,0,13);
    index.add(ring,.32); index.add(inner,peak);
  }
  for (let i = 0; i < packed.length; i += 3) {
    const bits = packed[i + 2];
    if (!(bits & 16384)) continue;
    const x = packed[i],
      z = packed[i + 1],
      r = (bits & 255) / 8;
    if(islandSiteReserved(x,z)) continue;
    const seed = Math.abs(Math.sin(x * 5.73 + z * 0.17));
    const axis = seed * 4.78,
      c = Math.cos(axis),
      s = Math.sin(axis),
      sides = 9;
    const base = geo.rawHeightAt(x, z),
      top = base + r * (0.44 + 0.35 * seed);
    const centerY = base - 0.18 * r,
      rx = r * (1.05 + 0.4 * seed),
      rz = r * (0.65 + 0.17 * seed);
    const outline = [];
    const rings = [];
    for (const [h, radius] of [
      [-0.74, 0.6],
      [-0.22, 0.93],
      [0.16, 1],
      [0.68, 0.77],
      [0.93, 0.4],
    ]) {
      const ring = [];
      for (let j = 0; j < sides; j++) {
        const a = (2 * Math.PI * j) / sides;
        const warp = 1 + 0.115 * Math.cos(3 * a + 4 * seed) + 0.065 * Math.sin(5 * a - 3 * seed);
        const u = rx * radius * warp * Math.cos(a),
          v = rz * radius * warp * Math.sin(a);
        const px = x + c * u - s * v,
          pz = z + s * u + c * v,
          y = centerY + (top - centerY) * (h + 0.065 * Math.sin(2 * a + seed));
        ring.push([px, y, pz]);
        if (radius === 1) outline.push([px, pz]);
      }
      rings.push(ring);
    }
    const tone = seed > 0.58 ? '#ac9580' : '#a69c8a';
    for (let k = 1; k < rings.length; k++)
      for (let j = 0; j < sides; j++) {
        const n = (j + 1) % sides;
        batch.face(
          [rings[k - 1][j], rings[k][j], rings[k][n], rings[k - 1][n]],
          k < 3 ? '#726d60' : tone,
          13,
          seed
        );
      }
    batch.top(rings.at(-1), tone, 13, seed);
    index.add(outline, top + 0.15);
  }
}
