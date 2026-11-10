// Builds sitemap.xml from the HTML that was actually emitted, so the sitemap can only
// ever list pages that exist, are indexable, and canonicalise to themselves.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const attr = (html, re) => (html.match(re) || [])[1];

export function sitemapFromBuild({ site }) {
  return {
    name: 'hhmd-sitemap',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = await walk(root);
        const urls = [];
        for (const file of files) {
          const html = await readFile(file, 'utf8');
          const robots = attr(html, /<meta name="robots" content="([^"]*)"/i) || '';
          if (/noindex/i.test(robots)) continue;
          const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/i);
          if (!canonical || !canonical.startsWith(site)) continue;
          const rel = '/' + path.relative(root, file).replace(/\\/g, '/').replace(/\.html$/, '');
          const own = site + (rel === '/index' ? '/' : rel.replace(/\/index$/, ''));
          if (canonical !== own) continue; // only self-canonical pages belong in the sitemap
          const lastmod = attr(html, /<meta property="og:updated_time" content="([^"]*)"/i);
          urls.push({ loc: canonical, lastmod });
        }
        urls.sort((a, b) => a.loc.localeCompare(b.loc));
        const xml =
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          urls
            .map(
              (u) =>
                `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
            )
            .join('\n') +
          '\n</urlset>\n';
        await writeFile(path.join(root, 'sitemap.xml'), xml);
        logger.info(`sitemap.xml written with ${urls.length} indexable URLs`);
      },
    },
  };
}
