// Coordinates digitised in the 2025-03-20 LG04 frame. The source image is
// north-up, cropped at (-2400,-15) and sampled at two pixels per game metre.
import { inRing } from './scenery-mesh.js';
import { localFrame } from './landmark-forms.js';

export const siliPoint = ([u,v]) => [-2400 + u / 2, -15 + v / 2];
export const siliRing = points => points.map(siliPoint);
export const siliParcels = {
  B06: siliRing([[28,215],[333,127],[385,320],[82,405]]),
  B07: siliRing([[350,124],[550,68],[601,258],[401,315]]),
  B16: siliRing([[399,354],[459,337],[515,531],[454,550]]),
  B17: siliRing([[469,335],[715,264],[748,398],[764,466],[525,545]]),
  B18: siliRing([[715,264],[754,254],[854,437],[764,466],[748,398]]),
  B25: siliRing([[796,496],[875,471],[921,569],[849,589],[808,530]]),
};

// New through streets visible on the March image. The old street layer
// contains the boundary arterials but omits these internal connections.
export const siliStreets=[
  [[84,420],[777,218],8],
  [[341,126],[395,330],5],
  [[395,330],[453,555],5],
  [[453,555],[873,447],6],
].map(([a,b,width])=>{
  const start=siliPoint(a),end=siliPoint(b);
  const dx=end[0]-start[0],dz=end[1]-start[1];
  const length=Math.hypot(dx,dz);
  return {start,end,width,length,xy:localFrame(start,Math.atan2(dz,dx)),
    ring:[start,end].flatMap((point,i)=>{
      const r=width*.5+1.6,ox=-dz/length*r,oz=dx/length*r;
      return (i?[1,-1]:[-1,1]).map(side=>[point[0]+side*ox,point[1]+side*oz]);
    })};
});

export function siliReserved(x,z) {
  if (x < -2390 || x > -1935 || z < 16 || z > 287) return false;
  return Object.values(siliParcels).some(ring => inRing(x,z,ring)) ||
    siliStreets.some(street => inRing(x,z,street.ring));
}

// Roof centres read from the image. Apply a common small NW correction for
// visible roof displacement. Heights include the roof head and remain estimates.
const rows = {
  B06: [[107,248,36,15,94],[210,219,39,15,96],[309,193,37,15,94],
        [134,353,36,15,81],[233,332,36,14,84],[344,301,39,15,85]],
  B07: [[410,164,37,16,98],[518,135,36,15,96],[450,265,35,15,90],[552,236,38,15,91]],
  B18: [[801,420,33,16,87]],
  B25: [[857,525,38,16,91]],
};
export const siliHomes = Object.entries(rows).flatMap(([lot, buildings]) =>
  buildings.map(([px,py,w,d,height]) => {
    const xy=localFrame(siliPoint([px-9,py-7]), -.278);
    const a=w/2,b=d/2;
    const outline=[[-a,-b],[a,-b],[a,b],[a*.46,b],[a*.46,b-1.7],
      [a*.22,b-1.7],[a*.22,b],[-a*.23,b],[-a*.23,b-1.7],[-a*.48,b-1.7],[-a*.48,b],[-a,b]];
    return {lot,xy,w,d,height,base:0,use:1,mappedHeight:false,reviewedDistrict:true,
      rings:[outline.map(([u,v])=>xy(u,v))]};
  }));
