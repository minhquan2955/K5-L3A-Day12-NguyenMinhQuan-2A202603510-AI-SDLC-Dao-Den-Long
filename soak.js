import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { createGame, idleInput, stepGame, tuning, HZ } from './game.js';

function randomFrom(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296);
}

export function runSoak({ seed = 7, nights = 10 } = {}) {
  const started = performance.now();
  const results = [];
  let game;
  let memStart;
  for (let i = 0; i < nights; i += 1) {
    const night = i % 3 + 1;
    game = createGame(seed + i, {}, night);
    if (i === 0) memStart = process.memoryUsage().rss / 1048576;
    const random = randomFrom(seed + i);
    const directions = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [.707, .707], [-.707, .707], [.707, -.707], [-.707, -.707]];
    let move = [0, 0];
    for (let tick = 0; tick < tuning[`night${night}_duration_s`] * HZ && game.state === 'playing'; tick += 1) {
      if (tick % 30 === 0) move = directions[Math.floor(random() * directions.length)];
      stepGame(game, { ...idleInput, move, jump: random() < .05, dash: random() < .03,
        pulse: random() < .02, interact: random() < .1 });
    }
    results.push(game.state);
  }
  game = createGame(seed + nights, {}, (nights - 1) % 3 + 1);
  return {
    nights, crashes: 0, results,
    mem_start_mb: Number(memStart.toFixed(1)),
    mem_end_mb: Number((process.memoryUsage().rss / 1048576).toFixed(1)),
    duration_s: Number(((performance.now() - started) / 1000).toFixed(2)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) =>
    value.startsWith('--') ? [value.slice(2), all[index + 1]] : null).filter(Boolean));
  if (!args.out || !/^-?\d+$/.test(args.seed ?? '7') || !/^\d+$/.test(args.nights ?? '10') ||
      Number(args.nights ?? 10) < 1 || Number(args.nights ?? 10) > 100) {
    console.error('Usage: node soak.js --seed 7 --nights 10 --out soak.json');
    process.exitCode = 2;
  } else {
    const report = runSoak({ seed: Number(args.seed ?? 7), nights: Number(args.nights ?? 10) });
    writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report));
  }
}
