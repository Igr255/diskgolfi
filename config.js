"use strict";

// ══════════════════════════════════════════════════════════
// ── CONFIG & NETWORK ──
// ══════════════════════════════════════════════════════════
// ── MODEL OFFSETS ────────────────────────────────────────────────────────────
// Per-model Y lift to compensate for animated-pose feet being below T-pose bbox.
// BasePlayer.glb: Idle/Grounded animation drives feet ~0.15m below T-pose bbox.
// Console logs "Suggested MODEL_OFFSETS.feetLift" for each player model on first load.
// Add skin_* entries if your skin models need different lift values.
var MODEL_OFFSETS = {
  "player_default": { feetLift: 0.15 },
  "player_0":       { feetLift: 0.15 },
  "player_1":       { feetLift: 0.15 },
  "player_2":       { feetLift: 0.15 },
  "player_3":       { feetLift: 0.15 },
  "player_4":       { feetLift: 0.15 },
  // Skin model offsets — add entries if feet float or sink:
  "skin_default":   { feetLift: 0.15 },
  "skin_trainer":   { feetLift: 0.15 },
  "skin_robot":     { feetLift: 0.15 },
  "skin_crypto":    { feetLift: 0.15 },
  "skin_furry":     { feetLift: 0.15 },
  "skin_ghost":     { feetLift: 0.15 },
  "skin_ninja":     { feetLift: 0.15 },
};
function _playerFeetLift(slotIdx, skinKey) {
  // If a skin key is provided, prefer its offset
  if (skinKey && MODEL_OFFSETS[skinKey] && MODEL_OFFSETS[skinKey].feetLift != null)
    return MODEL_OFFSETS[skinKey].feetLift;
  var key = "player_" + slotIdx;
  return (MODEL_OFFSETS[key] && MODEL_OFFSETS[key].feetLift != null ? MODEL_OFFSETS[key].feetLift : null) ||
         (MODEL_OFFSETS["player_default"] && MODEL_OFFSETS["player_default"].feetLift) || 0;
}

var PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  },
};

// ══════════════════════════════════════════════════════════════════════
// ── MODEL OVERRIDES ──────────────────────────────────────────────────
// Drop a .glb file in your models/ folder, then set the path here.
// The game will load it and use it instead of the built-in procedural mesh.
//
// Available keys:
//   BASKET & OBSTACLES:
//     basket           – the disc golf basket/target
//     tree             – generic deciduous tree
//     pinetree         – pine / christmas tree
//     rock             – generic rock
//     car              – city car obstacle
//     tractor          – funny tractor obstacle
//     snowman          – winter snowman
//     toilet           – public_poo toilet
//     poo              – public_poo poo pile
//     bunny            – feet_bunnies bunny
//     foot             – feet_bunnies foot
//     sock             – socks_basket sock
//     minion           – minion land minion
//     cabbage          – cabbage theme cabbage
//     discoball        – disco ball
//     crater           – moon crater
//     moonrock         – moon rock
//     desk             – office desk
//     lamp             – office lamp
//
//   DISCS:
//     disc_putter      – Putter disc
//     disc_midrange    – Midrange disc
//     disc_driver      – Driver disc
//     disc_distdriver  – Distance Driver disc
//     disc_exosoft     – Exo Soft disc
//     disc_highloft    – High Loft disc
//     disc_mentolak    – Mentolák disc
//     disc_vilov       – Vilov Special (sausage)
//
// GLB model requirements:
//   - Origin should be at base/bottom of model (y=0 = ground level)
//   - Scale: 1 unit ≈ 1 metre for baskets/obstacles
//   - Discs: flat, radius ≈ 0.54 units
//   - Animations are supported (first animation auto-plays)
//
// Example:
//   basket:      'models/basket.glb',
//   disc_driver: 'models/driver.glb',
// ══════════════════════════════════════════════════════════════════════
var MODEL_OVERRIDES = {
  // ════════════════════════════════════════════════════════════════════
  // MODEL OVERRIDES — replace any procedural model with your own .glb
  //
  // How to use:
  //   1. Put your .glb in a models/ folder next to index.html
  //   2. Uncomment the line, set the path to your filename
  //   3. Reload the game
  //
  // GLB requirements:
  //   Origin at Y=0 (base of model). Scale: 1 unit = 1 metre.
  //   Discs: radius ≈ 0.54 units, flat on XZ plane.
  //   Animations: first clip auto-plays and loops.
  // ════════════════════════════════════════════════════════════════════

  // ── DISCS ─────────────────────────────────────────────────────────────
  // disc_putter:       'models/disc_putter.glb',
  // disc_midrange:     'models/disc_midrange.glb',
  // disc_driver:       'models/disc_driver.glb',
  // disc_distdriver:   'models/disc_distdriver.glb',
  // disc_exosoft:      'models/disc_exosoft.glb',
  // disc_highloft:     'models/disc_highloft.glb',
  // disc_mentolak:     'models/disc_mentolak.glb',
  // disc_vilov:        'models/disc_vilov.glb',         // sausage by default

  // ── PLAYER AVATARS ────────────────────────────────────────────────────
  // Replace the procedural stick-figure avatars with your own character models.
  // player_0 through player_4 = each player slot (0 = host, 1-4 = clients).
  // player_default is used for any slot that has no specific override.
  //
  // GLB requirements:
  //   - T-pose or idle animation preferred
  //   - Origin at Y=0 (feet), facing +Z (forward)
  //   - Scale: 1 unit = 1 metre (~1.7m tall recommended)
  //   - Animations: idle (index 0), throw (index 1) — optional
  //
  // player_default:    'models/player.glb',
  // player_0:          'models/player_host.glb',   // host slot

  // ── PLAYER SKIN MODELS (link to Skin Locker entries) ─────────────────────
  player_default: 'models/BasePlayer.glb',
player_0:       'models/BasePlayer.glb',
player_1:       'models/BasePlayer.glb',
player_2:       'models/BasePlayer.glb',
player_3:       'models/BasePlayer.glb',
player_4:       'models/BasePlayer.glb',

// ── PLAYER SKIN MODEL OVERRIDES ─────────────────────────────────────────
// These are cosmetic character skins the local player can equip in the Skin Locker.
// Each key matches a PLAYER_SKINS entry below. The GLB must behave exactly
// like BasePlayer.glb: T-pose at rest, Idle/Walk/Sprint/Jump/Grounded clips.
// Uncomment and provide your model path to activate a skin.
//
skin_default:        'models/players/BasePlayer.glb',
skin_trainer:        'models/players/Citizen 2.glb',
skin_robot:          'models/players/Santa Claus.glb',
skin_crypto:         'models/players/Crypto Bro.glb',
skin_furry:          'models/players/Chicken Guy.glb',
skin_ghost:          'models/players/Rubber Duck.glb',
skin_ninja:          'models/players/Food Worker.glb',

  // ── BASKET (appears on every hole) ────────────────────────────────────
  // basket:            'models/basket.glb',

  // ── NATURE / UNIVERSAL ────────────────────────────────────────────────
  // tree:              'models/tree.glb',               // deciduous tree
  // pinetree:          'models/pinetree.glb',           // pine / conifer
  // xmastree:          'models/xmastree.glb',           // christmas tree (winter)
  // rock:              'models/rock.glb',               // generic boulder
  // mtnpeak:           'models/mtnpeak.glb',            // mountain peak (mountains)

  // ── EERIE / TERRIFYING / FUNNY ────────────────────────────────────────
  // furry:             'models/furry.glb',              // cat creature (neon/terrifying/funny)
  // tractor:           'models/tractor.glb',            // funny tractor (funny)
  // axe:               'models/axe.glb',                // spinning axe target
  // entity:            'models/entity.glb',             // eerie floating entity
  // screamer:          'models/screamer.glb',           // screaming face (screaming_mamamia)
  // spike:             'models/spike.glb',              // chaos spike
  // arrow:             'models/arrow.glb',              // dancing arrow (emote)

  // ── GEOMETRY DASH ─────────────────────────────────────────────────────
  // geospike:          'models/geospike.glb',
  // geoblock:          'models/geoblock.glb',
  // geoportal:         'models/geoportal.glb',

  // ── SIXTYSEVEN / MAP67 ────────────────────────────────────────────────
  // glitchpillar:      'models/glitchpillar.glb',
  // datanode:          'models/datanode.glb',
  // number:            'models/number.glb',             // giant 6 or 7

  // ── EMOTE ─────────────────────────────────────────────────────────────
  // emojipillar:       'models/emojipillar.glb',

  // ── CITY ──────────────────────────────────────────────────────────────
  // car:               'models/car.glb',
  // skyscraper:        'models/skyscraper.glb',

  // ── FEET / BUNNIES ────────────────────────────────────────────────────
  // foot:              'models/foot.glb',
  // bunny:             'models/bunny.glb',

  // ── SOCKS BASKET ──────────────────────────────────────────────────────
  // sock:              'models/sock.glb',
  // laundry:           'models/laundry.glb',            // laundry basket obstacle

  // ── BACKROOMS ─────────────────────────────────────────────────────────
  // pillar:            'models/pillar.glb',             // yellowed concrete pillar
  // wall:              'models/wall.glb',               // backrooms wall segment

  // ── PUBLIC POO ────────────────────────────────────────────────────────
  // toilet:            'models/toilet.glb',
  // poo:               'models/poo.glb',

  // ── DISCO ─────────────────────────────────────────────────────────────
  // discoball:         'models/discoball.glb',
  // helmet:            'models/helmet.glb',             // daft punk helmet
  // booth:             'models/booth.glb',              // disco booth

  // ── WINTER / SNOW ─────────────────────────────────────────────────────
  // snowman:           'models/snowman.glb',
  // icecrystal:        'models/icecrystal.glb',

  // ── MOON ──────────────────────────────────────────────────────────────
  // crater:            'models/crater.glb',
  // moonrock:          'models/moonrock.glb',

  // ── OFFICE ────────────────────────────────────────────────────────────
  // desk:              'models/desk.glb',
  // cubicle:           'models/cubicle.glb',            // cubicle wall segment
  // lamp:              'models/lamp.glb',               // office floor lamp

  // ── CABBAGE / GARDEN ──────────────────────────────────────────────────
  // cabbage:           'models/cabbage.glb',

  // ── MINION LAND ───────────────────────────────────────────────────────
  // minion:            'models/minion.glb',

  // ── TORNADO ───────────────────────────────────────────────────────────
  // tornado:           'models/tornado.glb',            // funnel cloud obstacle

  // ── WATERFALL / GRAND CANYON ──────────────────────────────────────────
  // waterfall:         'models/waterfall.glb',          // waterfall rock
  // canyon:            'models/canyon.glb',             // canyon wall chunk

  // ── POOLROOMS ─────────────────────────────────────────────────────────
  // poolroom_pillar:   'models/poolroom_pillar.glb',
  // poolroom_sign:     'models/poolroom_sign.glb',

  // ── HOGWARTS ──────────────────────────────────────────────────────────
  // hw_candle:         'models/hw_candle.glb',
  // hw_stone:          'models/hw_stone.glb',
  // hw_lantern:        'models/hw_lantern.glb',

  // ── VILLAGE ───────────────────────────────────────────────────────────
  // haystack:          'models/haystack.glb',
  // well:              'models/well.glb',

  // ── MINECRAFT ─────────────────────────────────────────────────────────
  // mc_block:          'models/mc_block.glb',
  // mc_tree:           'models/mc_tree.glb',
  // mc_creeper:        'models/mc_creeper.glb',

  // ── SKYBLOCK ──────────────────────────────────────────────────────────
  // sb_crate:          'models/sb_crate.glb',

  // ────────────────────────────────────────────────────────────────────
  // ↓ Active overrides below — remove comment slashes to enable ↓
  // ────────────────────────────────────────────────────────────────────
  // PLAYERS
player_default: 'models/BasePlayer.glb',
player_0:       'models/BasePlayer.glb',
player_1:       'models/Trainer.glb',
player_2:       'models/Robot.glb',
player_3:       'models/Crypto Bro.glb',
player_4:       'models/Furry boi v2.glb',

// NATURE / UNIVERSAL
tree:           'models/Tree.glb',
pinetree:       'models/Pine Tree.glb',
xmastree:       'models/Christmas Tree.glb',
rock:           'models/Rock Large.glb',
mtnpeak:        'models/Mountain.glb',

// EERIE / FUNNY
furry:          'models/Rooster.glb',
tractor:        'models/Tractor.glb',
axe:            'models/Arrow Sign.glb',
entity:         'models/Ghoooooost.glb',
screamer:       'models/Chick.glb',
spike:          'models/Spikes.glb',
arrow:          'models/Arrow Sign.glb',

// GEOMETRY DASH
geospike:       'models/Tree Spikes.glb',
geoblock:       'models/Blocks.glb',
geoportal:      'models/Portal_ Companion Cube.glb',

// SIXTYSEVEN / MAP67
glitchpillar:   'models/DJgear.glb',
datanode:       'models/Mug With Office Tool.glb',
number:         'models/Cobblestone tile.glb',

// EMOTE
emojipillar:    'models/Grass Patch.glb',

// CITY
car:            'models/Car.glb',
skyscraper:     'models/Skyscraper.glb',

// FEET / BUNNIES
foot:           'models/Rock.glb',
bunny:          'models/Bunny.glb',

// SOCKS BASKET
sock:           'models/Cabbage.glb',
laundry:        'models/Pond.glb',

// BACKROOMS
pillar:         'models/Low Building.glb',
wall:           'models/Cobblestone tile.glb',

// PUBLIC POO
toilet:         'models/Pond.glb',
poo:            'models/Cabbage.glb',

// DISCO
discoball:      'models/DJgear.glb',
helmet:         'models/Robot.glb',
booth:          'models/Low Building.glb',

// WINTER / SNOW
snowman:        'models/Chick.glb',
icecrystal:     'models/Tree Spikes.glb',

// MOON
crater:         'models/Pond.glb',
moonrock:       'models/Rock.glb',

// OFFICE
desk:           'models/Mug With Office Tool.glb',
cubicle:        'models/Low Building.glb',
lamp:           'models/Arrow Sign.glb',

// CABBAGE / GARDEN
cabbage:        'models/Cabbage.glb',
grass_patch:    'models/Grass Patch.glb',

// MINION LAND
minion:         'models/Chick.glb',

// TORNADO
tornado:        'models/Ghoooooost.glb',

// WATERFALL / GRAND CANYON
waterfall:      'models/Pond.glb',
canyon:         'models/Mountain.glb',

// POOLROOMS
poolroom_pillar:'models/Low Building.glb',
poolroom_sign:  'models/Arrow Sign.glb',

// HOGWARTS
hw_candle:      'models/Christmas Tree.glb',
hw_stone:       'models/Rock.glb',
hw_lantern:     'models/Arrow Sign.glb',

// VILLAGE
haystack:       'models/Grass Patch.glb',
well:           'models/Pond.glb',

// MINECRAFT
mc_block:       'models/Blocks.glb',
mc_tree:        'models/Tree.glb',
mc_creeper:     'models/Robot.glb',

// SKYBLOCK
sb_crate:       'models/Blocks.glb',

// VET SCHOOL
shiba_inu:      'models/Shiba Inu.glb',
animated_woman: 'models/Animated Woman.glb',

// EXTRA WORLD OVERRIDE
island:         'models/Island.glb',
};

// ── GLB LOADER SYSTEM ────────────────────────────────────────────────
// Internal cache: key → THREE.Group (cloned for each use)
var _modelCache   = {};
// Pending callbacks: key → [fn, fn, ...] waiting for load
var _modelPending = {};
// Whether GLTFLoader script has been injected
var _gltfLoaderReady = false;

// Wait for GLTFLoader (already injected in <head> via onload → _gltfReady)
function _ensureGLTFLoader(cb) {
  if (window._gltfReady && typeof THREE !== "undefined" && typeof THREE.GLTFLoader !== "undefined") {
    cb(); return;
  }
  // Poll until ready (max 10s = 200 × 50ms)
  var _tries = 0;
  var t = setInterval(function() {
    _tries++;
    var ok = window._gltfReady && typeof THREE !== "undefined" && typeof THREE.GLTFLoader !== "undefined";
    if (ok) { clearInterval(t); cb(); }
    else if (_tries > 200) {
      clearInterval(t);
      console.warn("DiskGolfi: GLTFLoader not available after 10s.",
        "window._gltfReady =", window._gltfReady,
        "THREE.GLTFLoader =", typeof THREE !== "undefined" ? typeof THREE.GLTFLoader : "N/A");
    }
  }, 50);
}

// Public API: loadModel(key, callback)
// callback(group) — group is a cloned THREE.Group ready to add to scene.
// If no override for key, or load fails, callback(null) is called and the
// caller falls back to its procedural mesh.
function loadModel(key, callback) {
  var path = MODEL_OVERRIDES[key];
  if (!path) { callback(null); return; }  // no override — use procedural

  // Return cached clone immediately
  if (_modelCache[key]) {
    callback(_cloneGLB(_modelCache[key], key));
    return;
  }
  // Queue callback if already loading
  if (_modelPending[key]) {
    _modelPending[key].push(callback);
    return;
  }
  _modelPending[key] = [callback];

  _ensureGLTFLoader(function() {
    console.log("DiskGolfi: loading model key='" + key + "' path='" + path + "'");
    var loader = new THREE.GLTFLoader();
    loader.load(path, function(gltf) {
      console.log("DiskGolfi: loaded '" + key + "' OK, meshes:", gltf.scene.children.length);
      var group = gltf.scene;

      // ── Auto-scale to target height ──────────────────────────────────
      // Compute bounding box of the loaded model and scale it to fit
      // within the target height for this model type.
      var _bbox = new THREE.Box3().setFromObject(group);
      var _size = new THREE.Vector3();
      _bbox.getSize(_size);
      var _tallest = Math.max(_size.x, _size.y, _size.z);
      // Resolve target size from MODEL_CONFIG — single source of truth
      var _cfg = null;
      var _baseKey = key.replace(/^(player_|skin_|disc_).*/, function(m,p1){ return p1.slice(0,-1); });
      if (key.startsWith("player_") || key === "player_default" || key.startsWith("skin_")) _cfg = MODEL_CONFIG.player;
      else if (key.startsWith("disc")) _cfg = { targetHeight: MODEL_CONFIG.disc.targetDiameter };
      else if (MODEL_CONFIG[key]) _cfg = MODEL_CONFIG[key];
      else if (key === "pinetree" || key === "xmastree") _cfg = MODEL_CONFIG.tree;
      else if (key === "moonrock") _cfg = MODEL_CONFIG.rock;
      var _target = _cfg ? (_cfg.targetHeight || _cfg.targetDiameter || 1.75) : 3.5;

      if (_target > 0 && _tallest > 0.001) {
        var _scale = _target / _tallest;
        group.scale.setScalar(_scale);
        var _bbox2 = new THREE.Box3().setFromObject(group);
        group.position.y -= _bbox2.min.y;
        console.log("DiskGolfi: auto-scaled '" + key + "' to " + _target + "m (was " + _tallest.toFixed(2) + "m)");
      }

      // Store raw animation clips on source — DO NOT create mixer here.
      // Each clone gets its own mixer in _cloneGLB so bones are correct.
      if (gltf.animations && gltf.animations.length > 0) {
        group.userData.animations = gltf.animations;  // raw clips only
      }
      _modelCache[key] = group;
      var pending = _modelPending[key] || [];
      delete _modelPending[key];
      // Foot-bone scan for player models to help tune MODEL_OFFSETS.feetLift
      if (key && key.indexOf("player") >= 0) {
        group.updateMatrixWorld(true);
        var _lowestFY = Infinity;
        group.traverse(function(nd) {
          var nm = (nd.name || "").toLowerCase();
          if (nm.indexOf("foot") >= 0 || nm.indexOf("toe") >= 0) {
            var _wp2 = new THREE.Vector3();
            nd.getWorldPosition(_wp2);
            if (_wp2.y < _lowestFY) _lowestFY = _wp2.y;
          }
        });
        if (_lowestFY < Infinity)
          console.log("DiskGolfi: '" + key + "' foot-bone Y=" + _lowestFY.toFixed(4) +
            " → suggested feetLift=" + Math.max(0,-_lowestFY).toFixed(4));
      }
      console.log("DiskGolfi: swapping " + pending.length + " instance(s) of '" + key + "'");
      pending.forEach(function(cb2) { cb2(_cloneGLB(group, key)); });
    }, function(xhr) {
      // progress (optional)
    }, function(err) {
      console.error("DiskGolfi: FAILED to load '" + key + "' from '" + path + "':", err);
      var pending = _modelPending[key] || [];
      delete _modelPending[key];
      pending.forEach(function(cb2) { cb2(null); });
    });
  });
}

// Deep-clone a loaded GLB group (each instance needs its own transform)
function _cloneGLB(src, _srcKey) {
  // Detect skinned meshes (rigged characters like BasePlayer.glb).
  // Regular clone(true) on a SkinnedMesh shares skeleton bones with the
  // original, creating circular parent refs that crash toJSON with
  // "too much recursion". SkeletonUtils.clone() properly rebinds bones.
  var hasSkin = false;
  src.traverse(function(c) { if (c.isSkinnedMesh) hasSkin = true; });

  var clone;
  if (hasSkin && typeof THREE !== 'undefined' && THREE.SkeletonUtils) {
    clone = THREE.SkeletonUtils.clone(src);
  } else {
    clone = src.clone(true);
  }

  // Re-share materials by index (safe — clone preserves traversal order)
  var srcMeshes = [], cloneMeshes = [];
  src.traverse(function(c)   { if (c.isMesh) srcMeshes.push(c);   });
  clone.traverse(function(c) { if (c.isMesh) cloneMeshes.push(c); });
  for (var i = 0; i < srcMeshes.length && i < cloneMeshes.length; i++) {
    cloneMeshes[i].material      = srcMeshes[i].material;
    cloneMeshes[i].castShadow    = true;
    cloneMeshes[i].receiveShadow = true;
  }

  // Create a fresh AnimationMixer bound to THIS clone's own skeleton.
  // Each clone must have its own mixer — sharing one mixer across
  // multiple SkinnedMesh instances causes desync and recursion bugs.
  if (src.userData.animations && src.userData.animations.length > 0) {
    clone.userData.animations = src.userData.animations;
    clone.userData.mixer      = new THREE.AnimationMixer(clone);

    // Build name-keyed map — NEVER use numeric indices (order varies per model)
    clone.userData.clipActions = {};
    src.userData.animations.forEach(function(clip) {
      var act = clone.userData.mixer.clipAction(clip);
      act.setLoop(THREE.LoopRepeat, Infinity);
      clone.userData.clipActions[clip.name] = act;
    });

    // Log all clip names on first load so devs can see what's available
    var _clipNames = Object.keys(clone.userData.clipActions);
    console.log("DiskGolfi: clips for cached model (" + (_srcKey||"?") + "):", _clipNames);


    console.log("DiskGolfi: _ANIM_NAME_MAP resolves:", Object.keys(_ANIM_NAME_MAP).map(function(k){ return k+"→"+_ANIM_NAME_MAP[k]; }));

    // Auto-start idle — search by name with fallbacks:
    //   BasePlayer.glb uses 'Armature|Idle'
    //   Generic models may use 'idle' or 'Idle'
    var _ks = Object.keys(clone.userData.clipActions);
    var _startName = _ks.find(function(k){ return k==='Armature|Idle'; })
      || _ks.find(function(k){ return k.toLowerCase().indexOf('idle')>=0; })
      || _ks[0];
    if (_startName && clone.userData.clipActions[_startName]) {
      clone.userData.clipActions[_startName].reset().play();
      clone.userData.activeClipName = _startName;
    }

    _glbMixers.push(clone.userData.mixer);
  }

  return clone;
}

// Animation mixers — updated each frame in animate()
var _glbMixers = [];

// Check if any override is configured
function _hasAnyOverride() {
  return Object.values(MODEL_OVERRIDES).some(function(v) { return !!v; });
}

// Debug helper — paste in browser console to test
// window.debugModelOverrides()
window.debugModelOverrides = function() {
  console.log("MODEL_OVERRIDES:", MODEL_OVERRIDES);
  console.log("THREE.GLTFLoader available:", typeof THREE !== "undefined" && typeof THREE.GLTFLoader !== "undefined");
  console.log("_modelCache:", Object.keys(_modelCache));
  Object.keys(MODEL_OVERRIDES).forEach(function(key) {
    if (MODEL_OVERRIDES[key]) {
      console.log("Testing load for key='" + key + "', path='" + MODEL_OVERRIDES[key] + "'");
      loadModel(key, function(g) { console.log(key + ":", g ? "✓ loaded" : "✗ failed"); });
    }
  });
};

// ══════════════════════════════════════════════════════════
// ── DISC DEFINITIONS ──
// speed: max horizontal speed (m/s)
// lift: air resistance lift coefficient
// turn: lateral drift at high speed (positive = right at speed)
// fade: hook at low speed (always left)
// drag: 0-1 air slowdown per tick
// bounce: energy retained on ground hit
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// DISC DEFINITIONS — each disc has a meaningful role:
//
// minPower:   below this power (0-1), disc loses too much speed to fly right
// maxPower:   above this, disc aerodynamics break down (too flat/fast)
// optimalPow: sweet spot — shown in tip, gives best flight
// These are checked in computeLaunchVelocity to enforce disc roles.
// ══════════════════════════════════════════════════════════════════
var DISCS = {
  putter: {
    // Short game only — dead-straight at low speeds, loses stability fast at high power
    speed: 4, launchMult: 0.85, glide: 3, lift: 0.04, drag: 0.92, turn: 0.001,
    fade: 0.008, bounce: 0.08, groundSkip: 0.05, stability: 1.5, maxSpin: 7, maxAirtime: 7,
    minPower: 0.0, maxPower: 0.55, optimalPow: 0.35,
    color: 0xffff44, label: "Putter", icon: "🟡",
    desc: "Dead-straight at low power. Unreliable above 55%.",
    tip: "Best: 20-55% power. Basket putts + short hops.",
  },
  midrange: {
    // All-rounder — works at any power, predictable fade, good for gap shots
    speed: 6, launchMult: 1.0, glide: 5, lift: 0.035, drag: 0.86, turn: 0.008,
    fade: 0.03, bounce: 0.22, groundSkip: 0.25, stability: 1.1, maxSpin: 10, maxAirtime: 10,
    minPower: 0.15, maxPower: 1.0, optimalPow: 0.6,
    color: 0xff00ff, label: "Midrange", icon: "🟣",
    desc: "Reliable at all power levels. Gentle fade.",
    tip: "Best: 35-80% power. Gap shots + medium carries.",
  },
  driver: {
    // Distance with control — needs good power, develops strong fade at speed
    speed: 10, launchMult: 1.3, glide: 5, lift: 0.024, drag: 0.80, turn: 0.028,
    fade: 0.07, bounce: 0.38, groundSkip: 0.5, stability: 0.82, maxSpin: 12, maxAirtime: 10,
    minPower: 0.45, maxPower: 1.0, optimalPow: 0.75,
    color: 0x00ffff, label: "Driver", icon: "🔵",
    desc: "Strong fade at high speed. Needs >45% power.",
    tip: "Best: 60-100% power. Long fairway shots.",
  },
  distdriver: {
    // Max range — must be thrown HARD or it tombstones immediately
    speed: 14, launchMult: 1.55, glide: 4, lift: 0.016, drag: 0.76, turn: 0.05,
    fade: 0.11, bounce: 0.42, groundSkip: 0.6, stability: 0.6, maxSpin: 14, maxAirtime: 8,
    minPower: 0.7, maxPower: 1.0, optimalPow: 0.9,
    color: 0xff4400, label: "Dist. Driver", icon: "🔴",
    desc: "Maximum range but NEEDS 70%+ power. Useless at low power.",
    tip: "Needs 70-100% power. Only for huge open carries.",
  },
  exosoft: {
    // Landing specialist — extremely soft bounce, sticks where it lands
    speed: 6, launchMult: 1.0, glide: 4, lift: 0.032, drag: 0.85, turn: 0.004,
    fade: 0.022, bounce: 0.02, groundSkip: 0.02, stability: 1.15, maxSpin: 9, maxAirtime: 10,
    minPower: 0.1, maxPower: 0.85, optimalPow: 0.55,
    color: 0x88ff88, label: "Exo Soft", icon: "🟢",
    desc: "Sticks on landing — near-zero bounce. Reliable on slopes.",
    tip: "Best: 30-70% power. Island edges + elevated baskets.",
  },
  highloft: {
    // Vertical specialist — massive lift, great for uphill, terrible for flat shots
    speed: 7, launchMult: 1.15, glide: 7, lift: 0.11, drag: 0.83, turn: 0.003,
    fade: 0.018, bounce: 0.18, groundSkip: 0.15, stability: 1.1, maxSpin: 10, maxAirtime: 12,
    minPower: 0.2, maxPower: 1.0, optimalPow: 0.65,
    color: 0xffaa00, label: "High Loft", icon: "🟠",
    desc: "Huge lift arc. Essential for uphill islands. Floats far.",
    tip: "Best: 40-80% power. Elevated baskets + long floaters.",
  },
  mentolak: {
    // Premium midrange — best glide, almost no fade, straight laser flight
    speed: 7, launchMult: 1.05, glide: 8, lift: 0.048, drag: 0.845, turn: 0.006,
    fade: 0.018, bounce: 0.2, groundSkip: 0.18, stability: 1.35, maxSpin: 11, maxAirtime: 11,
    minPower: 0.2, maxPower: 0.9, optimalPow: 0.65,
    color: 0x00ffaa, label: "Mentolák", icon: "🩵",
    desc: "Elite straight flight. Best glide of any disc. Minimal fade.",
    tip: "Best: 40-85% power. Narrow gaps + precision lines.",
  },
  vilov: {
    speed: 8,
    launchMult: 1.2,
    glide: 5,
    lift: 0.028,
    drag: 0.8,
    turn: -0.06,
    fade: 0.07,
    bounce: 0.5,
    groundSkip: 0.4,
    stability: 0.8,
    maxSpin: 11,
    maxAirtime: 10,
    color: 0x44aa00,
    label: "Vilov Special",
    desc: "Hungarian disc · Opposite curve",
    tip: "Reverse curve trick utility",
    icon: "🇭🇺",
    special: "explode",
    colors: [0xcc0000, 0xffffff, 0x00aa44],
  },
};

var LOFTS = [
  { a: 8, label: "Low", icon: "🔵" },
  { a: 18, label: "Normal", icon: "🟡" },
  { a: 28, label: "High", icon: "🔴" },
];

var THEMES = [
  "eerie",
  "funny",
  "neon",
  "terrifying",
  "feet_bunnies",
  "city",
  "socks_basket",
  "backrooms",
  "public_poo",
  "screaming_mamamia",
  "disco",
  "mountains",
  "geometry_dash",
  "emote",
  "sixtyseven",
  "winter",
  "moon",
  "office",
  "cabbage",
  "minion",
  "map67",
  "grandcanyon",
  "tornado",
  "waterfall",
  // ── NEW THEMES ──
  "poolrooms",    // liminal backrooms but with pools — uncanny silence
  "hogwarts",     // harry potter — floating candles, moving staircases
  "village",      // cozy medieval village — wells, haystacks, windmills
  "minecraft",    // blocky pixelated world — creepers, dirt blocks, ore
  "skyblock",     // single floating island survival — void below
  "vetschool",    // veterinary school — animal pens, clinic buildings, medical signs
];

// ── CANONICAL WORLD SCALE ────────────────────────────────────────────────────
// Single source of truth for all model target sizes.
// ALL GLBs are auto-normalized to these values in loadModel().
// DO NOT add manual scale corrections elsewhere in code.
var MODEL_CONFIG = {
  player:       { targetHeight: 1.75 },   // standing player height in world units
  disc:         { targetDiameter: 1.08 }, // frisbee diameter (matches procedural disc)
  basket:       { targetHeight: 1.5  },   // basket height
  tree:         { targetHeight: 6.0  },
  rock:         { targetHeight: 2.2  },
  car:          { targetHeight: 5.0  },
  tractor:      { targetHeight: 2.5  },
  snowman:      { targetHeight: 1.8  },
  skyscraper:   { targetHeight: 18.0 },
  minion:       { targetHeight: 1.4  },
  island:         { targetHeight: -1   },   // -1 = terrain.js handles scale
  shiba_inu:      { targetHeight: 3.5  },  // 2.5× game scale so dog is clearly visible
  animated_woman: { targetHeight: 8.6  },  // 5× scale
};

var MAX_PLAYERS = 5;
var PLAYER_COLORS = [0x00ffff, 0xff00ff, 0xffff00, 0xff6600, 0x00ff88];
var PLAYER_DISC_TYPES = ["driver", "midrange", "putter", "driver", "midrange"];

// ── PLAYER SKINS ─────────────────────────────────────────────────────────────
// Character skins selectable in the Skin Locker. modelKey links to MODEL_OVERRIDES.
// To add a skin: add an entry here AND uncomment/add the matching key in MODEL_OVERRIDES.
// GLB must match BasePlayer.glb format: T-pose, Idle/Walk/Sprint/Jump/Grounded clips.
//
// How to link a model:
//   1. Add key to MODEL_OVERRIDES, e.g.: skin_robot: 'models/Robot.glb',
//   2. Reference that key in modelKey below
//   3. Reload — skin appears in the Skin Locker
var PLAYER_SKINS = [
  // id: internal key. name: exact GLB filename (without path/extension) — shown in Skin Locker.
  // modelKey: must match a MODEL_OVERRIDES key. unlock: requirement text.
  // backdoorCode: secret code to instantly unlock this skin from the Skin Locker input.
  { id: "default",  name: "BasePlayer",   icon: "🧍", modelKey: "skin_default", color: null,     unlock: "Always unlocked", free: true,  backdoorCode: null          },
  { id: "citizen",  name: "Citizen 2",    icon: "🧑", modelKey: "skin_trainer", color: 0xff6600,  unlock: "Always unlocked", free: true,  backdoorCode: null          },
  { id: "santa",    name: "Santa Claus",  icon: "🎅", modelKey: "skin_robot",   color: 0xcc0000,  unlock: "Play 3 holes",    free: false, backdoorCode: "HOHOHO"      },
  { id: "crypto",   name: "Crypto Bro",   icon: "💎", modelKey: "skin_crypto",  color: 0xffdd00,  unlock: "Play 9 holes",    free: false, backdoorCode: "MOONLAMBO"   },
  { id: "chicken",  name: "Chicken Guy",  icon: "🐔", modelKey: "skin_furry",   color: 0xff8800,  unlock: "Get a birdie",    free: false, backdoorCode: "CLUCKCLUCK"  },
  { id: "duck",     name: "Rubber Duck",  icon: "🦆", modelKey: "skin_ghost",   color: 0xffee00,  unlock: "Play 18 holes",   free: false, backdoorCode: "QUACKQUACK"  },
  { id: "chef",     name: "Food Worker",  icon: "👨‍🍳", modelKey: "skin_ninja",   color: 0xffffff,  unlock: "Get an ace",      free: false, backdoorCode: "ORDERUP"     },
];
// Master backdoor: unlocks ALL skins at once
var PLAYER_SKINS_MASTER_CODE = "TOYOTA";

// Active player skin (persisted)
var equippedPlayerSkin = "default";
(function() {
  try { var s = localStorage.getItem("dg_player_skin"); if (s) equippedPlayerSkin = s; } catch(e) {}
})();
function savePlayerSkin() {
  try { localStorage.setItem("dg_player_skin", equippedPlayerSkin); } catch(e) {}
}

// Unlocked player skins (persisted)
var unlockedPlayerSkins = { default: true, citizen: true };
(function() {
  try { var s = localStorage.getItem("dg_player_skins_unlocked"); if (s) Object.assign(unlockedPlayerSkins, JSON.parse(s)); } catch(e) {}
})();
function saveUnlockedPlayerSkins() {
  try { localStorage.setItem("dg_player_skins_unlocked", JSON.stringify(unlockedPlayerSkins)); } catch(e) {}
}

// ── BACKGROUND IMAGE ─────────────────────────────────────────────────────────
// Optional image shown behind the 3D scene (sky/far background).
// Set to a path relative to index.html, or null to disable.
// Supports PNG, JPG, WebP.
// Example: var BACKGROUND_IMAGE = 'images/sunset.webp';
var BACKGROUND_IMAGE = 'images/background.webp';

// ── DEBUG MODE ────────────────────────────────────────────────────────────────
// Toggle with: DiskGolfiDebug.toggle()  OR press F9 in-game
// Shows: colliders, platform roots, anim states, model pivots, world scale ref
var DEBUG_MODE = false;
var DiskGolfiDebug = {
  toggle: function() {
    DEBUG_MODE = !DEBUG_MODE;
    if (typeof _applyDebugMode === "function") _applyDebugMode(DEBUG_MODE);
    console.log("[DiskGolfi] Debug mode:", DEBUG_MODE ? "ON" : "OFF");
  },
  on:  function() { DEBUG_MODE = true;  if (typeof _applyDebugMode === "function") _applyDebugMode(true);  },
  off: function() { DEBUG_MODE = false; if (typeof _applyDebugMode === "function") _applyDebugMode(false); },
};

// ══════════════════════════════════════════════════════════
// ── GLB LOADER (lazy-loaded only if overrides are set) ──
// ══════════════════════════════════════════════════════════
var _gltfLoader = null;
function getGLTFLoader() {
  if (_gltfLoader) return _gltfLoader;
  if (typeof THREE.GLTFLoader !== "undefined") {
    _gltfLoader = new THREE.GLTFLoader();
    return _gltfLoader;
  }
  return null;
}

function loadModelOverride(key, cb) {
  const path = MODEL_OVERRIDES[key];
  if (!path) { cb(null); return; }
  const loader = getGLTFLoader();
  if (!loader) { cb(null); return; }
  loader.load(path, (gltf) => cb(gltf.scene), undefined, () => cb(null));
}

// ═══════════════════════════════════════════════════════════════════════
// ── DISC SKINS ──────────────────────────────────────────────────────────
// Cosmetic only — no gameplay changes. Skins modify color/material/glow.
// id must be unique. rarity: "common"|"rare"|"epic"|"legendary"|"secret"
// ═══════════════════════════════════════════════════════════════════════
var DISC_SKINS = {
  // ─ Global skins ──────────────────────────────────────────────────
  // Common: color only (no shape/glow/particles)
  // Rare+: shape override, glow, particles, special mesh
  _global: [
    // ── COMMON — color only ──
    { id:"classic",     name:"Classic",       rarity:"common",
      color:null,      glow:null,  shape:null, particles:null,
      desc:"Default disc look.",
      unlock:"Always unlocked." },
    { id:"red",         name:"Crimson",       rarity:"common",
      color:0xff2222,  glow:null,  shape:null, particles:null,
      desc:"Classic red.",
      unlock:"Always unlocked." },
    { id:"blue",        name:"Ocean",         rarity:"common",
      color:0x2266ff,  glow:null,  shape:null, particles:null,
      desc:"Deep blue.",
      unlock:"Always unlocked." },
    { id:"green",       name:"Emerald",       rarity:"common",
      color:0x22cc66,  glow:null,  shape:null, particles:null,
      desc:"Forest green.",
      unlock:"Always unlocked." },
    { id:"black",       name:"Onyx",          rarity:"common",
      color:0x111111,  glow:null,  shape:null, particles:null,
      desc:"Matte black.",
      unlock:"Always unlocked." },
    { id:"white",       name:"Pearl",         rarity:"common",
      color:0xeeeeff,  glow:null,  shape:null, particles:null,
      desc:"Clean white.",
      unlock:"Always unlocked." },

    // ── RARE — shape tweaks + glow ──
    { id:"gold",        name:"Gold",          rarity:"rare",
      color:0xffcc00,  glow:0xffaa00, metal:true, shape:null, particles:"sparks",
      desc:"Shiny gold finish with spark trail.",
      unlock:"Complete 5 holes." },
    { id:"chrome",      name:"Chrome",        rarity:"rare",
      color:0xdddddd,  glow:null,     metal:true, shape:null, particles:"sparks",
      desc:"Mirror-polished chrome.",
      unlock:"Complete 3 holes." },
    { id:"carbon",      name:"Carbon Fiber",  rarity:"rare",
      color:0x222222,  glow:null,     shape:null, particles:null,
      desc:"Race-spec carbon weave.",
      unlock:"Complete 3 holes." },
    { id:"pizza",       name:"🍕 Pizza",      rarity:"rare",
      color:0xffcc44,  glow:null,     shape:"pizza",   particles:"food",
      desc:"Flings pepperoni slices on bounce.",
      unlock:"Always unlocked." },
    { id:"sawblade",    name:"⚙️ Saw Blade",  rarity:"rare",
      color:0xbbbbbb,  glow:0x88ccff, metal:true, shape:"saw",   particles:"sparks",
      desc:"Serrated edges spark on bounce.",
      unlock:"Complete 3 holes." },
    { id:"pancake",     name:"🥞 Pancake",    rarity:"rare",
      color:0xddaa55,  glow:null,     shape:"puck",    particles:"food",
      desc:"Floppy. Butter particles on land.",
      unlock:"Always unlocked." },
    { id:"coin",        name:"🪙 Coin",       rarity:"rare",
      color:0xffcc00,  glow:null,     metal:true, shape:"coin",  particles:"sparks",
      desc:"Thin coin — spins like crazy.",
      unlock:"Always unlocked." },
    { id:"keycap",      name:"⌨️ Key Cap",   rarity:"rare",
      color:0xdddddd,  glow:null,     shape:"key",     particles:null,
      desc:"Tactile bump on top.",
      unlock:"Always unlocked." },

    // ── EPIC — shape + glow + special particles ──
    { id:"neon_pink",   name:"Neon Pink",     rarity:"epic",
      color:0xff00aa,  glow:0xff00ff, shape:null,      particles:"glow",
      desc:"Glowing pink light trail.",
      unlock:"Score an ace (hole-in-one)." },
    { id:"fire",        name:"Inferno",       rarity:"epic",
      color:0xff4400,  glow:0xff8800, shape:null,      particles:"fire",
      desc:"Fire trail. Burns on impact.",
      unlock:"Fall into a hazard 10 times." },
    { id:"ice",         name:"Arctic",        rarity:"epic",
      color:0x88eeff,  glow:0x00ffff, shape:null,      particles:"ice",
      desc:"Ice crystal trail. Freezes on impact.",
      unlock:"Complete 9 holes." },
    { id:"toxic",       name:"Toxic",         rarity:"epic",
      color:0x44ff00,  glow:0x88ff00, shape:null,      particles:"toxic",
      desc:"Green toxic smoke trail.",
      unlock:"Score under par 5 times." },
    { id:"banana",      name:"🍌 Banana",     rarity:"epic",
      color:0xffee00,  glow:null,     shape:"banana",  particles:"food",
      desc:"Curved shape. Bonus turn.",
      unlock:"Always unlocked." },
    { id:"ufo",         name:"🛸 UFO",        rarity:"epic",
      color:0x88ffcc,  glow:0x00ffaa, shape:"ufo",     particles:"glow",
      desc:"Anti-gravity saucer. Beam particles.",
      unlock:"Score an ace (hole-in-one)." },
    { id:"galaxy",      name:"Galaxy",        rarity:"epic",
      color:0x220055,  glow:0x8800ff, shape:null,      particles:"stars",
      desc:"Star trail. Deep space purple.",
      unlock:"Complete 18 holes." },

    // ── LEGENDARY — dramatic shape + intense effects ──
    { id:"holographic", name:"Holographic",   rarity:"legendary",
      color:0xffffff,  glow:0x00ffff, holo:true, shape:null, particles:"holo",
      desc:"Iridescent rainbow. All colours shift.",
      unlock:"Score 3 aces." },
    { id:"rainbow",     name:"Rainbow",       rarity:"legendary",
      color:null,      glow:null,     rainbow:true, shape:null, particles:"rainbow",
      desc:"Cycles every colour. Maximum chaos.",
      unlock:"Complete 36 holes." },
  ],

  // ─ Vilov Special exclusive ────────────────────────────────────────
  vilov: [
    { id:"vilov_spicy",  name:"🌶️ Spicy",    rarity:"epic",
      color:0xdd2200,  glow:0xff4400, shape:null, particles:"fire",
      desc:"Extra hot sausage. Fire trail.",
      unlock:"Always unlocked." },
    { id:"vilov_smoked", name:"🖤 Smoked",   rarity:"rare",
      color:0x553322,  glow:null,     shape:null, particles:"smoke",
      desc:"Hickory smoked. Smoke trail.",
      unlock:"Complete 6 holes." },
    { id:"vilov_giant",  name:"🎪 Festival", rarity:"legendary",
      color:0xcc4411,  glow:0xff8800, giant:true, shape:null, particles:"confetti",
      desc:"3× bigger! Festival sized!",
      unlock:"Score 5 aces." },
    { id:"vilov_gold",   name:"✨ Golden",   rarity:"legendary",
      color:0xffcc00,  glow:0xffaa00, metal:true, shape:null, particles:"sparks",
      desc:"Solid gold kolbász.",
      unlock:"Score 10 aces." },
  ],
};

var RARITY_COLORS = {
  common:    "#aaaaaa",
  rare:      "#4488ff",
  epic:      "#aa44ff",
  legendary: "#ffaa00",
  secret:    "#ff4444",
};

// Unlock conditions (checked in scored() and advanceHole())
var SKIN_UNLOCK_CONDITIONS = {
  gold:         { type:"holes_complete", count:5  },
  neon_pink:    { type:"ace",            count:1  },
  galaxy:       { type:"holes_complete", count:18 },
  fire:         { type:"hazard_hit",     count:10 },
  ice:          { type:"holes_complete", count:9  },
  toxic:        { type:"score_under_par",count:5  },
  holographic:  { type:"ace",            count:3  },
  rainbow:      { type:"holes_complete", count:36 },
  pizza:        { type:"free",           count:0  },
  sawblade:     { type:"holes_complete", count:3  },
  pancake:      { type:"free",           count:0  },
  banana:       { type:"free",           count:0  },
  ufo:          { type:"ace",            count:1  },
  coin:         { type:"free",           count:0  },
  keycap:       { type:"free",           count:0  },
  vilov_spicy:  { type:"free",           count:0  },
  vilov_smoked: { type:"holes_complete", count:6  },
  vilov_giant:  { type:"ace",            count:5  },
  vilov_gold:   { type:"ace",            count:10 },
};

// Active skin per disc type (persisted to localStorage)
var equippedSkins = {};
(function loadSkins() {
  try {
    var s = localStorage.getItem("diskgolfi_skins");
    if (s) equippedSkins = JSON.parse(s);
  } catch(e) {}
})();
function saveSkins() {
  try { localStorage.setItem("diskgolfi_skins", JSON.stringify(equippedSkins)); } catch(e) {}
}

// Unlocked skins (persisted)
var unlockedSkins = { classic:true, red:true, blue:true, green:true, black:true, white:true,
  pizza:true, pancake:true, banana:true, coin:true, keycap:true, chrome:true, carbon:true,
  vilov_spicy:true };  // free skins always unlocked
(function loadUnlocked() {
  try {
    var s = localStorage.getItem("diskgolfi_unlocked");
    if (s) { var u=JSON.parse(s); Object.assign(unlockedSkins, u); }
  } catch(e) {}
})();
function saveUnlocked() {
  try { localStorage.setItem("diskgolfi_unlocked", JSON.stringify(unlockedSkins)); } catch(e) {}
}

// ── BACKDOOR CODE to unlock all disc + player skins ─────────────────
// Type "TOYOTA" anywhere in the game to unlock everything
(function() {
  var _buf = "";
  var _code = "TOYOTA";
  window.addEventListener("keydown", function(e) {
    // Skip modifier-only keys and inputs so typing in a text field doesn't trigger
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key.length !== 1) return;
    _buf += e.key.toUpperCase();
    if (_buf.length > _code.length) _buf = _buf.slice(-_code.length);
    if (_buf === _code) {
      // Unlock all disc skins
      if (typeof DISC_SKINS !== "undefined") {
        (DISC_SKINS._global||[]).forEach(function(s){ unlockedSkins[s.id]=true; });
        (DISC_SKINS.vilov||[]).forEach(function(s){ unlockedSkins[s.id]=true; });
      }
      if (typeof saveUnlocked === "function") saveUnlocked();
      // Unlock all player skins
      if (typeof PLAYER_SKINS !== "undefined") {
        PLAYER_SKINS.forEach(function(s){ if (typeof unlockedPlayerSkins !== "undefined") unlockedPlayerSkins[s.id]=true; });
      }
      if (typeof saveUnlockedPlayerSkins === "function") saveUnlockedPlayerSkins();
      // Refresh open lockers if visible
      if (typeof _buildDlGrid === "function" && typeof _dlActiveDisc !== "undefined") _buildDlGrid(_dlActiveDisc);
      if (typeof _buildSkinGrid === "function") _buildSkinGrid();
      var msg = document.createElement("div");
      msg.textContent = "🚗 TOYOTA CODE — All disc & player skins unlocked!";
      msg.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a0500;border:3px solid #ff8800;color:#ffd580;padding:16px 28px;z-index:9999;font-family:'Bebas Neue',cursive;font-size:22px;letter-spacing:2px;pointer-events:none;box-shadow:4px 4px 0 #7a2800";
      document.body.appendChild(msg);
      setTimeout(function(){msg.remove();},3000);
      _buf = "";
    }
  });
})();