// OSM 127162502 and 127162523, edited 2026-01-16. West to east.
// End vertices snap to the road export; adjoining vertices set the joint normals.
export const wuyuanLanes=[
  {id:127162502,west:[4037,-7167],points:[[4340,-7030],[4719.4,-6863.3],[4881.4,-6790.1],[4990.7,-6742],[5133,-6676],[5190,-6646]]},
  {id:127162523,west:[4319,-7060],points:[[4352,-7044],[4727.2,-6875.4],[4889.2,-6802.3],[4998.4,-6754.2],[5141,-6688],[5197,-6660]]},
];

// Joined portions of cycleways 1444703786 and 148659100 (2025-10-27).
export const westBridgeWalk=[[4448,-7043.1],[4643.2,-6954.6],[4634.8,-6931.7],[4612.2,-6881],
  [4606.8,-6882.7],[4599.1,-6881.1],[4593.1,-6874.1],[4591.5,-6866.5],[4594.7,-6855.6],
  [4598.2,-6852],[4587.7,-6833.5]];

function onLane(x,z,lane){
  return lane.points.slice(1).some(([ex,ez],i)=>{
    const [sx,sz]=lane.points[i],dx=ex-sx,dz=ez-sz;
    const t=Math.max(0,Math.min(1,((x-sx)*dx+(z-sz)*dz)/(dx*dx+dz*dz)));
    return Math.hypot(x-sx-t*dx,z-sz-t*dz)<2;
  });
}
export function wuyuanDeckRecord(kind,bridge,flat){
  if(!bridge || kind!==4 || flat[0]<4338 || flat[0]>5199 || flat[1]<-7046 || flat[1]>-6644)return false;
  return wuyuanLanes.some(lane=>flat.every((v,i)=>i%2 || onLane(v,flat[i+1],lane)));
}
