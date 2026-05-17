"use strict";

// ══════════════════════════════════════════════════════════
// ── PARTICLE SYSTEM ──
// Generic burst particles + disc trail + explosion effects.
// ══════════════════════════════════════════════════════════

// ── Generic burst particles ──
var particles = []; // array of {mesh, vel, life, maxLife}

function spawnParticleBurst(pos, color, count) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 4, 4),
      new THREE.MeshBasicMaterial({ color: color, transparent: true })
    );
    m.position.copy(pos);
    scene.add(m);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 6,
      Math.random() * 4 + 2,
      (Math.random() - 0.5) * 6
    );
    particles.push({ mesh: m, vel, life: 1.0, maxLife: 1.0 });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt * 1.5;
    p.vel.y -= 9 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.material.opacity = Math.max(0, p.life);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

// ── Explosion (Vilov Special & hazards) ──
function spawnExplosion(pos) {
  spawnParticleBurst(pos, new THREE.Color(0xcc0000), 30);
  spawnParticleBurst(pos, new THREE.Color(0xffffff), 15);
  spawnParticleBurst(pos, new THREE.Color(0x00aa44), 20);
  spawnParticleBurst(pos, new THREE.Color(0xff8800), 10);
  if (AudioEngine.ctx) {
    const b = AudioEngine.ctx.createOscillator();
    b.type = "sawtooth";
    b.frequency.setValueAtTime(180, AudioEngine.ctx.currentTime);
    b.frequency.exponentialRampToValueAtTime(20, AudioEngine.ctx.currentTime + 0.6);
    const bg = AudioEngine.ctx.createGain();
    bg.gain.setValueAtTime(0.4, AudioEngine.ctx.currentTime);
    bg.gain.exponentialRampToValueAtTime(0.001, AudioEngine.ctx.currentTime + 0.6);
    b.connect(bg).connect(AudioEngine.ctx.destination);
    b.start();
    b.stop(AudioEngine.ctx.currentTime + 0.6);
    AudioEngine.nodes.push(b, bg);
  }
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
// ── DISC TRAIL SYSTEM ──
// ══════════════════════════════════════════════════════════
const TRAIL_LENGTH = 40;
var trailPositions = [];
var trailMesh = null;
var trailGeometry = null;

function initTrail() {
  if (trailMesh) scene.remove(trailMesh);
  trailPositions = [];
  trailGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(TRAIL_LENGTH * 3);
  trailGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const trailMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    vertexColors: false,
  });
  trailMesh = new THREE.Line(trailGeometry, trailMat);
  trailMesh.frustumCulled = false;
  trailMesh.visible = false;
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
  trailPositions.unshift(pos.clone());
  if (trailPositions.length > TRAIL_LENGTH) trailPositions.pop();
  const positions = trailGeometry.attributes.position.array;
  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const p = trailPositions[i] || trailPositions[trailPositions.length - 1] || pos;
    if (!p) continue;
    positions[i * 3]     = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  }
  trailGeometry.attributes.position.needsUpdate = true;
  trailGeometry.setDrawRange(0, trailPositions.length);
  const d = DISCS[selectedDisc];
  if (d) trailMesh.material.color.setHex(d.color);
}

// ═══════════════════════════════════════════════════════════════════════
// ── IMPACT SOUNDS & PARTICLES ────────────────────────────────────────
// Velocity-scaled feedback for every disc collision type.
// Uses WebAudio API directly (no Tone.js dependency).
// ═══════════════════════════════════════════════════════════════════════

// ── IMPACT SOUND ENGINE ──────────────────────────────────────────────
var ImpactAudio = {
  // Generic synthetic sound using WebAudio
  play: function(type, intensity) {
    intensity = Math.max(0.05, Math.min(1.0, intensity || 0.5));
    var ctx = AudioEngine.ctx;
    if (!ctx || ctx.state === "suspended") return;
    var now = ctx.currentTime;

    switch(type) {
      case "terrain": {
        // Thud + skid: short low-frequency thump
        var osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(90 + intensity*40, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);
        var g = ctx.createGain();
        g.gain.setValueAtTime(intensity * 0.35, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        // White noise skid layer
        var buf = ctx.createBuffer(1, ctx.sampleRate*0.12, ctx.sampleRate);
        var d   = buf.getChannelData(0);
        for (var i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*intensity*0.18;
        var ns = ctx.createBufferSource(); ns.buffer = buf;
        var ng = ctx.createGain(); ng.gain.setValueAtTime(0.4,now); ng.gain.exponentialRampToValueAtTime(0.001,now+0.12);
        osc.connect(g).connect(ctx.destination);
        ns.connect(ng).connect(ctx.destination);
        osc.start(now); osc.stop(now+0.22);
        ns.start(now);
        AudioEngine.nodes.push(osc,g,ns,ng);
        break;
      }
      case "basket": {
        // Metallic chain rattle + ping
        [220, 330, 440, 660].forEach(function(freq, i) {
          var o = ctx.createOscillator();
          o.type = "triangle";
          o.frequency.setValueAtTime(freq, now+i*0.03);
          o.frequency.exponentialRampToValueAtTime(freq*0.5, now+0.5+i*0.03);
          var gg = ctx.createGain();
          gg.gain.setValueAtTime(intensity*0.12, now+i*0.03);
          gg.gain.exponentialRampToValueAtTime(0.001, now+0.55+i*0.04);
          o.connect(gg).connect(ctx.destination);
          o.start(now+i*0.03); o.stop(now+0.6);
          AudioEngine.nodes.push(o,gg);
        });
        // High ping
        var ping = ctx.createOscillator(); ping.type="sine"; ping.frequency.value=2400;
        var pg = ctx.createGain(); pg.gain.setValueAtTime(intensity*0.08,now); pg.gain.exponentialRampToValueAtTime(0.001,now+0.3);
        ping.connect(pg).connect(ctx.destination); ping.start(now); ping.stop(now+0.3);
        AudioEngine.nodes.push(ping,pg);
        break;
      }
      case "wood": {
        // Knock: short mid-freq thump with harmonics
        var freq2 = 180 + intensity*60;
        var o2 = ctx.createOscillator(); o2.type="triangle"; o2.frequency.setValueAtTime(freq2,now); o2.frequency.exponentialRampToValueAtTime(freq2*0.6,now+0.15);
        var g2 = ctx.createGain(); g2.gain.setValueAtTime(intensity*0.3,now); g2.gain.exponentialRampToValueAtTime(0.001,now+0.18);
        o2.connect(g2).connect(ctx.destination); o2.start(now); o2.stop(now+0.2);
        AudioEngine.nodes.push(o2,g2);
        break;
      }
      case "water": {
        // Low whoosh + bubble
        var buf2 = ctx.createBuffer(1, ctx.sampleRate*0.35, ctx.sampleRate);
        var d2   = buf2.getChannelData(0);
        for (var i2=0;i2<d2.length;i2++) d2[i2]=(Math.random()*2-1)*Math.exp(-i2/8000)*0.5;
        var ns2 = ctx.createBufferSource(); ns2.buffer=buf2;
        var lp  = ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=600;
        var ng2 = ctx.createGain(); ng2.gain.setValueAtTime(intensity*0.5,now); ng2.gain.exponentialRampToValueAtTime(0.001,now+0.35);
        ns2.connect(lp).connect(ng2).connect(ctx.destination); ns2.start(now);
        AudioEngine.nodes.push(ns2,lp,ng2);
        break;
      }
      case "metal": {
        // Bounce pop: short high metallic click
        var o3 = ctx.createOscillator(); o3.type="square"; o3.frequency.setValueAtTime(800+intensity*400,now); o3.frequency.exponentialRampToValueAtTime(200,now+0.08);
        var g3 = ctx.createGain(); g3.gain.setValueAtTime(intensity*0.2,now); g3.gain.exponentialRampToValueAtTime(0.001,now+0.1);
        o3.connect(g3).connect(ctx.destination); o3.start(now); o3.stop(now+0.1);
        AudioEngine.nodes.push(o3,g3);
        break;
      }
      case "energy": {
        // Crater/hazard burst: descending sawtooth
        var o4 = ctx.createOscillator(); o4.type="sawtooth"; o4.frequency.setValueAtTime(300+intensity*200,now); o4.frequency.exponentialRampToValueAtTime(20,now+0.5);
        var g4 = ctx.createGain(); g4.gain.setValueAtTime(intensity*0.4,now); g4.gain.exponentialRampToValueAtTime(0.001,now+0.5);
        o4.connect(g4).connect(ctx.destination); o4.start(now); o4.stop(now+0.55);
        AudioEngine.nodes.push(o4,g4);
        break;
      }
      case "ace": {
        // Rare ace confetti fanfare: ascending arpeggios
        [523,659,784,1047,1319].forEach(function(freq3,i3) {
          var oa = ctx.createOscillator(); oa.type="sine"; oa.frequency.value=freq3;
          var ga = ctx.createGain(); ga.gain.setValueAtTime(0,now+i3*0.1); ga.gain.linearRampToValueAtTime(0.12,now+i3*0.1+0.05); ga.gain.exponentialRampToValueAtTime(0.001,now+i3*0.1+0.4);
          oa.connect(ga).connect(ctx.destination); oa.start(now+i3*0.1); oa.stop(now+i3*0.1+0.4);
          AudioEngine.nodes.push(oa,ga);
        });
        break;
      }
    }
  }
};

// ── IMPACT PARTICLE TYPES ────────────────────────────────────────────
function spawnDust(pos, intensity) {
  intensity = intensity || 0.5;
  var count = Math.ceil(6 + intensity * 14);
  var dustColor = new THREE.Color(0xc8aa88);
  for (var i = 0; i < count; i++) {
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(0.04 + Math.random()*0.06, 4, 4),
      new THREE.MeshBasicMaterial({ color: dustColor, transparent: true })
    );
    m.position.copy(pos);
    scene.add(m);
    var angle = Math.random()*Math.PI*2, upv = Math.random()*1.5+0.3;
    var vel = new THREE.Vector3(Math.cos(angle)*intensity*2.5, upv, Math.sin(angle)*intensity*2.5);
    particles.push({ mesh:m, vel:vel, life:0.7+Math.random()*0.4, maxLife:1 });
  }
}

function spawnSparks(pos, intensity) {
  intensity = intensity || 0.5;
  var count = Math.ceil(4 + intensity * 10);
  for (var i = 0; i < count; i++) {
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 4, 4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.1, 1, 0.7+Math.random()*0.3), transparent: true })
    );
    m.position.copy(pos);
    scene.add(m);
    var spd = intensity * 5 + Math.random()*3;
    var vel = new THREE.Vector3((Math.random()-0.5)*spd, Math.random()*spd*0.8+0.5, (Math.random()-0.5)*spd);
    particles.push({ mesh:m, vel:vel, life:0.3+Math.random()*0.3, maxLife:1 });
  }
}

function spawnLeaves(pos, intensity) {
  intensity = intensity || 0.5;
  var leafCols = [0x228822, 0x448844, 0x336633, 0xaacc22];
  for (var i = 0; i < Math.ceil(5 + intensity*8); i++) {
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(0.07+Math.random()*0.05, 4, 4),
      new THREE.MeshBasicMaterial({ color: leafCols[Math.floor(Math.random()*leafCols.length)], transparent: true })
    );
    m.position.copy(pos);
    scene.add(m);
    var vel = new THREE.Vector3((Math.random()-0.5)*3*intensity, Math.random()*2.5+0.5, (Math.random()-0.5)*3*intensity);
    particles.push({ mesh:m, vel:vel, life:0.9+Math.random()*0.6, maxLife:1 });
  }
}

function spawnWaterSplash(pos, intensity) {
  intensity = intensity || 0.5;
  for (var i = 0; i < Math.ceil(8 + intensity*16); i++) {
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(0.05+Math.random()*0.08, 4, 4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0x44aadd), transparent: true })
    );
    m.position.copy(pos);
    scene.add(m);
    var angle = Math.random()*Math.PI*2;
    var r = Math.random()*intensity*3;
    var vel = new THREE.Vector3(Math.cos(angle)*r, Math.random()*intensity*4+1, Math.sin(angle)*r);
    particles.push({ mesh:m, vel:vel, life:0.5+Math.random()*0.4, maxLife:1 });
  }
}

function spawnConfetti(pos) {
  var cols = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8800];
  for (var i = 0; i < 40; i++) {
    var m = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.04, 0.12),
      new THREE.MeshBasicMaterial({ color: cols[i % cols.length], transparent: true })
    );
    m.position.copy(pos);
    scene.add(m);
    var vel = new THREE.Vector3((Math.random()-0.5)*8, Math.random()*6+2, (Math.random()-0.5)*8);
    particles.push({ mesh:m, vel:vel, life:1.2+Math.random()*0.8, maxLife:1.5 });
  }
}

// ── SKIN PARTICLE TRAILS ─────────────────────────────────────────────
// Called each frame during flight for discs with particle skins.
function spawnSkinParticle(type, pos) {
  var m, vel, life;
  switch(type) {
    case "fire":
    case "smoke":
      var c = type==="fire" ? new THREE.Color(0xff4400).lerp(new THREE.Color(0xffaa00),Math.random()) : new THREE.Color(0x445544);
      m = new THREE.Mesh(new THREE.SphereGeometry(0.05+Math.random()*0.06,4,4),
        new THREE.MeshBasicMaterial({color:c,transparent:true}));
      vel = new THREE.Vector3((Math.random()-0.5)*0.8,(Math.random()*1.2+0.3),(Math.random()-0.5)*0.8);
      life = 0.4+Math.random()*0.3; break;
    case "ice":
      m = new THREE.Mesh(new THREE.OctahedronGeometry(0.05+Math.random()*0.04,0),
        new THREE.MeshBasicMaterial({color:new THREE.Color(0x88eeff),transparent:true}));
      vel = new THREE.Vector3((Math.random()-0.5)*1.5,(Math.random()-0.5)*1.5,(Math.random()-0.5)*1.5);
      life = 0.5+Math.random()*0.4; break;
    case "toxic":
      m = new THREE.Mesh(new THREE.SphereGeometry(0.06+Math.random()*0.05,4,4),
        new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL(0.3+Math.random()*0.1,1,0.5),transparent:true}));
      vel = new THREE.Vector3((Math.random()-0.5)*1.2,Math.random()*0.8+0.2,(Math.random()-0.5)*1.2);
      life = 0.6+Math.random()*0.5; break;
    case "glow":
    case "holo":
      var hslH = type==="holo" ? Math.random() : 0.88;
      m = new THREE.Mesh(new THREE.SphereGeometry(0.04+Math.random()*0.04,4,4),
        new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL(hslH,1,0.7),transparent:true}));
      vel = new THREE.Vector3((Math.random()-0.5)*2,(Math.random()-0.5)*2,(Math.random()-0.5)*2);
      life = 0.25+Math.random()*0.25; break;
    case "sparks":
      m = new THREE.Mesh(new THREE.SphereGeometry(0.03,3,3),
        new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL(0.12+Math.random()*0.06,1,0.7),transparent:true}));
      vel = new THREE.Vector3((Math.random()-0.5)*3,Math.random()*2,(Math.random()-0.5)*3);
      life = 0.2+Math.random()*0.2; break;
    case "stars":
      m = new THREE.Mesh(new THREE.OctahedronGeometry(0.05,0),
        new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL(0.75+Math.random()*0.15,0.8,0.8),transparent:true}));
      vel = new THREE.Vector3((Math.random()-0.5)*1.8,(Math.random()-0.5)*1.8,(Math.random()-0.5)*1.8);
      life = 0.6+Math.random()*0.6; break;
    case "rainbow":
      m = new THREE.Mesh(new THREE.SphereGeometry(0.04+Math.random()*0.05,4,4),
        new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL(Math.random(),1,0.6),transparent:true}));
      vel = new THREE.Vector3((Math.random()-0.5)*2.5,(Math.random()-0.5)*2.5,(Math.random()-0.5)*2.5);
      life = 0.3+Math.random()*0.4; break;
    case "food":
      m = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.02,0.08),
        new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL(Math.random()*0.15,1,0.6),transparent:true}));
      vel = new THREE.Vector3((Math.random()-0.5)*2,Math.random()*1.5+0.5,(Math.random()-0.5)*2);
      life = 0.5+Math.random()*0.3; break;
    case "confetti":
      m = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.04,0.1),
        new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL(Math.random(),1,0.65),transparent:true}));
      vel = new THREE.Vector3((Math.random()-0.5)*4,Math.random()*3+1,(Math.random()-0.5)*4);
      life = 0.8+Math.random()*0.7; break;
    default: return;
  }
  m.position.copy(pos);
  scene.add(m);
  particles.push({mesh:m, vel:vel, life:life, maxLife:life});
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
      ImpactAudio.play("energy", intensity);
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
