import { cylinder } from './scenery-mesh.js';
import { measuredPath, ribbon } from './measured-path.js';

// Two documented alignments visible in Vantor LG04 imagery from 2025-03-20.
export const yundangPaths = [
  { kind: 'bridge', width: 2.5, points: [[-5204, 367.9], [-5134.7, 363.5]] }, // OSM 1250798686
  { kind: 'bank', width: 2.8, points: [[-5134.7, 363.5], [-5130.2, 385.2], [-5121.3, 400.3],
    [-5106.2, 410], [-5093.4, 414], [-5077.8, 414.5], [-5063.2, 414.9], [-5067.2, 341.3]] }, // OSM 1250798686
  { kind: 'bank', width: 2.8, points: [[-3318.9, -259.1], [-3235, -326.6], [-3220.9, -338.8],
    [-3215.5, -343.4]] }, // OSM 435320720
].map(path => ({ ...path, line: measuredPath(path.points) }));

export function replacesYundangPath(x, z, dx, dz) {
  if (x < -5210 || x > -3209 || z < -352 || z > 420) return false;
  return yundangPaths.some(({ line }) => {
    const near = line.nearest(x, z);
    return near.distance < 3 && Math.abs(near.ux * dx + near.uz * dz) > .94;
  });
}

export function buildYundangPaths(batch, geo) {
  for (const { kind, width, line } of yundangPaths) {
    const rows = line.sections(3);
    const bridge = kind === 'bridge';
    const height = (x, z) => Math.max(1.3, geo.heightAt(x, z) + .24);
    ribbon(batch, rows, -width / 2, width / 2, height, '#b6ad9a', 17);
    if (bridge) {
      for (const side of [-1, 1]) {
        const edge = side * width / 2;
        ribbon(batch, rows, edge - .07, edge + .07, (x, z) => height(x, z) + .71, '#9b9b85');
        for (const row of rows) {
          const x = row.x + row.rx * edge, z = row.z + row.rz * edge, y = height(x, z);
          cylinder(batch, x, z, y, y + .71, .048, .048, '#9b9b85', 5);
        }
      }
    } else {
      for (const side of [-1, 1]) {
        const edge = side * width / 2;
        ribbon(batch, rows, edge, side * 4.8, (x, z, _s, lateral) =>
          Math.abs(lateral) < 2 ? height(x, z) : Math.max(-.3, geo.heightAt(x, z)), '#82916d');
      }
    }
  }
}
