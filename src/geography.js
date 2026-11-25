import { mazeWater } from './parks/layout.js';
import { gradeShapoweiBank } from './shapowei-bank.js';
import { gradeOldTown } from './old-town-layout.js';
import { gradeNeicuoaoEntrance } from './gulangyu-layout.js';
import { gradeHubin, plan as hubin } from './hubin-layout.js';
import { gradeRailway } from './railway-layout.js';
import { gradeGaoqiRailway } from './gaoqi-railway-layout.js';
import { plan as wucun } from './wucun-layout.js';
import { gradeAirport } from './airport-layout.js';
import { gradeCampusPlayingFields } from './campus-layout.js';
import * as THREE from 'three';
import {readLakes} from './inland-water.js';
import { refineShoreTerrain, tidalSite } from './shore-grading.js';

async function resource(name, format) {
  const response = await fetch('/geo/' + name);
  if (!response.ok) throw new Error('地理资源加载失败：' + name);
  return response[format]();
}

export function elevationField(bounds, samples, scale = 1) {
  const { xmin, xmax, zmin, zmax, width, height } = bounds;
  const sx = (width - 1) / (xmax - xmin),
    sz = (height - 1) / (zmax - zmin);
  if (samples.length !== width * height) throw new Error('地形尺寸不匹配');
  return (x, z) => {
    const u = (x - xmin) * sx,
      v = (z - zmin) * sz;
    if (u < 0 || v < 0 || u > width - 1 || v > height - 1) return -8;
    const col = Math.min(width - 2, Math.floor(u)),
      row = Math.min(height - 2, Math.floor(v));
    const i = row * width + col,
      a = u - col,
      b = v - row;
    // Use the same diagonal as the rendered triangles on steep slopes.
    if(a+b<=1)return scale*(samples[i]+a*(samples[i+1]-samples[i])+b*(samples[i+width]-samples[i]));
    const opposite=samples[i+width+1];
    return scale*(opposite+(1-a)*(samples[i+width]-opposite)+(1-b)*(samples[i+1]-opposite));
  };
}

export function reliefCoverage(grid) {
  const n=(grid.xmax-grid.xmin)/grid.parentCellMetres;
  const coverage=new Uint8Array(n*grid.activeRows.length);
  grid.activeRows.forEach((spans,j)=>{
    for(let i=0;i<spans.length;i+=2)coverage.fill(1,j*n+spans[i],j*n+spans[i+1]);
  });
  return (x,z)=>{
    const i=Math.floor((x-grid.xmin)/grid.parentCellMetres),j=Math.floor((z-grid.zmin)/grid.parentCellMetres);
    return i>=0 && j>=0 && i<n && j<grid.activeRows.length && coverage[j*n+i]!==0;
  };
}

export async function loadGeography(renderer, runway) {
  const textureLoader = new THREE.TextureLoader();
  const boundsRequest = resource('manifest.json', 'json');
  const [
    bounds,
    detailBuffer,
    terrainBuffer,
    coverBuffer,
    islands,
    ground,
    coastTexture, huandaoBeaches,
    nightMap,
    islandGround, relief, reliefBuffer, waterRecords, urbanSurface, hubinGround, wucunGround, bridgeCourtGround,
  ] = await Promise.all([
    boundsRequest,
    boundsRequest.then((m) => resource(m.gulangyuDetail.file, 'arrayBuffer')),
    resource('terrain.bin', 'arrayBuffer'),
    resource('landcover.bin', 'arrayBuffer'),
    resource('islands.json', 'json'),
    textureLoader.loadAsync('/geo/ground.webp'),
    textureLoader.loadAsync('/geo/coast-distance.png'),
    textureLoader.loadAsync('/scenery/huandao-beaches.png'),
    textureLoader.loadAsync('/scenery/night-lights.webp'),
    textureLoader.loadAsync('/scenery/gulangyu-ground.webp'),
    resource('xiamen-relief.json','json'),
    resource('xiamen-relief.bin','arrayBuffer'),
    resource('inland-water.json','json'),
    textureLoader.loadAsync('/geo/urban-surface.webp'),
    textureLoader.loadAsync('/scenery/hubin-ground.webp'),
    textureLoader.loadAsync('/scenery/wucun-ground.webp'),
    textureLoader.loadAsync('/scenery/bridge-court-ground.webp'),
  ]);
  const { xmin, xmax, zmin, zmax, width, height } = bounds;
  const samples = new Int16Array(terrainBuffer),
    cover = new Uint8Array(coverBuffer);
  if (samples.length !== width * height || cover.length !== samples.length)
    throw new Error('地形尺寸不匹配');
  const xScale = (width - 1) / (xmax - xmin),
    zScale = (height - 1) / (zmax - zmin);
  const detail = bounds.gulangyuDetail;
  const localSamples = new Int16Array(detailBuffer);
  gradeAirport(runway, bounds, samples);
  gradeOldTown(bounds, samples);
  gradeHubin(bounds, samples);
  gradeRailway(bounds, samples);
  gradeGaoqiRailway(bounds, samples);
  gradeCampusPlayingFields(bounds, samples);
  gradeOldTown(detail, localSamples);
  gradeNeicuoaoEntrance(detail, localSamples);
  const mainHeight = elevationField(bounds, samples),
    localHeight = elevationField(detail, localSamples, detail.metresPerUnit);
  const inDetail = (x, z) => x >= detail.xmin && x < detail.xmax && z >= detail.zmin && z < detail.zmax;
  const terrainPatch = new Int16Array(reliefBuffer);
  gradeAirport(runway, relief, terrainPatch);
  gradeOldTown(relief, terrainPatch);
  gradeShapoweiBank(relief, terrainPatch);
  gradeHubin(relief, terrainPatch);
  gradeRailway(relief, terrainPatch);
  gradeGaoqiRailway(relief, terrainPatch);
  gradeCampusPlayingFields(relief, terrainPatch);
  const xiamenHeight=elevationField(relief,terrainPatch,relief.metresPerUnit);
  const inXiamen=reliefCoverage(relief);
  const {lakes,waterAt,isletAt}=readLakes([...waterRecords.water,mazeWater]);
  const baseHeightAt=(x,z)=>inDetail(x,z)?localHeight(x,z):inXiamen(x,z)?xiamenHeight(x,z):mainHeight(x,z);
  const urbanBounds=new THREE.Vector4(relief.xmin,relief.zmin,relief.xmax-relief.xmin,relief.zmax-relief.zmin);
  function coverAt(x, z) {
    if(waterAt(x,z))return 0;
    const col = Math.round((x - xmin) * xScale),
      row = Math.round((z - zmin) * zScale);
    const kind=col >= 0 && row >= 0 && col < width && row < height ? cover[row * width + col] : 0;
    return kind || (isletAt(x,z)?3:0);
  }
  // Extend the terrain mesh beneath the fine shoreline mask. Land then ends at the
  // surveyed waterline instead of the edges of the coarser elevation triangles.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
  maskContext.drawImage(coastTexture.image, 0, 0, width, height);
  const coastSamples = maskContext.getImageData(0, 0, width, height).data;
  const image = coastTexture.image;
  const coastCanvas = document.createElement('canvas');
  const coastWidth = coastCanvas.width = image.width;
  const coastHeight = coastCanvas.height = image.height;
  const coastContext = coastCanvas.getContext('2d', { willReadFrequently: true });
  coastContext.drawImage(image, 0, 0);
  const distanceField = new Uint8Array(coastWidth * coastHeight);
  const pixels = coastContext.getImageData(0, 0, coastWidth, coastHeight).data;
  for (let i = 0; i < distanceField.length; i++) distanceField[i] = pixels[i * 4];
  const distanceAt = elevationField({ xmin, xmax, zmin, zmax, width: coastWidth, height: coastHeight }, distanceField);
  const coastDistance = (x, z) => (distanceAt(x, z) - 128) * 2;
  const outerDisplay = Float32Array.from(samples, (y, i) => {
    const shore = (coastSamples[i * 4] - 128) * 2;
    return shore > -115 && shore < 48 ? Math.max(.88, y) : Math.max(-12, y);
  });
  const reliefStep = (relief.xmax - relief.xmin) / (relief.width - 1);
  const islandDisplay = Float32Array.from(terrainPatch, (y, i) => {
    y *= relief.metresPerUnit;
    if (y <= -5 || y >= .88) return Math.max(-12, y);
    const x = relief.xmin + (i % relief.width) * reliefStep;
    const z = relief.zmin + Math.floor(i / relief.width) * reliefStep;
    return waterAt(x, z) ? y : .88;
  });
  const outerRendered = elevationField(bounds, outerDisplay);
  const islandRendered = elevationField(relief, islandDisplay);
  const renderedHeight = (x, z) => inXiamen(x, z) ? islandRendered(x, z) : outerRendered(x, z);
  const refinements = refineShoreTerrain(lakes, coastDistance, renderedHeight, elevationField);
  const refinementAt = (x, z) => refinements.find(patch => patch.contains(x, z));
  const rawHeightAt = (x, z) => refinementAt(x, z)?.sample(x, z) ?? baseHeightAt(x, z);
  ground.colorSpace = THREE.SRGBColorSpace;
  ground.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  nightMap.anisotropy = islandGround.anisotropy = urbanSurface.anisotropy = ground.anisotropy;
  bridgeCourtGround.colorSpace = hubinGround.colorSpace = wucunGround.colorSpace = THREE.SRGBColorSpace;
  bridgeCourtGround.anisotropy = hubinGround.anisotropy = wucunGround.anisotropy = ground.anisotropy;
  const coverTexture = new THREE.DataTexture(cover, width, height, THREE.RedFormat);
  coverTexture.needsUpdate = true;
  const uniforms = { night: { value: 0 } };
  const material = new THREE.MeshStandardMaterial({ map: ground, roughness: 1, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.gNight = uniforms.night;
    shader.uniforms.gUrbanSurface={value:urbanSurface};
    shader.uniforms.gHubin={value:hubinGround};
    const [hx,hz,he,hs]=hubin.groundBounds;
    shader.uniforms.gHubinBounds={value:new THREE.Vector4(hx,hz,he-hx,hs-hz)};
    shader.uniforms.gWucun={value:wucunGround};
    shader.uniforms.gBridgeCourts={value:bridgeCourtGround};
    const [wx,wz,we,ws]=wucun.groundBounds;
    shader.uniforms.gWucunBounds={value:new THREE.Vector4(wx,wz,we-wx,ws-wz)};
    shader.uniforms.gUrbanBounds={value:urbanBounds};
    shader.uniforms.gNightMap = { value: nightMap };
    shader.uniforms.gIsland = { value: islandGround };
    shader.uniforms.gIslandBounds = {
      value: new THREE.Vector4(
        detail.xmin,
        detail.zmin,
        detail.xmax - detail.xmin,
        detail.zmax - detail.zmin
      ),
    };
    shader.uniforms.gCover = { value: coverTexture };
    shader.uniforms.gHuandaoBeaches = { value: huandaoBeaches };
    shader.uniforms.gCoast = { value: coastTexture };
    shader.uniforms.gTidalSite = { value: new THREE.Vector4(...tidalSite) };
    shader.uniforms.gBounds = { value: new THREE.Vector4(xmin, zmin, xmax - xmin, zmax - zmin) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 gXZ; varying float gElevation;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ngXZ=position.xz; gElevation=position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
      varying vec2 gXZ; varying float gElevation; uniform sampler2D gCover; uniform sampler2D gHuandaoBeaches; uniform sampler2D gCoast; uniform vec4 gBounds;
      uniform sampler2D gHubin; uniform vec4 gHubinBounds; uniform vec4 gTidalSite;
      uniform sampler2D gBridgeCourts; uniform sampler2D gWucun; uniform vec4 gWucunBounds;
      uniform sampler2D gUrbanSurface;uniform vec4 gUrbanBounds; uniform float gNight; uniform sampler2D gNightMap; uniform sampler2D gIsland; uniform vec4 gIslandBounds;
      float geoHash(vec2 p){vec3 q=fract(p.xyx*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
      float geoNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(geoHash(i),geoHash(i+vec2(1,0)),f.x),mix(geoHash(i+vec2(0,1)),geoHash(i+vec2(1,1)),f.x),f.y);}
      `
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
      vec2 geoUV=(gXZ-gBounds.xy)/gBounds.zw;
      vec2 cityUV=(gXZ-gUrbanBounds.xy)/gUrbanBounds.zw;
      bool cityArea=all(greaterThan(cityUV,vec2(0.))) && all(lessThan(cityUV,vec2(1.)));
      vec4 surface=cityArea?texture2D(gUrbanSurface,vec2(cityUV.x,1.-cityUV.y)):vec4(0.,0.,0.,1.);
      vec3 urban=surface.rgb;
      bool lakeDistrict=surface.a<.90;
      float coastMetres=(texture2D(gCoast,vec2(geoUV.x,1.-geoUV.y)).r*255.-128.)*2.;
      if(lakeDistrict){
        bool gradedBank=all(greaterThan(gXZ,gTidalSite.xy+vec2(45.)))
                     && all(lessThan(gXZ,gTidalSite.zw-vec2(45.)));
        if(!gradedBank && gElevation<7. && urban.g>.245 && urban.g<.72)discard;
        coastMetres=max(coastMetres,12.);
      }else if(coastMetres<0.)discard;
      float kind=texture2D(gCover,geoUV).r*255.;
      float nearDetail=1.-smoothstep(.75,8.,max(fwidth(gXZ.x),fwidth(gXZ.y)));
      float footprint=max(length(dFdx(gXZ)),length(dFdy(gXZ)));
      float grain=mix(geoNoise(gXZ*.31),.5,smoothstep(.45,1.6,footprint*.31));
      float thicket=mix(geoNoise(gXZ*.084+grain*.55),.5,smoothstep(.45,1.6,footprint*.084));
      if(kind>1.5 && kind<3.5){
        vec3 shade=mix(vec3(.007,.021,.012),vec3(.060,.102,.044),thicket);
        diffuseColor.rgb=mix(diffuseColor.rgb,shade,.36);
        diffuseColor.rgb*=.81+.39*thicket+.13*(grain-.5)*nearDetail;
      }else if(kind>3.5 && kind<4.5){
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.53,.43,.30),.20)*(.94+.11*grain);
      }else{
        diffuseColor.rgb=mix(diffuseColor.rgb,min(diffuseColor.rgb,vec3(.53,.52,.47)),.36);
        diffuseColor.rgb*=.98+.075*(grain-.5)*nearDetail;
      }
      if(cityArea){
        float green=smoothstep(.08,.85,urban.r);
        vec3 woods=mix(vec3(.024,.058,.032),vec3(.092,.142,.069),.63*thicket+.37*grain);
        vec3 lawn=mix(vec3(.077,.132,.051),vec3(.143,.208,.083),.58*thicket+.42*grain);
        vec3 planting=mix(lawn,woods,smoothstep(.68,.91,urban.r));
        diffuseColor.rgb=mix(diffuseColor.rgb,planting,.92*green);
        float block=smoothstep(.045,.65,urban.b)*(1.-.94*green);
        float plant=smoothstep(1.09,1.42,(diffuseColor.g+.026)/(diffuseColor.r+.026));
        vec3 paving=mix(vec3(.13,.132,.123),vec3(.207,.201,.18),.32*grain+.68*thicket);
        vec3 courtyard=mix(paving,woods,plant*.86);
        diffuseColor.rgb=mix(diffuseColor.rgb,courtyard,.90*block);
        if(lakeDistrict && urban.g<.245) diffuseColor.rgb=mix(diffuseColor.rgb,courtyard,.64*(1.-green));
      }
      vec2 hubinUV=(gXZ-gHubinBounds.xy)/gHubinBounds.zw;
      vec4 hubinBlock=vec4(0.);
      if(all(greaterThan(hubinUV,vec2(0.))) && all(lessThan(hubinUV,vec2(1.)))){
        hubinBlock=texture2D(gHubin,vec2(hubinUV.x,1.-hubinUV.y));
        diffuseColor.rgb=mix(diffuseColor.rgb,hubinBlock.rgb*(.84+.17*thicket),hubinBlock.a);
      }
      vec2 wucunUV=(gXZ-gWucunBounds.xy)/gWucunBounds.zw;
      if(all(greaterThan(wucunUV,vec2(0.))) && all(lessThan(wucunUV,vec2(1.)))){
        vec4 district=texture2D(gWucun,vec2(wucunUV.x,1.-wucunUV.y));
        diffuseColor.rgb=mix(diffuseColor.rgb,district.rgb*(.90+.10*thicket),district.a*.92);
      }
      bool lehaiCourt=gXZ.x<0.;
      vec2 courtUV=lehaiCourt?(gXZ-vec2(-2600.,-12460.))/vec2(1130.,1150.):
                              (gXZ-vec2(7640.,-10360.))/vec2(350.,390.);
      if(all(greaterThan(courtUV,vec2(0.))) && all(lessThan(courtUV,vec2(1.)))){
        vec4 court=texture2D(gBridgeCourts,vec2(.5*courtUV.x+(lehaiCourt?0.:.5),1.-courtUV.y));
        diffuseColor.rgb=mix(diffuseColor.rgb,court.rgb*(.88+.12*thicket),court.a);
      }
      vec2 islandUV=(gXZ-gIslandBounds.xy)/gIslandBounds.zw;
      if(all(greaterThan(islandUV,vec2(0.))) && all(lessThan(islandUV,vec2(1.)))){
        vec4 mapped=texture2D(gIsland,vec2(islandUV.x,1.-islandUV.y));
        vec3 gardens=mix(vec3(.026,.059,.027),vec3(.130,.164,.066),thicket*.68+grain*.32);
        vec3 court=mix(vec3(.164,.147,.123),vec3(.30,.267,.214),grain*.55+.45*geoNoise(gXZ*.05));
        vec3 shoreRock=mix(vec3(.18,.16,.149),vec3(.35,.308,.259),thicket);
        vec3 local=mix(court,gardens,mapped.r);
        float drySand=smoothstep(2.,22.,coastMetres+3.*(grain-.5));
        vec3 beach=mix(vec3(.30,.247,.174),vec3(.62,.514,.365),drySand);
        local=mix(local,beach*(.90+.18*grain),mapped.g);
        local=mix(local,shoreRock,mapped.b);
        diffuseColor.rgb=mix(diffuseColor.rgb,local,.78)*(.48+.52*mapped.a);
      }
      vec2 huandaoUV=(gXZ-vec2(-3150.,-6500.))/vec2(10500.,12800.);
      if(all(greaterThan(huandaoUV,vec2(0.))) && all(lessThan(huandaoUV,vec2(1.)))){
        float sand=texture2D(gHuandaoBeaches,vec2(huandaoUV.x,1.-huandaoUV.y)).r;
        vec3 tint=mix(vec3(.30,.237,.167),vec3(.66,.55,.389),smoothstep(0.,25.,coastMetres));
        diffuseColor.rgb=mix(diffuseColor.rgb,tint*(.91+.12*grain+.04*thicket),.79*sand);
      }
      diffuseColor.rgb*=mix(.73,1.,smoothstep(0.,19.,coastMetres));
      `
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if(gNight>.001) {
          vec3 lights=texture2D(gNightMap,vec2(geoUV.x,1.-geoUV.y)).rgb;
          float blocks=geoNoise(gXZ*.004);
          vec3 neighborhood=mix(vec3(.85,.39,.13),vec3(.48,.64,.66),smoothstep(.46,.80,blocks));
          vec3 nightGround=vec3(.87,.42,.135)*lights.r*.52
                         +neighborhood*lights.g*.26+vec3(.36,.20,.095)*lights.b*.26;
          float islandWeight=(1.-smoothstep(940.,1140.,abs(gXZ.x+6300.)))
                            *(1.-smoothstep(920.,1100.,abs(gXZ.y-3640.)));
          float green=smoothstep(1.3,1.8,kind);
          nightGround*=1.-islandWeight*(.34+.34*green);
          nightGround*=1.-.65*urban.r;
          nightGround*=1.-.77*hubinBlock.a;
          totalEmissiveRadiance+=nightGround*gNight*smoothstep(0.,9.,coastMetres);
        }`
      );
  };
  const group = new THREE.Group();
  group.name = '厦门海岸与山地';
  function addTerrain(grid, data, heightScale, region) {
    const isIsland=region==='gulangyu', isMain=region==='xiamen';
    const refined=region==='shore';
    const stepX = (grid.xmax - grid.xmin) / (grid.width - 1);
    const stepZ = (grid.zmax - grid.zmin) / (grid.height - 1);
    const stride = region!=='outer' ? 1 : Math.max(1, Math.round((grid.width - 1) / 650));
    const chunk = stride * (isIsland ? 80 : 72);
    for (let startZ = 0; startZ < grid.height - 1; startZ += chunk)
      for (let startX = 0; startX < grid.width - 1; startX += chunk) {
        const endX = Math.min(grid.width - 1, startX + chunk),
          endZ = Math.min(grid.height - 1, startZ + chunk);
        const cols = Math.ceil((endX - startX) / stride) + 1,
          rows = Math.ceil((endZ - startZ) / stride) + 1;
        const positions = [],
          uv = [],
          indices = [];
        for (let rz = 0; rz < rows; rz++)
          for (let cx = 0; cx < cols; cx++) {
            const col = Math.min(startX + cx * stride, endX),
              row = Math.min(startZ + rz * stride, endZ);
            const i = row * grid.width + col,
              x = grid.xmin + col * stepX,
              z = grid.zmin + row * stepZ;
            const y = Math.max(-12, data[i] * heightScale);
            positions.push(x, y, z);
            uv.push((x - xmin) / (xmax - xmin), 1 - (z - zmin) / (zmax - zmin));
          }
        for (let rz = 0; rz < rows - 1; rz++)
          for (let cx = 0; cx < cols - 1; cx++) {
            const a = rz * cols + cx,
              b = a + 1,
              c = a + cols,
              d = c + 1;
            const x = positions[a * 3],
              z = positions[a * 3 + 2];
            if(!refined && refinementAt(x,z)) continue;
            if (!isIsland && inDetail(x,z)) continue;
            if (isMain && !inXiamen(x,z)) continue;
            if (region==='outer' && inXiamen(x,z)) continue;
            if (!isMain &&
              Math.max(
                positions[a * 3 + 1],
                positions[b * 3 + 1],
                positions[c * 3 + 1],
                positions[d * 3 + 1]
              ) < 0
            )
              continue;
            indices.push(a, c, b, b, c, d);
          }
        if (!indices.length) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = refined ? '水库岸坡与桥头地表' : isIsland ? '鼓浪屿山地与湾岸' : isMain ? '厦门本岛山地与平原' : '海湾远山';
        mesh.receiveShadow = true;
        group.add(mesh);
      }
  }
  addTerrain(bounds,outerDisplay,1,'outer');
  addTerrain(relief,islandDisplay,1,'xiamen');
  addTerrain(detail,localSamples,detail.metresPerUnit,'gulangyu');
  for(const { grid, data } of refinements) addTerrain(grid,data,1,'shore');
  return {
    bounds,
    islands,
    coastTexture, urbanSurface, urbanBounds, lakes, waterAt, isletAt,
    group,
    uniforms,
    rawHeightAt,
    islandSurfaceHeightAt: islandRendered,
    coverAt,
    heightAt(x,z) {
      const lake=waterAt(x,z);
      if(lake)return lake.h;
      const ground=rawHeightAt(x,z);
      return ground<.88 && isletAt(x,z)? .88 : Math.max(0,ground);
    },
  };
}
