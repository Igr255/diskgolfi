"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── GAME FEEL ────────────────────────────────────────────────────────────────
//   • Trauma camera shake: smooth noise, scales with impact, any camera mode,
//     honours the "screen shake" accessibility slider.
//   • Radial speed blur in the post chain, driven by disc / car / sprint speed.
//   • Bullet time when your disc whips past another player.
//   • Knock-out camera pulls back to follow the tumble.
//   • Out of bounds: a glowing laser-grid barrier fades in as you approach the edge,
//     and stepping past it starts a 3-second "get back" countdown.
//   • Wind: local gust zones (seeded per hole, same for everyone) push discs, and
//     wind streaks drift through the air so you can see the wind.
//   • Specialty discs: Sticky (stops dead on contact) and Anvil (heavy — ignores
//     lift and wind, bowls through players).
// ══════════════════════════════════════════════════════════════════════════════
var FEEL = { gusts: [], oobT: 0, blur: 0 };

// ── noise for shake ──────────────────────────────────────────────────────────
FEEL._n = function(t, s) { return Math.sin(t * 1.0 + s) * 0.5 + Math.sin(t * 2.31 + s * 1.7) * 0.3 + Math.sin(t * 4.73 + s * 2.9) * 0.2; };
FEEL.shake = function(cam, dt) {
  if (typeof _screenShake === "undefined" || _screenShake < 0.001) return;
  var amt = Math.min(1, _screenShake) * (SET.v ? SET.v.shake : 1); if (amt <= 0) return;
  var tr = amt * amt, t = performance.now() / 1000 * 26;
  cam.position.x += FEEL._n(t, 1) * tr * 0.55; cam.position.y += FEEL._n(t, 7) * tr * 0.4; cam.position.z += FEEL._n(t, 13) * tr * 0.3;
  cam.rotateZ(FEEL._n(t, 21) * tr * 0.04);
};

// ── per-frame: blur amount, OOB barrier, wind visuals ────────────────────────
FEEL.update = function(dt) {
  var spd = 0;
  if (typeof phase !== "undefined") {
    if (phase === "FLYING") spd = discVel.length();
    else if (typeof VEH !== "undefined" && VEH.mySeat) spd = Math.abs(VEH.mySeat.car.speed || 0) * 0.55;   // driving: only a hint of blur — you need to see where you're going
    else if (phase === "WALKING" && typeof PL !== "undefined") spd = Math.hypot(PL.vel.x, PL.vel.z) * 0.9;
  }
  var target = SET.v && !SET.v.speedFx ? 0 : Math.max(0, Math.min(1, (spd - 9) / 22));
  FEEL.blur += (target - FEEL.blur) * Math.min(1, dt * 4);
  if (GFX.gradePass && GFX.gradePass.uniforms.blur) GFX.gradePass.uniforms.blur.value = FEEL.blur * 0.026;
  FEEL._barrier(dt);
  FEEL._wind(dt);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── OUT OF BOUNDS ────────────────────────────────────────────────────────────
FEEL._barrierMat = null;
FEEL.build = function(h, C) {
  FEEL.oobT = 0; FEEL.gusts = []; FEEL._streaks = null; FEEL._leaves = null;
  if (!C) return;
  // barrier walls around the playable area (heightfield / bounds rectangle)
  var f = C.hf, r = f ? { x0: f.x0, x1: f.maxX, z0: f.z0, z1: f.maxZ } : { x0: C.bounds.minX, x1: C.bounds.maxX, z0: C.bounds.minZ, z1: C.bounds.maxZ };
  var outdoor = !C.ceiling && C.outer;
  if (outdoor) {
    if (!FEEL._barrierMat) FEEL._barrierMat = new THREE.ShaderMaterial({
      uniforms: { uP: { value: new THREE.Vector3() }, uT: GFX.time, uCol: { value: new THREE.Color(0x40e0ff) } },
      vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: [
        "uniform vec3 uP; uniform float uT; uniform vec3 uCol; varying vec3 vW;",
        "void main(){",
        "  float d = length(vW.xz - uP.xz) + abs(vW.y - uP.y - 1.0) * 0.6;",
        "  float near = 1.0 - smoothstep(3.0, 11.0, d);",
        "  vec2 g = abs(fract(vec2(vW.x + vW.z, vW.y) * 0.8 + vec2(0.0, uT * 0.4)) - 0.5);",
        "  float line = smoothstep(0.46, 0.5, max(g.x, g.y));",
        "  float scan = 0.5 + 0.5 * sin(vW.y * 3.0 - uT * 4.0);",
        "  float a = near * (line * 0.85 + 0.12 + scan * 0.08);",
        "  if (a < 0.01) discard;",
        "  gl_FragColor = vec4(uCol * (1.2 + line), a);",
        "}"].join("\n"),
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    var yLo = C.hazard.level - 6, yHi = C.tee.y + 40, wall = function(ax, az, bx, bz) {
      var len = Math.hypot(bx - ax, bz - az), g = new THREE.PlaneGeometry(len, yHi - yLo);
      var m = new THREE.Mesh(g, FEEL._barrierMat); m.position.set((ax + bx) / 2, (yLo + yHi) / 2, (az + bz) / 2); m.rotation.y = Math.atan2(bz - az, bx - ax) * -1;
      m.renderOrder = 5; m.userData.noBatch = true; courseGrp.add(m);
    };
    wall(r.x0, r.z0, r.x1, r.z0); wall(r.x0, r.z1, r.x1, r.z1); wall(r.x0, r.z0, r.x0, r.z1); wall(r.x1, r.z0, r.x1, r.z1);
  }
  // gust zones: seeded per hole so every player feels the same wind
  var indoor = !!C.ceiling || /club|interior/.test(h.arch || "");
  if (!indoor && C.route && C.route.length > 1) {
    var rnd = _gfxRng(((typeof matchSeed !== "undefined" ? matchSeed : 1) + (h.n || 1) * 911) >>> 0), n = 1 + Math.floor(rnd() * 3);
    for (var i = 0; i < n; i++) {
      var p = LV.pointAt(C.route, 0.25 + rnd() * 0.6), a = rnd() * 6.28, s = 2.5 + rnd() * 4.5;
      FEEL.gusts.push({ x: p.x + (rnd() - 0.5) * 14, z: p.z + (rnd() - 0.5) * 14, y: C.heightAt(p.x, p.z), r: 8 + rnd() * 8, vx: Math.cos(a) * s, vz: Math.sin(a) * s, ph: rnd() * 6.28 });
    }
  }
  FEEL._buildWindFx(h, C);
};
// Strength of the gusts at (x, z) right now (shared clock → same on every screen)
FEEL.gustAt = function(x, z, out) {
  out.x = 0; out.z = 0;
  var tN = typeof netTime === "function" ? netTime() : T;
  for (var i = 0; i < FEEL.gusts.length; i++) {
    var g = FEEL.gusts[i], d = Math.hypot(x - g.x, z - g.z); if (d > g.r) continue;
    var k = (1 - d / g.r) * (0.55 + 0.45 * Math.sin(tN * 0.9 + g.ph));
    out.x += g.vx * k; out.z += g.vz * k;
  }
  return out;
};
FEEL._barrier = function(dt) {
  if (FEEL._barrierMat && typeof PL !== "undefined") FEEL._barrierMat.uniforms.uP.value.copy(phase === "FLYING" ? discPos : PL.pos);
  var el = document.getElementById("oob-warn");
  if (FEEL.oobT > 0) {
    if (!el) { el = document.createElement("div"); el.id = "oob-warn"; (document.getElementById("ui") || document.body).appendChild(el); }
    el.style.display = "block"; el.textContent = "⚠ " + t("oob_warn", { s: Math.max(1, Math.ceil(3 - FEEL.oobT)) });
  } else if (el) el.style.display = "none";
};
// Player in an "ob" zone this frame? Returns true when the 3 s grace is used up.
FEEL.oobStep = function(dt, outside) {
  if (!outside) { if (FEEL.oobT > 0) FEEL.oobT = Math.max(0, FEEL.oobT - dt * 3); return false; }
  if (FEEL.oobT === 0) { if (typeof TIPS !== "undefined") TIPS.show("ob"); if (typeof LOG !== "undefined") LOG.ev("ob", { x: Math.round(PL.pos.x), z: Math.round(PL.pos.z), theme: HOLES[holeIdx] && HOLES[holeIdx].theme, who: "player" }); }
  FEEL.oobT += dt;
  if (FEEL.oobT >= 3) { FEEL.oobT = 0; return true; }
  return false;
};

// ══════════════════════════════════════════════════════════════════════════════
// ── WIND YOU CAN SEE ─────────────────────────────────────────────────────────
FEEL._buildWindFx = function(h, C) {
  if (C.ceiling) return;
  var n = 90;
  var g = new THREE.PlaneGeometry(1, 0.035); g.rotateX(-Math.PI / 2);
  var m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  var mesh = new THREE.InstancedMesh(g, m, n); mesh.frustumCulled = false; mesh.userData.noBatch = true; courseGrp.add(mesh);
  var list = []; for (var i = 0; i < n; i++) list.push({ p: new THREE.Vector3(), life: Math.random(), len: 2 + Math.random() * 4 });
  FEEL._streaks = { mesh: mesh, list: list };
  // swirling leaves inside gust zones
  if (FEEL.gusts.length) {
    var lg = new THREE.PlaneGeometry(0.16, 0.1), lm = new THREE.MeshLambertMaterial({ color: /winter/.test(h.theme) ? 0xffffff : /grandcanyon|moon/.test(h.theme) ? 0xc8a070 : 0x8ab040, side: THREE.DoubleSide });
    var ln = FEEL.gusts.length * 26, lmesh = new THREE.InstancedMesh(lg, lm, ln); lmesh.frustumCulled = false; lmesh.userData.noBatch = true; courseGrp.add(lmesh);
    var leaves = []; for (var j = 0; j < ln; j++) leaves.push({ g: FEEL.gusts[j % FEEL.gusts.length], a: Math.random() * 6.28, r: Math.random(), y: Math.random() * 4, s: 0.6 + Math.random() * 0.8 });
    FEEL._leaves = { mesh: lmesh, list: leaves };
  }
};
FEEL._m4 = new THREE.Matrix4(); FEEL._q = new THREE.Quaternion(); FEEL._e = new THREE.Euler(); FEEL._sc = new THREE.Vector3(); FEEL._gv = { x: 0, z: 0 };
FEEL._wind = function(dt) {
  var S = FEEL._streaks, h = HOLES[holeIdx]; if (!S || !h || typeof camera === "undefined") return;
  var w = h.wind || { x: 0, z: 0 }, wm = typeof getWeatherWindMult === "function" ? getWeatherWindMult() : 1, wx = w.x * wm, wz = w.z * wm, ws = Math.hypot(wx, wz);
  var C = h.course, cp = camera.position, m4 = FEEL._m4, q = FEEL._q, e = FEEL._e, sc = FEEL._sc;
  var visible = Math.min(S.list.length, Math.round(10 + ws * 9));
  for (var i = 0; i < S.list.length; i++) {
    var s = S.list[i];
    if (i >= visible) { sc.set(0, 0, 0); m4.compose(s.p, q, sc); S.mesh.setMatrixAt(i, m4); continue; }
    s.life += dt * 0.6;
    if (s.life >= 1 || s.p.distanceToSquared(cp) > 1600) {
      s.life = 0; var a = Math.random() * 6.28, r = 6 + Math.random() * 28;
      s.p.set(cp.x + Math.cos(a) * r, 0, cp.z + Math.sin(a) * r);
      var g = C ? C.heightAt(s.p.x, s.p.z) : 0; s.p.y = Math.max(g > -50 ? g : cp.y - 5, C ? C.hazard.level : 0) + 0.5 + Math.random() * 6;
    }
    var gv = FEEL.gustAt(s.p.x, s.p.z, FEEL._gv), vx = wx * 2.2 + gv.x * 2, vz = wz * 2.2 + gv.z * 2, v = Math.hypot(vx, vz);
    s.p.x += vx * dt; s.p.z += vz * dt;
    var fade = Math.sin(s.life * Math.PI);
    e.set(0, -Math.atan2(vz, vx), 0); q.setFromEuler(e); sc.set(s.len * Math.min(1.5, 0.3 + v * 0.12) * fade, 1, 1 + fade);
    m4.compose(s.p, q, sc); S.mesh.setMatrixAt(i, m4);
  }
  S.mesh.instanceMatrix.needsUpdate = true;
  var L = FEEL._leaves;
  if (L) {
    var tN = typeof netTime === "function" ? netTime() : T;
    for (var j = 0; j < L.list.length; j++) {
      var lf = L.list[j], g2 = lf.g, k = 0.55 + 0.45 * Math.sin(tN * 0.9 + g2.ph);
      lf.a += dt * (0.6 + k * 1.6) * lf.s; lf.y += Math.sin(lf.a * 2 + j) * dt * 0.6;
      if (lf.y > 5 || lf.y < 0.2) lf.y = 0.3 + Math.random() * 3;
      var rr = g2.r * (0.25 + lf.r * 0.6);
      var x = g2.x + Math.cos(lf.a) * rr, z = g2.z + Math.sin(lf.a) * rr;
      e.set(lf.a * 3, lf.a * 2, lf.a); q.setFromEuler(e); sc.set(1, 1, 1);
      m4.compose(new THREE.Vector3(x, g2.y + lf.y, z), q, sc); L.mesh.setMatrixAt(j, m4);
    }
    L.mesh.instanceMatrix.needsUpdate = true;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ── SPECIALTY DISCS ──────────────────────────────────────────────────────────
// PU.discMod is set by the Sticky / Anvil items for the next throw; remote throws
// carry it in the "throw" message so everyone simulates the same flight.
FEEL.mod = null;   // modifier of the disc being simulated right now
FEEL.aeroMods = function(vel, dt, spd, d) {
  // returns factors used by _discAero
  if (FEEL.mod === "heavy") return { lift: 0.35, wind: 0.15, drag: 0.5, turn: 0.4 };
  return null;
};
