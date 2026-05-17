"use strict";

// ═══════════════════════════════════════════════════════════════════════
// ── ISLAND WORLD SYSTEM ──────────────────────────────────────────────
// The gameplay takes place on intentional floating islands.
// Terrain is used only as decorative boundary scenery.
//
// Three-layer philosophy:
//  Layer 1 — PLAYABLE PATH: themed island chains the player navigates
//  Layer 2 — HAZARDS: water/void/lava between islands is the danger
//  Layer 3 — SCENERY SHELL: distant cliffs/mountains as backdrop
// ═══════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
// ── SIMPLEX NOISE (for scenery terrain only) ──────────────
// ══════════════════════════════════════════════════════════
var Simplex = (function () {
  var perm = new Uint8Array(512);
  var F2 = 0.5*(Math.sqrt(3)-1), G2 = (3-Math.sqrt(3))/6;
  var grad2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  function seed(s) {
    var p=new Uint8Array(256); for(var i=0;i<256;i++) p[i]=i;
    var r=s>>>0;
    for(var i=255;i>0;i--){r=(Math.imul(r^(r>>>16),0x45d9f3b)+0x6d2b79f5)>>>0;var j=(r>>>0)%(i+1);var t=p[i];p[i]=p[j];p[j]=t;}
    for(var i=0;i<512;i++) perm[i]=p[i&255];
  }
  function noise(xin,yin){
    var s=(xin+yin)*F2,i=Math.floor(xin+s),j=Math.floor(yin+s),t=(i+j)*G2,X0=i-t,Y0=j-t;
    var x0=xin-X0,y0=yin-Y0,i1,j1;
    if(x0>y0){i1=1;j1=0;}else{i1=0;j1=1;}
    var x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2;
    var ii=i&255,jj=j&255;
    var gi0=perm[ii+perm[jj]]%8,gi1=perm[ii+i1+perm[jj+j1]]%8,gi2=perm[ii+1+perm[jj+1]]%8;
    var t0=0.5-x0*x0-y0*y0,n0=t0<0?0:(t0*t0)*(t0*t0)*(grad2[gi0][0]*x0+grad2[gi0][1]*y0);
    var t1=0.5-x1*x1-y1*y1,n1=t1<0?0:(t1*t1)*(t1*t1)*(grad2[gi1][0]*x1+grad2[gi1][1]*y1);
    var t2=0.5-x2*x2-y2*y2,n2=t2<0?0:(t2*t2)*(t2*t2)*(grad2[gi2][0]*x2+grad2[gi2][1]*y2);
    return 70*(n0+n1+n2);
  }
  function fbm(x,y,oct,r){
    var v=0,a=1,f=1,m=0; oct=oct||4; r=r||0.5;
    for(var o=0;o<oct;o++){v+=noise(x*f,y*f)*a;m+=a;a*=r;f*=2;}
    return v/m;
  }
  return {seed,noise,fbm};
})();

// ══════════════════════════════════════════════════════════
// ── THEME COLORS ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════
var themeColors = {
  eerie:             {fog:0x1a053a,sky1:0x1a053a,sky2:0x000000,hemi:0xff00ff,amb:0x444444,water:0x110033,island:0x334422,rim:0x00ff88},
  funny:             {fog:0x87ceeb,sky1:0x87ceeb,sky2:0xffffff,hemi:0xffffff,amb:0x888888,water:0x55aaee,island:0x88cc44,rim:0xffdd00},
  neon:              {fog:0x000000,sky1:0x000000,sky2:0x000011,hemi:0x00ffff,amb:0x111111,water:0x000000,island:0x001122,rim:0xff00ff},
  terrifying:        {fog:0x440000,sky1:0x440000,sky2:0x000000,hemi:0xff0000,amb:0x110000,water:0x880000,island:0x220000,rim:0xff4400},
  feet_bunnies:      {fog:0xffb6c1,sky1:0xffb6c1,sky2:0xffffff,hemi:0xffffff,amb:0xaaaaaa,water:0xaaddff,island:0xffe4e1,rim:0xff88aa},
  city:              {fog:0x222233,sky1:0x334455,sky2:0x111122,hemi:0xffaa55,amb:0x444455,water:0x002244,island:0x444455,rim:0xffaa44},
  socks_basket:      {fog:0xffd6e0,sky1:0xffb3c6,sky2:0xffe8ee,hemi:0xffffff,amb:0xddaaaa,water:0xffaabb,island:0xffc0d0,rim:0xff6688},
  backrooms:         {fog:0xc8b850,sky1:0x8a7820,sky2:0x5a5010,hemi:0xffeeaa,amb:0xbbaa44,water:0x665500,island:0xb8a010,rim:0xffdd44},
  public_poo:        {fog:0x1a0900,sky1:0x0d0400,sky2:0x030100,hemi:0x995500,amb:0x331500,water:0x3d1f00,island:0x5a2d00,rim:0xaa6600},
  screaming_mamamia: {fog:0x660000,sky1:0xff1100,sky2:0x220000,hemi:0xff5500,amb:0x770000,water:0xff0000,island:0x550000,rim:0xff8800},
  disco:             {fog:0x110022,sky1:0x220033,sky2:0x000011,hemi:0xff00ff,amb:0x330033,water:0x001133,island:0x1a0033,rim:0xff00ff},
  mountains:         {fog:0x8ab4cc,sky1:0x5599cc,sky2:0x88ccff,hemi:0xffffff,amb:0x8899aa,water:0x2266aa,island:0x8a8a8a,rim:0xeeeeff},
  geometry_dash:     {fog:0x000000,sky1:0x000000,sky2:0x000022,hemi:0x00ffff,amb:0x002244,water:0x000033,island:0x001133,rim:0x00ff44},
  emote:             {fog:0xffe8c0,sky1:0xffd080,sky2:0xffaa40,hemi:0xffffff,amb:0xddbb66,water:0xffcc44,island:0xffee88,rim:0xff8800},
  sixtyseven:        {fog:0x004400,sky1:0x002200,sky2:0x001100,hemi:0x00ff44,amb:0x003300,water:0x001100,island:0x003300,rim:0x00ff66},
  winter:            {fog:0xc8e0f0,sky1:0x99ccee,sky2:0xeef6ff,hemi:0xffffff,amb:0xaabbcc,water:0x6699cc,island:0xddeeff,rim:0xaaccff},
  moon:              {fog:0x050510,sky1:0x000008,sky2:0x000002,hemi:0x4444ff,amb:0x222244,water:0x000000,island:0x888888,rim:0x999999},
  office:            {fog:0x556677,sky1:0x334466,sky2:0x223355,hemi:0xaabbcc,amb:0x667788,water:0x001122,island:0xaabbcc,rim:0x99aacc},
  cabbage:           {fog:0x224422,sky1:0x335533,sky2:0x112211,hemi:0xaaffaa,amb:0x558855,water:0x224422,island:0x448844,rim:0x88ff44},
  minion:            {fog:0xeebb00,sky1:0xddaa00,sky2:0xffcc22,hemi:0xffffff,amb:0xddbb44,water:0x0044cc,island:0xffdd00,rim:0x4488ff},
  map67:             {fog:0x002200,sky1:0x001100,sky2:0x000800,hemi:0x00ff88,amb:0x003300,water:0x001100,island:0x002200,rim:0x00ff66},
  grandcanyon:       {fog:0xcc6633,sky1:0xdd8855,sky2:0xee9944,hemi:0xffcc88,amb:0xcc7744,water:0x4466bb,island:0xcc6633,rim:0xeeaa44},
  tornado:           {fog:0x334444,sky1:0x223333,sky2:0x111111,hemi:0x88aaaa,amb:0x445555,water:0x001122,island:0x334433,rim:0x88ddcc},
  waterfall:         {fog:0x99ccdd,sky1:0x88bbcc,sky2:0xaaddee,hemi:0xffffff,amb:0xaaccdd,water:0x2288bb,island:0x338855,rim:0x88ddcc},
  // ── NEW THEMES ──
  poolrooms:  {fog:0xc8f0f0,sky1:0xd0ffff,sky2:0xa8eeff,hemi:0xffffff,amb:0xaadddd,water:0x88dddd,island:0xd4c99a,rim:0xffff88},
  hogwarts:   {fog:0x1a1230,sky1:0x0a0818,sky2:0x1a1030,hemi:0xaa88ff,amb:0x443366,water:0x110022,island:0x443322,rim:0xffdd44},
  village:    {fog:0x88cc88,sky1:0x6699cc,sky2:0xaaddff,hemi:0xffffff,amb:0x889944,water:0x2266aa,island:0x886633,rim:0xffcc44},
  minecraft:  {fog:0x88ddff,sky1:0x66bbff,sky2:0xaaeeff,hemi:0xffffff,amb:0x88aa66,water:0x3366cc,island:0x559933,rim:0xaacc44},
  skyblock:   {fog:0x55aaff,sky1:0x2266cc,sky2:0x88ccff,hemi:0xffffff,amb:0x6699cc,water:0x000000,island:0x338844,rim:0xffcc00},
  vetschool:  {fog:0x99ddbb,sky1:0x77ccaa,sky2:0xaaeedd,hemi:0xffffff,amb:0x88bbaa,water:0x3399aa,island:0x55aa77,rim:0xffffff},
};

function _estimateIslandTopRadiusRatio(root) {
  if (!root) return 1.0;
  root.updateMatrixWorld(true);
  var maxY = -Infinity;
  var maxR = 0;
  var v = new THREE.Vector3();
  root.traverse(function(node) {
    if (!node.isMesh || !node.geometry || !node.geometry.attributes || !node.geometry.attributes.position) return;
    var pos = node.geometry.attributes.position;
    for (var i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld);
      if (v.y > maxY) maxY = v.y;
      var r = Math.hypot(v.x, v.z);
      if (r > maxR) maxR = r;
    }
  });
  if (!(maxY > -Infinity) || maxR < 0.001) return 1.0;
  var band = Math.max(0.02, maxY * 0.08);
  var topR = 0;
  root.traverse(function(node) {
    if (!node.isMesh || !node.geometry || !node.geometry.attributes || !node.geometry.attributes.position) return;
    var pos = node.geometry.attributes.position;
    for (var i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld);
      if (v.y >= maxY - band) {
        var r = Math.hypot(v.x, v.z);
        if (r > topR) topR = r;
      }
    }
  });
  if (topR < 0.001) return 1.0;
  return Math.max(0.35, Math.min(1.2, topR / maxR));
}

function applyThemeVisuals(thName) {
  var t=themeColors[thName]||themeColors.eerie;
  if(scene&&scene.fog) scene.fog.color.setHex(t.fog);
  if(typeof skyMat!=="undefined"&&skyMat&&skyMat.uniforms){skyMat.uniforms.c1.value.setHex(t.sky1);skyMat.uniforms.c2.value.setHex(t.sky2);}
  if(typeof hemiLight!=="undefined"&&hemiLight) hemiLight.color.setHex(t.hemi);
  if(typeof ambLight!=="undefined"&&ambLight) ambLight.color.setHex(t.amb);
}

// ══════════════════════════════════════════════════════════
// ── THEME SELECTOR ───────────────────────────────────────
// ══════════════════════════════════════════════════════════
// ACTIVE_THEMES: null = all themes, or array of theme strings from map pool selector
var ACTIVE_THEMES = null;

function themeForHole(holeIdx, seed) {
  if (typeof _SP_FORCED_THEME !== "undefined" && _SP_FORCED_THEME) return _SP_FORCED_THEME;
  var pool = (ACTIVE_THEMES && ACTIVE_THEMES.length > 0) ? ACTIVE_THEMES : THEMES;
  var n = pool.length;
  function makeRng(s){var r=(s^0xdeadbeef)>>>0;return function(){r=(Math.imul(r^(r>>>16),0x45d9f3b)+0x6d2b79f5)>>>0;return r/4294967296;};}
  function shuffle(rng){var d=pool.slice();for(var i=n-1;i>0;i--){var j=Math.floor(rng()*(i+1));var t=d[i];d[i]=d[j];d[j]=t;}return d;}
  var deckNum=Math.floor(holeIdx/n),posInDeck=holeIdx%n;
  var deck=shuffle(makeRng(seed+deckNum*0x9e3779b9));
  if(deckNum>0){var prev=shuffle(makeRng(seed+(deckNum-1)*0x9e3779b9));if(deck[0]===prev[n-1]){var t2=deck[0];deck[0]=deck[1];deck[1]=t2;}}
  return deck[posInDeck];
}

// ══════════════════════════════════════════════════════════
// ── ISLAND TEMPLATES (COURSE LAYOUTS) ────────────────────
// Each template creates a designed chain of islands.
// Islands have: x, z, r (radius), elev (height), type
// ══════════════════════════════════════════════════════════
var ISLAND_TEMPLATES = {
  straight:  {label:"Straight Lane",   par:3},
  dogleg:    {label:"Dogleg",           par:3},
  scurve:    {label:"S-Curve",          par:4},
  uphill:    {label:"Staircase Climb",  par:4},
  downhill:  {label:"Downhill Run",     par:3},
  scattered: {label:"Archipelago",      par:4},
  bridge:    {label:"Long Carry",       par:4},
  spiral:    {label:"Spiral Route",     par:5},
  shortcut:  {label:"Risk & Reward",    par:3},
  precision: {label:"Precision Shot",   par:4},
};

function pickTemplate(idx) {
  if (idx===0) return "straight";
  if (idx===1) return "dogleg";
  if (idx===2) return "scurve";
  var d = Math.min(1.0, idx*0.07);
  var pools = [
    ["straight","dogleg","scurve","downhill"],
    ["dogleg","scurve","uphill","scattered","bridge"],
    ["spiral","bridge","shortcut","precision","scurve","uphill"],
  ];
  var pool = d<0.3?pools[0]:d<0.6?pools[1]:pools[2];
  return pool[Math.floor(srng()*pool.length)];
}

// ── CORE: Build island chain for a hole ─────────────────
function buildIslandChain(tpl, idx) {
  // Apply difficulty island radius scaling
  var _diffR = 1.0;
  if (typeof DIFFICULTY !== "undefined" && typeof DIFFICULTY_PRESETS !== "undefined") {
    _diffR = (DIFFICULTY_PRESETS[DIFFICULTY]||{islandRadiusMult:1.0}).islandRadiusMult;
  }
  var chain = [];  // array of {x,z,r,elev,type}
  var segLen = 25 + Math.min(idx*1.5, 20);
  var numSeg = Math.min(2 + Math.floor(idx*0.35), 7);

  // Tee island — always large and safe
  chain.push({x:0, z:0, r:Math.max(5, 8*_diffR), elev:0, type:"tee"});

  var cx=0, cz=0;

  switch(tpl) {
    case "straight":
      for(var i=0;i<numSeg;i++){
        cz -= segLen*(0.9+srng()*0.2);
        cx += (srng()-0.5)*segLen*0.25;
        chain.push({x:cx,z:cz,r:6+srng()*3,elev:0});
      }
      break;

    case "dogleg": {
      var turnAt = Math.floor(numSeg/2);
      var turnDir = srng()>0.5?1:-1;
      for(var i=0;i<numSeg;i++){
        if(i<turnAt){ cz-=segLen*0.9; cx+=(srng()-0.5)*6; }
        else { cx+=turnDir*segLen*0.7; cz-=segLen*0.6; }
        chain.push({x:cx,z:cz,r:6+srng()*3,elev:0});
      }
      break;
    }

    case "scurve":
      for(var i=0;i<numSeg;i++){
        var side=(Math.floor(i/2)%2===0)?1:-1;
        cx+=side*segLen*0.5; cz-=segLen*0.85;
        chain.push({x:cx,z:cz,r:6+srng()*2,elev:0});
      }
      break;

    case "uphill":
      for(var i=0;i<numSeg;i++){
        cz-=segLen*0.85; cx+=(srng()-0.5)*8;
        var elev=(i+1)*(2.5+idx*0.2);
        chain.push({x:cx,z:cz,r:6+srng()*2,elev:elev,type:"raised"});
      }
      break;

    case "downhill": {
      var topElev=12+idx*0.5;
      // First island high
      cz-=segLen; chain.push({x:cx,z:cz,r:8,elev:topElev,type:"raised"});
      for(var i=1;i<numSeg;i++){
        cz-=segLen*0.9; cx+=(srng()-0.5)*8;
        var e=topElev*(1-(i/numSeg));
        chain.push({x:cx,z:cz,r:6+srng()*3,elev:e});
      }
      break;
    }

    case "scattered":
      for(var i=0;i<numSeg+1;i++){
        var angle=((i/(numSeg+1))-0.5)*1.2;
        var dist2=segLen*(0.8+srng()*0.4)*(i+1);
        cx=Math.sin(angle)*dist2*0.4;
        cz=-Math.cos(angle)*dist2;
        chain.push({x:cx,z:cz,r:5+srng()*3,elev:srng()*4});
      }
      break;

    case "bridge": {
      // One far island requires a big throw
      cz-=segLen*0.8; cx+=(srng()-0.5)*10;
      chain.push({x:cx,z:cz,r:7,elev:0});
      // Gap — no island here (long carry)
      var gapDist=Math.min(30+idx*2, 45);
      cz-=gapDist;
      chain.push({x:cx,z:cz,r:6,elev:0,type:"landing"});
      for(var i=0;i<numSeg-1;i++){
        cz-=segLen*0.85; cx+=(srng()-0.5)*8;
        chain.push({x:cx,z:cz,r:6+srng()*2,elev:0});
      }
      break;
    }

    case "spiral": {
      var R=segLen*0.6;
      for(var i=0;i<numSeg;i++){
        var a=(i/numSeg)*Math.PI*1.5;
        cx=Math.sin(a)*R*(i*0.3+1);
        cz=-Math.cos(a)*R*(i*0.3+1);
        chain.push({x:cx,z:cz,r:6+srng()*2,elev:i*1.5});
      }
      break;
    }

    case "shortcut": {
      // Main route
      for(var i=0;i<numSeg;i++){
        cz-=segLen*0.9; cx+=(i%2===0?1:-1)*segLen*0.3;
        chain.push({x:cx,z:cz,r:7+srng()*2,elev:0});
      }
      // Risky shortcut island — smaller, directly toward basket
      var scX=cx*0.3, scZ=cz*0.55;
      chain.push({x:scX,z:scZ,r:4,elev:0,type:"shortcut"});
      break;
    }

    case "precision":
      for(var i=0;i<numSeg;i++){
        cz-=segLen; cx+=(srng()-0.5)*segLen*0.15;
        chain.push({x:cx,z:cz,r:3.5+srng()*1.5,elev:0,type:"narrow"});
      }
      break;
  }

  // Basket island — always generous landing zone
  chain.push({x:cx,z:cz-segLen*(0.5+srng()*0.5),r:7,elev:0,type:"basket"});

  return chain;
}

// ══════════════════════════════════════════════════════════
// ── terrainY — height at any world point ─────────────────
// Islands: returns island surface height or water level.
// Scenery: returns cliff/mountain height in far-off areas.
// ══════════════════════════════════════════════════════════
function terrainY(x, z, hole, idx) {
  if (!hole) return 0;
  return terrainYIsland(x, z, hole, idx);
}

// ══════════════════════════════════════════════════════════════════
// ── ISLAND SURFACE HEIGHT ─────────────────────────────────────────
// Returns the Y position of the TOP of the island cylinder at (x,z).
//
// VISUAL GEOMETRY (must match exactly):
//   CylinderGeometry(r, r*0.88, 0.55, 16) placed at baseY + 0.275
//   where baseY = waterY + 1.2 + elev
//   TOP of cylinder = baseY + 0.275 + 0.55/2 = baseY + 0.55
//   = waterY + 1.75 + elev   ← this is what terrainY must return
//
// COLLISION ZONES:
//   d < r          → on island (full surface height)
//   r ≤ d < r+0.5  → edge (disc can roll off, slight dip)
//   d ≥ r+0.5      → open water hazard
// ══════════════════════════════════════════════════════════════════
function terrainYIsland(x, z, hole, idx) {
  var waterY = (hole.water !== undefined) ? hole.water : -1.5;
  // Island top surface = waterY + 2.2 (base above water) + 0.55 (cylinder half) + elev
  var BASE_SURF = waterY + 2.95;   // surface Y for elev=0 islands — matches visual top
  var best      = waterY - 2.0;    // default = well below water (hazard zone)

  // islContrib: returns surface height for a disc at distance d from island centre
  // r = island visual radius. NO extended zones — collision matches visual exactly.
  function islContrib(d, r, elev) {
    var surf = BASE_SURF + (elev || 0);
    if (d < r)          return surf;               // solidly on island
    if (d < r + 0.5)    return surf - (d - r) * 2.0; // edge taper
    return waterY - 2.0;  // open water — hazard
  }

  // Tee (always at origin, r=8)
  best = Math.max(best, islContrib(Math.hypot(x, z), hole.teeWalkR || 8, hole.teeElev || 0));

  // Basket (r=8)
  best = Math.max(best, islContrib(Math.hypot(x - hole.bx, z - hole.bz), hole.basketWalkR || 8, hole.basketElev || 0));

  // Waypoints
  for (var i = 0; i < hole.waypoints.length; i++) {
    var wp = hole.waypoints[i];
    best = Math.max(best, islContrib(Math.hypot(x - wp.x, z - wp.z), wp.walkR || wp.r || 7, wp.elev || 0));
  }

  // Moving islands
  if (hole.movingIslands) {
    for (var mi = 0; mi < hole.movingIslands.length; mi++) {
      var mv = hole.movingIslands[mi];
      var mvX = (mv.currentX !== undefined) ? mv.currentX : mv.baseX;
      var mvZ = (mv.currentZ !== undefined) ? mv.currentZ : mv.baseZ;
      var mvE = (mv.currentElev !== undefined) ? mv.currentElev : (mv.elev || 0);
      best = Math.max(best, islContrib(Math.hypot(x - mvX, z - mvZ), mv.walkR || mv.r || 6, mvE));
    }
  }

  return best;
}

// ══════════════════════════════════════════════════════════
// ── TERRAIN NORMAL ───────────────────────────────────────
// ══════════════════════════════════════════════════════════
function getTerrainNormal(x, z, hole, idx) {
  var eps=0.3, y=terrainY(x,z,hole,idx);
  var yx=terrainY(x+eps,z,hole,idx), yz=terrainY(x,z+eps,hole,idx);
  var vx=new THREE.Vector3(eps,yx-y,0), vz=new THREE.Vector3(0,yz-y,eps);
  return new THREE.Vector3().crossVectors(vz,vx).normalize();
}

// ══════════════════════════════════════════════════════════
// ── GENERATE HOLE ────────────────────────────────────────
// ══════════════════════════════════════════════════════════
function generateHole(level) {
  var idx   = level-1;
  var theme = themeForHole(idx, matchSeed);
  var _dp = (typeof DIFFICULTY_PRESETS !== "undefined" && typeof DIFFICULTY !== "undefined")
    ? (DIFFICULTY_PRESETS[DIFFICULTY]||DIFFICULTY_PRESETS.normal) : {windMagMax:8};
  var windMag = Math.min(_dp.windMagMax||8, 0.5+idx*0.55);
  var wind  = {x:(srng()-0.5)*windMag, z:(srng()-0.5)*windMag};

  Simplex.seed((matchSeed^(idx*0x9e3779b9))>>>0);

  var tpl       = pickTemplate(idx);
  var tmplData  = ISLAND_TEMPLATES[tpl] || ISLAND_TEMPLATES.straight;
  var chain     = buildIslandChain(tpl, idx);
  var basketPt  = chain[chain.length-1];

  // Extract waypoints (everything between tee and basket)
  var waypoints = chain.slice(1,-1).map(function(p){
    return {x:p.x, z:p.z, r:p.r||7, elev:p.elev||0, type:p.type||"normal"};
  });

  // Par scales with number of islands + difficulty
  var par = tmplData.par;
  if(waypoints.length > 4) par++;

  // ── Moving islands — added on levels 4+ ─────────────────────────────
  var movingIslands = [];
  if (idx >= 1 && waypoints.length > 1) {  // movers from level 2
    var numMovers = idx < 4 ? 1 : Math.min(Math.floor(idx * 0.18), 2);
    for (var mi = 0; mi < numMovers; mi++) {
      // Pick a random waypoint to make mobile
      var wpIdx = Math.floor(srng() * waypoints.length);
      var baseWP = waypoints[wpIdx];
      var motionType = idx < 6 ? "bob"
                     : idx < 10 ? (srng()>0.5 ? "linear" : "bob")
                     : ["linear","orbit","bob"][Math.floor(srng()*3)];
      baseWP.isMoving = true;  // tell buildTerrain to skip static render
      movingIslands.push({
        waypointIdx: wpIdx,
        baseX: baseWP.x,  baseZ: baseWP.z,
        currentX: baseWP.x, currentZ: baseWP.z,
        r: (baseWP.r || 7),
        elev: baseWP.elev || 0,
        type: motionType,
        amplitude: 6 + srng()*8,  // movement range
        speed: 0.4 + srng()*0.6,  // cycles per second
        phase: srng()*Math.PI*2,  // start offset
        axis: srng()>0.5 ? "x" : "z",
      });
    }
  }

  return {
    n:       idx+1,
    par:     par,
    bx:      basketPt.x,
    bz:      basketPt.z,
    waypoints,
    theme,
    wind,
    water:   -1.5,
    terrainMode: "island",
    teeElev:    0,
    basketElev: basketPt.elev || 0,
    templateType: tpl,
    templateLabel: tmplData.label,
    noiseOx: srng()*100,
    noiseOz: srng()*100,
    movingIslands,
  };
}

// ══════════════════════════════════════════════════════════
// ── TERRAIN MESH (island visual geometry) ────────────────
// ══════════════════════════════════════════════════════════
function buildTerrain(hole, idx) {
  var grp = new THREE.Group();
  var tc  = themeColors[hole.theme] || themeColors.eerie;
  var waterY = hole.water;
  function addGrassPatches(parent, centerX, centerY, centerZ, radius, useLocal) {
    if (typeof loadModel !== "function" || typeof MODEL_OVERRIDES === "undefined" || !MODEL_OVERRIDES["grass_patch"]) return;
    var patchCount = Math.max(6, Math.min(14, Math.floor(radius * 1.05)));
    for (var gi = 0; gi < patchCount; gi++) {
      var ga = srng() * Math.PI * 2;
      var gd = srng() * Math.max(0.6, radius * 0.55);
      var px = Math.cos(ga) * gd;
      var pz = Math.sin(ga) * gd;
      (function(_px, _pz) {
        loadModel("grass_patch", function(glbClone) {
          if (!glbClone) return;
          var p = new THREE.Group();
          p.position.set(useLocal ? _px : centerX + _px, centerY, useLocal ? _pz : centerZ + _pz);
          p.rotation.y = srng() * Math.PI * 2;
          p.scale.setScalar(0.6 + srng() * 0.6);
          glbClone.traverse(function(c){ if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
          p.add(glbClone);
          parent.add(p);
        });
      })(px, pz);
    }
  }

  // ── Build visual island for each waypoint + tee + basket ──
  var islandColor  = new THREE.Color(tc.island);
  var rimColor     = new THREE.Color(tc.rim);
  // Moving island indices — these get their own animated meshes, skip in static build
  var _movingIdxSet = new Set();
  if (hole.movingIslands) hole.movingIslands.forEach(function(mv){ _movingIdxSet.add(mv.waypointIdx); });

  var allIslands = [
    {x:0, z:0, r:8, elev:hole.teeElev||0, type:"tee"},
    ...hole.waypoints
      .map(function(wp, wi){ return {x:wp.x,z:wp.z,r:wp.r||7,elev:wp.elev||0,type:wp.type||"normal",_wi:wi}; })
      .filter(function(wp){ return !_movingIdxSet.has(wp._wi); }),   // skip moving islands
    {x:hole.bx, z:hole.bz, r:8, elev:hole.basketElev||0, type:"basket"},
  ];

  // ── Theme material palette ────────────────────────────────────────
  var _tm = hole.theme || "eerie";
  var _topCol   = new THREE.Color(tc.island);
  var _sideCol  = new THREE.Color(tc.island).lerp(new THREE.Color(0x111111),0.55);
  var _grassCol = new THREE.Color(tc.island).lerp(new THREE.Color(0x448833),0.4);
  var _rockCol  = new THREE.Color(0x665544).lerp(new THREE.Color(tc.island),0.25);
  var _rimColors = {tee:0x00ff88,basket:0xff6600,narrow:0xff2222,shortcut:0xffff00,raised:0x88aaff};

  // ── Island.glb native measurements (verified from Python GLB inspection):
  //   Half-width = 0.4465  → scale = r / 0.4465 fills collision radius r
  //   Top-surface Y = 0.745 (grass primitive maxY)
  //   Base Y ≈ 0 (dirt primitive minY ≈ -0.01)
  //   Two materials: Dirt (body) + Grass (top cap) — both preserved from GLB
  var _ISL_HW = 0.4465;   // native model half-width
  var _ISL_TY = 0.730;    // native top-surface Y (verified from GLB accessor max.y=0.730)

  // Shared fallback materials (created once, reused — no per-island material spam)
  var _fbTop  = new THREE.MeshLambertMaterial({color: _topCol});
  var _fbSide = new THREE.MeshLambertMaterial({color: _sideCol});
  var _foamM  = new THREE.MeshBasicMaterial({color:0xaaddff,transparent:true,opacity:0.35,side:THREE.DoubleSide});

  allIslands.forEach(function(isl) {
    if (isl.isMoving) return;
    var r     = Math.max(4, isl.r);
    var elev  = isl.elev || 0;
    var surfY = waterY + 2.75 + elev;  // top surface — matches terrainY() exactly
    var segs  = 12;

    // ── Rim at EXACT collision radius r so visual edge = physics edge ───────
    var rimCol  = _rimColors[isl.type] || tc.rim;
    var rimMesh = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.14, 5, segs),
      new THREE.MeshBasicMaterial({color: rimCol})
    );
    rimMesh.rotation.x = Math.PI/2;
    rimMesh.position.set(isl.x, surfY + 0.02, isl.z);
    //grp.add(rimMesh);

    // ── Shoreline foam at water level ────────────────────────────────────────
    var foam = new THREE.Mesh(new THREE.RingGeometry(r*0.9, r*0.9+0.6, segs), _foamM);
    foam.rotation.x = -Math.PI/2;
    foam.position.set(isl.x, waterY+0.04, isl.z);
    //grp.add(foam);

    // ── Procedural fallback (instant — shown while GLB loads) ────────────────
    var _proc = new THREE.Group();
    var baseY = waterY + 2.2 + elev;
    var _ft   = new THREE.Mesh(new THREE.CylinderGeometry(r, r*0.9, 0.55, segs), _fbTop);
    _ft.position.set(isl.x, baseY + 0.26, isl.z);
    _ft.castShadow = true; _ft.receiveShadow = true;
    _proc.add(_ft);
    var depth  = Math.max(2.5, elev+3.5);
    var _fc    = new THREE.Mesh(new THREE.CylinderGeometry(r*0.88, r*0.55, depth, segs), _fbSide);
    _fc.position.set(isl.x, baseY+0.275-depth*0.5, isl.z);
    _fc.castShadow = true;
    _proc.add(_fc);
    grp.add(_proc);

    // ── Island.glb async load — replaces procedural on arrival ──────────────
    // Each call is a fresh clone (loadModel caches source, _cloneGLB clones it)
    // No re-fetch after first island — model is cached in _modelCache["island"]
    var _islandKey = hole && hole.islandModelKey ? hole.islandModelKey : "island";
    if (typeof loadModel === "function" && typeof MODEL_OVERRIDES !== "undefined" && MODEL_OVERRIDES[_islandKey]) {
      (function(_isl, _r, _surfY, _proc) {
        loadModel(_islandKey, function(glbClone) {
          if (!glbClone) return;  // load failed — keep procedural
          grp.remove(_proc);
          // Auto-fit any island GLB (Island.glb, Island2.glb, etc.) to gameplay radius/top.
          glbClone.updateMatrixWorld(true);
          var _bb = new THREE.Box3().setFromObject(glbClone);
          var _sz = new THREE.Vector3(); _bb.getSize(_sz);
          var _hw = Math.max(_sz.x, _sz.z) * 0.5;
          if (_hw < 0.001) _hw = _ISL_HW;  // safety fallback
          var _topY = _bb.max.y;
          var _ratio = _estimateIslandTopRadiusRatio(glbClone);
          var sc    = _r / _hw;
          var posY  = _surfY - sc * _topY;
          var _rotY = srng() * Math.PI * 2;
          var _walkR = _r * _ratio;
          if (_isl.type === "tee") hole.teeWalkR = _walkR;
          else if (_isl.type === "basket") hole.basketWalkR = _walkR;
          else if (_isl._wi !== undefined && hole.waypoints[_isl._wi]) {
            hole.waypoints[_isl._wi].walkR = _walkR;
          }
          var g2    = new THREE.Group();
          g2.scale.setScalar(sc);
          g2.position.set(_isl.x, posY, _isl.z);
          g2.rotation.y = _rotY;  // keep physics/profile orientation in sync
          var _tint = new THREE.Color(tc.island);
          glbClone.traverse(function(c) {
            if (!c.isMesh) return;
            c.castShadow = true; c.receiveShadow = true;
            var _mats = Array.isArray(c.material) ? c.material : [c.material];
            var _tinted = _mats.map(function(m) {
              var mc = m.clone();
              if (mc.color) mc.color.set(_tint);
              return mc;
            });
            c.material = Array.isArray(c.material) ? _tinted : _tinted[0];
          });
          g2.add(glbClone);
          grp.add(g2);
        });
      })(isl, r, surfY, _proc);
    }
    addGrassPatches(grp, isl.x, surfY + 0.05, isl.z, r, false);
  });
;

  // ── Waterfall: falling water planes between height-drop islands ──
  if (hole.theme === "waterfall") {
    var fallMat2=new THREE.MeshBasicMaterial({color:0x66bbee,transparent:true,opacity:0.55,side:THREE.DoubleSide});
    for (var wfi=0;wfi<allIslands.length-1;wfi++) {
      var wfA=allIslands[wfi],wfB=allIslands[wfi+1];
      var wfDH=(wfA.elev||0)-(wfB.elev||0);
      if(wfDH>1.5){
        var wfAng=Math.atan2(wfB.x-wfA.x,wfB.z-wfA.z);
        var fall2=new THREE.Mesh(new THREE.PlaneGeometry(wfA.r*1.2,wfDH+2),fallMat2);
        fall2.position.set(wfA.x,waterY+1.75+(wfA.elev||0)-wfDH*0.5,wfA.z);
        fall2.rotation.y=wfAng; grp.add(fall2);
        var mist2=new THREE.Mesh(new THREE.CylinderGeometry(wfA.r*0.7,wfA.r*0.8,0.3,12),fallMat2);
        mist2.position.set(wfB.x,waterY+1.75+(wfB.elev||0)+0.2,wfB.z); grp.add(mist2);
        var wfPL=new THREE.PointLight(0x55aaff,0.6,15);
        wfPL.position.set((wfA.x+wfB.x)/2,waterY+3+(wfA.elev||0)*0.5,(wfA.z+wfB.z)/2); grp.add(wfPL);
      }
    }
  }

  // ── Connecting path beams (show the route visually) ──
  var beamMat = new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.08});
  for(var i=0; i<allIslands.length-1; i++){
    var a=allIslands[i], b=allIslands[i+1];
    var dx=b.x-a.x, dz=b.z-a.z, len2=Math.hypot(dx,dz);
    if(len2<3) continue;
    var beam = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.06,len2*0.92), beamMat);
    beam.position.set((a.x+b.x)/2, waterY+1.75+(a.elev+b.elev)*0.5+0.05, (a.z+b.z)/2);
    beam.rotation.y = Math.atan2(dx,dz);
    grp.add(beam);
  }

  // ── Scenery: distant cliff walls around the perimeter ──
  addSceneryBorder(grp, hole, idx);

  return grp;
}

// ══════════════════════════════════════════════════════════════════
// ── THEMED SCENERY SHELL ──────────────────────────────────────────
// Surrounds the playfield with rich thematic environment art.
// Placed 150-280 units from origin — visible but not reachable.
// ══════════════════════════════════════════════════════════════════
function addSceneryBorder(grp, hole, idx) {
  var tc  = themeColors[hole.theme] || themeColors.eerie;
  var wY  = hole.water;
  var N   = (hole.noiseOx||0);  // noise offset for variety per hole

  // ── UNIVERSAL BACKGROUND LAYER ──────────────────────────────────
  // Every theme gets a far ring of 24 large terrain chunks at 250-380u
  // to hide the void. These are layered at various heights so no flat
  // horizon is ever visible.
  var farMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(tc.island).lerp(new THREE.Color(0x111122), 0.7)
  });
  for (var fi = 0; fi < 24; fi++) {
    var fa = (fi / 24) * Math.PI * 2 + srng() * 0.4;
    var fR = 250 + srng() * 130;
    var fx = Math.cos(fa) * fR, fz = Math.sin(fa) * fR;
    var fh = 35 + srng() * 80, fw = 40 + srng() * 60;
    var far = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fw * 0.7), farMat);
    far.position.set(fx, wY + fh * 0.35 - 10, fz);
    far.rotation.y = fa; grp.add(far);
  }

  // ── ANIMATED CLOUDS (universal) ─────────────────────────────────
  // Flat sphere clusters at high altitude rotate slowly — hides sky seams
  var cloudMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(tc.sky2||0x222244).lerp(new THREE.Color(0xffffff), 0.15),
    transparent: true, opacity: 0.18
  });
  for (var ci = 0; ci < 12; ci++) {
    var ca = (ci / 12) * Math.PI * 2 + N * 0.3;
    var cR = 180 + srng() * 80, ch = wY + 55 + srng() * 40;
    var cloud = new THREE.Group();
    for (var cj = 0; cj < 4; cj++) {
      var cs = new THREE.Mesh(new THREE.SphereGeometry(12 + srng() * 10, 6, 4), cloudMat);
      cs.position.set((srng()-0.5)*25, (srng()-0.5)*8, (srng()-0.5)*25);
      cs.scale.y = 0.3 + srng() * 0.25; cloud.add(cs);
    }
    cloud.position.set(Math.cos(ca)*cR, ch, Math.sin(ca)*cR);
    cloud.userData.rotY = (srng() - 0.5) * 0.003;  // slow drift
    grp.add(cloud);
  }

  switch (hole.theme) {

    // ── CITY / OFFICE ──────────────────────────────────────────────
    case "city": case "office": {
      // Inner ring: tall office towers (150-200u)
      var bMat2  = new THREE.MeshLambertMaterial({color:0x334455});
      var glMat2 = new THREE.MeshBasicMaterial({color:0x88bbff,transparent:true,opacity:0.28});
      var litM2  = new THREE.MeshBasicMaterial({color:0xffffcc});
      for (var bi = 0; bi < 32; bi++) {
        var ba = (bi/32)*Math.PI*2 + srng()*0.2;
        var bR2 = 155 + srng()*55, bh2 = 20+srng()*65, bw2 = 9+srng()*18;
        var bx2 = Math.cos(ba)*bR2, bz2 = Math.sin(ba)*bR2;
        var b2 = new THREE.Mesh(new THREE.BoxGeometry(bw2,bh2,bw2*0.7), bMat2);
        b2.position.set(bx2,wY+bh2*0.5,bz2); b2.castShadow=true; grp.add(b2);
        var gw2 = new THREE.Mesh(new THREE.BoxGeometry(bw2*0.9,bh2*0.9,bw2*0.65), glMat2);
        gw2.position.set(bx2,wY+bh2*0.5,bz2); grp.add(gw2);
        // Rooftop lights — every 8th building only (was every 3rd = too many lights)
        if (bi%8===0) {
          var rl = new THREE.Mesh(new THREE.SphereGeometry(0.5,6,4), litM2);
          rl.position.set(bx2,wY+bh2+0.5,bz2); grp.add(rl);
          var rpl = new THREE.PointLight(0xffffaa,0.4,22); rpl.position.set(bx2,wY+bh2,bz2); grp.add(rpl);
        }
      }
      // Road grid on the "ground" (flat planes extending outward)
      var roadMat = new THREE.MeshBasicMaterial({color:0x222233});
      var rdg = new THREE.PlaneGeometry(800,800); rdg.rotateX(-Math.PI/2);
      var road = new THREE.Mesh(rdg, roadMat);
      road.position.y = wY - 0.1; grp.add(road);
      // Streetlights — reduced from 24 to 10 to cut PointLight count
      var slMat2 = new THREE.MeshLambertMaterial({color:0x888888});
      for (var sl2=0;sl2<10;sl2++) {
        var sla=(sl2/10)*Math.PI*2, slR=130+srng()*20;
        var slx=Math.cos(sla)*slR,slz=Math.sin(sla)*slR;
        var slp=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,9,6),slMat2);
        slp.position.set(slx,wY+4.5,slz); grp.add(slp);
        var sll=new THREE.Mesh(new THREE.SphereGeometry(0.55,8,6),litM2);
        sll.position.set(slx,wY+9.3,slz); grp.add(sll);
        var slpl=new THREE.PointLight(0xffffaa,0.5,28); slpl.position.set(slx,wY+9,slz); grp.add(slpl);
      }
      // Window billboard glow signs on some towers
      var neonM = new THREE.MeshBasicMaterial({color:0xff00aa,transparent:true,opacity:0.55});
      for (var ni=0;ni<6;ni++) {
        var na=(ni/6)*Math.PI*2+0.3, nR=160+srng()*40, nh=25+srng()*25;
        var sign=new THREE.Mesh(new THREE.PlaneGeometry(6+srng()*6,2.5),neonM);
        sign.position.set(Math.cos(na)*nR,wY+nh,Math.sin(na)*nR);
        sign.rotation.y=na+Math.PI; grp.add(sign);
      }
      break;
    }

    // ── GRAND CANYON ──────────────────────────────────────────────
    case "grandcanyon": case "waterfall": {
      var layerCols2 = [0xcc6633,0xaa4422,0x884422,0xdd8855,0xbb5533];
      // Massive canyon walls — 4 main walls close-in
      for (var wi2=0;wi2<5;wi2++) {
        var wa2=(wi2/5)*Math.PI*2+srng()*0.3, wR2=140+srng()*60;
        var wx2=Math.cos(wa2)*wR2, wz2=Math.sin(wa2)*wR2;
        var wh2=40+srng()*60, ww2=50+srng()*60;
        // 4 strata layers per wall
        for (var lay=0;lay<5;lay++) {
          var lh=wh2*0.14+srng()*8;
          var lm=new THREE.MeshLambertMaterial({color:layerCols2[lay%5]});
          var lmesh=new THREE.Mesh(new THREE.BoxGeometry(ww2*(1-lay*0.04),lh,ww2*0.5*(1-lay*0.04)),lm);
          lmesh.position.set(wx2,wY+lay*wh2*0.18+lh*0.5,wz2);
          lmesh.rotation.y=wa2+Math.PI/4; lmesh.castShadow=true; grp.add(lmesh);
        }
      }
      // Arches
      var archM2=new THREE.MeshLambertMaterial({color:0xbb5522});
      for (var ai2=0;ai2<5;ai2++) {
        var aa2=(ai2/5)*Math.PI*2+Math.PI/8, aR3=145+srng()*40;
        var ax2=Math.cos(aa2)*aR3, az2=Math.sin(aa2)*aR3;
        var arH=18+srng()*14, arW=14+srng()*10;
        var aL=new THREE.Mesh(new THREE.BoxGeometry(3,arH,4),archM2);
        aL.position.set(ax2-arW/2,wY+arH/2,az2); grp.add(aL);
        var aR4=new THREE.Mesh(new THREE.BoxGeometry(3,arH,4),archM2);
        aR4.position.set(ax2+arW/2,wY+arH/2,az2); grp.add(aR4);
        var aT=new THREE.Mesh(new THREE.BoxGeometry(arW+3,3,4),archM2);
        aT.position.set(ax2,wY+arH+1.5,az2); grp.add(aT);
      }
      // Mesa plateaus (flat tops)
      for (var mi2=0;mi2<8;mi2++) {
        var ma2=srng()*Math.PI*2, mR2=200+srng()*80;
        var mh2=20+srng()*30, mr2=25+srng()*20;
        var mesa=new THREE.Mesh(new THREE.CylinderGeometry(mr2,mr2*0.8,mh2,10),
          new THREE.MeshLambertMaterial({color:layerCols2[mi2%5]}));
        mesa.position.set(Math.cos(ma2)*mR2,wY+mh2*0.45-5,Math.sin(ma2)*mR2); grp.add(mesa);
      }
      // Waterfalls (only for waterfall theme)
      if (hole.theme==="waterfall") {
        var fallM3=new THREE.MeshBasicMaterial({color:0x66bbee,transparent:true,opacity:0.5,side:THREE.DoubleSide});
        for (var fj=0;fj<8;fj++) {
          var fja=(fj/8)*Math.PI*2, fjR=155+srng()*40;
          var fjh=35+srng()*25;
          var fall3=new THREE.Mesh(new THREE.PlaneGeometry(5,fjh),fallM3);
          fall3.position.set(Math.cos(fja)*fjR,wY+fjh*0.4,Math.sin(fja)*fjR);
          fall3.rotation.y=fja; grp.add(fall3);
          var fjl=new THREE.PointLight(0x55aaff,0.5,20);
          fjl.position.set(Math.cos(fja)*fjR,wY+fjh*0.3,Math.sin(fja)*fjR); grp.add(fjl);
        }
      }
      break;
    }

    // ── MOON ──────────────────────────────────────────────────────
    case "moon": {
      var mRockM2=new THREE.MeshLambertMaterial({color:0x888888});
      var darkM2=new THREE.MeshLambertMaterial({color:0x444455});
      // Ground plane (grey regolith)
      var moonFloor=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),
        new THREE.MeshLambertMaterial({color:0x777788}));
      moonFloor.rotation.x=-Math.PI/2; moonFloor.position.y=wY-0.3; grp.add(moonFloor);
      // Crater rims in 3 rings
      for (var cr2=0;cr2<20;cr2++) {
        var cra2=(cr2/20)*Math.PI*2+srng()*0.5, crR2=160+srng()*120;
        var crSz=15+srng()*25;
        var rim2=new THREE.Mesh(new THREE.TorusGeometry(crSz,2+srng()*3.5,6,20),mRockM2);
        rim2.rotation.x=Math.PI/2-0.12+srng()*0.25;
        rim2.position.set(Math.cos(cra2)*crR2,wY+1,Math.sin(cra2)*crR2); grp.add(rim2);
        // Rock peaks inside
        var rpk=new THREE.Mesh(new THREE.ConeGeometry(4+srng()*5,12+srng()*14,5),mRockM2);
        rpk.position.set(Math.cos(cra2)*crR2,wY+4,Math.sin(cra2)*crR2); grp.add(rpk);
      }
      // Planet in sky
      var planetM2=new THREE.MeshBasicMaterial({color:0x4477cc,transparent:true,opacity:0.55});
      var planet2=new THREE.Mesh(new THREE.SphereGeometry(40,16,12),planetM2);
      planet2.position.set(160,160,-220); grp.add(planet2);
      // Saturn-like ring around planet
      var ringM=new THREE.MeshBasicMaterial({color:0x8866aa,transparent:true,opacity:0.3,side:THREE.DoubleSide});
      var ring2=new THREE.Mesh(new THREE.TorusGeometry(58,6,4,40),ringM);
      ring2.rotation.x=0.35; ring2.position.set(160,160,-220); grp.add(ring2);
      // Star field
      var sGeo=new THREE.BufferGeometry();
      var sPos=new Float32Array(900);
      for(var si2=0;si2<300;si2++){
        var saz=srng()*Math.PI*2,sel=srng()*Math.PI,sr2=350+srng()*150;
        sPos[si2*3]=Math.sin(sel)*Math.cos(saz)*sr2;
        sPos[si2*3+1]=Math.abs(Math.cos(sel))*sr2*0.8+30;
        sPos[si2*3+2]=Math.sin(sel)*Math.sin(saz)*sr2;
      }
      sGeo.setAttribute("position",new THREE.BufferAttribute(sPos,3));
      grp.add(new THREE.Points(sGeo,new THREE.PointsMaterial({color:0xffffff,size:1.4})));
      // Satellites
      for(var sti=0;sti<3;sti++){
        var satM=new THREE.MeshLambertMaterial({color:0x888899});
        var sat=new THREE.Mesh(new THREE.BoxGeometry(3,1,6),satM);
        sat.position.set((srng()-0.5)*300,(wY+60+srng()*80),(srng()-0.5)*300); grp.add(sat);
        var panel=new THREE.Mesh(new THREE.BoxGeometry(8,0.3,2),
          new THREE.MeshBasicMaterial({color:0x4455cc,transparent:true,opacity:0.7}));
        panel.position.copy(sat.position); grp.add(panel);
      }
      break;
    }

    // ── MOUNTAINS / WINTER ────────────────────────────────────────
    case "mountains": case "winter": {
      var isWinter=hole.theme==="winter";
      var mRock=new THREE.MeshLambertMaterial({color:isWinter?0x8899aa:0x666677});
      var snowM2=new THREE.MeshLambertMaterial({color:0xeeeeff});
      var treeM2=new THREE.MeshLambertMaterial({color:isWinter?0x225533:0x224422});
      var trunkM2=new THREE.MeshLambertMaterial({color:0x553322});
      // Ground plane
      var gFloor=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),
        new THREE.MeshLambertMaterial({color:isWinter?0xddeeff:0x336622}));
      gFloor.rotation.x=-Math.PI/2; gFloor.position.y=wY-0.2; grp.add(gFloor);
      // Three rings of peaks
      [180,260,370].forEach(function(ringR,ri){
        var peaks=10+ri*5;
        for(var mti2=0;mti2<peaks;mti2++){
          var mta2=(mti2/peaks)*Math.PI*2+srng()*0.35+ri*0.18;
          var mtx2=Math.cos(mta2)*(ringR+srng()*35), mtz2=Math.sin(mta2)*(ringR+srng()*35);
          var mth2=(22+srng()*44)/(ri*0.5+1), mtw2=11+srng()*15;
          var mt2=new THREE.Mesh(new THREE.ConeGeometry(mtw2,mth2,7),mRock);
          mt2.position.set(mtx2,wY+mth2*0.48,mtz2); mt2.castShadow=true; grp.add(mt2);
          var sc2=new THREE.Mesh(new THREE.ConeGeometry(mtw2*0.33,mth2*0.24,7),snowM2);
          sc2.position.set(mtx2,wY+mth2*0.88,mtz2); grp.add(sc2);
          // Dense pine forest on inner ring
          var treeCount = ri===0 ? 5 : (ri===1 ? 2 : 0);
          for(var tp2=0;tp2<treeCount;tp2++){
            var ta2=srng()*Math.PI*2, td2=mtw2*0.5+srng()*mtw2;
            var th2=5+srng()*6;
            var trunk2=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.6,th2*0.4,5),trunkM2);
            trunk2.position.set(mtx2+Math.cos(ta2)*td2,wY+th2*0.2,mtz2+Math.sin(ta2)*td2); grp.add(trunk2);
            var tree2=new THREE.Mesh(new THREE.ConeGeometry(2.2+srng()*1.2,th2,6),treeM2);
            tree2.position.set(mtx2+Math.cos(ta2)*td2,wY+th2*0.6,mtz2+Math.sin(ta2)*td2); grp.add(tree2);
          }
        }
      });
      // Clouds (fluffy white spheres at height)
      var cloudM=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.75});
      for(var ci2=0;ci2<14;ci2++){
        var cx2=(srng()-0.5)*500, cz3=(srng()-0.5)*500, cy2=wY+55+srng()*30;
        [0,1,2].forEach(function(ci3){
          var cl2=new THREE.Mesh(new THREE.SphereGeometry(7+srng()*5,7,5),cloudM);
          cl2.position.set(cx2+ci3*9-9,cy2+srng()*3,cz3+srng()*4); grp.add(cl2);
        });
      }
      if(isWinter){
        var lakeM=new THREE.MeshBasicMaterial({color:0x99ccff,transparent:true,opacity:0.5});
        var lake2=new THREE.Mesh(new THREE.CircleGeometry(70,24),lakeM);
        lake2.rotation.x=-Math.PI/2; lake2.position.set(0,wY+0.05,0); grp.add(lake2);
        // Ice cracks
        var crackM=new THREE.MeshBasicMaterial({color:0xaaddff});
        for(var ck2=0;ck2<8;ck2++){
          var cka2=srng()*Math.PI*2, ckl2=20+srng()*35;
          var crack2=new THREE.Mesh(new THREE.BoxGeometry(ckl2,0.05,0.3),crackM);
          crack2.position.set(Math.cos(cka2)*30,wY+0.06,Math.sin(cka2)*30);
          crack2.rotation.y=cka2; grp.add(crack2);
        }
      }
      break;
    }

    // ── MINION / FUNNY ────────────────────────────────────────────
    case "minion": case "funny": {
      var yMat2=new THREE.MeshLambertMaterial({color:0xffdd00});
      var bMat3=new THREE.MeshLambertMaterial({color:0x2244bb});
      var chiM2=new THREE.MeshLambertMaterial({color:0x888888});
      // Factories
      for(var fi3=0;fi3<10;fi3++){
        var fba2=(fi3/10)*Math.PI*2+srng()*0.4, fbR2=160+srng()*50;
        var fbx2=Math.cos(fba2)*fbR2, fbz2=Math.sin(fba2)*fbR2;
        var fbh2=18+srng()*22, fbw2=16+srng()*16;
        var fac2=new THREE.Mesh(new THREE.BoxGeometry(fbw2,fbh2,fbw2*0.7),bMat3);
        fac2.position.set(fbx2,wY+fbh2*0.5,fbz2); fac2.castShadow=true; grp.add(fac2);
        // Chimney
        var ch2=new THREE.Mesh(new THREE.CylinderGeometry(1.5,2,fbh2*0.75,10),chiM2);
        ch2.position.set(fbx2+fbw2*0.25,wY+fbh2+fbh2*0.375,fbz2); grp.add(ch2);
        // Smoke puff
        var smkM=new THREE.MeshBasicMaterial({color:0xbbbbbb,transparent:true,opacity:0.35});
        var smk=new THREE.Mesh(new THREE.SphereGeometry(3+srng()*3,6,4),smkM);
        smk.scale.y=0.55; smk.position.set(fbx2+fbw2*0.25,wY+fbh2*1.8,fbz2); grp.add(smk);
      }
      // Giant Minion statue
      var statY=new THREE.MeshLambertMaterial({color:0xffdd00});
      var statB2=new THREE.Mesh(new THREE.CylinderGeometry(8,10,22,12),statY);
      statB2.position.set(230,wY+11,-70); grp.add(statB2);
      var statH2=new THREE.Mesh(new THREE.SphereGeometry(10,12,10),statY);
      statH2.position.set(230,wY+27,-70); grp.add(statH2);
      var gogM3=new THREE.MeshLambertMaterial({color:0x888888});
      var gog3=new THREE.Mesh(new THREE.TorusGeometry(4,0.8,8,16),gogM3);
      gog3.rotation.x=Math.PI/2; gog3.position.set(230,wY+28.5,-59); grp.add(gog3);
      break;
    }

    // ── DISCO / NEON ──────────────────────────────────────────────
    case "disco": case "neon": {
      var discoBg=new THREE.MeshLambertMaterial({color:0x110022});
      var glowMs=[0xff00ff,0x00ffff,0xffff00,0xff4400].map(function(c){
        return new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0.7});
      });
      // Floor plane (black checkerboard illusion)
      var floorM=new THREE.MeshBasicMaterial({color:0x111122});
      var floorP=new THREE.Mesh(new THREE.PlaneGeometry(900,900),floorM);
      floorP.rotation.x=-Math.PI/2; floorP.position.y=wY-0.15; grp.add(floorP);
      // Tower ring
      for(var li2=0;li2<20;li2++){
        var la2=(li2/20)*Math.PI*2, lR2=170+srng()*30;
        var lx2=Math.cos(la2)*lR2, lz2=Math.sin(la2)*lR2;
        var tow2=new THREE.Mesh(new THREE.CylinderGeometry(1.5,2,24,6),discoBg);
        tow2.position.set(lx2,wY+12,lz2); grp.add(tow2);
        var topl=new THREE.Mesh(new THREE.SphereGeometry(2.8,8,6),glowMs[li2%4]);
        topl.position.set(lx2,wY+25,lz2); grp.add(topl);
        var pl3=new THREE.PointLight([0xff00ff,0x00ffff,0xffff00,0xff4400][li2%4],0.7,45);
        pl3.position.set(lx2,wY+25,lz2); grp.add(pl3);
      }
      // Laser beams
      for(var lbi=0;lbi<6;lbi++){
        var lba=(lbi/6)*Math.PI*2, lbh=wY+15, lbR=120;
        var laser=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,60,4),
          new THREE.MeshBasicMaterial({color:[0xff00ff,0x00ffff][lbi%2],transparent:true,opacity:0.4}));
        laser.rotation.z=Math.PI/4; laser.position.set(Math.cos(lba)*lbR,lbh,Math.sin(lba)*lbR);
        grp.add(laser);
      }
      break;
    }

    // ── TORNADO ───────────────────────────────────────────────────
    case "tornado": {
      // Open flat plains
      var plainM=new THREE.MeshLambertMaterial({color:0x334433});
      var plain=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),plainM);
      plain.rotation.x=-Math.PI/2; plain.position.y=wY-0.2; grp.add(plain);
      // Storm clouds ring
      var cldM=new THREE.MeshBasicMaterial({color:0x223333,transparent:true,opacity:0.65});
      for(var cli2=0;cli2<16;cli2++){
        var cla2=(cli2/16)*Math.PI*2+srng()*0.5, clR2=180+srng()*60;
        var cld2=new THREE.Mesh(new THREE.SphereGeometry(18+srng()*14,7,5),cldM);
        cld2.scale.y=0.28; cld2.position.set(Math.cos(cla2)*clR2,wY+40+srng()*25,Math.sin(cla2)*clR2);
        grp.add(cld2);
      }
      // Lightning rods
      var rodM2=new THREE.MeshLambertMaterial({color:0x556677});
      for(var ri3=0;ri3<10;ri3++){
        var ra2=(ri3/10)*Math.PI*2, rR3=145+srng()*35;
        var rod2=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.5,16+srng()*12,6),rodM2);
        rod2.position.set(Math.cos(ra2)*rR3,wY+8,Math.sin(ra2)*rR3); grp.add(rod2);
      }
      // Funnel cloud hint in distance
      var funnelM=new THREE.MeshBasicMaterial({color:0x445555,transparent:true,opacity:0.4});
      for(var fni=0;fni<3;fni++){
        var fna=(fni/3)*Math.PI*2+1.1, fnR=200+srng()*60;
        var fnTop=new THREE.Mesh(new THREE.CylinderGeometry(12,1,40,12,1,true),funnelM);
        fnTop.position.set(Math.cos(fna)*fnR,wY+55,Math.sin(fna)*fnR); grp.add(fnTop);
      }
      break;
    }

    // ── EERIE / TERRIFYING / SCREAMING ────────────────────────────
    case "eerie": case "terrifying": case "screaming_mamamia": {
      var spireM=new THREE.MeshLambertMaterial({color:0x220011});
      var lavaMat2=new THREE.MeshBasicMaterial({color:0xff3300,transparent:true,opacity:0.5});
      // Jagged spires: 3 rings
      [0,1,2].forEach(function(ring){
        var numSp=12+ring*6, spR=150+ring*60;
        for(var spi2=0;spi2<numSp;spi2++){
          var spa2=(spi2/numSp)*Math.PI*2+srng()*0.5;
          var spx2=Math.cos(spa2)*(spR+srng()*30), spz2=Math.sin(spa2)*(spR+srng()*30);
          var sph2=12+srng()*(25+ring*20);
          var spire2=new THREE.Mesh(new THREE.ConeGeometry(2+srng()*3+ring,sph2,3+ring),spireM);
          spire2.position.set(spx2,wY+sph2*0.5,spz2);
          spire2.rotation.z=(srng()-0.5)*0.3; spire2.castShadow=true; grp.add(spire2);
        }
      });
      // Lava pools with glow
      for(var lv2=0;lv2<8;lv2++){
        var lva2=(lv2/8)*Math.PI*2, lvR2=130+srng()*40;
        var lvx2=Math.cos(lva2)*lvR2, lvz2=Math.sin(lva2)*lvR2;
        var lpool2=new THREE.Mesh(new THREE.CylinderGeometry(9+srng()*7,9+srng()*7,0.5,12),lavaMat2);
        lpool2.position.set(lvx2,wY+0.3,lvz2); grp.add(lpool2);
        var lpl2=new THREE.PointLight(0xff4400,1.4,40); lpl2.position.set(lvx2,wY+4,lvz2); grp.add(lpl2);
      }
      break;
    }

    // ── GARDEN / CABBAGE / FEET_BUNNIES / SOCKS / PUBLIC_POO ─────
    case "cabbage": case "feet_bunnies": case "socks_basket": case "public_poo":
    case "emote": case "sixtyseven": {
      var hillM2=new THREE.MeshLambertMaterial({color:new THREE.Color(tc.island).lerp(new THREE.Color(0x228822),0.5)});
      // Ground
      var gFlr2=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),hillM2);
      gFlr2.rotation.x=-Math.PI/2; gFlr2.position.y=wY-0.2; grp.add(gFlr2);
      // Rolling hills
      for(var hi3=0;hi3<22;hi3++){
        var ha2=(hi3/22)*Math.PI*2+srng()*0.5, hR2=160+srng()*80;
        var hx2=Math.cos(ha2)*hR2, hz2=Math.sin(ha2)*hR2;
        var hh2=8+srng()*20, hr2=18+srng()*25;
        var hill2=new THREE.Mesh(new THREE.SphereGeometry(hr2,8,6),hillM2);
        hill2.scale.y=0.45; hill2.position.set(hx2,wY-hr2*0.18,hz2); grp.add(hill2);
        // Tree on hill
        if(srng()>0.5){
          var th2=new THREE.Mesh(new THREE.ConeGeometry(3,9,6),
            new THREE.MeshLambertMaterial({color:0x338833}));
          th2.position.set(hx2,wY+hh2*0.35,hz2); grp.add(th2);
        }
      }
      break;
    }

    // ── POOLROOMS ─────────────────────────────────────────────────
    case "poolrooms": {
      // Yellow endless tiled corridor
      var plrM=new THREE.MeshLambertMaterial({color:0xd4c99a});
      var plrLit2=new THREE.MeshBasicMaterial({color:0xffffcc});
      // Floor + ceiling
      var plFloor=new THREE.Mesh(new THREE.PlaneGeometry(900,900),new THREE.MeshLambertMaterial({color:0xccbb88}));
      plFloor.rotation.x=-Math.PI/2; plFloor.position.y=wY-0.2; grp.add(plFloor);
      var plCeil=new THREE.Mesh(new THREE.PlaneGeometry(900,900),plrM);
      plCeil.rotation.x=Math.PI/2; plCeil.position.y=wY+16; grp.add(plCeil);
      // Wall panels
      for(var pli2=0;pli2<24;pli2++){
        var pla2=(pli2/24)*Math.PI*2, plR2=190+srng()*20;
        var plx2=Math.cos(pla2)*plR2, plz2=Math.sin(pla2)*plR2;
        var plh2=15+srng()*6, plw2=28+srng()*18;
        var plW2=new THREE.Mesh(new THREE.BoxGeometry(plw2,plh2,1.5),plrM);
        plW2.position.set(plx2,wY+plh2*0.5,plz2); plW2.rotation.y=pla2; grp.add(plW2);
      }
      // Fluorescent strips
      for(var fli2=0;fli2<14;fli2++){
        var fla2=(fli2/14)*Math.PI*2, flR2=120+srng()*40;
        var flx2=Math.cos(fla2)*flR2, flz2=Math.sin(fla2)*flR2;
        var fls=new THREE.Mesh(new THREE.BoxGeometry(8,0.3,1),plrLit2);
        fls.position.set(flx2,wY+14.5,flz2); grp.add(fls);
        var flpl2=new THREE.PointLight(0xffffaa,0.55,32); flpl2.position.set(flx2,wY+14,flz2); grp.add(flpl2);
      }
      break;
    }

    // ── HOGWARTS ──────────────────────────────────────────────────
    case "hogwarts": {
      var hgStone=new THREE.MeshLambertMaterial({color:0x554433});
      var hgCandle=new THREE.MeshBasicMaterial({color:0xff9900,transparent:true,opacity:0.9});
      // Castle towers (reduced segments: 8→6)
      for(var cti2=0;cti2<12;cti2++){
        var cta2=(cti2/12)*Math.PI*2+srng()*0.3, ctR2=165+srng()*60;
        var ctx3=Math.cos(cta2)*ctR2, ctz2=Math.sin(cta2)*ctR2;
        var cth2=28+srng()*45;
        var tow3=new THREE.Mesh(new THREE.CylinderGeometry(5+srng()*3,6+srng()*3,cth2,6),hgStone);
        tow3.position.set(ctx3,wY+cth2*0.5,ctz2); tow3.castShadow=true; grp.add(tow3);
        var roof3=new THREE.Mesh(new THREE.ConeGeometry(7,14,6),hgStone);
        roof3.position.set(ctx3,wY+cth2+7,ctz2); grp.add(roof3);
        var winM2=new THREE.MeshBasicMaterial({color:0x8855ff,transparent:true,opacity:0.4});
        var win3=new THREE.Mesh(new THREE.PlaneGeometry(2.5,3.5),winM2);
        win3.position.set(ctx3+Math.cos(cta2)*5.2,wY+cth2*0.5,ctz2+Math.sin(cta2)*5.2);
        win3.rotation.y=cta2; grp.add(win3);
      }
      // 18 floating candles — NO per-candle PointLights (was 40 lights = main lag source)
      for(var fci2=0;fci2<18;fci2++){
        var fcx2=(srng()-0.5)*320, fcz2=(srng()-0.5)*320, fcY2=wY+8+srng()*12;
        var wax2=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,1.2,5),hgStone);
        wax2.position.set(fcx2,fcY2,fcz2); grp.add(wax2);
        var flm2=new THREE.Mesh(new THREE.SphereGeometry(0.22,4,3),hgCandle);
        flm2.position.set(fcx2,fcY2+0.85,fcz2); grp.add(flm2);
      }
      // 3 shared fill lights replace 40 individual candle lights
      [[-60,0],[ 60,50],[ 0,-70]].forEach(function(p){
        var pl=new THREE.PointLight(0xff8833,0.35,120);
        pl.position.set(p[0],wY+14,p[1]); grp.add(pl);
      });
      break;
    }

    // ── VILLAGE ───────────────────────────────────────────────────
    case "village": {
      var vstoneMat=new THREE.MeshLambertMaterial({color:0x887766});
      var vwoodMat=new THREE.MeshLambertMaterial({color:0x885533});
      var vthatchMat=new THREE.MeshLambertMaterial({color:0xccaa44});
      var vtreeMat=new THREE.MeshLambertMaterial({color:0x448833});
      // Ground
      var vFloor=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),
        new THREE.MeshLambertMaterial({color:0x5a8830}));
      vFloor.rotation.x=-Math.PI/2; vFloor.position.y=wY-0.2; grp.add(vFloor);
      // Houses
      for(var vhi2=0;vhi2<18;vhi2++){
        var vha2=(vhi2/18)*Math.PI*2+srng()*0.4, vhR2=155+srng()*60;
        var vhx2=Math.cos(vha2)*vhR2, vhz2=Math.sin(vha2)*vhR2;
        var vhW2=11+srng()*9, vhH2=7+srng()*5;
        var vhWall2=new THREE.Mesh(new THREE.BoxGeometry(vhW2,vhH2,vhW2*0.7),vstoneMat);
        vhWall2.position.set(vhx2,wY+vhH2*0.5,vhz2); vhWall2.castShadow=true; grp.add(vhWall2);
        var vhRoof2=new THREE.Mesh(new THREE.ConeGeometry(vhW2*0.68,5,4),vthatchMat);
        vhRoof2.position.set(vhx2,wY+vhH2+2.5,vhz2); vhRoof2.rotation.y=Math.PI/4; grp.add(vhRoof2);
      }
      // Windmill
      var wmx2=180,wmz2=0;
      var wmB2=new THREE.Mesh(new THREE.CylinderGeometry(4,6,26,8),vstoneMat);
      wmB2.position.set(wmx2,wY+13,wmz2); grp.add(wmB2);
      var wmC2=new THREE.Mesh(new THREE.ConeGeometry(5.5,9,8),vthatchMat);
      wmC2.position.set(wmx2,wY+30,wmz2); grp.add(wmC2);
      for(var wmi2=0;wmi2<4;wmi2++){
        var wms=new THREE.Mesh(new THREE.BoxGeometry(24,1.5,0.5),vwoodMat);
        wms.position.set(wmx2,wY+27,wmz2-1); wms.rotation.z=wmi2*Math.PI/2; grp.add(wms);
      }
      // 24 trees
      for(var vti2=0;vti2<24;vti2++){
        var vta2=srng()*Math.PI*2, vtR2=130+srng()*90;
        var vtrk=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.8,5,5),vwoodMat);
        vtrk.position.set(Math.cos(vta2)*vtR2,wY+2.5,Math.sin(vta2)*vtR2); grp.add(vtrk);
        var vtlf=new THREE.Mesh(new THREE.SphereGeometry(4+srng()*2,7,5),vtreeMat);
        vtlf.position.set(Math.cos(vta2)*vtR2,wY+8,Math.sin(vta2)*vtR2); grp.add(vtlf);
      }
      break;
    }

    // ── MINECRAFT ─────────────────────────────────────────────────
    case "minecraft": {
      var mcGrass=new THREE.MeshLambertMaterial({color:0x559933});
      var mcDirt=new THREE.MeshLambertMaterial({color:0x6b4226});
      var mcStone=new THREE.MeshLambertMaterial({color:0x888888});
      var mcWood=new THREE.MeshLambertMaterial({color:0x8b6914});
      var mcLeaf=new THREE.MeshLambertMaterial({color:0x3a7d1e});
      // Flat ground
      var mcFloor=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),mcGrass);
      mcFloor.rotation.x=-Math.PI/2; mcFloor.position.y=wY-0.3; grp.add(mcFloor);
      // Stacked cubes (3 rings)
      for(var mci2=0;mci2<28;mci2++){
        var mca2=(mci2/28)*Math.PI*2+srng()*0.4, mcR2=150+srng()*80;
        var mcx2=Math.cos(mca2)*mcR2, mcz2=Math.sin(mca2)*mcR2;
        var mcLayers2=Math.floor(3+srng()*5);
        for(var mcl2=0;mcl2<mcLayers2;mcl2++){
          var mcW2=12+srng()*10;
          var mcBlkM=mcl2===mcLayers2-1?mcGrass:mcl2<2?mcDirt:mcStone;
          var mcBlk2=new THREE.Mesh(new THREE.BoxGeometry(mcW2,6,mcW2),mcBlkM);
          mcBlk2.position.set(mcx2+(srng()-0.5)*4,wY+3+mcl2*5.8,mcz2+(srng()-0.5)*4);
          mcBlk2.castShadow=true; grp.add(mcBlk2);
        }
        // Pixel tree
        if(srng()>0.6){
          var mcTrH=5+srng()*4;
          var mcTrunk=new THREE.Mesh(new THREE.BoxGeometry(2,mcTrH,2),mcWood);
          mcTrunk.position.set(mcx2,wY+mcLayers2*5.5+mcTrH/2,mcz2); grp.add(mcTrunk);
          var mcCrown=new THREE.Mesh(new THREE.BoxGeometry(7,6,7),mcLeaf);
          mcCrown.position.set(mcx2,wY+mcLayers2*5.5+mcTrH+3,mcz2); grp.add(mcCrown);
        }
      }
      break;
    }

    // ── SKYBLOCK ──────────────────────────────────────────────────
    case "skyblock": {
      // Pure void — small distant islands at varied heights + star field
      var sbGrass=new THREE.MeshLambertMaterial({color:0x338844});
      var sbStone=new THREE.MeshLambertMaterial({color:0x888888});
      var sbWood2=new THREE.MeshLambertMaterial({color:0x885533});
      var sbLeaf2=new THREE.MeshLambertMaterial({color:0x225522});
      // Floating islands scattered far away at different Y levels
      var sbIslands=[
        {x:230,y:30,z:-90,r:20},{x:-170,y:15,z:210,r:14},{x:110,y:-10,z:230,r:24},
        {x:-230,y:22,z:-130,r:16},{x:190,y:45,z:160,r:12},
        {x:-100,y:55,z:-200,r:10},{x:260,y:-18,z:80,r:18},{x:-60,y:70,z:220,r:8},
      ];
      sbIslands.forEach(function(fi2){
        var fTop=new THREE.Mesh(new THREE.CylinderGeometry(fi2.r,fi2.r*0.85,4,12),sbGrass);
        fTop.position.set(fi2.x,wY+fi2.y+2,fi2.z); grp.add(fTop);
        var fSide=new THREE.Mesh(new THREE.CylinderGeometry(fi2.r*0.85,fi2.r*0.5,9,12),sbStone);
        fSide.position.set(fi2.x,wY+fi2.y-2.5,fi2.z); grp.add(fSide);
        var fTrunk=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.7,5,6),sbWood2);
        fTrunk.position.set(fi2.x,wY+fi2.y+6.5,fi2.z); grp.add(fTrunk);
        var fLeaf=new THREE.Mesh(new THREE.SphereGeometry(fi2.r*0.35,7,5),sbLeaf2);
        fLeaf.position.set(fi2.x,wY+fi2.y+11,fi2.z); grp.add(fLeaf);
      });
      // Star field + void particles
      var vGeo=new THREE.BufferGeometry(), vPos2=new Float32Array(600);
      for(var vi2=0;vi2<200;vi2++){
        vPos2[vi2*3]=(srng()-0.5)*700; vPos2[vi2*3+1]=wY-20-srng()*100; vPos2[vi2*3+2]=(srng()-0.5)*700;
      }
      vGeo.setAttribute("position",new THREE.BufferAttribute(vPos2,3));
      grp.add(new THREE.Points(vGeo,new THREE.PointsMaterial({color:0xffffff,size:1.2})));
      // Upper stars
      var sGeo2=new THREE.BufferGeometry(), sPos2=new Float32Array(900);
      for(var si3=0;si3<300;si3++){
        var saz2=srng()*Math.PI*2, sel2=srng()*Math.PI*0.5, sr3=300+srng()*150;
        sPos2[si3*3]=Math.cos(saz2)*sr3; sPos2[si3*3+1]=Math.sin(sel2)*sr3*0.6+80; sPos2[si3*3+2]=Math.sin(saz2)*sr3;
      }
      sGeo2.setAttribute("position",new THREE.BufferAttribute(sPos2,3));
      grp.add(new THREE.Points(sGeo2,new THREE.PointsMaterial({color:0xeeeeff,size:1.0})));
      break;
    }

    // ── MAP67 / SIXTYSEVEN ────────────────────────────────────────
    case "map67": case "sixtyseven": {
      var digM=new THREE.MeshBasicMaterial({color:0x00ff88,transparent:true,opacity:0.7});
      // Giant "6" far left
      var ring6=new THREE.Mesh(new THREE.TorusGeometry(20,3,8,24),digM);
      ring6.rotation.x=Math.PI/2; ring6.position.set(-200,wY+25,230); grp.add(ring6);
      var bar6=new THREE.Mesh(new THREE.BoxGeometry(4.5,40,4.5),digM);
      bar6.position.set(-220,wY+20,230); grp.add(bar6);
      // Giant "7" far right
      var top7=new THREE.Mesh(new THREE.BoxGeometry(40,4.5,4.5),digM);
      top7.position.set(195,wY+42,230); grp.add(top7);
      var diag7=new THREE.Mesh(new THREE.BoxGeometry(4.5,38,4.5),digM);
      diag7.rotation.z=-0.3; diag7.position.set(200,wY+22,230); grp.add(diag7);
      // Green grid ground
      var gridM=new THREE.MeshBasicMaterial({color:0x002200});
      var gridP=new THREE.Mesh(new THREE.PlaneGeometry(900,900),gridM);
      gridP.rotation.x=-Math.PI/2; gridP.position.y=wY-0.2; grp.add(gridP);
      break;
    }

    // ── BACKROOMS / OFFICE (fallback) ─────────────────────────────
    case "backrooms": case "office": {
      var brM=new THREE.MeshLambertMaterial({color:0xc8b850});
      var brLit=new THREE.MeshBasicMaterial({color:0xffffaa});
      // Floor + low ceiling
      var brFloor2=new THREE.Mesh(new THREE.PlaneGeometry(800,800),new THREE.MeshLambertMaterial({color:0xb8a818}));
      brFloor2.rotation.x=-Math.PI/2; brFloor2.position.y=wY-0.2; grp.add(brFloor2);
      var brCeil2=new THREE.Mesh(new THREE.PlaneGeometry(800,800),brM);
      brCeil2.rotation.x=Math.PI/2; brCeil2.position.y=wY+18; grp.add(brCeil2);
      // Wall panels
      for(var bri2=0;bri2<20;bri2++){
        var bra2=(bri2/20)*Math.PI*2, brR2=185+srng()*20;
        var brx2=Math.cos(bra2)*brR2, brz2=Math.sin(bra2)*brR2;
        var brh2=17+srng()*4;
        var brW2=new THREE.Mesh(new THREE.BoxGeometry(28,brh2,1.5),brM);
        brW2.position.set(brx2,wY+brh2*0.5,brz2); brW2.rotation.y=bra2; grp.add(brW2);
      }
      // Fluorescent tubes
      for(var flt2=0;flt2<12;flt2++){
        var fltx=(srng()-0.5)*280, fltz=(srng()-0.5)*280;
        var fltB=new THREE.Mesh(new THREE.BoxGeometry(10,0.3,1),brLit);
        fltB.position.set(fltx,wY+17.5,fltz); grp.add(fltB);
        var fltL=new THREE.PointLight(0xffffaa,0.45,30); fltL.position.set(fltx,wY+17,fltz); grp.add(fltL);
      }
      break;
    }

    // ── VETERINARY SCHOOL ─────────────────────────────────────────
    case "vetschool": {
      // Ground — lush green grass lawn
      var vsFloor = new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),
        new THREE.MeshLambertMaterial({color:0x55aa55}));
      vsFloor.rotation.x = -Math.PI/2; vsFloor.position.y = wY - 0.15; grp.add(vsFloor);
      // Clinic buildings — two-storey white/teal structures
      var vsBuildM = new THREE.MeshLambertMaterial({color:0xeef5f0});
      var vsRoofM  = new THREE.MeshLambertMaterial({color:0x3399aa});
      var vsWinM   = new THREE.MeshBasicMaterial({color:0x99ddcc, transparent:true, opacity:0.55});
      for (var vb = 0; vb < 10; vb++) {
        var vba = (vb/10)*Math.PI*2 + srng()*0.3;
        var vbR = 145 + srng()*50;
        var vbx = Math.cos(vba)*vbR, vbz = Math.sin(vba)*vbR;
        var vbW = 12+srng()*10, vbH = 10+srng()*8, vbD = 9+srng()*6;
        var vbuild = new THREE.Mesh(new THREE.BoxGeometry(vbW,vbH,vbD), vsBuildM);
        vbuild.position.set(vbx, wY+vbH*0.5, vbz); vbuild.rotation.y = vba; vbuild.castShadow=true; grp.add(vbuild);
        // Teal roof (flat pitched)
        var vroof = new THREE.Mesh(new THREE.BoxGeometry(vbW+0.8, 1.2, vbD+0.8), vsRoofM);
        vroof.position.set(vbx, wY+vbH+0.6, vbz); vroof.rotation.y = vba; grp.add(vroof);
        // Windows
        var vwin = new THREE.Mesh(new THREE.BoxGeometry(vbW*0.8, vbH*0.55, 0.2), vsWinM);
        vwin.position.set(vbx, wY+vbH*0.55, vbz + Math.cos(vba)*vbD*0.52);
        vwin.rotation.y = vba; grp.add(vwin);
      }
      // Animal pens — wooden fenced enclosures
      var vsFenceM = new THREE.MeshLambertMaterial({color:0xaa7733});
      var vsDirtM  = new THREE.MeshLambertMaterial({color:0xaa8855});
      for (var vp = 0; vp < 7; vp++) {
        var vpa = (vp/7)*Math.PI*2 + Math.PI/14;
        var vpR = 200 + srng()*60;
        var vpx = Math.cos(vpa)*vpR, vpz = Math.sin(vpa)*vpR;
        var vpSz = 18+srng()*14;
        // Dirt floor of pen
        var vdirt = new THREE.Mesh(new THREE.PlaneGeometry(vpSz,vpSz),vsDirtM);
        vdirt.rotation.x=-Math.PI/2; vdirt.position.set(vpx,wY+0.01,vpz); grp.add(vdirt);
        // Fence posts on 4 sides
        for (var side=0; side<4; side++) {
          for (var fp=0; fp<5; fp++) {
            var fpOffset = -vpSz*0.5 + fp*(vpSz/4);
            var fpx2=vpx, fpz2=vpz;
            if (side===0) { fpx2=vpx+fpOffset; fpz2=vpz-vpSz*0.5; }
            else if (side===1) { fpx2=vpx+vpSz*0.5; fpz2=vpz+fpOffset; }
            else if (side===2) { fpx2=vpx+fpOffset; fpz2=vpz+vpSz*0.5; }
            else { fpx2=vpx-vpSz*0.5; fpz2=vpz+fpOffset; }
            var fpst=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,1.8,5),vsFenceM);
            fpst.position.set(fpx2,wY+0.9,fpz2); grp.add(fpst);
          }
          // Fence rails
          var railLen = vpSz, rx=vpx, rz=vpz, rRot=0;
          if (side===0){ rx=vpx; rz=vpz-vpSz*0.5; rRot=0; }
          else if (side===1){ rx=vpx+vpSz*0.5; rz=vpz; rRot=Math.PI/2; }
          else if (side===2){ rx=vpx; rz=vpz+vpSz*0.5; rRot=0; }
          else { rx=vpx-vpSz*0.5; rz=vpz; rRot=Math.PI/2; }
          [0.6,1.3].forEach(function(ry2){
            var rail=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,railLen,4),vsFenceM);
            rail.rotation.z=Math.PI/2; rail.rotation.y=rRot;
            rail.position.set(rx,wY+ry2,rz); grp.add(rail);
          });
        }
      }
      // Medical cross signs — green cross on white post
      var vsPostM   = new THREE.MeshLambertMaterial({color:0xffffff});
      var vsCrossM  = new THREE.MeshBasicMaterial({color:0x00bb55});
      for (var vc = 0; vc < 12; vc++) {
        var vca = srng()*Math.PI*2, vcR = 120+srng()*110;
        var vcx = Math.cos(vca)*vcR, vcz = Math.sin(vca)*vcR;
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,4.5,6),vsPostM);
        post.position.set(vcx,wY+2.25,vcz); grp.add(post);
        var crossH = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.45,0.1),vsCrossM);
        crossH.position.set(vcx,wY+4.2,vcz); grp.add(crossH);
        var crossV = new THREE.Mesh(new THREE.BoxGeometry(0.45,1.6,0.1),vsCrossM);
        crossV.position.set(vcx,wY+4.2,vcz); grp.add(crossV);
      }
      // Lush trees dotting the campus
      var vsLeafM = new THREE.MeshLambertMaterial({color:0x44bb44});
      var vsTrunkM = new THREE.MeshLambertMaterial({color:0x885522});
      for (var vt = 0; vt < 22; vt++) {
        var vta = srng()*Math.PI*2, vtR = 130+srng()*120;
        var vtx = Math.cos(vta)*vtR, vtz = Math.sin(vta)*vtR;
        var vtH = 5+srng()*4;
        var vtr = new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.35,vtH,6),vsTrunkM);
        vtr.position.set(vtx,wY+vtH*0.5,vtz); vtr.castShadow=true; grp.add(vtr);
        var vtc = new THREE.Mesh(new THREE.SphereGeometry(2.2+srng()*1.2,7,5),vsLeafM);
        vtc.position.set(vtx,wY+vtH+1.5,vtz); vtc.castShadow=true; grp.add(vtc);
      }
      // 3 shared fill lights (warm clinic lighting)
      [[80,0],[-60,55],[0,-85]].forEach(function(p){
        var vl = new THREE.PointLight(0xaaffcc, 0.3, 130);
        vl.position.set(p[0], wY+12, p[1]); grp.add(vl);
      });
      break;
    }

    // ── GENERIC FALLBACK ──────────────────────────────────────────
    default: {
      var defM2=new THREE.MeshLambertMaterial({color:new THREE.Color(tc.island).lerp(new THREE.Color(0x222233),0.65)});
      // Ground floor
      var defFloor=new THREE.Mesh(new THREE.PlaneGeometry(900,900),
        new THREE.MeshLambertMaterial({color:new THREE.Color(tc.island).lerp(new THREE.Color(0x000000),0.55)}));
      defFloor.rotation.x=-Math.PI/2; defFloor.position.y=wY-0.2; grp.add(defFloor);
      // Mixed cliff ring
      for(var di2=0;di2<18;di2++){
        var da2=(di2/18)*Math.PI*2+srng()*0.4, dR2=170+srng()*60;
        var dx2=Math.cos(da2)*dR2, dz2=Math.sin(da2)*dR2;
        var dh2=20+srng()*40, dw2=24+srng()*30;
        var dc2=new THREE.Mesh(new THREE.BoxGeometry(dw2,dh2,dw2*0.6),defM2);
        dc2.position.set(dx2,wY+dh2*0.38,dz2); dc2.rotation.y=da2+Math.PI/4; dc2.castShadow=true; grp.add(dc2);
      }
    }
  }
}

// ── Instanced grass blades on island tops ────────────────
function buildInstancedGrass(hole, idx) {
  // Procedural/instanced grass removed by design.
  // Grass now comes from GLB patches attached per-island in buildTerrain()
  // and per-moving-platform in game.js, so it inherits entity/platform motion.
  return new THREE.Group();
}

// ── Water plane ──────────────────────────────────────────
function buildWater(hole) {
  var tc  = themeColors[hole.theme]||themeColors.eerie;
  var geo = new THREE.PlaneGeometry(900,900); geo.rotateX(-Math.PI/2);
  var mat = new THREE.MeshBasicMaterial({color:tc.water||0x0044aa,transparent:true,opacity:hole.theme==="moon"?0:0.82});
  var mesh= new THREE.Mesh(geo,mat); mesh.position.y=hole.water;
  return mesh;
}

// ── addTerrainFeatures (stub — islands have visual built-in) ──
function addTerrainFeatures(hole, idx) { /* islands handle their own features */ }

// ── TERRAIN_CONNECTED (kept for compat — all holes are island mode now) ──
var TERRAIN_CONNECTED = new Set([]);  // empty — all themes use island system
