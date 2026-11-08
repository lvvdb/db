// LLM enrichment: plain-English headline, "why it matters to me", category,
// relevance 0-100, language + pre-release checks. Batched, and cached by URL
// so each item is processed exactly once. Falls back to keyword heuristics when
// ANTHROPIC_API_KEY is not set, so the page still works (just less sharp).
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import * as z from 'zod/v4';

export const MODEL = process.env.NEWS_MODEL || 'claude-haiku-5-5'; // cheapest current model; good at short rewrites
const BATCH = 20;

const client = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? new Anthropic() : null;
export const llmEnabled = () => !!client;

const PROFILE = `The reader is a freelance web developer. They hand-code HTML/CSS/JS sites for local service businesses (trades, salons, clinics, restaurants), deploy on Vercel, and win clients through cold outreach. They also build Claude Code skills, plugins and MCP servers. They want news that helps them stay ahead technically and land more clients. Everything else is noise.

Relevance priorities, highest first:
1. New AI models and big model updates (Claude, GPT, Gemini, open-weight): releases, pricing, benchmarks -> 80-100
2. Claude Code, Codex and agent tooling: releases, skills, plugins, MCP servers -> 75-95
3. AI tools for web design/dev, and for SEO/GEO and AI search visibility -> 65-90
4. Tools and tactics for cold outreach, lead gen, selling to local businesses -> 65-90
5. Vercel, frontend and web-platform changes that affect how they build sites -> 55-85
6. How AI changes what local service businesses need (booking, reviews, Google Business Profile, AI search) -> 60-85
7. Major industry news (funding, IPOs, policy) only when it is big -> 40-70; minor -> under 30
Unrelated research, generic tech news, crypto, hardware, politics -> under 25.
Pre-release builds (alpha, beta, rc, nightly) score under 30 unless the changes are notable for the reader.`;

const ItemOut = z.object({
  id: z.string(),
  headline: z.string().describe('Plain-English headline that says what this is. Name the product/project, what it does, key numbers. Max ~95 chars. No clickbait.'),
  why: z.string().describe('One sentence, max ~110 chars, on why it matters to THIS reader specifically. Concrete: name their tool, client type or outreach angle. Second person.'),
  category: z.enum(['models', 'agents', 'webdev', 'seo', 'outreach', 'industry']),
  score: z.number().int().describe('Relevance 0-100 per the priorities'),
  english: z.boolean().describe('false if the item (title or project) is primarily not in English'),
  prerelease: z.boolean().describe('true if this is an alpha/beta/rc/nightly build'),
  notable: z.boolean().describe('for pre-releases: true only if the changes are notable for the reader'),
});
const BatchOut = z.object({ items: z.array(ItemOut) });

const SYSTEM = `${PROFILE}

You rewrite raw feed items for this reader's news dashboard. For each item return:
- headline: what it actually is, readable at a glance. A repo slug like "lexmount/moli · 22,936★" becomes "Moli: a fast, lightweight headless browser for AI agents (Rust, 22.9k★)". A bare version like "0.169.0-alpha.3" from Codex becomes "Codex CLI 0.169 alpha: <what changed>". Keep real numbers (stars, prices, benchmark scores, version).
- why: why it matters to this reader, e.g. "Could replace Puppeteer in your site-audit outreach tool" or "New pitch for salons: Google now shows booking links in AI Mode". If it truly does not matter, say so briefly and score it low.
- category, score, english, prerelease, notable as defined.
Never invent facts that are not in the item. If details are thin, keep the headline factual and short. Return one entry per input id.`;

async function enrichBatch(batch) {
  const input = batch.map((it) => ({
    id: it.id,
    source: it.source,
    type: it.type,
    title: it.title,
    details: (it.summary || '').slice(0, 450),
  }));
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'low', format: zodOutputFormat(BatchOut) },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error(`enrich failed: ${res.stop_reason}`);
  return { items: res.parsed_output.items, usage: res.usage };
}

// ---------- heuristic fallback (no API key) ----------
const RULES = [
  { cat: 'models', score: 85, re: /\b(claude (opus|sonnet|haiku|fable)|gpt-?\d|gemini \d|llama ?\d|qwen|mistral|deepseek|new model|open[- ]weight|benchmark|frontier model|pricing)\b/i },
  { cat: 'agents', score: 80, re: /\b(claude code|codex|mcp|model context protocol|agent(s|ic)?|skills?|plugin|cursor|copilot|subagent)\b/i },
  { cat: 'seo', score: 75, re: /\b(seo|geo|ai overviews?|ai mode|search console|serp|ranking|core update|chatgpt search|perplexity|llms\.txt|ai search)\b/i },
  { cat: 'outreach', score: 75, re: /\b(google business profile|gbp|local seo|reviews?|cold (email|outreach)|lead gen|leads|outreach|agency|clients?|small business|local business|booking)\b/i },
  { cat: 'webdev', score: 65, re: /\b(vercel|next\.js|css|html|javascript|baseline|chrome \d+|web platform|frontend|v0|tailwind|astro|vite|performance|core web vitals)\b/i },
  { cat: 'industry', score: 45, re: /\b(raises?|funding|ipo|acquires?|acquisition|regulation|lawsuit|policy|valuation)\b/i },
];

function heuristic(it) {
  const text = `${it.title} ${it.summary || ''}`;
  let best = { cat: null, score: 20 };
  for (const r of RULES) if (r.re.test(text) && r.score > best.score) best = r;
  const cat = best.cat || it.cat || 'industry';
  let score = best.score;
  if (!best.cat && it.cat && it.cat !== 'industry') score = 42; // topical source, no keyword hit
  if (it.sourceId === 'claude-code' || it.sourceId === 'anthropic') score = Math.max(score, 85);
  const english = !/[぀-ヿ㐀-鿿가-힯Ѐ-ӿ]/.test(text);

  let headline = it.title;
  if (it.type === 'repo' && it.repo) {
    const name = it.repo.split('/')[1].replace(/[-_]/g, ' ');
    const desc = (it.summary || '').split(' | ')[0];
    const lang = (it.summary || '').split(' | ')[1];
    const k = it.stars >= 1000 ? `${(it.stars / 1000).toFixed(1)}k★` : `${it.stars}★`;
    headline = `${name[0].toUpperCase() + name.slice(1)}${desc ? ': ' + desc.replace(/\.$/, '') : ''} (${[lang, k].filter(Boolean).join(', ')})`;
  } else if (it.type === 'release' && it.repo) {
    const prod = it.sourceId === 'claude-code' ? 'Claude Code' : it.sourceId === 'codex' ? 'Codex CLI' : it.repo;
    const v = (it.title.match(/\d+\.\d+(\.\d+)?/) || [it.title])[0];
    const first = (it.summary || '').replace(/^#+\s*/, '').split(/(?<=[.!])\s|\s-\s|\s\*\s/)[0].slice(0, 70);
    headline = `${prod} ${v}${it.prerelease ? ' (pre-release)' : ''}${first ? ': ' + first : ''}`;
  } else if (it.type === 'model') {
    const [id, task] = it.title.split(' · ');
    headline = `${id.split('/')[1]} by ${id.split('/')[0]}${task ? ` (${task.replace(/-/g, ' ')})` : ''} is trending on Hugging Face`;
  }
  if (headline.length > 120) headline = headline.slice(0, 117).trimEnd() + '…';
  return {
    headline,
    why: '',
    category: cat,
    score: it.prerelease ? Math.min(score, 25) : score,
    english,
    prerelease: !!it.prerelease,
    notable: false,
    by: 'heuristic',
    at: Date.now(),
  };
}

/**
 * Enrich items that are not cached yet. cache: { [url]: enrichment }.
 * Returns stats for logging / cost tracking.
 */
export async function enrichAll(items, cache) {
  const todo = items.filter((it) => !cache[it.url] || (client && cache[it.url].by === 'heuristic'));
  const stats = { processed: 0, input_tokens: 0, output_tokens: 0, cache_read: 0, errors: 0 };
  if (!client) {
    for (const it of todo) if (!cache[it.url]) cache[it.url] = heuristic(it);
    return stats;
  }
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH).map((it, j) => ({ ...it, id: String(j) }));
    try {
      const { items: out, usage } = await enrichBatch(batch);
      stats.input_tokens += usage.input_tokens + (usage.cache_creation_input_tokens || 0);
      stats.cache_read += usage.cache_read_input_tokens || 0;
      stats.output_tokens += usage.output_tokens;
      for (const o of out) {
        const src = batch[+o.id];
        if (!src) continue;
        const { id, ...rest } = o;
        cache[src.url] = { ...rest, by: MODEL, at: Date.now() };
        stats.processed++;
      }
    } catch (e) {
      stats.errors++;
      console.warn('[news] enrich batch failed:', e.message);
      for (const it of batch) if (!cache[it.url]) cache[it.url] = heuristic(it); // retried next refresh
    }
  }
  return stats;
}

const BriefOut = z.object({
  bullets: z.array(z.string()).describe('3-5 bullets'),
});

/** Daily brief from today's top items. Cached by the caller per (date, top ids). */
export async function makeBrief(top) {
  if (!client || !top.length) return null;
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 3000,
    output_config: { effort: 'low', format: zodOutputFormat(BriefOut) },
    system: `${PROFILE}\n\nWrite today's brief for this reader: 3-5 short bullets (max ~160 chars each) on what changed today and what, if anything, they should act on (try it, update a site, pitch it to a client type). Only use facts from the items. No filler. Start each bullet with the key fact.`,
    messages: [{ role: 'user', content: JSON.stringify(top.map((t) => ({ headline: t.headline, why: t.why, source: t.sources.map((s) => s.name).join(', ') }))) }],
  });
  return res.parsed_output?.bullets || null;
}
