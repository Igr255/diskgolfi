"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── ENTITIES: the living things on a course ──────────────────────────────────
// Every entity has a behaviour (wander, flee, chase, thief, lane, pendulum,
// roller, stomper, geyser, vortex, dancer, laser, saw …), a collider that
// blocks / knocks the player and deflects the disc, and a model (GLB when we
// have a good one, otherwise a hand-built procedural model).
// Entities are listed in `obstacles` so the existing disc-bounce and camera
// occluder code applies to them too.
// ══════════════════════════════════════════════════════════════════════════════
var ENT = {
  list: [],
  carrying: null,          // thief currently holding the disc
  stealCD: 0,
  _m: {},
};

ENT.mat = function(color, o) {
  var k = color + JSON.stringify(o || {});
  if (ENT._m[k]) return ENT._m[k];
  var p = { color: color, roughness: 0.6, metalness: 0 };
  if (o) Object.keys(o).forEach(function(q) { p[q] = o[q]; });
  var m = new THREE.MeshStandardMaterial(p); m.userData.shared = true;
  return (ENT._m[k] = m);
};
ENT.course = function() { var h = HOLES[holeIdx]; return h && h.course; };
ENT.now = 0;   // shared match clock (same on every client), set each frame
ENT.beat = function() { return (typeof mpMode !== "undefined" && mpMode) ? ENT.now * 2 : (AudioEngine.beatPhase ? AudioEngine.beatPhase() : T * 2); };
ENT.isGuest = function() { return typeof mpMode !== "undefined" && mpMode && myIdx !== 0; };
// The player a creature reacts to: the nearest one (host's own player or any remote player)
ENT.target = function(o) {
  var best = PL.pos, bd = Math.hypot(PL.pos.x - o.x, PL.pos.z - o.z), local = true;
  if (phase !== "WALKING") bd = Infinity;   // the host isn't walking: only react to others
  if (typeof mpMode !== "undefined" && mpMode) remotePlayers.forEach(function(rp) {
    if (!rp || !rp.body) return;
    var d = Math.hypot(rp.body.x - o.x, rp.body.z - o.z);
    if (d < bd) { bd = d; best = rp.body; local = false; }
  });
  return { x: best.x, y: best.y, z: best.z, d: bd, local: local };
};

// ── Spawning ─────────────────────────────────────────────────────────────────
ENT.add = function(o) {
  o.x = o.x || 0; o.z = o.z || 0;
  var c = ENT.course();
  if (o.y === undefined) o.y = c ? c.heightAt(o.x, o.z) : 0;
  o.r = o.r === undefined ? 0.6 : o.r; o.h = o.h || 1.5;
  o.yaw = o.yaw || 0; o.t = 0; o.vx = 0; o.vz = 0;
  o.solid = o.solid !== false;
  o.home = o.home || { x: o.x, z: o.z, R: 8 };
  o.startY = o.y; o.worldY = o.y; o.startX = o.x; o.startZ = o.z;
  o.speed = o.speed || 0;
  o.mesh.position.set(o.x, o.y, o.z);
  o.mesh.rotation.y = o.yaw;
  if (o.batch) { o.noFade = true; ENT.batchGrp.add(o.mesh); } else courseGrp.add(o.mesh);
  ENT.list.push(o);
  return o;
};

// Swap a procedural placeholder for a GLB, scaled to a height; returns the wrapper
ENT.glb = function(key, height, placeholder, onLoad) {
  var g = new THREE.Group(); g.userData.glbWrapper = true; g.userData.glbKey = key;
  if (placeholder && !placeholder.isObject3D) placeholder = placeholder.mesh || null;   // legacy builders return {mesh, r, h}
  if (placeholder) g.add(placeholder);
  if (typeof loadModel === "function" && MODEL_OVERRIDES[key]) {
    loadModel(key, function(m) {
      if (!m) return;
      var bb = new THREE.Box3().setFromObject(m), hh = bb.max.y - bb.min.y;
      if (hh > 0.001) { var s = height / hh; m.scale.multiplyScalar(s); }
      bb.setFromObject(m); m.position.y -= bb.min.y;
      while (g.children.length) g.remove(g.children[0]);
      g.add(m);
      if (m.userData.mixer) { g.userData.mixer = m.userData.mixer; g.userData.clipActions = m.userData.clipActions; g.userData.activeClipName = m.userData.activeClipName; }
      g.userData.glbLoaded = true;
      if (m.userData.mixer && typeof TOON !== "undefined") TOON.dress(m);   // animated critters / people get the rim light
      if (onLoad) onLoad(g, m);
    });
  }
  return g;
};
// Play a clip by fuzzy name (works with "Run", "Gallop", "Walking", "AnimalArmature|…|Run" …)
ENT.play = function(o, names) {
  var g = o.mesh; if (!g.userData.clipActions) return;
  var acts = g.userData.clipActions, keys = Object.keys(acts), hit = null;
  for (var n = 0; n < names.length && !hit; n++) {
    var lo = names[n].toLowerCase();
    hit = keys.find(function(k) { var kk = k.toLowerCase().split("|").pop(); return kk === lo; }) || keys.find(function(k) { return k.toLowerCase().indexOf(lo) >= 0; });
  }
  if (!hit || g.userData.activeClipName === hit) return;
  var from = g.userData.activeClipName ? acts[g.userData.activeClipName] : null;
  acts[hit].reset().setLoop(THREE.LoopRepeat, Infinity).play().fadeIn(0.2);
  if (from) from.fadeOut(0.2);
  g.userData.activeClipName = hit;
};

// ── Movement helper: walk over the course ground, avoiding ledges & hazards ──
ENT.step = function(o, dx, dz, maxStep) {
  var c = ENT.course(); if (!c) return false;
  var nx = o.x + dx, nz = o.z + dz, g = c.heightAt(nx, nz), hz = c.hazardAt(nx, nz);
  if (g < hz.level + 0.25 || Math.abs(g - o.y) > (maxStep || 0.6) || !c.inBounds(nx, nz)) return false;
  if (o.home && o.leash && Math.hypot(nx - o.home.x, nz - o.home.z) > o.home.R) return false;
  if (c.ceiling !== null && c.ceiling !== undefined && g + o.h > c.ceiling) return false;
  o.x = nx; o.z = nz; o.y = g;
  return true;
};
ENT.face = function(o, dx, dz, dt, rate) {
  if (Math.abs(dx) + Math.abs(dz) < 1e-5) return;
  var ty = Math.atan2(dx, dz), d = ty - o.yaw;
  while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  o.yaw += d * Math.min(1, dt * (rate || 8));
};
ENT.sync = function(o) { o.mesh.position.set(o.x, o.y + (o.lift || 0), o.z); o.mesh.rotation.y = o.yaw + (o.yawOff || 0); o.worldY = o.y; };

// ══════════════════════════════════════════════════════════════════════════════
// ── BEHAVIOURS ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
ENT.B = {};

// Wander around home; optional hop, flee from the player, steal discs
ENT.B.wander = function(o, dt) {
  var c = ENT.course(), pl = ENT.target(o);
  if (o.state === "carry" || o.state === "steal") return ENT.B.thief(o, dt);
  var dp = pl.d;
  if (o.flee && dp < o.flee) {
    o.dir = Math.atan2(o.x - pl.x, o.z - pl.z) + (Math.random() - 0.5) * 0.6; o.pause = 0; o.run = 1.4;
  } else if (o.chase && dp < o.chase && dp > 1.2) {
    o.dir = Math.atan2(pl.x - o.x, pl.z - o.z); o.pause = 0; o.run = 1.25;
  } else o.run = Math.max(1, (o.run || 1) - dt);
  o.timer = (o.timer || 0) - dt;
  if (o.timer <= 0) {
    o.timer = 1.5 + Math.random() * 3;
    o.pause = Math.random() < (o.idleChance || 0.35) ? 1 + Math.random() * 2 : 0;
    var hx = o.home.x - o.x, hz = o.home.z - o.z;
    o.dir = Math.hypot(hx, hz) > o.home.R * 0.7 ? Math.atan2(hx, hz) + (Math.random() - 0.5) : Math.random() * Math.PI * 2;
  }
  var moving = false;
  if (o.pause > 0) o.pause -= dt;
  else {
    var sp = o.speed * (o.run || 1) * dt;
    if (ENT.step(o, Math.sin(o.dir) * sp, Math.cos(o.dir) * sp, o.maxStep)) { moving = true; ENT.face(o, Math.sin(o.dir), Math.cos(o.dir), dt); }
    else { o.dir += Math.PI * (0.6 + Math.random() * 0.8); o.timer = 0.6; }
  }
  if (o.hop) o.lift = moving ? Math.abs(Math.sin(o.t * o.hop)) * (o.hopH || 0.4) : Math.max(0, (o.lift || 0) - dt * 3);
  if (o.waddle) { o.mesh.rotation.z = moving ? Math.sin(o.t * o.waddle) * 0.14 : 0; }
  if (o.clips) ENT.play(o, moving ? ((o.run || 1) > 1.1 ? o.clips.run : o.clips.walk) : o.clips.idle);
  if (o.canSteal) ENT.trySteal(o);
};

// Mischief: run to a resting disc, grab it, run off and drop it somewhere else
ENT.trySteal = function(o) {
  if (ENT.carrying || ENT.stealCD > 0 || !(phase === "WALKING" || phase === "LANDED")) return;
  if (Math.hypot(discPos.x - o.x, discPos.z - o.z) > 26) return;
  if (Math.hypot(discPos.x - PL.pos.x, discPos.z - PL.pos.z) < 5) return;
  var goose = o.type === "goose" || o.type === "raptor";
  if (T - (ENT.landT || 0) < (goose ? 1.2 : 3)) return;   // give the player a head start (geese don't)
  if (Math.random() > (goose ? 0.025 : 0.004)) return;
  o.state = "steal"; ENT.stealCD = goose ? 12 : 18;
  if (o.type === "goose" && typeof GAD !== "undefined") GAD.honk(o, true);
  if (o.type === "raptor") AudioEngine.sfx("roar", 0.4, new THREE.Vector3(o.x, o.y + 1, o.z));
  if (Math.hypot(discPos.x - PL.pos.x, discPos.z - PL.pos.z) > 14 && typeof CINE !== "undefined") CINE.react(function() { return new THREE.Vector3(o.x, o.y + 0.5, o.z); }, o.type === "goose" ? "HONK! THIEF!" : "THIEF!", 3.2);
  if (typeof _flashPrompt === "function") _flashPrompt(o.type === "raptor" ? "A raptor is going for your disc!" : goose ? "HONK! A goose is going for your disc!" : "Hey! Something's after your disc!");
};
ENT.B.thief = function(o, dt) {
  var sp = o.speed * 1.8 * dt;
  if (o.state === "steal") {
    if (!(phase === "WALKING" || phase === "LANDED")) { o.state = null; return; }
    var dx = discPos.x - o.x, dz = discPos.z - o.z, d = Math.hypot(dx, dz);
    if (d < 0.8) { o.state = "carry"; o.carryT = 4 + Math.random() * 3; ENT.carrying = o; AudioEngine.sfx("swipe"); return; }
    if (!ENT.step(o, dx / d * sp, dz / d * sp, 0.9)) { o.state = null; return; }
    ENT.face(o, dx, dz, dt, 12);
  } else {
    o.carryT -= dt;
    var px = o.x - PL.pos.x, pz = o.z - PL.pos.z, pd = Math.hypot(px, pz) || 1;
    var ax = px / pd + Math.sin(o.t * 1.3) * 0.5, az = pz / pd + Math.cos(o.t * 1.1) * 0.5, al = Math.hypot(ax, az) || 1;
    if (!ENT.step(o, ax / al * sp, az / al * sp, 0.9)) { o.dir = (o.dir || 0) + 1.7; ENT.step(o, Math.sin(o.dir) * sp, Math.cos(o.dir) * sp, 0.9); }
    ENT.face(o, ax, az, dt, 12);
    discPos.set(o.x, o.y + o.h * 0.75, o.z);
    if (o.carryT <= 0 || pd < 2.2) ENT.dropDisc(o, pd < 2.2);
  }
  if (o.clips) ENT.play(o, o.clips.run);
  if (o.hop) o.lift = Math.abs(Math.sin(o.t * o.hop * 1.4)) * (o.hopH || 0.4);
  if (o.waddle) o.mesh.rotation.z = Math.sin(o.t * o.waddle * 1.5) * 0.18;
};
ENT.dropDisc = function(o, scared) {
  var c = ENT.course();
  ENT.carrying = null; o.state = null; o.run = 2; o.dir = Math.random() * 6.28;
  discPos.set(o.x, c.heightAt(o.x, o.z) + 0.06, o.z);
  AudioEngine.sfx(scared ? "pickup" : "terrain", 0.5);
  if (typeof _flashPrompt === "function") _flashPrompt(scared ? "Got it back — it dropped your disc!" : "It dropped your disc over here");
  if (typeof discLie !== "undefined") discLie = null;
};

// Patrol back and forth along a line (cars, tractors, rovers, joggers)
ENT.B.lane = function(o, dt) {
  var L = o.lane, len = Math.hypot(L.x1 - L.x0, L.z1 - L.z0) || 1;
  var ux = (L.x1 - L.x0) / len, uz = (L.z1 - L.z0) / len;
  // Stop for the player standing in front
  var ahead = 7, px = PL.pos.x - o.x, pz = PL.pos.z - o.z, dir = o.dirSign || 1;
  var along = (px * ux + pz * uz) * dir, side = Math.abs(px * uz - pz * ux);
  var blocked = o.polite && along > 0 && along < ahead && side < 1.6 && Math.abs(PL.pos.y - o.y) < 2;
  var target = blocked ? 0 : o.speed;
  o.v = (o.v || 0) + (target - (o.v || 0)) * Math.min(1, dt * (blocked ? 5 : 1.5));
  if (blocked && !o.honked && o.honk) { o.honked = true; AudioEngine.sfx("honk"); }
  if (!blocked) o.honked = false;
  o.s = (o.s === undefined ? Math.random() * len : o.s) + o.v * dt * dir;
  if (o.s > len) { o.s = len; o.dirSign = -1; } else if (o.s < 0) { o.s = 0; o.dirSign = 1; }
  if (o.loop && o.s >= len) o.s = 0;
  var c = ENT.course();
  o.x = L.x0 + ux * o.s; o.z = L.z0 + uz * o.s;
  o.y = c.heightAt(o.x, o.z);
  var wantYaw = Math.atan2(ux * (o.dirSign || 1), uz * (o.dirSign || 1));
  ENT.face(o, Math.sin(wantYaw), Math.cos(wantYaw), dt, 4);
  o.moving = o.v > 0.3;
  o.knockNow = o.v > 1.5;
  if (o.clips) ENT.play(o, o.moving ? (o.v > 3 ? o.clips.run : o.clips.walk) : o.clips.idle);
  if (o.wheels) o.wheels.forEach(function(w) { w.rotation.x += o.v * dt * 2.5 * (o.dirSign || 1); });
};

// Swinging pendulum (giant socks on a clothesline, wrecking candles …)
ENT.B.pendulum = function(o, dt) {
  var a = Math.sin(ENT.now * o.freq + o.phase) * o.amp;
  o.pivot.rotation.x = a;
  // collider follows the sock (rotation about x moves the hanging bob along -local z)
  var off = -Math.sin(a) * o.arm;
  o.x = o.startX + Math.sin(o.swingYaw) * off; o.z = o.startZ + Math.cos(o.swingYaw) * off;
  o.knockNow = Math.abs(Math.cos(ENT.now * o.freq + o.phase)) > 0.3;   // moving fast
  o.worldY = o.startY + 0.9 + (1 - Math.cos(a)) * o.arm;
  o.mesh.position.set(o.startX, o.startY, o.startZ); o.mesh.rotation.y = o.swingYaw;
};

// Rolling across the fairway and back (boulders, giant pencils, tumbleweeds)
ENT.B.roller = function(o, dt) {
  ENT.B.lane(o, dt);
  o.spin.rotation.x += o.v * dt / o.rollR * (o.dirSign || 1);
  o.knockNow = o.v > 1;
};

// Giant foot: hovers, shadow warns, stomps, lifts
ENT.B.stomper = function(o, dt) {
  var cyc = (ENT.now * o.freq + o.phase) % 1;
  var hgt = cyc < 0.55 ? 6 : cyc < 0.65 ? 6 * (1 - (cyc - 0.55) / 0.1) : cyc < 0.8 ? 0 : 6 * ((cyc - 0.8) / 0.2);
  o.foot.position.y = hgt;
  o.shadow.material.opacity = 0.15 + (1 - hgt / 6) * 0.45;
  o.shadow.scale.setScalar(0.6 + (1 - hgt / 6) * 0.4);
  if (hgt < 0.05 && !o.thumped) { o.thumped = true; AudioEngine.sfx("boom", 0.5); if (Math.hypot(PL.pos.x - o.x, PL.pos.z - o.z) < 14 && typeof _screenShake !== "undefined") { _screenShake = 0.25; _screenShakeT = 0.3; } }
  if (hgt > 1) o.thumped = false;
  o.solid = hgt < 1.6; o.knockNow = hgt < 1.6; o.worldY = o.y + hgt;
  // slowly drift around home on the shared clock so the danger zone moves (same on every client)
  var a = ENT.now * 0.11 + o.phase * 6, nx = o.home.x + Math.sin(a) * 4, nz = o.home.z + Math.cos(a * 1.3) * 4, c = ENT.course();
  var g = c.heightAt(nx, nz); if (g > c.hazardAt(nx, nz).level + 0.3) { o.x = nx; o.z = nz; o.y = g; }
};

// Lava geyser: bubbles (telegraph) then erupts, throwing the player (and discs) up
ENT.B.geyser = function(o, dt) {
  var cyc = (ENT.now * o.freq + o.phase) % 1, erupt = cyc > 0.78;
  var warn = cyc > 0.55 && !erupt;
  o.col.visible = erupt; o.col.scale.y = erupt ? Math.min(1, (cyc - 0.78) * 12) : 0.01;
  o.pool.material.emissiveIntensity = warn ? 1.2 + Math.sin(T * 30) * 0.8 : erupt ? 2.5 : 0.8;
  o.knockNow = erupt; o.solid = erupt; o.knockUp = 11;
  if (erupt && !o.fired) { o.fired = true; AudioEngine.sfx("boom", 0.4); }
  if (!erupt) o.fired = false;
  if (erupt && phase === "FLYING" && Math.hypot(discPos.x - o.x, discPos.z - o.z) < 1.6 && discPos.y < o.y + 8) discVel.y = Math.max(discVel.y, 9);
};

// Tornado: wanders, sucks the flying disc in and shoves the player
ENT.B.vortex = function(o, dt) {
  o.dir = (o.dir || Math.random() * 6) + (Math.random() - 0.5) * dt;
  var sp = o.speed * dt;
  if (!ENT.step(o, Math.sin(o.dir) * sp, Math.cos(o.dir) * sp, 3)) o.dir += 2;
  ENT.E.vortex(o, dt);
};
ENT.E = {};   // local effects of creatures on this player's disc / body (run on every client)
ENT.E.vortex = function(o, dt) {
  o.spin.rotation.y += dt * 5;
  if (phase === "FLYING") {
    var dx = o.x - discPos.x, dz = o.z - discPos.z, d = Math.hypot(dx, dz);
    if (d < 12 && d > 0.3) { var k = (1 - d / 12) * 14 * dt; discVel.x += dx / d * k + dz / d * k * 0.8; discVel.z += dz / d * k - dx / d * k * 0.8; discVel.y += k * 0.3; }
  }
  var px = PL.pos.x - o.x, pz = PL.pos.z - o.z, pd = Math.hypot(px, pz);
  if (pd < 6 && pd > 0.2 && phase === "WALKING") { PL.vel.x += (-pz / pd * 6 - px / pd * 3) * dt; PL.vel.z += (px / pd * 6 - pz / pd * 3) * dt; }
};

// Bob and spin on the beat (club robots, dancers, boomboxes)
ENT.B.dancer = function(o, dt) {
  var b = ENT.beat(), ph = b % 1;
  o.lift = Math.max(0, 1 - ph * 3) * (o.bounce || 0.25);
  if (o.spinOnBar) o.yaw = (o.yaw0 === undefined ? (o.yaw0 = o.yaw) : o.yaw0) + Math.floor(b / 4) * Math.PI * 0.5 + (Math.floor(b) % 4 === 0 ? (b % 1) * Math.PI * 0.5 : 0);
  if (o.clips) ENT.play(o, (Math.floor(b / 8) % 2) ? o.clips.a : o.clips.b);
  if (o.squash) o.mesh.scale.set(1 + (o.lift || 0) * 0.2, 1 - (o.lift || 0) * 0.3, 1 + (o.lift || 0) * 0.2);
};

// Sweeping laser beam across a stage: touching it knocks you back
ENT.B.laser = function(o, dt) {
  var b = ENT.beat();
  var a = Math.sin(b * Math.PI / 4 + o.phase) * o.sweep;
  o.beam.rotation.y = a;
  var _c = ENT.course(); o.bm.material.opacity = _c && _c.dim !== undefined ? 0.4 + 0.5 * _c.dim : 0.85;
  // player hit test: distance from the beam line
  var ux = Math.sin(o.baseYaw + a), uz = Math.cos(o.baseYaw + a);
  var px = PL.pos.x - o.x, pz = PL.pos.z - o.z, along = px * ux + pz * uz, side = Math.abs(px * uz - pz * ux);
  var feet = PL.pos.y, beamY = o.y + o.beamH;
  if (phase === "WALKING" && along > 0 && along < o.len && side < 0.35 && feet < beamY && feet + PL.HEIGHT > beamY && (o.cool || 0) <= 0) {
    o.cool = 1; PL.knock(-uz * (px * uz - pz * ux > 0 ? -1 : 1), ux * (px * uz - pz * ux > 0 ? -1 : 1), 7, 5); AudioEngine.sfx("zap");
  }
  if (o.cool > 0) o.cool -= dt;
};

// Spinning saw sliding across a platform: deadly
ENT.B.saw = function(o, dt) {
  o.blade.rotation.z += dt * 14;
  o.x = o.startX + Math.sin(ENT.now * o.freq + o.phase) * o.travel;
  o.deadly = true;
};

// Creeper: walks up to you, hisses, swells and pops (knockback)
ENT.B.creeper = function(o, dt) {
  var tg = ENT.target(o), px = tg.x - o.x, pz = tg.z - o.z, d = Math.hypot(px, pz);
  if (o.fuse > 0) {
    o.fuse -= dt;
    ENT.E.fuse(o);
    if (o.fuse <= 0) {
      o.cool = 5;
      ENT.explode(o.x, o.y, o.z);
      if (typeof mpMode !== "undefined" && mpMode) sendToAll({ t: "ent_boom", h: holeIdx, x: o.x, y: o.y, z: o.z });
      o.x = o.home.x; o.z = o.home.z; o.y = ENT.course().heightAt(o.x, o.z);
    }
    return;
  }
  if (o.cool > 0) { o.cool -= dt; ENT.B.wander(o, dt); return; }
  if (d < 12) {
    var sp = o.speed * dt;
    ENT.step(o, px / d * sp, pz / d * sp, 1.1); ENT.face(o, px, pz, dt);
    if (d < 2.2) { o.fuse = 1.4; AudioEngine.sfx("energy", 0.6); }
  } else ENT.B.wander(o, dt);
};

ENT.E.fuse = function(o) {
  if (!(o.fuse > 0)) { o.mesh.scale.set(1, 1, 1); return; }
  var k = 1 + (1 - o.fuse / 1.4) * 0.35 + Math.sin(T * 30) * 0.03;
  o.mesh.scale.set(k, 1 + (k - 1) * 0.5, k);
};
// A creeper popped: every client shows it and knocks back its own player if close
ENT.explode = function(x, y, z) {
  if (typeof spawnExplosion === "function") spawnExplosion(new THREE.Vector3(x, y + 1, z));
  var px = PL.pos.x - x, pz = PL.pos.z - z, d = Math.hypot(px, pz);
  if (d < 4.5 && phase === "WALKING") PL.knock(px / (d || 1), pz / (d || 1), 11, 7);
};

// Static props: occasional idle motion only
ENT.B.prop = function(o, dt) { if (o.sway) o.mesh.rotation.z = Math.sin(T * o.sway + o.x) * 0.03; };
ENT.B.floater = function(o, dt) { o.lift = Math.sin(ENT.now * 1.3 + o.x) * 0.12 + (o.floatY || 0); o.yaw = ENT.now * (o.spinRate || 0.2) + o.x; };

// Ghost: drifts toward the player when they aren't looking, fades in and out
ENT.B.ghost = function(o, dt) {
  var tg = ENT.target(o), px = tg.x - o.x, pz = tg.z - o.z, d = Math.hypot(px, pz) || 1;
  var fx = Math.sin(PL.camYaw), fz = -Math.cos(PL.camYaw);
  var looking = tg.local && (-(px) * fx + -(pz) * fz) / d > 0.5;   // only the host's own view can freeze it
  var sp = (looking ? 0.3 : 1.6) * dt;
  if (d < 22 && d > 1) { o.x += px / d * sp; o.z += pz / d * sp; ENT.face(o, px, pz, dt, 3); }
  else ENT.B.wander(o, dt);
  var c = ENT.course(); o.y = Math.max(c.heightAt(o.x, o.z), o.y - dt * 2);
  o.lift = 0.6 + Math.sin(ENT.now * 1.7 + o.phase) * 0.3;
  o.knockNow = true; o.knockF = 5;
  if (o.clips) ENT.play(o, d < 8 ? o.clips.run : o.clips.idle);
  if (o.fade) o.mesh.traverse(function(m) { if (m.material && m.material.transparent) m.material.opacity = 0.45 + Math.sin(T * 2 + o.phase) * 0.2; });
};

// ══════════════════════════════════════════════════════════════════════════════
// ── MODELS ───────────────────────────────────────────────────────────────────
// Hand-built models for things we have no good GLB for (and the remakes:
// minions, socks, pencils, giant feet).
// ══════════════════════════════════════════════════════════════════════════════
ENT.M = {};
// GLB stand-ins for the old hand-built creatures (Quaternius, CC0): the hand-built one shows until it loads
ENT.GHOST_CLIPS = { walk: ["Flying_Idle"], run: ["Fast_Flying"], idle: ["Flying_Idle"] };
ENT.ghostMesh = function() {
  return ENT.glb("ghost_q", 2.0, ENT.M.ghost(), function(g, m) {
    m.traverse(function(o) {
      if (!o.isMesh) return;
      var tw = function(mt) { var c = mt.clone(); c.transparent = true; c.opacity = 0.6; if (/main/i.test(mt.name)) { c.color.setHex(0xd8d0ff).convertSRGBToLinear(); c.emissive = new THREE.Color(0x3a2a6a); } c.metalness = 0; return c; };
      o.material = Array.isArray(o.material) ? o.material.map(tw) : tw(o.material);
    });
  });
};
// castle guards: the skeleton character in the knight helm and a red cape
ENT.knightMesh = function() {
  return ENT.glb("skin_bones", 2.1, ENT.M.knight(), function(g) { if (typeof COS !== "undefined") COS.dressAvatar(g, { hat: "hat_knight", back: "back_cape" }); });
};
// Bats: circle overhead, every so often swoop at whoever is closest
ENT.bats = function(many, n) {
  many(n, function(p, z, i) {
    ENT.add({ type: "bat", mesh: ENT.glb("bat", 0.7, new THREE.Group()), x: p.x, z: p.z, y: p.y + 5, r: 0.4, h: 0.7, update: ENT.B.bat, home: { x: p.x, z: p.z, R: 6 + srng() * 5 },
      ang: srng() * 6.28, w: (srng() < 0.5 ? -1 : 1) * (0.5 + srng() * 0.4), alt: 4 + srng() * 3, swoop: 4 + srng() * 6, phase: i * 1.3, knock: 3, clips: { walk: ["Flying"], run: ["Flying"], idle: ["Flying"] } });
  });
};
ENT.B.bat = function(o, dt) {
  var c = ENT.course(); if (!c) return;
  o.swoop -= dt;
  var tg = ENT.target(o), sw = o.swoop < 0 && tg.d < 14;
  if (sw) {   // dive at the player's head, then climb back out
    var dx = tg.x - o.x, dz = tg.z - o.z, d = Math.hypot(dx, dz) || 1, sp = 7 * dt;
    o.x += dx / d * sp; o.z += dz / d * sp; ENT.face(o, dx, dz, dt, 8);
    o.y += ((c.heightAt(o.x, o.z) + 1.5) - o.y) * Math.min(1, dt * 3);
    if (d < 1 || o.swoop < -2.5) { o.swoop = 6 + Math.random() * 6; }
  } else {
    o.ang += o.w * dt;
    var tx = o.home.x + Math.cos(o.ang) * o.home.R, tz = o.home.z + Math.sin(o.ang) * o.home.R;
    ENT.face(o, tx - o.x, tz - o.z, dt, 5);
    o.x += (tx - o.x) * Math.min(1, dt * 2); o.z += (tz - o.z) * Math.min(1, dt * 2);
    o.y += ((c.heightAt(o.x, o.z) + o.alt + Math.sin(ENT.now * 1.7 + o.phase) * 0.6) - o.y) * Math.min(1, dt * 1.5);
  }
  o.lift = 0; o.knockNow = sw; o.moving = true;
  if (o.clips) ENT.play(o, o.clips.walk);
};
function _mesh(geo, mat, x, y, z, parent) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m; }

ENT.M.minion = function(oneEye) {
  var g = new THREE.Group(), yel = ENT.mat(0xffd83a, { roughness: 0.45 }), den = ENT.mat(0x2f5fb0, { roughness: 0.8 }), blk = ENT.mat(0x222222), met = ENT.mat(0xc8ccd0, { metalness: 0.8, roughness: 0.25 }), wht = ENT.mat(0xffffff, { roughness: 0.2 }), brn = ENT.mat(0x5a3a1a);
  var body = new THREE.Group(); g.add(body); g.userData.body = body;
  // capsule body: cylinder + two hemispheres
  _mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 24), yel, 0, 0.62, 0, body);
  _mesh(new THREE.SphereGeometry(0.36, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), yel, 0, 0.87, 0, body);
  _mesh(new THREE.SphereGeometry(0.365, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), den, 0, 0.4, 0, body);
  // overalls: bib, straps, pocket
  _mesh(new THREE.CylinderGeometry(0.367, 0.367, 0.2, 24, 1, true), den, 0, 0.47, 0, body);
  var bib = _mesh(new THREE.BoxGeometry(0.34, 0.24, 0.04), den, 0, 0.66, 0.34, body);
  _mesh(new THREE.BoxGeometry(0.12, 0.08, 0.02), ENT.mat(0x244a8a), 0, 0.64, 0.365, body);
  [-1, 1].forEach(function(s) { var st = _mesh(new THREE.BoxGeometry(0.06, 0.34, 0.03), den, s * 0.2, 0.78, 0.29, body); st.rotation.x = -0.35; st.rotation.z = s * 0.25; _mesh(new THREE.SphereGeometry(0.025, 8, 6), blk, s * 0.15, 0.73, 0.36, body); });
  // goggles
  var band = _mesh(new THREE.CylinderGeometry(0.372, 0.372, 0.09, 28, 1, true), blk, 0, 0.92, 0, body);
  var eyes = oneEye ? [0] : [-0.13, 0.13];
  eyes.forEach(function(ex) {
    var gg = _mesh(new THREE.TorusGeometry(oneEye ? 0.15 : 0.11, 0.035, 10, 24), met, ex, 0.92, 0.36, body);
    var eye = _mesh(new THREE.SphereGeometry(oneEye ? 0.135 : 0.1, 16, 12), wht, ex, 0.92, 0.33, body);
    _mesh(new THREE.SphereGeometry(oneEye ? 0.055 : 0.042, 12, 8), brn, ex, 0.92, oneEye ? 0.455 : 0.42, body);
    _mesh(new THREE.SphereGeometry(oneEye ? 0.03 : 0.022, 8, 6), blk, ex, 0.92, oneEye ? 0.48 : 0.445, body);
  });
  // smile
  var sm = _mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), blk, 0, 0.74, 0.355, body); sm.rotation.z = Math.PI;
  // hair tufts
  for (var h = 0; h < 5; h++) { var hr = _mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 3), blk, (h - 2) * 0.03, 1.27, (h % 2) * 0.03, body); hr.rotation.z = (h - 2) * 0.25; }
  // arms with black gloves
  [-1, 1].forEach(function(s) {
    var arm = new THREE.Group(); arm.position.set(s * 0.36, 0.66, 0); body.add(arm);
    var a = _mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 8), yel, s * 0.06, -0.12, 0, arm); a.rotation.z = s * 0.4;
    _mesh(new THREE.SphereGeometry(0.06, 10, 8), blk, s * 0.12, -0.27, 0, arm);
    g.userData[s < 0 ? "armL" : "armR"] = arm;
  });
  // legs + boots
  [-1, 1].forEach(function(s) {
    _mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 10), den, s * 0.14, 0.1, 0, g);
    _mesh(new THREE.BoxGeometry(0.15, 0.08, 0.22), blk, s * 0.14, 0.04, 0.03, g);
  });
  GFX.batchStatic(g, true);
  return g;
};

ENT.M.sock = function(colA, colB) {
  // A big knitted sock with a ribbed cuff, stripes, heel and toe caps
  var g = new THREE.Group(), a = ENT.mat(colA, { roughness: 1 }), b = ENT.mat(colB, { roughness: 1 }), wht = ENT.mat(0xf4f0e8, { roughness: 1 });
  var leg = new THREE.Group(); g.add(leg);
  for (var i = 0; i < 6; i++) _mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.32, 18), i % 2 ? b : a, 0, -0.16 - i * 0.32, 0, leg);
  var cuff = _mesh(new THREE.CylinderGeometry(0.4, 0.38, 0.3, 18), wht, 0, 0.12, 0, leg);
  var heel = _mesh(new THREE.SphereGeometry(0.37, 18, 12), wht, 0, -2.0, -0.02, leg);
  var foot = _mesh(new THREE.CylinderGeometry(0.34, 0.36, 1.0, 18), a, 0, -2.08, 0.5, leg); foot.rotation.x = Math.PI / 2;
  _mesh(new THREE.SphereGeometry(0.35, 18, 12), wht, 0, -2.08, 1.0, leg);
  GFX.batchStatic(leg, true);
  return g;
};

ENT.M.pencil = function() {
  var g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
  var yel = ENT.mat(0xffc21a, { roughness: 0.55 }), wood = ENT.mat(0xe8c08a, { roughness: 0.9 }), lead = ENT.mat(0x2a2a2a, { roughness: 0.4 }), met = ENT.mat(0xc8c8c0, { metalness: 0.85, roughness: 0.3 }), pink = ENT.mat(0xff8aa8, { roughness: 0.9 });
  var R = 0.42, L = 6;
  var body = _mesh(new THREE.CylinderGeometry(R, R, L, 6), yel, 0, 0, 0, spin);
  var tip = _mesh(new THREE.ConeGeometry(R, 1.2, 6), wood, 0, L / 2 + 0.6, 0, spin);
  _mesh(new THREE.ConeGeometry(R * 0.3, 0.36, 6), lead, 0, L / 2 + 1.02, 0, spin);
  _mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.5, 16), met, 0, -L / 2 - 0.25, 0, spin);
  _mesh(new THREE.CylinderGeometry(R * 0.98, R * 0.98, 0.45, 16), pink, 0, -L / 2 - 0.72, 0, spin);
  // label stripe
  _mesh(new THREE.CylinderGeometry(R * 1.01, R * 1.01, 0.8, 6), ENT.mat(0x1a1a1a), 0, -L / 2 + 0.9, 0, spin);
  spin.rotation.z = Math.PI / 2;   // lying across the fairway; rolls around x after the wrapper turns
  var roll = new THREE.Group(); roll.add(g);
  g.rotation.y = Math.PI / 2;
  roll.userData.spin = spin;
  return { root: roll, spin: spin, R: R };
};

ENT.M.foot = function() {
  var g = new THREE.Group(), skin = ENT.mat(0xf2c0a0, { roughness: 0.7 }), nail = ENT.mat(0xffe8e0, { roughness: 0.3 });
  var foot = new THREE.Group(); g.add(foot);
  var sole = _mesh(new THREE.SphereGeometry(1, 24, 16), skin, 0, 0.6, 0, foot); sole.scale.set(1.25, 0.6, 2.1);
  var heel = _mesh(new THREE.SphereGeometry(0.95, 20, 14), skin, 0, 0.8, -1.3, foot); heel.scale.set(1.1, 0.9, 0.9);
  var ankle = _mesh(new THREE.CylinderGeometry(0.85, 0.95, 4, 20), skin, 0, 2.8, -1.1, foot);
  [[-0.75, 0.42, 0.34], [-0.33, 0.36, 0.3], [0.05, 0.32, 0.28], [0.42, 0.28, 0.25], [0.75, 0.24, 0.22]].forEach(function(t, i) {
    var toe = _mesh(new THREE.SphereGeometry(t[1], 14, 10), skin, t[0], 0.38, 1.95 - i * 0.07, foot); toe.scale.set(1, 0.85, 1.25);
    var n = _mesh(new THREE.SphereGeometry(t[2] * 0.55, 10, 6), nail, t[0], 0.55, 2.1 - i * 0.07, foot); n.scale.set(1, 0.35, 1);
  });
  var shadow = new THREE.Mesh(new THREE.CircleGeometry(2.1, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; shadow.scale.z = 1.4;
  return { root: g, foot: foot, shadow: shadow };
};

ENT.M.ghost = function() {
  var g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xe8e4ff, emissive: new THREE.Color(0x6a5aaa), emissiveIntensity: 0.6, transparent: true, opacity: 0.6, roughness: 0.4, depthWrite: false });
  var pts = []; for (var i = 0; i <= 12; i++) { var t = i / 12; pts.push(new THREE.Vector2(Math.sin(t * Math.PI * 0.5 + 0.15) * 0.65 * (t < 0.95 ? 1 : 0.7) + (t > 0.85 ? Math.sin(t * 40) * 0.04 : 0), 2.0 - t * 2.0)); }
  pts.reverse();
  var body = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), m); g.add(body);
  var eye = ENT.mat(0x0a0518);
  [-0.2, 0.2].forEach(function(x) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), eye); e.position.set(x, 1.45, 0.5); e.scale.set(0.8, 1.3, 0.5); g.add(e); });
  var mo = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), eye); mo.position.set(0, 1.1, 0.55); mo.scale.set(1, 1.4, 0.5); g.add(mo);
  return g;
};

ENT.M.geyser = function() {
  var g = new THREE.Group();
  var pool = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), new THREE.MeshStandardMaterial({ color: 0x200400, emissive: new THREE.Color(0xff4a10), emissiveIntensity: 0.8, roughness: 0.5 }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.03; g.add(pool);
  var rim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.25, 8, 20), ENT.mat(0x2a1a14, { roughness: 1 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.06; g.add(rim);
  var col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.0, 7, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff6a20, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  col.geometry.translate(0, 3.5, 0); col.visible = false; g.add(col);
  return { root: g, pool: pool, col: col };
};

ENT.M.tornado = function() {
  var g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
  var m = new THREE.MeshStandardMaterial({ color: 0x8a9a96, transparent: true, opacity: 0.42, roughness: 1, depthWrite: false, side: THREE.DoubleSide });
  for (var i = 0; i < 9; i++) {
    var r0 = 0.4 + i * 0.55, ring = new THREE.Mesh(new THREE.CylinderGeometry(r0 + 0.5, r0, 1.3, 16, 1, true), m);
    ring.position.set(Math.sin(i * 0.9) * 0.4, 0.65 + i * 1.2, Math.cos(i * 0.9) * 0.4); ring.rotation.y = i; spin.add(ring);
  }
  return { root: g, spin: spin };
};

ENT.M.boulder = function(r) {
  var g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
  var geo = new THREE.IcosahedronGeometry(r, 1), p = geo.attributes.position;
  for (var i = 0; i < p.count; i++) { var k = 0.85 + Math.random() * 0.25; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  geo.computeVertexNormals();
  var m = _mesh(geo, ENT.mat(0x7a7470, { roughness: 1, flatShading: true }), 0, 0, 0, spin);
  spin.position.y = r;
  return { root: g, spin: spin };
};

ENT.M.tumbleweed = function() {
  var g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
  var m = ENT.mat(0xa08050, { roughness: 1 });
  for (var i = 0; i < 9; i++) { var t = _mesh(new THREE.TorusGeometry(0.55, 0.025, 4, 18), m, 0, 0, 0, spin); t.rotation.set(Math.random() * 3, Math.random() * 3, 0); }
  spin.position.y = 0.6;
  return { root: g, spin: spin };
};

ENT.M.cactus = function() {
  var g = new THREE.Group(), m = ENT.mat(0x4a8a3a, { roughness: 0.8 });
  _mesh(new THREE.CylinderGeometry(0.32, 0.36, 3.2, 10), m, 0, 1.6, 0, g);
  _mesh(new THREE.SphereGeometry(0.32, 10, 8), m, 0, 3.2, 0, g);
  [-1, 1].forEach(function(s, i) { var h = 1.2 + i * 0.5; _mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 8), m, s * 0.55, h, 0, g).rotation.z = Math.PI / 2; _mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.0, 8), m, s * 0.85, h + 0.45, 0, g); _mesh(new THREE.SphereGeometry(0.2, 8, 6), m, s * 0.85, h + 0.95, 0, g); });
  return g;
};

ENT.M.penguin = function() {
  var g = new THREE.Group(), blk = ENT.mat(0x1a1c24), wht = ENT.mat(0xf4f4f0), org = ENT.mat(0xff9a2a);
  var b = _mesh(new THREE.SphereGeometry(0.4, 16, 12), blk, 0, 0.5, 0, g); b.scale.set(1, 1.35, 0.95);
  var bl = _mesh(new THREE.SphereGeometry(0.33, 16, 12), wht, 0, 0.45, 0.12, g); bl.scale.set(0.95, 1.3, 0.8);
  _mesh(new THREE.SphereGeometry(0.27, 14, 10), blk, 0, 1.05, 0, g);
  _mesh(new THREE.ConeGeometry(0.07, 0.2, 8), org, 0, 1.02, 0.3, g).rotation.x = Math.PI / 2;
  [-0.1, 0.1].forEach(function(x) { _mesh(new THREE.SphereGeometry(0.05, 8, 6), wht, x, 1.12, 0.22, g); _mesh(new THREE.SphereGeometry(0.025, 6, 4), blk, x, 1.12, 0.265, g); });
  [-1, 1].forEach(function(s) { var w = _mesh(new THREE.SphereGeometry(0.16, 10, 8), blk, s * 0.4, 0.55, 0, g); w.scale.set(0.3, 1.2, 0.7); w.rotation.z = s * 0.3; _mesh(new THREE.BoxGeometry(0.16, 0.05, 0.22), org, s * 0.13, 0.03, 0.08, g); });
  GFX.batchStatic(g, true);
  return g;
};

ENT.M.creeper = function() {
  var g = new THREE.Group(), tex = LV.blockTex("leaves"), m = new THREE.MeshStandardMaterial({ color: 0x6ad04a, map: LV.blockTex("grass_top"), roughness: 1 }), blk = ENT.mat(0x111111);
  _mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), m, 0, 0.75, 0, g);
  _mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), m, 0, 1.38, 0, g);
  [[-0.12, 1.45], [0.12, 1.45]].forEach(function(p) { _mesh(new THREE.BoxGeometry(0.12, 0.12, 0.02), blk, p[0], p[1], 0.26, g); });
  _mesh(new THREE.BoxGeometry(0.12, 0.2, 0.02), blk, 0, 1.28, 0.26, g);
  [[-0.13, 0.17], [0.13, 0.17], [-0.13, -0.17], [0.13, -0.17]].forEach(function(p) { _mesh(new THREE.BoxGeometry(0.24, 0.38, 0.24), m, p[0], 0.19, p[1], g); });
  GFX.batchStatic(g, true);
  return g;
};
ENT.M.pig = function() {
  var g = new THREE.Group(), m = ENT.mat(0xf0a8a8), d = ENT.mat(0xd88a8a), blk = ENT.mat(0x111111);
  _mesh(new THREE.BoxGeometry(0.6, 0.5, 0.9), m, 0, 0.55, 0, g);
  _mesh(new THREE.BoxGeometry(0.5, 0.5, 0.45), m, 0, 0.75, 0.6, g);
  _mesh(new THREE.BoxGeometry(0.26, 0.16, 0.06), d, 0, 0.68, 0.84, g);
  [-0.13, 0.13].forEach(function(x) { _mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), blk, x, 0.85, 0.83, g); });
  [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.3], [0.18, -0.3]].forEach(function(p) { _mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), m, p[0], 0.15, p[1], g); });
  GFX.batchStatic(g, true);
  return g;
};

ENT.M.snowman = function() {
  var g = new THREE.Group(), s = ENT.mat(0xf8fbff, { roughness: 0.7 }), blk = ENT.mat(0x1a1a1a), org = ENT.mat(0xff7a1a);
  _mesh(new THREE.SphereGeometry(0.7, 18, 14), s, 0, 0.62, 0, g);
  _mesh(new THREE.SphereGeometry(0.5, 18, 14), s, 0, 1.55, 0, g);
  _mesh(new THREE.SphereGeometry(0.36, 18, 14), s, 0, 2.25, 0, g);
  _mesh(new THREE.ConeGeometry(0.07, 0.4, 8), org, 0, 2.25, 0.5, g).rotation.x = Math.PI / 2;
  [-0.12, 0.12].forEach(function(x) { _mesh(new THREE.SphereGeometry(0.04, 6, 4), blk, x, 2.35, 0.32, g); });
  _mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.42, 14), blk, 0, 2.72, 0, g); _mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16), blk, 0, 2.52, 0, g);
  var sc = _mesh(new THREE.TorusGeometry(0.38, 0.08, 8, 16), ENT.mat(0xd83a3a), 0, 1.95, 0, g); sc.rotation.x = Math.PI / 2;
  return g;
};

ENT.M.lamp = function(night) {
  var g = new THREE.Group(), m = ENT.mat(0x2a2e34, { metalness: 0.6, roughness: 0.4 });
  _mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 8), m, 0, 2.5, 0, g);
  var arm = _mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), m, 0, 4.95, 0.5, g);
  _mesh(new THREE.BoxGeometry(0.4, 0.14, 0.6), m, 0, 4.88, 1.05, g);
  var bulb = _mesh(new THREE.BoxGeometry(0.34, 0.03, 0.5), ENT.mat(0x000000, { emissive: 0xffe0a0, emissiveIntensity: night ? 2.2 : 0.3 }), 0, 4.8, 1.05, g);
  if (night) {
    if (!ENT._lampPool) { ENT._lampPool = new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, map: GFX.softDotTexture() }); ENT._lampPool.userData.shared = true; }
    var pool = new THREE.Mesh(new THREE.CircleGeometry(3, 24), ENT._lampPool); pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.05, 1.05); pool.castShadow = false; g.add(pool);
  }
  return g;
};
ENT.M.bench = function() {
  var g = new THREE.Group(), w = ENT.mat(0x8a5a32), m = ENT.mat(0x2a2a2e, { metalness: 0.6 });
  for (var i = 0; i < 3; i++) _mesh(new THREE.BoxGeometry(1.8, 0.05, 0.14), w, 0, 0.48, -0.18 + i * 0.18, g);
  for (var j = 0; j < 2; j++) _mesh(new THREE.BoxGeometry(1.8, 0.14, 0.04), w, 0, 0.7 + j * 0.18, -0.28, g);
  [-0.8, 0.8].forEach(function(x) { _mesh(new THREE.BoxGeometry(0.06, 0.48, 0.5), m, x, 0.24, 0, g); });
  return g;
};
ENT.M.chair = function() {
  var g = new THREE.Group(), f = ENT.mat(0x2a2e3a, { roughness: 0.9 }), m = ENT.mat(0x9aa0a8, { metalness: 0.7, roughness: 0.3 });
  _mesh(new THREE.BoxGeometry(0.55, 0.1, 0.55), f, 0, 0.5, 0, g);
  _mesh(new THREE.BoxGeometry(0.5, 0.6, 0.08), f, 0, 0.88, -0.26, g);
  _mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), m, 0, 0.27, 0, g);
  for (var i = 0; i < 5; i++) { var a = i / 5 * 6.28; var l = _mesh(new THREE.BoxGeometry(0.04, 0.03, 0.32), m, Math.sin(a) * 0.16, 0.06, Math.cos(a) * 0.16, g); l.rotation.y = a; }
  return g;
};
ENT.M.plant = function() {
  var g = new THREE.Group(), pot = ENT.mat(0xd8d4cc), leaf = ENT.mat(0x3a8a3a, { roughness: 0.7, side: THREE.DoubleSide });
  _mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.55, 14), pot, 0, 0.28, 0, g);
  for (var i = 0; i < 9; i++) { var l = _mesh(new THREE.PlaneGeometry(0.22, 1.1), leaf, 0, 1.0, 0, g); l.rotation.set(-0.4 - Math.random() * 0.3, i * 0.7, 0); l.geometry.translate(0, 0.4, 0); }
  return g;
};
ENT.M.mug = function() {
  var g = new THREE.Group(), m = ENT.mat(0xf4f0e8, { roughness: 0.3 }), cof = ENT.mat(0x3a1e0a, { roughness: 0.1 });
  _mesh(new THREE.CylinderGeometry(1.4, 1.3, 3.2, 28, 1, true), m, 0, 1.6, 0, g).material.side = THREE.DoubleSide;
  _mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 28), m, 0, 0.05, 0, g);
  _mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.05, 28), cof, 0, 2.8, 0, g);
  var h = _mesh(new THREE.TorusGeometry(0.75, 0.18, 10, 20, Math.PI), m, 1.4, 1.6, 0, g); h.rotation.z = -Math.PI / 2;
  return g;
};
ENT.M.rover = function() {
  var g = new THREE.Group(), body = ENT.mat(0xd8d8d0, { metalness: 0.5, roughness: 0.4 }), dark = ENT.mat(0x2a2a2e), gold = ENT.mat(0xd8a830, { metalness: 0.9, roughness: 0.3 });
  _mesh(new THREE.BoxGeometry(1.6, 0.3, 2.4), body, 0, 0.75, 0, g);
  _mesh(new THREE.BoxGeometry(1.4, 0.5, 0.9), gold, 0, 1.1, -0.4, g);
  _mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), dark, 0.5, 1.6, 0.6, g);
  var dish = _mesh(new THREE.SphereGeometry(0.35, 12, 6, 0, 6.28, 0, 1.2), body, 0.5, 2.2, 0.6, g); dish.rotation.x = -0.6;
  var wheels = [];
  [[-0.9, 0.8], [0.9, 0.8], [-0.9, -0.8], [0.9, -0.8], [-0.9, 0], [0.9, 0]].forEach(function(p) { var w = _mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14), dark, p[0], 0.36, p[1], g); w.rotation.z = Math.PI / 2; var wr = new THREE.Group(); wr.position.copy(w.position); g.add(wr); g.remove(w); w.position.set(0, 0, 0); wr.add(w); wheels.push(wr); });
  g.userData.wheels = wheels;
  return g;
};
ENT.M.lander = function() {
  var g = new THREE.Group(), gold = ENT.mat(0xd8a830, { metalness: 0.9, roughness: 0.35 }), wh = ENT.mat(0xe0e0d8, { metalness: 0.3 }), dark = ENT.mat(0x333338);
  _mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.2, 8), gold, 0, 2.0, 0, g);
  _mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.4, 6), wh, 0, 3.3, 0, g);
  [0, 1, 2, 3].forEach(function(i) { var a = i * Math.PI / 2 + 0.78; var l = _mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), dark, Math.cos(a) * 1.9, 1.1, Math.sin(a) * 1.9, g); l.rotation.z = Math.cos(a) * 0.45; l.rotation.x = -Math.sin(a) * 0.45; _mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 10), dark, Math.cos(a) * 2.4, 0.04, Math.sin(a) * 2.4, g); });
  return g;
};
ENT.M.flag = function() {
  var g = new THREE.Group();
  _mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), ENT.mat(0xd8d8d8, { metalness: 0.8 }), 0, 1.3, 0, g);
  var cv = document.createElement("canvas"); cv.width = 96; cv.height = 64; var x = cv.getContext("2d");
  for (var i = 0; i < 7; i++) { x.fillStyle = i % 2 ? "#fff" : "#c8282a"; x.fillRect(0, i * 64 / 7, 96, 64 / 7 + 1); }
  x.fillStyle = "#1a3a8a"; x.fillRect(0, 0, 42, 34);
  var t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
  var f = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide })); f.position.set(0.62, 2.15, 0); g.add(f);
  return g;
};
ENT.M.knight = function() {
  var g = new THREE.Group(), steel = ENT.mat(0xb8bcc4, { metalness: 0.9, roughness: 0.3 }), dark = ENT.mat(0x3a3a40, { metalness: 0.7 }), red = ENT.mat(0x8a1a1a);
  _mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.75, 12), steel, 0, 1.25, 0, g);
  _mesh(new THREE.SphereGeometry(0.22, 14, 10), steel, 0, 1.85, 0, g);
  _mesh(new THREE.BoxGeometry(0.3, 0.04, 0.05), dark, 0, 1.86, 0.2, g);
  var pl = _mesh(new THREE.ConeGeometry(0.06, 0.4, 6), red, 0, 2.15, -0.05, g); pl.rotation.x = -0.4;
  [-0.12, 0.12].forEach(function(x) { _mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.85, 8), steel, x, 0.43, 0, g); });
  [-1, 1].forEach(function(s) { _mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.7, 8), steel, s * 0.42, 1.2, 0, g).rotation.z = s * 0.15; });
  var sw = _mesh(new THREE.BoxGeometry(0.07, 1.2, 0.02), steel, 0.5, 1.2, 0.25, g); sw.rotation.x = 0.3;
  var sh = _mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 6), red, -0.5, 1.2, 0.15, g); sh.rotation.x = Math.PI / 2;
  GFX.batchStatic(g, true);
  return g;
};
ENT.M.torch = function() {
  var g = new THREE.Group();
  _mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 6), ENT.mat(0x4a3020), 0, 0.7, 0, g);
  _mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.2, 8), ENT.mat(0x2a2a2a, { metalness: 0.7 }), 0, 1.45, 0, g);
  var fl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 8), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); fl.position.y = 1.72; g.add(fl);
  g.userData.flame = fl;
  return g;
};
ENT.M.saw = function() {
  var g = new THREE.Group(), blade = new THREE.Group(); g.add(blade);
  var m = ENT.mat(0xd0d4dc, { metalness: 0.9, roughness: 0.2 });
  _mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.08, 32), m, 0, 0, 0, blade).rotation.x = Math.PI / 2;
  for (var i = 0; i < 16; i++) { var a = i / 16 * 6.28, t = _mesh(new THREE.ConeGeometry(0.16, 0.36, 4), m, Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0, blade); t.rotation.z = a - Math.PI / 2; }
  _mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 12), ENT.mat(0x222222), 0, 0, 0, blade).rotation.x = Math.PI / 2;
  blade.position.y = 1.1;
  return { root: g, blade: blade };
};
ENT.M.spikes = function() {
  var g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x0a0a14, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.15, metalness: 0.5, roughness: 0.3 });
  for (var i = 0; i < 3; i++) _mesh(new THREE.ConeGeometry(0.42, 1.0, 4), m, (i - 1) * 0.85, 0.5, 0, g).rotation.y = Math.PI / 4;
  var e = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.9), new THREE.MeshBasicMaterial({ color: 0xff3a6a })); e.position.y = 0.02; g.add(e);
  return g;
};
ENT.M.laserRig = function(color, len) {
  var g = new THREE.Group();
  _mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), ENT.mat(0x1a1a22, { metalness: 0.7 }), 0, 0.15, 0, g);
  var beam = new THREE.Group(); beam.position.y = 1.05; g.add(beam);
  var bm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  bm.rotation.x = Math.PI / 2; bm.position.z = len / 2; beam.add(bm);
  var post = _mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), ENT.mat(0x333333), 0, 0.65, 0, g);
  return { root: g, beam: beam, bm: bm };
};
ENT.M.discoBall = function() {
  var g = new THREE.Group();
  var ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.08, flatShading: true }));
  g.add(ball);
  var str = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 30, 4), ENT.mat(0x888888)); str.position.y = 15.5; g.add(str);
  // light spots sweeping beneath it
  var spots = [];
  for (var i = 0; i < 6; i++) {
    var s = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16), new THREE.MeshBasicMaterial({ color: [0xff3aa8, 0x3af0ff, 0xffd23a, 0xb46aff][i % 4], transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, map: GFX.softDotTexture() }));
    s.rotation.x = -Math.PI / 2; spots.push(s);
  }
  return { root: g, ball: ball, spots: spots };
};
ENT.M.house = function(col) {
  var g = new THREE.Group(), wall = ENT.mat(col || 0xf0e6d0, { roughness: 0.9 }), roof = ENT.mat(0xa04a32, { roughness: 0.8 }), wood = ENT.mat(0x6a4a2a), glass = ENT.mat(0x9ac8e8, { roughness: 0.1, metalness: 0.3 });
  _mesh(new THREE.BoxGeometry(5, 3.2, 4), wall, 0, 1.6, 0, g);
  var r = _mesh(new THREE.CylinderGeometry(0.01, 3.8, 2.2, 4, 1), roof, 0, 4.3, 0, g); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.8);
  _mesh(new THREE.BoxGeometry(0.9, 1.8, 0.08), wood, 0, 0.9, 2.02, g);
  [-1.6, 1.6].forEach(function(x) { _mesh(new THREE.BoxGeometry(0.9, 0.8, 0.06), glass, x, 1.9, 2.02, g); });
  _mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), ENT.mat(0x8a5a4a), 1.4, 4.6, -0.6, g);
  return g;
};
ENT.M.clothesline = function(len) {
  var g = new THREE.Group(), w = ENT.mat(0x8a6a4a);
  [-len / 2, len / 2].forEach(function(x) { _mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.4, 8), w, x, 2.2, 0, g); _mesh(new THREE.BoxGeometry(0.1, 0.1, 1.2), w, x, 4.3, 0, g); });
  var line = _mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 4), ENT.mat(0xf0f0f0), 0, 4.22, 0, g); line.rotation.z = Math.PI / 2;
  return g;
};
ENT.M.pole = function(h, col) { var g = new THREE.Group(); _mesh(new THREE.CylinderGeometry(0.08, 0.1, h, 8), ENT.mat(col || 0x6a6a6a), 0, h / 2, 0, g); return g; };
ENT.M.npc = function(skinKey) {
  // Another character from the roster (shares the player rig and its animations)
  var ph = new THREE.Group(); _mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.5, 8), ENT.mat(0x8a8aaa), 0, 0.75, 0, ph);
  return ENT.glb(skinKey, 1.75, ph);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── RECIPES: who lives where ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
ENT.spawnAll = function(h, spawns, idx) {
  ENT.clear();
  ENT.batchGrp = new THREE.Group();
  var c = h.course, busy = h.mods.indexOf("busy") >= 0 ? 1.8 : 1, steal = h.mods.indexOf("mischief") >= 0;
  var diffMult = { easy: 0.5, normal: 1, hard: 1.3, chaos: 1.7 }[typeof DIFFICULTY !== "undefined" ? DIFFICULTY : "normal"] || 1;
  var dens = busy * diffMult, th = h.theme;
  var zones = ENT.zones(c, spawns);
  var R = function(a, b) { return a + srng() * (b - a); };
  // Placement helper: a random walkable point in a zone, away from tee & basket
  function spot(z, clear) {
    for (var k = 0; k < 30; k++) {
      var a = srng() * 6.28, r = Math.sqrt(srng()) * z.r, x = z.x + Math.cos(a) * r, zz = z.z + Math.sin(a) * r;
      var g = c.heightAt(x, zz); if (g < c.hazardAt(x, zz).level + 0.3) continue;
      // never on (or right next to) a bridge or stepping stone — they'd block the crossing
      var onX = false; for (var q = 0; q < 5 && !onX; q++) { var sp = c.supportAt(x + (q ? Math.cos(q * 1.571) * 1.5 : 0), zz + (q ? Math.sin(q * 1.571) * 1.5 : 0)); if (sp.solid && sp.solid.crossing) onX = true; }
      if (onX) continue;
      if (Math.hypot(x - c.tee.x, zz - c.tee.z) < (clear || 5) || Math.hypot(x - c.basket.x, zz - c.basket.z) < (clear || 4)) continue;
      if (c.ceiling !== null && c.ceiling !== undefined && g > c.ceiling - 2) continue;
      return { x: x, z: zz, y: g };
    }
    return null;
  }
  function many(n, make) { n = Math.round(n * dens); for (var i = 0; i < n && zones.length; i++) { var z = zones[Math.floor(srng() * zones.length)], p = spot(z); if (p) make(p, z, i); } }
  function wanderer(p, z, mesh, o) {
    if (mesh && !mesh.isObject3D) { mesh = mesh.mesh || new THREE.Group(); GFX.batchStatic(mesh, true); }
    var e = Object.assign({ type: "critter", mesh: mesh, x: p.x, z: p.z, y: p.y, r: 0.5, h: 1, speed: 1.2, update: ENT.B.wander, home: { x: z.x, z: z.z, R: z.r + 4 }, leash: true, canSteal: steal }, o || {});
    return ENT.add(e);
  }
  var chick = function(p, z, i) { wanderer(p, z, ENT.glb("chick", 0.7, ENT.M.pig()), { speed: 1.6, flee: 4, r: 0.35, h: 0.7, clips: { walk: ["Run"], run: ["Run"], idle: ["Idle_Peck", "Idle"] }, canSteal: steal || th === "funny" }); };
  var rooster = function(p, z) { wanderer(p, z, ENT.glb("furry", 1.4, ENT.M.pig()), { speed: 1.0, r: 0.5, h: 1.4, hop: 9, hopH: 0.12, knock: 4 }); };
  var dog = function(p, z) { wanderer(p, z, ENT.glb("shiba_inu", 1.1, ENT.M.pig()), { speed: 2.2, chase: 10, r: 0.6, h: 1.1, knock: 6, clips: { walk: ["Walk"], run: ["Gallop"], idle: ["Idle", "Idle_2"] }, canSteal: true }); };
  var bunny = function(p, z) { wanderer(p, z, ENT.glb("bunny", 1.4, ENT.M.pig()), { speed: 2.4, flee: 6, r: 0.5, h: 1.4, hop: 10, hopH: 0.55, idleChance: 0.5, canSteal: steal || th === "feet_bunnies" || th === "cabbage" }); };
  var minion = function(p, z, i) { var m = ENT.M.minion(i % 3 === 0); wanderer(p, z, m, { type: "minion", speed: 1.5, chase: 7, r: 0.4, h: 1.3, waddle: 14, hop: i % 4 === 0 ? 6 : 0, hopH: 0.3, knock: 3, canSteal: steal || idx >= 4 }); };
  var jogger = function(lane, i) { return ENT.add({ type: "jogger", mesh: ENT.glb("animated_woman", 1.75, ENT.M.npc("skin_casual")), x: lane.x0, z: lane.z0, r: 0.4, h: 1.75, speed: i % 2 ? 1.4 : 3.6, update: ENT.B.lane, lane: lane, polite: false, knock: 5, clips: { walk: ["Walking"], run: ["Running"], idle: ["Idle"] } }); };
  var tree = function(p, key, hgt, r) { ENT.add({ type: "tree", mesh: ENT.glb(key, hgt, buildTree ? buildTree(hgt / 6, th) : new THREE.Group()), x: p.x, z: p.z, y: p.y, r: r || 0.6, h: hgt, update: ENT.B.prop, yaw: srng() * 6.28 }); };
  var prop = function(p, mesh, r, hgt, o) {
    if (mesh && !mesh.isObject3D) { mesh = mesh.mesh || new THREE.Group(); GFX.batchStatic(mesh, true); }
    var still = !mesh.userData.glbWrapper && !(o && (o.update || o.sway));   // static procedural props get merged into one draw call per material
    return ENT.add(Object.assign({ type: "prop", mesh: mesh, x: p.x, z: p.z, y: p.y, r: r, h: hgt, update: ENT.B.prop, yaw: srng() * 6.28, batch: still }, o || {}));
  };
  var rollerAcross = function(n, make, speed, rollR) {
    for (var i = 0; i < Math.round(n * dens); i++) {
      var rp = LV.pointAt(c.route, 0.2 + srng() * 0.65), w = 9 + srng() * 6;
      var lane = { x0: rp.x - rp.dz * w, z0: rp.z + rp.dx * w, x1: rp.x + rp.dz * w, z1: rp.z - rp.dx * w };
      var m = make();
      ENT.add({ type: "roller", mesh: m.root, spin: m.spin, rollR: rollR, x: lane.x0, z: lane.z0, r: rollR + 0.1, h: rollR * 2, speed: speed * R(0.8, 1.2), update: ENT.B.roller, lane: lane, knock: 8 });
    }
  };

  // Static props spawned by the level builders
  spawns.forEach(function(s) {
    var y = s.y !== undefined ? s.y : c.heightAt(s.x || 0, s.z || 0);
    if (s.kind === "tree") tree({ x: s.x, z: s.z, y: y }, "tree", 5.5, 0.5);
    else if (s.kind === "bench") prop({ x: s.x, z: s.z, y: y }, ENT.glb("prop_bench", 1.0, ENT.M.bench()), 0.8, 0.9);
    else if (s.kind === "streetlamp") prop({ x: s.x, z: s.z, y: y }, ENT.M.lamp(true), 0.15, 5);
    else if (s.kind === "parked") prop({ x: s.x, z: s.z, y: y }, ENT.glb("car", 1.5, new THREE.Group()), 1.1, 1.5, { yaw: 0, solid: true });
    else if (s.kind === "chair") prop({ x: s.x, z: s.z, y: y }, ENT.M.chair(), 0.35, 1.1, { yaw: s.rot + Math.PI });
    else if (s.kind === "plant") prop({ x: s.x, z: s.z, y: y }, ENT.M.plant(), 0.35, 1.6);
    else if (s.kind === "torch") { var tm = ENT.M.torch(); var to = prop({ x: s.x, z: s.z, y: y }, tm, 0.12, 1.8, { solid: false }); to.update = function(o) { tm.userData.flame.scale.set(1, 0.85 + Math.sin(T * 17 + o.x) * 0.15, 1); }; }
    else if (s.kind === "spikes") ENT.add({ type: "spikes", mesh: ENT.M.spikes(), x: s.x, z: s.z, y: s.y, r: 1.1, h: 1.0, update: ENT.B.prop, deadly: true });
    else if (s.kind === "saw") { var sm = ENT.M.saw(); ENT.add({ type: "saw", mesh: sm.root, blade: sm.blade, x: s.x, z: s.z, y: s.y, r: 1.0, h: 2.3, update: ENT.B.saw, travel: Math.max(0.5, s.w / 2 - 1.2), freq: R(0.8, 1.6), phase: srng() * 6, deadly: true, yaw: Math.PI / 2 }); }
  });

  var n0 = 4 + idx * 0.6;
  switch (th) {
    // ── Lagoon islands ──
    case "funny": many(n0, chick); many(n0 * 0.4, rooster); many(2, function(p) { prop(p, ENT.glb("cube", 1.2, new THREE.Group()), 0.7, 1.2); }); break;
    case "minion": many(n0 * 1.4, minion); break;
    case "emote": many(n0, function(p, z, i) { var keys = ["skin_man", "skin_casual", "skin_punk", "skin_hoodie", "skin_beach", "skin_dress"]; ENT.add({ type: "dancer", mesh: ENT.M.npc(keys[i % keys.length]), x: p.x, z: p.z, y: p.y, r: 0.4, h: 1.75, update: ENT.B.dancer, bounce: 0.15, spinOnBar: i % 2 === 0, clips: { a: ["Jump"], b: ["Sprint", "Run", "Walk"] }, knock: 3, yaw: srng() * 6 }); }); many(3, function(p) { prop(p, ENT.glb("arrow", 2.4, new THREE.Group()), 0.3, 2.4, { update: ENT.B.floater, spinRate: 0.6 }); }); break;
    case "public_poo": many(n0 * 0.6, function(p) { prop(p, typeof buildToilet === "function" ? buildToilet() : new THREE.Group(), 0.6, 1.2, { sway: 4 }); }); many(n0 * 0.5, function(p, z) { wanderer(p, z, typeof buildPoo === "function" ? buildPoo() : new THREE.Group(), { speed: 0.8, hop: 7, hopH: 0.35, r: 0.5, h: 0.8, knock: 3 }); }); break;
    case "eerie": many(n0 * 0.5, function(p, z, i) { ENT.add({ type: "ghost", mesh: ENT.ghostMesh(), x: p.x, z: p.z, y: p.y, r: 0.6, h: 2.2, speed: 1, update: ENT.B.ghost, home: { x: z.x, z: z.z, R: z.r + 6 }, phase: i * 1.7, fade: true, clips: ENT.GHOST_CLIPS }); }); ENT.bats(many, n0 * 0.35); many(n0 * 0.5, function(p) { tree(p, "tree", 5, 0.4); }); break;
    case "terrifying": case "screaming_mamamia":
      many(n0 * 0.45, function(p, z, i) { var gm = ENT.M.geyser(); ENT.add({ type: "geyser", mesh: gm.root, pool: gm.pool, col: gm.col, x: p.x, z: p.z, y: p.y + 0.02, r: 1.2, h: 7, update: ENT.B.geyser, freq: R(0.16, 0.24), phase: srng(), solid: false }); });
      many(n0 * 0.3, function(p) { prop(p, ENT.glb("spike", 1.6, typeof buildChaosSpike === "function" ? buildChaosSpike() : new THREE.Group()), 0.6, 1.6, { knock: 6 }); });
      if (th === "screaming_mamamia") many(n0 * 0.4, chick);
      break;
    case "tornado": for (var tn = 0; tn < 1 + Math.min(2, Math.floor(idx / 4)); tn++) { var tz = zones[(tn * 2 + 1) % zones.length], tp = tz && spot(tz, 10); if (tp) { var tm2 = ENT.M.tornado(); ENT.add({ type: "tornado", mesh: tm2.root, spin: tm2.spin, x: tp.x, z: tp.z, y: tp.y, r: 1.4, h: 11, speed: 1.6, update: ENT.B.vortex, knock: 6, solid: false }); } } many(n0 * 0.5, function(p) { tree(p, "tree", 5, 0.4); }); break;
    // ── Highlands ──
    case "mountains": many(n0 * 1.2, function(p) { tree(p, "pinetree", R(5, 8), 0.45); }); many(n0 * 0.5, function(p) { prop(p, ENT.glb("rock", R(1, 2.2), new THREE.Group()), 1, 1.6); }); if (idx >= 2) rollerAcross(1 + idx * 0.15, function() { return ENT.M.boulder(0.9); }, 3.2, 0.9); break;
    case "winter": many(n0 * 0.9, function(p) { tree(p, "xmastree", R(3.5, 6), 0.5); }); many(n0 * 0.5, function(p) { prop(p, ENT.M.snowman(), 0.6, 2.9); }); many(n0 * 0.7, function(p, z) { wanderer(p, z, ENT.M.penguin(), { speed: 1.1, flee: 4, waddle: 12, r: 0.35, h: 1.2 }); }); if (idx >= 3) rollerAcross(1, function() { var b = ENT.M.boulder(0.8); b.spin.children[0].material = ENT.mat(0xf6f9ff, { roughness: 0.8 }); return b; }, 2.6, 0.8); break;
    case "grandcanyon": many(n0 * 0.8, function(p) { prop(p, ENT.glb("prop_cactus", 3.4, ENT.M.cactus()), 0.4, 3.4, { knock: 4 }); }); many(n0 * 0.4, function(p) { prop(p, ENT.glb("rock", R(1, 2.5), new THREE.Group()), 1, 1.8); }); rollerAcross(1 + idx * 0.2, ENT.M.tumbleweed, 4.2, 0.6); break;
    case "waterfall": many(n0 * 1.1, function(p) { tree(p, "tree", R(5, 7), 0.5); }); many(n0 * 0.5, function(p) { prop(p, ENT.glb("rock", R(1, 2), new THREE.Group()), 1, 1.5); }); many(n0 * 0.3, chick); break;
    case "village": many(n0 * 0.5, function(p, z, i) { var off = 14 + srng() * 6, sp = { x: p.x + (srng() < 0.5 ? -off : off), z: p.z }; sp.y = c.heightAt(sp.x, sp.z); if (sp.y > c.hazard.level + 0.5) prop(sp, ENT.glb("prop_cottage", 5.5, ENT.M.house(LV.pick([0xf0e6d0, 0xe8d0b8, 0xd8e4f0, 0xf4e8a8]))), 3, 5.5, { yaw: Math.atan2(p.x - sp.x, p.z - sp.z) }); }); many(n0, chick); many(n0 * 0.4, rooster); many(n0 * 0.5, function(p) { tree(p, "tree", R(5, 7), 0.5); }); ENT.routeLanes(c, 1, function(lane) { ENT.add({ type: "tractor", mesh: ENT.glb("tractor", 2.4, typeof buildTractor === "function" ? buildTractor() : new THREE.Group()), x: lane.x0, z: lane.z0, r: 1.3, h: 2.4, speed: 2.2, update: ENT.B.lane, lane: lane, polite: true, honk: true, knock: 7 }); }); break;
    case "vetschool": many(n0 * 0.9, dog); many(n0 * 0.5, function(p, z) { wanderer(p, z, ENT.glb("animated_woman", 1.75, new THREE.Group()), { speed: 1.1, r: 0.4, h: 1.75, clips: { walk: ["Walking"], run: ["Running"], idle: ["Idle"] }, knock: 3, canSteal: false, carFan: true }); }); many(n0 * 0.3, rooster); break;
    case "cabbage": many(n0 * 2, function(p) { prop(p, ENT.glb("cabbage", R(0.8, 1.6), typeof buildCabbage === "function" ? buildCabbage() : new THREE.Group()), 0.5, 1); }); many(n0 * 0.6, bunny); ENT.routeLanes(c, 1, function(lane) { ENT.add({ type: "tractor", mesh: ENT.glb("tractor", 2.4, typeof buildTractor === "function" ? buildTractor() : new THREE.Group()), x: lane.x0, z: lane.z0, r: 1.3, h: 2.4, speed: 2.4, update: ENT.B.lane, lane: lane, polite: true, honk: true, knock: 7 }); }); break;
    case "feet_bunnies": many(n0 * 0.8, bunny); for (var fi = 0; fi < Math.round((1 + idx * 0.25) * dens); fi++) { var fz = zones[Math.floor(srng() * zones.length)], fp = fz && spot(fz, 8); if (!fp) continue; var fm = ENT.M.foot(); var fe = ENT.add({ type: "foot", mesh: new THREE.Group(), foot: fm.root, shadow: fm.shadow, x: fp.x, z: fp.z, y: fp.y, r: 1.6, h: 2, update: ENT.B.stomper, freq: R(0.18, 0.28), phase: srng(), knock: 9, knockUp: 6 }); fe.mesh.add(fm.root); fe.mesh.add(fm.shadow); } break;
    case "socks_basket": ENT.socks(c, zones, idx, dens); many(n0 * 0.4, function(p) { prop(p, typeof buildLaundryBasket === "function" ? buildLaundryBasket() : new THREE.Group(), 1.1, 1.2); }); break;
    // ── City ──
    case "city": {
      spawns.forEach(function(s) {
        if (s.kind !== "traffic") return;
        if (srng() > 0.55 * Math.min(1.6, dens)) return;
        var lane = s.axis === "z" ? { x0: s.x + 1.8, z0: s.from, x1: s.x + 1.8, z1: s.to } : { x0: s.from, z0: s.z - 1.8, x1: s.to, z1: s.z - 1.8 };
        var car = ENT.glb("car", 1.5, typeof buildCar === "function" ? buildCar() : new THREE.Group());
        ENT.add({ type: "car", mesh: car, x: lane.x0, z: lane.z0, r: 1.3, h: 1.6, speed: R(6, 10), update: ENT.B.lane, lane: lane, polite: true, honk: true, knock: 10 });
      });
      var sw = spawns.filter(function(s) { return s.kind === "sidewalks"; })[0];
      if (sw) for (var j = 0; j < Math.round(3 * dens); j++) {
        var a = LV.pointAt(sw.pts, srng() * 0.8), side = srng() < 0.5 ? -1 : 1, off = 7.5;
        var lane2 = { x0: a.x - a.dz * off * side - a.dx * 15, z0: a.z + a.dx * off * side - a.dz * 15, x1: a.x - a.dz * off * side + a.dx * 15, z1: a.z + a.dx * off * side + a.dz * 15 };
        jogger(lane2, j);
      }
      many(n0 * 0.3, dog);
      break;
    }
    // ── Club ──
    case "disco": case "neon": case "sixtyseven": case "map67": ENT.club(c, spawns, idx, dens, th); break;
    // ── Interiors ──
    case "backrooms": many(1 + idx * 0.15, function(p, z, i) { var gh = ENT.glb("entity", 2.6, ENT.M.ghost()); ENT.add({ type: "ghost", mesh: gh, x: p.x, z: p.z, y: p.y, r: 0.6, h: 2.6, speed: 0.9, update: ENT.B.ghost, home: { x: p.x, z: p.z, R: 40 }, phase: i, knock: 6 }); }); break;
    case "poolrooms": c.pools.forEach(function(pool) { if (srng() < 0.6) ENT.add({ type: "duck", mesh: ENT.glb("duck", 0.9, new THREE.Group()), x: pool.x + (srng() - 0.5) * pool.hw, z: pool.z + (srng() - 0.5) * pool.hd, y: pool.level, r: 0.4, h: 0.9, update: ENT.B.floater, spinRate: 0.3, solid: false }); }); break;
    case "office": many(2 + idx * 0.2, function(p) { prop(p, ENT.M.mug(), 1.5, 3.2); }); rollerAcross(1 + idx * 0.15, function() { var pc = ENT.M.pencil(); return { root: pc.root, spin: pc.spin }; }, 2.4, 0.42); break;
    // ── Blocks ──
    case "minecraft": many(n0 * 0.35, function(p, z) { ENT.add({ type: "creeper", mesh: ENT.M.creeper(), x: p.x, z: p.z, y: p.y, r: 0.4, h: 1.65, speed: 1.6, update: ENT.B.creeper, home: { x: p.x, z: p.z, R: 10 }, maxStep: 1.1, fuse: 0 }); }); many(n0 * 0.6, function(p, z) { wanderer(p, z, ENT.M.pig(), { speed: 0.9, r: 0.45, h: 0.9, maxStep: 1.1, flee: 3 }); }); many(n0 * 0.5, chick); break;
    case "skyblock": many(n0 * 0.5, chick); many(2, function(p) { prop(p, ENT.glb("sb_crate", 1, new THREE.Group()), 0.6, 1); }); break;
    case "geometry_dash": break;
    case "bouncy": ENT.bouncy(c, spawns, idx, dens); break;
    case "jungle": ENT.jungle(c, zones, idx, dens, spot); break;
    // ── Moon ──
    case "moon":
      many(n0 * 0.6, function(p) { prop(p, ENT.glb("moonrock", R(0.8, 2.2), new THREE.Group()), 0.9, 1.4); });
      many(1, function(p) { prop(p, ENT.glb("prop_lander", 4, ENT.M.lander()), 2.2, 4); });
      many(2, function(p) { prop(p, ENT.M.flag(), 0.1, 2.6, { solid: false }); });
      ENT.routeLanes(c, 1 + Math.floor(idx / 4), function(lane) { var rv0 = ENT.M.rover(), rv = ENT.glb("prop_rover", 2.2, rv0); ENT.add({ type: "rover", mesh: rv, wheels: rv0.userData.wheels, x: lane.x0, z: lane.z0, r: 1.3, h: 2, speed: 2.4, update: ENT.B.lane, lane: lane, polite: true, knock: 8 }); });
      many(n0 * 0.3, function(p, z, i) { var keys = ["skin_farmer", "skin_worker", "skin_casual"]; wanderer(p, z, ENT.M.npc(keys[i % 3]), { speed: 1, r: 0.4, h: 1.75, hop: 2.4, hopH: 1.2, clips: { walk: ["Walk"], run: ["Sprint", "Run"], idle: ["Idle"] } }); });
      break;
    // ── Castle ──
    case "hogwarts": many(n0 * 0.5, function(p, z) { wanderer(p, z, ENT.knightMesh(), { type: "knight", speed: 0.9, r: 0.45, h: 2.2, knock: 5, chase: 6, clips: { walk: ["Walk"], run: ["Run"], idle: ["Idle"] } }); }); many(n0 * 0.3, function(p, z, i) { ENT.add({ type: "ghost", mesh: ENT.ghostMesh(), x: p.x, z: p.z, y: p.y, r: 0.6, h: 2.2, speed: 1, update: ENT.B.ghost, home: { x: z.x, z: z.z, R: z.r + 6 }, phase: i, fade: true, clips: ENT.GHOST_CLIPS }); }); ENT.bats(many, n0 * 0.25); break;
  }
  // Always put a couple of thieves on the course when the Mischief mod is active
  if (steal && !ENT.list.some(function(o) { return o.canSteal; })) many(2, function(p, z) { wanderer(p, z, ENT.glb("chick", 0.7, ENT.M.pig()), { speed: 1.6, r: 0.35, h: 0.7, canSteal: true, clips: { walk: ["Run"], run: ["Run"], idle: ["Idle_Peck", "Idle"] } }); });
  GFX.batchStatic(ENT.batchGrp);
  courseGrp.add(ENT.batchGrp);
  return ENT.list;
};

// Zones: circles where critters and props are placed, derived from the level's spawn hints
ENT.zones = function(c, spawns) {
  var z = [];
  spawns.forEach(function(s) {
    if (s.kind === "island") z.push({ x: s.x, z: s.z, r: Math.max(2, s.r - 1.5) });
    else if (s.kind === "fairway" || s.kind === "voxel" || s.kind === "moon") { var pts = s.pts; for (var t = 0.12; t < 0.95; t += 0.08) { var p = LV.pointAt(pts, t); z.push({ x: p.x, z: p.z, r: (s.fw || 9) + 2 }); } }
    else if (s.kind === "cells") s.cells.forEach(function(cl) { if (!cl.pool) z.push({ x: cl.x, z: cl.z, r: s.S / 2 - 1.2 }); });
    else if (s.kind === "skyblock") s.isl.forEach(function(I, i) { if (i > 0) z.push({ x: I.x, z: I.z, r: I.r - 1 }); });
    else if (s.kind === "castle") s.plats.forEach(function(P, i) { if (i > 0) z.push({ x: P.x, z: P.z, r: Math.min(P.w, P.d) / 2 - 1 }); });
    else if (s.kind === "club") s.plats.forEach(function(P, i) { if (i > 0) z.push({ x: P.x, z: P.z, r: P.size / 2 - 1.2 }); });
    else if (s.kind === "bouncy") s.decks.forEach(function(D, i) { if (i > 0) z.push({ x: D.x, z: D.z, r: D.size / 2 - 2 }); });
    else if (s.kind === "sidewalks") { for (var u = 0.1; u < 0.95; u += 0.12) { var q = LV.pointAt(s.pts, u); z.push({ x: q.x, z: q.z, r: 6 }); } }
  });
  if (!z.length) c.route.forEach(function(p) { z.push({ x: p.x, z: p.z, r: 6 }); });
  return z;
};

// Lanes that cross the route (tractors, rovers)
ENT.routeLanes = function(c, n, make) {
  for (var i = 0; i < n; i++) {
    var p = LV.pointAt(c.route, 0.25 + 0.5 * (i + srng() * 0.5) / Math.max(1, n)), w = 14;
    var lane = { x0: p.x - p.dz * w, z0: p.z + p.dx * w, x1: p.x + p.dz * w, z1: p.z - p.dx * w };
    var g0 = c.heightAt(lane.x0, lane.z0), g1 = c.heightAt(lane.x1, lane.z1), hz = c.hazard.level;
    if (g0 < hz + 0.3) { lane.x0 = p.x - p.dz * 5; lane.z0 = p.z + p.dx * 5; }
    if (g1 < hz + 0.3) { lane.x1 = p.x + p.dz * 5; lane.z1 = p.z - p.dx * 5; }
    make(lane);
  }
};

// Laundry day: clotheslines across the fairway with giant socks swinging into your path
ENT.socks = function(c, zones, idx, dens) {
  var n = Math.round((2 + idx * 0.25) * dens), cols = [[0xff6a8a, 0xffffff], [0x6ab0ff, 0xffe06a], [0x8ae07a, 0xff9a3a], [0xb48aff, 0x6af0d0]];
  for (var i = 0; i < n; i++) {
    var p = LV.pointAt(c.route, 0.18 + 0.7 * (i + 0.5) / n), y = c.heightAt(p.x, p.z);
    if (y < c.hazard.level + 0.4) continue;
    var len = 10, sw = Math.atan2(p.dx, p.dz);              // local z = along the route, local x = across it
    var cx = Math.cos(sw), cz = -Math.sin(sw);              // world direction of local x
    var line = ENT.M.clothesline(len); line.position.set(p.x, y, p.z); line.rotation.y = sw; courseGrp.add(line);
    [-1, 1].forEach(function(e) { ENT.list.push({ type: "pole", mesh: line, x: p.x + cx * e * len / 2, z: p.z + cz * e * len / 2, r: 0.2, h: 4.4, worldY: y, y: y, solid: true, t: 0, update: null }); });
    for (var s = 0; s < 3; s++) {
      var off = (s - 1) * 3, sx = p.x + cx * off, sz = p.z + cz * off;
      var pivot = new THREE.Group(); pivot.position.set(0, 4.2, 0);
      var sock = ENT.M.sock(cols[(i + s) % 4][0], cols[(i + s) % 4][1]); sock.position.y = -0.3; pivot.add(sock);
      var root = new THREE.Group(); root.add(pivot);
      ENT.add({ type: "sock", mesh: root, pivot: pivot, x: sx, z: sz, y: y, yaw: sw, r: 0.75, h: 2.3, update: ENT.B.pendulum, amp: 0.8 + srng() * 0.25, freq: 1.3 + srng() * 0.5, phase: s * 2.1 + i, arm: 1.7, swingYaw: sw, knock: 7 });
    }
  }
};

// Club: robots & dancers grooving, DJ booth, sweeping lasers, disco balls
ENT.club = function(c, spawns, idx, dens, th) {
  var info = spawns.filter(function(s) { return s.kind === "club"; })[0]; if (!info) return;
  var plats = info.plats, pal = info.pal;
  plats.forEach(function(P, i) {
    if (i === 0) {
      ENT.add({ type: "booth", mesh: ENT.glb("booth", 1.6, typeof buildDiscoBooth === "function" ? buildDiscoBooth() : new THREE.Group()), x: P.x + P.size / 2 - 1.6, z: P.z + 1.5, y: P.y, r: 1, h: 1.6, update: ENT.B.dancer, bounce: 0.04, yaw: -Math.PI / 2 });
      return;
    }
    var n = Math.round((P.type === "dance" ? 3 : 1) * dens);
    for (var k = 0; k < n; k++) {
      var a = srng() * 6.28, r = srng() * (P.size / 2 - 1.8), x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      var robot = k % 2 === 0;
      var mesh = robot ? ENT.glb("robot", 2.0, new THREE.Group()) : ENT.M.npc(["skin_punk", "skin_hoodie", "skin_casual", "skin_beach"][k % 4]);
      ENT.add({ type: robot ? "robot" : "dancer", mesh: mesh, x: x, z: z, y: P.y, r: 0.5, h: 2, update: ENT.B.dancer, bounce: robot ? 0.35 : 0.12, spinOnBar: robot, squash: robot, clips: { a: ["Jump"], b: ["Sprint", "Run", "Walk"] }, knock: 5, yaw: srng() * 6 });
    }
    if (P.type === "dance" && (idx > 1 || dens > 1)) {
      var lz = ENT.M.laserRig(pal[i % pal.length], P.size * 0.9);
      ENT.add({ type: "laser", mesh: lz.root, beam: lz.beam, bm: lz.bm, x: P.x - P.size / 2 + 0.6, z: P.z, y: P.y, r: 0.3, h: 1.2, update: ENT.B.laser, sweep: 0.9, phase: i, len: P.size * 0.9, beamH: 1.05, baseYaw: Math.PI / 2, yaw: Math.PI / 2 });
    }
    if (P.type !== "speakers" && srng() < 0.7) {
      var db = ENT.M.discoBall(); db.root.position.set(P.x, P.y + 7, P.z); courseGrp.add(db.root);
      db.spots.forEach(function(s) { courseGrp.add(s); });
      (function(db, P) { c.updaters.push(function(T) { db.ball.rotation.y = T * 0.6; db.spots.forEach(function(s, j) { var a = T * 0.7 + j * 1.05; s.position.set(P.x + Math.cos(a) * P.size * 0.32, P.y + 0.03, P.z + Math.sin(a * 1.3) * P.size * 0.32); s.material.opacity = 0.45 * (c.dim === undefined ? 1 : c.dim); }); }); })(db, P);
    }
    // Boomboxes thumping on the speaker stages
    if (P.type === "speakers") ENT.add({ type: "boombox", mesh: ENT.glb("helmet", 1.4, new THREE.Group()), x: P.x, z: P.z, y: P.y, r: 0.8, h: 1.4, update: ENT.B.dancer, bounce: 0.2, squash: true });
  });
  // Big spotlight beams sweeping the sky
  for (var b = 0; b < 4; b++) {
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 3.5, 80, 16, 1, true), new THREE.MeshBasicMaterial({ color: pal[b % pal.length], transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.geometry.translate(0, 40, 0);
    var P0 = plats[(b * 2) % plats.length]; beam.position.set(P0.x + (b % 2 ? 6 : -6), P0.y - 2, P0.z);
    courseGrp.add(beam);
    (function(beam, b) { c.updaters.push(function(T) { beam.rotation.z = Math.sin(T * 0.4 + b * 1.7) * 0.5; beam.rotation.x = Math.cos(T * 0.33 + b) * 0.35; beam.material.opacity = 0.12 * (c.dim === undefined ? 1 : c.dim); }); })(beam, b);
  }
  // Blackout hits the club too: every light flickers harder over time
  if (HOLES[holeIdx].mods.indexOf("blackout") >= 0) c.updaters.push(function(T) { c.dim = Math.max(0.15, 1 - T / 120) * (Math.sin(T * 13) > 0.85 ? 0.2 : 1); });
};

// ── Per-frame update & collisions ────────────────────────────────────────────
// Creatures with AI (random choices, reacting to players) are simulated by the host
// only; everyone else follows the host's stream. Timed hazards run on the shared
// clock everywhere, so they line up without any network traffic.
ENT.isAI = function(o) { var u = o.update; return u === ENT.B.wander || u === ENT.B.goose || u === ENT.B.trex || u === ENT.B.raptor || u === ENT.B.lane || u === ENT.B.roller || u === ENT.B.vortex || u === ENT.B.creeper || u === ENT.B.ghost; };
ENT._sendAcc = 0;
ENT.update = function(dt) {
  ENT.now = typeof netTime === "function" ? netTime() : T;
  if (ENT.stealCD > 0) ENT.stealCD -= dt;
  var guest = ENT.isGuest();
  for (var i = 0; i < ENT.list.length; i++) {
    var o = ENT.list[i];
    o.t += dt;
    if (o.animFn) o.animFn(o, dt);   // procedural creatures animate from how they move (host and guests alike)
    if (!o.update) continue;
    if (o.seatedCar || o.toCar) continue;      // riding in / running to a car: the car logic moves them
    if (o.rag) {   // limp: physics owns the body, the collider follows the pelvis
      var pv = RAG.pelvis(o.mesh);
      if (pv) { o._ragP = pv.clone(); o.x = pv.x; o.z = pv.z; o.worldY = pv.y - 0.9; continue; }
      if (RAG.get(o.mesh)) continue;
      o.rag = false;
    }
    if (o.fly && !(guest && ENT.isAI(o))) { ENT.flyStep(o, dt); continue; }
    if (guest && ENT.isAI(o)) { ENT.follow(o, dt); continue; }
    try { o.update(o, dt); }
    catch (e) { if (!o._err) console.error("entity " + o.type + ":", e); o._err = true; o.update = null; continue; }
    if (o.update !== ENT.B.pendulum && o.mesh) ENT.sync(o);
    o.knockCD = (o.knockCD || 0) - dt;
  }
  // Bring the animated ones to life: stride-matched gaits, lean, and idle ones turn to watch players
  var players = [];
  if (typeof PL !== "undefined" && phase !== "MENU") players.push(PL.pos);
  if (typeof mpMode !== "undefined" && mpMode) remotePlayers.forEach(function(rp) { if (rp && rp.body) players.push(rp.body); });
  for (var a = 0; a < ENT.list.length; a++) {
    var e2 = ENT.list[a], m2 = e2.mesh;
    if (!m2 || !m2.userData.glbLoaded || !m2.userData.clipActions) continue;
    var spd = e2._ax === undefined ? 0 : Math.hypot(e2.x - e2._ax, e2.z - e2._az) / Math.max(dt, 1e-3);
    e2._spd = (e2._spd || 0) + (Math.min(spd, 20) - (e2._spd || 0)) * Math.min(1, dt * 10);
    e2._ax = e2.x; e2._az = e2.z;
    if (e2.update && !e2.fly && !(guest && ENT.isAI(e2)) && e2._spd < 0.15 && /critter|dancer|minion|jogger/.test(e2.type) && players.length) {
      var best = null, bd = 7;
      players.forEach(function(pp) { var d = Math.hypot(pp.x - e2.x, pp.z - e2.z); if (d < bd) { bd = d; best = pp; } });
      if (best && e2.type !== "dancer") {
        var want = Math.atan2(best.x - e2.x, best.z - e2.z), dyaw = want - e2.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        e2.yaw += dyaw * Math.min(1, dt * 2.5);
        m2.rotation.y = e2.yaw + (e2.yawOff || 0);
      }
    }
    ANIM.drive(m2, e2._spd, dt, { grounded: !e2.fly, ko: !!e2.fly });
    // heads follow players walking by
    if (!e2.fly && players.length && e2.type !== "dancer") {
      var lt = null, ld = 7;
      players.forEach(function(pp) { var d3 = Math.hypot(pp.x - e2.x, pp.z - e2.z); if (d3 < ld) { ld = d3; lt = pp; } });
      ANIM.look(m2, lt ? new THREE.Vector3(lt.x, lt.y + 1.6, lt.z) : null, dt);
    }
  }
  // Host → everyone: creature positions ~8 times a second
  if (typeof mpMode !== "undefined" && mpMode && myIdx === 0 && typeof sendToAll === "function") {
    ENT._sendAcc += dt;
    if (ENT._sendAcc >= 0.12) {
      ENT._sendAcc = 0;
      var st = [];
      for (var k = 0; k < ENT.list.length; k++) {
        var e = ENT.list[k]; if (!e.update || !ENT.isAI(e)) continue;
        st.push(k, Math.round(e.x * 100) / 100, Math.round(e.y * 100) / 100, Math.round(e.z * 100) / 100, Math.round(e.yaw * 100) / 100, e.fuse > 0 ? Math.round(e.fuse * 100) / 100 : 0);
      }
      if (st.length) sendToAll({ t: "ents", h: holeIdx, n: ENT.list.length, s: st });
    }
  }
};
// Knocked flying (bat, poop army): ballistic arc, tumbling, then back to normal
ENT.launch = function(o, vx, vy, vz) {
  if (o.state) { if (ENT.carrying === o) ENT.dropDisc(o, true); o.state = null; }
  if (ENT.ragdoll(o, vx, vy, vz)) return;          // people go limp …
  o.fly = { vx: vx, vy: vy, vz: vz };              // … critters tumble through the air
};
// Humanoid NPCs (joggers, dancers, knights …) ragdoll when hit: their AI pauses until they get up
ENT.ragdoll = function(o, vx, vy, vz) {
  if (typeof RAG === "undefined" || !o.mesh || o.rag || !RAG.can(o.mesh)) return false;
  var ok = RAG.start(o.mesh, { vel: [vx, vy, vz], hit: [vx * 0.4, vy * 0.3, vz * 0.4], kind: "ko", minT: 1.4, maxT: 6,
    onEnd: function(yaw) { o.rag = false; var p = o._ragP; if (p) { o.x = p.x; o.z = p.z; o.y = ENT.course().heightAt(o.x, o.z); } o.yaw = yaw; ENT.sync(o); } });
  if (ok) { o.rag = true; o.moving = false; o.knockNow = false; }
  return ok;
};
ENT.flyStep = function(o, dt) {
  var f = o.fly, c = ENT.course();
  f.vy -= 22 * dt; o.x += f.vx * dt; o.y += f.vy * dt; o.z += f.vz * dt;
  o.mesh.rotation.x += dt * 9; o.mesh.position.set(o.x, o.y, o.z); o.worldY = o.y;
  var g = c.heightAt(o.x, o.z);
  if (o.y <= g && f.vy < 0) { o.y = g; o.fly = null; o.mesh.rotation.x = 0; spawnParticleBurst(new THREE.Vector3(o.x, o.y + 0.3, o.z), new THREE.Color(0xffffff), 8); }
  if (o.y < c.hazardAt(o.x, o.z).level - 4) { o.fly = null; o.x = o.home.x; o.z = o.home.z; o.y = c.heightAt(o.x, o.z); o.mesh.rotation.x = 0; }   // splashed: respawn at home
};

// Guest: apply a host snapshot
ENT.applyNet = function(msg) {
  if (msg.h !== holeIdx || msg.n !== ENT.list.length) return;   // different hole, or still loading
  var s = msg.s;
  for (var i = 0; i + 5 < s.length; i += 6) {
    var o = ENT.list[s[i]]; if (!o) continue;
    o.net = { x: s[i + 1], y: s[i + 2], z: s[i + 3], yaw: s[i + 4] };
    o.fuse = s[i + 5];
  }
};
// Guest: glide toward the latest snapshot and animate from the observed speed
ENT.follow = function(o, dt) {
  if (o.seatedCar) return;
  o.knockCD = (o.knockCD || 0) - dt;
  if (o.net) {
    var k = Math.min(1, dt * 9), ox = o.x, oz = o.z;
    if (Math.hypot(o.net.x - o.x, o.net.z - o.z) > 8) { o.x = o.net.x; o.z = o.net.z; o.y = o.net.y; }
    o.x += (o.net.x - o.x) * k; o.z += (o.net.z - o.z) * k; o.y += (o.net.y - o.y) * k;
    var dy = o.net.yaw - o.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; o.yaw += dy * k;
    var sp = Math.hypot(o.x - ox, o.z - oz) / Math.max(dt, 1e-4);
    o.netSpd = (o.netSpd || 0) + (sp - (o.netSpd || 0)) * Math.min(1, dt * 6);
  }
  var v = o.netSpd || 0, moving = v > 0.3;
  o.moving = moving; o.v = v;
  if (o.update === ENT.B.lane || o.update === ENT.B.roller) o.knockNow = v > 1.5;
  if (o.update === ENT.B.ghost) { o.knockNow = true; o.knockF = 5; o.lift = 0.6 + Math.sin(ENT.now * 1.7 + o.phase) * 0.3; }
  if (o.update === ENT.B.creeper) ENT.E.fuse(o);
  if (o.update === ENT.B.vortex) ENT.E.vortex(o, dt);
  if (o.update === ENT.B.roller && o.spin) o.spin.rotation.x += v * dt / o.rollR;
  if (o.wheels) o.wheels.forEach(function(w) { w.rotation.x += v * dt * 2.5; });
  if (o.hop) o.lift = moving ? Math.abs(Math.sin(o.t * o.hop)) * (o.hopH || 0.4) : Math.max(0, (o.lift || 0) - dt * 3);
  if (o.waddle) o.mesh.rotation.z = moving ? Math.sin(o.t * o.waddle) * 0.14 : 0;
  if (o.clips) {
    if (o.clips.walk) ENT.play(o, v > 2.6 ? o.clips.run : moving ? o.clips.walk : o.clips.idle);
    else if (o.clips.a) ENT.play(o, o.clips.a);
  }
  ENT.sync(o);
};
ENT.clear = function() { ENT.list = []; ENT.carrying = null; ENT.stealCD = 8; ENT.landT = 0; };

ENT.collidePlayer = function(p, pl) {
  for (var i = 0; i < ENT.list.length; i++) {
    var o = ENT.list[i];
    if (!o.solid && !o.knockNow && !o.deadly) continue;
    var base = o.worldY !== undefined ? o.worldY : o.y;
    if (p.y > base + o.h || p.y + pl.HEIGHT < base) continue;
    var dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), R = o.r + pl.RADIUS;
    if (d >= R) continue;
    var nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
    if (o.deadly) { pl.fall("void"); AudioEngine.sfx("zap"); return; }
    // full sprint into something knee-high (rocks, cabbages, chickens…): faceplant
    if (o.solid && o.h < 2.2 && !/tree|car|pole|booth|lamp/.test(o.type) && pl.onGround && !(pl._tripCD > T) && typeof RAG !== "undefined" && !RAG.busy()) {
      var into = -(pl.vel.x * nx + pl.vel.z * nz);
      if (into > 5.6 && Math.hypot(pl.vel.x, pl.vel.z) > 6.2 && RAG.startLocal("trip", pl.vel.clone().setY(1.5), new THREE.Vector3(-nx * 3, 2.2, -nz * 3), 0.9)) {
        pl._tripCD = T + 4; if (o.update === ENT.B.wander) ENT.launch(o, -nx * 4, 5, -nz * 4);
        return;
      }
    }
    if ((o.knock || o.knockNow) && o.knockCD <= 0 && (o.knockNow || o.moving || o.knock > 5)) {
      o.knockCD = 1.0;
      pl.knock(nx, nz, o.knockF || o.knock || 6, o.knockUp || 4.5);
      AudioEngine.sfx("bonk");
      if (typeof _spawnBonkText === "function") _spawnBonkText(new THREE.Vector3(p.x, p.y + 2, p.z));
      if (o.type === "car" && o.honk) AudioEngine.sfx("honk");
    }
    if (o.solid) {
      // only push out if not able to stand on top (low props you can hop on)
      if (p.y > base + o.h - 0.4 && o.h < 1.4) continue;
      p.x = o.x + nx * R; p.z = o.z + nz * R;
    }
  }
};
