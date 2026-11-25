import { inRect, localFrame } from './landmark-forms.js';
import { geoPoint } from './scenery-mesh.js';

// Local u runs to the reader's right and v points out from the carved face.
// Heights are metres above the terrain at the centre of each monument.
export const northInscriptions = [
  {
    id: 'xiangan', name: '翔安大桥桥铭牌', label: '题字近景', anchor: [118.19653, 24.57166], angle: -1.63,
    plate: { width: 8.43, height: 2.45, bottom: 12.68, front: .68, radius: .14 },
    camera: [-2.05, 15.23, 16.4], portrait: [-.9, 17.1, 19.4], focusHeight: 12.72, fov: 38, portraitFovBoost: 27,
    reserved: [7, 13],
  },
  {
    id: 'jimei', name: '集美大桥 · 通车原碑复原', label: '通车原碑复原', anchor: [118.11017, 24.584434], angle: -.81,
    plate: { width: 8.92, height: 2.96, bottom: 3.96, front: .52, radius: .18 },
    camera: [1.55, 7.1, 15.4], portrait: [.6, 8.8, 19.5], fov: 38, portraitFovBoost: 28,
    reserved: [7, 10],
  },
  {
    id: 'xiamen-bridge', name: '厦门大桥桥名碑', label: '题字近景', anchor: [118.104985, 24.553125], angle: .74,
    plate: { width: 13.5, height: 3.19, bottom: 1.32, front: .82, radius: .012 },
    camera: [3.6, 4.45, 15.8], portrait: [.85, 6.7, 19.5], fov: 42, portraitFovBoost: 38,
    reserved: [10, 12],
  },
  {
    id: 'gaoji', name: '高集海堤 · 移山填海', label: '移山填海碑', anchor: [118.1026809, 24.552142], angle: 2.33,
    plate: { width: .77, height: 2.40, bottom: 2.83, front: .485, radius: .008 },
    camera: [-2.5, 4.9, 9.1], portrait: [-1.3, 4.57, 8.4], focusHeight: 3.63, fov: 44, portraitFovBoost: 1,
    reserved: [7.6, 11],
  },
].map(site => {
  const center = geoPoint(...site.anchor);
  return { ...site, center, frame: localFrame(center, site.angle) };
});

export const northInscriptionViews = northInscriptions.map(site => {
  const [x, z] = site.center;
  const viewpoint = ([u, y, v]) => {
    const [x, z] = site.frame(u, v);
    return { x, y, z };
  };
  return {
    id: `${site.id}-plaque`, parent: site.id, name: site.name, label: site.label, x, z,
    groundRelative: true,
    lookAt: viewpoint([0, 0, site.plate.front]),
    focusHeight: site.focusHeight ?? site.plate.bottom + site.plate.height * .48,
    view: viewpoint(site.camera), portraitView: viewpoint(site.portrait),
    fov: site.fov, portraitFovBoost: site.portraitFovBoost,
  };
});

export function northInscriptionReserved(x, z) {
  return northInscriptions.some(({ center, angle, reserved }) =>
    Math.abs(x - center[0]) < 20 && Math.abs(z - center[1]) < 20 && inRect(x, z, center, angle, ...reserved));
}
