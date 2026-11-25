import * as THREE from 'three';
import { elevationField } from './geography.js';

// The widebody passes the western edge of the detailed map on its base leg.
// A coarser satellite mesh fills the surrounding landscape up to the horizon.
export async function loadArrivalTerrain(geo) {
  const [map, buffer] = await Promise.all([
    new THREE.TextureLoader().loadAsync('/geo/arrival-coast.webp'),
    fetch('/geo/arrival-relief.bin').then((r) => {
      if (!r.ok) throw new Error('进场区域地形加载失败');
      return r.arrayBuffer();
    }),
  ]);
  const [xmin, xmax, zmin, zmax, cols, rows] = new Int32Array(buffer, 0, 6);
  const heights = new Int16Array(buffer, 24);
  if (heights.length !== cols * rows) throw new Error('进场地形尺寸不匹配');
  const positions = [], uvs = [], indices = [], b = geo.bounds;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const u = col / (cols - 1), v = row / (rows - 1);
      const x = xmin + (xmax - xmin) * u, z = zmin + (zmax - zmin) * v;
      const i = row * cols + col;
      const inBase = x >= b.xmin && x <= b.xmax && z >= b.zmin && z <= b.zmax;
      positions.push(x, Math.max(.88, inBase ? geo.rawHeightAt(x, z) : heights[i]), z);
      uvs.push(u, 1 - v);
      if (row === rows - 1 || col === cols - 1) continue;
      if (x >= b.xmin && x < b.xmax && z >= b.zmin && z < b.zmax) continue;
      indices.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices); g.computeVertexNormals();
  map.colorSpace = THREE.SRGBColorSpace;
  const terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({map, alphaTest: .5, roughness: 1}));
  terrain.name = '厦漳海湾与远山';
  const bounds = { xmin, xmax, zmin, zmax, width: cols, height: rows };
  const outerHeight = elevationField(bounds, heights);
  terrain.userData.geography = {
    bounds,
    heightAt: (x, z) => x >= b.xmin && x <= b.xmax && z >= b.zmin && z <= b.zmax
      ? geo.heightAt(x, z) : Math.max(0, outerHeight(x, z)),
  };
  return terrain;
}
