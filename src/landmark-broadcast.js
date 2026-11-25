import { cylinder, groundY, litSurface, prism, TAU } from './scenery-mesh.js';
import { ellipse, localFrame, rect, up } from './landmark-forms.js';
import { pathTube } from './landmark-haicang.js';
import { buildBroadcastTower, towerFrame as tower } from './broadcast-tower.js';
import { forecourt, plan } from './hubin-layout.js';
import { measuredPath, ribbon as pave } from './old-town-layout.js';

const ribbon=litSurface.studioRibbon, silver='#bcc3c1';

function satelliteDish(batch,centre,base,r,azimuth,tilt){
  const [x,z]=centre, ca=Math.cos(azimuth), sa=Math.sin(azimuth), st=Math.sin(tilt), ct=Math.cos(tilt);
  const h=base+5.6, sector=32, steel='#475451', brace='#606a62';
  const point=(radius,theta,offset=0)=>{
    const a=radius*Math.cos(theta), b=radius*Math.sin(theta);
    const depth=.235*radius*radius/r+offset;
    return [x+ca*a+sa*(ct*b+st*depth),h-st*b+ct*depth,z-sa*a+ca*(ct*b+st*depth)];
  };
  cylinder(batch,x,z,base-.18,base+.36,r*.64,r*.64,'#a9aca2',12);
  const hub=point(0,0,-1.0), focus=point(0,0,r*.81);
  for(let i=0;i<4;i++){
    const angle=TAU*(i+.5)/4;
    const foot=[x+.44*r*Math.cos(angle),base+.36,z+.44*r*Math.sin(angle)];
    pathTube(batch,[foot,hub],.18,steel,6);
    pathTube(batch,[foot,point(r*.71,angle,-.85)],.14,steel,5);
  }
  for(let i=0;i<sector;i++){
    const a=i*TAU/sector, b=(i+1)*TAU/sector;
    for(let k=0;k<4;k++){
      const lo=k*r/4, hi=(k+1)*r/4;
      const face=k?[point(lo,a),point(hi,a),point(hi,b),point(lo,b)]:[point(0,a),point(hi,a),point(hi,b)];
      batch.top(face,i%8===0?'#c7ccc2':'#e3e3d6',litSurface.crownMetal);
      const back=k?[point(lo,a,-.13),point(hi,a,-.13),point(hi,b,-.13),point(lo,b,-.13)]
                  :[point(0,a,-.13),point(hi,a,-.13),point(hi,b,-.13)];
      batch.face(back,'#858c80');
    }
    batch.face([point(r,a),point(r,b),point(r,b,-.21),point(r,a,-.21)],'#b7b9af');
    if(i%2===0){
      const c=a+2*TAU/sector, strut=point(r*.61,a,-1.35);
      pathTube(batch,[hub,strut,point(r,a,-.17)],.10,brace,5);
      pathTube(batch,[strut,point(r*.61,c,-1.35),point(r,a,-.27)],.083,steel,5);
    }
    if(i%8===0)pathTube(batch,[point(r*.91,a,.03),focus],.059,'#a0a392',5);
  }
  const centreRod=point(0,0,r*.95);
  pathTube(batch,[focus,centreRod],.23,'#b5b7a8',8);
}

function entrance(batch,base,lights,signs){
  prism(batch,plan.canopy,base-.08,base+.17,'#b5afa0','#c9c3b4');
  const edge=plan.eave;
  // One triangulated soffit and folded fascia wrap the three intersecting arcs.
  prism(batch,edge,base+6.68,base+6.79,'#756f62','#c5bca4',litSurface.portico);
  prism(batch,edge,base+6.79,base+7.04,'#a8afaa','#c4c8c0');
  prism(batch,edge,base+7.04,base+7.13,'#64706e',null);
  prism(batch,edge,base+7.13,base+7.67,'#c7cdc8','#aaafa8',litSurface.crownMetal);
  for(const [u,v] of [[21.88,4.58],[28.66,6.23],[33.86,-2.58]]){
    const [x,z]=tower(u,v);
    cylinder(batch,x,z,base+.1,base+.41,.47,.47,'#888b82',14);
    cylinder(batch,x,z,base+.40,base+6.68,.356,.38,'#c9c8bc',16);
    cylinder(batch,x,z,base+6.40,base+6.63,.41,.46,'#a8afa8',16);
    const p=tower(u-.64,v+.22);
    cylinder(batch,...p,base+6.65,base+6.71,.17,.17,'#eadfc7',8,0,'#e7d6ae',litSurface.portico);
    lights.add(p[0],base+6.57,p[1],'#ffddab',.65);
  }
  for(const [u,v] of [[23.1,.85],[26.3,.85],[29.5,.85]]){
    const lobby=rect(tower,u,v,3.1,.2);
    prism(batch,lobby,base+.19,base+6.58,'#4b656d','#729094',litSurface.ferryGlass,.6);
    for(const c of [-1.41,0,1.41])prism(batch,rect(tower,u+c,v+.18,.084,.12),base+.24,base+3.49,'#9aaba9',silver);
  }
  const entry=localFrame([-2681.6,-661.8],-.292);
  const slab=(u,v,w,d,lo,hi,wall,roof=wall,style=0)=>prism(batch,rect(entry,u,v,w,d),base+lo,base+hi,wall,roof,style);
  for(let i=0;i<3;i++)slab(0,1.65-i*.53,13.7-i*.45,4.9-i*.82,i*.12,.15+i*.12,'#bdb9ac');
  slab(-3.4,16.4,13.9,.90,.05,2.04,'#99796b','#b29887',litSurface.portico);
  signs.push({label:'厦门广播电视中心',a:entry(-10.11,16.87),b:entry(3.32,16.87),y:base+.38,height:1.36});
  for(const u of [-11.1,4.15])slab(u,16.4,.71,1.15,0,2.43,'#997a6e');
  const [fx,fz]=entry(3.75,2.25);
  cylinder(batch,fx,fz,base+.1,base+16.7,.12,.065,'#bfc5c2',8);
  batch.face([[fx,base+16.48,fz],[fx-2.1,base+16.3,fz+.30],[fx-3.9,base+16.4,fz+.17],
    [fx-3.9,base+14.22,fz+.18],[fx,base+14.09,fz]],'#b64335');
}

function gardensAndParking(batch,base,lights,geo){
  const front=localFrame([-2682,-664],-.293);
  const slab=(u,v,w,d,y,cap,wall=cap)=>prism(batch,rect(front,u,v,w,d),base-.16,base+y,wall,cap);
  // The western parking court turns in from Jinqiao Road and joins the drop-off.
  const drive=measuredPath([[-2746.4,-655.1],[-2737,-656.6],[-2697,-668.7],[-2689.4,-667.4],[-2682.5,-660.1],[-2674,-653.2]]);
  pave(batch,drive.sections(2.2),-2.64,2.64,()=>base+.01,'#818782');
  const lot=(u,v,n)=>{
    const left=u-n*2.66/2;
    slab(u,v,n*2.66+1.1,5.25,.01,'#858986');
    for(let i=0;i<=n;i++){
      const x=left+i*2.66;
      batch.top(rect(front,x,v,.115,4.72).map(pt=>up(pt,base+.047)),'#d0cbb5');
      if(i===n || i%5===1)continue;
      const body=rect(front,x+1.31,v,1.73,3.95);
      const shade=['#a5a9a3','#687679','#d0cbbd','#8f7364','#737f85'][i%5];
      prism(batch,body,base+.27,base+1.01,shade,shade);
      prism(batch,rect(front,x+1.31,v+.02,1.51,1.87),base+1.01,base+1.50,'#626f71',shade);
    }
  };
  lot(-40,.2,7); lot(57,-1.4,4);
  for(const [u,v,n] of [[-43,14.9,24],[-20.5,16.35,10],[31.8,13,21],[58,13.6,14]]){
    slab(u,v,n,2.55,.20,'#8a9c70','#b4b5a2');
    slab(u,v+.14,n-.5,1.67,.67,'#6f8c62');
  }
  // A continuous apron joins the site to the public pavement, sloping gently to
  // the mapped kerb. Keep breaks through the boundary at the two driveways.
  const approach=(u,w,cap)=>{
    const a=front(u-w/2,10),b=front(u+w/2,10),c=front(u+w/2,21.0),d=front(u-w/2,21.0);
    const curb=p=>Math.max(1.1,groundY(geo,...p))+.544;
    batch.top([up(a,base-.025),up(b,base-.025),up(c,curb(c)),up(d,curb(d))],cap,17);
  };
  approach(3.0,137,'#aea99a');
  for(const [left,right] of [[-61,-20.6],[-11.6,-10.5],[19.5,72]]){
    const mid=(left+right)/2,w=right-left, v=17.55;
    slab(mid,v,w,.63,.54,'#b7a795','#a08a7c');
    for(let u=left+.38;u<right;u+=2.7){
      slab(u,v,.13,.27,1.48,'#737a73');
      if((u-left)<.45 || Math.floor((u-left)/2.7)%4===3)slab(u,v,.49,.67,1.64,'#b4a08d');
    }
    for(const h of [.86,1.39])pathTube(batch,[up(front(left,v),base+h),up(front(right,v),base+h)],.064,'#536568',5);
  }
  const loop=measuredPath([front(-15.9,21.2),front(-16.1,14.5),front(-15.3,10),front(-12,6.2),
    front(-6.6,4.8),front(5.2,4.8),front(10.95,6.8),front(13.6,10.2),front(14.6,15),front(14.8,21.2)]);
  const drivewayY=(x,z,station)=>{
    const toGate=Math.min(station,loop.length-station);
    const blend=Math.min(1,toGate/6.7);
    return (Math.max(1.1,groundY(geo,x,z))+.57)*(1-blend)+(base+.035)*blend;
  };
  pave(batch,loop.sections(1.7),-2.28,2.28,drivewayY,'#898a80');
  for(const sign of [-1,1])pave(batch,loop.sections(1.7),sign*2.28,sign*2.47,
    (x,z,s)=>drivewayY(x,z,s)+.035,'#c3baa5');
  for(const u of [-9,-6,-3,0,3])slab(u,14.48,2.8,1.0,.55,'#7c9164');
  for(const [u,v,w,d] of [[-22,5.3,4.7,2.0],[24.2,1.9,5.4,2.15],[39.8,9.55,9,2.1]]){
    prism(batch,ellipse(front,u,v,w,d,22),base-.18,base+.28,'#b4b29f','#87916b');
    const shades=['#617951','#71865b','#88976a'];
    for(let j=0;j<7;j++){
      const x=u+((j%4)-1.5)*w*.37,y=v+(j<4?-.37:.45)*d;
      cylinder(batch,...front(x,y),base+.24,base+.70+.19*Math.cos(j*2.54),d*.41,d*.34,shades[j%3],8);
    }
  }
  for(const u of [-49,-29,23,45]){
    const [x,z]=front(u,5.5);
    cylinder(batch,x,z,base+.04,base+.80,.14,.12,'#6e756a',7);
    cylinder(batch,x,z,base+.81,base+.99,.13,.14,'#e2d7ac',8,0,'#c6c6b4',litSurface.portico);
    lights.add(x,base+.92,z,'#ffce8e',.60);
  }
}

function productionTruck(batch,base){
  const xy=localFrame([-2643,-682.3],-.293);
  const item=(u,v,w,d,b,t,c,cap=c,style=0)=>prism(batch,rect(xy,u,v,w,d),base+b,base+t,c,cap,style);
  item(-.79,0,8.13,2.48,.70,3.46,'#d0d5cd','#c8cbbd');
  item(-.79,0,8.15,2.50,1.28,1.62,'#487281');
  item(-.79,0,8.15,2.51,1.60,1.70,'#9b9f8a');
  item(3.99,0,2.09,2.38,.78,1.97,'#c3cdc4');
  const cab=[xy(3.03,-1.15),xy(4.63,-1.15),xy(4.94,-.89),xy(4.94,.88),xy(4.62,1.15),xy(3.03,1.15)];
  prism(batch,cab,base+1.97,base+2.89,'#405e65','#d0d2c6');
  item(3.87,0,1.77,2.31,2.89,3.06,'#bac4bc');
  for(const v of [-1.266,1.266]){
    for(const u of [-2.94,-.76,1.30])item(u,v,1.34,.022,2.22,2.85,'#546b6f');
    for(const u of [-3.41,-1.95,3.74]){
      const hub=(angle,r,off)=>up(xy(u+r*Math.cos(angle),v+Math.sign(v)*off),base+.59+r*Math.sin(angle));
      batch.face(Array.from({length:14},(_,j)=>hub(TAU*j/14,.54,.013)),'#393e3b');
      batch.face(Array.from({length:12},(_,j)=>hub(TAU*j/12,.235,.036)),'#96a198');
    }
  }
  item(-2.60,0,2.3,1.33,3.47,3.80,'#a5afa9','#bfc6bc');
  for(let i=0;i<8;i++)item(-3.49+i*.25,0,.08,1.14,3.80,3.84,'#919b90');
  const bowl=(radius,angle)=>up(xy(.62+radius*1.18*Math.cos(angle),radius*.90*Math.sin(angle)),
    base+3.81+.21*radius*radius+.26*radius*Math.sin(angle));
  for(let i=0;i<18;i++)
    batch.top([bowl(0,0),bowl(1,TAU*i/18),bowl(1,TAU*(i+1)/18)],'#c9cbbd');
  pathTube(batch,[bowl(.86,-1.27),up(xy(.71,0),base+4.49)],.048,'#7c8783',5);
}

export function buildBroadcast(batch,geo,lights,obstacles,signs){
  const base=groundY(geo,-2686,-683)+.27;
  prism(batch,forecourt,base-.8,base-.09,'#a8a798','#b8b7a7',0,0,0,22);
  gardensAndParking(batch,base,lights,geo);
  productionTruck(batch,base);
  prism(batch,plan.studio,base-.45,base+14.25,'#d1d2c9','#a7ab9d',ribbon,.23);
  prism(batch,plan.studio,base+14.25,base+14.69,'#d3d7ce','#b1b1a2',0,0,0,litSurface.studioRoof);
  for(let i=0;i<plan.studio.length;i++){
    const a=plan.studio[i],b=plan.studio[(i+1)%plan.studio.length];
    pathTube(batch,[up(a,base+14.83),up(b,base+14.83)],.22,'#d8d6c8',5);
  }
  obstacles.add(plan.building,base+14.69);
  const studios=[
    [[[-2664,-756],[-2634,-766],[-2623,-734],[-2653,-724]],21.4],
    [[[-2690,-765],[-2678,-761],[-2664,-754],[-2671,-741],[-2696,-753]],20.5],
    [[[-2701,-744],[-2673,-731],[-2679,-717],[-2706,-731]],18.7],
    [[[-2747,-724],[-2735,-732],[-2720,-723],[-2725,-713],[-2743,-710]],18.1],
  ];
  for(const [ring,top] of studios){
    prism(batch,ring,base+14.54,base+top,'#cbcec5','#727c79');
    prism(batch,ring,base+top,base+top+.27,'#c9cbbf','#767b74',0,0,0,litSurface.studioRoof);
    for(let i=0;i<ring.length;i++)
      pathTube(batch,[up(ring[i],base+top+.39),up(ring[(i+1)%ring.length],base+top+.39)],.20,'#cccabe',5);
    obstacles.add(ring,base+top+.27);
  }
  const wing=localFrame([-2635.2,-703.7],-.290);
  for(let i=0;i<6;i++){
    const u=(i-2.5)*7.95;
    prism(batch,rect(wing,u,-.8,6.8,2.65),base+14.70,base+15.32,'#9da9a5','#91a7a7');
    prism(batch,rect(wing,u,-.8,.17,2.69),base+15.30,base+15.42,silver,silver);
  }
  const west=localFrame([-2737,-702],1.28);
  for(let i=0;i<5;i++){
    const [x,z]=west(i*3.4-6,0);
    cylinder(batch,x,z,base+14.7,base+15.48,.88,.81,'#969b94',10,0,'#bbbbb0');
    cylinder(batch,x,z,base+15.48,base+15.57,.60,.60,'#76817e',10,0,'#818983');
  }
  for(const [x,z,count,yaw,h] of [[-2644,-744,5,-.30,21.68],[-2681,-749,3,.37,20.78],[-2735,-719,3,-.35,18.38]]){
    const plant=localFrame([x,z],yaw), y=base+h;
    for(let j=0;j<count;j++){
      const u=(j-(count-1)/2)*2.91;
      prism(batch,rect(plant,u,0,2.5,2.55),y,y+1.03,'#9ca69f','#aeb4a9');
      cylinder(batch,...plant(u,0),y+1.03,y+1.19,.81,.81,'#bfc6ba',14,0,'#687872');
      for(const k of [-.41,0,.41])
        pathTube(batch,[up(plant(u-.61,k),y+1.21),up(plant(u+.61,k),y+1.21)],.049,'#919d94',4);
    }
    prism(batch,rect(plant,0,-2.76,3.0*count,1.20),y+.12,y+.65,'#9baba5','#a5b3aa');
  }
  buildBroadcastTower(batch,base,lights,obstacles);
  entrance(batch,base,lights,signs);
  const pool=localFrame([-2725,-646.8],-.29);
  prism(batch,rect(pool,0,0,26,12.5),base-.14,base+.12,'#a5a890','#8f9e79');
  satelliteDish(batch,[-2732,-644.8],base+.13,6.0,.63,.32);
  satelliteDish(batch,[-2717.9,-649.0],base+.13,4.9,.41,.43);
  for(const [x,z,r] of [[-2732,-644.8,6],[-2717.9,-649,4.9]]) obstacles.add(rect(localFrame([x,z]),0,0,2*r,2*r),base+9.6);
}
