import mongoose from 'mongoose';

/**
 * Books, study guides, sermon series and audio a church already has and can
 * sell as material.
 *
 * Kept apart from Offering on purpose. An Offering confers standing on a
 * person and has to be applied for; a Resource is a thing you buy and download.
 * Collapsing them would drag commerce language back onto credentials, which is
 * exactly what the application flow exists to separate.
 */

export const RESOURCE_KINDS = ['book', 'audiobook', 'study-guide', 'sermon-series', 'album', 'workbook'];

const resourceSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    churchSlug: { type: String, required: true, index: true },

    kind: { type: String, enum: RESOURCE_KINDS, default: 'book', index: true },
    title: { type: String, required: true },
    subtitle: String,
    description: [String],
    authorName: String,

    coverImage: String,
    coverAlt: String,
    coverMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },

    // What the buyer receives, and what anyone may sample first.
    fileMediaIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' }],
    previewMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },

    pages: Number,
    durationMinutes: Number,
    language: { type: String, default: 'English' },
    tags: { type: [String], index: true },

    price: { type: Number, required: true, min: 0 },
    compareAtPrice: Number,
    currency: { type: String, default: 'USD' },

    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    publishedAt: Date,
    slugHistory: [String],
    demo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

resourceSchema.index({ title: 'text', subtitle: 'text', tags: 'text' });

export const Resource = mongoose.model('Resource', resourceSchema);
