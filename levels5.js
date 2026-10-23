"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── DINO JUNGLE ──────────────────────────────────────────────────────────────
// A prehistoric valley on the highlands terrain: giant ferns, palms, fossil rib
// cages and dino nests; a volcano smoking on the horizon that lobs lava bombs
// onto the course (telegraphed by a growing red ring — timed off the shared match
// clock, so everyone sees the same eruption without any network traffic).
// Its residents:
//   🦖 T-rex      wanders, spots you, ROARS, then charges — and sends you flying
//   🦎 raptors    quick, nippy, and they run off with resting discs
//   🦕 long-neck  a gentle giant plodding across the fairway (mind its feet)
//   pterodactyls circle overhead (life.js)
// ══════════════════════════════════════════════════════════════════════════════
var JUNGLE = {};
LV.ARCH.jungle = "highlands";
LV.HL.jungle = { amp: 11, slope: 0.45, prof: function(t) { return 2 + Math.sin(t * 5) * 2.2 + t * 3; }, rivers: [0.42], fw: 9, top: 0x2f6a1a, side: 0x6a4a2e, label: "Lost Valley", riverW: 4.5 };
LV.post = LV.post || {};

// ── course extras: fossils, nests, the lava-bomb clock ───────────────────────
LV.post.jungle = function(c, hole, idx, d, spawns) {
  var R = c.route, bone = new THREE.MeshStandardMaterial({ color: 0xeee2c4, roughness: 0.7 }); bone.userData.shared = true;
  // a giant fossil rib cage arching over the fairway (you throw through it)
  var p = LV.pointAt(R, 0.3 + srng() * 0.3), g = c.heightAt(p.x, p.z);
  if (g > c.hazardAt(p.x, p.z).level + 0.5) {
    var cage = new THREE.Group(); cage.position.set(p.x, g, p.z); cage.rotation.y = Math.atan2(p.dx, p.dz);
    var spine = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 12, 10), bone); spine.rotation.x = Math.PI / 2; spine.position.y = 7.2; cage.add(spine);
    for (var r = 0; r < 6; r++) {
      var rib = new THREE.Mesh(new THREE.TorusGeometry(5.6 - Math.abs(r - 2.5) * 0.35, 0.28, 8, 24, Math.PI * 1.05), bone);
      rib.position.z = -5 + r * 2; rib.rotation.z = -0.03; rib.position.y = 1.6; cage.add(rib);
    }
    var skull = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 10), bone); skull.scale.set(1, 0.8, 1.6); skull.position.set(0, 7, 7.4); cage.add(skull);
    cage.traverse(function(m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    cage.userData.noBatch = true; c.group.add(cage);
    // the rib feet are solid (you can bonk a disc off them)
    for (var rr = 0; rr < 6; rr++) [-1, 1].forEach(function(s) {
      var lx = s * (5.6 - Math.abs(rr - 2.5) * 0.35), lz = -5 + rr * 2, cs = Math.cos(cage.rotation.y), sn = Math.sin(cage.rotation.y);
      c.cyl({ x: p.x + lx * cs + lz * sn, z: p.z - lx * sn + lz * cs, r: 0.35, top: g + 2.4, bottom: g - 0.5, visual: false, kind: "bone" });
    });
  }
  // dino nests with big spotted eggs
  for (var n = 0; n < 2; n++) {
    var q = LV.pointAt(R, 0.15 + srng() * 0.7), side = srng() < 0.5 ? -1 : 1, nx = q.x - q.dz * (8 + srng() * 4) * side, nz = q.z + q.dx * (8 + srng() * 4) * side, ng = c.heightAt(nx, nz);
    if (ng < c.hazardAt(nx, nz).level + 0.4) continue;
    var nest = new THREE.Group(); nest.position.set(nx, ng, nz);
    var straw = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.45, 8, 20), new THREE.MeshStandardMaterial({ color: 0x9a7a3a, roughness: 1 })); straw.rotation.x = Math.PI / 2; straw.position.y = 0.3; nest.add(straw);
    for (var e = 0; e < 3; e++) {
      var egg = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshStandardMaterial({ color: [0xf4ecd8, 0xd8f0e0, 0xf0d8e8][e], roughness: 0.5 }));
      egg.scale.y = 1.3; egg.position.set(Math.cos(e * 2.1) * 0.45, 0.55, Math.sin(e * 2.1) * 0.45); egg.rotation.z = (e - 1) * 0.3; nest.add(egg);
    }
    nest.traverse(function(m) { if (m.isMesh) m.castShadow = true; }); nest.userData.noBatch = true; c.group.add(nest);
    c.cyl({ x: nx, z: nz, r: 1.4, top: ng + 0.8, bottom: ng - 0.2, visual: false, kind: "nest", surf: "dirt" });
  }
  JUNGLE.flora(c, hole);
  JUNGLE.bombs(c, hole);
};

// ── dense jungle flora along the fairway: palms, giant ferns, cycads (instanced, swaying) ──
JUNGLE._col = function(g, hex) { var cc = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (var i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; };
// a drooping leaf: a strip bent downwards along its length, pointing +x from the origin
JUNGLE._frond = function(len, wid, droop, hex) {
  var g = new THREE.PlaneGeometry(len, wid, 6, 1); g.translate(len / 2, 0, 0); g.rotateX(-Math.PI / 2);
  var p = g.attributes.position;
  for (var i = 0; i < p.count; i++) { var x = p.getX(i), u = x / len; p.setY(i, p.getY(i) - droop * u * u * len); p.setZ(i, p.getZ(i) * (1 - u * 0.75)); }
  g.computeVertexNormals();
  return JUNGLE._col(g.toNonIndexed(), hex);
};
JUNGLE._geos = function() {
  if (JUNGLE._G) return JUNGLE._G;
  var parts, i;
  // palm: a gently curved trunk + a crown of drooping fronds
  parts = [];
  for (i = 0; i < 6; i++) { var cyl = new THREE.CylinderGeometry(0.2 - i * 0.012, 0.24 - i * 0.012, 1.25, 7); cyl.translate(i * i * 0.025, 0.62 + i * 1.18, 0); parts.push(JUNGLE._col(cyl.toNonIndexed(), i % 2 ? 0x7a5a36 : 0x8a6a40)); }
  for (i = 0; i < 8; i++) { var f = JUNGLE._frond(3.4, 0.9, 0.42, i % 2 ? 0x2f8a2a : 0x3fa034); f.rotateZ(0.25); f.rotateY(i / 8 * Math.PI * 2); f.translate(0.9, 7.2, 0); parts.push(f); }
  for (i = 0; i < 3; i++) { var nut = new THREE.SphereGeometry(0.17, 6, 5); nut.translate(0.9 + Math.cos(i * 2.1) * 0.25, 6.95, Math.sin(i * 2.1) * 0.25); parts.push(JUNGLE._col(nut.toNonIndexed(), 0x5a3a1a)); }
  var palm = GFX.mergeGeometries(parts);
  // giant fern: big fronds arching out of the ground
  parts = [];
  for (i = 0; i < 9; i++) { var ff = JUNGLE._frond(2.8, 0.8, 0.5, [0x2a7a24, 0x3a9a2e, 0x4aa83a][i % 3]); ff.rotateZ(0.9 - (i % 3) * 0.15); ff.rotateY(i / 9 * Math.PI * 2 + (i % 2) * 0.2); ff.translate(0, 0.15, 0); parts.push(ff); }
  var fern = GFX.mergeGeometries(parts);
  // cycad: a stubby scaly trunk with a stiff crown
  parts = [];
  var tr = new THREE.CylinderGeometry(0.38, 0.5, 1.7, 8); tr.translate(0, 0.85, 0); parts.push(JUNGLE._col(tr.toNonIndexed(), 0x6a5034));
  for (i = 0; i < 10; i++) { var cf = JUNGLE._frond(1.9, 0.55, 0.12, i % 2 ? 0x3a8a2a : 0x2a6a20); cf.rotateZ(0.55); cf.rotateY(i / 10 * Math.PI * 2); cf.translate(0, 1.7, 0); parts.push(cf); }
  var cycad = GFX.mergeGeometries(parts);
  [palm, fern, cycad].forEach(function(g) { g.userData.shared = true; });
  return (JUNGLE._G = { palm: palm, fern: fern, cycad: cycad });
};
// Plant GLBs (Quaternius palms + fern) baked into one geometry each for the instanced meshes:
// trunk base at the origin, sized like the hand-built ones, wind sway kept
JUNGLE.PLANT = { palm: ["jungle_palm_a", 8.4, 0.35, 7.5], palm2: ["jungle_palm_b", 8.0, 0.35, 7.5], fern: ["jungle_fern", 1.9, 0.12, 2.4] };
JUNGLE._pc = {};
JUNGLE._plant = function(kind, cb) {
  var E = JUNGLE.PLANT[kind]; if (!E || typeof loadModel !== "function" || !MODEL_OVERRIDES[E[0]]) return;
  var P = JUNGLE._pc[kind];
  if (P) { if (P.geo) cb(P); else P.wait.push(cb); return; }
  P = JUNGLE._pc[kind] = { wait: [cb] };
  loadModel(E[0], function(m) {
    if (!m) return;
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.updateMatrixWorld(true);
    var geos = [], mat = null;
    m.traverse(function(o) {
      if (!o.isMesh) return;
      // plain Float32 copies: the squeezed files keep normals as interleaved, normalised Int8 (octahedral
      // filter), which GFX.mergeGeometries would copy raw — garbage normals, pitch-black leaves
      var src = o.geometry, gg = new THREE.BufferGeometry();
      ["position", "normal", "uv"].forEach(function(a) {
        var A = src.attributes[a]; if (!A) return;
        var n = A.count, k = A.itemSize, arr = new Float32Array(n * k), get = [A.getX, A.getY, A.getZ, A.getW];
        for (var i = 0; i < n; i++) for (var c = 0; c < k; c++) arr[i * k + c] = get[c].call(A, i);
        gg.setAttribute(a, new THREE.BufferAttribute(arr, k));
      });
      if (src.index) gg.setIndex(src.index.clone());
      gg.applyMatrix4(o.matrixWorld);
      if (gg.attributes.normal) gg.normalizeNormals(); else gg.computeVertexNormals();
      geos.push(gg); mat = mat || (Array.isArray(o.material) ? o.material[0] : o.material);
    });
    if (!geos.length) return;
    var geo = GFX.mergeGeometries(geos); geo.computeBoundingBox();
    var bb = geo.boundingBox, pos = geo.attributes.position, lowY = bb.min.y + (bb.max.y - bb.min.y) * 0.04, bx = 0, bz = 0, nb = 0;
    for (var i = 0; i < pos.count; i++) if (pos.getY(i) < lowY) { bx += pos.getX(i); bz += pos.getZ(i); nb++; }
    if (nb) { bx /= nb; bz /= nb; } else { bx = (bb.min.x + bb.max.x) / 2; bz = (bb.min.z + bb.max.z) / 2; }
    var sc = E[1] / Math.max(0.01, bb.max.y - bb.min.y);
    geo.translate(-bx, -bb.min.y, -bz); geo.scale(sc, sc, sc); geo.computeBoundingSphere(); geo.userData.shared = true;
    var M = mat.clone(); M.side = THREE.DoubleSide; M.vertexColors = false; if (M.map && M.transparent) { M.transparent = false; M.alphaTest = 0.45; }
    if ("metalness" in M) { M.metalness = 0; M.roughness = 0.85; }   // glTF defaults to fully metallic: pitch black without an env map
    M.color.setRGB(0.82, 0.86, 0.8);   // a touch deeper than the bright source atlas, to sit with the jungle palette
    GFX.addSway(M, E[2], E[3]);
    P.geo = geo; P.mat = M;
    P.wait.forEach(function(f) { f(P); }); P.wait = [];
  });
};
JUNGLE.flora = function(c, hole) {
  var G = JUNGLE._geos(), rnd = _gfxRng(((hole.n || 1) * 5003 + 7) >>> 0), R = c.route, W = c.hazard.level, fw = (LV.HL.jungle.fw || 9);
  var lists = { palm: [], palm2: [], fern: [], cycad: [] };
  var len = LV._polyLen(R), steps = Math.round(len / 1.1);
  for (var s = 0; s <= steps; s++) {
    var p = LV.pointAt(R, s / steps);
    for (var side = -1; side <= 1; side += 2) {
      var tries = 2;
      while (tries--) {
        var off = fw + 1.2 + Math.pow(rnd(), 1.4) * 22, x = p.x - p.dz * off * side + (rnd() - 0.5) * 2, z = p.z + p.dx * off * side + (rnd() - 0.5) * 2;
        var g = c.heightAt(x, z); if (g < W + 0.35) continue;
        if (Math.hypot(x - c.tee.x, z - c.tee.z) < 7 || Math.hypot(x - c.basket.x, z - c.basket.z) < 7) continue;
        var r = rnd(), kind = r < 0.11 ? "palm" : r < 0.22 ? "palm2" : r < 0.8 ? "fern" : "cycad";
        lists[kind].push({ x: x, y: g - 0.05, z: z, s: kind === "palm" || kind === "palm2" ? 0.85 + rnd() * 0.5 : 0.7 + rnd() * 0.8, a: rnd() * 6.28, lean: (rnd() - 0.5) * 0.25 });
      }
    }
  }
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
  Object.keys(lists).forEach(function(k) {
    var L = lists[k]; if (!L.length) return;
    var tall = k === "palm" || k === "palm2", mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    GFX.addSway(mat, tall ? 0.35 : 0.12, tall ? 7.5 : 2.4);
    var im = new THREE.InstancedMesh(G[tall ? "palm" : k], mat, L.length);
    JUNGLE._plant(k, function(P) { im.geometry = P.geo; im.material = P.mat; });   // real palms / ferns as soon as they've loaded
    L.forEach(function(o, i) { e.set(o.lean, o.a, o.lean * 0.5); q.setFromEuler(e); sc.setScalar(o.s); m4.compose(new THREE.Vector3(o.x, o.y, o.z), q, sc); im.setMatrixAt(i, m4); });
    im.castShadow = k !== "fern"; im.receiveShadow = true; im.userData.noBatch = true; c.group.add(im);
  });
  // palm trunks near the fairway are solid: discs thwock off them
  lists.palm.concat(lists.palm2).forEach(function(o) { if (LV.polyDist(R, o.x, o.z).d < fw + 8) c.cyl({ x: o.x, z: o.z, r: 0.3 * o.s, top: o.y + 7 * o.s, bottom: o.y - 0.3, visual: false, kind: "tree", surf: "wood" }); });
};

// ── the volcano on the horizon (world.js landmarks) ──────────────────────────
JUNGLE.volcano = function(ctx) {
  var C = ctx.C, dx = C.basket.x - C.tee.x, dz = C.basket.z - C.tee.z, dl = Math.hypot(dx, dz) || 1;
  var vx = C.basket.x + dx / dl * 340 + (ctx.rnd() - 0.5) * 140, vz = C.basket.z + dz / dl * 340;
  var s = { x: vx, z: vz, y: ctx.H(vx, vz) }; if (!(s.y > -50)) s.y = ctx.W;
  var g = new THREE.Group(); g.position.set(s.x, s.y - 4, s.z);
  var rock = new THREE.MeshStandardMaterial({ color: 0x3a2e2a, roughness: 0.95, flatShading: true });
  var geo = new THREE.CylinderGeometry(16, 120, 130, 28, 6, true), pos = geo.attributes.position;
  for (var i = 0; i < pos.count; i++) { var y = pos.getY(i), k = 1 + (Math.sin(i * 12.9898) * 0.5) * 0.12 * (1 - (y + 65) / 130 * 0.5); pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
  geo.computeVertexNormals();
  var cone = new THREE.Mesh(geo, rock); cone.position.y = 65; g.add(cone);
  var lava = new THREE.Mesh(new THREE.CircleGeometry(15.5, 24), new THREE.MeshBasicMaterial({ color: 0xff6a1a, fog: false })); lava.rotation.x = -Math.PI / 2; lava.position.y = 128; g.add(lava);
  var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GFX.softDotTexture(), color: 0xff7a2a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  glow.scale.set(90, 60, 1); glow.position.y = 132; g.add(glow);
  // lava streaks running down one side
  for (var l = 0; l < 3; l++) {
    var st = new THREE.Mesh(new THREE.PlaneGeometry(4, 70), new THREE.MeshBasicMaterial({ color: 0xff5a10, transparent: true, opacity: 0.85, fog: false, side: THREE.DoubleSide }));
    var a = l * 0.5 - 0.5; st.position.set(Math.sin(a) * 42, 94, Math.cos(a) * 42); st.lookAt(0, 94, 0); st.rotateX(-0.85); g.add(st);
  }
  // a fat smoke plume
  var smk = new THREE.SpriteMaterial({ map: GFX.softDotTexture(), color: 0x5a5250, transparent: true, opacity: 0.55, depthWrite: false });
  var puffs = [];
  for (var p = 0; p < 9; p++) { var sp = new THREE.Sprite(smk); sp.scale.setScalar(40 + p * 9); g.add(sp); puffs.push(sp); }
  g.lookAt(ctx.cx, s.y, ctx.cz);
  ctx.g.add(g);
  WORLD.anim.push(function(T) {
    puffs.forEach(function(sp, i) { var k = ((T * 0.03 + i / puffs.length) % 1); sp.position.set(Math.sin(T * 0.1 + i) * 10 * k, 135 + k * 140, Math.cos(T * 0.13 + i) * 8 * k); sp.scale.setScalar(36 + k * 120); });
    glow.material.opacity = 0.65 + Math.sin(T * 2.3) * 0.15;
  });
  JUNGLE._vpos = new THREE.Vector3(s.x, s.y + 125, s.z);
};

// ── lava bombs: every ~26 s one lands somewhere along the course ─────────────
JUNGLE.P = 26; JUNGLE.FALL = 2.6;
JUNGLE.bombs = function(c, hole) {
  var seed = (hole.n || 1) * 7919 + (typeof matchSeed !== "undefined" ? matchSeed % 100000 : 0);
  var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: 0x2a1a14, emissive: new THREE.Color(0xff4a10), emissiveIntensity: 1.6, roughness: 0.8, flatShading: true }));
  rock.visible = false; rock.userData.noBatch = true; c.group.add(rock);
  var ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: 0xff3a1a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 6; ring.userData.noBatch = true; c.group.add(ring);
  var light = new THREE.PointLight(0xff6a2a, 0, 16); c.group.add(light);
  var last = -1, rumbled = -1, warned = false, fx = 0;
  var spotFor = function(k) {   // same answer on every client for the same eruption
    var h = Math.abs(Math.sin(k * 127.1 + seed * 0.0131) * 43758.5453) % 1, h2 = Math.abs(Math.sin(k * 311.7 + seed * 0.071) * 24634.6345) % 1;
    var p = LV.pointAt(c.route, 0.12 + h * 0.8), off = (h2 - 0.5) * 12;
    var x = p.x - p.dz * off, z = p.z + p.dx * off;
    return { x: x, z: z, y: c.heightAt(x, z) };
  };
  c.updaters.push(function(Tl) {
    if (Tl < 14) return;                                   // a moment to settle in first
    var Tn = typeof netTime === "function" ? netTime() : Tl;   // the shared match clock: every screen erupts together
    var k = Math.floor(Tn / JUNGLE.P), ph = Tn - k * JUNGLE.P, hit = JUNGLE.P - 3, t0 = hit - JUNGLE.FALL;
    var S = spotFor(k);
    if (ph > t0 - 1.2 && rumbled !== k) {                  // the volcano clears its throat
      rumbled = k; AudioEngine.sfx("boom", 0.5);
      if (typeof CINE !== "undefined") CINE.shake(0.18, 0.8);
      if (!warned) { warned = true; if (typeof _flashPrompt === "function") _flashPrompt("🌋 The volcano is erupting — watch for the red rings!"); }
    }
    if (ph > t0 && ph < hit) {
      var u = (ph - t0) / JUNGLE.FALL, V = JUNGLE._vpos || new THREE.Vector3(S.x + 60, S.y + 120, S.z - 60);
      ring.visible = rock.visible = true;
      ring.position.set(S.x, S.y + 0.08, S.z); ring.scale.setScalar(1 + u * 4.5); ring.material.opacity = 0.35 + u * 0.55;
      var arc = Math.sin(u * Math.PI) * 25;
      rock.position.set(V.x + (S.x - V.x) * u, V.y + (S.y - V.y) * u + arc, V.z + (S.z - V.z) * u); rock.rotation.x += 0.2; rock.rotation.z += 0.13;
      light.position.copy(rock.position); light.intensity = 2;
      if ((fx += 1) % 2 === 0 && typeof spawnSkinParticle === "function") spawnSkinParticle("fire", rock.position.clone());
    } else { ring.visible = rock.visible = false; light.intensity = 0; }
    if (ph >= hit && last !== k) {
      last = k;
      var P3 = new THREE.Vector3(S.x, S.y + 0.4, S.z);
      if (typeof spawnExplosion === "function") spawnExplosion(P3.clone());
      if (typeof GAD !== "undefined") { GAD.ring(P3, 0xff6a2a, 10); GAD._debris(P3); GAD._blastDiscs(P3, 6); GAD.blast(P3, 4, false); }
      AudioEngine.sfx("kaboom", 1, P3);
      if (typeof CINE !== "undefined") CINE.shake(0.8, 0.6, P3);
      if (typeof PU !== "undefined") { PU.blastMe(S.x, S.y + 0.8, S.z, 5.5, -1, "boom", 15); if (!mpMode || myIdx === 0) PU.critterBlast(S.x, S.z, 7, 13); }
      if (typeof AudioEngine.crowd === "function" && camera.position.distanceTo(P3) < 40) AudioEngine.crowd("gasp");
    }
  });
};

// ── dinosaurs (procedural, cartoon proportions) ──────────────────────────────
JUNGLE._m = function(c, o) { return ENT.mat(c, Object.assign({ roughness: 0.55 }, o || {})); };
// A biped: T-rex (scale 1) or raptor (small, slim, stripy, long arms)
ENT.M.biped = function(o) {
  var M = JUNGLE._m, skin = M(o.col), belly = M(o.belly), dark = M(o.dark), white = M(0xffffff, { roughness: 0.3 }), black = ENT.mat(0x111111, { roughness: 0.2 });
  var g = new THREE.Group(), rig = new THREE.Group(); g.add(rig);
  var sx = o.slim ? 0.8 : 1;
  var body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), skin); body.scale.set(1.05 * sx, 1, 1.55); body.position.y = 2.55; body.rotation.x = -0.3; rig.add(body);
  var bel = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), belly); bel.scale.set(0.95 * sx, 0.9, 1.2); bel.position.set(0, 2.35, 0.35); bel.rotation.x = -0.3; rig.add(bel);
  // tail (two segments so it can swish)
  var tail = new THREE.Group(); tail.position.set(0, 2.5, -1.2); rig.add(tail);
  var t1 = new THREE.Mesh(new THREE.ConeGeometry(0.75 * sx, 2.4, 12), skin); t1.rotation.x = -Math.PI / 2 - 0.18; t1.position.z = -1.1; tail.add(t1);
  var tail2 = new THREE.Group(); tail2.position.z = -2.2; tail.add(tail2);
  var t2 = new THREE.Mesh(new THREE.ConeGeometry(0.32 * sx, 1.8, 10), skin); t2.rotation.x = -Math.PI / 2; t2.position.z = -0.8; tail2.add(t2);
  // head on a neck pivot; the lower jaw opens to roar
  var head = new THREE.Group(); head.position.set(0, 3.55, 1.15); rig.add(head);
  var skull = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), skin); skull.scale.set(0.95 * sx, 0.78, 1.35); skull.position.set(0, 0.35, 0.45); head.add(skull);
  var jaw = new THREE.Group(); jaw.position.set(0, 0.05, 0.1); head.add(jaw);
  var jm = new THREE.Mesh(new THREE.SphereGeometry(0.65, 14, 10), belly); jm.scale.set(0.85 * sx, 0.38, 1.35); jm.position.set(0, -0.08, 0.55); jaw.add(jm);
  for (var tth = 0; tth < 6; tth++) { var tooth = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), white); var ta = (tth / 5 - 0.5) * 1.6; tooth.position.set(Math.sin(ta) * 0.55 * sx, 0.12, 0.6 + Math.cos(ta) * 0.62); tooth.rotation.x = Math.PI; head.add(tooth); }
  [-1, 1].forEach(function(s) {
    var eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), white); eye.position.set(s * 0.45 * sx, 0.72, 0.7); head.add(eye);
    var pup = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), black); pup.position.set(s * 0.5 * sx, 0.74, 0.88); head.add(pup);
    var brow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.12), dark); brow.position.set(s * 0.43 * sx, 0.98, 0.78); brow.rotation.z = s * 0.35; head.add(brow);
    var nost = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), black); nost.position.set(s * 0.18, 0.55, 1.6); head.add(nost);
  });
  // ridiculous little arms (raptors get proper grabby ones)
  var arms = [];
  [-1, 1].forEach(function(s) {
    var arm = new THREE.Group(); arm.position.set(s * 0.6 * sx, 2.85, 1.05); rig.add(arm);
    var a = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, o.armLen, 8), skin); a.position.y = -o.armLen / 2; a.rotation.x = 0.3; arm.add(a);
    var cl = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), white); cl.position.set(0, -o.armLen, 0.12); cl.rotation.x = Math.PI * 0.7; arm.add(cl);
    arm.rotation.x = -0.8; arms.push(arm);
  });
  // legs: thigh + shin + foot, swinging at the hip
  var legs = [];
  [-1, 1].forEach(function(s) {
    var leg = new THREE.Group(); leg.position.set(s * 0.62 * sx, 2.25, -0.1); rig.add(leg);
    var th = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), skin); th.scale.set(0.85 * sx, 1.3, 1); th.position.y = -0.4; leg.add(th);
    var sh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.4, 10), skin); sh.position.set(0, -1.35, -0.1); leg.add(sh);
    var ft = new THREE.Mesh(new THREE.BoxGeometry(0.55 * sx, 0.22, 0.95), dark); ft.position.set(0, -2.12, 0.18); leg.add(ft);
    legs.push(leg);
  });
  // back spikes / stripes
  for (var b = 0; b < 6; b++) { var sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 6), dark); sp.position.set(0, 3.45 - b * 0.14, 0.4 - b * 0.55); sp.rotation.x = -0.5; rig.add(sp); }
  if (o.stripes) for (var st = 0; st < 4; st++) { var bar = new THREE.Mesh(new THREE.TorusGeometry(0.95 * sx, 0.06, 6, 18, Math.PI), dark); bar.position.set(0, 2.6, -0.6 + st * 0.45); bar.rotation.y = Math.PI / 2; bar.rotation.z = Math.PI / 2; rig.add(bar); }
  g.traverse(function(m) { if (m.isMesh) m.castShadow = true; });
  g.scale.setScalar(o.scale || 1);
  g.userData.dino = { rig: rig, head: head, jaw: jaw, tail: tail, tail2: tail2, arms: arms, legs: legs };
  return g;
};
// The long-neck: a walking hill
ENT.M.longneck = function() {
  var M = JUNGLE._m, skin = M(0x5ab0a0), belly = M(0xc8e8c8), spot = M(0x3a8a7a), white = M(0xffffff, { roughness: 0.3 }), black = ENT.mat(0x111111);
  var g = new THREE.Group(), rig = new THREE.Group(); g.add(rig);
  var body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin); body.scale.set(2.3, 1.9, 3.6); body.position.y = 4.6; rig.add(body);
  var bel = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), belly); bel.scale.set(2.0, 1.4, 3.1); bel.position.y = 4.1; rig.add(bel);
  for (var s2 = 0; s2 < 7; s2++) { var sp = new THREE.Mesh(new THREE.SphereGeometry(0.45 + (s2 % 3) * 0.15, 10, 8), spot); var a = s2 * 1.3; sp.position.set(Math.cos(a) * 1.9, 5.4 + Math.sin(a * 1.7) * 0.6, Math.sin(a) * 2.6); sp.scale.y = 0.4; rig.add(sp); }
  // neck: a chain of pivots so it can sway
  var neck = new THREE.Group(); neck.position.set(0, 5.6, 3.0); rig.add(neck);
  var seg = neck, necks = [];
  for (var i = 0; i < 6; i++) {
    var piv = new THREE.Group(); piv.position.set(0, i === 0 ? 0 : 1.15, i === 0 ? 0 : 0.35); piv.rotation.x = -0.18; seg.add(piv);
    var m = new THREE.Mesh(new THREE.SphereGeometry(0.75 - i * 0.07, 12, 10), skin); m.scale.y = 1.5; m.position.y = 0.55; piv.add(m);
    seg = piv; necks.push(piv);
  }
  var head = new THREE.Group(); head.position.set(0, 1.3, 0.4); seg.add(head);
  var hm = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), skin); hm.scale.set(0.9, 0.75, 1.3); head.add(hm);
  [-1, 1].forEach(function(s) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), white); e.position.set(s * 0.45, 0.25, 0.45); head.add(e); var p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), black); p.position.set(s * 0.5, 0.27, 0.6); head.add(p); });
  var smile = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 14, Math.PI), black); smile.rotation.z = Math.PI; smile.position.set(0, -0.15, 0.9); head.add(smile);
  var tail = new THREE.Group(); tail.position.set(0, 4.6, -3.4); rig.add(tail);
  var tm = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6.5, 14), skin); tm.rotation.x = -Math.PI / 2 - 0.25; tm.position.set(0, -0.6, -3.1); tail.add(tm);
  var legs = [];
  [[1.5, 2.0], [-1.5, 2.0], [1.5, -2.0], [-1.5, -2.0]].forEach(function(q) {
    var leg = new THREE.Group(); leg.position.set(q[0], 3.6, q[1]); rig.add(leg);
    var l = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 3.6, 12), skin); l.position.y = -1.8; leg.add(l);
    var ft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.35, 12), spot); ft.position.y = -3.5; leg.add(ft);
    legs.push(leg);
  });
  g.traverse(function(m) { if (m.isMesh) m.castShadow = true; });
  g.userData.dino = { rig: rig, head: head, necks: necks, tail: tail, legs: legs, quad: true };
  return g;
};

// ── the real dinosaurs (Quaternius' animated pack, CC0) ── the hand-built ones above only stand in
// while the GLB loads (or if it can't). Flat-coloured models, so each species gets a cartoon palette.
JUNGLE.DINO = {
  trex:   { key: "dino_trex",   h: 4.7, pal: { LightGreen: 0x6ab83a, Green: 0x2f7a2a, LightYellow: 0xf0dc96, Red: 0xc8343a } },
  raptor: { key: "dino_raptor", h: 1.9, pal: { LightBrown: 0xffc060, Brown: 0xe8742a } },
  apato:  { key: "dino_apato",  h: 6.0, pal: { Material: 0x6ac4b0, Brown: 0x3a8a7a } },
  trike:  { key: "dino_trike",  h: 2.5, pal: { LightBrown: 0xe8b46a, Purple: 0x7a5aa8, Brown: 0xb07a3a } },
  stego:  { key: "dino_stego",  h: 3.3, pal: { LightBrown: 0x9ac85a, DarkBrown: 0x4a7a2a, Brown: 0xff8a3a } },
  para:   { key: "dino_para",   h: 3.6, pal: { LightYellow: 0xf2e6a8, Green: 0x3a7ab8, LightGreen: 0x7ab8e8, Red: 0xff5a3a } },
};
JUNGLE.dino = function(kind, fallback) {
  var D = JUNGLE.DINO[kind];
  return ENT.glb(D.key, D.h, fallback, function(g, m) {
    m.traverse(function(o) {
      if (!o.isMesh) return;
      o.castShadow = true;
      var tint = function(mt) { var c = mt.clone(), hx = D.pal[mt.name]; if (hx !== undefined) c.color.setHex(hx).convertSRGBToLinear(); if ("roughness" in c) { c.roughness = 0.65; c.metalness = 0; } return c; };
      o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material);
    });
  });
};
// the roar: sound, shake, comic text (both the clip and the hand-built jaw use it)
JUNGLE._roar = function(o) {
  var roar = (o.fuse || 0) > 0;   // the host streams the roar timer in the "fuse" slot
  if (roar && !o._roared) { o._roared = true; AudioEngine.sfx("roar", o.type === "raptor" ? 0.45 : 1, new THREE.Vector3(o.x, o.y + 3, o.z)); if (o.type === "trex" && typeof CINE !== "undefined") CINE.shake(0.35, 0.8, new THREE.Vector3(o.x, o.y, o.z)); if (typeof _spawnBonkText === "function" && camera.position.distanceTo(o.mesh.position) < 40) _spawnBonkText(new THREE.Vector3(o.x, o.y + (o.type === "raptor" ? 2 : 5.5), o.z), "ROAAAR!"); }
  if (!roar) o._roared = false;
  return roar;
};
// Every client: walk cycle, tail swish, head bob, roaring jaw — from how it actually moves
JUNGLE.animate = function(o, dt) {
  var sp = o._jx === undefined ? 0 : Math.hypot(o.x - o._jx, o.z - o._jz) / Math.max(dt, 1e-3); o._jx = o.x; o._jz = o.z;
  o._js = (o._js || 0) + (Math.min(sp, 12) - (o._js || 0)) * Math.min(1, dt * 6);
  var g = o.mesh;
  if (g.userData.clipActions) {   // the real thing: pick the clip from the speed, roar = attack
    var s0 = o._js, roar0 = JUNGLE._roar(o), fast = o.type === "raptor" ? 3.2 : o.type === "trex" ? 3.0 : 2.4;
    var want = roar0 ? ["Attack"] : s0 > fast ? ["Run"] : s0 > 0.25 ? ["Walk"] : ["Idle"];
    ENT.play(o, want);
    var act = g.userData.clipActions[g.userData.activeClipName];
    if (act) act.timeScale = want[0] === "Walk" ? Math.max(0.6, Math.min(2, s0 / (o.type === "raptor" ? 1.6 : 1.3))) : want[0] === "Run" ? Math.max(0.8, Math.min(1.8, s0 / (o.type === "raptor" ? 6 : 6.5))) : 1;
    return;
  }
  var D = g.userData.dino; if (!D) return;
  var s = o._js, rate = D.quad ? 1.3 : (o.type === "raptor" ? 3.4 : 1.8);
  o._jt = (o._jt || 0) + dt * (1 + s * rate);
  var w = s > 0.15 ? Math.sin(o._jt * 2) : 0, amp = Math.min(1, s / (D.quad ? 1.5 : 4));
  if (D.quad) { D.legs.forEach(function(l, i) { l.rotation.x = Math.sin(o._jt * 2 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.3 * amp; }); D.necks.forEach(function(n, i) { n.rotation.z = Math.sin(o._jt * 0.6 - i * 0.4) * 0.05; }); D.tail.rotation.y = Math.sin(o._jt * 0.9) * 0.25; D.rig.position.y = Math.abs(w) * 0.12; return; }
  D.legs[0].rotation.x = w * 0.75 * amp; D.legs[1].rotation.x = -w * 0.75 * amp;
  D.rig.position.y = Math.abs(w) * 0.18 * amp; D.rig.rotation.z = w * 0.06 * amp;
  D.tail.rotation.y = Math.sin(o._jt * 1.3) * (0.25 + amp * 0.2); D.tail2.rotation.y = Math.sin(o._jt * 1.3 - 0.8) * 0.4;
  D.arms.forEach(function(a, i) { a.rotation.x = -0.8 + Math.sin(o._jt * 4 + i * 3) * 0.35 * (0.4 + amp); });
  var roar = JUNGLE._roar(o);
  D.jaw.rotation.x = roar ? 0.65 + Math.sin(T * 40) * 0.08 : 0.06 + Math.max(0, Math.sin(o._jt * 0.7)) * 0.08;
  D.head.rotation.x = roar ? -0.45 : Math.sin(o._jt * 2) * 0.06 * amp;
  D.head.rotation.y = roar ? Math.sin(T * 25) * 0.12 : 0;
};

// T-rex: wander → spot someone → ROAR → charge → cool down
ENT.B.trex = function(o, dt) {
  o.cool -= dt; var tg = ENT.target(o);
  if (o.fuse > 0) {   // roaring (standing still)
    o.fuse -= dt; ENT.face(o, tg.x - o.x, tg.z - o.z, dt, 4);
    if (o.fuse <= 0) { o.fuse = 0; o.charge = 2.6; o.cx = tg.x; o.cz = tg.z; }
    return;
  }
  if (o.charge > 0) {
    o.charge -= dt;
    var dx = o.cx - o.x, dz = o.cz - o.z, d = Math.hypot(dx, dz) || 1, sp = 7.2 * dt;
    if (d < 1.2 || !ENT.step(o, dx / d * sp, dz / d * sp, 1.2) || Math.hypot(o.x - o.home.x, o.z - o.home.z) > o.home.R + 12) o.charge = 0;
    ENT.face(o, dx, dz, dt, 6); o.knockNow = true; o.moving = true;
    if (o.charge <= 0) o.cool = 6 + Math.random() * 3;
    return;
  }
  o.knockNow = false;
  if (tg.d < 15 && o.cool <= 0 && phase !== "MENU") { o.fuse = 1.3; return; }
  ENT.B.wander(o, dt);
};
// Raptors: dart about, chase whoever's close, nip, and steal discs
ENT.B.raptor = function(o, dt) {
  if (o.state === "carry" || o.state === "steal") return ENT.B.thief(o, dt);
  o.cool -= dt; o.nipCD -= dt; if (o.fuse > 0) o.fuse -= dt;
  var tg = ENT.target(o);
  if (tg.d < 9 && o.cool <= 0) {
    var dx = tg.x - o.x, dz = tg.z - o.z, d = Math.hypot(dx, dz) || 1, sp = 5.4 * dt;
    if (d > 0.9 && ENT.step(o, dx / d * sp, dz / d * sp, 0.8)) ENT.face(o, dx, dz, dt, 10);
    o.chaseT = (o.chaseT || 0) + dt;
    if (d < 1.2 && o.nipCD <= 0) { o.nipCD = 1.2; o.fuse = 0.5; if (tg.local && phase === "WALKING") { PL.knock(dx / d, dz / d, 5.5, 3.5); AudioEngine.sfx("bonk", 0.6); } }
    if (o.chaseT > 4) { o.chaseT = 0; o.cool = 5; }
    return;
  }
  ENT.B.wander(o, dt);
};
ENT.jungle = function(c, zones, idx, dens, spot) {
  if (!zones.length) return;
  var Z = function() { return zones[Math.floor(srng() * zones.length)]; };
  // one T-rex (from the second hole on — the first is for settling in)
  if (idx >= 1) { var z = Z(), p = spot(z, 12); if (p) ENT.add({ type: "trex", mesh: JUNGLE.dino("trex", ENT.M.biped({ col: 0x5aae3a, belly: 0xd8e8a0, dark: 0x3a7a28, armLen: 0.45 })), x: p.x, z: p.z, y: p.y, r: 1.5, h: 4.4, speed: 1.4, update: ENT.B.trex, animFn: JUNGLE.animate, home: { x: z.x, z: z.z, R: z.r + 10 }, leash: true, cool: 3, fuse: 0, charge: 0, knock: 12, knockUp: 8, maxStep: 1.2 }); }
  // a pack of raptors
  var n = Math.round((2 + Math.min(2, idx * 0.3)) * dens), z2 = Z();
  for (var i = 0; i < n; i++) { var q = spot(z2, 6); if (!q) continue; ENT.add({ type: "raptor", mesh: JUNGLE.dino("raptor", ENT.M.biped({ col: 0xff9a3a, belly: 0xffe0a0, dark: 0x8a3a1a, armLen: 0.9, slim: true, stripes: true, scale: 0.42 })), x: q.x, z: q.z, y: q.y, r: 0.45, h: 1.7, speed: 2.2, update: ENT.B.raptor, animFn: JUNGLE.animate, home: { x: z2.x, z: z2.z, R: z2.r + 8 }, leash: true, canSteal: true, cool: 2 + i, nipCD: 0, fuse: 0, flee: 0 }); }
  // the long-neck plods across the fairway
  ENT.routeLanes(c, 1, function(lane) { ENT.add({ type: "longneck", mesh: JUNGLE.dino("apato", ENT.M.longneck()), x: lane.x0, z: lane.z0, r: 2.6, h: 6.2, speed: 1.1, update: ENT.B.lane, animFn: JUNGLE.animate, lane: lane, polite: false, knock: 9, knockUp: 6 }); });
  // grazers: triceratops, stegosaurus, parasaurolophus — they mind their own business, but they're big
  var HERB = [["trike", 1.0, 2.4, 0.9], ["stego", 1.2, 3.2, 0.8], ["para", 0.9, 3.4, 1.1]];
  var nh = Math.round((1 + Math.min(2, idx * 0.3)) * dens);
  for (var j = 0; j < nh; j++) {
    var hz = Z(), hp = spot(hz, 8), H = HERB[Math.floor(srng() * HERB.length)]; if (!hp) continue;
    ENT.add({ type: "grazer", mesh: JUNGLE.dino(H[0], null), x: hp.x, z: hp.z, y: hp.y, r: H[1], h: H[2], speed: H[3], update: ENT.B.wander, home: { x: hz.x, z: hz.z, R: hz.r + 6 }, leash: true, maxStep: 1.0, knock: 7, knockUp: 4,
      clips: { walk: ["Walk"], run: ["Run"], idle: ["Idle"] } });
  }
};
