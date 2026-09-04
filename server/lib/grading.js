/**
 * Serving a paper, and marking it.
 *
 * The served paper is stored on the attempt rather than re-derived at grading
 * time, because a church can edit its question bank between someone sitting a
 * paper and it being marked. What a person answered must always be marked
 * against what they were actually shown.
 */

const shuffle = (items, random = Math.random) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Build the paper this sitting will use, with the answers still attached. */
export const servePaper = (assessment) => {
  const bank = assessment.questions ?? [];
  const draw = assessment.drawCount && assessment.drawCount > 0
    ? Math.min(assessment.drawCount, bank.length)
    : bank.length;

  const chosen = (assessment.shuffleQuestions ? shuffle(bank) : bank).slice(0, draw);

  return chosen.map((q) => {
    const question = q.toObject?.() ?? q;

    if (!assessment.shuffleOptions || !question.options?.length) {
      return {
        key: question.key,
        type: question.type,
        prompt: question.prompt,
        options: question.options ?? [],
        points: question.points ?? 1,
        answers: question.answers ?? [],
        accepted: question.accepted ?? [],
        explanation: question.explanation,
      };
    }

    // Shuffle the options and carry the correct indexes across with them, so a
    // correct answer is never reliably in the same position.
    const order = shuffle(question.options.map((_, i) => i));
    const options = order.map((i) => question.options[i]);
    const answers = (question.answers ?? [])
      .map((original) => order.indexOf(original))
      .filter((i) => i >= 0);

    return {
      key: question.key,
      type: question.type,
      prompt: question.prompt,
      options,
      points: question.points ?? 1,
      answers,
      accepted: question.accepted ?? [],
      explanation: question.explanation,
    };
  });
};

/** What the person sitting it is allowed to see: no answers. */
export const forCandidate = (served) =>
  served.map((q) => ({ key: q.key, type: q.type, prompt: q.prompt, options: q.options, points: q.points }));

const normalise = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?]+$/, '');

const sameSet = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((v, i) => v === right[i]);
};

/**
 * Marks everything that can be marked without a person. Essays are left for a
 * grader and reported separately, so an attempt is never quietly failed for a
 * question nobody has read yet.
 */
export const grade = (served, responses) => {
  const byKey = new Map(responses.map((r) => [r.key, r]));

  let awardedPoints = 0;
  let autoPoints = 0;
  let manualPending = 0;

  const marked = served.map((question) => {
    const response = byKey.get(question.key) ?? {};
    const points = question.points ?? 1;

    if (question.type === 'essay') {
      manualPending += points;
      return { key: question.key, text: response.text ?? '', correct: undefined, awarded: undefined };
    }

    autoPoints += points;
    let correct = false;

    if (question.type === 'short-answer') {
      const given = normalise(response.text);
      correct = given.length > 0 && (question.accepted ?? []).some((a) => normalise(a) === given);
    } else if (question.type === 'multiple') {
      correct = sameSet(response.chosen ?? [], question.answers ?? []);
    } else {
      // single and true-false: exactly one selection, matching the answer.
      correct = (response.chosen ?? []).length === 1 && (question.answers ?? []).includes(response.chosen[0]);
    }

    if (correct) awardedPoints += points;

    return {
      key: question.key,
      chosen: response.chosen ?? [],
      text: response.text,
      correct,
      awarded: correct ? points : 0,
    };
  });

  return {
    marked,
    autoScore: autoPoints ? Math.round((awardedPoints / autoPoints) * 100) : 0,
    awardedPoints,
    autoPoints,
    manualPending,
    needsGrading: manualPending > 0,
  };
};
