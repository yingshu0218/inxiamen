import plan from './wucun-plan.json' with { type: 'json' };
import { groundY, inRing } from './scenery-mesh.js';
import { measuredPath } from './old-town-layout.js';
import { stationCoordinates, stationPoint } from './railway-layout.js';

export { plan };
export const districtRing = ring => ring.map(([u, v]) => stationPoint(u, v));
export const districtPath = points => measuredPath(districtRing(points));

function roadGroup(key, name, width, lanes, sidewalk) {
  return plan[key].map((points, i) => ({
    name, width, lanes, sidewalk, path: districtPath(points), key,
    direction: key === 'hubin' || key === 'east' ? 1 - 2 * i : 2 * i - 1,
  }));
}

export const xiahe = roadGroup('xiahe', '厦禾路', 13.2, 4, 3.25);
export const hubin = roadGroup('hubin', '湖滨东路', 10.4, 3, 2.6);
export const south = roadGroup('south', '站南路', 9.9, 3, 2.5);
export const east = roadGroup('east', '东坪山路', 7.7, 2, 2.3);
export const access = plan.access.map(([key, width, points]) => ({ key, width, sidewalk: .95, lanes: 1, path: districtPath(points) }));
export const streets = [...xiahe, ...hubin, ...south, ...east, ...access];

export const brt = districtPath(plan.brt);
export const brtStop = brt.nearest(...stationPoint(66, -197)).s;
export const stationWalks = [
  districtPath(plan.brtWalk),
  districtPath([[-109, 139], [-110, 167], [-110, 195], [-110, 215]]),
  districtPath([[104, 139], [103, 161], [103, 194], [101, 219]]),
];
export function wucunWalkDeck(geo, path) {
  const p = path.sample(path.length * .54);
  return groundY(geo, p.x, p.z) + .46 + (path === stationWalks[0] ? 6.1 : 6.95);
}
export const transitYard = districtRing(plan.transitYard);

export function transitYardLevels(geo) {
  const levels = transitYard.map(point => groundY(geo, ...point)).sort((a, b) => a - b);
  return [levels[0] - .55, levels[levels.length >> 1] + .30];
}

const buildingAreas = [plan.robinson, plan.school, plan.yuyue, plan.coachHouse, plan.transitYard,
  plan.hotelBlock, plan.eastHousing, ...plan.parking];
const inDistrict = (x, z) => x > -2225 && x < -755 && z > 450 && z < 1640;

export function wucunReserved(x, z) {
  if (!inDistrict(x, z)) return false;
  const [u, v] = stationCoordinates(x, z);
  if (buildingAreas.some(ring => inRing(u, v, ring))) return true;
  return streets.some(({ path, width }) => path.nearest(x, z).distance < width / 2 + 1.0);
}

export function replacesWucunStreet(x, z, dx, dz, elevated) {
  if (!inDistrict(x, z)) return false;
  const matches = (path, radius) => {
    const near = path.nearest(x, z);
    return near.s > .05 && near.s < path.length - .05 && near.distance < radius && Math.abs(dx * near.ux + dz * near.uz) > .81;
  };
  return elevated ? matches(brt, 6.3) || stationWalks.some(path => matches(path, 3.2))
    : streets.some(({ path, width }) => matches(path, Math.min(5.9, width * .66)));
}

const localTrees = [
  ...[-198, -170, -144, -118, -93, -34, -11, 15, 39, 65, 90, 118, 145, 169].map((u, i) => [u, i < 5 ? 185 + (u + 138) * .16 : 186, .79 + i % 3 * .14]),
  ...[[-234,-222],[-214,-217],[-198,-210],[-174,-225],[-139,-224],[-113,-219],[-54,-207],[-26,-203],
    [104,-184],[133,-185],[160,-184],[186,-182],[214,-182],[241,-184],[268,-185],
    [-348,-133],[-359,-125],[-335,-128],[-312,-135],[-293,-132],[-266,-156],
    [152,-69],[169,-70],[229,-71],[247,-83],[82,-78],[-193,-117],[-169,-114],[-145,-109]]
    .map(([u,v],i) => [u,v,.72+i%4*.13]),
];
export const wucunTrees = localTrees.map(([u,v,scale]) => [...stationPoint(u,v),scale,false]);
