"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── ITEMS ────────────────────────────────────────────────────────────────────
// Purple Mystery Bags sit along the fairway. Run into one to roll an item (the
// further you are from the basket, the meaner the roll). Carry up to three:
//   F use · G next item · 1-3 pick a slot (while walking)
// Every effect is broadcast as a small "it" event; area effects are checked by
// each player against their own position (see battle.js for the KO rules).
// ══════════════════════════════════════════════════════════════════════════════
var ITEMS = {
  coffee:  { icon: "☕", name: "Espresso",      desc: "10 s of turbo legs",                               w: 12, color: 0xc8823a, kind: "move" },
  springs: { icon: "🦘", name: "Spring Boots",  desc: "3 mega leaps",                                     w: 10, color: 0x3af0ff, kind: "move", uses: 3 },
  bat:     { icon: "🏏", name: "Bonk Bat",      desc: "20 s — swing to knock rivals out",                 w: 9,  color: 0xff8a3a, kind: "melee", dur: 20 },
  poop:    { icon: "💩", name: "Poop Army",     desc: "Six poops chase the nearest rival",                w: 6,  color: 0xa0683a, kind: "attack" },
  horn:    { icon: "📯", name: "Air Horn",      desc: "Wrecks the aim of everyone within 18 m",           w: 9,  color: 0xffd23a, kind: "attack" },
  mines:   { icon: "💣", name: "Sticky Mines",  desc: "Drop 3 traps — anyone stepping on one goes boom",  w: 9,  color: 0xff3a3a, kind: "trap", uses: 3 },
  dart:    { icon: "🔫", name: "Dart Blaster",  desc: "One long-range knockout shot",                     w: 9,  color: 0x8aff6a, kind: "attack" },
  rocket:  { icon: "🚀", name: "Homing Rocket", desc: "Locks on to the nearest rival",                    w: 8,  color: 0xff5a3a, kind: "attack" },
  magnet:  { icon: "🧲", name: "Magnet Shield", desc: "6 s — blocks every hit",                           w: 8,  color: 0x6ad8ff, kind: "defend" },
  freeze:  { icon: "❄️", name: "Freeze Bomb",   desc: "Lob it — freezes everyone it lands near",          w: 6,  color: 0xbfeaff, kind: "attack" },
  fire:    { icon: "🔥", name: "Fireball Disc", desc: "Next throw flies 40% further and bowls people over", w: 6, color: 0xff7a1a, kind: "move" },
  laser:   { icon: "🛰️", name: "Orbital Laser", desc: "Calls a strike down on the leader",                w: 2,  color: 0xff3aff, kind: "attack" },
};
var POWERUPS = ITEMS;   // legacy name
var PU = { tokens: [], active: {}, inv: [], sel: 0, poops: [], rockets: [], mines: [], bombs: [], lasers: [], batCd: 0, swingT: 0, fireNext: false, fireThrow: false, _seq: 0, MAX: 3 };

PU.speedMul = function() { return PU.active.speed > T ? 1.65 : 1; };
PU.jumpMul = function() { return 1; };
PU.cur = function() { return PU.inv[PU.sel] || null; };

// ── Shared models (one geometry / material per kind — cheap to spawn) ───────
PU._c = {};
PU._get = function(k, make) { if (!PU._c[k]) { PU._c[k] = make(); if (PU._c[k].userData) PU._c[k].userData.shared = true; } return PU._c[k]; };
PU._qTex = function() {
  return PU._get("qtex", function() {
    var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d");
    g.fillStyle = "#7a2ad8"; g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#b46aff"; for (var i = 0; i < 128; i += 16) g.fillRect(i, 0, 8, 128);
    g.font = "bold 92px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 10; g.strokeStyle = "#2a0a5a"; g.strokeText("?", 64, 70); g.fillStyle = "#ffe14a"; g.fillText("?", 64, 70);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t._dgShared = true; return t;
  });
};
PU.bagModel = function() {
  var g = new THREE.Group();
  var body = new THREE.Mesh(PU._get("bagGeo", function() { return new THREE.BoxGeometry(0.9, 0.62, 0.36); }),
    PU._get("bagMat", function() { var m = new THREE.MeshStandardMaterial({ map: PU._qTex(), emissive: new THREE.Color(0x5a1aa8), emissiveIntensity: 0.55, roughness: 0.4 }); m.userData.shared = true; return m; }));
  body.castShadow = true; g.add(body);
  var trim = PU._get("trimMat", function() { var m = new THREE.MeshStandardMaterial({ color: 0xffd23a, metalness: 0.8, roughness: 0.3 }); m.userData.shared = true; return m; });
  var handle = new THREE.Mesh(PU._get("handleGeo", function() { return new THREE.TorusGeometry(0.16, 0.035, 8, 16, Math.PI); }), trim); handle.position.y = 0.31; g.add(handle);
  [-1, 1].forEach(function(s) { var c = new THREE.Mesh(PU._get("cornerGeo", function() { return new THREE.BoxGeometry(0.08, 0.64, 0.38); }), trim); c.position.x = s * 0.42; g.add(c); });
  var halo = new THREE.Sprite(PU._get("haloMat", function() { var m = new THREE.SpriteMaterial({ map: GFX.softDotTexture(), color: 0xb46aff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }); m.userData.shared = true; return m; }));
  halo.scale.setScalar(2.2); g.add(halo);
  var ring = new THREE.Mesh(PU._get("ringGeo", function() { return new THREE.TorusGeometry(0.62, 0.03, 8, 40); }), PU._get("ringMat", function() { var m = new THREE.MeshBasicMaterial({ color: 0xd8a0ff, transparent: true, opacity: 0.8 }); m.userData.shared = true; return m; }));
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.9; g.add(ring); g.userData.ring = ring;
  return g;
};
PU.batMesh = function() {
  var g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0xc8925a, roughness: 0.55 }), grip = new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.8 });
  var pts = [[0.03, -0.55], [0.035, -0.2], [0.05, 0.05], [0.085, 0.3], [0.095, 0.5], [0.07, 0.56], [0.0, 0.57]].map(function(p) { return new THREE.Vector2(p[0], p[1]); });
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 14), wood));
  var gr = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.3, 10), grip); gr.position.y = -0.38; g.add(gr);
  var knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), grip); knob.position.y = -0.56; g.add(knob);
  g.traverse(function(m) { if (m.isMesh) m.castShadow = true; });
  return g;
};
PU.poopMesh = function(sc) {
  var g = new THREE.Group(), m = PU._get("poopMat", function() { var mm = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.45 }); mm.userData.shared = true; return mm; });
  [[0.0, 0.12, 0.34], [0.0, 0.32, 0.26], [0.0, 0.49, 0.17]].forEach(function(t) { var tor = new THREE.Mesh(PU._get("poopT" + t[2], function() { return new THREE.TorusGeometry(t[2], t[2] * 0.55, 10, 20); }), m); tor.rotation.x = Math.PI / 2; tor.position.y = t[1]; g.add(tor); });
  var tip = new THREE.Mesh(PU._get("poopTip", function() { return new THREE.ConeGeometry(0.1, 0.16, 10); }), m); tip.position.y = 0.62; tip.rotation.z = 0.4; g.add(tip);
  var wh = PU._get("eyeW", function() { var mm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }); mm.userData.shared = true; return mm; }), bk = PU._get("eyeB", function() { var mm = new THREE.MeshBasicMaterial({ color: 0x111111 }); mm.userData.shared = true; return mm; });
  [-1, 1].forEach(function(s) { var e = new THREE.Mesh(PU._get("eyeGeo", function() { return new THREE.SphereGeometry(0.07, 10, 8); }), wh); e.position.set(s * 0.1, 0.36, 0.25); g.add(e); var p = new THREE.Mesh(PU._get("pupGeo", function() { return new THREE.SphereGeometry(0.035, 8, 6); }), bk); p.position.set(s * 0.1, 0.36, 0.31); g.add(p); });
  g.scale.setScalar(sc || 1);
  g.traverse(function(o) { if (o.isMesh) o.castShadow = true; });
  return g;
};
PU.rocketMesh = function() {
  var g = new THREE.Group();
  var red = PU._get("rkRed", function() { var m = new THREE.MeshStandardMaterial({ color: 0xe8302a, roughness: 0.4, metalness: 0.3 }); m.userData.shared = true; return m; });
  var wh = PU._get("rkWh", function() { var m = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4 }); m.userData.shared = true; return m; });
  var b = new THREE.Mesh(PU._get("rkBody", function() { var gg = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 12); gg.rotateX(Math.PI / 2); return gg; }), wh); g.add(b);
  var n = new THREE.Mesh(PU._get("rkNose", function() { var gg = new THREE.ConeGeometry(0.12, 0.3, 12); gg.rotateX(Math.PI / 2); gg.translate(0, 0, 0.5); return gg; }), red); g.add(n);
  for (var i = 0; i < 3; i++) { var f = new THREE.Mesh(PU._get("rkFin", function() { return new THREE.BoxGeometry(0.02, 0.22, 0.2); }), red); f.position.z = -0.28; f.rotation.z = i * 2.09; f.translateY(0.14); g.add(f); }
  return g;
};
PU.mineMesh = function() {
  var g = new THREE.Group();
  g.add(new THREE.Mesh(PU._get("mnBody", function() { return new THREE.CylinderGeometry(0.32, 0.36, 0.14, 16); }), PU._get("mnMat", function() { var m = new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.6, roughness: 0.4 }); m.userData.shared = true; return m; })));
  var led = new THREE.Mesh(PU._get("mnLed", function() { return new THREE.SphereGeometry(0.07, 10, 8); }), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  led.position.y = 0.1; g.add(led); g.userData.led = led;
  return g;
};

// ── Placement (deterministic, so every player sees the same bags) ────────────
function spawnPowerups(hole, idx) {
  PU.clearWorld();
  PU.tokens = []; PU.active = {}; PU.inv = []; PU.sel = 0; PU.fireNext = PU.fireThrow = false; PU.attachBat(false);
  powerupMeshes = [];
  var setting = mpMode && typeof BT !== "undefined" ? BT.items : "normal";
  if (setting === "off" || (!mpMode && idx < 1)) { PU.renderHud(); return; }   // first single-player hole is calm
  var C = hole.course, len = C.route && C.route.length > 1 ? LV._polyLen(C.route) : 90;
  var count = Math.max(3, Math.min(8, Math.round(len / 22))) + (mpMode ? 1 : 0);
  if (setting === "chaos") count = Math.round(count * 1.7);
  for (var i = 0, tries = 0; i < count && tries < 60; tries++) {
    var wp = LV.pointAt(C.route, 0.1 + srng() * 0.8);
    var px = wp.x + (srng() - 0.5) * 8, pz = wp.z + (srng() - 0.5) * 8, ty = C.heightAt(px, pz);
    if (ty < C.hazardAt(px, pz).level + 0.3) continue;
    if (C.ceiling && ty + 2.4 > C.ceiling) continue;
    var g = PU.bagModel(); g.position.set(px, ty + 1.05, pz);
    courseGrp.add(g);
    PU.tokens.push({ i: i, x: px, y: ty, z: pz, mesh: g, taken: false, back: 0 });
    i++;
  }
  PU.renderHud();
}
PU.clearWorld = function() {
  [PU.poops, PU.rockets, PU.mines, PU.bombs, PU.lasers].forEach(function(arr) { arr.forEach(function(o) { PU._drop(o); }); arr.length = 0; });
};
PU._drop = function(o) { [o.mesh, o.ring, o.beam, o.trail].forEach(function(m) { if (m && m.parent) m.parent.remove(m); }); };

// ── Pickup: run / dive into a bag ────────────────────────────────────────────
function checkPowerupCollection() {
  if (phase !== "WALKING" || PL.respawnT > 0) return;
  PU.tokens.forEach(function(p) {
    if (p.taken) return;
    var r = typeof BT !== "undefined" && BT.diveT > 0 ? 1.9 : 1.3;
    if (Math.hypot(PL.pos.x - p.x, PL.pos.z - p.z) < r && Math.abs(PL.pos.y - p.y) < 2.2) {
      if (PU.inv.length >= PU.MAX) { if (!p._full || T - p._full > 2) { p._full = T; _flashPrompt("Your bag is full — use an item first (F)"); } return; }
      PU.takeToken(p, true);
      if (mpMode) sendToAll({ t: "pu_take", h: holeIdx, i: p.i });
    }
  });
}
PU.takeToken = function(p, mine) {
  p.taken = true; p.back = T + (typeof BT !== "undefined" && BT.items === "chaos" ? 10 : 18);
  p.mesh.visible = false;
  spawnParticleBurst(new THREE.Vector3(p.x, p.y + 1.1, p.z), new THREE.Color(0xb46aff), 22);
  if (!mine) return;
  var type = PU.roll();
  PU.inv.push({ type: type, uses: ITEMS[type].uses || 1, until: Infinity });
  PU.sel = PU.inv.length - 1;
  PU.banner(ITEMS[type].icon + " " + ITEMS[type].name + " — " + ITEMS[type].desc);
  AudioEngine.sfx("powerup");
  PU.renderHud();
};
// Catch-up odds: trailing players roll more attack items, the leader more defence
PU.roll = function() {
  var me = Math.hypot(PL.pos.x - basketBase.x, PL.pos.z - basketBase.z), ahead = 0, n = 0;
  if (mpMode) remotePlayers.forEach(function(rp) { if (!rp || !rp.body) return; n++; if (Math.hypot(rp.body.x - basketBase.x, rp.body.z - basketBase.z) < me) ahead++; });
  var r = n ? ahead / n : 0.5, list = [], tot = 0;
  Object.keys(ITEMS).forEach(function(k) {
    var I = ITEMS[k], w = I.w;
    if (I.kind === "attack" || I.kind === "move") w *= 0.55 + 1.2 * r;
    if (I.kind === "defend" || I.kind === "trap") w *= 1.3 - 0.6 * r;
    if (k === "laser") w *= mpMode ? 0.4 + 2.2 * r : 0.6;
    list.push([k, w]); tot += w;
  });
  var x = Math.random() * tot;
  for (var i = 0; i < list.length; i++) { x -= list[i][1]; if (x <= 0) return list[i][0]; }
  return "coffee";
};
PU.banner = function(txt) {
  var b = document.getElementById("powerup-banner"); if (!b) return;
  b.textContent = txt; b.style.display = "block"; b.style.opacity = "1";
  clearTimeout(PU._bt); PU._bt = setTimeout(function() { b.style.opacity = "0"; }, 2600);
};

// ── Using items ──────────────────────────────────────────────────────────────
PU.cycle = function(dir) { if (PU.inv.length < 2) return; PU.sel = (PU.sel + (dir || 1) + PU.inv.length) % PU.inv.length; AudioEngine.sfx("swipe", 0.3); PU.renderHud(); };
PU.select = function(i) { if (i < PU.inv.length) { PU.sel = i; PU.renderHud(); } };
PU.consume = function() {
  var it = PU.cur(); if (!it) return;
  if (--it.uses <= 0) { PU.inv.splice(PU.sel, 1); PU.sel = Math.max(0, Math.min(PU.sel, PU.inv.length - 1)); }
  PU.renderHud();
};
// Direction the player is facing for aimed items: the throw line while aiming, the camera while walking
PU.aimDir = function() {
  if (phase === "AIMING") return { x: Math.sin(aimAngle), z: -Math.cos(aimAngle) };
  return { x: Math.sin(PL.camYaw), z: -Math.cos(PL.camYaw) };
};
PU.canAct = function() {
  if (phase === "MENU" || !HOLES[holeIdx] || (typeof introT !== "undefined" && introT > 0)) return false;
  if (typeof BT !== "undefined" && BT.locked()) return false;
  if (phase === "SCORED" && !(typeof BT !== "undefined" && BT.finished)) return false;
  return true;
};
PU.useItem = function() {
  var it = PU.cur(); if (!it || !PU.canAct()) return;
  var t = it.type, me = PL.pos, d = PU.aimDir();
  if (it.bat) { PU.swing(); return; }
  switch (t) {
    case "coffee": PU.active.speed = T + 10; PU.banner("☕ Espresso — go go go!"); AudioEngine.sfx("powerup"); break;
    case "springs":
      if (phase === "AIMING") startWalking(false);
      if (phase !== "WALKING" || (typeof VEH !== "undefined" && VEH.mySeat)) return;
      var f = phase === "WALKING" && PL._input().mag > 0.1 ? PL._input() : { x: Math.sin(PL.yaw), z: Math.cos(PL.yaw) };
      PL.vel.set(f.x * 15, 13.5, f.z * 15); PL.onGround = false; PL.yaw = Math.atan2(f.x, f.z);
      PL._setAnim("jump"); AudioEngine.sfx("boing");
      spawnParticleBurst(me.clone(), new THREE.Color(0x3af0ff), 14);
      break;
    case "bat": it.bat = true; it.uses = 1; it.until = T + ITEMS.bat.dur; PU.attachBat(true); PU.banner("🏏 Bat out — F to swing!"); PU.renderHud(); return;
    case "poop": PU.poopArmy(myIdx, PU.nearestRival(), me.x, me.z, true); break;
    case "horn": PU.send({ k: "horn", o: myIdx, x: me.x, y: me.y, z: me.z }); break;
    case "mines": PU.send({ k: "mine", id: PU.id(), o: myIdx, x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2) }); break;
    case "dart": PU.fireDart(d); break;
    case "rocket": PU.send({ k: "rocket", id: PU.id(), o: myIdx, tg: PU.rocketTarget(d), x: me.x, y: me.y + 1.6, z: me.z, dx: d.x, dz: d.z }); break;
    case "magnet": PU.send({ k: "shield", o: myIdx, d: 6 }); break;
    case "freeze": PU.send({ k: "freeze", id: PU.id(), o: myIdx, x: me.x, y: me.y + 1.6, z: me.z, vx: +(d.x * 13).toFixed(2), vy: 7.5, vz: +(d.z * 13).toFixed(2) }); break;
    case "fire": PU.fireNext = true; PU.banner("🔥 Fireball armed — your next throw is on fire!"); AudioEngine.sfx("powerup"); break;
    case "laser": PU.send({ k: "laser", id: PU.id(), o: myIdx, tg: PU.laserTarget() }); break;
  }
  PU.consume();
};
PU.id = function() { return myIdx * 100000 + (++PU._seq); };
// Broadcast an item event and run it locally
PU.send = function(m) { if (mpMode) sendToAll(Object.assign({ t: "it" }, m)); PU.onNet(m); };

PU.nearestRival = function() {
  var best = -1, bd = Infinity;
  if (mpMode) remotePlayers.forEach(function(rp, i) { if (!rp || !rp.body) return; var d = Math.hypot(rp.body.x - PL.pos.x, rp.body.z - PL.pos.z); if (d < bd) { bd = d; best = i; } });
  return best;   // -1 → critters
};
PU.rocketTarget = function(d) {
  var best = -1, bs = -Infinity;
  if (mpMode) remotePlayers.forEach(function(rp, i) {
    if (!rp || !rp.body) return;
    var dx = rp.body.x - PL.pos.x, dz = rp.body.z - PL.pos.z, dist = Math.hypot(dx, dz) || 1, dot = (dx * d.x + dz * d.z) / dist;
    var s = dot * 30 - dist; if (s > bs) { bs = s; best = i; }
  });
  return best;
};
PU.laserTarget = function() {
  if (!mpMode) return -1;
  var best = -1, bv = -Infinity;
  remotePlayers.forEach(function(rp, i) {
    if (!rp || !rp.body) return;
    var v = typeof BT !== "undefined" && BT.on() ? BT.pts[i] * 10 - Math.hypot(rp.body.x - basketBase.x, rp.body.z - basketBase.z) : -Math.hypot(rp.body.x - basketBase.x, rp.body.z - basketBase.z);
    if (v > bv) { bv = v; best = i; }
  });
  return best;
};
PU.critterNear = function(x, z, r) {
  var best = null, bd = r || 40;
  if (typeof ENT === "undefined" || ENT.isGuest()) return null;
  ENT.list.forEach(function(o) { if (!o.update || o.h > 4 || o.type === "pole" || o.fly) return; var d = Math.hypot(o.x - x, o.z - z); if (d < bd) { bd = d; best = o; } });
  return best;
};
PU.critterBlast = function(x, z, r, f) {
  if (typeof ENT === "undefined" || ENT.isGuest()) return;
  ENT.list.forEach(function(o) { if (!o.update || o.h > 4 || o.type === "pole") return; var dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz); if (d < r) ENT.launch(o, dx / (d || 1) * f, f * 0.8, dz / (d || 1) * f); });
};
// Anyone (me) inside a blast gets knocked out by its owner
PU.blastMe = function(x, y, z, r, owner, cause, f) {
  if (phase === "MENU" || PL.respawnT > 0) return;
  var dx = PL.pos.x - x, dz = PL.pos.z - z, d = Math.hypot(dx, dz);
  if (d > r || Math.abs(PL.pos.y + 0.9 - y) > r + 1) return;
  if (typeof BT !== "undefined") BT.receiveHit({ by: owner, c: cause, dx: dx || 0.01, dz: dz || 0.01, f: f || 14, u: 10 });
};

// ── Bat ──────────────────────────────────────────────────────────────────────
PU.attachBat = function(on) {
  if (PU._batHeld && PU._batHeld.parent) PU._batHeld.parent.remove(PU._batHeld);
  PU._batHeld = null;
  if (on && localAvatarMesh) {
    var b = PU.batMesh(); b.position.set(0.42, 1.05, 0.1); b.rotation.set(-0.5, 0, -0.35);
    localAvatarMesh.add(b); PU._batHeld = b;
  }
};
PU.swing = function() {
  if (PU.batCd > 0) return;
  PU.batCd = 0.7; PU.swingT = 0.35;
  AudioEngine.sfx("swipe");
  var fx = Math.sin(PL.yaw), fz = Math.cos(PL.yaw), hit = false;
  if (mpMode) remotePlayers.forEach(function(rp, i) {
    if (!rp || !rp.body) return;
    var dx = rp.body.x - PL.pos.x, dz = rp.body.z - PL.pos.z, d = Math.hypot(dx, dz);
    if (d < 2.8 && (dx * fx + dz * fz) / (d || 1) > -0.2 && Math.abs(rp.body.y - PL.pos.y) < 2) {
      BT.hit(i, "bat", dx, dz, 19, 13);
      _spawnBonkText(rp.body.clone().add(new THREE.Vector3(0, 2.2, 0)), "HOME RUN!"); hit = true;
    }
  });
  if (!ENT.isGuest()) ENT.list.forEach(function(o) {
    if (!o.update || o.type === "pole" || o.h > 4) return;
    var dx = o.x - PL.pos.x, dz = o.z - PL.pos.z, d = Math.hypot(dx, dz);
    if (d < 2.6 + (o.r || 0) && (dx * fx + dz * fz) / (d || 1) > -0.2) { ENT.launch(o, dx / (d || 1) * 13, 11, dz / (d || 1) * 13); hit = true; }
  });
  if (hit) { AudioEngine.sfx("bonk"); _screenShake = 0.3; _screenShakeT = 0.3; }
};
// Legacy message from older clients
PU.batHit = function(dx, dz) { BT.receiveHit({ by: -1, c: "bat", dx: dx, dz: dz, f: 19, u: 13 }); };

// ── Dart blaster: hitscan with a little aim assist ───────────────────────────
PU.fireDart = function(d) {
  var o = new THREE.Vector3(PL.pos.x, PL.pos.y + 1.5, PL.pos.z), best = -1, bestDot = Math.cos(0.17), bestD = 75;
  if (mpMode) remotePlayers.forEach(function(rp, i) {
    if (!rp || !rp.body) return;
    var dx = rp.body.x - o.x, dz = rp.body.z - o.z, dist = Math.hypot(dx, dz) || 1, dot = (dx * d.x + dz * d.z) / dist;
    if (dist < bestD && dot > bestDot) { bestDot = dot; best = i; }
  });
  var crit = null, end;
  if (best >= 0) { var b = remotePlayers[best].body; end = new THREE.Vector3(b.x, b.y + 1.2, b.z); BT.hit(best, "dart", d.x, d.z, 12, 8); }
  else {
    crit = PU.critterNear(o.x + d.x * 20, o.z + d.z * 20, 22);
    end = crit ? new THREE.Vector3(crit.x, crit.y + 0.6, crit.z) : o.clone().add(new THREE.Vector3(d.x * 60, 0, d.z * 60));
    if (crit) ENT.launch(crit, d.x * 12, 9, d.z * 12);
  }
  PU.send({ k: "dart", o: myIdx, x: +o.x.toFixed(2), y: +o.y.toFixed(2), z: +o.z.toFixed(2), x2: +end.x.toFixed(2), y2: +end.y.toFixed(2), z2: +end.z.toFixed(2) });
};

// ── Network + world effects ──────────────────────────────────────────────────
PU.onNet = function(m) {
  var C = HOLES[holeIdx] && HOLES[holeIdx].course; if (!C) return;
  var mine = m.o === myIdx;
  switch (m.k) {
    case "horn": {
      AudioEngine.sfx("honk"); PU.shockwave(m.x, m.y, m.z, 18, 0xffd23a);
      if (!mine) {
        var d = Math.hypot(PL.pos.x - m.x, PL.pos.z - m.z);
        if (d < 18) PU.horned(m.o);
      }
      if (!ENT.isGuest()) PU.critterBlast(m.x, m.z, 10, 5);
      break;
    }
    case "mine": {
      var mm = PU.mineMesh(); mm.position.set(m.x, C.heightAt(m.x, m.z) + 0.05, m.z); courseGrp.add(mm);
      PU.mines.push({ id: m.id, o: m.o, x: m.x, y: mm.position.y, z: m.z, mesh: mm, armAt: T + 1.0, t0: T });
      while (PU.mines.length > 12) PU._drop(PU.mines.shift());
      AudioEngine.sfx("step", 0.8);
      break;
    }
    case "mboom": PU.mineBoom(m.id); break;
    case "dart": PU.tracer(m.x, m.y, m.z, m.x2, m.y2, m.z2); AudioEngine.sfx("zap"); break;
    case "rocket": {
      var rm = PU.rocketMesh(); rm.position.set(m.x, m.y, m.z); scene.add(rm);
      PU.rockets.push({ id: m.id, o: m.o, tg: m.tg, pos: new THREE.Vector3(m.x, m.y, m.z), vel: new THREE.Vector3(m.dx * 16, 4, m.dz * 16), life: 6, mesh: rm, smoke: 0, crit: null });
      AudioEngine.sfx("zap");
      if (m.tg === myIdx) _flashPrompt("🚀 A rocket is locked on you — dive (V) to dodge!");
      break;
    }
    case "boom": PU.boom(m.id, m.x, m.y, m.z); break;
    case "shield":
      if (mine) { BT.shieldT = m.d; BT.bubbleOn(localAvatarMesh, true); }
      else if (remotePlayers[m.o]) { remotePlayers[m.o].shieldT = m.d; BT.bubbleOn(remotePlayers[m.o].avatarMesh, true); }
      AudioEngine.sfx("powerup");
      break;
    case "freeze": {
      var bm = new THREE.Mesh(PU._get("fzGeo", function() { return new THREE.IcosahedronGeometry(0.28, 1); }), PU._get("fzMat", function() { var mt = new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: new THREE.Color(0x3a8aff), emissiveIntensity: 0.6, roughness: 0.2 }); mt.userData.shared = true; return mt; }));
      bm.position.set(m.x, m.y, m.z); scene.add(bm);
      PU.bombs.push({ id: m.id, o: m.o, pos: new THREE.Vector3(m.x, m.y, m.z), vel: new THREE.Vector3(m.vx, m.vy, m.vz), mesh: bm, life: 5 });
      AudioEngine.sfx("swipe");
      break;
    }
    case "laser": {
      var ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.5, 48), new THREE.MeshBasicMaterial({ color: 0xff2a6a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; scene.add(ring);
      PU.lasers.push({ id: m.id, o: m.o, tg: m.tg, t: 0, ring: ring, lock: null, pos: new THREE.Vector3(basketBase.x, basketBase.y, basketBase.z) });
      AudioEngine.sfx("energy");
      if (m.tg === myIdx) _flashPrompt("🛰️ ORBITAL LASER INBOUND — RUN!");
      else if (mine) PU.banner("🛰️ Laser called on " + (m.tg >= 0 ? BT.name(m.tg) : "the critters") + "!");
      break;
    }
    case "llock": { var L = PU.lasers.find(function(l) { return l.id === m.id; }); if (L && !L.lock) L.lock = new THREE.Vector3(m.x, m.y, m.z); break; }
    case "poop": PU.poopArmy(m.o, m.tg, m.x, m.z, false); break;
  }
};
// An air horn went off next to me: flinch!
PU.horned = function(by) {
  _spawnBonkText(PL.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), "HONK!");
  _screenShake = 0.4; _screenShakeT = 0.4;
  if (phase === "AIMING") {
    var j = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.25);
    aimAngle += j; baseAim += j;
    if (dragging && typeof onUp === "function") { throwPower = Math.max(0.25, Math.min(1, throwPower * (0.6 + Math.random() * 0.8))); onUp(); }   // startled into throwing
  } else if (phase === "WALKING") {
    var dx = PL.pos.x - (remotePlayers[by] && remotePlayers[by].body ? remotePlayers[by].body.x : PL.pos.x), dz = PL.pos.z - (remotePlayers[by] && remotePlayers[by].body ? remotePlayers[by].body.z : PL.pos.z), l = Math.hypot(dx, dz) || 1;
    PL.vel.x += dx / l * 5; PL.vel.z += dz / l * 5;
  }
};
PU.mineBoom = function(id) {
  var k = PU.mines.findIndex(function(m) { return m.id === id; }); if (k < 0) return;
  var m = PU.mines[k]; PU._drop(m); PU.mines.splice(k, 1);
  spawnExplosion(new THREE.Vector3(m.x, m.y + 0.4, m.z));
  PU.blastMe(m.x, m.y + 0.4, m.z, 3.0, m.o, "mine", 15);
  PU.critterBlast(m.x, m.z, 3.5, 12);
};
PU.boom = function(id, x, y, z) {
  var k = PU.rockets.findIndex(function(r) { return r.id === id; });
  if (k >= 0) { var r = PU.rockets[k]; PU._drop(r); PU.rockets.splice(k, 1); }
  else if (PU._boomed && PU._boomed[id]) return;
  PU._boomed = PU._boomed || {}; PU._boomed[id] = 1;
  spawnExplosion(new THREE.Vector3(x, y, z));
  PU.blastMe(x, y, z, 3.0, Math.floor(id / 100000), "rocket", 16);
  PU.critterBlast(x, z, 3.5, 13);
};
PU.tracer = function(x, y, z, x2, y2, z2) {
  var a = new THREE.Vector3(x, y, z), b = new THREE.Vector3(x2, y2, z2), len = a.distanceTo(b);
  var m = new THREE.Mesh(PU._get("trGeo", function() { var g = new THREE.CylinderGeometry(0.03, 0.03, 1, 6); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.5); return g; }), new THREE.MeshBasicMaterial({ color: 0x9aff6a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(a); m.lookAt(b); m.scale.set(1, 1, len); scene.add(m);
  spawnParticleBurst(b, new THREE.Color(0x9aff6a), 8);
  var t0 = T; PU._fades = PU._fades || []; PU._fades.push({ m: m, t0: t0, dur: 0.35 });
};
PU.shockwave = function(x, y, z, r, color) {
  var m = new THREE.Mesh(PU._get("swGeo", function() { return new THREE.RingGeometry(0.85, 1, 48); }), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.3, z); scene.add(m);
  PU._fades = PU._fades || []; PU._fades.push({ m: m, t0: T, dur: 0.6, grow: r });
};

// ── Poop army ────────────────────────────────────────────────────────────────
PU.poopArmy = function(owner, target, x, z, mine) {
  if (mine && mpMode) sendToAll({ t: "it", k: "poop", o: owner, tg: target, x: x, z: z });
  var C = HOLES[holeIdx] && HOLES[holeIdx].course; if (!C) return;
  for (var k = 0; k < 6; k++) {
    var a = k / 6 * Math.PI * 2, px = x + Math.cos(a) * 1.4, pz = z + Math.sin(a) * 1.4;
    var m = PU.poopMesh(0.7); m.position.set(px, C.heightAt(px, pz), pz); courseGrp.add(m);
    PU.poops.push({ mesh: m, x: px, z: pz, y: C.heightAt(px, pz), owner: owner, target: target, life: 14, ph: k, critter: null });
  }
  AudioEngine.sfx("boing");
  if (mine) PU.banner("💩 Poop army deployed!");
  else if (target === myIdx) PU.banner("💩 " + BT.name(owner) + " sent a poop army after you — run!");
};
PU.updatePoops = function(dt) {
  var C = HOLES[holeIdx] && HOLES[holeIdx].course; if (!C) return;
  for (var i = PU.poops.length - 1; i >= 0; i--) {
    var p = PU.poops[i];
    p.life -= dt;
    var tx = null, tz = null, ty = 0, tgtMe = false;
    if (p.target === myIdx && p.owner !== myIdx) { tx = PL.pos.x; tz = PL.pos.z; ty = PL.pos.y; tgtMe = true; }
    else if (p.target >= 0 && remotePlayers[p.target] && remotePlayers[p.target].body) { var b = remotePlayers[p.target].body; tx = b.x; tz = b.z; ty = b.y; }
    else if (p.target < 0 && !ENT.isGuest()) {
      if (!p.critter || !p.critter.update) p.critter = PU.critterNear(p.x, p.z, 40);
      if (p.critter) { tx = p.critter.x; tz = p.critter.z; ty = p.critter.y; }
    }
    if (tx !== null) {
      var dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1, sp = 5.2 * dt;
      var nx = p.x + dx / d * sp, nz = p.z + dz / d * sp, g = C.heightAt(nx, nz);
      if (g > C.hazardAt(nx, nz).level + 0.2 && Math.abs(g - p.y) < 1.4) { p.x = nx; p.z = nz; p.y = g; }
      else { p.x = nx; p.z = nz; p.y = Math.max(g, p.y - dt * 4); }
      p.mesh.rotation.y = Math.atan2(dx, dz);
      if (d < 0.9 && Math.abs(ty - p.y) < 1.8) {
        if (tgtMe) BT.receiveHit({ by: p.owner, c: "poop", dx: dx / d, dz: dz / d, f: 8, u: 6 });
        if (p.critter) ENT.launch(p.critter, dx / d * 8, 8, dz / d * 8);
        p.life = 0;
      }
    }
    p.mesh.position.set(p.x, p.y + Math.abs(Math.sin(T * 11 + p.ph)) * 0.35, p.z);
    var sq = 1 + Math.sin(T * 22 + p.ph) * 0.08; p.mesh.scale.set(0.7 * sq, 0.7 / sq, 0.7 * sq);
    if (p.life <= 0) {
      spawnParticleBurst(new THREE.Vector3(p.x, p.y + 0.4, p.z), new THREE.Color(0x7a4a24), 12);
      courseGrp.remove(p.mesh); PU.poops.splice(i, 1);
    }
  }
};

// ── Per-frame ────────────────────────────────────────────────────────────────
PU.update = function(dt) {
  var C = HOLES[holeIdx] && HOLES[holeIdx].course;
  PU.tokens.forEach(function(p) {
    if (p.taken && T > p.back) { p.taken = false; p.mesh.visible = true; spawnParticleBurst(new THREE.Vector3(p.x, p.y + 1, p.z), new THREE.Color(0xb46aff), 10); }
    if (!p.taken) { p.mesh.rotation.y += dt * 1.6; p.mesh.position.y = p.y + 1.05 + Math.sin(T * 2 + p.x) * 0.15; var r = p.mesh.userData.ring; if (r) { var s = 1 + Math.sin(T * 3 + p.z) * 0.1; r.scale.set(s, s, s); } }
  });
  if (PU.batCd > 0) PU.batCd -= dt;
  var it = PU.cur();
  if (PU._batHeld) {
    if (!it || !it.bat) PU.attachBat(false);
    else {
      if (PU.swingT > 0) { PU.swingT -= dt; var k = 1 - PU.swingT / 0.35; PU._batHeld.rotation.set(-0.5 + Math.sin(k * Math.PI) * 1.2, -k * 2.6, -0.35 - Math.sin(k * Math.PI) * 0.8); }
      else PU._batHeld.rotation.set(-0.5, 0, -0.35);
      if (PU._batHeld.parent !== localAvatarMesh) PU.attachBat(true);
    }
  } else if (it && it.bat) PU.attachBat(true);
  for (var bi = PU.inv.length - 1; bi >= 0; bi--) if (PU.inv[bi].bat && PU.inv[bi].until < T) { PU.inv.splice(bi, 1); PU.sel = Math.max(0, Math.min(PU.sel, PU.inv.length - 1)); }
  PU.updatePoops(dt);
  if (C) { PU._rockets(dt, C); PU._mines(dt, C); PU._bombs(dt, C); PU._lasers(dt, C); }
  PU._fire(dt);
  if (PU._fades) for (var f = PU._fades.length - 1; f >= 0; f--) {
    var F = PU._fades[f], q = (T - F.t0) / F.dur;
    if (q >= 1) { scene.remove(F.m); F.m.material.dispose(); PU._fades.splice(f, 1); continue; }
    F.m.material.opacity = (1 - q) * 0.85;
    if (F.grow) F.m.scale.setScalar(1 + q * F.grow);
  }
  if ((PU._hudAcc = (PU._hudAcc || 0) + dt) > 0.25) { PU._hudAcc = 0; PU.renderHud(); }
};
PU._rockets = function(dt, C) {
  for (var i = PU.rockets.length - 1; i >= 0; i--) {
    var r = PU.rockets[i], tgt = null;
    r.life -= dt;
    if (r.tg === myIdx) tgt = new THREE.Vector3(PL.pos.x, PL.pos.y + 1.0, PL.pos.z);
    else if (r.tg >= 0 && remotePlayers[r.tg] && remotePlayers[r.tg].body) tgt = remotePlayers[r.tg].body.clone().add(new THREE.Vector3(0, 1.0, 0));
    else if (r.tg < 0 && !ENT.isGuest()) { if (!r.crit || !r.crit.update) r.crit = PU.critterNear(r.pos.x, r.pos.z, 60); if (r.crit) tgt = new THREE.Vector3(r.crit.x, r.crit.y + 0.6, r.crit.z); }
    if (tgt) {
      var want = tgt.clone().sub(r.pos), dist = want.length();
      want.normalize().multiplyScalar(r.life > 5.4 ? 16 : 22);
      r.vel.lerp(want, Math.min(1, dt * 2.6));
      // the target decides the hit (it knows exactly where it is)
      var decide = r.tg === myIdx || (r.tg < 0 && !ENT.isGuest() && (r.o === myIdx || !mpMode || myIdx === 0));
      if (decide && dist < 1.15) { PU.send({ k: "boom", id: r.id, x: +r.pos.x.toFixed(2), y: +r.pos.y.toFixed(2), z: +r.pos.z.toFixed(2) }); continue; }
    }
    r.pos.addScaledVector(r.vel, dt);
    var g = C.heightAt(r.pos.x, r.pos.z); if (r.pos.y < g + 0.6) r.pos.y = g + 0.6;
    r.mesh.position.copy(r.pos); r.mesh.lookAt(r.pos.clone().add(r.vel));
    if ((r.smoke -= dt) <= 0) { r.smoke = 0.04; var sm = _pMesh("sph", 0xd8d8d8, 0.12 + Math.random() * 0.08, false); _pAdd(sm, r.pos.clone(), new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.6, (Math.random() - 0.5) * 0.6), 0.9, { grav: -1, shrink: false }); }
    if (r.life <= 0) {
      if (r.o === myIdx) PU.send({ k: "boom", id: r.id, x: +r.pos.x.toFixed(2), y: +r.pos.y.toFixed(2), z: +r.pos.z.toFixed(2) });
      else if (r.life < -1) { PU._drop(r); PU.rockets.splice(i, 1); }
    }
  }
};
PU._mines = function(dt, C) {
  PU.mines.forEach(function(m) {
    if (m.mesh.userData.led) m.mesh.userData.led.visible = T < m.armAt ? Math.sin(T * 20) > 0 : Math.sin(T * 5 + m.id) > 0.2;
    if (T < m.armAt || m.fired) return;
    var trig = false;
    if (phase === "WALKING" && PL.respawnT <= 0 && !(m.o === myIdx && T - m.t0 < 2.5) && Math.hypot(PL.pos.x - m.x, PL.pos.z - m.z) < 0.9 && Math.abs(PL.pos.y - m.y) < 1.2) trig = true;
    if (!trig && !ENT.isGuest() && (!mpMode || myIdx === 0)) ENT.list.forEach(function(o) { if (o.update && o.h < 4 && Math.hypot(o.x - m.x, o.z - m.z) < 1.0) trig = true; });
    if (trig) { m.fired = true; PU.send({ k: "mboom", id: m.id }); }
  });
};
PU._bombs = function(dt, C) {
  var grav = 18 * (C.gravity || 1);
  for (var i = PU.bombs.length - 1; i >= 0; i--) {
    var b = PU.bombs[i];
    b.vel.y -= grav * dt; b.pos.addScaledVector(b.vel, dt); b.life -= dt;
    b.mesh.position.copy(b.pos); b.mesh.rotation.x += dt * 6; b.mesh.rotation.y += dt * 4;
    var g = C.heightAt(b.pos.x, b.pos.z);
    if (b.pos.y <= g + 0.2 || b.life <= 0) {
      PU._drop(b); PU.bombs.splice(i, 1);
      var p = new THREE.Vector3(b.pos.x, Math.max(g, b.pos.y) + 0.3, b.pos.z);
      spawnParticleBurst(p, new THREE.Color(0xbfeaff), 40); PU.shockwave(p.x, p.y - 0.3, p.z, 5.5, 0x9adcff);
      AudioEngine.sfx("splash");
      PU.blastMe(p.x, p.y, p.z, 5.5, b.o, "freeze", 0);
      if (!ENT.isGuest()) PU.critterBlast(p.x, p.z, 5, 4);
    }
  }
};
PU._lasers = function(dt, C) {
  for (var i = PU.lasers.length - 1; i >= 0; i--) {
    var L = PU.lasers[i]; L.t += dt;
    if (!L.lock) {
      var tp = null;
      if (L.tg === myIdx) tp = PL.pos;
      else if (L.tg >= 0 && remotePlayers[L.tg] && remotePlayers[L.tg].body) tp = remotePlayers[L.tg].body;
      else if (L.tg < 0) { var cr = PU.critterNear(basketBase.x, basketBase.z, 200); if (cr) tp = new THREE.Vector3(cr.x, cr.y, cr.z); }
      if (tp) L.pos.lerp(tp, Math.min(1, dt * 3));
      if (L.t > 2.6 && (L.tg === myIdx || (L.tg < 0 && (L.o === myIdx || !mpMode)))) { var lp = L.tg === myIdx ? PL.pos : L.pos; PU.send({ k: "llock", id: L.id, x: +lp.x.toFixed(2), y: +lp.y.toFixed(2), z: +lp.z.toFixed(2) }); }
      if (L.t > 3.4 && !L.lock) L.lock = L.pos.clone();   // target vanished: lock where it was
    }
    var at = L.lock || L.pos;
    L.ring.position.set(at.x, C.heightAt(at.x, at.z) + 0.15, at.z);
    L.ring.material.opacity = 0.45 + 0.45 * Math.abs(Math.sin(L.t * (L.lock ? 18 : 7)));
    if (L.lock && !L.struck && L.t > (L.lockT || (L.lockT = L.t + 0.9))) {
      L.struck = true;
      var beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 120, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4a9a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.set(at.x, L.ring.position.y + 60, at.z); scene.add(beam); L.beam = beam; L.beamT = T;
      spawnExplosion(new THREE.Vector3(at.x, L.ring.position.y + 0.5, at.z));
      _screenShake = 0.8; _screenShakeT = 0.7; AudioEngine.sfx("energy");
      PU.blastMe(at.x, L.ring.position.y + 0.9, at.z, 4.6, L.o, "laser", 22);
      PU.critterBlast(at.x, at.z, 5, 16);
    }
    if (L.beam) { var q = (T - L.beamT) / 0.8; L.beam.material.opacity = Math.max(0, 0.85 * (1 - q)); L.beam.scale.set(1 + q, 1, 1 + q); }
    if (L.struck && T - L.beamT > 0.9) { PU._drop(L); PU.lasers.splice(i, 1); }
  }
};
// Fireball disc: a flaming trail on my throw (remote fire throws use rp.fire)
PU._fire = function(dt) {
  PU._fireAcc = (PU._fireAcc || 0) + dt; if (PU._fireAcc < 0.03) return; PU._fireAcc = 0;
  var emit = function(p) { var m = _pMesh("sph", Math.random() < 0.5 ? 0xff7a1a : 0xffd23a, 0.14 + Math.random() * 0.12, true); _pAdd(m, p.clone(), new THREE.Vector3((Math.random() - 0.5), 1 + Math.random(), (Math.random() - 0.5)), 0.5, { grav: -2, shrink: true }); };
  if (PU.fireThrow && phase === "FLYING") emit(discPos);
  if (mpMode) remotePlayers.forEach(function(rp) { if (rp && rp.fire && rp.flying) emit(rp.discPos); });
};

// ── HUD: active effects + three item slots ───────────────────────────────────
PU.renderHud = function() {
  var el = document.getElementById("pu-hud");
  if (!el) { el = document.createElement("div"); el.id = "pu-hud"; var ui = document.getElementById("ui"); if (!ui) return; ui.appendChild(el); }
  var h = "";
  if (PU.active.speed > T) { var left = PU.active.speed - T; h += "<div class='pu-chip glass'><span>⚡</span><b>" + Math.ceil(left) + "s</b><i style='width:" + Math.min(100, left / 10 * 100) + "%;background:#ffd23a'></i></div>"; }
  if (typeof BT !== "undefined" && BT.shieldT > 0) h += "<div class='pu-chip glass'><span>🧲</span><b>" + Math.ceil(BT.shieldT) + "s</b><i style='width:" + (BT.shieldT / 6 * 100) + "%;background:#6ad8ff'></i></div>";
  if (PU.fireNext) h += "<div class='pu-chip glass'><span>🔥</span><b>armed</b></div>";
  var slots = "";
  for (var i = 0; i < PU.MAX; i++) {
    var it = PU.inv[i];
    if (!it) { slots += "<div class='pu-slot empty'></div>"; continue; }
    var I = ITEMS[it.type], extra = it.bat ? Math.ceil(it.until - T) + "s" : it.uses > 1 ? "×" + it.uses : "";
    slots += "<button class='pu-slot" + (i === PU.sel ? " sel" : "") + "' onclick='PU.select(" + i + ");PU.useItem()' title='" + I.name + " — " + I.desc + "'><span>" + I.icon + "</span>" + (extra ? "<em>" + extra + "</em>" : "") + "</button>";
  }
  var cur = PU.cur();
  h += "<div class='pu-bag glass'><div class='pu-slots'>" + slots + "</div>" + (cur ? "<div class='pu-name'><b>" + ITEMS[cur.type].name + "</b><kbd>F</kbd>" + (PU.inv.length > 1 ? "<kbd>G</kbd>" : "") + "</div>" : "<div class='pu-name dim'>Grab a <b style='color:#c890ff'>?</b> bag</div>") + "</div>";
  if (h !== PU._lastHud) { el.innerHTML = h; PU._lastHud = h; }
};
window.addEventListener("keydown", function(e) {
  var tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || e.repeat || typeof phase === "undefined" || phase === "MENU") return;
  if (e.code === "KeyF") PU.useItem();
  else if (e.code === "KeyG") PU.cycle(1);
  else if (phase === "WALKING" && /^Digit[1-3]$/.test(e.code)) PU.select(+e.code.slice(5) - 1);
});


// ══════════════════════════════════════════════════════════
// ── GIVE-UP VOTE SYSTEM ──
// ══════════════════════════════════════════════════════════

function onGiveUpClick() {
  if (!mpMode) {
    // Single player: instant skip
    holeScores[holeIdx] = throwCount;
    totalVsPar += throwCount - (HOLES[holeIdx]||{par:3}).par;
    advanceHole();
    return;
  }
  if (giveUpProposed) return;
  proposeGiveUp();
}

var _giveUpTimer = null;
var _giveUpCountdown = 15;

function proposeGiveUp() {
  giveUpProposed = true;
  giveUpVotes = {};
  giveUpVotes[myIdx] = true;  // proposer auto-votes yes
  sendToAll({ t: "give_up_vote_start", from: myIdx });
  _renderGiveUpUI();
  _startGiveUpTimer();
}

function _renderGiveUpUI() {
  var el = document.getElementById("giveup-vote");
  if (!el) return;
  el.style.display = "block";
  var total  = playerCount;
  var yeas   = Object.values(giveUpVotes).filter(Boolean).length;
  var needed = Math.ceil(total / 2);
  var titleEl = document.getElementById("gv-title");
  var countEl = document.getElementById("gv-count");
  if (titleEl) titleEl.textContent = "Skip Hole? (" + _giveUpCountdown + "s)";
  if (countEl) countEl.textContent = yeas + " / " + total + " voted yes — need " + needed;
}

function _startGiveUpTimer() {
  _giveUpCountdown = 15;
  if (_giveUpTimer) clearInterval(_giveUpTimer);
  _giveUpTimer = setInterval(function() {
    _giveUpCountdown--;
    _renderGiveUpUI();
    if (_giveUpCountdown <= 0) {
      clearInterval(_giveUpTimer); _giveUpTimer = null;
      _resolveGiveUp(true);  // true = timer expired
    }
  }, 1000);
}

function _resolveGiveUp(timerExpired) {
  var total  = playerCount;
  var yeas   = Object.values(giveUpVotes).filter(Boolean).length;
  var needed = Math.ceil(total / 2);
  var passed = yeas >= needed;
  var nays   = Object.keys(giveUpVotes).length - yeas;
  var cannotPass = nays > total - needed;
  if (!timerExpired && !passed && !cannotPass) return;  // still waiting
  if (_giveUpTimer) { clearInterval(_giveUpTimer); _giveUpTimer = null; }
  document.getElementById("giveup-vote").style.display = "none";
  giveUpProposed = false;
  if (passed) {
    if (myIdx === 0) hostForceNext();
    else sendToAll({ t: "give_up_force_next", from: myIdx });
  }
}

function voteGiveUp(yes) {
  if (giveUpVotes[myIdx] !== undefined) return;
  giveUpVotes[myIdx] = yes;
  sendToAll({ t: "give_up_vote", from: myIdx, yes });
  _renderGiveUpUI();
  _resolveGiveUp(false);
}

function checkGiveUpVotes() {
  _renderGiveUpUI();
  _resolveGiveUp(false);
}
