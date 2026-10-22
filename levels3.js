"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── INTERIOR: liminal mazes with walls and a ceiling ─────────────────────────
//   backrooms – endless yellow rooms, damp carpet, buzzing lights, pillars
//   poolrooms – white tiles, pools to skirt around, raised tile terraces
//   office    – cubicles, desks, monitors, potted plants, giant stationery
// ══════════════════════════════════════════════════════════════════════════════
LV.INT = {
  backrooms: { S: 8, H: 4.6, open: 0.5, floor: ["carpet", 0xb8a030], wall: ["wallpaper", 0xd8c870], light: 0xfff4c0, label: "Level 0" },
  poolrooms: { S: 8, H: 6.0, open: 0.45, floor: ["tile", 0xd8e2de], wall: ["tile", 0xdbe6e4], light: 0xe0f4f4, label: "The pools" },
  office:    { S: 9, H: 5.2, open: 0.4, floor: ["carpet", 0x5a6a7a], wall: ["plastic", 0xe6e2da], light: 0xf4f8ff, label: "Open plan" },
};

LV.maze = function(cols, rows, open) {
  // walls: v[i][j] wall between (i,j)-(i+1,j); h[i][j] wall between (i,j)-(i,j+1)
  var v = [], h = [], seen = [], i, j;
  for (i = 0; i < cols; i++) { v.push([]); h.push([]); seen.push([]); for (j = 0; j < rows; j++) { v[i].push(true); h[i].push(true); seen[i].push(false); } }
  var si = Math.floor(cols / 2), stack = [[si, 0]]; seen[si][0] = true;
  while (stack.length) {
    var cur = stack[stack.length - 1], ci = cur[0], cj = cur[1], nb = [];
    if (ci > 0 && !seen[ci - 1][cj]) nb.push([ci - 1, cj]);
    if (ci < cols - 1 && !seen[ci + 1][cj]) nb.push([ci + 1, cj]);
    if (cj > 0 && !seen[ci][cj - 1]) nb.push([ci, cj - 1]);
    if (cj < rows - 1 && !seen[ci][cj + 1]) nb.push([ci, cj + 1]);
    if (!nb.length) { stack.pop(); continue; }
    // bias toward advancing (longer corridors heading away from the start)
    var n = nb.length > 1 && srng() < 0.35 ? nb.filter(function(p) { return p[1] > cj; })[0] || LV.pick(nb) : LV.pick(nb);
    if (n[0] !== ci) v[Math.min(ci, n[0])][cj] = false; else h[ci][Math.min(cj, n[1])] = false;
    seen[n[0]][n[1]] = true; stack.push(n);
  }
  // Knock out extra walls: loops and open rooms make it feel liminal, not a puzzle
  for (i = 0; i < cols; i++) for (j = 0; j < rows; j++) {
    if (i < cols - 1 && v[i][j] && srng() < open) v[i][j] = false;
    if (j < rows - 1 && h[i][j] && srng() < open) h[i][j] = false;
  }
  // BFS distances from start
  var dist = [], q = [[si, 0]];
  for (i = 0; i < cols; i++) { dist.push([]); for (j = 0; j < rows; j++) dist[i].push(-1); }
  dist[si][0] = 0;
  while (q.length) {
    var p = q.shift(), a = p[0], b = p[1], dd = dist[a][b];
    [[a - 1, b, a > 0 && !v[a - 1][b]], [a + 1, b, a < cols - 1 && !v[a][b]], [a, b - 1, b > 0 && !h[a][b - 1]], [a, b + 1, b < rows - 1 && !h[a][b]]].forEach(function(t) {
      if (t[2] && dist[t[0]][t[1]] < 0) { dist[t[0]][t[1]] = dd + 1; q.push([t[0], t[1]]); }
    });
  }
  return { v: v, h: h, dist: dist, si: si, cols: cols, rows: rows };
};
LV.mazePath = function(M, ei, ej) {
  var path = [[ei, ej]], i = ei, j = ej;
  while (M.dist[i][j] > 0) {
    var d = M.dist[i][j], nx = null;
    if (i > 0 && !M.v[i - 1][j] && M.dist[i - 1][j] === d - 1) nx = [i - 1, j];
    else if (i < M.cols - 1 && !M.v[i][j] && M.dist[i + 1][j] === d - 1) nx = [i + 1, j];
    else if (j > 0 && !M.h[i][j - 1] && M.dist[i][j - 1] === d - 1) nx = [i, j - 1];
    else if (j < M.rows - 1 && !M.h[i][j] && M.dist[i][j + 1] === d - 1) nx = [i, j + 1];
    if (!nx) break;
    i = nx[0]; j = nx[1]; path.unshift([i, j]);
  }
  return path;
};

LV.interior = function(c, hole, idx, d, spawns) {
  var th = hole.theme, I = LV.INT[th] || LV.INT.backrooms;
  hole.templateLabel = I.label;
  var S = I.S, H = I.H, T = 0.4;
  var cols = 4 + (idx > 5 ? 1 : 0), rows = 5 + Math.min(4, Math.floor(idx / 2));
  var M = LV.maze(cols, rows, I.open);
  // Basket: the farthest cell in the last two rows
  var ei = M.si, ej = rows - 1, best = -1;
  for (var i = 0; i < cols; i++) for (var j = rows - 2; j < rows; j++) if (M.dist[i][j] > best) { best = M.dist[i][j]; ei = i; ej = j; }
  var path = LV.mazePath(M, ei, ej);
  function cx(i) { return (i - (cols - 1) / 2) * S; }
  function cz(j) { return -j * S; }
  c.hazard = { type: "none", level: -2, base: -2 };
  c.floor = 0; c.ceiling = H;
  c.surf = I.floor[0];
  var minX = cx(0) - S / 2, maxX = cx(cols - 1) + S / 2, minZ = cz(rows - 1) - S / 2, maxZ = S / 2;
  c.bounds = { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ };
  var wallM = CM.get(I.wall[0], I.wall[1]), floorM = CM.get(I.floor[0], I.floor[1]);
  var baseM = CM.get("wood", th === "office" ? 0x8a8a8a : th === "poolrooms" ? 0xd8e4e4 : 0x6a5420);

  // Pools (poolrooms): some route cells become pools with a walkable rim
  var poolCells = {};
  if (th === "poolrooms") {
    path.forEach(function(p, k) { if (k > 0 && k < path.length - 1 && srng() < 0.35 + d * 0.3) poolCells[p[0] + "," + p[1]] = true; });
    for (var pi = 0; pi < cols; pi++) for (var pj = 1; pj < rows - 1; pj++) if (srng() < 0.2) poolCells[pi + "," + pj] = true;
    delete poolCells[M.si + ",0"]; delete poolCells[ei + "," + ej];
  }
  // Floor (per cell so pools can be cut out)
  var rim = 1.0;
  for (var a = 0; a < cols; a++) for (var b = 0; b < rows; b++) {
    var x = cx(a), z = cz(b);
    if (poolCells[a + "," + b]) {
      var pw = S - rim * 2;
      c.pools.push({ x: x, z: z, hw: pw / 2, hd: pw / 2, level: -0.35, type: "water" });
      [[0, -(S - rim) / 2, S, rim], [0, (S - rim) / 2, S, rim], [-(S - rim) / 2, 0, rim, pw], [(S - rim) / 2, 0, rim, pw]].forEach(function(r) {
        c.box({ x: x + r[0], z: z + r[1], w: r[2], d: r[3], top: 0, bottom: -0.3, mat: floorM, kind: "ground", surf: "tile", visual: true, cast: false, rep: 1 });
      });
      LV.poolBasin(c, x, z, pw);
    } else {
      var fl = new THREE.Mesh(new THREE.PlaneGeometry(S, S), floorM);
      _uvScale(fl.geometry, S / 2, S / 2);
      fl.rotation.x = -Math.PI / 2; fl.position.set(x, 0, z); fl.receiveShadow = true; c.group.add(fl);
    }
  }
  // Walls (with baseboards) and the outer shell
  function wall(x0, z0, x1, z1) {
    var len = Math.hypot(x1 - x0, z1 - z0) + T, rot = Math.atan2(x1 - x0, z1 - z0);
    c.box({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: T, d: len, top: H, bottom: 0, rot: rot, mat: wallM, kind: "wall", surf: "concrete", rep: 2, cast: false });
    [-1, 1].forEach(function(s) {
      var bb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, len), baseM);
      bb.position.set((x0 + x1) / 2 + Math.cos(rot) * s * (T / 2 + 0.02), 0.07, (z0 + z1) / 2 - Math.sin(rot) * s * (T / 2 + 0.02)); bb.rotation.y = rot; c.group.add(bb);
    });
  }
  for (var wi = 0; wi < cols; wi++) for (var wj = 0; wj < rows; wj++) {
    if (wi < cols - 1 && M.v[wi][wj]) wall(cx(wi) + S / 2, cz(wj) - S / 2, cx(wi) + S / 2, cz(wj) + S / 2);
    if (wj < rows - 1 && M.h[wi][wj]) wall(cx(wi) - S / 2, cz(wj) - S / 2, cx(wi) + S / 2, cz(wj) - S / 2);
  }
  wall(minX, maxZ, maxX, maxZ); wall(minX, minZ, maxX, minZ); wall(minX, minZ, minX, maxZ); wall(maxX, minZ, maxX, maxZ);

  // Ceiling with light panels that buzz and flicker
  var ceil = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), CM.get("ceiling", th === "poolrooms" ? 0xf4fafa : th === "office" ? 0xe8ecf0 : 0xe8e2c0));
  _uvScale(ceil.geometry, (maxX - minX) / 1.2, (maxZ - minZ) / 1.2);
  ceil.rotation.x = Math.PI / 2; ceil.position.set((minX + maxX) / 2, H, (minZ + maxZ) / 2); ceil.userData.noBatch = true; c.group.add(ceil); c.ceilMesh = ceil;
  LV.ceilingLights(c, hole, cols, rows, cx, cz, S, H, I.light);

  // Theme dressing
  var cells = [];
  for (var ca = 0; ca < cols; ca++) for (var cb = 0; cb < rows; cb++) {
    if (ca === M.si && cb === 0) continue; if (ca === ei && cb === ej) continue;
    cells.push({ i: ca, j: cb, x: cx(ca), z: cz(cb), pool: !!poolCells[ca + "," + cb], onPath: path.some(function(p) { return p[0] === ca && p[1] === cb; }) });
  }
  if (th === "backrooms") LV.backroomsDressing(c, cells, S, H, d, spawns);
  else if (th === "poolrooms") LV.poolroomsDressing(c, cells, S, H, d, spawns);
  else LV.officeDressing(c, cells, S, H, d, spawns);

  var p0 = path[0], p1 = path[1] || path[0];
  var tdx = Math.sign(cx(p1[0]) - cx(p0[0])), tdz = Math.sign(cz(p1[1]) - cz(p0[1]));
  LV.tee(c, cx(p0[0]) + tdx * 1.5, 0, cz(p0[1]) + tdz * 1.5, { x: cx(p1[0]), z: cz(p1[1]) });
  c.basket = { x: cx(ei), y: 0, z: cz(ej) };
  c.route = path.map(function(p) { return { x: cx(p[0]), y: 0, z: cz(p[1]) }; });
  spawns.push({ kind: "cells", cells: cells, S: S });
  c.backdrop = false;
};

LV.poolBasin = function(c, x, z, pw) {
  var tile = CM.get("tile", 0x9ae0ec), depth = 1.6;
  [[0, -pw / 2, pw, 0.1], [0, pw / 2, pw, 0.1], [-pw / 2, 0, 0.1, pw], [pw / 2, 0, 0.1, pw]].forEach(function(r) {
    var m = new THREE.Mesh(_courseBoxGeo(r[2], depth, r[3], 1), tile); m.position.set(x + r[0], -depth / 2, z + r[1]); c.group.add(m);
  });
  var bot = new THREE.Mesh(new THREE.PlaneGeometry(pw, pw), tile); _uvScale(bot.geometry, pw, pw); bot.rotation.x = -Math.PI / 2; bot.position.set(x, -depth, z); c.group.add(bot);
  var wm = LV.poolWaterMat();
  var w = new THREE.Mesh(new THREE.PlaneGeometry(pw, pw), wm); w.rotation.x = -Math.PI / 2; w.position.set(x, -0.35, z); w.renderOrder = 3; c.group.add(w);
};
LV.poolWaterMat = function() {
  if (LV._pwm) return LV._pwm;
  LV._pwm = new THREE.ShaderMaterial({
    uniforms: { time: GFX.time },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: [
      "uniform float time; varying vec3 vW;",
      "void main(){",
      "  vec2 p = vW.xz * 1.3;",
      "  float c = 0.0;",
      "  for (int i = 0; i < 3; i++) { float fi = float(i); p += vec2(sin(p.y * 1.7 + time * (0.8 + fi * 0.3)), cos(p.x * 1.5 - time * (0.7 + fi * 0.2))) * 0.35; c += abs(sin(p.x + p.y)); }",
      "  float caust = pow(1.0 - clamp(c / 3.0, 0.0, 1.0), 4.0);",
      "  vec3 col = mix(vec3(0.35, 0.82, 0.9), vec3(0.95, 1.0, 1.0), caust * 0.9);",
      "  gl_FragColor = vec4(col, 0.72);",
      "  #include <encodings_fragment>",
      "}"].join("\n"),
    transparent: true, depthWrite: false,
  });
  return LV._pwm;
};

// One emissive panel per cell; a few buzz and flicker. Blackout makes them fail over time.
LV.ceilingLights = function(c, hole, cols, rows, cx, cz, S, H, color) {
  var blackout = hole.mods.indexOf("blackout") >= 0;
  var panels = [], geo = new THREE.BoxGeometry(1.25, 0.06, 0.62);
  for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) {
    for (var k = 0; k < 2; k++) {
      var m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color(color), emissiveIntensity: 1.2, roughness: 0.5 });
      var p = new THREE.Mesh(geo, m);
      p.position.set(cx(i) + (k ? 1.6 : -1.6), H - 0.03, cz(j));
      p.userData.noBatch = true;
      c.group.add(p);
      panels.push({ m: m, flick: srng() < 0.12, seed: srng() * 100, die: blackout ? 10 + srng() * 80 : 1e9 });
    }
  }
  var hemi = GFX.hemi, base = null;
  c.updaters.push(function(T) {
    if (base === null) base = hemi.intensity;
    var on = 0;
    for (var n = 0; n < panels.length; n++) {
      var P = panels[n], e = 1.5;
      if (P.flick && (Math.sin(T * 17 + P.seed) > 0.75 || Math.sin(T * 3.1 + P.seed * 2) > 0.95)) e = 0.15;
      if (T > P.die) e = (Math.sin(T * 40 + P.seed) > 0.97) ? 0.8 : 0.02;
      P.m.emissiveIntensity = e; on += e / 1.5;
    }
    var k = on / panels.length;
    c.dim = k;
    hemi.intensity = base * (0.25 + 0.75 * k);
  });
};

LV.backroomsDressing = function(c, cells, S, H, d, spawns) {
  var wp = CM.get("wallpaper", 0xd8c870);
  cells.forEach(function(cell) {
    var r = srng();
    if (r < 0.3) {         // the pillars: chunky wallpapered columns with a darker skirting
      var n = 1 + Math.floor(srng() * 2);
      for (var k = 0; k < n; k++) {
        var px = cell.x + (k ? 1 : -1) * (n > 1 ? 1.8 : 0) + (srng() - 0.5), pz = cell.z + (srng() - 0.5) * 2;
        c.box({ x: px, z: pz, w: 0.9, d: 0.9, top: H, bottom: 0, mat: wp, kind: "wall", rep: 2 });
        var sk = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.14, 0.98), CM.get("wood", 0x6a5420)); sk.position.set(px, 0.07, pz); c.group.add(sk);
      }
    } else if (r < 0.42) { // half-height partition stub (you can hop on it from a chair)
      var rot = srng() < 0.5 ? 0 : Math.PI / 2;
      c.box({ x: cell.x, z: cell.z, w: 0.3, d: 3.2, top: 1.1, bottom: 0, rot: rot, mat: wp, kind: "platform", rep: 1 });
    } else if (r < 0.52) { // damp stain + puddle
      var st = new THREE.Mesh(new THREE.CircleGeometry(0.8 + srng() * 1.2, 18), new THREE.MeshStandardMaterial({ color: 0x5a4a18, roughness: 0.15, transparent: true, opacity: 0.55, depthWrite: false }));
      st.rotation.x = -Math.PI / 2; st.position.set(cell.x + (srng() - 0.5) * 4, 0.01, cell.z + (srng() - 0.5) * 4); c.group.add(st);
    }
  });
};

LV.poolroomsDressing = function(c, cells, S, H, d, spawns) {
  var tile = CM.get("tile", 0xf2f4ee), blue = CM.get("tile", 0x8ad4e8);
  cells.forEach(function(cell) {
    if (cell.pool) {
      // stepping tiles across some pools
      if (srng() < 0.5) for (var k = -1; k <= 1; k++) c.box({ x: cell.x + k * 2.2, z: cell.z + (srng() - 0.5) * 1.5, w: 1.1, d: 1.1, top: 0.0, bottom: -1.6, mat: blue, kind: "platform", surf: "tile", rep: 1 });
      return;
    }
    var r = srng();
    if (r < 0.28) {   // tiered terrace
      var w = 3 + srng() * 2;
      for (var t = 0; t < 3; t++) c.box({ x: cell.x, z: cell.z, w: w - t * 1.0, d: w - t * 1.0, top: 0.45 * (t + 1), bottom: 0, mat: t % 2 ? blue : tile, kind: "platform", surf: "tile", rep: 1 });
    } else if (r < 0.42) {   // round tiled pillar
      c.cyl({ x: cell.x + (srng() - 0.5) * 2, z: cell.z + (srng() - 0.5) * 2, r: 0.55, top: H, bottom: 0, mat: tile, kind: "wall", segments: 20 });
    } else if (r < 0.52) {   // arch window glow on the floor
      var g = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), new THREE.MeshBasicMaterial({ color: 0xffffff, map: GFX.softDotTexture(), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.rotation.x = -Math.PI / 2; g.position.set(cell.x, 0.02, cell.z); c.group.add(g);
    }
  });
};

LV.officeDressing = function(c, cells, S, H, d, spawns) {
  var fabric = CM.get("carpet", 0x6a7a8e), desk = CM.get("wood", 0xc8a878), metal = CM.get("metal", 0x9aa0a8), dark = CM.get("plastic", 0x22252a);
  cells.forEach(function(cell) {
    var r = srng();
    if (r < 0.55) {
      // cubicle cluster: L-shaped low partitions with a desk and a monitor
      var rot = Math.floor(srng() * 4) * Math.PI / 2, cos = Math.cos(rot), sin = Math.sin(rot);
      function P(lx, lz) { return { x: cell.x + lx * cos + lz * sin, z: cell.z - lx * sin + lz * cos }; }
      var a = P(-1.4, 0), b = P(0, -1.4);
      c.box({ x: a.x, z: a.z, w: 0.12, d: 2.8, top: 1.55, bottom: 0, rot: rot, mat: fabric, kind: "wall", rep: 1 });
      c.box({ x: b.x, z: b.z, w: 2.8, d: 0.12, top: 1.55, bottom: 0, rot: rot, mat: fabric, kind: "wall", rep: 1 });
      var dp = P(-0.55, -0.95);
      c.box({ x: dp.x, z: dp.z, w: 1.6, d: 0.8, top: 0.76, bottom: 0.7, rot: rot, mat: desk, kind: "platform", surf: "wood" });
      var mon = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.04), dark); mon.position.set(dp.x, 1.02, dp.z); mon.rotation.y = rot; c.group.add(mon);
      var scr = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34), new THREE.MeshBasicMaterial({ color: LV.pick([0x6ab0ff, 0x8affc0, 0xffffff, 0x3a6aff]) }));
      scr.position.set(dp.x + sin * 0.025, 1.02, dp.z + cos * 0.025); scr.rotation.y = rot; c.group.add(scr);
      var leg = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.04), metal); leg.position.set(dp.x - sin * 0.3, 0.35, dp.z - cos * 0.3); leg.rotation.y = rot; c.group.add(leg);
      spawns.push({ kind: "chair", x: dp.x + sin * 0.8, z: dp.z + cos * 0.8, rot: rot });
    } else if (r < 0.7) {
      spawns.push({ kind: "plant", x: cell.x + (srng() - 0.5) * 4, z: cell.z + (srng() - 0.5) * 4 });
    } else if (r < 0.8) {
      // filing cabinets you can climb
      for (var k = 0; k < 3; k++) c.box({ x: cell.x - 1 + k * 0.62, z: cell.z + S / 2 - 0.6, w: 0.6, d: 0.7, top: 0.7 + (k % 2) * 0.6, bottom: 0, mat: metal, kind: "platform", surf: "metal" });
    }
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// ── BLOCKS: voxel worlds and geometry-dash platforms ─────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
LV.blocks = function(c, hole, idx, d, spawns) {
  if (hole.theme === "geometry_dash") return LV.gdash(c, hole, idx, d, spawns);
  if (hole.theme === "skyblock") return LV.skyblock(c, hole, idx, d, spawns);
  return LV.voxelLand(c, hole, idx, d, spawns);
};

// Voxel grid stored as integer column heights; the course heightfield samples it per block.
LV.voxelGrid = function(c, minX, maxX, minZ, maxZ, fn) {
  var nx = maxX - minX, nz = maxZ - minZ, g = new Float32Array(nx * nz), kind = new Uint8Array(nx * nz);
  for (var j = 0; j < nz; j++) for (var i = 0; i < nx; i++) {
    var r = fn(minX + i + 0.5, minZ + j + 0.5);
    g[j * nx + i] = r ? r.h : -Infinity; kind[j * nx + i] = r ? r.k : 0;
  }
  var V = { g: g, k: kind, nx: nx, nz: nz, x0: minX, z0: minZ };
  c.hf = { g: new Float32Array(4), nx: 2, nz: 2, x0: minX, z0: minZ, cell: Math.max(nx, nz), maxX: maxX, maxZ: maxZ,
    post: function(h, x, z) { var i = Math.floor(x - minX), j = Math.floor(z - minZ); if (i < 0 || j < 0 || i >= nx || j >= nz) return -Infinity; return g[j * nx + i]; } };
  c.vox = V;
  return V;
};
LV.voxelAt = function(V, i, j) { if (i < 0 || j < 0 || i >= V.nx || j >= V.nz) return -Infinity; return V.g[j * V.nx + i]; };

// Pixel-art block textures (16×16, nearest filtering)
LV.blockTex = function(type) {
  LV._bt = LV._bt || {};
  if (LV._bt[type]) return LV._bt[type];
  var c = document.createElement("canvas"); c.width = c.height = 16;
  var g = c.getContext("2d"), rnd = _gfxRng(type.length * 977 + 3);
  function px(cols, wts) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var r = rnd(), k = 0, acc = 0; for (; k < wts.length - 1; k++) { acc += wts[k]; if (r < acc) break; } g.fillStyle = cols[k]; g.fillRect(x, y, 1, 1); } }
  switch (type) {
    case "grass_top": px(["#5fa33a", "#6db544", "#4f8f2e", "#7cc24f"], [0.4, 0.3, 0.2, 0.1]); break;
    case "dirt": px(["#866043", "#6f4e36", "#9a7254", "#5d402b"], [0.4, 0.3, 0.2, 0.1]); break;
    case "grass_side":
      px(["#866043", "#6f4e36", "#9a7254", "#5d402b"], [0.4, 0.3, 0.2, 0.1]);
      for (var x = 0; x < 16; x++) { var hgt = 3 + Math.floor(rnd() * 3); for (var y = 0; y < hgt; y++) { g.fillStyle = rnd() < 0.5 ? "#5fa33a" : "#4f8f2e"; g.fillRect(x, y, 1, 1); } }
      break;
    case "stone": px(["#8a8a8a", "#7a7a7a", "#9a9a9a", "#6a6a6a"], [0.4, 0.3, 0.2, 0.1]); break;
    case "sand": px(["#e0d098", "#d4c48a", "#ead8a4", "#c8b87c"], [0.4, 0.3, 0.2, 0.1]); break;
    case "log":
      px(["#6a5034", "#5a4028", "#7a5c3c", "#4a3420"], [0.4, 0.3, 0.2, 0.1]);
      for (var lx = 0; lx < 16; lx += 4) { g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(lx, 0, 1, 16); }
      break;
    case "leaves": px(["#3a7a2a", "#2e6a20", "#4a8a34", "rgba(0,0,0,0)"], [0.4, 0.3, 0.2, 0.1]); break;
    case "planks":
      px(["#b08850", "#a07a44", "#bc945c", "#94703c"], [0.4, 0.3, 0.2, 0.1]);
      g.fillStyle = "rgba(0,0,0,.35)"; for (var py = 3; py < 16; py += 4) g.fillRect(0, py, 16, 1);
      break;
    case "cobble":
      px(["#7a7a7a", "#5e5e5e", "#9a9a9a", "#4a4a4a"], [0.35, 0.3, 0.25, 0.1]);
      g.strokeStyle = "rgba(0,0,0,.35)"; g.strokeRect(0.5, 0.5, 7, 7); g.strokeRect(8.5, 4.5, 7, 7); g.strokeRect(2.5, 9.5, 6, 6);
      break;
  }
  var t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.encoding = THREE.sRGBEncoding; t._dgShared = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;   // big boxes (tree canopies, bridges) tile the block texture
  return (LV._bt[type] = t);
};
LV.blockMat = function(type) {
  LV._bm = LV._bm || {};
  if (LV._bm[type]) return LV._bm[type];
  var m = new THREE.MeshStandardMaterial({ map: LV.blockTex(type), roughness: 0.95, alphaTest: type === "leaves" ? 0.5 : 0, side: type === "leaves" ? THREE.DoubleSide : THREE.FrontSide });
  m.userData.shared = true;
  return (LV._bm[type] = m);
};

// Render a voxel grid as instanced cubes (top block + exposed sides only)
LV.voxelMesh = function(c, V, kinds) {
  var lists = {}, m4 = new THREE.Matrix4();
  for (var j = 0; j < V.nz; j++) for (var i = 0; i < V.nx; i++) {
    var h = V.g[j * V.nx + i]; if (h === -Infinity) continue;
    var k = V.k[j * V.nx + i], K = kinds[k]; if (!K) continue;
    var lo = Math.min(LV.voxelAt(V, i - 1, j), LV.voxelAt(V, i + 1, j), LV.voxelAt(V, i, j - 1), LV.voxelAt(V, i, j + 1));
    var bottom = K.bottom !== undefined ? K.bottom : (lo === -Infinity ? h - (K.depth || 3) : Math.max(lo, h - 6));
    for (var y = h - 1; y >= bottom - 0.01; y--) {
      var t = y === h - 1 ? K.top : (h - 1 - y < 3 ? K.sub : K.deep);
      (lists[t] = lists[t] || []).push(V.x0 + i + 0.5, y + 0.5, V.z0 + j + 0.5);
    }
  }
  var geo = new THREE.BoxGeometry(1, 1, 1);
  Object.keys(lists).forEach(function(t) {
    var arr = lists[t], n = arr.length / 3, mats = LV.blockMats(t);
    var mesh = new THREE.InstancedMesh(geo, mats, n);
    for (var q = 0; q < n; q++) { m4.makeTranslation(arr[q * 3], arr[q * 3 + 1], arr[q * 3 + 2]); mesh.setMatrixAt(q, m4); }
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.noBatch = true;
    mesh.frustumCulled = false;   // instances span the whole world; culling by the base cube's bounds made blocks vanish
    c.group.add(mesh);
  });
};
LV.blockMats = function(t) {
  if (t === "grass") return [LV.blockMat("grass_side"), LV.blockMat("grass_side"), LV.blockMat("grass_top"), LV.blockMat("dirt"), LV.blockMat("grass_side"), LV.blockMat("grass_side")];
  return LV.blockMat(t);
};

LV.voxelLand = function(c, hole, idx, d, spawns) {
  hole.templateLabel = LV.pick(["Overworld", "Plains", "Hills", "Riverside"]);
  var W = 2;                       // sea level (blocks at or below are water)
  c.hazard = { type: "water", level: W - 0.15, base: W - 0.15 };
  c.tideMax = 2;
  c.surf = "pixel";
  var L = 80 + Math.min(idx, 12) * 5, n = 3 + Math.floor(srng() * 2), pts = [{ x: 0, z: 0 }];
  for (var i = 1; i <= n; i++) pts.push({ x: Math.round((srng() - 0.5) * 2 * (10 + d * 12)), z: -Math.round(L * i / n) });
  var ox = srng() * 100, oz = srng() * 100, lakeT = 0.3 + srng() * 0.4;
  var lake = LV.pointAt(pts, lakeT), lakeR = 4 + d * 5;
  var minX = -40, maxX = 40, minZ = -L - 30, maxZ = 25;
  LV.voxelGrid(c, minX, maxX, minZ, maxZ, function(x, z) {
    var pd = LV.polyDist(pts, x, z);
    var nse = _gfxFbm2(x / 22 + ox, z / 22 + oz, 4);
    var h = 5 + (nse - 0.5) * 10 + Math.max(0, pd.d - 8) * 0.35 + pd.t * 3;
    if (pd.d < 7) h = h * 0.4 + (5 + pd.t * 4) * 0.6;          // gentle fairway
    var ld = Math.hypot(x - lake.x, z - lake.z) - lakeR;
    if (ld < 3) h = Math.min(h, W - 1 + Math.max(0, ld) * 1.2);  // a lake across the fairway
    h = Math.round(h);
    var k = h <= W ? 2 : h <= W + 1 ? 3 : h > 13 ? 4 : 1;      // 1 grass, 2 underwater sand, 3 beach sand, 4 stone
    return { h: h, k: k };
  });
  LV.voxelMesh(c, c.vox, { 1: { top: "grass", sub: "dirt", deep: "stone" }, 2: { top: "sand", sub: "sand", deep: "stone" }, 3: { top: "sand", sub: "sand", deep: "stone" }, 4: { top: "stone", sub: "stone", deep: "stone" } });
  // Blocky trees (trunks block discs, canopies are solid — you can climb onto them)
  var trees = 0;
  for (var t = 0; t < 400 && trees < 26 + d * 10; t++) {
    var tx = Math.floor(minX + 3 + srng() * (maxX - minX - 6)) + 0.5, tz = Math.floor(minZ + 3 + srng() * (maxZ - minZ - 6)) + 0.5;
    var pd2 = LV.polyDist(pts, tx, tz), gy = c.heightAt(tx, tz);
    if (gy <= W + 1 || Math.hypot(tx, tz) < 6 || Math.hypot(tx - pts[n].x, tz - pts[n].z) < 6) continue;
    if (pd2.d < 4 && srng() < 0.7) continue;
    LV.blockTree(c, tx, gy, tz); trees++;
  }
  // Plank bridge over the lake (early holes), stepping blocks later
  var a = LV.pointAt(pts, Math.max(0, lakeT - (lakeR + 4) / L)), b = LV.pointAt(pts, Math.min(1, lakeT + (lakeR + 4) / L));
  var ay = c.heightAt(a.x, a.z), by = c.heightAt(b.x, b.z);
  if (d < 0.3) c.box({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w: 2, d: Math.hypot(b.x - a.x, b.z - a.z), top: ay, top2: by, ramp: true, bottom: W - 1, rot: Math.atan2(b.x - a.x, b.z - a.z), mat: LV.blockMat("planks"), kind: "platform", surf: "wood", rep: 1 });
  else LV.stones(c, a.x, a.z, ay, b.x, b.z, by, d, { mat: LV.blockMat("cobble"), bottom: W - 3, crumble: hole.mods.indexOf("crumble") >= 0 });
  // Water (custom flat blue so it reads as minecraft water)
  var tee = pts[0], last = pts[n];
  LV.tee(c, tee.x + 0.5, c.heightAt(tee.x + 0.5, tee.z + 0.5), tee.z + 0.5, pts[1]);
  c.basket = { x: last.x + 0.5, y: c.heightAt(last.x + 0.5, last.z + 0.5), z: last.z + 0.5 };
  c.route = pts.map(function(p) { return { x: p.x, y: c.heightAt(p.x, p.z), z: p.z }; });
  c.bounds = { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ };
  spawns.push({ kind: "voxel", pts: pts });
  c.backdrop = false;
  c.voxelBackdrop = true;
};

LV.blockTree = function(c, x, y, z) {
  var h = 4 + Math.floor(srng() * 2);
  c.box({ x: x, z: z, w: 1, d: 1, top: y + h, bottom: y, mat: LV.blockMat("log"), kind: "wall", surf: "wood", rep: 1 });
  var leaves = LV.blockMat("leaves");
  c.box({ x: x, z: z, w: 5, d: 5, top: y + h + 1, bottom: y + h - 1, mat: leaves, kind: "platform", surf: "grass", rep: 1, crumbleNever: true });
  c.box({ x: x, z: z, w: 3, d: 3, top: y + h + 2, bottom: y + h + 1, mat: leaves, kind: "platform", surf: "grass", rep: 1 });
};

LV.skyblock = function(c, hole, idx, d, spawns) {
  hole.templateLabel = LV.pick(["Sky islands", "Cloud hop", "Floating isles"]);
  c.hazard = { type: "void", level: -25, base: -25 };
  c.surf = "pixel";
  var n = 4 + Math.min(3, Math.floor(idx / 3)), isl = [], x = 0, z = 0, y = 10;
  for (var i = 0; i < n; i++) {
    var r = i === 0 || i === n - 1 ? 6 : 3.5 + srng() * 3;
    if (i > 0) { var gap = (idx < 2 ? 4 : 6) + srng() * ((idx < 2 ? 4 : 8) + d * 10), ang = (srng() - 0.5) * 1.2, prev = isl[i - 1]; x = Math.round(prev.x + Math.sin(ang) * (prev.r + gap + r)); z = Math.round(prev.z - Math.cos(ang) * (prev.r + gap + r)); y = Math.max(4, Math.min(18, prev.y + Math.round((srng() - 0.45) * 5))); }
    isl.push({ x: x, z: z, y: y, r: r });
  }
  var xs = isl.map(function(p) { return p.x; }), zs = isl.map(function(p) { return p.z; });
  var minX = Math.floor(Math.min.apply(null, xs) - 14), maxX = Math.ceil(Math.max.apply(null, xs) + 14), minZ = Math.floor(Math.min.apply(null, zs) - 14), maxZ = Math.ceil(Math.max.apply(null, zs) + 14);
  var ox = srng() * 50;
  LV.voxelGrid(c, minX, maxX, minZ, maxZ, function(px, pz) {
    for (var k = 0; k < isl.length; k++) {
      var I = isl[k], dd = Math.hypot(px - I.x, pz - I.z), wob = (_gfxFbm2(px / 6 + ox, pz / 6, 2) - 0.5) * 2.5;
      if (dd < I.r + wob) return { h: I.y + (dd < I.r * 0.4 && _gfxFbm2(px / 4, pz / 4 + ox, 2) > 0.6 ? 1 : 0), k: 1, bot: I.y - Math.max(2, (I.r - dd) * 1.6) };
    }
    return null;
  });
  LV.voxelMesh(c, c.vox, { 1: { top: "grass", sub: "dirt", deep: "stone", depth: 5 } });
  // Underside: cone of dirt/stone hanging below each island
  isl.forEach(function(I) {
    var geo = new THREE.ConeGeometry(I.r * 0.9, I.r * 1.8, 7, 3); geo.rotateX(Math.PI);
    var cone = new THREE.Mesh(geo, LV.blockMat("stone")); cone.position.set(I.x, I.y - 3 - I.r * 0.9, I.z); c.group.add(cone);
  });
  // Connections: 1-block plank bridges, then gaps you have to jump
  var crumble = hole.mods.indexOf("crumble") >= 0, restless = hole.mods.indexOf("restless") >= 0;
  for (var k = 1; k < isl.length; k++) {
    var A = isl[k - 1], B = isl[k], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    var ax = A.x + ux * (A.r - 0.5), az = A.z + uz * (A.r - 0.5), bx = B.x - ux * (B.r - 0.5), bz = B.z - uz * (B.r - 0.5);
    var len = Math.hypot(bx - ax, bz - az), steps = Math.ceil(len / 1);
    var gapEvery = d < 0.2 ? 0 : d < 0.5 ? 4 : 3;
    for (var s = 0; s < steps; s++) {
      if (gapEvery && s % gapEvery === gapEvery - 1) continue;
      var t = (s + 0.5) / steps, top = Math.round(A.y + (B.y - A.y) * t);
      var blk = c.box({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, w: 1.1, d: 1.1, top: top, h: 1, mat: LV.blockMat(s % 5 === 0 ? "cobble" : "planks"), kind: "platform", surf: "wood", rep: 1, crumble: crumble && srng() < 0.4 });
      if (restless && s % 6 === 3) c.addMover(blk, { type: "linear", axis: Math.abs(ux) > Math.abs(uz) ? "z" : "x", amp: 1.5, speed: 1.2, phase: s });
    }
  }
  // A skyblock tree and chest on the tee island
  LV.blockTree(c, isl[0].x - 4.5, c.heightAt(isl[0].x - 4.5, isl[0].z - 1.5), isl[0].z - 1.5);
  var I1 = isl[1] || isl[0];
  LV.tee(c, isl[0].x + 0.5, c.heightAt(isl[0].x + 0.5, isl[0].z + 0.5), isl[0].z + 0.5, I1);
  var lastI = isl[n - 1];
  c.basket = { x: lastI.x + 0.5, y: c.heightAt(lastI.x + 0.5, lastI.z + 0.5), z: lastI.z + 0.5 };
  c.route = isl.map(function(p) { return { x: p.x, y: p.y, z: p.z }; });
  c.bounds = { minX: minX - 30, maxX: maxX + 30, minZ: minZ - 30, maxZ: maxZ + 30 };
  spawns.push({ kind: "skyblock", isl: isl });
  c.backdrop = false;
};

// Geometry Dash: neon block platforms over a void, spikes, jump pads and saws
LV.gdash = function(c, hole, idx, d, spawns) {
  hole.templateLabel = LV.pick(["Stereo Madness", "Back on Track", "Polargeist", "Dry Out", "Base After Base"]);
  c.hazard = { type: "void", level: -20, base: -20 };
  c.surf = "metal";
  var pal = [0x00c8ff, 0xff3af0, 0x3aff8a, 0xffd23a];
  var blockM = new THREE.MeshStandardMaterial({ color: 0x0a1a40, emissive: new THREE.Color(0x0a2a80), emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4, map: LV.gdTex() });
  var n = 6 + Math.min(5, Math.floor(idx / 2)), segs = [], x = 0, z = 0, y = 0;
  for (var i = 0; i < n; i++) {
    var len = i === 0 || i === n - 1 ? 12 : 8 + srng() * 8, w = i === 0 || i === n - 1 ? 10 : 5 + srng() * 3 - d * 1.5;
    if (i > 0) {
      var prev = segs[i - 1]; z = prev.z - prev.len / 2 - (2.5 + srng() * (2.5 + d * 4)) - len / 2; x = prev.x + (srng() - 0.5) * (4 + d * 8);
      var steps = i === 1 || idx < 2 ? [0, 0, -1.5] : d < 0.5 ? [0, 0, 1.5, -1.5, -3] : [0, 1.5, 3, -1.5, 4.5];
      y = Math.max(-1, Math.min(14, prev.y + LV.pick(steps)));
    }
    segs.push({ x: x, z: z, y: y, len: len, w: w });
  }
  var spikesOn = hole.mods.length > 0 || idx > 2;
  segs.forEach(function(s, k) {
    c.box({ x: s.x, z: s.z, w: s.w, d: s.len, top: s.y, h: 2, mat: blockM, kind: "platform", surf: "metal", rep: 2, crumble: k > 0 && k < n - 1 && hole.mods.indexOf("crumble") >= 0 });
    var edge = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.06, 0.08, s.len + 0.06), new THREE.MeshBasicMaterial({ color: pal[k % pal.length] }));
    edge.position.set(s.x, s.y + 0.02, s.z); c.group.add(edge);
    // Jump pad when the next segment is much higher
    var nx = segs[k + 1];
    if (nx && nx.y - s.y > 1.0) {
      var pad = c.box({ x: s.x + (nx.x - s.x) * 0.3, z: s.z - s.len / 2 + 1.2, w: 1.4, d: 1.4, top: s.y + 0.18, bottom: s.y, mat: CM.get("glow", 0xffd23a), kind: "platform", bounce: 11 + (nx.y - s.y) * 1.1 });
      pad.mesh.userData.noBatch = true;
    }
    // Early holes: a thin neon walkway bridges the gap (later you have to jump it)
    if (k > 0 && (d < 0.35 || srng() < 0.25)) {
      var pv = segs[k - 1], ax = pv.x, az = pv.z - pv.len / 2 + 0.2, bx = s.x, bz = s.z + s.len / 2 - 0.2;
      c.box({ x: (ax + bx) / 2, z: (az + bz) / 2, w: 1.4, d: Math.hypot(bx - ax, bz - az), top: pv.y, top2: s.y, ramp: true, bottom: Math.min(pv.y, s.y) - 0.4, rot: Math.atan2(bx - ax, bz - az), mat: CM.get("glow", pal[k % pal.length], { i: 0.8 }), kind: "platform", surf: "metal" });
    }
    // Spikes: hazard blocks the player must hop over (the disc pings off them)
    if (spikesOn && k > 0 && k < n - 1 && s.len > 7) spawns.push({ kind: "spikes", x: s.x + (srng() - 0.5) * (s.w - 2), z: s.z + (srng() - 0.5) * (s.len - 4), y: s.y, rot: 0 });
    if (k > 0 && k < n - 1 && srng() < 0.35 + d * 0.4) spawns.push({ kind: "saw", x: s.x, z: s.z, y: s.y, w: s.w });
  });
  var last = segs[n - 1];
  LV.tee(c, 0, 0, 2, segs[1]);
  c.basket = { x: last.x, y: last.y, z: last.z };
  c.route = segs.map(function(s) { return { x: s.x, y: s.y, z: s.z }; });
  var xs = segs.map(function(p) { return p.x; }), zs = segs.map(function(p) { return p.z; });
  c.bounds = { minX: Math.min.apply(null, xs) - 40, maxX: Math.max.apply(null, xs) + 40, minZ: Math.min.apply(null, zs) - 40, maxZ: Math.max.apply(null, zs) + 40 };
  // Pulse the block glow on the beat
  c.updaters.push(function() { var b = AudioEngine.beatPhase ? AudioEngine.beatPhase() : 0; blockM.emissiveIntensity = 0.45 + Math.max(0, 1 - (b % 1) * 3) * 0.6; });
  LV.vaporwave(c, hole, { sun: [0x66ccff, 0x2a3aff], edge: 0x00c8ff, base: 0x000420 });
  c.backdrop = false;
};
LV.gdTex = function() {
  if (LV._gdt) return LV._gdt;
  var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d");
  var gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "#3a6aff"); gr.addColorStop(1, "#0a1a60");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#cfe0ff"; g.lineWidth = 4; g.strokeRect(6, 6, 116, 116);
  g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 2; g.strokeRect(22, 22, 84, 84);
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t._dgShared = true;
  return (LV._gdt = t);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── MOON: low gravity, craters and bottomless pits ───────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
LV.moon = function(c, hole, idx, d, spawns) {
  hole.templateLabel = LV.pick(["Sea of Tranquility", "Crater field", "Dark side", "Tycho rim"]);
  c.hazard = { type: "void", level: -12, base: -12 };
  c.gravity = 0.38;
  c.surf = "rock";
  var L = 110 + Math.min(idx, 12) * 7, n = 3 + Math.floor(srng() * 2), pts = [{ x: 0, z: 0 }];
  for (var i = 1; i <= n; i++) pts.push({ x: (srng() - 0.5) * 2 * (14 + d * 16), z: -L * i / n });
  var craters = [];
  for (var k = 0; k < 70; k++) {
    var cx = (srng() - 0.5) * 180, cz = 30 - srng() * (L + 80), cr = 2 + Math.pow(srng(), 2.5) * 16;
    if (Math.hypot(cx, cz) < cr + 8) continue;
    var tl = pts[n]; if (Math.hypot(cx - tl.x, cz - tl.z) < cr + 7) continue;
    craters.push({ x: cx, z: cz, r: cr, pit: cr > 6 && srng() < 0.35 + d * 0.4 });
  }
  // A guaranteed pit across the route on later holes
  if (d > 0.2) { var pp = LV.pointAt(pts, 0.4 + srng() * 0.3); craters.push({ x: pp.x + (srng() - 0.5) * 6, z: pp.z, r: 6 + d * 5, pit: true }); }
  var ox = srng() * 100;
  function base(x, z) {
    var h = (_gfxFbm2(x / 50 + ox, z / 50, 4) - 0.5) * 8 + (_gfxFbm2(x / 9, z / 9 + ox, 2) - 0.5) * 0.8;
    for (var q = 0; q < craters.length; q++) {
      var C = craters[q], dd = Math.hypot(x - C.x, z - C.z) / C.r;
      if (dd > 1.6) continue;
      if (C.pit && dd < 0.82) return -40;                      // bottomless pit
      var bowl = dd < 1 ? -(1 - dd * dd) * C.r * 0.35 : 0;
      var rimH = Math.exp(-Math.pow((dd - 1) * 3.2, 2)) * C.r * 0.14;
      h += bowl + rimH;
    }
    return h;
  }
  var minX = -100, maxX = 100, minZ = -L - 60, maxZ = 50;
  c.setHeightfield(minX, maxX, minZ, maxZ, 1.0, base, function(h) { return h < -20 ? -60 : h; });
  c.bounds = { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ };
  LV.terrainMesh(c, hole, { top: 0x8a8a8c, side: 0x5a5a5e, snow: 99, surf: "regolith" }, minX, maxX, minZ, maxZ, 1.0);
  // Glowing warning ring around pits
  craters.forEach(function(C) {
    if (!C.pit) return;
    var ring = new THREE.Mesh(new THREE.RingGeometry(C.r * 0.82, C.r * 0.86, 48), new THREE.MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(C.x, c.heightAt(C.x + C.r * 0.9, C.z) + 0.15, C.z); c.group.add(ring);
    var dark = new THREE.Mesh(new THREE.CircleGeometry(C.r * 0.83, 40), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    dark.rotation.x = -Math.PI / 2; dark.position.set(C.x, -18, C.z); c.group.add(dark);
  });
  var t0 = LV.pointAt(pts, 0.02), last = pts[n];
  LV.tee(c, t0.x, c.heightAt(t0.x, t0.z), t0.z, LV.pointAt(pts, 0.15));
  c.basket = { x: last.x, y: c.heightAt(last.x, last.z), z: last.z };
  c.route = pts.map(function(p) { return { x: p.x, y: c.heightAt(p.x, p.z), z: p.z }; });
  spawns.push({ kind: "moon", pts: pts, craters: craters });
  // Earth hanging in the black sky
  var earth = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 32), new THREE.MeshBasicMaterial({ map: LV.earthTex(), fog: false }));
  earth.position.set(-220, 160, -420); earth.rotation.z = 0.4; c.group.add(earth);
  c.updaters.push(function(T) { earth.rotation.y = T * 0.02; });
  c.backdrop = false;
};
LV.earthTex = function() {
  if (LV._earth) return LV._earth;
  var c = document.createElement("canvas"); c.width = 512; c.height = 256; var g = c.getContext("2d");
  g.fillStyle = "#1a4a9a"; g.fillRect(0, 0, 512, 256);
  var rnd = _gfxRng(42);
  for (var i = 0; i < 26; i++) { g.fillStyle = rnd() < 0.7 ? "#3a8a3a" : "#c8a860"; g.beginPath(); var x = rnd() * 512, y = 40 + rnd() * 176; for (var k = 0; k < 9; k++) { var a = k / 9 * 6.28; g.lineTo(x + Math.cos(a) * (10 + rnd() * 30), y + Math.sin(a) * (8 + rnd() * 20)); } g.fill(); }
  g.fillStyle = "rgba(255,255,255,.75)"; for (var j = 0; j < 40; j++) { g.beginPath(); g.ellipse(rnd() * 512, rnd() * 256, 20 + rnd() * 40, 3 + rnd() * 5, 0, 0, 6.28); g.fill(); }
  g.fillStyle = "#f4f8ff"; g.fillRect(0, 0, 512, 14); g.fillRect(0, 242, 512, 14);
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  return (LV._earth = t);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── CASTLE: stone platforms over a dark lake, spiral towers, moving stairs ───
// ══════════════════════════════════════════════════════════════════════════════
LV.castle = function(c, hole, idx, d, spawns) {
  hole.templateLabel = LV.pick(["Moving staircases", "Astronomy tower", "Great hall", "Clock tower"]);
  var W = -1.5;
  c.hazard = { type: "water", level: W, base: W };
  c.tideMax = 2;
  c.surf = "stone";
  var stone = CM.get("stone", 0x8a8070), dark = CM.get("stone", 0x5a5248);
  var n = 4 + Math.min(3, Math.floor(idx / 3)), plats = [], x = 0, z = 0, y = 2;
  for (var i = 0; i < n; i++) {
    var w = i === 0 ? 12 : i === n - 1 ? 9 : 7 + srng() * 5, dd = i === 0 ? 12 : 7 + srng() * 5;
    if (i > 0) { var p = plats[i - 1], gap = (idx < 2 ? 5 : 7) + srng() * ((idx < 2 ? 3 : 6) + d * 6), ang = (srng() - 0.5) * 1.1; x = p.x + Math.sin(ang) * (p.d / 2 + gap + dd / 2); z = p.z - Math.cos(ang) * (p.d / 2 + gap + dd / 2); y = Math.max(1.5, Math.min(12, p.y + LV.pick([-2, 0, 2, 3, 4]))); }
    plats.push({ x: x, z: z, y: y, w: w, d: dd });
  }
  var restless = hole.mods.indexOf("restless") >= 0, crumble = hole.mods.indexOf("crumble") >= 0;
  plats.forEach(function(P, k) {
    c.box({ x: P.x, z: P.z, w: P.w, d: P.d, top: P.y, bottom: W - 4, mats: [dark, stone, dark], kind: "ground", surf: "stone", rep: 3 });
    LV.crenellations(c, P, k === 0 ? 1 : 0);
    // torches on the corners
    for (var q = 0; q < 2; q++) spawns.push({ kind: "torch", x: P.x + (q ? 1 : -1) * (P.w / 2 - 0.5), z: P.z + P.d / 2 - 0.5, y: P.y });
  });
  // Links: stone bridges, then moving staircases that drift between landings
  for (var k = 1; k < plats.length; k++) {
    var A = plats[k - 1], B = plats[k], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    var ra = Math.min(A.w, A.d) / 2, rb = Math.min(B.w, B.d) / 2;
    var ax = A.x + ux * (ra - 0.3), az = A.z + uz * (ra - 0.3), bx = B.x - ux * (rb - 0.3), bz = B.z - uz * (rb - 0.3);
    if (d < 0.2 || (k === 1 && idx % 2 === 0)) {
      c.stairs(ax, az, A.y, bx, bz, B.y, 2.4, stone, { bottom: Math.min(A.y, B.y) - 1.2 });
    } else {
      // A floating stair flight that slides back and forth between the two landings
      var mid = { x: (ax + bx) / 2, z: (az + bz) / 2 }, len = Math.hypot(bx - ax, bz - az), rot = Math.atan2(bx - ax, bz - az);
      var flight = c.box({ x: mid.x, z: mid.z, w: 2.6, d: Math.max(3, len * 0.45), top: A.y, top2: B.y, ramp: true, bottom: Math.min(A.y, B.y) - 0.6, rot: rot, mat: stone, kind: "platform", surf: "stone", crumble: crumble });
      var span = len * 0.28;
      c.addMover(flight, { type: "path", x0: mid.x - ux * span, z0: mid.z - uz * span, y0: 0, x1: mid.x + ux * span, z1: mid.z + uz * span, y1: 0, speed: 0.35 + d * 0.3, phase: srng() * 6 });
      flight.motion.y0 = flight.top; flight.motion.y1 = flight.top;
      if (restless) flight.motion.speed *= 1.5;
      // landing ledges so you can step on at either end
      c.box({ x: ax + ux * 0.9, z: az + uz * 0.9, w: 2.6, d: 1.8, top: A.y, h: 0.6, rot: rot, mat: dark, kind: "platform" });
      c.box({ x: bx - ux * 0.9, z: bz - uz * 0.9, w: 2.6, d: 1.8, top: B.y, h: 0.6, rot: rot, mat: dark, kind: "platform" });
    }
  }
  // Spiral tower with the basket on top (later holes)
  var last = plats[n - 1], bxp = last.x, bzp = last.z, byp = last.y;
  if (idx >= 3) {
    var tr = 2.6, th = 6 + d * 4, tx = last.x, tz = last.z;
    c.cyl({ x: tx, z: tz, r: tr, top: last.y + th, bottom: last.y, mat: stone, kind: "wall", segments: 18 });
    var steps = Math.ceil(th / 0.3);
    for (var s = 0; s < steps; s++) {
      var a = s * 0.32, sx = tx + Math.cos(a) * (tr + 0.75), sz = tz + Math.sin(a) * (tr + 0.75);
      c.box({ x: sx, z: sz, w: 1.5, d: 1.0, top: last.y + (s + 1) * 0.3, bottom: last.y + (s + 1) * 0.3 - 0.35, rot: -a, mat: dark, kind: "platform", surf: "stone", cast: false });
    }
    bxp = tx; bzp = tz; byp = last.y + th;
  }
  var first = plats[1] || plats[0];
  LV.tee(c, plats[0].x, plats[0].y, plats[0].z + 2, first);
  c.basket = { x: bxp, y: byp, z: bzp };
  c.route = plats.map(function(P) { return { x: P.x, y: P.y, z: P.z }; });
  var xs = plats.map(function(P) { return P.x; }), zs = plats.map(function(P) { return P.z; });
  c.bounds = { minX: Math.min.apply(null, xs) - 60, maxX: Math.max.apply(null, xs) + 60, minZ: Math.min.apply(null, zs) - 60, maxZ: Math.max.apply(null, zs) + 60 };
  spawns.push({ kind: "castle", plats: plats });
  LV.candles(c, plats);
  c.backdrop = true;
};
LV.crenellations = function(c, P, open) {
  var m = CM.get("stone", 0x7a7064), geos = [];
  [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function(s, si) {
    if (open && si === 1) return;
    var along = s[0] === 0 ? P.w : P.d, n = Math.floor(along / 1.6);
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n - 0.5, g = new THREE.BoxGeometry(0.7, 0.7, 0.4);
      if (s[0] !== 0) g.rotateY(Math.PI / 2);
      g.translate(P.x + (s[0] === 0 ? t * along : s[0] * (P.w / 2 - 0.2)), P.y + 0.35, P.z + (s[0] === 0 ? s[1] * (P.d / 2 - 0.2) : t * along));
      geos.push(g);
    }
  });
  if (geos.length) { var mesh = new THREE.Mesh(GFX.mergeGeometries(geos), m); mesh.castShadow = true; c.group.add(mesh); }
};
// Floating candles drifting above the platforms
LV.candles = function(c, plats) {
  var n = 60, geo = new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6), wax = new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.6 });
  var mesh = new THREE.InstancedMesh(geo, wax, n), flames = new THREE.BufferGeometry(), fp = new Float32Array(n * 3), seeds = [];
  for (var i = 0; i < n; i++) { var P = plats[i % plats.length]; seeds.push({ x: P.x + (srng() - 0.5) * P.w * 1.4, z: P.z + (srng() - 0.5) * P.d * 1.4, y: P.y + 4 + srng() * 4, s: srng() * 6 }); }
  flames.setAttribute("position", new THREE.BufferAttribute(fp, 3));
  var pts = new THREE.Points(flames, new THREE.PointsMaterial({ color: 0xffc860, size: 0.35, map: GFX.softDotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; mesh.frustumCulled = false; mesh.userData.noBatch = true;
  c.group.add(mesh); c.group.add(pts);
  var m4 = new THREE.Matrix4();
  c.updaters.push(function(T) {
    for (var i = 0; i < n; i++) {
      var S = seeds[i], y = S.y + Math.sin(T * 0.8 + S.s) * 0.25;
      m4.makeTranslation(S.x, y, S.z); mesh.setMatrixAt(i, m4);
      fp[i * 3] = S.x; fp[i * 3 + 1] = y + 0.24 + Math.sin(T * 13 + S.s) * 0.02; fp[i * 3 + 2] = S.z;
    }
    mesh.instanceMatrix.needsUpdate = true; flames.attributes.position.needsUpdate = true;
  });
};
