"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── RAGDOLLS ─────────────────────────────────────────────────────────────────
// Hit by a disc, a car, a rocket … tripping over a rock at full sprint, falling
// off a cliff: the character goes fully limp and physics takes over.
//
// A Verlet particle body (18 joints: pelvis, chest, neck, head, shoulders,
// elbows, wrists, hips, knees, ankles, toes) held together by distance
// constraints, a rigid torso box, soft neck/ankles, joint-range limits and
// knee/elbow hinges, colliding with the course (Course.heightAt: terrain, solids,
// walls, ceilings). Each frame the joints are turned back into bone rotations
// (torso frame + shortest-arc swings down each limb), written straight onto the
// GLB skeleton — hats, clothes and skin follow because they hang off the bones.
// When the body comes to rest the character blends back into its animation and
// gets up where it lies.
//
// Runs on any humanoid rig (Quaternius CharacterArmature, Mixamo-style, the Man
// rig). Rigs without a recognisable skeleton (Rubber Duck, Mannequin, critters)
// return false from RAG.start and keep the old procedural tumble.
//
// Network: the victim simulates their own ragdoll (and their PL.pos follows the
// pelvis, so the position stream carries it); every other screen runs the same
// impulse locally from a {t:"rag"} message and is gently pinned to the streamed
// position, so it looks right everywhere without sending bone data.
// ══════════════════════════════════════════════════════════════════════════════
var RAG = { list: [], me: null, H: 1 / 120, ITER: 7, G: 22, GETUP: 0.5 };

// Joint indices
var _RJ = { pel: 0, chest: 1, neck: 2, head: 3, shL: 4, elL: 5, haL: 6, shR: 7, elR: 8, haR: 9, hiL: 10, knL: 11, anL: 12, toL: 13, hiR: 14, knR: 15, anR: 16, toR: 17 };
RAG.RADIUS = [0.13, 0.14, 0.08, 0.12, 0.07, 0.05, 0.05, 0.07, 0.05, 0.05, 0.08, 0.06, 0.045, 0.035, 0.08, 0.06, 0.045, 0.035];
RAG.WINV = [0.6, 0.6, 0.9, 0.9, 0.8, 1, 1, 0.8, 1, 1, 0.8, 1, 1, 1, 0.8, 1, 1, 1];
// How much of a hit each joint takes (top-heavy → the body topples instead of sliding)
RAG.HITW = [0.6, 1, 1, 1, 1, 1.15, 1.2, 1, 1.15, 1.2, 0.45, 0.3, 0.15, 0.15, 0.45, 0.3, 0.15, 0.15];
// How much the legs stop dead when tripping
RAG.TRIPW = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.35, 0.7, 0.95, 0.95, 0.35, 0.7, 0.95, 0.95];
// Segments: [parent segment, joint a, joint b] — segment 0 is the torso (its own frame)
RAG.SEG = [null, [0, 2, 3], [0, 4, 5], [2, 5, 6], [0, 7, 8], [4, 8, 9], [0, 10, 11], [6, 11, 12], [7, 12, 13], [0, 14, 15], [9, 15, 16], [10, 16, 17]];
RAG.ROLE = {
  hips: /^(hips|pelvis)$/i, neck: /^neck$/i, head: /^head$/i,
  uaL: /^(upperarm_?l|leftarm|l_?upperarm|arm_?l)$/i, laL: /^(lowerarm_?l|leftforearm|forearm_?l|l_?forearm)$/i, haL: /^(wrist_?l|lefthand|palm_?l|hand_?l|fist_?l)$/i,
  uaR: /^(upperarm_?r|rightarm|r_?upperarm|arm_?r)$/i, laR: /^(lowerarm_?r|rightforearm|forearm_?r|r_?forearm)$/i, haR: /^(wrist_?r|righthand|palm_?r|hand_?r|fist_?r)$/i,
  ulL: /^(upperleg_?l|leftupleg|thigh_?l|l_?thigh)$/i, llL: /^(lowerleg_?l|leftleg|shin_?l|calf_?l|l_?calf)$/i, ftL: /^(foot_?l|leftfoot|l_?foot)$/i, toL: /^(lefttoebase|toe_?l|toes_?l|l_?toe)$/i,
  ulR: /^(upperleg_?r|rightupleg|thigh_?r|r_?thigh)$/i, llR: /^(lowerleg_?r|rightleg|shin_?r|calf_?r|r_?calf)$/i, ftR: /^(foot_?r|rightfoot|r_?foot)$/i, toR: /^(righttoebase|toe_?r|toes_?r|r_?toe)$/i,
  torso: /^(body|hips|pelvis|abdomen|torso|chest|upperchest|spine\d*|shoulder_?[lr]|leftshoulder|rightshoulder|clavicle_?[lr])$/i,
};
// role → [driving segment]
RAG.ROLESEG = { neck: 1, head: 1, uaL: 2, laL: 3, haL: 3, uaR: 4, laR: 5, haR: 5, ulL: 6, llL: 7, ftL: 8, ulR: 9, llR: 10, ftR: 11 };

RAG._v = new THREE.Vector3(); RAG._v2 = new THREE.Vector3(); RAG._v3 = new THREE.Vector3();
RAG._q = new THREE.Quaternion(); RAG._q2 = new THREE.Quaternion(); RAG._m = new THREE.Matrix4();
RAG._pp = new THREE.Vector3(); RAG._pq = new THREE.Quaternion(); RAG._ps = new THREE.Vector3();
RAG._up = new THREE.Vector3(); RAG._lat = new THREE.Vector3(); RAG._fwd = new THREE.Vector3();

RAG._rng = function(seed) { var a = seed >>> 0; return function() { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// Find the humanoid bones of a GLB (cached); null if it isn't a humanoid rig
RAG.rig = function(inner) {
  if (!inner) return null;
  if (inner.userData._ragRig !== undefined) return inner.userData._ragRig;
  var R = { torso: [] };
  inner.traverse(function(o) {
    if (!o.isBone) return;
    var n = o.name.replace(/^mixamorig[:_]?/i, "").replace(/[\s.]/g, "");
    for (var k in RAG.ROLE) { if (k === "torso") continue; if (!R[k] && RAG.ROLE[k].test(n)) R[k] = o; }
    if (RAG.ROLE.torso.test(n)) R.torso.push(o);
  });
  // rigs with fingers straight off the forearm (no wrist bone): the middle knuckle stands in for the hand
  [["haL", "laL", "fingL"], ["haR", "laR", "fingR"]].forEach(function(e) {
    var la = R[e[1]]; if (R[e[0]] || !la) return;
    var kids = la.children.filter(function(c) { return c.isBone; }); if (!kids.length) return;
    R[e[0]] = kids.find(function(c) { return /^(palm|middle)\d?[._]?[lr]$/i.test(c.name.replace(/\s/g, "")); }) || kids[0];
    R[e[2]] = kids; R.fingerHand = true;
  });
  var need = ["hips", "neck", "head", "uaL", "laL", "haL", "uaR", "laR", "haR", "ulL", "llL", "ftL", "ulR", "llR", "ftR"];
  var ok = need.every(function(k) { return !!R[k]; });
  inner.userData._ragRig = ok ? R : null;
  return inner.userData._ragRig;
};
RAG._inner = function(g) { var st = g && g.userData && typeof ANIM !== "undefined" ? ANIM._state(g) : null; return st && st.inner; };
RAG.can = function(g) { return !!(g && g.userData && g.userData.glbLoaded && g.visible !== false && RAG.rig(RAG._inner(g))); };
RAG.get = function(g) { for (var i = 0; i < RAG.list.length; i++) if (RAG.list[i].g === g) return RAG.list[i]; return null; };
RAG.active = function(g) { var e = RAG.get(g); return !!(e && e.mode === "sim"); };
RAG.pelvis = function(g) { var e = RAG.get(g); return e && e.mode === "sim" ? e.x[0] : null; };
// Local player is limp (input locked)
RAG.busy = function() { return !!(RAG.me && RAG.me.mode === "sim"); };

// Start a ragdoll on avatar wrapper g.
// o: { vel:[x,y,z] body velocity, hit:[x,y,z] extra impulse (top-heavy), kind: ko|trip|fall|knock,
//      seed, minT, maxT, pin: fn → {x,z} (soft-follow a streamed position), until: fn → true to get up,
//      onEnd: fn(facingYaw), local: true for my own player }
RAG.start = function(g, o) {
  if (!RAG.can(g)) return false;
  o = o || {};
  var old = RAG.get(g); if (old) RAG._remove(old, true);
  var inner = RAG._inner(g), rig = RAG.rig(inner);
  g.updateMatrixWorld(true);
  var W = function(b) { return b.getWorldPosition(new THREE.Vector3()); };
  var X = [];
  X[0] = W(rig.hips);
  var np = rig.neck.parent && rig.neck.parent.isBone ? rig.neck.parent : null;
  X[2] = W(rig.neck); X[1] = np && np !== rig.hips ? W(np) : X[0].clone().lerp(X[2], 0.6);
  var hp = W(rig.head), feetY = Math.min(W(rig.ftL).y, W(rig.ftR).y);
  var Ht = Math.max(0.6, hp.y - feetY + 0.2), s = Ht / 1.85;
  X[3] = hp.clone().add(RAG._v.subVectors(hp, X[2]).normalize().multiplyScalar(0.16 * s));
  X[4] = W(rig.uaL); X[5] = W(rig.laL); X[6] = W(rig.haL);
  X[7] = W(rig.uaR); X[8] = W(rig.laR); X[9] = W(rig.haR);
  X[10] = W(rig.ulL); X[11] = W(rig.llL); X[12] = W(rig.ftL);
  X[14] = W(rig.ulR); X[15] = W(rig.llR); X[16] = W(rig.ftR);
  // torso frame now (also gives "forward" for synthesised toes)
  var up = RAG._up.subVectors(X[2], X[0]).normalize(), lat = RAG._lat.subVectors(X[4], X[7]);
  lat.addScaledVector(up, -lat.dot(up)).normalize();
  var fwd = RAG._fwd.crossVectors(lat, up);
  var fh = new THREE.Vector3(fwd.x, 0, fwd.z); if (fh.lengthSq() < 1e-4) fh.set(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y)); fh.normalize();
  X[13] = rig.toL ? W(rig.toL) : X[12].clone().addScaledVector(fh, 0.17 * s);
  X[17] = rig.toR ? W(rig.toR) : X[16].clone().addScaledVector(fh, 0.17 * s);
  var qT0 = new THREE.Quaternion().setFromRotationMatrix(RAG._m.makeBasis(lat, up, fwd));
  var e = {
    g: g, inner: inner, rig: rig, mode: "sim", t: 0, acc: 0, still: 0, s: s, kind: o.kind || "ko",
    x: X, p: [], X0: X.map(function(v) { return v.clone(); }), gnd: new Float32Array(18), r: RAG.RADIUS.map(function(r) { return r * s; }),
    qT0inv: qT0.clone().invert(), R: [], d0: [], C: [], pelH: Math.max(0.3, X[0].y - feetY),
    minT: o.minT || 1.2, maxT: o.maxT || 7, pin: o.pin || null, until: o.until || null, onEnd: o.onEnd || null, local: !!o.local,
    thud: 0, culled: [],
  };
  for (var si = 0; si < RAG.SEG.length; si++) { e.R.push(new THREE.Quaternion()); var sg = RAG.SEG[si]; e.d0.push(sg ? new THREE.Vector3().subVectors(X[sg[2]], X[sg[1]]).normalize() : null); }
  // ── constraints (rest lengths from the pose we were in) ──
  var D = function(a, b) { return X[a].distanceTo(X[b]); };
  var link = function(a, b, k, kind, rest) { e.C.push([a, b, rest !== undefined ? rest : D(a, b), k, kind || 0]); };
  [[0, 1], [1, 2], [2, 3], [1, 4], [1, 7], [4, 5], [5, 6], [7, 8], [8, 9], [0, 10], [0, 14], [10, 11], [11, 12], [12, 13], [14, 15], [15, 16], [16, 17]].forEach(function(c) { link(c[0], c[1], 1); });
  [[4, 7], [10, 14], [4, 10], [7, 14], [4, 14], [7, 10], [2, 4], [2, 7], [0, 2], [1, 10], [1, 14], [0, 4], [0, 7]].forEach(function(c) { link(c[0], c[1], 1); });   // rigid torso box
  link(3, 1, 0.5); link(3, 4, 0.2); link(3, 7, 0.2);            // floppy-but-not-broken neck
  link(11, 13, 0.5); link(15, 17, 0.5);                          // ankles
  // joint ranges: limbs can't fold through themselves, knees/feet don't merge
  link(4, 6, 1, 1, (D(4, 5) + D(5, 6)) * 0.42); link(7, 9, 1, 1, (D(7, 8) + D(8, 9)) * 0.42);
  link(10, 12, 1, 1, (D(10, 11) + D(11, 12)) * 0.5); link(14, 16, 1, 1, (D(14, 15) + D(15, 16)) * 0.5);
  link(6, 1, 1, 1, 0.16 * s); link(9, 1, 1, 1, 0.16 * s); link(6, 0, 1, 1, 0.12 * s); link(9, 0, 1, 1, 0.12 * s);
  link(11, 15, 1, 1, 0.14 * s); link(12, 16, 1, 1, 0.12 * s); link(3, 0, 1, 1, D(3, 0) * 0.8);
  // ── driven bones (parents first) ──
  var drv = [], set = new Set();
  var add = function(b, seg) { if (!b || set.has(b)) return; set.add(b); drv.push({ bone: b, seg: seg }); };
  rig.torso.forEach(function(b) { add(b, 0); }); add(rig.hips, 0);
  Object.keys(RAG.ROLESEG).forEach(function(k) { add(rig[k], RAG.ROLESEG[k]); });
  drv.forEach(function(d) {
    var depth = 0, b = d.bone; while (b.parent) { depth++; b = b.parent; } d.depth = depth;
    d.free = !set.has(d.bone.parent);
    d.anc = d.seg === 0 ? 0 : RAG.SEG[d.seg][1];
    d.q0 = d.bone.getWorldQuaternion(new THREE.Quaternion()); d.p0 = W(d.bone);
    d.sq = d.bone.quaternion.clone(); d.sp = d.bone.position.clone();      // animation pose, for bones no clip touches
    d.lq = d.bone.quaternion.clone(); d.lp = d.bone.position.clone();
  });
  drv.sort(function(a, b) { return a.depth - b.depth; });
  e.drv = drv;
  // ── initial velocities ──
  var rnd = RAG._rng(o.seed || (Math.random() * 1e9));
  var v0 = new THREE.Vector3().fromArray(o.vel || [0, 0, 0]), hit = new THREE.Vector3().fromArray(o.hit || [0, 0, 0]);
  // a cartwheel spin about an axis across the hit (or random for falls)
  var axis = new THREE.Vector3(hit.z, 0, -hit.x); if (axis.lengthSq() < 0.01) axis.set(rnd() - 0.5, 0, rnd() - 0.5);
  axis.normalize(); var spin = (e.kind === "fall" ? 2.5 : e.kind === "trip" ? 1.5 : 3.5) * (0.7 + rnd() * 0.6);
  var com = new THREE.Vector3(); X.forEach(function(v) { com.add(v); }); com.multiplyScalar(1 / X.length);
  for (var i = 0; i < 18; i++) {
    var v = v0.clone();
    if (e.kind === "trip") v.addScaledVector(v0, -RAG.TRIPW[i]).add(RAG._v.set(0, 1.2 * RAG.HITW[i], 0));
    v.addScaledVector(hit, RAG.HITW[i]);
    v.add(RAG._v.crossVectors(axis, RAG._v2.subVectors(X[i], com)).multiplyScalar(spin));
    v.x += (rnd() - 0.5) * 1.2; v.y += (rnd() - 0.5) * 0.8; v.z += (rnd() - 0.5) * 1.2;
    e.p.push(X[i].clone().addScaledVector(v, -RAG.H));
  }
  // the body can leave its wrapper's bounding sphere: don't let frustum culling pop it
  inner.traverse(function(m) { if (m.isMesh && m.frustumCulled) { m.frustumCulled = false; e.culled.push(m); } });
  g.userData._rag = e;
  RAG.list.push(e);
  if (e.local) RAG.me = e;
  return true;
};

// My own player goes limp; everyone else replays the same impulse
RAG.startLocal = function(kind, vel, hit, minT) {
  if (typeof localAvatarMesh === "undefined" || !localAvatarMesh || PL.respawnT > 0) return false;
  if (typeof VEH !== "undefined" && VEH.mySeat) return false;
  var seed = (Math.random() * 1e9) >>> 0;
  var v = [vel.x, vel.y, vel.z], h = hit ? [hit.x, hit.y, hit.z] : [0, 0, 0];
  var ok = RAG.start(localAvatarMesh, { vel: v, hit: h, kind: kind, seed: seed, minT: minT, local: true, onEnd: RAG._localEnd });
  if (!ok) return false;
  PL.emoteT = 0; PL._setAnim("death"); PL.onGround = false;
  if (kind !== "ko") { AudioEngine.sfx(kind === "fall" ? "swipe" : "bonk", 0.6); if (typeof INPUT !== "undefined") INPUT.rumble(0.7, 0.5, 220); }
  if (kind === "trip") _spawnBonkText(PL.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), "TRIPPED!");
  if (typeof AudioEngine.crowd === "function") AudioEngine.crowd(kind === "ko" ? "gasp" : "laugh");
  if (typeof mpMode !== "undefined" && mpMode) sendToAll({ t: "rag", i: myIdx, k: kind, v: v.map(function(n) { return +n.toFixed(2); }), h: h.map(function(n) { return +n.toFixed(2); }), s: seed, m: minT || 0 });
  if (typeof LOG !== "undefined") LOG.ev("ragdoll", { k: kind });
  return true;
};
RAG._localEnd = function(yaw) {
  PL.yaw = yaw; PL.vel.set(0, 0, 0); PL.onGround = true; PL.airT = 0;
  if (!(typeof BT !== "undefined" && (BT.stunT > 0 || BT.frozenT > 0))) { PL._setAnim("idle"); PL.anim = "_"; PL._setAnim("idle"); }
  PL._tripCD = T + 5;
};
// Someone else went limp
RAG.onNet = function(m) {
  if (typeof remotePlayers === "undefined") return;
  var rp = remotePlayers[m.i]; if (!rp || !rp.avatarMesh || !rp.body) return;
  RAG.start(rp.avatarMesh, {
    vel: m.v, hit: m.h, kind: m.k, seed: m.s, minT: m.m || undefined,
    pin: function() { return rp.body; },
    until: function() { return rp.anim && rp.anim !== "death"; },
    onEnd: function(yaw) { rp._yaw = rp.targetYaw = yaw; if (rp.avatarMesh) rp.avatarMesh.rotation.y = yaw; },
  });
};

RAG.stop = function(g, instant) { var e = RAG.get(g); if (e) { if (instant) RAG._remove(e, true); else if (e.mode === "sim") RAG._end(e); } };
RAG.clear = function() { RAG.list.slice().forEach(function(e) { RAG._remove(e, true); }); RAG.me = null; };
RAG._remove = function(e, restorePose) {
  var i = RAG.list.indexOf(e); if (i >= 0) RAG.list.splice(i, 1);
  if (e.g.userData._rag === e) e.g.userData._rag = null;
  if (RAG.me === e) RAG.me = null;
  e.culled.forEach(function(m) { m.frustumCulled = true; }); e.culled.length = 0;
  if (restorePose) e.drv.forEach(function(d) { d.bone.quaternion.copy(d.sq); d.bone.position.copy(d.sp); });
  var st = e.g.getObjectByName && e.g.getObjectByName("bt_stars"); if (st) st.position.set(0, 2.15, 0);
};

// ── simulation ──────────────────────────────────────────────────────────────
RAG._step = function(e, c) {
  var h = RAG.H, x = e.x, p = e.p, r = e.r, gy = -RAG.G * (c.gravity || 1) * h * h, ceil = c.ceiling;
  for (var i = 0; i < 18; i++) {
    var xi = x[i], pi = p[i];
    var vx = (xi.x - pi.x) * 0.999, vy = (xi.y - pi.y) * 0.999, vz = (xi.z - pi.z) * 0.999;
    pi.copy(xi); xi.x += vx; xi.y += vy + gy; xi.z += vz;
    // walls: the ground ahead rises above where this joint was → it can't go there
    var gg = c.heightAt(xi.x, xi.z);
    if (gg > pi.y - r[i] + 0.45 && gg > xi.y - r[i] || (c.inBounds && !c.inBounds(xi.x, xi.z))) { xi.x = pi.x; xi.z = pi.z; gg = c.heightAt(xi.x, xi.z); }
    e.gnd[i] = gg;
  }
  var C = e.C, W = RAG.WINV, up = RAG._up, lat = RAG._lat, fwd = RAG._fwd, d = RAG._v;
  for (var it = 0; it < RAG.ITER; it++) {
    for (var k = 0; k < C.length; k++) {
      var cc = C[k], a = x[cc[0]], b = x[cc[1]];
      d.subVectors(b, a); var len = d.length(); if (len < 1e-6) continue;
      if (cc[4] === 1 && len >= cc[2]) continue;               // minimum-distance (joint range)
      var wa = W[cc[0]], wb = W[cc[1]], f = (len - cc[2]) / (len * (wa + wb)) * cc[3];
      a.addScaledVector(d, f * wa); b.addScaledVector(d, -f * wb);
    }
    // hinges: knees bend forwards, elbows backwards (relative to the torso)
    up.subVectors(x[2], x[0]).normalize(); lat.subVectors(x[4], x[7]).normalize(); fwd.crossVectors(lat, up).normalize();
    RAG._hinge(x[10], x[11], x[12], fwd, 0.03 * e.s, 1); RAG._hinge(x[14], x[15], x[16], fwd, 0.03 * e.s, 1);
    RAG._hinge(x[4], x[5], x[6], fwd, 0.0, -1); RAG._hinge(x[7], x[8], x[9], fwd, 0.0, -1);
    for (var j = 0; j < 18; j++) {
      if (x[j].y < e.gnd[j] + r[j]) x[j].y = e.gnd[j] + r[j];
      if (ceil !== null && ceil !== undefined && x[j].y + r[j] > ceil) x[j].y = ceil - r[j];
    }
  }
  // ground contact: friction + a little bounce; thuds for hard landings
  var hardest = 0, hj = -1;
  for (var q = 0; q < 18; q++) {
    if (x[q].y > e.gnd[q] + r[q] + 0.004) continue;
    var vy2 = x[q].y - p[q].y, fx = x[q].x - p[q].x, fz = x[q].z - p[q].z;
    var imp = -(vy2 / h); if (imp > hardest) { hardest = imp; hj = q; }
    p[q].x = x[q].x - fx * 0.86; p[q].z = x[q].z - fz * 0.86;
    if (vy2 < 0) p[q].y = x[q].y + vy2 * (c.surf === "rubber" ? 0.72 : 0.3);   // bouncy castle: bodies boing
  }
  if (hardest > 4 && e.thud <= 0) {
    e.thud = 0.18;
    var at = x[hj], k2 = Math.min(1, hardest / 12);
    if (!e.quiet) AudioEngine.sfx(hj === 3 ? "bonk" : "land", (hj === 3 ? 0.35 : 0.8) * k2, at);
    if (hardest > 7 && typeof spawnDust === "function") spawnDust(at.clone(), k2 * 0.7);
  }
};
// keep joint m on the `sign` side of the a–b line along `dir`
RAG._hinge = function(a, m, b, dir, minOff, sign) {
  var mx = (a.x + b.x) * 0.5, my = (a.y + b.y) * 0.5, mz = (a.z + b.z) * 0.5;
  var off = ((m.x - mx) * dir.x + (m.y - my) * dir.y + (m.z - mz) * dir.z) * sign;
  if (off >= minOff) return;
  var k = (minOff - off) * sign;
  m.x += dir.x * k * 0.66; m.y += dir.y * k * 0.66; m.z += dir.z * k * 0.66;
  var k2 = k * 0.17; a.x -= dir.x * k2; a.y -= dir.y * k2; a.z -= dir.z * k2; b.x -= dir.x * k2; b.y -= dir.y * k2; b.z -= dir.z * k2;
};

// joints → segment rotations (relative to the start pose)
RAG._frames = function(e) {
  var x = e.x, up = RAG._up.subVectors(x[2], x[0]).normalize(), lat = RAG._lat.subVectors(x[4], x[7]);
  lat.addScaledVector(up, -lat.dot(up)); if (lat.lengthSq() < 1e-8) lat.set(1, 0, 0); lat.normalize();
  var fwd = RAG._fwd.crossVectors(lat, up);
  e.R[0].setFromRotationMatrix(RAG._m.makeBasis(lat, up, fwd)).multiply(e.qT0inv);
  for (var s = 1; s < RAG.SEG.length; s++) {
    var sg = RAG.SEG[s], Rp = e.R[sg[0]];
    var ex = RAG._v.copy(e.d0[s]).applyQuaternion(Rp), d = RAG._v2.subVectors(x[sg[2]], x[sg[1]]);
    if (d.lengthSq() < 1e-10) { e.R[s].copy(Rp); continue; }
    d.normalize();
    e.R[s].setFromUnitVectors(ex, d).multiply(Rp);
  }
};
// segment rotations → bone transforms (world → each bone's local space)
RAG._apply = function(e) {
  var g = e.g; g.updateMatrixWorld(true);
  for (var i = 0; i < e.drv.length; i++) {
    var dv = e.drv[i], b = dv.bone, par = b.parent, Rs = e.R[dv.seg];
    par.matrixWorld.decompose(RAG._pp, RAG._pq, RAG._ps);
    RAG._pq.invert();
    b.quaternion.copy(RAG._pq).multiply(RAG._q.copy(Rs).multiply(dv.q0));
    if (dv.free) {
      var wp = RAG._v.subVectors(dv.p0, e.X0[dv.anc]).applyQuaternion(Rs).add(e.x[dv.anc]);
      b.position.copy(wp.sub(RAG._pp).applyQuaternion(RAG._pq).divide(RAG._ps));
    }
    b.updateMatrix(); b.matrixWorld.multiplyMatrices(par.matrixWorld, b.matrix);
    dv.lq.copy(b.quaternion); dv.lp.copy(b.position);
  }
};
// which way the body faces when it gets up
RAG._facing = function(e) {
  var x = e.x, f = RAG._v.subVectors(x[3], x[0]); f.y = 0;
  var lyingK = Math.abs(RAG._v2.subVectors(x[2], x[0]).normalize().y);
  if (lyingK > 0.6 || f.lengthSq() < 0.04) { RAG._frames(e); f.copy(RAG._fwd); f.y = 0; }
  if (f.lengthSq() < 1e-6) return e.g.rotation.y;
  return Math.atan2(f.x, f.z);
};
RAG._end = function(e) {
  var yaw = RAG._facing(e);
  e.mode = "blend"; e.bt = 0;
  if (e.g.userData._rag === e) e.g.userData._rag = null;
  if (RAG.me === e) RAG.me = null;
  if (e.onEnd) e.onEnd(yaw);
  // re-express the final pose under the wrapper's new position / facing so blending out doesn't pop
  if (e.local && typeof PL !== "undefined") { e.g.rotation.y = PL.yaw; e.g.position.set(PL.pos.x, e.g.position.y, PL.pos.z); }
  RAG._frames(e); RAG._apply(e);
  var st = e.g.getObjectByName && e.g.getObjectByName("bt_stars"); if (st) st.position.set(0, 2.15, 0);
};

RAG.update = function(dt) {
  if (!RAG.list.length) return;
  var h = HOLES[holeIdx], c = RAG.ground || (h && h.course);   // RAG.ground: a stand-in floor (the menu island)
  for (var n = RAG.list.length - 1; n >= 0; n--) {
    var e = RAG.list[n];
    if (!c || !e.g.parent || RAG._inner(e.g) !== e.inner) { RAG._remove(e, false); continue; }
    if (e.mode === "blend") {
      // getting up: ease from the last ragdoll pose into whatever the animation is doing now
      e.bt += dt; var k = Math.min(1, e.bt / RAG.GETUP); k = k * k * (3 - 2 * k);
      for (var i = 0; i < e.drv.length; i++) {
        var dv = e.drv[i], b = dv.bone;
        var tq = b.quaternion.equals(dv.lq) ? dv.sq : b.quaternion, tp = b.position.equals(dv.lp) ? dv.sp : b.position;
        RAG._q2.copy(dv.lq).slerp(tq, k); b.quaternion.copy(RAG._q2);
        if (dv.free) { RAG._v3.copy(dv.lp).lerp(tp, k); b.position.copy(RAG._v3); }
        dv.lq.copy(b.quaternion); dv.lp.copy(b.position);
      }
      if (e.bt >= RAG.GETUP) RAG._remove(e, false);
      continue;
    }
    // simulate
    e.acc += Math.min(dt, 0.05); var steps = 0;
    while (e.acc >= RAG.H && steps < 6) { RAG._step(e, c); e.acc -= RAG.H; steps++; }
    e.t += dt; if (e.thud > 0) e.thud -= dt;
    // remote copies: drift toward the streamed position instead of disagreeing with it
    if (e.pin) {
      var tg = e.pin();
      if (tg) {
        var dx = tg.x - e.x[0].x, dz = tg.z - e.x[0].z, dd = Math.hypot(dx, dz);
        if (dd > 6) { dx *= 0.5; dz *= 0.5; }
        if (dd > 0.15) { var kk = Math.min(1, dt * 3); for (var j = 0; j < 18; j++) { e.x[j].x += dx * kk; e.x[j].z += dz * kk; e.p[j].x += dx * kk; e.p[j].z += dz * kk; } }
      }
    }
    // rest detection
    var sp = 0; for (var q = 0; q < 18; q++) sp += e.x[q].distanceTo(e.p[q]); sp = sp / 18 / RAG.H;
    e.still = sp < 0.55 ? e.still + dt : 0;
    var pel = e.x[0], gP = c.heightAt(pel.x, pel.z);
    if (e.local) {
      PL.pos.set(pel.x, Math.max(gP, pel.y - e.pelH), pel.z);
      PL.vel.set((pel.x - e.p[0].x) / RAG.H, (pel.y - e.p[0].y) / RAG.H, (pel.z - e.p[0].z) / RAG.H);
      PL.onGround = pel.y - gP < e.pelH * 0.6;
    }
    RAG._frames(e); RAG._apply(e);
    // KO stars circle the head wherever it ended up
    var stars = e.g.getObjectByName("bt_stars");
    if (stars) stars.position.copy(e.g.worldToLocal(RAG._v.copy(e.x[3]).add(RAG._v2.set(0, 0.42 * e.s, 0))));
    var done = (e.t > e.minT && e.still > 0.35) || e.t > e.maxT || (e.until && e.t > 0.6 && e.until());
    if (done) RAG._end(e);
  }
};
