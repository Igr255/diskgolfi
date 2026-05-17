"use strict";

// ══════════════════════════════════════════════════════════
// ── POWERUP SYSTEM ──
// Powerup tokens are spawned on the course and collected by
// flying through them. Effects apply immediately.
// ══════════════════════════════════════════════════════════

const POWERUPS = {
  speed:   { color: 0xffaa00, icon: "⚡",  label: "Speed Boost!",    effect: "speed",   duration: 6 },
  magnet:  { color: 0xff00ff, icon: "🧲",  label: "Basket Magnet!",  effect: "magnet",  duration: 1 },
  rewind:  { color: 0x00ffff, icon: "⏪",  label: "Rewind Token!",   effect: "rewind",  duration: 0 },
  lowgrav: { color: 0x8888ff, icon: "🌙",  label: "Low Gravity!",    effect: "lowgrav", duration: 8 },
  score:   { color: 0xffff00, icon: "⭐",  label: "-1 Score Bonus!", effect: "score",   duration: 0 },
};


function spawnPowerups(hole, idx) {
  powerupMeshes.forEach((p) => { if (p.mesh) courseGrp.remove(p.mesh); });
  powerupMeshes = [];
  if (idx < 2) return; // no powerups on first 2 holes

  const types = Object.keys(POWERUPS);
  const count = Math.min(3, Math.floor(idx * 0.4) + 1);
  const wps = hole.waypoints;

  for (let i = 0; i < count; i++) {
    const wp = wps[Math.floor(srng() * wps.length)] || { x: 0, z: 0 };
    const px = wp.x + (srng() - 0.5) * wp.r;
    const pz = wp.z + (srng() - 0.5) * wp.r;
    const ty = terrainY(px, pz, hole, idx);
    if (ty < hole.water + 0.2) continue;

    const type = types[Math.floor(srng() * types.length)];
    const p = POWERUPS[type];

    const g = new THREE.Group();
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4, 0),
      new THREE.MeshBasicMaterial({ color: p.color })
    );
    g.add(star);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.05, 8, 16),
      new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.5 })
    );
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    g.position.set(px, ty + 0.8, pz);
    courseGrp.add(g);
    powerupMeshes.push({ mesh: g, type, x: px, z: pz, collected: false });
  }
}

function checkPowerupCollection() {
  if (phase !== "FLYING") return;
  powerupMeshes.forEach((p) => {
    if (p.collected) return;
    const d = Math.hypot(discPos.x - p.x, discPos.z - p.z);
    if (d < 1.5 && Math.abs(discPos.y - p.mesh.position.y) < 1.5) {
      p.collected = true;
      courseGrp.remove(p.mesh);
      applyPowerup(p.type);
    }
  });
}

function applyPowerup(type) {
  const p = POWERUPS[type];
  const banner = document.getElementById("powerup-banner");
  banner.textContent = p.icon + " " + p.label;
  banner.style.opacity = "1";
  setTimeout(() => { banner.style.opacity = "0"; }, 2500);

  if (type === "speed") {
    activePowerups.speed = { until: Date.now() + p.duration * 1000 };
  } else if (type === "magnet") {
    const toBasket = basketWP.clone().sub(discPos).normalize();
    discVel.add(toBasket.multiplyScalar(8));
  } else if (type === "rewind") {
    stepBack();
  } else if (type === "lowgrav") {
    activePowerups.lowgrav = { until: Date.now() + p.duration * 1000 };
  } else if (type === "score") {
    totalVsPar = Math.max(totalVsPar - 1, totalVsPar);
    updateScoreUI();
  }
  spawnParticleBurst(discPos.clone(), new THREE.Color(p.color), 20);
}

// ══════════════════════════════════════════════════════════
// ── GIVE-UP VOTE SYSTEM ──
// ══════════════════════════════════════════════════════════

function onGiveUpClick() {
  if (!mpMode) {
    // Single player: instant skip
    holeScores[holeIdx] = throwCount;
    totalVsPar += throwCount - (HOLES[holeIdx]||{par:3}).par;
    advanceHole();
    return;
  }
  if (giveUpProposed) return;
  proposeGiveUp();
}

var _giveUpTimer = null;
var _giveUpCountdown = 15;

function proposeGiveUp() {
  giveUpProposed = true;
  giveUpVotes = {};
  giveUpVotes[myIdx] = true;  // proposer auto-votes yes
  sendToAll({ t: "give_up_vote_start", from: myIdx });
  _renderGiveUpUI();
  _startGiveUpTimer();
}

function _renderGiveUpUI() {
  var el = document.getElementById("giveup-vote");
  if (!el) return;
  el.style.display = "block";
  var total  = playerCount;
  var yeas   = Object.values(giveUpVotes).filter(Boolean).length;
  var needed = Math.ceil(total / 2);
  var titleEl = document.getElementById("gv-title");
  var countEl = document.getElementById("gv-count");
  if (titleEl) titleEl.textContent = "Skip Hole? (" + _giveUpCountdown + "s)";
  if (countEl) countEl.textContent = yeas + " / " + total + " voted yes — need " + needed;
}

function _startGiveUpTimer() {
  _giveUpCountdown = 15;
  if (_giveUpTimer) clearInterval(_giveUpTimer);
  _giveUpTimer = setInterval(function() {
    _giveUpCountdown--;
    _renderGiveUpUI();
    if (_giveUpCountdown <= 0) {
      clearInterval(_giveUpTimer); _giveUpTimer = null;
      _resolveGiveUp(true);  // true = timer expired
    }
  }, 1000);
}

function _resolveGiveUp(timerExpired) {
  var total  = playerCount;
  var yeas   = Object.values(giveUpVotes).filter(Boolean).length;
  var needed = Math.ceil(total / 2);
  var passed = yeas >= needed;
  var nays   = Object.keys(giveUpVotes).length - yeas;
  var cannotPass = nays > total - needed;
  if (!timerExpired && !passed && !cannotPass) return;  // still waiting
  if (_giveUpTimer) { clearInterval(_giveUpTimer); _giveUpTimer = null; }
  document.getElementById("giveup-vote").style.display = "none";
  giveUpProposed = false;
  if (passed) {
    if (myIdx === 0) hostForceNext();
    else sendToAll({ t: "give_up_force_next", from: myIdx });
  }
}

function voteGiveUp(yes) {
  if (giveUpVotes[myIdx] !== undefined) return;
  giveUpVotes[myIdx] = yes;
  sendToAll({ t: "give_up_vote", from: myIdx, yes });
  _renderGiveUpUI();
  _resolveGiveUp(false);
}

function checkGiveUpVotes() {
  _renderGiveUpUI();
  _resolveGiveUp(false);
}
