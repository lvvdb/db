// Single source of truth for every fact about the clinic.
//
// Name, address and phone are printed from here character for character on every page,
// in the JSON-LD, and in the local SEO playbook. Change them here and nowhere else.
//
// Anything the clinic has not confirmed is `null`. A null value renders on the page as a
// visible [[CONFIRM: ...]] marker and is left out of titles, meta tags and JSON-LD
// entirely. `npm run check:launch` fails while any marker remains.

export const clinic = {
  name: 'Hormonal Health MD',
  site: 'https://hormonalhealthmd.com',

  street: '501 Golden Isles Dr',
  suite: 'Suite 204-C',
  city: 'Hallandale Beach',
  region: 'FL',
  postalCode: '33009',
  country: 'US',

  phoneDisplay: '(305) 219-4351',
  phoneE164: '+13052194351',

  // Centre of the Google map embedded on the current site's homepage and contact page
  // (captured 9 Nov 2026). Replace with the verified Google Business Profile pin.
  geo: { lat: 25.98491, lng: -80.129626 } as { lat: number; lng: number } | null,

  // Opening hours, in the order they should print. `null` until the clinic confirms them.
  // Example: [{ days: ['Mo','Tu','We','Th','Fr'], label: 'Monday to Friday', opens: '09:00', closes: '18:00' }]
  hours: null as
    | { days: string[]; label: string; opens: string; closes: string }[]
    | null,

  // The current site contradicts itself on hours: the homepage and service pages say
  // 10am to 7pm seven days a week, the contact page says noon to 7pm Monday to Friday,
  // Saturday by appointment, Sunday closed, and one Yelp listing agrees with the contact
  // page. Until the clinic confirms, hours print as a [[CONFIRM]] marker and "Open 7 Days"
  // stays out of every title and meta description. Flip this to true (and fill `hours`)
  // to switch the claim on everywhere in one move.
  openSevenDays: false,

  // The three ways to get care. Each is described on the site only while true.
  routes: { clinic: true, telehealth: true, mobile: true },

  // Cities named in areaServed markup and the "serving" line.
  areaServed: ['Hallandale Beach', 'Aventura', 'Hollywood', 'Sunny Isles Beach'],

  // Booking, review and profile links. Null means "not confirmed, do not print".
  bookingUrl: null as string | null,
  googleReviewUrl: null as string | null,
  googleRating: null as { rating: number; count: number; asOf: string } | null,
  sameAs: [] as string[],

  // The licensed clinician who reviews clinical pages. Drives the visible
  // "Medically reviewed by" line and the reviewedBy / lastReviewed markup.
  reviewer: null as
    | { name: string; credentials: string; profilePath: string; jobTitle: string }
    | null,

  // The people who provide care. While this list is empty the team page shows
  // [[CONFIRM]] markers and stays out of search engines.
  team: [] as {
    name: string;
    credentials: string;
    role: string;
    license: string;
    bio: string;
  }[],

  // Languages staff actually speak with patients. Drives /es and hreflang.
  languages: ['en'] as string[],

  // Search Console ownership token from the current homepage. Carried over so the
  // existing property stays verified through the migration.
  googleSiteVerification: 'I9qOURru3fwoZ7suruNmANacYKnzbJfoZVlMySj5T8U',

  // AI crawlers are allowed in robots.txt while true.
  allowAiCrawlers: true,

  // Call tracking: the real number above always stays in the HTML and markup.
  // If a tracking number is set here it is swapped in by script only.
  callTrackingNumber: null as { display: string; e164: string } | null,

  // Privacy-safe analytics endpoint (event name + page path only). Null = no analytics.
  analyticsEndpoint: null as string | null,
} as const;

export const nap = {
  line: `${clinic.street}, ${clinic.suite}, ${clinic.city}, ${clinic.region} ${clinic.postalCode}`,
  telHref: `tel:${clinic.phoneE164}`,
  mapsSearch:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(
      `${clinic.name}, ${clinic.street} ${clinic.suite}, ${clinic.city}, ${clinic.region} ${clinic.postalCode}`,
    ),
  mapsDirections:
    'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent(
      `${clinic.street} ${clinic.suite}, ${clinic.city}, ${clinic.region} ${clinic.postalCode}`,
    ),
};

export const sevenDays = clinic.openSevenDays ? 'Open 7 days' : '';
