import { localFrame } from './landmark-forms.js';
import { inRing } from './scenery-mesh.js';

// OSM 653053985 fixes the shaft's ground footprint. The attached low wing
// is traced from imagery, correcting for the off-nadir view of the roofs.
export const guomaoCentre = [-1149.08, 199.43];
export const guomaoPoint = localFrame(guomaoCentre, -.25885);
export const guomaoShaft = [[-1178.22, 178.95], [-1164.22, 231.63], [-1119.95, 219.91], [-1133.94, 167.22]];
export const guomaoPodium = [
  [-30, -31], [53, -32], [59, -30], [62, -24], [62, 14], [59, 22],
  [51, 27], [35, 28], [22, 30], [-24, 33], [-30, 30], [-33, 24], [-33, -24],
].map(([u, v]) => guomaoPoint(u, v));

export function lianbanReserved(x, z) {
  return x > -1191 && x < -1079 && z > 152 && z < 246 &&
    (inRing(x, z, guomaoPodium) || inRing(x, z, guomaoShaft));
}

const [x, z] = guomaoCentre;
export const lianbanViews = [
  {
    id: 'lianban-guomao', name: '莲坂国贸大厦', kind: '沿厦禾路斜看莲坂天际线',
    x, z, lookAt: { x: -1144, z: 260 }, focusHeight: 89, fov: 37, portraitFovBoost: 21,
    view: { x: -1490, z: 778, y: 251 },
    portraitView: { x: -1430, z: 716, y: 250 },
    portraitFocus: { x: -1145, z: 224, y: 83 },
  },
  {
    id: 'lianban-guomao-top', name: '国贸大厦屋顶', kind: '俯看红色桁架、裙楼和莲坂路口',
    x, z, lookAt: { x: -1117, z: 191 }, focusHeight: 78, fov: 40, portraitFovBoost: 23,
    view: { x: -1016, z: 48, y: 409 },
    portraitView: { x: -985, z: 18, y: 417 },
  },
];
