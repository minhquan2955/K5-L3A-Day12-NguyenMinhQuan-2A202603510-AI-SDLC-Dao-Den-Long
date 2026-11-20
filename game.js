import contract from './game.contract.json' with { type: 'json' };

export const tuning = contract.tuning;
export const HZ = 60;
export const ISLAND_RADIUS = 34;
export const idleInput = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };

const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const inside = (pos, lamp) => distance(pos, lamp.pos) < tuning.safe_radius;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createGame(seed, scenario = {}) {
  const random = seededRandom(seed);
  const lamps = new Map((scenario.lanterns ?? []).map(lamp => [lamp.id, lamp]));
  const lanterns = Array.from({ length: tuning.lantern_count_night1 }, (_, i) => {
    const id = `L${i + 1}`;
    const angle = i * 2 * Math.PI / tuning.lantern_count_night1 - Math.PI / 2;
    const override = lamps.get(id) ?? {};
    const lit = override.lit ?? (override.deposited === tuning.lantern_cost);
    return { id, pos: override.pos ?? [20 * Math.cos(angle), 0, 20 * Math.sin(angle)],
      lit, deposited: override.deposited ?? (lit ? tuning.lantern_cost : 0) };
  });
  const randomMotes = Array.from({ length: 54 }, (_, i) => {
    const band = Math.floor(i / 18);
    const angle = (i % 18 + random()) * 2 * Math.PI / 18;
    const radius = 4 + band * 8 + random() * 6;
    return [radius * Math.cos(angle), 0, radius * Math.sin(angle)];
  });
  const motes = (scenario.motes ?? (scenario.random_motes === false ? [] : randomMotes))
    .map((pos, i) => ({ id: `M${i + 1}`, pos }));
  const shadeEntries = scenario.shades ?? (scenario.random_shades === false ? [] :
    [[-20, 1, 10], [20, 1, -10]].map(pos => ({ pos })));
  const shadeIds = new Set(shadeEntries.map(shade => shade.id));
  let nextShade = 0;
  function addShade({ id, pos }) {
    if (id === undefined) {
      do { id = `S${++nextShade}`; } while (shadeIds.has(id));
      shadeIds.add(id);
    }
    return { id, pos: [...pos], state: 'chase', stunnedUntil: 0 };
  }
  const shades = shadeEntries.map(addShade);
  const player = {
    pos: [...(scenario.player?.pos ?? [0, 0, 0])],
    flames: scenario.player?.flames ?? tuning.flames,
    carried: scenario.player?.carried ?? 0,
    vy: 0, invulnerableUntil: 0,
  };
  const startTime = scenario.time_left_s ?? tuning.night1_duration_s;
  const spawnShades = scenario.random_shades ?? (scenario.shades === undefined);
  return { tick: 0, score: 0, state: 'playing', player, lanterns, motes, shades, random, addShade,
    startTime, timeLeft: startTime, spawnShades, pulseReadyAt: 0, previous: idleInput };
}

export function nearbyLantern(game) {
  let nearest;
  let range = tuning.interact_radius;
  for (const lamp of game.lanterns) {
    const gap = distance(game.player.pos, lamp.pos);
    if (!lamp.lit && gap <= range && (!nearest || gap < range)) {
      nearest = lamp;
      range = gap;
    }
  }
  return nearest;
}

function movePlayer(player, input, jump) {
  const [x, z] = input.move;
  const angle = (input.cam_yaw_deg % 360) * Math.PI / 180;
  const step = tuning.player_speed / HZ / Math.max(1, Math.hypot(x, z));
  const nextX = player.pos[0] + (x * Math.cos(angle) + z * Math.sin(angle)) * step;
  const nextZ = player.pos[2] + (-x * Math.sin(angle) + z * Math.cos(angle)) * step;
  const boundary = Math.max(ISLAND_RADIUS, distance(player.pos, [0, 0, 0]));
  const scale = Math.max(1, Math.hypot(nextX, nextZ) / boundary);
  if (jump && player.pos[1] === 0) player.vy = 5;
  if (player.pos[1] > 0 || player.vy > 0) player.vy -= 20 / HZ;
  const y = Math.max(0, player.pos[1] + player.vy / HZ);
  if (y === 0) player.vy = 0;
  player.pos = [nextX / scale, y, nextZ / scale];
}

function moveShade(shade, target, litLamps, tick) {
  if (tick < shade.stunnedUntil) return;
  shade.state = 'chase';
  const [x, y, z] = shade.pos;
  const refuge = litLamps.find(lamp => inside(shade.pos, lamp));
  const dx = refuge ? x - refuge.pos[0] : target[0] - x;
  const dz = refuge ? z - refuge.pos[2] : target[2] - z;
  const gap = Math.hypot(dx, dz);
  const step = tuning.shade_speed / HZ;
  const scale = Math.min(step / (gap || 1), 1);
  let next = [x + (gap ? dx * scale : refuge ? step : 0), y, z + dz * scale];
  if (!refuge) {
    const blocked = litLamps.find(lamp => inside(next, lamp));
    if (blocked) {
      const offset = distance(next, blocked.pos) || 1;
      const [lx, , lz] = blocked.pos;
      next = [lx + (next[0] - lx) * tuning.safe_radius / offset, y,
        lz + (next[2] - lz) * tuning.safe_radius / offset];
    }
    if (litLamps.some(lamp => distance(next, lamp.pos) < tuning.safe_radius - 1e-9)) return;
  }
  shade.pos = next;
}

export function stepGame(game, input = idleInput, onEvent = () => {}) {
  if (game.state !== 'playing') return;
  const tick = ++game.tick;
  const { player } = game;
  const emit = (name, data) => onEvent({ type: 'event', tick, name, data });
  const pressed = action => input[action] && !game.previous[action];
  game.timeLeft = game.startTime - tick / HZ;
  movePlayer(player, input, pressed('jump'));

  game.motes = game.motes.filter(mote => {
    if (player.carried >= tuning.carry_capacity || distance(player.pos, mote.pos) > tuning.pickup_radius) return true;
    player.carried += 1;
    game.score += tuning.score.per_mote;
    emit('mote_picked', { carried: player.carried });
    return false;
  });

  const lamp = pressed('interact') && player.carried > 0 && nearbyLantern(game);
  if (lamp) {
    const amount = Math.min(player.carried, tuning.lantern_cost - lamp.deposited);
    player.carried -= amount;
    lamp.deposited += amount;
    if (amount > 0) emit('deposit', { lantern_id: lamp.id, amount, deposited: lamp.deposited });
    if (lamp.deposited === tuning.lantern_cost) {
      lamp.lit = true;
      game.score += tuning.score.per_lantern;
      emit('lantern_lit', { lantern_id: lamp.id });
    }
  }

  const litLamps = game.lanterns.filter(item => item.lit);
  if (pressed('pulse') && player.carried >= tuning.pulse_cost && tick >= game.pulseReadyAt) {
    player.carried -= tuning.pulse_cost;
    game.pulseReadyAt = tick + Math.round(tuning.pulse_cooldown_s * HZ);
    const stunned_ids = [];
    for (const shade of game.shades) {
      const gap = distance(player.pos, shade.pos);
      if (gap > tuning.pulse_radius) continue;
      const pushX = gap ? (shade.pos[0] - player.pos[0]) / gap : 1;
      const pushZ = gap ? (shade.pos[2] - player.pos[2]) / gap : 0;
      let pushDistance = tuning.pulse_push_m;
      for (const refuge of litLamps) {
        const x = shade.pos[0] - refuge.pos[0];
        const z = shade.pos[2] - refuge.pos[2];
        const alignment = x * pushX + z * pushZ;
        const outside = x * x + z * z - tuning.safe_radius ** 2;
        const crossing = alignment ** 2 - outside;
        if (outside >= -1e-9 && alignment < 0 && crossing > 0) {
          pushDistance = Math.min(pushDistance, Math.max(0, -alignment - Math.sqrt(crossing)));
        }
      }
      shade.pos[0] += pushX * pushDistance;
      shade.pos[2] += pushZ * pushDistance;
      shade.stunnedUntil = tick + Math.round(tuning.pulse_stun_s * HZ);
      shade.state = 'stunned';
      stunned_ids.push(shade.id);
      game.score += tuning.score.per_stun;
    }
    emit('pulse', { stunned_ids });
  }

  if (game.spawnShades && tick % (15 * HZ) === 0 && game.shades.length < 5) {
    const angle = game.random() * Math.PI * 2;
    const shade = game.addShade({ pos: [29 * Math.cos(angle), 1, 29 * Math.sin(angle)] });
    game.shades.push(shade);
    emit('shade_spawned', { id: shade.id });
  }
  const protectedByLamp = litLamps.some(item => distance(player.pos, item.pos) <= tuning.safe_radius);
  for (const shade of game.shades) {
    moveShade(shade, player.pos, litLamps, tick);
    if (!protectedByLamp && player.flames > 0 && shade.state !== 'stunned' &&
        tick >= player.invulnerableUntil && distance(player.pos, shade.pos) <= tuning.shade_hit_radius) {
      player.flames -= 1;
      const dropped = Math.floor(player.carried * tuning.hit_drop_ratio);
      player.carried -= dropped;
      player.invulnerableUntil = tick + Math.round(tuning.invuln_s * HZ);
      emit('player_hit', { by: 'shade', flames: player.flames, dropped });
    }
  }

  game.previous = input;
  let reason;
  if (litLamps.length === game.lanterns.length) {
    game.state = 'won';
    reason = 'all_lit';
    game.score += Math.floor(game.timeLeft) * tuning.score.per_second_left +
      player.flames * tuning.score.per_flame_left;
  } else if (player.flames === 0 || game.timeLeft <= 0) {
    game.state = 'lost';
    reason = player.flames === 0 ? 'no_flames' : 'dawn';
  }
  if (reason) emit('game_over', { result: game.state, reason });
}

export function snapshot(game) {
  const rounded = pos => pos.map(value => Number(value.toFixed(3)));
  const { tick, state, timeLeft, score, player, lanterns, shades, motes } = game;
  return {
    type: 'snapshot', tick, sim_tick: tick, state, time_left_s: timeLeft, score,
    player: { pos: rounded(player.pos), flames: player.flames, carried: player.carried },
    lanterns: lanterns.map(lamp => ({ ...lamp, pos: rounded(lamp.pos) })),
    shades: shades.map(({ id, pos, state }) => ({ id, pos: rounded(pos), state })),
    motes_active: motes.length, motes: motes.map(({ id, pos }) => ({ id, pos: rounded(pos) })),
  };
}
