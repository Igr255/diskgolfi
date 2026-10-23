// ── GAME CORE ─────────────────────────────────────────────────────────────────
// Three.js scene setup, hole loading, scoring, main animate loop.
// This file is the entry point — it runs after all other scripts are loaded.

// config.js is loaded first and defines all constants

// ── GLOBAL STATE ─────────────────────────────────────────────────────────────
var HOLES   = [];
var holeIdx = 0;

var discPos      = new THREE.Vector3();
var discVel      = new THREE.Vector3();
var discSpin     = 0;
var discMesh     = null;
var basketWP     = new THREE.Vector3();
var lastValidPos = new THREE.Vector3();

var phase        = "MENU";     // MENU | AIMING | FLYING | LANDED | SCORED
var throwCount   = 0;
var flightTimer  = 0;
var totalVsPar   = 0;
var holeScores   = new Array(200).fill(null);
var selectedDisc = "midrange";
var loftIdx      = 1;
var aimAngle     = 0;
var baseAim      = 0;
var throwPower   = 0;
var dragging     = false;
var _throwStart  = null;   // where the current throw was released (for throw distance)
var ds = { x: 0, y: 0 }, dn = { x: 0, y: 0 };
console.log("[DiskGolfi] game.js executing...");
var cameraMode  = "tp";   // "tp" | "fp" | "spec" — TP is default
var localAvatarMesh = null;
var fpPitch     = -0.08;
var fpHandMesh  = null;
var _fpDrag     = false, _fpLastX = 0, _fpLastY = 0;
var _fpSensX    = 0.003, _fpSensY = 0.0025;

function toggleCameraMode() {
  var modes = ["fp","tp"];
  cameraMode = modes[(modes.indexOf(cameraMode) + 1) % modes.length];
  var btn = document.getElementById("cam-mode-btn");
  if (btn) { btn.classList.toggle("fp", cameraMode === "fp"); btn.title = cameraMode === "fp" ? "Third-person view (C)" : "First-person view (C)"; }
  if (localAvatarMesh) localAvatarMesh.visible = (cameraMode === "tp");
  if (discMesh)   discMesh.visible   = (cameraMode === "tp");
  if (fpHandMesh) fpHandMesh.visible = (cameraMode === "fp" && (phase === "AIMING" || phase === "LANDED"));
}

// ── Mobile joystick + throw vars ──────────────────────────────────────
var _joyActive = false, _joyId = -1, _joyBX = 0, _joyBY = 0;
var _joyDX = 0, _joyDY = 0;
var _punchCooldown = 0;

// ── ENHANCED PUNCH SYSTEM ─────────────────────────────────────────────────
// Arcade-physics punch: directional impulse, triggers FLYING on hit player,
// fully synced across multiplayer via punch_launch message.
var _punchImmunity = 0;   // immunity timer for local player (anti-spam)

function _doPunch() {
  var PUNCH_RANGE = 2.6, bestIdx = -1, bestDist = PUNCH_RANGE;
  remotePlayers.forEach(function(rp, i) {
    if (!rp || !rp.avatarMesh || !rp.body) return;
    if (rp.punchImmunity && rp.punchImmunity > 0) return;  // immune, skip
    var d = Math.hypot(PL.pos.x - rp.body.x, PL.pos.z - rp.body.z);
    if (d < bestDist && Math.abs(PL.pos.y - rp.body.y) < 1.8) { bestDist = d; bestIdx = i; }
  });
  _punchSwingEffect();
  if (GAD.hitNear(PL.pos.x, PL.pos.z, Math.sin(PL.yaw), Math.cos(PL.yaw), 2.2)) AudioEngine.sfx("bonk");
  if (typeof _screenShake !== "undefined") { _screenShake = 0.18; _screenShakeT = 0.22; }
  if (bestIdx < 0) {   // no rival in reach: slap a bystander instead
    var fx = Math.sin(PL.yaw), fz = Math.cos(PL.yaw);
    ENT.list.forEach(function(o) {
      if (!o.update || o.rag || !/jogger|dancer|critter|minion|knight|goose/.test(o.type)) return;
      var ox = o.x - PL.pos.x, oz = o.z - PL.pos.z, od = Math.hypot(ox, oz);
      if (od < PUNCH_RANGE + (o.r || 0.4) && (ox * fx + oz * fz) / (od || 1) > 0.2) {
        ENT.launch(o, ox / (od || 1) * 9, 6, oz / (od || 1) * 9);
        _spawnBonkText(new THREE.Vector3(o.x, (o.worldY || o.y) + 1.8, o.z), "SLAP!"); AudioEngine.sfx("bonk");
        if (o.type === "goose") { o.angryT = 4; GAD.honk(o, true); }
        if (typeof CINE !== "undefined") CINE.hitStop(0.06);
      }
    });
    return;   // swing and a miss
  }
  var rp = remotePlayers[bestIdx];
  var pdx = rp.body.x - PL.pos.x, pdz = rp.body.z - PL.pos.z, pl = Math.hypot(pdx, pdz) || 1;
  // A slap knocks them out (Battle mode rules); a running slap hits harder
  var impulse = 9 + Math.hypot(PL.vel.x, PL.vel.z) * 0.6;
  rp.punchImmunity = 1.3;
  _spawnBonkText(rp.body.clone().add(new THREE.Vector3(0, 2, 0)), "SLAP!");
  AudioEngine.sfx("bonk");
  if (typeof _screenShake !== "undefined") { _screenShake = 0.42; _screenShakeT = 0.5; }
  BT.hit(bestIdx, "slap", pdx / pl, pdz / pl, impulse, 7);
}

function _punchSwingEffect() {
  // Quick arm-swing animation for local avatar
  if (typeof localAvatarMesh !== "undefined" && localAvatarMesh) {
    var _swingT = 0;
    var _swingInterval = setInterval(function() {
      _swingT += 0.1;
      if (localAvatarMesh) {
        localAvatarMesh.rotation.z = Math.sin(_swingT * 12) * 0.35 * Math.max(0, 1 - _swingT);
      }
      if (_swingT >= 1.0) clearInterval(_swingInterval);
    }, 16);
  }
}

// ── BONK popup text in 3D world (DOM overlay) ────────────────────────────
var _bonkWords = ["BONK!", "WHAM!", "POW!", "OOF!", "SMACK!"];
function _spawnBonkText(worldPos, word) {
  // Project world → screen
  if (typeof camera === "undefined" || !camera) return;
  var v = worldPos.clone();
  v.project(camera);
  var sx = (v.x * 0.5 + 0.5) * window.innerWidth;
  var sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
  if (v.z > 1) return;  // behind camera

  var el = document.createElement("div");
  el.className = "bonk-popup";
  el.textContent = word || _bonkWords[Math.floor(Math.random() * _bonkWords.length)];
  el.style.cssText = "position:fixed;left:" + sx + "px;top:" + sy + "px;" +
    "transform:translate(-50%,-50%) rotate(" + (Math.random()*30-15) + "deg) scale(0);" +
    "pointer-events:none;z-index:200;transition:transform 0.12s cubic-bezier(.3,-0.4,.7,1.4),opacity 0.35s;";
  document.body.appendChild(el);

  // Pop in
  requestAnimationFrame(function() {
    el.style.transform = "translate(-50%,-50%) rotate(" + (Math.random()*30-15) + "deg) scale(1.2)";
    setTimeout(function() {
      el.style.transform = "translate(-50%,-120%) scale(0.8)";
      el.style.opacity = "0";
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
    }, 700);
  });

  // Particle burst
  if (!word && typeof spawnParticleBurst === "function") {
    spawnParticleBurst(worldPos, new THREE.Color(0xff3300), 16);
  }
}

// Called from main loop — tick down stagger and immunity timers on remote players
function _tickPunchTimers(dt) {
  remotePlayers.forEach(function(rp) {
    if (!rp) return;
    if (rp.punchStagger > 0) {
      rp.punchStagger -= dt;
      if (rp.punchStagger < 0) rp.punchStagger = 0;
    }
    if (rp.punchImmunity > 0) {
      rp.punchImmunity -= dt;
      if (rp.punchImmunity < 0) rp.punchImmunity = 0;
    }
  });
  // Local player immunity
  if (_punchImmunity > 0) _punchImmunity -= dt;
}

// Called when WE are the punch target — launches us into FLYING so physics moves us
function _applyPunchToLocalPlayer(vx, vy, vz, px, py, pz, stagger) {
  if (_punchImmunity > 0) return;
  stagger = stagger || 1.1;
  _punchImmunity = stagger + 0.2;
  // A bonk knocks you off your lie: the disc stays put, you stumble away and walk back
  if (phase === "AIMING") startWalking(false);
  if (phase === "WALKING") { var l = Math.hypot(vx, vz) || 1; PL.knock(vx / l, vz / l, Math.min(14, l), vy || 5); }
  if (typeof _screenShake !== "undefined") { _screenShake = 0.60; _screenShakeT = 0.65; }
  AudioEngine.sfx("bonk");
  if (typeof _spawnBonkText === "function") _spawnBonkText(PL.pos.clone().add(new THREE.Vector3(0, 2, 0)));
  var _fl = document.createElement("div");
  _fl.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9998;" +
    "background:radial-gradient(ellipse at center,transparent 35%,rgba(255,0,0,.6) 100%);" +
    "animation:punchHitFlash 0.55s ease-out forwards;";
  document.body.appendChild(_fl);
  setTimeout(function(){ if (_fl.parentNode) _fl.parentNode.removeChild(_fl); }, 600);
}
var _screenShake = 0, _screenShakeT = 0;
var _playerVelX = 0, _playerVelZ = 0;
var _punchKnockVelX = 0, _punchKnockVelZ = 0, _punchKnockTimer = 0;
var _nameLabelTmp = new THREE.Vector3();
var _nameLabelFrame = 0;
var _avatarYaw = 0;
var _prevDiscX = 0, _prevDiscZ = 0;
var _fpThrowHeld = false;
var _posBcastAcc = 0;
function fpThrowStart(e) { e.preventDefault(); _fpThrowHeld = true; }
function fpThrowEnd(e) {
  e.preventDefault(); _fpThrowHeld = false;
  if (typeof phase !== "undefined" && phase === "AIMING" && throwPower > 0.04) doThrow();
}
(function() {
  document.addEventListener("DOMContentLoaded", function() {
    var zone = document.getElementById("fp-joystick-zone");
    var nub  = document.getElementById("fp-joystick-nub");
    if (!zone || !nub) return;
    zone.addEventListener("touchstart", function(e) {
      if (_joyActive) return;
      var t = e.changedTouches[0]; _joyActive = true; _joyId = t.identifier;
      var r = zone.getBoundingClientRect();
      _joyBX = r.left + r.width/2; _joyBY = r.top + r.height/2;
    }, {passive:true});
    window.addEventListener("touchmove", function(e) {
      if (!_joyActive) return;
      for (var i=0;i<e.touches.length;i++) {
        if (e.touches[i].identifier !== _joyId) continue;
        var dx=e.touches[i].clientX-_joyBX, dy=e.touches[i].clientY-_joyBY;
        var maxR=32, dist=Math.hypot(dx,dy);
        if (dist>maxR){dx=dx/dist*maxR;dy=dy/dist*maxR;}
        _joyDX=dx/maxR; _joyDY=dy/maxR;
        nub.style.transform="translate(calc(-50% + "+dx+"px),calc(-50% + "+dy+"px))";
        break;
      }
    }, {passive:true});
    window.addEventListener("touchend", function(e) {
      for (var i=0;i<e.changedTouches.length;i++) {
        if (e.changedTouches[i].identifier!==_joyId) continue;
        _joyActive=false; _joyDX=0; _joyDY=0;
        nub.style.transform="translate(-50%,-50%)"; break;
      }
    }, {passive:true});
  });
})();

var keys = { ArrowLeft:false, ArrowRight:false, ArrowUp:false, ArrowDown:false, w:false,a:false,s:false,d:false,q:false,e:false,r:false,W:false,A:false,S:false,D:false,Q:false,E:false,R:false," ":false,Shift:false };
var freeCamYaw   = 0;
var freeCamPitch = -0.25;
var _freeCamDrag = false, _freeCamLX = 0, _freeCamLY = 0;

// Multiplayer globals
var mpMode          = false;
var myIdx           = 0;
var playerCount     = 1;
var playerNames     = ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5"];
var conns           = new Array(MAX_PLAYERS).fill(null);
var peer            = null;
var remotePlayers   = new Array(MAX_PLAYERS).fill(null);
var mpTotals        = new Array(MAX_PLAYERS).fill(0);
var playerDone      = new Array(MAX_PLAYERS).fill(false);
var playerThrows    = new Array(MAX_PLAYERS).fill(0);
var mpScoreRecorded = new Array(MAX_PLAYERS).fill(false);
var myHoleDone      = false;
var hostGameStarted = false;
var spectatingOpp   = false;
var spectateTargetIdx = -1;
var giveUpProposed  = false;
var giveUpVotes     = new Array(MAX_PLAYERS).fill(false);

// Powerup runtime state
var activePowerups = {};
var powerupMeshes  = [];

// Step-back state (used by ui.js)
var throwHistory      = [];
var stepBackCooldown  = 0;
var STEP_BACK_COOLDOWN = 8;

// ── THREE.JS SETUP ────────────────────────────────────────────────────────────
var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

var scene  = new THREE.Scene();
scene.fog  = new THREE.FogExp2(0x111122, 0.006);

var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 11, 20);

// Sky, sun, hemisphere fill, environment map, water, post-processing: graphics.js
GFX.init(renderer, scene, camera);
var sunLight  = GFX.sun;
var hemiLight = GFX.hemi;
var ambLight  = null;
var skyMat    = null;   // legacy hook (weather.js) — the sky is driven by GFX presets now
(function() { var qs = document.getElementById("quality-sel"); if (qs) qs.value = GFX.qualityPref || "auto"; })();

var courseGrp = new THREE.Group();
scene.add(courseGrp);

// ── DEBUG MODE VISUALS ────────────────────────────────────────────────────────
var _debugGrp = new THREE.Group();
scene.add(_debugGrp);

function _applyDebugMode(on) {
  // Clear old debug visuals
  while (_debugGrp.children.length) _debugGrp.remove(_debugGrp.children[0]);
  if (!on) return;

  // World scale reference cube (1m × 1m × 1m) at origin
  var _refCube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
  );
  _refCube.position.set(0, 0.5, 0);
  _debugGrp.add(_refCube);

  // Obstacle colliders
  if (typeof obstacles !== "undefined") {
    obstacles.forEach(function(o) {
      var _cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(o.r, o.r, o.h || 2, 12),
        new THREE.MeshBasicMaterial({ color: 0xff4444, wireframe: true, transparent: true, opacity: 0.6 })
      );
      _cyl.position.set(o.x, (o.startY || 0) + (o.h || 2) / 2, o.z);
      _debugGrp.add(_cyl);
    });
  }

  // Platform root debug: hierarchy origin + axes
  if (typeof platformEntities !== "undefined") {
    platformEntities.forEach(function(pe) {
      if (!pe || !pe.root) return;
      var _axes = new THREE.AxesHelper(1.6);
      _axes.position.copy(pe.root.position);
      _debugGrp.add(_axes);
      var _rootMark = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x00aaff, wireframe: true })
      );
      _rootMark.position.copy(pe.root.position);
      _debugGrp.add(_rootMark);
    });
  }

  // Player position marker
  var _playerMark = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x00ff88 })
  );
  _playerMark.userData.isPlayerMarker = true;
  _debugGrp.add(_playerMark);
}

// Update debug each frame (moving colliders, player marker)
function _tickDebug(dt) {
  if (!DEBUG_MODE) return;
  _debugGrp.children.forEach(function(c) {
    if (c.userData.isPlayerMarker && typeof discPos !== "undefined") {
      c.position.copy(discPos);
    }
  });
  if (!window._dbgSupportTick) window._dbgSupportTick = 0;
  window._dbgSupportTick += dt;
  if (window._dbgSupportTick > 2) {
    window._dbgSupportTick = 0;
    var _sp = (typeof discSupportPlatform !== "undefined" && discSupportPlatform) ? "moving-platform" : "none";
    console.log("[Debug] supportPlatform:", _sp, "| phase:", phase);
  }
  // Show anim state for remote players
  if (typeof remotePlayers !== "undefined") {
    remotePlayers.forEach(function(rp, i) {
      if (!rp || !rp.avatarMesh) return;
      var _state = rp.avatarMesh._wantAnim || "?";
      var _loaded = rp.avatarMesh.userData.glbLoaded ? "GLB" : "proc";
      // Log every 2 seconds (throttled)
      if (!rp._dbgTick) rp._dbgTick = 0;
      rp._dbgTick += dt;
      if (rp._dbgTick > 2) {
        rp._dbgTick = 0;
        console.log("[Debug] Remote player", i, "| anim:", _state, "| model:", _loaded, "| velMag:", (rp.velMag||0).toFixed(2));
      }
    });
  }
}

// F9 key toggles debug mode
window.addEventListener("keydown", function(e) {
  if (e.key === "F9") { e.preventDefault(); DiskGolfiDebug.toggle(); _applyDebugMode(DEBUG_MODE); }
});

// ── BACKGROUND IMAGE ─────────────────────────────────────────────────────────
// The 3D scene now has a real per-theme sky (graphics.js). BACKGROUND_IMAGE is
// only used behind the main menu.
(function() {
  if (typeof BACKGROUND_IMAGE === "undefined" || !BACKGROUND_IMAGE) return;
  var m = document.getElementById("menu");
  if (m) m.style.setProperty("--menu-bg", "url('" + BACKGROUND_IMAGE + "')");
})();

var obstacles   = [];
var platformEntities = [];
var discSupportPlatform = null;
var discSupportLocalPos = new THREE.Vector3();
var _tmpWorldPos = new THREE.Vector3();
function _estimateIslandTopRadiusRatio(root) {
  if (!root) return 1.0;
  root.updateMatrixWorld(true);
  var maxY = -Infinity, maxR = 0;
  var v = new THREE.Vector3();
  root.traverse(function(node) {
    if (!node.isMesh || !node.geometry || !node.geometry.attributes || !node.geometry.attributes.position) return;
    var pos = node.geometry.attributes.position;
    for (var i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld);
      if (v.y > maxY) maxY = v.y;
      var r = Math.hypot(v.x, v.z);
      if (r > maxR) maxR = r;
    }
  });
  if (!(maxY > -Infinity) || maxR < 0.001) return 1.0;
  var band = Math.max(0.02, maxY * 0.08);
  var topR = 0;
  root.traverse(function(node) {
    if (!node.isMesh || !node.geometry || !node.geometry.attributes || !node.geometry.attributes.position) return;
    var pos = node.geometry.attributes.position;
    for (var i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld);
      if (v.y >= maxY - band) {
        var r = Math.hypot(v.x, v.z);
        if (r > topR) topR = r;
      }
    }
  });
  if (topR < 0.001) return 1.0;
  return Math.max(0.35, Math.min(1.2, topR / maxR));
}

function _makeEntity(root, visual, collider, animator, updateFn) {
  return {
    root: root || new THREE.Group(),
    visual: visual || null,
    collider: collider || null,
    animator: animator || null,
    children: [],
    update: updateFn || function(){}
  };
}

function _createPlatformEntity(mv, hole) {
  var waterY = hole.water || -1.5;
  var surfY = islandSurfaceY(hole, mv.elev || 0);
  var root = new THREE.Group();
  root.position.set(mv.currentX || mv.baseX, 0, mv.currentZ || mv.baseZ);
  root.userData.entityType = 'platformRoot';

  var visualRoot = new THREE.Group();
  var colliderRoot = new THREE.Group();
  var obstaclesRoot = new THREE.Group();
  var propsRoot = new THREE.Group();
  var playersStandingRoot = new THREE.Group();
  var discsStandingRoot = new THREE.Group();

  root.add(visualRoot);
  root.add(colliderRoot);
  root.add(obstaclesRoot);
  root.add(propsRoot);
  root.add(playersStandingRoot);
  root.add(discsStandingRoot);

  // Glowing hazard ring marks platforms that move
  var rim = new THREE.Mesh(
    new THREE.TorusGeometry(mv.r + 0.05, 0.05, 6, 64),
    new THREE.MeshBasicMaterial({color: 0xffd23a})
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, surfY + 0.03, 0);
  visualRoot.add(rim);

  var _P = GFX.themePreset(hole.theme);
  var island = GFX.buildIsland({ x: 0, z: 0, r: mv.r, surfY: surfY, waterY: waterY, theme: hole.theme,
    type: "moving", floating: !!(_P.water && _P.water.kind === "void"), seed: Math.round(mv.baseX * 7 + mv.baseZ * 3) });
  visualRoot.add(island);
  mv.walkR = mv.r;
  mv.foamR = island.userData.waterlineR;

  var entity = _makeEntity(root, visualRoot, colliderRoot, null, function(){});
  entity.obstaclesRoot = obstaclesRoot;
  entity.propsRoot = propsRoot;
  entity.playersStandingRoot = playersStandingRoot;
  entity.discsStandingRoot = discsStandingRoot;
  entity.movingIsland = mv;
  mv.entity = entity;
  mv.mesh = root;
  return entity;
}

function _refreshObstacleWorldPosition(o) {
  if (!o || !o.mesh) return;
  o.mesh.getWorldPosition(_tmpWorldPos);
  o.x = _tmpWorldPos.x;
  o.z = _tmpWorldPos.z;
  o.worldY = _tmpWorldPos.y;
}

function _findSupportPlatform(x, z, hole) {
  if (!hole || !hole.movingIslands) return null;
  for (var i = 0; i < hole.movingIslands.length; i++) {
    var mv = hole.movingIslands[i];
    var cx = (mv.currentX !== undefined) ? mv.currentX : mv.baseX;
    var cz = (mv.currentZ !== undefined) ? mv.currentZ : mv.baseZ;
    var dx = x - cx, dz = z - cz;
    var rr = (mv.walkR || mv.r || 6);
    if (Math.hypot(dx, dz) <= rr + 0.35) return mv;
  }
  return null;
}

var matchSeed   = Math.floor(Math.random() * 1000000000);
// Shared match clock: in multiplayer every client uses the host's wall clock, so
// moving platforms and timed hazards (socks, geysers, feet, lasers…) line up.
var _clockOff = 0;
function netTime() { return (typeof mpMode !== "undefined" && mpMode) ? (Date.now() + _clockOff - 1.7e12) / 1000 : T; }

// ── VILOV EXPLOSION PUSH ──────────────────────────────────────────────────────
function vilovExplosionPush() {
  const radius = 6, strength = 28;
  obstacles.forEach((o) => {
    const d = Math.hypot(o.x - discPos.x, o.z - discPos.z);
    if (d < radius && d > 0.01) {
      const nx = (o.x - discPos.x) / d, nz = (o.z - discPos.z) / d;
      const f = (1 - d / radius) * strength;
      o.mesh.position.x += nx * f * 0.4;
      o.mesh.position.z += nz * f * 0.4;
      o.mesh.position.y += f * 0.25;
      o.x = o.mesh.position.x; o.z = o.mesh.position.z;
    }
  });
}

// Soft additive light shaft above the basket so it can be spotted from anywhere
function _buildBeacon(x, y, z, night) {
  if (!GFX._texCache.beacon) {
    var c = GFX._canvas(64), g = c.getContext("2d");
    var gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.7, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,1)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    GFX._texCache.beacon = GFX._tex(c); GFX._texCache.beacon.wrapS = GFX._texCache.beacon.wrapT = THREE.ClampToEdgeWrapping;
  }
  var mat = new THREE.MeshBasicMaterial({ color: 0xffc860, map: GFX._texCache.beacon, transparent: true, opacity: night ? 0.45 : 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  var m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.55, 16, 20, 1, true), mat);
  m.position.set(x, y + 8 + BASKET_DIM.height * 0.5, z);
  m.userData.isBeacon = true;
  m.renderOrder = 4;
  return m;
}

// ── CAMERA OCCLUDER FADING ───────────────────────────────────────────────────
// Obstacles between the camera and the player (or the disc in flight) fade out.
// Materials are cloned per obstacle only while faded (GLB clones share materials).
function _updateOccluders(dt) {
  var tgt = (phase === "FLYING") ? discPos : (localAvatarMesh && localAvatarMesh.visible ? localAvatarMesh.position : discPos);
  var cam = camera.position, active = cameraMode === "tp" && introT <= 0;
  var ax = cam.x, ay = cam.y, az = cam.z, bx = tgt.x, by = tgt.y + 1.0, bz = tgt.z;
  var abx = bx - ax, aby = by - ay, abz = bz - az, len2 = abx * abx + aby * aby + abz * abz || 1;
  obstacles.forEach(function(o) {
    if (!o.mesh || o.noFade) return;
    var blocks = false;
    if (active) {
      var base = o.worldY !== undefined ? o.worldY : (o.startY || 0), hh = o.h || 2;
      var ox = o.x, oy = base + hh * 0.5, oz = o.z;
      var t = ((ox - ax) * abx + (oy - ay) * aby + (oz - az) * abz) / len2;
      t = Math.max(0, Math.min(1, t));
      var px = ax + abx * t, py = ay + aby * t, pz = az + abz * t;
      var dh = Math.hypot(ox - px, oz - pz), up = py - base;
      blocks = t > 0.02 && t < 0.96 && dh < (o.r || 1) + 0.9 && up < hh + 0.6 && up > -0.5;
    }
    var want = blocks ? ((o.h || 2) > 8 ? 0.1 : 0.22) : 1;
    o._fade = (o._fade === undefined ? 1 : o._fade);
    o._fade += (want - o._fade) * Math.min(1, dt * 7);
    _applyObstacleFade(o, o._fade);
  });
}
function _applyObstacleFade(o, a) {
  if (a > 0.97) {
    if (o._fadeMats) {
      o.mesh.traverse(function(m) { if (m.isMesh && m.userData._origMat) { m.material = m.userData._origMat; delete m.userData._origMat; } });
      o._fadeMats.forEach(function(c) { c.dispose(); });
      o._fadeMats = null;
    }
    return;
  }
  if (!o._fadeMats) {
    o._fadeMats = [];
    o.mesh.traverse(function(m) {
      if (!m.isMesh || m.userData._origMat) return;
      m.userData._origMat = m.material;
      var arr = Array.isArray(m.material);
      var mats = (arr ? m.material : [m.material]).map(function(x) {
        var c = x.clone(); c.transparent = true; c.depthWrite = false; c.userData._fadeBase = x.opacity; o._fadeMats.push(c); return c;
      });
      m.material = arr ? mats : mats[0];
    });
  }
  o._fadeMats.forEach(function(c) { c.opacity = c.userData._fadeBase * a; });
}

// ── HOLE INTRO FLYOVER ───────────────────────────────────────────────────────
var INTRO_LEN = 3.6, introT = 0, introCurve = null;
function _startIntro(h) {
  var C = h.course, pts = [new THREE.Vector3(h.bx, C.basket.y, h.bz)];
  for (var i = C.route.length - 2; i >= 1; i--) pts.push(new THREE.Vector3(C.route[i].x, C.route[i].y, C.route[i].z));
  var nx = C.route[1] || { x: h.bx, z: h.bz }, dx = C.tee.x - nx.x, dz = C.tee.z - nx.z, dl = Math.hypot(dx, dz) || 1;
  pts.push(new THREE.Vector3(C.tee.x, C.tee.y, C.tee.z));
  pts.push(new THREE.Vector3(C.tee.x + dx / dl * 9, C.tee.y + 1, C.tee.z + dz / dl * 9));
  // drop points that are too close together (a CatmullRom with duplicate points breaks)
  pts = pts.filter(function(p, k) { return k === 0 || p.distanceTo(pts[k - 1]) > 0.5; });
  introCurve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  introT = INTRO_LEN;
  var ban = document.getElementById("hole-banner");
  if (ban) {
    var nm = (typeof MAP_DISPLAY_NAMES !== "undefined" && MAP_DISPLAY_NAMES[h.theme]) || h.theme;
    ban.innerHTML = "<div class='hb-hole'>Hole " + h.n + "</div><div class='hb-meta'>Par " + h.par + " &nbsp;·&nbsp; " + (h.routeLen || 0) + " m &nbsp;·&nbsp; " + _themeName(h.theme) + "</div><div class='hb-skip'>Tap or press any key to skip</div>";
    ban.classList.add("on");
  }
}
function skipIntro() {
  introT = 0;
  var ban = document.getElementById("hole-banner");
  if (ban) ban.classList.remove("on");
}

// ── LOAD HOLE ────────────────────────────────────────────────────────────────
function loadHole(idx) {
  holeIdx = idx;
  if (typeof POD !== "undefined") POD.hide();
  if (typeof MENU3D !== "undefined") MENU3D.clear();
  CAMFX.fadeIn();
  _menuBackdrop = false;
  if (!basketWP)     basketWP     = new THREE.Vector3();
  if (!lastValidPos) lastValidPos = new THREE.Vector3();
  // Free GPU memory from the previous hole (geometry, materials, textures)
  var _oldCourse = courseGrp.children.slice();
  while (courseGrp.children.length) courseGrp.remove(courseGrp.children[0]);
  _oldCourse.forEach(function(o) { GFX.disposeTree(o); });
  if (typeof _glbMixers !== "undefined") _glbMixers.length = 0;
  GFX.waterMat = null;

  seedRNG(matchSeed + idx * 7331);
  HOLES[idx] = generateHole(idx + 1);
  const h = HOLES[idx];

  applyThemeVisuals(h.theme);
  AudioEngine.playTheme(h.theme, (matchSeed + idx * 7919) >>> 0);

  seedRNG(matchSeed + idx * 9999);
  // ── Build the course for this theme (islands, highlands, city, club, interior, blocks, moon, castle) ──
  h.mods = LV.pickMods(LV.ARCH[h.theme] || "islands", idx, h.theme);
  if (DIFFICULTY === "easy") h.mods = h.mods.slice(0, Math.max(0, h.mods.length - 1));
  if (DIFFICULTY === "chaos" && idx >= 1 && h.mods.length < 3) { var _xm = LV.pickMods(LV.ARCH[h.theme] || "islands", 12, h.theme); _xm.forEach(function(m) { if (h.mods.indexOf(m) < 0 && h.mods.length < 3) h.mods.push(m); }); }
  var _built = LV.build(h, idx), C = _built.course;
  C.onCrumble = function(i) { if (mpMode && i >= 0) sendToAll({ t: "crumble", h: idx, i: i }); };
  courseGrp.add(C.group);
  var _wk = (GFX.themePreset(h.theme).water || {}).kind;
  if (C.hazard.type === "water" || C.hazard.type === "lava" || (C.hazard.type === "void" && _wk === "grid")) {
    var _wm = GFX.buildWater(h); courseGrp.add(_wm); C.waterMesh = _wm;
  }
  var _vista = typeof WORLD !== "undefined" ? WORLD.build(h, idx, C) : null;
  if (_vista) courseGrp.add(_vista);
  else if (C.backdrop) courseGrp.add(buildBackdrop(h, idx, C));
  // Tee pad + tee sign
  var _tpad = buildTeePad(C.tee.yaw, C.tee.y); _tpad.position.set(C.tee.x, 0, C.tee.z); courseGrp.add(_tpad);
  if (!C.ceiling) { var _tsign = buildTeeSign(h, C.tee.yaw, C.tee.y); _tsign.position.x += C.tee.x; _tsign.position.z += C.tee.z; courseGrp.add(_tsign); }
  C.group.userData.batchShadows = true;
  GFX.batchStatic(C.group);

  platformEntities = [];
  var by = C.basket.y;
  var basket = buildBasket(h.n);
  basket.position.set(h.bx, by, h.bz);
  courseGrp.add(basket);
  currentBasket = basket;
  basketBase.set(h.bx, by, h.bz);
  basketWP.set(h.bx, by + BASKET_DIM.centerY, h.bz);
  // Basket beacon — soft light shaft visible from anywhere on the course
  var _night = GFX.themePreset(h.theme).sun[1] < 1.5;
  var _bcLight = new THREE.PointLight(0xffc860, _night ? 1.8 : 0.6, 14, 2);
  _bcLight.position.set(h.bx, by + 2.6, h.bz);
  _bcLight.userData.priority = 10;
  courseGrp.add(_bcLight);
  if (!C.ceiling) courseGrp.add(_buildBeacon(h.bx, by, h.bz, _night));

  // Living obstacles (critters, traffic, socks, feet, lasers …)
  obstacles = ENT.spawnAll(h, _built.spawns, idx);
  if (typeof VEH !== "undefined") VEH.spawnFor(h);

  initTrajDots();
  initTrail();
  spawnPowerups(h, idx);
  GAD.build(h, C, _built.spawns, idx);   // bounce pads, updraft fans, barrels, geese (srng: same on every client)
  BT.onHoleStart(h);
  LIFE.build(h, C);
  FEEL.build(h, C);
  window._holeT0 = T;
  if (idx === 0) window._matchT0 = Date.now();
  LOG.ev(idx === 0 ? "match_start" : "hole_start", { hole: idx, theme: h.theme, mp: !!mpMode, players: mpMode ? playerCount : 1, mode: mpMode ? BT.mode : "solo" });
  if (BT.on()) TIPS.show("battle", null, 4000); else TIPS.show("aim", null, 4500);

  GFX.fogBoost = h.mods.indexOf("fog") >= 0 ? 3.2 : 1;
  // Weather that fits the world: none indoors, in space or in the neon clubs
  var _wArch = h.arch, weathers = ["clear","clear","clear","windy","rainy","foggy","hot","stormy","snow"];
  if (_wArch === "interior" || _wArch === "club" || _wArch === "moon" || h.theme === "geometry_dash" || h.theme === "skyblock") weathers = ["clear"];
  else if (h.theme === "winter") weathers = ["clear", "clear", "snow", "windy"];
  else if (h.theme === "grandcanyon" || h.theme === "emote") weathers = ["clear", "clear", "hot", "windy"];
  else if (_wArch === "bouncy") weathers = ["clear", "clear", "clear", "windy"];
  else if (h.theme === "jungle") weathers = ["clear", "clear", "hot", "rainy", "foggy"];
  else if (h.theme === "city") weathers = ["clear", "clear", "rainy", "foggy", "stormy"];
  else weathers = weathers.filter(function(w) { return w !== "snow"; });
  var _pickedWeather = weathers[Math.floor(Math.random() * weathers.length)];
  setWeather(_pickedWeather);
  if (mpMode && myIdx === 0) sendToAll({ t: "weather_sync", weather: _pickedWeather });

  // Start on the tee pad
  var sy = C.tee.y + 0.06;
  discPos.set(C.tee.x, sy, C.tee.z);
  discLie = discPos.clone();
  _aimSince = T;
  PL.reset(C.tee.x, C.tee.y, C.tee.z, C.tee.yaw);
  discVel.set(0, 0, 0);
  discSpin = 0;

  if (discMesh)   scene.remove(discMesh);
  if (fpHandMesh) { scene.remove(fpHandMesh); fpHandMesh = null; }

  discMesh = buildDisc(selectedDisc);
  discMesh.visible = true;  // visibility managed per-frame in animate loop
  discMesh.frustumCulled = false;
  discMesh.traverse(function(child) {
    if (child.isMesh) { child.frustumCulled = false; child.renderOrder = 1; }
  });
  scene.add(discMesh);
  discMesh.position.copy(discPos);

  // FP hand mesh — arm + disc visible from first-person view
  (function() {
    var g  = new THREE.Group();
    var d2 = DISCS[selectedDisc] || DISCS.driver;
    var col = d2.color || 0x888888;
    var armMat = new THREE.MeshStandardMaterial({color:0xe8b48a, roughness:0.7});
    var arm  = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.055,0.35,10), armMat);
    arm.rotation.x = Math.PI/2; arm.position.z = -0.17; g.add(arm);
    var disc2 = buildDisc(selectedDisc);
    disc2.scale.setScalar(0.42); disc2.rotation.x = 0.25; g.add(disc2);
    g.frustumCulled = false;
    g.traverse(function(c){if(c.isMesh){c.frustumCulled=false;c.renderOrder=2;}});
    fpHandMesh = g;
    scene.add(fpHandMesh);
    fpHandMesh.visible = (cameraMode === "fp" && (phase === "AIMING" || phase === "LANDED"));
  })();

  // Local player avatar — visible in TP mode
  if (localAvatarMesh) scene.remove(localAvatarMesh);
  if (typeof buildPlayerAvatar === "function") {
    var _myColor = PLAYER_COLORS[myIdx % PLAYER_COLORS.length] || 0x00ffff;
    localAvatarMesh = buildPlayerAvatar(myIdx, _myColor);
    localAvatarMesh.visible = (cameraMode === "tp");
    scene.add(localAvatarMesh);
  }

  remotePlayers.forEach(function(rp) {
    if (!rp) return;
    if (rp.discMesh) scene.remove(rp.discMesh);
    if (rp.avatarMesh) scene.remove(rp.avatarMesh);
    if (rp.nameLabel && rp.nameLabel.parentNode) rp.nameLabel.parentNode.removeChild(rp.nameLabel);
  });
  remotePlayers = Array.from({ length: MAX_PLAYERS }, () => null);
  if (mpMode) {
    for (let i = 0; i < playerCount; i++) {
      if (i === myIdx || (window._leftPlayers && window._leftPlayers[i])) continue;
      var _rpCol = PLAYER_COLORS[i % PLAYER_COLORS.length];
      // Start remote player at tee surface, offset slightly so they don't stack
      var _teeOffX = C.tee.x + (i - myIdx) * 1.2;
      var _teeY = terrainY(_teeOffX, C.tee.z, h, idx);
      const rp = {
        discPos: new THREE.Vector3(_teeOffX, _teeY + 0.3, C.tee.z),
        discVel: new THREE.Vector3(), spin: 0, flying: false, discMesh: null,
        avatarMesh: null, nameLabel: null,
        discType: PLAYER_DISC_TYPES[i] || "midrange",
        color: _rpCol, name: playerNames[i] || ("Player "+(i+1)), aimAngle: 0,
        targetX: _teeOffX, targetZ: C.tee.z, targetY: _teeY,
        velMag: 0,
      };
      rp.discMesh = buildDisc(rp.discType, 0.72);
      rp.discMesh.position.copy(rp.discPos);
      rp.discMesh.visible = false;
      scene.add(rp.discMesh);
      if (typeof buildPlayerAvatar === "function") {
        rp.avatarMesh = buildPlayerAvatar(i, _rpCol);
        rp.avatarMesh.position.copy(rp.discPos);
        scene.add(rp.avatarMesh);

      }
      if (typeof createNameLabel === "function") rp.nameLabel = createNameLabel(rp.name, _rpCol);
      remotePlayers[i] = rp;
    }
  }

  baseAim      = autoAimAngle();
  aimAngle     = baseAim;
  throwPower   = 0;
  phase        = "AIMING";
  throwCount   = 0;
  myHoleDone   = false;
  (function(){
    var _sa=baseAim,_cd=new THREE.Vector3(Math.sin(_sa),0,-Math.cos(_sa));
    var _dist=Math.min(15,Math.hypot(h.bx-discPos.x,h.bz-discPos.z)*0.5+7);
    var _sy=C.tee.y+0.06;
    if(typeof _camPos!=="undefined") _camPos.set(discPos.x-_cd.x*_dist,_sy+8,discPos.z-_cd.z*_dist);
    if(typeof _camLook!=="undefined") _camLook.set(discPos.x+_cd.x*6,_sy+1.5,discPos.z+_cd.z*6);
  })();
  playerDone.fill(false);
  playerThrows.fill(0);
  mpScoreRecorded.fill(false);
  clearThrowHistory();
  setSpectating(false);

  const fnb = document.getElementById("force-next-btn");
  if (fnb) fnb.style.display = mpMode && myIdx === 0 ? "grid" : "none";
  const gub = document.getElementById("giveup-btn");
  if (gub) { gub.style.display = ""; }

  hideMsg();
  document.getElementById("pwr-bar").style.display = "none";
  document.getElementById("dist").style.opacity    = "0";
  trajDots.forEach((d) => (d.visible = false));
  updateScoreUI();
  updateWindUI();
  initGameDiscPicker();
  // Show "Theme • Layout" permanently (no confusing timeout flash)
  var _hTxt = document.getElementById("hole-theme-txt");
  if (_hTxt) {
    var _thName = (h.theme||"").replace(/_/g," ");
    _thName = _thName.charAt(0).toUpperCase() + _thName.slice(1);
    _hTxt.textContent = (h.templateLabel ? _thName + " · " + h.templateLabel : _thName) +
      (h.mods && h.mods.length ? "  " + h.mods.map(function(m) { return (LV.MODS[m] || {}).icon || ""; }).join(" ") : "");
    _hTxt.title = (h.mods || []).map(function(m) { var M = LV.MODS[m]; return M ? M.label + " — " + M.desc : ""; }).join("\n");
  }

  document.body.classList.toggle("mp", !!mpMode);

  // ── Graphics finishing pass ──
  GFX.upgradeMaterials(courseGrp);
  GFX.capLights(courseGrp, C.route);
  GFX.setFoamIslands((h._foamStatic || []).slice());
  GFX._focus.set(C.tee.x, sy, C.tee.z);
  _setWalkHud(false);
  releaseBank = 0; updateReleaseUI();
  _throwStart = null;
  if (typeof resetMinimap === "function") resetMinimap();
  _startIntro(h);
}

// ── AUTO AIM ─────────────────────────────────────────────────────────────────
// Points at the next island along the route (not straight at the basket, which
// on doglegs means aiming over open water).
function autoAimAngle() {
  var h = HOLES[holeIdx]; if (!h || !h.course) return 0;
  var C = h.course, R = C.route;
  // Within reach of the basket: aim at it. Otherwise aim at the next route point
  // that is ahead of the disc and in line of sight.
  if (Math.hypot(h.bx - discPos.x, h.bz - discPos.z) < 32) return Math.atan2(h.bx - discPos.x, -(h.bz - discPos.z));
  var pd = LV.polyDist(R, discPos.x, discPos.z), tot = 0;
  for (var i = 1; i < R.length; i++) tot += Math.hypot(R[i].x - R[i - 1].x, R[i].z - R[i - 1].z);
  var best = null;
  for (var k = 40; k >= 8; k -= 4) {
    var p = LV.pointAt(R, Math.min(1, pd.t + k / (tot || 1)));
    if (_lineClear(C, discPos.x, discPos.y + 1, discPos.z, p.x, C.heightAt(p.x, p.z) + 1.5, p.z)) { best = p; break; }
  }
  if (!best) best = LV.pointAt(R, Math.min(1, pd.t + 10 / (tot || 1)));
  return Math.atan2(best.x - discPos.x, -(best.z - discPos.z));
}
function _lineClear(C, ax, ay, az, bx, by, bz) {
  var n = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5);
  for (var i = 1; i < n; i++) {
    var t = i / n, y = ay + (by - ay) * t;
    if (C.heightAt(ax + (bx - ax) * t, az + (bz - az) * t) > y) return false;
    if (C.ceiling && y > C.ceiling) return false;
  }
  return true;
}

// ── SCORING ───────────────────────────────────────────────────────────────────
function scoreLabel(throws, par) {
  if (throws === 1) return { t: "Ace!", c: "#ffe27a" };
  var d = throws - par;
  if (d <= -3) return { t: "Albatross!", c: "#ffd0f4" };
  if (d === -2) return { t: "Eagle!", c: "#ffe27a" };
  if (d === -1) return { t: "Birdie!", c: "#b4ffbf" };
  if (d === 0)  return { t: "Par", c: "#ffffff" };
  if (d === 1)  return { t: "Bogey", c: "#ffe2d6" };
  if (d === 2)  return { t: "Double bogey", c: "#ffd2c4" };
  return { t: "+" + d, c: "#ffc4b6" };
}
function _fmtPar(v) { v = Math.round(v); return v === 0 ? "E" : v > 0 ? "+" + v : "" + v; }

// Persistent player stats (localStorage)
var dgStats = { holes: 0, aces: 0, birdies: 0, longest: 0, best: {} };
(function() { try { var s = localStorage.getItem("dg_stats"); if (s) Object.assign(dgStats, JSON.parse(s)); } catch (e) {} })();
function saveStats() { try { localStorage.setItem("dg_stats", JSON.stringify(dgStats)); } catch (e) {} }

function scored() {
  phase = "SCORED";
  _setWalkHud(false);
  discPos.set(basketWP.x, basketWP.y - 0.2, basketWP.z);
  discVel.set(0, 0, 0); discSpin = 0;
  discMesh.position.copy(discPos); discMesh.rotation.z = 0;

  const par    = HOLES[holeIdx].par;
  const diff   = throwCount - par;
  const labels = ["ACE!", "ALBATROSS!", "EAGLE!", "BIRDIE!", "PAR", "BOGEY", "DOUBLE BOGEY", "+3"];
  const idx2   = throwCount === 1 ? 0 : Math.max(1, Math.min(7, diff + 4));

  if (holeScores[holeIdx] === undefined || holeScores[holeIdx] === null) {
    holeScores[holeIdx] = throwCount;
    totalVsPar += diff;
  }
  myHoleDone = true;
  dgStats.holes++;
  if (throwCount === 1) dgStats.aces++;
  if (diff < 0) dgStats.birdies++;
  saveStats();
  // Basket impact + skin unlocks
  if (typeof handleImpact === "function") handleImpact("basket", basketWP.clone(), discVel.clone());
  if (typeof unlockedSkins !== "undefined") {
    var _hComp = (holeScores||[]).filter(function(h){return h!==null;}).length;
    if(_hComp>=3&&!unlockedSkins.sawblade){unlockedSkins.sawblade=true;saveUnlocked();showMsg("SKIN UNLOCKED!","⚙️ Saw Blade!",null);setTimeout(hideMsg,3000);}
    if(_hComp>=5&&!unlockedSkins.gold)   {unlockedSkins.gold=true;    saveUnlocked();showMsg("SKIN UNLOCKED!","✨ Gold!",null);setTimeout(hideMsg,3000);}
    if(_hComp>=9&&!unlockedSkins.ice)    {unlockedSkins.ice=true;     saveUnlocked();}
    if(_hComp>=18&&!unlockedSkins.galaxy){unlockedSkins.galaxy=true;  saveUnlocked();}
    if(_hComp>=36&&!unlockedSkins.rainbow){unlockedSkins.rainbow=true;saveUnlocked();}
    if(throwCount===1&&!unlockedSkins.neon_pink){unlockedSkins.neon_pink=true;saveUnlocked();showMsg("ACE UNLOCK!","💜 Neon Pink!",null);setTimeout(hideMsg,3000);}
    if(throwCount===1&&!unlockedSkins.ufo){unlockedSkins.ufo=true;saveUnlocked();}
  }
  if (throwCount === 1 && typeof celebrateAce === "function") {
    celebrateAce(basketWP.clone());
  } else if (selectedDisc === "vilov") {
    spawnExplosion(basketWP.clone());
  }
  if (throwCount !== 1) AudioEngine.stinger(diff <= -2 ? "eagle" : diff === -1 ? "birdie" : diff === 0 ? "par" : diff === 1 ? "bogey" : "worse");
  pushThrowHistory();
  CINE.onScore(throwCount, par, _throwStart ? Math.hypot(_throwStart.x - basketWP.x, _throwStart.z - basketWP.z) : 0);
  EMOTE.celebrate(); PROG.hole(throwCount, par);
  LOG.ev("hole_end", { hole: holeIdx, throws: throwCount, par: par, theme: HOLES[holeIdx].theme, sec: Math.round(T - (window._holeT0 || T)), mp: !!mpMode });

  if (mpMode) {
    playerDone[myIdx]   = true;
    playerThrows[myIdx] = throwCount;
    if (!mpScoreRecorded[myIdx]) { mpTotals[myIdx] += diff; mpScoreRecorded[myIdx] = true; }
    var _sm = { t: "score", from: myIdx, throws: throwCount, hole: holeIdx, el: +(netTime() - BT.holeStartT).toFixed(1),
      lm: _throwStart ? +Math.hypot(_throwStart.x - basketWP.x, _throwStart.z - basketWP.z).toFixed(1) : 0 };
    sendToAll(_sm);
    BT.onScore(myIdx, throwCount, _sm);
    updateMpUI();
    if (!checkAllDone()) {
      if (BT.on()) { showMsg(labels[idx2], "Keep causing chaos while the others finish\u2026", null); BT.goRoam(); }
      else {
        const watchIdx = playerDone.findIndex((d, i) => !d && i < playerCount);
        setSpectating(true, watchIdx);
        showMsg(labels[idx2], "Watching others\u2026", null);
      }
    }
  } else {
    setSpectating(false);
    var _sl = scoreLabel(throwCount, par);
    showMsg(_sl.t, throwCount + (throwCount === 1 ? " throw" : " throws") + " \u00b7 Par " + par + " \u00b7 Total " + _fmtPar(totalVsPar),
      holeIdx + 1 >= HOLE_COUNT ? "Scorecard \u2192" : "Next Hole \u2192");
    var _mb = document.getElementById("msg-big"); if (_mb) _mb.style.color = _sl.c;
  }
  updateScoreUI();
}

var discLie = null;          // where the disc rests between throws
function landed() {
  if (!HOLES[holeIdx]) { phase = "AIMING"; return; }
  phase = "LANDED";
  PU.fireThrow = false; PU.discMod = null;
  const h = HOLES[holeIdx], m = Math.hypot(discPos.x - h.bx, discPos.z - h.bz);
  discLie = discPos.clone();
  ENT.landT = T;
  const dd = document.getElementById("dist");
  var _td = _throwStart ? Math.hypot(discPos.x - _throwStart.x, discPos.z - _throwStart.z) : 0;
  if (_td > dgStats.longest) { dgStats.longest = Math.round(_td); saveStats(); }
  dd.innerHTML = (_td > 0.5 ? "<span class='accent'>" + _td.toFixed(1) + " m throw</span> &nbsp;·&nbsp; " : "") + m.toFixed(1) + " m to basket";
  dd.style.opacity = "1";
  CINE.onLand(m, _td);
  if (mpMode) sendToAll({ t: "land", from: myIdx, px: discPos.x, py: discPos.y, pz: discPos.z, throws: throwCount });
  setTimeout(() => {
    if (phase !== "LANDED") return;
    dd.style.opacity = "0";
    if (throwCount >= 12) { _maxThrowsReached(); return; }
    // Close enough to just pick it up?
    if (Math.hypot(discPos.x - PL.pos.x, discPos.z - PL.pos.z) < 1.4) pickUpDisc();
    else startWalking(true);
  }, 1100);
}

// 12 throws used (landed or lost out of bounds): the hole is over
function _maxThrowsReached() {
  if (holeScores[holeIdx] === undefined || holeScores[holeIdx] === null) {
    holeScores[holeIdx] = throwCount;
    totalVsPar += throwCount - HOLES[holeIdx].par;
  }
  myHoleDone = true;
  playerDone[myIdx]   = true;
  playerThrows[myIdx] = throwCount;
  if (mpMode) {
    sendToAll({ t: "givenup", from: myIdx, throws: throwCount, hole: holeIdx, dnf: 1 });
    BT.onScore(myIdx, throwCount, { dnf: 1 });
    if (!mpScoreRecorded[myIdx]) { mpTotals[myIdx] += throwCount - HOLES[holeIdx].par; mpScoreRecorded[myIdx] = true; }
    updateMpUI();
    if (BT.on() && !checkAllDone()) { showMsg("MAX THROWS", "No points this hole \u2014 go wreck the others!", null); BT.goRoam(); }
    else if (!checkAllDone()) {
      const watchIdx = playerDone.findIndex((d, i) => !d && i < playerCount);
      setSpectating(true, watchIdx);
      showMsg("MAX THROWS", "Watching others finish\u2026", null);
    }
  } else {
    showMsg("MAX THROWS", "12 throws reached \u2014 moving on!", "Next Hole \u2192");
  }
}

// ── WALK → PICK UP ───────────────────────────────────────────────────────────
// After a throw you walk to the disc. Moving while aiming puts the disc down
// so you can scout ahead; come back to it to pick it up again.
var _pickupArmed = true;
var _aimSince = 0;          // T when the player last got the disc in hand
function startWalking(afterThrow) {
  if (!HOLES[holeIdx] || spectatingOpp) return;
  TIPS.show("walk", null, 600);
  phase = "WALKING";
  _pickupArmed = !!afterThrow;
  dragging = false; document.body.classList.remove("aiming");
  document.getElementById("pwr-bar").style.display = "none";
  trajDots.forEach(function(d) { d.visible = false; });
  if (trajLandRing) trajLandRing.visible = false;
  if (!afterThrow) { var g = terrainY(discPos.x, discPos.z, HOLES[holeIdx], holeIdx); discPos.y = g + 0.06; }
  PL.camYaw = afterThrow ? Math.atan2(discPos.x - PL.pos.x, -(discPos.z - PL.pos.z)) : aimAngle;
  _setWalkHud(true);
}
function pickUpDisc() {
  var h = HOLES[holeIdx]; if (!h) return;
  if (typeof RAG !== "undefined" && RAG.me) RAG.stop(localAvatarMesh, false);   // get up to take the next shot
  if (typeof VEH !== "undefined" && VEH.mySeat) VEH.exit();
  var C = h.course, g = C.heightAt(discPos.x, discPos.z);
  phase = "AIMING"; _aimSince = T;
  PL.pos.set(discPos.x, g, discPos.z); PL.vel.set(0, 0, 0); PL.onGround = true;
  discPos.y = g + 0.06; discLie = discPos.clone();
  baseAim = autoAimAngle(); aimAngle = baseAim;
  PL._setAnim("idle");
  AudioEngine.sfx("pickup");
  _setWalkHud(false);
  if (mpMode) sendToAll({ t: "land", from: myIdx, px: discPos.x, py: discPos.y, pz: discPos.z, throws: throwCount });
}
// Unplayable lie (stuck on a roof, inside a hedge…): +1 stroke, back to the previous lie
function takeRelief() {
  if (phase !== "WALKING" && phase !== "LANDED") return;
  var h = HOLES[holeIdx]; if (!h) return;
  throwCount++;
  var prev = throwHistory.length ? throwHistory[throwHistory.length - 1].pos.clone() : new THREE.Vector3(h.course.tee.x, h.course.tee.y, h.course.tee.z);
  if (ENT.carrying) { ENT.carrying.state = null; ENT.carrying = null; }
  discPos.copy(prev);
  pickUpDisc();
  _flashPrompt("Relief taken · +1 stroke");
  updateScoreUI();
}
// HUD for the walking phase: distance to the disc, relief button, mobile stick + jump
function _setWalkHud(on) {
  document.body.classList.toggle("walking", !!on);
  var wh = document.getElementById("walk-hud"); if (wh) wh.classList.toggle("on", !!on);
  if (discMarker) discMarker.visible = !!on;
}
var _promptT = null;
function _flashPrompt(txt) {
  var el = document.getElementById("prompt-toast"); if (!el) return;
  el.textContent = txt; el.classList.add("on");
  clearTimeout(_promptT); _promptT = setTimeout(function() { el.classList.remove("on"); }, 2200);
}
function _modChips(h) {
  if (!h.mods || !h.mods.length) return "";
  return "<div class='hb-mods'>" + h.mods.map(function(m) { var M = LV.MODS[m]; return M ? "<span class='hb-mod' title='" + M.desc + "'>" + M.icon + " " + M.label + "</span>" : ""; }).join("") + "</div>";
}
// Pulsing ring + light column marking the resting disc
var discMarker = null;
function _buildDiscMarker() {
  var g = new THREE.Group();
  var ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
  var col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.35, 6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x8adcff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map: GFX._texCache.beacon || null }));
  col.position.y = 3; g.add(col);
  g.userData.ring = ring; g.userData.col = col; g.visible = false;
  return g;
}

function outOfBounds(isTimeout) {
  if (!HOLES[holeIdx]) return;
  LOG.ev("ob", { x: Math.round(discPos.x), z: Math.round(discPos.z), theme: HOLES[holeIdx].theme, hole: holeIdx, who: isTimeout ? "timeout" : "disc" });
  phase = "SCORED";
  throwCount++;
  var h2 = HOLES[holeIdx];
  var _hzT0 = h2.course ? h2.course.hazardAt(discPos.x, discPos.z).type : "water";
  if (typeof handleImpact === "function") {
    var _hazType = isTimeout ? "energy"
      : _hzT0 === "ob" ? "terrain" : (h2.theme==="moon"||h2.theme==="grandcanyon") ? "crater" : "water";
    handleImpact(_hazType, discPos.clone(), discVel.clone());
  }
  var _hz = h2.course ? h2.course.hazardAt(discPos.x, discPos.z).type : "water";
  var hazardMsg = isTimeout ? "Lost in the void"
    : _hz === "lava" ? "Into the lava"
    : _hz === "void" ? (h2.theme === "moon" ? "Down the crater" : h2.theme === "bouncy" ? "Into the ball pit!" : "Lost in the void")
    : _hz === "none" || _hz === "ob" ? "Out of bounds"
    : h2.theme === "poolrooms" ? "Into the pool"
    : "Water hazard";
  if (ENT.carrying) { ENT.carrying.state = null; ENT.carrying = null; }
  _setWalkHud(false);
  showMsg(hazardMsg, "+1 stroke \u00b7 back to your last lie", null);
  if (!isTimeout) AudioEngine.stinger("water");
  updateScoreUI();
  setTimeout(() => {
    if (phase !== "SCORED") return;
    hideMsg();
    if (throwCount >= 12) { _maxThrowsReached(); return; }   // out of throws: no endless splashing from the same lie
    // Back to the lie the disc was thrown from (where the player is standing)
    var _rp = (typeof throwHistory !== "undefined" && throwHistory.length > 0)
      ? throwHistory[throwHistory.length - 1].pos.clone()
      : (discLie ? discLie.clone() : lastValidPos.clone());
    discPos.copy(_rp); discVel.set(0, 0, 0); discSpin = 0;
    discMesh.visible = true;
    pickUpDisc();
    PL._setAnim("idle");
    if (mpMode) sendToAll({ t: "land", from: myIdx, px: discPos.x, py: discPos.y, pz: discPos.z, throws: throwCount });
  }, 2000);
}

// ── INIT GAME ─────────────────────────────────────────────────────────────────
var HOLE_COUNT = 18;   // total holes to play
var DIFFICULTY = "normal";  // easy/normal/hard/chaos

// Difficulty affects: wind strength, obstacle count, island size, par
var DIFFICULTY_PRESETS = {
  easy:   { windScale: 0.4, obstacleCount: 1, islandRadiusMult: 1.3, windMagMax: 3  },
  normal: { windScale: 1.0, obstacleCount: 4, islandRadiusMult: 1.0, windMagMax: 8  },
  hard:   { windScale: 1.6, obstacleCount: 7, islandRadiusMult: 0.85, windMagMax: 12 },
  chaos:  { windScale: 2.5, obstacleCount: 10, islandRadiusMult: 0.7, windMagMax: 20 },
};

function setHoleCount(v) {
  HOLE_COUNT = parseInt(v) || 18;
}
function setDifficulty(v) {
  DIFFICULTY = v;
  // Regenerate holes with new difficulty if not yet started
}

// ── ADVANCE HOLE — single player ─────────────────────────────────────────────
function advanceHole() {
  // only from a finished hole (holed out or out of throws), and once per hole
  if (holeScores[holeIdx] === null || holeScores[holeIdx] === undefined) return;
  if (window._advancedFrom === holeIdx + "_" + matchSeed) return;
  window._advancedFrom = holeIdx + "_" + matchSeed;
  var next = holeIdx + 1;
  if (next >= HOLE_COUNT) {
    hideMsg();
    showFinalScorecard();
    return;
  }
  holeIdx = next;
  seedRNG(matchSeed + next * 7331);
  HOLES[next] = generateHole(next + 1);
  loadHole(next);
}

// ── FINAL SCORECARD ──────────────────────────────────────────────────────────
function showFinalScorecard() {
  phase = "SCORED";
  var key = HOLE_COUNT + "_" + DIFFICULTY;
  var prevBest = dgStats.best[key];
  var isBest = prevBest === undefined || totalVsPar < prevBest;
  if (isBest) { dgStats.best[key] = totalVsPar; saveStats(); }
  var el = document.getElementById("final-card");
  if (!el) return;
  var rows = [[], [], []], totPar = 0, totThr = 0;
  for (var i = 0; i < HOLE_COUNT; i++) {
    var par = HOLES[i] ? HOLES[i].par : 3, sc = holeScores[i];
    totPar += par; totThr += (sc || 0);
    var cls = sc === null || sc === undefined ? "" : sc === 1 ? "ace" : sc < par - 1 ? "eagle" : sc < par ? "birdie" : sc === par ? "par" : sc === par + 1 ? "bogey" : "dbl";
    rows[0].push("<th>" + (i + 1) + "</th>");
    rows[1].push("<td>" + par + "</td>");
    rows[2].push("<td><span class='sc " + cls + "'>" + (sc == null ? "–" : sc) + "</span></td>");
  }
  var cur = POD.saveRound(totalVsPar);
  var html = "<div class='fc-total " + (totalVsPar < 0 ? "under" : totalVsPar > 0 ? "over" : "even") + "'>" + _fmtPar(totalVsPar) + "</div>" +
    "<div class='fc-sub'>" + totThr + " throws · par " + totPar + " · " + HOLE_COUNT + " holes · " + DIFFICULTY + (isBest ? " · <b>New personal best!</b>" : " · best " + _fmtPar(prevBest)) + "</div>" +
    "<div class='fc-scroll'><table class='fc-table'><tr><th>Hole</th>" + rows[0].join("") + "</tr><tr><td>Par</td>" + rows[1].join("") + "</tr><tr><td>You</td>" + rows[2].join("") + "</tr></table></div>" +
    POD.bestBoard(cur) +
    (typeof PF !== "undefined" ? PF.roundEnd(totalVsPar) : "") +
    "<div class='fc-stats'>Lifetime · " + dgStats.holes + " holes · " + dgStats.aces + " aces · " + dgStats.birdies + " birdies · longest throw " + dgStats.longest + " m</div>";
  POD.show([{ i: myIdx, name: playerNames[myIdx] || "You", score: _fmtPar(totalVsPar), sub: totThr + " throws" }], {
    title: isBest ? "New personal best!" : totalVsPar < 0 ? "Under par!" : totalVsPar === 0 ? "Level par" : "Round complete",
    mood: isBest || totalVsPar < 0 ? "win" : totalVsPar === 0 ? "clap" : "sad", html: html,
    actions: "<button class='btn primary big' onclick='POD.again()'>Play again</button><button class='btn big' onclick='POD.toMenu()'>Main menu</button>" });
}
function _fcHide() { var el = document.getElementById("final-card"); if (el) el.style.display = "none"; }
function _fcAgain() { _fcHide(); startSPWithTheme(_SP_FORCED_THEME); }
function _fcMenu() {
  _fcHide(); if (typeof POD !== "undefined") POD.hide();
  hideMsg();
  document.getElementById("menu").style.display = "flex";
  document.getElementById("ui").style.display   = "none";
  document.body.classList.remove("fp-active");
  phase = "MENU";
  _SP_FORCED_THEME = null;
  if (typeof menuView === "function") menuView("home");
  showMenuBackdrop();
  AudioEngine._gameActive = false;
  AudioEngine.stopAll();
  AudioEngine.playMenu();
}
// In-game "home" button
function quitToMenu() {
  if (phase === "MENU") return;
  if (!window.confirm(mpMode ? "Leave this multiplayer game?" : "Quit this round and return to the menu?")) return;
  if (mpMode && typeof leaveLobby === "function") { leaveLobby(); }
  _fcMenu();
}

// ── MENU BACKDROP ────────────────────────────────────────────────────────────
// A small calm island scene behind the menu with a slowly orbiting camera.
var _menuBackdrop = false;
function showMenuBackdrop() {
  var old = courseGrp.children.slice();
  while (courseGrp.children.length) courseGrp.remove(courseGrp.children[0]);
  old.forEach(function(o) { GFX.disposeTree(o); });
  if (typeof _glbMixers !== "undefined") _glbMixers.length = 0;
  [discMesh, localAvatarMesh, fpHandMesh, trailMesh, trajLandRing, discMarker].forEach(function(o) { if (o) o.visible = false; });
  ENT.clear(); GAD.clear(); RAG.clear(); document.body.classList.remove("walking");
  var _wh = document.getElementById("walk-hud"); if (_wh) _wh.classList.remove("on");
  (trajDots || []).forEach(function(d) { d.visible = false; });
  remotePlayers.forEach(function(rp) {
    if (!rp) return;
    if (rp.discMesh) scene.remove(rp.discMesh);
    if (rp.avatarMesh) scene.remove(rp.avatarMesh);
    if (rp.nameLabel && rp.nameLabel.parentNode) rp.nameLabel.parentNode.removeChild(rp.nameLabel);
  });
  var theme = "village", W = -1.5;
  GFX.setTheme(theme); GFX.setWeather("clear");
  GFX.waterMat = null;
  courseGrp.add(GFX.buildWater({ theme: theme, water: W }));
  var isl = [{ x: 0, z: 0, r: 9, e: 0 }, { x: -27, z: -16, r: 7, e: 1.4 }, { x: 24, z: -30, r: 8, e: 0.6 }, { x: -8, z: -50, r: 6.5, e: 2.2 }, { x: 36, z: 4, r: 6, e: 0.3 }];
  var foam = [];
  isl.forEach(function(p, i) {
    var surf = W + ISLAND_TOP + p.e;
    var g = GFX.buildIsland({ x: p.x, z: p.z, r: p.r, surfY: surf, waterY: W, theme: theme, type: i === 0 ? "basket" : "normal", seed: 101 + i * 37 });
    courseGrp.add(g);
    foam.push({ x: p.x, z: p.z, r: g.userData.waterlineR });
    if (i > 0) {
      (function(px, pz, py) {
        loadModel("tree", function(t) { if (!t || !_menuBackdrop) return; t.position.set(px, py, pz); t.rotation.y = px; courseGrp.add(t); });
      })(p.x + 1.5, p.z - 1, surf);
    }
  });
  GFX.setFoamIslands(foam);
  var b = buildBasket(1); b.position.set(0, W + ISLAND_TOP, 0); courseGrp.add(b);
  currentBasket = b;
  GFX.upgradeMaterials(courseGrp);
  _menuBackdrop = true;
  if (typeof MENU3D !== "undefined") MENU3D.build();   // your golfer, hanging out by the menu
}
function _menuCamera(t) {
  var a = t * 0.035 + 0.6;
  camera.position.set(Math.sin(a) * 44, 11 + Math.sin(t * 0.11) * 1.5, Math.cos(a) * 44 - 16);
  camera.lookAt(0, 2.2, -16);
}

// ── DISC LOCKER ───────────────────────────────────────────────────────────────
var _dlActiveDisc = "putter";

function openDiscLocker() {
  document.getElementById("disc-locker").style.display = "block";
  _buildDlTabs(); _buildDlGrid(_dlActiveDisc);
}
function closeDiscLocker() { document.getElementById("disc-locker").style.display = "none"; }

function _tryDiscCode() {
  var inp = document.getElementById("disc-code-input");
  if (!inp) return;
  var code = inp.value.trim().toUpperCase();
  var prv  = document.getElementById("dl-preview-name");
  inp.value = "";
  // Shared master code unlocks both disc and player skins
  var masterCode = (typeof PLAYER_SKINS_MASTER_CODE !== "undefined") ? PLAYER_SKINS_MASTER_CODE : "TOYOTA";
  if (code === masterCode) {
    if (typeof DISC_SKINS !== "undefined") {
      (DISC_SKINS._global||[]).forEach(function(s){ unlockedSkins[s.id]=true; });
      (DISC_SKINS.vilov||[]).forEach(function(s){ unlockedSkins[s.id]=true; });
    }
    if (typeof saveUnlocked === "function") saveUnlocked();
    if (typeof PLAYER_SKINS !== "undefined") {
      PLAYER_SKINS.forEach(function(s){ if (typeof unlockedPlayerSkins !== "undefined") unlockedPlayerSkins[s.id]=true; });
    }
    if (typeof saveUnlockedPlayerSkins === "function") saveUnlockedPlayerSkins();
    if (prv) prv.textContent = "🚗 ALL SKINS UNLOCKED!";
    _buildDlGrid(_dlActiveDisc);
    if (typeof _buildSkinGrid === "function") _buildSkinGrid();
    return;
  }
  if (prv) prv.textContent = "That code didn't work";
}

function _buildDlTabs() {
  var box = document.getElementById("dl-disc-tabs"); if (!box) return; box.innerHTML = "";
  Object.keys(DISCS).forEach(function(disc) {
    var btn = document.createElement("button");
    btn.className = "chip" + (disc === _dlActiveDisc ? " on" : "");
    btn.innerHTML = "<span class='dot' style='background:" + _discCss(disc) + "'></span>" + (DISCS[disc].label || disc);
    btn.onclick = function(){ _dlActiveDisc = disc; _buildDlTabs(); _buildDlGrid(disc); };
    box.appendChild(btn);
  });
}

function _buildDlGrid(discType) {
  var grid = document.getElementById("dl-skin-grid");
  var prv  = document.getElementById("dl-preview-name");
  if (!grid) return; grid.innerHTML = "";
  if (typeof DISC_SKINS === "undefined" || !DISC_SKINS._global) return;
  var skins = DISC_SKINS._global.slice();
  if (discType==="vilov"&&DISC_SKINS.vilov) skins=skins.concat(DISC_SKINS.vilov);
  var eqId = (equippedSkins&&equippedSkins[discType])||"classic";
  skins.forEach(function(skin) {
    var locked = !(unlockedSkins&&unlockedSkins[skin.id]);
    var isEq   = eqId === skin.id;
    var rarCol = (RARITY_COLORS&&RARITY_COLORS[skin.rarity])||"#aaa";
    var card = document.createElement("div");
    card.className = "skin-card" + (isEq ? " active" : "") + (locked ? " locked" : "");
    card.title = (skin.desc||"") + (locked && skin.unlock ? " — Unlock: " + skin.unlock : "");
    var col = skin.color != null ? "#" + skin.color.toString(16).padStart(6,"0") : _discCss(discType);
    if (skin.rainbow) col = "conic-gradient(#ff6a6a,#ffd36a,#7bff8a,#6ad8ff,#b46aff,#ff6a6a)";
    var tags = (skin.shape||skin.giant ? "<span class='tag'>SHAPE</span>" : "") + (skin.particles ? "<span class='tag'>FX</span>" : "");
    card.innerHTML =
      "<span class='orb' style='--c:" + col + "'></span>" +
      "<div class='skin-name'>" + skin.name + "</div>" +
      "<span class='rarity' style='color:" + rarCol + "'>" + skin.rarity + "</span>" + tags +
      "<div class='skin-meta'>" + (locked ? "🔒 " + (skin.unlock||"") : isEq ? "✓ Equipped" : "&nbsp;") + "</div>";
    if (!locked) {
      card.onclick = function() {
        equippedSkins[discType]=skin.id; saveSkins();
        if(prv) prv.textContent = skin.name + " equipped";
        _buildDlGrid(discType);
        if (typeof initGameDiscPicker === "function") initGameDiscPicker();
        if(typeof discMesh!=="undefined"&&discMesh&&selectedDisc===discType&&typeof buildDisc==="function"&&scene&&phase!=="MENU") {
          scene.remove(discMesh); discMesh=buildDisc(discType);
          discMesh.frustumCulled=false;
          discMesh.traverse(function(c){if(c.isMesh){c.frustumCulled=false;c.renderOrder=1;}});
          scene.add(discMesh);
        }
        if(typeof mpMode!=="undefined"&&mpMode&&typeof sendToAll==="function") {
          sendToAll({t:"skin_equip",disc:discType,skin:skin.id,from:myIdx});
        }
      };
    }
    grid.appendChild(card);
  });
}

// ── SP MAP PICKER ─────────────────────────────────────────────────────────────
var _SP_FORCED_THEME = null;  // null = random, string = lock every SP hole to this theme

function toggleSpMapPicker() {
  var picker = document.getElementById("sp-map-picker");
  var show = !picker || picker.style.display === "none";
  menuView(show ? "play" : "home");
}

// Course tiles show each theme's own sky colours
function _buildSpMapPicker() {
  var grid = document.getElementById("sp-map-grid");
  if (!grid || grid.children.length > 0) return;  // already built
  THEMES.forEach(function(th) {
    var P = GFX.themePreset(th), full = (MAP_DISPLAY_NAMES[th] || th);
    var em = (full.match(/^[^A-Za-z0-9]+/) || [""])[0].trim();
    var hx = function(c) { return "#" + (c >>> 0).toString(16).padStart(6, "0"); };
    var tile = document.createElement("button");
    tile.className = "tile";
    tile.style.background = "linear-gradient(180deg," + hx(P.zen) + " 0%," + hx(P.hor) + " 62%," + hx(P.surf.top) + " 63%," + hx(P.surf.edge) + " 100%)";
    tile.innerHTML = "<span class='em'>" + em + "</span><span class='nm'>" + _themeName(th) + "</span>";
    tile.title = "Play " + _themeName(th);
    tile.onclick = function(){ startSPWithTheme(th); };
    grid.appendChild(tile);
  });
}

function startSPWithTheme(theme) {
  _SP_FORCED_THEME = theme || null;
  startGame(false);
}

var MAP_POOLS = {
  all:null,
  spooky:["eerie","terrifying","backrooms","screaming_mamamia","poolrooms","hogwarts"],
  funny:["funny","feet_bunnies","socks_basket","public_poo","minion","emote","minecraft","bouncy"],
  urban:["city","office","disco","neon","geometry_dash"],
  nature:["mountains","winter","waterfall","cabbage","village","grandcanyon","jungle"],
  new:["jungle","bouncy","poolrooms","hogwarts","village","minecraft","skyblock"],
};
function setMapPool(name){
  ACTIVE_THEMES=MAP_POOLS[name]||null;
  var lbl=document.getElementById("pool-label");
  if(lbl) lbl.textContent = ACTIVE_THEMES ? ACTIVE_THEMES.length + " courses in rotation" : "All courses";
}

function switchMapTab(tab) {
  var catP = document.getElementById("pool-cat-panel");
  var pickP = document.getElementById("pool-pick-panel");
  var tabCat = document.getElementById("tab-cat");
  var tabPick = document.getElementById("tab-pick");
  var isCat = (tab === "cat");
  if (catP)  catP.style.display  = isCat ? "" : "none";
  if (pickP) pickP.style.display = isCat ? "none" : "";
  if (tabCat)  { tabCat.style.background  = isCat  ? "rgba(185,103,255,.35)" : "transparent"; tabCat.style.color  = isCat  ? "#fff" : "#aaa"; }
  if (tabPick) { tabPick.style.background = !isCat ? "rgba(185,103,255,.35)" : "transparent"; tabPick.style.color = !isCat ? "#fff" : "#aaa"; }
  if (!isCat) initMapCheckboxes();
}

// Map display names for the picker
var MAP_DISPLAY_NAMES = {
  eerie:"🌑 Eerie", funny:"😂 Funny", neon:"💜 Neon", terrifying:"😱 Terrifying",
  feet_bunnies:"🐰 Bunnies", city:"🏙️ City", socks_basket:"🧦 Socks", backrooms:"🚪 Backrooms",
  public_poo:"💩 Public Poo", screaming_mamamia:"😱 Mamamia", disco:"🪩 Disco",
  mountains:"🏔️ Mountains", geometry_dash:"🎮 Geo Dash", emote:"💬 Emote",
  sixtyseven:"67️⃣ Sixty Seven", winter:"❄️ Winter", moon:"🌙 Moon", office:"🏢 Office",
  cabbage:"🥬 Cabbage", minion:"💛 Minion", map67:"67️⃣ Map67", grandcanyon:"🏜️ Canyon",
  tornado:"🌪️ Tornado", waterfall:"💧 Waterfall", poolrooms:"🏊 Poolrooms",
  hogwarts:"⚡ Hogwarts", village:"🏡 Village", minecraft:"⛏️ Minecraft", skyblock:"🌤️ Skyblock", bouncy:"🎈 Bouncy Castle", jungle:"🦖 Dino Jungle",
  vetschool:"🐾 Vet School",
};

function initMapCheckboxes() {
  var box = document.getElementById("map-checkboxes");
  if (!box || box.children.length > 0) return;  // already built
  THEMES.forEach(function(th) {
    var label = document.createElement("label");

    var cb = document.createElement("input");
    cb.type = "checkbox"; cb.value = th; cb.style.accentColor = "#33c3ef";
    cb.checked = !ACTIVE_THEMES || ACTIVE_THEMES.includes(th);
    var span = document.createElement("span");
    span.textContent = MAP_DISPLAY_NAMES[th] || th;
    label.appendChild(cb); label.appendChild(span);
    box.appendChild(label);
  });
}

function applyMapPicks() {
  var cbs = document.querySelectorAll("#map-checkboxes input[type=checkbox]");
  var selected = Array.from(cbs).filter(c=>c.checked).map(c=>c.value);
  ACTIVE_THEMES = selected.length > 0 && selected.length < THEMES.length ? selected : null;
  var lbl = document.getElementById("pool-label");
  if (lbl) lbl.textContent = ACTIVE_THEMES ? selected.length + " maps selected" : "Pool: All Maps";
  switchMapTab("cat");  // go back to category tab
}
function startGame(isMp) {
  AudioEngine.init();
  AudioEngine.stopAll();  // stop menu music
  // Start in TP mode — fp-active class added only when user switches to FP
  document.body.classList.remove("fp-active");
  const uname = document.getElementById("username-input");
  if (uname) playerNames[0] = uname.value.trim() || "Player 1";
  if (!isMp) {
    mpMode = false;
    document.getElementById("menu").style.display      = "none";
    document.getElementById("ui").style.display        = "block";
    document.getElementById("scorecard").style.display = "block";
    document.getElementById("mp-scores").style.display = "none";
    matchSeed  = Math.floor(Math.random() * 1000000000);
    HOLES      = [];
    holeIdx    = 0;
    holeScores = new Array(200).fill(null);
    totalVsPar = 0;
    mpScoreRecorded.fill(false);
    loadHole(0);
  }
}

// ── MAIN LOOP ─────────────────────────────────────────────────────────────────
var T     = 0;
var clock = new THREE.Clock();

// Start menu music when page first loads
(function initMenuMusicOnLoad() {
  // Start the audio engine right away. If the browser allows autoplay the menu
  // theme fades in immediately; otherwise the very first click / tap / key
  // press resumes it (browsers require a user gesture before any sound).
  AudioEngine.init();
  AudioEngine.playMenu();
  AudioEngine._syncUI();
  function kick() {
    AudioEngine.init();
    if (phase === "MENU") AudioEngine.playMenu();
    if (AudioEngine.ctx && AudioEngine.ctx.state === "running")
      ["pointerdown", "keydown", "touchend", "click"].forEach(function(ev) { window.removeEventListener(ev, kick, true); });
  }
  ["pointerdown", "keydown", "touchend", "click"].forEach(function(ev) {
    window.addEventListener(ev, kick, { passive: true, capture: true });
  });
})();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  T += dt;
  INPUT.update(dt);

  // Always update GLB mixers — must happen before any early return
  ANIM.restore();   // undo last frame's head turns before the clips pose the bones again
  var _ak = CINE.animK();   // hit-stop freezes, bullet time slows every animation
  if (typeof _glbMixers !== "undefined") _glbMixers.forEach(function(m){m.update(dt * _ak);});
  if (typeof COS !== "undefined") COS.tick(T);

  // ── Remote player walk animations (render-rate, state-machine) ──────────────
  // Mixers are updated by the _glbMixers.forEach above — do NOT update again here.
  // Only trigger animation STATE CHANGES (idle ↔ walk ↔ jump).
  if (mpMode) {
    remotePlayers.forEach(function(rp) {
      if (!rp || !rp.avatarMesh) return;
      var mesh = rp.avatarMesh;
      if (!mesh.userData.glbLoaded) return;
      var _rvm  = rp.velMag || 0;
      var _rWas = mesh._wantAnim === "walk";
      var _rwlk = _rvm > 0.1;
      var _want = (rp.punchStagger > 0) ? "jump" : (rp.anim || (_rwlk ? "walk" : "idle"));
      if (mesh._wantAnim !== _want) {
        mesh._wantAnim = _want;
        if (typeof switchAvatarAnim === "function") switchAvatarAnim(mesh, _want);
      }
      var _air = rp.body && HOLES[holeIdx] ? rp.body.y - terrainY(rp.body.x, rp.body.z, HOLES[holeIdx], holeIdx) > 0.35 : false;
      ANIM.drive(mesh, _rvm, dt, { grounded: !_air, ko: rp.anim === "death", flail: true });
      // their footsteps, placed in 3D (you hear who's sneaking up behind you)
      if (!_air && _rvm > 0.8 && rp.body) { rp._stepAcc = (rp._stepAcc || 0) + dt * _rvm / (_rvm > 5.6 ? 2.0 : 1.5); if (rp._stepAcc > 1) { rp._stepAcc = 0; AudioEngine.sfx("step", 0.45, rp.body); } }
      // they watch their own disc in flight, otherwise whoever is closest
      var _lt = rp.flying ? rp.discPos : ANIM.nearestFace(rp.body, mesh);
      ANIM.look(mesh, _lt, dt);
    });
  }

  // The Profile / case screens cover the world: stop drawing it behind them (saves a lot of GPU)
  var _covered = typeof PF !== "undefined" && (PF.open || PF.caseOpen);
  // While in MENU or before a hole is loaded, just render and return
  if (phase === "MENU" || !HOLES[holeIdx]) {
    if (_covered) return;
    if (typeof POD !== "undefined" && POD.on) { POD.tick(dt); updateParticles(dt); }
    else if (typeof _lobby3D !== "undefined" && _lobby3D) { _lobbyTick(dt); updateParticles(dt); if (typeof updateBasketFX === "function") updateBasketFX(dt); }
    else if (_menuBackdrop && phase === "MENU") { if (typeof MENU3D !== "undefined") { MENU3D.tick(dt); updateParticles(dt); } else _menuCamera(T); if (typeof updateBasketFX === "function") updateBasketFX(dt); }
    if (CINE.bars > 0) { CINE.bars = 0; CINE.stopT = 0; CINE._barsDom(); }
    AudioEngine.updateFlight(false, 0, false);
    GFX.update(dt, null);
    GFX.render();
    return;
  }

  // Hole intro flyover
  if (introT > 0) { introT -= dt; if (introT <= 0) skipIntro(); }

  var _C = HOLES[holeIdx].course;
  // World simulation: moving / crumbling platforms, rising tide, animated lights, critters
  if (_C) _C.update(netTime(), dt);
  ENT.update(dt);
  GAD.update(dt);

  if (phase === "AIMING" && introT <= 0) {
    var _rs = 1.4 * dt;
    if (keys.ArrowLeft)  { baseAim += _rs; aimAngle = baseAim; }
    if (keys.ArrowRight) { baseAim -= _rs; aimAngle = baseAim; }
    if(_punchCooldown>0)_punchCooldown-=dt;
    if(_punchImmunity>0)_punchImmunity-=dt;
    if (typeof _tickPunchTimers === "function") _tickPunchTimers(dt);
    if((keys.r||keys.R)&&_punchCooldown<=0&&cameraMode!=="spec"){
      _punchCooldown=1.2; keys.r=false; keys.R=false; _doPunch();
    }
    // Moving while aiming puts the disc down so you can walk around and scout.
    // Needs a fresh key press made after you picked the disc up, so holding W
    // while running onto the disc doesn't immediately drop it again.
    if (cameraMode !== "spec" && !spectatingOpp && !dragging) {
      if (PL.anyMoveInput() && _lastMoveKeyDown > _aimSince && !(cameraMode === "fp" && _joyActive)) startWalking(false);
    }
    if (cameraMode === "fp") {
      if (keys.ArrowUp)   fpPitch = Math.max(-1.1, fpPitch + _rs * 0.45);
      if (keys.ArrowDown) fpPitch = Math.min( 0.45, fpPitch - _rs * 0.45);
      if (typeof _joyDX !== "undefined") {
        if (_joyDX) { baseAim -= _joyDX * 1.8 * dt; aimAngle = baseAim; }
        if (_joyDY) fpPitch = Math.max(-1.1, Math.min(0.45, fpPitch + _joyDY * 1.4 * dt));
      }
      if (typeof _fpThrowHeld !== "undefined" && _fpThrowHeld) {
        throwPower = Math.min(1, throwPower + dt * 0.7);
        var _pf2 = document.getElementById("pwr-fill");
        var _pp2 = document.getElementById("pwr-pct");
        if (_pf2) _pf2.style.width = throwPower * 100 + "%";
        if (_pp2) _pp2.textContent = Math.round(throwPower * 100) + "%";
      }
    }
  }

  // Escalation warnings
  if (_C && _C.tide && _C.tide.t > _C.tide.delay && !_C._tideWarned) { _C._tideWarned = true; _flashPrompt(_C.hazard.type === "lava" ? "The lava is rising — hurry!" : "The tide is rising — hurry!"); }

  // ── WALKING: the player runs / jumps to the disc ──
  if ((phase === "WALKING" || phase === "LANDED") && _C && !BT.finished) {
    // The resting disc rides moving platforms, drops when its platform crumbles
    if (!ENT.carrying) {
      var _ds = _C.supportAt(discPos.x, discPos.z);
      if (_ds.solid && _ds.solid.mover) { discPos.x += _ds.solid.dx || 0; discPos.z += _ds.solid.dz || 0; discPos.y += _ds.solid.dy || 0; }
      if (discPos.y > _ds.y + 0.2) discPos.y = Math.max(_ds.y + 0.06, discPos.y - 9 * dt);
      else discPos.y = _ds.y + 0.06;
      var _dhz = _C.hazardAt(discPos.x, discPos.z);
      if (discPos.y < _dhz.level + 0.1 && _ds.y < _dhz.level) { outOfBounds(false); }
    }
  }
  if (phase === "LANDED" && _C && throwCount < 12 && PL.anyMoveInput() && _lastMoveKeyDown > (ENT.landT || 0) && !spectatingOpp) {
    document.getElementById("dist").style.opacity = "0";
    if (Math.hypot(discPos.x - PL.pos.x, discPos.z - PL.pos.z) < 1.4) pickUpDisc(); else startWalking(true);
  }
  if (phase === "WALKING" && _C && typeof VEH !== "undefined" && VEH.mySeat) {
    // in a car: the vehicle moves us; no pick-ups from the driver's seat
    var _wd2 = document.getElementById("walk-dist");
    if (_wd2 && (_nameLabelFrame % 6 === 0)) { var _d2 = Math.hypot(discPos.x - PL.pos.x, discPos.z - PL.pos.z); _wd2.textContent = _d2 < 6 ? "hop out (E)" : Math.round(_d2) + " m"; }
  } else if (phase === "WALKING" && _C) {
    if (_punchCooldown > 0) _punchCooldown -= dt;
    if (typeof _tickPunchTimers === "function") _tickPunchTimers(dt);
    if ((keys.r || keys.R) && _punchCooldown <= 0) { _punchCooldown = 1.2; keys.r = keys.R = false; _doPunch(); }
    PL.update(dt);
    var _dd = Math.hypot(discPos.x - PL.pos.x, discPos.z - PL.pos.z);
    if (_dd > 2.4) _pickupArmed = true;
    if (_pickupArmed && !BT.finished && !BT.locked() && !ENT.carrying && PL.respawnT <= 0 && _dd < 1.3 && Math.abs(discPos.y - PL.pos.y) < 1.7) pickUpDisc();
    if (ENT.carrying && Math.hypot(ENT.carrying.x - PL.pos.x, ENT.carrying.z - PL.pos.z) < 2.2) ENT.dropDisc(ENT.carrying, true);
    var _wd = document.getElementById("walk-dist");
    if (_wd && (_nameLabelFrame % 6 === 0)) _wd.textContent = BT.finished ? "done ✓" : BT.locked() ? "💫 knocked out" : _dd < 1.5 ? "Grab it!" : Math.round(_dd) + " m";
  }

  // Mid-flight disc tilt — A/D
  if (phase === "FLYING") {
    // Nudge the flight left/right, perpendicular to the direction of travel
    var _steerStr = 2.5 * dt, _hv = Math.hypot(discVel.x, discVel.z) || 1;
    var _sr = (keys.d || keys.D ? 1 : 0) - (keys.a || keys.A ? 1 : 0);
    if (_sr) { var _rx = -discVel.z / _hv, _rz = discVel.x / _hv; discVel.x += _rx * _sr * _steerStr; discVel.z += _rz * _sr * _steerStr; }
  }

  // Track last safe position — record the island SURFACE position (not disc position)
  // Update whenever disc is flying LOW over a solid island (close to landing)
  if (phase === "FLYING" && HOLES[holeIdx]) {
    const _gndLP   = terrainY(discPos.x, discPos.z, HOLES[holeIdx], holeIdx);
    const _waterLP = (HOLES[holeIdx].water || -1.5);
    // Record surface Y whenever disc is flying over a solid island (no height cap)
    if (_gndLP > _waterLP + 0.5) {
      lastValidPos.set(discPos.x, _gndLP + 0.06, discPos.z);
    }
  }

  // Obstacle–disc collision bounce
  obstacles.forEach((o) => {
    if (phase !== "FLYING") return;
    const dx = discPos.x - o.x, dz = discPos.z - o.z;
    const hd = Math.sqrt(dx * dx + dz * dz);
    var _ob = o.worldY !== undefined ? o.worldY : (o.mesh.position.y || 0);
    if (o.solid !== false && hd < o.r + 0.25 && discPos.y < o.h + _ob && discPos.y > _ob - 0.3) {
      const nx = dx / hd, nz = dz / hd;
      const dot = discVel.x * nx + discVel.z * nz;
      // beaning a bystander: they go limp and the disc ricochets off them
      if (dot < -3 && o.update && !o.rag && o.mesh && /jogger|dancer|critter|minion|knight|robot/.test(o.type) && discVel.length() > 7 && ENT.ragdoll(o, discVel.x * 0.45, 4.5, discVel.z * 0.45)) {
        AudioEngine.sfx("bonk", 0.9, discPos); _spawnBonkText(new THREE.Vector3(o.x, (o.worldY || 0) + 2.2, o.z), "BONK!");
        (function(oo) { CINE.react(function() { var p = RAG.pelvis(oo.mesh); return p ? p.clone() : new THREE.Vector3(oo.x, (oo.worldY || 0) + 0.8, oo.z); }, "BONK!", 2.2); })(o);
        if (typeof CINE !== "undefined") CINE.hitStop(0.08);
        if (typeof AudioEngine.crowd === "function") AudioEngine.crowd("laugh");
      }
      if (dot < 0 && ((typeof PU !== "undefined" && PU.discMod === "sticky") || (typeof ARS !== "undefined" && ARS.sticks()))) { discVel.x = 0; discVel.z = 0; discVel.y = Math.min(discVel.y, 0) - 0.5; if (typeof ARS !== "undefined") ARS.splat(discPos); }
      else if (dot < 0) {
        discVel.x -= 1.6 * dot * nx;
        discVel.z -= 1.6 * dot * nz;
        discVel.y  = Math.abs(discVel.y) * 0.4 + 2;
        if (typeof handleImpact === "function") {
          var _obsSnd = (o.type === "tree" || o.type === "pinetree") ? "wood"
            : (o.type === "car" || o.type === "desk" || o.type === "lamp") ? "metal" : "wall";
          handleImpact(_obsSnd, discPos.clone(), discVel.clone());
        }
      }
    }
  });

  stepPhysics(dt);
  if (typeof VEH !== "undefined") VEH.update(dt);
  if (typeof WORLD !== "undefined") WORLD.update(performance.now() / 1000);
  LIFE.update(dt, T);
  FEEL.update(dt);
  if(_screenShakeT>0){_screenShakeT-=dt;_screenShake*=Math.pow(0.82, dt*60);if(_screenShakeT<=0)_screenShake=0;}
  updateCamera(dt);
  CINE.update(dt);
  CAMFX.update(dt);
  AudioEngine.listen(camera);
  _updateOccluders(dt);
  if (typeof updateBasketFX === "function") updateBasketFX(dt);
  if (trajLandRing && !(phase === "AIMING" && dragging)) trajLandRing.visible = false;
  updateTrail(discPos, phase === "FLYING");
  updateParticles(dt * Math.max(0.15, _ak));
  updateRain(dt);
  checkPowerupCollection();

  PU.update(dt);
  BT.update(dt);
  EMOTE.update();
  ARS.tick();
  if (BT.stunT > 0 && phase !== "WALKING" && phase !== "MENU" && _C) PL.update(dt);


  if (stepBackCooldown > 0) {
    stepBackCooldown = Math.max(0, stepBackCooldown - dt);
    updateStepBackBtn();
  }

  if (HOLES[holeIdx] && HOLES[holeIdx].terrainMode === "connected") {
    var elevHud = document.getElementById("elev-hud");
    var elevVal = document.getElementById("elev-val");
    if (elevHud) elevHud.style.display = "block";
    if (elevVal) {
      var gndH = terrainY(discPos.x, discPos.z, HOLES[holeIdx], holeIdx);
      var absH = Math.round(gndH * 10) / 10;
      elevVal.textContent = (absH >= 0 ? "+" : "") + absH + "m";
    }
  } else {
    var elevHud2 = document.getElementById("elev-hud");
    if (elevHud2) elevHud2.style.display = "none";
  }

  // ── Avatar & disc placement ──
  if (localAvatarMesh) localAvatarMesh.visible = cameraMode === "tp" && PL.respawnT <= 0;
  if (phase === "AIMING" && HOLES[holeIdx]) {
    var _gndNow = terrainY(discPos.x, discPos.z, HOLES[holeIdx], holeIdx);
    // The lie can be on a moving platform: player and disc ride along
    if (_C) { var _ls = _C.supportAt(discPos.x, discPos.z); if (_ls.solid && _ls.solid.mover) { discPos.x += _ls.solid.dx || 0; discPos.z += _ls.solid.dz || 0; } _gndNow = _C.heightAt(discPos.x, discPos.z); if (_C.touch) _C.touch(discPos.x, discPos.z); }
    discPos.y = _gndNow + 0.06;
    PL.pos.set(discPos.x, _gndNow, discPos.z);
    var _fwX = Math.sin(aimAngle), _fwZ = -Math.cos(aimAngle);
    PL.yaw = Math.atan2(_fwX, _fwZ);
    PL.camYaw = aimAngle;
    // Standing on a crumbling lie that falls away → the disc goes with it
    var _lhz = _C ? _C.hazardAt(discPos.x, discPos.z) : null;
    if (_lhz && _gndNow < _lhz.level) { PL.fall(_lhz.type); outOfBounds(false); }
    PL.applyAvatar(dt);
    // wind-up follows the power meter; otherwise idle (unless an emote or the release is playing)
    if (dragging) { PL.emoteT = 0; PL._setAnim("throwwind"); ANIM.scrub(localAvatarMesh, throwPower); ANIM.coil(localAvatarMesh, Math.pow(throwPower, 0.8)); }
    else if (!(PL.emoteT > T) && T > (PL._lockAnim || 0)) PL._setAnim("idle");
    if (localAvatarMesh && !localAvatarMesh.userData.glbLoaded && localAvatarMesh.children[7]) localAvatarMesh.children[7].rotation.z = -0.55 - throwPower * 0.7;
    if (discMesh) {
      discMesh.visible = cameraMode === "tp";
      discMesh.scale.setScalar(DISC_SCALE_HAND);
      var _rgX = Math.cos(aimAngle), _rgZ = Math.sin(aimAngle);
      // held out to the right, tilted so the camera behind the shoulder sees the skin
      discMesh.scale.setScalar(DISC_SCALE_HAND * 1.15);
      discMesh.position.set(discPos.x + _rgX * 0.62 + _fwX * 0.05, _gndNow + 1.05 + throwPower * 0.25, discPos.z + _rgZ * 0.62 + _fwZ * 0.05);
      discMesh.rotation.set(-0.75, Math.atan2(_fwX, _fwZ), releaseBank * 0.9);
      (discMesh.userData.spinner || discMesh).rotation.y += 0.6 * dt;
    }
  } else if (phase === "WALKING" || phase === "LANDED" || phase === "FLYING" || phase === "SCORED") {
    PL.applyAvatar(dt);
    if (phase === "FLYING" && PL.anim === "throwrelease" && T > (PL._lockAnim || 0)) PL._setAnim("idle");
    if (phase === "FLYING" && localAvatarMesh && !localAvatarMesh.userData.glbLoaded && localAvatarMesh.children[7]) localAvatarMesh.children[7].rotation.z = -1.3;
    if ((phase === "WALKING" || phase === "LANDED") && discMesh && !BT.finished) {
      // The disc lies on the ground where it stopped (or dangles from a thief)
      discMesh.visible = true;
      discMesh.scale.setScalar(DISC_SCALE_FLIGHT);
      discMesh.position.copy(discPos);
      if (!ENT.carrying) { discMesh.rotation.x *= 0.9; discMesh.rotation.z *= 0.9; }
      else { discMesh.rotation.x = 1.2; discMesh.rotation.y += dt * 4; }
    }
  }
  if (localAvatarMesh && localAvatarMesh.userData.glbLoaded) {
    var _ws = phase === "WALKING" ? Math.hypot(PL.vel.x, PL.vel.z) : 0;
    ANIM.drive(localAvatarMesh, _ws, dt, { grounded: PL.onGround || (phase !== "WALKING" && BT.stunT <= 0), fidget: phase === "WALKING" && !BT.locked(), ko: BT.stunT > 0 && BT.frozenT <= 0, flail: phase === "WALKING" });
    if (phase === "AIMING" && cameraMode === "tp" && discMesh) ANIM.holdDisc(localAvatarMesh, discMesh, 0.54 * DISC_SCALE_HAND * 1.15);   // gripped by the rim in the throwing hand
    // eyes on the disc while it flies, down the line while aiming, otherwise on whoever's near
    var _lookAt = phase === "FLYING" ? discPos : phase === "AIMING" ? new THREE.Vector3(PL.pos.x + Math.sin(aimAngle) * 20, PL.pos.y + 1.5, PL.pos.z - Math.cos(aimAngle) * 20) : ANIM.nearestFace(PL.pos, localAvatarMesh);
    if (!BT.locked()) ANIM.look(localAvatarMesh, _lookAt, dt);
  }
  // everyone else holds their disc while they line up a throw (it used to just vanish)
  if (mpMode) remotePlayers.forEach(function(rp) {
    if (!rp || !rp.discMesh || rp.flying || !rp.body || !rp.avatarMesh || !rp.avatarMesh.visible) return;
    if (Math.hypot(rp.discPos.x - rp.body.x, rp.discPos.z - rp.body.z) > 1.5 || rp.anim === "death") return;
    rp.discMesh.scale.setScalar(DISC_SCALE_HAND * 1.15);
    rp.discMesh.visible = ANIM.holdDisc(rp.avatarMesh, rp.discMesh, 0.54 * DISC_SCALE_HAND * 1.15);
  });
  RAG.update(dt * _ak);   // limp bodies override the animated pose (players + NPCs)
  // … so anyone knocked limp while holding a disc takes it along (the grips above used the animated pose)
  if (phase === "AIMING" && cameraMode === "tp" && discMesh && localAvatarMesh && RAG.active(localAvatarMesh)) ANIM.holdDisc(localAvatarMesh, discMesh, 0.54 * DISC_SCALE_HAND * 1.15);
  if (mpMode) remotePlayers.forEach(function(rp) { if (rp && rp.discMesh && rp.discMesh.visible && !rp.flying && rp.avatarMesh && RAG.active(rp.avatarMesh)) ANIM.holdDisc(rp.avatarMesh, rp.discMesh, 0.54 * DISC_SCALE_HAND * 1.15); });
  if (!discMarker) { discMarker = _buildDiscMarker(); scene.add(discMarker); }
  if (BT.finished) discMarker.visible = false;
  if (discMarker.visible) {
    discMarker.position.set(discPos.x, discPos.y - 0.05, discPos.z);
    var _pk = 1 + Math.sin(T * 4) * 0.12; discMarker.userData.ring.scale.set(_pk, _pk, _pk);
    // the beam guides you from afar; up close it would fog the whole screen, so it fades out
    if (discMarker.userData.col) { var _cd = camera.position.distanceTo(discMarker.position); discMarker.userData.col.material.opacity = 0.35 * Math.max(0, Math.min(1, (_cd - 6) / 10)); discMarker.userData.col.visible = _cd > 6; }
  }

  // Broadcast position ~15Hz
  if (mpMode && typeof sendToAll === "function") {
    _posBcastAcc = (_posBcastAcc||0) + dt;
    if (_posBcastAcc >= 0.067) {
      _posBcastAcc = 0;
      if (phase !== "MENU") {
        var _q = function(v) { return Math.round(v * 100) / 100; };
        var _pm = {t:"pos",px:_q(PL.pos.x),py:_q(PL.pos.y),pz:_q(PL.pos.z),aim:_q(aimAngle),yaw:_q(PL.yaw),an:PL.anim,vm:Math.round(Math.hypot(PL.vel.x,PL.vel.z)*10)/10};
        var _sig = _pm.px + "," + _pm.py + "," + _pm.pz + "," + _pm.aim + "," + _pm.yaw + "," + _pm.an;
        if (_sig !== window._lastPosSig || T - (window._lastPosT || 0) > 1) { window._lastPosSig = _sig; window._lastPosT = T; sendToAll(_pm); }
      }
    }
  }

  // Debug mode tick
  if (typeof _tickDebug === "function") _tickDebug(dt);

  // Project name labels — throttled to 20fps (every 3rd frame), no allocations
  _nameLabelFrame++;
  if (_nameLabelFrame % 3 === 0) {
    remotePlayers.forEach(function(rp) {
      if (!rp||!rp.nameLabel||!rp.avatarMesh) return;
      _nameLabelTmp.copy(rp.avatarMesh.position);
      _nameLabelTmp.y += 2.1;
      _nameLabelTmp.project(camera);
      if (_nameLabelTmp.z > 1) { rp.nameLabel.style.display="none"; return; }
      rp.nameLabel.style.display = "block";
      rp.nameLabel.style.left = ((_nameLabelTmp.x*0.5+0.5)*window.innerWidth)+"px";
      rp.nameLabel.style.top  = ((-_nameLabelTmp.y*0.5+0.5)*window.innerHeight-6)+"px";
    });
  }

  // HUD: camera-relative wind arrow + minimap
  if (typeof updateWindUI === "function" && (_nameLabelFrame % 4 === 0)) updateWindUI();
  if (typeof drawMinimap === "function" && (_nameLabelFrame % 3 === 0)) drawMinimap();

  AudioEngine.updateFlight(phase === "FLYING", discVel.length(), timeScale < 0.75);
  var _focus = (phase === "FLYING") ? discPos : PL.pos;
  GFX.update(dt, _focus);
  if (!_covered) { GFX.render(); CINE.pipRender(dt); }
}

initMenuDecor();
showMenuBackdrop();
AudioEngine._loadSettings(); AudioEngine._syncUI();
initMenuDiscCards();

animate();

// Free-roam spectate camera: mouse drag to look
window.addEventListener("mousedown", function(e) {
  if (typeof spectatingOpp !== "undefined" && spectatingOpp && e.button === 0) {
    _fcDrag = true; _fcLX = e.clientX; _fcLY = e.clientY;
  }
});
window.addEventListener("mousemove", function(e) {
  if (typeof spectatingOpp === "undefined" || !spectatingOpp || !_fcDrag) return;
  freeCamYaw   += (e.clientX - _fcLX) * 0.004;  // positive = natural look direction
  freeCamPitch  = Math.max(-1.2, Math.min(1.2, freeCamPitch - (e.clientY - _fcLY) * 0.004));
  _fcLX = e.clientX; _fcLY = e.clientY;
});
window.addEventListener("mouseup", function() { _fcDrag = false; });

// ── FP mouse look ─────────────────────────────────────────────────
window.addEventListener("mousedown", function(e) {
  if (cameraMode === "fp" && e.button === 0 && !spectatingOpp && (phase === "AIMING" || phase === "LANDED")) {
    _fpDrag = true; _fpLastX = e.clientX; _fpLastY = e.clientY;
  }
});
window.addEventListener("mousemove", function(e) {
  if (!_fpDrag || cameraMode !== "fp") return;
  PL.look(e.clientX - _fpLastX, e.clientY - _fpLastY);
  _fpLastX = e.clientX; _fpLastY = e.clientY;
});
window.addEventListener("mouseup", function(e) { if (e.button === 0) _fpDrag = false; });
window.addEventListener("wheel", function(e) {
  if (cameraMode === "fp" && (phase === "AIMING" || phase === "LANDED")) {
    throwPower = Math.max(0, Math.min(1, throwPower - e.deltaY * 0.001));
    var pf = document.getElementById("pwr-fill"), pp = document.getElementById("pwr-pct");
    if (pf) pf.style.width = throwPower*100+"%";
    if (pp) pp.textContent = Math.round(throwPower*100)+"%";
  }
},{passive:true});

window.addEventListener("resize", () => { GFX.resize(); });