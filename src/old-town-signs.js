import * as THREE from 'three';
import { up } from './landmark-forms.js';

// Each cell has its own painted background and inset lettering. Share a draw
// across shop fascias, hotel lettering and the two ferry assembly halls.
export const signRows = ['厦门轮渡', '1号候船厅', '2号候船厅', '鹭江宾馆', '中山路', '花生汤', '茶莊', '餅舖', '海味行', '鹭江道', '厦门广播电视中心', '湖滨北路', '体育中心', '广电中心', '中国电信', '滨北手机城'];
export function addOldTownSigns(parent, signs, atlas) {
  const positions = [], uvs = [], indices = [];
  for (const {label, a, b, y, height} of signs) {
    const row = signRows.indexOf(label);
    if (row < 0) continue;
    const first = positions.length / 3;
    positions.push(...up(a,y), ...up(b,y), ...up(b,y+height), ...up(a,y+height));
    const low = 1-(row+1)/signRows.length + .001, high = 1-row/signRows.length - .001;
    uvs.push(.003,low, .997,low, .997,high, .003,high);
    indices.push(first,first+1,first+2, first,first+2,first+3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({map:atlas, emissiveMap:atlas, emissive:0xffffff, emissiveIntensity:0, roughness:.73, side:THREE.DoubleSide});
  const mesh = new THREE.Mesh(geometry,material);
  mesh.name = '老城、轮渡与湖滨街区招牌'; parent.add(mesh);
  return night => { material.emissiveIntensity = .05 + .95*night; };
}

const districtSigns = ['禹悦汇','罗宾森广场','梧村汽车站','梧村小学','BRT 火车站','东南亚大酒店','三丘田码头','钢琴码头','内厝澳码头'];

export function addDistrictSigns(parent, signs) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128 * districtSigns.length;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 84px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  for (const [i,label] of districtSigns.entries()) {
    const row=128*i;
    ctx.fillStyle = ['#78475a','#4f615b','#3f5761','#644940','#314d62','#696455','#405e5c','#50635e','#74614e'][i];
    ctx.fillRect(2,row+3,1020,122);
    ctx.fillStyle = i===0 ? '#ffe1d1' : i>=6 ? '#efcf8e' : '#eee7d5';
    ctx.fillText(label,512,row+67);
  }
  const vertices=[],texcoords=[],indices=[];
  for (const {label,a,b,y,height} of signs) {
    const row=districtSigns.indexOf(label);
    if(row<0) continue;
    const first=vertices.length/3, lo=1-(row+1)/districtSigns.length+.001, hi=1-row/districtSigns.length-.001;
    vertices.push(...up(a,y),...up(b,y),...up(b,y+height),...up(a,y+height));
    texcoords.push(.003,lo,.997,lo,.997,hi,.003,hi);
    indices.push(first,first+1,first+2,first,first+2,first+3);
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(texcoords,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.06,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='梧村建筑与鼓浪屿码头标识';
  parent.add(mesh);
  return {texture,update(night){material.emissiveIntensity=.08+.92*night;}};
}
