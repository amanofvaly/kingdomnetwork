import mongoose from 'mongoose';

/**
 * An Offering is one thing a church sells: a title, a document, a standing.
 *
 * Churches define these themselves — the platform records and sells them and
 * takes no view on what a title should mean. Everything a church lists is
 * live immediately; sorting is done by reputation and by our own merchandising
 * rather than by a permission gate.
 */

const requirementSchema = new mongoose.Schema(
  {
    // Courses the buyer must complete before the award is issued.
    courses: [String],
    // Other offerings the buyer must already hold. This is what makes titles stack.
    credentials: [String],
    // A short assessment sat on the platform.
    assessment: {
      required: { type: Boolean, default: false },
      questionCount: Number,
      passMark: Number,
      minutes: Number,
    },
    // The church looks at documents off-platform before issuing.
    review: {
      required: { type: Boolean, default: false },
      turnaroundDays: Number,
      documents: [String],
    },
    // Free-text conditions the church states in its own words.
    eligibility: [String],
  },
  { _id: false },
);

const offeringSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    churchSlug: { type: String, required: true, index: true },

    // What kind of thing this is. Drives the page layout and the document issued.
    type: {
      type: String,
      required: true,
      index: true,
      enum: ['ordination', 'certificate', 'license', 'affiliation', 'invitation-letter'],
    },

    // The comparison bucket. Many churches sell into the same outcome, and the
    // outcome page is where they compete.
    outcome: { type: String, required: true, index: true },

    title: { type: String, required: true },
    subtitle: String,
    description: [String],

    // How the buyer gets it. Derived from `requires` at seed time so the card
    // can show it without loading the requirement tree.
    acquisition: {
      type: String,
      enum: ['instant', 'assessment', 'coursework', 'credentials', 'review'],
      default: 'instant',
      index: true,
    },
    requires: requirementSchema,

    price: { type: Number, required: true, index: true },
    compareAtPrice: Number,
    currency: { type: String, default: 'USD' },

    // Invitation letters only. The destination is the whole point of the product —
    // a letter is worth having when it comes from a church in the country the
    // buyer is travelling to.
    letter: {
      destinationCountry: { type: String, index: true },
      destinationCity: String,
      purpose: String,
      validityMonths: Number,
      turnaroundDays: Number,
      hostCommitment: String,
    },

    // What lands in the buyer's passport.
    award: {
      title: String,
      postNominal: String,
      documentTitle: String,
      documentBody: String,
      validityMonths: Number,
      renewable: { type: Boolean, default: false },
    },

    coverImage: String,
    coverAlt: String,

    rating: Number,
    ratingCount: Number,
    issuedCount: Number,

    // Our merchandising. This is the lever we control on an open marketplace.
    featured: { type: Boolean, default: false, index: true },
    editorsPick: { type: Boolean, default: false },
    boost: { type: Number, default: 0 },
    badge: String,

    published: { type: Boolean, default: true },
    demo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

offeringSchema.index({ title: 'text', subtitle: 'text', outcome: 'text' });
offeringSchema.index({ outcome: 1, price: 1 });
offeringSchema.index({ outcome: 1, boost: -1, issuedCount: -1 });

export const Offering = mongoose.model('Offering', offeringSchema);
