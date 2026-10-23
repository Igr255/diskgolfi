"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── PROFILE · LOCKER · CASES ─────────────────────────────────────────────────
// One place for everything about you: name, stats, character + cosmetics, a
// skin per disc type, and your cases (with a spinning reel to open them).
// ══════════════════════════════════════════════════════════════════════════════
var PF = { tab: "character", cat: "body", disc: "midrange", open: false, view: null, preview: null, zoom: 1 };
var RARITY_HEX = { common: "#9aa8b4", rare: "#3a9aff", epic: "#b45aff", legendary: "#ffb020" };

// ── Styles ───────────────────────────────────────────────────────────────────
(function() {
  var css = `
#profile .sheet{max-width:1060px;padding:18px 20px 20px;}
.pf-main{display:grid;grid-template-columns:minmax(270px,36%) 1fr;gap:18px;height:min(74vh,640px);}
.pf-left{display:flex;flex-direction:column;gap:10px;min-height:0;min-width:0;}
.pf-stage{position:relative;flex:1;min-height:0;border-radius:24px;overflow:hidden;
  background:radial-gradient(60% 45% at 50% 34%,rgba(255,255,255,.95) 0%,rgba(255,255,255,0) 72%),radial-gradient(80% 30% at 50% 96%,rgba(80,170,215,.45) 0%,rgba(80,170,215,0) 70%),linear-gradient(180deg,#eef9ff 0%,#d3eefb 58%,#b2ddf2 100%);
  box-shadow:inset 0 0 0 1px rgba(18,70,104,.08);}
#pf-canvas{position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:none;}
#pf-canvas:active{cursor:grabbing;}
.pf-stage-tag{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);max-width:calc(100% - 24px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  font-weight:800;font-size:13px;color:#15476a;background:rgba(255,255,255,.82);padding:5px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(10,50,80,.12);pointer-events:none;}
.pf-view{position:absolute;top:10px;right:10px;display:flex;flex-direction:column;gap:6px;}
.pf-view button{width:38px;height:38px;border-radius:12px;border:0;background:rgba(255,255,255,.8);font-size:18px;cursor:pointer;display:grid;place-items:center;
  box-shadow:0 3px 10px rgba(10,50,80,.12);transition:transform .12s,background .12s;}
.pf-view button:hover{transform:scale(1.08);}
.pf-view button.on{background:#33c3ef;box-shadow:0 0 0 2px #fff,0 3px 12px rgba(10,50,80,.25);}
.pf-hint{position:absolute;left:12px;top:12px;font-size:11px;font-weight:800;color:rgba(21,71,106,.6);pointer-events:none;transition:opacity .8s;}
.pf-hint.gone{opacity:0;}
.pf-try{position:absolute;left:10px;right:58px;top:10px;display:none;align-items:center;gap:8px;padding:7px 8px 7px 12px;border-radius:14px;
  background:rgba(21,71,106,.88);color:#fff;font-size:12px;font-weight:700;line-height:1.3;box-shadow:0 6px 18px rgba(10,40,70,.25);}
.pf-try.on{display:flex;}
.pf-try span{flex:1;min-width:0;}
.pf-try b{color:#ffe27a;}
.pf-try button{flex:none;width:26px;height:26px;border-radius:50%;border:0;background:rgba(255,255,255,.18);color:#fff;cursor:pointer;font-size:13px;}
.pf-slots{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;}
.pf-slot{border:0;border-radius:14px;background:rgba(255,255,255,.75);box-shadow:inset 0 0 0 1px rgba(18,70,104,.08);padding:6px 3px 5px;cursor:pointer;
  text-align:center;min-width:0;font:inherit;color:#15476a;transition:transform .12s;}
.pf-slot:hover{transform:translateY(-2px);}
.pf-slot.on{box-shadow:0 0 0 2px #33c3ef;}
.pf-slot .i{display:block;font-size:20px;line-height:1.25;}
.pf-slot .n{display:block;font-size:10px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pf-slot .s{display:block;font-size:9px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#7a98ae;}
.pf-right{display:flex;flex-direction:column;min-height:0;min-width:0;}
.pf-id{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px;}
.pf-id .field{flex:1;min-width:160px;margin:0;}
.pf-lv{display:flex;flex-direction:column;gap:4px;min-width:120px;font-size:12px;font-weight:900;color:#15476a;}
.pf-lv i{display:block;height:7px;border-radius:999px;background:rgba(18,70,104,.1);overflow:hidden;}
.pf-lv i b{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#33c3ef,#7ae0a8);}
.pf-lv small{font-size:10px;font-weight:800;color:#7a98ae;}
.pf-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:8px;}
.pf-stat{background:rgba(255,255,255,.7);border:1px solid rgba(18,70,104,.08);border-radius:14px;padding:6px 4px;text-align:center;}
.pf-stat b{display:block;font-size:17px;font-weight:900;color:#15476a;line-height:1.1;}
.pf-stat span{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#5a7a92;}
.pf-wallet{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
.pf-wallet .chip{font-weight:800;}
.pf-tabs{display:flex;gap:6px;margin:0 0 8px;}
.pf-tabs .chip{position:relative;height:32px;padding:0 14px;font-size:13px;}
.pf-badge{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;margin-left:6px;border-radius:999px;background:#ff5a7a;color:#fff;font-size:11px;font-weight:900;}
.pf-cats{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;}
.pf-cats:empty{display:none;}
.pf-cat{display:inline-flex;align-items:center;gap:5px;height:34px;padding:0 9px;border-radius:12px;border:0;background:rgba(255,255,255,.72);
  box-shadow:inset 0 0 0 1px rgba(18,70,104,.1);color:#15476a;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;transition:transform .12s;}
.pf-cat:hover{transform:translateY(-1px);}
.pf-cat small{font-size:10px;font-weight:900;color:#7a98ae;}
.pf-cat.on{background:#15476a;color:#fff;box-shadow:none;}
.pf-cat.on small{color:#9fdcff;}
.pf-note{font-size:12px;font-weight:700;color:#5a7a92;margin:2px 2px 10px;}
.pf-sec{font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#4a6a82;margin:12px 2px 6px;}
.pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;}
.pf-card{position:relative;border-radius:16px;background:rgba(255,255,255,.75);border:1px solid rgba(18,70,104,.1);padding:8px 6px 8px;text-align:center;cursor:pointer;
  transition:transform .15s,box-shadow .15s;overflow:hidden;}
.pf-card:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(10,50,80,.14);}
.pf-card.on{box-shadow:0 0 0 2.5px #33c3ef,0 8px 18px rgba(10,50,80,.14);}
.pf-card.locked:hover .pf-thumb{filter:grayscale(.35) brightness(.95) opacity(.85);}
.pf-card.trying{box-shadow:0 0 0 2.5px #ffb020,0 8px 18px rgba(10,50,80,.14);}
.pf-card.none .pf-thumb{font-size:30px;color:#9ab0c0;}
.pf-card.locked .pf-thumb{filter:grayscale(1) brightness(.75) opacity(.55);}
.pf-card::after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--rc,#9aa8b4);}
.pf-thumb{width:76px;height:76px;margin:0 auto;display:grid;place-items:center;font-size:42px;}
.pf-thumb img{width:76px;height:76px;object-fit:contain;}
.pf-name{font-size:12px;font-weight:800;color:#15476a;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pf-meta{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--rc,#9aa8b4);}
.pf-lock{position:absolute;top:6px;right:7px;font-size:12px;opacity:.75;}
.pf-scroll{flex:1;min-height:0;overflow-y:auto;padding:2px 4px 8px 2px;}
.pf-cases{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.pf-case{border-radius:22px;padding:18px;background:rgba(255,255,255,.75);border:1px solid rgba(18,70,104,.1);text-align:center;}
.pf-box{width:110px;height:110px;margin:4px auto 10px;border-radius:24px;display:grid;place-items:center;font-size:54px;
  background:linear-gradient(145deg,var(--cc),#ffffff 140%);box-shadow:0 14px 30px -10px var(--cc),inset 0 -6px 0 rgba(0,0,0,.12),inset 0 2px 0 rgba(255,255,255,.6);
  animation:pfBob 3s ease-in-out infinite;}
@keyframes pfBob{50%{transform:translateY(-6px) rotate(-3deg)}}
.pf-case h3{margin:0;font-size:18px;color:#15476a;}
.pf-case p{margin:4px 0 12px;font-size:12px;color:#4a6a82;font-weight:600;}
.pf-case .cnt{font-size:13px;font-weight:900;color:#15476a;margin-bottom:10px;}
.pf-case .btn{margin:3px;}
.pf-odds{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:12px;font-size:11px;font-weight:800;}
.pf-odds span{padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.75);border:1px solid rgba(18,70,104,.08);}
.pf-how{margin-top:12px;font-size:12px;color:#4a6a82;font-weight:600;text-align:center;line-height:1.5;}
/* Case opening */
#case-open{position:fixed;inset:0;z-index:260;display:none;flex-direction:column;align-items:center;justify-content:center;gap:18px;
  background:radial-gradient(80% 70% at 50% 40%,#1e466e,#06101e);color:#fff;padding:20px;}
#case-open h2{margin:0;font-size:26px;font-weight:900;letter-spacing:.02em;text-shadow:0 4px 20px rgba(0,0,0,.4);}
.co-window{position:relative;width:min(920px,94vw);height:168px;overflow:hidden;border-radius:22px;background:rgba(255,255,255,.07);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.15),inset 0 0 60px rgba(0,0,0,.35);}
.co-window::before,.co-window::after{content:"";position:absolute;top:0;bottom:0;width:120px;z-index:2;pointer-events:none;}
.co-window::before{left:0;background:linear-gradient(90deg,rgba(6,16,30,.9),transparent);}
.co-window::after{right:0;background:linear-gradient(-90deg,rgba(6,16,30,.9),transparent);}
.co-marker{position:absolute;left:50%;top:-4px;bottom:-4px;width:4px;margin-left:-2px;background:#ffe27a;z-index:3;border-radius:2px;box-shadow:0 0 18px #ffd23a;}
.co-strip{position:absolute;left:0;top:14px;display:flex;gap:10px;will-change:transform;}
.co-item{flex:none;width:130px;height:140px;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.05));
  border-bottom:5px solid var(--rc);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;box-shadow:inset 0 0 30px -10px var(--rc);}
.co-item .pf-thumb{width:84px;height:84px;font-size:50px;}
.co-item .pf-thumb img{width:84px;height:84px;}
.co-item b{font-size:12px;font-weight:800;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.co-reveal{display:none;flex-direction:column;align-items:center;gap:10px;text-align:center;}
.co-reveal.on{display:flex;animation:coPop .5s cubic-bezier(.2,1.6,.4,1);}
@keyframes coPop{from{transform:scale(.6);opacity:0}}
.co-prize{width:220px;height:220px;border-radius:30px;display:grid;place-items:center;font-size:120px;position:relative;
  background:radial-gradient(circle,var(--rc) 0%,transparent 70%);}
.co-prize img{width:200px;height:200px;object-fit:contain;filter:drop-shadow(0 12px 30px rgba(0,0,0,.4));}
.co-prize::before{content:"";position:absolute;inset:-40px;background:conic-gradient(from 0deg,transparent,var(--rc),transparent 30%,var(--rc),transparent 60%,var(--rc),transparent);
  opacity:.35;border-radius:50%;animation:coSpin 6s linear infinite;z-index:-1;}
@keyframes coSpin{to{transform:rotate(360deg)}}
.co-rar{font-size:13px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--rc);}
.co-title{font-size:30px;font-weight:900;}
.co-sub{font-size:14px;font-weight:700;opacity:.85;}
.co-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px;}
.co-actions .chip{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.3);}
.co-actions .chip.on{background:#fff;color:#15476a;}
.fc-reward{margin:12px auto 0;padding:10px 16px;border-radius:16px;background:linear-gradient(90deg,rgba(255,226,122,.35),rgba(255,154,200,.35));font-weight:800;color:#15476a;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;}
.menu-badge{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;margin-left:6px;border-radius:999px;background:#ff5a7a;color:#fff;font-size:11px;font-weight:900;vertical-align:middle;}
@media (max-width:700px){
  .pf-main{grid-template-columns:1fr;height:auto;gap:10px;}
  .pf-left{display:contents;}
  .pf-stage{flex:none;height:min(38vh,320px);position:sticky;top:0;z-index:3;box-shadow:inset 0 0 0 1px rgba(18,70,104,.08),0 12px 26px -14px rgba(10,50,80,.45);}
  .pf-scroll{flex:none;overflow:visible;}
  .pf-cats{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -2px 8px;padding:0 2px;}
  .pf-cats::-webkit-scrollbar{display:none;}
  .pf-cat{flex:none;}
  .pf-slot .n{font-size:9px;}
  .pf-stats{grid-template-columns:repeat(5,1fr);}
  .pf-stat b{font-size:16px;}
  .pf-cases{grid-template-columns:1fr;}
  .co-item{width:104px;height:120px;} .co-item .pf-thumb,.co-item .pf-thumb img{width:66px;height:66px;}
  .co-prize{width:170px;height:170px;} .co-prize img{width:150px;height:150px;}
}`;
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
})();

// ── Markup ───────────────────────────────────────────────────────────────────
PF.init = function() {
  if (document.getElementById("profile")) return;
  var m = document.createElement("div");
  m.id = "profile"; m.className = "modal";
  m.onclick = function(e) { if (e.target === m) closeProfile(); };
  m.innerHTML =
    "<div class='sheet'>" +
      "<div class='sheet-head'><h2>Profile</h2><button class='x' onclick='closeProfile()' aria-label='Close'>✕</button></div>" +
      "<div class='pf-main'>" +
        "<div class='pf-left'>" +
          "<div class='pf-stage'><canvas id='pf-canvas'></canvas>" +
            "<div class='pf-hint' id='pf-hint'>⟲ drag to spin · tap to poke</div>" +
            "<div class='pf-try' id='pf-try'></div>" +
            "<div class='pf-view' id='pf-view'></div>" +
            "<div class='pf-stage-tag' id='pf-stage-tag'></div>" +
          "</div>" +
          "<div class='pf-slots' id='pf-slots'></div>" +
        "</div>" +
        "<div class='pf-right'>" +
          "<div class='pf-id'><label class='field'><span class='k'>Name</span><input id='pf-name' class='input' maxlength='16' autocomplete='off'></label><div class='pf-lv' id='pf-lv'></div></div>" +
          "<div class='pf-stats' id='pf-stats'></div>" +
          "<div class='pf-wallet' id='pf-wallet'></div>" +
          "<div class='pf-tabs' id='pf-tabs'></div>" +
          "<div class='pf-cats' id='pf-cats'></div>" +
          "<div id='pf-body' class='pf-scroll'></div>" +
        "</div>" +
      "</div>" +
    "</div>";
  document.body.appendChild(m);
  var co = document.createElement("div");
  co.id = "case-open";
  co.innerHTML = "<h2 id='co-title'></h2><div class='co-window' id='co-window'><div class='co-marker'></div><div class='co-strip' id='co-strip'></div></div>" +
    "<div class='co-reveal' id='co-reveal'></div>";
  document.body.appendChild(co);
  var nm = document.getElementById("pf-name");
  nm.oninput = function() { var u = document.getElementById("username-input"); if (u) u.value = nm.value; if (typeof playerNames !== "undefined") playerNames[0] = nm.value || "Player 1"; };
  PF.dragInit();
  COS.onChange = PF.refreshBadges;
  PF.refreshBadges();
};

function openProfile(tab) {
  PF.init();
  if (tab) PF.tab = tab;
  if (tab === "character" && PF.cat === "celeb") PF.cat = "body";
  PF.preview = null; PF.view = null; PF.zoom = 1;
  if (typeof selectedDisc !== "undefined" && DISCS[selectedDisc]) PF.disc = selectedDisc;
  document.getElementById("profile").style.display = "block";
  var u = document.getElementById("username-input"); document.getElementById("pf-name").value = u ? u.value : "Player 1";
  PF.open = true;
  PF.render();
  PF.stageStart();
}
function closeProfile() {
  var el = document.getElementById("profile"); if (el) el.style.display = "none";
  PF.open = false;
}
// The old separate lockers now open the matching profile tab
function openDiscLocker() { openProfile("discs"); }
function openSkinLocker() { openProfile("character"); }

PF.refreshBadges = function() {
  var n = COS.casesTotal();
  document.querySelectorAll("[data-case-badge]").forEach(function(b) { b.textContent = n; b.style.display = n ? "" : "none"; });
};

// ── Rendering of the profile ─────────────────────────────────────────────────
PF.CATS = [["body", "🧍", "Character"], ["hat", "🎩", "Hats"], ["back", "🪽", "Back"], ["aura", "✨", "Auras"], ["finish", "🎨", "Finishes"], ["celeb", "🎉", "Celebrate"]];
PF.SLOTS = ["hat", "back", "aura", "finish"];
PF.render = function() {
  var st = (typeof dgStats !== "undefined") ? dgStats : { holes: 0, aces: 0, birdies: 0, longest: 0 };
  document.getElementById("pf-stats").innerHTML = [["Wins", COS.state.wins], ["Holes", st.holes], ["Aces", st.aces], ["Birdies", st.birdies], ["Longest", (st.longest || 0) + "m"]]
    .map(function(s) { return "<div class='pf-stat'><b>" + s[1] + "</b><span>" + s[0] + "</span></div>"; }).join("");
  document.getElementById("pf-wallet").innerHTML = "<span class='chip'>🪙 " + COS.state.coins + " coins</span><span class='chip'>📦 " + COS.casesTotal() + " case" + (COS.casesTotal() === 1 ? "" : "s") + "</span><span class='chip'>🎉 " + COS.state.opened + " opened</span>";
  if (typeof PROG !== "undefined") {
    var ps = PROG.st(), need = PROG.need(ps.level || 1);
    document.getElementById("pf-lv").innerHTML = "<span>Level " + (ps.level || 1) + "</span><i><b style='width:" + Math.round(Math.min(1, (ps.xp || 0) / need) * 100) + "%'></b></i><small>" + (ps.xp || 0) + " / " + need + " XP</small>";
  }
  var tabs = [["character", "Character"], ["discs", "Discs"], ["cases", "Cases"]];
  document.getElementById("pf-tabs").innerHTML = tabs.map(function(t) {
    return "<button class='chip" + (PF.tab === t[0] ? " on" : "") + "' onclick=\"PF.go('" + t[0] + "')\">" + t[1] +
      (t[0] === "cases" && COS.casesTotal() ? "<span class='pf-badge'>" + COS.casesTotal() + "</span>" : "") + "</button>";
  }).join("");
  document.getElementById("pf-cats").innerHTML = PF.tab !== "character" ? "" : PF.CATS.map(function(c) {
    var n = "";
    if (PF.SLOTS.indexOf(c[0]) >= 0) { var all = COS.STYLE.filter(function(s) { return s.slot === c[0]; }); n = all.filter(function(s) { return COS.ownsStyle(s.id); }).length + "/" + all.length; }
    else if (c[0] === "celeb" && typeof EMOTE !== "undefined") n = EMOTE.avail().length + "/" + EMOTE.LIST.length;
    return "<button class='pf-cat" + (PF.cat === c[0] ? " on" : "") + "' onclick=\"PF.go('" + c[0] + "')\">" + c[1] + " " + c[2] + (n ? " <small>" + n + "</small>" : "") + "</button>";
  }).join("");
  var body = document.getElementById("pf-body");
  if (PF.tab === "character") body.innerHTML = PF.characterTab();
  else if (PF.tab === "discs") body.innerHTML = PF.discTab();
  else body.innerHTML = PF.casesTab();
  PF.fillThumbs(body);
  PF.renderSlots(); PF.stageUi();
  PF.refreshBadges();
};
// What you're wearing, one tile per slot (tap to jump to it)
PF.renderSlots = function() {
  var eq = COS.equipped(), ch = PLAYER_SKINS.find(function(p) { return p.id === equippedPlayerSkin; }) || {};
  var sk = COS.discSkin((equippedSkins || {})[PF.disc] || "classic") || {};
  var it = function(slot, label) { var s = COS.style(eq[slot]); return [slot, s ? s.icon : "—", s ? s.name : "None", label]; };
  var tiles = [["body", ch.icon || "🧍", ch.name || "Player", "Character"], it("hat", "Hat"), it("back", "Back"), it("aura", "Aura"), it("finish", "Finish"), ["discs", "🥏", sk.name || "Classic", DISCS[PF.disc].label]];
  document.getElementById("pf-slots").innerHTML = tiles.map(function(t) {
    var on = t[0] === "discs" ? PF.tab === "discs" : PF.tab === "character" && PF.cat === t[0];
    return "<button class='pf-slot" + (on ? " on" : "") + "' onclick=\"PF.go('" + t[0] + "')\" title='" + t[3] + ": " + t[2] + "'><span class='i'>" + t[1] + "</span><span class='n'>" + t[2] + "</span><span class='s'>" + t[3] + "</span></button>";
  }).join("");
};
// Jump to a tab ("character" / "discs" / "cases") or a character category
PF.go = function(k) {
  if (k === "character" || k === "discs" || k === "cases") PF.tab = k;
  else { PF.tab = "character"; PF.cat = k; }
  PF.view = null; PF.zoom = 1;
  if (PF.preview && !(PF.preview.slot === (PF.tab === "discs" ? "disc" : PF.cat))) PF.stopTry();
  PF.render();
  var b = document.getElementById("pf-body"); if (b) b.scrollTop = 0;
};
PF.wear = function(slot, id) {
  PF.preview = null;
  COS.equip(slot, id);   // tapping what you already wear takes it off
  PF.render();
};
PF.unequip = function(slot) { PF.preview = null; var cur = COS.equipped()[slot]; if (cur) COS.equip(slot, cur); PF.render(); };
// Locked items can be tried on (stage only)
PF.tryOn = function(slot, id) {
  var same = PF.preview && PF.preview.slot === slot && PF.preview.id === id;
  PF.preview = same ? null : { slot: slot, id: id };
  if (slot === "disc") PF.stageDisc();
  PF.render();
};
PF.stopTry = function() { var d = PF.preview && PF.preview.slot === "disc"; PF.preview = null; if (d) PF.stageDisc(); if (PF.open) PF.render(); };
function _pfCard(o) {
  // o: {id, name, rarity, icon|thumb, on, locked, trying, meta, onclick, tryon, extra}
  var click = o.locked ? o.tryon : o.onclick;
  return "<div class='pf-card" + (o.on ? " on" : "") + (o.locked ? " locked" : "") + (o.trying ? " trying" : "") + (o.extra ? " " + o.extra : "") + "' style='--rc:" + (RARITY_HEX[o.rarity] || "#9aa8b4") + "'" +
    (o.locked ? " title='" + (o.lockText || "Locked") + (o.tryon ? " — tap to try it on" : "") + "'" : "") + (click ? " onclick=\"" + click + "\"" : "") + ">" +
    (o.locked ? "<span class='pf-lock'>🔒</span>" : "") +
    "<div class='pf-thumb'" + (o.thumb ? " data-thumb='" + o.thumb + "'" : "") + ">" + (o.thumb ? "" : (o.icon || "")) + "</div>" +
    "<div class='pf-name'>" + o.name + "</div><div class='pf-meta'>" + (o.meta || o.rarity || "") + "</div></div>";
}
PF.characterTab = function() {
  var eq = COS.equipped(), h = "", c = PF.cat;
  if (c === "celeb") {
    if (typeof EMOTE === "undefined") return "";
    var cur = PROG.st().celebration || "cheer", lv = PROG.st().level || 1;
    h += "<div class='pf-note'>" + t("celebration") + " — what you do after a great shot. Tap one to see it.</div><div class='pf-grid'>";
    EMOTE.LIST.forEach(function(e) {
      var locked = !!(e.lvl && lv < e.lvl);
      h += _pfCard({ id: e.id, name: e.name, icon: e.icon, rarity: e.lvl ? (e.lvl >= 5 ? "epic" : "rare") : "common", on: cur === e.id, locked: locked,
        lockText: "Unlocks at level " + e.lvl, meta: locked ? "Level " + e.lvl : (e.proc ? "Dance" : "Move"),
        onclick: "PROG.st().celebration='" + e.id + "';COS.save();PF.render();PF.previewEmote('" + e.id + "')", tryon: "PF.previewEmote('" + e.id + "')" });
    });
    return h + "</div>";
  }
  if (c === "body") {
    h += "<div class='pf-grid'>";
    PLAYER_SKINS.forEach(function(s) {
      h += _pfCard({ id: s.id, name: s.name, rarity: "common", icon: s.icon, on: equippedPlayerSkin === s.id, meta: s.blurb || "", onclick: "PF.setChar('" + s.id + "')" });
    });
    return h + "</div>";
  }
  var notes = { hat: "Sits on your head in every game. Locked ones can be tried on.", back: "Strapped to your back — the throw camera shows it off all round.", aura: "A trail from your feet while you walk.", finish: "How your whole character is rendered." };
  h += "<div class='pf-note'>" + notes[c] + "</div><div class='pf-grid'>";
  h += _pfCard({ id: "none", name: "None", icon: "⦸", on: !eq[c], extra: "none", meta: "", onclick: "PF.unequip('" + c + "')" });
  COS.STYLE.filter(function(s) { return s.slot === c; }).forEach(function(s) {
    var own = COS.ownsStyle(s.id), trying = !!(PF.preview && PF.preview.slot === c && PF.preview.id === s.id);
    h += _pfCard({ id: s.id, name: s.name, rarity: s.rarity, icon: s.icon, thumb: c === "hat" || c === "back" ? c + ":" + s.id : null, on: eq[c] === s.id, locked: !own, trying: trying,
      lockText: "Win it from a Style Case", meta: own ? s.rarity : (trying ? "trying on" : "Style Case"),
      onclick: "PF.wear('" + c + "','" + s.id + "')", tryon: "PF.tryOn('" + c + "','" + s.id + "')" });
  });
  return h + "</div>";
};
PF.discTab = function() {
  var h = "<div class='pf-note'>Pick a disc, then its skin — your golfer shows it off. Locked skins can be tried on.</div><div class='tabs' style='margin-bottom:10px'>";
  Object.keys(DISCS).forEach(function(k) {
    h += "<button class='chip" + (PF.disc === k ? " on" : "") + "' onclick=\"PF.disc='" + k + "';PF.preview=null;PF.render();PF.stageDisc()\"><span class='dot' style='background:" + (typeof _discCss === "function" ? _discCss(k) : "#ccc") + "'></span>" + DISCS[k].label + "</button>";
  });
  h += "</div><div class='pf-grid'>";
  var eqId = (equippedSkins && equippedSkins[PF.disc]) || "classic";
  var skins = DISC_SKINS._global.concat(PF.disc === "vilov" ? (DISC_SKINS.vilov || []) : []);
  var order = { legendary: 0, epic: 1, rare: 2, common: 3 };
  skins.slice().sort(function(a, b) { var oa = COS.ownsDisc(a.id) ? 0 : 1, ob = COS.ownsDisc(b.id) ? 0 : 1; return oa - ob || order[a.rarity] - order[b.rarity]; }).forEach(function(s) {
    var own = COS.ownsDisc(s.id), trying = !!(PF.preview && PF.preview.slot === "disc" && PF.preview.id === s.id);
    h += _pfCard({ id: s.id, name: s.name, rarity: s.rarity, thumb: "disc:" + PF.disc + ":" + s.id, on: eqId === s.id, locked: !own, trying: trying,
      lockText: s.desc + " — win it from a Disc Case" + (s.unlock && s.unlock !== "Always unlocked." ? " (or: " + s.unlock + ")" : ""),
      meta: own ? s.rarity : (trying ? "trying on" : "Disc Case"), onclick: "PF.setDiscSkin('" + PF.disc + "','" + s.id + "')", tryon: "PF.tryOn('disc','" + s.id + "')" });
  });
  return h + "</div>";
};
PF.casesTab = function() {
  var h = "<div class='pf-cases'>";
  Object.keys(COS.CASES).forEach(function(k) {
    var C = COS.CASES[k], n = COS.state.cases[k];
    h += "<div class='pf-case'><div class='pf-box' style='--cc:" + C.color + "'>" + C.icon + "</div><h3>" + C.name + "</h3><p>" + C.desc + "</p>" +
      "<div class='cnt'>You have " + n + "</div>" +
      "<button class='btn primary' " + (n ? "" : "disabled") + " onclick=\"PF.openCase('" + k + "')\">Open</button>" +
      "<button class='btn' " + (COS.state.coins >= COS.CASE_PRICE ? "" : "disabled") + " onclick=\"if(COS.buyCase('" + k + "'))PF.render()\">Buy · 🪙 " + COS.CASE_PRICE + "</button></div>";
  });
  h += "</div><div class='pf-odds'>" + COS.RARITIES.map(function(r) { return "<span style='color:" + RARITY_HEX[r] + "'>" + r + " " + COS.RARITY_WEIGHT[r] + "%</span>"; }).join("") + "</div>";
  h += "<div class='code-row' style='margin-top:12px'><input id='pf-code' class='input' placeholder='Got a code?' maxlength='20' autocomplete='off'><button class='btn' onclick='PF.redeem()'>Redeem</button></div>";
  h += "<div class='pf-how'>🏆 <b>Win a game to earn a case:</b> finish a single-player round at or under par, or win a multiplayer match.<br>Already own what you pull? You get coins instead — 100 coins buys a case.</div>";
  return h;
};

PF.redeem = function() {
  var el = document.getElementById("pf-code"); if (!el) return;
  var c = el.value.trim().toUpperCase(); el.value = "";
  if (c === COS.SECRET || c === (typeof PLAYER_SKINS_MASTER_CODE !== "undefined" ? PLAYER_SKINS_MASTER_CODE : "TOYOTA")) { COS.unlockAll(); PF.toast("💧 Every cosmetic unlocked!"); PF.render(); }
  else { el.placeholder = "That code didn't work"; }
};
PF.setChar = function(id) {
  equippedPlayerSkin = id; if (typeof savePlayerSkin === "function") savePlayerSkin();
  if (typeof scene !== "undefined" && typeof localAvatarMesh !== "undefined" && localAvatarMesh && phase !== "MENU") {
    scene.remove(localAvatarMesh);
    localAvatarMesh = buildPlayerAvatar(myIdx, PLAYER_COLORS[myIdx % PLAYER_COLORS.length]);
    localAvatarMesh.visible = cameraMode === "tp"; scene.add(localAvatarMesh);
  }
  if (typeof _lobbyRefreshMe === "function") _lobbyRefreshMe();   // the 3D lobby shows the new character right away
  if (typeof _sendLook === "function") _sendLook();               // … and so does everyone else's screen
  PF.render(); PF.stageRebuild();
};
PF.setDiscSkin = function(disc, id) {
  equippedSkins[disc] = id; saveSkins();
  if (typeof initGameDiscPicker === "function" && phase !== "MENU") initGameDiscPicker();
  if (typeof discMesh !== "undefined" && discMesh && selectedDisc === disc && phase !== "MENU" && phase !== "FLYING") {
    var old = discMesh, p = old.position.clone(), r = old.rotation.clone(), sc = old.scale.x;
    scene.remove(old); discMesh = buildDisc(disc); discMesh.position.copy(p); discMesh.rotation.copy(r); discMesh.scale.setScalar(sc);
    discMesh.frustumCulled = false; discMesh.traverse(function(c) { if (c.isMesh) { c.frustumCulled = false; c.renderOrder = 1; } });
    scene.add(discMesh);
  }
  if (typeof mpMode !== "undefined" && mpMode && typeof sendToAll === "function") sendToAll({ t: "skin_equip", disc: disc, skin: id, from: myIdx });
  PF.preview = null; PF.render(); PF.stageDisc();
};

// ══════════════════════════════════════════════════════════════════════════════
// ── 3D: live preview stage + thumbnails ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
PF._envFor = function(renderer) {
  // a soft studio environment so metal / gloss skins reflect something nice
  var es = new THREE.Scene();
  var sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, vertexShader: "varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "varying vec3 p; void main(){ float h = normalize(p).y; vec3 c = mix(vec3(0.55,0.62,0.7), vec3(1.0,1.0,1.0), smoothstep(-0.2,0.8,h)); c += vec3(1.6) * smoothstep(0.93,0.99, dot(normalize(p), normalize(vec3(0.4,0.7,0.6)))); gl_FragColor = vec4(c,1.0); }" }));
  es.add(sky);
  var pm = new THREE.PMREMGenerator(renderer);
  var env = pm.fromScene(es, 0.02).texture;
  pm.dispose();
  return env;
};
PF._mkRenderer = function(canvas, w, h) {
  var r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  if (w) r.setSize(w, h, false);
  r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  r.setClearColor(0x000000, 0);
  return r;
};
PF._lights = function(sc) {
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8aa0b0, 0.9));
  var d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(2, 4, 3); sc.add(d);
  var d2 = new THREE.DirectionalLight(0xbfe6ff, 0.6); d2.position.set(-3, 2, -2); sc.add(d2);
};

// Preview stage: your character on a turntable, holding the selected disc. The camera frames
// whatever you're shopping for (whole body / head + hat / the disc in hand) and measures the
// character every frame, so tall hats and halos always fit.
PF.stage = null;
PF.VIEWS = [["body", "🧍", "Whole body"], ["head", "🙂", "Head & hat"], ["back", "🪽", "Back"], ["disc", "🥏", "Disc in hand"]];
PF.autoView = function() { return PF.tab === "discs" ? "disc" : PF.tab !== "character" ? "body" : PF.cat === "hat" ? "head" : PF.cat === "back" ? "back" : "body"; };
PF.viewMode = function() { return PF.view || PF.autoView(); };
PF.setView = function(v) { PF.view = v; PF.zoom = 1; PF.stageUi(); };
PF.stageUi = function() {
  var vb = document.getElementById("pf-view"); if (!vb) return;
  var m = PF.viewMode();
  vb.innerHTML = PF.VIEWS.map(function(v) { return "<button class='" + (m === v[0] ? "on" : "") + "' title='" + v[2] + "' onclick=\"PF.setView('" + v[0] + "')\">" + v[1] + "</button>"; }).join("");
  var tr = document.getElementById("pf-try"), P = PF.preview;
  if (P) {
    var it = P.slot === "disc" ? COS.discSkin(P.id) : COS.style(P.id);
    tr.innerHTML = "<span>👀 Trying on <b>" + (it ? it.name : P.id) + "</b><br>🔒 Win it from a " + (P.slot === "disc" ? "Disc" : "Style") + " Case</span><button onclick='PF.stopTry()' title='Stop trying on'>✕</button>";
    tr.className = "pf-try on";
  } else tr.className = "pf-try";
  var hn = document.getElementById("pf-hint"); if (hn && P) hn.classList.add("gone");
  var ch = PLAYER_SKINS.find(function(p) { return p.id === equippedPlayerSkin; });
  var sk = COS.discSkin(P && P.slot === "disc" ? P.id : ((equippedSkins || {})[PF.disc] || "classic"));
  var tag = document.getElementById("pf-stage-tag"); if (tag) tag.textContent = (ch ? ch.name : "Player") + " · " + DISCS[PF.disc].label + ": " + (sk ? sk.name : "Classic");
};
PF._shadowTex = function() {
  var c = document.createElement("canvas"); c.width = c.height = 128;
  var x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(10,50,80,.45)"); g.addColorStop(0.55, "rgba(10,50,80,.18)"); g.addColorStop(1, "rgba(10,50,80,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
};
PF.stageStart = function() {
  var cv = document.getElementById("pf-canvas"); if (!cv) return;
  if (!PF.stage) {
    var r = PF._mkRenderer(cv);
    var sc = new THREE.Scene(); sc.environment = PF._envFor(r); PF._lights(sc);
    var cam = new THREE.PerspectiveCamera(28, 1, 0.05, 60);
    // turntable: a soft white puck with an aqua rim, a contact shadow under it
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: PF._shadowTex(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.075; sc.add(shadow);
    var deck = new THREE.Group(); sc.add(deck);
    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.82, 0.07, 64), new THREE.MeshStandardMaterial({ color: 0xf6fbff, roughness: 0.45, metalness: 0 }));
    top.position.y = -0.036; deck.add(top);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.022, 10, 80), new THREE.MeshStandardMaterial({ color: 0x33c3ef, emissive: new THREE.Color(0x33c3ef), emissiveIntensity: 0.5, roughness: 0.3 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = -0.005; deck.add(rim);
    for (var i = 0; i < 12; i++) {   // little studs so you can see it turn
      var st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 12), new THREE.MeshStandardMaterial({ color: 0xbfe6f6, roughness: 0.5 }));
      st.position.set(Math.cos(i / 12 * 6.283) * 0.68, 0.001, Math.sin(i / 12 * 6.283) * 0.68); deck.add(st);
    }
    PF.stage = { r: r, sc: sc, cam: cam, turn: 0.5, root: new THREE.Group(), deck: deck, c: new THREE.Vector3(0, 0.95, 0), d: 6, fresh: true };
    sc.add(PF.stage.root);
  }
  PF.stage.fresh = true;
  PF.stageRebuild();
  if (PF._loopRunning) return;
  PF._loopRunning = true;
  var last = 0;
  var loop = function(now) {
    if (!PF.open) { PF._loopRunning = false; return; }
    requestAnimationFrame(loop);
    if (PF.caseOpen || now - last < 33) return;   // 30 fps is plenty for a turntable; nothing while a case is opening
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    PF._stageFrame(cv, dt);
  };
  requestAnimationFrame(loop);
};
PF._stageFrame = function(cv, dt) {
  var S = PF.stage, w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * S.r.getPixelRatio()) || cv.height !== Math.round(h * S.r.getPixelRatio())) { S.r.setSize(w, h, false); S.cam.aspect = w / h; S.cam.updateProjectionMatrix(); }
  var mode = PF.viewMode(), av = S.avatar, t = performance.now() / 1000;
  // turntable: spins on its own (slower when you're looking at a hat); for the disc it swings the throwing hand to the camera
  if (!PF._drag) {
    if (mode === "disc" || mode === "back") { var aim = (mode === "back" ? 3.3 : 1.05) + Math.sin(t * 0.6) * (mode === "back" ? 0.45 : 0.3), tw = aim + Math.round((S.turn - aim) / 6.2832) * 6.2832; S.turn += (tw - S.turn) * Math.min(1, dt * 3); }
    else S.turn += dt * (mode === "head" ? 0.12 : 0.2);
  }
  S.root.rotation.y = S.turn; S.deck.rotation.y = S.turn;
  if (av && av.userData.glbLoaded && typeof ANIM !== "undefined") {
    var look = COS.equipped(), P = PF.preview;
    if (P && P.slot !== "disc") look[P.slot] = P.id;
    var sig = look.hat + "|" + look.back + "|" + look.aura + "|" + look.finish;
    if (S.dressSig !== sig) { COS.dressAvatar(av, look); S.dressSig = sig; S.hat = null; S.back = null; av.traverse(function(o) { if (o.name === "cos_hat") S.hat = o; if (o.name === "cos_back") S.back = o; }); }
    if (S.head === undefined) PF._measure(S);
    ANIM.drive(av, 0, 0.033, { fidget: false });   // bobblehead + dances
    if (S.disc) S.disc.visible = ANIM.holdDisc(av, S.disc, 0.54 * DISC_SCALE_HAND * 1.15);
    // auras sparkle around the feet (borrowing the game's particles; they keep updating in the main loop)
    if (av.userData.aura && typeof spawnSkinParticle === "function" && typeof particles !== "undefined") {
      S.auraAcc = (S.auraAcc || 0) + dt * 4.5;
      while (S.auraAcc > 1) {
        S.auraAcc -= 1;
        var lastP = particles[particles.length - 1], a = Math.random() * 6.2832, rr = 0.2 + Math.random() * 0.35;
        spawnSkinParticle(av.userData.aura, new THREE.Vector3(Math.cos(a) * rr, 0.06 + Math.random() * 1.2, Math.sin(a) * rr));
        var np = particles[particles.length - 1]; if (np && np !== lastP) { S.sc.add(np.mesh); np.base *= 0.55; np.mesh.scale.setScalar(np.base); np.vel.multiplyScalar(0.6); }   // up close they'd look huge
      }
    }
  }
  // frame it
  var F = PF._frame(S, mode), th = Math.tan(S.cam.fov * Math.PI / 360);
  var d = Math.max(F.hh / th, F.hw / (th * S.cam.aspect)) * 1.08 * (PF.zoom || 1);
  var k = S.fresh ? 1 : 1 - Math.exp(-dt * 5); S.fresh = false;
  S.c.lerp(F.c, k); S.d += (d - S.d) * k;
  S.cam.position.set(S.c.x, S.c.y + S.d * 0.1, S.c.z + S.d); S.cam.lookAt(S.c);
  S.r.render(S.sc, S.cam);
};
// Measure the character once it has loaded: where the head is and how far the skull reaches above it
PF._measure = function(S) {
  var av = S.avatar, glb = null; av.children.forEach(function(c) { if (c.name !== "cos_hat" && !glb) glb = c; });
  S.head = null; S.top0 = 1.8;
  if (!glb) return;
  av.updateMatrixWorld(true);
  var box = new THREE.Box3(), mb = new THREE.Box3();
  glb.traverse(function(m) { if (m.isMesh && !m.userData.cosHat) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); mb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); box.union(mb); } });
  if (box.isEmpty()) return;
  S.top0 = box.max.y;
  glb.traverse(function(o) { if (!S.head && o.isBone && /^(mixamorig:)?head$/i.test(o.name)) S.head = o; });
  if (S.head) S.crown = Math.max(0.12, box.max.y - S.head.getWorldPosition(new THREE.Vector3()).y);   // the mesh bounds ignore the bobblehead bone scale
};
// What the camera should fit: {c: centre, hh: half height, hw: half width}
PF._v1 = new THREE.Vector3(); PF._v2 = new THREE.Vector3(); PF._bb = new THREE.Box3();
PF._frame = function(S, mode) {
  var crown = S.top0, hy = S.top0 * 0.62, cx = 0, cz = 0, hb = null;   // no head bone (rubber duck): the top 40 %
  if (S.head) { var hp = S.head.getWorldPosition(PF._v1); hy = hp.y; crown = hy + S.crown * (S.head.scale.y || 1); cx = hp.x; cz = hp.z; }
  if (S.hat && S.hat.parent) { PF._bb.setFromObject(S.hat); if (!PF._bb.isEmpty()) hb = PF._bb; }
  if (hb && !S.head) { cx = (hb.min.x + hb.max.x) / 2; cz = (hb.min.z + hb.max.z) / 2; }
  var top = Math.max(crown, hb ? hb.max.y : -1), headH = Math.max(0.15, crown - hy);
  var hatHW = function(x) { return hb ? Math.max(hb.max.x - x, x - hb.min.x) + 0.12 : 0; };   // sombrero brims
  var dR = 0.54 * DISC_SCALE_HAND * 1.15, dp = S.disc && S.disc.visible ? S.disc.getWorldPosition(PF._v2) : null;
  if (mode === "head") {
    var y0 = hy - headH * 0.75, y1 = top + headH * 0.2;
    return { c: new THREE.Vector3(cx, (y0 + y1) / 2, cz), hh: (y1 - y0) / 2, hw: Math.max(headH * 1.05, hatHW(cx)) };
  }
  if (mode === "disc" && dp) {   // the disc, the arm holding it and the face
    var e0 = dp.y - dR - 0.12, e1 = top + 0.06, ex = dp.x * 0.5;
    return { c: new THREE.Vector3(ex, (e0 + e1) / 2, dp.z * 0.5), hh: (e1 - e0) / 2, hw: Math.max(0.6, Math.abs(dp.x - ex) + dR + 0.1) };
  }
  if (dp) top = Math.max(top, dp.y + dR + 0.05);   // a cheer lifts the disc over the head
  var bw = 0;
  if (S.back && S.back.parent) { PF._bb.setFromObject(S.back); if (!PF._bb.isEmpty()) { top = Math.max(top, PF._bb.max.y); bw = Math.max(-PF._bb.min.x, PF._bb.max.x, -PF._bb.min.z, PF._bb.max.z) + 0.06; } }   // balloons, wings
  var b0 = -0.2, b1 = top + 0.1;
  return { c: new THREE.Vector3(0, (b0 + b1) / 2, 0), hh: (b1 - b0) / 2, hw: Math.max(0.82, hatHW(0), bw) };
};
PF.stageRebuild = function() {
  var S = PF.stage; if (!S) return;
  while (S.root.children.length) S.root.remove(S.root.children[0]);
  var av = buildPlayerAvatar(typeof myIdx !== "undefined" ? myIdx : 0, PLAYER_COLORS[0]);
  S.root.add(av); S.avatar = av; S.dressSig = null; S.head = undefined; S.hat = null; S.top0 = 1.75;
  PF.stageDisc();
};
PF.stageDisc = function() {
  var S = PF.stage; if (!S) return;
  if (S.disc && S.disc.parent) S.disc.parent.remove(S.disc);
  var P = PF.preview, disc = buildDisc(PF.disc, 1, P && P.slot === "disc" ? P.id : undefined);
  disc.scale.setScalar(DISC_SCALE_HAND * 1.15); disc.visible = false;   // shown once it's in the hand
  S.sc.add(disc); S.disc = disc;
  PF.stageUi();
};
// Preview a celebration on the stage character
PF.previewEmote = function(id) {
  var S = PF.stage; if (!S || !S.avatar) return;
  setTimeout(function() {
    var av = PF.stage && PF.stage.avatar; if (!av) return;
    var em = typeof EMOTE !== "undefined" && EMOTE.LIST.find(function(e) { return e.id === id; });
    if (em && em.proc) { switchAvatarAnim(av, "idle"); ANIM.dance(av, id, 3.2); return; }
    if (id === "flip") { ANIM.flip(av); return; }
    switchAvatarAnim(av, id);
    clearTimeout(PF._emT); PF._emT = setTimeout(function() { if (PF.stage && PF.stage.avatar === av) switchAvatarAnim(av, "idle"); }, 3200);
  }, 60);
};
// Tap the character: it bounces and does one of its moves
PF.poke = function() {
  var S = PF.stage, av = S && S.avatar; if (!av || !av.userData.glbLoaded) return;
  ANIM.squash(av, 0.3);
  var moves = (typeof EMOTE !== "undefined" ? EMOTE.avail() : []).map(function(e) { return e.id; });
  if (moves.length) PF.previewEmote(moves[Math.floor(Math.random() * moves.length)]);
  if (typeof AudioEngine !== "undefined" && AudioEngine.sfx) AudioEngine.sfx("boing", 0.35);
};
PF.dragInit = function() {
  var cv = document.getElementById("pf-canvas"), lx = 0, moved = 0;
  var hint = function() { var h = document.getElementById("pf-hint"); if (h) h.classList.add("gone"); };
  cv.addEventListener("pointerdown", function(e) { PF._drag = true; lx = e.clientX; moved = 0; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", function(e) { if (!PF._drag || !PF.stage) return; var dx = e.clientX - lx; PF.stage.turn += dx * 0.012; moved += Math.abs(dx); lx = e.clientX; if (moved > 6) hint(); });
  cv.addEventListener("pointerup", function() { PF._drag = false; if (moved < 6) { PF.poke(); hint(); } });
  cv.addEventListener("pointercancel", function() { PF._drag = false; });
  cv.addEventListener("wheel", function(e) { e.preventDefault(); PF.zoom = Math.max(0.55, Math.min(1.35, (PF.zoom || 1) * (e.deltaY > 0 ? 1.08 : 1 / 1.08))); }, { passive: false });
};

// Thumbnails: rendered once per item, cached as images
PF._thumbs = {}; PF._queue = []; PF.TH = null;
PF.thumb = function(key, cb) {
  if (PF._thumbs[key]) { cb(PF._thumbs[key]); return; }
  PF._queue.push({ key: key, cb: cb });
  if (PF._queue.length === 1) setTimeout(PF._pump, 0);
};
PF._pump = function() {
  var t0 = performance.now();
  while (PF._queue.length && performance.now() - t0 < 24) {
    var job = PF._queue.shift();
    if (!PF._thumbs[job.key]) PF._thumbs[job.key] = PF._renderThumb(job.key);
    job.cb(PF._thumbs[job.key]);
  }
  if (PF._queue.length) setTimeout(PF._pump, 16);
};
PF._renderThumb = function(key) {
  if (!PF.TH) {
    var cv = document.createElement("canvas"); cv.width = cv.height = 192;
    var r = PF._mkRenderer(cv, 192, 192); r.setPixelRatio(1); r.setSize(192, 192, false);
    var sc = new THREE.Scene(); sc.environment = PF._envFor(r); PF._lights(sc);
    PF.TH = { r: r, sc: sc, cv: cv, cam: new THREE.PerspectiveCamera(30, 1, 0.05, 20) };
  }
  var T = PF.TH, parts = key.split(":"), obj;
  if (parts[0] === "disc") {
    obj = buildDisc(parts[1], 1, parts[2]); obj.rotation.x = 0.62; obj.rotation.z = -0.15;
    T.cam.position.set(0, 0.55, 2.35); T.cam.lookAt(0, 0, 0);
  } else {
    obj = parts[0] === "back" ? COS.buildBack(parts[1]) : COS.buildHat(parts[1]);
    if (parts[0] === "back") obj.rotation.y = Math.PI;
    var bb = new THREE.Box3().setFromObject(obj), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()).length();
    obj.position.sub(c); obj.rotation.y += -0.5;
    T.cam.position.set(0, sz * 0.55, sz * 1.9); T.cam.lookAt(0, 0, 0);
  }
  T.sc.add(obj);
  T.r.render(T.sc, T.cam);
  var url = T.cv.toDataURL("image/png");
  T.sc.remove(obj);
  return url;
};
PF.fillThumbs = function(root) {
  root.querySelectorAll("[data-thumb]").forEach(function(el) {
    var key = el.getAttribute("data-thumb");
    PF.thumb(key, function(url) { el.innerHTML = "<img alt='' src='" + url + "'>"; });
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// ── CASE OPENING ─────────────────────────────────────────────────────────────
// A reel of random items scrolls past a marker and eases out on your prize.
// ══════════════════════════════════════════════════════════════════════════════
PF._itemView = function(kind, item) {
  if (kind === "disc") return { thumb: "disc:" + (PF.disc || "midrange") + ":" + item.id, name: item.name, rarity: item.rarity };
  return { thumb: item.slot === "hat" || item.slot === "back" ? item.slot + ":" + item.id : null, icon: item.icon, name: item.name, rarity: item.rarity };
};
PF.openCase = function(kind) {
  var res = COS.openCase(kind); if (!res) return;
  PF.render();
  var co = document.getElementById("case-open"), strip = document.getElementById("co-strip"), rev = document.getElementById("co-reveal");
  document.getElementById("co-title").textContent = "Opening " + COS.CASES[kind].name + "…";
  rev.className = "co-reveal"; rev.innerHTML = "";
  document.getElementById("co-window").style.display = "";
  co.style.display = "flex"; PF.caseOpen = true;
  // Reel: 44 random items, the prize at index 38
  var N = 44, WIN = 38, items = [];
  for (var i = 0; i < N; i++) items.push(i === WIN ? res.item : COS.rollItem(kind));
  strip.innerHTML = items.map(function(it) {
    var v = PF._itemView(kind, it);
    return "<div class='co-item' style='--rc:" + RARITY_HEX[v.rarity] + "'><div class='pf-thumb'" + (v.thumb ? " data-thumb='" + v.thumb + "'" : "") + ">" + (v.thumb ? "" : v.icon) + "</div><b>" + v.name + "</b></div>";
  }).join("");
  PF.fillThumbs(strip);
  var win = document.getElementById("co-window"), itemW = strip.children[0].getBoundingClientRect().width + 10;
  var target = WIN * itemW + itemW / 2 - win.clientWidth / 2 + (Math.random() - 0.5) * itemW * 0.6;
  var dur = 5200, t0 = performance.now(), lastIdx = -1;
  strip.style.transform = "translateX(0px)";
  var step = function() {
    var k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 4);
    var x = target * e;
    strip.style.transform = "translateX(" + (-x) + "px)";
    var idx = Math.floor((x + win.clientWidth / 2) / itemW);
    if (idx !== lastIdx) { lastIdx = idx; AudioEngine.sfx("click"); }
    if (k < 1) requestAnimationFrame(step);
    else setTimeout(function() { PF.reveal(res); }, 350);
  };
  AudioEngine.init();
  requestAnimationFrame(step);
};
PF.reveal = function(res) {
  var v = PF._itemView(res.kind, res.item), rev = document.getElementById("co-reveal");
  document.getElementById("co-window").style.display = "none";
  document.getElementById("co-title").textContent = res.dup ? "Already in your collection" : "New " + (res.kind === "disc" ? "disc skin" : "style") + "!";
  var equipRow = "";
  if (!res.dup || true) {
    if (res.kind === "disc") {
      equipRow = "<div class='co-sub'>Put it on:</div><div class='co-actions'>" + Object.keys(DISCS).filter(function(k) { return k !== "vilov"; }).map(function(k) {
        var on = (equippedSkins[k] || "classic") === res.item.id;
        return "<button class='chip" + (on ? " on" : "") + "' onclick=\"PF.setDiscSkin('" + k + "','" + res.item.id + "');this.classList.add('on')\">" + DISCS[k].label + "</button>";
      }).join("") + "</div>";
    } else {
      var on = COS.equipped()[res.item.slot] === res.item.id;
      equipRow = "<div class='co-actions'><button class='btn primary' onclick=\"if(COS.equipped()['" + res.item.slot + "']!=='" + res.item.id + "')COS.equip('" + res.item.slot + "','" + res.item.id + "');PF.render();this.textContent='Wearing it ✓'\">" + (on ? "Wearing it ✓" : "Wear it") + "</button></div>";
    }
  }
  rev.innerHTML =
    "<div class='co-prize' style='--rc:" + RARITY_HEX[v.rarity] + "'" + (v.thumb ? " data-thumb='" + v.thumb + "'" : "") + ">" + (v.thumb ? "" : v.icon) + "</div>" +
    "<div class='co-rar' style='--rc:" + RARITY_HEX[v.rarity] + "'>" + v.rarity + "</div>" +
    "<div class='co-title'>" + v.name + "</div>" +
    "<div class='co-sub'>" + (res.dup ? "Duplicate → +" + res.coins + " coins 🪙" : (res.item.desc || COS.CASES[res.kind].desc)) + "</div>" +
    equipRow +
    "<div class='co-actions'>" +
      (COS.state.cases[res.kind] > 0 ? "<button class='btn' onclick=\"PF.openCase('" + res.kind + "')\">Open another (" + COS.state.cases[res.kind] + ")</button>" : "") +
      "<button class='btn' onclick='PF.closeCase()'>Done</button></div>";
  rev.className = "co-reveal on";
  var pz = rev.querySelector("[data-thumb]");
  if (pz) PF.thumb(pz.getAttribute("data-thumb"), function(url) { pz.innerHTML = "<img alt='' src='" + url + "'>"; });
  AudioEngine.sfx("powerup");
  if (res.item.rarity === "legendary" || res.item.rarity === "epic") AudioEngine.stinger(res.item.rarity === "legendary" ? "ace" : "birdie");
};
PF.closeCase = function() { document.getElementById("case-open").style.display = "none"; PF.caseOpen = false; if (PF.open) PF.render(); };

// ══════════════════════════════════════════════════════════════════════════════
// ── REWARDS: winning a game earns a case ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
PF.rewardHtml = function(kind, why) {
  var C = COS.CASES[kind];
  return "<div class='fc-reward'>🎁 " + why + " — you earned a <b>" + C.icon + " " + C.name + "</b>!" +
    "<button class='btn primary' onclick=\"_fcHide&&_fcHide();openProfile('cases');PF.openCase('" + kind + "')\">Open it now</button></div>";
};
PF._awardedRound = -1;
// Single player: a round finished at or under par is a win
PF.roundEnd = function(vsPar) {
  if (typeof PROG !== "undefined" && PROG._match !== matchSeed) { PROG._match = matchSeed; PROG.matchDone(vsPar <= 0); LOG.ev("match_end", { sec: Math.round((Date.now() - (window._matchT0 || Date.now())) / 1000), mp: false, vsPar: vsPar }); }
  if (PF._awardedRound === matchSeed || vsPar > 0) return "";
  PF._awardedRound = matchSeed;
  return PF.rewardHtml(COS.awardCase(), vsPar < 0 ? "Under par" : "Level par");
};
// Multiplayer: lowest total (ties count) wins
PF.matchEnd = function(totals) {
  if (typeof PROG !== "undefined" && PROG._match !== matchSeed && totals) {
    PROG._match = matchSeed;
    var _b = Infinity; for (var _i = 0; _i < playerCount; _i++) if (typeof totals[_i] === "number") _b = Math.min(_b, totals[_i]);
    PROG.matchDone(totals[myIdx] <= _b);
    LOG.ev("match_end", { sec: Math.round((Date.now() - (window._matchT0 || Date.now())) / 1000), mp: true, players: playerCount });
  }
  if (PF._awardedRound === matchSeed || !totals) return false;
  PF._awardedRound = matchSeed;
  var mine = totals[myIdx], best = Infinity;
  var left = window._leftPlayers || {};
  for (var i = 0; i < playerCount; i++) if (typeof totals[i] === "number" && !left[i]) best = Math.min(best, totals[i]);
  if (typeof mine !== "number" || mine > best) return false;
  var kind = COS.awardCase();
  PF.toast("🏆 You won the match! +1 " + COS.CASES[kind].icon + " " + COS.CASES[kind].name);
  return true;
};
PF.toast = function(txt) {
  var el = document.createElement("div");
  el.className = "fc-reward";
  el.style.cssText = "position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:300;box-shadow:0 18px 40px rgba(0,30,60,.3);background:linear-gradient(90deg,#fff6d0,#ffe0f0);";
  el.innerHTML = txt + " <button class='btn primary' onclick=\"this.parentNode.remove();openProfile('cases')\">Open</button>";
  document.body.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.remove(); }, 9000);
};

document.addEventListener("DOMContentLoaded", PF.init);
if (document.readyState !== "loading") PF.init();
