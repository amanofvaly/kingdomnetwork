// Terse authoring helpers so a course curriculum reads like an outline
// instead of a wall of object literals.

import { assignCurriculumKeys, slugify, tallyCurriculum } from '../lib/derive.js';

export { slugify };

const KIND = { v: 'video', a: 'audio', r: 'reading', q: 'quiz', x: 'assignment' };

/**
 * sec('Section title', 'summary', [ [kind, title, minutes, extra?], ... ])
 * kind is one of v (video) a (audio) r (reading) q (quiz) x (assignment).
 */
export const sec = (title, summary, lectures) => ({
  id: slugify(title),
  title,
  summary,
  lectures: lectures.map(([kind, lTitle, minutes, extra = {}]) => ({
    id: slugify(lTitle),
    title: lTitle,
    kind: KIND[kind] ?? 'video',
    minutes,
    preview: Boolean(extra.preview),
    summary: extra.summary ?? '',
    body: extra.body ?? [],
    questions: extra.questions ?? [],
  })),
});

/** Roll section data up into the counters the course cards display. */
export const tally = tallyCurriculum;

/**
 * Attach the derived counters, and give every lecture a stable key.
 *
 * The keys are derived from the course slug and the lecture's authored id, so
 * reseeding produces the same keys and does not orphan the progress of anyone
 * already part-way through a course.
 */
export const finalise = (courses) =>
  courses.map((c) => {
    const curriculum = assignCurriculumKeys(c.curriculum ?? [], { seedFrom: c.slug });
    return {
      ...c,
      curriculum,
      ...tallyCurriculum(curriculum),
      resourceCount: c.resourceCount ?? Math.max(3, Math.round(curriculum.length * 1.5)),
      status: 'published',
      published: true,
      publishedAt: new Date(),
      demo: true,
    };
  });
