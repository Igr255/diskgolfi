"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── VEHICLES — a driveable Celica ────────────────────────────────────────────
// E to get in / out (first in drives, the rest ride along) · W/S gas & brake /
// reverse · A/D steer · Space handbrake drift · Q horn.
// Crash into critters, traffic and friends to send them flying. On the vet
// school map the walking girls run over and hop in when someone sits inside.
// The driver's client simulates the car and streams it to everyone else.
// ══════════════════════════════════════════════════════════════════════════════
var VEH = {
  cars: [], mySeat: null,         // mySeat: { car, seat } while I'm inside
  SCALE: 1.55,                    // the game's characters are chunky; a 1.55× coupe fits them
  HALF_W: 0.95 * 1.55, HALF_L: 2.31 * 1.55, WHEEL_X: 0.8 * 1.55, WHEEL_Z: 1.3 * 1.55,
  // seats in model units (car faces +z; the steering wheel is on the +x side)
  SEATS: [{ x: 0.30, y: 0.95, z: -0.42 }, { x: -0.30, y: 0.95, z: -0.42 }, { x: 0.27, y: 0.96, z: -1.15 }, { x: -0.27, y: 0.96, z: -1.15 }],
  ARCH_OK: { city: 1, highlands: 1, moon: 1 },
};

// ── Spawning ─────────────────────────────────────────────────────────────────
VEH.clear = function() {
  VEH.cars.forEach(function(c) { if (c.root.parent) c.root.parent.remove(c.root); });
  VEH.cars = []; VEH.mySeat = null; VEH.engineStop(); VEH.hud(false);
};
VEH.spawnFor = function(h) {
  VEH.clear();
  var C = h.course;
  if (!C || !(VEH.ARCH_OK[h.arch] || h.theme === "minecraft")) return;
  // a flat, dry spot beside the fairway near the tee, nose pointing down the hole
  var R = C.route, a = LV.pointAt(R, 0.0), fw = { x: a.dx, z: a.dz }, best = null;
  for (var k = 0; k < 40 && !best; k++) {
    var t = 0.0 + (k % 8) * 0.012, side = k % 2 ? 1 : -1, off = 11 + Math.floor(k / 8) * 2.5;   // parked beside the tee, out of the aiming view
    var p = LV.pointAt(R, t), x = p.x - p.dz * off * side, z = p.z + p.dx * off * side;
    var yaw = Math.atan2(p.dx, p.dz), ok = true, g0 = C.heightAt(x, z);
    if (g0 < C.hazardAt(x, z).level + 0.4 || !C.inBounds(x, z)) continue;
    VEH._footprint(x, z, yaw).forEach(function(q) { if (Math.abs(C.heightAt(q.x, q.z) - g0) > 0.35) ok = false; });
    if (Math.hypot(x - C.tee.x, z - C.tee.z) < 5) ok = false;
    if (ok) best = { x: x, y: g0, z: z, yaw: yaw };
  }
  if (!best) return;
  VEH.cars.push(VEH.make(0, best));
};
VEH._footprint = function(x, z, yaw) {
  var s = Math.sin(yaw), c = Math.cos(yaw), out = [];
  [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1]].forEach(function(q) {
    var lx = q[0] * VEH.HALF_W * 0.9, lz = q[1] * VEH.HALF_L * 0.9;
    out.push({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  });
  return out;
};

VEH.make = function(id, at) {
  var root = new THREE.Group();
  root.position.set(at.x, at.y, at.z); root.rotation.y = at.yaw;
  var body = new THREE.Group(); root.add(body);      // pitch / roll / suspension bob live here
  var car = { id: id, root: root, body: body, model: null, wheels: [], pos: new THREE.Vector3(at.x, at.y, at.z), yaw: at.yaw, speed: 0, steer: 0, vy: 0,
    pitch: 0, roll: 0, onGround: true, seats: [null, null, null, null], safe: new THREE.Vector3(at.x, at.y, at.z), safeYaw: at.yaw, net: null, lastSend: 0, driftT: 0 };
  // placeholder box until the GLB arrives
  var ph = new THREE.Mesh(new THREE.BoxGeometry(VEH.HALF_W * 2, 1.4, VEH.HALF_L * 2), new THREE.MeshStandardMaterial({ color: 0xd83a2a }));
  ph.position.y = 0.9; body.add(ph);
  loadModel("celica", function(m) {
    if (!m) return;
    body.remove(ph);
    // open-top: drop the roof and side glass so everyone inside is visible
    ["Greenhouse", "DoorGlass_L", "DoorGlass_R", "QuarterGlass_L", "QuarterGlass_R", "DoorSeal_L", "DoorSeal_R", "QuarterSeal_L", "QuarterSeal_R"].forEach(function(n) { var o = m.getObjectByName(n); if (o) o.visible = false; });
    body.add(m); car.model = m;
    // wheels: wrap each in steer + spin pivots at the wheel centre. Inside the GLB the car is
    // rotated 90°, so the axle / up axes are worked out in each wheel's parent space.
    m.updateMatrixWorld(true);
    var bodyToWorld = body.matrixWorld.clone();
    ["Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR"].forEach(function(n) {
      var w = m.getObjectByName(n); if (!w) return;
      var par = w.parent, cW = new THREE.Box3().setFromObject(w).getCenter(new THREE.Vector3()), cL = par.worldToLocal(cW.clone());
      var toPar = new THREE.Matrix4().copy(par.matrixWorld).invert().multiply(bodyToWorld);
      var axle = new THREE.Vector3(1, 0, 0).transformDirection(toPar), up = new THREE.Vector3(0, 1, 0).transformDirection(toPar);
      var steer = new THREE.Group(), spin = new THREE.Group(); steer.position.copy(cL); steer.add(spin); par.add(steer);
      spin.add(w); w.position.sub(cL);
      car.wheels.push({ steer: steer, spin: spin, front: n.indexOf("_F") > 0, axle: axle, up: up, ang: 0 });
    });
    VEH.openCabin(m);
    m.traverse(function(o) {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      // glossy paint mirrored the bright sky so much the colour washed out
      if (o.material && /paint/i.test(o.material.name)) { o.material.envMapIntensity = 0.45; o.material.roughness = Math.max(o.material.roughness, 0.32); }
    });
  });
  courseGrp.add(root);
  // a collider for the disc and for people walking into it
  car.ent = { type: "car_vehicle", mesh: root, x: at.x, z: at.z, y: at.y, worldY: at.y, r: 2.0, h: 2.0, solid: true, update: null, t: 0, isCar: true };
  if (typeof ENT !== "undefined") ENT.list.push(car.ent);
  return car;
};

// The body is a closed shell whose top sits above the seats (the roof hid it). Cut the cabin
// opening out of the top and line it with a floor and side panels so the seats show.
VEH.CABIN = { x: 0.74, z0: -1.42, z1: 0.62, yCut: 0.86, floor: 0.80 };
VEH.openCabin = function(m) {
  var K = VEH.CABIN, inv = new THREE.Matrix4().copy(m.matrixWorld).invert(), interiorMat = null;
  m.traverse(function(o) {
    if (!o.isMesh) return;
    var mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(function(mt) { if (mt && /^interior$/i.test(mt.name)) interiorMat = mt; });
    if (!/^(Body|CabinSide|BeltTrim)/.test(o.name) && !(o.parent && /^(Body|CabinSide)/.test(o.parent.name))) return;
    var g = o.geometry; if (!g.index) return;
    var toModel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), pos = g.attributes.position, idx = g.index.array;
    var a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), keep = [], groups = g.groups.length ? g.groups : [{ start: 0, count: idx.length, materialIndex: 0 }], ng = [];
    groups.forEach(function(gr) {
      var start = keep.length;
      for (var t = gr.start; t < gr.start + gr.count; t += 3) {
        a.fromBufferAttribute(pos, idx[t]).applyMatrix4(toModel); b.fromBufferAttribute(pos, idx[t + 1]).applyMatrix4(toModel); c.fromBufferAttribute(pos, idx[t + 2]).applyMatrix4(toModel);
        var cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
        n.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
        var lid = cy > K.yCut && Math.abs(cx) < K.x && cz > K.z0 && cz < K.z1 && Math.abs(n.y) > 0.35;
        if (!lid) keep.push(idx[t], idx[t + 1], idx[t + 2]);
      }
      ng.push({ start: start, count: keep.length - start, materialIndex: gr.materialIndex });
    });
    if (keep.length === idx.length) return;
    g = g.clone(); g.setIndex(keep); g.clearGroups(); ng.forEach(function(gr) { if (gr.count) g.addGroup(gr.start, gr.count, gr.materialIndex); });
    o.geometry = g;
  });
  // tub: floor + inner side walls (model units; the model scale applies)
  var mat = interiorMat || new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 });
  var tub = new THREE.Group(), W = K.x * 2, L = K.z1 - K.z0, zc = (K.z0 + K.z1) / 2, h = 1.02 - K.floor;
  var fl = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, L), mat); fl.position.set(0, K.floor, zc); tub.add(fl);
  [-1, 1].forEach(function(sd) { var wl = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, L), mat); wl.position.set(sd * (K.x - 0.015), K.floor + h / 2, zc); tub.add(wl); });
  var rw = new THREE.Mesh(new THREE.BoxGeometry(W, h, 0.03), mat); rw.position.set(0, K.floor + h / 2, K.z0 + 0.015); tub.add(rw);
  tub.traverse(function(o) { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
  // the GLB's root may be rotated: add the tub in the model's own (unrotated) frame
  var holder = new THREE.Group(); holder.matrixAutoUpdate = false; holder.matrix.copy(new THREE.Matrix4().identity()); m.add(holder); holder.add(tub);
};

// Seat → world position
VEH.seatWorld = function(car, i) {
  var s = VEH.SEATS[i], v = new THREE.Vector3(s.x * VEH.SCALE, s.y * VEH.SCALE, s.z * VEH.SCALE);
  car.body.updateMatrixWorld(true);
  return v.applyMatrix4(car.body.matrixWorld);
};
VEH.nearest = function(x, z, maxD) {
  var best = null, bd = maxD || 4;
  VEH.cars.forEach(function(c) { var d = Math.hypot(c.pos.x - x, c.pos.z - z); if (d < bd) { bd = d; best = c; } });
  return best;
};
VEH.driverOf = function(car) { var o = car.seats[0]; return o && o.kind === "player" ? o.idx : null; };

// ── Getting in / out ─────────────────────────────────────────────────────────
VEH.toggle = function() {
  if (VEH.mySeat) return VEH.exit();
  if (phase !== "WALKING" || PL.respawnT > 0) return;
  var car = VEH.nearest(PL.pos.x, PL.pos.z, 4.2); if (!car) return;
  var seat = -1;
  for (var i = 0; i < 4; i++) { var o = car.seats[i]; if (!o || o.kind === "ent") { seat = i; break; } }
  if (seat < 0) { _flashPrompt("The car is full!"); return; }
  if (car.seats[seat] && car.seats[seat].kind === "ent") VEH.unseatEnt(car, seat);
  car.seats[seat] = { kind: "player", idx: myIdx };
  VEH.mySeat = { car: car, seat: seat };
  if (seat === 0) { car.net = null; VEH.engineStart(); }
  AudioEngine.sfx("pickup");
  _flashPrompt(seat === 0 ? "🚗 You're driving! W/S gas · A/D steer · Space drift · E get out" : "🚗 Riding along — E to get out");
  PL._setAnim("idle");
  VEH.sendSeats(car);
  VEH.hud(true);
};
VEH.exit = function() {
  var ms = VEH.mySeat; if (!ms) return;
  var car = ms.car, side = (ms.seat % 2 === 0) ? 1 : -1;   // driver side is +x
  car.seats[ms.seat] = null; VEH.mySeat = null;
  if (ms.seat === 0) VEH.engineStop();
  // step out beside the door, on solid ground
  var s = Math.sin(car.yaw), c = Math.cos(car.yaw), C = HOLES[holeIdx].course, ex = null;
  [2.4, 3.2, -2.4, -3.2].forEach(function(d) {
    if (ex) return;
    var lx = side * d, x = car.pos.x + lx * c, z = car.pos.z - lx * s, g = C.heightAt(x, z);
    if (g > C.hazardAt(x, z).level + 0.3 && Math.abs(g - car.pos.y) < 1.5) ex = { x: x, y: g, z: z };
  });
  if (!ex) ex = { x: car.pos.x, y: car.pos.y + 2.2, z: car.pos.z };
  PL.pos.set(ex.x, ex.y, ex.z); PL.vel.set(0, 0, 0); PL.onGround = ex.y <= C.heightAt(ex.x, ex.z) + 0.01;
  if (localAvatarMesh) { localAvatarMesh.visible = cameraMode === "tp"; }
  PL.camYaw = car.yaw;
  VEH.sendSeats(car);
  VEH.hud(false);
};
VEH.sendSeats = function(car) {
  if (!(typeof mpMode !== "undefined" && mpMode)) return;
  sendToAll({ t: "car_seats", h: holeIdx, i: car.id, seats: car.seats.map(function(o) { return o && o.kind === "player" ? o.idx : null; }) });
};
VEH.applySeats = function(msg) {
  var car = VEH.cars[msg.i]; if (!car || msg.h !== holeIdx) return;
  for (var k = 0; k < 4; k++) {
    var who = msg.seats[k], cur = car.seats[k];
    if (who === myIdx) continue;                                   // my own seat is mine to manage
    if (cur && cur.kind === "player" && cur.idx === myIdx) continue;
    if (who === null || who === undefined) { if (cur && cur.kind === "player") car.seats[k] = null; }
    else { if (cur && cur.kind === "ent") VEH.unseatEnt(car, k); car.seats[k] = { kind: "player", idx: who }; }
  }
};

// ── Per-frame ────────────────────────────────────────────────────────────────
VEH.update = function(dt) {
  if (!VEH.cars.length) return;
  var C = HOLES[holeIdx] && HOLES[holeIdx].course; if (!C) return;
  VEH.cars.forEach(function(car) {
    var drv = VEH.driverOf(car), iDrive = VEH.mySeat && VEH.mySeat.car === car && VEH.mySeat.seat === 0;
    if (iDrive) VEH.drive(car, C, dt);
    else if (car.net) VEH.followNet(car, dt);
    else VEH.settle(car, C, dt);
    // visuals
    car.root.position.copy(car.pos); car.root.rotation.y = car.yaw;
    car.body.rotation.x = car.pitch; car.body.rotation.z = car.roll;
    car.wheels.forEach(function(w) {
      w.ang += car.speed * dt / (0.33 * VEH.SCALE);
      w.spin.quaternion.setFromAxisAngle(w.axle, w.ang);                 // roll around the axle
      if (w.front) w.steer.quaternion.setFromAxisAngle(w.up, car.steer); // steer around vertical
    });
    car.ent.x = car.pos.x; car.ent.z = car.pos.z; car.ent.y = car.ent.worldY = car.pos.y;
    car.ent.solid = !car.seats.some(function(o) { return o && o.kind === "player" && o.idx === myIdx; });
    // occupants
    car.seats.forEach(function(o, i) { if (o) VEH.placeOccupant(car, i, o); });
    if (iDrive && T - car.lastSend > 0.066) { car.lastSend = T; VEH.sendState(car); }
  });
  VEH.fans(dt);
  VEH.prompt();
  if (VEH.mySeat) VEH.hudTick();
};

// Driving model: arcade, ground-following, ledges hop, walls bounce
VEH.drive = function(car, C, dt) {
  var f = 0, r = 0;
  if (keys.w || keys.W || keys.ArrowUp) f += 1;
  if (keys.s || keys.S || keys.ArrowDown) f -= 1;
  if (keys.d || keys.D || keys.ArrowRight) r += 1;
  if (keys.a || keys.A || keys.ArrowLeft) r -= 1;
  if (PL.stick.active) { f = -PL.stick.y; r = PL.stick.x; }
  var hand = !!keys[" "] || PL.jumpHeld, MAX = 24, REV = 8, grav = 22 * (C.gravity || 1);
  // throttle / brake / reverse
  if (f > 0) car.speed += (car.speed < 0 ? 30 : 15) * f * dt;
  else if (f < 0) car.speed += (car.speed > 0 ? -30 : -10) * -f * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 4 * dt);
  car.speed = Math.max(-REV, Math.min(MAX, car.speed));
  if (hand) car.speed *= Math.pow(0.35, dt);
  // steering: tighter at low speed, a lazy drift with the handbrake
  var st = -r * 0.55 * (1 - Math.min(0.55, Math.abs(car.speed) / 45));   // A = left (+yaw), D = right (-yaw)
  car.steer += (st - car.steer) * Math.min(1, dt * 8);
  var yawRate = car.speed * Math.tan(car.steer) / (2 * VEH.WHEEL_Z) * (hand ? 1.7 : 1) * (car.onGround ? 1 : 0.3);
  car.yaw += yawRate * dt;
  if (hand && Math.abs(car.speed) > 8 && Math.abs(r) > 0) { car.driftT += dt; if (car.driftT > 0.08) { car.driftT = 0; VEH.smoke(car); } }
  // move in substeps with collision against walls / ledges
  var steps = Math.max(1, Math.ceil(Math.abs(car.speed) * dt / 0.35));
  for (var i = 0; i < steps; i++) {
    var sd = car.speed * dt / steps, fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    var nx = car.pos.x + fx * sd, nz = car.pos.z + fz * sd;
    var bump = VEH._bumper(car, C, nx, nz, Math.sign(car.speed || 1));
    if (bump > car.pos.y + 1.15 || !C.inBounds(nx, nz)) {
      var hit = Math.abs(car.speed);
      car.speed = -car.speed * 0.3;
      if (hit > 4) { AudioEngine.sfx("metal", Math.min(1, hit / 20)); AudioEngine.sfx("bonk"); if (typeof _screenShake !== "undefined") { _screenShake = Math.min(0.6, hit / 30); _screenShakeT = 0.3; } }
      break;
    }
    car.pos.x = nx; car.pos.z = nz;
  }
  // ground under the wheels
  var g = VEH._wheelHeights(car, C), ground = Math.max(g.fl, g.fr, g.rl, g.rr);
  if (car.pos.y > ground + 0.08 || car.vy > 0) {
    car.onGround = false; car.vy -= grav * dt; car.pos.y += car.vy * dt;
    if (car.pos.y <= ground) { if (car.vy < -6) { AudioEngine.sfx("land", Math.min(1, -car.vy / 18)); if (typeof _screenShake !== "undefined") { _screenShake = 0.25; _screenShakeT = 0.25; } } car.pos.y = ground; car.vy = 0; car.onGround = true; }
  } else {
    // climb small steps smoothly; when a ledge drops away we launch off it with our speed
    var wasY = car.pos.y;
    car.pos.y += (ground - car.pos.y) * Math.min(1, dt * 18);
    car.onGround = true; car.vy = 0;
    if (ground < wasY - 0.5) { car.onGround = false; car.vy = Math.max(0, (wasY - ground) * 0.5); car.pos.y = wasY; }
  }
  var tp = Math.atan2(((g.rl + g.rr) - (g.fl + g.fr)) / 2, 2 * VEH.WHEEL_Z), tr = Math.atan2(((g.fr + g.rr) - (g.fl + g.rl)) / 2, 2 * VEH.WHEEL_X);
  if (!car.onGround) { tp = -car.vy * 0.025; tr = 0; }
  car.pitch += (Math.max(-0.5, Math.min(0.5, tp)) - car.pitch) * Math.min(1, dt * 8);
  car.roll += (Math.max(-0.4, Math.min(0.4, tr)) + car.steer * car.speed * 0.006 - car.roll) * Math.min(1, dt * 8);
  // water / lava / void: fish the car back out to its last safe spot
  var hz = C.hazardAt(car.pos.x, car.pos.z);
  if (car.pos.y < hz.level + 0.1 && ground < hz.level) {
    AudioEngine.sfx("splash"); spawnParticleBurst(car.pos.clone(), new THREE.Color(0x9adcf0), 30);
    car.pos.copy(car.safe); car.yaw = car.safeYaw; car.speed = 0; car.vy = 0;
    _flashPrompt("Splash! The car was towed back");
  } else if (car.onGround && Math.abs(car.speed) < 12) { car.safe.copy(car.pos); car.safeYaw = car.yaw; }
  // crashes into critters / traffic / friends
  VEH.crash(car, C);
  VEH.engineTick(car);
  if ((keys.q || keys.Q) && !VEH._honk) { VEH._honk = true; AudioEngine.sfx("honk"); if (mpMode) sendToAll({ t: "car_honk", i: car.id }); }
  if (!(keys.q || keys.Q)) VEH._honk = false;
};
VEH._bumper = function(car, C, x, z, dir) {
  var s = Math.sin(car.yaw), c = Math.cos(car.yaw), m = -Infinity;
  [-1, 0, 1].forEach(function(k) {
    var lx = k * VEH.HALF_W * 0.85, lz = dir * VEH.HALF_L * 0.95;
    m = Math.max(m, C.heightAt(x + lx * c + lz * s, z - lx * s + lz * c));
  });
  return m;
};
VEH._wheelHeights = function(car, C) {
  var s = Math.sin(car.yaw), c = Math.cos(car.yaw), x = car.pos.x, z = car.pos.z;
  function h(lx, lz) { return C.heightAt(x + lx * c + lz * s, z - lx * s + lz * c); }
  var X = VEH.WHEEL_X, Z = VEH.WHEEL_Z;
  return { fl: h(X, Z), fr: h(-X, Z), rl: h(X, -Z), rr: h(-X, -Z) };
};
// Parked: just sit on the ground (and fall if the ground goes away)
VEH.settle = function(car, C, dt) {
  car.speed *= Math.pow(0.1, dt);
  var g = VEH._wheelHeights(car, C), ground = Math.max(g.fl, g.fr, g.rl, g.rr);
  if (car.pos.y > ground + 0.05) { car.vy -= 22 * dt; car.pos.y = Math.max(ground, car.pos.y + car.vy * dt); } else { car.pos.y = ground; car.vy = 0; }
  car.steer *= 0.9;
};
VEH.smoke = function(car) {
  var s = Math.sin(car.yaw), c = Math.cos(car.yaw);
  [-1, 1].forEach(function(k) {
    var lx = k * VEH.WHEEL_X, lz = -VEH.WHEEL_Z;
    spawnSkinParticle("smoke", new THREE.Vector3(car.pos.x + lx * c + lz * s, car.pos.y + 0.3, car.pos.z - lx * s + lz * c));
  });
};

// Whoever is in front of the car goes flying
VEH.crash = function(car, C) {
  var sp = Math.abs(car.speed); if (sp < 3) return;
  var s = Math.sin(car.yaw), c = Math.cos(car.yaw), fx = s, fz = c;
  function inside(x, z, y, r) {
    var dx = x - car.pos.x, dz = z - car.pos.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) < VEH.HALF_W + r && Math.abs(lz) < VEH.HALF_L + r && Math.abs(y - car.pos.y) < 2.2;
  }
  var guest = ENT.isGuest();
  ENT.list.forEach(function(o, idx) {
    if (!o.update || o.isCar || o.fly || o.seatedCar || o.type === "pole" || o.deadly) return;
    if (!inside(o.x, o.z, o.y, o.r || 0.5)) return;
    if ((o.h || 1) > 3.5 || o.update === ENT.B.prop) {        // trees, houses, props: we hit them
      var hit = sp; car.speed = -car.speed * 0.25; AudioEngine.sfx("wood", 0.9); if (typeof _screenShake !== "undefined") { _screenShake = 0.4; _screenShakeT = 0.3; } return;
    }
    var vx = fx * sp * 0.9 + (Math.random() - 0.5) * 4, vy = 7 + sp * 0.35, vz = fz * sp * 0.9 + (Math.random() - 0.5) * 4;
    if (guest && ENT.isAI(o)) sendToAll({ t: "ent_hit", h: holeIdx, i: idx, vx: vx, vy: vy, vz: vz });
    else ENT.launch(o, vx, vy, vz);
    _spawnBonkText(new THREE.Vector3(o.x, o.y + 2, o.z), sp > 15 ? "STRIKE!" : "BONK!");
    AudioEngine.sfx("bonk"); car.speed *= 0.85;
  });
  if (mpMode) remotePlayers.forEach(function(rp, i) {
    if (!rp || !rp.body || rp._carHitCd > T) return;
    if (car.seats.some(function(o) { return o && o.kind === "player" && o.idx === i; })) return;
    if (!inside(rp.body.x, rp.body.z, rp.body.y, 0.4)) return;
    rp._carHitCd = T + 1;
    BT.hit(i, "car", fx, fz, Math.min(26, sp * 1.1), 6 + sp * 0.35);
    _spawnBonkText(rp.body.clone().add(new THREE.Vector3(0, 2.2, 0)), "ROADKILL!");
    AudioEngine.sfx("bonk"); car.speed *= 0.8;
  });
};
// Someone ran ME over
VEH.hitMe = function(dx, dz, f) {
  if (VEH.mySeat) return;
  BT.receiveHit({ by: -1, c: "car", dx: dx, dz: dz, f: Math.min(26, f * 1.1), u: 6 + f * 0.35 });
};

// ── Occupants ────────────────────────────────────────────────────────────────
VEH.placeOccupant = function(car, i, o) {
  var p = VEH.seatWorld(car, i), yaw = car.yaw;
  if (o.kind === "player" && o.idx === myIdx) {
    PL.pos.set(p.x, p.y - 0.85, p.z); PL.vel.set(0, 0, 0); PL.onGround = true; PL.yaw = yaw;
    if (localAvatarMesh) { VEH.seatPose(localAvatarMesh, p, yaw); }
  } else if (o.kind === "player") {
    var rp = remotePlayers[o.idx];
    if (rp && rp.avatarMesh) { VEH.seatPose(rp.avatarMesh, p, yaw); if (rp.body) rp.body.set(p.x, p.y - 0.85, p.z); }
  } else if (o.kind === "ent") {
    var e = o.o; e.x = p.x; e.z = p.z; e.y = p.y - 0.62; e.yaw = yaw;
    e.mesh.position.set(e.x, e.y, e.z); e.mesh.rotation.set(0, yaw, 0); e.worldY = e.y;
  }
};
// Sit pose: rigs with a sitting clip use it; the others sink in so the door hides their legs
VEH.seatPose = function(av, p, yaw) {
  var acts = av.userData.clipActions || {}, sit = Object.keys(acts).find(function(k) { return /sit/i.test(k) && !/sitting$/i.test(k); }) || Object.keys(acts).find(function(k) { return /sit/i.test(k); });
  av.position.set(p.x, p.y - (sit ? (/^Generated/.test(sit) ? 0.64 : 0.55) : 0.85), p.z); av.rotation.set(0, yaw, 0);
  if (sit) { if (av.userData.activeClipName !== sit) { var from = av.userData.activeClipName ? acts[av.userData.activeClipName] : null; acts[sit].reset().play().fadeIn(0.2); if (from) from.fadeOut(0.2); av.userData.activeClipName = sit; } }
  else if (av.userData.activeClipName && !/idle/i.test(av.userData.activeClipName) && typeof switchAvatarAnim === "function") switchAvatarAnim(av, "idle");
};

// ── Vet school: the walking girls want a ride ────────────────────────────────
VEH.fans = function(dt) {
  if (!HOLES[holeIdx] || HOLES[holeIdx].theme !== "vetschool" || ENT.isGuest()) return;
  VEH.cars.forEach(function(car) {
    var anyone = car.seats.some(function(o) { return o && o.kind === "player"; });
    ENT.list.forEach(function(e, idx) {
      if (!e.carFan || e.fly) return;
      if (!anyone) { if (e.seatedCar || e.toCar) VEH.fanLeave(e); return; }
      if (e.seatedCar) return;
      var free = -1; for (var s = 1; s < 4; s++) if (!car.seats[s]) { free = s; break; }
      if (free < 0 && !e.toCar) return;
      if (!e.toCar) { e.toCar = { car: car, seat: free }; car.seats[free] = { kind: "claim", e: e }; }
      // run to the car door and hop in
      var tgt = VEH.seatWorld(car, e.toCar.seat), dx = tgt.x - e.x, dz = tgt.z - e.z, d = Math.hypot(dx, dz);
      if (d < 2.6) { car.seats[e.toCar.seat] = { kind: "ent", o: e }; e.seatedCar = { car: car, seat: e.toCar.seat }; e.toCar = null; AudioEngine.sfx("boing"); if (typeof ENT.play === "function") ENT.play(e, ["SitIdle", "Sitting"]); return; }
      var sp = Math.min(d, 7.5 * dt);
      e.x += dx / d * sp; e.z += dz / d * sp; e.y = HOLES[holeIdx].course.heightAt(e.x, e.z); ENT.face(e, dx, dz, dt, 10); ENT.sync(e);
      if (typeof ENT.play === "function") ENT.play(e, ["Running", "Run"]);
    });
  });
};
VEH.fanLeave = function(e) {
  var st = e.seatedCar || e.toCar;
  if (st) { if (st.car.seats[st.seat] && (st.car.seats[st.seat].o === e || st.car.seats[st.seat].e === e)) st.car.seats[st.seat] = null; }
  if (e.seatedCar) {
    var car = e.seatedCar.car, side = e.seatedCar.seat % 2 === 0 ? 1 : -1, C = HOLES[holeIdx].course;
    var x = car.pos.x + Math.cos(car.yaw) * side * 2.6, z = car.pos.z - Math.sin(car.yaw) * side * 2.6;
    e.x = x; e.z = z; e.y = C.heightAt(x, z); e.home = { x: x, z: z, R: 10 };
  }
  e.seatedCar = null; e.toCar = null;
};
VEH.unseatEnt = function(car, i) { var o = car.seats[i]; if (o && o.o) VEH.fanLeave(o.o); car.seats[i] = null; };

// ── Network ──────────────────────────────────────────────────────────────────
VEH.sendState = function(car) {
  if (!(typeof mpMode !== "undefined" && mpMode)) return;
  sendToAll({ t: "car", h: holeIdx, i: car.id, x: +car.pos.x.toFixed(2), y: +car.pos.y.toFixed(2), z: +car.pos.z.toFixed(2), yw: +car.yaw.toFixed(3), sp: +car.speed.toFixed(1), st: +car.steer.toFixed(2), p: +car.pitch.toFixed(2), r: +car.roll.toFixed(2),
    fans: car.seats.map(function(o) { return o && o.kind === "ent" ? ENT.list.indexOf(o.o) : -1; }) });
};
VEH.applyState = function(msg) {
  var car = VEH.cars[msg.i]; if (!car || msg.h !== holeIdx) return;
  if (VEH.mySeat && VEH.mySeat.car === car && VEH.mySeat.seat === 0) return;   // I'm the driver: ignore echoes
  car.net = msg;
  // the girls riding along are placed by the car on every screen
  if (msg.fans && ENT.isGuest()) msg.fans.forEach(function(ei, s) {
    var cur = car.seats[s];
    if (ei >= 0 && ENT.list[ei]) { if (!cur || cur.kind !== "player") { car.seats[s] = { kind: "ent", o: ENT.list[ei] }; ENT.list[ei].seatedCar = { car: car, seat: s }; } }
    else if (cur && cur.kind === "ent") { cur.o.seatedCar = null; car.seats[s] = null; }
  });
};
VEH.followNet = function(car, dt) {
  var n = car.net, k = Math.min(1, dt * 12);
  if (car.pos.distanceTo(new THREE.Vector3(n.x, n.y, n.z)) > 15) car.pos.set(n.x, n.y, n.z);
  car.pos.x += (n.x - car.pos.x) * k; car.pos.y += (n.y - car.pos.y) * k; car.pos.z += (n.z - car.pos.z) * k;
  var dy = n.yw - car.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; car.yaw += dy * k;
  car.speed = n.sp; car.steer = n.st; car.pitch += (n.p - car.pitch) * k; car.roll += (n.r - car.roll) * k;
  if (VEH.driverOf(car) === null) car.net = null;   // nobody drives any more: park where it is
};

// ── Engine sound: a pitched, filtered buzz that follows the speed ────────────
VEH.engineStart = function() {
  var A = AudioEngine; if (!A.ctx || !A.G || VEH._eng) return;
  var ctx = A.ctx, o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  o1.type = "sawtooth"; o2.type = "square"; o2.detune.value = -1200;
  lp.type = "lowpass"; lp.frequency.value = 600; g.gain.value = 0.0001;
  o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(A.G.sfx);
  o1.start(); o2.start();
  g.gain.setTargetAtTime(0.05, ctx.currentTime, 0.2);
  VEH._eng = { o1: o1, o2: o2, lp: lp, g: g };
  AudioEngine.sfx("energy", 0.4);
};
VEH.engineTick = function(car) {
  var e = VEH._eng; if (!e) return;
  var t = AudioEngine.ctx.currentTime, sp = Math.abs(car.speed), gear = sp % 8 / 8;
  var f = 45 + sp * 5 + gear * 25;
  e.o1.frequency.setTargetAtTime(f, t, 0.05); e.o2.frequency.setTargetAtTime(f, t, 0.05);
  e.lp.frequency.setTargetAtTime(500 + sp * 60, t, 0.1);
  e.g.gain.setTargetAtTime(0.035 + Math.min(1, sp / 24) * 0.045, t, 0.1);
};
VEH.engineStop = function() {
  var e = VEH._eng; if (!e) return; VEH._eng = null;
  var t = AudioEngine.ctx.currentTime;
  e.g.gain.setTargetAtTime(0.0001, t, 0.15);
  setTimeout(function() { try { e.o1.stop(); e.o2.stop(); } catch (er) {} }, 600);
};

// ── HUD: "E to drive" prompt + speedometer ───────────────────────────────────
VEH.prompt = function() {
  var el = document.getElementById("veh-hint");
  var near = !VEH.mySeat && phase === "WALKING" && VEH.nearest(PL.pos.x, PL.pos.z, 4.2);
  if (!el) {
    el = document.createElement("button"); el.id = "veh-hint"; el.className = "glass";
    el.onclick = function() { VEH.toggle(); };
    var ui = document.getElementById("ui"); if (!ui) return; ui.appendChild(el);
  }
  var show = !!near || !!VEH.mySeat;
  el.style.display = show ? "" : "none";
  if (!show) return;
  var full = near && near.seats.every(function(o) { return o && o.kind === "player"; });
  var html = VEH.mySeat ? "<kbd>E</kbd> Get out" : full ? "Car is full" : (near.seats[0] ? "<kbd>E</kbd> Ride along" : "<kbd>E</kbd> Drive the Celica");
  if (el._h !== html) { el.innerHTML = "🚗 " + html; el._h = html; }
};
VEH.hud = function(on) {
  var el = document.getElementById("veh-hud");
  if (!el) { el = document.createElement("div"); el.id = "veh-hud"; el.className = "glass"; var ui = document.getElementById("ui"); if (!ui) return; ui.appendChild(el); }
  el.style.display = on ? "" : "none";
  document.body.classList.toggle("driving", !!on);
};
VEH.hudTick = function() {
  var el = document.getElementById("veh-hud"); if (!el) return;
  var car = VEH.mySeat.car, kmh = Math.round(Math.abs(car.speed) * 3.6), driver = VEH.mySeat.seat === 0;
  var riders = car.seats.filter(Boolean).length;
  var html = "<b>" + kmh + "</b><span>km/h</span><em>" + (driver ? "W/S gas · A/D steer · Space drift · Q horn" : "Riding along") + " · 👥 " + riders + "</em>";
  if (el._h !== html) { el.innerHTML = html; el._h = html; }
};

// Chase camera (used by updateCamera while I'm in a car)
VEH.camYawOff = 0; VEH.camPitch = 0.25; VEH.camDist = 10.5; VEH.lastLook = -10;
VEH.cameraPose = function(tp, tl) {
  var car = VEH.mySeat.car;
  // mouse-look offset eases back behind the car once you drive on
  if (Math.abs(car.speed) > 3 && T - VEH.lastLook > 1.5) VEH.camYawOff *= 0.95;
  var yaw = car.yaw + VEH.camYawOff, back = VEH.camDist + Math.abs(car.speed) * 0.12, fx = Math.sin(yaw), fz = Math.cos(yaw);
  var head = new THREE.Vector3(car.pos.x, car.pos.y + 2.2, car.pos.z), cp = Math.cos(VEH.camPitch), spi = Math.sin(VEH.camPitch);
  tp.set(car.pos.x - fx * back * cp, car.pos.y + 2.2 + back * spi + 1.0, car.pos.z - fz * back * cp);
  tl.set(car.pos.x + fx * 4, car.pos.y + 1.4, car.pos.z + fz * 4);
  if (typeof _camCollide === "function") _camCollide(HOLES[holeIdx].course, head, tp);
};

window.addEventListener("keydown", function(e) {
  if (e.code !== "KeyE" || e.repeat || phase !== "WALKING") return;
  var tag = document.activeElement && document.activeElement.tagName; if (tag === "INPUT" || tag === "TEXTAREA") return;
  VEH.toggle();
});
