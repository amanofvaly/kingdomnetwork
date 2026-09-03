import { acquisitionFor, isCredentialType } from '../lib/derive.js';

export const id = '003-publishing-and-fees';
export const description = 'Add draft/published status, application fees, and church verification state';

export const up = async (db) => {
  const offerings = db.collection('offerings');
  const courses = db.collection('courses');
  const churches = db.collection('churches');

  for await (const offering of offerings.find({})) {
    const status = offering.published === false ? 'draft' : 'published';
    const price = offering.price ?? 0;

    await offerings.updateOne(
      { _id: offering._id },
      {
        $set: {
          status,
          published: status === 'published',
          publishedAt: offering.publishedAt ?? offering.createdAt ?? new Date(),
          acquisition: acquisitionFor(offering.requires ?? {}, offering.type),
          fee: {
            amount: price,
            currency: offering.currency ?? 'USD',
            label: 'Application fee',
            refundable: false,
            refundPolicy: offering.fee?.refundPolicy ?? '',
          },
          // Discount anchors and merchandising badges do not belong on
          // ministerial standing.
          ...(isCredentialType(offering.type) ? { compareAtPrice: null, badge: null } : {}),
        },
      },
    );
  }

  for await (const course of courses.find({})) {
    const status = course.published === false ? 'draft' : 'published';
    await courses.updateOne(
      { _id: course._id },
      { $set: { status, published: status === 'published', publishedAt: course.publishedAt ?? course.createdAt ?? new Date() } },
    );
  }

  for await (const church of churches.find({})) {
    await churches.updateOne(
      { _id: church._id },
      {
        $set: {
          status: church.status ?? 'published',
          publishedAt: church.publishedAt ?? church.createdAt ?? new Date(),
          'verification.state': church.verified ? 'verified' : 'unverified',
          'onboarding.currentStep': 10,
          'onboarding.completedSteps': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          'onboarding.completedAt': church.createdAt ?? new Date(),
        },
      },
    );
  }
};
