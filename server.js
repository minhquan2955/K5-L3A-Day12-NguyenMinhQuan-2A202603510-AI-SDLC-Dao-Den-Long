import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { addEntry, rankEntries } from './leaderboard.js';

const leaderboardFile = process.env.LEADERBOARD_FILE
  ? pathToFileURL(resolve(process.env.LEADERBOARD_FILE)) : new URL('leaderboard.json', import.meta.url);
function readLeaderboard() {
  try {
    return rankEntries(JSON.parse(readFileSync(leaderboardFile, 'utf8')).entries ?? []);
  } catch { return []; }
}
if (process.argv[2] === '--export-leaderboard') {
  if (!process.argv[3]) {
    console.error('Usage: node server.js --export-leaderboard out.json');
    process.exit(2);
  }
  writeFileSync(process.argv[3], `${JSON.stringify({ entries: readLeaderboard() }, null, 2)}\n`);
  process.exit(0);
}

const paths = {
  '/': ['index.html', 'text/html'],
  '/style.css': ['style.css', 'text/css'],
  '/view.js': ['view.js', 'text/javascript'],
  '/game.js': ['game.js', 'text/javascript'],
  '/maps.js': ['maps.js', 'text/javascript'],
  '/movement.js': ['movement.js', 'text/javascript'],
  '/enemies.js': ['enemies.js', 'text/javascript'],
  '/bench-metrics.js': ['bench-metrics.js', 'text/javascript'],
  '/game.contract.json': ['game.contract.json', 'application/json'],
  '/vendor/three.module.js': ['node_modules/three/build/three.module.js', 'text/javascript'],
  '/vendor/three.core.js': ['node_modules/three/build/three.core.js', 'text/javascript'],
};
const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  if (path === '/api/bench-result' && req.method === 'POST' && req.headers['x-bench-token'] === process.env.BENCH_TOKEN && process.env.BENCH_OUTPUT) {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const report = JSON.parse(body);
      report.os = process.env.BENCH_OS ?? report.os;
      writeFileSync(process.env.BENCH_OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
      res.writeHead(204).end();
      server.close();
    } catch {
      res.writeHead(400).end();
    }
    return;
  }
  if (path === '/api/leaderboard' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ entries: readLeaderboard() }));
    return;
  }
  if (path === '/api/leaderboard' && req.method === 'POST') {
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 4096) throw new Error('too_large');
      }
      const result = addEntry(readLeaderboard(), JSON.parse(body));
      if (result.error) {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
        return;
      }
      writeFileSync(leaderboardFile, `${JSON.stringify({ entries: result.entries }, null, 2)}\n`);
      res.writeHead(201, { 'Content-Type': 'application/json' }).end(JSON.stringify({ entries: result.entries }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' }).end('{"error":"invalid_entry"}');
    }
    return;
  }
  if (!Object.hasOwn(paths, path)) {
    res.writeHead(404).end();
    return;
  }
  const [file, type] = paths[path];
  const stream = createReadStream(new URL(file, import.meta.url));
  stream.once('error', () => res.writeHead(404).end());
  stream.once('open', () => {
    res.setHeader('Content-Type', `${type}; charset=utf-8`);
    stream.pipe(res);
  });
}).listen(port, '127.0.0.1', () => console.log(`Đảo Đèn Lồng · http://127.0.0.1:${server.address().port}`));
