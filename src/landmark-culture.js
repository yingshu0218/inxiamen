import { cylinder, groundY, litSurface, mix, prism } from './scenery-mesh.js';
import { groundPaving, rect, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { cultureHalls, culturePoint as xy } from './venue-layout.js';

const stone = '#c7c5b9';
const frame = '#dddacf';
const roofMetal = '#bbc4c3';
const glass = '#78969f';
const p = (u, v, y) => up(xy(u, v), y);
const skylights = [
  [[-6, 0, 9, 72]],
  [[5, -11, 15, 58]],
  [[-7, 18, 9, 28]],
  [[5, -34, 11, 40], [5, 31, 11, 40]],
];

function block(batch, u, v, width, depth, bottom, top, wall, roof = wall, style = 0, seed = 0, roofStyle = 0) {
  prism(batch, rect(xy, u, v, width, depth), bottom, top, wall, roof, style, seed, 0, roofStyle);
}

function cultureHall(batch, geo, lights, obstacles, signs, hall, index) {
  const { u, v, width, depth, height, ring, entrance, name } = hall;
  const terrain = ring.map((point) => groundY(geo, ...point));
  const floor = groundY(geo, ...xy(u, v)) + .32;
  const roof = floor + height;
  // The low factory sheds share the same orthogonal structure, with separate roof heights and entries.
  const glazing = index === 3 ? glass : '#9daeb2';
  prism(batch, ring, Math.min(...terrain, floor) - .9, floor + .94, '#a6a69b', null, 22);
  prism(batch, ring, floor + .94, floor + 6.3, glazing, null, litSurface.railGlass, .16 + .18 * index);
  prism(batch, ring, floor + 6.3, floor + 7.4, stone, null, litSurface.graniteFacing);
  prism(batch, ring, floor + 7.4, roof - 1.35, index === 3 ? glass : stone, null,
    index === 3 ? litSurface.railGlass : litSurface.studioRibbon, .39 + .08 * index);
  prism(batch, rect(xy, u, v, width + 1.9, depth + 1.9), roof - 1.35, roof, frame, roofMetal,
    litSurface.crownMetal, .68, 0, litSurface.railRoof);

  const ribs = 6;
  for (let j = 0; j < ribs; j++) {
    const z = v + ((j + .5) / ribs - .5) * (depth - 7);
    block(batch, u, z, width - 9.0, .45, roof, roof + .41, '#adb8b7');
    for (const offset of [-.34, .34]) {
      const x = u + offset * width;
      block(batch, x, z + 2.35, 2.2, 2.8, roof, roof + .58, '#8a999b', '#9baaa9');
      block(batch, x, z + 2.35, 1.7, 1.83, roof + .58, roof + .98, '#a5aeaa', '#c6cbc4');
    }
  }
  for (const [du, dv, w, d] of skylights[index]) {
    block(batch, u + du, v + dv, w, d, roof, roof + .58, '#82989a', '#7b929b', 0, .94, litSurface.railRoof);
    for (let row = -d / 2 + 6; row <= d / 2 - 1; row += 6)
      block(batch, u + du, v + dv + row, w + .16, .24, roof + .58, roof + .72, '#b7bfbb');
  }
  obstacles.add(ring, roof + .98);
  if (entrance === 'east') {
    const front = u + width / 2;
    const door = v + (index === 3 ? -21 : 39);
    groundPaving(batch, geo, xy, [front + 5.2, 118, door - 13, door + 13], '#b8b5a6');
    groundPaving(batch, geo, xy, [131.5, 164, door - 13, door + 13], '#b8b5a6');
    block(batch, front + 2.7, door, 5.4, 29, floor + 5.65, floor + 7.1, frame, roofMetal, litSurface.railEave);
    block(batch, front + .18, door, .38, 22.5, floor + .1, floor + 5.65, glass, glass, litSurface.railGlass, .62);
    for (const side of [-1, 1]) {
      block(batch, front + 4.32, door + side * 12.8, 1.04, .94, floor - .3, floor + 5.7, stone, frame);
      lights.add(...p(front + 4.1, door + side * 7.4, floor + 5.46), '#f8dfb9', 1.18);
      block(batch, front + 4.7, door + side * 19.8, 9.2, 4.2, floor - 1.26, floor + .32, '#9f9e92', '#7c8b68');
    }
    block(batch, front + 2.52, door, 5.4, 25.5, floor - 1.6, floor + .14, '#9c9b8e', '#bbb7a6');
    signs.push({ label: name, a: xy(front + 5.43, door + 4.6), b: xy(front + 5.43, door - 4.6),
      y: floor + 5.72, height: 1.31, ink: index === 3 ? '#34454e' : '#853a34' });
    obstacles.add(rect(xy, front + 2.7, door, 5.4, 29), floor + 7.1);
    return;
  }
  const side = -Math.sign(v), front = v + side * depth / 2;
  const door = u + (index === 0 ? -11 : 12);
  block(batch, door, front + side * 2.55, 32, 5.1, floor + 4.45, floor + 5.77, frame, roofMetal, litSurface.railEave);
  for (const offset of [-13.8, -7.8, 7.8, 13.8])
    block(batch, door + offset, front + side * 4.1, .68, .68, floor - .4, floor + 4.5, stone, frame);
  block(batch, door, front + side * 2.6, 29.2, 5.2, floor - 1.6, floor + .12, '#a4a196', '#b9b6a8');
  lights.add(...p(door, front + side * 4.0, floor + 4.32), '#ffe3bd', 1.45);
  signs.push({ label: name, a: xy(door - side * 4.2, front + side * 5.14), b: xy(door + side * 4.2, front + side * 5.14),
    y: floor + 4.54, height: 1.15, ink: index === 0 ? '#486678' : '#734940' });
  obstacles.add(rect(xy, door, front + side * 2.55, 32, 5.1), floor + 5.77);
}

function passageCanopy(batch, geo, lights, obstacles) {
  groundPaving(batch, geo, xy, [-156.5, 138.5, -4.55, 22.95], '#bbb9aa');
  const stations = [-128, -52, 24, 100, 133].map((u, i) => ({
    u, floor: groundY(geo, ...xy(u, 9.2)), side: i % 2 === 0 ? 1 : -1,
  }));
  for (const [i, { u, floor, side }] of stations.entries()) {
    const mast = p(u, 9.2 + side * 10.9, floor + 29.8);
    cylinder(batch, mast[0], mast[2], floor - 1.5, mast[1], .52, .21, '#c7ccca', 10);
    cylinder(batch, mast[0], mast[2], floor - 1.45, floor + .24, .91, .75, '#a6a69d', 10);
    pathTube(batch, [mast, p(u, 9.2 - side * 9.5, floor + 13.65)], .075, '#b1bebd', 5);
    obstacles.add(rect(xy, u, 9.2 + side * 10.9, 1.8, 1.8), mast[1]);
    lights.add(...p(u + .5, 9.2, floor + 13.2), '#f4edd6', 1.28);
    for (const neighbor of [stations[i - 1], stations[i + 1]]) {
      if (!neighbor) continue;
      pathTube(batch, [mast, p(mix(u, neighbor.u, .42), 9.2 + side * 10, mix(floor, neighbor.floor, .42) + 12.66)],
        .078, '#c3c8c2', 5);
    }
  }
  // The white fabric sags between masts and lifts at alternating corners.
  for (let span = 0; span < stations.length - 1; span++) {
    const left = stations[span], right = stations[span + 1];
    const point = (s, t) => {
      const across = 2 * t - 1;
      const lift = 2.2 * across * mix(left.side, right.side, s);
      const y = mix(left.floor, right.floor, s) + 13.9 + lift - 1.75 * Math.sin(s * Math.PI) + 1.25 * across ** 2;
      return p(mix(left.u, right.u, s), 9.2 + across * (9.7 - 1.5 * Math.sin(s * Math.PI)), y);
    };
    for (let i = 0; i < 12; i++) {
      const a = i / 12, b = (i + 1) / 12;
      for (let j = 0; j < 4; j++) {
        const s = j / 4, t = (j + 1) / 4;
        batch.top([point(a, s), point(b, s), point(b, t), point(a, t)],
          j === 1 || j === 2 ? '#d9dcd4' : '#d1d4ca');
      }
    }
    for (const side of [0, 1]) {
      const edge = Array.from({ length: 13 }, (_, i) => point(i / 12, side));
      pathTube(batch, edge, .112, '#aebcbc', 5);
    }
    obstacles.add(rect(xy, (left.u + right.u) / 2, 9.2, right.u - left.u, 19.4),
      Math.max(left.floor, right.floor) + 17.4);
  }
}

export function buildCultureCentre(batch, geo, lights, obstacles, signs) {
  groundPaving(batch, geo, xy, [118, 131.5, -123, 126], '#a9a99d');
  for (const [index, hall] of cultureHalls.entries())
    cultureHall(batch, geo, lights, obstacles, signs, hall, index);
  passageCanopy(batch, geo, lights, obstacles);
}
