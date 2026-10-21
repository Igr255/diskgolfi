"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── AUDIO ENGINE ─────────────────────────────────────────────────────────────
// Everything is synthesised live with the Web Audio API — no sample files.
//
//  • Mixer: music / ambience / effects buses → glue compressor → limiter.
//    Shared convolution reverb and tempo-synced ping-pong delay for the music.
//  • Instruments: FM electric piano, kalimba, marimba, celesta, music box, warm
//    pads, round bass, breathy flute, synth pluck and soft lo-fi drums.
//  • Composer: per-style chord progressions with voice-led chords, melodies built
//    from motifs (statement → answer → resolution) and an arrangement that
//    builds and breathes in 8-bar sections. Notes are scheduled ahead on the
//    audio clock, so timing is sample-accurate (no setInterval jitter).
//  • Ambience beds per course (ocean, wind, birds, crickets, rain, hum, lava…).
//  • Game-reactive audio: flight whoosh, slow-mo muffling, score stingers in the
//    current key, chain rattles, splashes.
// ══════════════════════════════════════════════════════════════════════════════

// ── Small helpers ────────────────────────────────────────────────────────────
function _aRng(seed) {
  var s = (seed >>> 0) || 1;
  return function() { s = (s + 0x6d2b79f5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function _mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function _pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

var _MODES = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
};
var _PENT = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };

// ══════════════════════════════════════════════════════════════════════════════
// ── MIX GRAPH ────────────────────────────────────────────────────────────────
// Works with a live AudioContext or an OfflineAudioContext (used for tests).
// ══════════════════════════════════════════════════════════════════════════════
function _buildAudioGraph(ctx) {
  var G = { ctx: ctx };
  // Shared noise buffers (white + brown), 3 s, looped where needed
  var sr = ctx.sampleRate, n = Math.floor(sr * 3);
  G.white = ctx.createBuffer(1, n, sr);
  G.brown = ctx.createBuffer(1, n, sr);
  var w = G.white.getChannelData(0), b = G.brown.getChannelData(0), last = 0;
  for (var i = 0; i < n; i++) { w[i] = Math.random() * 2 - 1; last = (last + 0.02 * w[i]) / 1.02; b[i] = last * 3.5; }

  // Master: glue compressor → brick-wall-ish limiter → out
  G.master = ctx.createGain(); G.master.gain.value = 0.9;
  var glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -16; glue.knee.value = 10; glue.ratio.value = 2.5; glue.attack.value = 0.01; glue.release.value = 0.3;
  var lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
  G.master.connect(glue); glue.connect(lim); lim.connect(ctx.destination);

  // Buses
  G.musicVol = ctx.createGain(); G.musicVol.connect(G.master);
  G.musicLP = ctx.createBiquadFilter(); G.musicLP.type = "lowpass"; G.musicLP.frequency.value = 20000; G.musicLP.Q.value = 0.5;
  G.musicDuck = ctx.createGain(); G.musicDuck.gain.value = 1;
  G.musicLP.connect(G.musicDuck); G.musicDuck.connect(G.musicVol);
  G.music = G.musicLP;                                   // songs connect here
  G.ambVol = ctx.createGain(); G.ambVol.connect(G.master); G.amb = G.ambVol;
  G.sfxVol = ctx.createGain(); G.sfxVol.connect(G.master); G.sfx = G.sfxVol;

  // Reverb (music + effects get their own return so each follows its volume)
  var ir = _makeIR(ctx, 3.2, 2.6);
  G.musicVerb = ctx.createGain();
  var cv1 = ctx.createConvolver(); cv1.buffer = ir; G.musicVerb.connect(cv1); cv1.connect(G.musicLP);
  G.sfxVerb = ctx.createGain();
  var cv2 = ctx.createConvolver(); cv2.buffer = _makeIR(ctx, 1.6, 3.2); G.sfxVerb.connect(cv2);
  var sfxVerbRet = ctx.createGain(); sfxVerbRet.gain.value = 0.7; cv2.connect(sfxVerbRet); sfxVerbRet.connect(G.sfxVol);

  // Ping-pong delay with a darkening feedback loop (music only)
  G.delayIn = ctx.createGain();
  var dl = ctx.createDelay(2), dr = ctx.createDelay(2), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
  var pl = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  var pr = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  if (pl.pan) { pl.pan.value = -0.6; pr.pan.value = 0.6; }
  fb.gain.value = 0.32; lp.type = "lowpass"; lp.frequency.value = 2800;
  G.delayIn.connect(dl); dl.connect(pl); pl.connect(G.musicLP); dl.connect(dr); dr.connect(pr); pr.connect(G.musicLP);
  dr.connect(lp); lp.connect(fb); fb.connect(dl);
  G.delayL = dl; G.delayR = dr;
  return G;
}

// Stereo impulse response: decaying noise that darkens over time (plate-ish)
function _makeIR(ctx, dur, decay) {
  var sr = ctx.sampleRate, len = Math.floor(sr * dur), buf = ctx.createBuffer(2, len, sr);
  for (var ch = 0; ch < 2; ch++) {
    var d = buf.getChannelData(ch), y = 0;
    for (var i = 0; i < len; i++) {
      var t = i / len, x = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      var a = 0.9 - t * 0.75;                            // one-pole lowpass closes over time
      y += a * (x - y);
      d[i] = (i < sr * 0.012 ? 0 : y) * (ch ? 1 : 0.96); // tiny pre-delay
    }
  }
  return buf;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── INSTRUMENTS ──────────────────────────────────────────────────────────────
// Each takes a channel {ctx, input} and schedules one note at time t.
// ══════════════════════════════════════════════════════════════════════════════
var _INS = {
  _osc: function(ctx, type, f, t, stop) { var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(stop); return o; },
  _gain: function(ctx, v) { var g = ctx.createGain(); g.gain.value = v || 0; return g; },

  // Electric piano (FM "tine" — warm Rhodes-like keys)
  ep: function(ch, t, m, dur, vel, soft) {
    var ctx = ch.ctx, f = _mtof(m), rel = soft ? 0.9 : 0.7, end = t + dur + rel + 0.05;
    var car = this._osc(ctx, "sine", f, t, end);
    var mod = this._osc(ctx, "sine", f, t, end), mg = this._gain(ctx);
    var idx = (soft ? 0.9 : 1.6) * f * (0.6 + vel * 0.6);
    mg.gain.setValueAtTime(idx, t); mg.gain.exponentialRampToValueAtTime(idx * 0.18 + 1, t + 1.1);
    mod.connect(mg); mg.connect(car.frequency);
    var tine = this._osc(ctx, "sine", f * 14, t, t + 0.12), tg = this._gain(ctx);
    tg.gain.setValueAtTime(f * 1.4 * vel, t); tg.gain.exponentialRampToValueAtTime(1, t + 0.06);
    tine.connect(tg); tg.connect(car.frequency);
    var amp = this._gain(ctx);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.32 * vel, t + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.14 * vel + 0.0001, t + Math.min(dur, 1.4));
    amp.gain.setTargetAtTime(0.0001, t + dur, rel / 4);
    car.connect(amp); amp.connect(ch.input);
  },

  // Kalimba: sine body + bright tine partial + tiny click
  kalimba: function(ch, t, m, dur, vel) {
    var ctx = ch.ctx, f = _mtof(m), end = t + 2.2;
    var o1 = this._osc(ctx, "sine", f, t, end), g1 = this._gain(ctx);
    g1.gain.setValueAtTime(0, t); g1.gain.linearRampToValueAtTime(0.4 * vel, t + 0.003); g1.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    var o2 = this._osc(ctx, "sine", f * 5.4, t, t + 0.3), g2 = this._gain(ctx);
    g2.gain.setValueAtTime(0.07 * vel, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    var o3 = this._osc(ctx, "sine", f * 2.01, t, t + 0.8), g3 = this._gain(ctx);
    g3.gain.setValueAtTime(0.05 * vel, t); g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o1.connect(g1); o2.connect(g2); o3.connect(g3); g1.connect(ch.input); g2.connect(ch.input); g3.connect(ch.input);
  },

  // Marimba: woody sine + 4th partial
  marimba: function(ch, t, m, dur, vel) {
    var ctx = ch.ctx, f = _mtof(m), end = t + 1.2;
    var o1 = this._osc(ctx, "sine", f, t, end), g1 = this._gain(ctx);
    g1.gain.setValueAtTime(0, t); g1.gain.linearRampToValueAtTime(0.42 * vel, t + 0.004); g1.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    var o2 = this._osc(ctx, "sine", f * 3.98, t, t + 0.25), g2 = this._gain(ctx);
    g2.gain.setValueAtTime(0.12 * vel, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o1.connect(g1); o2.connect(g2); g1.connect(ch.input); g2.connect(ch.input);
  },

  // Music box: bright, delicate, quick decaying harmonics
  musicbox: function(ch, t, m, dur, vel) {
    var ctx = ch.ctx, f = _mtof(m), self = this;
    [[1, 0.26, 1.6], [2, 0.08, 0.5], [3, 0.035, 0.25], [4.2, 0.02, 0.12]].forEach(function(p) {
      var o = self._osc(ctx, "sine", f * p[0], t, t + p[2] + 0.05), g = self._gain(ctx);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(p[1] * vel, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
      o.connect(g); g.connect(ch.input);
    });
  },

  // Celesta / glass bell (FM 1:3.5)
  bell: function(ch, t, m, dur, vel) {
    var ctx = ch.ctx, f = _mtof(m), end = t + 3;
    var car = this._osc(ctx, "sine", f, t, end), mod = this._osc(ctx, "sine", f * 3.5, t, end), mg = this._gain(ctx);
    mg.gain.setValueAtTime(f * 1.8 * vel, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.4);
    mod.connect(mg); mg.connect(car.frequency);
    var amp = this._gain(ctx);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.18 * vel, t + 0.004); amp.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    car.connect(amp); amp.connect(ch.input);
  },

  // Warm pad: 3 detuned saws through a soft lowpass, slow attack/release
  pad: function(ch, t, notes, dur, vel, bright) {
    var ctx = ch.ctx, self = this, end = t + dur + 3;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.4;
    var cut = bright || 900;
    lp.frequency.setValueAtTime(cut * 0.6, t); lp.frequency.linearRampToValueAtTime(cut, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(cut * 0.7, t + dur);
    var amp = this._gain(ctx);
    var a = Math.min(1.6, dur * 0.4);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.05 * vel, t + a);
    amp.gain.setValueAtTime(0.05 * vel, t + dur); amp.gain.linearRampToValueAtTime(0.0001, t + dur + 2.6);
    notes.forEach(function(m, i) {
      [-7, 6].forEach(function(cents, k) {
        var o = self._osc(ctx, k ? "sawtooth" : "triangle", _mtof(m), t, end); o.detune.value = cents + (i % 2 ? 2 : -2);
        var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (pan) { pan.pan.value = (k ? 0.45 : -0.45) * (i % 2 ? -1 : 1); o.connect(pan); pan.connect(lp); } else o.connect(lp);
      });
    });
    lp.connect(amp); amp.connect(ch.input);
  },

  // Round bass: sine + a little triangle for small-speaker presence
  bass: function(ch, t, m, dur, vel) {
    var ctx = ch.ctx, f = _mtof(m), end = t + dur + 0.4;
    var o1 = this._osc(ctx, "sine", f, t, end), o2 = this._osc(ctx, "triangle", f * 2, t, end);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
    var g2 = this._gain(ctx, 0.22);
    var amp = this._gain(ctx);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.42 * vel, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.25 * vel, t + 0.3);
    amp.gain.setTargetAtTime(0.0001, t + dur, 0.07);
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(amp); amp.connect(ch.input);
  },

  // Breathy flute with delayed vibrato
  flute: function(ch, t, m, dur, vel) {
    var ctx = ch.ctx, f = _mtof(m), end = t + dur + 0.4;
    var o = this._osc(ctx, "sine", f, t, end), o2 = this._osc(ctx, "triangle", f * 2, t, end), g2 = this._gain(ctx, 0.08);
    var vib = this._osc(ctx, "sine", 5.2, t, end), vg = this._gain(ctx);
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.5, dur));
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    var amp = this._gain(ctx);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.16 * vel, t + 0.09);
    amp.gain.setValueAtTime(0.14 * vel, t + dur); amp.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
    var nz = ctx.createBufferSource(); nz.buffer = ch.G.white; nz.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f * 2; bp.Q.value = 2;
    var ng = this._gain(ctx); ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.03 * vel, t + 0.05); ng.gain.linearRampToValueAtTime(0.008 * vel, t + 0.3); ng.gain.linearRampToValueAtTime(0, t + dur + 0.2);
    nz.connect(bp); bp.connect(ng); ng.connect(ch.input); nz.start(t, Math.random() * 2); nz.stop(end);
    o.connect(amp); o2.connect(g2); g2.connect(amp); amp.connect(ch.input);
  },

  // Synth pluck (filter-enveloped saw) for chill synthwave arps
  pluck: function(ch, t, m, dur, vel) {
    var ctx = ch.ctx, f = _mtof(m), end = t + 0.8;
    var o = this._osc(ctx, "sawtooth", f, t, end), o2 = this._osc(ctx, "square", f * 0.5, t, end), g2 = this._gain(ctx, 0.25);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 3;
    lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(320, t + 0.28);
    var amp = this._gain(ctx);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.15 * vel, t + 0.004); amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(amp); amp.connect(ch.input);
  },

  // ── Soft drums ──
  kick: function(ch, t, vel) {
    var ctx = ch.ctx, o = this._osc(ctx, "sine", 120, t, t + 0.45), g = this._gain(ctx);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.75 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(ch.input);
  },
  _noiseHit: function(ch, t, type, freq, q, vol, dec) {
    var ctx = ch.ctx, n = ctx.createBufferSource(); n.buffer = ch.G.white;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    var g = this._gain(ctx); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    n.connect(f); f.connect(g); g.connect(ch.input); n.start(t, Math.random() * 2.5); n.stop(t + dec + 0.02);
  },
  snare: function(ch, t, vel) {   // brushed snare
    this._noiseHit(ch, t, "bandpass", 2100, 0.7, 0.32 * vel, 0.22);
    var o = this._osc(ch.ctx, "triangle", 190, t, t + 0.12), g = this._gain(ch.ctx);
    g.gain.setValueAtTime(0.12 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g); g.connect(ch.input);
  },
  rim: function(ch, t, vel) {
    var o = this._osc(ch.ctx, "sine", 1650, t, t + 0.05), g = this._gain(ch.ctx);
    g.gain.setValueAtTime(0.14 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); o.connect(g); g.connect(ch.input);
    this._noiseHit(ch, t, "bandpass", 3200, 1.5, 0.1 * vel, 0.03);
  },
  hat: function(ch, t, vel, open) { this._noiseHit(ch, t, "highpass", 7200, 0.5, 0.11 * vel, open ? 0.22 : 0.045); },
  shaker: function(ch, t, vel) { this._noiseHit(ch, t, "bandpass", 5200, 0.9, 0.09 * vel, 0.07); },
  clap: function(ch, t, vel) {
    for (var i = 0; i < 3; i++) this._noiseHit(ch, t + i * 0.011, "bandpass", 1400, 1.1, 0.16 * vel, 0.05 + i * 0.05);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// ── MUSICAL STYLES ───────────────────────────────────────────────────────────
// root: MIDI of the key's tonic (bass octave). progs: scale-degree progressions.
// arr: 8-bar sections; values are layer probabilities/levels.
// ══════════════════════════════════════════════════════════════════════════════
var _DRUMS = {
  // 16 steps per 4/4 bar (values = velocity)
  lofi:  { kick: [1,0,0,0, 0,0,0,.5, 0,0,.9,0, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,.25], shaker: [.7,0,.35,0, .55,0,.35,.15, .7,0,.35,0, .55,0,.4,.2] },
  light: { kick: [1,0,0,0, 0,0,0,0, .8,0,0,0, 0,0,0,0], rim: [0,0,0,0, .8,0,0,0, 0,0,0,0, .8,0,0,0], shaker: [.6,0,.3,0, .5,0,.3,0, .6,0,.3,0, .5,0,.35,0] },
  four:  { kick: [1,0,0,0, .9,0,0,0, 1,0,0,0, .9,0,0,0], clap: [0,0,0,0, .7,0,0,0, 0,0,0,0, .7,0,0,0], hat: [0,0,.6,0, 0,0,.6,0, 0,0,.6,0, 0,0,.6,.2] },
  disco: { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare: [0,0,0,0, .8,0,0,0, 0,0,0,0, .8,0,0,0], hatOpen: [0,0,.55,0, 0,0,.55,0, 0,0,.55,0, 0,0,.55,0], hat: [.3,0,0,.2, .3,0,0,.2, .3,0,0,.2, .3,0,0,.2] },
  brush: { kick: [.8,0,0,0, 0,0,0,0, 0,0,.6,0, 0,0,0,0], snare: [.3,0,.2,0, .7,0,.25,0, .3,0,.2,.15, .7,0,.3,0] },
  pulse: { kick: [1,0,0,0, 0,0,0,0, 1,0,0,.4, 0,0,0,0], shaker: [0,0,.4,0, 0,0,.4,0, 0,0,.4,0, 0,0,.4,0] },
  waltz: { kick: [1,0,0,0, 0,0,0,0, 0,0,0,0], rim: [0,0,0,0, .5,0,0,0, .45,0,0,0] },
};

var _ARR = {
  groove: [
    { pad: 1, bells: .5 },
    { pad: 1, bass: 1, keys: 1, drums: .7 },
    { pad: 1, bass: 1, keys: 1, drums: 1, mel: 1 },
    { pad: 1, bass: 1, keys: .7, drums: 1, mel: 1, bells: .3, arp: 1 },
    { pad: 1, bass: .6, mel: .7, bells: .5 },
    { pad: 1, bass: 1, keys: 1, drums: 1, mel: 1 },
  ],
  ambient: [
    { pad: 1, bells: .4 },
    { pad: 1, bass: .6, bells: .5, keys: .5 },
    { pad: 1, bass: .7, mel: 1, keys: .5 },
    { pad: 1, mel: .8, bells: .6, arp: .6 },
    { pad: 1, bass: .7, mel: 1, keys: .6, bells: .3 },
  ],
  sparse: [
    { keys: 1 },
    { keys: 1, pad: .7 },
    { keys: 1, mel: 1, pad: .7 },
    { keys: .8, mel: .8, bells: .5 },
    { pad: 1, mel: .6 },
  ],
};

var _STYLES = {
  // Sunny islands — lo-fi tropical: EP chords, kalimba melody, shaker groove
  island:   { bpm: 82, swing: .18, root: 41, keys: [0, 5, 7, 2], mode: "major", progs: [[0,5,3,4],[0,2,3,4],[3,4,2,5],[0,3,5,4]], lead: "kalimba", comp: "ep", drums: "lofi", arr: "groove", bells: "bell", pad: 900, gain: 1.0 },
  // Meadows & villages — marimba, gentle groove
  meadow:   { bpm: 92, swing: .12, root: 43, keys: [0, 5, 2], mode: "major", progs: [[0,3,4,3],[0,4,5,3],[0,5,1,4],[3,0,4,0]], lead: "marimba", comp: "ep", drums: "light", arr: "groove", bells: "musicbox", pad: 1000, gain: 0.89 },
  // Playful — bouncier, music box + marimba
  playful:  { bpm: 100, swing: .1, root: 40, keys: [0, 5, 7], mode: "major", progs: [[0,3,4,0],[0,5,3,4],[0,1,4,0],[0,3,0,4]], lead: "marimba", comp: "ep", drums: "light", arr: "groove", bells: "musicbox", pad: 1100, bassPat: "bounce", gain: 0.84 },
  // Mountains / canyons / waterfalls — wide, airy, flute & celesta
  alpine:   { bpm: 70, swing: 0, root: 38, keys: [0, 7, 5], mode: "lydian", progs: [[0,1,0,4],[0,3,5,4],[0,1,5,3]], lead: "flute", comp: "ep", drums: null, arr: "ambient", bells: "bell", pad: 1200, chordBars: 2, gain: 1.4 },
  // Winter — music box & bells over soft pads
  winter:   { bpm: 66, swing: 0, root: 40, keys: [0, 5], mode: "major", progs: [[0,5,3,4],[0,3,0,4],[3,4,0,5]], lead: "musicbox", comp: "ep", drums: null, arr: "ambient", bells: "bell", pad: 800, chordBars: 2, gain: 1.3 },
  // Space — slow, vast, lydian pads and glassy bells
  space:    { bpm: 58, swing: 0, root: 36, keys: [0, 2], mode: "lydian", progs: [[0,1,0,1],[0,4,1,0],[0,5,1,4]], lead: "bell", comp: "ep", drums: null, arr: "ambient", bells: "bell", pad: 700, chordBars: 2, verb: 1.5, gain: 1.33 },
  // Dusk & magic — dorian minor, celesta, dreamy
  dusk:     { bpm: 72, swing: .08, root: 38, keys: [0, 5, 7], mode: "dorian", progs: [[0,3,0,4],[0,6,3,4],[0,2,3,6]], lead: "bell", comp: "ep", drums: "pulse", arr: "ambient", bells: "musicbox", pad: 800, gain: 1.12 },
  // Hogwarts — a music-box waltz
  waltz:    { bpm: 92, swing: 0, root: 38, keys: [0, 5], mode: "minor", progs: [[0,3,4,0],[0,5,3,4],[0,6,5,4]], lead: "musicbox", comp: "ep", drums: "waltz", arr: "ambient", bells: "bell", pad: 850, meter: 3, gain: 1.0 },
  // Liminal spaces — soft, slightly wobbly EP, very sparse
  liminal:  { bpm: 64, swing: .1, root: 40, keys: [0, 3], mode: "lydian", progs: [[0,3,0,3],[0,1,3,1],[3,0,1,0]], lead: "ep", comp: "ep", drums: null, arr: "sparse", bells: "bell", pad: 700, softKeys: true, chordBars: 2, verb: 1.4, gain: 1.0 },
  // Minecraft / skyblock — sparse, gentle piano in the C418 spirit
  blocks:   { bpm: 68, swing: 0, root: 40, keys: [0, 7], mode: "lydian", progs: [[0,3,5,4],[0,4,5,3],[3,0,4,5]], lead: "ep", comp: "ep", drums: null, arr: "sparse", bells: "bell", pad: 800, softKeys: true, chordBars: 2, verb: 1.3, gain: 1.0 },
  // Neon / city / geometry — chill synthwave: saw pad, delayed plucks
  synth:    { bpm: 96, swing: 0, root: 38, keys: [0, 5, 7], mode: "minor", progs: [[0,5,2,6],[0,3,5,6],[5,6,0,0],[0,6,5,6]], lead: "pluck", comp: "pluck", drums: "four", arr: "groove", bells: "bell", pad: 1400, arpOn: true, gain: 1.15 },
  // Disco — dorian funk, offbeat EP stabs, octave bass
  disco:    { bpm: 112, swing: 0, root: 38, keys: [0, 5], mode: "dorian", progs: [[0,3,0,3],[0,4,3,4],[0,1,2,3]], lead: "pluck", comp: "ep", drums: "disco", arr: "groove", bells: "bell", pad: 1300, bassPat: "octave", compPat: "offbeat", gain: 0.65 },
  // Office — lo-fi jazz: ii–V–I with 9ths, brushes
  lofijazz: { bpm: 78, swing: .2, root: 41, keys: [0, 5, 3], mode: "major", progs: [[1,4,0,5],[1,4,0,0],[3,2,1,4]], lead: "ep", comp: "ep", drums: "brush", arr: "groove", bells: "bell", pad: 800, ninths: true, gain: 0.97 },
  // Storms & lava — darker minor, still calm
  storm:    { bpm: 74, swing: 0, root: 38, keys: [0, 3, 5], mode: "minor", progs: [[0,5,3,4],[0,6,5,6],[0,3,6,4]], lead: "bell", comp: "ep", drums: "pulse", arr: "ambient", bells: "bell", pad: 700, gain: 1.1 },
  // Menu theme — fixed seed so the game always opens with the same tune
  menu:     { bpm: 80, swing: .16, root: 41, keys: [0], mode: "major", progs: [[0,2,3,4]], lead: "kalimba", comp: "ep", drums: "lofi", arr: "groove", bells: "bell", pad: 950, gain: 1.0 },
};

var _THEME_STYLE = {
  funny: "playful", feet_bunnies: "meadow", socks_basket: "playful", public_poo: "playful", emote: "playful", minion: "playful",
  village: "meadow", vetschool: "meadow", cabbage: "meadow",
  waterfall: "island", skyblock: "blocks", minecraft: "blocks",
  mountains: "alpine", grandcanyon: "alpine", winter: "winter", moon: "space",
  eerie: "dusk", hogwarts: "waltz", backrooms: "liminal", poolrooms: "liminal",
  neon: "synth", city: "synth", geometry_dash: "synth", sixtyseven: "synth", map67: "synth",
  disco: "disco", office: "lofijazz",
  terrifying: "storm", screaming_mamamia: "storm", tornado: "storm",
};

// Ambience recipe per course
var _THEME_AMB = {
  eerie: ["ocean", "crickets"], hogwarts: ["ocean", "crickets"], public_poo: ["ocean", "crickets"],
  neon: ["ocean"], geometry_dash: ["ocean"], sixtyseven: ["ocean"], map67: ["ocean"], disco: ["ocean"],
  city: ["ocean", "traffic"], office: ["hum"], backrooms: ["hum"], poolrooms: ["drips"],
  moon: ["space"], skyblock: ["wind", "birds"],
  terrifying: ["lava"], screaming_mamamia: ["lava"], tornado: ["ocean", "wind"],
  winter: ["ocean", "wind"], mountains: ["ocean", "wind", "birds"], grandcanyon: ["ocean", "wind"],
};

// ══════════════════════════════════════════════════════════════════════════════
// ── SONG (composer + scheduler) ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function _Song(G, styleName, seed, startTime, opts) {
  opts = opts || {};
  var st = _STYLES[styleName] || _STYLES.island, ctx = G.ctx;
  var rng = _aRng(seed);
  this.G = G; this.ctx = ctx; this.st = st; this.rng = rng; this.name = styleName;
  this.bpm = st.bpm * (0.97 + rng() * 0.06);
  this.spb = 60 / this.bpm;
  this.meter = st.meter || 4;
  this.root = st.root + _pick(rng, st.keys || [0]);
  this.scale = _MODES[st.mode] || _MODES.major;
  this.pent = (st.mode === "minor" || st.mode === "dorian" || st.mode === "phrygian") ? _PENT.minor : _PENT.major;
  this.prog = _pick(rng, st.progs);
  this.chordBars = st.chordBars || 1;
  this.arr = _ARR[st.arr] || _ARR.groove;
  this.bar = 0;
  this.nextBar = startTime;
  this.t0 = startTime;
  this.phrases = {};

  // Output with fade + per-instrument channels
  this.out = ctx.createGain(); this.out.gain.value = 0;
  this.out.connect(G.music);
  this.skipIntro = !!opts.skipIntro;
  var fadeIn = opts.fadeIn || 2.5;
  this.out.gain.setValueAtTime(0.0001, startTime);
  this.out.gain.exponentialRampToValueAtTime(st.gain || 1, startTime + fadeIn);
  var verbK = st.verb || 1;
  this.ch = {
    pad:   this._channel(0.75, 0, 0.45 * verbK, 0),
    keys:  this._channel(0.62, -0.12, 0.28 * verbK, 0.1),
    bass:  this._channel(0.7, 0, 0.04, 0),
    mel:   this._channel(0.62, 0.15, 0.3 * verbK, 0.2),
    bells: this._channel(0.32, 0.3, 0.55 * verbK, 0.25),
    arp:   this._channel(0.34, -0.25, 0.25 * verbK, 0.35),
    drums: this._channel(0.5, 0, 0.08, 0),
  };
  // Tempo-synced delay: dotted eighth
  var dt = this.spb * 0.75;
  G.delayL.delayTime.setValueAtTime(dt, startTime); G.delayR.delayTime.setValueAtTime(dt, startTime);
}

_Song.prototype._channel = function(vol, pan, verb, dly) {
  var ctx = this.ctx, G = this.G, input = ctx.createGain(); input.gain.value = vol;
  var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = pan; input.connect(p); p.connect(this.out); } else input.connect(this.out);
  if (verb) { var v = ctx.createGain(); v.gain.value = verb; input.connect(v); v.connect(G.musicVerb); this._verbSends = (this._verbSends || []).concat([v]); }
  if (dly) { var d = ctx.createGain(); d.gain.value = dly; input.connect(d); d.connect(G.delayIn); this._dlySends = (this._dlySends || []).concat([d]); }
  return { ctx: ctx, input: input, G: G };
};

// Scale-degree → MIDI (relative to key root, any octave)
_Song.prototype.deg = function(d) {
  var o = Math.floor(d / 7), k = ((d % 7) + 7) % 7;
  return this.root + 12 * o + this.scale[k];
};
// Chord tones (as MIDI in the bass octave) for a scale degree, stacked in thirds
_Song.prototype.chord = function(d) {
  var n = [this.deg(d), this.deg(d + 2), this.deg(d + 4), this.deg(d + 6)];
  if (this.st.ninths) n.push(this.deg(d + 8));
  return n;
};
// Place pitch classes inside [lo, hi) — a smooth closed voicing in a fixed register
function _voice(notes, lo, hi) {
  return notes.map(function(m) { while (m < lo) m += 12; while (m >= hi) m -= 12; return m; }).sort(function(a, b) { return a - b; });
}

_Song.prototype.section = function(bar) {
  var s = Math.floor(bar / 8) + (this.skipIntro ? 1 : 0), arr = this.arr;
  return s < arr.length ? arr[s] : arr[1 + ((s - 1) % (arr.length - 1))];
};

// Melody phrase: 4 bars built from a motif (statement, echo, development, cadence)
_Song.prototype.phrase = function(key) {
  if (this.phrases[key]) return this.phrases[key];
  var rng = _aRng((this.st.bpm * 977 + key * 7919 + this.root * 131) >>> 0 ^ (this.rng() * 1e9));
  var meter = this.meter;
  var cells4 = [[1, 1, 2], [0.5, 0.5, 1, 2], [1.5, 0.5, 2], [2, 1, 1], [0.5, 1, 0.5, 2], [1, 0.5, 0.5, 2], [3, 1], [1, 1, 1, 1]];
  var cells3 = [[1, 1, 1], [2, 1], [1.5, 0.5, 1], [1, 2]];
  var cells = meter === 3 ? cells3 : cells4, endCell = meter === 3 ? [1, 2] : [1, 3];
  var lo = this.root + 24 + 7, hi = lo + 17;
  var pool = [];
  for (var m = lo; m <= hi; m++) { var pc = ((m - this.root) % 12 + 12) % 12; if (this.pent.indexOf(pc) >= 0) pool.push(m); }
  var cur = pool[Math.floor(pool.length / 2)], notes = [], motif = _pick(rng, cells);
  for (var b = 0; b < 4; b++) {
    var cell = b === 0 || b === 2 ? motif : b === 3 ? endCell : _pick(rng, cells);
    var chordIdx = Math.floor(b / this.chordBars) % this.prog.length;
    var chordPcs = this.chord(this.prog[chordIdx]).map(function(x) { return ((x - this.root) % 12 + 12) % 12; }, this);
    var pos = 0;
    for (var i = 0; i < cell.length; i++) {
      var d = cell[i], strong = Math.abs(pos - Math.round(pos)) < 0.01 && Math.round(pos) % 2 === 0;
      var rest = (b > 0 || i > 0) && rng() < 0.16 && !(b === 3 && i === cell.length - 1);
      if (!rest) {
        var cands = pool.filter(function(x) { return Math.abs(x - cur) <= (strong ? 7 : 4) && x !== cur; });
        if (strong) {
          var ct = cands.filter(function(x) { return chordPcs.indexOf(((x - this.root) % 12 + 12) % 12) >= 0; }, this);
          if (ct.length) cands = ct;
        }
        if (b === 3 && i === cell.length - 1) {   // cadence: land on the chord root
          var rootPc = chordPcs[0];
          cands = pool.filter(function(x) { return ((x - this.root) % 12 + 12) % 12 === rootPc; }, this);
          cands.sort(function(a, c) { return Math.abs(a - cur) - Math.abs(c - cur); }); cands = cands.slice(0, 1);
        }
        if (!cands.length) cands = pool;
        // prefer stepwise motion
        cands.sort(function(a, c) { return Math.abs(a - cur) - Math.abs(c - cur) + (rng() - 0.5) * 3; });
        cur = cands[Math.min(cands.length - 1, Math.floor(rng() * Math.min(3, cands.length)))];
        notes.push({ bar: b, pos: pos, dur: d, m: cur, vel: strong ? 0.95 : 0.75 });
      }
      pos += d;
    }
  }
  this.phrases[key] = notes;
  return notes;
};

// Schedule every bar whose start falls before tEnd
_Song.prototype.scheduleUntil = function(tEnd) {
  while (this.nextBar < tEnd) { this.scheduleBar(this.bar, this.nextBar); this.bar++; this.nextBar += this.meter * this.spb; }
};

_Song.prototype.scheduleBar = function(bar, t0) {
  var st = this.st, spb = this.spb, meter = this.meter, rng = this.rng, self = this;
  var sec = this.section(bar), secIdx = Math.floor(bar / 8) + (this.skipIntro ? 1 : 0);
  var chordIdx = Math.floor(bar / this.chordBars) % this.prog.length;
  var deg = this.prog[chordIdx], chord = this.chord(deg);
  var firstOfChord = bar % this.chordBars === 0;
  function on(layer) { var v = sec[layer] || 0; return v > 0 && (v >= 1 || rng() < v); }
  function hum() { return (rng() - 0.5) * 0.014; }
  function stepT(step) {   // 16th-note grid with swing on the off-beats
    var t = t0 + step * spb / 4;
    if (step % 4 === 2) t += st.swing * spb / 2;
    else if (step % 2 === 1) t += st.swing * spb / 4;
    return t;
  }
  var barLen = meter * spb;

  // Pad: sustained chord (with an added 9th colour)
  if (on("pad") && firstOfChord) {
    var pv = _voice(chord.concat([chord[0] + 14]), this.root + 19, this.root + 34);
    _INS.pad(this.ch.pad, t0, pv, barLen * this.chordBars - 0.05, 0.9, st.pad);
  }
  // Keys: comping pattern
  if (on("keys")) {
    var kv = _voice(chord.slice(1).concat(st.ninths ? [] : [chord[0]]), this.root + 17, this.root + 31);
    var pat = st.compPat === "offbeat" ? [[0.5, 0.4, 0.7], [1.5, 0.4, 0.6], [2.5, 0.4, 0.7], [3.5, 0.4, 0.6]]
            : meter === 3 ? [[0, 2.8, 0.8]]
            : (this.chordBars > 1 ? (bar % 2 === 0 ? [[0, 3.6, 0.85]] : [[1, 1.2, 0.55], [2.5, 1.4, 0.6]])
            : _pick(rng, [[[0, 1.4, 0.85], [1.5, 0.45, 0.5], [2.5, 1.4, 0.7]], [[0, 3.5, 0.85]], [[0, 1.4, 0.8], [2, 1.8, 0.7]]]));
    pat.forEach(function(p) {
      kv.forEach(function(m, i) {
        var t = t0 + p[0] * spb + i * 0.012 + hum();   // slight strum
        if (st.comp === "pluck") _INS.pluck(self.ch.keys, t, m, p[1] * spb, p[2] * 0.8);
        else _INS.ep(self.ch.keys, t, m, p[1] * spb, p[2] * 0.85, st.softKeys);
      });
    });
  }
  // Bass
  if (on("bass")) {
    var r = chord[0]; while (r > this.root + 7) r -= 12; while (r < this.root - 5) r += 12;
    var bp = st.bassPat === "octave" ? [[0, 0.45, 0, 1], [0.5, 0.4, 12, 0.7], [1, 0.45, 0, 0.9], [1.5, 0.4, 12, 0.7], [2, 0.45, 0, 1], [2.5, 0.4, 12, 0.7], [3, 0.45, 7, 0.9], [3.5, 0.4, 12, 0.7]]
           : st.bassPat === "bounce" ? [[0, 0.9, 0, 1], [1, 0.4, 7, 0.75], [2, 0.9, 0, 0.9], [3, 0.4, 7, 0.75]]
           : meter === 3 ? [[0, 2.5, 0, 1]]
           : this.chordBars > 1 ? (bar % 2 === 0 ? [[0, 3.6, 0, 1]] : [[0, 1.8, 7, 0.8], [2, 1.8, 0, 0.85]])
           : [[0, 1.6, 0, 1], [2.5, 0.5, 7, 0.7], [3, 0.9, 0, 0.8]];
    bp.forEach(function(p) { _INS.bass(self.ch.bass, t0 + p[0] * spb + hum(), r + p[2], p[1] * spb, p[3]); });
  }
  // Drums
  if (st.drums && on("drums")) {
    var D = _DRUMS[st.drums], steps = meter * 4;
    Object.keys(D).forEach(function(inst) {
      for (var s = 0; s < steps; s++) {
        var v = D[inst][s]; if (!v) continue;
        v *= 0.85 + rng() * 0.3;
        var t = stepT(s) + hum() * 0.6;
        if (inst === "hatOpen") _INS.hat(self.ch.drums, t, v, true);
        else _INS[inst](self.ch.drums, t, v);
      }
    });
  }
  // Melody (phrases repeat within a section; a new phrase each section)
  if (on("mel")) {
    var ph = this.phrase(secIdx % 3), pb = bar % 4;
    ph.forEach(function(n) {
      if (n.bar !== pb) return;
      var m = n.m;
      var t = t0 + n.pos * spb + hum();
      if (n.pos % 1 === 0.5) t += st.swing * spb / 2;
      _INS[st.lead](self.ch.mel, t, m, n.dur * spb * 0.95, n.vel * 0.85, st.softKeys);
    });
  }
  // Bells: sparse sparkle on chord tones, high up
  if (on("bells")) {
    var bv = _voice(chord, this.root + 36, this.root + 48);
    for (var k = 0; k < meter; k++) if (rng() < 0.32) _INS[st.bells](this.ch.bells, t0 + k * spb + (rng() < 0.5 ? spb / 2 : 0), _pick(rng, bv), spb, 0.55);
  }
  // Arpeggio (synth styles, or as a layer when the section asks)
  if (on("arp") && (st.arpOn || st.lead === "pluck" || rng() < 0.6)) {
    var av = _voice(chord.concat([chord[0] + 12]), this.root + 24, this.root + 40);
    var seq = av.concat(av.slice(1, -1).reverse());
    var steps2 = meter * 2;
    for (var a = 0; a < steps2; a++) {
      var ta = t0 + a * spb / 2 + (a % 2 ? st.swing * spb / 2 : 0);
      if (st.arpOn || st.lead === "pluck") _INS.pluck(this.ch.arp, ta, seq[a % seq.length], spb / 2, a % 4 === 0 ? 0.8 : 0.55);
      else _INS.kalimba(this.ch.arp, ta, seq[a % seq.length], spb / 2, a % 4 === 0 ? 0.6 : 0.4);
    }
  }
};

_Song.prototype.fadeOut = function(t, dur) {
  var g = this.out.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.0001, t + dur);
  var out = this.out;
  setTimeout(function() { try { out.disconnect(); } catch (e) {} }, (dur + 6) * 1000);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── AMBIENCE ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function _Ambience(G, recipe, t0, fadeIn) {
  var ctx = G.ctx; this.G = G; this.ctx = ctx; this.recipe = recipe; this.srcs = [];
  this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(G.amb);
  this.out.gain.setValueAtTime(0.0001, t0); this.out.gain.exponentialRampToValueAtTime(1, t0 + (fadeIn || 3));
  this.nextBird = t0 + 2; this.nextCricket = t0 + 1; this.nextDrip = t0 + 1; this.nextCar = t0 + 4; this.nextBubble = t0 + 2;
  var self = this;
  function loop(buf, lpF, hpF, gain) {
    var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(t0, Math.random() * 2.5);
    var node = s;
    if (hpF) { var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = hpF; node.connect(hp); node = hp; }
    if (lpF) { var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = lpF; node.connect(lp); node = lp; }
    var g = ctx.createGain(); g.gain.value = gain; node.connect(g);
    self.srcs.push(s);
    return { src: s, out: g, lp: lp };
  }
  function lfo(freq, depth, target, offset) {
    var o = ctx.createOscillator(); o.frequency.value = freq; var d = ctx.createGain(); d.gain.value = depth;
    o.connect(d); d.connect(target); o.start(t0); self.srcs.push(o);
    if (offset !== undefined) target.value = offset;
  }
  if (recipe.indexOf("ocean") >= 0) {
    var sw = loop(G.brown, 380, 0, 0.0); sw.out.connect(this.out); lfo(0.075, 0.022, sw.out.gain, 0.034);
    var foam = loop(G.white, 4200, 1800, 0.0); foam.out.connect(this.out); lfo(0.075, 0.0035, foam.out.gain, 0.004);
  }
  {
    // Wind is always present (silent until weather / theme raises it)
    var wn = loop(G.white, 0, 0, 1);
    var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 650; bp.Q.value = 0.8;
    wn.out.disconnect(); wn.out.connect(bp);
    this.windGain = ctx.createGain(); this.windGain.gain.value = recipe.indexOf("wind") >= 0 ? 0.014 : 0;
    bp.connect(this.windGain); this.windGain.connect(this.out);
    lfo(0.11, 260, bp.frequency, 650);
    this.windBase = this.windGain.gain.value;
  }
  // Rain bed (raised by weather)
  var rn = loop(G.white, 7000, 1100, 1); this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
  rn.out.connect(this.rainGain); this.rainGain.connect(this.out);
  if (recipe.indexOf("hum") >= 0) {
    [60, 120, 180].forEach(function(f, i) {
      var o = ctx.createOscillator(); o.frequency.value = f; var g = ctx.createGain(); g.gain.value = [0.012, 0.007, 0.003][i];
      o.connect(g); g.connect(self.out); o.start(t0); self.srcs.push(o);
    });
    var air = loop(G.brown, 300, 0, 0.03); air.out.connect(this.out);
  }
  if (recipe.indexOf("space") >= 0) {
    [55, 82.6, 110.3].forEach(function(f, i) {
      var o = ctx.createOscillator(); o.frequency.value = f; var g = ctx.createGain(); g.gain.value = [0.012, 0.007, 0.0035][i];
      o.connect(g); g.connect(self.out); o.start(t0); self.srcs.push(o);
      lfo(0.05 + i * 0.03, [0.006, 0.0035, 0.002][i], g.gain);
    });
  }
  if (recipe.indexOf("lava") >= 0) {
    var rum = loop(G.brown, 140, 0, 0.05); rum.out.connect(this.out); lfo(0.06, 0.02, rum.out.gain, 0.05);
  }
  if (recipe.indexOf("traffic") >= 0) {
    var tr = loop(G.brown, 260, 0, 0.018); tr.out.connect(this.out);
  }
  if (recipe.indexOf("drips") >= 0) {
    var pool = loop(G.brown, 600, 0, 0.04); pool.out.connect(this.out); lfo(0.09, 0.02, pool.out.gain, 0.04);
  }
}

_Ambience.prototype.tick = function(now) {
  var ctx = this.ctx, r = this.recipe, self = this, look = now + 0.3;
  function pan(node, v) { if (!ctx.createStereoPanner) return node; var p = ctx.createStereoPanner(); p.pan.value = v; node.connect(p); return p; }
  // Birdsong: short phrases of chirps from random directions
  if (r.indexOf("birds") >= 0 && this.nextBird < look) {
    var t = this.nextBird, n = 2 + Math.floor(Math.random() * 4), base = 2400 + Math.random() * 1600, pv = Math.random() * 1.6 - 0.8;
    for (var i = 0; i < n; i++) {
      var tt = t + i * (0.09 + Math.random() * 0.08), o = ctx.createOscillator(), g = ctx.createGain();
      var f0 = base * (0.9 + Math.random() * 0.25);
      o.frequency.setValueAtTime(f0, tt); o.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.35), tt + 0.05);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.95, tt + 0.09);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.009, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.1);
      o.connect(g); pan(g, pv).connect(this.out); o.start(tt); o.stop(tt + 0.12);
    }
    this.nextBird = t + 3 + Math.random() * 7;
  }
  // Crickets: soft pulsed trills
  if (r.indexOf("crickets") >= 0 && this.nextCricket < look) {
    var tc = this.nextCricket, fc = 4300 + Math.random() * 600, pc = Math.random() * 1.6 - 0.8;
    for (var k = 0; k < 3; k++) {
      var t1 = tc + k * 0.06, oc = ctx.createOscillator(), gc = ctx.createGain();
      oc.frequency.value = fc; gc.gain.setValueAtTime(0, t1); gc.gain.linearRampToValueAtTime(0.006, t1 + 0.008); gc.gain.linearRampToValueAtTime(0, t1 + 0.035);
      oc.connect(gc); pan(gc, pc).connect(this.out); oc.start(t1); oc.stop(t1 + 0.04);
    }
    this.nextCricket = tc + 0.45 + Math.random() * 1.6;
  }
  // Drips echoing in the poolrooms
  if (r.indexOf("drips") >= 0 && this.nextDrip < look) {
    var td = this.nextDrip, od = ctx.createOscillator(), gd = ctx.createGain();
    od.frequency.setValueAtTime(1500 + Math.random() * 900, td); od.frequency.exponentialRampToValueAtTime(600, td + 0.05);
    gd.gain.setValueAtTime(0.03, td); gd.gain.exponentialRampToValueAtTime(0.0001, td + 0.08);
    od.connect(gd); gd.connect(this.out); var vs = ctx.createGain(); vs.gain.value = 1.2; gd.connect(vs); vs.connect(this.G.sfxVerb);
    od.start(td); od.stop(td + 0.1);
    this.nextDrip = td + 1.5 + Math.random() * 4;
  }
  // Lava bubbles
  if (r.indexOf("lava") >= 0 && this.nextBubble < look) {
    var tb = this.nextBubble, ob = ctx.createOscillator(), gb = ctx.createGain();
    ob.frequency.setValueAtTime(90, tb); ob.frequency.exponentialRampToValueAtTime(260, tb + 0.12);
    gb.gain.setValueAtTime(0.05, tb); gb.gain.exponentialRampToValueAtTime(0.0001, tb + 0.16);
    ob.connect(gb); gb.connect(this.out); ob.start(tb); ob.stop(tb + 0.18);
    this.nextBubble = tb + 0.8 + Math.random() * 2.5;
  }
};

_Ambience.prototype.setWeather = function(w, t) {
  var rain = { rainy: 0.032, stormy: 0.055 }[w] || 0;
  var wind = { windy: 0.04, stormy: 0.05, snow: 0.018, foggy: 0.009, rainy: 0.016 }[w] || 0;
  this.rainGain.gain.setTargetAtTime(rain, t, 1.2);
  if (this.windGain) this.windGain.gain.setTargetAtTime(Math.max(this.windBase || 0, wind), t, 1.5);
};

_Ambience.prototype.fadeOut = function(t, dur) {
  var g = this.out.gain, srcs = this.srcs, out = this.out;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.0001, t + dur);
  setTimeout(function() { srcs.forEach(function(s) { try { s.stop(); } catch (e) {} }); try { out.disconnect(); } catch (e) {} }, (dur + 0.5) * 1000);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── SOUND EFFECTS ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
var _SFX = {
  _noise: function(G, t, dur, type, f, q, vol, verb) {
    var ctx = G.ctx, n = ctx.createBufferSource(); n.buffer = G.white;
    var fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.7;
    var g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(fl); fl.connect(g); g.connect(G.sfx); if (verb) { var v = ctx.createGain(); v.gain.value = verb; g.connect(v); v.connect(G.sfxVerb); }
    n.start(t, Math.random() * 2); n.stop(t + dur + 0.02);
    return fl;
  },
  _tone: function(G, t, type, f0, f1, dur, vol, verb, attack) {
    var ctx = G.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.9);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(G.sfx); if (verb) { var v = ctx.createGain(); v.gain.value = verb; g.connect(v); v.connect(G.sfxVerb); }
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  },
  _metal: function(G, t, f, vol, dec) {   // inharmonic bell partials
    var self = this;
    [[1, 1, 1], [2.76, 0.6, 0.6], [5.4, 0.35, 0.4], [8.93, 0.18, 0.25]].forEach(function(p) {
      self._tone(G, t, "sine", f * p[0], f * p[0], dec * p[2], vol * p[1], 0.35);
    });
  },
  throw: function(G, t, k) {
    k = Math.max(0.2, Math.min(1, k || 0.6));
    var fl = this._noise(G, t, 0.45, "bandpass", 500, 1.2, 0.42 * k, 0.1);
    fl.frequency.setValueAtTime(500, t); fl.frequency.exponentialRampToValueAtTime(1900 + k * 900, t + 0.18); fl.frequency.exponentialRampToValueAtTime(700, t + 0.42);
    this._tone(G, t, "sine", 160, 90, 0.12, 0.13 * k);
  },
  terrain: function(G, t, k) {
    this._tone(G, t, "sine", 120, 52, 0.16, 0.28 * k + 0.05);
    this._noise(G, t, 0.14, "lowpass", 380, 0.7, 0.2 * k + 0.04);
    this._noise(G, t + 0.02, 0.18, "bandpass", 2600, 0.8, 0.05 * k);   // grass rustle
  },
  wall: function(G, t, k) { this._tone(G, t, "sine", 95, 45, 0.18, 0.3 * k + 0.05); this._noise(G, t, 0.05, "bandpass", 1600, 1.5, 0.12 * k + 0.03); },
  wood: function(G, t, k) {
    this._noise(G, t, 0.07, "bandpass", 820, 4, 0.75 * k + 0.15, 0.2);
    this._tone(G, t, "triangle", 230, 170, 0.11, 0.16 * k + 0.04, 0.2);
  },
  metal: function(G, t, k) {
    this._metal(G, t, 560 + Math.random() * 120, 0.12 * k + 0.04, 0.9);
    this._noise(G, t, 0.03, "highpass", 4000, 0.7, 0.12 * k);
  },
  // The money sound: chains catching the disc, then it settling into the tray
  basket: function(G, t, k) {
    k = Math.max(0.35, k || 0.6);
    var n = 16 + Math.floor(k * 14);
    for (var i = 0; i < n; i++) {
      var tt = t + Math.pow(Math.random(), 1.6) * 0.75;
      var f = 2300 + Math.random() * 3600;
      this._tone(G, tt, "sine", f, f, 0.08 + Math.random() * 0.18, (0.05 + Math.random() * 0.05) * k * (1 - (tt - t) * 0.8), 0.5);
      this._tone(G, tt, "sine", f * 2.76, f * 2.76, 0.05, 0.015 * k, 0.4);
    }
    this._noise(G, t, 0.5, "bandpass", 5200, 1.2, 0.09 * k, 0.4);
    this._tone(G, t + 0.18, "sine", 210, 160, 0.14, 0.12 * k);           // disc lands in the tray
    this._noise(G, t + 0.18, 0.08, "lowpass", 900, 0.7, 0.08 * k);
  },
  water: function(G, t, k) {
    k = Math.max(0.3, k || 0.6);
    var fl = this._noise(G, t, 0.6, "lowpass", 3000, 0.6, 0.3 * k, 0.25);
    fl.frequency.setValueAtTime(3500, t); fl.frequency.exponentialRampToValueAtTime(350, t + 0.55);
    for (var i = 0; i < 6; i++) { var tb = t + 0.08 + Math.random() * 0.5, fb = 300 + Math.random() * 500; this._tone(G, tb, "sine", fb, fb * 2.2, 0.06, 0.05 * k, 0.3); }
  },
  energy: function(G, t, k) { this._tone(G, t, "sine", 260, 70, 0.5, 0.2 * k + 0.05, 0.3); this._noise(G, t, 0.4, "lowpass", 500, 0.7, 0.12 * k); },
  boom: function(G, t) {
    this._tone(G, t, "sine", 90, 32, 0.9, 0.5, 0.3);
    var fl = this._noise(G, t, 1.1, "lowpass", 1800, 0.6, 0.4, 0.4); fl.frequency.exponentialRampToValueAtTime(200, t + 1);
  },
  bonk: function(G, t) {
    var o = this._tone(G, t, "sine", 620, 210, 0.32, 0.22, 0.2);
    var lfo = G.ctx.createOscillator(), lg = G.ctx.createGain(); lfo.frequency.value = 28; lg.gain.value = 30;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 0.34);
    this.wood(G, t, 0.7);
  },
  click: function(G, t) { this._tone(G, t, "sine", 1250, 950, 0.035, 0.05); this._noise(G, t, 0.015, "highpass", 5000, 0.7, 0.015); },
  // ── Character foley ──
  step: function(G, t, k) {   // k encodes the surface: 0.2 soft (grass/carpet) … 1 hard (stone/metal)
    var f = 700 + k * 1800 + Math.random() * 300;
    this._noise(G, t, 0.05 + (1 - k) * 0.04, "bandpass", f, 1.1, 0.035 + k * 0.03);
    this._tone(G, t, "sine", 110 + k * 60, 70, 0.05, 0.03);
  },
  jump: function(G, t) { this._noise(G, t, 0.14, "bandpass", 900, 0.9, 0.05); this._tone(G, t, "sine", 280, 520, 0.12, 0.035); },
  land: function(G, t, k) { this._tone(G, t, "sine", 130, 55, 0.14, 0.12 * k + 0.03); this._noise(G, t, 0.1, "lowpass", 600, 0.7, 0.08 * k + 0.02); },
  pickup: function(G, t) {
    [79, 86].forEach(function(m, i) { _SFX._tone(G, t + i * 0.07, "sine", _mtof(m), _mtof(m), 0.35, 0.06, 0.4); _SFX._tone(G, t + i * 0.07, "triangle", _mtof(m + 12), _mtof(m + 12), 0.12, 0.012, 0.4); });
  },
  boing: function(G, t) { var o = this._tone(G, t, "sine", 180, 720, 0.4, 0.14, 0.2); this._tone(G, t, "triangle", 360, 1440, 0.25, 0.03); },
  splash: function(G, t) { this.water(G, t, 0.8); this._noise(G, t + 0.05, 0.6, "lowpass", 1200, 0.6, 0.12, 0.3); },
  swipe: function(G, t) { var fl = this._noise(G, t, 0.25, "bandpass", 2400, 2, 0.08); fl.frequency.exponentialRampToValueAtTime(600, t + 0.22); this._tone(G, t + 0.05, "square", 900, 600, 0.06, 0.015); },
  zap: function(G, t) { this._tone(G, t, "sawtooth", 880, 110, 0.3, 0.06, 0.2); this._noise(G, t, 0.2, "highpass", 3000, 0.7, 0.05); },
  honk: function(G, t) { this._tone(G, t, "square", 392, 392, 0.32, 0.035); this._tone(G, t, "square", 494, 494, 0.32, 0.03); },
  powerup: function(G, t) {
    [72, 76, 79, 84, 88].forEach(function(m, i) { _SFX._tone(G, t + i * 0.055, "sine", _mtof(m), _mtof(m), 0.5, 0.07, 0.6); _SFX._tone(G, t + i * 0.055, "sine", _mtof(m) * 3.5, _mtof(m) * 3.5, 0.18, 0.015, 0.6); });
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// ── ENGINE (public API) ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
var AudioEngine = {
  ctx: null,
  nodes: [],
  intervals: [],
  G: null,
  song: null,
  amb: null,
  _gameActive: false,
  _menuActive: false,
  _weather: "clear",
  settings: { music: 0.7, ambience: 0.7, sfx: 0.85, muted: false },

  init: function() {
    if (this.ctx) { this.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC({ latencyHint: "interactive" }); } catch (e) { this.ctx = new AC(); }
    this._loadSettings();
    this.G = _buildAudioGraph(this.ctx);
    this.ctx.onstatechange = function() { AudioEngine._syncUI(); };
    this._applyVolumes(true);
    var self = this;
    this._timer = setInterval(function() { self._tick(); }, 25);
    document.addEventListener("visibilitychange", function() {
      if (!self.ctx) return;
      if (document.hidden) self.ctx.suspend(); else self.resume();
    });
    // Soft UI clicks
    document.addEventListener("click", function(e) {
      var el = e.target && e.target.closest && e.target.closest("button, .tile, .skin-card:not(.locked), .chip");
      if (el && self.ctx) self.sfx("click");
    }, true);
    this.resume();
  },
  resume: function() {
    if (this.ctx && this.ctx.state !== "running" && !document.hidden) {
      var p = this.ctx.resume(); if (p && p.then) p.then(function() { AudioEngine._syncUI(); }, function() {});
    }
  },

  _tick: function() {
    if (!this.ctx || this.ctx.state !== "running") return;
    var t = this.ctx.currentTime;
    if (this.song) this.song.scheduleUntil(t + 0.3);
    if (this.amb) this.amb.tick(t);
  },

  // ── Settings ──
  _loadSettings: function() {
    try { var s = JSON.parse(localStorage.getItem("dg_audio") || "null"); if (s) Object.assign(this.settings, s); } catch (e) {}
  },
  _saveSettings: function() { try { localStorage.setItem("dg_audio", JSON.stringify(this.settings)); } catch (e) {} },
  _applyVolumes: function(instant) {
    if (!this.G) return;
    var s = this.settings, m = s.muted ? 0 : 1, t = this.ctx.currentTime;
    // Perceptual (squared) slider curve
    var set = function(p, v) { if (instant) p.value = v; else p.setTargetAtTime(v, t, 0.05); };
    set(this.G.musicVol.gain, m * s.music * s.music * 0.85);
    set(this.G.ambVol.gain, m * s.ambience * s.ambience * 1.1);
    set(this.G.sfxVol.gain, m * s.sfx * s.sfx * 1.0);
  },
  setVolume: function(kind, v) { this.settings[kind] = Math.max(0, Math.min(1, v)); this._applyVolumes(); this._saveSettings(); this._syncUI(); },
  toggleMute: function() { this.settings.muted = !this.settings.muted; this._applyVolumes(); this._saveSettings(); this._syncUI(); },
  _syncUI: function() {
    var b = document.getElementById("sound-btn"); if (b) b.classList.toggle("muted", !!this.settings.muted);
    ["music", "ambience", "sfx"].forEach(function(k) { var el = document.getElementById("vol-" + k); if (el && document.activeElement !== el) el.value = Math.round(AudioEngine.settings[k] * 100); });
    var mt = document.getElementById("vol-mute"); if (mt) mt.textContent = this.settings.muted ? "Unmute" : "Mute all";
    // "Tap for sound" hint until the browser lets audio run
    var hint = document.getElementById("sound-hint");
    if (hint) hint.classList.toggle("on", !this.ctx || this.ctx.state !== "running");
  },

  // ── Music ──
  _startSong: function(style, seed, opts) {
    if (!this.G) return;
    var t = this.ctx.currentTime;
    if (this.song) this.song.fadeOut(t, 1.4);
    this.song = new _Song(this.G, style, seed, t + 0.12, opts);
    this._style = style;
  },
  _startAmb: function(recipe, fadeIn) {
    if (!this.G) return;
    var t = this.ctx.currentTime;
    if (this.amb) this.amb.fadeOut(t, 2);
    this.amb = new _Ambience(this.G, recipe, t + 0.1, fadeIn);
    this.amb.setWeather(this._weather, t);
  },
  playMenu: function() {
    if (!this.ctx || this._gameActive) return;
    if (this._menuActive) return;
    this._menuActive = true;
    this._weather = "clear";
    // Soft, slow swell — nobody should be startled by the menu
    this._startSong("menu", 20240917, { fadeIn: 6 });
    this._startAmb(["ocean", "birds"], 7);
  },
  stopMenu: function() { this._menuActive = false; },
  stopAll: function() {
    this._menuActive = false;
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    if (this.song) { this.song.fadeOut(t, 1.2); this.song = null; }
    if (this.amb) { this.amb.fadeOut(t, 1.2); this.amb = null; }
    this.updateFlight(false, 0, false);
  },
  // seed: varies the tune per hole (same course style, new song each hole)
  playTheme: function(theme, seed) {
    if (!this.ctx) return;
    this._gameActive = true;
    this._menuActive = false;
    var style = _THEME_STYLE[theme] || "island";
    var recipe = _THEME_AMB[theme] || ["ocean", "birds"];
    // Start straight in the course's groove so the change of music is immediate
    this._startSong(style, (seed || Math.floor(Math.random() * 1e9)) >>> 0, { skipIntro: true, fadeIn: 1.2 });
    this._startAmb(recipe, 3);
  },
  setWeather: function(w) {
    this._weather = w || "clear";
    if (this.amb && this.ctx) this.amb.setWeather(this._weather, this.ctx.currentTime);
  },

  // ── Adaptive: disc flight whoosh + slow-mo muffle ──
  updateFlight: function(flying, speed, slowmo) {
    if (!this.G || this.ctx.state !== "running") return;
    var ctx = this.ctx, t = ctx.currentTime;
    if (!this._whoosh && flying) {
      var n = ctx.createBufferSource(); n.buffer = this.G.white; n.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.9; bp.frequency.value = 600;
      var g = ctx.createGain(); g.gain.value = 0;
      n.connect(bp); bp.connect(g); g.connect(this.G.sfx); n.start();
      this._whoosh = { src: n, bp: bp, g: g };
    }
    if (this._whoosh) {
      var k = flying ? Math.min(1, speed / 28) : 0;
      this._whoosh.g.gain.setTargetAtTime(k * k * 0.07, t, 0.08);
      this._whoosh.bp.frequency.setTargetAtTime(380 + k * 1300, t, 0.1);
    }
    var lpTarget = slowmo ? 650 : 20000;
    if (this._lpState !== slowmo) {
      this._lpState = slowmo;
      this.G.musicLP.frequency.cancelScheduledValues(t);
      this.G.musicLP.frequency.setTargetAtTime(lpTarget, t, slowmo ? 0.12 : 0.4);
    }
  },

  // Lower the music briefly (stingers, big moments)
  _duck: function(depth, hold) {
    if (!this.G) return;
    var g = this.G.musicDuck.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setTargetAtTime(depth, t, 0.06); g.setTargetAtTime(1, t + hold, 0.6);
  },

  // ── Score stingers (in the key of the current song) ──
  stinger: function(kind) {
    if (!this.G || !this.ctx) return;
    var G = this.G, t = this.ctx.currentTime + 0.03, root = this.song ? this.song.root + 24 : 60;
    var major = !this.song || ["major", "lydian", "mixolydian"].indexOf(this.song.st.mode) >= 0;
    var third = major ? 4 : 3;
    var ch = { ctx: this.ctx, input: G.sfx, G: G };
    var verbSend = this.ctx.createGain(); verbSend.gain.value = 0.6; verbSend.connect(G.sfxVerb);
    var chV = { ctx: this.ctx, input: this.ctx.createGain(), G: G }; chV.input.connect(G.sfx); chV.input.connect(verbSend);
    var seq = function(ins, notes, step, vel) { notes.forEach(function(m, i) { _INS[ins](chV, t + i * step, root + m, step * 2, vel); }); };
    if (kind === "ace") {
      this._duck(0.25, 3.5);
      _INS.pad(chV, t, [root - 12, root - 5, root + third - 12, root + 2], 3.2, 2.4, 1600);
      seq("bell", [0, third, 7, 12, 12 + third, 19, 24], 0.09, 0.9);
      seq("kalimba", [0, third, 7, 12, 12 + third, 19, 24], 0.09, 0.8);
      for (var i = 0; i < 10; i++) _INS.bell(chV, t + 0.7 + i * 0.07, root + 24 + [0, 7, 12, 4, 9, 14, 2, 11, 16, 19][i], 0.3, 0.35);
    } else if (kind === "eagle" || kind === "birdie") {
      this._duck(0.45, 1.8);
      seq("kalimba", kind === "eagle" ? [0, third, 7, 12, 16, 19] : [0, third, 7, 12], 0.085, 0.95);
      seq("bell", kind === "eagle" ? [12, 19, 24] : [12, 19], 0.17, 0.5);
    } else if (kind === "par") {
      this._duck(0.6, 1.2);
      seq("ep", [7, 12], 0.16, 0.75);
    } else if (kind === "bogey") {
      this._duck(0.6, 1.2);
      seq("ep", [7, third + 0, 0], 0.18, 0.6);
    } else if (kind === "worse") {
      this._duck(0.65, 1.2);
      seq("ep", [5, 2, -1], 0.2, 0.55);
    } else if (kind === "water") {
      seq("marimba", [7, 5, 0], 0.13, 0.55);
    } else if (kind === "round") {
      this._duck(0.2, 4.5);
      [[0, third, 7], [5, 9, 12], [7, 11, 14], [12, 12 + third, 19]].forEach(function(c, i) {
        c.forEach(function(m) { _INS.ep(chV, t + i * 0.32, root + m - 12, i === 3 ? 2.2 : 0.3, 0.8); });
      });
      seq("bell", [12, 16, 19, 24, 28, 31], 0.11, 0.6);
    }
  },

  // Beats elapsed since the current song started (drives club lights, lifts, LED floors)
  beatPhase: function() {
    var s = this.song;
    if (!s || !this.ctx || this.ctx.state !== "running") return (typeof T !== "undefined" ? T : performance.now() / 1000) * 2;
    return Math.max(0, (this.ctx.currentTime - s.t0) / s.spb);
  },

  // ── One-shot effects ──
  sfx: function(name, intensity) {
    if (!this.G || !this.ctx || this.ctx.state !== "running") return;
    var fn = _SFX[name] || _SFX[{ tree: "wood", crater: "energy", lava: "energy", grass: "terrain", snow: "terrain" }[name]];
    if (!fn) return;
    fn.call(_SFX, this.G, this.ctx.currentTime + 0.005, intensity === undefined ? 0.7 : intensity);
  },
};

// Offline rendering hook (used by tests to check levels per style)
AudioEngine._renderStyleOffline = function(style, seconds, seed) {
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  var ctx = new OAC(2, Math.floor(44100 * seconds), 44100);
  var G = _buildAudioGraph(ctx);
  G.musicVol.gain.value = 0.85 * 0.49; G.ambVol.gain.value = 0; G.sfxVol.gain.value = 0;
  var s = new _Song(G, style, seed || 1234, 0.05, { skipIntro: style !== "menu" });
  s.scheduleUntil(seconds);
  return ctx.startRendering();
};
