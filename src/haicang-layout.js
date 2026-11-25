import { measuredPath } from './old-town-layout.js';
import { geoPoint } from './scenery-mesh.js';

export const center = geoPoint(118.06855, 24.49707);
export const halfSpan = 324;
export const anchorStation = 554;
const grade = 0.0238;
const axisLength = Math.hypot(1, grade);
export const eastAxis = { x: 1 / axisLength, y: grade / axisLength };

export function fairwayPoint(station) {
  return [center[0] + eastAxis.x * station, center[1] + eastAxis.y * station];
}

const westApproach = [
  [118.04888, 24.50056],
  [118.05128, 24.50037],
  [118.0535, 24.50015],
  [118.05565, 24.49955],
  [118.05807, 24.49827],
  [118.06031, 24.49744],
  [118.06194, 24.49722],
].map((point) => geoPoint(...point));
const eastApproach = [
  [118.07507, 24.49693],
  [118.07649, 24.49683],
  [118.07835, 24.49638],
  [118.07983, 24.49582],
  [118.0814, 24.49502],
  [118.0833, 24.49394],
].map((point) => geoPoint(...point));
export const deckControls = [
  ...westApproach, ...[-anchorStation, -halfSpan, 0, halfSpan, anchorStation].map(fairwayPoint),
  ...eastApproach,
];
const deck = measuredPath(deckControls);

export function deckDistance(x, z) {
  return deck.nearest(x, z).distance;
}

export function inWestHarborView(x, z) {
  const dx = x - center[0], dz = z - center[1];
  const along = dx * eastAxis.x + dz * eastAxis.y;
  const across = -dx * eastAxis.y + dz * eastAxis.x;
  // The selected tour views the deck from the south. End the hold at the
  // east tower, where this pass continues along the Dongdu waterfront.
  return along >= -anchorStation && along <= halfSpan && across >= 0 && across <= 900;
}
