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
  var piv = 0.9, tb = st.tumble;
  inner.position.set(st.pos.x, st.pos.y + piv - piv * Math.cos(tb), st.pos.z - piv * Math.sin(tb));
  inner.rotation.set(st.rot.x + st.lean + tb, st.rot.y, st.rot.z + st.bank);
  inner.scale.set(st.scale.x * (1 + s * 0.5 - breathe * 0.3), st.scale.y * (1 - s + breathe), st.scale.z * (1 + s * 0.5 - breathe * 0.3));
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
ANIM.restore = function() { for (var i = 0; i < ANIM._mod.length; i++) ANIM._mod[i][0].quaternion.copy(ANIM._mod[i][1]); ANIM._mod.length = 0; };
ANIM._v = new THREE.Vector3(); ANIM._q1 = new THREE.Quaternion(); ANIM._q2 = new THREE.Quaternion(); ANIM._q3 = new THREE.Quaternion(); ANIM._eu = new THREE.Euler();
ANIM.look = function(g, target, dt) {
  var st = g && g.userData && ANIM._state(g); if (!st) return;
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

// Jump stretch / landing squash: amount ~0.1 (light) … 0.3 (big drop). Negative = stretch.
ANIM.squash = function(g, amount) {
  var st = g && ANIM._state(g); if (!st) return;
  st.sqV += amount * 9;
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
  if (phase === "WALKING" && typeof PL !== "undefined") { var hs = Math.hypot(PL.vel.x, PL.vel.z); target += Math.max(0, Math.min(1, (hs - 4.8) / 7.5)) * 13; }
  else if (phase === "FLYING" && typeof discVel !== "undefined") target += Math.min(9, discVel.length() * 0.28);
  CAMFX.kickV *= Math.exp(-dt * 5);
  target += CAMFX.kickV;
  CAMFX.fov += (target - CAMFX.fov) * (1 - Math.exp(-dt * 4));
  if (Math.abs(camera.fov - CAMFX.fov) > 0.02) { camera.fov = CAMFX.fov; camera.updateProjectionMatrix(); }
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
