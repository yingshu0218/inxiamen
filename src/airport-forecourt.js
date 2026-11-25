import { ShapeUtils, Vector2 } from 'three';
import { forecourtLevel, sampleTaxiRoute, t3Forecourt, t3SouthRoad, t4Forecourt } from './airport-layout.js';
import { ellipse, localFrame, rect, up } from './landmark-forms.js';
import { MeshBatch, cylinder, litSurface, prism, randomSource, TAU } from './scenery-mesh.js';
import { treeInstances } from './scenery-life.js';

const identity = (s, r) => [s, r];
const asphalt = '#646861', lane = '#5f645e', paint = '#ece7d7', curb = '#c8c4b5';
const paving = '#bfbaa6', rimTone = '#aaa491', grass = '#697a48', hedge = '#536742';
const roadStyle = litSurface.streetAsphalt, stoneStyle = litSurface.graniteMall;

function clippedCorners(s0, r0, s1, r1, cut) {
  return [[s0 + cut, r0], [s1 - cut, r0], [s1, r0 + cut], [s1, r1 - cut],
    [s1 - cut, r1], [s0 + cut, r1], [s0, r1 - cut], [s0, r0 + cut]];
}

function plantingOutline(s, r, rx, rz, phase) {
  return Array.from({ length: 36 }, (_, i) => {
    const angle = i * TAU / 36, wave = 1 + .14 * Math.sin(2 * angle + phase) + .075 * Math.sin(5 * angle - phase);
    return [s + rx * Math.cos(angle) * wave, r + rz * Math.sin(angle) * wave];
  });
}

function plotGeometry(ground, props, world, site, datum, lamps, trees, palms, rng) {
  const level = (r) => forecourtLevel(site, datum, r);
  const position = (s, r, lift) => up(world(s, r), level(r) + lift);
  function tile(ring, lift, color, style = 0) {
    ground.top(ring.map(([s, r]) => position(s, r, lift)), color, style, 0, ring);
  }
  function surface(ring, lift, color, style = 0) {
    const outline = ring.map(([s, r]) => new Vector2(s, r));
    for (const triangle of ShapeUtils.triangulateShape(outline, [])) {
      tile(triangle.map(i => ring[i]), lift, color, style);
    }
  }
  function plate(s0, r0, s1, r1, lift, color, style = 0) {
    const slices = Math.ceil((r1 - r0) / 7);
    for (let i = 0; i < slices; i++) {
      const a = r0 + (r1 - r0) * i / slices, b = r0 + (r1 - r0) * (i + 1) / slices;
      tile([[s0, a], [s1, a], [s1, b], [s0, b]], lift, color, style);
    }
  }
  function verge(outline, bottom, top, wall) {
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      props.face([position(...a, bottom), position(...a, top), position(...b, top), position(...b, bottom)], wall);
    }
  }
  function strip(points, width, lift, color, style = 0) {
    const { path } = sampleTaxiRoute({ points });
    const edges = path.map(([s, r], i) => {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
      const ds = b[0] - a[0], dr = b[1] - a[1], scale = width / (2 * Math.hypot(ds, dr));
      return [[s - dr * scale, r + ds * scale], [s + dr * scale, r - ds * scale]];
    });
    for (let i = 1; i < edges.length; i++) {
      tile([edges[i - 1][0], edges[i][0], edges[i][1], edges[i - 1][1]], lift, color, style);
    }
  }
  function stoneBed(ring, insetRing, bottom, top, color) {
    verge(ring, bottom, top, rimTone);
    surface(ring, top, curb, stoneStyle);
    surface(insetRing, top + .026, color, litSurface.airportTurf);
  }
  function plant(s, r, lift, scale, palm = false) {
    (palm ? palms : trees).push([...position(s, r, lift), scale, rng() * TAU, rng()]);
  }
  function lamp(s, r, height, twin = false) {
    const [x, y, z] = position(s, r, .12), top = y + height;
    cylinder(props, x, z, y, top, .15, .072, '#737b75', 6);
    prism(props, rect(world, s, r, twin ? 2.8 : 1.09, .44), top - .12, top + .085,
      '#858b82', '#b7b8a7');
    for (const side of twin ? [-.95, .95] : [0]) {
      const [px, pz] = world(s + side, r);
      lamps.add(px, top - .08, pz, '#ffe1aa', twin ? 2.3 : 1.62);
    }
  }
  function bench(s, r, angle = 0) {
    const along = localFrame([s, r], angle), bottom = level(r) + .27;
    const foot = (u, v) => world(...along(u, v));
    for (const u of [-.9, .9]) {
      prism(props, rect(foot, u, 0, .3, .50), bottom, bottom + .45, '#797b6e', '#8e8b7b');
    }
    prism(props, rect(foot, 0, 0, 2.65, .55), bottom + .43, bottom + .54, '#a98961', '#b49770');
  }
  function stopCanopy(s, r) {
    const y = level(r) + .4;
    for (const u of [-6.2, 0, 6.2]) {
      const [x, z] = world(s + u, r + .76);
      cylinder(props, x, z, y, y + 2.62, .09, .07, '#858f8a', 6);
    }
    prism(props, rect(world,s,r,15.7,2.55), y + 2.58, y + 2.79, '#8b9a97', '#a9ada3',
      0, 0, 0, litSurface.railRoof);
    for (const u of [-3, 3]) bench(s + u,r + .53);
  }
  return { tile, surface, plate, strip, stoneBed, plant, lamp, bench, stopCanopy, level };
}

function buildT3(garden) {
  const { plate, strip, surface, stoneBed, plant, lamp, bench, stopCanopy } = garden;
  plate(1003, 620, 1322, 822, .19, '#697750', litSurface.airportTurf);
  plate(1003, 620, 1322, 637, .24, paving, stoneStyle);
  plate(1003, 806, 1322, 822, .24, '#b8b19d', stoneStyle);
  const walks = [
    [[1009,652],[1039,639],[1071,641],[1100,648],[1129,662],[1158,671],[1188,661],[1214,648],[1252,641],[1283,643],[1317,655]],
    [[1009,695],[1036,681],[1074,672],[1103,680],[1132,694],[1163,704],[1196,701],[1234,683],[1260,678],[1289,684],[1317,696]],
    [[1009,736],[1040,722],[1073,709],[1106,715],[1134,732],[1166,751],[1192,754],[1222,737],[1254,717],[1284,716],[1317,735]],
    [[1009,779],[1041,787],[1070,779],[1102,765],[1128,774],[1166,794],[1202,792],[1229,777],[1262,767],[1293,778],[1317,789]],
  ];
  for (const [i, walk] of walks.entries()) {
    const width = i === 0 ? 12 : 5.2;
    strip(walk, width + 1.4, .234, '#a79e87', stoneStyle);
    strip(walk, width, .283, i ? '#bdb69f' : '#d1c6ad', stoneStyle);
  }
  for (const s of [1009, 1317]) {
    strip([[s,628], [s,700], [s,767], [s,819]], 6.7, .267, '#c5bca7', stoneStyle);
  }
  strip([[1139,816],[1156,799],[1166,777],[1166,752],[1163,731],[1163,706],[1158,674]],
    7.0, .306, '#c9bda4', stoneStyle);
  strip([[1158,672],[1153,659],[1152,646],[1152,623]], 8.7, .309, '#cfc4ab', stoneStyle);

  surface(ellipse(identity,1152,646,26,17,44), .34, '#d1c5aa', stoneStyle);
  const central = ellipse(identity,1152,646,18.6,11.5,42);
  stoneBed(central, ellipse(identity,1152,646,16.5,9.4,42), .34, .89, '#5b713e');
  plant(1152,646,.93,.99);
  plant(1144,646,.93,.69);
  plant(1160,646,.93,.67);

  for (const [index, [s,r,x,z,scale,palm]] of [
    [1048,657,16,6,.72,false],[1099,657,10.4,5.05,.84,true],[1235,657,11,5.7,.82,true],[1272,658,14,6.2,.70,false],
    [1050,698,13.5,7.1,.80,false],[1098,700,15,7.2,.92,false],[1134,711,8.3,6.2,.69,true],
    [1204,714,13,6.4,.78,false],[1257,698,13,7.1,.86,false],[1290,703,10,6.9,.70,true],
    [1057,748,17,11,1.15,false],[1098,742,14,8.3,.89,false],[1138,756,13.8,8.4,.93,false],
    [1206,769,16,7.0,.95,false],[1243,752,14,11,1.08,false],[1284,744,12.9,7.8,.84,false],
    [1037,801,16,5.3,.72,true],[1110,795,13,5.6,.83,false],[1268,797,18,7.5,.81,true],
  ].entries()) {
    const phase = .8 + index * 1.73, raised = r < 665;
    const outline = plantingOutline(s,r,x,z,phase);
    if (raised) stoneBed(outline,plantingOutline(s,r,x - 1.05,z - .84,phase),.23,.60,grass);
    else surface(outline,.233,index % 2 ? '#606f46' : '#647749',litSurface.airportTurf);
    const lift = raised ? .645 : .232;
    plant(s,r,lift,scale,palm);
    for (const [u,v] of [[-.54,.16],[.46,-.22],[.36,.42],[-.43,-.37]]) {
      plant(s + u * x,r + v * z,lift,.26 + .13 * Math.abs(Math.sin(index + u * 9)));
    }
  }
  for (const s of [1027,1061,1095,1123,1184,1211,1252,1283,1306]) {
    lamp(s,628,5.4);
    bench(s,634);
  }
  for (const [s,r] of [[1013,665],[1006,712],[1007,758],[1007,801],[1318,668],
    [1317,718],[1318,771],[1319,811],[1091,813],[1208,812]]) lamp(s,r,4.3);

  strip(t3SouthRoad,10.5,.386,lane,roadStyle);
  const south = sampleTaxiRoute({ points: t3SouthRoad }).path;
  for (let i = 2; i < south.length - 2; i += 3) strip([south[i - 1],south[i]],.14,.412,'#d8c99d');
  plate(1133,829.1,1180,835.5,.397,paving,stoneStyle);
  for (let s = 1145.9; s < 1150.5; s += .91) plate(s,818.9,s + .42,828.4,.42,paint);
  stopCanopy(1141.5,832.5);
  stopCanopy(1168.8,832.5);
}

function parkedCar(props, world, level, s, r, angle, paintColor, length, height) {
  const local = localFrame([s, r], angle);
  const base = level(r) + .42;
  const at = (x, y, z) => up(world(...local(x, z)), base + y);
  const half = length / 2, width = .90;
  const chassis = [[-half,-.67],[-half+.27,-width],[half-.40,-width],[half,-.63],
    [half,.63],[half-.40,width],[-half+.27,width],[-half,.67]];
  prism(props, chassis.map(p => world(...local(...p))), base + .25, base + .87, paintColor, paintColor);
  const glassBase = [[-1.52,-.82],[1.16,-.82],[1.16,.82],[-1.52,.82]];
  const roof = [[-1.06,-.63],[.58,-.63],[.66,.63],[-1.06,.63]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    props.face([at(glassBase[i][0],.87,glassBase[i][1]),at(glassBase[j][0],.87,glassBase[j][1]),
      at(roof[j][0],height,roof[j][1]),at(roof[i][0],height,roof[i][1])], '#435860');
  }
  props.top(roof.map(([x,z]) => at(x,height,z)), paintColor);
  for (const x of [-half + .92, half - .90]) {
    for (const v of [-.76,.76]) {
      const wheel = (u,z) => world(...local(u,z));
      prism(props, rect(wheel,x,v,.56,.34), base + .01, base + .46, '#343935', '#3c423d');
    }
  }
  for (const v of [-.56,.56]) {
    props.face([at(half + .01,.54,v - .14),at(half + .01,.72,v - .14),
      at(half + .01,.72,v + .14),at(half + .01,.54,v + .14)], '#ded6bc');
    props.face([at(-half - .01,.54,v - .15),at(-half - .01,.72,v - .15),
      at(-half - .01,.72,v + .15),at(-half - .01,.54,v + .15)], '#9e4940');
  }
}

function parkingRows(park, props, world, rng, aisles, rows, [first, last]) {
  const { plate, stoneBed, plant, lamp, level } = park;
  const carColors = ['#d6d5cc','#e8e5d9','#414c54','#9da5a2','#6d767b','#914e48','#d8d7ce','#304652','#c4bbb0'];
  for (const [i, s] of aisles.entries()) {
    plate(s - 3.1,first,s + 3.1,last,.388,lane,roadStyle);
    for (const [from,to,occupancy] of rows) {
      for (const side of [-1,1]) {
        const s0 = s + side * 3.34, s1 = s + side * 8.48;
        const low = Math.min(s0,s1), high = Math.max(s0,s1);
        plate(s1 - .046,from,s1 + .046,to,.416,paint);
        for (let r = from; r + 2.54 < to; r += 2.62) {
          plate(low,r,high,r + .087,.419,paint);
          if (rng() < occupancy) {
            parkedCar(props,world,level,(low + high) * .5 + .14 * (rng() - .5),r + 1.30,
              (side < 0 ? 0 : Math.PI) + (rng() - .5) * .044,
              carColors[Math.floor(rng() * carColors.length)],4.02 + rng() * .70,1.33 + rng() * .24);
          }
        }
      }
    }
    if (i === aisles.length - 1) continue;
    const median = (s + aisles[i + 1]) * .5;
    for (const [start,end] of rows) {
      const from = start + 3, to = end - 2;
      stoneBed(clippedCorners(median - 2.75,from,median + 2.75,to,2),
        clippedCorners(median - 2.32,from + .45,median + 2.32,to - .45,1.55),.35,.62,hedge);
      for (let r = from + 7; r < to - 3; r += 15.8) plant(median,r,.657,.56 + rng() * .15);
      lamp(median,to - 3,9.4,true);
    }
  }
}

function buildT4(park, props, world, rng) {
  const { plate, tile, strip, surface, plant, lamp, bench } = park;
  surface(clippedCorners(2880,808,3125,1024,9), .34, asphalt, roadStyle);
  surface(clippedCorners(3138,811,3369,1024,12), .19, '#687951', litSurface.airportTurf);
  plate(2965,1034,3129,1124,.34,asphalt,roadStyle);
  plate(2885,801,3362,816,.43,'#b4b09e',stoneStyle);
  plate(2889,801,3354,801.68,.453,curb,stoneStyle);
  plate(3124,827,3130,1017,.367,'#898b7b',stoneStyle);

  for (const road of [
    [[2859,824],[2874,826],[2887,824],[2916,823],[3108,823],[3126,824],[3135,837]],
    [[2865,895],[2908,895],[2994,895],[3103,895],[3127,895],[3134,889]],
    [[2880,969],[2959,969],[3031,969],[3094,969],[3126,969],[3134,963]],
    [[3135,814],[3135,874],[3134,941],[3134,1001],[3134,1016],[3133,1098],[3133,1123],[3129,1140]],
    [[2889,1015],[3004,1015],[3071,1015],[3098,1016],[3134,1016]],
    [[2980,1041],[3050,1041],[3117,1042],[3134,1041]],
    [[2977,1116],[3050,1116],[3106,1116],[3133,1112]],
  ]) strip(road,7.7,.382,lane,roadStyle);

  parkingRows(park,props,world,rng,[2905,2932,2959,2986,3013,3040,3067,3094],
    [[832,888,.40],[902,962,.32],[976,1009,.22]],[821,1015]);
  parkingRows(park,props,world,rng,[2978,3004,3030,3056,3082,3108],
    [[1048,1108,.27]],[1041,1116]);
  for (const s of [2891,2954,3017,3078,3112]) {
    for (let y = 819.5; y < 827; y += 1.18) plate(s - 1.7,y,s + 1.7,y + .52,.422,paint);
  }
  for (const s of [2905,2959,3013,3067,3094]) {
    for (const r of [828,899,974]) {
      tile([[s - .35,r],[s + .35,r],[s + .89,r + 1.30],[s,r + 2.3],[s - .89,r + 1.30]],
        .423,paint);
    }
  }
  for (const s of [2911,2968,3027,3089,3144,3214,3290,3342]) {
    lamp(s,805,6.9);
    bench(s - 6,808);
  }

  strip([[3150,815],[3146,855],[3148,908],[3148,958],[3152,1007],[3346,1007],[3358,997],[3362,958],[3361,909],[3355,861],[3337,820]],
    5.7,.292,'#b5b099',stoneStyle);
  strip([[3148,905],[3169,916],[3204,941],[3245,954],[3293,950],[3332,913],[3354,890]],
    3.4,.318,'#bdb59d',stoneStyle);
  strip([[3228,811],[3238,839],[3246,863],[3241,892],[3237,920],[3245,954]],
    3.1,.319,'#a5a991',stoneStyle);

  for (const [s,r,rx,rz,phase] of [
    [3170,853,17,30,0],[3192,840,23,18,1],[3248,824,26,9,1],
    [3301,844,29,25,2],[3337,867,15,20,1],
    [3330,952,17,21,0],[3172,987,16,14,2],[3280,988,20,11,1],
  ]) {
    surface(plantingOutline(s,r,rx,rz,phase),.232,phase % 2 ? '#607249' : '#5d7048',litSurface.airportTurf);
    for (let i = 0; i < 8; i++) {
      const a = phase + i * TAU / 8, spread = .34 + .40 * rng();
      plant(s + Math.cos(a) * rx * spread,r + Math.sin(a) * rz * spread,.242,
        i % 3 === 0 ? .69 + rng() * .38 : .28 + rng() * .32,i === 2);
    }
  }
  for (const [s,r] of [[3148,844],[3148,893],[3149,954],[3160,1005],[3200,1006],
    [3251,1006],[3310,1006],[3354,985],[3361,933],[3361,885]]) lamp(s,r,4.5);
}

export function buildAirportForecourts(parent, frame, runway, material, lamps) {
  const ground = new MeshBatch(), props = new MeshBatch();
  const trees = [], palms = [], rng = randomSource(48721);
  const plot = (site) => plotGeometry(ground, props, frame.world, site, runway.elevation, lamps, trees, palms, rng);
  buildT3(plot(t3Forecourt));
  buildT4(plot(t4Forecourt), props, frame.world, rng);
  ground.finish(parent, material, '高崎 · 园林广场与停车场铺装').receiveShadow = true;
  const fixtures = props.finish(parent, material, '高崎 · 停车、花坛与照明');
  fixtures.castShadow = fixtures.receiveShadow = true;
  treeInstances(parent, trees, false, rng);
  treeInstances(parent, palms, true, rng);
}
