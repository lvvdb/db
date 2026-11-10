// Minimal static server for the built site. It behaves like the static hosts this
// build targets (Netlify, Cloudflare Pages, Vercel with cleanUrls):
//   /foo        -> dist/foo.html
//   /foo/       -> 301 /foo          (one canonical form, no trailing slash)
//   /foo.html   -> 301 /foo
//   _redirects  -> honoured, first match wins, single hop
//   anything else -> dist/404.html with a 404 status
// Used by `npm run preview:static` and by scripts/qa.mjs to test every redirect.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

export async function loadRedirects(root) {
  try {
    const text = await readFile(path.join(root, '_redirects'), 'utf8');
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const [from, to, status = '301'] = l.split(/\s+/);
        return { from, to, status: Number(status.replace('!', '')) };
      });
  } catch {
    return [];
  }
}

function matchRedirect(rules, pathname) {
  for (const r of rules) {
    if (r.from.endsWith('/*')) {
      const prefix = r.from.slice(0, -1);
      if (pathname.startsWith(prefix) || pathname === prefix.slice(0, -1)) return r;
    } else if (r.from === pathname || r.from === pathname.replace(/\/$/, '')) {
      return r;
    }
  }
  return null;
}

const exists = async (p) => {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
};

export async function createStaticServer(root) {
  const rules = await loadRedirects(root);
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);

    const rule = matchRedirect(rules, pathname);
    if (rule) {
      if (rule.status >= 300 && rule.status < 400) {
        res.writeHead(rule.status, { Location: rule.to });
        return res.end();
      }
      // 404 / 410 rules: serve the target document with that status, noindexed.
      const body = await readFile(path.join(root, rule.to.replace(/^\//, ''))).catch(() => 'Gone');
      res.writeHead(rule.status, {
        'Content-Type': TYPES['.html'],
        'X-Robots-Tag': 'noindex',
      });
      return res.end(body);
    }

    if (pathname !== '/' && pathname.endsWith('/')) {
      res.writeHead(301, { Location: pathname.replace(/\/+$/, '') + url.search });
      return res.end();
    }
    if (pathname.endsWith('.html')) {
      const clean = pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
      res.writeHead(301, { Location: clean + url.search });
      return res.end();
    }

    const candidates =
      pathname === '/'
        ? ['index.html']
        : [pathname.slice(1), pathname.slice(1) + '.html', pathname.slice(1) + '/index.html'];
    for (const rel of candidates) {
      const file = path.join(root, rel);
      if (!file.startsWith(root)) break;
      if (await exists(file)) {
        const type = TYPES[path.extname(file)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        return res.end(await readFile(file));
      }
    }
    const notFound = await readFile(path.join(root, '404.html')).catch(() => 'Not found');
    res.writeHead(404, { 'Content-Type': TYPES['.html'], 'X-Robots-Tag': 'noindex' });
    res.end(notFound);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || 'dist');
  const port = Number(process.argv[3] || process.env.PORT || 4321);
  const server = await createStaticServer(root);
  server.listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
}
