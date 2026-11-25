import { cylinder, groundY, litSurface, mix, prism } from './scenery-mesh.js';
import { ellipse, groundPaving, localFrame, rect, up } from './landmark-forms.js';
import {
  exhibitionPoint as xy, exhibitionMain, exhibitionHalls, exhibitionLink,
  theatreCentre, theatreCourt, theatreFootprint, waterfrontFootprint, waterfrontSections,
} from './venue-layout.js';

const limestone = '#c6b9a7';
const trim = '#ddd9ca';
const metal = '#c6cdcc';
const glass = '#78969e';
const darkGlass = '#50686e';
const p = (u, v, y) => up(xy(u, v), y);

function block(batch, u, v, width, depth, bottom, top, wall, roof = wall, style = 0, seed = 0, roofStyle = 0) {
  prism(batch, rect(xy, u, v, width, depth), bottom, top, wall, roof, style, seed, 0, roofStyle);
}

function plinth(batch, geo, ring, rise = .4) {
  const samples = ring.map(([x, z]) => groundY(geo, x, z)).sort((a, b) => a - b);
  const level = samples[samples.length >> 1] + rise;
  prism(batch, ring, samples[0] - 1, level, '#aaa393', '#c0b8a8', 22);
  return level;
}

function roofBand(batch, inner, outer, color, style = 0) {
  for (let i = 0; i < inner.length; i++) {
    const next = (i + 1) % inner.length;
    batch.top([inner[i], inner[next], outer[next], outer[i]], color, style);
  }
}

function fascia(batch, lower, upper, color, style) {
  for (let i = 0; i < lower.length; i++) {
    const next = (i + 1) % lower.length;
    batch.face([lower[i], upper[i], upper[next], lower[next]], color, style);
  }
}

function exhibitionHall(batch, geo, lights, obstacles, signs, hall) {
  const { ring, height, roof, skylights, entry, label } = hall;
  const base = plinth(batch, geo, ring);
  const eave = base + height;
  prism(batch, ring, base, base + 8.5, glass, null, litSurface.railGlass, .37);
  prism(batch, ring, base + 8.5, base + 9.3, trim, null, litSurface.railEave);
  prism(batch, ring, base + 9.3, eave - 2.2, '#b3b0a9', null, litSurface.studioRibbon, .3);
  prism(batch, ring, eave - 2.2, eave, '#bfc4be', metal, litSurface.crownMetal, .24, 0, litSurface.railRoof);
  const [u, v, width, depth] = roof;
  block(batch, u, v, width, depth, eave, eave + .48, '#a3acaa', '#d9dedb', 0, .86, litSurface.railRoof);
  block(batch, u, v, width * .93, 2.9, eave + .49, eave + .82, '#909b9c');
  for (let j = 0; j < skylights; j++) {
    const along = u + (j + .5 - skylights * .5) * width / skylights;
    block(batch, along, v, Math.min(8, width * .1), 3.3, eave + .82, eave + 1.85, '#a0abaa', '#aebbbd');
    block(batch, along, v + 2.7, 3.0, 1.3, eave + .49, eave + 1.4, '#79878b', '#adb9b8');
  }
  if (entry !== undefined) {
    const side = Math.sign(v - entry);
    block(batch, u, entry - side * 1.8, width + 2, 4.3, base + 5.8, base + 6.6, trim, metal);
    for (let i = -5; i <= 5; i++) {
      const x = u + i * 9.4, z = entry - side * 2.5;
      block(batch, x, z, .68, .8, base, base + 5.85, limestone);
      lights.add(...p(x + 2.7, z, base + 5.65), '#ffe5bf', 1.12);
    }
    signs.push({ label, a: xy(u + side * 4.5, entry - side * .7), b: xy(u - side * 4.5, entry - side * .7),
      y: base + 10.8, height: 4.8, ink: '#d8a64a' });
  }
  obstacles.add(ring, eave + 1.9);
}

function mainHall(batch, geo, lights, obstacles, signs) {
  const base = plinth(batch, geo, exhibitionMain, .75);
  prism(batch, exhibitionMain, base, base + 5.6, '#a8a596', null, litSurface.studioRibbon, .61);
  prism(batch, exhibitionMain, base + 5.6, base + 20.6, glass, null, litSurface.railGlass, .42);
  prism(batch, exhibitionMain, base + 20.6, base + 23.5, limestone, '#afaaa1', litSurface.railEave, .2, 0, 22);
  const [originX, originZ] = xy(0, 0);
  const [eastX, eastZ] = xy(1, 0);
  const dx = eastX - originX, dz = eastZ - originZ;
  const angle = Math.atan2(dz, dx);
  for (const [a, b] of [[7, 8], [8, 9], [9, 10], [10, 11]]) {
    const start = exhibitionMain[a], end = exhibitionMain[b];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const divisions = Math.round(length / 8.6);
    for (let i = 0; i < divisions; i++) {
      const t = (i + .4) / divisions;
      const x = mix(start[0], end[0], t) + dx * .55, z = mix(start[1], end[1], t) + dz * .55;
      const shape = rect(localFrame([x, z], angle), 0, 0, 2.9, 1.27);
      prism(batch, shape, base, base + 20.7, trim, null, litSurface.portico);
      if (i % 2 === 0) lights.add(x + dx, base + 8.4, z + dz, '#ffe1ab', 1.48);
    }
  }
  // Shallow sheet-metal slopes and darker rooftop garden courts flank the raised hall.
  for (const [v, depth] of [[-117, 125], [150, 138]]) {
    block(batch, 0, v, 114, depth, base + 23.5, base + 24.25, '#b2b3a7', '#a6ada8', 0, .77, litSurface.railRoof);
    block(batch, 9, v, 67, depth - 13, base + 24.25, base + 24.43, '#7d8870', '#808572', 0, .22, 22);
    for (const u of [-37, 45]) {
      const lower = base + 24.45;
      const edge = u + Math.sign(u) * 9;
      batch.top([p(u, v - depth / 2, lower + 2.1), p(edge, v - depth / 2, lower),
        p(edge, v + depth / 2, lower), p(u, v + depth / 2, lower + 2.1)],
        '#bcc1b6', litSurface.railRoof, .61);
      block(batch, u, v, .65, depth, lower, lower + 2.13, metal);
    }
    for (const offset of [-.33, 0, .33])
      block(batch, 30, v + offset * depth, 6.7, 3.5, base + 24.5, base + 26.15, '#939d98', '#c3c9c2');
  }
  const oval = (rx, rz, y) => ellipse(xy, 12, 18, rx, rz, 48).map((point) => up(point, base + y));
  const shoulder = oval(44, 68, 29.4);
  const lower = oval(38, 61, 24.1);
  roofBand(batch, shoulder, lower, trim);
  fascia(batch, shoulder, oval(44, 68, 30.1), '#b9c2c1', litSurface.railEave);
  prism(batch, ellipse(xy, 12, 18, 37.4, 56.7, 48), base + 28, base + 40.7,
    darkGlass, null, litSurface.railGlass, .78);
  roofBand(batch, oval(34, 54, 42.6), oval(42, 63, 38), '#bbbfaf', litSurface.railRoof);
  batch.top(oval(34, 54, 42.6), '#bfc2b6', litSurface.railRoof);
  block(batch, -9, 18, 5.5, 26, base + 42.6, base + 43.35, '#a9b2ae', '#c9ceca');
  for (const v of [-17, 4, 29, 50]) lights.add(...p(52.1, v, base + 29.5), '#e6eff0', 1.45);

  block(batch, -103.5, 19, 3.3, 67, base + 16.7, base + 21.8, '#c2ad91', trim);
  block(batch, -111, 19, 14.8, 72, base + 7.1, base + 8.3, trim, metal, litSurface.railEave);
  for (let i = -4; i <= 4; i++) {
    block(batch, -116.8, 19 + i * 8, 1.05, 1.2, base, base + 7.18, limestone);
    lights.add(...p(-115.4, 22 + i * 8, base + 6.9), '#ffdfaa', 1.4);
  }
  signs.push({ label: '厦门国际会议展览中心', a: xy(-105.21, -3), b: xy(-105.21, 41),
    y: base + 17, height: 4.55, ink: '#8c3131' });
  obstacles.add(exhibitionMain, base + 26.3);
  obstacles.add(ellipse(xy, 12, 18, 44, 68, 48), base + 43.35);
}

function waterfront(batch, geo, lights, obstacles, signs) {
  const base = plinth(batch, geo, waterfrontFootprint);
  prism(batch, waterfrontFootprint, base, base + 4.2, glass, '#c9c6b9', litSurface.railGlass, .76);
  for (let level = 0; level < 3; level++) {
    const ring = [
      ...waterfrontSections.map(([v, west]) => xy(west + 1, v)),
      ...waterfrontSections.toReversed().map(([v, west, east]) => xy(mix(east, west, .18 + level * .235), v)),
    ];
    const y = base + 4.2 + level * 3.2;
    prism(batch, ring, y, y + .64, trim, null, litSurface.railEave);
    prism(batch, ring, y + .64, y + 3.2, glass, '#b6bcad', litSurface.railGlass, .12 * level, 0, 22);
    obstacles.add(ring, y + 3.2);
  }
  for (const [v, , east] of waterfrontSections.slice(1, -1)) {
    const [x, z] = xy(east - 2, v);
    lights.add(x, base + 4.36, z, '#ffedc6', 1.35);
  }
  block(batch, 94, 20, 91, 26, base + 7.8, base + 13.8, glass, metal, litSurface.railGlass, .49);
  block(batch, 132, 20, 19.5, 28, base, base + 14.4, '#77989e', '#9cabaa', litSurface.railGlass, .66);
  block(batch, 141.6, 20, 3.6, 31.5, base + 9.8, base + 13.2, trim, metal);
  signs.push({ label: '厦门国际会议展览中心', a: xy(143.43, 34), b: xy(143.43, 6),
    y: base + 10.06, height: 2.5, ink: '#8c3131' });
  obstacles.add(exhibitionLink, base + 14.4);
}

export function buildExhibition(batch, geo, lights, obstacles, signs) {
  groundPaving(batch, geo, xy, [-281, -104, -35, 71], '#b0aea2');
  groundPaving(batch, geo, xy, [143, 296, 6, 35], '#b8b4a6');
  for (const hall of exhibitionHalls) exhibitionHall(batch, geo, lights, obstacles, signs, hall);
  mainHall(batch, geo, lights, obstacles, signs);
  waterfront(batch, geo, lights, obstacles, signs);
}

// Each edge of the theatre rises gently toward the two corner tips.
function theatreRim(halfWidth, halfDepth, height, lift) {
  const [u, v] = theatreCentre;
  const edges = [[-halfWidth, -halfDepth], [halfWidth, -halfDepth],
    [halfWidth, halfDepth], [-halfWidth, halfDepth]];
  return edges.flatMap(([x, z], i) => {
    const end = edges[(i + 1) % edges.length];
    return Array.from({ length: 12 }, (_, step) => {
      const t = step / 12;
      return p(u + mix(x, end[0], t), v + mix(z, end[1], t), height + lift * Math.abs(1 - 2 * t) ** 3);
    });
  });
}

export function buildTheatre(batch, geo, lights, obstacles, signs) {
  const [u, v] = theatreCentre;
  groundPaving(batch, geo, xy, theatreCourt, '#b6ada0');
  const deck = rect(xy, u, v, 217.8, 123.2);
  const base = plinth(batch, geo, deck, .8);
  const body = rect(xy, u, v, 193, 98);
  prism(batch, body, base, base + 18.9, glass, null, litSurface.railGlass, .91);
  block(batch, u, v, 207, 111, base + 19.75, base + 20.94, limestone, trim, litSurface.railEave);
  block(batch, u, v, 190.2, 95, base + 18.9, base + 27.0, '#817e72');

  for (const side of [-1, 1]) {
    for (let j = -7; j <= 7; j++) {
      const x = u + j * 13.3;
      block(batch, x, v + side * 54, 2.15, 2.6, base, base + 20.1, limestone, trim, litSurface.portico);
      if (j % 2 === 0) lights.add(...p(x, v + side * 55.8, base + .67), '#ffdfab', 1.65);
    }
    for (let j = -4; j <= 4; j++) {
      const z = v + j * 12.2;
      block(batch, u + side * 101.5, z, 2.6, 2.1, base, base + 20.1, limestone, trim, litSurface.portico);
      if (j % 2 === 0) lights.add(...p(u + side * 103.2, z, base + .67), '#ffdeb0', 1.72);
    }
  }
  for (const [halfWidth, halfDepth, innerHeight, outerHeight, lift] of [
    [102.9, 55.2, 19.9, 21.0, .72],
    [104.6, 57.2, 22.0, 24.0, 1.19],
    [106.7, 59.65, 25.05, 27.7, 1.9],
  ]) {
    const inner = theatreRim(95.5, 48, base + innerHeight, .43);
    const underside = theatreRim(halfWidth, halfDepth, base + outerHeight, lift);
    const top = theatreRim(halfWidth, halfDepth, base + outerHeight + .49, lift);
    roofBand(batch, inner, underside, '#c1b7a6', litSurface.railEave);
    fascia(batch, underside, top, '#dfd3b8', litSurface.canopyLight);
    roofBand(batch, theatreRim(94.8, 47.5, base + outerHeight + .59, .21), top, trim, litSurface.railRoof);
    fascia(batch, theatreRim(95.5, 48, base + innerHeight - 1.1, .43), inner, '#a79d8e', litSurface.railEave);
  }
  block(batch, u, v, 190.1, 95.5, base + 26.4, base + 28.32, '#bdc6c2', '#aab6b6', 0, .78, litSurface.railRoof);
  for (const side of [-1, 1]) {
    for (const offset of [-57, 57]) {
      block(batch, u + offset, v + side * 39.2, 25.3, 1.6, base + 28.32, base + 29.23, '#b4bebc', '#d4d7cf');
    }
  }

  // Sea-facing portico, its peaked rain canopy and a recessed door line.
  const front = u + 101.8;
  const peak = p(u + 95.7, v, base + 11.6);
  const frontPeak = p(u + 109.5, v, base + 10.3);
  for (const side of [-1, 1]) {
    const corner = p(u + 109.5, v + side * 12.6, base + 8.1);
    batch.top([peak, frontPeak, corner, p(u + 95.7, v + side * 12.6, base + 8.9)], '#d2d0c1', litSurface.railRoof);
    batch.face([frontPeak, corner, [corner[0], corner[1] - .38, corner[2]],
      [frontPeak[0], frontPeak[1] - .38, frontPeak[2]]], trim, litSurface.canopyLight);
    block(batch, front, v + side * 12.57, .77, 1.22, base, base + 8.5, limestone, trim, litSurface.portico);
  }
  block(batch, front + 5.8, v, 7.6, 43.5, base - .85, base - .19, '#b7afa2', '#cac1b1');
  block(batch, front + 8.8, v, 4.2, 43.5, base - 1.18, base - .51, '#a59d90', '#bfb7a7');
  block(batch, u + 104.55, v, .28, 24.4, base + 21.04, base + 24.1, '#c9bc9d', null, litSurface.railEave);
  signs.push({ label: '海峡大剧院', a: xy(u + 104.75, v + 8.6), b: xy(u + 104.75, v - 8.6),
    y: base + 21.1, height: 2.85, ink: '#463c32' });
  for (const offset of [-42, 42]) {
    const [x, z] = xy(353, v + offset);
    const ground = groundY(geo, x, z) + .22;
    block(batch, 353, v + offset, 12, 11, ground - .65, ground + .45, '#a19c8c', '#747d57');
    cylinder(batch, x, z, ground, ground + 4.1, .13, .065, '#969d98', 7);
    cylinder(batch, x, z, ground + 3.93, ground + 4.13, .20, .29, trim, 8);
    lights.add(x, ground + 3.9, z, '#ffe5c0', 1.35);
  }
  obstacles.add(theatreFootprint, base + 30.2);
}
