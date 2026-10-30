/*
 * Audio OGS : musique générative (acid techno hypnotique façon TB-303) + sound design, 100 % Web Audio, aucun fichier.
 * Audio.init() au premier clic (politique des navigateurs), Audio.sfx('nom'), Audio.setScene('menu'|'match'|'overtime'|'result').
 */
(function () {
  'use strict';
  const BPM = 126;
  const STEP = 60 / BPM / 4; // double-croche
  let ctx = null, master = null, musicBus = null, sfxBus = null, comp = null;
  let delay = null, delayGain = null, reverb = null, reverbGain = null;
  let settings = { music: true, sfx: true, musicVol: 0.55, sfxVol: 0.8 };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('ogs_audio') || '{}')); } catch (e) { /* ignore */ }
  function save() { try { localStorage.setItem('ogs_audio', JSON.stringify(settings)); } catch (e) { /* ignore */ } }

  // ----- Séquenceur -----
  let playing = false, nextStep = 0, nextTime = 0, timer = null, scene = 'menu', intensity = 0.4;
  let bar = 0, seed = 1337;
  function rnd() { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; }
  // Gamme : la mineur phrygien-ish pour le côté acid.
  const SCALE = [0, 1, 3, 5, 7, 8, 10, 12];
  const ROOT = 45; // A1 (midi)
  const CHORDS = [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-5, -1, 2, 7]]; // Am7 Fmaj7 Gsus C...
  let pattern = [];
  function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function makePattern() {
    // 16 pas : { note (midi) | null, accent, slide, oct }
    const p = [];
    const density = 0.55 + 0.35 * intensity;
    for (let i = 0; i < 16; i += 1) {
      const on = i % 4 === 0 ? rnd() < 0.9 : rnd() < density;
      if (!on) { p.push(null); continue; }
      const deg = rnd() < 0.5 ? 0 : SCALE[Math.floor(rnd() * SCALE.length)];
      const oct = rnd() < 0.2 + 0.3 * intensity ? 12 : 0;
      p.push({ note: ROOT + deg + oct, accent: rnd() < 0.3, slide: rnd() < 0.3 });
    }
    return p;
  }

  function noiseBuffer() {
    const len = ctx.sampleRate * 1.5, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  let noise = null;

  function kick(t, vel) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.35);
    // Clic d'attaque
    const c = ctx.createOscillator(), cg = ctx.createGain();
    c.type = 'square'; c.frequency.setValueAtTime(900, t); c.frequency.exponentialRampToValueAtTime(200, t + 0.02);
    cg.gain.setValueAtTime(vel * 0.25, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    c.connect(cg).connect(musicBus); c.start(t); c.stop(t + 0.04);
  }
  function hat(t, open, vel) {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.25 : 0.05));
    src.connect(hp).connect(g).connect(musicBus); src.start(t); src.stop(t + 0.3);
  }
  function clap(t, vel) {
    for (let i = 0; i < 3; i += 1) {
      const src = ctx.createBufferSource(); src.buffer = noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
      const g = ctx.createGain(); const tt = t + i * 0.012; g.gain.setValueAtTime(vel * 0.5, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.12);
      src.connect(bp).connect(g).connect(reverbGain); src.connect(bp).connect(g).connect(musicBus); src.start(tt); src.stop(tt + 0.15);
    }
  }
  let acidOsc = null, acidFilter = null, acidAmp = null, acidLastNote = null;
  function ensureAcid() {
    if (acidOsc) return;
    acidOsc = ctx.createOscillator(); acidOsc.type = 'sawtooth';
    acidFilter = ctx.createBiquadFilter(); acidFilter.type = 'lowpass'; acidFilter.Q.value = 14;
    acidAmp = ctx.createGain(); acidAmp.gain.value = 0;
    const drive = ctx.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i += 1) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); } drive.curve = curve;
    acidOsc.connect(acidFilter).connect(drive).connect(acidAmp);
    acidAmp.connect(musicBus); acidAmp.connect(delayGain);
    acidOsc.start();
  }
  function acid(t, st) {
    ensureAcid();
    const f = midiHz(st.note);
    if (st.slideFrom) { acidOsc.frequency.setValueAtTime(midiHz(st.slideFrom), t); acidOsc.frequency.exponentialRampToValueAtTime(f, t + STEP * 0.9); }
    else acidOsc.frequency.setValueAtTime(f, t);
    const base = 180 + 900 * intensity + (st.accent ? 900 : 0) + 500 * Math.sin(bar * 0.35); // balayage lent du cutoff = hypnose
    acidFilter.frequency.cancelScheduledValues(t);
    acidFilter.frequency.setValueAtTime(base + 2200 * (st.accent ? 1.4 : 1), t);
    acidFilter.frequency.exponentialRampToValueAtTime(Math.max(80, base), t + (st.accent ? 0.22 : 0.14));
    acidAmp.gain.cancelScheduledValues(t);
    acidAmp.gain.setValueAtTime(st.accent ? 0.5 : 0.32, t);
    acidAmp.gain.setValueAtTime(st.accent ? 0.5 : 0.32, t + STEP * (st.slide ? 1.0 : 0.6));
    acidAmp.gain.exponentialRampToValueAtTime(0.001, t + STEP * (st.slide ? 1.05 : 0.95));
  }
  let padNodes = [];
  function pad(t, chordIdx) {
    for (const n of padNodes) { n.g.gain.cancelScheduledValues(t); n.g.gain.setValueAtTime(n.g.gain.value, t); n.g.gain.linearRampToValueAtTime(0, t + 2.5); n.o.stop(t + 2.6); }
    padNodes = [];
    const chord = CHORDS[chordIdx % CHORDS.length];
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420 + 300 * intensity; lp.Q.value = 2;
    lp.connect(reverbGain); lp.connect(musicBus);
    for (const iv of chord) for (const det of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiHz(ROOT + 24 + iv); o.detune.value = det;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 2.5);
      o.connect(g).connect(lp); o.start(t); padNodes.push({ o, g });
    }
    // Sub basse sur la fondamentale.
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = midiHz(ROOT - 12 + chord[0] + (chord[0] < 0 ? 12 : 0));
    const sg = ctx.createGain(); sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(0.22, t + 1); sub.connect(sg).connect(musicBus); sub.start(t); padNodes.push({ o: sub, g: sg });
  }

  function schedule() {
    while (nextTime < ctx.currentTime + 0.25) {
      const step = nextStep % 16;
      if (step === 0) { if (bar % 4 === 0) { if (bar % 8 === 0 || rnd() < 0.5) pattern = makePattern(); pad(nextTime, Math.floor(bar / 4)); } bar += 1; }
      const t = nextTime;
      const inMatch = scene !== 'menu';
      if (step % 4 === 0) kick(t, inMatch ? 0.9 : 0.6);
      if (step % 2 === 1) hat(t, step % 8 === 7, inMatch ? 0.28 : 0.16);
      if ((step === 4 || step === 12) && intensity > 0.5) clap(t, 0.5);
      const st = pattern[step];
      if (st) { const prev = pattern[(step + 15) % 16]; acid(t, Object.assign({}, st, { slideFrom: st.slide && prev ? prev.note : null })); }
      // Breakdown : toutes les 16 mesures, 2 mesures sans kick.
      nextTime += STEP; nextStep += 1;
    }
  }

  function startMusic() {
    if (!ctx || playing || !settings.music) return;
    playing = true; nextTime = ctx.currentTime + 0.05; nextStep = 0; bar = 0; pattern = makePattern();
    timer = setInterval(schedule, 60);
  }
  function stopMusic() {
    playing = false; clearInterval(timer); timer = null;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const n of padNodes) { try { n.g.gain.cancelScheduledValues(t); n.g.gain.linearRampToValueAtTime(0, t + 0.5); n.o.stop(t + 0.6); } catch (e) { /* ignore */ } }
    padNodes = [];
    if (acidAmp) { acidAmp.gain.cancelScheduledValues(t); acidAmp.gain.setValueAtTime(0, t); }
  }

  // ----- SFX synthétisés -----
  function tone(freq, dur, type, vol, opts) {
    const o = ctx.createOscillator(), g = ctx.createGain(); const t = ctx.currentTime + ((opts && opts.delay) || 0);
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (opts && opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function burstNoise(dur, vol, freq, type) {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 1200;
    const g = ctx.createGain(); const t = ctx.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(sfxBus); src.start(t); src.stop(t + dur + 0.02);
  }
  const SFX = {
    ui: () => tone(1200, 0.05, 'square', 0.08),
    select: () => { tone(660, 0.06, 'square', 0.1); tone(990, 0.08, 'square', 0.08, { delay: 0.05 }); },
    place: () => { tone(220, 0.12, 'triangle', 0.25, { to: 440 }); burstNoise(0.08, 0.12, 2500); },
    reject: () => tone(180, 0.18, 'sawtooth', 0.12, { to: 90 }),
    orb: () => { [880, 1175, 1760].forEach((f, i) => tone(f, 0.18, 'sine', 0.14, { delay: i * 0.06 })); },
    shot: () => { burstNoise(0.08, 0.2, 3000, 'highpass'); tone(500, 0.1, 'square', 0.1, { to: 120 }); },
    hit: () => { tone(160, 0.1, 'square', 0.18, { to: 60 }); burstNoise(0.06, 0.18, 900); },
    kill: () => { burstNoise(0.25, 0.3, 1500); tone(300, 0.25, 'sawtooth', 0.15, { to: 50 }); },
    bounce: () => tone(400, 0.08, 'triangle', 0.15, { to: 800 }),
    base: () => { tone(70, 0.6, 'sine', 0.6, { to: 35 }); burstNoise(0.4, 0.35, 500); },
    ability: () => { tone(300, 0.35, 'sawtooth', 0.18, { to: 1200 }); burstNoise(0.3, 0.12, 4000, 'highpass'); },
    evolve: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.16, { delay: i * 0.08 })); },
    heal: () => { tone(700, 0.15, 'sine', 0.12, { to: 1000 }); },
    freeze: () => { tone(1800, 0.3, 'sine', 0.12, { to: 600 }); burstNoise(0.3, 0.1, 6000, 'highpass'); },
    countdown: () => tone(440, 0.12, 'square', 0.15),
    go: () => { tone(880, 0.35, 'square', 0.2); tone(1320, 0.5, 'square', 0.12, { delay: 0.05 }); },
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, 'triangle', 0.2, { delay: i * 0.12 })); },
    loss: () => { [440, 415, 370, 311].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.12, { delay: i * 0.18 })); },
    draw: () => { [440, 440, 440].forEach((f, i) => tone(f, 0.25, 'triangle', 0.15, { delay: i * 0.2 })); },
    wave: () => { [330, 440, 330, 440].forEach((f, i) => tone(f, 0.15, 'square', 0.14, { delay: i * 0.12 })); },
    overtime: () => { [220, 233, 220, 233, 220].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.16, { delay: i * 0.1 })); },
    emote: () => { tone(900, 0.08, 'sine', 0.12); tone(1200, 0.1, 'sine', 0.1, { delay: 0.08 }); },
    coin: () => { tone(1500, 0.08, 'square', 0.12); tone(2000, 0.2, 'square', 0.1, { delay: 0.07 }); },
    match: () => { [392, 523, 659].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, { delay: i * 0.1 })); },
  };

  const Audio = {
    settings,
    get ready() { return !!ctx; },
    init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = settings.music ? settings.musicVol : 0; musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx ? settings.sfxVol : 0; sfxBus.connect(master);
      noise = noiseBuffer();
      // Délai (croche pointée) + réverb simple pour l'acid et le pad.
      delay = ctx.createDelay(1); delay.delayTime.value = STEP * 3; const fb = ctx.createGain(); fb.gain.value = 0.38;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
      delayGain = ctx.createGain(); delayGain.gain.value = 0.35;
      delayGain.connect(delay); delay.connect(dlp).connect(fb).connect(delay); dlp.connect(musicBus);
      reverb = ctx.createConvolver(); const ir = ctx.createBuffer(2, ctx.sampleRate * 2.2, ctx.sampleRate);
      for (let c = 0; c < 2; c += 1) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6); }
      reverb.buffer = ir; reverbGain = ctx.createGain(); reverbGain.gain.value = 0.5; reverbGain.connect(reverb).connect(musicBus);
      startMusic();
    },
    sfx(name) { if (!ctx || !settings.sfx || !SFX[name]) return; try { SFX[name](); } catch (e) { /* ignore */ } },
    setScene(name) {
      scene = name;
      intensity = name === 'menu' ? 0.35 : name === 'match' ? 0.75 : name === 'overtime' ? 1 : name === 'result' ? 0.5 : 0.6;
    },
    setMusic(on) { settings.music = on; save(); if (!ctx) return; musicBus.gain.setTargetAtTime(on ? settings.musicVol : 0, ctx.currentTime, 0.1); if (on) startMusic(); else stopMusic(); },
    setSfx(on) { settings.sfx = on; save(); if (ctx) sfxBus.gain.value = on ? settings.sfxVol : 0; },
    setMusicVol(v) { settings.musicVol = v; save(); if (ctx && settings.music) musicBus.gain.value = v; },
    setSfxVol(v) { settings.sfxVol = v; save(); if (ctx && settings.sfx) sfxBus.gain.value = v; },
  };
  window.OGSAudio = Audio;
})();
