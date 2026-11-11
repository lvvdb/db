#!/usr/bin/env node
// Exports the website to a folder of Obsidian notes: one note per page with its search
// metadata as properties, internal links as wikilinks, every [[CONFIRM]] marker as a
// highlight, plus the hand-back docs, the keyword map, the redirects and a checklist of
// every open fact with the pages it blocks.
//
//   npm run export:obsidian                         writes obsidian/Hormonal Health MD
//   npm run export:obsidian -- "/path/to/vault/Hormonal Health MD"
//
// Content comes from dist-drafts/ (every page, drafts included) and page status from
// dist/ (the public build); the npm script builds both first. The export only writes and
// overwrites files. It never deletes anything, so it is safe to point at a vault.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(root, 'obsidian', 'Hormonal Health MD'));
const PUB = join(root, 'dist');
const DRAFTS = join(root, 'dist-drafts');
const TODAY = new Date().toISOString().slice(0, 10);

for (const dir of [PUB, DRAFTS]) {
  if (!existsSync(join(dir, 'index.html'))) {
    console.error(`Missing ${relative(root, dir)}/. Run "npm run export:obsidian", which builds it first.`);
    process.exit(1);
  }
}

const keywordMap = JSON.parse(readFileSync(join(root, 'src/data/keyword-map.json'), 'utf8'));
const redirectData = JSON.parse(readFileSync(join(root, 'src/data/redirects.json'), 'utf8'));
const redirects = Object.fromEntries(redirectData.redirects.map((r) => [r.from, r.to]));

// ---------------------------------------------------------------- helpers

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const strip = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const pick = (html, re) => {
  const m = html.match(re);
  return m ? decode(m[1]).trim() : undefined;
};
const yaml = (v) => JSON.stringify(v ?? '');
const fileSafe = (s) => s.replace(/[\\/:*?"<>|#^[\]]/g, '').replace(/\s+/g, ' ').trim();
const BRAND = / \| Hormonal Health MD.*$/;
const cls = (node) => (node.getAttribute?.('class') ?? '').split(/\s+/);

// ---------------------------------------------------------------- pages

const SECTIONS = {
  treatments: { folder: 'Treatments', label: 'Treatments' },
  conditions: { folder: 'Symptoms', label: 'Symptoms' },
  areas: { folder: 'Areas', label: 'Areas we serve' },
  'mobile-iv': { folder: 'Mobile IV', label: 'Mobile IV' },
  learn: { folder: 'Answers', label: 'Answers (article drafts)' },
  es: { folder: 'Spanish', label: 'Spanish' },
};

const pages = new Map(); // path -> page

for (const file of walk(DRAFTS).filter((f) => f.endsWith('.html'))) {
  let path = '/' + relative(DRAFTS, file).replace(/\\/g, '/').replace(/\.html$/, '');
  if (path === '/404') continue;
  if (path === '/index') path = '/';

  const html = readFileSync(file, 'utf8');
  const pubFile = join(PUB, relative(DRAFTS, file));
  const pubHtml = existsSync(pubFile) ? readFileSync(pubFile, 'utf8') : null;
  const robots = pubHtml ? pick(pubHtml, /<meta name="robots" content="([^"]+)"/) : null;
  const status = !pubHtml ? 'draft' : /noindex/.test(robots) ? 'hold' : 'live';

  const title = pick(html, /<title>([^<]*)<\/title>/);
  const crumb = pick(html, /aria-current="page"[^>]*>([^<]*)</);
  const h1Html = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1] ?? '';
  const eyebrow = pick(h1Html, /class="eyebrow"[^>]*>([^<]*)</);
  const h1 = strip(h1Html.replace(/<!--[\s\S]*?-->/g, ''));
  const [first, slug] = path.slice(1).split('/');
  const section = SECTIONS[first] ? first : null;

  let name;
  if (path === '/') name = 'Home';
  else if (first === 'es') name = 'Inicio';
  else if (first === 'learn' && slug) name = title.replace(BRAND, '');
  else name = crumb ?? title.replace(BRAND, '');
  name = fileSafe(name.charAt(0).toUpperCase() + name.slice(1));

  const folder = section ? `Site/${SECTIONS[section].folder}` : 'Site';
  const facts = [...html.matchAll(/<mark class="confirm" data-confirm="([^"]*)"/g)].map((m) => decode(m[1]));

  pages.set(path, {
    path,
    file,
    html,
    status,
    title,
    description: pick(html, /<meta name="description" content="([^"]*)"/),
    canonical: pick(html, /<link rel="canonical" href="([^"]*)"/),
    updated: pick(html, /<meta property="og:updated_time" content="([^"]*)"/),
    notice: pick(html, /<div class="notice"[^>]*>([\s\S]*?)<\/div>/),
    eyebrow,
    h1,
    section,
    hub: Boolean(section && !slug && first !== 'es'),
    note: `${folder}/${name}`,
    name,
    facts,
  });
}

// Every basename must be unique so short wikilinks never point at the wrong note.
const seen = new Map();
for (const p of pages.values()) {
  if (seen.has(p.name)) throw new Error(`Two notes named "${p.name}": ${seen.get(p.name)} and ${p.path}`);
  seen.set(p.name, p.path);
}

const resolvePath = (href) => {
  let path = href.split(/[?#]/)[0];
  if (path.length > 1) path = path.replace(/\/+$/, '');
  if (pages.has(path)) return pages.get(path);
  if (redirects[path] && pages.has(redirects[path])) return pages.get(redirects[path]);
  return null;
};
const wikilink = (page, alias) => {
  const a = (alias ?? '').replace(/[[\]|]/g, '').replace(/\s+/g, ' ').trim();
  return a && a !== page.name ? `[[${page.note}|${a}]]` : `[[${page.note}|${page.name}]]`;
};

// ---------------------------------------------------------------- HTML to Markdown

const td = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
});

// Navigation, decoration and controls that mean nothing in a note.
td.remove((node) => {
  const n = node.nodeName.toLowerCase();
  if (['svg', 'script', 'style', 'nav', 'figure', 'input', 'button', 'select', 'textarea'].includes(n)) return true;
  if (node.getAttribute?.('aria-hidden') === 'true' || node.hasAttribute?.('hidden')) return true;
  return cls(node).some((c) => ['pbody__rail', 'btn-row', 'chip-row', 'btn', 'skip'].includes(c) || c.endsWith('__art'));
});

// The assessment's answer options, one per line instead of run together.
td.addRule('options', {
  filter: 'label',
  replacement: (_, node) => {
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    return text ? `\n- ${text}\n` : '';
  },
});

// A bold lead-in styled as its own line ("<strong>Bloodwork first</strong>Every plan...").
td.addRule('leadIn', {
  filter: (node) => {
    if (node.nodeName !== 'STRONG' || node.parentNode.firstChild !== node) return false;
    const next = node.nextSibling;
    return Boolean(next && (next.nodeType === 1 || /^[A-Za-z0-9]/.test(next.nodeValue ?? '')));
  },
  replacement: (content) => {
    const text = content.trim();
    return `**${/[.:?!]$/.test(text) ? text : `${text}.`}** `;
  },
});

// "- item" and "1. item" instead of turndown's wide default markers.
td.addRule('listItem', {
  filter: 'li',
  replacement: (content, node) => {
    const parent = node.parentNode;
    let prefix = '- ';
    if (parent.nodeName === 'OL') {
      const start = Number(parent.getAttribute('start') ?? 1);
      prefix = `${start + Array.prototype.indexOf.call(parent.children, node)}. `;
    }
    const pad = ' '.repeat(prefix.length);
    const text = content.replace(/^\n+/, '').replace(/\n+$/, '\n').replace(/\n/gm, `\n${pad}`).trimEnd();
    return `${prefix}${text}\n`;
  },
});

td.addRule('h1', {
  filter: 'h1',
  replacement: (_, node) => {
    const eb = node.querySelector('.eyebrow');
    const ebText = eb ? eb.textContent.replace(/\s+/g, ' ').trim() : '';
    if (eb) eb.parentNode.removeChild(eb);
    const head = node.textContent.replace(/\s+/g, ' ').trim();
    return `\n\n${ebText ? `*${ebText}*\n\n` : ''}# ${head}\n\n`;
  },
});

td.addRule('confirm', {
  filter: (node) => node.nodeName === 'MARK',
  replacement: (content, node) => {
    const fact = node.getAttribute('data-confirm');
    return fact ? `==CONFIRM: ${fact}==` : `==${content}==`;
  },
});

td.addRule('links', {
  filter: (node) => node.nodeName === 'A' && node.getAttribute('href'),
  replacement: (content, node) => {
    const href = node.getAttribute('href');
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (href.startsWith('#')) return content;

    // A card link (title, blurb, call to action) becomes one list line: link, then blurb.
    const kids = (el) =>
      Array.from(el.children).filter(
        (c) => !['svg', 'SVG'].includes(c.nodeName) && c.getAttribute('aria-hidden') !== 'true' && c.textContent.trim(),
      );
    let box = node;
    while (kids(box).length === 1 && kids(kids(box)[0]).length) box = kids(box)[0];
    const parts = kids(box).map((c) => c.textContent.replace(/\s+/g, ' ').trim());
    if (parts.length >= 2) {
      const [head, ...rest] = parts;
      const blurb = (rest.length >= 2 ? rest.slice(0, -1) : rest).join(' ');
      const page = href.startsWith('/') ? resolvePath(href) : null;
      const link = page ? wikilink(page, head) : href.startsWith('/') ? head : `[${head}](${href})`;
      return `\n- ${link}${blurb ? `: ${blurb}` : ''}\n`;
    }

    if (href.startsWith('/')) {
      const page = resolvePath(href);
      return page ? wikilink(page, text) : content;
    }
    return `[${content.trim()}](${href})`;
  },
});

td.addRule('faq', {
  filter: 'details',
  replacement: (_, node) => {
    const summary = node.querySelector('summary');
    const q = summary ? summary.textContent.replace(/\s+/g, ' ').trim() : 'Question';
    if (summary) summary.parentNode.removeChild(summary);
    const answer = td.turndown(node.innerHTML).trim();
    return `\n\n> [!faq]- ${q}\n${answer
      .split('\n')
      .map((l) => (l ? `> ${l}` : '>'))
      .join('\n')}\n\n`;
  },
});

td.addRule('definitions', {
  filter: 'dl',
  replacement: (_, node) => {
    const rows = Array.from(node.querySelectorAll('dt')).map((dt) => {
      let dd = dt.nextElementSibling;
      while (dd && dd.nodeName !== 'DD') dd = dd.nextElementSibling;
      const term = dt.textContent.replace(/\s+/g, ' ').trim();
      const value = dd ? td.turndown(dd.innerHTML).replace(/\s*\n+\s*/g, ' ').trim() : '';
      return `- **${term}:** ${value}`;
    });
    return `\n\n${rows.join('\n')}\n\n`;
  },
});

td.addRule('tables', {
  filter: 'table',
  replacement: (_, node) => {
    const rows = Array.from(node.querySelectorAll('tr')).map((tr) =>
      Array.from(tr.children).map((cell) =>
        td
          .turndown(cell.innerHTML)
          .replace(/\s*\n+\s*/g, ' ')
          .replace(/\|/g, '\\|')
          .trim(),
      ),
    );
    if (!rows.length) return '';
    const width = Math.max(...rows.map((r) => r.length));
    const line = (r) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`;
    return `\n\n${[line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n')}\n\n`;
  },
});

// ---------------------------------------------------------------- writing

const written = [];
function write(note, text) {
  const file = join(OUT, `${note}.md`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text.replace(/^[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
  written.push(note);
}

const STATUS_TEXT = {
  live: 'Live: in the public build and open to search engines.',
  hold: 'Held: in the public build but kept out of search.',
  draft: 'Draft: not in the public build. Needs clinician review before it goes live.',
};

for (const p of pages.values()) {
  const main = p.html.slice(p.html.indexOf('<main'), p.html.indexOf('</main>') + 7);
  const body = td.turndown(main.replace(/ data-astro-cid-[a-z0-9]+/g, ''));

  const crumbs = [...(p.html.match(/<nav class="crumbs"[\s\S]*?<\/nav>/) ?? [''])[0].matchAll(/<a href="([^"]+)"[^>]*>([^<]*)</g)]
    .map(([, href, text]) => resolvePath(href))
    .filter(Boolean)
    .map((c) => wikilink(c));
  const kw = keywordMap[p.path];
  const tags = ['hhmd/page', `hhmd/${p.status}`];
  if (p.section) tags.push(`hhmd/${p.section}`);

  const props = [
    '---',
    `path: ${yaml(p.path)}`,
    `url: ${yaml(p.canonical)}`,
    `status: ${p.status}`,
    `title_tag: ${yaml(p.title)}`,
    `meta_description: ${yaml(p.description)}`,
    `h1: ${yaml(p.h1)}`,
    `primary_search: ${yaml(kw?.primary ?? '')}`,
    `also_covers: [${(kw?.also ?? []).map(yaml).join(', ')}]`,
    `open_facts: ${p.facts.length}`,
    `updated: ${p.updated ?? ''}`,
    `exported: ${TODAY}`,
    `tags: [${tags.join(', ')}]`,
    '---',
  ];
  const banner = p.status === 'live' ? '' : `> [!warning] ${p.notice ?? STATUS_TEXT[p.status]}\n\n`;
  const trail = crumbs.length ? `${[...crumbs, p.name].join(' › ')}\n\n` : '';
  write(p.note, `${props.join('\n')}\n\n${banner}${trail}${body}\n`);
}

// ---------------------------------------------------------------- docs

const DOCS = [
  { src: 'docs/seo-report.md', note: 'Docs/SEO report', what: 'What was built, what is still open, and the 90-day plan.' },
  { src: 'docs/local-seo-playbook.md', note: 'Docs/Local SEO playbook', what: 'Off-site checklist with paste-ready text.' },
  { src: 'docs/site-audit.md', note: 'Docs/Site audit', what: 'Every title, description, H1, redirect test and marker. Generated by the build.' },
  { src: 'README.md', note: 'Docs/Developer README', what: 'Commands, structure and how to change the site.' },
];
const docByFile = Object.fromEntries(DOCS.map((d) => [d.src.split('/').pop(), d]));

// Markdown text outside code: page paths become wikilinks, and [[CONFIRM]] stops being a link.
function linkifyDoc(md) {
  let fenced = false;
  return md
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;
      const inTable = /^\s*\|/.test(line);
      const pipe = inTable ? '\\|' : '|';
      const link = (page, alias) => wikilink(page, alias).replace('|', pipe);

      line = line.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
        const file = href.split('#')[0].split('/').pop();
        if (href.startsWith('/')) {
          const page = resolvePath(href);
          return page ? link(page, text.replace(/`/g, '')) : m;
        }
        if (docByFile[file]) return `[[${docByFile[file].note}${pipe}${text.replace(/`/g, '')}]]`;
        if (!/^[a-z]+:/i.test(href)) return text; // repo files are not in the vault
        return m;
      });

      // Inline code that is exactly a page path, and table cells that are exactly a path.
      line = line.replace(/`(\/[a-z0-9\-/]*)`/g, (m, path) => {
        const page = pages.get(path === '/' ? '/' : path.replace(/\/$/, ''));
        return page ? link(page, path) : m;
      });
      if (inTable) {
        line = line.replace(/\|\s(\/[a-z0-9\-/]*)\s(?=\|)/g, (m, path) => {
          const page = pages.get(path);
          return page ? `| ${link(page, path)} ` : m;
        });
      }

      // Outside inline code, [[CONFIRM: x]] would create empty notes. Show it as a highlight.
      return line
        .split(/(`[^`]*`)/)
        .map((part, i) =>
          i % 2
            ? part
            : part.replace(/\[\[CONFIRM(?::\s*([^\]]*))?\]\]/g, (_, fact) => (fact ? `==CONFIRM: ${fact.trim()}==` : '`[[CONFIRM]]`')),
        )
        .join('');
    })
    .join('\n');
}

for (const d of DOCS) {
  const src = join(root, d.src);
  if (!existsSync(src)) continue;
  const props = ['---', `source: ${yaml(`hormonal-health-md/${d.src}`)}`, `exported: ${TODAY}`, 'tags: [hhmd/doc]', '---'];
  write(d.note, `${props.join('\n')}\n\n${linkifyDoc(readFileSync(src, 'utf8'))}`);
}

// ---------------------------------------------------------------- keyword map and redirects

const all = [...pages.values()];
const byPath = (a, b) => a.path.localeCompare(b.path);

write(
  'Docs/Keyword map',
  `---\nexported: ${TODAY}\ntags: [hhmd/doc]\n---\n\n# Keyword map\n\nOne primary search per page. The build fails if two pages share one. Source: \`src/data/keyword-map.json\`.\n\n| Page | Status | Primary search | Also covers |\n| --- | --- | --- | --- |\n${Object.entries(
    keywordMap,
  )
    .map(([path, k]) => {
      const p = pages.get(path);
      return `| ${p ? wikilink(p).replace('|', '\\|') : path} | ${p?.status ?? 'not built'} | ${k.primary} | ${(k.also ?? []).join(', ')} |`;
    })
    .join('\n')}\n`,
);

write(
  'Docs/Redirects',
  `---\nexported: ${TODAY}\ntags: [hhmd/doc]\n---\n\n# Redirects from the old site\n\nEvery old GoDaddy path and where it lands. Source: \`src/data/redirects.json\`, which generates the host redirect files.\n\n| Old path | Lands on | Code | Why |\n| --- | --- | --- | --- |\n${redirectData.redirects
    .map((r) => {
      const p = pages.get(r.to);
      return `| \`${r.from}\` | ${p ? wikilink(p).replace('|', '\\|') : r.to} | ${r.status ?? 301} | ${r.why.replace(/\|/g, '\\|')} |`;
    })
    .join('\n')}\n${
    redirectData.gone?.length
      ? `\nRetired with no replacement, served as 404 and kept out of search: ${redirectData.gone.map((g) => `\`${g.from ?? g.path ?? g}\``).join(', ')}.\n`
      : ''
  }`,
);

// ---------------------------------------------------------------- open facts

const factPages = new Map();
for (const p of all) for (const f of new Set(p.facts)) factPages.set(f, [...(factPages.get(f) ?? []), p]);
const facts = [...factPages.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
const markerCount = all.reduce((n, p) => n + p.facts.length, 0);

write(
  'Docs/Open facts',
  `---\nexported: ${TODAY}\nopen_facts: ${facts.length}\nmarkers: ${markerCount}\ntags: [hhmd/doc, hhmd/todo]\n---\n\n# Open facts\n\n${facts.length} facts only the clinic can supply, shown as ${markerCount} yellow markers across all ${all.length} pages, drafts included. Most-used first, so the top of the list clears the most pages. Ticking a box here does not change the website: the answer goes into \`src/config/clinic.ts\` or the page copy, then re-export.\n\n${facts
    .map(([f, ps]) =>
      ps.length === all.length
        ? `- [ ] **${f}** (every page)`
        : `- [ ] **${f}** (${ps.length} ${ps.length === 1 ? 'page' : 'pages'}): ${ps.sort(byPath).map((p) => wikilink(p)).join(', ')}`,
    )
    .join('\n')}\n`,
);

// ---------------------------------------------------------------- start note

const ld = (p) => {
  for (const m of p.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const nodes = JSON.parse(m[1])['@graph'] ?? [];
      const clinic = nodes.find((n) => [].concat(n['@type']).includes('MedicalClinic'));
      if (clinic) return clinic;
    } catch {}
  }
  return {};
};
const clinic = ld(pages.get('/'));
const a = clinic.address ?? {};
const nap = [a.streetAddress, a.addressLocality, [a.addressRegion, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
const phone = pick(pages.get('/').html, /data-phone[^>]*>([^<]+)</) ?? clinic.telephone;
const count = (s) => all.filter((p) => p.status === s).length;

const groups = [
  { label: 'Core pages', items: all.filter((p) => !p.section).sort(byPath) },
  ...Object.entries(SECTIONS).map(([key, s]) => ({
    label: s.label,
    items: all.filter((p) => p.section === key).sort((x, y) => Number(y.hub) - Number(x.hub) || byPath(x, y)),
  })),
].filter((g) => g.items.length);

const siteMap = groups
  .map(
    (g) =>
      `### ${g.label}\n\n| Page | Status | Primary search | Open facts |\n| --- | --- | --- | --- |\n${g.items
        .map((p) => `| ${wikilink(p).replace('|', '\\|')} | ${p.status} | ${keywordMap[p.path]?.primary ?? ''} | ${p.facts.length} |`)
        .join('\n')}`,
  )
  .join('\n\n');

write(
  'Hormonal Health MD',
  `---\nexported: ${TODAY}\ntags: [hhmd/home]\n---\n\n# Hormonal Health MD\n\nThe new website for ${clinic.name ?? 'Hormonal Health MD'}${nap ? `, ${nap}` : ''}${phone ? `, ${phone}` : ''}. Exported from the site build on ${TODAY}. The code repository is the source of truth: edits made in these notes do not change the website.\n\n## Start here\n\n| Note | What it is |\n| --- | --- |\n${DOCS.slice(0, 2)
    .map((d) => `| [[${d.note}\\|${d.note.split('/')[1]}]] | ${d.what} |`)
    .join('\n')}\n| [[Docs/Open facts\\|Open facts]] | ${facts.length} facts the clinic still has to confirm, as a checklist. |\n| [[Docs/Keyword map\\|Keyword map]] | The one search each page is built to win. |\n| [[Docs/Redirects\\|Redirects]] | Where every old URL lands. |\n${DOCS.slice(2)
    .map((d) => `| [[${d.note}\\|${d.note.split('/')[1]}]] | ${d.what} |`)
    .join('\n')}\n\n## At a glance\n\n| | |\n| --- | --- |\n| Pages | ${all.length} |\n| Live and open to search | ${count('live')} |\n| Held out of search | ${count('hold')} |\n| Drafts awaiting clinician review | ${count('draft')} |\n| Open facts | ${facts.length} distinct, ${markerCount} markers |\n\nEach page note carries its title tag, meta description, H1 and primary search as properties. Yellow highlights are facts the clinic still has to confirm. FAQs are folded callouts: click one to open it.\n\n## Site map\n\n${siteMap}\n`,
);

console.log(`${written.length} notes written to ${OUT}`);
console.log(`${count('live')} live, ${count('hold')} held, ${count('draft')} drafts, ${facts.length} open facts`);
