// Synthetische Retro-Sounds via WebAudio — keine Asset-Dateien nötig.

export type SfxName = 'select' | 'command' | 'hit' | 'arrow' | 'die' | 'build' | 'done' | 'error' | 'collapse' | 'alert' | 'win' | 'lose';

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private last = new Map<SfxName, number>();
  muted = false;

  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.25;
    this.master.connect(this.ctx.destination);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol = 1, slide = 0, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol = 0.5, hp = 800) {
    if (!this.ctx || !this.master) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  play(name: SfxName) {
    if (this.muted || !this.ctx) return;
    // Drosseln, damit Massengefechte nicht knattern
    const now = performance.now();
    const minGap = name === 'hit' || name === 'arrow' ? 70 : 40;
    if (now - (this.last.get(name) ?? 0) < minGap) return;
    this.last.set(name, now);
    switch (name) {
      case 'select': return this.tone(660, 0.06, 'square', 0.25);
      case 'command': this.tone(440, 0.05, 'square', 0.2); return this.tone(660, 0.06, 'square', 0.2, 0, 0.05);
      case 'hit': return this.noise(0.06, 0.35, 1500);
      case 'arrow': return this.tone(900, 0.08, 'triangle', 0.15, -500);
      case 'die': return this.tone(220, 0.25, 'sawtooth', 0.2, -150);
      case 'build': return this.noise(0.05, 0.3, 400);
      case 'done': [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'square', 0.2, 0, i * 0.08)); return;
      case 'error': return this.tone(140, 0.15, 'square', 0.25);
      case 'collapse': this.noise(0.5, 0.6, 120); return this.tone(90, 0.5, 'sawtooth', 0.3, -50);
      case 'alert': this.tone(880, 0.1, 'square', 0.2); return this.tone(880, 0.1, 'square', 0.2, 0, 0.18);
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'square', 0.25, 0, i * 0.15)); return;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, i * 0.2)); return;
    }
  }
}

export const sfx = new SfxEngine();

export const buzz = (ms: number | number[]) => {
  if (!sfx.muted && 'vibrate' in navigator) navigator.vibrate(ms);
};
