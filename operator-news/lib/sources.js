// Source registry for the News page.
// kind: how to fetch/parse. cat: default category hint (the LLM can override).
// Every source reports its own health (ok / empty / error + reason) to the UI.

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export const CATEGORIES = {
  models: { label: 'Models', color: '#8b5cf6' },
  agents: { label: 'Agent Tools', color: '#f59e0b' },
  webdev: { label: 'Web Dev', color: '#06b6d4' },
  seo: { label: 'SEO & AI Search', color: '#22c55e' },
  outreach: { label: 'Outreach & Business', color: '#ef4444' },
  industry: { label: 'Industry', color: '#64748b' },
};

const yt = (id, name) => ({
  id: `yt-${id}`,
  name,
  kind: 'rss',
  url: `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`,
  cat: 'models',
  video: true,
  group: 'Videos',
});

export const SOURCES = [
  // ---- Labs / models ----
  { id: 'anthropic', name: 'Anthropic News', kind: 'anthropic', url: 'https://www.anthropic.com/news', cat: 'models', group: 'Labs' },
  { id: 'openai', name: 'OpenAI', kind: 'rss', url: 'https://openai.com/news/rss.xml', cat: 'models', group: 'Labs' },
  { id: 'google-ai', name: 'Google AI Blog', kind: 'rss', url: 'https://blog.google/technology/ai/rss/', cat: 'models', group: 'Labs' },
  { id: 'deepmind', name: 'Google DeepMind', kind: 'rss', url: 'https://deepmind.google/blog/rss.xml', cat: 'models', group: 'Labs' },
  { id: 'hf-blog', name: 'Hugging Face Blog', kind: 'rss', url: 'https://huggingface.co/blog/feed.xml', cat: 'models', group: 'Labs' },
  { id: 'hf-trending', name: 'Hugging Face Trending', kind: 'hf-trending', url: 'https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=15&full=false', cat: 'models', group: 'Labs' },

  // ---- Agent tooling ----
  { id: 'claude-code', name: 'Claude Code Releases', kind: 'gh-releases', repo: 'anthropics/claude-code', cat: 'agents', group: 'Agent Tools' },
  { id: 'codex', name: 'Codex CLI Releases', kind: 'gh-releases', repo: 'openai/codex', cat: 'agents', group: 'Agent Tools' },
  { id: 'gh-mcp', name: 'GitHub: new MCP servers', kind: 'gh-search', q: () => `topic:mcp-server created:>${daysAgo(7)} stars:>25`, cat: 'agents', group: 'Agent Tools' },
  { id: 'gh-claude', name: 'GitHub: Claude Code skills & plugins', kind: 'gh-search', q: () => `topic:claude-code created:>${daysAgo(7)} stars:>25`, cat: 'agents', group: 'Agent Tools' },
  { id: 'simonw', name: 'Simon Willison', kind: 'rss', url: 'https://simonwillison.net/atom/entries/', cat: 'agents', group: 'Agent Tools' },
  { id: 'r-claudeai', name: 'r/ClaudeAI (top, 24h)', kind: 'reddit', sub: 'ClaudeAI', cat: 'agents', group: 'Community' },
  { id: 'r-localllama', name: 'r/LocalLLaMA (top, 24h)', kind: 'reddit', sub: 'LocalLLaMA', cat: 'models', group: 'Community' },
  { id: 'hn', name: 'Hacker News (AI + web dev)', kind: 'hn', cat: 'industry', group: 'Community' },

  // ---- Web dev / platform ----
  { id: 'vercel', name: 'Vercel Changelog', kind: 'rss', url: 'https://vercel.com/atom', cat: 'webdev', group: 'Web Dev' },
  { id: 'chrome-dev', name: 'Chrome for Developers', kind: 'rss', url: 'https://developer.chrome.com/static/blog/feed.xml', cat: 'webdev', group: 'Web Dev' },
  { id: 'webdev', name: 'web.dev', kind: 'rss', url: 'https://web.dev/static/blog/feed.xml', cat: 'webdev', group: 'Web Dev' },
  { id: 'smashing', name: 'Smashing Magazine', kind: 'rss', url: 'https://www.smashingmagazine.com/feed/', cat: 'webdev', group: 'Web Dev' },

  // ---- SEO / GEO / AI search ----
  { id: 'sel', name: 'Search Engine Land', kind: 'rss', url: 'https://searchengineland.com/feed', cat: 'seo', group: 'SEO & AI Search' },
  { id: 'ser', name: 'Search Engine Roundtable', kind: 'rss', url: 'https://www.seroundtable.com/index.xml', cat: 'seo', group: 'SEO & AI Search' },
  { id: 'sej', name: 'Search Engine Journal', kind: 'rss', url: 'https://www.searchenginejournal.com/feed/', cat: 'seo', group: 'SEO & AI Search' },
  { id: 'gsc-blog', name: 'Google Search Central', kind: 'rss', url: 'https://developers.google.com/static/search/blog/feed.xml', cat: 'seo', group: 'SEO & AI Search' },

  // ---- Outreach / local business ----
  { id: 'brightlocal', name: 'BrightLocal (local SEO)', kind: 'rss', url: 'https://www.brightlocal.com/feed/', cat: 'outreach', group: 'Outreach & Local' },
  { id: 'sterlingsky', name: 'Sterling Sky (GBP / local)', kind: 'rss', url: 'https://www.sterlingsky.ca/feed/', cat: 'outreach', group: 'Outreach & Local' },
  { id: 'r-agency', name: 'r/agency (top, 24h)', kind: 'reddit', sub: 'agency', cat: 'outreach', group: 'Outreach & Local' },
  { id: 'r-coldemail', name: 'r/coldemail (top, week)', kind: 'reddit', sub: 'coldemail', t: 'week', cat: 'outreach', group: 'Outreach & Local' },

  // ---- Videos (YouTube channel RSS, no API key needed) ----
  yt('UCrDwWp7EBBv4NwvScIpBDOA', 'Anthropic (YouTube)'),
  yt('UCXZCJLdBC09xxGZ6gcdrc6A', 'OpenAI (YouTube)'),
  yt('UCP7jMXSY2xbc3KCAE0MHQ-A', 'Google DeepMind (YouTube)'),
  yt('UCNJ1Ymd5yFuUPtn21xtRbbw', 'AI Explained'),
  yt('UCsBjURrPoezykLs9EqgamOA', 'Fireship'),
  yt('UCbRP3c757lWg9M-U7TyEkXA', 'Theo - t3.gg'),
  yt('UCMwVTLZIRRUyyVrkjDpn4pA', 'Cole Medin'),
  yt('UCawZsQWqfGSbCI5yjkdVkTA', 'Matthew Berman'),
];
