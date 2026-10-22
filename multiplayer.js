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
  _relayStop();
  if (!peer) { cb(); return; }
  try { peer.off("error"); peer.off("open"); peer.off("connection"); peer.destroy(); } catch(e) {}
  peer = null;
  setTimeout(cb, 180);
}

var _hostRawCode = "";  // persists the lobby code for 3D lobby display

// Follow a connection's WebRTC (ICE) state so a link that can't be made fails
// fast with a clear message instead of hanging on "connecting…"
function _watchIce(c, cb) {
  var last = "", iv = setInterval(function() {
    if (c.open) { clearInterval(iv); return; }
    var pc = c.peerConnection, st = pc ? pc.iceConnectionState : "new";
    if (st !== last) { last = st; cb(st); }
    if (st === "failed" || st === "closed") clearInterval(iv);
  }, 400);
  return function() { clearInterval(iv); };
}
// ══════════════════════════════════════════════════════════════════════
// ── RELAY FALLBACK ────────────────────────────────────────────────────
// When the direct browser-to-browser link is blocked (mobile data, strict
// routers, school / office networks) the game talks through a public MQTT
// message broker over secure WebSockets instead. No account needed.
// A RelayConn behaves like a PeerJS DataConnection (on/send/close/open), so
// the rest of the multiplayer code doesn't care which path a player uses.
// Topics: dgolf/v1/<code>/h  ← guests → host     dgolf/v1/<code>/g/<id>  ← host → guest
// ══════════════════════════════════════════════════════════════════════
var RELAY_BROKERS = ["wss://broker.hivemq.com:8884/mqtt", "wss://broker.emqx.io:8084/mqtt"];
var _hubs = [];        // host: one per transport it listens on;  guest: the one it joined through
var _relayGuests = {}; // host: guest id → hub it is connected through (a guest reaches us on several brokers)
var _relayErr = "";    // why the internet relay couldn't be used (for the error message)

function _loadMqtt(cb) {
  if (window.mqtt) { cb(true); return; }
  var urls = ["lib/mqtt.min.js", "https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js", "https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js"];
  (function next(i) {
    if (i >= urls.length) { cb(false); return; }
    var sc = document.createElement("script"); sc.src = urls[i];
    sc.onload = function() { if (window.mqtt) cb(true); else next(i + 1); }; sc.onerror = function() { next(i + 1); };
    document.head.appendChild(sc);
  })(0);
}
// A "bus" is a tiny pub/sub transport: { kind, pub(topic, str), sub(topic, done), onMsg(fn), onClose(fn), end() }
// Internet relay: public MQTT brokers over secure WebSockets. Host and guest
// both use every broker at once, so they always meet on whichever one works.
function _busRelayOne(url, cb) {
  var done = false, cl;
  try { cl = mqtt.connect(url, { connectTimeout: 8000, reconnectPeriod: 0, clean: true, clientId: "dg_" + Math.random().toString(36).slice(2, 10) }); }
  catch (e) { cb(null); return; }
  var fail = function() { if (done) return; done = true; try { cl.end(true); } catch (e) {} cb(null); };
  cl.once("connect", function() {
    if (done) return; done = true;
    cb({ kind: "relay", url: url, pub: function(t, m) { cl.publish(t, m); }, sub: function(t, d) { cl.subscribe(t, d); },
      onMsg: function(fn) { cl.on("message", function(t, buf) { fn(t, buf.toString()); }); },
      onClose: function(fn) { cl.on("close", fn); }, end: function() { try { cl.end(true); } catch (e) {} } });
  });
  cl.once("error", fail);
  setTimeout(fail, 9000);
}
// cb(bus) for every broker that connects; done(count) once all have answered
function _busRelayAll(cb, done) {
  _loadMqtt(function(ok) {
    if (!ok) { _relayErr = "the relay library couldn't load (an ad-blocker or privacy add-on may be blocking it)"; done(0); return; }
    var left = RELAY_BROKERS.length, n = 0;
    RELAY_BROKERS.forEach(function(url) {
      _busRelayOne(url, function(bus) {
        if (bus) { n++; cb(bus); }
        if (--left === 0) { if (!n) _relayErr = "the relay servers couldn't be reached from this network"; done(n); }
      });
    });
  });
}
// Same browser, other tab: BroadcastChannel (no network at all)
function _busLocal() {
  if (typeof BroadcastChannel === "undefined") return null;
  var ch = new BroadcastChannel("diskgolfi-mp"), subs = {}, fns = [];
  ch.onmessage = function(e) { var m = e.data; if (m && subs[m.t]) fns.forEach(function(f) { f(m.t, m.s); }); };
  return { kind: "local", pub: function(t, m) { ch.postMessage({ t: t, s: m }); }, sub: function(t, d) { subs[t] = 1; if (d) d(); },
    onMsg: function(fn) { fns.push(fn); }, onClose: function() {}, end: function() { try { ch.close(); } catch (e) {} } };
}

// A RelayConn behaves like a PeerJS DataConnection (on / send / close / open)
function RelayConn(sendFn, kind) { this._send = sendFn; this.open = false; this._h = {}; this.viaRelay = kind === "relay"; this.viaLocal = kind === "local"; this.peerConnection = null; }
RelayConn.prototype.on = function(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return this; };
RelayConn.prototype._emit = function(ev, a) { (this._h[ev] || []).slice().forEach(function(f) { try { f(a); } catch (e) { console.error(e); } }); };
RelayConn.prototype.send = function(raw) { if (this.open) this._send(typeof raw === "string" ? raw : JSON.stringify(raw)); };
RelayConn.prototype.close = function() { var was = this.open; this.open = false; try { this._send(null); } catch (e) {} if (was) this._emit("close"); };

// Host side: accept guests arriving on a bus.  Topics: dgolf/v1/<code>/h (to host), /g/<guest> (to guest)
function _hubHost(bus, code, onConn) {
  var base = "dgolf/v1/" + code, hub = { bus: bus, conns: {} };
  _hubs.push(hub);
  bus.sub(base + "/h");
  bus.onMsg(function(topic, str) {
    if (topic !== base + "/h") return;
    var m; try { m = JSON.parse(str); } catch (e) { return; }
    if (!m || !m.g) return;
    var rc = hub.conns[m.g];
    if (m.hello) {
      if (_relayGuests[m.g] && _relayGuests[m.g] !== hub) return;   // already connected through another broker
      if (!rc) {
        _relayGuests[m.g] = hub;
        rc = new RelayConn(function(raw) { bus.pub(base + "/g/" + m.g, raw === null ? JSON.stringify({ bye: 1 }) : JSON.stringify({ d: raw })); }, bus.kind);
        hub.conns[m.g] = rc;
        bus.pub(base + "/g/" + m.g, JSON.stringify({ welcome: 1 }));   // welcome first: the guest drops data that arrives before it
        onConn(rc);
        rc.open = true; rc._emit("open");
        return;
      }
      bus.pub(base + "/g/" + m.g, JSON.stringify({ welcome: 1 }));
    } else if (m.bye) { if (rc) { delete hub.conns[m.g]; delete _relayGuests[m.g]; if (rc.open) { rc.open = false; rc._emit("close"); } } }
    else if (rc && m.d !== undefined) rc._emit("data", m.d);
  });
  bus.onClose(function() { Object.keys(hub.conns).forEach(function(g) { var c = hub.conns[g]; if (c.open) { c.open = false; c._emit("close"); } }); });
}
function _relayHostStart(code, onConn) {
  _relayStop();
  var lb = _busLocal(); if (lb) _hubHost(lb, code, onConn);
  _busRelayAll(function(bus) {
    if (!peer || _hostRawCode !== code) { bus.end(); return; }   // lobby closed meanwhile
    _hubHost(bus, code, onConn);
  }, function(n) { if (!n) console.warn("DiskGolfi: internet relay unavailable — " + _relayErr); });
}
// Guest side: say hello on a bus until the host welcomes us; cb(conn) or cb(null) after `tries` seconds
function _hubJoin(bus, code, tries, cb, gid) {
  var base = "dgolf/v1/" + code, mine;
  gid = gid || Math.random().toString(36).slice(2, 10); mine = base + "/g/" + gid;
  var hub = { bus: bus, conns: {} }; _hubs.push(hub);
  var rc = new RelayConn(function(raw) { bus.pub(base + "/h", JSON.stringify(raw === null ? { g: gid, bye: 1 } : { g: gid, d: raw })); }, bus.kind);
  var settled = false, n = 0, step = bus.kind === "local" ? 150 : 1000;
  var say = function() { bus.pub(base + "/h", JSON.stringify({ g: gid, hello: 1 })); };
  var iv = setInterval(function() {
    if (settled) { clearInterval(iv); return; }
    if (++n * step > tries * 1000) { clearInterval(iv); settled = true; bus.end(); _hubs.splice(_hubs.indexOf(hub), 1); cb(null); return; }
    say();
  }, step);
  bus.onMsg(function(topic, str) {
    if (topic !== mine) return;
    var m; try { m = JSON.parse(str); } catch (e) { return; }
    if ((m.welcome || m.d !== undefined) && !settled) { settled = true; clearInterval(iv); rc.open = true; cb(rc); rc._emit("open"); }   // any message from the host counts as a welcome
    if (m.bye && rc.open) { rc.open = false; rc._emit("close"); }
    else if (m.d !== undefined && rc.open) rc._emit("data", m.d);
  });
  bus.onClose(function() { if (rc.open) { rc.open = false; rc._emit("close"); } });
  bus.sub(mine, say);
}
function _relayJoin(code, cb) {
  var won = false, pending = 0, connected = false, allIn = false, gid = Math.random().toString(36).slice(2, 10);   // same identity on every broker
  var finish = function() { if (!won && allIn && pending === 0) cb(null, connected ? "nohost" : "norelay"); };
  _busRelayAll(function(bus) {
    connected = true; pending++;
    _hubJoin(bus, code, 12, function(rc) {
      pending--;
      if (rc && !won) { won = true; cb(rc, ""); }
      else if (rc) { rc.open = false; }   // another broker got there first (the host only knows us once)
      finish();
    }, gid);
  }, function() { allIn = true; finish(); });
}
function _relayStop() {
  _relayGuests = {};
  _hubs.forEach(function(h) {
    try { Object.keys(h.conns).forEach(function(g) { h.conns[g].close(); }); } catch (e) {}
    h.bus.end();
  });
  _hubs = [];
}

var _NET_FAIL_MSG = "Couldn't connect — neither a direct link nor the relay worked. Check both devices are online and try again.";
function _relayFailMsg(why) {
  if (why === "nohost") return "The host didn't answer on the relay. Ask the host to reload the page and host again, then retry.";
  return "Couldn't connect: the direct link is blocked and " + (_relayErr || "the relay failed") + ".";
}

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

// Heartbeats: every peer pings every 1.5 s; silence for 8 s means they are gone
var _HB_EVERY = 1500, _HB_TIMEOUT = 8000;
setInterval(function() {
  var now = Date.now();
  conns.forEach(function(c, i) {
    if (!c || !c.open) return;
    try { c.send(JSON.stringify({ t: "hb" })); } catch (e) {}
    if (c._lastSeen && now - c._lastSeen > _HB_TIMEOUT) { console.warn("DiskGolfi: player " + i + " timed out"); try { c.close(); } catch (e) {} if (c._onLost) c._onLost(); }
  });
}, _HB_EVERY);
// Leaving the page: tell the others right away
window.addEventListener("pagehide", function() {
  conns.forEach(function(c) { if (c && c.open) { try { c.send(JSON.stringify({ t: "bye" })); c.close(); } catch (e) {} } });
  try { _relayStop(); } catch (e) {}
  if (peer) { try { peer.destroy(); } catch (e) {} }
});

function setupConnForPlayer(c, pIdx) {
  c._lastSeen = Date.now();
  var _lostOnce = false;
  c._onLost = function() { if (_lostOnce) return; _lostOnce = true; _connLost(c, pIdx); };
  c.on("data", (raw) => {
    c._lastSeen = Date.now();
    try {
      const msg = JSON.parse(raw);
      if (msg.t === "hb") return;
      if (msg.t === "bye") { try { c.close(); } catch (e) {} c._onLost(); return; }
      if (msg.from === undefined) msg.from = pIdx;
      handleMsg(msg);
      if (myIdx === 0) {
        const relayed = JSON.stringify(msg, _netReplacer);
        conns.forEach((oc, oi) => { if (oi !== pIdx && oc && oc.open) oc.send(relayed); });
      }
    } catch (e) {}
  });
  c.on("close", () => c._onLost());
}

// Someone is gone (closed the tab, lost connection, or left)
function _connLost(c, pIdx) {
  if (conns[pIdx] !== c) return;   // an abandoned attempt (e.g. replaced by the relay) — not a real disconnect
  var dName = playerNames[pIdx] || ("Player " + (pIdx + 1));
  conns[pIdx] = null;
  if (pIdx === 0 && myIdx !== 0) { _mpReturnToMenu("Host left", "The host disconnected — back to the menu."); return; }
  _playerGone(pIdx);
  if (myIdx === 0) sendToAll({ t: "player_left", i: pIdx });
  showMsg("Player left", dName + " disconnected.", null);
  setTimeout(hideMsg, 2600);
}
// Remove a departed player everywhere: lobby, course, scoreboard, turn logic
function _playerGone(i) {
  window._leftPlayers = window._leftPlayers || {};
  window._leftPlayers[i] = true;
  playerDone[i] = true;
  var rp = remotePlayers[i];
  if (rp) {
    if (rp.avatarMesh) scene.remove(rp.avatarMesh);
    if (rp.discMesh) scene.remove(rp.discMesh);
    if (rp.nameLabel && rp.nameLabel.parentNode) rp.nameLabel.parentNode.removeChild(rp.nameLabel);
    remotePlayers[i] = null;
  }
  if (_lobby3D) { _lobbyDropAvatar(i); _lobbyHud(); }
  if (typeof updateLobbyUI === "function") updateLobbyUI();
  if (typeof updateMpUI === "function" && hostGameStarted !== undefined) { try { updateMpUI(); } catch (e) {} }
  var anyone = conns.some(Boolean);
  if (myIdx === 0 && !anyone && mpMode) { _mpReturnToMenu("Everyone left", "All other players disconnected."); return; }
  if (mpMode && typeof checkAllDone === "function") checkAllDone();
}
function _mpReturnToMenu(big, sub) {
  showMsg(big, sub, null);
  setTimeout(function() {
    hideMsg();
    _destroyLobby3D();
    var wl = document.getElementById("waiting-lobby"); if (wl) wl.remove();
    _relayStop();
    if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
    conns.fill(null); window._leftPlayers = {};
    mpMode = false; hostGameStarted = false; myIdx = 0; playerCount = 1;
    phase = "MENU";
    document.getElementById("ui").style.display = "none";
    document.getElementById("menu").style.display = "flex";
    if (typeof menuView === "function") menuView("home");
    if (typeof showMenuBackdrop === "function") showMenuBackdrop();
    AudioEngine.playMenu();
  }, 2600);
}

function handleMsg(msg) {
  const from = msg.from !== undefined ? msg.from : 1;
  if (typeof BT !== "undefined" && BT.handle(msg)) return;
  if (msg.t === "it") { if (typeof PU !== "undefined" && msg.o !== myIdx) PU.onNet(msg); return; }
  if (msg.t === "lobby_cfg") { BT.mode = msg.mode || BT.mode; BT.items = msg.items || BT.items; if (typeof _lobbyHud === "function") _lobbyHud(); return; }

  if (msg.t === "start") {
    if (typeof msg.hostNow === "number") _clockOff = msg.hostNow - Date.now();   // align to the host's clock
    _SP_FORCED_THEME = null;
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
    if (msg.remoteCos) window._remoteCos = msg.remoteCos;
    if (msg.holeCount)  HOLE_COUNT = msg.holeCount;
    if (msg.difficulty) DIFFICULTY = msg.difficulty;
    if (msg.weather) setWeather(msg.weather);
    BT.mode = msg.mode || "battle"; BT.items = msg.items || "normal"; BT.newMatch();
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

  } else if (msg.t === "ents") {
    if (typeof ENT !== "undefined") ENT.applyNet(msg);
  } else if (msg.t === "ent_boom") {
    if (msg.h === holeIdx && typeof ENT !== "undefined") ENT.explode(msg.x, msg.y, msg.z);
  } else if (msg.t === "crumble") {
    if (msg.h === holeIdx && HOLES[holeIdx] && HOLES[holeIdx].course) HOLES[holeIdx].course.crumbleRemote(msg.i);
  } else if (msg.t === "pos") {
    var _rp2=remotePlayers[from];
    if(_rp2){
      // Don't override position while they're mid-punch-flight — stepDisc drives it
      _rp2.targetX=msg.px; _rp2.targetZ=msg.pz;
      if(typeof msg.py==="number") _rp2.targetY=msg.py;
      if(typeof msg.an==="string") _rp2.anim=msg.an;
      if(typeof msg.aim==="number") _rp2.aimAngle=msg.aim;
      if(typeof msg.yaw==="number") _rp2.targetYaw=msg.yaw;
      if(typeof msg.vm==="number")  _rp2.velMag=msg.vm;
      // Walk animation is driven every frame in physics.js — no need to trigger here
    }
  } else if (msg.t === "throw") {
    const rp = remotePlayers[from];
    if (rp) {
      // Simulate with the disc they actually threw (not the slot default)
      if (msg.disc && DISCS[msg.disc] && (msg.disc !== rp.discType || (msg.skin || "classic") !== rp.discSkin)) {
        if (rp.discMesh) scene.remove(rp.discMesh);
        rp.discType = msg.disc; rp.discSkin = msg.skin || "classic";
        rp.discMesh = buildDisc(msg.disc, 0.85, rp.discSkin);
        rp.discMesh.scale.setScalar(DISC_SCALE_FLIGHT);
        scene.add(rp.discMesh);
      }
      rp.discPos.set(msg.px, msg.py, msg.pz);
      rp.discVel.set(msg.vx, msg.vy, msg.vz);
      rp.bankArr = [msg.hz || 0];
      rp.spin    = Math.hypot(msg.vx, msg.vz) * 3;
      rp.flying  = true;
      rp.fire    = !!msg.fire;
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
      window._remoteCos = window._remoteCos || {}; window._remoteCos[from] = msg.cos || null;
      if (myIdx === 0) {
        conns.forEach((oc, oi) => { if (oc && oc.open) oc.send(JSON.stringify({ t:"player_joined", playerCount, names:playerNames }, _netReplacer)); });
      }
      updateLobbyUI();
      // Rebuild lobby avatars so the new player's skin is applied
      if (typeof _update3DLobbyPlayers === "function") _update3DLobbyPlayers();
    }

  } else if (msg.t === "car") {
    VEH.applyState(msg);
  } else if (msg.t === "car_seats") {
    VEH.applySeats(msg);
  } else if (msg.t === "car_hit") {
    if (msg.target === myIdx) BT.receiveHit({ by: from, c: "car", dx: msg.dx, dz: msg.dz, f: Math.min(26, msg.f * 1.1), u: 6 + msg.f * 0.35 });
    return;
    if (msg.target === myIdx) VEH.hitMe(msg.dx, msg.dz, msg.f);
  } else if (msg.t === "car_honk") {
    AudioEngine.sfx("honk");
  } else if (msg.t === "ent_hit") {
    if (myIdx === 0 && msg.h === holeIdx && ENT.list[msg.i]) ENT.launch(ENT.list[msg.i], msg.vx, msg.vy, msg.vz);
  } else if (msg.t === "pu_take") {
    if (msg.h === holeIdx && PU.tokens[msg.i] && !PU.tokens[msg.i].taken) PU.takeToken(PU.tokens[msg.i], false);
  } else if (msg.t === "bat_hit") {
    if (msg.target === myIdx) PU.batHit(msg.dx, msg.dz);
  } else if (msg.t === "poop_army") {
    PU.poopArmy(msg.owner, msg.target, msg.x, msg.z, false);
    if (msg.target === myIdx) PU.banner("💩 " + (playerNames[msg.owner] || "Someone") + " sent a poop army after you — run!");

  } else if (msg.t === "player_left") {
    if (msg.i !== myIdx) _playerGone(msg.i);

  } else if (msg.t === "lobby_pos") {
    if (_lobby3D && from !== myIdx) {
      var _lav = _lobby3D.avatars[from];
      if (!_lav && from < playerCount) { _update3DLobbyPlayers(); _lav = _lobby3D.avatars[from]; }
      if (_lav) { _lav.nx = msg.px; _lav.nz = msg.pz; _lav.ny = typeof msg.py === "number" ? msg.py : null; _lav.nyaw = msg.yaw; _lav.nanim = msg.an || (msg.walk ? "walk" : "idle"); }
    }

  } else if (msg.t === "lobby_bonk") {
    if (_lobby3D && msg.target === myIdx) {
      _lobby3D.vel.x = msg.dx * 11; _lobby3D.vel.y = msg.dz * 11; _lobby3D.vy = 6;
      if (typeof _spawnBonkText === "function") _spawnBonkText(_lobby3D.myPos.clone().add(new THREE.Vector3(0, 2, 0)));
      AudioEngine.sfx("bonk"); if (typeof _screenShake !== "undefined") { _screenShake = 0.3; _screenShakeT = 0.35; }
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
      // Their own client moves their body (and broadcasts it); we just show the stagger
      _rp.punchStagger   = _stg;
      _rp.punchImmunity  = _stg + 0.2;
      _rp.punchKnockDir  = { x: msg.dx || 0, z: msg.dz || 0 };
      // Do NOT set rp.flying — we don't want to trigger disc flight simulation
      if (_rp.avatarMesh && typeof switchAvatarAnim === "function") {
        switchAvatarAnim(_rp.avatarMesh, "jump");
      }
      if (typeof _spawnBonkText === "function") _spawnBonkText((_rp.body || _rp.discPos).clone());
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
    BT._tallyHide();
    if (BT.on()) { var _w = BT.winner(); showMsg("🏆 " + BT.name(_w) + " WINS!", BT.pts[_w] + " points · " + (_w === myIdx ? "you're the top golfer!" : "you scored " + BT.pts[myIdx]), null); }
    else showMsg("GAME OVER!", "All " + HOLE_COUNT + " holes complete!", null);
    if (typeof PF !== "undefined") PF.matchEnd(msg.totals);
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

  } else if (msg.t === "cos_equip") {
    window._remoteCos = window._remoteCos || {}; window._remoteCos[msg.from] = msg.cos;
    var _crp = remotePlayers[msg.from];
    if (_crp && _crp.avatarMesh && _crp.avatarMesh.userData.glbLoaded) COS.dressAvatar(_crp.avatarMesh, msg.cos);

  } else if (msg.t === "skin_equip") {
    if (typeof equippedSkins !== "undefined" && msg.from !== undefined) {
      equippedSkins["p"+msg.from+"_"+msg.disc] = msg.skin;
    }

  } else if (msg.t === "score" || msg.t === "givenup") {
    playerDone[from]   = true;
    playerThrows[from] = msg.throws;
    BT.onScore(from, msg.throws, msg.t === "givenup" ? Object.assign({ dnf: 1 }, msg) : msg);
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
    if (msg.allCos) window._remoteCos = msg.allCos;
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
  const _left = window._leftPlayers || {};
  const sorted = Array.from({ length: playerCount }, (_, i) => ({ i, t: playerThrows[i] })).filter((r) => !_left[r.i]).sort((a, b) => a.t - b.t);
  const best  = sorted[0];
  const sub   = sorted.map((r) => `${playerNames[r.i].split(" ")[0]}: ${r.t}`).join("  ");
  const big   = best.i === myIdx ? "HOLE WON!" : myT === best.t ? "TIE!" : "HOLE LOST";
  if (BT.on()) { hideMsg(); BT.tally(); }
  else showMsg(big, sub, null);
  updateMpUI();

  if (myIdx === 0) {
    setTimeout(() => {
      hideMsg();
      const next = holeIdx + 1;
      if (next >= HOLE_COUNT) {
        // MP game over — inform all (battle mode: most points wins, so send negated points to the "lowest wins" award)
        var _tot = BT.on() ? BT.pts.map(function(p) { return -p; }) : mpTotals;
        sendToAll({ t: "game_over", totals: _tot, names: playerNames });
        BT._tallyHide();
        if (BT.on()) { var _w = BT.winner(); showMsg("🏆 " + BT.name(_w) + " WINS!", BT.pts[_w] + " points · " + (_w === myIdx ? "you're the top golfer!" : "you scored " + BT.pts[myIdx]), null); }
        else showMsg("GAME OVER!", "All " + HOLE_COUNT + " holes complete!", null);
        if (typeof PF !== "undefined") PF.matchEnd(_tot);
        setTimeout(() => {
          hideMsg();
          document.getElementById("menu").style.display = "flex";
          document.getElementById("ui").style.display   = "none";
          phase = "MENU";
        }, 4000);
        return;
      }
      BT._tallyHide();
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
    }, BT.on() ? 6500 : 3500);
  }
  return true;
}

// ── HOST GAME ────────────────────────────────────────────────────────────────
// ── LEAVE / RESET MULTIPLAYER ───────────────────────────────────────
function leaveLobby() {
  conns.forEach(function(c) { if (c && c.open) { try { c.send(JSON.stringify({ t: "bye" })); } catch (e) {} } });
  window._leftPlayers = {};
  _relayStop();
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
  if (typeof menuView === "function") menuView("home");
}

// ═══════════════════════════════════════════════════════════════════
// ── 3D LOBBY — island scene with WASD movement + punch ──────────────
// ═══════════════════════════════════════════════════════════════════
var _lobby3D = null;  // { overlay, group, avatars: {idx: av}, me, ... } — lives in the main game scene

// ══════════════════════════════════════════════════════════════════════
// ── LOBBY — everyone hangs out on the menu island until the host starts
// Uses the main renderer + the menu lagoon (no second WebGL context).
// ══════════════════════════════════════════════════════════════════════
var LOBBY_R = 7.6, LOBBY_Y = function() { return -1.5 + ISLAND_TOP; };
function _build3DLobby(container) {
  if (typeof THREE === "undefined") return;
  if (_lobby3D) _destroyLobby3D();
  if (typeof showMenuBackdrop === "function" && !_menuBackdrop) showMenuBackdrop();
  container.style.pointerEvents = "none";
  var ov = document.createElement("div"); ov.id = "lobby3d-overlay"; ov.style.cssText = "position:absolute;inset:0;pointer-events:none;";
  container.appendChild(ov);
  var grp = new THREE.Group(); scene.add(grp);
  _lobby3D = { overlay: ov, group: grp, avatars: {}, me: null, T: 0, camYaw: 0.65,
    myPos: new THREE.Vector3(Math.cos(myIdx * 1.3) * 3, LOBBY_Y(), Math.sin(myIdx * 1.3) * 3 + 1), myYaw: 0, vy: 0, vel: new THREE.Vector2(), punchCd: 0, sendAcc: 0, decor: [] };
  _lobbyDecor(grp);
  _update3DLobbyPlayers();
}
// Bunting, balloons and a glowing welcome ring around the basket
function _lobbyDecor(grp) {
  var y = LOBBY_Y(), cols = [0xff5a8a, 0xffd23a, 0x3ab0ff, 0x8ae05a, 0xb46aff, 0xff8a3a];
  // poles + bunting
  var poles = 6, pts = [];
  for (var i = 0; i < poles; i++) {
    var a = i / poles * Math.PI * 2 + 0.3, x = Math.cos(a) * 8.2, z = Math.sin(a) * 8.2;
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.6 }));
    pole.position.set(x, y + 1.6, z); pole.castShadow = true; grp.add(pole);
    pts.push(new THREE.Vector3(x, y + 3.1, z));
  }
  for (var k = 0; k < poles; k++) {
    var A = pts[k], B = pts[(k + 1) % poles];
    for (var f = 1; f < 9; f++) {
      var t = f / 9, sag = Math.sin(t * Math.PI) * 0.55;
      var flag = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 3), new THREE.MeshStandardMaterial({ color: cols[(k * 9 + f) % cols.length], roughness: 0.7, side: THREE.DoubleSide }));
      flag.position.set(A.x + (B.x - A.x) * t, A.y - sag - 0.2, A.z + (B.z - A.z) * t); flag.rotation.x = Math.PI; flag.rotation.y = Math.atan2(B.x - A.x, B.z - A.z);
      grp.add(flag);
    }
  }
  // balloons tied around the island, bobbing
  for (var bI = 0; bI < 8; bI++) {
    var ba = bI / 8 * Math.PI * 2, bx = Math.cos(ba) * 6.9, bz = Math.sin(ba) * 6.9;
    var bal = new THREE.Group(); bal.position.set(bx, y, bz); grp.add(bal);
    var ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), new THREE.MeshPhysicalMaterial({ color: cols[bI % cols.length], roughness: 0.25, clearcoat: 1 }));
    ball.scale.y = 1.18; ball.position.y = 2.6 + (bI % 3) * 0.35; bal.add(ball);
    var str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, ball.position.y - 0.4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    str.position.y = (ball.position.y - 0.4) / 2; bal.add(str);
    _lobby3D.decor.push({ o: ball, ph: bI });
  }
  // glowing ring on the ground marking the hangout area
  var ring = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.15, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = y + 0.03; grp.add(ring); _lobby3D.ring = ring;
}

function _update3DLobbyPlayers() {
  if (!_lobby3D) return;
  var L = _lobby3D, keep = {};
  // me
  if (!L.me) { L.me = buildPlayerAvatar(myIdx, PLAYER_COLORS[myIdx % PLAYER_COLORS.length]); L.group.add(L.me); L.meLabel = _lobbyLabel(myIdx, true); }
  // everyone else who is in the match
  for (var i = 0; i < playerCount; i++) {
    if (i === myIdx || (window._leftPlayers && window._leftPlayers[i])) continue;
    keep[i] = true;
    var av = L.avatars[i];
    if (av && av.skin !== ((window._remoteSkins || {})[i] || "default") + JSON.stringify((window._remoteCos || {})[i] || null)) { _lobbyDropAvatar(i); av = null; }
    if (!av) {
      var ang = i * 1.3 + 0.5;
      av = L.avatars[i] = { idx: i, x: Math.cos(ang) * 3.2, z: Math.sin(ang) * 3.2 + 1, y: LOBBY_Y(), yaw: 0, nx: null, nz: null, ny: null, nyaw: null, walk: false,
        skin: ((window._remoteSkins || {})[i] || "default") + JSON.stringify((window._remoteCos || {})[i] || null) };
      av.mesh = buildPlayerAvatar(i, PLAYER_COLORS[i % PLAYER_COLORS.length]);
      av.mesh.position.set(av.x, av.y, av.z); L.group.add(av.mesh);
      av.label = _lobbyLabel(i, false);
      if (typeof spawnParticleBurst === "function") spawnParticleBurst(new THREE.Vector3(av.x, av.y + 1.5, av.z), new THREE.Color(PLAYER_COLORS[i % PLAYER_COLORS.length]), 26);
      if (typeof AudioEngine !== "undefined") AudioEngine.sfx("pickup");
    }
    if (av.label) av.label.textContent = (playerNames[i] || ("Player " + (i + 1))) + (i === 0 ? " 👑" : "");
  }
  Object.keys(L.avatars).forEach(function(k) { if (!keep[k]) _lobbyDropAvatar(+k); });
  if (L.meLabel) L.meLabel.textContent = (playerNames[myIdx] || "You") + (myIdx === 0 ? " 👑" : "") + " · you";
  _lobbyHud();
}
function _lobbyDropAvatar(i) {
  var L = _lobby3D, av = L && L.avatars[i]; if (!av) return;
  if (av.mesh) { L.group.remove(av.mesh); _lobbyStopMixers(av.mesh); }
  if (av.label) av.label.remove();
  delete L.avatars[i];
}
function _lobbyStopMixers(mesh) {
  if (typeof _glbMixers === "undefined" || !mesh) return;
  var ms = []; mesh.traverse(function(c) { if (c.userData && c.userData.mixer) ms.push(c.userData.mixer); });
  if (ms.length) _glbMixers = _glbMixers.filter(function(m) { return ms.indexOf(m) < 0; });
}
function _lobbyLabel(i, me) {
  var nl = document.createElement("div");
  nl.className = "lobby-name" + (me ? " me" : "");
  nl.style.boxShadow = "inset 3px 0 0 #" + PLAYER_COLORS[i % PLAYER_COLORS.length].toString(16).padStart(6, "0");
  _lobby3D.overlay.appendChild(nl);
  return nl;
}
function _lobbyHud() {
  var L = _lobby3D; if (!L) return;
  var rawCode = ((myIdx === 0 ? _hostRawCode : window._joinedCode) || "------").toUpperCase(), isHost = myIdx === 0;
  var old = L.overlay.querySelector("#lobby3d-hud"); if (old) old.remove();
  var present = [];
  for (var i = 0; i < playerCount; i++) if (!(window._leftPlayers && window._leftPlayers[i])) present.push(i);
  var list = present.map(function(i) {
    var sk = (typeof PLAYER_SKINS !== "undefined") ? PLAYER_SKINS.find(function(p) { return p.id === (i === myIdx ? equippedPlayerSkin : ((window._remoteSkins || {})[i] || "default")); }) : null;
    return "<div class='lb-p'><span class='dot' style='background:#" + PLAYER_COLORS[i % PLAYER_COLORS.length].toString(16).padStart(6, "0") + "'></span><b>" +
      (playerNames[i] || ("Player " + (i + 1))).replace(/</g, "&lt;") + "</b><span>" + (sk ? sk.icon + " " + sk.name : "") + (i === 0 ? " · host" : "") + (i === myIdx ? " · you" : "") + "</span></div>";
  }).join("");
  var hud = document.createElement("div"); hud.id = "lobby3d-hud";
  hud.innerHTML = "<div class='sheet'>" +
    "<div class='lb-head'><div><span class='k'>Lobby code</span><div class='code' onclick='copyCode()' title='Click to copy'>" + rawCode + "</div></div>" +
    "<div class='lb-count'><b>" + present.length + "</b>/" + MAX_PLAYERS + "<span>players</span></div></div>" +
    "<div class='lb-list'>" + list + "</div>" +
    "<div class='lb-k'>Mode</div><div class='lb-mode'>" +
      [["battle", "⚔️ Battle", "Everyone at once — points, knockouts, items"], ["classic", "⛳ Classic", "Fewest throws wins"]].map(function(o) { return "<button" + (BT.mode === o[0] ? " class='on'" : "") + (isHost ? " onclick='_lobbySet(\"mode\",\"" + o[0] + "\")'" : " disabled") + " title='" + o[2] + "'>" + o[1] + "</button>"; }).join("") + "</div>" +
    "<div class='lb-k'>Items</div><div class='lb-mode'>" +
      [["off", "Off"], ["normal", "Normal"], ["chaos", "🔥 Chaos"]].map(function(o) { return "<button" + (BT.items === o[0] ? " class='on'" : "") + (isHost ? " onclick='_lobbySet(\"items\",\"" + o[0] + "\")'" : " disabled") + ">" + o[1] + "</button>"; }).join("") + "</div>" +
    "<div class='lobby-meta'><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk · <kbd>Space</kbd> jump · <kbd>R</kbd> bonk</div>" +
    "<div class='lobby-actions'>" +
    (isHost && present.length >= 2 ? "<button class='btn primary big block' onclick='hostStartGame()'>Start game</button>"
      : "<div class='status'>" + (isHost ? "Share the code — waiting for players…" : "Waiting for the host to start…") + "</div>") +
    "<button class='btn block' onclick='openProfile(\"character\")'>Change look</button>" +
    "<button class='btn block ghost' onclick='leaveLobby()'>Leave</button></div></div>";
  L.overlay.appendChild(hud);
  if (typeof _lobbyMobileControls === "function") _lobbyMobileControls();
}

function _lobbySet(k, v) {
  BT[k] = v;
  if (myIdx === 0) sendToAll({ t: "lobby_cfg", mode: BT.mode, items: BT.items });
  _lobbyHud();
}
// Called from the main loop while the lobby is open
function _lobbyTick(dt) {
  var L = _lobby3D; if (!L) return;
  L.T += dt;
  var y0 = LOBBY_Y(), cy = L.camYaw;
  // ── me: camera-relative movement, jump, island bounds, basket pole ──
  var f = 0, r = 0;
  if (keys.w || keys.W) f += 1; if (keys.s || keys.S) f -= 1; if (keys.d || keys.D) r += 1; if (keys.a || keys.A) r -= 1;
  if (typeof PL !== "undefined" && PL.stick.active) { f = -PL.stick.y; r = PL.stick.x; }
  var l = Math.hypot(f, r); if (l > 1) { f /= l; r /= l; }
  var spd = keys.Shift ? 7 : 4.6, fx = Math.sin(cy), fz = -Math.cos(cy);
  var tx = (fx * f + Math.cos(cy) * r) * spd, tz = (fz * f + Math.sin(cy) * r) * spd;
  L.vel.x += (tx - L.vel.x) * Math.min(1, dt * 12); L.vel.y += (tz - L.vel.y) * Math.min(1, dt * 12);
  var p = L.myPos; p.x += L.vel.x * dt; p.z += L.vel.y * dt;
  var d = Math.hypot(p.x, p.z); if (d > LOBBY_R) { p.x *= LOBBY_R / d; p.z *= LOBBY_R / d; }
  if (d < 0.75) { p.x *= 0.75 / (d || 1); p.z *= 0.75 / (d || 1); }
  var ground = y0;
  if ((keys[" "] || (typeof PL !== "undefined" && PL.jumpHeld)) && p.y <= ground + 0.01) { L.vy = 7; AudioEngine.sfx("jump"); }
  L.vy -= 21 * dt; p.y += L.vy * dt; if (p.y < ground) { p.y = ground; L.vy = 0; }
  var hs = Math.hypot(L.vel.x, L.vel.y);
  if (hs > 0.3) { var ty = Math.atan2(L.vel.x, L.vel.y), dy = ty - L.myYaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; L.myYaw += dy * Math.min(1, dt * 12); }
  var anim = p.y > ground + 0.05 ? "jump" : hs > 5 ? "sprint" : hs > 0.4 ? "walk" : "idle";
  if (L.me) {
    var fl = (typeof _playerFeetLift === "function") ? _playerFeetLift(myIdx) : 0;
    L.me.position.set(p.x, p.y + fl, p.z); L.me.rotation.y = L.myYaw;
    if (L.me.userData.glbLoaded && L.meAnim !== anim) { L.meAnim = anim; switchAvatarAnim(L.me, anim); }
    if (typeof COS !== "undefined") COS.auraStep(L.me, p, hs, dt);
  }
  // bonk the nearest player (they feel it on their screen)
  if (L.punchCd > 0) L.punchCd -= dt;
  if ((keys.r || keys.R) && L.punchCd <= 0) {
    L.punchCd = 1.0; keys.r = keys.R = false;
    var best = null, bd = 2.6;
    Object.keys(L.avatars).forEach(function(k) { var av = L.avatars[k], dd = Math.hypot(av.x - p.x, av.z - p.z); if (dd < bd) { bd = dd; best = av; } });
    if (best) {
      var nx = (best.x - p.x) / (bd || 1), nz = (best.z - p.z) / (bd || 1);
      sendToAll({ t: "lobby_bonk", target: best.idx, dx: nx, dz: nz });
      if (typeof _spawnBonkText === "function") _spawnBonkText(new THREE.Vector3(best.x, best.y + 2, best.z));
      AudioEngine.sfx("bonk");
    }
  }
  // network: my position ~15 Hz
  L.sendAcc += dt;
  if (L.sendAcc > 0.066) { L.sendAcc = 0; sendToAll({ t: "lobby_pos", px: Math.round(p.x * 100) / 100, py: Math.round(p.y * 100) / 100, pz: Math.round(p.z * 100) / 100, yaw: Math.round(L.myYaw * 100) / 100, an: anim }); }
  // ── others: glide toward their last network position ──
  Object.keys(L.avatars).forEach(function(k) {
    var av = L.avatars[k]; if (av.nx === null) return;
    var kk = Math.min(1, dt * 12);
    av.x += (av.nx - av.x) * kk; av.z += (av.nz - av.z) * kk; av.y += ((av.ny === null ? y0 : av.ny) - av.y) * kk;
    var dy2 = av.nyaw - av.yaw; while (dy2 > Math.PI) dy2 -= Math.PI * 2; while (dy2 < -Math.PI) dy2 += Math.PI * 2; av.yaw += dy2 * kk;
    var fl2 = (typeof _playerFeetLift === "function") ? _playerFeetLift(av.idx) : 0;
    av.mesh.position.set(av.x, av.y + fl2, av.z); av.mesh.rotation.y = av.yaw;
    if (av.mesh.userData.glbLoaded && av.anim !== av.nanim) { av.anim = av.nanim; switchAvatarAnim(av.mesh, av.anim || "idle"); }
  });
  // ── decor ──
  L.decor.forEach(function(b) { b.o.position.y = 2.6 + (b.ph % 3) * 0.35 + Math.sin(L.T * 1.3 + b.ph) * 0.12; });
  if (L.ring) { var s = 1 + Math.sin(L.T * 2) * 0.04; L.ring.scale.set(s, s, s); L.ring.material.opacity = 0.35 + Math.sin(L.T * 2) * 0.15; }
  // ── camera: gentle orbit behind the island, follows me a little ──
  L.camYaw = 0.65 + Math.sin(L.T * 0.08) * 0.12;
  var cd = 12.5;
  camera.position.set(p.x * 0.35 - Math.sin(L.camYaw) * cd, y0 + 6.2, p.z * 0.35 + Math.cos(L.camYaw) * cd);
  camera.lookAt(p.x * 0.35, y0 + 1.2, p.z * 0.35);
  // ── labels ──
  var proj = function(el, v3) {
    if (!el) return; var v = v3.clone(); v.y += 2.15; v.project(camera);
    if (v.z > 1) { el.style.display = "none"; return; }
    el.style.display = "block"; el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + "px"; el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + "px";
  };
  proj(L.meLabel, p);
  Object.keys(L.avatars).forEach(function(k) { var av = L.avatars[k]; proj(av.label, new THREE.Vector3(av.x, av.y, av.z)); });
}
function _lobbyMobileControls() {}

function _makeFallbackAvatar(color) {
  var g = new THREE.Group();
  var bM = new THREE.MeshLambertMaterial({color:color||0x00ffff});
  var h = new THREE.Mesh(new THREE.SphereGeometry(.2,6,4), new THREE.MeshLambertMaterial({color:0xf5cba7}));
  h.position.y=1.62; g.add(h);
  var t = new THREE.Mesh(new THREE.CylinderGeometry(.13,.15,.5,6), bM);
  t.position.y=1.1; g.add(t);
  return g;
}

function _destroyLobby3D() {
  if (!_lobby3D) return;
  var L = _lobby3D;
  Object.keys(L.avatars).forEach(function(k) { _lobbyDropAvatar(+k); });
  if (L.me) { _lobbyStopMixers(L.me); L.group.remove(L.me); }
  if (L.meLabel) L.meLabel.remove();
  if (L.group.parent) L.group.parent.remove(L.group);
  if (typeof GFX !== "undefined") GFX.disposeTree(L.group);
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
  peer.on("connection", (c) => _hostIncoming(c));
  _relayHostStart(rawCode, _hostIncoming);
  });
}

// A guest knocking — via a direct WebRTC link or through the relay
function _hostIncoming(c) {
    if (playerCount >= MAX_PLAYERS || hostGameStarted) { c.close(); return; }
    var _stopWatch = _watchIce(c, function(st) {
      if (st === "failed") { try { c.close(); } catch (e) {} var ms = document.getElementById("mp-status"); if (ms) ms.textContent = "A player tried to join but their network blocked the link."; }
    });
    c.on("open", () => {
      _stopWatch();
      if (playerCount >= MAX_PLAYERS || hostGameStarted) { c.close(); return; }
      const newIdx = playerCount++;          // a slot is only taken once the link actually works
      conns[newIdx] = c;
      playerNames[newIdx] = "Player " + (newIdx + 1);
      setupConnForPlayer(c, newIdx);
      var _allSkins = Object.assign({}, window._remoteSkins || {});
      _allSkins[0] = (typeof equippedPlayerSkin !== "undefined") ? equippedPlayerSkin : "default";
      var _allCos = Object.assign({}, window._remoteCos || {}); _allCos[0] = COS.equipped();
      c.send(JSON.stringify({ t: "player_joined", yourIdx: newIdx, playerCount, names: playerNames, allSkins: _allSkins, allCos: _allCos }, _netReplacer));
      conns.forEach((oc, oi) => {
        if (oi !== newIdx && oi !== 0 && oc && oc.open)
          oc.send(JSON.stringify({ t: "player_joined", playerCount, names: playerNames, allSkins: _allSkins, allCos: _allCos }));
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
}

function hostStartGame() {
  AudioEngine.init();
  _SP_FORCED_THEME = null;
  hostGameStarted = true;
  mpMode          = true;
  matchSeed       = Math.floor(Math.random() * 1000000000);
  HOLES           = [];
  BT.newMatch();
  // Don't pre-generate — loadHole(0) uses seed (matchSeed + 0*7331)
  // Clients generate identically via their own loadHole(0) with same matchSeed

  conns.forEach((c, pIdx) => {
    if (!c || !c.open) return;
    // Build complete skin map: host idx=0 + all remote players
    var _fullSkins = Object.assign({}, window._remoteSkins || {});
    _fullSkins[0] = (typeof equippedPlayerSkin !== "undefined") ? equippedPlayerSkin : "default";
    sendTo(pIdx, { t: "start", myIdx: pIdx, playerCount, names: playerNames, matchSeed, hostNow: Date.now(),
    holes: [], activeThemes: ACTIVE_THEMES, holeCount: HOLE_COUNT, difficulty: DIFFICULTY, mode: BT.mode, items: BT.items,
    hostSkins: equippedSkins,
    remoteSkins: _fullSkins, remoteCos: Object.assign({}, window._remoteCos || {}, { 0: COS.equipped() }) });
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
  window._joinedCode = code;
  if (!code) return;
  document.getElementById("join-status").textContent = "Connecting…";
  if (typeof Peer === "undefined") {
    document.getElementById("join-status").textContent = "Error: Multiplayer library not loaded."; return;
  }
  _destroyPeer(function() {
    conns.fill(null); hostGameStarted = false;
    // 1) Host open in another tab of this browser? Talk through the browser itself.
    var lb = _busLocal();
    if (!lb) { _joinNet(code); return; }
    document.getElementById("join-status").textContent = "Looking for the host…";
    _hubJoin(lb, code, 0.8, function(rc) {
      if (!rc) { _joinNet(code); return; }
      conns[0] = rc; setupConnForPlayer(rc, 0);
      _greetHost(rc);
    });
  });
}
function _greetHost(conn) {
  document.getElementById("join-status").textContent = conn.viaRelay ? "Connected (via relay)! Waiting for host…" : "Connected! Waiting for host…";
  var _un = document.getElementById("username-input");
  conn.send(JSON.stringify({ t: "my_name", name: (_un && _un.value.trim()) || "Player 2", cos: COS.equipped(),
    playerSkin: (typeof equippedPlayerSkin !== "undefined") ? equippedPlayerSkin : "default" }));
}
// 2) Direct WebRTC link, 3) internet relay when the direct link fails
function _joinNet(code) {
  {
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
      var js = document.getElementById("join-status"), fellBack = false, greet = _greetHost;
      var fallback = function() {
        if (fellBack || c.open || everOpen) return;
        fellBack = true;
        if (conns[0] === c) conns[0] = null;
        try { c.close(); } catch (e) {}
        js.textContent = "Direct link blocked — connecting through the relay…";
        _relayJoin(code, function(rc, why) {
          if (!rc) { js.textContent = _relayFailMsg(why); return; }
          conns[0] = rc;
          setupConnForPlayer(rc, 0);
          greet(rc);
        });
      };
      _watchIce(c, function(st) {
        if (st === "checking") js.textContent = "Found the host, linking devices…";
        else if (st === "failed" || st === "disconnected") fallback();
      });
      var everOpen = false;
      c.on("open", function() { everOpen = true; if (!fellBack) greet(c); });
      c.on("close", function() { if (!everOpen && !fellBack) fallback(); });
      setTimeout(fallback, 7000);   // direct link still not up → don't keep the player waiting
    });
  }
}