import { outcomeFitsType, defaultOutcomeForType } from '../lib/derive.js';

export const id = '009-outcome-follows-type';
export const description = 'File every listing under a comparison bucket its kind can be compared in';

/**
 * The panel used to ask for the kind and the bucket separately, with nothing
 * checking that the answers agreed — so a certificate could sit on the
 * ordination comparison page. The bucket now follows from the kind; anything
 * already filed somewhere its kind cannot go is moved to where it belongs.
 */
export const up = async (db) => {
  const offerings = db.collection('offerings');

  for await (const offering of offerings.find({})) {
    if (outcomeFitsType(offering.outcome, offering.type)) continue;

    const outcome = defaultOutcomeForType(offering.type);
    if (!outcome) {
      console.warn(`[kingdom-network] ${offering.slug} has an unknown kind (${offering.type}); left as it is`);
      continue;
    }

    await offerings.updateOne({ _id: offering._id }, { $set: { outcome } });
    console.log(`[kingdom-network] ${offering.slug}: ${offering.outcome} → ${outcome}`);
  }
};
