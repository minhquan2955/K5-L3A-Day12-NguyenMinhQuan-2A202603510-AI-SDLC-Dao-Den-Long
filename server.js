import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';

const paths = {
  '/': ['index.html', 'text/html'],
  '/style.css': ['style.css', 'text/css'],
  '/view.js': ['view.js', 'text/javascript'],
  '/game.js': ['game.js', 'text/javascript'],
  '/game.contract.json': ['game.contract.json', 'application/json'],
  '/vendor/three.module.js': ['node_modules/three/build/three.module.js', 'text/javascript'],
  '/vendor/three.core.js': ['node_modules/three/build/three.core.js', 'text/javascript'],
};
const port = Number(process.env.PORT ?? 3000);

createServer((req, res) => {
  const path = req.url.split('?')[0];
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
}).listen(port, '127.0.0.1', () => console.log(`Đảo Đèn Lồng · http://127.0.0.1:${port}`));
