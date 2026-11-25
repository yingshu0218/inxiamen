import { CatmullRomCurve3, MathUtils, Vector2, Vector3 } from 'three';
import { project, runway, runwayPoint } from './route.js';
import { airportFrame, arrivalStandLine, arrivalTaxiExit } from './airport-layout.js';

// CAAC, ZSAM AD2.24-9C / 20A, effective March 2026: the final legs of
// ENVEN-8X and RNAV ILS/DME z RWY05 via AM104. Horizontal positions
// use the same local metre grid as the scenery. Distances follow the flown arcs.
function fix(lon, lat) {
  const { x, z } = project(lon, lat);
  return new Vector2(x, z);
}
function onRunway(along) {
  const p = runwayPoint(along);
  return new Vector2(p.x, p.z);
}
const am715 = fix(117.9795000, 24.9447222);
const xinglin = fix(118.0150000, 24.5650000);
const am104 = fix(117.8895000, 24.4616944);
const am103 = fix(117.9361111, 24.4070556);
const start = xinglin.clone().addScaledVector(am715.clone().sub(xinglin).normalize(), 19400);
const threshold = runway.threshold05Offset;
const finalPoint = onRunway(threshold - 12700);
const exitAlong = arrivalTaxiExit.points[0][0];
const end = onRunway(exitAlong);

const legs = [];
let length = 0, cursor = start;
function straight(to) {
  const dx = to.x - cursor.x, dz = to.y - cursor.y;
  const size = Math.hypot(dx, dz);
  legs.push({ x: cursor.x, z: cursor.y, from: length, size, heading: Math.atan2(dx, -dz), curvature: 0 });
  length += size;
  cursor = to;
}
// A tangent circular arc anticipates each fly-by fix. The long inbound,
// downwind and localizer legs therefore stay straight between the turns.
function turnAt(b, c, radius) {
  const incoming = b.clone().sub(cursor).normalize();
  const outgoing = c.clone().sub(b).normalize();
  const angle = Math.atan2(incoming.cross(outgoing), incoming.dot(outgoing));
  const trim = radius * Math.tan(Math.abs(angle) / 2);
  straight(b.clone().addScaledVector(incoming, -trim));
  const size = radius * Math.abs(angle);
  legs.push({ x: cursor.x, z: cursor.y, from: length, size,
    heading: Math.atan2(incoming.x, -incoming.y), curvature: Math.sign(angle) / radius });
  const abeam = length + size / 2;
  length += size;
  cursor = b.clone().addScaledVector(outgoing, trim);
  return abeam;
}
const overXinglin = turnAt(xinglin, am104, 3400);
const cityEntry = overXinglin - 3600;
const baseLeg = turnAt(am104, am103, 2500);
const intermediate = turnAt(am103, finalPoint, 2300);
turnAt(finalPoint, end, 2400);
straight(end);
const taxiStart = length;
const thresholdDistance = taxiStart - (exitAlong - threshold);
const frame = airportFrame(runway);
const [standS, standR] = arrivalStandLine.at(-1);
const taxiPoints = [arrivalTaxiExit.points[0], [exitAlong + 12, .4], ...arrivalTaxiExit.points.slice(1),
  ...arrivalStandLine.slice(1, -1), [standS, standR - 26.25]];
const taxiCurve = new CatmullRomCurve3(taxiPoints.map(([s, r]) => {
  const [x, z] = frame.world(s, r);
  return new Vector3(x, 0, z);
}));
taxiCurve.arcLengthDivisions = 400;
const taxiLength = taxiCurve.getLength();
const taxiPath = taxiCurve.getSpacedPoints(Math.ceil(taxiLength / 2));
const taxiHeadings = taxiPath.map((_, i) => {
  const a = taxiPath[Math.max(0, i - 1)], b = taxiPath[Math.min(taxiPath.length - 1, i + 1)];
  return Math.atan2(b.x - a.x, a.z - b.z);
});
taxiHeadings[0] = runway.heading;
length += taxiLength;
const slope = Math.tan(MathUtils.degToRad(3));
const flareStart = thresholdDistance - 35;
const referenceHeight = runway.surfaceHeight + 15;
const glideHeight = (d) => referenceHeight + (thresholdDistance - d) * slope;
const glideStart = thresholdDistance - (700 - referenceHeight) / slope;

function track(d, out = {}) {
  if (d >= taxiStart) {
    const u = Math.min(1, (d - taxiStart) / taxiLength) * (taxiPath.length - 1);
    const i = Math.min(Math.floor(u), taxiPath.length - 2), t = u - i;
    const a = taxiPath[i], b = taxiPath[i + 1];
    out.x = MathUtils.lerp(a.x, b.x, t);
    out.z = MathUtils.lerp(a.z, b.z, t);
    out.heading = MathUtils.lerp(taxiHeadings[i], taxiHeadings[i + 1], t);
    return out;
  }
  const leg = legs.find((l) => d <= l.from + l.size) || legs[legs.length - 1];
  const s = MathUtils.clamp(d - leg.from, 0, leg.size);
  const h = leg.heading, k = leg.curvature;
  out.heading = h + s * k;
  out.x = leg.x + (k ? (Math.cos(h) - Math.cos(out.heading)) / k : s * Math.sin(h));
  out.z = leg.z + (k ? (Math.sin(h) - Math.sin(out.heading)) / k : -s * Math.cos(h));
  return out;
}
function profile(d, knots) {
  for (let i = 1; i < knots.length; i++) {
    const [b, y] = knots[i], [a, x] = knots[i - 1];
    if (d <= b) return MathUtils.lerp(x, y, MathUtils.clamp((d - a) / (b - a), 0, 1));
  }
  return knots[knots.length - 1][1];
}
const heights = [[0, 3000], [overXinglin, 1800], [baseLeg, 1200], [intermediate, 900],
  [intermediate + 5400, 700], [glideStart, 700]];
// In metres/second. AM103 and D6.0 IWF are charted at 180 and 160 knots.
const speeds = [[0, 113.18], [overXinglin, 108], [baseLeg, 101], [intermediate, 92.60],
  [thresholdDistance - 10850, 82.31], [thresholdDistance - 4800, 74], [flareStart, 71]];
const taxiSpeeds = [[0, 8.5], [55, 6.0], [110, 6.0], [170, 9.3], [236, 9.3],
  [300, 6.1], [345, 5.2], [402, 6.2], [taxiLength, 4.0]];

function stop(id, name, kind, distance) {
  return { id, name, kind, distance, airliner: true, ...track(distance) };
}
export const arrivalStops = [
  stop('787', '云上进场', '厦门西北 · 3,000 m', 0),
  stop('787-city', '俯瞰厦门本岛', '杏林湾西侧 · 左窗', overXinglin + 1700),
  stop('787-harbor', '海沧湾', '右窗看西港与本岛', thresholdDistance - 8500),
  stop('787-final', '高崎五边', '05 跑道短五边', thresholdDistance - 2350),
  stop('787-taxi', '着陆后滑行', '驶离 05 跑道 · 高崎机坪', taxiStart - 48),
];
export const arrivalMap = Array.from({ length: Math.ceil(length / 250) + 1 }, (_, i) => {
  const p = track(Math.min(i * 250, length));
  return [p.x, p.z];
});

export class AirlinerArrival {
  constructor(clearance) {
    this.airliner = true;
    this.clearance = clearance;
    const ground = runway.surfaceHeight + clearance;
    // This parabola matches the 3-degree slope on entry and is level at contact.
    this.touchdown = flareStart + 2 * (glideHeight(flareStart) - ground) / slope;
    this.deceleration = (71 ** 2 - taxiSpeeds[0][1] ** 2) / (2 * (taxiStart - this.touchdown));
  }
  spawnAt(distance) {
    Object.assign(this, { progress: distance, elapsed: 0, km: 0, arrived: false,
      autopilot: true, assisted: false, playback: 1, bank: 0 });
    this.sample(0);
  }
  heightAt(d) {
    if (d < glideStart) return profile(d, heights);
    if (d < flareStart) return glideHeight(d);
    if (d >= taxiStart) {
      const taxi = d - taxiStart;
      return this.clearance + MathUtils.lerp(runway.surfaceHeight, runway.elevation + .22,
        MathUtils.smoothstep(taxi, 85, 155)) - .07 * MathUtils.smoothstep(taxi, 358, 402);
    }
    const remaining = Math.max(0, this.touchdown - d);
    return runway.surfaceHeight + this.clearance + slope * remaining ** 2 / (2 * (this.touchdown - flareStart));
  }
  update(seconds) {
    if (this.arrived) return;
    const dt = seconds * this.playback;
    const advance = Math.min(length - this.progress, this.speed * dt);
    this.progress += advance;
    this.km += advance / 1000;
    this.elapsed += dt;
    this.sample(dt);
  }
  sample(dt) {
    const d = this.progress;
    track(d, this);
    const taxiDistance = d - taxiStart;
    const onTaxiway = taxiDistance >= 0;
    this.grounded = d >= this.touchdown;
    this.noseOnGround = d >= this.touchdown + 320;
    if (onTaxiway) {
      this.speed = Math.min(profile(taxiDistance, taxiSpeeds), Math.sqrt(1.12 * Math.max(0, length - d)));
    } else if (this.grounded) {
      this.speed = Math.sqrt(taxiSpeeds[0][1] ** 2 + 2 * this.deceleration * (taxiStart - d));
    } else this.speed = profile(d, speeds);
    this.altitude = this.heightAt(d);
    this.verticalSpeed = (this.heightAt(d + 1) - this.altitude) * this.speed;
    const before = track(d - 80), after = track(d + 80);
    const turn = after.heading - before.heading;
    const targetBank = Math.atan(this.speed ** 2 * Math.atan2(Math.sin(turn), Math.cos(turn)) / (160 * 9.81));
    this.bank = this.grounded ? 0 : MathUtils.damp(this.bank, targetBank, .7, dt);
    this.noseSteering = onTaxiway ? Math.atan(25.83 * (track(d + 8).heading - track(d - 8).heading) / 16) : 0;
    const configured = MathUtils.smoothstep(d, intermediate, glideStart);
    this.flaps = (.15 * MathUtils.smoothstep(d, overXinglin, baseLeg) + .85 * configured) *
      (1 - MathUtils.smoothstep(taxiDistance, 24, 155));
    this.gear = MathUtils.smoothstep(d, glideStart + 1300, glideStart + 2400);
    this.pitch = Math.atan2(this.verticalSpeed, this.speed || 1) + MathUtils.degToRad(2.6 + 2.4 * configured);
    if (this.grounded) this.pitch = MathUtils.degToRad(5) * (1 - MathUtils.smoothstep(d, this.touchdown, this.touchdown + 340));
    this.reverseThrust = MathUtils.smoothstep(d - this.touchdown, 45, 220) * MathUtils.smoothstep(this.speed, 17, 34);
    this.spoilers = MathUtils.smoothstep(d - this.touchdown, 0, 70) * MathUtils.smoothstep(this.speed, 8, 17);
    this.throttle = this.grounded ? .045 : .36 - .24 * MathUtils.smoothstep(d, flareStart - 350, this.touchdown);
    if (onTaxiway) {
      const extraThrust = MathUtils.smoothstep(taxiDistance, 75, 115) * (1 - MathUtils.smoothstep(taxiDistance, 155, 195)) +
        .58 * MathUtils.smoothstep(taxiDistance, 329, 352) * (1 - MathUtils.smoothstep(taxiDistance, 376, 406));
      this.throttle = .065 + .26 * extraThrust;
    }
    this.phase = onTaxiway ? 'taxi' : this.grounded ? 'rollout' : d >= flareStart ? 'flare' : d >= glideStart ? 'approach' : 'descent';
    this.cabinStage = d >= this.touchdown + 165 ? 'landed' : d >= glideStart ? 'harbor' :
      d >= cityEntry ? 'city' : 'clouds';
    this.place = d < cityEntry ? '厦门西北上空' : d < overXinglin + 5500 ? '杏林湾西侧' :
      d < baseLeg ? '海沧上空' : d < intermediate + 4500 ? '九龙江口' :
      d < thresholdDistance - 2800 ? '海沧湾进近' : !onTaxiway ? '高崎机场' :
      taxiDistance < 358 ? '高崎机场滑行道' : '高崎机场机坪';
    if (d >= length) {
      this.arrived = true;
      this.throttle = 0;
      this.phase = 'parked';
    }
  }
}
