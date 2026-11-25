import { MeshBatch, groundY, litSurface, prism } from './scenery-mesh.js';
import { ellipse, localFrame, rect, up } from './landmark-forms.js';
import { siliParcels, siliPoint, siliRing, siliStreets } from './sili-layout.js';

export function drawSiliHome(batch, home, bottom, base, index) {
  const {xy,w,d,height,rings:[ring]} = home;
  const top = base + height, roof = top - 3.2;
  prism(batch,ring,bottom,base+3.5,'#a89b88','#ccc6b6',litSurface.graniteFacing);
  prism(batch,ring,base+3.5,roof,'#d2cab9','#acaea6',20,.24,0,22);
  // Paired recessed window bays, pale dividing blades and two roof heads
  // repeat across the four parcels in the handover photographs.
  for (const sign of [-1,1]) {
    for (const u of [-w*.34,0,w*.34]) {
      const v=sign*(d/2+.16);
      const bay=rect(xy,u,v,w*.23,1.05);
      prism(batch,bay,base+4,roof-.8,'#879598','#c9c4b8',20,.18);
    }
    const head=rect(xy,sign*w*.24,-d*.08,w*.22,d*.58);
    prism(batch,head,roof,top,'#cbc7ba','#d5d2c6',0,0,0,22);
    index.add(head,top);
  }
  index.add(ring,roof);
}

export function buildSiliGround(parent,geo,material,index,signs,plantings) {
  const batch=new MeshBatch();
  function paving(ring,color,lift=.36) {
    // Short triangles follow the local terrain so long parcels do not slice
    // through the ground mesh between their corners.
    function triangle(a,b,c){
      const cycle=[a,b,c,a,b];
      const lengths=[0,1,2].map(i=>Math.hypot(cycle[i][0]-cycle[i+1][0],cycle[i][1]-cycle[i+1][1]));
      const side=lengths.indexOf(Math.max(...lengths));
      if(lengths[side]<15) {
        batch.top([a,b,c].map(p=>up(p,groundY(geo,...p)+lift)),color,22);
        return;
      }
      const [p,q,r]=cycle.slice(side,side+3);
      const mid=[(p[0]+q[0])/2,(p[1]+q[1])/2];
      triangle(p,mid,r);triangle(mid,q,r);
    }
    for(let i=1;i<ring.length-1;i++)triangle(ring[0],ring[i],ring[i+1]);
  }
  const volume=(ring,height,wall,roof,style=1) => {
    const levels=ring.map(p=>groundY(geo,...p)),top=Math.max(...levels)+height;
    prism(batch,ring,Math.min(...levels)-.45,top,wall,roof,style,.28,0,22);
    index.add(ring,top);
    return top;
  };
  for(const ring of Object.values(siliParcels)) paving(ring,'#bcb9a8');
  for(const {length,width,xy} of siliStreets){
    paving(rect(xy,length/2,0,length,width+2.8),'#b7b6a9',.41);
    paving(rect(xy,length/2,0,length,width),'#80837e',.54);
    for(let u=4;u<length-2;u+=11)
      paving(rect(xy,u,0,3.4,.15),'#c5c2ae',.62);
  }
  // Planted islands and meandering paved walks occupy the open space between
  // the two rows. Keep the connecting street between B06 and B07 clear.
  for(const [px,py,len,width] of [[203,273,114,14],[469,202,81,14],[853,564,22,8]]) {
    const xy=localFrame(siliPoint([px,py]),-.278);
    for(let i=0;i<3;i++) {
      const u=(i-1)*len/3, v=i===1?2:-1;
      paving(ellipse(xy,u,v,len*.146,width/2,18),'#819775',.84);
      for(const offset of [-.08,.065]) {
        const p=xy(u+len*offset,v);
        plantings.push([p[0],groundY(geo,...p)+.5,p[1],5+i*.4,i,.63]);
      }
    }
  }
  const school='#d3cdbd', cement='#bcbcb0';
  // Three connected wings and a west circulation spine border two open courts.
  const shell=siliRing([
    [636,282],[473,330],[485.5,356.9],[521,488],[547,481],[546.7,480],
    [594.9,466.3],[607,509],[682,489],[666,435],[600.6,453.6],[597.8,441.3],
    [604,445],[616,398],[602,399],[587,435],[593.7,438.9],[539.5,453.9],
    [526.9,408.2],[602,387],[600.6,381.4],[604,383],[623.4,318.1],[645,312]
  ]);
  const voids=[siliRing([
    [618.6,319.4],[605,328],[589.2,369.1],[521.3,387.9],[510.8,349.8]
  ])];
  const campusLevels=shell.map(p=>groundY(geo,...p));
  const schoolTop=Math.max(...campusLevels)+23;
  prism(batch,shell,Math.min(...campusLevels)-.45,schoolTop,school,cement,20,.32,0,22,voids);
  index.add(shell,schoolTop,voids);
  const roofCourt=(px,py,w,d,level)=>{
    const xy=localFrame(siliPoint([px,py]),-.28);
    const court=rect(xy,0,0,w,d);
    batch.top(court.map(p=>up(p,level+.18)),'#5f7b9d');
    const paint=(u,v,ww,dd)=>batch.top(rect(xy,u,v,ww,dd).map(p=>up(p,level+.22)),'#d3cfb3');
    for(const v of [-d*.43,d*.43])paint(0,v,w*.91,.15);
    for(const u of [-w*.45,0,w*.45])paint(u,0,.15,d*.87);
  };
  const blueRoof=rect(localFrame(siliPoint([558,321]),-.28),0,0,64,10);
  batch.top(blueRoof.map(p=>up(p,schoolTop+.18)),'#5c7494');
  roofCourt(636,472,28,17,schoolTop);
  const sport=localFrame(siliPoint([687,392]),-.278);
  const stadium=(width,length)=>{
    const r=width/2,s=length/2-r,ring=[];
    for(const end of [-1,1])for(let i=0;i<=16;i++){
      const a=(end===-1?Math.PI:0)+i*Math.PI/16;
      ring.push(sport(r*Math.cos(a),end*s+r*Math.sin(a)));
    }
    return ring;
  };
  paving(stadium(33,78),'#657b70',.82);
  paving(stadium(30,75),'#8ca39a',.91);
  paving(stadium(29.5,74.5),'#5e786a',.97);
  for (const v of [-15,0,15])paving(rect(sport,0,v,21,.22),'#c4c5aa',1.05);
  volume(siliRing([[718,266],[747,258],[779,366],[751,374]]),13,school,cement,20);
  volume(siliRing([[421,367],[444,361],[487,509],[464,515]]),12,'#bfbcb1','#a6aca3',20);

  // The school-side market is semi-underground. Build only its visible mouth.
  // Steps descend from the paved landing to terrain level, under the gable.
  const xy=localFrame(siliPoint([494,512]),-.278), y=groundY(geo,...xy(0,0))+.35;
  const slab=(u,v,w,d,h0,h1,wall,roof) =>
    prism(batch,rect(xy,u,v,w,d),y+h0,y+h1,wall,roof);
  for (let i=0;i<12;i++) slab(0,-1+i*.55,5.5,.56,-.4,.18+i*.16,'#a9a59b','#c9c7b9');
  for(const u of [-3.08,3.08]){
    slab(u,-2,1.6,2,-.55,2.7,'#a57664','#ba8876');
    slab(u*.96,2.1,.28,7.6,-.3,2.15,'#aaa69a','#bdb7a5');
  }
  slab(0,-2,7.75,1.9,2.7,3.65,'#a36c5b','#d3cbbc');
  const gable=[[-3.93,3.6],[-3.93,4.32],[-2.1,4.46],[0,6.05],[2.1,4.46],[3.93,4.32],[3.93,3.6]];
  for(let i=0;i<gable.length-1;i++){
    const [a,ha]=gable[i],[b,hb]=gable[i+1];
    if(b<=a)continue;
    batch.face([up(xy(a,-.98),y+3.6),up(xy(b,-.98),y+3.6),up(xy(b,-.98),y+hb),up(xy(a,-.98),y+ha)],'#e8ded0');
  }
  signs.push({label:'四里菜市场',ink:'#f3d594',a:xy(-2.3,-1.025),b:xy(2.3,-1.025),y:y+2.78,height:.76});
  const mesh=batch.finish(parent,material,'湖滨四里院落、滨东小学四里校区与四里市集入口');
  mesh.castShadow=mesh.receiveShadow=true;
}
