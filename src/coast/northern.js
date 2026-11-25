import north from './north.json' with {type:'json'};
import {box,cylinder,prism} from '../scenery-mesh.js';
import {pathTube} from '../landmark-haicang.js';
import {sections,pointAt,ribbon,wuyuanPaving} from './geometry.js';

// East end of each existing bulk bridge. Its shoulders and centre are level
// across the joint, even where the DEM has a cross slope.
export function abutmentSections(road, ground) {
  const joint=north.abutments.find(a=>a.road===road.id);
  if (!joint) return {frames:sections(road.points,12),ground};
  const points=[...road.points], first=joint.end==='first';
  const end=first?0:points.length-1;
  points[end]=joint.bridge;
  const frames=sections(points,12), tip=frames[first?0:frames.length-1];
  const [bx,bz]=joint.bridge, dx=bx-joint.next[0], dz=bz-joint.next[1];
  const span=Math.hypot(dx,dz), sign=first?1:-1;
  tip.nx=-sign*dz/span; tip.nz=sign*dx/span;
  for(const f of frames) f.jointBlend=Math.max(0,1-Math.abs(f.distance-tip.distance)/48);
  return {frames,ground:(x,z,f)=>ground(x,z)+(ground(bx,bz)-ground(x,z))*f.jointBlend};
}

function hengsan(roads,details,ground){
  const incoming=north.eastApproach.points;
  const approach=sections([...incoming.slice(0,4),north.turnLeft[0]],7);
  ribbon(roads,approach,-3.5,3.5,ground,'#676d6c',.55);
  const widened=sections(north.turnLeft.slice(0,2),4);
  ribbon(roads,widened,-5.35,5.35,ground,'#676d6c',.55);
  const left=sections(north.turnLeft.slice(1),3),right=sections(north.turnRight,3);
  ribbon(roads,left,-3.3,3.3,ground,'#676d6c',.58);
  ribbon(roads,right,-1.65,1.65,ground,'#676d6c',.58);
  // Three approach lanes, the two left arrows share the opening in the median.
  const lane=sections([north.turnLeft[0],north.turnLeft[1]],3);
  for(const offset of [-1.75,1.75])ribbon(roads,lane,offset-.09,offset+.09,ground,'#dfd8bd',.60);
  const f=lane[Math.floor(lane.length/2)];
  for(const [offset,turn] of [[-3.5,-1],[0,-1],[3.5,1]]){
    const p=(along,side)=>[f.x+along*f.nz+(side+offset)*f.nx,f.z-along*f.nx+(side+offset)*f.nz];
    const arrow=sections([p(-3,0),p(.7,0),p(1.2,turn*.7),p(1.2,turn*1.45)],.8);
    ribbon(roads,arrow,-.17,.17,ground,'#e4dfc8',.63);
    roads.top([p(.42,turn*.9),p(1.2,turn*1.75),p(1.98,turn*.9)].map(([x,z])=>[x,ground(x,z)+.64,z]),'#e4dfc8');
  }
  for(const line of [north.crossing,[[6214,-5282],[6220,-5274]]]){
    const cross=sections(line,.85);
    for(let i=1;i<cross.length;i+=2)ribbon(roads,cross.slice(i-1,i+1),-1.85,1.85,ground,'#ddd9c5',.65);
  }
  for(const [x,z] of [...north.crossing,[6217,-5268],[6176,-5292]]){
    const y=ground(x,z);
    cylinder(details,x,z,y,y+4.4,.12,.09,'#8e9792',6);
    box(details,x,z,.42,.31,y+3.3,y+4.5,'#303b3a','#4b5751');
    for(const [h,lens] of [[4.24,'#994c41'],[3.90,'#9b8750'],[3.56,'#64816f']])
      box(details,x,z+.16,.18,.035,y+h-.09,y+h+.09,lens,lens);
  }
}

function mupu(details,ground,obstacles){
  const main=sections(north.mupu.points,4), top=Math.max(...main.map(f=>ground(f.x,f.z)))+6.3;
  function deck(frames,height,width){
    ribbon(details,frames,-width,width,height,'#d9d9ce');
    for(const side of [-width,width]){
      const rail=frames.map(f=>pointAt(f,side,height,1.06));
      pathTube(details,rail,.09,'#f0ede1',4);
      for(let i=1;i<frames.length;i++){
        const a=frames[i-1],b=frames[i];
        details.face([pointAt(a,side,height,-.55),pointAt(a,side,height,.38),
          pointAt(b,side,height,.38),pointAt(b,side,height,-.55)],'#e3e4d9');
        if(i%2===0)pathTube(details,[pointAt(b,side,height,.35),rail[i]],.055,'#c5c9c0',4);
      }
    }
    for(let i=1;i<frames.length;i++){
      const a=frames[i-1],b=frames[i];
      const corners=[[a,-width],[a,width],[b,width],[b,-width]].map(([f,w])=>[f.x+w*f.nx,f.z+w*f.nz]);
      obstacles.add(corners,Math.max(height(a.x,a.z,a),height(b.x,b.z,b))+1.16);
    }
  }
  deck(main,()=>top,2.5);
  const [sx,sz]=north.mupu.points[0],west=[];
  // Looking north, the western access curls around the planted centre.
  for(let i=0;i<=33;i++){
    const a=Math.PI-i*Math.PI*1.85/33;
    west.push([sx+10+10*Math.cos(a),sz+10*Math.sin(a)]);
  }
  const approaches=[west,[[6149.1,-5629.4],[6156,-5625],[6162,-5614],[6171,-5608]],
    [[6149.1,-5629.4],[6156,-5635],[6160,-5642],[6158,-5652]]];
  for(const [i,line] of approaches.entries()){
    const frames=sections(line,2.4),low=ground(...line.at(-1))+.54;
    const grade=(_x,_z,f)=>top+(low-top)*f.distance/frames.at(-1).distance;
    deck(frames,grade,1.65);
    if(i===2){
      const steps=sections(line,.52);
      for(let j=1;j<steps.length;j++){
        const a=steps[j-1],b=steps[j];
        ribbon(details,[a,b],-1.52,1.52,()=>grade(0,0,a)+.035,'#d6d3c5');
        details.face([pointAt(b,-1.52,()=>grade(0,0,b)),pointAt(b,-1.52,()=>grade(0,0,a)+.035),
          pointAt(b,1.52,()=>grade(0,0,a)+.035),pointAt(b,1.52,()=>grade(0,0,b))],'#b8b9af');
      }
    }
  }
  for(const [x,z] of [north.mupu.points[0],north.mupu.points[2],north.mupu.points.at(-1)])
    cylinder(details,x,z,ground(x,z),top-.40,.78,.62,'#c5c8bf',8);
}

export function northernShore(roads,paths,details,ground,obstacles,shoreGround) {
  for(const road of north.frontages){
    const frames=sections(road.points,9);
    wuyuanPaving(roads,frames,-3.8,-3.5,shoreGround,'#a39f90',.48);
    wuyuanPaving(roads,frames,3.5,3.8,shoreGround,'#a39f90',.48);
    wuyuanPaving(roads,frames,-3.5,3.5,shoreGround,'#787c76',.48);
    for(let i=1;i<frames.length;i++)if(Math.floor(frames[i].distance/14)!==Math.floor(frames[i-1].distance/14)){
      const a=frames[i-1],b={...a,x:a.x+3.5*a.nz,z:a.z-3.5*a.nx};
      wuyuanPaving(roads,[a,b],-.085,.085,shoreGround,'#cac7b6',.53);
    }
  }
  hengsan(roads,details,ground);
  mupu(details,ground,obstacles);
  const walk=sections(north.parkWalk,6);
  ribbon(paths,walk,-2,2,ground,'#7295a4',.53);
  ribbon(paths,sections(north.parkBranch,6),-1.65,1.65,ground,'#ad7966',.51);
  // Three short fence runs keep gaps to the beach. Locations are estimates.
  for(const [a,b] of [[350,432],[810,910],[1770,1840]]){
    const posts=walk.filter(f=>f.distance>=a && f.distance<=b);
    for(const height of [.48,.94])pathTube(details,posts.map(f=>pointAt(f,2.8,ground,height)),.055,'#aa9471',4);
    for(const f of posts){
      const [x,y,z]=pointAt(f,2.8,ground);
      box(details,x,z,.14,.14,y,y+1.04,'#a99575','#b6a483');
    }
  }
  // The tidal mask is gridded at about 12 m. Use the surveyed quay crest
  // for the narrow road-side embankment and the return along the inner bay.
  for(const [line,landward] of [[north.quay.points,18],...north.harbourEdges.map(line=>[line,3.5])]){
    const wall=sections(line,5);
    wuyuanPaving(paths,wall,-landward,0,shoreGround,'#adaca0',.21,
      {batch:details,bottom:-.8,color:'#989d93'});
  }
  const eastBank=north.quay.points.filter(([x,z])=>x<5310 && z<=-6430);
  eastBank.push([eastBank[0][0],eastBank.at(-1)[1]]);
  prism(details,eastBank,-.75,.32,'#96978b','#7f8777');
}
