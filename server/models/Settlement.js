import mongoose from 'mongoose';

/**
 * A payout run: everything a church was owed over a period, paid out off the
 * platform and then recorded here by whoever paid it. The platform does not
 * move the money itself, so the truthful model is a record marked paid by a
 * named administrator with a reference and evidence attached — not an
 * automated transfer we would be pretending to make.
 */
const settlementSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    churchSlug: { type: String, required: true, index: true },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    paymentRefs: [String],
    paymentCount: Number,
    gross: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    net: { type: Number, required: true },
    currency: { type: String, default: 'USD' },

    status: {
      type: String,
      enum: ['draft', 'pending', 'paid', 'failed', 'cancelled'],
      default: 'draft',
      index: true,
    },

    method: String,
    destination: String,
    externalRef: String,
    evidenceMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },

    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidAt: Date,
    notes: String,
  },
  { timestamps: true },
);

settlementSchema.index({ churchSlug: 1, createdAt: -1 });

export const Settlement = mongoose.model('Settlement', settlementSchema);
