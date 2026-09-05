import mongoose from 'mongoose';

/**
 * What a person holds, once a church has decided to issue it.
 *
 * This used to double as the application, carrying the requirements still
 * outstanding as an array of strings. That job now belongs to Application; a
 * Credential only ever exists because someone signed it off, and everything on
 * it is a fact about the issued document.
 */
const credentialSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    credentialId: { type: String, required: true, unique: true, index: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },

    kind: {
      type: String,
      enum: ['certificate', 'ordination', 'license', 'diploma', 'letter-of-standing', 'affiliation', 'invitation-letter'],
      default: 'certificate',
    },
    offeringSlug: { type: String, index: true },
    title: { type: String, required: true },
    postNominal: String,
    holderName: String,

    churchSlug: { type: String, index: true },
    churchName: String,
    courseSlug: String,

    // Invitation letters carry where they invite the holder to.
    destinationCountry: String,
    destinationCity: String,
    purpose: String,

    status: { type: String, enum: ['issued', 'expired', 'revoked'], default: 'issued', index: true },

    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    signatory: {
      name: String,
      title: String,
      signatureMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },
    },

    expiresAt: Date,
    renewal: {
      required: { type: Boolean, default: false },
      dueAt: Date,
      lastRenewedAt: Date,
      renewalCount: { type: Number, default: 0 },
      continuingEducationHours: Number,
    },

    revocation: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
      reason: String,
      publicReason: String,
    },

    verifyCode: { type: String, index: true },
    // The rendered PDF, kept so the issued document never changes after the
    // fact because a template or a church's details were later edited.
    documentMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },

    notes: String,
  },
  { timestamps: true },
);

credentialSchema.index({ applicationId: 1 }, { unique: true, partialFilterExpression: { applicationId: { $type: 'objectId' } } });

credentialSchema.index({ userId: 1, status: 1, issuedAt: -1 });
credentialSchema.index({ churchSlug: 1, issuedAt: -1 });

export const Credential = mongoose.model('Credential', credentialSchema);
