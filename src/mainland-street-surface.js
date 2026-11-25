// Native road records are clipped to Xiamen island and its immediate coast by
// prepare-urban-hydrography.py. Flag 4 identifies the older off-island tiles.
export const mainlandStreet = flags => !(flags & 4);

// Only a surveyed bridge can invoke this floor. Land approaches and short
// bank-side joins keep the shared endpoint elevations used by the existing model.
export function bridgeWaterFloor(geo, x, z) {
  const lake = geo.waterAt(x, z);
  if (lake) {
    const neighbors = [[x - 4, z], [x + 4, z], [x, z - 4], [x, z + 4]];
    return neighbors.every(([px, pz]) => geo.waterAt(px, pz) === lake) ? lake.h + 1.2 : -Infinity;
  }
  const coast = geo.coastDistance(x, z);
  return coast < 0 ? Math.min(1.2, -coast * .15) : -Infinity;
}

export function mainlandRoadWater(geo, x, z) {
  return Boolean(geo.waterAt(x, z)) || geo.coastDistance(x, z) < 0;
}

const mix = (a, b, t) => a + (b - a) * t;

export function layMainlandStrip(batch, geo, corners, color, style, kind, uv, occupied) {
  // The input quad is a strip with the two lateral corners at each station.
  // Heights and visibility are subdivided only where the base quad needs it.
  const rowPoint = (u, v) => {
    const component = i => mix(mix(corners[0][i], corners[1][i], u), mix(corners[3][i], corners[2][i], u), v);
    const x = component(0), z = component(2);
    return [x, geo.roadTerrainAt(x, z) + .39, z];
  };
  function emit(u0, v0, u1, v1, depth) {
    const a = rowPoint(u0, v0), b = rowPoint(u1, v0), c = rowPoint(u1, v1), d = rowPoint(u0, v1);
    const u = (u0 + u1) / 2, v = (v0 + v1) / 2;
    const center = rowPoint(u, v);
    const midpoints = [rowPoint(u, v0), rowPoint(u1, v), rowPoint(u, v1), rowPoint(u0, v)];
    const quad = [a, b, c, d];
    const probe = [[mix(u0, u1, .25), mix(v0, v1, .25)], [mix(u0, u1, .75), mix(v0, v1, .25)],
      [mix(u0, u1, .75), mix(v0, v1, .75)], [mix(u0, u1, .25), mix(v0, v1, .75)]];
    const wet = [...quad, center, ...midpoints, ...probe.map(([s, t]) => rowPoint(s, t))].map(([x, , z]) => mainlandRoadWater(geo, x, z));
    if (wet.every(Boolean)) return;
    // Three.js may reverse the quad's winding. Test both possible diagonals.
    const bends = Math.abs(center[1] - (a[1] + c[1]) / 2) > .23 ||
      Math.abs(center[1] - (b[1] + d[1]) / 2) > .23 ||
      midpoints.some((p, i) => Math.abs(p[1] - (quad[i][1] + quad[(i + 1) % 4][1]) / 2) > .23);
    if (depth > 0 && (wet.some(Boolean) || bends)) {
      emit(u0, v0, u, v, depth - 1);
      emit(u, v0, u1, v, depth - 1);
      emit(u, v, u1, v1, depth - 1);
      emit(u0, v, u, v1, depth - 1);
    } else if (!wet.some(Boolean)) {
      const tex = uv && [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
        .map(([s, t]) => [mix(uv[0][0], uv[1][0], s), mix(uv[0][1], uv[3][1], t)]);
      batch.top(quad, color, style, kind, tex);
      occupied?.(quad);
    }
  }
  emit(0, 0, 1, 1, 3);
}

export function roadVegetationMask(geo) {
  const step = 32, cells = new Map();
  const key = (x, z) => x + ',' + z;
  function add(quad) {
    const xs = quad.map(p => p[0]), zs = quad.map(p => p[2]);
    for (let x = Math.floor(Math.min(...xs) / step); x <= Math.floor(Math.max(...xs) / step); x++) {
      for (let z = Math.floor(Math.min(...zs) / step); z <= Math.floor(Math.max(...zs) / step); z++) {
        const id = key(x, z);
        if (!cells.has(id)) cells.set(id, []);
        cells.get(id).push(quad);
      }
    }
  }
  function includes(quad, x, z, margin) {
    // Convex road quads. Apply the margin along each edge to keep crowns clear.
    let positive = true, negative = true;
    for (let i = 0; i < 4; i++) {
      const a = quad[i], b = quad[(i + 1) % 4], dx = b[0] - a[0], dz = b[2] - a[2];
      const cross = dx * (z - a[2]) - dz * (x - a[0]);
      const limit = margin * Math.hypot(dx, dz);
      positive &&= cross >= -limit;
      negative &&= cross <= limit;
    }
    return positive || negative;
  }
  function blocks(x, z, margin) {
    if (!geo.onMainland(x, z)) return false;
    if (mainlandRoadWater(geo, x, z)) return true;
    for (let i = Math.floor((x - margin) / step); i <= Math.floor((x + margin) / step); i++) {
      for (let j = Math.floor((z - margin) / step); j <= Math.floor((z + margin) / step); j++) {
        if (cells.get(key(i, j))?.some(quad => includes(quad, x, z, margin))) return true;
      }
    }
    return false;
  }
  return { add, blocks };
}
