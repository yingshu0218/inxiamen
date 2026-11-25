import { bay, hillRadius } from './bay-fude-layout.js';
import templePaths from './fude-paths.json' with {type:'json'};
import { measuredPath, ribbon } from '../old-town-layout.js';
import { groundY, cylinder, prism, litSurface } from '../scenery-mesh.js';
import { localFrame, rect, up, sweptRoof, groundPaving, ellipse } from '../landmark-forms.js';
import { pathTube } from '../landmark-haicang.js';

function pathBand(batch,geo,line,width,color,lift=.18){
  const path=measuredPath(line);
  ribbon(batch,path.sections(3),-width/2,width/2,(x,z)=>groundY(geo,x,z)+lift,color,litSurface.stone);
}
const aerial=([u,v])=>[-5870+u*1.2,20+v*1.2];
const street=localFrame([-5400,467],-.06);
function lightWalk(batch,geo,lamps){
  groundPaving(batch,geo,street,[-158,151,-9,9],'#bfb7a8');
  for(let u=-150;u<147;u+=4.5){
    const path=[street(u,-9),street(u,9)];
    pathBand(batch,geo,path,.45,'#977e70',.31);
    if(Math.round((u+150)/4.5)%3===0)for(const v of [-6.7,6.7]){
      const [x,z]=street(u,v);lamps.add(x,groundY(geo,x,z)+.39,z,'#ffdfaf',.63);
    }
  }
  for(const ring of [...bay.basins,bay.seaSquare,bay.eastSquare]){
    const cx=ring.reduce((n,p)=>n+p[0],0)/ring.length,cz=ring.reduce((n,p)=>n+p[1],0)/ring.length;
    const base=groundY(geo,cx,cz)+.33;
    if(bay.basins.includes(ring))prism(batch,ring.slice(0,-1),base-.25,base,'#aaa29b','#cec8b7',litSurface.paleStone);
    else{
      // Fill the surveyed end plazas in narrow ground-following triangles.
      for(let i=1;i<ring.length;i++){
        const tri=[[cx,cz],ring[i-1],ring[i]];
        batch.top(tri.map(p=>up(p,groundY(geo,...p)+.26)),'#b6a995',litSurface.stone);
      }
    }
  }
}
function seaWalk(batch,geo,lamps){
  const shore=[[404,73],[370,92],[330,125],[307,152],[289,184],[274,219],[266,261],[254,309],[246,345],[237,389],[225,448],[213,497],[202,545],[193,574]].map(aerial);
  pathBand(batch,geo,shore,4.0,'#c3bba7');
  const path=measuredPath(shore);
  for(let s=0;s+3.4<path.length;s+=3.4){
    const railAt=d=>{
      const p=path.sample(d);const x=p.x-p.uz*1.72,z=p.z+p.ux*1.72;
      return [x,groundY(geo,x,z)+1.08,z];
    };
    const a=railAt(s),b=railAt(s+3.4);
    cylinder(batch,a[0],a[2],a[1]-1,a[1]+.06,.09,.075,'#808881',6);
    pathTube(batch,[a,b],.072,'#a2aaa1',5);
    if(Math.round(s/3.4)%10===0)lamps.add(a[0],a[1],a[2],'#ffe0a6',.65);
  }
}
function grassyHill(batch,geo){
  const point=(r,a)=>[-5335+30*r*Math.cos(a)*.82-43*r*Math.sin(a)*.57,
    239+30*r*Math.cos(a)*.57+43*r*Math.sin(a)*.82];
  for(let j=0;j<10;j++)for(let i=0;i<40;i++){
    const a=i*Math.PI/20,b=(i+1)*Math.PI/20;
    const pts=[point(j/10,a),point((j+1)/10,a),point((j+1)/10,b),point(j/10,b)];
    batch.top(pts.map(p=>up(p,groundY(geo,...p)+.21)),['#83a35c','#88a560','#91ac68'][Math.floor(j/2)%3]);
  }
  for(const fraction of [.43,.68,.91]){
    const contour=Array.from({length:36},(_,i)=>point(fraction,-1.10+i*.105));
    pathBand(batch,geo,contour,.52,'#a8ae83',.34);
  }
  // The stair cut follows the photographed eastern flank of the knoll.
  for(let i=0;i<32;i++){
    const p=point(1.04-i*.029,-.12),xy=localFrame(p,.49),y=groundY(geo,...p)+.34;
    prism(batch,rect(xy,0,0,1.18,1.75),y-.43,y,'#a2a28c','#c6bfa1',litSurface.stone);
  }
}
// Digitized pool edges and narrow crossing walks in the southern water garden.
function waterGarden(batch,geo){
  const toWorld=([x,z])=>[-5870+(575+x*291/460)*.7,20+(668+z*285/450)*.7];
  const cells=[
    [[53,109],[86,77],[126,93],[105,151],[88,157]],[[91,69],[126,16],[146,16],[129,87]],
    [[136,90],[151,17],[163,14],[168,68]],[[147,101],[181,71],[206,80],[222,141]],
    [[119,155],[134,111],[145,103],[222,148],[226,170],[186,184]],
    [[212,86],[278,74],[254,153],[230,144]],[[265,151],[287,86],[327,130]],
    [[294,77],[306,40],[340,31],[360,90],[377,86],[373,111],[337,128]],
    [[269,164],[310,148],[312,192]],[[260,178],[311,204],[313,241],[282,273],[253,206]],
    [[208,187],[235,178],[239,199],[198,311],[171,297]],[[211,310],[244,215],[270,288]],
    [[206,321],[272,296],[301,373],[257,399],[208,358]],[[284,287],[314,253],[301,276],[310,342]],
  ];
  for(const cell of cells){
    const ring=cell.map(toWorld);
    const floor=Math.max(...ring.map(p=>groundY(geo,...p)))+.16;
    prism(batch,ring,floor-.48,floor,'#aaa28d','#527366');
    const [cx,cz]=ring.reduce(([x,z],p)=>[x+p[0]/ring.length,z+p[1]/ring.length],[0,0]);
    for(let i=0;i<10;i++){
      const weight=.25+.44*(i%4)/3,p=ring[i%ring.length];
      const x=cx+(p[0]-cx)*weight+.4*Math.sin(i),z=cz+(p[1]-cz)*weight;
      cylinder(batch,x,z,floor+.016,floor+.044,.24,.26,i%3?'#768c58':'#86985b',7);
    }
  }
}
function familyGround(batch,geo){
  const court=localFrame(aerial([410,246]),-.35);
  groundPaving(batch,geo,court,[-9,9,-13,13],'#ad7165');
  groundPaving(batch,geo,court,[-7.5,7.5,-9,9],'#737695');
  for(let i=0;i<3;i++){
    const ends=[court(-5+i*4,-4),court(-5+i*4,1.5)];
    const top=Math.max(...ends.map(p=>groundY(geo,...p)))+1.4;
    for(const [x,z] of ends)cylinder(batch,x,z,groundY(geo,x,z),top,.10,.10,'#59859c',7);
    pathTube(batch,ends.map(p=>up(p,top)),.09,'#dabb69');
  }
}
export function buildBay(batch,geo,lamps,obstacles,signs,plantings){
  for(const [w,line] of bay.paths)pathBand(batch,geo,line,w,'#b5ac94');
  waterGarden(batch,geo);familyGround(batch,geo);
  lightWalk(batch,geo,lamps);seaWalk(batch,geo,lamps);grassyHill(batch,geo);
  for(const [x,z,size] of bay.trees){
    if(hillRadius(x,z)<1.04)continue;
    plantings.push([x,groundY(geo,x,z),z,size,Math.abs(x-z)%4,.51+size*.018]);
  }
}

const fude=localFrame([-1881.4,-2577.2],Math.PI/2);
const stone='#c2bdb0', vermilion='#8d4835',tile='#d19b51',gold='#daae65';
function templeRoof(batch,u,v,w,d,eave,rise){
  sweptRoof(batch,fude,u,v,w,d,eave,rise,tile,'#b66d49',.73);
  // Coloured ridge-end silhouettes of the cut-porcelain ornament.
  for(const sign of [-1,1]){
    const at=(step,y)=>up(fude(u+sign*(w*.31+step),v),eave+rise+y);
    pathTube(batch,[at(-1.3,.21),at(-.5,1.07),at(.22,1.32),at(.88,.89),at(1.54,1.57),at(1.45,2.04)],.16,'#719989',6);
    pathTube(batch,[at(-.9,.72),at(-.40,1.42),at(.06,1.63)],.10,'#cb7053',5);
  }
}
function hall(batch,u,v,w,d,base,high,lamps){
  prism(batch,rect(fude,u,v,w*.86,d*.70),base,base+high-.35,vermilion,'#866c57');
  for(let i=0;i<5;i++){
    const [x,z]=fude(u+(i-2)*w*.19,v+d*.39);
    cylinder(batch,x,z,base,base+high,.31,.28,stone,9);
    cylinder(batch,x,z,base+high-.64,base+high,.35,.61,'#908679',8);
    if(i%2){const ly=base+high-1.0;cylinder(batch,x,z+.52,ly-.35,ly+.29,.28,.30,'#c34e37',9);lamps.add(x,ly,z+.52,'#ffac64',.45);}
  }
  templeRoof(batch,u,v,w,d,base+high,2.25);
}
function tower(batch,u,v,base,tall){
  const [x,z]=fude(u,v),xy=localFrame([x,z],Math.PI/8);
  cylinder(batch,x,z,base-.2,base+2.5,4.3,4.3,stone,8,Math.PI/8);
  const floors=tall?3:2;
  for(let i=0;i<floors;i++){
    const r=4.72-i*.62,y=base+2.5+i*3.7;
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4,[px,pz]=xy(Math.cos(a)*r*.78,Math.sin(a)*r*.78);
      cylinder(batch,px,pz,y,y+2.35,.18,.16,i?vermilion:stone,7);
    }
    if(i)cylinder(batch,x,z,y,y+2.32,r*.59,r*.59,'#905542',8,Math.PI/8);
    const rim=ellipse(xy,0,0,r,r,8);
    const crown=ellipse(xy,0,0,r*.46,r*.46,8);
    for(let j=0;j<8;j++){
      const k=(j+1)%8,a=rim[j],b=rim[k],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      batch.top([up(a,y+2.89),up(mid,y+2.34),up(crown[j],y+3.72)],tile);
      batch.top([up(mid,y+2.34),up(b,y+2.89),up(crown[k],y+3.72),up(crown[j],y+3.72)],tile);
    }
    cylinder(batch,x,z,y+3.64,y+3.78,r*.46,r*.46,gold,8,Math.PI/8);
  }
  const y=base+2.5+floors*3.7;
  cylinder(batch,x,z,y,y+1.75,1.65,.13,gold,10);cylinder(batch,x,z,y+1.74,y+2.31,.28,0,gold);
  return y+2.31;
}
export function buildFude(batch,geo,lamps,obstacles,signs){
  for(const [w,line] of templePaths)pathBand(batch,geo,line,w,'#aea899',.29);
  groundPaving(batch,geo,fude,[-9.6,9.6,50,175],'#b5aba0');
  groundPaving(batch,geo,fude,[-18.6,18.6,34,61],'#c6bdb0');
  const base=98.45,platform=rect(fude,0,8,38,51);
  prism(batch,platform,92.9,base,stone,'#cfc6ad',litSurface.paleStone);
  hall(batch,0,-10,24,12,base,7.1,lamps);
  hall(batch,0,11.2,18.7,11.5,base,5.8,lamps);
  templeRoof(batch,0,10.3,12.8,7,base+8.1,1.18);
  const sideFrame=(u,v)=>fude(v,u);
  for(const side of [-1,1]){
    const wing=rect(fude,side*15,0,6.6,35);
    prism(batch,wing,base,base+4.65,'#b18469','#a58568');
    sweptRoof(batch,sideFrame,0,side*15,35.8,7.8,base+4.64,1.75,tile,'#ab7656',.52);
    const top=tower(batch,side*12.7,33.5,base-.4,side>0);
    obstacles.add(rect(fude,side*12.7,33.5,8.8,8.8),top);
  }
  for(let i=0;i<24;i++){
    const v=33.2+(i+.5)*.44;
    prism(batch,rect(fude,0,v,16.8,.46),93.0,base-i*.192,'#9f9c8e','#ccc6b8',litSurface.stone);
  }
  for(const u of [-8.55,-2.15,2.15,8.55]){
    const rail=(v,y)=>up(fude(u,v),y);
    pathTube(batch,[rail(33.3,base+.83),rail(43.7,base-3.67)],.14,'#cdc7ba',7);
    for(let i=0;i<6;i++){const v=33.3+i*2.04,[x,z]=fude(u,v),y=base-(v-33.3)*.43;
      cylinder(batch,x,z,y-.2,y+.96,.17,.15,stone,7);}
  }
  prism(batch,rect(fude,0,15.85,5.65,.24),base+4.3,base+5.5,'#5f4637','#6b513f');
  signs.push({label:'福德正神',ink:'#e7bf73',a:fude(-2.55,16.03),b:fude(2.55,16.03),y:base+4.43,height:.89});
  obstacles.add(platform,base);obstacles.add(rect(fude,0,-10,24,12),base+11);
  obstacles.add(rect(fude,0,11.2,18.7,11.5),base+11.4);
}
