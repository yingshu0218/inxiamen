import plan from './yanwu-plan.json' with { type: 'json' };
import { bridgeRoute, bridgeColumn, framePoint, highwayDeck, pathTube, strip } from './landmark-haicang.js';
import { cylinder, litSurface, mix, prism, TAU } from './scenery-mesh.js';
import { yanwuBaichengNormals, yanwuBaichengRoadLevel, yanwuBaichengWidth, yanwuPlatformLevel, yanwuRoadDatum } from './yanwu-layout.js';

const mainWidth = 26, girderDepth = 1.6;
const clamp = (t) => Math.max(0, Math.min(1, t));
function smooth(t) {
  const q = clamp(t);
  return q * q * (3 - 2 * q);
}

function profile(knots, value) {
  const i = knots.findIndex(([station]) => station >= value);
  if (i === 0) return knots[0][1];
  if (i < 0) return knots.at(-1)[1];
  const [a, low] = knots[i - 1], [b, high] = knots[i];
  return mix(low, high, smooth((value - a) / (b - a)));
}

function mainRoad(geo) {
  const start = plan.main[0], end = plan.main.at(-1);
  const levels = [[start[0], Math.max(3.34, yanwuRoadDatum(geo,start))], [-4854, 5.55], [-4710, 5.5],
    [-4518, 5.52], [-4335, 5.69], [-4170, 8.65], [-4088, 13.7], [-4028, 15.88], [-3971, 16.05],
    [-3862, 10.88], [-3715, 6.48], [-3540, 5.52], [-3255, 5.52], [-3170, 7.1],
    [-3071, 11.76], [-2930, 20.7], [end[0], yanwuRoadDatum(geo,end, 5.2)]];
  return bridgeRoute(plan.main, (_t, p) => Math.max(profile(levels, p.x), geo.heightAt(p.x, p.z) + .39));
}

function rampRoad(geo, line, project, mainAtStart, grade, landingOffset, coast) {
  const land = mainAtStart ? line.at(-1) : line[0];
  const target = coast ? yanwuBaichengRoadLevel(geo,...land) : yanwuRoadDatum(geo,land,landingOffset);
  const road = bridgeRoute(line, (t, p) => {
    const distance = mainAtStart ? t : 1 - t;
    const level = mix(profile(grade, distance), target, smooth((distance - .83) / .17));
    const fromMain = smooth(distance / .19);
    return Math.max(mix(project(p).n.h, level, fromMain), geo.heightAt(p.x,p.z) + .39);
  });
  if (!coast) return road;
  const at = road.at, step = road.step;
  const join = (n) => 1 - smooth(Math.hypot(n.x-land[0],n.z-land[1])/26);
  road.step = t => {
    const n = step(t), blend = join(n);
    return {...n, rx:mix(n.rx,coast[0],blend), rz:mix(n.rz,coast[1],blend)};
  };
  road.at = (n, lateral, above = 0) => {
    const [x,y,z] = at(n,lateral,above);
    return [x,mix(y,yanwuBaichengRoadLevel(geo,x,z)+above,join(n)),z];
  };
  return road;
}

function mainProjector(main) {
  const count = Math.ceil(main.length / 5);
  const points = Array.from({ length: count + 1 }, (_, i) => main.step(i / count));
  return function project(q) {
    let best = 0,
      distance = Infinity;
    for (let i = 0; i <= count; i++) {
      const dx = q.x - points[i].x,
        dz = q.z - points[i].z,
        squared = dx * dx + dz * dz;
      if (squared < distance) {
        distance = squared;
        best = i;
      }
    }
    const sample = points[best];
    const s = (best * main.length) / count + (q.x - sample.x) * sample.rz - (q.z - sample.z) * sample.rx;
    const n = main.step(s / main.length);
    return { n, s, lateral: (q.x - n.x) * n.rx + (q.z - n.z) * n.rz };
  };
}

// At a fork the outside lane grows out of the main slab. Both surfaces meet
// precisely at the old edge and share its grade until the two girders separate.
function makeJunction(main, project, source, mainAtStart, width, side) {
  const fraction = (d) => (mainAtStart ? d / source.length : 1 - d / source.length);
  const state = (d) => {
    const lane = source.step(fraction(d));
    const { n, s, lateral } = project(lane);
    return { lane, n, s, gap: side * lateral - mainWidth / 2 };
  };
  let split = 2;
  while (split < source.length * 0.87 && state(split).gap < width / 2) split += 2;
  let lo = Math.max(0, split - 2),
    hi = split;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (state(mid).gap < width / 2) lo = mid;
    else hi = mid;
  }
  split = (lo + hi) / 2;
  let begin = 0;
  while (begin < split && state(begin).gap + width / 2 < 0.08) begin += 1;
  const start = state(begin).s,
    end = state(split).s,
    cut = fraction(split),
    at = source.at;
  const fullFrom = mainAtStart ? cut : 0,
    fullTo = mainAtStart ? 1 : cut;
  const detached = {
    at,
    length: source.length - split,
    step(t) {
      const u = mix(fullFrom, fullTo, t),
        lane = source.step(u),
        d = (mainAtStart ? u : 1 - u) * source.length;
      if (d < split + 93) lane.h = mix(project(lane).n.h + 0.015, lane.h, smooth((d - split) / 93));
      return lane;
    },
  };
  const taper = {
    at,
    length: split - begin,
    step(t) {
      const d = mainAtStart ? mix(begin, split, t) : mix(split, begin, t),
        { lane, n } = state(d);
      const inner = main.at(n, side * mainWidth / 2),
        outer = source.at(lane, (side * width) / 2);
      const coverage = Math.max(0, ((outer[0] - inner[0]) * n.rx + (outer[2] - inner[2]) * n.rz) * side);
      const edge = coverage * smooth((d - begin) / 24),
        join = smooth((d - split + 12) / 12);
      return {
        x: mix(inner[0] + (side * n.rx * edge) / 2, lane.x, join),
        z: mix(inner[2] + (side * n.rz * edge) / 2, lane.z, join),
        rx: mix((n.rx * edge) / width, lane.rx, join),
        rz: mix((n.rz * edge) / width, lane.rz, join),
        h: n.h + 0.015,
      };
    },
  };
  return { detached, taper, side, width, start, end };
}

function slipMarkings(batch, main, j) {
  const sign = Math.sign(j.end - j.start),
    side = j.side;
  const course = (d) => main.step((j.start + sign * d) / main.length);
  const length = Math.abs(j.end - j.start);
  // Short merge dashes lead into the triangular, diagonally hatched gore.
  for (let d = 16; d < length - 38; d += 12) {
    strip(batch, main, course(d), course(d + 4), side * 11.78, side * 12.01, 0.067, '#d9d7c8');
  }
  for (let d = Math.max(4, length - 37); d < length - 1; d += 3.8) {
    const breadth = 0.24 + 1.06 * smooth(1 - (length - d) / 37);
    const a = course(d),
      b = course(d + 1.9);
    batch.top(
      [
        main.at(a, side * (12.99 - breadth), 0.069),
        main.at(a, side * (13.23 - breadth), 0.069),
        main.at(b, side * 13.0, 0.069),
        main.at(b, side * 12.77, 0.069),
      ],
      '#e5e1d0'
    );
  }
}

function roadRail(batch, road, lamps, width, openEdge) {
  const half = width / 2 - .22, count = Math.ceil(road.length / 4.6);
  const rails = [[.43, .077, '#c8cec9'], [.91, .10, '#e0e1d6']];
  for (let i = 0; i < count; i++) {
    const a = road.step(i / count), b = road.step((i + 1) / count);
    for (const side of [-1, 1]) {
      if (openEdge?.((i + .5) / count, side)) continue;
      const l = side * half;
      for (const [h, size, color] of rails) {
        const upper = h + size;
        bevel(batch, road, a, b, l, l, l, l, h, h, upper, upper, color);
        strip(batch, road, a, b, l - .05, l + .05, upper, '#e0e3db');
      }
      strip(batch, road, a, b, l - .22, l + .22, .17, '#aab2aa');
      bridgeColumn(batch, a, 0, l, [[a.h+.15,.075,.075],[a.h+1.03,.07,.07]], '#d5d9d0', 4);
      if (i % 6 === 2) lamps.add(...road.at(a, l, .55), '#ffe0b2', .82);
    }
  }
}

function abutment(batch, geo, road, width, t) {
  const n = road.step(t);
  const rim = (s, l) => { const [x,,z] = framePoint(n,s,l,0); return [x,z]; };
  const foot = Math.min(n.h - .26, geo.heightAt(n.x,n.z) - .2);
  const ring = [rim(-1.35,-width/2), rim(1.35,-width/2), rim(1.35,width/2), rim(-1.35,width/2)];
  prism(batch, ring, foot, n.h - .065, '#acb6ad', '#cad0c2');
}

function roadFurniture(batch, geo, road, lamps, width, { main = false, openEdge, poles = false, pierBlocked }) {
  // The regular low sections use closely spaced piers and thin constant-depth girders.
  // Taller gores and connector piers have more room between supports.
  for (let d = 12; d < road.length - 7;) {
    const n = road.step(d / road.length);
    for (const l of main ? [-6.15, 6.15] : [0]) {
      const [x,,z] = road.at(n, l), base = Math.max(-2.8, geo.rawHeightAt(x,z) - .22);
      const soffit = n.h - girderDepth;
      if (soffit - base < .66 || pierBlocked(road,x,z,base,soffit)) continue;
      const water = Math.min(soffit - .31, Math.max(base + .14, .65));
      const r = main ? 1.07 : .69;
      bridgeColumn(batch, n, 0, l, [[base, r * 1.28, r * 1.59], [water, r * 1.25, r * 1.54]], '#899b92', 16);
      bridgeColumn(batch, n, 0, l, [[water-.04,r,r*1.42],[soffit-.22,r,r*1.42],[soffit+.18,r*1.04,r*1.49]], '#d3d5c8', 20);
    }
    d += n.h > 10 ? (main ? 27 : 23) : (main ? 22 : 18);
  }
  roadRail(batch, road, lamps, width, openEdge);
  if (!poles) return;
  for (let d = 24; d < road.length - 20; d += 49) {
    const n = road.step(d / road.length), flank = width/2 - .56;
    const points = [[flank, .18], [flank, 6.7], [flank-.82,7.6], [flank-2,7.66]];
    pathTube(batch, points.map(([l,h])=>road.at(n,l,h)), t=>mix(.085,.046,t), '#9ea9a5', 7);
    lamps.add(...road.at(n,flank-1.9,7.6), '#ffe4ba', 1.17);
  }
}

function walkSection(t, outer) {
  if (!outer) return { inside: -3.57, outside: 3.57, split: 2.78, lower: 0 };
  const inside = profile([[0,-3.7],[.1,-4.2],[.25,-4.4],[.32,-5.2],[.38,-9.3],
    [.42,-10.2],[.49,-7.7],[.55,-4.8],[.72,-5.1],[.82,-4.8],[.95,-3.8],[1,-3.7]], t);
  const outside = profile([[0,3.7],[.15,4.7],[.26,5.4],[.34,9.7],[.39,16.2],[.44,17.1],
    [.47,14.2],[.51,9.15],[.57,5.85],[.68,5.3],[.76,6.05],[.84,4.9],[1,3.7]], t);
  const apron = Math.max(0, (outside - 6) / 13);
  return { inside, outside, split: outside - .93 - 3.78 * apron, lower: -.24 * apron };
}
function pavement(batch, road, a, b, la, lb, ra, rb, ha, hb, color, joints) {
  const uv = joints && [[la,joints[0]],[lb,joints[1]],[rb,joints[1]],[ra,joints[0]]];
  batch.top([road.at(a, la, ha), road.at(b, lb, hb), road.at(b, rb, hb), road.at(a, ra, ha)], color, uv ? 17 : 0, 0, uv);
}
function bevel(batch, road, a, b, la, lb, ra, rb, ya, yb, ua, ub, color, style = 0, ta = 0, tb = 1) {
  batch.face(
    [road.at(a, la, ya), road.at(a, ra, ua), road.at(b, rb, ub), road.at(b, lb, yb)],
    color,
    style,
    0,
    [
      [ta, 0],
      [ta, 1],
      [tb, 1],
      [tb, 0],
    ]
  );
}
function walkingRail(batch, road, a, b, la, lb, ha, hb, sign) {
  pavement(
    batch,
    road,
    a,
    b,
    la - sign * 0.25,
    lb - sign * 0.25,
    la + sign * 0.13,
    lb + sign * 0.13,
    ha + 0.24,
    hb + 0.24,
    '#dcd5bf'
  );
  bevel(
    batch,
    road,
    a,
    b,
    la + sign * 0.13,
    lb + sign * 0.13,
    la + sign * 0.13,
    lb + sign * 0.13,
    ha - 0.05,
    hb - 0.05,
    ha + 0.24,
    hb + 0.24,
    '#bbad90'
  );
  for (const h of [0.65, 1.08]) {
    const wide = h > 1 ? 0.13 : 0.08;
    bevel(batch, road, a, b, la, lb, la, lb, ha + h, hb + h, ha + h + 0.09, hb + h + 0.09, '#748985');
    pavement(
      batch,
      road,
      a,
      b,
      la - wide,
      lb - wide,
      la + wide,
      lb + wide,
      ha + h + 0.09,
      hb + h + 0.09,
      '#c5c4af'
    );
  }
}
function hasPassage(n, side, outer) {
  if (!outer || side > 0) return false;
  // The middle ramp joins the inner side of the perimeter walk.
  return Math.hypot(n.x - plan.platformMiddle[0][0], n.z - plan.platformMiddle[0][1]) < 9.5;
}
function lookoutDeck(batch, geo, lamps, obstacles, road, outer, pierBlocked) {
  const steps = Math.ceil(road.length / 4.2),
    ds = road.length / steps;
  let a = road.step(0),
    aa = walkSection(0, outer);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps,
      b = road.step(t),
      bb = walkSection(t, outer);
    const x = aa.inside,
      y = aa.outside,
      u = bb.inside,
      v = bb.outside;
    // A granite field is framed by warmer aggregate, following the full water edge.
    pavement(batch, road, a, b, x, u, x + 1.05, u + 1.05, 0, 0, '#b89478');
    pavement(batch, road, a, b, x + 1.05, u + 1.05, x + 1.27, u + 1.27, 0, 0, '#e2d9c3');
    const joints = [(i - 1) * ds, i * ds];
    pavement(batch, road, a, b, x + 1.27, u + 1.27, aa.split, bb.split, 0, 0, '#d4d2c4', joints);
    pavement(batch, road, a, b, aa.split, bb.split, y - 0.9, v - 0.9, aa.lower, bb.lower, '#d8d2c3', joints);
    pavement(batch, road, a, b, y - 0.9, v - 0.9, y, v, aa.lower, bb.lower, '#bc987d');
    if (aa.lower < -0.02 || bb.lower < -0.02) {
      bevel(batch, road, a, b, aa.split, bb.split, aa.split, bb.split, 0, 0, aa.lower, bb.lower, '#b8ab91');
    }
    for (const side of [-1, 1]) {
      const la = side < 0 ? x : y,
        lb = side < 0 ? u : v,
        ha = side < 0 ? 0 : aa.lower,
        hb = side < 0 ? 0 : bb.lower;
      bevel(
        batch,
        road,
        a,
        b,
        la,
        lb,
        la,
        lb,
        ha - 0.6,
        hb - 0.6,
        ha - 0.04,
        hb - 0.04,
        '#d7d7c5',
        litSurface.bridge,
        (i - 1) * ds,
        i * ds
      );
      bevel(batch, road, a, b, la, lb, 0.79 * la, 0.79 * lb, ha - 0.6, hb - 0.6, -0.94, -0.94, '#b3bdb0');
      bevel(
        batch,
        road,
        a,
        b,
        0.79 * la,
        0.79 * lb,
        0.2 * la,
        0.2 * lb,
        -0.94,
        -0.94,
        -1.15,
        -1.15,
        '#a0aea6'
      );
      if (!hasPassage(road.step((i - 0.5) / steps), side, outer)) {
        walkingRail(batch, road, a, b, la, lb, ha, hb, side);
      }
    }
    obstacles.add(
      [road.at(a, x), road.at(a, y), road.at(b, v), road.at(b, u)].map((p) => [p[0], p[2]]),
      Math.max(a.h, b.h) + 1.18
    );
    a = b;
    aa = bb;
  }
  for (let d = 2; d < road.length; d += 5.4) {
    const t = d / road.length,
      n = road.step(t),
      section = walkSection(t, outer);
    for (const side of [-1, 1]) {
      if (hasPassage(n, side, outer)) continue;
      const l = side < 0 ? section.inside : section.outside,
        y = n.h + (side < 0 ? 0 : section.lower);
      bridgeColumn(
        batch,
        n,
        0,
        l,
        [
          [y + 0.22, 0.12, 0.105],
          [y + 1.16, 0.105, 0.092],
        ],
        '#8d9b93',
        4
      );
    }
  }
  for (let d = 5; d < road.length - 1; d += 15.2) {
    const ta = d / road.length,
      tb = (d + 0.16) / road.length,
      a = road.step(ta),
      b = road.step(tb);
    const aa = walkSection(ta, outer),
      bb = walkSection(tb, outer);
    pavement(
      batch,
      road,
      a,
      b,
      aa.inside + 0.3,
      bb.inside + 0.3,
      aa.split,
      bb.split,
      0.023,
      0.023,
      '#a7a38f'
    );
    pavement(
      batch,
      road,
      a,
      b,
      aa.split,
      bb.split,
      aa.outside - 0.3,
      bb.outside - 0.3,
      aa.lower + 0.023,
      bb.lower + 0.023,
      '#aba28e'
    );
  }
  for (let d = 13; d < road.length - 3; d += outer ? 22 : 27) {
    const t = d / road.length,
      n = road.step(t),
      sec = walkSection(t, outer);
    for (const side of outer ? [-1, 1] : [1]) {
      if (hasPassage(n, side, outer)) continue;
      const l = side < 0 ? sec.inside : sec.outside,
        dy = side < 0 ? 0 : sec.lower;
      lamps.add(...road.at(n, l, dy + 0.38), '#ffd19a', 1.2);
    }
  }
  for (let d = 16; d < road.length - 7; d += outer ? 28 : 25) {
    const t = d / road.length,
      n = road.step(t),
      sec = walkSection(t, outer);
    const offsets = outer && sec.outside - sec.inside > 14 ? [sec.inside * 0.48, sec.outside * 0.58] : [0];
    for (const lateral of offsets) {
      const p = road.at(n, lateral),
        ground = Math.max(-1.85, geo.heightAt(p[0], p[2]) - 0.48);
      const soffit = n.h - 1.05;
      if (soffit - ground < 0.5 || pierBlocked(road,p[0],p[2],ground,soffit)) continue;
      const water = Math.min(soffit - 0.25, Math.max(ground + 0.15, 0.81));
      bridgeColumn(
        batch,
        n,
        0,
        lateral,
        [
          [ground, 0.82, 1.0],
          [water, 0.85, 1.02],
        ],
        '#859992',
        8
      );
      bridgeColumn(
        batch,
        n,
        0,
        lateral,
        [
          [water - 0.04, 0.65, 0.8],
          [mix(water, soffit, 0.7), 0.66, 0.81],
          [soffit + 0.23, 0.9, 1.23],
        ],
        '#b9c2b4',
        8
      );
    }
  }
}

const courtStart = 0.328,
  courtEnd = 0.503;
function courtProfile(t) {
  const progress = clamp((t - courtStart) / (courtEnd - courtStart));
  const spread = Math.max(0, Math.sin(progress * Math.PI)) ** 0.8;
  const ground = walkSection(t, true),
    inside = ground.inside + 0.58;
  return { inside, edge: inside + 0.24 + 15.9 * spread, spread, rise: 0.48 * smooth(spread * 2.5) };
}
function lookoutCourt(batch, road) {
  // Three shallow arcs of pale stone rise to the timber court on the landward
  // side of the crescent. The central white seat can be seen in the 2017 aerial.
  const count = 36;
  for (let i = 0; i < count; i++) {
    const ta = mix(courtStart, courtEnd, i / count),
      tb = mix(courtStart, courtEnd, (i + 1) / count);
    const a = road.step(ta),
      b = road.step(tb),
      aa = courtProfile(ta),
      bb = courtProfile(tb);
    pavement(
      batch,
      road,
      a,
      b,
      aa.inside,
      bb.inside,
      aa.edge,
      bb.edge,
      aa.rise + 0.035,
      bb.rise + 0.035,
      '#765d4e'
    );
    bevel(
      batch,
      road,
      a,
      b,
      aa.inside,
      bb.inside,
      aa.inside,
      bb.inside,
      0.03,
      0.03,
      aa.rise + 0.035,
      bb.rise + 0.035,
      '#998573'
    );
    let la = aa.edge,
      lb = bb.edge;
    for (let tier = 1; tier <= 3; tier++) {
      const nextA = la + aa.spread * 0.92,
        nextB = lb + bb.spread * 0.92;
      const lowA = aa.rise * (1 - tier / 3) + 0.035,
        lowB = bb.rise * (1 - tier / 3) + 0.035;
      bevel(
        batch,
        road,
        a,
        b,
        la,
        lb,
        la,
        lb,
        lowA + aa.rise / 3,
        lowB + bb.rise / 3,
        lowA,
        lowB,
        '#acac9c'
      );
      pavement(batch, road, a, b, la, lb, nextA, nextB, lowA, lowB, '#e3dfd1');
      la = nextA;
      lb = nextB;
    }
  }
  for (let d = 5; d < (courtEnd - courtStart) * road.length - 4; d += 5.5) {
    const ta = courtStart + d / road.length,
      tb = ta + 0.085 / road.length;
    const a = road.step(ta),
      b = road.step(tb),
      aa = courtProfile(ta),
      bb = courtProfile(tb);
    pavement(
      batch,
      road,
      a,
      b,
      aa.inside,
      bb.inside,
      aa.edge,
      bb.edge,
      aa.rise + 0.055,
      bb.rise + 0.055,
      '#88725f'
    );
  }
}
function oval(n, along, lateral, h, long, wide, pointed = false) {
  return Array.from({ length: 16 }, (_, i) => {
    const a = (i * TAU) / 16,
      c = Math.cos(a),
      s = Math.sin(a);
    const p = framePoint(n, along + long * c, lateral + wide * s * (pointed ? 0.8 + 0.18 * c : 1), h);
    return [p[0], p[2]];
  });
}
function terraceIslet(batch, n, along, lateral, long, wide) {
  // Deep seat ledges surround a dark planting lens on the curved granite terrace.
  const floor = n.h + 0.02;
  prism(batch, oval(n, along, lateral, floor, long, wide, true), floor, floor + 0.39, '#a1977e', '#dfd5ba');
  prism(
    batch,
    oval(n, along, lateral, floor, long - 0.66, wide - 0.52, true),
    floor + 0.34,
    floor + 0.49,
    '#c4b9a1',
    '#696951'
  );
  for (const [offset, scale, color] of [
    [-0.49, 1, '#688060'],
    [0.22, 1.22, '#60785d'],
    [0.59, 0.73, '#7f9269'],
  ]) {
    const p = framePoint(n, along + offset * long, lateral + offset * 0.35, floor);
    const s = scale * Math.min(1, wide / 2.25);
    cylinder(batch, p[0], p[2], floor + 0.46, floor + 0.72, 1.04 * s, 1.28 * s, color, 8);
    cylinder(batch, p[0], p[2], floor + 0.72, floor + 1.02 * s, 1.28 * s, 0.66 * s, color, 8);
  }
}
function waveSeat(batch, n, lateral) {
  const floor = n.h + 0.04;
  const rim = (scale) =>
    Array.from({ length: 32 }, (_, i) => {
      const a = (i * TAU) / 32,
        c = Math.cos(a),
        s = Math.sin(a),
        along = 4.75 * c;
      const breadth = 1.76 - 0.68 * Math.exp(-6 * c * c);
      const p = framePoint(
        n,
        scale * along,
        lateral + 0.64 * Math.sin(c * Math.PI) + scale * breadth * s,
        floor
      );
      return [p[0], p[2]];
    });
  prism(batch, rim(0.94), floor, floor + 0.4, '#d3d0c4', '#e2dfd1');
  prism(batch, rim(1), floor + 0.38, floor + 0.54, '#e5e0cf', '#f3eddb');
  for (const sign of [-1, 1]) {
    const p = framePoint(n, sign * 3.0, lateral + sign * 0.7, floor);
    cylinder(batch, p[0], p[2], floor + 0.53, floor + 0.59, 0.57, 0.58, '#b6ac93', 12, 0, '#85907a');
  }
}
function deckBench(batch, n, l, s) {
  const base = n.h;
  const rect = (length, width, h) =>
    [
      [-length, -width],
      [-length, width],
      [length, width],
      [length, -width],
    ].map(([a, b]) => {
      const p = framePoint(n, s + a, l + b, h);
      return [p[0], p[2]];
    });
  prism(batch, rect(1.37, 0.27, base), base, base + 0.36, '#a49f8c', '#aaa28d');
  prism(batch, rect(1.63, 0.43, base), base + 0.35, base + 0.48, '#b8aa8e', '#d9c4a0');
}
function visitor(batch, n, along, lateral, scale, shirt) {
  const p = framePoint(n, along, lateral, n.h + 0.025),
    y = p[1];
  for (const sign of [-1, 1]) {
    const q = framePoint(n, along + sign * 0.055, lateral + sign * 0.115, y);
    cylinder(batch, q[0], q[2], y, y + 0.83 * scale, 0.09 * scale, 0.105 * scale, '#515f5d', 5);
  }
  cylinder(batch, p[0], p[2], y + 0.78 * scale, y + 1.38 * scale, 0.16 * scale, 0.232 * scale, shirt, 6);
  cylinder(
    batch,
    p[0],
    p[2],
    y + 1.37 * scale,
    y + 1.64 * scale,
    0.115 * scale,
    0.14 * scale,
    '#ad8267',
    7
  );
  cylinder(
    batch,
    p[0],
    p[2],
    y + 1.59 * scale,
    y + 1.69 * scale,
    0.14 * scale,
    0.105 * scale,
    '#535750',
    7
  );
}
function terraceDetails(batch, road) {
  lookoutCourt(batch, road);
  const islets = [
    [0.356, 0.5, 3.3, 1.48],
    [0.375, 0.3, 2.3, 1.42],
    [0.404, 0.79, 1.7, 1.35],
    [0.446, 0.36, 2.35, 1.49],
    [0.471, 0.51, 3.2, 1.76],
  ];
  for (const [t, f, s, w] of islets) {
    const n = road.step(t),
      court = courtProfile(t);
    n.h += court.rise + 0.036;
    terraceIslet(batch, n, 0, mix(court.inside, court.edge, f), s, w);
  }
  const middle = road.step(0.416),
    profile = courtProfile(0.416);
  middle.h += profile.rise + 0.035;
  waveSeat(batch, middle, mix(profile.inside, profile.edge, 0.36));
  for (const t of [0.19, 0.271, 0.328, 0.382, 0.444, 0.493, 0.553, 0.67, 0.817]) {
    const n = road.step(t),
      sec = walkSection(t, true);
    if (t > courtStart && t < courtEnd) n.h += courtProfile(t).rise + 0.04;
    deckBench(batch, n, sec.inside + 1.92, 0);
  }
  for (const [t, l, s, shirt] of [
    [0.19, 0.46, 1.01, '#8d6d60'],
    [0.273, -0.2, 0.98, '#c6c9b7'],
    [0.343, 0.05, 0.93, '#8798a5'],
    [0.371, 0.67, 1.04, '#b3785a'],
    [0.374, 0.66, 0.72, '#d7b67a'],
    [0.396, -0.21, 1, '#a7ac95'],
    [0.426, 0.78, 0.93, '#a98176'],
    [0.43, 0.72, 1.04, '#667f83'],
    [0.469, -0.16, 0.99, '#e7d4a7'],
    [0.493, 0.53, 0.95, '#a3aa8a'],
    [0.585, 0.12, 1, '#b68f73'],
    [0.735, -0.04, 0.95, '#769398'],
    [0.844, 0.18, 0.99, '#bb9a81'],
  ]) {
    const n = road.step(t),
      sec = walkSection(t, true),
      target = l < 0 ? -l * sec.inside : l * sec.split;
    if (t > courtStart && t < courtEnd) {
      const court = courtProfile(t);
      if (target >= court.inside && target <= court.edge) n.h += court.rise + 0.035;
    }
    visitor(batch, n, 0, target, s, shirt);
  }
}

function walkway(geo, line, westRamp, eastRamp) {
  return bridgeRoute(line, (t, p) => {
    const west = westRamp * (1 - smooth(t / .092));
    const east = eastRamp * smooth((t - .828) / .172);
    const level = yanwuPlatformLevel + west + east;
    return Math.max(level, geo.heightAt(p.x,p.z) + .18);
  });
}

function starPassage(batch, middle, lamps) {
  // 星光海岸 2 号入口的十二组中空门廊。海上转弯处开始放宽、升高。
  const at = distance => middle.step(distance / middle.length);
  for (let d = 31; d < 93; d += 4) {
    const a = at(d), b = at(Math.min(93,d+4));
    strip(batch,middle,a,b,-2.15,2.15,.025,'#53678b');
  }
  for (let i = 0; i < 12; i++) {
    const n = at(36 + i * 4.9);
    const ratio = Math.sin(Math.PI * i / 22), high = mix(2.65, 3.72, ratio);
    for (const [depth, radius, color] of [[-.13,.083,'#879895'],[0,.093,'#dadcd2'],[.13,.070,'#aebbb9']]) {
      const ribs = [[-2.9,0],[-2.6,.49],[-3.12,high*.62],[-1.17,high*.69],
        [0,high],[1.17,high*.69],[3.12,high*.62],[2.6,.49],[2.9,0]];
      pathTube(batch, ribs.map(([l,h])=>framePoint(n,depth,l,n.h+h)), radius, color, 7);
    }
    for (const l of [-2.79,2.79]) lamps.add(...middle.at(n,l,.23), '#abcaf5', .76);
  }
}

const mergePlans = [
  ['yanwuOuter', true, 7.35, 1, 0, [[0,8.45],[.24,8.88],[.46,8.53],[.74,8.2],[1,10.9]]],
  ['yanwuInner', false, 7.25, 1, 0, [[0,10.85],[.23,8.72],[.51,8.50],[.76,8.6],[1,10.9]]],
  ['yanwuWest', true, 8.65, -1, 0, [[0,8.22],[.36,11.15],[.58,13.05],[.70,13.15],[.83,11.10],[1,9.85]]],
  ['yanwuEast', false, 7.85, -1, 0, [[0,6.05],[.42,6.62],[.7,8.9],[1,9.1]]],
  ['chenggongExitOuter', true, 7.85, 1, 5.2, [[0,5.55],[.25,10.4],[.46,13.7],[.73,14.0],[1,14.0]]],
  ['chenggongEntryInner', false, 7.1, -1, 5.2, [[0,5.5],[.24,6.7],[.52,10.9],[.76,13.6],[1,14.4]]],
  ['chenggongEntryOuter', false, 8.05, 1, 5.2, [[0,5.55],[.29,10.15],[.50,13.7],[.67,15.1],[1,14.6]]],
  ['chenggongExitInner', true, 7.1, -1, 5.2, [[0,5.5],[.27,7.7],[.61,10.7],[.82,13.9],[1,14.3]]],
  ['baichengSeaward', true, yanwuBaichengWidth, 1, 0, [[0,11.5],[.37,12.4],[.68,12.9],[1,11.7]]],
  ['baichengLandward', true, yanwuBaichengWidth, -1, 0, [[0,11.5],[.36,13.6],[.52,15.7],[.75,14.75],[1,11.3]]],
];

export function yanwuRoadNetwork(geo) {
  const main = mainRoad(geo), project = mainProjector(main);
  const merges = mergePlans.map(([key, start, width, side, landing, grade]) => {
    const coast = key.startsWith('baicheng') ? yanwuBaichengNormals[side < 0 ? 1 : 0] : null;
    const source = rampRoad(geo,plan[key],project,start,grade,landing,coast);
    return { key, mainAtStart: start, landing, ...makeJunction(main,project,source,start,width,side) };
  });
  const local = (road, [x,z]) => mainProjector(road)({x,z}).n.h;
  const a = local(merges.find(j=>j.key==='chenggongEntryInner').detached, plan.chenggongLink[0]);
  const b = local(merges.find(j=>j.key==='chenggongExitInner').detached, plan.chenggongLink.at(-1));
  const link = bridgeRoute(plan.chenggongLink, (t,p)=>Math.max(mix(a,b,t)+.027,geo.heightAt(p.x,p.z)+.4));
  const openEdge = (t, side) => merges.some(j=>j.side===side && t*main.length>=Math.min(j.start,j.end) &&
    t*main.length<=Math.max(j.start,j.end));
  return { main, merges, link, openEdge };
}

export function yanwuWalkNetwork(geo) {
  const shoreRise = point => Math.max(.45,geo.heightAt(...point)+.39)-yanwuPlatformLevel;
  const outer = walkway(geo, plan.platform, shoreRise(plan.platform[0]), shoreRise(plan.platform.at(-1)));
  const source = walkway(geo, plan.platformMiddle, 0, shoreRise(plan.platformMiddle.at(-1)));
  // The 2号栈桥 starts inside the common slab. The small shared nosing caps the seam.
  const shared = 4.6, from = shared / source.length;
  const middle = { ...source, length: source.length - shared, step(t) {
    const n = source.step(mix(from,1,t));
    return { ...n, h: n.h + .025 * (1-smooth(t*12)) };
  } };
  return { outer, middle };
}

function lowerDecks(entries) {
  const paths = entries.map(([road, width]) => {
    const count = Math.ceil(road.length / 5);
    return { road, reach: (width / 2 + .9)**2, samples: Array.from({length:count+1},(_,i)=>road.step(i/count)) };
  });
  return (road,x,z,base,soffit) => paths.some(other => other.road !== road && other.samples.some(p =>
    p.h > base - .2 && p.h < soffit + .65 && (p.x-x)**2+(p.z-z)**2 < other.reach));
}

function northLandings(geo, main) {
  const first = main.step(0);
  return plan.northEnds.map((start,i)=>{
    const side = i === 0 ? 1 : -1, lateral = side * mainWidth / 4;
    const [x,,z] = main.at(first,lateral);
    const road = bridgeRoute([start,[x,z]], (t,p)=>mix(Math.max(.12,geo.heightAt(p.x,p.z)+.416),first.h,smooth(t)));
    const at = road.at;
    road.at = (n,l,above) => {
      const t = 1 - smooth(Math.hypot(x-n.x,z-n.z)/road.length);
      return at({...n, rx:mix(n.rx,first.rx,t), rz:mix(n.rz,first.rz,t)},l,above);
    };
    return road;
  });
}

export function buildYanwu(batch, geo, lamps, obstacles) {
  const { main, merges, link, openEdge } = yanwuRoadNetwork(geo);
  const { outer, middle } = yanwuWalkNetwork(geo);
  const pierBlocked = lowerDecks([[main,mainWidth],[outer,10],[middle,7.14],[link,5.6],
    ...merges.map(j=>[j.detached,j.width])]);
  const deck = { fish: true, depthScale: girderDepth / 1.76, barriers: false };
  const north = northLandings(geo,main);
  highwayDeck(batch, main, obstacles, { ...deck, width: mainWidth, lanes: 3, spacing: 6.4, roadColor: '#50565a', openEdge });
  roadFurniture(batch, geo, main, lamps, mainWidth, { main: true, openEdge, pierBlocked });
  for (const road of north) highwayDeck(batch,road,obstacles,{...deck,width:mainWidth/2,lanes:1,spacing:5,roadColor:'#50565a'});
  abutment(batch, geo, main, mainWidth, 1);
  for (const j of merges) {
    const options = { ...deck, width: j.width, lanes: 1, spacing: 5.5, roadColor: '#545b5e' };
    const openInner = (_t, side) => side !== j.side;
    highwayDeck(batch, j.detached, obstacles, options);
    highwayDeck(batch, j.taper, obstacles, { ...options, openEdge: openInner });
    slipMarkings(batch, main, j);
    roadFurniture(batch, geo, j.detached, lamps, j.width, { poles: j.key.startsWith('chenggong'), pierBlocked });
    roadRail(batch,j.taper,lamps,j.width,openInner);
    if (!j.landing) abutment(batch, geo, j.detached, j.width, j.mainAtStart ? 1 : 0);
  }
  highwayDeck(batch, link, obstacles, { ...deck, width: 5.6, lanes: 1, spacing: 5.5 });
  roadRail(batch,link,lamps,5.6);
  lookoutDeck(batch, geo, lamps, obstacles, outer, true, pierBlocked);
  lookoutDeck(batch, geo, lamps, obstacles, middle, false, pierBlocked);
  terraceDetails(batch, outer);
  starPassage(batch, middle, lamps);
  main.name = '演武大桥双向车流';
  main.carOffsets = [2.3, 5.95, 9.55];
  main.streetClearance = 14.6;
  main.approaches = [...merges.flatMap(j=>[
    Object.assign(j.detached,{streetClearance:j.width/2+6.3}),
    Object.assign(j.taper,{streetClearance:j.width/2+5.8}),
  ]),Object.assign(link,{streetClearance:7.1}),...north.map(road=>Object.assign(road,{streetClearance:8.1}))];
  return [main];
}
