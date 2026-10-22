"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── BATTLE MODE ──────────────────────────────────────────────────────────────
// Party disc golf: everyone plays the hole at once and races to the basket.
//   • Points, not strokes: finishing order + score bonus (ace / eagle / birdie /
//     par) + "Downtown" long makes + speedruns + knockouts (revenge, domination).
//   • Hole clock: a time limit, overtime if nobody holes out, and once someone
//     finishes the others get a short window before they're locked out.
//   • Knockouts: discs, slaps (R), bats, cars and items send players flying and
//     stun them; the attacker gets a burst of speed.
//   • Dive (V): a quick forward roll that dodges hits.
// Network model: each player is the authority on themselves. Attackers detect
// direct hits and send "ko_hit"; area effects are checked by every player
// against their own position; the victim announces the knockout with "ko".
// ══════════════════════════════════════════════════════════════════════════════
var BT = {
  mode: "battle",                // lobby setting: "battle" (points) | "classic" (strokes)
  items: "normal",               // lobby setting: "off" | "normal" | "chaos"
  pts: [], hole: [], kos: [],    // match points, this hole's breakdown, knockouts
  lastKOBy: {}, streak: {},      // revenge / domination bookkeeping
  stunT: 0, immuneT: 0, frozenT: 0, shieldT: 0, diveT: 0, diveCd: 0,
  clock: null,                   // { dl: netTime deadline, k: "limit" | "overtime" | "finish", st }
  place: [], placed: 0, finished: false,
  feed: [],
  PLACE: [100, 80, 65, 55, 50, 50, 50, 50],
  KO_PTS: 15, REVENGE: 10, DOMINATE: 20,
};
BT.on = function() { return typeof mpMode !== "undefined" && mpMode && BT.mode === "battle"; };
BT.locked = function() { return BT.stunT > 0 || BT.frozenT > 0; };
BT.name = function(i) { return (playerNames[i] || ("Player " + (i + 1))).split(" ")[0]; };
BT.col = function(i) { return "#" + new THREE.Color(PLAYER_COLORS[i % PLAYER_COLORS.length]).getHexString(); };

// ── Match / hole lifecycle ───────────────────────────────────────────────────
BT.newMatch = function() {
  BT.pts = new Array(MAX_PLAYERS).fill(0);
  BT.kos = new Array(MAX_PLAYERS).fill(0);
  BT.lastKOBy = {}; BT.streak = {};
};
BT.holeLimit = function(h) { return Math.round(70 + (h.par || 3) * 26); };          // par 3 → 2:28
BT.speedTarget = function(h) { return 16 + (h.par || 3) * 9; };
BT.onHoleStart = function(h) {
  if (!BT.pts.length) BT.newMatch();
  BT.hole = []; for (var i = 0; i < MAX_PLAYERS; i++) BT.hole.push({ total: 0, chips: [], status: "" });
  BT.place = new Array(MAX_PLAYERS).fill(0); BT.placed = 0;
  BT.finished = false; BT.stunT = BT.frozenT = BT.shieldT = BT.diveT = 0; BT.immuneT = 3;
  document.body.classList.remove("bt-done");
  var wt = document.querySelector("#walk-hud .wh-txt"); if (wt) wt.textContent = "Walk to your disc";
  BT.clock = null; BT._firstFinish = null; BT.holeStartT = netTime();
  BT._tallyHide();
  BT._fx.forEach(function(f) { if (f.obj && f.obj.parent) f.obj.parent.remove(f.obj); }); BT._fx = [];
  if (BT.on()) BT.clock = { dl: netTime() + BT.holeLimit(h), k: "limit", st: netTime() };   // guests: provisional until the host's clock arrives
  if (BT.on() && myIdx === 0) {
    // send after the "next" message so guests have the new hole loaded
    setTimeout(function() { if (BT.clock) sendToAll({ t: "bt_clock", dl: BT.clock.dl, k: BT.clock.k, st: BT.clock.st, h: holeIdx }); }, 300);
  }
  BT.renderBoard();
};

// Host: drive the clock (overtime / lock-out window)
BT.tickHost = function() {
  if (!BT.on() || myIdx !== 0 || !BT.clock) return;
  var now = netTime(), c = BT.clock, changed = false;
  if (c.k === "limit" && now >= c.dl && BT.placed === 0) { c.k = "overtime"; c.dl = now + 20; changed = true; }
  if (changed) sendToAll({ t: "bt_clock", dl: c.dl, k: c.k, st: c.st, h: holeIdx });
};
BT.onFirstFinish = function() {   // host
  if (!BT.on() || myIdx !== 0 || !BT.clock || BT.clock.k === "finish") return;
  var dl = netTime() + 40;
  if (BT.clock.k === "overtime") dl = Math.min(dl, BT.clock.dl);
  BT.clock = { dl: dl, k: "finish", st: BT.clock.st };
  sendToAll({ t: "bt_clock", dl: dl, k: "finish", st: BT.clock.st, h: holeIdx });
  AudioEngine.sfx("zap");
};
// Everyone: locked out when the window closes
BT.tickClock = function() {
  if (!BT.on() || !BT.clock) return;
  var c = BT.clock;
  if ((c.k === "finish" || c.k === "overtime") && netTime() >= c.dl && !myHoleDone) BT.dnf();
};
BT.dnf = function() {
  if (myHoleDone) return;
  myHoleDone = true; playerDone[myIdx] = true;
  var thr = Math.min(12, throwCount + 2);
  playerThrows[myIdx] = thr; holeScores[holeIdx] = thr;
  if (!mpScoreRecorded[myIdx]) { mpTotals[myIdx] += thr - HOLES[holeIdx].par; mpScoreRecorded[myIdx] = true; }
  BT.hole[myIdx].status = "dnf";
  sendToAll({ t: "score", from: myIdx, throws: thr, hole: holeIdx, dnf: 1 });
  if (VEH && VEH.mySeat) VEH.exit();
  _flashPrompt("⏱ Time's up! No points for finishing this hole");
  AudioEngine.sfx("energy");
  BT.goRoam();
  updateMpUI();
  checkAllDone();
};

// Score message from any player (including me) → bonuses; the host also hands out places
BT.onScore = function(i, throws, msg) {
  if (!BT.on()) return;
  var h = HOLES[holeIdx]; if (!h) return;
  var H = BT.hole[i]; if (!H || H.scored) return;
  H.scored = true;
  if (msg && msg.dnf) { H.status = "dnf"; BT.renderBoard(); return; }
  H.status = "done";
  var d = throws - h.par;
  if (throws === 1) BT.addPts(i, "Ace!", 100);
  else if (d <= -2) BT.addPts(i, "Eagle", 50);
  else if (d === -1) BT.addPts(i, "Birdie", 25);
  else if (d === 0) BT.addPts(i, "Par", 10);
  if (msg && msg.lm > 20) BT.addPts(i, "Downtown " + Math.round(msg.lm) + " m", 15);
  if (msg && msg.el && msg.el < BT.speedTarget(h)) BT.addPts(i, "Speedrun", 10);
  if (myIdx === 0) {
    var place = ++BT.placed;
    sendToAll({ t: "bt_place", i: i, p: place, h: holeIdx });
    BT.onPlace(i, place);
    if (place === 1) BT.onFirstFinish();
  }
};
BT.onPlace = function(i, place) {
  if (BT.place[i]) return;
  BT.place[i] = place;
  var medal = ["🥇", "🥈", "🥉"][place - 1] || "#" + place;
  BT.addPts(i, medal + " " + _ordinal(place), BT.PLACE[place - 1] || 50);
  if (i !== myIdx) BT.feedAdd("<b style='color:" + BT.col(i) + "'>" + _esc(BT.name(i)) + "</b> finished " + medal);
};
function _ordinal(n) { return n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"); }
function _esc(s) { return String(s).replace(/[<>&"]/g, function(c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }

BT.addPts = function(i, label, v) {
  if (!BT.on() || !BT.hole[i]) return;
  BT.hole[i].chips.push({ l: label, v: v }); BT.hole[i].total += v; BT.pts[i] += v;
  if (i === myIdx) BT.popup("+" + v + " " + label);
  BT.renderBoard();
  var tl = document.getElementById("bt-tally");
  if (tl && tl.style.display === "flex") { tl.classList.add("static"); BT.tally(); }   // late results update the open tally in place
};

// ── Knockouts ────────────────────────────────────────────────────────────────
// Attacker side: I hit player `target` with `cause`
BT.hit = function(target, cause, dx, dz, force, up) {
  if (target === myIdx) { BT.receiveHit({ by: myIdx, c: cause, dx: dx, dz: dz, f: force, u: up }); return; }
  if (!mpMode) return;
  var rp = remotePlayers[target];
  if (rp && (rp.shieldT > 0 || rp.koT > 0)) { if (rp.body) BT.spark(rp.body); return; }
  if (rp) rp.koT = 0.25;   // stop double hits until the victim confirms
  sendToAll({ t: "ko_hit", target: target, by: myIdx, c: cause, dx: +dx.toFixed(3), dz: +dz.toFixed(3), f: +force.toFixed(1), u: +up.toFixed(1) });
};
var _KO_WORDS = { disc: "DISC TO THE FACE!", slap: "SLAPPED!", bat: "HOME RUN!", car: "ROADKILL!", rocket: "KABOOM!", mine: "BOOM!", dart: "BULLSEYE!", laser: "VAPORISED!", freeze: "FROZEN!", poop: "SPLAT!", horn: "HONK!", fire: "TOASTED!", boom: "KABOOM!" };
var _KO_ICONS = { disc: "🥏", slap: "✋", bat: "🏏", car: "🚗", rocket: "🚀", mine: "💣", dart: "🔫", laser: "🛰️", freeze: "❄️", poop: "💩", fire: "🔥", boom: "💥" };
// Victim side
BT.receiveHit = function(m) {
  if (phase === "MENU" || !HOLES[holeIdx]) return;
  var dodge = BT.diveT > 0 && /disc|rocket|dart|slap|car/.test(m.c);
  if (BT.immuneT > 0 || BT.shieldT > 0 || dodge || PL.respawnT > 0) {
    BT.spark(PL.pos); if (dodge) _spawnBonkText(PL.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), "DODGED!");
    return;
  }
  BT.knockMe(m.by, m.c, m.dx || 0, m.dz || 0, m.f || 10, m.u || 8);
};
BT.knockMe = function(by, cause, dx, dz, force, up) {
  if (typeof VEH !== "undefined" && VEH.mySeat) VEH.exit();
  if (phase === "AIMING") { _cancelDrag(); startWalking(false); }
  var freeze = cause === "freeze";
  if (freeze) { BT.frozenT = 3.0; PL.vel.set(0, 0, 0); BT.iceOn(localAvatarMesh, true); }
  else {
    var l = Math.hypot(dx, dz) || 1;
    PL.vel.set(dx / l * force, up, dz / l * force); PL.onGround = false; PL.airT = 0.01;
  }
  BT.stunT = freeze ? 3.0 : 2.0; BT.immuneT = BT.stunT + 1.6;
  PL._setAnim(freeze ? "idle" : "death");
  BT.starsOn(localAvatarMesh, true);
  _spawnBonkText(PL.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), _KO_WORDS[cause] || "KO!");
  AudioEngine.sfx(freeze ? "splash" : "bonk");
  _screenShake = 0.55; _screenShakeT = 0.5;
  BT.koFlash(); CAMFX.kick(-7);
  if (mpMode) sendToAll({ t: "ko", v: myIdx, by: by, c: cause });
  BT.onKO(myIdx, by, cause);
};
// Everyone: someone was knocked out
BT.onKO = function(v, by, cause) {
  var self = by === v || by < 0 || by === undefined;
  if (v !== myIdx) {
    var rp = remotePlayers[v];
    if (rp) { rp.koT = cause === "freeze" ? 3.0 : 2.0; if (rp.avatarMesh) { BT.starsOn(rp.avatarMesh, true); if (cause === "freeze") BT.iceOn(rp.avatarMesh, true); } }
  }
  if (self) { BT.feedAdd(_KO_ICONS[cause] + " <b style='color:" + BT.col(v) + "'>" + _esc(BT.name(v)) + "</b> knocked themselves out"); return; }
  BT.kos[by] = (BT.kos[by] || 0) + 1;
  var tag = "";
  if (BT.on()) {
    BT.addPts(by, "KO " + BT.name(v), BT.KO_PTS);
    if (BT.lastKOBy[by] === v) { BT.addPts(by, "Revenge", BT.REVENGE); tag = " · REVENGE"; BT.lastKOBy[by] = null; }
    var key = by + ">" + v; BT.streak[key] = (BT.streak[key] || 0) + 1; BT.streak[v + ">" + by] = 0;
    if (BT.streak[key] === 3) { BT.addPts(by, "Dominating " + BT.name(v), BT.DOMINATE); tag = " · DOMINATING"; }
  }
  BT.lastKOBy[v] = by;
  BT.feedAdd("<b style='color:" + BT.col(by) + "'>" + _esc(BT.name(by)) + "</b> " + (_KO_ICONS[cause] || "💥") + " <b style='color:" + BT.col(v) + "'>" + _esc(BT.name(v)) + "</b>" + tag);
  if (by === myIdx) {
    // the rush of a knockout: a few seconds of extra speed
    if (typeof PU !== "undefined") PU.active.speed = Math.max(PU.active.speed || 0, T + 3);
    AudioEngine.sfx("pickup");
    if (tag) _flashPrompt(tag.replace(" · ", "") + "!");
  }
  BT.renderBoard();
};

// Per-frame (local player + remote KO visuals)
BT.update = function(dt) {
  if (BT.immuneT > 0) BT.immuneT -= dt;
  if (BT.shieldT > 0) { BT.shieldT -= dt; if (BT.shieldT <= 0) BT.bubbleOn(localAvatarMesh, false); }
  if (BT.diveT > 0) BT.diveT -= dt;
  if (BT.diveCd > 0) BT.diveCd -= dt;
  if (BT.frozenT > 0) { BT.frozenT -= dt; if (BT.frozenT <= 0) { BT.iceOn(localAvatarMesh, false); AudioEngine.sfx("splash"); } }
  if (BT.stunT > 0) {
    BT.stunT -= dt;
    if (BT.stunT <= 0) { BT.starsOn(localAvatarMesh, false); PL._setAnim("idle"); PL.anim = "_"; }
  }
  // blink while immune after a knockout
  if (localAvatarMesh && BT.immuneT > 0 && BT.stunT <= 0) localAvatarMesh.visible = localAvatarMesh.visible && Math.sin(T * 30) > -0.3;
  if (mpMode) remotePlayers.forEach(function(rp) {
    if (!rp) return;
    if (rp.koT > 0) { rp.koT -= dt; if (rp.koT <= 0 && rp.avatarMesh) { BT.starsOn(rp.avatarMesh, false); BT.iceOn(rp.avatarMesh, false); } }
    if (rp.shieldT > 0) { rp.shieldT -= dt; if (rp.shieldT <= 0 && rp.avatarMesh) BT.bubbleOn(rp.avatarMesh, false); }
  });
  BT._spin(dt);
  BT.tickHost(); BT.tickClock();
  if ((BT._uiAcc = (BT._uiAcc || 0) + dt) > 0.25) { BT._uiAcc = 0; BT.renderClock(); if (BT.on()) BT.renderBoard(); }
};

// ── Dive (V) ─────────────────────────────────────────────────────────────────
BT.dive = function() {
  if (phase !== "WALKING" || BT.locked() || BT.diveCd > 0 || !PL.onGround || (typeof VEH !== "undefined" && VEH.mySeat)) return;
  var fx = Math.sin(PL.yaw), fz = Math.cos(PL.yaw);
  var inp = PL._input(); if (inp.mag > 0.1) { fx = inp.x; fz = inp.z; PL.yaw = Math.atan2(fx, fz); }
  PL.vel.set(fx * 11.5, 3.4, fz * 11.5); PL.onGround = false;
  BT.diveT = 0.55; BT.diveCd = 1.0;
  PL._setAnim("roll"); PL.animT = 0.6;
  AudioEngine.sfx("swipe");
};

// ── Disc vs players / discs (my disc in flight) ──────────────────────────────
BT.discSweep = function(pos, vel, fire) {
  if (!mpMode) return;
  var sp = vel.length(); if (sp < 6) return;
  BT._hitThisThrow = BT._hitThisThrow || {};
  remotePlayers.forEach(function(rp, i) {
    if (!rp || !rp.body || BT._hitThisThrow["p" + i]) return;
    var dy = pos.y - rp.body.y;
    if (dy < 0.1 || dy > 2.0 || Math.hypot(pos.x - rp.body.x, pos.z - rp.body.z) > 0.8) return;
    BT._hitThisThrow["p" + i] = 1;
    BT.hit(i, fire ? "fire" : "disc", vel.x, vel.z, (fire ? 16 : 7) + sp * 0.4, fire ? 12 : 7);
    _spawnBonkText(rp.body.clone().add(new THREE.Vector3(0, 2.2, 0)), "BONK!");
    AudioEngine.sfx("bonk");
    if (!fire) { vel.x *= -0.25; vel.z *= -0.25; vel.y = Math.abs(vel.y) * 0.3 + 2; }
  });
  remotePlayers.forEach(function(rp, i) {
    if (!rp || rp.flying || !rp.discMesh || !rp.discMesh.visible || BT._hitThisThrow["d" + i]) return;
    if (Math.abs(pos.y - rp.discPos.y) > 0.9 || Math.hypot(pos.x - rp.discPos.x, pos.z - rp.discPos.z) > 0.85) return;
    BT._hitThisThrow["d" + i] = 1;
    var k = Math.min(1, sp / 25);
    sendToAll({ t: "disc_bump", target: i, vx: +(vel.x * k).toFixed(2), vz: +(vel.z * k).toFixed(2), by: myIdx });
    spawnParticleBurst(rp.discPos.clone(), new THREE.Color(0xffffff), 10);
    AudioEngine.sfx("bonk", 0.4);
  });
};
// My resting disc got hit: it slides away (never into a hazard)
BT.bumpMyDisc = function(vx, vz, by) {
  if (BT.finished || !(phase === "WALKING" || phase === "LANDED" || phase === "AIMING")) return;
  var C = HOLES[holeIdx] && HOLES[holeIdx].course; if (!C) return;
  if (phase === "AIMING") startWalking(false);
  var dist = Math.min(9, 2 + Math.hypot(vx, vz) * 0.35), l = Math.hypot(vx, vz) || 1, ok = discPos.clone();
  for (var s = 0.5; s <= dist; s += 0.5) {
    var x = discPos.x + vx / l * s, z = discPos.z + vz / l * s, g = C.heightAt(x, z);
    if (g < C.hazardAt(x, z).level + 0.3 || Math.abs(g - ok.y) > 1.2) break;
    ok.set(x, g + 0.06, z);
  }
  discPos.copy(ok); discLie = ok.clone();
  _flashPrompt("💢 " + BT.name(by) + " knocked your disc away!");
  if (mpMode) sendToAll({ t: "land", from: myIdx, px: discPos.x, py: discPos.y, pz: discPos.z, throws: throwCount });
};

// ── Finished: keep running around (and causing trouble) ──────────────────────
BT.goRoam = function() {
  BT.finished = true;
  setTimeout(function() {
    if (!BT.finished || !HOLES[holeIdx] || phase === "MENU") return;
    hideMsg(); setSpectating(false);
    phase = "WALKING"; _pickupArmed = false;
    if (discMesh) discMesh.visible = false;
    if (discMarker) discMarker.visible = false;
    _setWalkHud(true);
    document.body.classList.add("bt-done");
    var wt = document.querySelector("#walk-hud .wh-txt"); if (wt) wt.textContent = "Finished — wreak havoc";
    _flashPrompt("You're done — grab items and mess with the others!");
  }, 2400);
};

// ── Feedback: feed, popups, flashes ──────────────────────────────────────────
BT.feedAdd = function(html) {
  var el = document.getElementById("bt-feed");
  if (!el) { el = document.createElement("div"); el.id = "bt-feed"; (document.getElementById("ui") || document.body).appendChild(el); }
  var row = document.createElement("div"); row.className = "bt-feed-row glass"; row.innerHTML = html;
  el.prepend(row);
  while (el.children.length > 5) el.lastChild.remove();
  setTimeout(function() { row.classList.add("out"); setTimeout(function() { row.remove(); }, 500); }, 5000);
};
BT.popup = function(txt) {
  var el = document.createElement("div"); el.className = "bt-pop"; el.textContent = txt;
  (document.getElementById("ui") || document.body).appendChild(el);
  setTimeout(function() { el.remove(); }, 1600);
};
BT.koFlash = function() {
  var el = document.getElementById("bt-koflash");
  if (!el) { el = document.createElement("div"); el.id = "bt-koflash"; document.body.appendChild(el); }
  el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
};

// ── Avatar attachments: KO stars, ice block, shield bubble ───────────────────
BT._spinners = [];
BT._shared = {};
BT._mat = function(k, make) { return BT._shared[k] || (BT._shared[k] = make()); };
BT.starsOn = function(av, on) {
  if (!av) return;
  var old = av.getObjectByName("bt_stars"); if (old) av.remove(old);
  if (!on) return;
  var g = new THREE.Group(); g.name = "bt_stars"; g.position.y = 2.15;
  var mat = BT._mat("star", function() { return new THREE.MeshBasicMaterial({ color: 0xffe14a }); });
  var geo = BT._mat("starGeo", function() { var s = new THREE.Shape(); for (var i = 0; i < 10; i++) { var r = i % 2 ? 0.05 : 0.12, a = i / 10 * Math.PI * 2; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(r, 0); } var gg = new THREE.ShapeGeometry(s); gg.userData.shared = true; return gg; });
  for (var i = 0; i < 4; i++) { var m = new THREE.Mesh(geo, mat); var a = i / 4 * Math.PI * 2; m.position.set(Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38); g.add(m); }
  av.add(g); BT._spinners.push(g);
};
BT.iceOn = function(av, on) {
  if (!av) return;
  var old = av.getObjectByName("bt_ice"); if (old) av.remove(old);
  if (!on) return;
  var ice = new THREE.Mesh(BT._mat("iceGeo", function() { var gg = new THREE.BoxGeometry(1.1, 2.2, 1.1); gg.translate(0, 1.05, 0); gg.userData.shared = true; return gg; }),
    BT._mat("ice", function() { return new THREE.MeshPhysicalMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1, depthWrite: false }); }));
  ice.name = "bt_ice"; av.add(ice);
};
BT.bubbleOn = function(av, on) {
  if (!av) return;
  var old = av.getObjectByName("bt_bubble"); if (old) av.remove(old);
  if (!on) return;
  var b = new THREE.Mesh(BT._mat("bubGeo", function() { var gg = new THREE.SphereGeometry(1.25, 24, 16); gg.userData.shared = true; return gg; }),
    BT._mat("bub", function() { return new THREE.MeshBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }); }));
  b.name = "bt_bubble"; b.position.y = 1.0; av.add(b); BT._spinners.push(b);
};
BT._spin = function(dt) {
  for (var i = BT._spinners.length - 1; i >= 0; i--) {
    var s = BT._spinners[i]; if (!s.parent) { BT._spinners.splice(i, 1); continue; }
    s.rotation.y += dt * (s.name === "bt_bubble" ? 1.2 : 5);
    if (s.name === "bt_bubble") s.scale.setScalar(1 + Math.sin(T * 6) * 0.03);
  }
};
BT.spark = function(p) { spawnParticleBurst(new THREE.Vector3(p.x, p.y + 1.2, p.z), new THREE.Color(0x9adcff), 10); AudioEngine.sfx("zap", 0.4); };

// World effects that live for the hole (mines, rockets …) — removed on hole change
BT._fx = [];

// ── HUD: points board, hole clock, end-of-hole tally ─────────────────────────
BT.renderBoard = function() {
  if (typeof updateMpUI === "function" && mpMode) updateMpUI();
};
BT.boardRow = function(i) {   // used by updateMpUI in battle mode
  var H = BT.hole[i] || {}, st;
  if (BT.place[i]) st = (["🥇", "🥈", "🥉"][BT.place[i] - 1] || "#" + BT.place[i]) + " +" + H.total;
  else if (H.status === "dnf") st = "⏱ DNF";
  else if (remotePlayers[i] && remotePlayers[i].koT > 0 || (i === myIdx && BT.stunT > 0)) st = "💫 KO'd";
  else st = i === myIdx ? (throwCount ? "throw " + throwCount : "") : (H.total ? "+" + H.total : "");
  return { score: BT.pts[i] + "", sub: st };
};
BT.renderClock = function() {
  var el = document.getElementById("bt-clock");
  if (!BT.on() || !BT.clock || phase === "MENU") { if (el) el.style.display = "none"; return; }
  if (!el) { el = document.createElement("div"); el.id = "bt-clock"; el.className = "glass"; (document.getElementById("ui") || document.body).appendChild(el); }
  var left = Math.max(0, BT.clock.dl - netTime()), m = Math.floor(left / 60), s = Math.floor(left % 60);
  var lbl = BT.clock.k === "finish" ? "Finish!" : BT.clock.k === "overtime" ? "OVERTIME" : "Hole time";
  el.style.display = "flex";
  el.className = "glass" + (BT.clock.k !== "limit" ? " hot" : "") + (left < 10 && BT.clock.k !== "limit" ? " crit" : "");
  el.innerHTML = "<span>" + lbl + "</span><b>" + m + ":" + (s < 10 ? "0" : "") + s + "</b>";
  if (BT.clock.k !== "limit" && left < 10 && left > 0 && Math.floor(left) !== BT._lastTick && !myHoleDone) { BT._lastTick = Math.floor(left); AudioEngine.sfx("step", 0.9); }
};
// End-of-hole breakdown (shown by checkAllDone in battle mode)
BT.tally = function() {
  var ui = document.getElementById("ui") || document.body, el = document.getElementById("bt-tally");
  if (!el) { el = document.createElement("div"); el.id = "bt-tally"; ui.appendChild(el); }
  var left = window._leftPlayers || {}, rows = [];
  for (var i = 0; i < playerCount; i++) if (!left[i]) rows.push(i);
  rows.sort(function(a, b) { return BT.pts[b] - BT.pts[a]; });
  el.innerHTML = "<div class='sheet glass'><h3>Hole " + (holeIdx + 1) + " results</h3>" + rows.map(function(i, r) {
    var H = BT.hole[i];
    return "<div class='bt-row" + (i === myIdx ? " me" : "") + "' style='--d:" + (r * 0.12) + "s'><span class='rk'>" + (r + 1) + "</span><b style='color:" + BT.col(i) + "'>" + _esc(BT.name(i)) + "</b>" +
      "<span class='chips'>" + (H.chips.length ? H.chips.map(function(c) { return "<i>" + _esc(c.l) + " <em>+" + c.v + "</em></i>"; }).join("") : "<i class='none'>" + (H.status === "dnf" ? "Locked out" : "—") + "</i>") + "</span>" +
      "<span class='ht'>+" + H.total + "</span><span class='mt'>" + BT.pts[i] + "</span></div>";
  }).join("") + "</div>";
  el.style.display = "flex";
};
BT._tallyHide = function() { var el = document.getElementById("bt-tally"); if (el) { el.style.display = "none"; el.classList.remove("static"); } };
BT.winner = function() {
  var best = -1, bi = 0, left = window._leftPlayers || {};
  for (var i = 0; i < playerCount; i++) if (!left[i] && BT.pts[i] > best) { best = BT.pts[i]; bi = i; }
  return bi;
};

// ── Network ──────────────────────────────────────────────────────────────────
BT.handle = function(msg) {
  switch (msg.t) {
    case "bt_clock": if (msg.h === holeIdx) BT.clock = { dl: msg.dl, k: msg.k, st: msg.st }; if (msg.k === "finish") AudioEngine.sfx("zap"); return true;
    case "bt_place": if (msg.h === holeIdx) BT.onPlace(msg.i, msg.p); return true;
    case "ko_hit": if (msg.target === myIdx) BT.receiveHit(msg); return true;
    case "ko": BT.onKO(msg.v, msg.by, msg.c); return true;
    case "disc_bump": if (msg.target === myIdx) BT.bumpMyDisc(msg.vx, msg.vz, msg.by); return true;
  }
  return false;
};

// Keys: V dive
window.addEventListener("keydown", function(e) {
  var tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || e.repeat) return;
  if (e.code === "KeyV" && typeof phase !== "undefined" && phase !== "MENU") BT.dive();
});
