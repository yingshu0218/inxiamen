import * as THREE from 'three';
import { box, cylinder, groundY, MeshBatch, randomSource, TAU } from './scenery-mesh.js';
import { avenue, busStops, shoreWalk } from './hubin-layout.js';
import { offset, plan, shore, street } from './old-town-layout.js';

export function visitorGeometry(coat, trousers, skin, bag) {
  const b=new MeshBatch();
  for(const side of [-1,1]){
    const x=side*.122;
    cylinder(b,x,0,.12,.86,.088,.107,trousers,7);
    box(b,x,.045,.16,.28,.035,.14,'#49463e','#585349');
    cylinder(b,side*.245,.018,.84,1.34,.058,.080,skin,7);
    cylinder(b,side*.228,.01,1.13,1.41,.082,.096,coat,7);
  }
  cylinder(b,0,0,.81,1.34,.197,.241,coat,8);
  cylinder(b,0,0,1.34,1.45,.241,.122,coat,8);
  cylinder(b,0,0,1.41,1.53,.073,.082,skin,8);
  cylinder(b,0,.006,1.5,1.67,.101,.128,skin,9);
  cylinder(b,0,-.009,1.65,1.76,.131,.086,'#483b34',9);
  if(bag)box(b,0,-.172,.26,.14,.92,1.33,'#9a795e','#b29472');
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));
  g.setAttribute('color',new THREE.Uint8BufferAttribute(b.colors,3,true));
  g.setIndex(b.indices);
  return g;
}

export function oldTownWalkers(parent,geo) {
  const rand=randomSource(4822), people=[], clock={value:0};
  const styles=[
    ['#ac6850','#424e51','#cc9e81',true],['#798c8d','#5d625a','#b5876d',false],
    ['#d2ba85','#596573','#cd9b78',false],['#617c68','#584b41','#d5a888',true],
    ['#d8cdb8','#666e77','#bd8f76',false],
  ];
  function party(path,s,lateral,count,floor,district=0){
    const distance=5+rand()*12, rate=(.68+rand()*.61)/distance;
    const phase=rand()*TAU;
    for(let j=0;j<count;j++){
      const from=s+j*.68, side=lateral+j*.74;
      const start=offset(path.sample(from-distance),side), end=offset(path.sample(from+distance),side);
      people.push({district,style:Math.floor(rand()*styles.length),start,end,y0:floor(start),y1:floor(end),
        scale:.83+.22*rand(),phase:phase+.049*j,rate,bearing:Math.atan2(end[0]-start[0],end[1]-start[1])});
    }
  }
  const oldStreet=p=>groundY(geo,...p)+.56, oldShore=p=>Math.max(3.45,groundY(geo,...p)+.63);
  const pavement=p=>Math.max(1.1,groundY(geo,...p))+.55, lakePath=p=>Math.max(1.33,groundY(geo,...p))+.27;
  const [lo,hi]=plan.pedestrian;
  for(let s=lo+22;s<hi-18;s+=11+rand()*17)party(street,s,rand()*8.1-4.55,rand()>.48?2:1,oldStreet);
  for(let s=29;s<shore.length-22;s+=24+rand()*30)party(shore,s,-3.10+rand()*1.25,rand()>.60?2:1,oldShore);

  for(const stop of busStops){
    for(const spacing of [-25,17,42])party(avenue,stop.s+spacing,stop.side*13.78,spacing===17?2:1,pavement,1);
  }
  for(let s=282;s<612;s+=26+rand()*28)party(shoreWalk,s,-.77+rand()*.84,rand()>.49?2:1,lakePath,1);

  const mat=new THREE.MeshLambertMaterial({vertexColors:true});
  mat.onBeforeCompile=shader=>{
    shader.uniforms.walkTime=clock;
    shader.vertexShader='uniform float walkTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      float stride=sin(walkTime*5.2+instanceMatrix[3].x*.08+instanceMatrix[3].z*.06)*sign(position.x);
      float leg=1.-smoothstep(.10,.85,position.y);
      float arm=smoothstep(.18,.25,abs(position.x))*smoothstep(.78,.85,position.y)*(1.-smoothstep(.89,1.41,position.y));
      transformed.z+=stride*(leg*.19-arm*.14);
      transformed.y+=leg*max(stride,0.)*.036;
    `);
  };
  const crowds=styles.flatMap((style,i)=>{
    const geometry=visitorGeometry(...style);
    return [0,1].map(district=>{
      const group=people.filter(p=>p.style===i && p.district===district);
      const mesh=new THREE.InstancedMesh(geometry,mat,group.length);
      mesh.name=district?'广电中心站与环湖步道 · 行人':'中山路与滨水步道 · 行人';
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled=false; parent.add(mesh);
      return {mesh,group,district,last:-Infinity};
    });
  });
  const pose=new THREE.Object3D();
  return (time,plane)=>{
    const visible=[Math.hypot(plane.x+5360,plane.z-2650)<2100,Math.hypot(plane.x+2636,plane.z+650)<1050];
    clock.value=time;
    for(const crowd of crowds){
      const {mesh,group,district}=crowd;
      mesh.visible=visible[district];
      if(!mesh.visible){crowd.last=-Infinity;continue;}
      if(Math.abs(time-crowd.last)<1/30)continue;
      crowd.last=time;
      for(const [i,p] of group.entries()){
        const angle=time*p.rate+p.phase, t=.5+.5*Math.sin(angle);
        pose.position.set(THREE.MathUtils.lerp(p.start[0],p.end[0],t),THREE.MathUtils.lerp(p.y0,p.y1,t),
          THREE.MathUtils.lerp(p.start[1],p.end[1],t));
        pose.rotation.y=p.bearing+Math.PI*THREE.MathUtils.smoothstep(-Math.cos(angle),-.07,.07);
        pose.scale.setScalar(p.scale);
        pose.updateMatrix(); mesh.setMatrixAt(i,pose.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
    }
  };
}
