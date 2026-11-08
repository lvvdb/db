// Fetchers + parsers for every source kind. No dependencies: a small,
// forgiving RSS/Atom parser is enough for these feeds.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const UA = 'Mozilla/5.0 (compatible; OperatorNews/1.0; +https://vercel.com)';
const FIXTURES = process.env.NEWS_FIXTURES; // optional dir of recorded responses (testing only)

export const urlKey = (u) => createHash('sha1').update(u).digest('hex').slice(0, 16);

export async function fetchText(url, { timeout = 15000, headers = {} } = {}) {
  if (FIXTURES) {
    try {
      return await readFile(path.join(FIXTURES, urlKey(url)), 'utf8');
    } catch {} // not recorded: fall through to a live fetch
  }
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: '*/*', ...headers },
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const fetchJSON = async (url, opts) => JSON.parse(await fetchText(url, opts));

// ---------- XML helpers ----------
const decode = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
const strip = (s = '') => decode(decode(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};
const attr = (block, name, a) => {
  const m = block.match(new RegExp(`<${name}\\s[^>]*${a}=["']([^"']+)["']`, 'i'));
  return m ? decode(m[1]) : '';
};

function parseFeed(xml) {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  return blocks.map((b) => {
    let link = isAtom
      ? attr(b, 'link[^>]*rel=["\']alternate["\']', 'href') || attr(b, 'link', 'href')
      : strip(tag(b, 'link')) || attr(b, 'link', 'href');
    if (!link) link = strip(tag(b, 'guid'));
    const content = tag(b, 'content:encoded') || tag(b, 'content') || tag(b, 'description') || tag(b, 'summary') || tag(b, 'media:description');
    const img =
      attr(b, 'media:thumbnail', 'url') ||
      attr(b, 'media:content[^>]*medium=["\']image["\']', 'url') ||
      attr(b, 'enclosure[^>]*type=["\']image', 'url') ||
      (decode(content).match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || '';
    return {
      title: strip(tag(b, 'title')),
      url: link.trim(),
      date: strip(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')),
      summary: strip(content).slice(0, 400),
      image: img,
      videoId: strip(tag(b, 'yt:videoId')),
    };
  });
}

// ---------- per-kind fetchers ----------
const kinds = {
  async rss(src) {
    return parseFeed(await fetchText(src.url)).map((it) => ({
      ...it,
      image: it.videoId ? `https://i.ytimg.com/vi/${it.videoId}/hqdefault.jpg` : it.image,
      type: it.videoId ? 'video' : 'article',
    }));
  },

  // anthropic.com/news has no RSS. Pull article links + titles + dates from the listing page.
  async anthropic(src) {
    // Rows look like: <a href="/news/slug">…<h3>Title</h3>…</a> … <p>summary</p> … <time>Oct 28, 2026</time>
    const html = await fetchText(src.url);
    const byHref = new Map();
    let last = null;
    const re = /href="(\/news\/[a-z0-9-]+)"[^>]*>(?:(?!<\/a>)[\s\S]){0,600}?<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>|<p[^>]*>([\s\S]{20,400}?)<\/p>|<time[^>]*>([^<]+)<\/time>/gi;
    let m;
    while ((m = re.exec(html))) {
      if (m[1]) {
        const href = m[1];
        last = byHref.get(href) || { title: strip(m[2]).slice(0, 200), url: 'https://www.anthropic.com' + href, date: '', summary: '', type: 'article' };
        byHref.set(href, last);
      } else if (m[3] && last && !last.summary) last.summary = strip(m[3]).slice(0, 400);
      else if (m[4] && last) last.date = m[4].trim(); // later (list) rows override the featured block
    }
    return [...byHref.values()].filter((it) => it.title.length >= 8);
  },

  async 'gh-releases'(src) {
    const rels = await fetchJSON(`https://api.github.com/repos/${src.repo}/releases?per_page=15`, {
      headers: { accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
    });
    return rels.map((r) => ({
      title: r.name || r.tag_name,
      url: r.html_url,
      date: r.published_at,
      summary: strip(r.body || '').slice(0, 600),
      prerelease: r.prerelease || /alpha|beta|rc\.?\d|nightly|canary/i.test(r.tag_name),
      repo: src.repo,
      type: 'release',
    }));
  },

  async 'gh-search'(src) {
    const q = encodeURIComponent(src.q());
    const data = await fetchJSON(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=12`, {
      headers: { accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
    });
    return (data.items || []).map((r) => ({
      title: `${r.full_name} · ${r.stargazers_count.toLocaleString('en-US')}★`,
      url: r.html_url,
      date: r.created_at,
      summary: [r.description, r.language, (r.topics || []).slice(0, 6).join(', ')].filter(Boolean).join(' | '),
      stars: r.stargazers_count,
      repo: r.full_name,
      type: 'repo',
    }));
  },

  async 'hf-trending'(src) {
    const models = await fetchJSON(src.url);
    return models.map((m) => ({
      title: `${m.id}${m.pipeline_tag ? ' · ' + m.pipeline_tag : ''}`,
      url: `https://huggingface.co/${m.id}`,
      date: m.createdAt || m.lastModified,
      summary: [m.pipeline_tag, m.library_name, `${(m.likes || 0).toLocaleString('en-US')} likes`, `${(m.downloads || 0).toLocaleString('en-US')} downloads`].filter(Boolean).join(' | '),
      type: 'model',
    }));
  },

  async reddit(src) {
    const data = await fetchJSON(`https://www.reddit.com/r/${src.sub}/top.json?t=${src.t || 'day'}&limit=15`);
    return (data.data?.children || [])
      .map((c) => c.data)
      .filter((p) => !p.stickied && p.score >= 25)
      .map((p) => {
        const external = p.url && !/reddit\.com|redd\.it/.test(p.url) ? p.url : null;
        const preview = decode(p.preview?.images?.[0]?.source?.url || '');
        return {
          title: p.title,
          url: external || `https://www.reddit.com${p.permalink}`,
          discussion: `https://www.reddit.com${p.permalink}`,
          date: new Date(p.created_utc * 1000).toISOString(),
          summary: `${p.score} upvotes, ${p.num_comments} comments. ${(p.selftext || '').slice(0, 300)}`,
          image: preview,
          type: 'post',
        };
      });
  },

  // HN: front-page-grade stories from the last 3 days, matched to AI / web dev terms.
  async hn() {
    const since = Math.floor(Date.now() / 1000) - 3 * 86400;
    const terms = ['AI', 'LLM', 'Claude', 'OpenAI', 'Gemini', 'Anthropic', 'agent', 'MCP', 'Vercel', 'CSS', 'JavaScript', 'SEO', 'browser'];
    const results = await Promise.allSettled(
      terms.map((t) =>
        fetchJSON(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(t)}&tags=story&numericFilters=created_at_i>${since},points>120&hitsPerPage=10`),
      ),
    );
    const byId = new Map();
    for (const r of results) if (r.status === 'fulfilled') for (const h of r.value.hits) byId.set(h.objectID, h);
    if (!byId.size && results.every((r) => r.status === 'rejected')) throw results[0].reason;
    return [...byId.values()].map((h) => ({
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
      date: h.created_at,
      summary: `${h.points} points, ${h.num_comments} comments on Hacker News`,
      type: 'post',
    }));
  },
};

export async function fetchSource(src) {
  const fn = kinds[src.kind];
  if (!fn) throw new Error(`unknown kind ${src.kind}`);
  let items;
  if (FIXTURES) {
    // testing only: pre-normalized items recorded for sources this machine can't reach
    try {
      items = JSON.parse(await readFile(path.join(FIXTURES, `${src.id}.json`), 'utf8'));
    } catch {}
  }
  items ||= await fn(src);
  return items
    .filter((it) => it.title && it.url && /^https?:/.test(it.url))
    .map((it) => {
      const d = new Date(it.date);
      return { ...it, date: isNaN(d) ? null : d.toISOString(), sourceId: src.id, source: src.name, type: src.video ? 'video' : it.type };
    });
}

// ---------- og:image lookup ----------
export async function findOgImage(url) {
  const html = await fetchText(url, { timeout: 8000, headers: { accept: 'text/html' } });
  const head = html.slice(0, 200000);
  const meta = (p) =>
    (head.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
      head.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${p}["']`, 'i')) ||
      [])[1];
  const img = meta('og:image') || meta('og:image:url') || meta('twitter:image') || meta('twitter:image:src');
  if (!img) return null;
  try {
    return new URL(decode(img), url).href;
  } catch {
    return null;
  }
}
