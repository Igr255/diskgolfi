// ── PHYSICS ───────────────────────────────────────────────────────────────────
// Disc flight simulation: gravity, lift, turn/fade, wind (weather-scaled),
// obstacle bounce, and disc-specific behaviours.
// Depends on: config.js (DISCS), weather.js (getWeatherXxx), terrain.js (terrainY, getTerrainNormal)

// ── DISC MESH BUILDER ────────────────────────────────────────────────────────
// ── PLAYER AVATAR BUILDER ──────────────────────────────────────────────────────
// Builds a low-poly stick-figure avatar for remote players (procedural fallback).
// If MODEL_OVERRIDES["player_N"] or MODEL_OVERRIDES["player_default"] is set,
// the procedural mesh is built first then async-swapped for the GLB.
function buildPlayerAvatar(playerIdx, color) {
  var g = new THREE.Group();
  color = color || PLAYER_COLORS[playerIdx % PLAYER_COLORS.length] || 0x00ffff;

  var bodyM  = new THREE.MeshStandardMaterial({color: color, roughness:0.4, metalness:0.2});
  var skinM  = new THREE.MeshStandardMaterial({color: 0xf5cba7, roughness:0.6});
  var darkM  = new THREE.MeshStandardMaterial({color: 0x222222, roughness:0.8});

  // Head
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), skinM);
  head.position.y = 1.62; head.castShadow = true; g.add(head);

  // Body (torso)
  var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.52, 8), bodyM);
  torso.position.y = 1.11; torso.castShadow = true; g.add(torso);

  // Hips
  var hips = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.22, 8), bodyM);
  hips.position.y = 0.78; g.add(hips);

  // Left leg
  var lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.44, 6), darkM);
  lLeg.position.set(-0.1, 0.49, 0); lLeg.castShadow = true; g.add(lLeg);
  var lFoot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.2), darkM);
  lFoot.position.set(-0.1, 0.26, 0.05); g.add(lFoot);

  // Right leg
  var rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.44, 6), darkM);
  rLeg.position.set(0.1, 0.49, 0); rLeg.castShadow = true; g.add(rLeg);
  var rFoot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.2), darkM);
  rFoot.position.set(0.1, 0.26, 0.05); g.add(rFoot);

  // Left arm
  var lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.42, 6), bodyM);
  lArm.position.set(-0.22, 1.12, 0); lArm.rotation.z = 0.22; lArm.castShadow = true; g.add(lArm);

  // Right arm — slightly raised (holding disc)
  var rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.42, 6), bodyM);
  rArm.position.set(0.22, 1.18, 0); rArm.rotation.z = -0.55; rArm.castShadow = true; g.add(rArm);

  // Name tag (billboard — updated per frame in updateCamera)
  g.userData.nameTagOffset = new THREE.Vector3(0, 2.1, 0);

  // Try GLB override
  var overrideKey = "player_default";  // always start with animated base model
  var fallbackKey = null;
  var _staticSkinOk = false;  // set true for skins that intentionally have no animations
  // Local player: use their equipped skin if set
  if (typeof myIdx !== "undefined" && playerIdx === myIdx &&
      typeof equippedPlayerSkin !== "undefined" && equippedPlayerSkin !== "default") {
    var _sk = (typeof PLAYER_SKINS !== "undefined")
      ? PLAYER_SKINS.find(function(s){ return s.id === equippedPlayerSkin; }) : null;
    if (_sk && _sk.modelKey) {
      overrideKey = _sk.modelKey; fallbackKey = "player_default";
      if (_sk.staticSkin) _staticSkinOk = true;
    }
  }
  // Remote player: use their broadcasted skin, fall back to player_default (animated)
  // Never use player_N slot models — those may be static obstacle meshes with no anims
  else if (typeof myIdx !== "undefined" && playerIdx !== myIdx) {
    var _rSkinId = (window._remoteSkins && window._remoteSkins[playerIdx]) || "default";
    if (_rSkinId !== "default" && typeof PLAYER_SKINS !== "undefined") {
      var _rsk = PLAYER_SKINS.find(function(s){ return s.id === _rSkinId; });
      if (_rsk && _rsk.modelKey) {
        overrideKey = _rsk.modelKey; fallbackKey = "player_default";
        if (_rsk.staticSkin) _staticSkinOk = true;
      }
    }
  }
  if (typeof loadModel === "function") {
    var tryLoad = function(key, fallback) {
      if (MODEL_OVERRIDES && !MODEL_OVERRIDES[key] && fallback) { tryLoad(fallback, null); return; }
      loadModel(key, function(glb) {
        if (!glb) { if (fallback) tryLoad(fallback, null); return; }
        // If this model has no animation rig/clips, force animated fallback.
        // Without this, remote players appear to "hover" with static poses.
        // Exception: skins flagged staticSkin:true intentionally have no animations.
        if (!glb.userData || !glb.userData.mixer || !glb.userData.clipActions) {
          if (!_staticSkinOk && fallback && key !== fallback) { tryLoad(fallback, null); return; }
          if (!_staticSkinOk) return;
        }
        while (g.children.length) g.remove(g.children[0]);
        g.add(glb);
        glb.traverse(function(c){ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; } });
        // Store mixer and actions directly on the wrapper group for easy access
        if (glb.userData.mixer) {
          g.userData.mixer      = glb.userData.mixer;
          g.userData.clipActions = glb.userData.clipActions;
          g.userData.activeClipName = glb.userData.activeClipName;
        }
        g.userData.glbLoaded = true;
        g.userData.isMoving  = false;
        if (typeof COS !== "undefined") {
          var _cos = (typeof myIdx !== "undefined" && playerIdx === myIdx && !g.userData.remote) ? COS.equipped() : ((window._remoteCos || {})[playerIdx] || null);
          COS.dressAvatar(g, _cos);
        }
        // Mixer stays in _glbMixers — updated once per frame by game.js animate loop.
        // Do NOT remove it. The global forEach is the single update path (same as lobby).
      });
    };
    tryLoad(overrideKey, fallbackKey);
  }

  return g;
}

// ── Animation clip switcher ─────────────────────────────────────────────────
// animName: logical name "idle" | "walk" | "sprint" | "jump" | "grounded"
// Maps to BasePlayer.glb clip names: 'Armature|Idle', 'Armature|Walk', etc.
// Also accepts legacy numeric 0 (walk) / 1 (idle) for backward compat.
var _ANIM_NAME_MAP = {
  // Logical → BasePlayer.glb exact clip name
  "idle":      "Idle",
  "walk":      "Walk",
  "sprint":    "Sprint",
  "jump":      "Jump",
  "grounded":  "Grounded",
  // Passthrough for already-exact names
  "Armature|Idle":     "Idle",
  "Armature|Walk":     "Walk",
  "Armature|Sprint":   "Sprint",
  "Armature|Jump":     "Jump",
  "Armature|Grounded": "Grounded",
};

function switchAvatarAnim(avatarGroup, animName) {
  if (!avatarGroup) return;

  // Legacy numeric shim: 0 = walk, 1 = idle
  if (typeof animName === "number") animName = animName === 0 ? "walk" : "idle";

  // Resolve logical name → exact clip name
  var resolved = _ANIM_NAME_MAP[animName] || null;
  if (!resolved) {
    // Case-insensitive fallback for non-BasePlayer models
    var lo = animName.toLowerCase();
    resolved = animName; // try as-is
  }

  // Find node that owns clipActions (wrapper group or child)
  var target = null;
  if (avatarGroup.userData && avatarGroup.userData.clipActions) {
    target = avatarGroup;
  } else {
    avatarGroup.traverse(function(c) {
      if (!target && c !== avatarGroup && c.userData && c.userData.clipActions) target = c;
    });
  }
  if (!target) return; // procedural mesh — no clips

  var actions = target.userData.clipActions;

  // Try resolved name, then case-insensitive search
  var actionKey = null;
  if (actions[resolved]) {
    actionKey = resolved;
  } else {
    var lo2 = resolved.toLowerCase();
    var ks = Object.keys(actions);
    for (var ki = 0; ki < ks.length; ki++) {
      if (ks[ki].toLowerCase() === lo2 || ks[ki].toLowerCase().indexOf(lo2.split('|').pop()) >= 0) {
        actionKey = ks[ki]; break;
      }
    }
  }
  if (!actionKey) {
    // Other rigs name their clips differently (Running, Walking, Gallop …)
    var alias = { Sprint: ["running", "run", "gallop"], Walk: ["walking", "walk"], Grounded: ["idle"], Jump: ["jump", "run"], Idle: ["idle"], sit: ["sitidle", "sitting", "idle"], death: ["death", "die", "hitrecieve", "jump"], roll: ["roll", "jump"] }[resolved] || [];
    var ks2 = Object.keys(actions);
    // exact clip names first ("Run", "Man_Run"), only then partial matches ("RunningJump" must not win over "Run")
    var seg = function(k) { return k.toLowerCase().split("|").pop(); };
    for (var ai = 0; ai < alias.length && !actionKey; ai++) actionKey = ks2.find(function(k) { var s2 = seg(k); return s2 === alias[ai] || s2.slice(s2.lastIndexOf("_") + 1) === alias[ai]; }) || null;
    for (var aj = 0; aj < alias.length && !actionKey; aj++) actionKey = ks2.find(function(k) { return seg(k).indexOf(alias[aj]) >= 0; }) || null;
  }
  if (!actionKey) return; // clip not in this model

  var current = target.userData.activeClipName || null;
  if (current === actionKey) return; // already playing

  var fromAction = current ? actions[current] : null;
  var toAction   = actions[actionKey];
  var once = resolved === "Jump" || resolved === "Grounded" || resolved === "death" || resolved === "roll";
  toAction.reset().setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity).play().fadeIn(once ? 0.08 : 0.18);
  toAction.clampWhenFinished = once;
  if (fromAction) fromAction.fadeOut(0.18);
  target.userData.activeClipName = actionKey;
}

// Username label above player (DOM overlay — fast, no texture baking needed)
function createNameLabel(name, color) {
  var el  = document.createElement("div");
  el.className = "mp-name-tag";
  el.textContent = name;
  el.style.cssText = "position:fixed;pointer-events:none;color:#fff;transform:translateX(-50%);z-index:25;display:none;"
    + "box-shadow:inset 3px 0 0 " + (color ? "#" + color.toString(16).padStart(6,"0") : "#fff") + ";";
  document.body.appendChild(el);
  return el;
}

// ── SKIN HELPERS ──────────────────────────────────────────────────────────────
function getSkin(discType, fallbackColor) {
  var skinId = (equippedSkins && equippedSkins[discType]) || "classic";
  var allSkins = (DISC_SKINS && DISC_SKINS._global) || [];
  if (discType === "vilov" && DISC_SKINS && DISC_SKINS.vilov) {
    allSkins = allSkins.concat(DISC_SKINS.vilov);
  }
  var skin = allSkins.find(function(s) { return s.id === skinId; }) || null;
  return skin;
}

// Disc display scale: meshes are modelled at radius 0.54; in flight we show
// them at half size (0.54 m across — ~2.5× a real disc, still easy to follow).
var DISC_SCALE_FLIGHT = 0.5;
var DISC_SCALE_HAND   = 0.4;

function buildDiscMat(color, opacity, metal, glow) {
  var col = color || 0xffffff;
  var p = {
    color: col, roughness: 0.42, metalness: 0.0, clearcoat: 0.7, clearcoatRoughness: 0.22,
    transparent: opacity < 1, opacity: opacity,
  };
  if (metal) { p.metalness = 1.0; p.roughness = 0.16; p.clearcoat = 0.25; }
  if (glow)  { p.emissive = new THREE.Color(glow); p.emissiveIntensity = 0.6; }
  return new THREE.MeshPhysicalMaterial(p);
}

// Real disc golf profile (flight plate dome, shoulder, nose, rim, underside)
var _discProfileGeo = null;
function _discGeometry() {
  if (_discProfileGeo) return _discProfileGeo;
  var P = [
    [0.000, 0.030], [0.300, 0.026], [0.400, 0.018], [0.440, 0.000], [0.447, -0.020], [0.452, -0.040],
    [0.470, -0.048], [0.500, -0.046], [0.522, -0.036], [0.536, -0.022], [0.540, -0.008], [0.533, 0.004],
    [0.505, 0.019], [0.455, 0.033], [0.380, 0.043], [0.280, 0.050], [0.140, 0.055], [0.000, 0.056],
  ].map(function(a) { return new THREE.Vector2(a[0], a[1]); });
  _discProfileGeo = new THREE.LatheGeometry(P, 56);
  _discProfileGeo.userData.shared = true;
  return _discProfileGeo;
}

// Foil hot-stamp on the flight plate
var _discStampCache = {};
function _discStampTexture(label, foil) {
  var key = label + "_" + foil;
  if (_discStampCache[key]) return _discStampCache[key];
  var c = document.createElement("canvas"); c.width = c.height = 256;
  var x = c.getContext("2d");
  x.clearRect(0, 0, 256, 256);
  x.strokeStyle = foil; x.fillStyle = foil; x.lineWidth = 5;
  x.beginPath(); x.arc(128, 128, 118, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 2; x.beginPath(); x.arc(128, 128, 106, 0, Math.PI * 2); x.stroke();
  // basket glyph
  x.lineWidth = 5; x.beginPath(); x.moveTo(128, 70); x.lineTo(128, 160); x.stroke();
  x.beginPath(); x.ellipse(128, 82, 34, 9, 0, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.ellipse(128, 140, 30, 9, 0, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 2;
  for (var i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(128 + i * 9, 84); x.quadraticCurveTo(128 + i * 6, 112, 128 + i * 4, 136); x.stroke(); }
  x.font = "900 30px Nunito, 'Segoe UI', sans-serif"; x.textAlign = "center";
  x.fillText("DISKGOLFI", 128, 200);
  x.font = "800 20px Nunito, 'Segoe UI', sans-serif";
  x.fillText(label.toUpperCase(), 128, 52);
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  t._dgShared = true;
  _discStampCache[key] = t;
  return t;
}

function buildDisc(type, opacity = 1, skinId) {
  const d = DISCS[type] || DISCS.driver;
  // Outer group = orientation (yaw / pitch / bank); inner = spinning body
  const wrap = new THREE.Group();
  const g = new THREE.Group();
  wrap.add(g);
  wrap.userData.spinner = g;
  wrap.rotation.order = "YXZ";

  var _overrideKey = "disc_" + type;
  if (typeof loadModel === "function" && MODEL_OVERRIDES && MODEL_OVERRIDES[_overrideKey]) {
    loadModel(_overrideKey, function(glbGroup) {
      if (!glbGroup) return;
      while (g.children.length) g.remove(g.children[0]);
      g.add(glbGroup);
      glbGroup.traverse(function(c) {
        if (c.isMesh) { c.frustumCulled = false; c.renderOrder = 1; }
      });
      wrap.userData.glbLoaded = true;
    });
  }

  // skinId lets other players' discs show their own skin (not ours)
  var skin = skinId !== undefined && typeof COS !== "undefined" ? COS.discSkin(skinId) : (typeof getSkin === "function") ? getSkin(type, d.color) : null;
  var skinColor = (skin && skin.color) ? skin.color : d.color;
  var skinGlow  = skin ? skin.glow  : null;
  var isMetal   = skin ? !!skin.metal : false;
  var isGiant   = skin ? !!skin.giant : false;
  if (isGiant && type === "vilov") g.scale.setScalar(2.5);

  if (skin && skin.rainbow) {
    skinColor = 0xff0000;
    wrap.userData.rainbow = true;
  }

  if (type === "vilov") {
    // Hungarian sausage (kolbász) — a proud rotating meat cylinder
    var _vCol = skinColor || 0xaa3311;
    const meatM   = buildDiscMat(_vCol, opacity, isMetal, skinGlow);
    meatM.clearcoat = 0.9; meatM.roughness = 0.35;
    const casingM = new THREE.MeshStandardMaterial({ color: new THREE.Color(_vCol).lerp(new THREE.Color(0xffffff),0.15), roughness: 0.5, metalness: isMetal?0.9:0.0, transparent: opacity < 1, opacity });
    const tipM    = new THREE.MeshStandardMaterial({ color: new THREE.Color(_vCol).lerp(new THREE.Color(0x000000),0.3), roughness: 0.8, transparent: opacity < 1, opacity });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.35, 20), meatM);
    body.rotation.z = Math.PI / 2; body.castShadow = true; g.add(body);
    const capL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10), tipM);
    capL.position.x = -0.675; g.add(capL);
    const capR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10), tipM);
    capR.position.x = 0.675; g.add(capR);
    for (var wi = -2; wi <= 2; wi++) {
      const wrinkle = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.022, 6, 20), casingM);
      wrinkle.rotation.y = Math.PI / 2;
      wrinkle.position.x = wi * 0.25;
      g.add(wrinkle);
    }
    const strM = new THREE.MeshStandardMaterial({ color: 0xddcc88, roughness: 0.9 });
    [-0.63, 0.63].forEach(x => {
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 5, 12), strM);
      tie.rotation.y = Math.PI / 2; tie.position.x = x; g.add(tie);
    });
    const badgeM = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: opacity * 0.9 });
    const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), badgeM);
    badge.position.set(0, 0.22, 0); g.add(badge);
    return wrap;
  }

  var skinShape = skin ? (skin.shape || null) : null;
  const m = buildDiscMat(skinColor, opacity, isMetal, skinGlow);

  if (typeof COS !== "undefined" && COS.buildDiscBody(g, skin, d, opacity, skinColor)) {
    // painted pattern or one of the themed shapes (cosmetics.js)
  } else if (skinShape === "pizza") {
    const crust = new THREE.MeshStandardMaterial({ color: 0xd8a050, roughness: 0.85 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.53, 0.09, 8), crust);
    base.castShadow = true; g.add(base);
    const sauce = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.02, 8),
      new THREE.MeshStandardMaterial({color:0xcc2200,roughness:0.6}));
    sauce.position.y = 0.055; g.add(sauce);
    const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.015, 8),
      new THREE.MeshStandardMaterial({color:0xffd66a,roughness:0.5}));
    cheese.position.y = 0.068; g.add(cheese);
    for(var pi=0;pi<5;pi++){
      var pa=pi/5*Math.PI*2;
      var pep=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.015,12),
        new THREE.MeshStandardMaterial({color:0x992211,roughness:0.5}));
      pep.position.set(Math.cos(pa)*0.28,0.08,Math.sin(pa)*0.28); g.add(pep);
    }
  } else if (skinShape === "saw") {
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 40), m);
    base2.castShadow = true; g.add(base2);
    for(var ti=0;ti<16;ti++){
      var ta=ti/16*Math.PI*2;
      var tooth=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.13,3),m);
      tooth.position.set(Math.cos(ta)*0.54,0,Math.sin(ta)*0.54);
      tooth.rotation.y=-ta; tooth.rotation.z=-Math.PI/2; g.add(tooth);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 6), new THREE.MeshStandardMaterial({color:0x333333,metalness:0.8,roughness:0.4}));
    g.add(hub);
  } else if (skinShape === "puck") {
    const base3 = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.22, 32), m);
    base3.castShadow = true; g.add(base3);
  } else if (skinShape === "coin") {
    const base4 = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.04, 48), m);
    base4.castShadow = true; g.add(base4);
    const rim4 = new THREE.Mesh(new THREE.TorusGeometry(0.55,0.025,6,48),m);
    rim4.rotation.x=Math.PI/2; g.add(rim4);
  } else if (skinShape === "banana") {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.55, 0.15, 0), new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0.55, 0.15, 0));
    const bCore = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.14, 12, false), m);
    bCore.castShadow = true; g.add(bCore);
    const tipM = new THREE.MeshStandardMaterial({ color: 0x4a3a1a, roughness: 0.8 });
    [-0.55, 0.55].forEach(function(x) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), tipM); t.position.set(x, 0.15, 0); g.add(t); });
  } else if (skinShape === "ufo") {
    const saucerBase=new THREE.Mesh(new THREE.CylinderGeometry(0.65,0.5,0.12,32),m);
    saucerBase.castShadow=true; g.add(saucerBase);
    const dome2=new THREE.Mesh(new THREE.SphereGeometry(0.35,20,10,0,Math.PI*2,0,Math.PI/2),
      new THREE.MeshPhysicalMaterial({color:0xaaffee,roughness:0.05,metalness:0,transmission:0,transparent:true,opacity:0.6,clearcoat:1}));
    dome2.scale.y=0.55; dome2.position.y=0.06; g.add(dome2);
    const lights=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.04,4,24),
      new THREE.MeshBasicMaterial({color:skinGlow||0x00ffaa,transparent:true,opacity:0.9}));
    lights.rotation.x=Math.PI/2; lights.position.y=-0.02; g.add(lights);
  } else if (skinShape === "key") {
    const kBase=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.22,1.0),m);
    kBase.castShadow=true; g.add(kBase);
    const kTop=new THREE.Mesh(new THREE.BoxGeometry(0.82,0.08,0.82),
      new THREE.MeshStandardMaterial({color:new THREE.Color(skinColor||0xdddddd).lerp(new THREE.Color(0xffffff),0.3),roughness:0.6}));
    kTop.position.y=0.15; g.add(kTop);
  } else {
    // Standard disc: lathe-turned profile + foil stamp
    const body = new THREE.Mesh(_discGeometry(), m);
    body.castShadow = true; body.receiveShadow = true; g.add(body);
    var foil = isMetal ? "#222222" : (skin && skin.holo ? "#ffffff" : "#e8e8f0");
    const stampMat = new THREE.MeshStandardMaterial({
      map: _discStampTexture(d.label || type, foil), transparent: true, metalness: 0.85, roughness: 0.25,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    });
    const stamp = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), stampMat);
    stamp.rotation.x = -Math.PI / 2; stamp.position.y = 0.0575; g.add(stamp);
  }

  if (skinGlow) {
    var gl = new THREE.PointLight(skinGlow, skin && skin.holo ? 0.4 : 0.8, skin && skin.holo ? 6 : 4);
    gl.userData.priority = 5;
    g.add(gl);
  }
  if (skin && skin.particles) wrap.userData.particles = skin.particles;
  wrap.userData.trail = skin && skin.trail ? skin.trail : (skin && skin.color) || d.color || 0xffffff;
  wrap.userData.skinId = skin ? skin.id : "classic";

  if (skinShape && !(typeof COS !== "undefined" && COS.SHAPES[skinShape])) {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.04, 6, 32),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, transparent: opacity < 1, opacity })
    );
    rim.rotation.x = Math.PI / 2; rim.position.y = -0.03; g.add(rim);
  }
  return wrap;
}

// ── TRAJECTORY PREVIEW ────────────────────────────────────────────────────────
// Glowing dots that shrink along the predicted path + a landing ring.
var trajDots = [];
var trajLandRing = null;
var _trajDotGeo = null;

function initTrajDots() {
  trajDots.forEach((d) => scene.remove(d));
  if (trajLandRing) scene.remove(trajLandRing);
  trajDots = [];
  var dotColor = 0xffffff;
  if (HOLES[holeIdx] && typeof GFX !== "undefined") {
    var hc = new THREE.Color(GFX.themePreset(HOLES[holeIdx].theme).hor);
    var lum = hc.r * 0.3 + hc.g * 0.6 + hc.b * 0.1;
    dotColor = lum > 0.55 ? 0x1593d1 : 0xffffff;
  }
  if (!_trajDotGeo) _trajDotGeo = new THREE.SphereGeometry(0.1, 10, 8);
  const m = new THREE.MeshBasicMaterial({ color: dotColor, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  for (let i = 0; i < 32; i++) {
    const d = new THREE.Mesh(_trajDotGeo, m);
    d.scale.setScalar(1.15 - i / 40);
    d.visible = false; d.renderOrder = 5; scene.add(d); trajDots.push(d);
  }
  trajLandRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40),
    new THREE.MeshBasicMaterial({ color: dotColor, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  trajLandRing.rotation.x = -Math.PI / 2; trajLandRing.visible = false; trajLandRing.renderOrder = 5;
  scene.add(trajLandRing);
}

var _trajP = new THREE.Vector3();
var _trajV = new THREE.Vector3();
var _trajBank = [0];
var _trajFrame = 0;

// Simulates the throw with exactly the same aerodynamics as the real flight
// (minus random gusts). Fog/weather reduces the visible preview length.
function updateTrajDots(startPos, startVel) {
  if (!HOLES[holeIdx]) { trajDots.forEach(d => d.visible = false); return; }
  _trajFrame++;
  const h       = HOLES[holeIdx];
  const maxDots = Math.min(trajDots.length, getWeatherDotCount() + 4);
  const SUB     = 7, dt = 0.055 / SUB;
  _trajP.copy(startPos);
  _trajV.copy(startVel);
  _trajBank[0] = (typeof releaseBank !== "undefined") ? releaseBank : 0;
  let landed = false;
  if (trajLandRing) trajLandRing.visible = false;

  for (let i = 0; i < trajDots.length; i++) {
    trajDots[i].visible = false;
    if (landed || i >= maxDots) continue;
    for (let s = 0; s < SUB && !landed; s++) {
      _discAero(_trajV, selectedDisc, dt, _trajBank, true);
      _trajP.addScaledVector(_trajV, dt);
      const g = terrainY(_trajP.x, _trajP.z, h, holeIdx);
      if (_trajP.y <= g + 0.06) {
        landed = true;
        if (g > (h.water || -1.5) + 0.5 && trajLandRing) {
          trajLandRing.position.set(_trajP.x, g + 0.04, _trajP.z);
          trajLandRing.visible = true;
        }
        _trajP.y = Math.max(_trajP.y, g + 0.12);
      }
    }
    trajDots[i].position.copy(_trajP);
    trajDots[i].visible = true;
  }
}

// ── AERODYNAMICS (shared by flight + preview) ─────────────────────────────────
// bankArr[0]: release angle in radians. >0 = anhyzer (curves right), <0 = hyzer (left).
function _discAero(vel, discType, dt, bankArr, preview) {
  const d   = DISCS[discType] || DISCS.driver;
  const spd = vel.length();
  const _h  = HOLES[holeIdx];

  // Drag (disc's own + weather; speed boost powerup halves drag)
  const boost = activePowerups.speed && Date.now() < activePowerups.speed.until;
  const naturalDrag = 1.0 - (1.0 - d.drag) * dt * (boost ? 0.45 : 1.0);
  const weatherDrag = Math.max(0, 1.0 - getWeatherDragAdd() * dt * spd * 0.5);
  vel.x *= naturalDrag * weatherDrag;
  vel.z *= naturalDrag * weatherDrag;

  // Gravity (+ weather weight, low-grav powerup, moon)
  const wGravAdd = getWeatherGravAdd();
  const gravMult = activePowerups.lowgrav && Date.now() < activePowerups.lowgrav.until ? 0.25 : 1.0;
  const gravG    = _h && _h.course && _h.course.gravity < 1 ? 9.8 * 0.42 : 9.8;   // low gravity (moon)
  vel.y -= (gravG + wGravAdd) * gravMult * dt;

  // Lift — tilted by the bank angle
  const wLift = getWeatherLiftMult();
  const bank  = bankArr ? bankArr[0] : 0;
  const liftForce = Math.min(spd * spd * d.lift * wLift, (gravG + Math.max(0, wGravAdd)) * 0.95);
  vel.y += liftForce * Math.cos(bank) * dt;

  // Turn (high speed, to the right) and fade (low speed, to the left) — perpendicular to travel
  const hs = Math.hypot(vel.x, vel.z) || 1e-6;
  const rx = -vel.z / hs, rz = vel.x / hs;   // unit vector to the thrower's right
  const turnDir = discType === "vilov" ? -1 : 1;
  if (spd > 8) {
    const tf = (d.turn / d.stability) * dt * spd * 0.1 * turnDir;
    vel.x += rx * tf; vel.z += rz * tf;
  } else {
    const fs = d.fade * d.stability * dt * spd * 0.15 * turnDir;
    vel.x -= rx * fs; vel.z -= rz * fs;
  }

  // Release angle: the tilted lift pulls the disc sideways, decaying as it levels out
  if (bankArr && Math.abs(bank) > 0.0005) {
    const lat = Math.sin(bank) * Math.min(spd * spd * d.lift * wLift * 2.2, 14);
    vel.x += rx * lat * dt; vel.z += rz * lat * dt;
    bankArr[0] = bank * Math.exp(-0.55 * dt);
  }

  // Glide extension
  if (spd < 12 && vel.y < 0) vel.y += d.glide * 0.5 * dt;

  // Wind (steady) + gusts (live flight only — the preview can't predict gusts)
  const wWind  = getWeatherWindMult();
  const _hWind = _h ? _h.wind : { x: 0, z: 0 };
  vel.x += _hWind.x * wWind * dt;
  vel.z += _hWind.z * wWind * dt;
  if (!preview) {
    const wGust = getWeatherGustStr();
    if (wGust > 0) {
      vel.x += (Math.random() - 0.5) * wGust * dt;
      vel.z += (Math.random() - 0.5) * wGust * dt;
    }
  }
  return spd;
}

// ── CORE PHYSICS STEP ────────────────────────────────────────────────────────
function stepDisc(pos, vel, spinArr, discType, dt, bankArr) {
  const d = DISCS[discType] || DISCS.driver;
  _discAero(vel, discType, dt, bankArr, false);

  const _h2 = HOLES[holeIdx]; if (!_h2) { pos.addScaledVector(vel, dt); return vel.length(); }
  const ty = terrainY(pos.x, pos.z, _h2, holeIdx);
  if (ty > pos.y - 0.0605) {   // epsilon: a disc resting exactly on the surface counts as in contact
    pos.y = ty + 0.06;
    const n = getTerrainNormal(pos.x, pos.z, _h2, holeIdx);
    if (discType === "vilov" && DISCS.vilov && DISCS.vilov.special === "explode") {
      if (typeof vilovExplosionPush === "function") vilovExplosionPush();
    }
    const dot = vel.dot(n);

    // Surface material by theme: bounce / friction / skip / sound
    var _sup = _h2.course ? _h2.course.supportAt(pos.x, pos.z) : null, _sf = _sup && _sup.solid && _sup.solid.surf || (_h2.course && _h2.course.surf);
    var _terrMat = _sf ? ({ grass: "grass", pixel: "grass", dirt: "grass", carpet: "wet", tile: "metal", snow: "snow", sand: "sand", rock: "rock", stone: "rock", concrete: "metal", metal: "metal", wood: "rock" }[_sf] || "grass") : (function(theme) {
      if (theme === "winter") return "snow";
      if (theme === "moon")    return "rock";
      if (theme === "city" || theme === "office" || theme === "neon" || theme === "geometry_dash") return "metal";
      if (theme === "backrooms" || theme === "poolrooms") return "wet";
      if (theme === "grandcanyon" || theme === "mountains") return "rock";
      if (theme === "public_poo" || theme === "screaming_mamamia") return "sand";
      return "grass";
    })(_h2.theme);
    var _surf = {
      grass:  { bounceMult: 1.00, frictionMult: 1.00, skipMult: 1.00, sound: "terrain" },
      rock:   { bounceMult: 1.35, frictionMult: 0.75, skipMult: 1.40, sound: "metal"   },
      sand:   { bounceMult: 0.15, frictionMult: 2.20, skipMult: 0.10, sound: "terrain" },
      wet:    { bounceMult: 0.55, frictionMult: 1.80, skipMult: 0.35, sound: "terrain" },
      metal:  { bounceMult: 1.60, frictionMult: 0.55, skipMult: 1.50, sound: "metal"   },
      snow:   { bounceMult: 0.30, frictionMult: 1.60, skipMult: 0.20, sound: "terrain" },
    }[_terrMat] || { bounceMult: 1.0, frictionMult: 1.0, skipMult: 1.0, sound: "terrain" };
    var _discBounceMod = (discType === "vilov") ? 1.4 : 1.0;

    if (dot < 0) {
      var _impactSpeed = Math.abs(dot);
      if (typeof handleImpact === "function" && _impactSpeed > 1.5) handleImpact(_surf.sound, pos.clone(), vel.clone());
      var _effBounce = d.bounce * _surf.bounceMult * _discBounceMod;
      vel.addScaledVector(n, -dot * (1.0 + _effBounce));
      if (_impactSpeed > 3.0 && _surf.skipMult > 1.0) {
        var _skipBoost = (_impactSpeed - 3.0) * (d.groundSkip || 0.1) * (_surf.skipMult - 1.0) * 0.3;
        vel.x += n.x * _skipBoost; vel.z += n.z * _skipBoost;
      }
      if (typeof spawnParticleBurst === "function" && _impactSpeed > 2.0) {
        var _impCol = { grass:0x5a8a3a, rock:0x888888, sand:0xddbb66, wet:0x4488ff, metal:0xffffff, snow:0xeeeeff }[_terrMat] || 0x888888;
        spawnParticleBurst(pos.clone(), new THREE.Color(_impCol), Math.min(12, Math.floor(_impactSpeed * 1.5)));
      }
      if (bankArr) bankArr[0] *= 0.3;
    }
    var _slide = (1.0 - d.groundSkip * (1.0 / _surf.frictionMult)) * 0.22;
    _slide = Math.max(0, Math.min(0.6, _slide));
    vel.x *= (1.0 - _slide); vel.z *= (1.0 - _slide);
    vel.y *= d.bounce * _surf.bounceMult * _discBounceMod;
    spinArr[0] = spinArr[0] * 0.55 + (Math.random() - 0.5) * 2.5;
    if (Math.abs(vel.y) < 0.35 * _surf.bounceMult) vel.y = 0;
    if (vel.y === 0 && vel.length() > 0.1) { vel.x += -n.x * 4.0 * dt; vel.z += -n.z * 4.0 * dt; }
  }
  if (vel.length() < 0.8) { vel.set(0, 0, 0); spinArr[0] = 0; }
  // Walls: the ground ahead rises above the disc → bounce off the side
  var _nx = pos.x + vel.x * dt, _nz = pos.z + vel.z * dt;
  if (terrainY(_nx, _nz, _h2, holeIdx) > pos.y + 0.12) {
    var _wx = terrainY(_nx, pos.z, _h2, holeIdx) > pos.y + 0.12, _wz = terrainY(pos.x, _nz, _h2, holeIdx) > pos.y + 0.12;
    if (!_wx && !_wz) _wx = _wz = true;
    var _hit = Math.abs(_wx ? vel.x : 0) + Math.abs(_wz ? vel.z : 0);
    if (_wx) vel.x = -vel.x * 0.42;
    if (_wz) vel.z = -vel.z * 0.42;
    vel.y *= 0.7;
    if (bankArr) bankArr[0] *= 0.4;
    if (_hit > 1.5 && typeof handleImpact === "function") handleImpact(_h2.theme === "city" || _h2.arch === "interior" ? "wall" : _h2.arch === "highlands" || _h2.arch === "islands" ? "terrain" : "metal", pos.clone(), vel.clone());
  }
  // Ceilings (interiors)
  var _ceil = _h2.course && _h2.course.ceiling;
  if (_ceil && pos.y + vel.y * dt > _ceil - 0.08 && vel.y > 0) { vel.y = -vel.y * 0.35; vel.x *= 0.85; vel.z *= 0.85; if (typeof handleImpact === "function") handleImpact("wall", pos.clone(), vel.clone()); }
  pos.addScaledVector(vel, dt);
  return vel.length();
}

// ── BASKET INTERACTION ───────────────────────────────────────────────────────
// Returns "score" when the disc is caught by the chains / tray, "hit" on a
// rim / band / pole deflection (velocity is modified), otherwise null.
var basketBase = new THREE.Vector3();
var _basketHitCooldown = 0;
function _catchTolerance(discType) {
  var t = { easy: 0.16, normal: 0.06, hard: 0.0, chaos: 0.0 }[typeof DIFFICULTY !== "undefined" ? DIFFICULTY : "normal"] || 0.05;
  if (discType === "putter") t += 0.06;
  return t;
}
function basketInteract(pos, vel, discType, isLocal) {
  if (typeof BASKET_DIM === "undefined") return null;
  var D = BASKET_DIM, B = basketBase;
  var dx = pos.x - B.x, dz = pos.z - B.z, hd = Math.hypot(dx, dz), y = pos.y - B.y;
  if (hd > 1.6 || y < -0.2 || y > D.height + 0.5) return null;
  var sp = vel.length(), tol = _catchTolerance(discType), DR = 0.24;
  // Chains / tray catch
  if (hd < D.catchR + tol && y > D.trayBotY + 0.02 && y < D.bandY + 0.06 && sp > 0.3) return "score";
  if (hd < D.trayR - 0.05 && y > D.trayBotY - 0.02 && y < D.trayTopY + 0.05 && vel.y <= 0) return "score";
  if (_basketHitCooldown > 0) return null;
  var nx = dx / (hd || 1e-4), nz = dz / (hd || 1e-4), type = null, R = 0, popUp = 0;
  // Clipped the side of the chain curtain: the chains grab it and it drops — onto the rim, into the tray or out
  if (hd < D.bandR + DR && y > D.trayTopY + 0.08 && y < D.bandY - D.bandH * 0.5) {
    vel.x *= 0.25; vel.z *= 0.25; vel.y = Math.min(vel.y, 0) - 0.6;
    _basketHitCooldown = 0.25;
    if (typeof shakeBasket === "function") shakeBasket(1.0);
    if (isLocal && typeof ImpactAudio !== "undefined") ImpactAudio.play("basket", Math.min(1, sp / 10));
    return "hit";
  }
  if (hd < D.bandR + DR && Math.abs(y - D.bandY) < D.bandH * 0.5 + 0.09) { type = "band"; R = D.bandR + DR; popUp = 1.6; }
  else if (hd < D.trayR + DR && Math.abs(y - D.trayTopY) < 0.11) { type = "lip"; R = D.trayR + DR; popUp = 2.2; }
  else if (hd < D.trayR + DR && y >= D.trayBotY - 0.05 && y < D.trayTopY) { type = "tray"; R = D.trayR + DR; popUp = 0.6; }
  else if (hd < D.poleR + DR && y < D.trayBotY) { type = "pole"; R = D.poleR + DR; popUp = 0.4; }
  else if (hd < D.poleR + DR && y > D.bandY && y < D.height + 0.05) { type = "pole"; R = D.poleR + DR; popUp = 0.8; }
  if (!type) return null;
  var vn = vel.x * nx + vel.z * nz;
  if (vn >= 0) return null;
  vel.x -= 1.5 * vn * nx; vel.z -= 1.5 * vn * nz;
  vel.x *= 0.55; vel.z *= 0.55;
  vel.y = Math.max(vel.y * 0.4, popUp);
  pos.x = B.x + nx * (R + 0.02); pos.z = B.z + nz * (R + 0.02);
  _basketHitCooldown = 0.12;
  if (typeof shakeBasket === "function") shakeBasket(type === "pole" ? 0.4 : 0.9);
  if (isLocal) {
    if (typeof ImpactAudio !== "undefined") ImpactAudio.play("metal", Math.min(1, sp / 12));
    if (typeof spawnSparks === "function") spawnSparks(pos.clone(), Math.min(1, sp / 15));
    if (typeof _spawnBonkText === "function") _spawnBonkText(pos.clone(), type === "pole" ? "POLE!" : type === "band" ? "SPIT OUT!" : "RIM!");
    if (typeof _screenShake !== "undefined") { _screenShake = 0.15; _screenShakeT = 0.25; }
  }
  return "hit";
}

// ── STEP ALL PHYSICS ─────────────────────────────────────────────────────────
var _physAccum = 0;
var _FIXED_DT  = 1/120;  // 120 Hz fixed step — stable on any framerate
var timeScale  = 1;      // slow-motion factor (basket approach)
var _groundTime = 0;

function _slowMoTarget() {
  if (mpMode || phase !== "FLYING" || !HOLES[holeIdx]) return 1;
  // Only for the last moment before the disc reaches the basket (close call!)
  var tx = basketBase.x - discPos.x, tz = basketBase.z - discPos.z, hd = Math.hypot(tx, tz);
  if (hd > 5 || hd < 0.15) return 1;
  var hs = Math.hypot(discVel.x, discVel.z); if (hs < 1.5) return 1;
  var along = (tx * discVel.x + tz * discVel.z) / hs;
  if (along < -0.4 || along / hs > 0.45) return 1;
  var miss = Math.abs(tx * discVel.z - tz * discVel.x) / hs;
  var y = discPos.y - basketBase.y;
  if (miss < 1.3 && y > 0.3 && y < 2.6) return 0.3;
  return 1;
}

function stepPhysics(dt) {
  var tgt = _slowMoTarget();
  timeScale += (tgt - timeScale) * Math.min(1, dt * (tgt < timeScale ? 10 : 4));
  _physAccum += Math.min(dt, 0.05) * timeScale;
  while (_physAccum >= _FIXED_DT) {
    _stepPhysicsFixed(_FIXED_DT);
    _physAccum -= _FIXED_DT;
  }
}

var discBank = [0];

function _stepPhysicsFixed(dt) {
  if (!HOLES[holeIdx]) return;
  if (_basketHitCooldown > 0) _basketHitCooldown -= dt;
  if (discMesh) {
    if (discMesh.userData.rainbow) {
      var _rc = new THREE.Color().setHSL((T * 0.5) % 1, 1, 0.55);
      discMesh.traverse(function(c) { if (c.isMesh && c.material && c.material.color) c.material.color.copy(_rc); });
    }
    if (phase === "FLYING" && discMesh.userData.particles && typeof spawnSkinParticle === "function") {
      spawnSkinParticle(discMesh.userData.particles, discPos.clone());
    }
  }

  if (phase === "FLYING") {
    if (flightTimer === 0 && mpMode && typeof sendToAll === "function") {
      sendToAll({ t: "throw_skin", disc: selectedDisc, skin: (equippedSkins&&equippedSkins[selectedDisc])||"classic" });
    }
    flightTimer += dt;
    const moonBonus = HOLES[holeIdx]?.theme === "moon" && selectedDisc !== "distdriver" ? 5 : 0;
    if (flightTimer > 30 + moonBonus) { outOfBounds(true); return; }

    const spinArr = [discSpin], sp = stepDisc(discPos, discVel, spinArr, selectedDisc, dt, discBank);
    discSpin = spinArr[0];
    const hs = Math.hypot(discVel.x, discVel.z);
    var spinner = discMesh.userData.spinner || discMesh;
    spinner.rotation.y += discSpin * dt;
    if (hs > 0.5) discMesh.rotation.y = Math.atan2(discVel.x, discVel.z);
    discMesh.rotation.x = -Math.atan2(discVel.y, hs + 0.001) * 0.45;
    discMesh.rotation.z = discBank[0] * 0.9;
    discMesh.position.copy(discPos);
    discMesh.visible = true;
    discMesh.frustumCulled = false;

    if (typeof BT !== "undefined") BT.discSweep(discPos, discVel, typeof PU !== "undefined" && PU.fireThrow);
    var bi = basketInteract(discPos, discVel, selectedDisc, true);
    if (bi === "score") { if (typeof shakeBasket === "function") shakeBasket(1.2); scored(); return; }

    const h      = HOLES[holeIdx];
    const waterY = h.water !== undefined ? h.water : -1.5;
    const _speed = discVel.length();
    const gnd    = terrainY(discPos.x, discPos.z, h, holeIdx);
    if (_speed > 8) {
      for (var _si = 1; _si <= 3; _si++) {
        var _f = _si / 3;
        var _sx = discPos.x - discVel.x * dt * (1 - _f);
        var _sz = discPos.z - discVel.z * dt * (1 - _f);
        var _sy = discPos.y - discVel.y * dt * (1 - _f);
        var _sg = terrainY(_sx, _sz, h, holeIdx);
        if (_sy < _sg + 0.06 && _sg > waterY + 0.5 && _sg < _sy + 0.35) { discPos.set(_sx, _sg + 0.06, _sz); if (discVel.y < 0) discVel.y *= -(DISCS[selectedDisc] || DISCS.driver).bounce; break; }
      }
    }

    const isHazard = gnd < waterY + 0.5 && discPos.y <= waterY + 0.4;
    const isFallenThrough = discPos.y < waterY - 1.0;
    if (isHazard || isFallenThrough) {
      if (typeof handleImpact === "function") handleImpact("water", discPos.clone(), discVel.clone());
      outOfBounds(false);
      return;
    }

    // Touching the landscape beyond the course → out of bounds
    var _hc = h.course;
    if (_hc && _hc.outer && discPos.y <= gnd + 0.08 && !_hc.inPlay(discPos.x, discPos.z)) { outOfBounds(false); return; }

    // On the ground: let it skid/roll a little, then call it landed
    if (discPos.y <= gnd + 0.08) {
      _groundTime += dt;
      var hv = Math.hypot(discVel.x, discVel.z);
      if ((hv < 1.2 && Math.abs(discVel.y) < 1.0) || _groundTime > 1.6) {
        var _norm = getTerrainNormal(discPos.x, discPos.z, h, holeIdx);
        discPos.y = gnd + 0.06;
        discMesh.position.copy(discPos);
        discMesh.rotation.z = Math.asin(Math.max(-0.8, Math.min(0.8, _norm.x))) * 0.5;
        discMesh.rotation.x = Math.asin(Math.max(-0.8, Math.min(0.8, -_norm.z))) * 0.5;
        if (selectedDisc === "vilov") { spawnExplosion(discPos.clone()); vilovExplosionPush(); }
        else if (typeof handleImpact === "function" && discVel.length() > 0.5) handleImpact("terrain", discPos.clone(), discVel.clone());
        discVel.set(0, 0, 0);
        _groundTime = 0;
        landed();
      }
    } else if (_groundTime > 0 && discPos.y > gnd + 0.4) {
      _groundTime = 0;
    }
  }

  if (mpMode) {
    remotePlayers.forEach(function(rp, i) {
      if (!rp) return;
      if (rp.flying && rp.discMesh) {
        var _ra = [rp.spin];
        if (!rp.bankArr) rp.bankArr = [0];
        stepDisc(rp.discPos, rp.discVel, _ra, rp.discType||"midrange", dt, rp.bankArr);
        if (basketInteract(rp.discPos, rp.discVel, rp.discType || "midrange", false) === "score") {
          rp.flying = false; rp.discVel.set(0, 0, 0);
          rp.discPos.set(basketBase.x, basketBase.y + BASKET_DIM.trayBotY + 0.12, basketBase.z);
          if (typeof shakeBasket === "function") shakeBasket(1.0);
        }
        rp.spin = _ra[0];
        (rp.discMesh.userData.spinner || rp.discMesh).rotation.y += rp.spin * dt;
        rp.discMesh.scale.setScalar(DISC_SCALE_FLIGHT);
        rp.discMesh.position.copy(rp.discPos);
        var _rh = HOLES[holeIdx], _rg = terrainY(rp.discPos.x, rp.discPos.z, _rh, holeIdx);
        if (rp.discPos.y <= _rg+0.12 || (rp.discPos.y <= _rh.water && _rg < _rh.water)) {
          rp.flying = false; rp.discPos.y = _rg + 0.06;
        }
      }
      if (rp.discMesh) {
        var _restD = rp.body ? Math.hypot(rp.discPos.x - rp.body.x, rp.discPos.z - rp.body.z) : 0;
        rp.discMesh.visible = !!rp.flying || _restD > 1.5;
        if (!rp.flying && rp.discMesh.visible) { rp.discMesh.position.copy(rp.discPos); rp.discMesh.scale.setScalar(DISC_SCALE_FLIGHT); }
      }
      if (rp.avatarMesh) {
        if (HOLES[holeIdx]) {
          // The remote player's body walks independently of their disc
          if (!rp.body) rp.body = new THREE.Vector3(rp.targetX || rp.discPos.x, rp.targetY !== undefined ? rp.targetY : rp.discPos.y, rp.targetZ || rp.discPos.z);
          if (rp.targetX !== undefined) {
            var _k = Math.min(1, 12 * dt);
            rp.body.x += (rp.targetX - rp.body.x) * _k; rp.body.z += (rp.targetZ - rp.body.z) * _k;
            if (rp.targetY !== undefined) rp.body.y += (rp.targetY - rp.body.y) * _k;
            else rp.body.y = terrainY(rp.body.x, rp.body.z, HOLES[holeIdx], holeIdx);
          }
          var _rfl = (typeof _playerFeetLift === "function") ? _playerFeetLift(i) : 0;
          rp.avatarMesh.position.set(rp.body.x, rp.body.y + _rfl, rp.body.z);
        }
        // Smooth yaw slerp
        // targetYaw already has +PI baked in from sender (fixed in game.js)
        if (rp.targetYaw !== undefined) {
          if (rp._yaw === undefined) rp._yaw = rp.targetYaw;
          var _rdy = rp.targetYaw - rp._yaw;
          while(_rdy >  Math.PI) _rdy -= Math.PI*2;
          while(_rdy < -Math.PI) _rdy += Math.PI*2;
          rp._yaw += _rdy * Math.min(1, 10*dt);
          rp.avatarMesh.rotation.y = rp._yaw;
        } else if (typeof rp.aimAngle === "number") {
          rp.avatarMesh.rotation.y = rp.aimAngle + Math.PI;
        }
        rp.avatarMesh.visible = true;
        if (!rp.avatarMesh.userData.glbLoaded && rp.avatarMesh.children[7])
          rp.avatarMesh.children[7].rotation.z = rp.flying ? -1.2 : -0.55;
        // ── Punch stagger: wobble + slide ────────────────────────────
        // ── Walk animation handled in game.js render loop (not here) ─────────
        if (rp.punchImmunity > 0) rp.punchImmunity -= dt;
        if (rp.punchStagger > 0) {
          var _prevSt = rp.punchStagger;
          rp.punchStagger -= dt;
          if (_prevSt >= 1.0 && rp.punchStagger < 1.0 && typeof switchAvatarAnim === "function") {
            switchAvatarAnim(rp.avatarMesh, "jump");
          }
          var _stFrac = Math.max(0, rp.punchStagger) / 1.1;
          var _wAmp = _stFrac * 0.9;
          rp.avatarMesh.rotation.z = Math.sin(rp.punchStagger * 26) * _wAmp;
          rp.avatarMesh.rotation.x = Math.sin(rp.punchStagger * 18) * _wAmp * 0.5;
        } else {
          rp.avatarMesh.rotation.z *= (1.0 - Math.min(1, 10 * dt));
          rp.avatarMesh.rotation.x *= (1.0 - Math.min(1, 10 * dt));
          // Walk/idle transitions are handled by the game.js animation state machine
          // (driven by rp.velMag). Do NOT override the animation here — doing so would
          // cancel the walk clip every frame since rotation.z is 0 in normal gameplay.
        }
      }
    });
  }
}

// ── CAMERA ───────────────────────────────────────────────────────────────────
// Where the camera sits while aiming (third person: behind the shoulder;
// first person: at eye height). Shared by the intro so it can land exactly here.
function _aimCamPose(tp, tl) {
  var h = HOLES[holeIdx];
  var gnd = terrainY(discPos.x, discPos.z, h, holeIdx);
  var py = Math.max(discPos.y, gnd + 0.3);
  if (typeof cameraMode !== "undefined" && cameraMode === "fp") {
    var fy = (typeof fpPitch !== "undefined") ? fpPitch : -0.08;
    tp.set(discPos.x, py + 1.7, discPos.z);
    tl.set(tp.x + Math.sin(aimAngle) * Math.cos(fy) * 20, tp.y + Math.sin(fy) * 20, tp.z - Math.cos(aimAngle) * Math.cos(fy) * 20);
    return;
  }
  var cDir = new THREE.Vector3(Math.sin(aimAngle), 0, -Math.cos(aimAngle));
  var blen = Math.hypot(h.bx - discPos.x, h.bz - discPos.z);
  var camDist = Math.min(13, blen * 0.4 + 6.5) * (1 + throwPower * 0.12);
  var camGnd = terrainY(discPos.x - cDir.x * camDist, discPos.z - cDir.z * camDist, h, holeIdx);
  var lift = (4.6 + camDist * 0.18) * (1 + (typeof PL !== "undefined" ? PL.aimPitch : 0));   // right-drag raises / lowers the aiming view
  var camY = Math.max(py + Math.max(1.6, lift), camGnd + 3);
  var C = h.course;
  if (C && C.ceiling) camY = Math.min(camY, py + 2.6);      // low ceilings: stay close over the shoulder
  tp.set(discPos.x - cDir.x * camDist, camY, discPos.z - cDir.z * camDist);
  // Shoulder offset so the player doesn't block the line
  tp.x += Math.cos(aimAngle) * -0.9; tp.z += Math.sin(aimAngle) * -0.9;
  tl.set(discPos.x + cDir.x * 9, py + 1.2, discPos.z + cDir.z * 9);
  _camCollide(C, new THREE.Vector3(discPos.x, py + 1.6, discPos.z), tp);
}
// Pull the camera in front of any wall / ceiling between it and what it's looking at
function _camCollide(C, origin, tp) {
  if (!C || typeof PL === "undefined") return;
  var dx = tp.x - origin.x, dy = tp.y - origin.y, dz = tp.z - origin.z, L = Math.hypot(dx, dy, dz);
  if (L < 0.01) return;
  var free = PL.camRay(C, origin, dx / L, dy / L, dz / L, L);
  if (free < L) tp.set(origin.x + dx / L * free, origin.y + dy / L * free, origin.z + dz / L * free);
  if (C.ceiling) tp.y = Math.min(tp.y, C.ceiling - 0.35);
}
var _camPos  = new THREE.Vector3(0, 11, 20);
var _camLook = new THREE.Vector3(0, 0, -30);
var freeRoamAngle = 0;   // spectate free-roam orbit angle
var freeCamYaw2   = 0;    // spectate free-cam yaw (overrides game.js if defined)
var freeCamPitch2 = -0.25;

function setSpectating(on, targetIdx = -1) {
  spectatingOpp     = on && mpMode;
  spectateTargetIdx = spectatingOpp ? targetIdx : -1;
  const banner = document.getElementById("spectate-banner");
  if (banner) banner.style.display = spectatingOpp ? "block" : "none";
  if (spectatingOpp) {
    // Place free-cam above tee island looking toward basket
    if (HOLES[holeIdx]) {
      var h3 = HOLES[holeIdx];
      var _midX = h3.bx * 0.3, _midZ = h3.bz * 0.3;
      var _overH = (h3.water||-1.5) + 14;
      _camPos.set(_midX, _overH, _midZ + 18);  // offset back so course is visible
      freeCamYaw2   = Math.atan2(_midX - _camPos.x, _midZ - (_camPos.z + 5));
      freeCamPitch2 = -0.3;
      // Also sync game.js vars if they exist
      if (typeof freeCamYaw   !== "undefined") freeCamYaw   = freeCamYaw2;
      if (typeof freeCamPitch !== "undefined") freeCamPitch = freeCamPitch2;
    }
    var instr = document.getElementById("instr");
    if (instr) { instr.innerHTML = "Free camera · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly · drag to look · <kbd>Q</kbd><kbd>E</kbd> up/down"; instr.classList.remove("fade"); }
  }
}

function updateCamera(dt) {
  dt = dt || 0.016;  // fallback: 60fps frame time
  const h = HOLES[holeIdx];
  if (!h) return;
  let tp = new THREE.Vector3(), tl = new THREE.Vector3(), spd = 0.03;

  if (spectatingOpp && mpMode) {
    // ── TRUE FREE-ROAM SPECTATE CAMERA ───────────────────────────────
    // WASD / Arrow keys = fly.  Mouse drag (handled in game.js) = look.
    // freeCamYaw / freeCamPitch are set in game.js via mousemove handler.
    var scYaw   = (typeof freeCamYaw   !== "undefined") ? freeCamYaw   : freeCamYaw2;
    var scPitch = (typeof freeCamPitch !== "undefined") ? freeCamPitch : freeCamPitch2;
    var scSpd   = 20 * dt;

    // Direction vectors from yaw+pitch
    var scFwdH  = new THREE.Vector3(Math.sin(scYaw), 0, -Math.cos(scYaw)); // horizontal forward
    var scRight = new THREE.Vector3(Math.cos(scYaw), 0,  Math.sin(scYaw));

    if (keys["w"]||keys["W"]||keys["ArrowUp"])    _camPos.addScaledVector(scFwdH,  scSpd);
    if (keys["s"]||keys["S"]||keys["ArrowDown"])  _camPos.addScaledVector(scFwdH, -scSpd);
    if (keys["a"]||keys["A"]||keys["ArrowLeft"])  _camPos.addScaledVector(scRight,-scSpd);
    if (keys["d"]||keys["D"]||keys["ArrowRight"]) _camPos.addScaledVector(scRight, scSpd);
    if (keys["q"]||keys["Q"]||keys[" "])          _camPos.y += scSpd;
    if (keys["e"]||keys["E"]||keys["Shift"])      _camPos.y -= scSpd;

    // Keep above water
    var _wYsc = HOLES[holeIdx] ? (HOLES[holeIdx].water||-1.5) : -1.5;
    _camPos.y = Math.max(_wYsc + 1.5, _camPos.y);

    // Look direction
    var scLook = new THREE.Vector3(
      Math.sin(scYaw)*Math.cos(scPitch),
      Math.sin(scPitch),
      -Math.cos(scYaw)*Math.cos(scPitch)
    );
    camera.position.copy(_camPos);
    camera.lookAt(_camPos.clone().add(scLook));
    return;
  }

  var mode = (typeof cameraMode !== "undefined") ? cameraMode : "fp";

  // ── HOLE INTRO FLYOVER ────────────────────────────────────────────
  // Sweeps from the basket back along the route, then glides into the exact
  // aiming-camera pose so the hand-over to gameplay is seamless.
  if (typeof introT !== "undefined" && introT > 0 && introCurve) {
    // Pull-back dolly: starts on the tee side of the basket looking at it, then
    // retreats along the route (rising) while still facing down the course.
    var k = 1 - introT / INTRO_LEN;
    var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    var u = 0.08 + e * 0.92;
    var cp = introCurve.getPointAt(Math.min(0.999, u));
    var la = introCurve.getPointAt(Math.max(0, u - 0.3));
    var pathPos = new THREE.Vector3(cp.x, cp.y + 6 + 12 * Math.sin(Math.PI * Math.min(1, e * 1.15)), cp.z);
    var pathLook = new THREE.Vector3(la.x, la.y + 1.2, la.z);
    if (e < 0.3) pathLook.lerp(basketWP, 1 - e / 0.3);
    _aimCamPose(tp, tl);
    var b = Math.max(0, Math.min(1, (k - 0.55) / 0.45));
    b = b * b * (3 - 2 * b);   // smoothstep
    var _IC = h.course;
    if (_IC && _IC.ceilMesh) { pathPos.y = Math.max(pathPos.y, _IC.ceiling + 14); }   // interiors: blueprint view from above
    _camPos.copy(pathPos).lerp(tp, b);
    _camLook.copy(pathLook).lerp(tl, b);
    if (_IC && _IC.ceilMesh) _IC.ceilMesh.visible = _camPos.y < _IC.ceiling;
    camera.position.copy(_camPos); camera.lookAt(_camLook);
    return;
  }
  // Frame-rate independent smoothing: s is the per-frame factor at 60 fps
  function fr(s) { return 1 - Math.pow(1 - Math.min(0.999, s), dt * 60); }

  // ── THIRD PERSON (classic) ────────────────────────────────────────
  if (h.course && h.course.ceilMesh) h.course.ceilMesh.visible = true;
  if (mode === "tp") {
    if (phase === "AIMING") {
      _aimCamPose(tp, tl);
      spd = 0.09;
    } else if (phase === "WALKING" && typeof VEH !== "undefined" && VEH.mySeat) {
      VEH.cameraPose(tp, tl);
      spd = 0.14;
    } else if (phase === "WALKING") {
      PL.cameraPose(tp, tl);
      spd = 0.16;
    } else if (phase === "LANDED") {
      // Hold the flight camera and settle on the disc
      tp.copy(_camPos); tl.copy(discPos); spd = 0.06;
    } else if (phase === "FLYING") {
      if (timeScale < 0.75) {
        // Slow-mo basket cam: side-on view of the approach
        var vx = discVel.x, vz = discVel.z, vl = Math.hypot(vx, vz) || 1;
        var sx = -vz / vl, sz = vx / vl;
        tp.set(basketWP.x + sx * 4.2 - vx / vl * 1.5, basketWP.y + 0.9, basketWP.z + sz * 4.2 - vz / vl * 1.5);
        tl.copy(discPos).lerp(basketWP, 0.5);
        spd = 0.12;
      } else if (discVel.length() > 0.5) {
        const fd = discVel.clone(); fd.y *= 0.3; fd.normalize();
        var back = 7 + Math.min(5, discVel.length() * 0.18);
        tp.set(discPos.x - fd.x * back, discPos.y + 2.6, discPos.z - fd.z * back);
        var g2 = terrainY(tp.x, tp.z, h, holeIdx);
        if (tp.y < g2 + 1.5) tp.y = g2 + 1.5;
        tl.copy(discPos).addScaledVector(fd, 4);
        _camCollide(h.course, discPos, tp);
      } else { tp.copy(_camPos); tl.copy(_camLook); }
      spd = timeScale < 0.75 ? 0.12 : 0.08;
    } else if (phase === "SCORED") {
      // Slow orbit around the basket
      var oa = T * 0.35;
      tp.set(basketWP.x + Math.sin(oa) * 5.5, basketWP.y + 2.2, basketWP.z + Math.cos(oa) * 5.5);
      tl.copy(basketWP); spd = 0.05;
      _camCollide(h.course, basketWP, tp);
    } else { tp.copy(_camPos); tl.copy(_camLook); }
    _camPos.lerp(tp, fr(spd)); _camLook.lerp(tl, fr(spd + 0.03));
    if (_camPos.distanceTo(tp) > 60) { _camPos.copy(tp); _camLook.copy(tl); }
    camera.position.copy(_camPos); camera.lookAt(_camLook);
    if (typeof _screenShake !== "undefined" && _screenShake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * _screenShake;
      camera.position.y += (Math.random() - 0.5) * _screenShake;
    }
    return;
  }

  // ── FIRST PERSON ─────────────────────────────────────────────────
  // FP yaw = aimAngle (controlled by mouse/touch drag or arrow keys in ui.js)
  // FP pitch = fpPitch (controlled separately, clamped ±70°)
  var fpY   = (typeof fpPitch !== "undefined") ? fpPitch : -0.08;
  var EYE_H = 1.7;  // eye height above disc surface

  if (phase === "AIMING" || phase === "LANDED") {
    // Eye position: disc surface + eye height
    var eyePos = new THREE.Vector3(discPos.x, discPos.y + EYE_H, discPos.z);
    // Look direction from aimAngle + pitch
    var lookDir = new THREE.Vector3(
      Math.sin(aimAngle) * Math.cos(fpY),
      Math.sin(fpY),
      -Math.cos(aimAngle) * Math.cos(fpY)
    );
    // Smooth camera transition to eye position
    _camPos.lerp(eyePos, fr(0.18));
    if (_camPos.distanceTo(eyePos) > 30) _camPos.copy(eyePos);
    _camLook.lerp(eyePos.clone().add(lookDir.multiplyScalar(20)), fr(0.18));
    camera.position.copy(_camPos);
    camera.lookAt(_camLook);

    // In FP aiming: hide the 3D disc (fpHandMesh handles it)
    if (discMesh) discMesh.visible = false;
    if (discMesh) discMesh.scale.setScalar(DISC_SCALE_FLIGHT);
    if (typeof fpHandMesh !== "undefined" && fpHandMesh) {
      fpHandMesh.visible = true;
      // Position hand in lower-right of view
      var right = new THREE.Vector3(Math.cos(aimAngle), 0, Math.sin(aimAngle));
      var fwd2  = new THREE.Vector3(Math.sin(aimAngle)*Math.cos(fpY), Math.sin(fpY), -Math.cos(aimAngle)*Math.cos(fpY));
      fpHandMesh.position.copy(eyePos)
        .addScaledVector(fwd2, 0.6)
        .addScaledVector(right, 0.22)
        .addScaledVector(new THREE.Vector3(0,1,0), -0.28);
      fpHandMesh.rotation.y = aimAngle + Math.PI * 0.05;
    }

  } else if (phase === "FLYING") {
    // Cinematic follow: camera tracks disc from slightly behind and above
    if (discMesh) discMesh.visible = true;
    if (typeof fpHandMesh !== "undefined" && fpHandMesh) fpHandMesh.visible = false;
    if (discVel.length() > 0.5) {
      var fd2  = discVel.clone().normalize();
      var trailDist = Math.min(10, discVel.length() * 0.4 + 4);
      tp.set(discPos.x - fd2.x * trailDist, discPos.y + 2.5 + trailDist * 0.15, discPos.z - fd2.z * trailDist);
      tl.copy(discPos).addScaledVector(fd2, 3);
      spd = 0.10;
    } else { tp.copy(_camPos); tl.copy(_camLook); spd = 0.05; }
    _camPos.lerp(tp, fr(spd)); _camLook.lerp(tl, fr(spd + 0.02));
    camera.position.copy(_camPos); camera.lookAt(_camLook);

  } else if (phase === "SCORED") {
    if (discMesh) discMesh.visible = true;
    if (typeof fpHandMesh !== "undefined" && fpHandMesh) fpHandMesh.visible = false;
    tp.set(basketWP.x + 4, basketWP.y + 3, basketWP.z + 8);
    tl.copy(basketWP); spd = 0.04;
    _camPos.lerp(tp, fr(spd)); _camLook.lerp(tl, fr(spd + 0.01));
    camera.position.copy(_camPos); camera.lookAt(_camLook);

  } else if (phase === "WALKING") {
    // First-person walking: eyes at head height, look where the camera yaw points
    if (typeof fpHandMesh !== "undefined" && fpHandMesh) fpHandMesh.visible = false;
    if (localAvatarMesh) localAvatarMesh.visible = false;
    var wEye = new THREE.Vector3(PL.pos.x, PL.pos.y + 1.6, PL.pos.z);
    var wDir = new THREE.Vector3(Math.sin(PL.camYaw) * Math.cos(fpY), Math.sin(fpY), -Math.cos(PL.camYaw) * Math.cos(fpY));
    _camPos.lerp(wEye, fr(0.5)); if (_camPos.distanceTo(wEye) > 6) _camPos.copy(wEye);
    camera.position.copy(_camPos); camera.lookAt(_camPos.clone().add(wDir));
  } else {
    // LANDED — return to eye position; disc hidden, FP hand shown when phase transitions
    if (discMesh) discMesh.visible = false;
    if (fpHandMesh) fpHandMesh.visible = true;
    var eyePos2 = new THREE.Vector3(discPos.x, discPos.y + EYE_H, discPos.z);
    _camPos.lerp(eyePos2, fr(0.06));
    camera.position.copy(_camPos);
    camera.lookAt(_camPos.clone().add(new THREE.Vector3(Math.sin(aimAngle),Math.sin(fpY),-Math.cos(aimAngle))));
  }

  // Camera floor clamp — never go below terrain
  if (h) {
    var camGnd2 = terrainY(_camPos.x, _camPos.z, h, holeIdx);
    if (_camPos.y < camGnd2 + 0.5) _camPos.y = camGnd2 + 0.5;
  }
}