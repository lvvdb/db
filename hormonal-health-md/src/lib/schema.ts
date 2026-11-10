// JSON-LD builders. Everything here reads from src/config/clinic.ts, and anything that
// is not confirmed there is simply omitted. Nothing is ever guessed into markup.
import { clinic } from '../config/clinic';

const SITE = clinic.site;
export const abs = (path: string) => SITE + (path === '/' ? '/' : path);
export const CLINIC_ID = `${SITE}/#clinic`;
export const WEBSITE_ID = `${SITE}/#website`;

type Json = Record<string, unknown>;

const DAY: Record<string, string> = {
  Mo: 'Monday',
  Tu: 'Tuesday',
  We: 'Wednesday',
  Th: 'Thursday',
  Fr: 'Friday',
  Sa: 'Saturday',
  Su: 'Sunday',
};

export function clinicNode(services: { name: string; path: string }[] = []): Json {
  const node: Json = {
    '@type': 'MedicalClinic',
    '@id': CLINIC_ID,
    name: clinic.name,
    url: abs('/'),
    telephone: clinic.phoneE164,
    image: abs('/og.png'),
    logo: abs('/logo.png'),
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${clinic.street}, ${clinic.suite}`,
      addressLocality: clinic.city,
      addressRegion: clinic.region,
      postalCode: clinic.postalCode,
      addressCountry: clinic.country,
    },
    areaServed: clinic.areaServed.map((name) => ({
      '@type': 'City',
      name: `${name}, ${clinic.region}`,
    })),
  };
  if (clinic.geo) {
    node.geo = {
      '@type': 'GeoCoordinates',
      latitude: clinic.geo.lat,
      longitude: clinic.geo.lng,
    };
  }
  if (clinic.hours) {
    node.openingHoursSpecification = clinic.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days.map((d) => DAY[d]),
      opens: h.opens,
      closes: h.closes,
    }));
  }
  if (clinic.sameAs.length) node.sameAs = [...clinic.sameAs];
  if (clinic.languages.length > 1) node.availableLanguage = [...clinic.languages];
  if (services.length) {
    node.availableService = services.map((s) => ({
      '@type': 'MedicalTherapy',
      name: s.name,
      url: abs(s.path),
    }));
  }
  return node;
}

export function websiteNode(): Json {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: abs('/'),
    name: clinic.name,
    publisher: { '@id': CLINIC_ID },
    inLanguage: 'en-US',
  };
}

export function breadcrumbNode(path: string, crumbs: { name: string; path: string }[]): Json {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${abs(path)}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}

export function pageNode(opts: {
  path: string;
  title: string;
  description: string;
  updated?: string;
  medical?: boolean;
  type?: string;
  lang?: string;
  hasBreadcrumb?: boolean;
  about?: string;
}): Json {
  const node: Json = {
    '@type': opts.type ?? (opts.medical ? 'MedicalWebPage' : 'WebPage'),
    '@id': `${abs(opts.path)}#webpage`,
    url: abs(opts.path),
    name: opts.title,
    description: opts.description,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': CLINIC_ID },
    inLanguage: opts.lang ?? 'en-US',
  };
  if (opts.updated) node.dateModified = opts.updated;
  if (opts.hasBreadcrumb) node.breadcrumb = { '@id': `${abs(opts.path)}#breadcrumb` };
  // reviewedBy and lastReviewed appear only once a named clinician has actually
  // reviewed the page. Until then the page says so in plain sight instead.
  if (opts.medical && clinic.reviewer) {
    node.reviewedBy = {
      '@type': 'Person',
      name: clinic.reviewer.name,
      honorificSuffix: clinic.reviewer.credentials,
      jobTitle: clinic.reviewer.jobTitle,
      url: abs(clinic.reviewer.profilePath),
      worksFor: { '@id': CLINIC_ID },
    };
    if (opts.updated) node.lastReviewed = opts.updated;
  }
  return node;
}

export function serviceNode(opts: {
  path: string;
  name: string;
  description: string;
  areas?: string[];
}): Json {
  return {
    '@type': 'Service',
    '@id': `${abs(opts.path)}#service`,
    name: opts.name,
    description: opts.description,
    url: abs(opts.path),
    provider: { '@id': CLINIC_ID },
    areaServed: (opts.areas ?? clinic.areaServed).map((name) => ({
      '@type': 'City',
      name: `${name}, ${clinic.region}`,
    })),
  };
}

const strip = (s: string) =>
  s
    .replace(/\[\[CONFIRM:[^\]]*\]\]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/** FAQPage markup. Any answer still carrying an unconfirmed fact is left out. */
export function faqNode(path: string, faqs: { q: string; a: string }[]): Json | null {
  const clean = faqs.filter((f) => !/\[\[CONFIRM:/.test(f.q + f.a));
  if (!clean.length) return null;
  return {
    '@type': 'FAQPage',
    '@id': `${abs(path)}#faq`,
    mainEntity: clean.map((f) => ({
      '@type': 'Question',
      name: strip(f.q),
      acceptedAnswer: { '@type': 'Answer', text: strip(f.a) },
    })),
  };
}

export function graph(nodes: (Json | null | undefined)[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  });
}
