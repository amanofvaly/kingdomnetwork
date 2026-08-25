import { asyncHandler } from '../middleware/asyncHandler.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Credential } from '../models/Credential.js';
import { Enrollment } from '../models/Enrollment.js';
import { Offering } from '../models/Offering.js';
import { Review } from '../models/Review.js';
import { outcomes, outcomeBySlug } from '../data/outcomes.js';

const CARD =
  'slug churchSlug type outcome title subtitle price compareAtPrice currency acquisition coverImage coverAlt rating ratingCount issuedCount featured editorsPick badge award.title award.postNominal award.validityMonths award.renewable letter.destinationCountry letter.destinationCity letter.turnaroundDays requires.credentials requires.courses requires.assessment requires.review';

/** Attach the issuing church to every card. Nobody buys a title without knowing who signs it. */
const withChurch = async (docs) => {
  const slugs = [...new Set(docs.map((d) => d.churchSlug))];
  const churches = await Church.find(
    { slug: { $in: slugs } },
    'slug name shortName monogram city country region verified rating foundedYear stats.credentialsIssued',
  );
  const by = Object.fromEntries(churches.map((c) => [c.slug, c]));
  return docs.map((d) => ({ ...(d.toObject?.() ?? d), church: by[d.churchSlug] ?? null }));
};

/**
 * Marketplace ranking. On an open marketplace this is the only lever we hold,
 * so it is deliberate: our picks first, then paid boost, then what the market
 * has actually chosen.
 */
const RANK = { boost: -1, editorsPick: -1, issuedCount: -1 };

const SORTS = {
  recommended: RANK,
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  rating: { rating: -1, ratingCount: -1 },
  issued: { issuedCount: -1 },
  fastest: { 'requires.review.turnaroundDays': 1, price: 1 },
};

export const listOutcomes = asyncHandler(async (_req, res) => {
  const counts = await Offering.aggregate([
    { $group: { _id: '$outcome', count: { $sum: 1 }, from: { $min: '$price' }, issued: { $sum: '$issuedCount' } } },
  ]);
  const by = Object.fromEntries(counts.map((c) => [c._id, c]));
  res.json({
    success: true,
    data: outcomes.map((o) => ({
      ...o,
      count: by[o.slug]?.count ?? 0,
      fromPrice: by[o.slug]?.from ?? null,
      issued: by[o.slug]?.issued ?? 0,
    })),
  });
});

/** The comparison page. Many churches, one outcome, ranked and filterable. */
export const outcomeDetail = asyncHandler(async (req, res) => {
  const outcome = outcomeBySlug[req.params.slug];
  if (!outcome) return res.status(404).json({ success: false, message: 'That outcome does not exist.' });

  const { church, acquisition, destination, maxPrice, sort = 'recommended' } = req.query;

  const filter = { outcome: outcome.slug, published: true };
  if (church) filter.churchSlug = church;
  if (acquisition) filter.acquisition = acquisition;
  if (destination) filter['letter.destinationCountry'] = destination;
  if (maxPrice) filter.price = { $lte: Number(maxPrice) };

  const base = { outcome: outcome.slug, published: true };

  const [docs, facetChurch, facetMode, facetDest, range] = await Promise.all([
    Offering.find(filter, CARD).sort(SORTS[sort] ?? RANK),
    Offering.aggregate([{ $match: base }, { $group: { _id: '$churchSlug', count: { $sum: 1 }, from: { $min: '$price' } } }, { $sort: { count: -1 } }]),
    Offering.aggregate([{ $match: base }, { $group: { _id: '$acquisition', count: { $sum: 1 } } }]),
    Offering.aggregate([{ $match: base }, { $group: { _id: '$letter.destinationCountry', count: { $sum: 1 } } }]),
    Offering.aggregate([{ $match: base }, { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }]),
  ]);

  const churchNames = await Church.find({}, 'slug name shortName country verified');
  const nameBy = Object.fromEntries(churchNames.map((c) => [c.slug, c]));

  res.json({
    success: true,
    data: {
      outcome,
      offerings: await withChurch(docs),
      total: docs.length,
      priceRange: range[0] ? { min: range[0].min, max: range[0].max } : null,
      facets: {
        churches: facetChurch.map((f) => ({
          value: f._id,
          label: nameBy[f._id]?.shortName ?? nameBy[f._id]?.name ?? f._id,
          country: nameBy[f._id]?.country,
          verified: nameBy[f._id]?.verified,
          count: f.count,
          from: f.from,
        })),
        acquisition: facetMode.map((f) => ({ value: f._id, count: f.count })),
        destinations: facetDest.filter((f) => f._id).map((f) => ({ value: f._id, count: f.count })),
      },
    },
  });
});

/** Which of an offering's requirements does this signed-in buyer already meet? */
const resolveRequirements = async (offering, user) => {
  const req = offering.requires ?? {};
  const needCreds = req.credentials ?? [];
  const needCourses = req.courses ?? [];

  const [heldCreds, doneCourses, courseDocs, credOfferings] = await Promise.all([
    user ? Credential.find({ userId: user._id, status: 'issued' }, 'offeringSlug') : [],
    user ? Enrollment.find({ userId: user._id, status: 'completed' }, 'courseSlug') : [],
    Course.find({ slug: { $in: needCourses } }, 'slug title totalMinutes lectureCount coverImage price'),
    Offering.find({ slug: { $in: needCreds } }, 'slug title price churchSlug type award.title coverImage'),
  ]);

  const held = new Set(heldCreds.map((c) => c.offeringSlug));
  const done = new Set(doneCourses.map((e) => e.courseSlug));

  return {
    credentials: credOfferings.map((o) => ({ ...o.toObject(), met: held.has(o.slug) })),
    courses: courseDocs.map((c) => ({ ...c.toObject(), met: done.has(c.slug) })),
    assessment: req.assessment?.required ? req.assessment : null,
    review: req.review?.required ? req.review : null,
    eligibility: req.eligibility ?? [],
    allMet:
      credOfferings.every((o) => held.has(o.slug)) && courseDocs.every((c) => done.has(c.slug)),
  };
};

export const offeringDetail = asyncHandler(async (req, res) => {
  const offering = await Offering.findOne({ slug: req.params.slug });
  if (!offering) return res.status(404).json({ success: false, message: 'That listing does not exist.' });

  const [church, requirements, alternatives, alsoFrom, held] = await Promise.all([
    Church.findOne({ slug: offering.churchSlug }),
    resolveRequirements(offering, req.user),
    // The same outcome from other churches. This is the comparison that matters.
    Offering.find({ outcome: offering.outcome, slug: { $ne: offering.slug }, published: true }, CARD)
      .sort(RANK)
      .limit(4),
    Offering.find({ churchSlug: offering.churchSlug, slug: { $ne: offering.slug }, published: true }, CARD).limit(4),
    req.user ? Credential.findOne({ userId: req.user._id, offeringSlug: offering.slug }) : null,
  ]);

  res.json({
    success: true,
    data: {
      offering,
      church,
      requirements,
      alternatives: await withChurch(alternatives),
      alsoFrom: await withChurch(alsoFrom),
      held,
      outcome: outcomeBySlug[offering.outcome] ?? null,
    },
  });
});

export const home = asyncHandler(async (_req, res) => {
  const [featured, picks, letters, churches, totals] = await Promise.all([
    Offering.find({ featured: true, published: true }, CARD).sort(RANK).limit(8),
    Offering.find({ editorsPick: true, published: true }, CARD).sort(RANK).limit(4),
    Offering.find({ outcome: 'invitation-letter', published: true }, CARD).sort(RANK).limit(4),
    Church.find({}, 'slug name shortName tagline monogram city country region coverImage coverAlt specialties verified rating ratingCount stats foundedYear').sort({ 'stats.credentialsIssued': -1 }),
    Offering.aggregate([{ $group: { _id: null, listings: { $sum: 1 }, issued: { $sum: '$issuedCount' } } }]),
  ]);

  const outcomeCounts = await Offering.aggregate([
    { $group: { _id: '$outcome', count: { $sum: 1 }, from: { $min: '$price' } } },
  ]);
  const oc = Object.fromEntries(outcomeCounts.map((c) => [c._id, c]));

  res.json({
    success: true,
    data: {
      outcomes: outcomes.map((o) => ({ ...o, count: oc[o.slug]?.count ?? 0, fromPrice: oc[o.slug]?.from ?? null })),
      featured: await withChurch(featured),
      picks: await withChurch(picks),
      letters: await withChurch(letters),
      churches,
      totals: {
        listings: totals[0]?.listings ?? 0,
        issued: totals[0]?.issued ?? 0,
        churches: churches.length,
        countries: new Set(churches.map((c) => c.country)).size,
        courses: await Course.countDocuments(),
      },
    },
  });
});

/** One search across everything a church sells, plus the churches themselves. */
export const search = asyncHandler(async (req, res) => {
  const term = String(req.query.q ?? '').trim();
  const { outcome, church, acquisition, destination, maxPrice, sort = 'recommended', page = '1', limit = '18' } = req.query;

  const filter = { published: true };
  if (outcome) filter.outcome = outcome;
  if (church) filter.churchSlug = church;
  if (acquisition) filter.acquisition = acquisition;
  if (destination) filter['letter.destinationCountry'] = destination;
  if (maxPrice) filter.price = { $lte: Number(maxPrice) };

  if (term) {
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { subtitle: rx }, { outcome: rx }, { 'award.title': rx }, { 'letter.destinationCity': rx }, { 'letter.destinationCountry': rx }];
  }

  const perPage = Math.min(Number(limit) || 18, 48);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const [docs, total, facetOutcome, facetChurch, facetMode, matchedChurches] = await Promise.all([
    Offering.find(filter, CARD).sort(SORTS[sort] ?? RANK).skip(skip).limit(perPage),
    Offering.countDocuments(filter),
    Offering.aggregate([{ $match: { published: true } }, { $group: { _id: '$outcome', count: { $sum: 1 } } }]),
    Offering.aggregate([{ $match: { published: true } }, { $group: { _id: '$churchSlug', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Offering.aggregate([{ $match: { published: true } }, { $group: { _id: '$acquisition', count: { $sum: 1 } } }]),
    term
      ? Church.find(
          { $or: [{ name: new RegExp(term, 'i') }, { city: new RegExp(term, 'i') }, { country: new RegExp(term, 'i') }, { specialties: new RegExp(term, 'i') }] },
          'slug name shortName monogram city country coverImage verified stats.credentialsIssued',
        ).limit(4)
      : [],
  ]);

  const churchNames = await Church.find({}, 'slug name shortName country verified');
  const nameBy = Object.fromEntries(churchNames.map((c) => [c.slug, c]));

  res.json({
    success: true,
    data: {
      offerings: await withChurch(docs),
      churches: matchedChurches,
      total,
      page: Number(page) || 1,
      pages: Math.ceil(total / perPage),
      facets: {
        outcomes: facetOutcome.map((f) => ({ value: f._id, label: outcomeBySlug[f._id]?.name ?? f._id, count: f.count })),
        churches: facetChurch.map((f) => ({ value: f._id, label: nameBy[f._id]?.shortName ?? f._id, count: f.count })),
        acquisition: facetMode.map((f) => ({ value: f._id, count: f.count })),
      },
    },
  });
});

/** Typeahead. Outcomes and church names first — that is how people actually search here. */
export const suggest = asyncHandler(async (req, res) => {
  const term = String(req.query.q ?? '').trim();
  if (term.length < 2) return res.json({ success: true, data: { outcomes: [], offerings: [], churches: [] } });
  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const [offeringHits, churchHits] = await Promise.all([
    Offering.find({ $or: [{ title: rx }, { 'award.title': rx }, { 'letter.destinationCity': rx }] }, 'slug title churchSlug outcome price type').sort(RANK).limit(5),
    Church.find({ $or: [{ name: rx }, { city: rx }, { country: rx }] }, 'slug name shortName monogram country').limit(4),
  ]);

  res.json({
    success: true,
    data: {
      outcomes: outcomes.filter((o) => rx.test(o.name) || rx.test(o.verb)).slice(0, 4),
      offerings: await withChurch(offeringHits),
      churches: churchHits,
    },
  });
});

export const churchDetail = asyncHandler(async (req, res) => {
  const church = await Church.findOne({ slug: req.params.slug });
  if (!church) return res.status(404).json({ success: false, message: 'That church does not exist.' });

  const [listings, courses, faculty] = await Promise.all([
    Offering.find({ churchSlug: church.slug, published: true }, CARD).sort(RANK),
    Course.find({ churchSlug: church.slug }, 'slug title subtitle coverImage totalMinutes lectureCount level price rating ratingCount').sort({ learners: -1 }),
    (await import('../models/Instructor.js')).Instructor.find({ churchSlug: church.slug }),
  ]);

  const byOutcome = {};
  for (const l of listings) {
    (byOutcome[l.outcome] ??= []).push(l);
  }

  res.json({
    success: true,
    data: {
      church,
      listings: await withChurch(listings),
      byOutcome: Object.entries(byOutcome).map(([slug, items]) => ({
        outcome: outcomeBySlug[slug] ?? { slug, name: slug },
        count: items.length,
      })),
      courses,
      faculty,
    },
  });
});

export const listChurches = asyncHandler(async (req, res) => {
  const { q, region, country } = req.query;
  const filter = {};
  if (region) filter.region = region;
  if (country) filter.country = country;
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { tagline: rx }, { city: rx }, { country: rx }, { specialties: rx }];
  }

  const [docs, regions, counts] = await Promise.all([
    Church.find(filter).sort({ 'stats.credentialsIssued': -1 }),
    Church.aggregate([{ $group: { _id: '$region', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Offering.aggregate([{ $group: { _id: '$churchSlug', listings: { $sum: 1 }, from: { $min: '$price' } } }]),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c._id, c]));

  res.json({
    success: true,
    data: {
      churches: docs.map((c) => ({ ...c.toObject(), listings: by[c.slug]?.listings ?? 0, fromPrice: by[c.slug]?.from ?? null })),
      regions: regions.map((r) => ({ value: r._id, count: r.count })),
    },
  });
});

export const reviewsFor = asyncHandler(async (req, res) => {
  const docs = await Review.find({ courseSlug: req.params.slug }).sort({ helpful: -1 });
  res.json({ success: true, data: docs });
});
