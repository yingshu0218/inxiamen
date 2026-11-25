import * as THREE from 'three';
import { up } from './landmark-forms.js';

export function addVenueSigns(parent, signs) {
  const lettering = signs.filter(({ ink }) => ink);
  const labels = new Map();
  for (const { label, ink } of lettering) labels.set(label, ink);

  const rowHeight = 128;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = rowHeight * labels.size;
  const rows = new Map();
  const context = canvas.getContext('2d');
  context.font = 'bold 101px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const [label, ink] of labels) {
    const row = rows.size;
    rows.set(label, row);
    context.fillStyle = ink;
    context.fillText(label, canvas.width / 2, rowHeight * (row + .52), canvas.width - 30);
  }

  const positions = [], uvs = [], indices = [];
  for (const { label, a, b, y, height } of lettering) {
    const row = rows.get(label), first = positions.length / 3;
    const low = 1 - (row + 1) / labels.size;
    const high = 1 - row / labels.size;
    const textWidth = Math.min(context.measureText(label).width, canvas.width - 30) / canvas.width;
    const left = .5 - textWidth * .5 - .012, right = 1 - left;
    positions.push(...up(a, y), ...up(b, y), ...up(b, y + height), ...up(a, y + height));
    uvs.push(left, low, right, low, right, high, left, high);
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({
    map: texture, alphaTest: .32, side: THREE.DoubleSide, roughness: .65,
    emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: .08,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = '岛内地标标识';
  parent.add(mesh);
  return { texture, update(night) { material.emissiveIntensity = .08 + .28 * night; } };
}
