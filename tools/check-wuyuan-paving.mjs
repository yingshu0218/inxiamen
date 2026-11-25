// Inspect the upward pavement triangles across every lower-level cross-section.
import assert from 'node:assert/strict';
import {Color} from 'three';
import {sections} from '../src/coast/geometry.js';
import {survey} from '../src/coast/layout.js';
import {westBridgeWalk} from '../src/coast/wuyuan-layout.js';
import north from '../src/coast/north.json' with {type:'json'};

const paint=tone=>new Color(tone).toArray().map(v=>Math.round(v*255)).join(',');
const asphalt=paint('#787c76'), shoulder=paint('#a39f90'), blue=paint('#7293a6'), apron=paint('#adaca0'), bank=paint('#7f8777');
const wanted=new Set([asphalt,shoulder,blue,apron,bank]);

// Bin only the relevant upward triangles. A ray hitting a different material
// above the target skin is an obstruction even when the target itself exists.
function pavementIndex(meshes) {
  const bins=new Map(),key=(x,z)=>Math.floor(x/8)*4096+Math.floor(z/8);
  for(const mesh of meshes){
    const {position,color}=mesh.geometry.attributes,indices=mesh.geometry.index.array;
    for(let i=0;i<indices.length;i+=3){
      const a=indices[i];
      const tone=color.array.slice(3*a,3*a+3).join(',');
      if(!wanted.has(tone))continue;
      const tri=Array.from(indices.slice(i,i+3),j=>[position.getX(j),position.getZ(j),position.getY(j)]);
      const xs=tri.map(p=>p[0]),zs=tri.map(p=>p[1]);
      if(Math.max(...xs)<4400||Math.min(...xs)>5480||Math.max(...zs)<-7120||Math.min(...zs)>-6360)continue;
      for(let u=Math.floor(Math.min(...xs)/8);u<=Math.floor(Math.max(...xs)/8);u++)
        for(let v=Math.floor(Math.min(...zs)/8);v<=Math.floor(Math.max(...zs)/8);v++){
          const k=u*4096+v;
          if(!bins.has(k))bins.set(k,[]);
          bins.get(k).push({tri,tone});
        }
    }
  }
  return (x,z)=>{
    const hits=new Map();
    for(const {tri:[a,b,c],tone} of bins.get(key(x,z))??[]){
      const dx=b[0]-a[0],dz=b[1]-a[1],ex=c[0]-a[0],ez=c[1]-a[1];
      const det=dx*ez-dz*ex;
      if(det>=-1e-8)continue; // front-facing from above
      const t=((x-a[0])*ez-(z-a[1])*ex)/det,u=(dx*(z-a[1])-dz*(x-a[0]))/det;
      if(t<-.00001||u<-.00001||t+u>1.00001)continue;
      const h=a[2]+t*(b[2]-a[2])+u*(c[2]-a[2]);
      hits.set(tone,Math.max(hits.get(tone)??-Infinity,h));
    }
    return hits;
  };
}

export function lowerPavingChecks(group,geo){
  const hit=pavementIndex(group.children.slice(-3));
  const bike=survey.bikes.find(r=>r.id===129281162);
  const turn=north.frontages.find(r=>r.id===1499402992);
  const exit=north.frontages.find(r=>r.id===1498729200);
  return [[turn.points,9,3.8,'east vehicle turn'],[exit.points,9,3.8,'east vehicle exit'],
    [bike.points,8,1.8,'east shared path'],[westBridgeWalk,5,1.75,'west shared path']].map(([line,spacing,width,name])=>{
    const frames=sections(line,spacing);
    let worst,points=0,minGround=Infinity,minQuay=Infinity,minBank=Infinity,metres=0,missing=0,buried=0,covered=0;
    for(let i=1;i<frames.length;i++){
      const a=frames[i-1],b=frames[i],length=b.distance-a.distance;
      const rows=Math.ceil(length/.8),cols=Math.ceil(width*2/.4);
      for(let r=0;r<rows;r++){
        const t=(r+.5)/rows,cx=a.x+t*(b.x-a.x),cz=a.z+t*(b.z-a.z);
        if(cx>5450||cz> -6385||cz< -7095)continue;
        metres+=length/rows;
        for(let j=0;j<=cols;j++){
          const w=(2*j/cols-1)*(width-.012);
          const x=cx+w*(a.nx+t*(b.nx-a.nx)),z=cz+w*(a.nz+t*(b.nz-a.nz));
          const hits=hit(x,z),tone=width>3?(Math.abs(w)>3.5?shoulder:asphalt):blue,y=hits.get(tone);
          points++;
          if(!Number.isFinite(y)){missing++;continue;}
          const depth=y-geo.islandSurfaceHeightAt(x,z),quay=y-(hits.get(apron)??-Infinity);
          if(depth<=0)buried++;
          const aboveBank=y-(hits.get(bank)??-Infinity);
          if(quay<=0||aboveBank<=0)covered++;
          minBank=Math.min(minBank,aboveBank);
          if(depth<minGround)worst=[x,z];
          minGround=Math.min(minGround,depth);minQuay=Math.min(minQuay,quay);
        }
      }
    }
    const stats={name,worst,metres:+metres.toFixed(1),points,missing,buried,covered,minGroundM:+minGround.toFixed(3),
      minQuayM:Number.isFinite(minQuay)?+minQuay.toFixed(3):null,
      minBankM:Number.isFinite(minBank)?+minBank.toFixed(3):null};
    assert(points>0&&missing+buried+covered===0,JSON.stringify(stats));
    return stats;
  });
}
