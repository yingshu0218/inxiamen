import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Extract bright surfaces in scene-linear color. Three small buffers spread their
// light over the lens before the final exposure, without re-rendering the city.
export function createNightBloom(renderer, mobile) {
  const supported = renderer.extensions.has('EXT_color_buffer_float');
  const full = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    samples: Math.min(mobile ? 2 : 4, renderer.capabilities.maxSamples),
  });
  const clouded = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  const scales = [4, 12, 32];
  const levels = scales.map(() => new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, depthBuffer: false,
  }));
  const vertexShader = `varying vec2 at;
    void main(){at=uv;gl_Position=vec4(position.xy,0.,1.);}`;
  const blur = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false, vertexShader,
    uniforms: { source: { value: null }, radius: { value: new THREE.Vector2() }, extract: { value: false } },
    fragmentShader: `varying vec2 at;uniform sampler2D source;uniform vec2 radius;uniform bool extract;
      vec3 sampleLight(vec2 xy){
        vec3 c=texture2D(source,xy).rgb;
        float peak=max(c.r,max(c.g,c.b));
        return extract ? c*(max(0.,peak-.22)/(peak+.17)) : c;
      }
      void main(){
        vec3 c=sampleLight(at)*.20;
        c+=.125*(sampleLight(at+vec2(radius.x,0.))+sampleLight(at-vec2(radius.x,0.))
                 +sampleLight(at+vec2(0.,radius.y))+sampleLight(at-vec2(0.,radius.y)));
        c+=.075*(sampleLight(at+radius)+sampleLight(at-radius)
                 +sampleLight(at+vec2(radius.x,-radius.y))+sampleLight(at+vec2(-radius.x,radius.y)));
        gl_FragColor=vec4(c,1.);
      }`,
  });
  const composite = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, vertexShader,
    uniforms: {
      frame: { value: full.texture }, fine: { value: levels[0].texture },
      middle: { value: levels[1].texture }, broad: { value: levels[2].texture },
      amount: { value: 0 },
    },
    fragmentShader: `varying vec2 at;
      uniform sampler2D frame;uniform sampler2D fine;uniform sampler2D middle;uniform sampler2D broad;uniform float amount;
      void main(){
        vec3 glow=.27*texture2D(fine,at).rgb+.51*texture2D(middle,at).rgb+.65*texture2D(broad,at).rgb;
        gl_FragColor=vec4(texture2D(frame,at).rgb+amount*glow,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const quad = new FullScreenQuad(blur);
  const size = new THREE.Vector2(), minSize = new THREE.Vector2(1, 1);
  return function render(scene, camera, darkness, mist, clouds) {
    const bloom = darkness >= .14, depthClouds = clouds.inLayer;
    if (!supported || (!bloom && !depthClouds)) {
      renderer.render(scene, camera);
      return;
    }
    renderer.getSize(size);
    const ratio = Math.min(renderer.getPixelRatio(), mobile ? 1.33 : 1.55, Math.sqrt(2900000 / (size.x * size.y)));
    size.multiplyScalar(ratio).floor().max(minSize);
    if (size.x !== full.width || size.y !== full.height) {
      full.setSize(size.x, size.y);
      scales.forEach((factor, i) => levels[i].setSize(
        Math.max(1, Math.ceil(size.x / factor)), Math.max(1, Math.ceil(size.y / factor))
      ));
    }
    full.resolveDepthBuffer = depthClouds;
    renderer.setRenderTarget(full);
    if (depthClouds) clouds.screen.visible = false;
    try {
      renderer.render(scene, camera);
    } finally {
      clouds.screen.visible = true;
    }
    let frame = full;
    if (depthClouds) {
      if (bloom) clouded.setSize(full.width, full.height);
      renderer.setRenderTarget(bloom ? clouded : null);
      clouds.compositeScene(full);
      if (!bloom) return;
      frame = clouded;
    }
    let source = frame;
    quad.material = blur;
    for (const level of levels) {
      renderer.setRenderTarget(level);
      blur.uniforms.source.value = source.texture;
      blur.uniforms.extract.value = source === frame;
      blur.uniforms.radius.value.set(.70 / level.width, .70 / level.height);
      quad.render(renderer);
      source = level;
    }
    renderer.setRenderTarget(null);
    quad.material = composite;
    composite.uniforms.frame.value = frame.texture;
    composite.uniforms.amount.value = THREE.MathUtils.smoothstep(darkness, .14, .92) * (.66 + .40 * mist);
    quad.render(renderer);
  };
}
