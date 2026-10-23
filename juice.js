"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── JUICE — the interface is a toy too ───────────────────────────────────────
//   • Every control: a tick on hover, a pop on press (back / close get a
//     downward blip), a springy squash-and-release, and primary buttons throw a
//     little confetti. (Interface volume slider.)
//   • Logo spins and bobs, the title letters do a wave, the tagline got silly.
//   • HUD numbers pop when they change; the power bar shakes near the top.
// ══════════════════════════════════════════════════════════════════════════════
var JUICE = {
  SEL: "button, .btn, .chip, .tile, .dopt, .icon-btn, .dock-btn, .pf-card, .skin-card:not(.locked), .menu-disc-card, .ew-slot, .rb, .theme-tile",
  BACK: ".back, .x, [aria-label='Back'], [aria-label='Close']",
  _over: null, _hoverT: 0,
};
JUICE.target = function(e) { var el = e.target && e.target.closest ? e.target.closest(JUICE.SEL) : null; return el && !el.disabled && !el.classList.contains("off") ? el : null; };
document.addEventListener("pointerover", function(e) {
  if (e.pointerType !== "mouse") return;
  var el = JUICE.target(e); if (el === JUICE._over) return;
  JUICE._over = el;
  if (el && performance.now() - JUICE._hoverT > 45 && typeof AudioEngine !== "undefined") { JUICE._hoverT = performance.now(); AudioEngine.ui("uiHover"); }
}, true);
document.addEventListener("pointerdown", function(e) {
  var el = JUICE.target(e); if (!el || typeof AudioEngine === "undefined") return;
  AudioEngine.ui(el.matches(JUICE.BACK) ? "uiBack" : "uiPress");
}, true);
document.addEventListener("click", function(e) {
  var el = JUICE.target(e); if (!el) return;
  el.classList.remove("jpop"); void el.offsetWidth; el.classList.add("jpop");
  clearTimeout(el._jp); el._jp = setTimeout(function() { el.classList.remove("jpop"); }, 420);
  if (el.classList.contains("primary")) JUICE.burst(el);
}, true);

// Confetti out of a button
JUICE.burst = function(el) {
  if (document.body.classList.contains("reduce-motion")) return;
  var r = el.getBoundingClientRect(), cols = ["#ffd23a", "#ff6a8a", "#5ad8ff", "#8aff6a", "#c88aff", "#ffffff"];
  for (var i = 0; i < 14; i++) {
    var d = document.createElement("i"); d.className = "jbit";
    var a = Math.random() * Math.PI * 2, s = 50 + Math.random() * 90;
    d.style.cssText = "left:" + (r.left + r.width * Math.random()) + "px;top:" + (r.top + r.height / 2) + "px;background:" + cols[i % cols.length] +
      ";--dx:" + (Math.cos(a) * s).toFixed(0) + "px;--dy:" + (Math.sin(a) * s - 40).toFixed(0) + "px;--r:" + (Math.random() * 720 - 360).toFixed(0) + "deg";
    document.body.appendChild(d);
    setTimeout(function(n) { n.remove(); }.bind(null, d), 750);
  }
};

// Title letters in a wave, a goofier tagline
JUICE.brand = function() {
  var h = document.querySelector(".brand h1");
  if (h && !h.dataset.j) {
    h.dataset.j = 1;
    h.innerHTML = h.textContent.split("").map(function(c, i) { return "<span style='--i:" + i + "'>" + c + "</span>"; }).join("");
  }
  var p = document.querySelector(".brand p"); if (p) p.textContent = "Chaotic disc golf · throw, bonk, repeat";
};

// Numbers in the HUD pop when they change
JUICE.watch = function(ids) {
  if (typeof MutationObserver === "undefined") return;
  ids.forEach(function(id) {
    var el = document.getElementById(id); if (!el) return;
    var last = el.textContent;   // only real changes pop (some fields are rewritten with the same text)
    new MutationObserver(function() { if (el.textContent === last) return; last = el.textContent; el.classList.remove("npop"); void el.offsetWidth; el.classList.add("npop"); }).observe(el, { childList: true, characterData: true, subtree: true });
  });
};

// Power bar heat (called every frame by CINE while charging)
JUICE.charge = function(k) {
  var hot = k > 0.88;
  if (hot !== JUICE._hot) { JUICE._hot = hot; document.body.classList.toggle("charge-hot", hot); }
};

JUICE.init = function() { JUICE.brand(); JUICE.watch(["throw-n", "tot-v", "hole-n"]); };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", JUICE.init); else JUICE.init();
