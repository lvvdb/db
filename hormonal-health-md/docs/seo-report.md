# SEO build report: Hormonal Health MD

Built 9 to 10 November 2026. This is the hand-back for the patient acquisition and SEO prompt. Machine-generated tables (every title, description, H1, word count, redirect test and `[[CONFIRM]]` marker) live in [`site-audit.md`](./site-audit.md), which is rewritten every time `npm run check` runs. This file is the commentary.

---

## The short version

The site is built, statically rendered and passes every automated check. It is **not launch-ready**, and that is deliberate: 66 facts only the clinic can supply are still open, and each one is a visible yellow marker on the page instead of a guess.

| | |
| --- | --- |
| Pages in the public build | 34 (31 indexable, 3 held out of search) |
| Extra pages in the drafts build | 14 (12 articles, the answers hub, a Spanish draft) |
| Automated checks | All passing: unique titles, descriptions and H1s, one primary search per page, JSON-LD, links, sitemap, redirects, city-page overlap, compliance copy |
| Redirects | 14 of 14 land on a live page in one hop |
| Highest copy overlap between two city pages | 19.2% (limit was about a third) |
| Facts awaiting the clinic | 66 distinct, 226 markers across 34 pages |
| Mobile lab performance | LCP 1.2 to 1.6s, CLS 0 to 0.08, no JavaScript files, about 300KB per page |

Three things to know before reading further:

1. **There was no revamp site in this repository.** The brief describes itself as a companion to a website revamp prompt, but the repo held unrelated projects. I built the design layer as well as the search layer, so the pages exist to rank.
2. **"Open 7 Days" is switched off.** The clinic's own site contradicts itself on hours. Details under "Where I departed from the brief".
3. **The current site has a second address and phone number on it.** Nine service pages and the homepage markup point at Wilton Manors. That is likely a bigger cause of the clinic's invisibility than anything on-page.

---

## Where the clinic stands today

### Re-run of the eight searches

I re-ran all eight on 9 November 2026 with a search API, localized to the city in each query. The clinic appears in **none** of the eight top tens, which matches your snapshot.

| Search | #1 now | Your snapshot said | Changed? |
| --- | --- | --- | --- |
| TRT clinic Hallandale Beach | advancedtrtclinic.com, a location page | UCO Medical #1 | UCO is now #2. Vital MedSpa still page one at #10. |
| hormone replacement therapy Hallandale Beach | UCO Medical | not ranked individually | UCO holds #1 and #9. A Biote directory page is #2. |
| bioidentical hormones for women Aventura | Optimal Health Miami | Ideal Medical page one | Ideal Medical still page one, at #10. |
| medical weight loss semaglutide Hallandale Beach | UCO Medical | Florida Surgery and Weight Loss #1 | That site is now #2. Aesthetemed is #6. |
| mobile IV Hallandale Beach | The IV Doc | The IV Doc #1 | Same. TrufaMED #2, Elemental #5. |
| IV therapy Aventura | The IV Doc | The IV Doc #3, TrufaMED #4 | The IV Doc up to #1, TrufaMED up to #3. |
| men's health ED clinic Fort Lauderdale | Florida Men's Health | Florida Men's Health #1 | Same. |
| anti-aging peptides clinic Hallandale Beach | Body Rejuvenation MD | Aesthetemed page one | Aesthetemed still there at #5 with its lab testing page. UCO #6. |

What moved, and what it means:

- **Yelp was on page one in 5 of 8 searches**, down from your 6 of 8. It is still the directory that matters most after Google.
- **New names in the top three** that were not in your table: advancedtrtclinic.com, bodyrejuvenationmd.com, biote.com (a provider directory), peaceandheartwellness.com, aventuraobgyn.com, toxwell.com, wellnessivinfusiontherapy.com, atlanticmensclinic.com and rpbmedical.com.
- **A thin location page is #1 for the clinic's most valuable search.** advancedtrtclinic.com ranks with a short city page. That supports your read that the top slots are beatable by a clinic that is actually there.
- **One competitor ranks several narrow city and service pages** (for example "Walk In HRT Women, Aventura, FL"). That supports the page-per-city approach.
- **A provider directory outranks most clinics** for hormone therapy searches, which supports the citations work in the playbook.

Caveat: my query wording may not match yours exactly, so a position change can reflect wording as much as movement. Raw results are in [`research/serp-rerun-2026-11-09.json`](./research/serp-rerun-2026-11-09.json).

### What is on the live site right now

Full inventory of all 18 URLs is in [`research/live-site-inventory-2026-11-09.json`](./research/live-site-inventory-2026-11-09.json). The findings that matter:

| Finding | Detail |
| --- | --- |
| Two addresses | Hallandale Beach on the homepage and contact page. **2312 Wilton Drive, Suite 10, Wilton Manors** on nine service pages. |
| Two phone numbers | (305) 219.4351 in the header everywhere. **(800) 607-4010** plus a fax number on the nine service pages. To answer your question: both are live on the site today. |
| Markup points at the wrong city | The homepage structured data gives the Wilton Manors address, Wilton Manors coordinates and the 800 number as the business's details. |
| Four sets of hours | Homepage and service pages: 10am to 7pm, seven days. Contact page: noon to 7pm Monday to Friday, Saturday by appointment, Sunday closed. Hidden markup: a third variant. Birdeye listing: closed Monday and Sunday, noon to 7pm Tuesday to Saturday. |
| Nine pages share one H1 | "Hormonal health md". The contact page's H1 is "CEO / Owner". |
| Member pages are indexed | /m/login, /m/reset and /m/create are in the sitemap. |
| No clinician is named anywhere | Staff appear only as "best doctors", "experts" and "nutritionists". |
| No prices, reviews, social links or languages | None found on any page. |
| Care is described for men only | The bioidentical and estrogen pages are written about men. See the open question on women's care below. |
| A self-assessment already exists | A Google Form with 57 symptom questions that also collects name, date of birth and address. |
| Platform | GoDaddy Website Builder, with a Search Console verification tag on the homepage. |

Claims on the current site that the rebuild removes: "guaranteed results with no side effects", "guarantee results" for weight loss, growth hormone presented as a way to "get back to your youthful stance", a benefits list that includes "Increases Height", "Reduces Wrinkles" and "Lowers Blood Pressure", and an unlabelled before and after photo gallery.

---

## 1. Redirect table, tested

Each old path below returns a 301 to a page that returns 200, in a single hop. Tested against a local server that mirrors Netlify, Cloudflare Pages and Vercel behaviour. It must be re-tested on the real host after launch. The source of truth is `src/data/redirects.json`, which generates `public/_redirects`, `public/_headers` and `vercel.json`.

| Old path | New path | Result |
| --- | --- | --- |
| /our-services | /treatments | pass |
| /benefits-of-treatment | /treatments | pass |
| /contact-us | /contact | pass |
| /testosterone-therapies | /treatments/testosterone-therapy | pass |
| /estrogen-treatments | /treatments/testosterone-therapy | pass |
| /bioidentical-hormones | /treatments/hormone-therapy-for-women | pass |
| /erectile-dysfunction | /treatments/sexual-health | pass |
| /weight-loss-therapies | /treatments/medical-weight-loss | pass |
| /human-hormone-therapy | /treatments/growth-hormone-therapy | pass |
| /iv-therapy | /treatments/iv-therapy | pass |
| /vitamin-mineral-regiments | /treatments/nutrition-and-supplements | pass |
| /nutritional-planning | /treatments/nutrition-and-supplements | pass |
| /joint-pain-solutions | /treatments/joint-pain | pass |
| /review | /contact (302, placeholder) | pass |
| /m/login, /m/reset, /m/create, /m/account | none, retired | 404 with a noindex header |

Also tested: trailing-slash and `.html` variants collapse to the clean URL in one hop.

Two judgment calls to check against the Search Console export:

- **/estrogen-treatments goes to the TRT page, not the women's page.** Its title tag is "Aromatization Of Testosterone Into Estrogen" and its copy is about men, so any traffic it has is from men on testosterone. The TRT page now has a section answering that question.
- **/benefits-of-treatment goes to the treatment index.** Nothing on the new site matches a page of benefit claims, by design.

Outside the redirect file: `self.hormonalhealthmd.com` is a subdomain that forwards to the Google Form. It needs a DNS decision at launch.

---

## 2. Keyword map as built

The full table, with every title tag, length, H1 and word count, is in [`site-audit.md`](./site-audit.md). The source is `src/data/keyword-map.json`, and the build fails if two indexable pages share a primary search.

No search volumes or difficulty scores appear anywhere, because I had none. Treat every row as `[[CONFIRM: volume]]` until someone runs it through a keyword tool.

### Searches I changed, and why

| Page | Your primary | Built as | Why |
| --- | --- | --- | --- |
| /women | menopause specialist Hallandale Beach | menopause care Hallandale Beach | "Specialist" is a credential claim, and Florida restricts advertising a specialty without recognized certification. The page still answers the specialist search in an FAQ. Switch back once certification is confirmed. Worth a line to counsel. |
| /team | hormone doctor Hallandale Beach | hormone care team Hallandale Beach | No physician is named on the current site. The page is held out of search until names and licences are confirmed, then the title can say "doctor" if it is true. |
| /telehealth | online TRT Florida | telehealth hormone therapy Florida | Your own compliance rule bars "prescribed online" language until the policy is confirmed. "Online TRT Florida" is kept as a secondary and answered carefully in an FAQ. |
| /treatments/nutrition-and-supplements | vitamin injections Hallandale Beach | nutrition and vitamin therapy Hallandale Beach | The current site offers nutrition planning and vitamin regimens. It never mentions injections. Switch once injections are confirmed. |
| /treatments/joint-pain | to be set | none, page on hold | As your brief said, it has no target until the therapies are known. Built, linked, noindex. |
| /treatments/iv-therapy | IV therapy, also mobile IV therapy | IV therapy only | "Mobile IV" moved to /mobile-iv/hallandale-beach as that page's primary, so two pages do not chase it. |
| /men | also low testosterone symptoms | also low T clinic, men's hormone clinic | "Low testosterone symptoms" is now the primary for /conditions/low-testosterone. |
| / | also anti-aging clinic Hallandale Beach | kept, handled in an FAQ | The homepage answers "Is this an anti-aging clinic?" honestly instead of claiming the label. |

### Titles

Every title leads with the service and the city, none says "near me", and all are 60 characters or fewer. Where the brand did not fit, I dropped the brand and kept the service and city. City pages for places with no office say "near", because that is true.

### Pages I added beyond your two tables

`/contact`, `/assessment`, `/treatments`, `/conditions`, `/areas` and a 404. They were needed as redirect targets, as breadcrumb parents and as the destination for every call to action. Each has a navigational primary search that does not compete with a money page.

---

## 3. Local SEO playbook

[`local-seo-playbook.md`](./local-seo-playbook.md). Ready to hand over, with paste-ready text for the Google Business Profile description, ten service descriptions, four posts, the review request by text and email, the front desk card, three privacy-safe review replies and an outreach email. It opens with the eight inconsistencies found in the research and the exact name, address and phone to use everywhere.

---

## 4. The twelve article drafts

All twelve are in `src/content/learn/` with `status: draft`. They are excluded from the public build, so nothing unreviewed can go live by accident. Preview them with `npm run build:drafts && npm run preview:drafts`. To publish one, a clinician reviews it and the status line changes to `live`. The answers hub at /learn appears on its own when the first article is published.

| Article | Hands off to |
| --- | --- |
| How much does TRT cost in Florida? | Testosterone therapy |
| Testosterone injections, pellets or cream: which is right for you? | Testosterone therapy |
| What is a normal testosterone level for your age? | Testosterone therapy |
| How long does TRT take to work? | Testosterone therapy |
| Can you get TRT through telemedicine in Florida? | Testosterone therapy |
| Does insurance cover hormone therapy? | Hormone therapy for women |
| Which blood tests should you get before starting hormone therapy? | Hormone therapy for women |
| What should you test in perimenopause? | Hormone therapy for women |
| Is hormone therapy safe after menopause? | Hormone therapy for women |
| Bioidentical vs traditional hormones: what is the difference? | Hormone therapy for women |
| How do GLP-1 weight loss medications work, and who qualifies? | Medical weight loss |
| What happens during a mobile IV visit? | IV therapy |

Each answers its question in the first two sentences, cites primary sources, links to its treatment page and the assessment, and carries the medical review block. Page length runs about 900 to 1,050 words including the FAQ.

Where the questions came from: your starting list, the FAQ questions on the top-ranking competitor page for each of the eight searches, and clinical judgment. I could not pull "People also ask" boxes with the tools I had, and the front desk's ten most common questions are still needed.

Two are time-sensitive. The telemedicine article states the federal position as of November 2026, when the current extension runs to 31 December 2026. The menopause safety article describes the FDA's label change announced in November 2025. Both need a date check at review.

---

## 5. Every `[[CONFIRM]]`, grouped

The full list by page is in [`site-audit.md`](./site-audit.md) under "[[CONFIRM]] markers by page". There are 66 distinct facts. Answering a fact once clears it everywhere.

### The ten that unblock the most pages

| Fact | Pages it clears | Where to enter it |
| --- | --- | --- |
| Opening hours for each day | 34 | `hours` in `src/config/clinic.ts` |
| Clinician name and credentials | 23 | `reviewer` and `team` in `src/config/clinic.ts` |
| Date each clinical page was reviewed | 21 | Clears automatically once `reviewer` is set |
| Lab panels and prices | 14 | Copy in /lab-testing, then search and replace |
| Mobile service area and fee | 12 | Copy, plus `areaServed` in the config |
| Insurance and payment policy | 7 | Copy |
| IV drip menu and prices | 6 | Copy in the IV therapy page |
| Who screens patients before an infusion | 5 | Copy |
| Parking and building access | 4 | Copy |
| Whether the clinic treats women for menopause | 3 | See the open question below |

### The rest, by theme

| Theme | What is needed |
| --- | --- |
| Prices | Consultation, follow-up, TRT program, women's program, weight loss program, sexual health visit, nutrition, group IV, typical monthly cost, membership terms, HSA and FSA |
| Services actually offered | Testosterone forms, women's hormone forms, testosterone for women, weight loss medications and whether each is FDA-approved or compounded, ED treatments, nutrition services and any vitamin injections, joint pain therapies, growth hormone pathway |
| People | Owner or medical director, other prescribers and nurses, who gives nutrition advice and their licence, menopause training, photographs, biographies |
| Policies | Telehealth prescribing, statewide telehealth, follow-up schedule, seasonal and out-of-state patients, visitors |
| Logistics | Where blood is drawn and how fast results come back, booking link, secure contact form, telehealth platform, partner labs, same-day IV availability, mobile hours |
| Local detail | Drive times and distances from three points in each city, the western limit in Hollywood, office and venue visits, the services each city asks for most |
| Proof | Google rating and count, year opened, languages spoken |
| Legal | Peptide therapy review, analytics and tracking approval |

### Off-site facts, which are in the playbook and not on the pages

Whether a Google Business Profile exists and who controls it, the review link, consent to text patients, Search Console access, the call tracking vendor, the hosting platform, what the 800 number and the Wilton Manors address are, and where the assessment should send people.

### One open question that is bigger than a marker

**Does the clinic treat women?** Your keyword map includes /women, hormone therapy for women, menopause and perimenopause, so I built them. The live site describes hormone care for men only. If the clinic does not offer menopause care, four pages and five articles should be held back. I did not hold them, because your brief was explicit, but please confirm before launch.

---

## 6. The 90-day plan, in order of patient impact

| When | Step | The clinic does | We do | Why it matters |
| --- | --- | --- | --- | --- |
| Days 1 to 7 | Settle the facts | Confirm hours, both phone numbers, the Wilton Manors address, clinician names and licences, whether women's care is offered | Enter them in the config, rebuild, re-run the launch check | Nothing can go live with open markers, and a wrong address costs more patients than any missing page. |
| Days 1 to 7 | Own the map listing | Claim and verify the Google Business Profile, add a second owner | Supply the description, services and categories method (done, in the playbook) | The three map results take a large share of local clicks. |
| Days 1 to 7 | Protect what exists | Give Search Console access and export 16 months of pages and queries | Reconcile the redirect table against it | The domain has history. This keeps it. |
| Days 1 to 14 | Start reviews | Ask every patient after every visit, put the QR card on the desk | Wire /review to the Google form once the link arrives | The biggest gap and the slowest to close. Competitors show 110 to 508. |
| Days 7 to 14 | Legal sign-off | Counsel reviews tracking, telehealth wording, weight loss medication copy and peptides | Adjust copy to the answers | Unblocks analytics and the telehealth and weight loss pages. |
| Days 7 to 14 | Prices and menu | Supply prices, lab panels, the drip menu and the mobile fee | Fill the pricing, lab and IV pages | Half the ranking competitors show a price. Yours is currently a blank. |
| Day 14 | Launch | Approve the final preview | Deploy, switch DNS, test every redirect on the live host, submit the sitemap, hide the member pages | The wrong-address markup disappears the moment the new site is live. |
| Days 14 to 30 | Clean the listings | Claim Yelp, report the duplicate, fix every listing with the 800 number | Provide the tracker and re-run the searches | One consistent name, address and phone is what the map ranking trusts. |
| Days 14 to 30 | Photos and team | Shoot the photo list, supply portraits and biographies | Publish the team page and add `reviewedBy` markup | Named, licensed clinicians are the clearest trust signal on a medical site. |
| Days 30 to 60 | Publish the answers | A clinician reviews three articles a week | Flip each to live, add internal links, watch indexing | Catches people before they have chosen a clinic. |
| Days 30 to 60 | Make the city pages real | Supply drive times, parking, buildings served and top requests per city | Fill and expand the seven city pages | Outsiders rank in your own neighborhood on exactly this detail. |
| Days 60 to 90 | Languages | Confirm which languages staff speak, commission a human translation | Publish /es with hreflang, extend to treatment pages | Half the ranking competitors offer Spanish. |
| Days 60 to 90 | Local links and next cities | Join the chambers, approach three buildings and two gyms, confirm any further cities served | Build city pages only for confirmed cities | Slow, durable ranking gains. |
| Monthly | Report | Share booked consults and where each patient heard of the clinic | Report calls, assessments, consults by landing page, map calls and the rank grid | Patients acquired is the only number that counts. |

---

## 7. What I could not verify

Stated plainly, so nothing here is mistaken for a finding.

### Where I relied on your snapshot

- **Everything in your table about competitor pages**: word counts, prices, ratings and review counts, named clinicians, languages, last-modified dates, and the "5 of 10" style counts. I re-ran the rankings and read the headings and FAQ questions of the #1 result for each search. I did not re-audit the ten pages.
- **The 660-word homepage figure.** My inventory counted about 386 words of main content. The difference is probably what was counted, and it does not change the conclusion.

### What I did not have

- Map pack positions, search volumes, keyword difficulty and backlink data. None are in this build.
- "People also ask" boxes.
- Access to any clinic account: Google Business Profile, Search Console, analytics, the hosting platform.

### What I checked only partly

- **Source links.** All 62 external sources cited on the site have been checked in two passes, the second with webclaw after the first tool ran out of credits. 60 loaded and matched their citation. 2 refuse automated requests and were confirmed by search results only: the congress.gov page for the Ryan Haight Act and the NIAMS osteoarthritis page. Open those two in a browser before launch. Along the way three citations were corrected: one DOI I had truncated, and two FDA pages that now return "not found", replaced with FDA's testosterone information page and the NIH biotin fact sheet. The menopause safety article now cites the FDA's own 10 November 2025 announcement, which I loaded and read. Results are in [`research/webclaw-recheck-2026-11-10.json`](./research/webclaw-recheck-2026-11-10.json). Re-run any time with `npm run check:sources`.
- **Listings.** Checked only where the site permits it. Birdeye loaded: the profile is unclaimed, shows 5.0 from 9 reviews (none written on Birdeye itself), prints the address as "Ste 204 C" with no phone number, and lists a fourth set of hours. The trtmap listing seen in search results now returns "not found". Yelp and MapQuest disallow automated access in their robots.txt, so I did not fetch them. Those two need a person, and the playbook covers it in step 3.1.
- **Redirects.** Tested locally, not on the live host, because the host is not known.
- **JSON-LD.** Every block parses and has the properties its type needs, and every internal reference resolves. It has not been through Google's Rich Results Test, which needs a public URL.
- **Core Web Vitals.** The figures above are lab numbers from a throttled mobile emulation on this machine. Field data only exists after launch. INP was not measured, though the pages ship no JavaScript files, and the only inline script is on the assessment.
- **Map coordinates.** Taken from the map embedded on the current site, not from a verified profile pin.
- **Florida's rule on the word "specialist".** That is my reason for the /women change. It is a compliance question for counsel, not legal advice.

### What needs a clinician's eyes

- All clinical copy. It was written from the Endocrine Society, Menopause Society, AUA, ACR and FDA sources cited on each page, but no clinician has reviewed it. That is why every clinical page says "Medically reviewed by" followed by a marker, and why no `reviewedBy` markup is emitted yet.
- The IV drip ingredients, which I transcribed from the current site.
- The Spanish draft, which is my translation and must be checked by a fluent speaker before it is published.

---

## Where I departed from the brief

| The brief said | What I did | Why |
| --- | --- | --- |
| Put "open 7 days" in titles and meta descriptions | Built it as one switch in `src/config/clinic.ts`, set to off | The clinic's contact page says Sunday closed and one Yelp listing agrees. A title that turns out to be false costs trust and breaks consistency with Google. Flip `openSevenDays` to true and it appears in the utility bar and homepage at once. Add it to titles then. |
| Build in the same project as the revamp | Built a standalone project in `hormonal-health-md/` | No revamp existed in this repository. |
| Use the revamp's assessment flow | Built a two-minute symptom sorter that runs in the browser and stores nothing | CTAs needed a destination. It collects no health data, so it needs no privacy sign-off. The existing Google Form collects date of birth and address alongside 57 symptoms, which deserves a privacy review of its own. |
| Build /es | Built it as a draft that only appears once Spanish is confirmed and a human has reviewed it | You asked for no raw machine translation. Mine is exactly that until someone checks it. |
| Ship the answers hub | The hub builds itself when the first article goes live | An empty hub is a thin page. |
| Every page in the two tables built | /team and /treatments/joint-pain are built and linked but noindex | A team page with no names and a service page with no service would be the weakest pages on the site. Both switch on when their facts arrive. |
| FAQPage markup where FAQs exist | Any FAQ whose answer still contains a marker is left out of the markup | Markup must never carry a placeholder. |

---

## How to run it

```bash
cd hormonal-health-md
```

```bash
npm install
```

```bash
npm run check
```

That builds the public site into `dist/`, runs every check and rewrites `docs/site-audit.md`.

```bash
npm run preview
```

Serves the public build at http://localhost:4321 with redirects working.

```bash
npm run build:drafts && npm run preview:drafts
```

Builds and serves the version with the twelve articles and the Spanish draft at http://localhost:4322.

```bash
npm run check:launch
```

The launch gate. It fails while any `[[CONFIRM]]` marker or held page remains, and lists what is left.
