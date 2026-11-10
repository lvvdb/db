// A confirmed differentiator earns a slot in the title tag and meta description, but
// only when it fits. Nothing here ever prints an unconfirmed claim: the site-wide slot
// comes from clinic.openSevenDays, and a page-level slot (for example "From $99") comes
// from `titleSlot` in that page's frontmatter, which is only filled once a price is real.
import { clinic } from '../config/clinic';

const BRAND = ` | ${clinic.name}`;
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

export function titleWithSlot(title: string, pageSlot?: string): string {
  const slot = pageSlot || (clinic.openSevenDays ? 'Open 7 Days' : '');
  if (!slot) return title;
  const base = title.endsWith(BRAND) ? title.slice(0, -BRAND.length) : title;
  const withBrand = `${base} | ${slot}${BRAND}`;
  if (withBrand.length <= TITLE_MAX) return withBrand;
  const withoutBrand = `${base} | ${slot}`;
  return withoutBrand.length <= TITLE_MAX ? withoutBrand : title;
}

export function descriptionWithSlot(description: string): string {
  if (!clinic.openSevenDays || /open 7 days/i.test(description)) return description;
  const next = `${description} Open 7 days.`;
  return next.length <= DESCRIPTION_MAX ? next : description;
}
