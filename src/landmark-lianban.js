import { cylinder, groundY, litSurface, mix, prism } from './scenery-mesh.js';
import { rect, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { guomaoCentre, guomaoPodium, guomaoPoint as xy, guomaoShaft } from './lianban-layout.js';

const silver = '#c3c9c7', lightMetal = '#d0d4cd', recess = '#778889', red = '#a2443c';
const shaftWidth = 45.8, shaftDepth = 54.5, eaves = 158.5, crownHeight = 168;
const point = (u, v, y) => up(xy(u, v), y);

function curtainWall(batch, at, width, bottom, top, archRise, color, style) {
  for (let i = 0; i < 16; i++) {
    const ends = [i, i + 1].map((n) => {
      const u = n * width / 16, t = 2 * u / width - 1;
      return [u - width / 2, top + archRise * Math.sqrt(Math.max(0, 1 - t * t)), u];
    });
    const [[a, y0, u0], [b, y1, u1]] = ends;
    batch.face([at(a, bottom), at(a, y0), at(b, y1), at(b, bottom)], color, style, .65,
      [[u0, 0], [u0, y0 - bottom], [u1, y1 - bottom], [u1, 0]]);
  }
}

function shaft(batch, base, podiumTop) {
  const halfW = shaftWidth / 2, halfD = shaftDepth / 2, bevel = 1.65;
  const ring = [[-halfW + bevel, -halfD], [halfW - bevel, -halfD], [halfW, -halfD + bevel],
    [halfW, halfD - bevel], [halfW - bevel, halfD], [-halfW + bevel, halfD],
    [-halfW, halfD - bevel], [-halfW, -halfD + bevel]].map(([u, v]) => xy(u, v));
  prism(batch, ring, podiumTop - 1.1, base + eaves, silver, null, litSurface.crownMetal);
  const elevations = [
    [shaftWidth, (s, k, y) => point(s, -halfD - k, y)],
    [shaftWidth, (s, k, y) => point(s, halfD + k, y)],
    [shaftDepth, (s, k, y) => point(halfW + k, s, y)],
    [shaftDepth, (s, k, y) => point(-halfW - k, s, y)],
  ];
  for (const [span, at] of elevations) {
    const halfGlass = span * .225;
    curtainWall(batch, (s, y) => at(s, .08, y), halfGlass * 2, podiumTop + .3,
      base + 140, 7.6, '#497c8c', litSurface.railGlass);
    for (const side of [-1, 1]) {
      const a = side * (halfGlass + 2.6), b = side * (span / 2 - bevel - 1.4);
      for (let level = 0; level < 37; level++) {
        const y = base + 23.3 + level * 3.45;
        batch.face([at(a, .09, y), at(a, .09, y + 1.4), at(b, .09, y + 1.4), at(b, .09, y)],
          level % 8 === 0 ? '#344e56' : '#557480', litSurface.studioRibbon, .22);
        batch.face([at(a - side * .28, .17, y - .22), at(a - side * .28, .17, y),
          at(b + side * .28, .17, y), at(b + side * .28, .17, y - .22)], lightMetal);
      }
      for (const offset of [halfGlass + .67, span / 2 - 2.45]) {
        const s = side * offset;
        batch.face([at(s - .33, .12, podiumTop), at(s - .33, .12, base + 153.3),
          at(s + .33, .12, base + 153.3), at(s + .33, .12, podiumTop)], lightMetal, litSurface.crownMetal);
      }
    }
  }
  prism(batch, rect(xy, 0, 0, shaftWidth + .45, shaftDepth + .45), base + 156.95, base + eaves,
    '#b0b7b6', '#b4b8ac', litSurface.crownMetal);
}

function crown(batch, base, lamps) {
  const edge = [[-23.9, -27.95], [23.9, -27.95], [23.9, 27.95], [-23.9, 27.95]];
  const metal = '#84352f', lower = base + eaves + .72;
  for (let i = 0; i < edge.length; i++) {
    const [u, v] = edge[i], [w, q] = edge[(i + 1) % edge.length];
    const upper = (t) => lower + 2.8 + 5.55 * Math.max(0, 1 - Math.min(t, 1 - t) * 7);
    const p = (t, height) => point(mix(u, w, t), mix(v, q, t), height);
    const steps = [0, .14, .26, .38, .5, .62, .74, .86, 1];
    pathTube(batch, [p(0, lower), p(1, lower)], .41, red, 6, litSurface.crownMetal);
    pathTube(batch, steps.map((t) => p(t, upper(t))), .41, red, 6, litSurface.crownMetal);
    for (let k = 1; k < steps.length; k++) {
      const a = steps[k - 1], b = steps[k];
      pathTube(batch, k % 2 ? [p(a, lower), p(b, upper(b))] : [p(a, upper(a)), p(b, lower)],
        .26, metal, 6, litSurface.crownMetal);
    }
    pathTube(batch, [p(0, lower), p(0, upper(0))], .39, red, 6, litSurface.crownMetal);
    prism(batch, rect(xy, u * .956, v * .965, 1.4, 1.6), base + eaves - .12, lower,
      '#8d8982', null, litSurface.crownMetal);
    lamps.add(...p(0, base + crownHeight), '#ee6d57', .65);
  }
  prism(batch, rect(xy, 1.5, -.8, 29.5, 35.8), base + eaves, base + 164.3,
    '#a5b0b0', '#d4d3c7', litSurface.crownMetal, .42, 0, 22);
  prism(batch, rect(xy, 2, -1, 17.5, 23.5), base + 164.3, base + 164.88,
    '#a6aba9', '#c4c5bc', litSurface.crownMetal);
  for (const u of [-12.6, -7.7, 10.6]) {
    prism(batch, rect(xy, u, 18.9, 3.8, 2.65), base + eaves, base + 160.18,
      '#a6aca7', '#c6c6bb', litSurface.crownMetal);
  }
}

function podium(batch, geo, base, top, lamps, signs) {
  const bottom = Math.min(...guomaoPodium.map((p) => groundY(geo, ...p))) - .65;
  prism(batch, guomaoPodium, bottom, base + 3.6, recess, null, litSurface.shopfront, .48);
  prism(batch, guomaoPodium, base + 3.6, top - 1.3, '#a8b3b4', null, litSurface.crownMetal, .58);
  prism(batch, guomaoPodium, top - 1.3, top, lightMetal, '#b5b7aa', litSurface.crownMetal, .63, 0, 22);
  const northEdge = (s) => mix(-31, -32, (s + 30) / 83);
  for (const [centre, width, height, rise] of [[-24, 10.5, 14.3, 0], [33, 19.7, 7, 7.0]]) {
    curtainWall(batch, (u, y) => point(centre + u, northEdge(centre + u) - .13, y),
      width, base + 1.75, base + height, rise, '#517b89', litSurface.railGlass);
  }
  for (const u of [-17.5, 52.3]) {
    const column = xy(u, northEdge(u) + .65);
    cylinder(batch, ...column, bottom, top + 1.46, 2.38, 2.34, silver, 20, 0, '#a5aead', litSurface.crownMetal);
    cylinder(batch, ...column, top - .38, top + .34, 2.44, 2.44, '#a1453d', 20);
  }
  const awning = rect(xy, 32.9, -31.7, 22.1, 3.55);
  prism(batch, awning, base + 4.6, base + 5.48, '#9da9a7', '#c7c8b9', litSurface.railEave);
  lamps.add(...point(33, -33.1, base + 4.55), '#ffe7ba', 1.2);
  signs.push({ label: '厦门国贸大厦', a: xy(21.2, northEdge(21.2) - .23), b: xy(1, northEdge(1) - .23),
    y: base + 12.1, height: 2.18, ink: '#d2b574' });
}

export function buildLianbanGuomao(batch, geo, lamps, obstacles, signs) {
  const base = groundY(geo, ...guomaoCentre), podiumTop = base + 20.4;
  podium(batch, geo, base, podiumTop, lamps, signs);
  shaft(batch, base, podiumTop);
  crown(batch, base, lamps);
  obstacles.add(guomaoPodium, podiumTop + 1.5);
  obstacles.add(guomaoShaft, base + crownHeight);
  obstacles.add(rect(xy, 0, 0, 49, 57), base + crownHeight);
}
