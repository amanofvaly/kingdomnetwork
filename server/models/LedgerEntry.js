import mongoose from 'mongoose';

/**
 * A church's running account with the platform, written append-only.
 *
 * A completed payment writes a credit for the gross and a debit for the
 * commission; a settlement writes a debit for what was paid out. The balance a
 * church sees is the last `balanceAfter`, and it is always explainable line by
 * line rather than recomputed from a query that might drift.
 */
const entrySchema = new mongoose.Schema(
  {
    churchSlug: { type: String, required: true, index: true },
    type: { type: String, enum: ['credit', 'fee', 'debit', 'settlement', 'refund', 'adjustment'], required: true },

    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    currency: { type: String, default: 'USD' },

    description: String,
    paymentRef: { type: String, index: true },
    settlementRef: { type: String, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

entrySchema.index({ churchSlug: 1, createdAt: -1 });

// One credit and one fee line per payment, enforced by the database rather than
// only by the code that writes them — the IPN and the browser callback arrive
// at the same moment and both describe the same payment.
entrySchema.index(
  { paymentRef: 1, type: 1 },
  { unique: true, partialFilterExpression: { paymentRef: { $type: 'string' } } },
);

export const LedgerEntry = mongoose.model('LedgerEntry', entrySchema);
