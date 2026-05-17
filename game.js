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
  if (btn) btn.textContent = cameraMode === "fp" ? "👁 FP" : "🎥 TP";
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
  var PUNCH_RANGE = 5.0, bestIdx = -1, bestDist = PUNCH_RANGE;
  remotePlayers.forEach(function(rp, i) {
    if (!rp || !rp.avatarMesh) return;
    if (rp.punchImmunity && rp.punchImmunity > 0) return;  // immune, skip
    var d = Math.hypot(discPos.x - rp.discPos.x, discPos.z - rp.discPos.z);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  });

  _punchSwingEffect();
  if (typeof _screenShake !== "undefined") { _screenShake = 0.18; _screenShakeT = 0.22; }

  if (bestIdx < 0) return;  // swing and a miss

  var rp = remotePlayers[bestIdx];
  var pdx = rp.discPos.x - discPos.x, pdz = rp.discPos.z - discPos.z;
  var pl  = Math.hypot(pdx, pdz) || 1;

  // Impulse scales with puncher speed + low-grav bonus
  var mySpeed   = Math.hypot(_playerVelX || 0, _playerVelZ || 0);
  var gravBonus = (typeof activePowerups !== "undefined" && activePowerups.lowgrav &&
    activePowerups.lowgrav.until > Date.now()) ? 1.8 : 1.0;
  var impulse = (14.0 + mySpeed * 1.4) * gravBonus;  // strong arcade punch
  var dirX = pdx / pl, dirZ = pdz / pl;

  rp.flying        = true;
  rp.punchStagger  = 1.1;
  rp.punchImmunity = 1.3;
  rp.punchKnockDir = { x: dirX, z: dirZ };
  rp.discVel.set(dirX * impulse, 5.0 * gravBonus, dirZ * impulse);
  if (rp.discMesh) rp.discMesh.visible = true;
  // Play launched anim on the remote player mesh we see locally
  if (rp.avatarMesh && typeof switchAvatarAnim === "function") {
    switchAvatarAnim(rp.avatarMesh, "jump");
  }

  _spawnBonkText(rp.discPos.clone());
  if (typeof _screenShake !== "undefined") { _screenShake = 0.42; _screenShakeT = 0.5; }

  if (mpMode && typeof sendToAll === "function") {
    sendToAll({
      t:       "punch_launch",
      from:    myIdx,
      target:  bestIdx,
      px: rp.discPos.x, py: rp.discPos.y, pz: rp.discPos.z,
      vx: dirX * impulse, vy: 5.0 * gravBonus, vz: dirZ * impulse,
      dx: dirX, dz: dirZ,
      impulse: impulse,
      stagger:  1.1,
    });
  }
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
function _spawnBonkText(worldPos) {
  // Project world → screen
  if (typeof camera === "undefined" || !camera) return;
  var v = worldPos.clone();
  v.project(camera);
  var sx = (v.x * 0.5 + 0.5) * window.innerWidth;
  var sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
  if (v.z > 1) return;  // behind camera

  var el = document.createElement("div");
  el.className = "bonk-popup";
  el.textContent = _bonkWords[Math.floor(Math.random() * _bonkWords.length)];
  el.style.cssText = "position:fixed;left:" + sx + "px;top:" + sy + "px;" +
    "transform:translate(-50%,-50%) rotate(" + (Math.random()*30-15) + "deg) scale(0);" +
    "font-family:'Permanent Marker',cursive;font-size:32px;color:#ff3300;" +
    "text-shadow:2px 2px 0 #000,-1px -1px 0 #000,3px 3px 8px rgba(0,0,0,.6);" +
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
  if (typeof spawnParticleBurst === "function") {
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

  // ── PUNCH moves the PLAYER, not the disc ────────────────────────────
  // In AIMING/LANDED: discPos IS the player position.
  // We keep phase=AIMING and apply knockback directly to discPos each frame
  // via _punchKnockVelX/Z — player slides/stumbles, never launches as a disc.
  if (typeof discPos !== "undefined") {
    discPos.x = px; discPos.z = pz;
    if (typeof terrainY === "function" && typeof HOLES !== "undefined" && HOLES[holeIdx]) {
      discPos.y = terrainY(px, pz, HOLES[holeIdx], holeIdx) + 0.3;
    } else {
      discPos.y = py;
    }
  }

  // Apply horizontal knockback velocity — will be consumed in the movement loop
  _punchKnockVelX = vx * 0.22;   // scale down: we're moving the player, not a disc
  _punchKnockVelZ = vz * 0.22;
  _punchKnockTimer = stagger;    // seconds of knockback slide + stagger
  _punchImmunity = stagger + 0.2;

  // Don't change phase — player stays AIMING/LANDED so they can't throw while stumbling

  // Play jump animation on local avatar
  if (typeof localAvatarMesh !== "undefined" && localAvatarMesh && typeof switchAvatarAnim === "function") {
    switchAvatarAnim(localAvatarMesh, "jump");
  }

  if (typeof _screenShake !== "undefined") { _screenShake = 0.60; _screenShakeT = 0.65; }
  if (typeof _spawnBonkText === "function" && typeof discPos !== "undefined") {
    _spawnBonkText(discPos.clone());
  }
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

var keys = { ArrowLeft:false, ArrowRight:false, w:false,a:false,s:false,d:false,q:false,e:false,r:false,W:false,A:false,S:false,D:false,Q:false,E:false,R:false," ":false,Shift:false };
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
var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

var scene  = new THREE.Scene();
scene.fog  = new THREE.FogExp2(0x111122, 0.012);

var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);
camera.position.set(0, 11, 20);

// Lighting
var ambLight = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambLight);
var sunLight = new THREE.DirectionalLight(0xfff5e0, 1.1);
sunLight.position.set(40, 80, 30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far  = 300;
sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -100;
sunLight.shadow.camera.right = sunLight.shadow.camera.top   =  100;
scene.add(sunLight);
var hemiLight = new THREE.HemisphereLight(0x8899ff, 0x445533, 0.35);
scene.add(hemiLight);

// Sky dome — used by applyThemeVisuals() in terrain.js
var skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    c1: { value: new THREE.Color(0x1a053a) },
    c2: { value: new THREE.Color(0x000000) }
  },
  vertexShader:   "varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader: "uniform vec3 c1;uniform vec3 c2;varying vec3 vP;void main(){float t=clamp(vP.y/280.,0.,1.);gl_FragColor=vec4(mix(c1,c2,t*t),1.);}"
});
var skyGeo  = new THREE.SphereGeometry(480, 18, 10);
skyGeo.scale(-1, 1, 1);
var skyMesh = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyMesh);

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
(function() {
  if (typeof BACKGROUND_IMAGE === "undefined" || !BACKGROUND_IMAGE) return;
  // Apply as body CSS background — visible through transparent renderer clear.
  document.body.style.backgroundImage = "url('" + BACKGROUND_IMAGE + "')";
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundRepeat = "no-repeat";
  document.body.style.backgroundAttachment = "fixed";
  renderer.setClearColor(0x000000, 0);

  // Also use as scene far background for camera frustum fill.
  if (typeof THREE !== "undefined" && scene) {
    var _bgLoader = new THREE.TextureLoader();
    _bgLoader.load(
      BACKGROUND_IMAGE,
      function(tex) { scene.background = tex; },
      undefined,
      function() { /* keep CSS fallback only */ }
    );
  }
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
  var surfY = waterY + 1.75 + (mv.elev || 0);
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

  var rim = new THREE.Mesh(
    new THREE.TorusGeometry(mv.r, 0.16, 6, 16),
    new THREE.MeshBasicMaterial({color: 0xffdd00})
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, surfY, 0);
  visualRoot.add(rim);

  var tc2 = (typeof themeColors !== 'undefined' && themeColors[hole.theme]) || {island:0x448844};
  var islCol = new THREE.Color(tc2.island || 0x448844);
  var proc = new THREE.Group();
  var mDepth = Math.max(2.5, (mv.elev || 0) + 3);
  var ft = new THREE.Mesh(new THREE.CylinderGeometry(mv.r, mv.r * 0.88, 0.55, 12), new THREE.MeshLambertMaterial({color:islCol}));
  ft.position.y = surfY - 0.275;
  ft.castShadow = true;
  proc.add(ft);
  var fs = new THREE.Mesh(new THREE.CylinderGeometry(mv.r * 0.88, mv.r * 0.6, mDepth, 12), new THREE.MeshLambertMaterial({color: islCol.clone().lerp(new THREE.Color(0x222222), 0.45)}));
  fs.position.y = surfY - 0.275 - mDepth * 0.5 - 0.275;
  proc.add(fs);
  visualRoot.add(proc);

  var _islandKey = hole && hole.islandModelKey ? hole.islandModelKey : 'island';
  if (typeof loadModel === 'function' && typeof MODEL_OVERRIDES !== 'undefined' && MODEL_OVERRIDES[_islandKey]) {
    var ISL_HW = 0.4465, ISL_TY = 0.745;
    loadModel(_islandKey, function(glbClone) {
      if (!glbClone) return;
      visualRoot.remove(proc);
      glbClone.updateMatrixWorld(true);
      var _bb = new THREE.Box3().setFromObject(glbClone);
      var _sz = new THREE.Vector3(); _bb.getSize(_sz);
      var _hw = Math.max(_sz.x, _sz.z) * 0.5;
      if (_hw < 0.001) _hw = ISL_HW;
      var _topY = _bb.max.y;
      var _ratio = _estimateIslandTopRadiusRatio(glbClone);
      mv.walkR = (mv.r || 6) * _ratio;
      var sc = mv.r / _hw;
      var posY = surfY - sc * _topY;
      var islandModelRoot = new THREE.Group();
      islandModelRoot.scale.setScalar(sc);
      islandModelRoot.position.y = posY;
      islandModelRoot.rotation.y = Math.random() * Math.PI * 2;
      glbClone.traverse(function(c){ if(c.isMesh){ c.castShadow = true; c.receiveShadow = true; } });
      islandModelRoot.add(glbClone);
      visualRoot.add(islandModelRoot);
    });
  }
  // Grass patches are children of platform visual root, so they move with the platform root.
  if (typeof loadModel === 'function' && typeof MODEL_OVERRIDES !== 'undefined' && MODEL_OVERRIDES['grass_patch']) {
    var _gCount = Math.max(6, Math.min(14, Math.floor((mv.r || 6) * 1.05)));
    for (var gi = 0; gi < _gCount; gi++) {
      var ga = srng() * Math.PI * 2;
      var gd = srng() * Math.max(0.6, (mv.r || 6) * 0.55);
      var gx = Math.cos(ga) * gd;
      var gz = Math.sin(ga) * gd;
      (function(_gx, _gz, _gy) {
        loadModel('grass_patch', function(grassClone) {
          if (!grassClone) return;
          var gp = new THREE.Group();
          gp.position.set(_gx, _gy, _gz);
          gp.rotation.y = srng() * Math.PI * 2;
          gp.scale.setScalar(0.6 + srng() * 0.6);
          grassClone.traverse(function(c){ if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
          gp.add(grassClone);
          visualRoot.add(gp);
        });
      })(gx, gz, surfY + 0.05);
    }
  }

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

// ── LOAD HOLE ────────────────────────────────────────────────────────────────
function loadHole(idx) {
  holeIdx = idx;
  if (!basketWP)     basketWP     = new THREE.Vector3();
  if (!lastValidPos) lastValidPos = new THREE.Vector3();
  while (courseGrp.children.length) courseGrp.remove(courseGrp.children[0]);

  seedRNG(matchSeed + idx * 7331);
  HOLES[idx] = generateHole(idx + 1);
  const h = HOLES[idx];

  applyThemeVisuals(h.theme);
  AudioEngine.playTheme(h.theme);

  seedRNG(matchSeed + idx * 9999);
  h.islandModelKey = "island";

  var _terrainGrp = buildTerrain(h, idx);
  courseGrp.add(_terrainGrp);
  courseGrp.add(buildInstancedGrass(h, idx));
  courseGrp.add(buildWater(h));

  // Build moving islands as unified platform entities (single root transform)
  platformEntities = [];
  if (h.movingIslands && h.movingIslands.length > 0) {
    h.movingIslands.forEach(function(mv) {
      var platformEntity = _createPlatformEntity(mv, h);
      platformEntities.push(platformEntity);
      courseGrp.add(platformEntity.root);
    });
  }

  var by = h.water + 1.2 + (h.basketElev || 0);
  var basket = buildBasket();
  basket.position.set(h.bx, by, h.bz);
  courseGrp.add(basket);
  basketWP.set(h.bx, by + 1.75, h.bz);
  // Basket beacon — point light + translucent column so players can find it from FP
  var _bcLight = new THREE.PointLight(0xffcc44, 1.6, 35);
  _bcLight.position.set(h.bx, by + 4, h.bz);
  courseGrp.add(_bcLight);
  var _bcMat = new THREE.MeshBasicMaterial({color:0xffcc44,transparent:true,opacity:0.15,side:THREE.DoubleSide});
  var _bcMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12,1.2,7,8,1,true), _bcMat);
  _bcMesh.position.set(h.bx, by + 3.5, h.bz);
  courseGrp.add(_bcMesh);

  obstacles = [];
  let spawnPoints = [...h.waypoints, { x: 0, z: 0, r: 6 }, { x: h.bx, z: h.bz, r: 8 }];
  let numObs = 10 + idx * 3;

  for (let i = 0; i < numObs; i++) {
    let sp    = spawnPoints[Math.floor(srng() * spawnPoints.length)];
    let angle = srng() * Math.PI * 2;
    let dist  = srng() * sp.r;
    let tx = sp.x + Math.cos(angle) * dist;
    let tz = sp.z + Math.sin(angle) * dist;

    if (Math.hypot(tx, tz) < 4) continue;
    const distToBasket  = Math.hypot(tx - h.bx, tz - h.bz);
    if (distToBasket < 6) continue;
    const angle2basket  = Math.atan2(h.bz, h.bx);
    const angleToObs    = Math.atan2(tz - h.bz, tx - h.bx);
    const angDiff = Math.abs(((angleToObs - angle2basket + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (distToBasket < 12 && angDiff < 0.6) continue;

    var objData = (typeof getThemeObstacle === "function") ? getThemeObstacle(h.theme) : getRandomThemeObj(h.theme);
    if (objData.r > 0) {
      var ty2 = terrainY(tx, tz, h, idx);
      if (h.terrainMode === "connected") {
        if (h.theme === "moon"        && ty2 < -1) continue;
        if (h.theme === "grandcanyon" && ty2 < -3) continue;
        if (h.theme === "office"      && ty2 < 0)  continue;
      }
      var obsOnMv = _findSupportPlatform(tx, tz, h);
      const spd2 = srng() * 2 + 1, ph = srng() * 10;
      if (objData.type === "car") objData.mesh.rotation.y = 0;

      var localStartX = tx;
      var localStartZ = tz;
      if (obsOnMv && obsOnMv.entity && obsOnMv.entity.obstaclesRoot) {
        localStartX = tx - (obsOnMv.currentX || obsOnMv.baseX);
        localStartZ = tz - (obsOnMv.currentZ || obsOnMv.baseZ);
        objData.mesh.position.set(localStartX, ty2, localStartZ);
        obsOnMv.entity.obstaclesRoot.add(objData.mesh);
      } else {
        objData.mesh.position.set(tx, ty2, tz);
        courseGrp.add(objData.mesh);
      }

      var obs = { x: tx, z: tz, startX: tx, startZ: tz, startY: ty2,
        localStartX: localStartX, localStartZ: localStartZ,
        r: objData.r, h: objData.h, mesh: objData.mesh, type: objData.type, speed: spd2, phase: ph,
        movingIsland: obsOnMv || null };
      obstacles.push(obs);
      _refreshObstacleWorldPosition(obs);
    }
  }

  initTrajDots();
  initTrail();
  spawnPowerups(h, idx);

  // ── Sync obstacle layout to all clients (host only) ──
  if (mpMode && myIdx === 0) {
    var _obsData = obstacles.map(function(o) {
      return { x: o.x, z: o.z, startX: o.startX, startZ: o.startZ,
               r: o.r, h: o.h, type: o.type, speed: o.speed, phase: o.phase };
    });
    sendToAll({ t: "obstacle_layout", holeIdx: idx, obstacles: _obsData });
  }

  const weathers = ["clear","clear","clear","windy","rainy","foggy","hot","stormy","snow"];
  var _pickedWeather = weathers[Math.floor(Math.random() * weathers.length)];
  setWeather(_pickedWeather);
  if (mpMode && myIdx === 0) sendToAll({ t: "weather_sync", weather: _pickedWeather });

  // Place disc exactly on island visual surface
  // terrainYIsland returns waterY+1.75+elev at island centre (top of cylinder)
  var sy = (h.water || -1.5) + 1.75 + (h.teeElev || 0) + 0.15;
  discPos.set(0, sy, 0);
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
    var armMat = new THREE.MeshLambertMaterial({color:0xf4c28c});
    var arm  = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.055,0.35,8), armMat);
    arm.rotation.x = Math.PI/2; arm.position.z = -0.17; g.add(arm);
    var discMat2 = new THREE.MeshStandardMaterial({color:col,roughness:0.3,metalness:0.3});
    var disc2 = new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.25,0.05,20), discMat2);
    disc2.rotation.x = 0.25; g.add(disc2);
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
      if (i === myIdx) continue;
      var _rpCol = PLAYER_COLORS[i % PLAYER_COLORS.length];
      // Start remote player at tee surface, offset slightly so they don't stack
      var _teeOffX = (i - myIdx) * 1.2;
      var _teeY = terrainY(_teeOffX, 0, h, idx);
      const rp = {
        discPos: new THREE.Vector3(_teeOffX, _teeY + 0.3, 0),
        discVel: new THREE.Vector3(), spin: 0, flying: false, discMesh: null,
        avatarMesh: null, nameLabel: null,
        discType: PLAYER_DISC_TYPES[i] || "midrange",
        color: _rpCol, name: playerNames[i] || ("Player "+(i+1)), aimAngle: 0,
        targetX: _teeOffX, targetZ: 0,  // initialize so lerp starts correctly
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

  baseAim      = Math.atan2(h.bx, -h.bz);
  aimAngle     = baseAim;
  throwPower   = 0;
  phase        = "AIMING";
  throwCount   = 0;
  myHoleDone   = false;
  (function(){
    var _sa=baseAim,_cd=new THREE.Vector3(Math.sin(_sa),0,-Math.cos(_sa));
    var _dist=Math.min(15,Math.hypot(h.bx-discPos.x,h.bz-discPos.z)*0.5+7);
    var _sy=(h.water||-1.5)+1.75+(h.teeElev||0)+0.06;
    if(typeof _camPos!=="undefined") _camPos.set(discPos.x-_cd.x*_dist,_sy+8,discPos.z+_cd.z*_dist);
    if(typeof _camLook!=="undefined") _camLook.set(discPos.x+_cd.x*6,_sy+1.5,discPos.z+_cd.z*6);
  })();
  playerDone.fill(false);
  playerThrows.fill(0);
  mpScoreRecorded.fill(false);
  clearThrowHistory();
  setSpectating(false);

  const fnb = document.getElementById("force-next-btn");
  if (fnb) fnb.style.display = mpMode && myIdx === 0 ? "block" : "none";
  const gub = document.getElementById("giveup-btn");
  if (gub) { gub.style.display = "block"; gub.style.pointerEvents = "all"; }

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
    _hTxt.textContent = h.templateLabel
      ? _thName + " · " + h.templateLabel
      : _thName;
  }
}

// ── SCORING ───────────────────────────────────────────────────────────────────
function scored() {
  phase = "SCORED";
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
  pushThrowHistory();

  if (mpMode) {
    playerDone[myIdx]   = true;
    playerThrows[myIdx] = throwCount;
    if (!mpScoreRecorded[myIdx]) { mpTotals[myIdx] += diff; mpScoreRecorded[myIdx] = true; }
    sendToAll({ t: "score", from: myIdx, throws: throwCount, hole: holeIdx });
    updateMpUI();
    if (!checkAllDone()) {
      const watchIdx = playerDone.findIndex((d, i) => !d && i < playerCount);
      setSpectating(true, watchIdx);
      showMsg(labels[idx2], "Watching others\u2026", null);
    }
  } else {
    setSpectating(false);
    showMsg(labels[idx2], "", "Next Hole \u2192");
  }
  updateScoreUI();
}

function landed() {
  if (!HOLES[holeIdx]) { phase = "AIMING"; return; }
  phase = "LANDED";
  const h = HOLES[holeIdx], m = Math.hypot(discPos.x - h.bx, discPos.z - h.bz);
  const dd = document.getElementById("dist");
  dd.textContent = m.toFixed(1) + " m from basket";
  dd.style.opacity = "1";
  baseAim  = Math.atan2(h.bx - discPos.x, -(h.bz - discPos.z));
  aimAngle = baseAim;
  if (mpMode) sendToAll({ t: "land", from: myIdx, px: discPos.x, py: discPos.y, pz: discPos.z, throws: throwCount });
  setTimeout(() => {
    if (phase !== "LANDED") return;
    dd.style.opacity = "0";
    if (throwCount >= 12) {
      if (holeScores[holeIdx] === undefined || holeScores[holeIdx] === null) {
        holeScores[holeIdx] = throwCount;
        totalVsPar += throwCount - HOLES[holeIdx].par;
      }
      myHoleDone = true;
      playerDone[myIdx]   = true;
      playerThrows[myIdx] = throwCount;
      if (mpMode) {
        sendToAll({ t: "givenup", from: myIdx, throws: throwCount, hole: holeIdx });
        if (!mpScoreRecorded[myIdx]) { mpTotals[myIdx] += throwCount - HOLES[holeIdx].par; mpScoreRecorded[myIdx] = true; }
        updateMpUI();
        if (!checkAllDone()) {
          const watchIdx = playerDone.findIndex((d, i) => !d && i < playerCount);
          setSpectating(true, watchIdx);
          showMsg("MAX THROWS", "Watching others finish\u2026", null);
        }
      } else {
        showMsg("MAX THROWS", "12 throws reached \u2014 moving on!", "Next Hole \u2192");
      }
      return;
    }
    phase = "AIMING";
  }, 2400);
}

function outOfBounds(isTimeout) {
  if (!HOLES[holeIdx]) return;
  phase = "SCORED";
  throwCount++;
  var h2 = HOLES[holeIdx];
  if (typeof handleImpact === "function") {
    var _hazType = isTimeout ? "energy"
      : (h2.theme==="moon"||h2.theme==="grandcanyon") ? "crater" : "water";
    handleImpact(_hazType, discPos.clone(), discVel.clone());
  }
  var hazardMsg = isTimeout ? "LOST IN THE VOID!"
    : h2.theme === "moon"        ? "CRATER! -1 Stroke."
    : h2.theme === "grandcanyon" ? "FELL IN CANYON! -1 Stroke."
    : h2.theme === "office"      ? "FELL OFF MAP! -1 Stroke."
    : "WATER HAZARD! -1 Stroke.";
  showMsg(hazardMsg, "Resetting to last safe spot\u2026", null);
  updateScoreUI();
  setTimeout(() => {
    if (phase !== "SCORED") return;
    hideMsg();
    // Respawn at last THROW position — where player stood before the bad throw
    var _rp = (typeof throwHistory !== "undefined" && throwHistory.length > 0)
      ? throwHistory[throwHistory.length - 1].pos.clone()
      : lastValidPos.clone();
    if (HOLES[holeIdx]) {
      var _rGnd = terrainY(_rp.x, _rp.z, HOLES[holeIdx], holeIdx);
      var _rWat = HOLES[holeIdx].water || -1.5;
      if (_rGnd <= _rWat + 0.3) {
        _rp.set(0, _rWat + 1.75 + 0.06, 0);  // fallback: tee island
      } else {
        _rp.y = _rGnd + 0.06;
      }
    }
    discPos.copy(_rp); discVel.set(0, 0, 0); discSpin = 0;
    discMesh.visible = true;
    discMesh.position.copy(discPos);
    phase = "LANDED";
    const m = Math.hypot(discPos.x - HOLES[holeIdx].bx, discPos.z - HOLES[holeIdx].bz);
    document.getElementById("dist").textContent  = m.toFixed(1) + " m";
    document.getElementById("dist").style.opacity = "1";
    baseAim  = Math.atan2(HOLES[holeIdx].bx - discPos.x, -(HOLES[holeIdx].bz - discPos.z));
    aimAngle = baseAim;
    if (mpMode) sendToAll({ t: "land", from: myIdx, px: discPos.x, py: discPos.y, pz: discPos.z, throws: throwCount });
    setTimeout(() => { document.getElementById("dist").style.opacity = "0"; phase = "AIMING"; }, 1800);
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
  var next = holeIdx + 1;
  if (next >= HOLE_COUNT) {
    // Game over — show final scorecard
    showMsg("GAME OVER!",
      "You played " + HOLE_COUNT + " holes! Total vs par: " +
      (totalVsPar >= 0 ? "+" + totalVsPar : totalVsPar), null);
    setTimeout(function() {
      hideMsg();
      document.getElementById("menu").style.display = "flex";
      document.getElementById("ui").style.display   = "none";
      phase = "MENU";
      _SP_FORCED_THEME = null;
      AudioEngine._gameActive = false;
      AudioEngine.stopAll();
      AudioEngine.playMenu();
    }, 4000);
    return;
  }
  holeIdx = next;
  seedRNG(matchSeed + next * 7331);
  HOLES[next] = generateHole(next + 1);
  loadHole(next);
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
  if (prv) prv.textContent = "❌ Invalid code";
}

function _buildDlTabs() {
  var box = document.getElementById("dl-disc-tabs"); if (!box) return; box.innerHTML = "";
  Object.keys(DISCS).forEach(function(disc) {
    var btn = document.createElement("button");
    btn.textContent = (DISCS[disc].icon||"") + " " + (DISCS[disc].label||disc);
    btn.style.cssText = "padding:3px 8px;font-size:11px;font-family:'Bebas Neue',cursive;cursor:pointer;border-radius:4px;border:1px solid rgba(185,103,255,.4);background:"+(disc===_dlActiveDisc?"rgba(185,103,255,.35)":"transparent")+";color:#fff;letter-spacing:1px;margin:1px";
    btn.onclick = function(){ _dlActiveDisc = disc; _buildDlTabs(); _buildDlGrid(disc); };
    box.appendChild(btn);
  });
}

function _buildDlGrid(discType) {
  var grid = document.getElementById("dl-skin-grid");
  var prv  = document.getElementById("dl-preview-name");
  if (!grid) return; grid.innerHTML = "";
  if (typeof DISC_SKINS === "undefined" || !DISC_SKINS._global) {
    grid.innerHTML = "<div style='color:#ff4444;font-family:monospace;font-size:11px;grid-column:1/-1;padding:8px'>ERROR: DISC_SKINS not loaded</div>";
    return;
  }
  var skins = DISC_SKINS._global.slice();
  if (discType==="vilov"&&DISC_SKINS.vilov) skins=skins.concat(DISC_SKINS.vilov);
  var eqId = (equippedSkins&&equippedSkins[discType])||"classic";
  skins.forEach(function(skin) {
    var locked = !(unlockedSkins&&unlockedSkins[skin.id]);
    var isEq   = eqId === skin.id;
    var rarCol = (RARITY_COLORS&&RARITY_COLORS[skin.rarity])||"#aaa";
    var card = document.createElement("div");
    card.className = "skin-card" + (isEq ? " active" : "") + (locked ? " locked" : "");
    var _bg  = isEq ? "#5a2000" : "#1e0a00";
    var _brd = isEq ? "#ffcc00" : (locked ? "#5a2800" : "#8b4000");
    card.style.cssText = "background:"+_bg+";border:2px solid "+_brd+";padding:8px 6px;text-align:center;cursor:"+(locked?"default":"pointer")+";box-shadow:2px 2px 0 #5a2000;opacity:"+(locked?"0.38":"1")+";";
    card.title = (skin.desc||"") + (skin.unlock ? " | Unlock: "+skin.unlock : "");
    var _hex  = skin.color ? "#"+skin.color.toString(16).padStart(6,"0") : null;
    var swatch = _hex
      ? "<span style='display:inline-block;width:20px;height:20px;background:"+_hex+";border-radius:50%;border:2px solid rgba(255,255,255,.4);margin-bottom:2px'></span>"
      : "<span style='font-size:22px;display:block;margin-bottom:3px'>🎨</span>";
    var extras = "";
    if (skin.shape||skin.rainbow||skin.holo||skin.giant) extras += "<div style='font-size:7px;color:#ffcc00'>+SHAPE</div>";
    if (skin.particles) extras += "<div style='font-size:7px;color:#ff8800'>+FX</div>";
    card.innerHTML =
      swatch +
      "<div style='font-family:\"Bebas Neue\",cursive;font-size:12px;color:#ffd580;letter-spacing:1px'>" + skin.name + "</div>" +
      "<div style='font-size:8px;color:"+rarCol+";letter-spacing:1px'>" + skin.rarity.toUpperCase() + "</div>" +
      extras +
      (locked ? "<div style='font-size:8px;color:#cc8833;margin-top:2px;opacity:.7'>" + (skin.unlock||"") + "</div>" : "");
    if (!locked) {
      card.onclick = function() {
        equippedSkins[discType]=skin.id; saveSkins();
        if(prv) prv.textContent = skin.name+" equipped!";
        _buildDlGrid(discType);
        if(typeof discMesh!=="undefined"&&selectedDisc===discType&&typeof buildDisc==="function"&&scene) {
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
  var main = document.getElementById("sp-main-btns");
  var picker = document.getElementById("sp-map-picker");
  if (!main || !picker) return;
  var show = picker.style.display === "none" || picker.style.display === "";
  main.style.display   = show ? "none" : "";
  picker.style.display = show ? "block" : "none";
  if (show) _buildSpMapPicker();
}

function _buildSpMapPicker() {
  var grid = document.getElementById("sp-map-grid");
  if (!grid || grid.children.length > 0) return;  // already built
  var names = typeof MAP_DISPLAY_NAMES !== "undefined" ? MAP_DISPLAY_NAMES : {};
  var cols = typeof themeColors !== "undefined" ? themeColors : {};
  THEMES.forEach(function(th) {
    var tc = cols[th] || {};
    var bg = tc.sky1 ? "#" + tc.sky1.toString(16).padStart(6,"0") : "#222233";
    var tile = document.createElement("button");
    tile.style.cssText = "background:" + bg + ";color:#fff;border:2px solid rgba(255,255,255,.18);border-radius:5px;padding:6px 4px;font-size:11px;cursor:pointer;text-align:center;line-height:1.2;transition:border-color .15s,transform .1s;font-family:inherit";
    tile.textContent = names[th] || th;
    tile.title = th;
    tile.onmouseenter = function(){ this.style.borderColor="rgba(255,200,80,.9)"; this.style.transform="scale(1.06)"; };
    tile.onmouseleave = function(){ this.style.borderColor="rgba(255,255,255,.18)"; this.style.transform=""; };
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
  funny:["funny","feet_bunnies","socks_basket","public_poo","minion","emote","minecraft"],
  urban:["city","office","disco","neon","geometry_dash"],
  nature:["mountains","winter","waterfall","cabbage","village","grandcanyon"],
  new:["poolrooms","hogwarts","village","minecraft","skyblock"],
};
function setMapPool(name){
  ACTIVE_THEMES=MAP_POOLS[name]||null;
  var lbl=document.getElementById("pool-label");
  var pNames={all:"All Maps",spooky:"🌌 Spooky",funny:"😂 Funny",urban:"🏙️ Urban",nature:"🌿 Nature",new:"🎮 New"};
  if(lbl) lbl.textContent="Pool: "+(pNames[name]||"All Maps");
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
  hogwarts:"⚡ Hogwarts", village:"🏡 Village", minecraft:"⛏️ Minecraft", skyblock:"🌤️ Skyblock",
  vetschool:"🐾 Vet School",
};

function initMapCheckboxes() {
  var box = document.getElementById("map-checkboxes");
  if (!box || box.children.length > 0) return;  // already built
  THEMES.forEach(function(th) {
    var label = document.createElement("label");
    label.style.cssText = "display:flex;align-items:center;gap:4px;padding:2px 4px;cursor:pointer;border-radius:3px;color:#ccc";
    var cb = document.createElement("input");
    cb.type = "checkbox"; cb.value = th; cb.style.accentColor = "#b967ff";
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
  var started = false;
  function tryStart() {
    if (started) return; started = true;
    AudioEngine.init();
    if (typeof AudioEngine.playMenu === "function") AudioEngine.playMenu();
  }
  // Start on first user interaction (required by browser autoplay policy)
  ["click","keydown","touchstart"].forEach(function(ev) {
    window.addEventListener(ev, tryStart, {once:true, passive:true, capture:true});
  });
})();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  T += dt;

  // Always update GLB mixers — must happen before any early return
  if (typeof _glbMixers !== "undefined") _glbMixers.forEach(function(m){m.update(dt);});

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
      var _want = (rp.punchStagger > 0) ? "jump" : (_rwlk ? "walk" : "idle");
      if (mesh._wantAnim !== _want) {
        mesh._wantAnim = _want;
        if (typeof switchAvatarAnim === "function") switchAvatarAnim(mesh, _want);
      }
    });
  }

  // While in MENU or before a hole is loaded, just render and return
  if (phase === "MENU" || !HOLES[holeIdx]) {
    renderer.render(scene, camera);
    return;
  }

  if (phase === "AIMING") {
    var _rs = 1.4 * dt;

    // ── Arrow keys: rotate aim (both modes) ──
    if (keys.ArrowLeft)  { baseAim += _rs; aimAngle = baseAim; }
    if (keys.ArrowRight) { baseAim -= _rs; aimAngle = baseAim; }

    // ── WASD: move player position in TP mode ──────────────────────────
    if(_punchCooldown>0)_punchCooldown-=dt;
    if(_punchImmunity>0)_punchImmunity-=dt;
    if (typeof _tickPunchTimers === "function") _tickPunchTimers(dt);
    if((keys.r||keys.R)&&_punchCooldown<=0&&cameraMode!=="spec"){
      _punchCooldown=1.2; keys.r=false; keys.R=false; _doPunch();
    }

    if (cameraMode === "tp" && HOLES[holeIdx]) {
      var _moveSpd = 5.5 * dt;
      var _fwdX = Math.sin(aimAngle), _fwdZ = -Math.cos(aimAngle);
      var _rightX = Math.cos(aimAngle), _rightZ = Math.sin(aimAngle);
      var _savedX = discPos.x, _savedZ = discPos.z;
      var _moved = false;

      // ── PUNCH KNOCKBACK SLIDE ─────────────────────────────────────────
      // Applied every frame during _punchKnockTimer, decays with friction.
      // This moves the PLAYER BODY (discPos), not the disc.
      if (_punchKnockTimer > 0) {
        _punchKnockTimer -= dt;
        var _kFric = Math.pow(0.06, dt);  // fast friction — stumble, not flight
        _punchKnockVelX *= _kFric;
        _punchKnockVelZ *= _kFric;
        discPos.x += _punchKnockVelX;
        discPos.z += _punchKnockVelZ;
        _moved = true;
        // Block player input while staggering
        // (fall through — WASD keys below are not pressed during knockback)
      }

      if (keys.w || keys.W) { discPos.x += _fwdX*_moveSpd;   discPos.z += _fwdZ*_moveSpd;   _moved=true; }
      if (keys.s || keys.S) { discPos.x -= _fwdX*_moveSpd;   discPos.z -= _fwdZ*_moveSpd;   _moved=true; }
      if (keys.a || keys.A) { discPos.x -= _rightX*_moveSpd; discPos.z -= _rightZ*_moveSpd;  _moved=true; }
      if (keys.d || keys.D) { discPos.x += _rightX*_moveSpd; discPos.z += _rightZ*_moveSpd;  _moved=true; }

      if (_moved) {
        var _h   = HOLES[holeIdx];
        var _wat = _h.water || -1.5;
        // ON_ISLAND: terrainY returns waterY+1.75+elev when on island surface.
        var _ON  = _wat + 0.8;

        var _gFull = terrainY(discPos.x, discPos.z, _h, holeIdx);
        if (_gFull >= _ON) {
          discPos.y = _gFull + 0.06;
        } else {
          // Try axis slides
          discPos.x = _savedX;
          var _gZ = terrainY(discPos.x, discPos.z, _h, holeIdx);
          if (_gZ >= _ON) {
            discPos.y = _gZ + 0.06;
          } else {
            discPos.z = _savedZ;
            var _gX = terrainY(discPos.x, discPos.z, _h, holeIdx);
            if (_gX >= _ON) {
              discPos.y = _gX + 0.06;
            } else {
              discPos.x = _savedX; discPos.z = _savedZ;
              discPos.y = terrainY(_savedX, _savedZ, _h, holeIdx) + 0.06;
            }
          }
        }

        // Grace push-back: clamp to nearest island if still off-surface
        if (terrainY(discPos.x, discPos.z, _h, holeIdx) < _ON) {
          var _centres = [
            {x:0,z:0,r:(_h.teeWalkR || 8)},
            {x:_h.bx,z:_h.bz,r:(_h.basketWalkR || 8)}
          ];
          _h.waypoints.forEach(function(wp){_centres.push({x:wp.x,z:wp.z,r:wp.walkR || wp.r || 7});});
          if(_h.movingIslands) _h.movingIslands.forEach(function(mv){
            _centres.push({x:mv.currentX||mv.baseX,z:mv.currentZ||mv.baseZ,r:mv.r||6});
          });
          var _bc=null,_bd=Infinity;
          _centres.forEach(function(c){var d=Math.hypot(discPos.x-c.x,discPos.z-c.z);if(d<_bd){_bd=d;_bc=c;}});
          if(_bc){
            var _pd=Math.hypot(discPos.x-_bc.x,discPos.z-_bc.z)||0.001;
            var _sr=_bc.r-0.3;
            if(_pd>_sr){discPos.x=_bc.x+(discPos.x-_bc.x)/_pd*_sr;discPos.z=_bc.z+(discPos.z-_bc.z)/_pd*_sr;}
            discPos.y=terrainY(discPos.x,discPos.z,_h,holeIdx)+0.06;
          }
        }
      }

    }
    if(localAvatarMesh&&localAvatarMesh.userData.glbLoaded&&phase==="AIMING"){
      // Hysteresis: start walking at vel>0.50, stop at vel<0.18
      // Prevents rapid idle↔walk flickering at threshold boundary
      var _curVel  = Math.hypot(_playerVelX, _playerVelZ);
      var _wasWalk = localAvatarMesh.userData.isMoving || false;
      var _wlk2    = cameraMode === "tp" && (_wasWalk ? _curVel > 0.18 : _curVel > 0.50);
      if (_wlk2 !== _wasWalk) {
        localAvatarMesh.userData.isMoving = _wlk2;
        if (typeof switchAvatarAnim === "function")
          switchAvatarAnim(localAvatarMesh, _wlk2 ? "walk" : "idle");
      }
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
  // Mid-flight disc tilt — A/D
  if (phase === "FLYING") {
    var _steerStr = 2.5 * dt;
    if (keys.a || keys.A) { discVel.x -= Math.cos(Math.atan2(discVel.x, -discVel.z)) * _steerStr; }
    if (keys.d || keys.D) { discVel.x += Math.cos(Math.atan2(discVel.x, -discVel.z)) * _steerStr; }
  }

  obstacles.forEach((o) => {
    var _baseX = (o.movingIsland ? (o.localStartX || 0) : o.startX);
    var _baseZ = (o.movingIsland ? (o.localStartZ || 0) : o.startZ);
    if (o.type === "tractor") {
      o.mesh.position.x = _baseX + Math.sin(T * o.speed + o.phase) * 8; o.x = o.mesh.position.x;
    } else if (o.type === "axe") {
      o.mesh.position.z = _baseZ + Math.cos(T * o.speed + o.phase) * 6; o.mesh.rotation.y += dt * 5; o.z = o.mesh.position.z;
    } else if (o.type === "furry") {
      o.mesh.position.y = o.startY + Math.abs(Math.sin(T * o.speed * 2 + o.phase)) * 4;
      o.mesh.position.x = _baseX + Math.sin(T * o.speed + o.phase) * 5; o.x = o.mesh.position.x;
    } else if (o.type === "entity") {
      o.mesh.position.y = o.startY + Math.sin(T * 2 + o.phase) * 0.5;
      if (phase === "FLYING") o.mesh.lookAt(discPos.x, o.mesh.position.y, discPos.z);
    } else if (o.type === "bunny") {
      o.mesh.position.y = o.startY + Math.abs(Math.sin(T * o.speed * 3 + o.phase)) * 8;
    } else if (o.type === "foot") {
      o.mesh.position.y = o.startY + Math.abs(Math.sin(T * o.speed + o.phase)) * 5;
    } else if (o.type === "car") {
      const prevZ = o.mesh.position.z;
      o.mesh.position.z += o.speed * dt * 15;
      if (o.mesh.position.z > _baseZ + 40) o.mesh.position.z = _baseZ - 40;
      const dz = o.mesh.position.z - prevZ;
      if (Math.abs(dz) > 0.001) o.mesh.rotation.y = dz > 0 ? 0 : Math.PI;
      o.z = o.mesh.position.z;
    } else if (o.type === "sock") {
      o.mesh.rotation.z = Math.sin(T * o.speed + o.phase) * 0.25;
      o.mesh.position.y = o.startY + Math.abs(Math.sin(T * o.speed * 0.5 + o.phase)) * 0.3;
    } else if (o.type === "laundry") {
      o.mesh.rotation.z = Math.sin(T * 0.8 + o.phase) * 0.06;
    } else if (o.type === "pillar") {
      o.mesh.children.forEach((c) => {
        if (c.material && c.material.color && c.material.color.r > 0.9)
          c.material.opacity = 0.6 + Math.abs(Math.sin(T * 8 + o.phase)) * 0.4;
      });
    } else if (o.type === "poo") {
      o.mesh.rotation.z = Math.sin(T * 1.2 + o.phase) * 0.08;
    } else if (o.type === "screamer") {
      o.mesh.position.y = o.startY + Math.sin(T * 2.5 + o.phase) * 0.6;
      o.mesh.rotation.y += dt * 1.8;
      if (o.mesh.children[0]) o.mesh.children[0].scale.setScalar(1.0 + Math.abs(Math.sin(T * 4 + o.phase)) * 0.12);
      if (phase === "FLYING") o.mesh.lookAt(discPos.x, o.mesh.position.y, discPos.z);
    } else if (o.type === "spike") {
      o.mesh.rotation.y += dt * 3.0;
      o.mesh.position.y  = o.startY + Math.abs(Math.sin(T * 3 + o.phase)) * 1.5;
    } else if (o.type === "toilet") {
      o.mesh.rotation.z = Math.sin(T * 4 + o.phase) * 0.04;
    } else if (o.type === "tornado") {
      o.mesh.rotation.y += dt * 4.0;
      o.mesh.position.x  = _baseX + Math.sin(T * o.speed + o.phase) * 3; o.x = o.mesh.position.x;
      if (phase === "FLYING") {
        const td = Math.hypot(discPos.x - o.mesh.position.x, discPos.z - o.z);
        if (td < 10) {
          discVel.x += ((o.mesh.position.x - discPos.x) / td) * 0.8 * dt;
          discVel.z += ((o.z - discPos.z) / td) * 0.8 * dt;
        }
      }
    } else if (o.type === "waterfall") {
      o.mesh.children.forEach((c) => {
        if (c.material && c.material.transparent)
          c.material.opacity = 0.5 + Math.abs(Math.sin(T * 3 + o.phase)) * 0.25;
      });
    } else if (o.type === "number") {
      o.mesh.rotation.y += dt * 0.3;
    } else if (o.type === "lamp") {
      o.mesh.children.forEach((c) => {
        if (c.isLight) c.intensity = 1.0 + Math.sin(T * 12 + o.phase) * 0.15;
      });
    } else if (o.type === "dog" || o.type === "woman") {
      var _isDog = o.type === "dog";
      // Lazy-init heading — non-zero timer so they don't bolt on spawn
      if (o._dirAngle === undefined) {
        o._dirAngle = Math.random() * Math.PI * 2;
        o._dirTimer = (_isDog ? 1.0 : 1.5) + Math.random() * 2.0;
      }
      o._dirTimer -= dt;
      if (o._dirTimer <= 0) {
        if (_isDog) {
          o._dirAngle += (Math.random() - 0.5) * Math.PI * 1.6;  // erratic dog turns
          o._dirTimer = 0.8 + Math.random() * 1.8;
        } else {
          o._dirAngle += (Math.random() - 0.5) * Math.PI * 0.8;  // smooth jog arcs
          o._dirTimer = 2.0 + Math.random() * 3.0;
        }
      }
      var _spd   = o.speed * (_isDog ? 1.0 : 1.5) * dt;
      var _newX  = o.mesh.position.x + Math.cos(o._dirAngle) * _spd;
      var _newZ  = o.mesh.position.z + Math.sin(o._dirAngle) * _spd;
      // Only step onto solid island surface — bounce at edges
      var _h     = HOLES[holeIdx];
      var _wLvl  = _h ? (_h.water || -1.5) : -1.5;
      var _gnd   = _h ? terrainY(_newX, _newZ, _h, holeIdx) : o.startY;
      if (_gnd > _wLvl + 0.15) {
        // Valid ground — accept move and snap Y to surface
        o.mesh.position.x = _newX;
        o.mesh.position.z = _newZ;
        o.mesh.position.y = _gnd;
      } else {
        // Island edge — flip direction immediately, reset timer
        o._dirAngle += Math.PI + (Math.random() - 0.5) * 0.8;
        o._dirTimer = 0.4 + Math.random() * 0.8;
      }
      o.mesh.rotation.y = Math.atan2(Math.cos(o._dirAngle), Math.sin(o._dirAngle));
      o.x = o.mesh.position.x; o.z = o.mesh.position.z;
    }
    _refreshObstacleWorldPosition(o);
  });

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
    if (hd < o.r + 0.55 && discPos.y < o.h + (o.mesh.position.y || 0) && discPos.y > (o.mesh.position.y || 0) - 0.5) {
      const nx = dx / hd, nz = dz / hd;
      const dot = discVel.x * nx + discVel.z * nz;
      if (dot < 0) {
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

  // ── OBSTACLE vs PLAYER BODY (AIMING phase) ────────────────────────────────
  // Moving obstacles (cars etc) can smack the player while they're walking around
  if (phase === "AIMING" && cameraMode === "tp" && _punchImmunity <= 0) {
    obstacles.forEach(function(o) {
      if (!o.speed || o.speed <= 0) return;  // only moving obstacles
      var _pdx = discPos.x - o.x, _pdz = discPos.z - o.z;
      var _pd  = Math.sqrt(_pdx*_pdx + _pdz*_pdz);
      if (_pd < o.r + 0.7) {
        // Player hit by obstacle — apply knockback like a punch
        var _impLen = _pd || 0.001;
        var _nx = _pdx / _impLen, _nz = _pdz / _impLen;
        var _imp = 8.0 + o.speed * 2;
        _punchKnockVelX = _nx * _imp;
        _punchKnockVelZ = _nz * _imp;
        _punchKnockTimer = 0.6;
        _punchImmunity   = 1.0;
        if (typeof switchAvatarAnim === "function" && localAvatarMesh) switchAvatarAnim(localAvatarMesh, "jump");
        if (typeof _screenShake !== "undefined") { _screenShake = 0.35; _screenShakeT = 0.4; }
        if (typeof _spawnBonkText === "function") _spawnBonkText(discPos.clone());
        // Broadcast to others
        if (mpMode && typeof sendToAll === "function") {
          sendToAll({ t: "punch_launch", from: -1, target: myIdx,
            px: discPos.x, py: discPos.y, pz: discPos.z,
            vx: _nx*_imp, vy: 2.0, vz: _nz*_imp,
            dx: _nx, dz: _nz, impulse: _imp, stagger: 0.6 });
        }
      }
    });
  }

  stepPhysics(dt);
  if(_screenShakeT>0){_screenShakeT-=dt;_screenShake*=0.82;if(_screenShakeT<=0)_screenShake=0;}
  updateCamera(dt);
  updateTrail(discPos, phase === "FLYING");
  updateParticles(dt);
  updateRain(dt);
  checkPowerupCollection();

  powerupMeshes.forEach((p) => {
    if (!p.collected && p.mesh) {
      p.mesh.rotation.y  += dt * 2;
      p.mesh.position.y  += Math.sin(T * 2 + p.x) * 0.008;
    }
  });

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

  if (phase === "AIMING" && HOLES[holeIdx]) {
    // Legacy stable guardrail from old game.js:
    // hard-clamp player to nearest island's safe radius.
    var h = HOLES[holeIdx];
    var centers = [{ x: 0, z: 0, r: 8 }, { x: h.bx, z: h.bz, r: 8 }];
    if (h.waypoints) {
      h.waypoints.forEach(function(wp) {
        centers.push({ x: wp.x, z: wp.z, r: wp.walkR || wp.r || 7 });
      });
    }
    if (h.movingIslands) {
      h.movingIslands.forEach(function(mv) {
        centers.push({ x: mv.currentX || mv.baseX, z: mv.currentZ || mv.baseZ, r: mv.walkR || mv.r || 6 });
      });
    }
    var closest = null, minDist = Infinity;
    centers.forEach(function(c) {
      var d = Math.hypot(discPos.x - c.x, discPos.z - c.z);
      if (d < minDist) { minDist = d; closest = c; }
    });
    if (closest) {
      var maxSafeRadius = closest.r - 0.5;
      if (minDist > maxSafeRadius) {
        var angle = Math.atan2(discPos.z - closest.z, discPos.x - closest.x);
        discPos.x = closest.x + Math.cos(angle) * maxSafeRadius;
        discPos.z = closest.z + Math.sin(angle) * maxSafeRadius;
      }
    }

    // Track which moving platform currently supports the player/disc.
    if (phase === "AIMING" || phase === "LANDED") {
      var _supportNow = _findSupportPlatform(discPos.x, discPos.z, HOLES[holeIdx]);
      if (_supportNow !== discSupportPlatform) {
        discSupportPlatform = _supportNow;
        if (discSupportPlatform && discSupportPlatform.entity && discSupportPlatform.entity.root) {
          discSupportPlatform.entity.root.worldToLocal(discSupportLocalPos.copy(discPos));
        }
      }
    }

    const _gndNow = terrainY(discPos.x, discPos.z, HOLES[holeIdx], holeIdx);
    if (discPos.y < _gndNow + 0.3) discPos.y = _gndNow + 0.3;

    // TP: avatar stands at player position, holds disc in hand
    if (localAvatarMesh) {
      localAvatarMesh.visible = (cameraMode === "tp");
      var _fl = (typeof _playerFeetLift === "function") ? _playerFeetLift(myIdx) : 0;
      localAvatarMesh.position.set(discPos.x, _gndNow + _fl + 0.1, discPos.z);
      
      var _safeDt = Math.max(0.0001, dt);
      var _dvx = (discPos.x - _prevDiscX) / _safeDt;
      var _dvz = (discPos.z - _prevDiscZ) / _safeDt;
      
      _prevDiscX = discPos.x; _prevDiscZ = discPos.z;
      
      _dvx = Math.max(-20, Math.min(20, _dvx));
      _dvz = Math.max(-20, Math.min(20, _dvz));
      
      var _vs = Math.min(1, 14*dt);
      _playerVelX += (_dvx - _playerVelX) * _vs;
      _playerVelZ += (_dvz - _playerVelZ) * _vs;
      var _velMag = Math.hypot(_playerVelX, _playerVelZ);
      
      if (_velMag > 0.4) {
        // Fixed math mapping for Three.js coordinates
        var _tYaw = Math.atan2(_playerVelX, _playerVelZ);
        var _dYaw = _tYaw - _avatarYaw;
        
        while (_dYaw >  Math.PI) _dYaw -= Math.PI * 2;
        while (_dYaw < -Math.PI) _dYaw += Math.PI * 2;
        
        _avatarYaw += _dYaw * Math.min(1, 16*dt);
      }
      localAvatarMesh.rotation.y = _avatarYaw;

      // Raise right arm (child[7]) when charging
      if (!localAvatarMesh.userData.glbLoaded && localAvatarMesh.children[7]) {
        var _armAngle = -0.55 - throwPower * 0.7;
        localAvatarMesh.children[7].rotation.z = _armAngle;
      }

      // In TP: disc is held in right hand
      // Procedural disc radius=0.54 → shrink to 0.38. GLB disc is already normalized → use 1.0.
      if (discMesh) {
        discMesh.visible = true;
        discMesh.scale.setScalar(discMesh.userData.glbLoaded ? 1.0 : 0.38);
        var _fwdX  = Math.sin(aimAngle), _fwdZ  = -Math.cos(aimAngle);
        var _rgtX  = Math.cos(aimAngle), _rgtZ  =  Math.sin(aimAngle);
        discMesh.position.set(
          discPos.x + _rgtX*0.32 + _fwdX*0.18,
          _gndNow + 1.05,
          discPos.z + _rgtZ*0.32 + _fwdZ*0.18
        );
        discMesh.rotation.y += 1.2 * dt;
      }
    } else if (discMesh) {
      discMesh.visible = true;
      discMesh.scale.setScalar(1.0);  // ensure full size in FP/non-TP modes
      discMesh.position.copy(discPos);
      discMesh.position.y += Math.sin(T * 1.7) * 0.04;
      discMesh.rotation.y += 0.55 * dt;
    }
  }

  // During flight: show disc at full size, hide avatar from behind camera
  if (phase === "FLYING") {
    if (discMesh) { discMesh.visible = true; discMesh.scale.setScalar(1.0); }
    if (localAvatarMesh) {
      localAvatarMesh.visible = (cameraMode === "tp");
      // Avatar stays at last position watching the disc
      if (!localAvatarMesh.userData.glbLoaded && localAvatarMesh.children[7]) {
        localAvatarMesh.children[7].rotation.z = -1.3;  // arm thrown forward
      }
    }
  }

  // On land: restore avatar arm
  if (phase === "LANDED" && localAvatarMesh) {
    localAvatarMesh.visible = (cameraMode === "tp");
    if (!localAvatarMesh.userData.glbLoaded && localAvatarMesh.children[7]) {
      localAvatarMesh.children[7].rotation.z = -0.55;
    }
  }


  // Broadcast position ~15Hz
  if (mpMode && typeof sendToAll === "function") {
    _posBcastAcc = (_posBcastAcc||0) + dt;
    if (_posBcastAcc >= 0.067) {
      _posBcastAcc = 0;
      if (phase === "AIMING" || phase === "LANDED") {
        sendToAll({t:"pos",px:discPos.x,py:discPos.y,pz:discPos.z,aim:aimAngle,yaw:_avatarYaw,vm:Math.round(Math.hypot(_playerVelX,_playerVelZ)*10)/10});
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

  renderer.render(scene, camera);
}

initMenuDecor();
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
  var dx = e.clientX - _fpLastX, dy = e.clientY - _fpLastY;
  aimAngle += dx * _fpSensX; baseAim = aimAngle;  // +dx = look right
  fpPitch   = Math.max(-1.1, Math.min(0.45, fpPitch - dy * _fpSensY));
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

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});