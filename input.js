"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── INPUT LAYER ──────────────────────────────────────────────────────────────
// • Remapping: every gameplay action has a default key. A rebound key is translated
//   (capture phase) into its default before the game sees it, so all existing
//   controls follow the player's bindings without touching gameplay code.
// • Gamepad (standard mapping): left stick move · right stick look/aim · RT hold to
//   charge a throw, release to throw (right stick fine-aims while charging) · A jump ·
//   B dive · X slap · Y item · LB emote wheel · RB next disc · D-pad item/car/curve.
//   Radial dead zones, analog sprint, haptic rumble scaled to the action.
// • Device glyphs: hints switch between keyboard and controller buttons.
// • Toggle-to-aim (settings): click to start charging, click again to throw.
// ══════════════════════════════════════════════════════════════════════════════
var INPUT = {
  DEFAULTS: { forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD", jump: "Space", sprint: "ShiftLeft", slap: "KeyR", dive: "KeyV",
    item: "KeyF", itemNext: "KeyG", car: "KeyE", relief: "KeyT", emote: "KeyB", camera: "KeyC", map: "KeyM", curveL: "KeyQ", curveR: "KeyE" },
  ACTION_ORDER: ["forward", "back", "left", "right", "jump", "sprint", "dive", "slap", "item", "itemNext", "emote", "car", "relief", "curveL", "curveR", "camera", "map"],
  PAD_LABEL: { jump: "Ⓐ", dive: "Ⓑ", slap: "Ⓧ", item: "Ⓨ", itemNext: "D↑", emote: "LB", car: "D↓", curveL: "D←", curveR: "D→", camera: "R3", map: "⧉", sprint: "stick" },
  device: "kbm", padName: "", _phys: {}, _orphan: {}, _rebinding: null, _btn: [], _charging: false, _tcharge: false,
};
INPUT.codeFor = function(a) { return (SET.v.keymap && SET.v.keymap[a]) || INPUT.DEFAULTS[a]; };
INPUT.keyLabel = function(code) {
  if (!code) return "—";
  if (/^Key/.test(code)) return code.slice(3);
  if (/^Digit/.test(code)) return code.slice(5);
  return { Space: "Space", ShiftLeft: "Shift", ShiftRight: "R-Shift", ControlLeft: "Ctrl", AltLeft: "Alt", Tab: "Tab", CapsLock: "Caps", Enter: "Enter", Backquote: "`", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" }[code] || code;
};
INPUT._char = function(code) {
  if (/^Key/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit/.test(code)) return code.slice(5);
  return { Space: " ", ShiftLeft: "Shift", ShiftRight: "Shift" }[code] || code;
};
// physical code → canonical (default) code
INPUT.rebuild = function() {
  var phys = {}, orphan = {};
  INPUT.ACTION_ORDER.forEach(function(a) { var d = INPUT.DEFAULTS[a], c = INPUT.codeFor(a); if (c !== d) { phys[c] = d; orphan[d] = 1; } });
  INPUT.ACTION_ORDER.forEach(function(a) { var c = INPUT.codeFor(a); if (orphan[c] && !phys[c]) delete orphan[c]; if (c === INPUT.DEFAULTS[a]) delete orphan[c]; });
  INPUT._phys = phys; INPUT._orphan = orphan;
};
INPUT._translate = function(e) {
  if (!e.isTrusted) return;
  INPUT.setDevice("kbm");
  if (INPUT._rebinding && e.type === "keydown") {
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.code !== "Escape") { SET.v.keymap[INPUT._rebinding] = e.code; SET.save(); INPUT.rebuild(); }
    INPUT._rebinding = null; SET.render(); return;
  }
  var tag = document.activeElement && document.activeElement.tagName; if (tag === "INPUT" || tag === "TEXTAREA") return;
  var canon = INPUT._phys[e.code];
  if (canon === undefined) { if (INPUT._orphan[e.code]) { e.stopImmediatePropagation(); e.preventDefault(); } return; }
  e.stopImmediatePropagation(); e.preventDefault();
  window.dispatchEvent(new KeyboardEvent(e.type, { code: canon, key: INPUT._char(canon), shiftKey: e.shiftKey || canon === "ShiftLeft" && e.type === "keydown", repeat: e.repeat, bubbles: true }));
};
window.addEventListener("keydown", INPUT._translate, true);
window.addEventListener("keyup", INPUT._translate, true);
INPUT.startRebind = function(a) { INPUT._rebinding = a; SET.render(); };
INPUT.cancelRebind = function() { INPUT._rebinding = null; };
INPUT.resetKeys = function() { SET.v.keymap = {}; SET.save(); INPUT.rebuild(); SET.render(); INPUT.refreshHints(); };

// Synthesize a key for gamepad buttons, so every system that listens to keys just works
INPUT.key = function(code, down) { window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code: code, key: INPUT._char(code), bubbles: true })); };

// ── Device + glyphs ──────────────────────────────────────────────────────────
INPUT.setDevice = function(d) {
  if (INPUT.device === d) return;
  INPUT.device = d; document.body.classList.toggle("pad", d === "pad");
  INPUT.refreshHints();
  if (typeof LOG !== "undefined") LOG.ev("input_device", { d: d, name: INPUT.padName });
};
INPUT.glyph = function(a) { return INPUT.device === "pad" ? (INPUT.PAD_LABEL[a] || "") : INPUT.keyLabel(INPUT.codeFor(a)); };
INPUT.refreshHints = function() {
  var g = INPUT.glyph, k = function(a) { return "<kbd>" + g(a) + "</kbd>"; };
  var wk = document.querySelector("#walk-hud .wh-keys");
  if (wk) wk.innerHTML = INPUT.device === "pad" ? "<kbd>L</kbd> move · <kbd>R</kbd> look · " + k("jump") + " jump · " + k("dive") + " dive"
    : k("forward") + k("left") + k("back") + k("right") + " move · " + k("sprint") + " run · " + k("jump") + " jump · " + k("dive") + " dive";
  var ins = document.getElementById("instr");
  if (ins) ins.innerHTML = INPUT.device === "pad" ? "Hold <kbd>RT</kbd> to charge · release to throw · <kbd>R</kbd> aim · <kbd>RB</kbd> disc · " + k("curveL") + k("curveR") + " curve"
    : (SET.v.aimMode === "toggle" ? "Click to charge · click to throw" : "Drag up to throw") + " · <kbd>←</kbd><kbd>→</kbd> aim · " + k("curveL") + k("curveR") + " curve · " + k("forward") + k("left") + k("back") + k("right") + " walk · <kbd>H</kbd> help";
  if (typeof PU !== "undefined" && PU.renderHud) { PU._lastHud = null; PU.renderHud(); }
};

// ── Haptics ──────────────────────────────────────────────────────────────────
INPUT.rumble = function(strong, weak, ms) {
  if (!SET.v.haptics) return;
  var pad = INPUT._pad();
  try {
    if (pad && pad.vibrationActuator && pad.vibrationActuator.playEffect) pad.vibrationActuator.playEffect("dual-rumble", { duration: ms || 120, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak === undefined ? strong : weak) });
    else if (INPUT.device !== "pad" && navigator.vibrate && "ontouchstart" in window) navigator.vibrate(Math.round((ms || 80) * Math.min(1, strong)));
  } catch (e) {}
};

// ── Gamepad polling ──────────────────────────────────────────────────────────
INPUT._pad = function() { var ps = navigator.getGamepads ? navigator.getGamepads() : []; for (var i = 0; i < ps.length; i++) if (ps[i] && ps[i].connected) return ps[i]; return null; };
INPUT._dz = function(x, y, dz) { var m = Math.hypot(x, y); if (m < dz) return { x: 0, y: 0, m: 0 }; var k = Math.min(1, (m - dz) / (1 - dz)) / m; return { x: x * k, y: y * k, m: Math.min(1, (m - dz) / (1 - dz)) }; };
INPUT.PAD_KEYS = { 0: "Space", 1: "KeyV", 2: "KeyR", 3: "KeyF", 12: "KeyG", 13: "KeyE", 14: "KeyQ", 15: "KeyE", 8: "KeyM", 11: "KeyC" };
INPUT.update = function(dt) {
  var pad = INPUT._pad();
  if (!pad) { INPUT._tick(dt); return; }
  INPUT.padName = (pad.id || "").replace(/\(.*?\)/g, "").trim().slice(0, 32);
  var b = pad.buttons.map(function(x) { return typeof x === "object" ? x.value : x; }), ax = pad.axes;
  var L = INPUT._dz(ax[0] || 0, ax[1] || 0, 0.18), R = INPUT._dz(ax[2] || 0, ax[3] || 0, 0.15);
  var any = L.m > 0.2 || R.m > 0.2 || b.some(function(v) { return v > 0.5; });
  if (any) INPUT.setDevice("pad");
  if (INPUT.device !== "pad") { INPUT._tick(dt); return; }
  var driving = typeof VEH !== "undefined" && VEH.mySeat;
  // left stick → the on-screen joystick path (camera-relative movement, analog sprint)
  if (typeof PL !== "undefined" && !driving) {
    if (L.m > 0) { PL.stick.active = true; PL.stick.x = L.x; PL.stick.y = L.y; PL.stick._pad = true; }
    else if (PL.stick._pad) { PL.stick.active = false; PL.stick.x = PL.stick.y = 0; PL.stick._pad = false; }
  }
  // right stick → look / aim (curved response for precision)
  if (R.m > 0 && typeof PL !== "undefined" && PL.look) { var cv = function(v) { return Math.sign(v) * v * v; }; PL.look(cv(R.x) * dt * 1100, cv(R.y) * dt * 650); }
  // buttons → keys (edge-triggered)
  Object.keys(INPUT.PAD_KEYS).forEach(function(i) {
    var down = (b[i] || 0) > 0.5, was = !!INPUT._btn[i];
    if (down !== was) INPUT.key(INPUT.PAD_KEYS[i], down);
    INPUT._btn[i] = down;
  });
  // LB hold → emote wheel (right stick picks)
  var lb = (b[4] || 0) > 0.5;
  if (lb !== !!INPUT._btn[4]) INPUT.key("KeyB", lb);
  INPUT._btn[4] = lb;
  if (lb && typeof EMOTE !== "undefined" && EMOTE.wheelOpen) EMOTE.pointStick(R.x, R.y);
  // RB → next disc while aiming
  var rb = (b[5] || 0) > 0.5;
  if (rb && !INPUT._btn[5] && typeof phase !== "undefined" && phase === "AIMING" && typeof DISCS !== "undefined") { var ks = Object.keys(DISCS), ci = ks.indexOf(selectedDisc); selectDisc(ks[(ci + 1) % ks.length]); }
  INPUT._btn[5] = rb;
  // Start → help
  var st = (b[9] || 0) > 0.5; if (st && !INPUT._btn[9] && typeof toggleHelp === "function") toggleHelp(); INPUT._btn[9] = st;
  var rt = b[7] || 0, lt = b[6] || 0;
  if (driving) {   // car: triggers drive, stick steers
    var keyState = function(code, on, slot) { if (!!INPUT["_c" + slot] !== on) { INPUT.key(code, on); INPUT["_c" + slot] = on; } };
    keyState("KeyW", rt > 0.25, "w"); keyState("KeyS", lt > 0.25, "s"); keyState("KeyA", L.x < -0.3, "a"); keyState("KeyD", L.x > 0.3, "d");
  } else {
    ["w", "s", "a", "d"].forEach(function(k2) { if (INPUT["_c" + k2]) { INPUT.key("Key" + k2.toUpperCase(), false); INPUT["_c" + k2] = false; } });
    // two-phase throw: hold RT to charge the power meter, release to throw
    if (typeof phase !== "undefined" && phase === "AIMING") {
      if (rt > 0.3 && !INPUT._charging) { INPUT._charging = true; INPUT._beginCharge(); }
      else if (rt < 0.15 && INPUT._charging) { INPUT._charging = false; INPUT._release(); }
    } else INPUT._charging = false;
  }
  INPUT._tick(dt);
};
// shared charging logic (gamepad + toggle-to-aim)
INPUT._beginCharge = function() {
  if (typeof phase === "undefined" || phase !== "AIMING") return;
  dragging = true; document.body.classList.add("aiming"); throwPower = 0; INPUT._cdir = 1;
  ds = { x: 0, y: 0 }; dn = { x: 0, y: 0 };
  document.getElementById("pwr-bar").style.display = "flex";
};
INPUT._release = function() {
  if (!dragging) return;
  dragging = false; document.body.classList.remove("aiming");
  if (throwPower > 0.04) { INPUT.rumble(0.25 + throwPower * 0.6, 0.4, 90 + throwPower * 120); doThrow(); }
  else { document.getElementById("pwr-bar").style.display = "none"; trajDots.forEach(function(d) { d.visible = false; }); }
};
INPUT._tick = function(dt) {
  var charging = (INPUT._charging || INPUT._tcharge) && dragging && typeof phase !== "undefined" && phase === "AIMING";
  if (!charging) { if (INPUT._tcharge && (typeof phase === "undefined" || phase !== "AIMING")) INPUT._tcharge = false; return; }
  // power sweeps up (and back down in toggle mode, so timing the click matters)
  throwPower += dt * 0.85 * INPUT._cdir;
  if (throwPower >= 1) { throwPower = 1; INPUT._cdir = INPUT._tcharge ? -1 : 0; }
  if (throwPower <= 0.02 && INPUT._cdir < 0) INPUT._cdir = 1;
  var pf = document.getElementById("pwr-fill"), pp = document.getElementById("pwr-pct");
  if (pf) pf.style.width = throwPower * 100 + "%"; if (pp) pp.textContent = Math.round(throwPower * 100) + "%";
  if (throwPower > 0.05 && typeof updateTrajDots === "function") {
    var h = HOLES[holeIdx]; updateTrajDots(new THREE.Vector3(discPos.x, terrainY(discPos.x, discPos.z, h, holeIdx) + RELEASE_HEIGHT, discPos.z), computeLaunchVelocity());
  }
  if (INPUT._charging && throwPower > 0.97) INPUT.rumble(0.05, 0.12, 40);
};
// Toggle-to-aim for mouse / touch: wraps the drag handlers from ui.js
(function() {
  var _down = window.onDown, _up = window.onUp, _move = window.onMove;
  if (typeof onDown !== "function") return;
  window.onDown = onDown = function(x, y) {
    if (SET.v.aimMode !== "toggle" || typeof phase === "undefined" || phase !== "AIMING" || (typeof introT !== "undefined" && introT > 0)) return _down(x, y);
    if (!INPUT._tcharge) { INPUT._tcharge = true; INPUT._beginCharge(); INPUT._ax = x; INPUT._aim0 = baseAim; }
    else { INPUT._tcharge = false; INPUT._release(); }
  };
  window.onUp = onUp = function() { if (SET.v.aimMode === "toggle" && (INPUT._tcharge || !dragging)) return; return _up(); };
  window.onMove = onMove = function(x, y) {
    if (SET.v.aimMode === "toggle" && INPUT._tcharge) { aimAngle = INPUT._aim0 + (x - INPUT._ax) * 0.0042; return; }
    return _move(x, y);
  };
})();
window.addEventListener("gamepadconnected", function(e) { INPUT.padName = e.gamepad.id; INPUT.setDevice("pad"); if (typeof _flashPrompt === "function") _flashPrompt("🎮 Controller connected"); });
window.addEventListener("gamepaddisconnected", function() { INPUT.setDevice("kbm"); });
window.addEventListener("mousedown", function() { INPUT.setDevice("kbm"); }, true);
INPUT.rebuild();
