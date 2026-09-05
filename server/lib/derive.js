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

/** Every kind of thing a church can issue, in the order the panel offers them. */
export const OFFERING_TYPES = [
  'ordination', 'license', 'certificate', 'diploma', 'letter-of-standing', 'affiliation', 'invitation-letter',
];

export const isOfferingType = (type) => OFFERING_TYPES.includes(type);

/**
 * The comparison buckets a type may be listed under, most apt first.
 *
 * A type is what a credential is, and it decides the rules: ordination needs a
 * live interview, an invitation letter needs a destination. An outcome is the
 * page where churches issuing the same thing are compared. For six of the
 * seven types the two are the same question, so the bucket follows the type
 * rather than being asked for twice. Only a letter of standing is genuinely
 * placeable — it reads either as a licence or as an affiliation — and it is
 * the one type the panel asks about.
 *
 * The buckets themselves are defined in `server/data/outcomes.js`; this is the
 * only place that says which type belongs to which.
 */
const OUTCOMES_BY_TYPE = {
  ordination: ['ordination'],
  license: ['ministry-license'],
  certificate: ['certification'],
  diploma: ['certification'],
  'letter-of-standing': ['ministry-license', 'church-affiliation'],
  affiliation: ['church-affiliation'],
  'invitation-letter': ['invitation-letter'],
};

export const outcomesForType = (type) => OUTCOMES_BY_TYPE[type] ?? [];

/** The bucket a listing of this type lands in unless the church moves it. */
export const defaultOutcomeForType = (type) => outcomesForType(type)[0] ?? null;

export const outcomeFitsType = (outcome, type) => outcomesForType(type).includes(outcome);

/**
 * The bucket to store, given what was asked for. A bucket the type cannot be
 * compared under is not an error to argue with — it is corrected to the
 * default for the type, which is the only thing it could have meant.
 */
export const resolveOutcome = (outcome, type) =>
  (outcomeFitsType(outcome, type) ? outcome : defaultOutcomeForType(type));

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
  else if (!outcomeFitsType(offering.outcome, offering.type)) {
    problems.push('This listing is filed under an outcome its kind cannot be compared under.');
  }
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
  if ((fee > 0 || offering.fee?.renewalAmount > 0) && !offering.fee?.refundPolicy?.trim()) {
    problems.push('State the refund policy for the fee.');
  }

  const positiveInteger = (value) => Number.isInteger(value) && value > 0;
  if (offering.capacity != null && !positiveInteger(offering.capacity)) problems.push('Places must be a whole number of at least 1, or left empty for no limit.');
  if (offering.intake?.mode === 'windows') {
    const windows = offering.intake.windows ?? [];
    if (!windows.length) problems.push('Add an intake window with opening and closing dates.');
    windows.forEach((w, i) => {
      const opens = w.opensAt && new Date(w.opensAt).getTime();
      const closes = w.closesAt && new Date(w.closesAt).getTime();
      if (!opens || !closes || !Number.isFinite(opens) || !Number.isFinite(closes)) problems.push(`Intake window ${i + 1} needs both opening and closing dates.`);
      else if (closes <= opens) problems.push(`Intake window ${i + 1} must close after it opens.`);
      if (w.seats != null && !positiveInteger(w.seats)) problems.push(`Places in intake window ${i + 1} must be a whole number of at least 1.`);
      if (windows.slice(0, i).some((other) => opens <= new Date(other.closesAt).getTime() && closes >= new Date(other.opensAt).getTime())) problems.push(`Intake window ${i + 1} overlaps another window. Use separate dates.`);
    });
  }
  for (const groups of [requires.credentialGroups, requires.courseGroups]) {
    for (const [i, group] of (groups ?? []).entries()) {
      const items = group.offeringSlugs ?? group.courseSlugs ?? [];
      const name = group.label || `Prerequisite group ${i + 1}`;
      if (!items.length) problems.push(`“${name}” needs at least one choice.`);
      if (new Set(items).size !== items.length) problems.push(`“${name}” contains the same prerequisite more than once.`);
      if (group.creditUnits != null && (!Number.isFinite(group.creditUnits) || group.creditUnits <= 0)) problems.push(`“${name}” needs a positive credit total.`);
      if (group.mode === 'atLeast' && !group.creditUnits && (!positiveInteger(group.count) || group.count > new Set(items).size)) problems.push(`“${name}” must require between 1 and ${new Set(items).size} choices.`);
    }
  }
  for (const [key, label, maximum] of [['passMark', 'Assessment pass mark', 100], ['attemptsAllowed', 'Assessment attempts', Infinity], ['minutes', 'Assessment minutes', Infinity]]) {
    const value = requires.assessment?.[key];
    if (value != null && (!positiveInteger(value) || value > maximum)) problems.push(`${label} must be a whole number from 1${maximum === 100 ? ' to 100' : ' upwards'}.`);
  }
  if ((offering.renewal?.required || offering.award?.renewable) && !positiveInteger(offering.renewal?.everyMonths ?? offering.award?.validityMonths)) problems.push('Set a positive renewal interval or certificate validity in months.');
  if (offering.renewal?.continuingEducationHours != null && offering.renewal.continuingEducationHours < 0) problems.push('Renewal study hours cannot be negative.');

  return problems;
};
