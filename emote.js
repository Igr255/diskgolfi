"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── EMOTES · CELEBRATIONS · PROGRESSION ──────────────────────────────────────
//   EMOTE  hold the emote key (B / LB) for a radial wheel, point, release. Any
//          movement cancels instantly. Everyone sees it (animation + emoji bubble
//          + positional sound). Scoring plays your chosen victory celebration.
//   PROG   XP, levels and coins: holes, birdies, aces, knockouts and wins pay out;
//          every level gives coins, every 3rd level a case.
// ══════════════════════════════════════════════════════════════════════════════
var EMOTE = {
  LIST: [
    { id: "wave", icon: "👋", name: "Wave", sfx: "pickup" },
    { id: "cheer", icon: "🙌", name: "Cheer", sfx: "powerup" },
    { id: "clap", icon: "👏", name: "Clap", sfx: "step" },
    { id: "dance", icon: "💃", name: "Dance", sfx: "boing" },
    { id: "flip", icon: "🤸", name: "Backflip", sfx: "jump" },
    { id: "taunt", icon: "😜", name: "Taunt", sfx: "zap" },
    // victory dances, unlocked by level (procedural: anim.js ANIM.dance)
    { id: "chicken", icon: "🐔", name: "Chicken Dance", sfx: "goose", proc: true, lvl: 2 },
    { id: "floss", icon: "🕺", name: "Floss", sfx: "boing", proc: true, lvl: 3 },
    { id: "windmill", icon: "🌀", name: "Windmill", sfx: "whoosh", proc: true, lvl: 4 },
    { id: "robot", icon: "🤖", name: "Robot", sfx: "zap", proc: true, lvl: 5 },
    { id: "pirouette", icon: "🩰", name: "Pirouette", sfx: "powerup", proc: true, lvl: 6 },
  ],
  wheelOpen: false, sel: -1,
};
// What I can use right now (dances unlock with levels)
EMOTE.avail = function() { var lv = PROG.st().level || 1; return EMOTE.LIST.filter(function(e) { return !e.lvl || lv >= e.lvl; }); };
EMOTE.canUse = function() {
  if (typeof phase === "undefined" || phase === "MENU" || !HOLES[holeIdx]) return false;
  if (typeof BT !== "undefined" && BT.locked()) return false;
  if (typeof VEH !== "undefined" && VEH.mySeat) return false;
  return phase === "WALKING" || phase === "AIMING" || phase === "SCORED" || phase === "LANDED";
};
EMOTE.open = function() {
  if (EMOTE.wheelOpen || !EMOTE.canUse()) return;
  EMOTE.wheelOpen = true; EMOTE.sel = -1;
  var el = document.getElementById("emote-wheel"), av = EMOTE.avail();
  if (el && +el.dataset.n !== av.length) { el.remove(); el = null; }   // a dance was unlocked: rebuild
  if (!el) {
    el = document.createElement("div"); el.id = "emote-wheel"; el.dataset.n = av.length;
    var R = av.length > 7 ? 146 : 112;
    el.innerHTML = "<div class='ew-ring'>" + av.map(function(e, i) {
      var a = i / av.length * Math.PI * 2 - Math.PI / 2;
      return "<div class='ew-slot" + (e.proc ? " dance" : "") + "' data-i='" + i + "' style='left:calc(50% + " + (Math.cos(a) * R).toFixed(0) + "px);top:calc(50% + " + (Math.sin(a) * R).toFixed(0) + "px)'><span>" + e.icon + "</span><b>" + e.name + "</b></div>";
    }).join("") + "<div class='ew-center'>" + t("emote") + "</div></div>";
    el.addEventListener("mousemove", function(ev) { EMOTE.point(ev.clientX - innerWidth / 2, ev.clientY - innerHeight / 2); });
    el.addEventListener("click", function(ev) { var s = ev.target.closest(".ew-slot"); if (s) { EMOTE.sel = +s.getAttribute("data-i"); EMOTE.close(true); } });
    document.body.appendChild(el);
  }
  el.style.display = "flex"; EMOTE._hi();
};
EMOTE.point = function(dx, dy) { if (Math.hypot(dx, dy) < 30) { EMOTE.sel = -1; EMOTE._hi(); return; } var a = Math.atan2(dy, dx) + Math.PI / 2, n = EMOTE.avail().length; EMOTE.sel = ((Math.round(a / (Math.PI * 2) * n) % n) + n) % n; EMOTE._hi(); };
EMOTE.pointStick = function(x, y) { if (Math.hypot(x, y) > 0.4) EMOTE.point(x * 100, y * 100); };
EMOTE._hi = function() { document.querySelectorAll("#emote-wheel .ew-slot").forEach(function(s) { s.classList.toggle("on", +s.getAttribute("data-i") === EMOTE.sel); }); };
EMOTE.close = function(play) {
  if (!EMOTE.wheelOpen) return;
  EMOTE.wheelOpen = false;
  var el = document.getElementById("emote-wheel"); if (el) el.style.display = "none";
  var av = EMOTE.avail();
  if (play !== false && EMOTE.sel >= 0 && av[EMOTE.sel]) EMOTE.play(av[EMOTE.sel].id);
};
// Play an emote on my character (and tell everyone)
EMOTE.play = function(id, quiet) {
  if (!localAvatarMesh) return;
  var e = EMOTE.LIST.find(function(x) { return x.id === id; }) || EMOTE.LIST[0];
  if (id === "flip") ANIM.flip(localAvatarMesh);
  else if (e.proc) { PL._setAnim("idle"); PL.emoteT = T + 4.3; ANIM.dance(localAvatarMesh, id); }
  else { PL._setAnim(id); PL.emoteT = T + 4.5; }
  EMOTE.bubble(PL.pos, e.icon);
  if (!quiet) AudioEngine.sfx(e.sfx, 0.6);
  if (typeof mpMode !== "undefined" && mpMode) sendToAll({ t: "emote", i: myIdx, e: id });
  if (typeof LOG !== "undefined") LOG.ev("emote", { e: id });
};
EMOTE.onNet = function(m) {
  var rp = remotePlayers[m.i]; if (!rp || !rp.body) return;
  var e = EMOTE.LIST.find(function(x) { return x.id === m.e; }); if (!e) return;
  if (m.e === "flip" && rp.avatarMesh) ANIM.flip(rp.avatarMesh);
  else if (e.proc && rp.avatarMesh) ANIM.dance(rp.avatarMesh, m.e);
  EMOTE.bubble(rp.body, e.icon);
  AudioEngine.sfx(e.sfx, 0.5, rp.body);
};
EMOTE.bubble = function(pos, icon) { if (typeof _spawnBonkText === "function") _spawnBonkText(new THREE.Vector3(pos.x, pos.y + 2.4, pos.z), icon); };
// Victory celebration after holing out
EMOTE.celebrate = function() { var id = (PROG.st().celebration) || "cheer"; setTimeout(function() { if (typeof phase !== "undefined" && (phase === "SCORED" || phase === "WALKING")) EMOTE.play(id, true); }, 350); };
// Moving cancels an emote instantly
EMOTE.update = function() {
  if (phase === "WALKING" && T > 40 && typeof TIPS !== "undefined") TIPS.show("emote", { k: INPUT.glyph("emote") });
  if (PL.emoteT > T && (PL.anyMoveInput() || (typeof dragging !== "undefined" && dragging))) PL.emoteT = 0;
};
window.addEventListener("keydown", function(e) { if (e.code === "KeyB" && !e.repeat) { var tg = document.activeElement && document.activeElement.tagName; if (tg !== "INPUT" && tg !== "TEXTAREA") EMOTE.open(); } });
window.addEventListener("keyup", function(e) { if (e.code === "KeyB") EMOTE.close(true); });

// ══════════════════════════════════════════════════════════════════════════════
// ── PROGRESSION ──────────────────────────────────────────────────────────────
var PROG = {
  XP: { hole: 40, par: 10, birdie: 30, eagle: 60, ace: 150, ko: 15, roundSP: 100, match: 100, win: 200 },
};
PROG.st = function() { var s = COS.state; if (s.xp === undefined) { s.xp = 0; s.level = 1; s.celebration = "cheer"; } return s; };
PROG.need = function(lvl) { return 200 + (lvl - 1) * 120; };   // XP from lvl → lvl+1
PROG.add = function(xp, why, coins) {
  var s = PROG.st(); s.xp += xp; if (coins) s.coins += coins;
  var ups = 0;
  while (s.xp >= PROG.need(s.level)) { s.xp -= PROG.need(s.level); s.level++; ups++;
    s.coins += 50;
    if (s.level % 3 === 0 && COS.awardCase) { var k = COS.awardCase(); setTimeout(function() { PF.toast("🎁 Level reward: +1 " + COS.CASES[k].icon + " " + COS.CASES[k].name); }, 1800); }
  }
  COS.save();
  PROG.popup("+" + xp + " XP" + (why ? " · " + why : "") + (coins ? " · 🪙" + coins : ""));
  if (ups) {
    var newDance = EMOTE.LIST.filter(function(e) { return e.lvl && e.lvl > s.level - ups && e.lvl <= s.level; })[0];
    setTimeout(function() { PF.toast("⭐ " + t("level_up", { n: s.level }) + " · +50 🪙" + (newDance ? " · New victory dance: " + newDance.icon + " " + newDance.name + "!" : "")); AudioEngine.sfx("powerup"); }, 900); if (typeof LOG !== "undefined") LOG.ev("level_up", { level: s.level }); }
  PROG.badge();
};
PROG.popup = function(txt) {
  var el = document.createElement("div"); el.className = "xp-pop"; el.textContent = txt;
  (document.getElementById("ui") || document.body).appendChild(el);
  setTimeout(function() { el.remove(); }, 2400);
};
// Hole finished (any mode)
PROG.hole = function(throws, par) {
  var d = throws - par, xp = PROG.XP.hole, why = "hole";
  if (throws === 1) { xp += PROG.XP.ace; why = "ACE"; } else if (d <= -2) { xp += PROG.XP.eagle; why = "eagle"; } else if (d === -1) { xp += PROG.XP.birdie; why = "birdie"; } else if (d === 0) { xp += PROG.XP.par; why = "par"; }
  PROG.add(xp, why, 5);
};
PROG.ko = function() { PROG.add(PROG.XP.ko, "knockout"); };
PROG.matchDone = function(won) { PROG.add(PROG.XP.match + (won ? PROG.XP.win : 0), won ? "victory!" : "match", won ? 75 : 25); };
// Level badge on the main menu card
PROG.badge = function() {
  var s = PROG.st(), host = document.querySelector("#sp-main-btns");
  if (!host) return;
  var el = document.getElementById("lvl-badge");
  if (!el) { el = document.createElement("div"); el.id = "lvl-badge"; host.insertBefore(el, host.firstChild); }
  var k = s.xp / PROG.need(s.level);
  el.innerHTML = "<span class='lv'>" + t("lvl", { n: s.level }) + "</span><span class='bar'><i style='width:" + (k * 100).toFixed(0) + "%'></i></span><span class='xp'>" + s.xp + " / " + PROG.need(s.level) + " XP · 🪙 " + s.coins + "</span>";
};
document.addEventListener("DOMContentLoaded", function() { PROG.badge(); });
if (document.readyState !== "loading") setTimeout(PROG.badge, 0);

// (button sounds live in juice.js)
