// News page client. Pure DOM, no framework.
const $ = (s) => document.querySelector(s);
const CATS = {
  top: 'Top',
  models: 'Models',
  agents: 'Agent Tools',
  webdev: 'Web Dev',
  seo: 'SEO & AI Search',
  outreach: 'Outreach & Business',
  videos: 'Videos',
  all: 'Everything',
};
const COMMUNITY = new Set(['hn', 'r-claudeai', 'r-localllama', 'r-agency', 'r-coldemail']);

const store = {
  get(k, d) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

const ui = {
  tab: store.get('news.tab', 'top'),
  range: store.get('news.range', 'week'),
  threshold: store.get('news.threshold', 40),
  q: '',
};
let state = null;
const seen = new Set(store.get('news.seen', []));
const firstVisit = seen.size === 0;

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
function ago(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ---------- filtering ----------
function base() {
  if (!state) return [];
  const maxAge = ui.range === 'day' ? 864e5 : 7 * 864e5;
  const q = ui.q.trim().toLowerCase();
  return state.items.filter(
    (it) =>
      Date.now() - it.ts < maxAge &&
      it.score >= ui.threshold &&
      (!q || `${it.headline} ${it.why} ${it.title} ${it.sources.map((s) => s.name).join(' ')}`.toLowerCase().includes(q)),
  );
}
const inTab = (tab, it) =>
  tab === 'all' ? true : tab === 'top' ? it.score >= 70 : tab === 'videos' ? it.type === 'video' : it.category === tab && it.type !== 'video';

// ---------- rendering ----------
function media(it) {
  const label = esc(it.sources[0]?.name || host(it.url));
  const initials = esc((it.sources[0]?.name || host(it.url)).replace(/[^A-Za-z0-9 ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase());
  const fav = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host(it.url))}&sz=64`;
  const fallback = `<div class="fallback" aria-hidden="true"><div class="logo"><img src="${fav}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${initials}'}))"></div></div>`;
  const img = it.image
    ? `<img src="${esc(it.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`
    : '';
  return `<div class="media" title="${label}">${fallback}${img}${it.type === 'video' ? '<span class="play"></span>' : ''}</div>`;
}

function card(it) {
  const isNew = !firstVisit && !seen.has(it.url);
  const lvl = it.score >= 80 ? 'hi' : it.score >= 60 ? 'mid' : '';
  const srcs = it.sources.map((s) => esc(s.name)).join(' · ');
  return `<a class="card" data-cat="${it.category}" href="${esc(it.url)}" target="_blank" rel="noopener">
    ${media(it)}
    <div class="body">
      <div class="top"><span class="chip">${esc(CATS[it.category] || 'Industry')}</span>
        <span>${isNew ? '<span class="new">NEW</span> ' : ''}<span class="badge ${lvl}" title="Relevance score">${it.score}</span></span></div>
      <h3 title="Original: ${esc(it.title)}">${esc(it.headline)}</h3>
      ${it.why ? `<p class="why">${esc(it.why)}</p>` : ''}
      ${it.headline !== it.title ? `<div class="orig" title="${esc(it.title)}">${esc(it.title)}</div>` : ''}
      <div class="meta"><span class="srcs" title="${srcs}">${srcs}</span><span>· ${ago(it.ts)}</span></div>
    </div></a>`;
}

function renderTabs(list) {
  $('#tabs').innerHTML = Object.entries(CATS)
    .map(([k, v]) => `<button type="button" data-tab="${k}" class="${ui.tab === k ? 'on' : ''}">${v}<span class="n">${list.filter((it) => inTab(k, it)).length}</span></button>`)
    .join('');
}

function render() {
  if (!state) return;
  const list = base();
  renderTabs(list);
  const items = list.filter((it) => inTab(ui.tab, it));

  // hero: top 1-3 of the last 24h in this view
  // (quiet day: nothing in 24h, so lead with the best of the range instead of an empty hero)
  let hero = items.filter((it) => Date.now() - it.ts < 864e5).slice(0, 3);
  if (!hero.length) hero = items.slice(0, Math.min(3, Math.max(0, items.length - 3)));
  const rest = items.filter((it) => !hero.includes(it));
  $('#hero').className = `hero n${hero.length}`;
  $('#hero').innerHTML = hero.map(card).join('');
  $('#grid').innerHTML = rest.map(card).join('');
  const empty = $('#empty');
  empty.hidden = items.length > 0;
  if (!items.length) {
    const errs = state.sources.filter((s) => s.status === 'error').length;
    empty.textContent =
      ui.tab === 'videos'
        ? 'No new videos from the tracked channels in this range.'
        : `Nothing here above relevance ${ui.threshold} for this range.${errs ? ` (${errs} sources are failing, see the list.)` : ''}`;
  }

  // worth a click: community threads (HN / Reddit) that cleared the bar, compact
  const worth = state.items
    .filter((it) => it.sources.some((s) => COMMUNITY.has(s.id)) && it.score >= Math.max(30, ui.threshold - 10) && Date.now() - it.ts < 3 * 864e5)
    .slice(0, 6);
  $('#worth').innerHTML = worth.length
    ? worth
        .map((it) => {
          const c = it.sources.find((s) => COMMUNITY.has(s.id));
          return `<li><a href="${esc(c.url)}" target="_blank" rel="noopener"><b>${esc(it.headline)}</b><span>${esc(c.name)} · ${ago(it.ts)}</span></a></li>`;
        })
        .join('')
    : '<li class="muted">No hot community threads right now.</li>';

  // mark as seen for next visit
  for (const it of items) seen.add(it.url);
  store.set('news.seen', [...seen].slice(-3000));
}

function renderMeta() {
  const s = state;
  const ok = s.sources.filter((x) => x.status === 'ok').length;
  $('#updated').textContent = `Updated ${ago(s.updatedAt)} · ${s.items.length} items from ${ok}/${s.sources.length} sources${s.llm ? '' : ' · LLM off (set ANTHROPIC_API_KEY for rewrites)'}`;
  $('#updated').title = new Date(s.updatedAt).toLocaleString();
  $('#src-summary').textContent = `${ok}/${s.sources.length} up`;
  let grp = '';
  $('#sources').innerHTML = s.sources
    .map((x) => {
      const head = x.group !== grp ? `<li class="grp">${esc((grp = x.group))}</li>` : '';
      const cls = x.status === 'error' ? 'err' : x.status === 'empty' ? 'empty-src' : '';
      const tip = x.status === 'error' ? `Down: ${x.error}` : x.status === 'empty' ? 'Returned nothing' : `${x.count} items fetched`;
      return `${head}<li class="${cls}" title="${esc(tip)}"><span class="dot"></span><span class="name">${esc(x.name)}</span><span class="cnt">${x.status === 'error' ? 'down' : x.count}</span></li>`;
    })
    .join('');

  const b = s.brief;
  const brief = $('#brief');
  if (b?.bullets?.length) {
    brief.hidden = false;
    $('#brief-meta').textContent = `· ${ago(b.at)}`;
    $('#brief-list').innerHTML = b.bullets.map((x) => `<li>${esc(x)}</li>`).join('');
  } else {
    const top = s.items.filter((it) => Date.now() - it.ts < 864e5 && it.score >= 60).slice(0, 4);
    brief.hidden = !top.length;
    $('#brief-meta').textContent = s.llm ? '· waiting for today’s brief' : '· top stories (LLM brief needs ANTHROPIC_API_KEY)';
    $('#brief-list').innerHTML = top.map((it) => `<li>${esc(it.headline)}${it.why ? `: <span class="muted">${esc(it.why)}</span>` : ''}</li>`).join('');
  }
  brief.open = store.get('news.briefOpen', true);
}

async function load(force = false) {
  const btn = $('#refresh');
  btn.disabled = true;
  try {
    const res = await fetch(force ? '/api/news/refresh' : '/api/news', { method: force ? 'POST' : 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state = await res.json();
    renderMeta();
    render();
  } catch (e) {
    $('#updated').textContent = `Couldn't load news: ${e.message}`;
  } finally {
    btn.disabled = false;
  }
}

// ---------- events ----------
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  ui.tab = b.dataset.tab;
  store.set('news.tab', ui.tab);
  render();
});
document.querySelectorAll('.seg button').forEach((b) => {
  b.classList.toggle('on', b.dataset.range === ui.range);
  b.addEventListener('click', () => {
    ui.range = b.dataset.range;
    store.set('news.range', ui.range);
    document.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b));
    render();
  });
});
const th = $('#threshold');
th.value = ui.threshold;
$('#threshold-val').textContent = ui.threshold;
th.addEventListener('input', () => {
  ui.threshold = +th.value;
  $('#threshold-val').textContent = th.value;
  store.set('news.threshold', ui.threshold);
  render();
});
let qt;
$('#q').addEventListener('input', (e) => {
  clearTimeout(qt);
  qt = setTimeout(() => {
    ui.q = e.target.value;
    render();
  }, 120);
});
$('#refresh').addEventListener('click', () => load(true));
$('#brief').addEventListener('toggle', (e) => store.set('news.briefOpen', e.target.open));

load();
// keep "Updated X ago" honest, and pick up background refreshes
setInterval(() => state && renderMeta(), 30_000);
setInterval(() => load(), 5 * 60_000);
