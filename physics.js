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
  if (!actionKey) return; // clip not in this model

  var current = target.userData.activeClipName || null;
  if (current === actionKey) return; // already playing

  var fromAction = current ? actions[current] : null;
  var toAction   = actions[actionKey];
  toAction.reset().setLoop(THREE.LoopRepeat, Infinity).play().fadeIn(0.18);
  if (fromAction) fromAction.fadeOut(0.18);
  target.userData.activeClipName = actionKey;
}

// Username label above player (DOM overlay — fast, no texture baking needed)
function createNameLabel(name, color) {
  var el  = document.createElement("div");
  el.className = "mp-name-tag";
  el.textContent = name;
  el.style.cssText = "position:fixed;pointer-events:none;font-family:'Bebas Neue',cursive;"
    + "font-size:13px;letter-spacing:1px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.9),"
    + "0 0 8px " + (color ? "#" + color.toString(16).padStart(6,"0") : "#fff") + ";"
    + "transform:translateX(-50%);z-index:25;display:none";
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

function buildDiscMat(color, opacity, metal, glow) {
  var col = color || 0xffffff;
  if (metal) {
    return new THREE.MeshStandardMaterial({
      color: col, roughness: 0.08, metalness: 0.95,
      transparent: opacity < 1, opacity: opacity
    });
  }
  if (glow) {
    var m = new THREE.MeshStandardMaterial({
      color: col, roughness: 0.15, metalness: 0.1,
      emissive: new THREE.Color(glow), emissiveIntensity: 0.5,
      transparent: opacity < 1, opacity: opacity
    });
    return m;
  }
  return new THREE.MeshStandardMaterial({
    color: col, roughness: 0.15, metalness: 0.4,
    transparent: opacity < 1, opacity: opacity
  });
}

function buildDisc(type, opacity = 1) {
  const d = DISCS[type] || DISCS.driver;
  const g = new THREE.Group();

  // Check for GLB override for this disc type (e.g. "disc_driver")
  var _overrideKey = "disc_" + type;
  if (typeof loadModel === "function" && MODEL_OVERRIDES && MODEL_OVERRIDES[_overrideKey]) {
    // Build procedural disc first (returned immediately), then async-swap
    loadModel(_overrideKey, function(glbGroup) {
      if (!glbGroup) return;
      // Remove procedural mesh children, add GLB
      while (g.children.length) g.remove(g.children[0]);
      g.add(glbGroup);
      glbGroup.traverse(function(c) {
        if (c.isMesh) { c.frustumCulled = false; c.renderOrder = 1; }
      });
      g.userData.glbLoaded = true;  // disc GLB loaded — use scale 1.0 in hand
    });
  }

  var skin = (typeof getSkin === "function") ? getSkin(type, d.color) : null;
  var skinColor = (skin && skin.color) ? skin.color : d.color;
  var skinGlow  = skin ? skin.glow  : null;
  var isMetal   = skin ? !!skin.metal : false;
  var isGiant   = skin ? !!skin.giant : false;
  if (isGiant && type === "vilov") g.scale.setScalar(2.5);

  // Rainbow skin: animated color (update each frame via userData)
  if (skin && skin.rainbow) {
    skinColor = 0xff0000;
    g.userData.rainbow = true;
  }

  if (type === "vilov") {
    // Hungarian sausage (kolbász) — a proud rotating meat cylinder
    var _vCol = skinColor || 0xaa3311;
    const meatM   = buildDiscMat(_vCol, opacity, isMetal, skinGlow);
    const casingM = new THREE.MeshStandardMaterial({ color: new THREE.Color(_vCol).lerp(new THREE.Color(0xffffff),0.15), roughness: 0.5, metalness: isMetal?0.9:0.1, transparent: opacity < 1, opacity });
    const tipM    = new THREE.MeshStandardMaterial({ color: new THREE.Color(_vCol).lerp(new THREE.Color(0x000000),0.3), roughness: 0.8, transparent: opacity < 1, opacity });
    // Main sausage body — cylinder on its side (X axis = length)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.35, 16), meatM);
    body.rotation.z = Math.PI / 2; body.castShadow = true; g.add(body);
    // Round ends (caps)
    const capL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), tipM);
    capL.position.x = -0.675; g.add(capL);
    const capR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), tipM);
    capR.position.x = 0.675; g.add(capR);
    // Twisted casing wrinkles (small torus rings along the body)
    for (var wi = -2; wi <= 2; wi++) {
      const wrinkle = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.022, 6, 16), casingM);
      wrinkle.rotation.y = Math.PI / 2;
      wrinkle.position.x = wi * 0.25;
      g.add(wrinkle);
    }
    // Tie-off string at each end (classic kolbász detail)
    const strM = new THREE.MeshBasicMaterial({ color: 0xddcc88 });
    [-0.63, 0.63].forEach(x => {
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 5, 10), strM);
      tie.rotation.y = Math.PI / 2; tie.position.x = x; g.add(tie);
    });
    // Small red warning badge (the "explosive" indicator)
    const badgeM = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: opacity * 0.9 });
    const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), badgeM);
    badge.position.set(0, 0.22, 0); g.add(badge);
    return g;  // sausage has no rim ring
  } else {
    var skinShape = skin ? (skin.shape || null) : null;
    const m = buildDiscMat(skinColor, opacity, isMetal, skinGlow);

    if (skinShape === "pizza") {
      // Flat circle with tomato sauce color and "cheese" segments
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.53, 0.09, 8), m);
      base.castShadow = true; g.add(base);
      // Sauce layer
      const sauce = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.02, 8),
        new THREE.MeshStandardMaterial({color:0xcc2200,roughness:0.9}));
      sauce.position.y = 0.055; g.add(sauce);
      // Cheese dots (pepperoni)
      for(var pi=0;pi<5;pi++){
        var pa=pi/5*Math.PI*2;
        var pep=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.015,8),
          new THREE.MeshStandardMaterial({color:0x992211,roughness:0.8}));
        pep.position.set(Math.cos(pa)*0.28,0.065,Math.sin(pa)*0.28); g.add(pep);
      }
    } else if (skinShape === "saw") {
      // Disc with triangular teeth around edge
      const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 32), m);
      base2.castShadow = true; g.add(base2);
      for(var ti=0;ti<12;ti++){
        var ta=ti/12*Math.PI*2;
        var tooth=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.15,3),m);
        tooth.position.set(Math.cos(ta)*0.54,0,Math.sin(ta)*0.54);
        tooth.rotation.y=ta; tooth.rotation.x=Math.PI/2; g.add(tooth);
      }
    } else if (skinShape === "puck") {
      // Thick hockey-puck shape
      const base3 = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.22, 20), m);
      base3.castShadow = true; g.add(base3);
    } else if (skinShape === "coin") {
      // Very thin coin, reeded edge
      const base4 = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.04, 32), m);
      base4.castShadow = true; g.add(base4);
      const rim4 = new THREE.Mesh(new THREE.TorusGeometry(0.55,0.025,4,32),m);
      rim4.rotation.x=Math.PI/2; g.add(rim4);
    } else if (skinShape === "banana") {
      // Curved banana-like elongated shape
      const bCore = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,1.1,10),m);
      bCore.rotation.z=0.35; bCore.castShadow=true; g.add(bCore);
      const bEnd1=new THREE.Mesh(new THREE.SphereGeometry(0.14,8,6),m);
      bEnd1.position.set(-0.5,0.2,0); g.add(bEnd1);
      const bEnd2=new THREE.Mesh(new THREE.SphereGeometry(0.14,8,6),m);
      bEnd2.position.set(0.5,-0.2,0); g.add(bEnd2);
    } else if (skinShape === "ufo") {
      // Flying saucer — flat dome with protruding edge ring
      const saucerBase=new THREE.Mesh(new THREE.CylinderGeometry(0.65,0.5,0.12,20),m);
      saucerBase.castShadow=true; g.add(saucerBase);
      const dome2=new THREE.Mesh(new THREE.SphereGeometry(0.35,14,8,0,Math.PI*2,0,Math.PI/2),m);
      dome2.scale.y=0.55; dome2.position.y=0.1; g.add(dome2);
      // Rotating light ring
      const lights=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.04,4,20),
        new THREE.MeshBasicMaterial({color:skinGlow||0x00ffaa,transparent:true,opacity:0.9}));
      lights.rotation.x=Math.PI/2; lights.position.y=-0.02; g.add(lights);
    } else if (skinShape === "key") {
      // Keyboard keycap
      const kBase=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.22,1.0),m);
      kBase.castShadow=true; g.add(kBase);
      const kTop=new THREE.Mesh(new THREE.BoxGeometry(0.82,0.08,0.82),
        new THREE.MeshStandardMaterial({color:new THREE.Color(skinColor||0xdddddd).lerp(new THREE.Color(0xffffff),0.3),roughness:0.6}));
      kTop.position.y=0.15; g.add(kTop);
    } else {
      // Standard disc shape (default)
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.51, 0.1, 32), m);
      body.castShadow = true; g.add(body);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), m);
      dome.scale.y = 0.28; dome.position.y = 0.05; g.add(dome);
    }

    // Glow point light for emissive/epic skins
    if (skinGlow) {
      var gl = new THREE.PointLight(skinGlow, skin && skin.holo ? 0.4 : 0.8, skin && skin.holo ? 6 : 4);
      g.add(gl);
    }

    // Store particle type for trail spawner
    if (skin && skin.particles) g.userData.particles = skin.particles;
  }
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.04, 6, 32),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, transparent: opacity < 1, opacity })
  );
  rim.rotation.x = Math.PI / 2; rim.position.y = -0.03; g.add(rim);
  return g;
}

// ── TRAJECTORY DOTS ───────────────────────────────────────────────────────────
var trajDots = [];

function initTrajDots() {
  trajDots.forEach((d) => scene.remove(d));
  trajDots = [];
  let dotColor = 0xffffff;
  if (HOLES[holeIdx]) {
    const tc = themeColors[HOLES[holeIdx].theme];
    if (tc) {
      const gc = new THREE.Color(tc.ground1);
      const lum = gc.r * 0.299 + gc.g * 0.587 + gc.b * 0.114;
      if (lum > 0.4) dotColor = 0x111133;
      else if (HOLES[holeIdx].theme === "neon" || HOLES[holeIdx].theme === "geometry_dash") dotColor = 0xffff00;
      else dotColor = 0xffffff;
    }
  }
  const m = new THREE.MeshBasicMaterial({ color: dotColor, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 28; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 4, 4), m);
    d.visible = false; scene.add(d); trajDots.push(d);
  }
}

// ── TRAJECTORY PREVIEW DOTS ─────────────────────────────────────────────────
// Simulates the disc flight using the exact same physics as stepDisc so the
// preview matches the actual throw. Dots stop when they hit terrain.
// Fog/weather reduces visible dot count. Dots are lifted above terrain surface.
// Pre-allocated traj simulation vectors — avoids GC pressure at 60fps
var _trajP = new THREE.Vector3();
var _trajV = new THREE.Vector3();
// Traj update throttle — only update every other frame (30fps is plenty for preview)
var _trajFrame = 0;
var _trajLastStartX = -Infinity;

function updateTrajDots(startPos, startVel) {
  if (!HOLES[holeIdx]) { trajDots.forEach(d => d.visible = false); return; }
  // Throttle: skip every other frame unless aim changed significantly
  _trajFrame++;
  var _aimMoved = Math.abs(startPos.x - _trajLastStartX) > 0.05;
  if (_trajFrame % 2 !== 0 && !_aimMoved) return;
  _trajLastStartX = startPos.x;

  const d       = DISCS[selectedDisc] || DISCS.driver;
  const h       = HOLES[holeIdx];
  const gravG   = h.theme === "moon" ? 9.8 * 0.18 : 9.8;
  const wLift   = getWeatherLiftMult();
  const wDrag   = getWeatherDragMult();
  const wWind   = getWeatherWindMult();
  const maxDots = getWeatherDotCount();
  const dt      = 0.055;
  const turnDir = selectedDisc === "vilov" ? -1 : 1;

  // Reuse pre-allocated vectors instead of clone() — eliminates 2 GC allocs/frame
  _trajP.copy(startPos);
  _trajV.copy(startVel);
  let p = _trajP;
  let v = _trajV;
  let landed = false;

  for (let i = 0; i < trajDots.length; i++) {
    trajDots[i].visible = false;

    if (landed || i >= maxDots) continue;

    // ── Same physics as stepDisc ──
    const spd = v.length();

    // Drag (horizontal only, matching stepDisc)
    const dragF = 1.0 - (1.0 - d.drag * wDrag) * dt;
    v.x *= dragF; v.z *= dragF;

    // Gravity
    v.y -= gravG * dt;

    // Lift
    v.y += Math.min(spd * spd * d.lift * wLift, gravG * 0.95) * dt;

    // Turn / fade
    if (spd > 8) {
      v.x += (d.turn / d.stability) * dt * spd * 0.1 * turnDir;
    } else {
      const fs = d.fade * d.stability * dt * spd * 0.15;
      const px = -v.z, pz = v.x, pl = Math.sqrt(px*px + pz*pz);
      if (pl > 0.001) { v.x -= (px/pl)*fs*turnDir; v.z -= (pz/pl)*fs*turnDir; }
    }

    // Glide extension
    if (spd < 12 && v.y < 0) v.y += d.glide * 0.5 * dt;

    // Wind
    v.x += h.wind.x * wWind * dt;
    v.z += h.wind.z * wWind * dt;

    p.addScaledVector(v, dt);

    // ── Terrain collision — stop dots at ground ──
    const gnd = terrainY(p.x, p.z, h, holeIdx);
    if (p.y <= gnd + 0.15) {
      // Show final dot on terrain surface
      p.y = gnd + 0.18;
      trajDots[i].position.copy(p);
      trajDots[i].visible = true;
      landed = true;
      continue;
    }

    // Lift dot above terrain in case of near-ground flight
    const dotY = Math.max(p.y, gnd + 0.18);
    trajDots[i].position.set(p.x, dotY, p.z);
    trajDots[i].visible = true;
  }
}

// ── CORE PHYSICS STEP ────────────────────────────────────────────────────────
function stepDisc(pos, vel, spinArr, discType, dt) {
  const d   = DISCS[discType] || DISCS.driver;
  const spd = vel.length();

  // ── Disc drag (natural disc drag + weather extra drag) ──────────────
  const wDragAdd  = getWeatherDragAdd();   // extra drag from weather (0–0.12)
  const naturalDrag = 1.0 - (1.0 - d.drag) * dt;  // disc's own air resistance
  const weatherDrag = Math.max(0, 1.0 - wDragAdd * dt * spd * 0.5); // weather slows fast discs more
  vel.x *= naturalDrag * weatherDrag;
  vel.z *= naturalDrag * weatherDrag;

  // ── Gravity + weather gravity modifier ───────────────────────────────
  const wGravAdd = getWeatherGravAdd();    // rain/snow adds weight, thermals subtract
  const gravMult = activePowerups.lowgrav && Date.now() < activePowerups.lowgrav.until ? 0.25 : 1.0;
  const gravG    = HOLES[holeIdx]?.theme === "moon" ? 9.8 * 0.18 : 9.8;
  vel.y -= (gravG + wGravAdd) * gravMult * dt;

  // ── Lift (weather affects lift coefficient) ───────────────────────────
  const wLift     = getWeatherLiftMult();
  const liftForce = Math.min(spd * spd * d.lift * wLift, (gravG + Math.max(0, wGravAdd)) * 0.95);
  vel.y += liftForce * dt;

  const turnDir = discType === "vilov" ? -1 : 1;
  if (spd > 8) {
    vel.x += (d.turn / d.stability) * dt * spd * 0.1 * turnDir;
  } else {
    const fs = d.fade * d.stability * dt * spd * 0.15;
    const px = -vel.z, pz = vel.x, pl = Math.sqrt(px * px + pz * pz);
    if (pl > 0.001) { vel.x -= (px / pl) * fs * turnDir; vel.z -= (pz / pl) * fs * turnDir; }
  }

  if (spd < 12 && vel.y < 0) vel.y += d.glide * 0.5 * dt;

  // ── Wind force (steady wind + random gusts) ──────────────────────────
  const wWind  = getWeatherWindMult();
  const wGust  = getWeatherGustStr();
  const _hWind = HOLES[holeIdx] ? HOLES[holeIdx].wind : {x:0, z:0};
  // Steady wind: hole.wind is in m/s. Apply full force each frame.
  vel.x += _hWind.x * wWind * dt;
  vel.z += _hWind.z * wWind * dt;
  // Gusts: random lateral impulses (stronger in stormy/windy weather)
  if (wGust > 0) {
    vel.x += (Math.random() - 0.5) * wGust * dt;
    vel.z += (Math.random() - 0.5) * wGust * dt;
  }

  const _h2 = HOLES[holeIdx]; if (!_h2) { pos.addScaledVector(vel, dt); return vel.length(); }
  const ty = terrainY(pos.x, pos.z, _h2, holeIdx);
  if (ty > pos.y - 0.06) {
    // Push disc fully above island surface before reflecting
    pos.y = ty + 0.06;
    const n = getTerrainNormal(pos.x, pos.z, _h2, holeIdx);
    if (discType === "vilov" && DISCS.vilov && DISCS.vilov.special === "explode") {
      if (typeof vilovExplosionPush === "function") vilovExplosionPush();
    }
    const dot = vel.dot(n);

    // ── TERRAIN MATERIAL SYSTEM ──────────────────────────────────────────────
    // Map hole theme → surface material affecting bounce/friction/sound
    var _terrMat = (function(theme) {
      if (theme === "winter" || theme === "moon" && false) return "snow";
      if (theme === "moon")    return "rock";
      if (theme === "city" || theme === "office" || theme === "neon" || theme === "geometry_dash") return "metal";
      if (theme === "backrooms" || theme === "poolrooms") return "wet";
      if (theme === "grandcanyon" || theme === "mountains") return "rock";
      if (theme === "public_poo" || theme === "screaming_mamamia") return "sand";
      return "grass";  // default
    })(_h2.theme);

    // Per-surface modifiers:  bounceMult, frictionMult, skipMult, soundType
    var _surf = {
      grass:  { bounceMult: 1.00, frictionMult: 1.00, skipMult: 1.00, sound: "terrain" },
      rock:   { bounceMult: 1.35, frictionMult: 0.75, skipMult: 1.40, sound: "metal"   },
      sand:   { bounceMult: 0.15, frictionMult: 2.20, skipMult: 0.10, sound: "terrain" },
      wet:    { bounceMult: 0.55, frictionMult: 1.80, skipMult: 0.35, sound: "terrain" },
      metal:  { bounceMult: 1.60, frictionMult: 0.55, skipMult: 1.50, sound: "metal"   },
      snow:   { bounceMult: 0.30, frictionMult: 1.60, skipMult: 0.20, sound: "terrain" },
    }[_terrMat] || { bounceMult: 1.0, frictionMult: 1.0, skipMult: 1.0, sound: "terrain" };

    // vilov always gets chaotic bonus bounce
    var _discBounceMod = (discType === "vilov") ? 1.4 : 1.0;

    if (dot < 0) {
      var _impactSpeed = Math.abs(dot);
      // Impact sound
      if (typeof handleImpact === "function" && _impactSpeed > 1.5) {
        handleImpact(_surf.sound, pos.clone(), vel.clone());
      }
      // Bounce reflection: disc bounce * surface bounceMult * disc-specific mod
      var _effBounce = d.bounce * _surf.bounceMult * _discBounceMod;
      vel.addScaledVector(n, -dot * (1.0 + _effBounce));

      // Extra skip energy — fast impacts on hard surfaces skip farther
      if (_impactSpeed > 3.0 && _surf.skipMult > 1.0) {
        var _skipBoost = (_impactSpeed - 3.0) * (d.groundSkip || 0.1) * (_surf.skipMult - 1.0) * 0.3;
        vel.x += n.x * _skipBoost; vel.z += n.z * _skipBoost;
      }

      // Impact particles by surface material
      if (typeof spawnParticleBurst === "function" && _impactSpeed > 2.0) {
        var _impCol = { grass:"0x44cc44", rock:"0x888888", sand:"0xddbb66", wet:"0x4488ff", metal:"0xffffff", snow:"0xeeeeff" }[_terrMat] || "0x888888";
        spawnParticleBurst(pos.clone(), new THREE.Color(parseInt(_impCol)), Math.min(12, Math.floor(_impactSpeed * 1.5)));
      }
    }

    // Friction: disc groundSkip * surface friction
    var _slide = (1.0 - d.groundSkip * (1.0 / _surf.frictionMult)) * 0.22;
    _slide = Math.max(0, Math.min(0.6, _slide));
    vel.x *= (1.0 - _slide); vel.z *= (1.0 - _slide);

    var _effBounceY = d.bounce * _surf.bounceMult * _discBounceMod;
    vel.y *= _effBounceY;
    spinArr[0] = spinArr[0] * 0.55 + (Math.random() - 0.5) * 2.5;

    // Disc settles at lower threshold on soft surfaces, higher on hard
    var _settleThresh = 0.35 * _surf.bounceMult;
    if (Math.abs(vel.y) < _settleThresh) vel.y = 0;

    // Rolling: after settling, disc can roll downhill slowly
    if (vel.y === 0 && vel.length() > 0.1) {
      // Slight downhill pull from terrain normal (gravity component along slope)
      var _slopeX = -n.x * 4.0 * dt;
      var _slopeZ = -n.z * 4.0 * dt;
      vel.x += _slopeX; vel.z += _slopeZ;
    }
  }

  // Stop very slow discs cleanly
  if (vel.length() < 0.8) { vel.set(0, 0, 0); spinArr[0] = 0; }
  pos.addScaledVector(vel, dt);
  return vel.length();
}

// ── STEP ALL PHYSICS ─────────────────────────────────────────────────────────
// Fixed-timestep accumulator for deterministic physics
var _physAccum = 0;
var _FIXED_DT  = 1/120;  // 120 Hz fixed step — stable on any framerate

function stepPhysics(dt) {
  _physAccum += Math.min(dt, 0.05);  // clamp to avoid spiral of death
  while (_physAccum >= _FIXED_DT) {
    _stepPhysicsFixed(_FIXED_DT);
    _physAccum -= _FIXED_DT;
  }
}

function _stepPhysicsFixed(dt) {
  if (!HOLES[holeIdx]) return;
  // Rainbow skin animation + skin particle trails
  if (discMesh) {
    if (discMesh.userData.rainbow) {
      var _rc = new THREE.Color().setHSL((T * 0.5) % 1, 1, 0.55);
      discMesh.traverse(function(c) { if (c.isMesh && c.material && c.material.color) c.material.color.copy(_rc); });
    }
    // Skin particle trails during flight
    if (phase === "FLYING" && discMesh.userData.particles && typeof spawnSkinParticle === "function") {
      // Spawn 2 particles per frame for visible trail (T*60 modulo can skip at var framerate)
      spawnSkinParticle(discMesh.userData.particles, discPos.clone());
      if (discVel && discVel.length() > 3) {
        // Add mid-point particle along velocity for denser trail at high speed
        var _mid = discPos.clone().sub(discVel.clone().multiplyScalar(0.016));
        spawnSkinParticle(discMesh.userData.particles, _mid);
      }
    }
  }

  if (phase === "FLYING") {
    // Broadcast skin on first frame of flight
    if (flightTimer === 0 && mpMode && typeof sendToAll === "function") {
      sendToAll({ t: "throw_skin", disc: selectedDisc, skin: (equippedSkins&&equippedSkins[selectedDisc])||"classic" });
    }
    flightTimer += dt;
    const disc = DISCS[selectedDisc] || DISCS.driver;
    const moonBonus = HOLES[holeIdx]?.theme === "moon" && selectedDisc !== "distdriver" ? 5 : 0;
    const maxTime = 30 + moonBonus;  // 30s always — disc will land naturally in most cases
    if (flightTimer > maxTime) { outOfBounds(true); return; }

    const spinArr = [discSpin], sp = stepDisc(discPos, discVel, spinArr, selectedDisc, dt);
    discSpin = spinArr[0];
    const hs = Math.sqrt(discVel.x ** 2 + discVel.z ** 2);
    discMesh.rotation.z  = -Math.atan2(discVel.y, hs) * 0.48;
    discMesh.rotation.y += discSpin * dt;
    discMesh.position.copy(discPos);
    discMesh.visible = true;          // guarantee disc is always visible in flight
    discMesh.frustumCulled = false;  // prevent camera frustum clipping

    const hd = Math.hypot(discPos.x - basketWP.x, discPos.z - basketWP.z);
    if (hd < 1.15 && Math.abs(discPos.y - basketWP.y) < 1.05 && sp > (hd < 3 ? 0.08 : 0.35)) {
      scored(); return;
    }

    const h      = HOLES[holeIdx];
    const waterY = h.water !== undefined ? h.water : -1.5;

    // ── CCD sweep: detect terrain crossing between prev and current pos ──
    const _speed = discVel.length();
    const gnd    = terrainY(discPos.x, discPos.z, h, holeIdx);
    if (_speed > 8 && phase === "FLYING") {
      // Sample 3 intermediate points along the frame's movement arc
      for (var _si = 1; _si <= 3; _si++) {
        var _f = _si / 3;
        var _sx = discPos.x - discVel.x * dt * (1 - _f);
        var _sz = discPos.z - discVel.z * dt * (1 - _f);
        var _sy = discPos.y - discVel.y * dt * (1 - _f);
        var _sg = terrainY(_sx, _sz, h, holeIdx);
        if (_sy < _sg + 0.06 && _sg > waterY + 0.5) {
          // Disc tunnelled — snap back to surface at that sub-step
          discPos.set(_sx, _sg + 0.06, _sz);
          break;
        }
      }
    }

    // Water/hazard detection:
    // terrainY returns waterY-2.0 for open-water squares.
    // We treat any gnd < waterY+0.5 as a hazard zone (off island).
    const isHazard = gnd < waterY + 0.5 && discPos.y <= waterY + 0.4;
    // Also catch falling through floor
    const isFallenThrough = discPos.y < waterY - 1.0;

    if (isHazard || isFallenThrough) {
      if (typeof handleImpact === "function") {
        handleImpact("water", discPos.clone(), discVel.clone());
      }
      outOfBounds(false);
      return;
    }

    // Normal island surface landing — disc touches top of cylinder
    if (discPos.y <= gnd + 0.06) {
      // Snap to exact surface using terrain normal for slope alignment
      var _norm = getTerrainNormal(discPos.x, discPos.z, h, holeIdx);
      discPos.y = gnd + 0.06;
      discMesh.position.copy(discPos);
      // Tilt disc to match surface slope (realistic lie)
      discMesh.rotation.z = Math.asin(Math.max(-0.8, Math.min(0.8, _norm.x))) * 0.5;
      discMesh.rotation.x = Math.asin(Math.max(-0.8, Math.min(0.8, -_norm.z))) * 0.5;
      // Impact on ALL disc types — vilov explodes, others get thud+dust
      if (selectedDisc === "vilov") {
        spawnExplosion(discPos.clone()); vilovExplosionPush();
      } else if (typeof handleImpact === "function") {
        var _impactSpd = discVel ? discVel.length() : 3;
        if (_impactSpd > 0.5) handleImpact("terrain", discPos.clone(), discVel.clone());
      }
      landed();
    }
  }

  // ── Animate moving islands + carry resting disc ─────────────────────
  if (HOLES[holeIdx] && HOLES[holeIdx].movingIslands) {
    var mis = HOLES[holeIdx].movingIslands;
    var _wY0 = HOLES[holeIdx].water || -1.5;
    for (var mii = 0; mii < mis.length; mii++) {
      var mv = mis[mii];
      var t2 = T * mv.speed + mv.phase;
      var _prevX  = mv.currentX !== undefined ? mv.currentX : mv.baseX;
      var _prevZ  = mv.currentZ !== undefined ? mv.currentZ : mv.baseZ;
      var _prevEl = mv.currentElev !== undefined ? mv.currentElev : (mv.elev || 0);

      switch (mv.type) {
        case "linear":
          if (mv.axis === "x") { mv.currentX = mv.baseX + Math.sin(t2)*mv.amplitude; mv.currentZ = mv.baseZ; }
          else                  { mv.currentX = mv.baseX; mv.currentZ = mv.baseZ + Math.sin(t2)*mv.amplitude; }
          break;
        case "orbit":
          mv.currentX = mv.baseX + Math.cos(t2)*mv.amplitude;
          mv.currentZ = mv.baseZ + Math.sin(t2)*mv.amplitude*0.7;
          break;
        case "bob":
          mv.currentX = mv.baseX; mv.currentZ = mv.baseZ;
          mv.currentElev = (mv.elev||0) + Math.sin(t2)*2.0;
          break;
      }

      var _dX  = mv.currentX - _prevX;
      var _dZ  = mv.currentZ - _prevZ;
      var _dEl = (mv.currentElev !== undefined ? mv.currentElev : mv.elev||0) - _prevEl;

      var wpRef = HOLES[holeIdx].waypoints[mv.waypointIdx];
      if (wpRef) { wpRef.x = mv.currentX; wpRef.z = mv.currentZ; if (mv.currentElev !== undefined) wpRef.elev = mv.currentElev; }

      var _baseElev = (mv.elev || 0);
      var _curElev = (mv.currentElev !== undefined) ? mv.currentElev : _baseElev;
      var _rootY = _curElev - _baseElev;
      if (mv.entity && mv.entity.root) {
        // PlatformRoot is the only moving transform; all platform children inherit.
        mv.entity.root.position.set(mv.currentX, _rootY, mv.currentZ);
      } else if (mv.mesh) {
        mv.mesh.position.set(mv.currentX, _rootY, mv.currentZ);
      }

      // Carry disc/player while supported by this platform.
      if ((phase === "LANDED" || phase === "AIMING") && (_dX || _dZ || _dEl)) {
        var _isSupported = (typeof discSupportPlatform !== "undefined" && discSupportPlatform === mv);
        var _dist2mv = Math.hypot(discPos.x - _prevX, discPos.z - _prevZ);
        if (_isSupported || _dist2mv < (mv.walkR || mv.r || 6) + 0.8) {
          discPos.x += _dX; discPos.z += _dZ; discPos.y += _dEl;
          if (discMesh) discMesh.position.copy(discPos);
          if (typeof localAvatarMesh !== "undefined" && localAvatarMesh) {
            localAvatarMesh.position.x += _dX;
            localAvatarMesh.position.z += _dZ;
          }
        }
      }
    }
  }

  if (mpMode) {
    remotePlayers.forEach(function(rp, i) {
      if (!rp) return;
      if (rp.flying && rp.discMesh) {
        var _ra = [rp.spin];
        stepDisc(rp.discPos, rp.discVel, _ra, rp.discType||"midrange", dt);
        rp.spin = _ra[0];
        rp.discMesh.rotation.y += rp.spin * dt;
        rp.discMesh.position.copy(rp.discPos);
        var _rh = HOLES[holeIdx], _rg = terrainY(rp.discPos.x, rp.discPos.z, _rh, holeIdx);
        if (rp.discPos.y <= _rg+0.12 || (rp.discPos.y <= _rh.water && _rg < _rh.water)) {
          rp.flying = false; rp.discPos.y = _rg + 0.06;
        }
      }
      if (rp.discMesh) rp.discMesh.visible = !!rp.flying;
      if (rp.avatarMesh) {
        if (!rp.flying && HOLES[holeIdx]) {
          // ── PUNCH KNOCKBACK SLIDE (remote player body) ─────────────────
          if (rp.punchKnockVelX || rp.punchKnockVelZ) {
            var _kFric = Math.pow(0.06, dt);
            rp.discPos.x += (rp.punchKnockVelX || 0);
            rp.discPos.z += (rp.punchKnockVelZ || 0);
            rp.punchKnockVelX = (rp.punchKnockVelX || 0) * _kFric;
            rp.punchKnockVelZ = (rp.punchKnockVelZ || 0) * _kFric;
            if (Math.abs(rp.punchKnockVelX) < 0.001) rp.punchKnockVelX = 0;
            if (Math.abs(rp.punchKnockVelZ) < 0.001) rp.punchKnockVelZ = 0;
          }
          // Lerp toward network position (only when not being knocked back)
          if (rp.targetX !== undefined && !rp.punchKnockVelX && !rp.punchKnockVelZ) {
            rp.discPos.x += (rp.targetX - rp.discPos.x) * Math.min(1, 12*dt);
            rp.discPos.z += (rp.targetZ - rp.discPos.z) * Math.min(1, 12*dt);
          }
          var _rag = terrainY(rp.discPos.x, rp.discPos.z, HOLES[holeIdx], holeIdx);
          var _rfl = (typeof _playerFeetLift === "function") ? _playerFeetLift(i) : 0;
          rp.avatarMesh.position.set(rp.discPos.x, _rag + _rfl, rp.discPos.z);
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
    if (instr) instr.innerHTML = "&#128065; <b>FREE CAM</b> — WASD/Arrows: fly &nbsp;|&nbsp; Left-click drag: look &nbsp;|&nbsp; Q/E: up/down";
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

  // ── THIRD PERSON (classic) ────────────────────────────────────────
  if (mode === "tp") {
    if (phase === "AIMING" || phase === "LANDED") {
      const cDir  = new THREE.Vector3(Math.sin(aimAngle), 0, -Math.cos(aimAngle));
      const blen  = Math.hypot(h.bx - discPos.x, h.bz - discPos.z);
      var camDist = Math.min(15, blen * 0.5 + 7);
      var camGnd  = terrainY(discPos.x - cDir.x * camDist, discPos.z + cDir.z * camDist, h, holeIdx);
      var camY    = Math.max(discPos.y + 8, camGnd + 4);
      tp.copy(discPos).addScaledVector(cDir, -camDist).add(new THREE.Vector3(0, camY - discPos.y, 0));
      tl.set(discPos.x + cDir.x * 6, discPos.y + 1.5, discPos.z + cDir.z * 6);
      spd = 0.028;
    } else if (phase === "FLYING") {
      if (discVel.length() > 0.5) {
        const fd = discVel.clone().normalize();
        tp.set(discPos.x - fd.x * 10, discPos.y + 5, discPos.z - fd.z * 10);
        tl.copy(discPos).addScaledVector(fd, 5);
      } else { tp.copy(_camPos); tl.copy(_camLook); }
      spd = 0.07;
    } else if (phase === "SCORED") {
      tp.set(basketWP.x + 5, basketWP.y + 5, basketWP.z + 12);
      tl.copy(basketWP); spd = 0.05;
    } else { tp.copy(_camPos); tl.copy(_camLook); }
    _camPos.lerp(tp, spd); _camLook.lerp(tl, spd + 0.01);
    if (_camPos.distanceTo(tp) > 60) { _camPos.copy(tp); _camLook.copy(tl); }
    camera.position.copy(_camPos); camera.lookAt(_camLook);
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
    _camPos.lerp(eyePos, 0.18);
    if (_camPos.distanceTo(eyePos) > 30) _camPos.copy(eyePos);
    _camLook.lerp(eyePos.clone().add(lookDir.multiplyScalar(20)), 0.18);
    camera.position.copy(_camPos);
    camera.lookAt(_camLook);

    // In FP aiming: hide the 3D disc (fpHandMesh handles it)
    if (discMesh) discMesh.visible = false;
    if (discMesh) discMesh.scale.setScalar(1.0);  // full size for flight later
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
    _camPos.lerp(tp, spd); _camLook.lerp(tl, spd + 0.02);
    camera.position.copy(_camPos); camera.lookAt(_camLook);

  } else if (phase === "SCORED") {
    if (discMesh) discMesh.visible = true;
    if (typeof fpHandMesh !== "undefined" && fpHandMesh) fpHandMesh.visible = false;
    tp.set(basketWP.x + 4, basketWP.y + 3, basketWP.z + 8);
    tl.copy(basketWP); spd = 0.04;
    _camPos.lerp(tp, spd); _camLook.lerp(tl, spd + 0.01);
    camera.position.copy(_camPos); camera.lookAt(_camLook);

  } else {
    // LANDED — return to eye position; disc hidden, FP hand shown when phase transitions
    if (discMesh) discMesh.visible = false;
    if (fpHandMesh) fpHandMesh.visible = true;
    var eyePos2 = new THREE.Vector3(discPos.x, discPos.y + EYE_H, discPos.z);
    _camPos.lerp(eyePos2, 0.06);
    camera.position.copy(_camPos);
    camera.lookAt(_camPos.clone().add(new THREE.Vector3(Math.sin(aimAngle),Math.sin(fpY),-Math.cos(aimAngle))));
  }

  // Camera floor clamp — never go below terrain
  if (h) {
    var camGnd2 = terrainY(_camPos.x, _camPos.z, h, holeIdx);
    if (_camPos.y < camGnd2 + 0.5) _camPos.y = camGnd2 + 0.5;
  }
}