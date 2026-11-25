import { cylinder, groundY, litSurface, mix, prism } from './scenery-mesh.js';
import { rect, up } from './landmark-forms.js';
import { gymPoint as xy, sportsGym } from './downtown-landmark-layout.js';

export function buildSportsGym(batch, geo, lamps, obstacles, signs) {
  const base = Math.max(...sportsGym.map((q) => groundY(geo, ...q))) + .3;
  const p = (u, v, y) => up(xy(u, v), base + y);
  const drift = (u) => (u + 74) * .028;
  prism(batch, sportsGym, base - 2.75, base + 1.3, '#aaa99b', null, litSurface.graniteFacing);
  prism(batch, sportsGym, base + 1.3, base + 11.6, '#7999a2', '#c1c6bc', litSurface.railGlass, .64, 0, 22);
  for (const [a, b, rise] of [[-75.8, -21, 3.2], [-21, 21, 1.1], [21, 108, 3.45]]) {
    const point = (u, t) => p(u, drift(u) + t * 31.8 + 4.5, 12.1 + rise * (1 - t * t));
    const material = rise > 2 ? '#dce1d8' : '#b8b9a9';
    for (let n = 0; n < 16; n++) {
      const left = mix(a, b, n / 16), right = mix(a, b, (n + 1) / 16);
      for (let j = 1; j <= 10; j++) {
        const t0 = 2 * (j - 1) / 10 - 1, t1 = 2 * j / 10 - 1;
        batch.top([point(left, t0), point(right, t0), point(right, t1), point(left, t1)], material,
          litSurface.railRoof, .68, [[left, t0 * 31], [right, t0 * 31], [right, t1 * 31], [left, t1 * 31]]);
      }
      for (const t of [-1, 1]) {
        const low = (u) => p(u, drift(u) + t * 31.8 + 4.5, 11.36);
        batch.face([low(left), point(left, t), point(right, t), low(right)], '#e1e0d3', litSurface.railEave);
      }
    }
    for (const u of [a, b]) {
      for (let j = 1; j <= 12; j++) {
        const q = point(u, (j - 1) / 6 - 1), r = point(u, j / 6 - 1);
        batch.face([[q[0], base + 11.33, q[2]], q, r, [r[0], base + 11.33, r[2]]], '#d0d5ce');
      }
    }
  }
  for (const side of [-1, 1]) {
    for (let u = -67; u <= 104; u += 7.2) {
      const v = drift(u) + 4.4 + side * 30.8;
      batch.face([p(u - 1.9, v, 1.35), p(u + .57, v + side * 1.12, 11.81),
        p(u + 3.0, v + side * .63, 11.81), p(u - .57, v, 1.35)], '#e2e0d1', litSurface.paleStone);
      if (Math.round((u + 67) / 7.2) % 3 === 0) lamps.add(...p(u, v + side * .65, 3.5), '#ffe8bf', 1.18);
    }
  }
  const apron = rect(xy, 105, 9.4, 7, 43);
  prism(batch, apron, base + 4.9, base + 5.72, '#c1c4bb', '#d2d6cb', litSurface.railEave);
  for (const v of [-9, 6, 21, 27]) {
    const [x, z] = xy(107.85, v);
    cylinder(batch, x, z, base, base + 5.04, .32, .24, '#c6c9bc', 10);
  }
  signs.push({ label: '综合健身馆', a: xy(108.56, 20), b: xy(108.56, -2),
    y: base + 5, height: .66, ink: '#4f676a' });
  obstacles.add(sportsGym, base + 15.55);
}
