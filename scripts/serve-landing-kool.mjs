import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import handler from '../api/kool-download.js';

// Environment is loaded by Node, only in this backend process. Local runs are tests.
process.env.KOOL_TEST_MODE = 'true';
process.env.VERCEL_ENV = 'development';
const root = resolve('landing');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/kool-download') return handler(req, res);
  try {
    const path = resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error('not found');
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    createReadStream(path).pipe(res);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
  console.log(`Warden landing: http://127.0.0.1:${server.address().port} (Kool test mode)`);
});
