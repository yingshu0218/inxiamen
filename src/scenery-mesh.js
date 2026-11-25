import { facadeSkyGLSL, curtainWallGLSL } from './broadcast-glass.js';
import * as THREE from 'three';

const colorCache = new Map();
const toColor = (value) => {
  if (value?.isColor) return value;
  if (!colorCache.has(value)) colorCache.set(value, new THREE.Color(value));
  return colorCache.get(value);
};

export const TAU = 2 * Math.PI;
export const litSurface = {
  sunlightStone: 82, sunlightSteel: 83, sunlightTread: 84, sunlightLamp: 85,
  islandHouse: 70, statueStone: 71, sunlightCliff: 72, summitMasonry: 73, monumentStone: 74, monumentFace: 75,
  spine: 9, bridge: 10, road: 11, stone: 12, cable: 18, pylon: 19, glazedTile: 23,
  portico: 24, paleStone: 25, shopfront: 26, office: 27, hallWindow: 28, avenue: 29,
  qilou: 30, carriageway: 31, balustrade: 32, graniteMall: 33, ferryGlass: 34,
  canopyLight: 35, pantile: 36, clockFace: 37, mediaGlass: 38, mediaStone: 39, studioRibbon: 40,
  studioRoof: 41, crownMetal: 42, graniteFacing: 43,
  railGlass: 44, railRoof: 45, railEave: 46, railBallast: 47, railPlaza: 48, streetAsphalt: 49,
  broadcastRoof: 50, ribbedReturn: 51, recessGlass: 52,
  northLanes: 53, northFascia: 54, seaWall: 55, northRail: 56,
  airportConcrete: 57, airportTurf: 58, brtGlass: 59, brtPlatform: 60, brtLight: 61,
  greenGlass: 62,
};
export const geoPoint = (lon, lat) => [(lon - 118.125) * 101220, (24.48 - lat) * 111100];
export const groundY = (geo, x, z) => Math.max(0, geo.heightAt(x, z));
export const mix = (a, b, t) => a + (b - a) * t;
export function randomSource(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function signedArea(points) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return area / 2;
}

export function inRing(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i];
    if (a[1] > z !== b[1] > z && x < (b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) inside = !inside;
  }
  return inside;
}

export function ringRect(x, z, w, d, angle = 0) {
  const co = Math.cos(angle),
    si = Math.sin(angle);
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([u, v]) => [x + co * u - si * v, z + si * u + co * v]);
}

// Facades, roofs, paint and masonry from a whole city sector can share one draw.
export class MeshBatch {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.uvs = [];
    this.surfaces = [];
    this.indices = [];
  }

  face(points, color, style = 0, seed = 0, uvs, normals) {
    const [a, b, c] = points;
    const ax = b[0] - a[0],
      ay = b[1] - a[1],
      az = b[2] - a[2];
    const bx = c[0] - a[0],
      by = c[1] - a[1],
      bz = c[2] - a[2];
    const nx = ay * bz - az * by,
      ny = az * bx - ax * bz,
      nz = ax * by - ay * bx;
    const length = Math.hypot(nx, ny, nz);
    if (length < 1e-5) return;
    const n = [nx / length, ny / length, nz / length],
      first = this.positions.length / 3;
    const crt = toColor(color);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      this.positions.push(p[0], p[1], p[2]);
      const normal = normals?.[i] || n;
      this.normals.push(normal[0], normal[1], normal[2]);
      this.colors.push(Math.round(crt.r * 255), Math.round(crt.g * 255), Math.round(crt.b * 255));
      this.uvs.push(uvs ? uvs[i][0] : p[0], uvs ? uvs[i][1] : p[2]);
      this.surfaces.push(style, seed);
    }
    for (let i = 1; i < points.length - 1; i++) this.indices.push(first, first + i, first + i + 1);
  }

  // Smooth, world-textured surfaces can share vertices along every grid edge.
  indexedSurface(points, normals, triangles, color, style, seed, uvs) {
    const offset=this.positions.length/3, c=toColor(color);
    const rgb=[c.r,c.g,c.b].map(v=>Math.round(255*v));
    for(let i=0;i<points.length;i++) {
      const p=points[i];
      this.positions.push(...p);
      this.normals.push(...normals[i]);
      this.colors.push(...rgb);
      this.uvs.push(uvs[i][0],uvs[i][1]);
      this.surfaces.push(style,seed);
    }
    for(const index of triangles) this.indices.push(offset+index);
  }

  top(points, color, style = 0, seed = 0, uv) {
    // A counter-clockwise ring in the XZ plane has an upward front in Three.js.
    const a = points[0],
      b = points[1],
      c = points[2];
    const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (up < 0) this.face(points.toReversed(), color, style, seed, uv?.toReversed());
    else this.face(points, color, style, seed, uv);
  }

  finish(parent, material, name) {
    if (!this.indices.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Uint8BufferAttribute(this.colors, 3, true));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('surfaceData', new THREE.Float32BufferAttribute(this.surfaces, 2));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  }
}

const makeUV = (len, h) => [
  [0, 0],
  [0, h],
  [len, h],
  [len, 0],
];

function convex(ring) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      c = ring[(i + 2) % ring.length];
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -0.1) return false;
  }
  return true;
}

export function supportsHipRoof(ring) {
  return ring.length<=8 && convex(signedArea(ring)<0?ring.toReversed():ring);
}

export function prism(
  batch,
  input,
  bottom,
  top,
  wall,
  roof,
  style = 0,
  seed = 0,
  ridgeHeight = 0,
  roofStyle = 0,
  holes = []
) {
  const ring = signedArea(input) < 0 ? input.toReversed() : input;
  const inner = holes.map(r => signedArea(r) > 0 ? r.toReversed() : r);
  for (const boundary of [ring, ...inner]) {
    for (let j = 0; j < boundary.length; j++) {
      const a = boundary[j], b = boundary[(j + 1) % boundary.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.1) continue;
      batch.face(
        [[a[0],bottom,a[1]], [a[0],top,a[1]], [b[0],top,b[1]], [b[0],bottom,b[1]]],
        wall, style, seed, makeUV(len, top-bottom)
      );
    }
  }
  if (!roof) return;
  const isConvex = !inner.length && convex(ring);
  if (ridgeHeight > 0 && ring.length <= 8 && isConvex) {
    const mx = ring.reduce((a, p) => a + p[0], 0) / ring.length;
    const mz = ring.reduce((a, p) => a + p[1], 0) / ring.length;
    let ax = 1,
      az = 0,
      longest = 0;
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j],
        b = ring[(j + 1) % ring.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      const l = Math.hypot(dx, dz);
      if (l > longest) {
        longest = l;
        ax = dx / l;
        az = dz / l;
      }
    }
    const projection = ring.map((p) => (p[0] - mx) * ax + (p[1] - mz) * az);
    const depth = Math.min(...projection) * -0.38,
      along = Math.max(...projection) * 0.38;
    const edge = ring.map(([x, z]) => [mx + (x - mx) * 1.055, top, z + (z - mz) * 0.055]);
    const ends = [
      [-depth, top + ridgeHeight],
      [along, top + ridgeHeight],
    ].map(([d, y]) => [mx + ax * d, y, mz + az * d]);
    for (let j = 0; j < ring.length; j++) {
      const k = (j + 1) % ring.length,
        ea = projection[j] < 0 ? 0 : 1,
        eb = projection[k] < 0 ? 0 : 1;
      const verts = ea === eb ? [edge[j], edge[k], ends[ea]] : [edge[j], edge[k], ends[eb], ends[ea]];
      if (roofStyle === litSurface.pantile) {
        const dx=edge[k][0]-edge[j][0], dz=edge[k][2]-edge[j][2], len=Math.hypot(dx,dz);
        const uv=verts.map(p=>[((p[0]-edge[j][0])*dx+(p[2]-edge[j][2])*dz)/len,p[1]-top]);
        batch.top(verts, roof, roofStyle, seed, uv);
      } else batch.top(verts, roof, 5, seed);
    }
  } else if (isConvex) {
    batch.top(
      ring.map(([x, z]) => [x, top, z]),
      roof,
      roofStyle,
      seed
    );
  } else {
    const points = inner.length ? [ring,...inner].flat() : ring;
    const vectors = r => r.map(p => new THREE.Vector2(...p));
    const triangles = THREE.ShapeUtils.triangulateShape(vectors(ring), inner.map(vectors));
    for (const tri of triangles)
      batch.top(
        tri.map((i) => [points[i][0], top, points[i][1]]),
        roof,
        roofStyle,
        seed
      );
  }
}

export function box(batch, x, z, w, d, bottom, top, wall, roof, style = 0, seed = 0, angle = 0) {
  prism(batch, ringRect(x, z, w, d, angle), bottom, top, wall, roof, style, seed);
}

export function cylinder(
  batch,
  x,
  z,
  bottom,
  top,
  rb,
  rt,
  color,
  sides = 12,
  phase = 0,
  topColor = color,
  style = 0
) {
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const a = phase + (TAU * i) / sides,
      b = phase + (TAU * (i + 1)) / sides;
    const p = [x + rb * Math.cos(a), bottom, z + rb * Math.sin(a)],
      q = [x + rt * Math.cos(a), top, z + rt * Math.sin(a)];
    const r = [x + rt * Math.cos(b), top, z + rt * Math.sin(b)],
      s = [x + rb * Math.cos(b), bottom, z + rb * Math.sin(b)];
    if (rt <= 0.001) batch.face([p, q, s], color, style);
    else batch.face([p, q, r, s], color, style);
    ring.push(q);
  }
  if (rt > 0.001) batch.top(ring, topColor);
}

export function archMaterial(darkness, minute, facade) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.76,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  material.name = '海岸建筑表面';
  material.customProgramCacheKey = () => facade ? 'broadcast-curtain-wall' : 'coastal-architecture';
  material.onBeforeCompile = (shader) => {
    if (facade) Object.assign(shader.uniforms, facade);
    shader.uniforms.sceneryDarkness = darkness;
    shader.uniforms.sceneryMinute = minute;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
      attribute vec2 surfaceData;
      varying vec2 surfaceUV; varying vec2 surfaceKind;
      varying vec3 scenePos; varying vec3 sceneNormal;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      surfaceUV=uv; surfaceKind=surfaceData;
      scenePos=(modelMatrix*vec4(transformed,1.)).xyz;
      sceneNormal=normalize(mat3(modelMatrix)*normal);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
      uniform float sceneryDarkness; uniform float sceneryMinute;
      ${facade ? facadeSkyGLSL : ''}
      varying vec2 surfaceUV; varying vec2 surfaceKind;
      varying vec3 scenePos; varying vec3 sceneNormal;
      float shash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float scGauss(float x){return exp(-x*x);}
      float lightLine(float x,float width){
        float footprint=max(.012,fwidth(x)*.52);
        float band=1.-smoothstep(width-footprint,width+footprint,abs(fract(x+.5)-.5));
        return mix(band,width*2.,smoothstep(.18,.57,footprint));
      }
      float normBand(float l,float r,float x,float w){return smoothstep(l-w,l+w,x)*(1.-smoothstep(r-w,r+w,x));}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      float kind=surfaceKind.x; float seed=surfaceKind.y;
      float glass=0.; float lamp=0.; vec3 reflection=vec3(0.);
      vec3 lampTint=vec3(1.35,.69,.28), accent=vec3(0.);
      bool islandHouse=abs(kind-${litSurface.islandHouse}.)<.25;
      if(kind>.5 && kind<4.5 || kind>5.5 && kind<6.5 || abs(kind-20.)<.25 || abs(kind-27.)<.25 || islandHouse) {
        bool curtain=(kind>1.5 && kind<2.5)||(kind>5.5 && kind<6.5)||abs(kind-27.)<.25;
        bool villa=(kind>3.5 && kind<4.5)||islandHouse;
        vec2 scale=curtain ? vec2(2.0,3.85) : villa ? vec2(3.2,3.7) : vec2(3.8,3.1);
        if(kind>2.5 && kind<3.5) scale=vec2(4.8,5.3);
        scale.x*=.84+.38*fract(seed*53.7);
        vec2 q=surfaceUV/scale, fw=fwidth(q), f=fract(q), cell=floor(q);
        float d=1.-smoothstep(.24,1.5,max(fw.x,fw.y));
        vec2 aa=min(fw*.63,vec2(.19))+.009;
        float pane=normBand(curtain?.045:.19,curtain?.955:.81,f.x,aa.x)*normBand(curtain?.11:.27,curtain?.94:.83,f.y,aa.y);
        if(villa) pane*=1.-smoothstep(.77,.89,f.y+abs(f.x-.5)*.34);
        float occupied=shash(cell+vec2(seed*67.13,seed*19.37));
        glass=mix(curtain?.71:.28,pane,d);
        vec3 rd=reflect(normalize(scenePos-cameraPosition),normalize(sceneNormal));
        float glare=pow(max(0.,dot(rd,normalize(vec3(-.87,.13,.45)))),5.);
        reflection=mix(vec3(.21,.36,.46),vec3(.92,.56,.29),glare);
        reflection*=.65+.35*clamp(rd.y*1.8+.4,0.,1.);
        reflection=mix(reflection,vec3(.045,.085,.16),sceneryDarkness*.87);
        vec3 tint=curtain ? mix(diffuseColor.rgb*.72,reflection*(abs(kind-6.)<.25?.57:.80),.49) : mix(diffuseColor.rgb*.28,reflection,.24);
        tint*=.83+.17*mix(.53,occupied,d);
        diffuseColor.rgb=mix(diffuseColor.rgb,tint,glass);
        if(islandHouse) {
          float surround=normBand(.14,.86,f.x,aa.x)*normBand(.23,.89,f.y,aa.y);
          float sill=normBand(.10,.90,f.x,aa.x)*normBand(.19,.25,f.y,aa.y);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.63,.52,.39),d*max(sill,.64*(surround-pane)));
          float shutters=normBand(.30,.46,abs(f.x-.5),aa.x)*normBand(.29,.78,f.y,aa.y);
          vec3 timber=mix(vec3(.095,.142,.108),vec3(.22,.13,.083),step(.54,seed));
          diffuseColor.rgb=mix(diffuseColor.rgb,timber*(.84+.22*lightLine(q.y*20.,.11)),shutters*d*.88);
          diffuseColor.rgb+=vec3(.078,.067,.051)*lightLine(q.y-.035,.035)*d;
        }
        float suite=shash(vec2(floor(cell.x*.27)+seed*17.,cell.y));
        float block=shash(vec2(seed*61.,floor(cell.y*.32)));
        float switchOn=smoothstep(.08+seed*.44,.61+seed*.35,sceneryDarkness);
        float occupiedLight=smoothstep(.54,.68,.54*occupied+.30*suite+.16*block)*(.42+.69*suite);
        float cool=smoothstep(.42,.82,seed*.58+suite*.4+occupied*.13)*(villa?.23:curtain?.92:.67);
        lampTint=mix(vec3(1.65,.73,.26),vec3(.69,1.03,1.24),cool);
        diffuseColor.rgb*=mix(.56,1.,smoothstep(0.,12.,surfaceUV.y));
        if(!curtain) diffuseColor.rgb*=.94+.06*smoothstep(.025,.15,f.y);
        lamp=glass*switchOn*mix((.085+.09*seed)*(.72+.28*block),occupiedLight,d)*(curtain?.84:.75);
        // Window blinds and the lit upper part of an office ceiling break up
        // the broad panes behind the ferry. Blend back to the city treatment
        // beyond the historic waterfront.
        float waterfront=1.-smoothstep(440.,1020.,distance(scenePos.xz,vec2(-5510.,2600.)));
        float blind=smoothstep(.22,.80,suite);
        float inside=mix(.55,.94,smoothstep(.18,.89,f.y))*(1.-.31*blind*(1.-smoothstep(.32,.70,f.y)));
        lamp*=mix(1.,(curtain?.49:.72)*mix(.73,inside,d),waterfront);
        lampTint=mix(lampTint,lampTint*vec3(1.06,.95,.81),waterfront*.66);
        if(kind>5.5 && kind<6.5){
          float height=clamp(surfaceUV.y/284.,0.,1.);
          float angle=surfaceUV.x*.02882;
          float curl=.47+.24*sin(angle+height*2.4+seed);
          float rim=smoothstep(.77,1.,height);
          vec3 teal=mix(vec3(.023,.31,.58),vec3(.04,.71,.78),.5+.5*cos(angle+seed*3.));
          vec3 gold=vec3(2.35,1.04,.30);
          float veins=lightLine(surfaceUV.x/12.11,.060);
          float veil=.053+.19*exp(-abs(height-curl)*7.);
          float thread=exp(-abs(height-curl)*100.);
          accent=(teal*(veil+.74*veins)+gold*(rim*rim*(.19+.68*veins)+thread*.29))*sceneryDarkness;
          lamp*=.23;
        }
      }
      if(abs(kind-9.)<.3) accent=vec3(1.40,.68,.25)*sceneryDarkness;
      if(abs(kind-10.)<.3){
        float pool=.45+.55*pow(.5+.5*cos(surfaceUV.x*.157),2.);
        accent=vec3(1.78,.73,.18)*(.11+.19*pool+.56*smoothstep(.50,.94,surfaceUV.y))*sceneryDarkness;
      }
      if(abs(kind-11.)<.3){
        float pool=pow(.5+.5*cos(surfaceUV.x*.15+surfaceUV.y*.082),2.);
        accent=vec3(.14,.079,.037)*(.25+.75*pool)*seed*sceneryDarkness;
      }
      if(abs(kind-12.)<.3){
        float wash=.38+.62*pow(.5+.5*dot(normalize(sceneNormal),normalize(vec3(-.75,.28,.55))),2.);
        accent=vec3(.82,.37,.10)*wash*sceneryDarkness;
      }
      if(kind>4.5 && kind<5.5) {
        vec2 t=surfaceUV; float ridge=.5+.5*cos(t.x*11.3+t.y*3.7);
        diffuseColor.rgb *= mix(.93,.84+.16*ridge,1.-smoothstep(.13,.75,length(fwidth(t))));
      }
      if(abs(kind-18.)<.25) {
        accent=vec3(2.16,1.34,.57)*sceneryDarkness;
      }
      if(abs(kind-19.)<.25) {
        vec3 n=normalize(sceneNormal);
        float flank=.49+.51*abs(n.z);
        float lift=.61+.39*pow(.5+.5*cos(scenePos.y*.087-1.4),2.);
        accent=mix(vec3(.70,.78,.79),vec3(1.36,1.08,.64),smoothstep(96.,132.,scenePos.y))*flank*lift*sceneryDarkness;
      }
      if(abs(kind-20.)<.25){
        float level=surfaceUV.y/3.05;
        float lip=lightLine(level-.13,.056), depth=lightLine(level-.22,.09);
        float resolved=1.-smoothstep(.18,1.0,fwidth(level));
        float bay=surfaceUV.x/(7.1+3.7*seed)+seed*3.;
        float balcony=1.-smoothstep(.22,.44,abs(fract(bay)-.5));
        diffuseColor.rgb*=mix(.96,1.+(.16+.18*balcony)*lip-(.14+.34*balcony)*depth,resolved);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.71,.83,.86),.27*balcony*glass);
      }
      if(abs(kind-21.)<.25){
        float panel=scenePos.x*.78+scenePos.z*.27;
        float seam=lightLine(panel,.043);
        diffuseColor.rgb*=1.+(.11*seam-.026)*(1.-smoothstep(.1,.72,fwidth(panel)));
      }
      if(abs(kind-22.)<.25){
        vec2 panels=surfaceUV/(4.4+seed*2.6);
        float joins=max(lightLine(panels.x,.012),lightLine(panels.y,.012));
        float detail=1.-smoothstep(.15,.90,max(fwidth(panels.x),fwidth(panels.y)));
        float slab=shash(floor(panels)+seed*67.);
        diffuseColor.rgb*=.99+detail*(.061*(slab-.5)-.095*joins);
      }
      // Qilou window bays use whole floors and bays as UV units. The lintel,
      // gallery void and cornices are geometry; the paired sashes live here.
      if(abs(kind-30.)<.25){
        vec2 fw=min(fwidth(surfaceUV)*.62+.005,vec2(.19));
        vec2 q=fract(surfaceUV), cell=floor(surfaceUV);
        float fade=1.-smoothstep(.20,.92,max(fw.x,fw.y)*1.6);
        float dx=abs(q.x-.5), arch=seed<.62?.10*pow(min(1.,dx/.31),2.):0.;
        float frame=normBand(.15,.85,q.x,fw.x)*normBand(.155,.88-arch,q.y,fw.y);
        float opening=normBand(.195,.805,q.x,fw.x)*normBand(.21,.831-arch,q.y,fw.y);
        float bars=max(1.-smoothstep(.007-fw.x,.015+fw.x,dx),1.-smoothstep(.013-fw.y,.024+fw.y,abs(q.y-.66)));
        float window=opening*(1.-.82*bars);
        float occupied=shash(cell+seed*79.1), sky=clamp(dot(normalize(sceneNormal),vec3(-.81,.1,.52))*.5+.5,0.,1.);
        vec3 stucco=diffuseColor.rgb;
        diffuseColor.rgb=mix(stucco,mix(stucco*.80,vec3(.86,.77,.60),.60),frame*fade);
        diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.052,.077,.078),vec3(.16,.23,.24),sky*(.62+.38*occupied)),mix(.30,window,fade));
        if(seed<.31){
          float shutter=normBand(.15,.29,dx,fw.x)*normBand(.23,.78-arch,q.y,fw.y);
          float slat=lightLine(q.y*12.,.11);
          diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.10,.17,.15),vec3(.19,.24,.18),slat),shutter*fade);
          window*=1.-shutter*fade;
        }
        float cornice=normBand(.10,.15,q.y,fw.y)*normBand(.11,.89,q.x,fw.x);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.63,.49),cornice*.50*fade);
        float wash=.35+.65*pow(1.-q.y,2.);
        accent=(stucco*vec3(.59,.36,.19)*(.25+.65*wash)*(1.-window)+mix(.06,smoothstep(.29,.69,occupied),fade)*window*vec3(1.04,.60,.28))*sceneryDarkness;
      }
      if(abs(kind-31.)<.25){
        float x=surfaceUV.x, edge=abs(x), fw=min(.7,fwidth(x)*.65+.02);
        float border=1.-smoothstep(.07-fw,.07+fw,abs(edge-4.95));
        float lane=1.-smoothstep(.073-fw,.073+fw,abs(edge-1.74));
        float dash=normBand(.12,.58,fract(surfaceUV.y/11.),min(.18,fwidth(surfaceUV.y)/11.));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.65,.62,.51),clamp((border+lane*dash)*.79,0.,1.));
        accent=vec3(.078,.054,.034)*(.24+.76*pow(.5+.5*cos(surfaceUV.y*.143),3.))*sceneryDarkness;
      }
      if(abs(kind-32.)<.25){
        vec2 q=fract(surfaceUV);
        float pier=1.-smoothstep(.09,.16,abs(q.x-.5));
        float rail=max(pier,max(1.-smoothstep(.15,.24,q.y),smoothstep(.75,.84,q.y)));
        if(rail<.45)discard;
        accent=diffuseColor.rgb*vec3(.44,.30,.18)*sceneryDarkness;
      }
      if(abs(kind-33.)<.25){
        vec2 p=surfaceUV/vec2(.94,.60);p.x+=.5*mod(floor(p.y),2.);
        vec2 edge=min(fract(p),1.-fract(p));
        float resolved=1.-smoothstep(.12,.73,max(fwidth(p.x),fwidth(p.y)));
        diffuseColor.rgb*=1.+resolved*(.11*(shash(floor(p))-.5)-.17*(1.-smoothstep(.015,.064,min(edge.x,edge.y))));
        float band=1.-smoothstep(.27,.49,min(mod(surfaceUV.y,21.),21.-mod(surfaceUV.y,21.)));
        diffuseColor.rgb*=1.-.15*band;
        float pool=pow(.5+.5*cos((surfaceUV.y-68.)*.1496),4.);
        accent=vec3(.103,.073,.039)*(.18+.52*pool+.3*smoothstep(2.,8.,abs(surfaceUV.x)))*sceneryDarkness;
      }
      if(abs(kind-34.)<.25){
        float bay=surfaceUV.x/(1.48+seed*.69);
        float mullion=lightLine(bay,.034);
        float occupancy=.5+.5*cos(floor(bay)*1.71+seed*20.);
        float shade=.63+.37*dot(normalize(sceneNormal),normalize(vec3(-.87,.17,.46)));
        vec3 pane=mix(vec3(.037,.087,.093),vec3(.15,.25,.26),shade*(.63+.37*occupancy));
        diffuseColor.rgb=mix(pane,vec3(.43,.48,.46),mullion);
        glass=.46*(1.-mullion);
        accent=mix(vec3(.11,.17,.18),vec3(.92,.64,.32),.28+.63*occupancy)
               *(.46+.24*shade)*(1.-.85*mullion)*sceneryDarkness;
      }
      if(abs(kind-35.)<.25){
        accent=vec3(1.16,.74,.38)*sceneryDarkness;
      }
      if(abs(kind-44.)<.25 || abs(kind-62.)<.25){
        bool greenGlass=kind>60.;
        vec2 cell=surfaceUV/(greenGlass?vec2(1.8,4.2):vec2(2.35,5.8));
        vec2 pane=floor(cell);
        float joint=max(lightLine(cell.x,.021),lightLine(cell.y,.013));
        float variation=shash(pane+seed*19.1);
        vec3 ray=normalize(scenePos-cameraPosition);
        vec3 reflected=reflect(ray,normalize(sceneNormal));
        float sky=smoothstep(-.24,.68,reflected.y);
        vec3 day=mix(vec3(.037,.087,.100),vec3(.16,.29,.34),sky);
        day=mix(day,diffuseColor.rgb*.56,.25)*(.78+.26*variation);
        if(greenGlass){
          float horizon=smoothstep(-.45,.24,reflected.y);
          float cloud=.5+.5*cos(reflected.z*12.5+2.1*sin(reflected.x*9.));
          day=mix(diffuseColor.rgb*.61,vec3(.23,.44,.41),
                  (.16+.61*horizon)*(.77+.23*cloud))*(.88+.17*variation);
        }
        vec3 frame=greenGlass?vec3(.074,.151,.136):vec3(.35,.41,.41);
        diffuseColor.rgb=mix(mix(day,vec3(.032,.072,.080),sceneryDarkness*.73),frame,joint*.74);
        float inside=.35+.43*variation;
        accent=mix(vec3(.074,.175,.194),vec3(.38,.24,.13),smoothstep(.62,.99,variation))*inside*(1.-joint)*sceneryDarkness;
        glass=.69*(1.-joint);
      }
      if(abs(kind-45.)<.25){
        float seam=seed>.4?surfaceUV.y/.66:surfaceUV.x/.78;
        float panel=seed>.4?surfaceUV.x/21.:surfaceUV.y/17.;
        diffuseColor.rgb*=1.-.13*lightLine(seam,.033)-.10*lightLine(panel,.018);
        accent=vec3(.064,.088,.10)*sceneryDarkness;
      }
      if(abs(kind-46.)<.25){
        float wash=.53+.47*pow(.5+.5*cos(scenePos.x*.227+scenePos.z*.161),2.);
        accent=vec3(.76,.43,.13)*sceneryDarkness*wash;
      }
      if(abs(kind-47.)<.25){
        float grain=shash(floor(surfaceUV*2.4));
        float patches=shash(floor(surfaceUV*.085));
        diffuseColor.rgb*=.82+.12*patches+.14*mix(grain,.5,smoothstep(.24,1.6,length(fwidth(surfaceUV))));
      }
      if(abs(kind-48.)<.25){
        vec2 p=scenePos.xz-vec2(-1408.16,1068.11);
        float u=dot(p,vec2(.77022,-.63778)), v=abs(dot(p,vec2(.63778,.77022)));
        vec2 setts=vec2(u,v)/vec2(1.35,.78);
        float joints=max(lightLine(setts.x,.025),lightLine(setts.y,.033));
        diffuseColor.rgb*=1.-.14*joints+.064*(shash(floor(setts))-.5);
        float portal=scGauss((v-103.)/16.)*scGauss(u/52.);
        float lanterns=scGauss((abs(u)-72.)/10.)*scGauss((v-128.)/31.);
        float pools=portal*(.53+.47*pow(.5+.5*cos(u*.36),2.))+.67*lanterns;
        accent=vec3(.31,.196,.091)*pools*sceneryDarkness;
      }
      if(abs(kind-49.)<.25){
        float p=surfaceUV.y;
        float grain=shash(floor(surfaceUV*3.5));
        float seams=lightLine(p/24.,.012);
        diffuseColor.rgb*=.95+.061*mix(grain,.5,smoothstep(.18,1.25,length(fwidth(surfaceUV))))-.06*seams;
        accent=vec3(.091,.063,.039)*(.24+.44*pow(.5+.5*cos(p*.119),3.))*sceneryDarkness;
      }
      if(abs(kind-53.)<.25){
        float x=surfaceUV.x, d=surfaceUV.y;
        float aa=max(.011,fwidth(x)*.66);
        float edge=min(x,seed-x);
        float stripe=1.-smoothstep(.035-aa,.035+aa,edge);
        float inset=smoothstep(.05,.15,edge);
        float dashes=lightLine(x,.021)*lightLine((d-.8)/15.,.19)*inset;
        float detail=1.-smoothstep(.20,.50,aa);
        float marking=(stripe*.84+dashes*.69)*detail;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.59,.57,.50),marking);
        float pool=.43+.57*pow(.5+.5*cos(d*.13),2.);
        float seam=lightLine(d/51.,.004);
        diffuseColor.rgb*=.98-.12*seam;
        accent=vec3(.096,.067,.043)*pool*sceneryDarkness*(.72+.42*marking);
      }
      if(abs(kind-54.)<.25){
        vec3 tint=seed<1.5?vec3(.19,.51,.58):seed<2.5?vec3(.70,.395,.165):
          seed<3.5?vec3(.49,.32,.16):vec3(.19,.36,.40);
        float band=smoothstep(.35,.95,surfaceUV.y);
        float wash=.42+.58*pow(.5+.5*cos(surfaceUV.x*.134),2.);
        accent=tint*(.064+.26*band+.12*wash)*sceneryDarkness;
      }
      if(abs(kind-55.)<.25){
        vec2 s=vec2(scenePos.x+scenePos.z*.6,scenePos.y);
        vec2 cell=s/vec2(2.3,1.14), edge=fwidth(cell);
        float rocks=shash(floor(cell+vec2(.45*floor(cell.y),0.)));
        float gaps=lightLine(cell.y,.045)*.72+lightLine(cell.x+.45*floor(cell.y),.046);
        float resolved=1.-smoothstep(.14,.83,length(edge));
        float dry=smoothstep(.03,2.1,scenePos.y);
        diffuseColor.rgb*=mix(.54,1.06,dry)*mix(.90,.80+.22*rocks-.16*gaps,resolved);
      }
      if(abs(kind-56.)<.25){
        float pair=abs(abs(surfaceUV.x)-2.37);
        float aa=max(.009,fwidth(pair)*.62);
        float focus=1.-smoothstep(.24,.83,aa);
        float rail=(1.-smoothstep(.068-aa,.068+aa,abs(pair-.717)))*focus;
        float tie=lightLine(surfaceUV.y/.74,.14)*(1.-smoothstep(1.24-aa,1.24+aa,pair));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.105,.089,.066),tie*.64);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.53,.54,.50),rail*.85);
      }
      if(abs(kind-57.)<.25){
        vec2 p=surfaceUV, cell=p/vec2(6.1,6.8), fw=fwidth(cell);
        float resolved=1.-smoothstep(.16,.85,max(fw.x,fw.y));
        float joints=max(lightLine(cell.x,.011),lightLine(cell.y,.012));
        float panel=shash(floor(cell)+seed*29.);
        float patches=.5+.28*cos(p.x*.026+p.y*.014)*cos(p.y*.019)+.22*cos(p.x*.069-p.y*.043);
        float grain=shash(floor(p*6.));
        float bay=abs(fract((p.y-18.)/58.+.5)-.5)*58.;
        float wear=scGauss((p.x-398.)/53.)*scGauss(bay/14.)*smoothstep(72.,154.,p.y)
                 *(1.-smoothstep(1960.,2040.,p.y));
        diffuseColor.rgb*=.91+.13*patches-.13*wear+resolved*(.062*(panel-.5)+.063*(grain-.5)-.19*joints);
        float t3=scGauss((p.x-430.)/54.)*smoothstep(712.,795.,p.y)*(1.-smoothstep(1518.,1614.,p.y));
        float t4=scGauss((p.y-2974.)/57.)*smoothstep(310.,358.,p.x)*(1.-smoothstep(609.,651.,p.x));
        float pool=.44+.56*pow(.5+.5*cos(p.y*.037+p.x*.061),2.);
        accent=vec3(.31,.19,.08)*max(t3,t4)*pool*sceneryDarkness;
      }
      if(abs(kind-58.)<.25){
        vec2 p=surfaceUV;
        float mowing=.5+.5*cos(p.x*.29+p.y*.004);
        float dry=.55+.31*cos(p.y*.019+p.x*.12)*sin(p.x*.027)+.14*cos(p.y*.053-p.x*.11);
        float fine=shash(floor(p*2.3));
        diffuseColor.rgb*=.82+.22*dry+.072*mowing+.11*(fine-.5)*(1.-smoothstep(.14,.83,length(fwidth(p))));
      }
      if(abs(kind-59.)<.25){
        vec3 ray=normalize(scenePos-cameraPosition), n=normalize(sceneNormal);
        vec3 refl=reflect(ray,n);
        float sky=smoothstep(-.08,.48,refl.y), glancing=1.-abs(dot(ray,n));
        vec3 pane=mix(vec3(.021,.035,.044),vec3(.127,.208,.25),sky*(.48+.52*glancing));
        diffuseColor.rgb=mix(pane,vec3(.020,.038,.049),sceneryDarkness*.76);
        accent=vec3(.083,.112,.113)*(.48+.28*sky)*sceneryDarkness;
        glass=.63;
      }
      if(abs(kind-60.)<.25){
        vec2 p=surfaceUV/vec2(.45,.65);
        float edge=max(lightLine(p.x,.017),lightLine(p.y,.016));
        vec2 bumps=fract(surfaceUV/.077+.5)-.5;
        float studs=(1.-smoothstep(.16,.34,length(bumps)))*(1.-smoothstep(.025,.09,length(fwidth(surfaceUV))));
        diffuseColor.rgb*=.98-.21*edge+.081*(shash(floor(p))-.5);
        diffuseColor.rgb*=1.+.26*studs*step(.5,seed);
        accent=vec3(.078,.108,.109)*sceneryDarkness;
      }
      if(abs(kind-61.)<.25){
        accent=vec3(.57,.81,.91)*sceneryDarkness;
      }
      bool monumentFace=abs(kind-${litSurface.monumentFace}.)<.25;
      if(monumentFace || abs(kind-${litSurface.monumentStone}.)<.25){
        vec2 grainUV=surfaceUV*83.;
        float grain=shash(floor(grainUV))-.5;
        float weather=cos(scenePos.y*1.64+surfaceUV.x*.47)*sin(surfaceUV.x*1.27);
        diffuseColor.rgb*=1.+.08*grain*(1.-smoothstep(.25,1.1,length(fwidth(grainUV))))+.048*weather;
        if(seed>.5){
          vec2 tiles=surfaceUV/(seed<1.5?vec2(1.16,.69):vec2(2.32,3.28));
          float seams=max(lightLine(tiles.x,.011),lightLine(tiles.y,.015));
          diffuseColor.rgb*=1.-.12*seams+.045*(shash(floor(tiles))-.5);
        }
        // The lettering and the surrounding stone receive the same road-light spill.
        if(monumentFace){
          float spill=.42+.58*exp(-abs(surfaceUV.x)*.15);
          accent=diffuseColor.rgb*vec3(.31,.24,.17)*sceneryDarkness*spill;
        }
      }
      if(abs(kind-36.)<.25){
        vec2 tile=surfaceUV/vec2(.22,.125);
        vec2 width=fwidth(tile);
        float rolled=cos(6.28318*tile.x)*(1.-smoothstep(.19,.87,width.x));
        float lap=lightLine(tile.y,.055)*(1.-smoothstep(.18,.92,width.y));
        float weather=.5+.5*sin(surfaceUV.x*.91+seed*37.)*cos(surfaceUV.y*1.8+seed*19.);
        diffuseColor.rgb*=.91+.13*rolled-.13*lap+.13*weather;
      }
      ${facade ? curtainWallGLSL : ''}
      if(abs(kind-39.)<.25 || abs(kind-40.)<.25){
        bool studio=kind>39.5;
        vec2 cell=surfaceUV/(studio?vec2(2.6,4.45):vec2(3.0,3.74)), q=fract(cell);
        vec2 aa=clamp(fwidth(cell)*.56,vec2(.008),vec2(.24));
        float detail=1.-smoothstep(.20,1.,max(fwidth(cell.x),fwidth(cell.y)));
        float window=studio ? normBand(.30,.69,q.y,aa.y)*(1.-.74*lightLine(cell.x,.017))
                            : normBand(.24,.75,q.x,aa.x)*normBand(.20,.67,q.y,aa.y);
        float mask=mix(studio?.36:.234,window,detail);
        float cuts=max(lightLine(cell.x*2.,.012),lightLine(cell.y*2.,.014));
        float room=shash(floor(cell)+seed*39.);
        vec3 pane=mix(vec3(.040,.082,.091),vec3(.17,.29,.32),studio?.62+.20*room:room*.68);
        diffuseColor.rgb=mix(diffuseColor.rgb*(1.-cuts*.19),pane,mask);
        glass=.41*mask;
        vec3 wallLight=vec3(.099,.092,.077)*(.53+.47*abs(normalize(sceneNormal).z));
        accent=mix(wallLight,mix(vec3(.018,.043,.051),vec3(.72,.54,.31),smoothstep(.53,.9,room)),mask)*sceneryDarkness;
      }
      if(abs(kind-41.)<.25){
        vec2 p=vec2(.958*scenePos.x-.287*scenePos.z,.287*scenePos.x+.958*scenePos.z);
        float sheet=lightLine(p.x/.89,.020), seam=lightLine(p.y/6.,.012);
        float rain=.5+.5*cos(p.x*.21+1.2*sin(p.y*.17));
        diffuseColor.rgb*=.92+.109*rain+.096*sheet-.15*seam;
      }
      if(abs(kind-42.)<.25){
        float panel=max(lightLine(surfaceUV.x/1.34,.012),lightLine(surfaceUV.y/2.74,.012));
        diffuseColor.rgb*=.98-.115*panel;
        float wash=.53+.47*max(0.,dot(normalize(sceneNormal),normalize(vec3(-.65,.27,.71))));
        accent=diffuseColor.rgb*mix(vec3(.18,.21,.22),vec3(.56,.49,.38),wash)*wash*sceneryDarkness;
      }
      if(abs(kind-37.)<.25){
        vec2 p=surfaceUV*2.-1.;
        float r=length(p), feather=clamp(fwidth(r),.013,.14);
        float disc=1.-smoothstep(.92-feather,.92+feather,r);
        float bezel=1.-smoothstep(.034,.034+feather,abs(r-.89));
        float theta=atan(p.x,p.y);
        float marks=lightLine(theta*1.90986,.065)*normBand(.66,.80,r,feather);
        vec2 angles=sceneryMinute*vec2(.104719755,.008726646);
        vec2 m=vec2(sin(angles.x),cos(angles.x))*.68, h=vec2(sin(angles.y),cos(angles.y))*.47;
        float dm=length(p-m*clamp(dot(p,m)/dot(m,m),0.,1.));
        float dh=length(p-h*clamp(dot(p,h)/dot(h,h),0.,1.));
        float faceInk=max(marks,max(1.-smoothstep(.026,.026+feather,dm),1.-smoothstep(.043,.043+feather,dh)));
        vec3 dial=mix(vec3(.041,.047,.045),vec3(.91,.86,.72),faceInk);
        diffuseColor.rgb=mix(diffuseColor.rgb,mix(dial,vec3(.55,.53,.42),bezel),disc);
        accent=(vec3(.074,.068,.053)+vec3(1.03,.80,.46)*faceInk+.09*bezel)*sceneryDarkness;
      }
      if(abs(kind-26.)<.25){
        float podium=1.-smoothstep(5.5,6.4,surfaceUV.y);
        float ribbon=lightLine((surfaceUV.y-2.1)/4.65,.18);
        float frames=lightLine(surfaceUV.x/4.6,.026);
        float pane=mix(.46*ribbon,.88,podium)*(1.-frames);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.105,.16,.17),pane);
        float shop=.5+.5*cos(floor(surfaceUV.x/11.5)*3.14+seed*62.);
        accent=mix(vec3(.058,.064,.060),vec3(.74,.39,.16),podium)*pane*(.47+.53*shop)*sceneryDarkness;
      }
      if(abs(kind-27.)<.25){
        float fin=lightLine(surfaceUV.x/(7.8+seed*4.),.046);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.28,.30,.285),fin*.62);
        accent=vec3(.054,.113,.142)*fin*sceneryDarkness;
      }
      if(abs(kind-29.)<.25){
        float width=max(.005,fwidth(surfaceUV.x)*.65);
        float centre=1.-smoothstep(.016-width,.016+width,abs(surfaceUV.x));
        float marker=1.-smoothstep(.014-width,.014+width,abs(abs(surfaceUV.x)-.51));
        float dash=lightLine(surfaceUV.y/12.,.18);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.59,.48,.28),.56*centre*step(2.5,seed));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.67,.65,.55),.66*dash*marker*step(3.5,seed));
        float pool=pow(.5+.5*cos(surfaceUV.y*.143),2.);
        accent=vec3(.068,.047,.027)*(.28+.42*pool)*sceneryDarkness;
      }
      if(abs(kind-23.)<.25){
        vec3 n=normalize(sceneNormal);
        float eave=.30+.70*clamp(dot(n,normalize(vec3(-.41,.23,.89))),0.,1.);
        accent=(diffuseColor.rgb*vec3(.55,.40,.28)+vec3(.035,.022,.009))*eave*sceneryDarkness;
      }
      if(abs(kind-24.)<.25){
        vec3 n=normalize(sceneNormal);
        float pool=pow(.5+.5*cos(scenePos.x*.33+scenePos.z*.16),3.);
        accent=(vec3(.068,.032,.012)+diffuseColor.rgb*vec3(.64,.40,.21))*(.36+.64*pool)*(.46+.54*abs(n.z))*sceneryDarkness;
      }
      if(abs(kind-25.)<.25){
        float wash=.5+.5*dot(normalize(sceneNormal),normalize(vec3(-.44,-.26,.85)));
        accent=diffuseColor.rgb*mix(vec3(.09,.105,.115),vec3(.90,.75,.53),wash*wash)*sceneryDarkness;
      }
      if(abs(kind-28.)<.25){
        float suite=.5+.5*cos(floor(scenePos.x*.26+scenePos.z*.08)*1.62);
        accent=vec3(.65,.34,.125)*(.11+.84*suite*suite)*sceneryDarkness;
      }
      if(abs(kind-16.)<.25 || abs(kind-23.)<.25) {
        // Barrel tiles run perpendicular to the ridge and keep a calm average at flight altitude.
        vec2 t=surfaceUV;
        float fade=1.-smoothstep(.085,.70,max(fwidth(t.x),fwidth(t.y)));
        float roll=.5+.5*cos(t.x*17.5);
        vec2 tile=vec2(t.x/.36,t.y/.43);
        float course=(1.-smoothstep(.0,.16,fract(tile.y+.055*cos(tile.x*6.283))));
        float variation=shash(floor(tile)+seed*11.);
        diffuseColor.rgb*=(.935+.09*shash(vec2(floor(t.x*.36),seed*47.))*(1.-smoothstep(.8,2.6,fwidth(t.x))))
            *(1.+fade*(.23*(roll-.5)-.16*course+.105*(variation-.5)));
      }
      if(abs(kind-17.)<.25) {
        vec2 setts=surfaceUV/vec2(1.14,.56);
        setts.x+=.5*mod(floor(setts.y),2.);
        vec2 edge=min(fract(setts),1.-fract(setts));
        float joint=1.-smoothstep(.012,.055,min(edge.x,edge.y));
        float stone=shash(floor(setts));
        float resolved=1.-smoothstep(.10,.58,max(fwidth(surfaceUV.x),fwidth(surfaceUV.y)));
        diffuseColor.rgb*=1.+resolved*(.15*(stone-.5)-.23*joint);
      }
      if(kind>6.5 && kind<7.5) {
        vec2 p=surfaceUV;
        float aggregate=shash(floor(p*4.));
        float fine=1.-smoothstep(.16,1.3,length(fwidth(p)));
        float tires=(scGauss((abs(p.x)-2.8)/2.3)+.27*scGauss((abs(p.x)-6.)/2.))
                   *max(scGauss((p.y-500.)/222.),scGauss((p.y-2810.)/235.));
        float joints=lightLine(p.x/7.45,.006)*.068+lightLine(p.y/69.,.0028)*.042;
        float resurfacing=normBand(1410.,1960.,p.y,10.)*.05+normBand(3060.,3212.,p.y,2.)*.035;
        float fleck=sin(p.y*.051+p.x*.79)*sin(p.x*1.87);
        diffuseColor.rgb*=.93+.12*mix(.5,aggregate,fine)-seed*(tires*(.32+.07*fleck)-resurfacing+joints);
      }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
       roughnessFactor=mix(roughnessFactor,.26,glass);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
       totalEmissiveRadiance+=lampTint*lamp+accent+reflection*glass*(.04+.06*sceneryDarkness);
       if(kind>5.5 && kind<6.5){
         float edgeGold=pow(max(dot(normalize(sceneNormal.xz),normalize(vec2(-.84,.54))),0.),15.);
         totalEmissiveRadiance+=vec3(.17,.060,.016)*edgeGold*(1.-sceneryDarkness);
       }`
      );
  };
  return material;
}

export class ObstacleIndex {
  constructor() {
    this.cells = new Map();
  }
  key(ix, iz) {
    return ix * 2048 + iz;
  }
  add(points, height, holes = []) {
    const xs = points.map((p) => p[0]),
      zs = points.map((p) => p[1]);
    const bounds = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const object = { points, height, bounds, holes };
    for (let x = Math.floor(bounds[0] / 100); x <= Math.floor(bounds[1] / 100); x++)
      for (let z = Math.floor(bounds[2] / 100); z <= Math.floor(bounds[3] / 100); z++) {
        const k = this.key(x, z);
        if (!this.cells.has(k)) this.cells.set(k, []);
        this.cells.get(k).push(object);
      }
  }
  heightAt(x, z) {
    const candidates = this.cells.get(this.key(Math.floor(x / 100), Math.floor(z / 100)));
    if (!candidates) return 0;
    let height = 0;
    for (const { bounds: b, points: p, height: h, holes } of candidates) {
      if (h <= height || x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue;
      if (inRing(x,z,p) && !holes.some(r => inRing(x,z,r))) height = h;
    }
    return height;
  }
}

export class LampBatch {
  constructor() {
    this.positions = [];
    this.colors = [];
    this.strength = [];
  }
  add(x, y, z, color = '#ffe1a3', radius = 2) {
    this.positions.push(x, y, z);
    const c = toColor(color);
    this.colors.push(c.r, c.g, c.b);
    this.strength.push(radius);
  }
  finish(parent, darkness) {
    if (!this.positions.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setAttribute('strength', new THREE.Float32BufferAttribute(this.strength, 1));
    const m = new THREE.ShaderMaterial({
      vertexColors: true,
      transparent: true,
      fog: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), dusk: darkness },
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float strength;
        uniform float dusk; varying vec3 tint; varying float alpha;
        #ifdef FOG_EXP2
        uniform float fogDensity;
        #endif
        void main(){
          vec4 mv=modelViewMatrix*vec4(position,1.);
          gl_Position=projectionMatrix*mv;
          #include <logdepthbuf_vertex>
          float size=clamp(strength*760./max(1.,-mv.z)+2.15*dusk,1.55,18.);
          gl_PointSize=size;
          tint=color;alpha=(.11+1.31*dusk)*(1.-.70*smoothstep(2900.,12000.,-mv.z));
          #ifdef FOG_EXP2
          alpha*=exp(-fogDensity*fogDensity*mv.z*mv.z);
          #endif
        }`,
      fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        varying vec3 tint; varying float alpha;
        void main(){
          #include <logdepthbuf_fragment>
          vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>1.)discard;
          gl_FragColor=vec4(tint*(.28+3.4*exp(-r*11.)),clamp(alpha,0.,1.)*exp(-r*3.3));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const dots = new THREE.Points(g, m);
    dots.name = '跑道、桥面及码头灯';
    dots.renderOrder = 5;
    parent.add(dots);
    return dots;
  }
}
