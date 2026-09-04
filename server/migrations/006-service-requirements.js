export const id = '006-service-requirements';
export const description = 'Require a church decision for every service and a face-to-face interview for ordination';

const DEFAULT_REVIEW = {
  required: true,
  turnaroundDays: 7,
  documents: ['Ministry record', 'Reference from a serving leader', 'Identity document'],
};

export const up = async (db) => {
  const offerings = db.collection('offerings');

  await offerings.updateMany(
    {
      $and: [
        { $or: [{ 'requires.review.required': { $ne: true } }, { 'requires.review': { $exists: false } }] },
        { $or: [{ 'requires.interview.required': { $ne: true } }, { 'requires.interview': { $exists: false } }] },
      ],
    },
    { $set: { 'requires.review': DEFAULT_REVIEW } },
  );

  await offerings.updateMany(
    { type: 'ordination' },
    {
      $set: {
        'requires.interview.required': true,
        'requires.interview.faceToFace': true,
      },
    },
  );
};
