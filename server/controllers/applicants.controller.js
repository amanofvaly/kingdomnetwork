import { FACE_TO_FACE_PROVIDERS } from '../lib/offeringReadiness.js';
import { presentSteps } from '../lib/requirementPresentation.js';
import { offeringForApplication } from '../lib/applicationTerms.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { audit } from '../lib/audit.js';
import { notify } from '../lib/notify.js';
import { summarise } from '../lib/requirements.js';
import { advance, decide as decideApplication } from '../lib/workflow.js';
import { Application } from '../models/Application.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { Interview } from '../models/Interview.js';
import { MediaAsset } from '../models/MediaAsset.js';

/**
 * The church's queue.
 *
 * Every credential the old system left in `in-review` sat there forever because
 * there was no way for a church to sign one off. This is that missing half:
 * read what was submitted, accept or query each piece of it, waive what the
 * church is willing to waive, and decide.
 */

const load = async (req) => Application.findOne({ reference: req.params.reference, churchSlug: req.church.slug });

export const list = asyncHandler(async (req, res) => {
  const { status, offering, q, waiting, page = '1', limit = '25' } = req.query;

  const filter = { churchSlug: req.church.slug };
  if (status) filter.status = { $in: String(status).split(',') };
  if (offering) filter.offeringSlug = offering;
  // Drafts belong to the applicant until they submit; the church cannot see them.
  if (!status) filter.status = { $ne: 'draft' };

  if (waiting === 'true') {
    filter.status = { $in: ['submitted', 'under_review', 'final_review', 'info_requested'] };
  }
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ reference: rx }, { offeringTitle: rx }];
  }

  const perPage = Math.min(Number(limit) || 25, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const [applications, total, byStatus, byOffering] = await Promise.all([
    Application.find(filter)
      .sort({ submittedAt: 1, updatedAt: -1 })
      .skip(skip)
      .limit(perPage)
      .populate('userId', 'name email avatar country city ministryRole'),
    Application.countDocuments(filter),
    Application.aggregate([
      { $match: { churchSlug: req.church.slug, status: { $ne: 'draft' } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Application.aggregate([
      { $match: { churchSlug: req.church.slug, status: { $ne: 'draft' } } },
      { $group: { _id: '$offeringSlug', title: { $first: '$offeringTitle' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      applications: applications.map((a) => {
        const summary = summarise(a.steps ?? []);
        return {
          reference: a.reference,
          status: a.status,
          offeringSlug: a.offeringSlug,
          offeringTitle: a.offeringTitle,
          applicant: a.userId
            ? { id: a.userId._id, name: a.userId.name, email: a.userId.email, avatar: a.userId.avatar, country: a.userId.country, ministryRole: a.userId.ministryRole }
            : null,
          summary,
          // What the church itself is holding up, as opposed to what the
          // applicant still has to do. This is what a queue should sort by.
          waitingOnChurch: summary.readyForDecision || a.status === 'final_review',
          waitingDays: a.submittedAt ? Math.floor((Date.now() - a.submittedAt) / 86400000) : null,
          submittedAt: a.submittedAt,
          updatedAt: a.updatedAt,
          credentialId: a.credentialId,
        };
      }),
      total,
      page: Number(page) || 1,
      pages: Math.ceil(total / perPage),
      facets: {
        statuses: byStatus.map((s) => ({ value: s._id, count: s.count })),
        offerings: byOffering.map((o) => ({ value: o._id, label: o.title, count: o.count })),
      },
    },
  });
});

export const detail = asyncHandler(async (req, res) => {
  const application = await load(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });

  await advance(application);
  await application.populate('userId', 'name email avatar country city phone ministryRole bio ministry createdAt');

  const [offering, attempts, interview, media] = await Promise.all([
    offeringForApplication(application),
    application.attemptIds?.length ? AssessmentAttempt.find({ _id: { $in: application.attemptIds } }).sort({ attemptNumber: -1 }) : [],
    application.interviewId ? Interview.findById(application.interviewId) : null,
    MediaAsset.find({ _id: { $in: (application.documents ?? []).map((d) => d.mediaId).filter(Boolean) } }, 'storageKey filename mimeType bytes'),

  ]);

  const mediaBy = Object.fromEntries(media.map((m) => [String(m._id), m]));
  const steps = await presentSteps(application.steps);

  res.json({
    success: true,
    data: {
      reference: application.reference,
      status: application.status,
      offering,
      offeringTitle: application.offeringTitle,
      applicant: application.userId,
      answers: application.answers ?? {},
      attestations: application.attestations ?? [],
      documents: (application.documents ?? []).map((d) => {
        const asset = d.mediaId ? mediaBy[String(d.mediaId)] : null;
        return {
          ...(d.toObject?.() ?? d),
          media: asset ? { id: asset._id, url: `/api/media/file/${asset.storageKey}`, filename: asset.filename, mimeType: asset.mimeType, bytes: asset.bytes } : null,
        };
      }),
      // The referee's link is a secret and is never shown, even to the church.
      references: (application.references ?? []).map((r) => {
        const { token, ...rest } = r.toObject?.() ?? r;
        void token;
        return rest;
      }),
      steps,
      summary: summarise(steps),
      attempts,
      interview,
      infoRequest: application.infoRequest,
      decision: application.decision,
      credentialId: application.credentialId,
      paymentRef: application.paymentRef,
      submittedAt: application.submittedAt,
      timeline: (application.timeline ?? []).slice().reverse(),
    },
  });
});

export const reviewDocument = asyncHandler(async (req, res) => {
  const application = await load(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });

  const document = application.documents?.find((d) => d.key === req.params.key);
  if (!document) return res.status(404).json({ success: false, message: 'No such document on this application.' });
  if (!document.mediaId) return res.status(409).json({ success: false, message: 'Nothing has been uploaded for that yet.' });

  const outcome = req.body?.status;
  if (!['accepted', 'rejected'].includes(outcome)) {
    return res.status(400).json({ success: false, message: 'Accept or reject the document.' });
  }

  document.status = outcome;
  document.note = String(req.body?.note ?? '').trim().slice(0, 1000) || undefined;
  document.reviewedBy = req.user._id;
  document.reviewedAt = new Date();

  application.log({
    event: `document:${outcome}`,
    note: `${document.label ?? document.key}${document.note ? ` — ${document.note}` : ''}`,
    actorId: req.user._id,
    actorRole: 'church',
    visibility: 'both',
  });
  await advance(application);

  if (outcome === 'rejected') {
    await notify.user(application.userId, {
      kind: 'document:rejected',
      title: `A document needs replacing`,
      body: `${document.label ?? document.key}: ${document.note ?? 'the church has asked for a different file.'}`,
      link: `/applications/${application.reference}`,
      prefKey: 'applicationUpdates',
    });
  }

  res.json({ success: true, data: { key: document.key, status: document.status } });
});

/** Ask the applicant for something, and stop the clock until they answer. */
export const requestInfo = asyncHandler(async (req, res) => {
  const application = await load(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });

  const message = String(req.body?.message ?? '').trim();
  if (!message) return res.status(400).json({ success: false, message: 'Say what you need from them.' });

  application.infoRequest = { message: message.slice(0, 2000), requestedBy: req.user._id, requestedAt: new Date(), resolvedAt: undefined };
  application.log({ event: 'info:requested', note: message.slice(0, 500), actorId: req.user._id, actorRole: 'church', visibility: 'both' });
  await advance(application);

  await notify.user(application.userId, {
    kind: 'application:info-requested',
    title: `${req.church.name} has asked you for something`,
    body: message.slice(0, 300),
    link: `/applications/${application.reference}`,
    prefKey: 'applicationUpdates',
  });

  res.json({ success: true, data: { status: application.status } });
});

/**
 * Waive a requirement.
 *
 * Churches routinely accept prior service in place of coursework, and this has
 * to be recorded as what it is — with a reason and a name against it — rather
 * than by marking something complete that never happened.
 */
export const waiveStep = asyncHandler(async (req, res) => {
  const application = await load(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });

  const reason = String(req.body?.reason ?? '').trim();
  if (!reason) return res.status(400).json({ success: false, message: 'A waiver needs a reason on the record.' });

  const step = application.steps?.find((s) => s.key === req.params.key);
  if (!step) return res.status(404).json({ success: false, message: 'No such requirement on this application.' });
  const offering = await offeringForApplication(application);
  if (step.type === 'interview' && offering?.type === 'ordination') return res.status(400).json({ success: false, message: 'Ordination requires a completed face-to-face interview. This requirement cannot be waived.' });
  if (step.type === 'fee') {
    return res.status(400).json({ success: false, message: 'Refund the fee rather than waiving it after the fact.' });
  }

  step.status = 'waived';
  step.waivedBy = req.user._id;
  step.waiverReason = reason.slice(0, 1000);
  step.completedAt = new Date();

  const [presented] = await presentSteps([step]);
  application.log({ event: 'requirement:waived', note: `${presented.label} — ${reason.slice(0, 300)}`, actorId: req.user._id, actorRole: 'church', visibility: 'both' });
  await application.save();
  await advance(application);
  await audit(req, { action: 'application:waive', entity: 'Application', entityId: application._id, after: { step: step.key, reason } });

  res.json({ success: true, data: { key: step.key, status: 'waived', summary: summarise(application.steps) } });
});

export const gradeAttempt = asyncHandler(async (req, res) => {
  const application = await load(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });

  const attempt = await AssessmentAttempt.findOne({ _id: req.params.attemptId, applicationId: application._id });
  if (!attempt) return res.status(404).json({ success: false, message: 'No such attempt.' });
  if (attempt.status !== 'awaiting-grading') {
    return res.status(409).json({ success: false, message: 'That attempt does not need grading.' });
  }

  const scores = Array.isArray(req.body?.scores) ? req.body.scores : [];
  const byKey = new Map(scores.map((s) => [s.key, s]));

  let awarded = 0;
  let total = 0;

  for (const question of attempt.served) {
    const points = question.points ?? 1;
    total += points;
    const response = attempt.responses.find((r) => r.key === question.key);

    if (question.type === 'essay') {
      const given = byKey.get(question.key);
      const mark = Math.max(0, Math.min(points, Number(given?.awarded ?? 0)));
      if (response) {
        response.awarded = mark;
        response.correct = mark >= points / 2;
        response.graderNote = String(given?.note ?? '').slice(0, 1000) || undefined;
      }
      awarded += mark;
    } else {
      awarded += response?.awarded ?? 0;
    }
  }

  attempt.manualScore = total ? Math.round((awarded / total) * 100) : 0;
  attempt.score = attempt.manualScore;
  attempt.passed = attempt.score >= attempt.passMark;
  attempt.status = 'graded';
  attempt.gradedBy = req.user._id;
  attempt.gradedAt = new Date();
  attempt.feedback = String(req.body?.feedback ?? attempt.feedback ?? '').slice(0, 2000) || undefined;
  await attempt.save();

  application.log({
    event: attempt.passed ? 'assessment:passed' : 'assessment:failed',
    note: `Graded ${attempt.score}% (pass mark ${attempt.passMark}%)`,
    actorId: req.user._id,
    actorRole: 'church',
    visibility: 'both',
  });
  await advance(application);

  await notify.user(application.userId, {
    kind: 'assessment:graded',
    title: `Your paper has been marked`,
    body: `${attempt.score}% — ${attempt.passed ? 'a pass' : `the pass mark is ${attempt.passMark}%`}.`,
    link: `/applications/${application.reference}`,
    prefKey: 'applicationUpdates',
  });

  res.json({ success: true, data: { score: attempt.score, passed: attempt.passed } });
});

export const recordInterviewOutcome = asyncHandler(async (req, res) => {
  const application = await load(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });

  const interview = await Interview.findById(application.interviewId);
  if (!interview) return res.status(404).json({ success: false, message: 'No interview has been booked.' });

  const outcome = req.body?.outcome;
  if (!['pass', 'fail', 'defer'].includes(outcome)) {
    return res.status(400).json({ success: false, message: 'Record the outcome as pass, fail or defer.' });
  }

  const offering = await offeringForApplication(application);
  if (outcome === 'pass' && (req.body?.noShow || (offering?.requires?.interview?.faceToFace && !FACE_TO_FACE_PROVIDERS.includes(interview.provider)))) return res.status(400).json({ success: false, message: 'A pass requires an attended video or in-person interview for this credential.' });
  interview.outcome = outcome;
  interview.status = req.body?.noShow ? 'no-show' : 'completed';
  interview.score = Number.isFinite(req.body?.score) ? req.body.score : undefined;
  interview.notes = String(req.body?.notes ?? '').slice(0, 4000) || undefined;
  interview.recordedBy = req.user._id;
  interview.recordedAt = new Date();
  await interview.save();

  application.log({ event: `interview:${outcome}`, note: interview.notes?.slice(0, 300), actorId: req.user._id, actorRole: 'church', visibility: 'church' });
  application.log({ event: 'interview:completed', actorId: req.user._id, actorRole: 'church', visibility: 'applicant' });
  await advance(application);

  res.json({ success: true, data: { outcome, status: application.status } });
});

/** An internal note. Never shown to the applicant. */
export const addNote = asyncHandler(async (req, res) => {
  const application = await load(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });

  const note = String(req.body?.note ?? '').trim();
  if (!note) return res.status(400).json({ success: false, message: 'Write the note first.' });

  application.log({ event: 'note', note: note.slice(0, 4000), actorId: req.user._id, actorRole: 'church', visibility: 'church' });
  await application.save();

  res.json({ success: true, data: { added: true } });
});

/**
 * The decision. Approving issues the credential in the same action, so an
 * approved application can never sit un-issued.
 */
export const decide = asyncHandler(async (req, res) => {
  const application = await load(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });

  const outcome = req.body?.outcome;
  if (!['approved', 'declined', 'deferred'].includes(outcome)) {
    return res.status(400).json({ success: false, message: 'Approve, decline or defer.' });
  }
  if (['issued', 'declined', 'withdrawn'].includes(application.status)) {
    return res.status(409).json({ success: false, message: 'This application is already closed.' });
  }

  if (outcome === 'approved') {
    await advance(application);
    const outstanding = (application.steps ?? []).filter(
      (s) => s.meta?.required !== false && s.status !== 'complete' && s.status !== 'waived' && s.type !== 'review',
    );
    // Approving over an unmet requirement would make the checklist a fiction.
    // The church can waive anything it is willing to waive, on the record.
    if (outstanding.length) {
      return res.status(409).json({
        success: false,
        message: `${outstanding.length} requirement${outstanding.length === 1 ? ' is' : 's are'} still outstanding. Waive what you are willing to waive, then approve.`,
        data: { outstanding: outstanding.map((s) => ({ key: s.key, label: s.label, type: s.type })) },
      });
    }
  }

  if (outcome === 'declined' && !String(req.body?.publicNote ?? '').trim()) {
    return res.status(400).json({ success: false, message: 'Tell the applicant why. A decline without a reason is not a decision they can act on.' });
  }

  const { application: saved, credential } = await decideApplication(application, {
    outcome,
    actor: req.user,
    reason: String(req.body?.reason ?? '').slice(0, 500) || undefined,
    publicNote: String(req.body?.publicNote ?? '').slice(0, 2000) || undefined,
    internalNote: String(req.body?.internalNote ?? '').slice(0, 2000) || undefined,
  });

  await audit(req, {
    action: `application:${outcome}`,
    entity: 'Application',
    entityId: saved._id,
    after: { outcome, credentialId: credential?.credentialId },
  });

  await notify.user(saved.userId, {
    kind: `application:${outcome}`,
    title:
      outcome === 'approved'
        ? `${saved.offeringTitle} has been issued`
        : outcome === 'declined'
          ? `A decision on your application`
          : `Your application has been deferred`,
    body: saved.decision?.publicNote ?? undefined,
    link: outcome === 'approved' ? '/passport' : `/applications/${saved.reference}`,
    prefKey: 'applicationUpdates',
  });

  res.json({
    success: true,
    data: { status: saved.status, credentialId: credential?.credentialId ?? null, verifyCode: credential?.verifyCode ?? null },
  });
});
