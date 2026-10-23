"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── BOUNCY CASTLE ────────────────────────────────────────────────────────────
// A giant inflatable party: striped vinyl decks with puffy bolster walls and
// tower corners, linked by inflatable slides, tube bridges and floating
// trampolines, all hanging over a bottomless ball pit. Everything is rubber:
// you jump higher and rebound off landings, discs bounce like crazy, ragdolls
// boing around. Air dancers flail on the decks; beach balls hop about.
// ══════════════════════════════════════════════════════════════════════════════
LV.ARCH.bouncy = "bouncy";
LV.MOD_POOL.bouncy = ["gusty", "busy", "restless", "crumble"];
LV.BOUNCY = { pal: [0xff4a5a, 0xffd23a, 0x3a9cff, 0x4ad86a, 0xff8ad8, 0xff9a2a] };

// Vinyl: bold stripes, glossy
LV.vinylMat = function(a, b) {
  LV._vy = LV._vy || {};
  var k = a + "_" + b; if (LV._vy[k]) return LV._vy[k];
  var c = document.createElement("canvas"); c.width = 128; c.height = 32; var x = c.getContext("2d");
  var hx = function(n) { return "#" + n.toString(16).padStart(6, "0"); };
  for (var i = 0; i < 4; i++) { x.fillStyle = hx(i % 2 ? b : a); x.fillRect(i * 32, 0, 32, 32); }
  x.fillStyle = "rgba(255,255,255,.18)"; for (var j = 0; j < 4; j++) x.fillRect(j * 32 + 3, 0, 4, 32);   // seam highlight
  var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t._dgShared = true;
  var m = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.5 });
  m.userData.shared = true;
  return (LV._vy[k] = m);
};
LV.puffMat = function(col) {
  LV._pf = LV._pf || {};
  if (LV._pf[col]) return LV._pf[col];
  var m = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.5 }); m.userData.shared = true;
  return (LV._pf[col] = m);
};

LV.bouncy = function(c, hole, idx, d, spawns) {
  var P = LV.BOUNCY.pal;
  hole.templateLabel = LV.pick(["Party Palace", "Inflatable Keep", "Air Castle", "Boing Bastion"]);
  c.hazard = { type: "void", level: -7, base: -7 };   // the ball pit
  c.surf = "rubber";
  var crumble = hole.mods.indexOf("crumble") >= 0;
  var n = 4 + Math.min(3, Math.floor(idx / 3)), decks = [], x = 0, z = 0, y = 0;
  for (var i = 0; i < n; i++) {
    var size = i === 0 ? 10 : 11 + srng() * 6;
    if (i > 0) {
      var prev = decks[i - 1], gap = (idx < 2 ? 4 : 5) + srng() * (3 + d * 5), ang = (srng() - 0.5) * 1.2;
      x = prev.x + Math.sin(ang) * (prev.size / 2 + gap + size / 2);
      z = prev.z - Math.cos(ang) * (prev.size / 2 + gap + size / 2);
      y = Math.max(-1, Math.min(8, prev.y + (srng() - 0.35) * 5));
    }
    decks.push({ x: x, z: z, y: y, size: size, a: P[i % P.length], b: P[(i + 2) % P.length] });
  }
  // which sides open toward the neighbours (0 +x, 1 -x, 2 +z, 3 -z)
  var sideTo = function(A, B) { var dx = B.x - A.x, dz = B.z - A.z; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 0 : 1) : (dz > 0 ? 2 : 3); };
  decks.forEach(function(D, k) {
    D.open = {};
    if (k > 0) D.open[sideTo(D, decks[k - 1])] = 1;
    if (k < decks.length - 1) D.open[sideTo(D, decks[k + 1])] = 1;
    LV.bouncyDeck(c, D, k);
  });
  for (var L = 1; L < decks.length; L++) LV.bouncyLink(c, decks[L - 1], decks[L], d, L, crumble);   // "crumbling": the slides / bridges deflate under you
  LV.tee(c, decks[0].x, decks[0].y, decks[0].z + 1.5, decks[1]);
  var last = decks[decks.length - 1];
  c.basket = { x: last.x, y: last.y, z: last.z };
  c.route = decks.map(function(D) { return { x: D.x, y: D.y, z: D.z }; });
  var xs = decks.map(function(D) { return D.x; }), zs = decks.map(function(D) { return D.z; });
  c.bounds = { minX: Math.min.apply(null, xs) - 30, maxX: Math.max.apply(null, xs) + 30, minZ: Math.min.apply(null, zs) - 30, maxZ: Math.max.apply(null, zs) + 30 };
  LV.ballPit(c, decks);
  LV.bouncyDecor(c, hole, decks);
  spawns.push({ kind: "bouncy", decks: decks });
};

// One inflatable deck: a striped base, puffy bolster walls on the closed sides, towers in the corners
LV.bouncyDeck = function(c, D, k) {
  var s = D.size, h = s / 2, top = D.y;
  c.box({ x: D.x, z: D.z, w: s, d: s, top: top, bottom: top - 4, mats: [LV.vinylMat(D.a, D.b), LV.puffMat(D.a), LV.vinylMat(D.b, 0xffffff)], surf: "rubber", kind: "deck" });
  var pm = LV.puffMat(D.b), sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  sides.forEach(function(sd, si) {
    if (D.open[si]) return;
    var wx = D.x + sd[0] * (h - 0.45), wz = D.z + sd[1] * (h - 0.45), along = sd[0] === 0;
    c.box({ x: wx, z: wz, w: along ? s : 0.9, d: along ? 0.9 : s, top: top + 1.0, bottom: top, visual: false, surf: "rubber", kind: "wall" });
    var bol = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, s - 1.6, 16), pm);
    bol.position.set(wx, top + 0.55, wz); if (along) bol.rotation.z = Math.PI / 2; else bol.rotation.x = Math.PI / 2;
    bol.castShadow = true; bol.receiveShadow = true; c.group.add(bol);
  });
  // towers on every corner that sits between two closed sides
  [[1, 1, 0, 2], [1, -1, 0, 3], [-1, 1, 1, 2], [-1, -1, 1, 3]].forEach(function(q, ti) {
    if (D.open[q[2]] && D.open[q[3]]) return;
    var tx = D.x + q[0] * (h - 0.9), tz = D.z + q[1] * (h - 0.9), th = 3.6 + ((k + ti) % 3) * 0.8;
    c.cyl({ x: tx, z: tz, r: 1.0, top: top + th, bottom: top, mat: LV.vinylMat(D.a, 0xffffff), segments: 20, surf: "rubber", kind: "tower" });
    var cap = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), LV.puffMat(LV.BOUNCY.pal[(k + ti + 1) % 6]));
    cap.scale.y = 1.4; cap.position.set(tx, top + th, tz); cap.castShadow = true; c.group.add(cap);
    for (var b = 0; b < 6; b++) {   // puffy crenellations
      var a = b / 6 * Math.PI * 2, pk = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), LV.puffMat(D.b));
      pk.position.set(tx + Math.cos(a) * 1.0, top + th - 0.05, tz + Math.sin(a) * 1.0); c.group.add(pk);
    }
  });
};

// Getting from deck to deck: a slide when the height differs, a tube bridge when it doesn't,
// and sometimes nothing but a floating trampoline in the gap
LV.bouncyLink = function(c, A, B, d, k, crumble) {
  var dx = B.x - A.x, dz = B.z - A.z, Lc = Math.hypot(dx, dz), ux = dx / Lc, uz = dz / Lc;
  var ax = A.x + ux * A.size / 2, az = A.z + uz * A.size / 2, bx = B.x - ux * B.size / 2, bz = B.z - uz * B.size / 2;
  var gap = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(ux, uz), dy = B.y - A.y;
  var tramp = d > 0.25 && gap > 4.5 && gap < 9 && Math.abs(dy) < 3 && srng() < 0.35;
  if (tramp) {
    var mx = (ax + bx) / 2, mz = (az + bz) / 2, py = Math.min(A.y, B.y) - 1.4;
    c.cyl({ x: mx, z: mz, r: 1.5, top: py, bottom: py - 0.4, visual: false, bounce: 12.5, surf: "rubber", kind: "tramp" });
    var g = new THREE.Group(); g.position.set(mx, py, mz);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.18, 10, 32), LV.puffMat(0xff4a5a)); ring.rotation.x = Math.PI / 2; g.add(ring);
    var mat = new THREE.Mesh(new THREE.CircleGeometry(1.42, 28), new THREE.MeshStandardMaterial({ color: 0x1a1a28, roughness: 0.8 })); mat.rotation.x = -Math.PI / 2; mat.position.y = -0.02; g.add(mat);
    g.traverse(function(m) { if (m.isMesh) m.castShadow = true; }); c.group.add(g);
    return;
  }
  var len = gap + 1.6, mx2 = (ax + bx) / 2, mz2 = (az + bz) / 2, w = Math.abs(dy) > 1.2 ? 3.4 : 3;
  c.box({ x: mx2, z: mz2, w: w, d: len, top: A.y, top2: B.y, bottom: Math.min(A.y, B.y) - 0.6, ramp: true, rot: yaw, mats: [LV.puffMat(0x3a9cff), LV.puffMat(0x3a9cff), LV.vinylMat(0xffd23a, 0xff4a5a)], surf: "rubber", kind: "crossing", crumble: !!crumble }).crossing = true;
  // puffy rails along both sides
  var rail = LV.puffMat(0xff4a5a), slope = Math.atan2(dy, len);
  [-1, 1].forEach(function(s) {
    var r = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, Math.hypot(len, dy), 12), rail);
    r.position.set(mx2 + Math.cos(yaw) * s * (w / 2), (A.y + B.y) / 2 + 0.45, mz2 - Math.sin(yaw) * s * (w / 2));
    r.rotation.order = "YXZ"; r.rotation.y = yaw; r.rotation.x = Math.PI / 2 - slope;
    r.castShadow = true; c.group.add(r);
  });
};

// The ball pit: a sea of coloured balls (instanced near the course, a painted plane beyond)
LV.ballPit = function(c, decks) {
  var lvl = c.hazard.level + 0.4, b = c.bounds, P = LV.BOUNCY.pal;
  var cv = document.createElement("canvas"); cv.width = cv.height = 256; var x = cv.getContext("2d");
  x.fillStyle = "#3a7ad8"; x.fillRect(0, 0, 256, 256);
  for (var i = 0; i < 90; i++) {
    var px = Math.random() * 256, py = Math.random() * 256, r = 10 + Math.random() * 6, col = "#" + P[i % P.length].toString(16).padStart(6, "0");
    [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]].forEach(function(o) {
      var g = x.createRadialGradient(px + o[0] - r * 0.35, py + o[1] - r * 0.35, r * 0.1, px + o[0], py + o[1], r);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.25, col); g.addColorStop(1, "rgba(0,0,0,.35)");
      x.fillStyle = g; x.beginPath(); x.arc(px + o[0], py + o[1], r, 0, Math.PI * 2); x.fill();
    });
  }
  var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
  var plane = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }));
  plane.rotation.x = -Math.PI / 2; plane.position.set((b.minX + b.maxX) / 2, lvl - 0.3, (b.minZ + b.maxZ) / 2); plane.receiveShadow = true; plane.userData.noBatch = true;
  c.group.add(plane);
  // real balls heaped around and under the decks
  var geo = new THREE.SphereGeometry(0.42, 10, 8), mat = new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.4, envMapIntensity: 0.5 });
  var N = 1600, im = new THREE.InstancedMesh(geo, mat, N), m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (var k = 0; k < N; k++) {
    var D = decks[k % decks.length], a = srng() * 6.28, rr = Math.sqrt(srng()) * (D.size * 0.9 + 6);
    m4.makeTranslation(D.x + Math.cos(a) * rr, lvl - 0.25 + srng() * 0.5, D.z + Math.sin(a) * rr); im.setMatrixAt(k, m4);
    im.setColorAt(k, col.setHex(P[k % P.length]));
  }
  im.receiveShadow = true; im.userData.noBatch = true; c.group.add(im);
};

// Party decorations: an inflatable arch at the tee, a giant rubber duck, balloons, bunting
LV.bouncyDecor = function(c, hole, decks) {
  var P = LV.BOUNCY.pal, T0 = decks[0], lvl = c.hazard.level;
  // welcome arch over the tee
  var arch = new THREE.Group(); arch.position.set(T0.x, T0.y, T0.z - T0.size / 2 + 1.2);
  [-1, 1].forEach(function(s) { var p = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 5, 16), LV.vinylMat(0xff4a5a, 0xffffff)); p.position.set(s * 4, 2.5, 0); arch.add(p); });
  var top = new THREE.Mesh(new THREE.TorusGeometry(4, 0.75, 14, 40, Math.PI), LV.vinylMat(0xffd23a, 0x3a9cff)); top.position.y = 5; arch.add(top);
  arch.traverse(function(m) { if (m.isMesh) m.castShadow = true; }); c.group.add(arch);
  // a giant rubber duck bobbing in the ball pit
  var mid = decks[Math.floor(decks.length / 2)], duck = new THREE.Group(), yel = LV.puffMat(0xffd83a), orng = LV.puffMat(0xff8a1a);
  var body = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), yel); body.scale.set(1.1, 0.8, 1.3); duck.add(body);
  var head = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 14), yel); head.position.set(0, 4, 3); duck.add(head);
  var beak = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), orng); beak.scale.set(1.2, 0.45, 1.4); beak.position.set(0, 3.6, 5.2); duck.add(beak);
  [-1, 1].forEach(function(s) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0x111111 })); e.position.set(s * 1.1, 4.8, 4.9); duck.add(e); });
  duck.position.set(mid.x + mid.size / 2 + 16, lvl + 1.5, mid.z + 4); duck.rotation.y = -1.2;
  duck.traverse(function(m) { if (m.isMesh) m.castShadow = true; }); c.group.add(duck);
  c.updaters.push(function(T) { duck.position.y = lvl + 1.5 + Math.sin(T * 0.8) * 0.4; duck.rotation.z = Math.sin(T * 0.6) * 0.05; });
  // balloons drifting around the edge of the course
  var strM = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  for (var i = 0; i < 26; i++) {
    var D = decks[i % decks.length], a = srng() * 6.28, r = D.size / 2 + 3 + srng() * 10, bx = D.x + Math.cos(a) * r, bz = D.z + Math.sin(a) * r, by = D.y + 4 + srng() * 8;
    var bal = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), LV.puffMat(P[i % P.length])); bal.scale.y = 1.2; bal.position.set(bx, by, bz); c.group.add(bal);
    var sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.9, 0), new THREE.Vector3(0.2, -3.2, 0)]), st = new THREE.Line(sg, strM); bal.add(st);
    (function(m, y0, ph) { c.updaters.push(function(T) { m.position.y = y0 + Math.sin(T * 0.7 + ph) * 0.6; m.rotation.z = Math.sin(T * 0.9 + ph) * 0.12; }); })(bal, by, i * 1.7);
  }
  // bunting strung across each deck
  decks.forEach(function(D, k) {
    var flags = new THREE.Group(), n = 9, h0 = D.y + 4.2, x0 = D.x - D.size / 2 + 1, x1 = D.x + D.size / 2 - 1;
    for (var f = 0; f < n; f++) {
      var u = f / (n - 1), fl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 3), LV.puffMat(P[(f + k) % P.length]));
      fl.rotation.x = Math.PI; fl.position.set(x0 + (x1 - x0) * u, h0 - Math.sin(u * Math.PI) * 0.8 - 0.3, D.z); flags.add(fl);
    }
    c.group.add(flags);
  });
};

// ── Air dancers: inflatable tube guys flailing on the decks (they knock you over) ──
ENT.M.airDancer = function(col) {
  var g = new THREE.Group(), segs = [], parent = g, m = LV.puffMat(col), face = LV.puffMat(0xffffff);
  var fan = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.5, 14), ENT.mat(0x3a3a44, { metalness: 0.5 })); fan.position.y = 0.25; g.add(fan);
  for (var i = 0; i < 7; i++) {
    var seg = new THREE.Group(); seg.position.y = i === 0 ? 0.5 : 0.62; parent.add(seg);
    var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.66, 12), m); tube.position.y = 0.33; tube.castShadow = true; seg.add(tube);
    segs.push(seg); parent = seg;
  }
  var head = segs[6];
  [-1, 1].forEach(function(s) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), face); e.position.set(s * 0.14, 0.45, 0.3); head.add(e); var p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: 0x111111 })); p.position.set(s * 0.14, 0.45, 0.4); head.add(p); });
  var mouth = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x111111 })); mouth.rotation.z = Math.PI; mouth.position.set(0, 0.25, 0.36); head.add(mouth);
  var arms = [];
  [-1, 1].forEach(function(s) {
    var arm = new THREE.Group(); arm.position.set(s * 0.36, 0.4, 0); segs[4].add(arm);
    var a = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.6, 8), m); a.position.y = 0.8; a.castShadow = true; arm.add(a);
    arm.userData.s = s; arms.push(arm);
  });
  g.userData.air = { segs: segs, arms: arms };
  return g;
};
ENT.B.airDancer = function(o, dt) {
  var A = o.mesh.userData.air, t = ENT.now * o.rate + o.phase;
  A.segs.forEach(function(s, i) { s.rotation.z = Math.sin(t * 3.1 - i * 0.7) * (0.12 + i * 0.04); s.rotation.x = Math.sin(t * 2.3 - i * 0.6) * (0.08 + i * 0.03); });
  A.arms.forEach(function(a) { a.rotation.z = a.userData.s * (1.2 + Math.sin(t * 5 + a.userData.s) * 0.9); a.rotation.x = Math.sin(t * 4.2 + a.userData.s * 2) * 0.8; });
  if (Math.sin(t * 0.37) > 0.97) { A.segs[3].rotation.x += 1.2; }   // every so often it folds right over
  o.knockNow = true;
};
// Hopping beach balls
ENT.B.beachBall = function(o, dt) {
  var t = ENT.now * 1.7 + o.phase, k = Math.abs(Math.sin(t));
  o.lift = k * 1.8; o.mesh.rotation.y += dt * 0.8;
  o.mesh.scale.set(1 + (1 - k) * 0.15 * (k < 0.15 ? 1 : 0), 1 - (1 - k) * 0.25 * (k < 0.15 ? 1 : 0), 1 + (1 - k) * 0.15 * (k < 0.15 ? 1 : 0));
  o.knockNow = o.lift < 1.2; o.worldY = o.y + o.lift;
};
ENT.M.beachBall = function() {
  var g = new THREE.Group(), P = LV.BOUNCY.pal, r = 0.9;
  for (var i = 0; i < 6; i++) {
    var s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12, i / 6 * Math.PI * 2, Math.PI / 3), LV.puffMat([0xffffff, P[0], P[1], 0xffffff, P[2], P[3]][i])); s.position.y = r; s.castShadow = true; g.add(s);
  }
  return g;
};
ENT.bouncy = function(c, spawns, idx, dens) {
  var info = spawns.filter(function(s) { return s.kind === "bouncy"; })[0]; if (!info) return;
  info.decks.forEach(function(D, i) {
    if (i === 0) return;
    var n = Math.round((i === info.decks.length - 1 ? 0.5 : 1 + srng()) * dens);
    for (var k = 0; k < n; k++) {
      var a = srng() * 6.28, r = (D.size / 2 - 2.2) * Math.sqrt(srng()), x = D.x + Math.cos(a) * r, z = D.z + Math.sin(a) * r;
      if (Math.hypot(x - c.basket.x, z - c.basket.z) < 4) continue;
      if (srng() < 0.5) ENT.add({ type: "airdancer", mesh: ENT.M.airDancer(LV.BOUNCY.pal[(i + k) % 6]), x: x, z: z, y: D.y, r: 0.55, h: 4.6, update: ENT.B.airDancer, rate: 0.8 + srng() * 0.5, phase: srng() * 6, knock: 7.5, knockUp: 7 });
      else ENT.add({ type: "beachball", mesh: ENT.M.beachBall(), x: x, z: z, y: D.y, r: 0.9, h: 1.8, update: ENT.B.beachBall, phase: srng() * 3, knock: 6.8, knockUp: 6 });
    }
  });
};
