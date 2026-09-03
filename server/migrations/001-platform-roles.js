export const id = '001-platform-roles';
export const description = 'Move church authority off User.role and into ChurchMembership';

/**
 * `role` used to mix two different questions: what someone is on the platform,
 * and which church they act for. Accounts marked `church` become ordinary
 * members with a membership record for the church named on them.
 */
export const up = async (db) => {
  const users = db.collection('users');

  await users.updateMany({ role: 'admin' }, { $set: { role: 'platform_admin' } });

  const churchAccounts = await users.find({ role: 'church' }).toArray();
  const memberships = db.collection('churchmemberships');

  for (const user of churchAccounts) {
    if (user.churchSlug) {
      const existing = await memberships.findOne({ churchSlug: user.churchSlug, userId: user._id });
      if (!existing) {
        await memberships.insertOne({
          churchSlug: user.churchSlug,
          userId: user._id,
          role: 'owner',
          status: 'active',
          acceptedAt: user.createdAt ?? new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  await users.updateMany({ role: { $in: ['learner', 'church'] } }, { $set: { role: 'member' } });
  await users.updateMany({ status: { $exists: false } }, { $set: { status: 'active' } });
};
