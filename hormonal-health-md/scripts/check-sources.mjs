// Loads every external source cited on the site with webclaw and records what came back,
// so a dead or moved citation is caught before a patient or a reviewer finds it.
//
//   npm run check:sources                 every cited URL except DOIs
//   npm run check:sources -- --doi        include doi.org links (publishers often refuse bots)
//   npm run check:sources -- --only nih   only URLs containing "nih"
//
// Needs the webclaw CLI (https://github.com/0xMassi/webclaw):
//   cargo install --git https://github.com/0xMassi/webclaw.git --locked webclaw-cli
// Set WEBCLAW_BIN if it is not on PATH, and WEBCLAW_PROXY if you fetch through a proxy.
//
// One plain request per URL. A page that refuses automated access is reported as
// "refused" and left for a person to open in a browser. Nothing is retried or disguised.
import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const withDoi = args.includes('--doi');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const BIN = process.env.WEBCLAW_BIN || 'webclaw';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(md|astro|ts)$/.test(e.name)) out.push(full);
  }
  return out;
}

// url -> the files that cite it
const cited = new Map();
for (const file of await walk(path.join(root, 'src'))) {
  const text = await readFile(file, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) {
    const url = m[0].replace(/[.,;]+$/, '');
    if (/hormonalhealthmd\.com|google\.com\/maps|schema\.org|w3\.org|g\.page/.test(url)) continue;
    if (!withDoi && /doi\.org\//.test(url)) continue;
    if (only && !url.includes(only)) continue;
    if (!cited.has(url)) cited.set(url, new Set());
    cited.get(url).add(path.relative(root, file));
  }
}

const fetchOne = (url) =>
  new Promise((resolve) => {
    execFile(BIN, [url, '--format', 'json', '--timeout', '40'], { timeout: 90000, maxBuffer: 64e6 }, (err, stdout, stderr) => {
      if (err) {
        const msg = String(stderr || err.message).trim().split('\n').pop().slice(0, 200);
        const status = /HTTP 40[135]|HTTP 429/.test(msg) ? 'refused' : /HTTP 404|HTTP 410/.test(msg) ? 'missing' : 'error';
        return resolve({ url, status, detail: msg });
      }
      try {
        const meta = JSON.parse(stdout).metadata || {};
        resolve({ url, status: 'ok', title: meta.title || '', words: Number(meta.word_count) || 0 });
      } catch {
        resolve({ url, status: 'error', detail: 'unreadable output' });
      }
    });
  });

const urls = [...cited.keys()].sort();
if (!urls.length) {
  console.log('No matching source URLs found.');
  process.exit(0);
}
const results = [];
for (let i = 0; i < urls.length; i += 2) {
  const batch = await Promise.all(urls.slice(i, i + 2).map(fetchOne));
  for (const r of batch) {
    r.citedIn = [...cited.get(r.url)].sort();
    results.push(r);
    console.log(`${r.status.padEnd(8)} ${r.url}${r.title ? `  |  ${r.title}` : r.detail ? `  |  ${r.detail}` : ''}`);
  }
}

const count = (s) => results.filter((r) => r.status === s).length;
const outFile = path.join(root, 'docs/research/source-links-latest.json');
await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify({ checked: new Date().toISOString().slice(0, 10), results }, null, 2) + '\n');
console.log(
  `\n${results.length} checked: ${count('ok')} ok, ${count('missing')} missing, ${count('refused')} refused automated access, ${count('error')} errors.`,
);
console.log('Written to docs/research/source-links-latest.json');
// A missing page is a broken citation and fails the run. A refusal is not proof of anything.
process.exit(count('missing') ? 1 : 0);
