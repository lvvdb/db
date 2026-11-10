import { defineMiddleware } from 'astro:middleware';

// Any fact only the clinic can supply is written in copy as [[CONFIRM: what is needed]].
// This wraps each one in a highlighted <mark> so it is impossible to miss in review.
// Tokens inside tags, attributes, <script> and <style> are left untouched; the QA
// script fails the build if one ever lands in a title, meta tag or JSON-LD block.
const TOKEN = /\[\[CONFIRM:\s*([^\]]+?)\s*\]\]/g;
const SPLIT = /(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>)/g;

function markTokens(html: string): string {
  const bodyAt = html.search(/<body[\s>]/i);
  if (bodyAt === -1) return html;
  const head = html.slice(0, bodyAt);
  const body = html
    .slice(bodyAt)
    // Markdown tables get a scroll container so they never break a phone layout.
    .replace(/<table>/g, '<div class="table-scroll"><table>')
    .replace(/<\/table>/g, '</table></div>')
    .split(SPLIT)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(
            TOKEN,
            (_m, raw) => {
              // One line, straight apostrophes, so the same fact always reads the same.
              const ask = String(raw).replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'");
              return `<mark class="confirm" data-confirm="${ask.replace(/"/g, '&quot;')}">Confirm: ${ask}</mark>`;
            },
          ),
    )
    .join('');
  return head + body;
}

export const onRequest = defineMiddleware(async (_ctx, next) => {
  const res = await next();
  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/html')) return res;
  const html = await res.text();
  return new Response(markTokens(html), { status: res.status, headers: res.headers });
});
