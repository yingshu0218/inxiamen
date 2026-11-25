import { CanvasTexture, Group, MathUtils, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { runway } from './route.js';

function hingeAngle(stops, extension) {
  for (let i = 1; i < stops.length; i++) {
    const [end, angle] = stops[i];
    if (extension <= end) {
      const [start, from] = stops[i - 1];
      return MathUtils.degToRad(MathUtils.lerp(from, angle, (extension - start) / (end - start)));
    }
  }
  return MathUtils.degToRad(stops.at(-1)[1]);
}

export async function createDreamliner() {
  const { scene: group } = await new GLTFLoader().loadAsync('/aircraft/787/dreamliner.glb');
  group.name = '厦门航空 · Boeing 787-9 · B-7838';
  const wings = [], hinges = [], trucks = [], wheels = [], fans = [], reversers = [];
  let beacon, landingLamps;
  group.traverse(part => {
    switch (part.userData.kind) {
      case 'hinge': hinges.push({ part, axis: new Vector3(...part.userData.axis) }); break;
      case 'truck': trucks.push(part); break;
      case 'wheel': wheels.push(part); break;
      case 'fan': fans.push(part); break;
      case 'reverse': reversers.push(part); break;
    }
    if (!part.isMesh) return;
    part.castShadow = true;
    part.receiveShadow = true;
    if (part.morphTargetDictionary?.flex !== undefined) wings.push(part);
    const material = part.material;
    if (material.map) material.map.anisotropy = 4;
    if (material.name === 'Anti-collision') beacon = material;
    if (material.name === 'Landing lamps') landingLamps = material;
  });
  // The distant sun shadow cannot resolve tire contact on the painted pavement.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const fade = context.createRadialGradient(32, 32, 0, 32, 32, 31);
  fade.addColorStop(0, 'rgba(19,25,29,.83)');
  fade.addColorStop(.47, 'rgba(19,25,29,.48)');
  fade.addColorStop(1, 'rgba(19,25,29,0)');
  context.fillStyle = fade;
  context.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas), groundFrame = new Group();
  const footprint = new PlaneGeometry(1, 1);
  for (const [x, z, width, length] of [[-4.89, -.26, 3.4, 4.0], [4.89, -.26, 3.4, 4.0], [0, -26.25, 1.8, 1.65]]) {
    const shadow = new Mesh(footprint, new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, 0, z);
    shadow.scale.set(width, length, 1);
    groundFrame.add(shadow);
  }
  group.add(groundFrame);
  const up = new Vector3(0, 1, 0), steering = new Quaternion(), inverse = new Quaternion();
  let flex = 0, fanSpeed = 0, truckAngle = 0;
  return {
    group, groundClearance: 5.36, chaseScale: 5.8,
    windowAnchor: new Vector3(2.89, 1.05, 17.7),
    setCameraMode(mode) { group.visible = mode !== 'aerial'; },
    update(dt, flight, darkness) {
      if (!group.visible) return;
      const load = flight.grounded ? 0 : .60 + .38 * MathUtils.smoothstep(flight.speed, 68, 115);
      flex = dt ? MathUtils.damp(flex, load, 2.6, dt) : load;
      for (const wing of wings) {
        const weights = wing.morphTargetInfluences, morph = wing.morphTargetDictionary;
        weights[morph.flex] = flex;
        weights[morph.flaps] = flight.flaps;
        weights[morph.spoilers] = flight.spoilers;
      }
      steering.setFromAxisAngle(up, -flight.noseSteering);
      for (const { part, axis } of hinges) {
        part.quaternion.setFromAxisAngle(axis, hingeAngle(part.userData.stops, flight.gear));
        if (part.userData.leg) part.visible = flight.gear > .025;
        if (part.userData.leg === 'NoseGear') part.quaternion.premultiply(steering);
      }
      const truckTarget = flight.grounded ? -flight.pitch : .14 * flight.gear;
      truckAngle = dt ? MathUtils.damp(truckAngle, truckTarget, 7, dt) : truckTarget;
      for (const truck of trucks) truck.rotation.x = truckAngle;
      for (const wheel of wheels) {
        const onGround = wheel.name === 'NoseWheel' ? flight.noseOnGround : flight.grounded;
        if (onGround) wheel.rotation.x = (wheel.rotation.x - dt * flight.speed / wheel.userData.radius) % (2 * Math.PI);
      }
      const targetRpm = flight.arrived ? 0 : 21 + 89 * Math.max(flight.throttle, .85 * flight.reverseThrust);
      fanSpeed = dt ? MathUtils.damp(fanSpeed, targetRpm, 1.3, dt) : targetRpm;
      for (const fan of fans) fan.rotation.z = (fan.rotation.z + dt * fanSpeed) % (2 * Math.PI);
      for (const sleeve of reversers) sleeve.position.z = .78 * flight.reverseThrust;
      const groundY = flight.grounded ? flight.altitude - 5.36 : runway.surfaceHeight;
      const height = flight.altitude - groundY - 5.36;
      groundFrame.visible = height < 5 && flight.gear > .97;
      if (groundFrame.visible) {
        inverse.copy(group.quaternion).invert();
        groundFrame.quaternion.setFromAxisAngle(up, -flight.heading).premultiply(inverse);
        groundFrame.position.set(0, groundY + .095 - flight.altitude, 0).applyQuaternion(inverse);
        for (const shadow of groundFrame.children) {
          const gap = height - Math.sin(flight.pitch) * shadow.position.z;
          shadow.material.opacity = .76 * (1 - MathUtils.smoothstep(gap, 0, 3));
        }
      }
      if (beacon) beacon.emissiveIntensity = flight.elapsed % 1.28 < .11 ? 4 : .08;
      if (landingLamps) landingLamps.emissiveIntensity = flight.gear * (flight.phase === 'parked' ? 0 : 1.5 + darkness * 2);
    },
  };
}
