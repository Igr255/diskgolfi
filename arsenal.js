"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── ARSENAL — arcade discs with a trick ──────────────────────────────────────
//   🚀 Rocket     BOOST: press SPACE / tap / Ⓐ in flight for 0.75 s of afterburner
//   ⚒️ Anvil      SLAM: kills its forward speed and drives it straight down; the
//                 shockwave flattens players, launches critters, sets off barrels
//   🪃 Boomerang  CURL: flies dead straight until you press, then hooks hard
//                 (towards A / D if held, else the release curve, else left)
//   🦎 Gecko      passive: sticks to whatever it touches first and climbs walls
//                 all the way to the top (rooftops, cliff tops, pillars)
// Each flying disc carries a small state object; ARS.ctx points at the one being
// simulated so stepDisc (physics.js) can apply it to my disc and remote discs
// alike. Pressing the trick sends {t:"abil"} with the exact disc state, so every
// screen continues the same flight.
// ══════════════════════════════════════════════════════════════════════════════
var ARS = { me: null, ctx: null, _fx: 0 };

ARS.kind = function(type) { var d = DISCS[type]; return d && d.arcade || null; };
ARS.stateFor = function(type, side) { var k = ARS.kind(type); return k ? { k: k, used: false, t: 0, side: side || -1, boostT: 0, curlT: 0 } : null; };
ARS.sticks = function() { return !!(ARS.ctx ? ARS.ctx.k === "stick" : ARS.me && ARS.me.k === "stick" && phase === "FLYING"); };

// ── throw / trigger ──────────────────────────────────────────────────────────
ARS.onThrow = function() {
  ARS.me = ARS.stateFor(selectedDisc, releaseBank > 0.01 ? 1 : -1);
  ARS.hud(ARS.me ? "ready" : null);
  if (ARS.me && ARS.me.k === "stick") ARS.hud("passive");
  else if (ARS.me && typeof TIPS !== "undefined") TIPS.show("trick", { k: INPUT.glyph("jump"), a: (DISCS[selectedDisc].ability || "").toLowerCase() }, 200);
};
ARS.trigger = function() {
  var s = ARS.me;
  if (!s || s.used || s.k === "stick" || phase !== "FLYING" || (typeof CINE !== "undefined" && CINE.stopT > 0)) return false;
  if (s.k === "curl") { var a = (keys.a || keys.A) ? -1 : (keys.d || keys.D) ? 1 : 0; if (a) s.side = a; }
  s.used = true;
  ARS.start(s, discPos, discVel, true);
  if (mpMode) sendToAll({ t: "abil", from: myIdx, k: s.k, sd: s.side, p: [discPos.x, discPos.y, discPos.z].map(ARS._q), v: [discVel.x, discVel.y, discVel.z].map(ARS._q) });
  ARS.hud("used");
  if (typeof LOG !== "undefined") LOG.ev("ability", { k: s.k });
  return true;
};
ARS._q = function(n) { return Math.round(n * 1000) / 1000; };
ARS.onNet = function(m) {
  var rp = remotePlayers[m.from]; if (!rp || !rp.flying) return;
  if (!rp.ars) rp.ars = ARS.stateFor(rp.discType) || { k: m.k, t: 0 };
  rp.ars.used = true; rp.ars.side = m.sd || -1;
  rp.discPos.fromArray(m.p); rp.discVel.fromArray(m.v);
  ARS.start(rp.ars, rp.discPos, rp.discVel, false);
};
ARS.start = function(s, pos, vel, mine) {
  if (s.k === "boost") {
    s.boostT = 0.75;
    AudioEngine.sfx("rocket", 0.9, mine ? null : pos);
    if (mine) { CINE.boost = 1; CAMFX.kick(11); CINE.shake(0.3, 0.6); CINE.punch(0.08, 0.6); INPUT.rumble(0.6, 0.4, 600); }
  } else if (s.k === "slam") {
    s.slam = true;
    vel.x *= 0.04; vel.z *= 0.04; vel.y = Math.min(vel.y, 0) - 24;
    AudioEngine.sfx("whistleDown", 0.8, mine ? null : pos);
    if (mine) { CAMFX.kick(-6); INPUT.rumble(0.3, 0.2, 150); }
  } else if (s.k === "curl") {
    s.curlT = 1.75;
    AudioEngine.sfx("swipe", 0.8, mine ? null : pos);
    if (mine) CAMFX.kick(4);
  }
};

// ── physics (called from stepDisc with ARS.ctx set) ──────────────────────────
ARS.step = function(s, pos, vel, dt) {
  s.t += dt;
  if (s.boostT > 0) {
    s.boostT -= dt;
    var hs = Math.hypot(vel.x, vel.z) || 1, sp = vel.length();
    if (sp < 46) { vel.x += vel.x / hs * 40 * dt; vel.z += vel.z / hs * 40 * dt; }
    vel.y += (vel.y < 1.5 ? 16 : 5) * dt;
    if ((ARS._fx = (ARS._fx + 1) % 3) === 0) ARS._flame(pos, vel);
  }
  if (s.curlT > 0) {
    s.curlT -= dt;
    // turn the heading at ~2.3 rad/s toward the chosen side, keeping speed and height
    var a = s.side * 2.3 * dt, c = Math.cos(a), sn = Math.sin(a), vx = vel.x, vz = vel.z;
    vel.x = vx * c - vz * sn; vel.z = vx * sn + vz * c;
    vel.y += 6.5 * dt;
    if ((ARS._fx = (ARS._fx + 1) % 4) === 0) ARS._puff(pos, 0xffe07a);
  }
  if (s.slam && !s.slammed) vel.y -= 30 * dt;
};
// Ground contact: the slam's shockwave, the gecko's splat. Returns true when handled.
ARS.groundHit = function(s, pos, vel) {
  if (s.slam && !s.slammed) {
    s.slammed = true; vel.set(0, 0, 0);
    ARS.shock(pos.clone(), s === ARS.me);
    return true;
  }
  if (s.k === "stick" && vel.lengthSq() > 0.01) { vel.set(0, 0, 0); ARS.splat(pos); return true; }
  return false;
};
// Running into a wall: the gecko grabs on and starts climbing
ARS.wallHit = function(s, pos, vel) {
  if (s.k !== "stick" || s.climb) return false;
  var hs = Math.hypot(vel.x, vel.z); if (hs < 0.5) return false;
  s.climb = { dx: vel.x / hs, dz: vel.z / hs, h: 0 };
  vel.set(0, 0, 0); ARS.splat(pos);
  if (s === ARS.me) CINE.callout("CLIMBING!", "", "🦎");
  return true;
};
ARS.climbStep = function(s, pos, vel, dt) {
  var c = s.climb, h = HOLES[holeIdx]; vel.set(0, 0, 0);
  if (!h) return false;
  var step = 5.5 * dt; c.h += step; pos.y += step;
  var ax = pos.x + c.dx * 0.45, az = pos.z + c.dz * 0.45, top = terrainY(ax, az, h, holeIdx);
  if (top <= pos.y - 0.04) {   // over the lip: step onto the top and stay there
    pos.x = ax + c.dx * 0.35; pos.z = az + c.dz * 0.35; pos.y = terrainY(pos.x, pos.z, h, holeIdx) + 0.06;
    s.climb = null; s.topped = true; ARS.splat(pos);
    if (s === ARS.me && c.h > 2.5) CINE.callout("TOP OF THE WORLD!", "gold", Math.round(c.h) + " m up");
    return false;
  }
  if (c.h > 45) { s.climb = null; return false; }   // too tall: let go
  if ((ARS._fx = (ARS._fx + 1) % 10) === 0) ARS._puff(pos, 0x8aff6a);
  return true;
};

// ── effects ──────────────────────────────────────────────────────────────────
ARS._flame = function(pos, vel) {
  if (typeof _pMesh !== "function") return;
  var l = vel.length() || 1;
  for (var i = 0; i < 2; i++) {
    var m = _pMesh("sph", i ? 0xffd24a : 0xff5a1a, 0.12 + Math.random() * 0.1, true);
    _pAdd(m, pos.clone().addScaledVector(vel, -0.35 / l), new THREE.Vector3(-vel.x / l * 4 + (Math.random() - 0.5) * 2, -vel.y / l * 4 + (Math.random() - 0.5) * 2, -vel.z / l * 4 + (Math.random() - 0.5) * 2), 0.35, { grav: -1, drag: 3, shrink: true });
  }
  if (Math.random() < 0.5) spawnSkinParticle("smoke", pos.clone().addScaledVector(vel, -0.6 / l));
};
ARS._puff = function(pos, col) {
  if (typeof _pMesh !== "function") return;
  var m = _pMesh("sph", col, 0.07 + Math.random() * 0.05, true);
  _pAdd(m, pos.clone(), new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random(), (Math.random() - 0.5) * 1.5), 0.5, { grav: 0.5, drag: 2 });
};
ARS.splat = function(pos) {
  if (T - (ARS._splatT || 0) < 0.35) return;
  ARS._splatT = T;
  AudioEngine.sfx("splat", 0.8, pos);
  if (typeof spawnParticleBurst === "function") spawnParticleBurst(pos.clone(), new THREE.Color(0x7aff4a), 10);
};
// Anvil shockwave: every screen runs it for the disc it simulates; each player checks itself
ARS.shock = function(p, mine) {
  var owner = mine ? myIdx : ARS._ownerOf(p);
  AudioEngine.sfx("slam", 1, mine ? null : p);
  CINE.shake(0.75, 0.6, p);
  if (mine) { CINE.hitStop(0.1); CINE.punch(0.25, 1); CINE.callout("SLAM!", "boom"); INPUT.rumble(1, 0.9, 400); }
  if (typeof GAD !== "undefined") GAD.ring(p, 0xffe0a0, 7.5);
  if (typeof spawnDust === "function") { spawnDust(p.clone(), 1); spawnDust(p.clone().add(new THREE.Vector3(1, 0, 0)), 0.8); spawnDust(p.clone().add(new THREE.Vector3(-1, 0, 0.5)), 0.8); }
  if (typeof spawnParticleBurst === "function") spawnParticleBurst(p.clone().add(new THREE.Vector3(0, 0.3, 0)), new THREE.Color(0xc8b090), 26);
  // me inside the blast (my own slam can flatten me too)
  if (typeof PU !== "undefined") PU.blastMe(p.x, p.y + 0.5, p.z, 5.5, owner, "anvil", 15);
  if (typeof PU !== "undefined" && (mine || !mpMode)) PU.critterBlast(p.x, p.z, 7, 12);
  if (typeof GAD !== "undefined") GAD.blast(p, 4.5, mine);
};
ARS._ownerOf = function(p) {
  var best = -1, bd = 3;
  remotePlayers.forEach(function(rp, i) { if (rp && rp.ars && rp.ars.slam) { var d = rp.discPos.distanceTo(p); if (d < bd) { bd = d; best = i; } } });
  return best;
};

// ── HUD: the trick prompt (also a big tap button on touch screens) ───────────
ARS.hud = function(state) {
  var el = document.getElementById("ars-hud");
  if (!el) {
    el = document.createElement("button"); el.id = "ars-hud"; el.type = "button";
    el.addEventListener("pointerdown", function(e) { e.preventDefault(); e.stopPropagation(); ARS.trigger(); });
    (document.getElementById("ui") || document.body).appendChild(el);
  }
  clearTimeout(ARS._ht);
  if (!state) { el.className = ""; return; }
  var d = DISCS[selectedDisc] || {}, key = typeof INPUT !== "undefined" ? INPUT.glyph("jump") : "Space";
  if (state === "ready") el.innerHTML = "<kbd>" + key + "</kbd><span class='ic'>" + d.icon + "</span><b>" + d.ability + "!</b>";
  else if (state === "passive") el.innerHTML = "<span class='ic'>" + d.icon + "</span><b>" + d.ability + "</b><em>sticks &amp; climbs</em>";
  else el.innerHTML = "<span class='ic'>" + d.icon + "</span><b>" + d.ability + "!</b>";
  el.className = "on " + state;
  if (state !== "ready") ARS._ht = setTimeout(function() { el.className = ""; }, state === "passive" ? 1800 : 700);
};
ARS.tick = function() {
  if (ARS.me && phase !== "FLYING") { ARS.me = null; ARS.hud(null); }
};

// ── input: SPACE (and the pad's Ⓐ, which arrives as Space), click or tap the world ──
window.addEventListener("keydown", function(e) {
  if (e.code !== "Space" || e.repeat || typeof phase === "undefined" || phase !== "FLYING") return;
  if (ARS.trigger()) e.preventDefault();
});
window.addEventListener("pointerdown", function(e) {
  if (typeof phase === "undefined" || phase !== "FLYING" || typeof renderer === "undefined" || e.target !== renderer.domElement) return;
  if (e.button === 0 || e.pointerType === "touch") ARS.trigger();
});

// ── models: each trick disc looks like what it does ──────────────────────────
ARS.buildBody = function(g, type, opacity) {
  var d = DISCS[type], M = function(c, o) { var p = { color: c, roughness: 0.45, metalness: 0.1 }; if (o) Object.keys(o).forEach(function(k) { p[k] = o[k]; }); if (opacity < 1) { p.transparent = true; p.opacity = opacity; } return new THREE.MeshStandardMaterial(p); };
  var add = function(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; g.add(m); return m; };
  if (type === "rocket") {
    add(_discGeometry(), buildDiscMat(d.color, opacity));
    var white = M(0xf4f4f4), dark = M(0x2a2a30, { metalness: 0.6, roughness: 0.3 });
    var pod = add(new THREE.CylinderGeometry(0.13, 0.13, 0.62, 14), white, 0, 0.14, 0); pod.rotation.x = Math.PI / 2;
    var nose = add(new THREE.ConeGeometry(0.13, 0.26, 14), M(d.color), 0, 0.14, 0.44); nose.rotation.x = Math.PI / 2;
    var noz = add(new THREE.CylinderGeometry(0.1, 0.15, 0.12, 14, 1, true), dark, 0, 0.14, -0.37); noz.rotation.x = Math.PI / 2;
    var glow = add(new THREE.CircleGeometry(0.09, 14), new THREE.MeshBasicMaterial({ color: 0xffb03a }), 0, 0.14, -0.4); glow.rotation.y = Math.PI;
    [-1, 1].forEach(function(sx) { var f = add(new THREE.BoxGeometry(0.02, 0.14, 0.2), M(d.color), sx * 0.14, 0.2, -0.24); f.rotation.z = sx * 0.6; });
    g.userData.noSpin = true;
  } else if (type === "anvil") {
    var iron = M(0x4a505c, { metalness: 0.85, roughness: 0.35 });
    add(new THREE.CylinderGeometry(0.54, 0.5, 0.16, 32), iron);
    add(new THREE.TorusGeometry(0.52, 0.045, 8, 32), M(0x2a2e36, { metalness: 0.9, roughness: 0.3 }), 0, 0, 0).rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.34, 0.08, 0.14), iron, 0, 0.12, 0);             // the anvil on top
    add(new THREE.BoxGeometry(0.2, 0.06, 0.1), iron, 0, 0.19, 0);
    var horn = add(new THREE.ConeGeometry(0.06, 0.2, 10), iron, 0.26, 0.2, 0); horn.rotation.z = -Math.PI / 2;
    add(new THREE.BoxGeometry(0.38, 0.06, 0.18), iron, 0, 0.25, 0);
  } else if (type === "boomer") {
    var wood = M(0xf2b23a, { roughness: 0.5 }), red = M(0xe8402a), arm = new THREE.BoxGeometry(0.62, 0.05, 0.16);
    [0.55, -0.55].forEach(function(a, i) {
      var p = new THREE.Group(); p.rotation.y = a + Math.PI / 2; g.add(p);
      var m = new THREE.Mesh(arm, wood); m.position.x = 0.28; m.castShadow = true; p.add(m);
      var tip = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 14), wood); tip.position.x = 0.59; p.add(tip);
      var st = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.055, 0.17), red); st.position.x = 0.4; p.add(st);
    });
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.052, 14), wood);
  } else if (type === "gecko") {
    add(_discGeometry(), buildDiscMat(d.color, opacity));
    var cup = M(0xc8ff7a, { roughness: 0.3, transparent: true, opacity: 0.85 * opacity });
    for (var i = 0; i < 8; i++) { var a2 = i / 8 * Math.PI * 2; add(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), cup, Math.cos(a2) * 0.44, -0.05, Math.sin(a2) * 0.44).rotation.x = Math.PI; }
    var wh = M(0xffffff, { roughness: 0.2 }), bk = new THREE.MeshBasicMaterial({ color: 0x111111 });
    [-1, 1].forEach(function(sx) { add(new THREE.SphereGeometry(0.1, 12, 8), wh, sx * 0.14, 0.09, 0.12); add(new THREE.SphereGeometry(0.05, 10, 6), bk, sx * 0.14, 0.14, 0.18); });
  } else return false;
  return true;
};
