import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { tmpdir, platform, release } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const started = Math.round(performance.timeOrigin);

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? fallback : process.argv[index + 1];
}

function findBrowser() {
  const candidates = [process.env.CHROME_BIN,
    ...(platform() === 'win32' ? [
      `${process.env.ProgramFiles ?? 'C:/Program Files'}/Google/Chrome/Application/chrome.exe`,
      `${process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)'}/Microsoft/Edge/Application/msedge.exe`,
      `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    ] : platform() === 'darwin' ? [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ] : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge'])];
  return candidates.find(path => path && existsSync(path));
}

async function freePort() {
  const socket = createServer();
  await new Promise(resolvePort => socket.listen(0, '127.0.0.1', resolvePort));
  const { port } = socket.address();
  await new Promise(resolvePort => socket.close(resolvePort));
  return port;
}

const duration = Number(arg('duration', '30'));
const seed = Number(arg('seed', '42'));
const output = arg('out');
const browser = findBrowser();
if (!output || !Number.isSafeInteger(seed) || !Number.isInteger(duration) || duration < 1 || duration > 600 || !browser) {
  console.error('Usage: node bench.js --seed 42 --duration 30 --out bench.json (set CHROME_BIN if needed)');
  process.exit(2);
}

const out = resolve(output);
const token = randomUUID();
const port = await freePort();
const profile = mkdtempSync(join(tmpdir(), 'dao-den-long-bench-'));
writeFileSync(out, '');
const server = spawn(process.execPath, ['server.js'], { cwd: import.meta.dirname,
  env: { ...process.env, PORT: String(port), BENCH_OUTPUT: out, BENCH_TOKEN: token,
    BENCH_OS: `${platform()} ${release()}` }, stdio: 'ignore' });
const url = `http://127.0.0.1:${port}/?benchmark=1&seed=${seed}&duration=${duration}&token=${token}&started=${started}`;
const chrome = spawn(browser, ['--app=' + url, '--user-data-dir=' + profile, '--window-size=1280,720',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], { stdio: 'ignore' });
try {
  const deadline = Date.now() + (duration + 60) * 1000;
  while (Date.now() < deadline && statSync(out).size === 0) {
    if (server.exitCode !== null) throw new Error('Local game server exited before benchmark completed.');
    await delay(250);
  }
  if (!statSync(out).size) throw new Error('Benchmark timed out; check that the browser supports WebGL 2.');
  const report = JSON.parse(readFileSync(out, 'utf8'));
  if (!report.frames) throw new Error('Benchmark did not capture any frames.');
  console.log(JSON.stringify({ ...report, os: `${platform()} ${release()}` }, null, 2));
} finally {
  chrome.kill();
  server.kill();
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5 }); } catch {}
}
