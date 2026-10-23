"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── WORLD — high-fidelity surroundings ───────────────────────────────────────
// • Terrain shader: triplanar detail, slope / height splatting (grass, rock,
//   snow, sand), macro colour variation, rock strata, farmland patchwork.
// • Vista: a landscape that continues seamlessly from the playable terrain out
//   to the fog line (mountains, farmland, mesas, craters, voxel hills, distant
//   islands) — no more slabs, cut-off seas or flat lime discs.
// • Set dressing: instanced forests, farmhouses / barns / silos / windmills,
//   a procedural city skyline with lit windows, a castle on the ridge.
// • The ocean follows the camera, so the sea really reaches the horizon.
// ══════════════════════════════════════════════════════════════════════════════
var WORLD = { anim: [], waterMesh: null };

// ── Palettes ─────────────────────────────────────────────────────────────────
// g1/g2 two ground tones · rock · snow · sand · snowY (height above water where snow starts)
// strata (rock banding) · fields (farmland patchwork) · rockLo (slope where rock begins)
WORLD.PAL = {
  mountains:   { g1: 0x3e6a26, g2: 0x5e8a34, rock: 0x6e6a64, snow: 0xf2f6fb, sand: 0xc8b890, snowY: 70, strata: 0.15, rockLo: 0.3 },
  winter:      { g1: 0xd2dceb, g2: 0xe6edf6, rock: 0x6a7480, snow: 0xf2f6fb, sand: 0xc8d0dc, snowY: -40, rockLo: 0.42 },
  grandcanyon: { g1: 0xc87a44, g2: 0xdc9a5e, rock: 0xa8542e, snow: 0xffffff, sand: 0xe6c08a, snowY: 999, strata: 1.0, rockLo: 0.22 },
  waterfall:   { g1: 0x356e2a, g2: 0x568c38, rock: 0x5a6058, snow: 0xffffff, sand: 0xc8b890, snowY: 999, strata: 0.2, rockLo: 0.36 },
  village:     { g1: 0x4a8228, g2: 0x6e9a36, rock: 0x7a7062, snow: 0xffffff, sand: 0xd8c890, snowY: 999, fields: 1, rockLo: 0.45 },
  vetschool:   { g1: 0x468a3a, g2: 0x6aa044, rock: 0x7a7a6a, snow: 0xffffff, sand: 0xd8c890, snowY: 999, fields: 0.7, rockLo: 0.45 },
  cabbage:     { g1: 0x5a8a34, g2: 0x7a9a3a, rock: 0x6a5a40, snow: 0xffffff, sand: 0xc8a870, snowY: 999, fields: 1, rockLo: 0.45 },
  feet_bunnies:{ g1: 0x5aa83e, g2: 0x7ec055, rock: 0xb0909a, snow: 0xffffff, sand: 0xf0d8c0, snowY: 999, rockLo: 0.45 },
  socks_basket:{ g1: 0x62ac48, g2: 0x88c462, rock: 0xc8a0b0, snow: 0xffffff, sand: 0xf4dcd0, snowY: 999, fields: 0.5, rockLo: 0.45 },
  moon:        { g1: 0x8a8a8c, g2: 0x747478, rock: 0x55555a, snow: 0x8a8a8c, sand: 0x8a8a8c, snowY: 999, rockLo: 0.4 },
  minecraft:   { g1: 0x4a8a2a, g2: 0x5a9a32, rock: 0x7a5a3a, snow: 0xf4f4f4, sand: 0xe0d098, snowY: 22, rockLo: 0.5 },
  funny:       { g1: 0x3f8a2e, g2: 0x6aa83a, rock: 0x7a7266, snow: 0xffffff, sand: 0xe8d4a0, snowY: 999, rockLo: 0.42 },
  minion:      { g1: 0x3f8a2e, g2: 0x6aa83a, rock: 0x7a7266, snow: 0xffffff, sand: 0xe8d4a0, snowY: 999, rockLo: 0.42 },
  emote:       { g1: 0x4a8a30, g2: 0x7aa840, rock: 0x8a7a66, snow: 0xffffff, sand: 0xecd8a8, snowY: 999, rockLo: 0.42 },
  public_poo:  { g1: 0x4a6a24, g2: 0x6a7a30, rock: 0x5a4a38, snow: 0xffffff, sand: 0xa88a5a, snowY: 999, rockLo: 0.42 },
  terrifying:  { g1: 0x2a2220, g2: 0x3a2a24, rock: 0x1c1616, snow: 0x3a2a24, sand: 0x2a1c18, snowY: 999, rockLo: 0.35, strata: 0.2 },
  screaming_mamamia: { g1: 0x2a2220, g2: 0x3a2a24, rock: 0x1c1616, snow: 0x3a2a24, sand: 0x2a1c18, snowY: 999, rockLo: 0.35, strata: 0.2 },
  eerie:       { g1: 0x2a3a2a, g2: 0x3a4630, rock: 0x3a3840, snow: 0xffffff, sand: 0x5a5448, snowY: 999, rockLo: 0.38 },
  tornado:     { g1: 0x3a4a34, g2: 0x4a5a3a, rock: 0x4a4a4a, snow: 0xffffff, sand: 0x6a6450, snowY: 999, rockLo: 0.38 },
  hogwarts:    { g1: 0x34522e, g2: 0x4a6a3a, rock: 0x5a5650, snow: 0xdfe6f0, snowY: 60, strata: 0.3, rockLo: 0.32 },
  jungle:      { g1: 0x1e5a16, g2: 0x3a7a22, rock: 0x5a4a3a, snow: 0xffffff, sand: 0xb89a60, snowY: 999, strata: 0.3, rockLo: 0.36 },
};
WORLD.pal = function(theme) {
  if (WORLD.PAL[theme]) return WORLD.PAL[theme];
  var P = GFX.themePreset(theme), s = P.surf || {};
  return { g1: s.top || 0x5a8a3a, g2: new THREE.Color(s.top || 0x5a8a3a).lerp(new THREE.Color(0xffffff), 0.15).getHex(), rock: s.rock1 || 0x6a6a6a, snow: 0xf2f6fb, sand: 0xd8c890, snowY: 999, rockLo: 0.38, strata: 0.2 };
};

// ── Terrain material (MeshStandardMaterial + injected splatting) ─────────────
WORLD._mats = {};
WORLD.terrainMaterial = function(theme, waterY, opts) {
  opts = opts || {};
  var key = theme + "_" + waterY + (opts.flat ? "_f" : "");
  var play = opts.play;
  if (WORLD._mats[key]) { if (play) WORLD._mats[key].userData.U.uPlay.value.set(play.minX, play.minZ, play.maxX, play.maxZ); return WORLD._mats[key]; }
  var pal = WORLD.pal(theme);
  var T = function(st) { var t = GFX.surfaceTexture(st, null).map; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  var m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, flatShading: !!opts.flat });
  var U = {
    tGrass: { value: T(theme === "moon" ? "regolith" : theme === "winter" ? "snow" : "grass") }, tRock: { value: T("rock") }, tSnow: { value: T("snow") }, tSand: { value: T("sand") },
    cG1: { value: new THREE.Color(pal.g1) }, cG2: { value: new THREE.Color(pal.g2) }, cRock: { value: new THREE.Color(pal.rock) }, cSnow: { value: new THREE.Color(pal.snow) }, cSand: { value: new THREE.Color(pal.sand) },
    uPlay: { value: play ? new THREE.Vector4(play.minX, play.minZ, play.maxX, play.maxZ) : new THREE.Vector4(1e5, 1e5, -1e5, -1e5) },
    snowY: { value: waterY + (pal.snowY === undefined ? 999 : pal.snowY) }, sandY: { value: waterY }, strata: { value: pal.strata || 0 }, fields: { value: pal.fields || 0 }, rockLo: { value: pal.rockLo || 0.35 },
  };
  m.onBeforeCompile = function(sh) {
    Object.keys(U).forEach(function(k) { sh.uniforms[k] = U[k]; });
    sh.vertexShader = "varying vec3 vWPos; varying vec3 vWNrm;\n" + sh.vertexShader.replace("#include <worldpos_vertex>",
      "#include <worldpos_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNrm = normalize(mat3(modelMatrix) * objectNormal);");
    sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_maps>", [
      "#include <normal_fragment_maps>",
      // detail relief: tilt the shading normal by the gradient of world-space noise (cheap 'normal map' with no tiling)
      "#ifndef FLAT_SHADED",
      "  { vec2 q = vWPos.xz;",
      "    float dA0 = wFbm(q * 0.13), dAx = wFbm((q + vec2(0.6, 0.0)) * 0.13), dAz = wFbm((q + vec2(0.0, 0.6)) * 0.13);",
      "    float dB0 = wNoise(q * 0.9), dBx = wNoise((q + vec2(0.18, 0.0)) * 0.9), dBz = wNoise((q + vec2(0.0, 0.18)) * 0.9);",
      "    vec3 gw = vec3(dAx - dA0, 0.0, dAz - dA0) * 2.2 + vec3(dBx - dB0, 0.0, dBz - dB0) * 0.9;",
      "    float fadeN = 1.0 - smoothstep(80.0, 400.0, length(vWPos - cameraPosition));",
      "    normal = normalize(normal - (viewMatrix * vec4(gw, 0.0)).xyz * (0.35 + 0.65 * fadeN)); }",
      "#endif",
    ].join("\n"));
    sh.fragmentShader = [
      "varying vec3 vWPos; varying vec3 vWNrm;",
      "uniform sampler2D tGrass; uniform sampler2D tRock; uniform sampler2D tSnow; uniform sampler2D tSand;",
      "uniform vec3 cG1; uniform vec3 cG2; uniform vec3 cRock; uniform vec3 cSnow; uniform vec3 cSand;",
      "uniform vec4 uPlay; uniform float snowY; uniform float sandY; uniform float strata; uniform float fields; uniform float rockLo;",
      "float wHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
      "float wNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
      "  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y); }",
      "float wFbm(vec2 p){ return wNoise(p) * 0.55 + wNoise(p * 2.13 + 7.1) * 0.3 + wNoise(p * 4.37 + 3.3) * 0.15; }",
      "float tri(sampler2D t, vec3 p, vec3 w, float s){ return texture2D(t, p.zy * s).r * w.x + texture2D(t, p.xz * s).r * w.y + texture2D(t, p.xy * s).r * w.z; }",
    ].join("\n") + "\n" + sh.fragmentShader.replace("#include <map_fragment>", [
      "  vec3 tn = normalize(vWNrm);",
      "  vec3 bw = pow(abs(tn), vec3(4.0)); bw /= (bw.x + bw.y + bw.z + 1e-4);",
      "  float camD = length(vWPos - cameraPosition);",
      "  float near = 1.0 - smoothstep(60.0, 260.0, camD);             // fine detail fades with distance (no tiling)",
      "  float dG = mix(1.0, tri(tGrass, vWPos, bw, 0.22) * 0.9 + tri(tGrass, vWPos, bw, 0.041) * 0.35, 0.35 + 0.65 * near);",
      "  float dR = tri(tRock, vWPos, bw, 0.11) * 0.7 + tri(tRock, vWPos, bw, 0.023) * 0.5;",
      "  float dS = tri(tSnow, vWPos, bw, 0.15);",
      "  float macro = wFbm(vWPos.xz * 0.011), micro = wFbm(vWPos.xz * 0.07);",
      "  float slope = 1.0 - tn.y;",
      "  vec3 ground = mix(cG1, cG2, smoothstep(0.25, 0.75, macro)) * (0.86 + 0.28 * micro);",
      // farmland patchwork: fields in a rotated grid, each with its own crop colour and furrows
      "  if (fields > 0.0) {",
      "    vec2 fp = mat2(0.86, -0.5, 0.5, 0.86) * vWPos.xz; vec2 cell = floor(fp / vec2(64.0, 40.0));",
      "    float id = wHash(cell);",
      "    vec3 crop = id < 0.22 ? vec3(0.50, 0.36, 0.08) : id < 0.38 ? vec3(0.20, 0.12, 0.06) : id < 0.52 ? vec3(0.36, 0.40, 0.08) : id < 0.75 ? cG1 * 0.75 : cG2 * 0.85;",
      "    crop *= 0.9 + 0.12 * step(0.5, fract(fp.x * 0.5));            // furrows",
      "    vec2 fe = abs(fract(fp / vec2(64.0, 40.0)) - 0.5);",
      "    float hedge = smoothstep(0.47, 0.5, max(fe.x, fe.y));",
      "    vec2 dq = max(uPlay.xy - vWPos.xz, vWPos.xz - uPlay.zw); float outD = length(max(dq, 0.0));",
      "    float farm = fields * (1.0 - smoothstep(0.05, 0.18, slope)) * (1.0 - smoothstep(0.45, 0.62, macro)) * smoothstep(8.0, 50.0, outD);",
      "    ground = mix(ground, mix(crop, cG1 * 0.55, hedge), farm);",
      "  }",
      "  vec3 col = ground * (0.62 + 0.34 * dG);",
      "  float wSand = 1.0 - smoothstep(sandY + 0.25, sandY + 1.4, vWPos.y);",
      "  col = mix(col, cSand * (0.85 + 0.25 * dG), wSand);",
      "  float wRock = smoothstep(rockLo, rockLo + 0.22, slope + (micro - 0.5) * 0.12);",
      "  float sb = sin(vWPos.y * 0.95 + macro * 5.0) * 0.6 + sin(vWPos.y * 2.7 + 1.3) * 0.3 + sin(vWPos.y * 6.1) * 0.1;",
      "  vec3 rockTint = mix(cRock, mix(cRock * 0.7, cSand * 1.05, 0.5 + 0.5 * sb), strata);   // sedimentary bands",
      "  vec3 rock = rockTint * mix(0.62 + 0.55 * dR, 0.85 + 0.2 * dR, strata) * (1.0 + strata * 0.1 * sin(vWPos.y * 9.0));",
      "  col = mix(col, rock, wRock);",
      "  float wSnow = smoothstep(snowY, snowY + 9.0, vWPos.y + (macro - 0.5) * 18.0) * (1.0 - smoothstep(0.3, 0.62, slope));",
      "  col = mix(col, cSnow * (0.9 + 0.12 * dS), wSnow);",
      "  col *= 0.78 + 0.22 * (1.0 - smoothstep(0.35, 0.85, slope));            // steep faces read darker (cheap occlusion)",
      "  diffuseColor.rgb *= col;",
    ].join("\n")).replace("#include <fog_fragment>", [
      "#include <fog_fragment>",
      "#ifdef USE_FOG",
      "  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(650.0, 960.0, length(vWPos - cameraPosition)));   // always gone before the far clip",
      "#endif",
    ].join("\n"));
  };
  m.customProgramCacheKey = function() { return "dgTerrain"; };
  m.userData.noUpgrade = true; m.userData.shared = true; m.userData.U = U;
  return (WORLD._mats[key] = m);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── VISTA: what each world looks like out to the horizon ─────────────────────
// ══════════════════════════════════════════════════════════════════════════════
WORLD.KIND = function(h) {
  if (h.arch === "city") return "city";
  if (h.arch === "islands") return "islands";
  if (h.arch === "castle") return "castle";
  if (h.arch === "moon") return "moon";
  if (h.arch === "highlands") return "highlands";
  if (h.theme === "minecraft") return "voxel";
  return null;
};

WORLD.build = function(h, idx, C) {
  WORLD.anim = []; WORLD.waterMesh = C.waterMesh || null;
  var kind = WORLD.KIND(h); if (!kind) return null;
  var g = new THREE.Group(); g.name = "vista";
  var rnd = _gfxRng((h.n || 1) * 7717 + 31);
  var b = C.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  var ctx = { h: h, C: C, g: g, rnd: rnd, cx: cx, cz: cz, W: C.hazard.level, kind: kind, pal: WORLD.pal(h.theme) };
  if (kind === "city") { WORLD.city(ctx); C.outer = function() { return C.floor !== null ? C.floor : 0; }; }
  else {
    ctx.H = WORLD.heightFn(ctx); C.outer = ctx.H;
    WORLD.terrain(ctx);
    WORLD.forest(ctx);
    if (kind === "highlands" && /village|vetschool|cabbage|feet_bunnies|socks_basket/.test(h.theme)) WORLD.farms(ctx);
    if (kind === "castle") WORLD.castleSilhouette(ctx);
    if (h.theme === "funny") WORLD.balloons(ctx);
    WORLD.landmarks(ctx);
  }
  g.traverse(function(o) { if (o.isMesh && !o.userData.keepShadow) { o.castShadow = false; } });
  return g;
};

// Height of the surrounding land at (x, z). For worlds with a playable heightfield the
// vista starts exactly at its edge and blends out into the theme's landscape.
WORLD.heightFn = function(ctx) {
  var C = ctx.C, W = ctx.W, th = ctx.h.theme, kind = ctx.kind, hf = C.hf, o1 = ctx.rnd() * 100, o2 = ctx.rnd() * 100;
  var fbm = function(x, z, oct) { return _gfxFbm2(x, z, oct || 5); };
  var ridged = function(x, z) { var n = 0, a = 0.5, f = 1; for (var i = 0; i < 5; i++) { var v = 1 - Math.abs(_gfxNoise2(x * f, z * f) * 2 - 1); n += v * v * a; a *= 0.5; f *= 2.03; } return n; };
  var craters = [];
  if (kind === "moon") for (var k = 0; k < 140; k++) craters.push({ x: ctx.cx + (ctx.rnd() - 0.5) * 1800, z: ctx.cz + (ctx.rnd() - 0.5) * 1800, r: 8 + Math.pow(ctx.rnd(), 2) * 70 });
  var target;
  switch (kind) {
    case "highlands":
      if (/mountains|winter/.test(th)) target = function(x, z, d) { return W + 6 + ridged(x / 260 + o1, z / 260 + o2) * (25 + 135 * _sstep(60, 520, d || 999)) + fbm(x / 90, z / 90) * 16; };
      else if (th === "grandcanyon") target = function(x, z) {   // mesas: flat tops, sheer banded sides
        var n = fbm(x / 210 + o1, z / 210 + o2), mesa = _sstep(0.48, 0.53, n) * 55 + _sstep(0.62, 0.66, n) * 35;
        return W + 4 + mesa + fbm(x / 40, z / 40) * 4; };
      else if (th === "waterfall") target = function(x, z, d) { return W + 8 + Math.pow(fbm(x / 180 + o1, z / 180 + o2), 1.6) * (30 + 80 * _sstep(60, 450, d || 999)) + fbm(x / 50, z / 50) * 8; };
      else target = function(x, z) { return W + 3 + fbm(x / 260 + o1, z / 260 + o2) * 36 + fbm(x / 70, z / 70) * 5; };   // farmland
      break;
    case "moon": target = function(x, z) {
        var hh = fbm(x / 160 + o1, z / 160 + o2) * 30 - 10;
        for (var q = 0; q < craters.length; q++) { var c = craters[q], d = Math.hypot(x - c.x, z - c.z) / c.r; if (d < 1.6) hh += (d < 1 ? -(1 - d * d) * c.r * 0.3 : 0) + Math.exp(-Math.pow((d - 1) * 3.2, 2)) * c.r * 0.12; }
        return hh; };
      break;
    case "voxel": target = function(x, z) { return W - 4 + Math.pow(fbm(x / 90 + o1, z / 90 + o2), 1.4) * 52 + fbm(x / 24, z / 24) * 4; };
      break;
    case "islands": {
      // open sea with distant islands; volcanic peaks for the lava worlds, low dark rocks for the spooky ones
      var volc = /terrifying|screaming/.test(th), spooky = /eerie|tornado/.test(th);
      target = function(x, z) {
        var n = fbm(x / 230 + o1, z / 230 + o2, 4), thr = spooky ? 0.6 : 0.56, land = Math.max(0, Math.min(1, (n - thr) / (1 - thr) * 3));
        var peak = Math.pow(land, volc ? 2.2 : 1.6) * (volc ? 85 : spooky ? 30 : 48);
        return W - 8 + Math.min(1, land * 6) * 9 + peak + (fbm(x / 35, z / 35) - 0.5) * 6 * land;
      };
      break; }
    case "castle": target = function(x, z) { return W - 2 + ridged(x / 200 + o1, z / 200 + o2) * 80 + 10; };
      break;
  }
  // keep the course area clear (islands: open water around the course; castle: the lake; voxel: an island in the sea)
  var b = C.bounds, near0 = kind === "castle" ? 150 : kind === "voxel" ? 18 : 30, near1 = kind === "castle" ? 360 : kind === "voxel" ? 120 : 200;
  if (!hf) {
    return function(x, z) {
      var dx = Math.max(b.minX - x, 0, x - b.maxX), dz = Math.max(b.minZ - z, 0, z - b.maxZ), d = Math.hypot(dx, dz);
      var t = target(x, z), clear = _sstep(near0, near1, d);
      return W - 8 + (t - (W - 8)) * clear;
    };
  }
  // heightfield worlds: continue from the playable edge
  var hx0 = hf.x0, hz0 = hf.z0, hx1 = hf.maxX, hz1 = hf.maxZ, rivers = C.rivers || [];
  return function(x, z) {
    var qx = Math.max(hx0, Math.min(hx1, x)), qz = Math.max(hz0, Math.min(hz1, z));
    var d = Math.hypot(x - qx, z - qz);
    var edge = C.hfAt(qx, qz);
    if (edge === -Infinity || edge < W - 1) edge = W + 1;
    if (x > hx0 && x < hx1 && z > hz0 && z < hz1) return edge - 0.6;   // under the playable mesh (overlap hides seams)
    var wob = 0.7 + 0.6 * _gfxNoise2(x / 60 + 3.7, z / 60 + 1.3);
    var hh = edge + (target(x, z, d) - edge) * _sstep(0, 240, d * wob);
    for (var r = 0; r < rivers.length; r++) {                      // rivers keep flowing out to the horizon
      var R = rivers[r], aw = Math.abs((x - R.x) * R.nx + (z - R.z) * R.nz);
      var bank = R.w + 6 + Math.max(0, hh - W) * 1.6;
      if (aw < bank) { var bed = W - 1.6; hh = Math.min(hh, bed + (hh - bed) * _sstep(R.w + d * 0.04, bank, aw)); }
    }
    return hh;
  };
};

// Two grids: a 4 m one around the course and a 20 m one out to the fog line
WORLD.terrain = function(ctx) {
  var C = ctx.C, b = C.bounds, H = ctx.H, hf = C.hf;
  var mat = WORLD.terrainMaterial(ctx.h.theme, ctx.W, { flat: ctx.kind === "voxel", play: hf ? { minX: hf.x0, minZ: hf.z0, maxX: hf.maxX, maxZ: hf.maxZ } : b });
  var near = { x0: b.minX - 168, x1: b.maxX + 168, z0: b.minZ - 168, z1: b.maxZ + 168 };   // 4 m cells line up with the 1 m playable grid
  var inHole = function(x0, z0, x1, z1) {   // cell fully inside the playable heightfield (with one cell of overlap kept)
    return hf && x0 >= hf.x0 + 4 && x1 <= hf.maxX - 4 && z0 >= hf.z0 + 4 && z1 <= hf.maxZ - 4;
  };
  if (ctx.kind === "voxel") {
    near = { x0: b.minX - 120, x1: b.maxX + 120, z0: b.minZ - 120, z1: b.maxZ + 120 };
    ctx.g.add(WORLD.voxelMesh(near.x0, near.x1, near.z0, near.z1, 2, H, mat, function(x, z) { return x > b.minX - 1 && x < b.maxX + 1 && z > b.minZ - 1 && z < b.maxZ + 1; }));
  } else ctx.g.add(WORLD.gridMesh(near.x0, near.x1, near.z0, near.z1, 4, H, mat, inHole));
  var R = 1300;
  ctx.g.add(WORLD.gridMesh(ctx.cx - R, ctx.cx + R, ctx.cz - R, ctx.cz + R, 25, function(x, z) {
    // under the near grid: sink so the finer mesh covers it
    if (x > near.x0 + 20 && x < near.x1 - 20 && z > near.z0 + 20 && z < near.z1 - 20) return H(x, z) - 3;
    return H(x, z);
  }, mat, function(x0, z0, x1, z1) { return x0 >= near.x0 + 20 && x1 <= near.x1 - 20 && z0 >= near.z0 + 20 && z1 <= near.z1 - 20; }));
};
WORLD.gridMesh = function(x0, x1, z0, z1, cell, H, mat, skip) {
  var nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
  var pos = new Float32Array((nx + 1) * (nz + 1) * 3), idx = [];
  for (var j = 0; j <= nz; j++) for (var i = 0; i <= nx; i++) {
    var x = x0 + i * cell, z = z0 + j * cell, k = (j * (nx + 1) + i) * 3;
    pos[k] = x; pos[k + 1] = H(x, z); pos[k + 2] = z;
  }
  for (var b2 = 0; b2 < nz; b2++) for (var a = 0; a < nx; a++) {
    var cx0 = x0 + a * cell, cz0 = z0 + b2 * cell;
    if (skip && skip(cx0, cz0, cx0 + cell, cz0 + cell)) continue;
    var p0 = b2 * (nx + 1) + a, p1 = p0 + 1, p2 = p0 + nx + 1, p3 = p2 + 1;
    idx.push(p0, p2, p1, p1, p2, p3);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  var m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.frustumCulled = false; m.userData.noBatch = true;
  return m;
};

// Blocky terrain: flat block tops with dirt walls where neighbours step down
WORLD.voxelMesh = function(x0, x1, z0, z1, cell, H, mat, skip) {
  var nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell), hs = new Float32Array(nx * nz);
  for (var j = 0; j < nz; j++) for (var i = 0; i < nx; i++) hs[j * nx + i] = Math.round(H(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell));
  var pos = [], nor = [];
  var quad = function(a, b, c, d, n) { pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]); for (var k = 0; k < 6; k++) nor.push(n[0], n[1], n[2]); };
  for (j = 0; j < nz; j++) for (i = 0; i < nx; i++) {
    var xa = x0 + i * cell, za = z0 + j * cell, xb = xa + cell, zb = za + cell, y = hs[j * nx + i];
    if (skip(xa + cell / 2, za + cell / 2)) continue;
    quad([xa, y, za], [xa, y, zb], [xb, y, zb], [xb, y, za], [0, 1, 0]);
    // walls on all four sides where the neighbour is lower
    var nb = [[i + 1, j, [xb, za], [xb, zb], [1, 0, 0]], [i - 1, j, [xa, zb], [xa, za], [-1, 0, 0]], [i, j + 1, [xb, zb], [xa, zb], [0, 0, 1]], [i, j - 1, [xa, za], [xb, za], [0, 0, -1]]];
    for (var q = 0; q < 4; q++) {
      var N = nb[q], ny = (N[0] < 0 || N[0] >= nx || N[1] < 0 || N[1] >= nz) ? y - 6 : hs[N[1] * nx + N[0]];
      if (ny >= y) continue;
      quad([N[2][0], y, N[2][1]], [N[3][0], y, N[3][1]], [N[3][0], ny, N[3][1]], [N[2][0], ny, N[2][1]], N[4]);
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  var m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.frustumCulled = false; m.userData.noBatch = true;
  return m;
};

// ── Forests: instanced trees on gentle, dry slopes outside the course ────────
WORLD.treeGeo = {};
WORLD.treeGeometry = function(type) {
  if (WORLD.treeGeo[type]) return WORLD.treeGeo[type];
  var parts = [], col = function(geo, hex) { var c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3); for (var i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } geo.setAttribute("color", new THREE.BufferAttribute(a, 3)); return geo; };
  var add = function(geo, hex, x, y, z) { geo.translate(x || 0, y || 0, z || 0); parts.push(col(geo.toNonIndexed ? geo.toNonIndexed() : geo, hex)); };
  if (type === "pine" || type === "snowpine") {
    add(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), 0x5a3a22, 0, 1.2, 0);
    [[2.6, 4.2, 3.4], [2.0, 3.6, 5.4], [1.3, 3.0, 7.2]].forEach(function(c, i) { add(new THREE.ConeGeometry(c[0], c[1], 7), type === "snowpine" && i === 2 ? 0xe8eef6 : 0x2f5a2a, 0, c[2], 0); });
    if (type === "snowpine") add(new THREE.ConeGeometry(2.2, 0.8, 7), 0xe8eef6, 0, 4.3, 0);
  } else if (type === "broad") {
    add(new THREE.CylinderGeometry(0.3, 0.42, 3.2, 6), 0x5a3e26, 0, 1.6, 0);
    [[0, 4.6, 0, 2.4], [1.3, 4.0, 0.5, 1.7], [-1.1, 4.1, -0.6, 1.8], [0.2, 5.6, -0.3, 1.6]].forEach(function(c) { add(new THREE.IcosahedronGeometry(c[3], 0), 0x3f7a2e, c[0], c[1], c[2]); });
  } else if (type === "palm") {
    for (var s = 0; s < 6; s++) add(new THREE.CylinderGeometry(0.2, 0.26, 1.1, 5), 0x8a6a42, s * 0.12, 0.55 + s * 1.05, 0);
    for (var f = 0; f < 7; f++) { var fr = new THREE.ConeGeometry(0.5, 3.4, 4); fr.rotateZ(Math.PI / 2 + 0.5); fr.translate(1.7, 0, 0); fr.rotateY(f / 7 * Math.PI * 2); add(fr, 0x3f8a2a, 0.7, 6.4, 0); }
  } else if (type === "dead") {
    add(new THREE.CylinderGeometry(0.18, 0.32, 4.5, 5), 0x2a2420, 0, 2.25, 0);
    for (var d = 0; d < 4; d++) { var br = new THREE.CylinderGeometry(0.06, 0.12, 2.0, 4); br.rotateZ(0.9); br.translate(0.8, 0, 0); br.rotateY(d * 1.7); add(br, 0x2a2420, 0, 2.6 + d * 0.5, 0); }
  } else if (type === "cactus") {
    add(new THREE.CylinderGeometry(0.42, 0.48, 4.2, 7), 0x4a8a3a, 0, 2.1, 0);
    [-1, 1].forEach(function(sd, i) { var a = new THREE.CylinderGeometry(0.28, 0.28, 1.6, 6); a.translate(sd * 1.0, 2.2 + i * 0.6, 0); add(a, 0x4a8a3a); });
  } else if (type === "block") {
    add(new THREE.BoxGeometry(1, 5, 1), 0x6a5034, 0, 2.5, 0);
    add(new THREE.BoxGeometry(5, 2, 5), 0x3a7a2a, 0, 5.5, 0); add(new THREE.BoxGeometry(3, 1, 3), 0x3a7a2a, 0, 7, 0);
  } else if (type === "rock") {
    var r = new THREE.DodecahedronGeometry(1.4, 0); r.scale(1.3, 0.7, 1); add(r, 0xa8a8ac, 0, 0.5, 0);
  }
  var geo = GFX.mergeGeometries(parts); geo.computeVertexNormals(); geo.userData.shared = true;
  return (WORLD.treeGeo[type] = geo);
};
WORLD.forest = function(ctx) {
  var th = ctx.h.theme, kind = ctx.kind, types;
  if (kind === "moon") types = [["rock", 1]];
  else if (kind === "voxel") types = [["block", 1]];
  else if (/mountains|hogwarts/.test(th)) types = [["pine", 0.8], ["broad", 0.2]];
  else if (th === "winter") types = [["snowpine", 1]];
  else if (th === "grandcanyon") types = [["cactus", 1]];
  else if (/eerie|terrifying|screaming/.test(th)) types = [["dead", 1]];
  else if (th === "jungle") types = [["palm", 0.45], ["broad", 0.55]];
  else if (kind === "islands" && /funny|minion|emote|public_poo/.test(th)) types = [["palm", 0.75], ["broad", 0.25]];
  else types = [["broad", 0.75], ["pine", 0.25]];
  var C = ctx.C, b = C.bounds, H = ctx.H, rnd = ctx.rnd, W = ctx.W;
  var count = kind === "moon" ? 400 : th === "grandcanyon" ? 600 : 1800;
  count = Math.round(count * (GFX.settings && GFX.settings.grass !== undefined ? Math.max(0.35, GFX.settings.grass) : 1));
  var lists = types.map(function() { return []; }), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (var i = 0, tries = 0; i < count && tries < count * 6; tries++) {
    var ang = rnd() * Math.PI * 2, dist = 40 + Math.pow(rnd(), 1.6) * 700;
    var x = ctx.cx + Math.cos(ang) * (dist + Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) * 0.35), z = ctx.cz + Math.sin(ang) * (dist + Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) * 0.35);
    if (x > b.minX - 8 && x < b.maxX + 8 && z > b.minZ - 8 && z < b.maxZ + 8) continue;
    var y = H(x, z); if (y < W + 0.9) continue;
    var sl = Math.abs(H(x + 3, z) - y) + Math.abs(H(x, z + 3) - y); if (sl > (kind === "voxel" ? 2.5 : 2.2)) continue;
    if (kind !== "moon" && _gfxFbm2(x / 90, z / 90, 3) < 0.42) continue;   // clumps and clearings
    if (/mountains|winter|hogwarts/.test(th) && y > W + 95) continue;      // treeline
    var r = rnd(), ti = 0, acc = 0; for (var t = 0; t < types.length; t++) { acc += types[t][1]; if (r <= acc) { ti = t; break; } }
    var s = 0.7 + rnd() * 0.7;
    q.setFromAxisAngle(up, rnd() * 6.28);
    m4.compose(new THREE.Vector3(x, y - 0.2, z), q, new THREE.Vector3(s, s * (0.85 + rnd() * 0.35), s));
    lists[ti].push(m4.clone()); i++;
  }
  types.forEach(function(t, ti) {
    var L = lists[ti]; if (!L.length) return;
    var tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    if (t[0] !== "rock" && t[0] !== "block") GFX.addSway(tmat, t[0] === "palm" ? 0.35 : 0.22, t[0] === "palm" ? 7 : 8);
    var mesh = new THREE.InstancedMesh(WORLD.treeGeometry(t[0]), tmat, L.length);
    // the real (Quaternius) palm once it's loaded — ~3k triangles each, so only for small backdrop groves
    // (a jungle horizon of 800 palms stays low-poly; it's all fog out there anyway)
    if (t[0] === "palm" && L.length <= 160 && typeof JUNGLE !== "undefined") JUNGLE._plant(L.length % 2 ? "palm" : "palm2", function(P) { mesh.geometry = P.geo; mesh.material = P.mat; });
    var col = new THREE.Color();
    L.forEach(function(mm, k) { mesh.setMatrixAt(k, mm); var v = 0.82 + rnd() * 0.3; col.setRGB(v, v * (0.95 + rnd() * 0.1), v * 0.92); mesh.setColorAt(k, col); });
    mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.userData.noBatch = true;
    ctx.g.add(mesh);
  });
};

// ── Countryside: farmhouses, barns, silos and windmills ──────────────────────
WORLD._facadeTex = null;
WORLD.houseTex = function() {
  if (WORLD._facadeTex) return WORLD._facadeTex;
  var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d");
  g.fillStyle = "#f2ebdc"; g.fillRect(0, 0, 128, 128);
  for (var i = 0; i < 400; i++) { g.fillStyle = "rgba(0,0,0," + Math.random() * 0.05 + ")"; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  [[18, 34], [74, 34]].forEach(function(w) { g.fillStyle = "#5a3a22"; g.fillRect(w[0] - 3, w[1] - 3, 42, 36); g.fillStyle = "#8ab4d0"; g.fillRect(w[0], w[1], 36, 30); g.fillStyle = "#f2ebdc"; g.fillRect(w[0] + 17, w[1], 2, 30); g.fillRect(w[0], w[1] + 14, 36, 2); });
  g.fillStyle = "#6a3a20"; g.fillRect(52, 84, 24, 44);
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t._dgShared = true;
  return (WORLD._facadeTex = t);
};
WORLD.house = function(kind, rnd) {
  var g = new THREE.Group();
  var M = function(c, o) { var p = { color: c, roughness: 0.85 }; if (o) Object.keys(o).forEach(function(k) { p[k] = o[k]; }); return new THREE.MeshStandardMaterial(p); };
  var gable = function(w, d, h, mat) {   // triangular roof prism along z
    var s = new THREE.Shape(); s.moveTo(-w / 2 - 0.4, 0); s.lineTo(w / 2 + 0.4, 0); s.lineTo(0, h); s.closePath();
    var geo = new THREE.ExtrudeGeometry(s, { depth: d + 0.8, bevelEnabled: false }); geo.translate(0, 0, -(d + 0.8) / 2);
    return new THREE.Mesh(geo, mat);
  };
  if (kind === "house") {
    var w = 7 + rnd() * 3, d = 9 + rnd() * 4, hh = 4.2;
    var walls = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), M(0xffffff, { map: WORLD.houseTex() })); walls.position.y = hh / 2; g.add(walls);
    var roof = gable(w, d, 3.2, M([0xa8442e, 0x5a4a44, 0x7a3a2a, 0x3a4a5a][Math.floor(rnd() * 4)])); roof.position.y = hh; g.add(roof);
    var ch = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.8), M(0x8a5a4a)); ch.position.set(w * 0.25, hh + 2.2, -d * 0.2); g.add(ch);
  } else if (kind === "barn") {
    var bw = 10, bd = 16, bh = 5.5, red = M(0xa8302a), wh = M(0xf4efe6);
    var bwalls = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), red); bwalls.position.y = bh / 2; g.add(bwalls);
    var broof = gable(bw, bd, 4.5, M(0x4a4a4e)); broof.position.y = bh; g.add(broof);
    var door = new THREE.Mesh(new THREE.BoxGeometry(4, 4.4, 0.2), wh); door.position.set(0, 2.2, bd / 2 + 0.05); g.add(door);
    var x1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.6, 0.1), wh); x1.rotation.z = 0.74; x1.position.set(0, 2.2, bd / 2 + 0.2); g.add(x1);
    var x2 = x1.clone(); x2.rotation.z = -0.74; g.add(x2);
  } else if (kind === "silo") {
    var si = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 13, 20), M(0xc8ccd0, { metalness: 0.5, roughness: 0.45 })); si.position.y = 6.5; g.add(si);
    var dome = new THREE.Mesh(new THREE.SphereGeometry(2.25, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0x9aa0a8, { metalness: 0.6, roughness: 0.35 })); dome.position.y = 13; g.add(dome);
  } else if (kind === "windmill") {
    var tw = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 3.2, 12, 8), M(0xf2ebdc)); tw.position.y = 6; g.add(tw);
    var cap = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2.6, 8), M(0x7a3a2a)); cap.position.y = 13.3; g.add(cap);
    var hub = new THREE.Group(); hub.position.set(0, 11.6, 2.2); g.add(hub);
    for (var bl = 0; bl < 4; bl++) { var arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7, 0.12), M(0xe8e2d4)); arm.position.y = 3.6; var piv = new THREE.Group(); piv.rotation.z = bl * Math.PI / 2; piv.add(arm); hub.add(piv); }
    WORLD.anim.push(function(T) { hub.rotation.z = T * 0.6; });
  }
  g.traverse(function(o) { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return g;
};
WORLD.farms = function(ctx) {
  var C = ctx.C, b = C.bounds, H = ctx.H, rnd = ctx.rnd, placed = 0, kinds = ["house", "house", "house", "barn", "silo", "house", "windmill", "barn"];
  for (var t = 0; t < 400 && placed < 26; t++) {
    var ang = rnd() * Math.PI * 2, dist = 70 + rnd() * 380, R = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) * 0.45;
    var x = ctx.cx + Math.cos(ang) * (R + dist), z = ctx.cz + Math.sin(ang) * (R + dist);
    if (x > b.minX - 20 && x < b.maxX + 20 && z > b.minZ - 20 && z < b.maxZ + 20) continue;
    var y = H(x, z); if (y < ctx.W + 1.2) continue;
    var sl = Math.max(Math.abs(H(x + 8, z) - y), Math.abs(H(x - 8, z) - y), Math.abs(H(x, z + 8) - y), Math.abs(H(x, z - 8) - y)); if (sl > 1.6) continue;
    var hs = WORLD.house(kinds[placed % kinds.length], rnd);
    hs.position.set(x, y - 0.3, z); hs.rotation.y = rnd() * 6.28; ctx.g.add(hs); placed++;
  }
};

// ── Floating balloons + rainbow over the lagoon (funny) ──────────────────────
WORLD.balloons = function(ctx) {
  var cols = [0xff5a8a, 0xffd23a, 0x3ab0ff, 0x8ae05a, 0xb46aff, 0xff8a3a];
  for (var i = 0; i < 9; i++) {
    var a = i / 9 * Math.PI * 2 + ctx.rnd(), r = 260 + ctx.rnd() * 260, y = ctx.W + 40 + ctx.rnd() * 50;
    var bal = new THREE.Group(); bal.position.set(ctx.cx + Math.cos(a) * r, y, ctx.cz + Math.sin(a) * r);
    var env = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 14), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.5 })); env.scale.y = 1.2; bal.add(env);
    var band = new THREE.Mesh(new THREE.CylinderGeometry(9.1, 9.1, 3, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })); bal.add(band);
    var bk = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshStandardMaterial({ color: 0x8a5a32 })); bk.position.y = -14; bal.add(bk);
    ctx.g.add(bal);
    (function(bal, ph) { WORLD.anim.push(function(T) { bal.position.y += Math.sin(T * 0.3 + ph) * 0.01; bal.rotation.y = T * 0.05 + ph; }); })(bal, i);
  }
};

// Flat dry spots on the distant land, for landmarks
WORLD.landSpots = function(ctx, n, rMin, rMax, minH) {
  var out = [], H = ctx.H, b = ctx.C.bounds;
  for (var t = 0; t < n * 40 && out.length < n; t++) {
    var a = ctx.rnd() * Math.PI * 2, r = rMin + ctx.rnd() * (rMax - rMin), x = ctx.cx + Math.cos(a) * r, z = ctx.cz + Math.sin(a) * r;
    if (x > b.minX - 20 && x < b.maxX + 20 && z > b.minZ - 20 && z < b.maxZ + 20) continue;
    var y = H(x, z); if (y < ctx.W + (minH || 2)) continue;
    if (Math.abs(H(x + 6, z) - y) + Math.abs(H(x, z + 6) - y) > 3) continue;
    if (out.some(function(o) { return Math.hypot(o.x - x, o.z - z) < 30; })) continue;
    out.push({ x: x, y: y, z: z, a: a });
  }
  return out;
};
// Each world's signature landmarks, now standing on real land
WORLD.landmarks = function(ctx) {
  var th = ctx.h.theme, g = ctx.g, W = ctx.W, M = function(c, o) { var p = { color: c, roughness: 0.8 }; for (var k in o || {}) p[k] = o[k]; return new THREE.MeshStandardMaterial(p); };
  if (th === "jungle" && typeof JUNGLE !== "undefined") JUNGLE.volcano(ctx);   // levels5.js
  if (th === "funny") {
    ["#ff5a5a", "#ffa83a", "#ffe14a", "#6ae05a", "#3ab0ff", "#8a6aff"].forEach(function(col, ri) {
      var arc = new THREE.Mesh(new THREE.TorusGeometry(260 - ri * 8, 4, 6, 72, Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0.28, depthWrite: false, fog: false }));
      arc.position.set(ctx.cx - 120, W - 20, ctx.cz - 620); g.add(arc);
    });
  } else if (th === "minion") {
    var blue = M(0x2c4ea8), grey = M(0x8a8a90, { metalness: 0.4 }), yel = M(0xffd400, { roughness: 0.5 });
    WORLD.landSpots(ctx, 9, 220, 560, 3).forEach(function(s, i) {
      var f = new THREE.Group(), fh = 16 + ctx.rnd() * 20, fw = 18 + ctx.rnd() * 14;
      var body = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fw * 0.7), blue); body.position.y = fh / 2; f.add(body);
      var roof = new THREE.Mesh(new THREE.BoxGeometry(fw + 1, 1.2, fw * 0.7 + 1), yel); roof.position.y = fh + 0.6; f.add(roof);
      for (var c = 0; c < 2; c++) { var ch = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2, fh * 0.8, 10), grey); ch.position.set(fw * (c ? 0.3 : -0.1), fh + fh * 0.4, 0); f.add(ch); }
      f.position.set(s.x, s.y - 0.5, s.z); f.rotation.y = s.a; g.add(f);
    });
    var st = WORLD.landSpots(ctx, 1, 260, 420, 4)[0];
    if (st) {
      var mn = new THREE.Group(); mn.position.set(st.x, st.y - 1, st.z); mn.lookAt(ctx.cx, st.y, ctx.cz);
      var bd = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 26, 24), yel); bd.position.y = 13; mn.add(bd);
      var hd = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), yel); hd.position.y = 26; mn.add(hd);
      var ov = new THREE.Mesh(new THREE.CylinderGeometry(10.1, 10.2, 11, 24), blue); ov.position.y = 5.5; mn.add(ov);
      var gg = new THREE.Mesh(new THREE.TorusGeometry(4, 1, 10, 24), grey); gg.position.set(0, 26, 8.6); mn.add(gg);
      var eye = new THREE.Mesh(new THREE.CircleGeometry(3.2, 20), M(0xffffff)); eye.position.set(0, 26, 8.7); mn.add(eye);
      var pu = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), M(0x3a2a1a)); pu.position.set(0, 26, 8.8); mn.add(pu);
      g.add(mn);
    }
  } else if (th === "tornado") {
    var cl = new THREE.MeshBasicMaterial({ color: 0x223333, transparent: true, opacity: 0.6, depthWrite: false });
    var puffs = [];
    for (var i = 0; i < 18; i++) {
      var a = i / 18 * 6.28 + ctx.rnd() * 0.4, r = 260 + ctx.rnd() * 260, px = ctx.cx + Math.cos(a) * r, pz = ctx.cz + Math.sin(a) * r, py = W + 75 + ctx.rnd() * 40;
      for (var q = 0; q < 6; q++) { var pr = 12 + ctx.rnd() * 14, pg = new THREE.IcosahedronGeometry(pr, 1); pg.scale(1, 0.55, 1); pg.translate(px + (ctx.rnd() - 0.5) * 60, py + (ctx.rnd() - 0.3) * 10, pz + (ctx.rnd() - 0.5) * 60); puffs.push(pg); }
    }
    var cloudMesh = new THREE.Mesh(GFX.mergeGeometries(puffs), new THREE.MeshStandardMaterial({ color: 0x3a4446, roughness: 1, flatShading: true, transparent: true, opacity: 0.85 }));
    g.add(cloudMesh);
    var fm = new THREE.MeshBasicMaterial({ color: 0x4a5656, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
    for (var k = 0; k < 3; k++) {
      var fa = k / 3 * 6.28 + 1.1, fr = 320 + ctx.rnd() * 160, fx = ctx.cx + Math.cos(fa) * fr, fz = ctx.cz + Math.sin(fa) * fr;
      var fn = new THREE.Mesh(new THREE.CylinderGeometry(22, 2, 90, 16, 6, true), fm); fn.position.set(fx, W + 45, fz); g.add(fn);
      (function(fn, ph) { WORLD.anim.push(function(T) { fn.rotation.y = T * 1.6 + ph; fn.position.x += Math.sin(T * 0.2 + ph) * 0.05; }); })(fn, k);
    }
  } else if (/eerie|terrifying|screaming/.test(th)) {
    var dark = M(th === "eerie" ? 0x1c1424 : 0x1a0c0c, { flatShading: true }), glow = new THREE.MeshBasicMaterial({ color: 0xff5a10 });
    WORLD.landSpots(ctx, 40, 200, 650, 1).forEach(function(s) {
      var hgt = 18 + ctx.rnd() * 50, sp = new THREE.Mesh(new THREE.ConeGeometry(3 + ctx.rnd() * 5, hgt, 5), dark);
      sp.position.set(s.x, s.y + hgt / 2 - 2, s.z); sp.rotation.z = (ctx.rnd() - 0.5) * 0.3; g.add(sp);
    });
    if (th !== "eerie") {   // volcano vents glow on the tallest peaks
      WORLD.landSpots(ctx, 6, 250, 700, 30).forEach(function(s) {
        var v = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 6), glow); v.scale.y = 0.35; v.position.set(s.x, s.y + 1, s.z); g.add(v);
      });
    }
  }
};

// ── Castle on the ridge (hogwarts) ───────────────────────────────────────────
WORLD.castleSilhouette = function(ctx) {
  var a = Math.atan2(ctx.C.basket.x - ctx.C.tee.x, ctx.C.basket.z - ctx.C.tee.z) + (ctx.rnd() - 0.5) * 0.8, r = 520;
  var x = ctx.cx + Math.sin(a) * r, z = ctx.cz + Math.cos(a) * r, y = ctx.H(x, z);
  var g = new THREE.Group(); g.position.set(x, y - 2, z); g.rotation.y = a + Math.PI;
  var stone = new THREE.MeshStandardMaterial({ color: 0x4a4650, roughness: 0.9 }), roof = new THREE.MeshStandardMaterial({ color: 0x2a2a44, roughness: 0.7 });
  var lit = new THREE.MeshBasicMaterial({ color: 0xffc860 });
  [[0, 0, 22, 60, 14], [-26, 6, 9, 46, 0], [26, 6, 9, 52, 0], [-12, -18, 7, 72, 0], [14, -16, 8, 64, 0], [0, 22, 6, 40, 0]].forEach(function(t, i) {
    var tw = new THREE.Mesh(t[4] ? new THREE.BoxGeometry(t[2] * 2, t[3], t[4]) : new THREE.CylinderGeometry(t[2] * 0.5, t[2] * 0.55, t[3], 10), stone);
    tw.position.set(t[0], t[3] / 2, t[1]); g.add(tw);
    if (!t[4]) { var cone = new THREE.Mesh(new THREE.ConeGeometry(t[2] * 0.62, t[3] * 0.35, 10), roof); cone.position.set(t[0], t[3] + t[3] * 0.17, t[1]); g.add(cone); }
    for (var w = 0; w < 6; w++) { var win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), lit); win.position.set(t[0] + (t[4] ? (w - 2.5) * 5 : 0), t[3] * (0.3 + (w % 3) * 0.2), t[1] + (t[4] ? t[4] / 2 + 0.1 : t[2] * 0.56)); if (Math.random() < 0.7) g.add(win); }
  });
  ctx.g.add(g);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── CITY: streets continue to the horizon, a real skyline rises around ───────
// ══════════════════════════════════════════════════════════════════════════════
WORLD.facadeMaterial = function(night) {
  var key = "facade" + (night ? "n" : "d");
  if (WORLD._mats[key]) return WORLD._mats[key];
  var m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
  var U = { night: { value: night ? 1 : 0 } };
  m.onBeforeCompile = function(sh) {
    sh.uniforms.night = U.night;
    sh.vertexShader = "attribute float aSeed; varying float vSeed; varying vec3 vWPos2; varying vec3 vWN2;\n" + sh.vertexShader.replace("#include <worldpos_vertex>",
      "#include <worldpos_vertex>\n  vSeed = aSeed; vWPos2 = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN2 = normalize(mat3(modelMatrix) * objectNormal);");
    sh.fragmentShader = "uniform float night; varying float vSeed; varying vec3 vWPos2; varying vec3 vWN2;\nfloat fH(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n" +
      sh.fragmentShader.replace("#include <emissivemap_fragment>", [
        "#include <emissivemap_fragment>",
        "  vec3 n2 = normalize(vWN2);",
        "  if (abs(n2.y) < 0.5) {",
        "    float u = abs(n2.x) > 0.5 ? vWPos2.z : vWPos2.x;",
        "    float cw = 3.0 + fract(vSeed * 7.0) * 1.6, ch = 3.6;",
        "    vec2 cell = vec2(floor(u / cw), floor(vWPos2.y / ch)); vec2 f = vec2(fract(u / cw), fract(vWPos2.y / ch));",
        "    float win = step(0.14, f.x) * step(f.x, 0.86) * step(0.22, f.y) * step(f.y, 0.86);",
        "    float style = fract(vSeed * 13.0);",
        "    if (style > 0.66) win = step(0.06, f.x) * step(f.x, 0.94) * step(0.3, f.y) * step(f.y, 0.92);   // ribbon glazing",
        "    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.08, 0.12) + 0.08 * fH(vec3(cell, vSeed)), win * 0.85);",
        "    float lit = step(0.55 - 0.15 * fract(vSeed * 3.0), fH(vec3(cell, floor(vSeed * 97.0))));",
        "    vec3 lc = mix(vec3(1.0, 0.82, 0.55), vec3(0.75, 0.88, 1.0), fH(vec3(cell.yx, vSeed)));",
        "    totalEmissiveRadiance += lc * win * lit * night * 1.4;",
        "  }",
      ].join("\n"));
  };
  m.customProgramCacheKey = function() { return "dgFacade"; };
  m.userData.noUpgrade = true; m.userData.shared = true;
  return (WORLD._mats[key] = m);
};
WORLD.city = function(ctx) {
  var C = ctx.C, b = C.bounds, rnd = ctx.rnd, night = GFX.themePreset(ctx.h.theme).sun[1] < 1.5;
  // 1) street grid continuing to the horizon (procedural asphalt, sidewalks, lane lines)
  var groundMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: "varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}",
    fragmentShader: [
      "varying vec3 vW;",
      "#include <fog_pars_fragment>",
      "void main(){",
      "  vec2 c = mod(vW.xz + 20.0, 40.0);",
      "  float road = 1.0 - step(7.0, c.x) * step(c.x, 33.0) * step(7.0, c.y) * step(c.y, 33.0);",
      "  vec3 col = mix(vec3(0.20, 0.205, 0.22), vec3(0.075, 0.08, 0.09), road);",
      "  float lane = (step(abs(c.x - 0.0), 0.12) + step(abs(c.x - 40.0), 0.12)) * step(0.5, fract(vW.z / 6.0)) + (step(abs(c.y), 0.12) + step(abs(c.y - 40.0), 0.12)) * step(0.5, fract(vW.x / 6.0));",
      "  col += vec3(0.5, 0.48, 0.38) * clamp(lane, 0.0, 1.0) * road;",
      "  gl_FragColor = vec4(col, 1.0);",
      "  #include <encodings_fragment>",
      "  #include <fog_fragment>",
      "}"].join("\n"),
    fog: true,
  });
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(2200, 2200), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(ctx.cx, -0.03, ctx.cz); ground.userData.noBatch = true; ctx.g.add(ground);
  // 2) skyline: stepped towers, crowns and antennas, all sharing one facade shader
  var geos = [], seeds = [], lights = [];
  var addBox = function(w, h, d, x, y, z, color, seed) {
    var g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y + h / 2, z);
    var n = g.attributes.position.count, c = new THREE.Color(color), ca = new Float32Array(n * 3), sa = new Float32Array(n);
    for (var i = 0; i < n; i++) { ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; sa[i] = seed; }
    g.setAttribute("color", new THREE.BufferAttribute(ca, 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(sa, 1));
    geos.push(g);
  };
  var tints = [0x6a7484, 0x8a8f98, 0x4a5868, 0x9a8a78, 0x5a6a7a, 0x7a6a62, 0x3a4a5a];
  var R0 = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
  for (var t = 0, n = 0; t < 900 && n < 260; t++) {
    var ang = rnd() * Math.PI * 2, d = R0 + 30 + Math.pow(rnd(), 0.8) * 560;
    var x = ctx.cx + Math.cos(ang) * d, z = ctx.cz + Math.sin(ang) * d;
    // keep to the city blocks (between the streets) and out of the playable area
    var bx = Math.round(x / 40) * 40, bz = Math.round(z / 40) * 40;
    if (bx > b.minX - 30 && bx < b.maxX + 30 && bz > b.minZ - 30 && bz < b.maxZ + 30) continue;
    var w = 16 + rnd() * 10, dd = 16 + rnd() * 10, far = _sstep(R0 + 40, R0 + 360, d);   // low-rise next to the course, towers further out
    var hgt = 14 + rnd() * 18 + Math.pow(rnd(), 1.8) * 170 * (0.15 + 0.85 * far), seed = rnd(), col = tints[Math.floor(rnd() * tints.length)];
    var ox = bx + (rnd() - 0.5) * 4, oz = bz + (rnd() - 0.5) * 4;
    addBox(w, hgt, dd, ox, 0, oz, col, seed);
    var top = hgt;
    if (rnd() < 0.55) { var s1 = 0.62 + rnd() * 0.2, h2 = hgt * (0.25 + rnd() * 0.35); addBox(w * s1, h2, dd * s1, ox, top, oz, col, seed); top += h2;
      if (rnd() < 0.5) { var s2 = s1 * 0.6, h3 = h2 * 0.6; addBox(w * s2, h3, dd * s2, ox, top, oz, col, seed); top += h3; } }
    if (rnd() < 0.35) { var cr = new THREE.ConeGeometry(Math.min(w, dd) * 0.32, 10 + rnd() * 14, 4).toNonIndexed(); cr.rotateY(Math.PI / 4); cr.translate(ox, top + 6, oz); WORLD._paint(cr, 0x8a929c, seed); geos.push(cr); top += 12; }
    if (top > 90 && rnd() < 0.7) { var an = new THREE.CylinderGeometry(0.25, 0.4, 18, 5).toNonIndexed(); an.translate(ox, top + 9, oz); WORLD._paint(an, 0x9aa0a8, seed); geos.push(an); lights.push(ox, top + 18.5, oz); }
    n++;
  }
  var mesh = new THREE.Mesh(WORLD.merge(geos), WORLD.facadeMaterial(night));
  mesh.userData.noBatch = true; mesh.frustumCulled = false; mesh.receiveShadow = true; ctx.g.add(mesh);
  // blinking red aircraft warning lights
  if (lights.length) {
    var lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(lights, 3));
    var lm = new THREE.PointsMaterial({ color: 0xff3a2a, size: 3.2, map: GFX.softDotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
    var pts = new THREE.Points(lg, lm); pts.frustumCulled = false; ctx.g.add(pts);
    WORLD.anim.push(function(T) { lm.opacity = (Math.sin(T * 3) > 0.2) ? 1 : 0.15; });
  }
};
// Merge non-indexed geometries keeping position / normal / color / aSeed
WORLD.merge = function(geos) {
  var total = 0; geos.forEach(function(g) { if (!g.attributes.normal) g.computeVertexNormals(); total += g.attributes.position.count; });
  var A = { position: 3, normal: 3, color: 3, aSeed: 1 }, out = new THREE.BufferGeometry();
  Object.keys(A).forEach(function(k) {
    var arr = new Float32Array(total * A[k]), o = 0;
    geos.forEach(function(g) { var at = g.attributes[k], n = g.attributes.position.count; if (at) arr.set(at.array.subarray(0, n * A[k]), o); o += n * A[k]; });
    out.setAttribute(k, new THREE.BufferAttribute(arr, A[k]));
  });
  geos.forEach(function(g) { g.dispose(); });
  out.computeBoundingSphere();
  return out;
};
WORLD._paint = function(g, hex, seed) {
  var n = g.attributes.position.count, c = new THREE.Color(hex), ca = new Float32Array(n * 3), sa = new Float32Array(n);
  for (var i = 0; i < n; i++) { ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; sa[i] = seed; }
  g.setAttribute("color", new THREE.BufferAttribute(ca, 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(sa, 1));
};

// ── Per-frame: the ocean follows the camera, windmills turn, lights blink ────
WORLD.update = function(T) {
  var wm = WORLD.waterMesh;
  if (wm && GFX.camera) { wm.position.x = Math.round(GFX.camera.position.x / 50) * 50; wm.position.z = Math.round(GFX.camera.position.z / 50) * 50; }
  for (var i = 0; i < WORLD.anim.length; i++) WORLD.anim[i](T);
};
