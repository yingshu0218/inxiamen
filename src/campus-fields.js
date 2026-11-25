import { localFrame, up } from './landmark-forms.js';

function capsule(straight,r) {
  const p=[];
  for(const side of [1,-1]) for(let i=0;i<=28;i++){
    const a=side*Math.PI/2-i*Math.PI/28+(side<0?Math.PI*2:0);
    p.push([side*straight+r*Math.cos(a),r*Math.sin(a)]);
  }
  return p;
}

export function paintOval(batch, site, laneCount, turfColor, trackColor, geo) {
  const xy=localFrame(site.p,site.a), {level,straight,radius,width,surfaceLift=.18}=site;
  const top=level+surfaceLift;
  const surface=(p,y=top)=>up(xy(...p),y);
  const turf=capsule(straight,radius);
  batch.top(turf.map(p=>surface(p)),turfColor);
  const lanes=[radius,radius+width].map(r=>capsule(straight,r));
  for(let i=0;i<lanes[0].length;i++){
    const j=(i+1)%lanes[0].length;
    batch.top([lanes[0][i],lanes[0][j],lanes[1][j],lanes[1][i]].map(p=>surface(p,top+.007)),trackColor);
    const a=surface(lanes[1][i],top+.007),b=surface(lanes[1][j],top+.007);
    const lip=p=>[p[0],Math.min(p[1]-.05,geo.heightAt(p[0],p[2])-.1),p[2]];
    batch.face([a,b,lip(b),lip(a)],'#8d7860');
  }
  const stroke=(a,b,w=.065,color='#dedccb')=>{
    const dx=b[0]-a[0], dz=b[1]-a[1], d=Math.hypot(dx,dz);
    const u=-dz*w/d,v=dx*w/d;
    batch.top([[a[0]+u,a[1]+v],[b[0]+u,b[1]+v],[b[0]-u,b[1]-v],[a[0]-u,a[1]-v]].map(p=>surface(p,top+.024)),color);
  };
  for(let i=0;i<=laneCount;i++){
    const ring=capsule(straight,radius+.13+(width-.27)*i/laneCount);
    for(let j=0;j<ring.length;j++)stroke(ring[j],ring[(j+1)%ring.length],.036,'#dfbdab');
  }
  const length=52.0, half=radius-3.6;
  for(const end of [-1,1]){
    stroke([-length,end*half],[length,end*half]);
    stroke([end*length,-half],[end*length,half]);
    for(const [d,w] of [[16.5,20.15],[5.5,9.16]]){
      const inside=end*(length-d);
      stroke([end*length,-w],[inside,-w]);stroke([inside,-w],[inside,w]);stroke([inside,w],[end*length,w]);
    }
  }
  stroke([0,-half],[0,half]);
  for(let i=0;i<44;i++){
    const a=i*Math.PI/22,b=(i+1)*Math.PI/22;
    stroke([9.15*Math.cos(a),9.15*Math.sin(a)],[9.15*Math.cos(b),9.15*Math.sin(b)]);
  }
  return (u,v,dy=0)=>surface([u,v],top+dy);
}
