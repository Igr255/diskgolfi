"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── COSMETICS ────────────────────────────────────────────────────────────────
// Disc skins (painted patterns, themed shapes, coloured trails), character
// cosmetics (hats, footstep auras, finishes), cases and the saved profile.
// ══════════════════════════════════════════════════════════════════════════════
var COS = {};
COS.RARITIES = ["common", "rare", "epic", "legendary"];
COS.RARITY_WEIGHT = { common: 55, rare: 28, epic: 13, legendary: 4 };
COS.DUP_COINS = { common: 10, rare: 25, epic: 60, legendary: 150 };
COS.CASE_PRICE = 100;

// ── New disc skins ───────────────────────────────────────────────────────────
// pattern: painted on the flight plate · shape: replaces the disc body · trail: flight trail colour
COS.DISC_EXTRA = [
  // COMMON — bold painted patterns
  { id: "tiedye", name: "Tie-Dye", rarity: "common", pattern: "tiedye", trail: 0xff7ab8, desc: "Summer camp classic." },
  { id: "bullseye", name: "Bullseye", rarity: "common", pattern: "target", pc: ["#e8343a", "#ffffff"], trail: 0xff4a4a, desc: "Aim small, miss small." },
  { id: "checkers", name: "Checkers", rarity: "common", pattern: "checker", pc: ["#16161c", "#f4f4f4"], desc: "Race day." },
  { id: "zebra", name: "Zebra", rarity: "common", pattern: "zebra", desc: "Stripes all the way down." },
  { id: "polka", name: "Polka", rarity: "common", pattern: "dots", pc: ["#ff6aa8", "#ffffff"], trail: 0xff8ac0, desc: "Dotty." },
  { id: "pinwheel", name: "Pinwheel", rarity: "common", pattern: "pinwheel", pc: ["#ffd23a", "#ff5a3a"], trail: 0xffc040, desc: "Hypnotic in flight." },
  { id: "camo", name: "Woodland Camo", rarity: "common", pattern: "camo", pc: ["#4a5a32", "#6a7a42", "#2e3a22", "#8a8a5a"], desc: "Lost it in the rough again." },
  { id: "desertcamo", name: "Desert Camo", rarity: "common", pattern: "camo", pc: ["#c8a86a", "#a8885a", "#e0c890", "#8a6a42"], desc: "Sand trap ready." },
  { id: "mint", name: "Mint Swirl", rarity: "common", pattern: "swirl", pc: ["#7affd0", "#ffffff"], trail: 0x8affd8, desc: "Fresh." },
  // RARE — themed patterns and first shapes
  { id: "watermelon", name: "Watermelon", rarity: "rare", pattern: "watermelon", trail: 0xff5a6a, particles: "food", desc: "Seeds included." },
  { id: "orange", name: "Orange Slice", rarity: "rare", pattern: "citrus", pc: ["#ff9a1a", "#ffd890"], trail: 0xffa030, desc: "Vitamin C." },
  { id: "lime", name: "Lime Slice", rarity: "rare", pattern: "citrus", pc: ["#7ad83a", "#e8ffb0"], trail: 0x9aff4a, desc: "Zesty." },
  { id: "beachball", name: "Beach Ball", rarity: "rare", pattern: "beachball", trail: 0x3ab0ff, desc: "Bounces off everything." },
  { id: "basketball", name: "Basketball", rarity: "rare", pattern: "basketball", trail: 0xff8a3a, desc: "Wrong sport, right vibes." },
  { id: "smiley", name: "Smiley", rarity: "rare", pattern: "smiley", trail: 0xffe14a, desc: "Have a nice throw." },
  { id: "eyeball", name: "Eyeball", rarity: "rare", pattern: "eyeball", trail: 0xff5a5a, desc: "It's watching the basket." },
  { id: "leopard", name: "Leopard", rarity: "rare", pattern: "leopard", trail: 0xe8b060, desc: "Fast and fierce." },
  { id: "marble", name: "Marble", rarity: "rare", pattern: "marble", desc: "Carved from a museum floor." },
  { id: "pixel", name: "8-Bit", rarity: "rare", pattern: "pixel", trail: 0x6aff8a, particles: "pixels", desc: "Press start." },
  { id: "cookie", name: "Cookie", rarity: "rare", shape: "cookie", trail: 0xd8a060, particles: "food", desc: "Chocolate chip. Don't eat it." },
  { id: "vinyl", name: "Vinyl Record", rarity: "rare", shape: "vinyl", trail: 0xff5ab8, particles: "notes", desc: "Spins at 33⅓." },
  { id: "honeycomb", name: "Honeycomb", rarity: "rare", shape: "hex", pattern: "honey", trail: 0xffc020, desc: "Six sides of sweet." },
  { id: "shuriken", name: "Shuriken", rarity: "rare", shape: "shuriken", metal: true, color: 0xc8ccd4, trail: 0xaab8ff, particles: "sparks", desc: "Silent. Deadly. Par 3." },
  // EPIC — glowing patterns, big shapes, particles
  { id: "galaxy_swirl", name: "Nebula", rarity: "epic", pattern: "galaxy", glowMap: true, trail: 0xb46aff, particles: "stars", desc: "A whole galaxy on your plate." },
  { id: "lava", name: "Magma", rarity: "epic", pattern: "lava", glowMap: true, trail: 0xff6a1a, particles: "fire", desc: "Hot to the touch." },
  { id: "circuit", name: "Circuit", rarity: "epic", pattern: "circuit", glowMap: true, trail: 0x3af0ff, particles: "glow", desc: "Overclocked." },
  { id: "synthwave", name: "Synthwave", rarity: "epic", pattern: "synthwave", glowMap: true, trail: 0xff3af0, particles: "glow", desc: "Outrun the wind." },
  { id: "sakura", name: "Sakura", rarity: "epic", pattern: "sakura", trail: 0xffb0d0, particles: "petals", desc: "Petals on the breeze." },
  { id: "partypop", name: "Party Popper", rarity: "epic", pattern: "tiedye", trail: "rainbow", particles: "confetti", desc: "Every throw is a celebration." },
  { id: "unicorn", name: "Unicorn", rarity: "epic", pattern: "swirl", pc: ["#ffb0f0", "#b0f0ff"], trail: "rainbow", particles: "stars", desc: "Leaves a rainbow. Obviously." },
  { id: "yinyang", name: "Yin Yang", rarity: "epic", pattern: "yinyang", trail: 0xffffff, desc: "Perfectly balanced flight." },
  { id: "earth", name: "Planet Earth", rarity: "epic", pattern: "earth", trail: 0x4aa0ff, desc: "Throw the world." },
  { id: "donut", name: "Donut", rarity: "epic", shape: "donut", trail: 0xff8ac8, particles: "food", desc: "Pink icing, rainbow sprinkles." },
  { id: "star", name: "Superstar", rarity: "epic", shape: "star", color: 0xffd23a, metal: true, glow: 0xffaa00, trail: 0xffe060, particles: "stars", desc: "You're a star." },
  { id: "heart", name: "Sweetheart", rarity: "epic", shape: "heart", color: 0xff3a7a, trail: 0xff6aa0, particles: "hearts", desc: "Throw with love." },
  { id: "saturn", name: "Saturn", rarity: "epic", shape: "planet", trail: 0xe8c890, particles: "stars", desc: "Rings included." },
  { id: "hubcap", name: "Hubcap", rarity: "epic", shape: "wheel", trail: 0xc8d0dc, particles: "sparks", desc: "Spinning rims." },
  { id: "snowflake", name: "Snowflake", rarity: "epic", shape: "snowflake", color: 0xcaf0ff, glow: 0x6ad8ff, trail: 0xbaf0ff, particles: "snow", desc: "No two are the same." },
  { id: "burger", name: "Double Burger", rarity: "epic", shape: "burger", trail: 0xffb84a, particles: "food", desc: "Hold the pickles." },
  // LEGENDARY — showstoppers
  { id: "blackhole", name: "Black Hole", rarity: "legendary", pattern: "blackhole", glowMap: true, glow: 0xff8a3a, trail: 0xff9a4a, particles: "stars", desc: "Bends the light around it." },
  { id: "sun", name: "Solar Flare", rarity: "legendary", pattern: "sun", glowMap: true, glow: 0xffaa22, trail: 0xffc040, particles: "fire", desc: "Do not look directly at it." },
  { id: "prism", name: "Prism CD", rarity: "legendary", shape: "cd", trail: "rainbow", particles: "holo", desc: "Every colour at once." },
  { id: "aerobie", name: "Neon Ring", rarity: "legendary", shape: "ring", color: 0x3af0ff, glow: 0x3af0ff, trail: 0x3af0ff, particles: "glow", desc: "A hoop of pure light." },
  { id: "dragon", name: "Dragon Scale", rarity: "legendary", pattern: "dragon", glowMap: true, glow: 0x3aff8a, trail: 0x3aff8a, particles: "fire", desc: "Forged in dragonfire." },
  { id: "discoball", name: "Disco Ball", rarity: "legendary", pattern: "mirror", metal: true, glow: 0xff7ae8, trail: "rainbow", particles: "rainbow", desc: "Saturday night fever." },
];

// ── Character cosmetics ──────────────────────────────────────────────────────
COS.STYLE = [
  // hats
  { id: "hat_party", slot: "hat", name: "Party Hat", rarity: "common", icon: "🥳" },
  { id: "hat_cat", slot: "hat", name: "Cat Ears", rarity: "common", icon: "🐱" },
  { id: "hat_bunny", slot: "hat", name: "Bunny Ears", rarity: "common", icon: "🐰" },
  { id: "hat_devil", slot: "hat", name: "Devil Horns", rarity: "common", icon: "😈" },
  { id: "hat_shades", slot: "hat", name: "Sunglasses", rarity: "common", icon: "😎" },
  { id: "hat_cone", slot: "hat", name: "Traffic Cone", rarity: "common", icon: "🚧" },
  { id: "hat_frog", slot: "hat", name: "Frog Hat", rarity: "common", icon: "🐸" },
  { id: "hat_top", slot: "hat", name: "Top Hat", rarity: "rare", icon: "🎩" },
  { id: "hat_cowboy", slot: "hat", name: "Cowboy Hat", rarity: "rare", icon: "🤠" },
  { id: "hat_pirate", slot: "hat", name: "Pirate Hat", rarity: "rare", icon: "🏴‍☠️" },
  { id: "hat_propeller", slot: "hat", name: "Propeller Cap", rarity: "rare", icon: "🧢" },
  { id: "hat_phones", slot: "hat", name: "Headphones", rarity: "rare", icon: "🎧" },
  { id: "hat_flowers", slot: "hat", name: "Flower Crown", rarity: "rare", icon: "🌸" },
  { id: "hat_crown", slot: "hat", name: "Royal Crown", rarity: "epic", icon: "👑" },
  { id: "hat_viking", slot: "hat", name: "Viking Helmet", rarity: "epic", icon: "🪓" },
  { id: "hat_wizard", slot: "hat", name: "Wizard Hat", rarity: "epic", icon: "🧙" },
  { id: "hat_sombrero", slot: "hat", name: "Sombrero", rarity: "epic", icon: "🌮" },
  { id: "hat_astro", slot: "hat", name: "Space Helmet", rarity: "epic", icon: "🧑‍🚀" },
  { id: "hat_halo", slot: "hat", name: "Halo", rarity: "legendary", icon: "😇" },
  { id: "hat_cap", slot: "hat", name: "Backwards Cap", rarity: "common", icon: "🧢" },
  { id: "hat_beanie", slot: "hat", name: "Beanie", rarity: "common", icon: "🧶" },
  { id: "hat_bucket", slot: "hat", name: "Bucket Hat", rarity: "common", icon: "🎣" },
  { id: "hat_fez", slot: "hat", name: "Fez", rarity: "common", icon: "🟥" },
  { id: "hat_boppers", slot: "hat", name: "Alien Boppers", rarity: "common", icon: "👽" },
  { id: "hat_chef", slot: "hat", name: "Chef's Toque", rarity: "rare", icon: "👨‍🍳" },
  { id: "hat_santa", slot: "hat", name: "Santa Hat", rarity: "rare", icon: "🎅" },
  { id: "hat_grad", slot: "hat", name: "Grad Cap", rarity: "rare", icon: "🎓" },
  { id: "hat_nest", slot: "hat", name: "Bird Nest", rarity: "rare", icon: "🐣" },
  { id: "hat_duckie", slot: "hat", name: "Rubber Duckie", rarity: "rare", icon: "🐤" },
  { id: "hat_tiara", slot: "hat", name: "Tiara", rarity: "rare", icon: "👸" },
  { id: "hat_unicorn", slot: "hat", name: "Unicorn Horn", rarity: "epic", icon: "🦄" },
  { id: "hat_jester", slot: "hat", name: "Jester Hat", rarity: "epic", icon: "🃏" },
  { id: "hat_knight", slot: "hat", name: "Knight Helm", rarity: "epic", icon: "🛡️" },
  { id: "hat_mohawk", slot: "hat", name: "Rainbow Mohawk", rarity: "epic", icon: "🤘" },
  { id: "hat_fire", slot: "hat", name: "Flame Head", rarity: "legendary", icon: "🔥" },
  // auras (particles from your feet)
  { id: "aura_sparkle", slot: "aura", name: "Sparkle Steps", rarity: "common", icon: "✨", fx: "sparks" },
  { id: "aura_bubbles", slot: "aura", name: "Bubbles", rarity: "common", icon: "🫧", fx: "bubbles" },
  { id: "aura_petals", slot: "aura", name: "Petal Trail", rarity: "rare", icon: "🌸", fx: "petals" },
  { id: "aura_notes", slot: "aura", name: "Music Notes", rarity: "rare", icon: "🎵", fx: "notes" },
  { id: "aura_snow", slot: "aura", name: "Snowfall", rarity: "rare", icon: "❄️", fx: "snow" },
  { id: "aura_hearts", slot: "aura", name: "Love Struck", rarity: "epic", icon: "💖", fx: "hearts" },
  { id: "aura_fire", slot: "aura", name: "Hot Feet", rarity: "epic", icon: "🔥", fx: "fire" },
  { id: "aura_pixels", slot: "aura", name: "Glitch", rarity: "epic", icon: "👾", fx: "pixels" },
  { id: "aura_rainbow", slot: "aura", name: "Rainbow Road", rarity: "legendary", icon: "🌈", fx: "rainbow" },
  { id: "aura_snacks", slot: "aura", name: "Snack Trail", rarity: "common", icon: "🍩", fx: "food" },
  { id: "aura_smoke", slot: "aura", name: "Smoke Bomb", rarity: "common", icon: "💨", fx: "smoke" },
  { id: "aura_confetti", slot: "aura", name: "Party Feet", rarity: "rare", icon: "🎊", fx: "confetti" },
  { id: "aura_toxic", slot: "aura", name: "Toxic Waste", rarity: "rare", icon: "☢️", fx: "toxic" },
  { id: "aura_frost", slot: "aura", name: "Frostbite", rarity: "rare", icon: "🥶", fx: "ice" },
  { id: "aura_stars", slot: "aura", name: "Stardust", rarity: "epic", icon: "🌟", fx: "stars" },
  { id: "aura_fairy", slot: "aura", name: "Fairy Dust", rarity: "epic", icon: "🧚", fx: "glow" },
  { id: "aura_holo", slot: "aura", name: "Hologram", rarity: "legendary", icon: "💠", fx: "holo" },
  // finishes (how your character is rendered)
  { id: "fin_shadow", slot: "finish", name: "Shadow", rarity: "rare", icon: "🌑" },
  { id: "fin_frozen", slot: "finish", name: "Frozen", rarity: "rare", icon: "🧊" },
  { id: "fin_chrome", slot: "finish", name: "Chrome", rarity: "epic", icon: "🪩" },
  { id: "fin_neon", slot: "finish", name: "Neon", rarity: "epic", icon: "💡" },
  { id: "fin_ghost", slot: "finish", name: "Ghost", rarity: "epic", icon: "👻" },
  { id: "fin_gold", slot: "finish", name: "Solid Gold", rarity: "legendary", icon: "🏆" },
  { id: "fin_rainbow", slot: "finish", name: "Prismatic", rarity: "legendary", icon: "🌈" },
  { id: "fin_pastel", slot: "finish", name: "Pastel", rarity: "common", icon: "🍬" },
  { id: "fin_bronze", slot: "finish", name: "Bronze Statue", rarity: "rare", icon: "🥉" },
  { id: "fin_marble", slot: "finish", name: "Marble", rarity: "rare", icon: "🏛️" },
  { id: "fin_candy", slot: "finish", name: "Candy Cane", rarity: "epic", icon: "🍭" },
  { id: "fin_lava", slot: "finish", name: "Molten", rarity: "epic", icon: "🌋" },
  { id: "fin_toxic", slot: "finish", name: "Radioactive", rarity: "epic", icon: "🧪" },
  { id: "fin_galaxy", slot: "finish", name: "Galaxy", rarity: "legendary", icon: "🌌" },
  // back (strapped to the torso — you see it all game long from the throw camera)
  { id: "back_bag", slot: "back", name: "Disc Bag", rarity: "common", icon: "🎒" },
  { id: "back_shell", slot: "back", name: "Turtle Shell", rarity: "common", icon: "🐢" },
  { id: "back_balloon", slot: "back", name: "Balloon", rarity: "common", icon: "🎈" },
  { id: "back_cape", slot: "back", name: "Hero Cape", rarity: "rare", icon: "🦸" },
  { id: "back_butterfly", slot: "back", name: "Butterfly Wings", rarity: "rare", icon: "🦋" },
  { id: "back_fin", slot: "back", name: "Shark Fin", rarity: "rare", icon: "🦈" },
  { id: "back_bat", slot: "back", name: "Bat Wings", rarity: "epic", icon: "🦇" },
  { id: "back_jetpack", slot: "back", name: "Jetpack", rarity: "epic", icon: "🚀" },
  { id: "back_angel", slot: "back", name: "Angel Wings", rarity: "legendary", icon: "👼" },
];
COS.style = function(id) { return COS.STYLE.find(function(s) { return s.id === id; }) || null; };

COS.CASES = {
  disc: { name: "Disc Case", icon: "🥏", color: "#33c3ef", desc: "One random disc skin" },
  style: { name: "Style Case", icon: "🎩", color: "#ff7ab8", desc: "A hat, an aura or a finish for your character" },
};

// Register the new disc skins with the existing skin list
(function() {
  if (typeof DISC_SKINS === "undefined") return;
  var have = {}; DISC_SKINS._global.forEach(function(s) { have[s.id] = 1; });
  COS.DISC_EXTRA.forEach(function(s) { if (!have[s.id]) DISC_SKINS._global.push(s); });
})();
// Give the original recolour-only epics / legendaries real artwork
COS.UPGRADE = {
  neon_pink: { pattern: "neonrings", pc: ["#ff3ad8"], glowMap: true, trail: 0xff3ad8 },
  fire: { pattern: "flames", glowMap: true, trail: 0xff7a1a },
  ice: { pattern: "frost", trail: 0x9aeaff, particles: "snow" },
  toxic: { pattern: "biohazard", glowMap: true, trail: 0x8aff3a },
  galaxy: { pattern: "galaxy", glowMap: true, trail: 0x8a5aff },
  holographic: { pattern: "holofoil", metal: false, glow: null, trail: "rainbow" },
  rainbow: { pattern: "rainbowrings", trail: "rainbow", rainbow: false },
};
(function() {
  if (typeof DISC_SKINS === "undefined") return;
  DISC_SKINS._global.forEach(function(s) { var u = COS.UPGRADE[s.id]; if (u) Object.keys(u).forEach(function(k) { s[k] = u[k]; }); });
})();
COS.discSkin = function(id) {
  var all = DISC_SKINS._global.concat(DISC_SKINS.vilov || []);
  return all.find(function(s) { return s.id === id; }) || null;
};

// ══════════════════════════════════════════════════════════════════════════════
// ── PROFILE (saved locally) ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
COS.state = { cases: { disc: 0, style: 0 }, coins: 0, owned: {}, equip: { hat: null, aura: null, finish: null, back: null }, wins: 0, opened: 0, gift: false };
(function() {
  try { var s = JSON.parse(localStorage.getItem("dg_profile") || "null"); if (s) { Object.assign(COS.state, s); COS.state.cases = Object.assign({ disc: 0, style: 0 }, s.cases); COS.state.equip = Object.assign({ hat: null, aura: null, finish: null, back: null }, s.equip); } } catch (e) {}
  if (!COS.state.gift) { COS.state.gift = true; COS.state.cases.disc += 1; COS.state.cases.style += 1; }   // welcome gift: one of each
})();
// Saving merges with what another tab may have saved (two tabs open for multiplayer testing
// used to overwrite each other's unlocks), and other tabs' saves are picked up live.
COS.save = function() {
  try {
    var stored = JSON.parse(localStorage.getItem("dg_profile") || "null");
    if (stored && stored.owned) Object.keys(stored.owned).forEach(function(k) { if (stored.owned[k]) COS.state.owned[k] = true; });
    localStorage.setItem("dg_profile", JSON.stringify(COS.state));
  } catch (e) {}
  if (COS.onChange) COS.onChange();
};
window.addEventListener("storage", function(e) {
  try {
    if (e.key === "dg_profile" && e.newValue) {
      var s = JSON.parse(e.newValue), owned = Object.assign({}, COS.state.owned, s.owned || {});
      Object.assign(COS.state, s); COS.state.owned = owned;
      if (COS.onChange) COS.onChange();
    } else if (e.key === "diskgolfi_unlocked" && e.newValue && typeof unlockedSkins !== "undefined") {
      Object.assign(unlockedSkins, JSON.parse(e.newValue));
    }
  } catch (er) {}
});
// Secret: unlock every cosmetic (hats, auras, finishes, disc skins, characters)
COS.unlockAll = function() {
  COS.STYLE.forEach(function(s) { COS.state.owned[s.id] = true; });
  if (typeof DISC_SKINS !== "undefined") { DISC_SKINS._global.concat(DISC_SKINS.vilov || []).forEach(function(s) { unlockedSkins[s.id] = true; }); saveUnlocked(); }
  if (typeof PLAYER_SKINS !== "undefined") { PLAYER_SKINS.forEach(function(s) { unlockedPlayerSkins[s.id] = true; }); if (typeof saveUnlockedPlayerSkins === "function") saveUnlockedPlayerSkins(); }
  COS.save();
  if (typeof PF !== "undefined" && PF.open) PF.render();
};
COS.SECRET = "DRIPCHECK";
COS.save();
COS.ownsStyle = function(id) { return !!COS.state.owned[id]; };
COS.ownsDisc = function(id) { return typeof unlockedSkins !== "undefined" && !!unlockedSkins[id]; };
COS.equipped = function() { return { hat: COS.state.equip.hat, aura: COS.state.equip.aura, finish: COS.state.equip.finish, back: COS.state.equip.back || null }; };
COS.equip = function(slot, id) {
  COS.state.equip[slot] = COS.state.equip[slot] === id ? null : id;
  COS.save();
  if (typeof localAvatarMesh !== "undefined" && localAvatarMesh && localAvatarMesh.userData.glbLoaded) COS.dressAvatar(localAvatarMesh, COS.equipped());
  if (typeof _lobby3D !== "undefined" && _lobby3D && _lobby3D.me && _lobby3D.me.userData.glbLoaded) COS.dressAvatar(_lobby3D.me, COS.equipped());
  if (typeof _sendLook === "function") _sendLook();
};
COS.casesTotal = function() { return COS.state.cases.disc + COS.state.cases.style; };

// Winning a game earns a case (alternating, so you get both kinds)
COS.awardCase = function() {
  var kind = (COS.state.wins % 2 === 0) ? "disc" : "style";
  COS.state.wins++;
  COS.state.cases[kind]++;
  COS.save();
  return kind;
};
COS.buyCase = function(kind) {
  if (COS.state.coins < COS.CASE_PRICE) return false;
  COS.state.coins -= COS.CASE_PRICE; COS.state.cases[kind]++; COS.save();
  return true;
};

// Roll a case: pick a rarity by weight, then an item of that rarity
COS.casePool = function(kind) {
  if (kind === "disc") return DISC_SKINS._global.filter(function(s) { return s.id !== "classic"; });
  return COS.STYLE.slice();
};
COS.rollItem = function(kind, rnd) {
  rnd = rnd || Math.random;
  var pool = COS.casePool(kind), tot = 0, r;
  COS.RARITIES.forEach(function(k) { if (pool.some(function(p) { return p.rarity === k; })) tot += COS.RARITY_WEIGHT[k]; });
  r = rnd() * tot;
  var rar = "common";
  for (var i = 0; i < COS.RARITIES.length; i++) {
    var k = COS.RARITIES[i]; if (!pool.some(function(p) { return p.rarity === k; })) continue;
    if (r < COS.RARITY_WEIGHT[k]) { rar = k; break; }
    r -= COS.RARITY_WEIGHT[k];
  }
  var of = pool.filter(function(p) { return p.rarity === rar; });
  return of[Math.floor(rnd() * of.length)];
};
COS.openCase = function(kind) {
  if (COS.state.cases[kind] <= 0) return null;
  COS.state.cases[kind]--;
  COS.state.opened++;
  var item = COS.rollItem(kind), dup;
  if (kind === "disc") {
    dup = COS.ownsDisc(item.id);
    if (!dup) { unlockedSkins[item.id] = true; saveUnlocked(); }
  } else {
    dup = COS.ownsStyle(item.id);
    if (!dup) COS.state.owned[item.id] = true;
  }
  var coins = dup ? COS.DUP_COINS[item.rarity] : 0;
  COS.state.coins += coins;
  COS.save();
  return { kind: kind, item: item, dup: dup, coins: coins };
};

// ══════════════════════════════════════════════════════════════════════════════
// ── DISC PATTERNS (painted on the flight plate) ──────────────────────────────
// Each painter draws a 512×512 top-down image (disc rim = circle radius 256).
// Painters with glowing parts also draw onto an emissive canvas `e`.
// ══════════════════════════════════════════════════════════════════════════════
COS._texCache = {};
COS.patternTex = function(skin) {
  var key = skin.id;
  if (COS._texCache[key]) return COS._texCache[key];
  var S = 512, c = document.createElement("canvas"); c.width = c.height = S;
  var g = c.getContext("2d"), ce = null, e = null;
  if (skin.glowMap) { ce = document.createElement("canvas"); ce.width = ce.height = S; e = ce.getContext("2d"); e.fillStyle = "#000"; e.fillRect(0, 0, S, S); }
  var rnd = _gfxRng(skin.id.length * 7919 + skin.id.charCodeAt(0) * 31);
  (COS.PAINT[skin.pattern] || COS.PAINT.tiedye)(g, e, skin.pc, rnd, S);
  // glossy ring at the rim so every pattern reads as a disc
  g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 6; g.beginPath(); g.arc(256, 256, 244, 0, 6.283); g.stroke();
  g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 253, 0, 6.283); g.stroke();
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t._dgShared = true;
  var te = null;
  if (ce) { te = new THREE.CanvasTexture(ce); te.encoding = THREE.sRGBEncoding; te._dgShared = true; }
  return (COS._texCache[key] = { map: t, emissive: te });
};
function _cosRays(g, n, cols, r0, r1, rot) {
  for (var i = 0; i < n; i++) {
    var a0 = rot + i / n * Math.PI * 2, a1 = rot + (i + 1) / n * Math.PI * 2;
    g.fillStyle = cols[i % cols.length]; g.beginPath(); g.moveTo(256 + Math.cos(a0) * r0, 256 + Math.sin(a0) * r0);
    g.arc(256, 256, r1, a0, a1); g.lineTo(256 + Math.cos(a1) * r0, 256 + Math.sin(a1) * r0); g.closePath(); g.fill();
  }
}
function _cosCircle(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
COS.PAINT = {
  tiedye: function(g, e, pc, rnd) {
    var cols = pc || ["#ff5a8a", "#ffd23a", "#3ab0ff", "#8ae05a", "#b46aff"];
    for (var r = 260; r > 0; r -= 6) {
      for (var a = 0; a < 6.283; a += 0.05) {
        var k = (r / 40 + a * 1.5 + Math.sin(a * 3 + r * 0.03)) % cols.length;
        g.fillStyle = cols[Math.floor(Math.abs(k)) % cols.length];
        g.fillRect(256 + Math.cos(a) * r - 4, 256 + Math.sin(a) * r - 4, 9, 9);
      }
    }
  },
  target: function(g, e, pc) { for (var i = 0; i < 6; i++) _cosCircle(g, 256, 256, 256 - i * 42, pc[i % 2]); },
  checker: function(g, e, pc) { for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) { g.fillStyle = pc[(x + y) % 2]; g.fillRect(x * 64, y * 64, 64, 64); } },
  zebra: function(g, e, pc, rnd) {
    g.fillStyle = "#f6f4ee"; g.fillRect(0, 0, 512, 512); g.fillStyle = "#151515";
    for (var i = 0; i < 16; i++) { var y = i * 34 + rnd() * 10; g.beginPath(); g.moveTo(0, y); for (var x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 14 + rnd() * 6); for (var x2 = 512; x2 >= 0; x2 -= 32) g.lineTo(x2, y + 12 + Math.sin(x2 * 0.025 + i * 2) * 10); g.fill(); }
  },
  dots: function(g, e, pc, rnd) { g.fillStyle = pc[0]; g.fillRect(0, 0, 512, 512); for (var y = 0; y < 512; y += 64) for (var x = (y / 64) % 2 * 32; x < 512; x += 64) _cosCircle(g, x + 16, y + 16, 15, pc[1]); },
  pinwheel: function(g, e, pc) { _cosRays(g, 16, pc, 0, 260, 0); _cosCircle(g, 256, 256, 40, "#ffffff"); },
  camo: function(g, e, pc, rnd) { g.fillStyle = pc[0]; g.fillRect(0, 0, 512, 512); for (var i = 0; i < 90; i++) { g.fillStyle = pc[1 + i % (pc.length - 1)]; g.beginPath(); var x = rnd() * 512, y = rnd() * 512; for (var k = 0; k < 8; k++) { var a = k / 8 * 6.283; g.lineTo(x + Math.cos(a) * (18 + rnd() * 30), y + Math.sin(a) * (14 + rnd() * 26)); } g.fill(); } },
  swirl: function(g, e, pc) { g.fillStyle = pc[1]; g.fillRect(0, 0, 512, 512); g.strokeStyle = pc[0]; g.lineWidth = 26; g.beginPath(); for (var t = 0; t < 30; t += 0.05) g.lineTo(256 + Math.cos(t) * t * 8.5, 256 + Math.sin(t) * t * 8.5); g.stroke(); },
  watermelon: function(g, e, pc, rnd) {
    _cosCircle(g, 256, 256, 256, "#2e8a2e"); _cosCircle(g, 256, 256, 236, "#a8e88a"); _cosCircle(g, 256, 256, 222, "#ff4a5a");
    for (var i = 0; i < 26; i++) { var a = rnd() * 6.283, r = 40 + rnd() * 150; g.save(); g.translate(256 + Math.cos(a) * r, 256 + Math.sin(a) * r); g.rotate(a); g.fillStyle = "#1a1010"; g.beginPath(); g.ellipse(0, 0, 9, 5, 0, 0, 6.283); g.fill(); g.restore(); }
  },
  citrus: function(g, e, pc) {
    _cosCircle(g, 256, 256, 256, pc[0]); _cosCircle(g, 256, 256, 232, pc[1]);
    _cosRays(g, 10, [pc[0]], 0, 0, 0);
    for (var i = 0; i < 10; i++) { var a0 = i / 10 * 6.283 + 0.04, a1 = (i + 1) / 10 * 6.283 - 0.04; g.fillStyle = pc[0]; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(256 + Math.cos((a0 + a1) / 2) * 20, 256 + Math.sin((a0 + a1) / 2) * 20); g.arc(256, 256, 214, a0, a1); g.closePath(); g.fill(); g.globalAlpha = 1; }
    _cosCircle(g, 256, 256, 22, pc[1]);
  },
  beachball: function(g, e) { _cosRays(g, 6, ["#ff3a3a", "#ffffff", "#3a8aff", "#ffffff", "#ffd23a", "#ffffff"], 0, 260, 0.3); _cosCircle(g, 256, 256, 46, "#ffffff"); },
  basketball: function(g, e) {
    _cosCircle(g, 256, 256, 256, "#e8752a"); g.strokeStyle = "#2a1408"; g.lineWidth = 10;
    g.beginPath(); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke(); g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.stroke();
    g.beginPath(); g.arc(-60, 256, 230, -1, 1); g.stroke(); g.beginPath(); g.arc(572, 256, 230, Math.PI - 1, Math.PI + 1); g.stroke();
  },
  smiley: function(g, e) {
    _cosCircle(g, 256, 256, 256, "#ffd83a"); _cosCircle(g, 186, 200, 30, "#2a1a08"); _cosCircle(g, 326, 200, 30, "#2a1a08");
    g.strokeStyle = "#2a1a08"; g.lineWidth = 22; g.lineCap = "round"; g.beginPath(); g.arc(256, 260, 120, 0.35, Math.PI - 0.35); g.stroke();
  },
  eyeball: function(g, e) {
    _cosCircle(g, 256, 256, 256, "#f8f4ee");
    g.strokeStyle = "rgba(200,30,30,.6)"; g.lineWidth = 3; for (var i = 0; i < 18; i++) { var a = i / 18 * 6.283; g.beginPath(); g.moveTo(256 + Math.cos(a) * 250, 256 + Math.sin(a) * 250); g.quadraticCurveTo(256 + Math.cos(a + 0.2) * 180, 256 + Math.sin(a + 0.2) * 180, 256 + Math.cos(a) * 140, 256 + Math.sin(a) * 140); g.stroke(); }
    var gr = g.createRadialGradient(256, 256, 20, 256, 256, 120); gr.addColorStop(0, "#1a6a3a"); gr.addColorStop(0.7, "#3ac87a"); gr.addColorStop(1, "#0a3a1a");
    g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 120, 0, 6.283); g.fill(); _cosCircle(g, 256, 256, 52, "#050505"); _cosCircle(g, 228, 226, 18, "#ffffff");
  },
  leopard: function(g, e, pc, rnd) { g.fillStyle = "#e8b060"; g.fillRect(0, 0, 512, 512); for (var i = 0; i < 70; i++) { var x = rnd() * 512, y = rnd() * 512; g.fillStyle = "#3a200a"; for (var k = 0; k < 5; k++) { var a = k / 5 * 6.283 + rnd(); g.beginPath(); g.ellipse(x + Math.cos(a) * 14, y + Math.sin(a) * 14, 7, 5, a, 0, 6.283); g.fill(); } _cosCircle(g, x, y, 7, "#b06a20"); } },
  marble: function(g, e, pc, rnd) { g.fillStyle = "#f2f0ea"; g.fillRect(0, 0, 512, 512); for (var i = 0; i < 30; i++) { g.strokeStyle = rnd() < 0.3 ? "rgba(200,160,60,.6)" : "rgba(40,40,60," + (0.35 + rnd() * 0.4) + ")"; g.lineWidth = 1.5 + rnd() * 5; g.beginPath(); var x = rnd() * 512, y = 0; g.moveTo(x, y); while (y < 512) { x += (rnd() - 0.5) * 40; y += 20 + rnd() * 20; g.lineTo(x, y); } g.stroke(); } },
  pixel: function(g, e, pc, rnd) { var cols = ["#2a2a5a", "#4a3a8a", "#ff5a8a", "#ffd23a", "#3ad87a", "#3ab0ff"]; for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { g.fillStyle = cols[Math.floor(rnd() * (rnd() < 0.6 ? 2 : cols.length))]; g.fillRect(x * 32, y * 32, 32, 32); } },
  honey: function(g, e) {
    g.fillStyle = "#ffb820"; g.fillRect(0, 0, 512, 512); g.strokeStyle = "#c87a08"; g.lineWidth = 6;
    for (var y = 0; y < 14; y++) for (var x = 0; x < 12; x++) { var cx = x * 48 + (y % 2) * 24, cy = y * 42; g.beginPath(); for (var k = 0; k < 6; k++) { var a = k / 6 * 6.283 + Math.PI / 6; g.lineTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26); } g.closePath(); g.stroke(); }
  },
  galaxy: function(g, e, pc, rnd) {
    g.fillStyle = "#0a0420"; g.fillRect(0, 0, 512, 512);
    [["#6a2aff", 0.35], ["#ff3ab8", 0.25], ["#3ab0ff", 0.25]].forEach(function(n, i) {
      for (var k = 0; k < 140; k++) { var t = k / 140 * 9 + i * 2, r = t * 26; var x = 256 + Math.cos(t) * r, y = 256 + Math.sin(t) * r; var gr = g.createRadialGradient(x, y, 0, x, y, 40); gr.addColorStop(0, n[0]); gr.addColorStop(1, "rgba(0,0,0,0)"); g.globalAlpha = n[1] * 0.4; g.fillStyle = gr; g.fillRect(x - 40, y - 40, 80, 80); }
    });
    g.globalAlpha = 1;
    for (var s = 0; s < 260; s++) { var sx = rnd() * 512, sy = rnd() * 512, sr = rnd() < 0.1 ? 2.5 : 1.2; _cosCircle(g, sx, sy, sr, "#ffffff"); _cosCircle(e, sx, sy, sr, "#ffffff"); }
    var gr2 = e.createRadialGradient(256, 256, 0, 256, 256, 90); gr2.addColorStop(0, "rgba(220,160,255,.9)"); gr2.addColorStop(1, "rgba(0,0,0,0)"); e.fillStyle = gr2; e.fillRect(0, 0, 512, 512);
  },
  lava: function(g, e, pc, rnd) {
    g.fillStyle = "#1a0e0a"; g.fillRect(0, 0, 512, 512);
    [g, e].forEach(function(c, ci) {
      c.strokeStyle = ci ? "#ff7a1a" : "#ff5a10"; c.lineWidth = ci ? 7 : 5; c.lineCap = "round";
      var r2 = _gfxRng(99);
      for (var i = 0; i < 26; i++) { c.beginPath(); var x = r2() * 512, y = r2() * 512; c.moveTo(x, y); for (var k = 0; k < 6; k++) { x += (r2() - 0.5) * 90; y += (r2() - 0.5) * 90; c.lineTo(x, y); } c.stroke(); }
    });
  },
  circuit: function(g, e, pc, rnd) {
    g.fillStyle = "#0a1a24"; g.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 40; i++) {
      var x = Math.round(rnd() * 16) * 32, y = Math.round(rnd() * 16) * 32, path = [[x, y]];
      for (var k = 0; k < 5; k++) { if (rnd() < 0.5) x += (rnd() < 0.5 ? -1 : 1) * 32 * (1 + Math.floor(rnd() * 3)); else y += (rnd() < 0.5 ? -1 : 1) * 32 * (1 + Math.floor(rnd() * 3)); path.push([x, y]); }
      [g, e].forEach(function(c) { c.strokeStyle = "#3af0ff"; c.lineWidth = 4; c.beginPath(); path.forEach(function(p, j) { if (j) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); _cosCircle(c, path[path.length - 1][0], path[path.length - 1][1], 7, "#3af0ff"); });
    }
  },
  synthwave: function(g, e) {
    var gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#1a0a3a"); gr.addColorStop(0.5, "#6a1a8a"); gr.addColorStop(1, "#ff3a8a");
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    var sg = g.createLinearGradient(0, 120, 0, 300); sg.addColorStop(0, "#ffe46a"); sg.addColorStop(1, "#ff3a8a");
    g.fillStyle = sg; g.beginPath(); g.arc(256, 260, 120, Math.PI, 0); g.fill(); e.fillStyle = "#ff8a6a"; e.beginPath(); e.arc(256, 260, 120, Math.PI, 0); e.fill();
    for (var b = 0; b < 5; b++) { g.fillStyle = "#6a1a8a"; g.fillRect(130, 200 + b * 13, 252, 4 + b); e.fillStyle = "#000"; e.fillRect(130, 200 + b * 13, 252, 4 + b); }
    [g, e].forEach(function(c) { c.strokeStyle = "#3af0ff"; c.lineWidth = 3; for (var y = 270; y < 512; y += 22) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); } for (var x = -512; x < 1024; x += 48) { c.beginPath(); c.moveTo(256, 262); c.lineTo(x, 512); c.stroke(); } });
  },
  sakura: function(g, e, pc, rnd) {
    g.fillStyle = "#ffe6f0"; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "#5a3a2a"; g.lineWidth = 12; g.lineCap = "round"; g.beginPath(); g.moveTo(40, 470); g.quadraticCurveTo(200, 300, 470, 200); g.stroke();
    for (var i = 0; i < 40; i++) { var x = rnd() * 512, y = rnd() * 512; for (var k = 0; k < 5; k++) { var a = k / 5 * 6.283; g.fillStyle = rnd() < 0.5 ? "#ff9ac0" : "#ffc0d8"; g.beginPath(); g.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 8, 5, a, 0, 6.283); g.fill(); } _cosCircle(g, x, y, 3.5, "#ff5a8a"); }
  },
  yinyang: function(g, e) {
    _cosCircle(g, 256, 256, 256, "#111111"); g.fillStyle = "#f6f6f6"; g.beginPath(); g.arc(256, 256, 256, -Math.PI / 2, Math.PI / 2); g.fill();
    _cosCircle(g, 256, 128, 128, "#f6f6f6"); _cosCircle(g, 256, 384, 128, "#111111"); _cosCircle(g, 256, 128, 36, "#111111"); _cosCircle(g, 256, 384, 36, "#f6f6f6");
  },
  earth: function(g, e, pc, rnd) {
    g.fillStyle = "#1a5ab0"; g.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 18; i++) { var x = rnd() * 512, y = rnd() * 512; g.fillStyle = rnd() < 0.75 ? "#3a9a3a" : "#c8a860"; g.beginPath(); for (var k = 0; k < 12; k++) { var a = k / 12 * 6.283; g.lineTo(x + Math.cos(a) * (20 + rnd() * 50), y + Math.sin(a) * (16 + rnd() * 40)); } g.fill(); }
    g.fillStyle = "rgba(255,255,255,.7)"; for (var j = 0; j < 30; j++) { g.beginPath(); g.ellipse(rnd() * 512, rnd() * 512, 30 + rnd() * 50, 6 + rnd() * 8, rnd(), 0, 6.283); g.fill(); }
  },
  blackhole: function(g, e) {
    g.fillStyle = "#020205"; g.fillRect(0, 0, 512, 512);
    [g, e].forEach(function(c) {
      for (var r = 70; r < 250; r += 3) { var k = 1 - (r - 70) / 180; c.strokeStyle = "rgba(255," + Math.round(120 + k * 120) + "," + Math.round(40 + k * 160) + "," + (k * 0.9) + ")"; c.lineWidth = 3; c.beginPath(); c.ellipse(256, 256, r, r * 0.92, 0.3, 0, 6.283); c.stroke(); }
    });
    _cosCircle(g, 256, 256, 66, "#000000"); _cosCircle(e, 256, 256, 66, "#000000");
    e.strokeStyle = "#fff4d0"; e.lineWidth = 4; e.beginPath(); e.arc(256, 256, 68, 0, 6.283); e.stroke();
  },
  sun: function(g, e) {
    [g, e].forEach(function(c) {
      var gr = c.createRadialGradient(256, 256, 10, 256, 256, 256); gr.addColorStop(0, "#fffbe0"); gr.addColorStop(0.35, "#ffd23a"); gr.addColorStop(0.75, "#ff7a1a"); gr.addColorStop(1, "#c8300a");
      c.fillStyle = gr; c.fillRect(0, 0, 512, 512);
      c.strokeStyle = "rgba(255,240,180,.5)"; c.lineWidth = 3; for (var i = 0; i < 40; i++) { var a = i / 40 * 6.283; c.beginPath(); c.moveTo(256 + Math.cos(a) * 90, 256 + Math.sin(a) * 90); c.lineTo(256 + Math.cos(a + 0.1) * 250, 256 + Math.sin(a + 0.1) * 250); c.stroke(); }
    });
  },
  dragon: function(g, e) {
    g.fillStyle = "#0a2a1a"; g.fillRect(0, 0, 512, 512);
    for (var y = 0; y < 18; y++) for (var x = 0; x < 16; x++) {
      var cx = x * 34 + (y % 2) * 17, cy = y * 30;
      var gr = g.createLinearGradient(cx, cy - 16, cx, cy + 16); gr.addColorStop(0, "#3aff8a"); gr.addColorStop(1, "#0a5a3a");
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 17, 0, Math.PI); g.fill();
      e.strokeStyle = "rgba(60,255,140,.55)"; e.lineWidth = 2; e.beginPath(); e.arc(cx, cy, 17, 0, Math.PI); e.stroke();
    }
  },
  neonrings: function(g, e, pc) {
    g.fillStyle = "#0e0614"; g.fillRect(0, 0, 512, 512);
    [g, e].forEach(function(c) { c.strokeStyle = pc[0]; for (var r = 40; r < 250; r += 34) { c.lineWidth = 6; c.beginPath(); c.arc(256, 256, r, 0, 6.283); c.stroke(); } });
  },
  flames: function(g, e, pc, rnd) {
    g.fillStyle = "#1a0804"; g.fillRect(0, 0, 512, 512);
    [g, e].forEach(function(c, ci) {
      var r2 = _gfxRng(5);
      for (var i = 0; i < 22; i++) {
        var a = i / 22 * 6.283, len = 140 + r2() * 90, w = 0.18 + r2() * 0.1;
        var gr = c.createRadialGradient(256, 256, 30, 256, 256, 30 + len); gr.addColorStop(0, "#fff2a0"); gr.addColorStop(0.4, "#ffb020"); gr.addColorStop(1, "rgba(255,40,0,0)");
        c.fillStyle = gr; c.beginPath(); c.moveTo(256 + Math.cos(a - w) * 40, 256 + Math.sin(a - w) * 40);
        c.quadraticCurveTo(256 + Math.cos(a - w * 0.3) * len * 0.7, 256 + Math.sin(a - w * 0.3) * len * 0.7, 256 + Math.cos(a + 0.2) * (40 + len), 256 + Math.sin(a + 0.2) * (40 + len));
        c.quadraticCurveTo(256 + Math.cos(a + w) * len * 0.6, 256 + Math.sin(a + w) * len * 0.6, 256 + Math.cos(a + w) * 40, 256 + Math.sin(a + w) * 40); c.fill();
      }
    });
  },
  frost: function(g, e, pc, rnd) {
    var gr = g.createRadialGradient(256, 256, 20, 256, 256, 256); gr.addColorStop(0, "#d8f6ff"); gr.addColorStop(0.6, "#4ab8f0"); gr.addColorStop(1, "#1a6ab8"); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "rgba(255,255,255,.95)"; g.lineCap = "round";
    for (var i = 0; i < 6; i++) { var a = i / 6 * 6.283; g.lineWidth = 6; g.beginPath(); g.moveTo(256, 256); g.lineTo(256 + Math.cos(a) * 230, 256 + Math.sin(a) * 230); g.stroke();
      for (var k = 1; k < 5; k++) { var d = k * 46; g.lineWidth = 4; [-1, 1].forEach(function(s2) { g.beginPath(); g.moveTo(256 + Math.cos(a) * d, 256 + Math.sin(a) * d); g.lineTo(256 + Math.cos(a) * (d + 34) + Math.cos(a + s2 * 1.57) * 26, 256 + Math.sin(a) * (d + 34) + Math.sin(a + s2 * 1.57) * 26); g.stroke(); }); } }
  },
  biohazard: function(g, e) {
    g.fillStyle = "#1a2a0a"; g.fillRect(0, 0, 512, 512);
    for (var y = 0; y < 512; y += 40) { g.fillStyle = (y / 40) % 2 ? "#2a3a0a" : "#1a2a0a"; g.fillRect(0, y, 512, 40); }
    [g, e].forEach(function(c) {
      c.fillStyle = "#8aff3a"; c.strokeStyle = "#8aff3a";
      for (var i = 0; i < 3; i++) { var a = i / 3 * 6.283 - Math.PI / 2; c.lineWidth = 34; c.beginPath(); c.arc(256 + Math.cos(a) * 80, 256 + Math.sin(a) * 80, 70, a + 2.2, a + 4.1, false); c.stroke(); }
      c.lineWidth = 16; c.beginPath(); c.arc(256, 256, 110, 0, 6.283); c.stroke(); _cosCircle(c, 256, 256, 30, "#8aff3a");
    });
  },
  holofoil: function(g, e) {
    for (var a = 0; a < 360; a += 1.5) { g.fillStyle = "hsl(" + ((a * 3) % 360) + ",85%,72%)"; g.beginPath(); g.moveTo(256, 256); g.arc(256, 256, 260, a * Math.PI / 180, (a + 2) * Math.PI / 180); g.fill(); }
    var gr = g.createRadialGradient(256, 256, 0, 256, 256, 256); gr.addColorStop(0, "rgba(255,255,255,.7)"); gr.addColorStop(0.5, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  },
  rainbowrings: function(g, e) { var cols = ["#ff3a3a", "#ff9a1a", "#ffe02a", "#3ad84a", "#2a9aff", "#8a4aff"]; for (var i = 0; i < 12; i++) _cosCircle(g, 256, 256, 256 - i * 21, cols[i % 6]); },
  mirror: function(g, e, pc, rnd) {
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var v = 150 + rnd() * 105; g.fillStyle = "rgb(" + v + "," + v + "," + (v + 10) + ")"; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
      if (rnd() < 0.12) { g.fillStyle = ["#ff7ae8", "#7ae8ff", "#ffe87a"][Math.floor(rnd() * 3)]; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); }
    }
  },
};

// Lathe disc body with top-down (planar) UVs so patterns land on the flight plate
COS._planarGeo = null;
COS.planarDiscGeo = function() {
  if (COS._planarGeo) return COS._planarGeo;
  var g = _discGeometry().clone(), p = g.attributes.position, uv = g.attributes.uv;
  for (var i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.08 + 0.5, p.getZ(i) / 1.08 + 0.5);
  uv.needsUpdate = true; g.userData.shared = true;
  return (COS._planarGeo = g);
};
COS.discMaterial = function(skin, baseColor, opacity) {
  var p = { color: skin.pattern ? 0xffffff : (skin.color || baseColor || 0xffffff), roughness: skin.metal ? 0.16 : 0.38, metalness: skin.metal ? 1 : 0, clearcoat: 0.7, clearcoatRoughness: 0.18, transparent: opacity < 1, opacity: opacity };
  if (skin.pattern) { var T = COS.patternTex(skin); p.map = T.map; if (T.emissive) { p.emissive = new THREE.Color(0xffffff); p.emissiveMap = T.emissive; p.emissiveIntensity = 1.2; } }
  if (skin.glow && !(skin.pattern && skin.glowMap)) { p.emissive = new THREE.Color(skin.glow); p.emissiveIntensity = 0.45; }
  return new THREE.MeshPhysicalMaterial(p);
};

// ══════════════════════════════════════════════════════════════════════════════
// ── DISC SHAPES ──────────────────────────────────────────────────────────────
// Built around the origin, ~0.55 radius, flat along y like a real disc.
// ══════════════════════════════════════════════════════════════════════════════
function _cosM(c, o) { var p = { color: c, roughness: 0.5 }; if (o) Object.keys(o).forEach(function(k) { p[k] = o[k]; }); return new THREE.MeshStandardMaterial(p); }
function _cosAdd(g, geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; g.add(m); return m; }
function _cosExtrude(shape, depth, bevel) {
  var geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: true, bevelThickness: bevel || 0.02, bevelSize: bevel || 0.02, bevelSegments: 2, curveSegments: 16 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, -depth / 2, 0);
  return geo;
}
COS.SHAPES = {
  hex: function(g, skin, m) { _cosAdd(g, new THREE.CylinderGeometry(0.56, 0.56, 0.09, 6), m); },
  cookie: function(g, skin) {
    _cosAdd(g, new THREE.CylinderGeometry(0.54, 0.5, 0.1, 28), _cosM(0xd8a060, { roughness: 0.9 }));
    var chip = _cosM(0x3a1e0a, { roughness: 0.6 }), r = _gfxRng(7);
    for (var i = 0; i < 16; i++) { var a = r() * 6.283, d = Math.sqrt(r()) * 0.44; var c = _cosAdd(g, new THREE.DodecahedronGeometry(0.045, 0), chip, Math.cos(a) * d, 0.055, Math.sin(a) * d); c.rotation.set(r() * 3, r() * 3, 0); }
  },
  vinyl: function(g, skin) {
    var cv = document.createElement("canvas"); cv.width = cv.height = 256; var x = cv.getContext("2d");
    x.fillStyle = "#101012"; x.fillRect(0, 0, 256, 256);
    for (var r = 50; r < 128; r += 2) { x.strokeStyle = r % 6 ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.12)"; x.beginPath(); x.arc(128, 128, r, 0, 6.283); x.stroke(); }
    x.fillStyle = "#ff5ab8"; x.beginPath(); x.arc(128, 128, 44, 0, 6.283); x.fill(); x.fillStyle = "#fff"; x.font = "900 13px Nunito, sans-serif"; x.textAlign = "center"; x.fillText("DISKGOLFI", 128, 116); x.fillText("SIDE A", 128, 150);
    x.fillStyle = "#000"; x.beginPath(); x.arc(128, 128, 5, 0, 6.283); x.fill();
    var t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
    var mt = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
    _cosAdd(g, new THREE.CylinderGeometry(0.56, 0.56, 0.035, 48), [_cosM(0x101012), mt, mt]);
  },
  shuriken: function(g, skin, m) {
    var s = new THREE.Shape(), n = 4;
    for (var i = 0; i < n * 2; i++) { var a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 0.16 : 0.6; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    var h = new THREE.Path(); h.absarc(0, 0, 0.07, 0, Math.PI * 2, true); s.holes.push(h);
    _cosAdd(g, _cosExtrude(s, 0.04, 0.012), m);
  },
  star: function(g, skin, m) {
    var s = new THREE.Shape();
    for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.27 : 0.62; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    _cosAdd(g, _cosExtrude(s, 0.08, 0.03), m);
  },
  heart: function(g, skin, m) {
    var s = new THREE.Shape(), k = 0.06;
    s.moveTo(0, -8 * k); s.bezierCurveTo(-1 * k, -6 * k, -9 * k, -3 * k, -9 * k, 2.2 * k); s.bezierCurveTo(-9 * k, 6.5 * k, -4 * k, 8 * k, 0, 4.5 * k);
    s.bezierCurveTo(4 * k, 8 * k, 9 * k, 6.5 * k, 9 * k, 2.2 * k); s.bezierCurveTo(9 * k, -3 * k, 1 * k, -6 * k, 0, -8 * k);
    var geo = _cosExtrude(s, 0.1, 0.04); geo.translate(0, 0, -0.04); _cosAdd(g, geo, m);
  },
  donut: function(g, skin) {
    var dough = _cosM(0xd89a5a, { roughness: 0.8 });
    var d = _cosAdd(g, new THREE.TorusGeometry(0.36, 0.17, 16, 40), dough); d.rotation.x = Math.PI / 2; d.scale.z = 0.7;
    var ic = _cosAdd(g, new THREE.TorusGeometry(0.36, 0.165, 16, 40, Math.PI * 2), _cosM(0xff8ac8, { roughness: 0.3 })); ic.rotation.x = Math.PI / 2; ic.scale.z = 0.55; ic.position.y = 0.035;
    var r = _gfxRng(11), cols = [0xffffff, 0xffd23a, 0x3ab0ff, 0x8ae05a, 0xff3a3a];
    for (var i = 0; i < 40; i++) { var a = r() * 6.283, rr = 0.24 + r() * 0.24; var sp = _cosAdd(g, new THREE.CylinderGeometry(0.012, 0.012, 0.06, 5), _cosM(cols[i % cols.length]), Math.cos(a) * rr, 0.13, Math.sin(a) * rr); sp.rotation.set(Math.PI / 2, 0, r() * 3); }
  },
  planet: function(g, skin) {
    var cv = document.createElement("canvas"); cv.width = 256; cv.height = 128; var x = cv.getContext("2d");
    var bands = ["#e8c890", "#c8a070", "#f0dcb0", "#b08050", "#e8c890"]; for (var i = 0; i < 16; i++) { x.fillStyle = bands[i % bands.length]; x.fillRect(0, i * 8, 256, 8); }
    var t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
    _cosAdd(g, new THREE.SphereGeometry(0.3, 28, 18), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })).scale.y = 0.8;
    var ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.62, 48), new THREE.MeshStandardMaterial({ color: 0xe8d8b0, side: THREE.DoubleSide, roughness: 0.6, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2; g.add(ring);
  },
  wheel: function(g, skin) {
    var tire = _cosAdd(g, new THREE.TorusGeometry(0.46, 0.1, 12, 40), _cosM(0x1a1a1e, { roughness: 0.9 })); tire.rotation.x = Math.PI / 2;
    var chrome = _cosM(0xdde2ea, { metalness: 1, roughness: 0.15 });
    _cosAdd(g, new THREE.CylinderGeometry(0.38, 0.38, 0.05, 32), chrome);
    _cosAdd(g, new THREE.CylinderGeometry(0.1, 0.12, 0.1, 16), chrome, 0, 0.03, 0);
    for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2, s = _cosAdd(g, new THREE.BoxGeometry(0.06, 0.04, 0.3), chrome, Math.sin(a) * 0.2, 0.04, Math.cos(a) * 0.2); s.rotation.y = a; }
  },
  snowflake: function(g, skin, m) {
    for (var i = 0; i < 6; i++) {
      var arm = new THREE.Group(); arm.rotation.y = i / 6 * Math.PI * 2; g.add(arm);
      _cosAdd(arm, new THREE.BoxGeometry(0.06, 0.05, 0.56), m, 0, 0, 0.28);
      [0.22, 0.4].forEach(function(d, k) { [-1, 1].forEach(function(s) { var b = _cosAdd(arm, new THREE.BoxGeometry(0.04, 0.045, 0.18 - k * 0.05), m, s * 0.06, 0, d + 0.06); b.rotation.y = s * 0.8; }); });
    }
    _cosAdd(g, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 6), m);
  },
  burger: function(g, skin) {
    var bun = _cosM(0xd8902a, { roughness: 0.7 });
    _cosAdd(g, new THREE.CylinderGeometry(0.5, 0.46, 0.08, 28), bun, 0, -0.1, 0);
    _cosAdd(g, new THREE.CylinderGeometry(0.52, 0.52, 0.07, 28), _cosM(0x5a2e14, { roughness: 0.9 }), 0, -0.03, 0);
    var ch = _cosAdd(g, new THREE.BoxGeometry(0.78, 0.02, 0.78), _cosM(0xffc83a, { roughness: 0.5 }), 0, 0.01, 0); ch.rotation.y = 0.4;
    var let_ = _cosAdd(g, new THREE.TorusGeometry(0.46, 0.04, 6, 24), _cosM(0x5ac83a)); let_.rotation.x = Math.PI / 2; let_.position.y = 0.03;
    var top = _cosAdd(g, new THREE.SphereGeometry(0.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), bun, 0, 0.04, 0); top.scale.y = 0.42;
    var seed = _cosM(0xfff0c8), r = _gfxRng(3);
    for (var i = 0; i < 18; i++) { var a = r() * 6.283, d = r() * 0.38; var s = _cosAdd(g, new THREE.SphereGeometry(0.022, 6, 4), seed, Math.cos(a) * d, 0.04 + 0.21 * Math.sqrt(1 - (d / 0.5) * (d / 0.5)), Math.sin(a) * d); s.scale.set(1, 0.5, 1.6); }
    g.scale.setScalar(0.95);
  },
  cd: function(g, skin) {
    var cv = document.createElement("canvas"); cv.width = cv.height = 256; var x = cv.getContext("2d");
    for (var a = 0; a < 360; a += 2) { x.fillStyle = "hsl(" + ((a * 2) % 360) + ",90%,70%)"; x.beginPath(); x.moveTo(128, 128); x.arc(128, 128, 128, a * Math.PI / 180, (a + 3) * Math.PI / 180); x.fill(); }
    x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.arc(128, 128, 30, 0, 6.283); x.fill();
    var t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
    var mt = new THREE.MeshPhysicalMaterial({ map: t, metalness: 0.9, roughness: 0.08, clearcoat: 1, emissive: new THREE.Color(0xffffff), emissiveMap: t, emissiveIntensity: 0.35 });
    var s = new THREE.Shape(); s.absarc(0, 0, 0.56, 0, Math.PI * 2, false); var h = new THREE.Path(); h.absarc(0, 0, 0.08, 0, Math.PI * 2, true); s.holes.push(h);
    var geo = _cosExtrude(s, 0.025, 0.006), p = geo.attributes.position, uv = geo.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.12 + 0.5, p.getZ(i) / 1.12 + 0.5);
    _cosAdd(g, geo, mt);
  },
  ring: function(g, skin) {
    var neon = new THREE.MeshStandardMaterial({ color: skin.glow || 0x3af0ff, emissive: new THREE.Color(skin.glow || 0x3af0ff), emissiveIntensity: 2.6, roughness: 0.3 });
    var t = _cosAdd(g, new THREE.TorusGeometry(0.5, 0.075, 12, 64), neon); t.rotation.x = Math.PI / 2;
    var inner = new THREE.Mesh(new THREE.CircleGeometry(0.46, 40), new THREE.MeshBasicMaterial({ color: skin.glow || 0x3af0ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    inner.rotation.x = -Math.PI / 2; g.add(inner);
  },
};

// Called by buildDisc() for skins with a pattern or one of the new shapes. Returns true if it built the body.
COS.buildDiscBody = function(g, skin, d, opacity, baseColor) {
  if (!skin || (!skin.pattern && !(skin.shape && COS.SHAPES[skin.shape]))) return false;
  var m = COS.discMaterial(skin, baseColor, opacity);
  if (skin.shape && COS.SHAPES[skin.shape]) COS.SHAPES[skin.shape](g, skin, m, opacity);
  else { var body = new THREE.Mesh(COS.planarDiscGeo(), m); body.castShadow = true; body.receiveShadow = true; g.add(body); }
  return true;
};

// ══════════════════════════════════════════════════════════════════════════════
// ── CHARACTER COSMETICS ──────────────────────────────────────────────────────
// Hats are built in head-top space (y = 0 is the top of the head, +z = face).
// ══════════════════════════════════════════════════════════════════════════════
COS._anim = [];   // animated bits (propellers, halos, rainbow finishes)
COS.HATS = {
  hat_party: function(g) {
    var cv = document.createElement("canvas"); cv.width = 64; cv.height = 64; var x = cv.getContext("2d");
    for (var i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "#ffd23a" : "#ff3a8a"; x.fillRect(0, i * 8, 64, 8); }
    var t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
    _cosAdd(g, new THREE.ConeGeometry(0.16, 0.42, 20), new THREE.MeshStandardMaterial({ map: t }), 0, 0.2, 0).rotation.z = 0.15;
    _cosAdd(g, new THREE.SphereGeometry(0.06, 10, 8), _cosM(0xffffff), -0.03, 0.42, 0);
  },
  hat_cat: function(g) { [-1, 1].forEach(function(s) { var e = _cosAdd(g, new THREE.ConeGeometry(0.1, 0.2, 4), _cosM(0x2a2a2e), s * 0.15, 0.06, 0); e.rotation.z = -s * 0.25; var i = _cosAdd(g, new THREE.ConeGeometry(0.06, 0.14, 4), _cosM(0xff9ac0), s * 0.15, 0.05, 0.03); i.rotation.z = -s * 0.25; }); },
  hat_bunny: function(g) { [-1, 1].forEach(function(s) { var e = _cosAdd(g, new THREE.SphereGeometry(0.07, 12, 10), _cosM(0xf8f8f8), s * 0.1, 0.22, 0); e.scale.set(0.8, 3.4, 0.6); e.rotation.z = -s * 0.15; var i = _cosAdd(g, new THREE.SphereGeometry(0.045, 10, 8), _cosM(0xffb0c8), s * 0.1, 0.22, 0.03); i.scale.set(0.8, 3.6, 0.3); i.rotation.z = -s * 0.15; }); },
  hat_devil: function(g) { [-1, 1].forEach(function(s) { var h = _cosAdd(g, new THREE.ConeGeometry(0.05, 0.18, 10), _cosM(0xd8202a, { emissive: new THREE.Color(0x400000) }), s * 0.14, 0.05, 0.04); h.rotation.z = -s * 0.4; }); },
  hat_shades: function(g) {   // origin on the eyes, the face surface at z = 0 (see COS.HAT_ANCHOR)
    var blk = _cosM(0x0a0a0e, { roughness: 0.2, metalness: 0.5 });
    [-1, 1].forEach(function(s) { _cosAdd(g, new THREE.BoxGeometry(0.17, 0.09, 0.03), blk, s * 0.1, 0, 0.025); });
    _cosAdd(g, new THREE.BoxGeometry(0.05, 0.02, 0.02), blk, 0, 0.025, 0.025);
    [-1, 1].forEach(function(s) { _cosAdd(g, new THREE.BoxGeometry(0.02, 0.02, 0.24), blk, s * 0.19, 0.02, -0.1); });
  },
  hat_cone: function(g) {
    _cosAdd(g, new THREE.ConeGeometry(0.17, 0.42, 20), _cosM(0xff7a1a), 0, 0.2, 0);
    _cosAdd(g, new THREE.CylinderGeometry(0.105, 0.125, 0.07, 20), _cosM(0xffffff), 0, 0.2, 0);
    _cosAdd(g, new THREE.BoxGeometry(0.4, 0.03, 0.4), _cosM(0xff7a1a), 0, 0.0, 0);
  },
  hat_frog: function(g) {
    var gr = _cosM(0x5ac83a, { roughness: 0.7 });
    var c = _cosAdd(g, new THREE.SphereGeometry(0.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), gr, 0, -0.05, 0); c.scale.y = 0.6;
    [-1, 1].forEach(function(s) { _cosAdd(g, new THREE.SphereGeometry(0.07, 12, 10), gr, s * 0.11, 0.09, 0.12); _cosAdd(g, new THREE.SphereGeometry(0.04, 10, 8), _cosM(0xffffff), s * 0.11, 0.1, 0.17); _cosAdd(g, new THREE.SphereGeometry(0.02, 8, 6), _cosM(0x000000), s * 0.11, 0.1, 0.205); });
  },
  hat_top: function(g) {
    var blk = _cosM(0x16161a, { roughness: 0.6 });
    _cosAdd(g, new THREE.CylinderGeometry(0.28, 0.28, 0.02, 28), blk, 0, 0.01, 0);
    _cosAdd(g, new THREE.CylinderGeometry(0.17, 0.17, 0.3, 28), blk, 0, 0.16, 0);
    _cosAdd(g, new THREE.CylinderGeometry(0.175, 0.175, 0.05, 28), _cosM(0xc8202a), 0, 0.05, 0);
  },
  hat_cowboy: function(g) {
    var br = _cosM(0x8a5a2a, { roughness: 0.8 });
    var b = _cosAdd(g, new THREE.CylinderGeometry(0.38, 0.38, 0.025, 32), br, 0, 0.0, 0); b.scale.z = 0.85;
    var c = _cosAdd(g, new THREE.CylinderGeometry(0.15, 0.19, 0.2, 24), br, 0, 0.1, 0);
    _cosAdd(g, new THREE.CylinderGeometry(0.195, 0.195, 0.04, 24), _cosM(0x3a2010), 0, 0.03, 0);
  },
  hat_pirate: function(g) {
    var blk = _cosM(0x1a1a20, { roughness: 0.7 });
    for (var i = 0; i < 3; i++) { var p = _cosAdd(g, new THREE.BoxGeometry(0.42, 0.18, 0.04), blk, 0, 0.08, 0); p.rotation.y = i * Math.PI * 2 / 3; p.position.set(Math.sin(i * 2.09) * 0.13, 0.08, Math.cos(i * 2.09) * 0.13); }
    _cosAdd(g, new THREE.CylinderGeometry(0.18, 0.2, 0.12, 20), blk, 0, 0.05, 0);
    _cosAdd(g, new THREE.SphereGeometry(0.035, 10, 8), _cosM(0xffffff), 0, 0.1, 0.2);
  },
  hat_propeller: function(g) {
    var c = _cosAdd(g, new THREE.SphereGeometry(0.24, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), _cosM(0x3a8aff), 0, -0.04, 0); c.scale.y = 0.55;
    [0, 1, 2, 3].forEach(function(i) { var s = _cosAdd(g, new THREE.SphereGeometry(0.245, 20, 12, i * Math.PI / 2, Math.PI / 4, 0, Math.PI / 2), _cosM([0xff3a3a, 0xffd23a][i % 2]), 0, -0.039, 0); s.scale.y = 0.56; });
    _cosAdd(g, new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), _cosM(0x888888), 0, 0.12, 0);
    var prop = new THREE.Group(); prop.position.y = 0.17; g.add(prop);
    [0, 1].forEach(function(k) { var b = _cosAdd(prop, new THREE.BoxGeometry(0.36, 0.01, 0.06), _cosM(k ? 0xffd23a : 0xff3a3a)); b.rotation.y = k * Math.PI / 2; b.rotation.x = 0.2; });
    COS._anim.push({ o: prop, f: function(o, t) { o.rotation.y = t * 14; } });
  },
  hat_phones: function(g) {   // origin in the middle of the head at ear height; the band arcs up to the crown (y = 0.235)
    var blk = _cosM(0x22222a, { roughness: 0.4 }), pad = _cosM(0xff3a8a, { roughness: 0.6 });
    _cosAdd(g, new THREE.TorusGeometry(0.245, 0.022, 8, 28, Math.PI), blk, 0, 0, 0);
    [-1, 1].forEach(function(s) { var cup = _cosAdd(g, new THREE.CylinderGeometry(0.085, 0.085, 0.07, 20), pad, s * 0.26, 0, 0); cup.rotation.z = Math.PI / 2; });
  },
  hat_flowers: function(g) {
    var ring = _cosAdd(g, new THREE.TorusGeometry(0.22, 0.025, 8, 28), _cosM(0x3a8a2a), 0, 0.01, 0); ring.rotation.x = Math.PI / 2;
    var cols = [0xff7ab8, 0xffd23a, 0xffffff, 0xb48aff, 0xff5a5a];
    for (var i = 0; i < 9; i++) { var a = i / 9 * Math.PI * 2; _cosAdd(g, new THREE.SphereGeometry(0.05, 10, 8), _cosM(cols[i % cols.length]), Math.cos(a) * 0.22, 0.03, Math.sin(a) * 0.22); }
  },
  hat_crown: function(g) {
    var gold = _cosM(0xffc83a, { metalness: 0.75, roughness: 0.28, emissive: new THREE.Color(0x3a2400) });
    _cosAdd(g, new THREE.CylinderGeometry(0.2, 0.2, 0.1, 24, 1, true), gold, 0, 0.04, 0).material.side = THREE.DoubleSide;
    for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; _cosAdd(g, new THREE.ConeGeometry(0.04, 0.11, 6), gold, Math.cos(a) * 0.2, 0.14, Math.sin(a) * 0.2); _cosAdd(g, new THREE.SphereGeometry(0.022, 8, 6), _cosM([0xff2a4a, 0x2a8aff, 0x3aff8a][i % 3], { roughness: 0.1 }), Math.cos(a) * 0.205, 0.04, Math.sin(a) * 0.205); }
  },
  hat_viking: function(g) {
    var steel = _cosM(0xa8b0b8, { metalness: 0.9, roughness: 0.3 }), horn = _cosM(0xf0e8d0, { roughness: 0.6 });
    var h = _cosAdd(g, new THREE.SphereGeometry(0.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, -0.06, 0); h.scale.y = 0.75;
    [-1, 1].forEach(function(s) { var c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(s * 0.2, 0, 0), new THREE.Vector3(s * 0.4, 0.05, 0), new THREE.Vector3(s * 0.38, 0.28, 0)); _cosAdd(g, new THREE.TubeGeometry(c, 10, 0.04, 8, false), horn); });
  },
  hat_wizard: function(g) {
    var pur = _cosM(0x4a2a9a, { roughness: 0.7 });
    _cosAdd(g, new THREE.CylinderGeometry(0.34, 0.34, 0.02, 32), pur, 0, 0.0, 0);
    var c = _cosAdd(g, new THREE.ConeGeometry(0.19, 0.6, 24), pur, 0.03, 0.3, 0); c.rotation.z = -0.18;
    for (var i = 0; i < 6; i++) _cosAdd(g, new THREE.OctahedronGeometry(0.03, 0), _cosM(0xffe14a, { emissive: new THREE.Color(0xffc800), emissiveIntensity: 0.6 }), Math.cos(i * 1.7) * 0.13, 0.1 + i * 0.06, Math.sin(i * 1.7) * 0.13);
  },
  hat_sombrero: function(g) {
    var straw = _cosM(0xe8c060, { roughness: 0.9 });
    var b = _cosAdd(g, new THREE.CylinderGeometry(0.52, 0.5, 0.03, 36), straw, 0, 0.0, 0);
    _cosAdd(g, new THREE.ConeGeometry(0.18, 0.3, 24), straw, 0, 0.15, 0);
    _cosAdd(g, new THREE.CylinderGeometry(0.15, 0.17, 0.05, 24), _cosM(0xd8302a), 0, 0.06, 0);
    var rim = _cosAdd(g, new THREE.TorusGeometry(0.51, 0.025, 8, 36), _cosM(0x3a9a3a), 0, 0.01, 0); rim.rotation.x = Math.PI / 2;
  },
  hat_astro: function(g) {
    var glass = new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, clearcoat: 1, depthWrite: false });
    _cosAdd(g, new THREE.SphereGeometry(0.4, 28, 20), glass, 0, -0.22, 0);
    var ring = _cosAdd(g, new THREE.TorusGeometry(0.3, 0.05, 10, 28), _cosM(0xe8e8e8, { metalness: 0.6, roughness: 0.3 }), 0, -0.52, 0); ring.rotation.x = Math.PI / 2;
  },
  hat_halo: function(g) {
    var h = _cosAdd(g, new THREE.TorusGeometry(0.2, 0.025, 10, 36), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: new THREE.Color(0xffd040), emissiveIntensity: 2.2 }), 0, 0.18, 0);
    h.rotation.x = Math.PI / 2;
    COS._anim.push({ o: h, f: function(o, t) { o.position.y = 0.18 + Math.sin(t * 2) * 0.03; o.rotation.z = t * 0.6; } });
  },
  // Modelled like the rest: y = 0 on the crown, a head about 0.42 wide, +z is the face
  hat_cap: function(g) {   // worn backwards, obviously
    var blu = _cosM(0x2a6aff, { roughness: 0.6 });
    var d = _cosAdd(g, new THREE.SphereGeometry(0.235, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), blu, 0, -0.07, 0); d.scale.y = 0.6;
    var bill = _cosAdd(g, new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24, 1, false, Math.PI * 0.5, Math.PI), _cosM(0xffffff, { roughness: 0.6 }), 0, -0.07, -0.13); bill.scale.set(1, 1, 0.75);
    _cosAdd(g, new THREE.SphereGeometry(0.025, 8, 6), _cosM(0xffffff), 0, 0.075, 0);
  },
  hat_beanie: function(g) {
    var a = _cosM(0xff5a3a, { roughness: 0.95 }), b = _cosM(0xffd23a, { roughness: 0.95 });
    var d = _cosAdd(g, new THREE.SphereGeometry(0.24, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), a, 0, -0.09, 0); d.scale.y = 0.85;
    var cuff = _cosAdd(g, new THREE.TorusGeometry(0.235, 0.05, 10, 32), b, 0, -0.1, 0); cuff.rotation.x = Math.PI / 2;
    var band = _cosAdd(g, new THREE.TorusGeometry(0.205, 0.02, 8, 32), b, 0, 0.0, 0); band.rotation.x = Math.PI / 2;
    _cosAdd(g, new THREE.IcosahedronGeometry(0.075, 1), b, 0, 0.13, 0);
  },
  hat_bucket: function(g) {
    var m = _cosM(0x6a9a5a, { roughness: 0.9, side: THREE.DoubleSide });
    _cosAdd(g, new THREE.CylinderGeometry(0.17, 0.215, 0.16, 28), m, 0, 0.05, 0);
    _cosAdd(g, new THREE.CylinderGeometry(0.215, 0.33, 0.07, 32, 1, true), m, 0, -0.06, 0);
    _cosAdd(g, new THREE.CylinderGeometry(0.218, 0.218, 0.03, 28), _cosM(0xe8e0c8), 0, -0.01, 0);
  },
  hat_fez: function(g) {
    var red = _cosM(0xc8202a, { roughness: 0.7 });
    _cosAdd(g, new THREE.CylinderGeometry(0.115, 0.15, 0.2, 24), red, 0, 0.09, 0);
    var t = _cosAdd(g, new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), _cosM(0x1a1a1a), 0.07, 0.13, 0); t.rotation.z = 0.9;
    _cosAdd(g, new THREE.ConeGeometry(0.025, 0.07, 8), _cosM(0x1a1a1a), 0.13, 0.05, 0);
  },
  hat_boppers: function(g) {
    var band = _cosAdd(g, new THREE.TorusGeometry(0.23, 0.02, 8, 24, Math.PI), _cosM(0x8a3aff), 0, -0.13, 0); band.rotation.y = Math.PI / 2;
    [-1, 1].forEach(function(sg) {
      var st = new THREE.Group(); st.position.set(sg * 0.1, 0.06, 0); g.add(st);
      var stalk = _cosAdd(st, new THREE.CylinderGeometry(0.01, 0.01, 0.24, 6), _cosM(0x2a2a2a), 0, 0.1, 0); stalk.rotation.z = -sg * 0.25; stalk.position.x = sg * 0.03;
      _cosAdd(st, new THREE.SphereGeometry(0.05, 12, 10), _cosM(0x5aff5a, { emissive: new THREE.Color(0x2aff4a), emissiveIntensity: 0.8 }), sg * 0.06, 0.23, 0);
      COS._anim.push({ o: st, f: function(o, t) { o.rotation.z = Math.sin(t * 7 + sg) * 0.18; o.rotation.x = Math.cos(t * 5.3 + sg) * 0.12; } });
    });
  },
  hat_chef: function(g) {
    var w = _cosM(0xfafafa, { roughness: 0.8 });
    _cosAdd(g, new THREE.CylinderGeometry(0.2, 0.2, 0.14, 28), w, 0, 0.05, 0);
    [[0, 0.26, 0, 0.14], [0.1, 0.22, 0.06, 0.11], [-0.1, 0.22, 0.06, 0.11], [0.08, 0.22, -0.08, 0.11], [-0.08, 0.22, -0.08, 0.11], [0, 0.21, 0.11, 0.1]].forEach(function(e) { _cosAdd(g, new THREE.IcosahedronGeometry(e[3], 2), w, e[0], e[1], e[2]); });
  },
  hat_santa: function(g) {
    var red = _cosM(0xd8202a, { roughness: 0.8 }), fur = _cosM(0xffffff, { roughness: 1 });
    var c = _cosAdd(g, new THREE.ConeGeometry(0.2, 0.42, 24), red, -0.05, 0.17, -0.02); c.rotation.z = 0.55;
    var rim = _cosAdd(g, new THREE.TorusGeometry(0.21, 0.055, 10, 30), fur, 0, -0.01, 0); rim.rotation.x = Math.PI / 2;
    _cosAdd(g, new THREE.IcosahedronGeometry(0.065, 1), fur, -0.22, 0.27, -0.02);
  },
  hat_grad: function(g) {
    var blk = _cosM(0x16161c, { roughness: 0.6 });
    _cosAdd(g, new THREE.CylinderGeometry(0.19, 0.2, 0.1, 24), blk, 0, 0.03, 0);
    var b = _cosAdd(g, new THREE.BoxGeometry(0.5, 0.025, 0.5), blk, 0, 0.09, 0); b.rotation.y = Math.PI / 4;
    _cosAdd(g, new THREE.CylinderGeometry(0.025, 0.025, 0.02, 10), _cosM(0xffc83a), 0, 0.11, 0);
    var tas = new THREE.Group(); tas.position.set(0, 0.11, 0); g.add(tas);
    var cord = _cosAdd(tas, new THREE.CylinderGeometry(0.006, 0.006, 0.24, 5), _cosM(0xffc83a), 0.12, 0, 0.12); cord.rotation.set(Math.PI / 2, 0, 0); cord.rotation.y = Math.PI / 4;
    var hang = _cosAdd(tas, new THREE.CylinderGeometry(0.012, 0.03, 0.12, 8), _cosM(0xffc83a), 0.17, -0.07, 0.17);
    COS._anim.push({ o: tas, f: function(o, t) { o.rotation.y = Math.sin(t * 2.2) * 0.12; } });
  },
  hat_nest: function(g) {
    var tw = _cosM(0x7a5228, { roughness: 1 }), r = _gfxRng(5);
    var n = _cosAdd(g, new THREE.TorusGeometry(0.17, 0.06, 8, 20), tw, 0, 0.03, 0); n.rotation.x = Math.PI / 2;
    for (var i = 0; i < 22; i++) { var a = r() * 6.283, st = _cosAdd(g, new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), tw, Math.cos(a) * 0.17, 0.03 + (r() - 0.5) * 0.05, Math.sin(a) * 0.17); st.rotation.set(r() * 3, r() * 3, r() * 3); }
    var chick = new THREE.Group(); chick.position.y = 0.06; g.add(chick);
    var yel = _cosM(0xffe03a, { roughness: 0.7 });
    _cosAdd(chick, new THREE.SphereGeometry(0.08, 14, 10), yel, 0, 0.03, 0);
    _cosAdd(chick, new THREE.SphereGeometry(0.055, 12, 10), yel, 0, 0.12, 0.02);
    _cosAdd(chick, new THREE.ConeGeometry(0.02, 0.05, 8), _cosM(0xff8a1a), 0, 0.12, 0.08).rotation.x = Math.PI / 2;
    [-1, 1].forEach(function(sg) { _cosAdd(chick, new THREE.SphereGeometry(0.01, 6, 5), _cosM(0x000000), sg * 0.025, 0.14, 0.065); });
    COS._anim.push({ o: chick, f: function(o, t) { o.position.y = 0.06 + Math.abs(Math.sin(t * 3)) * 0.03; o.rotation.y = Math.sin(t * 1.3) * 0.8; } });
  },
  hat_duckie: function(g) {
    var duck = new THREE.Group(); g.add(duck);
    var yel = _cosM(0xffd21a, { roughness: 0.25 });
    var b = _cosAdd(duck, new THREE.SphereGeometry(0.15, 18, 12), yel, 0, 0.09, -0.02); b.scale.set(1, 0.72, 1.25);
    var tail = _cosAdd(duck, new THREE.ConeGeometry(0.06, 0.1, 10), yel, 0, 0.14, -0.18); tail.rotation.x = -0.9;
    _cosAdd(duck, new THREE.SphereGeometry(0.095, 16, 12), yel, 0, 0.23, 0.08);
    var bk = _cosAdd(duck, new THREE.SphereGeometry(0.05, 10, 8), _cosM(0xff7a1a, { roughness: 0.3 }), 0, 0.21, 0.17); bk.scale.set(1.2, 0.45, 1);
    [-1, 1].forEach(function(sg) { _cosAdd(duck, new THREE.SphereGeometry(0.017, 8, 6), _cosM(0x101010), sg * 0.05, 0.26, 0.15); });
    COS._anim.push({ o: duck, f: function(o, t) { o.rotation.z = Math.sin(t * 2.4) * 0.12; o.rotation.x = Math.sin(t * 1.7) * 0.06; } });
  },
  hat_tiara: function(g) {
    var gold = _cosM(0xffd8a0, { metalness: 0.85, roughness: 0.2 });
    var band = _cosAdd(g, new THREE.TorusGeometry(0.2, 0.014, 8, 28, Math.PI), gold, 0, -0.03, 0); band.rotation.x = Math.PI / 2; band.rotation.z = Math.PI; band.rotation.y = 0; band.scale.y = 1.05;
    for (var i = -2; i <= 2; i++) { var a = i * 0.32, h = i === 0 ? 0.11 : 0.06 - Math.abs(i) * 0.01; var sp = _cosAdd(g, new THREE.ConeGeometry(0.02, h, 6), gold, Math.sin(a) * 0.2, -0.03 + h / 2, Math.cos(a) * 0.2); sp.rotation.x = 0.35 * Math.cos(a); }
    _cosAdd(g, new THREE.OctahedronGeometry(0.03, 0), _cosM(0xff3a9a, { roughness: 0.05, metalness: 0.2, emissive: new THREE.Color(0x60002a) }), 0, 0.02, 0.21);
    [-1, 1].forEach(function(sg) { _cosAdd(g, new THREE.OctahedronGeometry(0.018, 0), _cosM(0x3ad8ff, { roughness: 0.05 }), Math.sin(sg * 0.5) * 0.2, -0.01, Math.cos(0.5) * 0.2); });
  },
  hat_unicorn: function(g) {
    var horn = new THREE.Group(); horn.position.set(0, 0.0, 0.1); horn.rotation.x = 0.45; g.add(horn);
    _cosAdd(horn, new THREE.ConeGeometry(0.055, 0.32, 16), _cosM(0xfff0c8, { metalness: 0.4, roughness: 0.25, emissive: new THREE.Color(0x3a2a10) }), 0, 0.16, 0);
    var pts = []; for (var i = 0; i <= 40; i++) { var k = i / 40, r = 0.056 * (1 - k) + 0.004; pts.push(new THREE.Vector3(Math.cos(k * 18) * r, k * 0.31, Math.sin(k * 18) * r)); }
    _cosAdd(horn, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.008, 5, false), _cosM(0xff8ad8, { emissive: new THREE.Color(0x401030) }));
    var cols = [0xff6ab0, 0xffd23a, 0x6ae0ff, 0xb08aff];
    for (var j = 0; j < 4; j++) { var m = _cosAdd(g, new THREE.SphereGeometry(0.06, 10, 8), _cosM(cols[j], { roughness: 0.6 }), 0, -0.02 - j * 0.02, -0.02 - j * 0.07); m.scale.set(0.6, 1, 1.4); }
  },
  hat_jester: function(g) {
    var cols = [0xd8202a, 0xffc83a, 0x3a5aff];
    var d = _cosAdd(g, new THREE.SphereGeometry(0.235, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), _cosM(0x6a2a9a, { roughness: 0.8 }), 0, -0.07, 0); d.scale.y = 0.62;
    [-1, 0, 1].forEach(function(k, i) {
      var a = k * 1.05, ex = new THREE.Vector3(Math.sin(a) * 0.36, 0.2, Math.cos(a) * 0.36 - 0.05);
      var c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(Math.sin(a) * 0.1, 0.02, Math.cos(a) * 0.1 - 0.04), new THREE.Vector3(Math.sin(a) * 0.22, 0.32, Math.cos(a) * 0.22 - 0.05), ex);
      _cosAdd(g, new THREE.TubeGeometry(c, 12, 0.045, 8, false), _cosM(cols[i], { roughness: 0.8 }));
      var bell = new THREE.Group(); bell.position.copy(ex); g.add(bell);
      _cosAdd(bell, new THREE.SphereGeometry(0.04, 10, 8), _cosM(0xffd23a, { metalness: 0.9, roughness: 0.2 }), 0, -0.03, 0);
      COS._anim.push({ o: bell, f: function(o, t) { o.rotation.z = Math.sin(t * 6 + i * 2) * 0.4; } });
    });
  },
  hat_knight: function(g) {
    var steel = _cosM(0xb8c0c8, { metalness: 0.9, roughness: 0.28 });
    var h = _cosAdd(g, new THREE.SphereGeometry(0.27, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), steel, 0, -0.2, 0); h.scale.set(1, 1.08, 1.05);
    _cosAdd(g, new THREE.BoxGeometry(0.3, 0.035, 0.05), _cosM(0x0a0a10), 0, -0.2, 0.26);
    var ridge = _cosAdd(g, new THREE.BoxGeometry(0.03, 0.08, 0.5), steel, 0, 0.06, -0.02); ridge.rotation.x = 0.1;
    var pl = new THREE.Group(); pl.position.set(0, 0.08, -0.05); g.add(pl);
    for (var i = 0; i < 6; i++) { var f = _cosAdd(pl, new THREE.SphereGeometry(0.06, 10, 8), _cosM(0xd8202a, { roughness: 0.9 }), 0, 0.06 + i * 0.012, -i * 0.05); f.scale.set(0.5, 1.6 - i * 0.12, 1.2); }
    COS._anim.push({ o: pl, f: function(o, t) { o.rotation.x = Math.sin(t * 3) * 0.08; } });
  },
  hat_mohawk: function(g) {
    for (var i = 0; i < 7; i++) {
      var k = i / 6, z = 0.2 - k * 0.42, h = 0.2 + Math.sin(k * Math.PI) * 0.12;
      var c = _cosAdd(g, new THREE.ConeGeometry(0.05, h, 10), _cosM(new THREE.Color().setHSL(k * 0.8, 0.95, 0.55).getHex(), { roughness: 0.6 }), 0, -0.03 + h / 2, z);
      c.rotation.x = -0.35 + k * 0.7; c.scale.z = 0.5;
    }
  },
  hat_fire: function(g) {   // layered tongues: red outside, orange, a yellow core (not additive — that just burns out to white)
    var layers = [[0xe8280a, 0.11, 0.3, 7, 0.13], [0xff7a12, 0.085, 0.36, 5, 0.07], [0xffd23a, 0.07, 0.3, 3, 0.02]];
    layers.forEach(function(L, li) {
      var mat = new THREE.MeshBasicMaterial({ color: L[0], transparent: true, opacity: 0.92, depthWrite: li === 0, toneMapped: false });
      for (var i = 0; i < L[3]; i++) {
        var a = i / L[3] * Math.PI * 2 + li, f = _cosAdd(g, new THREE.ConeGeometry(L[1], L[2], 8), mat, Math.cos(a) * L[4], 0.0, Math.sin(a) * L[4]);
        f.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
        (function(f, ph, h) { COS._anim.push({ o: f, f: function(o, t) { var k = 0.7 + Math.abs(Math.sin(t * 8 + ph)) * 0.55; o.scale.set(1, k, 1); o.position.y = h * k * 0.5 - 0.02; } }); })(f, i * 1.7 + li, L[2]);
      }
    });
  },
};
// ── Back items ── modelled for a torso 0.4 wide, origin on the middle of the back, the body
// toward +z (so they hang off toward −z). k.top = how far up the shoulders are, in item units.
function _cosLine(g, a, b, r, mat) { var d = new THREE.Vector3().subVectors(b, a), m = _cosAdd(g, new THREE.CylinderGeometry(r, r, d.length(), 5), mat); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; }
function _cosWing(g, side, shape, mat, flap, sp) {
  var w = new THREE.Group(); w.position.set(side * 0.03, 0, -0.07); g.add(w);
  var geo = new THREE.ShapeGeometry(shape, 16); if (side < 0) geo.scale(-1, 1, 1);
  _cosAdd(w, geo, mat);
  COS._anim.push({ o: w, f: function(o, t) { o.rotation.y = -side * (flap[0] + Math.sin(t * sp) * flap[1]); } });
  return w;
}
COS.BACKS = {
  back_bag: function(g, k) {
    var bag = _cosM(0x2a6a9a, { roughness: 0.8 }), trim = _cosM(0x16161c, { roughness: 0.7 });
    _cosAdd(g, new THREE.BoxGeometry(0.3, 0.44, 0.15), bag, 0, -0.02, -0.08);
    _cosAdd(g, new THREE.BoxGeometry(0.31, 0.05, 0.16), trim, 0, 0.18, -0.08);
    _cosAdd(g, new THREE.BoxGeometry(0.22, 0.16, 0.04), _cosM(0x3a8ac8, { roughness: 0.8 }), 0, -0.1, -0.17);
    [[-0.08, 0xff3a8a, -0.2], [0, 0xffd23a, 0.05], [0.08, 0x3aff8a, 0.25]].forEach(function(e) { var d = _cosAdd(g, new THREE.CylinderGeometry(0.11, 0.11, 0.025, 24), _cosM(e[1], { roughness: 0.35 }), e[0], 0.26, -0.08); d.rotation.set(Math.PI / 2, 0, Math.PI / 2 + e[2]); });
  },
  back_shell: function(g, k) {
    var sh = _cosAdd(g, new THREE.SphereGeometry(0.27, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), _cosM(0x3a7a2a, { roughness: 0.7 }), 0, 0, -0.02); sh.rotation.x = -Math.PI / 2; sh.scale.set(1, 1, 0.55);
    var rim = _cosAdd(g, new THREE.TorusGeometry(0.27, 0.03, 8, 30), _cosM(0xd8c070, { roughness: 0.8 }), 0, 0, -0.02);
    var sc = _cosM(0x5aa83a, { roughness: 0.6 });
    _cosAdd(g, new THREE.CylinderGeometry(0.085, 0.085, 0.02, 6), sc, 0, 0, -0.165).rotation.x = Math.PI / 2;
    for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2, h = _cosAdd(g, new THREE.CylinderGeometry(0.07, 0.07, 0.02, 6), sc, Math.cos(a) * 0.16, Math.sin(a) * 0.16, -0.12); h.lookAt(new THREE.Vector3(Math.cos(a) * 0.5, Math.sin(a) * 0.5, -0.4)); h.rotateX(Math.PI / 2); }
  },
  back_balloon: function(g, k) {
    var b = new THREE.Group(); b.position.set(0.05, 0.05, -0.05); g.add(b);
    var top = new THREE.Vector3(0.1, 0.85 + k.top, -0.2);
    _cosLine(b, new THREE.Vector3(0, 0, 0), top, 0.004, _cosM(0xffffff));
    var bal = _cosAdd(b, new THREE.SphereGeometry(0.16, 20, 14), _cosM(0xff2a4a, { roughness: 0.15, metalness: 0.1 }), top.x, top.y + 0.17, top.z); bal.scale.y = 1.15;
    _cosAdd(b, new THREE.ConeGeometry(0.025, 0.04, 8), _cosM(0xff2a4a), top.x, top.y + 0.005, top.z);
    COS._anim.push({ o: b, f: function(o, t) { o.rotation.z = Math.sin(t * 1.3) * 0.12; o.rotation.x = -0.05 + Math.sin(t * 0.9) * 0.08; } });
  },
  back_cape: function(g, k) {
    var c = new THREE.Group(); c.position.set(0, k.top * 0.9, 0.0); g.add(c);
    var len = Math.min(1.0, ((k.down || 1.2) + k.top * 0.9) * 0.78);   // short legs, short cape: it never drags on the ground
    var geo = new THREE.PlaneGeometry(0.44, len, 4, 10); geo.translate(0, -len / 2, 0);
    var p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) { var y = -p.getY(i); p.setX(i, p.getX(i) * (1 + y * 0.55)); p.setZ(i, -0.03 - y * y * 0.06 - Math.abs(p.getX(i)) * 0.15); }
    geo.computeVertexNormals();
    _cosAdd(c, geo, _cosM(0xd8202a, { roughness: 0.7, side: THREE.DoubleSide }));
    [-1, 1].forEach(function(sg) { _cosAdd(c, new THREE.SphereGeometry(0.035, 10, 8), _cosM(0xffc83a, { metalness: 0.8, roughness: 0.3 }), sg * 0.2, 0, 0.01); });
    COS._anim.push({ o: c, f: function(o, t) { o.rotation.x = 0.14 + Math.sin(t * 2.3) * 0.06; o.rotation.z = Math.sin(t * 1.7) * 0.04; } });
  },
  back_butterfly: function(g, k) {
    var up = new THREE.Shape(); up.moveTo(0, 0); up.bezierCurveTo(0.1, 0.35, 0.42, 0.42, 0.44, 0.22); up.bezierCurveTo(0.45, 0.06, 0.2, 0.0, 0, 0);
    var lo = new THREE.Shape(); lo.moveTo(0, -0.02); lo.bezierCurveTo(0.25, -0.02, 0.34, -0.2, 0.24, -0.3); lo.bezierCurveTo(0.12, -0.36, 0.04, -0.2, 0, -0.02);
    var m1 = _cosM(0x3ab0ff, { side: THREE.DoubleSide, transparent: true, opacity: 0.88, emissive: new THREE.Color(0x0a3a6a), roughness: 0.4 });
    var m2 = _cosM(0xff8ad8, { side: THREE.DoubleSide, transparent: true, opacity: 0.88, emissive: new THREE.Color(0x4a0a3a), roughness: 0.4 });
    var yk = k.top * 0.35;
    [-1, 1].forEach(function(sg) {
      var w = _cosWing(g, sg, up, m1, [0.35, 0.4], 7); w.position.y = yk;
      var geo = new THREE.ShapeGeometry(lo, 12); if (sg < 0) geo.scale(-1, 1, 1); _cosAdd(w, geo, m2);
      [[0.3, 0.2, 0.045], [0.18, -0.15, 0.035]].forEach(function(d) { _cosAdd(w, new THREE.CircleGeometry(d[2], 12), _cosM(0xffffff, { side: THREE.DoubleSide }), sg * d[0], d[1], 0.002); });
    });
  },
  back_fin: function(g, k) {
    var s = new THREE.Shape(); s.moveTo(0, -0.2); s.quadraticCurveTo(0.06, 0.18, 0.32, 0.4); s.quadraticCurveTo(0.18, 0.08, 0.2, -0.2); s.lineTo(0, -0.2);
    var geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 12 });
    geo.rotateY(Math.PI / 2); geo.translate(-0.025, k.top * 0.2, -0.02);
    _cosAdd(g, geo, _cosM(0x6a8aa8, { roughness: 0.45 }));
  },
  back_bat: function(g, k) {
    var s = new THREE.Shape(); s.moveTo(0, 0.05); s.quadraticCurveTo(0.25, 0.35, 0.62, 0.3);
    s.quadraticCurveTo(0.5, 0.12, 0.52, 0.0); s.quadraticCurveTo(0.4, 0.06, 0.36, -0.08); s.quadraticCurveTo(0.26, -0.0, 0.2, -0.12); s.quadraticCurveTo(0.12, -0.02, 0, -0.06); s.lineTo(0, 0.05);
    var m = _cosM(0x3a1a4a, { side: THREE.DoubleSide, roughness: 0.6, emissive: new THREE.Color(0x14001e) });
    [-1, 1].forEach(function(sg) { var w = _cosWing(g, sg, s, m, [0.3, 0.32], 3.6); w.position.y = k.top * 0.45; _cosLine(w, new THREE.Vector3(0, 0.04, 0.005), new THREE.Vector3(sg * 0.62, 0.3, 0.005), 0.012, _cosM(0x22102a)); });
  },
  back_jetpack: function(g, k) {
    var red = _cosM(0xd8302a, { metalness: 0.6, roughness: 0.3 }), grey = _cosM(0x8a96a2, { metalness: 0.8, roughness: 0.3 });
    _cosAdd(g, new THREE.BoxGeometry(0.3, 0.32, 0.04), grey, 0, 0.02, -0.03);
    [-1, 1].forEach(function(sg) {
      _cosAdd(g, new THREE.CylinderGeometry(0.075, 0.075, 0.34, 18), red, sg * 0.09, 0.03, -0.11);
      _cosAdd(g, new THREE.SphereGeometry(0.075, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), red, sg * 0.09, 0.2, -0.11);
      var nz = _cosAdd(g, new THREE.ConeGeometry(0.055, 0.08, 14, 1, true), _cosM(0x2a2a30, { metalness: 0.7, side: THREE.DoubleSide }), sg * 0.09, -0.17, -0.11);
      var fl = _cosAdd(g, new THREE.ConeGeometry(0.05, 0.22, 12), new THREE.MeshBasicMaterial({ color: 0xff8a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), sg * 0.09, -0.31, -0.11);
      fl.rotation.x = Math.PI;
      (function(fl, ph) { COS._anim.push({ o: fl, f: function(o, t) { var q = 0.7 + Math.abs(Math.sin(t * 23 + ph)) * 0.5; o.scale.set(1, q, 1); o.position.y = -0.21 - 0.11 * q; } }); })(fl, sg);
    });
  },
  back_angel: function(g, k) {
    var mat = _cosM(0xffffff, { roughness: 0.55, emissive: new THREE.Color(0xfff0c8), emissiveIntensity: 0.35 });
    [-1, 1].forEach(function(sg) {
      var w = new THREE.Group(); w.position.set(sg * 0.04, k.top * 0.5, -0.08); g.add(w);
      [[0.62, 9, 0.0], [0.42, 7, 0.012], [0.25, 5, 0.024]].forEach(function(row) {
        for (var i = 0; i < row[1]; i++) {
          var a = 1.0 - i * (1.55 / row[1]), L = row[0] * (1 - i * 0.05), f = _cosAdd(w, new THREE.SphereGeometry(1, 10, 6), mat, sg * Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.5, -row[2]);
          f.rotation.z = sg * a; f.scale.set(L * 0.5, 0.045, 0.018);
        }
      });
      COS._anim.push({ o: w, f: function(o, t) { o.rotation.y = -sg * (0.25 + Math.sin(t * 2.2) * 0.22); } });
    });
  },
};
COS.buildBack = function(id, k) { var g = new THREE.Group(); g.name = "cos_back"; if (COS.BACKS[id]) COS.BACKS[id](g, k || { top: 0.25, down: 1.2 }); g.traverse(function(m) { if (m.isMesh) { m.castShadow = true; m.userData.cosHat = true; } }); return g; };
COS.buildHat = function(id) { var g = new THREE.Group(); g.name = "cos_hat"; if (COS.HATS[id]) COS.HATS[id](g); g.traverse(function(m) { if (m.isMesh) { m.castShadow = true; m.userData.cosHat = true; } }); return g; };

// Apply hat + finish + aura to a loaded character (wrapper group from buildPlayerAvatar)
COS.dressAvatar = function(av, cos) {
  if (!av) return;
  cos = cos || {};
  var glb = null; av.children.forEach(function(c) { if (c.name !== "cos_hat" && c.name !== "cos_back" && !glb) glb = c; });
  if (!glb) return;
  if (typeof ANIM !== "undefined") ANIM.ungoofy(av);   // fit the hat to the real skull; the bobblehead comes back next frame
  // remove a previous hat / back item
  var old = []; av.traverse(function(o) { if (o.name === "cos_hat" || o.name === "cos_back") old.push(o); }); old.forEach(function(o) { o.parent.remove(o); });
  // finish: restore original materials, then apply
  glb.traverse(function(m) { if (m.isMesh && m.userData._cosOrig) { m.material = m.userData._cosOrig; delete m.userData._cosOrig; } });
  if (cos.finish) COS.applyFinish(glb, cos.finish);
  av.userData.aura = cos.aura ? (COS.style(cos.aura) || {}).fx : null;
  if (cos.back) COS._wearBack(av, glb, cos.back);
  if (!cos.hat) { if (typeof ANIM !== "undefined") ANIM.goofy(av); return; }
  var hat = COS.buildHat(cos.hat);
  // Find the head bone (hats follow head-bob animations); fall back to the top of the model
  var head = null; glb.traverse(function(o) { if (!head && o.isBone && /^(mixamorig:)?head$/i.test(o.name)) head = o; });
  av.updateMatrixWorld(true);
  var box = new THREE.Box3().setFromObject(glb), top = box.max.y;
  if (head) {
    var hp = new THREE.Vector3(); head.getWorldPosition(hp);
    var ws = new THREE.Vector3(); head.getWorldScale(ws);
    var qb = new THREE.Quaternion(); head.getWorldQuaternion(qb);
    var qa = new THREE.Quaternion(); av.getWorldQuaternion(qa);
    // Fit to the skull: hats are modelled for a head ~0.42 m wide with y = 0 on top
    var fit = COS.headFit(glb, head, hp, qa), size = 1, at = new THREE.Vector3(hp.x, top - 0.02, hp.z);
    if (fit) { size = fit.halfW / 0.21; at.set(fit.cx, fit.top - 0.02 * size, fit.cz).applyQuaternion(qa).add(hp); }
    COS._placeHat(hat, cos.hat, fit, size, at, qa, hp, ws);
    hat.position.copy(head.worldToLocal(at));
    hat.quaternion.copy(qb.invert().multiply(qa));
    head.add(hat);
  } else {
    var ap = new THREE.Vector3(); av.getWorldPosition(ap);
    var aq = new THREE.Quaternion(); av.getWorldQuaternion(aq);
    var as = new THREE.Vector3(); av.getWorldScale(as);
    var tf = COS.topFit(glb, ap, aq);
    if (tf) {
      var sz = tf.halfW / 0.21, lat = new THREE.Vector3(tf.cx, tf.top - 0.02 * sz, tf.cz);
      COS._placeHat(hat, cos.hat, tf, sz, lat, new THREE.Quaternion(), new THREE.Vector3(), as);   // (already in the avatar's own frame)
      hat.position.set(lat.x / as.x, lat.y / as.y, lat.z / as.z);
    }
    else { var lp = av.worldToLocal(new THREE.Vector3(0, top, 0)); hat.position.set(0, lp.y - 0.02, 0); }
    av.add(hat);
  }
  if (typeof ANIM !== "undefined") ANIM.goofy(av);
};
// Strap a back item to the upper torso. Sized from the shoulder span and placed on the real,
// posed surface of the back (built-in backpacks and shells included), so it fits a skinny agent,
// a chibi pirate, a rigid robot or an unrigged duck alike.
COS._wearBack = function(av, glb, id) {
  var fit = COS.backFit(av, glb); if (!fit) return;
  var qa = new THREE.Quaternion(); av.getWorldQuaternion(qa);
  var size = Math.max(0.25, fit.halfW / 0.2), item = COS.buildBack(id, { top: Math.max(0.05, (fit.y1 - fit.cy) / size), down: Math.max(0.2, fit.cy / size) });
  var at = av.localToWorld(new THREE.Vector3(fit.cx, fit.cy, fit.zb).divide(av.getWorldScale(new THREE.Vector3()))), par = fit.bone || av;
  var ws = new THREE.Vector3(); par.getWorldScale(ws);
  var qb = new THREE.Quaternion(); par.getWorldQuaternion(qb);
  item.position.copy(par.worldToLocal(at));
  item.scale.setScalar(size / ws.x);
  item.quaternion.copy(qb.invert().multiply(qa));
  par.add(item);
};
// In the avatar's frame (metres, +z forward): the torso band between the hips and the shoulders,
// its back surface (low z, from every posed vertex in the band), centre and half width
COS.backFit = function(av, glb) {
  av.updateMatrixWorld(true);
  var qa = new THREE.Quaternion(), qi, origin = new THREE.Vector3(), v = new THREE.Vector3();
  av.getWorldQuaternion(qa); qi = qa.clone().invert(); av.getWorldPosition(origin);
  var loc = function(w) { return w.sub(origin).applyQuaternion(qi); };
  var R = typeof RAG !== "undefined" ? RAG.rig(glb) : null, pts = [];
  glb.traverse(function(m) {
    if (!m.isMesh || m.userData.cosHat || !m.geometry || !m.geometry.attributes.position) return;
    var pos = m.geometry.attributes.position, st = Math.max(1, Math.floor(pos.count / 5000)), sk = m.isSkinnedMesh && m.skeleton && m.boneTransform;
    for (var i = 0; i < pos.count; i += st) {
      if (sk) m.boneTransform(i, v); else v.fromBufferAttribute(pos, i);
      pts.push(loc(v.applyMatrix4(m.matrixWorld)).clone());
    }
  });
  if (pts.length < 40) return null;
  var yTop, yBot, cx = 0, halfW, bone = null;
  if (R) {
    var sl = loc(R.uaL.getWorldPosition(new THREE.Vector3())), sr = loc(R.uaR.getWorldPosition(new THREE.Vector3())), hp = loc(R.hips.getWorldPosition(new THREE.Vector3()));
    yTop = (sl.y + sr.y) / 2; yBot = hp.y + (yTop - hp.y) * 0.3; cx = (sl.x + sr.x) / 2; halfW = Math.abs(sl.x - sr.x) / 2 * 1.05;
    bone = R.neck && R.neck.parent && R.neck.parent.isBone ? R.neck.parent : null;   // the upper chest, whatever the rig calls it
  } else {
    var lo = Infinity, hi = -Infinity, x0 = Infinity, x1 = -Infinity;
    pts.forEach(function(p) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); });
    yTop = lo + (hi - lo) * 0.7; yBot = lo + (hi - lo) * 0.4;
    pts.forEach(function(p) { if (p.y > yBot && p.y < yTop) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); } });
    cx = (x0 + x1) / 2; halfW = (x1 - x0) / 2 * 0.8;
  }
  var band = pts.filter(function(p) { return p.y > yBot && p.y < yTop + (yTop - yBot) * 0.1 && Math.abs(p.x - cx) < halfW * 0.8; });
  if (band.length < 10) return null;
  var zs = band.map(function(p) { return p.z; }).sort(function(a, b) { return a - b; });
  return { cx: cx, cy: (yBot + yTop) / 2 + (yTop - yBot) * 0.1, y1: yTop, zb: zs[Math.floor(zs.length * 0.02)], halfW: halfW, bone: bone };
};
// Measure the skull from the vertices skinned to the head bone, in the avatar's frame
// (origin at the head bone). Spiky or tall hair is ignored: the "top" is the highest
// slice that is still nearly as wide as the head, so hats sit on the crown, not on a quiff.
COS.headFit = function(glb, head, hp, qa) {
  var pts = [], qi = qa.clone().invert(), v = new THREE.Vector3(), M = new THREE.Matrix4();
  glb.updateMatrixWorld(true);
  glb.traverse(function(m) {
    if (!m.isSkinnedMesh || !m.skeleton) return;
    var hi = m.skeleton.bones.indexOf(head); if (hi < 0) return;
    var g = m.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight; if (!si || !sw) return;
    M.copy(m.matrixWorld).multiply(m.bindMatrixInverse).multiply(head.matrixWorld).multiply(m.skeleton.boneInverses[hi]).multiply(m.bindMatrix);
    var get = [function(a, i) { return a.getX(i); }, function(a, i) { return a.getY(i); }, function(a, i) { return a.getZ(i); }, function(a, i) { return a.getW(i); }];
    var wMax = sw.normalized ? (sw.array instanceof Uint8Array ? 255 : sw.array instanceof Uint16Array ? 65535 : 1) : 1;
    for (var i = 0; i < pos.count; i++) {
      var w = 0; for (var k = 0; k < 4; k++) if (get[k](si, i) === hi) w += get[k](sw, i) / wMax;
      if (w < 0.6) continue;
      v.fromBufferAttribute(pos, i).applyMatrix4(M).sub(hp).applyQuaternion(qi); pts.push(v.clone());
    }
  });
  return pts.length < 40 ? null : COS._sliceFit(pts);
};
// Unrigged models (mannequin, rubber duck): measure the top of the mesh instead
COS.topFit = function(glb, origin, qa) {
  var pts = [], qi = qa.clone().invert(), v = new THREE.Vector3();
  glb.updateMatrixWorld(true);
  glb.traverse(function(m) {
    if (!m.isMesh || m.userData.cosHat) return;
    var pos = m.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 6000));
    for (var i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).sub(origin).applyQuaternion(qi); pts.push(v.clone()); }
  });
  if (pts.length < 40) return null;
  var y1 = -Infinity, y0 = Infinity; pts.forEach(function(p) { y1 = Math.max(y1, p.y); y0 = Math.min(y0, p.y); });
  var cut = y1 - (y1 - y0) * 0.13;   // the head is roughly the top eighth of a figure
  return COS._sliceFit(pts.filter(function(p) { return p.y > cut; }));
};
COS._sliceFit = function(pts) {
  if (pts.length < 20) return null;
  var y0 = Infinity, y1 = -Infinity; pts.forEach(function(p) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
  var N = 24, sl = []; for (var j = 0; j < N; j++) sl.push({ x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
  pts.forEach(function(p) { var b = sl[Math.min(N - 1, Math.floor((p.y - y0) / (y1 - y0 + 1e-6) * N))]; b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x); b.z0 = Math.min(b.z0, p.z); b.z1 = Math.max(b.z1, p.z); });
  var wOf = function(b) { return b.x1 > b.x0 ? b.x1 - b.x0 : 0; }, maxW = 0, wide = null;
  sl.forEach(function(b) { maxW = Math.max(maxW, wOf(b)); });
  for (j = N - 1; j >= 0; j--) if (wOf(sl[j]) >= maxW * 0.72) { wide = j; break; }
  var ref = sl[wide], top = y0 + (wide + 1) / N * (y1 - y0);
  return { halfW: maxW / 2, top: top, cx: (ref.x0 + ref.x1) / 2, cz: (ref.z0 + ref.z1) / 2, face: COS._faceFit(pts, top) };
};
// Where the face is, for glasses and headphones: eye height (half way down the head), the front
// surface there, the width of the face (front-most vertices only, so ears and fins don't count)
// and the full width at that height (where headphone cups go)
COS._faceFit = function(pts, top) {
  var q = function(arr, f) { return arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * f)))]; }, num = function(a, b) { return a - b; };
  var bot = q(pts.map(function(p) { return p.y; }).sort(num), 0.03), H = top - bot; if (H <= 1e-4) return null;
  var ey = top - H * 0.48, band = pts.filter(function(p) { return Math.abs(p.y - ey) < H * 0.12; }); if (band.length < 12) return null;
  var zs = band.map(function(p) { return p.z; }).sort(num), zf = q(zs, 0.97), zb = q(zs, 0.03);
  var front = band.filter(function(p) { return p.z > zf - (zf - zb) * 0.35; }); if (front.length < 4) front = band;
  var fx = front.map(function(p) { return p.x; }).sort(num), bx = band.map(function(p) { return p.x; }).sort(num);
  return { ey: ey, zf: zf, zc: (zf + zb) / 2, fw: (q(fx, 0.97) - q(fx, 0.03)) / 2, fcx: (q(fx, 0.97) + q(fx, 0.03)) / 2, bw: (q(bx, 0.97) - q(bx, 0.03)) / 2, bcx: (q(bx, 0.97) + q(bx, 0.03)) / 2 };
};
// Hats that don't sit on the crown: glasses go on the eyes, headphones over the ears
COS.HAT_ANCHOR = { hat_shades: "eyes", hat_phones: "ears" };
COS._placeHat = function(hat, id, fit, size, at, qa, origin, ws) {
  var F = fit && fit.face, an = COS.HAT_ANCHOR[id];
  if (!F || !an) { hat.scale.setScalar(size / ws.x); return; }
  if (an === "eyes") { var sz = Math.max(0.2, F.fw / 0.19); at.set(F.fcx, F.ey, F.zf).applyQuaternion(qa).add(origin); hat.scale.setScalar(sz / ws.x); }
  else { var sx = Math.max(0.2, F.bw / 0.235), sy = Math.max(sx * 0.5, (fit.top - F.ey) / 0.235); at.set(F.bcx, F.ey, F.zc).applyQuaternion(qa).add(origin); hat.scale.set(sx / ws.x, sy / ws.x, sx / ws.x); }
};
// Pattern finishes are computed in the shader from the (skinned) vertex position in metres, so
// they work on every model — most of these characters have no UVs to hang a texture on.
COS._GLSL = [
  "float cosH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }",
  "float cosN(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
  "  return mix(mix(mix(cosH(i), cosH(i + vec3(1,0,0)), f.x), mix(cosH(i + vec3(0,1,0)), cosH(i + vec3(1,1,0)), f.x), f.y),",
  "             mix(mix(cosH(i + vec3(0,0,1)), cosH(i + vec3(1,0,1)), f.x), mix(cosH(i + vec3(0,1,1)), cosH(i + vec3(1,1,1)), f.x), f.y), f.z); }"].join("\n");
COS.PAT = {
  fin_candy: { p: { roughness: 0.25, metalness: 0.05 }, col: "float s = smoothstep(0.46, 0.54, fract((vPat.y + vPat.x * 0.6 + vPat.z * 0.3) * 7.5)); diffuseColor.rgb = mix(vec3(1.0, 0.97, 0.96), vec3(0.9, 0.08, 0.2), s);" },
  fin_marble: { p: { roughness: 0.3, metalness: 0.0 }, col: "float n = cosN(vPat * 4.0) * 0.65 + cosN(vPat * 11.0) * 0.35; float v = abs(sin((vPat.x + vPat.y * 0.7 + vPat.z * 0.3) * 9.0 + n * 8.0)); vec3 base = mix(vec3(0.86, 0.85, 0.84), vec3(0.98, 0.97, 0.95), cosN(vPat * 6.0)); diffuseColor.rgb = mix(vec3(0.3, 0.3, 0.36), base, smoothstep(0.02, 0.32, v));" },
  fin_lava: { p: { roughness: 0.85, metalness: 0.0, color: 0x1a0e0c }, col: "", emi: "float n = cosN(vPat * 4.5 + vec3(0.0, -uT * 0.35, 0.0)); float c = 1.0 - smoothstep(0.0, 0.07, abs(n - 0.5)); totalEmissiveRadiance += vec3(1.0, 0.32, 0.04) * c * 2.6 + vec3(0.3, 0.06, 0.0) * n * n;", anim: true },
  fin_toxic: { p: { roughness: 0.4, metalness: 0.1, color: 0x2a8a1a }, col: "", emi: "float b = smoothstep(0.55, 1.0, sin(vPat.y * 11.0 - uT * 4.0)); totalEmissiveRadiance += vec3(0.3, 1.0, 0.15) * (0.18 + b * 1.1) + vec3(0.6, 1.0, 0.2) * step(0.93, cosN(vPat * 9.0 + uT * 0.6)) * 0.8;", anim: true },
  fin_galaxy: { p: { roughness: 0.35, metalness: 0.2 }, col: "diffuseColor.rgb = mix(vec3(0.04, 0.02, 0.16), vec3(0.32, 0.06, 0.42), cosN(vPat * 2.2 + 3.0));",
    emi: "vec3 q = floor(vPat * 30.0); float st = step(0.982, cosH(q)); float tw = 0.55 + 0.45 * sin(uT * 3.0 + cosH(q + 1.7) * 30.0); totalEmissiveRadiance += vec3(1.0, 0.95, 1.0) * st * tw * 2.0 + vec3(0.12, 0.04, 0.3) * cosN(vPat * 3.0 + uT * 0.15);", anim: true },
};
COS._patMat = function(def, skinning, scale) {
  var mat = new THREE.MeshStandardMaterial(Object.assign({ color: 0xffffff, skinning: skinning }, def.p)), uni = { uT: { value: 0 }, uS: { value: scale } };
  mat.userData.uni = uni;
  mat.onBeforeCompile = function(sh) {
    sh.uniforms.uT = uni.uT; sh.uniforms.uS = uni.uS;
    sh.vertexShader = "uniform float uS;\nvarying vec3 vPat;\n" + sh.vertexShader.replace("#include <skinning_vertex>", "#include <skinning_vertex>\n  vPat = transformed * uS;");
    sh.fragmentShader = "uniform float uT;\nvarying vec3 vPat;\n" + COS._GLSL + "\n" + sh.fragmentShader
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + (def.col || ""))
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + (def.emi || ""));
  };
  var key = "cosPat" + Object.keys(COS.PAT).find(function(k) { return COS.PAT[k] === def; });
  mat.customProgramCacheKey = function() { return key; };
  return mat;
};
COS.applyFinish = function(glb, id) {
  glb.traverse(function(m) {
    if (!m.isMesh || m.userData.cosHat) return;
    m.userData._cosOrig = m.material;
    var src = Array.isArray(m.material) ? m.material[0] : m.material;
    var p = { map: src.map || null, skinning: !!src.skinning };
    var mat;
    if (COS.PAT[id]) {
      m.updateWorldMatrix(true, false);
      var def = COS.PAT[id];
      mat = COS._patMat(def, !!src.skinning, new THREE.Vector3().setFromMatrixScale(m.matrixWorld).x);
      if (def.anim) (function(mat) { COS._anim.push({ o: m, f: function(o, t) { if (o.material !== mat) return false; mat.userData.uni.uT.value = t; } }); })(mat);
      m.material = mat;
      return;
    }
    if (id === "fin_pastel") {   // keep each material's own colours, washed out like sugar candy
      var pas = function(mt) { var c = mt.clone(); if (c.color) { var hsl = {}; c.color.getHSL(hsl); c.color.setHSL(hsl.h, Math.min(1, hsl.s * 0.7 + 0.3), 0.62 + hsl.l * 0.25); } if (c.emissive) { c.emissive.copy(c.color).multiplyScalar(0.08); } if ("roughness" in c) c.roughness = 0.75; return c; };
      m.material = Array.isArray(m.material) ? m.material.map(pas) : pas(m.material);
      return;
    }
    switch (id) {
      case "fin_bronze": mat = new THREE.MeshStandardMaterial(Object.assign(p, { map: null, color: 0xb8743a, metalness: 1, roughness: 0.38 })); break;
      case "fin_gold": mat = new THREE.MeshStandardMaterial(Object.assign(p, { map: null, color: 0xffc83a, metalness: 1, roughness: 0.22 })); break;
      case "fin_chrome": mat = new THREE.MeshStandardMaterial(Object.assign(p, { map: null, color: 0xe8eef6, metalness: 1, roughness: 0.06 })); break;
      case "fin_shadow": mat = new THREE.MeshStandardMaterial(Object.assign(p, { map: null, color: 0x08080c, roughness: 0.9, emissive: new THREE.Color(0x2a0a4a), emissiveIntensity: 0.6 })); break;
      case "fin_frozen": mat = new THREE.MeshPhysicalMaterial(Object.assign(p, { color: 0xb8e8ff, roughness: 0.08, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 })); break;
      case "fin_neon": mat = new THREE.MeshStandardMaterial(Object.assign(p, { map: null, color: 0x0a0a14, emissive: new THREE.Color(0x3af0ff), emissiveIntensity: 1.4, roughness: 0.4 })); break;
      case "fin_ghost": mat = new THREE.MeshStandardMaterial(Object.assign(p, { color: 0xd8e8ff, transparent: true, opacity: 0.42, depthWrite: false, emissive: new THREE.Color(0x6a8aff), emissiveIntensity: 0.5 })); break;
      case "fin_rainbow":
        mat = new THREE.MeshStandardMaterial(Object.assign(p, { map: null, color: 0xff0000, metalness: 0.3, roughness: 0.3, emissive: new THREE.Color(0xff0000), emissiveIntensity: 0.35 }));
        (function(mat) { COS._anim.push({ o: m, f: function(o, t) { if (o.material !== mat) return false; var c = new THREE.Color().setHSL((t * 0.25 + o.id * 0.07) % 1, 0.9, 0.55); mat.color.copy(c); mat.emissive.copy(c); } }); })(mat);   // stops once the finish is taken off
        break;
      default: return;
    }
    m.material = mat;
  });
};
COS.tick = function(t) {
  for (var i = COS._anim.length - 1; i >= 0; i--) {
    var a = COS._anim[i], live = false;
    for (var p = a.o; p; p = p.parent) if (p.isScene) { live = true; break; }
    if (!a.o.parent) { COS._anim.splice(i, 1); continue; }
    if (live && a.f(a.o, t) === false) COS._anim.splice(i, 1);   // false = done (e.g. a finish that was taken off)
  }
};

// Footstep aura while walking (called from the player controller)
COS._auraAcc = 0;
COS.auraStep = function(av, pos, speed, dt) {
  if (!av || !av.userData.aura || typeof spawnSkinParticle !== "function") return;
  COS._auraAcc += dt * (speed > 0.5 ? 14 : 2.5);
  while (COS._auraAcc > 1) { COS._auraAcc -= 1; spawnSkinParticle(av.userData.aura, new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.5, pos.y + 0.1 + Math.random() * (speed > 0.5 ? 0.3 : 1.4), pos.z + (Math.random() - 0.5) * 0.5)); }
};
