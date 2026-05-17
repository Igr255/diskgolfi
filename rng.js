"use strict";

// ══════════════════════════════════════════════════════════
// ── DETERMINISTIC RANDOM NUMBER GENERATOR ──
// Syncs maps across the network — both players get identical
// results as long as matchSeed is synced via the 'start' msg.
// ══════════════════════════════════════════════════════════

var rngSeed = 1;

function seedRNG(s) {
  rngSeed = s;
}

// Fast hash-based RNG (Mulberry32 variant)
function srng() {
  let t = (rngSeed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
