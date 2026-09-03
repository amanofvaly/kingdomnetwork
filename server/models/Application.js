import mongoose from 'mongoose';

/**
 * Someone asking a church to credential them.
 *
 * Until now this did not exist: a Credential in `in-progress` or `in-review`
 * *was* the application, with its outstanding requirements encoded as strings
 * like `'course:foundations'` and parsed back out by character offset. That
 * left nowhere to record the answers on a form, an uploaded document, a
 * reference, an interview or a decision — and no way for a church to ever sign
 * one off, which is why nothing in the old system could leave `in-review`.
 *
 * A Credential is now only ever the issued artifact. This is the process.
 */

export const APPLICATION_STATUSES = [
  'draft',
  'fee_pending',
  'submitted',
  'under_review',
  'info_requested',
  'coursework',
  'assessment',
  'interview',
  'final_review',
  'approved',
  'issued',
  'declined',
  'withdrawn',
  'expired',
];

export const STEP_TYPES = [
  'fee',
  'form',
  'attestation',
  'document',
  'reference',
  'course',
  'credential',
  'assessment',
  'interview',
  'review',
];

const stepSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    type: { type: String, enum: STEP_TYPES, required: true },
    label: String,
    detail: String,
    // `waived` is a first-class outcome: a church routinely accepts prior
    // service in place of a requirement, and that has to be recorded, not faked
    // by marking something complete that never happened.
    status: { type: String, enum: ['pending', 'active', 'complete', 'waived', 'failed'], default: 'pending' },
    startedAt: Date,
    completedAt: Date,
    waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    waiverReason: String,
    note: String,
    meta: mongoose.Schema.Types.Mixed,
  },
  { _id: false },
);

const documentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: String,
    mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
    uploadedAt: Date,
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    note: String,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { _id: false },
);

const referenceSchema = new mongoose.Schema(
  {
    key: String,
    name: String,
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    relationship: String,
    status: { type: String, enum: ['pending', 'sent', 'received', 'declined'], default: 'pending' },
    // The referee answers without an account, so the link carries a secret.
    token: { type: String, select: false },
    sentAt: Date,
    respondedAt: Date,
    response: String,
    recommend: { type: String, enum: ['yes', 'reservations', 'no'] },
  },
  { _id: false },
);

const timelineSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: String,
    event: { type: String, required: true },
    note: String,
    // Internal notes exist; the applicant must not see them.
    visibility: { type: String, enum: ['church', 'applicant', 'both'], default: 'both' },
  },
  { _id: false },
);

const applicationSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    churchSlug: { type: String, required: true, index: true },
    offeringSlug: { type: String, required: true, index: true },
    offeringTitle: String,

    status: { type: String, enum: APPLICATION_STATUSES, default: 'draft', index: true },
    steps: [stepSchema],

    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    documents: [documentSchema],
    references: [referenceSchema],
    attestations: [
      new mongoose.Schema({ key: String, statement: String, agreedAt: Date }, { _id: false }),
    ],

    attemptIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentAttempt' }],
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview' },
    paymentRef: { type: String, index: true },
    credentialId: { type: String, index: true },

    infoRequest: {
      message: String,
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      requestedAt: Date,
      resolvedAt: Date,
    },

    decision: {
      outcome: { type: String, enum: ['approved', 'declined', 'deferred'] },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
      reason: String,
      publicNote: String,
      internalNote: String,
    },

    timeline: [timelineSchema],

    submittedAt: Date,
    decidedAt: Date,
    issuedAt: Date,
    expiresAt: Date,
  },
  { timestamps: true },
);

// The church queue reads by status and by what it is waiting on.
applicationSchema.index({ churchSlug: 1, status: 1, updatedAt: -1 });
applicationSchema.index({ userId: 1, createdAt: -1 });
// One live application per person per listing. Withdrawn and declined ones are
// excluded so a second attempt after a decline is allowed.
applicationSchema.index(
  { userId: 1, offeringSlug: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $nin: ['withdrawn', 'declined', 'expired'] } },
  },
);

applicationSchema.methods.log = function log(entry) {
  this.timeline.push({ at: new Date(), ...entry });
  return this;
};

export const Application = mongoose.model('Application', applicationSchema);
