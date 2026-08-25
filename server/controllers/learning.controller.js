import { asyncHandler } from '../middleware/asyncHandler.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Credential } from '../models/Credential.js';
import { Enrollment } from '../models/Enrollment.js';
import { Offering } from '../models/Offering.js';
import { settle, settleAll } from './passport.controller.js';

const lectureIds = (course) => course.curriculum.flatMap((s) => s.lectures.map((l) => `${s.id}/${l.id}`));

export const dashboard = asyncHandler(async (req, res) => {
  await settleAll(req.user._id);

  const [enrollments, credentials, churches] = await Promise.all([
    Enrollment.find({ userId: req.user._id }).sort({ updatedAt: -1 }),
    Credential.find({ userId: req.user._id }).sort({ createdAt: -1 }),
    Church.find({}, 'slug name shortName monogram verified'),
  ]);

  const courseSlugs = enrollments.map((e) => e.courseSlug).filter(Boolean);
  const [courses, offerings] = await Promise.all([
    Course.find(
      { slug: { $in: courseSlugs } },
      'slug title subtitle coverImage coverAlt churchSlug totalMinutes lectureCount level category',
    ),
    Offering.find({ slug: { $in: credentials.map((c) => c.offeringSlug).filter(Boolean) } },
      'slug title type outcome coverImage price requires award letter churchSlug'),
  ]);

  const courseBy = Object.fromEntries(courses.map((c) => [c.slug, c]));
  const churchBy = Object.fromEntries(churches.map((c) => [c.slug, c]));
  const offeringBy = Object.fromEntries(offerings.map((o) => [o.slug, o]));

  const inProgress = enrollments
    .filter((e) => e.courseSlug && courseBy[e.courseSlug])
    .map((e) => ({ enrollment: e, course: courseBy[e.courseSlug], church: churchBy[e.churchSlug] ?? null }));

  // What the buyer is actually waiting on. This is the top of the dashboard,
  // because the credential is what they bought.
  const pending = credentials
    .filter((c) => c.status !== 'issued')
    .map((c) => ({
      credential: c,
      offering: offeringBy[c.offeringSlug] ?? null,
      church: churchBy[c.churchSlug] ?? null,
      blockers: (c.outstanding ?? []).map((t) =>
        t === 'assessment'
          ? { kind: 'assessment' }
          : t.startsWith('course:')
            ? { kind: 'course', slug: t.slice(7), course: courseBy[t.slice(7)] ?? null, progress: enrollments.find((e) => e.courseSlug === t.slice(7))?.progress ?? 0 }
            : { kind: 'credential', slug: t.slice(11), offering: offeringBy[t.slice(11)] ?? null },
      ),
    }));

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
    // Which credential this coursework is standing in the way of.
    Credential.find({ userId: req.user._id, outstanding: `course:${course.slug}` }, 'credentialId title status offeringSlug'),
  ]);

  res.json({ success: true, data: { course, church, enrollment, unlocks } });
});

export const setProgress = asyncHandler(async (req, res) => {
  const { lectureId, completed = true } = req.body ?? {};
  if (!lectureId) return res.status(400).json({ success: false, message: 'Which lesson?' });

  const course = await Course.findOne({ slug: req.params.slug });
  if (!course) return res.status(404).json({ success: false, message: 'That course does not exist.' });

  const enrollment = await Enrollment.findOne({ userId: req.user._id, courseSlug: course.slug });
  if (!enrollment) return res.status(403).json({ success: false, message: 'You do not have access to this course.' });

  const all = lectureIds(course);
  if (!all.includes(lectureId)) {
    return res.status(400).json({ success: false, message: 'That lesson is not part of this course.' });
  }

  const done = new Set(enrollment.completedLectures);
  if (completed) done.add(lectureId);
  else done.delete(lectureId);

  enrollment.completedLectures = [...done];
  enrollment.lastLectureId = lectureId;
  enrollment.progress = Math.round((done.size / all.length) * 100);

  const finished = enrollment.progress === 100;
  enrollment.status = finished ? 'completed' : 'active';
  enrollment.completedAt = finished ? (enrollment.completedAt ?? new Date()) : undefined;
  await enrollment.save();

  // Finishing coursework may be the last thing a credential was waiting on.
  let settled = [];
  if (finished) {
    const waiting = await Credential.find({ userId: req.user._id, outstanding: `course:${course.slug}` });
    for (const c of waiting) settled.push(await settle(req.user._id, c));
  }

  res.json({
    success: true,
    data: {
      enrollment,
      justCompleted: finished,
      settled: settled.map((c) => ({ credentialId: c.credentialId, title: c.title, status: c.status, outstanding: c.outstanding })),
    },
  });
});

/** What the signed-in buyer already owns, for buy-button states across the site. */
export const entitlements = asyncHandler(async (req, res) => {
  const [enrollments, credentials] = await Promise.all([
    Enrollment.find({ userId: req.user._id }, 'courseSlug progress status'),
    Credential.find({ userId: req.user._id }, 'offeringSlug status credentialId'),
  ]);
  res.json({
    success: true,
    data: {
      courses: enrollments.filter((e) => e.courseSlug).map((e) => ({ slug: e.courseSlug, progress: e.progress, status: e.status })),
      offerings: credentials.filter((c) => c.offeringSlug).map((c) => ({ slug: c.offeringSlug, status: c.status, credentialId: c.credentialId })),
    },
  });
});

/** Full course catalogue — still browsable in its own right. */
export const listCourses = asyncHandler(async (req, res) => {
  const { q, category, level, church, sort = 'popular', page = '1', limit = '12' } = req.query;
  const filter = {};
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

  const CARD = 'slug title subtitle churchSlug category level price compareAtPrice coverImage coverAlt rating ratingCount learners totalMinutes lectureCount bestseller';
  const [docs, total, cats, levels, byChurch] = await Promise.all([
    Course.find(filter, CARD).sort(sorts[sort] ?? sorts.popular).skip(skip).limit(perPage),
    Course.countDocuments(filter),
    Course.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Course.aggregate([{ $group: { _id: '$level', count: { $sum: 1 } } }]),
    Course.aggregate([{ $group: { _id: '$churchSlug', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
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
  if (!course) return res.status(404).json({ success: false, message: 'That course does not exist.' });

  const { Instructor } = await import('../models/Instructor.js');
  const { Review } = await import('../models/Review.js');

  const [church, instructors, reviews, unlocks] = await Promise.all([
    Church.findOne({ slug: course.churchSlug }),
    Instructor.find({ slug: { $in: course.instructorSlugs } }),
    Review.find({ courseSlug: course.slug }).sort({ helpful: -1 }),
    // Credentials that name this course as a requirement. The reason to take it.
    Offering.find({ 'requires.courses': course.slug, published: true },
      'slug title type outcome price compareAtPrice churchSlug coverImage award.title badge'),
  ]);

  const breakdown = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((r) => r.rating === stars).length }));

  res.json({ success: true, data: { course, church, instructors, reviews, reviewBreakdown: breakdown, unlocks } });
});
