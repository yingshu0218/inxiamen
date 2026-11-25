import {MeshBatch,box,cylinder,prism} from '../scenery-mesh.js';
import {pathTube} from '../landmark-haicang.js';
import {sections,wuyuanPaving} from './geometry.js';
import {wuyuanLanes,westBridgeWalk} from './wuyuan-layout.js';

const mix=(a,b,t)=>a+(b-a)*t;
const halfMain=104, sideSpan=58;
const white='#e9eae2', concrete='#b6bcb6';

function bridgeRows(ground){
  const [south,north]=wuyuanLanes;
  const rows=[];
  const section=(i,t)=>{
    const lane=p=>p.points[i-1].map((v,k)=>mix(v,p.points[i][k],t));
    const lanes=[lane(south),lane(north)];
    return {lanes,x:(lanes[0][0]+lanes[1][0])/2,z:(lanes[0][1]+lanes[1][1])/2};
  };
  for(let i=1;i<south.points.length;i++){
    const a=section(i,0),b=section(i,1),steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/5);
    for(let j=0;j<steps;j++)rows.push(section(i,j/steps));
  }
  rows.push(section(south.points.length-1,1));
  let station=0;
  for(const [i,f] of rows.entries()){
    const a=rows[Math.max(0,i-1)],b=rows[Math.min(rows.length-1,i+1)];
    f.s=station+=Math.hypot(f.x-a.x,f.z-a.z);
    f.normals=f.lanes.map((p,k)=>{
      const [ax,az]=i===0?wuyuanLanes[k].west:a.lanes[k];
      const [bx,bz]=i===0?p:b.lanes[k],dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
      return [-dz/len,dx/len];
    });
  }
  const last=rows.at(-1),total=last.s,first=rows[0];
  for(const f of rows){
    const t=f.s/total;
    f.averageHeight=0;
    f.height=f.lanes.map((_,k)=>{
      const y=mix(ground(...first.lanes[k]),ground(...last.lanes[k]),t)+.39+17*Math.sin(Math.PI*t);
      f.averageHeight+=y/2;
      return y;
    });
  }
  return rows;
}

export function buildWuyuanBridge(group,ground,material,lights,obstacles,westRoadTerrain=ground){
  const deck=new MeshBatch(),steel=new MeshBatch(),rows=bridgeRows(ground);
  const total=rows.at(-1).s;
  // The centre between the two main arch footings, located on the January aerial.
  const centre=rows.find(f=>f.x>=4814).s;
  function at(station,offset=0,vertical=0){
    const s=Math.min(total,Math.max(0,station));
    const i=Math.max(1,rows.findIndex(f=>f.s>=s));
    const f=rows[i-1],g=rows[i],t=(s-f.s)/(g.s-f.s);
    const [nx,nz]=g.normals[0];
    return [mix(f.x,g.x,t)+nx*offset,mix(f.averageHeight,g.averageHeight,t)+vertical,mix(f.z,g.z,t)+nz*offset];
  }
  function corner(f,k,offset,lift=0){
    const [cx,cz]=f.lanes[k],[nx,nz]=f.normals[k];
    const x=cx+nx*offset,z=cz+nz*offset,west=Math.max(0,1-f.s/32);
    // Match the western approach's rendered roadbed across the joint and
    // blend back into the raised deck profile over its first 32 metres.
    const crossfall=west ? west*(westRoadTerrain(x,z)-ground(cx,cz)) : 0;
    return [x,f.height[k]+crossfall+lift*(1-west),z];
  }
  function medianTriangle(a,b,c){
    // The staggered western joints start with overlapping inner shoulders.
    // A reversed triangle there folds the median back over the paved lane.
    const up=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    if(up>0)deck.face([a,b,c],'#aaa99b');
  }
  let previous,lightAt=30;
  for(const f of rows){
    const west=Math.max(0,1-f.s/35),east=Math.max(0,1-(total-f.s)/35);
    const inSpan=Math.max(0,Math.min(1,(halfMain+sideSpan+20-Math.abs(f.s-centre))/20));
    const half=6.8+2.2*west;
    const sides=f.lanes.map((_,k)=>{
      const sign=k===0?1:-1;
      const paved=half-.6,walk=(1-Math.max(east,west))*(1.8+1.45*inSpan);
      const boundary=corner(f,k,sign*(half+walk)),rail=[boundary[0],boundary[1]+.9,boundary[2]];
      return {inner:corner(f,k,-sign*half), innerLine:corner(f,k,-sign*paved,.026),
        outerLine:corner(f,k,sign*paved,.026),edge:corner(f,k,sign*half),boundary,rail};
    });
    if(previous){
      for(const [k,b] of sides.entries()){
        const a=previous[k];
        const strip=(l,r,c)=>deck.top([a[l],a[r],b[r],b[l]],c);
        strip('inner','innerLine','#a09f93');strip('innerLine','outerLine','#6d7372');
        strip('outerLine','edge','#aaa89b');strip('edge','boundary','#c9c8ba');
        const lower=p=>[p[0],p[1]-1.30,p[2]];
        steel.face([a.boundary,b.boundary,lower(b.boundary),lower(a.boundary)],concrete);
        steel.face([a.boundary,a.rail,b.rail,b.boundary],'#c9cdc5');
      }
      if(west>0){
        medianTriangle(previous[0].inner,sides[0].inner,previous[1].inner);
        medianTriangle(previous[1].inner,sides[0].inner,sides[1].inner);
      }else{
        deck.top([previous[0].inner,previous[1].inner,sides[1].inner,sides[0].inner],'#aaa99b');
      }
      const footprint=[previous[0].boundary,sides[0].boundary,sides[1].boundary,previous[1].boundary];
      obstacles.add(footprint.map(([x,,z])=>[x,z]),Math.max(...footprint.map(p=>p[1]))+.9);
      const underside=footprint.map(([x,y,z])=>[x,y-1.3,z]);
      steel.face(underside,concrete);
    }
    if(f.s>=lightAt){
      for(const side of sides)lights.add(side.boundary[0],side.rail[1]-.2,side.boundary[2],'#ffe2b3',.85);
      lightAt+=24;
    }
    previous=sides;
  }
  const median=rows.map(f=>[f.x,f.averageHeight+.38,f.z]);
  pathTube(steel,median,.35,'#b8bbb5',4);
  for(let s=6;s<total-5;s+=12){
    const f=rows.find(row=>row.s>=s),g=rows.find(row=>row.s>=s+4);
    for(const k of [0,1])for(const w of [-2.07,2.07])
      deck.top([corner(f,k,w-.11,.065),corner(f,k,w+.11,.065),corner(g,k,w+.11,.065),corner(g,k,w-.11,.065)],'#e2decb');
  }
  // Box-section ribs tilt in toward the crown. The side spans stay below the deck.
  function member(points,radius,color,collidable=false,sides=4){
    pathTube(steel,points,radius,color,sides);
    if(!collidable)return;
    for(let i=1;i<points.length;i++){
      const [x,y,z]=points[i-1],[bx,by,bz]=points[i];
      const dx=bx-x,dz=bz-z,len=Math.hypot(dx,dz)||1,nx=-dz/len*radius,nz=dx/len*radius;
      obstacles.add([[x-nx,z-nz],[x+nx,z+nz],[bx+nx,bz+nz],[bx-nx,bz-nz]],Math.max(y,by)+radius);
    }
  }
  function arch(u,side){
    const rise=1-u*u,p=at(centre+halfMain*u,side*(19.2-9.6*rise));
    p[1]=3.1+52*rise;
    return p;
  }
  for(const side of [-1,1]){
    member(Array.from({length:61},(_,i)=>arch(i/30-1,side)),2.1,white,true);
    for(let i=-9;i<=9;i++){
      const u=i/11,p=arch(u,side),q=at(centre+halfMain*u,side*16.4);
      if(p[1]>q[1]+1)member([p,q],.11,'#bec6c1',true);
    }
    for(const direction of [-1,1]){
      const root=centre+direction*halfMain;
      const endArch=t=>{
        const p=at(root+direction*sideSpan*t,side*(19.2-3.5*t));
        p[1]=mix(3.1,p[1]-1.25,1-(1-t)**2);
        return p;
      };
      member(Array.from({length:17},(_,i)=>endArch(i/16)),1.55,white);
      for(const t of [.23,.49,.73])member([endArch(t),at(root+direction*sideSpan*t,side*(19.2-3.5*t),-1)],.86,white);
      const [x,,z]=arch(direction,side);
      box(steel,x,z,7,8,-2,3.1,'#a5afa9','#bec9c1',0,0,-.42);
    }
  }
  for(const u of [-.48,-.24,0,.24,.48])member([arch(u,-1),arch(u,1)],.86,white,true);
  for(const direction of [-1,1]){
    const root=centre+direction*halfMain;
    const feet=[-1,1].map(side=>arch(direction,side));
    member(feet.map(([x,,z])=>[x,1.9,z]),1.2,concrete);
    // Approximate 40 m bays with local offsets to clear the mapped paths below.
    const offsets=direction<0?[0,8,12,-10,8,0]:[0,0,6,0,-3,0];
    for(const [i,offset] of offsets.entries()){
      const s=root+direction*(sideSpan+40*i)+offset;
      const cap=[-1,1].map(side=>at(s,side*8.2,-1.75));
      member(cap,.75,concrete);
      for(const [x,y,z] of cap)cylinder(steel,x,z,-2,y,1.25,1.55,concrete,8);
    }
  }
  const roadway=deck.finish(group,material,'五缘大桥 · 双幅连续桥面');
  const structure=steel.finish(group,material,'五缘大桥 · 提篮拱与引桥');
  roadway.receiveShadow=structure.receiveShadow=true;
}

// The lower western walk follows the quay around the point. A small fascia
// supports its edges where the raster shore clips the generic street.
export function westWaterfront(paths,details,ground){
  const frames=sections(westBridgeWalk,5);
  wuyuanPaving(paths,frames,-1.75,1.75,ground,'#7293a6',.57,
    {batch:details,bothEdges:true,bottom:-.5,color:'#a6aca1'});
  // OSM coast 993673322 / 128680466. This low foundation is visible only
  // where the coarser terrain or tidal mask cuts away the land behind the walk.
  const westBank=[[4386.2,-7076.4],[4636.8,-6964.9],[4644.3,-6960.2],
    [4647.7,-6955],[4647,-6945.9],[4620.2,-6890.5],[4600.9,-6850.6],
    [4581.6,-6810.9],[4520,-6840],[4386.2,-6970]];
  prism(details,westBank,-.75,.32,'#96978b','#7f8777');
}
