"use strict";

// ══════════════════════════════════════════════════════════
// ── WEATHER SYSTEM ──
// Each weather type has mechanical physics effects:
//   windMult:   scales hole wind force during flight
//   liftMult:   scales disc lift coefficient
//   dragMult:   <1 = disc slows faster (rain/snow weight)
//   fogDensity: THREE.js exponential fog density
//   dotCount:   max trajectory preview dots shown
// ══════════════════════════════════════════════════════════

// ── WEATHER TYPES ────────────────────────────────────────────────────
// windMult:  multiplier on hole.wind force (1=normal, 3=gale)
// liftMult:  multiplier on disc lift coefficient
// dragAdd:   EXTRA drag per frame added on top of disc's natural drag
//            (0=none, 0.04=noticeable, 0.12=heavy)
// gravAdd:   extra gravity in m/s² (0=normal, 2=heavy rain, -3=thermals)
// gustStr:   random lateral gust strength (m/s²) applied each frame
// fogDensity, dotCount: visual/preview effects
const WEATHER_TYPES = {
  clear:  { icon:"☀️",  label:"Clear",  windMult:1.0, liftMult:1.00, dragAdd:0.00, gravAdd: 0.0,  gustStr:0.0,  fogDensity:0.005, dotCount:28 },
  windy:  { icon:"💨",  label:"Windy",  windMult:4.5, liftMult:1.08, dragAdd:0.01, gravAdd: 0.0,  gustStr:4.0,  fogDensity:0.006, dotCount:22 },
  rainy:  { icon:"🌧️", label:"Rain",   windMult:1.5, liftMult:0.65, dragAdd:0.06, gravAdd: 2.5,  gustStr:1.5,  fogDensity:0.015, dotCount:18 },
  foggy:  { icon:"🌫️", label:"Fog",    windMult:0.6, liftMult:0.88, dragAdd:0.02, gravAdd: 0.5,  gustStr:0.0,  fogDensity:0.040, dotCount:8  },
  stormy: { icon:"⛈️", label:"Storm",  windMult:6.0, liftMult:0.55, dragAdd:0.08, gravAdd: 3.0,  gustStr:8.0,  fogDensity:0.018, dotCount:14 },
  hot:    { icon:"🔥",  label:"Heat",   windMult:0.4, liftMult:1.12, dragAdd:0.00, gravAdd: 0.0,  gustStr:0.3,  fogDensity:0.003, dotCount:28 },  // thermal lift REMOVED
  snow:   { icon:"❄️", label:"Snow",   windMult:0.9, liftMult:0.60, dragAdd:0.09, gravAdd: 4.0,  gustStr:0.8,  fogDensity:0.022, dotCount:16 },
};

var currentWeather = "clear";
var rainParticles = null;

// scene and skyMat are set in game.js after THREE setup
function setWeather(wType) {
  currentWeather = wType || "clear";
  const w = WEATHER_TYPES[currentWeather];
  document.getElementById("weather-icon").textContent = w.icon;
  document.getElementById("weather-txt").textContent = w.label;
  document.getElementById("weather-hud").style.display = "block";

  const eff = document.getElementById("weather-effect");
  if (eff) {
    const effects = {
      clear:  "Normal flight",
      windy:  "Strong wind + gusts",
      rainy:  "Heavy disc · less lift",
      foggy:  "Short preview · slight drag",
      stormy: "Gale force! Heavy + gusts",
      hot:    "Thermal lift · disc floats",
      snow:   "Very heavy · low glide",
    };
    eff.textContent = effects[wType] || "";
  }

  if (scene && scene.fog) scene.fog.density = w.fogDensity;

  if (skyMat) {
    if (currentWeather === "stormy") {
      skyMat.uniforms.c1.value.setHex(0x112233);
      skyMat.uniforms.c2.value.setHex(0x000011);
    } else if (currentWeather === "foggy") {
      skyMat.uniforms.c1.value.setHex(0xaaaaaa);
      skyMat.uniforms.c2.value.setHex(0x888888);
    } else if (currentWeather === "rainy") {
      skyMat.uniforms.c1.value.setHex(0x334455);
      skyMat.uniforms.c2.value.setHex(0x111122);
    }
  }

  if (rainParticles) {
    scene.remove(rainParticles);
    rainParticles = null;
  }
  if (currentWeather === "rainy" || currentWeather === "stormy") buildRain();
}

function buildRain() {
  const geo = new THREE.BufferGeometry();
  const count = 2000, pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 200;
    pos[i * 3 + 1] = Math.random() * 60;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  rainParticles = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0x88aaff, size: 0.15, transparent: true, opacity: 0.5 })
  );
  scene.add(rainParticles);
}

function updateRain(dt) {
  if (!rainParticles) return;
  const pos = rainParticles.geometry.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i + 1] -= 30 * dt;
    if (pos[i + 1] < -5) pos[i + 1] = 55;
  }
  rainParticles.geometry.attributes.position.needsUpdate = true;
}

function getWeatherWindMult() { return (WEATHER_TYPES[currentWeather] || WEATHER_TYPES.clear).windMult; }
function getWeatherLiftMult() { return (WEATHER_TYPES[currentWeather] || WEATHER_TYPES.clear).liftMult; }
function getWeatherDragMult() { return 1.0; }  // legacy — use getWeatherDragAdd instead
function getWeatherDragAdd()  { return (WEATHER_TYPES[currentWeather] || WEATHER_TYPES.clear).dragAdd; }
function getWeatherGravAdd()  { return (WEATHER_TYPES[currentWeather] || WEATHER_TYPES.clear).gravAdd; }
function getWeatherGustStr()  { return (WEATHER_TYPES[currentWeather] || WEATHER_TYPES.clear).gustStr; }
function getWeatherDotCount() { return (WEATHER_TYPES[currentWeather] || WEATHER_TYPES.clear).dotCount; }
