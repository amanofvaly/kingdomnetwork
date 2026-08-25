/**
 * Seed-time lesson material.
 *
 * Every lecture in the catalogue is authored as an outline entry (title, kind,
 * length). This module expands each entry into the notes, key points and quiz
 * questions the course player renders, grounding every line in that lecture's
 * own title, its section, and the course it belongs to. It is placeholder
 * teaching material — the `demo` flag on each course marks it as such — and it
 * is replaced wholesale when an issuing church uploads its own.
 */

// Deterministic per-lecture variation, so reseeding produces identical output.
const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};
const pick = (arr, seed) => arr[seed % arr.length];

const lower = (t) => (t.length > 1 && t[1] === t[1].toLowerCase() ? t[0].toLowerCase() + t.slice(1) : t);
const stripColon = (t) => t.split(':').pop().trim();

const OPENERS = [
  (l, s) => `This lesson takes up ${lower(stripColon(l))} and sits inside ${lower(s.title)}, so it assumes what the previous lessons in this section established.`,
  (l, s) => `${stripColon(l)} is the concern here. It belongs to ${lower(s.title)}, and the material builds directly on what came before it.`,
  (l, s) => `We look at ${lower(stripColon(l))} in this lesson. It is part of ${lower(s.title)}, and it will make most sense read in order.`,
  (l, s) => `The subject of this lesson is ${lower(stripColon(l))}. Within ${lower(s.title)} it does the work of turning the general principle into something you can act on.`,
];

const MIDDLES = [
  (c) => `The teaching is drawn from ${c.churchName}'s own practice rather than from a textbook, so the examples are situations the faculty has actually handled.`,
  (c) => `${c.instructorName} works through this from a live caseload, which is why the examples carry the awkward details a tidied-up illustration would leave out.`,
  (c) => `What follows is deliberately concrete. ${c.churchName} teaches this material to people who will use it the same week, so the emphasis falls on what you do rather than on what you could say about it.`,
  (c) => `${c.instructorName} sets this out plainly and then complicates it, because the straightforward version breaks down as soon as a real person is involved.`,
];

const CLOSERS = [
  (o) => `By the end of this lesson you should be able to ${lower(o)}`,
  (o) => `Hold onto one thing from this lesson: you are working toward being able to ${lower(o)}`,
  (o) => `This connects to the course outcome directly — ${lower(o)}`,
];

const KIND_LINE = {
  video: 'Watch this lesson, then read the notes below. Both cover the same ground; the notes go slightly further on the detail.',
  audio: 'This lesson is audio-first and sized for a slow connection. The notes below carry the same material if you would rather read it.',
  reading: 'This is a written lesson. Read it through once without stopping, then go back to the points that did not land.',
  quiz: 'Answer each question, then read the explanation. The explanations are part of the teaching, not just a mark scheme.',
  assignment: 'This is assessed work. Read the brief, do the work, and submit it before moving on — the next section assumes you have done it.',
};

const POINT_STEMS = [
  'What the term actually means here, as opposed to how it is used loosely',
  'Where this goes wrong most often, and the early signs of it',
  'The distinction that has to be held, and what collapses if you drop it',
  'A worked example taken from a real situation',
  'What to do differently on the strength of this lesson',
  'The objection you will meet, and a fair answer to it',
  'How this connects to the assessment at the end of the course',
];

const notesFor = (lecture, section, course, seed) => {
  const opener = pick(OPENERS, seed)(lecture.title, section);
  const middle = pick(MIDDLES, seed >> 3)(course);
  const outcome = course.outcomes?.[seed % Math.max(course.outcomes.length, 1)] ?? 'apply this in your own setting.';
  const closer = pick(CLOSERS, seed >> 5)(outcome.endsWith('.') ? outcome : `${outcome}.`);
  return [opener, middle, closer];
};

const pointsFor = (seed) => {
  const start = seed % POINT_STEMS.length;
  return [0, 1, 2].map((i) => POINT_STEMS[(start + i) % POINT_STEMS.length]);
};

/** Rotate an option list so the answer is not always in the same position. */
const rotate = (options, answerIndex, by) => {
  const n = options.length;
  const shift = by % n;
  const shifted = [...options.slice(n - shift), ...options.slice(0, n - shift)];
  return { options: shifted, answer: (answerIndex + shift) % n };
};

/** Build quiz questions out of the course's own stated outcomes and requirements. */
const questionsFor = (lecture, section, course, seed) => {
  const outcomes = course.outcomes ?? [];
  const targetIndex = seed % Math.max(outcomes.length, 1);
  const target = outcomes[targetIndex] ?? 'Apply the material in your own setting';
  const others = outcomes.filter((_, i) => i !== targetIndex);

  const raw = [
    {
      prompt: 'What is this lesson training you to be able to do?',
      options: [
        target,
        others[(seed + 1) % Math.max(others.length, 1)] ?? 'Memorise the terminology used in the lesson',
        'Reproduce the lecturer\u2019s own conclusions without examining them',
        'Postpone any decision until you have completed the whole course',
      ],
      answer: 0,
      explanation: `${stripColon(lecture.title)} exists in this course to build one capability: ${lower(target.endsWith('.') ? target : `${target}.`)} The other options describe either a lesser goal or a habit this course argues against.`,
    },
    {
      prompt: `How does ${course.churchName} teach this material?`,
      options: [
        'From practice, with the examples keeping the awkward details in',
        'As theory first, leaving practice to the student',
        'Without worked examples, so students form their own view',
        'As a single correct answer for every situation',
      ],
      answer: 0,
      explanation: `${course.churchName} teaches this to people who will use it immediately, so the worked examples deliberately retain the complications that a tidied illustration would remove.`,
    },
    {
      prompt: 'What should you do if this lesson contradicts something you already practise?',
      options: [
        'Work out which claim the evidence supports, and be willing to change your practice',
        'Keep your existing practice, since it has worked so far',
        'Adopt the lesson\u2019s position immediately without examining it',
        'Raise it only after the course has finished',
      ],
      answer: 0,
      explanation: 'The course is argumentative by design. You are expected to test what you are told against the material and against your own experience, and to change your practice where the case is made.',
    },
  ];

  // Vary the answer position per question so it is never predictably first.
  return raw.map((q, i) => {
    const { options, answer } = rotate(q.options, q.answer, (seed >> (i * 2)) + i);
    return { ...q, options, answer };
  });
};

/** Expand a finalised course list with lesson bodies, key points and quizzes. */
export const addLessonContent = (courses, { instructors, churches }) => {
  const instructorBySlug = Object.fromEntries(instructors.map((i) => [i.slug, i]));
  const churchBySlug = Object.fromEntries(churches.map((c) => [c.slug, c]));

  return courses.map((course) => {
    const church = churchBySlug[course.churchSlug];
    const instructor = instructorBySlug[course.instructorSlugs?.[0]];
    const ctx = {
      ...course,
      churchName: church?.shortName ?? church?.name ?? 'The issuing church',
      instructorName: instructor?.name ?? 'The instructor',
    };

    return {
      ...course,
      curriculum: course.curriculum.map((section) => ({
        ...section,
        lectures: section.lectures.map((lecture) => {
          const seed = hash(`${course.slug}/${section.id}/${lecture.id}`);
          const body = lecture.body?.length ? lecture.body : notesFor(lecture, section, ctx, seed);
          return {
            ...lecture,
            summary: lecture.summary || `${KIND_LINE[lecture.kind] ?? KIND_LINE.video}`,
            body: [...body, ...pointsFor(seed).map((p) => `• ${p}`)],
            questions:
              lecture.kind === 'quiz'
                ? (lecture.questions?.length ? lecture.questions : questionsFor(lecture, section, ctx, seed))
                : [],
          };
        }),
      })),
    };
  });
};
