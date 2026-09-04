import { asyncHandler } from '../middleware/asyncHandler.js';
import { audit } from '../lib/audit.js';
import {
  acquisitionFor, assignCurriculumKeys, defaultOutcomeForType, isCredentialType, isOfferingType, slugify,
  validateOfferingForPublish,
} from '../lib/derive.js';
import { shortId } from '../lib/ids.js';
import { dependantsOfCourse, dependantsOfOffering, findRequirementCycle, proposeSlug } from '../lib/slugs.js';
import { Assessment } from '../models/Assessment.js';
import { Course } from '../models/Course.js';
import { Interview } from '../models/Interview.js';
import { InterviewSlot } from '../models/InterviewSlot.js';
import { Post } from '../models/Post.js';
import { Offering } from '../models/Offering.js';
import { Resource } from '../models/Resource.js';

/**
 * What a church writes: what it issues, what it requires, what it teaches, and
 * what it asks in a paper.
 *
 * Two rules run through all of it. A slug is frozen at first publish, because
 * an offering at one church names the courses and credentials of another purely
 * by slug — a rename would break every listing pointing at it. And a credential
 * cannot be published without a church decision behind it.
 */

/* ── offerings ─────────────────────────────────────────────────────────── */

const OFFERING_FIELDS = [
  'type', 'tier', 'outcome', 'title', 'subtitle', 'description', 'disclosure', 'requires',
  'assessmentSlug', 'applicationForm', 'fee', 'renewal', 'creditValue', 'curriculumOutline',
  'capacity', 'intake', 'letter', 'award', 'coverImage', 'coverAlt', 'coverMediaId',
];

export const listOfferings = asyncHandler(async (req, res) => {
  const offerings = await Offering.find({ churchSlug: req.church.slug }).sort({ status: 1, updatedAt: -1 }).lean();

  res.json({
    success: true,
    data: offerings.map((o) => ({
      slug: o.slug,
      title: o.title,
      type: o.type,
      tier: o.tier,
      outcome: o.outcome,
      status: o.status,
      acquisition: o.acquisition,
      fee: o.fee?.amount ?? o.price,
      issuedCount: o.issuedCount,
      applicationCount: o.applicationCount,
      publishedAt: o.publishedAt,
      updatedAt: o.updatedAt,
      problems: validateOfferingForPublish(o),
    })),
  });
});

export const getOffering = asyncHandler(async (req, res) => {
  const offering = await Offering.findOne({ slug: req.params.slug, churchSlug: req.church.slug });
  if (!offering) return res.status(404).json({ success: false, message: 'That listing was not found.' });

  const [assessments, courses, dependants] = await Promise.all([
    Assessment.find({ churchSlug: req.church.slug }, 'slug title status questions passMark').lean(),
    Course.find({ churchSlug: req.church.slug }, 'slug title status creditUnits').lean(),
    dependantsOfOffering(Offering, offering.slug),
  ]);

  res.json({
    success: true,
    data: {
      offering: offering.toObject(),
      problems: validateOfferingForPublish(offering),
      // Everything at other churches that would break if this went away.
      dependants,
      options: {
        assessments: assessments.map((a) => ({ ...a, questionCount: a.questions?.length ?? 0, questions: undefined })),
        courses,
      },
    },
  });
});

export const createOffering = asyncHandler(async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title) return res.status(400).json({ success: false, message: 'Give the listing a title.' });

  const type = req.body?.type ?? 'certificate';
  if (!isOfferingType(type)) {
    return res.status(400).json({ success: false, message: 'That is not a kind of credential a church can issue.' });
  }

  const slug = await proposeSlug(Offering, title, { churchSlug: req.church.slug });

  const offering = new Offering({
    slug,
    churchSlug: req.church.slug,
    title,
    type,
    // Not asked for at creation: the bucket a listing competes in follows from
    // its kind, and the one type that can sit in two is moved in the builder.
    outcome: defaultOutcomeForType(type),
    price: 0,
    fee: { amount: 0, currency: 'USD', label: 'Application fee' },
    status: 'draft',
    // Anything authored under a demonstration church is demonstration content
    // too, so one switch hides a church and everything it lists.
    demo: Boolean(req.church.demo),
    authoredBy: req.user._id,
  });

  await offering.save();
  await audit(req, { action: 'offering:created', entity: 'Offering', entityId: offering._id, after: { slug, title } });

  res.status(201).json({ success: true, data: offering.toObject() });
});

export const updateOffering = asyncHandler(async (req, res) => {
  const offering = await Offering.findOne({ slug: req.params.slug, churchSlug: req.church.slug });
  if (!offering) return res.status(404).json({ success: false, message: 'That listing was not found.' });

  const before = { title: offering.title, fee: offering.fee?.amount, status: offering.status };

  if (req.body?.type !== undefined && !isOfferingType(req.body.type)) {
    return res.status(400).json({ success: false, message: 'That is not a kind of credential a church can issue.' });
  }

  for (const field of OFFERING_FIELDS) {
    if (req.body?.[field] !== undefined) offering[field] = req.body[field];
  }

  // Changing the kind can strand the bucket it was competing in; the model's
  // pre-save hook corrects that rather than failing the write.

  // Merchandising is the platform's lever, not the church's, and never applies
  // to something that confers standing.
  if (!isCredentialType(offering.type) && req.body?.compareAtPrice !== undefined) {
    offering.compareAtPrice = req.body.compareAtPrice;
  }

  const requested = [
    ...(offering.requires?.credentials ?? []),
    ...(offering.requires?.credentialGroups ?? []).flatMap((g) => g.offeringSlugs ?? []),
  ];

  if (requested.length) {
    const cycle = await findRequirementCycle(Offering, offering.slug, requested);
    if (cycle) {
      return res.status(400).json({
        success: false,
        message: `That would create a loop: ${cycle.join(' → ')}. A credential cannot end up requiring itself.`,
      });
    }
  }

  await offering.save();
  await audit(req, {
    action: 'offering:updated',
    entity: 'Offering',
    entityId: offering._id,
    before,
    after: { title: offering.title, fee: offering.fee?.amount },
  });

  res.json({
    success: true,
    data: { offering: offering.toObject(), problems: validateOfferingForPublish(offering) },
  });
});

export const publishOffering = asyncHandler(async (req, res) => {
  const offering = await Offering.findOne({ slug: req.params.slug, churchSlug: req.church.slug });
  if (!offering) return res.status(404).json({ success: false, message: 'That listing was not found.' });

  if (req.body?.status === 'draft' || req.body?.status === 'archived') {
    if (req.body.status === 'archived') {
      const dependants = await dependantsOfOffering(Offering, offering.slug);
      if (dependants.length && !req.body.force) {
        return res.status(409).json({
          success: false,
          message: `${dependants.length} listing${dependants.length === 1 ? '' : 's'} at other churches require this. Archiving it will block those applications.`,
          data: { dependants },
        });
      }
    }
    offering.status = req.body.status;
    await offering.save();
    return res.json({ success: true, data: { status: offering.status } });
  }

  const problems = validateOfferingForPublish(offering);
  if (problems.length) {
    return res.status(400).json({ success: false, message: problems[0], data: { problems } });
  }

  offering.status = 'published';
  // The slug freezes here. From now on the title is free to change and every
  // requirement pointing at this listing keeps resolving.
  offering.publishedAt = offering.publishedAt ?? new Date();
  await offering.save();

  await audit(req, { action: 'offering:published', entity: 'Offering', entityId: offering._id, after: { slug: offering.slug } });

  // Publishing is itself news to the people who follow this church. Only the
  // first time: republishing after an edit is not a new thing to announce.
  const announced = await Post.findOne({ kind: 'offering', offeringSlug: offering.slug }, '_id');
  if (!announced) {
    await Post.create({
      kind: 'offering',
      authorKind: 'church',
      churchSlug: offering.churchSlug,
      offeringSlug: offering.slug,
      body: offering.summary ?? '',
      images: offering.coverImage ? [{ url: offering.coverImage, alt: offering.coverAlt ?? '' }] : [],
    });
  }

  res.json({ success: true, data: { status: offering.status, slug: offering.slug, publishedAt: offering.publishedAt } });
});

/**
 * A dry run of the checklist a church is composing, before anyone applies.
 *
 * Course and credential requirements are held as slugs, so they are resolved
 * to titles here — a church writing a requirement should see the name of the
 * thing it just picked, not its address.
 */
export const previewRequirements = asyncHandler(async (req, res) => {
  const { evaluate, summarise } = await import('../lib/requirements.js');
  const draft = { ...req.body, requires: req.body?.requires ?? {} };
  const { steps, eligibility } = evaluate(draft, {});

  const courseSlugs = steps.filter((s) => s.meta?.courseSlug).map((s) => s.meta.courseSlug);
  const offeringSlugs = steps.flatMap((s) =>
    s.meta?.group ? s.meta.items ?? [] : s.meta?.offeringSlug ? [s.meta.offeringSlug] : [],
  );

  const [courses, offerings] = await Promise.all([
    Course.find({ slug: { $in: courseSlugs } }, 'slug title').lean(),
    Offering.find({ slug: { $in: offeringSlugs } }, 'slug title churchSlug').lean(),
  ]);
  const courseBy = Object.fromEntries(courses.map((c) => [c.slug, c]));
  const offeringBy = Object.fromEntries(offerings.map((o) => [o.slug, o]));

  res.json({
    success: true,
    data: {
      steps: steps.map((s) => ({
        ...s,
        label: courseBy[s.meta?.courseSlug]?.title ?? offeringBy[s.meta?.offeringSlug]?.title ?? s.label,
        detail: s.meta?.group
          ? [s.detail, (s.meta.items ?? []).map((slug) => offeringBy[slug]?.title ?? courseBy[slug]?.title ?? slug).join(' · ')]
              .filter(Boolean).join(' — ')
          : s.detail,
      })),
      eligibility,
      summary: summarise(steps),
      acquisition: acquisitionFor(draft.requires, draft.type),
      problems: validateOfferingForPublish(draft),
    },
  });
});

/* ── courses ───────────────────────────────────────────────────────────── */

const COURSE_FIELDS = [
  'title', 'subtitle', 'description', 'category', 'subcategory', 'level', 'language', 'tags',
  'price', 'compareAtPrice', 'coverImage', 'coverAlt', 'coverMediaId', 'outcomes', 'requirements',
  'audience', 'includes', 'certificate', 'creditUnits', 'instructorSlugs',
];

export const listCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ churchSlug: req.church.slug }, 'slug title status level lectureCount totalMinutes price creditUnits updatedAt publishedAt').sort({ updatedAt: -1 }).lean();
  res.json({ success: true, data: courses });
});

export const getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug, churchSlug: req.church.slug });
  if (!course) return res.status(404).json({ success: false, message: 'That course was not found.' });

  const dependants = await dependantsOfCourse(Offering, Course, course.slug);
  res.json({ success: true, data: { course: course.toObject(), dependants } });
});

export const createCourse = asyncHandler(async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title) return res.status(400).json({ success: false, message: 'Give the course a title.' });

  const course = new Course({
    slug: await proposeSlug(Course, title, { churchSlug: req.church.slug }),
    churchSlug: req.church.slug,
    title,
    price: 0,
    status: 'draft',
    demo: Boolean(req.church.demo),
    authoredBy: req.user._id,
    curriculum: [],
  });

  await course.save();
  res.status(201).json({ success: true, data: course.toObject() });
});

export const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug, churchSlug: req.church.slug });
  if (!course) return res.status(404).json({ success: false, message: 'That course was not found.' });

  for (const field of COURSE_FIELDS) {
    if (req.body?.[field] !== undefined) course[field] = req.body[field];
  }

  if (Array.isArray(req.body?.curriculum)) {
    // Keys already on a section or lecture are preserved; anything new gets one.
    // Learner progress is stored against these, so they must survive an edit.
    course.curriculum = assignCurriculumKeys(
      req.body.curriculum.map((section) => ({
        ...section,
        id: section.id ?? (slugify(section.title ?? '') || shortId()),
        lectures: (section.lectures ?? []).map((lecture) => ({
          ...lecture,
          id: lecture.id ?? (slugify(lecture.title ?? '') || shortId()),
        })),
      })),
    );
    course.markModified('curriculum');
  }

  await course.save();
  res.json({ success: true, data: course.toObject() });
});

export const publishCourse = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug, churchSlug: req.church.slug });
  if (!course) return res.status(404).json({ success: false, message: 'That course was not found.' });

  if (req.body?.status === 'draft' || req.body?.status === 'archived') {
    if (req.body.status === 'archived') {
      const dependants = await dependantsOfCourse(Offering, Course, course.slug);
      if (dependants.length && !req.body.force) {
        return res.status(409).json({
          success: false,
          message: `${dependants.length} listing${dependants.length === 1 ? '' : 's'} require this course.`,
          data: { dependants },
        });
      }
    }
    course.status = req.body.status;
    await course.save();
    return res.json({ success: true, data: { status: course.status } });
  }

  if (!course.curriculum?.length) {
    return res.status(400).json({ success: false, message: 'A course needs at least one section before it can publish.' });
  }
  if (!course.lectureCount) {
    return res.status(400).json({ success: false, message: 'A course needs at least one lesson before it can publish.' });
  }

  course.status = 'published';
  course.publishedAt = course.publishedAt ?? new Date();
  await course.save();

  res.json({ success: true, data: { status: course.status, slug: course.slug } });
});

/* ── assessments ───────────────────────────────────────────────────────── */

export const listAssessments = asyncHandler(async (req, res) => {
  const assessments = await Assessment.find({ churchSlug: req.church.slug }).sort({ updatedAt: -1 }).lean();
  res.json({
    success: true,
    data: assessments.map((a) => ({
      ...a,
      questionCount: a.questions?.length ?? 0,
      totalPoints: (a.questions ?? []).reduce((n, q) => n + (q.points ?? 1), 0),
      needsGrading: (a.questions ?? []).some((q) => q.type === 'essay'),
      questions: undefined,
    })),
  });
});

export const getAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findOne({ slug: req.params.slug, churchSlug: req.church.slug });
  if (!assessment) return res.status(404).json({ success: false, message: 'That assessment was not found.' });

  const usedBy = await Offering.find({ assessmentSlug: assessment.slug }, 'slug title status').lean();
  res.json({ success: true, data: { assessment: assessment.toObject(), usedBy } });
});

export const createAssessment = asyncHandler(async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title) return res.status(400).json({ success: false, message: 'Give the paper a title.' });

  const assessment = await Assessment.create({
    slug: await proposeSlug(Assessment, title, { churchSlug: req.church.slug }),
    churchSlug: req.church.slug,
    title,
    status: 'draft',
    demo: Boolean(req.church.demo),
    authoredBy: req.user._id,
    questions: [],
  });

  res.status(201).json({ success: true, data: assessment.toObject() });
});

const ASSESSMENT_FIELDS = [
  'title', 'description', 'instructions', 'drawCount', 'shuffleQuestions', 'shuffleOptions',
  'passMark', 'durationMinutes', 'attemptsAllowed', 'showAnswers',
];

export const updateAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findOne({ slug: req.params.slug, churchSlug: req.church.slug });
  if (!assessment) return res.status(404).json({ success: false, message: 'That assessment was not found.' });

  for (const field of ASSESSMENT_FIELDS) {
    if (req.body?.[field] !== undefined) assessment[field] = req.body[field];
  }

  if (Array.isArray(req.body?.questions)) {
    assessment.questions = req.body.questions.map((q) => ({
      // A key is what an attempt's answers are recorded against, so it must
      // outlive any edit to the question's wording.
      key: q.key ?? shortId(),
      type: q.type ?? 'single',
      prompt: String(q.prompt ?? '').slice(0, 2000),
      help: q.help,
      points: Number.isFinite(q.points) ? Math.max(1, Math.round(q.points)) : 1,
      options: (q.options ?? []).map((o) => String(o).slice(0, 500)),
      answers: (q.answers ?? []).map(Number).filter((n) => Number.isInteger(n) && n >= 0),
      accepted: (q.accepted ?? []).map((a) => String(a).slice(0, 200)),
      rubric: (q.rubric ?? []).map((r) => String(r).slice(0, 500)),
      explanation: q.explanation,
    }));
  }

  await assessment.save();
  res.json({ success: true, data: { assessment: assessment.toObject(), problems: assessmentProblems(assessment) } });
});

const assessmentProblems = (assessment) => {
  const problems = [];
  if (!assessment.questions?.length) problems.push('Add at least one question.');

  assessment.questions?.forEach((q, i) => {
    const n = i + 1;
    if (!q.prompt?.trim()) problems.push(`Question ${n} has no wording.`);

    if (['single', 'multiple', 'true-false'].includes(q.type)) {
      if ((q.options?.length ?? 0) < 2) problems.push(`Question ${n} needs at least two options.`);
      if (!q.answers?.length) problems.push(`Question ${n} has no correct answer marked.`);
      if (q.type !== 'multiple' && (q.answers?.length ?? 0) > 1) {
        problems.push(`Question ${n} is single-answer but has several marked correct.`);
      }
      if (q.answers?.some((a) => a >= (q.options?.length ?? 0))) {
        problems.push(`Question ${n} marks an answer that is not one of its options.`);
      }
    }
    if (q.type === 'short-answer' && !q.accepted?.length) {
      problems.push(`Question ${n} has no accepted answers listed.`);
    }
  });

  if (assessment.drawCount > (assessment.questions?.length ?? 0)) {
    problems.push(`The paper draws ${assessment.drawCount} questions but the bank only holds ${assessment.questions?.length ?? 0}.`);
  }

  return problems;
};

export const publishAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findOne({ slug: req.params.slug, churchSlug: req.church.slug });
  if (!assessment) return res.status(404).json({ success: false, message: 'That assessment was not found.' });

  if (req.body?.status === 'draft' || req.body?.status === 'archived') {
    assessment.status = req.body.status;
    await assessment.save();
    return res.json({ success: true, data: { status: assessment.status } });
  }

  const problems = assessmentProblems(assessment);
  if (problems.length) return res.status(400).json({ success: false, message: problems[0], data: { problems } });

  assessment.status = 'published';
  await assessment.save();
  res.json({ success: true, data: { status: 'published', slug: assessment.slug } });
});

/* ── resources: books and materials ────────────────────────────────────── */

const RESOURCE_FIELDS = [
  'kind', 'title', 'subtitle', 'description', 'authorName', 'coverImage', 'coverAlt', 'coverMediaId',
  'fileMediaIds', 'previewMediaId', 'pages', 'durationMinutes', 'language', 'tags', 'price', 'compareAtPrice',
];

export const listResources = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Resource.find({ churchSlug: req.church.slug }).sort({ updatedAt: -1 }).lean() });
});

export const createResource = asyncHandler(async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title) return res.status(400).json({ success: false, message: 'Give it a title.' });

  const resource = await Resource.create({
    slug: await proposeSlug(Resource, title, { churchSlug: req.church.slug }),
    churchSlug: req.church.slug,
    title,
    price: 0,
    status: 'draft',
    demo: Boolean(req.church.demo),
  });

  res.status(201).json({ success: true, data: resource.toObject() });
});

export const updateResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findOne({ slug: req.params.slug, churchSlug: req.church.slug });
  if (!resource) return res.status(404).json({ success: false, message: 'That was not found.' });

  for (const field of RESOURCE_FIELDS) {
    if (req.body?.[field] !== undefined) resource[field] = req.body[field];
  }
  if (['draft', 'published', 'archived'].includes(req.body?.status)) {
    if (req.body.status === 'published' && !resource.fileMediaIds?.length) {
      return res.status(400).json({ success: false, message: 'Attach the file a buyer receives before publishing.' });
    }
    resource.status = req.body.status;
    if (resource.status === 'published') resource.publishedAt = resource.publishedAt ?? new Date();
  }

  await resource.save();
  res.json({ success: true, data: resource.toObject() });
});

/* ── interview availability ────────────────────────────────────────────── */

export const listSlots = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date();

  const slots = await InterviewSlot.find({ churchSlug: req.church.slug, startsAt: { $gte: from } })
    .sort({ startsAt: 1 })
    .limit(200)
    .lean();

  const interviews = await Interview.find({
    churchSlug: req.church.slug,
    slotId: { $in: slots.map((s) => s._id) },
    status: { $ne: 'cancelled' },
  })
    .populate('userId', 'name avatar')
    .populate('applicationId', 'reference offeringTitle')
    .lean();

  const bySlot = new Map();
  for (const interview of interviews) {
    const list = bySlot.get(String(interview.slotId)) ?? [];
    list.push({
      id: interview._id,
      applicant: interview.userId ? { name: interview.userId.name, avatar: interview.userId.avatar } : null,
      applicationRef: interview.applicationId?.reference,
      offeringTitle: interview.applicationId?.offeringTitle,
      status: interview.status,
      outcome: interview.outcome,
    });
    bySlot.set(String(interview.slotId), list);
  }

  res.json({
    success: true,
    data: slots.map((s) => ({ ...s, bookings: bySlot.get(String(s._id)) ?? [] })),
  });
});

export const createSlots = asyncHandler(async (req, res) => {
  const entries = Array.isArray(req.body?.slots) ? req.body.slots : [req.body];
  const created = [];

  for (const entry of entries.slice(0, 100)) {
    const startsAt = new Date(entry.startsAt);
    const endsAt = new Date(entry.endsAt ?? startsAt.getTime() + (entry.durationMinutes ?? 30) * 60000);

    if (Number.isNaN(startsAt.getTime()) || endsAt <= startsAt) {
      return res.status(400).json({ success: false, message: 'Each slot needs a start and an end after it.' });
    }
    if (startsAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Availability cannot be published in the past.' });
    }

    created.push(
      await InterviewSlot.create({
        churchSlug: req.church.slug,
        offeringSlug: entry.offeringSlug || undefined,
        startsAt,
        endsAt,
        timezone: entry.timezone ?? req.church.timezone,
        capacity: Math.max(1, Math.round(entry.capacity ?? 1)),
        panel: entry.panel ?? [],
        panelNames: entry.panelNames ?? [],
        // Whatever the church already uses. The platform hosts nothing.
        provider: entry.provider ?? 'other',
        joinUrl: entry.joinUrl,
        dialIn: entry.dialIn,
        location: entry.location,
        instructions: entry.instructions,
        createdBy: req.user._id,
      }),
    );
  }

  res.status(201).json({ success: true, data: created });
});

export const updateSlot = asyncHandler(async (req, res) => {
  const slot = await InterviewSlot.findOne({ _id: req.params.id, churchSlug: req.church.slug });
  if (!slot) return res.status(404).json({ success: false, message: 'That slot was not found.' });

  for (const field of ['joinUrl', 'dialIn', 'location', 'instructions', 'provider', 'panelNames']) {
    if (req.body?.[field] !== undefined) slot[field] = req.body[field];
  }
  if (['open', 'closed'].includes(req.body?.status)) slot.status = req.body.status;
  if (Number.isFinite(req.body?.capacity)) {
    slot.capacity = Math.max(slot.bookedCount, Math.round(req.body.capacity));
  }

  await slot.save();
  res.json({ success: true, data: slot.toObject() });
});

export const deleteSlot = asyncHandler(async (req, res) => {
  const slot = await InterviewSlot.findOne({ _id: req.params.id, churchSlug: req.church.slug });
  if (!slot) return res.status(404).json({ success: false, message: 'That slot was not found.' });
  if (slot.bookedCount > 0) {
    return res.status(409).json({
      success: false,
      message: 'Someone has booked this time. Close it to new bookings instead, or reschedule them first.',
    });
  }

  await slot.deleteOne();
  res.json({ success: true, data: { deleted: true } });
});
