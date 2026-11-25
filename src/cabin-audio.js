// The route chooses a programme by position, including when joining midway.
export const cabinPrograms = {
  clouds: {
    music: { file: 'kitto-mata-itsuka', title: '一定会再会（きっとまたいつか）' },
    speech: { file: 'pa-descent', title: '开始下降' },
  },
  city: {
    music: { file: 'dimanche-et-fetes', title: '假日时光' },
    speech: { file: 'pa-city', title: '杏林湾观景' },
  },
  harbor: {
    music: { file: 'gulangyu-waves', title: '鼓浪屿之波' },
    speech: { file: 'pa-landing', title: '着陆准备' },
  },
  landed: {
    music: { file: 'blue-sky-egret', title: '蓝天白鹭之歌' },
    speech: { file: 'pa-welcome', title: '欢迎抵达厦门' },
  },
};
export const cabinTracks = Object.values(cabinPrograms).map((part) => part.music);

// Each channel holds only its current decoded clip. Loading never starts playback
// itself, so a late response cannot speak over a pause or a different flight.
export class CabinChannel {
  constructor(ctx, output, fadeIn) {
    this.ctx = ctx;
    this.output = output;
    this.fadeIn = fadeIn;
    this.clip = null;
    this.offset = 0;
    this.retryAfter = 0;
  }
  select(clip, restart = false) {
    if (this.clip === clip && !restart) return;
    this.pause();
    if (this.clip !== clip) {
      this.request?.abort();
      this.request = null;
      this.buffer = null;
      this.clip = clip;
    }
    this.offset = 0;
    this.finished = false;
    this.retryAfter = 0;
  }
  async load() {
    if (this.request || performance.now() < this.retryAfter) return;
    const request = new AbortController();
    this.request = request;
    try {
      const response = await fetch('/audio/' + this.clip.file + '.mp3', { signal: request.signal });
      if (!response.ok) throw new Error('客舱音频加载失败');
      const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
      if (this.request === request) this.buffer = buffer;
    } catch {
      if (this.request === request) this.retryAfter = performance.now() + 5000;
    } finally {
      if (this.request === request) this.request = null;
    }
  }
  play() {
    if (!this.clip || this.finished || this.voice || this.ctx.state !== 'running') return;
    if (!this.buffer) {
      this.load();
      return;
    }
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    source.buffer = this.buffer;
    gain.gain.setValueAtTime(0, now);
    gain.gain.setTargetAtTime(1, now, this.fadeIn);
    source.connect(gain).connect(this.output);
    const voice = { source, gain, started: now - this.offset };
    this.voice = voice;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (this.voice === voice) {
        this.voice = null;
        this.finished = true;
      }
    };
    source.start(now, this.offset);
  }
  pause() {
    if (!this.voice) return;
    const { source, gain, started } = this.voice, now = this.ctx.currentTime;
    this.voice = null;
    this.offset = Math.min(this.buffer.duration, now - started);
    this.finished = this.offset >= this.buffer.duration;
    gain.gain.setTargetAtTime(0, now, .018);
    source.stop(now + .09);
  }
}
