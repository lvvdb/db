import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const faq = z.object({ q: z.string(), a: z.string() });
const source = z.object({ label: z.string(), url: z.string().url() });

// Shared by every content page. `title` is the title tag, `eyebrow` + `headline`
// together form the single H1 (service and city first, outcome second).
const base = {
  title: z.string(),
  description: z.string(),
  eyebrow: z.string(),
  headline: z.string(),
  lede: z.string(),
  updated: z.string(), // ISO date the copy last changed
  // live  = built, indexable, in the sitemap
  // hold  = built and linked, but noindex and out of the sitemap until a fact is confirmed
  // draft = only built when SHOW_DRAFTS=1 (always noindex)
  status: z.enum(['live', 'hold', 'draft']).default('live'),
  holdReason: z.string().optional(),
  // A confirmed price or differentiator for the title tag, e.g. "From $99". Leave unset until real.
  titleSlot: z.string().max(16).optional(),
  faqs: z.array(faq).default([]),
  sources: z.array(source).default([]),
};

const glance = z.array(z.object({ label: z.string(), value: z.string() })).default([]);

const treatments = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/treatments' }),
  schema: z.object({
    ...base,
    order: z.number(),
    navLabel: z.string(),
    cardBlurb: z.string(),
    icon: z.string(),
    serviceName: z.string(),
    glance,
    routes: z.array(z.enum(['clinic', 'telehealth', 'mobile'])).default(['clinic']),
    conditions: z.array(z.string()).default([]),
    audience: z.array(z.enum(['men', 'women'])).default(['men', 'women']),
  }),
});

const conditions = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/conditions' }),
  schema: z.object({
    ...base,
    order: z.number(),
    navLabel: z.string(),
    cardBlurb: z.string(),
    icon: z.string(),
    treatment: z.string(),
    alsoSee: z.array(z.string()).default([]),
    checklist: z.array(z.string()).default([]),
  }),
});

const areas = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/areas' }),
  schema: z.object({
    ...base,
    order: z.number(),
    city: z.string(),
    county: z.string(),
    mapKey: z.string(),
    neighborhoods: z.array(z.string()).default([]),
    topTreatments: z.array(z.string()).default([]),
  }),
});

const mobileIv = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/mobile-iv' }),
  schema: z.object({
    ...base,
    order: z.number(),
    city: z.string(),
    mapKey: z.string(),
    neighborhoods: z.array(z.string()).default([]),
  }),
});

const learn = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/learn' }),
  schema: z.object({
    ...base,
    question: z.string(),
    treatment: z.string(), // path of the one treatment page this article hands off to
    treatmentLabel: z.string(),
    readMinutes: z.number(),
  }),
});

export const collections = { treatments, conditions, areas, mobileIv, learn };
