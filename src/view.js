import * as THREE from 'three';
import { clamp } from './flight.js';
import { FreeCamera } from './free-camera.js';

export const cameraNames = { chase: '机外跟拍', cockpit: '驾驶舱', aerial: '稳定航拍',
  rightWindow: '右侧舷窗', leftWindow: '左侧舷窗' };
export class FlightCamera {
  constructor(camera, aircraft, geo, canvas, obstacleHeight) {
    this.camera = camera;
    this.aircraft = aircraft;
    this.geo = geo;
    this.canvas = canvas;
    this.mode = 'chase';
    this.free = new FreeCamera(camera, geo, obstacleHeight);
    this.pointers = new Map();
    this.look = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.head = new THREE.Quaternion();
    this.turn = new THREE.Euler(0, 0, 0, 'YXZ');
    this.reset(0);
    const pinch = () => {
      const a = [...this.pointers.values()];
      return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    };
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      if (!this.free.active) this.flybySubject = null;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('dragging');
      if (this.pointers.size === 2) this.pinchDistance = pinch();
    });
    canvas.addEventListener('pointermove', (event) => {
      const old = this.pointers.get(event.pointerId);
      if (!old) return;
      const dx = event.clientX - old.x,
        dy = event.clientY - old.y;
      old.x = event.clientX;
      old.y = event.clientY;
      if (this.pointers.size === 2) {
        const next = pinch();
        this.zoom((this.pinchDistance - next) * 5);
        this.pinchDistance = next;
        return;
      }
      const k = event.pointerType === 'touch' ? 0.0054 : 0.0043;
      if (this.free.active) {
        this.free.look(dx * k, dy * k);
        return;
      }
      this.yaw -= dx * k;
      if (this.windowSide) {
        this.yaw = this.windowSide * clamp(this.windowSide * this.yaw, .36, 2.78);
      }
      this.tilt = clamp(
        this.tilt + (this.mode === 'chase' ? -1 : 1) * dy * k,
        this.mode === 'chase' ? -0.32 : -1.47,
        1.43
      );
    });
    const release = (event) => {
      this.pointers.delete(event.pointerId);
      if (!this.pointers.size) canvas.classList.remove('dragging');
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        this.zoom(event.deltaY);
      },
      { passive: false }
    );
    canvas.addEventListener('dblclick', () => this.resetLook());
  }
  get windowSide() {
    return this.mode === 'rightWindow' ? 1 : this.mode === 'leftWindow' ? -1 : 0;
  }
  zoom(delta) {
    if (this.free.active) this.free.zoom(delta);
    else if (this.mode === 'chase') this.distance = clamp(this.distance * Math.exp(delta * 0.0014), this.aircraft?.windowAnchor ? 6.8 : 9, 74);
    else this.fov = clamp(this.fov + delta * 0.035, 28, 88);
  }
  resetLook() {
    if (this.free.active) this.free.resetLook();
    else this.reset(this.lastHeading || 0);
  }
  clearPointers() {
    for (const id of this.pointers.keys())
      if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    this.pointers.clear();
    this.canvas.classList.remove('dragging');
  }
  reset(heading, offset = 0) {
    this.flybySubject = null;
    const jet = !!this.aircraft?.windowAnchor;
    this.yaw = this.mode === 'aerial' ? heading + offset : offset;
    this.tilt = this.mode === 'chase' ? 0.2 : this.mode === 'cockpit' ? -0.07 : -0.19;
    this.distance = 17.2;
    this.fov = this.mode === 'cockpit' ? 67 : 55;
    if (jet && this.mode === 'chase') {
      this.yaw = offset || 1.02;
      this.tilt = .20;
      this.distance = 12.65;
      this.fov = 51;
    }
    if (this.windowSide) {
      this.yaw = this.windowSide * 1.57;
      this.tilt = -.30;
      this.fov = 69;
    }
  }
  setMode(mode, flight) {
    this.camera.getWorldDirection(this.look);
    this.mode = mode;
    this.aircraft.setCameraMode(mode);
    this.reset(flight.heading);
    if (mode === 'aerial') {
      this.yaw = Math.atan2(this.look.x, -this.look.z);
      this.tilt = Math.asin(clamp(this.look.y, -1, 1));
    }
  }
  update(flight) {
    this.lastHeading = flight.heading;
    const camera = this.camera;
    const portrait = clamp((0.92 - camera.aspect) / 0.5, 0, 1);
    if (this.mode === 'chase') {
      const scale = this.aircraft.chaseScale || 1;
      const framing = flight.airliner ? Math.max(1, 1 / camera.aspect) : 1 + .42 * portrait;
      const az = flight.heading + this.yaw,
        d = this.distance * scale * framing,
        planar = Math.cos(this.tilt) * d;
      camera.position.set(
        flight.x - Math.sin(az) * planar,
        flight.altitude + Math.sin(this.tilt) * d + 1.3 * scale,
        flight.z + Math.cos(az) * planar
      );
      camera.position.y = Math.max(
        camera.position.y,
        this.geo.heightAt(camera.position.x, camera.position.z) + 0.75
      );
      this.target.set(
        flight.x + Math.sin(az) * 2.4 * scale,
        flight.altitude + (flight.airliner ? .40 : 1.4) * scale,
        flight.z - Math.cos(az) * 2.4 * scale
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(this.target);
    } else if (this.mode === 'cockpit' || this.windowSide) {
      camera.position.copy(this.windowSide ? this.aircraft.windowAnchor : this.aircraft.cockpitAnchor);
      if (this.windowSide < 0) camera.position.x *= -1;
      camera.position.applyQuaternion(this.aircraft.group.quaternion).add(this.aircraft.group.position);
      this.turn.set(this.tilt, -this.yaw, 0, 'YXZ');
      this.head.setFromEuler(this.turn);
      camera.quaternion.copy(this.aircraft.group.quaternion).multiply(this.head);
    } else {
      camera.position.set(flight.x, flight.altitude + 1.8, flight.z);
      const subject=this.flybySubject;
      if(subject && flight.autopilot && flight.progress<subject.end){
        const dx=subject.x-flight.x,dz=flight.z-subject.z;
        this.yaw=Math.atan2(dx,dz);
        this.tilt=Math.atan2(subject.y-camera.position.y,Math.hypot(dx,dz))-.036;
      } else this.flybySubject=null;
      camera.rotation.set(this.tilt, -this.yaw, 0, 'YXZ');
    }
    camera.getWorldDirection(this.look);
    const near = this.mode === 'cockpit' ? .085 : this.windowSide ? .55 :
      this.free.outdoorNear(camera.position, Math.atan2(this.look.x, -this.look.z));
    const fov = Math.min(94, this.fov + portrait * (this.mode === 'chase' ? 8 : 14));
    if (camera.fov !== fov || camera.near !== near) {
      camera.fov = fov;
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  }
}
