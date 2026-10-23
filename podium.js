"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── PODIUM — the end-of-round leaderboard, live ──────────────────────────────
// A stage floats in the sky over the last hole. Everyone stands on it in finishing
// order: the winner bounces with both arms up (and backflips), the runners-up
// clap, last place slumps with its head down. Name + score tags hover over each
// avatar; the board next to it lists the standings. Emote buttons play on your
// podium avatar and everyone else's screen. Single player adds a "best rounds"
// board (saved locally) so there's always someone to beat: you.
// ══════════════════════════════════════════════════════════════════════════════
var POD = { on: false, grp: null, avs: [], t: 0, base: new THREE.Vector3() };

// rows: best first — { i: player index, name, score, sub }; opts: { title, sub, mood (single player), html, actions }
POD.show = function(rows, opts) {
  POD.hide();
  opts = opts || {};
  var h = HOLES[holeIdx], C = h && h.course;
  POD.base.set(C ? C.basket.x : 0, (C ? C.basket.y : 0) + 32, C ? C.basket.z : 0);
  if (C && C.ceilMesh) C.ceilMesh.visible = false;
  POD.on = true; POD.t = 0; phase = "MENU";
  // tidy the world away
  hideMsg(); _setWalkHud(false); setSpectating(false);
  document.getElementById("ui").style.display = "none";
  [discMesh, localAvatarMesh, fpHandMesh, discMarker, trajLandRing].forEach(function(o) { if (o) o.visible = false; });
  (trajDots || []).forEach(function(d) { d.visible = false; });
  remotePlayers.forEach(function(rp) { if (!rp) return; if (rp.avatarMesh) rp.avatarMesh.visible = false; if (rp.discMesh) rp.discMesh.visible = false; if (rp.nameLabel) rp.nameLabel.style.display = "none"; });
  if (typeof VEH !== "undefined") VEH.exit && VEH.mySeat && VEH.exit();
  AudioEngine.charge(0); AudioEngine.slide(false);
  // ── the stage ──
  var g = POD.grp = new THREE.Group(); g.position.copy(POD.base); courseGrp.add(g);
  var M = function(c, o) { return ENT.mat(c, o); };
  var deck = new THREE.Mesh(new THREE.CylinderGeometry(7, 6.2, 1, 40), M(0x2a3a6a, { roughness: 0.5 })); deck.position.y = -0.5; deck.receiveShadow = true; g.add(deck);
  var rim = new THREE.Mesh(new THREE.TorusGeometry(7, 0.12, 8, 60), new THREE.MeshBasicMaterial({ color: 0xffd23a })); rim.rotation.x = Math.PI / 2; g.add(rim);
  var under = new THREE.Mesh(new THREE.ConeGeometry(6.2, 5, 40, 1, true), M(0x5a4a3a, { roughness: 0.9 })); under.rotation.x = Math.PI; under.position.y = -3.5; g.add(under);
  var SLOT = [{ x: 0, h: 1.5, c: 0xffd23a }, { x: -2.3, h: 1.0, c: 0xd8dce6 }, { x: 2.3, h: 0.65, c: 0xd88a4a }];
  SLOT.forEach(function(s, k) {
    var b = new THREE.Mesh(new THREE.BoxGeometry(2.1, s.h, 2.1), M(s.c, { roughness: 0.35, metalness: k === 0 ? 0.5 : 0.3 })); b.position.set(s.x, s.h / 2, 0); b.castShadow = b.receiveShadow = true; g.add(b);
    var lab = POD._num(k + 1); lab.position.set(s.x, s.h / 2, 1.06); g.add(lab);
  });
  var spot = new THREE.SpotLight(0xfff0d0, 2.2, 30, 0.6, 0.5, 1); spot.position.set(0, 12, 6); spot.target.position.set(0, 1, 0); g.add(spot); g.add(spot.target);
  // ── the players ──
  POD.rows = rows; POD.avs = [];
  rows.forEach(function(r, k) {
    var av = buildPlayerAvatar(r.i, PLAYER_COLORS[r.i % PLAYER_COLORS.length]);
    var sd = (k - 3) % 2 ? 1 : -1, p = k < 3 ? new THREE.Vector3(SLOT[k].x, SLOT[k].h, 0) : new THREE.Vector3(sd * (4.3 + Math.floor((k - 3) / 2) * 1.3), 0, 0.4 + Math.floor((k - 3) / 2) * 0.9);
    av.position.copy(p); av.rotation.y = (k < 3 ? 0 : -sd * 0.45);
    g.add(av);
    var mood = opts.mood || (k === 0 ? "win" : k === rows.length - 1 && rows.length > 2 ? "sad" : "clap");
    var tag = document.createElement("div"); tag.className = "pod-tag" + (r.i === myIdx ? " me" : "");
    tag.innerHTML = "<b>" + _esc(r.name) + "</b><span>" + r.score + "</span>"; tag.style.setProperty("--c", _pcol(r.i));
    document.body.appendChild(tag);
    POD.avs.push({ g: av, k: k, row: r, p: p, mood: mood, tag: tag, ph: Math.random() * 6, flipAt: 1.5 + Math.random() * 2 });
  });
  GFX._focus.copy(POD.base);
  // ── the board ──
  var ui = document.createElement("div"); ui.id = "podium-ui";
  var medal = ["🥇", "🥈", "🥉"];
  ui.innerHTML = "<div class='sheet'>" +
    "<div class='pod-title'>" + (opts.title || "Results") + "</div>" + (opts.sub ? "<div class='pod-sub'>" + opts.sub + "</div>" : "") +
    "<div class='pod-rows'>" + rows.map(function(r, k) {
      return "<div class='pod-row" + (r.i === myIdx ? " me" : "") + "' style='--c:" + _pcol(r.i) + ";animation-delay:" + (0.15 + k * 0.12) + "s'><span class='rk'>" + (medal[k] || "#" + (k + 1)) + "</span><i></i><b>" + _esc(r.name) + "</b><em>" + (r.sub || "") + "</em><span class='sc'>" + r.score + "</span></div>";
    }).join("") + "</div>" +
    (opts.html || "") +
    "<div class='pod-emotes'>" + EMOTE.avail().map(function(e) { return "<button class='chip' title='" + e.name + "' onclick='POD.emote(\"" + e.id + "\")'>" + e.icon + "</button>"; }).join("") + "</div>" +
    "<div class='fc-actions'>" + (opts.actions || "<button class='btn primary big' onclick='POD.toMenu()'>Main menu</button>") + "</div></div>";
  document.body.appendChild(ui);
  AudioEngine.stinger("round");
  setTimeout(function() { if (POD.on) AudioEngine.crowd("roar"); }, 400);
};
POD._num = function(n) {
  var c = document.createElement("canvas"); c.width = c.height = 128; var x = c.getContext("2d");
  x.fillStyle = "rgba(0,0,0,0)"; x.fillRect(0, 0, 128, 128); x.font = "900 96px Nunito, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.lineWidth = 10; x.strokeStyle = "#10324a"; x.strokeText(n, 64, 70); x.fillStyle = "#fff"; x.fillText(n, 64, 70);
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
};

POD.hide = function() {
  if (POD.grp && POD.grp.parent) POD.grp.parent.remove(POD.grp);
  POD.grp = null;
  POD.avs.forEach(function(a) { if (a.tag.parentNode) a.tag.remove(); });
  POD.avs = []; POD.on = false;
  var ui = document.getElementById("podium-ui"); if (ui) ui.remove();
};
POD.toMenu = function() {
  POD.hide();
  if (mpMode && typeof leaveLobby === "function") leaveLobby();
  _fcMenu();
};
POD.again = function() { POD.hide(); _fcAgain(); };

// ── emotes from the podium ──
POD.emote = function(id) {
  var me = POD.avs.find(function(a) { return a.row.i === myIdx; }); if (!me) return;
  POD._play(me, id);
  if (mpMode) sendToAll({ t: "emote", i: myIdx, e: id, pod: 1 });
};
POD.onEmote = function(m) { var a = POD.avs.find(function(x) { return x.row.i === m.i; }); if (a) POD._play(a, m.e); };
POD._play = function(a, id) {
  var e = EMOTE.LIST.find(function(x) { return x.id === id; }) || EMOTE.LIST[0];
  if (id === "flip") ANIM.flip(a.g); else if (e.proc) ANIM.dance(a.g, id); else { a.emote = id; a.emoteT = 2.5; }
  var hp = a.g.getWorldPosition(new THREE.Vector3()); hp.y += 2.6;
  if (typeof _spawnBonkText === "function") _spawnBonkText(hp, e.icon);
  AudioEngine.sfx(e.sfx, 0.6);
};

// ── per frame (from the menu branch of the main loop) ──
POD._v = new THREE.Vector3();
POD.tick = function(dt) {
  if (!POD.on || !POD.grp) return;
  POD.t += dt;
  var B = POD.base, t = POD.t, a = Math.sin(t * 0.18) * 0.35, intro = Math.min(1, t / 2.2), ease = 1 - Math.pow(1 - intro, 3);
  var tall = innerWidth < 760, dist = (tall ? 17 : 14.5) - ease * 3.2, wide = innerWidth > innerHeight * 1.2 ? 2.8 : 0;   // stage left of the board on wide screens, above it on phones
  camera.position.set(B.x + Math.sin(a) * dist + wide, B.y + 2.9 + (1 - ease) * 6, B.z + Math.cos(a) * dist);
  camera.lookAt(B.x + wide, B.y + (tall ? -1.6 : 2.2), B.z);
  if (Math.abs(camera.fov - 50) > 0.1) { camera.fov = 50; camera.updateProjectionMatrix(); }
  var beat = t * 2.4;
  POD.avs.forEach(function(A) {
    var g = A.g; if (!g.userData.glbLoaded) return;
    if (!A.started) { A.started = true; switchAvatarAnim(g, "idle"); }
    ANIM.drive(g, 0, dt, { grounded: true, fidget: false });
    var st = ANIM._state(g), gb = st && ANIM._goofyBones(st), mood = A.emoteT > 0 ? "win" : A.mood;
    if (st && st.dance) { g.position.y = A.p.y; return; }   // a victory dance owns the arms
    if (A.emoteT > 0) A.emoteT -= dt;
    g.position.y = A.p.y; g.rotation.x = 0;
    if (!gb) return;
    g.updateMatrixWorld(true);
    var yaw = g.rotation.y, side = POD._v.set(Math.cos(yaw), 0, -Math.sin(yaw)).clone(), fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), up = new THREE.Vector3(0, 1, 0);
    if (mood === "win") {
      g.position.y = A.p.y + Math.abs(Math.sin(beat * Math.PI * 0.5 + A.ph)) * 0.35;
      ANIM._rotW(gb.uaL, fwd, 2.55 + Math.sin(beat * 2 + A.ph) * 0.3); ANIM._rotW(gb.uaR, fwd, -2.55 - Math.sin(beat * 2 + A.ph + 1) * 0.3);
      if (gb.laL) ANIM._rotW(gb.laL, fwd, 0.4); if (gb.laR) ANIM._rotW(gb.laR, fwd, -0.4);
      if ((A.flipAt -= dt) <= 0) { A.flipAt = 3.5 + Math.random() * 2.5; ANIM.flip(g); }
    } else if (mood === "clap") {
      var c = Math.sin(t * 15 + A.ph) * 0.5 + 0.5;
      g.position.y = A.p.y + Math.abs(Math.sin(beat * Math.PI * 0.5 + A.ph)) * 0.08;
      ANIM._rotW(gb.uaL, side, -1.25); ANIM._rotW(gb.uaR, side, -1.25);
      ANIM._rotW(gb.uaL, up, -0.25 - c * 0.45); ANIM._rotW(gb.uaR, up, 0.25 + c * 0.45);
      if (gb.laL) ANIM._rotW(gb.laL, side, -0.5); if (gb.laR) ANIM._rotW(gb.laR, side, -0.5);
    } else {   // sad
      g.rotation.x = 0.12;
      if (gb.neck) ANIM._rotW(gb.neck, side, 0.45); ANIM._rotW(gb.head, side, 0.4 + Math.sin(t * 0.7) * 0.05);
      ANIM._rotW(gb.uaL, fwd, -0.12); ANIM._rotW(gb.uaR, fwd, 0.12);
      if (Math.sin(t * 0.55 + A.ph) > 0.995) ANIM.squash(g, 0.2);
    }
  });
  // tags over the heads
  POD.avs.forEach(function(A) {
    var hp = A.g.getWorldPosition(POD._v); hp.y += 2.75; hp.project(camera);
    if (hp.z > 1) { A.tag.style.display = "none"; return; }
    A.tag.style.display = "block"; A.tag.style.left = ((hp.x * 0.5 + 0.5) * innerWidth) + "px"; A.tag.style.top = ((-hp.y * 0.5 + 0.5) * innerHeight) + "px";
  });
  // confetti cannons
  if ((POD._cf = (POD._cf || 0) + dt) > (t < 3 ? 0.05 : 0.22)) {
    POD._cf = 0;
    [-1, 1].forEach(function(s) {
      var m = _pMesh("box", new THREE.Color().setHSL(Math.random(), 0.9, 0.62), 0.12, false);
      _pAdd(m, new THREE.Vector3(B.x + s * 6, B.y + 0.3, B.z - 1), new THREE.Vector3(-s * (2 + Math.random() * 3), 10 + Math.random() * 5, (Math.random() - 0.3) * 4), 2.2, { grav: 6, spin: 8, drag: 0.6 });
    });
  }
};

// ── single player: personal best rounds ──
POD.saveRound = function(vsPar) {
  var R = dgStats.rounds || (dgStats.rounds = []);
  R.push({ v: vsPar, h: HOLE_COUNT, d: DIFFICULTY, t: Date.now() });
  if (R.length > 60) R.splice(0, R.length - 60);
  saveStats();
  return R[R.length - 1];
};
POD.bestBoard = function(cur) {
  var R = (dgStats.rounds || []).filter(function(r) { return r.h === cur.h && r.d === cur.d; }).sort(function(a, b) { return a.v - b.v || a.t - b.t; }).slice(0, 5);
  if (R.indexOf(cur) < 0) R.push(cur);
  return "<div class='pod-best'><div class='k'>Your best · " + cur.h + " holes · " + cur.d + "</div>" + R.map(function(r, k) {
    return "<div class='pb-row" + (r === cur ? " now" : "") + "'><span>" + (r === cur && k >= 5 ? "–" : "#" + (k + 1)) + "</span><b>" + _fmtPar(r.v) + "</b><em>" + new Date(r.t).toLocaleDateString() + (r === cur ? " · this round" : "") + "</em></div>";
  }).join("") + "</div>";
};

// ── multiplayer: final standings ──
POD.showMatch = function(totals) {
  var left = window._leftPlayers || {}, rows = [];
  for (var i = 0; i < playerCount; i++) {
    if (left[i]) continue;
    var bt = typeof BT !== "undefined" && BT.on();
    rows.push({ i: i, name: playerNames[i] || ("Player " + (i + 1)), v: bt ? -(BT.pts[i] || 0) : (mpTotals[i] || 0),
      score: bt ? (BT.pts[i] || 0) + " pts" : _fmtPar(mpTotals[i] || 0), sub: bt ? (BT.kos[i] || 0) + " KOs" : "" });
  }
  rows.sort(function(a, b) { return a.v - b.v; });
  var w = rows[0];
  POD.show(rows, { title: w ? "🏆 " + _esc(w.name.length <= 14 ? w.name : w.name.split(" ")[0]) + " wins!" : "Game over", sub: HOLE_COUNT + " holes · " + (BT.on() ? "battle" : "stroke play") + (w && w.i === myIdx ? " · <b>that's you!</b>" : "") });
};
