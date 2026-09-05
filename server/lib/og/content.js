import { createHash } from 'node:crypto';
import { Church } from '../../models/Church.js';
import { Course } from '../../models/Course.js';
import { Offering } from '../../models/Offering.js';
import { Resource } from '../../models/Resource.js';
import { publicFilter } from '../visibility.js';
import { artworkRevision } from './images.js';

export const TYPES = { churches: Church, courses: Course, listing: Offering, materials: Resource, give: Church };
const clean = (value) => String(Array.isArray(value) ? value.join(' ') : value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
export const revision = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
export const matchPage = (pathname) => {
  const match = /^\/(churches|courses|listing|materials|give)\/([a-z0-9][a-z0-9-]{0,199})\/?$/.exec(pathname);
  return match && { type: match[1], slug: match[2] };
};

export async function resolveContent(type, slug) {
  if (!Object.hasOwn(TYPES, type) || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug)) return null;
  const filter = { status: 'published', ...await publicFilter() };
  const item = await TYPES[type].findOne({ slug, ...filter }, 'slug name title tagline about subtitle description city country coverImage logoImage churchSlug kind donations.enabled updatedAt').lean();
  if (!item || (type === 'give' && !item.donations?.enabled)) return null;
  const isChurch = type === 'churches' || type === 'give';
  const church = isChurch ? item : await Church.findOne({ slug: item.churchSlug, ...filter }, 'name logoImage updatedAt').lean();
  if (!church) return null;
  const title = clean(type === 'give' ? `Give to ${item.name}` : item.name || item.title).slice(0, 1000);
  const location = [item.city, item.country].filter(Boolean).join(', ');
  const content = {
    type, slug, title,
    description: clean(item.tagline || item.about || item.subtitle || item.description || title).slice(0, 200),
    subtitle: (isChurch ? location : clean(church.name)).slice(0, 200),
    label: ({ churches: 'Church community', courses: 'Course', listing: 'Credential', give: 'Giving' })[type] || clean(item.kind || 'Material').replaceAll('-', ' '),
    artwork: item.coverImage || '', logo: church.logoImage || '',
    path: `/${type}/${slug}`,
  };
  const assets = await Promise.all([artworkRevision(content.artwork), artworkRevision(content.logo)]);
  content.version = revision({ template: 1, content, assets, itemUpdated: item.updatedAt, churchUpdated: church.updatedAt });
  return content;
}
