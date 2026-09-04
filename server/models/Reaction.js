import mongoose from 'mongoose';

/**
 * One person's response to one post.
 *
 * Unique per person per post: choosing a different reaction replaces the one
 * before it rather than adding to it, the way it reads to a person — you do
 * not both pray and celebrate, you change your mind.
 */
const reactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    type: { type: String, required: true },
  },
  { timestamps: true },
);

reactionSchema.index({ userId: 1, postId: 1 }, { unique: true });

export const Reaction = mongoose.model('Reaction', reactionSchema);
