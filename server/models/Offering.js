import mongoose from 'mongoose';

import { acquisitionFor, isCredentialType } from '../lib/derive.js';

/**
 * An Offering is one thing a church issues: a title, a standing, a document.
 *
 * The church writes it — the platform records what it requires and takes no
 * view on what a title should mean. A church service may never be granted on
 * payment alone: every listing carries a church decision. Ordination has a
 * stronger floor and always includes a live face-to-face meeting, by video or
 * in person. A fee starts an application; it never confers standing.
 */

/** `all` of them, `any` one of them, or `atLeast` a count. */
const groupSchema = (field) =>
  new mongoose.Schema(
    {
      label: String,
      mode: { type: String, enum: ['all', 'any', 'atLeast'], default: 'all' },
      count: { type: Number, default: 1 },
      [field]: [String],
      // Used with `atLeast` to count credit units rather than items, which is
      // how a church expresses "any courses totalling 12 credits".
      creditUnits: Number,
    },
    { _id: false },
  );

const requirementSchema = new mongoose.Schema(
  {
    // Coursework on this platform.
    courses: [String],
    courseGroups: [groupSchema('courseSlugs')],

    // Credentials the applicant must already hold — from any church. This is
    // what lets titles stack across ministries.
    credentials: [String],
    credentialGroups: [groupSchema('offeringSlugs')],

    assessment: {
      required: { type: Boolean, default: false },
      questionCount: Number,
      passMark: Number,
      minutes: Number,
      attemptsAllowed: Number,
    },

    interview: {
      required: { type: Boolean, default: false },
      faceToFace: { type: Boolean, default: false },
      durationMinutes: { type: Number, default: 30 },
      panelSize: { type: Number, default: 1 },
      instructions: String,
      whatIsAssessed: [String],
    },

    review: {
      required: { type: Boolean, default: false },
      turnaroundDays: Number,
      documents: [String],
    },

    documents: [
      new mongoose.Schema(
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          description: String,
          required: { type: Boolean, default: true },
          acceptedTypes: [String],
          maxMb: Number,
        },
        { _id: false },
      ),
    ],

    references: [
      new mongoose.Schema(
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          relationship: String,
          required: { type: Boolean, default: true },
        },
        { _id: false },
      ),
    ],

    attestations: [
      new mongoose.Schema(
        {
          key: { type: String, required: true },
          statement: { type: String, required: true },
          required: { type: Boolean, default: true },
        },
        { _id: false },
      ),
    ],

    minMonthsInMinistry: Number,
    minAge: Number,

    // Conditions the church states in its own words.
    eligibility: [String],
  },
  { _id: false },
);

const offeringSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    slugHistory: [String],
    churchSlug: { type: String, required: true, index: true },

    type: {
      type: String,
      required: true,
      index: true,
      enum: ['ordination', 'certificate', 'license', 'diploma', 'letter-of-standing', 'affiliation', 'invitation-letter'],
    },

    // Where in a church's own ladder this sits. Most traditions run
    // certified → licensed → ordained, and the tier makes that legible.
    tier: { type: String, enum: ['certified', 'licensed', 'ordained', 'diploma', 'other'], default: 'other' },

    // The comparison bucket. Many churches issue into the same outcome.
    outcome: { type: String, required: true, index: true },

    title: { type: String, required: true },
    subtitle: String,
    description: [String],

    // Required before publishing: what this confers and what it does not.
    disclosure: String,

    acquisition: {
      type: String,
      enum: ['instant', 'application', 'assessment', 'coursework', 'credentials', 'interview', 'review'],
      default: 'application',
      index: true,
    },
    requires: { type: requirementSchema, default: () => ({}) },

    assessmentSlug: { type: String, index: true },

    applicationForm: [
      new mongoose.Schema(
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          type: {
            type: String,
            enum: ['text', 'textarea', 'select', 'multiselect', 'date', 'number', 'checkbox'],
            default: 'text',
          },
          options: [String],
          required: { type: Boolean, default: false },
          help: String,
        },
        { _id: false },
      ),
    ],

    // What it costs to apply. Never the price of the title.
    fee: {
      amount: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'USD' },
      label: { type: String, default: 'Application fee' },
      refundable: { type: Boolean, default: false },
      refundPolicy: String,
      renewalAmount: Number,
    },
    // Mirrors `fee.amount` so existing sorting, faceting and price ranges,
    // which all read `price`, keep working unchanged.
    price: { type: Number, required: true, index: true },
    compareAtPrice: Number,
    currency: { type: String, default: 'USD' },

    renewal: {
      required: { type: Boolean, default: false },
      everyMonths: Number,
      continuingEducationHours: Number,
      graceDays: { type: Number, default: 30 },
    },

    creditValue: Number,
    curriculumOutline: [
      new mongoose.Schema(
        { stage: Number, label: String, description: String, courseSlugs: [String], creditUnits: Number },
        { _id: false },
      ),
    ],

    capacity: Number,
    intake: {
      mode: { type: String, enum: ['rolling', 'windows'], default: 'rolling' },
      windows: [
        new mongoose.Schema({ opensAt: Date, closesAt: Date, seats: Number }, { _id: false }),
      ],
    },

    letter: {
      destinationCountry: { type: String, index: true },
      destinationCity: String,
      purpose: String,
      validityMonths: Number,
      turnaroundDays: Number,
      hostCommitment: String,
    },

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
    coverMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },

    rating: Number,
    ratingCount: Number,
    issuedCount: { type: Number, default: 0 },
    applicationCount: { type: Number, default: 0 },

    // Platform merchandising. Withheld from credential types, which are not
    // merchandised — see the ethics rules in `server/lib/disclosures.js`.
    featured: { type: Boolean, default: false, index: true },
    editorsPick: { type: Boolean, default: false },
    boost: { type: Number, default: 0 },
    badge: String,

    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    publishedAt: Date,
    // Retained so existing queries that filter on it keep working.
    published: { type: Boolean, default: false, index: true },
    demo: { type: Boolean, default: false, index: true },

    authoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

offeringSchema.index({ title: 'text', subtitle: 'text', outcome: 'text' });
offeringSchema.index({ outcome: 1, price: 1 });
offeringSchema.index({ outcome: 1, boost: -1, issuedCount: -1 });
offeringSchema.index({ churchSlug: 1, status: 1 });

/**
 * Derived on every write rather than once at seed time — the moment a church
 * can edit requirements, anything computed only at seed time is wrong.
 */
offeringSchema.pre('save', function derive(next) {
  if (this.fee?.amount != null) this.price = this.fee.amount;
  else if (this.price != null) this.set('fee.amount', this.price);

  // These are ethical floors, not defaults a church may switch off. Every
  // service ends in a church decision; ordination also requires a live visual
  // meeting so it can never collapse into documents, coursework and payment.
  if (!this.requires?.review?.required && !this.requires?.interview?.required) {
    this.set('requires.review.required', true);
  }
  if (this.type === 'ordination') {
    this.set('requires.interview.required', true);
    this.set('requires.interview.faceToFace', true);
  }

  this.acquisition = acquisitionFor(this.requires, this.type);
  this.published = this.status === 'published';

  // Discount anchors and merchandising badges belong on materials, not on
  // ministerial standing. Strip them rather than relying on the view to hide them.
  if (isCredentialType(this.type)) {
    this.compareAtPrice = undefined;
    this.badge = undefined;
  }

  next();
});

export const Offering = mongoose.model('Offering', offeringSchema);
