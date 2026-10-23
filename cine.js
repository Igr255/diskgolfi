"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── CINEMATICS ───────────────────────────────────────────────────────────────
// The camera as a performer. Runs after updateCamera() and before CAMFX.update().
//   • Throw cam: charging narrows the lens, deepens the vignette and makes the
//     camera tremble more and more (the shot pushes in over the shoulder in
//     _aimCamPose).
//   • Follow cam: banks into the disc's curve, anime speed lines at the edges
//     when it's really moving (post shader), harder for rocket boosts.
//   • Bullet time (physics.js decides when): letterbox bars slide in and the lens
//     zooms; a disc that rattles past the basket gets a "SO CLOSE!" and a groan.
//   • Hit-stop: CINE.hitStop(s) freezes physics + animation for a few frames on
//     chain catches, knockouts, explosions, slams and hard ricochets.
//   • Callouts: big bouncy words for parked landings, bombs, downtown putts …
// ══════════════════════════════════════════════════════════════════════════════
var CINE = { stopT: 0, chg: 0, roll: 0, yawPrev: null, yawRate: 0, lines: 0, boost: 0, flash: 0, chroma: 0, bars: 0, fovOff: 0, bk: null };

CINE.fx = function() { return !(typeof SET !== "undefined" && SET.v && SET.v.speedFx === false); };
CINE.hitStop = function(s) { if (typeof SET !== "undefined" && SET.v && SET.v.shake < 0.01) s *= 0.5; CINE.stopT = Math.max(CINE.stopT, s); };
CINE.punch = function(flash, chroma) { if (!CINE.fx()) return; CINE.flash = Math.max(CINE.flash, flash || 0); CINE.chroma = Math.max(CINE.chroma, chroma || 0); };
CINE.shake = function(amt, dur, at) {
  if (at && typeof camera !== "undefined") amt *= Math.max(0, 1 - camera.position.distanceTo(at) / 45);
  if (amt < 0.02) return;
  if (amt > _screenShake) { _screenShake = amt; _screenShakeT = Math.max(_screenShakeT, dur || 0.35); }
};
// Animation clock: frozen during hit-stop, slowed in bullet time
CINE.animK = function() { return CINE.stopT > 0 ? 0 : (typeof phase !== "undefined" && phase === "FLYING" && timeScale < 0.99 ? Math.max(0.3, timeScale) : 1); };

CINE._wrap = function(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
CINE.update = function(dt) {
  if (CINE.stopT > 0) CINE.stopT -= dt;
  var fx = CINE.fx(), shakeK = typeof SET !== "undefined" && SET.v ? SET.v.shake : 1;
  var fovT = 0;
  // ── throw cam: tension while charging ──
  var chg = phase === "AIMING" && dragging && cameraMode !== "spec" ? throwPower : 0;
  CINE.chg += (chg - CINE.chg) * Math.min(1, dt * 7);
  if (CINE.chg > 0.03) {
    fovT -= CINE.chg * 12;
    var tr = CINE.chg * CINE.chg * (CINE.chg > 0.92 ? 0.05 : 0.026) * shakeK, tn = performance.now() / 1000;
    camera.position.x += (Math.sin(tn * 41) + Math.sin(tn * 67.3)) * tr;
    camera.position.y += (Math.sin(tn * 53.1) + Math.sin(tn * 29.7)) * tr;
    camera.rotateZ(Math.sin(tn * 37) * tr * 0.25);
  }
  // ── follow cam: bank into the curve ──
  var roll = 0;
  if (phase === "FLYING" && discVel.lengthSq() > 4 && cameraMode !== "spec" && !spectatingOpp) {
    var yaw = Math.atan2(discVel.x, discVel.z);
    if (CINE.yawPrev !== null && dt > 0) CINE.yawRate += (CINE._wrap(yaw - CINE.yawPrev) / dt - CINE.yawRate) * Math.min(1, dt * 4);
    CINE.yawPrev = yaw;
    roll = Math.max(-0.42, Math.min(0.42, CINE.yawRate * 0.3)) + (discBank[0] || 0) * 0.3;
    if (timeScale < 0.75) roll *= 0.25;
  } else { CINE.yawPrev = null; CINE.yawRate *= 0.9; }
  CINE.roll += (roll - CINE.roll) * Math.min(1, dt * 3);
  if (fx && Math.abs(CINE.roll) > 0.002) camera.rotateZ(CINE.roll);
  // ── speed lines ──
  var sp = 0;
  if (phase === "FLYING") sp = discVel.length() * (timeScale < 0.75 ? 0 : 1);
  else if (typeof VEH !== "undefined" && VEH.mySeat) sp = Math.abs(VEH.mySeat.car.speed || 0) * 0.85;
  else if (phase === "WALKING") sp = Math.hypot(PL.vel.x, PL.vel.z) * (typeof PU !== "undefined" && PU.speedMul() > 1 ? 1.6 : 0.8);
  CINE.boost *= Math.exp(-dt * 2.5);
  var lt = fx ? Math.max(Math.min(1, Math.max(0, (sp - 15) / 16)), CINE.boost) : 0;
  CINE.lines += (lt - CINE.lines) * Math.min(1, dt * 6);
  // ── bullet time ──
  var slow = (phase === "FLYING" && timeScale < 0.8) || (typeof introT !== "undefined" && introT > 0);
  CINE.bars += ((slow ? 1 : 0) - CINE.bars) * Math.min(1, dt * 7);
  if (phase === "FLYING" && timeScale < 0.8) fovT -= (_slowWhy === "basket" ? 9 : 6) * (1 - timeScale);
  if (!_slowWhy && timeScale > 0.95) CINE.slowKind = null;   // (set by stepPhysics when bullet time starts)
  CINE._nearMiss();
  CINE.fovOff = fx ? fovT : 0;
  // ── post uniforms ──
  CINE.flash *= Math.exp(-dt * 10); CINE.chroma *= Math.exp(-dt * 5);
  var u = GFX.gradePass && GFX.gradePass.uniforms;
  if (u && u.lines) {
    u.lines.value = CINE.lines; u.flash.value = CINE.flash; u.chroma.value = CINE.chroma;
    u.aspect.value = window.innerWidth / Math.max(1, window.innerHeight);
    u.vignette.value = 0.32 + CINE.chg * 0.55 + CINE.bars * 0.25;
  }
  CINE._barsDom();
  CINE._audio(dt);
};

// ── Audio that follows the action ──
//   slide whistle while the disc is way up (pitch = height) · charge whine while winding up ·
//   the music speeds up as the disc / player nears the basket and when the battle clock is tight
CINE._audio = function(dt) {
  var flying = phase === "FLYING" && timeScale > 0.75;
  var dh = flying && CINE.y0 !== undefined ? discPos.y - CINE.y0 : 0;
  if (flying && dh > 5.5) { CINE.sliding = true; AudioEngine.slide(true, dh); }
  else if (CINE.sliding && (!flying || dh < 1.5)) { CINE.sliding = false; AudioEngine.slide(false); }
  else if (CINE.sliding) AudioEngine.slide(true, dh);
  var chg = phase === "AIMING" && dragging ? throwPower : 0;
  if (typeof JUICE !== "undefined") JUICE.charge(chg);
  if (chg > 0.02 || CINE._chgOn) { CINE._chgOn = chg > 0.02; AudioEngine.charge(chg); }
  if ((CINE._tAcc = (CINE._tAcc || 0) + dt) > 0.5 && HOLES[holeIdx]) {
    CINE._tAcc = 0;
    var f = phase === "FLYING" ? discPos : PL.pos, d = Math.hypot(f.x - basketBase.x, f.z - basketBase.z);
    var near = phase === "SCORED" ? 0 : Math.max(0, Math.min(1, (32 - d) / 26));
    AudioEngine.setTempo(1 + near * 0.09 + (AudioEngine._intensity || 0) * 0.12);
  }
};

// Letterbox bars (DOM: crisp, and they work without the post chain)
CINE._barsDom = function() {
  var el = CINE._barsEl;
  if (!el) {
    el = CINE._barsEl = document.createElement("div"); el.id = "cine-bars";
    el.innerHTML = "<i class='t'></i><i class='b'></i>"; document.body.appendChild(el);
  }
  var k = CINE.bars < 0.01 ? 0 : CINE.bars;
  if (Math.abs(k - (CINE._barsK || 0)) > 0.005) { CINE._barsK = k; el.style.setProperty("--k", k.toFixed(3)); }
};

// ── near misses at the basket ──
CINE._nearMiss = function() {
  if (phase === "FLYING" && _slowWhy === "basket" && !CINE.bk) CINE.bk = { t: T };
  if (!CINE.bk) return;
  if (phase === "SCORED" || phase === "AIMING" || phase === "MENU") { CINE.bk = null; return; }
  var hd = Math.hypot(discPos.x - basketBase.x, discPos.z - basketBase.z);
  if ((phase === "FLYING" && hd > 3.2 && T - CINE.bk.t > 0.2) || phase === "LANDED" || phase === "WALKING") {
    CINE.bk = null;
    CINE.callout(Math.random() < 0.5 ? "SO CLOSE!" : "NOOO!", "miss");
    if (typeof AudioEngine.crowd === "function") AudioEngine.crowd("aww");
    CINE.shake(0.18, 0.3);
  }
};

// ── big words ──
CINE.callout = function(txt, kind, sub) {
  var host = document.getElementById("ui") || document.body;
  if (CINE._co && CINE._co.parentNode) CINE._co.remove();   // one big word at a time
  var el = CINE._co = document.createElement("div"); el.className = "callout " + (kind || "");
  el.innerHTML = "<b>" + txt + "</b>" + (sub ? "<span>" + sub + "</span>" : "");
  el.style.setProperty("--rot", ((Math.random() - 0.5) * 10).toFixed(1) + "deg");
  host.appendChild(el);
  setTimeout(function() { el.remove(); }, 1900);
};

// ── moments ──
// The disc came to rest (landed()): reward great placement
CINE.onLand = function(toBasket, throwDist) {
  if (CINE.bk) {   // rattled out of the chains and stayed close
    CINE.bk = null; CINE.callout("SO CLOSE!", "miss", toBasket.toFixed(1) + " m — tap it in");
    if (typeof AudioEngine.crowd === "function") AudioEngine.crowd("aww");
    return;
  }
  if (toBasket < 1.6) { CINE.callout("TAP-IN!", "gold", toBasket.toFixed(1) + " m"); CINE._party(discPos, 1); }
  else if (toBasket < 3.6) { CINE.callout("PARKED!", "gold", toBasket.toFixed(1) + " m from the pin"); CINE._party(discPos, 0.7); }
  else if (throwDist > 85) { CINE.callout("BOMB!", "hot", Math.round(throwDist) + " m"); if (typeof AudioEngine.crowd === "function") AudioEngine.crowd("ooh"); }
};
CINE._party = function(pos, k) {
  var p = pos.clone(); p.y += 0.3;
  if (typeof spawnConfetti === "function") { spawnConfetti(p); if (k > 0.8) spawnConfetti(p); }
  if (typeof spawnParticleBurst === "function") spawnParticleBurst(p, new THREE.Color(0xffd23a), Math.round(18 * k + 8));
  if (typeof AudioEngine.crowd === "function") AudioEngine.crowd(k > 0.8 ? "cheer" : "ooh");
  AudioEngine.sfx("pickup", 0.8);
  CINE.punch(0.12 * k, 0.4 * k);
};
// Holed out (scored()): hit-stop on the chains, flash, the crowd goes wild
CINE.onScore = function(throws, par, fromDist) {
  var d = throws - par;
  CINE.hitStop(throws === 1 ? 0.22 : 0.14);
  CINE.punch(throws === 1 ? 0.55 : 0.3, 0.9);
  CINE.shake(throws === 1 ? 0.6 : 0.35, 0.5);
  if (fromDist > 15) CINE.callout("DOWNTOWN!", "hot", Math.round(fromDist) + " m putt");
  if (typeof AudioEngine.crowd === "function") AudioEngine.crowd(throws === 1 || d <= -2 ? "roar" : d <= 0 ? "cheer" : "clap");
};
// Any disc impact (particles.js handleImpact): heavy hits shake the screen
CINE.onImpact = function(type, pos, vel) {
  var sp = vel ? vel.length() : 0;
  if (sp < 11 || !/wall|metal|wood|tree|terrain/.test(type)) return;
  var k = Math.min(1, (sp - 11) / 14);
  CINE.shake(0.2 + k * 0.45, 0.35, pos);
  if (k > 0.35 && pos && typeof camera !== "undefined" && camera.position.distanceTo(pos) < 30) {
    CINE.hitStop(0.035 + k * 0.04);
    if (type !== "terrain" && typeof _spawnBonkText === "function") _spawnBonkText(pos.clone().add(new THREE.Vector3(0, 0.8, 0)), type === "metal" ? "CLANG!" : type === "wood" || type === "tree" ? "THWOCK!" : "WHAM!");
  }
};
// ── Reaction cam: a picture-in-picture inset that keeps watching the funny bit ──
// (the thrower faceplanting after a max-power throw, the bystander you just beaned,
// the goose running off with your disc) while the main camera follows the action.
CINE.pip = { t: 0, dur: 0, cam: new THREE.PerspectiveCamera(46, 1.6, 0.1, 600), at: null, label: "", pos: new THREE.Vector3(), look: new THREE.Vector3(), fresh: true };
CINE.react = function(at, label, dur) {
  var P = CINE.pip;
  if (P.t > 0.6 && P.label === label) return;
  P.at = at; P.label = label; P.t = P.dur = dur || 2.4; P.fresh = true;
  var el = CINE._pipEl();
  el.querySelector("b").textContent = label;
  el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
};
CINE._pipEl = function() {
  var el = document.getElementById("pip");
  if (!el) { el = document.createElement("div"); el.id = "pip"; el.innerHTML = "<b></b><i>● REPLAY</i>"; document.body.appendChild(el); }
  return el;
};
CINE._pipRect = function() {
  var W = innerWidth, H = innerHeight, w = Math.round(Math.min(W * (W < 760 ? 0.44 : 0.27), 380)), h = Math.round(w * 0.62);
  return { x: W - w - 16, y: W < 760 ? 120 : 210, w: w, h: h };
};
CINE._pv = new THREE.Vector3();
CINE.pipRender = function(dt) {
  var P = CINE.pip, el = document.getElementById("pip");
  if (P.t <= 0) return;
  P.t -= dt;
  var tgt = P.at && P.at();
  if (P.t <= 0 || !tgt || phase === "MENU") { P.t = 0; if (el) el.classList.remove("on"); return; }
  var R = CINE._pipRect();
  if (el) { el.style.left = R.x + "px"; el.style.top = R.y + "px"; el.style.width = R.w + "px"; el.style.height = R.h + "px"; }
  // a side-on angle, different from the main camera's
  var away = CINE._pv.set(camera.position.x - tgt.x, 0, camera.position.z - tgt.z); if (away.lengthSq() < 0.01) away.set(1, 0, 0); away.normalize();
  var a = Math.atan2(away.x, away.z) + 1.25, h = HOLES[holeIdx], gy = h && h.course ? h.course.heightAt(tgt.x + Math.sin(a) * 5, tgt.z + Math.cos(a) * 5) : tgt.y;
  var want = new THREE.Vector3(tgt.x + Math.sin(a) * 5, Math.max(tgt.y + 2.2, gy + 1.2), tgt.z + Math.cos(a) * 5);
  if (P.fresh) { P.pos.copy(want); P.look.copy(tgt); P.fresh = false; }
  P.pos.lerp(want, Math.min(1, dt * 3)); P.look.lerp(tgt, Math.min(1, dt * 8));
  var cam = P.cam; cam.aspect = R.w / R.h; cam.updateProjectionMatrix();
  cam.position.copy(P.pos); cam.lookAt(P.look.x, P.look.y + 0.7, P.look.z);
  // draw it into the corner (no post chain; reuse this frame's shadow map)
  var r = renderer, gl = R.y, sm = r.shadowMap.autoUpdate;
  r.shadowMap.autoUpdate = false; r.autoClear = false;
  r.setScissorTest(true); r.setScissor(R.x, innerHeight - gl - R.h, R.w, R.h); r.setViewport(R.x, innerHeight - gl - R.h, R.w, R.h);
  r.clear(true, true, false);
  r.render(scene, cam);
  r.setScissorTest(false); r.setViewport(0, 0, innerWidth, innerHeight);
  r.autoClear = true; r.shadowMap.autoUpdate = sm;
};
// Big throws can end with the thrower on their face (watched in the inset)
CINE.maybeFaceplant = function(power) {
  if (power < 0.97 || cameraMode !== "tp" || Math.random() > 0.45 || typeof RAG === "undefined") return;
  var fx = Math.sin(aimAngle), fz = -Math.cos(aimAngle);
  setTimeout(function() {
    if (phase !== "FLYING" || RAG.busy()) return;
    if (RAG.startLocal("trip", new THREE.Vector3(fx * 4.5, 2.2, fz * 4.5), new THREE.Vector3(fx * 3.5, 1.2, fz * 3.5), 1.3))
      CINE.react(function() { var p = RAG.pelvis(localAvatarMesh); return p ? p.clone() : PL.pos.clone().setY(PL.pos.y + 0.8); }, "WHOOPS!", 2.6);
  }, 260);
};

CINE.onThrow = function(power) {
  CINE.bk = null; CINE.y0 = discPos.y; AudioEngine.charge(0); CINE._chgOn = false;
  if (power > 0.9) { CINE.shake(0.25, 0.25); CINE.punch(0, 0.5); }
};
