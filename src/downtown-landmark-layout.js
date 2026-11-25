import { localFrame } from './landmark-forms.js';
import { inRing } from './scenery-mesh.js';

export const gymPoint = localFrame([-1973.5, -1053], 1.257);
export const sportsGym = [[-74.2, -25.8], [106.1, -20.7], [107, 39.6], [-75.7, 34.5]]
  .map(([u, v]) => gymPoint(u, v));
export const sportsCentre = [-2091, -991];

// The southern commercial plots and the two tower footprints follow the map.
export const mixc = [
  [[-1943.4, 693.4], [-1963.3, 624.6], [-1972.9, 627.4], [-1988.3, 574.2], [-1948.3, 563.1],
    [-1957.2, 526.4], [-2059, 554.7], [-2055.8, 565.9], [-2062.5, 568.3], [-2047.2, 620],
    [-2014, 610.3], [-2006.3, 637], [-2027.4, 643.1], [-2011.8, 697.1], [-2027.4, 701.6], [-2023.1, 716.4]],
  [[-1910.7, 682.3], [-1853.7, 666.3], [-1801.4, 644.7], [-1802, 636.9], [-1813.4, 632.8],
    [-1812, 622.2], [-1803.1, 602.4], [-1815.6, 571.7], [-1851.2, 500.5], [-1859.8, 483.4],
    [-1845.6, 456.2], [-1872.4, 409.6], [-1916.1, 391], [-1983.7, 409.8], [-1981, 420.7],
    [-1954.1, 413.5], [-1924.6, 431.2], [-1916.3, 459.2], [-1940.6, 467.2],
    [-1948.1, 507.9], [-1916.5, 606.8], [-1880.8, 629.4], [-1875, 649.2], [-1908.4, 659.5], [-1915.1, 669.3]],
];
export const mixcTowers = [
  [[-1916.3, 459.2], [-1940.6, 467.2], [-1973.3, 449.3], [-1981, 420.7], [-1954.1, 413.5], [-1924.6, 431.2]],
  [[-1908.4, 659.5], [-1931.4, 644.7], [-1939.5, 615.7], [-1916.5, 606.8], [-1880.8, 629.4], [-1875, 649.2]],
];
export const mixcNorth = [
  [-2146, 391], [-2168, 320], [-2140, 300], [-2069, 276], [-2003, 255],
  [-1983, 277], [-1967.5, 343], [-1976, 351], [-1994, 345], [-2011, 350],
  [-2020, 372], [-2073, 386], [-2106, 383],
];
const mixcLinkFrame = localFrame([-1972, 411.7], -.285);
export const mixcLink = [mixcLinkFrame(0, 0), mixcLinkFrame(0, -56), mixcLinkFrame(-38.4, -56)];
export const mixcNorthFrame = localFrame([-2058, 331], -.285);
export const mixcCentre = [-1910, 537];
export const mixcSouthPlaza = [
  [-1853.7, 666.3], [-1801.4, 644.7], [-1790.3, 655.7], [-1848.7, 685.4], [-1862.2, 677.5],
];
const mixcNorthPlaza = [[-1983.7, 409.8], [-1916.1, 391], [-1921, 379.1], [-1989.7, 400.5]];
export const mixcStationCanopy = [[-1952, 305], [-1931, 300], [-1911.5, 309],
  [-1917.4, 322.4], [-1932.7, 316], [-1950, 322]];
export const mixcStationKiosk = [[-1943.5, 331.5], [-1966.5, 338], [-1964.5, 345.5], [-1941, 339]];

export const nanhuCentre = [-2470, -100];
export const nanhuPavilion = [-2390, -78];
export const peachIsland = [
  [-2461.6, -49.5], [-2451.2, -65.1], [-2444.6, -80.9], [-2439.8, -108.9],
  [-2444.3, -120.5], [-2457.9, -134.6], [-2470.5, -139.1], [-2478.7, -134],
  [-2489.9, -114.9], [-2497.3, -95.7], [-2497.3, -85], [-2488.2, -71.9],
  [-2474.2, -51], [-2467.7, -48.5],
];
export const nanhuGardenBridges = [
  [[-2509.9, -96.4], [-2497.3, -95.7]],
  [[-2468.2, -145], [-2467.1, -138.6]],
  [[-2467, -40.3], [-2466, -48.4]],
];
// The steel span sits across the two mapped banks at the park crossing.
export const nanhuCrossing = [[-2591.36, 54.08], [-2572.23, 48.22]];
export const nanhuBridgeWalks = [
  [[-2618.3, 66.9], [-2594.6, 55.2], nanhuCrossing[0]],
  [[-2594.6, 55.2], [-2603, 72], [-2594, 105], [-2586, 140]],
  [nanhuCrossing[1], [-2562.5, 46.2], [-2572.1, 15.3], [-2540.4, -3], [-2533.7, -20.5],
    [-2511.2, -33.2], [-2467, -40.3]],
  [[-2562.5, 46.2], [-2558, 65], [-2554, 87], [-2546, 109], [-2533, 127]],
];

const mixcFootprints = [...mixc, ...mixcTowers, mixcNorth, mixcNorthPlaza, mixcSouthPlaza, mixcStationKiosk];
const mixcReplacedBuildings = [[-2043.19, 271.06], [-1973.5, 317.13], [-1931.5, 303.38]];
export function downtownReserved(x, z) {
  if (x > -2200 && x < -1785 && z > 230 && z < 732)
    return mixcFootprints.some((ring) => inRing(x, z, ring)) ||
      mixcReplacedBuildings.some(([u, v]) => Math.abs(x - u) < 1 && Math.abs(z - v) < 1);
  if (x > -2050 && x < -1900 && z > -1155 && z < -935) return inRing(x, z, sportsGym);
  if (x > -2077 && x < -2051 && z > -961 && z < -911) return true;
  if (x > -2502 && x < -2435 && z > -145 && z < -44) return inRing(x, z, peachIsland);
  return Math.hypot(x - nanhuPavilion[0], z - nanhuPavilion[1]) < 10;
}

// Footprints in the park's managed lake and strip beside 后埭溪 become low
// service buildings in the authored scene. Leave the surrounding trees in use.
const nanhuGrounds = [
  [-2459, -272], [-2321, -283], [-2295, -167], [-2284, -23], [-2324, 64],
  [-2483, 121], [-2551, 133], [-2589, 98], [-2628, 6], [-2648, -79],
  [-2590, -170], [-2550, -213], [-2508, -217],
];
export function nanhuBuildingsReserved(x, z) {
  return x > -2650 && x < -2280 && z > -285 && z < 134 && inRing(x, z, nanhuGrounds);
}
