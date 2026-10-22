"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── AMBIENT LIFE ─────────────────────────────────────────────────────────────
// Birds, butterflies and leaping fish so the worlds feel inhabited.
//   • Flocks: each bird follows a slot around a wandering flock centre with a
//     little steering lag, flaps when climbing or turning, glides otherwise.
//     Gulls over the sea, songbirds over farmland, hawks circling the canyon and
//     the mountains, crows in winter and on spooky maps, pigeons in the city,
//     bats at Hogwarts. Birds scatter when a disc or a player gets close.
//   • Butterflies flutter over the meadows; fish leap out of the water.
// Everything is instanced (3 draw calls for all birds), purely cosmetic and
// identical-enough on every client (seeded per hole).
// ══════════════════════════════════════════════════════════════════════════════
var LIFE = { birds: null, flocks: [], bfly: null, fish: [], fishT: 3, theme: null };

LIFE.KINDS = {
  gull:   { body: 0xf4f4f0, wing: 0xe8e8ec, tip: 0x3a3a40, size: 0.55, speed: 7, flap: 7, glide: 0.75, alt: [7, 16] },
  song:   { body: 0x6a4a32, wing: 0x5a4030, tip: 0x2a2018, size: 0.26, speed: 9, flap: 15, glide: 0.25, alt: [4, 11] },
  hawk:   { body: 0x5a3a22, wing: 0x6a4a2a, tip: 0x2a1a10, size: 0.9, speed: 6, flap: 4, glide: 0.92, alt: [22, 40] },
  crow:   { body: 0x18181c, wing: 0x202024, tip: 0x0a0a0c, size: 0.4, speed: 7.5, flap: 9, glide: 0.4, alt: [6, 14] },
  pigeon: { body: 0x8a8e98, wing: 0x9aa0aa, tip: 0x4a4e58, size: 0.32, speed: 8, flap: 12, glide: 0.3, alt: [8, 24] },
  bat:    { body: 0x1a1420, wing: 0x2a1a2a, tip: 0x0a080c, size: 0.3, speed: 9, flap: 18, glide: 0.05, alt: [5, 14], erratic: 1 },
};
LIFE.recipe = function(th) {
  if (/^(funny|minion|emote|public_poo)$/.test(th)) return { flocks: [["gull", 6], ["gull", 4]], fish: true };
  if (/^(eerie|tornado)$/.test(th)) return { flocks: [["crow", 7]], fish: th === "tornado" };
  if (/^(village|vetschool|cabbage|feet_bunnies|socks_basket)$/.test(th)) return { flocks: [["song", 9], ["song", 6]], butterflies: 14 };
  if (th === "waterfall") return { flocks: [["song", 8]], butterflies: 8, fish: true };
  if (th === "mountains") return { flocks: [["hawk", 2], ["song", 6]] };
  if (th === "grandcanyon") return { flocks: [["hawk", 3]] };
  if (th === "winter") return { flocks: [["crow", 6]] };
  if (th === "city") return { flocks: [["pigeon", 10]] };
  if (th === "hogwarts") return { flocks: [["bat", 9]] };
  if (th === "minecraft") return { flocks: [["song", 7]], butterflies: 6 };
  if (th === "skyblock") return { flocks: [["gull", 5]] };
  return null;   // indoors, clubs, the moon, geometry dash: no wildlife
};

// ── Shared geometry ──────────────────────────────────────────────────────────
LIFE._geo = function() {
  if (LIFE._g) return LIFE._g;
  var body = new THREE.OctahedronGeometry(0.5, 0); body.scale(0.32, 0.28, 1.0);
  var tail = new THREE.ConeGeometry(0.16, 0.35, 3); tail.rotateX(-Math.PI / 2); tail.translate(0, 0, -0.55);
  var head = new THREE.SphereGeometry(0.16, 6, 4); head.translate(0, 0.06, 0.45);
  var bg = GFX.mergeGeometries([body, tail, head]);
  // wing: a swept triangle hinged at the body (x = 0), pointing +x; mirrored for the left
  var w = new THREE.BufferGeometry(), v = [0, 0, 0.22, 0, 0, -0.18, 1.1, 0, -0.32, 0.55, 0, 0.12];
  w.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); w.setIndex([0, 1, 3, 1, 2, 3]); w.computeVertexNormals();
  var wl = w.clone(); wl.scale(-1, 1, 1); wl.setIndex([0, 3, 1, 1, 3, 2]); wl.computeVertexNormals();
  [bg, w, wl].forEach(function(g) { g.userData.shared = true; });
  return (LIFE._g = { body: bg, wingR: w, wingL: wl });
};

LIFE.build = function(h, C) {
  LIFE.clear();
  var R = LIFE.recipe(h.theme); LIFE.theme = h.theme; if (!R || !C) return;
  var rnd = _gfxRng(((h.n || 1) * 4099 + 17) >>> 0), b = C.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  var span = Math.max(30, Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2), base = C.tee.y;
  // ── birds ──
  var total = 0; R.flocks.forEach(function(f) { total += f[1]; });
  if (total) {
    var G = LIFE._geo(), mat = new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
    var bodies = new THREE.InstancedMesh(G.body, mat, total), wR = new THREE.InstancedMesh(G.wingR, mat, total), wL = new THREE.InstancedMesh(G.wingL, mat, total);
    [bodies, wR, wL].forEach(function(m) { m.frustumCulled = false; m.castShadow = true; m.userData.noBatch = true; courseGrp.add(m); });
    var birds = [], k = 0, col = new THREE.Color();
    R.flocks.forEach(function(f, fi) {
      var K = LIFE.KINDS[f[0]], alt = K.alt[0] + rnd() * (K.alt[1] - K.alt[0]);
      var fl = { K: K, cx: cx + (rnd() - 0.5) * span, cz: cz + (rnd() - 0.5) * span, y: base + alt, ph: rnd() * 6.28, rad: span * (0.35 + rnd() * 0.5), w: (rnd() < 0.5 ? -1 : 1) * K.speed / (span * 0.6), home: { x: cx, z: cz }, span: span, alt: alt, scare: 0 };
      LIFE.flocks.push(fl);
      for (var i = 0; i < f[1]; i++, k++) {
        var bird = { fl: fl, i: k, slot: new THREE.Vector3((rnd() - 0.5) * 6, (rnd() - 0.5) * 2, (rnd() - 0.5) * 6), pos: new THREE.Vector3(fl.cx, fl.y, fl.cz), vel: new THREE.Vector3(), ph: rnd() * 6.28, flap: 0, s: K.size * (0.85 + rnd() * 0.3) };
        if (K.erratic) bird.slot.multiplyScalar(1.6);
        bird.pos.add(bird.slot);
        birds.push(bird);
        col.set(K.body).multiplyScalar(0.9 + rnd() * 0.2); bodies.setColorAt(k, col);
        col.set(K.wing).lerp(new THREE.Color(K.tip), 0.15).multiplyScalar(0.9 + rnd() * 0.2); wR.setColorAt(k, col); wL.setColorAt(k, col);
      }
    });
    LIFE.birds = { list: birds, bodies: bodies, wR: wR, wL: wL };
  }
  // ── butterflies ──
  if (R.butterflies) {
    var bfGeo = new THREE.PlaneGeometry(0.22, 0.16); bfGeo.translate(0.11, 0, 0); bfGeo.rotateX(-Math.PI / 2);
    var bm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    var n = R.butterflies * 2, wings = new THREE.InstancedMesh(bfGeo, bm, n); wings.frustumCulled = false; wings.userData.noBatch = true; courseGrp.add(wings);
    var cols = [0xffd23a, 0xff7ab8, 0xffffff, 0x8adcff, 0xffa83a], list = [];
    for (var j = 0; j < R.butterflies; j++) {
      var wp = LV.pointAt(C.route || [C.tee, C.basket], 0.1 + rnd() * 0.8), bx = wp.x + (rnd() - 0.5) * 16, bz = wp.z + (rnd() - 0.5) * 16;
      list.push({ x: bx, z: bz, y: C.heightAt(bx, bz) + 0.6 + rnd(), hx: bx, hz: bz, ph: rnd() * 6.28, dir: rnd() * 6.28 });
      var c2 = new THREE.Color(cols[j % cols.length]); wings.setColorAt(j * 2, c2); wings.setColorAt(j * 2 + 1, c2);
    }
    LIFE.bfly = { list: list, mesh: wings };
  }
  LIFE.fishOn = !!R.fish && C.hazard.type === "water";
  LIFE.fishT = 2 + rnd() * 4;
};
LIFE.clear = function() { LIFE.birds = null; LIFE.flocks = []; LIFE.bfly = null; LIFE.fish.forEach(function(f) { if (f.mesh.parent) f.mesh.parent.remove(f.mesh); }); LIFE.fish = []; };

// ── Per-frame ────────────────────────────────────────────────────────────────
LIFE._m = new THREE.Matrix4(); LIFE._q = new THREE.Quaternion(); LIFE._e = new THREE.Euler(); LIFE._s = new THREE.Vector3(); LIFE._p = new THREE.Vector3();
LIFE.update = function(dt, T) {
  var C = HOLES[holeIdx] && HOLES[holeIdx].course; if (!C) return;
  // things that scare birds: the player, a flying disc
  var threats = [];
  if (typeof PL !== "undefined") threats.push(PL.pos);
  if (typeof phase !== "undefined" && phase === "FLYING") threats.push(discPos);
  // flocks wander on slow loops around the course and drift back home
  LIFE.flocks.forEach(function(fl) {
    fl.ph += fl.w * dt;
    var tx = fl.home.x + Math.cos(fl.ph) * fl.rad + Math.sin(fl.ph * 0.37) * fl.span * 0.25, tz = fl.home.z + Math.sin(fl.ph) * fl.rad + Math.cos(fl.ph * 0.29) * fl.span * 0.25;
    fl.cx += (tx - fl.cx) * Math.min(1, dt * 0.6); fl.cz += (tz - fl.cz) * Math.min(1, dt * 0.6);
    var gy = C.heightAt(fl.cx, fl.cz); if (!(gy > -50)) gy = C.tee.y;
    fl.y += ((Math.max(gy, C.tee.y) + fl.alt + Math.sin(fl.ph * 2.3) * 2 + fl.scare * 8) - fl.y) * Math.min(1, dt * 0.5);
    if (fl.scare > 0) fl.scare = Math.max(0, fl.scare - dt * 0.15);
  });
  var B = LIFE.birds;
  if (B) {
    var m = LIFE._m, q = LIFE._q, e = LIFE._e, s = LIFE._s, p = LIFE._p;
    for (var i = 0; i < B.list.length; i++) {
      var b = B.list[i], fl = b.fl, K = fl.K;
      var spin = T * 0.3 + b.ph;
      var tx = fl.cx + b.slot.x * Math.cos(spin) - b.slot.z * Math.sin(spin), tz = fl.cz + b.slot.x * Math.sin(spin) + b.slot.z * Math.cos(spin), ty = fl.y + b.slot.y + Math.sin(T * 1.3 + b.ph) * 0.6;
      if (K.erratic) { tx += Math.sin(T * 3.1 + b.ph) * 2.5; ty += Math.sin(T * 4.3 + b.ph * 2) * 1.2; tz += Math.cos(T * 2.7 + b.ph) * 2.5; }
      // startled: anything within 7 m sends the flock climbing
      for (var t = 0; t < threats.length; t++) if (Math.abs(threats[t].x - b.pos.x) + Math.abs(threats[t].z - b.pos.z) < 9 && Math.abs(threats[t].y - b.pos.y) < 6) fl.scare = 1;
      var want = p.set(tx - b.pos.x, ty - b.pos.y, tz - b.pos.z), dist = want.length();
      want.multiplyScalar(Math.min(K.speed * (1 + fl.scare), dist * 1.5) / (dist || 1));
      b.vel.lerp(want, Math.min(1, dt * (K.erratic ? 3 : 1.4)));
      b.pos.addScaledVector(b.vel, dt);
      var sp = b.vel.length(), climb = b.vel.y / (sp || 1);
      // flap harder when climbing or scared, glide on the level
      var flapping = climb > 0.05 || fl.scare > 0.2 || Math.sin(T * 0.7 + b.ph * 3) > (K.glide * 2 - 1);
      b.flap += ((flapping ? 1 : 0) - b.flap) * Math.min(1, dt * 3);
      var wingA = b.flap * Math.sin(T * K.flap * (1 + fl.scare * 0.5) + b.ph) * 0.9 + (1 - b.flap) * 0.08;
      var yaw = Math.atan2(b.vel.x, b.vel.z), pitch = -Math.asin(Math.max(-1, Math.min(1, climb))) * 0.6;
      var bank = Math.max(-0.7, Math.min(0.7, ((b._yaw !== undefined ? ((yaw - b._yaw + 9.42) % 6.283 - 3.14) : 0) / Math.max(dt, 1e-3)) * -0.25));
      b._yaw = yaw;
      e.set(pitch, yaw, bank, "YXZ"); q.setFromEuler(e); s.set(b.s, b.s, b.s);
      m.compose(b.pos, q, s); B.bodies.setMatrixAt(i, m);
      e.set(pitch, yaw, bank + wingA, "YXZ"); q.setFromEuler(e); m.compose(b.pos, q, s); B.wR.setMatrixAt(i, m);
      e.set(pitch, yaw, bank - wingA, "YXZ"); q.setFromEuler(e); m.compose(b.pos, q, s); B.wL.setMatrixAt(i, m);
    }
    B.bodies.instanceMatrix.needsUpdate = B.wR.instanceMatrix.needsUpdate = B.wL.instanceMatrix.needsUpdate = true;
  }
  // butterflies: wandering, bobbing, never far from home
  var F = LIFE.bfly;
  if (F) {
    var m2 = LIFE._m, q2 = LIFE._q, e2 = LIFE._e, s2 = LIFE._s.set(1, 1, 1), p2 = LIFE._p;
    F.list.forEach(function(f, j) {
      f.dir += (Math.sin(T * 0.9 + f.ph) * 1.6 + (Math.atan2(f.hz - f.z, f.hx - f.x) - f.dir) * 0.15) * dt;
      f.x += Math.cos(f.dir) * dt * 1.4; f.z += Math.sin(f.dir) * dt * 1.4;
      var g = C.heightAt(f.x, f.z); f.y += ((g > -50 ? g : f.y) + 0.7 + Math.sin(T * 2 + f.ph) * 0.4 - f.y) * Math.min(1, dt * 2);
      var flap = Math.sin(T * 22 + f.ph) * 1.1;
      p2.set(f.x, f.y, f.z);
      e2.set(0, -f.dir + Math.PI / 2, flap, "YXZ"); q2.setFromEuler(e2); m2.compose(p2, q2, s2); F.mesh.setMatrixAt(j * 2, m2);
      e2.set(0, -f.dir + Math.PI / 2 + Math.PI, -flap, "YXZ"); q2.setFromEuler(e2); m2.compose(p2, q2, s2); F.mesh.setMatrixAt(j * 2 + 1, m2);
    });
    F.mesh.instanceMatrix.needsUpdate = true;
  }
  // fish: every few seconds one leaps out of the water near the fairway
  if (LIFE.fishOn) {
    LIFE.fishT -= dt;
    if (LIFE.fishT <= 0) {
      LIFE.fishT = 3 + Math.random() * 6;
      var r = C.route || [C.tee, C.basket], wp = LV.pointAt(r, Math.random()), fx = wp.x + (Math.random() - 0.5) * 30, fz = wp.z + (Math.random() - 0.5) * 30;
      if (C.heightAt(fx, fz) < C.hazard.level - 0.5) {
        var fm = LIFE._fishMesh(); fm.position.set(fx, C.hazard.level, fz); courseGrp.add(fm);
        var dir = Math.random() * 6.28;
        LIFE.fish.push({ mesh: fm, x: fx, z: fz, y0: C.hazard.level, t: 0, dur: 0.9 + Math.random() * 0.5, vx: Math.cos(dir) * 2.2, vz: Math.sin(dir) * 2.2, hgt: 1 + Math.random() * 1.2, dir: dir });
        if (typeof spawnWaterSplash === "function") spawnWaterSplash(new THREE.Vector3(fx, C.hazard.level, fz), 0.35);
      }
    }
    for (var fi = LIFE.fish.length - 1; fi >= 0; fi--) {
      var f2 = LIFE.fish[fi]; f2.t += dt; var u = f2.t / f2.dur;
      f2.mesh.position.set(f2.x + f2.vx * f2.t, f2.y0 + Math.sin(Math.min(1, u) * Math.PI) * f2.hgt, f2.z + f2.vz * f2.t);
      f2.mesh.rotation.set(0, Math.atan2(f2.vx, f2.vz), 0); f2.mesh.rotateX((u - 0.5) * 2.4);
      if (u >= 1) { if (typeof spawnWaterSplash === "function") spawnWaterSplash(f2.mesh.position.clone(), 0.3); courseGrp.remove(f2.mesh); LIFE.fish.splice(fi, 1); }
    }
  }
};
LIFE._fishMesh = function() {
  if (!LIFE._fishGeo) {
    var b = new THREE.SphereGeometry(0.18, 8, 6); b.scale(0.55, 0.7, 1.4);
    var t = new THREE.ConeGeometry(0.16, 0.24, 4); t.rotateX(Math.PI / 2); t.scale(0.2, 1, 1); t.translate(0, 0, -0.3);
    LIFE._fishGeo = GFX.mergeGeometries([b, t]); LIFE._fishGeo.userData.shared = true;
    LIFE._fishMat = new THREE.MeshStandardMaterial({ color: 0xc8d4e0, metalness: 0.6, roughness: 0.3 }); LIFE._fishMat.userData.shared = true;
  }
  return new THREE.Mesh(LIFE._fishGeo, LIFE._fishMat);
};
