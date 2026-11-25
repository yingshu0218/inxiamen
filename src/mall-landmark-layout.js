import { inRing } from './scenery-mesh.js';

// Phase I/II outlines follow the bundled building survey. Jiahe Road
// lies between the plots, and Xianyue Road runs along their southern edge.
export const smOne = [
  [-282.5,-2527],[-283.5,-2531],[-236,-2539.5],[-253.5,-2632],[-238,-2634.5],[-241,-2648.5],
  [-255,-2646.5],[-271,-2730],[-317.5,-2721],[-318.5,-2726],[-379,-2714.5],[-342,-2516],
];
export const smTwo = [
  [-552,-2361],[-532.5,-2362.5],[-513.5,-2367.5],[-511,-2374],[-488,-2376],[-488,-2385],
  [-496,-2387],[-491.5,-2403.5],[-496,-2419],[-504,-2425.5],[-499,-2432],[-480.5,-2425.5],
  [-467,-2425.5],[-461.5,-2428],[-463.5,-2444],[-453.5,-2449],[-452,-2466],
  [-451,-2484],[-444,-2485],[-445,-2496],[-458,-2499.5],[-458,-2488.5],[-465.5,-2480.5],
  [-481,-2486],[-492,-2504.5],[-499,-2509.5],[-518,-2507.5],[-553,-2500],
  [-554,-2491],[-568,-2495.5],[-565,-2433],
];
export const smTwoBridgeWing = [
  [-535,-2513],[-526,-2543],[-485,-2554],[-444,-2559],[-436,-2535],
  [-435,-2522],[-475,-2513],[-497,-2510],[-519,-2502],
];
export const smBridge = [[-439.5,-2528],[-347.5,-2547.3]];
export const smTopaz = [-466,-2460];
export const smThree = [
  [-524.5,-2657],[-520.5,-2667],[-456,-2666],[-452.5,-2677],[-479,-2758],[-610,-2732],
  [-585,-2593.5],[-575,-2593],[-572.5,-2582.5],[-562,-2583],[-555.5,-2558],[-496.5,-2564],
];
export const smThreeBridge = [[-456,-2679],[-373,-2694]];
export const smFourB = [[-265,-2750],[-200,-2762],[-164.5,-2531],[-215,-2521.5]];
export const smFourC = [[-395,-2827],[-214.5,-2862],[-200,-2762],[-375,-2733.5]];
const smFourSurvey = [[-215,-2521.5],[-164.5,-2531],[-214.5,-2862],[-395,-2827],[-375,-2733.5],[-262.5,-2753]];
const smGrounds = [smOne,smTwo,smTwoBridgeWing,smThree,smFourSurvey];
export const smReserved = (x,z) =>
  x > -615 && x < -160 && z > -2870 && z < -2355 &&
  (smGrounds.some(ring=>inRing(x,z,ring)) ||
    Math.hypot(x-smTopaz[0],z-smTopaz[1]) < 34);

export const smMallViews = [
  {
    id: 'sm-xiamen', name: '厦门 SM 城市广场', kind: '从仙岳路看一期、宝石三馆与跨街连廊',
    x: -414, z: -2548, focusHeight: 21, fov: 45, portraitFovBoost: 28,
    view: { x: -486, z: -2133, y: 302 },
    portraitView: { x: -462, z: -1973, y: 355 },
  },
  {
    id: 'sm-xiamen-top', name: 'SM 商圈俯视', viewOnly: true, kind: '看一至四期的位置与两条跨嘉禾路天桥',
    x: -389, z: -2604, focusHeight: 20, fov: 52, portraitFovBoost: 27,
    view: { x: -383, z: -2491, y: 656 },
    portraitView: { x: -380, z: -2400, y: 735 },
  },
  {
    id: 'sm-chao', name: 'SM 三期与 CHAO BLOCK', kind: '从东南看国际中心三塔和三期酒店的位置',
    x: -338, z: -2659, focusHeight: 31, fov: 45, portraitFovBoost: 26,
    view: { x: 28, z: -2404, y: 298 },
    portraitView: { x: 137, z: -2367, y: 407 },
  },
  {
    id: 'sm-chao-walk', name: 'CHAO BLOCK 蓝色内街', kind: '沿一期东侧看首开区和空中连桥',
    x: -244, z: -2612, focusHeight: 9, fov: 44, portraitFovBoost: 29,
    view: { x: -202, z: -2475, y: 50 },
    portraitView: { x: -195, z: -2434, y: 74 },
  },
];

// The north wing turns from Zhongshan Road into Siming South Road. The
// southern footprint shares the diagonal street frontage in the city survey.
export const ccNorth = [
  [-4917,2617],[-4913,2635],[-4907,2662],[-4895,2687],[-4880,2701],[-4863,2708],
  [-4848,2692],[-4865,2681],[-4878,2662],[-4885,2632],[-4889,2617],
];
export const ccSouth = [
  [-4839,2728],[-4728,2830.5],[-4707,2878.5],[-4684,2882.5],[-4652.5,2876],
  [-4678.5,2811],[-4718.5,2771],[-4758.5,2723],[-4798,2700],
];
export const ccChapel = [-4835.9,2642];
export const ccReserved = (x,z) =>
  x > -4923 && x < -4650 && z > 2593 && z < 2885 &&
  (inRing(x,z,ccNorth) || inRing(x,z,ccSouth) ||
    (Math.abs(x-ccChapel[0]) < 14 && Math.abs(z-ccChapel[1]) < 17) ||
    (Math.abs(x+4834.25) < 1 && Math.abs(z-2734.38) < 1));

export const ccMallViews = [
  {
    id: 'zhonghua-city', name: '中华城', kind: '看思明南路圆角骑楼、屋顶露台与新街堂',
    x: -4793, z: 2732, focusHeight: 20, fov: 42, portraitFovBoost: 22,
    view: { x: -5062, z: 2846, y: 285 },
    portraitView: { x: -5112, z: 2917, y: 330 },
    portraitFocus: { x: -4802, z: 2722, y: 20 },
  },
  {
    id: 'zhonghua-city-top', name: '中华城街廓俯视', viewOnly: true, kind: '核对南北商业街廓和台光街的间隔',
    x: -4797, z: 2730, focusHeight: 10, fov: 44, portraitFovBoost: 29,
    view: { x: -4885, z: 2807, y: 521 },
    portraitView: { x: -4907, z: 2804, y: 633 },
  },
];

// Main commercial footprint and the two independent terminal-side volumes.
// Their common promenade stops at the north end of the modeled ferry hall.
export const seaMall = [
  [-5430,-1823.3],[-5388.7,-1822.7],[-5388.5,-1826.1],[-5347.5,-1825.7],[-5365.7,-1708.1],
  [-5387.7,-1576.1],[-5391.7,-1547.7],[-5404.4,-1548.7],[-5417,-1457.1],[-5408,-1455.1],
  [-5415.4,-1405],[-5442.4,-1239.6],[-5530.4,-1253.6],[-5468.5,-1670.7],[-5454.2,-1668.3],
];
export const seaAnnex = [
  [-5530.4,-1253.6],[-5442.4,-1239.6],[-5445,-1222.5],[-5450.5,-1186.6],
  [-5479.2,-996.4],[-5552.8,-1007.2],[-5565.6,-1009],
];
export const seaDeck = [[-5565.6,-1009],[-5552.8,-1007.2],[-5588.4,-765.9],[-5600.9,-767.4]];
export const seaPromenade = [
  [-5475,-1817],[-5496,-1670],[-5518,-1532],[-5540,-1380],[-5556,-1251],
  [-5582,-1104],[-5597,-1003],[-5614,-887],[-5625,-789],[-5613,-747],[-5597,-727],
];
export const seaWheel = [-5432,-1510];
// These split records straddle the commercial shells' mapped edges.
const seaEdgeParts = [[-5483.17,-1579.92],[-5454.43,-1125.29],[-5447.83,-1167.58],[-5532.2,-1264.5]];
export const seaReserved = (x,z) =>
  x > -5602 && x < -5345 && z > -1827 && z < -766 &&
  (inRing(x,z,seaMall) || inRing(x,z,seaAnnex) || inRing(x,z,seaDeck) ||
    seaEdgeParts.some(([u,v])=>Math.abs(x-u)<1 && Math.abs(z-v)<1));

export const seaMallViews = [
  {
    id: 'sea-world', name: '东渡海上世界', kind: '从西港看潮汐之眼、商业屋顶和滨水岸线',
    x: -5464, z: -1510, focusHeight: 33, fov: 40, portraitFovBoost: 35,
    view: { x: -5950, z: -1110, y: 300 },
    portraitView: { x: -6010, z: -1014, y: 416 },
  },
  {
    id: 'sea-world-top', name: '海上世界与东渡码头俯视', viewOnly: true, kind: '沿滨水线核对商场、摩天轮和客运码头',
    x: -5517, z: -1153, focusHeight: 14, fov: 61, portraitFovBoost: 11,
    view: { x: -5798, z: -1228, y: 762 },
    portraitView: { x: -5850, z: -1046, y: 1050 },
  },
];
