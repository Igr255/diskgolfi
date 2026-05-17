"use strict";

// ══════════════════════════════════════════════════════════
// ── AUDIO ENGINE ──
// Procedural Web Audio API music — one theme per hole.
// Each playXxx() method creates oscillators/filters and
// stores them in this.nodes / this.intervals for cleanup.
// ══════════════════════════════════════════════════════════

var AudioEngine = {
  ctx: null,
  nodes: [],
  intervals: [],

  init: function () {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this._menuIntervals = [];
    this._menuActive    = false;
    this._menuGain      = null;
    this._menuPads      = null;
  },

  // ── helper: master gain + compressor keeps everything balanced ──
  _master: function(vol) {
    var ctx = this.ctx;
    var g = ctx.createGain(); g.gain.value = vol || 1.0;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10;
    comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    g.connect(comp); comp.connect(ctx.destination);
    this.nodes.push(g, comp);
    return g;
  },

  // ────────────────────────────────────────────────────────────────
  // EERIE — detuned drones create beating, occasional descending phrase
  playEerie: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    [[110, 110.6], [164.81, 165.3]].forEach(([f1, f2]) => {
      [f1, f2].forEach(f => {
        var o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
        var g = ctx.createGain(); g.gain.value = 0.022;
        o.connect(g).connect(out); o.start(); this.nodes.push(o, g);
      });
    });
    var scale = [293.66, 261.63, 246.94, 220, 196, 174.61], si = 0;
    var int = setInterval(() => {
      if (ctx.state === "suspended" || Math.random() > 0.38) return;
      var o = ctx.createOscillator(); o.type = "triangle";
      o.frequency.value = scale[si % scale.length];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.04, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);
      o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 2.4);
      this.nodes.push(o, g); si++;
    }, 2000);
    this.intervals.push(int);
  },

  // FUNNY — bouncy C major melody + bass pluck
  playFunny: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var melody = [523.25,659.25,783.99,659.25,523.25,392,523.25,659.25,523.25,392,329.63,392,523.25];
    var bass   = [130.81, 196, 130.81, 164.81];
    var ms = 0, bs = 0;
    var melI = setInterval(() => {
      if (ctx.state === "suspended") return;
      var o = ctx.createOscillator(); o.type = "triangle";
      o.frequency.value = melody[ms % melody.length];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.07, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 0.2);
      this.nodes.push(o, g); ms++;
    }, 200);
    var basI = setInterval(() => {
      if (ctx.state === "suspended") return;
      var b = ctx.createOscillator(); b.type = "triangle";
      b.frequency.value = bass[bs % bass.length];
      var bg = ctx.createGain();
      bg.gain.setValueAtTime(0.055, ctx.currentTime);
      bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      b.connect(bg).connect(out); b.start(); b.stop(ctx.currentTime + 0.4);
      this.nodes.push(b, bg); bs++;
    }, 800);
    this.intervals.push(melI, basI);
  },

  // NEON — synthwave arpeggio + kick at sensible gain (was 0.5, now 0.12)
  playNeon: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var arp = [293.66, 369.99, 440, 587.33, 440, 369.99, 293.66, 220];
    var an = 0, beat = 0;
    var arpI = setInterval(() => {
      if (ctx.state === "suspended") return;
      var o = ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.value = arp[an % arp.length];
      var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1800;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.055, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      o.connect(f).connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 0.18);
      this.nodes.push(o, f, g); an++;
    }, 200);
    var kickI = setInterval(() => {
      if (ctx.state === "suspended") return;
      var k = ctx.createOscillator(); k.type = "sine";
      k.frequency.setValueAtTime(130, ctx.currentTime);
      k.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.32);
      var kg = ctx.createGain();
      kg.gain.setValueAtTime(0.12, ctx.currentTime);
      kg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      k.connect(kg).connect(out); k.start(); k.stop(ctx.currentTime + 0.35);
      this.nodes.push(k, kg);
      var bFreqs = [73.42, 73.42, 87.31, 73.42];
      var b = ctx.createOscillator(); b.type = "sawtooth";
      b.frequency.value = bFreqs[beat % 4];
      var bf = ctx.createBiquadFilter(); bf.type = "lowpass"; bf.frequency.value = 400;
      var bg = ctx.createGain();
      bg.gain.setValueAtTime(0.07, ctx.currentTime);
      bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      b.connect(bf).connect(bg).connect(out); b.start(); b.stop(ctx.currentTime + 0.5);
      this.nodes.push(b, bf, bg); beat++;
    }, 500);
    this.intervals.push(arpI, kickI);
  },

  // TERRIFYING — deep cinematic horror, slow rumble, no random screeches
  playTerrifying: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var base = ctx.createOscillator(); base.type = "sawtooth"; base.frequency.value = 38;
    var bf = ctx.createBiquadFilter(); bf.type = "lowpass"; bf.frequency.value = 200;
    var bg = ctx.createGain(); bg.gain.value = 0.06;
    base.connect(bf).connect(bg).connect(out); base.start();
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.1;
    var lg = ctx.createGain(); lg.gain.value = 5;
    lfo.connect(lg); lg.connect(base.frequency);
    lfo.start(); this.nodes.push(base, bf, bg, lfo, lg);
    var int = setInterval(() => {
      if (ctx.state === "suspended" || Math.random() > 0.3) return;
      var s = ctx.createOscillator(); s.type = "sawtooth";
      s.frequency.setValueAtTime(100, ctx.currentTime);
      s.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 2.2);
      var sf = ctx.createBiquadFilter(); sf.type = "lowpass"; sf.frequency.value = 280;
      var sg = ctx.createGain();
      sg.gain.setValueAtTime(0.04, ctx.currentTime);
      sg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);
      s.connect(sf).connect(sg).connect(out); s.start(); s.stop(ctx.currentTime + 2.4);
      this.nodes.push(s, sf, sg);
    }, 2800);
    this.intervals.push(int);
  },

  // FEET BUNNIES — cute & bouncy, high C pentatonic, no dissonant multipliers
  playFeetBunnies: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var notes = [523.25, 659.25, 783.99, 880, 1046.5, 880, 783.99, 659.25];
    var bass  = [261.63, 261.63, 329.63, 392];
    var ms = 0, bs = 0;
    var melI = setInterval(() => {
      if (ctx.state === "suspended") return;
      var o = ctx.createOscillator(); o.type = "triangle";
      o.frequency.value = notes[ms % notes.length];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.055, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 0.14);
      this.nodes.push(o, g); ms++;
    }, 160);
    var basI = setInterval(() => {
      if (ctx.state === "suspended") return;
      var b = ctx.createOscillator(); b.type = "triangle";
      b.frequency.value = bass[bs % bass.length];
      var bg = ctx.createGain();
      bg.gain.setValueAtTime(0.05, ctx.currentTime);
      bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      b.connect(bg).connect(out); b.start(); b.stop(ctx.currentTime + 0.32);
      this.nodes.push(b, bg); bs++;
    }, 640);
    this.intervals.push(melI, basI);
  },

  // DISCO — funky four-on-floor with bass line and hi-hat
  playDisco: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var bassNotes = [65.41, 73.42, 65.41, 87.31];
    var beat = 0;
    var int = setInterval(() => {
      if (!ctx || ctx.state === "suspended") return;
      var k = ctx.createOscillator(); k.type = "sine";
      k.frequency.setValueAtTime(140, ctx.currentTime);
      k.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.42);
      var kg = ctx.createGain();
      kg.gain.setValueAtTime(0.14, ctx.currentTime);
      kg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
      k.connect(kg).connect(out); k.start(); k.stop(ctx.currentTime + 0.45);
      this.nodes.push(k, kg);
      var b = ctx.createOscillator(); b.type = "sawtooth";
      b.frequency.value = bassNotes[beat % 4];
      var bff = ctx.createBiquadFilter(); bff.type = "lowpass"; bff.frequency.value = 600;
      var bg = ctx.createGain();
      bg.gain.setValueAtTime(0.10, ctx.currentTime);
      bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      b.connect(bff).connect(bg).connect(out); b.start(); b.stop(ctx.currentTime + 0.25);
      this.nodes.push(b, bff, bg);
      if (beat % 2 === 1) {
        var buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
        var bd = buf.getChannelData(0);
        for (var i = 0; i < bd.length; i++) bd[i] = (Math.random() * 2 - 1);
        var ns = ctx.createBufferSource(); ns.buffer = buf;
        var hf = ctx.createBiquadFilter(); hf.type = "highpass"; hf.frequency.value = 7000;
        var hg = ctx.createGain(); hg.gain.value = 0.028;
        ns.connect(hf).connect(hg).connect(out); ns.start();
        this.nodes.push(ns, hf, hg);
      }
      beat++;
    }, 250);
    this.intervals.push(int);
  },

  // MOUNTAINS / WATERFALL / GRANDCANYON — peaceful ambient with gentle melody
  playMountains: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    [[196, 0.13], [247, 0.15], [294, 0.17]].forEach(([freq, lfoRate]) => {
      var o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = freq;
      var g = ctx.createGain(); g.gain.value = 0.022;
      var lfo = ctx.createOscillator(); lfo.frequency.value = lfoRate;
      var lg = ctx.createGain(); lg.gain.value = 0.009;
      lfo.connect(lg); lg.connect(g.gain);
      lfo.start(); o.connect(g).connect(out); o.start();
      this.nodes.push(o, g, lfo, lg);
    });
    // Gentle pentatonic melody floating over the pads
    var melody = [392, 440, 523.25, 587.33, 523.25, 440, 392, 329.63];
    var ms = 0;
    var melI = setInterval(() => {
      if (ctx.state === "suspended" || Math.random() > 0.55) return;
      var o = ctx.createOscillator(); o.type = "sine";
      o.frequency.value = melody[ms % melody.length];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.04, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
      o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 1.6);
      this.nodes.push(o, g); ms++;
    }, 1600);
    this.intervals.push(melI);
  },

  // GEO DASH — fast and energetic, kick gain reduced from 0.3 to 0.09
  playGeoDash: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var notes = [523, 659, 784, 1047, 784, 659, 523, 392, 523, 659];
    var s = 0, beat = 0;
    var melI = setInterval(() => {
      if (!ctx || ctx.state === "suspended") return;
      var m = ctx.createOscillator(); m.type = "square";
      m.frequency.value = notes[s % notes.length];
      var mf = ctx.createBiquadFilter(); mf.type = "lowpass"; mf.frequency.value = 2200;
      var mg = ctx.createGain();
      mg.gain.setValueAtTime(0.05, ctx.currentTime);
      mg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      m.connect(mf).connect(mg).connect(out); m.start(); m.stop(ctx.currentTime + 0.12);
      this.nodes.push(m, mf, mg); s++;
    }, 187);
    var kickI = setInterval(() => {
      if (!ctx || ctx.state === "suspended") return;
      var k = ctx.createOscillator(); k.type = "sine";
      k.frequency.setValueAtTime(160, ctx.currentTime);
      k.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.13);
      var kg = ctx.createGain();
      kg.gain.setValueAtTime(0.09, ctx.currentTime);
      kg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
      k.connect(kg).connect(out); k.start(); k.stop(ctx.currentTime + 0.15);
      this.nodes.push(k, kg); beat++;
    }, 374);
    this.intervals.push(melI, kickI);
  },

  // EMOTE / MINION — cheerful sine melody
  playEmote: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var melody = [523, 659, 784, 659, 523, 392, 523, 659];
    var s = 0;
    var int = setInterval(() => {
      if (!ctx || ctx.state === "suspended") return;
      var o = ctx.createOscillator(); o.type = "sine";
      o.frequency.value = melody[s % melody.length];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.055, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 0.22);
      this.nodes.push(o, g); s++;
    }, 220);
    this.intervals.push(int);
  },

  // SIXTYSEVEN / MAP67 — 60s soul groove in A minor, walking bass + chord stabs
  playSixtySeven: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var bassLine = [220, 220, 246.94, 261.63, 293.66, 261.63, 246.94, 220];
    var chords   = [[220, 261.63, 329.63], [196, 246.94, 293.66], [220, 277.18, 329.63]];
    var bs = 0, cs = 0;
    var bassI = setInterval(() => {
      if (ctx.state === "suspended") return;
      var b = ctx.createOscillator(); b.type = "triangle";
      b.frequency.value = bassLine[bs % bassLine.length];
      var bg = ctx.createGain();
      bg.gain.setValueAtTime(0.07, ctx.currentTime);
      bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.26);
      b.connect(bg).connect(out); b.start(); b.stop(ctx.currentTime + 0.3);
      this.nodes.push(b, bg); bs++;
    }, 280);
    var chordI = setInterval(() => {
      if (ctx.state === "suspended") return;
      chords[cs % chords.length].forEach(f => {
        var o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.028, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 0.45);
        this.nodes.push(o, g);
      }); cs++;
    }, 1120);
    this.intervals.push(bassI, chordI);
  },

  // WINTER — sine bell melody with longer decay, more musical
  playWinter: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var bells = [1047, 1319, 1568, 1319, 1047, 784, 880, 1047];
    var s = 0;
    var int = setInterval(() => {
      if (!ctx || ctx.state === "suspended") return;
      var o = ctx.createOscillator(); o.type = "sine";
      o.frequency.value = bells[s % bells.length];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.045, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 0.85);
      this.nodes.push(o, g); s++;
    }, 420);
    // Soft pad underneath
    var pad = ctx.createOscillator(); pad.type = "sine"; pad.frequency.value = 261.63;
    var pg = ctx.createGain(); pg.gain.value = 0.018;
    pad.connect(pg).connect(out); pad.start(); this.nodes.push(pad, pg);
    this.intervals.push(int);
  },

  // SOCKS — gentle, warm pentatonic
  playSocks: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var notes = [440, 494, 523, 587, 523, 494];
    var s = 0;
    var int = setInterval(() => {
      if (!ctx || ctx.state === "suspended") return;
      var o = ctx.createOscillator(); o.type = "sine";
      o.frequency.value = notes[s % notes.length];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.045, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 0.35);
      this.nodes.push(o, g); s++;
    }, 360);
    this.intervals.push(int);
  },

  // BACKROOMS — liminal drone, fewer clicks, subtle white-noise hum
  playBackrooms: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    [60, 120, 180].forEach(freq => {
      var o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
      var g = ctx.createGain(); g.gain.value = 0.02;
      o.connect(g).connect(out); o.start(); this.nodes.push(o, g);
    });
    // Subtle noise hum (fluorescent light feel)
    var buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var bd = buf.getChannelData(0);
    for (var i = 0; i < bd.length; i++) bd[i] = (Math.random() * 2 - 1) * 0.15;
    var ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
    var nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 3200; nf.Q.value = 0.5;
    var ng = ctx.createGain(); ng.gain.value = 0.012;
    ns.connect(nf).connect(ng).connect(out); ns.start(); this.nodes.push(ns, nf, ng);
    // Infrequent distant click/tick (was 22% chance every 900ms = too frequent)
    var int = setInterval(() => {
      if (ctx.state === "suspended" || Math.random() > 0.25) return;
      var c = ctx.createOscillator(); c.type = "square";
      c.frequency.value = 2800 + Math.random() * 200;
      var cg = ctx.createGain();
      cg.gain.setValueAtTime(0.018, ctx.currentTime);
      cg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      c.connect(cg).connect(out); c.start(); c.stop(ctx.currentTime + 0.045);
      this.nodes.push(c, cg);
    }, 1800);
    this.intervals.push(int);
  },

  // PUBLIC POO — silly but not annoying; occasional low bubbles, no constant drone
  playPoo: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var int = setInterval(() => {
      if (ctx.state === "suspended" || Math.random() > 0.38) return;
      var b = ctx.createOscillator(); b.type = "sine";
      b.frequency.setValueAtTime(55 + Math.random() * 30, ctx.currentTime);
      b.frequency.exponentialRampToValueAtTime(26, ctx.currentTime + 0.55);
      var bf = ctx.createBiquadFilter(); bf.type = "lowpass"; bf.frequency.value = 280;
      var bg = ctx.createGain();
      bg.gain.setValueAtTime(0.06, ctx.currentTime);
      bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      b.connect(bf).connect(bg).connect(out); b.start(); b.stop(ctx.currentTime + 0.6);
      this.nodes.push(b, bf, bg);
    }, 900);
    this.intervals.push(int);
  },

  // SCREAMING MAMAMIA — dramatic film-horror sweep, infrequent, filtered
  playScreaming: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var drone = ctx.createOscillator(); drone.type = "sawtooth"; drone.frequency.value = 55;
    var df = ctx.createBiquadFilter(); df.type = "lowpass"; df.frequency.value = 240;
    var dg = ctx.createGain(); dg.gain.value = 0.04;
    drone.connect(df).connect(dg).connect(out); drone.start(); this.nodes.push(drone, df, dg);
    // Dramatic sweep fires at most once every 2s (was every 380ms!)
    var int = setInterval(() => {
      if (ctx.state === "suspended" || Math.random() > 0.28) return;
      var s = ctx.createOscillator(); s.type = "sawtooth";
      s.frequency.setValueAtTime(400 + Math.random() * 400, ctx.currentTime);
      s.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 1.4);
      var sf = ctx.createBiquadFilter(); sf.type = "lowpass"; sf.frequency.value = 900;
      var sg = ctx.createGain();
      sg.gain.setValueAtTime(0.032, ctx.currentTime);
      sg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
      s.connect(sf).connect(sg).connect(out); s.start(); s.stop(ctx.currentTime + 1.6);
      this.nodes.push(s, sf, sg);
    }, 2200);
    this.intervals.push(int);
  },

  // CITY / OFFICE — urban jazz: walking bass + brushed hi-hat
  playCity: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var bassLine = [65.41, 73.42, 82.41, 87.31, 82.41, 77.78, 73.42, 65.41];
    var bs = 0;
    var bassI = setInterval(() => {
      if (ctx.state === "suspended") return;
      var b = ctx.createOscillator(); b.type = "triangle";
      b.frequency.value = bassLine[bs % bassLine.length];
      var bg = ctx.createGain();
      bg.gain.setValueAtTime(0.07, ctx.currentTime);
      bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.36);
      b.connect(bg).connect(out); b.start(); b.stop(ctx.currentTime + 0.4);
      this.nodes.push(b, bg); bs++;
    }, 360);
    // Brushed hi-hat noise
    var hatI = setInterval(() => {
      if (ctx.state === "suspended") return;
      var buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      var bd = buf.getChannelData(0);
      for (var i = 0; i < bd.length; i++) bd[i] = (Math.random() * 2 - 1);
      var ns = ctx.createBufferSource(); ns.buffer = buf;
      var hf = ctx.createBiquadFilter(); hf.type = "highpass"; hf.frequency.value = 6000;
      var hg = ctx.createGain(); hg.gain.value = 0.022;
      ns.connect(hf).connect(hg).connect(out); ns.start();
      this.nodes.push(ns, hf, hg);
    }, 180);
    this.intervals.push(bassI, hatI);
  },

  // ────────────────────────────────────────────────────────────────
  // POOLROOMS — eerie fluorescent hum + sparse water drips
  playPoolrooms: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var drone = ctx.createOscillator(); drone.type = "sine"; drone.frequency.value = 60;
    var dg = ctx.createGain(); dg.gain.value = 0.035;
    drone.connect(dg).connect(out); drone.start(); this.nodes.push(drone, dg);
    var buzz = ctx.createOscillator(); buzz.type = "sawtooth"; buzz.frequency.value = 120;
    var buzzG = ctx.createGain(); buzzG.gain.value = 0.010;
    var buzzLFO = ctx.createOscillator(); buzzLFO.frequency.value = 0.4;
    var buzzLFOG = ctx.createGain(); buzzLFOG.gain.value = 0.006;
    buzzLFO.connect(buzzLFOG); buzzLFOG.connect(buzzG.gain);
    buzz.connect(buzzG).connect(out); buzz.start(); buzzLFO.start();
    this.nodes.push(buzz, buzzG, buzzLFO, buzzLFOG);
    var drip = setInterval(() => {
      if (ctx.state === "suspended") return;
      var d = ctx.createOscillator(); d.type = "sine";
      d.frequency.setValueAtTime(800 + Math.random() * 300, ctx.currentTime);
      d.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.4);
      var dg2 = ctx.createGain();
      dg2.gain.setValueAtTime(0.055, ctx.currentTime);
      dg2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      d.connect(dg2).connect(out); d.start(); d.stop(ctx.currentTime + 0.45);
      this.nodes.push(d, dg2);
    }, 2200 + Math.random() * 1800);
    this.intervals.push(drip);
  },

  // HOGWARTS — magical arpeggio in A minor with echo
  playHogwarts: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var scale = [220, 261.63, 293.66, 349.23, 392, 440, 523.25];
    var step = 0;
    var intv = setInterval(() => {
      if (ctx.state === "suspended") return;
      var freq = scale[step % scale.length] * (step > 6 ? 2 : 1);
      var osc = ctx.createOscillator(); osc.type = "triangle"; osc.frequency.value = freq;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.065, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      var echo = ctx.createOscillator(); echo.type = "sine"; echo.frequency.value = freq;
      var eg = ctx.createGain();
      eg.gain.setValueAtTime(0.018, ctx.currentTime + 0.18);
      eg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);
      osc.connect(g).connect(out); osc.start(); osc.stop(ctx.currentTime + 1.0);
      echo.connect(eg).connect(out); echo.start(ctx.currentTime + 0.18); echo.stop(ctx.currentTime + 1.2);
      this.nodes.push(osc, g, echo, eg); step++;
    }, 280);
    var pad = ctx.createOscillator(); pad.type = "triangle"; pad.frequency.value = 110;
    var padG = ctx.createGain(); padG.gain.value = 0.022;
    pad.connect(padG).connect(out); pad.start();
    this.nodes.push(pad, padG); this.intervals.push(intv);
  },

  // VILLAGE — folk pentatonic melody + bass pluck
  playVillage: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var penta = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.26];
    var pattern = [0,2,4,2,1,3,4,3,2,0,1,2]; var step = 0;
    var melody = setInterval(() => {
      if (ctx.state === "suspended") return;
      var o = ctx.createOscillator(); o.type = "triangle";
      o.frequency.value = penta[pattern[step % pattern.length]];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.07, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 0.25);
      this.nodes.push(o, g); step++;
    }, 220);
    var bass = setInterval(() => {
      if (ctx.state === "suspended") return;
      var b = ctx.createOscillator(); b.type = "triangle"; b.frequency.value = 130.81;
      var bg = ctx.createGain();
      bg.gain.setValueAtTime(0.055, ctx.currentTime);
      bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      b.connect(bg).connect(out); b.start(); b.stop(ctx.currentTime + 0.5);
      this.nodes.push(b, bg);
    }, 880);
    this.intervals.push(melody, bass);
  },

  // MINECRAFT — sparse piano style à la C418
  playMinecraft: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var notes = [261.63, 329.63, 392.0, 293.66, 349.23, 261.63, 392.0, 440.0];
    var step = 0;
    var melody = setInterval(() => {
      if (ctx.state === "suspended") return;
      if (Math.random() < 0.35) { step++; return; }
      var o = ctx.createOscillator(); o.type = "sine";
      o.frequency.value = notes[step % notes.length];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
      o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 2.0);
      this.nodes.push(o, g); step++;
    }, 900);
    [130.81, 164.81, 196.0].forEach(f => {
      var pad = ctx.createOscillator(); pad.type = "triangle"; pad.frequency.value = f;
      var pg = ctx.createGain(); pg.gain.value = 0.016;
      pad.connect(pg).connect(out); pad.start(); this.nodes.push(pad, pg);
    });
    this.intervals.push(melody);
  },

  // SKYBLOCK — airy void: deep hum + high wind + sparse bells
  playSkyblock: function () {
    var ctx = this.ctx;
    var out = this._master(0.9);
    var deep = ctx.createOscillator(); deep.type = "sine"; deep.frequency.value = 40;
    var deepG = ctx.createGain(); deepG.gain.value = 0.03;
    deep.connect(deepG).connect(out); deep.start(); this.nodes.push(deep, deepG);
    var buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var bd = buf.getChannelData(0);
    for (var bi = 0; bi < bd.length; bi++) bd[bi] = (Math.random() * 2 - 1) * 0.25;
    var noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400;
    var ng = ctx.createGain(); ng.gain.value = 0.015;
    noise.connect(hp).connect(ng).connect(out); noise.start(); this.nodes.push(noise, hp, ng);
    var skyScale = [523.25, 659.26, 783.99, 1046.5, 1318.5]; var sStep = 0;
    var bells = setInterval(() => {
      if (ctx.state === "suspended" || Math.random() < 0.5) return;
      var bo = ctx.createOscillator(); bo.type = "sine";
      bo.frequency.value = skyScale[sStep % skyScale.length];
      var bg2 = ctx.createGain();
      bg2.gain.setValueAtTime(0.055, ctx.currentTime);
      bg2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
      bo.connect(bg2).connect(out); bo.start(); bo.stop(ctx.currentTime + 3);
      this.nodes.push(bo, bg2); sStep++;
    }, 1400);
    this.intervals.push(bells);
  },

  // ────────────────────────────────────────────────────────────────
  // VET SCHOOL — cheerful acoustic-style melody, G major, calm & bright
  playVetSchool: function () {
    var ctx = this.ctx;
    var out = this._master(0.85);
    // Warm pad drone — G major chord
    [[98, 98.3], [196, 196.5], [246.94, 247.4]].forEach(function(pair) {
      pair.forEach(function(f) {
        var o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
        var g = ctx.createGain(); g.gain.value = 0.018;
        o.connect(g).connect(out); o.start(); AudioEngine.nodes.push(o, g);
      });
    });
    // Bright melody — G major pentatonic [G4, A4, B4, D5, E5, G5]
    var mel = [392, 440, 493.88, 587.33, 659.26, 784, 659.26, 587.33, 493.88, 440, 392, 493.88, 587.33, 659.26, 784, 659.26];
    var mStep = 0;
    var melInt = setInterval(function() {
      if (ctx.state === "suspended") return;
      if (Math.random() > 0.78) return;
      var o = ctx.createOscillator(); o.type = "triangle";
      o.frequency.value = mel[mStep % mel.length];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.042, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 0.45);
      AudioEngine.nodes.push(o, g); mStep++;
    }, 240);
    this.intervals.push(melInt);
    // Walking bass — G2-D3 quarter notes
    var bass = [98, 110, 123.47, 146.83, 130.81, 110, 98, 130.81];
    var bStep2 = 0;
    var bassInt = setInterval(function() {
      if (ctx.state === "suspended") return;
      var o = ctx.createOscillator(); o.type = "sine";
      o.frequency.value = bass[bStep2 % bass.length];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.055, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
      o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + 0.5);
      AudioEngine.nodes.push(o, g); bStep2++;
    }, 480);
    this.intervals.push(bassInt);
    // Gentle percussion — soft hi-hat tick
    var hatInt = setInterval(function() {
      if (ctx.state === "suspended") return;
      var buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      var bd = buf.getChannelData(0);
      for (var i = 0; i < bd.length; i++) bd[i] = (Math.random()*2-1) * 0.6;
      var src = ctx.createBufferSource(); src.buffer = buf;
      var hp2 = ctx.createBiquadFilter(); hp2.type = "highpass"; hp2.frequency.value = 5000;
      var hg = ctx.createGain(); hg.gain.value = 0.025;
      src.connect(hp2).connect(hg).connect(out); src.start();
      AudioEngine.nodes.push(src, hp2, hg);
    }, 480);
    this.intervals.push(hatInt);
  },

  // ────────────────────────────────────────────────────────────────
  // MENU MUSIC — 8-bit vaporwave
  playMenu: function () {
    var self = this; var ctx = this.ctx;
    if (!ctx || self._menuActive || self._gameActive) return;
    self._menuActive = true;
    self._menuIntervals = [];

    var master = ctx.createGain(); master.gain.value = 0.48;
    master.connect(ctx.destination);
    self._menuGain = master;

    var ARP  = [220,261.63,293.66,349.23,392,440,523.25,659.26,392,440,349.23,293.66,261.63,220,261.63,349.23];
    var BASS = [110,130.81,110,146.83,110,130.81,98,110];
    var arp=0, bStep=0, tick=0;

    function note(freq,type,vol,dur,delay) {
      if (!self._menuActive||ctx.state==="suspended") return;
      var t=ctx.currentTime+(delay||0);
      var o=ctx.createOscillator(); o.type=type; o.frequency.value=freq;
      var g=ctx.createGain();
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(vol,t+0.012);
      g.gain.exponentialRampToValueAtTime(0.001,t+dur);
      o.connect(g).connect(master); o.start(t); o.stop(t+dur+0.02);
    }

    self._menuIntervals.push(setInterval(function(){
      if(!self._menuActive) return;
      note(ARP[arp%ARP.length],"triangle",0.11,0.24,0);
      if(arp%8===0) note(ARP[arp%ARP.length]*2,"square",0.04,0.10,0.01);
      arp++;
    },280));

    self._menuIntervals.push(setInterval(function(){
      if(!self._menuActive) return;
      note(BASS[bStep%BASS.length],"square",0.09,0.42,0);
      bStep++;
    },560));

    self._menuIntervals.push(setInterval(function(){
      if(!self._menuActive) return;
      tick++;
      if(tick%6!==0) return;
      var root=BASS[bStep%BASS.length]*2;
      [0,3,7].forEach(function(s,i){note(root*Math.pow(2,s/12),"triangle",0.042,0.55,i*0.016);});
    },560));

    self._menuIntervals.push(setInterval(function(){
      if(!self._menuActive) return;
      note(3520,"square",0.015,0.032,0);
    },140));

    var p1=ctx.createOscillator(); p1.type="triangle"; p1.frequency.value=110;
    var p2=ctx.createOscillator(); p2.type="triangle"; p2.frequency.value=110.4;
    var pg=ctx.createGain(); pg.gain.value=0.032;
    var lfo=ctx.createOscillator(); lfo.frequency.value=0.10;
    var lg=ctx.createGain(); lg.gain.value=0.010;
    lfo.connect(lg); lg.connect(pg.gain);
    p1.connect(pg).connect(master); p2.connect(pg);
    p1.start(); p2.start(); lfo.start();
    self._menuPads=[p1,p2,lfo,lg,pg];
  },

  stopMenu: function () {
    (this._menuIntervals||[]).forEach(clearInterval);
    this._menuIntervals = [];
    this._menuActive    = false;
    if (this._menuGain && this.ctx) {
      try { this._menuGain.gain.setValueAtTime(0, this.ctx.currentTime); } catch(e) {}
    }
    if (this._menuPads) {
      this._menuPads.forEach(function(n){try{n.stop();}catch(e){}try{n.disconnect();}catch(e){}});
      this._menuPads = null;
    }
    this._menuGain = null;
  },

  stopAll: function () {
    this.stopMenu();
    this.nodes.forEach((n) => {
      try { n.stop(); } catch (e) {}
      try { n.disconnect(); } catch(e) {}
    });
    this.intervals.forEach(clearInterval);
    this.nodes = [];
    this.intervals = [];
  },

  playTheme: function (theme) {
    if (!this.ctx) return;
    this._gameActive = true;
    this.stopMenu();
    this.stopAll();
    const map = {
      eerie:             () => this.playEerie(),
      funny:             () => this.playFunny(),
      neon:              () => this.playNeon(),
      terrifying:        () => this.playTerrifying(),
      feet_bunnies:      () => this.playFeetBunnies(),
      city:              () => this.playCity(),
      socks_basket:      () => this.playSocks(),
      backrooms:         () => this.playBackrooms(),
      public_poo:        () => this.playPoo(),
      screaming_mamamia: () => this.playScreaming(),
      disco:             () => this.playDisco(),
      mountains:         () => this.playMountains(),
      geometry_dash:     () => this.playGeoDash(),
      emote:             () => this.playEmote(),
      sixtyseven:        () => this.playSixtySeven(),
      winter:            () => this.playWinter(),
      moon:              () => this.playMountains(),
      office:            () => this.playCity(),
      cabbage:           () => this.playFunny(),
      minion:            () => this.playEmote(),
      map67:             () => this.playSixtySeven(),
      grandcanyon:       () => this.playMountains(),
      tornado:           () => this.playTerrifying(),
      waterfall:         () => this.playMountains(),
      poolrooms:         () => this.playPoolrooms(),
      hogwarts:          () => this.playHogwarts(),
      village:           () => this.playVillage(),
      minecraft:         () => this.playMinecraft(),
      skyblock:          () => this.playSkyblock(),
      vetschool:         () => this.playVetSchool(),
    };
    if (map[theme]) map[theme]();
  },
};
