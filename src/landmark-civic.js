import { cylinder, groundY, litSurface, mix, prism } from './scenery-mesh.js';
import { groundPaving, rect, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { civicPoint, governmentAnnex, governmentMain, governmentPoint, peopleHall } from './west-landmark-layout.js';

const stone = '#c8c1b0', cap = '#ddd8c9', steel = '#c1ccca', glass = '#6c9f9c';

function podium(batch, geo, ring, floor) {
  const bottom = Math.min(floor - 1, ...ring.map((p) => groundY(geo, ...p) - .7));
  prism(batch, ring, bottom, floor, '#a6a092', '#bfbaab', litSurface.graniteFacing);
}

function hall(batch, geo, lights, obstacles) {
  const xy = civicPoint, base = groundY(geo, ...xy(0, 15)) + .39;
  const p = (u, v, y) => up(xy(u, v), base + y);
  const block = (u, v, w, d, lo, hi, wall, roof = wall, style = 0) =>
    prism(batch, rect(xy, u, v, w, d), base + lo, base + hi, wall, roof, style, .55, 0, 22);

  podium(batch, geo, peopleHall, base);
  prism(batch, peopleHall, base, base + 2.2, '#a8a397', '#bdb7a8', litSurface.graniteFacing);

  // The assembly chamber is set back from the glazed, curved lake-facing lobby.
  block(2, -28, 58, 53.5, 2.2, 29.8, '#bdb9ad', cap, litSurface.graniteFacing);
  block(1.4, -35, 31.8, 30.8, 29.8, 34.1, '#bfc3b8', '#c9cbc1', litSurface.studioRibbon);
  for (const side of [-1, 1]) {
    const outer = [[36.4, 41.2], [33.1, 24], [30.5, 1], [31.1, -22], [34.9, -42], [43.3, -64]];
    const wing = [...outer, [21.8, -54.5], [21.8, 38]].map(([u, v]) => xy(u * side, v));
    prism(batch, wing, base + 2.15, base + 29 + side * .7, stone, '#d0cdc1',
      litSurface.graniteFacing, .4, 0, litSurface.railRoof);
    for (const v of [-34, -10, 14]) {
      block(side * 26, v, 4.1, 4.2, 28.05 + side * .7, 29.85 + side * .7, '#a6aea6', steel);
    }
  }
  block(0, 18.6, 50, 38.0, 2.2, 21.9, glass, null, litSurface.railGlass);
  const nose = (u) => 38.7 + 8.2 * (1 - (u / 29) ** 2);
  const ribs = Array.from({ length: 25 }, (_, i) => -29 + 58 * i / 24);
  for (let j = 1; j < ribs.length; j++) {
    const a = ribs[j - 1], b = ribs[j], vA = nose(a), vB = nose(b);
    const band = (front, lo, hi, color, style) => {
      batch.face([p(a, vA + front, lo), p(a, vA + front, hi), p(b, vB + front, hi), p(b, vB + front, lo)],
        color, style, .42, [[a + 29, lo], [a + 29, hi], [b + 29, hi], [b + 29, lo]]);
    };
    band(-2.1, 17.2, 23.45, glass, litSurface.railGlass);
    band(.32, 14.85, 16.55, '#d2c9b8', litSurface.railEave);
    band(.90, 23.35, 27.35, cap, litSurface.graniteFacing);
    for (const [y, front, depth] of [[16.55, .32, 6.5], [27.35, .90, 15.2]]) {
      batch.top([p(a, vA + front, y), p(b, vB + front, y), p(b, vB - depth, y + .23),
        p(a, vA - depth, y + .23)], '#c7c8bd', litSurface.railRoof);
    }
  }
  for (const u of [-15, 15]) {
    const [x, z] = xy(u, nose(u) - 1.1);
    cylinder(batch, x, z, base + .31, base + 24.3, .96, .86, steel, 14);
    cylinder(batch, x, z, base + .29, base + 1.23, 1.12, 1.0, '#aaa99d', 14);
    lights.add(x, base + 1.15, z + 1.34, '#ffd9a4', 1.25);
  }
  for (const u of [-21, -10.5, 0, 10.5, 21]) lights.add(...p(u, nose(u) - 4.1, 14.64), '#ffdda2', 1.42);
  obstacles.add(peopleHall, base + 30.5);
  obstacles.add(rect(xy, 0, -35, 32, 31), base + 34.1);

  // The lower plaza and its curved terraces are just above the existing lake bank.
  const floor = Math.max(...[-30, -15, 0, 15, 30].flatMap((u) =>
    [38, 53, 67].map((v) => groundY(geo, ...xy(u, v))))) + .16;
  const arc = (radius, angle, y) => up(xy(radius * Math.cos(angle), 38 + radius * Math.sin(angle)), y);
  const curve = (r, y) => Array.from({ length: 33 }, (_, i) => arc(r, .11 + (Math.PI - .22) * i / 32, y));
  batch.top([p(0, 38, floor - base), ...curve(31, floor)], '#bdb4a6', 22);
  for (let step = 0; step < 6; step++) {
    const inRadius = 31 + step * 2.4, y = floor + .23 * (step + 1);
    const a = curve(inRadius, y), b = curve(inRadius + 2.4, y);
    for (let i = 1; i < a.length; i++) {
      batch.top([a[i - 1], a[i], b[i], b[i - 1]], step % 2 ? '#bab0a1' : '#cfc5b3', 22);
      batch.face([[a[i - 1][0], y - .23, a[i - 1][2]], a[i - 1], a[i],
        [a[i][0], y - .23, a[i][2]]], '#9e9181');
    }
  }
  const outer = curve(46.9, floor + 1.43), inner = curve(45.4, floor + 1.39);
  for (let i = 1; i < outer.length; i++) {
    batch.top([inner[i - 1], inner[i], outer[i], outer[i - 1]], '#738459', 17);
  }
}

function government(batch, geo, lights, obstacles, signs) {
  const xy = governmentPoint, base = groundY(geo, ...xy(6, -9)) + .45;
  const p = (u, v, y) => up(xy(u, v), base + y);
  podium(batch, geo, governmentMain, base);
  prism(batch, governmentMain, base, base + 8.38, stone, '#bbbdb2', litSurface.graniteFacing);
  const upper = governmentMain.filter((_, i) => i !== 4 && i !== 5);
  prism(batch, upper, base + 8.38, base + 36.4, stone, '#bbbdb2', litSurface.graniteFacing, .35, 0, 22);
  for (const [u, v, width, depth] of [[-32.4, -7, 13.5, 9.2], [44.5, -.7, 16.4, 6.5]]) {
    const wing = rect(xy, u, v, width, depth);
    prism(batch, wing, base + 35.95, base + 40.2, stone, cap, litSurface.graniteFacing);
    obstacles.add(wing, base + 40.2);
  }
  const facade = [[-25.1, -1.48], [-15.2, -8.58], [-3, -7.68], [20.3, -5.48], [26.4, -5.08], [37.7, 3.62]];
  for (let i = 1; i < facade.length; i++) {
    const [a, v] = facade[i - 1], [b, w] = facade[i], width = Math.hypot(b - a, w - v);
    batch.face([p(a, v, 8.4), p(a, v, 34.15), p(b, w, 34.15), p(b, w, 8.4)],
      '#6bb3a3', litSurface.greenGlass, .54, [[0, 0], [0, 25.75], [width, 25.75], [width, 0]]);
  }
  for (const [[a, v], [b, w]] of [[[-41.3, -4.8], [-25.1, -1.9]], [[37.7, 3.2], [56.6, 3]]]) {
    for (let h = 3; h < 35.6; h += 4.55) {
      batch.face([p(a, v + .10, h), p(a, v + .10, h + .7),
        p(b, w + .10, h + .7), p(b, w + .10, h)], '#b9b1a0', litSurface.paleStone);
    }
  }
  // The recess beneath the stone entrance deck is visible from the public plaza.
  prism(batch, rect(xy, 7.3, 10.65, 25, 8.4), base + 4.1, base + 8.7, stone, cap, litSurface.paleStone);
  for (const u of [-3.4, 6.2, 16.5]) {
    const [x, z] = xy(u, 13.05);
    cylinder(batch, x, z, groundY(geo, x, z) - .26, base + 4.3, .62, .62, steel, 8);
    lights.add(x, base + 3.85, z + .71, '#ffdda5', 1.4);
  }
  const landing = groundY(geo, ...xy(7.3, 17)) + .51;
  const approach = groundY(geo, ...xy(7.3, 29.6)) + .18;
  prism(batch, rect(xy, 7.3, 14.3, 19.2, 14.2), approach - .7, landing, '#a9a191', '#c0b5a2', litSurface.stone);
  for (let i = 0; i < 10; i++) {
    const v = 21.69 + i * .77;
    prism(batch, rect(xy, 7.3, v, 19.2, .77), approach - .68, mix(landing - .04, approach, (i + 1) / 10),
      stone, '#c7baa5', litSurface.stone);
  }
  groundPaving(batch, geo, xy, [-8.7, 23.2, 29.38, 45], '#b0a89b');
  for (const u of [-6, 20.6]) {
    const y = groundY(geo, ...xy(u, 27));
    const bed = rect(xy, u, 27, 3.5, 15.4);
    prism(batch, bed, y - 1, y + .28, '#b7af9c', '#748251', litSurface.paleStone);
  }
  for (const u of [-3, 3.9, 10.8, 17.8, 24.7]) {
    pathTube(batch, [p(u, -6.3, 36.27), p(u, -6.3, 40.55)], .073, '#697570', 5);
  }
  pathTube(batch, [p(-3, -6.3, 40.42), p(24.7, -6.3, 40.42)], .074, '#697570', 5);
  signs.push({ label: '为人民服务', a: xy(-1.5, -6.06), b: xy(23.2, -6.06),
    y: base + 36.93, height: 3.18, ink: '#a13e39' });
  obstacles.add(governmentMain, base + 36.4);

  const annexBase = groundY(geo, ...xy(103, 10)) + .3;
  podium(batch, geo, governmentAnnex, annexBase);
  prism(batch, governmentAnnex, annexBase, annexBase + 31.8, '#b3bdb1', '#c8c9ba',
    litSurface.studioRibbon, .73, 0, 22);
  obstacles.add(governmentAnnex, annexBase + 31.8);
}

export function buildCivicCenter(batch, geo, lights, obstacles, signs) {
  hall(batch, geo, lights, obstacles);
  government(batch, geo, lights, obstacles, signs);
}
