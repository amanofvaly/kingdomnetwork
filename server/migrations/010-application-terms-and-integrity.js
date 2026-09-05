import { OPEN_APPLICATIONS, snapshotOffering } from '../lib/applicationTerms.js';

export const id = '010-application-terms-and-integrity';
export const description = 'Preserve application terms, count intake places, and make issuance and repeat applications safe';

export const up = async (db) => {
  const applications = db.collection('applications');
  const offerings = db.collection('offerings');
  const credentials = db.collection('credentials');
  // Do not invent or remove issued documents if legacy data already contains a
  // conflict. An operator must reconcile that specific record before proceeding.
  const duplicates = await credentials.aggregate([
    { $match: { applicationId: { $type: 'objectId' } } },
    { $group: { _id: '$applicationId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();
  if (duplicates.length) throw new Error(`Resolve duplicate credentials for applications: ${duplicates.map((d) => d._id).join(', ')}`);

  for await (const offering of offerings.find({})) {
    await applications.updateMany({ offeringSlug: offering.slug, offeringSnapshot: { $exists: false } }, { $set: { offeringSnapshot: snapshotOffering(offering) } });
    const admissions = [];
    for await (const application of applications.find({ offeringSlug: offering.slug, submittedAt: { $type: 'date' }, status: { $nin: ['withdrawn', 'declined', 'expired'] }, renewalOf: { $exists: false } })) {
      const window = (offering.intake?.windows ?? []).find((w) => w.opensAt && w.closesAt && application.submittedAt >= w.opensAt && application.submittedAt <= w.closesAt);
      const key = window?.key ?? (window ? `${window.opensAt.toISOString()}/${window.closesAt.toISOString()}` : 'rolling');
      admissions.push({ applicationId: application._id, window: key });
      await applications.updateOne({ _id: application._id }, { $set: { admissionWindow: key } });
    }
    for (const admission of admissions) await offerings.updateOne({ _id: offering._id, 'admissions.applicationId': { $ne: admission.applicationId } }, { $push: { admissions: admission } });
  }
  const indexes = await applications.indexes();
  const old = indexes.find((i) => i.key.userId === 1 && i.key.offeringSlug === 1);
  if (old) await applications.dropIndex(old.name);
  await applications.createIndex({ userId: 1, offeringSlug: 1 }, { unique: true, partialFilterExpression: { status: { $in: OPEN_APPLICATIONS } } });
  const credentialIndexes = await credentials.indexes();
  const oldCredential = credentialIndexes.find((i) => i.key.applicationId === 1 && !i.unique);
  if (oldCredential) await credentials.dropIndex(oldCredential.name);
  await credentials.createIndex({ applicationId: 1 }, { unique: true, partialFilterExpression: { applicationId: { $type: 'objectId' } } });
};
