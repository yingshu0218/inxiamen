import { inRect, localFrame } from './landmark-forms.js';
import { inRing } from './scenery-mesh.js';

export const dongduPoint = localFrame([-5550, -568], 1.46);
export const civicPoint = localFrame([-4028, -2], -.363);
export const governmentPoint = localFrame([-4123, -254], -.351);
export const pearlCentre = [-4569.6, -535.7];
export const theatreDome = [-4585.9, -466.7];

// Along the terminal from north to south, with the two eaves measured inland and seaward.
// The stepped shore follows OSM way 160424437.
export const dongduSections = [
  [-175, 14, 15], [-166, 2, 17], [-129, -49, 27], [-97, -47, 36],
  [-91, -46.7, 34], [-56, -43.6, 44], [-54, -43.3, 41], [-34, -43.2, 47],
  [-13, -43.3, 53.5], [-12, -43.4, 50], [28.5, -43.7, 59.8],
  [30, -43.7, 55.5], [36, -43.8, 35.6], [39, -43.8, 25.5],
  [93, -47, 25.3], [100.7, -47.6, 25.2], [102, -47.8, 20.3],
  [139.4, -51.3, 18.1], [147.4, -52, -16], [152.5, -52.5, -51.9],
];

export const dongduFootprint = [
  ...dongduSections.map(([u, land]) => dongduPoint(u, land)),
  ...dongduSections.toReversed().map(([u, , sea]) => dongduPoint(u, sea)),
];

// Float centre lines and the ends of their shore gangways.
export const dongduPontoons = [
  { a: [-5649.9, -524.2], b: [-5625.9, -446.5], width: 12.8,
    ramps: [[[-5618.9, -515], [-5638.3, -508.8]], [[-5604.1, -471.9], [-5625, -465.7]]] },
  { a: [-5620.85, -426.3], b: [-5596.8, -348.6], width: 12.8,
    ramps: [[[-5588.1, -415.6], [-5609.3, -410.8]], [[-5574.7, -372.9], [-5596, -367.7]]] },
  { a: [-5593.9, -328.3], b: [-5583.2, -294.6], width: 8.8,
    ramps: [[[-5561.8, -329.1], [-5587.1, -321]]] },
  { a: [-5579.5, -277], b: [-5568.5, -243.4], width: 8.5,
    ramps: [[[-5545.2, -278], [-5572.8, -270.3]]] },
];

export const peopleHall = [
  [-37, 42], [-31, 17.6], [-29.2, -4], [-28.7, -22], [-31.8, -41.4],
  [-38.4, -63.7], [-30.1, -58.2], [35.6, -56.5], [48.2, -70.1],
  [41.1, -52.7], [36.1, -39.6], [32.8, -26.2], [31.5, -14], [31.3, 3.4],
  [34.2, 24.9], [36.9, 43.9], [24.1, 37.8], [11.5, 42.2], [-4.3, 42.6],
  [-17.1, 40.8], [-27.3, 36.9],
].map(([u, v]) => civicPoint(u, v));

export const governmentMain = [
  [-41.3, -4.8], [-25.1, -1.9], [-15.2, -9], [-3, -8.1], [-4.2, 7.9], [19.1, 9.5],
  [20.3, -5.9], [26.4, -5.5], [37.7, 3.2], [56.6, 3], [32, -17.1], [-16.4, -20.1],
].map(([u, v]) => governmentPoint(u, v));
export const governmentAnnex = [
  [77.7, -27.6], [77, 25.4], [93.5, 36.7], [107.3, 36.1], [107.7, 46.1],
  [114.5, 45.8], [121.7, 49], [123.4, -26.9],
].map(([u, v]) => governmentPoint(u, v));

export const weatherOffices = [
  [[-4606, -511], [-4583, -513], [-4580, -484], [-4604, -482]],
  [[-4607, -517], [-4583, -518], [-4584.5, -542.7], [-4593, -542], [-4592, -531], [-4608, -530]],
  [[-4607, -564], [-4606, -548], [-4553, -552], [-4554.5, -568]],
  [[-4612, -582], [-4578, -585], [-4562, -588], [-4563, -601],
    [-4586, -599], [-4586, -596], [-4603, -594], [-4603, -599], [-4613, -598]],
];

export function westLandmarkReserved(x, z) {
  if (x > -5650 && x < -5420 && z > -750 && z < -398) return inRing(x, z, dongduFootprint);
  if (x > -4625 && x < -4540 && z > -612 && z < -440) {
    return Math.hypot(x - pearlCentre[0], z - pearlCentre[1]) < 15 ||
      Math.hypot(x - theatreDome[0], z - theatreDome[1]) < 13 ||
      weatherOffices.some((ring) => inRing(x, z, ring));
  }
  if (x > -4100 && x < -3950 && z > -95 && z < 112) {
    return inRing(x, z, peopleHall) || inRect(x, z, civicPoint(0, 64), -.363, 44, 29) ||
      inRect(x, z, civicPoint(39, 2), -.363, 5.8, 13);
  }
  return x > -4190 && x < -3977 && z > -332 && z < -188 &&
    (inRing(x, z, governmentMain) || inRing(x, z, governmentAnnex) ||
      inRect(x, z, governmentPoint(-32.5, -16.5), -.351, 10, 7.4) ||
      inRect(x, z, governmentPoint(7.3, 24), -.351, 13.3, 20.8));
}
