import plan from './xiagang-plan.json' with { type: 'json' };
import { measuredPath, ribbon } from './measured-path.js';
import { inRing, litSurface } from './scenery-mesh.js';

export const xiagangStreets = plan.streets.map(([name, width, points]) =>
  ({ name, width, points, path: measuredPath(points) }));
export const xiagangWalks = plan.walks.map(([name, width, points]) =>
  ({ name, width, points, path: measuredPath(points) }));
const paths = [...xiagangStreets, ...xiagangWalks];
const plantingBeds = [
  [[-4939, 3480], [-4924, 3485], [-4908, 3504], [-4916, 3524], [-4925, 3516]],
  [[-4880, 3500], [-4873, 3492], [-4841, 3501], [-4857, 3513], [-4869, 3500]],
];
const plantedTrees = [[-4924, 3498, 4.8], [-4917, 3510, 4.5], [-4869, 3496, 4.6], [-4856, 3504, 4.3]];
const inXiagang = (x, z) => x > -4990 && x < -4075 && z > 3310 && z < 4460;

export const xiagangGradeBounds = [-5050, 3250, -4025, 4500];

export function xiagangGrade(x, z, height, originalHeight, coastDistance) {
  if (!inXiagang(x, z) || coastDistance(x, z) < -.5 || inRing(x, z, plan.basin)) return height;
  let best = 0, target = height;
  for (const { path, width } of paths) {
    const { s, distance } = path.nearest(x, z);
    const weight = Math.max(0, Math.min(1, (width / 2 + 10 - distance) / 9));
    if (weight <= best) continue;
    const p = path.sample(s);
    target = Math.max(1.1, originalHeight(p.x, p.z));
    best = weight;
  }
  return height + (target - height) * best * best * (3 - 2 * best);
}

export function xiagangRoadside(x, z, margin = 0) {
  return inXiagang(x, z) && paths.some(({ path, width }) => path.nearest(x, z).distance < width / 2 + margin);
}

export function xiagangReserved(x, z) {
  return inXiagang(x, z) && (inRing(x, z, plan.basin) || xiagangRoadside(x, z, 7));
}

export function replacesXiagangStreet(x, z, ux, uz, kind) {
  if (!inXiagang(x, z) || kind > 2) return false;
  return (kind < 1 ? xiagangWalks : xiagangStreets).some(({ path }) => {
    const near = path.nearest(x, z);
    return near.distance < 3 && Math.abs(ux * near.ux + uz * near.uz) > .85;
  });
}

export const xiagangPavingLevel = (geo, x, z) => geo.heightAt(x, z) + .71;

export function buildXiagang(batch, geo, lamps, obstacles, signs, plantings) {
  const height = (x, z) => xiagangPavingLevel(geo, x, z);
  for (const { path, width } of xiagangStreets) {
    ribbon(batch, path.sections(2.5), -width / 2, width / 2, height, '#73736e', litSurface.streetAsphalt);
  }
  for (const { path, width } of xiagangWalks) {
    // Keep the existing asphalt visible where the park meets public streets.
    ribbon(batch, path.sections(2.5), -width / 2, width / 2,
      (x, z) => height(x, z) - .035, '#b7a48c', 17);
  }
  for (const bed of plantingBeds) {
    // Fan the bed from a point on the same grade; narrow shoulders follow the slope.
    const center = bed.reduce(([x, z], [px, pz]) => [x + px / bed.length, z + pz / bed.length], [0, 0]);
    for (let i = 0; i < bed.length; i++) {
      batch.top([center, bed[i], bed[(i + 1) % bed.length]]
        .map(([x, z]) => [x, geo.heightAt(x, z) + .20, z]), '#687c52');
    }
  }
  for (const [x, z, size] of plantedTrees) {
    if (!xiagangRoadside(x, z, size) && !geo.waterAt(x, z)) {
      plantings.push([x, geo.heightAt(x, z), z, size, 1, .59]);
    }
  }
}
