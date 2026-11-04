// Procedural sound effects with the Web Audio API (no audio files).
// The context is created on the first user gesture, as browsers require.
export default class AudioFX {
  constructor(cfg) {
    this.cfg = cfg;
    this.ctx = null;
    this.master = null;
    this.noise = null;
  }

  unlock() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.cfg.masterVolume;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  makeNoise() {
    const len = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  envelope(volume, duration, start = this.ctx.currentTime) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + duration * this.cfg.attackShare);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(this.master);
    return gain;
  }

  tone(type, freqFrom, freqTo, volume, duration, start = this.ctx.currentTime) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, start);
    if (freqTo !== freqFrom) osc.frequency.exponentialRampToValueAtTime(freqTo, start + duration);
    osc.connect(this.envelope(volume, duration, start));
    osc.start(start);
    osc.stop(start + duration);
  }

  whoosh() {
    if (!this.ready) return;
    const c = this.cfg.whoosh;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = c.q;
    filter.frequency.setValueAtTime(c.freqFrom, now);
    filter.frequency.exponentialRampToValueAtTime(c.freqTo, now + c.duration);
    src.connect(filter);
    filter.connect(this.envelope(c.volume, c.duration, now));
    src.start(now);
    src.stop(now + c.duration);
  }

  click() {
    if (!this.ready) return;
    const c = this.cfg.click;
    this.tone('square', c.freq, c.freq / 2, c.volume, c.duration);
  }

  // Rising arpeggio; `level` (combo doublings) raises the pitch.
  chime(level) {
    if (!this.ready) return;
    const c = this.cfg.chime;
    const base = c.baseFreq * Math.pow(2, (level * c.semitonesPerLevel) / 12);
    const now = this.ctx.currentTime;
    c.intervals.forEach((semi, i) => {
      const f = base * Math.pow(2, semi / 12);
      this.tone('sine', f, f, c.volume, c.duration, now + i * c.noteGap);
      this.tone('triangle', f * 2, f * 2, c.volume / 3, c.duration / 2, now + i * c.noteGap);
    });
  }

  sparkle() {
    if (!this.ready) return;
    const c = this.cfg.sparkle;
    this.tone('triangle', c.freq, c.freq * 2, c.volume, c.duration);
  }

  // Cartoon "boing": a wobbling pitch drop.
  boing() {
    if (!this.ready) return;
    const c = this.cfg.boing;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(c.freqFrom, now);
    osc.frequency.exponentialRampToValueAtTime(c.freqTo, now + c.duration);
    const lfo = this.ctx.createOscillator();
    const depth = this.ctx.createGain();
    lfo.frequency.value = c.wobbleRate;
    depth.gain.value = c.wobbleDepth;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    osc.connect(this.envelope(c.volume, c.duration, now));
    osc.start(now);
    lfo.start(now);
    osc.stop(now + c.duration);
    lfo.stop(now + c.duration);
  }

  // Double "lub-dub"; `strength` 0..1 scales the volume.
  heartbeat(strength) {
    if (!this.ready || strength <= 0) return;
    const c = this.cfg.heartbeat;
    const now = this.ctx.currentTime;
    for (const [i, k] of [[0, 1], [1, c.secondBeat]]) {
      this.tone('sine', c.freq * (1 + i * c.pitchStep), c.freq * c.dropTo, c.volume * strength * k, c.duration, now + i * c.gap);
    }
  }

  // Low rolling rumble (the chaser arrives).
  rumble() {
    if (!this.ready) return;
    const c = this.cfg.rumble;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = c.cutoff;
    src.connect(filter);
    filter.connect(this.envelope(c.volume, c.duration, now));
    src.start(now);
    src.stop(now + c.duration);
  }

  thud() {
    if (!this.ready) return;
    const c = this.cfg.thud;
    const now = this.ctx.currentTime;
    this.tone('sine', c.freqFrom, c.freqTo, c.volume, c.duration, now);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = c.noiseCutoff;
    src.connect(filter);
    filter.connect(this.envelope(c.noiseVolume, c.duration / 2, now));
    src.start(now);
    src.stop(now + c.duration);
  }
}
