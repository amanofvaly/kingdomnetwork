import mongoose from 'mongoose';

/**
 * Who may act for a church, and in what capacity.
 *
 * This is deliberately not a field on User. One person can be the registrar of
 * two ministries and an applicant at a third, and a church outlives whoever
 * signed it up — so authority is a relationship, not an attribute of an account.
 */

export const CHURCH_ROLES = ['owner', 'admin', 'registrar', 'instructor', 'finance', 'reviewer'];

/** What each role may do. Checked by `requireChurchRole` and mirrored in the client. */
export const CHURCH_ROLE_GRANTS = {
  owner: ['*'],
  admin: ['church:edit', 'church:publish', 'page:edit', 'media:write', 'authoring:write', 'applications:decide', 'applications:read', 'interviews:write', 'issuance:write', 'donations:read', 'finance:read', 'people:write'],
  registrar: ['applications:read', 'applications:decide', 'interviews:write', 'issuance:write', 'media:write'],
  instructor: ['authoring:write', 'media:write', 'applications:read'],
  finance: ['finance:read', 'finance:write', 'donations:read', 'payouts:write'],
  reviewer: ['applications:read', 'interviews:write'],
};

const membershipSchema = new mongoose.Schema(
  {
    churchSlug: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    role: { type: String, enum: CHURCH_ROLES, required: true },
    title: String,

    status: { type: String, enum: ['invited', 'active', 'suspended'], default: 'active', index: true },

    // Invitations exist before the person has an account, so they are keyed by
    // email until the invite is accepted.
    invitedEmail: { type: String, lowercase: true, trim: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    inviteToken: { type: String, index: true, select: false },
    inviteExpiresAt: Date,
    acceptedAt: Date,
  },
  { timestamps: true },
);

// One membership per person per church. Invitations have no userId yet, so the
// partial filter keeps every pending invite from colliding on a null.
membershipSchema.index(
  { churchSlug: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } },
);

membershipSchema.methods.can = function can(permission) {
  const grants = CHURCH_ROLE_GRANTS[this.role] ?? [];
  return grants.includes('*') || grants.includes(permission);
};

export const ChurchMembership = mongoose.model('ChurchMembership', membershipSchema);
