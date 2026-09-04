import { describe, expect, it } from 'vitest';

import {
  acquisitionFor, assignCurriculumKeys, isCredentialType, lectureKeys, slugify,
  tallyCurriculum, validateOfferingForPublish,
} from '../lib/derive.js';
import { offerings } from '../data/offerings.js';

describe('the rule that a church service is never granted on payment alone', () => {
  it('refuses to publish any service with no church decision behind it', () => {
    const problems = validateOfferingForPublish({
      type: 'affiliation', title: 'Affiliation', churchSlug: 'x', outcome: 'affiliation',
      disclosure: 'A statement.', requires: {}, fee: { amount: 0 },
    });
    expect(problems).toContain(
      'A church service cannot be granted on payment alone. Require a church review, an interview, or both.',
    );
  });

  it('accepts a review, or an interview, for a non-ordination service', () => {
    const base = {
      type: 'certificate', title: 'Certificate', churchSlug: 'x', outcome: 'certification',
      disclosure: 'A statement.', fee: { amount: 0 },
    };
    expect(validateOfferingForPublish({ ...base, requires: { review: { required: true } } })).toHaveLength(0);
    expect(validateOfferingForPublish({ ...base, requires: { interview: { required: true } } })).toHaveLength(0);
  });

  it('requires ordination to include an explicitly face-to-face interview', () => {
    const base = {
      type: 'ordination', title: 'Ordained Minister', churchSlug: 'x', outcome: 'ordination',
      disclosure: 'A statement.', fee: { amount: 0 },
    };
    expect(validateOfferingForPublish({ ...base, requires: { review: { required: true } } }))
      .toContain('Ordination requires a live face-to-face interview, by video or in person.');
    expect(validateOfferingForPublish({ ...base, requires: { interview: { required: true } } }))
      .toContain('Ordination requires a live face-to-face interview, by video or in person.');
    expect(validateOfferingForPublish({ ...base, requires: { interview: { required: true, faceToFace: true } } }))
      .toHaveLength(0);
  });

  it('requires a church decision for invitation letters', () => {
    const letter = validateOfferingForPublish({
      type: 'invitation-letter', title: 'Invitation', churchSlug: 'x', outcome: 'invitation-letter',
      disclosure: 'A statement.', requires: {}, fee: { amount: 0 },
      letter: { destinationCountry: 'Uganda' },
    });
    expect(letter).toContain(
      'A church service cannot be granted on payment alone. Require a church review, an interview, or both.',
    );
  });

  it('never reports a credential type as instant', () => {
    expect(acquisitionFor({}, 'ordination')).toBe('application');
    expect(acquisitionFor({}, 'certificate')).toBe('application');
    expect(acquisitionFor({}, 'affiliation')).toBe('instant');
  });

  it('knows which types confer standing', () => {
    expect(isCredentialType('ordination')).toBe(true);
    expect(isCredentialType('invitation-letter')).toBe(false);
  });

  it('keeps every seeded service behind a church decision and every ordination face to face', () => {
    for (const offering of offerings) {
      expect(offering.requires?.review?.required || offering.requires?.interview?.required, offering.slug).toBe(true);
      if (offering.type === 'ordination') {
        expect(offering.requires?.interview?.required, offering.slug).toBe(true);
        expect(offering.requires?.interview?.faceToFace, offering.slug).toBe(true);
      }
    }
  });
});

describe('acquisition mode', () => {
  it('names the tallest hurdle, not the first one found', () => {
    expect(acquisitionFor({ credentials: ['a'], courses: ['b'], review: { required: true } })).toBe('credentials');
    expect(acquisitionFor({ courses: ['b'], assessment: { required: true } })).toBe('coursework');
    expect(acquisitionFor({ interview: { required: true }, review: { required: true } })).toBe('interview');
    expect(acquisitionFor({ review: { required: true } })).toBe('review');
  });

  it('sees a group as a requirement even with no direct entries', () => {
    expect(acquisitionFor({ credentialGroups: [{ offeringSlugs: ['a', 'b'] }] })).toBe('credentials');
    expect(acquisitionFor({ credentialGroups: [{ offeringSlugs: [] }] }, 'affiliation')).toBe('instant');
  });

  it('publishing validation requires a refund policy wherever there is a fee', () => {
    const problems = validateOfferingForPublish({
      type: 'certificate', title: 'A', churchSlug: 'x', outcome: 'certification',
      disclosure: 'A statement.', requires: { review: { required: true } }, fee: { amount: 20 },
    });
    expect(problems).toContain('State the refund policy for the fee.');
  });
});

describe('lecture keys', () => {
  const curriculum = [{ id: 'intro', lectures: [{ id: 'welcome' }, { id: 'how-it-works' }] }];

  it('derives the same key every time for seeded content, so a reseed keeps progress', () => {
    const first = assignCurriculumKeys(curriculum, { seedFrom: 'a-course' });
    const again = assignCurriculumKeys(curriculum, { seedFrom: 'a-course' });
    expect(lectureKeys({ curriculum: first })).toEqual(lectureKeys({ curriculum: again }));
  });

  it('gives different courses different keys for the same lecture id', () => {
    const a = assignCurriculumKeys(curriculum, { seedFrom: 'course-a' });
    const b = assignCurriculumKeys(curriculum, { seedFrom: 'course-b' });
    expect(a[0].lectures[0].key).not.toBe(b[0].lectures[0].key);
  });

  it('keeps a key that already exists, so retitling never orphans progress', () => {
    const [section] = assignCurriculumKeys(curriculum, { seedFrom: 'a-course' });
    const renamed = assignCurriculumKeys(
      [{ ...section, title: 'A completely different title' }],
      { seedFrom: 'a-course' },
    );
    expect(renamed[0].lectures[0].key).toBe(section.lectures[0].key);
  });
});

describe('derived counters', () => {
  it('tallies what the course cards display', () => {
    const totals = tallyCurriculum([
      { lectures: [{ kind: 'video', minutes: 10 }, { kind: 'reading', minutes: 5 }] },
      { lectures: [{ kind: 'quiz', minutes: 3 }] },
    ]);
    expect(totals).toMatchObject({ totalMinutes: 18, lectureCount: 3, articleCount: 1, quizCount: 1 });
  });
});

describe('slugify', () => {
  it('drops punctuation and caps the length', () => {
    expect(slugify("Pastor's Ordination — Level 1")).toBe('pastors-ordination-level-1');
    expect(slugify('x'.repeat(100))).toHaveLength(60);
  });
});
