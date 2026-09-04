export const id = '009-donations-on-by-default';
export const description = 'Open giving on churches that never chose to close it';

/**
 * `donations.enabled` used to default to false, so every church registered
 * before this could not receive a gift until someone found the switch — which
 * is why no church page showed a Give button. The default is now true.
 *
 * Only churches that never expressed a preference are opened: a church whose
 * giving settings were actually touched (a headline, a cause, its own suggested
 * amounts) had a chance to turn it off, and its `false` is a decision worth
 * respecting rather than a leftover default.
 */
export const up = async (db) => {
  const churches = db.collection('churches');

  const untouched = {
    'donations.enabled': { $ne: true },
    $and: [
      { $or: [{ 'donations.headline': { $in: [null, ''] } }, { 'donations.headline': { $exists: false } }] },
      { $or: [{ 'donations.blurb': { $in: [null, ''] } }, { 'donations.blurb': { $exists: false } }] },
      { $or: [{ 'donations.causes': { $size: 0 } }, { 'donations.causes': { $exists: false } }] },
    ],
  };

  const result = await churches.updateMany(untouched, { $set: { 'donations.enabled': true } });
  console.log(`[009] opened giving on ${result.modifiedCount} church(es)`);
};
