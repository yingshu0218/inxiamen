import * as THREE from 'three';
import { siliReserved } from './sili-layout.js';
import { airportWorksReserved } from './airport-layout.js';
import { landmarkReserved } from './scenery-landmarks.js';
import { oldTownReserved } from './old-town-layout.js';
import { cloudShadowGLSL } from './clouds.js';
import { hubinTrees, plan as hubin } from './hubin-layout.js';

// These positions were sampled from the optical tree cover and cleared of streets and footprints.
// Distant individual crowns use a depth-tested cutout; nearby palms and large banyans remain meshes.
export function addGroves(parent, geo, packed, islandCover, bankTrees, atlas, darkness, frame, obstacles, plantings=[]) {
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  const tileSize = 2050,
    cells = new Map();
  function place(x,y,z,size,form,shade) {
    const cell=Math.floor(x/tileSize)+','+Math.floor(z/tileSize);
    if(!cells.has(cell)) cells.set(cell,{p:[],v:[]});
    const n=cells.get(cell);
    n.p.push(x,y,z);
    n.v.push(size,form,shade);
  }
  const patch=geo.bounds.gulangyuDetail;
  const cityTrees=hubin.groves.flatMap(([x,z,h],i)=>[x,z,(i%4)*256+Math.round(h*8)]);
  const planted=hubinTrees.filter(tree=>!tree[3]).flatMap(([x,z,scale],i)=>[x,z,(i%4)*256+Math.round(scale*53)]);
  for (const locations of [packed,islandCover,bankTrees,cityTrees,planted]) for (let i = 0; i < locations.length; i += 3) {
    const x = locations[i],
      z = locations[i + 1],
      bits = locations[i + 2],
      size = (bits & 255) / 8;
    const island = locations === islandCover;
    if ((bits & 16384) || (!island && x>=patch.xmin && x<=patch.xmax && z>=patch.zmin && z<=patch.zmax)) continue;
    const wet=locations===bankTrees || locations===cityTrees || locations===planted ? geo.waterAt(x,z)!==undefined : geo.coverAt(x,z)===0;
    if (airportWorksReserved(frame,x,z) || (locations!==planted && landmarkReserved(x,z)) || oldTownReserved(x,z) || siliReserved(x,z) || wet
        || obstacles.heightAt(x,z)>geo.heightAt(x,z)+2) continue;
    const h = geo.heightAt(x, z),
      se = Math.abs((Math.sin(x * 17.17 + z * 0.914) * 7819.13) % 1);
    const dx = (geo.heightAt(x + 25, z) - geo.heightAt(x - 25, z)) * 0.02,
      dz = (geo.heightAt(x, z + 25) - geo.heightAt(x, z - 25)) * 0.02;
    const slope = Math.min(1, Math.max(0, (0.29 + 0.88 * dx - 0.44 * dz) / Math.hypot(1, dx, dz)));
    place(x,h,z,size,(bits >> 8) + (island ? 4 : 0),(island ? .37 : .24) + .28*slope + .13*se);
  }
  for(const planting of plantings) place(...planting);
  const uniform = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    { uLeaf: { value: null }, uDark: { value: 0 } },
  ]);
  uniform.uDark = darkness;
  uniform.uLeaf.value = atlas;
  uniform.coverageSamples = { value: false };
  const shader = new THREE.ShaderMaterial({
    uniforms: uniform,
    fog: true,
    alphaToCoverage: true,
    // Coverage selects MSAA samples. Keep their opaque destination alpha so
    // the compositor cannot blend the resolved crown against the page again.
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.ZeroFactor,
    blendEquationAlpha: THREE.MaxEquation,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    side: THREE.DoubleSide,
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      ${cloudShadowGLSL}
      attribute vec3 treeCenter;attribute vec3 form;
      varying vec2 sampleUV;varying float shade;varying float above;varying float eyeDistance;
      void main(){
        vec3 cam=normalize(cameraPosition-treeCenter);
        above=clamp(cam.y,0.,1.);
        float shrub=step(7.5,form.y);
        vec3 center=treeCenter+vec3(0.,mix(.42,.23,shrub)*form.x,0.);
        vec4 mvPosition=modelViewMatrix*vec4(center,1.);
        float width=form.x*(.97+.19*fract(form.y*.373)+step(3.5,form.y)*.22+.16*shrub);
        float height=form.x*mix(1.04,.88,above)*mix(1.,.60,shrub);
        mvPosition.xy+=vec2(position.x*width,(position.y-.40)*height);
        sampleUV=vec2((uv.x+mod(form.y,4.))*.25,mix(uv.y,.32+.68*uv.y,shrub));
        shade=form.z*mix(.76,1.19,directSunAt(treeCenter+vec3(0.,form.x*.65,0.)));eyeDistance=-mvPosition.z;gl_Position=projectionMatrix*mvPosition;
        #include <logdepthbuf_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uLeaf;uniform float uDark;uniform bool coverageSamples;
      varying vec2 sampleUV;varying float shade;varying float above;varying float eyeDistance;
      void main(){
        #include <logdepthbuf_fragment>
        vec4 tree=texture2D(uLeaf,sampleUV);
        float alpha=tree.a*smoothstep(-.06,.03+.21*above*above,sampleUV.y);
        float width=max(fwidth(alpha),.001);
        float coverage=coverageSamples?smoothstep(.36-width*.65,.36+width*.65,alpha):step(.36,alpha);
        if(coverage<.01)discard;
        vec3 sky=mix(vec3(.88,1.015,.92),vec3(.14,.21,.23),uDark);
        float farCrown=smoothstep(420.,1800.,eyeDistance);
        vec3 softLeaf=mix(tree.rgb,vec3(.096,.137,.079),.77*farCrown);
        gl_FragColor=vec4(softLeaf*shade*sky,coverage);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  shader.onBeforeRender = (renderer) => {
    const target = renderer.getRenderTarget();
    const multisampled = target ? target.samples > 1 : renderer.capabilities.samples > 1;
    if (uniform.coverageSamples.value !== multisampled) {
      uniform.coverageSamples.value = multisampled;
      shader.uniformsNeedUpdate = true;
    }
  };
  shader.userData.cloudFoliage = true;
  const positions = [-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0],
    uvs = [0, 0, 1, 0, 1, 1, 0, 1];
  for (const data of cells.values()) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setIndex([0, 1, 3, 1, 2, 3]);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const centers = new THREE.InstancedBufferAttribute(new Float32Array(data.p), 3);
    geometry.setAttribute('treeCenter', centers);
    geometry.setAttribute('form', new THREE.InstancedBufferAttribute(new Float32Array(data.v), 3));
    geometry.instanceCount = data.p.length / 3;
    geometry.boundingBox = new THREE.Box3().setFromBufferAttribute(centers);
    geometry.boundingBox.expandByScalar(30);
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
    const mesh = new THREE.Mesh(geometry, shader);
    mesh.name = '山坡与庭院 · 树冠';
    parent.add(mesh);
  }
  return atlas;
}
