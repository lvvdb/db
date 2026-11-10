// Post-build quality gate. Run with `npm run qa` after `npm run build`.
//
//   node scripts/qa.mjs            checks dist/ and writes docs/site-audit.md
//   node scripts/qa.mjs --launch   also fails while any [[CONFIRM]] marker or on-hold page remains
//   node scripts/qa.mjs --dir dist-drafts   check the drafts build instead
//
// What it proves, page by page:
//   one H1, unique title / meta description / H1, sane lengths
//   self-referencing canonical on one host with no trailing slash
//   every indexable page has exactly one primary search and no two pages share one
//   JSON-LD parses and each node has the properties its type needs
//   no [[CONFIRM]] marker inside a title, meta tag, attribute or JSON-LD
//   no broken internal link and no orphan page
//   sitemap.xml lists every indexable page and nothing else
//   no two city pages share more than a third of their copy
//   every redirect lands on a 200 in a single hop (tested against a local server)
//   compliance copy rules (brand drug names in headings, banned phrases, dashes)
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const LAUNCH = args.includes('--launch');
const distName = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'dist';
const dist = path.join(root, distName);
const SITE = 'https://hormonalhealthmd.com';

const errors = [];
const warnings = [];
const err = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warnings.push(`${page}: ${msg}`);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&[a-z]+;/g, ' ');
const text = (html) =>
  decode(
    html
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
const first = (html, re) => {
  const m = html.match(re);
  return m ? decode(m[1]) : '';
};
const all = (html, re) => [...html.matchAll(re)].map((m) => m[1]);

// ---------------------------------------------------------------- load pages
const files = (await walk(dist)).filter((f) => f.endsWith('.html'));
const keywordMap = JSON.parse(await readFile(path.join(root, 'src/data/keyword-map.json'), 'utf8'));
const pages = [];

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const rel = '/' + path.relative(dist, file).replace(/\\/g, '/').replace(/\.html$/, '');
  const url = rel === '/index' ? '/' : rel.replace(/\/index$/, '');
  const headEnd = html.indexOf('</head>');
  const head = html.slice(0, headEnd);
  const body = html.slice(headEnd);
  const main = (body.match(/<main[\s\S]*?<\/main>/) || [body])[0];
  const article = (body.match(/<article class="pbody__main[\s\S]*?<\/article>/) || [''])[0];
  const robots = first(head, /<meta name="robots" content="([^"]*)"/);
  pages.push({
    url,
    html,
    head,
    body,
    main,
    article,
    title: first(head, /<title>([\s\S]*?)<\/title>/),
    description: first(head, /<meta name="description" content="([^"]*)"/),
    canonical: first(head, /<link rel="canonical" href="([^"]*)"/),
    noindex: /noindex/.test(robots),
    h1s: all(body, /<h1[^>]*>([\s\S]*?)<\/h1>/g).map(text),
    headings: all(body, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g).map(text),
    confirms: all(body, /data-confirm="([^"]*)"/g).map(decode),
    words: text(main).split(' ').filter(Boolean).length,
    jsonld: all(head, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    links: all(body, /<a\b[^>]*\shref="([^"]*)"/g).map(decode),
    onHold: /class="notice"/.test(body),
  });
}
pages.sort((a, b) => a.url.localeCompare(b.url));
const byUrl = new Map(pages.map((p) => [p.url, p]));
const indexable = pages.filter((p) => !p.noindex && p.url !== '/404');

// ------------------------------------------------- titles, descriptions, H1s
const seen = { title: new Map(), description: new Map(), h1: new Map() };
for (const p of pages) {
  if (p.url === '/404') continue;
  if (!p.title) err(p.url, 'missing <title>');
  if (!p.description) err(p.url, 'missing meta description');
  if (p.h1s.length !== 1) err(p.url, `expected exactly one H1, found ${p.h1s.length}`);
  if (p.title.length > 60) (p.title.length > 65 ? err : warn)(p.url, `title is ${p.title.length} characters (aim for 60)`);
  if (p.description.length > 155) (p.description.length > 160 ? err : warn)(p.url, `meta description is ${p.description.length} characters (max 155)`);
  if (p.description.length < 70) warn(p.url, `meta description is only ${p.description.length} characters`);
  if (/near me/i.test(p.title)) err(p.url, 'title contains "near me"');
  for (const [key, val] of [['title', p.title], ['description', p.description], ['h1', p.h1s[0] || '']]) {
    if (!val) continue;
    if (seen[key].has(val)) err(p.url, `duplicate ${key}, also on ${seen[key].get(val)}`);
    else seen[key].set(val, p.url);
  }
  // canonical
  const want = SITE + (p.url === '/' ? '/' : p.url);
  if (p.canonical !== want) err(p.url, `canonical is "${p.canonical}", expected "${want}"`);
}

// ------------------------------------------------------------- keyword map
const primaries = new Map();
for (const p of indexable) {
  const k = keywordMap[p.url];
  if (!k) {
    err(p.url, 'indexable page has no entry in src/data/keyword-map.json');
    continue;
  }
  const key = k.primary.toLowerCase();
  if (primaries.has(key)) err(p.url, `primary search "${k.primary}" is also targeted by ${primaries.get(key)}`);
  else primaries.set(key, p.url);
}

// ---------------------------------------------------------------- JSON-LD
const NEED = {
  MedicalClinic: ['name', 'url', 'telephone', 'address'],
  WebSite: ['url', 'name'],
  WebPage: ['url', 'name'],
  MedicalWebPage: ['url', 'name'],
  AboutPage: ['url', 'name'],
  ContactPage: ['url', 'name'],
  BreadcrumbList: ['itemListElement'],
  Service: ['name', 'provider'],
  FAQPage: ['mainEntity'],
};
let jsonLdNodes = 0;
for (const p of pages) {
  if (!p.jsonld.length) err(p.url, 'no JSON-LD block');
  for (const raw of p.jsonld) {
    if (/\[\[CONFIRM/.test(raw)) err(p.url, 'JSON-LD contains a [[CONFIRM]] marker');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      err(p.url, `JSON-LD does not parse: ${e.message}`);
      continue;
    }
    if (data['@context'] !== 'https://schema.org') err(p.url, 'JSON-LD @context is not https://schema.org');
    const ids = new Set((data['@graph'] || []).map((n) => n['@id']).filter(Boolean));
    for (const node of data['@graph'] || []) {
      jsonLdNodes++;
      const type = node['@type'];
      if (!type) err(p.url, 'JSON-LD node without @type');
      for (const prop of NEED[type] || []) {
        if (node[prop] === undefined || node[prop] === '' || node[prop] === null) err(p.url, `${type} is missing "${prop}"`);
      }
      if (type === 'BreadcrumbList') {
        node.itemListElement.forEach((li, i) => {
          if (li.position !== i + 1 || !li.name || !/^https:\/\//.test(li.item || '')) err(p.url, 'BreadcrumbList item is malformed');
        });
      }
      if (type === 'FAQPage') {
        for (const q of node.mainEntity) if (!q.name || !q.acceptedAnswer?.text) err(p.url, 'FAQPage question is malformed');
      }
      // every @id reference must resolve inside this page's graph
      JSON.stringify(node, (k, v) => {
        if (v && typeof v === 'object' && Object.keys(v).length === 1 && v['@id'] && !ids.has(v['@id'])) {
          err(p.url, `JSON-LD reference to undefined @id ${v['@id']}`);
        }
        return v;
      });
      for (const u of JSON.stringify(node).match(/"(?:url|item|@id)":"([^"]+)"/g) || []) {
        if (!/":"https:\/\//.test(u)) err(p.url, `JSON-LD has a non-absolute URL: ${u}`);
      }
    }
  }
}

// ------------------------------------------------------ CONFIRM placement
for (const p of pages) {
  if (/\[\[CONFIRM/.test(p.head)) err(p.url, '[[CONFIRM]] marker inside <head>');
  const attrs = p.body.replace(/<script[\s\S]*?<\/script>/g, '').match(/<[^>]*\[\[CONFIRM[^>]*>/g);
  if (attrs) err(p.url, '[[CONFIRM]] marker inside an HTML attribute');
  if (/\[\[CONFIRM/.test(text(p.body))) err(p.url, 'unwrapped [[CONFIRM]] marker in body text');
}

// -------------------------------------------------------- links and orphans
const assets = new Set((await walk(dist)).map((f) => '/' + path.relative(dist, f).replace(/\\/g, '/')));
const inbound = new Map(pages.map((p) => [p.url, new Set()]));
for (const p of pages) {
  for (const href of p.links) {
    if (/^(https?:|mailto:|tel:|#)/.test(href)) {
      if (href.startsWith(SITE)) err(p.url, `internal link written as absolute URL: ${href}`);
      continue;
    }
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;
    if (clean !== '/' && clean.endsWith('/')) err(p.url, `internal link has a trailing slash: ${href}`);
    if (byUrl.has(clean)) {
      if (clean !== p.url) inbound.get(clean).add(p.url);
    } else if (!assets.has(clean)) {
      err(p.url, `broken internal link: ${href}`);
    }
  }
}
for (const p of indexable) {
  if (p.url !== '/' && inbound.get(p.url).size === 0) err(p.url, 'orphan page: no other page links to it');
}

// ----------------------------------------------------------------- sitemap
const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8').catch(() => '');
const inSitemap = new Set(all(sitemap, /<loc>([^<]+)<\/loc>/g));
const shouldBe = new Set(indexable.map((p) => SITE + (p.url === '/' ? '/' : p.url)));
for (const u of shouldBe) if (!inSitemap.has(u)) err('sitemap.xml', `missing indexable page ${u}`);
for (const u of inSitemap) if (!shouldBe.has(u)) err('sitemap.xml', `lists a page that is not indexable: ${u}`);
const robotsTxt = await readFile(path.join(dist, 'robots.txt'), 'utf8').catch(() => '');
if (!robotsTxt.includes(`Sitemap: ${SITE}/sitemap.xml`)) err('robots.txt', 'missing Sitemap line');

// ------------------------------------------------- city page copy overlap
const shingles = (s, n = 4) => {
  const w = s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + n <= w.length; i++) set.add(w.slice(i, i + n).join(' '));
  return set;
};
const cityPages = pages.filter((p) => /^\/(areas|mobile-iv)\/./.test(p.url));
const overlaps = [];
for (let i = 0; i < cityPages.length; i++) {
  for (let j = i + 1; j < cityPages.length; j++) {
    const a = shingles(text(cityPages[i].article));
    const b = shingles(text(cityPages[j].article));
    let shared = 0;
    for (const s of a) if (b.has(s)) shared++;
    const ratio = shared / Math.min(a.size, b.size);
    overlaps.push({ a: cityPages[i].url, b: cityPages[j].url, ratio });
    if (ratio > 0.34) err(cityPages[i].url, `shares ${(ratio * 100).toFixed(0)}% of its copy with ${cityPages[j].url} (limit is about a third)`);
  }
}

// --------------------------------------------------------- compliance copy
const BRANDS = /\b(Ozempic|Wegovy|Mounjaro|Zepbound)\b/i;
for (const p of pages) {
  const t = text(p.main);
  if (/[—–]/.test(t) || /[—–]/.test(p.title + p.description)) err(p.url, 'contains an em dash or en dash');
  for (const h of [p.title, ...p.headings]) {
    if (BRANDS.test(h)) err(p.url, `brand-name weight loss drug in a title or heading: "${h}"`);
    if (/growth hormone|hgh/i.test(h) && /anti-?aging|bodybuilding|performance/i.test(h)) err(p.url, `growth hormone positioned for anti-aging or performance in a heading: "${h}"`);
    if (/compounded (semaglutide|tirzepatide)/i.test(h)) err(p.url, `compounded GLP-1 targeted in a heading: "${h}"`);
  }
  if (/no visit needed|prescribed online|guaranteed? results|reclaim your youth/i.test(t)) err(p.url, 'banned phrase in copy');
  if (/\b(fbq\(|facebook\.com\/tr|googletagmanager|hotjar|clarity\.ms|fullstory)/i.test(p.html)) err(p.url, 'ad pixel, tag manager or session replay script found');
  for (const img of p.body.match(/<img\b[^>]*>/g) || []) if (!/\salt="/.test(img)) err(p.url, 'image without alt text');
}

// ------------------------------------------------------- redirects, live
const redirects = JSON.parse(await readFile(path.join(root, 'src/data/redirects.json'), 'utf8'));
const server = await createStaticServer(dist);
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const redirectResults = [];
for (const r of redirects.redirects) {
  const res = await fetch(base + r.from, { redirect: 'manual' });
  const loc = res.headers.get('location');
  const expect = r.status ?? 301;
  let final = 0;
  if (loc) final = (await fetch(base + loc, { redirect: 'manual' })).status;
  const ok = res.status === expect && loc === r.to && final === 200;
  redirectResults.push({ ...r, got: res.status, loc, final, ok });
  if (!ok) err(r.from, `redirect expected ${expect} to ${r.to} then 200, got ${res.status} to ${loc} then ${final}`);
}
const goneResults = [];
for (const g of redirects.gone) {
  for (const probe of ['login', 'reset', 'create', 'account']) {
    const from = g.from.replace('*', probe);
    const res = await fetch(base + from, { redirect: 'manual' });
    const ok = res.status === 404 && /noindex/.test(res.headers.get('x-robots-tag') || '');
    goneResults.push({ from, got: res.status, ok });
    if (!ok) err(from, `retired path should return 404 with a noindex header, got ${res.status}`);
  }
}
// trailing slash and .html variants collapse to the canonical URL in one hop
for (const probe of ['/men/', '/treatments/testosterone-therapy/', '/pricing.html']) {
  const res = await fetch(base + probe, { redirect: 'manual' });
  const loc = res.headers.get('location');
  if (res.status !== 301 || !byUrl.has(loc)) err(probe, `expected a single 301 to the canonical URL, got ${res.status} ${loc}`);
}
server.close();

// ------------------------------------------------------------ launch gate
const confirmTotal = pages.reduce((n, p) => n + p.confirms.length, 0);
const held = pages.filter((p) => p.onHold);
if (LAUNCH) {
  if (confirmTotal) err('launch', `${confirmTotal} [[CONFIRM]] markers remain across ${pages.filter((p) => p.confirms.length).length} pages`);
  for (const p of held) err('launch', `${p.url} is still on hold or in draft`);
}

// ------------------------------------------------------------------ report
const md = [];
const esc = (s) => String(s).replace(/\|/g, '\\|');
md.push('# Site audit', '');
md.push(`Generated by \`scripts/qa.mjs\` from \`${distName}/\`. Do not edit by hand, re-run \`npm run check\` instead.`, '');
md.push(`- Pages built: ${pages.length}`);
md.push(`- Indexable pages: ${indexable.length}`);
md.push(`- Pages held out of search (noindex): ${pages.filter((p) => p.noindex && p.url !== '/404').map((p) => p.url).join(', ') || 'none'}`);
md.push(`- JSON-LD nodes checked: ${jsonLdNodes}`);
md.push(`- [[CONFIRM]] markers remaining: ${confirmTotal}`);
md.push(`- Errors: ${errors.length}. Warnings: ${warnings.length}.`, '');

md.push('## Keyword map as built', '');
md.push('| Path | Primary search | Also covers | Title tag | Len | H1 | Words | Index |');
md.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const p of pages) {
  if (p.url === '/404') continue;
  const k = keywordMap[p.url] || { primary: 'none (held or utility page)', also: [] };
  md.push(`| ${p.url} | ${esc(k.primary)} | ${esc(k.also.join(', '))} | ${esc(p.title)} | ${p.title.length} | ${esc(p.h1s[0] || '')} | ${p.words} | ${p.noindex ? 'no' : 'yes'} |`);
}
md.push('', '## Meta descriptions', '', '| Path | Meta description | Len |', '| --- | --- | --- |');
for (const p of pages) if (p.url !== '/404') md.push(`| ${p.url} | ${esc(p.description)} | ${p.description.length} |`);

md.push('', '## Redirect table, tested', '');
md.push('Tested against a local static server that mirrors Netlify, Cloudflare Pages and Vercel clean-URL behaviour. Re-test on the live host after launch.', '');
md.push('| Old path | New path | Status | Lands on | Result | Why |', '| --- | --- | --- | --- | --- | --- |');
for (const r of redirectResults) md.push(`| ${r.from} | ${r.to} | ${r.got} | ${r.final} | ${r.ok ? 'pass' : 'FAIL'} | ${esc(r.why)} |`);
for (const g of goneResults) md.push(`| ${g.from} | none (retired) | ${g.got} | noindex header | ${g.ok ? 'pass' : 'FAIL'} | GoDaddy member page with no equivalent |`);

md.push('', '## City page copy overlap', '');
md.push('Share of four-word phrases in the smaller page that also appear in the other page. Limit is about a third.', '');
md.push('| Page A | Page B | Shared |', '| --- | --- | --- |');
for (const o of overlaps.sort((x, y) => y.ratio - x.ratio)) md.push(`| ${o.a} | ${o.b} | ${(o.ratio * 100).toFixed(1)}% |`);

md.push('', '## [[CONFIRM]] markers by page', '');
const allAsks = new Map();
for (const p of pages) {
  if (!p.confirms.length) continue;
  const uniq = [...new Set(p.confirms)];
  md.push(`### ${p.url}`, '');
  for (const c of uniq) {
    md.push(`- ${c}`);
    if (!allAsks.has(c)) allAsks.set(c, new Set());
    allAsks.get(c).add(p.url);
  }
  md.push('');
}
md.push('## Every distinct fact to confirm', '');
md.push(`${allAsks.size} distinct facts. Answer each once in \`src/config/clinic.ts\` or in the page copy and it clears everywhere it appears.`, '');
md.push('| Fact needed | Pages |', '| --- | --- |');
for (const [ask, set] of [...allAsks].sort((a, b) => b[1].size - a[1].size)) md.push(`| ${esc(ask)} | ${set.size} |`);

if (warnings.length) md.push('', '## Warnings', '', ...warnings.map((w) => `- ${w}`));
if (errors.length) md.push('', '## Errors', '', ...errors.map((e) => `- ${e}`));
md.push('');

if (distName === 'dist') {
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await writeFile(path.join(root, 'docs/site-audit.md'), md.join('\n'));
}

console.log(`\nQA on ${distName}/: ${pages.length} pages, ${indexable.length} indexable, ${jsonLdNodes} JSON-LD nodes, ${confirmTotal} CONFIRM markers (${allAsks.size} distinct)`);
console.log(`Redirects: ${redirectResults.filter((r) => r.ok).length}/${redirectResults.length} pass. Max city overlap: ${(Math.max(0, ...overlaps.map((o) => o.ratio)) * 100).toFixed(1)}%`);
if (warnings.length) console.log(`\n${warnings.length} warnings:\n  ` + warnings.join('\n  '));
if (errors.length) {
  console.log(`\n${errors.length} errors:\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log('\nAll checks passed.' + (distName === 'dist' ? ' Report written to docs/site-audit.md' : ''));
