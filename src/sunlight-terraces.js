import { cylinder, litSurface, mix, prism, signedArea, TAU } from './scenery-mesh.js';
import { localFrame, rect, up } from './landmark-forms.js';
import { summitLevel, summitPoint, sunlight } from './sunlight-layout.js';

const masonry=litSurface.summitMasonry, tread=litSurface.sunlightTread, metal=litSurface.sunlightSteel;
const steel='#8b9290', render='#a19883', paving='#b4a995';
const lerp2=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

function tube(batch,a,b,r,color=steel) {
  const delta=b.map((v,i)=>v-a[i]), len=Math.hypot(...delta);
  if(len<.001)return;
  const [x,y,z]=delta.map(v=>v/len), flat=Math.hypot(x,z);
  const u=flat>1e-5?[-z/flat,0,x/flat]:[1,0,0];
  const v=[y*u[2],z*u[0]-x*u[2],-y*u[0]];
  const normals=Array.from({length:8},(_,i)=>u.map((n,k)=>n*Math.cos(i*TAU/8)+v[k]*Math.sin(i*TAU/8)));
  const ring=p=>normals.map(n=>p.map((value,k)=>value+r*n[k]));
  const l=ring(a),h=ring(b);
  for(let i=0;i<8;i++) {
    const j=(i+1)%8;
    batch.face([l[i],l[j],h[j],h[i]],color,metal,0,undefined,[normals[i],normals[j],normals[j],normals[i]]);
  }
}

// Rail centres and post feet use the same continuous grade through each turn.
function railing(batch,path,{height=1.04,base=.08,pickets=true,spacing=.27,dark=false}={}) {
  const c=dark?'#626c68':steel;
  for(let i=1;i<path.length;i++) {
    const a=path[i-1], b=path[i], length=Math.hypot(b[0]-a[0],b[2]-a[2]);
    if(length<.035)continue;
    for(const h of [pickets?base+.11:.67,height])
      tube(batch,[a[0],a[1]+h,a[2]],[b[0],b[1]+h,b[2]],h===height?.051:.026,c);
    const bays=Math.max(1,Math.ceil(length/(pickets?spacing:1.10)));
    for(let j=0;j<bays+(i===path.length-1?1:0);j++) {
      const t=j/bays, [x,y,z]=a.map((n,k)=>mix(n,b[k],t));
      const r=(j%4===0 || j===bays)?.038:.022;
      cylinder(batch,x,z,y+base-.025,y+height,r,r,c,6,0,c,metal);
    }
  }
}

// Miter both sides of a flight at its measured bends. Treads, risers, side
// footings and handrails meet the next flight at precisely the same section.
export function ridgeStairs(batch,obstacles,path,levels,width,support,{middle=false,rails=true,branch}={}) {
  const normals=path.slice(1).map((b,i)=>{
    const a=path[i], len=distance(a,b);
    return [-(b[1]-a[1])/len,(b[0]-a[0])/len];
  });
  const offsets=path.map((_,i)=>{
    const a=normals[Math.max(0,i-1)], b=normals[Math.min(i,normals.length-1)];
    const scale=Math.max(.60,1+a[0]*b[0]+a[1]*b[1]);
    return [(a[0]+b[0])/scale,(a[1]+b[1])/scale];
  });
  const side=(i,s)=>path[i].map((n,k)=>n+s*offsets[i][k]*width/2);
  for(let i=1;i<path.length;i++) {
    const y0=levels[i-1],y1=levels[i], run=distance(path[i-1],path[i]), rise=y1-y0;
    const steps=Math.max(1,Math.min(Math.round(Math.abs(rise)/.18),Math.ceil(run/.205)));
    const cross=t=>[-1,1].map(s=>lerp2(side(i-1,s),side(i,s),t));
    for(let j=0;j<steps;j++) {
      const a=cross(j/steps),b=cross((j+1)/steps), y=mix(y0,y1,(j+.5)/steps);
      const top=[a[0],b[0],b[1],a[1]];
      const uv=[[0,0],[0,1],[1,1],[1,0]];
      batch.top(top.map(p=>up(p,y)),paving,tread,i*13+j,uv);
      for(const [end,edge] of [[0,a],[1,b]]) {
        const adjacent=mix(y0,y1,Math.max(0,Math.min(1,(j+end+(end?.5:-.5))/steps)));
        if(y-adjacent>.003)
          batch.face([up(edge[0],adjacent-.018),up(edge[0],y),up(edge[1],y),up(edge[1],adjacent-.018)],
            '#918571',masonry);
      }
      for(const s of [0,1]) {
        const lo=p=>Math.min(y-.24,support(...p)-.12);
        batch.face([up(a[s],lo(a[s])),up(a[s],y),up(b[s],y),up(b[s],lo(b[s]))],render,masonry);
      }
    }
    const bays=Math.ceil(run/2.3);
    for(let j=0;j<bays;j++) {
      const a=cross(j/bays),b=cross((j+1)/bays);
      obstacles.add([a[0],b[0],b[1],a[1]],Math.max(mix(y0,y1,j/bays),mix(y0,y1,(j+1)/bays))+(rails?1.04:.1));
    }
  }
  if(rails)for(const s of middle?[-1,0,1]:[-1,1]) {
    const points=path.map((_,i)=>up(side(i,.94*s),levels[i]));
    const style={base:.01,dark:s===0,spacing:middle?.24:.41};
    if(s!==branch?.side) { railing(batch,points,style); continue; }
    const j=branch.index,p=points[j];
    const lip=(q,gap)=>p.map((c,k)=>mix(c,q[k],Math.min(.85,gap/Math.hypot(q[0]-p[0],q[2]-p[2]))));
    railing(batch,[...points.slice(0,j),lip(points[j-1],1.05)],style);
    railing(batch,[lip(points[j+1],1.30),...points.slice(j+1)],style);
  }
}

function seat(batch,obstacles,ring,y,support) {
  const rim=signedArea(ring)<0 ? ring.toReversed() : ring;
  for(let i=0;i<rim.length;i++) {
    const a=rim[i],b=rim[(i+1)%rim.length],count=Math.max(1,Math.ceil(distance(a,b)/.62));
    for(let j=0;j<count;j++) {
      const p=lerp2(a,b,j/count),q=lerp2(a,b,(j+1)/count);
      const low=v=>Math.min(y-.28,support(...v)-.22);
      batch.face([up(p,low(p)),up(p,y),up(q,y),up(q,low(q))],render,masonry);
    }
  }
  prism(batch,rim,y-.12,y,render,paving,masonry,0,0,tread);
  obstacles.add(rim,y+.98);
}

// A low rendered parapet has short square merlons and a continuous metal cap.
function parapet(batch,path,y) {
  let travelled=0;
  const pitch=.96;
  for(let i=1;i<path.length;i++) {
    const a=path[i-1],b=path[i],length=distance(a,b);
    if(length<.01)continue;
    const frame=localFrame(a,Math.atan2(b[1]-a[1],b[0]-a[0]));
    prism(batch,rect(frame,length/2,0,length+.028,.26),y-.06,y+.52,render,'#b4a990',masonry);
    const first=Math.floor(travelled/pitch),last=Math.floor((travelled+length)/pitch);
    for(let k=first;k<=last;k++) {
      const l=Math.max(0,k*pitch-travelled), r=Math.min(length,(k+.62)*pitch-travelled);
      if(r-l<.055)continue;
      prism(batch,rect(frame,(l+r)/2,0,r-l,.265),y+.52,y+.84,render,'#bcb19b',masonry);
    }
    travelled+=length;
  }
  railing(batch,path.map(p=>up(p,y)),{base:.50,pickets:false,height:1.08});
}

export function ridgeBalcony(batch,obstacles,entrance,centre,y,radius,support,openRailing=false) {
  const angle=Math.atan2(centre[1]-entrance[1],centre[0]-entrance[0]),xy=localFrame(centre,angle);
  const length=distance(entrance,centre);
  const ring=[xy(-length,-1.02),xy(-length,1.02),xy(-length+.55,radius*.82)];
  for(let i=0;i<=12;i++) {
    const a=Math.PI/2-i*Math.PI/12;
    ring.push(xy(.82*radius*Math.cos(a),radius*Math.sin(a)));
  }
  ring.push(xy(-length+.55,-radius*.82));
  if(openRailing) {
    // The lower descent passes below the lip of this spur. Keep the upper
    // lookout on an overhanging rock shelf and leave headroom on that path.
    const origin=xy(-length*.42,0),tone='#b49d81',style=litSurface.sunlightStone;
    const expand=(p,k)=>lerp2(origin,p,k);
    const edge=ring.map((p,i)=>up(expand(p,1.18+.038*Math.sin(i*1.5)),y-.68-.13*Math.sin(.8*i)));
    const belly=ring.map((p,i)=>up(expand(p,1.04+.047*Math.cos(i*1.9)),y-1.52-.27*Math.cos(.83*i)));
    const root=ring.map((p,i)=>up(expand(p,.69),Math.max(y-3.18,support(...p)-.27)-.12*Math.sin(i)));
    const mid=up(origin,y-.52),under=up(origin,y-2.8);
    for(let i=0;i<ring.length;i++) {
      const j=(i+1)%ring.length;
      batch.top([mid,edge[i],edge[j]],tone,style,4.6);
      batch.face([edge[i],edge[j],belly[j],belly[i]],tone,style,4.6);
      batch.face([belly[i],belly[j],root[j],root[i]],tone,style,4.6);
      batch.face([under,root[j],root[i]],tone,style,4.6);
    }
    seat(batch,obstacles,ring,y,(x,z)=>Math.max(y-.68,support(x,z)));
  } else seat(batch,obstacles,ring,y,support);
  const outside=[...ring.slice(1),ring[0]];
  if(openRailing) railing(batch,outside.map(p=>up(p,y)),{base:.01,spacing:.33});
  else parapet(batch,outside,y);
}

export function ridgeBridge(batch,obstacles,path,y) {
  const a=path[0],b=path.at(-1),length=distance(a,b);
  const xy=localFrame(a,Math.atan2(b[1]-a[1],b[0]-a[0])), width=1.92;
  const deck=rect(xy,length/2,0,length+.22,width);
  prism(batch,deck,y-.34,y,'#8e8574','#b7ad9b',masonry,0,0,tread);
  for(const s of [-1,1]) {
    const v=s*(width/2-.07);
    railing(batch,[up(xy(.22,v),y),up(xy(length-.22,v),y)]);
  }
  obstacles.add(deck,y+1.04);
}

function silverFinial(batch,obstacles) {
  const [x,z]=summitPoint,y=summitLevel,cy=y+3.61,r=.36;
  cylinder(batch,x,z,y,y+.25,.25,.20,'#a49b86',14);
  cylinder(batch,x,z,y+.24,cy-.22,.075,.053,steel,12,0,steel,metal);
  const point=(i,j)=>{
    const a=TAU*i/24, b=Math.PI*(j/12-.5);
    const n=[Math.cos(b)*Math.cos(a),Math.sin(b),Math.cos(b)*Math.sin(a)];
    return {p:[x+r*n[0],cy+r*n[1],z+r*n[2]],n};
  };
  for(let j=0;j<12;j++)for(let i=0;i<24;i++) {
    const a=point(i,j),b=point(i,j+1),c=point(i+1,j+1),d=point(i+1,j);
    const f=j===0?[a,b,c]:j===11?[a,b,d]:[a,b,c,d];
    batch.face(f.map(v=>v.p),'#bfc5c0',metal,1,undefined,f.map(v=>v.n));
  }
  cylinder(batch,x,z,cy+.33,cy+.99,.037,.004,steel,8,0,steel,metal);
  obstacles.add(rect(localFrame(summitPoint),0,0,.59,.59),cy+.99);
}

function rockFlood(batch,lamps,p,support,angle) {
  const xy=localFrame(p,angle),y=support(...p);
  prism(batch,rect(xy,0,0,.56,.43),y-.11,y+.13,'#847e6d','#a39a85');
  for(const u of [-.195,.195])
    prism(batch,rect(xy,u,0,.045,.14),y+.09,y+.36,'#535b55','#687064',metal);
  const face=(v,h)=>[-.245,.245].map(u=>up(xy(u,v),y+h));
  const low=face(.14,.19),high=face(-.02,.48),back=face(-.21,.30),foot=face(-.08,.14);
  batch.face([low[0],low[1],high[1],high[0]],'#cbc8ad',litSurface.sunlightLamp);
  batch.face([high[0],high[1],back[1],back[0]],'#575c55',metal);
  for(const s of [0,1])batch.face([low[s],high[s],back[s],foot[s]],'#565950',metal);
  lamps.add(p[0],y+.33,p[1],'#ffe4b1',.38);
}

export const apronLevel=summitLevel-2.0;
const entryAngle=Math.atan2(sunlight.upperSteps[0][1]-summitPoint[1],sunlight.upperSteps[0][0]-summitPoint[0]);
const crownFrame=localFrame(summitPoint,entryAngle);
export const apronEntry=crownFrame(3.85,0);

export function crownLookout(batch,obstacles,lamps,support) {
  const xy=crownFrame, y=summitLevel;
  const next=sunlight.upperSteps[1];
  const approach=localFrame(apronEntry,Math.atan2(next[1]-apronEntry[1],next[0]-apronEntry[0]));
  const wings=[[6.18,2.8],[5.33,3.72],[2.8,4.32],[.1,4.45],[-2.56,3.75],
    [-4.08,2.32],[-4.50,.35],[-4.06,-2.21],[-2.46,-3.64],[.2,-4.41],
    [3.1,-4.19],[5.48,-3.55],[6.18,-2.62]].map(p=>xy(...p));
  const apron=[approach(0,-1.40),approach(0,1.40),approach(2.45,1.44),...wings,approach(2.45,-1.44)];
  seat(batch,obstacles,apron,apronLevel,support);
  parapet(batch,apron.slice(2),apronLevel);

  let rim=sunlight.lookout.map(p=>lerp2(summitPoint,p,1.065));
  for(let k=0;k<2;k++)
    rim=rim.flatMap((p,i)=>[lerp2(p,rim[(i+1)%rim.length],.25),lerp2(p,rim[(i+1)%rim.length],.75)]);
  seat(batch,obstacles,rim,y,()=>apronLevel-.10);
  const az=p=>Math.atan2(p[1]-summitPoint[1],p[0]-summitPoint[0]);
  const opening=entryAngle-2.34;
  const order=rim.map(p=>({p,angle:(az(p)-opening+TAU)%TAU}))
    .filter(v=>v.angle>.15 && v.angle<TAU-.15).sort((a,b)=>a.angle-b.angle);
  railing(batch,order.map(v=>up(v.p,y)),{base:.02});

  // The two lanes arrive beneath the drum. A short turn along its north
  // flank takes the last two metres of rise into the opening in the upper rail.
  const turn=Array.from({length:8},(_,i)=>{
    const a=-.38-1.96*i/7, radius=i===7?2.75:3.54;
    return xy(radius*Math.cos(a),radius*Math.sin(a));
  });
  const levels=turn.map((_,i)=>mix(apronLevel,y,i/(turn.length-1)));
  ridgeStairs(batch,obstacles,turn,levels,.94,()=>apronLevel-.08,{rails:false});
  railing(batch,turn.map((_,i)=>{
    const a=-.38-1.96*i/7,r=i===7?3.18:4.00;
    return up(xy(r*Math.cos(a),r*Math.sin(a)),levels[i]);
  }),{base:0});
  // In the photographic elevation a pale service hatch and two square plates
  // sit below the top rail, between the rendered wings of the lower landing.
  const front=localFrame(xy(3.22,0),entryAngle+Math.PI/2);
  prism(batch,rect(front,0,0,.88,.12),apronLevel+.02,apronLevel+1.39,'#756f60','#8b887d');
  prism(batch,rect(front,0,-.066,.78,.045),apronLevel+.06,apronLevel+1.33,'#abb5b1','#bfc5be',metal);
  for(const s of [-1,1]) {
    prism(batch,rect(front,s*.52,-.03,.31,.13),y-.55,y-.24,'#585547','#a79d84');
    prism(batch,rect(front,s*.52,-.105,.14,.032),y-.44,y-.39,'#b9b3a0','#b9b3a0');
  }
  silverFinial(batch,obstacles);
  for(const p of [xy(6.75,3.30),xy(6.8,-3.33),xy(1.1,5.10)]) rockFlood(batch,lamps,p,support,entryAngle);
}
