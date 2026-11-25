import { inBay } from './bay-fude-layout.js';
import zhongshan from './zs.json' with { type: 'json' };
import wuyuan from './wy.json' with { type: 'json' };
import expo from './yb.json' with { type: 'json' };
import { inRing } from '../scenery-mesh.js';

export { zhongshan, wuyuan, expo };
function covers(plan,x,z) {
  const [w,n,e,s]=plan.bounds;
  return x>=w && x<=e && z>=n && z<=s && inRing(x,z,plan.boundary);
}
export const insidePark=(x,z)=>covers(zhongshan,x,z)||covers(wuyuan,x,z)||inBay(x,z);
export const parkModelReserved=(x,z)=>Math.abs(x+5864)<16 && Math.abs(z+11852)<16 ||
  x>4320 && x<4497 && z> -4093 && z< -3927 && inRing(x,z,wuyuan.marsh) ||
  Math.abs(x+4123)<11 && Math.abs(z-2291)<3;
export function parkBuildingHeight(x,z,height) {
  if(covers(zhongshan,x,z))return Math.min(height,8.4);
  if(covers(expo,x,z) && expo.islands.some(r=>inRing(x,z,r)))return Math.min(height,13);
  return height;
}
export const mazeWater={name:'五缘湾迷宫湿地',kind:'lake',h:3,rings:[wuyuan.marsh.flat()]};
