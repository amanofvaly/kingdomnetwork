import { asyncHandler } from '../middleware/asyncHandler.js';
import { publicFilter } from '../lib/visibility.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Resource } from '../models/Resource.js';

/**
 * One catalogue over coursework and materials.
 *
 * They are separate collections because they are separate things to author —
 * a course has lectures and progress, a book is a file someone downloads — but
 * to a person looking for something to learn from they are one shelf. A union
 * keeps that shelf honest: paging and counts describe the whole of it rather
 * than one half plus an estimate.
 */

const SORTS = {
  popular: { learners: -1, createdAt: -1 },
  rating: { rating: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  'price-asc': { price: 1, createdAt: -1 },
  'price-desc': { price: -1, createdAt: -1 },
};

// `$literal` throughout: a bare string in $project is read as a field path, and
// a bare null as an exclusion, so both need saying explicitly.
const COURSE_CARD = {
  $project: {
    _id: 0,
    kind: { $literal: 'course' },
    slug: 1, title: 1, subtitle: 1, churchSlug: 1,
    price: 1, compareAtPrice: 1, currency: 1,
    coverImage: 1, coverAlt: 1,
    category: 1, level: 1,
    minutes: '$totalMinutes',
    lectureCount: 1,
    rating: 1, ratingCount: 1, learners: 1,
    bestseller: 1,
    createdAt: 1,
  },
};

const RESOURCE_CARD = {
  $project: {
    _id: 0,
    kind: '$kind',
    slug: 1, title: 1, subtitle: 1, churchSlug: 1,
    price: 1, compareAtPrice: 1, currency: 1,
    coverImage: 1, coverAlt: 1,
    minutes: '$durationMinutes',
    pages: 1,
    authorName: 1,
    createdAt: 1,
  },
};

const rx = (term) => new RegExp(String(term).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/**
 * The union, filtered by everything except format. Both the facet counts and
 * the page itself are built from this, which is what lets the format filter
 * stay changeable: its own counts must not be narrowed by itself.
 */
const unionStages = async ({ q, category, level, church }) => {
  const visible = { status: 'published', ...(await publicFilter()) };

  const courseMatch = { ...visible };
  const resourceMatch = { ...visible };

  if (church) {
    courseMatch.churchSlug = church;
    resourceMatch.churchSlug = church;
  }
  if (q) {
    courseMatch.$or = [{ title: rx(q) }, { subtitle: rx(q) }, { tags: rx(q) }, { category: rx(q) }];
    resourceMatch.$or = [{ title: rx(q) }, { subtitle: rx(q) }, { tags: rx(q) }, { authorName: rx(q) }];
  }

  // Subject and level describe coursework only. Choosing one is choosing
  // courses, so the other side of the union drops out rather than being
  // filtered by a field it does not have.
  const coursesOnly = Boolean(category || level);
  if (category) courseMatch.category = category;
  if (level) courseMatch.level = level;

  return [
    { $match: courseMatch },
    COURSE_CARD,
    ...(coursesOnly
      ? []
      : [{ $unionWith: { coll: Resource.collection.name, pipeline: [{ $match: resourceMatch }, RESOURCE_CARD] } }]),
  ];
};

export const list = asyncHandler(async (req, res) => {
  const { q, format, category, level, church, sort = 'popular', page = '1', limit = '12' } = req.query;

  const perPage = Math.min(Number(limit) || 12, 48);
  const current = Math.max(Number(page) || 1, 1);
  const skip = (current - 1) * perPage;

  const stages = await unionStages({ q, category, level, church });
  const formatMatch = format ? [{ $match: { kind: format } }] : [];

  const [paged, formats] = await Promise.all([
    Course.aggregate([
      ...stages,
      ...formatMatch,
      {
        $facet: {
          items: [{ $sort: SORTS[sort] ?? SORTS.popular }, { $skip: skip }, { $limit: perPage }],
          total: [{ $count: 'n' }],
          categories: [{ $match: { category: { $ne: null } } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          levels: [{ $match: { level: { $ne: null } } }, { $group: { _id: '$level', count: { $sum: 1 } } }],
          churches: [{ $group: { _id: '$churchSlug', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        },
      },
    ]),
    // Counted before the format filter, so every format stays clickable.
    Course.aggregate([...stages, { $group: { _id: '$kind', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
  ]);

  const result = paged[0] ?? { items: [], total: [], categories: [], levels: [], churches: [] };
  const total = result.total[0]?.n ?? 0;

  const churches = await Church.find({}, 'slug name shortName monogram verified');
  const by = Object.fromEntries(churches.map((c) => [c.slug, c]));

  res.json({
    success: true,
    data: {
      items: result.items.map((item) => ({ ...item, church: by[item.churchSlug] ?? null })),
      total,
      page: current,
      pages: Math.ceil(total / perPage),
      facets: {
        formats: formats.map((f) => ({ value: f._id, count: f.count })),
        categories: result.categories.map((c) => ({ value: c._id, count: c.count })),
        levels: result.levels.map((l) => ({ value: l._id, count: l.count })),
        churches: result.churches.map((c) => ({ value: c._id, label: by[c._id]?.shortName ?? c._id, count: c.count })),
      },
    },
  });
});
