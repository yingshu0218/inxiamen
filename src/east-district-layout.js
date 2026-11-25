import survey from './east-district-survey.json' with { type: 'json' };
import { ellipse, localFrame, rect } from './landmark-forms.js';
import { inRing } from './scenery-mesh.js';

export const districtLimits = survey.limits;
export const districtRoads = survey.roads;

const mass = (ring, height, finish, crown = 0) => ({ rings: [ring], height, finish, crown });
const block = (x, z, width, depth, angle, height, finish, crown = 0) =>
  mass(rect(localFrame([x, z], angle), 0, 0, width, depth), height, finish, crown);
const oval = (x, z, width, depth, angle, height, finish, crown = 0, edges = 24) =>
  mass(ellipse(localFrame([x, z], angle), 0, 0, width / 2, depth / 2, edges), height, finish, crown);
const towerGroup = (datum, ...towers) => [datum, ...towers.map(tower=>({...tower,datum}))];

// The north parcel stops at the east school boundary and the south parcel
// follows the narrow strip west of the adjoining campus and housing.
const oneNorth = [
  mass([[-1432,4909],[-1390,4893],[-1310,4886],[-1274,4871],[-1265,4904],[-1314,4922],[-1394,4928],[-1413,4941]], 44, 'silver', 2.4),
  mass([[-1259,4867],[-1195,4854],[-1202,4884],[-1251,4905]], 43, 'silver', 2.0),
  mass([[-1494,4936],[-1460,4912],[-1439,4934],[-1457,4955],[-1431,4976],[-1405,5016],[-1415,5047],[-1454,5042],[-1451,5019],[-1467,4995],[-1482,5016],[-1509,5008],[-1503,4977]], 47, 'silver', 2.4),
  mass([[-1269,4946],[-1221,4916],[-1198,4907],[-1197,4955],[-1220,4970],[-1228,4995],[-1274,4990],[-1277,4965]], 39, 'silver', 2.1),
  mass([[-1321,4978],[-1302,4969],[-1296,4973],[-1306,5058],[-1337,5052],[-1346,5020],[-1343,5000]], 37, 'silver', 2.1),
];
oneNorth[3].rings.push([[-1264,4963],[-1249,4949],[-1238,4959],[-1248,4976],[-1264,4974]]);

const oneSouth = [
  // The C-shaped north end and the long wing on its west side share a base.
  mass([[-1528,5194],[-1526,5127],[-1519,5100],[-1505,5081],[-1484,5069],[-1461,5067],[-1438,5074],[-1422,5090],[-1416,5114],[-1422,5140],[-1441,5138],[-1437,5119],[-1443,5101],[-1461,5090],[-1480,5091],[-1492,5105],[-1500,5128],[-1507,5195]], 30, 'terrace', 2.2),
  mass([[-1441,5148],[-1416,5146],[-1413,5205],[-1425,5235],[-1428,5261],[-1448,5255],[-1449,5230],[-1438,5200]], 24, 'terrace', 1.8),
  mass([[-1525,5290],[-1503,5295],[-1492,5288],[-1464,5301],[-1473,5327],[-1482,5326],[-1490,5344],[-1519,5338],[-1516,5320],[-1530,5312]], 24, 'warm', 1.8),
  block(-1431,5317,24,67,.31,22,'warm',2),
];

export const phaseOneBuildings = [...oneNorth, ...oneSouth];
export const phaseTwoBuildings = survey.parkBuildings.map(([finish, height, rings]) => ({
  finish, height, rings, crown: finish === 'hotel' ? 1.9 : 1.3,
}));

const goldPodium = mass([[5955,-1782],[6078,-1826],[6197,-1870],[6295,-1883],[6335,-1847],[6325,-1732],[6286,-1723],[6177,-1745],[6109,-1719],[5992,-1679],[5967,-1685]], 13, 'podium');
const pearlPodium = mass([[6621,-2159],[6700,-2165],[6714,-2117],[6700,-2022],[6680,-1987],[6620,-1989],[6617,-2046],[6617,-2078],[6600,-2098]], 23,'podium');
const hotelPodium = block(6667,-1552,98,111,-.25,15,'podium');
const cbdPodium = mass([[6407,-1740],[6500,-1803],[6564,-1764],[6614,-1774],[6702,-1727],[6665,-1648],[6584,-1654],[6531,-1607],[6436,-1638],[6400,-1681]], 13, 'podium');
const plazaPodium = mass([[5945,-1262],[5968,-1352],[6068,-1336],[6105,-1307],[6138,-1313],[6210,-1267],[6186,-1183],[6090,-1183],[6023,-1212],[5966,-1214]], 22, 'stone');

export const guanyinBuildings = [
  ...towerGroup(goldPodium,
    block(6002,-1749,44,40,-.34,55,'blue',2),
    block(6072,-1762,44,39,-.34,61,'blue',2),
    block(6175,-1790,44,41,-.15,81,'grey',2),
    block(6290,-1793,61,45,.05,126,'blue',3)),
  ...towerGroup(pearlPodium,
    block(6643,-2085,47,43,.26,258.8,'pearl'),
    block(6674,-2134,42,42,.26,109,'blue',2.6)),
  ...towerGroup(hotelPodium, block(6670,-1536,53,54,-.24,97,'hotel',2.2)),
  ...towerGroup(cbdPodium,
    block(6477,-1666,43,33,.61,99,'grey',2.7),
    block(6510,-1717,44,36,.61,116,'blue',2.7),
    block(6552,-1742,46,37,.61,103,'blue',3.1),
    block(6598,-1729,42,39,.51,128,'grey',2.2),
    block(6642,-1695,51,36,.54,149.4,'blue',4.0)),
  oval(6711,-1328,43,49,-.2,116,'grey',2.4),
  oval(6689,-1403,47,33,-.2,89,'blue',2.5),
  block(6587,-1352,59,34,.53,15,'podium'),
  block(6735,-1225,44,42,.04,101,'blue',3),
  block(6664,-1227,52,37,.08,108,'grey',3),
  block(6589,-1207,57,35,.1,86,'blue',2.4),
  oval(6584,-1093,47,48,.22,98.6,'stepped',3),
  block(6646,-1095,56,46,.20,97,'grey',3),
  block(6724,-1094,51,36,.1,109,'blue',3),
  oval(6775,-1116,43,41,.1,86,'grey',2.3),
  block(6784,-967,49,36,-.21,116,'blue',3),
  block(6776,-885,48,35,-.21,121,'grey',3),
  block(6754,-808,48,33,-.24,105,'blue',3),
  ...towerGroup(plazaPodium,
    mass([[5993,-1322],[6029,-1311],[6038,-1315],[6072,-1304],[6058,-1269],[6022,-1280],[6014,-1276],[5980,-1287]],178,'plaza',3.9),
    block(6141,-1279,73,41,.42,90,'hotel',2.4)),
  oval(6289,-1634,53,51,.20,210,'bank',0,32),
];

const ringCentre = ring => ring.reduce(([x,z], p)=>[x+p[0],z+p[1]],[0,0]).map(v=>v/ring.length);
const centreKey = (x,z) => [Math.round(x*10),Math.round(z*10)].join(',');
// Centroids of old partial roofs that cross the selected silhouette, plus
// the garden false positive. Adjacent, independently mapped roofs survive.
const oldRoofCentres = [
  [4685.3,-1463.45],[5006.62,-1106.62],[5827.2,-1293.2],
  [6642.29,-2004.50],[6708.26,-2128.74],[6649.11,-2139.67],
  [6605.14,-1576.79],[6628.1,-1778.1],[6400.31,-1696.06],
  [6560.25,-1628.50],[6616,-1647.75],[5954.29,-1239.53],
];
const onExistingCentres = new Set([...oldRoofCentres, ...phaseTwoBuildings.map(({rings})=>ringCentre(rings[0]))]
  .map(([x,z])=>centreKey(x,z)));
const coastParcels = [districtLimits.gold, ...[pearlPodium, hotelPodium, cbdPodium, plazaPodium].map(({ rings }) => rings[0]),
  [[6508,-1381],[6611,-1436],[6718,-1445],[6740,-1301],[6689,-1286],[6544,-1300]],
  [[6543,-1248],[6794,-1269],[6798,-1067],[6547,-1054]],
  [[6749,-996],[6815,-994],[6810,-882],[6786,-789],[6724,-790],[6748,-889]],
  [[6246,-1658],[6297,-1681],[6332,-1657],[6332,-1607],[6283,-1591],[6252,-1612]],
];
const boundsOf = ring => [Math.min(...ring.map(p=>p[0])), Math.min(...ring.map(p=>p[1])),
  Math.max(...ring.map(p=>p[0])), Math.max(...ring.map(p=>p[1]))];
const coastClaims = [...coastParcels, ...guanyinBuildings.map(b=>b.rings[0])].map(ring=>({ring,bounds:boundsOf(ring)}));

export function eastDistrictReserved(x, z) {
  if (x > -1570 && x < -1180 && z > 4840 && z < 5400) return inRing(x,z,districtLimits.phaseOne);
  if (x > 4560 && x < 5870 && z > -1815 && z < -600) {
    return onExistingCentres.has(centreKey(x,z)) ||
      (x > 5357 && x < 5371 && z > -1033 && z < -1014);
  }
  if (x < 5930 || x > 6820 || z < -2175 || z > -770) return false;
  return onExistingCentres.has(centreKey(x,z)) ||
    coastClaims.some(({ ring, bounds: [x0,z0,x1,z1] })=>x>=x0 && x<=x1 && z>=z0 && z<=z1 && inRing(x,z,ring));
}

export const eastDistrictViews = [
  { id:'software-one', name:'厦门软件园一期', kind:'从珍珠湾俯看南北两区', x:-1405,z:5108,focusHeight:25,fov:53,
    chartName:'软件园一期', chartOffset:[-8,12], view:{x:-1730,y:331,z:5630}, portraitView:{x:-1773,y:470,z:5790} },
  { id:'software-one-north', parent:'software-one', name:'一期北区 · 曾厝垵北路', x:-1366,z:5002,focusHeight:25,fov:49,
    view:{x:-1522,y:178,z:5235}, portraitView:{x:-1540,y:240,z:5335} },
  { id:'software-two', name:'厦门软件园二期', kind:'俯看望海路、观日路和园区广场', x:5210,z:-1130,focusHeight:26,fov:61,
    chartName:'软件园二期', chartOffset:[-12,12], view:{x:4820,y:930,z:-390}, portraitView:{x:4770,y:1220,z:-330} },
  { id:'software-two-west', parent:'software-two', name:'二期西出口 · 金山路与观日路', x:4678,z:-1403,focusHeight:32,fov:53,
    view:{x:4468,y:180,z:-1274}, portraitView:{x:4425,y:257,z:-1265} },
  { id:'guanyinshan', name:'东海岸观音山', kind:'从海上看商务天际线与观音山岸线', x:6700,z:-1530,focusHeight:68,fov:54,
    chartName:'观音山', chartOffset:[12,-5], view:{x:7990,y:360,z:-1020}, portraitView:{x:8600,y:584,z:-1100} },
  { id:'guanyinshan-business', parent:'guanyinshan', name:'观音山 · 台北路商务楼群', x:6343,z:-1772,focusHeight:96,fov:49,
    view:{x:6825,y:275,z:-1305}, portraitView:{x:7010,y:401,z:-1220} },
];
