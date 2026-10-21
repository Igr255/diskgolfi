"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── PROFILE · LOCKER · CASES ─────────────────────────────────────────────────
// One place for everything about you: name, stats, character + cosmetics, a
// skin per disc type, and your cases (with a spinning reel to open them).
// ══════════════════════════════════════════════════════════════════════════════
var PF = { tab: "character", disc: "midrange", open: false };
var RARITY_HEX = { common: "#9aa8b4", rare: "#3a9aff", epic: "#b45aff", legendary: "#ffb020" };

// ── Styles ───────────────────────────────────────────────────────────────────
(function() {
  var css = `
#profile .sheet{max-width:860px;padding:20px 22px 22px;}
.pf-top{display:grid;grid-template-columns:260px 1fr;gap:18px;align-items:stretch;margin-bottom:14px;}
.pf-stage{position:relative;border-radius:22px;overflow:hidden;min-height:300px;
  background:radial-gradient(120% 90% at 50% 15%,#ffffff 0%,#dff3fd 45%,#b8e2f6 100%);box-shadow:inset 0 0 0 1px rgba(18,70,104,.08);}
#pf-canvas{position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:none;}
.pf-stage-tag{position:absolute;left:12px;bottom:10px;font-weight:800;font-size:13px;color:#15476a;background:rgba(255,255,255,.75);padding:4px 10px;border-radius:999px;}
.pf-side{display:flex;flex-direction:column;gap:10px;min-width:0;}
.pf-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}
.pf-stat{background:rgba(255,255,255,.7);border:1px solid rgba(18,70,104,.08);border-radius:14px;padding:8px 6px;text-align:center;}
.pf-stat b{display:block;font-size:20px;font-weight:900;color:#15476a;line-height:1.1;}
.pf-stat span{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#5a7a92;}
.pf-wallet{display:flex;gap:8px;flex-wrap:wrap;}
.pf-wallet .chip{font-weight:800;}
.pf-equip-line{font-size:12px;color:#4a6a82;font-weight:700;line-height:1.5;}
.pf-tabs{display:flex;gap:6px;margin:4px 0 12px;}
.pf-tabs .chip{position:relative;}
.pf-badge{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;margin-left:6px;border-radius:999px;background:#ff5a7a;color:#fff;font-size:11px;font-weight:900;}
.pf-sec{font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#4a6a82;margin:12px 2px 6px;}
.pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;}
.pf-card{position:relative;border-radius:16px;background:rgba(255,255,255,.75);border:1px solid rgba(18,70,104,.1);padding:8px 6px 8px;text-align:center;cursor:pointer;
  transition:transform .15s,box-shadow .15s;overflow:hidden;}
.pf-card:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(10,50,80,.14);}
.pf-card.on{box-shadow:0 0 0 2.5px #33c3ef,0 8px 18px rgba(10,50,80,.14);}
.pf-card.locked{cursor:default;}
.pf-card.locked .pf-thumb{filter:grayscale(1) brightness(.75) opacity(.55);}
.pf-card::after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--rc,#9aa8b4);}
.pf-thumb{width:76px;height:76px;margin:0 auto;display:grid;place-items:center;font-size:42px;}
.pf-thumb img{width:76px;height:76px;object-fit:contain;}
.pf-name{font-size:12px;font-weight:800;color:#15476a;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pf-meta{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--rc,#9aa8b4);}
.pf-lock{position:absolute;top:6px;right:7px;font-size:12px;opacity:.75;}
.pf-scroll{max-height:min(46vh,420px);overflow-y:auto;padding:2px 2px 6px;}
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
  background:radial-gradient(80% 70% at 50% 40%,rgba(30,70,110,.82),rgba(6,16,30,.94));-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#fff;padding:20px;}
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
  .pf-top{grid-template-columns:1fr;}
  .pf-stage{min-height:230px;}
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
      "<div class='pf-top'>" +
        "<div class='pf-stage'><canvas id='pf-canvas'></canvas><div class='pf-stage-tag' id='pf-stage-tag'></div></div>" +
        "<div class='pf-side'>" +
          "<label class='field'><span class='k'>Name</span><input id='pf-name' class='input' maxlength='16' autocomplete='off'></label>" +
          "<div class='pf-stats' id='pf-stats'></div>" +
          "<div class='pf-wallet' id='pf-wallet'></div>" +
          "<div class='pf-equip-line' id='pf-equip-line'></div>" +
        "</div>" +
      "</div>" +
      "<div class='pf-tabs' id='pf-tabs'></div>" +
      "<div id='pf-body' class='pf-scroll'></div>" +
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
PF.render = function() {
  var st = (typeof dgStats !== "undefined") ? dgStats : { holes: 0, aces: 0, birdies: 0, longest: 0 };
  document.getElementById("pf-stats").innerHTML = [["Wins", COS.state.wins], ["Holes", st.holes], ["Aces", st.aces], ["Birdies", st.birdies], ["Longest", (st.longest || 0) + "m"]]
    .map(function(s) { return "<div class='pf-stat'><b>" + s[1] + "</b><span>" + s[0] + "</span></div>"; }).join("");
  document.getElementById("pf-wallet").innerHTML = "<span class='chip'>🪙 " + COS.state.coins + " coins</span><span class='chip'>📦 " + COS.casesTotal() + " case" + (COS.casesTotal() === 1 ? "" : "s") + "</span><span class='chip'>🎉 " + COS.state.opened + " opened</span>";
  var eq = COS.equipped(), names = ["hat", "aura", "finish"].map(function(k) { var s = COS.style(eq[k]); return s ? s.icon + " " + s.name : null; }).filter(Boolean);
  document.getElementById("pf-equip-line").innerHTML = "Wearing: " + (names.length ? names.join(" · ") : "no cosmetics yet — open a Style Case!") +
    "<br>" + DISCS[PF.disc].label + " skin: <b>" + ((COS.discSkin((equippedSkins || {})[PF.disc] || "classic") || {}).name || "Classic") + "</b>";
  var tabs = [["character", "Character"], ["discs", "Discs"], ["cases", "Cases"]];
  document.getElementById("pf-tabs").innerHTML = tabs.map(function(t) {
    return "<button class='chip" + (PF.tab === t[0] ? " on" : "") + "' onclick=\"PF.tab='" + t[0] + "';PF.render()\">" + t[1] +
      (t[0] === "cases" && COS.casesTotal() ? "<span class='pf-badge'>" + COS.casesTotal() + "</span>" : "") + "</button>";
  }).join("");
  var body = document.getElementById("pf-body");
  if (PF.tab === "character") body.innerHTML = PF.characterTab();
  else if (PF.tab === "discs") body.innerHTML = PF.discTab();
  else body.innerHTML = PF.casesTab();
  PF.fillThumbs(body);
  PF.refreshBadges();
};
function _pfCard(o) {
  // o: {id, name, rarity, icon|thumb, on, locked, meta, onclick}
  return "<div class='pf-card" + (o.on ? " on" : "") + (o.locked ? " locked" : "") + "' style='--rc:" + (RARITY_HEX[o.rarity] || "#9aa8b4") + "'" +
    (o.locked ? " title='" + (o.lockText || "Locked") + "'" : " onclick=\"" + o.onclick + "\"") + ">" +
    (o.locked ? "<span class='pf-lock'>🔒</span>" : "") +
    "<div class='pf-thumb'" + (o.thumb ? " data-thumb='" + o.thumb + "'" : "") + ">" + (o.thumb ? "" : (o.icon || "")) + "</div>" +
    "<div class='pf-name'>" + o.name + "</div><div class='pf-meta'>" + (o.meta || o.rarity || "") + "</div></div>";
}
PF.characterTab = function() {
  var eq = COS.equipped(), h = "<div class='pf-sec'>Character</div><div class='pf-grid'>";
  PLAYER_SKINS.forEach(function(s) {
    h += _pfCard({ id: s.id, name: s.name, rarity: "common", icon: s.icon, on: equippedPlayerSkin === s.id, meta: s.blurb || "", onclick: "PF.setChar('" + s.id + "')" });
  });
  h += "</div>";
  [["hat", "Hats"], ["aura", "Auras — trail from your feet"], ["finish", "Finishes"]].forEach(function(sec) {
    h += "<div class='pf-sec'>" + sec[1] + "</div><div class='pf-grid'>";
    COS.STYLE.filter(function(s) { return s.slot === sec[0]; }).forEach(function(s) {
      var own = COS.ownsStyle(s.id);
      h += _pfCard({ id: s.id, name: s.name, rarity: s.rarity, icon: s.icon, thumb: sec[0] === "hat" ? "hat:" + s.id : null, on: eq[sec[0]] === s.id, locked: !own,
        lockText: "Win it from a Style Case", meta: own ? s.rarity : "Style Case", onclick: "COS.equip('" + sec[0] + "','" + s.id + "');PF.render();PF.stageRebuild()" });
    });
    h += "</div>";
  });
  return h;
};
PF.discTab = function() {
  var h = "<div class='pf-sec'>Pick a disc, then its skin</div><div class='tabs'>";
  Object.keys(DISCS).forEach(function(k) {
    h += "<button class='chip" + (PF.disc === k ? " on" : "") + "' onclick=\"PF.disc='" + k + "';PF.render();PF.stageRebuild()\"><span class='dot' style='background:" + (typeof _discCss === "function" ? _discCss(k) : "#ccc") + "'></span>" + DISCS[k].label + "</button>";
  });
  h += "</div><div class='pf-grid'>";
  var eqId = (equippedSkins && equippedSkins[PF.disc]) || "classic";
  var skins = DISC_SKINS._global.concat(PF.disc === "vilov" ? (DISC_SKINS.vilov || []) : []);
  var order = { legendary: 0, epic: 1, rare: 2, common: 3 };
  skins.slice().sort(function(a, b) { var oa = COS.ownsDisc(a.id) ? 0 : 1, ob = COS.ownsDisc(b.id) ? 0 : 1; return oa - ob || order[a.rarity] - order[b.rarity]; }).forEach(function(s) {
    var own = COS.ownsDisc(s.id);
    h += _pfCard({ id: s.id, name: s.name, rarity: s.rarity, thumb: "disc:" + PF.disc + ":" + s.id, on: eqId === s.id, locked: !own,
      lockText: s.desc + " — win it from a Disc Case" + (s.unlock && s.unlock !== "Always unlocked." ? " (or: " + s.unlock + ")" : ""),
      meta: own ? s.rarity : "Disc Case", onclick: "PF.setDiscSkin('" + PF.disc + "','" + s.id + "')" });
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
  h += "<div class='pf-how'>🏆 <b>Win a game to earn a case:</b> finish a single-player round at or under par, or win a multiplayer match.<br>Already own what you pull? You get coins instead — 100 coins buys a case.</div>";
  return h;
};

PF.setChar = function(id) {
  equippedPlayerSkin = id; if (typeof savePlayerSkin === "function") savePlayerSkin();
  if (typeof scene !== "undefined" && typeof localAvatarMesh !== "undefined" && localAvatarMesh && phase !== "MENU") {
    scene.remove(localAvatarMesh);
    localAvatarMesh = buildPlayerAvatar(myIdx, PLAYER_COLORS[myIdx % PLAYER_COLORS.length]);
    localAvatarMesh.visible = cameraMode === "tp"; scene.add(localAvatarMesh);
  }
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
  PF.render(); PF.stageRebuild();
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

// Preview stage: your character holding the selected disc, turntable + drag to spin
PF.stage = null;
PF.stageStart = function() {
  var cv = document.getElementById("pf-canvas"); if (!cv) return;
  if (!PF.stage) {
    var r = PF._mkRenderer(cv);
    var sc = new THREE.Scene(); sc.environment = PF._envFor(r); PF._lights(sc);
    var cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    var floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 40), new THREE.MeshBasicMaterial({ color: 0x0a3a5a, transparent: true, opacity: 0.12 }));
    floor.rotation.x = -Math.PI / 2; sc.add(floor);
    PF.stage = { r: r, sc: sc, cam: cam, turn: 0.5, root: new THREE.Group() };
    sc.add(PF.stage.root);
  }
  PF.stageRebuild();
  var loop = function() {
    if (!PF.open) return;
    requestAnimationFrame(loop);
    var S = PF.stage, w = cv.clientWidth, h = cv.clientHeight;
    if (w && h && (cv.width !== Math.round(w * S.r.getPixelRatio()) || cv.height !== Math.round(h * S.r.getPixelRatio()))) { S.r.setSize(w, h, false); S.cam.aspect = w / h; S.cam.updateProjectionMatrix(); }
    if (!PF._drag) S.turn += 0.006;
    S.root.rotation.y = S.turn;
    if (S.disc) { S.disc.userData.spinner.rotation.y += 0.05; S.disc.position.y = 1.0 + Math.sin(performance.now() * 0.002) * 0.04; }
    var t = performance.now() / 1000;
    S.cam.position.set(0.25, 1.35, 4.9); S.cam.lookAt(0.25, 0.9, 0);
    S.r.render(S.sc, S.cam);
  };
  loop();
};
PF.stageRebuild = function() {
  var S = PF.stage; if (!S) return;
  while (S.root.children.length) S.root.remove(S.root.children[0]);
  var av = buildPlayerAvatar(typeof myIdx !== "undefined" ? myIdx : 0, PLAYER_COLORS[0]);
  S.root.add(av); S.avatar = av;
  if (S.disc && S.disc.parent) S.disc.parent.remove(S.disc);
  var disc = buildDisc(PF.disc);
  disc.scale.setScalar(0.62); disc.position.set(0.95, 1.0, 0.9); disc.rotation.x = 0.55; disc.rotation.z = -0.2;   // floats in front, always in view
  S.sc.add(disc); S.disc = disc;
  var skin = COS.discSkin((equippedSkins || {})[PF.disc] || "classic");
  var ch = PLAYER_SKINS.find(function(p) { return p.id === equippedPlayerSkin; });
  document.getElementById("pf-stage-tag").textContent = (ch ? ch.name : "Player") + " · " + DISCS[PF.disc].label + ": " + (skin ? skin.name : "Classic");
};
PF.dragInit = function() {
  var cv = document.getElementById("pf-canvas"), lx = 0;
  cv.addEventListener("pointerdown", function(e) { PF._drag = true; lx = e.clientX; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", function(e) { if (!PF._drag || !PF.stage) return; PF.stage.turn += (e.clientX - lx) * 0.012; lx = e.clientX; });
  cv.addEventListener("pointerup", function() { PF._drag = false; });
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
    obj = COS.buildHat(parts[1]);
    var bb = new THREE.Box3().setFromObject(obj), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()).length();
    obj.position.sub(c); obj.rotation.y = -0.5;
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
  return { thumb: item.slot === "hat" ? "hat:" + item.id : null, icon: item.icon, name: item.name, rarity: item.rarity };
};
PF.openCase = function(kind) {
  var res = COS.openCase(kind); if (!res) return;
  PF.render();
  var co = document.getElementById("case-open"), strip = document.getElementById("co-strip"), rev = document.getElementById("co-reveal");
  document.getElementById("co-title").textContent = "Opening " + COS.CASES[kind].name + "…";
  rev.className = "co-reveal"; rev.innerHTML = "";
  document.getElementById("co-window").style.display = "";
  co.style.display = "flex";
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
      equipRow = "<div class='co-actions'><button class='btn primary' onclick=\"if(COS.equipped()['" + res.item.slot + "']!=='" + res.item.id + "')COS.equip('" + res.item.slot + "','" + res.item.id + "');PF.render();PF.stageRebuild();this.textContent='Wearing it ✓'\">" + (on ? "Wearing it ✓" : "Wear it") + "</button></div>";
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
PF.closeCase = function() { document.getElementById("case-open").style.display = "none"; if (PF.open) PF.render(); };

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
  if (PF._awardedRound === matchSeed || vsPar > 0) return "";
  PF._awardedRound = matchSeed;
  return PF.rewardHtml(COS.awardCase(), vsPar < 0 ? "Under par" : "Level par");
};
// Multiplayer: lowest total (ties count) wins
PF.matchEnd = function(totals) {
  if (PF._awardedRound === matchSeed || !totals) return false;
  PF._awardedRound = matchSeed;
  var mine = totals[myIdx], best = Infinity;
  for (var i = 0; i < playerCount; i++) if (typeof totals[i] === "number") best = Math.min(best, totals[i]);
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
