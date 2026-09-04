import mongoose from 'mongoose';

/**
 * Money moving through the platform, whatever it was for.
 *
 * Pesapal has no split-payment facility, so every payment lands in the platform's
 * own account and what each church is owed is a number we keep. `platformFee`
 * and `netToChurch` are frozen onto the row at the moment it completes, so a
 * later change to the commission rate cannot retroactively alter what a church
 * was owed for a gift it has already received.
 */

export const PAYMENT_KINDS = ['application_fee', 'renewal_fee', 'course', 'resource', 'donation'];

const paymentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: PAYMENT_KINDS, required: true, index: true },

    // Absent for an anonymous gift, which needs no account.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    churchSlug: { type: String, required: true, index: true },

    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', index: true },
    orderRef: { type: String, index: true },

    donation: {
      causeId: String,
      causeTitle: String,
      message: String,
      anonymous: { type: Boolean, default: false },
      displayName: String,
      consentToDisplay: { type: Boolean, default: false },
    },

    description: String,
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    commissionPercent: Number,
    platformFee: { type: Number, default: 0 },
    netToChurch: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['created', 'pending', 'completed', 'failed', 'reversed', 'refunded'],
      default: 'created',
      index: true,
    },

    provider: { type: String, default: 'pesapal' },
    pesapal: {
      orderTrackingId: { type: String, index: true },
      merchantReference: String,
      redirectUrl: String,
      confirmationCode: String,
      paymentMethod: String,
      paymentAccount: String,
      statusCode: Number,
      statusDescription: String,
      lastCheckedAt: Date,
    },

    payer: {
      name: String,
      email: { type: String, lowercase: true, trim: true },
      phone: String,
      country: String,
    },

    // Every notification Pesapal sent us, kept for reconciliation.
    ipnEvents: [
      new mongoose.Schema({ at: { type: Date, default: Date.now }, raw: mongoose.Schema.Types.Mixed }, { _id: false }),
    ],

    settlementRef: { type: String, index: true },
    completedAt: Date,
    refundedAt: Date,
    refundReason: String,
  },
  { timestamps: true },
);

paymentSchema.index({ churchSlug: 1, status: 1, completedAt: -1 });
// Finding what is owed to a church: completed, and not yet in a settlement.
paymentSchema.index({ churchSlug: 1, status: 1, settlementRef: 1 });

export const Payment = mongoose.model('Payment', paymentSchema);
