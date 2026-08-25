import { asyncHandler } from '../middleware/asyncHandler.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Credential } from '../models/Credential.js';
import { Enrollment } from '../models/Enrollment.js';
import { Pathway } from '../models/Pathway.js';

const lectureIds = (course) => course.curriculum.flatMap((s) => s.lectures.map((l) => `${s.id}/${l.id}`));

/** Everything the learner dashboard needs in one call. */
export const dashboard = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ userId: req.user._id }).sort({ updatedAt: -1 });

  const courseSlugs = enrollments.filter((e) => e.kind === 'course').map((e) => e.courseSlug);
  const pathwaySlugs = enrollments.filter((e) => e.kind === 'pathway').map((e) => e.pathwaySlug);

  const [courses, pathwayDocs, churches, credentials] = await Promise.all([
    Course.find({ slug: { $in: courseSlugs } }, 'slug title subtitle coverImage coverAlt churchSlug totalMinutes lectureCount level category certificate'),
    Pathway.find({ slug: { $in: pathwaySlugs } }),
    Church.find({}, 'slug name shortName monogram verified'),
    Credential.find({ userId: req.user._id }).sort({ createdAt: -1 }),
  ]);

  const courseBySlug = Object.fromEntries(courses.map((c) => [c.slug, c]));
  const churchBySlug = Object.fromEntries(churches.map((c) => [c.slug, c]));

  const inProgress = enrollments
    .filter((e) => e.kind === 'course' && courseBySlug[e.courseSlug])
    .map((e) => ({
      enrollment: e,
      course: courseBySlug[e.courseSlug],
      church: churchBySlug[e.churchSlug] ?? null,
    }));

  const pathwayProgress = enrollments
    .filter((e) => e.kind === 'pathway')
    .map((e) => {
      const pathway = pathwayDocs.find((p) => p.slug === e.pathwaySlug);
      const steps = (pathway?.steps ?? []).filter((s) => s.courseSlug);
      const done = steps.filter((s) => {
        const ce = enrollments.find((x) => x.courseSlug === s.courseSlug);
        return ce?.status === 'completed';
      }).length;
      return {
        enrollment: e,
        pathway,
        church: churchBySlug[e.churchSlug] ?? null,
        coursesDone: done,
        coursesTotal: steps.length,
      };
    })
    .filter((p) => p.pathway);

  res.json({
    success: true,
    data: {
      courses: inProgress,
      pathways: pathwayProgress,
      credentials,
      stats: {
        enrolled: inProgress.length,
        completed: inProgress.filter((c) => c.enrollment.status === 'completed').length,
        credentials: credentials.filter((c) => c.status === 'issued').length,
        minutes: inProgress.reduce((n, c) => n + (c.course.totalMinutes ?? 0), 0),
      },
    },
  });
});

/** The course player: full curriculum plus this learner's progress. */
export const player = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug });
  if (!course) return res.status(404).json({ success: false, message: 'That course does not exist.' });

  const enrollment = await Enrollment.findOne({ userId: req.user._id, courseSlug: course.slug });
  if (!enrollment) {
    return res.status(403).json({ success: false, message: 'You are not enrolled on this course.' });
  }

  const [church, credential] = await Promise.all([
    Church.findOne({ slug: course.churchSlug }, 'slug name shortName monogram verified city country'),
    Credential.findOne({ userId: req.user._id, courseSlug: course.slug }),
  ]);

  res.json({ success: true, data: { course, church, enrollment, credential } });
});

/** Mark a lecture complete or incomplete and recompute progress. */
export const setProgress = asyncHandler(async (req, res) => {
  const { lectureId, completed = true } = req.body ?? {};
  if (!lectureId) return res.status(400).json({ success: false, message: 'Which lecture?' });

  const course = await Course.findOne({ slug: req.params.slug });
  if (!course) return res.status(404).json({ success: false, message: 'That course does not exist.' });

  const enrollment = await Enrollment.findOne({ userId: req.user._id, courseSlug: course.slug });
  if (!enrollment) return res.status(403).json({ success: false, message: 'You are not enrolled on this course.' });

  const all = lectureIds(course);
  if (!all.includes(lectureId)) {
    return res.status(400).json({ success: false, message: 'That lecture is not part of this course.' });
  }

  const done = new Set(enrollment.completedLectures);
  if (completed) done.add(lectureId);
  else done.delete(lectureId);

  enrollment.completedLectures = [...done];
  enrollment.lastLectureId = lectureId;
  enrollment.progress = Math.round((done.size / all.length) * 100);

  const finished = enrollment.progress === 100;
  enrollment.status = finished ? 'completed' : 'active';
  enrollment.completedAt = finished ? enrollment.completedAt ?? new Date() : undefined;
  await enrollment.save();

  // Finishing the course issues the credential it carries.
  let credential = await Credential.findOne({ userId: req.user._id, courseSlug: course.slug });
  if (finished && credential && credential.status === 'in-progress') {
    credential.status = 'issued';
    credential.issuedAt = new Date();
    await credential.save();
  }

  res.json({ success: true, data: { enrollment, credential, justCompleted: finished } });
});

/** The Digital Minister Passport. */
export const passport = asyncHandler(async (req, res) => {
  const credentials = await Credential.find({ userId: req.user._id }).sort({ status: 1, issuedAt: -1 });
  const churches = await Church.find({}, 'slug name shortName monogram verified city country');
  const byslug = Object.fromEntries(churches.map((c) => [c.slug, c]));

  res.json({
    success: true,
    data: {
      holder: req.user.toPublic(),
      credentials: credentials.map((c) => ({ ...c.toObject(), church: byslug[c.churchSlug] ?? null })),
      counts: {
        issued: credentials.filter((c) => c.status === 'issued').length,
        inProgress: credentials.filter((c) => c.status === 'in-progress').length,
      },
    },
  });
});

/** Public credential verification. */
export const verifyCredential = asyncHandler(async (req, res) => {
  const credential = await Credential.findOne({ verifyCode: req.params.code.toUpperCase() });
  if (!credential || credential.status !== 'issued') {
    return res.status(404).json({ success: false, message: 'No issued credential matches that code.' });
  }
  const church = await Church.findOne({ slug: credential.churchSlug }, 'slug name shortName city country verified');
  res.json({
    success: true,
    data: {
      credentialId: credential.credentialId,
      title: credential.title,
      holderName: credential.holderName,
      kind: credential.kind,
      issuedAt: credential.issuedAt,
      church,
    },
  });
});

/** Which of these slugs does the signed-in learner already own? */
export const entitlements = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ userId: req.user._id }, 'kind courseSlug pathwaySlug progress status');
  res.json({
    success: true,
    data: {
      courses: enrollments.filter((e) => e.courseSlug).map((e) => ({ slug: e.courseSlug, progress: e.progress, status: e.status })),
      pathways: enrollments.filter((e) => e.pathwaySlug).map((e) => ({ slug: e.pathwaySlug, progress: e.progress, status: e.status })),
    },
  });
});
