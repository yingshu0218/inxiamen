import * as THREE from 'three';
import { rect, up } from './landmark-forms.js';
import { cylinder, groundY, litSurface, mix, prism, randomSource } from './scenery-mesh.js';
import { offset } from './old-town-layout.js';
import {
  northSquareLevel, plan, railDatum, railHeight, southSquareLevel, stationPoint,
  stationTracks, trackGrade, yardSections,
} from './railway-layout.js';

const shell = '#e5e5dd', edge = '#f2f0e5', soffit = '#b7c1c2', frame = '#9baaad';
const stone = '#b9b8af', trim = '#d4d6cc', glass = '#376276';
const roofHalfWidth = 65;
const archBase = railDatum + 6.1;
const uv = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
const position = (u, v, y) => up(stationPoint(u, v), y);
const footprint = ring => ring.map(([u, v]) => stationPoint(u, v));

function block(batch, u, v, w, d, y0, y1, wall, roof = wall, style = 0) {
  prism(batch, rect(stationPoint, u, v, w, d), y0, y1, wall, roof, style);
}

function slab(batch, u0, u1, v0, v1, y, color, style = 0, seed = 0) {
  batch.top([
    position(u0, v0, y), position(u1, v0, y), position(u1, v1, y), position(u0, v1, y),
  ], color, style, seed, uv(u0, v0, u1, v1));
}

// The front eaves rise in the middle before flattening into upturned tips.
function roofHeight(u) {
  const t = Math.min(1, Math.abs(u) / roofHalfWidth);
  return railDatum + 18.4 + 15.9 * Math.cos(t * Math.PI / 2) ** 2 + 2.4 * t ** 10;
}

function roofEdge(u, side) {
  const t = Math.min(1, Math.abs(u) / roofHalfWidth);
  return side > 0 ? 94.2 - .6 * t ** 2 : -98.5 + 9 * t ** 2;
}

function roofHeightAtDepth(u, v) {
  const north = roofEdge(u, -1), south = roofEdge(u, 1);
  return roofHeight(u) + 1.65 * Math.sin(Math.PI * (v - north) / (south - north));
}

function roofPoint(u, t, lift = 0) {
  const v = mix(roofEdge(u, -1), roofEdge(u, 1), t);
  return position(u, v, roofHeight(u) + 1.65 * Math.sin(t * Math.PI) + lift);
}

function hallRoof(batch) {
  const sections = 52;
  for (let i = 0; i < sections; i++) {
    const u = -roofHalfWidth + 2 * roofHalfWidth * i / sections;
    const next = u + 2 * roofHalfWidth / sections;
    for (let j = 0; j < 16; j++) {
      const a = j / 16, b = (j + 1) / 16;
      batch.top([roofPoint(u, a), roofPoint(next, a), roofPoint(next, b), roofPoint(u, b)],
        shell, litSurface.railRoof, 0, uv(u, a * 190, next, b * 190));
    }
    for (const t of [0, 1]) {
      const inset = t === 0 ? .040 : .960;
      const a = roofPoint(u, t), b = roofPoint(next, t);
      const c = roofPoint(u, t, -.68), d = roofPoint(next, t, -.68);
      batch.face(t === 0 ? [c, a, b, d] : [d, b, a, c], edge, litSurface.railEave);
      batch.top([c, d, roofPoint(next, inset, -1.12), roofPoint(u, inset, -1.12)],
        soffit, litSurface.railEave);
    }
  }
  // The raised central skylight reads as a row of transverse bays from the air.
  const half = 10.6, start = .16, end = .84, bays = 36;
  for (const side of [-1, 1]) {
    const u = side * half;
    batch.face([roofPoint(u, start), roofPoint(u, start, 1.58), roofPoint(u, end, 1.58), roofPoint(u, end)], trim);
  }
  for (let i = 0; i < bays; i++) {
    const a = mix(start, end, i / bays), b = mix(start, end, (i + 1) / bays), rail = b - .0024;
    batch.top([roofPoint(-half, a, 1.56), roofPoint(half, a, 1.56), roofPoint(half, rail, 1.56), roofPoint(-half, rail, 1.56)],
      i % 4 === 1 ? '#939f9d' : '#7c8e92', litSurface.railGlass, .2, uv(0, 0, 21, 3.4));
    batch.top([roofPoint(-half, rail, 1.69), roofPoint(half, rail, 1.69), roofPoint(half, b, 1.69), roofPoint(-half, b, 1.69)], edge);
  }
  for (const t of [start, end]) batch.face([
    roofPoint(-half, t), roofPoint(half, t), roofPoint(half, t, 1.60), roofPoint(-half, t, 1.60),
  ], trim);
  for (const [u, v] of [[-31, -55], [-31, -23], [-31, 12], [-31, 47], [31, -55], [31, -23], [31, 12], [31, 47]]) {
    const y = roofHeight(u) + 1.5;
    block(batch, u, v, 2.6, 1.45, y - .32, y + .42, '#aeb4b2', '#d7d8d0');
  }
}

function facadePoint(u, side, y, inset = 0) {
  return position(u, roofEdge(u, side) - side * (5.5 + inset + (y - archBase) * .046), y);
}

function archLine(u) {
  const x = Math.abs(u);
  if (x < 39) return archBase + 19.1 * Math.cos(x * Math.PI / 78) ** 1.12;
  return archBase + 11.8 * ((x - 39) / 22) ** 1.14;
}

function stationFacade(batch, side) {
  const point = (u, y, inset = 0) => facadePoint(u, side, y, inset);
  const archThickness = u => 2.0 + 2.2 * Math.exp(-((Math.abs(u) - 39) ** 2) / 96);
  for (let i = 0; i < 64; i++) {
    const a = -61 + i * 122 / 64, b = a + 122 / 64;
    const topA = roofHeight(a) - 2.48, topB = roofHeight(b) - 2.48;
    const outer = u => position(u, roofEdge(u, side) - .21 * side, roofHeight(u) - .68);
    batch.face([outer(a), outer(b), point(b, topB, -.28), point(a, topA, -.28)], '#e0ded3', litSurface.railEave);
    batch.face([point(a, archBase, .14), point(b, archBase, .14), point(b, topB, .14), point(a, topA, .14)],
      glass, litSurface.railGlass, .38, [[a, 0], [b, 0], [b, topB - archBase], [a, topA - archBase]]);
    const ribbonA = archLine(a), ribbonB = archLine(b);
    batch.face([point(a, ribbonA, -.25), point(b, ribbonB, -.25),
      point(b, Math.min(topB + .25, ribbonB + archThickness(b)), -.38),
      point(a, Math.min(topA + .25, ribbonA + archThickness(a)), -.38)], edge, litSurface.railEave);
    const strip = Math.min(a + .105, b);
    batch.face([point(a, archBase), point(strip, archBase), point(strip, ribbonA), point(a, ribbonA)], frame);
  }
  for (let a = -53.9; a < 54; a += 2.76) {
    const topU = a * 1.11, y = archLine(a) + archThickness(a) - .25;
    const height = roofHeight(topU) - 2.35;
    if (y < height) batch.face([point(a, y, -.25), point(a + .33, y, -.26),
      point(topU + .41, height, -.88), point(topU, height, -.88)], shell, litSurface.railEave);
  }
  for (const wing of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const y = archBase + 1.5 + k * 2.88, u = wing * (43.5 + k * 3.4);
      batch.face([point(u, y, -.18), point(61 * wing, y, -.18),
        point(61 * wing, y + .32, -.18), point(u, y + .32, -.18)], trim, litSurface.railEave);
    }
  }
  for (const u of [-61, 61]) {
    const y = roofHeight(u) - .65;
    batch.face([point(u, archBase), point(u, y), position(u, roofEdge(u, side), y),
      position(u, roofEdge(u, side) - 5 * side, archBase)], shell, litSurface.railEave);
  }
}

function hall(batch, lamps, obstacles) {
  const podium = rect(stationPoint, 0, -2, 120, 172);
  prism(batch, podium, railDatum + 4.65, archBase, stone, trim, 0, .1, 0, 22);
  for (const side of [-1, 1]) {
    const v = side * 78;
    block(batch, 0, v, 124, 23, railDatum - 3, railDatum + 4.65, stone, trim, litSurface.graniteFacing);
    stationFacade(batch, side);
    for (let u = -51; u <= 51; u += 10.2) lamps.add(...position(u, side * 90, archBase + .8), '#fff0d2', 1.12);
    for (let v = -79; v < 86; v += 5.5) {
      const a = v, b = Math.min(86, v + 5.5), u = side * 61.2;
      const yA = roofHeightAtDepth(u, a) - .17, yB = roofHeightAtDepth(u, b) - .17;
      batch.face([position(u, a, archBase), position(u, b, archBase), position(u, b, yB), position(u, a, yA)],
        '#83a7b2', litSurface.railGlass, .53, uv(v, 0, b, yA - archBase));
      block(batch, u, a, 1.0, .18, archBase, yA - .29, frame);
    }
  }
  hallRoof(batch);
  obstacles.add(footprint(plan.hall), roofHeight(0) + 2.6);
}

function canopies(batch, lamps, obstacles) {
  const bands = [-49, -28, -5, 21, 44, 59.8];
  const arch = t => Math.sin(Math.PI * t) * 1.55;
  const roofY = (u, t) => trackGrade(u) + 7.0 + arch(t);
  for (const [i, [, , start, end]] of plan.platforms.entries()) {
    const a = bands[i], b = bands[i + 1], centre = (start + end) / 2;
    const sheet = i % 2 ? '#d7d9d3' : '#e2e0d7';
    for (const [first, last] of [[-223.4, -59.8], [59.8, 222.2]]) {
      const point = (u, t, lift = 0) => position(u, mix(a + .64, b - .64, t), roofY(u, t) + lift);
      for (let j = 0; j < 10; j++) {
        const l = j / 10, r = (j + 1) / 10;
        const tip = t => 3.25 * Math.sin(Math.PI * t);
        const west = t => first < 0 ? first - tip(t) : first;
        const east = t => last > 0 ? last + tip(t) : last;
        const lip = first < 0 ? west : east;
        batch.top([point(west(l), l), point(east(l), l), point(east(r), r), point(west(r), r)],
          sheet, litSurface.railRoof, .64, uv(first, l * (b - a), last, r * (b - a)));
        batch.face([point(lip(l), l, -.28), point(lip(l), l), point(lip(r), r), point(lip(r), r, -.28)], edge);
      }
      if (i < plan.platforms.length - 1) {
        const y0 = roofY(first, 0) - .04, y1 = roofY(last, 0) - .04;
        batch.top([position(first, b - .65, y0), position(last, b - .65, y1),
          position(last, b + .65, y1), position(first, b + .65, y0)],
        '#80999e', litSurface.railGlass, .1, uv(first, 0, last, 1.3));
        for (let u = first + 3; u < last; u += 5) slab(batch, u, u + .17, b - .70, b + .70, roofY(u, 0) + .03, trim);
      }
      for (let u = first + 8; u < last - 3; u += 19.8) {
        const y = trackGrade(u);
        block(batch, u, centre, .52, .62, y + 1.23, y + 7.05, '#afb9b6');
        block(batch, u, centre, .75, 7.1, y + 6.53, y + 6.80, frame);
        for (const v of [centre - 2.3, centre + 2.3]) {
          slab(batch, u - 2.6, u + 2.6, v - .20, v + .20, y + 6.46, '#c6d2ca', litSurface.canopyLight);
          if (u < first + 27 || u > last - 26) lamps.add(...position(u, v, y + 6.3), '#dceff5', .9);
        }
      }
      obstacles.add(rect(stationPoint, (first + last) / 2, (a + b) / 2, last - first, b - a), railDatum + 9.2);
    }
  }
}

function platforms(batch) {
  for (const [i, [a, b, l, r]] of plan.platforms.entries()) {
    const part = (u, v, h) => position(u, v, trackGrade(u) + h);
    const p = [part(a, l, 1.37), part(b, l, 1.37), part(b, r, 1.37), part(a, r, 1.37)];
    batch.top(p, '#a8a9a0', 17, i * .16, uv(a, l, b, r));
    for (let j = 0; j < 4; j++) {
      const c = p[j], d = p[(j + 1) % 4];
      batch.face([c, d, [d[0], d[1] - 1.47, d[2]], [c[0], c[1] - 1.47, c[2]]], '#92928a');
    }
    for (const v of [l + .47, r - .76]) batch.top([
      part(a + .4, v, 1.394), part(b - .4, v, 1.394), part(b - .4, v + .27, 1.394), part(a + .4, v + .27, 1.394),
    ], '#c6a655', 17, .2, uv(a, v, b, v + .27));
    for (const u of [a + 7.5, b - 7.5]) {
      block(batch, u, (l + r) / 2, .39, .45, trackGrade(u) + 1.38, trackGrade(u) + 4.05, frame);
      block(batch, u, (l + r) / 2, .27, 2.6, trackGrade(u) + 3.48, trackGrade(u) + 4.10, '#285b8b');
    }
  }
}

function railwayBed(batch, geo) {
  const rng = randomSource(1957);
  for (let i = 1; i < yardSections.length; i++) {
    const [a, l, r] = yardSections[i - 1], [b, nextL, nextR] = yardSections[i];
    const rows = Math.ceil((b - a) / 10);
    for (let j = 0; j < rows; j++) {
      const t0 = j / rows, t1 = (j + 1) / rows;
      const section = (t, v0, v1, y = 0) => {
        const p = stationPoint(mix(a, b, t), mix(v0, v1, t));
        return up(p, railHeight(geo, ...p) + y);
      };
      const p = section(t0, l, nextL), q = section(t1, l, nextL);
      const r0 = section(t0, r, nextR), r1 = section(t1, r, nextR);
      batch.top([p, q, r1, r0], '#8c8478', litSurface.railBallast);
      for (const [e, f] of [[p, q], [r0, r1]]) batch.face([
        e, f, [f[0], groundY(geo, f[0], f[2]) - .48, f[2]], [e[0], groundY(geo, e[0], e[2]) - .48, e[2]],
      ], '#797367');
    }
  }
  for (const track of stationTracks) {
    const at = (p, width, lift) => {
      const x = p.x + p.rx * width, z = p.z + p.rz * width;
      return [x, railHeight(geo, p.x, p.z) + lift, z];
    };
    const sections = track.sections(7);
    for (let i = 1; i < sections.length; i++) {
      const a = sections[i - 1], b = sections[i];
      for (const side of [-.74, .74]) {
        batch.top([at(a, side - .078, .20), at(b, side - .078, .20),
          at(b, side + .078, .20), at(a, side + .078, .20)], '#9b9990');
        batch.face([at(a, side, .055), at(b, side, .055), at(b, side, .20), at(a, side, .20)], '#655a50');
      }
    }
    for (let s = .55; s < track.length; s += .86) {
      const p = track.sample(s);
      const y = railHeight(geo, p.x, p.z) + .08;
      const ends = [offset(p, -1.24), offset(p, 1.24)];
      batch.top([...ends.map(q => [q[0] - p.ux * .12, y, q[1] - p.uz * .12]),
        ...ends.toReversed().map(q => [q[0] + p.ux * .12, y, q[1] + p.uz * .12])], rng() > .58 ? '#858173' : '#77766a');
    }
  }
}

function overhead(batch, geo) {
  for (const [u, left, right] of [[-376, -36, 25], [-325, -40, 49], [-274, -50, 58], [-231, -49, 61],
    [232, -50, 61], [276, -39, 58], [322, -38, 47], [374, -34, 33], [424, -32, 21], [482, -32, 7]]) {
    const y = railHeight(geo, ...stationPoint(u, (left + right) / 2)) + 6.05;
    for (const v of [left, right]) {
      const p = stationPoint(u, v);
      const bottom = groundY(geo, ...p) - .14;
      block(batch, u, v, .52, .52, bottom, y + .32, '#777e7a');
      block(batch, u, v, 1.36, 1.36, bottom, bottom + .58, '#a19e90');
    }
    block(batch, u, (left + right) / 2, .37, right - left, y, y + .26, '#87908d');
  }
  for (const track of stationTracks) {
    const wireY = 5.64;
    const sections = track.sections(12);
    for (let i = 1; i < sections.length; i++) {
      const a = sections[i - 1], b = sections[i];
      const [x, z] = plan.origin;
      const localU = (a.x - x) * Math.cos(plan.angle) + (a.z - z) * Math.sin(plan.angle);
      if (Math.abs(localU) < 224) continue;
      const wire = (p, width) => [p.x + p.rx * width, railHeight(geo, p.x, p.z) + wireY, p.z + p.rz * width];
      batch.top([wire(a, -.04), wire(b, -.04), wire(b, .04), wire(a, .04)], '#696d68');
    }
  }
}

function entrance(batch, lamps, side, plazaY) {
  const edgeV = side * 91.2;
  const landing = plazaY + 2.85;
  block(batch, 0, side * 97.6, 112, 15.4, plazaY - .8, landing, stone, trim, litSurface.graniteFacing);
  for (const u of [-47, 47]) {
    block(batch, u, side * 94.5, 31, 19, plazaY, archBase - .36, stone, trim, litSurface.graniteFacing);
    block(batch, u, side * 104.2, 25, .35, plazaY + 1.15, plazaY + 3.9, glass, glass, litSurface.ferryGlass);
  }
  for (let i = 0; i < 15; i++) {
    const start = 123.3 - i * 1.20;
    block(batch, 0, side * (start - .6), 49, 1.20, plazaY - .28, plazaY + (i + 1) * .187, stone, trim);
  }
  for (let u = -29; u <= 29; u += 5.8) {
    block(batch, u, edgeV, 5.55, .42, landing, archBase - .08, glass, glass, litSurface.ferryGlass);
    block(batch, u - 2.83, side * 92, .38, 1.28, landing, archBase, frame);
    block(batch, u, side * 102.1, .22, .24, landing, archBase - .37, frame);
    const p = (x, v, h) => position(x, side * v, archBase + h);
    batch.top([p(u - 2.9, 90.7, -.55), p(u, 90.7, .52), p(u, 102.6, .38), p(u - 2.9, 102.6, -.65)], '#bac9c9');
    batch.top([p(u, 90.7, .52), p(u + 2.9, 90.7, -.55), p(u + 2.9, 102.6, -.65), p(u, 102.6, .38)], '#dce0d6');
    lamps.add(...p(u, 100.3, -.79), '#ecf1dd', 1.08);
  }
}

function plazas(batch, lamps, geo) {
  const surface = (ring, y) => prism(batch, footprint(ring), y - 2.5, y, stone, '#b8b5a9', 0, .2, 0, litSurface.railPlaza);
  surface(plan.southSquare, southSquareLevel);
  surface(plan.northSquare, northSquareLevel);
  surface(plan.northApron, northSquareLevel + .06);
  for (const u of [-71, -56, -29, 29, 56, 71])
    slab(batch, u - .37, u + .37, 124.4, 152, southSquareLevel + .02, '#99998e');
  for (const [u, a, b] of [[-38, -178, -105], [-20, -172, -104], [0, -166, -102], [20, -157, -105], [38, -151, -110]])
    slab(batch, u - .64, u + .64, a, b, northSquareLevel + .023, '#9b9c92');
  entrance(batch, lamps, 1, southSquareLevel);
  entrance(batch, lamps, -1, northSquareLevel);
  for (const [u, v, w, d] of [[-73, 126, 12, 36], [73, 126, 12, 36],
    [-65, -140, 13, 35], [48, -135, 12, 25], [-48, -165, 14, 11]]) {
    const y = v < 0 ? northSquareLevel : southSquareLevel;
    block(batch, u, v, w, d, y - .10, y + .51, trim, '#687c50');
    block(batch, u, v, w - .72, d - .82, y + .35, y + .86, '#5f7449', '#6d8154');
    const inside = u - Math.sign(u) * (w / 2 + 2.1);
    for (const s of [-1, 1]) block(batch, inside, v + s * d * .28, .63, 4.1, y + .38, y + .57, '#766957', '#9c8162');
    for (const s of [-1, 1]) {
      const [x, z] = stationPoint(u, v + s * d * .53);
      const bottom = Math.min(y, groundY(geo, x, z));
      cylinder(batch, x, z, bottom, y + 5.14, .128, .064, '#7d8a8a', 7);
      cylinder(batch, x, z, y + 5.01, y + 5.23, .25, .29, '#b4bcb1', 8);
      lamps.add(x, y + 4.98, z, '#ffeac4', 1.34);
    }
  }
}

function serviceBuildings(batch, geo, obstacles) {
  for (const [i, ring] of plan.serviceBuildings.entries()) {
    const outline = footprint(ring);
    const centre = outline.reduce(([x, z], p) => [x + p[0] / outline.length, z + p[1] / outline.length], [0, 0]);
    const drip = outline.map(([x, z]) => [mix(centre[0], x, 1.012), mix(centre[1], z, 1.012)]);
    const levels = outline.map(point => groundY(geo, ...point)).sort((a, b) => a - b);
    const y = levels[levels.length >> 1] + .22;
    const roof = y + (i === 0 ? 10.1 : 11.6);
    prism(batch, outline, levels[0] - .70, y + 1.02, '#a5a49b', stone);
    prism(batch, outline, y + 1.02, roof, '#839ba2', '#c7ccc5', litSurface.ferryGlass);
    for (let floor = y + 4.96; floor < roof - .7; floor += 4.1)
      prism(batch, drip, floor, floor + .53, trim, null, litSurface.graniteFacing);
    prism(batch, drip, roof - .91, roof + .15, '#c0c4ba', '#c4cac3', litSurface.graniteFacing);
    if (i === 0) {
      for (let u = -158; u < -102; u += 5.0) block(batch, u, 112.0, 3.7, 57, roof + .15, roof + .61, '#c4c9c0', shell);
      for (let v = 91; v < 133; v += 5.2) block(batch, -138, v, 9.7, 2.3, roof + .63, roof + .97, '#929b99');
    } else {
      for (let v = 91; v <= 143; v += 4.8) block(batch, 148.5, v, 91, 3.75, roof + .15, roof + .59, '#c0c6c0', shell);
      for (let v = 107.8; v < 127; v += 4.8) block(batch, 220.2, v, 29, 3.4, roof + .15, roof + .67, '#c0c6c0', shell);
      for (const u of [120, 156, 186]) block(batch, u, 95, 5.6, 3.75, roof + .59, roof + 1.42, '#aaaead', '#d4d5ca');
    }
    obstacles.add(outline, roof + 1.5);
  }
}

export function buildRailwayStation(batch, geo, lamps, obstacles) {
  railwayBed(batch, geo);
  platforms(batch);
  canopies(batch, lamps, obstacles);
  overhead(batch, geo);
  plazas(batch, lamps, geo);
  hall(batch, lamps, obstacles);
  serviceBuildings(batch, geo, obstacles);
}

export function addRailwaySigns(parent) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#f62f32';
  context.font = 'bold 145px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  for (const [i, char] of [...'厦门站'].entries()) context.fillText(char, 257 + 255 * i, 100);
  context.font = 'bold 43px Arial, sans-serif';
  context.fillText('XIAMEN RAILWAY STATION', 512, 215);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({ map: texture, alphaTest: .30,
    emissiveMap: texture, emissive: '#ff5547', emissiveIntensity: .28, roughness: .62 });
  const positions = [], texcoords = [], indices = [];
  for (const side of [-1, 1]) {
    const y = archBase + 9.4;
    const left = -side * 17.7, right = -left, first = positions.length / 3;
    positions.push(...facadePoint(left, side, y, -1.42), ...facadePoint(right, side, y, -1.42),
      ...facadePoint(right, side, y + 8.85, -1.42), ...facadePoint(left, side, y + 8.85, -1.42));
    texcoords.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(texcoords, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const sign = new THREE.Mesh(geometry, material);
  sign.name = '厦门站 · 中英文站牌';
  parent.add(sign);
  return { texture, update(night) { material.emissiveIntensity = .55 + night * 2.0; } };
}
