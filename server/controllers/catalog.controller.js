import { asyncHandler } from '../middleware/asyncHandler.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Instructor } from '../models/Instructor.js';
import { Pathway } from '../models/Pathway.js';
import { Review } from '../models/Review.js';
import { categories } from '../data/index.js';

const CARD_FIELDS =
  'slug title subtitle churchSlug category level price compareAtPrice currency coverImage coverAlt rating ratingCount learners totalMinutes lectureCount bestseller tags certificate.kind';

/** Decorate course cards with the issuing church so the grid never needs a second call. */
const withChurch = async (courseDocs) => {
  const slugs = [...new Set(courseDocs.map((c) => c.churchSlug))];
  const churches = await Church.find({ slug: { $in: slugs } }, 'slug name shortName monogram city country verified');
  const bySlug = Object.fromEntries(churches.map((c) => [c.slug, c]));
  return courseDocs.map((c) => ({ ...c.toObject(), church: bySlug[c.churchSlug] ?? null }));
};

export const home = asyncHandler(async (_req, res) => {
  const [featured, popular, newest, churches, pathwayDocs] = await Promise.all([
    Course.find({ bestseller: true }, CARD_FIELDS).sort({ learners: -1 }).limit(8),
    Course.find({}, CARD_FIELDS).sort({ learners: -1 }).limit(8),
    Course.find({}, CARD_FIELDS).sort({ createdAt: -1 }).limit(8),
    Church.find({}, 'slug name shortName tagline monogram city country region coverImage coverAlt specialties verified rating ratingCount stats').sort({ 'stats.learners': -1 }),
    Pathway.find({}, 'slug title subtitle churchSlug category coverImage coverAlt price compareAtPrice months level rating ratingCount learners award steps').limit(6),
  ]);

  const totals = {
    courses: await Course.countDocuments(),
    churches: churches.length,
    learners: churches.reduce((n, c) => n + (c.stats?.learners ?? 0), 0),
    credentials: churches.reduce((n, c) => n + (c.stats?.credentialsIssued ?? 0), 0),
  };

  res.json({
    success: true,
    data: {
      featured: await withChurch(featured),
      popular: await withChurch(popular),
      newest: await withChurch(newest),
      churches,
      pathways: pathwayDocs,
      categories,
      totals,
    },
  });
});

export const listCourses = asyncHandler(async (req, res) => {
  const { q, category, level, church, maxPrice, sort = 'popular', page = '1', limit = '12' } = req.query;

  const filter = {};
  if (category) filter.category = category;
  if (level) filter.level = level;
  if (church) filter.churchSlug = church;
  if (maxPrice) filter.price = { $lte: Number(maxPrice) };
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { subtitle: rx }, { tags: rx }, { category: rx }, { subcategory: rx }];
  }

  const sorts = {
    popular: { learners: -1 },
    rating: { rating: -1, ratingCount: -1 },
    newest: { createdAt: -1 },
    'price-asc': { price: 1 },
    'price-desc': { price: -1 },
  };

  const perPage = Math.min(Number(limit) || 12, 48);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const [docs, total, facetCategories, facetLevels, facetChurches] = await Promise.all([
    Course.find(filter, CARD_FIELDS).sort(sorts[sort] ?? sorts.popular).skip(skip).limit(perPage),
    Course.countDocuments(filter),
    Course.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Course.aggregate([{ $group: { _id: '$level', count: { $sum: 1 } } }]),
    Course.aggregate([{ $group: { _id: '$churchSlug', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
  ]);

  const churchNames = await Church.find({}, 'slug name shortName');
  const nameBySlug = Object.fromEntries(churchNames.map((c) => [c.slug, c.shortName ?? c.name]));

  res.json({
    success: true,
    data: {
      courses: await withChurch(docs),
      total,
      page: Number(page) || 1,
      pages: Math.ceil(total / perPage),
      facets: {
        categories: facetCategories.map((f) => ({ value: f._id, count: f.count })),
        levels: facetLevels.map((f) => ({ value: f._id, count: f.count })),
        churches: facetChurches.map((f) => ({ value: f._id, label: nameBySlug[f._id] ?? f._id, count: f.count })),
      },
    },
  });
});

export const courseDetail = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug });
  if (!course) return res.status(404).json({ success: false, message: 'That course does not exist.' });

  const [church, courseInstructors, courseReviews, related, inPathways] = await Promise.all([
    Church.findOne({ slug: course.churchSlug }),
    Instructor.find({ slug: { $in: course.instructorSlugs } }),
    Review.find({ courseSlug: course.slug }).sort({ helpful: -1 }),
    Course.find({ category: course.category, slug: { $ne: course.slug } }, CARD_FIELDS).sort({ learners: -1 }).limit(4),
    Pathway.find({ 'steps.courseSlug': course.slug }, 'slug title subtitle churchSlug coverImage price months award'),
  ]);

  const breakdown = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: courseReviews.filter((r) => r.rating === stars).length,
  }));

  res.json({
    success: true,
    data: {
      course,
      church,
      instructors: courseInstructors,
      reviews: courseReviews,
      reviewBreakdown: breakdown,
      related: await withChurch(related),
      pathways: inPathways,
    },
  });
});

export const listPathways = asyncHandler(async (_req, res) => {
  const docs = await Pathway.find({}).sort({ learners: -1 });
  const churches = await Church.find({}, 'slug name shortName monogram city country verified');
  const bySlug = Object.fromEntries(churches.map((c) => [c.slug, c]));
  res.json({
    success: true,
    data: docs.map((p) => ({ ...p.toObject(), church: bySlug[p.churchSlug] ?? null })),
  });
});

export const pathwayDetail = asyncHandler(async (req, res) => {
  const pathway = await Pathway.findOne({ slug: req.params.slug });
  if (!pathway) return res.status(404).json({ success: false, message: 'That pathway does not exist.' });

  const stepSlugs = pathway.steps.filter((s) => s.courseSlug).map((s) => s.courseSlug);
  const [church, stepCourses] = await Promise.all([
    Church.findOne({ slug: pathway.churchSlug }),
    Course.find({ slug: { $in: stepSlugs } }, CARD_FIELDS),
  ]);

  const byslug = Object.fromEntries(stepCourses.map((c) => [c.slug, c]));
  const savings = stepCourses.reduce((n, c) => n + c.price, 0) - pathway.price;

  res.json({
    success: true,
    data: {
      pathway,
      church,
      courses: byslug,
      separatePrice: stepCourses.reduce((n, c) => n + c.price, 0),
      savings: savings > 0 ? savings : 0,
    },
  });
});

export const listChurches = asyncHandler(async (req, res) => {
  const { q, region, specialty } = req.query;
  const filter = {};
  if (region) filter.region = region;
  if (specialty) filter.specialties = specialty;
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { tagline: rx }, { city: rx }, { country: rx }, { specialties: rx }];
  }

  const docs = await Church.find(filter).sort({ 'stats.learners': -1 });
  const regions = await Church.aggregate([{ $group: { _id: '$region', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);

  res.json({
    success: true,
    data: {
      churches: docs,
      regions: regions.map((r) => ({ value: r._id, count: r.count })),
    },
  });
});

export const churchDetail = asyncHandler(async (req, res) => {
  const church = await Church.findOne({ slug: req.params.slug });
  if (!church) return res.status(404).json({ success: false, message: 'That church does not exist.' });

  const [churchCourses, churchPathways, faculty] = await Promise.all([
    Course.find({ churchSlug: church.slug }, CARD_FIELDS).sort({ learners: -1 }),
    Pathway.find({ churchSlug: church.slug }),
    Instructor.find({ churchSlug: church.slug }),
  ]);

  res.json({
    success: true,
    data: {
      church,
      courses: await withChurch(churchCourses),
      pathways: churchPathways,
      faculty,
    },
  });
});

export const search = asyncHandler(async (req, res) => {
  const term = String(req.query.q ?? '').trim();
  if (!term) return res.json({ success: true, data: { courses: [], churches: [], pathways: [] } });

  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [courseDocs, churchDocs, pathwayDocs] = await Promise.all([
    Course.find({ $or: [{ title: rx }, { subtitle: rx }, { tags: rx }, { category: rx }] }, CARD_FIELDS).limit(6),
    Church.find({ $or: [{ name: rx }, { specialties: rx }, { city: rx }, { country: rx }] }, 'slug name shortName monogram city country coverImage verified').limit(4),
    Pathway.find({ $or: [{ title: rx }, { subtitle: rx }, { category: rx }] }, 'slug title subtitle churchSlug coverImage price award').limit(3),
  ]);

  res.json({
    success: true,
    data: { courses: await withChurch(courseDocs), churches: churchDocs, pathways: pathwayDocs },
  });
});

export const listCategories = asyncHandler(async (_req, res) => {
  const counts = await Course.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
  const byName = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  res.json({ success: true, data: categories.map((c) => ({ ...c, count: byName[c.name] ?? 0 })) });
});
