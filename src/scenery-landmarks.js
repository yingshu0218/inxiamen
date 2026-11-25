import { MeshBatch } from './scenery-mesh.js';
import { eastDistrictReserved } from './east-district-layout.js';
import { buildGuanyinBusiness, buildSoftwareOne, buildSoftwareTwo } from './landmark-east-districts.js';
import { buildTowers, towersReserved } from './landmark-towers.js';
import { buildGulangyu, gulangyuReserved } from './landmark-gulangyu.js';
import { buildIslandHeritage } from './gulangyu-heritage.js';
import { buildSunlightTemple } from './landmark-sunlight-temple.js';
import { buildIslandWharves } from './gulangyu-wharves.js';
import { buildYanwu } from './landmark-yanwu.js';
import { buildHaicang, haicangReserved } from './landmark-haicang.js';
import { buildXiangan, buildJimei, buildXiamenBridge, buildGaoji } from './landmark-north-crossings.js';
import { buildNorthInscription } from './landmark-north-inscriptions.js';
import { northInscriptions, northInscriptionReserved } from './north-inscription-layout.js';

import { buildNanputuo, templeReserved } from './landmark-nanputuo.js';
import { buildJiannan, campusReserved } from './landmark-jiannan.js';
import { buildCampus } from './landmark-campus.js';
import { campusInfillReserved } from './campus-layout.js';
import { buildBailuzhou, parkReserved } from './landmark-bailuzhou.js';
import { buildZhongshan } from './landmark-zhongshan.js';
import { buildFerry, buildLujiang } from './landmark-lujiang.js';
import { buildBroadcast } from './landmark-broadcast.js';
import { buildHubinRoad } from './landmark-hubin-road.js';
import { buildHubinSports } from './landmark-hubin-sports.js';
import { hubinReserved } from './hubin-layout.js';
import { railwayReserved } from './railway-layout.js';
import { buildRailwayStation } from './landmark-railway.js';
import { gaoqiRailwayReserved } from './gaoqi-railway-layout.js';
import { buildGaoqiRailway } from './landmark-gaoqi-railway.js';
import { wucunReserved } from './wucun-layout.js';
import { brtReserved } from './brt-layout.js';
import { buildWucunRoads } from './landmark-wucun-roads.js';
import { buildWucunBuildings } from './landmark-wucun-buildings.js';
import { buildExhibition, buildTheatre } from './landmark-exhibition.js';
import { buildCultureCentre } from './landmark-culture.js';
import { venueReserved } from './venue-layout.js';
import { buildDongdu } from './landmark-dongdu.js';
import { buildWeatherHill } from './landmark-weather.js';
import { buildCivicCenter } from './landmark-civic.js';
import { westLandmarkReserved } from './west-landmark-layout.js';
import { downtownReserved } from './downtown-landmark-layout.js';
import { buildSportsGym } from './landmark-sports-gym.js';
import { buildMixc } from './landmark-mixc.js';
import { buildBay, buildFude } from './parks/bay-fude.js';
import { siteReserved } from './parks/bay-fude-layout.js';
import { parkModelReserved } from './parks/layout.js';
import { buildZhongshanPark, buildWetland, buildExpo } from './parks/landscapes.js';
import { buildNanhu } from './landmark-nanhu.js';
import { buildLianbanGuomao } from './landmark-lianban.js';
import { lianbanReserved } from './lianban-layout.js';
import { buildSmXiamen } from './landmark-sm.js';
import { buildZhonghuaCity } from './landmark-zhonghua-city.js';
import { buildSeaWorld } from './landmark-sea-world.js';
import { ccReserved, seaReserved, smReserved } from './mall-landmark-layout.js';

export function landmarkReserved(x, z) {
  return (
    eastDistrictReserved(x, z) ||
    siteReserved(x,z) || parkModelReserved(x,z) || towersReserved(x, z) || templeReserved(x, z) ||
    campusReserved(x,z) || campusInfillReserved(x,z) || parkReserved(x, z) || hubinReserved(x,z) || railwayReserved(x, z) ||
    gaoqiRailwayReserved(x, z) || wucunReserved(x, z) || brtReserved(x, z) || venueReserved(x, z) ||
    gulangyuReserved(x, z) || westLandmarkReserved(x, z) || downtownReserved(x, z) || northInscriptionReserved(x, z) ||
    lianbanReserved(x, z) || smReserved(x, z) || ccReserved(x, z) || seaReserved(x, z) ||
    (x > -6450 && x < -4930 && z > -2010 && z < -1770 && haicangReserved(x, z))
  );
}

const sites = [
  ['厦门软件园一期 · 曾厝垵南北两区', buildSoftwareOne],
  ['厦门软件园二期 · 望海路与观日路', buildSoftwareTwo],
  ['东海岸观音山 · 国际商务营运中心', buildGuanyinBusiness],
  ['世茂海峡双子塔', buildTowers],
  ['演武大桥与观景平台', buildYanwu],
  ['鼓浪屿 · 八卦楼、日光岩与菽庄花园', buildGulangyu],
  ['日光岩 · 东壁摩崖石刻与岩下寺院', buildSunlightTemple],
  ['鼓浪屿 · 历史建筑与皓月园', buildIslandHeritage],
  ['鼓浪屿 · 三丘田、钢琴与内厝澳码头', buildIslandWharves],
  ['海沧大桥与西港引桥', buildHaicang],
  ['翔安大桥', buildXiangan],
  ['集美大桥与快速公交', buildJimei],
  ['厦门大桥', buildXiamenBridge],
  ['高集海堤与地铁一号线', buildGaoji],
  ['南普陀寺 · 殿堂与放生池', buildNanputuo],
  ['厦门大学 · 建南楼群与上弦场', buildJiannan],
  ['厦门大学 · 群贤、芙蓉湖、嘉庚楼群和白城校门', buildCampus],
  ['中山路 · 骑楼街与鹭江宾馆', buildZhongshan],
  ['轮渡码头 · 候船厅、登船桥与浮码头', buildFerry],
  ['鹭江道 · 滨海大道与海滨公园', buildLujiang],
  ['白鹭洲公园 · 白鹭女神与湖滨步道', buildBailuzhou],
  ['厦门广播电视中心 · 主楼、演播楼与卫星天线', buildBroadcast],
  ['湖滨北路 · 湖东桥与环湖步道', buildHubinRoad],
  ['厦门体育中心 · 体育场与训练场', buildHubinSports],
  ['厦门站 · 南北站房、广场与站台', buildRailwayStation],
  ['厦门高崎站 · 国铁货运Ⅰ、Ⅱ场', buildGaoqiRailway],
  ['梧村街区 · 厦禾路、站南路与快速公交', buildWucunRoads],
  ['梧村街区 · 商场、汽车站与学校', buildWucunBuildings],
  ['厦门国际会议展览中心 · 主馆、展厅与滨海廊台', buildExhibition],
  ['厦门海峡大剧院 · 三重挑檐与柱廊', buildTheatre],
  ['厦门文化艺术中心 · 四馆与文化街', buildCultureCentre],
  ['东渡客运码头 · 波形候船楼与浮码头', buildDongdu],
  ['狐尾山气象台 · 海上明珠观光塔与球幕影院', buildWeatherHill],
  ['厦门市政府与人民会堂', buildCivicCenter],
  ['厦门体育中心 · 综合健身馆', buildSportsGym],
  ['厦门万象城 · 商场、写字楼与跨街连廊', buildMixc],
  ['海湾公园 · 星光大道与北园草坡', buildBay],
  ['仙岳山土地公庙 · 福德广场与双阁', buildFude],
  ['五缘湾湿地公园 · 湿地与湖岸', buildWetland],
  ['厦门园林博览苑 · 杏林阁与主展岛', buildExpo],
  ['中山公园 · 湖岛与南门', buildZhongshanPark],
  ['南湖公园 · 桃花岛、湖亭与后埭溪步桥', buildNanhu],
  ['莲坂国贸大厦 · 拱顶玻璃幕墙与红色钢桁架', buildLianbanGuomao],
  ['厦门 SM 城市广场 · 一期、二期与嘉禾路连廊', buildSmXiamen],
  ['中华城 · 思明南路骑楼、屋顶与台光街', buildZhonghuaCity],
  ['东渡海上世界 · 滨海商业和潮汐之眼', buildSeaWorld],
];

export function buildLandmarks(parent, geo, material, lamps, obstacles, signs, broadcastMaterial = material, plantings) {
  const traffic = [];
  for (const [name, build] of sites) {
    const batch = new MeshBatch();
    const roads = build(batch, geo, lamps, obstacles, signs, plantings);
    if (Array.isArray(roads)) traffic.push(...roads);
    const mesh = batch.finish(parent, build === buildBroadcast ? broadcastMaterial : material, name);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  for (const inscription of northInscriptions) {
    const batch = new MeshBatch();
    buildNorthInscription(batch, geo, obstacles, inscription);
    const mesh = batch.finish(parent, material, inscription.name);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  return traffic;
}
