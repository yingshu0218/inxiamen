import * as THREE from 'three';
import {cylinder} from '../scenery-mesh.js';
import {pathTube} from '../landmark-haicang.js';
import {sections,pointAt,ribbon} from './geometry.js';

export function pedestrianBridge(batch, feature, ground, lights, obstacles) {
  const fish=feature.id===391904806, frames=sections(feature.points,1.8), span=frames.at(-1).distance;
  const y=Math.max(...frames.map(f=>ground(f.x,f.z)))+5.9;
  const deck=(_x,_z,f)=>y+.55*Math.sin(Math.PI*f.distance/span);
  const half=fish?2.8:2.0;
  ribbon(batch,frames,-half,half,deck,fish?'#aa826a':'#c4bda6');
  for(const side of [-1,1]){
    const edge=frames.map(f=>pointAt(f,side*half,deck,1.12));
    pathTube(batch,edge,.095,'#bec5be',5);
    pathTube(batch,frames.map(f=>pointAt(f,side*half,deck,-.22)),.23,'#92968e',5);
    frames.forEach((f,i)=>{
      if(i%2) return;
      const rib=[pointAt(f,side*(half-.7),deck,-.63),pointAt(f,side*(half+.12),deck,-.05),
        pointAt(f,side*(half+.32),deck,1.25)];
      pathTube(batch,rib,fish?.19:.064,fish?'#b7513e':'#e3e2d8',5);
      if(fish && i%8===0)lights.add(...rib[1],'#ffb481',.75);
    });
  }
  for(const i of [0,frames.length-1]){
    const f=frames[i];
    cylinder(batch,f.x,f.z,ground(f.x,f.z),deck(0,0,f)-.2,.67,.93,'#adaea4',8);
  }
  // Stair flights continue away from the traffic on the two recorded approaches.
  const approaches=fish?[[-693,5762],[-627,5721]]:[[-2810,4940],[-2829,4997]];
  for(const [i,end] of approaches.entries()){
    const f=frames[i?frames.length-1:0], stairs=sections([[f.x,f.z],end],.6);
    const low=ground(...end)+.48, length=stairs.at(-1).distance;
    for(let j=1;j<stairs.length;j++){
      const level=y+(low-y)*stairs[j].distance/length;
      ribbon(batch,stairs.slice(j-1,j+1),-half,half,()=>level,'#b7a18c');
    }
  }
  for(let i=1;i<frames.length;i++){
    const p=[frames[i-1],frames[i]].flatMap(f=>[-half,half].map(r=>[f.x+r*f.nx,f.z+r*f.nz]));
    obstacles.add([p[0],p[1],p[3],p[2]],y+1.7);
  }
}

export function beachWorks(batch,ground,lights) {
  // The access stair lies west of the Huli Hill underpass. The public works
  // report gives its width and total drop. The exact chainage is approximate.
  const frames=sections([[-2612,5075],[-2614.5,5080.4]],.48);
  const foot=ground(frames[0].x,frames[0].z)+.51-1.7;
  for(let i=1;i<frames.length;i++){
    const h=foot+1.7*(1-(i-1)/(frames.length-2));
    ribbon(batch,frames.slice(i-1,i+1),-3,3,()=>h,'#c2b8a7');
  }
  for(const f of [frames[0],frames.at(-1)])lights.add(f.x+3,foot+2.3,f.z,'#ffdaa3',1);
}

export function wavePlaza(group,batch,ground) {
  const frames=sections([[4364,2859],[4433,2805],[4507,2755],[4571,2712]],5);
  for(let i=1;i<frames.length;i++){
    const pair=frames.slice(i-1,i+1);
    const outline=pair.map(f=>pointAt(f,4.3+1.8*Math.sin(f.distance*.092),ground,.25));
    batch.top([pointAt(pair[0],-3.5,ground,.25),...outline,pointAt(pair[1],-3.5,ground,.25)],'#cfbea3');
  }
  const canvas=document.createElement('canvas'); canvas.width=1024;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#ce4d37';ctx.font='bold 115px sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  Array.from('一国两制统一中国').forEach((c,i)=>ctx.fillText(c,64+i*128,69));
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(106,11),new THREE.MeshStandardMaterial({map,alphaTest:.4,side:THREE.DoubleSide}));
  mesh.position.set(4476,ground(4476,2684)+6.5,2684);mesh.rotation.y=.60;
  mesh.name='黄厝 · 海浪平台对岸字牌';group.add(mesh);
  return map;
}

export function sandBridge(batch,obstacles){
  // October 9 steelwork stage. The coastal span stops at its seaward joint.
  const axis=[.793,-.609], center=[7179,-2113], row=(s,r,y)=>[
    center[0]+axis[0]*s-axis[1]*r,y,center[1]+axis[1]*s+axis[0]*r];
  for(let i=0;i<42;i++){
    const a=-262.5+12.5*i,b=a+12.5;
    for(const [l,r,h] of [[-19,19,15],[-40,-23,10],[23,40,10]]){
      const corners=[row(a,l,h),row(b,l,h),row(b,r,h),row(a,r,h)];
      batch.top(corners,'#bd8276');
      obstacles.add(corners.map(p=>[p[0],p[2]]),h);
      for(const side of [l,r])batch.face([row(a,side,h),row(a,side,h-2.2),row(b,side,h-2.2),row(b,side,h)],'#7f9396');
    }
  }
  for(const s of [-125,0,125]){
    const u=s/192.5, spread=24-8*(1-u*u), y=4+93*(1-u*u);
    pathTube(batch,[row(s,-spread,y),row(s,0,y-4),row(s,spread,y)],1.2,'#c3cccc',8);
  }
  for(const side of [-1,1]){
    const arch=Array.from({length:49},(_,i)=>{
      const u=i/24-1;return row(192.5*u,side*(24-8*(1-u*u)),4+93*(1-u*u));
    });
    pathTube(batch,arch,2.9,'#d6dede',8);
    for(let i=4;i<=44;i+=2){
      const p=arch[i];pathTube(batch,[p,[p[0],15,p[2]]],.24,'#8e9da0',5);
      const [x,y,z]=p;obstacles.add([[x-5,z-5],[x+5,z-5],[x+5,z+5],[x-5,z+5]],y+3);
    }
  }
}
