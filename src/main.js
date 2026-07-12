import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/addons/renderers/CSS2DRenderer.js";
import { species, HUMAN_BRAIN_MASS, categoryColors } from "./data.js";
import { createBrain } from "./brain.js";

// ---------------------------------------------------------------------------
// Scene / renderer / camera
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e16);
scene.fog = new THREE.Fog(0x0b0e16, 40, 150);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  400
);
camera.position.set(0, 14, 38);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById("app").appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0";
labelRenderer.domElement.style.pointerEvents = "none";
document.getElementById("app").appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 1.6, 0);
controls.minDistance = 6;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI * 0.495;

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xbcd0ff, 0x202028, 0.7);
scene.add(hemi);
const amb = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(amb);

const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(8, 14, 10);
scene.add(key);

const rim = new THREE.DirectionalLight(0x4d96ff, 0.9);
rim.position.set(-12, 6, -8);
scene.add(rim);

const fill = new THREE.PointLight(0xff6b6b, 0.5, 60);
fill.position.set(0, 4, 14);
scene.add(fill);

// ---------------------------------------------------------------------------
// Floor + pedestals
// ---------------------------------------------------------------------------
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(70, 80),
  new THREE.MeshStandardMaterial({ color: 0x0e1320, roughness: 1, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.5;
scene.add(floor);

let grid = new THREE.PolarGridHelper(56, 24, 10, 96, 0x223049, 0x18202f);
grid.position.y = -0.49;
scene.add(grid);

const pedestalMat = new THREE.MeshStandardMaterial({
  color: 0x1a2233,
  roughness: 0.7,
  metalness: 0.1,
});

// ---------------------------------------------------------------------------
// Build brains, lay them out on an arc
// ---------------------------------------------------------------------------
const brainGroups = [];
const BASE_FACTOR = 1.0; // human brain displayed at scale 1.0
const NORM_DISPLAY = 0.95; // normalized mode: all brains same display size
const BRAIN_DETAIL = species.length > 24 ? 4 : 5; // trim mesh density for big sets

// phyllotaxis "spiral garden" — scales to any number of animals without crowding
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SPIRAL_SPACING = 2.8;
function layoutPosition(i) {
  const r = SPIRAL_SPACING * Math.sqrt(i + 0.5);
  const a = i * GOLDEN;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

species.forEach((item) => {
  const group = createBrain({
    color: item.color,
    seed: item.id,
    detail: BRAIN_DETAIL,
  });
  group.userData.item = item;
  scene.add(group);

  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.15, 0.5, 40),
    pedestalMat
  );
  ped.position.y = -0.25;
  scene.add(ped);

  const el = document.createElement("div");
  el.className = "brain-label";
  el.innerHTML = `${item.name}<span class="mass"></span>`;
  const label = new CSS2DObject(el);
  group.add(label);

  brainGroups.push({
    item,
    group,
    label,
    labelEl: el,
    ped,
    phase: Math.random() * Math.PI * 2,
    visible: true,
    targetScale: 1,
    pedTargetScale: 1,
    targetX: 0,
    targetZ: 0,
    baseY: 0,
    labelY: 2,
  });
});

// ---------------------------------------------------------------------------
// Metrics, layout, animated transitions
// ---------------------------------------------------------------------------
let metric = "mass"; // "mass" | "neurons" | "eq"
let view = "true"; // "true" | "norm"
let showLabels = true;
let sortDir = 1; // 1 = ascending (smallest -> largest)
let currentOrder = [...brainGroups];

function metricValue(item, m) {
  if (m === "mass") return item.brainMass;
  if (m === "neurons") return item.neurons;
  if (m === "eq") return item.eq;
  return item.brainMass / (item.bodyMass * 1000); // brain:body fraction
}
function metricRef(m) {
  const h = species.find((s) => s.id === "human");
  return metricValue(h, m);
}
function formatMetric(item, m) {
  if (m === "mass")
    return item.brainMass >= 1
      ? `${item.brainMass.toLocaleString()} g`
      : `${item.brainMass} g`;
  if (m === "neurons")
    return item.neurons >= 1
      ? `${item.neurons} B neurons`
      : `${Math.round(item.neurons * 1000)} M neurons`;
  if (m === "eq") return `EQ ${item.eq.toFixed(1)}×`;
  const ratio = Math.round((item.bodyMass * 1000) / item.brainMass);
  return `1 : ${ratio.toLocaleString()}`;
}

function computeTargets() {
  const n = currentOrder.length;
  currentOrder.forEach((rec, i) => {
    const { x, z } = layoutPosition(i);
    rec.targetX = x;
    rec.targetZ = z;

    const val = metricValue(rec.item, metric);
    const ref = metricRef(metric);
    const metricScale =
      view === "true" ? BASE_FACTOR * Math.cbrt(val / ref) : NORM_DISPLAY;
    rec.targetScale = rec.visible ? metricScale : 0;
    rec.pedTargetScale = rec.visible ? 1 : 0;

    // compute resting height + label height at the target scale (restore after)
    const g = rec.group;
    const ps = g.scale.x,
      px = g.position.x,
      py = g.position.y,
      pz = g.position.z;
    g.scale.setScalar(Math.max(rec.targetScale, 0.0001));
    g.position.set(rec.targetX, 0, rec.targetZ);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    rec.baseY = -box.min.y;
    rec.labelY = box.max.y - box.min.y + 0.35;
    g.scale.setScalar(ps);
    g.position.set(px, py, pz);
    scene.updateMatrixWorld(true);

    rec.labelEl.querySelector(".mass").textContent =
      formatMetric(rec.item, metric) +
      (view === "norm" && rec.visible ? " (scaled)" : "");
    rec.labelEl.style.display = showLabels && rec.visible ? "" : "none";
  });
}

function sortByMetric(dir) {
  currentOrder.sort(
    (a, b) => (metricValue(a.item, metric) - metricValue(b.item, metric)) * dir
  );
  computeTargets();
}

function applyMetric(m) {
  metric = m;
  sortByMetric(sortDir); // re-order + rescale by the new metric
}

function initPositions() {
  brainGroups.forEach((rec) => {
    rec.group.scale.setScalar(rec.targetScale);
    rec.group.position.set(rec.targetX, rec.baseY, rec.targetZ);
    rec.ped.position.set(rec.targetX, -0.25, rec.targetZ);
    rec.ped.scale.setScalar(rec.pedTargetScale);
    rec.label.position.set(0, rec.labelY, 0);
  });
}

sortByMetric(sortDir); // initial order: smallest -> largest by mass
initPositions();

// ---------------------------------------------------------------------------
// Highlight + selection
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;
let selected = null;

function setEmissive(group, on) {
  group.traverse((o) => {
    if (o.isMesh && o.material.emissive) {
      o.material.emissive.setHex(on ? 0x331a1a : 0x000000);
    }
  });
}

function pointerToNDC(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function pick() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(
    currentOrder.filter((r) => r.visible).map((r) => r.group),
    true
  );
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !o.userData.isBrain) o = o.parent;
  return o || null;
}

renderer.domElement.addEventListener("pointermove", (e) => {
  pointerToNDC(e);
  const g = pick();
  if (g !== hovered) {
    if (hovered && hovered !== selected) setEmissive(hovered, false);
    hovered = g;
    if (hovered && hovered !== selected) setEmissive(hovered, true);
    renderer.domElement.style.cursor = hovered ? "pointer" : "default";
  }
});

renderer.domElement.addEventListener("pointerdown", (e) => {
  pointerToNDC(e);
  const g = pick();
  if (selected && selected !== g) setEmissive(selected, false);
  selected = g;
  if (selected) {
    setEmissive(selected, true);
    showPanel(selected.userData.item);
  } else {
    hidePanel();
  }
});

// ---------------------------------------------------------------------------
// UI panel
// ---------------------------------------------------------------------------
const panel = document.getElementById("panel");
const panelName = document.getElementById("panel-name");
const panelSci = document.getElementById("panel-sci");
const panelStats = document.getElementById("panel-stats");
const panelFact = document.getElementById("panel-fact");
const panelSwatch = document.getElementById("panel-swatch");

function showPanel(item) {
  const hex = "#" + new THREE.Color(item.color).getHexString();
  panelSwatch.style.background = hex;
  panelName.textContent = item.name;
  panelSci.textContent = item.scientific;

  const massTxt =
    item.brainMass >= 1
      ? `${item.brainMass.toLocaleString()} g`
      : `${item.brainMass} g`;
  const neuTxt =
    item.neurons >= 1
      ? `${item.neurons} B`
      : `${Math.round(item.neurons * 1000)} M`;
  const ratio = Math.round((item.bodyMass * 1000) / item.brainMass);

  const rows = [
    ["Brain mass", massTxt, "mass"],
    ["Neurons", neuTxt, "neurons"],
    ["Encephalization", `EQ ${item.eq.toFixed(1)}×`, "eq"],
    ["Brain : body", `1 : ${ratio.toLocaleString()}`, "ratio"],
    ["Body mass", `${item.bodyMass.toLocaleString()} kg`, null],
  ];
  panelStats.innerHTML = rows
    .map(
      ([k, v, key]) =>
        `<dt class="${key === metric ? "hot" : ""}">${k}</dt><dd class="${
          key === metric ? "hot" : ""
        }">${v}</dd>`
    )
    .join("");
  panelFact.textContent = item.fact;
  panel.classList.remove("hidden");
}

function hidePanel() {
  panel.classList.add("hidden");
}

document.getElementById("panel-close").addEventListener("click", () => {
  hidePanel();
  if (selected) {
    setEmissive(selected, false);
    selected = null;
  }
});

// ---------------------------------------------------------------------------
// Controls (metric selector, view, sort, labels, rotate, search)
// ---------------------------------------------------------------------------
const METRICS = ["mass", "neurons", "eq", "ratio"];
let tourTimer = null;
let tourIdx = METRICS.indexOf(metric);

function setActiveMetric(m) {
  document
    .querySelectorAll("#metric-seg [data-m]")
    .forEach((b) => b.classList.toggle("active", b.dataset.m === m));
  tourIdx = METRICS.indexOf(m);
  applyMetric(m);
}

document.querySelectorAll("#metric-seg [data-m]").forEach((btn) => {
  btn.addEventListener("click", () => {
    stopTour();
    setActiveMetric(btn.dataset.m);
  });
});

const tourBtn = document.getElementById("tour-btn");
function startTour() {
  tourBtn.textContent = "■ Stop Tour";
  tourBtn.classList.add("active");
  tourTimer = setInterval(() => {
    tourIdx = (tourIdx + 1) % METRICS.length;
    setActiveMetric(METRICS[tourIdx]);
  }, 3800);
}
function stopTour() {
  if (!tourTimer) return;
  clearInterval(tourTimer);
  tourTimer = null;
  tourBtn.textContent = "▶ Play Tour";
  tourBtn.classList.remove("active");
}
tourBtn.addEventListener("click", () => {
  if (tourTimer) stopTour();
  else startTour();
});

const viewBtn = document.getElementById("view-btn");
viewBtn.addEventListener("click", () => {
  view = view === "true" ? "norm" : "true";
  viewBtn.textContent = view === "true" ? "View: True Scale" : "View: Normalized";
  viewBtn.classList.toggle("active", view === "true");
  computeTargets();
});

const sortBtn = document.getElementById("sort-btn");
sortBtn.addEventListener("click", () => {
  sortDir *= -1;
  sortBtn.textContent =
    sortDir === 1
      ? "Sort ↑ smallest→largest"
      : "Sort ↓ largest→smallest";
  sortByMetric(sortDir);
});

const labelsBtn = document.getElementById("labels-btn");
labelsBtn.addEventListener("click", () => {
  showLabels = !showLabels;
  labelsBtn.textContent = showLabels ? "Labels: On" : "Labels: Off";
  labelsBtn.classList.toggle("active", showLabels);
  computeTargets();
});

const rotateBtn = document.getElementById("rotate-btn");
rotateBtn.addEventListener("click", () => {
  controls.autoRotate = !controls.autoRotate;
  controls.autoRotateSpeed = 0.6;
  rotateBtn.textContent = controls.autoRotate
    ? "Auto-rotate: On"
    : "Auto-rotate: Off";
  rotateBtn.classList.toggle("active", controls.autoRotate);
});

document.getElementById("search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  brainGroups.forEach((rec) => {
    rec.visible =
      !q ||
      rec.item.name.toLowerCase().includes(q) ||
      rec.item.scientific.toLowerCase().includes(q);
  });
  computeTargets();
});

// ---------------------------------------------------------------------------
// Day / night theme
// ---------------------------------------------------------------------------
const THEMES = {
  night: {
    bg: 0x0b0e16,
    fog: 0x0b0e16,
    fogNear: 40,
    fogFar: 150,
    floor: 0x0e1320,
    grid: [0x223049, 0x18202f],
    hemiSky: 0xbcd0ff,
    hemiGround: 0x202028,
    hemiInt: 0.7,
    amb: 0.25,
    key: 1.6,
    rim: 0x4d96ff,
    rimInt: 0.9,
    fill: 0.5,
  },
  day: {
    bg: 0xb9cee6,
    fog: 0xb9cee6,
    fogNear: 50,
    fogFar: 160,
    floor: 0xc4d2e2,
    grid: [0x7e93b0, 0x9fb1c9],
    hemiSky: 0xffffff,
    hemiGround: 0x9fb0c4,
    hemiInt: 1.0,
    amb: 0.6,
    key: 1.05,
    rim: 0x9fb6d8,
    rimInt: 0.35,
    fill: 0.15,
  },
};

let theme = "night";

function applyTheme(name) {
  theme = name;
  const t = THEMES[name];
  scene.background = new THREE.Color(t.bg);
  scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
  floor.material.color.setHex(t.floor);

  scene.remove(grid);
  grid.geometry.dispose();
  grid = new THREE.PolarGridHelper(34, 16, 8, 64, t.grid[0], t.grid[1]);
  grid.position.y = -0.49;
  scene.add(grid);

  hemi.color.setHex(t.hemiSky);
  hemi.groundColor.setHex(t.hemiGround);
  hemi.intensity = t.hemiInt;
  amb.intensity = t.amb;
  key.intensity = t.key;
  rim.color.setHex(t.rim);
  rim.intensity = t.rimInt;
  fill.intensity = t.fill;

  document.body.classList.toggle("day", name === "day");
  themeBtn.textContent = name === "day" ? "☀ Day" : "☾ Night";
}

const themeBtn = document.getElementById("theme-btn");
themeBtn.addEventListener("click", () => {
  applyTheme(theme === "night" ? "day" : "night");
});

// ---------------------------------------------------------------------------
// About modal
// ---------------------------------------------------------------------------
const about = document.getElementById("about");
document.getElementById("about-btn").addEventListener("click", () => {
  about.classList.remove("hidden");
});
document.getElementById("about-close").addEventListener("click", () => {
  about.classList.add("hidden");
});
about.addEventListener("click", (e) => {
  if (e.target === about) about.classList.add("hidden");
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") about.classList.add("hidden");
});

// legend
const legend = document.getElementById("legend");
Object.entries(categoryColors).forEach(([cat, col]) => {
  const hex = "#" + new THREE.Color(col).getHexString();
  const div = document.createElement("div");
  div.className = "item";
  div.innerHTML = `<span class="dot" style="background:${hex}"></span>${cat}`;
  legend.appendChild(div);
});

// ---------------------------------------------------------------------------
// Resize + animation loop
// ---------------------------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
const LERP = 0.12;
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  brainGroups.forEach((rec) => {
    const g = rec.group;
    g.position.x += (rec.targetX - g.position.x) * LERP;
    g.position.z += (rec.targetZ - g.position.z) * LERP;
    const ns = g.scale.x + (rec.targetScale - g.scale.x) * LERP;
    g.scale.setScalar(ns);
    g.position.y = rec.baseY + Math.sin(t * 0.8 + rec.phase) * 0.06;

    const p = rec.ped;
    p.position.x += (rec.targetX - p.position.x) * LERP;
    p.position.z += (rec.targetZ - p.position.z) * LERP;
    const ps = p.scale.x + (rec.pedTargetScale - p.scale.x) * LERP;
    p.scale.setScalar(ps);
  });

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
animate();
