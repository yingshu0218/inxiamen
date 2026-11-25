import * as THREE from 'three';
import { inRing } from './scenery-mesh.js';

export function readLakes(records) {
  const cells=new Map(), lakes=[];
  const cell=300, key=(i,j)=>i*2048+j;
  for(const source of records){
    const rings=source.rings.map(flat=>{
      const ring=[];
      for(let i=0;i<flat.length;i+=2)ring.push([flat[i],flat[i+1]]);
      return ring;
    });
    const xx=rings[0].map(p=>p[0]), zz=rings[0].map(p=>p[1]);
    const bounds=[Math.min(...xx),Math.max(...xx),Math.min(...zz),Math.max(...zz)];
    const lake={...source,rings,bounds};
    lakes.push(lake);
    for(let i=Math.floor(bounds[0]/cell);i<=Math.floor(bounds[1]/cell);i++)
      for(let j=Math.floor(bounds[2]/cell);j<=Math.floor(bounds[3]/cell);j++){
        const k=key(i,j);
        if(!cells.has(k))cells.set(k,[]);
        cells.get(k).push(lake);
      }
  }
  function find(x,z,seekIslet){
    const candidates=cells.get(key(Math.floor(x/cell),Math.floor(z/cell)));
    if(!candidates)return undefined;
    for(const lake of candidates){
      const [xmin,xmax,zmin,zmax]=lake.bounds;
      if(x<xmin||x>xmax||z<zmin||z>zmax)continue;
      if(!inRing(x,z,lake.rings[0]))continue;
      let inIslet=false;
      for(let i=1;i<lake.rings.length;i++){
        if(inRing(x,z,lake.rings[i])){inIslet=true;break;}
      }
      if(inIslet===seekIslet)return lake;
    }
  }
  return {lakes,waterAt:(x,z)=>find(x,z,false),isletAt:(x,z)=>find(x,z,true)};
}

export function lakeGeometry(lakes) {
  const positions=[],indices=[];
  for(const lake of lakes){
    if(lake.h<=.45)continue;
    const shape=lake.rings.map(r=>r.map(p=>new THREE.Vector2(...p)));
    const faces=THREE.ShapeUtils.triangulateShape(shape[0],shape.slice(1));
    const first=positions.length/3;
    for(const ring of shape)for(const p of ring)positions.push(p.x,lake.h+.13,p.y);
    for(const tri of faces)indices.push(first+tri[0],first+tri[2],first+tri[1]);
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geom.setIndex(indices);
  geom.computeBoundingSphere();
  return geom;
}
