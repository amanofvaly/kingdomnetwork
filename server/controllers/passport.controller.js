import { asyncHandler } from '../middleware/asyncHandler.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Credential } from '../models/Credential.js';
import { Enrollment } from '../models/Enrollment.js';
import { Offering } from '../models/Offering.js';
import { paperFor } from '../data/assessments.js';
import { renderDocument } from '../lib/documents.js';

/**
 * Re-check everything a credential is still waiting on, and issue it the moment
 * nothing is outstanding. Called after a course is finished, an assessment is
 * passed, or another credential is issued.
 */
export const settle = async (userId, credential) => {
  if (credential.status === 'issued' || credential.status === 'revoked') return credential;

  const offering = await Offering.findOne({ slug: credential.offeringSlug });
  if (!offering) return credential;

  const outstanding = [];

  if (offering.requires?.courses?.length) {
    const done = await Enrollment.find(
      { userId, courseSlug: { $in: offering.requires.courses }, status: 'completed' },
      'courseSlug',
    );
    const set = new Set(done.map((d) => d.courseSlug));
    for (const c of offering.requires.courses) if (!set.has(c)) outstanding.push(`course:${c}`);
  }

  if (offering.requires?.credentials?.length) {
    const held = await Credential.find(
      { userId, offeringSlug: { $in: offering.requires.credentials }, status: 'issued' },
      'offeringSlug',
    );
    const set = new Set(held.map((h) => h.offeringSlug));
    for (const c of offering.requires.credentials) if (!set.has(c)) outstanding.push(`credential:${c}`);
  }

  // An assessment already passed is recorded on the credential itself.
  if (offering.requires?.assessment?.required && !credential.notes?.includes('assessment:passed')) {
    outstanding.push('assessment');
  }

  credential.outstanding = outstanding;

  if (!outstanding.length) {
    if (offering.requires?.review?.required && credential.status === 'in-progress') {
      credential.status = 'in-review';
    } else if (credential.status !== 'in-review') {
      credential.status = 'issued';
      credential.issuedAt = new Date();
      if (offering.award?.validityMonths) {
        credential.expiresAt = new Date(Date.now() + offering.award.validityMonths * 30 * 24 * 60 * 60 * 1000);
      }
    }
  }

  await credential.save();
  return credential;
};

/** Re-settle everything the user is waiting on. Cheap, and keeps the passport honest. */
export const settleAll = async (userId) => {
  const pending = await Credential.find({ userId, status: { $in: ['in-progress', 'in-review'] } });
  for (const c of pending) await settle(userId, c);
};

export const passport = asyncHandler(async (req, res) => {
  await settleAll(req.user._id);

  const credentials = await Credential.find({ userId: req.user._id }).sort({ issuedAt: -1, createdAt: -1 });
  const offeringSlugs = credentials.map((c) => c.offeringSlug).filter(Boolean);

  const [churches, offerings] = await Promise.all([
    Church.find({}, 'slug name shortName monogram verified city country'),
    Offering.find({ slug: { $in: offeringSlugs } }, 'slug title type outcome coverImage requires award letter price'),
  ]);
  const churchBy = Object.fromEntries(churches.map((c) => [c.slug, c]));
  const offeringBy = Object.fromEntries(offerings.map((o) => [o.slug, o]));

  // Resolve outstanding item slugs into something the interface can render.
  const allCourseSlugs = credentials.flatMap((c) => (c.outstanding ?? []).filter((o) => o.startsWith('course:')).map((o) => o.slice(7)));
  const allCredSlugs = credentials.flatMap((c) => (c.outstanding ?? []).filter((o) => o.startsWith('credential:')).map((o) => o.slice(11)));
  const [courseDocs, credOfferings, enrollments] = await Promise.all([
    Course.find({ slug: { $in: allCourseSlugs } }, 'slug title coverImage totalMinutes lectureCount'),
    Offering.find({ slug: { $in: allCredSlugs } }, 'slug title price churchSlug coverImage'),
    Enrollment.find({ userId: req.user._id }, 'courseSlug progress status'),
  ]);
  const courseBy = Object.fromEntries(courseDocs.map((c) => [c.slug, c]));
  const credBy = Object.fromEntries(credOfferings.map((o) => [o.slug, o]));
  const progressBy = Object.fromEntries(enrollments.map((e) => [e.courseSlug, e]));

  const shaped = credentials.map((c) => ({
    ...c.toObject(),
    church: churchBy[c.churchSlug] ?? null,
    offering: offeringBy[c.offeringSlug] ?? null,
    blockers: (c.outstanding ?? []).map((token) => {
      if (token === 'assessment') return { kind: 'assessment', label: 'Assessment not yet passed' };
      if (token.startsWith('course:')) {
        const slug = token.slice(7);
        return { kind: 'course', slug, course: courseBy[slug] ?? null, progress: progressBy[slug]?.progress ?? 0 };
      }
      const slug = token.slice(11);
      return { kind: 'credential', slug, offering: credBy[slug] ?? null };
    }),
  }));

  res.json({
    success: true,
    data: {
      holder: req.user.toPublic(),
      credentials: shaped,
      counts: {
        issued: shaped.filter((c) => c.status === 'issued').length,
        inReview: shaped.filter((c) => c.status === 'in-review').length,
        inProgress: shaped.filter((c) => c.status === 'in-progress').length,
        letters: shaped.filter((c) => c.kind === 'invitation-letter' && c.status === 'issued').length,
      },
    },
  });
});

/** The issued PDF. Only the holder can download it. */
export const downloadDocument = asyncHandler(async (req, res) => {
  const credential = await Credential.findOne({ credentialId: req.params.id, userId: req.user._id });
  if (!credential) return res.status(404).json({ success: false, message: 'That document was not found.' });
  if (credential.status !== 'issued') {
    return res.status(409).json({ success: false, message: 'This has not been issued yet.' });
  }

  const [church, offering] = await Promise.all([
    Church.findOne({ slug: credential.churchSlug }),
    Offering.findOne({ slug: credential.offeringSlug }),
  ]);

  const pdf = await renderDocument({ credential, church, offering, preview: false });
  const name = `${credential.title.replace(/[^a-z0-9]+/gi, '-')}-${credential.credentialId}.pdf`.toLowerCase();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Content-Length', pdf.length);
  res.end(pdf);
});

/**
 * The same document, watermarked, with any name written into it. This is what a
 * buyer sees before paying — the point is that they see themselves on it.
 */
export const previewDocument = asyncHandler(async (req, res) => {
  const offering = await Offering.findOne({ slug: req.params.slug });
  if (!offering) return res.status(404).json({ success: false, message: 'That listing does not exist.' });

  const church = await Church.findOne({ slug: offering.churchSlug });
  const holderName = String(req.query.name ?? '').trim().slice(0, 60) || 'Your Name Here';

  const credential = {
    kind: offering.type === 'invitation-letter' ? 'invitation-letter' : offering.type,
    title: offering.award?.title ?? offering.title,
    holderName,
    credentialId: 'KN-0000-PREVIEW',
    verifyCode: 'PREVIEW',
    issuedAt: new Date(),
  };

  const pdf = await renderDocument({ credential, church, offering, preview: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="preview.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(pdf);
});

/** The assessment paper for a credential the buyer already owns. Answers withheld. */
export const getAssessment = asyncHandler(async (req, res) => {
  const credential = await Credential.findOne({ credentialId: req.params.id, userId: req.user._id });
  if (!credential) return res.status(404).json({ success: false, message: 'Not found.' });

  const offering = await Offering.findOne({ slug: credential.offeringSlug });
  if (!offering?.requires?.assessment?.required) {
    return res.status(400).json({ success: false, message: 'This credential does not carry an assessment.' });
  }

  const paper = paperFor(offering);
  res.json({
    success: true,
    data: {
      credentialId: credential.credentialId,
      title: offering.title,
      passMark: offering.requires.assessment.passMark,
      minutes: offering.requires.assessment.minutes,
      passed: Boolean(credential.notes?.includes('assessment:passed')),
      questions: paper.map((q) => ({ prompt: q.prompt, options: q.options })),
    },
  });
});

export const submitAssessment = asyncHandler(async (req, res) => {
  const credential = await Credential.findOne({ credentialId: req.params.id, userId: req.user._id });
  if (!credential) return res.status(404).json({ success: false, message: 'Not found.' });

  const offering = await Offering.findOne({ slug: credential.offeringSlug });
  if (!offering?.requires?.assessment?.required) {
    return res.status(400).json({ success: false, message: 'This credential does not carry an assessment.' });
  }

  const paper = paperFor(offering);
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const correct = paper.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
  const score = Math.round((correct / paper.length) * 100);
  const passMark = offering.requires.assessment.passMark ?? 70;
  const passed = score >= passMark;

  if (passed) {
    credential.notes = `assessment:passed score:${score}`;
    await credential.save();
    await settle(req.user._id, credential);
  }

  const refreshed = await Credential.findById(credential._id);

  res.json({
    success: true,
    data: {
      score,
      correct,
      total: paper.length,
      passMark,
      passed,
      status: refreshed.status,
      review: paper.map((q, i) => ({
        prompt: q.prompt,
        options: q.options,
        answer: q.answer,
        given: answers[i] ?? null,
        explanation: q.explanation,
      })),
    },
  });
});

/** Public verification. */
export const verify = asyncHandler(async (req, res) => {
  const credential = await Credential.findOne({ verifyCode: String(req.params.code).toUpperCase() });
  if (!credential || credential.status !== 'issued') {
    return res.status(404).json({ success: false, message: 'No issued credential matches that code.' });
  }
  const church = await Church.findOne({ slug: credential.churchSlug }, 'slug name shortName monogram city country verified website');
  res.json({
    success: true,
    data: {
      credentialId: credential.credentialId,
      title: credential.title,
      holderName: credential.holderName,
      kind: credential.kind,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
      destinationCity: credential.destinationCity,
      purpose: credential.purpose,
      church,
    },
  });
});
