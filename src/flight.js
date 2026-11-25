import { Vector3 } from 'three';
import {
  runway,
  runwayPoint,
  runwayFrame,
  routePoint,
  routeHeading,
  nearestRoute,
  routeLength,
  approachDistance,
} from './route.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const damp = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
export const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const supportPoint = new Vector3(),
  guidePoint = new Vector3();

export class Flight {
  constructor(geo, scenery, clearance) {
    this.geo = geo;
    this.scenery = scenery;
    this.clearance = clearance;
    this.reset();
  }
  reset() {
    const p = runwayPoint(82);
    Object.assign(this, {
      x: p.x,
      z: p.z,
      altitude: runway.surfaceHeight + this.clearance,
      heading: runway.heading,
      pitch: 0,
      bank: 0,
      speed: 0,
      throttle: 0,
      verticalSpeed: 0,
      grounded: true,
      autopilot: false,
      phase: 'runway',
      progress: 0,
      elapsed: 0,
      km: 0,
      airborneTime: 0,
      arrived: false,
      assisted: false,
    });
  }
  spawnAt(distance) {
    this.reset();
    if (distance <= 0) return;
    const p = routePoint(distance);
    Object.assign(this, {
      x: p.x,
      z: p.z,
      altitude: p.y,
      heading: routeHeading(distance),
      speed: distance >= approachDistance ? 40 : 52,
      throttle: 0.7,
      grounded: false,
      autopilot: true,
      progress: distance,
      phase: distance >= approachDistance ? 'approach' : 'tour',
      airborneTime: 2,
    });
  }
  surface(x, z) {
    return Math.max(0, this.geo.heightAt(x, z), this.scenery.obstacleHeight?.(x, z) || 0);
  }
  toggleAutopilot() {
    if (this.arrived) return;
    this.autopilot = !this.autopilot;
    if (!this.autopilot) return;
    if (this.grounded) {
      this.phase = this.airborneTime > 1 ? 'rollout' : 'runway';
      return;
    }
    const local = nearestRoute(this.x, this.z, this.progress - 1700, this.progress + 2200);
    const runwayLocal = runwayFrame(this.x, this.z);
    const finalAligned =
      runwayLocal.along > runway.length - 400 &&
      runwayLocal.along < runway.length + 4800 &&
      Math.abs(runwayLocal.cross) < 300 &&
      Math.abs(angleDifference(this.heading, runway.heading + Math.PI)) < 0.55;
    const nearest =
      local.gap < 1250
        ? local
        : nearestRoute(this.x, this.z, 600, finalAligned ? routeLength : approachDistance);
    if (finalAligned && this.altitude < 370)
      this.progress = nearestRoute(this.x, this.z, approachDistance, routeLength).distance;
    else this.progress = nearest.distance;
    this.phase = this.progress >= approachDistance - 80 ? 'approach' : 'tour';
  }
  update(dt, input, wind) {
    this.elapsed += dt;
    this.assisted = false;
    if (this.arrived) return;
    if (!this.autopilot) this.throttle = clamp(this.throttle + input.throttle * 0.46 * dt, 0, 1);
    if (this.grounded) this.groundStep(dt, input);
    else this.airStep(dt, input, wind);
    this.km += (this.speed * dt) / 1000;
  }
  groundStep(dt, input) {
    const landing = this.phase === 'rollout';
    if (this.autopilot) this.throttle = damp(this.throttle, landing ? 0 : 1, landing ? 3 : 1.8, dt);
    const steering = this.autopilot ? 0 : input.roll;
    const frame = runwayFrame(this.x, this.z);
    if (this.autopilot) {
      const direction = landing ? Math.sign(Math.cos(this.heading - runway.heading)) : 1;
      const desired =
        runway.heading +
        (direction < 0 ? Math.PI : 0) -
        direction * clamp(frame.cross * 0.031, -0.32, 0.32);
      this.heading += angleDifference(desired, this.heading) * Math.min(1, dt * 2.6);
    } else this.heading += steering * dt * clamp(this.speed * 0.026, 0, 0.55);
    const braking = input.brake || (landing && this.autopilot) ? 6.0 : 0;
    this.speed = clamp(
      this.speed + (this.throttle * 3.9 - 0.24 - this.speed * this.speed * 0.00052 - braking) * dt,
      0,
      72
    );
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z -= Math.cos(this.heading) * this.speed * dt;
    this.altitude = runway.surfaceHeight + this.clearance;
    const rotation = this.autopilot ? 1 : input.pitch;
    this.pitch = damp(
      this.pitch,
      rotation > 0 && this.speed > 22 && !landing ? 0.155 * rotation : 0,
      3,
      dt
    );
    if (this.pitch > 0.07 && this.speed > 25.5 && !landing) {
      this.grounded = false;
      this.phase = 'climb';
      this.altitude += 0.45;
      this.verticalSpeed = 2.8;
      return;
    }
    if (landing && this.speed < 0.45) {
      this.arrived = true;
      this.throttle = 0;
      this.speed = 0;
      this.autopilot = false;
      this.phase = 'parked';
      return;
    }
    const next = runwayFrame(this.x, this.z);
    if (
      Math.abs(next.cross) > runway.width * 0.49 ||
      next.along < 18 ||
      next.along > runway.length - 18
    ) {
      if (!landing && this.speed > 25) {
        this.grounded = false;
        this.pitch = 0.12;
        this.altitude += 1;
        this.verticalSpeed = 3;
        this.phase = 'climb';
      } else {
        const corrected = runwayPoint(clamp(next.along, 19, runway.length - 19));
        const cross = clamp(next.cross, -runway.width * 0.44, runway.width * 0.44);
        this.x = corrected.x - runway.uz * cross;
        this.z = corrected.z + runway.ux * cross;
        this.speed = Math.max(0, this.speed - dt * 4);
        this.assisted = true;
      }
    }
  }
  airStep(dt, input, wind) {
    this.airborneTime += dt;
    let bankTarget = input.roll * 0.82,
      pitchTarget = input.pitch * (input.pitch < 0 ? 0.28 : 0.31);
    let speedTarget = 17 + this.throttle * 51;
    if (this.autopilot) {
      const near = nearestRoute(
        this.x,
        this.z,
        this.progress - 120,
        this.progress + Math.max(850, this.speed * 12)
      );
      this.progress = Math.max(this.progress, near.distance);
      const final = this.progress >= approachDistance - 40;
      this.phase = final ? 'approach' : this.altitude < 125 && this.progress < 2500 ? 'climb' : 'tour';
      const lead = final ? clamp(this.speed * 3.1, 80, 200) : clamp(this.speed * 4.6, 170, 345);
      const guide = routePoint(this.progress + lead, guidePoint);
      const desired = Math.atan2(guide.x - this.x, this.z - guide.z);
      const crosswind = wind.x * Math.cos(desired) + wind.z * Math.sin(desired);
      const correction = final ? clamp(crosswind / Math.max(this.speed, 20), -0.1, 0.1) : 0;
      bankTarget = clamp(angleDifference(desired - correction, this.heading) * 1.8, -0.7, 0.7);
      const ref = runwayFrame(this.x, this.z);
      const glide = final && ref.along < runway.length + 2350 && Math.abs(ref.cross) < 180;
      const ahead = routePoint(this.progress + this.speed * 0.6, supportPoint);
      let targetY = ahead.y;
      if (!glide) {
        const clearance = this.airborneTime < 22 ? clamp(this.airborneTime * 1.6, 3, 45) : 55;
        targetY = Math.max(targetY, this.surface(guide.x, guide.z) + clearance);
      }
      const vs = clamp((targetY - this.altitude) * 0.31, -(final ? 3.3 : 7.5), 9.2);
      pitchTarget = Math.asin(clamp(vs / Math.max(25, this.speed), -0.22, 0.27));
      speedTarget = final
        ? clamp(27 + Math.max(0, ref.along - runway.length) * 0.0045, 27, 46)
        : this.phase === 'climb'
          ? 47
          : 53;
      this.throttle = damp(this.throttle, clamp((speedTarget - 17) / 51, 0, 1), 0.85, dt);
    } else {
      const n = nearestRoute(this.x, this.z, this.progress - 300, this.progress + 1500);
      if (n.gap < 1250) this.progress = n.distance;
      if (this.airborneTime > 14) this.phase = 'tour';
    }
    this.bank = damp(this.bank, bankTarget, 2.0, dt);
    this.pitch = damp(this.pitch, pitchTarget, 1.7, dt);
    this.speed = clamp(this.speed + ((speedTarget - this.speed) * 0.12 - this.pitch * 4.4) * dt, 13, 77);
    this.heading += ((9.81 * Math.tan(this.bank)) / Math.max(this.speed, 19)) * dt;
    const air = this.speed * Math.cos(this.pitch),
      offGround = clamp((this.altitude - runway.elevation - 2) / 40, 0, 1);
    const wx = this.autopilot && this.phase === 'approach' ? 0 : wind.x * offGround;
    const wz = this.autopilot && this.phase === 'approach' ? 0 : wind.z * offGround;
    this.x += (Math.sin(this.heading) * air + wx) * dt;
    this.z += (-Math.cos(this.heading) * air + wz) * dt;
    const stallSink = Math.max(0, 24 - this.speed) * 0.62;
    this.verticalSpeed = damp(
      this.verticalSpeed,
      this.speed * Math.sin(this.pitch) - stallSink,
      1.9,
      dt
    );
    this.altitude += this.verticalSpeed * dt;
    const f = runwayFrame(this.x, this.z);
    const onStrip = Math.abs(f.cross) < runway.width * 0.55 && f.along > 0 && f.along < runway.length;
    const touchdown = runway.surfaceHeight + this.clearance;
    if (
      onStrip &&
      this.airborneTime > 4 &&
      this.altitude < touchdown + 0.28 &&
      this.verticalSpeed < 0.55
    ) {
      this.grounded = true;
      this.altitude = touchdown;
      this.phase = 'rollout';
      this.pitch = 0;
      this.bank = 0;
      this.verticalSpeed = 0;
      if (this.autopilot) this.throttle = 0;
      return;
    }
    if (!onStrip && this.airborneTime > 2.5) {
      const floor = this.surface(this.x, this.z) + this.clearance + 3;
      if (this.altitude < floor) {
        this.altitude = floor;
        this.verticalSpeed = Math.max(1, this.verticalSpeed);
        this.assisted = true;
      }
    }
    this.altitude = clamp(this.altitude, touchdown - 13, 2900);
    const bounds = this.geo.bounds;
    if (
      bounds &&
      (this.x < bounds.xmin + 750 ||
        this.x > bounds.xmax - 750 ||
        this.z < bounds.zmin + 750 ||
        this.z > bounds.zmax - 750)
    ) {
      if (!this.autopilot) this.toggleAutopilot();
      this.assisted = true;
    }
  }
}
