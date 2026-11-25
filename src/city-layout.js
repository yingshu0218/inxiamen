import { siliHomes, siliReserved } from './sili-layout.js';
import { drawSiliHome } from './sili-community.js';
import { parkBuildingHeight } from './parks/layout.js';
import { MeshBatch, litSurface, prism, signedArea, inRing, ringRect, supportsHipRoof } from './scenery-mesh.js';
import { airportWorksReserved } from './airport-layout.js';
import { airportIndustryBuilding } from './airport-industry-layout.js';
import { oldTownFootprints } from './old-town-layout.js';
import { landmarkReserved } from './scenery-landmarks.js';
import { nanhuBuildingsReserved } from './downtown-landmark-layout.js';
import { inIslandBounds, replacesGardenBuilding } from './gulangyu-layout.js';
import { neicuoaoPieces, neicuoaoImageHouses } from './gulangyu-neicuoao.js';
import { islandHouse } from './gulangyu-neighborhoods.js';

const plaster = ['#bcafa0','#b7aca0','#c0bcb0','#b8aa97','#afb3a7','#c6b79e','#a8afaf','#beb6a8'];
const homes = ['#c1b4a4','#c4b69e','#c1af96','#bfb6ab','#b3ac9a','#aeb6ad','#c4bbaf'];
const glass = ['#92a7ac','#a1b0b0','#90a3aa','#a4b3b2','#97a8a9'];
const greyRoofs = ['#97968e','#a7a599','#9d9991','#929b98','#aaa697','#9c9c94'];
const redTiles = ['#a36851','#ad7559','#a56450','#9e6050','#ae6e54','#ae7a60'];
const steel = ['#8f9fa3','#788e99','#98a3a1','#8299a1'];
const villaWalls = ['#b99677','#d1bfa1','#bf9a80','#c89f7e','#cfbba3','#ac7c66','#cab198'];
const islandTiles = ['#a15e46','#b47151','#a9654c','#925b4c','#b06648','#b98262','#a36854','#897266'];
const tileSize = 1080;

export function decodeCityLayout(buffer) {
  const data = new DataView(buffer);
  if (data.byteLength<8 || data.getUint32(0)!==0x584d4331) throw new Error('城市建筑数据版本不匹配');
  const count=data.getUint32(4,true), result=[];
  let cursor=8;
  for(let i=0;i<count;i++){
    const height=data.getUint16(cursor,true)*.1, base=data.getUint16(cursor+2,true)*.1;
    const use=data.getUint8(cursor+4), flags=data.getUint8(cursor+5), nr=data.getUint16(cursor+6,true);
    cursor+=8;
    const rings=[];
    for (let j=0;j<nr;j++) {
      const n=data.getUint16(cursor,true);cursor+=2;
      const ring=[];
      for(let k=0;k<n;k++,cursor+=4) ring.push([data.getInt16(cursor,true)*.5,data.getInt16(cursor+2,true)*.5]);
      rings.push(ring);
    }
    if (rings[0]?.length>=3) result.push({height,base,use,mappedHeight:(flags&3)>=2,roofTone:(flags>>5)&3,reviewedDistrict:!!(flags&8),interpreted:(flags&132)===132,rings});
  }
  if(cursor!==data.byteLength)throw new Error('城市建筑记录未读完整');
  return result;
}

function appearanceSeed(x,z){
  let v=Math.imul(Math.round(x*2),0x45d9f3b)^Math.imul(Math.round(z*2),0x119de1f3);
  v=Math.imul(v^(v>>>16),0x45d9f3b);
  return ((v^(v>>>16))>>>0)/4294967296;
}
const pick=(palette,value)=>palette[Math.min(palette.length-1,Math.floor(value*palette.length))];

// A stair head or a plant room stays inside one continuous area of roof,
// including on narrow wings and buildings surrounding an open courtyard.
function roofRoom(b,area,seed,skylight) {
  if(!skylight && (b.height<18 || area<240 || (seed<.35 && !b.interpreted)))return;
  const ring=b.rings[0];
  let length=0, angle=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],c=ring[(i+1)%ring.length];
    const dx=c[0]-a[0], dz=c[1]-a[1], size=dx*dx+dz*dz;
    if(size>length){length=size;angle=Math.atan2(dz,dx);}
  }
  const x=b.x*.81+ring[0][0]*.19, z=b.z*.81+ring[0][1]*.19;
  if(!inRing(x,z,ring) || b.rings.slice(1).some(hole=>inRing(x,z,hole)))return;
  let distanceSq=Infinity;
  for(const boundary of b.rings)for(let i=0;i<boundary.length;i++){
    const a=boundary[i],c=boundary[(i+1)%boundary.length];
    const dx=c[0]-a[0], dz=c[1]-a[1], len=dx*dx+dz*dz;
    const t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len)):0;
    distanceSq=Math.min(distanceSq,(x-a[0]-t*dx)**2+(z-a[1]-t*dz)**2);
  }
  const width=Math.min(skylight?31:17,Math.sqrt(area)*.32,Math.sqrt(distanceSq)*1.42);
  if(width<4.8)return;
  return ringRect(x,z,width,width*(.48+.21*seed),angle);
}

function drawBuilding(batch,b,geo,index) {
  const [ring,...holes]=b.rings, area=Math.abs(signedArea(ring)), h=b.height;
  const seed=appearanceSeed(b.x,b.z);
  let lowest=Infinity;
  const ground=ring.map(([x,z])=>{
    const y=geo.heightAt(x,z);
    lowest=Math.min(lowest,y);
    return y;
  }).sort((a,c)=>a-c);
  const base=ground[ground.length>>1];
  const top=base+h, bottom=b.base>0?base+b.base:lowest-.65;
  if(top<=bottom)return;
  if(b.lot) { drawSiliHome(batch,b,bottom,base,index); return; }
  const island=inIslandBounds(b.x,b.z)&&inRing(b.x,b.z,geo.islands.gulangyu);
  const tile=appearanceSeed(b.x+5.25,b.z-20);
  if(island && !b.base) {
    const roof=pick(!holes.length && h<28 && area<1300?islandTiles:greyRoofs,tile);
    islandHouse(batch,ring,b.x,b.z,bottom,top,base,h,area,pick(villaWalls,seed),roof,seed,index,holes,b.neicuoaoRoof,geo.heightAt);
    return;
  }
  const industrial=b.use===4 || (!b.use && area>2600 && h<17);
  const retail=b.use===2 && area>525 && h<49;
  const residential=b.use===1 || (!b.use && h<72 && area<1100);
  const office=b.use===5 || (!industrial && !residential && !retail && h>=64);
  const wall=b.interpreted && residential && h>80 ? pick(['#a7afb0','#aeb5b5'],seed) : pick(office?glass:residential?homes:plaster,seed);
  const roof=pick(b.roofTone===1?redTiles:b.roofTone===2?steel:greyRoofs,tile);
  const pitched=!holes.length && !b.base && !industrial && !retail && !office && h<21 && area<850 && b.roofTone===1 && supportsHipRoof(ring);
  const rise=pitched?Math.min(h*.20,Math.sqrt(area)*.13,4):0;
  const style=industrial?3:office?litSurface.office:retail?litSurface.shopfront:residential&&h>=17?20:1;
  const room=pitched || b.base ? undefined : roofRoom(b,area,seed,retail);
  const slab=room?top-Math.min(3.5,h*(retail?.12:.07)):top;
  // On a slope the stepped masonry foundation meets the ground before the
  // first row of facade windows. Detached elevated building parts retain their base.
  const sill=!b.base && base-lowest>1.2 ? Math.min(base+0.49,slab-rise-.32) : bottom;
  if(sill>bottom)prism(batch,ring,bottom,sill,'#a79e91',null,0,seed,0,0,holes);
  prism(batch,ring,sill,slab-rise,wall,roof,style,seed,rise,industrial?21:22,holes);
  index.add(ring,slab,holes);
  if(room){
    if(retail){
      prism(batch,room,slab,slab+.38,'#ada99e','#b1ad9f');
      prism(batch,room,slab+.38,top-.55,'#84969b','#8da4a5',0,seed,.55,22);
    }else{
      prism(batch,room,slab,top,wall,pick(greyRoofs,seed),0,seed,0,22);
    }
    index.add(room,top);
  }
}

// Make a small draw batch per neighbourhood. Small roofs beyond the visible
// window are already present in the ground imagery; the skyline remains in 3D.
export async function buildCity(parent,geo,frame,material,index,buffer,bridgeFootprint) {
  const tiles=new Map();
  function enqueue(b) {
    const ring=b.rings[0];
    let x=0,z=0;
    for(const p of ring){x+=p[0];z+=p[1];}
    b.x=x/=ring.length;b.z=z/=ring.length;
    if(!b.lot && (siliReserved(x,z) || replacesGardenBuilding(ring)))return;
    if(!b.lot && !b.mappedHeight)b.height=parkBuildingHeight(x,z,b.height);
    if(airportIndustryBuilding(x,z)||airportWorksReserved(frame,x,z)||landmarkReserved(x,z)||nanhuBuildingsReserved(x,z)||bridgeFootprint?.(x,z))return;
    const ix=Math.floor(x/tileSize),iz=Math.floor(z/tileSize),key=ix+','+iz;
    let tile=tiles.get(key);
    if(!tile){tile={x:(ix+.5)*tileSize,z:(iz+.5)*tileSize,small:[],large:[]};tiles.set(key,tile);}
    const minor=!b.reviewedDistrict && b.height<24 && Math.abs(signedArea(ring))<950;
    (minor?tile.small:tile.large).push(b);
  }
  for(const building of decodeCityLayout(buffer)) {
    const neicuoao = neicuoaoPieces(building);
    if (neicuoao) {
      for (const part of neicuoao) enqueue(part);
      continue;
    }
    const pieces=oldTownFootprints(building);
    if (pieces === undefined) enqueue(building);
    else for (const rings of pieces) enqueue({...building,rings});
  }
  for(const home of neicuoaoImageHouses) enqueue({...home});
  for(const home of siliHomes) enqueue({...home});
  const lowMeshes=[];
  let lastYield=performance.now();
  for(const tile of tiles.values()){
    for(const group of [tile.large,tile.small]){
      if(!group.length)continue;
      const batch=new MeshBatch();
      for(const b of group)drawBuilding(batch,b,geo,index);
      const mesh=batch.finish(parent,material,'厦门实景街区');
      if(mesh){
        mesh.castShadow=mesh.receiveShadow=true;
        if(group===tile.small)lowMeshes.push({mesh,x:tile.x,z:tile.z});
      }
    }
    if(performance.now()-lastYield>22){
      await new Promise(resolve=>setTimeout(resolve,0));lastYield=performance.now();
    }
  }
  let lastX=Infinity,lastZ=Infinity;
  return (x,z)=>{
    if((lastX-x)**2+(lastZ-z)**2<90**2)return;
    lastX=x;lastZ=z;
    for(const t of lowMeshes)t.mesh.visible=(x-t.x)**2+(z-t.z)**2<6500**2;
  };
}
