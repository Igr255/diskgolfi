"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── ANIMATION DRIVER ─────────────────────────────────────────────────────────
// One per-frame call for every animated character (local player, remote players,
// NPCs and critters) that turns canned clips into believable motion:
//   • stride matching — walk / run clips are time-scaled to the real ground speed,
//     using the stride measured from each rig's feet at load (no foot sliding);
//   • body dynamics — lean into acceleration, bank into turns, squash & stretch on
//     jumps and landings, a little breathing on idle;
//   • life — every character gets its own tempo, idles break into fidgets now and
//     then (wave, look around, peck …), NPCs turn to watch players walking past.
// Works on the wrapper groups built by buildPlayerAvatar / ENT.glb: the GLB scene
// is the wrapper's child, so lean / squash never fight the gameplay transform.
// ══════════════════════════════════════════════════════════════════════════════
var ANIM = {};
ANIM.LOCO = /walk|run|sprint|jog|gallop|trot/i;
ANIM.FIDGET = /wave|interact|idle_neutral|idle_2|idle_peck|peck|eating|clapping|standing|look/i;

// Natural ground speed of a clip on this instance (measured stride, or a sensible guess)
ANIM.natSpeed = function(inner, name) {
  var cs = inner.userData.clipSpeed || {}, sc = inner.scale.x / (inner.userData.strideScale || inner.scale.x);
  if (cs[name]) return cs[name] * sc;
  var h = inner.userData._h || (inner.userData._h = Math.max(0.3, new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3()).y));
  return (/run|sprint|gallop|jog/i.test(name) ? 1.75 : 0.85) * h;   // fallback: proportional to height
};

ANIM._state = function(g) {
  var st = g.userData._anim;
  var inner = null; for (var i = 0; i < g.children.length; i++) { var c = g.children[i]; if (c.name !== "cos_hat" && !/^bt_|^veh_/.test(c.name) && !c.isSprite && !c.isLight) { inner = c; break; } }
  if (!inner) return null;
  if (!st || st.inner !== inner) {
    st = g.userData._anim = { inner: inner, rot: inner.rotation.clone(), scale: inner.scale.clone(), pos: inner.position.clone(),
      lean: 0, bank: 0, yaw: null, v: 0, sq: 0, sqV: 0, idleT: 0, fidgetAt: 5 + Math.random() * 8, fidget: null,
      tempo: 0.9 + Math.random() * 0.2, phase: Math.random() * 6.28 };
  }
  return st;
};

// speed: horizontal m/s · opts: { grounded, fidget (allow idle fidgets), yaw (facing, if not g.rotation.y) }
ANIM.drive = function(g, speed, dt, opts) {
  if (!g || !g.userData) return;
  var st = ANIM._state(g); if (!st || dt <= 0) return;
  opts = opts || {};
  ANIM.goofy(g);
  // limp: the ragdoll owns the skeleton — keep the model frame neutral underneath it
  if (g.userData._rag) { st.inner.position.copy(st.pos); st.inner.rotation.copy(st.rot); st.inner.scale.copy(st.scale); st.tumble = 0; st.sq = st.sqV = 0; st.coil = 0; st.spinT = 0; return; }
  var inner = st.inner, acts = g.userData.clipActions, name = g.userData.activeClipName, act = acts && name ? acts[name] : null;
  // ── stride matching ──
  if (act) {
    if (ANIM.LOCO.test(name)) {
      var nat = ANIM.natSpeed(inner, name);
      act.timeScale = Math.max(0.55, Math.min(2.6, speed / Math.max(0.2, nat)));
    } else if (/idle/i.test(name)) act.timeScale = st.tempo;
    else if (act.timeScale !== 1 && !st.fidget) act.timeScale = 1;
  }
  // ── body dynamics ──
  var yaw = opts.yaw !== undefined ? opts.yaw : g.rotation.y;
  var yawRate = 0;
  if (st.yaw !== null) { var dy = yaw - st.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; yawRate = dy / dt; }
  st.yaw = yaw;
  var accel = (speed - st.v) / dt; st.v = speed;
  var grounded = opts.grounded !== false;
  var tLean = grounded ? Math.max(-0.14, Math.min(0.22, speed * 0.016 + accel * 0.01)) : 0.05;
  var tBank = grounded ? Math.max(-0.3, Math.min(0.3, -yawRate * speed * 0.022)) : 0;
  var k = 1 - Math.exp(-dt * 7);
  st.lean += (tLean - st.lean) * k; st.bank += (tBank - st.bank) * k;
  // squash spring (critically-ish damped)
  st.sqV += (-st.sq * 260 - st.sqV * 18) * dt; st.sq += st.sqV * dt;
  var breathe = (!name || /idle/i.test(name)) && speed < 0.3 ? Math.sin(T * 2.1 * st.tempo + st.phase) * 0.012 : 0;
  var s = st.sq;
  // knocked flying: cartwheel through the air around the hips, then settle into the KO pose
  st.tumble = st.tumble || 0;
  if (opts.ko && !grounded) st.tumble += dt * (st.tumbleDir || (st.tumbleDir = Math.random() < 0.5 ? 7 : -7));
  else { st.tumbleDir = 0; st.tumble = Math.atan2(Math.sin(st.tumble), Math.cos(st.tumble)); st.tumble += (0 - st.tumble) * Math.min(1, dt * 9); }
  var piv = 0.9, tb = st.tumble, hop = 0;
  if (st.flipT > 0) { st.flipT += dt; var fk = st.flipT / 0.8; if (fk >= 1) st.flipT = 0; else { tb -= Math.PI * 2 * (fk * fk * (3 - 2 * fk)); hop = Math.sin(Math.PI * fk) * 1.3; } }
  // ── throw body language: coil with the power meter, whip + pirouette on release ──
  var ct = T - (st.coilAt === undefined ? -9 : st.coilAt) < 0.08 ? st.coilTarget : 0;
  st.coil = (st.coil || 0) + (ct - (st.coil || 0)) * Math.min(1, dt * (ct > (st.coil || 0) ? 9 : 20));
  st.whip = (st.whip || 0) * Math.exp(-dt * 7);
  var spin = 0;
  if (st.spinT > 0) { st.spinT += dt; var sk = Math.min(1, st.spinT / st.spinDur); spin = st.spinTurns * Math.PI * 2 * (1 - Math.pow(1 - sk, 3)); if (sk >= 1) st.spinT = 0; }
  // procedural victory dances (ANIM.dance): body spin / hop / sway; the arms are posed below
  var D = st.dance, dYaw = 0, dHop = 0, dRoll = 0;
  if (D) {
    D.t += dt;
    if (D.t > D.dur || speed > 0.8 || g.userData._rag) st.dance = D = null;
    else {
      var b = D.t * 2.2, sb = Math.sin(b * Math.PI * 2);
      if (D.id === "pirouette") { dYaw = D.t * Math.PI * 4; dHop = Math.abs(Math.sin(b * Math.PI)) * 0.25; }
      else if (D.id === "windmill") { dYaw = -D.t * Math.PI * 1.5; }
      else if (D.id === "floss") { dRoll = -sb * 0.13; dHop = Math.abs(sb) * 0.04; }
      else if (D.id === "chicken") { dHop = Math.abs(Math.sin(b * Math.PI * 2)) * 0.1; dRoll = Math.sin(b * Math.PI) * 0.08; }
      else if (D.id === "robot") { dYaw = [0, 0.5, 0, -0.5][Math.floor(D.t * 4) % 4]; }
    }
  }
  var noThrowClip = !/throw/i.test(g.userData.activeClipName || "");
  var coil = st.coil, twist = coil * (noThrowClip ? 0.9 : 0.4) + st.whip * 0.6 + spin + dYaw;   // backhand: the whole body turns away from the target (the clip turns the shoulders and sweeps the arm)
  // ── scramble: a bouncy, slightly out-of-control stride ──
  var bob = 0;
  if (act && ANIM.LOCO.test(name) && speed > 2.6 && grounded) {
    var cyc = act.time / Math.max(0.05, act.getClip().duration);
    bob = Math.abs(Math.sin(cyc * Math.PI * 2)) * Math.min(1, (speed - 2.6) / 4.5);
  }
  st.bobS = (st.bobS || 0) + (bob - (st.bobS || 0)) * Math.min(1, dt * 20);
  hop += st.bobS * 0.11 + dHop;
  inner.position.set(st.pos.x, st.pos.y + piv - piv * Math.cos(tb) + hop, st.pos.z - piv * Math.sin(tb));
  inner.rotation.set(st.rot.x + st.lean + tb - coil * 0.14, st.rot.y + twist, st.rot.z + st.bank + dRoll);
  var cs = 1 - coil * 0.17, cw = 1 + coil * 0.1, rb = 1 + (st.bobS - 0.5) * 0.07 * (bob > 0 ? 1 : 0);
  inner.scale.set(st.scale.x * (1 + s * 0.5 - breathe * 0.3) * cw, st.scale.y * (1 - s + breathe) * cs * rb, st.scale.z * (1 + s * 0.5 - breathe * 0.3) * cw);
  // arms on top of the clip: wound back while charging, windmilling at a full sprint, dancing
  var gb = ANIM._goofyBones(st);
  if (gb && D) ANIM._danceArms(g, gb, D, g.rotation.y + dYaw);
  if (gb && coil > 0.02 && noThrowClip) {
    // rigs without a generated throw clip: the whole body turns further and the arm is aimed across the FRONT of the chest
    g.updateMatrixWorld(true);
    var yc = g.rotation.y + twist, sL = ANIM._sv.set(Math.cos(yc), 0, -Math.sin(yc)), sF = ANIM._fv.set(Math.sin(yc), 0, Math.cos(yc));
    var aimB = function(x, y, z) { return ANIM._ad.copy(sL).multiplyScalar(x).addScaledVector(sF, z).setY(y).normalize(); };
    ANIM._aim(gb.uaR, gb.laR, aimB(0.55, -0.25, 0.8), coil);
    ANIM._aim(gb.laR, gb.haR, aimB(0.95, -0.1, 0.3), coil);
    ANIM._aim(gb.uaL, gb.laL, aimB(0.45, -0.8, -0.4), coil);
  }
  if (gb && opts.flail && speed > 5.4 && grounded && coil < 0.02) {
    g.updateMatrixWorld(true);
    var yb = g.rotation.y + twist, side = ANIM._sv.set(Math.cos(yb), 0, -Math.sin(yb)), fwd = ANIM._fv.set(Math.sin(yb), 0, Math.cos(yb));
    var fk2 = Math.min(1, (speed - 5.4) / 2.2), t2 = T * 12.5 + st.phase;
    ANIM._rotW(gb.uaL, fwd, (0.95 + Math.sin(t2) * 0.55) * fk2); ANIM._rotW(gb.uaL, side, Math.sin(t2 * 0.5) * 0.9 * fk2);
    ANIM._rotW(gb.uaR, fwd, -(0.95 + Math.sin(t2 + 2.2) * 0.55) * fk2); ANIM._rotW(gb.uaR, side, -Math.sin(t2 * 0.5 + 1) * 0.9 * fk2);
  }
  // ── idle fidgets ──
  if (acts && opts.fidget !== false) {
    if (st.fidget) {
      var fa = acts[st.fidget];
      if (!fa || name !== st.fidget) { st.fidget = null; st.idleT = 0; }          // gameplay switched animation: let it
      else if (!fa.isRunning() || fa.time > fa.getClip().duration - 0.3) {      // fidget done: ease back into the idle
        if (st.back && acts[st.back]) { acts[st.back].reset().play().fadeIn(0.3); fa.fadeOut(0.3); g.userData.activeClipName = st.back; }
        st.fidget = null; st.idleT = 0; st.fidgetAt = 7 + Math.random() * 10;
      }
    } else if (name && /idle/i.test(name) && speed < 0.2) {
      st.idleT += dt;
      if (st.idleT > st.fidgetAt) {
        var opts2 = Object.keys(acts).filter(function(n) { return ANIM.FIDGET.test(n) && n !== name && !/sit|death/i.test(n); });
        st.idleT = 0; st.fidgetAt = 7 + Math.random() * 10;
        if (opts2.length) {
          var pick = opts2[Math.floor(Math.random() * opts2.length)], a2 = acts[pick];
          a2.reset().setLoop(THREE.LoopOnce, 1).play().fadeIn(0.25); a2.clampWhenFinished = false;
          acts[name].fadeOut(0.25);
          st.back = name; st.fidget = pick; g.userData.activeClipName = pick;
        }
      }
    } else st.idleT = 0;
  }
};
// ── Head look-at ─────────────────────────────────────────────────────────────
// Neck and head turn toward a world point (players eye each other, follow their
// disc, NPCs watch you walk by). Applied after the animation each frame; ANIM.restore()
// puts the bones back before the mixers run again, so nothing ever accumulates.
ANIM._mod = [];
ANIM.restore = function() { for (var i = ANIM._mod.length - 1; i >= 0; i--) ANIM._mod[i][0].quaternion.copy(ANIM._mod[i][1]); ANIM._mod.length = 0; };   // newest first: a bone may be turned more than once
ANIM._v = new THREE.Vector3(); ANIM._q1 = new THREE.Quaternion(); ANIM._q2 = new THREE.Quaternion(); ANIM._q3 = new THREE.Quaternion(); ANIM._eu = new THREE.Euler();
ANIM.look = function(g, target, dt) {
  var st = g && g.userData && ANIM._state(g); if (!st || g.userData._rag) return;
  if (st.head === undefined) {
    st.head = null; st.neck = null;
    st.inner.traverse(function(o) { if (!o.isBone) return; var n = o.name.replace(/^mixamorig:?/i, ""); if (!st.head && /^head$/i.test(n)) st.head = o; if (!st.neck && /^neck$/i.test(n)) st.neck = o; });
  }
  if (!st.head) return;
  var wantY = 0, wantP = 0;
  if (target) {
    g.updateMatrixWorld(true);
    var hp = st.head.getWorldPosition(ANIM._v), dx = target.x - hp.x, dy = target.y - hp.y, dz = target.z - hp.z;
    var yaw = Math.atan2(dx, dz) - g.rotation.y; yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    if (Math.abs(yaw) < 2.1) { wantY = Math.max(-1.1, Math.min(1.1, yaw)); wantP = Math.max(-0.5, Math.min(0.55, Math.atan2(dy, Math.hypot(dx, dz)))); }
  }
  var k = 1 - Math.exp(-dt * 6);
  st.lY = (st.lY || 0) + (wantY - (st.lY || 0)) * k; st.lP = (st.lP || 0) + (wantP - (st.lP || 0)) * k;
  if (Math.abs(st.lY) + Math.abs(st.lP) < 0.01) return;
  var bodyQ = g.getWorldQuaternion(ANIM._q1);
  [[st.neck, 0.4], [st.head, st.neck ? 0.6 : 1]].forEach(function(e) {
    var bone = e[0]; if (!bone) return;
    ANIM._mod.push([bone, bone.quaternion.clone()]);
    ANIM._eu.set(-st.lP * e[1], st.lY * e[1], 0, "YXZ");
    var delta = ANIM._q2.copy(bodyQ).multiply(ANIM._q3.setFromEuler(ANIM._eu)).multiply(bodyQ.clone().invert());
    var wq = bone.getWorldQuaternion(ANIM._q3.clone()); wq.premultiply(delta);
    var pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    bone.quaternion.copy(pq.multiply(wq));
    bone.updateMatrixWorld(true);
  });
};

// Hold a one-shot clip at a fraction of its length (wind-up follows the power meter)
ANIM.scrub = function(g, k) {
  var acts = g && g.userData.clipActions, n = g && g.userData.activeClipName, a = acts && n ? acts[n] : null;
  if (!a) return;
  a.paused = true; a.enabled = true; a.setEffectiveWeight(1); a.time = Math.max(0, Math.min(1, k)) * a.getClip().duration;
};
// A backflip on top of whatever is playing (emote / celebration)
ANIM.flip = function(g) { var st = g && ANIM._state(g); if (st) st.flipT = 0.0001; };

// Jump stretch / landing squash: amount ~0.1 (light) … 0.3 (big drop). Negative = stretch.
ANIM.squash = function(g, amount) {
  var st = g && ANIM._state(g); if (!st) return;
  st.sqV += amount * 9;
};
// ══════════════════════════════════════════════════════════════════════════════
// ── GOOFY PROPORTIONS · THROW BODY LANGUAGE ──────────────────────────────────
//   • Bobbleheads: humanoid rigs get a big head, big hands and clown feet. The
//     clips only animate rotation / translation, so a bone scale sticks.
//   • ANIM.coil(g, power) every frame while charging: the body squashes down,
//     twists away from the target and the throwing arm swings way back.
//   • ANIM.release(g, power): stretch + whip back through, and a full pirouette
//     on a big throw. ANIM.holdDisc keeps the disc in the throwing hand.
// ══════════════════════════════════════════════════════════════════════════════
ANIM.GOOFY = { head: 1.55, hand: 1.4, foot: 1.22 };
ANIM._sv = new THREE.Vector3(); ANIM._fv = new THREE.Vector3(); ANIM._rq = new THREE.Quaternion(); ANIM._rq2 = new THREE.Quaternion();
ANIM._goofyBones = function(st) {
  if (st.gb !== undefined) return st.gb;
  var R = typeof RAG !== "undefined" ? RAG.rig(st.inner) : null;
  st.gb = R ? { head: R.head, neck: R.neck, hands: R.fingL ? R.fingL.concat(R.fingR || []) : [R.haL, R.haR], feet: [R.ftL, R.ftR], uaL: R.uaL, uaR: R.uaR, laL: R.laL, laR: R.laR, haR: R.haR, fingerHand: !!R.fingerHand } : null;
  return st.gb;
};
ANIM.goofy = function(g) {
  var st = g && g.userData && ANIM._state(g); if (!st) return;
  var on = !(typeof SET !== "undefined" && SET.v && SET.v.bobble === false);
  if (st.goofyOn === on) return;
  st.goofyOn = on;
  var b = ANIM._goofyBones(st); if (!b) return;
  var G = ANIM.GOOFY, k = (on ? 1 : 0) * ANIM._bobbleK(st, b);   // chibi characters already have a big head
  b.head.scale.setScalar(1 + (G.head - 1) * k);
  b.hands.forEach(function(h) { h.scale.setScalar(1 + (G.hand - 1) * k); });
  b.feet.forEach(function(f) { f.scale.setScalar(1 + (G.foot - 1) * k); });
};
// How much bobblehead a character gets: full for realistic proportions (skull ≈ 15 % of the height),
// fading out as the head is already a third of the body (pirates, monsters, bunnies)
ANIM._bobbleK = function(st, b) {
  if (st.bobK !== undefined) return st.bobK;
  var inner = st.inner, box = new THREE.Box3(), mb = new THREE.Box3();
  inner.updateMatrixWorld(true);
  inner.traverse(function(m) { if (m.isMesh && !m.userData.cosHat && m.geometry) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); mb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); box.union(mb); } });
  var hy = b.head.getWorldPosition(new THREE.Vector3()).y, H = box.max.y - box.min.y;
  var ratio = H > 1e-3 && !box.isEmpty() ? (box.max.y - hy) / H : 0.15;
  st.bobK = Math.max(0.15, Math.min(1, 1 - (ratio - 0.17) * 3.2));
  return st.bobK;
};
ANIM.ungoofy = function(g) {
  var st = g && g.userData && ANIM._state(g); if (!st) return;
  var b = ANIM._goofyBones(st);
  if (b) [b.head].concat(b.hands, b.feet).forEach(function(o) { o.scale.setScalar(1); });
  st.goofyOn = null;
};
// Turn a bone by `ang` around a world axis, on top of whatever the clip posed (undone by ANIM.restore)
ANIM._rotW = function(bone, axis, ang) {
  if (!bone || !bone.parent) return;
  ANIM._mod.push([bone, bone.quaternion.clone()]);
  var wq = bone.getWorldQuaternion(ANIM._rq).premultiply(ANIM._rq2.setFromAxisAngle(axis, ang));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(ANIM._rq2).invert().multiply(wq));
  bone.updateMatrixWorld(true);
};
// Swing a limb bone (k = 0…1 of the way) so it points from its joint toward `dir` (world, unit)
ANIM._ad = new THREE.Vector3(); ANIM._a1 = new THREE.Vector3(); ANIM._a2 = new THREE.Vector3(); ANIM._aq = new THREE.Quaternion(); ANIM._aq0 = new THREE.Quaternion();
ANIM._aim = function(bone, child, dir, k) {
  if (!bone || !child || !bone.parent) return;
  var cur = child.getWorldPosition(ANIM._a2).sub(bone.getWorldPosition(ANIM._a1)); if (cur.lengthSq() < 1e-8) return; cur.normalize();
  var q = ANIM._aq0.set(0, 0, 0, 1).slerp(ANIM._aq.setFromUnitVectors(cur, dir), k);
  ANIM._mod.push([bone, bone.quaternion.clone()]);
  var wq = bone.getWorldQuaternion(ANIM._rq).premultiply(q);
  bone.quaternion.copy(bone.parent.getWorldQuaternion(ANIM._rq2).invert().multiply(wq));
  bone.updateMatrixWorld(true);
};
// ── Victory dances (celebrations, emotes, the podium) ──
ANIM.DANCES = { chicken: 1, floss: 1, windmill: 1, robot: 1, pirouette: 1 };
ANIM.dance = function(g, id, dur) { var st = g && g.userData && ANIM._state(g); if (st) st.dance = { id: id, t: 0, dur: dur || 4.2 }; };
ANIM._danceArms = function(g, gb, D, yb) {
  g.updateMatrixWorld(true);
  var side = ANIM._sv.set(Math.cos(yb), 0, -Math.sin(yb)), fwd = ANIM._fv.set(Math.sin(yb), 0, Math.cos(yb)), up = ANIM._uv || (ANIM._uv = new THREE.Vector3(0, 1, 0));
  var b = D.t * 2.2, ph = b * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
  switch (D.id) {
    case "chicken":   // elbows out, wings flapping, head pecking
      ANIM._rotW(gb.uaL, fwd, 0.55 + Math.abs(Math.sin(ph * 2)) * 0.7); ANIM._rotW(gb.uaR, fwd, -0.55 - Math.abs(Math.sin(ph * 2)) * 0.7);
      if (gb.laL) ANIM._rotW(gb.laL, fwd, -1.6); if (gb.laR) ANIM._rotW(gb.laR, fwd, 1.6);
      ANIM._rotW(gb.head, side, Math.sin(ph * 2) * 0.3);
      break;
    case "floss":     // straight arms swinging past the hips, front and back in turn
      ANIM._rotW(gb.uaL, fwd, 0.25 + s * 0.55); ANIM._rotW(gb.uaR, fwd, -0.25 + s * 0.55);
      ANIM._rotW(gb.uaL, side, c * 0.55); ANIM._rotW(gb.uaR, side, -c * 0.55);
      break;
    case "windmill":  // one arm cranking full circles, the other out for balance
      ANIM._rotW(gb.uaR, side, D.t * 13); ANIM._rotW(gb.uaL, fwd, 1.5 + s * 0.2);
      break;
    case "robot": {   // snaps between right-angle poses on the beat
      var k = Math.floor(D.t * 4) % 4, A = [[1.57, -1.57], [1.57, -0.2], [0.2, -1.57], [2.6, -2.6]][k];
      ANIM._rotW(gb.uaL, fwd, A[0]); ANIM._rotW(gb.uaR, fwd, A[1]);
      if (gb.laL) ANIM._rotW(gb.laL, side, k % 2 ? -1.57 : 0); if (gb.laR) ANIM._rotW(gb.laR, side, k % 2 ? 0 : -1.57);
      ANIM._rotW(gb.head, up, [0.6, 0, -0.6, 0][k]);
      break;
    }
    case "pirouette": // arms up in a ring
      ANIM._rotW(gb.uaL, fwd, 2.7); ANIM._rotW(gb.uaR, fwd, -2.7);
      if (gb.laL) ANIM._rotW(gb.laL, fwd, 0.7); if (gb.laR) ANIM._rotW(gb.laR, fwd, -0.7);
      break;
  }
};
ANIM.coil = function(g, k) { var st = g && g.userData && ANIM._state(g); if (st) { st.coilTarget = Math.max(0, Math.min(1, k)); st.coilAt = T; } };
ANIM.release = function(g, power) {
  var st = g && g.userData && ANIM._state(g); if (!st) return;
  st.whip = -(st.coil || 0) * 1.6 - power * 0.4; st.coil = 0; st.coilAt = -9;
  st.sqV -= 2.2 + power * 3.2;                                   // stretch tall on the release
  if (power > 0.6) { st.spinT = 0.0001; st.spinTurns = power > 0.92 ? 1.5 : 1; st.spinDur = 0.55 + power * 0.25; }
};
// Disc gripped by its rim in the throwing hand (call after ANIM.drive; false when there's no hand).
// It sticks out past the fingers along the forearm, face turned away from the body, so it follows
// every pose: hanging at the side, swung back in the wind-up, whipped through on the release.
ANIM._hp = new THREE.Vector3(); ANIM._ep = new THREE.Vector3(); ANIM._sl = new THREE.Vector3(); ANIM._sr = new THREE.Vector3();
ANIM._hx = new THREE.Vector3(); ANIM._hy = new THREE.Vector3(); ANIM._hz = new THREE.Vector3(); ANIM._hm = new THREE.Matrix4();
ANIM.holdDisc = function(g, disc, radius) {
  var st = g && g.userData && g.userData.glbLoaded && ANIM._state(g), b = st && ANIM._goofyBones(st);
  if (!b || !b.haR || !b.laR || !disc) return false;
  g.updateMatrixWorld(true);   // the pose was just written; world matrices are a frame behind otherwise
  var w = b.haR.getWorldPosition(ANIM._hp), e = b.laR.getWorldPosition(ANIM._ep);
  var z = ANIM._hz.subVectors(w, e); var fl = z.length(); if (fl < 1e-4) return false; z.multiplyScalar(1 / fl);
  // the body's right-hand side, from the shoulders (follows the wind-up twist)
  var lat = ANIM._sl.subVectors(b.uaR.getWorldPosition(ANIM._sr), b.uaL.getWorldPosition(ANIM._sl)).normalize();
  var hang = Math.abs(z.y);   // 1 = arm straight down (disc hangs at the side, face out), 0 = arm level (disc held flat)
  var y = ANIM._hy.set(lat.x * hang, lat.y * hang + (1 - hang), lat.z * hang);
  y.addScaledVector(z, -y.dot(z)); if (y.lengthSq() < 1e-6) y.copy(lat).addScaledVector(z, -lat.dot(z)); y.normalize();
  var x = ANIM._hx.crossVectors(y, z);
  var R = radius || 0.25, hand = fl * (b.fingerHand ? 0.15 : 0.5) * (b.haR.scale.x || 1);   // the hand is about half a forearm long (finger rigs: measured from the knuckles)
  disc.position.copy(w).addScaledVector(z, hand + R * 0.78).addScaledVector(y, 0.05);
  disc.quaternion.setFromRotationMatrix(ANIM._hm.makeBasis(x, y, z));
  if (disc.userData.spinner) disc.userData.spinner.rotation.set(0, 0, 0);
  return true;
};
// A fidget running? (gameplay switches of animation should cancel it)
ANIM.cancelFidget = function(g) { var st = g && g.userData && g.userData._anim; if (st) { st.fidget = null; st.idleT = 0; } };

// ══════════════════════════════════════════════════════════════════════════════
// ── CAMERA FEEL ──────────────────────────────────────────────────────────────
// The lens breathes with speed: sprinting / espresso widen the view, a flying disc
// stretches it, throws kick it, knockouts punch in. Plus a short fade into every
// new hole instead of a hard cut.
// ══════════════════════════════════════════════════════════════════════════════
var CAMFX = { base: 60, fov: 60, kickV: 0 };
CAMFX.kick = function(deg) { CAMFX.kickV += deg; };
CAMFX.update = function(dt) {
  if (typeof camera === "undefined" || typeof phase === "undefined") return;
  var target = CAMFX.base;
  var fx = typeof SET === "undefined" || SET.v.speedFx;
  if (fx && phase === "WALKING" && typeof PL !== "undefined") { var hs = Math.hypot(PL.vel.x, PL.vel.z); target += Math.max(0, Math.min(1, (hs - 4.8) / 7.5)) * 13; }
  else if (fx && phase === "FLYING" && typeof discVel !== "undefined") target += Math.min(9, discVel.length() * 0.28);
  CAMFX.kickV *= Math.exp(-dt * 5);
  if (fx) target += CAMFX.kickV;
  if (typeof CINE !== "undefined") target += CINE.fovOff;   // throw-charge squeeze, bullet-time zoom
  CAMFX.fov += (target - CAMFX.fov) * (1 - Math.exp(-dt * 4));
  if (Math.abs(camera.fov - CAMFX.fov) > 0.02) { camera.fov = CAMFX.fov; camera.updateProjectionMatrix(); }
  if (typeof FEEL !== "undefined") FEEL.shake(camera, dt);
};
CAMFX.fadeIn = function() {
  var el = document.getElementById("hole-fade");
  if (!el) { el = document.createElement("div"); el.id = "hole-fade"; document.body.appendChild(el); }
  el.style.transition = "none"; el.style.opacity = "1";
  requestAnimationFrame(function() { requestAnimationFrame(function() { el.style.transition = "opacity .75s ease-out"; el.style.opacity = "0"; }); });
};
// Wind sway for instanced trees and merged foliage: tops move, trunks stay put
GFX.addSway = function(mat, amp, height, useAttr) {
  var prev = mat.onBeforeCompile;
  mat.onBeforeCompile = function(sh, r) {
    if (prev) prev(sh, r);
    sh.uniforms.uSwayT = GFX.time;
    sh.vertexShader = "uniform float uSwayT;\n" + (useAttr ? "attribute float aSway;\n" : "") + sh.vertexShader.replace("#include <begin_vertex>", [
      "#include <begin_vertex>",
      "{ float hk = clamp(" + (useAttr ? "aSway" : "position.y") + " / " + height.toFixed(2) + ", 0.0, 1.0); hk *= hk;",
      "#ifdef USE_INSTANCING",
      "  vec2 sp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);",
      "#else",
      "  vec2 sp = (modelMatrix * vec4(position, 1.0)).xz;",
      "#endif",
      "  float w = sin(uSwayT * 1.3 + sp.x * 0.21 + sp.y * 0.17) + 0.4 * sin(uSwayT * 2.7 + sp.x * 0.6);",
      "  transformed.x += w * " + amp.toFixed(3) + " * hk; transformed.z += w * " + (amp * 0.6).toFixed(3) + " * hk; }",
    ].join("\n"));
  };
  mat.customProgramCacheKey = function() { return "sway" + amp + "_" + height + (useAttr ? "a" : ""); };
  mat.needsUpdate = true;
  return mat;
};

// Who's worth looking at near `pos`: the closest other player's face within 8 m
ANIM.nearestFace = function(pos, selfMesh) {
  if (!pos) return null;
  var best = null, bd = 8, cand = [];
  if (typeof localAvatarMesh !== "undefined" && localAvatarMesh && localAvatarMesh !== selfMesh && typeof PL !== "undefined") cand.push(PL.pos);
  if (typeof mpMode !== "undefined" && mpMode) remotePlayers.forEach(function(rp) { if (rp && rp.body && rp.avatarMesh !== selfMesh) cand.push(rp.body); });
  cand.forEach(function(c) { var d = Math.hypot(c.x - pos.x, c.z - pos.z); if (d > 0.5 && d < bd) { bd = d; best = c; } });
  return best ? new THREE.Vector3(best.x, best.y + 1.6, best.z) : null;
};
