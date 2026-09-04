import { assignCurriculumKeys } from '../lib/derive.js';

export const id = '002-stable-lecture-keys';
export const description = 'Give lectures keys that survive being retitled, and move progress onto them';

/**
 * Progress was stored as `"section-slug/lecture-slug"`, both halves derived
 * from titles — so retitling a lesson orphaned every learner's progress in it.
 * Each lecture gets a key derived once from the course and its original
 * identifier, and every stored progress entry is rewritten onto those keys.
 */
export const up = async (db) => {
  const courses = db.collection('courses');
  const enrollments = db.collection('enrollments');

  const pathToKey = new Map();

  for await (const course of courses.find({})) {
    const curriculum = assignCurriculumKeys(course.curriculum ?? [], { seedFrom: course.slug });

    (course.curriculum ?? []).forEach((section, si) => {
      (section.lectures ?? []).forEach((lecture, li) => {
        const oldPath = `${section.id}/${lecture.id}`;
        const key = curriculum[si]?.lectures?.[li]?.key;
        if (key) pathToKey.set(`${course.slug}::${oldPath}`, key);
      });
    });

    await courses.updateOne({ _id: course._id }, { $set: { curriculum } });
  }

  for await (const enrollment of enrollments.find({ courseSlug: { $type: 'string' } })) {
    const completed = (enrollment.completedLectures ?? [])
      .map((entry) => pathToKey.get(`${enrollment.courseSlug}::${entry}`) ?? null)
      .filter(Boolean);

    const lastLectureKey = enrollment.lastLectureId
      ? pathToKey.get(`${enrollment.courseSlug}::${enrollment.lastLectureId}`)
      : undefined;

    await enrollments.updateOne(
      { _id: enrollment._id },
      {
        $set: { completedLectures: [...new Set(completed)], ...(lastLectureKey ? { lastLectureKey } : {}) },
        $unset: { lastLectureId: '' },
      },
    );
  }
};
