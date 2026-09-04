import { shortId, stableKey } from './ids.js';

/**
 * Values a record carries that are computed from other fields it carries.
 *
 * These used to be worked out once, at seed time, by helpers in `server/data`.
 * The moment a church can edit an offering or a curriculum in the admin panel,
 * anything computed only at seed time is wrong the first time it is saved — so
 * the derivations live here and run from the models' pre-save hooks.
 */

export const slugify = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/**
 * Types that confer standing on a person. A church may never issue one of
 * these on payment alone — see `acquisitionFor` and `validateOfferingForPublish`.
 * Affiliation and invitation letters are excluded: they are relationships and
 * supporting documents, not titles.
 */
export const CREDENTIAL_TYPES = ['ordination', 'certificate', 'license', 'diploma', 'letter-of-standing'];

export const isCredentialType = (type) => CREDENTIAL_TYPES.includes(type);

const hasGroups = (groups) => Array.isArray(groups) && groups.some((g) => (g?.offeringSlugs?.length || g?.courseSlugs?.length));

/**
 * The single label a card shows for how something is obtained. Ordered by how
 * demanding the requirement is, so the card names the tallest hurdle rather
 * than the first one found.
 */
export const acquisitionFor = (requires = {}, type) => {
  if (requires.credentials?.length || hasGroups(requires.credentialGroups)) return 'credentials';
  if (requires.courses?.length || hasGroups(requires.courseGroups)) return 'coursework';
  if (requires.interview?.required) return 'interview';
  if (requires.assessment?.required) return 'assessment';
  if (requires.review?.required) return 'review';
  if (requires.documents?.length || requires.references?.length || requires.attestations?.length) return 'application';
  // A title with nothing behind it is not a title. The publish check rejects
  // this for credential types; the mode is still named honestly until then.
  return isCredentialType(type) ? 'application' : 'instant';
};

/** Counters the course cards and curriculum headers display. */
export const tallyCurriculum = (curriculum = []) => {
  let totalMinutes = 0;
  let lectureCount = 0;
  let articleCount = 0;
  let quizCount = 0;

  for (const section of curriculum) {
    for (const lecture of section.lectures ?? []) {
      totalMinutes += lecture.minutes || 0;
      lectureCount += 1;
      if (lecture.kind === 'reading') articleCount += 1;
      if (lecture.kind === 'quiz') quizCount += 1;
    }
  }

  return {
    totalMinutes,
    lectureCount,
    articleCount,
    quizCount,
    resourceCount: Math.max(3, Math.round(curriculum.length * 1.5)),
  };
};

/**
 * Progress is stored against lecture keys, so a key must survive its lecture
 * being retitled. Seed content derives a key from the course and the original
 * title — deterministic, so reseeding does not orphan anyone's progress —
 * while anything authored in the panel gets a random one.
 */
export const assignCurriculumKeys = (curriculum = [], { seedFrom = null } = {}) =>
  curriculum.map((section, si) => {
    const sectionSeed = seedFrom ? `${seedFrom}/${section.id ?? si}` : null;
    return {
      ...section,
      key: section.key ?? (sectionSeed ? stableKey(sectionSeed) : shortId()),
      lectures: (section.lectures ?? []).map((lecture, li) => ({
        ...lecture,
        key: lecture.key ?? (sectionSeed ? stableKey(`${sectionSeed}/${lecture.id ?? li}`) : shortId()),
      })),
    };
  });

export const lectureKeys = (course) =>
  (course.curriculum ?? []).flatMap((s) => (s.lectures ?? []).map((l) => l.key));

export const findLecture = (course, key) => {
  for (const section of course.curriculum ?? []) {
    const lecture = (section.lectures ?? []).find((l) => l.key === key);
    if (lecture) return { section, lecture };
  }
  return null;
};

/**
 * What must be true before a listing may go public. Returns a list of problems;
 * an empty list means it can publish.
 */
export const validateOfferingForPublish = (offering) => {
  const problems = [];
  const requires = offering.requires ?? {};

  if (!offering.title?.trim()) problems.push('Give the listing a title.');
  if (!offering.churchSlug) problems.push('The listing is not attached to a church.');
  if (!offering.outcome) problems.push('Choose which outcome this listing competes in.');
  if (!offering.disclosure?.trim()) {
    problems.push('Write the disclosure: what this confers, and what it does not.');
  }

  const decided = requires.review?.required || requires.interview?.required;
  if (!decided) {
    problems.push(
      'A church service cannot be granted on payment alone. Require a church review, an interview, or both.',
    );
  }

  if (offering.type === 'ordination' && (!requires.interview?.required || !requires.interview?.faceToFace)) {
    problems.push('Ordination requires a live face-to-face interview, by video or in person.');
  }

  if (requires.assessment?.required && !offering.assessmentSlug) {
    problems.push('The assessment requirement has no assessment selected.');
  }

  if (offering.type === 'invitation-letter' && !offering.letter?.destinationCountry) {
    problems.push('An invitation letter needs the country it invites the holder to.');
  }

  const fee = offering.fee?.amount ?? offering.price;
  if (fee > 0 && !offering.fee?.refundPolicy?.trim()) {
    problems.push('State the refund policy for the fee.');
  }

  return problems;
};
