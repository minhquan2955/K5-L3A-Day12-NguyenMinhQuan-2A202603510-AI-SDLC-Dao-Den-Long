import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createGame, idleInput, stepGame } from '../game.js';

const contract = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url)));
const t = contract.tuning;
const empty = {
  random_motes: false, random_shades: false, random_drifters: false,
  lanterns: Array.from({ length: 5 }, (_, i) => ({ id: `L${i + 1}`, pos: [25, 0, i * 4] })),
};
const eventFields = {
  mote_picked: ['carried'], deposit: ['lantern_id', 'amount', 'deposited'], lantern_lit: ['lantern_id'],
  pulse: ['stunned_ids'], player_hit: ['by', 'flames', 'dropped'], shade_spawned: ['id'],
  game_over: ['result', 'reason'], blink: ['from', 'to', 'carried'], beam: ['aim_deg', 'stunned_ids', 'carried'],
  dash: [], charm_picked: ['charm_id', 'charm_ticks'], night_start: ['night'], paused: [], resumed: [],
  drifter_steal: ['drifter_id', 'amount', 'carried'], drifter_drop: ['drifter_id', 'amount'],
};
const states = ['playing', 'paused', 'won', 'lost'];
const shadeStates = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
const position = value => Array.isArray(value) && value.length === 3 && value.every(
  number => Number.isFinite(number) && Number(number.toFixed(3)) === number,
);

function checkJsonl(lines, every) {
  assert.equal(lines[0].type, 'snapshot');
  assert.equal(lines[0].tick, 0);
  const end = lines.at(-1);
  assert.equal(end.type, 'end');
  assert.ok(states.includes(end.state));
  assert.ok(Number.isSafeInteger(end.ticks) && end.ticks >= 0 && Number.isFinite(end.score));
  let previousTick = 0;
  let previousSimTick = 0;
  for (const line of lines.slice(0, -1)) {
    assert.ok(Number.isSafeInteger(line.tick) && line.tick >= previousTick && line.tick <= end.ticks);
    previousTick = line.tick;
    if (line.type === 'event') {
      assert.ok(line.tick > 0 && Object.hasOwn(eventFields, line.name));
      const fields = [...eventFields[line.name]];
      if (line.name === 'player_hit' && line.data.by === 'fall') fields.push('lost');
      assert.deepEqual(Object.keys(line.data).sort(), fields.sort());
    } else {
      assert.equal(line.type, 'snapshot');
      assert.ok(states.includes(line.state) && [1, 2, 3].includes(line.night));
      assert.ok(Number.isSafeInteger(line.sim_tick) && line.sim_tick >= previousSimTick && line.sim_tick <= line.tick);
      previousSimTick = line.sim_tick;
      assert.equal(line.tick % every, 0);
      assert.equal(typeof line.wind.active, 'boolean');
      assert.ok(line.wind.active ? Number.isFinite(line.wind.dir_deg) : line.wind.dir_deg === null);
      assert.equal(line.motes.length, line.motes_active);
      assert.ok(position(line.player.vel) && typeof line.player.grounded === 'boolean');
      for (const key of ['invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) {
        assert.ok(Number.isFinite(line.player[key]) && line.player[key] >= 0);
      }
      assert.ok(position(line.player.pos));
      for (const entities of [line.lanterns, line.shades, line.motes, line.drifters, line.charms]) {
        assert.equal(new Set(entities.map(({ id }) => id)).size, entities.length);
        assert.ok(entities.every(({ id }) => typeof id === 'string' && id.length > 0));
      }
      assert.ok([...line.lanterns, ...line.shades, ...line.motes, ...line.drifters].every(entity => position(entity.pos)));
      assert.ok(line.shades.every(({ state }) => shadeStates.includes(state)));
      assert.ok(line.motes.every(({ kind, ttl_s }) => kind === 'random' ? ttl_s === null :
        kind === 'dropped' && Number.isFinite(ttl_s) && ttl_s > 0));
      assert.ok(line.drifters.every(({ state, stolen }) => ['idle', 'chase', 'flee', 'removed'].includes(state) &&
        Number.isInteger(stolen) && stolen >= 0));
      assert.ok(line.charms.every(({ available, respawn_s }) => typeof available === 'boolean' &&
        Number.isFinite(respawn_s) && respawn_s >= 0));
    }
  }
}

function run({ scenario = empty, frames = [], ticks = 60, every = 1, seed = 53, night = 1, status = 0, invalidJson = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lantern-contract-'));
  try {
    const out = join(dir, 'out.jsonl');
    const scenarioFile = join(dir, 'scenario.json');
    const inputsFile = join(dir, 'inputs.json');
    writeFileSync(scenarioFile, JSON.stringify(scenario));
    writeFileSync(inputsFile, invalidJson ? '{' : JSON.stringify({ frames }));
    const [command, ...commandArgs] = contract.headless_cmd.split(' ');
    assert.equal(command, 'node');
    const result = spawnSync(process.execPath, [...commandArgs, '--night', String(night), '--seed', String(seed),
      '--scenario', scenarioFile, '--inputs', inputsFile, '--ticks', String(ticks),
      '--snapshot-every', String(every), '--out', out], { encoding: 'utf8' });
    assert.equal(result.status, status, result.stderr);
    if (status) {
      assert.ok(result.stderr.trim());
      return;
    }
    const raw = readFileSync(out, 'utf8');
    const lines = raw.trimEnd().split('\n').map(JSON.parse);
    checkJsonl(lines, every);
    return { raw, events: lines.filter(x => x.type === 'event' && x.name !== 'night_start'),
      nightStart: lines.find(x => x.type === 'event' && x.name === 'night_start'), end: lines.at(-1),
      snapshots: lines.filter(x => x.type === 'snapshot') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('v1.1 selects each night with its own lanterns, time and resources', () => {
  for (const [night, duration, lamps, charms] of [[1, 300, 5, 0], [2, 330, 6, 1], [3, 360, 7, 2]]) {
    const { nightStart, snapshots } = run({ night, scenario: {}, ticks: 1 });
    assert.equal(snapshots[0].night, night);
    assert.equal(snapshots[0].time_left_s, duration);
    assert.equal(snapshots[0].lanterns.length, lamps);
    assert.equal(snapshots[0].charms.length, charms);
    assert.equal(snapshots[0].motes_active, 20);
    assert.equal(snapshots[0].shades.length, 0);
    assert.deepEqual(nightStart, { type: 'event', tick: 1, name: 'night_start', data: { night } });
  }
  run({ night: 4, status: 1 });
  run({ night: 2, scenario: { ...empty, lanterns: [{ id: 'L7' }] }, status: 2 });
});

test('rejects malformed v1.1 inputs and scenario overrides', () => {
  run({ frames: [{ tick: 0, pause: 1 }], status: 2 });
  for (const scenario of [
    { player: { invuln_ticks: -1 } }, { player: { dash_cd_ticks: 0.5 } }, { player: { pulse_cd_ticks: false } },
    { player: { charm_ticks: '600' } }, { shades: [{ pos: [0, 0, 0], state: 'idle' }] },
    { shades: [{ pos: [0, 0, 0], state_ticks_left: -1 }] }, { drifters: [{}] }, { charms: [{ id: 'C9' }] },
    { random_drifters: 1 }, { wind_enabled: null },
  ]) run({ scenario, status: 2 });
});

test('tick zero, sparse input, camera-relative normalized movement and jump', () => {
  const { snapshots, end } = run({ frames: [
    { tick: 0, move: [1, 1], cam_yaw_deg: 90 },
    { tick: 30, jump: true },
  ] });
  assert.deepEqual(snapshots[0].player.pos, [0, 0, 0]);
  assert.equal(snapshots[0].lanterns.length, 5);
  assert.equal(snapshots[30].player.pos[1], 0);
  assert.ok(snapshots[31].player.pos[1] > 0);
  assert.deepEqual(snapshots[6].player.vel, [4.243, 0, -4.243]);
  assert.equal(snapshots[60].player.pos[0], -snapshots[60].player.pos[2]);
  assert.ok(snapshots[60].player.pos[0] > 4 && snapshots[60].player.pos[0] <= 4.243);
  assert.equal(snapshots[60].player.grounded, false);
  assert.equal(snapshots[60].sim_tick, 60);
  assert.equal(snapshots[60].time_left_s, t.night1_duration_s - 1);
  assert.deepEqual(end, { type: 'end', ticks: 60, state: 'playing', score: 0 });
});

test('pickup and rising-edge deposit light the fifth lantern and finish early', () => {
  const { events, end, snapshots } = run({
    scenario: { ...empty, time_left_s: 12, player: { carried: t.lantern_cost - 2 },
      motes: [[0, 0, 0], [0, 0, 7]],
      lanterns: empty.lanterns.map(lamp => lamp.id === 'L1' ? { id: 'L1', pos: [0, 0, 0] } : { ...lamp, lit: true }) },
    frames: [{ tick: 0, interact: true }, { tick: 1, move: [0, 1] },
      { tick: 81, move: [0, -1] }, { tick: 161, move: [0, 0], interact: false },
      { tick: 162, interact: true }], ticks: 180,
  });
  assert.equal(snapshots[0].score, 0);
  assert.deepEqual(events.map(e => e.name), ['mote_picked', 'deposit', 'mote_picked', 'deposit', 'lantern_lit', 'game_over']);
  assert.deepEqual(events[1], { type: 'event', tick: 1, name: 'deposit',
    data: { lantern_id: 'L1', amount: t.lantern_cost - 1, deposited: t.lantern_cost - 1 } });
  assert.deepEqual(events.at(-1).data, { result: 'won', reason: 'all_lit' });
  assert.equal(end.ticks, 163);
  assert.equal(end.score, t.lantern_cost * t.score.per_mote + t.score.per_lantern +
    Math.floor(12 - 163 / 60) * t.score.per_second_left + t.flames * t.score.per_flame_left);
});

test('capacity limits pickup and pulse pushes over 15 ticks, stuns for 120 and spends light', () => {
  const { events, snapshots } = run({ ticks: 121,
    scenario: { ...empty, player: { carried: t.carry_capacity }, motes: [[0, 0, 0]],
      shades: [{ id: 'near', pos: [2, 1, 0] }, { id: 'far', pos: [12, 1, 0] }] },
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }],
  });
  assert.deepEqual(events[0].data, { stunned_ids: ['near'] });
  assert.equal(events.filter(e => e.name === 'pulse').length, 1);
  assert.equal(snapshots[1].player.carried, t.carry_capacity - t.pulse_cost);
  assert.equal(snapshots[1].score, t.score.per_stun);
  assert.equal(snapshots[1].shades[0].state, 'stunned');
  assert.ok(snapshots[1].shades[0].pos[0] < 6);
  assert.equal(snapshots[15].shades[0].pos[0], 6);
  assert.equal(snapshots[2].motes_active, 0);
  const recovery = 1 + Math.round(t.pulse_stun_s * 60);
  assert.equal(snapshots[recovery - 1].shades[0].state, 'stunned');
  assert.equal(snapshots[recovery].shades[0].state, 'chase');
});

test('shade contact costs a flame, grants invulnerability, drops light and can end the game', () => {
  const { events, end } = run({ ticks: 200, scenario: { ...empty,
    player: { flames: 2, carried: 5 }, shades: [{ pos: [0, 1, 0] }] } });
  assert.deepEqual(events.map(e => e.name), ['player_hit', 'player_hit', 'game_over']);
  assert.equal(events[0].tick, 1);
  assert.ok(events[1].tick >= 91);
  assert.deepEqual(events[0].data, { by: 'shade', flames: 1, dropped: 2 });
  assert.deepEqual(events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(end.state, 'lost');
});

test('lit lantern repels shades and prevents contact inside its radius', () => {
  const { snapshots, events } = run({ ticks: 120, scenario: { ...empty,
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
    shades: [{ pos: [t.safe_radius + 0.5, 1, 0] }] } });
  assert.equal(events.length, 0);
  for (const snapshot of snapshots) {
    const [x, , z] = snapshot.shades[0].pos;
    assert.ok(Math.hypot(x, z) >= t.safe_radius - 0.001);
  }
});

test('shade steers around a lantern on the way to a player outside the refuge', () => {
  const { snapshots } = run({ ticks: 260, scenario: { ...empty,
    player: { pos: [-6.5, 0, 0] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
    shades: [{ state: 'chase', pos: [6.5, 1, 0] }] } });
  assert.equal(snapshots[1].shades[0].pos[0], 6.433);
  for (const frame of snapshots) {
    const [x, , z] = frame.shades[0].pos;
    assert.ok(Math.hypot(x, z) >= t.safe_radius - 0.001);
  }
  assert.ok(snapshots.at(-1).shades[0].pos[0] < -2);
});

test('pulse cannot knock a shade into a lit lantern refuge', () => {
  const { snapshots, events } = run({ ticks: 15, scenario: { ...empty,
    player: { carried: t.pulse_cost },
    lanterns: [{ id: 'L1', pos: [10, 0, 0], lit: true }],
    shades: [{ pos: [3, 1, 0] }] },
    frames: [{ tick: 0, pulse: true }],
  });
  assert.deepEqual(events[0].data, { stunned_ids: ['S1'] });
  assert.equal(snapshots.at(-1).shades[0].pos[0], 10 - t.safe_radius);
});

test('blink follows world aim independently of movement, retains aim and clamps at the shore', () => {
  const { events, snapshots } = run({ ticks: 4,
    scenario: { ...empty, player: { carried: 2 * t.blink_cost } }, frames: [
      { tick: 0, move: [0, 1], cam_yaw_deg: 90, aim_deg: 180, blink: true },
      { tick: 1, move: [0, 0] },
      { tick: 2, blink: false },
      { tick: 3, blink: true },
    ] });
  assert.deepEqual(events.map(({ name, tick, data }) => [name, tick, data.carried]),
    [['blink', 1, t.blink_cost], ['blink', 4, 0]]);
  for (const { data: { from, to } } of events) {
    assert.deepEqual(to, [from[0], from[1], from[2] - t.blink_distance_m]);
  }
  assert.equal(snapshots[2].player.carried, t.blink_cost);
  const shore = run({ ticks: 1, scenario: { ...empty, player: { pos: [0, 0, 39], carried: t.blink_cost } },
    frames: [{ tick: 0, blink: true }] });
  assert.deepEqual(shore.events[0].data.to, [0, 0, 40]);
});

test('beam uses the post-blink origin, includes its edge, retains aim and respects cooldown', () => {
  const offset = t.blink_distance_m;
  const width = t.beam_width_m / 2;
  const options = { ticks: 4, scenario: { ...empty, player: { carried: t.blink_cost + 2 * t.beam_cost },
    shades: [
      { id: 'edge', pos: [offset + 4, 12, width] },
      { id: 'wide', pos: [offset + 4, 0, width + 0.001] },
      { id: 'behind', pos: [offset - 2, 0, 0] },
      { id: 'far', pos: [offset + t.beam_range_m + width + 0.001, 0, 0] },
    ] }, frames: [
    { tick: 0, aim_deg: 90 },
    { tick: 1, beam: true, blink: true },
    { tick: 2, beam: false },
    { tick: 3, beam: true },
  ] };
  // The shades have moved by tick 1. Use a tick-zero shot for the exact geometric edge.
  const atEdge = run({ ...options, ticks: 1, frames: [{ tick: 0, aim_deg: 90, blink: true, beam: true }] });
  assert.deepEqual(atEdge.events.map(e => e.name), ['blink', 'beam']);
  assert.deepEqual(atEdge.events[1].data, { aim_deg: 90, stunned_ids: ['edge'], carried: t.beam_cost });
  assert.equal(atEdge.snapshots[1].score, t.score.per_stun);
  const first = run(options);
  assert.deepEqual(first.events.filter(e => e.name === 'beam').map(e => e.data.aim_deg), [90]);
  assert.equal(first.raw, run(options).raw);
  const noLight = run({ ticks: 1, frames: [{ tick: 0, blink: true, beam: true }] });
  assert.equal(noLight.events.length, 0);
  const miss = run({ ticks: 1, scenario: { ...empty, player: { carried: t.beam_cost } },
    frames: [{ tick: 0, beam: true }] });
  assert.deepEqual(miss.events[0].data, { aim_deg: 0, stunned_ids: [], carried: 0 });
  run({ frames: [{ tick: 0, aim_deg: '90' }], status: 2 });
  run({ frames: [{ tick: 0, blink: 1 }], status: 2 });
});

test('a projected mouse point controls blink and beam from their respective origins', () => {
  const game = createGame(42, { ...empty, player: { carried: t.blink_cost + t.beam_cost } });
  const events = [];
  stepGame(game, { ...idleInput, blink: true, beam: true }, event => events.push(event), { x: 1, z: 0 });
  assert.deepEqual(events.find(event => event.name === 'blink').data.to, [t.blink_distance_m, 0, 0]);
  assert.equal(Math.round(events.find(event => event.name === 'beam').data.aim_deg), -90);
});

test('horizontal pickup and interact include the declared radius, and exclude radius plus 1 mm', () => {
  const scenario = { ...empty, motes: [[1, 1.5, 0], [0, 0, 1.001], [0, 1.501, 0]],
    lanterns: [{ id: 'L1', pos: [0, 5, t.interact_radius], deposited: t.lantern_cost - 1 }] };
  const { events, snapshots } = run({ ticks: 1, scenario, frames: [{ tick: 0, interact: true }] });
  assert.deepEqual(events.map(e => [e.name, e.tick]), [['mote_picked', 1], ['deposit', 1], ['lantern_lit', 1]]);
  assert.equal(snapshots[0].score, 0);
  assert.equal(snapshots[1].score, t.score.per_mote + t.score.per_lantern);
  assert.deepEqual(snapshots[1].motes.map(mote => mote.pos), [[0, 0, 1.001], [0, 1.501, 0]]);
  const outside = run({ ticks: 1, scenario: { ...scenario,
    lanterns: [{ id: 'L1', pos: [0, 0, t.interact_radius + 0.001] }] }, frames: [{ tick: 0, interact: true }] });
  assert.deepEqual(outside.events.map(e => e.name), ['mote_picked']);
});

test('pulse includes its 3D boundary and shade contact checks both XZ and height', () => {
  const pulse = run({ ticks: 1, scenario: { ...empty, player: { carried: t.pulse_cost },
    shades: [{ pos: [3, 4.8, 0] }, { pos: [0, 5.801, 0] }] },
    frames: [{ tick: 0, pulse: true }] });
  assert.deepEqual(pulse.events[0].data.stunned_ids, ['S1']);
  const edge = t.shade_hit_radius + t.shade_speed / 60;
  const scenario = offset => ({ ...empty, player: { carried: t.carry_capacity },
    shades: [{ pos: [0, 1.5, edge + offset] }] });
  const hit = run({ ticks: 1, scenario: scenario(0) });
  assert.deepEqual(hit.events[0].data,
    { by: 'shade', flames: t.flames - 1, dropped: Math.floor(t.carry_capacity * t.hit_drop_ratio) });
  assert.equal(run({ ticks: 1, scenario: scenario(0.001) }).events.length, 0);
  assert.equal(run({ ticks: 1, scenario: { ...empty, shades: [{ pos: [0, 1.501, 0] }] } }).events.length, 0);
});

test('beam cooldown and stun end on their declared ticks', () => {
  const cooldown = Math.round(t.beam_cooldown_s * 60);
  const stun = Math.round(t.beam_stun_s * 60);
  const { events, snapshots } = run({ ticks: 1 + cooldown + stun,
    scenario: { ...empty, player: { carried: 2 * t.beam_cost }, shades: [{ pos: [0, 1, 8] }] },
    frames: [{ tick: 0, beam: true }, { tick: 1, beam: false }, { tick: cooldown, beam: true }] });
  assert.deepEqual(events.filter(event => event.name === 'beam').map(event => event.tick), [1, 1 + cooldown]);
  assert.equal(snapshots[1 + cooldown].player.carried, 0);
  assert.equal(snapshots[cooldown + stun].shades[0].state, 'stunned');
  assert.equal(snapshots[1 + cooldown + stun].shades[0].state, 'chase');
});

test('timeout, snapshot cadence, deterministic seeds and malformed files', () => {
  const zero = run({ seed: -42, ticks: 0 });
  assert.deepEqual(zero.snapshots.map(s => s.tick), [0]);
  assert.equal(zero.end.ticks, 0);
  const timed = run({ ticks: 50, every: 2, scenario: { ...empty, time_left_s: 3 / 60 } });
  assert.deepEqual(timed.snapshots.map(s => s.tick), [0, 2]);
  assert.deepEqual(timed.events[0], { type: 'event', tick: 3, name: 'game_over',
    data: { result: 'lost', reason: 'dawn' } });
  assert.equal(timed.end.ticks, 3);
  const spawnScenario = { shades: [], random_shades: true };
  const first = run({ scenario: spawnScenario, every: 10, ticks: 1000 });
  assert.equal(first.raw, run({ scenario: spawnScenario, every: 10, ticks: 1000 }).raw);
  assert.notEqual(first.raw, run({ scenario: spawnScenario, every: 10, ticks: 1000, seed: 54 }).raw);
  assert.ok(first.events.some(e => e.name === 'shade_spawned'));
  run({ frames: [{ tick: 3 }, { tick: 3 }], status: 2 });
  run({ scenario: { motes: [[0, 0]] }, status: 2 });
  run({ invalidJson: true, status: 2 });
});

test('last tick prioritizes no flames, then all lanterns lit, then dawn', () => {
  const lanterns = empty.lanterns.map(lamp => lamp.id === 'L1' ?
    { id: 'L1', pos: [0, 0, 0], deposited: 9 } : { ...lamp, lit: true });
  const scenario = { ...empty, lanterns, time_left_s: 1 / 60, player: { carried: 1 } };
  const frames = [{ tick: 0, interact: true }];
  const win = run({ scenario, frames });
  assert.deepEqual(win.events.at(-1).data, { result: 'won', reason: 'all_lit' });
  assert.deepEqual(win.end, { type: 'end', ticks: 1, state: 'won', score: 260 });
  assert.equal(win.raw, run({ scenario, frames }).raw);
  const dawn = run({ scenario });
  assert.deepEqual(dawn.events.at(-1).data, { result: 'lost', reason: 'dawn' });
  const noFlames = run({ scenario: { ...scenario, player: { pos: [41, -11, 0], flames: 1 },
    lanterns: lanterns.map(lamp => ({ ...lamp, lit: true })) }, frames });
  assert.deepEqual(noFlames.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
});

test('equidistant lanterns use the lower id and retain partial deposits', () => {
  const scenario = { ...empty, player: { carried: 6 }, lanterns: [
    { id: 'L2', pos: [2, 0, 0], deposited: 1 }, { id: 'L1', pos: [-2, 0, 0], deposited: 2 },
  ] };
  const { events, snapshots } = run({ scenario, frames: [{ tick: 0, interact: true }] });
  assert.deepEqual(events[0].data, { lantern_id: 'L1', amount: 6, deposited: 8 });
  assert.equal(snapshots.at(-1).lanterns[0].deposited, 8);
  assert.equal(snapshots.at(-1).lanterns[1].deposited, 1);
  assert.equal(snapshots.at(-1).score, 60);
});

test('a newly lit refuge evicts an overlapping shade within 30 steps without damage', () => {
  const { snapshots, events } = run({ ticks: 30, scenario: { ...empty, player: { carried: 1 },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], deposited: 9 }], shades: [{ pos: [0, 1, 0] }] },
  frames: [{ tick: 0, interact: true }] });
  assert.deepEqual(events.map(event => event.name), ['deposit', 'lantern_lit']);
  const [x, , z] = snapshots.at(-1).shades[0].pos;
  assert.ok(Math.hypot(x, z) >= 5.999);
});

test('holding pause freezes simulation until a new press, including spawn and cooldown ticks', () => {
  const { snapshots, events, end } = run({ ticks: 245, scenario: { ...empty, random_motes: true,
    player: { invuln_ticks: 90, pulse_cd_ticks: 3, dash_cd_ticks: 4, charm_ticks: 600 } }, frames: [
    { tick: 0, move: [1, 0] }, { tick: 1, pause: true }, { tick: 4, pause: false },
    { tick: 5, move: [0, 0], pause: true },
  ] });
  assert.deepEqual(events.filter(event => ['paused', 'resumed'].includes(event.name)).map(event => [event.name, event.tick]),
    [['paused', 2], ['resumed', 6]]);
  for (const frame of snapshots.slice(2, 6)) {
    assert.equal(frame.state, 'paused');
    assert.equal(frame.sim_tick, 1);
    for (const key of ['player', 'time_left_s', 'motes']) assert.deepEqual(frame[key], snapshots[1][key]);
  }
  assert.equal(snapshots[6].sim_tick, 2);
  assert.equal(snapshots[243].motes_active, 20);
  assert.equal(snapshots[244].motes_active, 21);
  assert.equal(end.state, 'playing');
  assert.equal(run({ ticks: 3, frames: [{ tick: 0, pause: true }] }).end.state, 'paused');
});

test('dash moves 2.8 metres over 12 ticks and requires a new press after tick 90', () => {
  const { events, snapshots } = run({ ticks: 100, frames: [
    { tick: 0, dash: true }, { tick: 87, dash: false }, { tick: 88, dash: true },
    { tick: 89, dash: false }, { tick: 90, dash: true },
  ] });
  assert.deepEqual(events.filter(event => event.name === 'dash').map(event => event.tick), [1, 91]);
  assert.deepEqual(snapshots[1].player.vel, [0, 0, 14]);
  assert.deepEqual(snapshots[12].player.pos, [0, 0, 2.8]);
  assert.ok(snapshots[90].player.dash_cd_s > 0);
});

test('wind charm speeds running, allows dash chains and respawns after 2700 simulation ticks', () => {
  const { events, snapshots } = run({ night: 2, ticks: 2702, scenario: { ...empty,
    charms: [{ id: 'C1', pos: [0, 0, 0] }] }, frames: [
    { tick: 1, move: [1, 0] }, { tick: 8, move: [0, 0], dash: true },
    { tick: 9, dash: false }, { tick: 10, dash: true }, { tick: 20, dash: false }, { tick: 21, dash: true },
  ] });
  assert.deepEqual(events[0].data, { charm_id: 'C1', charm_ticks: 600 });
  assert.equal(snapshots[1].player.charm_s, 10);
  assert.equal(snapshots[7].player.vel[0], 7.2);
  assert.deepEqual(events.filter(event => event.name === 'dash').map(event => event.tick), [9, 22]);
  assert.equal(snapshots[601].player.charm_s, 0);
  assert.equal(snapshots[2700].charms[0].available, false);
  assert.deepEqual(snapshots[2701].charms[0], { id: 'C1', available: true, respawn_s: 0 });
});

test('fall ignores invulnerability, loses inventory and respawns after 60 steps', () => {
  const { events, snapshots } = run({ ticks: 61, scenario: { ...empty,
    player: { pos: [41, -11, 0], carried: 7, invuln_ticks: 90 } } });
  assert.deepEqual(events.map(({ name, data }) => [name, data]), [
    ['player_hit', { by: 'fall', flames: 2, dropped: 0, lost: 7 }],
  ]);
  assert.deepEqual(snapshots[1].motes, []);
  assert.ok(snapshots[60].player.pos[1] < -10);
  assert.deepEqual(snapshots[61].player.pos, [0, 0, 0]);
  assert.deepEqual(snapshots[61].player.vel, [0, 0, 0]);
  assert.equal(snapshots[61].player.invuln, 1.5);
});

test('drifter steals in a refuge and while invulnerable without taking a flame', () => {
  const { events, snapshots } = run({ night: 2, ticks: 241, scenario: { ...empty, charms: [],
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], player: { carried: 5, invuln_ticks: 60 },
    drifters: [{ id: 'D1', pos: [1.2, 0, 0] }] } });
  assert.deepEqual(events, [{ type: 'event', tick: 1, name: 'drifter_steal',
    data: { drifter_id: 'D1', amount: 3, carried: 2 } }]);
  assert.equal(snapshots[1].player.flames, 3);
  assert.equal(snapshots[1].drifters[0].state, 'flee');
  assert.equal(snapshots[240].drifters[0].state, 'flee');
  assert.equal(snapshots[241].drifters[0].state, 'removed');
  assert.equal(snapshots[241].drifters[0].stolen, 3);
});

test('drifter theft resolves before simultaneous shade contact and affects the drop count', () => {
  const { events, snapshots } = run({ night: 2, ticks: 1, scenario: { ...empty, charms: [],
    player: { carried: 8 }, shades: [{ pos: [0, 1, 0] }], drifters: [{ pos: [0, 0, 0] }] } });
  assert.deepEqual(events.map(({ name, data }) => [name, data]), [
    ['drifter_steal', { drifter_id: 'D1', amount: 3, carried: 5 }],
    ['player_hit', { by: 'shade', flames: 2, dropped: 2 }],
  ]);
  assert.equal(snapshots[1].player.carried, 3);
  for (const mote of snapshots[1].motes) {
    assert.equal(mote.kind, 'dropped');
    assert.equal(mote.ttl_s, 8);
    const [x, , z] = mote.pos;
    assert.ok(Math.hypot(x, z) >= 1.499 && Math.hypot(x, z) <= 2.501);
  }
});

test('pulse chases off an approaching drifter and recovers stolen motes from a fleeing drifter', () => {
  const { events, snapshots } = run({ night: 2, ticks: 121, scenario: { ...empty, charms: [],
    player: { carried: 8 }, drifters: [
      { id: 'D1', pos: [2, 0, 0], state: 'chase' },
      { id: 'D2', pos: [-2, 0, 0], state: 'flee', stolen: 3, state_ticks_left: 200 },
    ] }, frames: [{ tick: 0, pulse: true }] });
  assert.deepEqual(events.filter(event => event.name === 'drifter_drop'), [
    { type: 'event', tick: 1, name: 'drifter_drop', data: { drifter_id: 'D2', amount: 3 } },
  ]);
  assert.ok(events.every(event => event.name !== 'drifter_steal'));
  assert.equal(snapshots[1].drifters[0].state, 'flee');
  assert.equal(snapshots[1].motes.filter(mote => mote.kind === 'dropped').length, 3);
  assert.equal(snapshots[120].drifters[1].state, 'flee');
  assert.equal(snapshots[121].drifters[1].state, 'removed');
});

test('natural drifters spawn at ticks 1200 and 2400 in nights 2 and 3 only', () => {
  for (const night of [1, 2, 3]) {
    const { snapshots } = run({ night, ticks: 2400, every: 1, scenario: { ...empty, random_drifters: true,
      charms: [], wind_enabled: false } });
    assert.deepEqual([1199, 1200, 2399, 2400].map(tick => snapshots[tick].drifters.map(({ id }) => id)),
      night === 1 ? [[], [], [], []] : [[], ['D1'], ['D1'], ['D1', 'D2']]);
  }
});

test('night 3 wind pushes for 5 seconds from tick 1800 and can be disabled', () => {
  const scenario = { ...empty, charms: [], player: { pos: [0, 0, -25] } };
  const options = { night: 3, ticks: 2100, every: 1, scenario };
  const { snapshots, raw } = run(options);
  assert.equal(snapshots[1799].wind.active, false);
  assert.equal(snapshots[1800].wind.active, true);
  assert.equal(snapshots[2099].wind.active, true);
  assert.equal(snapshots[2100].wind.active, false);
  const [fromX, , fromZ] = snapshots[1799].player.pos;
  const [x, , z] = snapshots[2099].player.pos;
  assert.ok(Math.abs(Math.hypot(x - fromX, z - fromZ) - 10) < 0.002);
  assert.equal(raw, run(options).raw);
  const disabled = run({ ...options, scenario: { ...scenario, wind_enabled: false } });
  assert.ok(disabled.snapshots.every(frame => !frame.wind.active));
  assert.deepEqual(disabled.snapshots.at(-1).player.pos, disabled.snapshots[0].player.pos);
});

test('night 2 bridge and launch pads connect the islands on foot and in the air', () => {
  const bridge = run({ night: 2, ticks: 210, scenario: { ...empty, charms: [], player: { pos: [25, 0, 0] } },
    frames: [{ tick: 0, move: [1, 0] }] });
  assert.ok(bridge.snapshots.every(({ player }) => player.grounded && player.pos[1] === 0));
  assert.ok(bridge.snapshots.at(-1).player.pos[0] > 44);

  const pad = run({ night: 2, ticks: 90, scenario: { ...empty, charms: [], player: { pos: [20, 0, 18] } },
    frames: [{ tick: 1, move: [-1, 0] }] });
  assert.equal(pad.snapshots[1].player.vel[1], 14);
  assert.ok(Math.abs(Math.hypot(pad.snapshots[40].player.vel[0], pad.snapshots[40].player.vel[2]) - 24) < 0.002);
  const landing = pad.snapshots.find(({ tick, player }) => tick > 1 && player.grounded);
  assert.ok(landing.tick >= 80 && landing.tick <= 86);
  assert.ok(Math.hypot(landing.player.pos[0] - 70, landing.player.pos[2]) <= 28);
});

test('night 3 ramp and launch pad reach the two elevated tiers', () => {
  const noSpawns = { ...empty, charms: [], wind_enabled: false };
  const ramp = run({ night: 3, ticks: 75, scenario: { ...noSpawns, player: { pos: [26.847, 0, 15.5] } },
    frames: [{ tick: 0, move: [-Math.sqrt(3) / 2, -0.5] }] });
  assert.ok(ramp.snapshots.some(({ player }) => player.pos[1] > 0 && player.pos[1] < 3));
  assert.equal(ramp.snapshots.at(-1).player.pos[1], 3);
  const pad = run({ night: 3, ticks: 54, scenario: { ...noSpawns, player: { pos: [0, 3, 13] } },
    frames: [{ tick: 1, move: [0, 1] }] });
  assert.deepEqual(pad.snapshots[1].player.vel, [0, 12, -8]);
  const landing = pad.snapshots.find(({ tick, player }) => tick > 1 && player.grounded);
  assert.equal(landing.player.pos[1], 6);
  assert.ok(landing.player.pos[2] < 8);
});

test('full night 3 runs within 30 seconds', () => {
  const started = performance.now();
  const { end, snapshots } = run({ night: 3, seed: 42, ticks: 21600, every: 600,
    scenario: { wind_enabled: false, player: { invuln_ticks: 21601 } } });
  assert.deepEqual(end, { type: 'end', ticks: 21600, state: 'lost', score: 0 });
  assert.equal(snapshots.at(-1).shades.length, 10);
  assert.equal(snapshots.at(-1).drifters.length, 2);
  assert.ok(performance.now() - started <= 30000);
});
