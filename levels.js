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
// A proper footbridge: individual planks on two stringers that sag a little between
// sturdy anchor posts, rope rails, and pilings driven into the water below. Collision
// is a chain of short ramps that follows the same curve, so you walk on the planks.
// opts.sag: dip in metres (default grows with length; 0 for chained sections).
LV.bridge = function(c, ax, az, ay, bx, bz, by, width, opts) {
  opts = opts || {};
  var len = Math.hypot(bx - ax, bz - az) || 0.01, rot = Math.atan2(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, px = uz, pz = -ux;
  var sag = opts.sag !== undefined ? opts.sag : Math.min(0.45, Math.max(0, len - 4) * 0.03);
  var yAt = function(t) { return ay + (by - ay) * t - sag * 4 * t * (1 - t); };
  var W = c.hazard ? c.hazard.level : -1.5, rnd = _gfxRng(Math.floor(Math.abs(ax * 131 + az * 71 + bx * 13)) + 7);
  // collision: short ramps along the curve
  var nSeg = Math.max(1, Math.ceil(len / 2.2)), first = null;
  for (var i = 0; i < nSeg; i++) {
    var t0 = i / nSeg, t1 = (i + 1) / nSeg, tm = (t0 + t1) / 2;
    var seg = c.box({ x: ax + (bx - ax) * tm, z: az + (bz - az) * tm, w: width, d: len / nSeg + 0.06, top: yAt(t0), top2: yAt(t1), ramp: true,
      bottom: Math.min(yAt(t0), yAt(t1)) - 0.3, rot: rot, visual: false, kind: "platform", surf: "wood" });
    seg.crossing = true; if (!first) first = seg;
  }
  // ── visuals ──
  var wood = CM.get("wood"), dark = CM.get("wood", 0x6a4a2a), rope = CM.get("plastic", 0xd8c8a0);
  var nP = Math.max(2, Math.round(len / 0.3)), plankGeo = new THREE.BoxGeometry(width, 0.07, 0.25);
  var planks = new THREE.InstancedMesh(plankGeo, wood, nP), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  for (var k = 0; k < nP; k++) {
    var t = (k + 0.5) / nP, slope = ((by - ay) - sag * 4 * (1 - 2 * t)) / len;
    e.set(-Math.atan(slope) + (rnd() - 0.5) * 0.03, rot + (rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.04, "YXZ");
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(ax + (bx - ax) * t, yAt(t) - 0.035 + (rnd() - 0.5) * 0.015, az + (bz - az) * t), q, new THREE.Vector3(1 - rnd() * 0.06, 1, 1));
    planks.setMatrixAt(k, m4);
    var v = 0.78 + rnd() * 0.3; col.setRGB(v, v * (0.94 + rnd() * 0.08), v * 0.9); planks.setColorAt(k, col);
  }
  planks.castShadow = true; planks.receiveShadow = true; planks.userData.noBatch = true;
  c.group.add(planks);
  var geos = [], posts = [], ropes = [[], []];
  // stringers under the plank ends
  for (var j = 0; j < nSeg; j++) {
    var a0 = j / nSeg, a1 = (j + 1) / nSeg, y0 = yAt(a0) - 0.12, y1 = yAt(a1) - 0.12, segL = len / nSeg;
    [-1, 1].forEach(function(sd) {
      var g = new THREE.BoxGeometry(0.1, 0.12, segL + 0.04);
      g.rotateX(-Math.atan2(y1 - y0, segL));
      g.rotateY(rot);
      g.translate(ax + (bx - ax) * (a0 + a1) / 2 + px * sd * (width / 2 - 0.06), (y0 + y1) / 2, az + (bz - az) * (a0 + a1) / 2 + pz * sd * (width / 2 - 0.06));
      geos.push(g);
    });
  }
  // posts (thick anchors at the ends), rope rails and pilings into the water
  var nPost = Math.max(2, Math.round(len / 2.4));
  for (var pI = 0; pI <= nPost; pI++) {
    var tp = pI / nPost, yp = yAt(tp), anchor = pI === 0 || pI === nPost;
    [-1, 1].forEach(function(sd, si) {
      var x = ax + (bx - ax) * tp + px * sd * (width / 2 + 0.02), z = az + (bz - az) * tp + pz * sd * (width / 2 + 0.02);
      var r0 = anchor ? 0.11 : 0.065, hgt = anchor ? 1.25 : 1.0;
      var pg = new THREE.CylinderGeometry(r0 * 0.9, r0, hgt, 7); pg.translate(x, yp + hgt / 2 - 0.05, z); posts.push(pg);
      if (anchor) { var cap = new THREE.SphereGeometry(r0 * 1.15, 8, 6); cap.translate(x, yp + hgt, z); posts.push(cap); }
      ropes[si].push(new THREE.Vector3(x, yp + 0.92 - (anchor ? 0 : 0.06), z));
      // a piling down to the river / sea bed wherever the deck is over open water
      var ground = c.hf ? c.hfAt(x, z) : -Infinity;
      if (!(ground > yp - 1.2)) { var bottomY = Math.max(W - 3.5, ground === -Infinity ? W - 3.5 : ground - 0.3), pl = new THREE.CylinderGeometry(0.09, 0.11, yp - bottomY, 7); pl.translate(x, (yp + bottomY) / 2 - 0.08, z); posts.push(pl); }
    });
  }
  var sm = new THREE.Mesh(GFX.mergeGeometries(geos), dark); sm.castShadow = true; sm.receiveShadow = true; c.group.add(sm);
  var pm = new THREE.Mesh(GFX.mergeGeometries(posts), dark); pm.castShadow = true; pm.receiveShadow = true; c.group.add(pm);
  ropes.forEach(function(pts) {
    var rp = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 6, 0.028, 5, false), rope); rp.castShadow = true; c.group.add(rp);
    var low = pts.map(function(v) { return v.clone().add(new THREE.Vector3(0, -0.42, 0)); });
    var rl = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(low), low.length * 6, 0.02, 5, false), rope); c.group.add(rl);
  });
  return first;
};

// A boulder that fits a stepping-stone cylinder: lumpy sides, a flat walkable top at +h/2
LV.rockGeo = function(r, h, seed) {
  var g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, v = new THREE.Vector3(), rnd = _gfxRng(seed + 1);
  var ox = rnd() * 50, oz = rnd() * 50;
  for (var i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    var n = 0.78 + _gfxFbm2(v.x * 1.9 + ox, v.z * 1.9 + v.y * 1.6 + oz, 3) * 0.48;
    v.x *= n; v.z *= n;
    if (v.y > 0.5) v.y = 0.5 + (v.y - 0.5) * 0.15;   // flat-ish top
    // a boulder rising out of the water: rounded shoulders, then flaring out wide toward the bed
    var flare = v.y > 0 ? 1 - Math.pow(v.y / 0.55, 2) * 0.38 : 1 + Math.pow(-v.y, 1.4) * 0.9;   // rounded shoulders, wide base
    p.setXYZ(i, v.x * flare, v.y, v.z * flare);
  }
  var maxY = -9, minY = 9; for (var j = 0; j < p.count; j++) { maxY = Math.max(maxY, p.getY(j)); minY = Math.min(minY, p.getY(j)); }
  var sy = h / (maxY - minY);
  for (var k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * r * 1.08, (p.getY(k) - minY) * sy - h / 2, p.getZ(k) * r * 1.08);
  g.computeVertexNormals();
  return g;
};

// Stepping stones from A to B (A/B are edge points). Spacing grows with difficulty.
LV.stones = function(c, ax, az, ay, bx, bz, by, d, opts) {
  opts = opts || {};
  var len = opts.len || Math.hypot(bx - ax, bz - az);
  // opts.at(f) → {x, z, dx, dz}: lay the stones along a curved path instead of a straight line
  var at = opts.at || function(f) { return { x: ax + (bx - ax) * f, z: az + (bz - az) * f, dx: (bx - ax) / len, dz: (bz - az) / len }; };
  var maxGap = 1.9 + d * 0.9;                          // edge-to-edge jump distance
  var r = 1.15 - d * 0.3;
  var n = Math.max(1, Math.ceil((len - maxGap) / (maxGap + 2 * r)));
  var mat = opts.mat || CM.get("rock", opts.color || 0x8a8580);
  var out = [];
  for (var i = 1; i <= n; i++) {
    var t = i / (n + 1), jitter = (srng() - 0.5) * 0.9, q = at(t);
    var x = q.x + q.dz * jitter, z = q.z - q.dx * jitter;
    var top = ay + (by - ay) * t - 0.25 + (srng() - 0.5) * 0.3;
    var s = c.cyl({ x: x, z: z, r: r * (0.85 + srng() * 0.3), top: top, bottom: (opts.bottom !== undefined ? opts.bottom : c.hazard.level - 3), mat: mat, kind: "platform", surf: "rock", segments: 9, topScale: 0.92, crumble: !!opts.crumble });
    if (s.mesh) { var h0 = top - s.bottom; s.mesh.geometry.dispose(); s.mesh.geometry = LV.rockGeo(s.r, h0, Math.floor(srng() * 1e6)); s.mesh.rotation.set((srng() - 0.5) * 0.08, srng() * 3, (srng() - 0.5) * 0.08); }
    s.crossing = true;
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
    var end = i === 0 || i === chain.length - 1;
    var r = Math.max(3.4, isl.r) * (end ? 1 : 0.9 + srng() * 0.35), surf = W + ISLAND_TOP + (isl.elev || 0);
    // every island its own silhouette: lobed / bean / blob, domed meadows or sandy beaches (tee & basket stay calm and flat)
    var sh = GFX.islandShape((idx + 1) * 977 + i * 131, end);
    if (lava || hole.theme === "eerie" || hole.theme === "tornado") sh.beach = false;
    var avoid = i === 0 ? [{ x: 0, z: 0, r: 2.5 }] : i === chain.length - 1 ? [{ x: isl.x, z: isl.z, r: 0.8 }] : [];
    // keep the decor out of the way of the bridges to the neighbouring islands
    var clear = [];
    [chain[i - 1], chain[i + 1]].forEach(function(nb) { if (nb) clear.push(Math.atan2(nb.z - isl.z, nb.x - isl.x)); });
    var vis = GFX.buildIsland({ x: isl.x, z: isl.z, r: r, surfY: surf, waterY: W, theme: hole.theme, type: i === 0 ? "tee" : i === chain.length - 1 ? "basket" : "normal", avoid: avoid, seed: (idx + 1) * 977 + i * 131,
      prof: sh.prof, dome: sh.dome, beach: sh.beach, tint: sh.tint, clear: clear });
    c.group.add(vis);
    if (vis.userData.waterlineR > 0) foam.push({ x: isl.x, z: isl.z, r: vis.userData.waterlineR });
    var drop = surf - W;
    c.addSolid({ shape: "cyl", x: isl.x, z: isl.z, r: r, top: surf, bottom: W - 4, kind: "ground", prof: sh.prof, profMax: sh.max, dome: sh.dome,
      taper: sh.beach ? 4.6 : 0.5, slope: sh.beach ? (drop + 0.6) / 4.6 : 2.0 });
    isl.surf = surf; isl.R = r; isl.prof = sh.prof;
    // Critters and props live on the fairway islands (well inside the shaped edge)
    if (i > 0 && i < chain.length - 1) spawns.push({ kind: "island", x: isl.x, z: isl.z, r: r * 0.78, y: surf });
  });
  hole._foamStatic = foam;
  // Links: bridges early, stepping stones later (bobbing / crumbling with mods)
  for (var k = 1; k < chain.length; k++) {
    var A = chain[k - 1], B = chain[k], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    // the real (shaped) edge of each island facing the other one; bridges land a little way onto it
    var RA = A.R * GFX.profAt(A.prof, Math.atan2(uz, ux)), RB = B.R * GFX.profAt(B.prof, Math.atan2(-uz, -ux));
    var ax = A.x + ux * (RA - 0.7), az = A.z + uz * (RA - 0.7), bx = B.x - ux * (RB - 0.7), bz = B.z - uz * (RB - 0.7);
    var gap = L - RA - RB;
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
  winter:      { amp: 9,  slope: 0.35, prof: function(t) { return 3 + 3 * Math.sin(t * 5.5); }, rivers: [0.45], fw: 9, top: 0xc2d0e0, side: 0x6a7a8c, snow: -99, label: "Snowfield", surf: "snow" },
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
    return { x: p.x, z: p.z, nx: p.dx, nz: p.dz, w: (cfg.riverW || 3.5) + d * 2.5, t: rt };   // river runs perpendicular to the route
  });
  var seedOx = srng() * 100, seedOz = srng() * 100;
  // Cascades: a stream runs down the valley beside the fairway and pours over each terrace
  var stream = null;
  if (cfg.falls) {
    var side = srng() < 0.5 ? -1 : 1, off = fw + 3.5;
    stream = [];
    for (var si = 0; si <= 60; si++) { var sp = LV.pointAt(pts, si / 60); stream.push({ x: sp.x - sp.dz * off * side, z: sp.z + sp.dx * off * side }); }
  }
  function base(x, z) {
    var pd = LV.polyDist(pts, x, z), hc = cfg.prof(pd.t);
    var nse = _gfxFbm2(x / 38 + seedOx, z / 38 + seedOz, 4);
    var edge = _sstep(fw, fw + 16, pd.d);
    var hills = hc + (nse - 0.5) * 2 * cfg.amp * 0.7 + Math.max(0, pd.d - fw - 8) * cfg.slope;
    var h = hc + (nse - 0.5) * 1.6 + (1 - edge) * 0 ;
    h = h + (hills - h) * edge;
    if (stream) { var sd = LV.polyDist(stream, x, z).d; if (sd < 2.2) h -= 0.6 * (1 - sd / 2.2); }   // shallow stream bed
    // keep the tee and the basket on dry, level ground
    var dEnd = Math.min(Math.hypot(x - pts[0].x, z - pts[0].z), Math.hypot(x - pts[pts.length - 1].x, z - pts[pts.length - 1].z));
    if (dEnd < 9) h = Math.max(h, W + 1.4 + (1 - _sstep(5, 9, dEnd)) * 0.3);
    for (var r = 0; r < rivers.length; r++) {
      var R = rivers[r], along = (x - R.x) * R.nx + (z - R.z) * R.nz;   // distance across the river
      var aw = Math.abs(along + Math.sin((x * R.nz - z * R.nx) * 0.08) * 1.5);
      var bankW = 3 + Math.max(0, h - W) * 1.6;   // a valley, not a gorge: the higher the hill, the wider the slope
      if (aw < R.w + bankW) { var bed = W - 1.6; h = Math.min(h, bed + (h - bed) * _sstep(R.w, R.w + bankW, aw)); }
    }
    return h;
  }
  // Terraces: crisp 1 m ledges you hop up
  // (only the Cascades keep them — everywhere else the hills roll naturally)
  function post(h) { if (h < W + 0.2) return h; var f = Math.floor(h), fr = h - f; return f + _sstep(0.8, 1.0, fr); }
  if (!cfg.falls) post = null;
  c.rivers = rivers;
  var minX = -70 - 25, maxX = 70 + 25, minZ = -L - 50, maxZ = 50;
  c.setHeightfield(minX, maxX, minZ, maxZ, 1.0, base, post);
  c.bounds = { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ };
  c.route = pts.map(function(p) { return { x: p.x, y: c.heightAt(p.x, p.z), z: p.z }; });

  // Terrain mesh with height/slope colouring
  LV.terrainMesh(c, hole, cfg, minX, maxX, minZ, maxZ, 1.0);

  // River crossings: bridge early, stones later
  // Crossings follow the fairway: from each river walk back and forward along the route
  // to the first dry ground above the highest tide. Rivers whose water merges (the canyon)
  // share one crossing, so every bridge starts and ends on a bank you can walk to.
  var deck = W + (c.tideMax || 0) + 0.9, Lr = LV._polyLen(pts), dt = 0.3 / Lr, spans = [];
  rivers.slice().sort(function(a, b) { return a.t - b.t; }).forEach(function(R) {
    if (spans.some(function(sp) { return R.t >= sp.t0 && R.t <= sp.t1; })) return;   // already crossed
    var dry = function(t) { var q = LV.pointAt(pts, t); return c.heightAt(q.x, q.z) >= deck; };
    var t0 = R.t, t1 = R.t;
    while (t0 > 0.02 && !dry(t0)) t0 -= dt;
    while (t1 < 0.98 && !dry(t1)) t1 += dt;
    spans.push({ t0: t0, t1: t1 });
  });
  // Route corners (as t) — crossings break there so every section lies exactly on the fairway
  var cornerT = [], accL = 0;
  for (var ci = 1; ci < pts.length - 1; ci++) { accL += Math.hypot(pts[ci].x - pts[ci - 1].x, pts[ci].z - pts[ci - 1].z); cornerT.push(accL / Lr); }
  spans.forEach(function(sp) {
    var ts = [sp.t0];
    cornerT.forEach(function(ct) { if (ct > sp.t0 + 0.5 / Lr && ct < sp.t1 - 0.5 / Lr) ts.push(ct); });
    ts.push(sp.t1);
    if (d < 0.25) {
      for (var k = 0; k < ts.length - 1; k++) {
        // long straight runs are split too, so the decks stay short and sturdy-looking
        var segL = (ts[k + 1] - ts[k]) * Lr, m = Math.max(1, Math.ceil(segL / 16));
        for (var j = 0; j < m; j++) {
          var A = LV.pointAt(pts, ts[k] + (ts[k + 1] - ts[k]) * j / m), B = LV.pointAt(pts, ts[k] + (ts[k + 1] - ts[k]) * (j + 1) / m);
          var ux = B.x - A.x, uz = B.z - A.z, ul = Math.hypot(ux, uz) || 1, first = k === 0 && j === 0, last = k === ts.length - 2 && j === m - 1;
          // sections overlap a little at the joints so there's no gap at a bend
          var e0 = first ? 0 : 0.9, e1 = last ? 0 : 0.9;
          LV.bridge(c, A.x - ux / ul * e0, A.z - uz / ul * e0, deck, B.x + ux / ul * e1, B.z + uz / ul * e1, deck, 2.4, { sag: (ts.length > 2 || m > 1) ? 0 : undefined });
        }
      }
    } else {
      var spanL = (sp.t1 - sp.t0) * Lr, A2 = LV.pointAt(pts, sp.t0), B2 = LV.pointAt(pts, sp.t1);
      LV.stones(c, A2.x, A2.z, deck, B2.x, B2.z, deck, d, { bob: hole.mods.indexOf("restless") >= 0, bottom: W - 3, len: spanL,
        at: function(f) { return LV.pointAt(pts, sp.t0 + (sp.t1 - sp.t0) * f); } });
    }
  });
  // Waterfalls pouring off the terrace cliffs beside the fairway
  if (stream) LV.cascade(c, stream);

  // Grass + flowers along the fairway
  LV.grass(c, hole, pts, fw + 4, 9000);

  // Tee & basket
  var t0 = LV.pointAt(pts, 0.035), tb = pts[pts.length - 1];
  LV.tee(c, t0.x, c.heightAt(t0.x, t0.z), t0.z, LV.pointAt(pts, 0.12));
  c.basket = { x: tb.x, y: c.heightAt(tb.x, tb.z), z: tb.z };
  // Flatten-check: keep the basket off a ledge by nudging along the route if needed
  spawns.push({ kind: "fairway", pts: pts, fw: fw });
  LV.dressMeadow(c, hole, pts, fw, rivers);
  c.backdrop = true;
};

// ── Set dressing along the fairway: no more empty lawns ──────────────────────
// Bushes, small trees, fences, hay bales, flower drifts, mushrooms, rocks — chosen per
// world, scattered in clumps beside the fairway (never on it), merged into one swaying mesh.
LV.dressMeadow = function(c, hole, pts, fw, rivers) {
  var th = hole.theme, rnd = _gfxRng(((hole.n || 1) * 6151 + 3) >>> 0), W = c.hazard.level;
  var kit = {
    village:      { bush: 3, tree: 2, fence: 1.2, hay: 1, flowers: 2, rock: 1 },
    vetschool:    { bush: 3, tree: 2, flowers: 3, rock: 0.5, hedge: 1 },
    cabbage:      { bush: 2, tree: 1, hay: 1.5, fence: 1, cabbage: 3, rock: 1 },
    feet_bunnies: { bush: 2, tree: 1.5, flowers: 5, mushroom: 2, rock: 0.5 },
    socks_basket: { bush: 2, tree: 1.5, flowers: 3, hedge: 1.5, rock: 0.5 },
    mountains:    { pine: 3, rock: 3, bush: 1, flowers: 1 },
    winter:       { snowpine: 3, rock: 2 },
    grandcanyon:  { shrub: 3, rock: 3 },
    waterfall:    { bush: 3, tree: 1.5, rock: 2, flowers: 2, fern: 2 },
  }[th];
  if (!kit) return;
  var kinds = Object.keys(kit), tot = kinds.reduce(function(a, k) { return a + kit[k]; }, 0);
  var parts = [], col = function(g, hex, v) { var cc = new THREE.Color(hex).multiplyScalar(v || 1), n = g.attributes.position.count, a = new Float32Array(n * 3); for (var i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; };
  var ground = 0;   // ground height of the item being placed (sway bends by height above it)
  var put = function(g, hex, x, y, z, v) {
    g = g.index ? g.toNonIndexed() : g;
    g.translate(x, y, z);
    var pa = g.attributes.position, sw = new Float32Array(pa.count); for (var i = 0; i < pa.count; i++) sw[i] = Math.max(0, pa.getY(i) - ground);
    g.setAttribute("aSway", new THREE.BufferAttribute(sw, 1));
    parts.push(col(g, hex, v || (0.85 + rnd() * 0.3)));
  };
  var leaf = { village: 0x3f7a2a, vetschool: 0x3a7a34, cabbage: 0x4a7a26, feet_bunnies: 0x4a9a3a, socks_basket: 0x4a9040, mountains: 0x3a6a2a, waterfall: 0x2f7a2a }[th] || 0x3f7a2a;
  var flowerCols = th === "feet_bunnies" ? [0xff7ab8, 0xffb0d8, 0xffffff, 0xd88aff] : [0xffd23a, 0xff5a5a, 0xffffff, 0xb46aff, 0xff9a3a];
  var L = LV._polyLen(pts), n = Math.round(L * 1.9);
  var free = function(x, z) {
    var pd = LV.polyDist(pts, x, z); if (pd.d < fw + 2.5) return false;
    var g = c.heightAt(x, z); if (!(g > W + 0.4) || (c.supportAt(x, z).solid)) return false;
    if (Math.abs(c.heightAt(x + 1, z) - g) + Math.abs(c.heightAt(x, z + 1) - g) > 1.2) return false;   // not on steep slopes
    if (Math.hypot(x - c.tee.x, z - c.tee.z) < 7 || Math.hypot(x - pts[pts.length - 1].x, z - pts[pts.length - 1].z) < 6) return false;
    return true;
  };
  for (var i = 0; i < n; i++) {
    var p = LV.pointAt(pts, rnd()), side = rnd() < 0.5 ? -1 : 1, off = fw + 3 + Math.pow(rnd(), 1.6) * 26;
    var cx = p.x - p.dz * off * side, cz = p.z + p.dx * off * side;
    var r = rnd() * tot, kind = kinds[0]; for (var q = 0; q < kinds.length; q++) { r -= kit[kinds[q]]; if (r <= 0) { kind = kinds[q]; break; } }
    var clump = kind === "fence" || kind === "hedge" ? 1 : 1 + Math.floor(rnd() * 3);
    for (var k = 0; k < clump; k++) {
      var x = cx + (rnd() - 0.5) * 3, z = cz + (rnd() - 0.5) * 3;
      if (!free(x, z)) continue;
      var y = c.heightAt(x, z) - 0.05, s = 0.8 + rnd() * 0.5, yaw = rnd() * 6.28, g; ground = y;
      switch (kind) {
        case "bush": for (var b = 0; b < 3; b++) { g = new THREE.IcosahedronGeometry(0.45 * s * (0.7 + rnd() * 0.5), 0); g.scale(1, 0.8, 1); put(g, leaf, x + (rnd() - 0.5) * 0.7 * s, y + 0.35 * s, z + (rnd() - 0.5) * 0.7 * s); } break;
        case "tree": g = new THREE.CylinderGeometry(0.12 * s, 0.17 * s, 1.6 * s, 6); put(g, 0x5a3e26, x, y + 0.8 * s, z);
          for (var t2 = 0; t2 < 3; t2++) { g = new THREE.IcosahedronGeometry(0.9 * s * (0.7 + rnd() * 0.4), 0); put(g, leaf, x + (rnd() - 0.5) * 0.8 * s, y + (1.9 + rnd() * 0.6) * s, z + (rnd() - 0.5) * 0.8 * s); } break;
        case "pine": case "snowpine": g = new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 1 * s, 6); put(g, 0x5a3a22, x, y + 0.5 * s, z);
          [[1.1, 1.8, 1.4], [0.8, 1.5, 2.3], [0.5, 1.1, 3.0]].forEach(function(cn, ci) { var gg = new THREE.ConeGeometry(cn[0] * s, cn[1] * s, 7); put(gg, kind === "snowpine" && ci === 2 ? 0xeef4fa : 0x2f5a2a, x, y + cn[2] * s, z); }); break;
        case "rock": g = new THREE.DodecahedronGeometry(0.35 * s + rnd() * 0.4, 0); g.scale(1, 0.55 + rnd() * 0.3, 1); g.rotateY(yaw); put(g, th === "grandcanyon" ? 0xa8643a : th === "winter" ? 0x8a94a0 : 0x8a8478, x, y + 0.12, z); break;
        case "flowers": for (var f = 0; f < 7; f++) { g = new THREE.IcosahedronGeometry(0.07 + rnd() * 0.05, 0); put(g, flowerCols[Math.floor(rnd() * flowerCols.length)], x + (rnd() - 0.5) * 1.6, y + 0.2 + rnd() * 0.1, z + (rnd() - 0.5) * 1.6, 1); g = new THREE.CylinderGeometry(0.01, 0.01, 0.22, 3); put(g, 0x4a8a2a, x + (rnd() - 0.5) * 1.6, y + 0.1, z + (rnd() - 0.5) * 1.6); } break;
        case "mushroom": g = new THREE.CylinderGeometry(0.06, 0.08, 0.3, 6); put(g, 0xf4ece0, x, y + 0.15, z); g = new THREE.SphereGeometry(0.2, 8, 5, 0, 6.283, 0, 1.6); put(g, rnd() < 0.5 ? 0xd8302a : 0xc8a070, x, y + 0.28, z, 1); break;
        case "hay": g = new THREE.CylinderGeometry(0.55, 0.55, 1.1, 12); g.rotateZ(Math.PI / 2); g.rotateY(yaw); put(g, 0xd8b85a, x, y + 0.55, z); break;
        case "cabbage": for (var cb = 0; cb < 6; cb++) { g = new THREE.IcosahedronGeometry(0.28, 1); g.scale(1, 0.75, 1); var cx2 = x + Math.cos(yaw) * cb * 0.9, cz2 = z + Math.sin(yaw) * cb * 0.9; if (free(cx2, cz2)) put(g, 0x6aa83a, cx2, c.heightAt(cx2, cz2) + 0.15, cz2); } break;
        case "fence": case "hedge":
          var segs = 3 + Math.floor(rnd() * 4), fx = Math.cos(yaw), fz = Math.sin(yaw);
          for (var sI = 0; sI <= segs; sI++) {
            var px = x + fx * sI * 1.6, pz = z + fz * sI * 1.6; if (!free(px, pz)) break;
            var py = c.heightAt(px, pz);
            if (kind === "hedge") { g = new THREE.BoxGeometry(1.7, 0.9, 0.7); g.rotateY(-yaw); put(g, leaf, px, py + 0.45, pz, 0.85); }
            else { g = new THREE.BoxGeometry(0.12, 1.0, 0.12); put(g, 0x8a6a42, px, py + 0.5, pz); if (sI < segs) [0.35, 0.75].forEach(function(hh) { var rail = new THREE.BoxGeometry(1.6, 0.08, 0.05); rail.rotateY(-yaw); put(rail, 0x9a7a52, px + fx * 0.8, py + hh, pz + fz * 0.8); }); }
          } break;
        case "shrub": for (var sh2 = 0; sh2 < 5; sh2++) { g = new THREE.ConeGeometry(0.04, 0.5 + rnd() * 0.4, 3); g.rotateZ((rnd() - 0.5) * 0.9); g.rotateX((rnd() - 0.5) * 0.9); put(g, 0x8a7a4a, x, y + 0.25, z); } break;
        case "fern": for (var fe = 0; fe < 6; fe++) { g = new THREE.ConeGeometry(0.12, 0.9, 3); g.rotateZ(1.0); g.translate(0.4, 0, 0); g.rotateY(fe * 1.05 + rnd() * 0.3); put(g, 0x3a8a2a, x, y + 0.25, z); } break;
      }
    }
  }
  if (!parts.length) return;
  var mat = GFX._matCache.meadow || (GFX._matCache.meadow = GFX.addSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), 0.12, 4, true));
  mat.userData.shared = true;
  // one mesh per ~4000 parts keeps merges quick; world-space vertices: sway by height above sea level is fine here
  for (var o = 0; o < parts.length; o += 4000) {
    var chunk = parts.slice(o, o + 4000), merged = GFX.mergeGeometries(chunk), sw = new Float32Array(merged.attributes.position.count), off2 = 0;
    chunk.forEach(function(g) { sw.set(g.attributes.aSway.array, off2); off2 += g.attributes.position.count; });
    merged.setAttribute("aSway", new THREE.BufferAttribute(sw, 1));
    var m = new THREE.Mesh(merged, mat);
    m.castShadow = true; m.receiveShadow = true; m.userData.noBatch = true; c.group.add(m);
  }
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
  var m = typeof WORLD !== "undefined"
    ? WORLD.terrainMaterial(hole.theme, W, { play: { minX: minX, minZ: minZ, maxX: maxX, maxZ: maxZ } })   // same shader as the surrounding landscape → no seam
    : new THREE.MeshStandardMaterial({ vertexColors: true, map: st.map, bumpMap: st.bump || null, bumpScale: 0.03, roughness: 0.95 });
  var mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true; mesh.castShadow = true;
  c.group.add(mesh);
  return mesh;
};

LV.cascade = function(c, stream) {
  // sample the stream bed every 0.4 m
  var smp = [], W = c.hazard.level;
  for (var t = 0; t <= 1.0001; t += 0.4 / Math.max(1, LV._polyLen(stream))) {
    var p = LV.pointAt(stream, Math.min(1, t)), y = c.heightAt(p.x, p.z);
    if (y < W + 0.2) break;                                  // reached the river / lake
    smp.push({ x: p.x, z: p.z, dx: p.dx, dz: p.dz, y: y });
  }
  if (smp.length < 4) return;
  // water level: never rises downstream; a drop of more than 0.5 m becomes a waterfall
  var lvl = smp[0].y + 0.22, verts = [];   // {x,z,y,slope,dx,dz}
  for (var i = 0; i < smp.length; i++) {
    var s2 = smp[i], ground = s2.y + 0.22;
    if (ground < lvl - 0.5) {
      // A stack of small ledges close together falls as one: find the lowest point in the next ~2 m
      var j = i, lowest = ground;
      for (var q = i + 1; q < Math.min(smp.length, i + 6); q++) { var gq = smp[q].y + 0.22; if (gq < lowest - 0.3) { lowest = gq; j = q; } }
      var f = smp[j];
      // water shoots over the lip at the old level, then drops straight down
      verts.push({ x: s2.x, z: s2.z, y: lvl, slope: 0.6, dx: s2.dx, dz: s2.dz });
      verts.push({ x: f.x, z: f.z, y: lvl, slope: 1, dx: f.dx, dz: f.dz });
      verts.push({ x: f.x + f.dx * 0.05, z: f.z + f.dz * 0.05, y: lowest, slope: 1, dx: f.dx, dz: f.dz });
      LV.splash(c, f.x + f.dx * 0.6, lowest, f.z + f.dz * 0.6, lvl - lowest);
      lvl = lowest; i = j;
    } else {
      lvl = Math.min(lvl, ground);
      verts.push({ x: s2.x, z: s2.z, y: lvl, slope: 0, dx: s2.dx, dz: s2.dz });
    }
  }
  // ribbon geometry along the verts
  var pos = [], uv = [], sl = [], idx = [], dist = 0, w = 1.35;
  verts.forEach(function(v, k) {
    if (k) dist += Math.hypot(v.x - verts[k - 1].x, v.y - verts[k - 1].y, v.z - verts[k - 1].z);
    var px = -v.dz * w, pz = v.dx * w;
    pos.push(v.x + px, v.y, v.z + pz, v.x - px, v.y, v.z - pz);
    uv.push(0, dist / 3, 1, dist / 3); sl.push(v.slope, v.slope);
    if (k) { var a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("slope", new THREE.Float32BufferAttribute(sl, 1));
  g.setIndex(idx); g.computeVertexNormals();
  var m = new THREE.Mesh(g, LV.waterfallMat()); m.renderOrder = 2; m.userData.noBatch = true;
  c.group.add(m);
};
LV._polyLen = function(pts) { var l = 0; for (var i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return l; };
// Foam pool + spray where a fall lands
LV.splash = function(c, x, y, z, h) {
  var foam = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, map: GFX.softDotTexture(), transparent: true, opacity: 0.75, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(x, y + 0.05, z); foam.renderOrder = 3; c.group.add(foam);
  c.updaters.push(function(T) { var k = 1 + Math.sin(T * 7 + x) * 0.08; foam.scale.set(k, k, k); });
  LV.mist(c, x, y + 0.2, z, 1.2 + h * 0.15);
};
LV.waterfallMat = function() {
  if (LV._wfm) return LV._wfm;
  LV._wfm = new THREE.ShaderMaterial({
    uniforms: { time: GFX.time },
    vertexShader: "attribute float slope; varying vec2 vUv; varying float vS; void main(){ vUv = uv; vS = slope; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: [
      "uniform float time; varying vec2 vUv; varying float vS;",
      "float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }",
      "float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }",
      "void main(){",
      "  float speed = mix(0.6, 3.2, vS);",
      "  vec2 p = vec2(vUv.x * mix(3.0, 7.0, vS), vUv.y * mix(2.0, 1.2, vS) - time * speed);",
      "  float s = n(p * vec2(1.0, mix(1.0, 0.25, vS))) * 0.6 + n(p * vec2(2.3, 0.9) + 3.1) * 0.4;",
      "  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);",
      "  float foam = mix(smoothstep(0.62, 0.9, s) * 0.7, smoothstep(0.35, 0.75, s) + 0.25, vS) + (1.0 - edge) * 0.35;",
      "  vec3 deep = vec3(0.12, 0.42, 0.55), lite = vec3(0.45, 0.78, 0.88);",
      "  vec3 col = mix(mix(deep, lite, s * 0.6 + vS * 0.3), vec3(0.96, 0.99, 1.0), clamp(foam, 0.0, 1.0));",
      "  float a = mix(0.82, 0.72 + foam * 0.25, vS) * mix(0.55, 1.0, edge);",
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
