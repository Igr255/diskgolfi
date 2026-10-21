"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── LEVELS ───────────────────────────────────────────────────────────────────
// Every theme maps to a world type with its own architecture:
//   islands   – lagoon islands linked by bridges / stepping stones
//   highlands – terraced hills, rivers, waterfalls, farms, gardens, backyards
//   city      – streets, sidewalks, buildings, rooftops, traffic
//   club      – floating vaporwave club stages over a neon void
//   interior  – liminal mazes with walls and a ceiling (backrooms, pools, office)
//   blocks    – voxel worlds (minecraft, skyblock) and geometry-dash platforms
//   moon      – low-gravity crater fields
//   castle    – floating stone platforms with moving staircases
// Builders only use srng() for anything gameplay-relevant, so every client in a
// multiplayer game generates the identical course.
// ══════════════════════════════════════════════════════════════════════════════

var LV = {};

LV.ARCH = {
  funny: "islands", minion: "islands", emote: "islands", public_poo: "islands",
  eerie: "islands", terrifying: "islands", screaming_mamamia: "islands", tornado: "islands",
  mountains: "highlands", winter: "highlands", grandcanyon: "highlands", waterfall: "highlands",
  village: "highlands", vetschool: "highlands", cabbage: "highlands", feet_bunnies: "highlands", socks_basket: "highlands",
  city: "city",
  disco: "club", neon: "club", sixtyseven: "club", map67: "club",
  backrooms: "interior", poolrooms: "interior", office: "interior",
  minecraft: "blocks", skyblock: "blocks", geometry_dash: "blocks",
  moon: "moon",
  hogwarts: "castle",
};

// Escalation: from hole 3 on, each hole adds modifiers that make it harder
LV.MODS = {
  gusty:    { label: "Gusty",        icon: "💨", desc: "Strong, shifting wind" },
  busy:     { label: "Busy",         icon: "🐾", desc: "More things in your way" },
  mischief: { label: "Mischief",     icon: "🫳", desc: "Critters steal resting discs" },
  tide:     { label: "Rising tide",  icon: "🌊", desc: "The water keeps rising" },
  lava:     { label: "Rising lava",  icon: "🌋", desc: "The lava keeps rising" },
  crumble:  { label: "Crumbling",    icon: "🧱", desc: "Platforms fall when you stand on them" },
  restless: { label: "Restless",     icon: "↔️", desc: "Platforms are on the move" },
  fog:      { label: "Fog",          icon: "🌫️", desc: "Short sight lines" },
  blackout: { label: "Blackout",     icon: "🔦", desc: "The lights are failing" },
};
LV.MOD_POOL = {
  islands: ["gusty", "busy", "mischief", "tide", "restless", "crumble", "fog"],
  highlands: ["gusty", "busy", "mischief", "tide", "fog"],
  city: ["busy", "gusty", "mischief", "fog"],
  club: ["restless", "crumble", "busy", "blackout"],
  interior: ["blackout", "busy", "mischief"],
  blocks: ["crumble", "restless", "busy", "gusty"],
  moon: ["busy", "crumble", "restless"],
  castle: ["restless", "crumble", "gusty", "fog"],
};
LV.pickMods = function(arch, idx, theme) {
  var n = idx < 2 ? 0 : idx < 6 ? 1 : idx < 11 ? 2 : 3;
  var pool = (LV.MOD_POOL[arch] || []).slice(), out = [];
  if (theme === "terrifying" || theme === "screaming_mamamia") pool = pool.map(function(m) { return m === "tide" ? "lava" : m; });
  for (var i = 0; i < n && pool.length; i++) { var k = Math.floor(srng() * pool.length); out.push(pool.splice(k, 1)[0]); }
  return out;
};

// ── Entry point ──────────────────────────────────────────────────────────────
LV.build = function(hole, idx) {
  var arch = LV.ARCH[hole.theme] || "islands";
  hole.arch = arch;
  var c = new Course(hole);
  hole.course = c;
  var d = Math.min(1, idx / 12);          // difficulty 0 → 1 over the first 12 holes
  var spawns = [];
  LV[arch](c, hole, idx, d, spawns);
  // Common finishing: route length, par, mods
  var len = 0;
  for (var i = 1; i < c.route.length; i++) len += Math.hypot(c.route[i].x - c.route[i - 1].x, c.route[i].z - c.route[i - 1].z);
  hole.routeLen = Math.round(len);
  hole.par = Math.max(3, Math.min(5, 3 + Math.floor((len - 40) / 55) + (arch === "interior" ? 1 : 0)));
  hole.bx = c.basket.x; hole.bz = c.basket.z; hole.basketY = c.basket.y;
  hole.tee = c.tee; hole.teeX = c.tee.x; hole.teeZ = c.tee.z;
  hole.water = c.hazard.level;
  hole.waypoints = [];
  hole.movingIslands = [];
  if (hole.mods.indexOf("tide") >= 0 || hole.mods.indexOf("lava") >= 0) c.tide = { t: 0, delay: 18, rate: 0.05, max: Math.min(2.2, c.tideMax || 2.2) };
  if (hole.mods.indexOf("gusty") >= 0) { hole.wind.x *= 2.2; hole.wind.z *= 2.2; }
  return { course: c, spawns: spawns };
};

// ── Shared helpers ───────────────────────────────────────────────────────────
LV.rand = function(a, b) { return a + srng() * (b - a); };
LV.pick = function(arr) { return arr[Math.floor(srng() * arr.length) % arr.length]; };
LV.tee = function(c, x, y, z, toward) {
  var yaw = Math.atan2(toward.x - x, toward.z - z);
  c.tee = { x: x, y: y, z: z, yaw: yaw };
};
// Distance from a point to a polyline; returns {d, t (0..1 along whole route), i}
LV.polyDist = function(pts, x, z) {
  var best = Infinity, bt = 0, tot = 0, lens = [], acc = 0;
  for (var i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); lens.push(l); tot += l; }
  for (var k = 1; k < pts.length; k++) {
    var ax = pts[k - 1].x, az = pts[k - 1].z, bx = pts[k].x, bz = pts[k].z, vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1;
    var u = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
    var px = ax + vx * u, pz = az + vz * u, dd = Math.hypot(x - px, z - pz);
    if (dd < best) { best = dd; bt = (acc + lens[k - 1] * u) / (tot || 1); }
    acc += lens[k - 1];
  }
  return { d: best, t: bt };
};
LV.pointAt = function(pts, t) {
  var tot = 0, lens = [];
  for (var i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); lens.push(l); tot += l; }
  var target = t * tot, acc = 0;
  for (var k = 1; k < pts.length; k++) {
    if (acc + lens[k - 1] >= target || k === pts.length - 1) {
      var u = Math.max(0, Math.min(1, (target - acc) / (lens[k - 1] || 1)));
      var ax = pts[k - 1].x, az = pts[k - 1].z, bx = pts[k].x, bz = pts[k].z;
      return { x: ax + (bx - ax) * u, z: az + (bz - az) * u, dx: (bx - ax) / (lens[k - 1] || 1), dz: (bz - az) / (lens[k - 1] || 1) };
    }
    acc += lens[k - 1];
  }
  return { x: pts[0].x, z: pts[0].z, dx: 0, dz: -1 };
};
function _sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// Wooden bridge (ramp) between two points with rope rails
LV.bridge = function(c, ax, az, ay, bx, bz, by, width) {
  var len = Math.hypot(bx - ax, bz - az), rot = Math.atan2(bx - ax, bz - az);
  var s = c.box({ x: (ax + bx) / 2, z: (az + bz) / 2, w: width, d: len, top: ay, top2: by, ramp: true, bottom: Math.min(ay, by) - 0.25, rot: rot, mat: CM.get("wood"), kind: "platform", surf: "wood" });
  var postM = CM.get("wood", 0x6a4a2a), ropeM = CM.get("plastic", 0xd8c8a0);
  var n = Math.max(2, Math.round(len / 2.5));
  [-1, 1].forEach(function(side) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, x = ax + (bx - ax) * t + Math.cos(rot) * side * width / 2, z = az + (bz - az) * t - Math.sin(rot) * side * width / 2, y = ay + (by - ay) * t;
      var p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.0, 6), postM); p.position.set(x, y + 0.45, z); p.castShadow = true; c.group.add(p);
      pts.push(new THREE.Vector3(x, y + 0.9 - (i > 0 && i < n ? 0.08 : 0), z));
    }
    var rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 4, 0.025, 4, false), ropeM); c.group.add(rope);
  });
  return s;
};

// Stepping stones from A to B (A/B are edge points). Spacing grows with difficulty.
LV.stones = function(c, ax, az, ay, bx, bz, by, d, opts) {
  opts = opts || {};
  var len = Math.hypot(bx - ax, bz - az);
  var maxGap = 1.9 + d * 0.9;                          // edge-to-edge jump distance
  var r = 1.15 - d * 0.3;
  var n = Math.max(1, Math.ceil((len - maxGap) / (maxGap + 2 * r)));
  var mat = opts.mat || CM.get("rock", opts.color || 0x8a8580);
  var out = [];
  for (var i = 1; i <= n; i++) {
    var t = i / (n + 1), jitter = (srng() - 0.5) * 0.9;
    var x = ax + (bx - ax) * t + (bz - az) / len * jitter, z = az + (bz - az) * t - (bx - ax) / len * jitter;
    var top = ay + (by - ay) * t - 0.25 + (srng() - 0.5) * 0.3;
    var s = c.cyl({ x: x, z: z, r: r * (0.85 + srng() * 0.3), top: top, bottom: (opts.bottom !== undefined ? opts.bottom : c.hazard.level - 3), mat: mat, kind: "platform", surf: "rock", segments: 9, topScale: 0.92, crumble: !!opts.crumble });
    if (s.mesh) { s.mesh.rotation.y = srng() * 3; }
    if (opts.bob && srng() < 0.6) c.addMover(s, { type: "bob", amp: 0.35 + d * 0.3, speed: 1.1 + srng(), phase: srng() * 6 });
    out.push(s);
  }
  return out;
};

// Scatter grass blades + flowers over walkable heightfield ground near the route
LV.grass = function(c, hole, pts, width, count, opts) {
  opts = opts || {};
  var P = GFX.themePreset(hole.theme), G = P.grass || [0];
  if (!(G[0] > 0) || !(GFX.settings && GFX.settings.grass > 0)) return;
  count = Math.floor(count * GFX.settings.grass);
  var mesh = new THREE.InstancedMesh(GFX._bladeGeo(), GFX._grassMaterial(hole.theme), count);
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  var rnd = _gfxRng(hole.n * 7919 + 13), k = 0;
  for (var i = 0; i < count * 2 && k < count; i++) {
    var at = LV.pointAt(pts, rnd()), off = (rnd() - 0.5) * 2 * width;
    var x = at.x - at.dz * off + (rnd() - 0.5) * 4, z = at.z + at.dx * off + (rnd() - 0.5) * 4;
    var y = c.heightAt(x, z);
    if (y < c.hazard.level + 0.4) continue;
    if (Math.abs(c.heightAt(x + 0.4, z) - y) > 0.15 || Math.abs(c.heightAt(x, z + 0.4) - y) > 0.15) continue;
    if (opts.avoid && opts.avoid(x, z)) continue;
    if (_gfxFbm2(x * 0.15, z * 0.15, 3) < 0.38) continue;
    q.setFromAxisAngle(up, rnd() * 6.28); sc.set(0.8 + rnd() * 0.6, 0.18 + rnd() * 0.24, 1); p.set(x, y + 0.005, z);
    m4.compose(p, q, sc); mesh.setMatrixAt(k, m4);
    var v = 0.8 + rnd() * 0.4; col.setRGB(v, v, v * 0.92); mesh.setColorAt(k, col); k++;
  }
  mesh.count = k; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.userData.noBatch = true;
  c.group.add(mesh);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── ISLANDS: a lagoon of islands linked by bridges and stepping stones ───────
// ══════════════════════════════════════════════════════════════════════════════
LV.islands = function(c, hole, idx, d, spawns) {
  var lava = hole.theme === "terrifying" || hole.theme === "screaming_mamamia";
  c.hazard = { type: lava ? "lava" : "water", level: -1.5, base: -1.5 };
  c.tideMax = 2.1;
  var tpl = pickTemplate(idx);
  hole.templateLabel = (ISLAND_TEMPLATES[tpl] || {}).label || "Lagoon";
  var chain = buildIslandChain(tpl, idx).filter(function(p) { return p.type !== "shortcut"; });
  // Keep consecutive islands within a climbable height difference
  for (var i = 1; i < chain.length; i++) chain[i].elev = Math.max(chain[i - 1].elev - 2.5, Math.min(chain[i - 1].elev + 2.5, chain[i].elev || 0));
  chain[0].r = 8; chain[chain.length - 1].r = 8;
  var W = -1.5, P = GFX.themePreset(hole.theme);
  var foam = [];
  var restless = hole.mods.indexOf("restless") >= 0, crumble = hole.mods.indexOf("crumble") >= 0;
  chain.forEach(function(isl, i) {
    var r = Math.max(3.4, isl.r), surf = W + ISLAND_TOP + (isl.elev || 0);
    var avoid = i === 0 ? [{ x: 0, z: 0, r: 2.5 }] : i === chain.length - 1 ? [{ x: isl.x, z: isl.z, r: 0.8 }] : [];
    var vis = GFX.buildIsland({ x: isl.x, z: isl.z, r: r, surfY: surf, waterY: W, theme: hole.theme, type: i === 0 ? "tee" : i === chain.length - 1 ? "basket" : "normal", avoid: avoid, seed: (idx + 1) * 977 + i * 131 });
    c.group.add(vis);
    if (vis.userData.waterlineR > 0) foam.push({ x: isl.x, z: isl.z, r: vis.userData.waterlineR });
    c.addSolid({ shape: "cyl", x: isl.x, z: isl.z, r: r, top: surf, bottom: W - 4, taper: 0.5, kind: "ground" });
    isl.surf = surf; isl.R = r;
    // Critters and props live on the fairway islands
    if (i > 0 && i < chain.length - 1) spawns.push({ kind: "island", x: isl.x, z: isl.z, r: r, y: surf });
  });
  hole._foamStatic = foam;
  // Links: bridges early, stepping stones later (bobbing / crumbling with mods)
  for (var k = 1; k < chain.length; k++) {
    var A = chain[k - 1], B = chain[k], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    var ax = A.x + ux * (A.R - 0.2), az = A.z + uz * (A.R - 0.2), bx = B.x - ux * (B.R - 0.2), bz = B.z - uz * (B.R - 0.2);
    var gap = L - A.R - B.R;
    if (gap < 1.2) continue;
    if (d < 0.18 || (idx % 3 === 0 && k === 1)) LV.bridge(c, ax, az, A.surf, bx, bz, B.surf, 2.2);
    else LV.stones(c, ax + ux * 0.6, az + uz * 0.6, A.surf, bx - ux * 0.6, bz - uz * 0.6, B.surf, d, { bob: restless || d > 0.6, crumble: crumble, color: lava ? 0x3a2a26 : undefined });
  }
  var first = chain[1] || chain[chain.length - 1], last = chain[chain.length - 1];
  var fl = Math.hypot(first.x, first.z) || 1;
  LV.tee(c, first.x / fl * TEE_FORWARD, chain[0].surf, first.z / fl * TEE_FORWARD, first);
  c.basket = { x: last.x, y: last.surf, z: last.z };
  c.route = chain.map(function(p) { return { x: p.x, y: p.surf, z: p.z }; });
  var xs = chain.map(function(p) { return p.x; }), zs = chain.map(function(p) { return p.z; });
  c.bounds = { minX: Math.min.apply(null, xs) - 60, maxX: Math.max.apply(null, xs) + 60, minZ: Math.min.apply(null, zs) - 60, maxZ: Math.max.apply(null, zs) + 60 };
  c.backdrop = true;
};

// ══════════════════════════════════════════════════════════════════════════════
// ── HIGHLANDS: terraced hills, rivers and waterfalls (and farms, gardens) ────
// ══════════════════════════════════════════════════════════════════════════════
LV.HL = {
  mountains:   { amp: 15, slope: 0.45, prof: function(t) { return 9 * t + 1.5 * Math.sin(t * 7); }, rivers: [0.3], fw: 9, top: 0x5a8a3a, side: 0x6a6a70, snow: 13, label: "Alpine pass" },
  winter:      { amp: 9,  slope: 0.35, prof: function(t) { return 3 + 3 * Math.sin(t * 5.5); }, rivers: [0.45], fw: 9, top: 0xf2f6fb, side: 0x8a9aaa, snow: -99, label: "Snowfield", surf: "snow" },
  grandcanyon: { amp: 20, slope: 0.6, prof: function(t) { return 7 + 1.5 * Math.sin(t * 4); }, rivers: [0.35, 0.72], fw: 7, top: 0xc8783e, side: 0xa0502a, strata: true, label: "Canyon run", surf: "sand", riverW: 6 },
  waterfall:   { amp: 12, slope: 0.5, prof: function(t) { return Math.round((1 - t) * 3.4) * 4; }, rivers: [0.88], fw: 8, top: 0x3a8a3a, side: 0x4a5a4a, falls: true, label: "Cascades" },
  village:     { amp: 4,  slope: 0.25, prof: function(t) { return 1.2 + Math.sin(t * 6) * 1.2; }, rivers: [0.55], fw: 11, top: 0x6aa83a, side: 0x7a6a58, label: "Village green" },
  vetschool:   { amp: 3,  slope: 0.2, prof: function(t) { return 1 + Math.sin(t * 5) * 0.8; }, rivers: [], fw: 12, top: 0x5aaa5a, side: 0x7a7a6a, label: "Campus lawn" },
  cabbage:     { amp: 3,  slope: 0.25, prof: function(t) { return 1 + Math.sin(t * 7) * 1.0; }, rivers: [0.6], fw: 11, top: 0x5a8a34, side: 0x5a4028, label: "Vegetable patch" },
  feet_bunnies:{ amp: 5,  slope: 0.25, prof: function(t) { return 1.5 + Math.sin(t * 6) * 1.5; }, rivers: [0.5], fw: 10, top: 0x8fd46a, side: 0xa88880, label: "Meadow" },
  socks_basket:{ amp: 2,  slope: 0.2, prof: function(t) { return 0.8; }, rivers: [], fw: 13, top: 0x6ab84a, side: 0x8a7a6a, label: "Laundry day" },
};

LV.highlands = function(c, hole, idx, d, spawns) {
  var cfg = LV.HL[hole.theme] || LV.HL.village;
  hole.templateLabel = cfg.label;
  var W = -1.5;
  c.hazard = { type: "water", level: W, base: W };
  c.tideMax = 1.6;
  c.surf = cfg.surf || "grass";
  // Route: tee → meandering control points → basket
  var L = 80 + Math.min(idx, 12) * 6, n = 3 + Math.floor(srng() * 2), pts = [{ x: 0, z: 0 }];
  for (var i = 1; i <= n; i++) pts.push({ x: (srng() - 0.5) * 2 * (12 + d * 14), z: -L * i / n });
  var fw = cfg.fw - d * 3;
  var rivers = cfg.rivers.map(function(rt) {
    var p = LV.pointAt(pts, rt);
    return { x: p.x, z: p.z, nx: p.dx, nz: p.dz, w: (cfg.riverW || 3.5) + d * 2.5 };   // river runs perpendicular to the route
  });
  var seedOx = srng() * 100, seedOz = srng() * 100;
  function base(x, z) {
    var pd = LV.polyDist(pts, x, z), hc = cfg.prof(pd.t);
    var nse = _gfxFbm2(x / 38 + seedOx, z / 38 + seedOz, 4);
    var edge = _sstep(fw, fw + 16, pd.d);
    var hills = hc + (nse - 0.5) * 2 * cfg.amp * 0.7 + Math.max(0, pd.d - fw - 8) * cfg.slope;
    var h = hc + (nse - 0.5) * 1.6 + (1 - edge) * 0 ;
    h = h + (hills - h) * edge;
    // keep the tee and the basket on dry, level ground
    var dEnd = Math.min(Math.hypot(x - pts[0].x, z - pts[0].z), Math.hypot(x - pts[pts.length - 1].x, z - pts[pts.length - 1].z));
    if (dEnd < 9) h = Math.max(h, W + 1.4 + (1 - _sstep(5, 9, dEnd)) * 0.3);
    for (var r = 0; r < rivers.length; r++) {
      var R = rivers[r], along = (x - R.x) * R.nx + (z - R.z) * R.nz;   // distance across the river
      var aw = Math.abs(along + Math.sin((x * R.nz - z * R.nx) * 0.08) * 1.5);
      if (aw < R.w + 3) { var bed = W - 1.6; h = Math.min(h, bed + (h - bed) * _sstep(R.w, R.w + 3, aw)); }
    }
    return h;
  }
  // Terraces: crisp 1 m ledges you hop up
  function post(h) { if (h < W + 0.2) return h; var f = Math.floor(h), fr = h - f; return f + _sstep(0.8, 1.0, fr); }
  var minX = -70 - 25, maxX = 70 + 25, minZ = -L - 50, maxZ = 50;
  c.setHeightfield(minX, maxX, minZ, maxZ, 1.0, base, post);
  c.bounds = { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ };
  c.route = pts.map(function(p) { return { x: p.x, y: c.heightAt(p.x, p.z), z: p.z }; });

  // Terrain mesh with height/slope colouring
  LV.terrainMesh(c, hole, cfg, minX, maxX, minZ, maxZ, 1.0);

  // River crossings: bridge early, stones later
  rivers.forEach(function(R) {
    var ax = R.x - R.nx * (R.w + 2.5), az = R.z - R.nz * (R.w + 2.5), bx = R.x + R.nx * (R.w + 2.5), bz = R.z + R.nz * (R.w + 2.5);
    var ay = c.heightAt(ax, az), by = c.heightAt(bx, bz);
    if (d < 0.25) LV.bridge(c, ax, az, ay, bx, bz, by, 2.4);
    else LV.stones(c, ax, az, ay, bx, bz, by, d, { bob: hole.mods.indexOf("restless") >= 0, bottom: W - 3 });
  });
  // Waterfalls pouring off the terrace cliffs beside the fairway
  if (cfg.falls) LV.waterfalls(c, hole, pts, fw);

  // Grass + flowers along the fairway
  LV.grass(c, hole, pts, fw + 4, 9000);

  // Tee & basket
  var t0 = LV.pointAt(pts, 0.035), tb = pts[pts.length - 1];
  LV.tee(c, t0.x, c.heightAt(t0.x, t0.z), t0.z, LV.pointAt(pts, 0.12));
  c.basket = { x: tb.x, y: c.heightAt(tb.x, tb.z), z: tb.z };
  // Flatten-check: keep the basket off a ledge by nudging along the route if needed
  spawns.push({ kind: "fairway", pts: pts, fw: fw });
  c.backdrop = true;
};

// Heightfield mesh, coloured by height, slope and theme
LV.terrainMesh = function(c, hole, cfg, minX, maxX, minZ, maxZ, cell) {
  var nx = Math.round((maxX - minX) / cell) + 1, nz = Math.round((maxZ - minZ) / cell) + 1;
  var pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), idx = [];
  var top = new THREE.Color(cfg.top), side = new THREE.Color(cfg.side), snowC = new THREE.Color(0xf4f8ff), sandC = new THREE.Color(0xd8c090), tmp = new THREE.Color();
  var strata = [0xc8783e, 0xa0502a, 0xd89a60, 0xb8643a, 0xe0b080].map(function(h) { return new THREE.Color(h); });
  var W = c.hazard.level;
  for (var j = 0; j < nz; j++) for (var i = 0; i < nx; i++) {
    var x = minX + i * cell, z = minZ + j * cell, y = c.hfAt(x, z), k = j * nx + i;
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    uv[k * 2] = x / 5; uv[k * 2 + 1] = z / 5;
    var sl = Math.max(Math.abs(c.hfAt(x + cell, z) - y), Math.abs(c.hfAt(x, z + cell) - y));
    var n = _gfxFbm2(x * 0.08, z * 0.08, 3);
    tmp.copy(top).multiplyScalar(0.85 + n * 0.3);
    if (cfg.strata) tmp.lerp(strata[((Math.floor(y * 0.9) % 5) + 5) % 5], 0.7);
    if (sl > 0.45) tmp.lerp(side, Math.min(1, (sl - 0.45) * 2.2));
    if (y < W + 0.9) tmp.lerp(sandC, _sstep(W + 0.9, W + 0.2, y) * 0.8);
    if (y > cfg.snow) tmp.lerp(snowC, Math.min(1, (y - cfg.snow) / 3));
    col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
  }
  for (var b = 0; b < nz - 1; b++) for (var a = 0; a < nx - 1; a++) {
    var p0 = b * nx + a, p1 = p0 + 1, p2 = p0 + nx, p3 = p2 + 1;
    idx.push(p0, p2, p1, p1, p2, p3);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  var st = GFX.surfaceTexture(cfg.surf === "snow" ? "snow" : cfg.surf === "sand" ? "sand" : "grass", null);
  var m = new THREE.MeshStandardMaterial({ vertexColors: true, map: st.map, bumpMap: st.bump || null, bumpScale: 0.03, roughness: 0.95 });
  var mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true; mesh.castShadow = true;
  c.group.add(mesh);
  return mesh;
};

// Animated waterfall sheets where the terrain drops steeply beside the fairway
LV.waterfalls = function(c, hole, pts, fw) {
  var mat = LV.waterfallMat();
  for (var t = 0.08; t < 0.95; t += 0.01) {
    var p = LV.pointAt(pts, t), p2 = LV.pointAt(pts, t + 0.012);
    var h1 = c.heightAt(p.x, p.z), h2 = c.heightAt(p2.x, p2.z);
    if (h1 - h2 < 3) continue;
    [-1, 1].forEach(function(side) {
      var off = fw + 3 + srng() * 6, x = p.x - p.dz * off * side, z = p.z + p.dx * off * side;
      var top = c.heightAt(x, z) + 0.3, bot = c.heightAt(x + p.dx * 4, z + p.dz * 4);
      if (top - bot < 2.5) return;
      var w = 3 + srng() * 3, h = top - bot + 0.6;
      var geo = new THREE.PlaneGeometry(w, h, 1, 8);
      var pa = geo.attributes.position;
      for (var i = 0; i < pa.count; i++) { var yy = pa.getY(i), k = Math.max(0, Math.min(1, (h / 2 - yy) / h)); pa.setZ(i, Math.pow(k, 1.6) * 2.2); }   // curved lip
      geo.computeVertexNormals();
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x + p.dx * 1.6, bot + h / 2 - 0.3, z + p.dz * 1.6);
      m.rotation.y = Math.atan2(p.dx, p.dz) + Math.PI;
      m.renderOrder = 2;
      c.group.add(m);
      // splash pool + mist at the bottom
      var pool = new THREE.Mesh(new THREE.CircleGeometry(w * 0.7, 20), new THREE.MeshStandardMaterial({ color: 0x9adcf0, roughness: 0.1, transparent: true, opacity: 0.8 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(x + p.dx * 3.2, bot + 0.05, z + p.dz * 3.2); c.group.add(pool);
      LV.mist(c, x + p.dx * 3.2, bot + 0.4, z + p.dz * 3.2, w);
    });
    t += 0.06;
  }
};
LV.waterfallMat = function() {
  if (LV._wfm) return LV._wfm;
  LV._wfm = new THREE.ShaderMaterial({
    uniforms: { time: GFX.time },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: [
      "uniform float time; varying vec2 vUv;",
      "float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }",
      "float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }",
      "void main(){",
      "  vec2 p = vec2(vUv.x * 6.0, vUv.y * 3.0 + time * 2.6);",
      "  float s = n(p * vec2(1.0, 0.35)) * 0.6 + n(p * vec2(2.3, 0.8)) * 0.4;",
      "  float foam = smoothstep(0.55, 0.85, s) + smoothstep(0.25, 0.0, vUv.y) * 0.8;",
      "  vec3 col = mix(vec3(0.35, 0.7, 0.88), vec3(0.95, 0.98, 1.0), clamp(foam, 0.0, 1.0));",
      "  float a = 0.62 + foam * 0.35;",
      "  a *= smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);",
      "  gl_FragColor = vec4(col, a);",
      "  #include <encodings_fragment>",
      "}"].join("\n"),
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  return LV._wfm;
};
LV.mist = function(c, x, y, z, w) {
  var n = 26, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seeds = [];
  for (var i = 0; i < n; i++) seeds.push(Math.random());
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  var pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, map: GFX.softDotTexture(), transparent: true, opacity: 0.35, depthWrite: false }));
  pts.frustumCulled = false;
  c.group.add(pts);
  c.updaters.push(function(T) {
    for (var i = 0; i < n; i++) {
      var s = seeds[i], ph = (T * 0.4 + s) % 1;
      pos[i * 3] = x + Math.cos(s * 40) * w * 0.6 * ph; pos[i * 3 + 1] = y + ph * 2.5; pos[i * 3 + 2] = z + Math.sin(s * 40) * w * 0.6 * ph;
    }
    geo.attributes.position.needsUpdate = true;
  });
};
