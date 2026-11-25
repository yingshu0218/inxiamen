import plan from './gaoqi-railway-plan.json' with { type: 'json' };
import { inRing, mix } from './scenery-mesh.js';
import { measuredPath } from './old-town-layout.js';
import { localFrame, rect } from './landmark-forms.js';

export { plan as gaoqiRailwayPlan };
export const stationFrame = localFrame([-1532.5, -6651.8], Math.atan2(.956, .293));

// U runs towards the island, V towards the railway from the station house.
export const stationBuildings = [
  { u: 0, v: 0, width: 68, depth: 22, height: 7.1, rise: 3.7, finish: 'tile' },
  { u: -18, v: -18.8, width: 33, depth: 20, height: 6.4, rise: .75, finish: 'pale' },
  { u: -44, v: -5.2, width: 23, depth: 16, height: 5.2, rise: .48, finish: 'pale' },
  { u: -61, v: -36.2, width: 43, depth: 19, height: 4.1, rise: .88, finish: 'shed' },
  { u: 12.3, v: -39.4, width: 29, depth: 12.2, height: 4.5, rise: .69, finish: 'pale' },
];
// The open parking edge and station-side walk visible in the March 2025 imagery.
export const forecourt = [
  [-1538, -6745], [-1504, -6754], [-1498, -6746], [-1500, -6733], [-1491, -6724],
  [-1489.5, -6717], [-1489.5, -6698], [-1497, -6691], [-1493, -6682], [-1490, -6663],
  [-1487, -6650], [-1487, -6639], [-1516, -6655], [-1524, -6703],
];
export const forecourtCanopy = { u: 43, v: -28, width: 43, depth: 42 };
export const coveredTracks = { u: 3, v: 37.8, width: 106, depth: 38.5 };
export const serviceDrive = measuredPath([[-1467,-6718],[-1481,-6720],[-1496,-6722]]);
export const westSheds = [
  [[-2518,-6430], 52, 9, -1.02, '#a19d8f'],
  [[-2506,-6409], 46, 9, -1.02, '#aeb4aa'],
  [[-2651,-6257], 44, 11, -.94, '#b6beb4'],
  [[-2690,-6198], 28, 11, -.99, '#a9aaa1'],
];
export const northernSheds = [
  [[-1659,-7159], 67, 14.4, 1.26, '#a76452'],
  [[-1675,-7200], 14, 13, 1.26, '#a96954'],
  [[-1571,-6995], 37, 11, 1.28, '#aab6af'],
];

export const gaoqiTracks = [
  ...plan.main.map(entry=>[...entry, true]),
  ...plan.bridgeHeads.map(entry=>[...entry, true, true]),
  ...plan.yards,
].map(([id, points, main = false, bridge = false]) => {
  const xs = points.map(p=>p[0]), zs = points.map(p=>p[1]);
  return {
    id, main, bridge, path:measuredPath(points),
    bounds: [Math.min(...xs)-4.3, Math.min(...zs)-4.3, Math.max(...xs)+4.3, Math.max(...zs)+4.3],
  };
});

const entranceSite = rect(stationFrame,-8,-20,147,80);
const structures = [...westSheds, ...northernSheds].map(([center,w,d,a])=>rect(localFrame(center,a),0,0,w+6,d+6));
const smooth = t => {const q = Math.max(0, Math.min(1, t)); return q*q*(3-2*q);};
const eastProfile = [[-8150,13.25],[-7940,9.55],[-7780,9.22],[-7480,10.55],[-7120,10.62],[-6750,10.76],
  [-6550,10.58],[-6280,9.78],[-6000,9.02],[-5720,8.34]];

export function gaoqiRailGrade(x,z) {
  let east=eastProfile.at(-1)[1];
  for (let i=1;i<eastProfile.length;i++) {
    const [a,y]=eastProfile[i-1], [b,h]=eastProfile[i];
    if (z>b) continue;
    east=mix(y,h,Math.max(0,(z-a)/(b-a)));
    break;
  }
  const west=7.42+.00265*Math.max(0,-z-6830);
  const merge=smooth((-z-7420)/395);
  return mix(west,east,Math.max(merge,smooth((x+2240)/415)));
}

export function gradeGaoqiRailway(grid, samples) {
  const dx=(grid.xmax-grid.xmin)/(grid.width-1), dz=(grid.zmax-grid.zmin)/(grid.height-1);
  const unit=grid.metresPerUnit??1;
  for (let i=Math.max(0,Math.ceil((-8035-grid.zmin)/dz)); i<grid.height && grid.zmin+i*dz<-5680; i++) {
    const z=grid.zmin+i*dz;
    for (let j=Math.max(0,Math.ceil((-3070-grid.xmin)/dx)); j<grid.width && grid.xmin+j*dx<-960; j++) {
      const x=grid.xmin+j*dx;
      let distance=42;
      for (const {id,bridge,path,bounds:[a,b,c,d]} of gaoqiTracks) {
        if(bridge || id===1226070290 || x<a-42 || x>c+42 || z<b-42 || z>d+42) continue;
        distance=Math.min(distance,path.nearest(x,z).distance);
      }
      const blend=1-smooth((distance-17)/25);
      if(blend<=0) continue;
      const idx=i*grid.width+j;
      samples[idx]=Math.round(mix(samples[idx]*unit,gaoqiRailGrade(x,z)-.29,blend)/unit);
    }
  }
}

export function gaoqiRailwayReserved(x,z) {
  if (x < -3110 || x > -980 || z < -8190 || z > -5700) return false;
  if ([entranceSite, ...plan.parcels, ...structures].some(ring=>inRing(x,z,ring))) return true;
  return gaoqiTracks.some(({path,bounds:[a,b,c,d]})=>x>=a&&x<=c&&z>=b&&z<=d&&path.nearest(x,z).distance<3.15);
}

const pose = (x,z,y) => ({x,z,y});
export const gaoqiRailwayViews = [
  {
    id:'gaoqi-railway', name:'厦门高崎站', kind:'国铁货运Ⅰ、Ⅱ场航拍',
    x:-2055, z:-6545, lookAt:pose(-2175,-6605,0), focusHeight:12, fov:54,
    view:pose(-1960,-5630,860), portraitView:pose(-1990,-5200,1200), portraitFovBoost:14,
    chartName:'高崎火车站', chartOffset:[-16,15],
  },
  {
    id:'gaoqi-railway-front', name:'高崎站房侧', kind:'旧站房、站前场地与鹰厦铁路',
    x:-1521, z:-6660, focusHeight:15, fov:64, portraitFovBoost:16,
    view:pose(-1406,-6685,64), portraitView:pose(-1302,-6658,109),
    portraitFocus:pose(-1520,-6660,15),
  },
];
