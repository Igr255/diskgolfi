"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── CITY: streets, sidewalks, buildings, rooftops and traffic ────────────────
// ══════════════════════════════════════════════════════════════════════════════
LV.city = function(c, hole, idx, d, spawns) {
  hole.templateLabel = LV.pick(["Downtown", "Midtown", "Old town", "Main street"]);
  var C = 40, B = 26, H = C / 2;                 // grid pitch, block size, half pitch (street centre)
  c.hazard = { type: "none", level: -1, base: -1 };
  c.floor = 0;
  c.surf = "concrete";
  var rows = 2 + Math.min(3, Math.floor(idx / 3)), turn = srng() < 0.5 ? -1 : 1, turnRow = 1 + Math.floor(srng() * Math.max(1, rows - 1));
  // Route along street centre lines (x = ±H), optionally jogging one block over
  var x0 = H * (srng() < 0.5 ? -1 : 1), pts = [{ x: x0, z: 8 }];
  pts.push({ x: x0, z: -turnRow * C + H });
  var x1 = x0 + (idx % 2 ? turn * C : 0);
  pts.push({ x: x1, z: -turnRow * C + H });
  pts.push({ x: x1, z: -rows * C + H });
  var minX = -3 * C, maxX = 3 * C, minZ = -(rows + 2) * C, maxZ = 2 * C;
  c.bounds = { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ };
  var night = true;

  // Ground: asphalt with lane markings
  var gW = maxX - minX, gD = maxZ - minZ;
  var road = new THREE.Mesh(new THREE.PlaneGeometry(gW, gD), CM.get("asphalt"));
  road.rotation.x = -Math.PI / 2; road.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2); road.receiveShadow = true;
  _uvScale(road.geometry, gW / 6, gD / 6);
  c.group.add(road);
  LV.laneMarkings(c, minX, maxX, minZ, maxZ, C, H);

  // Blocks
  var basketOnRoof = idx % 3 === 2;
  var endX = x1 + (srng() < 0.5 ? -H : H), endZ = -rows * C + H - H;   // block beside the final street segment
  var endBlock = { i: Math.round(endX / C), j: Math.round(-endZ / C) };
  function nearRoute(bx, bz) { return LV.polyDist(pts, bx, bz).d < H + B / 2 + 1; }
  for (var i = Math.round(minX / C); i <= Math.round(maxX / C); i++) for (var j = Math.round(-maxZ / C); j <= Math.round(-minZ / C); j++) {
    var bx = i * C, bz = -j * C;
    if (bx - B / 2 < minX || bx + B / 2 > maxX || bz - B / 2 < minZ || bz + B / 2 > maxZ) continue;
    var isEnd = i === endBlock.i && j === endBlock.j;
    var park = (isEnd && !basketOnRoof) || (!nearRoute(bx, bz) && srng() < 0.15);
    // Lot (sidewalk / plaza) with a curb
    c.box({ x: bx, z: bz, w: B, d: B, top: 0.18, bottom: -0.2, mat: [CM.get("concrete", 0x9a9890), park ? CM.get("grass", 0x5a9a3a) : CM.get("sidewalk")], kind: "ground", surf: park ? "grass" : "concrete", cast: false, rep: 3 });
    if (park) { LV.cityPark(c, bx, bz, B, isEnd, spawns); if (isEnd) c.basket = { x: bx, y: 0.18, z: bz }; continue; }
    LV.cityBuildings(c, bx, bz, B, nearRoute(bx, bz), isEnd && basketOnRoof, night, d, spawns);
  }
  // Tee on the first street, basket on its block
  LV.tee(c, pts[0].x, 0, pts[0].z, pts[1]);
  if (!c.basket || (c.basket.x === 0 && c.basket.z === -50)) c.basket = { x: endBlock.i * C, y: 0.18, z: -endBlock.j * C };
  pts.push({ x: c.basket.x, z: c.basket.z });
  c.route = pts.map(function(p) { return { x: p.x, y: c.heightAt(p.x, p.z), z: p.z }; });
  // Traffic on the streets
  for (var sx = Math.round(minX / C); sx < Math.round(maxX / C); sx++) spawns.push({ kind: "traffic", axis: "z", x: sx * C + H, from: minZ + 5, to: maxZ - 5 });
  for (var sz = Math.round(-maxZ / C); sz < Math.round(-minZ / C); sz++) spawns.push({ kind: "traffic", axis: "x", z: -sz * C - H, from: minX + 5, to: maxX - 5 });
  spawns.push({ kind: "sidewalks", pts: pts, C: C, H: H });
  c.backdrop = true;
};

function _uvScale(geo, su, sv) { var uv = geo.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }

LV.laneMarkings = function(c, minX, maxX, minZ, maxZ, C, H) {
  var dashM = new THREE.MeshBasicMaterial({ color: 0xe8e2c8 }), geos = [];
  for (var x = Math.ceil((minX - H) / C) * C + H; x < maxX; x += C) for (var z = minZ; z < maxZ; z += 6) {
    if (Math.abs(((z - H) % C + C) % C - C / 2) > C / 2 - 9) continue;   // skip intersections
    var g = new THREE.PlaneGeometry(0.22, 3); g.rotateX(-Math.PI / 2); g.translate(x, 0.02, z); geos.push(g);
  }
  for (var z2 = Math.ceil((minZ - H) / C) * C - H; z2 < maxZ; z2 += C) for (var x2 = minX; x2 < maxX; x2 += 6) {
    if (Math.abs(((x2 - H) % C + C) % C - C / 2) > C / 2 - 9) continue;
    var g2 = new THREE.PlaneGeometry(3, 0.22); g2.rotateX(-Math.PI / 2); g2.translate(x2, 0.02, z2); geos.push(g2);
  }
  // zebra crossings at intersections
  for (var ix = Math.ceil((minX - H) / C) * C + H; ix < maxX; ix += C) for (var iz = Math.ceil((minZ - H) / C) * C - H; iz < maxZ; iz += C) {
    for (var s = -4; s <= 4; s++) {
      [[ix + s * 1.1, iz + 9.5, 0.6, 3], [ix + s * 1.1, iz - 9.5, 0.6, 3], [ix + 9.5, iz + s * 1.1, 3, 0.6], [ix - 9.5, iz + s * 1.1, 3, 0.6]].forEach(function(r) {
        var g3 = new THREE.PlaneGeometry(r[2], r[3]); g3.rotateX(-Math.PI / 2); g3.translate(r[0], 0.021, r[1]); geos.push(g3);
      });
    }
  }
  if (geos.length) { var m = new THREE.Mesh(GFX.mergeGeometries(geos), dashM); m.userData.noBatch = true; c.group.add(m); }
};

LV.cityBuildings = function(c, bx, bz, B, nearRoute, basketRoof, night, d, spawns) {
  var inset = 2.6, w = B - inset * 2;
  var split = srng() < 0.55, parts = split ? (srng() < 0.5 ? [[-w / 4, 0, w / 2 - 0.4, w], [w / 4, 0, w / 2 - 0.4, w]] : [[0, -w / 4, w, w / 2 - 0.4], [0, w / 4, w, w / 2 - 0.4]]) : [[0, 0, w, w]];
  var palette = [0x8a92a0, 0x9a8a7a, 0x6a7a8a, 0xb0a490, 0x7a6a6a, 0x5a6a7a];
  parts.forEach(function(p, pi) {
    var low = nearRoute && srng() < 0.6;
    var h = basketRoof && pi === 0 ? 7.5 : low ? 4 + Math.floor(srng() * 4) * 1.5 : 12 + srng() * 28;
    var col = LV.pick(palette);
    var mat = CM.get("building", col, { night: night });
    var roof = CM.get("concrete", 0x6a6a6a);
    var x = bx + p[0], z = bz + p[1];
    c.box({ x: x, z: z, w: p[2], d: p[3], top: 0.18 + h, bottom: 0.18, mats: [mat, roof, roof], kind: "wall", surf: "concrete", rep: 4 });
    // Rooftop details: parapet trim, AC units, water tanks, neon signs
    var trim = CM.get("concrete", 0x4a4a4e);
    c.box({ x: x, z: z, w: p[2] + 0.3, d: p[3] + 0.3, top: 0.18 + h + 0.25, bottom: 0.18 + h - 0.15, mat: trim, visual: true, kind: "ground", cast: false });
    if (h < 14) {
      for (var a = 0; a < 2; a++) c.box({ x: x + (srng() - 0.5) * (p[2] - 4), z: z + (srng() - 0.5) * (p[3] - 4), w: 1.6, d: 1.2, top: 0.18 + h + 1.1, bottom: 0.18 + h, mat: CM.get("metal", 0xb0b4b8), kind: "platform" });
    }
    if (night && srng() < 0.45) LV.neonSign(c, x, z, p[2], p[3], 0.18 + Math.min(h - 1, 4 + srng() * (h - 5)));
    // Fire-escape stairs on low buildings next to the route (rooftop access)
    if ((low || (basketRoof && pi === 0)) && h < 12) {
      var side = srng() < 0.5 ? -1 : 1, sx = x + side * (p[2] / 2 + 1.3);
      c.stairs(sx, z + p[3] / 2 - 1, 0.18, sx, z - p[3] / 2 + 3, 0.18 + h, 2.2, CM.get("metal", 0x3a3a40), { bottom: 0.18 });
      c.box({ x: sx, z: z - p[3] / 2 + 1.6, w: 2.2, d: 2.8, top: 0.18 + h, bottom: 0.18 + h - 0.2, mat: CM.get("metal", 0x3a3a40), kind: "platform" });
    }
    if (basketRoof && pi === 0) c.basket = { x: x, y: 0.18 + h + 0.25, z: z };
  });
  // Street furniture on the sidewalk
  for (var k = 0; k < 4; k++) {
    if (!nearRoute && k % 2) continue;
    var ang = k * Math.PI / 2, px = bx + Math.cos(ang) * (B / 2 - 1.1), pz = bz + Math.sin(ang) * (B / 2 - 1.1);
    spawns.push({ kind: "streetlamp", x: px + (k % 2 ? 6 : 0), z: pz + (k % 2 ? 0 : 6) });
  }
  if (srng() < 0.3) spawns.push({ kind: "parked", x: bx + (srng() < 0.5 ? -1 : 1) * (B / 2 + 2.2), z: bz + (srng() - 0.5) * 12, rot: 0 });
};

LV.cityPark = function(c, bx, bz, B, isEnd, spawns) {
  for (var t = 0; t < 6; t++) {
    var a = srng() * 6.28, r = 4 + srng() * (B / 2 - 6);
    if (isEnd && r < 5) r = 6;
    spawns.push({ kind: "tree", x: bx + Math.cos(a) * r, z: bz + Math.sin(a) * r, y: 0.18 });
  }
  for (var b = 0; b < 3; b++) spawns.push({ kind: "bench", x: bx + (srng() - 0.5) * (B - 6), z: bz + (srng() - 0.5) * (B - 6), y: 0.18 });
};

LV.neonSign = function(c, x, z, w, d, y) {
  var words = ["OPEN", "DINER", "HOTEL", "24/7", "BAR", "PIZZA", "RAMEN", "ARCADE", "VIDEO", "TACOS", "DISC SHOP"];
  var cols = ["#ff3aa8", "#3af0ff", "#ffd23a", "#8aff6a", "#ff7a3a", "#b46aff"];
  var word = LV.pick(words), colr = LV.pick(cols);
  var cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
  var g = cv.getContext("2d"); g.clearRect(0, 0, 512, 128);
  g.font = "900 84px Nunito, 'Segoe UI', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = colr; g.shadowBlur = 18; g.fillStyle = colr; g.fillText(word, 256, 66); g.shadowBlur = 0; g.fillStyle = "#fff"; g.globalAlpha = 0.65; g.fillText(word, 256, 66);
  var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
  var m = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  var face = Math.floor(srng() * 4), a = face * Math.PI / 2;
  var off = (face % 2 ? w : d) / 2 + 0.08;
  m.position.set(x + Math.sin(a) * off, y, z + Math.cos(a) * off);
  m.rotation.y = a;
  var flick = srng() < 0.35;
  c.updaters.push(function(T) { m.material.opacity = flick ? (Math.sin(T * 23) > 0.6 || Math.sin(T * 1.7) > 0.2 ? 1 : 0.25) : 1; });
  c.group.add(m);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── CLUB: floating vaporwave stages over a neon void ─────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
LV.CLUB = {
  disco:      { pal: [0xff3aa8, 0x3af0ff, 0xb46aff, 0xffd23a], edge: 0xff3aa8, base: 0x150a24, sun: [0xffe46a, 0xff3a8a], label: "Night fever" },
  neon:       { pal: [0x3af0ff, 0xff3af0, 0x6a3aff, 0x3a8aff], edge: 0x3af0ff, base: 0x0a0a1e, sun: [0xffb84a, 0xff2a8a], label: "Outrun" },
  sixtyseven: { pal: [0x3aff8a, 0x9aff3a, 0x3affd2, 0x00c060], edge: 0x3aff8a, base: 0x04120a, sun: [0xaaff6a, 0x00a060], label: "Mainframe" },
  map67:      { pal: [0x3aff8a, 0x9aff3a, 0x3affd2, 0x00c060], edge: 0x3aff8a, base: 0x04120a, sun: [0xaaff6a, 0x00a060], label: "Sector 67" },
};

LV.club = function(c, hole, idx, d, spawns) {
  var S = LV.CLUB[hole.theme] || LV.CLUB.disco;
  hole.templateLabel = S.label;
  c.hazard = { type: "void", level: -20, base: -20 };
  c.surf = "metal";
  var restless = hole.mods.indexOf("restless") >= 0, crumble = hole.mods.indexOf("crumble") >= 0;
  var n = 4 + Math.min(4, Math.floor(idx / 2));
  var plats = [], x = 0, z = 0, y = 0;
  for (var i = 0; i < n; i++) {
    var type = i === 0 ? "stage" : i === n - 1 ? "stage" : LV.pick(["dance", "dance", "stage", "speakers"]);
    var size = type === "dance" ? 12 + srng() * 6 : type === "speakers" ? 9 : 9 + srng() * 4;
    if (i > 0) {
      var prev = plats[i - 1], gap = (idx < 2 ? 4 : 6) + srng() * ((idx < 2 ? 3 : 6) + d * 8);
      var ang = (srng() - 0.5) * 1.3;
      x = prev.x + Math.sin(ang) * (prev.size / 2 + gap + size / 2);
      z = prev.z - Math.cos(ang) * (prev.size / 2 + gap + size / 2);
      y = Math.max(-2, Math.min(9, prev.y + (srng() - 0.4) * 5));
    }
    plats.push({ x: x, z: z, y: y, size: size, type: type });
  }
  plats.forEach(function(p, i) { LV.clubPlatform(c, hole, S, p, i, crumble && i > 0 && i < n - 1, spawns); });
  // Connections
  for (var k = 1; k < plats.length; k++) {
    var A = plats[k - 1], Bp = plats[k], dx = Bp.x - A.x, dz = Bp.z - A.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    var ax = A.x + ux * A.size / 2, az = A.z + uz * A.size / 2, bx = Bp.x - ux * Bp.size / 2, bz = Bp.z - uz * Bp.size / 2;
    var kind = LV.pick(d < 0.3 ? ["catwalk", "catwalk", "pads"] : ["catwalk", "pads", "lift", "pads"]);
    if (Math.abs(Bp.y - A.y) > 2.5 && kind === "pads") kind = "lift";
    LV.clubLink(c, S, kind, ax, az, A.y, bx, bz, Bp.y, d, restless, crumble);
  }
  var first = plats[1] || plats[0], last = plats[plats.length - 1];
  LV.tee(c, 0, 0, 1.5, first);
  c.basket = { x: last.x, y: last.y, z: last.z };
  c.route = plats.map(function(p) { return { x: p.x, y: p.y, z: p.z }; });
  var xs = plats.map(function(p) { return p.x; }), zs = plats.map(function(p) { return p.z; });
  c.bounds = { minX: Math.min.apply(null, xs) - 40, maxX: Math.max.apply(null, xs) + 40, minZ: Math.min.apply(null, zs) - 40, maxZ: Math.max.apply(null, zs) + 40 };
  LV.vaporwave(c, hole, S);
  LV.clubDecor(c, hole, S, plats);
  spawns.push({ kind: "club", plats: plats, pal: S.pal });
};

// Glossy black/white disco checkerboard whose coloured squares pulse on the beat
LV.checkerMat = function(S) {
  LV._ck = LV._ck || {};
  if (LV._ck[S.edge]) return LV._ck[S.edge];
  var cv = document.createElement("canvas"); cv.width = cv.height = 128; var g = cv.getContext("2d");
  var ce = document.createElement("canvas"); ce.width = ce.height = 128; var e = ce.getContext("2d");
  e.fillStyle = "#000"; e.fillRect(0, 0, 128, 128);
  var cols = S.pal.map(function(h) { return "#" + h.toString(16).padStart(6, "0"); });
  for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) {
    var on = (x + y) % 2 === 0;
    g.fillStyle = on ? "#16161e" : "#e8e8f0"; g.fillRect(x * 32, y * 32, 32, 32);
    if (on && (x * 3 + y) % 3 === 0) { e.fillStyle = cols[(x + y * 2) % cols.length]; e.fillRect(x * 32 + 2, y * 32 + 2, 28, 28); }
  }
  g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 2; for (var k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32, 128); g.stroke(); g.beginPath(); g.moveTo(0, k * 32); g.lineTo(128, k * 32); g.stroke(); }
  var t = new THREE.CanvasTexture(cv), te = new THREE.CanvasTexture(ce);
  [t, te].forEach(function(q) { q.wrapS = q.wrapT = THREE.RepeatWrapping; q.encoding = THREE.sRGBEncoding; q.anisotropy = 4; q._dgShared = true; });
  var m = new THREE.MeshStandardMaterial({ map: t, emissive: new THREE.Color(0xffffff), emissiveMap: te, emissiveIntensity: 1, roughness: 0.12, metalness: 0.3 });
  m.userData.shared = true; m.userData.beatPulse = true;
  return (LV._ck[S.edge] = m);
};

// Neon signs, arches and floating wireframe shapes in the void
LV.clubDecor = function(c, hole, S, plats) {
  var words = { disco: ["DISCO", "NIGHT FEVER", "DANCE"], neon: ["NEON", "OUTRUN", "2084"], sixtyseven: ["67", "SIXTY SEVEN"], map67: ["67", "SECTOR 67"] }[hole.theme] || ["DISCO"];
  // Big flickering sign behind the basket stage and one beside the tee
  var last = plats[plats.length - 1], first = plats[0];
  LV.bigNeon(c, words[0], last.x, last.y + 9, last.z - last.size / 2 - 4, 0, S.pal[0], 22);
  LV.bigNeon(c, LV.pick(words), first.x - first.size / 2 - 6, first.y + 6, first.z - 6, Math.PI / 2.6, S.pal[1], 14);
  // Neon arches over the stages
  for (var i = 1; i < plats.length; i++) {
    if (srng() < 0.5) continue;
    var P = plats[i], arch = new THREE.Mesh(new THREE.TorusGeometry(P.size * 0.45, 0.12, 8, 40, Math.PI), new THREE.MeshBasicMaterial({ color: S.pal[i % S.pal.length] }));
    arch.position.set(P.x, P.y, P.z); arch.rotation.y = Math.atan2(P.x - plats[i - 1].x, P.z - plats[i - 1].z) + Math.PI / 2; c.group.add(arch);
    (function(m, k) { c.updaters.push(function(T) { var b = AudioEngine.beatPhase ? AudioEngine.beatPhase() : T * 2; var on = (Math.floor(b) + k) % 4 !== 0 && !(Math.sin(T * 29 + k) > 0.96); m.material.color.setHex(S.pal[(Math.floor(b / 4) + k) % S.pal.length]).multiplyScalar(on ? (c.dim === undefined ? 1 : c.dim) : 0.12); }); })(arch, i);
  }
  // Floating wireframe shapes drifting in the void
  var shapes = [new THREE.IcosahedronGeometry(3, 0), new THREE.TorusGeometry(3, 0.5, 6, 16), new THREE.OctahedronGeometry(3, 0), new THREE.ConeGeometry(2.5, 4, 3)];
  var b = c.bounds;
  for (var k = 0; k < 16; k++) {
    var m = new THREE.Mesh(LV.pick(shapes), new THREE.MeshBasicMaterial({ color: LV.pick(S.pal), wireframe: true, transparent: true, opacity: 0.7, fog: false }));
    var side = srng() < 0.5 ? -1 : 1;
    m.position.set((b.minX + b.maxX) / 2 + side * (25 + srng() * 30), -6 + srng() * 30, b.minZ + 30 + srng() * (b.maxZ - b.minZ - 60));
    m.scale.setScalar(0.6 + srng() * 1.6); c.group.add(m);
    (function(m, sp, ph) { c.updaters.push(function(T) { m.rotation.x = T * sp; m.rotation.y = T * sp * 0.7; m.position.y += Math.sin(T * 0.5 + ph) * 0.01; }); })(m, 0.2 + srng() * 0.4, srng() * 6);
  }
  // Checker floors pulse with the beat
  var ck = LV.checkerMat(S);
  c.updaters.push(function(T) { var bb = AudioEngine.beatPhase ? AudioEngine.beatPhase() : T * 2; ck.emissiveIntensity = (0.5 + Math.max(0, 1 - (bb % 1) * 2.5) * 1.6) * (c.dim === undefined ? 1 : c.dim); });
};
LV.bigNeon = function(c, text, x, y, z, rot, color, w) {
  var cv = document.createElement("canvas"); cv.width = 1024; cv.height = 256;
  var g = cv.getContext("2d"), col = "#" + color.toString(16).padStart(6, "0");
  g.font = "italic 900 170px Nunito, 'Segoe UI', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 10; g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 40; g.strokeText(text, 512, 132);
  g.shadowBlur = 12; g.lineWidth = 4; g.strokeStyle = "#ffffff"; g.strokeText(text, 512, 132);
  var t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
  var m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
  m.position.set(x, y, z); m.rotation.y = rot; c.group.add(m);
  var seed = srng() * 10;
  c.updaters.push(function(T) { var fl = Math.sin(T * 23 + seed) > 0.9 || (Math.sin(T * 0.7 + seed) > 0.97) ? 0.15 : 1; m.material.opacity = fl * (c.dim === undefined ? 1 : Math.max(0.2, c.dim)); });
};

// LED dance floor: tiles flash to the beat in shifting patterns
LV.danceFloorMat = function(pal, base) {
  var cols = pal.map(function(h) { var cc = new THREE.Color(h); return new THREE.Vector3(cc.r, cc.g, cc.b); });
  var bc = new THREE.Color(base);
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { beat: { value: 0 }, c0: { value: cols[0] }, c1: { value: cols[1] }, c2: { value: cols[2] }, c3: { value: cols[3] }, baseC: { value: new THREE.Vector3(bc.r, bc.g, bc.b) }, dim: { value: 1 } }]),
    vertexShader: "varying vec3 vW; varying vec3 vN;\n#include <fog_pars_vertex>\nvoid main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}",
    fragmentShader: [
      "uniform float beat; uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 baseC; uniform float dim; varying vec3 vW; varying vec3 vN;",
      "#include <fog_pars_fragment>",
      "float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }",
      "void main(){",
      "  if (vN.y < 0.5) { gl_FragColor = vec4(baseC * 0.6, 1.0); \n#include <encodings_fragment>\n#include <fog_fragment>\n return; }",
      "  vec2 tile = floor(vW.xz / 1.6), f = fract(vW.xz / 1.6);",
      "  float r = h(tile), b = floor(beat), ph = fract(beat), mode = mod(floor(beat / 8.0), 3.0);",
      "  float on;",
      "  if (mode < 0.5) on = step(0.55, h(tile + b * 1.7));",
      "  else if (mode < 1.5) on = step(0.5, sin(length(tile) * 0.9 - beat * 3.14159) * 0.5 + 0.5);",
      "  else on = step(0.5, mod(tile.x + tile.y + b, 2.0));",
      "  float pulse = on * (1.0 - ph * 0.7);",
      "  vec3 col = r < 0.25 ? c0 : r < 0.5 ? c1 : r < 0.75 ? c2 : c3;",
      "  float grout = smoothstep(0.0, 0.06, f.x) * smoothstep(1.0, 0.94, f.x) * smoothstep(0.0, 0.06, f.y) * smoothstep(1.0, 0.94, f.y);",
      "  vec3 o = baseC + col * pulse * 1.8 * grout * dim + col * 0.05;",
      "  gl_FragColor = vec4(o, 1.0);",
      "  #include <encodings_fragment>",
      "  #include <fog_fragment>",
      "}"].join("\n"),
    fog: true,
  });
};

LV.clubPlatform = function(c, hole, S, p, i, crumble, spawns) {
  var baseM = new THREE.MeshStandardMaterial({ color: S.base, roughness: 0.25, metalness: 0.6 });
  var top;
  if (p.type === "dance") {
    var dm = LV.danceFloorMat(S.pal, S.base);
    c.updaters.push(function() { dm.uniforms.beat.value = AudioEngine.beatPhase ? AudioEngine.beatPhase() : 0; dm.uniforms.dim.value = c.dim === undefined ? 1 : c.dim; });
    top = c.box({ x: p.x, z: p.z, w: p.size, d: p.size, top: p.y, h: 1.4, mats: [baseM, dm, baseM], kind: "platform", surf: "metal", crumble: crumble });
  } else if (p.type === "speakers") {
    top = c.box({ x: p.x, z: p.z, w: p.size, d: p.size, top: p.y, h: 1.4, mat: baseM, kind: "platform", surf: "metal", crumble: crumble });
    var spk = CM.get("speaker");
    for (var s = 0; s < 4; s++) {
      var sx = p.x + (s % 2 ? 1 : -1) * (p.size / 2 - 1.2), sz = p.z + (s < 2 ? 1 : -1) * (p.size / 2 - 1.2), hh = 1 + s * 0.85;
      var sp = c.box({ x: sx, z: sz, w: 1.9, d: 1.9, top: p.y + hh, bottom: p.y, mats: [spk, CM.get("metal", 0x222228), spk], kind: "platform", surf: "metal" });
      sp.mesh.userData.noBatch = true;
      (function(m) { c.updaters.push(function() { var b = AudioEngine.beatPhase ? AudioEngine.beatPhase() : 0; var k = 1 + Math.max(0, 1 - (b % 1) * 4) * 0.035; m.scale.set(k, 1, k); }); })(sp.mesh);
    }
  } else {
    var ck = LV.checkerMat(S);
    top = c.box({ x: p.x, z: p.z, w: p.size, d: p.size, top: p.y, h: 1.6, mats: [baseM, ck, baseM], kind: "platform", surf: "metal", crumble: crumble, rep: 4 });
  }
  // Neon edge strips (flicker independently)
  var edgeM = new THREE.MeshBasicMaterial({ color: S.edge }), seed = srng() * 10;
  [[0, p.size / 2, p.size, 0.12], [0, -p.size / 2, p.size, 0.12], [p.size / 2, 0, 0.12, p.size], [-p.size / 2, 0, 0.12, p.size]].forEach(function(e) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(e[2] + 0.12, 0.12, e[3] + 0.12), edgeM);
    m.position.set(p.x + e[0], p.y - 0.06, p.z + e[1]); c.group.add(m);
    if (top.mesh) { top.mesh.updateMatrixWorld(); m.userData.follow = top; }
  });
  c.updaters.push(function(T) {
    var dim = c.dim === undefined ? 1 : c.dim;
    var fl = (Math.sin(T * 31 + seed * 7) > 0.92 || Math.sin(T * 2.3 + seed) > 0.97) ? 0.15 : 1;
    edgeM.color.setHex(S.edge).multiplyScalar(fl * dim);
  });
  if (top.mesh) top.mesh.userData.noBatch = true;
  // Underside glow
  var glow = new THREE.Mesh(new THREE.PlaneGeometry(p.size * 1.3, p.size * 1.3), new THREE.MeshBasicMaterial({ color: S.edge, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, map: GFX.softDotTexture() }));
  glow.rotation.x = Math.PI / 2; glow.position.set(p.x, p.y - 1.8, p.z); c.group.add(glow);
  p.solid = top;
};

LV.clubLink = function(c, S, kind, ax, az, ay, bx, bz, by, d, restless, crumble) {
  var len = Math.hypot(bx - ax, bz - az), rot = Math.atan2(bx - ax, bz - az);
  var grate = new THREE.MeshStandardMaterial({ color: 0x3a3a48, roughness: 0.4, metalness: 0.8 });
  var edgeM = new THREE.MeshBasicMaterial({ color: S.edge });
  if (kind === "catwalk") {
    c.box({ x: (ax + bx) / 2, z: (az + bz) / 2, w: 1.8, d: len + 0.4, top: ay, top2: by, ramp: true, bottom: Math.min(ay, by) - 0.3, rot: rot, mat: grate, kind: "platform", surf: "metal" });
    [-0.95, 0.95].forEach(function(o) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, len), edgeM);
      m.position.set((ax + bx) / 2 + Math.cos(rot) * o, (ay + by) / 2 - 0.2, (az + bz) / 2 - Math.sin(rot) * o); m.rotation.y = rot;
      m.rotation.x = -Math.atan2(by - ay, len); c.group.add(m);
    });
  } else if (kind === "lift") {
    var mid = { x: (ax + bx) / 2, z: (az + bz) / 2 };
    // two short ramps to a lift that rises and falls with the beat
    var lo = Math.min(ay, by), hi = Math.max(ay, by);
    var lift = c.box({ x: mid.x, z: mid.z, w: 3.2, d: 3.2, top: lo, h: 0.6, mat: grate, kind: "platform", surf: "metal" });
    c.addMover(lift, { type: "pulse", amp: hi - lo + 0.2 });
    var m2 = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.1, 3.3), edgeM); m2.position.set(0, 0.3, 0); lift.mesh.add(m2);
    var ux = (bx - ax) / len, uz = (bz - az) / len;
    c.box({ x: (ax + mid.x - ux * 1.6) / 2, z: (az + mid.z - uz * 1.6) / 2, w: 1.8, d: Math.max(0.5, len / 2 - 1.6), top: ay, h: 0.4, rot: rot, mat: grate, kind: "platform" });
    c.box({ x: (bx + mid.x + ux * 1.6) / 2, z: (bz + mid.z + uz * 1.6) / 2, w: 1.8, d: Math.max(0.5, len / 2 - 1.6), top: by, h: 0.4, rot: rot, mat: grate, kind: "platform" });
  } else {
    // floating pads (bob when restless)
    var maxGap = 1.9 + d * 0.8, n = Math.max(1, Math.ceil((len - maxGap) / (maxGap + 2.2)));
    for (var i = 1; i <= n; i++) {
      var t = i / (n + 1);
      var pad = c.box({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, w: 2.2, d: 2.2, top: ay + (by - ay) * t, h: 0.5, rot: rot, mat: grate, kind: "platform", surf: "metal", crumble: crumble });
      var em = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 2.3), edgeM); em.position.y = -0.25; pad.mesh.add(em);
      if (restless) c.addMover(pad, { type: LV.pick(["bob", "linear"]), axis: LV.pick(["x", "z"]), amp: 1.0 + d, speed: 0.8 + srng() * 0.6, phase: srng() * 6 });
    }
  }
};

// Vaporwave backdrop: striped sunset sun, wireframe mountains, palm silhouettes, neon grid floor
LV.vaporwave = function(c, hole, S) {
  var sunMat = new THREE.ShaderMaterial({
    uniforms: { cTop: { value: new THREE.Color(S.sun[0]) }, cBot: { value: new THREE.Color(S.sun[1]) }, time: GFX.time },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: [
      "uniform vec3 cTop; uniform vec3 cBot; uniform float time; varying vec2 vUv;",
      "void main(){",
      "  vec2 p = vUv - 0.5; float r = length(p); if (r > 0.5) discard;",
      "  vec3 col = mix(cBot, cTop, smoothstep(-0.5, 0.5, p.y));",
      "  float band = 0.0; float y = 0.5 - vUv.y;",
      "  if (y > 0.02) { float freq = 18.0; float gap = (y) * 0.9; band = step(fract(y * freq - time * 0.15), gap); }",
      "  if (band > 0.5) discard;",
      "  float glow = smoothstep(0.5, 0.35, r);",
      "  gl_FragColor = vec4(col * (1.2 + glow * 0.6), 1.0);",
      "  #include <encodings_fragment>",
      "}"].join("\n"),
    depthWrite: false, fog: false,
  });
  var sun = new THREE.Mesh(new THREE.CircleGeometry(120, 64), sunMat);
  sun.renderOrder = -900;
  c.group.add(sun);
  // Glow halo
  var halo = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshBasicMaterial({ map: GFX.softDotTexture(), color: S.sun[1], transparent: true, opacity: 0.35, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  halo.renderOrder = -901; c.group.add(halo);
  // Wireframe mountain ridge
  var pts = [], R = 520;
  for (var i = 0; i <= 120; i++) {
    var a = i / 120 * Math.PI * 2, n = _gfxFbm2(Math.cos(a) * 3 + 5, Math.sin(a) * 3, 4);
    pts.push(new THREE.Vector3(Math.cos(a) * R, -30 + Math.pow(n, 2.2) * 160, Math.sin(a) * R));
  }
  var ridge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: S.edge, transparent: true, opacity: 0.85, fog: false }));
  c.group.add(ridge);
  var ridgeFill = [], idxs = [];
  for (var j = 0; j < pts.length; j++) { ridgeFill.push(pts[j].x, -40, pts[j].z, pts[j].x, pts[j].y, pts[j].z); }
  for (var k = 0; k < pts.length - 1; k++) { var b = k * 2; idxs.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  var rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.Float32BufferAttribute(ridgeFill, 3)); rg.setIndex(idxs);
  var rm = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: S.base, side: THREE.DoubleSide, fog: false })); rm.renderOrder = -800; c.group.add(rm);
  // Palm silhouettes on the horizon
  var palmTex = LV._palmTex();
  for (var p = 0; p < 10; p++) {
    var pa = (p / 10) * Math.PI * 2 + 0.3, pr = 440 + (p % 3) * 20, ph = 70 + (p % 4) * 18;
    var palm = new THREE.Mesh(new THREE.PlaneGeometry(ph * 0.75, ph), new THREE.MeshBasicMaterial({ map: palmTex, color: 0x05000a, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    palm.position.set(Math.cos(pa) * pr, -32 + ph / 2, Math.sin(pa) * pr); palm.lookAt(0, palm.position.y, 0); palm.renderOrder = -850;
    c.group.add(palm);
  }
  // Keep the sun locked to the horizon in front of the course
  var cx = (c.bounds.minX + c.bounds.maxX) / 2, cz = (c.bounds.minZ + c.bounds.maxZ) / 2;
  c.updaters.push(function() {
    var cam = GFX.camera.position;
    sun.position.set(cam.x, cam.y + 55, cam.z - 600); sun.lookAt(cam.x, cam.y + 55, cam.z);
    halo.position.set(cam.x, cam.y + 55, cam.z - 605); halo.lookAt(cam.x, cam.y + 55, cam.z);
    ridge.position.set(cam.x, 0, cam.z); rm.position.set(cam.x, 0, cam.z);
  });
};
LV._palmTex = function() {
  if (LV._palm) return LV._palm;
  var cv = document.createElement("canvas"); cv.width = 256; cv.height = 340;
  var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.strokeStyle = "#fff"; g.lineCap = "round";
  g.lineWidth = 12; g.beginPath(); g.moveTo(128, 340); g.quadraticCurveTo(150, 200, 118, 90); g.stroke();
  for (var i = 0; i < 9; i++) {
    var a = -Math.PI + i * Math.PI / 8 + 0.1;
    g.lineWidth = 7; g.beginPath(); g.moveTo(118, 90);
    var ex = 118 + Math.cos(a) * 110, ey = 90 + Math.sin(a) * 50 + 40;
    g.quadraticCurveTo(118 + Math.cos(a) * 60, 60 + Math.sin(a) * 40, ex, ey); g.stroke();
    for (var k = 0; k < 7; k++) { var t = k / 7; g.lineWidth = 3; g.beginPath(); var px = 118 + (ex - 118) * t, py = 90 + (ey - 90) * t - Math.sin(t * Math.PI) * 30; g.moveTo(px, py); g.lineTo(px + 6, py + 22); g.stroke(); }
  }
  var t2 = new THREE.CanvasTexture(cv); t2.encoding = THREE.sRGBEncoding;
  return (LV._palm = t2);
};
