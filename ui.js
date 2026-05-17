// ── UI HELPERS ────────────────────────────────────────────────────────────────
// All DOM manipulation: HUD updates, message overlay, score cards, menus.
// Depends on: config.js (LOFTS, DISCS, PLAYER_COLORS, MAX_PLAYERS),
//             game-state globals (phase, throwCount, holeIdx, HOLES, etc.)

function setInstr(t) {
  document.getElementById("instr").innerHTML = t;
}

function showMsg(big, sub, btnTxt) {
  document.getElementById("msg-big").textContent = big;
  document.getElementById("msg-sub").textContent = sub;
  const btn = document.getElementById("msg-btn");
  if (btnTxt) { btn.textContent = btnTxt; btn.style.display = "inline-block"; }
  else btn.style.display = "none";
  document.getElementById("msg").classList.add("on");
}

function hideMsg() {
  document.getElementById("msg").classList.remove("on");
}

function updateScoreUI() {
  if (mpMode) return;
  const h = HOLES[holeIdx];
  document.getElementById("hole-n").textContent = h.n;
  document.getElementById("hole-theme-txt").textContent = h.theme.replace("_", " ") + " Theme";
  document.getElementById("par-v").textContent = h.par;
  document.getElementById("throw-n").textContent = throwCount;
  const _tv = Math.round(totalVsPar);
  document.getElementById("tot-v").textContent = _tv === 0 ? "E" : _tv > 0 ? "+" + _tv : "" + _tv;
}

function buildScoreboardUI() {
  const sb = document.getElementById("mp-scores");
  if (!sb) return;
  sb.innerHTML = "";
  const cols = ["#00ffff", "#ff00ff", "#ffff00", "#ff6600", "#00ff88"];
  for (let i = 0; i < playerCount; i++) {
    if (i > 0) {
      const sep = document.createElement("div");
      sep.className = "mp-sep"; sep.textContent = "·"; sb.appendChild(sep);
    }
    const card = document.createElement("div");
    card.className = "mp-p" + (i === myIdx ? " me" : "");
    card.id = "mpcard-" + i;
    card.innerHTML =
      `<div class="pname" id="mpname-${i}" style="color:${cols[i]}">${playerNames[i]}</div>` +
      `<div class="pscore" id="mpscore-${i}">E</div>` +
      `<div class="pthrows" id="mpthrows-${i}"></div>`;
    sb.appendChild(card);
  }
}

function updateMpUI() {
  const cols = ["#00ffff", "#ff00ff", "#ffff00", "#ff6600", "#00ff88"];
  for (let i = 0; i < playerCount; i++) {
    const nameEl   = document.getElementById("mpname-"   + i);
    const scoreEl  = document.getElementById("mpscore-"  + i);
    const throwsEl = document.getElementById("mpthrows-" + i);
    if (nameEl)   nameEl.textContent  = playerNames[i];
    if (scoreEl)  scoreEl.textContent = mpTotals[i] === 0 ? "E" : mpTotals[i] > 0 ? "+" + mpTotals[i] : "" + mpTotals[i];
    if (throwsEl) throwsEl.textContent = playerDone[i]
      ? playerThrows[i] + "T \u2713"
      : i === myIdx && throwCount > 0 ? throwCount + "T" : "";
  }
}

function updateWindUI() {
  const w = HOLES[holeIdx].wind;
  const spd = Math.hypot(w.x, w.z).toFixed(1);
  const ang = (Math.atan2(w.x, -w.z) * 180) / Math.PI;
  document.getElementById("w-arrow").textContent =
    ["\u2191", "\u2197", "\u2192", "\u2198", "\u2193", "\u2199", "\u2190", "\u2196"]
    [Math.round(((ang + 360) % 360) / 45) % 8];
  document.getElementById("w-spd").textContent = spd;
}

function updateLobbyUI() {
  const list = document.getElementById("lobby-list");
  const btn  = document.getElementById("start-game-btn");
  if (!list) return;
  const cols = ["#00ffff", "#ff00ff", "#ffff00", "#ff6600", "#00ff88"];
  const players = Array.from({ length: playerCount }, (_, i) =>
    `<span style="color:${cols[i]}">&#9679; ${playerNames[i]}</span>`
  );
  list.innerHTML = players.join("  ");
  if (btn) btn.style.display = playerCount >= 2 ? "inline-block" : "none";
  document.getElementById("mp-status").textContent =
    playerCount >= MAX_PLAYERS ? "Lobby full!" : `Waiting for players\u2026 (${playerCount}/${MAX_PLAYERS})`;
}

// ── DISC SELECTOR IN GAME ────────────────────────────────────────────────────
function initGameDiscPicker() {
  const container = document.getElementById("disc-opts-container");
  if (!container) return;
  container.innerHTML = "";
  Object.keys(DISCS).forEach((key) => {
    const d   = DISCS[key];
    const div = document.createElement("div");
    div.className  = "dopt" + (key === selectedDisc ? " on" : "");
    div.dataset.t  = key;
    var _mnP = d.minPower ? Math.round(d.minPower*100)+"%-100%" : "Any power";
    div.innerHTML  =
      "<div class=\"dname\">" + (d.icon || "") + " " + (d.label || key) + "</div>" +
      "<div class=\"dtip\">"  + (d.tip  || d.desc || "") + "</div>" +
      "<div class=\"dpow\">"  + _mnP + "</div>";
    div.onclick = () => selectDisc(key);
    container.appendChild(div);
  });
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
  if (phase !== "AIMING" && phase !== "LANDED") return;
  const prev = throwHistory.pop();
  discPos.copy(prev.pos);
  discVel.copy(prev.vel);
  throwCount = prev.throws;
  if (discMesh) discMesh.position.copy(discPos);
  stepBackCooldown = STEP_BACK_COOLDOWN;
  baseAim = Math.atan2(HOLES[holeIdx].bx - discPos.x, -(HOLES[holeIdx].bz - discPos.z));
  aimAngle = baseAim;
  updateScoreUI();
  updateStepBackBtn();
}
function updateStepBackBtn() {
  var btn = document.getElementById("step-back-btn") || document.getElementById("stepback-btn");
  if (!btn) return;
  var cd = Math.ceil(stepBackCooldown);
  if (stepBackCooldown > 0) {
    btn.textContent = "↩ Back (" + cd + "s)";
    btn.style.opacity = "0.45";
  } else if (throwHistory.length === 0) {
    btn.textContent = "↩ Back";
    btn.style.opacity = "0.3";
  } else {
    btn.textContent = "↩ Back ×" + throwHistory.length;
    btn.style.opacity = "1";
  }
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

// ── LOFT / DISC CONTROLS ─────────────────────────────────────────────────────
function cycleLoft() {
  loftIdx = (loftIdx + 1) % LOFTS.length;
  document.getElementById("loft-icon").textContent = LOFTS[loftIdx].icon;
  document.getElementById("loft-deg").textContent  = LOFTS[loftIdx].a + "\u00b0";
}

function selectDisc(t) {
  if (phase !== "AIMING") return;
  selectedDisc = t;
  document.querySelectorAll(".dopt").forEach((el) => el.classList.toggle("on", el.dataset.t === t));
  if (discMesh) scene.remove(discMesh);
  discMesh = buildDisc(t);
  discMesh.position.copy(discPos);
  scene.add(discMesh);
  initTrail();
}

// ── THROW INPUT ──────────────────────────────────────────────────────────────
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
    var startY = Math.max(discPos.y, terrainY(discPos.x, discPos.z, h, holeIdx) + 0.15);
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

  var spd  = pwr * (d.speed * 1.5 + 5) * d.launchMult;
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
  var groundHere = terrainY(discPos.x, discPos.z, h, holeIdx);
  discPos.y = Math.max(discPos.y, groundHere + 0.12);

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
    disc: selectedDisc, count: throwCount
  });
}

// ── POINTER / TOUCH INPUT HANDLERS ──────────────────────────────────────────
function onDown(x, y) {
  if (typeof phase === 'undefined' || phase !== "AIMING") return;
  dragging = true;
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

window.addEventListener("keydown", (e) => { if (typeof keys!=="undefined" && keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener("keyup",   (e) => { if (typeof keys!=="undefined" && keys.hasOwnProperty(e.key)) keys[e.key] = false; });
window.addEventListener("blur",    ()  => { if (typeof keys!=="undefined") Object.keys(keys).forEach(k => keys[k] = false); });
window.addEventListener("visibilitychange", () => { if (typeof keys!=="undefined" && document.hidden) Object.keys(keys).forEach(k => keys[k] = false); });

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
function initMenuDecor() {
  var emojis = ["🌸","🎮","💿","📼","🌙","⭐","🦩","🐬","🌴","🎵","💜","🚀","🌊","🦄","💫","🎸","🦋","🌺"];
  var bg = document.getElementById("float-bg");
  if (!bg) return;
  for (var i = 0; i < 16; i++) {
    var el = document.createElement("div");
    el.className = "f-emoji";
    el.textContent = emojis[i % emojis.length];
    var dur   = (10 + Math.random() * 12).toFixed(1);
    var delay = -(Math.random() * 14).toFixed(1);  // negative = already in progress, never stuck
    var xoff  = ((Math.random() - 0.5) * 80).toFixed(0);
    el.style.setProperty("--dur",   dur   + "s");
    el.style.setProperty("--delay", delay + "s");
    el.style.setProperty("--xoff",  xoff  + "px");
    el.style.left     = (2 + Math.random() * 88) + "vw";
    el.style.fontSize = (20 + Math.random() * 22) + "px";
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
    _cRow.style.cssText = "display:flex;gap:6px;margin-top:10px;justify-content:center;";
    _cRow.innerHTML =
      "<input id='skin-code-input' placeholder='ENTER CODE' maxlength='20'" +
      " style='background:#1e0a00;border:2px solid #cc5500;color:#ffcc00;padding:5px 10px;" +
      "font-family:Bebas Neue,cursive;font-size:16px;border-radius:0;width:160px;text-align:center;" +
      "letter-spacing:2px;outline:none;text-transform:uppercase'>" +
      "<button onclick='_trySkinCode()' style='background:#cc4400;border:2px solid #ff8800;" +
      "color:#ffd580;padding:5px 12px;font-family:Bebas Neue,cursive;font-size:14px;" +
      "letter-spacing:1px;cursor:pointer;border-radius:0'>UNLOCK</button>";
    var _inner = _sl.querySelector("div");
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
      "<div class='skin-unlock'>" + (locked ? "🔒 " + skin.unlock : (isEq ? "✓ EQUIPPED" : skin.unlock)) + "</div>";
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

// ── MENU HELPER FUNCTIONS ─────────────────────────────────────────────────────
function _showMpPanel() {
  var panel = document.getElementById("mp-panel");
  if (panel) panel.style.display = "block";
  _mpTab("host");
}
function _mpTab(tab) {
  var hostArea = document.getElementById("host-area");
  var joinArea = document.getElementById("join-area");
  var tabHost  = document.getElementById("mp-tab-host");
  var tabJoin  = document.getElementById("mp-tab-join");
  if (hostArea) hostArea.style.display = tab === "host" ? "block" : "none";
  if (joinArea) joinArea.style.display = tab === "join" ? "block" : "none";
  if (tabHost) tabHost.className = tab === "host" ? "mbtn" : "mbtn sec";
  if (tabJoin) tabJoin.className = tab === "join" ? "mbtn" : "mbtn sec";
  // Auto-start hosting when switching to host tab
  if (tab === "host" && typeof hostGame === "function" &&
      typeof peer === "undefined" || (typeof peer !== "undefined" && !peer)) {
    hostGame();
  }
}
function _toggleMapPicker() {
  var pp = document.getElementById("pool-pick-panel");
  if (!pp) return;
  var open = pp.style.display !== "none";
  pp.style.display = open ? "none" : "block";
  if (!open && typeof initMapCheckboxes === "function") initMapCheckboxes();
}
function switchMapTab(tab) {
  var pp = document.getElementById("pool-pick-panel");
  if (pp) pp.style.display = tab === "pick" ? "block" : "none";
  if (tab === "pick" && typeof initMapCheckboxes === "function") initMapCheckboxes();
}
