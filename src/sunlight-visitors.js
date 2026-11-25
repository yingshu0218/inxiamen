import { Mesh, MeshLambertMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { visitorGeometry } from './old-town-walkers.js';
import { eastLandingLevel, slabLandingLevel, summitLevel, summitPoint, sunlight } from './sunlight-layout.js';
import { apronLevel } from './sunlight-terraces.js';

export function addSunlightVisitors(parent) {
  const figures=[];
  function stand([x,z],y,dx,dz,bearing,scale,coat,trousers,skin,bag=false) {
    const g=visitorGeometry(coat,trousers,skin,bag);
    g.scale(scale,scale,scale).rotateY(bearing).translate(x+dx,y+.008,z+dz);
    figures.push(g);
  }
  stand(summitPoint,summitLevel,-1.97,.63,-1.22,1.01,'#87584c','#3d4749','#c59c7c',true);
  stand(summitPoint,summitLevel,-1.66,-.10,-1.6,.94,'#dfd1b9','#60665c','#b68c70');
  stand(summitPoint,summitLevel,.27,2.14,.48,.97,'#496778','#504c48','#d4ab8d');
  stand(summitPoint,apronLevel,4.62,2.70,.98,.95,'#b95d4e','#4b555f','#c69b83');
  stand(summitPoint,apronLevel,3.87,2.95,1.88,1.03,'#c0a875','#565b60','#b58a70',true);
  stand(sunlight.upperSteps[1],eastLandingLevel,.94,-.60,2.04,.94,'#a6b1a3','#535460','#d0a386');
  stand(sunlight.eastViewpoint,eastLandingLevel,-.20,-.64,2.19,.98,'#7d8f98','#565e59','#c99979');
  stand(sunlight.slabViewpoint,slabLandingLevel,-.46,.89,-.65,.97,'#688b80','#4c5052','#bb8f73',true);
  stand(sunlight.slabViewpoint,slabLandingLevel,.25,1.04,-.22,.91,'#ceaa6b','#53616b','#d3aa8c');
  const geometry=mergeGeometries(figures);
  for(const g of figures) g.dispose();
  const visitors=new Mesh(geometry,new MeshLambertMaterial({vertexColors:true}));
  visitors.name='日光岩观景台游客';
  visitors.castShadow=visitors.receiveShadow=true;
  parent.add(visitors);
  return (viewer,night)=>{
    visitors.visible=night<.64 && Math.hypot(viewer.x-summitPoint[0],viewer.z-summitPoint[1])<800;
  };
}
