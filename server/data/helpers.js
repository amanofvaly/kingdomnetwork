// Terse authoring helpers so a course curriculum reads like an outline
// instead of a wall of object literals.

const KIND = { v: 'video', a: 'audio', r: 'reading', q: 'quiz', x: 'assignment' };

export const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

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
export const tally = (curriculum) => {
  let totalMinutes = 0;
  let lectureCount = 0;
  let articleCount = 0;
  let quizCount = 0;
  for (const s of curriculum) {
    for (const l of s.lectures) {
      totalMinutes += l.minutes || 0;
      lectureCount += 1;
      if (l.kind === 'reading') articleCount += 1;
      if (l.kind === 'quiz') quizCount += 1;
    }
  }
  return { totalMinutes, lectureCount, articleCount, quizCount };
};

/** Attach derived counters to every course in a list. */
export const finalise = (courses) =>
  courses.map((c) => ({
    ...c,
    ...tally(c.curriculum ?? []),
    resourceCount: c.resourceCount ?? Math.max(3, Math.round((c.curriculum?.length ?? 0) * 1.5)),
  }));
