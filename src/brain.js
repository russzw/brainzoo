import * as THREE from "three";
import { createNoise3D } from "simplex-noise";

// --- small deterministic PRNG so each species brain is reproducible ---
function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Ridged multi-octave fractal noise -> crease-like "gyri" patterns.
function ridged(noise, x, y, z, octaves, freq, lac, gain) {
  let sum = 0;
  let amp = 1;
  let f = freq;
  for (let i = 0; i < octaves; i++) {
    let n = noise(x * f, y * f, z * f);
    n = 1 - Math.abs(n); // ridge
    n = n * n;
    sum += n * amp;
    f *= lac;
    amp *= gain;
  }
  return sum;
}

function makeCerebrum(noise, baseColor) {
  const geo = new THREE.IcosahedronGeometry(1, 5);
  const pos = geo.attributes.position;
  const count = pos.count;

  const colors = new Float32Array(count * 3);
  const base = new THREE.Color(baseColor);
  const dark = base.clone().multiplyScalar(0.55);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.35);

  let minD = Infinity;
  let maxD = -Infinity;
  const disp = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // sample noise on the unit sphere so the pattern wraps seamlessly
    const big = ridged(noise, x, y, z, 4, 2.4, 2.0, 0.5); // major folds
    const fine = ridged(noise, x, y, z, 3, 7.0, 2.0, 0.5); // fine wrinkles

    // longitudinal fissure: groove along the top midline (z ~ 0), front-to-back
    const mid = 1 - smoothstep(0.0, 0.22, Math.abs(z));
    const top = smoothstep(-0.15, 0.45, y);
    const fissure = mid * top;

    // total outward displacement (in radius units)
    let d = 0.06 + 0.1 * big + 0.03 * fine - 0.28 * fissure;
    disp[i] = d;
    if (d < minD) minD = d;
    if (d > maxD) maxD = d;

    // ellipsoid proportions: long front-back, narrower sides, medium height
    const r = 1 + d;
    const ex = x * r * 1.18;
    const ey = y * r * 0.98;
    const ez = z * r * 0.86;
    pos.setXYZ(i, ex, ey, ez);
  }

  // colour by displacement depth (grooves darker, ridges lighter)
  const span = Math.max(1e-5, maxD - minD);
  for (let i = 0; i < count; i++) {
    const t = (disp[i] - minD) / span;
    const c = dark.clone().lerp(light, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

function makeCerebellum(noise, baseColor) {
  const geo = new THREE.IcosahedronGeometry(0.42, 4);
  const pos = geo.attributes.position;
  const count = pos.count;
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const fine = ridged(noise, x + 11, y - 7, z + 3, 3, 9.0, 2.0, 0.5);
    const r = 1 + 0.05 + 0.06 * fine;
    pos.setXYZ(i, x * r, y * r * 0.7, z * r * 0.95);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor).multiplyScalar(0.8),
    roughness: 0.9,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  // tuck under the back-bottom of the cerebrum
  mesh.position.set(-1.0, -0.4, 0.05);
  return mesh;
}

function makeBrainStem(baseColor) {
  const geo = new THREE.CylinderGeometry(0.13, 0.2, 0.7, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor).multiplyScalar(0.7),
    roughness: 0.9,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(-0.25, -0.95, 0.0);
  mesh.rotation.z = 0.25;
  return mesh;
}

// Returns a Group containing cerebrum + cerebellum + brain stem.
export function createBrain({ color = 0xff6b6b, seed = "brain" } = {}) {
  const group = new THREE.Group();
  const rand = mulberry32(hashString(seed));
  const noise3D = createNoise3D(rand);

  group.add(makeCerebrum(noise3D, color));
  group.add(makeCerebellum(noise3D, color));
  group.add(makeBrainStem(color));

  group.userData.isBrain = true;
  return group;
}
