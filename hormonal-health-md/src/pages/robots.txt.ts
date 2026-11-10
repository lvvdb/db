import type { APIRoute } from 'astro';
import { clinic } from '../config/clinic';

// Crawlers that feed AI answers and AI search. Allowed while clinic.allowAiCrawlers is
// true, so the clinic can be cited in ChatGPT, Claude, Perplexity and Google AI results.
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
];

export const GET: APIRoute = () => {
  const lines = ['User-agent: *', 'Allow: /', ''];
  for (const bot of AI_BOTS) {
    lines.push(`User-agent: ${bot}`, clinic.allowAiCrawlers ? 'Allow: /' : 'Disallow: /', '');
  }
  lines.push(`Sitemap: ${clinic.site}/sitemap.xml`, '');
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
