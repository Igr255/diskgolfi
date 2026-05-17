// ── MULTIPLAYER — STAR TOPOLOGY (host relays everything) ─────────────────────
// Depends on: config.js (PEER_CONFIG, MAX_PLAYERS, PLAYER_DISC_TYPES),
//             game globals, ui.js, game.js

// ── Safe JSON serialiser — strips ALL Three.js objects from payloads ──
// Three.js Mesh/Bone/Skeleton objects have circular parent references
// that cause infinite recursion in JSON.stringify. Use this replacer
// on every network message to guarantee safe serialisation.
function _netReplacer(key, val) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  // Strip any Three.js scene-graph object (has isObject3D, or THREE-specific flags)
  if (val.isObject3D   || val.isMesh      || val.isGeometry  ||
      val.isMaterial   || val.isTexture   || val.isCamera    ||
      val.isLight      || val.isSkeleton  || val.isAnimationClip ||
      val.isBufferGeometry || val.isBufferAttribute) {
    return undefined;  // excluded from output
  }
  // Strip THREE.Vector3 / Quaternion — send as plain numbers elsewhere
  if (typeof val.x === 'number' && typeof val.y === 'number' &&
      typeof val.z === 'number' && typeof val.isVector3 !== 'undefined') {
    return { x: val.x, y: val.y, z: val.z };
  }
  return val;
}

function _destroyPeer(cb) {
  if (!peer) { cb(); return; }
  try { peer.off("error"); peer.off("open"); peer.off("connection"); peer.destroy(); } catch(e) {}
  peer = null;
  setTimeout(cb, 180);
}

var _hostRawCode = "";  // persists the lobby code for 3D lobby display

function sendToAll(data) {
  const raw = JSON.stringify(data, _netReplacer);
  if (myIdx === 0) {
    conns.forEach((c) => { if (c && c.open) c.send(raw); });
  } else if (conns[0] && conns[0].open) {
    conns[0].send(raw);
  }
}

function sendTo(idx, data) {
  const raw = JSON.stringify(data, _netReplacer);
  if (myIdx === 0 && conns[idx] && conns[idx].open) conns[idx].send(raw);
}

function setupConnForPlayer(c, pIdx) {
  c.on("data", (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.from === undefined) msg.from = pIdx;
      handleMsg(msg);
      if (myIdx === 0) {
        const relayed = JSON.stringify(msg, _netReplacer);
        conns.forEach((oc, oi) => { if (oi !== pIdx && oc && oc.open) oc.send(relayed); });
      }
    } catch (e) {}
  });
  c.on("close", () => {
    var dName = playerNames[pIdx] || ("Player " + (pIdx+1));
    conns[pIdx] = null;
    if (pIdx === 0 && myIdx !== 0) {
      // Host disconnected — show and return to menu
      showMsg("HOST LEFT", "The host disconnected. Returning to menu.", null);
      setTimeout(function() {
        document.getElementById("menu").style.display = "flex";
        document.getElementById("ui").style.display   = "none";
        mpMode = false; hostGameStarted = false;
        if (peer) { try { peer.destroy(); } catch(e) {} peer = null; }
        conns.fill(null);
      }, 3000);
    } else {
      // Player left — update count and notify
      playerCount = conns.filter(Boolean).length + 1;  // +1 for self
      showMsg("PLAYER LEFT", dName + " disconnected.", null);
      setTimeout(hideMsg, 3000);
      // Re-check if all remaining are done
      if (typeof checkAllDone === "function") checkAllDone();
    }
  });
}

function handleMsg(msg) {
  const from = msg.from !== undefined ? msg.from : 1;

  if (msg.t === "start") {
    myIdx        = msg.myIdx;
    playerCount  = msg.playerCount;
    playerNames  = msg.names || playerNames;
    matchSeed    = msg.matchSeed;
    HOLES        = msg.holes || [];
    mpMode       = true;
    if (msg.activeThemes !== undefined) ACTIVE_THEMES = msg.activeThemes;
    if (msg.hostSkins) {
      Object.keys(msg.hostSkins).forEach(function(k) {
        equippedSkins["p0_"+k] = msg.hostSkins[k];
      });
    }
    if (msg.remoteSkins) window._remoteSkins = msg.remoteSkins;
    if (msg.holeCount)  HOLE_COUNT = msg.holeCount;
    if (msg.difficulty) DIFFICULTY = msg.difficulty;
    if (msg.weather) setWeather(msg.weather);
    const wl = document.getElementById("waiting-lobby");
    if (wl) wl.remove();
    document.getElementById("menu").style.display      = "none";
    document.getElementById("ui").style.display        = "block";
    document.getElementById("mp-scores").style.display = "flex";
    document.getElementById("scorecard").style.display = "none";
    holeIdx = 0;
    holeScores = new Array(200).fill(null);
    totalVsPar = 0;
    mpTotals.fill(0);
    playerDone.fill(false);
    playerThrows.fill(0);
    mpScoreRecorded.fill(false);
    _destroyLobby3D();
    var _wlD = document.getElementById("waiting-lobby");
    if (_wlD) _wlD.remove();
    loadHole(0);
    buildScoreboardUI();
    updateMpUI();

  } else if (msg.t === "pos") {
    var _rp2=remotePlayers[from];
    if(_rp2){
      // Don't override position while they're mid-punch-flight — stepDisc drives it
      if (!_rp2.flying) { _rp2.targetX=msg.px; _rp2.targetZ=msg.pz; }
      else              { /* punched — let physics run */ }
      if(typeof msg.aim==="number") _rp2.aimAngle=msg.aim;
      if(typeof msg.yaw==="number") _rp2.targetYaw=msg.yaw;
      if(typeof msg.vm==="number")  _rp2.velMag=msg.vm;
      // Walk animation is driven every frame in physics.js — no need to trigger here
    }
  } else if (msg.t === "throw") {
    const rp = remotePlayers[from];
    if (rp) {
      rp.discPos.set(msg.px, msg.py, msg.pz);
      rp.discVel.set(msg.vx, msg.vy, msg.vz);
      rp.spin    = Math.hypot(msg.vx, msg.vz) * 3;
      rp.flying  = true;
    }

  } else if (msg.t === "land") {
    const rp = remotePlayers[from];
    if (rp) {
      rp.flying = false;
      rp.discPos.set(msg.px, msg.py, msg.pz);
      if (rp.discMesh) rp.discMesh.position.copy(rp.discPos);
    }

  } else if (msg.t === "my_name") {
    if (from > 0 && from < playerNames.length) {
      playerNames[from] = msg.name || ("Player " + (from+1));
      // Store their skin so we can use it when building their avatar
      if (!window._remoteSkins) window._remoteSkins = {};
      window._remoteSkins[from] = msg.playerSkin || "default";
      if (myIdx === 0) {
        conns.forEach((oc, oi) => { if (oc && oc.open) oc.send(JSON.stringify({ t:"player_joined", playerCount, names:playerNames }, _netReplacer)); });
      }
      updateLobbyUI();
      // Rebuild lobby avatars so the new player's skin is applied
      if (typeof _update3DLobbyPlayers === "function") _update3DLobbyPlayers();
    }

  } else if (msg.t === "lobby_pos") {
    // Update the remote avatar's position inside the 3D lobby
    if (_lobby3D && msg.from !== myIdx) {
      // Find the avatar for this player
      var _lpAv = null;
      if (_lobby3D.avatars) {
        _lobby3D.avatars.forEach(function(av) {
          if (av && av.playerIdx === msg.from) _lpAv = av;
        });
      }
      if (_lpAv) {
        _lpAv._netX    = msg.px;
        _lpAv._netZ    = msg.pz;
        _lpAv._netYaw  = msg.yaw;
        _lpAv._netWalk = !!msg.walk;
      }
    }

  } else if (msg.t === "weather_sync") {
    if (typeof setWeather === "function") setWeather(msg.weather);

  } else if (msg.t === "punch_launch") {
    var _vx = msg.vx || 0, _vy = msg.vy || 5.0, _vz = msg.vz || 0;
    var _px = msg.px || 0, _py = msg.py || 2,  _pz = msg.pz || 0;
    var _stg = msg.stagger || 1.1;

    if (msg.target === myIdx) {
      // WE got punched — slide our player body, no disc launch
      if (typeof _applyPunchToLocalPlayer === "function") {
        _applyPunchToLocalPlayer(_vx, _vy, _vz, _px, _py, _pz, _stg);
      }
    } else if (remotePlayers[msg.target]) {
      // Observer — knockback the remote player's avatar position (NOT disc flight)
      var _rp = remotePlayers[msg.target];
      _rp.discPos.set(_px, _py, _pz);
      // Store knockback velocity on the remote player — physics.js drains it
      _rp.punchKnockVelX = _vx * 0.22;
      _rp.punchKnockVelZ = _vz * 0.22;
      _rp.punchStagger   = _stg;
      _rp.punchImmunity  = _stg + 0.2;
      _rp.punchKnockDir  = { x: msg.dx || 0, z: msg.dz || 0 };
      // Do NOT set rp.flying — we don't want to trigger disc flight simulation
      if (_rp.avatarMesh && typeof switchAvatarAnim === "function") {
        switchAvatarAnim(_rp.avatarMesh, "jump");
      }
      if (typeof _spawnBonkText === "function") _spawnBonkText(_rp.discPos.clone());
    }
    if (msg.target !== myIdx && typeof _screenShake !== "undefined") {
      _screenShake = 0.15; _screenShakeT = 0.2;
    }

  } else if (msg.t === "punch") {
    // Legacy fallback
    if (msg.target === myIdx) {
      if (typeof _applyPunchToLocalPlayer === "function") {
        _applyPunchToLocalPlayer((msg.dx||1)*(msg.impulse||14), 5.0, (msg.dz||0)*(msg.impulse||14),
          discPos.x, discPos.y, discPos.z, 1.1);
      }
    } else if (remotePlayers[msg.target]) {
      var _rlp = remotePlayers[msg.target];
      _rlp.punchStagger = 1.1; _rlp.punchImmunity = 1.3;
    }
  } else if (msg.t === "give_up_force_next") {
    if (myIdx === 0) hostForceNext();

  } else if (msg.t === "game_over") {
    showMsg("GAME OVER!", "All " + HOLE_COUNT + " holes complete!", null);
    setTimeout(function() {
      hideMsg();
      document.getElementById("menu").style.display = "flex";
      document.getElementById("ui").style.display   = "none";
      phase = "MENU";
    }, 4000);

  } else if (msg.t === "throw_skin") {
    // Remote player threw — update their skin for this throw
    if (typeof equippedSkins !== "undefined") {
      equippedSkins["p"+from+"_"+msg.disc] = msg.skin;
    }

  } else if (msg.t === "skin_equip") {
    if (typeof equippedSkins !== "undefined" && msg.from !== undefined) {
      equippedSkins["p"+msg.from+"_"+msg.disc] = msg.skin;
    }

  } else if (msg.t === "score" || msg.t === "givenup") {
    playerDone[from]   = true;
    playerThrows[from] = msg.throws;
    if (!mpScoreRecorded[from] && HOLES[holeIdx]) {
      mpTotals[from] += msg.throws - HOLES[holeIdx].par;
      mpScoreRecorded[from] = true;
    }
    updateMpUI();
    checkAllDone();

  } else if (msg.t === "give_up_vote_start") {
    if (giveUpProposed) return;
    giveUpProposed = true;
    giveUpVotes = {};
    giveUpVotes[msg.from] = true;
    if (typeof _renderGiveUpUI === "function") _renderGiveUpUI();
    if (typeof _startGiveUpTimer === "function") _startGiveUpTimer();

  } else if (msg.t === "give_up_vote") {
    giveUpVotes[from] = msg.yes;
    checkGiveUpVotes();

  } else if (msg.t === "obstacle_layout") {
    // Client receives host's obstacle layout — skip re-generating obstacles
    // and rebuild from host data (applied after loadHole via flag)
    window._pendingObstacles = { holeIdx: msg.holeIdx, obs: msg.obstacles };

  } else if (msg.t === "next") {
    loadHole(msg.hole);
    // Show level name from host
    if (msg.themeName || msg.templateLabel) {
      var _hTxt2 = document.getElementById("hole-theme-txt");
      if (_hTxt2) {
        var _thN = msg.themeName ? msg.themeName.charAt(0).toUpperCase()+msg.themeName.slice(1) : "";
        _hTxt2.textContent = msg.templateLabel ? _thN + " · " + msg.templateLabel : _thN;
      }
    }

  } else if (msg.t === "player_joined") {
    if (msg.yourIdx !== undefined) myIdx = msg.yourIdx;
    playerCount = msg.playerCount;
    if (msg.names) playerNames = msg.names;
    // Store skin map from host so we can display everyone's skin in lobby
    if (msg.allSkins) window._remoteSkins = msg.allSkins;
    // Also store our own skin so host can see it
    if (!window._remoteSkins) window._remoteSkins = {};
    window._remoteSkins[myIdx] = (typeof equippedPlayerSkin !== "undefined") ? equippedPlayerSkin : "default";
    document.getElementById("menu").style.display = "none";
    document.getElementById("ui").style.display   = "none";
    var wl = document.getElementById("waiting-lobby");
    if (!wl) {
      wl = document.createElement("div");
      wl.id = "waiting-lobby";
      wl.style.cssText = "position:fixed;inset:0;z-index:200;overflow:hidden;";
      document.body.appendChild(wl);
      if (typeof _build3DLobby === "function") _build3DLobby(wl);
    } else if (typeof _update3DLobbyPlayers === "function") {
      _update3DLobbyPlayers();
    }
  }
}

function checkAllDone() {
  const allDone = playerDone.slice(0, playerCount).every((d) => d);
  if (!allDone || !myHoleDone) return false;
  setSpectating(false);

  const myT   = playerThrows[myIdx];
  const sorted = Array.from({ length: playerCount }, (_, i) => ({ i, t: playerThrows[i] })).sort((a, b) => a.t - b.t);
  const best  = sorted[0];
  const sub   = sorted.map((r) => `${playerNames[r.i].split(" ")[0]}: ${r.t}`).join("  ");
  const big   = best.i === myIdx ? "HOLE WON!" : myT === best.t ? "TIE!" : "HOLE LOST";
  showMsg(big, sub, null);
  updateMpUI();

  if (myIdx === 0) {
    setTimeout(() => {
      hideMsg();
      const next = holeIdx + 1;
      if (next >= HOLE_COUNT) {
        // MP game over — inform all
        sendToAll({ t: "game_over", totals: mpTotals, names: playerNames });
        showMsg("GAME OVER!", "All " + HOLE_COUNT + " holes complete!", null);
        setTimeout(() => {
          hideMsg();
          document.getElementById("menu").style.display = "flex";
          document.getElementById("ui").style.display   = "none";
          phase = "MENU";
        }, 4000);
        return;
      }
      holeIdx = next;
      seedRNG(matchSeed + next * 7331);
      HOLES[next] = generateHole(next + 1);
      var _nextHole = HOLES[next];
      sendToAll({
        t: "next", hole: next,
        themeName: _nextHole ? (_nextHole.theme||"").replace(/_/g," ") : "",
        templateLabel: _nextHole ? (_nextHole.templateLabel||"") : "",
      });
      loadHole(next);
    }, 3500);
  }
  return true;
}

// ── HOST GAME ────────────────────────────────────────────────────────────────
// ── LEAVE / RESET MULTIPLAYER ───────────────────────────────────────
function leaveLobby() {
  if (peer) { try { peer.destroy(); } catch(e) {} peer = null; }
  conns.fill(null);
  myIdx = 0; playerCount = 1; mpMode = false; hostGameStarted = false;
  playerNames.fill("");
  document.getElementById("host-area").style.display = "block";
  document.getElementById("join-area").style.display = "none";
  document.getElementById("mp-status").textContent = "";
  document.getElementById("join-status").textContent = "";
  _destroyLobby3D();
  var lobby = document.getElementById("waiting-lobby");
  if (lobby) lobby.remove();
  document.getElementById("menu").style.display = "flex";
  document.getElementById("ui").style.display   = "none";
  phase = "MENU";
}

// ═══════════════════════════════════════════════════════════════════
// ── 3D LOBBY — island scene with WASD movement + punch ──────────────
// ═══════════════════════════════════════════════════════════════════
var _lobby3D = null;  // { renderer, scene, camera, rafId, avatars, myAvatar, ... }

function _build3DLobby(container) {
  if (typeof THREE === "undefined") return;

  var lRen = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  lRen.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  lRen.setSize(window.innerWidth, window.innerHeight);
  lRen.setClearColor(0x1a0500, 1);
  container.appendChild(lRen.domElement);

  var lScn = new THREE.Scene();
  lScn.fog = new THREE.FogExp2(0x220800, 0.016);

  // Sky
  var _lSkyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { c1:{ value: new THREE.Color(0x3d1000) }, c2:{ value: new THREE.Color(0x000000) } },
    vertexShader:"varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:"uniform vec3 c1;uniform vec3 c2;varying vec3 vP;void main(){float t=clamp(vP.y/280.,0.,1.);gl_FragColor=vec4(mix(c1,c2,t*t),1.);}"
  });
  var _lSkyGeo = new THREE.SphereGeometry(480,10,7);
  _lSkyGeo.scale(-1,1,1);
  lScn.add(new THREE.Mesh(_lSkyGeo, _lSkyMat));

  // Lighting
  lScn.add(new THREE.AmbientLight(0xffffff, 0.55));
  var lSun = new THREE.DirectionalLight(0xffd580, 1.3);
  lSun.position.set(20,40,20); lScn.add(lSun);
  lScn.add(new THREE.HemisphereLight(0xff8800, 0x332200, 0.4));

  // Island
  var iTop = new THREE.Mesh(new THREE.CylinderGeometry(8,8,0.6,18), new THREE.MeshLambertMaterial({color:0x6a8c3a}));
  iTop.position.y=0.3; iTop.receiveShadow=true; lScn.add(iTop);
  var iBody = new THREE.Mesh(new THREE.CylinderGeometry(8,6,4,16), new THREE.MeshLambertMaterial({color:0x4a2a00}));
  iBody.position.y = -2; lScn.add(iBody);
  // Grass tufts
  var gM = new THREE.MeshLambertMaterial({color:0x5a9a2a});
  for (var gi=0; gi<14; gi++) {
    var ga=gi/14*Math.PI*2, gr=3+Math.random()*4;
    var gt=new THREE.Mesh(new THREE.ConeGeometry(.16,.5,4),gM);
    gt.position.set(Math.cos(ga)*gr,.65,Math.sin(ga)*gr); gt.rotation.y=Math.random()*Math.PI; lScn.add(gt);
  }
  // Torches
  var _tFlames=[];
  for (var ti=0; ti<3; ti++) {
    var ta=ti/3*Math.PI*2;
    var tL=new THREE.PointLight([0xff6600,0xff8800,0xffcc00][ti], 1.2, 14);
    tL.position.set(Math.cos(ta)*7, 1.6, Math.sin(ta)*7); lScn.add(tL);
    var tPole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1.3,6), new THREE.MeshLambertMaterial({color:0x8b5200}));
    tPole.position.set(Math.cos(ta)*7, .65, Math.sin(ta)*7); lScn.add(tPole);
    var tFlame=new THREE.Mesh(new THREE.SphereGeometry(.2,6,4), new THREE.MeshBasicMaterial({color:[0xff6600,0xff8800,0xffcc00][ti]}));
    tFlame.position.set(Math.cos(ta)*7, 1.3, Math.sin(ta)*7); lScn.add(tFlame);
    _tFlames.push(tFlame);
  }

  var lCam = new THREE.PerspectiveCamera(58, window.innerWidth/window.innerHeight, 0.1, 400);
  lCam.position.set(0, 7, 14); lCam.lookAt(0,1,0);

  // Overlay
  var _ov = document.createElement("div");
  _ov.id = "lobby3d-overlay";
  _ov.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:10;";
  container.appendChild(_ov);

  // Key state for lobby WASD
  var _lKeys = {};
  var _lKeyDown = function(e){ _lKeys[e.key]=true; };
  var _lKeyUp   = function(e){ _lKeys[e.key]=false; };
  document.addEventListener("keydown", _lKeyDown);
  document.addEventListener("keyup",   _lKeyUp);

  // My local avatar position + look angle in lobby
  var _myLobbyPos = new THREE.Vector3(0, 0.65, 0);
  var _myLobbyYaw = 0;
  var _myLobbyPunchCd = 0;

  _lobby3D = {
    renderer: lRen, scene: lScn, camera: lCam,
    overlay: _ov, avatars: [], myAvatar: null, torchFlames: _tFlames,
    T: 0, rafId: null,
    keys: _lKeys,
    myPos: _myLobbyPos, myYaw: _myLobbyYaw,
    punchCd: 0,
    keyDown: _lKeyDown, keyUp: _lKeyUp,
  };

  _lobby3D.onResize = function() {
    lRen.setSize(window.innerWidth, window.innerHeight);
    lCam.aspect = window.innerWidth/window.innerHeight;
    lCam.updateProjectionMatrix();
  };
  window.addEventListener("resize", _lobby3D.onResize);

  function _lobbyLoop() {
    if (!_lobby3D) return;
    _lobby3D.rafId = requestAnimationFrame(_lobbyLoop);
    var dt = Math.min(0.05, 1/60);
    _lobby3D.T += dt;
    var T = _lobby3D.T;
    var k = _lobby3D.keys;
    var ISLAND_R = 7.2;

    // ── TICK ALL GLB ANIMATION MIXERS — required for walk/idle animations ──
    if (typeof _glbMixers !== "undefined") {
      _glbMixers.forEach(function(m){ m.update(dt); });
    }

    // ── LOCAL PLAYER MOVEMENT — camera-relative WASD ──────────────────
    // Camera sits at (18,14,18) looking at origin — 45° diagonal corner.
    // Forward (away from camera) = (-1/√2, 0, -1/√2); right = (+1/√2, 0, -1/√2).
    var _moveSpd = 5.5 * dt;
    var _f = _moveSpd * 0.7071;  // per-axis component for 45° camera
    var _prevX = _myLobbyPos.x, _prevZ = _myLobbyPos.z;

    if (k["w"]||k["W"]) { _myLobbyPos.x -= _f; _myLobbyPos.z -= _f; }  // away from camera
    if (k["s"]||k["S"]) { _myLobbyPos.x += _f; _myLobbyPos.z += _f; }  // toward camera
    if (k["a"]||k["A"]) { _myLobbyPos.x -= _f; _myLobbyPos.z += _f; }  // camera left
    if (k["d"]||k["D"]) { _myLobbyPos.x += _f; _myLobbyPos.z -= _f; }  // camera right

    // Clamp to island
    var _pd = Math.hypot(_myLobbyPos.x, _myLobbyPos.z);
    if (_pd > ISLAND_R - 0.5) {
      _myLobbyPos.x = _myLobbyPos.x / _pd * (ISLAND_R - 0.5);
      _myLobbyPos.z = _myLobbyPos.z / _pd * (ISLAND_R - 0.5);
    }
    _myLobbyPos.y = 0.65;

    // ── VELOCITY-BASED WALK ANIMATION — same hysteresis as singleplayer ──
    var _dvx = (_myLobbyPos.x - _prevX) / dt;
    var _dvz = (_myLobbyPos.z - _prevZ) / dt;
    if (!_lobby3D._velX) _lobby3D._velX = 0;
    if (!_lobby3D._velZ) _lobby3D._velZ = 0;
    var _vs = Math.min(1, 14*dt);
    _lobby3D._velX += (_dvx - _lobby3D._velX) * _vs;
    _lobby3D._velZ += (_dvz - _lobby3D._velZ) * _vs;
    var _curVel  = Math.hypot(_lobby3D._velX, _lobby3D._velZ);
    var _wasWalk = (_lobby3D.myAvatar && _lobby3D.myAvatar.userData.isMoving) || false;
    var _wlk     = _wasWalk ? (_curVel > 0.18) : (_curVel > 0.50);

    if (_lobby3D.myAvatar && _lobby3D.myAvatar.userData.glbLoaded && _wlk !== _wasWalk) {
      _lobby3D.myAvatar.userData.isMoving = _wlk;
      if (typeof switchAvatarAnim === "function")
        switchAvatarAnim(_lobby3D.myAvatar, _wlk ? "walk" : "idle");
    }
    // On first GLB load, start idle
    if (_lobby3D.myAvatar && _lobby3D.myAvatar.userData.glbLoaded && !_lobby3D._myAnimStarted) {
      _lobby3D._myAnimStarted = true;
      if (typeof switchAvatarAnim === "function") switchAvatarAnim(_lobby3D.myAvatar, "idle");
    }

    // ── AVATAR YAW: face movement direction ─────────────────────────────
    var _movDirX = _myLobbyPos.x - _prevX, _movDirZ = _myLobbyPos.z - _prevZ;
    if (Math.hypot(_movDirX, _movDirZ) > 0.001) {
      var _tYaw = Math.atan2(_movDirX, _movDirZ);
      var _dYaw = _tYaw - _myLobbyYaw;
      while (_dYaw >  Math.PI) _dYaw -= Math.PI * 2;
      while (_dYaw < -Math.PI) _dYaw += Math.PI * 2;
      _myLobbyYaw += _dYaw * Math.min(1, 16*dt);
    }

    if (_lobby3D.myAvatar) {
      _lobby3D.myAvatar.position.copy(_myLobbyPos);
      _lobby3D.myAvatar.rotation.y = _myLobbyYaw;
    }

    // ── Broadcast position to all lobby peers (~20Hz) ─────────────────
    _lobby3D._posBroadcastAcc = (_lobby3D._posBroadcastAcc || 0) + dt;
    if (_lobby3D._posBroadcastAcc >= 0.05) {
      _lobby3D._posBroadcastAcc = 0;
      var _isWalking = (_lobby3D.myAvatar && _lobby3D.myAvatar.userData.isMoving) || false;
      if (typeof sendToAll === "function") {
        sendToAll({ t: "lobby_pos",
          px: Math.round(_myLobbyPos.x * 100) / 100,
          pz: Math.round(_myLobbyPos.z * 100) / 100,
          yaw: Math.round(_myLobbyYaw * 100) / 100,
          walk: _isWalking ? 1 : 0
        });
      }
    }

    // ── LOBBY PUNCH (R key) ────────────────────────────────────────────────
    if (_lobby3D.punchCd > 0) _lobby3D.punchCd -= dt;
    if ((k["r"]||k["R"]) && _lobby3D.punchCd <= 0) {
      _lobby3D.punchCd = 1.2;
      k["r"] = k["R"] = false;
      var _bRange = 5.0, _bIdx = -1;
      _lobby3D.avatars.forEach(function(av, i) {
        if (!av || !av.mesh) return;
        var _d = _myLobbyPos.distanceTo(av.mesh.position);
        if (_d < _bRange) { _bRange = _d; _bIdx = i; }
      });
      if (_bIdx >= 0) {
        var _tgt = _lobby3D.avatars[_bIdx];
        var _ddx = _tgt.mesh.position.x - _myLobbyPos.x;
        var _ddz = _tgt.mesh.position.z - _myLobbyPos.z;
        var _dl = Math.hypot(_ddx, _ddz) || 1;
        _tgt._knockVelX = (_ddx/_dl) * 9;
        _tgt._knockVelZ = (_ddz/_dl) * 9;
        _tgt._stagger = 0.9;
        if (typeof _spawnBonkText === "function") _spawnBonkText(_tgt.mesh.position.clone());
      }
    }

    // ── REMOTE LOBBY AVATARS — driven by lobby_pos messages ─────────────
    _lobby3D.avatars.forEach(function(av, i) {
      if (!av || !av.mesh) return;

      // Smooth lerp toward last received network position
      if (av._netX !== undefined) {
        av.mesh.position.x += (av._netX - av.mesh.position.x) * Math.min(1, 12*dt);
        av.mesh.position.z += (av._netZ - av.mesh.position.z) * Math.min(1, 12*dt);
        av.mesh.position.y = 0.65;
      }
      // Smooth yaw
      if (av._netYaw !== undefined) {
        var _rdy = av._netYaw - (av._smoothYaw || av._netYaw);
        while (_rdy >  Math.PI) _rdy -= Math.PI*2;
        while (_rdy < -Math.PI) _rdy += Math.PI*2;
        av._smoothYaw = (av._smoothYaw || av._netYaw) + _rdy * Math.min(1, 12*dt);
        av.mesh.rotation.y = av._smoothYaw;
      }
      // Walk animation driven by network walk flag
      if (av.mesh.userData.glbLoaded) {
        var _rWant = av._netWalk ? "walk" : "idle";
        if (av._lastAnim !== _rWant) {
          av._lastAnim = _rWant;
          if (typeof switchAvatarAnim === "function") switchAvatarAnim(av.mesh, _rWant);
        }
      }

      // Knockback
      if (Math.abs(av._knockVelX||0) > 0.01 || Math.abs(av._knockVelZ||0) > 0.01) {
        av.mesh.position.x += (av._knockVelX||0) * dt;
        av.mesh.position.z += (av._knockVelZ||0) * dt;
        av._knockVelX = (av._knockVelX||0) * (1 - 8*dt);
        av._knockVelZ = (av._knockVelZ||0) * (1 - 8*dt);
        var _pd2 = Math.hypot(av.mesh.position.x, av.mesh.position.z);
        if (_pd2 > ISLAND_R-0.5) {
          av.mesh.position.x = av.mesh.position.x/_pd2*(ISLAND_R-0.5);
          av.mesh.position.z = av.mesh.position.z/_pd2*(ISLAND_R-0.5);
        }
        av.mesh.position.y = 0.65;
      }
      if (av._stagger > 0) {
        av._stagger -= dt;
        av.mesh.rotation.z = Math.sin(av._stagger*25) * (av._stagger/0.9) * 0.8;
      } else {
        av.mesh.rotation.z *= 0.85;
      }
      // Project name label
      if (av.nameLabel) {
        var _wp = av.mesh.position.clone().add(new THREE.Vector3(0, 2.2, 0));
        _wp.project(lCam);
        if (_wp.z < 1) {
          av.nameLabel.style.left = ((_wp.x*.5+.5)*window.innerWidth)+"px";
          av.nameLabel.style.top  = ((-_wp.y*.5+.5)*window.innerHeight-5)+"px";
          av.nameLabel.style.display = "block";
        } else { av.nameLabel.style.display = "none"; }
      }
    });

    // Flame flicker
    _lobby3D.torchFlames.forEach(function(f,i){ f.scale.setScalar(0.9+Math.sin(T*8+i*2.1)*0.12); });

    // ── CAMERA — static elevated corner view of the full island ────────
    lCam.position.set(18, 14, 18);
    lCam.lookAt(0, 1, 0);
    lRen.render(lScn, lCam);
  }
  _lobbyLoop();
  _update3DLobbyPlayers();
}

function _update3DLobbyPlayers() {
  if (!_lobby3D) return;
  var cols = [0x00ffff, 0xff00ff, 0xffff00, 0xff6600, 0x00ff88];
  var hexCols = ["#00ffff","#ff00ff","#ffff00","#ff6600","#00ff88"];

  // Remove old
  _lobby3D.avatars.forEach(function(av) {
    if (av && av.mesh) _lobby3D.scene.remove(av.mesh);
    if (av && av.nameLabel) av.nameLabel.remove();
  });
  _lobby3D.avatars = [];
  if (_lobby3D.myAvatar) { _lobby3D.scene.remove(_lobby3D.myAvatar); _lobby3D.myAvatar = null; }

  // Build my avatar (placed at current pos)
  var _myCol = cols[myIdx % cols.length];
  if (typeof buildPlayerAvatar === "function") {
    _lobby3D.myAvatar = buildPlayerAvatar(myIdx, _myCol);
  } else {
    _lobby3D.myAvatar = _makeFallbackAvatar(_myCol);
  }
  _lobby3D.myAvatar.scale.setScalar(1.0);
  _lobby3D.myAvatar.position.copy(_lobby3D.myPos);
  _lobby3D.scene.add(_lobby3D.myAvatar);

  // Remote players
  for (var i = 0; i < playerCount; i++) {
    if (i === myIdx) continue;
    var _initAngle = (i / Math.max(playerCount, 2)) * Math.PI * 2;
    var av = {
      mesh: null, nameLabel: null, playerIdx: i,
      _knockVelX: 0, _knockVelZ: 0, _stagger: 0,
      _netX: Math.cos(_initAngle)*3.5, _netZ: Math.sin(_initAngle)*3.5,
      _netYaw: _initAngle + Math.PI/2, _netWalk: false,
      _smoothYaw: _initAngle + Math.PI/2
    };
    if (typeof buildPlayerAvatar === "function") {
      av.mesh = buildPlayerAvatar(i, cols[i % cols.length]);
    } else {
      av.mesh = _makeFallbackAvatar(cols[i % cols.length]);
    }
    av.mesh.scale.setScalar(1.0);
    av.mesh.position.set(av._netX, 0.65, av._netZ);
    _lobby3D.scene.add(av.mesh);
    // Name label
    var nl = document.createElement("div");
    nl.style.cssText = "position:absolute;font-family:'Bebas Neue',cursive;font-size:13px;" +
      "color:"+hexCols[i%hexCols.length]+";pointer-events:none;transform:translateX(-50%);" +
      "text-shadow:2px 2px 0 #000;letter-spacing:1px;white-space:nowrap;display:none;";
    nl.textContent = (playerNames[i]||("P"+(i+1))) + (i===0?" 👑":"") + (i===myIdx?" ◀":"");
    _lobby3D.overlay.appendChild(nl);
    av.nameLabel = nl;
    _lobby3D.avatars.push(av);
  }

  // Refresh HUD overlay
  var rawCode = typeof _hostRawCode !== "undefined" && _hostRawCode ? _hostRawCode.toUpperCase() : "------";
  var isHost  = myIdx === 0;
  var _oldHud = _lobby3D.overlay.querySelector("#lobby3d-hud");
  if (_oldHud) _oldHud.remove();
  var hud = document.createElement("div");
  hud.id = "lobby3d-hud";
  hud.style.cssText = "pointer-events:all;position:absolute;top:14px;left:50%;transform:translateX(-50%);text-align:center;";
  hud.innerHTML =
    "<div style='background:rgba(22,5,0,.9);border:3px solid #ff8800;display:inline-block;padding:8px 20px;box-shadow:4px 4px 0 #7a2800;min-width:260px'>" +
    "<div style='font-family:Bebas Neue,cursive;font-size:10px;color:#cc8833;letter-spacing:2px;text-transform:uppercase'>Share Code</div>" +
    "<div style='font-family:Bebas Neue,cursive;font-size:44px;color:#ffcc00;letter-spacing:7px;text-shadow:3px 3px 0 #7a5000;cursor:pointer' onclick='copyCode()'>"+rawCode+"</div>" +
    "<div style='font-family:Bebas Neue,cursive;font-size:10px;color:#ff8800;letter-spacing:1px'>"+playerCount+" / "+MAX_PLAYERS+" PLAYERS</div>" +
    "<div style='font-family:Bebas Neue,cursive;font-size:10px;color:#cc8833;margin-top:3px;letter-spacing:1px'>WASD: Move &nbsp;·&nbsp; R: Punch</div>" +
    (isHost && playerCount>=2
      ? "<button class='mbtn' style='margin-top:7px;padding:9px 22px;font-size:16px' onclick='hostStartGame()'>▶ START GAME</button>"
      : isHost
        ? "<div style='font-size:10px;color:#cc8833;margin-top:5px;font-family:Bebas Neue,cursive;letter-spacing:1px'>Waiting for players…</div>"
        : "<div style='font-size:10px;color:#cc8833;margin-top:5px;font-family:Bebas Neue,cursive;letter-spacing:1px'>Waiting for host…</div>"
    ) +
    "<br><button class='mbtn sec' style='margin-top:5px;padding:3px 12px;font-size:11px' onclick='leaveLobby()'>✕ LEAVE</button>" +
    "</div>";
  _lobby3D.overlay.appendChild(hud);
}

function _makeFallbackAvatar(color) {
  var g = new THREE.Group();
  var bM = new THREE.MeshLambertMaterial({color:color||0x00ffff});
  var h = new THREE.Mesh(new THREE.SphereGeometry(.2,6,4), new THREE.MeshLambertMaterial({color:0xf5cba7}));
  h.position.y=1.62; g.add(h);
  var t = new THREE.Mesh(new THREE.CylinderGeometry(.13,.15,.5,6), bM);
  t.position.y=1.1; g.add(t);
  var l = new THREE.Mesh(new THREE.CylinderGeometry(.06,.05,.42,4), bM);
  l.position.set(-.1,.49,0); g.add(l);
  var r = new THREE.Mesh(new THREE.CylinderGeometry(.06,.05,.42,4), bM);
  r.position.set(.1,.49,0); g.add(r);
  return g;
}

function _destroyLobby3D() {
  if (!_lobby3D) return;
  if (_lobby3D.rafId) cancelAnimationFrame(_lobby3D.rafId);
  if (_lobby3D.keyDown) document.removeEventListener("keydown", _lobby3D.keyDown);
  if (_lobby3D.keyUp)   document.removeEventListener("keyup",   _lobby3D.keyUp);
  if (_lobby3D.onResize) window.removeEventListener("resize", _lobby3D.onResize);

  // Remove lobby avatar mixers from the global _glbMixers array so they don't
  // keep running after the game starts (would cause walk anim glitches in-game)
  if (typeof _glbMixers !== "undefined") {
    var _lobbyMeshes = [];
    var _collectMeshes = function(av) {
      if (!av || !av.mesh) return;
      av.mesh.traverse(function(c) { if (c.userData && c.userData.mixer) _lobbyMeshes.push(c.userData.mixer); });
      if (av.mesh.userData && av.mesh.userData.mixer) _lobbyMeshes.push(av.mesh.userData.mixer);
    };
    _lobby3D.avatars.forEach(_collectMeshes);
    if (_lobby3D.myAvatar) _collectMeshes({ mesh: _lobby3D.myAvatar });
    if (_lobbyMeshes.length > 0) {
      _glbMixers = _glbMixers.filter(function(m){ return _lobbyMeshes.indexOf(m) < 0; });
    }
  }

  if (_lobby3D.renderer) {
    _lobby3D.renderer.dispose();
    if (_lobby3D.renderer.domElement && _lobby3D.renderer.domElement.parentNode)
      _lobby3D.renderer.domElement.parentNode.removeChild(_lobby3D.renderer.domElement);
  }
  _lobby3D.avatars.forEach(function(av){ if(av&&av.nameLabel) av.nameLabel.remove(); });
  _lobby3D = null;
}

function hostGame() {
  AudioEngine.init();
  document.getElementById("host-area").style.display = "block";
  if (typeof Peer === "undefined") {
    document.getElementById("mp-status").textContent = "Error: Multiplayer library blocked.";
    return;
  }
  _destroyPeer(function() {
    conns.fill(null); playerCount=1; hostGameStarted=false;
  const rawCode = "dg" + Math.random().toString(36).substr(2, 4);
  _hostRawCode = rawCode;
  document.getElementById("mp-code").textContent   = rawCode.toUpperCase();
  document.getElementById("mp-status").textContent = "Connecting to relay\u2026";
  try { peer = new Peer(rawCode, PEER_CONFIG); }
  catch (e) { document.getElementById("mp-status").textContent = "Error: " + e.message; return; }

  peer.on("error", (e) => (document.getElementById("mp-status").textContent = "Network Error: " + e.type));
  peer.on("open", () => {
    myIdx = 0; playerCount = 1; mpTotals.fill(0);
    // Use the actual username entered, not "Host"
    var _uIn = document.getElementById("username-input");
    playerNames[0] = (_uIn && _uIn.value.trim()) ? _uIn.value.trim() : "Player 1";
    updateLobbyUI();
  });
  peer.on("connection", (c) => {
    if (playerCount >= MAX_PLAYERS || hostGameStarted) { c.close(); return; }
    const newIdx = playerCount++;
    conns[newIdx] = c;
    playerNames[newIdx] = "Player " + (newIdx + 1);
    c.on("open", () => {
      var _allSkins = Object.assign({}, window._remoteSkins || {});
      _allSkins[0] = (typeof equippedPlayerSkin !== "undefined") ? equippedPlayerSkin : "default";
      c.send(JSON.stringify({ t: "player_joined", yourIdx: newIdx, playerCount, names: playerNames, allSkins: _allSkins }, _netReplacer));
      conns.forEach((oc, oi) => {
        if (oi !== newIdx && oi !== 0 && oc && oc.open)
          oc.send(JSON.stringify({ t: "player_joined", playerCount, names: playerNames, allSkins: _allSkins }));
      });
      updateLobbyUI();
      // Show 3D lobby on host screen when first player joins
      if (playerCount >= 2) {
        document.getElementById("menu").style.display = "none";
        document.getElementById("ui").style.display   = "none";
        var _hl = document.getElementById("waiting-lobby");
        if (!_hl) {
          _hl = document.createElement("div");
          _hl.id = "waiting-lobby";
          _hl.style.cssText = "position:fixed;inset:0;z-index:200;overflow:hidden;";
          document.body.appendChild(_hl);
          if (typeof _build3DLobby === "function") _build3DLobby(_hl);
        } else if (typeof _update3DLobbyPlayers === "function") {
          _update3DLobbyPlayers();
        }
      }
    });
    setupConnForPlayer(c, newIdx);
  });
  });
}

function hostStartGame() {
  AudioEngine.init();
  hostGameStarted = true;
  mpMode          = true;
  matchSeed       = Math.floor(Math.random() * 1000000000);
  HOLES           = [];
  // Don't pre-generate — loadHole(0) uses seed (matchSeed + 0*7331)
  // Clients generate identically via their own loadHole(0) with same matchSeed

  conns.forEach((c, pIdx) => {
    if (!c || !c.open) return;
    // Build complete skin map: host idx=0 + all remote players
    var _fullSkins = Object.assign({}, window._remoteSkins || {});
    _fullSkins[0] = (typeof equippedPlayerSkin !== "undefined") ? equippedPlayerSkin : "default";
    sendTo(pIdx, { t: "start", myIdx: pIdx, playerCount, names: playerNames, matchSeed,
    holes: [], activeThemes: ACTIVE_THEMES, holeCount: HOLE_COUNT, difficulty: DIFFICULTY,
    hostSkins: equippedSkins,
    remoteSkins: _fullSkins });
  });

  // Include host's own skin so all clients can show it correctly
  if (!window._remoteSkins) window._remoteSkins = {};
  window._remoteSkins[0] = (typeof equippedPlayerSkin !== "undefined") ? equippedPlayerSkin : "default";

  // ── Tear down 3D lobby before starting game ──
  _destroyLobby3D();
  var _wl = document.getElementById("waiting-lobby");
  if (_wl) _wl.remove();

  document.getElementById("menu").style.display      = "none";
  document.getElementById("ui").style.display        = "block";
  document.getElementById("mp-scores").style.display = "flex";
  document.getElementById("scorecard").style.display = "none";
  holeIdx = 0;
  holeScores = new Array(200).fill(null);
  totalVsPar = 0;
  mpTotals.fill(0);
  playerDone.fill(false);
  playerThrows.fill(0);
  mpScoreRecorded.fill(false);
  loadHole(0);
  buildScoreboardUI();
  updateMpUI();
}

// ── JOIN GAME ────────────────────────────────────────────────────────────────
function joinGame() {
  AudioEngine.init();
  var code = (document.getElementById("mp-input").value.trim()).toLowerCase();
  if (!code) return;
  document.getElementById("join-status").textContent = "Connecting…";
  if (typeof Peer === "undefined") {
    document.getElementById("join-status").textContent = "Error: Multiplayer library not loaded."; return;
  }
  _destroyPeer(function() {
    conns.fill(null); hostGameStarted = false;
    var _p2;
    try { _p2 = new Peer(PEER_CONFIG); peer = _p2; }
    catch (e) { document.getElementById("join-status").textContent = "Error: " + e.message; return; }
    _p2.on("error", function(e2) {
      var extra = e2.type === "peer-unavailable" ? " — wrong code or host not ready" : "";
      document.getElementById("join-status").textContent = "Error: " + e2.type + extra;
    });
    _p2.on("open", function() {
      document.getElementById("join-status").textContent = "Reached relay, connecting…";
      var c = _p2.connect(code, { reliable: true, serialization: "json" });
      if (!c) { document.getElementById("join-status").textContent = "Error: connect() failed"; return; }
      conns[0] = c;
      setupConnForPlayer(c, 0);
      c.on("open", function() {
        document.getElementById("join-status").textContent = "Connected! Waiting for host…";
        var _un = document.getElementById("username-input");
        c.send(JSON.stringify({ t: "my_name", name: (_un && _un.value.trim()) || "Player 2",
          playerSkin: (typeof equippedPlayerSkin !== "undefined") ? equippedPlayerSkin : "default" }));
      });
      setTimeout(function() {
        if (c.open) return;
        document.getElementById("join-status").textContent = "Timed out — check code and retry";
      }, 15000);
    });
  });
}