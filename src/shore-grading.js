import { baichengGrade } from './coast/shore.js';
import { landscapeGrades } from './parks/bay-fude-layout.js';
import { xiagangGrade, xiagangGradeBounds } from './xiagang-layout.js';
import { inRing } from './scenery-mesh.js';

// Local 5 m display meshes derived from the existing data. Bounds follow the
// 25/50 m parent cells so each patch meets the original triangulation exactly.
const step = 5;
const coastSites = [
  [-1700, -11750, -1250, -11350], // Jimei bridge, Lehai Road
  [1000, -9100, 1400, -8650],    // Jimei bridge, airport shore
  [-2450, -8550, -2000, -8000],  // Xiamen bridge, Gaoqi
  [-3850, -9850, -3450, -9450],  // Xiamen bridge, Jimei bank
];
export const tidalSite = [-3000, -450, -2050, 250]; // Eastern Yundang lake footpaths
const gradedLakes = ['东坪山水库', '上李水库', '芙蓉湖'];
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function lakeBank(lake, connected = []) {
  const polygons = [lake, ...connected].map(body => body.rings);
  const segments = polygons.flat().flatMap(ring => ring.map(([x, z], i) => {
    const [ex, ez] = ring[(i + 1) % ring.length];
    const dx = ex - x, dz = ez - z;
    return { x, z, dx, dz, length2: dx * dx + dz * dz };
  })).filter(segment => segment.length2 > 0);
  return (x, z, height) => {
    let distance2 = 42 ** 2;
    for (const a of segments) {
      const px = x - a.x, pz = z - a.z;
      if (Math.abs(px) > Math.abs(a.dx) + 42 || Math.abs(pz) > Math.abs(a.dz) + 42) continue;
      const t = Math.max(0, Math.min(1, (px * a.dx + pz * a.dz) / a.length2));
      distance2 = Math.min(distance2, (px - t * a.dx) ** 2 + (pz - t * a.dz) ** 2);
    }
    const d = Math.sqrt(distance2);
    const wet = polygons.some(([outline, ...islets]) =>
      inRing(x, z, outline) && !islets.some(ring => inRing(x, z, ring)));
    if (wet) return Math.min(height, lake.h - .19 - Math.min(1.35, d * .19));
    const margin = lake.kind === 'tidal' ? 10 : 13;
    const target = lake.h + .20 + Math.min(2.0, d * .14);
    // On the dry side raise low bank triangles and soften the first few metres
    // of high slopes, then return to the original hill or park elevation.
    const weight = 1 - smooth(margin, 42, d);
    const grade = Math.max(target, height - 2.3 * (1 - smooth(0, margin, d)));
    return height + weight * (grade - height);
  };
}

export function refineShoreTerrain(lakes, coastDistance, baseHeight, elevationField) {
  // The source has an unnamed lake in Zhongshan Park. Locate it by a mapped point in open water.
  const parkLake=lakes.find(lake=>inRing(-4035,1995,lake.rings[0]) && !lake.rings.slice(1).some(r=>inRing(-4035,1995,r)));
  const sites = lakes.filter(lake => lake===parkLake || lake.name==='五缘湾迷宫湿地' || gradedLakes.includes(lake.name)).map(lake => {
    const [x0, x1, z0, z1] = lake.bounds;
    const low = n => Math.floor((n - 90) / 50) * 50;
    const high = n => Math.ceil((n + 90) / 50) * 50;
    return { bounds: [low(x0), low(z0), high(x1), high(z1)], grade: lakeBank(lake) };
  });
  const tidal = lakes.find(lake => lake.name === '筼筜湖');
  if (tidal) {
    const channel = lakes.filter(lake => lake.name === '后埭溪');
    sites.push({ bounds: tidalSite, grade: lakeBank(tidal, channel) });
  }
  function marineGrade(x, z, original) {
    const shore = coastDistance(x, z);
    const bank = Math.max(.37, Math.min(2.45, .45 + shore * .069));
    // Signed coastline is positive on made land. Existing higher surfaces
    // and the channel beneath the bridge retain their recorded elevation.
    if (shore >= 0) return Math.max(bank, original);
    return Math.min(.37 + shore * .17, original);
  }
  for (const bounds of coastSites) sites.push({ bounds, grade: marineGrade });
  sites.push(...landscapeGrades, baichengGrade(coastDistance), {
    bounds: xiagangGradeBounds,
    grade: (x, z, h) => xiagangGrade(x, z, h, baseHeight, coastDistance),
  });
  return sites.map(({ bounds, grade }) => {
    const [xmin, zmin, xmax, zmax] = bounds;
    const width = (xmax - xmin) / step + 1, height = (zmax - zmin) / step + 1;
    const grid = { xmin, zmin, xmax, zmax, width, height };
    const data = new Float32Array(width * height);
    for (let j = 0; j < height; j++) {
      const z = zmin + j * step;
      for (let i = 0; i < width; i++) {
        const x = xmin + i * step;
        const original = baseHeight(x, z);
        const fade = smooth(0, 45, Math.min(x - xmin, xmax - x, z - zmin, zmax - z));
        data[j * width + i] = fade > 0 ? original + fade * (grade(x, z, original) - original) : original;
      }
    }
    return {
      grid, data,
      sample: elevationField(grid, data),
      contains: (x, z) => x >= xmin && x < xmax && z >= zmin && z < zmax,
    };
  });
}
