import * as THREE from 'three';
import { createGame, HZ, ISLAND_RADIUS, nearbyLantern, stepGame, tuning } from './game.js';

const byId = id => document.getElementById(id);
const hint = byId('hint');
const result = byId('result');
const canvas = byId('world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch {
  hint.textContent = 'Cần trình duyệt hỗ trợ WebGL 2 để chơi.';
  throw new Error('WebGL 2 unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x24263f);
scene.fog = new THREE.FogExp2(0x24263f, 0.009);
const camera = new THREE.PerspectiveCamera(53, 1, 0.1, 210);
const ambient = new THREE.HemisphereLight(0xc5d6ff, 0x514164, 1.4);
const moonlight = new THREE.DirectionalLight(0xb1c7ff, 1.15);
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

const ground = material(0x435565);
mesh(scene, new THREE.CylinderGeometry(ISLAND_RADIUS, 26, 5, 64), [material(0x394052), ground, ground], 0, -2.5);
mesh(scene, new THREE.CylinderGeometry(26, 11, 9, 18), material(0x333249), 0, -9.5);
const trail = material(0x706775);
const rock = new THREE.DodecahedronGeometry(1, 0);
const rockSurface = material(0x62677d);
const stalk = material(0x524854);
const crowns = [material(0x38475d), material(0x526775), material(0x4f536d)];
const cloud = material(0x8e86a2, { roughness: 1 });
const treeCone = new THREE.ConeGeometry(1, 1, 6);
let scenerySeed = 174;
function decorationRandom() {
  scenerySeed = (Math.imul(1664525, scenerySeed) + 1013904223) >>> 0;
  return scenerySeed / 4294967296;
}
for (let i = 0; i < 53; i += 1) {
  const angle = (i + decorationRandom() * 0.7) * Math.PI * 2 / 53;
  const radius = 28 + decorationRandom() * 4.9;
  const x = radius * Math.cos(angle);
  const z = radius * Math.sin(angle);
  if (i % 3 === 0) {
    const boulder = mesh(scene, rock, rockSurface, x, 0.38, z);
    boulder.scale.set(0.6 + decorationRandom(), 0.55 + decorationRandom(), 0.6 + decorationRandom());
    boulder.rotation.y = angle;
  } else {
    const size = 0.8 + decorationRandom() * 1.2;
    mesh(scene, new THREE.CylinderGeometry(.11, .2, 1.8, 5), stalk, x, .9, z);
    for (let j = 0; j < 2; j += 1) {
      const foliage = mesh(scene, treeCone, crowns[i % 3], x, (1.6 + j * .8) * size, z);
      foliage.scale.set(size * (1.35 - j * .3), size * 2.2, size * (1.35 - j * .3));
      foliage.rotation.y = angle + j;
    }
  }
}
for (let i = 0; i < 29; i += 1) {
  const angle = (i + decorationRandom()) * Math.PI * 2 / 29;
  const radius = 39 + decorationRandom() * 32;
  for (let j = 0; j < 3; j += 1) {
    const puff = mesh(scene, rock, cloud, radius * Math.cos(angle) + j * 3.5,
      -7 - decorationRandom() * 5, radius * Math.sin(angle));
    puff.scale.set(4 + decorationRandom() * 5, 1 + decorationRandom() * 2, 3 + decorationRandom() * 3);
  }
}
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

const paper = material(0xffbd6c, { emissive: 0xffa646, emissiveIntensity: .8 });
const frame = material(0x352534);
const lanternGeometry = new THREE.CylinderGeometry(.66, .52, .96, 6);
const lamps = new Map();
const map = byId('map');
const mapPlayer = document.createElement('i');
mapPlayer.className = 'you';
map.append(mapPlayer);
function markPosition(marker, x, z) {
  marker.style.left = `${50 + x * 46 / ISLAND_RADIUS}%`;
  marker.style.top = `${50 + z * 46 / ISLAND_RADIUS}%`;
}
function makeLamp(lamp) {
  const [x, , z] = lamp.pos;
  const path = mesh(scene, new THREE.BoxGeometry(1.8, .025, 17), trail, x * .44, .013, z * .44);
  path.rotation.y = Math.atan2(x, z);
  const object = new THREE.Group();
  object.position.set(...lamp.pos);
  scene.add(object);
  mesh(object, new THREE.CylinderGeometry(.9, 1.16, .25, 8), rockSurface, 0, .125);
  mesh(object, new THREE.CylinderGeometry(.17, .24, 2.75, 8), frame, 0, 1.45);
  const lightPaper = mesh(object, lanternGeometry, paper.clone(), 0, 3.02);
  mesh(object, new THREE.CylinderGeometry(.64, .71, .12, 6), frame, 0, 2.53);
  mesh(object, new THREE.ConeGeometry(1.08, .49, 6), material(0x79524b), 0, 3.72);
  const halo = glow(object, 0xffaa4e, 8.2, 3.05);
  const light = new THREE.PointLight(0xffaf5e, 70, 14, 1.6);
  light.position.y = 2.75;
  object.add(light);
  const ring = mesh(object, new THREE.RingGeometry(tuning.safe_radius - .06, tuning.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: 0xffbc70, opacity: .65, transparent: true }), 0, .034);
  ring.rotation.x = -Math.PI / 2;
  const marker = document.createElement('i');
  markPosition(marker, x, z);
  map.insertBefore(marker, mapPlayer);
  lamps.set(lamp.id, { lightPaper, halo, light, ring, marker });
}

const may = new THREE.Group();
scene.add(may);
const skin = material(0xe9ae87);
const clothes = material(0x6d99a5);
const feet = material(0x2d2539);
mesh(may, new THREE.CylinderGeometry(.40, .60, .96, 8), clothes, 0, .89);
mesh(may, new THREE.SphereGeometry(.41, 12, 8), skin, 0, 1.56);
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
  new THREE.MeshBasicMaterial({ color: 0xffd16a, transparent: true, depthWrite: false }));
pulseRing.rotation.x = -Math.PI / 2;

const motes = new Map();
const moteGeometry = new THREE.IcosahedronGeometry(.14, 0);
const moteSurface = new THREE.MeshBasicMaterial({ color: 0xffdc87 });
const moteTemplate = new THREE.Group();
mesh(moteTemplate, moteGeometry, moteSurface);
glow(moteTemplate, 0xffb444, 1.6, 0);
const shades = new Map();
const shadeSurface = material(0x2d1d42, { emissive: 0x4a265e, emissiveIntensity: .45 });
const stunnedSurface = material(0x573d74, { emissive: 0x955bc7, emissiveIntensity: .7 });
const shadeTemplate = new THREE.Group();
const shadeBody = mesh(shadeTemplate, new THREE.IcosahedronGeometry(.84, 1), shadeSurface);
shadeBody.scale.y = 1.22;
const eye = new THREE.MeshBasicMaterial({ color: 0xdfafff });
for (const x of [-.26, .26]) mesh(shadeTemplate, new THREE.SphereGeometry(.09, 9, 6), eye, x, .12, .75);
glow(shadeTemplate, 0x794298, 3.8, -.03);
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
const actions = new Set(['Space', 'KeyE', 'KeyQ']);
const controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyQ']);
const held = (...codes) => codes.some(code => keys.has(code));
let game;
let started;
let accumulator;
let pulseAt;
let message;
let messageUntil;
function reset() {
  game = createGame(42);
  started = false;
  accumulator = 0;
  pulseAt = -Infinity;
  messageUntil = 0;
  keys.clear();
  taps.clear();
  may.rotation.y = 0;
}
reset();
for (const lamp of game.lanterns) makeLamp(lamp);

addEventListener('keydown', event => {
  if (!controls.has(event.code) || result.open) return;
  event.preventDefault();
  if (event.repeat) return;
  if (actions.has(event.code)) taps.add(event.code);
  else keys.add(event.code);
  started = true;
});
addEventListener('keyup', event => keys.delete(event.code));
addEventListener('blur', () => {
  keys.clear();
  taps.clear();
});
result.addEventListener('cancel', event => event.preventDefault());
byId('restart').addEventListener('click', () => {
  result.close();
  reset();
});

function onEvent(event) {
  if (event.name === 'pulse') pulseAt = game.tick;
  if (event.name === 'lantern_lit' || event.name === 'player_hit') {
    message = event.name === 'lantern_lit' ? 'Một ngọn đèn đã sáng!' : 'Bóng Mực đã chạm vào Mây!';
    messageUntil = game.tick + 105;
  }
  if (event.name === 'game_over') {
    byId('result-title').textContent = game.state === 'won' ? 'Đảo đã sáng!' : 'Màn đêm khép lại';
    const reason = { all_lit: 'Mây đã thắp sáng cả năm ngọn đèn.', dawn: 'Trời đã sáng trước khi thắp hết đèn.', no_flames: 'Mây đã hết sinh lực.' };
    byId('result-detail').textContent = `${reason[event.data.reason]} · ${game.score} điểm`;
    result.showModal();
  }
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
resize();
addEventListener('resize', resize);
const hud = Object.fromEntries(['flames', 'carried', 'lanterns', 'time', 'score'].map(id => [id, byId(id)]));
const label = (element, text) => {
  if (element.textContent !== String(text)) element.textContent = text;
};

let previousTime = performance.now();
renderer.setAnimationLoop(now => {
  if (started && game.state === 'playing') {
    accumulator += Math.min(.1, (now - previousTime) / 1000);
    while (accumulator >= 1 / HZ && game.state === 'playing') {
      const x = Number(held('KeyD', 'ArrowRight')) - Number(held('KeyA', 'ArrowLeft'));
      const z = Number(held('KeyS', 'ArrowDown')) - Number(held('KeyW', 'ArrowUp'));
      if (x || z) may.rotation.y = Math.atan2(x, z);
      const stride = x || z ? Math.sin(game.tick * .22) * .14 : 0;
      boots[0].position.z = stride;
      boots[1].position.z = -stride;
      stepGame(game, { move: [x, z], cam_yaw_deg: 0,
        jump: taps.has('Space'), pulse: taps.has('KeyQ'), interact: taps.has('KeyE') }, onEvent);
      taps.clear();
      accumulator -= 1 / HZ;
    }
  }
  previousTime = now;

  const [x, y, z] = game.player.pos;
  may.position.set(x, y, z);
  may.visible = game.tick >= game.player.invulnerableUntil || game.tick % 10 < 7;
  camera.position.set(x * .68, 29 + y * .18, z * .67 + 33);
  camera.lookAt(x * .80, .55, z * .78 - 4.5);
  const lit = game.lanterns.filter(lamp => lamp.lit).length;
  ambient.intensity = 1.4 + lit * .19;
  for (const lamp of game.lanterns) {
    const visual = lamps.get(lamp.id);
    visual.lightPaper.material.color.setHex(lamp.lit ? 0xffc47b : 0x926b60);
    visual.lightPaper.material.emissiveIntensity = lamp.lit ? 1.1 : .09;
    visual.light.visible = visual.halo.visible = visual.ring.visible = lamp.lit;
    visual.marker.classList.toggle('lit', lamp.lit);
  }
  markPosition(mapPlayer, x, z);
  const pulseProgress = (game.tick - pulseAt) / 24;
  pulseRing.visible = pulseProgress < 1;
  if (pulseRing.visible) {
    pulseRing.position.set(x, .06, z);
    pulseRing.scale.setScalar(Math.max(.05, pulseProgress * tuning.pulse_radius));
    pulseRing.material.opacity = 1 - pulseProgress;
  }
  syncObjects(game.motes, motes, moteTemplate, (object, { id, pos }) => {
    object.position.set(pos[0], .68 + Math.sin(now * .004 + Number(id.slice(1))) * .22, pos[2]);
  });
  syncObjects(game.shades, shades, shadeTemplate, (object, shade) => {
    const [sx, sy, sz] = shade.pos;
    object.position.set(sx, sy + Math.sin(now * .006 + sx) * .12, sz);
    object.rotation.y = Math.atan2(x - sx, z - sz);
    object.children[0].material = shade.state === 'stunned' ? stunnedSurface : shadeSurface;
  });

  label(hud.flames, `${game.player.flames}/${tuning.flames}`);
  label(hud.carried, `${game.player.carried}/${tuning.carry_capacity}`);
  label(hud.lanterns, `${lit}/${game.lanterns.length}`);
  const seconds = Math.max(0, Math.ceil(game.timeLeft));
  label(hud.time, `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
  label(hud.score, game.score);
  const lamp = nearbyLantern(game);
  if (!started) label(hint, 'Nhấn phím di chuyển để bắt đầu');
  else if (game.tick < messageUntil) label(hint, message);
  else if (lamp) label(hint, `${lamp.deposited}/${tuning.lantern_cost} ánh sáng · ${game.player.carried ? 'E để nạp đèn' : 'Tìm thêm đom đóm'}`);
  else label(hint, '');
  renderer.render(scene, camera);
});
