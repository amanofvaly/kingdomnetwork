import mongoose from 'mongoose';

/**
 * A purchase of materials: coursework and resources.
 *
 * Credentials do not come through here. Applying for standing is not a
 * transaction with a basket, and the fee attached to it is an application fee
 * recorded on a Payment against the Application — see `server/models/Payment.js`.
 */

const itemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['course', 'resource'], required: true },
    slug: { type: String, required: true },
    title: String,
    image: String,
    churchSlug: String,
    churchName: String,
    price: Number,
    compareAtPrice: Number,
    type: String,
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    items: [itemSchema],
    subtotal: Number,
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'USD' },

    // The gateway record. One order can span several churches, so a payment is
    // created per church and this holds them all.
    paymentRefs: [{ type: String, index: true }],

    billing: {
      name: String,
      email: String,
      country: String,
      phone: String,
    },

    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending', index: true },
    paidAt: Date,
  },
  { timestamps: true },
);

export const Order = mongoose.model('Order', orderSchema);
