"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// ── TOON — characters that pop off the background ────────────────────────────
// A warm fresnel rim light on every character material (one shared uniform).
// Applied to players (buildPlayerAvatar) and animated NPCs / critters (ENT.glb).
// ══════════════════════════════════════════════════════════════════════════════
var TOON = { rim: { value: 0.32 }, rimCol: { value: new THREE.Color(1.0, 0.93, 0.8) } };

TOON._rimify = function(mat) {
  if (!mat || mat.userData.toonRim || !(mat.isMeshStandardMaterial || mat.isMeshPhongMaterial || mat.isMeshLambertMaterial)) return;
  mat.userData.toonRim = true;
  var prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null;
  mat.onBeforeCompile = function(sh, r) {
    if (prev) prev.call(this, sh, r);
    sh.uniforms.uRim = TOON.rim; sh.uniforms.uRimCol = TOON.rimCol;
    sh.fragmentShader = "uniform float uRim; uniform vec3 uRimCol;\n" + sh.fragmentShader.replace("#include <tonemapping_fragment>", [
      "{ float fr = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);",
      "  gl_FragColor.rgb += uRimCol * smoothstep(0.55, 1.0, fr) * uRim; }",
      "#include <tonemapping_fragment>"].join("\n"));
  };
  mat.customProgramCacheKey = function() { return (prevKey ? prevKey() : "") + "|toonRim"; };
  mat.needsUpdate = true;
};
TOON.dress = function(root) {
  if (!root || root.userData.toon) return;
  root.userData.toon = true;
  root.traverse(function(m) { if (m.isMesh && !m.userData.cosHat) (Array.isArray(m.material) ? m.material : [m.material]).forEach(TOON._rimify); });
};
