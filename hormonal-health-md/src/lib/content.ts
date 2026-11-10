import { getCollection, type CollectionEntry } from 'astro:content';

// Drafts are built only when SHOW_DRAFTS=1 (npm run build:drafts) or in `astro dev`.
export const SHOW_DRAFTS = process.env.SHOW_DRAFTS === '1' || import.meta.env.DEV;

// SITE_STAGING=1 makes a review build: every page is noindex, robots.txt blocks all
// crawlers and a banner says it is a preview. Used for the Vercel review deployment so
// placeholders and unreviewed copy can never be indexed or mistaken for the live site.
export const STAGING = process.env.SITE_STAGING === '1';

type Name = 'treatments' | 'conditions' | 'areas' | 'mobileIv' | 'learn';

export async function entries<N extends Name>(name: N): Promise<CollectionEntry<N>[]> {
  const all = await getCollection(name);
  const visible = all.filter((e) => e.data.status !== 'draft' || SHOW_DRAFTS);
  return visible.sort((a, b) => {
    const ao = (a.data as { order?: number }).order ?? 0;
    const bo = (b.data as { order?: number }).order ?? 0;
    return ao - bo || a.id.localeCompare(b.id);
  });
}

export const isIndexable = (status: string) => status === 'live';

export const paths = {
  treatments: (id: string) => `/treatments/${id}`,
  conditions: (id: string) => `/conditions/${id}`,
  areas: (id: string) => `/areas/${id}`,
  mobileIv: (id: string) => `/mobile-iv/${id}`,
  learn: (id: string) => `/learn/${id}`,
};

export function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Headings (h2) out of rendered markdown, for the on-page table of contents. */
export function h2s(headings: { depth: number; slug: string; text: string }[]) {
  return headings.filter((h) => h.depth === 2);
}
