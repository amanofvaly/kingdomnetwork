import mongoose from 'mongoose';

import { env } from '../config/env.js';

/**
 * A single document holding what platform administrators control at runtime:
 * the commission, the homepage merchandising slots, whether demonstration
 * content is visible, and the Pesapal IPN id we were issued.
 */
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'platform', unique: true },

    commissionPercent: { type: Number, default: () => env.commissionPercent, min: 0, max: 100 },
    currency: { type: String, default: 'USD' },

    // Registering an IPN URL with Pesapal returns an id that every order must
    // then quote. It is registered once and kept here.
    pesapal: {
      ipnId: String,
      ipnUrl: String,
      // Which Pesapal account issued this id. An id from the live account is
      // meaningless on sandbox and vice versa, so the environment is part of
      // what makes a stored registration still valid.
      environment: String,
      registeredAt: Date,
    },

    // Demonstration churches and listings are seeded content. When this is off
    // they disappear from every public read.
    demoMode: { type: Boolean, default: () => env.demoMode },

    // What the homepage hero and rails show. Replaces the offer that used to be
    // baked into a JPEG with invisible click targets over it.
    homeSlots: [
      new mongoose.Schema(
        {
          position: { type: String, enum: ['hero', 'rail-1', 'rail-2'], required: true },
          offeringSlug: String,
          churchSlug: String,
          headline: String,
          blurb: String,
          mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
          active: { type: Boolean, default: true },
        },
        { _id: false },
      ),
    ],

    disclosures: {
      credential: String,
      invitationLetter: String,
      donation: String,
    },

    features: {
      donations: { type: Boolean, default: true },
      resources: { type: Boolean, default: true },
      selfServeOnboarding: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

/** There is only ever one. Created on first read so nothing has to seed it. */
settingsSchema.statics.load = async function load() {
  return this.findOneAndUpdate(
    { key: 'platform' },
    { $setOnInsert: { key: 'platform' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

export const PlatformSettings = mongoose.model('PlatformSettings', settingsSchema);
