import { cylinder, groundY, litSurface, mix, prism } from './scenery-mesh.js';
import { localFrame, rect, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { dongduFootprint, dongduPoint as xy, dongduPontoons, dongduSections } from './west-landmark-layout.js';

const metal = '#dadfd7';
const trim = '#ede6d6';
const glass = '#54767c';
const skylights = [-117, -63, -10, 45, 102];
const shore = [
  [-5627, -529], [-5618.9, -515], [-5604.1, -471.9], [-5588.1, -415.6],
  [-5574.7, -372.9], [-5561.8, -329.1], [-5545.2, -278], [-5538.8, -247.7],
];

function terminal(batch, geo, lamps, obstacles, signs) {
  const base = Math.max(4.45, groundY(geo, ...xy(0, -4)) + .17);
  prism(batch, dongduFootprint, -.9, base + 5.3, '#aaa79b', null, litSurface.graniteFacing);
  const rows = [...new Set([...dongduSections.map(([u]) => u),
    ...Array.from({ length: 80 }, (_, i) => -175 + i * 4.1),
    ...skylights.flatMap((u) => [u - 4.2, u + 4.2])])].sort((a, b) => a - b);
  let section = 1;
  const profile = rows.map((u) => {
    while (dongduSections[section][0] < u) section++;
    const [u0, land0, sea0] = dongduSections[section - 1], [u1, land1, sea1] = dongduSections[section];
    const a = (u - u0) / (u1 - u0), land = mix(land0, land1, a), sea = mix(sea0, sea1, a);
    const point = (t, lift = 0) => {
      const span = Math.min(1, (sea - land) / 87);
      const barrel = (7.3 + 3.0 * Math.cos((u + 54) * .018)) * span * Math.sin(Math.PI * t) ** .87;
      const arch = 9.4 * Math.exp(-(((u - 68) / 44) ** 2)) * t ** 4;
      const ribs = span * (1.2 + .93 * Math.cos((u + 145) * .113));
      return up(xy(u, mix(land, sea, t)), base + 17.2 + barrel + arch + ribs + lift);
    };
    return { u, land, sea, point };
  });
  const archGlazing = (u) => u > 32 && u < 110;
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1], b = profile[i], mid = (a.u + b.u) / 2;
    const skylight = skylights.some((u) => Math.abs(mid - u) < 4.2);
    for (let j = 0; j < 12; j++) {
      const t0 = j / 12, t1 = (j + 1) / 12;
      const roof = [a.point(t0), b.point(t0), b.point(t1), a.point(t1)];
      batch.top(roof, skylight ? '#75a4a9' : metal, skylight ? litSurface.railGlass : litSurface.railRoof, .8,
        [[a.u, t0 * 90], [b.u, t0 * 90], [b.u, t1 * 90], [a.u, t1 * 90]]);
    }
    for (const side of [0, 1]) {
      const [ax, highA, az] = a.point(side), [bx, highB, bz] = b.point(side);
      const bottom = base + 5.3;
      const archRim = side && archGlazing(mid) ? 1.1 : .54;
      batch.face([[ax, bottom, az], [ax, highA - archRim, az], [bx, highB - archRim, bz], [bx, bottom, bz]],
        glass, litSurface.railGlass, .22 + side * .48,
        [[a.u, 0], [a.u, highA - bottom], [b.u, highB - bottom], [b.u, 0]]);
      batch.face([[ax, highA - archRim, az], [ax, highA, az], [bx, highB, bz], [bx, highB - archRim, bz]],
        trim, litSurface.railEave);
      if (side) {
        const q = (row) => xy(row.u, row.sea + .11);
        const left = q(a), right = q(b), va = groundY(geo, ...left) + .48, vb = groundY(geo, ...right) + .48;
        batch.face([up(left, va), up(left, bottom - .45), up(right, bottom - .45), up(right, vb)],
          glass, litSurface.railGlass, .43, [[a.u, 0], [a.u, bottom - va], [b.u, bottom - vb], [b.u, 0]]);
        batch.face([up(left, bottom - .45), up(left, bottom + .05), up(right, bottom + .05), up(right, bottom - .45)],
          trim, litSurface.railEave);
      }
      if (!side || !archGlazing(mid)) {
        const va = (side ? a.sea : a.land) + (side ? .48 : -.48);
        const vb = (side ? b.sea : b.land) + (side ? .48 : -.48);
        for (let j = 0; j < 9; j++) {
          const y = base + 6.05 + j * 1.05;
          batch.top([up(xy(a.u, va), y), up(xy(b.u, vb), y),
            up(xy(b.u, vb + (side ? -.44 : .44)), y - .18),
            up(xy(a.u, va + (side ? -.44 : .44)), y - .18)], '#cad2cb', litSurface.crownMetal);
        }
      }
    }
  }
  for (const edge of [profile[0], profile.at(-1)]) {
    for (let j = 1; j <= 12; j++) {
      const a = edge.point((j - 1) / 12), b = edge.point(j / 12);
      batch.face([[a[0], base + 5.3, a[2]], a, b, [b[0], base + 5.3, b[2]]], glass, litSurface.railGlass);
    }
  }
  // The glass harbour lobby opens above the covered ferry terrace.
  const hallSpan = rect(xy, 68, 26.4, 63, 6.3);
  prism(batch, hallSpan, base + 5.3, base + 6.3, trim, metal, litSurface.railEave);
  for (let u = 42; u <= 96; u += 9) {
    const [x, z] = xy(u, 28.6);
    cylinder(batch, x, z, base - .08, base + 5.35, .37, .34, '#b3b9af', 8);
    lamps.add(x, base + 5.15, z, '#ffe2a8', 1.4);
  }
  signs.push({ label: '东渡客运码头', a: xy(57, 25.73), b: xy(81, 25.88),
    y: base + 15.65, height: 2.08, ink: '#d8d3ae' });
  signs.push({ label: '东渡客运码头', a: xy(11, -44), b: xy(-16, -44),
    y: base + 15.55, height: 2.55, ink: '#d8d3ae' });
  obstacles.add(dongduFootprint, base + 34);
  obstacles.add(hallSpan, base + 6.3);
}

function berth(batch, lights, obstacles, { a, b, width, ramps }) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const along = localFrame(a, angle), deck = 1.55;
  const footprint = rect(along, length / 2, 0, length, width);
  prism(batch, footprint, .03, .92, '#4c5551', null);
  prism(batch, footprint, .92, deck, '#b9af9a', '#a78f71', 0, 0, 0, 22);
  const p = (u, v, y) => up(along(u, v), y);
  const bays = Math.round(length / 12);
  for (let i = 0; i < bays; i++) {
    const u = i * length / bays + .65, end = (i + 1) * length / bays - .55;
    const roof = (fraction, side) => p(mix(u, end, fraction), side * (width * .4), deck + 3.02 + .88 * Math.sin(fraction * Math.PI));
    for (let j = 1; j <= 6; j++)
      batch.top([roof((j - 1) / 6, -1), roof(j / 6, -1), roof(j / 6, 1), roof((j - 1) / 6, 1)],
        metal, litSurface.railRoof, .42);
    for (const side of [-1, 1]) {
      const [x, z] = along(u + .3, side * (width * .36));
      cylinder(batch, x, z, deck, deck + 3.13, .127, .105, trim, 6);
    }
    if (i % 2 === 0) lights.add(...p((u + end) / 2, 0, deck + 3.12), '#ffebbc', 1.12);
  }
  for (let u = 4; u < length - 1; u += 7) {
    const [x, z] = along(u, width * .5 + .25);
    cylinder(batch, x, z, -.3, 1.18, .42, .43, '#434c48', 8);
  }
  for (const [start, end] of ramps) {
    const [dx, dz] = [end[0] - start[0], end[1] - start[1]];
    const wide = (x, z, t, h) => [x - dz * t / Math.hypot(dx, dz), h, z + dx * t / Math.hypot(dx, dz)];
    const a0 = wide(...start, -1.47, 4.62), a1 = wide(...start, 1.47, 4.62);
    const b0 = wide(...end, -1.47, deck + .06), b1 = wide(...end, 1.47, deck + .06);
    batch.top([a0, a1, b1, b0], '#a7a89e', 22);
    for (const [a, b] of [[a0, b0], [a1, b1]]) {
      const over = ([x, y, z]) => [x, y + 1.12, z];
      pathTube(batch, [over(a), over(b)], .074, trim, 5);
      for (const t of [0, .25, .5, .75, 1]) {
        const x = mix(a[0], b[0], t), z = mix(a[2], b[2], t), y = mix(a[1], b[1], t);
        cylinder(batch, x, z, y, y + 1.13, .048, .045, '#bec6c2', 5);
      }
    }
  }
  obstacles.add(footprint, deck + 4);
}

export function buildDongdu(batch, geo, lamps, obstacles, signs) {
  terminal(batch, geo, lamps, obstacles, signs);
  const promenade = [...shore, ...shore.toReversed().map(([x, z]) => [x + 15, z])];
  prism(batch, promenade, -.35, 4.61, '#91998b', '#b4ada0', litSurface.seaWall, .3, 0, 22);
  for (const pontoon of dongduPontoons) berth(batch, lamps, obstacles, pontoon);
}
