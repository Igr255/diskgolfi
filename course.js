"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── COURSE ENGINE ────────────────────────────────────────────────────────────
// A course is a walkable world made of:
//   • a heightfield (hills, terraces, voxel terrain, craters) and/or a flat floor
//   • solids: boxes (buildings, platforms, walls, blocks) and cylinders
//     (islands, stepping stones, pillars). Solids can move (movers) or crumble.
//   • hazards: global water / lava / void level, plus local pools
//   • an optional ceiling (interiors)
// heightAt(x, z) is the single source of truth for the ground used by the disc,
// the player, the camera and the minimap.
// ══════════════════════════════════════════════════════════════════════════════

var COURSE_CELL = 8;

function Course(hole) {
  this.hole = hole;
  this.group = new THREE.Group();
  this.solids = [];
  this.movers = [];
  this.pools = [];
  this.hf = null;
  this.floor = null;           // flat floor height inside bounds (city streets, interiors)
  this.ceiling = null;
  this.hazard = { type: "water", level: -1.5, base: -1.5 };
  this.bounds = { minX: -60, maxX: 60, minZ: -200, maxZ: 40 };
  this.route = [];             // [{x,y,z}] tee → basket (intro camera, minimap, auto-aim)
  this.tee = { x: 0, y: 0, z: 0, yaw: 0 };
  this.basket = { x: 0, y: 0, z: -50 };
  this.surf = "grass";         // default surface material
  this.grid = {};
  this.gravity = 1;            // multiplier (moon)
  this.updaters = [];          // per-frame visual animators (lights, tiles…)
}

// ── Spatial index ────────────────────────────────────────────────────────────
Course.prototype._index = function(s) {
  var r = s.shape === "cyl" ? s.r + (s.taper || 0) : Math.hypot(s.hw, s.hd);
  var x0 = Math.floor((s.x - r) / COURSE_CELL), x1 = Math.floor((s.x + r) / COURSE_CELL);
  var z0 = Math.floor((s.z - r) / COURSE_CELL), z1 = Math.floor((s.z + r) / COURSE_CELL);
  for (var i = x0; i <= x1; i++) for (var j = z0; j <= z1; j++) {
    var k = i + "," + j; (this.grid[k] || (this.grid[k] = [])).push(s);
  }
};

Course.prototype._contains = function(s, x, z) {
  if (s.disabled) return -Infinity;
  if (s.shape === "cyl") {
    var d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r) return s.top;
    if (s.taper && d < s.r + s.taper) return s.top - (d - s.r) * 2.0;
    return -Infinity;
  }
  var dx = x - s.x, dz = z - s.z;
  if (s.rot) { var c = Math.cos(-s.rot), sn = Math.sin(-s.rot); var lx = dx * c - dz * sn; dz = dx * sn + dz * c; dx = lx; }
  if (Math.abs(dx) <= s.hw && Math.abs(dz) <= s.hd) {
    if (s.ramp) {   // sloped top along local z: from top (at -hd) to top2 (at +hd)
      return s.top + (s.top2 - s.top) * ((dz + s.hd) / (2 * s.hd));
    }
    return s.top;
  }
  return -Infinity;
};

Course.prototype._inPool = function(x, z) {
  for (var i = 0; i < this.pools.length; i++) {
    var p = this.pools[i];
    if (Math.abs(x - p.x) <= p.hw && Math.abs(z - p.z) <= p.hd) return p;
  }
  return null;
};

Course.prototype.inBounds = function(x, z) {
  var b = this.bounds; return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
};

// Ground height at (x, z). Below the hazard level means "hazard here".
Course.prototype.heightAt = function(x, z) {
  var h = -Infinity, pool = this.pools.length ? this._inPool(x, z) : null;
  if (pool) h = pool.level - 2;
  else {
    if (this.floor !== null && this.inBounds(x, z)) h = this.floor;
    if (this.hf) h = Math.max(h, this.hfAt(x, z));
  }
  var cell = this.grid[Math.floor(x / COURSE_CELL) + "," + Math.floor(z / COURSE_CELL)];
  if (cell) for (var i = 0; i < cell.length; i++) { var t = this._contains(cell[i], x, z); if (t > h) h = t; }
  for (var m = 0; m < this.movers.length; m++) { var tm = this._contains(this.movers[m], x, z); if (tm > h) h = tm; }
  if (h === -Infinity) return this.hazard.type === "void" || this.hazard.type === "none" ? -80 : this.hazard.level - 2;
  return h;
};

// The solid (if any) providing the ground at (x, z) — used for carrying and surfaces
Course.prototype.supportAt = function(x, z) {
  var best = null, h = this.heightAt(x, z);
  var cell = this.grid[Math.floor(x / COURSE_CELL) + "," + Math.floor(z / COURSE_CELL)];
  var cands = (cell || []).concat(this.movers);
  for (var i = 0; i < cands.length; i++) { if (Math.abs(this._contains(cands[i], x, z) - h) < 1e-4) { best = cands[i]; break; } }
  return { y: h, solid: best };
};

// Hazard level at a location (pools have their own water level)
Course.prototype.hazardAt = function(x, z) {
  var p = this.pools.length ? this._inPool(x, z) : null;
  if (p) return { level: p.level, type: p.type || "water" };
  return this.hazard;
};
Course.prototype.isHazard = function(x, z) { var hz = this.hazardAt(x, z); return this.heightAt(x, z) < hz.level + 0.3; };

// ── Heightfield ──────────────────────────────────────────────────────────────
// base(x,z) is sampled into a grid; post(h) (terraces / voxels) is applied after
// bilinear filtering so ledges stay crisp for the player and the disc.
Course.prototype.setHeightfield = function(minX, maxX, minZ, maxZ, cell, base, post) {
  var nx = Math.ceil((maxX - minX) / cell) + 1, nz = Math.ceil((maxZ - minZ) / cell) + 1;
  var g = new Float32Array(nx * nz);
  for (var j = 0; j < nz; j++) for (var i = 0; i < nx; i++) g[j * nx + i] = base(minX + i * cell, minZ + j * cell);
  this.hf = { g: g, nx: nx, nz: nz, x0: minX, z0: minZ, cell: cell, post: post || null, maxX: minX + (nx - 1) * cell, maxZ: minZ + (nz - 1) * cell };
};
Course.prototype.hfBase = function(x, z) {
  var f = this.hf;
  var fx = (x - f.x0) / f.cell, fz = (z - f.z0) / f.cell;
  if (fx < 0 || fz < 0 || fx > f.nx - 1 || fz > f.nz - 1) return -Infinity;
  var i = Math.min(f.nx - 2, Math.floor(fx)), j = Math.min(f.nz - 2, Math.floor(fz)), u = fx - i, v = fz - j;
  var a = f.g[j * f.nx + i], b = f.g[j * f.nx + i + 1], c = f.g[(j + 1) * f.nx + i], d = f.g[(j + 1) * f.nx + i + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
Course.prototype.hfAt = function(x, z) {
  var h = this.hfBase(x, z);
  if (h === -Infinity) return h;
  return this.hf.post ? this.hf.post(h, x, z) : h;
};

// ── Solids ───────────────────────────────────────────────────────────────────
Course.prototype.addSolid = function(s) {
  s.kind = s.kind || "ground";
  this.solids.push(s);
  if (!s.mover) this._index(s);
  return s;
};

// Box solid with a world-scaled textured mesh. o: {x,z,w,d,top,h|bottom,rot,mat|mats,kind,surf,cast,ramp,top2,visual}
Course.prototype.box = function(o) {
  var bottom = o.bottom !== undefined ? o.bottom : o.top - (o.h || 1);
  var s = this.addSolid({ shape: "box", x: o.x, z: o.z, hw: o.w / 2, hd: o.d / 2, rot: o.rot || 0, top: o.top, bottom: bottom,
    kind: o.kind, surf: o.surf, ramp: !!o.ramp, top2: o.top2, mover: !!o.mover, crumble: o.crumble, bounce: o.bounce });
  if (o.visual !== false) {
    var h = Math.max(0.02, (o.ramp ? Math.max(o.top, o.top2) : o.top) - bottom);
    var geo = _courseBoxGeo(o.w, h, o.d, o.rep || 2, o.uvOffset);
    if (o.ramp) _rampify(geo, o.top - bottom, o.top2 - bottom, h);
    var mats = o.mats || o.mat || CM.get("stone");
    var mesh = new THREE.Mesh(geo, Array.isArray(mats) ? [mats[0], mats[0], mats[1] || mats[0], mats[2] || mats[0], mats[0], mats[0]] : mats);
    mesh.position.set(o.x, bottom + h / 2, o.z);
    mesh.rotation.y = o.rot || 0;
    mesh.castShadow = o.cast !== false; mesh.receiveShadow = true;
    s.mesh = mesh; s.meshBaseY = mesh.position.y;
    if (o.crumble || o.mover) mesh.userData.noBatch = true;
    (o.parent || this.group).add(mesh);
  }
  return s;
};

// Cylinder solid (stones, pillars, round platforms). o: {x,z,r,top,h,mat,taper,kind,segments,visual}
Course.prototype.cyl = function(o) {
  var bottom = o.bottom !== undefined ? o.bottom : o.top - (o.h || 1);
  var s = this.addSolid({ shape: "cyl", x: o.x, z: o.z, r: o.r, top: o.top, bottom: bottom, taper: o.taper || 0, kind: o.kind, surf: o.surf, mover: !!o.mover, crumble: o.crumble, bounce: o.bounce });
  if (o.visual !== false) {
    var h = o.top - bottom;
    var geo = new THREE.CylinderGeometry(o.r * (o.topScale || 1), o.r * (o.botScale || 1), h, o.segments || 24);
    var mats = o.mats || o.mat || CM.get("stone");
    var mesh = new THREE.Mesh(geo, Array.isArray(mats) ? [mats[0], mats[1] || mats[0], mats[2] || mats[0]] : mats);
    mesh.position.set(o.x, bottom + h / 2, o.z);
    mesh.castShadow = o.cast !== false; mesh.receiveShadow = true;
    s.mesh = mesh; s.meshBaseY = mesh.position.y;
    if (o.crumble || o.mover) mesh.userData.noBatch = true;
    (o.parent || this.group).add(mesh);
  }
  return s;
};

// A walkable staircase between two points (each step rises ≤ 0.32 m)
Course.prototype.stairs = function(x0, z0, y0, x1, z1, y1, width, mat, opts) {
  opts = opts || {};
  var dist = Math.hypot(x1 - x0, z1 - z0), rise = y1 - y0;
  var n = Math.max(2, Math.ceil(Math.abs(rise) / 0.3));
  var rot = Math.atan2(x1 - x0, z1 - z0), run = dist / n;
  for (var i = 0; i < n; i++) {
    var t = (i + 0.5) / n, top = y0 + rise * (i + 1) / n;
    this.box({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, w: width, d: run + 0.02, top: top, bottom: opts.bottom !== undefined ? opts.bottom : Math.min(y0, y1) - 0.5, rot: rot, mat: mat, kind: "platform", cast: false });
  }
};

// Moving solid. motion: {type:'linear'|'orbit'|'bob'|'spin', axis:'x'|'z', amp, speed, phase}
Course.prototype.addMover = function(s, motion) {
  s.mover = true; s.motion = motion;
  if (s.mesh) s.mesh.userData.noBatch = true;
  s.base = { x: s.x, z: s.z, top: s.top, top2: s.top2, bottom: s.bottom, rot: s.rot || 0 };
  s.dx = s.dz = s.dy = 0;
  var i = this.solids.indexOf(s);
  // remove from static grid if it was indexed
  var self = this;
  Object.keys(this.grid).forEach(function(k) { var a = self.grid[k], j = a.indexOf(s); if (j >= 0) a.splice(j, 1); });
  this.movers.push(s);
  return s;
};

// ── Per-frame update: movers, crumbling platforms, tide, animators ───────────
Course.prototype.update = function(T, dt, playerFeet) {
  for (var i = 0; i < this.movers.length; i++) {
    var s = this.movers[i], m = s.motion, b = s.base;
    var ox = s.x, oz = s.z, oy = s.top, t = T * m.speed + (m.phase || 0);
    var nx = b.x, nz = b.z, ny = b.top;
    if (m.type === "linear") { if (m.axis === "x") nx = b.x + Math.sin(t) * m.amp; else nz = b.z + Math.sin(t) * m.amp; }
    else if (m.type === "orbit") { nx = b.x + Math.cos(t) * m.amp; nz = b.z + Math.sin(t) * m.amp * (m.squash || 1); }
    else if (m.type === "bob") { ny = b.top + Math.sin(t) * m.amp; }
    else if (m.type === "path") { var k = (Math.sin(t) + 1) / 2; nx = m.x0 + (m.x1 - m.x0) * k; nz = m.z0 + (m.z1 - m.z0) * k; ny = m.y0 + (m.y1 - m.y0) * k; }
    else if (m.type === "pulse") {   // hydraulic lift that moves on the beat
      var beat = (typeof mpMode !== "undefined" && mpMode) ? T * 2 : (typeof AudioEngine !== "undefined" && AudioEngine.beatPhase) ? AudioEngine.beatPhase() : T * 2;
      ny = b.top + (0.5 - 0.5 * Math.cos((beat / 4) * Math.PI * 2)) * m.amp;
    }
    s.x = nx; s.z = nz; s.top = ny; s.bottom = b.bottom + (ny - b.top);
    if (s.ramp) s.top2 = b.top2 + (ny - b.top);
    s.dx = nx - ox; s.dz = nz - oz; s.dy = ny - oy;
    if (s.mesh) s.mesh.position.set(nx, s.meshBaseY + (ny - b.top), nz);
  }
  // Crumbling platforms: shake, drop, come back later
  for (var c = 0; c < this.solids.length; c++) {
    var cs = this.solids[c];
    if (!cs.crumble || !cs.mesh) continue;
    if (cs._crumbleT !== undefined) {
      cs._crumbleT -= dt;
      if (cs._crumbleT > 0) { cs.mesh.position.x = cs.x + (Math.random() - 0.5) * 0.12; cs.mesh.position.z = cs.z + (Math.random() - 0.5) * 0.12; }
      else if (cs._crumbleT > -5) { cs.disabled = true; cs.mesh.position.y -= dt * 9; cs.mesh.visible = cs._crumbleT > -1.2; }
      else { cs.disabled = false; cs.mesh.visible = true; cs.mesh.position.set(cs.x, cs.meshBaseY, cs.z); delete cs._crumbleT; }
    }
  }
  // Rising tide / lava
  if (this.tide && this.hazard.type !== "void" && this.hazard.type !== "none") {
    this.tide.t += dt;
    if (this.tide.t > this.tide.delay) {
      this.hazard.level = Math.min(this.hazard.base + this.tide.max, this.hazard.level + this.tide.rate * dt);
      this.hole.water = this.hazard.level;
      if (this.waterMesh) this.waterMesh.position.y = this.hazard.level;
    }
  }
  // Visual animators get time since this hole started (movers above use the shared clock)
  if (this._t0 === undefined) this._t0 = T;
  for (var u = 0; u < this.updaters.length; u++) this.updaters[u](T - this._t0, dt);
};

// Another player stood on a crumbling platform
Course.prototype.crumbleRemote = function(i) { var s = this.solids[i]; if (s && s.crumble && s._crumbleT === undefined) s._crumbleT = 1.1; };

// Start crumbling the platform under a point (called when the player stands on it)
Course.prototype.touch = function(x, z) {
  var sup = this.supportAt(x, z);
  if (sup.solid && sup.solid.crumble && sup.solid._crumbleT === undefined) {
    sup.solid._crumbleT = 1.1;
    if (this.onCrumble) this.onCrumble(this.solids.indexOf(sup.solid));
  }
  return sup;
};

// ══════════════════════════════════════════════════════════════════════════════
// ── GEOMETRY HELPERS ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// BoxGeometry whose UVs are in world units / rep, so textures tile evenly on any size
function _courseBoxGeo(w, h, d, rep, off) {
  var g = new THREE.BoxGeometry(w, h, d);
  var uv = g.attributes.uv, spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (var f = 0; f < 6; f++) for (var k = 0; k < 4; k++) {
    var i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * spans[f][0] / rep + (off ? off[0] : 0), uv.getY(i) * spans[f][1] / rep + (off ? off[1] : 0));
  }
  return g;
}
// Turn a box into a ramp: lower/raise the top vertices along z
function _rampify(geo, h0, h1, H) {
  var p = geo.attributes.position;
  for (var i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) { var k = p.getZ(i) > 0 ? h1 : h0; p.setY(i, -H / 2 + k); }
  }
  p.needsUpdate = true; geo.computeVertexNormals();
}

// ══════════════════════════════════════════════════════════════════════════════
// ── COURSE MATERIALS ─────────────────────────────────────────────────────────
// Procedural canvas textures (shared + cached) for every surface type.
// ══════════════════════════════════════════════════════════════════════════════
var CM = {
  _c: {},
  get: function(key, color, opts) {
    var k = key + "_" + (color === undefined ? "" : color) + (opts ? JSON.stringify(opts) : "");
    if (this._c[k]) return this._c[k];
    var m = this._make(key, color, opts || {});
    m.userData.shared = true;
    return (this._c[k] = m);
  },
  _std: function(color, tex, rough, extra) {
    var p = { color: color === undefined ? 0xffffff : color, roughness: rough === undefined ? 0.85 : rough, metalness: 0 };
    if (tex) { p.map = tex.map || tex; if (tex.bump) { p.bumpMap = tex.bump; p.bumpScale = tex.bumpScale || 0.03; } }
    if (extra) Object.keys(extra).forEach(function(k) { p[k] = extra[k]; });
    return new THREE.MeshStandardMaterial(p);
  },
  _make: function(key, color, o) {
    var T = function(style) { return GFX.surfaceTexture(style, null); };
    switch (key) {
      case "grass":    return this._std(color || 0x6aa83a, T("grass"), 0.95);
      case "dirt":     return this._std(color || 0x7a5a3a, T("dirt"), 1);
      case "rock":     return this._std(color || 0x8a8580, T("rock"), 0.95);
      case "stone":    return this._std(color || 0x9a948c, T("stone"), 0.9);
      case "sand":     return this._std(color || 0xe0c890, T("sand"), 1);
      case "snow":     return this._std(color || 0xf4f8ff, T("snow"), 0.6);
      case "concrete": return this._std(color || 0xa0a2a6, T("concrete"), 0.85);
      case "asphalt":  return this._std(color || 0x3a3d44, _asphaltTex(), 0.9);
      case "sidewalk": return this._std(color || 0xb4b2ac, _pavingTex(), 0.85);
      case "wood":     return this._std(color || 0x9a6a3e, _woodTex(), 0.8);
      case "carpet":   return this._std(color || 0xb8a030, T("carpet"), 1);
      case "tile":     return this._std(color || 0xf2f2ec, T("tile"), 0.25);
      case "wallpaper":return this._std(color || 0xd8c870, _wallpaperTex(), 0.95);
      case "ceiling":  return this._std(color || 0xe8e2c0, _ceilingTex(), 0.95);
      case "metal":    return this._std(color || 0x8a929a, null, 0.35, { metalness: 0.8 });
      case "plastic":  return this._std(color || 0xffffff, null, 0.45);
      case "glow":     return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(color || 0xffffff), emissiveIntensity: o.i || 1.6, roughness: 0.4 });
      case "neon":     { var nt = GFX.surfaceTexture("neon", { surf: { line: color || 0x00ffff } }); return new THREE.MeshStandardMaterial({ color: 0x0a0a18, map: nt.map, emissive: new THREE.Color(0xffffff), emissiveMap: nt.emissive, emissiveIntensity: 1.3, roughness: 0.3 }); }
      case "pixel":    return this._std(color || 0x5a9a2a, T("pixel"), 1);
      case "building": return new THREE.MeshStandardMaterial({ color: color || 0x6a7280, map: _windowsTex(o.night), emissive: new THREE.Color(o.night ? 0xffffff : 0x000000), emissiveMap: o.night ? _windowsTex(true, true) : null, emissiveIntensity: o.night ? 1.1 : 0, roughness: 0.7, metalness: 0.1 });
      case "speaker":  return this._std(0xffffff, _speakerTex(), 0.6);
      case "water":    return new THREE.MeshStandardMaterial({ color: color || 0x2aa0c8, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85 });
      default:         return this._std(color || 0xcccccc, null, 0.8);
    }
  },
};

// ── Extra canvas textures used by the new worlds ──
function _cvs(n) { var c = document.createElement("canvas"); c.width = c.height = n || 256; return c; }
function _ctex(c, nearest) { var t = GFX._tex(c, nearest ? { nearest: true } : null); return t; }
function _asphaltTex() {
  if (CM._asph) return CM._asph;
  var c = _cvs(256), g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 256, 256);
  GFX._noiseFill(g, 256, 0.85, 0.25, 8, 3.3);
  for (var i = 0; i < 3000; i++) { g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.12)"; g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1); }
  return (CM._asph = _ctex(c));
}
function _pavingTex() {
  if (CM._pav) return CM._pav;
  var c = _cvs(256), g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 256, 256);
  GFX._noiseFill(g, 256, 0.92, 0.12, 6, 1.7);
  g.strokeStyle = "rgba(0,0,0,.28)"; g.lineWidth = 2;
  for (var i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
  return (CM._pav = _ctex(c));
}
function _woodTex() {
  if (CM._wood) return CM._wood;
  var c = _cvs(256), g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 256, 256);
  for (var y = 0; y < 256; y += 32) {
    g.fillStyle = "rgba(0,0,0," + (0.05 + Math.random() * 0.1) + ")"; g.fillRect(0, y, 256, 32);
    g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, y, 256, 2);
    for (var i = 0; i < 18; i++) { g.strokeStyle = "rgba(60,30,0," + (0.08 + Math.random() * 0.12) + ")"; g.beginPath(); var yy = y + 4 + Math.random() * 24; g.moveTo(0, yy); g.bezierCurveTo(80, yy + 3, 170, yy - 3, 256, yy + 1); g.stroke(); }
  }
  return (CM._wood = _ctex(c));
}
function _wallpaperTex() {
  if (CM._wp) return CM._wp;
  var c = _cvs(256), g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 256, 256);
  GFX._noiseFill(g, 256, 0.92, 0.1, 4, 6.1);
  g.strokeStyle = "rgba(120,100,20,.35)"; g.lineWidth = 2;
  for (var x = -256; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 32); g.lineTo(x, 64); g.lineTo(x + 32, 96); g.lineTo(x, 128); g.lineTo(x + 32, 160); g.lineTo(x, 192); g.lineTo(x + 32, 224); g.lineTo(x, 256); g.stroke(); }
  g.fillStyle = "rgba(90,70,10,.12)"; for (var i = 0; i < 18; i++) { g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 30, 0, 6.28); g.fill(); }   // damp stains
  return (CM._wp = _ctex(c));
}
function _ceilingTex() {
  if (CM._ceil) return CM._ceil;
  var c = _cvs(256), g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 256, 256);
  GFX._noiseFill(g, 256, 0.95, 0.08, 8, 2.4);
  for (var i = 0; i < 800; i++) { g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 1); }
  g.strokeStyle = "rgba(80,80,60,.5)"; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 253, 253);
  return (CM._ceil = _ctex(c));
}
function _speakerTex() {
  if (CM._spk) return CM._spk;
  var c = _cvs(256), g = c.getContext("2d"); g.fillStyle = "#1a1a20"; g.fillRect(0, 0, 256, 256);
  [[128, 80, 54], [128, 196, 40]].forEach(function(s) {
    var gr = g.createRadialGradient(s[0], s[1], 4, s[0], s[1], s[2]); gr.addColorStop(0, "#555"); gr.addColorStop(0.35, "#111"); gr.addColorStop(0.9, "#2a2a30"); gr.addColorStop(1, "#666");
    g.fillStyle = gr; g.beginPath(); g.arc(s[0], s[1], s[2], 0, 6.28); g.fill();
  });
  return (CM._spk = _ctex(c));
}
// Building facade: grid of windows (map) and lit windows (emissive map)
function _windowsTex(night, emissive) {
  var key = "_win" + (night ? "n" : "d") + (emissive ? "e" : "");
  if (CM[key]) return CM[key];
  var c = _cvs(256), g = c.getContext("2d"), rnd = _gfxRng(night ? 77 : 33);
  g.fillStyle = emissive ? "#000" : "#fff"; g.fillRect(0, 0, 256, 256);
  for (var y = 0; y < 8; y++) for (var x = 0; x < 4; x++) {
    var lit = rnd() < 0.45;
    if (emissive) { if (lit) { g.fillStyle = rnd() < 0.7 ? "#ffd89a" : "#bfe6ff"; g.fillRect(x * 64 + 10, y * 32 + 7, 44, 19); } }
    else { g.fillStyle = night ? "#1a2230" : (rnd() < 0.5 ? "#7fa8c8" : "#9cc2dc"); g.fillRect(x * 64 + 10, y * 32 + 7, 44, 19); g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(x * 64 + 10, y * 32 + 7, 44, 3); }
  }
  var t = _ctex(c); if (emissive) t.encoding = THREE.sRGBEncoding;
  return (CM[key] = t);
}
