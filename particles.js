"use strict";

// ══════════════════════════════════════════════════════════
// ── PARTICLE SYSTEM ──
// Pooled meshes with shared geometry (no per-particle GPU allocations),
// glowing ribbon trail for the disc, explosion effects.
// ══════════════════════════════════════════════════════════

var particles = []; // {mesh, vel, life, maxLife, grav, drag, spin, shrink}
var MAX_PARTICLES = 700;
var _pGeo = {}, _pPool = { sph: [], box: [], oct: [], heart: [], note: [], cube: [], ring: [] };
function _pGeometry(kind) {
  if (!_pGeo[kind]) {
    if (kind === "heart") {
      var hs = new THREE.Shape(); hs.moveTo(0, -1); hs.bezierCurveTo(-0.2, -0.7, -1.2, -0.3, -1.1, 0.35); hs.bezierCurveTo(-1, 0.95, -0.3, 1.05, 0, 0.55);
      hs.bezierCurveTo(0.3, 1.05, 1, 0.95, 1.1, 0.35); hs.bezierCurveTo(1.2, -0.3, 0.2, -0.7, 0, -1);
      _pGeo[kind] = new THREE.ExtrudeGeometry(hs, { depth: 0.3, bevelEnabled: false, curveSegments: 6 });
    } else if (kind === "note") {
      var a = new THREE.SphereGeometry(0.45, 8, 6); a.scale(1.2, 0.85, 0.6);
      var st = new THREE.BoxGeometry(0.14, 1.5, 0.14); st.translate(0.45, 0.75, 0);
      var fl = new THREE.BoxGeometry(0.5, 0.16, 0.14); fl.translate(0.68, 1.42, 0);
      _pGeo[kind] = GFX.mergeGeometries([a, st, fl]);
    } else if (kind === "ring") _pGeo[kind] = new THREE.TorusGeometry(1, 0.18, 6, 16);
    else _pGeo[kind] = kind === "box" ? new THREE.BoxGeometry(1, 0.35, 1)
                : kind === "cube" ? new THREE.BoxGeometry(1, 1, 1)
                : kind === "oct" ? new THREE.OctahedronGeometry(1, 0)
                : new THREE.SphereGeometry(1, 6, 5);
  }
  return _pGeo[kind];
}
// Get a pooled particle mesh. color: hex or THREE.Color.
function _pMesh(kind, color, size, additive) {
  if (particles.length >= MAX_PARTICLES) _pKill(0);
  var m = _pPool[kind].pop();
  if (!m) {
    m = new THREE.Mesh(_pGeometry(kind), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    m.frustumCulled = false; m.userData.kind = kind;
  }
  m.material.color.set(color);
  m.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  m.material.opacity = 1;
  m.scale.setScalar(size);
  m.rotation.set(Math.random() * 6.28, Math.random() * 6.28, 0);
  m.visible = true;
  if (m.parent !== scene) scene.add(m);
  return m;
}
function _pAdd(m, pos, vel, life, opts) {
  opts = opts || {};
  m.position.copy(pos);
  particles.push({ mesh: m, vel: vel, life: life, maxLife: life, grav: opts.grav !== undefined ? opts.grav : 9,
    drag: opts.drag || 0, spin: opts.spin || 0, shrink: !!opts.shrink, base: m.scale.x });
}
function _pKill(i) {
  var p = particles[i];
  p.mesh.visible = false;
  _pPool[p.mesh.userData.kind].push(p.mesh);
  particles.splice(i, 1);
}

function spawnParticleBurst(pos, color, count) {
  for (let i = 0; i < count; i++) {
    var m = _pMesh("sph", color, 0.06 + Math.random() * 0.05, false);
    _pAdd(m, pos, new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4 + 2, (Math.random() - 0.5) * 6), 1.0, { shrink: true });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt * 1.5;
    if (p.life <= 0) { _pKill(i); continue; }
    p.vel.y -= p.grav * dt;
    if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.spin) { p.mesh.rotation.x += p.spin * dt; p.mesh.rotation.y += p.spin * 0.7 * dt; }
    var k = Math.max(0, Math.min(1, p.life / Math.max(0.001, p.maxLife)));
    p.mesh.material.opacity = Math.min(1, k * 1.6);
    if (p.shrink) p.mesh.scale.setScalar(p.base * (0.35 + 0.65 * k));
  }
}

// ── Explosion (Vilov Special & hazards) ──
function spawnExplosion(pos) {
  spawnParticleBurst(pos, new THREE.Color(0xcc0000), 30);
  spawnParticleBurst(pos, new THREE.Color(0xffffff), 15);
  spawnParticleBurst(pos, new THREE.Color(0x00aa44), 20);
  for (var i = 0; i < 18; i++) {
    var m = _pMesh("sph", 0xff8a20, 0.25 + Math.random() * 0.3, true);
    _pAdd(m, pos, new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 6, (Math.random() - 0.5) * 9), 0.7, { grav: 2, drag: 2.5, shrink: true });
  }
  if (typeof _screenShake !== "undefined") { _screenShake = 0.5; _screenShakeT = 0.5; }
  AudioEngine.sfx("boom");
}

// ── Vilov explosion: push nearby obstacles outward ──
function vilovExplosionPush() {
  const blastR = 8, blastF = 5;
  obstacles.forEach((o) => {
    const dx = o.x - discPos.x, dz = o.z - discPos.z, dist = Math.hypot(dx, dz);
    if (dist < blastR && dist > 0.1) {
      const push = ((blastR - dist) / blastR) * blastF;
      o.startX += (dx / dist) * push;
      o.x = o.startX;
      o.startZ += (dz / dist) * push;
      o.z = o.startZ;
      if (o.mesh) o.mesh.position.set(o.x, o.startY, o.z);
    }
  });
}

// ══════════════════════════════════════════════════════════
// ── DISC TRAIL — camera-facing ribbon that fades and tapers ──
// ══════════════════════════════════════════════════════════
const TRAIL_LENGTH = 48;
var trailPositions = [];
var trailMesh = null;
var trailGeometry = null;
var _trailCam = new THREE.Vector3(), _trailT = new THREE.Vector3(), _trailS = new THREE.Vector3(), _trailV = new THREE.Vector3();

function initTrail() {
  if (trailMesh) { scene.remove(trailMesh); trailGeometry.dispose(); }
  trailPositions = [];
  trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_LENGTH * 2 * 3), 3));
  var al = new Float32Array(TRAIL_LENGTH * 2);
  for (var i = 0; i < TRAIL_LENGTH; i++) { var a = Math.pow(1 - i / TRAIL_LENGTH, 1.6); al[i * 2] = a; al[i * 2 + 1] = a; }
  trailGeometry.setAttribute("alpha", new THREE.BufferAttribute(al, 1));
  var idx = [];
  for (var j = 0; j < TRAIL_LENGTH - 1; j++) { var A = j * 2; idx.push(A, A + 1, A + 2, A + 1, A + 3, A + 2); }
  trailGeometry.setIndex(idx);
  const trailMat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(0xffffff) }, opacity: { value: 0.75 } },
    vertexShader: "attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 color; uniform float opacity; varying float vA; void main(){ gl_FragColor = vec4(color, vA * opacity); gl_FragColor = linearToOutputTexel(gl_FragColor); }",
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  trailMesh = new THREE.Mesh(trailGeometry, trailMat);
  trailMesh.frustumCulled = false;
  trailMesh.visible = false;
  trailMesh.renderOrder = 3;
  scene.add(trailMesh);
}

function updateTrail(pos, isFlying) {
  if (!trailMesh) return;
  if (!isFlying) {
    trailMesh.visible = false;
    trailPositions = [];
    return;
  }
  trailMesh.visible = true;
  // trail colour follows the disc skin
  var _tc = (typeof discMesh !== "undefined" && discMesh && discMesh.userData.trail) || 0xffffff;
  if (_tc === "rainbow") trailMesh.material.uniforms.color.value.setHSL((performance.now() * 0.0004) % 1, 1, 0.6);
  else trailMesh.material.uniforms.color.value.setHex(_tc);
  if (trailPositions.length === 0 || trailPositions[0].distanceToSquared(pos) > 0.0025) {
    trailPositions.unshift(pos.clone());
    if (trailPositions.length > TRAIL_LENGTH) trailPositions.pop();
  }
  if (trailPositions.length < 2) return;
  const P = trailGeometry.attributes.position.array;
  _trailCam.copy(camera.position);
  var W = 0.16;
  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const p = trailPositions[Math.min(i, trailPositions.length - 1)];
    const q = trailPositions[Math.min(i + 1, trailPositions.length - 1)];
    const r = trailPositions[Math.min(Math.max(i - 1, 0), trailPositions.length - 1)];
    _trailT.copy(r).sub(q);
    if (_trailT.lengthSq() < 1e-8) _trailT.set(1, 0, 0);
    _trailV.copy(_trailCam).sub(p);
    _trailS.crossVectors(_trailT, _trailV).normalize().multiplyScalar(W * (1 - i / TRAIL_LENGTH));
    P[i * 6]     = p.x + _trailS.x; P[i * 6 + 1] = p.y + _trailS.y; P[i * 6 + 2] = p.z + _trailS.z;
    P[i * 6 + 3] = p.x - _trailS.x; P[i * 6 + 4] = p.y - _trailS.y; P[i * 6 + 5] = p.z - _trailS.z;
  }
  trailGeometry.attributes.position.needsUpdate = true;
  var n = Math.min(trailPositions.length, TRAIL_LENGTH) - 1;
  trailGeometry.setDrawRange(0, Math.max(0, n) * 6);
  const d = DISCS[selectedDisc];
  if (d) trailMesh.material.uniforms.color.value.set(d.color);
}

// ═══════════════════════════════════════════════════════════════════════
// ── IMPACT SOUNDS & PARTICLES ────────────────────────────────────────
// Velocity-scaled feedback for every disc collision type.
// Uses WebAudio API directly (no Tone.js dependency).
// ═══════════════════════════════════════════════════════════════════════

// ── IMPACT SOUNDS ────────────────────────────────────────────────────
// Thin wrapper: all sound design lives in audio.js (AudioEngine.sfx / stinger).
var ImpactAudio = {
  play: function(type, intensity) {
    intensity = Math.max(0.05, Math.min(1.0, intensity || 0.5));
    if (type === "ace") { AudioEngine.stinger("ace"); return; }
    AudioEngine.sfx(type, intensity);
  }
};

// ── IMPACT PARTICLE TYPES ────────────────────────────────────────────
function spawnDust(pos, intensity) {
  intensity = intensity || 0.5;
  var count = Math.ceil(6 + intensity * 14);
  for (var i = 0; i < count; i++) {
    var m = _pMesh("sph", 0xc8aa88, 0.05 + Math.random() * 0.08, false);
    var angle = Math.random() * Math.PI * 2, upv = Math.random() * 1.5 + 0.3;
    _pAdd(m, pos, new THREE.Vector3(Math.cos(angle) * intensity * 2.5, upv, Math.sin(angle) * intensity * 2.5), 0.7 + Math.random() * 0.4, { grav: 2.5, drag: 1.5 });
  }
}

function spawnSparks(pos, intensity) {
  intensity = intensity || 0.5;
  var count = Math.ceil(4 + intensity * 10);
  for (var i = 0; i < count; i++) {
    var m = _pMesh("sph", new THREE.Color().setHSL(0.1, 1, 0.7 + Math.random() * 0.3), 0.03, true);
    var spd = intensity * 5 + Math.random() * 3;
    _pAdd(m, pos, new THREE.Vector3((Math.random() - 0.5) * spd, Math.random() * spd * 0.8 + 0.5, (Math.random() - 0.5) * spd), 0.3 + Math.random() * 0.3);
  }
}

function spawnLeaves(pos, intensity) {
  intensity = intensity || 0.5;
  var leafCols = [0x228822, 0x448844, 0x336633, 0xaacc22];
  for (var i = 0; i < Math.ceil(5 + intensity * 8); i++) {
    var m = _pMesh("box", leafCols[Math.floor(Math.random() * leafCols.length)], 0.08 + Math.random() * 0.05, false);
    _pAdd(m, pos, new THREE.Vector3((Math.random() - 0.5) * 3 * intensity, Math.random() * 2.5 + 0.5, (Math.random() - 0.5) * 3 * intensity), 0.9 + Math.random() * 0.6, { grav: 2.0, drag: 1.2, spin: 6 });
  }
}

function spawnWaterSplash(pos, intensity) {
  intensity = intensity || 0.5;
  for (var i = 0; i < Math.ceil(10 + intensity * 20); i++) {
    var m = _pMesh("sph", 0xd8f0ff, 0.05 + Math.random() * 0.08, false);
    var angle = Math.random() * Math.PI * 2, r = Math.random() * intensity * 3;
    _pAdd(m, pos, new THREE.Vector3(Math.cos(angle) * r, Math.random() * intensity * 5 + 2, Math.sin(angle) * r), 0.6 + Math.random() * 0.4, { shrink: true });
  }
}

function spawnConfetti(pos) {
  var cols = [0xff3a3a, 0x3aff6a, 0x3a7aff, 0xffe03a, 0xff3aff, 0x3affff, 0xff8a1a];
  for (var i = 0; i < 60; i++) {
    var m = _pMesh("box", cols[i % cols.length], 0.1, false);
    _pAdd(m, pos, new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6 + 3, (Math.random() - 0.5) * 8), 1.4 + Math.random() * 0.8, { grav: 3.5, drag: 1.6, spin: 9 });
  }
}

// ── SKIN PARTICLE TRAILS ─────────────────────────────────────────────
function spawnSkinParticle(type, pos) {
  var m, vel, life, o = {};
  var R = Math.random;
  switch (type) {
    case "fire": case "smoke":
      m = _pMesh("sph", type === "fire" ? new THREE.Color(0xff4400).lerp(new THREE.Color(0xffaa00), R()) : 0x445544, 0.05 + R() * 0.06, type === "fire");
      vel = new THREE.Vector3((R() - 0.5) * 0.8, R() * 1.2 + 0.3, (R() - 0.5) * 0.8); life = 0.4 + R() * 0.3; o.grav = -1; o.shrink = true; break;
    case "ice":
      m = _pMesh("oct", 0x88eeff, 0.05 + R() * 0.04, true);
      vel = new THREE.Vector3((R() - 0.5) * 1.5, (R() - 0.5) * 1.5, (R() - 0.5) * 1.5); life = 0.5 + R() * 0.4; o.grav = 1; o.spin = 5; break;
    case "toxic":
      m = _pMesh("sph", new THREE.Color().setHSL(0.3 + R() * 0.1, 1, 0.5), 0.06 + R() * 0.05, true);
      vel = new THREE.Vector3((R() - 0.5) * 1.2, R() * 0.8 + 0.2, (R() - 0.5) * 1.2); life = 0.6 + R() * 0.5; o.grav = -0.5; break;
    case "glow": case "holo":
      m = _pMesh("sph", new THREE.Color().setHSL(type === "holo" ? R() : 0.88, 1, 0.7), 0.04 + R() * 0.04, true);
      vel = new THREE.Vector3((R() - 0.5) * 2, (R() - 0.5) * 2, (R() - 0.5) * 2); life = 0.25 + R() * 0.25; o.grav = 0; break;
    case "sparks":
      m = _pMesh("sph", new THREE.Color().setHSL(0.12 + R() * 0.06, 1, 0.7), 0.03, true);
      vel = new THREE.Vector3((R() - 0.5) * 3, R() * 2, (R() - 0.5) * 3); life = 0.2 + R() * 0.2; break;
    case "stars":
      m = _pMesh("oct", new THREE.Color().setHSL(0.75 + R() * 0.15, 0.8, 0.8), 0.05, true);
      vel = new THREE.Vector3((R() - 0.5) * 1.8, (R() - 0.5) * 1.8, (R() - 0.5) * 1.8); life = 0.6 + R() * 0.6; o.grav = 0; o.spin = 4; break;
    case "rainbow":
      m = _pMesh("sph", new THREE.Color().setHSL(R(), 1, 0.6), 0.04 + R() * 0.05, true);
      vel = new THREE.Vector3((R() - 0.5) * 2.5, (R() - 0.5) * 2.5, (R() - 0.5) * 2.5); life = 0.3 + R() * 0.4; o.grav = 0; break;
    case "food":
      m = _pMesh("box", new THREE.Color().setHSL(R() * 0.15, 1, 0.6), 0.08, false);
      vel = new THREE.Vector3((R() - 0.5) * 2, R() * 1.5 + 0.5, (R() - 0.5) * 2); life = 0.5 + R() * 0.3; o.spin = 8; break;
    case "hearts":
      m = _pMesh("heart", new THREE.Color().setHSL(0.93 + R() * 0.06, 1, 0.62), 0.07 + R() * 0.04, true);
      vel = new THREE.Vector3((R() - 0.5) * 0.8, R() * 1.4 + 0.6, (R() - 0.5) * 0.8); life = 0.8 + R() * 0.5; o.grav = -0.6; o.shrink = true; break;
    case "petals":
      m = _pMesh("box", new THREE.Color().setHSL(0.92 + R() * 0.05, 0.8, 0.8), 0.07, false);
      vel = new THREE.Vector3((R() - 0.5) * 1.2, R() * 0.6, (R() - 0.5) * 1.2); life = 1 + R() * 0.8; o.grav = 0.6; o.spin = 6; break;
    case "bubbles":
      m = _pMesh("ring", new THREE.Color(0xbfeaff), 0.05 + R() * 0.05, true);
      vel = new THREE.Vector3((R() - 0.5) * 0.5, R() * 1.0 + 0.6, (R() - 0.5) * 0.5); life = 0.8 + R() * 0.6; o.grav = -0.4; break;
    case "notes":
      m = _pMesh("note", new THREE.Color().setHSL(R(), 0.9, 0.65), 0.09, true);
      vel = new THREE.Vector3((R() - 0.5) * 0.9, R() * 1.2 + 0.6, (R() - 0.5) * 0.9); life = 0.9 + R() * 0.5; o.grav = -0.3; break;
    case "pixels":
      m = _pMesh("cube", ["#3aff8a", "#3af0ff", "#ff3af0", "#ffd23a"][Math.floor(R() * 4)], 0.06, true);
      vel = new THREE.Vector3((R() - 0.5) * 1.6, R() * 1.2, (R() - 0.5) * 1.6); life = 0.4 + R() * 0.4; o.grav = 1; break;
    case "snow":
      m = _pMesh("oct", 0xf4faff, 0.035 + R() * 0.03, true);
      vel = new THREE.Vector3((R() - 0.5) * 0.8, R() * 0.4, (R() - 0.5) * 0.8); life = 1 + R() * 0.6; o.grav = 0.5; o.spin = 3; break;
    case "confetti":
      m = _pMesh("box", new THREE.Color().setHSL(R(), 1, 0.65), 0.1, false);
      vel = new THREE.Vector3((R() - 0.5) * 4, R() * 3 + 1, (R() - 0.5) * 4); life = 0.8 + R() * 0.7; o.spin = 9; o.grav = 4; break;
    default: return;
  }
  _pAdd(m, pos, vel, life, o);
}

// ── MASTER IMPACT HANDLER ────────────────────────────────────────────
// Called from physics and game events with the impact context.
// velocity: THREE.Vector3 of disc velocity at impact
// type: "terrain"|"basket"|"tree"|"water"|"metal"|"crater"|"wall"
function handleImpact(type, pos, velocity) {
  var speed     = velocity ? velocity.length() : 3;
  var intensity = Math.max(0.05, Math.min(1.0, speed / 20));

  ImpactAudio.play(type, intensity);

  switch (type) {
    case "terrain":
      spawnDust(pos, intensity);
      if (intensity > 0.6) spawnSparks(pos, intensity * 0.4);
      break;
    case "basket":
      spawnParticleBurst(pos, new THREE.Color(0xffcc44), Math.ceil(8 + intensity*12));
      if (speed < 3) spawnConfetti(pos); // gentle putts get confetti
      break;
    case "tree":
      spawnLeaves(pos, intensity);
      spawnDust(pos, intensity * 0.3);
      break;
    case "water":
      spawnWaterSplash(pos, intensity);
      break;
    case "metal":
      spawnSparks(pos, intensity);
      break;
    case "crater":
    case "lava":
      spawnParticleBurst(pos, new THREE.Color(0xff4400), Math.ceil(10+intensity*15));
      spawnSparks(pos, intensity);
      break;
    case "wall":
      spawnDust(pos, intensity * 0.5);
      spawnSparks(pos, intensity * 0.3);
      break;
  }
}

// ── ACE CELEBRATION ──────────────────────────────────────────────────
function celebrateAce(pos) {
  ImpactAudio.play("ace", 1.0);
  spawnConfetti(pos);
  spawnParticleBurst(pos, new THREE.Color(0xffd700), 50);
  spawnParticleBurst(pos, new THREE.Color(0xffffff), 30);
}
