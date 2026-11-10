# Hormonal Health MD website

A static, search-first website for Hormonal Health MD, 501 Golden Isles Dr, Suite 204-C, Hallandale Beach, FL 33009.

Built with [Astro](https://astro.build). Every page is plain HTML at build time, there is no client framework, and the only script on the site is the symptom assessment. Fonts are self-hosted. There is no tracking of any kind until the clinic turns it on.

Start with [`docs/seo-report.md`](docs/seo-report.md). It explains what was built, what is still open and what to do next.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies. Needs Node 22.23.4 or newer. |
| `npm run dev` | Local development server. Drafts are visible here. |
| `npm run build` | Build the public site into `dist/`. |
| `npm run check` | Build, then run every quality check and rewrite `docs/site-audit.md`. |
| `npm run check:launch` | The launch gate. Fails while any `[[CONFIRM]]` marker or held page remains. |
| `npm run preview` | Serve `dist/` at http://localhost:4321 with redirects and clean URLs. |
| `npm run build:drafts` | Build into `dist-drafts/` including unpublished articles and the Spanish draft. |
| `npm run preview:drafts` | Serve `dist-drafts/` at http://localhost:4322. |
| `npm run check:sources` | Load every cited source with [webclaw](https://github.com/0xMassi/webclaw) and report any that are missing. |

## How unconfirmed facts work

Nothing on this site is guessed. Any fact only the clinic can supply is written in the copy as `[[CONFIRM: what is needed]]` and shows on the page as a yellow marker.

Three rules are enforced by the build:

1. A marker can never appear in a title, a meta tag, an attribute or structured data. `npm run check` fails if one does.
2. Structured data only contains confirmed facts. Hours, reviewer and languages are left out of the markup until they are set.
3. `npm run check:launch` fails while a single marker remains.

To clear a marker, either fill the matching field in `src/config/clinic.ts` or replace the marker in the page copy. `docs/site-audit.md` lists every marker by page and how many pages each fact clears.

## Where things live

```
src/
  config/clinic.ts        Every fact about the clinic. Name, address and phone print from here.
  data/keyword-map.json   One primary search per page. The build fails on a duplicate.
  data/redirects.json     Old paths to new paths. Generates _redirects, _headers and vercel.json.
  content/
    treatments/           Eight treatment pages (Markdown)
    conditions/           Five symptom pages
    areas/                Three city pages
    mobile-iv/            Four mobile IV city pages
    learn/                Twelve article drafts
  pages/                  Home, men, women, pricing, team, labs, telehealth, about, contact, assessment
  layouts/                Base (head, schema, header, footer), ContentPage, Audience, Simple
  components/             Header, footer, local block, trust block, FAQ, artwork
  lib/schema.ts           JSON-LD builders
  middleware.ts           Wraps [[CONFIRM]] markers and makes tables scroll on phones
scripts/
  qa.mjs                  The quality gate
  serve.mjs               Static server that mirrors clean-URL hosting, used for previews and redirect tests
  gen-redirects.mjs       Writes host redirect files from redirects.json
  sitemap-integration.mjs Builds sitemap.xml from the pages that were actually emitted
  make-brand-assets.mjs   Renders the share image, logo and touch icon
  check-sources.mjs       Loads every cited source with webclaw and flags dead links
docs/
  seo-report.md           The hand-back report
  local-seo-playbook.md   Off-site checklist for the clinic, with paste-ready text
  site-audit.md           Generated. Titles, descriptions, H1s, redirects, overlap, markers
  research/               Raw search re-run and live-site inventory from 9 November 2026
```

## Titles, descriptions and confirmed differentiators

Titles and descriptions are written per page and stay under 60 and 155 characters. Two things can add to them automatically, and only when the result still fits:

- **Site-wide:** set `openSevenDays: true` in `src/config/clinic.ts` and "Open 7 Days" joins the title and description of every service and local page, plus the top bar and the homepage.
- **Per page:** add `titleSlot: "From $99"` to a page's frontmatter once that price is confirmed, and it takes the slot on that page.

Neither should be set until the fact is true.

## Page status

Each Markdown page has a `status` in its frontmatter.

| Status | Built in public site | Indexable | In sitemap |
| --- | --- | --- | --- |
| `live` | yes | yes | yes |
| `hold` | yes | no | no |
| `draft` | no | no | no |

`hold` is for a page that should exist and be linked, but is waiting on a fact before search engines see it. `draft` pages only exist in `npm run dev` and `npm run build:drafts`.

### Publishing an article

1. A licensed clinician reads the draft in `src/content/learn/` and corrects it.
2. Set `reviewer` in `src/config/clinic.ts` if it is not set yet.
3. Change `status: draft` to `status: live` and update the `updated` date.
4. Run `npm run check`. The /learn hub and the navigation link appear automatically with the first published article.

### Turning on Spanish

Add `'es'` to `languages` in `src/config/clinic.ts` and set `spanishReviewed: true` once a fluent clinician or professional translator has checked `src/pages/es/`. The page then builds publicly with `hreflang` links to and from the homepage.

## What the quality gate checks

`npm run check` fails the build if any of these is not true:

- One H1 per page, and no two pages share a title, a meta description or an H1
- Titles are 65 characters or fewer and descriptions 160 or fewer, with a warning above 60 and 155
- Every canonical is self-referencing, on one host, with no trailing slash
- Every indexable page has exactly one primary search, and no two pages share one
- All JSON-LD parses, each node has the properties its type needs, and internal references resolve
- No broken internal link and no orphan page
- `sitemap.xml` lists every indexable page and nothing else
- No two city pages share more than about a third of their copy
- The first paragraph under each question heading is a real answer, with a warning below 22 words
- Every redirect lands on a live page in one hop
- No brand-name weight loss drug in a title or heading, no growth hormone positioned for anti-aging or performance in a heading, no banned phrases, no dashes used as punctuation, no ad pixel or session replay script

## Checking the cited sources

Every clinical claim links to a primary source, and sources move. `npm run check:sources` loads each cited URL once with the webclaw CLI and writes the result to `docs/research/source-links-latest.json`. It fails if a page is missing. A page that refuses automated requests is listed as "refused" for a person to open in a browser, and is never retried in disguise.

Install webclaw first:

```bash
cargo install --git https://github.com/0xMassi/webclaw.git --locked webclaw-cli
```

DOI links are skipped by default because publishers usually refuse bots. Add `-- --doi` to include them, or `-- --only fda.gov` to check one site.

Inside a cloud sandbox that sends all traffic through an inspecting proxy with no local DNS, stock webclaw cannot connect. `scripts/webclaw-proxy-sandbox.patch` is a two-part local patch against webclaw 0.7.2 that makes it trust the bundle named by `SSL_CERT_FILE` and leave name resolution to the proxy when `WEBCLAW_PROXY` is set. Apply it to a clone with `git apply`, build with `cargo build --release -p webclaw-cli`, and run with `WEBCLAW_PROXY="$HTTPS_PROXY"`. On a normal machine you do not need it.

## Deploying

The output in `dist/` is static and works on any host. Clean URLs with no trailing slash are the canonical form.

| Host | What to know |
| --- | --- |
| Netlify, Cloudflare Pages | `dist/_redirects` and `dist/_headers` are picked up automatically. |
| Vercel | `vercel.json` at the project root carries the same rules. Build command `npm run build`, output `dist`. |
| Anything else | Recreate the rules in `src/data/redirects.json` as 301s, serve `/page.html` at `/page`, redirect trailing slashes, and serve `404.html` with a 404 status. |

After the first deploy, test each old path on the live domain, submit the sitemap in Search Console and run a treatment page through Google's Rich Results Test.

## Analytics and call tracking

Both are off. Setting `analyticsEndpoint` in the config turns on a small script that sends an event name and the page path, and nothing else. Setting `callTrackingNumber` swaps the visible number by script while the real number stays in the HTML and the structured data, so listings stay consistent. Do not add an ad pixel, a tag manager or session replay without legal sign-off.
