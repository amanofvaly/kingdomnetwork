import mongoose from 'mongoose';

/**
 * Something worth telling the people who follow a church.
 *
 * Three kinds, because three different things are worth seeing in a feed and
 * they are not the same thing wearing different clothes:
 *
 *   update      a church says something, in its own words
 *   offering    a church published something new to apply for
 *   credential  a person was granted standing and chose to say so
 *
 * The author is therefore not always a church, which is why authorship is a
 * pair of fields rather than one reference. A credential post is authored by
 * the person but still carries `churchSlug`, because the church that granted
 * it is part of what the post says.
 */

export const POST_KINDS = ['update', 'offering', 'credential'];
export const REACTIONS = ['amen', 'pray', 'love', 'celebrate'];

const imageSchema = new mongoose.Schema(
  {
    mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
    url: { type: String, required: true },
    alt: String,
  },
  { _id: false },
);

const postSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: POST_KINDS, default: 'update', index: true },
    authorKind: { type: String, enum: ['church', 'user'], default: 'church', index: true },

    churchSlug: { type: String, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    body: { type: String, maxlength: 2000 },
    images: { type: [imageSchema], default: [] },

    offeringSlug: { type: String, index: true },
    credentialId: { type: String, index: true },

    // Kept on the row so a feed of fifty posts is one query, not fifty-one.
    // Reaction writes recompute these; the Reaction rows remain the truth.
    reactionCounts: {
      amen: { type: Number, default: 0 },
      pray: { type: Number, default: 0 },
      love: { type: Number, default: 0 },
      celebrate: { type: Number, default: 0 },
    },
    reactionTotal: { type: Number, default: 0, index: true },

    // Seeded posts carry a baseline so a demonstration feed looks like a place
    // people are, rather than a fixture with nothing on it. Recounting adds
    // real reactions to this rather than replacing it, so a genuine reaction
    // can never silently erase the baseline it was added to.
    demoReactions: {
      amen: { type: Number, default: 0 },
      pray: { type: Number, default: 0 },
      love: { type: Number, default: 0 },
      celebrate: { type: Number, default: 0 },
    },

    status: { type: String, enum: ['published', 'removed'], default: 'published', index: true },
    publishedAt: { type: Date, default: Date.now, index: true },
    demo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// A church's own wall, and the two orders the feed reads in.
postSchema.index({ churchSlug: 1, status: 1, publishedAt: -1 });
postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ status: 1, reactionTotal: -1, publishedAt: -1 });

export const Post = mongoose.model('Post', postSchema);
