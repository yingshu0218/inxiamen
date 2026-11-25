// Join consecutive sections at a common normal. Coordinates and distances are metres.
export function sections(points, spacing = 8) {
  const samples = [];
  for (let i = 1; i < points.length; i++) {
    const [x,z] = points[i-1], dx = points[i][0]-x, dz = points[i][1]-z;
    const count = Math.ceil(Math.hypot(dx,dz)/spacing);
    for (let j=0; j<count; j++) samples.push([x+dx*j/count,z+dz*j/count]);
  }
  samples.push(points.at(-1));
  let distance = 0;
  return samples.map(([x,z],i) => {
    const a = samples[Math.max(0,i-1)], b = samples[Math.min(samples.length-1,i+1)];
    const dx = b[0]-a[0], dz=b[1]-a[1], length=Math.hypot(dx,dz)||1;
    distance += Math.hypot(x-a[0],z-a[1]);
    return {x,z,nx:-dz/length,nz:dx/length,distance};
  });
}

export function pointAt(frame, offset, height, lift=0) {
  const x=frame.x+frame.nx*offset, z=frame.z+frame.nz*offset;
  return [x,height(x,z,frame)+lift,z];
}

export function ribbon(batch, frames, left, right, height, color, lift=0) {
  let previous;
  for (const frame of frames) {
    const pair=[pointAt(frame,left,height,lift),pointAt(frame,right,height,lift)];
    if (previous) batch.top([...previous,pair[1],pair[0]],color);
    previous=pair;
  }
}

// Near the two Wuyuan abutments the coast DEM is clipped before rendering.
// Sample that displayed surface across wide aprons as well as along the roads.
export function wuyuanPaving(batch, frames, left, right, surface, color, lift, wall) {
  for (let i=1; i<frames.length; i++) {
    const a=frames[i-1], b=frames[i];
    const near=Math.min(a.x,b.x)<=5530 && Math.max(a.z,b.z)>=-7100 && Math.min(a.z,b.z)<=-6320;
    const rows=near?Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/2)):1;
    const cols=near?Math.ceil((right-left)/2):1;
    let previous;
    for (let row=0; row<=rows; row++) {
      const t=row/rows;
      const f={x:a.x+t*(b.x-a.x), z:a.z+t*(b.z-a.z),
        nx:a.nx+t*(b.nx-a.nx), nz:a.nz+t*(b.nz-a.nz)};
      const edge=Array.from({length:cols+1},(_,c)=>pointAt(f,left+(right-left)*c/cols,surface,lift));
      if(previous){
        for(let c=0;c<cols;c++)batch.top([previous[c],previous[c+1],edge[c+1],edge[c]],color);
        if(wall)for(const index of wall.bothEdges?[0,cols]:[cols]){
          const p=previous[index],q=edge[index];
          wall.batch.face([p,q,[q[0],wall.bottom,q[2]],[p[0],wall.bottom,p[2]]],wall.color);
        }
      }
      previous=edge;
    }
  }
}
