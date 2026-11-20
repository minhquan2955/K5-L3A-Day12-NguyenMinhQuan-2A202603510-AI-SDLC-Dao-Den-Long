import contract from './game.contract.json' with { type: 'json' };
import { blockedAt, groundBelow, rampHeight } from './maps.js';

const t = contract.tuning;
const HZ = 60;
const EPSILON = 1e-8;
export const onGround = (map, [x, y, z]) => groundBelow(map, x, z, y) !== null &&
  Math.abs(y - groundBelow(map, x, z, y)) <= EPSILON;
const radians = angle => (angle % 360) * Math.PI / 180;

function inputDirection(input) {
  const [x, z] = input.move;
  const angle = radians(input.cam_yaw_deg);
  const norm = Math.max(1, Math.hypot(x, z));
  return [(x * Math.cos(angle) + z * Math.sin(angle)) / norm,
    (-x * Math.sin(angle) + z * Math.cos(angle)) / norm];
}

function canMove(map, from, x, z) {
  const [oldX, y, oldZ] = from;
  if (blockedAt(map, x, z, y) && (!blockedAt(map, oldX, oldZ, y) ||
      Math.hypot(x, z) < Math.hypot(oldX, oldZ))) return false;
  if (!map.tiers) return true;
  const next = groundBelow(map, x, z);
  if (next === null || next <= y + EPSILON) return true;
  const ramp = rampHeight(map, x, z);
  if (ramp !== null && next === ramp) return true;
  if (rampHeight(map, oldX, oldZ) !== null && next - y <= 0.21) return true;
  return groundBelow(map, oldX, oldZ) === next;
}

export function blinkPlayer(map, player, angle) {
  const from = player.pos;
  const [x, y, z] = from;
  const dx = Math.sin(radians(angle));
  const dz = Math.cos(radians(angle));
  const range = t.blink_distance_m;
  const allowed = length => {
    const nx = x + dx * length;
    const nz = z + dz * length;
    return groundBelow(map, nx, nz, y) !== null && canMove(map, from, nx, nz);
  };
  let distance = range;
  for (let end = Math.min(0.25, range); end <= range; end = Math.min(range, end + 0.25)) {
    if (!allowed(end)) {
      let near = Math.max(0, end - 0.25);
      let far = end;
      for (let i = 0; i < 20; i++) {
        const mid = (near + far) / 2;
        if (allowed(mid)) near = mid;
        else far = mid;
      }
      distance = near;
      break;
    }
    if (end === range) break;
  }
  player.pos = [x + dx * distance, y, z + dz * distance];
  player.grounded = onGround(map, player.pos);
}

export function movePlayer(game, input, pressed, emit) {
  const { player, map, simTick: tick } = game;
  const [x, y, z] = player.pos;
  const move = inputDirection(input);
  const moving = Math.hypot(...move);
  const charmed = tick < player.charmUntil;
  if (moving) player.facing = move.map(axis => axis / moving);
  if (pressed('dash') && tick >= player.dashUntil && (charmed || tick >= game.dashReadyAt)) {
    player.dashDir = [...player.facing];
    player.dashUntil = tick + Math.round(t.dash_duration_s * HZ);
    game.dashReadyAt = tick + Math.round(t.dash_cooldown_s * HZ);
    emit('dash', {});
  }

  const dashing = tick < player.dashUntil;
  const jumping = player.grounded && pressed('jump');
  if (jumping) {
    player.vy = t.jump_speed;
    player.grounded = false;
  }
  const speed = charmed ? t.charm_speed : t.player_speed;
  const deltaX = move[0] * speed - player.runVel[0];
  const deltaZ = move[1] * speed - player.runVel[1];
  const fraction = Math.min(1, speed / (t.acceleration_s * HZ) / (Math.hypot(deltaX, deltaZ) || 1));
  player.runVel[0] += deltaX * fraction;
  player.runVel[1] += deltaZ * fraction;
  const [vx, vz] = dashing ? player.dashDir.map(axis => axis * t.dash_speed) :
    player.launch ?? player.runVel;
  const windAngle = radians(game.wind.dir_deg ?? 0);
  const windSpeed = game.wind.active ? 2 : 0;
  let nx = x + (vx + windSpeed * Math.sin(windAngle)) / HZ;
  let nz = z + (vz + windSpeed * Math.cos(windAngle)) / HZ;
  if (!canMove(map, player.pos, nx, nz)) {
    if (canMove(map, player.pos, nx, z)) nz = z;
    else if (canMove(map, player.pos, x, nz)) nx = x;
    else [nx, nz] = [x, z];
  }
  const ramp = rampHeight(map, nx, nz);
  const top = groundBelow(map, nx, nz, y);
  const upper = groundBelow(map, nx, nz);
  let ny = y;
  if (player.grounded && ramp !== null && Math.abs(ramp - y) <= 0.21) {
    ny = ramp;
  } else if (player.grounded && rampHeight(map, x, z) !== null && upper > y && upper - y <= 0.21) {
    ny = upper;
  } else if (player.grounded && (top === null || Math.abs(top - y) > EPSILON)) {
    player.grounded = false;
  }
  if (!player.grounded && !dashing) {
    if (!jumping) player.vy -= t.gravity / HZ;
    ny += player.vy / HZ;
    if (player.vy <= 0 && top !== null && ny <= top + EPSILON) {
      ny = top;
      player.vy = 0;
      player.grounded = true;
      player.launch = null;
    }
  }
  player.pos = [nx, ny, nz];
  player.vel = [(nx - x) * HZ, player.grounded || dashing ? 0 : player.vy, (nz - z) * HZ];

  const pad = player.grounded && map.pads.find(({ pos }) =>
    Math.abs(ny - pos[1]) <= EPSILON && Math.hypot(nx - pos[0], nz - pos[2]) <= 1);
  if (pad) {
    player.vy = pad.vy;
    player.launch = pad.direction.map(axis => axis * pad.speed);
    player.vel = [player.launch[0], pad.vy, player.launch[1]];
    player.grounded = false;
  }
}
