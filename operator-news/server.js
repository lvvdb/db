// Standalone server for the News page. In Operator, mount the two API routes
// on the existing server and the files in public/ as the News view.
//   GET  /api/news          -> current state (items, sources health, brief, updatedAt)
//   POST /api/news/refresh  -> force a refresh, returns new state
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { refresh, readState } from './lib/pipeline.js';

const PORT = +process.env.PORT || 4321;
const EVERY_MS = 30 * 60 * 1000;
const PUBLIC = new URL('./public/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

if (process.argv.includes('--once')) {
  await refresh();
  process.exit(0);
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname === '/api/news' && req.method === 'GET') {
        const state = (await readState()) || (await refresh());
        return send(res, 200, { ...state, nextRefreshAt: nextAt });
      }
      if (url.pathname === '/api/news/refresh' && req.method === 'POST') {
        const state = await refresh();
        schedule();
        return send(res, 200, { ...state, nextRefreshAt: nextAt });
      }
      const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
      if (!file.startsWith(PUBLIC)) return send(res, 403, 'forbidden', 'text/plain');
      return send(res, 200, await readFile(file), TYPES[path.extname(file)] || 'application/octet-stream');
    } catch (e) {
      if (e.code === 'ENOENT') return send(res, 404, 'not found', 'text/plain');
      console.error(e);
      return send(res, 500, { error: e.message });
    }
  })
  .listen(PORT, () => console.log(`[news] http://localhost:${PORT}`));

// Background refresh every 30 min, on startup if the cache is stale.
let timer, nextAt;
function schedule() {
  clearTimeout(timer);
  nextAt = Date.now() + EVERY_MS;
  timer = setTimeout(() => refresh().catch((e) => console.error('[news] refresh failed', e)).finally(schedule), EVERY_MS);
}
const s = await readState();
if (!s || Date.now() - s.updatedAt > EVERY_MS) refresh().catch((e) => console.error('[news] refresh failed', e));
schedule();
