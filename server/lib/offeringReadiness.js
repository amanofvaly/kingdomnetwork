import { Assessment } from '../models/Assessment.js';
import { Course } from '../models/Course.js';
import { InterviewSlot } from '../models/InterviewSlot.js';
import { Offering } from '../models/Offering.js';
import { validateOfferingForPublish } from './derive.js';
import { findRequirementCycle } from './slugs.js';

export const FACE_TO_FACE_PROVIDERS = ['zoom', 'google-meet', 'teams', 'whatsapp', 'in-person'];
export const slotFilterFor = (offering, now = new Date()) => ({
  churchSlug: offering.churchSlug,
  status: 'open', startsAt: { $gt: now },
  ...(offering.requires?.interview?.faceToFace ? { provider: { $in: FACE_TO_FACE_PROVIDERS } } : {}),
  $expr: { $lt: ['$bookedCount', '$capacity'] },
  $or: [{ offeringSlug: offering.slug }, { offeringSlug: null }, { offeringSlug: '' }],
});

export const referenceProblems = async (offering, { published = false } = {}) => {
  const r = offering.requires ?? {};
  const credentials = [...new Set([...(r.credentials ?? []), ...(r.credentialGroups ?? []).flatMap((g) => g.offeringSlugs ?? [])])];
  const courses = [...new Set([...(r.courses ?? []), ...(r.courseGroups ?? []).flatMap((g) => g.courseSlugs ?? []), ...(offering.curriculumOutline ?? []).flatMap((g) => g.courseSlugs ?? [])])];
  const [offerings, coursework] = await Promise.all([
    Offering.find({ slug: { $in: credentials } }, 'slug title status creditValue').lean(),
    Course.find({ slug: { $in: courses } }, 'slug title status creditUnits').lean(),
  ]);
  const problems = [];
  for (const [slugs, records, kind] of [[credentials, offerings, 'Credential'], [courses, coursework, 'Course']]) {
    const by = new Map(records.map((o) => [o.slug, o]));
    for (const slug of slugs) {
      const record = by.get(slug);
      if (!record) problems.push(`${kind} prerequisite “${slug}” does not exist. Choose an existing ${kind.toLowerCase()}.`);
      else if (published && record.status !== 'published') problems.push(`Publish “${record.title}” before using it as a prerequisite.`);
    }
  }
  for (const [groups, records, units] of [[r.credentialGroups, offerings, 'creditValue'], [r.courseGroups, coursework, 'creditUnits']]) {
    for (const group of groups ?? []) {
      const items = [...new Set(group.offeringSlugs ?? group.courseSlugs ?? [])];
      if (group.creditUnits > 0 && items.every((slug) => records.some((o) => o.slug === slug))) {
        const total = records.filter((o) => items.includes(o.slug)).reduce((n, o) => n + (o[units] ?? 0), 0);
        if (total < group.creditUnits) problems.push(`“${group.label || 'Prerequisite group'}” asks for ${group.creditUnits} credits, but its choices only provide ${total}.`);
      }
    }
  }
  if (credentials.length) {
    const cycle = await findRequirementCycle(Offering, offering.slug, credentials);
    if (cycle) problems.push(`That would create a prerequisite loop: ${cycle.join(' → ')}.`);
  }
  return problems;
};

export const offeringProblems = async (offering, { availability = true } = {}) => {
  const problems = [...validateOfferingForPublish(offering), ...await referenceProblems(offering, { published: true })];
  if (offering.requires?.assessment?.required && offering.assessmentSlug) {
    const paper = await Assessment.findOne({ slug: offering.assessmentSlug, churchSlug: offering.churchSlug, status: 'published' });
    if (!paper?.questions?.length) problems.push('Publish the selected assessment with at least one question before opening applications.');
  }
  if (availability && offering.requires?.interview?.required && !await InterviewSlot.exists(slotFilterFor(offering))) {
    problems.push(`Add an available ${offering.requires.interview.faceToFace ? 'video or in-person ' : ''}interview slot before opening applications.`);
  }
  return [...new Set(problems)];
};
