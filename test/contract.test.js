import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const contract = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url)));
const t = contract.tuning;
const empty = {
  random_motes: false, random_shades: false,
  lanterns: Array.from({ length: 5 }, (_, i) => ({ id: `L${i + 1}`, pos: [25, 0, i * 4] })),
};

function run({ scenario = empty, frames = [], ticks = 60, every = 1, seed = 53, status = 0, invalidJson = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lantern-contract-'));
  try {
    const out = join(dir, 'out.jsonl');
    const scenarioFile = join(dir, 'scenario.json');
    const inputsFile = join(dir, 'inputs.json');
    writeFileSync(scenarioFile, JSON.stringify(scenario));
    writeFileSync(inputsFile, invalidJson ? '{' : JSON.stringify({ frames }));
    const [command, ...commandArgs] = contract.headless_cmd.split(' ');
    assert.equal(command, 'node');
    const result = spawnSync(process.execPath, [...commandArgs, '--night', '1', '--seed', String(seed),
      '--scenario', scenarioFile, '--inputs', inputsFile, '--ticks', String(ticks),
      '--snapshot-every', String(every), '--out', out], { encoding: 'utf8' });
    assert.equal(result.status, status, result.stderr);
    if (status) {
      assert.ok(result.stderr.trim());
      return;
    }
    const raw = readFileSync(out, 'utf8');
    const lines = raw.trimEnd().split('\n').map(JSON.parse);
    return { raw, events: lines.filter(x => x.type === 'event'), end: lines.at(-1),
      snapshots: lines.filter(x => x.type === 'snapshot') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('tick zero, sparse input, camera-relative normalized movement and jump', () => {
  const { snapshots, end } = run({ frames: [
    { tick: 0, move: [1, 1], cam_yaw_deg: 90 },
    { tick: 30, jump: true },
  ] });
  assert.deepEqual(snapshots[0].player.pos, [0, 0, 0]);
  assert.equal(snapshots[0].lanterns.length, 5);
  assert.equal(snapshots[30].player.pos[1], 0);
  assert.ok(snapshots[31].player.pos[1] > 0);
  const step = Number((t.player_speed / Math.sqrt(2)).toFixed(3));
  assert.deepEqual(snapshots[60].player.pos, [step, 0, -step]);
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
  assert.equal(end.score, 2 * t.score.per_mote + t.score.per_lantern +
    Math.floor(12 - 163 / 60) * t.score.per_second_left + t.flames * t.score.per_flame_left);
});

test('capacity limits pickup and pulse stuns, pushes and charges light only on an edge', () => {
  const { events, snapshots } = run({ ticks: 120,
    scenario: { ...empty, player: { carried: t.carry_capacity }, motes: [[0, 0, 0]],
      shades: [{ id: 'near', pos: [2, 1, 0] }, { id: 'far', pos: [12, 1, 0] }] },
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }],
  });
  assert.deepEqual(events[0].data, { stunned_ids: ['near'] });
  assert.equal(events.filter(e => e.name === 'pulse').length, 1);
  assert.equal(snapshots[1].player.carried, t.carry_capacity - t.pulse_cost);
  assert.deepEqual(snapshots[1].shades[0], { id: 'near', pos: [2 + t.pulse_push_m, 1, 0], state: 'stunned' });
  assert.ok(snapshots[1].shades[1].pos[0] < 12);
  assert.equal(snapshots[2].motes_active, 0);
  assert.equal(snapshots[120].shades[0].state, 'chase');
});

test('shade contact costs a flame, grants invulnerability, and can end the game', () => {
  const { events, end } = run({ ticks: 200, scenario: { ...empty,
    player: { flames: 2 }, shades: [{ pos: [0, 1, 0] }] } });
  assert.deepEqual(events.map(e => e.name), ['player_hit', 'player_hit', 'game_over']);
  assert.equal(events[0].tick, 1);
  assert.equal(events[1].tick, 1 + Math.round(t.invuln_s * 60));
  assert.deepEqual(events[0].data, { by: 'shade', flames: 1, dropped: 0 });
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

test('pulse cannot knock a shade into a lit lantern refuge', () => {
  const { snapshots, events } = run({ ticks: 1, scenario: { ...empty,
    player: { carried: t.pulse_cost },
    lanterns: [{ id: 'L1', pos: [8, 0, 0], lit: true }],
    shades: [{ pos: [4.5, 1, 0] }] },
    frames: [{ tick: 0, pulse: true }],
  });
  assert.deepEqual(events[0].data, { stunned_ids: ['S1'] });
  assert.equal(snapshots[1].shades[0].pos[0], 8 - t.safe_radius);
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
