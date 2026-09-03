import { asyncHandler } from '../middleware/asyncHandler.js';
import { lectureKeys } from '../lib/derive.js';
import { advanceAllFor } from '../lib/workflow.js';
import { Application } from '../models/Application.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Credential } from '../models/Credential.js';
import { Enrollment } from '../models/Enrollment.js';
import { Offering } from '../models/Offering.js';
import { publicFilter } from '../lib/visibility.js';

export const dashboard = asyncHandler(async (req, res) => {
  await advanceAllFor(req.user._id);

  const [enrollments, credentials, applications, churches] = await Promise.all([
    Enrollment.find({ userId: req.user._id }).sort({ updatedAt: -1 }),
    Credential.find({ userId: req.user._id }).sort({ issuedAt: -1 }),
    Application.find({ userId: req.user._id, status: { $nin: ['issued', 'withdrawn', 'declined'] } }).sort({ updatedAt: -1 }),
    Church.find({}, 'slug name shortName monogram verified'),
  ]);

  const courseSlugs = enrollments.map((e) => e.courseSlug).filter(Boolean);
  const offeringSlugs = [...new Set([...credentials, ...applications].map((d) => d.offeringSlug).filter(Boolean))];

  const [courses, offerings] = await Promise.all([
    Course.find(
      { slug: { $in: courseSlugs } },
      'slug title subtitle coverImage coverAlt churchSlug totalMinutes lectureCount level category',
    ),
    Offering.find(
      { slug: { $in: offeringSlugs } },
      'slug title type outcome coverImage price fee requires award letter churchSlug',
    ),
  ]);

  const courseBy = Object.fromEntries(courses.map((c) => [c.slug, c]));
  const churchBy = Object.fromEntries(churches.map((c) => [c.slug, c]));
  const offeringBy = Object.fromEntries(offerings.map((o) => [o.slug, o]));
  const progressBy = Object.fromEntries(enrollments.filter((e) => e.courseSlug).map((e) => [e.courseSlug, e]));

  const inProgress = enrollments
    .filter((e) => e.courseSlug && courseBy[e.courseSlug])
    .map((e) => ({ enrollment: e, course: courseBy[e.courseSlug], church: churchBy[e.churchSlug] ?? null }));

  // What the applicant is actually waiting on. This leads the dashboard,
  // because the outstanding step is the only thing they can act on today.
  const pending = applications.map((a) => {
    const outstanding = (a.steps ?? []).filter((s) => s.status !== 'complete' && s.status !== 'waived');
    return {
      reference: a.reference,
      status: a.status,
      offeringSlug: a.offeringSlug,
      offeringTitle: a.offeringTitle,
      offering: offeringBy[a.offeringSlug] ?? null,
      church: churchBy[a.churchSlug] ?? null,
      infoRequest: a.infoRequest?.resolvedAt ? null : a.infoRequest,
      steps: outstanding.map((s) => ({
        key: s.key,
        type: s.type,
        label: s.label,
        detail: s.detail,
        status: s.status,
        course: s.meta?.courseSlug ? courseBy[s.meta.courseSlug] ?? null : null,
        progress: s.meta?.courseSlug ? progressBy[s.meta.courseSlug]?.progress ?? 0 : undefined,
        offering: s.meta?.offeringSlug ? offeringBy[s.meta.offeringSlug] ?? null : null,
        meta: s.meta,
      })),
    };
  });

  res.json({
    success: true,
    data: {
      pending,
      courses: inProgress,
      credentials: credentials.map((c) => ({ ...c.toObject(), church: churchBy[c.churchSlug] ?? null })),
      stats: {
        issued: credentials.filter((c) => c.status === 'issued').length,
        waiting: pending.length,
        courses: inProgress.length,
        completed: inProgress.filter((c) => c.enrollment.status === 'completed').length,
      },
    },
  });
});

export const player = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug });
  if (!course) return res.status(404).json({ success: false, message: 'That course does not exist.' });

  const enrollment = await Enrollment.findOne({ userId: req.user._id, courseSlug: course.slug });
  if (!enrollment) return res.status(403).json({ success: false, message: 'You do not have access to this course.' });

  const [church, unlocks] = await Promise.all([
    Church.findOne({ slug: course.churchSlug }, 'slug name shortName monogram verified city country'),
    // Which applications this coursework is standing in the way of.
    Application.find(
      { userId: req.user._id, 'steps.meta.courseSlug': course.slug, status: { $nin: ['issued', 'withdrawn', 'declined'] } },
      'reference offeringSlug offeringTitle status',
    ),
  ]);

  res.json({ success: true, data: { course, church, enrollment, unlocks } });
});

export const setProgress = asyncHandler(async (req, res) => {
  const { lectureKey, completed = true } = req.body ?? {};
  if (!lectureKey) return res.status(400).json({ success: false, message: 'Which lesson?' });

  const course = await Course.findOne({ slug: req.params.slug });
  if (!course) return res.status(404).json({ success: false, message: 'That course does not exist.' });

  const enrollment = await Enrollment.findOne({ userId: req.user._id, courseSlug: course.slug });
  if (!enrollment) return res.status(403).json({ success: false, message: 'You do not have access to this course.' });

  const all = lectureKeys(course);
  if (!all.includes(lectureKey)) {
    return res.status(400).json({ success: false, message: 'That lesson is not part of this course.' });
  }

  const done = new Set(enrollment.completedLectures);
  if (completed) done.add(lectureKey);
  else done.delete(lectureKey);

  enrollment.completedLectures = [...done];
  enrollment.lastLectureKey = lectureKey;
  enrollment.progress = Math.round((done.size / all.length) * 100);

  const finished = enrollment.progress === 100;
  const justCompleted = finished && enrollment.status !== 'completed';
  enrollment.status = finished ? 'completed' : 'active';
  enrollment.completedAt = finished ? enrollment.completedAt ?? new Date() : undefined;
  if (finished && course.creditUnits) enrollment.creditUnitsEarned = course.creditUnits;
  await enrollment.save();

  // Finishing coursework may be the last thing an application was waiting on.
  if (justCompleted) await advanceAllFor(req.user._id);

  const advanced = justCompleted
    ? await Application.find(
        { userId: req.user._id, 'steps.meta.courseSlug': course.slug },
        'reference offeringTitle status steps',
      )
    : [];

  res.json({
    success: true,
    data: {
      enrollment,
      justCompleted,
      advanced: advanced.map((a) => ({
        reference: a.reference,
        title: a.offeringTitle,
        status: a.status,
        outstanding: (a.steps ?? []).filter((s) => s.status !== 'complete' && s.status !== 'waived').length,
      })),
    },
  });
});

/** What the signed-in person already holds, for button states across the site. */
export const entitlements = asyncHandler(async (req, res) => {
  const [enrollments, credentials, applications] = await Promise.all([
    Enrollment.find({ userId: req.user._id }, 'courseSlug resourceSlug progress status'),
    Credential.find({ userId: req.user._id }, 'offeringSlug status credentialId'),
    Application.find(
      { userId: req.user._id, status: { $nin: ['withdrawn', 'declined', 'expired'] } },
      'offeringSlug status reference',
    ),
  ]);

  res.json({
    success: true,
    data: {
      courses: enrollments.filter((e) => e.courseSlug).map((e) => ({ slug: e.courseSlug, progress: e.progress, status: e.status })),
      resources: enrollments.filter((e) => e.resourceSlug).map((e) => ({ slug: e.resourceSlug })),
      credentials: credentials.map((c) => ({ slug: c.offeringSlug, status: c.status, credentialId: c.credentialId })),
      applications: applications.map((a) => ({ slug: a.offeringSlug, status: a.status, reference: a.reference })),
    },
  });
});

/** Full course catalogue — still browsable in its own right. */
export const listCourses = asyncHandler(async (req, res) => {
  const { q, category, level, church, sort = 'popular', page = '1', limit = '12' } = req.query;
  const filter = { status: 'published', ...(await publicFilter()) };
  if (category) filter.category = category;
  if (level) filter.level = level;
  if (church) filter.churchSlug = church;
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { subtitle: rx }, { tags: rx }, { category: rx }];
  }

  const sorts = { popular: { learners: -1 }, rating: { rating: -1 }, newest: { createdAt: -1 }, 'price-asc': { price: 1 }, 'price-desc': { price: -1 } };
  const perPage = Math.min(Number(limit) || 12, 48);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const CARD = 'slug title subtitle churchSlug category level price compareAtPrice coverImage coverAlt rating ratingCount learners totalMinutes lectureCount bestseller demo';
  const [docs, total, cats, levels, byChurch] = await Promise.all([
    Course.find(filter, CARD).sort(sorts[sort] ?? sorts.popular).skip(skip).limit(perPage),
    Course.countDocuments(filter),
    Course.aggregate([{ $match: filter }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Course.aggregate([{ $match: filter }, { $group: { _id: '$level', count: { $sum: 1 } } }]),
    Course.aggregate([{ $match: filter }, { $group: { _id: '$churchSlug', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
  ]);

  const churches = await Church.find({}, 'slug name shortName monogram verified');
  const by = Object.fromEntries(churches.map((c) => [c.slug, c]));

  res.json({
    success: true,
    data: {
      courses: docs.map((d) => ({ ...d.toObject(), church: by[d.churchSlug] ?? null })),
      total,
      page: Number(page) || 1,
      pages: Math.ceil(total / perPage),
      facets: {
        categories: cats.map((c) => ({ value: c._id, count: c.count })),
        levels: levels.map((l) => ({ value: l._id, count: l.count })),
        churches: byChurch.map((c) => ({ value: c._id, label: by[c._id]?.shortName ?? c._id, count: c.count })),
      },
    },
  });
});

export const courseDetail = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug });
  if (!course || course.status !== 'published') {
    return res.status(404).json({ success: false, message: 'That course does not exist.' });
  }

  const { Instructor } = await import('../models/Instructor.js');
  const { Review } = await import('../models/Review.js');

  const [church, instructors, reviews, unlocks] = await Promise.all([
    Church.findOne({ slug: course.churchSlug }),
    Instructor.find({ slug: { $in: course.instructorSlugs } }),
    Review.find({ courseSlug: course.slug }).sort({ helpful: -1 }),
    // Credentials that name this course as a requirement. The reason to take it.
    Offering.find(
      {
        status: 'published',
        $or: [{ 'requires.courses': course.slug }, { 'requires.courseGroups.courseSlugs': course.slug }],
      },
      'slug title type outcome price fee churchSlug coverImage award.title acquisition',
    ),
  ]);

  const breakdown = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((r) => r.rating === stars).length }));

  res.json({ success: true, data: { course, church, instructors, reviews, reviewBreakdown: breakdown, unlocks } });
});
