// ── UI HELPERS ────────────────────────────────────────────────────────────────
// All DOM manipulation: HUD updates, message overlay, score cards, menus.
// Depends on: config.js (LOFTS, DISCS, PLAYER_COLORS, MAX_PLAYERS),
//             game-state globals (phase, throwCount, holeIdx, HOLES, etc.)

function setInstr(t) {
  document.getElementById("instr").innerHTML = t;
}

function showMsg(big, sub, btnTxt) {
  document.getElementById("msg-big").textContent = big;
  document.getElementById("msg-big").style.color = "";
  document.getElementById("msg-sub").textContent = sub;
  const btn = document.getElementById("msg-btn");
  if (btnTxt) { btn.textContent = btnTxt; btn.style.display = "inline-flex"; }
  else btn.style.display = "none";
  document.getElementById("msg").classList.add("on");
}

function hideMsg() {
  document.getElementById("msg").classList.remove("on");
}

function _themeName(theme) {
  var n = (typeof MAP_DISPLAY_NAMES !== "undefined" && MAP_DISPLAY_NAMES[theme]) || theme || "";
  return n.replace(/^[^A-Za-z0-9]+\s*/, "");
}
function updateScoreUI() {
  if (mpMode) return;
  const h = HOLES[holeIdx];
  if (!h) return;
  document.getElementById("hole-n").textContent = h.n;
  var of = document.getElementById("hole-of"); if (of) of.textContent = " / " + HOLE_COUNT;
  document.getElementById("hole-theme-txt").textContent = _themeName(h.theme) + (h.templateLabel ? " · " + h.templateLabel : "");
  document.getElementById("par-v").textContent = h.par;
  document.getElementById("throw-n").textContent = throwCount;
  const _tv = Math.round(totalVsPar);
  const tv = document.getElementById("tot-v");
  tv.textContent = _tv === 0 ? "E" : _tv > 0 ? "+" + _tv : "" + _tv;
  tv.className = _tv < 0 ? "under" : _tv > 0 ? "over" : "";
}

function _pcol(i) { return "#" + new THREE.Color(PLAYER_COLORS[i % PLAYER_COLORS.length]).convertLinearToSRGB().getHexString(); }

function buildScoreboardUI() {
  const sb = document.getElementById("mp-scores");
  if (!sb) return;
  sb.innerHTML = "";
  for (let i = 0; i < playerCount; i++) {
    const card = document.createElement("div");
    card.className = "mp-p" + (i === myIdx ? " me" : "");
    card.id = "mpcard-" + i;
    card.innerHTML =
      `<div class="pname" id="mpname-${i}" style="color:${_pcol(i)}"></div>` +
      `<div class="pscore" id="mpscore-${i}">E</div>` +
      `<div class="pthrows" id="mpthrows-${i}"></div>`;
    sb.appendChild(card);
  }
}

function updateMpUI() {
  for (let i = 0; i < playerCount; i++) {
    const nameEl   = document.getElementById("mpname-"   + i);
    const scoreEl  = document.getElementById("mpscore-"  + i);
    const throwsEl = document.getElementById("mpthrows-" + i);
    if (nameEl)   nameEl.textContent  = playerNames[i];
    if (typeof BT !== "undefined" && BT.on() && BT.pts.length) {
      var _br = BT.boardRow(i);
      if (scoreEl) scoreEl.textContent = _br.score;
      if (throwsEl) throwsEl.textContent = _br.sub;
      continue;
    }
    if (scoreEl)  scoreEl.textContent = mpTotals[i] === 0 ? "E" : mpTotals[i] > 0 ? "+" + mpTotals[i] : "" + mpTotals[i];
    if (throwsEl) throwsEl.textContent = playerDone[i]
      ? "\u2713 " + playerThrows[i]
      : i === myIdx && throwCount > 0 ? "throw " + throwCount : "";
  }
}

// Wind arrow is drawn relative to where the camera is looking (up = with your throw)
function updateWindUI() {
  if (!HOLES[holeIdx]) return;
  const w = HOLES[holeIdx].wind;
  const mult = (typeof getWeatherWindMult === "function") ? getWeatherWindMult() : 1;
  const spd = (Math.hypot(w.x, w.z) * mult).toFixed(1);
  const ang = Math.atan2(w.x, -w.z);
  var camYaw = aimAngle;
  if (typeof camera !== "undefined" && camera) {
    var fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    if (Math.hypot(fwd.x, fwd.z) > 0.05) camYaw = Math.atan2(fwd.x, -fwd.z);
  }
  var rel = (ang - camYaw) * 180 / Math.PI;
  var arr = document.getElementById("w-arrow");
  if (arr) arr.style.transform = "rotate(" + rel.toFixed(1) + "deg)";
  var sp = document.getElementById("w-spd");
  if (sp && sp.textContent !== spd) sp.textContent = spd;
}

function updateLobbyUI() {
  const list = document.getElementById("lobby-list");
  const btn  = document.getElementById("start-game-btn");
  if (!list) return;
  list.innerHTML = Array.from({ length: playerCount }, (_, i) =>
    `<span class="chip"><span class="dot" style="background:${_pcol(i)}"></span>${(playerNames[i] || "Player " + (i + 1)).replace(/</g, "&lt;")}</span>`
  ).join("");
  if (btn) btn.style.display = playerCount >= 2 ? "" : "none";
  document.getElementById("mp-status").textContent =
    playerCount >= MAX_PLAYERS ? "Lobby full" : `Waiting for players\u2026 ${playerCount} / ${MAX_PLAYERS}`;
}

// ── DISC SELECTOR IN GAME ────────────────────────────────────────────────────
function _discCss(key) {
  var d = DISCS[key] || {};
  var c = d.colors ? d.colors[0] : d.color;
  if (typeof getSkin === "function") { var sk = getSkin(key); if (sk && sk.color) c = sk.color; }
  return "#" + ((c || 0x888888) >>> 0).toString(16).padStart(6, "0");
}
// "Best: 35-80% power" → [0.35, 0.8]
function _discSweetSpot(key) {
  var d = DISCS[key] || {};
  var m = /(\d+)\s*[-–]\s*(\d+)%/.exec(d.tip || "");
  if (m) return [parseInt(m[1], 10) / 100, parseInt(m[2], 10) / 100];
  return [d.minPower || 0.2, d.maxPower || 1];
}
function updateDiscLabel() {
  var el = document.getElementById("disc-label"); if (!el) return;
  var d = DISCS[selectedDisc] || {}, ss = _discSweetSpot(selectedDisc);
  var sk = (typeof COS !== "undefined") ? COS.discSkin((equippedSkins || {})[selectedDisc] || "classic") : null;
  el.innerHTML = (d.label || selectedDisc) + (sk && sk.id !== "classic" ? " · " + sk.name : "") + " <span>· best " + Math.round(ss[0] * 100) + "–" + Math.round(ss[1] * 100) + "%</span>";
  var z = document.getElementById("pwr-zone");
  if (z) { z.style.left = (ss[0] * 100) + "%"; z.style.width = ((ss[1] - ss[0]) * 100) + "%"; }
}
function initGameDiscPicker() {
  const container = document.getElementById("disc-opts-container");
  if (!container) return;
  container.innerHTML = "";
  Object.keys(DISCS).forEach((key, i) => {
    const d   = DISCS[key];
    const b = document.createElement("button");
    b.className  = "dopt" + (key === selectedDisc ? " on" : "");
    b.dataset.t  = key;
    b.title = (d.label || key) + " — " + (d.desc || d.tip || "") + "  (" + (i + 1) + ")";
    b.setAttribute("aria-label", d.label || key);
    b.innerHTML = '<span class="orb" style="--c:' + _discCss(key) + '"></span><span class="dkey">' + (i + 1) + '</span>';
    b.onclick = () => selectDisc(key);
    container.appendChild(b);
    // show the real skin artwork on the button
    var skinId = (equippedSkins || {})[key] || "classic";
    if (typeof PF !== "undefined" && PF.thumb) PF.thumb("disc:" + key + ":" + skinId, function(url) {
      var orb = b.querySelector(".orb"); if (orb) { orb.classList.add("pic"); orb.style.setProperty("--img", "url(" + url + ")"); }
    });
  });
  updateDiscLabel();
}

// ── STEP-BACK / UNDO ─────────────────────────────────────────────────────────

function pushThrowHistory() {
  throwHistory.push({ pos: discPos.clone(), vel: discVel.clone(), throws: throwCount });
  if (throwHistory.length > 3) throwHistory.shift();  // keep last 3 throws
}
function clearThrowHistory() {
  throwHistory = [];
}
function stepBack() {
  if (throwHistory.length === 0 || stepBackCooldown > 0) return;
  if (phase !== "AIMING" && phase !== "LANDED" && phase !== "WALKING") return;
  const prev = throwHistory.pop();
  discPos.copy(prev.pos);
  discVel.set(0, 0, 0);
  throwCount = prev.throws;
  if (ENT.carrying) { ENT.carrying.state = null; ENT.carrying = null; }
  if (discMesh) discMesh.position.copy(discPos);
  if (typeof pickUpDisc === "function") pickUpDisc();
  stepBackCooldown = STEP_BACK_COOLDOWN;
  baseAim = autoAimAngle();
  aimAngle = baseAim;
  updateScoreUI();
  updateStepBackBtn();
}
function updateStepBackBtn() {
  var btn = document.getElementById("step-back-btn");
  if (!btn) return;
  var badge = document.getElementById("step-back-badge");
  var cd = Math.ceil(stepBackCooldown);
  var off = stepBackCooldown > 0 || throwHistory.length === 0;
  btn.classList.toggle("off", off);
  if (badge) badge.textContent = stepBackCooldown > 0 ? cd + "s" : (throwHistory.length ? throwHistory.length : "");
  btn.title = stepBackCooldown > 0 ? "Undo available in " + cd + "s" : throwHistory.length ? "Undo last throw" : "Nothing to undo yet";
}

// ── COPY MULTIPLAYER CODE ────────────────────────────────────────────────────
function copyCode() {
  const code = document.getElementById("mp-code").textContent;
  navigator.clipboard.writeText(code).then(() => {
    const flash = document.getElementById("copy-flash");
    flash.style.opacity = "1";
    setTimeout(() => (flash.style.opacity = "0"), 1500);
  }).catch(() => {
    const range = document.createRange();
    range.selectNode(document.getElementById("mp-code"));
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
}

// ── RELEASE ANGLE (hyzer / anhyzer) ──────────────────────────────────────────
// Negative = hyzer (curves left), positive = anhyzer (curves right). Q / E or the HUD button.
var releaseBank = 0;
var RELEASE_STEPS = [-0.52, -0.35, -0.17, 0, 0.17, 0.35, 0.52];
function setReleaseBank(v) {
  releaseBank = Math.max(-0.52, Math.min(0.52, v));
  updateReleaseUI();
  if (dragging) calcThrow();
}
function nudgeRelease(dir) {
  var i = RELEASE_STEPS.reduce(function(best, s, k) { return Math.abs(s - releaseBank) < Math.abs(RELEASE_STEPS[best] - releaseBank) ? k : best; }, 0);
  setReleaseBank(RELEASE_STEPS[Math.max(0, Math.min(RELEASE_STEPS.length - 1, i + dir))]);
}
function cycleRelease() { var i = RELEASE_STEPS.indexOf(releaseBank); setReleaseBank(RELEASE_STEPS[(i + 1) % RELEASE_STEPS.length] || 0); }
function updateReleaseUI() {
  var deg = Math.round(releaseBank * 180 / Math.PI);
  var lbl = document.getElementById("rel-lbl"), ic = document.getElementById("rel-icon");
  if (lbl) lbl.textContent = deg === 0 ? "Flat" : (deg < 0 ? "Hyzer " + (-deg) : "Anhyzer " + deg) + "\u00b0";
  if (ic) ic.style.transform = "rotate(" + (-deg) + "deg)";
}

// ── LOFT / DISC CONTROLS ─────────────────────────────────────────────────────
function cycleLoft() {
  loftIdx = (loftIdx + 1) % LOFTS.length;
  updateLoftUI();
  if (dragging) calcThrow();
}
function updateLoftUI() {
  var l = LOFTS[loftIdx];
  document.getElementById("loft-deg").textContent = l.label;
  var ic = document.getElementById("loft-icon");
  if (ic) ic.style.transform = "scaleY(" + (0.45 + l.a / 28 * 0.75).toFixed(2) + ")";
  var b = document.getElementById("loft-btn"); if (b) b.title = "Launch angle: " + l.label + " (" + l.a + "\u00b0)";
}

function selectDisc(t) {
  if (phase !== "AIMING") return;
  selectedDisc = t;
  document.querySelectorAll(".dopt").forEach((el) => el.classList.toggle("on", el.dataset.t === t));
  if (discMesh) { scene.remove(discMesh); GFX.disposeTree(discMesh); }
  discMesh = buildDisc(t);
  discMesh.frustumCulled = false;
  discMesh.traverse(function(c) { if (c.isMesh) { c.frustumCulled = false; c.renderOrder = 1; } });
  discMesh.position.copy(discPos);
  scene.add(discMesh);
  initTrail();
  updateDiscLabel();
  if (dragging) calcThrow();
}

// ── THROW INPUT ──────────────────────────────────────────────────────────────
var RELEASE_HEIGHT = 1.0;   // disc leaves the hand ~1 m above the ground
function calcThrow() {
  if (!ds || !dn) return;
  if (typeof phase === "undefined" || !HOLES[holeIdx]) return;
  const dx = dn.x - ds.x, dyUp = ds.y - dn.y;
  // FP mode: horizontal drag is reserved for mouse-look; only vertical sets power
  if (typeof cameraMode === "undefined" || cameraMode !== "fp") {
    aimAngle = baseAim + dx * 0.0042;
  }
  throwPower = Math.max(0, Math.min(1, dyUp / 130));

  const pwrFill = document.getElementById("pwr-fill");
  const pwrPct  = document.getElementById("pwr-pct");
  if (pwrFill) pwrFill.style.width = throwPower * 100 + "%";
  if (pwrPct)  pwrPct.textContent  = Math.round(throwPower * 100) + "%";

  if (throwPower > 0.05) {
    const launchVel = computeLaunchVelocity();
    // Start dots well above terrain surface
    const h   = HOLES[holeIdx];
    var startY = terrainY(discPos.x, discPos.z, h, holeIdx) + RELEASE_HEIGHT;
    var startPt = new THREE.Vector3(discPos.x, startY, discPos.z);
    updateTrajDots(startPt, launchVel);
  } else {
    trajDots.forEach((d) => (d.visible = false));
  }
}

// Shared launch velocity computation
// Simple reliable world-space throw: horizontal + vertical from loft angle.
function computeLaunchVelocity() {
  var d   = DISCS[selectedDisc] || DISCS.driver;
  var pwr = throwPower;

  // Enforce disc minPower: distance-heavy discs need power to fly properly.
  // Below their minimum, the disc stalls — loses distance, bad flight.
  var minP = d.minPower || 0;
  if (minP > 0 && pwr < minP) {
    var stallFrac = pwr / minP;   // 0 = dead, 1 = just at threshold
    pwr = minP * 0.28 * stallFrac;  // heavily penalised effective power
  }

  // Softer curve (pwr^0.8) so partial-power throws are still useful
  var spd  = Math.pow(pwr, 0.8) * (d.speed * 1.5 + 6) * d.launchMult;
  var lRad = (LOFTS[loftIdx].a * Math.PI) / 180;
  if (selectedDisc === "highloft") lRad += 0.18;
  var hSpd = spd * Math.cos(lRad);
  var vSpd = spd * Math.sin(lRad);
  return new THREE.Vector3(Math.sin(aimAngle)*hSpd, vSpd, -Math.cos(aimAngle)*hSpd);
}

function doThrow() {
  if (typeof phase === "undefined" || phase !== "AIMING") return;
  if (!HOLES[holeIdx]) return;
  lastValidPos.copy(discPos);

  var d = DISCS[selectedDisc] || DISCS.driver;
  var launchVel = computeLaunchVelocity();

  // Ensure disc is above island surface before throw
  var h = HOLES[holeIdx];
  // Launch from exactly on island surface, with small clearance to avoid clipping
  // Release from hand height
  var groundHere = terrainY(discPos.x, discPos.z, h, holeIdx);
  discPos.y = groundHere + RELEASE_HEIGHT;
  _throwStart = discPos.clone();
  AudioEngine.sfx("throw", throwPower);
  // The controls hint fades away once the player has thrown a couple of times
  window._dgThrowsSeen = (window._dgThrowsSeen || 0) + 1;
  if (window._dgThrowsSeen >= 2) { var _ins = document.getElementById("instr"); if (_ins) _ins.classList.add("fade"); }
  discBank[0] = releaseBank;
  _groundTime = 0;

  if (typeof PU !== "undefined" && PU.fireNext) { launchVel.multiplyScalar(1.4); PU.fireNext = false; PU.fireThrow = true; AudioEngine.sfx("energy"); }
  if (typeof BT !== "undefined") BT._hitThisThrow = {};
  discVel.copy(launchVel);
  discSpin = d.maxSpin * throwPower;
  throwCount++;
  flightTimer = 0;
  pushThrowHistory();
  phase = "FLYING";
  updateScoreUI();
  trajDots.forEach((d) => (d.visible = false));
  document.getElementById("pwr-bar").style.display = "none";

  if (mpMode) sendToAll({
    t: "throw", from: myIdx,
    px: discPos.x, py: discPos.y, pz: discPos.z,
    vx: discVel.x, vy: discVel.y, vz: discVel.z,
    disc: selectedDisc, skin: (discMesh && discMesh.userData.skinId) || "classic", count: throwCount, hz: releaseBank,
    fire: typeof PU !== "undefined" && PU.fireThrow ? 1 : 0
  });
}

// ── POINTER / TOUCH INPUT HANDLERS ──────────────────────────────────────────
function onDown(x, y) {
  if (typeof introT !== "undefined" && introT > 0) { skipIntro(); return; }
  if (typeof phase === 'undefined' || phase !== "AIMING") return;
  dragging = true;
  document.body.classList.add("aiming");
  ds.x = dn.x = x; ds.y = dn.y = y;
  throwPower = 0;
  document.getElementById("pwr-bar").style.display = "flex";
  document.getElementById("pwr-fill").style.width  = "0%";
}
function onMove(x, y) {
  if (typeof dragging === 'undefined' || !dragging) return;
  if (typeof phase === 'undefined' || phase !== "AIMING") return;
  dn.x = x; dn.y = y;
  calcThrow();
}
function onUp() {
  if (typeof dragging === 'undefined' || !dragging) return;
  dragging = false;
  document.body.classList.remove("aiming");
  if (throwPower > 0.04) doThrow();
  else {
    document.getElementById("pwr-bar").style.display = "none";
    trajDots.forEach((d) => (d.visible = false));
  }
}

window.addEventListener("mousedown",  (e) => { if (typeof renderer!=="undefined" && e.target === renderer.domElement && e.button === 0) onDown(e.clientX, e.clientY); });
window.addEventListener("mousemove",  (e) => onMove(e.clientX, e.clientY));
window.addEventListener("mouseup",    (e) => { if (e.button === 0) onUp(); });
window.addEventListener("touchstart", (e) => {
  if (typeof renderer==="undefined" || e.target !== renderer.domElement) return;
  if (e.cancelable) e.preventDefault();
  onDown(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
window.addEventListener("touchmove",  (e) => {
  if (!dragging) return;
  if (e.cancelable) e.preventDefault();
  onMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
window.addEventListener("touchend",   (e) => {
  if (dragging) { if (e.cancelable) e.preventDefault(); onUp(); }
}, { passive: false });

// Key state is tracked by physical key (e.code), not by the typed character, so
// Shift / Caps Lock can't leave a key "stuck" (press w, press Shift, release W).
var _KEY_CODES = { KeyW: ["w", "W"], KeyA: ["a", "A"], KeyS: ["s", "S"], KeyD: ["d", "D"], KeyQ: ["q", "Q"], KeyE: ["e", "E"], KeyR: ["r", "R"],
  Space: [" "], ShiftLeft: ["Shift"], ShiftRight: ["Shift"], ArrowLeft: ["ArrowLeft"], ArrowRight: ["ArrowRight"], ArrowUp: ["ArrowUp"], ArrowDown: ["ArrowDown"] };
var _MOVE_CODES = { KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1 };
var _lastMoveKeyDown = -1;   // T when a movement key was last freshly pressed
function _setKey(e, down) {
  if (typeof keys === "undefined") return;
  var names = _KEY_CODES[e.code];
  if (names) names.forEach(function(n) { keys[n] = down; });
  else if (keys.hasOwnProperty(e.key)) keys[e.key] = down;
  keys.Shift = !!e.shiftKey || (down && names && names[0] === "Shift");
}
function _clearKeys() { if (typeof keys !== "undefined") Object.keys(keys).forEach(function(k) { keys[k] = false; }); }
window.addEventListener("keydown", (e) => {
  var _tag0 = document.activeElement && document.activeElement.tagName;
  if (_tag0 === "INPUT" || _tag0 === "TEXTAREA") return;
  if (e.metaKey || e.ctrlKey) { _clearKeys(); return; }   // OS shortcuts swallow the matching keyup on macOS
  if (_MOVE_CODES[e.code] && !e.repeat && typeof T !== "undefined") _lastMoveKeyDown = T;
  _setKey(e, true);
  var tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || typeof phase === "undefined" || phase === "MENU") return;
  if (typeof introT !== "undefined" && introT > 0) { skipIntro(); return; }
  var k = e.key.toLowerCase();
  if (phase === "AIMING" && !spectatingOpp) {
    if (k === "q") nudgeRelease(-1);
    else if (k === "e") nudgeRelease(1);
  }
  if (k === "t" && phase === "WALKING" && typeof takeRelief === "function") takeRelief();
  if (k === "c") toggleCameraMode();
  else if (k === "m") { var mm = document.getElementById("minimap"); if (mm) mm.classList.toggle("hidden"); }
  else if (k === "h" || e.key === "?") toggleHelp();
  else if (e.key === "Escape") { var hp = document.getElementById("help-panel"); if (hp) hp.style.display = "none"; }
  else if (/^[1-8]$/.test(e.key) && phase === "AIMING") { var dk = Object.keys(DISCS)[parseInt(e.key, 10) - 1]; if (dk) selectDisc(dk); }
});
function toggleSound() {
  var sp = document.getElementById("sound-panel"); if (!sp) return;
  var open = sp.style.display !== "block";
  sp.style.display = open ? "block" : "none";
  if (open) { AudioEngine.init(); AudioEngine._syncUI(); }
}
function toggleHelp() { var hp = document.getElementById("help-panel"); if (hp) hp.style.display = hp.style.display === "block" ? "none" : "block"; }
window.addEventListener("keyup",   (e) => { if (e.key === "Meta" || e.key === "Control") { _clearKeys(); return; } _setKey(e, false); });
window.addEventListener("blur",    ()  => { _clearKeys(); _cancelDrag(); });
window.addEventListener("visibilitychange", () => { if (document.hidden) { _clearKeys(); _cancelDrag(); } });
window.addEventListener("contextmenu", () => _clearKeys());
// A mouse button released outside the window must not leave an aim drag hanging
function _cancelDrag() {
  if (typeof dragging === "undefined" || !dragging) return;
  dragging = false; document.body.classList.remove("aiming");
  var pb = document.getElementById("pwr-bar"); if (pb) pb.style.display = "none";
  if (typeof trajDots !== "undefined") trajDots.forEach((d) => (d.visible = false));
}
// Clicked HUD buttons must not keep keyboard focus (Space would "click" them again)
document.addEventListener("pointerup", function() {
  var a = document.activeElement;
  if (a && a.tagName === "BUTTON" && document.getElementById("menu").style.display === "none") a.blur();
});

// ── GIVE-UP / VOTE ───────────────────────────────────────────────────────────
// giveUpHole → see powerups.js


function voteGiveUp(yes) {
  giveUpVotes[myIdx] = yes;
  sendToAll({ t: "give_up_vote", from: myIdx, yes });
  document.getElementById("giveup-vote").style.display = "none";
  checkGiveUpVotes();
}

function checkGiveUpVotes() {
  const yeses = giveUpVotes.slice(0, playerCount).filter(Boolean).length;
  if (yeses >= playerCount) {
    if (myIdx === 0) {
      const next = holeIdx + 1;
      holeIdx = next;
      seedRNG(matchSeed + next * 7331);
      HOLES[next] = generateHole(next + 1);
      sendToAll({ t: "next", hole: next });
      loadHole(next);
    }
  }
}

// ── HOST FORCE-NEXT ──────────────────────────────────────────────────────────
function hostForceNext() {
  if (!mpMode || myIdx !== 0) return;
  if (!myHoleDone) { myHoleDone = true; holeScores[holeIdx] = throwCount || 12; }
  const next = holeIdx + 1;
  holeIdx = next;
  seedRNG(matchSeed + next * 7331);
  HOLES[next] = generateHole(next + 1);
  sendToAll({ t: "next", hole: next, hData: HOLES[next] });
  loadHole(next);
  hideMsg();
}

function advanceHole() {
  holeIdx++;
  loadHole(holeIdx);
}

// ── MENU INIT ─────────────────────────────────────────────────────────────────
// Soft soap bubbles drifting up behind the menu card
function initMenuDecor() {
  var bg = document.getElementById("float-bg");
  if (!bg) return;
  bg.innerHTML = "";
  for (var i = 0; i < 9; i++) {
    var el = document.createElement("div");
    el.className = "bubble";
    var sz = 18 + Math.random() * 70;
    el.style.width = el.style.height = sz.toFixed(0) + "px";
    el.style.left = (3 + Math.random() * 92).toFixed(1) + "vw";
    el.style.setProperty("--dur", (18 + Math.random() * 18).toFixed(1) + "s");
    el.style.setProperty("--delay", (-Math.random() * 30).toFixed(1) + "s");
    el.style.setProperty("--sway", ((Math.random() - 0.5) * 120).toFixed(0) + "px");
    bg.appendChild(el);
  }
}

function initMenuDiscCards() {
  if (typeof DISCS === "undefined") return;
  const container = document.getElementById("menu-disc-select");
  if (!container) return;
  container.innerHTML = "";
  Object.entries(DISCS).forEach(([key, d]) => {
    const div = document.createElement("div");
    div.className = "menu-disc-card" + (selectedDisc === key ? " active" : "");
    div.innerHTML =
      '<div class="dcard-icon">' + d.icon + '</div>' +
      '<div class="dcard-name">' + d.label + '</div>';
    div.onclick = () => {
      selectedDisc = key;
      document.querySelectorAll(".menu-disc-card").forEach(c => c.classList.remove("active"));
      div.classList.add("active");
    };
    container.appendChild(div);
  });
}
// ── PLAYER SKIN LOCKER ────────────────────────────────────────────────────────
function openSkinLocker() {
  document.getElementById("skin-locker").style.display = "block";
  _buildSkinGrid();
  // Render backdoor code input if not already present
  var _sl = document.getElementById("skin-locker");
  if (_sl && !_sl.querySelector("#skin-code-row")) {
    var _cRow = document.createElement("div");
    _cRow.id = "skin-code-row";
    _cRow.className = "code-row";
    _cRow.innerHTML = "<input id='skin-code-input' class='input' placeholder='Unlock code' maxlength='20' autocomplete='off'>" +
      "<button class='btn' onclick='_trySkinCode()'>Unlock</button>";
    var _inner = _sl.querySelector(".sheet");
    if (_inner) _inner.appendChild(_cRow);
  }
}
function closeSkinLocker() {
  document.getElementById("skin-locker").style.display = "none";
}
function _trySkinCode() {
  var inp = document.getElementById("skin-code-input");
  if (!inp) return;
  var code = inp.value.trim().toUpperCase();
  var prv  = document.getElementById("skin-preview-name");
  var found = false;

  // Master code — unlock all disc skins AND player skins
  if (typeof PLAYER_SKINS_MASTER_CODE !== "undefined" && code === PLAYER_SKINS_MASTER_CODE) {
    if (typeof PLAYER_SKINS !== "undefined") {
      PLAYER_SKINS.forEach(function(s){ if (typeof unlockedPlayerSkins !== "undefined") unlockedPlayerSkins[s.id] = true; });
    }
    if (typeof saveUnlockedPlayerSkins === "function") saveUnlockedPlayerSkins();
    // Also unlock all disc skins
    if (typeof DISC_SKINS !== "undefined" && typeof unlockedSkins !== "undefined") {
      (DISC_SKINS._global||[]).forEach(function(s){ unlockedSkins[s.id]=true; });
      (DISC_SKINS.vilov||[]).forEach(function(s){ unlockedSkins[s.id]=true; });
      if (typeof saveUnlocked === "function") saveUnlocked();
    }
    if (prv) prv.textContent = "🚗 ALL SKINS UNLOCKED!";
    inp.value = "";
    _buildSkinGrid();
    if (typeof _buildDlGrid === "function" && typeof _dlActiveDisc !== "undefined") _buildDlGrid(_dlActiveDisc);
    return;
  }

  // Per-skin backdoor codes
  if (typeof PLAYER_SKINS !== "undefined") {
    PLAYER_SKINS.forEach(function(s) {
      if (s.backdoorCode && code === s.backdoorCode.toUpperCase()) {
        if (typeof unlockedPlayerSkins !== "undefined") unlockedPlayerSkins[s.id] = true;
        if (typeof saveUnlockedPlayerSkins === "function") saveUnlockedPlayerSkins();
        if (prv) prv.textContent = s.icon + " " + s.name + " unlocked!";
        found = true;
      }
    });
  }
  if (!found && prv) prv.textContent = "❌ Invalid code";
  inp.value = "";
  _buildSkinGrid();
}
function _buildSkinGrid() {
  var grid = document.getElementById("skin-grid");
  var prv  = document.getElementById("skin-preview-name");
  if (!grid) return;
  grid.innerHTML = "";
  if (typeof PLAYER_SKINS === "undefined") return;

  // Auto-unlock skins based on progress
  if (typeof unlockedPlayerSkins !== "undefined") {
    var _hComp = (typeof holeScores !== "undefined")
      ? (holeScores || []).filter(function(h){ return h !== null; }).length : 0;
    if (_hComp >= 3)  unlockedPlayerSkins["santa"]   = true;
    if (_hComp >= 9)  unlockedPlayerSkins["crypto"]  = true;
    if (_hComp >= 18) unlockedPlayerSkins["duck"]    = true;
    var _hasAce = (typeof holeScores !== "undefined" && holeScores)
      ? holeScores.some(function(s){ return s === 1; }) : false;
    if (_hasAce) unlockedPlayerSkins["chef"] = true;
    var _hasBirdie = false;
    if (typeof holeScores !== "undefined" && typeof HOLES !== "undefined") {
      (holeScores||[]).forEach(function(s,i){
        if (s !== null && HOLES[i] && s < HOLES[i].par) _hasBirdie = true;
      });
    }
    if (_hasBirdie) unlockedPlayerSkins["chicken"] = true;
    if (typeof saveUnlockedPlayerSkins === "function") saveUnlockedPlayerSkins();
  }

  PLAYER_SKINS.forEach(function(skin) {
    var locked = !(typeof unlockedPlayerSkins !== "undefined" && (unlockedPlayerSkins[skin.id] || skin.free));
    var isEq   = (typeof equippedPlayerSkin !== "undefined") && equippedPlayerSkin === skin.id;
    var card   = document.createElement("div");
    card.className = "skin-card" + (isEq ? " active" : "") + (locked ? " locked" : "");
    card.innerHTML =
      "<span class='skin-icon'>" + (skin.icon || "🧍") + "</span>" +
      "<div class='skin-name'>" + skin.name + "</div>" +
      "<div class='skin-unlock'>" + (locked ? "🔒 " + skin.unlock : (isEq ? "✓ Playing" : (skin.blurb || "Tap to play"))) + "</div>";
    if (!locked) {
      card.onclick = function() {
        if (typeof equippedPlayerSkin !== "undefined") equippedPlayerSkin = skin.id;
        if (typeof savePlayerSkin === "function") savePlayerSkin();
        if (prv) prv.textContent = skin.name + " equipped!";
        _buildSkinGrid();
        // Rebuild local avatar with new skin
        if (typeof scene !== "undefined" && typeof localAvatarMesh !== "undefined" && localAvatarMesh) {
          scene.remove(localAvatarMesh);
          if (typeof buildPlayerAvatar === "function" && typeof myIdx !== "undefined") {
            var _col = (typeof PLAYER_COLORS !== "undefined") ? PLAYER_COLORS[myIdx % PLAYER_COLORS.length] : 0x00ffff;
            localAvatarMesh = buildPlayerAvatar(myIdx, _col);
            localAvatarMesh.visible = (typeof cameraMode !== "undefined" && cameraMode === "tp");
            if (typeof scene !== "undefined") scene.add(localAvatarMesh);
          }
        }
      };
    }
    grid.appendChild(card);
  });
}

// ── MENU VIEWS ───────────────────────────────────────────────────────────────
function menuView(name) {
  var v = { home: "sp-main-btns", play: "sp-map-picker", mp: "mp-panel" };
  Object.keys(v).forEach(function(k) { var el = document.getElementById(v[k]); if (el) el.style.display = k === name ? "" : "none"; });
  if (name === "play") { _buildSpMapPicker(); _syncSegs(); }
}
function _showMpPanel() { menuView("mp"); _mpTab("host"); }
function _mpTab(tab) {
  var hostArea = document.getElementById("host-area");
  var joinArea = document.getElementById("join-area");
  if (hostArea) hostArea.style.display = tab === "host" ? "" : "none";
  if (joinArea) joinArea.style.display = tab === "join" ? "" : "none";
  var th = document.getElementById("mp-tab-host"), tj = document.getElementById("mp-tab-join");
  if (th) th.classList.toggle("on", tab === "host");
  if (tj) tj.classList.toggle("on", tab === "join");
  // Start hosting when the host tab opens (only if we aren't connected yet)
  if (tab === "host" && typeof hostGame === "function" && (typeof peer === "undefined" || !peer)) hostGame();
  if (tab === "join") setTimeout(function() { var i = document.getElementById("mp-input"); if (i) i.focus(); }, 50);
}
function _poolChip(btn) {
  document.querySelectorAll("#pool-chips .chip").forEach(function(c) { c.classList.toggle("on", c === btn); });
  var pp = document.getElementById("pool-pick-panel"); if (pp) pp.style.display = "none";
}
function _toggleMapPicker() {
  var pp = document.getElementById("pool-pick-panel");
  if (!pp) return;
  var open = pp.style.display !== "none";
  pp.style.display = open ? "none" : "block";
  if (!open && typeof initMapCheckboxes === "function") initMapCheckboxes();
}

// Segmented controls for holes / difficulty (single player)
function _syncSegs() {
  document.querySelectorAll("#seg-holes button").forEach(function(b) { b.classList.toggle("on", parseInt(b.dataset.v, 10) === HOLE_COUNT); });
  document.querySelectorAll("#seg-diff button").forEach(function(b) { b.classList.toggle("on", b.dataset.v === DIFFICULTY); });
}
function _initSegs() {
  document.querySelectorAll("#seg-holes button").forEach(function(b) {
    b.onclick = function() { setHoleCount(b.dataset.v); var s = document.getElementById("hole-count-sel"); if (s && s.querySelector("option[value='" + b.dataset.v + "']")) s.value = b.dataset.v; _syncSegs(); };
  });
  document.querySelectorAll("#seg-diff button").forEach(function(b) {
    b.onclick = function() { setDifficulty(b.dataset.v); var s = document.getElementById("difficulty-sel"); if (s) s.value = b.dataset.v; _syncSegs(); };
  });
}
document.addEventListener("DOMContentLoaded", _initSegs);
if (document.readyState !== "loading") _initSegs();

// ── MINIMAP ──────────────────────────────────────────────────────────────────
// Aim-up course map: islands, basket, you, other players and the current flight path.
var _mmPath = [], _mmThrow = -1, _mmCache = null;
function resetMinimap() { _mmPath = []; _mmThrow = -1; _mmCache = null; }
function _mmCss(hex, k) {
  var c = new THREE.Color(hex); if (k) c.multiplyScalar(k);
  return c.convertLinearToSRGB().getStyle();
}
// Bake a top-down picture of the course (any world type) from Course.heightAt
function _mmBake(h) {
  var C = h.course, P = GFX.themePreset(h.theme), N = 160;
  var xs = C.route.map(function(p) { return p.x; }), zs = C.route.map(function(p) { return p.z; });
  var cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, cz = (Math.min.apply(null, zs) + Math.max.apply(null, zs)) / 2;
  var R = 14; C.route.forEach(function(p) { R = Math.max(R, Math.hypot(p.x - cx, p.z - cz) + 12); });
  var cv = document.createElement("canvas"); cv.width = cv.height = N;
  var g = cv.getContext("2d"), img = g.createImageData(N, N), k = 2 * R / N, H = new Float32Array(N * N);
  var lo = Infinity, hi = -Infinity, i, j;
  for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
    var x = cx - R + (i + 0.5) * k, z = cz - R + (j + 0.5) * k, y = C.heightAt(x, z), hz = C.hazardAt(x, z);
    H[j * N + i] = y < hz.level + 0.15 ? NaN : y;
    if (y === y && y >= hz.level + 0.15) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  }
  var land = new THREE.Color(P.surf.top), lc = land.clone().convertLinearToSRGB(), span = Math.max(1, hi - lo);
  var interior = C.ceiling !== null && C.ceiling !== undefined;
  for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
    var v = H[j * N + i], o = (j * N + i) * 4;
    if (v !== v) { img.data[o + 3] = 0; continue; }
    var nb = Math.max(Math.abs((H[j * N + Math.min(N - 1, i + 1)] || v) - v), Math.abs((H[Math.min(N - 1, j + 1) * N + i] || v) - v));
    var shade = 0.78 + 0.35 * (v - lo) / span;
    var r = lc.r, gg = lc.g, bb = lc.b;
    if (interior && v > lo + 1.5) { r = gg = bb = 0.95; shade = 1; }
    if (nb > 0.5) shade *= 0.72;
    img.data[o] = Math.min(255, r * 255 * shade); img.data[o + 1] = Math.min(255, gg * 255 * shade); img.data[o + 2] = Math.min(255, bb * 255 * shade);
    img.data[o + 3] = 228;
  }
  g.putImageData(img, 0, 0);
  return { hole: h, cx: cx, cz: cz, R: R, img: cv, k: k, N: N };
}
function drawMinimap() {
  var cv = document.getElementById("minimap");
  if (!cv || cv.classList.contains("hidden") || !HOLES[holeIdx] || !HOLES[holeIdx].course) return;
  if (document.getElementById("ui").style.display === "none") return;
  var h = HOLES[holeIdx], ctx = cv.getContext("2d"), W = cv.width, H = cv.height, R0 = W / 2;
  if (!_mmCache || _mmCache.hole !== h) _mmCache = _mmBake(h);
  var C = _mmCache, CO = h.course;
  var camYaw = aimAngle, fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  if (Math.hypot(fwd.x, fwd.z) > 0.05) camYaw = Math.atan2(fwd.x, -fwd.z);
  var fx = Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = Math.sin(camYaw);
  var sc = (R0 - 18) / C.R;
  function X(x, z) { return R0 + ((x - C.cx) * rx + (z - C.cz) * rz) * sc; }
  function Y(x, z) { return R0 - ((x - C.cx) * fx + (z - C.cz) * fz) * sc; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath(); ctx.arc(R0, R0, R0 - 1, 0, Math.PI * 2); ctx.clip();
  var hzc = CO.hazard.type === "lava" ? ["rgba(255,120,40,0.16)", "rgba(120,20,0,0.34)"] : CO.hazard.type === "water" ? ["rgba(120,200,240,0.10)", "rgba(10,50,80,0.30)"] : ["rgba(40,30,70,0.10)", "rgba(10,5,30,0.34)"];
  var bg = ctx.createRadialGradient(R0, R0 * 0.8, R0 * 0.1, R0, R0, R0);
  bg.addColorStop(0, hzc[0]); bg.addColorStop(1, hzc[1]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // baked course picture, rotated with the camera
  var k = C.k, sk = sc * k;
  ctx.setTransform(sk * rx, -sk * fx, sk * rz, -sk * fz, R0 + sc * (-rx * C.R - rz * C.R), R0 + sc * (fx * C.R + fz * C.R));
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(C.img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // moving platforms
  ctx.strokeStyle = "#ffd86a"; ctx.lineWidth = 2;
  CO.movers.forEach(function(m) { ctx.beginPath(); ctx.arc(X(m.x, m.z), Y(m.x, m.z), Math.max(3, (m.r || Math.max(m.hw, m.hd)) * sc), 0, Math.PI * 2); ctx.stroke(); });
  // route
  ctx.setLineDash([2, 9]); ctx.lineCap = "round"; ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 2.5; ctx.beginPath();
  CO.route.forEach(function(p, i) { if (i) ctx.lineTo(X(p.x, p.z), Y(p.x, p.z)); else ctx.moveTo(X(p.x, p.z), Y(p.x, p.z)); });
  ctx.stroke(); ctx.setLineDash([]);
  // resting disc
  if (phase === "WALKING" || phase === "LANDED") {
    ctx.fillStyle = "#ffe27a"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X(discPos.x, discPos.z), Y(discPos.x, discPos.z), 5 + Math.sin(T * 5), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // flight path
  if (throwCount !== _mmThrow) { _mmThrow = throwCount; _mmPath = []; }
  if (phase === "FLYING" && (_mmPath.length === 0 || Math.hypot(discPos.x - _mmPath[_mmPath.length - 1].x, discPos.z - _mmPath[_mmPath.length - 1].z) > 1.5)) _mmPath.push({ x: discPos.x, z: discPos.z });
  if (_mmPath.length > 1) {
    ctx.strokeStyle = "rgba(255,240,180,0.95)"; ctx.lineWidth = 3; ctx.beginPath();
    _mmPath.forEach(function(p, i) { if (i) ctx.lineTo(X(p.x, p.z), Y(p.x, p.z)); else ctx.moveTo(X(p.x, p.z), Y(p.x, p.z)); });
    ctx.stroke();
  }
  // basket
  var bxs = X(h.bx, h.bz), bys = Y(h.bx, h.bz);
  ctx.strokeStyle = "rgba(255,255,255," + (0.55 + 0.35 * Math.sin(T * 3)) + ")"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(bxs, bys, 12 + Math.sin(T * 3) * 2, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#ff8a72"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(bxs, bys, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // predicted landing
  if (typeof trajLandRing !== "undefined" && trajLandRing && trajLandRing.visible) {
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.beginPath();
    ctx.arc(X(trajLandRing.position.x, trajLandRing.position.z), Y(trajLandRing.position.x, trajLandRing.position.z), 6, 0, Math.PI * 2); ctx.stroke();
  }
  // other players
  remotePlayers.forEach(function(rp, i) {
    if (!rp) return;
    ctx.fillStyle = _pcol(i); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    var bp = rp.body || rp.discPos;
    ctx.beginPath(); ctx.arc(X(bp.x, bp.z), Y(bp.x, bp.z), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
  // you
  var px = X(PL.pos.x, PL.pos.z), py = Y(PL.pos.x, PL.pos.z), a = (phase === "AIMING" ? aimAngle : Math.atan2(Math.sin(PL.yaw), -Math.cos(PL.yaw))) - camYaw;
  ctx.save(); ctx.translate(px, py); ctx.rotate(a);
  ctx.shadowColor = "rgba(0,30,50,0.45)"; ctx.shadowBlur = 6;
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, 9); ctx.lineTo(0, 4); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = "#33c3ef";
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(5.5, 6); ctx.lineTo(0, 2.5); ctx.lineTo(-5.5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // glass rim highlight
  ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(R0, R0, R0 - 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
}
