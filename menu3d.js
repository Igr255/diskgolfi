"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── MENU STAGE — your golfer hangs out next to the menu ──────────────────────
// On the menu island your own character (current skin, hat, disc) stands beside
// the clipboard menu: it follows your mouse with its eyes, fidgets, waves, practises
// its throw, busts out a dance, backflips — and if you click it, it gets bonked
// and goes flying (ragdoll). It reacts when you open Play / Multiplayer too.
// Wide screens frame it on the left of the clipboard; on phones it's part of the
// slow island fly-around behind the card.
// ══════════════════════════════════════════════════════════════════════════════
var MENU3D = { g: null, disc: null, sig: "", next: 3, act: null, mouse: new THREE.Vector2(0, 0), P: new THREE.Vector3(-2.8, 0, 3.2), sigT: 0 };
MENU3D.wide = function() { return innerWidth >= 900 && innerWidth > innerHeight * 1.15; };
MENU3D._sig = function() {
  return [equippedPlayerSkin, JSON.stringify(typeof COS !== "undefined" ? COS.equipped() : null), selectedDisc, (equippedSkins || {})[selectedDisc] || ""].join("|");
};
MENU3D.build = function() {
  MENU3D.clear();
  var y = -1.5 + ISLAND_TOP; MENU3D.P.y = y;
  var g = MENU3D.g = buildPlayerAvatar(myIdx, PLAYER_COLORS[myIdx % PLAYER_COLORS.length]);
  g.position.copy(MENU3D.P); courseGrp.add(g);
  var d = MENU3D.disc = buildDisc(selectedDisc); d.scale.setScalar(DISC_SCALE_HAND * 1.15); d.visible = false; courseGrp.add(d);
  MENU3D.sig = MENU3D._sig(); MENU3D.next = 2.5; MENU3D.act = null;
  // the ragdoll needs a floor to land on: the menu island
  RAG.ground = { gravity: 1, ceiling: null, inBounds: function() { return true; },
    heightAt: function(x, z) { return Math.hypot(x, z) < 8.6 ? y : -30; } };
};
MENU3D.clear = function() {
  if (MENU3D.g) { RAG.stop(MENU3D.g, true); if (MENU3D.g.parent) MENU3D.g.parent.remove(MENU3D.g); }
  if (MENU3D.disc && MENU3D.disc.parent) MENU3D.disc.parent.remove(MENU3D.disc);
  MENU3D.g = MENU3D.disc = null; RAG.ground = null;
};

// ── camera ──
MENU3D._cam = new THREE.Vector3(); MENU3D._look = new THREE.Vector3();
MENU3D.camera = function(t) {
  if (!MENU3D.wide() || !MENU3D.g) { _menuCamera(t); return false; }
  var P = MENU3D.P, a = -0.62 + Math.sin(t * 0.13) * 0.1, d = 5.6;
  var cx = P.x + Math.sin(a) * d, cz = P.z + Math.cos(a) * d;
  var fx = P.x - cx, fz = P.z - cz, fl = Math.hypot(fx, fz); fx /= fl; fz /= fl;
  var rx = -fz, rz = fx;   // screen-right on the ground
  camera.position.set(cx, P.y + 1.7 + Math.sin(t * 0.21) * 0.08, cz);
  camera.lookAt(P.x + rx * 2.1, P.y + 1.15, P.z + rz * 2.1);   // the golfer sits in the left third, the clipboard on the right
  if (Math.abs(camera.fov - 52) > 0.1) { camera.fov = 52; camera.updateProjectionMatrix(); }
  return true;
};

// ── per frame (menu branch of the main loop) ──
MENU3D.tick = function(dt) {
  var close = MENU3D.camera(T);
  var g = MENU3D.g; if (!g) return;
  if ((MENU3D.sigT += dt) > 0.7) { MENU3D.sigT = 0; if (!(typeof PF !== "undefined" && PF.open) && MENU3D._sig() !== MENU3D.sig) { MENU3D.build(); return; } }
  if (!g.userData.glbLoaded) return;
  var limp = RAG.active(g);
  if (!limp) {
    // face the camera, turned a little toward the clipboard
    var want = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z) + (close ? 0.45 : 0);
    var dy = want - g.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    g.rotation.y += dy * Math.min(1, dt * 3);
    g.position.set(MENU3D.P.x, MENU3D.P.y, MENU3D.P.z);
  }
  MENU3D._antics(dt, limp);
  ANIM.drive(g, 0, dt, { grounded: true, fidget: !MENU3D.act });
  // eyes on the mouse
  if (!limp) {
    var v = new THREE.Vector3(MENU3D.mouse.x, MENU3D.mouse.y, 0.5).unproject(camera).sub(camera.position).normalize();
    ANIM.look(g, camera.position.clone().addScaledVector(v, camera.position.distanceTo(g.position)), dt);
  }
  RAG.update(dt);
  // after the ragdoll has posed the bones, so a bonked golfer keeps the disc in its flailing hand
  if (MENU3D.disc) MENU3D.disc.visible = ANIM.holdDisc(g, MENU3D.disc, 0.54 * DISC_SCALE_HAND * 1.15);
};
// Little things it does on its own
MENU3D._antics = function(dt, limp) {
  var g = MENU3D.g, A = MENU3D.act;
  if (limp) { MENU3D.act = null; MENU3D.next = 3; return; }
  if (A) {
    A.t += dt;
    if (A.k === "throw") {
      if (A.t < 1.1) ANIM.coil(g, Math.min(1, A.t / 0.9));
      else if (!A.rel) { A.rel = true; ANIM.release(g, 0.95); switchAvatarAnim(g, "throwrelease"); AudioEngine.sfx("throw", 0.5); }
      if (A.t > 2.1) { switchAvatarAnim(g, "idle"); MENU3D.act = null; }
    } else if (A.t > A.dur) { switchAvatarAnim(g, "idle"); MENU3D.act = null; }
    return;
  }
  if ((MENU3D.next -= dt) > 0) return;
  MENU3D.next = 5 + Math.random() * 5;
  var r = Math.random(), dances = EMOTE.avail().filter(function(e) { return e.proc; });
  if (r < 0.25) MENU3D.do("wave");
  else if (r < 0.5) MENU3D.do("throw");
  else if (r < 0.7) MENU3D.do("flip");
  else if (dances.length) MENU3D.do("dance:" + dances[Math.floor(Math.random() * dances.length)].id);
  else MENU3D.do("wave");
};
MENU3D.do = function(k) {
  var g = MENU3D.g; if (!g || !g.userData.glbLoaded || RAG.active(g)) return;
  if (k === "wave") { switchAvatarAnim(g, "wave"); MENU3D.act = { k: k, t: 0, dur: 2.2 }; }
  else if (k === "cheer") { switchAvatarAnim(g, "cheer"); ANIM.squash(g, -0.3); MENU3D.act = { k: k, t: 0, dur: 1.6 }; }
  else if (k === "flip") { ANIM.flip(g); AudioEngine.sfx("jump", 0.4); MENU3D.act = { k: k, t: 0, dur: 1 }; }
  else if (k === "throw") { switchAvatarAnim(g, "throwwind"); MENU3D.act = { k: k, t: 0 }; }
  else if (k.indexOf("dance:") === 0) { switchAvatarAnim(g, "idle"); ANIM.dance(g, k.slice(6), 3.6); MENU3D.act = { k: k, t: 0, dur: 3.7 }; }
};
// The menu says something happened (Play / Multiplayer opened…)
MENU3D.react = function(view) {
  if (!MENU3D.g) return;
  MENU3D.act = null;
  if (view === "play") MENU3D.do("cheer"); else if (view === "mp") MENU3D.do("wave"); else MENU3D.do("flip");
  MENU3D.next = 5;
};
// Click the golfer: bonk!
MENU3D.bonk = function(sx, sy) {
  var g = MENU3D.g; if (!g || !g.userData.glbLoaded || RAG.active(g) || typeof phase === "undefined" || phase !== "MENU") return false;
  var hp = g.getWorldPosition(new THREE.Vector3()); hp.y += 1.1; var s = hp.clone().project(camera);
  var px = (s.x * 0.5 + 0.5) * innerWidth, py = (-s.y * 0.5 + 0.5) * innerHeight, rad = innerHeight * 0.13;
  if (s.z > 1 || Math.hypot(sx - px, sy - py) > rad) return false;
  var away = new THREE.Vector3(g.position.x - camera.position.x, 0, g.position.z - camera.position.z).normalize();
  var side = (sx - px) / rad;   // hit it off-centre and it spins
  RAG.start(g, { vel: [away.x * 3 - away.z * side * 2, 5.5, away.z * 3 + away.x * side * 2], hit: [away.x * 3.5, 2.5, away.z * 3.5], kind: "ko", minT: 1.3, maxT: 4,
    onEnd: function(yaw) { g.rotation.y = yaw; } });
  AudioEngine.sfx("bonk"); if (typeof AudioEngine.crowd === "function") AudioEngine.crowd("laugh");
  if (typeof _spawnBonkText === "function") _spawnBonkText(hp.clone().add(new THREE.Vector3(0, 1, 0)), ["BONK!", "OOF!", "HEY!", "RUDE!"][Math.floor(Math.random() * 4)]);
  _screenShake = 0.25; _screenShakeT = 0.25;
  return true;
};

// ── input ──
window.addEventListener("pointermove", function(e) { MENU3D.mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); }, { passive: true });
document.addEventListener("pointerdown", function(e) {
  if (!MENU3D.g || typeof phase === "undefined" || phase !== "MENU") return;
  var m = document.getElementById("menu"); if (!m || m.style.display === "none") return;
  if (e.target.closest && e.target.closest(".menu-card, button, input, select, a")) return;   // clicks on the clipboard are for the menu
  MENU3D.bonk(e.clientX, e.clientY);
}, true);

// game.js builds the first menu backdrop before this file has loaded
if (typeof _menuBackdrop !== "undefined" && _menuBackdrop) MENU3D.build();
