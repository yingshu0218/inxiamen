import * as THREE from 'three';
import { brtLaneWidth, brtLinks, brtRoadHeight, brtRows, brtTurnPoint } from './brt-layout.js';

const headway = 150;
const speed = 13.6;
const acceleration = 1.22, braking = 1.58;
const mod = (value, by) => ((value % by) + by) % by;
const lerp = (a, b, at) => a + (b - a) * at;
const smooth = t => t * t * (3 - 2 * t);
const limits = { wharfIn: 6.7, wharfOut: 6.7 };

function segmentAt(rows, value, property) {
  let start = 0, end = rows.length;
  while (end - start > 1) {
    const middle = Math.floor((start + end) / 2);
    if (rows[middle][property] <= value) start = middle;
    else end = middle;
  }
  return start;
}

// A full cycle starts at the wharf stop, takes one branch and returns via the wharf loop.
function brtTrack(geo, destination) {
  const { wharfIn, wharfOut, xiahe } = brtLinks;
  const data = [], events = [];
  let length = 0, returnAt = 0;
  function append(x, y, z) {
    const last = data.at(-1);
    if (last) {
      const distance = Math.hypot(x - last.x, z - last.z);
      if (distance < .015) return;
      length += distance;
    }
    data.push({ x, y, z, s: length });
  }
  function event(goalSpeed, dwell = 0, name, terminal = false) {
    const last = events.at(-1);
    if (last && length - last.s < .016) {
      last.speed = Math.min(last.speed, goalSpeed);
      return;
    }
    events.push({ speed: goalSpeed, dwell, s: length, name, terminal });
  }
  function drive(link, direction, from = 0, to = link.path.length) {
    const { path } = link;
    const rows = brtRows(path, path.sections(3.6), from, to);
    const marks = new Map();
    for (const stop of link.stops) {
      const side = stop.boarding.find(p => p.side === direction);
      if (!side || side.centre < from || side.centre > to) continue;
      const existing = rows.find(p => Math.abs(p.s - side.centre) < .001);
      marks.set(existing?.s ?? side.centre, { id: stop.id, terminal: link === destination && direction > 0 && stop === link.stops.at(-1) });
      if (!existing) {
        const p = path.sample(side.centre);
        rows.push({ ...p, rx: -p.uz, rz: p.ux, s: side.centre });
      }
    }
    rows.sort((a, b) => direction * (a.s - b.s));
    for (const [i, p] of rows.entries()) {
      const d = link.oneWay ? .78 * Math.min(1, (link.path.length - p.s) / 23, p.s / 9) :
        brtLaneWidth(link, p.s) * direction;
      append(p.x + p.rx * d, brtRoadHeight(geo, link, p.s) + .035, p.z + p.rz * d);
      const mark = marks.get(p.s);
      if (mark) event(0, mark.terminal ? 24 : 9, mark.id, mark.terminal);
      else if (i === 0 || i === rows.length - 1) event(limits[link.id] ?? (link.turn ? 7.6 : 9.4));
    }
  }

  const start = wharfIn.stops[0].boarding[0].centre;
  drive(wharfIn, 1, start);
  drive(wharfOut, 1);
  drive(xiahe, 1);
  drive(destination, 1);
  const deck = brtRoadHeight(geo, destination, destination.path.length) + .035;
  for (let i = 1; i <= 24; i++) {
    const [x, z] = brtTurnPoint(destination, Math.PI * i / 24);
    append(x, deck, z);
    if (i % 6 === 0) event(6.7);
  }
  returnAt = length;
  drive(destination, -1);
  drive(xiahe, -1);
  drive(wharfIn, 1, 0, start);
  // The opening stop owns the dwell. The last entry is its arrival.
  events.at(-1).dwell = 0;

  function sample(distance, out) {
    const s = mod(distance, length);
    const index = segmentAt(data, s, 's');
    const a = data[index], b = data[index + 1] ?? data[0];
    const t = (s - a.s) / (b.s - a.s);
    return out.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
  }
  return { sample, events, returnAt };
}

function schedule({ events, returnAt }) {
  // Clamp boundary speeds in both directions so short turns and stop approaches can be driven continuously.
  for (let i = 1; i < events.length; i++) {
    const a = events[i - 1], b = events[i];
    b.speed = Math.min(b.speed, Math.sqrt(a.speed ** 2 + 2 * acceleration * (b.s - a.s)));
  }
  for (let i = events.length - 2; i >= 0; i--) {
    const a = events[i], b = events[i + 1];
    a.speed = Math.min(a.speed, Math.sqrt(b.speed ** 2 + 2 * braking * (b.s - a.s)));
  }
  const runs = events.slice(1).map((b, i) => {
    const a = events[i], distance = b.s - a.s;
    const peak = Math.min(speed, Math.sqrt((2 * distance * acceleration * braking +
      braking * a.speed ** 2 + acceleration * b.speed ** 2) / (acceleration + braking)));
    const up = (peak - a.speed) / acceleration;
    const down = (peak - b.speed) / braking;
    const climb = (a.speed + peak) * up / 2;
    const steady = Math.max(0, distance - climb - (b.speed + peak) * down / 2) / peak;
    return { up, down, climb, steady, peak, duration: up + steady + down };
  });
  const runTime = runs.reduce((sum, run, i) => sum + run.duration + events[i].dwell, 0);
  // The layover at the outer terminal aligns returns to the same headway as departures.
  const fleet = Math.ceil(runTime / headway), period = fleet * headway;
  events.find(e => e.terminal).dwell += period - runTime;
  const departures = new Map(), phases = [];
  let time = 0;
  for (const [i, run] of runs.entries()) {
    const a = events[i], b = events[i + 1];
    if (a.dwell) {
      phases.push({ time, duration: a.dwell, s: a.s, dwell: true });
      if (!departures.has(a.name)) departures.set(a.name, time);
      time += a.dwell;
    }
    phases.push({ time, s: a.s, startSpeed: a.speed, goal: b.s, ...run });
    time += run.duration;
  }

  function at(value, out) {
    const t = mod(value, period), phase = phases[segmentAt(phases, t, 'time')];
    const elapsed = t - phase.time;
    if (phase.dwell) {
      out.s = phase.s;
      out.opening = Math.min(1, elapsed / .64, (phase.duration - elapsed) / .72);
      out.braking = true;
    } else if (elapsed < phase.up) {
      out.s = phase.s + elapsed * (phase.startSpeed + .5 * acceleration * elapsed);
      out.opening = 0;
      out.braking = false;
    } else if (elapsed < phase.up + phase.steady) {
      out.s = phase.s + phase.climb + phase.peak * (elapsed - phase.up);
      out.opening = 0;
      out.braking = false;
    } else {
      const remaining = Math.max(0, phase.duration - elapsed);
      const nextSpeed = phase.peak - braking * phase.down;
      out.s = phase.goal - remaining * (nextSpeed + .5 * braking * remaining);
      out.opening = 0;
      out.braking = phase.down > 1;
    }
    out.returning = out.s >= returnAt;
  }
  return { at, fleet, period, departures };
}

export function brtService(geo, destination) {
  const track = brtTrack(geo, destination);
  return { ...track, ...schedule(track) };
}

export function addBrtTraffic(parent, geo, factory) {
  const definitions = [
    { name: '快3', label: '前埔枢纽', track: brtLinks.qianpu },
    { name: '快1', label: '厦门北站', track: brtLinks.airport },
  ];
  const lines = definitions.map(options => ({ ...options, service: brtService(geo, options.track) }));
  const tourPhase = lines[0].service.departures.get('wenzao') + 2.1;
  const buses = lines.flatMap(({ name, label, service }, line) =>
    Array.from({ length: service.fleet }, (_, i) => ({
      ...factory.create(parent, name, label, line ? i % 3 !== 1 : i % 3 === 0),
      service, phase: tourPhase + (i + line / 2) * headway, state: {},
    })));

  const probe = new THREE.Vector3();
  return (time, viewer) => {
    for (const bus of buses) {
      const { service, state, group } = bus;
      service.at(time + bus.phase, state);
      service.sample(state.s, probe);
      const distance = (viewer.x - probe.x) ** 2 + (viewer.z - probe.z) ** 2;
      group.visible = distance < 2200 ** 2;
      if (!group.visible) continue;
      const near = distance < 410 ** 2;
      bus.place(state.s, service.sample, near);
      bus.show(state, near);
    }
  };
}
