"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── PLAYER CONTROLLER ────────────────────────────────────────────────────────
// After a throw the disc stays where it landed and you walk / run / jump to it.
//   WASD / left stick  move (camera-relative)      Shift  sprint
//   Space / ⤒ button   jump                         drag   orbit camera
// Reaching the disc picks it up and puts you on the lie, ready to throw.
// All collision runs against Course.heightAt(), so the same rules apply to
// every world: ledges higher than a step block you, gaps must be jumped,
// water / lava / void respawn you at the last safe spot.
// ══════════════════════════════════════════════════════════════════════════════
var PL = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  yaw: 0,
  onGround: true,
  camYaw: 0, camPitch: 0.3, camDist: 6.2,
  coyote: 0, jumpBuf: 0,
  safe: new THREE.Vector3(), safeT: 0,
  anim: "idle", animT: 0,
  stepAcc: 0,
  respawnT: 0,
  lockMove: false,
  lastCamInput: -10,
  airT: 0,

  WALK: 4.6, RUN: 7.6, JUMP: 7.4, GRAV: 21, STEP: 0.55, RADIUS: 0.32, HEIGHT: 1.75,

  course: function() { var h = HOLES[holeIdx]; return h && h.course; },

  reset: function(x, y, z, yaw) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0);
    this.yaw = yaw || 0; this.onGround = true; this.respawnT = 0; this.airT = 0;
    this.safe.set(x, y, z);
    this.camYaw = this.yaw;
  },

  // Movement intent in world space from keyboard / joystick, relative to the camera
  _input: function() {
    var f = 0, r = 0;
    if (keys.w || keys.W) f += 1;
    if (keys.s || keys.S) f -= 1;
    if (keys.d || keys.D) r += 1;
    if (keys.a || keys.A) r -= 1;
    var mag = Math.min(1, Math.hypot(f, r)), run = !!keys.Shift;
    if (PL.stick.active) { f = -PL.stick.y; r = PL.stick.x; mag = Math.min(1, Math.hypot(f, r)); run = mag > 0.85; }
    if (mag < 0.08) return { x: 0, z: 0, mag: 0, run: false };
    var l = Math.hypot(f, r) || 1; f /= l; r /= l;
    var cy = this.camYaw;
    // camera forward on the ground plane: (sin cy, -cos cy); right: (cos cy, sin cy)
    return { x: Math.sin(cy) * f + Math.cos(cy) * r, z: -Math.cos(cy) * f + Math.sin(cy) * r, mag: mag, run: run };
  },
  anyMoveInput: function() {
    return !!(keys.w || keys.W || keys.a || keys.A || keys.s || keys.S || keys.d || keys.D || (PL.stick.active && Math.hypot(PL.stick.x, PL.stick.y) > 0.2));
  },

  _blocked: function(c, x, z, feet, air) {
    var g = c.heightAt(x, z);
    var lim = air ? feet + 0.38 : feet + this.STEP;
    if (g > lim) return true;
    if (c.ceiling !== null && c.ceiling !== undefined && g > c.ceiling - this.HEIGHT) return true;
    return false;
  },

  // Try to move horizontally by (dx, dz) with body-radius probes and wall sliding
  _move: function(c, dx, dz) {
    var p = this.pos, air = !this.onGround, len = Math.hypot(dx, dz);
    if (len < 1e-6) return;
    var ux = dx / len, uz = dz / len, R = this.RADIUS;
    var self = this;
    function ok(nx, nz) {
      if (self._blocked(c, nx, nz, p.y, air)) return false;
      if (self._blocked(c, nx + ux * R, nz + uz * R, p.y, air)) return false;
      // shoulders (stop clipping into wall corners)
      if (self._blocked(c, nx + (ux * 0.7 - uz * 0.7) * R, nz + (uz * 0.7 + ux * 0.7) * R, p.y, air)) return false;
      if (self._blocked(c, nx + (ux * 0.7 + uz * 0.7) * R, nz + (uz * 0.7 - ux * 0.7) * R, p.y, air)) return false;
      if (!c.inBounds(nx, nz)) return false;
      return true;
    }
    if (ok(p.x + dx, p.z + dz)) { p.x += dx; p.z += dz; return; }
    if (dx && ok(p.x + dx, p.z)) { p.x += dx; this.vel.z *= 0.5; return; }
    if (dz && ok(p.x, p.z + dz)) { p.z += dz; this.vel.x *= 0.5; return; }
    this.vel.x *= 0.2; this.vel.z *= 0.2;
  },

  jump: function() { this.jumpBuf = 0.15; },

  // Called every frame while walking (phase WALKING) — and for scouting from the tee
  update: function(dt) {
    var c = this.course(); if (!c) return;
    var p = this.pos, grav = this.GRAV * (c.gravity || 1);
    if (this.respawnT > 0) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) { p.copy(this.safe); this.vel.set(0, 0, 0); this.onGround = true; if (localAvatarMesh) localAvatarMesh.visible = true; }
      return;
    }
    // Ride moving platforms
    var sup = this.onGround ? c.supportAt(p.x, p.z) : null;
    if (sup && sup.solid && sup.solid.mover) { p.x += sup.solid.dx || 0; p.z += sup.solid.dz || 0; p.y += sup.solid.dy || 0; }
    // Input → horizontal velocity (snappy on the ground, floaty in the air)
    var inp = this._input();
    var spd = (inp.run ? this.RUN : this.WALK) * (inp.mag || 0);
    var tx = inp.x * spd, tz = inp.z * spd;
    var acc = this.onGround ? 14 : 4;
    this.vel.x += (tx - this.vel.x) * Math.min(1, acc * dt);
    this.vel.z += (tz - this.vel.z) * Math.min(1, acc * dt);
    // Knockback from obstacles is added straight into vel by ENT
    var steps = Math.max(1, Math.ceil(Math.hypot(this.vel.x, this.vel.z) * dt / 0.2));
    for (var s = 0; s < steps; s++) this._move(c, this.vel.x * dt / steps, this.vel.z * dt / steps);
    if (typeof ENT !== "undefined") ENT.collidePlayer(p, this);
    // Jumping (coyote time + input buffer)
    this.coyote = this.onGround ? 0.12 : this.coyote - dt;
    if (this.jumpBuf > 0) this.jumpBuf -= dt;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vel.y = this.JUMP * (c.gravity < 1 ? 0.9 : 1); this.onGround = false; this.coyote = 0; this.jumpBuf = 0;
      AudioEngine.sfx("jump");
      this._setAnim("jump");
    }
    // Vertical
    var g = c.heightAt(p.x, p.z);
    if (this.onGround) {
      if (g < p.y - 0.65) { this.onGround = false; this.vel.y = 0; }      // walked off a ledge
      else { p.y = g; this.vel.y = 0; }
      if (sup && sup.solid && sup.solid.bounce) { this.vel.y = sup.solid.bounce; this.onGround = false; AudioEngine.sfx("boing"); this._setAnim("jump"); }
    }
    if (!this.onGround) {
      this.airT += dt;
      this.vel.y -= grav * dt;
      if (!keys[" "] && !PL.jumpHeld && this.vel.y > 0) this.vel.y -= grav * 0.9 * dt;   // short hop when released early
      p.y += this.vel.y * dt;
      if (c.ceiling !== null && c.ceiling !== undefined && p.y + this.HEIGHT > c.ceiling) { p.y = c.ceiling - this.HEIGHT; if (this.vel.y > 0) this.vel.y = 0; }
      g = c.heightAt(p.x, p.z);
      if (p.y <= g) {
        var impact = -this.vel.y;
        p.y = g; this.vel.y = 0; this.onGround = true;
        if (this.airT > 0.25) { AudioEngine.sfx("land", Math.min(1, impact / 14)); this._setAnim("grounded"); this.animT = 0.18; }
        this.airT = 0;
      }
    } else this.airT = 0;
    if (this.onGround) c.touch(p.x, p.z);    // crumbling platforms
    // Hazards: water / lava / void
    var hz = c.hazardAt(p.x, p.z);
    if ((p.y < hz.level + 0.05 && g < hz.level) || p.y < hz.level - 3 || p.y < -60) this.fall(hz.type);
    // Remember the last safe spot (solid, static, not near an edge)
    this.safeT -= dt;
    if (this.onGround && this.safeT <= 0) {
      this.safeT = 0.25;
      var sp = c.supportAt(p.x, p.z), okSafe = g > hz.level + 0.3 && !(sp.solid && (sp.solid.mover || sp.solid.crumble || sp.solid.bounce));
      for (var a = 0; a < 4 && okSafe; a++) { var ex = p.x + Math.cos(a * 1.57) * 0.9, ez = p.z + Math.sin(a * 1.57) * 0.9; if (Math.abs(c.heightAt(ex, ez) - g) > 0.6) okSafe = false; }
      if (okSafe) this.safe.copy(p);
    }
    // Facing + animation
    var hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.4) {
      var ty = Math.atan2(this.vel.x, this.vel.z), dy = ty - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, 12 * dt);
    }
    if (this.animT > 0) this.animT -= dt;
    else if (!this.onGround) this._setAnim(this.vel.y > 0 ? "jump" : this.airT > 0.35 ? "jump" : this.anim);
    else this._setAnim(hs > 5.6 ? "sprint" : hs > 0.5 ? "walk" : "idle");
    // Character aura (cosmetic)
    if (typeof COS !== "undefined") COS.auraStep(localAvatarMesh, p, hs, dt);
    // Footsteps
    if (this.onGround && hs > 0.8) {
      this.stepAcc += dt * hs / (hs > 5.6 ? 2.0 : 1.5);
      if (this.stepAcc > 1) { this.stepAcc = 0; AudioEngine.sfx("step", PL.surfHardness(c, sup)); }
    }
    if (keys.ArrowLeft) { this.camYaw -= 2.2 * dt; this.lastCamInput = T; }
    if (keys.ArrowRight) { this.camYaw += 2.2 * dt; this.lastCamInput = T; }
    if (keys.ArrowUp) this.camPitch = Math.min(1.2, this.camPitch + 1.2 * dt);
    if (keys.ArrowDown) this.camPitch = Math.max(-0.2, this.camPitch - 1.2 * dt);
  },

  surfHardness: function(c, sup) {
    var s = (sup && sup.solid && sup.solid.surf) || c.surf;
    return { grass: 0.25, carpet: 0.15, snow: 0.2, sand: 0.3, dirt: 0.3, wood: 0.6, tile: 0.85, stone: 0.8, rock: 0.75, concrete: 0.8, metal: 1, pixel: 0.4 }[s] || 0.5;
  },

  fall: function(type) {
    if (this.respawnT > 0) return;
    this.respawnT = 0.9;
    AudioEngine.sfx(type === "void" || type === "none" ? "energy" : "splash");
    if (typeof spawnParticleBurst === "function") spawnParticleBurst(this.pos.clone(), new THREE.Color(type === "lava" ? 0xff5a10 : type === "void" ? 0xb46aff : 0x9adcf0), 18);
    if (localAvatarMesh) localAvatarMesh.visible = false;
    if (typeof _flashPrompt === "function") _flashPrompt(type === "lava" ? "Too hot! Back to safety" : type === "void" ? "Whoops — back to safety" : "Splash! Back to safety");
  },

  // Knock the player back (cars, saws, stomping feet …)
  knock: function(nx, nz, force, up) {
    this.vel.x = nx * force; this.vel.z = nz * force;
    if (this.onGround) { this.vel.y = up || 4; this.onGround = false; }
    this.animT = 0.4; this._setAnim("jump");
    if (typeof _screenShake !== "undefined") { _screenShake = 0.3; _screenShakeT = 0.35; }
  },

  _setAnim: function(a) {
    if (this.anim === a) return;
    this.anim = a;
    if (localAvatarMesh && typeof switchAvatarAnim === "function") switchAvatarAnim(localAvatarMesh, a);
  },

  // Place the avatar mesh
  applyAvatar: function(dt) {
    if (!localAvatarMesh) return;
    var fl = (typeof _playerFeetLift === "function") ? _playerFeetLift(myIdx) : 0;
    localAvatarMesh.position.set(this.pos.x, this.pos.y + fl, this.pos.z);
    localAvatarMesh.rotation.y = this.yaw;
    // Procedural squash & hop for models without a rig (rubber duck)
    if (!localAvatarMesh.userData.mixer) {
      var hs = Math.hypot(this.vel.x, this.vel.z);
      var hop = this.onGround && hs > 0.5 ? Math.abs(Math.sin(T * (hs > 5.6 ? 16 : 11))) * 0.18 : 0;
      localAvatarMesh.position.y += hop;
      localAvatarMesh.rotation.z = this.onGround && hs > 0.5 ? Math.sin(T * 11) * 0.12 : 0;
    }
  },

  // ── Orbit camera with wall / ceiling collision ──
  cameraPose: function(tp, tl) {
    var c = this.course(), p = this.pos;
    var head = new THREE.Vector3(p.x, p.y + 1.55, p.z);
    var cp = Math.cos(this.camPitch), dist = this.camDist;
    var dx = -Math.sin(this.camYaw) * cp, dz = Math.cos(this.camYaw) * cp, dy = Math.sin(this.camPitch);
    var free = PL.camRay(c, head, dx, dy, dz, dist);
    tp.set(head.x + dx * free, head.y + dy * free, head.z + dz * free);
    tl.set(p.x + Math.sin(this.camYaw) * 2.2, p.y + 1.3, p.z - Math.cos(this.camYaw) * 2.2);
  },
};

// March from origin along dir and stop before the first wall / ceiling hit
PL.camRay = function(c, o, dx, dy, dz, dist) {
  if (!c) return dist;
  var step = 0.3, d = 0;
  while (d < dist) {
    var nd = Math.min(dist, d + step), x = o.x + dx * nd, y = o.y + dy * nd, z = o.z + dz * nd;
    if (c.heightAt(x, z) > y - 0.35) return Math.max(0.4, d - 0.15);
    if (c.ceiling !== null && c.ceiling !== undefined && y > c.ceiling - 0.3) return Math.max(0.4, d - 0.1);
    d = nd;
  }
  return dist;
};

// ── Touch controls: joystick (left), drag-look (right), jump button ──────────
PL.stick = { active: false, id: -1, x: 0, y: 0, ox: 0, oy: 0 };
PL.look = { id: -1, x: 0, y: 0 };
PL.jumpHeld = false;
PL.initTouch = function() {
  var pad = document.getElementById("walk-pad"), knob = document.getElementById("walk-knob"), jb = document.getElementById("jump-btn");
  if (pad) {
    pad.addEventListener("touchstart", function(e) {
      e.preventDefault(); var t = e.changedTouches[0], r = pad.getBoundingClientRect();
      PL.stick.active = true; PL.stick.id = t.identifier; PL.stick.ox = r.left + r.width / 2; PL.stick.oy = r.top + r.height / 2;
      if (typeof _lastMoveKeyDown !== "undefined") _lastMoveKeyDown = T;
      PL._stickMove(t, knob);
    }, { passive: false });
    pad.addEventListener("touchmove", function(e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === PL.stick.id) PL._stickMove(e.changedTouches[i], knob);
    }, { passive: false });
    var end = function(e) {
      for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === PL.stick.id) { PL.stick.active = false; PL.stick.x = PL.stick.y = 0; if (knob) knob.style.transform = ""; }
    };
    pad.addEventListener("touchend", end); pad.addEventListener("touchcancel", end);
  }
  if (jb) {
    jb.addEventListener("touchstart", function(e) { e.preventDefault(); PL.jumpHeld = true; PL.jump(); }, { passive: false });
    jb.addEventListener("touchend", function(e) { e.preventDefault(); PL.jumpHeld = false; }, { passive: false });
    jb.addEventListener("mousedown", function(e) { e.preventDefault(); PL.jumpHeld = true; PL.jump(); });
    jb.addEventListener("mouseup", function() { PL.jumpHeld = false; });
  }
  // Camera drag (mouse anywhere on the canvas, touch on the right side) while walking
  var dragging = false, lx = 0, ly = 0;
  window.addEventListener("mousedown", function(e) {
    if (phase !== "WALKING" || (typeof renderer !== "undefined" && e.target !== renderer.domElement)) return;
    dragging = true; lx = e.clientX; ly = e.clientY;
  });
  window.addEventListener("mousemove", function(e) {
    if (!dragging) return;
    PL.camYaw += (e.clientX - lx) * 0.005; PL.camPitch = Math.max(-0.2, Math.min(1.2, PL.camPitch + (e.clientY - ly) * 0.004));
    lx = e.clientX; ly = e.clientY; PL.lastCamInput = T;
  });
  window.addEventListener("mouseup", function() { dragging = false; });
  window.addEventListener("wheel", function(e) { if (phase === "WALKING") PL.camDist = Math.max(2.5, Math.min(14, PL.camDist + e.deltaY * 0.01)); }, { passive: true });
  window.addEventListener("touchstart", function(e) {
    if (phase !== "WALKING" || typeof renderer === "undefined") return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.target === renderer.domElement && PL.look.id < 0) { PL.look.id = t.identifier; PL.look.x = t.clientX; PL.look.y = t.clientY; }
    }
  }, { passive: true });
  window.addEventListener("touchmove", function(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i]; if (t.identifier !== PL.look.id) continue;
      PL.camYaw += (t.clientX - PL.look.x) * 0.008; PL.camPitch = Math.max(-0.2, Math.min(1.2, PL.camPitch + (t.clientY - PL.look.y) * 0.006));
      PL.look.x = t.clientX; PL.look.y = t.clientY; PL.lastCamInput = T;
    }
  }, { passive: true });
  window.addEventListener("touchend", function(e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === PL.look.id) PL.look.id = -1; });
  window.addEventListener("keydown", function(e) {
    if (e.key === " " && (phase === "WALKING" || phase === "AIMING" || phase === "LANDED")) {
      e.preventDefault();
      if (phase === "WALKING") PL.jump();
    }
  });
};
PL._stickMove = function(t, knob) {
  var dx = t.clientX - PL.stick.ox, dy = t.clientY - PL.stick.oy, R = 46, l = Math.hypot(dx, dy);
  if (l > R) { dx *= R / l; dy *= R / l; }
  PL.stick.x = dx / R; PL.stick.y = dy / R;
  if (knob) knob.style.transform = "translate(" + dx + "px," + dy + "px)";
};
document.addEventListener("DOMContentLoaded", PL.initTouch);
