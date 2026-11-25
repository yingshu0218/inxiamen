import { CabinChannel, cabinPrograms, cabinTracks } from './cabin-audio.js';
import { AircraftSound } from './aircraft-sound.js';

export class FlightSound {
  constructor() {
    this.enabled = true;
    this.musicChoice = 'auto';
    this.speechEnabled = true;
    try {
      this.enabled = localStorage.getItem('ludao-sound') !== 'off';
      this.speechEnabled = localStorage.getItem('ludao-cabin-speech') !== 'off';
      const choice = localStorage.getItem('ludao-cabin-music');
      if (choice === 'off' || cabinTracks.some((track) => track.file === choice)) this.musicChoice = choice;
    } catch {}
  }
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        const ctx = (this.ctx = new Audio());
        this.master = ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(ctx.destination);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = .64;
        this.musicBus.connect(this.master);
        this.music = new CabinChannel(ctx, this.musicBus, .32);
        this.speech = new CabinChannel(ctx, this.master, .021);
        this.aircraft = new AircraftSound(ctx, this.master);
        if (this.flightType !== undefined) this.aircraft.prepare(this.flightType);
        const filter = ctx.createBiquadFilter();
        this.engineFilter = filter;
        filter.type = 'lowpass';
        filter.frequency.value = 310;
        filter.Q.value = 0.4;
        filter.connect(this.master);
        this.motor = ctx.createOscillator();
        this.motor.type = 'sawtooth';
        this.motor.frequency.value = 41;
        this.motorGain = ctx.createGain();
        this.motorGain.gain.value = 0;
        this.motor.connect(this.motorGain).connect(filter);
        this.motor.start();
        const overtone = ctx.createOscillator(),
          overGain = ctx.createGain();
        overtone.type = 'triangle';
        overtone.frequency.value = 81;
        this.overtone = overtone;
        this.overtoneGain = overGain;
        overGain.gain.value = 0;
        overtone.connect(overGain).connect(filter);
        overtone.start();
        const samples = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate),
          data = samples.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < data.length; i++) {
          brown = (brown + 0.025 * (Math.random() * 2 - 1)) / 1.025;
          data[i] = brown * 5;
        }
        const wind = ctx.createBufferSource();
        wind.buffer = samples;
        wind.loop = true;
        this.airGain = ctx.createGain();
        this.airGain.gain.value = 0;
        wind.connect(this.airGain).connect(this.master);
        wind.start();
      }
      this.ctx.resume().catch(() => {});
    } catch {}
  }
  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('ludao-sound', this.enabled ? 'on' : 'off');
    } catch {}
    if (this.enabled) this.unlock();
    else this.quiet();
  }
  quiet() {
    if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.09);
    this.aircraft?.quiet();
    this.music?.pause();
    this.speech?.pause();
  }
  resetFlight(airliner) {
    this.flightType = airliner;
    this.aircraft?.quiet();
    if (airliner !== undefined) this.aircraft?.prepare(airliner);
    this.music?.select(null);
    this.speech?.select(null);
  }
  chooseMusic(choice) {
    this.musicChoice = choice;
    try { localStorage.setItem('ludao-cabin-music', choice); } catch {}
  }
  setSpeech(enabled) {
    this.speechEnabled = enabled;
    try { localStorage.setItem('ludao-cabin-speech', enabled ? 'on' : 'off'); } catch {}
  }
  replaySpeech(stage) {
    this.speech?.select(cabinPrograms[stage].speech, true);
  }
  get cabinCaption() {
    if (this.speech?.voice) return '客舱广播 · ' + this.speech.clip.title;
    if (this.music?.voice) return '客舱音乐 · ' + this.music.clip.title;
    return '';
  }
  updateCabin(stage) {
    const program = cabinPrograms[stage];
    const track = this.musicChoice === 'auto' ? program.music :
      cabinTracks.find((item) => item.file === this.musicChoice);
    this.music.select(track || null);
    this.speech.select(this.speechEnabled ? program.speech : null);
    this.speech.play();
    const ducked = Boolean(this.speech.voice);
    if (ducked !== this.ducked) {
      this.ducked = ducked;
      this.musicBus.gain.setTargetAtTime(ducked ? .13 : .64, this.ctx.currentTime, ducked ? .11 : .65);
    }
    this.music.play();
  }
  update(flight, weather, mode) {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    if (flight.airliner) this.updateCabin(flight.cabinStage);
    const speaking = !!this.speech.voice;
    this.aircraft.update(flight, mode, speaking);
    const t = this.ctx.currentTime, thrust = this.aircraft.spool;
    const piston = !flight.airliner && !flight.arrived;
    const hz = 34 + 59 * thrust;
    this.engineFilter.frequency.setTargetAtTime(250 + 300 * thrust, t, .28);
    this.motor.frequency.setTargetAtTime(hz, t, .16);
    this.overtone.frequency.setTargetAtTime(hz * 2 + .35, t, .19);
    const distance = mode === 'aerial' ? .35 : 1;
    this.motorGain.gain.setTargetAtTime(piston ? (.044 + .068 * thrust) * distance : 0, t, .14);
    this.overtoneGain.gain.setTargetAtTime(piston ? (.014 + .022 * thrust) * distance : 0, t, .16);
    const window = mode === 'rightWindow' || mode === 'leftWindow';
    const wind = flight.speed * (window ? .00038 : .00086) + weather.rain * .06;
    this.airGain.gain.setTargetAtTime(flight.arrived ? 0 : wind * (speaking ? .45 : 1) * distance, t, .22);
    this.master.gain.setTargetAtTime(mode === 'cockpit' ? .54 : .48, t, .16);
  }
}
