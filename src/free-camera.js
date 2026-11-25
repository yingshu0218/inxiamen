import { Euler, Vector3, MathUtils } from 'three';

const speeds = [1, 4, 12];
const { clamp } = MathUtils;

// Fit the surveyed shoreline by changing the offshore distance at a fixed
// altitude. A higher camera would enter the cloud layer on narrow screens.
export function fitIslandView(position, focusX, focusZ, focusY, fov, aspect, coast) {
  const dx = position.x-focusX, dz = position.z-focusZ, initial = Math.hypot(dx,dz);
  if (initial < 1 || aspect <= 0 || !coast?.length) return;
  const ux = dx/initial, uz = dz/initial, height = position.y-focusY;
  const halfHeight = Math.tan(fov*Math.PI/360)*.93, halfWidth = halfHeight*aspect;
  const fits = run => {
    const range = Math.hypot(run,height), c=run/range, s=height/range;
    return coast.every(([x,z]) => {
      const along=(x-focusX)*ux+(z-focusZ)*uz, across=(x-focusX)*uz-(z-focusZ)*ux;
      const depth=range-along*c+focusY*s;
      return depth>0 && Math.abs(across)<=halfWidth*depth && Math.abs(focusY*c+along*s)<=halfHeight*depth;
    });
  };
  if (fits(initial)) return;
  let near=initial, far=initial*2;
  while (!fits(far)) far*=2;
  for (let i=0;i<12;i++) {
    const mid=(near+far)*.5;
    if (fits(mid)) far=mid; else near=mid;
  }
  position.x=focusX+ux*far;
  position.z=focusZ+uz*far;
}

export class FreeCamera {
  constructor(camera, geo, obstacleHeight = () => 0) {
    this.obstacleHeight = obstacleHeight;
    this.camera = camera;
    this.geo = geo;
    this.angle = new Euler(0, 0, 0, 'YXZ');
    this.reference = this.angle.clone();
    this.position = new Vector3();
    this.motion = new Vector3();
    this.input = { forward: 0, right: 0, up: 0, boost: false };
    this.rate = 1;
    this.speed = 0;
    this.name = null;
  }

  outdoorNear(position, heading, region = this.geo) {
    // Keep nearby facades and ground-level views inside the frustum. From altitude,
    // spend the available 24 depth bits on road paint, shoulders and the waterline.
    const {x, y, z} = position;
    const aheadX = x + 4 * Math.sin(heading), aheadZ = z - 4 * Math.cos(heading);
    const surface = Math.max(region.heightAt(x,z), this.obstacleHeight(x,z),
      this.obstacleHeight(aheadX,aheadZ));
    return .55 + 3.45 * MathUtils.smoothstep(y - surface, 15, 100);
  }

  get heading() { return -this.angle.y; }

  enter(geo = this.geo) {
    this.active = true;
    this.region = geo;
    this.position.copy(this.camera.position);
    this.angle.setFromQuaternion(this.camera.quaternion);
    this.setReference(this.camera.fov, Math.min(.55, this.camera.near));
  }

  leave() {
    this.active = false;
    this.name = null;
    this.speed = 0;
  }

  setReference(fov, near) {
    this.reference.copy(this.angle);
    this.referenceFov = this.fov = fov;
    this.near = near;
  }

  goTo({ position, heading, tilt, fov, name = null }) {
    this.position.copy(position);
    this.angle.set(tilt, -heading, 0, 'YXZ');
    this.name = name;
    this.arrival = position.clone();
    this.setReference(fov, .55);
  }

  resetLook() {
    this.angle.copy(this.reference);
    this.fov = this.referenceFov;
  }

  look(dx, dy) {
    this.angle.set(clamp(this.angle.x + dy, -1.52, 1.47), this.angle.y + dx, 0);
  }

  zoom(delta) {
    this.fov = clamp(this.fov + delta * .035, 24, 94);
  }

  cycleRate() {
    this.rate = speeds[(speeds.indexOf(this.rate) + 1) % speeds.length];
  }

  move(dt) {
    const { forward, right, up, boost } = this.input;
    this.speed = 0;
    if (!dt || !(forward || right || up)) return;
    const sin = Math.sin(this.heading), cos = Math.cos(this.heading);
    this.motion.set(forward * sin + right * cos, up, right * sin - forward * cos);
    this.motion.clampLength(0, 1).multiplyScalar(45 * this.rate * (boost ? 3 : 1) * dt);
    const { x, y, z } = this.position;
    const { bounds, heightAt } = this.region;
    const nextX = clamp(x + this.motion.x, Math.min(x, bounds.xmin), Math.max(x, bounds.xmax));
    const nextZ = clamp(z + this.motion.z, Math.min(z, bounds.zmin), Math.max(z, bounds.zmax));
    const clearance = clamp(y - heightAt(x, z), .45, 2);
    const floor = heightAt(nextX, nextZ) + clearance;
    const nextY = clamp(y + this.motion.y, floor, 4200);
    this.position.set(nextX, nextY, nextZ);
    this.speed = Math.hypot(nextX - x, nextY - y, nextZ - z) / dt;
    if (this.name && this.position.distanceToSquared(this.arrival) > 1800 ** 2) this.name = null;
  }

  apply() {
    const { camera, position, angle, fov } = this;
    const near = this.near < .55 ? this.near : this.outdoorNear(position, this.heading, this.region);
    camera.position.copy(position);
    camera.rotation.copy(angle);
    if (camera.fov !== fov || camera.near !== near) {
      camera.near = near;
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }
}
