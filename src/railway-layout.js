import plan from './railway-plan.json' with { type: 'json' };
import { localFrame } from './landmark-forms.js';
import { groundY, inRing, mix } from './scenery-mesh.js';
import { measuredPath } from './old-town-layout.js';

export { plan };
export const stationPoint = localFrame(plan.origin, plan.angle);
const cos = Math.cos(plan.angle), sin = Math.sin(plan.angle);
export function stationCoordinates(x, z) {
  const dx = x - plan.origin[0], dz = z - plan.origin[1];
  return [dx * cos + dz * sin, -dx * sin + dz * cos];
}

export const stationTracks = plan.tracks.map(points => measuredPath(points.map(([u, v]) => stationPoint(u, v))));
export const railDatum = 14.25;
export const southSquareLevel = 12.65;
export const northSquareLevel = 13.2;
export const trackGrade = u => railDatum - u * .0024;
export function railHeight(geo, x, z) {
  const [u] = stationCoordinates(x, z);
  return mix(trackGrade(u), groundY(geo, x, z) + .27, fade(Math.abs(u), 325, 490));
}

// Cross-sections of the ballast through the two switch fans, in the station frame.
export const yardSections = [
  [-545, -23, -14], [-490, -28, -11], [-435, -29, 4], [-387, -34, 22],
  [-345, -35, 40], [-305, -38, 52], [-268, -47, 62], [-244, -49, 62],
  [242, -49, 62], [260, -43, 60], [299, -35, 52], [350, -33, 40],
  [405, -31, 22], [465, -29, 4], [500, -29, -1], [582, -27, -9],
];

function yardEdges(u) {
  const j = yardSections.findIndex(row => row[0] > u);
  if (j < 1) return (j === 0 ? yardSections[0] : yardSections.at(-1)).slice(1);
  const [a, lo, hi] = yardSections[j - 1], [b, nextLo, nextHi] = yardSections[j];
  const t = (u - a) / (b - a);
  return [mix(lo, nextLo, t), mix(hi, nextHi, t)];
}

function fade(value, inner, outer) {
  const t = Math.max(0, Math.min(1, (value - inner) / (outer - inner)));
  return t * t * (3 - 2 * t);
}

const inBounds = (x, z) => x > -1870 && x < -865 && z > 615 && z < 1450;
export function railwayReserved(x, z) {
  if (!inBounds(x, z)) return false;
  const [u, v] = stationCoordinates(x, z);
  if (u > -543 && u < 582) {
    const [lo, hi] = yardEdges(u);
    if (v > lo - 1.8 && v < hi + 1.6) return true;
  }
  if (v > 72 && v < 155 && (u < -94 || u > 93) && plan.serviceBuildings.some(ring => inRing(u, v, ring))) return true;
  return Math.abs(u) < 96 && (
    inRing(u, v, plan.hall) || inRing(u, v, plan.southSquare) ||
    inRing(u, v, plan.northSquare) || inRing(u, v, plan.northApron)
  );
}

// Clear the shallow railway cutting and both plazas of roof-height returns.
// Grade the mesh vertices, so adjoining sidewalks and collision use the same surface.
export function gradeRailway(grid, samples) {
  const dx = (grid.xmax - grid.xmin) / (grid.width - 1);
  const dz = (grid.zmax - grid.zmin) / (grid.height - 1);
  const unit = grid.metresPerUnit ?? 1;
  for (let row = Math.max(0, Math.ceil((600 - grid.zmin) / dz)); row < grid.height && grid.zmin + row * dz < 1475; row++) {
    for (let col = Math.max(0, Math.ceil((-1890 - grid.xmin) / dx)); col < grid.width && grid.xmin + col * dx < -850; col++) {
      const [u, v] = stationCoordinates(grid.xmin + col * dx, grid.zmin + row * dz);
      const [lo, hi] = yardEdges(u);
      const distanceToBed = Math.max(lo - v, v - hi);
      const rail = (1 - fade(distanceToBed, 9, 33)) * (1 - fade(Math.abs(u), 335, 520));
      const south = (1 - fade(Math.abs(u + 4), 90, 118)) *
        fade(v, 44, 74) * (1 - fade(v, 155, 180));
      const north = (1 - fade(Math.abs(u + 7), 70, 98)) *
        fade(-v, 44, 81) * (1 - fade(-v, 175, 201));
      const index = row * grid.width + col;
      let height = mix(samples[index] * unit, trackGrade(u) - .36, rail);
      height = mix(height, southSquareLevel - .38, south);
      height = mix(height, northSquareLevel - .46, north);
      samples[index] = Math.round(height / unit);
    }
  }
}

export const railwayTrees = [
  ...[-77, -65, 65, 77].flatMap(u => [109, 126, 143].map(v => [...stationPoint(u, v), .83, false])),
  ...[[-66, -128], [-74, -145], [-72, -162], [52, -134], [44, -145], [28, -153], [-48, -169]]
    .map(([u, v], i) => [...stationPoint(u, v), .86 + (i % 3) * .14, false]),
];
