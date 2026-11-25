import { neicuoaoViews } from './gulangyu-neicuoao.js';
import { coastalFlight, coastalViews } from './coast/views.js';
import { CatmullRomCurve3, Vector3 } from 'three';
import { stationPoint } from './railway-layout.js';
import { gaoqiRailwayViews } from './gaoqi-railway-layout.js';
import { center as haicangCenter, deckDistance, inWestHarborView } from './haicang-layout.js';
import { airportFrame, terminal3, terminal4 } from './airport-layout.js';
import { culturePoint, exhibitionPoint, theatreCentre } from './venue-layout.js';
import { civicPoint, dongduPoint, governmentPoint, pearlCentre } from './west-landmark-layout.js';
import { mixcCentre, nanhuCentre, sportsCentre } from './downtown-landmark-layout.js';
import { parkViews } from './parks/views.js';
import { eastDistrictViews } from './east-district-layout.js';
import { islandWorkplaceViews } from './island-workplace-views.js';
import { lianbanViews } from './lianban-layout.js';
import { ccMallViews, seaMallViews, smMallViews } from './mall-landmark-layout.js';
import { sunlight, summitLevel, summitPoint } from './sunlight-layout.js';
import { yanwuViews } from './yanwu-layout.js';

export function project(lon, lat) {
  return { x: (lon - 118.125) * 101220, z: (24.48 - lat) * 111100 };
}

export const runway = {
  start: { x: -1071.9, z: -6080.3 },
  end: { x: 1652.9, z: -8214.2 },
  elevation: 16,
  surfaceHeight: 16.29,
  width: 45,
  threshold05Offset: 150,
};
const dx = runway.end.x - runway.start.x,
  dz = runway.end.z - runway.start.z;
runway.length = Math.hypot(dx, dz);
runway.ux = dx / runway.length;
runway.uz = dz / runway.length;
runway.heading = Math.atan2(dx, -dz);

export function runwayPoint(distance, altitude = runway.elevation) {
  return new Vector3(
    runway.start.x + runway.ux * distance,
    altitude,
    runway.start.z + runway.uz * distance
  );
}
export function runwayFrame(x, z) {
  const rx = x - runway.start.x,
    rz = z - runway.start.z;
  return { along: rx * runway.ux + rz * runway.uz, cross: -rx * runway.uz + rz * runway.ux };
}
const waypoints = [],
  node = (point) => waypoints.push(point) - 1;
function waypoint(lon, lat, altitude) {
  const { x, z } = project(lon, lat);
  return node(new Vector3(x, altitude, z));
}
node(runwayPoint(75, 18));
node(runwayPoint(650, 44));
node(runwayPoint(2200, 150));
node(runwayPoint(runway.length + 900, 285));
waypoint(118.1712, 24.5635, 330);
waypoint(118.1881, 24.5545, 350);
const wuyuan = waypoint(118.1995, 24.5382, 305);
waypoint(118.2095, 24.5128, 310);
waypoint(118.205, 24.4837, 320);
waypoint(118.1908, 24.466, 315);
waypoint(118.1655, 24.4590, 435);
waypoint(118.1478, 24.4518, 422);
const mountain = waypoint(118.1313, 24.4511, 348);
waypoint(118.1100, 24.4415, 355);
waypoint(118.0911, 24.4348, 244);
waypoint(118.0902, 24.4318, 198);
const huandao = waypoints.length;
for (const [x,z,height] of coastalFlight) node(new Vector3(x,height,z));
waypoint(118.1790, 24.5492, 310);
waypoint(118.1995, 24.5510, 320);
waypoint(118.2118, 24.5290, 320);
waypoint(118.2075, 24.4770, 310);
waypoint(118.1854, 24.4531, 290);
const beach = waypoint(118.1617, 24.4396, 275);
waypoint(118.1455, 24.427, 255);
waypoint(118.13, 24.4183, 260);
waypoint(118.1103, 24.4167, 285);
waypoint(118.1028, 24.4261, 199);
const campus = waypoint(118.0940, 24.4344, 113);
const temple = waypoint(118.0931, 24.4414, 114);
waypoint(118.0864, 24.4405, 183);
waypoint(118.0869, 24.4329, 226);
const bridge = waypoint(118.0844, 24.429, 255);
waypoint(118.073, 24.4333, 265);
const cityWaypoint = (x,z,height) => node(new Vector3(x,height,z));
cityWaypoint(-4750,4640,237);
cityWaypoint(-4290,3750,211);
cityWaypoint(-4290,2990,202);
cityWaypoint(-4500,2680,139);
cityWaypoint(-4902,2604,82);
cityWaypoint(-5240,2626,64);
const zhongshan = cityWaypoint(-5419,2648,24);
cityWaypoint(-5540,2669,58);
cityWaypoint(-5653,2705,72);
const ferry = cityWaypoint(-5812,2636,39);
cityWaypoint(-5906,2414,96);
const lujiang = cityWaypoint(-5910,2163,88);
cityWaypoint(-6160,1870,175);
cityWaypoint(-6680,1890,182);
cityWaypoint(-6870,2230,186);
cityWaypoint(-6690,2590,150);
const island = waypoint(118.06555, 24.45265, 113);
waypoint(118.06785, 24.4491, 137);
const rock = waypoint(118.06555, 24.4451, 151);
const garden = waypoint(118.0666, 24.4397, 92);
waypoint(118.0606, 24.4372, 140);
waypoint(118.0529, 24.4378, 157);
waypoint(118.0451, 24.4480, 189);
waypoint(118.0453, 24.4688, 212);
waypoint(118.0520, 24.4814, 208);
const haicang = waypoint(118.06595, 24.4897, 134);
waypoint(118.0738, 24.4921, 146);
waypoint(118.0789, 24.4959, 262);
waypoint(118.0838, 24.4905, 343);
waypoint(118.0829, 24.4810, 226);
waypoint(118.0865, 24.4740, 111);
const park = waypoint(118.09028, 24.47425, 57);
waypoint(118.0962, 24.4794, 174);
const broadcast = cityWaypoint(-2860,-505,106);
const broadcastGate = cityWaypoint(-2723,-562,43);
cityWaypoint(-2582,-575,48);
const hubinFront = cityWaypoint(-2449,-593,57);
cityWaypoint(-2373,-620,124);
const lake = waypoint(118.1022, 24.4859, 304);
const railwayWaypoint = (u, v, y) => cityWaypoint(...stationPoint(u, v), y);
function railwayLocation(u, v) {
  const [x, z] = stationPoint(u, v);
  return { x, z };
}
cityWaypoint(-2460, 17, 223);
railwayWaypoint(-480, 164, 151);
railwayWaypoint(-225, 199, 110);
const railway = railwayWaypoint(-92, 216, 86);
railwayWaypoint(36, 207, 95);
railwayWaypoint(175, 181, 124);
const railwayYard = railwayWaypoint(282, 153, 181);
railwayWaypoint(480, 83, 246);
railwayWaypoint(543, -145, 231);
const wucun = railwayWaypoint(329, -318, 167);
railwayWaypoint(174, -441, 182);
railwayWaypoint(184, -650, 248);
waypoint(118.1110, 24.4888, 332);
waypoint(118.1125, 24.5015, 341);
waypoint(118.0962, 24.5155, 338);
waypoint(118.067, 24.532, 375);
waypoint(118.089, 24.5595, 350);
waypoint(118.132, 24.5778, 340);
waypoint(118.17, 24.59, 335);
const approach = node(runwayPoint(runway.length + 4370, 266));
node(runwayPoint(runway.length + 2110, 139));
node(runwayPoint(runway.length + 840, 70));
node(runwayPoint(runway.length + 180, 33));
node(runwayPoint(runway.length - 120, 20));
node(runwayPoint(runway.length - 420, 17));
node(runwayPoint(runway.length - 1800, 17));

const spline = new CatmullRomCurve3(waypoints, false, 'centripetal');
const subdivisions = 32;
const points = spline.getPoints((waypoints.length - 1) * subdivisions);
const distances = new Float64Array(points.length);
for (let i = 1; i < points.length; i++) {
  distances[i] =
    distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
}
export const routeLength = distances[distances.length - 1];
const atNode = (index) => distances[index * subdivisions];
export const approachDistance = atNode(approach);
export const stations = [
  { id: 'airport', name: '高崎机场', kind: '跑道出发', distance: 0, ...runway.start },
  {
    id: 'wuyuan',
    name: '五缘湾',
    kind: '海湾巡航',
    distance: atNode(wuyuan),
    ...project(118.1779, 24.5342),
  },
  {
    id: 'mountain', name: '东坪山', kind: '俯瞰山间水库',
    focusHeight: 178, fov: 45,
    distance: atNode(mountain), ...project(118.12697, 24.45342),
  },
  {id:'huandao', name:'环岛路 · 白城起飞', kind:'沿岸连续飞至五缘湾', distance:atNode(huandao),
    x:-2790,z:4985,focusHeight:6,fov:53,chartName:'白城',chartOffset:[16,26]},
  {
    id: 'beach',
    name: '黄厝沙滩',
    kind: '沿岸平飞',
    distance: atNode(beach),
    ...project(118.1564, 24.4443),
  },
  { id: 'campus', name: '厦大建南楼群', kind: '上弦场看红瓦楼群', distance: atNode(campus), x: -3251, z: 4803, focusHeight: 22, fov: 46 },
  { id: 'temple', name: '南普陀寺', kind: '沿中轴看四殿', distance: atNode(temple), x: -3342, z: 4027, focusHeight: 28, fov: 36 },
  {
    id: 'bridge',
    name: '演武大桥',
    kind: '海上看双子塔',
    distance: atNode(bridge),
    ...project(118.0838, 24.4374),
  },
  { id: 'zhongshan', name: '中山路', kind: '沿骑楼望向海港', distance: atNode(zhongshan), x: -5490, z: 2658, focusHeight: 10, fov: 49, flybyMetres: 390 },
  { id: 'ferry', name: '轮渡码头', kind: '海上看双厅与客轮', distance: atNode(ferry), x: -5752, z: 2516, focusHeight: 7, fov: 43, flybyMetres: 420 },
  { id: 'lujiang', name: '鹭江道', kind: '沿滨海大道回望老城', distance: atNode(lujiang),
    x: -5836, z: 2208, lookAt: {x: -5618, z: 2726}, focusHeight: 10, fov: 48, flybyMetres: 530 },
  {
    id: 'island',
    name: '鼓浪屿',
    kind: '北岸看八卦楼',
    focusHeight: 57, fov: 46,
    distance: atNode(island),
    ...project(118.06323, 24.45013),
  },
  {
    id: 'haicang', name: '海沧大桥', kind: '西港看悬索桥',
    focusHeight: 66, fov: 42, portraitFovBoost: 38,
    distance: atNode(haicang), x: haicangCenter[0], z: haicangCenter[1],
  },
  { id: 'park', name: '白鹭洲公园', kind: '临湖看白鹭女神', distance: atNode(park), x: -3662, z: 462, focusHeight: 7, fov: 33 },
  { id: 'broadcast', name: '广电大楼', kind: '从筼筜湖看广播电视中心', distance: atNode(broadcast),
    x: -2696, z: -689, focusHeight: 53, fov: 40, flybyMetres: 440, followFocus: true },
  {
    id: 'lake', name: '筼筜湖', kind: '俯瞰筼筜湖东段',
    focusHeight: 8, fov: 47,
    distance: atNode(lake), ...project(118.0968, 24.4800),
  },
  { id: 'railway', name: '厦门火车站', kind: '从南广场看白鹭展翅站房', distance: atNode(railway),
    ...railwayLocation(0, 0), lookAt: railwayLocation(0, 60),
    focusHeight: 28, fov: 46, portraitFovBoost: 25, flybyMetres: 290, followFocus: true },
  { id: 'arrival', name: '高崎返航', kind: '进近着陆', distance: approachDistance + 350, ...runway.end },
];
const [rockX,rockZ] = summitPoint, [cliffX,cliffZ] = sunlight.inscription;
export const islandViews = [
  {id:'gulangyu', name:'全岛鸟瞰', viewOnly:true, x:-6340, z:3615, focusHeight:25, fov:47, portraitFovBoost:41,
    frameIsland:'gulangyu', view:{x:-5090,z:2430,y:605}, portraitView:{x:-5080,z:4875,y:650}},
  {id:'rock', name:'日光岩', kind:'近看岩顶与登山石阶', distance:atNode(rock), entryLight:'morning',
    x:rockX, z:rockZ, lookAt:{x:rockX+3.4,z:rockZ-.1}, focusHeight:89.65, fov:54,
    view:{x:rockX+19.6,z:rockZ+1.6,y:89.65}, portraitView:{x:rockX+22.5,z:rockZ+.3,y:89.1},
    portraitFocus:{x:rockX+3,z:rockZ-.2,y:89.40}, portraitFovBoost:16, chartName:'日光岩', chartOffset:[-17,33]},
  {id:'rock-profile', name:'双岩侧景', x:rockX,z:rockZ,lookAt:{x:rockX+12,z:rockZ+4},
    focusHeight:70.7, fov:43, entryLight:'afternoon', view:{x:rockX+21,z:rockZ+95,y:81},
    portraitView:{x:rockX+24,z:rockZ+125,y:82},portraitFovBoost:17},
  {id:'rock-lookout', name:'岩顶眺望', x:rockX,z:rockZ,lookAt:{x:rockX+1450,z:rockZ-710},focusHeight:14,fov:62,
    view:{x:rockX+1.25,z:rockZ-.60,y:summitLevel+1.73}},
  {id:'rock-inscriptions', name:'摩崖石刻', x:cliffX,z:cliffZ,focusHeight:54.0,fov:49,entryLight:'morning',
    view:{x:cliffX+43,z:cliffZ+10,y:58},portraitView:{x:cliffX+43,z:cliffZ+8,y:56}},
  {id:'sanqiutian', name:'三丘田码头', x:-6092,z:3018,focusHeight:4.5,fov:48,
    view:{x:-5992,z:2946,y:56},portraitView:{x:-5934,z:2921,y:79}},
  {id:'piano-wharf', name:'钢琴码头', x:-5711,z:3429,focusHeight:5,fov:48,
    view:{x:-5626,z:3453,y:39},portraitView:{x:-5581,z:3468,y:63}},
  ...neicuoaoViews,
  {id:'neicuoao', name:'内厝澳码头', x:-7239,z:3427,focusHeight:6,fov:47,
    view:{x:-7330,z:3384,y:35},portraitView:{x:-7360,z:3362,y:56}},
  {id:'trinity', name:'三一堂', x:-6366,z:3658,focusHeight:36,fov:43,
    view:{x:-6317,z:3710,y:60}},
  {id:'longtou', name:'龙头路', x:-5891,z:3652,focusHeight:13.1,fov:56,
    view:{x:-5857,z:3637,y:16.4},portraitView:{x:-5851,z:3634,y:17.2}},
  {id:'catholic', name:'天主堂', x:-5789,z:3737,focusHeight:30,fov:44,
    view:{x:-5754,z:3764,y:39},portraitView:{x:-5742,z:3780,y:43}},
  {id:'huangrongyuan', name:'黄荣远堂', x:-5734,z:3768,entryLight:'morning',
    view:{x:-5744.9,z:3791.7,y:23.4},lookAt:{x:-5740.5,z:3775.0},focusHeight:24,fov:67,
    portraitFocus:{x:-5737.5,z:3772.2,y:24.6},portraitFovBoost:18},
  {id:'bagua-gallery', name:'八卦楼海侧柱廊', x:-6252,z:3319,focusHeight:57,fov:47,
    view:{x:-6204,z:3261,y:56},portraitView:{x:-6190,z:3240,y:60}},
  {id:'garden-shore', name:'菽庄西门与海堤', x:-6182,z:4215,focusHeight:6.8,fov:51,
    view:{x:-6218,z:4252,y:22.4},portraitView:{x:-6236,z:4268,y:27.8}},
  {id:'garden-bridge', name:'四十四桥与渡月亭', x:-6149,z:4292,focusHeight:4,fov:53,
    view:{x:-6185,z:4344,y:20},portraitView:{x:-6199,z:4365,y:25}},
  {id:'haitiantang', name:'海天堂构', x:-5796,z:3832,focusHeight:27,fov:48,
    view:{x:-5737,z:3774,y:63},portraitView:{x:-5720,z:3754,y:88}},
  {id:'haoyue', name:'皓月园', x:-5386,z:4015,focusHeight:31,fov:44,
    view:{x:-5348,z:3969,y:44},portraitView:{x:-5331,z:3953,y:51}},
  {id: 'garden', name: '菽庄花园', kind: '四十四桥', distance: atNode(garden), x: -6149, z: 4301, focusHeight: 4, fov: 43},
].map(site=>({...site,parent:'island'}));
export const sunlightView = islandViews.find(site=>site.id==='rock');
export const broadcastViews = [
  {id:'broadcast-gate', parent:'broadcast', name:'广电前庭', kind:'低空看门厅与双碟天线', distance:atNode(broadcastGate),
    x:-2701, z:-668, focusHeight:16, fov:40, flybyMetres:165, followFocus:true},
  {id:'hubin-frontage', parent:'broadcast', name:'湖滨北路街景', kind:'沿公交站看临街店面', distance:atNode(hubinFront),
    x:-2590, z:-692, focusHeight:35, portraitFocus:{x:-2529,z:-699,y:15}, fov:52, flybyMetres:142, followFocus:true},
];
const railwayViews = [
  { id: 'railway-yard', parent: 'railway', name: '铁路站场', kind: '俯瞰站台雨棚与动车组', distance: atNode(railwayYard),
    ...railwayLocation(151, 6), focusHeight: 21, fov: 51, portraitFovBoost: 29, flybyMetres: 305, followFocus: true },
  { id: 'wucun', parent: 'railway', name: '梧村街区', kind: '俯瞰厦禾路、高架公交与北广场', distance: atNode(wucun),
    ...railwayLocation(-1, -172), focusHeight: 36, fov: 45, portraitFovBoost: 27, flybyMetres: 220, followFocus: true },
];
const districtViews = [
  {id:'hubin-sili', parent:'railway', name:'湖滨四里 · 回迁社区', x:-2178,z:139,focusHeight:23,fov:53,view:{x:-2030,y:392,z:350}},
  {id:'sili-court', parent:'railway', name:'湖滨四里 · 院落街口', x:-2170,z:148,focusHeight:25,fov:55,view:{x:-2079,y:102,z:292}},
  {id:'wucun-overhead', parent:'railway', name:'梧村至莲坂 · 千米俯视', viewOnly:true, x:-1140,z:420, view:{x:-1140,y:1015,z:523}},
  {id:'wucun-oblique', parent:'railway', name:'梧村至莲坂 · 沿线航拍', x:-938,z:260, view:{x:-1460,y:315,z:920}},
  {id:'lvquan-row', parent:'railway', name:'绿泉新村 · 住宅楼列', x:-1524,z:480, focusHeight:24,fov:48,view:{x:-1524,y:94,z:553}},
  {id:'lehai-blocks', parent:'jimei', name:'集美桥头 · 乐海路住宅', x:-2115,z:-11840, focusHeight:18,fov:54,view:{x:-1670,y:289,z:-11490}},
  {id:'xiangan-d07', parent:'xiangan', name:'翔安桥头 · 海屿原', x:7790,z:-10220, focusHeight:49,fov:47,view:{x:7440,y:215,z:-10015}},
  {id:'old-town-blocks', parent:'zhongshan', name:'中山路街坊', x:-4870,z:2670, view:{x:-5290,y:315,z:3060}},
  {id:'huli-blocks', parent:'haicang', name:'湖里工业片区', x:-2200,z:-3790, view:{x:-2690,y:310,z:-3410}},
  {id:'jimei-blocks', parent:'xiamen-bridge', name:'厦门大桥 · 集美岸街区', x:-3680,z:-10200, view:{x:-3450,y:310,z:-9650}},
].map(site => ({focusHeight:14,fov:56,...site}));
const campusViews = [
  { id: 'campus-overview', name: '厦大 · 校园总览', kind: '白城上空看建南、群贤与芙蓉湖',
    x: -3244, z: 4569, focusHeight: 32, fov: 58, portraitFovBoost: 23,
    view: { x: -2670, z: 5118, y: 392 },
    portraitView: { x: -2820, z: 5610, y: 630 } },
  { id: 'campus-jiannan', name: '厦大 · 上弦场与建南', kind: '越过跑道看弧形看台与大会堂',
    x: -3260, z: 4794, focusHeight: 20, fov: 58, portraitFovBoost: 24,
    view: { x: -3214, z: 4951, y: 76 },
    portraitView: { x: -3260, z: 5060, y: 105 } },
  { id: 'campus-qunxian', name: '厦大 · 群贤楼群', kind: '从演武场看五栋校舍和贯通木廊',
    x: -3500, z: 4517, focusHeight: 19, fov: 61, portraitFovBoost: 24,
    view: { x: -3583, z: 4684, y: 49 },
    portraitView: { x: -3554, z: 4720, y: 123 } },
  { id: 'campus-furong', name: '厦大 · 芙蓉湖与颂恩楼', kind: '从芙蓉湖东岸看嘉庚广场和主楼',
    x: -3280, z: 4465, focusHeight: 38, fov: 48, portraitFovBoost: 26,
    view: { x: -3060, z: 4543, y: 84 },
    portraitView: { x: -2950, z: 4560, y: 92 } },
  { id: 'campus-baicheng', name: '厦大 · 白城校门', kind: '由白城向北望石拱门与校道',
    x: -2814.7, z: 4921.6, lookAt: { x: -2816, z: 4900 }, focusHeight: 18.7, fov: 77, portraitFovBoost: 10,
    view: { x: -2814, z: 4930, y: 19.5 },
    portraitView: { x: -2814, z: 4930.3, y: 19.7 } },
].map(site => ({ parent: 'campus', ...site }));
export const tourStops = [...stations, ...coastalViews, ...yanwuViews, ...islandViews, ...broadcastViews, ...railwayViews, ...districtViews, ...campusViews,
  ...eastDistrictViews.filter(site => site.parent)];

const airport = airportFrame(runway);
function airportPoint(s, r, y) {
  const [x, z] = airport.world(s, r);
  return { x, z, y };
}
export const airportViews = [
  {
    id: 'gaoqi-t3', name: '高崎 T3 航站楼', ...airportPoint(...terminal3),
    lookAt: airportPoint(1130, 453), focusHeight: 28, fov: 50, portraitFovBoost: 26,
    view: airportPoint(813, 131, 155), portraitView: airportPoint(460, -391, 285),
    portraitFocus: airportPoint(1080, 453, 28),
  },
  {
    id: 'gaoqi-t4', name: '高崎 T4 航站楼', ...airportPoint(...terminal4),
    lookAt: airportPoint(3077, 553), focusHeight: 33, fov: 53, portraitFovBoost: 26,
    view: airportPoint(3355, 267, 171), portraitView: airportPoint(3300, -180, 267),
  },
  {
    id: 'gaoqi-t3-plaza', name: 'T3 园林广场', ...airportPoint(1152, 711),
    lookAt: airportPoint(1149, 725), focusHeight: 16, fov: 52, portraitFovBoost: 28,
    view: airportPoint(1245, 963, 137), portraitView: airportPoint(1210, 1213, 220),
    portraitFocus: airportPoint(1152, 713, 16),
  },
  {
    id: 'gaoqi-t4-parking', name: 'T4 停车场', ...airportPoint(3062, 912),
    lookAt: airportPoint(3102, 900), focusHeight: 17, fov: 51, portraitFovBoost: 26,
    view: airportPoint(3003, 1227, 179), portraitView: airportPoint(3030, 1370, 226),
    portraitFocus: airportPoint(3010, 904, 17),
  },
  {
    id: 'gaoqi-runway', name: '高崎跑道全景', ...airportPoint(1120, 112),
    focusHeight: 20, fov: 52, portraitFovBoost: 21,
    view: airportPoint(-198, -81, 215), portraitView: airportPoint(-252, -74, 285),
  },
  {
    id: 'gaoqi-industry', name: '高崎航空产业园 · 总览', kind: '从枋钟路上空看两处艾德园区、航材中心与机场',
    x: 1590, z: -6740, lookAt: { x: 1570, z: -6815 }, focusHeight: 15, fov: 54, portraitFovBoost: 24,
    view: { x: 1630, y: 550, z: -6260 }, portraitView: { x: 1610, y: 665, z: -6200 },
  },
  {
    id: 'gaoqi-industry-ed', name: '高崎航空产业园 · 艾德楼群', kind: '斜看厂房排布与高崎南十二路',
    x: 1515, z: -6695, focusHeight: 24, fov: 54, portraitFovBoost: 24,
    view: { x: 1515, y: 190, z: -6480 }, portraitView: { x: 1515, y: 252, z: -6440 },
  },
  {
    id: 'gaoqi-industry-materials', name: '高崎航空产业园 · 国际航材中心', kind: '近看航材仓、维修楼和玻璃办公楼',
    x: 1821, z: -6742, focusHeight: 27, fov: 51, portraitFovBoost: 24,
    view: { x: 1825, y: 125, z: -6933 }, portraitView: { x: 1825, y: 173, z: -6990 },
  },
];

function venuePoint(frame, u, v, y) {
  const [x, z] = frame(u, v);
  return { x, z, y };
}

const groundPoint = ([x, z]) => ({ x, z });

export const venueViews = [
  ...gaoqiRailwayViews,
  {
    id: 'exhibition', name: '国际会展中心', kind: '从海上看主馆与两翼展厅',
    ...venuePoint(exhibitionPoint, 7, 20), focusHeight: 31, fov: 41, portraitFovBoost: 35,
    view: venuePoint(exhibitionPoint, 718, 345, 270),
    portraitView: venuePoint(exhibitionPoint, 968, 448, 430),
    portraitFocus: venuePoint(exhibitionPoint, 35, -7, 28),
    chartName: '会展中心', chartOffset: [10, -7],
  },
  {
    id: 'theatre', name: '海峡大剧院', kind: '近看三重挑檐与沿海柱廊',
    ...venuePoint(exhibitionPoint, ...theatreCentre), focusHeight: 23, fov: 42, portraitFovBoost: 32,
    view: venuePoint(exhibitionPoint, 425, -105, 99),
    portraitView: venuePoint(exhibitionPoint, 510, -80, 152),
  },
  {
    id: 'culture', name: '文化艺术中心', kind: '俯瞰四馆与文化长廊',
    ...venuePoint(culturePoint, 23, 9.2), focusHeight: 21, fov: 46, portraitFovBoost: 31,
    view: venuePoint(culturePoint, 356, 214, 151),
    portraitView: venuePoint(culturePoint, 445, 288, 254),
    chartName: '文化艺术中心', chartOffset: [-12, -23],
  },
  {
    id: 'dongdu', name: '东渡客运码头', kind: '从西港看波形候船楼与浮码头',
    ...venuePoint(dongduPoint, 28, -24), focusHeight: 14, fov: 40, portraitFovBoost: 36,
    view: { x: -5857, z: -365, y: 97 },
    portraitView: { x: -5935, z: 10, y: 156 },
    portraitFocus: { x: -5565, z: -455, y: 13 },
    chartName: '东渡码头', chartOffset: [-16, -13],
  },
  {
    id: 'weather', name: '狐尾山气象台', kind: '近看海上明珠观光塔与球幕影院',
    ...groundPoint(pearlCentre), lookAt: { x: -4581, z: -509 },
    groundRelative: true, focusHeight: 30, fov: 39, portraitFovBoost: 23,
    view: { x: -4350, z: -367, y: 49 },
    portraitView: { x: -4320, z: -393, y: 64 },
  },
  {
    id: 'people-hall', name: '人民会堂', kind: '从筼筜湖看弧形门厅与临湖台阶',
    ...venuePoint(civicPoint, 0, 21), focusHeight: 17, fov: 38, portraitFovBoost: 24,
    view: venuePoint(civicPoint, 64, 169, 48),
    portraitView: venuePoint(civicPoint, 43, 226, 82),
  },
  {
    id: 'city-hall', name: '厦门市政府', kind: '近看市府玻璃立面与石材门廊',
    ...venuePoint(governmentPoint, 7, -5), focusHeight: 25, fov: 37, portraitFovBoost: 30,
    view: venuePoint(governmentPoint, -28, 120, 50),
    portraitView: venuePoint(governmentPoint, -16, 194, 78),
    portraitFocus: venuePoint(governmentPoint, 10, -4, 24),
  },
  {
    id: 'sports', name: '厦门体育中心', kind: '俯瞰体育场跑道与综合健身馆',
    ...groundPoint(sportsCentre), focusHeight: 10, fov: 42, portraitFovBoost: 36,
    view: { x: -2180, z: -688, y: 151 },
    portraitView: { x: -2380, z: -532, y: 271 },
    portraitFocus: { x: -2132, z: -981, y: 10 },
  },
  {
    id: 'mixc', name: '厦门万象城', kind: '看一期双塔和屋顶花园、二期裙楼与湖滨南路',
    ...groundPoint(mixcCentre), lookAt: { x: -1968, z: 459 }, focusHeight: 70, fov: 44, portraitFovBoost: 27,
    view: { x: -1526, z: 562, y: 267 },
    portraitView: { x: -1345, z: 591, y: 355 },
  },
  {
    id: 'mixc-link', name: '万象城跨街连廊', kind: '俯看 94.4 米连廊的转折和三层落点',
    x: -1986, z: 390, focusHeight: 15, fov: 44, portraitFovBoost: 29,
    view: { x: -1785, z: 368, y: 171 },
    portraitView: { x: -1740, z: 376, y: 218 },
  },
  {
    id: 'nanhu', name: '南湖公园', kind: '俯瞰桃花岛、湖亭与后埭溪步桥',
    ...groundPoint(nanhuCentre), lookAt: { x: -2510, z: -35 },
    focusHeight: 2.2, fov: 45, portraitFovBoost: 31,
    view: { x: -2640, z: 74, y: 207 },
    portraitView: { x: -2740, z: 90, y: 255 },
  },
  {
    id: 'nanhu-link', name: '南湖公园东西园步桥', kind: '看后埭溪钢桥、两岸落点和湖光路接合',
    x: -2582, z: 53, focusHeight: 2.1, fov: 44, portraitFovBoost: 27,
    view: { x: -2620, z: 19, y: 25 },
    portraitView: { x: -2634, z: 8, y: 39 },
  },
  ...parkViews,
  { id:'torch-huizhi', name:'火炬园 · 荟智空间', kind:'俯看研发楼、光伏屋面和楼间庭院',
    x:-553,z:-4402,focusHeight:40,fov:47,view:{x:-733,y:213,z:-4296},portraitView:{x:-756,y:263,z:-4280} },
  ...eastDistrictViews.filter(site => !site.parent),
  ...islandWorkplaceViews,
  ...lianbanViews,
  ...smMallViews,
  ...ccMallViews,
  ...seaMallViews,
];

const viewpoint = (lon, lat, y) => ({ ...project(lon, lat), y });
export const crossingViews = [
  {
    id: 'xiangan', name: '翔安大桥', kind: '湖里至翔安 · 海上弯线',
    ...project(118.1749, 24.56324), lookAt: project(118.17865, 24.5617), focusHeight: 17, fov: 54, portraitFovBoost: 27,
    view: viewpoint(118.1918, 24.5782, 480),
    portraitView: viewpoint(118.1596, 24.5439, 520), chartOffset: [9, -8],
  },
  {
    id: 'jimei', name: '集美大桥', kind: '机场北侧 · 中央 BRT',
    ...project(118.1236, 24.5748), lookAt: project(118.12205, 24.57733), focusHeight: 19, fov: 55, portraitFovBoost: 27,
    view: viewpoint(118.10026, 24.58249, 435),
    portraitView: viewpoint(118.1134, 24.5894, 500), chartOffset: [7, -10],
  },
  {
    id: 'xiamen-bridge', name: '厦门大桥', kind: '高崎至集美 · 低矮连续梁',
    ...project(118.09665, 24.56005), lookAt: project(118.09714, 24.5582), focusHeight: 12, fov: 55, portraitFovBoost: 24,
    view: viewpoint(118.10865, 24.54665, 369), chartOffset: [-11, -15],
  },
  {
    id: 'gaoji', name: '高集海堤', kind: '实体堤身 · 开口与地铁',
    ...project(118.0946, 24.5594), lookAt: project(118.09502, 24.55875), focusHeight: 6, fov: 56, portraitFovBoost: 23,
    view: viewpoint(118.0893, 24.5610, 229),
    portraitView: viewpoint(118.0993, 24.5519, 330), chartOffset: [-13, 11],
  },
];

function segment(distance) {
  let low = 0,
    high = distances.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (distances[mid] <= distance) low = mid;
    else high = mid;
  }
  return low;
}
export function routePoint(distance, out = new Vector3()) {
  const d = Math.max(0, Math.min(routeLength, distance)),
    i = segment(d);
  const t = (d - distances[i]) / (distances[i + 1] - distances[i]);
  return out.lerpVectors(points[i], points[i + 1], t);
}
export function routeHeading(distance) {
  const a = routePoint(distance - 10),
    b = routePoint(distance + 10);
  return Math.atan2(b.x - a.x, a.z - b.z);
}
export function nearestRoute(x, z, min = 0, max = routeLength) {
  const first = segment(Math.max(0, min)),
    last = segment(Math.min(max, routeLength));
  let best = Infinity,
    along = distances[first];
  for (let i = first; i <= last; i++) {
    const a = points[i],
      b = points[i + 1],
      vx = b.x - a.x,
      vz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
    const square = (x - a.x - t * vx) ** 2 + (z - a.z - t * vz) ** 2;
    if (square < best) {
      best = square;
      along = distances[i] + t * (distances[i + 1] - distances[i]);
    }
  }
  return { distance: along, gap: Math.sqrt(best) };
}
export const mapRoute = points.filter((_, i) => i % 5 === 0).map((p) => [p.x, p.z]);
const namedPlaces = [...stations.slice(0, -1), ...coastalViews, ...islandViews, ...crossingViews, ...venueViews]
  .filter(station => !station.viewOnly);
const haicangPlace = stations.find(station => station.id === 'haicang');
export function nearbyStation(x, z) {
  const bridgeGap = deckDistance(x, z);
  if (bridgeGap <= 110) return { station: haicangPlace, gap: bridgeGap };
  let best = stations[0],
    squared = Infinity;
  for (const station of namedPlaces) {
    if (station.parent === 'island' && Math.hypot(station.x-x,station.z-z)>560) continue;
    const d = (x - station.x) ** 2 + (z - station.z) ** 2;
    if (d < squared) {
      best = station;
      squared = d;
    }
  }
  return { station: best, gap: Math.sqrt(squared) };
}

export function selectedFlightPlace(station, flight, inFlyby) {
  // The launch camera is framed on the selected site even if the aircraft
  // starts closer to a different landmark. Let the live place label resume
  // after moving away from that initial viewpoint.
  if (station?.id === 'haicang' && inWestHarborView(flight.x, flight.z)) return station.name;
  if (station && (flight.km < .22 || (station.parent && inFlyby))) return station.name;
  return null;
}

export function lightFlightPlace(flight, departurePlace, nearbyPlace) {
  const { along, cross } = runwayFrame(flight.x, flight.z);
  const overRunway = along >= 0 && along <= runway.length && Math.abs(cross) <= runway.width * .55;
  // A ground roll is on the whole runway, including the far end well away
  // from the airport marker at the other threshold.
  if (flight.grounded && overRunway) return stations[0].name;
  if (departurePlace) return departurePlace;
  if (flight.phase === 'approach') return '高崎返航';
  return overRunway ? stations[0].name : nearbyPlace;
}
