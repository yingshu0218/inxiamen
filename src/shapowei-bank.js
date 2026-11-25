import { measuredPath, ribbon } from './old-town-layout.js';
import { pathTube } from './landmark-haicang.js';
import { cylinder, litSurface } from './scenery-mesh.js';

// North-east inner bank only. OSM coastline way 334467977, nodes
// 1408154417 through 1777545338, in local east/south metres.
const bank = measuredPath([
  [-4382.6, 4126.3], [-4372.4, 4128.6], [-4354.5, 4140.4], [-4198.5, 4327.4],
  [-4195.9, 4331.1], [-4195.4, 4336.0], [-4196.5, 4339.6],
]);
const deckHeight = 2.8;

// The 25 m surface grid includes roof returns along the quay. Ease those
// samples down around the surveyed edge, leaving the opposite bank alone.
export function gradeShapoweiBank(grid, data) {
  const dx = (grid.xmax - grid.xmin) / (grid.width - 1);
  const dz = (grid.zmax - grid.zmin) / (grid.height - 1);
  const firstRow = Math.max(0, Math.ceil((4090 - grid.zmin) / dz));
  const lastRow = Math.min(grid.height - 1, Math.floor((4375 - grid.zmin) / dz));
  const firstCol = Math.max(0, Math.ceil((-4420 - grid.xmin) / dx));
  const lastCol = Math.min(grid.width - 1, Math.floor((-4160 - grid.xmin) / dx));
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const near = bank.nearest(grid.xmin + col * dx, grid.zmin + row * dz);
      if (near.distance >= 32) continue;
      const i = row * grid.width + col;
      const weight = Math.min(1, (32 - near.distance) / 12);
      const height = data[i] * grid.metresPerUnit;
      const bankHeight = near.side > 0 ? Math.max(-3, 2 - near.side * .42) : 2.2;
      data[i] = Math.round((height + (bankHeight - height) * weight) / grid.metresPerUnit);
    }
  }
}

export function buildShapoweiBank(batch, geo, lamps, obstacles) {
  const rows = bank.sections(4);
  const level = (x, z) => Math.max(deckHeight, geo.heightAt(x, z) + .16);
  // Join the landward edge to the existing surface even where the shoreline
  // texture and the coarser elevation grid place the bank a few metres apart.
  ribbon(batch, rows, -4.8, -1.3,
    (x, z, s, lateral) => lateral < -2 ? geo.heightAt(x, z) + .08 : level(x, z), '#a79a88');
  ribbon(batch, rows, -1.3, 1.5, level, '#a68869');
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    const edge = p => [p.x + 1.5 * p.rx, p.z + 1.5 * p.rz];
    const [x, z] = edge(a), [u, v] = edge(b);
    batch.face([[x, -1, z], [u, -1, v], [u, level(u, v), v], [x, level(x, z), z]],
      '#968a78', litSurface.seaWall);
    const landA = [a.x - 1.3 * a.rx, a.z - 1.3 * a.rz];
    const landB = [b.x - 1.3 * b.rx, b.z - 1.3 * b.rz];
    const y = level(x, z), nextY = level(u, v);
    cylinder(batch, x, z, y, y + .94, .075, .075, '#6b594c', 6);
    pathTube(batch, [[x, y + .85, z], [(x + u) / 2, (y + nextY) / 2 + .72, (z + v) / 2],
      [u, nextY + .85, v]], .034, '#aaa18e', 4);
    obstacles.add([landA, landB, [u, v], [x, z]], Math.max(level(...landA), level(...landB), y, nextY) + .94);
    if (i === rows.length - 1) cylinder(batch, u, v, nextY, nextY + .94, .075, .075, '#6b594c', 6);
  }
}
