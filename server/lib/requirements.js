/**
 * What a church asks of an applicant, and where they have got to.
 *
 * This logic used to exist twice — once inline in `grantAccess` when an order
 * was paid, and again in `settle` every time a passport was loaded — and the
 * two had already drifted. It is now written once, as a pure function over a
 * context the caller assembles, so the applicant's checklist, the church's
 * queue and the public listing page all describe the same requirements in the
 * same words.
 *
 * Nothing here reads the database or mutates anything. `workflow.js` owns that.
 */

const step = (key, type, label, status, extra = {}) => ({ key, type, label, status, ...extra });

const DONE = 'complete';
const PENDING = 'pending';

/**
 * `all` of them, `any` one, `atLeast` a count of items — or, when the group
 * names credit units, at least that many units' worth. This is how a church
 * expresses "any three of these six certificates", which is the same shape as
 * credits counting toward a degree.
 */
const evaluateGroup = (group, held, unitsFor) => {
  const items = group.offeringSlugs ?? group.courseSlugs ?? [];
  const satisfied = items.filter((slug) => held.has(slug));

  if (group.creditUnits) {
    const earned = satisfied.reduce((n, slug) => n + (unitsFor?.(slug) ?? 0), 0);
    return {
      met: earned >= group.creditUnits,
      satisfied,
      items,
      progress: `${earned} of ${group.creditUnits} credits`,
      needed: group.creditUnits,
    };
  }

  const needed = group.mode === 'all' ? items.length : group.mode === 'any' ? 1 : Math.max(1, group.count ?? 1);

  return {
    met: satisfied.length >= needed,
    satisfied,
    items,
    progress: `${satisfied.length} of ${needed}`,
    needed,
  };
};

const groupLabel = (group, noun) => {
  if (group.label) return group.label;
  const items = group.offeringSlugs ?? group.courseSlugs ?? [];
  if (group.creditUnits) return `${group.creditUnits} credits of ${noun}`;
  if (group.mode === 'all') return `All ${items.length} ${noun}`;
  if (group.mode === 'any') return `Any one of ${items.length} ${noun}`;
  return `Any ${group.count ?? 1} of ${items.length} ${noun}`;
};

/**
 * @param offering  the listing, with its `requires` tree
 * @param context   what is known about the applicant:
 *   heldCredentials  Set of offering slugs they hold as issued credentials
 *   completedCourses Set of course slugs they have finished
 *   courseProgress   Map of course slug -> percent
 *   creditsFor       (slug) => credit units that offering or course is worth
 *   user             for the structured eligibility minimums
 *   application      the live application, if there is one
 */
export const evaluate = (offering, context = {}) => {
  const requires = offering?.requires ?? {};
  const {
    heldCredentials = new Set(),
    completedCourses = new Set(),
    courseProgress = new Map(),
    creditsFor,
    user,
    application,
  } = context;

  const steps = [];
  const fee = offering?.fee?.amount ?? offering?.price ?? 0;

  if (fee > 0) {
    steps.push(
      step('fee', 'fee', offering?.fee?.label ?? 'Application fee', application?.paymentRef ? DONE : PENDING, {
        detail: 'Covers the church’s assessment of your application. It does not guarantee the credential.',
        meta: { amount: fee, currency: offering?.fee?.currency ?? 'USD' },
      }),
    );
  }

  if (offering?.applicationForm?.length) {
    const answered = offering.applicationForm
      .filter((f) => f.required)
      .every((f) => {
        const value = application?.answers?.[f.key];
        return value !== undefined && value !== null && String(value).trim() !== '';
      });
    steps.push(step('form', 'form', 'Application form', answered ? DONE : PENDING, {
      detail: `${offering.applicationForm.length} question${offering.applicationForm.length === 1 ? '' : 's'} from the church.`,
    }));
  }

  for (const attestation of requires.attestations ?? []) {
    const agreed = application?.attestations?.find((a) => a.key === attestation.key)?.agreedAt;
    steps.push(step(`attestation:${attestation.key}`, 'attestation', attestation.statement, agreed ? DONE : PENDING, {
      meta: { required: attestation.required !== false },
    }));
  }

  for (const doc of requires.documents ?? []) {
    const record = application?.documents?.find((d) => d.key === doc.key);
    const status = record?.status === 'accepted' ? DONE : record?.status === 'rejected' ? 'failed' : PENDING;
    steps.push(step(`document:${doc.key}`, 'document', doc.label, status, {
      detail: doc.description,
      meta: { required: doc.required !== false, uploaded: Boolean(record?.mediaId), note: record?.note },
    }));
  }

  for (const ref of requires.references ?? []) {
    const record = application?.references?.find((r) => r.key === ref.key);
    const status = record?.status === 'received' ? DONE : record?.status === 'declined' ? 'failed' : PENDING;
    steps.push(step(`reference:${ref.key}`, 'reference', ref.label, status, {
      detail: ref.relationship ? `From your ${ref.relationship}.` : undefined,
      meta: { required: ref.required !== false, sent: record?.status === 'sent', name: record?.name },
    }));
  }

  for (const slug of requires.credentials ?? []) {
    steps.push(step(`credential:${slug}`, 'credential', slug, heldCredentials.has(slug) ? DONE : PENDING, {
      meta: { offeringSlug: slug },
    }));
  }

  (requires.credentialGroups ?? []).forEach((group, i) => {
    const result = evaluateGroup(group, heldCredentials, creditsFor);
    steps.push(step(`credentialGroup:${i}`, 'credential', groupLabel(group, 'credentials'), result.met ? DONE : PENDING, {
      detail: result.progress,
      meta: { group: true, mode: group.mode, items: result.items, satisfied: result.satisfied, needed: result.needed },
    }));
  });

  for (const slug of requires.courses ?? []) {
    steps.push(step(`course:${slug}`, 'course', slug, completedCourses.has(slug) ? DONE : PENDING, {
      meta: { courseSlug: slug, progress: courseProgress.get(slug) ?? 0 },
    }));
  }

  (requires.courseGroups ?? []).forEach((group, i) => {
    const result = evaluateGroup(group, completedCourses, creditsFor);
    steps.push(step(`courseGroup:${i}`, 'course', groupLabel(group, 'courses'), result.met ? DONE : PENDING, {
      detail: result.progress,
      meta: { group: true, mode: group.mode, items: result.items, satisfied: result.satisfied, needed: result.needed },
    }));
  });

  if (requires.assessment?.required) {
    const passed = context.assessmentPassed ?? false;
    steps.push(step('assessment', 'assessment', 'Written assessment', passed ? DONE : PENDING, {
      detail: [
        requires.assessment.questionCount ? `${requires.assessment.questionCount} questions` : null,
        requires.assessment.minutes ? `${requires.assessment.minutes} minutes` : null,
        requires.assessment.passMark ? `${requires.assessment.passMark}% to pass` : null,
      ].filter(Boolean).join(' · '),
      meta: { assessmentSlug: offering?.assessmentSlug },
    }));
  }

  if (requires.interview?.required) {
    const outcome = context.interviewOutcome;
    const status = outcome === 'pass' ? DONE : outcome === 'fail' ? 'failed' : PENDING;
    steps.push(step('interview', 'interview', 'Interview with the church', status, {
      detail: requires.interview.instructions
        ?? (requires.interview.faceToFace
          ? `${requires.interview.durationMinutes ?? 30} minute face-to-face meeting with ${(requires.interview.panelSize ?? 1) > 1 ? 'the panel' : 'a member of the church'}, by live video or in person.`
          : `${requires.interview.durationMinutes ?? 30} minutes with ${(requires.interview.panelSize ?? 1) > 1 ? 'the panel' : 'a member of the church'}.`),
      meta: {
        durationMinutes: requires.interview.durationMinutes,
        faceToFace: Boolean(requires.interview.faceToFace),
        whatIsAssessed: requires.interview.whatIsAssessed,
        booked: Boolean(context.interviewScheduledFor),
        scheduledFor: context.interviewScheduledFor,
      },
    }));
  }

  // The church's decision is always last: it is a judgement on everything above.
  if (requires.review?.required) {
    const decided = application?.decision?.outcome;
    const status = decided === 'approved' ? DONE : decided === 'declined' ? 'failed' : PENDING;
    steps.push(step('review', 'review', 'Review by the church', status, {
      detail: requires.review.turnaroundDays
        ? `Usually decided within ${requires.review.turnaroundDays} days.`
        : 'Decided by the church.',
      meta: { documents: requires.review.documents },
    }));
  }

  const eligibility = [...(requires.eligibility ?? [])];
  if (requires.minMonthsInMinistry) {
    const years = Math.round((requires.minMonthsInMinistry / 12) * 10) / 10;
    eligibility.push(`At least ${years} year${years === 1 ? '' : 's'} serving in a congregation`);
  }
  if (requires.minAge) eligibility.push(`At least ${requires.minAge} years old`);

  return { steps, eligibility, user };
};

/** Steps a waiver or a recorded outcome has already settled count as done. */
export const isSettled = (s) => s.status === DONE || s.status === 'waived';

export const summarise = (steps = []) => {
  const outstanding = steps.filter((s) => !isSettled(s));
  const failed = steps.filter((s) => s.status === 'failed');
  const next = outstanding.find((s) => s.type !== 'review') ?? outstanding[0] ?? null;

  return {
    total: steps.length,
    complete: steps.filter(isSettled).length,
    outstanding: outstanding.length,
    failed: failed.length,
    percent: steps.length ? Math.round((steps.filter(isSettled).length / steps.length) * 100) : 100,
    allMet: outstanding.length === 0,
    // Everything the church itself does not decide.
    readyForDecision: outstanding.every((s) => s.type === 'review'),
    next,
  };
};
