import * as THREE from 'three';
import { alongFrame, offset, ribbon } from './old-town-layout.js';
import { rect, up } from './landmark-forms.js';
import { cylinder, groundY, litSurface, MeshBatch, prism } from './scenery-mesh.js';
import { pathTube } from './landmark-haicang.js';
import { brtConcourse, brtEntranceStation, brtRoadHeight, brtRows } from './brt-layout.js';
import { addBrtAccess } from './brt-station-access.js';

const stone = '#a5b5b0', fascia = '#89acb4', rail = '#bbc7c3', dark = '#435b60', paint = '#d9b051';
const stationStyles = {
  classic:  { eave:2.12, rise:1.94, bay:5.7, metal:'#78a0ab', skin:'#c5cbc5', glaze:'#7e9f9e' },
  transfer: { eave:2.12, rise:2.18, bay:4.6, metal:'#5d9dae', skin:'#cad5cf', glaze:'#7da6ac' },
  railway:  { eave:2.07, rise:2.29, bay:5.5, metal:'#729da9', skin:'#c3c9bf', glaze:'#81a5aa' },
  terminal: { eave:2.48, rise:1.69, bay:5.7, metal:'#6f9ca7', skin:'#d1d5cc', glaze:'#779a9d' },
  airport:  { eave:2.36, rise:1.78, bay:5.0, metal:'#769eaa', skin:'#c1d1ce', glaze:'#789fa9' },
  ground:   { eave:2.67, rise:.53, bay:5.9, metal:'#769ba6', skin:'#b7c8c6', glaze:'#83a1a5' },
};
const english = {
  wharf:'Diyi Matou', kaihe:'Kaihe Lukou', sibei:'Sibei', douxi:'Douxi Lu', ershi:'Ershi', wenzao:'Wenzao',
  jinbang:'Jinbang Park', railway:'Xiamen Railway Station', lianban:'Lianban', longshan:'Longshan Bridge',
  wolong:'Wolong Xiaocheng', dongfang:'Dongfang Shanzhuang', hongwen:'Hongwen', qianpu:'Qianpu Hub',
  caitang:'Caitang', jinshan:'Jinshan', service:'Municipal Service Center', shuangshi:'Shuangshi Middle School',
  xianhou:'Xianhou', gaoqi:'Gaoqi Airport', t4:'Terminal 4',
};

function face(batch,a,b,c,d,color,style=0,uv) {
  batch.face([a,b,c,d],color,style,0,uv);
}

function roofProfile(style, p) {
  return style.eave + style.rise * Math.cos(Math.PI * .5 * p);
}

function accessInWall(stop, p, s) {
  if (!p.access) return false;
  if (stop.form === 'transfer') return Math.abs(s - (stop.s - 16.2*p.side)) < 3;
  if (stop.form === 'railway') return Math.abs(s - (stop.s - 12.5*p.side)) < 2.7;
  return Math.abs(s-brtEntranceStation(p)) < 2.7;
}

function roofPanels(batch, rows, at, p, look, stop) {
  const roof = (r,t,lift=0) => at(r,p.inner-.37+t*(p.outer-p.inner+.67),roofProfile(look,t)+lift);
  for(let i=1; i<rows.length; i++) {
    const a=rows[i-1], b=rows[i];
    for(let j=0;j<12;j++) {
      const t=j/12, q=(j+1)/12;
      const clear = (stop.form === 'transfer' || stop.form === 'airport') && j>=2 && j<=3 && i%4!==1;
      const shade = j===0 || j===11 ? '#a7babb' : look.skin;
      const uv=[[t*5,a.s],[t*5,b.s],[q*5,b.s],[q*5,a.s]];
      batch.top([roof(a,t),roof(b,t),roof(b,q),roof(a,q)],clear?'#adc5c8':shade,litSurface.railRoof,.18,uv);
      face(batch,roof(a,t,-.12),roof(a,q,-.12),roof(b,q,-.12),roof(b,t,-.12),
        clear ? '#a8bec1' : '#a9bab6');
    }
    for (const t of [0,1]) {
      face(batch,roof(a,t,-.25),roof(b,t,-.25),roof(b,t,.01),roof(a,t,.01),look.metal);
      face(batch,roof(a,t,.012),roof(b,t,.012),roof(b,t,.068),roof(a,t,.068), '#d6ddd1');
    }
  }
  for (const end of [rows[0],rows.at(-1)]) {
    const rim = Array.from({length:13},(_,j)=>roof(end,j/12,-.062));
    pathTube(batch,rim,.092,'#d4ddd5',7);
  }
}

function platformFloor(batch, rows, height, p) {
  const lay=(from,to,y,c,style=0,seed=0)=>ribbon(batch,rows,p.side*from,p.side*to,(_x,_z,s)=>height(s)+y,c,style,seed);
  lay(p.inner,p.outer,.245,'#adb8af',litSurface.brtPlatform);
  lay(p.inner+.10,p.inner+.42,.263,paint,litSurface.brtPlatform,1);
  lay(p.inner+.53,p.inner+.574,.269,'#e7dfc4');
  lay(p.outer-.13,p.outer,.270,'#c0cabf');
}

function edgeFences(batch,path,height,p,from,to) {
  const d=p.side*(p.inner+.49);
  for(let s=from+1.8; s<to-2.5;s+=5.2) {
    if (Math.abs(s+1.9-p.centre)<10.6) continue;
    const a=path.sample(s), b=path.sample(s+3.8);
    const A=offset(a,d), B=offset(b,d), y=height(s), z=height(s+3.8);
    for(const [point,h] of [[A,y],[B,z]]) {
      cylinder(batch,point[0],point[1],h+.245,h+1.30,.047,.047,rail,7);
    }
    face(batch,up(A,y+.43),up(B,z+.43),up(B,z+1.14),up(A,y+1.14),'#5f8688',litSurface.ferryGlass);
    pathTube(batch,[up(A,y+1.22),up(B,z+1.22)],.043,rail,6);
    pathTube(batch,[up(A,y+.77),up(B,z+.77)],.024,'#d3bc65',6);
  }
}

function standDetail(batch, frame, y, v, style) {
  const part=(u,d,w,l,lo,hi,c,cap=c)=>prism(batch,rect(frame,u,d,w,l),y+lo,y+hi,c,cap);
  part(0,v,2.5,.48,.67,.76,'#9b8973','#b7a48b');
  part(0,v,2.51,.082,.74,1.02,'#ad9d83');
  for (const u of [-.88,.88]) part(u,v,.09,.35,.24,.71,dark);
  const [x,z]=frame(2.11,v), [xx,zz]=frame(2.11,v-.05);
  cylinder(batch,x,z,y+.24,y+.97,.21,.23,'#93a3a1',10);
  cylinder(batch,xx,zz,y+.967,y+1.004,.14,.14,dark,8);
  part(-2.3,v,.22,.25,.245,2.17,style.metal);
  part(-2.3,v,.73,.11,1.15,2.16,'#49606a','#b1c8c2');
}

function buildPlatform(batch,geo,lamps,obstacles,stop,p,sign) {
  const { link }=stop, { path }=link, look=stationStyles[stop.form];
  const { centre,length,side,inner,outer }=p, from=centre-length/2, to=centre+length/2;
  const height=s=>brtRoadHeight(geo,link,s);
  const rows=brtRows(path,path.sections(4.7),from,to).map(row=>({...row,y:height(row.s)}));
  const at=(r,d,y)=>[r.x+r.rx*side*d,r.y+y,r.z+r.rz*side*d];
  const axis=path.sample(centre), frame=alongFrame(axis), deck=height(centre);
  platformFloor(batch,rows,height,p);
  roofPanels(batch,rows,at,p,look,stop);
  for(let i=1;i<rows.length;i++) {
    const a=rows[i-1], b=rows[i], d=(a.s+b.s)/2;
    face(batch,at(a,inner,-.55),at(b,inner,-.55),at(b,inner,.245),at(a,inner,.245),'#909e99');
    face(batch,at(a,outer,-.60),at(b,outer,-.60),at(b,outer,.245),at(a,outer,.245),fascia,litSurface.paleStone);
    face(batch,at(a,inner,-.55),at(b,inner,-.55),at(b,outer,-.60),at(a,outer,-.60),'#809591');
    if(accessInWall(stop,p,d)) continue;
    const v=outer-.075;
    face(batch,at(a,v,.25),at(b,v,.25),at(b,v,.61),at(a,v,.61),look.metal);
    face(batch,at(a,v,.61),at(b,v,.61),at(b,v,look.eave-.13),at(a,v,look.eave-.13),look.glaze,litSurface.ferryGlass);
    for (const y of [.65,1.22,look.eave-.14]) {
      const bar=[at(a,v,y),at(b,v,y),at(b,v,y+.055),at(a,v,y+.055)];
      batch.face(bar,rail);
    }
  }
  for(let s=from+1.25;s<to-.8;s+=look.bay) {
    const axis=path.sample(s), y=height(s), xy=alongFrame(axis);
    const measure={x:axis.x,z:axis.z,rx:-axis.uz,rz:axis.ux,y};
    const rib=Array.from({length:10},(_,i)=>{
      const q=1-i/9;
      return at(measure,inner-.37+q*(outer-inner+.67),roofProfile(look,q)-.16);
    });
    const outside=at(measure,outer-.13,.28);
    pathTube(batch,accessInWall(stop,p,s) ? rib : [outside,...rib],stop.form==='transfer'?.108:.088,look.metal,7);
    const mid = (inner+outer)*.5;
    const strip = rect(xy,0,side*mid,Math.min(2.9,look.bay*.54),.12);
    const underside=roofProfile(look,.53)-.24;
    prism(batch,strip,y+underside-.11,y+underside,'#d6e4e3','#8fa7a8',litSurface.brtLight);
    lamps.add(...at(measure,mid,underside-.12),'#d9f3ff',1.28);
    if (Math.floor((s-from)/look.bay)%3===1 && !accessInWall(stop,p,s)) standDetail(batch,xy,y,side*(outer-.53),look);
    if (s-from>8 && (Math.floor((s-from)/look.bay)%3===0) && stop.form!=='ground') {
      const bracket=(u,d,h)=>up(xy(u,side*d),y+h);
      for (const u of [-.32,.32]) {
        batch.face([bracket(u,inner-1.28,-1.73),bracket(u,outer-.42,-.60),
          bracket(u,inner-1.28,-.59)],'#94aaa8',litSurface.paleStone);
      }
      face(batch,bracket(-.32,inner-1.28,-1.73),bracket(.32,inner-1.28,-1.73),
        bracket(.32,outer-.42,-.60),bracket(-.32,outer-.42,-.60),'#798e8a');
    }
  }
  edgeFences(batch,path,height,p,from,to);
  const plaque=Math.min(length-2,Math.max(8.8,stop.name.length*1.13+2.7));
  for(const outward of [-1,1]) {
    const v=outward>0 ? outer+.014 : outer-.226, y=deck+(stop.form==='ground'?1.46:1.18);
    const direction=outward*side;
    const a=frame(-direction*plaque/2,side*v), b=frame(direction*plaque/2,side*v);
    prism(batch,rect(frame,0,side*(v-outward*.045),plaque+.14,.065),y-.04,y+1.06,dark,rail);
    sign(a,b,y,1.02,outward>0?0:side);
  }
  if (stop.form === 'ground') {
    const end=side>0?rows.at(-1):rows[0], endFrame=alongFrame(path.sample(end.s));
    const v=side*(inner+outer)/2, d=side*7.5;
    const bottom=depth=>up(endFrame(d,v+depth),groundY(geo,...endFrame(d,v+depth))+.25);
    batch.top([up(endFrame(0,v-1.6),end.y+.245),up(endFrame(0,v+1.6),end.y+.245),bottom(1.6),bottom(-1.6)],'#b7bfad',litSurface.brtPlatform);
  } else if(stop.form==='terminal'||stop.form==='airport') {
    for (const u of [-length*.31,length*.31]) {
      const [x,z]=frame(u,side*(outer-.73)), ground=groundY(geo,x,z);
      if(deck-ground>2.2) cylinder(batch,x,z,ground-.22,deck-.53,.38,.54,stone,10);
    }
  }
  obstacles.add(rect(frame,0,side*(inner+outer)/2,length,outer-inner+.7),Math.max(deck,height(from),height(to))+look.eave+look.rise);
}

function railwaySkylight(batch, geo, obstacles, stop) {
  const { link,s }=stop, { path }=link, start=s-33.75, end=s+33.75;
  const half=stop.boarding[0].inner-.37, edge=roofProfile(stationStyles.railway,0);
  const rows=brtRows(path,path.sections(5.05),start,end).map(r=>({...r,y:brtRoadHeight(geo,link,r.s)}));
  const at=(p,t,extra=0)=>[p.x+t*half*p.rx,p.y+edge+.43*(1-t*t)+extra,p.z+t*half*p.rz];
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1], b=rows[i];
    for(const end of [-1,1]) {
      batch.top([at(a,end),at(b,end),at(b,end*.88),at(a,end*.88)],'#c0d0ca',litSurface.railRoof);
    }
    if (i%3===0 || i===rows.length-1) {
      batch.top([at(a,-.88),at(b,-.88),at(b,.88),at(a,.88)],'#8ba9b5',litSurface.ferryGlass);
    }
    pathTube(batch,Array.from({length:9},(_,j)=>at(a,j/4-1,-.076)),.08,'#b9ccc6',6);
  }
  const p=path.sample(s);
  obstacles.add(rect(alongFrame(p),0,0,end-start,2*half),brtRoadHeight(geo,link,s)+edge+.43);
}

function concourse(batch,geo,lamps,obstacles,{frame,u,v,width,depth},sign) {
  const y=groundY(geo,...frame(u,v))+.52, front=v+depth/2;
  prism(batch,rect(frame,u,v,width,depth),y-.54,y+.13,stone,'#adb9b1');
  prism(batch,rect(frame,u,v,width,depth),y+.13,y+4.29,'#76979b','#899f9b',litSurface.ferryGlass);
  const cap=rect(frame,u,v,width+2.7,depth+1.64);
  prism(batch,cap,y+4.28,y+4.9,fascia,'#c5cec2',litSurface.railEave);
  for(let x=u-width/2+1.25;x<u+width/2;x+=3.75) {
    prism(batch,rect(frame,x,front+.025,.10,.15),y+.14,y+4.32,rail,stone);
  }
  prism(batch,rect(frame,u,front+2.09,20.3,5.15),y+3.12,y+3.37,fascia,rail);
  sign(frame(u-8.94,front+4.69),frame(u+8.94,front+4.69),y+3.45,.86);
  for(const side of [-1,1]) {
    const [x,z]=frame(u+side*8.41,front+3.79);
    cylinder(batch,x,z,y-.14,y+3.26,.104,.081,fascia,9);
    lamps.add(x,y+3.10,z,'#e1f5ff',1.24);
  }
  obstacles.add(cap,y+4.90);
}

function stationSignAtlas(stops) {
  const canvas=document.createElement('canvas'), cols=4, width=512, height=104;
  canvas.width=cols*width; canvas.height=Math.ceil(stops.length*3/cols)*height;
  const ctx=canvas.getContext('2d'), rects=new Map(), font='"PingFang SC","Microsoft Yahei",system-ui,sans-serif';
  for (const [i,stop] of stops.entries()) for (const direction of [0,1,-1]) {
    const index=i*3+(direction===0?0:direction>0?1:2), x=(index%cols)*width,y=Math.floor(index/cols)*height;
    ctx.fillStyle='#171f22'; ctx.fillRect(x,y,width,height);
    ctx.fillStyle='#d5dcd5'; ctx.fillRect(x,y,width,16);
    ctx.fillStyle='#b93b35';
    ctx.beginPath(); ctx.moveTo(x+width-64,y); ctx.lineTo(x+width,y); ctx.lineTo(x+width,y+27); ctx.lineTo(x+width-81,y+27); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#fff4e6'; ctx.font='800 19px '+font; ctx.textAlign='right'; ctx.textBaseline='middle';
    ctx.fillText('BRT',x+width-11,y+15);
    ctx.fillStyle='#f2f3ea'; ctx.textAlign='left'; ctx.font='700 39px '+font;
    ctx.fillText(stop.name,x+18,y+53,direction?253:438);
    ctx.fillStyle='#d4e4df'; ctx.font='540 16px '+font;
    ctx.fillText(english[stop.id],x+19,y+84,direction?238:410);
    if (direction) {
      const dest=stop.id==='wharf'?'开禾路口':direction<0?'第一码头':stop.link.id==='qianpu'?'前埔枢纽':stop.link.id==='airport'?'T4候机楼':'前埔 · 高崎';
      ctx.fillStyle='#c7a04d'; ctx.fillRect(x+280,y+31,216,58);
      ctx.fillStyle='#262821'; ctx.font='700 26px '+font;
      ctx.fillText('往 '+dest,x+292,y+53,192);
      ctx.font='550 15px '+font; ctx.fillText(stop.link.id==='airport'?'快1  ·  快2':stop.link.id==='qianpu'?'快3':'快1  ·  快2  ·  快3',x+294,y+76,188);
    }
    rects.set(stop.id+':'+direction,[(x+1)/canvas.width,1-(y+height-1)/canvas.height,(x+width-1)/canvas.width,1-(y+1)/canvas.height]);
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace; texture.anisotropy=4;
  return { texture, rects, material:new THREE.MeshStandardMaterial({
    map:texture,emissive:'#e3f3ee',emissiveMap:texture,emissiveIntensity:.12,roughness:.78,
  }) };
}

export function buildBrtStations(parent,geo,material,lamps,obstacles,stops) {
  const atlas=stationSignAtlas(stops);
  for(const stop of stops) {
    const batch=new MeshBatch(), vertices=[], uvs=[], indices=[];
    const sign=(a,b,y,h,direction=0)=>{
      const i=vertices.length/3, [u,v,U,V]=atlas.rects.get(stop.id+':'+direction);
      vertices.push(...up(a,y),...up(b,y),...up(b,y+h),...up(a,y+h));
      uvs.push(u,v,U,v,U,V,u,V);
      indices.push(i,i+1,i+2,i,i+2,i+3);
    };
    for (const platform of stop.boarding) buildPlatform(batch,geo,lamps,obstacles,stop,platform,sign);
    if (stop.form==='railway') railwaySkylight(batch,geo,obstacles,stop);
    addBrtAccess(batch,geo,lamps,obstacles,stop,sign);
    const hall=brtConcourse(stop);
    if(hall) concourse(batch,geo,lamps,obstacles,hall,sign);
    const mesh=batch.finish(parent,material,'BRT · '+stop.name);
    mesh.castShadow=mesh.receiveShadow=true;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const signs=new THREE.Mesh(geometry,atlas.material);
    signs.name='BRT 站牌 · '+stop.name;
    parent.add(signs);
  }
  return {
    texture:atlas.texture,
    update(night){ atlas.material.emissiveIntensity=.15+night*.66; },
  };
}
