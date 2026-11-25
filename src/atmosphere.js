import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { clamp, damp } from './flight.js';
import { createClouds, cloudShadowGLSL, cloudViewGLSL } from './clouds.js';
import { lakeGeometry } from './inland-water.js';

const RAD = Math.PI / 180;
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export function clockText(minute) {
  const v = ((Math.floor(minute) % 1440) + 1440) % 1440;
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
}
export function lightPresetMinute(day, preset) {
  if (preset === 'morning') return Math.round(day.sunrise + 165);
  if (preset === 'night') return 20 * 60 + 30;
  if (preset === 'afternoon') return Math.round(day.sunset - 155);
  return Math.round(day.sunset + (preset === 'blue' ? 20 : -45));
}
export function solarDay(date = new Date()) {
  const xiamen = new Date(date.getTime() + 8 * 3600000);
  const dayOfYear =
    1 +
    (Date.UTC(xiamen.getUTCFullYear(), xiamen.getUTCMonth(), xiamen.getUTCDate()) -
      Date.UTC(xiamen.getUTCFullYear(), 0, 1)) /
      86400000;
  const lat = 24.48 * RAD,
    g = (2 * Math.PI * (dayOfYear - 1)) / 365;
  const eq =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const dec =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const noon = 720 - 4 * (118.125 - 120) - eq;
  const range =
    (Math.acos(
      clamp(
        (Math.sin(-0.833 * RAD) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec)),
        -1,
        1
      )
    ) /
      RAD) *
    4;
  return {
    sunset: noon + range,
    sunrise: noon - range,
    direction(minute, out) {
      const h = ((minute - noon) / 4) * RAD,
        cd = Math.cos(dec),
        sd = Math.sin(dec),
        cl = Math.cos(lat),
        sl = Math.sin(lat);
      return out
        .set(-cd * Math.sin(h), sl * sd + cl * cd * Math.cos(h), -(cl * sd - sl * cd * Math.cos(h)))
        .normalize();
    },
  };
}

const skyModel = `
uniform sampler2D tDay; uniform sampler2D tDusk; uniform sampler2D tCloud;
uniform vec3 sunDir; uniform vec3 moonDir; uniform float skyTime; uniform float cloudiness; uniform float mist; uniform float night;
uniform float dusk; uniform vec3 mistColor;
const float PI=3.14159265;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float cityDome(vec3 d,vec2 center,float radius){
  vec2 offset=center-cameraPosition.xz;float dist=length(offset);
  float toward=dot(d.xz,offset/max(dist,1.));
  float facing=mix(.24,1.,smoothstep(-.36,.91,toward));
  return facing*exp(-dist/(radius*3.))*exp(-max(d.y,0.)*(8.+dist/radius));
}
float starField(vec2 uv,vec2 grid){
  vec2 p=uv*grid,cell=mod(floor(p),grid);
  float brightness=hash21(cell+9.54);
  vec2 center=.2+.6*vec2(hash21(cell+31.7),hash21(cell-21.3));
  float radius=mix(.049,.114,smoothstep(.97,1.,brightness));
  vec2 delta=fract(p)-center;
  float pixel=min(.3,max(fwidth(p.x),fwidth(p.y)));
  float area=radius*radius+pixel*pixel*.23;
  return smoothstep(.950,.997,brightness)*exp(-dot(delta,delta)/area)*(radius*radius/area);
}
vec3 moonlight(vec3 d){
  vec3 east=normalize(cross(vec3(0.,1.,0.),moonDir));
  vec3 up=cross(moonDir,east);
  vec2 disc=vec2(dot(d,east),dot(d,up))/.0085;
  float radius=length(disc), angle=length(d-moonDir);
  vec3 halo=vec3(.08,.15,.28)*exp(-angle*19.)+vec3(.23,.32,.45)*exp(-angle*77.);
  if(radius<1.15 && dot(d,moonDir)>0.){
    float edge=1.-smoothstep(.91,1.06,radius);
    float z=sqrt(max(0.,1.-radius*radius));
    float phase=smoothstep(-.08,.37,dot(vec3(disc,z),normalize(vec3(-.57,.19,.72))));
    float maria=.88-.20*exp(-dot(disc-vec2(-.16,.17),disc-vec2(-.16,.17))*19.)
                   -.13*exp(-dot(disc-vec2(.26,-.23),disc-vec2(.26,-.23))*28.);
    halo+=edge*mix(vec3(.14,.19,.25),vec3(2.7,2.78,2.65)*maria,phase);
  }
  return halo*smoothstep(-.012,.07,moonDir.y);
}
vec3 harborSky(vec3 d,float az,float v,float shift,bool showStars){
  float city=min(1.3,cityDome(d,vec2(-3500.,1900.),3900.)+.65*cityDome(d,vec2(-10900.,-3200.),3600.));
  vec2 uv=vec2(fract(az/(2.*PI)+.28+shift),max(.505,v));
  float cloudLuma=dot(texture2D(tCloud,uv).rgb,vec3(.23,.62,.15));
  float cloudMask=clamp((.22+.95*smoothstep(.11,.62,cloudLuma))*cloudiness+mist*.40,0.,1.);
  cloudMask=mix(cloudMask,.985,smoothstep(.65,.94,cloudiness));
  vec3 sky=mix(vec3(.027,.043,.084),vec3(.003,.009,.028),smoothstep(-.02,.62,d.y));
  sky+=vec3(.10,.039,.020)*city*(.57+cloudiness);
  sky+=mix(vec3(.016,.023,.039),vec3(.085,.054,.049),min(city,1.))*cloudMask;
  if(showStars){
    float stars=starField(vec2(fract(az/(2.*PI)+.5),v),vec2(508.,228.));
    sky+=vec3(.72,.84,1.)*stars*smoothstep(.035,.39,d.y)*pow(1.-cloudMask,2.)*(1.-.47*min(1.,city));
    sky+=moonlight(d)*(1.-cloudMask*.91);
  }
  return sky;
}
vec3 skyRadiance(vec3 d,bool showStars){
  float az=atan(d.z,d.x), v=asin(clamp(d.y,-1.0,1.0))/PI+.5;
  float shift=skyTime*.000024, horizon=exp(-6.5*max(0.,d.y));
  float haze=mist*(.20+.68*horizon);
  vec3 nightSky=vec3(0.);
  if(night>.001) nightSky=harborSky(d,az,v,shift,showStars);
  if(night>=.9999) return mix(nightSky,mistColor,haze);
  float u=fract((az-atan(sunDir.z,sunDir.x))/(2.0*PI)+.600);
  vec2 dayUV=vec2(fract(u+shift),clamp(v,.502,.999));
  vec3 evening=texture2D(tDay,dayUV).rgb;
  float bakedDisk=1.-smoothstep(.004,.017,length((dayUV-vec2(.60,.512))*vec2(1.8,1.)));
  evening=mix(evening,texture2D(tDay,dayUV+vec2(.022,0.)).rgb,bakedDisk);
  vec3 twilight=texture2D(tDusk,vec2(fract(u+shift*.65),max(.505,v))).rgb;
  vec3 cumulus=texture2D(tCloud,vec2(fract(u+shift+.16),max(.506,v))).rgb;
  float sunSide=max(0.,dot(d,sunDir));
  float warm=(1.-smoothstep(.12,.52,sunDir.y))*(1.-night);
  evening*=mix(vec3(1.),vec3(1.32,.84,.64),.58*warm);
  evening+=vec3(.36,.092,.012)*pow(sunSide,5.)*horizon*warm;
  vec3 daylight=mix(evening,cumulus*mix(vec3(1.),vec3(1.25,.83,.63),warm),cloudiness*(.47+.22*smoothstep(.15,.55,sunDir.y)));
  daylight=mix(daylight,cumulus,.65*smoothstep(.20,.55,sunDir.y));
  daylight=mix(daylight,twilight,dusk*.88);
  float bluePhase=(sunDir.y+.081)/.071;
  float blueHour=exp(-bluePhase*bluePhase);
  daylight=mix(daylight,mix(vec3(.23,.24,.38),vec3(.029,.069,.19),smoothstep(.0,.52,d.y))
             +vec3(.22,.078,.023)*pow(sunSide,4.)*horizon,.71*blueHour);
  // Above the marine layer the nearby cumulus belongs to the volume below.
  // Keep a clear sky gradient behind its silhouettes and the high ice wisps.
  float aloft=smoothstep(950.,2900.,cameraPosition.y);
  vec3 upper=mix(vec3(.075,.25,.57),vec3(.20,.27,.46),warm);
  vec3 skyline=mix(vec3(.52,.69,.86),vec3(.85,.57,.40),warm*(.48+.52*sunSide));
  vec3 clearSky=mix(upper,skyline,exp(-7.5*max(0.,d.y)));
  float clearAir=max(.60*(1.-smoothstep(.14,.44,cloudiness)),.94*aloft);
  daylight=mix(daylight,clearSky,clearAir*(1.-dusk*.94)*(1.-mist*.72));
  vec3 sky=mix(daylight,nightSky,night);
  float theta=acos(clamp(dot(d,sunDir),-1.,1.));
  float visible=smoothstep(-.021,.015,sunDir.y)*(1.-.76*mist);
  vec3 sunlight=mix(vec3(1.2,.32,.07),vec3(1.36,1.12,.76),smoothstep(-.005,.28,sunDir.y));
  sky+=sunlight*(3.1*(1.-smoothstep(.0060,.0080,theta))+.60*exp(-theta*17.))*visible;
  return mix(sky,mistColor,haze);
}`;

// A repeatable directional wave spectrum. Interpolated, mipmapped slopes keep the
// silhouette of the sunset reflection soft all the way to the horizon.
function waterSlopes() {
  const n = 256,
    data = new Uint8Array(n * n * 4),
    waves = [];
  let seed = 719;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  for (let i = 0; i < 39; i++) {
    const frequency = 1.8 + Math.pow(random(), 1.6) * 31,
      az = -0.72 + (random() - 0.5) * (i % 5 === 0 ? 4 : 1.8);
    const x = Math.round(Math.cos(az) * frequency),
      y = Math.round(Math.sin(az) * frequency);
    const mag = Math.hypot(x, y) || 1;
    waves.push({
      x,
      y,
      phase: random() * Math.PI * 2,
      sx: (x / mag) * (0.056 + 0.052 * random()),
      sy: (y / mag) * (0.056 + 0.052 * random()),
    });
  }
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      let sx = 0,
        sy = 0;
      for (const w of waves) {
        const a = Math.sin(((x * w.x + z * w.y) * Math.PI * 2) / n + w.phase);
        sx += w.sx * a;
        sy += w.sy * a;
      }
      const i = (z * n + x) * 4;
      data[i] = Math.round(127.5 + clamp(sx, -1, 1) * 127.5);
      data[i + 1] = Math.round(127.5 + clamp(sy, -1, 1) * 127.5);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export async function createAtmosphere(scene, geo, renderer) {
  const loader = new THREE.TextureLoader();
  const [clouds, tex] = await Promise.all([createClouds(scene, renderer), Promise.all(
    ['marine-gold', 'marine-dusk', 'marine-cloud'].map((name) =>
      loader.loadAsync('/art/' + name + '.webp')
    )
  )]);
  for (const t of tex) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  tex[0].mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = tex[0];
  const fog = new THREE.FogExp2(0xb9b4ab, 0.000042);
  scene.fog = fog;
  const uniforms = {
    ...clouds.view,
    tDay: { value: tex[0] },
    tDusk: { value: tex[1] },
    tCloud: { value: tex[2] },
    sunDir: { value: new THREE.Vector3() },
    moonDir: { value: new THREE.Vector3() },
    skyTime: { value: 0 },
    cloudiness: { value: 0.36 },
    mist: { value: 0.12 },
    night: { value: 0 },
    dusk: { value: 0 },
    mistColor: { value: new THREE.Color() },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(67000, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms,
      vertexShader:
        'varying vec3 d; void main(){d=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        skyModel + cloudViewGLSL +
        `varying vec3 d;void main(){
    vec3 ray=normalize(d);
    float shafts=texture2D(cloudDepth,airUV(ray)).g;
    gl_FragColor=vec4(skyRadiance(ray,true)+airBeamColor(sunDir)*shafts,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
    })
  );
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  scene.add(sky);
  const { xmin, xmax, zmin, zmax } = geo.bounds;
  const waterUniforms = {
    ...uniforms,
    ...clouds.field,
    shoreMap: { value: geo.coastTexture },
    urbanSurface: { value: geo.urbanSurface },
    urbanBounds: { value: geo.urbanBounds },
    chartBounds: { value: new THREE.Vector4(xmin, zmin, xmax - xmin, zmax - zmin) },
    rough: { value: 0.5 },
    fogDensity: { value: 0 },
    waves: { value: waterSlopes() },
  };
  const waterSky = `
    vec3 reflectedSky(vec3 point, vec3 ray) {
      ray.y=max(.009,ray.y);
      float range=min(46000.,(airBase+airHeight*.32-point.y)/max(.012,ray.y));
      vec2 uv=airUV(normalize(point+ray*range-cloudEye));
      // Filter the premultiplied cloud radiance and coverage together. The azimuth
      // wraps at one turn, so a derivative across that seam takes the shorter arc.
      vec2 dx=dFdx(uv),dy=dFdy(uv);
      dx.x-=round(dx.x); dy.x-=round(dy.x);
      vec2 size=vec2(textureSize(cloudLight,0));
      float footprint=max(length(dx*size),length(dy*size));
      float lod=log2(max(1.,sqrt(footprint*footprint+2.25)));
      vec4 clouds=textureLod(cloudLight,uv,lod);
      return skyRadiance(ray,false)*(1.-clouds.a)+3.*clouds.rgb;
    }`;
  const smallScreen = matchMedia('(pointer:coarse)').matches;
  const mirrorWidth = smallScreen ? 336 : 640, mirrorHeight = smallScreen ? 240 : 390;
  waterUniforms.mirrorTexel = {value: new THREE.Vector2(1/mirrorWidth,1/mirrorHeight)};
  const sea = new Reflector(new THREE.PlaneGeometry(126000, 126000), {
    textureWidth: mirrorWidth,
    textureHeight: mirrorHeight,
    multisample: 0,
    clipBias: 0.00008,
    shader: {
      name: '海上天光与倒影',
      uniforms: { tDiffuse: { value: null }, color: { value: null }, textureMatrix: { value: null } },
      vertexShader: `varying vec3 wp;varying vec4 mirrorCoord;uniform mat4 textureMatrix;
    void main(){vec4 w=modelMatrix*vec4(position,1.);wp=w.xyz;mirrorCoord=textureMatrix*vec4(position,1.);gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader:
        skyModel + cloudViewGLSL + cloudShadowGLSL + waterSky +
        `
    varying vec3 wp; varying vec4 mirrorCoord; uniform sampler2D tDiffuse; uniform sampler2D shoreMap; uniform sampler2D waves; uniform vec4 chartBounds; uniform float rough; uniform float fogDensity;
    uniform sampler2D urbanSurface; uniform vec4 urbanBounds;
    float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
    uniform vec2 mirrorTexel; uniform mat4 textureMatrix;
    // Integrate a rough reflection over its footprint. All taps share one slowly
    // advecting swell; a subpixel cable or window keeps its energy when it moves.
    vec4 harborReflection(vec2 uv,vec2 along,float radius,float lod){
      vec2 leg=along*radius;
      return .32*textureLod(tDiffuse,uv,lod)
        +.24*(textureLod(tDiffuse,uv+.42*leg,lod)+textureLod(tDiffuse,uv-.42*leg,lod))
        +.10*(textureLod(tDiffuse,uv+leg,lod+.38)+textureLod(tDiffuse,uv-leg,lod+.38));
    }
    float harborGlint(vec3 source,vec3 n,vec3 viewDir){
      vec3 light=source-wp;float range=length(light);
      vec3 h=normalize(viewDir+light/max(range,1.));
      return pow(max(dot(n,h),0.),115.)/pow(1.+range*.004,1.65);
    }
    void main(){
      vec3 viewDir=normalize(cameraPosition-wp);
      float dist=distance(cameraPosition,wp); vec2 p=wp.xz;
      vec2 cityUV=(p-urbanBounds.xy)/urbanBounds.zw;
      vec4 hydro=vec4(0.,0.,0.,1.);
      if(all(greaterThanEqual(cityUV,vec2(0.)))&&all(lessThanEqual(cityUV,vec2(1.))))
        hydro=texture2D(urbanSurface,vec2(cityUV.x,1.-cityUV.y));
      float waterClass=hydro.g;
      // Let the opaque bank hide the plane: an oblique ray under the bank
      // intersects water at a different XZ than the terrain mask above it.
      if(waterClass>.76)discard;
      float sheltered=hydro.a<.90 ? 1. : 0.;
      // The ferry basin is behind a vertical seawall. Swell and breaking surf
      // fade towards the berths, while the exposed side of the strait stays open.
      vec2 quayStart=vec2(-5923.,2195.), quaySpan=vec2(918.,1255.);
      float alongQuay=clamp(dot(p-quayStart,quaySpan)/dot(quaySpan,quaySpan),0.,1.);
      float berthWater=1.-smoothstep(65.,222.,length(p-quayStart-alongQuay*quaySpan));
      sheltered=max(sheltered,.94*berthWater);
      float t=skyTime, detail=1.-smoothstep(1300.,11000.,dist);
      float waveGroup=noise2(p*.0027+vec2(t*.003,-t*.002));
      vec2 w0=texture2D(waves,p*.00091+vec2(t*.00053,-t*.00033)).rg*2.-1.;
      vec2 w1=texture2D(waves,p*.0058+vec2(t*.0031,t*.0022)+w0*.05).rg*2.-1.;
      vec2 w2=texture2D(waves,mat2(.71,.70,-.70,.71)*p*.018+vec2(-t*.006,t*.004)).rg*2.-1.;
      vec2 slope=(w0*.105+w1*.084+w2*(.036*detail))*rough*(.78+.44*waveGroup)*mix(1.,.39,sheltered);
      vec3 normal=normalize(vec3(slope.x,1.,slope.y));
      vec3 reflected=reflect(-viewDir,normal); reflected.y=max(.009,reflected.y);
      float fr=.045+.71*pow(1.-clamp(dot(viewDir,normal),0.,1.),3.8);
      vec2 regionUV=(p-chartBounds.xy)/chartBounds.zw;
      float shore=(128.-texture2D(shoreMap,clamp(vec2(regionUV.x,1.-regionUV.y),0.,1.)).r*255.)*2.;
      if(any(lessThan(regionUV,vec2(0.)))||any(greaterThan(regionUV,vec2(1.))))shore=1000.;
      if(shore< -32. && hydro.a>=.90)discard;
      float shallow=1.-smoothstep(10.,285.,shore);
      float daylight=1.-night*.93;
      vec3 base=mix(vec3(.013,.061,.073),vec3(.069,.19,.15),shallow*.67)*daylight;
      base=mix(base,vec3(.033,.103,.091)*daylight,sheltered*.88);
      base*=.90+.15*waveGroup;
      vec3 sky=reflectedSky(wp,reflected);
      float direct=directSunAt(wp);
      base*=mix(.66,1.08,direct);
      vec2 proj=mirrorCoord.xy/mirrorCoord.w;
      vec2 axis=(textureMatrix[2].xy-proj*textureMatrix[2].w)/mirrorTexel;
      vec2 vertical=axis/max(.0001,length(axis)), horizontal=vec2(vertical.y,-vertical.x);
      vec2 radial=viewDir.xz/max(.001,length(viewDir.xz));
      vec2 crosswater=vec2(-radial.y,radial.x);
      vec2 mirrorSwell=(w0+.20*w1)*rough*mix(1.,.40,sheltered);
      proj+=mirrorTexel*(vertical*dot(mirrorSwell,radial)*4.8+horizontal*dot(mirrorSwell,crosswater)*1.4);
      float spread=mix(1.75,5.9,night)*(.88+.30*rough)*(1.-.32*sheltered);
      float lod=mix(.48,1.60,night)+.40*rough-.32*sheltered;
      vec4 mirror=harborReflection(proj,vertical*mirrorTexel,spread,lod);
      float edge=smoothstep(0.,.032,min(min(proj.x,proj.y),min(1.-proj.x,1.-proj.y)));
      // The capture is over transparent black. Its filtered colour already contains coverage.
      sky=sky*(1.-edge*mirror.a)+mirror.rgb*edge;
      vec3 col=base*(1.-fr)+sky*fr;
      col+=max(mirror.rgb-vec3(.075),vec3(0.))*edge*night*.092*(.91+waveGroup*.16);
      vec3 halfDir=normalize(viewDir+sunDir);
      float shiny=pow(max(dot(normal,halfDir),0.),mix(570.,1100.,detail));
      float gleam=shiny*(.53+.68*waveGroup)*smoothstep(-.02,.035,sunDir.y);
      col+=vec3(1.72,.81,.30)*gleam*(1.22-.57*mist)*direct*direct;
      float airPath=(1.-exp(-dist*.00021))*texture2D(cloudDepth,airUV(-viewDir)).g;
      col+=airBeamColor(sunDir)*airPath*.49;
      if(night>.001){
        vec3 glintNormal=normalize(vec3(slope.x*.56,1.,slope.y*.56));
        float harbor=0.;
        if(p.y>1550. && p.y<7400. && p.x< -2200. && p.x> -7800.)
          harbor=harborGlint(vec3(-4322.,9.,4704.),glintNormal,viewDir)
                    +harborGlint(vec3(-4105.,7.,5021.),glintNormal,viewDir)
                    +harborGlint(vec3(-3630.,10.,5030.),glintNormal,viewDir)
                    +harborGlint(vec3(-5764.,10.,2519.),glintNormal,viewDir)
                    +harborGlint(vec3(-5532.,7.,2840.),glintNormal,viewDir);
        if(p.y< -300. && p.y> -3900. && p.x> -7850. && p.x< -3600.)
          harbor+=harborGlint(vec3(-6038.,65.,-1904.),glintNormal,viewDir)
                 +harborGlint(vec3(-5390.,65.,-1889.),glintNormal,viewDir)
                 +.63*harborGlint(vec3(-5714.,57.,-1897.),glintNormal,viewDir);
        col+=vec3(.91,.40,.13)*harbor*night*(.51+.37*waveGroup);
        vec3 lunarHalf=normalize(viewDir+moonDir);
        float lunar=pow(max(dot(glintNormal,lunarHalf),0.),mix(365.,565.,detail));
        col+=vec3(.67,.82,1.0)*lunar*night*smoothstep(.0,.10,moonDir.y)
             *(1.-.80*cloudiness)*(1.-.83*mist)*(.69+.34*waveGroup);
        col+=vec3(.001,.0025,.005)*night*(.6+waveGroup);
      }
      float swell=shore*.37+2.1*sin(p.x*.041+p.y*.024)+t*.72+3.4*noise2(p*.074);
      float crest=pow(.5+.5*cos(swell),8.)*smoothstep(.29,.71,noise2(p*.081+w0*.58));
      col+=vec3(.22,.31,.285)*crest*(1.-smoothstep(2.5,32.,shore))*(1.-sheltered)*(.36+detail*.52)*daylight;
      float haze=1.-exp(-pow(dist*fogDensity*.87,1.52));
      col=mix(col,mistColor,clamp(haze,0.,.94));
      float highHorizon=smoothstep(800.,2300.,cameraPosition.y)*smoothstep(28000.,50000.,dist);
      if(highHorizon>.001)col=mix(col,skyRadiance(-viewDir,false),highHorizon);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
    },
  });
  Object.assign(sea.material.uniforms, waterUniforms);
  const mirrorTexture = sea.getRenderTarget().texture;
  mirrorTexture.generateMipmaps = true;
  mirrorTexture.minFilter = THREE.LinearMipmapLinearFilter;
  if (!renderer.extensions.has('EXT_color_buffer_float'))
    sea.getRenderTarget().texture.type = THREE.UnsignedByteType;
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0.12;
  scene.add(sea);
  const lakes = new THREE.Mesh(lakeGeometry(geo.lakes),new THREE.ShaderMaterial({
    name: '山间水库', uniforms: waterUniforms, side: THREE.DoubleSide,
    vertexShader: `varying vec3 wp;
      void main(){vec4 w=modelMatrix*vec4(position,1.);wp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: skyModel + cloudViewGLSL + cloudShadowGLSL + waterSky + `
      varying vec3 wp;uniform sampler2D waves;uniform float rough;uniform float fogDensity;
      void main(){
        vec2 uv=wp.xz*.0033;
        vec2 ripples=texture2D(waves,uv+skyTime*vec2(.00087,-.00051)).rg*2.-1.;
        vec2 fine=texture2D(waves,uv*4.5+skyTime*vec2(-.0027,.0021)).rg*2.-1.;
        vec2 slope=(ripples*.061+fine*.029)*rough;
        vec3 n=normalize(vec3(slope.x,1.,slope.y)),viewDir=normalize(cameraPosition-wp);
        float fr=.065+.63*pow(1.-clamp(dot(viewDir,n),0.,1.),3.);
        float sun=directSunAt(wp);
        vec3 deep=vec3(.027,.086,.071)*(1.-night*.95)*(.66+.39*sun);
        vec3 col=mix(deep,reflectedSky(wp,reflect(-viewDir,n)),fr);
        float shine=pow(max(0.,dot(n,normalize(viewDir+sunDir))),860.);
        col+=vec3(1.4,.83,.42)*shine*sun*smoothstep(-.01,.055,sunDir.y);
        float dist=distance(wp,cameraPosition);
        col=mix(col,mistColor,min(.94,1.-exp(-pow(dist*fogDensity*.87,1.52))));
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  lakes.name='本岛内陆水库';
  scene.add(lakes);
  const captureMirror = sea.onBeforeRender,
    clearColor = new THREE.Color(),
    lastMirrorPos = new THREE.Vector3();
  const lastMirrorRotation = new THREE.Quaternion();
  let lastMirror = -1,
    mirrorMinute = -2000;
  sea.onBeforeRender = function (r, s, c) {
    const time = uniforms.skyTime.value,
      changedTime = Math.abs(state.minute - mirrorMinute) > 1;
    if (
      !changedTime &&
      time >= lastMirror &&
      time - lastMirror < (smallScreen ? 1/15 : 1/24) &&
      lastMirrorPos.distanceToSquared(c.position) < .0225 &&
      lastMirrorRotation.angleTo(c.quaternion) < .00035
    )
      return;
    lastMirror = time;
    mirrorMinute = state.minute;
    lastMirrorPos.copy(c.position);
    lastMirrorRotation.copy(c.quaternion);
    const clearAlpha = r.getClearAlpha(), showRain = rain.visible, showClouds = clouds.screen.visible;
    r.getClearColor(clearColor);
    r.setClearColor(0x000000, 0);
    sky.visible = false;
    rain.visible = false;
    clouds.screen.visible = false;
    lakes.visible = false;
    captureMirror.call(this, r, s, c);
    r.setClearColor(clearColor, clearAlpha);
    sky.visible = true;
    rain.visible = showRain;
    clouds.screen.visible = showClouds;
    lakes.visible = true;
  };
  const hemi = new THREE.HemisphereLight(0xffe3c5, 0x87949b, 1.28);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffddae, 2.42);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -1550,
    right: 1550,
    top: 1180,
    bottom: -1180,
    near: 12,
    far: 10200,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 0.55;
  renderer.shadowMap.autoUpdate = false;
  let previousShadow = -1,
    shadowMinute = -2000;
  const rainCount = 560,
    rainPositions = new Float32Array(rainCount * 6);
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(
    rainGeometry,
    new THREE.LineBasicMaterial({ color: 0xced6d7, transparent: true, opacity: 0, depthWrite: false })
  );
  rain.frustumCulled = false;
  scene.add(rain);
  const seeds = Float32Array.from({ length: rainCount * 3 }, () => Math.random());
  const day = solarDay(),
    warmFog = new THREE.Color(0xd1b8aa),
    dayFog = new THREE.Color(0xacbfc6),
    nightFog = new THREE.Color(0x313b52),
    blueFog = new THREE.Color(0x7986a8),
    fogTarget = new THREE.Color();
  const forward = new THREE.Vector3(), keyDirection = new THREE.Vector3();
  const state = {
    day,
    minute: day.sunset - 45,
    rate: 3,
    mode: 'natural',
    time: 0,
    cloud: 0.37,
    mist: 0.08,
    rain: 0,
    wind: { x: 0.88, z: -0.48 },
    darkness: 0,
    weather: '晴间多云',
  };
  function update(dt, camera, aircraft, viewer) {
    state.time += dt;
    state.minute = (state.minute + (dt * state.rate) / 60) % 1440;
    const m = state.time;
    const weatherWave = 0.5 + 0.33 * Math.sin(m / 127 - 0.9) + 0.17 * Math.sin(m / 57 + 0.6);
    let cloud = 0.21 + weatherWave * 0.69,
      mist = 0.052 + weatherWave ** 2 * 0.52,
      rainAmt = smooth(0.77, 0.99, weatherWave) * 0.8;
    if (state.mode === 'clear') {
      cloud = 0.12;
      mist = 0.045;
      rainAmt = 0;
    }
    if (state.mode === 'cumulus') {
      cloud = .49;
      mist = .12;
      rainAmt = 0;
    }
    if (state.mode === 'mist') {
      cloud = 0.59;
      mist = 0.85;
      rainAmt = 0;
    }
    if (state.mode === 'rain') {
      cloud = 0.96;
      mist = 0.67;
      rainAmt = 0.93;
    }
    state.cloud = damp(state.cloud, cloud, 0.22, dt);
    state.mist = damp(state.mist, mist, 0.17, dt);
    state.rain = damp(state.rain, rainAmt, 0.2, dt);
    state.weather =
      state.rain > 0.25
        ? '海上阵雨'
        : state.mist > 0.44
          ? '海雾'
          : state.cloud > 0.61
            ? '多云'
            : state.cloud < 0.24
              ? '晴朗'
              : '晴间多云';
    state.wind.x = (0.65 + 0.48 * Math.sin(m / 76)) * (1 + state.rain * 1.8);
    state.wind.z = (-0.46 + 0.36 * Math.sin(m / 92)) * (1 + state.rain * 1.4);
    const sd = day.direction(state.minute, uniforms.sunDir.value),
      night = 1 - smooth(-0.19, -0.006, sd.y);
    const lunarHour = ((state.minute - day.sunset - 34) / 4) * RAD;
    const lunarDec = -12 * RAD, lat = 24.48 * RAD;
    const md = uniforms.moonDir.value.set(
      -Math.cos(lunarDec) * Math.sin(lunarHour),
      Math.sin(lat) * Math.sin(lunarDec) + Math.cos(lat) * Math.cos(lunarDec) * Math.cos(lunarHour),
      Math.sin(lat) * Math.cos(lunarDec) * Math.cos(lunarHour) - Math.cos(lat) * Math.sin(lunarDec)
    );
    const moonStrength = night * smooth(-.012,.12,md.y) * (1 - state.cloud * .64) * (1 - state.mist * .68);
    const dusk = 1 - smooth(-0.12, 0.12, sd.y),
      gold = 1 - smooth(0.09, 0.4, sd.y);
    state.darkness = 1 - smooth(-0.12, 0.045, sd.y);
    clouds.update(dt, camera, state, sd, md, night, aircraft.airliner);
    Object.assign(uniforms.skyTime, { value: m });
    uniforms.cloudiness.value = state.cloud;
    uniforms.mist.value = state.mist;
    uniforms.night.value = night;
    uniforms.dusk.value = dusk;
    fogTarget
      .copy(dayFog)
      .lerp(warmFog, gold * 0.82)
      .lerp(blueFog, .82 * Math.exp(-(((sd.y + .085) / .072) ** 2)))
      .lerp(nightFog, night);
    fogTarget.lerp(dayFog, state.mist * 0.35 * (1 - night));
    fog.color.copy(fogTarget);
    uniforms.mistColor.value.copy(fogTarget);
    fog.density = 0.000072 + state.mist * 0.00019 + state.rain * 0.000058;
    if (aircraft.airliner) fog.density *= 1 - .56 * smooth(430, 2800, camera.position.y);
    waterUniforms.fogDensity.value = fog.density;
    waterUniforms.rough.value = 0.9 + state.cloud * 0.4 + state.rain * 0.52;
    sun.color.setRGB(1 - .53 * night, 0.94 - 0.35 * gold + .09 * night, 0.82 - 0.47 * gold + .65 * night);
    sun.intensity =
      (1.15 + 1.67 * smooth(-0.04, 0.3, sd.y)) * smooth(-0.018, 0.035, sd.y) * (1 - state.rain * 0.62)
      + .57 * moonStrength;
    hemi.color.setRGB(0.9 - 0.07 * gold - night * 0.32, 0.96 - 0.07 * gold - night * 0.2, 1.0);
    hemi.intensity = (1.13 - night * 0.96) * (1 - state.rain * 0.15);
    camera.getWorldDirection(forward);
    const x = viewer.x + forward.x * 500,
      z = viewer.z + forward.z * 500;
    sun.target.position.set(Math.round(x / 16) * 16, geo.heightAt(x, z), Math.round(z / 16) * 16);
    keyDirection.copy(sd).lerp(md, night).normalize();
    sun.position.copy(sun.target.position).addScaledVector(keyDirection, 4900);
    if (m < previousShadow || m - previousShadow > 0.16 || Math.abs(state.minute - shadowMinute) > 0.8) {
      renderer.shadowMap.needsUpdate = true;
      previousShadow = m;
      shadowMinute = state.minute;
    }
    scene.environmentIntensity = (0.63 - night * 0.56) * (1 - state.rain * 0.3);
    sky.position.copy(camera.position);
    geo.uniforms.night.value = state.darkness;
    rain.visible = state.rain > 0.035;
    if (rain.visible) {
      rain.position.copy(camera.position);
      rain.material.opacity = state.rain * 0.38;
      for (let i = 0; i < rainCount; i++) {
        const j = i * 3,
          k = i * 6,
          y = ((((seeds[j + 1] * 60 - m * 24) % 60) + 60) % 60) - 28;
        const x = (seeds[j] - 0.5) * 75 + Math.sin(seeds[j + 2] * 40) * y * 0.08,
          z = (seeds[j + 2] - 0.5) * 76;
        rainPositions.set([x, y, z, x - 0.19, y + 2.5, z + 0.1], k);
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }
  }
  return {
    state,
    clouds,
    update,
    facadeSky: {
      facadeDay: uniforms.tDay, facadeBlue: uniforms.tDusk, facadeCloud: uniforms.tCloud,
      facadeSun: uniforms.sunDir, facadeHaze: uniforms.mistColor, facadeTime: uniforms.skyTime,
      facadeCover: uniforms.cloudiness, facadeMist: uniforms.mist, facadeDusk: uniforms.dusk, facadeNight: uniforms.night,
    },
    shadeSurfaces: clouds.shadeSurfaces,
    reset() {
      state.minute = day.sunset - 45;
      state.time = 0;
      state.cloud = 0.37;
      state.mist = 0.08;
      state.rain = 0;
    },
    sun,
  };
}
