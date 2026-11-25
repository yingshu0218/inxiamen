// The flight approaches from open water with the mainland off its left wing.
export const coastalFlight = [
  [-2950,5270,141],[-2470,5610,131],[-1900,5680,130],[-1090,5710,124],
  [-660,5975,122],[-160,6125,127],[650,6370,136],[1190,5780,146],
  [2010,5180,146],[2580,4620,137],[3240,4100,137],[3950,3570,142],
  [4660,2990,154],[5280,2510,158],[6010,1820,165],[6410,1080,180],
  [7440,100,223],[7560,-780,223],[7470,-1690,241],[7700,-2350,263],
  [7390,-3300,237],[7350,-5050,245],[6640,-6110,245],[5630,-6780,255],
  [5190,-6960,260],
];
const vantage=(id,name,x,z,cx,cz,y,focusHeight=4)=>({
  id,parent:'huandao',name,x,z,focusHeight,fov:49,view:{x:cx,z:cz,y},
});
export const coastalViews=[
  vantage('huandao-overview','白城至曾厝垵 · 总览',-1930,5390,-1700,6810,718),
  vantage('baicheng-beach','白城沙滩与天桥',-2783,4983,-2710,5118,78),
  vantage('huli-revetment','胡里山驳岸',-2498,5270,-2660,5320,88),
  vantage('zengcuoan-fish','曾厝垵渔桥',-674,5722,-612,5838,64,9),
  vantage('huangcuo-wave','黄厝海浪平台',4480,2767,4625,2972,112),
  vantage('yefeng-beach','椰风寨岸滩',3915,3320,4080,3525,138),
  vantage('huandao-exhibition','会展海岸',5846,1250,6410,1610,275),
  vantage('guanyin-coast','观音山海滨与在建沙滩桥',7160,-2100,7590,-1740,231,35),
  vantage('huandao-wutong','五通 · 横三路口与木浦天桥',6133,-5453,6615,-5457,339,8),
  vantage('huandao-wuyuan','五缘湾 · 东路终点',5194,-6652,5480,-6980,189),
];
