import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// A column of the same advected weather field drives the cloud volume, its shadow on
// the island, and the light that enters the air between the observer and the sea.
const weatherField = `
  uniform sampler2D airWeather;
  uniform vec2 airWind;
  uniform vec3 airSun;
  uniform float airBase, airHeight, airCover;
  vec2 weatherUV(vec2 xz){return (xz-airWind)/28500.+vec2(.30,.41);}
  vec2 bankUV(vec2 uv,vec2 weather){return uv*4.+vec2(.19,-.21)+(weather.gr-.5)*.13;}
  float overcast(){return smoothstep(.66,.94,airCover);}
  float cloudMass(float chart){
    float m=smoothstep(.63-.52*airCover,.94-.46*airCover,chart);
    return mix(m,.70+.30*m,overcast());
  }
  float bankBias(float mass){return mix(-225.,48.,mass);}
  float directSunAt(vec3 world){
    if(airSun.y<=-.026 || world.y>=airBase+1.4*airHeight) return 1.;
    float height=max(0.,airBase+.36*airHeight-world.y);
    vec2 uv=weatherUV(world.xz+airSun.xz*height/max(.065,airSun.y));
    vec2 field=texture2D(airWeather,uv).rg;
    float mass=cloudMass(field.r);
    float column=(texture2D(airWeather,bankUV(uv,field)).a*(255./127.)-128./127.-.5)*840.+bankBias(mass);
    float shade=max(.93*overcast(),smoothstep(-44.,143.,column)*smoothstep(.0,.21,mass));
    shade*=1.-smoothstep(airBase,airBase+airHeight*(.28+.95*mass),world.y);
    return 1.-shade*smoothstep(-.026,.066,airSun.y);
  }`;

const directionalWarp = `
  uniform vec3 cloudFocus;
  const float focusWarp=.77;
  vec3 warpDirection(vec3 d,float b){
    float c=dot(d,cloudFocus);
    return ((d-cloudFocus*c)*sqrt(1.-b*b)+cloudFocus*(c-b))/(1.-b*c);
  }`;
export const cloudViewGLSL =
  directionalWarp +
  `
  uniform sampler2D cloudLight, cloudDepth;
  uniform vec3 cloudEye;
  vec2 airUV(vec3 ray){
    vec3 d=warpDirection(ray,focusWarp);
    return vec2(atan(d.z,d.x)*.159154943+.5,asin(clamp(d.y,-1.,1.))*.318309886+.5);
  }
  vec3 airBeamColor(vec3 sun){
    return mix(vec3(1.20,.47,.14),vec3(1.02,.89,.68),smoothstep(.02,.49,sun.y));
  }`;
export { weatherField as cloudShadowGLSL };

const nearRanges = 'const vec4 nearMetres=vec4(25.,95.,270.,720.);';
const cloudLookup = `
  uniform vec3 eyeTravel;
  vec2 cloudUV(vec3 ray){
    vec2 uv=airUV(ray);
    float mean=max(65.,exp2(texture2D(cloudDepth,uv).b*16.)-1.);
    return airUV(normalize(ray+eyeTravel/mean));
  }`;

const volumeFragment = `
precision highp float;
precision highp sampler3D;
in vec2 at;
layout(location=0) out vec4 lightLayer;
layout(location=1) out vec4 depthLayer;
layout(location=2) out vec4 nearLayer;
#define texture2D texture
${weatherField}
${directionalWarp}
${nearRanges}
uniform sampler3D airShape, airBanks;
uniform vec3 eye, lunar;
uniform float airMist, airRain, airNight, clockSeconds;
const float PI=3.14159265;
// R is a signed distance in metres to the bank's lobes. The vertical bounds
// also make light probes outside the altitude band sample clear air.
float hullAt(vec3 q,float bias,float sheetTop,float lod){
  float bank=(textureLod(airBanks,q,lod).r-.5)*840.+bias;
  float h=(q.y*1440.-140.)/1100.;
  float stratus=min(h+.02,sheetTop-h)*950.;
  return min(max(bank,stratus),min(q.y,1.-q.y)*1440.);
}
float lightDensity(vec3 q,float bias,float sheetTop,float lod){
  return smoothstep(-36.,88.,hullAt(q,bias,sheetTop,lod));
}
float surfaceDetail(vec3 p,float lod){
  vec2 curl=textureLod(airShape,p,lod).rg;
  float fine=textureLod(airShape,p*3.81+vec3(.39,clockSeconds*.00011,.62),lod+.35).g;
  return (curl.r-.5)*156.+(curl.g-.5)*63.+(fine-.5)*54.;
}
void main(){
  float az=(at.x-.5)*2.*PI, el=(at.y-.5)*PI;
  vec3 ray=warpDirection(vec3(cos(el)*cos(az),sin(el),cos(el)*sin(az)),-focusWarp);
  float dy=abs(ray.y)>.0001?ray.y:(ray.y<0.?-.0001:.0001);
  float r0=(airBase-.26*airHeight-eye.y)/dy, r1=(airBase+1.46*airHeight-eye.y)/dy;
  float start=max(0.,min(r0,r1)), end=min(34000.,max(r0,r1));
  float toward=max(0.,dot(ray,airSun)), day=smoothstep(-.19,-.003,airSun.y);
  float gold=(1.-smoothstep(.04,.46,airSun.y))*(1.-airNight);
  vec3 sunColor=mix(vec3(1.38,1.32,1.22),vec3(1.65,.77,.37),gold)*day*(1.-.73*airRain);
  vec3 ambient=mix(vec3(.27,.37,.54),vec3(.30,.265,.37),gold);
  ambient=mix(ambient,vec3(.024,.036,.068),airNight);
  vec3 key=normalize(mix(airSun,lunar,smoothstep(.35,.95,airNight)));
  sunColor+=vec3(.085,.113,.165)*airNight*smoothstep(-.03,.30,lunar.y);
  float rim=.66*pow(max(0.,dot(ray,key)),9.);
  vec3 airColor=mix(mix(vec3(.65,.76,.88),vec3(.86,.59,.44),gold),vec3(.038,.048,.074),airNight);
  float wet=overcast(), trans=1., front=60000., opacity=0., weightedDist=0.;
  vec4 nearTau=vec4(0.);
  vec3 sum=vec3(0.);
  float t=start;
  for(int i=0;i<VIEW_STEPS;i++){
    if(t>=end || trans<.004)break;
    // Short intervals resolve wisps near the aircraft. Empty space gets a
    // longer stride; grazing rays gradually use coarser, mip-filtered lobes.
    float catchUp=mix(.24,1.,smoothstep(.16,.74,float(i)/float(VIEW_STEPS)));
    float budgetStep=catchUp*(end-t)/float(VIEW_STEPS-i);
    float stride=max((24.+min(100.,t*.005))*STEP_SCALE,budgetStep*smoothstep(500.,2400.,t));
    stride=min(stride,end-t);
    float dist=t+.5*stride;
    vec3 p=eye+ray*dist;
    vec2 uv=weatherUV(p.xz);
    vec2 weather=textureLod(airWeather,uv,max(0.,log2(stride/110.))).rg;
    float mass=cloudMass(weather.r);
    if(mass<.003){t+=max(stride,270.);continue;}
    float thickness=airHeight*(.48+.65*mass)*(.81+.34*weather.g);
    float h=(p.y-airBase-(weather.g-.5)*airHeight*.14)/thickness;
    vec2 bank=bankUV(uv,weather)+vec2(.018,-.008)*h;
    vec3 q=vec3(bank.x,(h*1100.+140.)/1440.,bank.y);
    float bias=bankBias(mass), sheetTop=.38+.19*weather.g-1.65*(1.-wet);
    float lod=max(0.,log2(max(1.,stride/76.)));
    float hull=hullAt(q,bias,sheetTop,lod);
    if(hull< -179.){
      t+=max(stride,.85*(-hull-140.));
      continue;
    }
    vec3 turbulence=(p-vec3(airWind.x,airBase,airWind.y))*.00061;
    float edge=hull+surfaceDetail(turbulence,lod);
    float d=smoothstep(-38.,92.,edge)*smoothstep(0.,.18,mass);
    if(d>.001){
      vec3 lightStep=key*vec3(1./7125.,1100./(1440.*thickness),1./7125.);
      float sunEdge=hullAt(q+lightStep*55.,bias,sheetTop,lod)
                   +surfaceDetail(turbulence+key*(55.*.00061),lod);
      float s1=smoothstep(-36.,88.,sunEdge);
      float s2=lightDensity(q+lightStep*165.,bias,sheetTop,lod);
      float s3=lightDensity(q+lightStep*390.,bias,sheetTop,lod+.45);
      float s4=lightDensity(q+lightStep*810.,bias,sheetTop,lod+1.);
      float tau=(28.*d+82.*s1+167.*s2+321.*s3+210.*s4)*.009;
      float facing=smoothstep(-.39,.89,(edge-sunEdge)/55.);
      float direct=exp(-tau)*(.31+.90*facing), bounce=exp(-.29*tau);
      float heightLight=smoothstep(-.04,.91,h);
      vec3 lit=ambient*(.45+.60*heightLight)+sunColor*(direct*(.94+rim)+.24*bounce);
      float path=1.-exp(-dist*(.000035+.000070*airMist));
      lit=mix(lit,airColor,path*.84);
      float extinction=d*(.012+.003*airRain)*(1.-smoothstep(21500.,34000.,dist));
      float scatter=1.-exp(-extinction*stride);
      if(front>59000. && trans*(1.-scatter)<.97)
        front=t+clamp(log(trans/.97)/max(extinction,.000001),0.,stride);
      float weight=trans*scatter*(1.-.44*smoothstep(15500.,34000.,dist));
      if(t<nearMetres.w)nearTau+=extinction*clamp(nearMetres-t,0.,stride);
      sum+=weight*lit;
      weightedDist+=weight*dist;
      opacity+=weight;
      trans*=1.-scatter;
    }
    t+=stride;
  }
  if(front>59000. && opacity>.001)front=weightedDist/opacity;
  // Sheared high ice cloud lives in a separate altitude band.
  float high=(4150.-eye.y)/dy;
  bool iceFirst=eye.y>4150.;
  if(high>0. && high<62000. && (trans>.012 || iceFirst)){
    vec2 uv=weatherUV(eye.xz+ray.xz*high)*.69+vec2(.12,-.06)+airWind*.000016;
    vec2 drift=textureLod(airWeather,uv*.73,0.).rg-.5;
    vec3 cirrus=textureLod(airWeather,uv+.13*drift,0.).rgb;
    float threads=textureLod(airWeather,uv*3.17+.19*drift,0.).b;
    float ice=smoothstep(.43,.86,cirrus.b)*(.05+.21*cirrus.g)*(.40+.60*threads)
             *(1.-smoothstep(27000.,62000.,high));
    vec3 iceLight=mix(mix(vec3(.68,.79,.91),vec3(1.05,.68,.50),gold),vec3(.041,.058,.091),airNight);
    float w=iceFirst?ice:trans*ice, behind=iceFirst?1.-ice:1.;
    sum=sum*behind+w*iceLight;
    opacity=opacity*behind+w;
    weightedDist=weightedDist*behind+w*high;
    if(ice>.004)front=min(front,high);
  }
  // Integrate sunlit marine haze underneath gaps. Sun direction and cloud shadows
  // are evaluated in metres, so rays stay anchored as the pilot turns their head.
  float shafts=0.;
  if(day>.01 && airSun.y>-.024 && airCover>.10 && eye.y<airBase+100.){
    float limit=ray.y>.01?min(19000.,max(0.,(airBase-eye.y)/dy)):19000.;
    if(ray.y<-.001)limit=min(limit,max(0.,-eye.y/dy));
    for(int i=0;i<12;i++){
      float along=(float(i)+.5)/12.;
      shafts+=directSunAt(eye+ray*along*limit)*(.82+.36*(1.-along));
    }
    float patches=max(0.,shafts/12.-.29);
    shafts=patches*(1.-exp(-limit*.000136))*(.17+.83*pow(toward,6.))
          *smoothstep(.09,.31,airCover)*(1.-smoothstep(.74,.97,airCover))
          *smoothstep(-.024,.075,airSun.y)*(1.-.60*airMist)*(.22+.30*gold);
  }
  float depth=opacity>.001?weightedDist/opacity:60000.;
  lightLayer=vec4(sum/3.,opacity);
  depthLayer=vec4(log2(1.+front)/16.,shafts,log2(1.+depth)/16.,1.);
  nearLayer=min(nearTau/8.,1.);
}`;

async function cloudBytes(file, size) {
  const response = await fetch('/art/' + file);
  if (!response.ok) throw new Error('云层纹理加载失败');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== size) throw new Error('云层纹理大小有误');
  return bytes;
}

async function cloudNoise() {
  const width = 160, levels = 48;
  const [weather, bytes, bankData] = await Promise.all([
    new THREE.TextureLoader().loadAsync('/art/cloud-weather.webp'),
    cloudBytes('cloud-shape.rg8', 64 ** 3 * 2),
    cloudBytes('cloud-banks.r8', width * width * levels),
  ]);
  const shape = new THREE.Data3DTexture(bytes, 64, 64, 64);
  shape.format = THREE.RGFormat;
  shape.wrapT = THREE.RepeatWrapping;
  const banks = new THREE.Data3DTexture(bankData, width, levels, width);
  banks.format = THREE.RedFormat;
  for (const texture of [shape, banks]) {
    texture.wrapS = texture.wrapR = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  }
  weather.wrapS = weather.wrapT = THREE.RepeatWrapping;
  return { shape, banks, weather };
}

export async function createClouds(scene, renderer) {
  const { shape, banks, weather } = await cloudNoise();
  const mobile = matchMedia('(pointer:coarse)').matches;
  const field = {
    airWeather: { value: weather },
    airWind: { value: new THREE.Vector2() },
    airSun: { value: new THREE.Vector3() },
    airBase: { value: 840 },
    airHeight: { value: 1250 },
    airCover: { value: 0.37 },
  };
  const panorama = new THREE.WebGLRenderTarget(mobile ? 832 : 1280, mobile ? 320 : 512, {
    count: 3,
    type: renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType,
    depthBuffer: false,
    wrapS: THREE.RepeatWrapping,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  // Waves can project many cloud texels into a single water pixel at grazing angles.
  panorama.textures[0].generateMipmaps = true;
  panorama.textures[0].minFilter = THREE.LinearMipmapLinearFilter;
  const view = {
    cloudLight: { value: panorama.textures[0] },
    cloudDepth: { value: panorama.textures[1] },
    cloudEye: { value: new THREE.Vector3() },
    cloudFocus: { value: new THREE.Vector3(0, 0, -1) },
  };
  const uniforms = {
    ...field,
    eye: view.cloudEye,
    cloudFocus: view.cloudFocus,
    airShape: { value: shape },
    airBanks: { value: banks },
    lunar: { value: new THREE.Vector3() },
    airMist: { value: 0 },
    airRain: { value: 0 },
    airNight: { value: 0 },
    clockSeconds: { value: 0 },
  };
  const cameraUniforms = {
    eyeRotation: { value: new THREE.Matrix3() },
    inverseProjection: { value: new THREE.Matrix4() },
    eyeTravel: { value: new THREE.Vector3() },
  };
  const march = new FullScreenQuad(
    new THREE.RawShaderMaterial({
      name: '海上云层体积采样',
      glslVersion: THREE.GLSL3,
      uniforms,
      defines: { VIEW_STEPS: mobile ? 62 : 94, STEP_SCALE: mobile ? '1.45' : '1.0' },
      vertexShader:
        'precision highp float;in vec3 position;in vec2 uv;out vec2 at;void main(){at=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: volumeFragment,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
    })
  );
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      name: '海上层云与积云',
      transparent: true,
      depthTest: true,
      depthWrite: false,
      uniforms: { ...view, ...cameraUniforms },
      vertexShader: `uniform mat4 inverseProjection;varying vec3 localRay;
      void main(){localRay=(inverseProjection*vec4(position.xy,1.,1.)).xyz;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader:
        cloudViewGLSL + cloudLookup +
        `
      uniform mat3 eyeRotation;uniform mat4 projectionMatrix;varying vec3 localRay;
      void main(){
        vec3 v=normalize(localRay),d=eyeRotation*v;vec2 uv=cloudUV(d);
        vec4 cloud=texture2D(cloudLight,uv);if(cloud.a<.002)discard;
        float front=max(42.,exp2(texture2D(cloudDepth,uv).r*16.)-1.-dot(eyeTravel,d));
        vec4 clip=projectionMatrix*vec4(v*front,1.);
        gl_FragDepth=clamp(.5+.5*clip.z/clip.w,0.,.9999998);
        gl_FragColor=vec4(3.*cloud.rgb/max(cloud.a,.002),cloud.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    })
  );
  screen.frustumCulled = false;
  screen.renderOrder = -900;
  scene.add(screen);
  // When flying through cloud, a wingtip and a distant hill on adjacent pixels
  // see different lengths of cloud. Integrate only up to the scene depth there.
  const composite = new FullScreenQuad(new THREE.ShaderMaterial({
    name: '穿云能见度',
    uniforms: {
      ...view, ...cameraUniforms,
      nearOptical: { value: panorama.textures[2] },
      sceneColor: { value: null }, sceneDepth: { value: null },
    },
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 at;void main(){at=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: cloudViewGLSL + cloudLookup + nearRanges + `
      uniform sampler2D nearOptical,sceneColor,sceneDepth;
      uniform mat3 eyeRotation;uniform mat4 inverseProjection;varying vec2 at;
      float opticalTo(vec4 tau,float distanceM){
        vec4 starts=vec4(0.,nearMetres.xyz);
        return dot(tau-vec4(0.,tau.xyz),clamp((distanceM-starts)/(nearMetres-starts),0.,1.));
      }
      void main(){
        float z=texture2D(sceneDepth,at).r;
        vec4 hit=inverseProjection*vec4(at*2.-1.,z*2.-1.,1.);
        vec3 ray=eyeRotation*normalize(hit.xyz);
        vec2 uv=cloudUV(ray);
        vec4 cloud=texture2D(cloudLight,uv);
        vec3 color=texture2D(sceneColor,at).rgb;
        if(cloud.a>.002){
          float shift=dot(eyeTravel,ray);
          float distanceM=length(hit.xyz)/max(.000001,hit.w)+shift;
          vec4 tau=texture2D(nearOptical,uv)*8.;
          vec2 depths=exp2(texture2D(cloudDepth,uv).rb*16.)-1.;
          float optical=max(0.,opticalTo(tau,distanceM)-opticalTo(tau,shift));
          float beyond=max(nearMetres.w,depths.x);
          float farPart=smoothstep(beyond,beyond+max(30.,2.*(depths.y-depths.x)),distanceM);
          float alpha=mix(min(cloud.a,1.-exp(-optical)),cloud.a,z>=1.?1.:farPart);
          color=mix(color,3.*cloud.rgb/cloud.a,alpha);
        }
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  function compositeScene(frame) {
    composite.material.uniforms.sceneColor.value = frame.texture;
    composite.material.uniforms.sceneDepth.value = frame.depthTexture;
    composite.render(renderer);
  }
  let previous = -100,
    previousMinute = -3000,
    previousCover = -1;
  const direction = new THREE.Vector3();
  let inLayer = false;
  function update(dt, camera, state, sun, moon, night, airliner) {
    camera.updateMatrixWorld();
    cameraUniforms.eyeRotation.value.setFromMatrix4(camera.matrixWorld);
    cameraUniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    const travel = cameraUniforms.eyeTravel.value.subVectors(camera.position, view.cloudEye.value);
    camera.getWorldDirection(direction);
    if (state.time < previous) field.airWind.value.set(0, 0);
    field.airWind.value.x += dt * (6.5 + 2.0 * state.wind.x);
    field.airWind.value.y += dt * (-2.2 + 2.1 * state.wind.z);
    field.airCover.value = state.cloud;
    // The arrival descends through this deck before the passenger windows face the city.
    const fairArrival = airliner ? 1 - THREE.MathUtils.smoothstep(Math.max(state.rain, state.mist), .22, .85) : 0;
    field.airBase.value = 850 - 370 * state.rain - 105 * state.mist + 1100 * fairArrival;
    field.airHeight.value = 1230 + 400 * state.cloud - 550 * fairArrival;
    inLayer = camera.position.y > field.airBase.value - 180 &&
      camera.position.y < field.airBase.value + field.airHeight.value * 1.46 + 160;
    field.airSun.value.copy(sun);
    if (
      state.time >= previous &&
      state.time - previous < (mobile ? 0.44 : 0.31) &&
      Math.abs(state.minute - previousMinute) < 0.8 &&
      Math.abs(state.cloud - previousCover) < 0.042 &&
      view.cloudFocus.value.dot(direction) > 0.96 &&
      travel.lengthSq() < (inLayer ? 24 * 24 : 52 * 52)
    )
      return;
    previous = state.time;
    previousMinute = state.minute;
    previousCover = state.cloud;
    view.cloudEye.value.copy(camera.position);
    travel.set(0, 0, 0);
    view.cloudFocus.value.copy(direction);
    uniforms.airNight.value = night;
    uniforms.airRain.value = state.rain;
    uniforms.airMist.value = state.mist;
    uniforms.clockSeconds.value = state.time;
    uniforms.lunar.value.copy(moon);
    const target = renderer.getRenderTarget();
    renderer.setRenderTarget(panorama);
    march.render(renderer);
    renderer.setRenderTarget(target);
  }
  function shadeSurfaces(root) {
    const materials = new Set();
    root.traverse((object) => {
      const mat = object.material;
      if (mat?.isMeshStandardMaterial || mat?.isMeshLambertMaterial) materials.add(mat);
      if (mat?.userData.cloudFoliage) Object.assign(mat.uniforms, field);
    });
    for (const mat of materials) {
      const compile = mat.onBeforeCompile,
        key = mat.customProgramCacheKey();
      mat.onBeforeCompile = function (shader, r) {
        compile.call(this, shader, r);
        Object.assign(shader.uniforms, field);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 airWorld;')
          .replace(
            '#include <project_vertex>',
            `#include <project_vertex>
          vec4 atmosphericPoint=vec4(transformed,1.);
          #ifdef USE_INSTANCING
          atmosphericPoint=instanceMatrix*atmosphericPoint;
          #endif
          airWorld=(modelMatrix*atmosphericPoint).xyz;`
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 airWorld;\n' + weatherField)
          .replace(
            '#include <lights_fragment_end>',
            `#include <lights_fragment_end>
            float cloudSun=directSunAt(airWorld);
            reflectedLight.directDiffuse*=mix(.23,1.,cloudSun);
            reflectedLight.directSpecular*=mix(.09,1.,cloudSun);`
          );
      };
      mat.customProgramCacheKey = () => key + '-marine-sun-1';
      mat.needsUpdate = true;
    }
  }
  return { field, view, screen, update, shadeSurfaces, compositeScene, get inLayer() { return inLayer; } };
}
