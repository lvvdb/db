// Refresh pipeline: fetch every source -> normalize -> drop stale/non-English/
// pre-release noise -> LLM enrich (cached) -> images -> merge duplicates -> rank.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { SOURCES } from './sources.js';
import { fetchSource, findOgImage } from './fetch.js';
import { enrichAll, makeBrief, llmEnabled, MODEL } from './enrich.js';

const DATA = path.resolve(process.env.NEWS_DATA || new URL('../data', import.meta.url).pathname);
const MAX_AGE_DAYS = 7;
const HALF_LIFE_H = 48;

const load = async (f, d) => {
  try {
    return JSON.parse(await readFile(path.join(DATA, f), 'utf8'));
  } catch {
    return d;
  }
};
const save = (f, v) => writeFile(path.join(DATA, f), JSON.stringify(v));

export const canonical = (u) => {
  try {
    const x = new URL(u);
    x.hash = '';
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|ref$|source$|fbclid|gclid)/.test(k)) x.searchParams.delete(k);
    x.hostname = x.hostname.replace(/^www\./, '');
    return x.href.replace(/\/$/, '');
  } catch {
    return u;
  }
};

async function pool(list, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < list.length) {
      const k = i++;
      out[k] = await fn(list[k]);
    }
  }));
  return out;
}

const words = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9. ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
const jaccard = (a, b) => {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / (a.size + b.size - n || 1);
};

const githubPreview = (url) => {
  const m = url.match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+)/);
  return m ? `https://opengraph.githubassets.com/1/${m[1]}` : null;
};
const youtubeThumb = (url) => {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
};

let running = null;
export function refresh() {
  if (!running) running = doRefresh().finally(() => (running = null));
  return running;
}

async function doRefresh() {
  await mkdir(DATA, { recursive: true });
  const t0 = Date.now();
  const enrichCache = await load('enrich-cache.json', {});
  const imageCache = await load('image-cache.json', {});
  const usageLog = await load('usage.json', {});
  const prev = await load('state.json', null);

  // 1. fetch all sources in parallel, recording health
  const health = [];
  const raw = [];
  await Promise.all(
    SOURCES.map(async (src) => {
      const h = { id: src.id, name: src.name, group: src.group, url: src.url || src.repo || '', status: 'ok', count: 0, error: null };
      try {
        const items = await fetchSource(src);
        h.count = items.length;
        if (!items.length) h.status = 'empty';
        for (const it of items) raw.push({ ...it, cat: src.cat });
      } catch (e) {
        h.status = 'error';
        h.error = e.cause?.code || e.message;
      }
      health.push(h);
    }),
  );

  // 2. normalize + freshness
  const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
  const byUrl = new Map();
  for (const it of raw) {
    const url = canonical(it.url);
    const ts = it.date ? Date.parse(it.date) : NaN;
    if (!isNaN(ts) && ts < cutoff) continue;
    if (isNaN(ts) && it.type !== 'repo') continue; // undated items can't be trusted as fresh
    const entry = { ...it, url, ts: isNaN(ts) ? Date.now() : Math.min(ts, Date.now()) };
    const ex = byUrl.get(url);
    if (ex) {
      ex.sources.push({ id: it.sourceId, name: it.source, url: it.discussion || it.url });
      if (!ex.image && it.image) ex.image = it.image;
      ex.ts = Math.min(ex.ts, entry.ts);
    } else byUrl.set(url, { ...entry, sources: [{ id: it.sourceId, name: it.source, url: it.discussion || it.url }] });
  }
  const items = [...byUrl.values()];

  // 3. enrich (only uncached URLs hit the LLM)
  const stats = await enrichAll(items, enrichCache);
  const day = new Date().toISOString().slice(0, 10);
  if (stats.input_tokens || stats.output_tokens) {
    const u = (usageLog[day] ||= { input_tokens: 0, output_tokens: 0, cache_read: 0, items: 0 });
    u.input_tokens += stats.input_tokens;
    u.output_tokens += stats.output_tokens;
    u.cache_read += stats.cache_read;
    u.items += stats.processed;
  }

  // 4. apply enrichment + filters
  let kept = [];
  for (const it of items) {
    const e = enrichCache[it.url];
    if (!e) continue;
    if (!e.english) continue;
    if (e.prerelease && !e.notable) continue;
    kept.push({ ...it, headline: e.headline, why: e.why, category: it.type === 'video' && e.category === 'industry' ? 'models' : e.category, score: e.score, enrichedBy: e.by });
  }

  // 5. merge duplicate stories (same story, different URLs) by headline similarity
  kept.sort((a, b) => b.score - a.score);
  const merged = [];
  for (const it of kept) {
    const w = words(it.headline);
    const dup = merged.find((m) => Math.abs(m.ts - it.ts) < 72 * 36e5 && jaccard(m._w, w) >= 0.5);
    if (dup) {
      for (const s of it.sources) if (!dup.sources.some((x) => x.id === s.id)) dup.sources.push(s);
      dup.related = [...(dup.related || []), it.url];
      if (!dup.image && it.image) dup.image = it.image;
      dup.ts = Math.min(dup.ts, it.ts);
    } else merged.push({ ...it, _w: w });
  }

  // 6. images: feed image > og:image/twitter:image > YouTube > GitHub preview > (client fallback)
  const needOg = merged.filter((it) => !it.image && !youtubeThumb(it.url) && !githubPreview(it.url) && imageCache[it.url] === undefined && it.score >= 30);
  await pool(needOg, 8, async (it) => {
    try {
      imageCache[it.url] = (await findOgImage(it.url)) || null;
    } catch {
      imageCache[it.url] = null;
    }
  });
  for (const it of merged) {
    it.image = it.image || imageCache[it.url] || youtubeThumb(it.url) || githubPreview(it.url) || null;
    delete it._w;
  }

  // 7. rank = relevance x recency
  for (const it of merged) {
    const ageH = (Date.now() - it.ts) / 36e5;
    it.rank = Math.round(it.score * Math.pow(0.5, ageH / HALF_LIFE_H) * 10) / 10;
  }
  merged.sort((a, b) => b.rank - a.rank);

  // 8. daily brief (one LLM call per new set of top stories, max once an hour)
  const today = merged.filter((it) => Date.now() - it.ts < 24 * 36e5 && it.score >= 55).slice(0, 10);
  let brief = prev?.brief?.day === day ? prev.brief : null;
  const sig = today.map((t) => t.url).slice(0, 6).join('|');
  if (llmEnabled() && today.length && (!brief || (brief.sig !== sig && Date.now() - brief.at > 36e5))) {
    try {
      const bullets = await makeBrief(today);
      if (bullets) brief = { day, sig, at: Date.now(), bullets, by: MODEL };
    } catch (e) {
      console.warn('[news] brief failed:', e.message);
    }
  }

  const state = {
    updatedAt: Date.now(),
    tookMs: Date.now() - t0,
    llm: llmEnabled() ? MODEL : null,
    brief,
    items: merged.map(({ summary, ...it }) => ({ ...it, summary: (summary || '').slice(0, 200) })),
    sources: health.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)),
    usage: usageLog[day] || null,
  };

  // keep caches bounded: forget URLs not seen in a feed for 30 days
  const live = new Set(items.map((i) => i.url));
  for (const [u, e] of Object.entries(enrichCache)) {
    if (live.has(u)) e.seen = Date.now();
    else if (Date.now() - (e.seen || e.at || 0) > 30 * 864e5) delete enrichCache[u];
  }
  for (const u of Object.keys(imageCache)) if (!live.has(u) && !enrichCache[u]) delete imageCache[u];
  await Promise.all([save('state.json', state), save('enrich-cache.json', enrichCache), save('image-cache.json', imageCache), save('usage.json', usageLog)]);
  console.log(`[news] refreshed: ${merged.length} items from ${health.filter((h) => h.status === 'ok').length}/${health.length} sources in ${state.tookMs}ms; LLM ${stats.processed} new items`);
  return state;
}

export const readState = () => load('state.json', null);
