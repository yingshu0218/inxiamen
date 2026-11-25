import { MeshBatch } from './scenery-mesh.js';
import { busBody } from './hubin-transit.js';
import { plan as railPlan, stationPoint } from './railway-layout.js';
import { brt, brtStop, transitYardLevels } from './wucun-layout.js';

export function wucunCoaches(parent, geo, material) {
  const batch = new MeshBatch();
  busBody(batch, '#4186b2');
  const prototype = batch.finish(parent, material, '梧村公交场站 · 停靠车辆');
  prototype.removeFromParent();
  prototype.scale.x = 1.17;
  prototype.castShadow = prototype.receiveShadow = true;
  const [, yardLevel] = transitYardLevels(geo);
  const waiting = [0, 2, 3, 5, 7, 10, 12].map(slot => {
    const bus = prototype.clone();
    const [x, z] = stationPoint(140.2 + slot * 8.4, -263.6 - (slot % 3) * .8);
    bus.position.set(x, yardLevel, z);
    bus.rotation.y = -railPlan.angle - Math.PI / 2;
    bus.name = '梧村公交场站 · 停靠车辆';
    parent.add(bus);
    return bus;
  });
  const centre = brt.sample(brtStop);
  return (eye) => {
    const visible = Math.hypot(eye.x - centre.x, eye.z - centre.z) < 2300;
    for (const bus of waiting) bus.visible = visible;
  };
}
