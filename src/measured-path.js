const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

// Use engineering station (metres along the alignment) for paving, plots and furniture.
export function measuredPath(points) {
  let length = 0;
  const spans = [];
  for (let i = 1; i < points.length; i++) {
    const [x, z] = points[i - 1];
    const dx = points[i][0] - x, dz = points[i][1] - z, len = Math.hypot(dx, dz);
    if (len < .01) continue;
    spans.push({ x, z, ux: dx / len, uz: dz / len, s: length, len });
    length += len;
  }
  function sample(s) {
    const d = clamp(s, 0, length);
    const line = spans.find(k => d <= k.s + k.len) || spans.at(-1);
    return { x: line.x + line.ux * (d-line.s), z: line.z + line.uz * (d-line.s), ux: line.ux, uz: line.uz };
  }
  function nearest(x, z) {
    let best = Infinity, station = 0, side = 0, ux = 0, uz = 0;
    for (const k of spans) {
      const dx = x-k.x, dz = z-k.z;
      const local = clamp(dx*k.ux+dz*k.uz, 0, k.len);
      const sq = (dx-local*k.ux)**2 + (dz-local*k.uz)**2;
      if (sq >= best) continue;
      best = sq; station = k.s+local; side = dz*k.ux-dx*k.uz; ux = k.ux; uz = k.uz;
    }
    return { s: station, distance: Math.sqrt(best), side, ux, uz };
  }
  // Miter joins keep a ribbon closed at a bend, including at its sampled vertices.
  function sections(maxStep) {
    const rows = [];
    for (const [i, k] of spans.entries()) {
      const prev = spans[Math.max(0, i-1)], dot = 1 + prev.ux*k.ux + prev.uz*k.uz;
      const pieces = Math.ceil(k.len/maxStep);
      for (let j=0; j<pieces; j++) {
        const d = k.len*j/pieces;
        rows.push({x:k.x+d*k.ux, z:k.z+d*k.uz, rx:j ? -k.uz : -(prev.uz+k.uz)/Math.max(.5,dot),
          rz:j ? k.ux : (prev.ux+k.ux)/Math.max(.5,dot), s:k.s+d});
      }
    }
    const last = sample(length);
    rows.push({...last, rx:-last.uz, rz:last.ux, s:length});
    return rows;
  }
  return { length, sample, nearest, sections };
}

export function ribbon(batch, rows, left, right, height, color, style = 0, seed = 0) {
  const pair = (p) => [left,right].map(lateral => {
    const x=p.x+lateral*p.rx, z=p.z+lateral*p.rz;
    return [x,height(x,z,p.s,lateral),z];
  });
  let prev=pair(rows[0]);
  for(let i=1;i<rows.length;i++) {
    const next=pair(rows[i]), a=rows[i-1].s, b=rows[i].s;
    batch.top([prev[0],prev[1],next[1],next[0]],color,style,seed,[[left,a],[right,a],[right,b],[left,b]]);
    prev=next;
  }
}
