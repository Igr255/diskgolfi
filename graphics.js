"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── GRAPHICS ENGINE ──────────────────────────────────────────────────────────
// Loaded right after three.js, before every other game script.
//
//  1. Colour management — hex colours are authored in sRGB; we convert them to
//     linear on input and render with sRGB output + ACES filmic tone mapping
//     (the same approach three.js r152+ uses by default).
//  2. Per-theme lighting presets: physical sky, sun, hemisphere fill, fog,
//     environment map (PMREM) so PBR materials get real reflections.
//  3. Water shader (waves, fresnel, sun glint, shoreline foam, lava, neon grid).
//  4. Procedural islands: textured tops, rocky noise-displaced cliffs,
//     instanced wind-swayed grass and flowers.
//  5. Post-processing: bloom + colour grade + vignette (WebGL2, quality-gated).
//  6. Quality presets with automatic resolution scaling.
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. COLOUR MANAGEMENT ─────────────────────────────────────────────────────
(function patchColorManagement() {
  if (typeof THREE === "undefined" || !THREE.Color) return;
  var C = THREE.Color.prototype;
  if (C._dgColorManaged) return;
  var _setHex = C.setHex, _setHSL = C.setHSL, _setStyle = C.setStyle, _getHSL = C.getHSL;
  var bypass = 0, _tmpC = null;
  // HSL is an sRGB notion: read it from the sRGB version of the colour (keeps offsetHSL symmetric)
  C.getHSL = function(target) {
    if (!_tmpC) _tmpC = new THREE.Color();
    _tmpC.r = this.r; _tmpC.g = this.g; _tmpC.b = this.b;
    _tmpC.convertLinearToSRGB();
    return _getHSL.call(_tmpC, target);
  };
  C.setHex = function(hex) { _setHex.call(this, hex); if (!bypass) this.convertSRGBToLinear(); return this; };
  C.setHSL = function(h, s, l) { _setHSL.call(this, h, s, l); if (!bypass) this.convertSRGBToLinear(); return this; };
  C.setStyle = function(style) {
    bypass++;
    try { _setStyle.call(this, style); } finally { bypass--; }
    if (!bypass) this.convertSRGBToLinear();
    return this;
  };
  // Raw (linear) setter for code that already works in linear space
  C.setHexLinear = function(hex) { bypass++; try { _setHex.call(this, hex); } finally { bypass--; } return this; };
  C._dgColorManaged = true;
})();

// ── SHARED HELPERS ───────────────────────────────────────────────────────────
function _gfxHash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function _gfxRng(seed) {
  var r = (seed >>> 0) || 1;
  return function() { r = (Math.imul(r ^ (r >>> 15), r | 1) + 0x6d2b79f5) >>> 0; r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
// 2-D value noise (cheap, deterministic) used by geometry builders
function _gfxNoise2(x, y) {
  var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  function h(a, b) { var s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }
  var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  var a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function _gfxFbm2(x, y, oct) {
  var v = 0, amp = 0.5, f = 1, n = 0;
  for (var i = 0; i < (oct || 4); i++) { v += _gfxNoise2(x * f, y * f) * amp; n += amp; amp *= 0.5; f *= 2.03; }
  return v / n;
}

var GFX = {
  ready: false,
  quality: "high",
  settings: null,
  theme: "funny",
  weather: "clear",
  preset: null,         // final (theme + weather) values currently applied
  time: { value: 0 },   // shared uniform for animated shaders
  windUniform: { value: null },
  islandsForFoam: [],   // [{x,z,r}] — updated by terrain / moving islands
  _envDirty: true,
  _texCache: {},
  _matCache: {},
  composer: null,
  bloomPass: null,
  gradePass: null,
  _lightning: 0,
  _fpsAcc: 0, _fpsFrames: 0, _fpsLow: 0, _dynScale: 1,
};

// ── QUALITY PRESETS ──────────────────────────────────────────────────────────
GFX.QUALITY = {
  high:   { pixelRatio: 2.0,  shadowMap: 2048, shadowRange: 38, post: true,  grass: 1.0,  flowers: true,  maxLights: 8, scenery: 1.0 },
  medium: { pixelRatio: 1.25, shadowMap: 1024, shadowRange: 32, post: false, grass: 0.5,  flowers: true,  maxLights: 4, scenery: 0.8 },
  low:    { pixelRatio: 1.0,  shadowMap: 1024, shadowRange: 26, post: false, grass: 0.18, flowers: false, maxLights: 2, scenery: 0.6 },
};
GFX.detectQuality = function() {
  var saved = null;
  try { saved = localStorage.getItem("dg_quality"); } catch (e) {}
  GFX.qualityPref = saved || "auto";
  if (saved && GFX.QUALITY[saved]) return saved;
  var coarse = window.matchMedia && window.matchMedia("(pointer:coarse)").matches;
  var small = Math.min(screen.width || 9999, screen.height || 9999) < 600;   // device size, not window size
  if (coarse || small) return "medium";
  return "high";
};
GFX.setQualityPref = function(pref) {
  GFX.qualityPref = pref;
  try { localStorage.setItem("dg_quality", pref === "auto" ? "" : pref); if (pref === "auto") localStorage.removeItem("dg_quality"); } catch (e) {}
  GFX.quality = (pref && GFX.QUALITY[pref]) ? pref : GFX.detectQuality();
  GFX.settings = GFX.QUALITY[GFX.quality];
  GFX._dynScale = 1;
  if (GFX.ready) {
    GFX._applyPixelRatio();
    if (GFX.sun) {
      GFX.sun.shadow.mapSize.set(GFX.settings.shadowMap, GFX.settings.shadowMap);
      if (GFX.sun.shadow.map) { GFX.sun.shadow.map.dispose(); GFX.sun.shadow.map = null; }
      var R = GFX.settings.shadowRange, sc = GFX.sun.shadow.camera;
      sc.left = sc.bottom = -R; sc.right = sc.top = R; sc.updateProjectionMatrix();
    }
    GFX._setupPost();
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ── 2. THEME LIGHTING PRESETS ────────────────────────────────────────────────
// zen/hor/gnd: sky zenith / horizon / below-horizon colours
// sun: [colour, intensity, elevationDeg, azimuthDeg]   hemi: [sky, ground, intensity]
// fog: [colour, density]   exp: exposure   bloom: bloom strength
// water: {kind:"water"|"lava"|"grid"|"void"|"none", deep, shallow, line}
// surf: {style, top, edge, rock1, rock2, line}   grass: [density, base, tip]
// ══════════════════════════════════════════════════════════════════════════════
GFX.THEMES = {
  eerie:      { zen:0x07020f, hor:0x2a1045, gnd:0x0a0410, sun:[0x9a8cff,1.15,35,210], hemi:[0x7a5aaa,0x1a1a10,0.75], fog:[0x22103a,0.009], exp:1.2, bloom:0.75, stars:0.8, clouds:0.30, cloudCol:0x1a0d2a,
                water:{kind:"water",deep:0x04020c,shallow:0x1a1040}, surf:{style:"grass",top:0x2f4a2a,edge:0x2a2018,rock1:0x2c2630,rock2:0x1c1820}, grass:[0.7,0x1a2a18,0x4a6a3a] },
  funny:      { zen:0x2f86e6, hor:0xc4e6ff, gnd:0x5a7a8a, sun:[0xfff1d6,2.7,50,140], hemi:[0xbfdfff,0x6a8a3a,0.6], fog:[0xc4e2f8,0.0035], exp:0.95, bloom:0.22, stars:0, clouds:0.55, cloudCol:0xffffff,
                water:{kind:"water",deep:0x0b4a7a,shallow:0x2fa6c9}, surf:{style:"grass",top:0x6fbf3a,edge:0x7a5a32,rock1:0x8a7a66,rock2:0x6a5a4a}, grass:[1.0,0x3a7a1f,0x9fdc5a], flowers:[0xff5a8a,0xffe14a,0xffffff,0xa070ff], land:0x5a9a32 },
  neon:       { zen:0x000000, hor:0x1a0030, gnd:0x05000a, sun:[0xff4adf,0.7,25,200], hemi:[0x3a0a5a,0x05000a,0.6], fog:[0x120020,0.008], exp:1.1, bloom:1.15, stars:0.6, clouds:0,
                water:{kind:"grid",deep:0x020006,shallow:0x0a0420,line:0xff00ff}, surf:{style:"neon",top:0x0a0a18,edge:0x15152a,rock1:0x101020,rock2:0x18182e,line:0x00ffff}, grass:[0] },
  terrifying: { zen:0x120000, hor:0x5a0a00, gnd:0x1a0200, sun:[0xff4a1a,1.1,12,250], hemi:[0x7a1a0a,0x100000,0.5], fog:[0x3a0600,0.012], exp:1.0, bloom:0.85, stars:0, clouds:0.55, cloudCol:0x2a0500,
                water:{kind:"lava",deep:0x3a0400,shallow:0xff5a10}, surf:{style:"rock",top:0x2a1210,edge:0x1a0a08,rock1:0x1a0a08,rock2:0x2a1410}, grass:[0.25,0x2a1008,0x5a2a10] },
  feet_bunnies:{ zen:0x6ab0ff, hor:0xffd6e8, gnd:0x9a8a9a, sun:[0xfff0f6,2.5,45,130], hemi:[0xffd6ee,0x9acb7a,0.65], fog:[0xffd8e8,0.004], exp:0.95, bloom:0.3, stars:0, clouds:0.5, cloudCol:0xffffff,
                water:{kind:"water",deep:0x2a6aa8,shallow:0x8adcef}, surf:{style:"grass",top:0x8fd46a,edge:0x9a6a4a,rock1:0xc8a8a0,rock2:0xa88880}, grass:[1.0,0x4a8a2a,0xc8f08a], flowers:[0xff8ac0,0xffffff,0xffb0d8] },
  city:       { zen:0x04060e, hor:0x2c2a40, gnd:0x0a0a10, sun:[0xaab8ff,0.75,40,200], hemi:[0x40507a,0x201810,0.65], fog:[0x22253a,0.007], exp:1.08, bloom:0.75, stars:0.25, clouds:0.2, cloudCol:0x2a2a3a,
                water:{kind:"water",deep:0x02060c,shallow:0x0a1a2a}, surf:{style:"concrete",top:0x5a5d66,edge:0x3a3d44,rock1:0x3a3d44,rock2:0x2a2c30}, grass:[0] },
  socks_basket:{ zen:0x7ab8ff, hor:0xffd0e0, gnd:0x9a7a8a, sun:[0xfff4f8,2.4,48,120], hemi:[0xffe0ee,0xc89aa8,0.65], fog:[0xffd4e2,0.004], exp:0.95, bloom:0.3, stars:0, clouds:0.45, cloudCol:0xffffff,
                water:{kind:"water",deep:0xa04a7a,shallow:0xffa8c8}, surf:{style:"carpet",top:0xffc0d0,edge:0xe090a8,rock1:0xd8a0b0,rock2:0xc08898}, grass:[0] },
  backrooms:  { zen:0x7a6a28, hor:0xc8b860, gnd:0x5a4a18, sun:[0xfff2b0,0.8,80,0], hemi:[0xfff0b0,0x6a5a20,1.0], fog:[0xb8a850,0.013], exp:1.0, bloom:0.45, stars:0, clouds:0,
                water:{kind:"water",deep:0x3a3008,shallow:0x8a7a28}, surf:{style:"carpet",top:0xb8a030,edge:0x8a7820,rock1:0xc8b860,rock2:0xa89840}, grass:[0] },
  public_poo: { zen:0x050200, hor:0x2a1405, gnd:0x0a0500, sun:[0xffaa55,1.3,24,230], hemi:[0x8a6a40,0x201008,0.9], fog:[0x1e0e04,0.011], exp:1.35, bloom:0.6, stars:0.2, clouds:0.3, cloudCol:0x1a0c02,
                water:{kind:"water",deep:0x1a0d02,shallow:0x4a2a08}, surf:{style:"dirt",top:0x4a3218,edge:0x2a1a08,rock1:0x3a2a18,rock2:0x2a1c10}, grass:[0.3,0x3a2a10,0x6a5a20] },
  screaming_mamamia:{ zen:0x3a0000, hor:0xff3a10, gnd:0x2a0000, sun:[0xffaa40,1.7,8,270], hemi:[0xff6a2a,0x2a0000,0.6], fog:[0x8a1000,0.010], exp:0.95, bloom:0.75, stars:0, clouds:0.4, cloudCol:0x5a0800,
                water:{kind:"lava",deep:0x4a0000,shallow:0xff3a00}, surf:{style:"rock",top:0x4a1a10,edge:0x2a0a05,rock1:0x2a0a05,rock2:0x4a1a10}, grass:[0] },
  disco:      { zen:0x0a0018, hor:0x2a0a3a, gnd:0x05000a, sun:[0xff66ff,0.55,40,90], hemi:[0x8a2aff,0x10002a,0.65], fog:[0x1a0428,0.008], exp:1.1, bloom:1.0, stars:0.4, clouds:0,
                water:{kind:"grid",deep:0x05000c,shallow:0x12052a,line:0xff33cc}, surf:{style:"dance",top:0x101018,edge:0x181828,rock1:0x15101f,rock2:0x201830}, grass:[0] },
  mountains:  { zen:0x2f6fc9, hor:0xc8dcef, gnd:0x5a6a70, sun:[0xfff4e0,2.8,40,120], hemi:[0xb8d4f0,0x5a6a4a,0.6], fog:[0xc0d4e8,0.003], exp:0.92, bloom:0.22, stars:0, clouds:0.45, cloudCol:0xffffff,
                water:{kind:"water",deep:0x0a3a5a,shallow:0x2a8aa0}, surf:{style:"grass",top:0x5a8a3a,edge:0x5a4a3a,rock1:0x6a6a70,rock2:0x55555a}, grass:[0.9,0x2a5a1a,0x8ab04a], flowers:[0xffffff,0x9a8aff,0xffe060] },
  geometry_dash:{ zen:0x000420, hor:0x0050b0, gnd:0x000210, sun:[0x66ccff,0.65,35,160], hemi:[0x2a6aff,0x000010,0.65], fog:[0x001a4a,0.008], exp:1.1, bloom:1.05, stars:0.4, clouds:0,
                water:{kind:"grid",deep:0x000010,shallow:0x001040,line:0x00ff66}, surf:{style:"neon",top:0x0a1a40,edge:0x0a1530,rock1:0x08122a,rock2:0x0c1838,line:0x00ff66}, grass:[0] },
  emote:      { zen:0xff9a30, hor:0xffe2a8, gnd:0xa0703a, sun:[0xffdca0,2.5,32,230], hemi:[0xffe0a0,0x8a6a2a,0.6], fog:[0xffe0b0,0.004], exp:0.92, bloom:0.4, stars:0, clouds:0.35, cloudCol:0xfff0d0,
                water:{kind:"water",deep:0xa06a08,shallow:0xffc840}, surf:{style:"sand",top:0xf0d890,edge:0xc0a060,rock1:0xd8b070,rock2:0xb89050}, grass:[0.3,0x8a8a2a,0xd8d070] },
  sixtyseven: { zen:0x000800, hor:0x003a10, gnd:0x000400, sun:[0x44ff88,0.65,35,40], hemi:[0x22aa44,0x001000,0.6], fog:[0x002a0a,0.010], exp:1.1, bloom:1.0, stars:0.3, clouds:0,
                water:{kind:"grid",deep:0x000800,shallow:0x002a0a,line:0x00ff66}, surf:{style:"neon",top:0x001a08,edge:0x00120a,rock1:0x00100a,rock2:0x001a10,line:0x00ff44}, grass:[0] },
  winter:     { zen:0x2a6ab8, hor:0xa8c4e0, gnd:0x6a7a8a, sun:[0xfff0dc,1.9,22,150], hemi:[0xb8d0f0,0x5a7088,0.4], fog:[0xb0c4da,0.0028], exp:0.66, env:0.35, bloom:0.12, stars:0, clouds:0.5, cloudCol:0xffffff,
                water:{kind:"water",deep:0x1a3a5a,shallow:0x6a9ac0}, surf:{style:"snow",top:0xf4f8ff,edge:0xdde6f0,rock1:0x5a6a7a,rock2:0x7a8a9a}, grass:[0] },
  moon:       { zen:0x000000, hor:0x05050a, gnd:0x050505, sun:[0xffffff,3.0,28,60], hemi:[0x30304a,0x101010,0.3], fog:[0x000000,0.0015], exp:1.0, bloom:0.5, stars:1.0, clouds:0,
                water:{kind:"none"}, surf:{style:"regolith",top:0x8a8a8c,edge:0x6a6a6e,rock1:0x5a5a5e,rock2:0x6a6a70}, grass:[0] },
  office:     { zen:0x9aa8b8, hor:0xc8d0dc, gnd:0x6a7080, sun:[0xffffff,1.3,70,30], hemi:[0xe8f0ff,0x6a7080,0.95], fog:[0xb0b8c4,0.010], exp:0.95, bloom:0.35, stars:0, clouds:0,
                water:{kind:"water",deep:0x0a1420,shallow:0x1a2a3a}, surf:{style:"carpet",top:0x5a6a7a,edge:0x4a5260,rock1:0x8a9098,rock2:0x70767e}, grass:[0] },
  cabbage:    { zen:0x5a7a5a, hor:0xa8c0a0, gnd:0x3a4a3a, sun:[0xf0ffe0,1.7,45,100], hemi:[0xc0e0c0,0x3a5a2a,0.75], fog:[0x9ab89a,0.006], exp:0.98, bloom:0.25, stars:0, clouds:0.7, cloudCol:0xe0e8e0,
                water:{kind:"water",deep:0x0a2a10,shallow:0x2a5a2a}, surf:{style:"soil",top:0x5a4028,edge:0x3a2818,rock1:0x4a3a28,rock2:0x3a2c1c}, grass:[0.35,0x2a5a1a,0x6aa03a] },
  minion:     { zen:0x3a90f0, hor:0xffe8a0, gnd:0x8a8a5a, sun:[0xfff4d0,2.6,50,150], hemi:[0xfff0c0,0x6a8a3a,0.6], fog:[0xfff0c0,0.0035], exp:0.92, bloom:0.3, stars:0, clouds:0.45, cloudCol:0xffffff,
                water:{kind:"water",deep:0x003a90,shallow:0x2a80e0}, surf:{style:"grass",top:0x7acb3a,edge:0x8a6a3a,rock1:0x9a8a6a,rock2:0x7a6a4a}, grass:[1.0,0x3a7a1a,0xb0e050], flowers:[0xffe000,0x3a6aff,0xffffff], land:0x6ab03a },
  map67:      { zen:0x000800, hor:0x003a10, gnd:0x000400, sun:[0x44ff88,0.65,35,40], hemi:[0x22aa44,0x001000,0.6], fog:[0x002a0a,0.010], exp:1.1, bloom:1.0, stars:0.3, clouds:0,
                water:{kind:"grid",deep:0x000800,shallow:0x002a0a,line:0x00ff66}, surf:{style:"neon",top:0x001a08,edge:0x00120a,rock1:0x00100a,rock2:0x001a10,line:0x00ff44}, grass:[0] },
  grandcanyon:{ zen:0x3a6ab0, hor:0xffb070, gnd:0x8a4a2a, sun:[0xffc080,2.7,14,250], hemi:[0xffc8a0,0x8a4a2a,0.6], fog:[0xf0a070,0.004], exp:0.92, bloom:0.45, stars:0, clouds:0.3, cloudCol:0xffc8a8,
                water:{kind:"water",deep:0x1a3a4a,shallow:0x3a7a7a}, surf:{style:"sand",top:0xc0703a,edge:0xa0502a,rock1:0xa0502a,rock2:0xd08a50}, grass:[0.15,0x6a5a2a,0xb0a050] },
  tornado:    { zen:0x2a3436, hor:0x6a7a74, gnd:0x2a3030, sun:[0xd0e0d8,1.0,40,180], hemi:[0x8a9a96,0x2a3428,0.75], fog:[0x4a5654,0.012], exp:1.0, bloom:0.3, stars:0, clouds:1.0, cloudCol:0x3a4446,
                water:{kind:"water",deep:0x0a1a1a,shallow:0x2a4040}, surf:{style:"grass",top:0x4a6a3a,edge:0x4a3a28,rock1:0x4a4a44,rock2:0x3a3a34}, grass:[1.0,0x2a4a1a,0x6a8a3a] },
  waterfall:  { zen:0x4a9ad8, hor:0xd0f0f0, gnd:0x5a7a7a, sun:[0xfff8e8,2.5,45,110], hemi:[0xd0f0f0,0x3a6a3a,0.7], fog:[0xc8e8ea,0.005], exp:0.92, bloom:0.3, stars:0, clouds:0.4, cloudCol:0xffffff,
                water:{kind:"water",deep:0x0a4a6a,shallow:0x2aa0c0}, surf:{style:"grass",top:0x3a8a3a,edge:0x4a3a2a,rock1:0x4a5a4a,rock2:0x5a6a5a}, grass:[1.15,0x1a5a1a,0x6ac04a], flowers:[0xffffff,0xff7aa0,0xffe060] },
  poolrooms:  { zen:0xb8e4ee, hor:0xd8f0f2, gnd:0x8ab8b8, sun:[0xfff8f0,1.0,75,40], hemi:[0xeaf6f6,0x7aa8a8,0.55], fog:[0xc0dede,0.012], exp:0.72, env:0.35, bloom:0.15, stars:0, clouds:0,
                water:{kind:"water",deep:0x1a8aa8,shallow:0x8ae8f0}, surf:{style:"tile",top:0xf0f0e8,edge:0xd8e0e0,rock1:0xe0e8e8,rock2:0xc8d8d8}, grass:[0] },
  hogwarts:   { zen:0x050418, hor:0x2a2050, gnd:0x08060f, sun:[0xb8b0ff,1.3,32,200], hemi:[0x7a6aba,0x2a2018,0.85], fog:[0x1e1838,0.008], exp:1.3, bloom:0.85, stars:1.0, clouds:0.3, cloudCol:0x15122a,
                water:{kind:"water",deep:0x03020a,shallow:0x15122a}, surf:{style:"stone",top:0x5a5248,edge:0x3a342e,rock1:0x3a342e,rock2:0x4a4238}, grass:[0.4,0x1a2a18,0x3a5a2a] },
  village:    { zen:0x3a88d8, hor:0xcfe6f5, gnd:0x6a7a7a, sun:[0xfff0d8,2.7,38,130], hemi:[0xc8e0f8,0x5a7a3a,0.6], fog:[0xd0e4ec,0.0035], exp:0.92, bloom:0.22, stars:0, clouds:0.5, cloudCol:0xffffff,
                water:{kind:"water",deep:0x0d4060,shallow:0x2a90a8}, surf:{style:"grass",top:0x6aa83a,edge:0x6a4a2a,rock1:0x7a6a58,rock2:0x5a4a3a}, grass:[1.0,0x2f6a1a,0x9acc4a], flowers:[0xffffff,0xffe040,0xff6a6a,0x8a7aff] },
  minecraft:  { zen:0x6aa8ff, hor:0xbfe0ff, gnd:0x6a7a8a, sun:[0xffffff,2.4,55,140], hemi:[0xd0e8ff,0x5a7a3a,0.7], fog:[0xbfe0ff,0.004], exp:0.95, bloom:0.2, stars:0, clouds:0.5, cloudCol:0xffffff,
                water:{kind:"water",deep:0x1a3aa0,shallow:0x3a6ae0}, surf:{style:"pixel",top:0x5a9a2a,edge:0x7a5232,rock1:0x7a5232,rock2:0x6a4628}, grass:[0] },
  skyblock:   { zen:0x1a5ad0, hor:0xa8d0ff, gnd:0x0a1a3a, sun:[0xfff6e0,2.6,45,140], hemi:[0xc8e0ff,0x2a3a5a,0.65], fog:[0xa8d0ff,0.003], exp:0.95, bloom:0.25, stars:0, clouds:0.6, cloudCol:0xffffff,
                water:{kind:"void"}, surf:{style:"grass",top:0x4a9a3a,edge:0x6a4a2a,rock1:0x6a6a6a,rock2:0x5a5048}, grass:[0.85,0x2a6a1a,0x8ac04a] },
  vetschool:  { zen:0x4a9ae0, hor:0xd8f4ea, gnd:0x6a8a7a, sun:[0xfff6e6,2.5,48,120], hemi:[0xd8f0f0,0x4a8a4a,0.65], fog:[0xd0eee4,0.004], exp:0.92, bloom:0.22, stars:0, clouds:0.45, cloudCol:0xffffff,
                water:{kind:"water",deep:0x0d4a5a,shallow:0x3aa8b0}, surf:{style:"grass",top:0x5aaa5a,edge:0x6a4a2a,rock1:0x7a7a6a,rock2:0x5a5a4a}, grass:[1.0,0x2a6a2a,0x8ad06a], flowers:[0xffffff,0xff9ac0,0xfff06a] },
};
GFX.themePreset = function(theme) { return GFX.THEMES[theme] || GFX.THEMES.funny; };

// Weather modifiers: how each weather type shifts a theme preset
GFX.WEATHER_MOD = {
  clear:  { cloud:0,    sun:1.0,  skyMix:0,    skyCol:0x8a929a, fogMul:1.0, expMul:1.0,  windGrass:1.0 },
  windy:  { cloud:0.25, sun:0.95, skyMix:0.08, skyCol:0x9aa4ae, fogMul:1.0, expMul:1.0,  windGrass:2.6 },
  rainy:  { cloud:0.95, sun:0.35, skyMix:0.6,  skyCol:0x5a646e, fogMul:2.4, expMul:0.95, windGrass:1.6, cloudCol:0x6a727a },
  foggy:  { cloud:0.4,  sun:0.5,  skyMix:0.7,  skyCol:0xb8c0c4, fogMul:1.0, fogAbs:0.032, expMul:0.95, windGrass:0.6, fogToSky:true },
  stormy: { cloud:1.0,  sun:0.22, skyMix:0.75, skyCol:0x2a323c, fogMul:2.6, expMul:1.0,  windGrass:3.2, cloudCol:0x2a3038 },
  hot:    { cloud:0,    sun:1.15, skyMix:0.15, skyCol:0xffe0b0, fogMul:1.3, expMul:1.0,  windGrass:0.5, warm:true },
  snow:   { cloud:0.9,  sun:0.5,  skyMix:0.6,  skyCol:0xd8dfe8, fogMul:2.6, expMul:0.9,  windGrass:0.8, cloudCol:0xe0e6ee },
};

// ══════════════════════════════════════════════════════════════════════════════
// ── INIT ─────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
GFX.init = function(renderer, scene, camera) {
  GFX.renderer = renderer; GFX.scene = scene; GFX.camera = camera;
  GFX.quality = GFX.detectQuality();
  GFX.settings = GFX.QUALITY[GFX.quality];
  GFX.windUniform.value = new THREE.Vector2(0.3, 0.1);

  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 1);
  GFX._applyPixelRatio();

  GFX._buildSky();
  GFX._buildLights();
  GFX._buildPrecip();
  GFX.pmrem = new THREE.PMREMGenerator(renderer);
  GFX.ready = true;
  GFX.setTheme("funny");
  GFX._setupPost();
};

GFX._applyPixelRatio = function() {
  if (!GFX.renderer) return;
  var pr = Math.min(window.devicePixelRatio || 1, GFX.settings.pixelRatio) * GFX._dynScale;
  pr = Math.max(0.6, pr);
  if (GFX.composer && GFX._lastPR && (GFX._lastPR < 1.6) !== (pr < 1.6)) { GFX._lastPR = pr; GFX.renderer.setPixelRatio(pr); GFX._setupPost(); }   // MSAA on/off follows the DPR
  GFX._lastPR = pr;
  GFX.renderer.setPixelRatio(pr);
  GFX.renderer.setSize(window.innerWidth, window.innerHeight);
  if (GFX.composer) {
    GFX.composer.setPixelRatio ? GFX.composer.setPixelRatio(pr) : null;
    GFX.composer.setSize(window.innerWidth, window.innerHeight);
  }
};

GFX.resize = function() {
  if (!GFX.ready) return;
  GFX.camera.aspect = window.innerWidth / window.innerHeight;
  GFX.camera.updateProjectionMatrix();
  GFX._applyPixelRatio();
};

// ── SKY ──────────────────────────────────────────────────────────────────────
GFX._skyVert = [
  "varying vec3 vDir;",
  "void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }"
].join("\n");
GFX._skyFrag = [
  "uniform vec3 zenith; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunColor;",
  "uniform float sunSize; uniform float stars; uniform float clouds; uniform vec3 cloudCol; uniform float time; uniform float flash;",
  "varying vec3 vDir;",
  "float h13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.yzx+33.33); return fract((p.x+p.y)*p.z); }",
  "float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }",
  "float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);",
  "  return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }",
  "float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=vn(p)*a; p=p*2.03+vec2(1.7,9.2); a*=0.5; } return v; }",
  "void main(){",
  "  vec3 d = normalize(vDir);",
  "  float h = d.y;",
  "  vec3 col = mix(horizon, zenith, pow(clamp(h,0.0,1.0), 0.5));",
  "  col = mix(col, ground, smoothstep(0.0, -0.18, h));",
  "  float sd = max(dot(d, normalize(sunDir)), 0.0);",
  // atmospheric glow around the sun + disc
  "  col += sunColor * (pow(sd, 6.0)*0.10 + pow(sd, 48.0)*0.25) * (1.0 - clouds*0.6);",
  "  float disc = smoothstep(1.0 - sunSize, 1.0 - sunSize*0.55, sd);",
  "  col += sunColor * disc * 6.0 * (1.0 - clouds*0.85);",
  // stars
  "  if (stars > 0.0) {",
  "    vec3 p = d * 220.0; vec3 c = floor(p); vec3 f = fract(p) - 0.5;",
  "    float r = h13(c);",
  "    float s = step(0.9965, r) * smoothstep(0.32, 0.0, length(f));",
  "    float tw = 0.6 + 0.4*sin(time*2.0 + r*80.0);",
  "    col += vec3(0.9,0.95,1.0) * s * tw * stars * smoothstep(-0.02, 0.25, h) * 2.0 * (1.0 - clouds);",
  "  }",
  // clouds (projected onto a plane above the camera)
  "  if (clouds > 0.0 && h > 0.0) {",
  "    vec2 uv = d.xz / (h + 0.12) * 0.9 + vec2(time*0.006, time*0.002);",
  "    float n = fbm(uv);",
  "    float cov = smoothstep(0.62 - clouds*0.38, 0.95 - clouds*0.25, n);",
  "    float shade = 0.75 + 0.35*fbm(uv*1.7 + 3.1) + pow(sd, 4.0)*0.6;",
  "    col = mix(col, cloudCol * shade, cov * smoothstep(0.0, 0.18, h) * 0.95);",
  "  }",
  "  col += vec3(0.75,0.8,1.0) * flash;",
  "  gl_FragColor = vec4(col, 1.0);",
  "  #include <tonemapping_fragment>",
  "  #include <encodings_fragment>",
  "}"
].join("\n");

GFX._buildSky = function() {
  GFX.skyUniforms = {
    zenith:   { value: new THREE.Color(0x2f86e6) },
    horizon:  { value: new THREE.Color(0xc4e6ff) },
    ground:   { value: new THREE.Color(0x5a7a8a) },
    sunDir:   { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() },
    sunColor: { value: new THREE.Color(0xffffff) },
    sunSize:  { value: 0.0009 },
    stars:    { value: 0 },
    clouds:   { value: 0.4 },
    cloudCol: { value: new THREE.Color(0xffffff) },
    time:     GFX.time,
    flash:    { value: 0 },
  };
  GFX.skyMat = new THREE.ShaderMaterial({
    uniforms: GFX.skyUniforms, vertexShader: GFX._skyVert, fragmentShader: GFX._skyFrag,
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
  });
  GFX.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), GFX.skyMat);
  GFX.sky.renderOrder = -1000;
  GFX.sky.frustumCulled = false;
  GFX.scene.add(GFX.sky);
  // Env-map scene shares the sky material
  GFX.envScene = new THREE.Scene();
  GFX.envSky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), GFX.skyMat);
  GFX.envScene.add(GFX.envSky);
};

// ── LIGHTS ───────────────────────────────────────────────────────────────────
GFX._buildLights = function() {
  var s = GFX.scene;
  // Remove legacy lights created by game.js (kept as globals for compatibility)
  GFX.sun = new THREE.DirectionalLight(0xffffff, 2.5);
  GFX.sun.castShadow = true;
  GFX.sun.shadow.mapSize.set(GFX.settings.shadowMap, GFX.settings.shadowMap);
  var R = GFX.settings.shadowRange, sc = GFX.sun.shadow.camera;
  sc.near = 1; sc.far = 260; sc.left = sc.bottom = -R; sc.right = sc.top = R;
  GFX.sun.shadow.bias = -0.0004;
  GFX.sun.shadow.normalBias = 0.03;
  s.add(GFX.sun); s.add(GFX.sun.target);
  GFX.hemi = new THREE.HemisphereLight(0xbfdfff, 0x6a8a3a, 0.6);
  s.add(GFX.hemi);
  GFX._focus = new THREE.Vector3();
};

// ── PRECIPITATION (rain streaks / snow) ──────────────────────────────────────
GFX._buildPrecip = function() {
  var N = 2600;
  var pos = new Float32Array(N * 2 * 3);
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  GFX.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc0cce0, transparent: true, opacity: 0.5, depthWrite: false }));
  GFX.rain.frustumCulled = false; GFX.rain.visible = false;
  GFX._rainDrops = [];
  for (var i = 0; i < N; i++) GFX._rainDrops.push({ x: (Math.random()-0.5)*90, y: Math.random()*40, z: (Math.random()-0.5)*90, s: 0.8 + Math.random()*0.4 });
  GFX.scene.add(GFX.rain);

  var SN = 1800;
  var spos = new Float32Array(SN * 3);
  var sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute("position", new THREE.BufferAttribute(spos, 3));
  GFX.snow = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.95, depthWrite: false, map: GFX.softDotTexture() }));
  GFX.snow.frustumCulled = false; GFX.snow.visible = false;
  GFX._snowFlakes = [];
  for (var j = 0; j < SN; j++) GFX._snowFlakes.push({ x: (Math.random()-0.5)*80, y: Math.random()*35, z: (Math.random()-0.5)*80, p: Math.random()*6.28, s: 0.6 + Math.random()*0.6 });
  GFX.scene.add(GFX.snow);
};

GFX._updatePrecip = function(dt) {
  var cam = GFX.camera.position, w = (typeof HOLES !== "undefined" && HOLES[holeIdx]) ? HOLES[holeIdx].wind : { x: 0, z: 0 };
  if (GFX.rain.visible) {
    var a = GFX.rain.geometry.attributes.position.array, k = 0, heavy = GFX.weather === "stormy" ? 1.4 : 1.0;
    var wx = w.x * 0.9 * heavy, wz = w.z * 0.9 * heavy;
    for (var i = 0; i < GFX._rainDrops.length; i++) {
      var d = GFX._rainDrops[i];
      d.y -= 26 * d.s * heavy * dt; d.x += wx * dt; d.z += wz * dt;
      if (d.y < -4) { d.y = 36 + Math.random() * 6; d.x = (Math.random()-0.5)*90; d.z = (Math.random()-0.5)*90; }
      if (d.x > 45) d.x -= 90; if (d.x < -45) d.x += 90; if (d.z > 45) d.z -= 90; if (d.z < -45) d.z += 90;
      var X = cam.x + d.x, Y = cam.y - 14 + d.y, Z = cam.z + d.z;
      a[k++] = X; a[k++] = Y; a[k++] = Z;
      a[k++] = X - wx * 0.035; a[k++] = Y + 0.75 * heavy; a[k++] = Z - wz * 0.035;
    }
    GFX.rain.geometry.attributes.position.needsUpdate = true;
  }
  if (GFX.snow.visible) {
    var b = GFX.snow.geometry.attributes.position.array, m = 0, t = GFX.time.value;
    for (var j = 0; j < GFX._snowFlakes.length; j++) {
      var f = GFX._snowFlakes[j];
      f.y -= 1.6 * f.s * dt; f.x += (w.x * 0.35 + Math.sin(t * 1.3 + f.p) * 0.4) * dt; f.z += (w.z * 0.35 + Math.cos(t * 1.1 + f.p) * 0.4) * dt;
      if (f.y < -4) { f.y = 32; f.x = (Math.random()-0.5)*80; f.z = (Math.random()-0.5)*80; }
      if (f.x > 40) f.x -= 80; if (f.x < -40) f.x += 80; if (f.z > 40) f.z -= 80; if (f.z < -40) f.z += 80;
      b[m++] = cam.x + f.x; b[m++] = cam.y - 12 + f.y; b[m++] = cam.z + f.z;
    }
    GFX.snow.geometry.attributes.position.needsUpdate = true;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ── THEME / WEATHER APPLICATION ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
GFX.setTheme = function(theme) { GFX.theme = theme || "funny"; GFX._applyAtmosphere(); };
GFX.setWeather = function(w) { GFX.weather = w || "clear"; GFX._applyAtmosphere(); };

GFX._applyAtmosphere = function() {
  if (!GFX.ready) return;
  var P = GFX.themePreset(GFX.theme);
  var W = GFX.WEATHER_MOD[GFX.weather] || GFX.WEATHER_MOD.clear;
  // Dark / indoor themes are only lightly affected by weather tinting
  var lum = new THREE.Color(P.hor); var hl = lum.r * 0.3 + lum.g * 0.6 + lum.b * 0.1;
  var mixK = W.skyMix * Math.min(1, 0.25 + hl * 1.6);
  var skyW = new THREE.Color(W.skyCol);
  var zen = new THREE.Color(P.zen).lerp(skyW, mixK * 0.9);
  var hor = new THREE.Color(P.hor).lerp(skyW, mixK);
  var gnd = new THREE.Color(P.gnd).lerp(skyW, mixK * 0.5);
  if (W.warm) { hor.lerp(new THREE.Color(0xffd8a0), 0.25); }
  var u = GFX.skyUniforms;
  u.zenith.value.copy(zen); u.horizon.value.copy(hor); u.ground.value.copy(gnd);
  u.stars.value = P.stars || 0;
  u.clouds.value = Math.min(1, Math.max(P.clouds || 0, W.cloud * (P.clouds === 0 && hl < 0.15 ? 0.3 : 1)));
  u.cloudCol.value.set(W.cloudCol || P.cloudCol || 0xffffff);
  if (W.cloudCol) u.cloudCol.value.lerp(new THREE.Color(P.cloudCol || 0xffffff), 0.25);

  // Sun
  var el = P.sun[2] * Math.PI / 180, az = P.sun[3] * Math.PI / 180;
  var sd = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
  GFX.sunDir = sd;
  u.sunDir.value.copy(sd);
  u.sunColor.value.set(P.sun[0]);
  u.sunSize.value = GFX.theme === "moon" ? 0.0012 : 0.0009;
  GFX.sun.color.set(P.sun[0]);
  if (W.warm) GFX.sun.color.lerp(new THREE.Color(0xffc080), 0.3);
  GFX.sunBase = P.sun[1] * W.sun;
  GFX.sun.intensity = GFX.sunBase;
  GFX.hemi.color.set(P.hemi[0]).lerp(skyW, mixK * 0.5);
  GFX.hemi.groundColor.set(P.hemi[1]);
  GFX.hemiBase = P.hemi[2] * (W.sun < 0.6 ? 1.15 : 1.0);
  GFX.hemi.intensity = GFX.hemiBase;

  // Fog — colour always matches the horizon so geometry melts into the sky
  GFX.renderer.toneMappingExposure = (P.exp || 1) * W.expMul;
  if (GFX.scene.fog) {
    var fogCol = new THREE.Color(P.fog[0]).lerp(hor, 0.8);
    if (W.fogToSky) fogCol.lerp(skyW, 0.6);
    if (W.fogToSky) { u.horizon.value.copy(fogCol); u.ground.value.copy(fogCol); }
    else u.ground.value.copy(fogCol);   // below the horizon the sky is the haze the distant land melts into
    GFX._fogLinear = fogCol.clone();
    GFX._updateFogColor();
    GFX.scene.fog.density = (W.fogAbs ? Math.max(W.fogAbs, P.fog[1]) : P.fog[1] * W.fogMul) * (GFX.fogBoost || 1);
  }
  GFX.windGrass = W.windGrass;

  // Water
  if (GFX.waterMat) GFX._applyWaterColors();
  // Precipitation
  GFX.rain.visible = (GFX.weather === "rainy" || GFX.weather === "stormy") && GFX.theme !== "moon";
  GFX.snow.visible = GFX.weather === "snow";
  // Bloom
  if (GFX.bloomPass) GFX.bloomPass.strength = P.bloom || 0.3;
  GFX._envDirty = true;
};

// three r128 mixes fog in AFTER tone mapping + output encoding, using the raw
// uniform. So the fog colour must be given in display space or fogged geometry
// won't match the (properly tone-mapped) sky horizon behind it.
GFX._aces = function(c, exposure) {
  var r = c.r * exposure / 0.6, g = c.g * exposure / 0.6, b = c.b * exposure / 0.6;
  var vr = 0.59719 * r + 0.35458 * g + 0.04823 * b, vg = 0.07600 * r + 0.90834 * g + 0.01566 * b, vb = 0.02840 * r + 0.13383 * g + 0.83777 * b;
  function fit(v) { var a = v * (v + 0.0245786) - 0.000090537, d = v * (0.983729 * v + 0.4329510) + 0.238081; return a / d; }
  vr = fit(vr); vg = fit(vg); vb = fit(vb);
  var o = new THREE.Color();
  o.r = Math.min(1, Math.max(0, 1.60475 * vr - 0.53108 * vg - 0.07367 * vb));
  o.g = Math.min(1, Math.max(0, -0.10208 * vr + 1.10813 * vg - 0.00605 * vb));
  o.b = Math.min(1, Math.max(0, -0.00327 * vr - 0.07276 * vg + 1.07602 * vb));
  return o;
};
GFX._updateFogColor = function() {
  if (!GFX.scene || !GFX.scene.fog || !GFX._fogLinear) return;
  var c = GFX._aces(GFX._fogLinear, GFX.renderer.toneMappingExposure);
  if (!GFX.composer) c.convertLinearToSRGB();   // composer path encodes in the final pass
  GFX.scene.fog.color.copy(c);
};

GFX._regenEnv = function() {
  if (!GFX.pmrem) return;
  var old = GFX.envRT;
  // Render the env without the sun disc blowing out reflections
  var prevSize = GFX.skyUniforms.sunSize.value;
  GFX.skyUniforms.sunSize.value = 0.004;
  var tm = GFX.renderer.toneMapping;
  GFX.renderer.toneMapping = THREE.NoToneMapping;
  // Bright skies (snow, white tiles) would flood everything with sky light: themes can dim it (P.env)
  var envMul = (GFX.themePreset(GFX.theme) || {}).env || 1, U = GFX.skyUniforms, saved = null;
  if (envMul !== 1) { saved = [U.zenith.value.clone(), U.horizon.value.clone(), U.ground.value.clone()]; U.zenith.value.multiplyScalar(envMul); U.horizon.value.multiplyScalar(envMul); U.ground.value.multiplyScalar(envMul); }
  GFX.envRT = GFX.pmrem.fromScene(GFX.envScene, 0.02, 0.1, 1200);
  if (saved) { U.zenith.value.copy(saved[0]); U.horizon.value.copy(saved[1]); U.ground.value.copy(saved[2]); }
  GFX.renderer.toneMapping = tm;
  GFX.skyUniforms.sunSize.value = prevSize;
  GFX.scene.environment = GFX.envRT.texture;
  if (old) old.dispose();
  GFX._envDirty = false;
};

// ══════════════════════════════════════════════════════════════════════════════
// ── CANVAS TEXTURES ──────────────────────────────────────────────────────────
// Greyscale-ish detail maps; hue comes from vertex colours so one texture
// serves many themes. Also used as bump maps for cheap surface relief.
// ══════════════════════════════════════════════════════════════════════════════
GFX._canvas = function(size) { var c = document.createElement("canvas"); c.width = c.height = size; return c; };
GFX._tex = function(canvas, opts) {
  opts = opts || {};
  var t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.encoding = opts.linear ? THREE.LinearEncoding : THREE.sRGBEncoding;
  if (opts.nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; }
  t.anisotropy = GFX.renderer ? Math.min(8, GFX.renderer.capabilities.getMaxAnisotropy()) : 1;
  return t;
};
GFX.softDotTexture = function() {
  if (GFX._texCache.softDot) return GFX._texCache.softDot;
  var c = GFX._canvas(64), g = c.getContext("2d");
  var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.75)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  return (GFX._texCache.softDot = t);
};

// Seamlessly tileable value noise: lattice wraps with the given integer period
function _gfxTileNoise(x, y, p, seed) {
  var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  function h(a, b) { a = ((a % p) + p) % p; b = ((b % p) + p) % p; var s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); }
  var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  var A = h(xi, yi), B = h(xi + 1, yi), Cc = h(xi, yi + 1), D = h(xi + 1, yi + 1);
  return A + (B - A) * u + (Cc - A) * v + (A - B - Cc + D) * u * v;
}
GFX._noiseFill = function(g, S, base, amp, scale, seed) {
  var img = g.getImageData(0, 0, S, S), d = img.data;
  for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
    var nx = x / S, ny = y / S;
    var n = 0, a = 0.5, f = Math.max(1, Math.round(scale)), norm = 0;
    for (var o = 0; o < 4; o++) {
      n += _gfxTileNoise(nx * f, ny * f, f, seed + o) * a; norm += a; a *= 0.5; f *= 2;
    }
    n /= norm;
    var v = base + (n - 0.5) * amp + (Math.random() - 0.5) * amp * 0.35;
    var i = (y * S + x) * 4;
    d[i] = d[i] * v; d[i + 1] = d[i + 1] * v; d[i + 2] = d[i + 2] * v;
  }
  g.putImageData(img, 0, 0);
};

GFX.surfaceTexture = function(style, P) {
  var key = "surf_" + style + "_" + (P && P.surf && P.surf.line || 0);
  if (GFX._texCache[key]) return GFX._texCache[key];
  var S = 256, c = GFX._canvas(S), g = c.getContext("2d"), i, x, y;
  var res = { map: null, bump: null, emissive: null, repeat: 4, rough: 0.9, bumpScale: 0.03 };
  g.fillStyle = "#fff"; g.fillRect(0, 0, S, S);
  switch (style) {
    case "grass": {
      GFX._noiseFill(g, S, 0.88, 0.3, 4, 3.1);
      for (i = 0; i < 2600; i++) {
        x = Math.random() * S; y = Math.random() * S;
        var l = 2 + Math.random() * 5, ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
        g.strokeStyle = Math.random() < 0.5 ? "rgba(255,255,230,0.25)" : "rgba(0,20,0,0.18)";
        g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l); g.stroke();
      }
      // mowing stripes (two per texture tile)
      g.fillStyle = "rgba(255,255,255,0.07)"; g.fillRect(0, 0, S, S / 2);
      g.fillStyle = "rgba(0,0,0,0.05)"; g.fillRect(0, S / 2, S, S / 2);
      res.repeat = 5; res.rough = 0.95; break;
    }
    case "snow": {
      GFX._noiseFill(g, S, 0.97, 0.08, 3, 7.7);
      for (i = 0; i < 260; i++) { g.fillStyle = "rgba(255,255,255,0.9)"; g.fillRect(Math.random() * S, Math.random() * S, 1, 1); }
      res.repeat = 6; res.rough = 0.6; res.bumpScale = 0.02; break;
    }
    case "sand": case "dirt": case "regolith": {
      GFX._noiseFill(g, S, 0.9, style === "dirt" ? 0.35 : 0.22, 6, 1.3);
      for (i = 0; i < 4000; i++) { var s2 = Math.random(); g.fillStyle = s2 < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)"; g.fillRect(Math.random() * S, Math.random() * S, 1, 1); }
      if (style === "regolith") {
        for (i = 0; i < 26; i++) {
          x = Math.random() * S; y = Math.random() * S; var r = 3 + Math.random() * 14;
          g.strokeStyle = "rgba(0,0,0,0.22)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.stroke();
          g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 1; g.beginPath(); g.arc(x - 1, y - 1, r, 3.6, 5.6); g.stroke();
        }
      }
      if (style === "dirt") for (i = 0; i < 120; i++) { g.fillStyle = "rgba(0,0,0,0.18)"; g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 1 + Math.random() * 3, 0, 6.28); g.fill(); }
      res.repeat = 6; res.rough = 1.0; res.bumpScale = 0.05; break;
    }
    case "soil": {
      GFX._noiseFill(g, S, 0.85, 0.35, 6, 2.2);
      for (y = 0; y < S; y += S / 4) { // furrows
        var gr = g.createLinearGradient(0, y, 0, y + S / 4);
        gr.addColorStop(0, "rgba(0,0,0,0.35)"); gr.addColorStop(0.5, "rgba(255,255,255,0.12)"); gr.addColorStop(1, "rgba(0,0,0,0.35)");
        g.fillStyle = gr; g.fillRect(0, y, S, S / 4);
      }
      res.repeat = 4; res.rough = 1.0; res.bumpScale = 0.08; break;
    }
    case "carpet": {
      GFX._noiseFill(g, S, 0.9, 0.18, 12, 4.4);
      for (i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"; g.fillRect(Math.random() * S, Math.random() * S, 1, 1); }
      g.strokeStyle = "rgba(0,0,0,0.06)"; g.lineWidth = 2;
      for (i = 0; i < 8; i++) { g.beginPath(); g.arc(S / 2, S / 2, i * 18, 0, 6.28); g.stroke(); }
      res.repeat = 3; res.rough = 1.0; res.bumpScale = 0.015; break;
    }
    case "tile": {
      var n = 8, ts = S / n;
      for (y = 0; y < n; y++) for (x = 0; x < n; x++) {
        var v = 236 + Math.floor(Math.random() * 16);
        g.fillStyle = "rgb(" + v + "," + v + "," + v + ")"; g.fillRect(x * ts, y * ts, ts, ts);
      }
      g.strokeStyle = "rgba(90,110,110,0.9)"; g.lineWidth = 2;
      for (i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * ts, 0); g.lineTo(i * ts, S); g.stroke(); g.beginPath(); g.moveTo(0, i * ts); g.lineTo(S, i * ts); g.stroke(); }
      res.repeat = 2.0; res.rough = 0.25; res.bumpScale = 0.02; break;
    }
    case "concrete": {
      GFX._noiseFill(g, S, 0.9, 0.25, 5, 5.5);
      g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 1); g.lineTo(S, 1); g.moveTo(1, 0); g.lineTo(1, S); g.stroke();
      for (i = 0; i < 40; i++) { g.fillStyle = "rgba(0,0,0,0.08)"; g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 2 + Math.random() * 10, 0, 6.28); g.fill(); }
      res.repeat = 2.5; res.rough = 0.85; break;
    }
    case "stone": {
      GFX._noiseFill(g, S, 0.9, 0.25, 6, 8.1);
      g.strokeStyle = "rgba(0,0,0,0.55)"; g.lineWidth = 3;
      var rows = 4, rh = S / rows;
      for (y = 0; y < rows; y++) {
        g.beginPath(); g.moveTo(0, y * rh); g.lineTo(S, y * rh); g.stroke();
        var off = (y % 2) * rh * 0.6;
        for (x = off; x < S + rh; x += rh * 1.25) { g.beginPath(); g.moveTo(x, y * rh); g.lineTo(x + (Math.random() - 0.5) * 6, (y + 1) * rh); g.stroke(); }
      }
      res.repeat = 2.5; res.rough = 0.9; res.bumpScale = 0.07; break;
    }
    case "rock": {
      GFX._noiseFill(g, S, 0.85, 0.45, 5, 9.9);
      for (i = 0; i < 70; i++) {
        g.strokeStyle = "rgba(0,0,0," + (0.1 + Math.random() * 0.25) + ")"; g.lineWidth = 1 + Math.random() * 1.5;
        x = Math.random() * S; y = Math.random() * S; g.beginPath(); g.moveTo(x, y);
        for (var k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 30; y += Math.random() * 20; g.lineTo(x, y); }
        g.stroke();
      }
      res.repeat = 3; res.rough = 0.95; res.bumpScale = 0.08; break;
    }
    case "pixel": {
      var PS = 16; c = GFX._canvas(PS); g = c.getContext("2d");
      for (y = 0; y < PS; y++) for (x = 0; x < PS; x++) {
        var vv = 200 + Math.floor(Math.random() * 55);
        g.fillStyle = "rgb(" + vv + "," + vv + "," + vv + ")"; g.fillRect(x, y, 1, 1);
      }
      var tx = GFX._tex(c, { nearest: true });
      res.map = tx; res.bump = null; res.repeat = 1.0; res.rough = 1.0;
      GFX._texCache[key] = res; return res;
    }
    case "neon": case "dance": {
      g.fillStyle = "#0a0a0a"; g.fillRect(0, 0, S, S);
      GFX._noiseFill(g, S, 1.0, 0.4, 4, 2.7);
      var e = GFX._canvas(S), eg = e.getContext("2d");
      eg.fillStyle = "#000"; eg.fillRect(0, 0, S, S);
      if (style === "dance") {
        var cols = ["#ff2a8a", "#2affe0", "#ffe02a", "#8a2aff", "#2a6aff", "#ff6a2a"], N2 = 4, cs = S / N2;
        for (y = 0; y < N2; y++) for (x = 0; x < N2; x++) {
          eg.fillStyle = cols[Math.floor(Math.random() * cols.length)];
          eg.globalAlpha = 0.25 + Math.random() * 0.55; eg.fillRect(x * cs + 3, y * cs + 3, cs - 6, cs - 6);
        }
        eg.globalAlpha = 1;
        res.repeat = 4.0;
      } else {
        var lc = new THREE.Color(P && P.surf && P.surf.line || 0x00ffff);
        eg.strokeStyle = "#" + lc.clone().convertLinearToSRGB().getHexString(); eg.lineWidth = 3; eg.shadowColor = eg.strokeStyle; eg.shadowBlur = 8;
        eg.strokeRect(1.5, 1.5, S - 3, S - 3);
        eg.lineWidth = 1; eg.globalAlpha = 0.45; eg.beginPath(); eg.moveTo(S / 2, 0); eg.lineTo(S / 2, S); eg.moveTo(0, S / 2); eg.lineTo(S, S / 2); eg.stroke();
        res.repeat = 3.0;
      }
      res.emissive = GFX._tex(e);
      res.rough = 0.25; res.bumpScale = 0;
      break;
    }
  }
  res.map = GFX._tex(c);
  if (res.bumpScale > 0) res.bump = res.map;
  GFX._texCache[key] = res;
  return res;
};

// ══════════════════════════════════════════════════════════════════════════════
// ── GEOMETRY UTILS ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// Merge geometries (non-indexed output) — attributes: position, normal, uv(optional), color(optional)
GFX.mergeGeometries = function(geos) {
  var total = 0, hasUV = true, hasCol = false;
  var flat = geos.map(function(g) {
    var ng = g.index ? g.toNonIndexed() : g;
    total += ng.attributes.position.count;
    if (!ng.attributes.uv) hasUV = false;
    if (ng.attributes.color) hasCol = true;
    return ng;
  });
  var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  var uv = hasUV ? new Float32Array(total * 2) : null, col = hasCol ? new Float32Array(total * 3) : null;
  var o = 0;
  flat.forEach(function(g) {
    var n = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, n * 3), o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
    if (uv && g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
    if (col) { if (g.attributes.color && g.attributes.color.itemSize === 3) col.set(g.attributes.color.array.subarray(0, n * 3), o * 3); else col.fill(1, o * 3, (o + n) * 3); }
    o += n;
  });
  var out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
};

// Batch static meshes under `root` that share a material into single meshes.
// Only direct-or-nested plain meshes without animation hooks are merged.
GFX.batchStatic = function(root, keepShadow) {
  root.updateMatrixWorld(true);
  var inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  var buckets = {}, victims = [];
  function put(mat, geo, mw, cast, owner) {
    var key = mat.uuid + (geo.attributes.uv ? "_uv" : "") + (cast ? "_cs" : "");
    (buckets[key] = buckets[key] || { mat: mat, cast: cast, list: [] }).list.push({ geo: geo, mw: mw, owner: owner });
  }
  root.traverse(function(o) {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    if (o.userData.noBatch || (o.parent && o.parent.userData && o.parent.userData.rotY)) return;
    for (var an = o.parent; an && an !== root; an = an.parent) if (an.userData.noBatch) return;
    var g = o.geometry; if (!g || !g.attributes.position || !g.attributes.normal) return;
    if (Array.isArray(o.material)) {
      // Multi-material mesh (e.g. a building with walls + roof): split it per material group
      if (!g.groups.length || o.material.some(function(m) { return !m || m.vertexColors; })) return;
      var ng = g.index ? g.toNonIndexed() : g;
      g.groups.forEach(function(gr) {
        var m = o.material[gr.materialIndex];
        var sub = new THREE.BufferGeometry();
        ["position", "normal", "uv"].forEach(function(an2) {
          var at = ng.attributes[an2]; if (!at) return;
          sub.setAttribute(an2, new THREE.BufferAttribute(at.array.slice(gr.start * at.itemSize, (gr.start + gr.count) * at.itemSize), at.itemSize));
        });
        put(m, sub, o.matrixWorld, o.castShadow, o);
      });
      victims.push({ o: o, temp: ng !== g ? ng : null });
      return;
    }
    if (g.attributes.color && o.material.vertexColors) return;   // keep vertex-coloured meshes (island tops, terrain)
    put(o.material, g, o.matrixWorld, o.castShadow, o);
  });
  var merged = {};
  Object.keys(buckets).forEach(function(k) {
    var b = buckets[k];
    var multi = b.list.some(function(e) { return Array.isArray(e.owner.material); });
    if (b.list.length < 2 && !multi) return;
    var geos = b.list.map(function(e) {
      var m4 = new THREE.Matrix4().multiplyMatrices(inv, e.mw);
      var gg = e.geo.clone(); gg.applyMatrix4(m4);
      if (gg.attributes.color) gg.deleteAttribute("color");
      if (gg.index) gg = gg.toNonIndexed();
      return gg;
    });
    // all inputs must agree on attributes
    var hasUV = geos.every(function(gg) { return !!gg.attributes.uv; });
    geos.forEach(function(gg) { if (!hasUV && gg.attributes.uv) gg.deleteAttribute("uv"); });
    var mg = GFX.mergeGeometries(geos);
    geos.forEach(function(gg) { gg.dispose(); });
    if (!mg) return;
    var mesh = new THREE.Mesh(mg, b.mat);
    mesh.castShadow = !!(keepShadow ? b.cast : b.cast && root.userData.batchShadows); mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    root.add(mesh);
    b.list.forEach(function(e) { if (!Array.isArray(e.owner.material)) victims.push({ o: e.owner }); merged[e.owner.uuid] = 1; });
  });
  var seen = {};
  victims.forEach(function(v) {
    if (seen[v.o.uuid]) return; seen[v.o.uuid] = 1;
    if (v.temp) v.temp.dispose();
    if (Array.isArray(v.o.material) && !merged[v.o.uuid]) return;
    if (v.o.parent) v.o.parent.remove(v.o); v.o.geometry.dispose();
  });
};

// Dispose geometries/materials/textures of a subtree (skips shared cache textures)
GFX.disposeTree = function(root) {
  if (!root) return;
  var cached = {};
  Object.keys(GFX._texCache).forEach(function(k) { var r = GFX._texCache[k]; if (r && r.isTexture) cached[r.uuid] = 1; else if (r) { ["map", "bump", "emissive"].forEach(function(p) { if (r[p]) cached[r[p].uuid] = 1; }); } });
  root.traverse(function(o) {
    if (o.userData && o.userData.sharedAsset) return;
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) {
      var ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(function(m) {
        if (!m || m.userData.shared) return;
        ["map", "emissiveMap", "bumpMap", "normalMap", "roughnessMap", "alphaMap"].forEach(function(p) {
          if (m[p] && !cached[m[p].uuid] && !m[p]._dgShared) m[p].dispose();
        });
        m.dispose();
      });
    }
  });
};

// Convert Lambert/Phong materials under root to PBR so everything shares one lighting model
GFX.upgradeMaterials = function(root) {
  var cache = GFX._matUpgradeCache || (GFX._matUpgradeCache = new WeakMap());
  (function walk(o) {
    if (o.userData && o.userData.noUpgrade) return;
    visit(o);
    for (var i = 0; i < o.children.length; i++) walk(o.children[i]);
  })(root);
  function visit(o) {
    if (!o.isMesh && !o.isInstancedMesh) return;
    var arr = Array.isArray(o.material), ms = arr ? o.material : [o.material];
    var out = ms.map(function(m) {
      if (!m || !(m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return m;
      if (cache.has(m)) return cache.get(m);
      var rough = m.isMeshPhongMaterial ? Math.max(0.2, 1 - (m.shininess || 30) / 140) : 0.82;
      var nm = new THREE.MeshStandardMaterial({
        color: m.color.clone(), emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0),
        map: m.map || null, transparent: m.transparent, opacity: m.opacity, side: m.side,
        vertexColors: m.vertexColors, roughness: rough, metalness: 0, flatShading: !!m.flatShading,
        depthWrite: m.depthWrite, alphaTest: m.alphaTest || 0, emissiveMap: m.emissiveMap || null,
      });
      nm.name = m.name;
      cache.set(m, nm);
      return nm;
    });
    o.material = arr ? out : out[0];
  }
};

// Keep only the N most relevant point lights visible (each light costs every lit pixel)
GFX.capLights = function(root, keepNear) {
  var lights = [];
  root.traverse(function(o) { if (o.isPointLight || o.isSpotLight) lights.push(o); });
  var max = GFX.settings ? GFX.settings.maxLights : 6;
  if (lights.length <= max) return;
  var wp = new THREE.Vector3();
  lights.forEach(function(l) {
    l.getWorldPosition(wp);
    var d = Infinity;
    (keepNear || []).forEach(function(p) { d = Math.min(d, Math.hypot(wp.x - p.x, wp.z - p.z)); });
    l.userData._prio = (l.userData.priority || 0) * 1000 - d;
  });
  lights.sort(function(a, b) { return b.userData._prio - a.userData._prio; });
  lights.forEach(function(l, i) { if (i >= max) l.visible = false; });
};

// Fix GLB materials: Blender exports default metalness 0.4 which renders dull grey without an env
GFX.fixGLBMaterials = function(root) {
  root.traverse(function(o) {
    if (!o.isMesh) return;
    var ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach(function(m) {
      if (!m || m.userData._dgFixed) return;
      m.userData._dgFixed = true;
      if (m.isMeshStandardMaterial) {
        if (!m.metalnessMap && m.metalness > 0 && m.metalness < 0.9) m.metalness = 0.0;
        if (m.roughness < 0.25 && !m.roughnessMap) m.roughness = 0.35;
        m.envMapIntensity = 1.0;
      }
      if (m.map) { m.map.anisotropy = GFX.renderer ? Math.min(8, GFX.renderer.capabilities.getMaxAnisotropy()) : 1; }
    });
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// ── 3. WATER ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
GFX.MAX_FOAM = 24;
GFX._waterVert = [
  "varying vec3 vWorld;",
  "#include <fog_pars_vertex>",
  "void main(){",
  "  vec4 wp = modelMatrix * vec4(position, 1.0);",
  "  vWorld = wp.xyz;",
  "  vec4 mvPosition = viewMatrix * wp;",
  "  gl_Position = projectionMatrix * mvPosition;",
  "  #include <fog_vertex>",
  "}"
].join("\n");
GFX._waterFrag = [
  "uniform float time; uniform float kind; uniform vec3 deepCol; uniform vec3 shallowCol; uniform vec3 lineCol;",
  "uniform vec3 skyZen; uniform vec3 skyHor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunInt;",
  "uniform vec4 islands[" + 24 + "]; uniform int islandCount; uniform vec2 wind;",
  "varying vec3 vWorld;",
  "#include <fog_pars_fragment>",
  "float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }",
  "float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);",
  "  return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }",
  "float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=vn(p)*a; p=p*2.1+vec2(3.1,1.7); a*=0.5; } return v; }",
  "vec2 waveGrad(vec2 p, float t){",
  "  vec2 g = vec2(0.0);",
  "  vec2 d1 = normalize(vec2(1.0, 0.35) + wind*0.05); float k1 = 0.42; g += d1 * cos(dot(p,d1)*k1 + t*1.3) * 0.16;",
  "  vec2 d2 = normalize(vec2(-0.6, 1.0)); float k2 = 0.77; g += d2 * cos(dot(p,d2)*k2 + t*1.7) * 0.09;",
  "  vec2 d3 = normalize(vec2(0.2, -1.0)); float k3 = 1.9; g += d3 * cos(dot(p,d3)*k3 + t*2.9) * 0.05;",
  "  vec2 d4 = normalize(vec2(-1.0, -0.3)); float k4 = 3.7; g += d4 * cos(dot(p,d4)*k4 + t*4.1) * 0.03;",
  "  float e = 0.35; vec2 q = p*0.9 + t*vec2(0.11, 0.07);",
  "  g += vec2(fbm(q+vec2(e,0.0))-fbm(q-vec2(e,0.0)), fbm(q+vec2(0.0,e))-fbm(q-vec2(0.0,e))) * 0.55;",
  "  return g;",
  "}",
  "void main(){",
  "  vec3 V = normalize(cameraPosition - vWorld);",
  "  float dist = length(cameraPosition - vWorld);",
  "  float t = time;",
  // distance to the nearest shoreline
  "  float shore = 1e4;",
  "  for (int i = 0; i < " + 24 + "; i++) { if (i >= islandCount) break; vec4 I = islands[i]; shore = min(shore, length(vWorld.xz - I.xy) - I.z); }",
  "  vec3 col;",
  "  if (kind > 1.5 && kind < 2.5) {",   // ── LAVA
  "    vec2 p = vWorld.xz * 0.08;",
  "    float n = fbm(p + vec2(t*0.04, t*0.03)); float n2 = fbm(p*2.6 - vec2(t*0.06, -t*0.02));",
  "    float crust = smoothstep(0.42, 0.62, n*0.7 + n2*0.45);",
  "    vec3 hot = shallowCol * (2.2 + 1.2*sin(t*1.5 + n*12.0));",
  "    col = mix(hot, deepCol*0.6, crust);",
  "    col += shallowCol * 1.5 * smoothstep(1.2, 0.0, shore);",
  "  } else {",
  "    vec2 g = waveGrad(vWorld.xz, t) * smoothstep(380.0, 60.0, dist);",
  "    vec3 N = normalize(vec3(-g.x, 1.0, -g.y));",
  "    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);",
  "    vec3 R = reflect(-V, N);",
  "    vec3 refl = mix(skyHor, skyZen, pow(clamp(R.y, 0.0, 1.0), 0.6));",
  "    float depthK = smoothstep(0.0, 14.0, shore);",
  "    vec3 body = mix(shallowCol, deepCol, depthK);",
  "    body *= 0.75 + 0.25 * max(dot(N, normalize(sunDir)), 0.0);",
  "    col = mix(body, refl, clamp(fres, 0.0, 1.0));",
  "    float spec = pow(max(dot(R, normalize(sunDir)), 0.0), 220.0);",
  "    col += sunCol * spec * sunInt * 1.6;",
  "    if (kind > 2.5 && kind < 3.5) {",  // ── NEON GRID
  "      vec2 gp = abs(fract(vWorld.xz / 6.0) - 0.5);",
  "      float line = smoothstep(0.03, 0.0, min(gp.x, gp.y) - 0.0) ;",
  "      float pulse = 0.6 + 0.4*sin(t*2.0 - length(vWorld.xz)*0.05);",
  "      col = col*0.5 + lineCol * line * 1.6 * pulse * smoothstep(420.0, 40.0, dist);",
  "    }",
  // shoreline foam
  "    float fn = fbm(vWorld.xz*1.6 + vec2(t*0.3, -t*0.2));",
  "    float band = smoothstep(0.6, 0.0, shore + (fn-0.5)*0.4);",
  "    float ripple = smoothstep(0.82, 0.98, 0.5 + 0.5*sin(shore*6.0 - t*2.0 + fn*6.0)) * smoothstep(2.0, 0.3, shore) * smoothstep(0.45, 0.7, fn);",
  "    float foam = max(band * smoothstep(0.38, 0.66, fn + band*0.2), ripple * 0.4);",
  "    if (kind > 2.5) foam *= 0.35;",
  "    col = mix(col, vec3(0.92,0.96,1.0) * (0.5 + 0.5*min(1.0, sunInt/2.5)), clamp(foam, 0.0, 0.75));",
  "  }",
  "  gl_FragColor = vec4(col, 1.0);",
  "  #include <tonemapping_fragment>",
  "  #include <encodings_fragment>",
  "  #include <fog_fragment>",
  "}"
].join("\n");

GFX.buildWater = function(hole) {
  var P = GFX.themePreset(hole.theme);
  var W = P.water || { kind: "water" };
  if (W.kind === "none" || W.kind === "void") return new THREE.Group();
  var islands = []; for (var i = 0; i < GFX.MAX_FOAM; i++) islands.push(new THREE.Vector4(1e5, 1e5, 0, 0));
  var uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    time: { value: 0 }, kind: { value: 1 },
    deepCol: { value: new THREE.Color() }, shallowCol: { value: new THREE.Color() }, lineCol: { value: new THREE.Color() },
    skyZen: { value: new THREE.Color() }, skyHor: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunInt: { value: 1 },
    islands: { value: islands }, islandCount: { value: 0 }, wind: { value: new THREE.Vector2() },
  }]);
  uniforms.time = GFX.time;
  uniforms.islands.value = islands;
  var mat = new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: GFX._waterVert, fragmentShader: GFX._waterFrag, fog: true });
  mat.extensions = { derivatives: true };
  GFX.waterMat = mat;
  GFX._waterKind = W;
  GFX._applyWaterColors();
  var geo = new THREE.PlaneGeometry(2400, 2400, 1, 1); geo.rotateX(-Math.PI / 2);
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = hole.water;
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.userData.isWater = true;
  return mesh;
};

GFX._applyWaterColors = function() {
  var m = GFX.waterMat; if (!m) return;
  var W = GFX._waterKind || { kind: "water", deep: 0x0b4a7a, shallow: 0x2fa6c9 };
  var u = m.uniforms;
  u.kind.value = W.kind === "lava" ? 2 : W.kind === "grid" ? 3 : 1;
  u.deepCol.value.set(W.deep || 0x0b4a7a); u.shallowCol.value.set(W.shallow || 0x2fa6c9); u.lineCol.value.set(W.line || 0xff00ff);
  var Wm = GFX.WEATHER_MOD[GFX.weather] || GFX.WEATHER_MOD.clear;
  if (Wm.skyMix > 0.3 && W.kind === "water") { u.deepCol.value.lerp(new THREE.Color(0x1a2228), 0.35); u.shallowCol.value.lerp(new THREE.Color(0x3a4a50), 0.35); }
  u.skyZen.value.copy(GFX.skyUniforms.zenith.value); u.skyHor.value.copy(GFX.skyUniforms.horizon.value);
  u.sunDir.value.copy(GFX.sunDir || new THREE.Vector3(0, 1, 0)); u.sunCol.value.copy(GFX.sun.color); u.sunInt.value = GFX.sun.intensity;
};

GFX.setFoamIslands = function(list) { GFX.islandsForFoam = list || []; };
GFX._updateWaterUniforms = function() {
  var m = GFX.waterMat; if (!m) return;
  var arr = m.uniforms.islands.value, list = GFX.islandsForFoam, n = Math.min(list.length, GFX.MAX_FOAM);
  for (var i = 0; i < n; i++) {
    var I = list[i];
    var x = (I.mv && I.mv.currentX !== undefined) ? I.mv.currentX : I.x;
    var z = (I.mv && I.mv.currentZ !== undefined) ? I.mv.currentZ : I.z;
    arr[i].set(x, z, I.r, 0);
  }
  m.uniforms.islandCount.value = n;
  var w = (typeof HOLES !== "undefined" && HOLES[holeIdx]) ? HOLES[holeIdx].wind : { x: 0, z: 0 };
  m.uniforms.wind.value.set(w.x, w.z);
  m.uniforms.sunInt.value = GFX.sun.intensity;
};

// ══════════════════════════════════════════════════════════════════════════════
// ── 4. ISLANDS ───────────────────────────────────────────────────────────────
// Top surface is perfectly flat out to r (matches terrainYIsland), then an
// edge chamfer to r+0.5 (matches the physics taper), then a rocky cliff.
// ══════════════════════════════════════════════════════════════════════════════
GFX._islandMats = function(theme) {
  var key = "isl_" + theme;
  if (GFX._matCache[key]) return GFX._matCache[key];
  var P = GFX.themePreset(theme), S = P.surf;
  var st = GFX.surfaceTexture(S.style, P);
  var topMat = new THREE.MeshStandardMaterial({
    vertexColors: true, map: st.map, roughness: st.rough, metalness: 0,
    bumpMap: st.bump || null, bumpScale: st.bumpScale || 0,
  });
  if (st.emissive) { topMat.emissive = new THREE.Color(0xffffff); topMat.emissiveMap = st.emissive; topMat.emissiveIntensity = 1.2; }
  var rt = S.style === "pixel" ? GFX.surfaceTexture("pixel", P) :
           (S.style === "tile") ? GFX.surfaceTexture("tile", P) :
           (S.style === "neon" || S.style === "dance") ? GFX.surfaceTexture("neon", P) : GFX.surfaceTexture("rock", P);
  var rockMat = new THREE.MeshStandardMaterial({
    vertexColors: true, map: rt.map, roughness: rt.rough, metalness: 0, bumpMap: rt.bump || null, bumpScale: (rt.bumpScale || 0) * 1.6,
  });
  if (rt.emissive) { rockMat.emissive = new THREE.Color(0xffffff); rockMat.emissiveMap = rt.emissive; rockMat.emissiveIntensity = 0.6; }
  topMat.userData.shared = true; rockMat.userData.shared = true;
  return (GFX._matCache[key] = { top: topMat, rock: rockMat, tex: st });
};

// opts: {x, z, r, surfY, waterY, theme, type, floating, seed}
GFX.buildIsland = function(o) {
  var P = GFX.themePreset(o.theme), S = P.surf, mats = GFX._islandMats(o.theme);
  var grp = new THREE.Group();
  var r = o.r, seed = o.seed || (Math.floor(o.x * 13.7 + o.z * 7.3) | 0);
  var rnd = _gfxRng(seed * 2654435761);
  var pixel = S.style === "pixel", tileish = S.style === "tile" || S.style === "neon" || S.style === "dance" || S.style === "concrete";
  var segs = pixel ? 8 : 64, rings = 9;
  var cTop = new THREE.Color(S.top), cEdge = new THREE.Color(S.edge), cR1 = new THREE.Color(S.rock1), cR2 = new THREE.Color(S.rock2);
  var isGreen = o.type === "basket" && S.style === "grass";
  var tmp = new THREE.Color();
  var texRep = (mats.tex && mats.tex.repeat) || 4;

  // ── TOP (polar grid, flat) ──
  var pos = [], col = [], uv = [], idx = [];
  pos.push(0, 0, 0); uv.push(o.x / texRep, o.z / texRep);
  tmp.copy(cTop); col.push(tmp.r, tmp.g, tmp.b);
  var ringStart = [];
  var profile = []; // radial profile for top + chamfer (radius, dy)
  for (var ri = 1; ri <= rings; ri++) profile.push([r * ri / rings, 0]);
  if (!pixel) { profile.push([r + 0.12, -0.12]); profile.push([r + 0.3, -0.5]); profile.push([r + 0.48, -0.95]); }
  else profile.push([r + 0.02, -0.02]);
  for (var pi = 0; pi < profile.length; pi++) {
    ringStart.push(pos.length / 3);
    var pr = profile[pi][0], dy = profile[pi][1];
    for (var si = 0; si < segs; si++) {
      var a = si / segs * Math.PI * 2;
      var wob = pixel ? 0 : (_gfxFbm2(Math.cos(a) * 2 + seed * 0.13, Math.sin(a) * 2) - 0.5) * (dy < 0 ? 0.35 : 0);
      var px = Math.cos(a) * (pr + wob), pz = Math.sin(a) * (pr + wob);
      pos.push(px, dy, pz);
      uv.push((o.x + px) / texRep, (o.z + pz) / texRep);
      // Colour: big soft variation; dirt toward the edge; lighter "green" near basket
      var wx = o.x + px, wz = o.z + pz;
      var n = _gfxFbm2(wx * 0.11, wz * 0.11, 3), n2 = _gfxFbm2(wx * 0.5 + 7, wz * 0.5, 2);
      tmp.copy(cTop);
      if (!tileish) tmp.multiplyScalar(0.82 + n * 0.36 + (n2 - 0.5) * 0.08);
      if (S.style === "grass") tmp.lerp(new THREE.Color(0xb8b040), Math.max(0, n - 0.62) * 0.6);
      var edgeK = dy < 0 ? 1 : Math.max(0, (pr - (r - 0.9)) / 0.9) * 0.55;
      if (!tileish && !pixel) tmp.lerp(cEdge, edgeK);
      if (isGreen && pr < r * 0.55) tmp.lerp(cTop.clone().lerp(new THREE.Color(0xd8ff90), 0.18), 0.7);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (var s0 = 0; s0 < segs; s0++) idx.push(0, ringStart[0] + (s0 + 1) % segs, ringStart[0] + s0);
  for (var p2 = 0; p2 < profile.length - 1; p2++) {
    var A = ringStart[p2], B = ringStart[p2 + 1];
    for (var s1 = 0; s1 < segs; s1++) {
      var s2 = (s1 + 1) % segs;
      idx.push(A + s1, A + s2, B + s1, A + s2, B + s2, B + s1);
    }
  }
  var topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  topGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  topGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  topGeo.setIndex(idx);
  topGeo.computeVertexNormals();
  var top = new THREE.Mesh(topGeo, mats.top);
  top.receiveShadow = true; top.castShadow = false;
  top.position.set(o.x, o.surfY, o.z);
  grp.add(top);

  // ── CLIFF ──
  var lastR = profile[profile.length - 1][0], lastY = profile[profile.length - 1][1];
  var waterDepth = o.surfY - o.waterY;
  var floating = !!o.floating;
  var cliffRings = [];
  if (pixel) {
    var blockH = 1.0, nb = Math.ceil(waterDepth + 2);
    for (var bi = 0; bi <= nb; bi++) cliffRings.push([lastR, -bi * blockH]);
  } else if (floating) {
    var depth = Math.max(4, r * 1.25);
    var steps = 10;
    for (var fi = 0; fi <= steps; fi++) {
      var tt = fi / steps;
      cliffRings.push([lastR * (1 - Math.pow(tt, 1.6) * 0.92), lastY - tt * depth]);
    }
  } else {
    var bottom = -(waterDepth + 3.5);
    var steps2 = 9;
    for (var ci = 0; ci <= steps2; ci++) {
      var t2 = ci / steps2;
      var yy = lastY + (bottom - lastY) * t2;
      cliffRings.push([lastR + Math.pow(t2, 1.3) * (0.35 + r * 0.09), yy]);
    }
  }
  var cp = [], cc = [], cu = [], ci2 = [];
  var csegs = pixel ? segs : 40;
  for (var cr = 0; cr < cliffRings.length; cr++) {
    var R0 = cliffRings[cr][0], Y0 = cliffRings[cr][1];
    for (var cs = 0; cs <= csegs; cs++) {
      var ang = cs / csegs * Math.PI * 2;
      var disp = 0;
      if (!pixel) {
        var nz = _gfxFbm2(Math.cos(ang) * 3 + seed * 0.07, Y0 * 0.35 + Math.sin(ang) * 3, 4);
        disp = (nz - 0.5) * (cr === 0 ? 0 : 1.1) * Math.min(1, cr / 2);
      }
      var rr = Math.max(0.05, R0 + disp);
      var cx = Math.cos(ang) * rr, cz = Math.sin(ang) * rr;
      cp.push(cx, Y0, cz);
      cu.push(ang * (r + 1) / (pixel ? 1 : 3.0), Y0 / (pixel ? 1 : 3.0));
      // strata + darker wet band near the water line
      var strata = 0.5 + 0.5 * Math.sin(Y0 * 2.2 + _gfxNoise2(ang * 4, Y0) * 2.0);
      tmp.copy(cR1).lerp(cR2, strata);
      if (!pixel) tmp.multiplyScalar(0.8 + _gfxNoise2(ang * 9 + 3, Y0 * 1.3) * 0.4);
      if (cr === 0 && !pixel) tmp.lerp(cEdge, 0.6);
      var wetY = o.waterY - o.surfY;
      if (!floating) { var wk = 1 - Math.min(1, Math.abs(Y0 - wetY) / 1.2); tmp.multiplyScalar(1 - wk * 0.35); }
      if (floating && cr > cliffRings.length - 3) tmp.multiplyScalar(0.7);
      cc.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (var r2 = 0; r2 < cliffRings.length - 1; r2++) {
    var A2 = r2 * (csegs + 1), B2 = (r2 + 1) * (csegs + 1);
    for (var s3 = 0; s3 < csegs; s3++) ci2.push(A2 + s3, A2 + s3 + 1, B2 + s3, A2 + s3 + 1, B2 + s3 + 1, B2 + s3);
  }
  var cliffGeo = new THREE.BufferGeometry();
  cliffGeo.setAttribute("position", new THREE.Float32BufferAttribute(cp, 3));
  cliffGeo.setAttribute("color", new THREE.Float32BufferAttribute(cc, 3));
  cliffGeo.setAttribute("uv", new THREE.Float32BufferAttribute(cu, 2));
  cliffGeo.setIndex(ci2);
  cliffGeo.computeVertexNormals();
  var cliff = new THREE.Mesh(cliffGeo, mats.rock);
  cliff.castShadow = true; cliff.receiveShadow = true;
  cliff.position.set(o.x, o.surfY, o.z);
  if (pixel) { cliff.material = mats.rock; }
  grp.add(cliff);

  // ── GRASS + FLOWERS + PEBBLES ──
  var gs = GFX.buildGrassField(o, P, rnd);
  if (gs) grp.add(gs);
  var fl = GFX.buildFlowers(o, P, rnd);
  if (fl) grp.add(fl);
  var pb = GFX.buildPebbles(o, P, rnd);
  if (pb) grp.add(pb);

  // Smallest radius of the (noise-displaced) cliff where it meets the water.
  // Foam starts there, so it never fills the gaps where the cliff dips inward.
  var wlY = o.waterY - o.surfY, wlR = lastR;
  for (var wi = 0; wi < cliffRings.length - 1; wi++) {
    var ya = cliffRings[wi][1], yb = cliffRings[wi + 1][1];
    if (wlY <= ya && wlY >= yb) {
      var k = (ya - wlY) / Math.max(0.001, ya - yb), minR = Infinity;
      for (var sv = 0; sv <= csegs; sv++) {
        var ia = (wi * (csegs + 1) + sv) * 3, ib = ((wi + 1) * (csegs + 1) + sv) * 3;
        var ra = Math.hypot(cp[ia], cp[ia + 2]), rb = Math.hypot(cp[ib], cp[ib + 2]);
        minR = Math.min(minR, ra + (rb - ra) * k);
      }
      wlR = minR;
      break;
    }
  }
  if (pixel) wlR *= Math.cos(Math.PI / segs);   // octagon: use the inscribed radius
  grp.userData.waterlineR = floating ? 0 : wlR + 0.05;
  return grp;
};

// ── Grass blades ─────────────────────────────────────────────────────────────
GFX._bladeGeo = function() {
  if (GFX._bladeGeometry) return GFX._bladeGeometry;
  // 3-segment tapered blade, height 1, width ~0.08 — normals face up for soft lighting
  var w = 0.045, p = [-w, 0, 0, w, 0, 0, -w * 0.7, 0.4, 0.01, w * 0.7, 0.4, 0.01, -w * 0.35, 0.75, 0.03, w * 0.35, 0.75, 0.03, 0, 1, 0.06];
  var c = [0, 0, 0, 0, 0, 0, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.78, 0.78, 0.78, 0.78, 0.78, 0.78, 1, 1, 1];
  var n = []; for (var i = 0; i < 7; i++) n.push(0, 1, 0.25);
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute("grad", new THREE.Float32BufferAttribute(c.filter(function(_, k) { return k % 3 === 0; }), 1));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  g.userData.shared = true;
  return (GFX._bladeGeometry = g);
};

GFX._grassMaterial = function(theme) {
  var key = "grass_" + theme;
  if (GFX._matCache[key]) return GFX._matCache[key];
  var P = GFX.themePreset(theme), G = P.grass || [0];
  var m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  var base = new THREE.Color(G[1] || 0x3a7a1f), tip = new THREE.Color(G[2] || 0x9fdc5a);
  m.onBeforeCompile = function(sh) {
    sh.uniforms.uTime = GFX.time;
    sh.uniforms.uWind = GFX.windUniform;
    sh.uniforms.uBase = { value: base }; sh.uniforms.uTip = { value: tip };
    sh.vertexShader = "uniform float uTime; uniform vec2 uWind; attribute float grad; varying float vGrad;\n" + sh.vertexShader.replace(
      "#include <project_vertex>",
      [
        "vec4 mvPosition = vec4( transformed, 1.0 );",
        "#ifdef USE_INSTANCING",
        "  mvPosition = instanceMatrix * mvPosition;",
        "  vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);",
        "#else",
        "  vec2 ip = vec2(0.0);",
        "#endif",
        "vec4 wpos = modelMatrix * vec4(ip.x, 0.0, ip.y, 1.0);",
        "float hh = grad * grad;",
        "float wave = sin(uTime*1.9 - dot(wpos.xz, normalize(uWind + vec2(0.001)))*0.35) * 0.5 + 0.5;",
        "float flutter = sin(uTime*5.3 + wpos.x*1.7 + wpos.z*1.3) * 0.08;",
        "vec2 bend = uWind * (0.25 + 0.75*wave) + vec2(flutter, flutter*0.7);",
        "mvPosition.xz += bend * hh;",
        "mvPosition.y -= length(bend) * hh * 0.25;",
        "vGrad = grad;",
        "mvPosition = modelViewMatrix * mvPosition;",
        "gl_Position = projectionMatrix * mvPosition;",
      ].join("\n"));
    sh.fragmentShader = "uniform vec3 uBase; uniform vec3 uTip; varying float vGrad;\n" + sh.fragmentShader.replace(
      "vec4 diffuseColor = vec4( diffuse, opacity );",
      "vec4 diffuseColor = vec4( mix(uBase, uTip, vGrad) * diffuse, opacity );");
  };
  m.userData.shared = true;
  return (GFX._matCache[key] = m);
};

GFX.buildGrassField = function(o, P, rnd) {
  var G = P.grass || [0];
  var dens = (G[0] || 0) * (GFX.settings ? GFX.settings.grass : 1);
  if (dens <= 0.01) return null;
  var area = Math.PI * o.r * o.r;
  var count = Math.min(9000, Math.floor(area * 20 * dens));
  if (count < 10) return null;
  var mesh = new THREE.InstancedMesh(GFX._bladeGeo(), GFX._grassMaterial(o.theme), count);
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  var colr = new THREE.Color();
  var avoid = o.avoid || [];
  var k = 0;
  for (var i = 0; i < count * 1.4 && k < count; i++) {
    var a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (o.r - 0.15);
    var x = Math.cos(a) * d, z = Math.sin(a) * d;
    // clumping: thin grass in noisy patches
    var wx = o.x + x, wz = o.z + z;
    var cl = _gfxFbm2(wx * 0.18, wz * 0.18, 3);
    if (rnd() > 0.25 + cl * 1.1) continue;
    var blocked = false;
    for (var ai = 0; ai < avoid.length; ai++) if (Math.hypot(wx - avoid[ai].x, wz - avoid[ai].z) < avoid[ai].r) { blocked = true; break; }
    if (blocked) continue;
    var basketGreen = o.type === "basket" && d < o.r * 0.55;
    var h = (basketGreen ? 0.08 : 0.16) + rnd() * (basketGreen ? 0.06 : 0.22) * (0.6 + cl * 0.8);
    q.setFromAxisAngle(up, rnd() * Math.PI * 2);
    sc.set(0.8 + rnd() * 0.6, h, 1);
    p.set(x, 0.0, z);
    m4.compose(p, q, sc);
    mesh.setMatrixAt(k, m4);
    var v = 0.8 + rnd() * 0.4;
    colr.setRGB(v, v * (0.95 + rnd() * 0.1), v * 0.9);
    mesh.setColorAt(k, colr);
    k++;
  }
  mesh.count = k;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.position.set(o.x, o.surfY + 0.005, o.z);
  mesh.receiveShadow = true; mesh.castShadow = false;
  mesh.frustumCulled = false; // instances spread beyond the blade's bounding sphere
  mesh.userData.noBatch = true;
  return mesh;
};

GFX.buildFlowers = function(o, P, rnd) {
  if (!P.flowers || !(GFX.settings && GFX.settings.flowers) || o.type === "basket") return null;
  var n = Math.floor(o.r * o.r * 0.9);
  if (!GFX._flowerGeo) {
    var head = new THREE.IcosahedronGeometry(0.07, 0); head.translate(0, 0.22, 0);
    var stem = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 3); stem.translate(0, 0.11, 0);
    GFX._flowerGeo = GFX.mergeGeometries([head, stem]); GFX._flowerGeo.userData.shared = true;
  }
  var mat = GFX._matCache.flower || (GFX._matCache.flower = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
  mat.userData.shared = true;
  var mesh = new THREE.InstancedMesh(GFX._flowerGeo, mat, n);
  var m4 = new THREE.Matrix4(), c = new THREE.Color(), k = 0;
  for (var i = 0; i < n * 2 && k < n; i++) {
    var a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (o.r - 0.4);
    var x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (_gfxFbm2((o.x + x) * 0.25 + 11, (o.z + z) * 0.25, 2) < 0.52) continue;
    var s = 0.7 + rnd() * 0.7;
    m4.makeRotationY(rnd() * 6.28).scale(new THREE.Vector3(s, s, s)).setPosition(x, 0, z);
    mesh.setMatrixAt(k, m4);
    c.set(P.flowers[Math.floor(rnd() * P.flowers.length)]); mesh.setColorAt(k, c); k++;
  }
  if (k === 0) return null;
  mesh.count = k; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.position.set(o.x, o.surfY, o.z); mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.userData.noBatch = true;
  return mesh;
};

GFX.buildPebbles = function(o, P, rnd) {
  var st = P.surf.style;
  if (!(st === "sand" || st === "dirt" || st === "regolith" || st === "rock" || st === "snow" || st === "grass")) return null;
  var n = Math.floor(o.r * (st === "grass" ? 1.2 : 3));
  if (!GFX._pebbleGeo) { GFX._pebbleGeo = new THREE.DodecahedronGeometry(0.12, 0); GFX._pebbleGeo.userData.shared = true; }
  var mat = GFX._matCache["peb_" + o.theme];
  if (!mat) { mat = GFX._matCache["peb_" + o.theme] = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.surf.rock2).lerp(new THREE.Color(0x888888), 0.3), roughness: 0.9, flatShading: true }); mat.userData.shared = true; }
  var mesh = new THREE.InstancedMesh(GFX._pebbleGeo, mat, n);
  var m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (var i = 0; i < n; i++) {
    var a = rnd() * 6.28, d = o.r * (0.55 + rnd() * 0.42);
    var k = 0.4 + rnd() * 1.6;
    p.set(Math.cos(a) * d, 0.02, Math.sin(a) * d); e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e); s.set(k, k * 0.6, k);
    m4.compose(p, q, s); mesh.setMatrixAt(i, m4);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.position.set(o.x, o.surfY, o.z); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.userData.noBatch = true;
  return mesh;
};

// ── Distant horizon ridges (replaces the old ring of grey boxes) ──────────────
GFX.buildHorizon = function(hole) {
  var P = GFX.themePreset(hole.theme), st = P.surf.style;
  var g = new THREE.Group();
  if (P.water && (P.water.kind === "void")) return g;
  var indoor = hole.theme === "backrooms" || hole.theme === "poolrooms" || hole.theme === "office";
  if (indoor) return g;
  var layers = [{ R: 330, h: 55, col: 0.55 }, { R: 470, h: 95, col: 0.75 }];
  layers.forEach(function(L, li) {
    var segs = 160, pos = [], idx = [];
    var base = hole.water - 6;
    for (var i = 0; i <= segs; i++) {
      var a = i / segs * Math.PI * 2;
      var n = _gfxFbm2(Math.cos(a) * 4 + li * 9 + (hole.noiseOx || 0), Math.sin(a) * 4 + (hole.noiseOz || 0), 5);
      var hgt = (st === "neon" || hole.theme === "city") ? (n > 0.5 ? L.h * (0.3 + (Math.floor(n * 12) % 5) * 0.12) : L.h * 0.15) : L.h * Math.pow(n, 1.6) * 1.6;
      var x = Math.cos(a) * L.R, z = Math.sin(a) * L.R;
      pos.push(x, base, z, x, hole.water + hgt, z);
    }
    for (var j = 0; j < segs; j++) { var A = j * 2; idx.push(A, A + 2, A + 1, A + 1, A + 2, A + 3); }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    var c = new THREE.Color(P.surf.rock1).lerp(new THREE.Color(P.hor), L.col);
    var mat = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, fog: true });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.userData.noBatch = true;
    g.add(mesh);
  });
  return g;
};

// ══════════════════════════════════════════════════════════════════════════════
// ── 5. POST-PROCESSING ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
GFX.GradeShader = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.32 }, saturation: { value: 1.08 }, contrast: { value: 1.04 }, time: { value: 0 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: [
    "uniform sampler2D tDiffuse; uniform float vignette; uniform float saturation; uniform float contrast; uniform float time; varying vec2 vUv;",
    "void main(){",
    "  vec4 c = texture2D(tDiffuse, vUv);",
    "  vec3 col = c.rgb;",
    "  float l = dot(col, vec3(0.2126,0.7152,0.0722));",
    "  col = mix(vec3(l), col, saturation);",
    "  col = (col - 0.18) * contrast + 0.18;",
    "  col = max(col, 0.0);",
    "  vec2 d = vUv - 0.5; float v = 1.0 - dot(d,d) * vignette * 2.2;",
    "  col *= clamp(v, 0.0, 1.0);",
    "  gl_FragColor = vec4(col, 1.0);",
    "  #include <encodings_fragment>",
    "  float n = fract(sin(dot(vUv*vec2(1920.0,1080.0) + time, vec2(12.9898,78.233))) * 43758.5453);",
    "  gl_FragColor.rgb += (n - 0.5) / 255.0;",  // dither against banding
    "}"
  ].join("\n"),
};

GFX._setupPost = function() {
  if (GFX.composer) { try { GFX.composer.renderTarget1.dispose(); GFX.composer.renderTarget2.dispose(); } catch (e) {} }
  GFX.composer = null; GFX.bloomPass = null; GFX.gradePass = null;
  GFX._updateFogColor();
  if (!GFX.settings.post) return;
  var r = GFX.renderer;
  if (!r.capabilities.isWebGL2) return;
  if (!THREE.EffectComposer || !THREE.RenderPass || !THREE.ShaderPass || !THREE.UnrealBloomPass) {
    // Scripts may still be loading — retry shortly
    if (!GFX._postRetry) GFX._postRetry = 0;
    if (GFX._postRetry++ < 40) setTimeout(GFX._setupPost, 250);
    return;
  }
  try {
    var pr = r.getPixelRatio();
    var w = Math.floor(window.innerWidth * pr), h = Math.floor(window.innerHeight * pr);
    var rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType };
    // MSAA only where it shows: on high-DPI screens the extra pixels already smooth edges, and 4× MSAA at 2× DPR is a GPU hog
    var msaa = pr < 1.6 && THREE.WebGLMultisampleRenderTarget;
    var rt = msaa ? new THREE.WebGLMultisampleRenderTarget(w, h, rtOpts) : new THREE.WebGLRenderTarget(w, h, rtOpts);
    if (msaa && rt.samples !== undefined) rt.samples = 4;
    var comp = new THREE.EffectComposer(r, rt);
    comp.addPass(new THREE.RenderPass(GFX.scene, GFX.camera));
    var P = GFX.themePreset(GFX.theme);
    var bloom = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), P.bloom || 0.3, 0.55, 0.82);
    comp.addPass(bloom);
    var grade = new THREE.ShaderPass(GFX.GradeShader);
    grade.material.toneMapped = false;
    comp.addPass(grade);
    GFX.composer = comp; GFX.bloomPass = bloom; GFX.gradePass = grade;
    comp.setSize(window.innerWidth, window.innerHeight);
  } catch (e) {
    console.warn("DiskGolfi: post-processing disabled:", e);
    GFX.composer = null;
  }
  GFX._updateFogColor();
};

// ══════════════════════════════════════════════════════════════════════════════
// ── FRAME UPDATE / RENDER ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
GFX.update = function(dt, focus) {
  if (!GFX.ready) return;
  GFX.time.value += dt;
  var cam = GFX.camera;
  GFX.sky.position.copy(cam.position);
  if (GFX._envDirty) GFX._regenEnv();

  // Sun + shadow frustum follow the action (texel-snapped to avoid shimmering)
  if (focus) GFX._focus.lerp(focus, Math.min(1, dt * 4));
  var R = GFX.settings.shadowRange, snap = (2 * R) / GFX.settings.shadowMap;
  var fx = Math.round(GFX._focus.x / snap) * snap, fz = Math.round(GFX._focus.z / snap) * snap;
  var sd = GFX.sunDir || new THREE.Vector3(0.4, 0.8, 0.3);
  GFX.sun.position.set(fx + sd.x * 120, GFX._focus.y + sd.y * 120, fz + sd.z * 120);
  GFX.sun.target.position.set(fx, GFX._focus.y, fz);

  // Wind for grass
  var w = (typeof HOLES !== "undefined" && HOLES[holeIdx]) ? HOLES[holeIdx].wind : { x: 0.3, z: 0.1 };
  var ws = 0.05 * (GFX.windGrass || 1);
  GFX.windUniform.value.set(0.06 + w.x * ws, 0.03 + w.z * ws);

  // Lightning
  if (GFX.weather === "stormy" && GFX.theme !== "moon") {
    if (GFX._lightning <= 0 && Math.random() < dt * 0.12) { GFX._lightning = 0.45; GFX._thunderAt = 0.35 + Math.random() * 1.2; }
  }
  if (GFX._lightning > 0) {
    GFX._lightning -= dt;
    var f = GFX._lightning > 0.3 ? 1 : GFX._lightning > 0.22 ? 0.2 : GFX._lightning > 0.12 ? 0.8 : Math.max(0, GFX._lightning / 0.12) * 0.4;
    GFX.skyUniforms.flash.value = f * 0.8;
    GFX.hemi.intensity = GFX.hemiBase + f * 1.6;
  } else { GFX.skyUniforms.flash.value = 0; GFX.hemi.intensity = GFX.hemiBase; }
  if (GFX._thunderAt !== undefined) {
    GFX._thunderAt -= dt;
    if (GFX._thunderAt <= 0) { GFX._thunderAt = undefined; GFX._thunder(); }
  }

  GFX._updatePrecip(dt);
  GFX._updateWaterUniforms();
  if (GFX.gradePass) GFX.gradePass.uniforms.time.value = GFX.time.value % 100;
  GFX._autoTune(dt);
};

GFX._thunder = function() {
  var ctx = (typeof AudioEngine !== "undefined") ? AudioEngine.ctx : null;
  if (!ctx || ctx.state !== "running") return;
  var now = ctx.currentTime, len = 2.4;
  var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = buf.getChannelData(0);
  var last = 0;
  for (var i = 0; i < d.length; i++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.15; d[i] = last * Math.exp(-i / (ctx.sampleRate * 0.7)) * (1 + 0.6 * Math.sin(i / 2200)); }
  var src = ctx.createBufferSource(); src.buffer = buf;
  var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220;
  var g = ctx.createGain(); g.gain.setValueAtTime(0.0, now); g.gain.linearRampToValueAtTime(0.9, now + 0.08); g.gain.exponentialRampToValueAtTime(0.001, now + len);
  src.connect(lp).connect(g).connect(AudioEngine.G ? AudioEngine.G.sfx : ctx.destination); src.start(now);
};

// Adaptive quality ("auto"): keep the game near 60 fps on any laptop.
// Measured on a Retina MacBook: render resolution is by far the biggest GPU cost (DPR 2 ≈ 3× DPR 1);
// shadows are nearly free, and dropping the post chain is *slower* (the canvas falls back to native MSAA).
// So: scale resolution first (down to half), then shrink the shadow map. Climb back when there's headroom.
GFX._tier = 0;
GFX._autoTune = function(dt) {
  if (GFX.qualityPref !== "auto" && GFX.qualityPref) return;
  GFX._fpsAcc += dt; GFX._fpsFrames++;
  if (GFX._fpsAcc < 2.0) return;
  var fps = GFX._fpsFrames / GFX._fpsAcc;
  window._fpsAvg = Math.round(fps);
  GFX._fpsAcc = 0; GFX._fpsFrames = 0;
  if (document.hidden) return;
  if (fps < 45) {
    GFX._good = 0;
    if (GFX._dynScale > 0.5) { GFX._dynScale = Math.max(0.5, GFX._dynScale - (fps < 30 ? 0.2 : 0.1)); GFX._applyPixelRatio(); }
    else if (GFX._tier < 1) GFX._setTier(1);
  } else if (fps > 57) {
    if (++GFX._good < 3) return;   // only climb after ~6 s of headroom
    GFX._good = 0;
    if (GFX._tier > 0) GFX._setTier(0);
    else if (GFX._dynScale < 1) { GFX._dynScale = Math.min(1, GFX._dynScale + 0.05); GFX._applyPixelRatio(); }
  } else GFX._good = 0;
};
GFX._setTier = function(t) {
  GFX._tier = t;
  var want = t >= 1 ? Math.max(512, GFX.settings.shadowMap / 2) : GFX.settings.shadowMap;
  if (GFX.sun && GFX.sun.shadow.mapSize.x !== want) {
    GFX.sun.shadow.mapSize.set(want, want);
    if (GFX.sun.shadow.map) { GFX.sun.shadow.map.dispose(); GFX.sun.shadow.map = null; }
  }
  console.log("DiskGolfi: adaptive quality tier " + t + " (scale " + GFX._dynScale.toFixed(2) + ")");
};

GFX.render = function() {
  if (GFX.composer) GFX.composer.render();
  else GFX.renderer.render(GFX.scene, GFX.camera);
};
