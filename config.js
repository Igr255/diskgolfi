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
  // The characters stand on their own origin (auto-placed on load); add an entry if one floats or sinks.
  "player_default": { feetLift: 0 },
  "skin_ghost":     { feetLift: 0.15 },
  "skin_runner":    { feetLift: 0.0 },
};
function _playerFeetLift(slotIdx, skinKey) {
  // If a skin key is provided, prefer its offset
  if (skinKey && MODEL_OFFSETS[skinKey] && MODEL_OFFSETS[skinKey].feetLift != null)
    return MODEL_OFFSETS[skinKey].feetLift;
  var key = "player_" + slotIdx;
  if (MODEL_OFFSETS[key] && MODEL_OFFSETS[key].feetLift != null) return MODEL_OFFSETS[key].feetLift;
  return (MODEL_OFFSETS["player_default"] && MODEL_OFFSETS["player_default"].feetLift) || 0;
}

// ── MULTIPLAYER NETWORKING ───────────────────────────────────────────────
// Players connect browser-to-browser (WebRTC). STUN lets that work on most
// home networks, but when one player is on mobile data, a strict router or a
// school/office network the direct link can't be made and a TURN relay is
// needed. Paste the credentials of any TURN service here (e.g. a free account
// at expressturn.com or metered.ca gives you urls + username + credential):
//
//   var TURN_SERVERS = [
//     { urls: "turn:YOUR.TURN.HOST:3478", username: "USER", credential: "PASS" },
//     { urls: "turn:YOUR.TURN.HOST:443?transport=tcp", username: "USER", credential: "PASS" },
//   ];
var TURN_SERVERS = [];
var PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
      { urls: "stun:stun.cloudflare.com:3478" },
    ].concat(TURN_SERVERS),
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

  // ── PLAYER MODELS ─────────────────────────────────────────────────────────
  // Every slot uses the animated BasePlayer rig; cosmetic variety comes from skins.
player_default: 'models/players/Adventurer.glb',
player_0: 'models/players/Adventurer.glb',
player_1: 'models/players/Adventurer.glb',
player_2: 'models/players/Adventurer.glb',
player_3: 'models/players/Adventurer.glb',
player_4: 'models/players/Adventurer.glb',

// ── PLAYER SKIN MODEL OVERRIDES ─────────────────────────────────────────
// These are cosmetic character skins the local player can equip in the Skin Locker.
// Each key matches a PLAYER_SKINS entry below. The GLB must behave exactly
// like BasePlayer.glb: T-pose at rest, Idle/Walk/Sprint/Jump/Grounded clips.
// Uncomment and provide your model path to activate a skin.
//
skin_runner:         'models/Animated Woman.glb',
// Quaternius character pack (CC0) + madtrollstudio Character Base (CC-BY 3.0) — see CREDITS.md
skin_adventurer:     'models/players/Adventurer.glb',
skin_man:            'models/players/Man.glb',
skin_casual:         'models/players/Woman Casual.glb',
skin_dress:          'models/players/Woman Dress.glb',
skin_business:       'models/players/Business Man.glb',
skin_hoodie:         'models/players/Hoodie Character.glb',
skin_punk:           'models/players/Punk.glb',
skin_worker:         'models/players/Worker.glb',
skin_swat:           'models/players/SWAT.glb',
skin_astronaut:      'models/players/Astronaut.glb',
skin_farmer:         'models/players/Farmer.glb',
skin_beach:          'models/players/Beach Character.glb',
skin_king:           'models/players/King.glb',
skin_suit:           'models/players/Suit.glb',
skin_mannequin:      'models/players/Character Base.glb',
skin_ghost:          'models/players/Rubber Duck.glb',

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
  // ↓ Active overrides below ↓
  // Only models that actually depict the obstacle are mapped. Everything else
  // uses its themed procedural model (e.g. toilets are toilets, not ponds).
  // ────────────────────────────────────────────────────────────────────

// NATURE / UNIVERSAL
tree:           'models/Tree.glb',
pinetree:       'models/Pine Tree.glb',
xmastree:       'models/Christmas Tree.glb',
rock:           'models/Rock Large.glb',
mtnpeak:        'models/Mountain.glb',

// EERIE / FUNNY
furry:          'models/Rooster.glb',
tractor:        'models/Tractor.glb',
entity:         'models/Ghoooooost.glb',
screamer:       'models/Chick.glb',
spike:          'models/Spikes.glb',
arrow:          'models/Arrow Sign.glb',

// GEOMETRY DASH
geoblock:       'models/Blocks.glb',

// CITY
car:            'models/Car.glb',
skyscraper:     'models/Skyscraper.glb',

// FEET / BUNNIES
bunny:          'models/Bunny.glb',

// DISCO
booth:          'models/DJgear.glb',
helmet:         'models/Boombox.glb',

// MOON
moonrock:       'models/Rock.glb',

// CABBAGE / GARDEN
cabbage:        'models/Cabbage.glb',

// TORNADO
tornado:        'models/Tornado.glb',

// GRAND CANYON
canyon:         'models/Mountain.glb',

// SKYBLOCK
sb_crate:       'models/Blocks.glb',

// VET SCHOOL
shiba_inu:      'models/Shiba Inu.glb',
animated_woman: 'models/Animated Woman.glb',

// LIVING OBSTACLES (entities.js rescales these itself)
chick:          'models/Chick.glb',
robot:          'models/Robot.glb',
duck:           'models/players/Rubber Duck.glb',
cube:           'models/Portal_ Companion Cube.glb',

// VEHICLES
celica:         'models/Celica.glb',

// ISLANDS — generated procedurally in graphics.js (textured tops, rocky cliffs,
// wind-swayed grass), so Island.glb / Island2.glb are no longer used.
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
      if (MODEL_CONFIG[key]) _cfg = MODEL_CONFIG[key];   // per-model override (e.g. slimmer, realistic characters)
      else if (key.startsWith("player_") || key === "player_default" || key.startsWith("skin_")) _cfg = MODEL_CONFIG.player;
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
        // characters must stand on their own origin (some exports are offset to the side)
        if (key.startsWith("skin_") || key.startsWith("player_")) {
          var _cx = (_bbox2.min.x + _bbox2.max.x) / 2, _cz = (_bbox2.min.z + _bbox2.max.z) / 2;
          if (Math.abs(_cx) > 0.05) group.position.x -= _cx;
          if (Math.abs(_cz) > 0.05) group.position.z -= _cz;
        }
        console.log("DiskGolfi: auto-scaled '" + key + "' to " + _target + "m (was " + _tallest.toFixed(2) + "m)");
      }

      // Store raw animation clips on source — DO NOT create mixer here.
      // Each clone gets its own mixer in _cloneGLB so bones are correct.
      if (gltf.animations && gltf.animations.length > 0) {
        group.userData.animations = gltf.animations;  // raw clips only
        _synthPoseClips(group);                       // add Jump / Sit to rigs that ship without them
        _measureStrides(group);                       // natural ground speed of each walk / run clip (stops foot sliding)
      }
      if (typeof GFX !== "undefined" && GFX.fixGLBMaterials) GFX.fixGLBMaterials(group);
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

// ── Generated pose clips ─────────────────────────────────────────────────────
// The poly.pizza characters (Quaternius "CharacterArmature" rig) have no Jump or
// Sit clip. Build them from the rig itself: start from the Idle pose, rotate limbs
// in model space (so odd bone axes don't matter) and bake the result as keyframes.
// Their feet are IK bones parented to the root, so they are carried along with the shins.
function _synthPoseClips(root) {
  var clips = root.userData.animations || [];
  var wantJump = !clips.some(function(c) { return /jump/i.test(c.name); });
  var wantSit = !clips.some(function(c) { return /sit_?idle/i.test(c.name); });   // "Man_Sitting" is a sit-down sequence, not a held pose
  if (!wantJump && !wantSit) return;
  var S = THREE.PropertyBinding.sanitizeNodeName, B = {}, bones = [];
  root.traverse(function(o) { if (o.isBone) { B[o.name] = o; bones.push(o); } });
  var bn = function(n) { return B[S(n)]; };
  if (!["UpperLeg.L", "UpperLeg.R", "LowerLeg.L", "LowerLeg.R", "UpperArm.L", "UpperArm.R"].every(bn)) return;
  var idle = clips.find(function(c) { return /\|idle$/i.test(c.name); }) || clips.find(function(c) { return /idle/i.test(c.name); });
  if (!idle) return;
  var orig = bones.map(function(b) { return [b.quaternion.clone(), b.position.clone()]; });
  var mixer = new THREE.AnimationMixer(root); mixer.clipAction(idle).play(); mixer.update(0);
  root.updateMatrixWorld(true);
  var idleL = bones.map(function(b) { return [b.quaternion.clone(), b.position.clone()]; });
  var V = function() { return new THREE.Vector3(); }, Q = function() { return new THREE.Quaternion(); };
  var idleWQ = {}, idleWP = {};
  bones.forEach(function(b) { idleWQ[b.name] = b.getWorldQuaternion(Q()); idleWP[b.name] = b.getWorldPosition(V()); });
  var rq = root.getWorldQuaternion(Q()), rqi = rq.clone().invert();
  var inRoot = function(v) { return v.clone().sub(root.getWorldPosition(V())).applyQuaternion(rqi); };
  // which way is forward (toe vs ankle) and which side is .L
  var fA = bn("Foot.L"), fT = bn("Foot.L_end");
  var f = fA && fT ? (Math.sign(inRoot(idleWP[fT.name]).z - inRoot(idleWP[fA.name]).z) || 1) : 1;
  var sL = Math.sign(inRoot(idleWP[bn("UpperArm.L").name]).x) || 1;
  var X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);

  function pose(spec, bodyDrop) {
    bones.forEach(function(b, i) { b.quaternion.copy(idleL[i][0]); b.position.copy(idleL[i][1]); });
    root.updateMatrixWorld(true);
    var body = bn("Body") || bn("Hips");
    if (bodyDrop && body) { var p = idleWP[body.name].clone(); p.y -= bodyDrop; body.position.copy(body.parent.worldToLocal(p)); body.updateMatrixWorld(true); }
    var deltaW = {};
    bones.forEach(function(b) {
      var d = spec[b.name]; if (!d) return;
      var dq = Q(); d.forEach(function(r) { dq.premultiply(Q().setFromAxisAngle(r[0], r[1])); });
      var dw = rq.clone().multiply(dq).multiply(rqi); deltaW[b.name] = dw;
      var target = dw.clone().multiply(idleWQ[b.name]);
      b.quaternion.copy(b.parent.getWorldQuaternion(Q()).invert().multiply(target));
      b.updateMatrixWorld(true);
    });
    // IK feet follow their shins
    ["L", "R"].forEach(function(s) {
      var foot = bn("Foot." + s), shin = bn("LowerLeg." + s), end = bn("LowerLeg." + s + "_end") || shin;
      if (!foot || foot.parent === end || foot.parent === shin) return;
      var dw = shin.getWorldQuaternion(Q()).multiply(idleWQ[shin.name].clone().invert());
      var wp = end.getWorldPosition(V()).add(idleWP[foot.name].clone().sub(idleWP[end.name]).applyQuaternion(dw));
      foot.position.copy(foot.parent.worldToLocal(wp));
      foot.quaternion.copy(foot.parent.getWorldQuaternion(Q()).invert().multiply(dw.multiply(idleWQ[foot.name])));
      foot.updateMatrixWorld(true);
    });
    return bones.map(function(b) { return [b.quaternion.clone(), b.position.clone()]; });
  }
  function bake(name, frames) {   // frames: [{t, s}] with s a pose snapshot
    var tracks = [];
    bones.forEach(function(b, i) {
      var moved = frames.some(function(fr) { return fr.s[i][0].angleTo(idleL[i][0]) > 1e-4 || fr.s[i][1].distanceToSquared(idleL[i][1]) > 1e-8; });
      var times = frames.map(function(fr) { return fr.t; });
      var qv = [], pv = [];
      frames.forEach(function(fr) { fr.s[i][0].toArray(qv, qv.length); fr.s[i][1].toArray(pv, pv.length); });
      tracks.push(new THREE.QuaternionKeyframeTrack(b.name + ".quaternion", times, qv));
      if (moved) tracks.push(new THREE.VectorKeyframeTrack(b.name + ".position", times, pv));
    });
    clips.push(new THREE.AnimationClip(name, -1, tracks));
  }
  var blend = function(a, b, k) { return a.map(function(e, i) { return [e[0].clone().slerp(b[i][0], k), e[1].clone().lerp(b[i][1], k)]; }); };
  var L = function(n) { return S(n); }, spec;
  if (wantJump) {
    spec = {};
    spec[L("UpperLeg.L")] = [[X, -1.25 * f]]; spec[L("LowerLeg.L")] = [[X, 0.55 * f]];
    spec[L("UpperLeg.R")] = [[X, -0.45 * f]]; spec[L("LowerLeg.R")] = [[X, 0.85 * f]];
    spec[L("UpperArm.L")] = [[Z, 2.25 * sL], [X, -0.35 * f]]; spec[L("UpperArm.R")] = [[Z, -2.25 * sL], [X, -0.35 * f]];
    if (bn("Torso")) spec[L("Torso")] = [[X, 0.12 * f]];
    var jp = pose(spec), id0 = idleL;
    bake("Generated|Jump", [{ t: 0, s: blend(id0, jp, 0.45) }, { t: 0.16, s: jp }, { t: 0.9, s: jp }]);
  }
  if (wantSit) {
    // hips come down to knee height so thighs lie flat and shins hang to the floor
    var thigh = bn("UpperLeg.L"), shinB = bn("LowerLeg.L"), shinE = bn("LowerLeg.L_end") || shinB;
    var hipY = idleWP[thigh.name].y;
    var shinLen = idleWP[shinB.name].distanceTo(idleWP[shinE.name]), ankleY = idleWP[shinE.name].y - root.getWorldPosition(V()).y;
    var drop = Math.max(0, hipY - root.getWorldPosition(V()).y - (ankleY + shinLen));
    spec = {};
    [["L", 1], ["R", -1]].forEach(function(e) {
      spec[L("UpperLeg." + e[0])] = [[X, -1.5 * f], [new THREE.Vector3(0, 1, 0), 0.08 * e[1] * sL]];
      spec[L("LowerLeg." + e[0])] = [[X, -0.12 * f]];
      spec[L("UpperArm." + e[0])] = [[X, -1.0 * f], [Z, -0.22 * e[1] * sL]];
      if (bn("LowerArm." + e[0])) spec[L("LowerArm." + e[0])] = [[X, -1.45 * f], [Z, -0.3 * e[1] * sL]];
    });
    var sp = pose(spec, drop);
    bake("Generated|SitIdle", [{ t: 0, s: sp }, { t: 1, s: sp }]);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(root);
  bones.forEach(function(b, i) { b.quaternion.copy(orig[i][0]); b.position.copy(orig[i][1]); });
  root.updateMatrixWorld(true);
}

// How fast does each locomotion clip move over the ground? Track the feet through one
// cycle: in a stride the planted foot travels backwards by the step length during half
// the cycle, so speed ≈ 2 × foot travel / duration. Used to time-scale clips to the
// character's real speed (no more moon-walking).
function _measureStrides(root) {
  var clips = root.userData.animations || [], out = {};
  var feet = []; root.traverse(function(o) { if (o.isBone && /(foot|toe)/i.test(o.name) && !/end|pole|^pt/i.test(o.name)) feet.push(o); });
  if (!feet.length) { root.userData.clipSpeed = out; root.userData.strideScale = root.scale.x; return; }
  var mixer = new THREE.AnimationMixer(root), orig = [];
  root.traverse(function(o) { if (o.isBone) orig.push([o, o.quaternion.clone(), o.position.clone()]); });
  clips.forEach(function(clip) {
    if (!/walk|run|sprint|jog|gallop/i.test(clip.name) || /left|right|back|jump|shoot/i.test(clip.name)) return;
    mixer.stopAllAction(); var act = mixer.clipAction(clip); act.reset().play();
    // Track every foot through the cycle; while a foot is planted (near its lowest point)
    // it slides backwards at exactly the speed the body should travel over the ground.
    var N = 48, vs = [];
    var tr = feet.map(function() { return []; }), v = new THREE.Vector3();
    for (var i = 0; i <= N; i++) {
      mixer.setTime(clip.duration * i / N); root.updateMatrixWorld(true);
      feet.forEach(function(f, k) { f.getWorldPosition(v); var l = root.worldToLocal(v.clone()); tr[k].push([l.y * root.scale.y, l.z * root.scale.z]); });
    }
    tr.forEach(function(path) {
      var lo = Math.min.apply(null, path.map(function(q) { return q[0]; })), hi = Math.max.apply(null, path.map(function(q) { return q[0]; }));
      var band = lo + Math.max(0.02, (hi - lo) * 0.12), dtS = clip.duration / N;
      for (var i2 = 1; i2 < path.length; i2++) if (path[i2][0] < band && path[i2 - 1][0] < band) vs.push(-(path[i2][1] - path[i2 - 1][1]) / dtS);
    });
    vs = vs.filter(function(x) { return x > 0; }).sort(function(a, b) { return a - b; });
    if (vs.length >= 3 && clip.duration > 0) out[clip.name] = vs[vs.length >> 1];
  });
  mixer.stopAllAction(); mixer.uncacheRoot(root);
  orig.forEach(function(e) { e[0].quaternion.copy(e[1]); e[0].position.copy(e[2]); });
  root.updateMatrixWorld(true);
  root.userData.clipSpeed = out; root.userData.strideScale = root.scale.x;
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
    clone.userData.clipSpeed = src.userData.clipSpeed || {}; clone.userData.strideScale = src.userData.strideScale || clone.scale.x;
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
    speed: 5, launchMult: 0.85, glide: 3, lift: 0.04, drag: 0.92, turn: 0.001,
    fade: 0.008, bounce: 0.08, groundSkip: 0.05, stability: 1.5, maxSpin: 7, maxAirtime: 7,
    minPower: 0.0, maxPower: 0.55, optimalPow: 0.35,
    color: 0xffff44, label: "Putter", icon: "🟡",
    desc: "Dead-straight at low power. Unreliable above 55%.",
    tip: "Best: 20-55% power. Basket putts + short hops.",
  },
  midrange: {
    // All-rounder — works at any power, predictable fade, good for gap shots
    speed: 7, launchMult: 1.0, glide: 5, lift: 0.035, drag: 0.86, turn: 0.008,
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
  player:       { targetHeight: 2.0 },   // standing player height in world units
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
  tornado:        { targetHeight: 8.0  },
  furry:          { targetHeight: 3.4  },
  entity:         { targetHeight: 4.0  },
  bunny:          { targetHeight: 4.0  },
  cabbage:        { targetHeight: 1.6  },
  booth:          { targetHeight: 1.8  },
  helmet:         { targetHeight: 1.6  },
  geoblock:       { targetHeight: 2.0  },
  sb_crate:       { targetHeight: 1.5  },
  spike:          { targetHeight: 1.6  },
  screamer:       { targetHeight: 2.6  },
  arrow:          { targetHeight: 2.4  },
  poolroom_sign:  { targetHeight: 2.4  },
  shiba_inu:      { targetHeight: 3.5  },  // 2.5× game scale so dog is clearly visible
  animated_woman: { targetHeight: 5.16 },  // 3× scale
  celica:         { targetHeight: 7.16 },
  // realistic-proportion characters read small next to the chunky ones at the same height
  skin_adventurer: { targetHeight: 2.0 },
  skin_man: { targetHeight: 2.0 },
  skin_casual: { targetHeight: 2.0 },
  skin_dress: { targetHeight: 2.0 },
  skin_business: { targetHeight: 2.0 },
  skin_hoodie: { targetHeight: 2.0 },
  skin_punk: { targetHeight: 2.0 },
  skin_worker: { targetHeight: 2.0 },
  skin_swat: { targetHeight: 2.0 },
  skin_astronaut: { targetHeight: 2.0 },
  skin_farmer: { targetHeight: 2.0 },
  skin_beach: { targetHeight: 2.0 },
  skin_king: { targetHeight: 2.0 },
  skin_suit: { targetHeight: 2.0 },
  skin_mannequin: { targetHeight: 2.0 },  // longest side: a 4.62 m coupe at 1.55× (sized for the game's chunky characters)
};

var MAX_PLAYERS = 8;
var PLAYER_COLORS = [0x00ffff, 0xff00ff, 0xffff00, 0xff6600, 0x00ff88, 0x8a6aff, 0xff4a6a, 0x6affd8];
var PLAYER_DISC_TYPES = ["driver", "midrange", "putter", "driver", "midrange", "putter", "driver", "midrange"];

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
  // Every character is playable from the start. They all walk, run and jump.
  { id: "runner",   name: "Runner",       icon: "🏃", modelKey: "skin_runner",   color: 0x8affc0, unlock: "", free: true, blurb: "Always in a hurry" },
  { id: "duck",     name: "Rubber Duck",  icon: "🦆", modelKey: "skin_ghost",    color: 0xffee00, unlock: "", free: true, blurb: "Hops everywhere", staticSkin: true },
  { id: "adventurer", name: "Adventurer", icon: "🧭", modelKey: "skin_adventurer", color: null, unlock: "", free: true, blurb: "Off the beaten path" },
  { id: "man", name: "Dave", icon: "🙂", modelKey: "skin_man", color: null, unlock: "", free: true, blurb: "Just here for the vibes" },
  { id: "casual", name: "Jess", icon: "👩", modelKey: "skin_casual", color: null, unlock: "", free: true, blurb: "Brunch, then 18 holes" },
  { id: "dress", name: "Rose", icon: "👗", modelKey: "skin_dress", color: null, unlock: "", free: true, blurb: "Dressed for the clubhouse" },
  { id: "business", name: "Business Man", icon: "💼", modelKey: "skin_business", color: null, unlock: "", free: true, blurb: "Should be in a meeting" },
  { id: "hoodie", name: "Hoodie", icon: "🧥", modelKey: "skin_hoodie", color: null, unlock: "", free: true, blurb: "Comfy and dangerous" },
  { id: "punk", name: "Punk", icon: "🤘", modelKey: "skin_punk", color: null, unlock: "", free: true, blurb: "Throws hyzer, lives anhyzer" },
  { id: "worker", name: "Worker", icon: "👷", modelKey: "skin_worker", color: null, unlock: "", free: true, blurb: "On a very long break" },
  { id: "swat", name: "SWAT", icon: "🛡️", modelKey: "skin_swat", color: null, unlock: "", free: true, blurb: "Tactical putting" },
  { id: "astronaut", name: "Astronaut", icon: "🧑‍🚀", modelKey: "skin_astronaut", color: null, unlock: "", free: true, blurb: "Low-gravity specialist" },
  { id: "farmer", name: "Farmer", icon: "🌾", modelKey: "skin_farmer", color: null, unlock: "", free: true, blurb: "Fresh from the cabbage patch" },
  { id: "beach", name: "Beach Bum", icon: "🩴", modelKey: "skin_beach", color: null, unlock: "", free: true, blurb: "Flip-flops are valid footwear" },
  { id: "king", name: "The King", icon: "👑", modelKey: "skin_king", color: null, unlock: "", free: true, blurb: "Rules the fairway" },
  { id: "suit", name: "Agent", icon: "🕴️", modelKey: "skin_suit", color: null, unlock: "", free: true, blurb: "Licensed to putt" },
  { id: "mannequin", name: "Mannequin", icon: "🗿", modelKey: "skin_mannequin", color: null, unlock: "", free: true, blurb: "Hops everywhere", staticSkin: true },
];
// Master backdoor: unlocks ALL skins at once
var PLAYER_SKINS_MASTER_CODE = "TOYOTA";

// Active player skin (persisted)
var equippedPlayerSkin = "adventurer";
(function() {
  try { var s = localStorage.getItem("dg_player_skin"); if (s) equippedPlayerSkin = s; } catch(e) {}
  // retired characters (the old blocky rig) → the default adventurer
  if (!PLAYER_SKINS.some(function(p) { return p.id === equippedPlayerSkin; })) equippedPlayerSkin = "adventurer";
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
  try {
    var _st = JSON.parse(localStorage.getItem("diskgolfi_unlocked") || "{}");
    Object.keys(_st).forEach(function(k) { if (_st[k]) unlockedSkins[k] = true; });   // keep what another tab unlocked
    localStorage.setItem("diskgolfi_unlocked", JSON.stringify(unlockedSkins));
  } catch(e) {}
}

// ── BACKDOOR CODE to unlock all disc + player skins ─────────────────
// Type "TOYOTA" anywhere in the game to unlock everything
(function() {
  var _buf = "";
  var _code = "TOYOTA";
  var _drip = "DRIPCHECK";
  window.addEventListener("keydown", function(e) {
    // Skip modifier-only keys and inputs so typing in a text field doesn't trigger
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key.length !== 1) return;
    _buf += e.key.toUpperCase();
    if (_buf.length > 12) _buf = _buf.slice(-12);
    if (_buf.slice(-_drip.length) === _drip && typeof COS !== "undefined") {
      COS.unlockAll(); _buf = "";
      var dm = document.createElement("div"); dm.textContent = "💧 Drip check passed — every cosmetic unlocked!"; dm.className = "toast";
      document.body.appendChild(dm); setTimeout(function(){ dm.remove(); }, 3200);
      return;
    }
    if (_buf.slice(-_code.length) === _code) {
      if (typeof COS !== "undefined") COS.unlockAll();
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
      msg.textContent = "🚗 Everything unlocked — enjoy!";
      msg.className = "toast";
      document.body.appendChild(msg);
      setTimeout(function(){msg.remove();},3000);
      _buf = "";
    }
  });
})();