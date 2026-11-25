import { groundY, litSurface, mix, TAU } from './scenery-mesh.js';

// Preserve the surveyed outcrop in plan. Two uneven exfoliation ledges break
// the exposed faces of the upright block and the long, flatter eastern slab.
const section = [
  [0, 1], [.20, .998], [.39, .988], [.54, .962], [.64, .929], [.687, .909],
  [.704, .899], [.716, .849], [.740, .841], [.800, .789], [.857, .712],
  [.875, .696], [.888, .651], [.912, .630], [.947, .543], [.977, .408],
  [.991, .249], [.997, .129], [1, 0],
];

// A rock-cut stair has a shallow channel with an exposed bank at either side.
// The same cut is used to generate the mesh, evaluate its footings and index it.
export function cutSummitPaths(trails) {
  const cuts = trails.flatMap(({ path, levels, width, middle }) => path.slice(1).map((b, i) => {
    const [x, z] = path[i], dx = b[0] - x, dz = b[1] - z;
    return { x, z, dx, dz, lengthSq: dx*dx + dz*dz, half: width/2,
      y: levels[i], rise: levels[i+1]-levels[i], flank:middle && i===0 };
  }));
  return (x, z, elevation) => {
    let y = elevation;
    for (const c of cuts) {
      const t = Math.max(0, Math.min(1, ((x-c.x)*c.dx + (z-c.z)*c.dz) / c.lengthSq));
      const edge = Math.hypot(x-c.x-t*c.dx, z-c.z-t*c.dz) - c.half;
      if (edge > (c.flank?5.6:3.5)) continue;
      const bank=c.flank ? .55*Math.max(0,edge-.35)+.82*Math.max(0,edge-2.4)**1.65 :
        Math.max(0,edge-.10)**1.55*1.8;
      y = Math.min(y, c.y+t*c.rise-.32+bank);
    }
    return y;
  };
}

export function sculptSummitStone(batch, geo, obstacles, ring, centre, peak, color, seed, tilt, cut, detail=72) {
  const [cx, cz] = centre, outline = ring.map(([x,z]) => [x-cx,z-cz]);
  const base = Math.min(...ring.map(p => groundY(geo,...p)),groundY(geo,cx,cz))-1.8;
  const rise = peak-base;
  function radius(dx, dz) {
    let nearest = Infinity;
    for (let i=0;i<outline.length;i++) {
      const [x,z] = outline[i], b = outline[(i+1)%outline.length];
      const ex=b[0]-x, ez=b[1]-z, cross=dx*ez-dz*ex;
      if (Math.abs(cross)<1e-8) continue;
      const along=(x*dz-z*dx)/cross, distance=(x*ez-z*ex)/cross;
      if (along>=-1e-7 && along<=1+1e-7 && distance>0) nearest=Math.min(nearest,distance);
    }
    return nearest;
  }
  function height(r, a, x, z) {
    const skew=.070*Math.cos(a-seed)+.035*Math.sin(3*a+.65*seed);
    const s=Math.min(1,Math.max(0,r+skew*Math.sin(Math.PI*r)));
    let i=1;
    while (i<section.length-1 && s>section[i][0]) i++;
    const [r0,h0]=section[i-1], [r1,h1]=section[i];
    const fraction=mix(h0,h1,(s-r0)/(r1-r0));
    // Broad fracture planes and one shoulder with a narrow vertical split.
    // The displacement vanishes at the buried outline.
    const dx=x-cx, dz=z-cz, shoulder=Math.sin(Math.PI*r);
    const plane=Math.min(.1, .60-.20*dx-.10*dz, 1.1+.17*dx-.19*dz);
    const joint=dx*.79+dz*.61+1.8*Math.sin(.15*dz+.7*seed)-2.5;
    const crack=.76*Math.exp(-joint*joint/.12)*shoulder;
    const ledge=shoulder*(.43*Math.sin(.31*dx+.12*dz+seed)+.31*Math.sin(.45*dz-seed));
    // On the two exposed summit blocks, a slanting split and a shallower
    // parallel lip separate the outer granite sheet from its lower shoulder.
    // Both fade at the crown and at the mapped footprint.
    const southFace=Math.max(0,Math.sin(a+.38));
    const along=dx+.34*dz, extent=Math.max(0,1-(along/15)**4);
    const lipAt=.790+.055*Math.sin(a+.86*seed);
    const notch=Math.max(0,1-Math.abs(r-lipAt)/.049);
    const flake=detail>72 ? southFace*extent*notch*1.68 : 0;
    const top=base+rise*fraction+(tilt[0]*dx+tilt[1]*dz)*fraction+plane*shoulder+ledge-crack-flake;
    return cut(x,z,top);
  }
  const heightAt=(x,z)=>{
    const dx=x-cx, dz=z-cz, distance=Math.hypot(dx,dz);
    if (distance<1e-6) return cut(x,z,peak);
    const outer=radius(dx/distance,dz/distance);
    return distance<=outer ? height(distance/outer,Math.atan2(dz,dx),x,z) : -Infinity;
  };

  // Include every measured corner as well as regularly spaced sample rays.
  const angles=Array.from({length:detail},(_,i)=>i*TAU/detail);
  for (const [x,z] of outline) angles.push((Math.atan2(z,x)+TAU)%TAU);
  angles.sort((a,b)=>a-b);
  const rays=angles.filter((a,i)=>i===0 || a-angles[i-1]>.003).map(a=>{
    const x=Math.cos(a),z=Math.sin(a), extent=radius(x,z);
    return {a, dx:x*extent, dz:z*extent};
  });
  const levels=detail<=32 ? [.032,.16,.30,.53,.664,.704,.725,.81,.878,.913,.95,.982,.997,1] :
    [.032,.095,.16,.22,.30,.38,.46,.53,.58,.63,.664,.684,.701,
    .714,.727,.749,.78,.81,.84,.862,.878,.894,.913,.934,.951,.970,.982,.991,.997,1];
  const mesh=levels.map(r=>rays.map(({a,dx,dz})=>{
    const x=cx+r*dx,z=cz+r*dz;
    return [x,height(r,a,x,z),z];
  }));
  const n=rays.length;
  const normals=mesh.map((row,j)=>row.map((p,i)=>{
    const a=row[(i+n-1)%n], b=row[(i+1)%n];
    const l=mesh[Math.max(0,j-1)][i], h=mesh[Math.min(mesh.length-1,j+1)][i];
    const ax=b[0]-a[0], ay=b[1]-a[1], az=b[2]-a[2];
    const bx=h[0]-l[0], by=h[1]-l[1], bz=h[2]-l[2];
    const v=[ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx], length=Math.hypot(...v)||1;
    return v.map(q=>q/length);
  }));
  const centre3=[cx,cut(cx,cz,peak),cz], indices=[];
  for(let i=0;i<n;i++) {
    const next=(i+1)%n;
    indices.push(0,1+next,1+i);
    for(let j=1;j<mesh.length;j++) {
      const prev=1+(j-1)*n, row=prev+n;
      indices.push(prev+i,prev+next,row+next,prev+i,row+next,row+i);
    }
  }
  const vertices=[centre3,...mesh.flat()];
  const weathering=vertices.map(([x,y,z])=>[y-groundY(geo,x,z),0]);
  batch.indexedSurface(vertices,[[0,1,0],...normals.flat()],indices,color,litSurface.sunlightStone,seed,weathering);
  // Each sector has its own height, including both flanks of the cleft.
  const bands=[.30,.664,.81,.913,.982,1].map(r=>levels.indexOf(r));
  for(let i=0;i<n;i+=4) {
    const next=i+4<n ? i+4 : 0;
    let previous;
    for(const j of bands) {
      const a=mesh[j][i], b=mesh[j][next];
      const face=previous ? [previous[0],previous[1],b,a] : [centre3,b,a];
      obstacles.add(face.map(([x,,z])=>[x,z]),Math.max(...face.map(p=>p[1]))+.10);
      previous=[a,b];
    }
  }
  return heightAt;
}
