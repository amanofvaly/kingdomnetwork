import { describe, expect, it } from 'vitest';

import { forCandidate, grade, servePaper } from '../lib/grading.js';

const assessment = {
  drawCount: 0,
  shuffleQuestions: false,
  shuffleOptions: true,
  questions: [
    { key: 'q1', type: 'single', prompt: 'One?', options: ['a', 'b', 'c', 'd'], answers: [2], points: 1 },
    { key: 'q2', type: 'multiple', prompt: 'Two?', options: ['w', 'x', 'y', 'z'], answers: [0, 3], points: 2 },
    { key: 'q3', type: 'short-answer', prompt: 'Three?', accepted: ['1 Timothy 3'], points: 1 },
    { key: 'q4', type: 'essay', prompt: 'Four?', points: 5 },
  ],
};

describe('serving a paper', () => {
  it('never hands the candidate the answers', () => {
    const served = forCandidate(servePaper(assessment));
    for (const q of served) {
      expect(q).not.toHaveProperty('answers');
      expect(q).not.toHaveProperty('accepted');
    }
  });

  it('carries the correct indexes across a shuffle', () => {
    for (let i = 0; i < 40; i += 1) {
      const [q1] = servePaper(assessment);
      expect(q1.options[q1.answers[0]]).toBe('c');
    }
  });

  it('draws only as many questions as asked for', () => {
    expect(servePaper({ ...assessment, drawCount: 2 })).toHaveLength(2);
    // A draw larger than the bank serves the whole bank rather than failing.
    expect(servePaper({ ...assessment, drawCount: 99 })).toHaveLength(4);
  });
});

describe('marking', () => {
  const answer = (served, overrides = {}) =>
    served.map((q) => ({ key: q.key, ...(overrides[q.key] ?? { chosen: q.answers, text: q.accepted?.[0] }) }));

  it('marks every automatic question and leaves the essay for a person', () => {
    const served = servePaper(assessment);
    const result = grade(served, answer(served));

    expect(result.autoScore).toBe(100);
    expect(result.needsGrading).toBe(true);
    expect(result.manualPending).toBe(5);
    expect(result.marked.find((m) => m.key === 'q4').awarded).toBeUndefined();
  });

  it('requires every selection to match on a multiple-answer question', () => {
    const served = servePaper(assessment);
    const partial = grade(served, answer(served, { q2: { chosen: [served[1].answers[0]] } }));
    expect(partial.marked.find((m) => m.key === 'q2').correct).toBe(false);
  });

  it('accepts a short answer regardless of case, spacing or a trailing stop', () => {
    const served = servePaper(assessment);
    for (const given of ['1 Timothy 3', ' 1 timothy 3. ', '1  TIMOTHY  3']) {
      const result = grade(served, answer(served, { q3: { text: given } }));
      expect(result.marked.find((m) => m.key === 'q3').correct).toBe(true);
    }
    const blank = grade(served, answer(served, { q3: { text: '   ' } }));
    expect(blank.marked.find((m) => m.key === 'q3').correct).toBe(false);
  });

  it('scores against the marks available, not the number of questions', () => {
    const served = servePaper({ ...assessment, questions: assessment.questions.slice(0, 2) });
    // Right on the 1-mark question, wrong on the 2-mark one: 1 of 3.
    const result = grade(served, [
      { key: 'q1', chosen: served[0].answers },
      { key: 'q2', chosen: [] },
    ]);
    expect(result.autoScore).toBe(33);
  });

  it('treats an unanswered question as wrong rather than throwing', () => {
    const served = servePaper(assessment);
    const result = grade(served, []);
    expect(result.autoScore).toBe(0);
    expect(result.marked).toHaveLength(4);
  });
});
