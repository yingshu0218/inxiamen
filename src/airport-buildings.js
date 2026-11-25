import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { litSurface, mix, prism, TAU } from './scenery-mesh.js';
import { terminal3, terminal4 } from './airport-layout.js';

const metal = '#d5d6cf', fascia = '#e6e4da', concrete = '#a5a7a0', mullion = '#69808a';
const glass = '#537785', darkGlass = '#3e5a67', pierShadow = '#6b7374';
const gateLine = '#e3b651', safetyPaint = '#b66b61';

function basis(s, r, angle) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return (u, v) => [s + co * u - si * v, r + si * u + co * v];
}

function terminalSign(parent, at, s, r, y, designation, width, rotation) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f1ede0';
  ctx.font = 'bold 70px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(designation, 512, 67, 995);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const sign = new Mesh(new PlaneGeometry(width, width / 8), new MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, toneMapped: false,
  }));
  sign.position.set(...at(s, r, y));
  sign.rotation.y = rotation;
  sign.name = designation;
  parent.add(sign);
}

function parkedAircraft(ctx, s, r, angle, scale, livery) {
  const { batch, at, apron, column } = ctx;
  const local = basis(s, r, angle);
  const p = (x, y, z) => at(...local(x * scale, z * scale), apron + y * scale);
  const skin = '#e4e5de', belly = '#bac3c1', wing = '#aeb9bc', tire = '#333a39';
  const n = 12;
  function rings(sections, side, height, colorAt) {
    const rows = sections.map(([x, rad, vertical = rad]) => Array.from({ length: n }, (_, i) => {
      const a = i * TAU / n;
      return p(x, height + vertical * Math.sin(a), side + rad * Math.cos(a));
    }));
    for (let j = 1; j < rows.length; j++) {
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n;
        batch.face([rows[j - 1][i], rows[j - 1][k], rows[j][k], rows[j][i]], colorAt(j, i));
      }
    }
    batch.face(rows[0].toReversed(), '#464e50');
    batch.face(rows.at(-1), '#333c40');
  }
  const profile = [[-19.2,.28,.37],[-16.8,.91,1.12],[-11.5,1.76,1.72],[-6,1.91,1.93],
    [9.4,1.91,1.93],[13.3,1.82,1.70],[16.2,1.44,1.18],[18.6,.50,.62],[19.2,.09,.17]];
  const bodyTone = (j, i) => {
    if (j === 7 && (i === 1 || i === 4)) return '#324a53';
    return i > 6 ? belly : skin;
  };
  rings(profile, 0, 3.65, bodyTone);
  for (const side of [-1, 1]) {
    for (let x = -11; x <= 11.9; x += 1.12) {
      const radius = x < -5.8 ? mix(1.72, 1.89, (x + 11.5) / 5.7) : x > 9.4 ? 1.84 : 1.9;
      batch.face([p(x, 3.83, side * radius), p(x + .43, 3.83, side * radius),
        p(x + .43, 4.18, side * radius), p(x, 4.18, side * radius)], '#344b55');
    }
    for (const x of [-14.9, 10.7]) {
      const radius = x < 0 ? 1.25 : 1.91;
      batch.face([p(x, 1.95, side * radius), p(x + 6, 2.01, side * 1.84),
        p(x + 6, 2.48, side * 1.84), p(x, 2.39, side * radius)], livery);
    }
    batch.top([p(5, 2.90, side * 1.4),p(-8.8, 3.40, side * 17.1),
      p(-10.8, 3.57, side * 17.3),p(-4.4, 2.70, side * 2.10)], wing);
    batch.top([p(-1.0, 2.92, side * 6.1), p(-9.0, 3.45, side * 15.8),
      p(-10.0, 3.50, side * 16.15), p(-2.5, 2.94, side * 6)], '#78868e');
    batch.face([p(-9.7, 3.41, side * 16.95),p(-11.6, 3.58, side * 17.65),
      p(-12.4, 5.05, side * 17.95),p(-10.55, 4.65, side * 17.64)], livery);
    batch.top([p(-12.1, 4.09, side * .7),p(-16.4, 4.49, side * 6.35),
      p(-18.3, 4.39, side * 6.15),p(-16.1, 4.06, side * .68)], wing);
    rings([[-2.9,.58],[-2,1.08],[1.65,1.2],[2.2,1.16],[2.46,.91]], side * 5.35, 1.95,
      (j) => j === 4 ? '#8f9b9b' : '#d0d5ce');
    column(...local(-2.65 * scale, side * 1.32 * scale), apron, apron + 2.5 * scale, .49 * scale, .17 * scale, tire, 6);
  }
  column(...local(11.4 * scale, 0), apron, apron + 2.45 * scale, .30 * scale, .12 * scale, tire, 6);
  const fin = [p(-10.35, 4.38, 0), p(-16.65, 9.77, 0), p(-18.63, 9.67, 0), p(-18.37, 4.38, 0)];
  batch.face(fin, livery);
  batch.face([p(-14.25, 7.72, .035),p(-16.72, 8.65, .035),p(-18.52, 8.99, .035),
    p(-18.50, 8.54, .035),p(-16.73, 8.19, .035)], '#dae5de');
}

export function buildAirportBuildings(parent, ctx) {
  const { batch, world, at, stroke, number, light, column, terrain, obstacles, rng, apron, base } = ctx;
  const P = (s, r, y) => at(s, r, base + y);
  function room(s, r, length, width, bottom, top, wall, roof = wall, {
    style = 0, roofStyle = 0, angle = 0, obstacle = false,
  } = {}) {
    const local = basis(s, r, angle);
    const ring = [[-length / 2, -width / 2], [length / 2, -width / 2], [length / 2, width / 2],
      [-length / 2, width / 2]].map(([u, v]) => world(...local(u, v)));
    prism(batch, ring, base + bottom, base + top, wall, roof, style, 0, 0, roofStyle);
    if (obstacle) obstacles.add(ring, base + top);
  }
  function roof(s0, s1, r0, r1, across, deep, rise, coating, cladding) {
    const point = (u, v, lift = 0) => P(mix(s0, s1, u), mix(r0, r1, v), rise(u, v) + lift);
    const sheen = litSurface.railRoof;
    for (let i = 0; i < across; i++) {
      const a = i / across, b = (i + 1) / across;
      const u0 = mix(s0, s1, a), u1 = mix(s0, s1, b);
      for (let j = 0; j < deep; j++) {
        const c = j / deep, d = (j + 1) / deep;
        const v0 = mix(r0, r1, c), v1 = mix(r0, r1, d);
        const [color, style] = coating(i, j);
        batch.top([point(a, c), point(b, c), point(b, d), point(a, d)],
          color, style ?? sheen, .3, [[u0,v0], [u1,v0], [u1,v1], [u0,v1]]);
      }
      for (const v of [0, 1]) {
        batch.face([point(a, v), point(b, v), point(b, v, -.62), point(a, v, -.62)], fascia);
        const r = mix(r0, r1, v);
        batch.face([P(u0, r, cladding), P(u1, r, cladding), point(b, v, -.6), point(a, v, -.6)],
          mullion, litSurface.railGlass, .5, [[u0,0],[u1,0],[u1,rise(b,v)-cladding],[u0,rise(a,v)-cladding]]);
      }
    }
    for (let j = 0; j < deep; j++) {
      const a = j / deep, b = (j + 1) / deep;
      for (const u of [0, 1]) {
        const s = mix(s0, s1, u);
        batch.face([P(s, mix(r0, r1, a), cladding), P(s, mix(r0, r1, b), cladding), point(u, b), point(u, a)],
          glass, litSurface.railGlass);
      }
    }
    obstacles.add([world(s0, r0), world(s1, r0), world(s1, r1), world(s0, r1)],
      base + Math.max(...Array.from({ length: across + 1 }, (_, i) =>
        Math.max(...Array.from({ length: deep + 1 }, (_, j) => rise(i / across, j / deep))))));
    return point;
  }
  function concourse(s, r, l, w, y, angle = 0) {
    room(s, r, l, w, -1.4, 3.4, concrete, concrete, { angle });
    room(s, r, l - .8, w - .7, 3.4, y, glass, darkGlass, { style: litSurface.railGlass, angle, obstacle: true });
    room(s, r, l + 2.4, w + 2.7, y - 1.1, y + .3, fascia, metal, { roofStyle: litSurface.railRoof, angle });
    room(s, r, l + .7, w + .5, 3.5, 4.04, fascia, fascia, { angle });
  }
  function canopy(s, r, length, width, y) {
    room(s, r, length, width, y - .8, y, '#cccfc5', metal, { roofStyle: litSurface.railRoof, obstacle: true });
    for (let u = -length / 2 + 5.6; u < length / 2; u += 16.5) {
      column(s + u, r + width / 2 - 1.7, terrain(s + u, r + width / 2 - 1.7), base + y - .5, .50, .38, '#babcb1', 8);
      light(s + u, r + width / 2 - 2.6, base + y - .95, '#ffdfaf', 1.8);
    }
  }

  // Terminal 3 has a low, continuous airside concourse and a higher glazed hall behind it.
  const [s3, r3] = terminal3;
  concourse(1154, 478, 807, 49, 10.65);
  concourse(736, 447, 88, 25.5, 10.1, 1.07);
  concourse(1534, 475, 72, 43, 12);
  concourse(s3, r3 + 24, 306, 110, 15.8);
  roof(991, 1315, 496, 615, 24, 10,
    (u, v) => 16.15 + (2.1 + 3.3 * Math.sin(v * Math.PI)) * (.92 + .08 * Math.sin(u * Math.PI)),
    (i, j) => i > 0 && i < 23 && j > 0 && j < 9
      ? [j === 4 || j === 5 ? '#77949a' : i % 3 ? '#6e8286' : '#839193', litSurface.railRoof] : [metal],
    15.55);
  canopy(s3, 624, 286, 19, 11);
  room(s3, 599, 299, 3.4, 12.9, 13.6, fascia);
  for (let s = 1010; s < 1305; s += 18.5) {
    room(s, 472, 2.25, 19, 10.84, 11.36, '#8e9c9e', '#9eafb0');
  }
  const bearing = Math.atan2(world(1, 0)[1] - world(0, 0)[1], world(1, 0)[0] - world(0, 0)[0]);
  terminalSign(parent, at, s3, 451.79, base + 8.0, 'T3  厦门高崎国际机场', 58, Math.PI - bearing);
  terminalSign(parent, at, s3, 605.03, base + 14.6, '厦门高崎国际机场  T3', 64, -bearing);

  // Terminal 4's two folded ridges fan out from its airside high point.
  const [s4, r4] = terminal4;
  concourse(2970, 491, 318, 61, 12.4, Math.PI / 2);
  concourse(s4, r4 + 2, 386, 120, 16.15);
  const v4 = 17;
  const ridge = (t, u) => {
    const left = mix(.62, .016, u), right = mix(.62, .984, u);
    const fold = Math.max(0, 1 - Math.min(Math.abs(t - left), Math.abs(t - right)) / .27);
    return 18 + 16.8 * fold * (1 - u) ** .72 + 7.1 * Math.abs(t * 2 - 1) ** 8 * u ** 2 + 1.3 * Math.sin(u * Math.PI);
  };
  const mainRoof = roof(2921, 3331, 631, 780, 46, v4, ridge,
    (i, j) => [(i + j) % 7 === 0 ? '#c9cec9' : '#d6d9d1'], 15.9);
  for (const side of [-1, 1]) {
    for (let j = 0; j < v4; j++) {
      const a = j / v4, b = (j + 1) / v4;
      const x = mix(.62, side < 0 ? .016 : .984, a);
      const y = mix(.62, side < 0 ? .016 : .984, b);
      batch.top([mainRoof(x - .006,a,.20), mainRoof(x + .006,a,.20),
        mainRoof(y + .006,b,.20), mainRoof(y - .006,b,.20)], '#7d8f92');
    }
  }
  for (const s of [2950, 2990]) {
    room(s, 488, 1.8, 291, 12.71, 13.01, '#809397', '#9aadad');
  }
  canopy(s4, 781, 316, 22, 11.25);
  terminalSign(parent, at, s4, 780.08, base + 17.2, '厦门高崎国际机场  T4', 66, -bearing);
  terminalSign(parent, at, s4, 630.1, base + 16.2, 'T4  XIAMEN GAOQI', 56, Math.PI - bearing);

  function bridge(from, to, y0, y1, w, shade) {
    const dx = to[0] - from[0], dr = to[1] - from[1], length = Math.hypot(dx, dr);
    const across = [-dr * w / (2 * length), dx * w / (2 * length)];
    const corner = ([s, r], side, y) => P(s + side * across[0], r + side * across[1], y);
    for (const side of [-1, 1]) {
      batch.face([corner(from,side,y0),corner(to,side,y1),corner(to,side,y1+2.65),corner(from,side,y0+2.65)],
        shade, litSurface.railGlass, .6, [[0,0],[length,0],[length,2.65],[0,2.65]]);
      batch.face([corner(from,side,y0-.6),corner(to,side,y1-.6),corner(to,side,y1),corner(from,side,y0)], fascia);
    }
    batch.top([corner(from,-1,y0+2.69),corner(to,-1,y1+2.69),corner(to,1,y1+2.69),corner(from,1,y0+2.69)], metal);
  }
  function vehicle(s, r, angle, length, width, color, tall = false) {
    const roof = tall ? 2.8 : 1.67;
    const local = basis(s, r, angle);
    room(s, r, length, width, .65, roof - .64, color, color, { angle });
    room(...local(-length * .135, 0), length * .73, width * .99, roof - .64, roof, color, metal, { angle });
    room(...local(length * .356, 0), length * .29, width * .93, roof - .63, roof - .12, darkGlass, metal, { angle });
    for (const x of [-.33, .33]) {
      for (const side of [-1, 1]) column(...local(x * length, side * width * .42), apron, base + .86, .37, .37, '#3a3c3b', 6);
    }
  }
  function floodlight(s, r) {
    column(s, r, apron, base + 19.7, .35, .19, '#747c79');
    room(s, r, 3.8, 1.0, 19.35, 20.0, mullion);
    for (const u of [-1.35, 0, 1.35]) light(s + u, r, base + 19.4, '#ffe4b0', 3.1);
  }
  function gate(s, r, angle, id, parked, color, service = false) {
    const p = basis(s, r, angle), heading = angle + Math.PI;
    const y = apron + .031;
    stroke([p(9,0),p(25,0),p(54,0),p(76,0),p(94,4)], .35, y, gateLine);
    stroke([p(17,-19),p(7,-19),p(7,19),p(17,19)], .4, y, safetyPaint);
    for (const v of [-18, 18]) stroke([p(18,v),p(61,v)], .23, y, '#cf9988');
    for (const [u, v] of [[12,0],[25,0],[30,0]]) stroke([p(u,v-1.4),p(u,v+1.4)], .27, y + .007, gateLine);
    number(id, ...p(63, 4.6), 5.1, heading, y + .008, gateLine);

    const anchor = p(0, -8), middle = p(12, -8), cab = p(22, -3);
    room(...anchor, 6.8, 5.0, 4.2, 8.9, pierShadow, metal, { angle });
    bridge(anchor, middle, 5.2, 4.4, 3.1, glass);
    bridge(middle, cab, 4.4, 3.4, 3.75, '#6b878c');
    room(...cab, 4.8, 4.0, 3.1, 6.7, '#71858a', fascia, { style: litSurface.railGlass, angle });
    column(...middle, apron, base + 4.6, .37, .27, mullion, 7);
    for (const v of [-1.0, 1.0]) column(...p(21,v-3), apron, base + 3.2, .36, .20, '#4e5858', 6);
    light(...cab, base + 4.1, '#ffdfae', 1.75);
    if (parked) parkedAircraft(ctx, ...p(34, 0), heading, .88 + rng() * .13, color);
    if (service) {
      vehicle(...p(15, 15.5), angle - .26, 4.8, 2.05, '#dedfd1');
      vehicle(...p(23, 18), angle + .35, 3.0, 1.55, '#c99843');
      room(...p(27.2, 19.3), 3.45, 1.7, .32, 1.64, '#8d9da0', '#dddacf', { angle: angle + .3 });
    }
  }
  const cyan = '#327391', blue = '#3b5183', crimson = '#aa454a';
  for (const path of [
    [[164,278],[190,308],[239,331],[720,331],[1096,331],[1571,330],[1955,330],[1987,315],[2006,276]],
    [[2720,270],[2746,304],[2812,327],[2840,354],[2840,596]],
    [[3258,316],[3258,594],[3271,614],[3318,615]],
    [[2016,470],[2005,582],[2006,633],[2022,651],[2325,651]],
  ]) stroke(path, .37, apron + .028, gateLine);
  const t3Gates = [789, 846, 906, 963, 1018, 1075, 1134, 1192, 1249, 1306, 1365, 1421, 1478, 1532];
  t3Gates.forEach((s, i) => {
    gate(s, 453, -Math.PI / 2, i + 5, [0, 2, 4, 7, 9, 11, 13].includes(i), i % 4 ? cyan : blue, i % 3 === 1);
    stroke([[s + 4, 359], [s + 6, 343], [s + 17, 332]], .30, apron + .031, gateLine);
    if (i % 3 === 0) floodlight(s - 23, 443);
  });
  [354, 403, 446, 489, 532, 574, 615].forEach((r, i) => {
    gate(3000, r, 0, [72, 71, 69, 67, 65, 63, 61][i], i % 3 !== 1, i % 2 ? blue : crimson, i % 3 === 2);
  });
  [342, 406, 481, 534, 584].forEach((r, i) =>
    gate(2940, r, Math.PI, [73, 70, 68, 66, 62][i], i % 2 === 0, cyan, i % 2 === 1));
  for (const [s, r] of [[3011,369],[3010,505],[3014,612],[2904,449],[3304,622],[1984,430],[1852,779],[2203,779]]) {
    floodlight(s, r);
  }

  for (const [s, r, l, w, h] of [
    [195,443,160,94,16],[418,431,110,79,14],[478,481,41,46,12],[1657,512,185,57,16],
    [1880,505,97,59,16.5],[2201,550,176,75,19],[1778,828,168,81,19],
    [1957,828,171,82,23],[2181,827,169,83,18],[2378,866,159,82,18],[2709,1020,182,78,19],
  ]) {
    room(s, r, l, w, -1.9, h, '#aeb3ae', metal, { obstacle: true });
    for (const y of [2.5, 8.55, h - 2]) room(s, r - w / 2, l - 2, .80, y, y + .34, '#819092');
    for (let u = s - l / 2 + 8; u < s + l / 2 - 5; u += 9.6) {
      room(u, r - w / 2 - .10, 8.1, .38, 1.9, Math.min(h - 1.3, 12), '#728487', '#8fa1a1', { style: 21 });
    }
    roof(s - l / 2 - .6, s + l / 2 + .6, r - w / 2 - 1, r + w / 2 + 1, 6, 6,
      (_u,v) => h + .55 + 2.65 * Math.sin(v * Math.PI), (_,j) => [j === 2 ? '#b6c4c3' : metal], h);
  }

  for (const [s, r, angle, scale, shade] of [
    [236,341,1.1,.98,cyan],[341,349,1.22,.86,blue],[461,344,1.22,.93,cyan],
    [1804,738,1.57,1.17,cyan],[1919,730,1.57,1.35,cyan],[2194,729,1.57,1.08,blue],
    [3234,442,2.98,.94,cyan],[3295,510,2.86,.96,crimson],[3380,545,3.38,.83,blue],
  ]) {
    const p = basis(s, r, angle);
    stroke([p(-32,0),p(-12,0),p(23,0)], .29, apron + .035, gateLine);
    parkedAircraft(ctx, s, r, angle, scale, shade);
  }
  for (const [s, r, angle] of [[207,388,.04],[1527,500,0],[2009,559,1.5],[3313,631,.1],[2682,923,1.5]]) {
    vehicle(s, r, angle, 7.3, 2.65, '#cdccbd', true);
  }
  vehicle(2495, 582, .12, 9.4, 3.1, '#a7453d', true);
  vehicle(2507, 582, .12, 9.4, 3.1, '#ac4c43', true);

  const ts = 1593, tr = 559, ty = terrain(ts, tr);
  room(ts, tr, 33, 27, -1, 6.4, '#b7b9ad', '#c9c8ba', { obstacle: true });
  column(ts, tr, ty, base + 52, 4.7, 3.7, '#d1d0c1', 12);
  column(ts, tr, base + 51.7, base + 57, 4.0, 8.45, '#b8bcb3', 12);
  column(ts, tr, base + 56.8, base + 63.0, 8.45, 9.5, '#486873', 12);
  column(ts, tr, base + 63.0, base + 64.5, 10.2, 9.6, '#d9d8c9', 12);
  column(ts, tr, base + 64.5, base + 68, .24, .13, mullion, 6);
  for (let i = 0; i < 12; i++) {
    const a = TAU * i / 12;
    column(ts + 8.64 * Math.cos(a), tr + 8.64 * Math.sin(a), base + 56.9, base + 63.2, .19, .24, '#9caeae', 5);
  }
  light(ts, tr, base + 68, '#ff5854', 2.9);
  for (const v of [-4.1, 4.1]) light(ts, tr + v, base + 60, '#ffe2b6', 3.25);
  obstacles.add([[ts - 9, tr - 9], [ts + 9, tr - 9], [ts + 9, tr + 9], [ts - 9, tr + 9]]
    .map(([s,r]) => world(s,r)), base + 68);
}
