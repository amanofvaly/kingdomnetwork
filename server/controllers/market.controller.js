import { asyncHandler } from '../middleware/asyncHandler.js';
import { visibleSections } from '../lib/churchPage.js';
import { disclosuresFor } from '../lib/disclosures.js';
import { evaluate, summarise } from '../lib/requirements.js';
import { publicFilter } from '../lib/visibility.js';
import { Application } from '../models/Application.js';
import { Church } from '../models/Church.js';
import { Follow } from '../models/Follow.js';
import { Course } from '../models/Course.js';
import { Credential } from '../models/Credential.js';
import { Enrollment } from '../models/Enrollment.js';
import { Instructor } from '../models/Instructor.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { Offering } from '../models/Offering.js';
import { PlatformSettings } from '../models/PlatformSettings.js';
import { Resource } from '../models/Resource.js';
import { Review } from '../models/Review.js';
import { outcomes, outcomeBySlug } from '../data/outcomes.js';

const CARD =
  'slug churchSlug type tier outcome title subtitle price fee currency acquisition coverImage coverAlt rating ratingCount issuedCount featured editorsPick badge demo award.title award.postNominal award.validityMonths award.renewable letter.destinationCountry letter.destinationCity letter.turnaroundDays requires.credentials requires.courses requires.assessment requires.review requires.interview';

/** Everything a visitor may see: published, and not demonstration content when that is off. */
const live = async (extra = {}) => ({ status: 'published', ...(await publicFilter()), ...extra });

/** Attach the issuing church to every card. Nobody applies without knowing who signs. */
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
 * How listings are ranked. It is the only lever the platform holds over an
 * open network, so it is deliberate: our picks first, then paid placement,
 * then what people have actually chosen.
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
    { $match: await live() },
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

  const base = await live({ outcome: outcome.slug });
  const filter = { ...base };
  if (church) filter.churchSlug = church;
  if (acquisition) filter.acquisition = acquisition;
  if (destination) filter['letter.destinationCountry'] = destination;
  if (maxPrice) filter.price = { $lte: Number(maxPrice) };

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

/**
 * What this visitor already meets, resolved through the same evaluator the
 * application itself uses — so the checklist on the listing and the checklist
 * inside the application can never disagree.
 */
const requirementsFor = async (offering, user) => {
  const context = { application: null };

  if (user) {
    const [held, enrollments] = await Promise.all([
      Credential.find({ userId: user._id, status: 'issued' }, 'offeringSlug').lean(),
      Enrollment.find({ userId: user._id, courseSlug: { $type: 'string' } }, 'courseSlug status progress creditUnitsEarned').lean(),
    ]);
    context.heldCredentials = new Set(held.map((c) => c.offeringSlug).filter(Boolean));
    context.completedCourses = new Set(enrollments.filter((e) => e.status === 'completed').map((e) => e.courseSlug));
    context.courseProgress = new Map(enrollments.map((e) => [e.courseSlug, e.progress ?? 0]));
  }

  const { steps, eligibility } = evaluate(offering, context);

  const courseSlugs = steps.filter((s) => s.meta?.courseSlug).map((s) => s.meta.courseSlug);
  const credentialSlugs = steps.flatMap((s) =>
    s.meta?.group ? s.meta.items ?? [] : s.meta?.offeringSlug ? [s.meta.offeringSlug] : [],
  );

  const [courses, required] = await Promise.all([
    Course.find({ slug: { $in: courseSlugs } }, 'slug title totalMinutes lectureCount coverImage price'),
    Offering.find({ slug: { $in: credentialSlugs } }, 'slug title price fee churchSlug type award.title coverImage'),
  ]);
  const courseBy = Object.fromEntries(courses.map((c) => [c.slug, c]));
  const requiredBy = Object.fromEntries(required.map((o) => [o.slug, o]));

  return {
    steps: steps.map((s) => ({
      ...s,
      course: s.meta?.courseSlug ? courseBy[s.meta.courseSlug] ?? null : null,
      offering: s.meta?.offeringSlug ? requiredBy[s.meta.offeringSlug] ?? null : null,
      options: s.meta?.group
        ? (s.meta.items ?? []).map((slug) => requiredBy[slug] ?? courseBy[slug] ?? { slug })
        : undefined,
    })),
    eligibility,
    summary: summarise(steps),
  };
};

export const offeringDetail = asyncHandler(async (req, res) => {
  const offering = await Offering.findOne({ slug: req.params.slug });
  if (!offering || offering.status !== 'published') {
    return res.status(404).json({ success: false, message: 'That listing does not exist.' });
  }

  const visible = await live();
  const [church, requirements, alternatives, alsoFrom, held, application] = await Promise.all([
    Church.findOne({ slug: offering.churchSlug }),
    requirementsFor(offering, req.user),
    // The same outcome from other churches. This is the comparison that matters.
    Offering.find({ ...visible, outcome: offering.outcome, slug: { $ne: offering.slug } }, CARD).sort(RANK).limit(4),
    Offering.find({ ...visible, churchSlug: offering.churchSlug, slug: { $ne: offering.slug } }, CARD).limit(4),
    req.user ? Credential.findOne({ userId: req.user._id, offeringSlug: offering.slug, status: 'issued' }) : null,
    req.user
      ? Application.findOne(
          { userId: req.user._id, offeringSlug: offering.slug, status: { $nin: ['withdrawn', 'declined', 'expired'] } },
          'reference status',
        )
      : null,
  ]);

  res.json({
    success: true,
    data: {
      offering,
      church,
      requirements,
      // Stated in the place the claim is made, every time.
      disclosures: disclosuresFor(offering),
      alternatives: await withChurch(alternatives),
      alsoFrom: await withChurch(alsoFrom),
      held,
      application,
      outcome: outcomeBySlug[offering.outcome] ?? null,
    },
  });
});

export const home = asyncHandler(async (_req, res) => {
  const visible = await live();
  const settings = await PlatformSettings.load();

  const [featured, picks, letters, churches, totals, courseCount] = await Promise.all([
    Offering.find({ ...visible, featured: true }, CARD).sort(RANK).limit(8),
    Offering.find({ ...visible, editorsPick: true }, CARD).sort(RANK).limit(4),
    Offering.find({ ...visible, outcome: 'invitation-letter' }, CARD).sort(RANK).limit(4),
    Church.find(
      { status: 'published', ...(await publicFilter()) },
      'slug name shortName tagline monogram city country region coverImage coverAlt specialties verified rating ratingCount stats foundedYear demo',
    ).sort({ 'stats.credentialsIssued': -1 }),
    Offering.aggregate([{ $match: visible }, { $group: { _id: null, listings: { $sum: 1 }, issued: { $sum: '$issuedCount' } } }]),
    Course.countDocuments(await live()),
  ]);

  const outcomeCounts = await Offering.aggregate([
    { $match: visible },
    { $group: { _id: '$outcome', count: { $sum: 1 }, from: { $min: '$price' } } },
  ]);
  const oc = Object.fromEntries(outcomeCounts.map((c) => [c._id, c]));

  // The hero used to be a flat image with invisible click targets over it, so
  // the offer, its price and the church were baked into a raster file. It is
  // now a slot a platform administrator sets, resolved live.
  const heroSlot = (settings.homeSlots ?? []).find((s) => s.position === 'hero' && s.active);
  const heroOffering = heroSlot?.offeringSlug
    ? await Offering.findOne({ ...visible, slug: heroSlot.offeringSlug }, CARD)
    : null;
  const heroMedia = heroSlot?.mediaId ? await MediaAsset.findById(heroSlot.mediaId, 'storageKey alt') : null;

  res.json({
    success: true,
    data: {
      outcomes: outcomes.map((o) => ({ ...o, count: oc[o.slug]?.count ?? 0, fromPrice: oc[o.slug]?.from ?? null })),
      hero: heroOffering
        ? {
            headline: heroSlot.headline,
            blurb: heroSlot.blurb,
            image: heroMedia ? `/api/media/file/${heroMedia.storageKey}` : null,
            imageAlt: heroMedia?.alt,
            offering: (await withChurch([heroOffering]))[0],
          }
        : null,
      featured: await withChurch(featured),
      picks: await withChurch(picks),
      letters: await withChurch(letters),
      churches,
      demoMode: settings.demoMode !== false,
      totals: {
        listings: totals[0]?.listings ?? 0,
        issued: totals[0]?.issued ?? 0,
        churches: churches.length,
        countries: new Set(churches.map((c) => c.country)).size,
        courses: courseCount,
      },
    },
  });
});

/** One search across everything a church issues, plus the churches themselves. */
export const search = asyncHandler(async (req, res) => {
  const term = String(req.query.q ?? '').trim();
  const { outcome, church, acquisition, destination, maxPrice, sort = 'recommended', page = '1', limit = '18' } = req.query;

  const base = await live();
  const filter = { ...base };
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
    Offering.aggregate([{ $match: base }, { $group: { _id: '$outcome', count: { $sum: 1 } } }]),
    Offering.aggregate([{ $match: base }, { $group: { _id: '$churchSlug', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Offering.aggregate([{ $match: base }, { $group: { _id: '$acquisition', count: { $sum: 1 } } }]),
    term
      ? Church.find(
          {
            status: 'published',
            ...(await publicFilter()),
            $or: [{ name: new RegExp(term, 'i') }, { city: new RegExp(term, 'i') }, { country: new RegExp(term, 'i') }, { specialties: new RegExp(term, 'i') }],
          },
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

/** Typeahead. Outcomes and church names first — that is how people search here. */
export const suggest = asyncHandler(async (req, res) => {
  const term = String(req.query.q ?? '').trim();
  if (term.length < 2) return res.json({ success: true, data: { outcomes: [], offerings: [], churches: [] } });

  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const visible = await live();

  const [offeringHits, churchHits] = await Promise.all([
    Offering.find(
      { ...visible, $or: [{ title: rx }, { 'award.title': rx }, { 'letter.destinationCity': rx }] },
      'slug title churchSlug outcome price fee type',
    ).sort(RANK).limit(5),
    Church.find(
      { status: 'published', ...(await publicFilter()), $or: [{ name: rx }, { city: rx }, { country: rx }] },
      'slug name shortName monogram country',
    ).limit(4),
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

/**
 * The church's public page, rendered from the blocks it manages. Sections that
 * curate themselves — what it issues, what it teaches, who teaches — read live
 * data, so a church that publishes something new never has to remember to add
 * it here as well.
 */
export const churchDetail = asyncHandler(async (req, res) => {
  const church = await Church.findOne({ slug: req.params.slug });
  if (!church || church.status !== 'published') {
    return res.status(404).json({ success: false, message: 'That church does not exist.' });
  }
  // publicFilter() is {} while demo mode is on, and excludes demo rows when it
  // is off — so a demonstration church becomes unreachable by URL, not merely
  // unlinked.
  const visibility = await publicFilter();
  if (church.demo && visibility.demo) {
    return res.status(404).json({ success: false, message: 'That church does not exist.' });
  }

  const visible = await live();
  const [listings, courses, resources, faculty, gallery] = await Promise.all([
    Offering.find({ ...visible, churchSlug: church.slug }, CARD).sort(RANK),
    Course.find(
      { ...visible, churchSlug: church.slug },
      'slug title subtitle coverImage totalMinutes lectureCount level price rating ratingCount',
    ).sort({ learners: -1 }),
    Resource.find({ status: 'published', churchSlug: church.slug }, 'slug title subtitle kind coverImage price pages durationMinutes').limit(12),
    Instructor.find({ churchSlug: church.slug }),
    church.galleryMediaIds?.length ? MediaAsset.find({ _id: { $in: church.galleryMediaIds } }, 'storageKey alt filename') : [],
  ]);

  const byOutcome = {};
  for (const l of listings) (byOutcome[l.outcome] ??= []).push(l);

  const sections = visibleSections(church, {
    offerings: listings.length,
    courses: courses.length,
    resources: resources.length,
    faculty: faculty.length,
  });

  const [followers, mine] = await Promise.all([
    Follow.countDocuments({ churchSlug: church.slug }),
    req.user ? Follow.exists({ userId: req.user._id, churchSlug: church.slug }) : null,
  ]);

  res.json({
    success: true,
    data: {
      church,
      followers,
      following: Boolean(mine),
      sections,
      listings: await withChurch(listings),
      byOutcome: Object.entries(byOutcome).map(([slug, items]) => ({
        outcome: outcomeBySlug[slug] ?? { slug, name: slug },
        count: items.length,
      })),
      courses,
      resources,
      faculty,
      gallery: gallery.map((m) => ({ id: m._id, url: `/api/media/file/${m.storageKey}`, alt: m.alt, filename: m.filename })),
      donations: church.donations?.enabled
        ? {
            enabled: true,
            headline: church.donations.headline,
            blurb: church.donations.blurb,
            causes: (church.donations.causes ?? []).filter((c) => c.active),
            suggestedAmounts: church.donations.suggestedAmounts,
          }
        : { enabled: false },
    },
  });
});

export const listChurches = asyncHandler(async (req, res) => {
  const { q, region, country } = req.query;
  const filter = { status: 'published', ...(await publicFilter()) };
  if (region) filter.region = region;
  if (country) filter.country = country;
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { tagline: rx }, { city: rx }, { country: rx }, { specialties: rx }];
  }

  const base = { status: 'published', ...(await publicFilter()) };
  const [docs, regions, counts, follows] = await Promise.all([
    Church.find(filter).sort({ 'stats.credentialsIssued': -1 }),
    Church.aggregate([{ $match: base }, { $group: { _id: '$region', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Offering.aggregate([{ $match: await live() }, { $group: { _id: '$churchSlug', listings: { $sum: 1 }, from: { $min: '$price' } } }]),
    Follow.aggregate([{ $group: { _id: '$churchSlug', n: { $sum: 1 } } }]),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c._id, c]));
  const followerBy = Object.fromEntries(follows.map((f) => [f._id, f.n]));

  res.json({
    success: true,
    data: {
      churches: docs.map((c) => ({
        ...c.toObject(),
        listings: by[c.slug]?.listings ?? 0,
        fromPrice: by[c.slug]?.from ?? null,
        followers: followerBy[c.slug] ?? 0,
      })),
      regions: regions.map((r) => ({ value: r._id, count: r.count })),
    },
  });
});

export const listResources = asyncHandler(async (req, res) => {
  const { q, church, kind, page = '1', limit = '18' } = req.query;
  const filter = { status: 'published', ...(await publicFilter()) };
  if (church) filter.churchSlug = church;
  if (kind) filter.kind = kind;
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { subtitle: rx }, { authorName: rx }, { tags: rx }];
  }

  const perPage = Math.min(Number(limit) || 18, 48);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const [docs, total] = await Promise.all([
    Resource.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage),
    Resource.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { resources: await withChurch(docs), total, page: Number(page) || 1, pages: Math.ceil(total / perPage) },
  });
});

export const resourceDetail = asyncHandler(async (req, res) => {
  const resource = await Resource.findOne({ slug: req.params.slug, status: 'published' });
  if (!resource) return res.status(404).json({ success: false, message: 'That is not available.' });

  const [church, alsoFrom] = await Promise.all([
    Church.findOne({ slug: resource.churchSlug }, 'slug name shortName monogram city country verified'),
    Resource.find({ churchSlug: resource.churchSlug, slug: { $ne: resource.slug }, status: 'published' }).limit(4),
  ]);

  res.json({ success: true, data: { resource, church, alsoFrom } });
});

export const reviewsFor = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Review.find({ courseSlug: req.params.slug }).sort({ helpful: -1 }) });
});
