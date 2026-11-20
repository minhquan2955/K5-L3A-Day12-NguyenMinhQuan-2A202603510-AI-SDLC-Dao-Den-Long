import * as THREE from 'three';
import { summarizeFrames } from './bench-metrics.js';
import { moveEnemies, updateRefuges } from './enemies.js';
import contract from './game.contract.json' with { type: 'json' };
import { createGame, HZ, nearbyLantern, stepGame, tuning } from './game.js';

const byId = id => document.getElementById(id);
const hint = byId('hint');
const canvas = byId('world');
const colors = getComputedStyle(document.documentElement);
const query = new URLSearchParams(location.search);
const benchmarkMode = query.has('benchmark');
const benchmarkDuration = Number(query.get('duration')) || 30;
const color = name => colors.getPropertyValue(name).trim();
const warmGlow = new THREE.Color(color('--core'));
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch {
  byId('graphics-error').hidden = false;
  throw new Error('WebGL 2 unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color(color('--sky'));
scene.fog = new THREE.FogExp2(color('--fog'), 0.007);
const camera = new THREE.PerspectiveCamera(53, 1, 0.1, 265);
const ambient = new THREE.HemisphereLight(0xc5d6ff, 0x514164, .15);
const moonlight = new THREE.DirectionalLight(0xb1c7ff, 1.2);
moonlight.position.set(-15, 25, -22);
scene.add(ambient, moonlight);

const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...options });
function mesh(parent, geometry, surface, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}
const glowCanvas = document.createElement('canvas');
glowCanvas.width = glowCanvas.height = 64;
const ctx = glowCanvas.getContext('2d');
const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
gradient.addColorStop(0, 'rgba(255,255,255,.8)');
gradient.addColorStop(.24, 'rgba(255,255,255,.36)');
gradient.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 64, 64);
const glowTexture = new THREE.CanvasTexture(glowCanvas);
function glow(parent, color, size, y) {
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.scale.setScalar(size);
  halo.position.y = y;
  parent.add(halo);
  return halo;
}

const ground = material(color('--grass'));
const sand = material(color('--sand'));
const wood = material(color('--wood'));
const rock = new THREE.DodecahedronGeometry(1, 0);
const rockSurface = material(0x62677d);
const stalk = material(0x524854);
const crowns = [material(0x38475d), material(0x526775), material(0x4f536d)];
const cloud = material(color('--cloud'), { roughness: 1 });
const treeCone = new THREE.ConeGeometry(1, 1, 6);
const treeTrunk = new THREE.CylinderGeometry(.11, .2, 1.8, 5);
const landmarks = new THREE.Group();
scene.add(landmarks);
let scenerySeed = 174;
function decorationRandom() {
  scenerySeed = (Math.imul(1664525, scenerySeed) + 1013904223) >>> 0;
  return scenerySeed / 4294967296;
}
function buildIsland({ x, y, z, r }) {
  mesh(landmarks, new THREE.CylinderGeometry(r, r * .78, 5, 64), [sand, ground, ground], x, y - 2.5, z);
  mesh(landmarks, new THREE.CylinderGeometry(r * .78, r * .38, 9, 24), rockSurface, x, y - 9.5, z);
  const trees = Math.floor(r * .72);
  for (let i = 0; i < trees; i += 1) {
    const angle = (i + decorationRandom() * .7) * Math.PI * 2 / trees;
    const radius = r - 1.25 - decorationRandom() * 2.5;
    const tx = x + radius * Math.cos(angle);
    const tz = z + radius * Math.sin(angle);
    if ((angle < .12 || angle > 6.15 || Math.abs(angle - Math.PI) < .12) && game.map.bridge) continue;
    if (i % 3 === 0) {
      const boulder = mesh(landmarks, rock, rockSurface, tx, y + .38, tz);
      boulder.scale.set(.6 + decorationRandom(), .55 + decorationRandom(), .6 + decorationRandom());
      boulder.rotation.y = angle;
      continue;
    }
    const size = 0.8 + decorationRandom() * 1.2;
    mesh(landmarks, treeTrunk, stalk, tx, y + .9, tz);
    for (let j = 0; j < 2; j += 1) {
      const foliage = mesh(landmarks, treeCone, crowns[i % 3], tx, y + (1.6 + j * .8) * size, tz);
      foliage.scale.set(size * (1.35 - j * .3), size * 2.2, size * (1.35 - j * .3));
      foliage.rotation.y = angle + j;
    }
  }
}
for (let i = 0; i < 29; i += 1) {
  const angle = (i + decorationRandom()) * Math.PI * 2 / 29;
  const radius = 39 + decorationRandom() * 72;
  for (let j = 0; j < 3; j += 1) {
    const puff = mesh(scene, rock, cloud, 23 + radius * Math.cos(angle) + j * 3.5,
      -7 - decorationRandom() * 5, radius * Math.sin(angle));
    puff.scale.set(4 + decorationRandom() * 5, 1 + decorationRandom() * 2, 3 + decorationRandom() * 3);
  }
}
mesh(scene, new THREE.PlaneGeometry(580, 580), cloud, 15, -17, 0).rotation.x = -Math.PI / 2;
const moon = new THREE.Group();
moon.position.set(-24, 0, -67);
scene.add(moon);
mesh(moon, new THREE.SphereGeometry(3.5, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffdfad, fog: false }));
glow(moon, 0xffcb83, 23, 0).material.fog = false;
const starPositions = [];
for (let i = 0; i < 300; i += 1) {
  const angle = decorationRandom() * 2 * Math.PI;
  const radius = 110 + decorationRandom() * 38;
  starPositions.push(Math.cos(angle) * radius, decorationRandom() * 93 - 45, Math.sin(angle) * radius);
}
const stars = new THREE.BufferGeometry();
stars.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xe0cccf, size: .24, fog: false })));

const paper = material(color('--core'), { emissive: color('--lantern'), emissiveIntensity: .8 });
const frame = material(0x352534);
const lanternGeometry = new THREE.CylinderGeometry(.66, .52, .96, 6);
const tearGeometry = new THREE.BoxGeometry(.5, .045, .045);
const tearSurface = material(0x322a34);
const lamps = new Map();
const map = byId('map');
const mapPlayer = document.createElement('i');
mapPlayer.className = 'you';
let mapBounds;
let bellTower;
function markPosition(marker, x, z) {
  const { center, span } = mapBounds;
  marker.style.left = `${50 + (x - center) * 92 / span}%`;
  marker.style.top = `${50 + z * 92 / span}%`;
}
function makeLamp(lamp) {
  const object = new THREE.Group();
  object.position.set(...lamp.pos);
  landmarks.add(object);
  mesh(object, new THREE.CylinderGeometry(.9, 1.16, .25, 8), rockSurface, 0, .125);
  mesh(object, new THREE.CylinderGeometry(.17, .24, 2.75, 8), frame, 0, 1.45);
  const lightPaper = mesh(object, lanternGeometry, paper.clone(), 0, 3.02);
  const tears = [mesh(object, tearGeometry, tearSurface, 0, 3.05, .67),
    mesh(object, tearGeometry, tearSurface, 0, 2.98, .67)];
  tears[0].rotation.y = .55;
  tears[1].rotation.y = -.55;
  mesh(object, new THREE.CylinderGeometry(.64, .71, .12, 6), frame, 0, 2.53);
  mesh(object, new THREE.ConeGeometry(1.08, .49, 6), material(0x79524b), 0, 3.72);
  const halo = glow(object, color('--lantern'), 8.2, 3.05);
  const light = new THREE.PointLight(color('--lantern'), 52, 14, 1.6);
  light.position.y = 2.75;
  object.add(light);
  const ring = mesh(object, new THREE.RingGeometry(tuning.safe_radius - .06, tuning.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: color('--lantern'), opacity: .65, transparent: true }), 0, .034);
  ring.rotation.x = -Math.PI / 2;
  const marker = document.createElement('i');
  markPosition(marker, lamp.pos[0], lamp.pos[2]);
  map.insertBefore(marker, mapPlayer);
  lamps.set(lamp.id, { object, lightPaper, tears, halo, light, ring, marker });
}

const roofSurface = material(0x79524b);
const padRing = new THREE.MeshBasicMaterial({ color: color('--gold') });
function buildNightMap() {
  const { circles, bridge, tiers, ramps, pads } = game.map;
  const west = Math.min(...circles.map(({ x, r }) => x - r));
  const east = Math.max(...circles.map(({ x, r }) => x + r));
  mapBounds = { center: (west + east) / 2, span: east - west };
  map.classList.toggle('wide', bridge);
  map.replaceChildren(mapPlayer);
  const shared = new Set([rock, treeTrunk, treeCone, lanternGeometry, rockSurface, ground, sand,
    ...crowns, stalk, wood, frame, roofSurface, padRing]);
  landmarks.traverse(({ geometry, material: surface }) => {
    if (geometry && !shared.has(geometry)) geometry.dispose();
    if (surface && !Array.isArray(surface) && !shared.has(surface)) surface.dispose();
  });
  landmarks.clear();
  lamps.clear();
  bellTower = null;
  scenerySeed = 174 + game.night;
  for (const circle of circles) {
    buildIsland(circle);
    markMapLand(circle.x, circle.z, circle.r * 2, circle.r * 2);
  }
  if (bridge) {
    for (let x = 26.25; x < 44; x += .5) {
      mesh(landmarks, new THREE.BoxGeometry(.48, .22, 4), wood, x, -.11, 0);
    }
    markMapLand(35, 0, 18, 4, 'bridge');
  }
  if (tiers) {
    const terrace = new THREE.Shape();
    for (const [radius, reverse] of [[24, false], [12, true]]) {
      for (let i = 0; i <= 48; i += 1) {
        const angle = (reverse ? 48 - i : i) * Math.PI / 48;
        const x = radius * Math.cos(angle);
        const z = -radius * Math.sin(angle);
        if (!reverse && i === 0) terrace.moveTo(x, z);
        else terrace.lineTo(x, z);
      }
    }
    const ledge = mesh(landmarks, new THREE.ExtrudeGeometry(terrace, { depth: 3, bevelEnabled: false }),
      [ground, sand]);
    ledge.rotation.x = -Math.PI / 2;
    mesh(landmarks, new THREE.CylinderGeometry(8, 8, 6, 48), [sand, ground, ground], 0, 3, 0);
    for (const { angle } of ramps) {
      const ramp = mesh(landmarks, new THREE.BoxGeometry(Math.hypot(6, 3), .16, 3), sand);
      ramp.position.set(27 * Math.cos(angle), 1.43, 27 * Math.sin(angle));
      ramp.rotation.set(0, -angle, -Math.atan(.5), 'YZX');
    }
    bellTower = new THREE.Group();
    landmarks.add(bellTower);
    mesh(bellTower, new THREE.CylinderGeometry(2, 2, 8, 24), wood.clone(), 0, 10, 0);
    mesh(bellTower, new THREE.ConeGeometry(2.65, 1.75, 16), roofSurface.clone(), 0, 14.7, 0);
    mesh(bellTower, new THREE.CylinderGeometry(.45, .63, .65, 12), padRing.clone(), 0, 13.55, 2.06);
    for (const child of bellTower.children) child.material.transparent = true;
  }
  for (const { pos: [x, y, z] } of pads) {
    mesh(landmarks, new THREE.CylinderGeometry(1, 1, .16, 24), wood, x, y - .08, z);
    mesh(landmarks, new THREE.RingGeometry(.68, 1, 24), padRing, x, y + .02, z).rotation.x = -Math.PI / 2;
    mesh(landmarks, new THREE.CircleGeometry(.38, 16), padRing, x, y + .02, z).rotation.x = -Math.PI / 2;
  }
  for (const lamp of game.lanterns) makeLamp(lamp);
}

function markMapLand(x, z, width, height, className = '') {
  const marker = document.createElement('b');
  marker.className = className;
  markPosition(marker, x, z);
  marker.style.width = `${width * 92 / mapBounds.span}%`;
  marker.style.height = `${height * 92 / mapBounds.span}%`;
  map.insertBefore(marker, mapPlayer);
}

const may = new THREE.Group();
scene.add(may);
const skin = material(0xe9ae87);
const clothes = material(color('--clothes'));
const feet = material(0x2d2539);
mesh(may, new THREE.CylinderGeometry(.40, .60, .96, 8), clothes, 0, .89);
mesh(may, new THREE.SphereGeometry(.41, 12, 8), skin, 0, 1.56);
mesh(may, new THREE.CylinderGeometry(.35, .42, .18, 12), material(color('--scarf')), 0, 1.35);
mesh(may, new THREE.BoxGeometry(.17, .52, .07), material(color('--scarf')), -.18, 1.15, -.41).rotation.z = -.24;
mesh(may, new THREE.ConeGeometry(.77, .43, 16), material(0xf4c887), 0, 1.98);
mesh(may, new THREE.CylinderGeometry(.64, .68, .055, 16), material(0xad7252), 0, 1.79);
const boots = [-.23, .23].map(x => mesh(may, new THREE.BoxGeometry(.26, .26, .36), feet, x, .15));
mesh(may, new THREE.CylinderGeometry(.024, .024, .31, 6), frame, .61, 1.64);
mesh(may, new THREE.CylinderGeometry(.19, .16, .27, 6), paper, .61, 1.37);
glow(may, 0xffa451, 2.4, 1.37).position.x = .61;
const mayLight = new THREE.PointLight(0xffbc74, 23, 8, 1.7);
mayLight.position.set(.61, 1.4, 0);
may.add(mayLight);
const pulseRing = mesh(scene, new THREE.RingGeometry(.96, 1, 56),
  new THREE.MeshBasicMaterial({ color: color('--core'), transparent: true, depthWrite: false }));
pulseRing.rotation.x = -Math.PI / 2;
const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointer = new THREE.Vector2();
const aimPoint = new THREE.Vector3();
const vertical = new THREE.Vector3(0, 1, 0);
const segmentGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
const trails = Object.fromEntries(['blink', 'beam'].map(name => {
  const trail = new THREE.Group();
  mesh(trail, segmentGeometry, new THREE.MeshBasicMaterial({
    color: color('--lantern'), transparent: true, depthWrite: false,
  }));
  mesh(trail, segmentGeometry, new THREE.MeshBasicMaterial({ color: color('--core') })).scale.set(.28, 1, .28);
  scene.add(trail);
  return [name, trail];
}));
function flashTrail(name, from, to) {
  const trail = trails[name];
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const length = direction.length();
  trail.position.copy(start).lerp(end, .5);
  trail.quaternion.setFromUnitVectors(vertical, direction.normalize());
  const width = name === 'beam' ? tuning.beam_width_m / 2 : .27;
  trail.scale.set(width, length, width);
  trail.userData.expires = game.simTick + 20;
}

const motes = new Map();
const moteGeometry = new THREE.IcosahedronGeometry(.14, 0);
const moteSurface = new THREE.MeshBasicMaterial({ color: color('--mote') });
const moteTemplate = new THREE.Group();
mesh(moteTemplate, moteGeometry, moteSurface);
glow(moteTemplate, color('--mote-halo'), 1.6, 0);
const shades = new Map();
const shadeSurface = material(color('--shade-body'), { emissive: color('--shade'), emissiveIntensity: .035 });
const stunnedSurface = material(color('--stunned'), { emissive: color('--shade'), emissiveIntensity: .13 });
const shadeTemplate = new THREE.Group();
const shadeBody = mesh(shadeTemplate, new THREE.IcosahedronGeometry(.84, 1), shadeSurface);
shadeBody.scale.y = 1.22;
const eye = new THREE.MeshBasicMaterial({ color: color('--shade') });
for (const x of [-.26, .26]) mesh(shadeTemplate, new THREE.SphereGeometry(.09, 9, 6), eye, x, .12, .75);
const shadeHalo = glow(shadeTemplate, color('--shade'), 3.8, -.03);
function applyColorblindColors() {
  const shade = color('--shade');
  shadeSurface.emissive.set(shade);
  stunnedSurface.emissive.set(shade);
  eye.color.set(shade);
  shadeHalo.material.color.set(shade);
}
const drifters = new Map();
const drifterTemplate = new THREE.Group();
const mist = material(color('--drifter'), { transparent: true, opacity: .76, depthWrite: false });
mesh(drifterTemplate, new THREE.IcosahedronGeometry(.62, 1), mist).scale.set(1, .7, 1.4);
for (const x of [-.44, .44]) {
  mesh(drifterTemplate, rock, mist, x, -.12, -.57).scale.set(.54, .22, .8);
}
glow(drifterTemplate, color('--drifter'), 3.2, -.08);
const charms = new Map();
const charmTemplate = new THREE.Group();
const leafShape = new THREE.Shape();
leafShape.moveTo(0, -.5);
leafShape.quadraticCurveTo(.65, -.08, 0, .56);
leafShape.quadraticCurveTo(-.52, .08, 0, -.5);
const leaf = new THREE.ShapeGeometry(leafShape);
const goldLeaf = new THREE.MeshBasicMaterial({ color: color('--gold'), side: THREE.DoubleSide });
const redLeaf = new THREE.MeshBasicMaterial({ color: color('--scarf'), side: THREE.DoubleSide });
mesh(charmTemplate, leaf, goldLeaf);
for (const side of [-.012, .012]) mesh(charmTemplate, leaf, redLeaf, 0, 0, side).scale.setScalar(.82);
glow(charmTemplate, color('--gold'), 2.2, 0);
const windLeaves = new THREE.InstancedMesh(leaf, redLeaf, 52);
scene.add(windLeaves);
windLeaves.frustumCulled = false;
const windParticle = new THREE.Object3D();
const dynamic = new THREE.Group();
scene.add(dynamic);
function syncObjects(entries, objects, template, update) {
  const active = new Set();
  for (const entry of entries) {
    let object = objects.get(entry.id);
    if (!object) {
      object = template.clone();
      objects.set(entry.id, object);
      dynamic.add(object);
    }
    active.add(entry.id);
    update(object, entry);
  }
  for (const [id, object] of objects) {
    if (!active.has(id)) {
      dynamic.remove(object);
      objects.delete(id);
    }
  }
}

const keys = new Set();
const taps = new Set();
const defaultBindings = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft',
  interact: 'KeyE', pulse: 'KeyQ', pause: 'KeyP' };
let bindings = { ...defaultBindings };
try {
  const saved = JSON.parse(localStorage.getItem('dao-den-long.bindings'));
  const actions = Object.keys(defaultBindings);
  const codes = actions.map(key => saved?.[key]);
  if (codes.every(code => /^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|Enter)$/.test(code)) && new Set(codes).size === actions.length) {
    bindings = Object.fromEntries(actions.map(key => [key, saved[key]]));
  }
} catch {}
const actions = new Set();
const controls = new Set();
function refreshBindings() {
  actions.clear();
  controls.clear();
  for (const [action, code] of Object.entries(bindings)) {
    controls.add(code);
    if (!['up', 'down', 'left', 'right'].includes(action)) actions.add(code);
  }
  for (const code of ['KeyF', 'KeyR', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) controls.add(code);
  for (const code of ['KeyF', 'KeyR', 'ShiftRight']) actions.add(code);
  document.querySelectorAll('[data-binding]').forEach(key => { key.textContent = bindingLabel(bindings[key.dataset.binding]); });
  document.querySelectorAll('[data-rebind]').forEach(button => { button.textContent = bindingLabel(bindings[button.dataset.rebind]); });
}
function bindingLabel(code) {
  return ({ Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' })[code] ??
    code.replace(/^Key/, '').replace(/^Digit/, '');
}
refreshBindings();
const held = (...codes) => codes.some(code => keys.has(code));
const hud = Object.fromEntries(['flames', 'carried', 'lanterns', 'time', 'score'].map(id => [id, byId(id)]));
const abilities = ['dash', 'pulse', 'blink', 'beam'].map(name => [name, byId(`${name}_status`)]);
const slots = Array.from({ length: tuning.capacity_max }, () => document.createElement('i'));
const flames = Array.from({ length: tuning.flames }, () => document.createElement('span'));
for (const flame of flames) {
  flame.textContent = '◆';
  flame.setAttribute('aria-hidden', 'true');
}
hud.flames.append(...flames);
byId('carry-slots').append(...slots);

const names = [null, 'Đảo Bến', 'Đảo Cau', 'Đảo Chuông'];
const stories = [null,
  '“Mây à, gom đom đóm để thắp năm ngọn đèn. Ánh đèn sẽ giữ Bóng Mực ở ngoài.”',
  '“Qua cầu tre hoặc dùng bục nhảy để sang đảo kia. Hãy coi chừng Gió Lạc và tìm chiếc lá đỏ trên cầu.”',
  '“Đi theo dốc để lên tầng giữa, rồi dùng bục nhảy để đến tháp chuông. Khi thấy lá bay, hãy tránh xa mép đảo.”',
];

const label = (element, text) => {
  if (element.textContent !== String(text)) element.textContent = text;
};
let game;
let activeDialog;
let activeNight = false;
let settingsFrom;
let totalScore = 0;
let nightsWon = 0;
let listeningAction;
let accumulator = 0;
let pulseAt;
let pulseCenter;
let messageUntil;
let lastCountdown;
let lastMusic;
let pauseRequested = false;
let hasPointer = false;
let audio;
let master;
const settings = { volume: 65, sensitivity: 100 };
for (const [name, fallback] of Object.entries(settings)) {
  const input = byId(name);
  let saved;
  try { saved = localStorage.getItem(`dao-den-long.${name}`); } catch {}
  input.value = saved ?? fallback;
  function updateSetting() {
    settings[name] = input.valueAsNumber;
    label(byId(`${name}-value`), `${settings[name]}%`);
    if (master && name === 'volume') master.gain.setTargetAtTime(settings.volume / 100, audio.currentTime, .025);
  }
  updateSetting();
  input.addEventListener('input', () => {
    updateSetting();
    try { localStorage.setItem(`dao-den-long.${name}`, input.value); } catch {}
  });
}
const colorblind = byId('colorblind');
try { colorblind.checked = localStorage.getItem('dao-den-long.colorblind') === 'true'; } catch {}
document.documentElement.classList.toggle('colorblind', colorblind.checked);
applyColorblindColors();
colorblind.addEventListener('change', () => {
  document.documentElement.classList.toggle('colorblind', colorblind.checked);
  applyColorblindColors();
  try { localStorage.setItem('dao-den-long.colorblind', String(colorblind.checked)); } catch {}
});
const reducedMotion = byId('reduced-motion');
for (const [id, className] of [['reduced-motion', 'reduced-motion'], ['large-text', 'large-text']]) {
  const input = byId(id);
  try { input.checked = localStorage.getItem(`dao-den-long.${id}`) === 'true'; } catch {}
  document.documentElement.classList.toggle(className, input.checked);
  input.addEventListener('change', () => {
    document.documentElement.classList.toggle(className, input.checked);
    try { localStorage.setItem(`dao-den-long.${id}`, String(input.checked)); } catch {}
  });
}
for (const button of document.querySelectorAll('[data-rebind]')) {
  button.addEventListener('click', () => {
    listeningAction = button.dataset.rebind;
    label(byId('keybind-message'), `Nhấn phím mới cho “${button.parentElement.firstElementChild.textContent}”…`);
    button.textContent = '…';
  });
}
byId('reset-bindings').addEventListener('click', () => {
  bindings = { ...defaultBindings };
  listeningAction = null;
  try { localStorage.removeItem('dao-den-long.bindings'); } catch {}
  refreshBindings();
  label(byId('keybind-message'), 'Phím đã được khôi phục mặc định.');
});
byId('settings').addEventListener('keydown', event => {
  if (!listeningAction) return;
  event.stopPropagation();
  event.preventDefault();
  if (event.code === 'Escape') {
    listeningAction = null;
    refreshBindings();
    label(byId('keybind-message'), 'Đã hủy đổi phím.');
    return;
  }
  if (!/^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|Enter)$/.test(event.code)) {
    label(byId('keybind-message'), 'Phím này không dùng được.');
    return;
  }
  const usedBy = Object.keys(bindings).find(action => bindings[action] === event.code && action !== listeningAction);
  if (usedBy || ['KeyF', 'KeyR'].includes(event.code)) {
    label(byId('keybind-message'), 'Phím này đã được gán. Hãy chọn phím khác.');
    return;
  }
  bindings[listeningAction] = event.code;
  try { localStorage.setItem('dao-den-long.bindings', JSON.stringify(bindings)); } catch {}
  listeningAction = null;
  refreshBindings();
  label(byId('keybind-message'), 'Đã lưu phím mới.');
});

const notes = {
  mote_picked: [660, 920], deposit: [494, 622], lantern_lit: [523, 659, 784, 1047],
  player_hit: [175, 105], pulse: [370, 275], blink: [740, 1050], beam: [554, 370],
  dash: [138, 277], jump: [246, 370], shade_spawned: [86, 102], countdown: [680],
  won: [392, 523, 659, 784, 1047], lost: [329, 293, 220, 164], wind: [185, 196, 181, 154],
  charm_picked: [880, 1174, 1568], drifter_steal: [330, 220], drifter_drop: [440, 660],
};
function unlockAudio() {
  if (!window.AudioContext) return;
  if (!audio) {
    audio = new AudioContext();
    master = audio.createGain();
    master.gain.value = settings.volume / 100;
    master.connect(audio.destination);
  }
  if (audio.state === 'suspended') audio.resume().catch(() => {});
}
function playTone(frequency, time, duration, gain, type = 'sine') {
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  volume.gain.setValueAtTime(.0001, time);
  volume.gain.exponentialRampToValueAtTime(gain, time + Math.min(.035, duration * .25));
  volume.gain.exponentialRampToValueAtTime(.0001, time + duration);
  oscillator.connect(volume).connect(master);
  oscillator.start(time);
  oscillator.stop(time + duration);
}
function playCue(name) {
  if (audio?.state !== 'running' || !notes[name]) return;
  const windy = name === 'wind';
  notes[name].forEach((note, index) => {
    playTone(note, audio.currentTime + index * (windy ? .14 : .072), windy ? .53 : .2,
      .12, windy || name === 'player_hit' || name === 'dash' ? 'triangle' : 'sine');
  });
}
function playMusic() {
  if (audio?.state !== 'running' || game.simTick - lastMusic < 42) return;
  lastMusic = game.simTick;
  const melodies = [[196, 0, 293.66, 329.63, 0, 246.94, 220, 0],
    [164.81, 246.94, 0, 293.66, 329.63, 0, 246.94, 196],
    [146.83, 220, 261.63, 0, 293.66, 220, 0, 196]];
  const track = melodies[game.night - 1];
  const beat = Math.floor(game.simTick / 42) % track.length;
  if (track[beat]) playTone(track[beat], audio.currentTime, 1.1, .038);
  if (beat % 4 === 0) playTone(track[0] / 2, audio.currentTime, 2.4, .037, 'triangle');
}

function showDialog(id) {
  activeDialog?.close();
  activeDialog = id ? byId(id) : null;
  activeDialog?.showModal();
}
function resetNight(night) {
  game = createGame(42, {}, night);
  accumulator = 0;
  pulseAt = -Infinity;
  pulseCenter = null;
  messageUntil = 0;
  lastCountdown = Infinity;
  lastMusic = -42;
  pauseRequested = false;
  hasPointer = false;
  for (const trail of Object.values(trails)) trail.userData.expires = 0;
  keys.clear();
  taps.clear();
  may.rotation.y = 0;
  hint.classList.remove('danger');
  const title = `Đêm ${night} · ${names[night]}`;
  canvas.setAttribute('aria-label', title);
  label(byId('night-label'), title);
  buildNightMap();
}
function returnToMenu() {
  activeNight = false;
  totalScore = 0;
  nightsWon = 0;
  resetNight(1);
  byId('hud').hidden = true;
  showDialog('menu');
}
function startBenchmark() {
  let seed = Number(query.get('seed') ?? 42);
  const gameSeed = seed;
  const random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
  const shades = Array.from({ length: 200 }, (_, i) => {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 39;
    return { id: `S${i + 1}`, state: 'wander', pos: [Math.cos(angle) * radius, 1, Math.sin(angle) * radius] };
  });
  const motes = Array.from({ length: 100 }, () => {
    const angle = random() * Math.PI * 2;
    const radius = random() * 33;
    return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
  });
  game = createGame(gameSeed, { random_shades: false, random_drifters: false, random_motes: false,
    player: { pos: [0, 0, 0] }, shades, motes,
    lanterns: ['L1', 'L2', 'L3'].map(id => ({ id, lit: true, fuel: 100 })) }, 1);
  game.benchmark = true;
  updateRefuges(game);
  buildNightMap();
  byId('hud').hidden = true;
  showDialog();
  activeNight = true;
}
function showIntro(night) {
  activeNight = false;
  resetNight(night);
  label(byId('intro-night'), `Đêm ${night}`);
  label(byId('intro-title'), names[night]);
  label(byId('intro-story'), `Ông Đăng: ${stories[night]}`);
  byId('hud').hidden = true;
  showDialog('intro');
}
function startNight() {
  activeNight = true;
  byId('hud').hidden = false;
  showDialog();
  unlockAudio();
}
function showSettings() {
  settingsFrom = activeDialog.id;
  showDialog('settings');
}
function requestPause() {
  pauseRequested = true;
  keys.clear();
  taps.clear();
}
const buttons = {
  play: () => showIntro(1), 'start-night': startNight,
  'menu-leaderboard': showLeaderboard, 'leaderboard-back': () => showDialog('menu'),
  'intro-menu': returnToMenu, 'pause-menu': returnToMenu, 'result-menu': returnToMenu,
  'menu-settings': showSettings, 'pause-settings': showSettings,
  'settings-back': () => { listeningAction = null; refreshBindings(); showDialog(settingsFrom); }, resume: requestPause,
  'pause-restart': () => showIntro(game.night),
  'result-action': () => {
    if (game.state === 'lost') showIntro(game.night);
    else if (game.night < 3) showIntro(game.night + 1);
    else { totalScore = 0; nightsWon = 0; showIntro(1); }
  },
};
for (const [id, handler] of Object.entries(buttons)) {
  byId(id).addEventListener('click', () => {
    unlockAudio();
    handler();
  });
}
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('cancel', event => event.preventDefault());
}
byId('score-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = byId('save-score');
  button.disabled = true;
  try {
    const response = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: byId('score-name').value, score: totalScore, nights_won: nightsWon, seed: 42 }) });
    label(byId('score-message'), response.ok ? 'Đã lưu điểm vào bảng xếp hạng.' : 'Không lưu được điểm.');
    button.disabled = response.ok;
  } catch {
    button.disabled = false;
    label(byId('score-message'), 'Không kết nối được với máy chủ cục bộ.');
  }
});
addEventListener('keydown', event => {
  if (benchmarkMode) return;
  if (event.code === 'Escape' || event.code === bindings.pause) {
    if (activeDialog?.id === 'settings' && event.code === 'Escape') {
      event.preventDefault();
      showDialog(settingsFrom);
    } else if (activeNight && (!activeDialog || activeDialog.id === 'pause')) {
      event.preventDefault();
      if (!event.repeat) requestPause();
    }
    return;
  }
  if (!activeNight || activeDialog || !controls.has(event.code)) return;
  event.preventDefault();
  if (event.repeat) return;
  if (actions.has(event.code)) taps.add(event.code);
  else keys.add(event.code);
});
addEventListener('pointermove', event => {
  if (!activeNight || activeDialog) return;
  pointer.set(event.clientX / innerWidth * 2 - 1, 1 - event.clientY / innerHeight * 2);
  hasPointer = true;
});
addEventListener('keyup', event => keys.delete(event.code));
addEventListener('blur', () => {
  keys.clear();
  taps.clear();
});

function showResult(reason) {
  activeNight = false;
  const won = game.state === 'won';
  if (won) { totalScore += game.score; nightsWon += 1; }
  playCue(won ? 'won' : 'lost');
  const dawn = won && game.night === 3;
  const explanations = {
    dawn_survived: 'Đủ đèn còn sáng đến bình minh.',
    dawn: 'Trời đã sáng khi vẫn còn đèn tắt.',
    no_flames: 'Mây đã hết Ngọn Lửa.',
  };
  label(byId('result-night'), `Đêm ${game.night} · ${names[game.night]}`);
  label(byId('result-title'), dawn ? 'Bình Minh' : won ? 'Đảo đã sáng!' : 'Màn đêm khép lại');
  label(byId('result-detail'), dawn
    ? `Cả ba đảo đã sáng. Tổng điểm ${totalScore}.`
    : `${explanations[reason]} ${game.score} điểm · ${game.player.flames} Ngọn Lửa.`);
  label(byId('result-action'), dawn ? 'Chơi lại từ Đêm 1' : won ? `Tiếp tục Đêm ${game.night + 1}` : 'Chơi lại Đêm');
  byId('result-menu').hidden = false;
  byId('score-form').hidden = !(!won || dawn);
  byId('score-name').value = '';
  byId('score-message').textContent = '';
  byId('save-score').disabled = false;
  showDialog('result');
}

async function showLeaderboard() {
  const list = byId('leaderboard-list');
  list.replaceChildren();
  try {
    const { entries } = await (await fetch('/api/leaderboard')).json();
    for (const entry of entries) {
      const item = document.createElement('li');
      item.textContent = `${entry.name} — ${entry.score} điểm · ${entry.nights_won}/3 đêm`;
      list.append(item);
    }
    if (!entries.length) list.textContent = 'Chưa có điểm được lưu.';
  } catch {
    list.textContent = 'Không đọc được bảng điểm. Hãy chạy game qua máy chủ cục bộ.';
  }
  showDialog('leaderboard');
}

function onEvent(event) {
  const { name, data } = event;
  playCue(name);
  if (name === 'paused') showDialog('pause');
  if (name === 'resumed') showDialog();
  if (name === 'game_over') showResult(data.reason);
  if (name === 'pulse') {
    pulseAt = game.simTick;
    const [x, y, z] = game.player.pos;
    pulseCenter = [x, y + .8, z];
  }
  if (name === 'blink') {
    const raise = ([x, y, z]) => [x, y + .8, z];
    flashTrail('blink', raise(data.from), raise(data.to));
  }
  if (name === 'beam') {
    const [x, y, z] = game.player.pos;
    const angle = data.aim_deg * Math.PI / 180;
    flashTrail('beam', [x, y + .55, z], [x + Math.sin(angle) * tuning.beam_range_m,
      y + .55, z + Math.cos(angle) * tuning.beam_range_m]);
  }
  const messages = {
    shade_spawned: '⚠ Bóng Mực xuất hiện!',
    mote_picked: '+1 đom đóm', deposit: `Đã nạp ${data.amount} ánh sáng`,
    lantern_lit: data.relight ? 'Đèn đã được thắp lại!' : 'Một ngọn đèn đã sáng!',
    refuel: `Đã châm dầu (${data.fuel}%)`, lantern_out: 'Một ngọn đèn đã tắt!',
    player_hit: data.by === 'fall' ? 'Mây đã rơi khỏi đảo!' : 'Bóng Mực đã chạm vào Mây!',
    pulse: 'Mây tỏa sáng!', blink: 'Mây vừa dịch chuyển',
    beam: data.stunned_ids?.length ? `Chùm sáng trúng ${data.stunned_ids.length} Bóng Mực` : 'Mây đã bắn chùm sáng',
    charm_picked: 'Mây đã nhặt Bùa Gió!', drifter_steal: `Gió Lạc cướp ${data.amount} đom đóm!`,
  };
  if (messages[name]) {
    label(hint, messages[name]);
    messageUntil = game.simTick + (name === 'mote_picked' ? 30 : 80);
    hint.classList.toggle('danger', name === 'player_hit' || name === 'drifter_steal');
  }
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
resize();
addEventListener('resize', resize);
if (benchmarkMode) startBenchmark();
else returnToMenu();

const aimPointer = new THREE.Vector2();
function tickGame() {
  if (benchmarkMode) {
    game.simTick += 1;
    moveEnemies(game);
    return;
  }
  const x = Number(held(bindings.right, 'ArrowRight')) - Number(held(bindings.left, 'ArrowLeft'));
  const z = Number(held(bindings.down, 'ArrowDown')) - Number(held(bindings.up, 'ArrowUp'));
  const blink = taps.has('KeyF');
  const beam = taps.has('KeyR');
  let target;
  if ((blink || beam) && hasPointer) {
    aimPointer.copy(pointer).multiplyScalar(settings.sensitivity / 100);
    ray.setFromCamera(aimPointer, camera);
    groundPlane.constant = -game.player.pos[1];
    target = ray.ray.intersectPlane(groundPlane, aimPoint);
  }
  const pause = pauseRequested;
  const wasGrounded = game.player.grounded;
  const wasWarning = Boolean(game.wind?.warning || game.wind?.warningTicks > 0);
  const before = game.simTick;
  pauseRequested = false;
  stepGame(game, { move: [x, z], cam_yaw_deg: 0, aim_deg: may.rotation.y * 180 / Math.PI,
    blink, beam, dash: taps.has(bindings.dash) || taps.has('ShiftRight'), pause,
    jump: taps.has(bindings.jump), pulse: taps.has(bindings.pulse), interact: taps.has(bindings.interact) }, onEvent, target);
  taps.clear();
  if (game.simTick === before) return;
  const stride = x || z ? Math.sin(game.simTick * .22) * .14 : 0;
  boots[0].position.z = stride;
  boots[1].position.z = -stride;
  if (x || z) may.rotation.y = Math.atan2(x, z);
  if (wasGrounded && game.player.vel?.[1] > 0) playCue('jump');
  if (!wasWarning && (game.wind?.warning || game.wind?.warningTicks > 0)) playCue('wind');
  const seconds = Math.ceil(game.timeLeft);
  if (seconds > 0 && seconds <= 10 && seconds !== lastCountdown) playCue('countdown');
  lastCountdown = seconds;
  if (game.state === 'playing') playMusic();
}

function drawWind() {
  const warning = Boolean(game.wind?.warning || game.wind?.warningTicks > 0);
  const { active, dir_deg } = game.wind ?? {};
  const wind = byId('wind-warning');
  wind.hidden = !(warning || active);
  if (!wind.hidden) label(wind, warning ? 'Gió mạnh sắp tới!' : 'Gió mạnh');
  windLeaves.visible = warning || active;
  if (!windLeaves.visible) return;
  const [x, y, z] = game.player.pos;
  const angle = (90 - (dir_deg ?? game.wind.pendingDirection ?? 0)) * Math.PI / 180;
  const time = game.simTick / HZ;
  for (let i = 0; i < windLeaves.count; i += 1) {
    const drift = (i * 7.53 + time * (active ? 21 : 12)) % 40 - 20;
    const across = (i * 14.61) % 45 - 22.5;
    windParticle.position.set(x + drift * Math.cos(angle) - across * Math.sin(angle),
      y + .6 + i % 7 + Math.sin(time * 3 + i), z + drift * Math.sin(angle) + across * Math.cos(angle));
    windParticle.rotation.set(i + time, time * 2 + i, angle + time * 3);
    windParticle.scale.setScalar(.21 + i % 3 * .045);
    windParticle.updateMatrix();
    windLeaves.setMatrixAt(i, windParticle.matrix);
  }
  windLeaves.instanceMatrix.needsUpdate = true;
}

const screenPoint = new THREE.Vector3();
const arrow = byId('lamp-arrow');
function markNearestLantern(x, y, z) {
  let nearest;
  let distance = Infinity;
  for (const lamp of game.lanterns) {
    if (lamp.lit && lamp.fuelUnits >= tuning.fuel_max * HZ) continue;
    const gap = Math.hypot(lamp.pos[0] - x, lamp.pos[1] - y, lamp.pos[2] - z);
    if (gap < distance) {
      nearest = lamp;
      distance = gap;
    }
  }
  arrow.hidden = true;
  if (!nearest) return;
  screenPoint.set(nearest.pos[0], nearest.pos[1] + 2.4, nearest.pos[2]).project(camera);
  if (screenPoint.z <= 1 && Math.abs(screenPoint.x) < .98 && Math.abs(screenPoint.y) < .98) return;
  const sign = screenPoint.z > 1 ? -1 : 1;
  const dx = sign * screenPoint.x * innerWidth;
  const dy = -sign * screenPoint.y * innerHeight;
  const edge = Math.max(Math.abs(dx) / (innerWidth / 2 - 44), Math.abs(dy) / (innerHeight / 2 - 76)) || 1;
  arrow.hidden = false;
  arrow.style.left = `${innerWidth / 2 + dx / edge}px`;
  arrow.style.top = `${innerHeight / 2 + dy / edge}px`;
  arrow.firstElementChild.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  label(arrow.lastElementChild, nearest.id);
}

function markNearestShade(x, y, z) {
  const marker = byId('shade-arrow');
  const shade = [...game.shades]
    .sort((a, b) => Math.hypot(a.pos[0] - x, a.pos[2] - z) - Math.hypot(b.pos[0] - x, b.pos[2] - z))[0];
  marker.hidden = true;
  if (!shade) return;
  screenPoint.set(shade.pos[0], shade.pos[1] + 1.5, shade.pos[2]).project(camera);
  const sign = screenPoint.z > 1 ? -1 : 1;
  const dx = sign * screenPoint.x * innerWidth;
  const dy = -sign * screenPoint.y * innerHeight;
  const edge = Math.max(Math.abs(dx) / (innerWidth / 2 - 75), Math.abs(dy) / (innerHeight / 2 - 75)) || 1;
  marker.hidden = false;
  marker.firstElementChild.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  marker.style.left = `${innerWidth / 2 + dx / edge}px`;
  marker.style.top = `${innerHeight / 2 + dy / edge}px`;
}

function drawHud(lit, x, y, z) {
  const { player, lanterns, simTick } = game;
  hud.flames.setAttribute('aria-label', `${player.flames}/${tuning.flames}`);
  flames.forEach((flame, i) => flame.classList.toggle('spent', i >= player.flames));
  slots.forEach((slot, i) => slot.classList.toggle('filled', i < player.carried));
  label(hud.carried, `${player.carried}/${Math.min(tuning.capacity_max, tuning.carry_capacity + 2 * player.successfulLights)}`);
  label(hud.lanterns, `${lit}/${lanterns.length}`);
  const seconds = Math.max(0, Math.ceil(game.timeLeft));
  label(hud.time, `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
  hud.time.parentElement.classList.toggle('danger', seconds <= 30);
  const countdown = byId('countdown-warning');
  countdown.hidden = seconds > 10;
  if (!countdown.hidden) label(countdown, `⚠ Còn ${seconds} giây`);
  label(hud.score, game.score);
  const lowLamps = lanterns.filter(lamp => lamp.lit && lamp.fuelUnits < tuning.low_fuel_threshold * HZ);
  const fuelAlert = byId('fuel-alert');
  fuelAlert.hidden = !lowLamps.length;
  if (!fuelAlert.hidden) label(fuelAlert, `⚠ Đèn ${lowLamps.map(lamp => lamp.id).join(', ')} đang cạn dầu`);
  const charm = Math.max(0, (player.charmUntil ?? game.charmUntil ?? 0) - simTick);
  const charmStatus = byId('charm-status');
  charmStatus.hidden = !charm;
  if (charm) label(charmStatus, `Bùa Gió ${Math.ceil(charm / HZ)}s`);
  for (const [name, element] of abilities) {
    const readyAt = name === 'dash' && charm ? player.dashUntil ?? 0 : game[`${name}ReadyAt`];
    const left = readyAt - simTick;
    const cost = tuning[`${name}_cost`] ?? 0;
    const ready = left <= 0 && player.carried >= cost;
    element.classList.toggle('ready', ready);
    label(element, left > 0 ? `${(Math.ceil(left / HZ * 10) / 10).toFixed(1)}s` : ready ? 'Sẵn sàng' : `Cần ${cost} ánh sáng`);
  }
  const lamp = nearbyLantern(game);
  const deposit = byId('deposit-hint');
  deposit.hidden = !lamp;
  if (lamp) {
    const cost = lamp.everLit ? tuning.relight_cost : tuning.lantern_cost;
    label(deposit.querySelector('span'), lamp.lit ? `${bindingLabel(bindings.interact)} — Châm dầu` :
      `${bindingLabel(bindings.interact)} — ${lamp.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${lamp.deposited}/${cost})`);
    const fuel = byId('lamp-fuel');
    fuel.hidden = !lamp.lit;
    fuel.value = lamp.fuelUnits / HZ;
    fuel.classList.toggle('low', lamp.lit && lamp.fuelUnits < tuning.low_fuel_threshold * HZ);
  }
  hint.hidden = simTick >= messageUntil;
  markNearestLantern(x, y, z);
  markNearestShade(x, y, z);
}
let previousTime = performance.now();
let benchmarkStart;
let previousBenchFrame;
const benchmarkFrames = [];
if (benchmarkMode) window.__benchResult = null;
renderer.setAnimationLoop(now => {
  if (activeNight) {
    accumulator += Math.max(0, Math.min(.1, (now - previousTime) / 1000));
    while (accumulator >= 1 / HZ && activeNight) {
      tickGame();
      accumulator -= 1 / HZ;
    }
  }
  previousTime = now;

  const { pos: [x, y, z], invulnerableUntil, respawnAt } = game.player;
  const simTick = game.simTick;
  const overview = activeDialog?.id === 'menu' || (activeDialog?.id === 'settings' && settingsFrom === 'menu');
  may.position.set(x, y, z);
  may.visible = !(respawnAt > simTick) && (reducedMotion.checked || simTick >= invulnerableUntil || simTick % 10 < 7);
  const cameraY = Math.max(-1.5, y);
  if (benchmarkMode) {
    benchmarkStart ??= now;
    const angle = (now - benchmarkStart) / 15000 * Math.PI * 2;
    camera.position.set(30 * Math.cos(angle), 15, -30 * Math.sin(angle));
    camera.lookAt(0, 0, 0);
  } else {
    camera.position.set(x, 23 + cameraY, z + 23);
    camera.lookAt(x, cameraY + .55, z - 5);
  }
  if (overview && !benchmarkMode) {
    camera.position.set(-3, 39, 47);
    camera.lookAt(0, -4, -5);
  }
  camera.updateMatrixWorld();
  if (bellTower) {
    const inFrontOfMay = Math.abs(x) < 3.5 && z < 0 && z > -23;
    for (const child of bellTower.children) {
      child.material.opacity = inFrontOfMay ? .24 : 1;
      child.material.depthWrite = !inFrontOfMay;
    }
  }
  const lit = game.lanterns.filter(lamp => lamp.lit).length;
  const progress = lit / game.lanterns.length;
  ambient.intensity = .15 + .55 * progress;
  ambient.color.set(0xc5d6ff).lerp(warmGlow, progress * .38);
  for (const lamp of game.lanterns) {
    const visual = lamps.get(lamp.id);
    const lowFuelBlink = !reducedMotion.checked && lamp.lit && lamp.fuelUnits < tuning.low_fuel_threshold * HZ &&
      Math.floor(simTick / (HZ / 2)) % 2 === 1;
    const safe = lamp.lit && lamp.fuelUnits >= tuning.low_fuel_threshold * HZ;
    visual.object.scale.setScalar(lamp.lit ? 1 : .8);
    visual.ring.scale.setScalar(lamp.lit ? 1 : 1.25);
    visual.lightPaper.material.color.set(color(lamp.lit ? '--core' : '--unlit'));
    visual.lightPaper.material.emissiveIntensity = lamp.lit ? .9 : 0;
    visual.tears.forEach(tear => { tear.visible = !lamp.lit; });
    visual.object.visible = !lowFuelBlink;
    visual.light.visible = visual.halo.visible = lamp.lit && !lowFuelBlink;
    visual.ring.visible = safe;
    visual.marker.classList.toggle('lit', lamp.lit);
  }
  markPosition(mapPlayer, x, z);
  const pulseProgress = (simTick - pulseAt) / 24;
  pulseRing.visible = !reducedMotion.checked && pulseProgress < 1 && pulseCenter !== null;
  if (pulseRing.visible) {
    pulseRing.position.set(...pulseCenter);
    pulseRing.scale.setScalar(Math.max(.05, pulseProgress * tuning.pulse_radius));
    pulseRing.material.opacity = 1 - pulseProgress;
  }
  for (const trail of Object.values(trails)) {
    const left = trail.userData.expires - simTick;
    trail.visible = !reducedMotion.checked && left > 0;
    trail.children[0].material.opacity = left / 28;
  }
  const motion = simTick / HZ;
  syncObjects(game.motes, motes, moteTemplate, (object, { id, pos }) => {
    object.position.set(pos[0], pos[1] + .68 + Math.sin(motion * 4 + Number(id.slice(1))) * .22, pos[2]);
  });
  syncObjects(game.shades, shades, shadeTemplate, (object, shade) => {
    const [sx, sy, sz] = shade.pos;
    object.position.set(sx, sy + Math.sin(motion * 6 + sx) * .12, sz);
    object.rotation.y = Math.atan2(x - sx, z - sz);
    object.children[0].material = shade.state === 'stunned' ? stunnedSurface : shadeSurface;
    object.scale.setScalar(shade.state === 'spawning' ? .7 + .15 * Math.sin(motion * 13) : 1);
  });
  syncObjects(game.drifters.filter(entry => entry.state !== 'removed'), drifters, drifterTemplate, (object, entry) => {
    const [dx, dy, dz] = entry.pos;
    object.position.set(dx, dy + .35 + Math.sin(motion * 5 + dx) * .3, dz);
    object.rotation.y = Math.atan2(x - dx, z - dz) + (entry.state === 'flee' ? Math.PI : 0);
  });
  syncObjects(game.charms.filter(entry => entry.available), charms, charmTemplate, (object, entry) => {
    const [cx, cy, cz] = entry.pos;
    object.position.set(cx, cy + .68 + Math.sin(motion * 4) * .14, cz);
    object.rotation.y = motion * 1.3;
  });
  drawWind();
  if (!byId('hud').hidden) drawHud(lit, x, y, z);
  renderer.render(scene, camera);
  if (benchmarkMode) {
    const elapsed = now - benchmarkStart;
    if (previousBenchFrame !== undefined && elapsed >= 3000 && elapsed <= 3000 + benchmarkDuration * 1000) {
      benchmarkFrames.push(now - previousBenchFrame);
    }
    previousBenchFrame = now;
    if (elapsed >= 3000 + benchmarkDuration * 1000) {
      activeNight = false;
      renderer.setAnimationLoop(null);
      const result = summarizeFrames(benchmarkFrames);
      window.__benchResult = result;
      fetch('/api/bench-result', { method: 'POST', headers: { 'Content-Type': 'application/json',
        'X-Bench-Token': query.get('token') },
      body: JSON.stringify({ contract_version: contract.contract_version, ...result,
        load_ms: Math.round(performance.timeOrigin + benchmarkStart - Number(query.get('started'))),
        peak_mem_mb: null, vsync_off: false, renderer: `Three.js r${THREE.REVISION} WebGLRenderer`, os: navigator.userAgent }) });
    }
    window.__benchReady = true;
  }
});
