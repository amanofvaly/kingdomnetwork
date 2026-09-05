import { Course } from '../models/Course.js';
import { Offering } from '../models/Offering.js';

export const presentSteps = async (steps = []) => {
  const courseSlugs = steps.flatMap((s) => s.type !== 'course' ? [] : s.meta?.group ? s.meta.items ?? [] : [s.meta?.courseSlug]).filter(Boolean);
  const offeringSlugs = steps.flatMap((s) => s.type !== 'credential' ? [] : s.meta?.group ? s.meta.items ?? [] : [s.meta?.offeringSlug]).filter(Boolean);
  const [courses, offerings] = await Promise.all([
    Course.find({ slug: { $in: courseSlugs } }, 'slug title churchSlug coverImage totalMinutes lectureCount price creditUnits').lean(),
    Offering.find({ slug: { $in: offeringSlugs } }, 'slug title churchSlug coverImage price fee type creditValue').lean(),
  ]);
  const courseBy = Object.fromEntries(courses.map((c) => [c.slug, c]));
  const offeringBy = Object.fromEntries(offerings.map((o) => [o.slug, o]));
  return steps.map((s) => {
    const course = courseBy[s.meta?.courseSlug] ?? null;
    const offering = offeringBy[s.meta?.offeringSlug] ?? null;
    const options = s.meta?.group ? (s.meta.items ?? []).map((slug) => (s.type === 'course' ? courseBy[slug] : offeringBy[slug]) ?? { slug, title: 'Unavailable prerequisite' }) : undefined;
    return { ...(s.toObject?.() ?? s), label: course?.title ?? offering?.title ?? s.label, course, offering, options, progress: s.meta?.progress,
      detail: options ? [s.detail, options.map((o) => o.title).join(' · ')].filter(Boolean).join(' — ') : s.detail };
  });
};
