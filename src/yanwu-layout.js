import plan from './yanwu-plan.json' with { type: 'json' };

export const yanwuPlatformLevel = 4.28;

// Keep the two ramp-to-surface-road seams on the mapped Ring Road nodes.
export const yanwuBaichengJoins = {
  seaward: plan.baichengSeaward.at(-1), // Joins 环岛南路 way 1329802046.
  landward: plan.baichengLandward.at(-1), // Joins 环岛南路 way 1329802045.
};

export function yanwuRoadDatum(geo, point, lift = 0) {
  return geo.heightAt(...point) + .39 + lift;
}

// Same finished asphalt level and width as the paired Ring Road carriageways.
export const yanwuBaichengWidth = 8.7;
export const yanwuBaichengRoadLevel = (geo, x, z) => Math.max(.89, geo.heightAt(x,z)) + .46;
// First landward segment of each receiving carriageway, in eastbound order.
export const yanwuBaichengNormals = [[18.8,7.1],[40.4,16.2]].map(([dx,dz]) => {
  const distance = Math.hypot(dx,dz);
  return [-dz/distance,dx/distance];
});

// The legacy street tile contains three truncated renderings of these same mapped
// footways. The model owns the over-water pieces; the land paths keep their joins.
const platformTileEnds = [
  [-4165, 4829, -4126, 4775],
  [-4043, 4941, -4010, 4888],
  [-3933, 4875, -3949, 4997],
];
export function replacesYanwuPlatformTile(way) {
  return platformTileEnds.some(([x,z,ex,ez]) =>
    (way[0]===x && way[1]===z && way.at(-2)===ex && way.at(-1)===ez) ||
    (way[0]===ex && way[1]===ez && way.at(-2)===x && way.at(-1)===z));
}

export function reachesYanwuFromLujiang(way) {
  const [a,b] = plan.northEnds;
  return [way.slice(0,2),way.slice(-2)].some(([x,z])=>[a,b].some(([ex,ez])=>Math.hypot(x-ex,z-ez)<1));
}

export const yanwuViews = [
  { id: 'yanwu-sea', parent: 'bridge', name: '演武大桥 · 海上看弯桥', x: -4103, z: 4767,
    focusHeight: 25, fov: 62, portraitFovBoost: 26,
    view: { x: -4680, z: 5370, y: 154 },
    portraitView: { x: -4650, z: 6660, y: 380 }, portraitFocus: { x: -3960, z: 4685, y: 28 } },
  { id: 'yanwu-platform', parent: 'bridge', name: '星光海岸 · 平台望双子塔', x: -4120, z: 5008,
    lookAt: { x: -4172, z: 4633 }, focusHeight: 145, fov: 63, portraitFovBoost: 10,
    view: { x: -4120, z: 5008, y: yanwuPlatformLevel + 2 },
    portraitView: { x: -4109, z: 5016, y: yanwuPlatformLevel + 2 } },
];
