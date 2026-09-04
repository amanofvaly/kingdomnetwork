import { describe, expect, it } from 'vitest';

import { evaluate, summarise } from '../lib/requirements.js';

/**
 * The requirement evaluator decides what a person still owes a church before it
 * will consider them. It used to exist in two places that had already drifted
 * apart, so it is worth pinning down.
 */

const offering = (requires = {}, extra = {}) => ({ type: 'ordination', requires, ...extra });

describe('requirement groups', () => {
  const three = { mode: 'atLeast', count: 2, offeringSlugs: ['a', 'b', 'c'] };

  it('counts "at least two of three" as met on the second', () => {
    const met = evaluate(offering({ credentialGroups: [three] }), { heldCredentials: new Set(['a', 'b']) });
    expect(met.steps[0].status).toBe('complete');

    const short = evaluate(offering({ credentialGroups: [three] }), { heldCredentials: new Set(['a']) });
    expect(short.steps[0].status).toBe('pending');
    expect(short.steps[0].detail).toBe('1 of 2');
  });

  it('treats "any" as needing exactly one', () => {
    const group = { mode: 'any', offeringSlugs: ['a', 'b', 'c'] };
    const { steps } = evaluate(offering({ credentialGroups: [group] }), { heldCredentials: new Set(['c']) });
    expect(steps[0].status).toBe('complete');
  });

  it('treats "all" as needing every one', () => {
    const group = { mode: 'all', offeringSlugs: ['a', 'b'] };
    const partial = evaluate(offering({ credentialGroups: [group] }), { heldCredentials: new Set(['a']) });
    expect(partial.steps[0].status).toBe('pending');

    const whole = evaluate(offering({ credentialGroups: [group] }), { heldCredentials: new Set(['a', 'b']) });
    expect(whole.steps[0].status).toBe('complete');
  });

  /** Credits toward a degree are the same shape as a group, counted differently. */
  it('counts credit units rather than items when the group names them', () => {
    const group = { mode: 'atLeast', creditUnits: 12, courseSlugs: ['x', 'y', 'z'] };
    const credits = { x: 6, y: 6, z: 6 };
    const context = { completedCourses: new Set(['x', 'y']), creditsFor: (s) => credits[s] ?? 0 };

    const { steps } = evaluate(offering({ courseGroups: [group] }), context);
    expect(steps[0].status).toBe('complete');
    expect(steps[0].detail).toBe('12 of 12 credits');

    const one = evaluate(offering({ courseGroups: [group] }), { ...context, completedCourses: new Set(['x']) });
    expect(one.steps[0].status).toBe('pending');
    expect(one.steps[0].detail).toBe('6 of 12 credits');
  });
});

describe('the checklist as a whole', () => {
  const full = offering({
    courses: ['pastoral-theology'],
    assessment: { required: true, passMark: 70 },
    interview: { required: true },
    review: { required: true, turnaroundDays: 14 },
    documents: [{ key: 'id', label: 'Identity document' }],
    references: [{ key: 'senior', label: 'A reference' }],
    attestations: [{ key: 'conduct', statement: 'I agree' }],
  }, { fee: { amount: 45 } });

  it('puts the church’s decision last, after everything it judges', () => {
    const { steps } = evaluate(full, {});
    expect(steps.at(-1).type).toBe('review');
  });

  it('reports readiness for a decision only once the applicant’s part is done', () => {
    const nothing = summarise(evaluate(full, {}).steps);
    expect(nothing.readyForDecision).toBe(false);

    const done = summarise(
      evaluate(full, {
        completedCourses: new Set(['pastoral-theology']),
        assessmentPassed: true,
        interviewOutcome: 'pass',
        application: {
          paymentRef: 'PAY-1',
          documents: [{ key: 'id', status: 'accepted' }],
          references: [{ key: 'senior', status: 'received' }],
          attestations: [{ key: 'conduct', agreedAt: new Date() }],
        },
      }).steps,
    );

    expect(done.readyForDecision).toBe(true);
    expect(done.allMet).toBe(false); // the church has still to decide
  });

  it('marks a rejected document as failed rather than merely outstanding', () => {
    const { steps } = evaluate(full, { application: { documents: [{ key: 'id', status: 'rejected' }] } });
    expect(steps.find((s) => s.key === 'document:id').status).toBe('failed');
    expect(summarise(steps).failed).toBe(1);
  });

  it('counts a waived step as settled', () => {
    const steps = [
      { key: 'a', type: 'course', status: 'waived' },
      { key: 'b', type: 'review', status: 'pending' },
    ];
    const summary = summarise(steps);
    expect(summary.complete).toBe(1);
    expect(summary.readyForDecision).toBe(true);
  });

  it('names a face-to-face interview as live video or in person', () => {
    const { steps } = evaluate(offering({ interview: { required: true, faceToFace: true, durationMinutes: 45, panelSize: 2 } }));
    expect(steps[0].detail).toContain('face-to-face');
    expect(steps[0].detail).toContain('live video or in person');
  });
});
