// ===== synthesized audio =====
// How each engine sounds. cyl: firing pulses per two revolutions (8 for a V8, 6 for a straight six); lope: the
// uneven V8 burble; sub/sq: weight of the low octaves; lp: lowpass at idle and at full throttle; clat: diesel
// clatter, pulsed at the firing rate; turbo: whistle that rises with boost; vol: overall level.
const ENGINE_SOUND = {
  zil60: { cyl: 8, lope: 0.42, sub: 0.6, sq: 0.32, lp: [170, 720], q: 4.8, clat: 0, turbo: 0, vol: 1.0, rough: 0.5 },
  v862: { cyl: 8, lope: 0.26, sub: 0.42, sq: 0.24, lp: [240, 1050], q: 3.4, clat: 0, turbo: 0, vol: 0.9, rough: 0.2 },
  v875: { cyl: 8, lope: 0.38, sub: 0.72, sq: 0.36, lp: [190, 880], q: 4.6, clat: 0, turbo: 0, vol: 1.1, rough: 0.3 },
  kd108: { cyl: 8, lope: 0.1, sub: 0.62, sq: 0.48, lp: [150, 620], q: 2.6, clat: 0.55, turbo: 0.3, vol: 1.0, rough: 0.15 },
  i683: { cyl: 6, lope: 0.04, sub: 0.36, sq: 0.6, lp: [210, 820], q: 2.4, clat: 0.85, turbo: 0.6, vol: 0.92, rough: 0.1 },
  v8sk: { cyl: 8, lope: 0.16, sub: 0.8, sq: 0.42, lp: [125, 520], q: 3.1, clat: 0.35, turbo: 0.4, vol: 1.12, rough: 0.12 },
  v8sk5: { cyl: 8, lope: 0.16, sub: 0.82, sq: 0.44, lp: [130, 560], q: 3.1, clat: 0.35, turbo: 0.62, vol: 1.16, rough: 0.12 },
};
class Sound {
  constructor() { this.a = null; this.on = true; this.vol = 0.6; this.prof = null; }
  init() {
    if (this.a) { if (this.a.state === 'suspended' && this.on) this.a.resume(); return; }
    if (!this.on) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const a = this.a = new AC();
    this.master = a.createGain(); this.master.gain.value = this.on ? this.vol : 0; this.master.connect(a.destination);
    const comp = a.createDynamicsCompressor(); comp.connect(this.master); this.out = comp;
    // engine core: saw + square + triangle octaves through a resonant lowpass and soft clipper
    this.o1 = a.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = a.createOscillator(); this.o2.type = 'square';
    this.o3 = a.createOscillator(); this.o3.type = 'triangle';
    this.g1 = a.createGain(); this.g1.gain.value = 0.55; this.g2 = a.createGain(); this.g2.gain.value = 0.3; this.g3 = a.createGain(); this.g3.gain.value = 0.5;
    this.lp = a.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 500; this.lp.Q.value = 3.5;
    const shaper = a.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.4); } shaper.curve = curve;
    this.lope = a.createGain(); this.lope.gain.value = 0.7;
    this.lfo = a.createOscillator(); this.lfo.type = 'sine'; this.lfoG = a.createGain(); this.lfoG.gain.value = 0.3; this.lfo.connect(this.lfoG).connect(this.lope.gain);
    this.eg = a.createGain(); this.eg.gain.value = 0;
    this.o1.connect(this.g1).connect(this.lp); this.o2.connect(this.g2).connect(this.lp); this.o3.connect(this.g3).connect(this.lp);
    this.lp.connect(shaper).connect(this.lope).connect(this.eg).connect(this.out);
    // noise sources
    const nb = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.nb = nb;
    const mk = (type, f, q, to) => { const s = a.createBufferSource(); s.buffer = nb; s.loop = true; const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = a.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(to || this.out); s.start(); return { s, fl, g }; };
    this.intake = mk('bandpass', 900, 0.9);
    this.wind = mk('lowpass', 420, 0.5);
    this.crunch = mk('bandpass', 2400, 0.7);
    // diesel clatter: noise opened in short bursts at the firing rate (a sawtooth squashed into pulses drives the gate)
    this.clatG = a.createGain(); this.clatG.gain.value = 0; this.clatOut = a.createGain(); this.clatOut.gain.value = 0; this.clatG.connect(this.clatOut).connect(this.out);
    this.clat = mk('bandpass', 2600, 1.3, this.clatG); this.clat.g.gain.value = 1;
    this.pulse = a.createOscillator(); this.pulse.type = 'sawtooth';
    const pz = a.createWaveShaper(), pc = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; pc[i] = x > 0.55 ? 1 : 0; } pz.curve = pc;
    this.pulse.connect(pz).connect(this.clatG.gain);
    // turbo whistle
    this.tb = a.createOscillator(); this.tb.type = 'sine'; this.tbG = a.createGain(); this.tbG.gain.value = 0; this.tb.connect(this.tbG).connect(this.out);
    this.o1.start(); this.o2.start(); this.o3.start(); this.lfo.start(); this.pulse.start(); this.tb.start();
  }
  // sound off suspends the whole audio graph, so the synth costs no CPU or battery at all
  setOn(v) { this.on = v; if (!this.a) return; this.master.gain.setTargetAtTime(v ? this.vol : 0, this.a.currentTime, 0.05); if (v) this.a.resume(); else setTimeout(() => { if (!this.on && this.a) this.a.suspend(); }, 150); }
  profile(E) {
    const id = Object.keys(ENGINES).find(k => ENGINES[k] === E), S = ENGINE_SOUND[id] || ENGINE_SOUND.v862;
    if (this.prof === S) return S;
    this.prof = S; const t = this.a.currentTime;
    this.g2.gain.setTargetAtTime(S.sq, t, 0.1); this.g3.gain.setTargetAtTime(S.sub, t, 0.1); this.lp.Q.setTargetAtTime(S.q, t, 0.1); this.lfoG.gain.setTargetAtTime(S.lope, t, 0.1);
    return S;
  }
  update(tr, env, paused) {
    if (!this.a || !this.on || !tr) return;
    const t = this.a.currentTime, run = tr.fuel > 0 && !paused && tr.engineOn, E = tr.eng, S = this.profile(E);
    const rpm = Math.max(tr.rpm, 1), rr = clamp(rpm / E.red, 0, 1.2), f = rpm / 60 * S.cyl / 2, thr = tr.thr;
    const wob = S.rough ? 1 + S.rough * 0.012 * Math.sin(t * 13.7) * Math.sin(t * 5.3) : 1;
    this.o1.frequency.setTargetAtTime(f * wob, t, 0.03); this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03); this.o3.frequency.setTargetAtTime(f * 0.25, t, 0.03);
    this.lfo.frequency.setTargetAtTime(rpm / 60 * 0.5, t, 0.05);
    this.lp.frequency.setTargetAtTime(S.lp[0] + thr * S.lp[1] + rpm * 0.12, t, 0.05);
    this.eg.gain.setTargetAtTime(run ? (0.1 + thr * 0.17 + rr * 0.05) * S.vol : 0, t, 0.06);
    this.intake.g.gain.setTargetAtTime(run ? 0.015 + thr * rr * 0.06 : 0, t, 0.08);
    this.intake.fl.frequency.setTargetAtTime(600 + rpm * 0.5, t, 0.08);
    // clatter is loudest at idle and under load at low revs
    this.pulse.frequency.setTargetAtTime(f, t, 0.03);
    this.clatOut.gain.setTargetAtTime(run ? S.clat * 0.09 * (0.45 + 0.55 * (1 - Math.min(1, rr))) * (0.6 + 0.4 * thr) : 0, t, 0.06);
    this.clat.fl.frequency.setTargetAtTime(2200 + rpm * 0.4, t, 0.1);
    // the turbo spools up with throttle and revs
    const boost = clamp(thr * (rr - 0.25) / 0.75, 0, 1);
    this.tb.frequency.setTargetAtTime(1500 + 3800 * rr * (0.5 + 0.5 * boost), t, 0.25);
    this.tbG.gain.setTargetAtTime(run ? S.turbo * 0.016 * boost : 0, t, boost > 0.1 ? 0.35 : 0.12);
    const sp = Math.abs(tr.vF), w = Math.abs(env.wind || 0);
    this.wind.g.gain.setTargetAtTime(paused ? 0 : Math.min(0.32, 0.004 * sp * sp * 0.05 + w * 0.012 + 0.006), t, 0.3);
    this.wind.fl.frequency.setTargetAtTime(300 + sp * 18 + w * 25, t, 0.3);
    let cr = 0; for (const wh of tr.wheels) if (wh.touch && (wh.surf === S_SNOW || wh.surf === S_DEEP || wh.surf === S_RUTS)) cr += Math.min(1, Math.abs(wh.vt) / 8) + Math.min(1, Math.abs(wh.slip) / 4);
    this.crunch.g.gain.setTargetAtTime(paused ? 0 : cr * 0.012, t, 0.1);
  }
  sfx(name) {
    if (!this.a || !this.on) return;
    const a = this.a, t = a.currentTime;
    const burst = (dur, f, q, gain, type) => { const s = a.createBufferSource(); s.buffer = this.nb; const fl = a.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q; const g = a.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.05); };
    const tone = (dur, f, gain, type, f2) => { const o = a.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur); const g = a.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05); };
    if (name === 'shift') { burst(0.09, 1400, 1.5, 0.25); tone(0.08, 160, 0.15, 'square', 90); }
    else if (name === 'clunk') { tone(0.18, 110, 0.45, 'triangle', 55); burst(0.07, 600, 1, 0.25); }
    else if (name === 'click') { burst(0.03, 3000, 2, 0.25); }
    else if (name === 'thud') { tone(0.3, 80, 0.6, 'sine', 40); burst(0.2, 300, 0.7, 0.5); }
    else if (name === 'snap') { burst(0.25, 2600, 4, 0.6); tone(0.5, 1850, 0.18, 'triangle', 1400); tone(0.4, 2620, 0.1, 'sine'); }
    else if (name === 'crack') { burst(0.35, 900, 3, 0.5); tone(0.3, 300, 0.25, 'sawtooth', 120); }
    else if (name === 'unload') { tone(0.6, 220, 0.25, 'triangle', 180); burst(0.5, 500, 0.5, 0.35); }
    else if (name === 'fuel') { burst(0.9, 420, 1.4, 0.32, 'lowpass'); burst(0.6, 1600, 3, 0.08); tone(0.12, 900, 0.1, 'triangle', 1200); }
    else if (name === 'good') { tone(0.18, 660, 0.18, 'triangle'); setTimeout(() => this.sfx('good2'), 120); }
    else if (name === 'good2') { tone(0.3, 990, 0.16, 'triangle'); }
  }
}
