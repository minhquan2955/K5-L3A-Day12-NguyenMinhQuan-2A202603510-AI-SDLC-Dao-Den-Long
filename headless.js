import { closeSync, openSync, readFileSync, writeSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createGame, idleInput, snapshot, stepGame, tuning } from './game.js';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = Number.isFinite;
const integer = (value, min, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(value) && value >= min && value <= max;
const isBoolean = value => typeof value === 'boolean';
const position = value => Array.isArray(value) && value.length === 3 && value.every(finite);
const optional = (obj, key, check) => !(key in obj) || check(obj[key]);
const list = (value, check) => Array.isArray(value) && value.every(check);
const tickCount = value => integer(value, 0);

function uniqueId(ids, id) {
  if (typeof id !== 'string' || id.length === 0 || ids.has(id)) return false;
  ids.add(id);
  return true;
}

function validInputs(inputs) {
  if (!isObject(inputs) || !Array.isArray(inputs.frames)) return false;
  let previous = -1;
  for (const frame of inputs.frames) {
    if (!isObject(frame) || !integer(frame.tick, previous + 1) ||
        !optional(frame, 'move', value => Array.isArray(value) && value.length === 2 &&
          value.every(component => finite(component) && Math.abs(component) <= 1)) ||
        !optional(frame, 'cam_yaw_deg', finite) || !optional(frame, 'aim_deg', finite) ||
        !['jump', 'interact', 'pulse', 'dash', 'pause', 'blink', 'beam'].every(key => optional(frame, key, isBoolean))) return false;
    previous = frame.tick;
  }
  return true;
}

function validScenario(scenario, night) {
  if (!isObject(scenario)) return false;
  const lampIds = new Set(Array.from({ length: tuning[`lantern_count_night${night}`] }, (_, i) => `L${i + 1}`));
  const charmDefaults = [[], ['C1'], ['C1', 'C2']][night - 1];
  const shadeIds = new Set();
  const drifterIds = new Set();
  const charmIds = new Set();
  return optional(scenario, 'player', player => isObject(player) &&
      optional(player, 'pos', position) &&
      optional(player, 'carried', value => integer(value, 0, tuning.carry_capacity)) &&
      optional(player, 'flames', tickCount) &&
      ['invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks'].every(key => optional(player, key, tickCount))) &&
    optional(scenario, 'random_motes', isBoolean) &&
    optional(scenario, 'random_shades', isBoolean) &&
    optional(scenario, 'random_drifters', isBoolean) &&
    optional(scenario, 'wind_enabled', isBoolean) &&
    optional(scenario, 'motes', value => list(value, position)) &&
    optional(scenario, 'shades', value => list(value, shade => isObject(shade) && position(shade.pos) &&
      optional(shade, 'id', id => uniqueId(shadeIds, id)) &&
      optional(shade, 'state', state => ['spawning', 'wander', 'chase', 'recoil', 'stunned'].includes(state)) &&
      optional(shade, 'state_ticks_left', tickCount))) &&
    optional(scenario, 'drifters', value => list(value, drifter => isObject(drifter) && position(drifter.pos) &&
      optional(drifter, 'id', id => uniqueId(drifterIds, id)) &&
      optional(drifter, 'state', state => ['idle', 'chase', 'flee', 'removed'].includes(state)) &&
      optional(drifter, 'stolen', amount => integer(amount, 0, tuning.drifter_steal_max)) &&
      optional(drifter, 'state_ticks_left', tickCount))) &&
    optional(scenario, 'charms', value => list(value, charm => isObject(charm) &&
      optional(charm, 'id', id => uniqueId(charmIds, id)) &&
      optional(charm, 'pos', position) && ('pos' in charm || charmDefaults.includes(charm.id)) &&
      optional(charm, 'available', isBoolean) && optional(charm, 'respawn_ticks', tickCount))) &&
    optional(scenario, 'lanterns', value => list(value, lamp => isObject(lamp) && lampIds.delete(lamp.id) &&
      optional(lamp, 'pos', position) && optional(lamp, 'lit', isBoolean) &&
      optional(lamp, 'deposited', amount => integer(amount, 0, tuning.lantern_cost)))) &&
    optional(scenario, 'time_left_s', value => finite(value) && value >= 0);
}

function load(file, label, validate, fallback) {
  if (file === undefined) return fallback;
  try {
    const data = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    if (!validate(data)) throw new Error('invalid structure or field values');
    return data;
  } catch (error) {
    const invalid = new Error(`--${label}: ${error.message}`);
    invalid.exitCode = 2;
    throw invalid;
  }
}

function main() {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length - 1; i += 1) {
    if (argv[i] === '--seed' && /^-\d+$/.test(argv[i + 1])) {
      argv.splice(i, 2, `--seed=${argv[i + 1]}`);
    }
  }
  const { values: args } = parseArgs({
    args: argv,
    options: Object.fromEntries(
      ['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every'].map(key => [key, { type: 'string' }]),
    ),
  });
  function readInteger(key, min, fallback) {
    const value = args[key] ?? fallback;
    if (!/^-?\d+$/.test(value) || !integer(Number(value), min)) throw new Error(`Invalid --${key}`);
    return Number(value);
  }
  const seed = readInteger('seed', Number.MIN_SAFE_INTEGER);
  const ticks = readInteger('ticks', 0);
  const every = readInteger('snapshot-every', 1, '10');
  if (!['1', '2', '3'].includes(args.night) || !args.out) throw new Error('Expected --night <1|2|3> and --out <file>');
  const night = Number(args.night);
  const scenario = load(args.scenario, 'scenario', value => validScenario(value, night), {});
  const { frames } = load(args.inputs, 'inputs', validInputs, { frames: [] });
  const game = createGame(seed, scenario, night);
  const fd = openSync(args.out, 'w');
  const write = value => writeSync(fd, JSON.stringify(value) + '\n');
  try {
    let input = idleInput;
    let frame = 0;
    write(snapshot(game));
    while (game.tick < ticks && (game.state === 'playing' || game.state === 'paused')) {
      if (frames[frame]?.tick === game.tick) input = { ...input, ...frames[frame++] };
      stepGame(game, input, write);
      if (game.tick % every === 0) write(snapshot(game));
    }
    write({ type: 'end', ticks: game.tick, state: game.state, score: game.score });
  } finally {
    closeSync(fd);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = error.exitCode ?? 1;
}
