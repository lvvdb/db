import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { sitemapFromBuild } from './scripts/sitemap-integration.mjs';

// One canonical host. Every canonical, sitemap entry and JSON-LD @id is built from this.
export const SITE = 'https://hormonalhealthmd.com';

export default defineConfig({
  site: SITE,
  // Clean URLs with no trailing slash: /treatments/testosterone-therapy
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
  markdown: {
    processor: satteri({ smartPunctuation: false }),
  },
  integrations: [sitemapFromBuild({ site: SITE })],
  devToolbar: { enabled: false },
});
