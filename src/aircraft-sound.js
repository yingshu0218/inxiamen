// The seven local FlightGear samples are mixed from the aircraft's physical state.
// Sample clocks stay in real time when the route is played at 2× or 4×.
const base = '/aircraft/787/sounds/';
const groundBank = ['touchdown', 'roll', 'rumble'];
const engineBank = ['turbine', 'whine', 'jet', 'reverser'];
const clamp = (v, low, high) => Math.min(high, Math.max(low, v));

function seamless(ctx, raw) {
  const fade = Math.min(Math.round(raw.sampleRate * .10), Math.floor(raw.length / 8));
  const length = raw.length - fade;
  const loop = ctx.createBuffer(raw.numberOfChannels, length, raw.sampleRate);
  for (let channel = 0; channel < raw.numberOfChannels; channel++) {
    const input = raw.getChannelData(channel), output = loop.getChannelData(channel);
    output.set(input.subarray(0, length));
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      output[i] = input[length + i] * (1 - t) + input[i] * t;
    }
  }
  return loop;
}

// A short tire/oleo impulse carries the low-frequency impact underneath the tire chirp.
// Scaled and pitched versions also give the nose gear and pavement joints their own weight.
function strutImpulse(ctx) {
  const buffer = ctx.createBuffer(1, Math.ceil(.48 * ctx.sampleRate), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let noise = 0, phase = 0, seed = 9371;
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    noise += .075 * (2 * seed / 4294967296 - 1 - noise);
    phase += 2 * Math.PI * (44 + 60 * Math.exp(-t * 30)) / ctx.sampleRate;
    data[i] = (1 - Math.exp(-t * 600)) * (.69 * Math.sin(phase) * Math.exp(-t * 13) +
      1.22 * noise * Math.exp(-t * 20));
  }
  return buffer;
}

export class AircraftSound {
  constructor(ctx, output) {
    this.ctx = ctx;
    this.cabinFilter = ctx.createBiquadFilter();
    this.cabinFilter.type = 'lowpass';
    this.cabinFilter.Q.value = .62;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.cabinFilter.connect(this.bus).connect(output);
    this.buffers = new Map();
    this.requests = new Set();
    this.retryAt = new Map();
    this.loops = new Map();
    this.shots = new Set();
    this.impact = strutImpulse(ctx);
    this.quiet();
  }
  async load(name) {
    if (this.buffers.has(name) || this.requests.has(name) || performance.now() < (this.retryAt.get(name) || 0)) return;
    this.requests.add(name);
    try {
      const response = await fetch(base + name + '.wav');
      if (!response.ok) throw new Error('飞机音效加载失败');
      const decoded = await this.ctx.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(name, name === 'touchdown' ? decoded : seamless(this.ctx, decoded));
    } catch {
      this.retryAt.set(name, performance.now() + 5000);
    } finally {
      this.requests.delete(name);
    }
  }
  // Loading in advance never creates a playing voice.
  prepare(airliner) {
    for (const name of groundBank) this.load(name);
    if (airliner) for (const name of engineBank) this.load(name);
  }
  loop(id, sample, volume, rate, pan = 0) {
    let voice = this.loops.get(id);
    const ctx = this.ctx, now = ctx.currentTime;
    if (!voice) {
      const buffer = this.buffers.get(sample);
      if (!buffer || volume < .001) return;
      const source = ctx.createBufferSource(), gain = ctx.createGain(), panner = ctx.createStereoPanner();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = rate;
      gain.gain.value = 0;
      panner.pan.value = pan;
      source.connect(gain).connect(panner).connect(this.cabinFilter);
      source.start(now, id === 'rightEngine' ? buffer.duration * .37 : 0);
      voice = { source, gain, panner };
      this.loops.set(id, voice);
    }
    voice.gain.gain.setTargetAtTime(volume, now, .13);
    voice.source.playbackRate.setTargetAtTime(rate, now, .16);
    voice.panner.pan.setTargetAtTime(pan, now, .18);
  }
  shot(buffer, volume, rate, duration, pan = 0, delay = 0) {
    const ctx = this.ctx, start = ctx.currentTime + delay;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), panner = ctx.createStereoPanner();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume * .56), start + duration * .43);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    panner.pan.value = pan;
    source.connect(gain).connect(panner).connect(this.cabinFilter);
    const voice = { source, gain, panner };
    this.shots.add(voice);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      panner.disconnect();
      this.shots.delete(voice);
    };
    source.start(start);
    source.stop(start + duration + .01);
  }
  quiet() {
    const now = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(0, now, .028);
    for (const { source, gain, panner } of this.loops.values()) {
      gain.gain.setTargetAtTime(0, now, .018);
      source.onended = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); };
      source.stop(now + .09);
    }
    this.loops.clear();
    for (const { source, gain } of this.shots) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, .012);
      source.stop(now + .055);
    }
    this.last = null;
    this.jointDistance = 0;
    this.jointNumber = 0;
    this.spool = 0;
  }
  update(flight, mode, speech) {
    if (flight.arrived) {
      if (this.last) this.quiet();
      return;
    }
    const ctx = this.ctx, now = ctx.currentTime, last = this.last;
    const jet = !!flight.airliner, speed = flight.speed, ground = flight.grounded;
    const cabin = mode === 'leftWindow' || mode === 'rightWindow' || mode === 'cockpit';
    const side = mode === 'leftWindow' ? -.24 : mode === 'rightWindow' ? .24 : 0;
    if (groundBank.some(name => !this.buffers.has(name)) || (jet && engineBank.some(name => !this.buffers.has(name)))) {
      this.prepare(jet);
    }
    const dt = last ? clamp(flight.elapsed - last.elapsed, 0, 1) : 0;
    const acceleration = dt > 0 ? clamp((speed - last.speed) / dt, -6, 4) : 0;
    const load = clamp(flight.throttle + Math.max(acceleration, 0) * .21, 0, 1);
    const reverse = flight.reverseThrust || 0;
    const rpm = Math.max(load, .74 * reverse);
    const realDt = last ? clamp(now - last.time, 0, .5) : 0;
    this.spool = last ? this.spool + (rpm - this.spool) * (1 - Math.exp(-realDt / (rpm > this.spool ? .65 : 1.4))) : rpm;
    this.bus.gain.setTargetAtTime((mode === 'aerial' ? .42 : cabin ? .71 : 1) * (speech ? .45 : 1), now, speech ? .08 : .32);
    this.cabinFilter.frequency.setTargetAtTime(cabin ? 1400 : 8700, now, .18);
    if (jet) {
      const n = this.spool;
      const turbine = .09 + .22 * n, pitch = .64 + .88 * n;
      this.loop('leftEngine', 'turbine', turbine * (1 - side), pitch, -.53 - side);
      this.loop('rightEngine', 'turbine', turbine * (1 + side), pitch * 1.008, .53 - side);
      this.loop('fan', 'whine', (.023 + .147 * n * n) * (cabin ? .43 : 1), .52 + 1.37 * n, -.10 - side);
      this.loop('core', 'jet', (cabin ? .15 : .063) + .27 * n, .66 + .65 * n, .12 - side);
      this.loop('reverse', 'reverser', .76 * reverse, .75 + .35 * reverse);
    }
    const rolling = ground ? Math.min(1, speed / 3.5) : 0;
    const fast = Math.min(1, speed / (jet ? 55 : 34));
    this.loop('tires', 'roll', rolling * (.16 + .48 * fast + .045 * Math.max(0, -acceleration)),
      .51 + fast * .83);
    this.loop('pavement', 'rumble', rolling * (.18 + .26 * fast) * (jet ? 1 : .57), .55 + fast * .62);
    if (last && ground && !last.ground) {
      const weight = jet ? 1 : .67;
      this.shot(this.impact, .84 * weight, jet ? .86 : 1.20, .45, -.16);
      const chirp = this.buffers.get('touchdown');
      if (chirp) this.shot(chirp, .65 * weight, jet ? 1.04 : 1.32, jet ? .78 : .43, .12, .032);
      this.jointDistance = 0;
    } else if (jet && flight.noseOnGround && last?.ground && !last.nose) {
      this.shot(this.impact, .42, 1.30, .32, .04);
    }
    if (last?.ground && ground && speed > .4 && speed < (jet ? 17 : 12)) {
      this.jointDistance += (speed + last.speed) * .5 * dt;
      if (this.jointDistance >= 15) {
        this.jointDistance %= 15;
        this.jointNumber++;
        const pan = this.jointNumber % 2 ? -.18 : .18;
        this.shot(this.impact, (.085 + speed * .006) * (jet ? 1 : .63), 1.7, .20, pan);
      }
    }
    this.last = { ground, nose: flight.noseOnGround, elapsed: flight.elapsed, speed, time: now };
  }
}
