import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { addEntry, rankEntries, validName } from '../leaderboard.js';
import { summarizeFrames } from '../bench-metrics.js';
import { runSoak } from '../soak.js';

test('leaderboard accepts only 3–12 ASCII letters, numbers, and underscores', () => {
  assert.equal(validName('May_2026'), true);
  for (const name of ['ab', 'this_name_is_long', 'Mây', 'May Quan', '']) assert.equal(validName(name), false);
});

test('leaderboard sorts by score then achievement time and keeps ten entries', () => {
  const entries = Array.from({ length: 11 }, (_, i) => ({ name: `P${String(i).padStart(2, '0')}`,
    score: i === 0 ? 50 : 100, nights_won: 2, achieved_at: `2026-11-${String(i + 1).padStart(2, '0')}T00:00:00Z`, seed: 42 }));
  assert.equal(rankEntries(entries).length, 10);
  assert.equal(rankEntries(entries)[0].name, 'P01');
  assert.equal(rankEntries(entries).at(-1).name, 'P10');
  assert.deepEqual(addEntry([], { name: 'Mây', score: 0, nights_won: 0, seed: 42 }), { error: 'invalid_name' });
});

test('benchmark summary reports mean FPS, slowest one percent, and p95 frame time', () => {
  assert.deepEqual(summarizeFrames([10, 20, 30, 40]), {
    frames: 4, avg_fps: 40, p1_low_fps: 25, frame_ms_p95: 40,
  });
  assert.equal(summarizeFrames([]), null);
});

test('soak results repeat exactly for a seed and alternate the three nights', () => {
  const a = runSoak({ seed: 7, nights: 4 });
  assert.deepEqual(runSoak({ seed: 7, nights: 4 }).results, a.results);
  assert.equal(a.results.length, 4);
  assert.equal(a.crashes, 0);
});

test('leaderboard survives a server restart and exports the same top ten', { timeout: 5000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lantern-board-'));
  const data = join(dir, 'scores.json');
  const out = join(dir, 'export.json');
  const socket = createServer();
  await new Promise(resolvePort => socket.listen(0, '127.0.0.1', resolvePort));
  const port = socket.address().port;
  await new Promise(resolvePort => socket.close(resolvePort));
  let child;
  const start = async () => {
    child = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), stdio: 'ignore',
      env: { ...process.env, PORT: String(port), LEADERBOARD_FILE: data } });
    for (let i = 0; i < 50; i += 1) {
      try { await fetch(`http://127.0.0.1:${port}/api/leaderboard`); return; } catch { await delay(20); }
    }
    throw new Error('server did not start');
  };
  const stop = async () => {
    const process = child;
    if (process.exitCode !== null || process.signalCode !== null) return;
    const exited = new Promise(resolveExit => process.once('exit', resolveExit));
    process.kill();
    await exited;
  };
  try {
    await start();
    const saved = await fetch(`http://127.0.0.1:${port}/api/leaderboard`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'May_1', score: 123,
        nights_won: 2, seed: 42 }) });
    assert.equal(saved.status, 201);
    await stop();
    await start();
    const entries = (await (await fetch(`http://127.0.0.1:${port}/api/leaderboard`)).json()).entries;
    assert.equal(entries[0].name, 'May_1');
    await stop();
    const exported = spawnSync(process.execPath, ['server.js', '--export-leaderboard', out], {
      cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, LEADERBOARD_FILE: data },
    });
    assert.equal(exported.status, 0, exported.stderr);
    assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).entries, entries);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
