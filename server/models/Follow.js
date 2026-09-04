import mongoose from 'mongoose';

/**
 * A person choosing to hear from a church.
 *
 * Deliberately not a ChurchMembership: that is authority over a church and is
 * granted by the church. This is interest in one, and is granted by the person
 * — no approval, no notification, nothing for the church to accept.
 */
const followSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    churchSlug: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

followSchema.index({ userId: 1, churchSlug: 1 }, { unique: true });
// Counting a church's followers.
followSchema.index({ churchSlug: 1, createdAt: -1 });

export const Follow = mongoose.model('Follow', followSchema);
