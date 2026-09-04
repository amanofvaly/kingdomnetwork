import mongoose from 'mongoose';

/**
 * A ministry on the platform: its public page, what it is allowed to do, what
 * it is owed, and how it is paid.
 *
 * A church publishes as soon as it finishes onboarding — nothing waits on us.
 * `verification` is a badge a platform administrator grants after checking
 * registration documents; it changes what visitors are told, not what the
 * church may do.
 */

const leaderSchema = new mongoose.Schema(
  {
    name: String,
    title: String,
    image: String,
    mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
    bio: String,
    // Set when this leader is also on the faculty, so one person is edited once.
    instructorSlug: String,
  },
  { _id: false },
);

/** One block on the church's public page. `data` differs per `type`. */
const sectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    order: { type: Number, default: 0 },
    visible: { type: Boolean, default: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const causeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    blurb: String,
    mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
    image: String,
    goalAmount: Number,
    raisedAmount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: false },
);

const churchSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    shortName: String,
    tagline: String,
    about: String,
    story: [String],

    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    city: String,
    country: String,
    region: { type: String, index: true },
    timezone: String,
    website: String,
    foundedYear: Number,

    denomination: String,
    tradition: String,
    statementOfFaith: [String],

    legal: {
      registeredName: String,
      registrationNumber: String,
      registrationCountry: String,
      taxId: String,
    },

    contact: {
      email: { type: String, lowercase: true, trim: true },
      phone: String,
      whatsapp: String,
      addressLines: [String],
      mapUrl: String,
      socials: {
        facebook: String,
        instagram: String,
        youtube: String,
        x: String,
      },
    },

    serviceTimes: [
      new mongoose.Schema({ day: String, time: String, label: String, format: String }, { _id: false }),
    ],

    coverImage: String,
    coverAlt: String,
    portraitImage: String,
    logoImage: String,
    monogram: String,
    galleryMediaIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' }],

    leaders: [leaderSchema],
    // Whose name and signature appear on documents this church issues.
    signatory: {
      name: String,
      title: String,
      signatureMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
    },

    specialties: { type: [String], index: true },
    languages: [String],
    deliveryModes: [String],

    status: { type: String, enum: ['draft', 'published', 'suspended'], default: 'published', index: true },
    publishedAt: Date,

    onboarding: {
      currentStep: { type: Number, default: 1 },
      completedSteps: { type: [Number], default: [] },
      startedAt: Date,
      completedAt: Date,
    },

    verification: {
      state: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified', index: true },
      submittedAt: Date,
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: Date,
      notes: String,
      documents: [
        new mongoose.Schema(
          {
            label: String,
            mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
            uploadedAt: Date,
          },
          { _id: false },
        ),
      ],
    },

    // Mirrors `verification.state === 'verified'`. Kept because the whole
    // read path — cards, rows, the directory, the passport — already renders
    // from it, and a boolean is what those surfaces actually want.
    verified: { type: Boolean, default: false, index: true },

    page: {
      accent: String,
      sections: [sectionSchema],
    },

    donations: {
      enabled: { type: Boolean, default: false },
      headline: String,
      blurb: String,
      causes: [causeSchema],
      suggestedAmounts: { type: [Number], default: [25, 50, 100, 250] },
      allowCustom: { type: Boolean, default: true },
      minAmount: { type: Number, default: 5 },
      allowAnonymous: { type: Boolean, default: true },
      thankYouMessage: String,
      showRecentGifts: { type: Boolean, default: false },
    },

    payout: {
      method: { type: String, enum: ['mpesa', 'mobile-money', 'bank'] },
      accountName: String,
      // Only the last four are ever rendered; the rest is stored encrypted.
      accountRefMasked: String,
      accountRefEncrypted: { type: String, select: false },
      bankName: String,
      branch: String,
      swift: String,
      country: String,
      confirmedAt: Date,
    },

    // Set only when this church has been agreed a rate other than the default.
    commissionPercentOverride: Number,

    demo: { type: Boolean, default: false, index: true },

    stats: {
      learners: Number,
      courses: Number,
      credentialsIssued: Number,
      yearsTeaching: Number,
    },

    rating: Number,
    ratingCount: Number,
  },
  { timestamps: true },
);

churchSchema.index({ name: 'text', about: 'text', specialties: 'text' });

churchSchema.pre('save', function syncVerified(next) {
  this.verified = this.verification?.state === 'verified';
  next();
});

export const Church = mongoose.model('Church', churchSchema);
