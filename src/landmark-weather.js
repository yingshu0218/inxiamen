import { cylinder, groundY, litSurface, mix, prism, TAU } from './scenery-mesh.js';
import { ellipse, localFrame, rect, up } from './landmark-forms.js';
import { pearlCentre, theatreDome, weatherOffices } from './west-landmark-layout.js';

const steel = '#cbd3cc';
const pearl = '#e1e0ce';
const roofGarden = '#667f63';
const levels = [
  [0, 9.7], [4, 9.28], [11, 8.69], [21, 8.58], [31, 9.12], [40, 10.02],
  [48, 11.18], [56, 12.67], [63, 14.17], [70, 16.0], [72.2, 16.25],
];

function shell(batch, [x, z], profile, sides, color, style = 0, seed = 0) {
  const ring = (y, radius) => Array.from({ length: sides }, (_, i) => {
    const a = i * TAU / sides;
    return [x + radius * Math.cos(a), y, z + radius * Math.sin(a)];
  });
  let lower = ring(...profile[0]);
  for (let j = 1; j < profile.length; j++) {
    const upper = ring(...profile[j]);
    for (let i = 0; i < sides; i++) {
      const k = (i + 1) % sides;
      const v0 = (lower[i][1] - profile[0][0]) * 1.52;
      const v1 = (upper[i][1] - profile[0][0]) * 1.52;
      if (profile[j][1] < .001) {
        batch.face([lower[i], upper[i], lower[k]], color, style, seed);
        continue;
      }
      batch.face([lower[i], upper[i], upper[k], lower[k]], color, style, seed,
        [[i * 2.35, v0], [i * 2.35, v1], [(i + 1) * 2.35, v1], [(i + 1) * 2.35, v0]]);
    }
    lower = upper;
  }
  batch.top(lower, color);
}

function tower(batch, geo, lamps, obstacles) {
  const [x, z] = pearlCentre, xy = localFrame(pearlCentre);
  const base = groundY(geo, x, z) + .38;
  // Match the published crest elevation against the game's smoothed hill surface.
  const scale = (195.3 - base) / 85.0;
  const y = (height) => base + height * scale;
  const entries = ellipse(xy, 0, 0, 12.25, 12.25, 36);
  prism(batch, entries, base - 2.25, base + .42, '#bab6a6', '#cbc7b7', litSurface.graniteFacing);
  const profile = levels.flatMap(([h, r], i) => {
    if (!i) return [[y(h), r]];
    const [before, radius] = levels[i - 1];
    return [.5, 1].map((t) => [y(mix(before, h, t)), mix(radius, r, t)]);
  });
  shell(batch, pearlCentre, profile, 64, '#398f84', litSurface.greenGlass, .53);
  for (const [height, radius, inset] of [[3.1, 9.47, .12], [63, 14.17, .09], [70, 16.0, .17], [72.2, 16.25, .22]]) {
    const level = y(height);
    cylinder(batch, x, z, level - inset, level + inset, radius + .08, radius + .08, steel, 64,
      0, height === 72.2 ? roofGarden : steel, height > 69 ? litSurface.railEave : 0);
  }
  cylinder(batch, x, z, y(72.35), y(77.5), 5.85, 4.72, '#bfc7bc', 40);
  const dome = Array.from({ length: 17 }, (_, i) => {
    const angle = -.30 + (Math.PI / 2 + .30) * i / 16;
    return [y(78.9 + 6.1 * Math.sin(angle)), 5.77 * Math.cos(angle)];
  });
  shell(batch, pearlCentre, dome, 48, pearl, litSurface.paleStone);
  for (const side of [-1, 1]) {
    cylinder(batch, x + side * 13.1, z + 2.7, y(72.2), y(78.6), .11, .065, '#a7b7af', 8);
    lamps.add(x + side * 13.1, y(78.64), z + 2.7, '#ff7670', .59);
  }
  for (let i = 0; i < 12; i++) {
    const angle = i * TAU / 12, a = Math.cos(angle), b = Math.sin(angle);
    lamps.add(x + a * 16.12, y(71.95), z + b * 16.12, '#d4f4e6', .91);
  }
  obstacles.add(ellipse(xy, 0, 0, 16.35, 16.35, 36), y(85));
}

function domeCinema(batch, geo, obstacles) {
  const xy = localFrame(theatreDome), [x, z] = theatreDome;
  const base = groundY(geo, x, z) + .2;
  const ring = ellipse(xy, 0, 0, 11.6, 11.6, 40);
  prism(batch, ring, base - 2, base + 2.75, '#c0bcae', null, litSurface.studioRibbon, .31);
  const profile = Array.from({ length: 15 }, (_, i) => {
    const theta = Math.PI * i / 28;
    return [base + 2.73 + 9.45 * Math.sin(theta), 11.45 * Math.cos(theta)];
  });
  shell(batch, theatreDome, profile, 44, '#d1d7d1', litSurface.crownMetal);
  const portico = rect(xy, 0, 11, 7.5, 3.95);
  prism(batch, portico, base - .9, base + 2.63, '#7b999c', steel, litSurface.railGlass, .66);
  obstacles.add(ring, base + 12.2);
}

export function buildWeatherHill(batch, geo, lamps, obstacles, signs) {
  for (const [i, ring] of weatherOffices.entries()) {
    const heights = ring.map((p) => groundY(geo, ...p));
    const bottom = Math.min(...heights) - .8, floor = Math.max(...heights) + .24;
    const roof = floor + [9.35, 6.6, 10.1, 7.75][i];
    prism(batch, ring, bottom, floor, '#9e9d90', null, litSurface.graniteFacing);
    prism(batch, ring, floor, roof - .36, '#b9c4ba', null, litSurface.studioRibbon, .18 + .13 * i);
    prism(batch, ring, roof - .36, roof, steel, roofGarden, litSurface.graniteFacing, .4, 0, 22);
    if (i === 0) {
      const xy = localFrame([-4592.2, -498.8], -.082);
      const front = rect(xy, 0, 16.7, 13.6, 5.2);
      prism(batch, front, floor + 3.75, floor + 4.35, steel, '#a9bcb4', litSurface.railEave);
      signs.push({ label: '厦门气象台', a: xy(-6.4, 19.32), b: xy(6.4, 19.32),
        y: floor + 3.8, height: .48, ink: '#57716f' });
      lamps.add(...up(xy(0, 18.3), floor + 3.68), '#ffdcaa', 1.35);
    }
    obstacles.add(ring, roof);
  }
  domeCinema(batch, geo, obstacles);
  tower(batch, geo, lamps, obstacles);
}
