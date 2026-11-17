// Harbour Line — sound. Every effect is synthesized with WebAudio: no
// audio files, no network. A tiny helper builds short envelopes so each
// call reads as one line of intent.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambient = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startWind();
  }

  // Low filtered noise, always on once the player has interacted.
  startWind() {
    const length = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
  }

  blip(freq, duration, type, volume, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noise(duration, volume, filterFreq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  shot() {
    this.noise(0.09, 0.5, 2400);
    this.blip(160, 0.08, 'square', 0.22, 60);
  }

  enemyShot() {
    this.noise(0.08, 0.16, 1400);
    this.blip(120, 0.07, 'square', 0.08, 55);
  }

  hit() {
    this.blip(880, 0.06, 'sine', 0.3, 660);
  }

  elimination() {
    this.blip(523, 0.1, 'sine', 0.3);
    setTimeout(() => this.blip(784, 0.14, 'sine', 0.3), 90);
  }

  hurt() {
    this.blip(110, 0.18, 'sawtooth', 0.25, 70);
  }

  reload() {
    this.blip(1200, 0.04, 'square', 0.14);
    setTimeout(() => this.blip(900, 0.04, 'square', 0.14), 220);
    setTimeout(() => this.blip(1400, 0.05, 'square', 0.16), 480);
  }

  roundHorn() {
    this.blip(392, 0.5, 'sawtooth', 0.18, 392);
    setTimeout(() => this.blip(523, 0.5, 'sawtooth', 0.18), 160);
  }

  roundLost() {
    this.blip(330, 0.4, 'sawtooth', 0.18, 220);
    setTimeout(() => this.blip(220, 0.6, 'sawtooth', 0.18), 200);
  }

  click() {
    this.blip(700, 0.05, 'square', 0.15);
  }
}
