import contract from './game.contract.json' with { type: 'json' };
import { maps, groundBelow } from './maps.js';
import { blinkPlayer, movePlayer, onGround } from './movement.js';
import { initEnemies, updateRefuges, pulseEnemies, moveEnemies, contactEnemies, spawnEnemies, stunShade } from './enemies.js';

export const tuning = contract.tuning;
export const HZ = 60;
export const ISLAND_RADIUS = maps[1].circles[0].r;
export const idleInput = { move: [0, 0], cam_yaw_deg: 0, aim_deg: 0,
  jump: false, interact: false, pulse: false, blink: false, beam: false, dash: false, pause: false };

const t = tuning;
const EPSILON = 1e-8;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const rounded = pos => pos.map(value => Number(value.toFixed(3)) || 0);
const radians = degrees => (degrees % 360) * Math.PI / 180;
const remaining = (deadline, tick) => Math.max(0, deadline - tick) / HZ;
const canPick = (a, b) => distance(a, b) <= t.pickup_radius + EPSILON && Math.abs(a[1] - b[1]) <= t.pickup_height + EPSILON;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function resetMotion(player, map) {
  player.vel = [0, 0, 0];
  player.runVel = [0, 0];
  player.vy = 0;
  player.launch = null;
  player.dashUntil = 0;
  player.dashDir = [0, 1];
  player.facing = [0, 1];
  player.grounded = onGround(map, player.pos);
}

function addMote(game, pos, dropped = false, slot = null) {
  const { simTick: tick } = game;
  game.motes.push({ id: `M${++game.nextMote}`, pos: [...pos], slot,
    kind: dropped ? 'dropped' : 'random',
    expiresAt: dropped ? tick + t.mote_drop_ttl_ticks : Infinity, collectAt: dropped ? tick + 1 : tick });
}

function spawnMote(game) {
  if (game.motes.length >= t.mote_cap) return;
  const occupied = new Set(game.motes.filter(mote => mote.slot !== null).map(mote => mote.slot));
  const valid = game.map.motePoints.map((pos, slot) => ({ pos, slot }))
    .filter(({ slot, pos }) => !occupied.has(slot) && !game.motes.some(mote =>
      mote.slot === null && distance(mote.pos, pos) <= EPSILON && Math.abs(mote.pos[1] - pos[1]) <= EPSILON));
  if (valid.length) {
    const { pos, slot } = valid[Math.floor(game.random() * valid.length)];
    addMote(game, pos, false, slot);
  }
}

function dropMotes(game, amount, pos, spread) {
  const start = spread && amount ? game.random() * Math.PI * 2 : 0;
  for (let i = 0; i < amount; i++) {
    const angle = start + i * Math.PI * 2 / amount;
    const radius = spread ? 1.5 + game.random() : 0;
    const x = pos[0] + Math.cos(angle) * radius;
    const z = pos[2] + Math.sin(angle) * radius;
    const y = groundBelow(game.map, x, z, pos[1] + t.pickup_height) ?? pos[1];
    addMote(game, [x, y, z], true);
  }
}

export function createGame(seed, scenario = {}, night = 1) {
  const map = maps[night];
  if (!map) throw new Error(`Unknown night ${night}`);
  const random = seededRandom(seed);
  const overrides = new Map((scenario.lanterns ?? []).map(lamp => [lamp.id, lamp]));
  const lanterns = map.lanternPositions.map((pos, i) => {
    const id = `L${i + 1}`;
    const override = overrides.get(id) ?? {};
    const lit = override.lit ?? (override.deposited === t.lantern_cost);
    return { id, pos: override.pos ?? pos, lit, deposited: override.deposited ?? (lit ? t.lantern_cost : 0) };
  });
  const oldPlayer = scenario.player ?? {};
  const player = {
    pos: [...(oldPlayer.pos ?? map.spawn)],
    flames: oldPlayer.flames ?? t.flames, carried: oldPlayer.carried ?? 0,
    invulnerableUntil: oldPlayer.invuln_ticks ?? 0,
    respawnAt: 0, charmUntil: oldPlayer.charm_ticks ?? 0,
  };
  resetMotion(player, map);
  const charmDefaults = map.charmPoints.map((pos, i) => ({ id: `C${i + 1}`, pos }));
  const charms = (scenario.charms ?? charmDefaults).map((charm, i) => {
    const id = charm.id ?? `C${i + 1}`;
    return { id, pos: charm.pos ?? charmDefaults.find(item => item.id === id)?.pos ?? map.spawn,
      available: charm.available ?? !(charm.respawn_ticks > 0),
      respawnAt: charm.respawn_ticks ?? (charm.available === false ? t.charm_respawn_ticks : 0) };
  });
  const startTime = scenario.time_left_s ?? t[`night${night}_duration_s`];
  const game = { tick: 0, simTick: 0, night, map, score: 0, state: 'playing', player, lanterns, motes: [], charms,
    nextMote: 0, random, randomMotes: scenario.random_motes ?? true,
    wind: { active: false, warning: false, dir_deg: null, pendingDirection: null },
    windEnabled: night === 3 && (scenario.wind_enabled ?? true),
    startTime, timeLeft: startTime, pulseReadyAt: oldPlayer.pulse_cd_ticks ?? 0,
    dashReadyAt: oldPlayer.dash_cd_ticks ?? 0, blinkReadyAt: 0, beamReadyAt: 0, previous: idleInput };
  game.dropMotes = (amount, pos, spread) => dropMotes(game, amount, pos, spread);
  if (scenario.motes) {
    for (const pos of scenario.motes) addMote(game, pos);
  } else if (game.randomMotes) {
    for (let i = 0; i < t.mote_initial; i++) spawnMote(game);
  }
  initEnemies(game, scenario);
  return game;
}

export function nearbyLantern(game) {
  let nearest;
  let range = t.interact_radius + EPSILON;
  for (const lamp of game.lanterns) {
    const gap = distance(game.player.pos, lamp.pos);
    if (!lamp.lit && gap <= range && (!nearest || gap < range - EPSILON)) {
      nearest = lamp;
      range = gap;
    }
  }
  return nearest;
}

function aimDegrees(point, [x, , z], fallback = 0) {
  if (!point) return fallback;
  const dx = point.x - x;
  const dz = point.z - z;
  return dx || dz ? Math.atan2(dx, dz) * 180 / Math.PI : fallback;
}

function useExtraSkills(game, input, aimPoint, pressed, emit) {
  const { player, simTick: tick } = game;
  if (pressed('blink') && player.carried >= t.blink_cost && tick >= game.blinkReadyAt) {
    const from = player.pos;
    blinkPlayer(game.map, player, aimDegrees(aimPoint, from, input.aim_deg));
    player.carried -= t.blink_cost;
    game.blinkReadyAt = tick + Math.round(t.blink_cooldown_s * HZ);
    emit('blink', { from: rounded(from), to: rounded(player.pos), carried: player.carried });
  }
  if (pressed('beam') && player.carried >= t.beam_cost && tick >= game.beamReadyAt) {
    const aim = aimDegrees(aimPoint, player.pos, input.aim_deg);
    const dx = Math.sin(radians(aim));
    const dz = Math.cos(radians(aim));
    const [x, , z] = player.pos;
    const ids = [];
    player.carried -= t.beam_cost;
    game.beamReadyAt = tick + Math.round(t.beam_cooldown_s * HZ);
    for (const shade of game.shades) {
      if (shade.state === 'spawning' && tick < shade.stateUntil) continue;
      const sx = shade.pos[0] - x;
      const sz = shade.pos[2] - z;
      const along = Math.max(0, Math.min(t.beam_range_m, sx * dx + sz * dz));
      if (Math.hypot(sx - along * dx, sz - along * dz) <= t.beam_width_m / 2 + EPSILON) {
        stunShade(game, shade, t.beam_stun_s);
        ids.push(shade.id);
      }
    }
    game.score += ids.length * t.score.per_stun;
    emit('beam', { aim_deg: aim, stunned_ids: ids, carried: player.carried });
  }
}

function updateWind(game) {
  if (!game.windEnabled) return;
  const { wind, simTick: tick } = game;
  const cycle = tick % (30 * HZ);
  wind.warning = cycle >= 28 * HZ;
  if (cycle === 28 * HZ) wind.pendingDirection = game.random() * 360;
  wind.active = tick >= 30 * HZ && cycle < 5 * HZ;
  wind.dir_deg = wind.active ? wind.pendingDirection : null;
}

function collect(game, emit) {
  const { player, simTick: tick } = game;
  game.motes = game.motes.filter(mote => {
    if (tick < mote.collectAt || player.carried >= t.carry_capacity || !canPick(player.pos, mote.pos)) return true;
    player.carried += 1;
    emit('mote_picked', { carried: player.carried });
    return false;
  });
  for (const charm of game.charms) {
    if (charm.available && canPick(player.pos, charm.pos)) {
      charm.available = false;
      charm.respawnAt = tick + t.charm_respawn_ticks;
      player.charmUntil = tick + t.charm_duration_ticks;
      emit('charm_picked', { charm_id: charm.id, charm_ticks: t.charm_duration_ticks });
    }
  }
}

function deposit(game, emit) {
  const { player } = game;
  const lamp = player.carried > 0 && nearbyLantern(game);
  if (!lamp) return;
  const amount = Math.min(player.carried, t.lantern_cost - lamp.deposited);
  player.carried -= amount;
  lamp.deposited += amount;
  game.score += amount * t.score.per_mote;
  if (amount > 0) emit('deposit', { lantern_id: lamp.id, amount, deposited: lamp.deposited });
  if (lamp.deposited === t.lantern_cost) {
    lamp.lit = true;
    game.score += t.score.per_lantern;
    emit('lantern_lit', { lantern_id: lamp.id });
  }
}

export function stepGame(game, input = idleInput, onEvent = () => {}, aimPoint) {
  if (game.state !== 'playing' && game.state !== 'paused') return;
  const tick = ++game.tick;
  const previous = game.previous;
  const pressed = action => input[action] && !previous[action];
  const emit = (name, data) => onEvent({ type: 'event', tick, name, data });
  game.previous = input;
  if (pressed('pause')) {
    const paused = game.state === 'playing';
    game.state = paused ? 'paused' : 'playing';
    emit(paused ? 'paused' : 'resumed', {});
  }
  if (game.state === 'paused') return;

  const sim = ++game.simTick;
  const { player, map } = game;
  if (sim === 1) emit('night_start', { night: game.night });
  game.timeLeft = game.startTime - sim / HZ;
  game.motes = game.motes.filter(mote => sim < mote.expiresAt);
  for (const charm of game.charms) {
    if (!charm.available && sim >= charm.respawnAt) charm.available = true;
  }
  updateWind(game);

  const waiting = Boolean(player.respawnAt);
  if (waiting && sim >= player.respawnAt) {
    player.pos = [...map.spawn];
    player.respawnAt = 0;
    player.invulnerableUntil = sim + Math.round(t.invuln_s * HZ);
    resetMotion(player, map);
  } else if (!waiting && player.flames > 0) {
    movePlayer(game, input, pressed, emit);
    if (t.fall_enabled && player.pos[1] < t.fall_y) {
      const lost = player.carried;
      player.flames -= 1;
      player.carried = 0;
      player.respawnAt = sim + t.fall_respawn_ticks;
      resetMotion(player, map);
      emit('player_hit', { by: 'fall', flames: player.flames, dropped: 0, lost });
    } else {
      useExtraSkills(game, input, aimPoint, pressed, emit);
      collect(game, emit);
      if (pressed('interact')) deposit(game, emit);
    }
  }

  updateRefuges(game);
  if (!waiting && !player.respawnAt && player.flames > 0 && pressed('pulse') &&
      player.carried >= t.pulse_cost && sim >= game.pulseReadyAt) {
    player.carried -= t.pulse_cost;
    game.pulseReadyAt = sim + Math.round(t.pulse_cooldown_s * HZ);
    const stunned_ids = pulseEnemies(game, emit);
    game.score += stunned_ids.length * t.score.per_stun;
    emit('pulse', { stunned_ids });
  }
  moveEnemies(game);
  if (!player.respawnAt && player.flames > 0) {
    contactEnemies(game, emit, () => {
      if (sim < player.invulnerableUntil) return false;
      player.flames -= 1;
      const dropped = Math.floor(player.carried * t.hit_drop_ratio);
      player.carried -= dropped;
      player.invulnerableUntil = sim + Math.round(t.invuln_s * HZ);
      game.dropMotes(dropped, player.pos, true);
      emit('player_hit', { by: 'shade', flames: player.flames, dropped });
      return true;
    });
  }
  if (game.randomMotes && sim % t.mote_spawn_ticks === 0) spawnMote(game);
  spawnEnemies(game, emit);

  let reason;
  if (player.flames === 0) reason = 'no_flames';
  else if (game.lanterns.every(lamp => lamp.lit)) reason = 'all_lit';
  else if (game.timeLeft <= 0) reason = 'dawn';
  if (reason) {
    game.state = reason === 'all_lit' ? 'won' : 'lost';
    if (game.state === 'won') {
      game.score += Math.floor(Math.max(0, game.timeLeft)) * t.score.per_second_left + player.flames * t.score.per_flame_left;
    }
    emit('game_over', { result: game.state, reason });
  }
}

export function snapshot(game) {
  const { tick, simTick, night, state, timeLeft, score, player, lanterns, shades, motes, drifters, charms, wind } = game;
  return {
    type: 'snapshot', tick, sim_tick: simTick, night, state, time_left_s: timeLeft, score,
    wind: { active: wind.active, dir_deg: wind.dir_deg },
    player: { pos: rounded(player.pos), vel: rounded(player.vel), grounded: player.grounded,
      flames: player.flames, carried: player.carried, invuln: remaining(player.invulnerableUntil, simTick),
      dash_cd_s: simTick < player.charmUntil ? 0 : remaining(game.dashReadyAt, simTick),
      pulse_cd_s: remaining(game.pulseReadyAt, simTick), charm_s: remaining(player.charmUntil, simTick) },
    lanterns: lanterns.map(lamp => ({ ...lamp, pos: rounded(lamp.pos) })),
    shades: shades.map(({ id, pos, state }) => ({ id, pos: rounded(pos), state })),
    motes_active: motes.length,
    motes: motes.map(({ id, pos, kind, expiresAt }) => ({ id, pos: rounded(pos), kind,
      ttl_s: kind === 'dropped' ? remaining(expiresAt, simTick) : null })),
    drifters: drifters.map(({ id, pos, state, stolen }) => ({ id, pos: rounded(pos), state, stolen })),
    charms: charms.map(({ id, available, respawnAt }) => ({ id, available, respawn_s: available ? 0 : remaining(respawnAt, simTick) })),
  };
}
