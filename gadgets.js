"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── GADGETS — the course fights back ─────────────────────────────────────────
//   🍄 Bounce pads   mushrooms / trampolines / slime blocks / neon pads. Players
//                    spring 5 m up; discs rebound skywards instead of landing.
//   🌀 Updraft fans  a column of rising air (custom streak shader). Discs ride it
//                    up and sail on; players float to the top … and fall.
//   💨 Wind tunnels  hoops over the fairway with a gale blowing down the hole:
//                    a disc that flies through gets shot onwards.
//   🛢️ Barrels       hit one with a disc, slap it or slam next to it: KABOOM.
//                    The disc is launched onwards, people nearby go flying,
//                    neighbouring barrels chain-react. Back after 25 s.
//   🪿 Geese         a gaggle that honks, chases anyone who comes close, nips,
//                    and runs off with resting discs.
//   ◎  Shock rings   expanding ripple shader for slams, blasts, splashes.
// Placement uses srng() right after the items, so every client builds the same
// gadgets; explosions / honks / nips are broadcast as {t:"gad"} events.
// ══════════════════════════════════════════════════════════════════════════════
var GAD = { pads: [], fans: [], tunnels: [], barrels: [], rings: [], H: 12 };

// ── Styles per world ─────────────────────────────────────────────────────────
GAD.style = function(h) {
  var a = h.arch || "islands", th = h.theme;
  if (a === "blocks") return { pad: "slime", barrel: "tnt", fan: true };
  if (a === "bouncy") return { pad: "tramp", barrel: "gift", fan: true };
  if (a === "city") return { pad: "tramp", barrel: "drum", fan: true };
  if (a === "club") return { pad: "neon", barrel: "neon", fan: true };
  if (a === "moon") return { pad: "neon", barrel: "drum", fan: false };
  if (a === "interior") return { pad: "tramp", barrel: "drum", fan: true, few: true };
  if (a === "castle") return { pad: "mush", barrel: "keg", fan: false };
  return { pad: "mush", barrel: "keg", fan: true, geese: /funny|waterfall|village|mountains|cabbage|feet_bunnies|emote|minion|socks_basket|eerie/.test(th) };
};

// ── Build for a hole (deterministic) ─────────────────────────────────────────
GAD.clear = function() { GAD.pads = []; GAD.fans = []; GAD.tunnels = []; GAD.barrels = []; GAD.rings.forEach(function(r) { if (r.mesh.parent) r.mesh.parent.remove(r.mesh); }); GAD.rings = []; };
GAD.build = function(h, C, spawns, idx) {
  GAD.clear();
  if (!C || !C.route || C.route.length < 2) return;
  if (!mpMode && typeof SET !== "undefined" && SET.v && SET.v.gadgets === false) return;   // (multiplayer always builds them: every client must agree)
  var S = GAD.style(h), dk = { easy: 0.6, normal: 1, hard: 1.25, chaos: 1.8 }[DIFFICULTY] || 1, few = S.few ? 0.5 : 1;
  var len = LV._polyLen(C.route), k = Math.min(1.6, len / 90) * dk * few;
  var used = [{ x: C.tee.x, z: C.tee.z, r: 7 }, { x: C.basket.x, z: C.basket.z, r: 7 }];
  ENT.list.forEach(function(o) { if (o.solid) used.push({ x: o.x, z: o.z, r: (o.r || 0.6) + 1.2 }); });
  var spot = function(r, lat) {
    for (var n = 0; n < 40; n++) {
      var p = LV.pointAt(C.route, 0.14 + srng() * 0.74), side = srng() < 0.5 ? -1 : 1, off = (lat || 3) + srng() * 4;
      var x = p.x - p.dz * off * side, z = p.z + p.dx * off * side, g = C.heightAt(x, z);
      if (g < C.hazardAt(x, z).level + 0.4 || !C.inBounds(x, z) || (C.inPlay && !C.inPlay(x, z))) continue;
      if (C.ceiling !== null && C.ceiling !== undefined && g + 4 > C.ceiling) continue;
      var flat = true;
      for (var a = 0; a < 6 && flat; a++) { var ex = x + Math.cos(a * 1.05) * r, ez = z + Math.sin(a * 1.05) * r, eg = C.heightAt(ex, ez); if (Math.abs(eg - g) > 0.3) flat = false; var sp = C.supportAt(ex, ez); if (sp.solid && (sp.solid.crossing || sp.solid.mover || sp.solid.crumble)) flat = false; }
      if (!flat) continue;
      if (used.some(function(u) { return Math.hypot(u.x - x, u.z - z) < u.r + r + 1.5; })) continue;
      used.push({ x: x, z: z, r: r });
      return { x: x, z: z, y: g, yaw: Math.atan2(p.dx, p.dz) };
    }
    return null;
  };
  var n, i, p;
  n = Math.max(1, Math.round((1 + srng() * 1.6) * k));
  for (i = 0; i < n; i++) if ((p = spot(1.3, 2))) GAD._pad(C, p, S.pad);
  if (S.fan) { n = Math.round((0.4 + srng() * 1.3) * k); for (i = 0; i < n; i++) if ((p = spot(1.6, 3))) GAD._fan(C, p, S); }
  if (S.fan && srng() < 0.65 * Math.min(1.3, k)) GAD._tunnelOnRoute(C, used);
  n = Math.max(1, Math.round((1.5 + srng() * 2) * k));
  for (i = 0; i < n; i++) {
    if (!(p = spot(0.8, 1.5))) continue;
    GAD._barrel(C, p, S.barrel);
    // barrels come in clusters (chain reactions!)
    if (srng() < 0.55) { var a2 = srng() * 6.28, q = { x: p.x + Math.cos(a2) * 1.5, z: p.z + Math.sin(a2) * 1.5 }; q.y = C.heightAt(q.x, q.z); if (Math.abs(q.y - p.y) < 0.3) GAD._barrel(C, q, S.barrel); }
  }
  if (S.geese && (idx > 0 || mpMode)) { if ((p = spot(1, 4))) { n = 2 + Math.floor(srng() * 2); for (i = 0; i < n; i++) GAD._goose(C, { x: p.x + (srng() - 0.5) * 3, z: p.z + (srng() - 0.5) * 3 }, i); } }
};

// ── Bounce pads ──────────────────────────────────────────────────────────────
GAD._pad = function(C, p, kind) {
  var g = new THREE.Group(), top = new THREE.Group(), r = 1.15, hgt = 0.38;
  g.position.set(p.x, p.y, p.z); g.add(top);
  var M = function(c, o) { return ENT.mat(c, o); };
  if (kind === "mush") {
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.3, 14), M(0xf4ead6, { roughness: 0.8 })); stem.position.y = 0.15; g.add(stem);
    var cap = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0xe8352a, { roughness: 0.45 })); cap.scale.y = 0.45; cap.position.y = 0.26; top.add(cap);
    for (var s = 0; s < 7; s++) { var a = s / 7 * 6.28 + 0.3, rr = s ? 0.68 : 0, dot = new THREE.Mesh(new THREE.SphereGeometry(s ? 0.15 : 0.2, 10, 6), M(0xfff8ee, { roughness: 0.6 })); dot.scale.y = 0.35; var ph = rr / r; dot.position.set(Math.cos(a) * rr, 0.26 + 0.45 * r * Math.sqrt(Math.max(0, 1 - ph * ph)) - 0.02, Math.sin(a) * rr); top.add(dot); }
  } else if (kind === "slime") {
    var sl = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 2.1), new THREE.MeshPhysicalMaterial({ color: 0x6ee85a, roughness: 0.15, transmission: 0, transparent: true, opacity: 0.85, clearcoat: 1 })); sl.position.y = 0.35; top.add(sl);
    var core = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.42, 1.2), M(0x3ab83a, { roughness: 0.4 })); core.position.y = 0.35; top.add(core);
    hgt = 0.7;
  } else {   // trampoline / neon pad
    var neon = kind === "neon", ringM = neon ? new THREE.MeshBasicMaterial({ color: 0xff3aff }) : M(0x2a6ad8, { roughness: 0.4, metalness: 0.4 });
    var ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.11, 10, 32), ringM); ring.rotation.x = Math.PI / 2; ring.position.y = 0.32; g.add(ring);
    var mat = new THREE.Mesh(new THREE.CircleGeometry(r - 0.05, 32), neon ? new THREE.MeshBasicMaterial({ color: 0x3affea, transparent: true, opacity: 0.75 }) : M(0x1a1a24, { roughness: 0.9 })); mat.rotation.x = -Math.PI / 2; mat.position.y = 0.3; top.add(mat);
    for (var l = 0; l < 4; l++) { var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 6), M(0x888890, { metalness: 0.7, roughness: 0.3 })); leg.position.set(Math.cos(l * 1.57 + 0.78) * r, 0.16, Math.sin(l * 1.57 + 0.78) * r); g.add(leg); }
    if (neon) { var gl = new THREE.PointLight(0xff3aff, 1.2, 6); gl.position.y = 0.8; g.add(gl); }
  }
  g.traverse(function(m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.userData.noBatch = true; courseGrp.add(g);
  var solid = C.cyl({ x: p.x, z: p.z, r: kind === "slime" ? 1.25 : r * 0.92, top: p.y + hgt, bottom: p.y - 0.1, visual: false, bounce: 13.5, surf: "rubber", kind: "pad" });
  solid.gad = "pad";
  GAD.pads.push({ x: p.x, y: p.y, z: p.z, r: r, top: top, g: g, sq: 0, sqV: 0, solid: solid, kind: kind });
};
GAD._boing = function(pad, k, at) {
  pad.sqV -= 9 * (k || 1);
  AudioEngine.sfx("boing", 0.9, at || new THREE.Vector3(pad.x, pad.y, pad.z));
  if (typeof spawnParticleBurst === "function") spawnParticleBurst(new THREE.Vector3(pad.x, pad.y + 0.5, pad.z), new THREE.Color(pad.kind === "mush" ? 0xffe0d0 : pad.kind === "slime" ? 0x8aff6a : 0xff9aff), 8);
};
GAD._padAt = function(x, z) { for (var i = 0; i < GAD.pads.length; i++) { var p = GAD.pads[i]; if (Math.hypot(x - p.x, z - p.z) < p.r * 1.05) return p; } return null; };
// Disc touching the ground (stepDisc): on a pad it springs back up. Returns true when handled.
GAD.discGround = function(pos, vel) {
  if (!GAD.pads.length) return false;
  var p = GAD._padAt(pos.x, pos.z); if (!p) return false;
  var hs = Math.hypot(vel.x, vel.z);
  vel.y = Math.max(13, Math.abs(vel.y) * 0.9 + 6);
  if (hs < 4) { var a = Math.random() * 6.28; vel.x += Math.cos(a) * 3; vel.z += Math.sin(a) * 3; } else { vel.x *= 1.08; vel.z *= 1.08; }
  GAD._boing(p, 1, pos);
  if (pos === discPos && typeof CINE !== "undefined") { CINE.callout("BOING!", "gold"); CINE.shake(0.15, 0.2); }
  return true;
};

// ── Updraft fans ─────────────────────────────────────────────────────────────
GAD._airMat = null;
GAD.airMaterial = function() {
  if (GAD._airMat) return GAD._airMat;
  GAD._airMat = new THREE.ShaderMaterial({
    uniforms: { uT: GFX.time, uCol: { value: new THREE.Color(0xdff6ff) } },
    vertexShader: [
      "varying vec2 vUv; varying float vRim;",
      "void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0);",
      "  vec3 n = normalize(mat3(modelMatrix) * normal), v = normalize(cameraPosition - wp.xyz);",
      "  vRim = 1.0 - abs(dot(n, v)); gl_Position = projectionMatrix * viewMatrix * wp; }"].join("\n"),
    fragmentShader: [
      "uniform float uT; uniform vec3 uCol; varying vec2 vUv; varying float vRim;",
      "float h(float n){ return fract(sin(n * 91.345) * 47453.21); }",
      "void main(){",
      "  float x = vUv.x + vUv.y * 0.35 + uT * 0.06;          // streaks spiral as they rise",
      "  float a = 0.0;",
      "  for (int k = 0; k < 2; k++) {",
      "    float cols = k == 0 ? 22.0 : 13.0, i = floor(x * cols + float(k) * 0.5), r = h(i + float(k) * 17.0);",
      "    float f = fract(vUv.y * (1.2 + r) - uT * (0.65 + r * 0.7) + r * 9.0);",
      "    float along = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.08, 0.55, f));",
      "    float across = 1.0 - smoothstep(0.06, 0.3, abs(fract(x * cols) - 0.5));",
      "    a += along * across * (k == 0 ? 0.75 : 0.5);",
      "  }",
      "  float fade = smoothstep(0.0, 0.1, vUv.y) * (1.0 - smoothstep(0.62, 1.0, vUv.y));",
      "  a = (a * (0.45 + vRim) + 0.05 + vRim * 0.08) * fade;",
      "  if (a < 0.004) discard;",
      "  gl_FragColor = vec4(uCol, a * 0.5);",
      "}"].join("\n"),
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  return GAD._airMat;
};
GAD._fan = function(C, p, S) {
  var g = new THREE.Group(); g.position.set(p.x, p.y, p.z);
  var metal = ENT.mat(0x8a929e, { metalness: 0.75, roughness: 0.35 }), dark = ENT.mat(0x2a2e36, { metalness: 0.5, roughness: 0.5 }), hot = ENT.mat(0xffc23a, { roughness: 0.5 });
  var house = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.5, 28, 1, true), metal); house.position.y = 0.25; g.add(house);
  var rim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 8, 32), hot); rim.rotation.x = Math.PI / 2; rim.position.y = 0.5; g.add(rim);
  var floor = new THREE.Mesh(new THREE.CircleGeometry(1.45, 28), dark); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.05; g.add(floor);
  var rotor = new THREE.Group(); rotor.position.y = 0.3; g.add(rotor);
  for (var b = 0; b < 5; b++) { var bl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.36), metal); bl.position.x = 0.62; bl.rotation.x = 0.4; var piv = new THREE.Group(); piv.rotation.y = b / 5 * 6.28; piv.add(bl); rotor.add(piv); }
  rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), hot));
  for (var gr = -2; gr <= 2; gr++) { var bar = new THREE.Mesh(new THREE.BoxGeometry(2.9 * Math.sqrt(1 - Math.pow(gr / 2.6, 2)), 0.04, 0.05), dark); bar.position.set(0, 0.49, gr * 0.55); g.add(bar); }
  var col = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.35, GAD.H, 28, 1, true), GAD.airMaterial()); col.position.y = GAD.H / 2 + 0.4; col.renderOrder = 6; g.add(col);
  g.traverse(function(m) { if (m.isMesh && m !== col) { m.castShadow = true; m.receiveShadow = true; } });
  g.userData.noBatch = true; courseGrp.add(g);
  C.cyl({ x: p.x, z: p.z, r: 1.5, top: p.y + 0.5, bottom: p.y - 0.1, visual: false, kind: "fan", surf: "metal" });
  GAD.fans.push({ x: p.x, y: p.y + 0.5, z: p.z, r: 1.5, rotor: rotor, g: g, fx: 0 });
};
GAD._inFan = function(f, x, y, z, pad) { return Math.hypot(x - f.x, z - f.z) < f.r + (pad || 0) && y > f.y - 0.3 && y < f.y + GAD.H; };

// ── Wind tunnels ─────────────────────────────────────────────────────────────
GAD.TL = 9; GAD.TR = 2.1;
GAD._tunnelOnRoute = function(C, used) {
  for (var n = 0; n < 14; n++) {
    var t = 0.25 + srng() * 0.5, p = LV.pointAt(C.route, t), yaw = Math.atan2(p.dx, p.dz), g = C.heightAt(p.x, p.z), cy = g + 3.4, ok = true;
    if (g < C.hazardAt(p.x, p.z).level + 0.4 || (C.ceiling !== null && C.ceiling !== undefined && cy + GAD.TR + 0.5 > C.ceiling)) continue;
    // the tube must be clear of the ground / walls along its length, and its feet need ground under them
    for (var k = -1; k <= 1 && ok; k += 0.25) {
      var x = p.x + Math.sin(yaw) * k * GAD.TL / 2, z = p.z + Math.cos(yaw) * k * GAD.TL / 2;
      for (var w = -1; w <= 1 && ok; w++) if (C.heightAt(x + Math.cos(yaw) * w * GAD.TR, z - Math.sin(yaw) * w * GAD.TR) > cy - GAD.TR - 0.3) ok = false;
    }
    if (!ok || used.some(function(u) { return Math.hypot(u.x - p.x, u.z - p.z) < u.r + GAD.TL / 2 + 1; })) continue;
    used.push({ x: p.x, z: p.z, r: GAD.TL / 2 });
    GAD._tunnel(C, { x: p.x, y: g, z: p.z, cy: cy, yaw: yaw });
    return;
  }
};
GAD._tunnel = function(C, p) {
  var g = new THREE.Group(); g.position.set(p.x, p.cy, p.z); g.rotation.y = p.yaw;
  var metal = ENT.mat(0x8a929e, { metalness: 0.75, roughness: 0.35 }), hot = ENT.mat(0xffc23a, { roughness: 0.5 }), red = ENT.mat(0xe8402a, { roughness: 0.5 });
  [-1, 1].forEach(function(e, i) {
    var ring = new THREE.Mesh(new THREE.TorusGeometry(GAD.TR + 0.12, 0.17, 10, 36), i ? red : hot); ring.position.z = e * GAD.TL / 2; g.add(ring);
    [-1, 1].forEach(function(sd) {   // legs down to the ground (or the water) under each end
      var lx = sd * (GAD.TR + 0.1) * 0.75, lz = e * GAD.TL / 2, wx = p.x + Math.cos(p.yaw) * lx + Math.sin(p.yaw) * lz, wz = p.z - Math.sin(p.yaw) * lx + Math.cos(p.yaw) * lz;
      var gy = Math.max(C.heightAt(wx, wz), C.hazardAt(wx, wz).level - 0.3), len = Math.max(0.5, p.cy - gy + 0.2), leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, len, 8), metal);
      leg.position.set(sd * (GAD.TR + 0.1) * 0.75, -len / 2, e * GAD.TL / 2); leg.rotation.z = -sd * 0.12; g.add(leg);
    });
  });
  for (var a = 0; a < 3; a++) { var rib = new THREE.Mesh(new THREE.TorusGeometry(GAD.TR + 0.05, 0.05, 6, 32), metal); rib.position.z = (a - 1) * GAD.TL / 4; g.add(rib); }
  var air = new THREE.Mesh(new THREE.CylinderGeometry(GAD.TR, GAD.TR, GAD.TL, 28, 1, true), GAD.airMaterial()); air.rotation.x = Math.PI / 2; air.renderOrder = 6; g.add(air);   // streaks flow toward local +z (down the hole)
  var arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 3), hot); arrow.rotation.x = Math.PI / 2; arrow.position.set(0, GAD.TR + 0.55, GAD.TL / 2 - 0.4); g.add(arrow);
  g.traverse(function(m) { if (m.isMesh && m !== air) { m.castShadow = true; m.receiveShadow = true; } });
  g.userData.noBatch = true; courseGrp.add(g);
  GAD.tunnels.push({ x: p.x, y: p.cy, z: p.z, ax: Math.sin(p.yaw), az: Math.cos(p.yaw), g: g, fx: 0 });
};
// Where is (x, y, z) relative to a tunnel: along its axis and off it (null when outside)
GAD._inTunnel = function(t, x, y, z) {
  var dx = x - t.x, dz = z - t.z, along = dx * t.ax + dz * t.az;
  if (Math.abs(along) > GAD.TL / 2 + 0.3) return null;
  var side = dx * t.az - dz * t.ax, up = y - t.y;
  if (side * side + up * up > GAD.TR * GAD.TR) return null;
  return { along: along, side: side, up: up };
};
GAD._tunnelPush = function(t, q, vel, dt) {
  var va = vel.x * t.ax + vel.z * t.az;
  if (va < 42) { vel.x += t.ax * 34 * dt; vel.z += t.az * 34 * dt; }
  vel.y += 9 * dt - q.up * 3 * dt;                                   // hold it near the middle
  vel.x -= t.az * q.side * 3 * dt; vel.z += t.ax * q.side * 3 * dt;
};

// ── Explosive barrels ────────────────────────────────────────────────────────
GAD._barTex = {};
GAD._barrelTex = function(kind) {
  if (GAD._barTex[kind]) return GAD._barTex[kind];
  var c = document.createElement("canvas"); c.width = 256; c.height = kind === "tnt" || kind === "gift" ? 256 : 128; var x = c.getContext("2d");
  if (kind === "gift") {   // a party present that goes off like a confetti bomb
    x.fillStyle = "#ff4a8a"; x.fillRect(0, 0, 256, 256); x.fillStyle = "#ff7aaa"; for (var q = 0; q < 14; q++) { x.beginPath(); x.arc((q * 53) % 256, (q * 97) % 256, 14, 0, 6.28); x.fill(); }
    x.fillStyle = "#ffd23a"; x.fillRect(112, 0, 32, 256); x.fillRect(0, 112, 256, 32);
  } else if (kind === "tnt") { x.fillStyle = "#d8261e"; x.fillRect(0, 0, 256, 256); x.fillStyle = "#a81810"; for (var i = 0; i < 4; i++) x.fillRect(i * 64 + 28, 0, 8, 256); x.fillStyle = "#f4f0e8"; x.fillRect(0, 92, 256, 72); x.fillStyle = "#1a1a1a"; x.font = "900 64px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("TNT", 128, 130); }
  else if (kind === "keg") { x.fillStyle = "#8a5a2a"; x.fillRect(0, 0, 256, 128); for (var s = 0; s < 16; s++) { x.fillStyle = s % 2 ? "#7a4a22" : "#9a6432"; x.fillRect(s * 16, 0, 15, 128); } x.fillStyle = "#3a3a40"; x.fillRect(0, 14, 256, 10); x.fillRect(0, 104, 256, 10); x.fillStyle = "#e8d8b0"; x.beginPath(); x.arc(64, 64, 26, 0, 6.28); x.fill(); x.beginPath(); x.arc(192, 64, 26, 0, 6.28); x.fill(); x.fillStyle = "#c81e1e"; x.font = "900 26px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("TNT", 64, 66); x.fillText("TNT", 192, 66); }
  else { x.fillStyle = kind === "neon" ? "#2a0a3a" : "#c8281e"; x.fillRect(0, 0, 256, 128); x.fillStyle = kind === "neon" ? "#ff3aff" : "#ffd23a"; for (var j = -2; j < 12; j++) { x.beginPath(); x.moveTo(j * 24, 52); x.lineTo(j * 24 + 12, 52); x.lineTo(j * 24 + 26, 76); x.lineTo(j * 24 + 14, 76); x.fill(); } x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(0, 20, 256, 6); x.fillRect(0, 102, 256, 6); x.fillStyle = "#fff"; x.font = "900 20px sans-serif"; x.textAlign = "center"; x.fillText("⚠ BOOM ⚠", 128, 40); }
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t._dgShared = true; t.wrapS = THREE.RepeatWrapping;
  return (GAD._barTex[kind] = t);
};
GAD._barrel = function(C, p, kind) {
  var g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = srng() * 6.28;
  var side = new THREE.MeshStandardMaterial({ map: GAD._barrelTex(kind), roughness: 0.5, metalness: kind === "drum" ? 0.4 : 0.05, emissive: kind === "neon" ? new THREE.Color(0x3a0a4a) : new THREE.Color(0x000000) });
  side.userData.shared = true;
  var lid = ENT.mat(kind === "keg" ? 0x7a4a22 : kind === "tnt" ? 0xb81e18 : 0x9a1e18, { roughness: 0.5 });
  if (kind === "gift") lid = side;
  var body = kind === "tnt" || kind === "gift" ? new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), [side, side, lid, lid, side, side]) : new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.15, 20), [side, lid, lid]);
  if (kind === "keg") body.geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.1, 20);
  body.position.y = kind === "tnt" || kind === "gift" ? 0.55 : 0.58; g.add(body);
  if (kind === "gift") [-1, 1].forEach(function(sd) { var bow = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 16), ENT.mat(0xffd23a, { roughness: 0.4 })); bow.position.set(sd * 0.16, 1.18, 0); bow.rotation.y = Math.PI / 2; bow.rotation.x = sd * 0.5; g.add(bow); });
  var fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), ENT.mat(0xe8d8a0)); fuse.position.set(0.15, kind === "tnt" ? 1.25 : 1.3, 0); fuse.rotation.z = 0.4; g.add(fuse);
  var spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: GFX.softDotTexture(), color: 0xffc23a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  spark.scale.setScalar(0.35); spark.position.set(0.21, kind === "tnt" ? 1.4 : 1.45, 0); g.add(spark);
  g.traverse(function(m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.userData.noBatch = true; courseGrp.add(g);
  var solid = C.cyl({ x: p.x, z: p.z, r: 0.55, top: p.y + 1.15, bottom: p.y - 0.1, visual: false, kind: "barrel", surf: "metal" });
  GAD.barrels.push({ i: GAD.barrels.length, x: p.x, y: p.y, z: p.z, r: 0.6, h: 1.2, g: g, spark: spark, solid: solid, alive: true, back: 0, kind: kind });
};
// My disc heading into a live barrel? (bullet-time trigger)
GAD.threat = function(pos, vel) {
  var hs = Math.hypot(vel.x, vel.z); if (hs < 6) return false;
  for (var i = 0; i < GAD.barrels.length; i++) {
    var b = GAD.barrels[i]; if (!b.alive) continue;
    var rx = b.x - pos.x, rz = b.z - pos.z, along = (rx * vel.x + rz * vel.z) / hs;
    if (along < 0.3 || along > Math.min(6, hs * 0.35)) continue;
    var perp = Math.abs(rx * vel.z - rz * vel.x) / hs, dy = pos.y - b.y;
    if (perp < b.r + 0.35 && dy > -0.3 && dy < b.h + 0.4) return true;
  }
  return false;
};
GAD.explode = function(i, by, mine, dv) {
  var b = GAD.barrels[i]; if (!b || !b.alive) return;
  b.alive = false; b.back = T + 25; b.g.visible = false; b.solid.disabled = true;
  var p = new THREE.Vector3(b.x, b.y + 0.6, b.z);
  if (typeof spawnExplosion === "function") spawnExplosion(p.clone());
  if (b.kind === "gift" && typeof spawnConfetti === "function") { spawnConfetti(p.clone()); spawnConfetti(p.clone().add(new THREE.Vector3(0, 1, 0))); spawnConfetti(p.clone().add(new THREE.Vector3(0.6, 0.4, 0))); }
  GAD.ring(new THREE.Vector3(b.x, b.y + 0.05, b.z), 0xffa040, 9);
  GAD._debris(p);
  AudioEngine.sfx("kaboom", 1, p);
  if (typeof CINE !== "undefined") { CINE.shake(0.85, 0.7, p); var near = camera.position.distanceTo(p) < 28; if (near) { CINE.hitStop(0.1); CINE.punch(0.35, 1.2); } if (mine) CINE.callout("KA-BOOM!", "boom"); }
  var fl = new THREE.PointLight(0xff8a3a, 6, 18); fl.position.copy(p); courseGrp.add(fl);
  var t0 = performance.now(); (function fade() { var k = 1 - (performance.now() - t0) / 450; if (k <= 0) { courseGrp.remove(fl); return; } fl.intensity = 6 * k; requestAnimationFrame(fade); })();
  // everyone checks themselves; critters on the host
  if (typeof PU !== "undefined") { PU.blastMe(b.x, b.y + 0.8, b.z, 5, by === undefined ? -1 : by, "barrel", 17); if (!mpMode || myIdx === 0) PU.critterBlast(b.x, b.z, 7, 14); }
  GAD._blastDiscs(p, 6);
  if (typeof AudioEngine.crowd === "function" && camera.position.distanceTo(p) < 40) setTimeout(function() { AudioEngine.crowd("ooh"); }, 250);
  // the disc that set it off goes for a ride
  if (dv && mine) { discVel.fromArray(dv); }
  if (mine && mpMode) sendToAll({ t: "gad", k: "boom", i: i, by: by, dv: dv || null });
  // chain reaction (each client runs the same chain from the same first barrel)
  GAD.barrels.forEach(function(o) { if (o.alive && Math.hypot(o.x - b.x, o.z - b.z) < 4.2) setTimeout(function() { GAD.explode(o.i, by, false); }, 140 + Math.random() * 120); });
};
GAD._blastDiscs = function(p, r) {
  // a resting disc nearby gets blown away (only my own — others move theirs)
  if ((phase === "WALKING" || phase === "LANDED") && !ENT.carrying) {
    var dx = discPos.x - p.x, dz = discPos.z - p.z, d = Math.hypot(dx, dz);
    if (d < r && d > 0.01) { var C = HOLES[holeIdx].course, k = (1 - d / r) * 9; discPos.x += dx / d * k; discPos.z += dz / d * k; discPos.y = C.heightAt(discPos.x, discPos.z) + 0.06; if (C.hazardAt(discPos.x, discPos.z).level > discPos.y - 0.1) outOfBounds(false); }
  }
};
GAD._debris = function(p) {
  if (typeof _pMesh !== "function") return;
  for (var i = 0; i < 16; i++) {
    var m = _pMesh("box", i % 3 ? 0x3a2a20 : 0xff6a1a, 0.08 + Math.random() * 0.12, i % 3 === 0);
    _pAdd(m, p.clone(), new THREE.Vector3((Math.random() - 0.5) * 14, 4 + Math.random() * 9, (Math.random() - 0.5) * 14), 1.4, { grav: 14, spin: 10 });
  }
  for (var j = 0; j < 4; j++) spawnSkinParticle("smoke", p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random(), (Math.random() - 0.5) * 1.5)));
};
// Anything that blasts an area (anvil slam, explosions) sets off barrels in it
GAD.blast = function(p, r, mine) {
  GAD.barrels.forEach(function(b) { if (b.alive && Math.hypot(b.x - p.x, b.z - p.z) < r + b.r) GAD.explode(b.i, mine ? myIdx : -1, mine); });
};
// A slap / bat swing in front of me
GAD.hitNear = function(x, z, fx, fz, reach) {
  var hit = false;
  GAD.barrels.forEach(function(b) {
    if (!b.alive) return; var dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz);
    if (d < reach + b.r && (dx * fx + dz * fz) / (d || 1) > -0.2) { GAD.explode(b.i, myIdx, true); hit = true; }
  });
  return hit;
};

// ── Forces on a flying disc (stepDisc, for every simulated disc) ─────────────
GAD.discForce = function(pos, vel, dt) {
  for (var i = 0; i < GAD.fans.length; i++) {
    var f = GAD.fans[i]; if (!GAD._inFan(f, pos.x, pos.y, pos.z)) continue;
    var hk = (pos.y - f.y) / GAD.H;
    vel.y += (34 - 22 * hk) * dt;
    vel.x *= 1 - 0.25 * dt; vel.z *= 1 - 0.25 * dt;
    if (pos === discPos && !f.rode) { f.rode = true; AudioEngine.sfx("whoosh", 0.8); if (typeof CINE !== "undefined") CINE.callout("UPDRAFT!", ""); }
  }
  for (var ti = 0; ti < GAD.tunnels.length; ti++) {
    var tn = GAD.tunnels[ti], q = GAD._inTunnel(tn, pos.x, pos.y, pos.z); if (!q) continue;
    GAD._tunnelPush(tn, q, vel, dt);
    if (pos === discPos && !tn.rode) { tn.rode = true; AudioEngine.sfx("whoosh", 1); if (typeof CINE !== "undefined") { CINE.callout("WIND TUNNEL!", "hot"); CINE.boost = Math.max(CINE.boost, 0.8); CAMFX.kick(8); } }
  }
  if (pos !== discPos) return;   // barrels: only my own disc sets them off (and tells everyone)
  for (var j = 0; j < GAD.barrels.length; j++) {
    var b = GAD.barrels[j]; if (!b.alive) continue;
    var dx = pos.x - b.x, dz = pos.z - b.z, dy = pos.y - b.y;
    if (dx * dx + dz * dz < (b.r + 0.3) * (b.r + 0.3) && dy > -0.2 && dy < b.h + 0.3) {
      var hs = Math.hypot(vel.x, vel.z) || 1, out = Math.max(hs * 1.25, 17);
      var nv = [vel.x / hs * out, Math.max(vel.y, 0) + 10, vel.z / hs * out];
      vel.fromArray(nv);
      GAD.explode(j, myIdx, true, nv);
    }
  }
};
// The trajectory preview should know about updrafts (they're predictable)
GAD.previewForce = function(pos, vel, dt) {
  for (var j = 0; j < GAD.tunnels.length; j++) { var q = GAD._inTunnel(GAD.tunnels[j], pos.x, pos.y, pos.z); if (q) GAD._tunnelPush(GAD.tunnels[j], q, vel, dt); }
  for (var i = 0; i < GAD.fans.length; i++) { var f = GAD.fans[i]; if (GAD._inFan(f, pos.x, pos.y, pos.z)) { vel.y += (34 - 22 * (pos.y - f.y) / GAD.H) * dt; vel.x *= 1 - 0.25 * dt; vel.z *= 1 - 0.25 * dt; } }
};

// ── Shock rings (custom ripple shader) ───────────────────────────────────────
GAD._ringMat = function(col) {
  return new THREE.ShaderMaterial({
    uniforms: { uP: { value: 0 }, uCol: { value: new THREE.Color(col) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: [
      "uniform float uP; uniform vec3 uCol; varying vec2 vUv;",
      "void main(){",
      "  float d = length(vUv - 0.5) * 2.0, w = 0.05 + uP * 0.12;",
      "  float ring = exp(-pow((d - uP) / w, 2.0));",
      "  float inner = smoothstep(uP, 0.0, d) * 0.18 * (1.0 - uP);",
      "  float a = (ring + inner) * (1.0 - uP) * (1.0 - uP);",
      "  if (a < 0.005) discard;",
      "  gl_FragColor = vec4(uCol * (1.0 + ring), a);",
      "}"].join("\n"),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
};
GAD.ring = function(p, col, radius, dur) {
  var m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), GAD._ringMat(col || 0xffffff));
  m.rotation.x = -Math.PI / 2; m.position.copy(p); m.position.y += 0.08; m.renderOrder = 7; m.userData.noBatch = true;
  scene.add(m);
  GAD.rings.push({ mesh: m, t: 0, dur: dur || 0.55, R: radius || 5 });
};

// ── Geese ────────────────────────────────────────────────────────────────────
GAD.gooseModel = function() {
  var g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  var wh = ENT.mat(0xf6f4ee, { roughness: 0.7 }), or = ENT.mat(0xff8a1a, { roughness: 0.5 }), bk = ENT.mat(0x151515, { roughness: 0.3 }), gr = ENT.mat(0xd8d4cc, { roughness: 0.8 });
  var torso = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), wh); torso.scale.set(0.95, 0.85, 1.35); torso.position.y = 0.48; body.add(torso);
  var tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 10), wh); tail.rotation.x = -2.2; tail.position.set(0, 0.56, -0.44); body.add(tail);
  var wings = [];
  [-1, 1].forEach(function(s) {
    var piv = new THREE.Group(); piv.position.set(s * 0.26, 0.58, 0.08); body.add(piv);
    var w = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), gr); w.scale.set(0.25, 0.6, 1.25); w.position.set(s * 0.04, -0.05, -0.12); piv.add(w);
    piv.userData.s = s; wings.push(piv);
  });
  var neck = new THREE.Group(); neck.position.set(0, 0.62, 0.32); body.add(neck);
  var curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.22, 0.06), new THREE.Vector3(0, 0.42, 0.02), new THREE.Vector3(0, 0.52, 0.06)]);
  neck.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.075, 8, false), wh));
  var head = new THREE.Group(); head.position.set(0, 0.55, 0.07); neck.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), wh));
  var beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 8), or); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.02, 0.17); head.add(beak);
  [-1, 1].forEach(function(s) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), bk); e.position.set(s * 0.08, 0.03, 0.06); head.add(e); var br = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.02), bk); br.position.set(s * 0.075, 0.075, 0.07); br.rotation.z = s * 0.5; head.add(br); });   // angry eyebrows
  var legs = [];
  [-1, 1].forEach(function(s) {
    var leg = new THREE.Group(); leg.position.set(s * 0.11, 0.26, 0); g.add(leg);
    var l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 6), or); l.position.y = -0.13; leg.add(l);
    var ft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.16), or); ft.position.set(0, -0.26, 0.05); leg.add(ft);
    legs.push(leg);
  });
  g.traverse(function(m) { if (m.isMesh) m.castShadow = true; });
  g.userData.goose = { body: body, neck: neck, head: head, wings: wings, legs: legs };
  return g;
};
GAD._goose = function(C, p, i) {
  p.y = C.heightAt(p.x, p.z); if (p.y < C.hazardAt(p.x, p.z).level + 0.3) return;
  var o = ENT.add({ type: "goose", mesh: GAD.gooseModel(), x: p.x, z: p.z, y: p.y, r: 0.42, h: 1.05, speed: 1.3, update: ENT.B.goose,
    home: { x: p.x, z: p.z, R: 10 }, leash: true, canSteal: true, yaw: srng() * 6.28, angryT: 0, cool: 2 + i, nipCD: 0, phase: i * 1.3 });
  obstacles = ENT.list;
  return o;
};
// Host-side brain: wander → spot someone → HONK → charge and nip → waddle off
ENT.B.goose = function(o, dt) {
  if (o.state === "carry" || o.state === "steal") { o.angryT = 0; return ENT.B.thief(o, dt); }
  o.cool -= dt; o.nipCD -= dt;
  var tg = ENT.target(o);
  if (o.angryT > 0) {
    o.angryT -= dt;
    var dx = tg.x - o.x, dz = tg.z - o.z, d = Math.hypot(dx, dz) || 1, sp = 3.6 * dt;
    if (d > 0.9) { if (ENT.step(o, dx / d * sp, dz / d * sp, 0.8)) ENT.face(o, dx, dz, dt, 10); else o.angryT = 0; }
    o.moving = true; o.run = 2;
    if (d < 1.15 && o.nipCD <= 0) { o.nipCD = 1.1; GAD.nip(o, tg, dx / d, dz / d); }
    if (Math.hypot(o.x - o.home.x, o.z - o.home.z) > o.home.R + 8) o.angryT = 0;   // don't chase forever
    return;
  }
  if (tg.d < 5.5 && o.cool <= 0 && phase !== "MENU") { o.angryT = 3.2; o.cool = 6 + Math.random() * 4; GAD.honk(o, true); return; }
  ENT.B.wander(o, dt);
};
GAD.honk = function(o, send) {
  AudioEngine.sfx("goose", 1, new THREE.Vector3(o.x, o.y + 1, o.z));
  o.honkT = 0.5;
  if (typeof _spawnBonkText === "function" && camera.position.distanceTo(new THREE.Vector3(o.x, o.y, o.z)) < 30) _spawnBonkText(new THREE.Vector3(o.x, o.y + 1.5, o.z), "HONK!");
  if (send && mpMode && myIdx === 0) sendToAll({ t: "gad", k: "honk", i: ENT.list.indexOf(o) });
};
GAD.nip = function(o, tg, nx, nz) {
  GAD.honk(o, true);
  if (tg.local) { if (phase === "WALKING") { PL.knock(nx, nz, 5.5, 3.5); AudioEngine.sfx("bonk", 0.6); } }
  else if (mpMode) remotePlayers.forEach(function(rp, i) { if (rp && rp.body && Math.abs(rp.body.x - tg.x) < 0.01 && Math.abs(rp.body.z - tg.z) < 0.01) sendToAll({ t: "gad", k: "nip", tg: i, dx: +nx.toFixed(2), dz: +nz.toFixed(2) }); });
};
// Every client: waddle, neck bob, flapping wings — from how the goose is actually moving
GAD._animGoose = function(o, dt) {
  var G = o.mesh.userData.goose; if (!G) return;
  var sp = o._gx === undefined ? 0 : Math.hypot(o.x - o._gx, o.z - o._gz) / Math.max(dt, 1e-3); o._gx = o.x; o._gz = o.z;
  o._gs = (o._gs || 0) + (Math.min(sp, 6) - (o._gs || 0)) * Math.min(1, dt * 8);
  var angry = o._gs > 2.4 || (o.honkT || 0) > 0 || o.state === "steal" || o.state === "carry";
  o.honkT = (o.honkT || 0) - dt;
  o._gt = (o._gt || 0) + dt * (2 + o._gs * 3.2);
  var w = o._gs > 0.2 ? Math.sin(o._gt * 2) : 0;
  G.body.rotation.z = w * 0.16; G.body.position.y = Math.abs(w) * 0.04;
  G.legs[0].rotation.x = w * 0.7; G.legs[1].rotation.x = -w * 0.7;
  var lean = angry ? 1 : 0; o._lean = (o._lean || 0) + (lean - (o._lean || 0)) * Math.min(1, dt * 8);
  G.neck.rotation.x = o._lean * 1.0 + Math.sin(o._gt * 4) * 0.08 * (o._gs > 0.2 ? 1 : 0);   // neck out low when charging
  G.head.rotation.x = -o._lean * 0.9 + ((o.honkT || 0) > 0 ? Math.sin(T * 40) * 0.25 : 0);
  var flap = angry ? 0.6 + Math.sin(T * 26) * 0.6 : 0.05;
  G.wings.forEach(function(wg) { wg.rotation.z = wg.userData.s * flap; });
};

// ── per frame ────────────────────────────────────────────────────────────────
GAD.update = function(dt) {
  var t = GFX.time.value;
  GAD.pads.forEach(function(p) {
    // players springing off it (they bounce in player.js)
    if (phase === "WALKING" && Math.hypot(PL.pos.x - p.x, PL.pos.z - p.z) < p.r && PL.vel.y > 9 && !p._pl) { p._pl = true; GAD._boing(p, 1); }
    if (PL.vel.y < 2) p._pl = false;
    p.sqV += (-p.sq * 320 - p.sqV * 14) * dt; p.sq += p.sqV * dt;
    p.top.scale.set(1 - p.sq * 0.5, 1 + p.sq * 1.4, 1 - p.sq * 0.5);
  });
  GAD.fans.forEach(function(f) {
    f.rotor.rotation.y += dt * 14;
    if ((f.fx += dt) > 0.12 && camera.position.distanceTo(f.g.position) < 50) {   // leaves / dust riding the air
      f.fx = 0;
      var a = Math.random() * 6.28, rr = Math.random() * f.r * 0.9, m = _pMesh("box", 0xf4f8ff, 0.05 + Math.random() * 0.05, true);
      _pAdd(m, new THREE.Vector3(f.x + Math.cos(a) * rr, f.y + 0.2, f.z + Math.sin(a) * rr), new THREE.Vector3(0, 7 + Math.random() * 4, 0), 1.3, { grav: -1.5, spin: 6, drag: 0.3 });
    }
    if (phase !== "FLYING") f.rode = false;
    // players float up the column
    if (phase === "WALKING" && GAD._inFan(f, PL.pos.x, PL.pos.y, PL.pos.z, -0.2) && !(typeof RAG !== "undefined" && RAG.busy())) {
      var hk = (PL.pos.y - f.y) / GAD.H;
      PL.vel.y = Math.min(PL.vel.y + (hk < 0.7 ? 46 : 22) * dt, 8.5); PL.onGround = false;
      if (!f._pl) { f._pl = true; AudioEngine.sfx("whoosh", 0.7); }
    } else f._pl = false;
  });
  GAD.tunnels.forEach(function(tn) {
    if (phase !== "FLYING") tn.rode = false;
    var q = phase === "WALKING" && !(typeof RAG !== "undefined" && RAG.busy()) ? GAD._inTunnel(tn, PL.pos.x, PL.pos.y + 0.9, PL.pos.z) : null;
    if (q) {
      var va = PL.vel.x * tn.ax + PL.vel.z * tn.az;
      if (va < 16) { PL.vel.x += tn.ax * 40 * dt; PL.vel.z += tn.az * 40 * dt; }
      PL.vel.y = Math.max(PL.vel.y, 1.5); PL.onGround = false;
      if (!tn._pl) { tn._pl = true; AudioEngine.sfx("whoosh", 0.8); }
    } else tn._pl = false;
    if ((tn.fx += dt) > 0.1 && camera.position.distanceTo(tn.g.position) < 50) {
      tn.fx = 0;
      var a = Math.random() * 6.28, rr = Math.random() * GAD.TR * 0.8, m = _pMesh("box", 0xf4f8ff, 0.05 + Math.random() * 0.04, true);
      var px = tn.x - tn.ax * GAD.TL / 2 + tn.az * Math.cos(a) * rr, pz = tn.z - tn.az * GAD.TL / 2 - tn.ax * Math.cos(a) * rr;
      _pAdd(m, new THREE.Vector3(px, tn.y + Math.sin(a) * rr, pz), new THREE.Vector3(tn.ax * 16, 0, tn.az * 16), 0.9, { grav: 0, spin: 8 });
    }
  });
  GAD.barrels.forEach(function(b) {
    if (b.alive) { b.spark.material.opacity = 0.6 + Math.random() * 0.4; b.spark.scale.setScalar(0.25 + Math.random() * 0.2); }
    else if (T > b.back) { b.alive = true; b.g.visible = true; b.solid.disabled = false; b.g.scale.setScalar(0.01); spawnParticleBurst(new THREE.Vector3(b.x, b.y + 0.6, b.z), new THREE.Color(0xffffff), 10); }
    if (b.alive && b.g.scale.x < 1) b.g.scale.setScalar(Math.min(1, b.g.scale.x + dt * 3));
  });
  ENT.list.forEach(function(o) { if (o.type === "goose") GAD._animGoose(o, dt); });
  for (var i = GAD.rings.length - 1; i >= 0; i--) {
    var r = GAD.rings[i]; r.t += dt; var k = r.t / r.dur;
    if (k >= 1) { scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); GAD.rings.splice(i, 1); continue; }
    r.mesh.material.uniforms.uP.value = 1 - Math.pow(1 - k, 2.2);
    r.mesh.scale.setScalar(r.R);
  }
};

// ── network ──────────────────────────────────────────────────────────────────
GAD.onNet = function(m) {
  if (m.k === "boom") { GAD.explode(m.i, m.by, false); var rp = remotePlayers[m.from]; if (rp && rp.flying && m.dv) rp.discVel.fromArray(m.dv); }
  else if (m.k === "honk") { var o = ENT.list[m.i]; if (o && o.type === "goose") GAD.honk(o, false); }
  else if (m.k === "nip") { if (m.tg === myIdx && phase === "WALKING") { PL.knock(m.dx, m.dz, 5.5, 3.5); AudioEngine.sfx("bonk", 0.6); } }
};
