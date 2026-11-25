import { zhongshan as zs, wuyuan, expo } from './layout.js';
import { cylinder, groundY, randomSource, litSurface, prism } from '../scenery-mesh.js';
import { localFrame, rect, sweptRoof, up, groundPaving } from '../landmark-forms.js';
import { measuredPath, ribbon } from '../old-town-layout.js';

function walks(batch,geo,plan,plantings) {
  for (const [kind,width,line] of plan.paths) {
    const path=measuredPath(line), half=width/2;
    const rows=path.sections(kind ? 2.8 : 5);
    const start=groundY(geo,...line[0]), end=groundY(geo,...line.at(-1));
    function height(x,z,s){
      if(!kind)return groundY(geo,x,z)+.24;
      const t=s/path.length;
      return start+(end-start)*t+.24+Math.min(1.1,path.length*.025)*Math.sin(Math.PI*t);
    }
    ribbon(batch,rows,-half,half,height,'#bbaf96',litSurface.stone);
    if(!kind)continue;
    for(const side of [-half,half]){
      const edge=(p,h)=>[p.x+p.rx*side,height(p.x,p.z,p.s)+h,p.z+p.rz*side];
      for(let i=1;i<rows.length;i++){
        batch.face([edge(rows[i-1],-.24),edge(rows[i-1],0),edge(rows[i],0),edge(rows[i],-.24)],'#a49c88');
      }
      ribbon(batch,rows,side-.075,side+.075,(x,z,s)=>height(x,z,s)+.88,'#e0d3b4');
      for(let s=0;s<=path.length;s+=3.8){
        const p=path.sample(s),x=p.x-p.uz*side,z=p.z+p.ux*side,y=height(x,z,s);
        cylinder(batch,x,z,y-.2,y+.94,.095,.09,'#c4b798',5);
      }
    }
  }
  for(const [x,z,size] of plan.trees)plantings.push([x,groundY(geo,x,z),z,size,Math.abs(x+z)%4,.57+size*.009]);
}

const gateCentre=[-4123,2291];
function southGate(batch,geo,obstacles,signs) {
  const xy=localFrame(gateCentre,.15), base=groundY(geo,...gateCentre)+.18;
  groundPaving(batch,geo,xy,[-12,13,-5.8,7.5],'#ab9b88');
  const stone='#c5c5b7', trim='#dfddce', green='#538476';
  function block(u,v,w,d,b,t,color) {
    prism(batch,rect(xy,u,v,w,d),base+b,base+t,color,color,litSurface.paleStone);
  }
  for(const [u,r,spring,crown,w] of [[0,2.95,4.25,9.1,8.4],[-7,1.58,2.7,5.9,6],[7,1.58,2.7,5.9,6]]){
    for(const side of [-1,1]){
      const post=(w/2-r)/2;
      block(u+side*(r+post),0,post*2,2.35,-.4,crown,stone);
      block(u+side*(r+post),0,post*2+.2,2.56,-.35,.72,trim);
    }
    for(let i=0;i<16;i++){
      const arc=k=>[u+r*Math.cos(Math.PI*k/16),spring+r*Math.sin(Math.PI*k/16)];
      const [a,lo]=arc(i),[b,hi]=arc(i+1);
      for(const v of [-1.17,1.17])batch.face([up(xy(a,v),base+lo),up(xy(b,v),base+hi),up(xy(b,v),base+crown),up(xy(a,v),base+crown)],stone);
      batch.face([up(xy(a,-1.17),base+lo),up(xy(b,-1.17),base+hi),up(xy(b,1.17),base+hi),up(xy(a,1.17),base+lo)],trim);
    }
    block(u,0,w,2.5,crown-.05,crown+.36,trim);
    const centre=u===0;
    for(const side of [-1,1])for(const v of [-.94,.94])block(u+side*w*.37,v,.45,.42,crown+.35,crown+1.75,stone);
    sweptRoof(batch,xy,u,0,w+.95,3.9,base+crown+1.59,1.05,'#446658',green,.47);
    if(!centre){
      const inner=u*.83;
      for(const side of [-1,1])block(inner+side*1.77,0,.39,1.5,7.95,9.78,stone);
      sweptRoof(batch,xy,inner,0,5.18,3.07,base+9.68,1.0,'#446658',green,.43);
    }
    if(centre){
      for(const side of [-1,1])block(u+side*2.95,0,.58,1.97,crown+1.62,12.7,stone);
      sweptRoof(batch,xy,u,0,9.8,4.1,base+12.52,1.36,'#39584d',green,.54);
      block(0,1.2,3.65,.18,8.02,9.05,'#9eb6a3');
      signs.push({label:'中山公园',ink:'#305747',a:xy(-1.65,1.32),b:xy(1.65,1.32),y:base+8.16,height:.72});
    }
  }
  obstacles.add(rect(xy,0,0,20,2.6),base+14);
}
export function buildZhongshanPark(batch,geo,lamps,obstacles,signs,plantings){
  walks(batch,geo,zs,plantings);
  southGate(batch,geo,obstacles,signs);
}

export function buildWetland(batch,geo,lamps,obstacles,signs,plantings){
  walks(batch,geo,wuyuan,plantings);
  const bank=measuredPath(wuyuan.marsh), rng=randomSource(875);
  for(let s=1;s<bank.length;s+=2+rng()*4){
    const p=bank.sample(s);
    for(let i=0;i<5;i++){
      const x=p.x+(rng()-.5)*2.8,z=p.z+(rng()-.5)*2.8;
      const base=groundY(geo,x,z);
      batch.face([[x-.13,base,z],[x+.13,base,z],[x+.36,base+.55+rng(),z+.16]],i%2?'#92914f':'#828956');
    }
  }
}

function xinglinTower(batch,geo,obstacles) {
  const x=-5864,z=-11852,base=groundY(geo,x,z);
  const xy=localFrame([x,z],Math.PI/8);
  const ring=(r,y,lift=0)=>Array.from({length:16},(_,i)=>{
    const a=i*Math.PI/8, radius=i%2?r*Math.cos(Math.PI/8):r;
    return up(xy(radius*Math.cos(a),radius*Math.sin(a)),base+y+(i%2?0:lift));
  });
  function roof(r,y,rise){
    const rims=[ring(r,y-.38,1.05),ring(r,y,1.05),ring(r*.83,y+.22,.45),ring(r*.62,y+rise)];
    for(let k=1;k<rims.length;k++)for(let i=0;i<16;i++){
      const j=(i+1)%16;
      batch.top([rims[k-1][i],rims[k][i],rims[k][j],rims[k-1][j]],k===1?'#ab6246':'#585e59',litSurface.glazedTile);
    }
    batch.top(rims.at(-1),'#535b54');
  }
  cylinder(batch,x,z,base-.7,base+3.7,18,16.5,'#ccc4ae',8,Math.PI/8);
  for(const [i,r] of [14.8,12,9.5,8.9,8.3,8,7.2].entries()){
    const floor=3.7+i*6.72,ceiling=floor+4.84;
    cylinder(batch,x,z,base+floor,base+ceiling,r*.66,r*.66,'#794e3e',8,Math.PI/8);
    cylinder(batch,x,z,base+floor,base+floor+.48,r*.85,r*.85,'#af6954',8,Math.PI/8);
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4,[px,pz]=xy(Math.cos(a)*r*.79,Math.sin(a)*r*.79);
      cylinder(batch,px,pz,base+floor,base+ceiling,.32,.28,'#a44e39',8);
    }
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4,b=a+Math.PI/4;
      const left=xy(Math.cos(a)*r*.79,Math.sin(a)*r*.79),right=xy(Math.cos(b)*r*.79,Math.sin(b)*r*.79);
      batch.face([up(left,base+floor+.68),up(left,base+floor+.89),up(right,base+floor+.89),up(right,base+floor+.68)],'#ad6249');
      for(let k=1;k<6;k++){
        const px=left[0]+(right[0]-left[0])*k/6,pz=left[1]+(right[1]-left[1])*k/6;
        cylinder(batch,px,pz,base+floor+.44,base+floor+.83,.075,.075,'#a25c45',5);
      }
    }
    roof(r,ceiling,i===6?4.3:1.95);
  }
  cylinder(batch,x,z,base+51.9,base+55.1,1.05,.54,'#b49b61',10);
  cylinder(batch,x,z,base+55.1,base+56.8,.70,.015,'#cab076',10);
  obstacles.add(rect(xy,0,0,25,25),base+56.8);
}
export function buildExpo(batch,geo,lamps,obstacles,signs,plantings){
  walks(batch,geo,expo,plantings);
  xinglinTower(batch,geo,obstacles);
}
