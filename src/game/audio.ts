type Buses = {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  voice: GainNode;
};

class AudioDirector {
  private bus: Buses | null = null;
  private mode: "none" | "menu" | "battle" | "cine" = "none";
  private volumes = { master: 0.8, music: 0.55, sfx: 0.85, voice: 0.7 };
  private nextAt = 0;
  private step = 0;

  unlock() {
    if (typeof window === "undefined") return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.bus) {
      const ctx = new AC({ latencyHint: "interactive" });
      const master = ctx.createGain();
      const music = ctx.createGain();
      const sfx = ctx.createGain();
      const voice = ctx.createGain();
      music.connect(master);
      sfx.connect(master);
      voice.connect(master);
      master.connect(ctx.destination);
      this.bus = { ctx, master, music, sfx, voice };
      this.apply();
    }
    if (this.bus.ctx.state === "suspended") void this.bus.ctx.resume();
  }

  setVolumes(v: { master: number; music: number; sfx: number; voice: number }) {
    this.volumes = v;
    this.apply();
  }

  private apply() {
    if (!this.bus) return;
    const now = this.bus.ctx.currentTime;
    const c = (n: number) => Math.max(0.0001, n * n);
    this.bus.master.gain.setTargetAtTime(c(this.volumes.master), now, 0.03);
    this.bus.music.gain.setTargetAtTime(c(this.volumes.music), now, 0.03);
    this.bus.sfx.gain.setTargetAtTime(c(this.volumes.sfx), now, 0.02);
    this.bus.voice.gain.setTargetAtTime(c(this.volumes.voice), now, 0.02);
  }

  setMode(mode: "none" | "menu" | "battle" | "cine") {
    if (this.mode === mode) return;
    this.mode = mode;
    this.step = 0;
    this.nextAt = 0;
  }

  tick() {
    if (!this.bus || this.bus.ctx.state !== "running" || this.mode === "none") return;
    const ctx = this.bus.ctx;
    const horizon = ctx.currentTime + 0.25;
    if (this.nextAt === 0) this.nextAt = ctx.currentTime + 0.05;
    let guard = 0;
    while (this.nextAt < horizon && guard++ < 6) {
      if (this.mode === "battle") this.battleNote(this.nextAt);
      else if (this.mode === "cine") this.cineNote(this.nextAt);
      else this.menuNote(this.nextAt);
      this.step += 1;
    }
  }

  private menuNote(when: number) {
    const scale = [196, 247, 294, 330, 392];
    const f = scale[this.step % scale.length];
    if (this.step % 2 === 0) this.tone(this.bus!.music, f, 0.42, "sine", 0.045, when);
    if (this.step % 8 === 0) this.tone(this.bus!.music, f / 2, 0.7, "triangle", 0.03, when);
    this.nextAt = when + 0.62;
  }

  private cineNote(when: number) {
    const f = [146, 196, 220, 174][this.step % 4];
    this.tone(this.bus!.music, f, 1.3, "sine", 0.04, when, f * 1.01);
    this.nextAt = when + 1.15;
  }

  private battleNote(when: number) {
    const bass = [98, 98, 110, 87][this.step % 4];
    this.tone(this.bus!.music, bass, 0.22, "triangle", 0.05, when);
    if (this.step % 2 === 0) this.tone(this.bus!.music, 740, 0.04, "square", 0.012, when);
    this.nextAt = when + 0.34;
  }

  play(name: string) {
    if (!this.bus || this.bus.ctx.state !== "running") return;
    const when = this.bus.ctx.currentTime;
    const sfx = this.bus.sfx;
    const voice = this.bus.voice;
    const jitter = 0.94 + Math.random() * 0.12;
    switch (name) {
      case "ui":
        this.tone(sfx, 620 * jitter, 0.06, "square", 0.03, when);
        break;
      case "hit":
        this.tone(sfx, 180 * jitter, 0.08, "sawtooth", 0.04, when, 70);
        this.tone(sfx, 420 * jitter, 0.05, "square", 0.02, when);
        break;
      case "hurt":
        this.tone(sfx, 140, 0.14, "sawtooth", 0.05, when, 60);
        break;
      case "cast":
        this.tone(sfx, 520 * jitter, 0.12, "triangle", 0.04, when, 880);
        break;
      case "ult":
        this.tone(sfx, 220, 0.28, "sawtooth", 0.05, when, 90);
        this.tone(sfx, 660, 0.2, "square", 0.03, when);
        this.tone(voice, 523, 0.18, "sine", 0.04, when);
        break;
      case "capture":
        this.tone(sfx, 392, 0.16, "triangle", 0.04, when);
        this.tone(sfx, 523, 0.22, "sine", 0.04, when + 0.08);
        this.tone(voice, 659, 0.2, "sine", 0.035, when + 0.12);
        break;
      case "heal":
        this.tone(sfx, 640, 0.12, "sine", 0.035, when, 880);
        break;
      case "win":
        this.tone(sfx, 392, 0.16, "triangle", 0.05, when);
        this.tone(sfx, 523, 0.18, "triangle", 0.05, when + 0.12);
        this.tone(sfx, 784, 0.28, "sine", 0.05, when + 0.24);
        break;
      case "lose":
        this.tone(sfx, 220, 0.25, "triangle", 0.05, when, 110);
        this.tone(sfx, 146, 0.35, "sine", 0.04, when + 0.1);
        break;
      case "elim":
        this.tone(voice, 494, 0.09, "sine", 0.04, when);
        this.tone(voice, 370, 0.12, "triangle", 0.03, when + 0.07);
        break;
      case "upgrade":
        this.tone(sfx, 300, 0.1, "square", 0.03, when);
        this.tone(sfx, 450, 0.14, "triangle", 0.03, when + 0.08);
        break;
      default:
        break;
    }
  }

  private tone(
    dest: GainNode,
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    when: number,
    slideTo?: number,
  ) {
    if (!this.bus) return;
    const ctx = this.bus.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(40, freq), when);
    if (slideTo && slideTo > 0) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(dest);
    o.start(when);
    o.stop(when + dur + 0.03);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
}

let singleton: AudioDirector | null = null;

export function audio() {
  if (!singleton) singleton = new AudioDirector();
  return singleton;
}
