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

function validInputs(inputs) {
  if (!isObject(inputs) || !Array.isArray(inputs.frames)) return false;
  let previous = -1;
  for (const frame of inputs.frames) {
    if (!isObject(frame) || !integer(frame.tick, previous + 1) ||
        !optional(frame, 'move', value => Array.isArray(value) && value.length === 2 &&
          value.every(component => finite(component) && Math.abs(component) <= 1)) ||
        !optional(frame, 'cam_yaw_deg', finite) ||
        !['jump', 'interact', 'pulse', 'dash'].every(key => optional(frame, key, isBoolean))) return false;
    previous = frame.tick;
  }
  return true;
}

function validScenario(scenario) {
  if (!isObject(scenario)) return false;
  const lampIds = new Set(Array.from({ length: tuning.lantern_count_night1 }, (_, i) => `L${i + 1}`));
  const shadeIds = new Set();
  return optional(scenario, 'player', player => isObject(player) &&
      optional(player, 'pos', position) &&
      optional(player, 'carried', value => integer(value, 0, tuning.carry_capacity)) &&
      optional(player, 'flames', value => integer(value, 0))) &&
    optional(scenario, 'random_motes', isBoolean) &&
    optional(scenario, 'random_shades', isBoolean) &&
    optional(scenario, 'motes', value => list(value, position)) &&
    optional(scenario, 'shades', value => list(value, shade => isObject(shade) && position(shade.pos) &&
      optional(shade, 'id', id => {
        if (typeof id !== 'string' || id.length === 0 || shadeIds.has(id)) return false;
        shadeIds.add(id);
        return true;
      }))) &&
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
  if (args.night !== '1' || !args.out) throw new Error('Expected --night 1 and --out <file>');
  const scenario = load(args.scenario, 'scenario', validScenario, {});
  const { frames } = load(args.inputs, 'inputs', validInputs, { frames: [] });
  const game = createGame(seed, scenario);
  const fd = openSync(args.out, 'w');
  const write = value => writeSync(fd, JSON.stringify(value) + '\n');
  try {
    let input = idleInput;
    let frame = 0;
    write(snapshot(game));
    while (game.tick < ticks && game.state === 'playing') {
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
