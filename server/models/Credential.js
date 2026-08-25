import mongoose from 'mongoose';

const credentialSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    credentialId: { type: String, required: true, unique: true, index: true },

    kind: {
      type: String,
      enum: ['certificate', 'ordination', 'license', 'affiliation', 'invitation-letter'],
      default: 'certificate',
    },
    // The listing this was issued against.
    offeringSlug: { type: String, index: true },
    postNominal: String,
    // Invitation letters carry where they invite the holder to.
    destinationCountry: String,
    destinationCity: String,
    purpose: String,
    // Requirements still outstanding before the church will issue.
    outstanding: [String],
    title: { type: String, required: true },
    holderName: String,

    churchSlug: String,
    churchName: String,
    courseSlug: String,
    pathwaySlug: String,

    status: { type: String, enum: ['in-progress', 'in-review', 'issued', 'revoked'], default: 'issued' },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    verifyCode: { type: String, index: true },

    notes: String,
  },
  { timestamps: true },
);

export const Credential = mongoose.model('Credential', credentialSchema);
