// Every photo on the site comes through here, so alt text, crops and licence status
// live in one file: src/data/photos.json.
import type { ImageMetadata } from 'astro';
import data from '../data/photos.json';
import { SHOW_DRAFTS } from './content';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.jpg', { eager: true });

function load(file: string): ImageMetadata {
  const mod = files[`../assets/photos/${file}`];
  if (!mod) throw new Error(`photos.json names ${file}, but it is not in src/assets/photos`);
  return mod.default;
}

export type PhotoName = keyof typeof data.photos;

export function photo(name: string) {
  const p = (data.photos as Record<string, { file: string; alt: string }>)[name];
  if (!p) throw new Error(`No photo called "${name}" in src/data/photos.json`);
  return { name, alt: p.alt, src: load(p.file) };
}

// Before-and-after photos only build publicly once the clinic confirms each is its own
// patient with a signed photo release. Until then they show in the drafts and review
// builds only, with a visible [[CONFIRM]] marker.
export const resultsConsent = data.resultsConsent;
export const showResults = data.resultsConsent || SHOW_DRAFTS;
export const results = data.results.map((r) => ({ alt: r.alt, src: load(r.file) }));
