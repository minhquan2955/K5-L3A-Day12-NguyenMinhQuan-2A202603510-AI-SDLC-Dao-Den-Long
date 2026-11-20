import contract from './game.contract.json' with { type: 'json' };
import { blockedAt, groundBelow, rampHeight } from './maps.js';

const t = contract.tuning;
const HZ = 60;
const EPSILON = 1e-9;
const TAU = 2 * Math.PI;
const SHADE_CENTER_HEIGHT = 1;
const ids = new Intl.Collator('en', { numeric: true });
const byId = (a, b) => ids.compare(a.id, b.id);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const inside = (pos, lamp) => distance(pos, lamp.pos) < t.safe_radius - EPSILON;

function direction(from, to) {
  const length = distance(from, to);
  return length ? [(to[0] - from[0]) / length, (to[2] - from[2]) / length] : [1, 0];
}

function nextId(prefix, entries) {
  const used = new Set(entries.map(entry => entry.id));
  let next = 0;
  return () => {
    let id;
    do { id = `${prefix}${++next}`; } while (used.has(id));
    used.add(id);
    return id;
  };
}

function createShade(game, entry) {
  const { pos, state_ticks_left = 1 } = entry;
  const state = entry.state ??
    (distance(pos, game.player.pos) <= t.shade_detect_radius ? 'chase' : 'wander');
  const shade = {
    id: entry.id ?? game.nextShadeId(),
    pos: [...pos],
    state,
    stateUntil: game.simTick + state_ticks_left,
    stunnedUntil: state === 'stunned' ? game.simTick + state_ticks_left : 0,
    heading: ((game.shades?.length ?? 0) + pos[0] + pos[2]) % TAU,
    evictedAt: -1,
  };
  if (state === 'recoil') shade.recoil = direction(game.player.pos, pos);
  return shade;
}

function createDrifter(game, entry) {
  const { pos, state = 'idle', stolen = 0, state_ticks_left = t.drifter_flee_ticks } = entry;
  return {
    id: entry.id ?? game.nextDrifterId(),
    pos: [...pos],
    state,
    stolen,
    stateUntil: game.simTick + state_ticks_left,
    heading: (pos[0] + pos[2]) % TAU,
  };
}

export function initEnemies(game, scenario) {
  const shades = scenario.shades ?? [];
  const drifters = scenario.drifters ?? [];
  game.nextShadeId = nextId('S', shades);
  game.nextDrifterId = nextId('D', drifters);
  game.spawnShades = scenario.random_shades ?? (scenario.shades === undefined);
  game.spawnDrifters = game.night !== 1 &&
    (scenario.random_drifters ?? (scenario.drifters === undefined));
  game.refuges = [];
  game.shades = shades.map(entry => createShade(game, entry));
  game.drifters = drifters.map(entry => createDrifter(game, entry));
}

function groundStep(map, pos, dx, dz) {
  const [x, y, z] = pos;
  const nextX = x + dx;
  const nextZ = z + dz;
  const floor = groundBelow(map, x, z, y + EPSILON);
  if (floor === null) {
    return blockedAt(map, nextX, nextZ, y) ? null : [nextX, y, nextZ];
  }
  // The climbable ramps rise at half a meter for each horizontal meter.
  const rise = Math.hypot(dx, dz) * 0.5 + EPSILON;
  const top = groundBelow(map, nextX, nextZ, floor + rise);
  if (top === null || floor - top > rise || blockedAt(map, nextX, nextZ, top)) return null;
  if (map.tiers) {
    const surface = groundBelow(map, nextX, nextZ);
    if (surface > top + EPSILON && surface !== rampHeight(map, nextX, nextZ) &&
        surface !== groundBelow(map, x, z)) return null;
  }
  return [nextX, y + top - floor, nextZ];
}

function refugeCrossings(pos, dx, dz, lamp) {
  const x = pos[0] - lamp.pos[0];
  const z = pos[2] - lamp.pos[2];
  const parallel = x * dx + z * dz;
  const perpendicular = x * dz - z * dx;
  const r = t.safe_radius;
  const square = r * r - perpendicular * perpendicular;
  if (square <= 0) return null;
  const root = Math.sqrt(square);
  return [-parallel - root, -parallel + root];
}

function moveShadeAlong(game, shade, [dx, dz], step) {
  let travel = step;
  for (const lamp of game.refuges) {
    const crossing = refugeCrossings(shade.pos, dx, dz, lamp);
    if (crossing && crossing[0] >= -EPSILON) travel = Math.min(travel, Math.max(0, crossing[0]));
  }
  const at = length => groundStep(game.map, shade.pos, dx * length, dz * length);
  const next = at(travel);
  if (next) {
    shade.pos = next;
    return travel;
  }
  let near = 0;
  let far = travel;
  for (let i = 0; i < 12; i++) {
    const middle = (near + far) / 2;
    if (at(middle)) near = middle;
    else far = middle;
  }
  if (near > 0) shade.pos = at(near);
  return near;
}

function exitRefuge(game, shade, lamp) {
  const [outX, outZ] = direction(lamp.pos, shade.pos);
  const angle = Math.atan2(outZ, outX);
  let best;
  // Test short straight exits first so overlapping lights and island edges remain traversable.
  for (const turn of [0, 1, -1, 2, -2, 3, -3, 4]) {
    const dx = Math.cos(angle + turn * Math.PI / 4);
    const dz = Math.sin(angle + turn * Math.PI / 4);
    const crossings = game.refuges.map(refuge => refugeCrossings(shade.pos, dx, dz, refuge))
      .filter(Boolean).sort((a, b) => a[0] - b[0]);
    let travel = 0;
    for (const [enter, leave] of crossings) {
      if (enter > travel + EPSILON) break;
      travel = Math.max(travel, leave);
    }
    if (best && travel >= best.travel) continue;
    const path = [];
    let pos = shade.pos;
    const step = (travel + EPSILON) / t.refuge_evict_ticks;
    for (let tick = 0; tick < t.refuge_evict_ticks; tick++) {
      pos = groundStep(game.map, pos, dx * step, dz * step);
      if (!pos) break;
      path.push(pos);
    }
    if (path.length === t.refuge_evict_ticks) best = { travel, path };
  }
  if (best) return best.path;

  // A lantern override can place the whole walkable area inside a refuge.
  // Still remove the shade from the refuge in time, even if it is over mist.
  const [, leave] = refugeCrossings(shade.pos, outX, outZ, lamp);
  return Array.from({ length: t.refuge_evict_ticks }, (_, i) => {
    const step = (leave + EPSILON) * (i + 1) / t.refuge_evict_ticks;
    return [shade.pos[0] + outX * step, shade.pos[1], shade.pos[2] + outZ * step];
  });
}

export function updateRefuges(game) {
  game.refuges = game.lanterns.filter(lamp => lamp.lit);
  for (const shade of game.shades) {
    if (shade.refugePath?.length) continue;
    const lamp = game.refuges.find(lamp => inside(shade.pos, lamp));
    if (lamp) shade.refugePath = exitRefuge(game, shade, lamp);
  }
}

export function stunShade(game, shade, seconds, refresh = false) {
  const until = game.simTick + Math.round(seconds * HZ);
  shade.stunnedUntil = refresh ? until : Math.max(shade.stunnedUntil, until);
  shade.state = 'stunned';
}

export function pulseEnemies(game, emit) {
  const center = [...game.player.pos];
  center[1] += t.pulse_center_y;
  const inRange = ({ pos }) => Math.hypot(
    pos[0] - center[0], pos[1] - center[1], pos[2] - center[2],
  ) <= t.pulse_radius + EPSILON;
  const stunned = [];
  for (const shade of game.shades) {
    if ((shade.state === 'spawning' && game.simTick < shade.stateUntil) || !inRange(shade)) continue;
    stunShade(game, shade, t.pulse_stun_s, true);
    shade.push = direction(center, shade.pos);
    shade.pushUntil = game.simTick + t.pulse_push_ticks;
    stunned.push(shade.id);
  }
  for (const drifter of game.drifters) {
    if (!inRange(drifter)) continue;
    if (drifter.state === 'chase') {
      drifter.state = 'flee';
      drifter.stateUntil = game.simTick + t.drifter_flee_ticks;
    } else if (drifter.state === 'flee' && game.simTick < drifter.stateUntil && drifter.stolen > 0) {
      const amount = drifter.stolen;
      drifter.stolen = 0;
      drifter.stateUntil = game.simTick + t.drifter_drop_ticks;
      game.dropMotes(amount, drifter.pos, false);
      emit('drifter_drop', { drifter_id: drifter.id, amount });
    }
  }
  return stunned;
}

function shadeBehavior(shade, player) {
  const sight = shade.state === 'chase' ? t.shade_forget_radius : t.shade_detect_radius;
  return !player.respawnAt && distance(shade.pos, player.pos) <= sight + EPSILON ? 'chase' : 'wander';
}

function moveShade(game, shade) {
  const { simTick, player } = game;
  if (shade.refugePath?.length) {
    shade.pos = shade.refugePath.shift();
    shade.evictedAt = simTick;
    if ((shade.state === 'stunned' && simTick >= shade.stunnedUntil) ||
        (shade.state === 'recoil' && simTick >= shade.stateUntil) ||
        (shade.state === 'spawning' && simTick >= shade.stateUntil)) {
      shade.state = shadeBehavior(shade, player);
    }
    return;
  }
  if (shade.state === 'spawning' && simTick < shade.stateUntil) return;
  if (shade.state === 'stunned' && simTick < shade.stunnedUntil) {
    if (simTick < shade.pushUntil) {
      const step = t.pulse_push_m / t.pulse_push_ticks;
      if (moveShadeAlong(game, shade, shade.push, step) < step) shade.pushUntil = simTick;
    }
    return;
  }
  if (shade.state === 'recoil' && simTick <= shade.stateUntil) {
    moveShadeAlong(game, shade, shade.recoil, t.shade_recoil_m / t.shade_recoil_ticks);
    if (simTick === shade.stateUntil) shade.state = shadeBehavior(shade, player);
    return;
  }
  const gap = distance(shade.pos, player.pos);
  shade.state = shadeBehavior(shade, player);
  const speed = game.night === 3 ? t.shade_speed_night3 : t.shade_speed;
  const step = speed / HZ;
  if (shade.state === 'wander') {
    if (moveShadeAlong(game, shade, [Math.cos(shade.heading), Math.sin(shade.heading)], step) < step) {
      shade.heading += Math.PI / 3;
    }
    return;
  }
  const heading = direction(shade.pos, player.pos);
  const intended = Math.min(step, gap);
  const travelled = moveShadeAlong(game, shade, heading, intended);
  if (travelled >= intended) return;
  const refuge = game.refuges.find(lamp => distance(shade.pos, lamp.pos) <= t.safe_radius + EPSILON);
  if (!refuge || inside(player.pos, refuge)) return;
  const [dx, dz] = direction(refuge.pos, shade.pos);
  const side = heading[1] * dx - heading[0] * dz < 0 ? -1 : 1;
  moveShadeAlong(game, shade, [-dz * side, dx * side], step - travelled);
}

function moveDrifter(game, drifter) {
  if (drifter.state === 'removed') return;
  const { player, simTick } = game;
  const gap = distance(drifter.pos, player.pos);
  let heading;
  let step = t.drifter_chase_speed / HZ;
  if (drifter.state === 'flee') {
    if (simTick >= drifter.stateUntil) {
      drifter.state = 'removed';
      return;
    }
    heading = direction(player.pos, drifter.pos);
  } else if (!player.respawnAt && player.carried >= t.drifter_detect_carried &&
      gap <= t.drifter_detect_radius + EPSILON) {
    drifter.state = 'chase';
    heading = direction(drifter.pos, player.pos);
    drifter.heading = Math.atan2(heading[1], heading[0]);
    step = Math.min(step, gap);
  } else {
    drifter.state = 'idle';
    drifter.heading += Math.PI / (2 * HZ);
    heading = [Math.cos(drifter.heading), Math.sin(drifter.heading)];
    step = t.drifter_idle_speed / HZ;
  }
  const [x, y, z] = drifter.pos;
  drifter.pos = [x + heading[0] * step, y, z + heading[1] * step];
}

export function moveEnemies(game) {
  for (const shade of game.shades) moveShade(game, shade);
  for (const drifter of game.drifters) moveDrifter(game, drifter);
}

export function contactEnemies(game, emit, onHit) {
  const { player, simTick } = game;
  if (player.respawnAt || player.flames <= 0) return;
  for (const drifter of [...game.drifters].sort(byId)) {
    if (drifter.state !== 'chase') continue;
    if (player.carried < t.drifter_detect_carried) {
      drifter.state = 'idle';
      continue;
    }
    if (distance(drifter.pos, player.pos) > t.drifter_hit_radius + EPSILON) continue;
    const amount = Math.min(t.drifter_steal_max, player.carried);
    player.carried -= amount;
    drifter.stolen = amount;
    drifter.state = 'flee';
    drifter.stateUntil = simTick + t.drifter_flee_ticks;
    emit('drifter_steal', { drifter_id: drifter.id, amount, carried: player.carried });
  }
  if (simTick < player.invulnerableUntil ||
      game.refuges.some(lamp => distance(player.pos, lamp.pos) <= t.safe_radius + EPSILON)) return;
  for (const shade of [...game.shades].sort(byId)) {
    if ((shade.state !== 'chase' && shade.state !== 'wander') || shade.evictedAt === simTick ||
        distance(shade.pos, player.pos) > t.shade_hit_radius + EPSILON ||
        Math.abs(shade.pos[1] - player.pos[1]) > t.shade_hit_height + EPSILON) continue;
    if (onHit(shade)) {
      shade.state = 'recoil';
      shade.recoil = direction(player.pos, shade.pos);
      shade.stateUntil = simTick + t.shade_recoil_ticks;
      return;
    }
  }
}

export function spawnEnemies(game, emit) {
  const { simTick, map, player } = game;
  const age = simTick - t.shade_spawn_tick;
  if (game.spawnShades && age >= 0 && age % map.shadeInterval === 0) {
    const count = age === 0 ? 2 : 1;
    for (let i = 0; i < count && game.shades.length < map.shadeCap; i++) {
      const valid = map.shadePoints.filter(point =>
        distance(point, player.pos) >= t.shade_spawn_min_distance - EPSILON &&
        !game.refuges.some(lamp => distance(point, lamp.pos) <= t.safe_radius + EPSILON) &&
        !game.shades.some(shade => distance(point, shade.pos) <= t.shade_hit_radius));
      if (!valid.length) break;
      const [x, y, z] = valid[Math.floor(game.random() * valid.length)];
      const shade = createShade(game, { pos: [x, y + SHADE_CENTER_HEIGHT, z], state: 'spawning' });
      game.shades.push(shade);
      emit('shade_spawned', { id: shade.id });
    }
  }
  if (game.spawnDrifters && t.drifter_spawn_ticks.includes(simTick)) {
    const active = game.drifters.filter(drifter => drifter.state !== 'removed');
    if (active.length >= t.drifter_cap) return;
    const valid = map.mistPoints.filter(point =>
      !active.some(drifter => distance(point, drifter.pos) <= t.drifter_hit_radius));
    if (valid.length) {
      const pos = valid[Math.floor(game.random() * valid.length)];
      game.drifters.push(createDrifter(game, { pos }));
    }
  }
}
