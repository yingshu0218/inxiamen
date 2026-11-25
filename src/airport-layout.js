import { CatmullRomCurve3, Vector3 } from 'three';

// Metres along and to the south-east of the game's 05/23 centreline.
export function airportFrame(runway) {
  const dx = runway.end.x - runway.start.x, dz = runway.end.z - runway.start.z;
  const len = Math.hypot(dx, dz), sx = dx / len, sz = dz / len;
  return {
    len,
    world: (s, r) => [runway.start.x + s * sx - r * sz, runway.start.z + s * sz + r * sx],
    local: (x, z) => {
      const dx = x - runway.start.x, dz = z - runway.start.z;
      return [dx * sx + dz * sz, -dx * sz + dz * sx];
    },
  };
}

export const terminal3 = [1153, 526];
export const terminal4 = [3124, 701];
export const t3Forecourt = {
  plot: [1000, 618, 1325, 823], grade: [972, 608, 1351, 858], hinge: 644, slope: .046, drop: 9.3,
};
export const t4Forecourt = {
  plot: [2880, 800, 3369, 1026], grade: [2836, 785, 3414, 1060], hinge: 789, slope: .041, drop: 10.9,
};
const t4SouthParking = { ...t4Forecourt, plot: [2964, 1030, 3139, 1127], grade: [2932, 1004, 3170, 1158] };
const forecourts = [t3Forecourt, t4Forecourt, t4SouthParking];

export const t3SouthRoad = [
  [989.3,838.6],[995.1,827.9],[998.2,824],[1002,820.7],[1011.6,823.1],[1140.6,823.8],
  [1164,823.1],[1214.6,823.3],[1295.7,822],[1316,825.2],[1327.3,830.3],
];

export const forecourtLevel = (site, datum, r) => datum - Math.min(site.drop, Math.max(0, r - site.hinge) * site.slope);
const outsideBox = (s, r, [s0, r0, s1, r1]) => Math.max(s0 - s, s - s1, r0 - r, r - r1, 0);
const insideForecourt = (s, r) => forecourts.some(({ plot }) => outsideBox(s, r, plot) === 0);

export const apronOutlines = [
  [[108, 239], [173, 248], [530, 245], [584, 237], [837, 244], [1000, 237], [1528, 237],
    [1587, 232], [2011, 231], [2088, 250], [2088, 455], [1973, 466], [1586, 468],
    [1553, 481], [800, 481], [758, 462], [710, 414], [650, 397], [107, 393], [88, 344]],
  [[2011, 231], [2132, 247], [2782, 243], [3374, 243], [3486, 241], [3494, 405], [3457, 456],
    [3424, 509], [3403, 626], [3330, 637], [2873, 643], [2802, 635], [2752, 600],
    [2517, 594], [2491, 477], [2185, 476], [2011, 466]],
  [[1957, 456], [2023, 456], [2032, 611], [2352, 602], [2435, 612], [2474, 673],
    [2470, 812], [2324, 817], [2271, 794], [1692, 788], [1692, 686], [1741, 621],
    [1954, 621]],
  [[2620, 843], [2690, 804], [2801, 823], [2801, 990], [2619, 990]],
];

export const arrivalTaxiExit = { width: 23, concreteFrom: 4, holdAt: [2019, 78], points: [[1865, 0], [1929, 14],
  [1975, 40], [2019, 78], [2053, 114], [2067, 152], [2070, 193], [2069, 233], [2083, 263]] };
// The lead-in ends at the nose-wheel stop marking on the open apron between T3 and T4.
export const arrivalStandLine = [[2083, 263], [2097, 285], [2105, 306], [2107, 328], [2107, 402]];

export const taxiRoutes = [
  { width: 25, primary: true, concreteFrom: 8, points: [[16, 1], [20, 34], [28, 66], [50, 104], [82, 150],
    [115, 177], [154, 186], [177, 186], [625, 186], [2060, 185], [3100, 184], [3332, 184],
    [3359, 186], [3378, 198], [3385, 226], [3386, 263]] },
  { width: 23, primary: true, concreteFrom: 2, points: [[133, 184], [151, 215], [174, 243], [205, 263],
    [529, 263], [1176, 263], [2059, 263], [3191, 263], [3481, 263]] },
  { width: 23, concreteFrom: 4, holdAt: [174, 78], points: [[131, 0], [157, 10], [171, 32], [174, 64], [174, 96], [174, 131],
    [185, 162], [212, 182], [244, 186]] },
  { width: 24, holdAt: [544, 86], points: [[486, 0], [512, 9], [533, 33], [544, 65], [544, 124],
    [551, 164], [563, 189], [561, 224], [549, 247], [529, 263]] },
  { width: 23, concreteFrom: 4, holdAt: [857, 84], points: [[993, 0], [948, 5], [910, 29], [873, 62],
    [838, 103], [824, 134], [817, 166], [810, 207], [819, 242], [839, 263]] },
  { width: 23, concreteFrom: 3, holdAt: [1247, 83], points: [[1390, 0], [1335, 10], [1283, 41], [1247, 83],
    [1223, 121], [1209, 156], [1202, 195], [1208, 230], [1225, 263]] },
  { width: 22, concreteFrom: 0, points: [[1512, 185], [1544, 195], [1565, 221], [1572, 247], [1596, 263]] },
  arrivalTaxiExit,
  { width: 23, concreteFrom: 4, holdAt: [2367, 82], points: [[2214, 0], [2267, 12], [2325, 43], [2367, 82],
    [2387, 115], [2401, 151], [2407, 193], [2418, 236], [2446, 263]] },
  { width: 23, concreteFrom: 4, holdAt: [2797, 76], points: [[2655, 0], [2699, 8], [2755, 39], [2797, 76],
    [2820, 118], [2833, 163], [2827, 213], [2798, 249], [2782, 263]] },
  { width: 23, concreteFrom: 4, holdAt: [3253, 86], points: [[3136, 1], [3212, 1], [3236, 11], [3252, 42],
    [3253, 96], [3253, 153], [3253, 215], [3256, 264], [3259, 329]] },
  { width: 23, concreteFrom: 0, holdAt: [3386, 87], points: [[3321, 1], [3349, 6], [3371, 19], [3385, 50],
    [3386, 149], [3385, 210], [3386, 226], [3388, 243], [3400, 263]] },
  { width: 18, concreteFrom: 0, points: [[3081, 185], [3102, 201], [3107, 231], [3106, 288],
    [3120, 305], [3140, 314], [3150, 344], [3151, 550]] },
];

export function sampleTaxiRoute({ points, concreteFrom = points.length - 1 }) {
  const curve = new CatmullRomCurve3(points.map(([s, r]) => new Vector3(s, 0, r)));
  const path = [points[0]];
  let transition = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 7);
    for (let j = 1; j <= steps; j++) {
      const { x, z } = curve.getPoint((i - 1 + j / steps) / (points.length - 1));
      path.push([x, z]);
    }
    if (i === concreteFrom) transition = path.length - 1;
  }
  return { path, transition };
}

// Level the movement area and foundations into the same terrain used by the aircraft.
const gradingZones = [
  [-24, -69, 3516, 293],
  [65, 234, 2106, 488], [102, 364, 488, 517], [710, 425, 1568, 516],
  [984, 479, 1328, 674], [1564, 409, 2492, 606], [1664, 587, 2501, 920],
  [1937, 424, 3455, 501], [2457, 394, 3482, 623], [2720, 522, 3431, 675],
  [2910, 605, 3355, 833], [2592, 779, 2825, 1080], [3375, 245, 3522, 484],
];
const gradeBounds = [...gradingZones, ...forecourts.map(site => site.grade)];
const bounds = [
  Math.min(...gradeBounds.map(z => z[0])),
  Math.min(...gradeBounds.map(z => z[1])),
  Math.max(...gradeBounds.map(z => z[2])),
  Math.max(...gradeBounds.map(z => z[3])),
];

function insideAirportWorks(frame, s, r) {
  if (s <= -330 || s >= frame.len + 360 || r <= -82 || r >= bounds[3] + 9) return false;
  if (r < 82) return true;
  return gradingZones.some(([s0, r0, s1, r1]) =>
    s > s0 - 9 && s < s1 + 9 && r > r0 - 9 && r < r1 + 9);
}

export function airportWorksReserved(frame, x, z) {
  const [s, r] = frame.local(x, z);
  return insideAirportWorks(frame, s, r) || insideForecourt(s, r);
}

export function airportRoadReserved(frame, x, z, elevated, kind) {
  const [s, r] = frame.local(x, z);
  const accessDeck = elevated && kind >= 2;
  if (!elevated && kind === 3 && s > 990 && s < 1327 && r > 817 && r < 831) return true;
  if (insideForecourt(s, r)) return !accessDeck;
  if (!insideAirportWorks(frame, s, r)) return false;
  if (r < 82 && (s < -24 || s > frame.len + 15)) return false;
  // Landside access ramps pass under the terminal eaves and join public streets.
  const t3Access = s > 972 && s < 1351 && r >= (accessDeck ? 604 : 619);
  const t4Access = s > 2840 && s < 3412 && r >= (accessDeck ? 761 : 786);
  return !t3Access && !t4Access;
}

export function gradeAirport(runway, grid, samples) {
  const frame = airportFrame(runway), scale = grid.metresPerUnit ?? 1;
  const { xmin, xmax, zmin, zmax, width, height } = grid;
  const dx = (xmax - xmin) / (width - 1), dz = (zmax - zmin) / (height - 1);
  const blend = 52;
  const [s0, r0, s1, r1] = bounds;
  const corners = [frame.world(s0 - blend, r0 - blend), frame.world(s1 + blend, r0 - blend),
    frame.world(s1 + blend, r1 + blend), frame.world(s0 - blend, r1 + blend)];
  const lowX = Math.max(0, Math.ceil((Math.min(...corners.map(p => p[0])) - xmin) / dx));
  const hiX = Math.min(width - 1, Math.floor((Math.max(...corners.map(p => p[0])) - xmin) / dx));
  const lowZ = Math.max(0, Math.ceil((Math.min(...corners.map(p => p[1])) - zmin) / dz));
  const hiZ = Math.min(height - 1, Math.floor((Math.max(...corners.map(p => p[1])) - zmin) / dz));
  for (let j = lowZ; j <= hiZ; j++) {
    for (let i = lowX; i <= hiX; i++) {
      const [s, r] = frame.local(xmin + i * dx, zmin + j * dz);
      let distance = blend;
      for (const zone of gradingZones) distance = Math.min(distance, outsideBox(s, r, zone));
      const t = 1 - distance / blend, weight = t * t * (3 - 2 * t);
      const index = j * width + i;
      let level = samples[index] * scale;
      level += weight * (runway.elevation - level);
      for (const site of forecourts) {
        const edge = Math.max(0, 1 - outsideBox(s, r, site.grade) / 33);
        const fade = edge * edge * (3 - 2 * edge);
        level += fade * (forecourtLevel(site, runway.elevation, r) - level);
      }
      samples[index] = Math.round(level / scale);
    }
  }
}
