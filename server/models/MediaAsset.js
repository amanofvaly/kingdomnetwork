import mongoose from 'mongoose';

/**
 * Everything a church uploads: logos, cover photography, leader portraits,
 * lesson audio and video, and the documents applicants submit.
 *
 * `visibility` is the important field. Public assets are the church's own
 * imagery and can be served to anyone. Private assets are applicant evidence —
 * passport scans, ministry records, references — and are only ever served
 * through an authorised route to the applicant or to the church reviewing them.
 */

const mediaSchema = new mongoose.Schema(
  {
    churchSlug: { type: String, index: true, default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    kind: { type: String, enum: ['image', 'audio', 'video', 'document'], required: true, index: true },
    mimeType: { type: String, required: true },
    storageKey: { type: String, required: true, unique: true },
    checksum: { type: String, index: true },

    filename: String,
    bytes: Number,
    width: Number,
    height: Number,
    durationSeconds: Number,

    title: String,
    alt: String,
    tags: { type: [String], index: true },
    folder: { type: String, default: 'general', index: true },

    visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },

    // Where this file is referenced, so the library can warn before a delete.
    usage: [
      new mongoose.Schema(
        { entity: String, entityId: String, field: String },
        { _id: false },
      ),
    ],
  },
  { timestamps: true },
);

mediaSchema.index({ churchSlug: 1, folder: 1, createdAt: -1 });

export const MediaAsset = mongoose.model('MediaAsset', mediaSchema);
