import { prism, cylinder, groundY, litSurface } from './scenery-mesh.js';
import { localFrame, up, rect, inRect, terrace, sweptRoof } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { shangxian } from './campus-layout.js';
import { paintOval } from './campus-fields.js';

// West to east around the upper edge of Shangxian field. The east end house
// and the facade ornament are reconstructions within the mapped building group.
const hall = [-3251, 4772],
  hallAngle = 0.192,
  field = [-3263, 4874],
  fieldAngle = 0.183;
const wings = [
  { p: [-3438, 4828], a: -0.625 },
  { p: [-3347, 4783], a: -0.226 },
  { p: [-3163, 4805], a: 0.325 },
  { p: [-3077, 4861], a: 0.63 },
];
const tile = '#ca7653',
  ridge = '#bd9471',
  stone = '#d7c6aa',
  granite = '#b9b1a1';
export function campusReserved(x, z) {
  if (x < -3480 || x > -3035 || z < 4726 || z > 4943) return false;
  if (
    inRect(x, z, hall, hallAngle, 28.5, 36) ||
    wings.some((w) => inRect(x, z, w.p, w.a, 38, 16.5))
  )
    return true;
  const u = (x - field[0]) * Math.cos(fieldAngle) + (z - field[1]) * Math.sin(fieldAngle);
  const v = -(x - field[0]) * Math.sin(fieldAngle) + (z - field[1]) * Math.cos(fieldAngle);
  return (u * u) / (131 * 131) + (v * v) / (73 * 73) < 1;
}

function lintel(batch, xy, u, v, width, diameter, base, top, color, style = 0) {
  prism(batch, rect(xy, u, v, width, diameter), base, top, color, color, style);
}
function archBay(batch, xy, u, v, y, w, h) {
  const r = w * 0.5,
    spring = y + h - r;
  function bow(radius, i, offset = 0) {
    const a = (i * Math.PI) / 12;
    return up(xy(u + Math.cos(a) * radius, v + offset), spring + radius * Math.sin(a));
  }
  const fan = [up(xy(u - r, v), y), up(xy(u + r, v), y)];
  for (let i = 0; i <= 12; i++) fan.push(bow(r, i));
  batch.face(fan, '#484b45');
  for (const side of [-1, 1])
    lintel(batch, xy, u + side * (r + 0.15), v + 0.17, 0.32, 0.48, y, spring, stone);
  for (let i = 0; i < 12; i++)
    batch.face(
      [bow(r, i, 0.3), bow(r + 0.31, i, 0.3), bow(r + 0.31, i + 1, 0.3), bow(r, i + 1, 0.3)],
      stone
    );
}
function windows(batch, xy, w, v, levels, y, start = 0) {
  const count = Math.floor(w / 4.6);
  for (let k = 0; k < count; k++)
    for (let j = 0; j < levels; j++) {
      const u = start + ((k + 0.5) / count - 0.5) * w,
        base = y + 1.0 + j * 4.5;
      lintel(batch, xy, u, v, 1.83, 0.19, base, base + 2.7, '#56666a', litSurface.hallWindow);
      lintel(batch, xy, u, v + 0.07, 2.32, 0.35, base - 0.16, base + 0.1, '#dac9ac');
    }
}
function assemblyHall(batch, geo, lamps, index) {
  const xy = localFrame(hall, hallAngle),
    pad = rect(xy, 0, 0, 50, 66);
  const y = terrace(batch, geo, pad, 0.7, '#bcb4a4');
  prism(batch, rect(xy, 0, -5, 43, 53), y, y + 13.9, '#b98260', '#94795f', 14);
  sweptRoof(batch, xy, 0, -10.1, 47.5, 51.4, y + 14.2, 7.9, tile, ridge, .66);
  // Five progressively higher front bays give the auditorium its stepped silhouette.
  for (const [u, w, v, d, h] of [
    [-19.1, 10.5, 18, 23, 12],
    [19.1, 10.5, 18, 23, 12],
    [-10.7, 9.5, 17, 25, 19],
    [10.7, 9.5, 17, 25, 19],
    [0, 14.0, 13, 32, 24],
  ]) {
    const front = v + d / 2;
    prism(batch, rect(xy, u, v, w, d), y, y + h, '#d7bfa4', '#c7b090', litSurface.portico);
    windows(batch, xy, w - 1, front + 0.09, h > 20 ? 4 : h > 17 ? 3 : 2, y + 2, u);
    for (const side of [-1, 1])
      lintel(batch, xy, u + side * (w / 2 - 0.55), front + 0.1, 0.7, 0.47, y, y + h, '#e0cdb1');
    lintel(batch, xy, u, front + 0.15, w + 0.3, 0.6, y + h - 0.82, y + h - 0.51, stone);
    if (h > 20) {
      sweptRoof(batch, xy, 0, v + 2.3, 16.5, 21.8, y + h, 3.5, '#4a6558', '#9e9d72', 1.25);
      lintel(batch, xy, 0, v + 3.5, 10.3, 12.5, y + 27.02, y + 28.18, '#876955');
      sweptRoof(batch, xy, 0, v + 3.5, 13.7, 15.9, y + 28.12, 2.4, '#436054', '#a09872', .9);
    } else {
      sweptRoof(batch, xy, u, v, w + 1.55, d + 1.65, y + h, 2.7, '#5d715f', '#a29c7e', .56);
    }
  }
  // The recessed green window wall under the projecting centre roof is visible across the pitch.
  lintel(batch, xy, 0, 29.27, 11.3, 0.42, y + 13.7, y + 22.7, '#426056', litSurface.hallWindow);
  for (let column = -2; column <= 2; column++)
    lintel(batch, xy, column * 2.22, 29.56, 0.22, 0.3, y + 13.6, y + 22.9, stone);
  for (const h of [15.4, 18.1, 20.7, 22.6])
    lintel(batch, xy, 0, 29.56, 11.5, 0.32, y + h, y + h + 0.18, '#c2b79a');
  lintel(batch, xy, 0, 29.45, 12.4, 1.1, y + 13.3, y + 13.72, granite);
  // A deep five-bay portico and broad steps face the field.
  for (let i = -2; i <= 2; i++) {
    const [x, z] = xy(i * 4.6, 31.25);
    cylinder(batch, x, z, y + 0.24, y + 7.45, 0.5, 0.44, stone, 10);
    archBay(batch, xy, i * 4.55, 29.56, y + 0.3, 3.12, 5.45);
    lamps.add(x, y + 6.7, z - 0.5, '#ffd39b', 0.73);
  }
  lintel(batch, xy, 0, 29.5, 23.5, 4.7, y + 7.45, y + 8.04, stone, litSurface.stone);
  for (let i = 0; i < 10; i++) {
    const r = rect(xy, 0, 32 + i * 0.54, 22.3, 0.57),
      top = y + 0.2 - i * 0.17;
    prism(
      batch,
      r,
      Math.min(top - 0.24, groundY(geo, ...xy(0, 32 + i * 0.54)) - 0.22),
      top,
      granite,
      '#c9bcaa'
    );
  }
  index.add(pad, y + 15);
  index.add(rect(xy, 0, 9, 31, 40), y + 24);
  index.add(rect(xy, 0, 13, 15, 32), y + 31);
}
function sideHouse(batch, geo, lamps, index, { p, a }, order) {
  const xy = localFrame(p, a),
    w = 65,
    d = 17,
    pad = rect(xy, 0, 0, w + 1.5, d + 3);
  const y = terrace(batch, geo, pad, 0.35),
    h = 12.8 + (order % 2) * 0.8;
  prism(
    batch,
    rect(xy, 0, 0, w, d),
    y,
    y + h,
    order % 2 ? '#ba8469' : '#c19275',
    '#c2af91',
    litSurface.portico
  );
  for (const side of [-1, 1]) windows(batch, xy, w - 3, side * (d / 2 + 0.12), 3, y);
  for (const e of [4.4, 8.9, h - 0.35])
    lintel(batch, xy, 0, 0, w + 0.4, d + 0.42, y + e - 0.22, y + e, '#d0bda3');
  sweptRoof(batch, xy, 0, 0, w + 1.7, d + 2, y + h, 5, tile, ridge, 0.7);
  // Cross-gables have light granite surrounds against a darker arcaded facade.
  for (const u of [-w * 0.42, 0, w * 0.42]) {
    const wing = rect(xy, u, 0.8, 7.0, d + 5.4),
      front = d * 0.5 + 3.5;
    prism(batch, wing, y, y + h + 0.65, stone, stone);
    const top = y + h + 0.63,
      peak = up(xy(u, front), top + 4.55);
    batch.face([up(xy(u - 3.5, front), top), up(xy(u + 3.5, front), top), peak], '#d5bda1');
    archBay(batch, xy, u, front + 0.04, y + 0.4, 3.6, 4.1);
    windows(batch, xy, 6.4, front + 0.08, 2, y + 4.68, u);
    const cross = localFrame(xy(u, 0.8), a + Math.PI / 2);
    sweptRoof(batch, cross, 0, 0, d + 6.8, 8.3, top, 3.8, tile, ridge, 0.38);
    lamps.add(...up(xy(u, front + 0.35), y + 4.8), '#ffcc95', 0.65);
  }
  index.add(pad, y + h + 5.8);
}
function playingField(batch, geo, index) {
  const xy = localFrame(field, fieldAngle);
  const turf = paintOval(batch, shangxian, 4, '#738b4f', '#a1503e', geo);
  // Fan-shaped stone stands nest against the hill. Gangways divide the rows into sections.
  const seat = (t, row) => {
    const inner = xy(115 * Math.sin(t), -41 * Math.cos(t));
    const p = xy((115 + row * 0.81) * Math.sin(t), -(41 + row * 0.84) * Math.cos(t));
    return up(p, Math.max(groundY(geo, ...p) + 0.47, groundY(geo, ...inner) + 0.61 + row * 0.44));
  };
  for (let i = 0; i < 76; i++)
    for (let row = 0; row < 17; row++) {
      const a = -1.4 + (i * 2.8) / 76,
        b = a + 2.8 / 76;
      const p = seat(a, row),
        q = seat(b, row),
        r = seat(b, row + 1),
        s = seat(a, row + 1);
      const lipR = [r[0], q[1], r[2]],
        lipS = [s[0], p[1], s[2]];
      const gangway = [14, 29, 38, 47, 62].some(a => i === a || i === a + 1);
      batch.top([p, q, lipR, lipS], gangway ? '#baab98' : row % 4 === 0 ? '#b9ab9c' : '#a49b91');
      if (gangway) {
        const midS = lipS.map((v,k)=>(v+s[k]+p[k])/3);
        const midR = lipR.map((v,k)=>(v+r[k]+q[k])/3);
        const stepS = [(p[0]+s[0])/2, (p[1]+s[1])/2, (p[2]+s[2])/2];
        const stepR = [(q[0]+r[0])/2, (q[1]+r[1])/2, (q[2]+r[2])/2];
        batch.top([stepS,stepR,midR,midS], '#c9bda7');
      }
      batch.face([lipS, lipR, r, s], gangway ? '#a99c8e' : '#82786d');
      if (row === 16) {
        index.add(
          [p, q, r, s].map((k) => [k[0], k[2]]),
          Math.max(r[1], s[1])
        );
      }
    }
  const handrail = Array.from({ length: 77 }, (_, i) => {
    const p = seat(-1.4 + (i * 2.8) / 76, 17);
    return [p[0], p[1] + 0.86, p[2]];
  });
  pathTube(batch, handrail, 0.1, '#c3b8a3', 5);
  // A tree-lined terrace follows the high edge of the stands to the buildings.
  const rim = (t, offset) => {
    const edge = seat(t, 17),
      p = xy((129 + offset) * Math.sin(t), -(55.3 + offset) * Math.cos(t));
    return up(p, Math.max(edge[1] - 0.06, groundY(geo, ...p) + 0.28));
  };
  for (let i = 0; i < 76; i++) {
    const a = -1.4 + (i * 2.8) / 76,
      b = a + 2.8 / 76;
    const inner = seat(a, 17),
      end = seat(b, 17),
      outer = rim(a, 5.4),
      far = rim(b, 5.4);
    batch.top([inner, end, far, outer], '#c3b598');
    batch.face(
      [
        outer,
        far,
        [far[0], groundY(geo, far[0], far[2]) - 0.28, far[2]],
        [outer[0], groundY(geo, outer[0], outer[2]) - 0.28, outer[2]],
      ],
      '#a79d88'
    );
    if (i % 3 !== 0)
      batch.top(
        [rim(a, 3.9), rim(b, 3.9), rim(b, 5.05), rim(a, 5.05)].map(([x, y, z]) => [x, y + 0.09, z]),
        '#789054'
      );
  }
  for (const side of [-1, 1]) {
    const post = (v, h, back = 0) => turf(side * (52 + back), v, h);
    pathTube(
      batch,
      [post(-3.66, 0), post(-3.66, 2.44), post(3.66, 2.44), post(3.66, 0)],
      0.105,
      '#e4e0c8',
      6
    );
    for (const v of [-3.66, 3.66])
      pathTube(batch, [post(v, 2.44), post(v, 1.2, 1.9), post(v, 0, 1.9)], 0.065, '#cbcbb3', 5);
  }
}
export const campusPlantings = Array.from({ length: 30 }, (_, i) => {
  const a = -1.35 + (2.7 * i) / 29;
  return [
    ...localFrame(field, fieldAngle)(137 * Math.sin(a), -65.5 * Math.cos(a)),
    1.28 + (i % 3) * 0.09,
    i % 6 === 1,
  ];
});
export function buildJiannan(batch, geo, lamps, index) {
  playingField(batch, geo, index);
  assemblyHall(batch, geo, lamps, index);
  wings.forEach((wing, i) => sideHouse(batch, geo, lamps, index, wing, i));
}
