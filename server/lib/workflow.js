import { Application } from '../models/Application.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { Church } from '../models/Church.js';
import { Credential } from '../models/Credential.js';
import { Enrollment } from '../models/Enrollment.js';
import { Interview } from '../models/Interview.js';
import { Offering } from '../models/Offering.js';

import { evaluate, isSettled, summarise } from './requirements.js';
import { randomCode } from './ids.js';

/**
 * The state machine behind an application.
 *
 * This module is the only thing that writes `Application.status` and the only
 * thing that creates a Credential. Everything else — paying a fee, finishing a
 * course, passing a paper, uploading a document, an interview outcome, a
 * church's decision — calls `advance()` and lets it work out what that means.
 *
 * The rule that matters: `issue()` is unreachable except through an explicit
 * church decision. A credential cannot appear because money arrived.
 */

/** Assemble what the evaluator needs to know about this applicant. */
export const contextFor = async (application, offering) => {
  const userId = application.userId;

  const [held, enrollments, attempts, interview, creditSources] = await Promise.all([
    Credential.find({ userId, status: 'issued' }, 'offeringSlug').lean(),
    Enrollment.find({ userId, courseSlug: { $type: 'string' } }, 'courseSlug status progress creditUnitsEarned').lean(),
    application.attemptIds?.length
      ? AssessmentAttempt.find({ _id: { $in: application.attemptIds } }, 'passed').lean()
      : [],
    application.interviewId ? Interview.findById(application.interviewId).lean() : null,
    Offering.find(
      { slug: { $in: offering?.requires?.credentialGroups?.flatMap((g) => g.offeringSlugs ?? []) ?? [] } },
      'slug creditValue',
    ).lean(),
  ]);

  const credits = new Map(creditSources.map((o) => [o.slug, o.creditValue ?? 0]));
  for (const e of enrollments) if (e.creditUnitsEarned) credits.set(e.courseSlug, e.creditUnitsEarned);

  return {
    heldCredentials: new Set(held.map((c) => c.offeringSlug).filter(Boolean)),
    completedCourses: new Set(enrollments.filter((e) => e.status === 'completed').map((e) => e.courseSlug)),
    courseProgress: new Map(enrollments.map((e) => [e.courseSlug, e.progress ?? 0])),
    creditsFor: (slug) => credits.get(slug) ?? 0,
    assessmentPassed: attempts.some((a) => a.passed),
    interviewOutcome: interview?.outcome,
    interviewScheduledFor: interview?.scheduledFor,
    application,
  };
};

/**
 * Recompute the checklist, keeping anything a person has already decided.
 *
 * A waiver is a church saying "not for this applicant" — usually because it
 * accepts prior service in place of a requirement. It must survive a
 * recomputation, so recorded human outcomes are merged back over the freshly
 * evaluated ones.
 */
export const buildSteps = (application, offering, context) => {
  const { steps } = evaluate(offering, context);
  const recorded = new Map((application.steps ?? []).map((s) => [s.key, s]));

  return steps.map((fresh) => {
    const prior = recorded.get(fresh.key);
    if (prior?.status === 'waived') {
      return { ...fresh, status: 'waived', waivedBy: prior.waivedBy, waiverReason: prior.waiverReason, completedAt: prior.completedAt };
    }
    return {
      ...fresh,
      note: prior?.note,
      startedAt: prior?.startedAt,
      completedAt: fresh.status === 'complete' ? prior?.completedAt ?? new Date() : undefined,
    };
  });
};

/** The status the application should be in, given where its steps have got to. */
const statusFor = (application, steps) => {
  if (['withdrawn', 'declined', 'issued', 'expired'].includes(application.status)) return application.status;

  // A draft stays a draft until it is actually sent. `submittedAt` rather than
  // the status is what settles that: an application with no fee to pay is
  // submitted directly, without ever passing through `fee_pending`.
  if (application.status === 'draft' && !application.submittedAt) return 'draft';

  if (application.decision?.outcome === 'approved') return 'approved';
  if (application.infoRequest?.requestedAt && !application.infoRequest?.resolvedAt) return 'info_requested';

  const outstanding = steps.filter((s) => !isSettled(s));
  if (!outstanding.length) return 'final_review';

  const feeStep = steps.find((s) => s.type === 'fee');
  if (feeStep && !isSettled(feeStep)) return 'fee_pending';

  // Name the state after the tallest thing still in the way, so a church queue
  // filtered by status groups applications by what they are actually waiting on.
  const order = ['course', 'credential', 'assessment', 'interview', 'document', 'reference', 'form', 'attestation', 'review'];
  const next = order.find((type) => outstanding.some((s) => s.type === type));

  switch (next) {
    case 'course':
    case 'credential':
      return 'coursework';
    case 'assessment':
      return 'assessment';
    case 'interview':
      return 'interview';
    case 'review':
      return 'final_review';
    default:
      return application.submittedAt ? 'under_review' : 'submitted';
  }
};

/**
 * Recompute an application and save it. Returns the saved document and the
 * summary the interface renders from.
 */
export const advance = async (application, { offering, actor, event, note } = {}) => {
  const listing = offering ?? (await Offering.findOne({ slug: application.offeringSlug }));
  if (!listing) return { application, summary: summarise([]) };

  const context = await contextFor(application, listing);
  const steps = buildSteps(application, listing, context);
  const previousStatus = application.status;

  application.steps = steps;
  application.status = statusFor(application, steps);

  if (event) {
    application.log({ event, note, actorId: actor?._id, actorRole: actor?.role });
  } else if (application.status !== previousStatus) {
    application.log({ event: `status:${application.status}`, visibility: 'both' });
  }

  await application.save();
  return { application, summary: summarise(steps), offering: listing, context };
};

/**
 * Mint the credential.
 *
 * Only reachable from a recorded church decision — see `decide()`. Everything
 * on the credential is a fact about what was issued, and the verification code
 * is what makes it checkable by someone outside the church.
 */
export const issue = async (application, { actor, church, offering } = {}) => {
  if (application.credentialId) {
    return Credential.findOne({ credentialId: application.credentialId });
  }

  const listing = offering ?? (await Offering.findOne({ slug: application.offeringSlug }));
  const issuer = church ?? (await Church.findOne({ slug: application.churchSlug }));
  const holder = await application.populate('userId');
  const user = holder.userId;

  const validityMonths = listing?.award?.validityMonths;
  const issuedAt = new Date();
  // Calendar months, not 30-day blocks: a two-year licence should expire on the
  // same date two years later, which is what a renewal reminder has to match.
  const expiresAt = validityMonths
    ? new Date(new Date(issuedAt).setMonth(issuedAt.getMonth() + validityMonths))
    : undefined;

  const credential = await Credential.create({
    userId: application.userId,
    applicationId: application._id,
    credentialId: `KN-${issuedAt.getFullYear()}-${randomCode(8)}`,
    kind: listing?.type ?? 'certificate',
    offeringSlug: application.offeringSlug,
    title: listing?.award?.title ?? listing?.title ?? application.offeringTitle,
    postNominal: listing?.award?.postNominal,
    holderName: user?.name,
    churchSlug: application.churchSlug,
    churchName: issuer?.shortName ?? issuer?.name ?? application.churchSlug,
    destinationCountry: listing?.letter?.destinationCountry,
    destinationCity: listing?.letter?.destinationCity,
    purpose: listing?.letter?.purpose,
    status: 'issued',
    issuedAt,
    issuedBy: actor?._id,
    signatory: issuer?.signatory
      ? { name: issuer.signatory.name, title: issuer.signatory.title, signatureMediaId: issuer.signatory.signatureMediaId }
      : undefined,
    expiresAt,
    renewal: listing?.renewal?.required
      ? {
          required: true,
          dueAt: listing.renewal.everyMonths
            ? new Date(new Date(issuedAt).setMonth(issuedAt.getMonth() + listing.renewal.everyMonths))
            : expiresAt,
          continuingEducationHours: listing.renewal.continuingEducationHours,
        }
      : undefined,
    verifyCode: randomCode(10),
  });

  application.credentialId = credential.credentialId;
  application.status = 'issued';
  application.issuedAt = issuedAt;
  application.log({
    event: 'credential:issued',
    note: credential.title,
    actorId: actor?._id,
    actorRole: 'church',
    visibility: 'both',
  });
  await application.save();

  await Offering.updateOne({ slug: application.offeringSlug }, { $inc: { issuedCount: 1 } });

  return credential;
};

/**
 * The church's decision. Approving issues immediately; the two are one action
 * so an approved application cannot sit un-issued.
 */
export const decide = async (application, { outcome, actor, reason, publicNote, internalNote }) => {
  application.decision = { outcome, by: actor?._id, at: new Date(), reason, publicNote, internalNote };
  application.decidedAt = new Date();

  if (outcome === 'declined') {
    application.status = 'declined';
    application.log({ event: 'decision:declined', note: publicNote, actorId: actor?._id, actorRole: 'church', visibility: 'both' });
    if (internalNote) {
      application.log({ event: 'decision:note', note: internalNote, actorId: actor?._id, actorRole: 'church', visibility: 'church' });
    }
    await application.save();
    return { application, credential: null };
  }

  if (outcome === 'deferred') {
    application.status = 'under_review';
    application.log({ event: 'decision:deferred', note: publicNote, actorId: actor?._id, actorRole: 'church', visibility: 'both' });
    await application.save();
    return { application, credential: null };
  }

  application.status = 'approved';
  application.log({ event: 'decision:approved', note: publicNote, actorId: actor?._id, actorRole: 'church', visibility: 'both' });
  await application.save();

  const credential = await issue(application, { actor });
  return { application, credential };
};

/**
 * Re-check every live application a person has. Called when something happens
 * that could satisfy a requirement in more than one of them at once — finishing
 * a course, or being issued a credential another application requires.
 */
export const advanceAllFor = async (userId) => {
  const live = await Application.find({
    userId,
    status: { $nin: ['draft', 'issued', 'declined', 'withdrawn', 'expired'] },
  });

  for (const application of live) {
    await advance(application);
  }
  return live.length;
};
