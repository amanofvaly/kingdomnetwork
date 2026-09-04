export const id = '007-private-resource-files';
export const description = 'Make the files a church sells private, so a purchase is what grants access';

/**
 * Every file uploaded before this was stored public, which meant the URL in a
 * buyer's library was equally good in anyone else's hands. Covers and samples
 * are deliberately left alone: they are the part that sells the item.
 */
export const up = async (db) => {
  const sold = await db
    .collection('resources')
    .distinct('fileMediaIds', { fileMediaIds: { $exists: true, $ne: [] } });

  if (!sold.length) return;

  await db.collection('mediaassets').updateMany(
    { _id: { $in: sold }, visibility: { $ne: 'private' } },
    { $set: { visibility: 'private' } },
  );
};
