"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── SETTINGS · LOCALISATION · ONBOARDING · TELEMETRY ─────────────────────────
//   SET   persisted player settings + the Settings screen (controls, accessibility,
//         language, diagnostics). Colour-blind palettes, UI scale, reduced motion,
//         hold- vs toggle-to-aim, haptics.
//   t()   string tables (STR.en / STR.sk …). Static markup uses data-i18n="key";
//         a language can declare dir:"rtl" and the whole UI mirrors.
//   TIPS  contextual one-time hints (first walk, first item, first water …).
//   LOG   telemetry events + error capture, kept locally (ring buffers) and sent in
//         batches to TELEMETRY_URL only if one is configured and the player allows it.
// ══════════════════════════════════════════════════════════════════════════════
var SET = {
  DEFAULTS: { lang: "auto", colorblind: "off", uiScale: 1, shake: 1, speedFx: true, aimMode: "hold", haptics: true, tips: true, telemetry: true, keymap: {},
    bobble: true, slowmo: true, crowd: true, gadgets: true },
  v: null,
};
SET.load = function() {
  var s = {}; try { s = JSON.parse(localStorage.getItem("dg_settings") || "{}") || {}; } catch (e) {}
  SET.v = Object.assign({}, SET.DEFAULTS, s);
  if (!SET.v.keymap) SET.v.keymap = {};
};
SET.save = function() { try { localStorage.setItem("dg_settings", JSON.stringify(SET.v)); } catch (e) {} };
SET.set = function(k, val) { SET.v[k] = val; SET.save(); SET.apply(); if (typeof LOG !== "undefined") LOG.ev("setting", { k: k, v: val }); };

// ── Colour-blind safe palettes (Okabe–Ito based) ─────────────────────────────
SET.PALETTES = {
  off:  [0x00ffff, 0xff00ff, 0xffff00, 0xff6600, 0x00ff88, 0x8a6aff, 0xff4a6a, 0x6affd8],
  deut: [0x56b4e9, 0xe69f00, 0xf0e442, 0x0072b2, 0xffffff, 0xcc79a7, 0xd55e00, 0x999999],
  prot: [0x56b4e9, 0xe69f00, 0xf0e442, 0x0072b2, 0xffffff, 0xcc79a7, 0x8a6aff, 0x999999],
  trit: [0xe69f00, 0x009e73, 0xcc79a7, 0xd55e00, 0xffffff, 0x000000, 0x56b4e9, 0x999999],
};
SET.apply = function() {
  var v = SET.v, root = document.documentElement;
  // palettes: mutate in place so everything holding PLAYER_COLORS sees it
  if (typeof PLAYER_COLORS !== "undefined") { var P = SET.PALETTES[v.colorblind] || SET.PALETTES.off; for (var i = 0; i < P.length; i++) PLAYER_COLORS[i] = P[i]; }
  document.body.classList.toggle("cb", v.colorblind !== "off");
  root.style.setProperty("--ui-scale", v.uiScale);
  document.body.classList.toggle("reduce-motion", v.shake < 0.01 && !v.speedFx);
  I18N.setLang(v.lang);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── LOCALISATION ─────────────────────────────────────────────────────────────
var STR = {
  en: {
    _name: "English",
    play: "Play", multiplayer: "Multiplayer", profile: "Profile", cases: "Cases", graphics: "Graphics", sound: "Sound", howto: "How to play", settings: "Settings",
    your_name: "Your name", new_round: "New round", holes: "Holes", difficulty: "Difficulty",
    walk_to_disc: "Walk to your disc", grab_it: "Grab it!", take_relief: "Take relief", finished_havoc: "Finished — wreak havoc",
    grab_bag: "Grab a ? bag", hole_time: "Hole time", finish_now: "Finish!", overtime: "OVERTIME", results: "Hole {n} results", locked_out: "Locked out",
    s_controls: "Controls", s_access: "Accessibility", s_lang: "Language", s_diag: "Diagnostics", s_gameplay: "Gameplay",
    s_aim: "Aiming", s_aim_hold: "Hold & drag", s_aim_toggle: "Click to start, click to throw", s_haptics: "Controller rumble", s_tips: "Show tips",
    s_cb: "Colour-blind mode", s_cb_off: "Off", s_cb_deut: "Deuteranopia", s_cb_prot: "Protanopia", s_cb_trit: "Tritanopia",
    s_ui: "Interface size", s_shake: "Screen shake", s_speedfx: "Speed effects (FOV, blur)",
    s_rebind: "Click an action, then press a key", s_reset: "Reset to defaults", s_press: "Press a key…", s_device: "Detected: {d}",
    s_tel: "Share anonymous gameplay stats", s_tel_note: "Stays on this device unless a stats server is configured.", s_errors: "Recent errors", s_export: "Copy diagnostics", s_none: "None",
    a_forward: "Move forward", a_back: "Move back", a_left: "Move left", a_right: "Move right", a_jump: "Jump", a_sprint: "Sprint", a_slap: "Slap", a_dive: "Dive", a_item: "Use item", a_itemNext: "Next item",
    a_car: "Enter / exit car", a_relief: "Take relief", a_emote: "Emote wheel", a_camera: "Camera view", a_map: "Toggle map", a_curveL: "Hyzer (curve left)", a_curveR: "Anhyzer (curve right)",
    tip_walk: "Walk to your disc with WASD — Shift to run, Space to jump.", tip_aim: "Drag up to set power, sideways to aim. Release to throw!", tip_item: "You got an item! Press {k} to use it ({k2} switches).",
    tip_water: "Water resets you to your last safe spot.", tip_ob: "That's out of bounds — head back to the course!", tip_ko: "Knocked out! Dive ({k}) dodges discs, rockets and slaps.",
    tip_battle: "Battle mode: race to the basket — points for finishing first, birdies and knockouts.", tip_emote: "Hold {k} for the emote wheel.", tip_full: "Your bag is full — use an item first.",
    oob_warn: "Out of bounds — back to the course in {s}", ready: "Ready", not_ready: "Not ready", quick_play: "Quick play", public_lobby: "Public lobby", no_lobbies: "No open lobbies right now — host one!",
    lvl: "Level {n}", xp_gain: "+{n} XP", level_up: "Level up! You're level {n}", coins: "coins",
    emote: "Emote", celebration: "Victory celebration",
    tip_trick: "Trick disc! Press {k} (or tap the screen) mid-flight to {a}.",
    s_fun: "Arcade", s_bobble: "Bobblehead characters", s_slowmo: "Slow-motion moments", s_crowd: "Crowd reactions",
    s_gadgets: "Course gadgets in solo play (pads, fans, barrels, geese)", s_gadgets_note: "Multiplayer always has them, so everyone plays the same course.",
  },
  sk: {
    _name: "Slovenčina",
    play: "Hrať", multiplayer: "Hra pre viac hráčov", profile: "Profil", cases: "Bedne", graphics: "Grafika", sound: "Zvuk", howto: "Ako hrať", settings: "Nastavenia",
    your_name: "Tvoje meno", new_round: "Nové kolo", holes: "Jamky", difficulty: "Obtiažnosť",
    walk_to_disc: "Choď k disku", grab_it: "Zober ho!", take_relief: "Úľava", finished_havoc: "Hotovo — rob chaos",
    grab_bag: "Zober ? tašku", hole_time: "Čas jamky", finish_now: "Dokonči!", overtime: "PREDĹŽENIE", results: "Výsledky jamky {n}", locked_out: "Vypadol",
    s_controls: "Ovládanie", s_access: "Prístupnosť", s_lang: "Jazyk", s_diag: "Diagnostika", s_gameplay: "Hrateľnosť",
    s_aim: "Mierenie", s_aim_hold: "Podrž a ťahaj", s_aim_toggle: "Klik začne, klik hodí", s_haptics: "Vibrácie ovládača", s_tips: "Zobrazovať tipy",
    s_cb: "Režim pre farboslepých", s_cb_off: "Vypnutý", s_cb_deut: "Deuteranopia", s_cb_prot: "Protanopia", s_cb_trit: "Tritanopia",
    s_ui: "Veľkosť rozhrania", s_shake: "Otrasy obrazovky", s_speedfx: "Efekty rýchlosti (FOV, rozmazanie)",
    s_rebind: "Klikni na akciu a stlač kláves", s_reset: "Obnoviť predvolené", s_press: "Stlač kláves…", s_device: "Zistené: {d}",
    s_tel: "Zdieľať anonymné štatistiky", s_tel_note: "Zostávajú v zariadení, kým nie je nastavený server.", s_errors: "Posledné chyby", s_export: "Kopírovať diagnostiku", s_none: "Žiadne",
    a_forward: "Dopredu", a_back: "Dozadu", a_left: "Doľava", a_right: "Doprava", a_jump: "Skok", a_sprint: "Šprint", a_slap: "Facka", a_dive: "Skok vpred", a_item: "Použiť predmet", a_itemNext: "Ďalší predmet",
    a_car: "Nastúpiť / vystúpiť", a_relief: "Úľava", a_emote: "Koleso emócií", a_camera: "Pohľad kamery", a_map: "Mapa", a_curveL: "Hyzer (doľava)", a_curveR: "Anhyzer (doprava)",
    tip_walk: "Choď k disku klávesmi WASD — Shift beh, medzerník skok.", tip_aim: "Ťahaj nahor pre silu, do strán mier. Pusti a hoď!", tip_item: "Máš predmet! Stlač {k} ({k2} prepína).",
    tip_water: "Voda ťa vráti na posledné bezpečné miesto.", tip_ob: "Si mimo ihriska — vráť sa späť!", tip_ko: "Knokaut! Skok vpred ({k}) uhne diskom, raketám aj fackám.",
    tip_battle: "Bojový režim: preteky ku košu — body za poradie, birdie a knokauty.", tip_emote: "Podrž {k} pre koleso emócií.", tip_full: "Taška je plná — najprv použi predmet.",
    oob_warn: "Mimo ihriska — späť o {s}", ready: "Pripravený", not_ready: "Nepripravený", quick_play: "Rýchla hra", public_lobby: "Verejná miestnosť", no_lobbies: "Žiadne otvorené miestnosti — založ jednu!",
    lvl: "Úroveň {n}", xp_gain: "+{n} XP", level_up: "Nová úroveň! Si na úrovni {n}", coins: "mince",
    emote: "Emócia", celebration: "Oslava víťazstva",
    tip_trick: "Trikový disk! Počas letu stlač {k} (alebo ťukni na obrazovku) a {a}.",
    s_fun: "Arkáda", s_bobble: "Postavičky s veľkou hlavou", s_slowmo: "Spomalené momenty", s_crowd: "Reakcie publika",
    s_gadgets: "Prekážky v hre pre jedného (trampolíny, ventilátory, sudy, husi)", s_gadgets_note: "V hre pre viac hráčov sú vždy, aby všetci hrali rovnaké ihrisko.",
  },
};
var I18N = { lang: "en" };
I18N.setLang = function(pref) {
  var l = pref && pref !== "auto" ? pref : ((navigator.language || "en").slice(0, 2).toLowerCase());
  if (!STR[l]) l = "en";
  I18N.lang = l;
  document.documentElement.lang = l;
  document.documentElement.dir = STR[l]._dir === "rtl" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach(function(el) { el.textContent = t(el.getAttribute("data-i18n")); });
};
function t(key, vars) {
  var s = (STR[I18N.lang] && STR[I18N.lang][key]) || STR.en[key] || key;
  if (vars) Object.keys(vars).forEach(function(k) { s = s.split("{" + k + "}").join(vars[k]); });
  return s;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ONBOARDING TIPS ──────────────────────────────────────────────────────────
var TIPS = { seen: {} };
try { TIPS.seen = JSON.parse(localStorage.getItem("dg_tips") || "{}") || {}; } catch (e) {}
TIPS.show = function(id, vars, delay) {
  if (!SET.v || !SET.v.tips || TIPS.seen[id]) return;
  TIPS.seen[id] = 1; try { localStorage.setItem("dg_tips", JSON.stringify(TIPS.seen)); } catch (e) {}
  setTimeout(function() {
    var el = document.createElement("div"); el.className = "tip-card glass";
    el.innerHTML = "<span class='tip-i'>💡</span><span>" + t("tip_" + id, vars) + "</span><button aria-label='OK'>✓</button>";
    el.querySelector("button").onclick = function() { el.classList.add("out"); setTimeout(function() { el.remove(); }, 300); };
    document.body.appendChild(el);
    setTimeout(function() { if (el.parentNode) { el.classList.add("out"); setTimeout(function() { el.remove(); }, 300); } }, 7000);
    if (typeof LOG !== "undefined") LOG.ev("tip", { id: id });
  }, delay || 0);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── TELEMETRY & ERROR LOG ────────────────────────────────────────────────────
// Set TELEMETRY_URL (config) to a collector to receive batched JSON via sendBeacon.
var TELEMETRY_URL = "";
var LOG = { events: [], errors: [], queue: [], session: Math.random().toString(36).slice(2, 10), t0: Date.now() };
try { LOG.events = JSON.parse(localStorage.getItem("dg_tel") || "[]"); LOG.errors = JSON.parse(localStorage.getItem("dg_err") || "[]"); } catch (e) {}
LOG._persist = function() { try { localStorage.setItem("dg_tel", JSON.stringify(LOG.events.slice(-400))); localStorage.setItem("dg_err", JSON.stringify(LOG.errors.slice(-60))); } catch (e) {} };
LOG.ev = function(name, data) {
  if (SET.v && !SET.v.telemetry) return;
  var e = { n: name, t: Date.now(), s: LOG.session, d: data || null };
  LOG.events.push(e); if (LOG.events.length > 400) LOG.events.splice(0, LOG.events.length - 400);
  LOG.queue.push(e);
  clearTimeout(LOG._pt); LOG._pt = setTimeout(LOG._persist, 1500);
};
LOG.err = function(msg, where, extra) {
  var e = { m: String(msg).slice(0, 300), w: where || "", x: extra || null, t: Date.now(), s: LOG.session, v: (document.querySelector("script[src*='game.js']") || {}).src };
  LOG.errors.push(e); if (LOG.errors.length > 60) LOG.errors.splice(0, LOG.errors.length - 60);
  LOG.queue.push({ n: "error", t: e.t, s: e.s, d: e });
  LOG._persist();
};
window.addEventListener("error", function(e) { LOG.err(e.message, (e.filename || "").split("/").pop() + ":" + e.lineno); });
window.addEventListener("unhandledrejection", function(e) { LOG.err("promise: " + (e.reason && e.reason.message || e.reason), "async"); });
LOG.flush = function() {
  if (!TELEMETRY_URL || !LOG.queue.length || (SET.v && !SET.v.telemetry)) { LOG.queue.length = Math.min(LOG.queue.length, 200); return; }
  var batch = LOG.queue.splice(0, 100);
  try { navigator.sendBeacon(TELEMETRY_URL, JSON.stringify({ app: "diskgolfi", batch: batch })); } catch (e) {}
};
setInterval(LOG.flush, 30000);
window.addEventListener("pagehide", function() {
  if (typeof phase !== "undefined" && phase !== "MENU") LOG.ev("quit_mid_round", { hole: typeof holeIdx !== "undefined" ? holeIdx : -1, phase: phase });
  LOG._persist(); LOG.flush();
});
// A short summary for the Diagnostics tab
LOG.summary = function() {
  var E = LOG.events, holes = E.filter(function(e) { return e.n === "hole_end"; }), ob = E.filter(function(e) { return e.n === "ob"; });
  var themes = {}; holes.forEach(function(h) { var th = h.d && h.d.theme; if (th) themes[th] = (themes[th] || 0) + 1; });
  var top = Object.keys(themes).sort(function(a, b) { return themes[b] - themes[a]; }).slice(0, 3);
  var matches = E.filter(function(e) { return e.n === "match_end" && e.d && e.d.sec; });
  var avg = matches.length ? Math.round(matches.reduce(function(a, e) { return a + e.d.sec; }, 0) / matches.length / 60) : 0;
  return { holes: holes.length, ob: ob.length, topThemes: top, avgMatchMin: avg, errors: LOG.errors.length };
};

// ══════════════════════════════════════════════════════════════════════════════
// ── SETTINGS SCREEN ──────────────────────────────────────────────────────────
SET.open = function(tab) {
  var m = document.getElementById("settings-modal");
  if (!m) {
    m = document.createElement("div"); m.id = "settings-modal"; m.className = "modal";
    m.onclick = function(e) { if (e.target === m) SET.close(); };
    document.body.appendChild(m);
  }
  SET._tab = tab || SET._tab || "controls";
  SET.render();
  m.style.display = "flex";
};
SET.close = function() { var m = document.getElementById("settings-modal"); if (m) m.style.display = "none"; if (typeof INPUT !== "undefined") INPUT.cancelRebind(); };
SET.render = function() {
  var m = document.getElementById("settings-modal"); if (!m) return;
  var tab = SET._tab, v = SET.v;
  var tabs = [["controls", t("s_controls")], ["fun", t("s_fun")], ["access", t("s_access")], ["lang", t("s_lang")], ["diag", t("s_diag")]];
  var seg = function(key, opts) { return "<div class='seg'>" + opts.map(function(o) { return "<button class='" + (v[key] === o[0] ? "on" : "") + "' onclick='SET.set(\"" + key + "\"," + JSON.stringify(o[0]) + ");SET.render()'>" + o[1] + "</button>"; }).join("") + "</div>"; };
  var tog = function(key, label) { return "<label class='s-row'><span>" + label + "</span><input type='checkbox' " + (v[key] ? "checked" : "") + " onchange='SET.set(\"" + key + "\",this.checked)'></label>"; };
  var h = "";
  if (tab === "controls") {
    h += "<div class='sec-label'>" + t("s_aim") + "</div>" + seg("aimMode", [["hold", t("s_aim_hold")], ["toggle", t("s_aim_toggle")]]);
    h += tog("haptics", t("s_haptics"));
    h += "<div class='sec-label'>" + t("s_rebind") + " <span class='dim'>· " + t("s_device", { d: typeof INPUT !== "undefined" && INPUT.device === "pad" ? "🎮 " + (INPUT.padName || "Gamepad") : "⌨️ Keyboard & mouse" }) + "</span></div>";
    h += "<div class='rebind'>" + (typeof INPUT !== "undefined" ? INPUT.ACTION_ORDER : []).map(function(a) {
      var code = INPUT.codeFor(a), busy = INPUT._rebinding === a;
      return "<button class='rb" + (busy ? " busy" : "") + "' onclick='INPUT.startRebind(\"" + a + "\")'><span>" + t("a_" + a) + "</span><kbd>" + (busy ? t("s_press") : INPUT.keyLabel(code)) + "</kbd>" + (INPUT.PAD_LABEL[a] ? "<em>" + INPUT.PAD_LABEL[a] + "</em>" : "") + "</button>";
    }).join("") + "</div>";
    h += "<button class='btn ghost block' onclick='INPUT.resetKeys()'>" + t("s_reset") + "</button>";
  } else if (tab === "fun") {
    h += tog("bobble", "🤪 " + t("s_bobble")) + tog("slowmo", "🎬 " + t("s_slowmo")) + tog("crowd", "📣 " + t("s_crowd"));
    h += tog("gadgets", "🍄 " + t("s_gadgets")) + "<div class='help-tip'>" + t("s_gadgets_note") + "</div>";
  } else if (tab === "access") {
    h += "<div class='sec-label'>" + t("s_cb") + "</div>" + seg("colorblind", [["off", t("s_cb_off")], ["deut", t("s_cb_deut")], ["prot", t("s_cb_prot")], ["trit", t("s_cb_trit")]]);
    h += "<div class='cb-swatch'>" + SET.PALETTES[v.colorblind].map(function(c) { return "<i style='background:#" + c.toString(16).padStart(6, "0") + "'></i>"; }).join("") + "</div>";
    h += "<label class='s-row'><span>" + t("s_ui") + " <b>" + Math.round(v.uiScale * 100) + "%</b></span><input type='range' min='75' max='140' value='" + Math.round(v.uiScale * 100) + "' oninput='SET.set(\"uiScale\",this.value/100);this.previousElementSibling.querySelector(\"b\").textContent=this.value+\"%\"'></label>";
    h += "<label class='s-row'><span>" + t("s_shake") + " <b>" + Math.round(v.shake * 100) + "%</b></span><input type='range' min='0' max='100' value='" + Math.round(v.shake * 100) + "' oninput='SET.set(\"shake\",this.value/100);this.previousElementSibling.querySelector(\"b\").textContent=this.value+\"%\"'></label>";
    h += tog("speedFx", t("s_speedfx")) + tog("tips", t("s_tips"));
  } else if (tab === "lang") {
    h += "<div class='seg col'>" + [["auto", "Auto (" + ((navigator.language || "en").slice(0, 2)) + ")"]].concat(Object.keys(STR).map(function(l) { return [l, STR[l]._name]; })).map(function(o) { return "<button class='" + (v.lang === o[0] ? "on" : "") + "' onclick='SET.set(\"lang\",\"" + o[0] + "\");SET.render()'>" + o[1] + "</button>"; }).join("") + "</div>";
  } else {
    var S = LOG.summary();
    h += tog("telemetry", t("s_tel")) + "<div class='help-tip'>" + t("s_tel_note") + "</div>";
    h += "<div class='diag'><div><b>" + S.holes + "</b><span>holes logged</span></div><div><b>" + S.avgMatchMin + "m</b><span>avg match</span></div><div><b>" + S.ob + "</b><span>out of bounds</span></div><div><b>" + (window._fpsAvg || "–") + "</b><span>fps</span></div></div>";
    h += "<div class='sec-label'>" + t("s_errors") + "</div><div class='errlist'>" + (LOG.errors.length ? LOG.errors.slice(-6).reverse().map(function(e) { return "<div><code>" + e.m.replace(/</g, "&lt;") + "</code><span>" + e.w + " · " + new Date(e.t).toLocaleTimeString() + "</span></div>"; }).join("") : "<div class='dim'>" + t("s_none") + "</div>") + "</div>";
    h += "<button class='btn ghost block' onclick='SET.copyDiag(this)'>" + t("s_export") + "</button>";
  }
  m.innerHTML = "<div class='sheet settings'><div class='sheet-head'><h2>" + t("settings") + "</h2><button class='x' onclick='SET.close()' aria-label='Close'>✕</button></div>" +
    "<div class='tabs'>" + tabs.map(function(x) { return "<button class='" + (tab === x[0] ? "on" : "") + "' onclick='SET._tab=\"" + x[0] + "\";SET.render()'>" + x[1] + "</button>"; }).join("") + "</div>" +
    "<div class='s-body'>" + h + "</div></div>";
};
SET.copyDiag = function(btn) {
  var txt = JSON.stringify({ summary: LOG.summary(), errors: LOG.errors.slice(-20), ua: navigator.userAgent, quality: typeof GFX !== "undefined" ? GFX.quality : "", settings: SET.v }, null, 2);
  try { navigator.clipboard.writeText(txt); btn.textContent = "✓ Copied"; } catch (e) { btn.textContent = "Copy failed"; }
};

SET.load();
document.addEventListener("DOMContentLoaded", function() { SET.apply(); });
if (document.readyState !== "loading") SET.apply();
