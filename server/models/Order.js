import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['course', 'pathway'], required: true },
    slug: { type: String, required: true },
    title: String,
    image: String,
    churchSlug: String,
    churchName: String,
    price: Number,
    compareAtPrice: Number,
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

    payment: {
      method: {
        type: String,
        enum: ['mpesa', 'airtel-money', 'mtn-momo', 'card', 'paypal', 'bank-transfer'],
        required: true,
      },
      label: String,
      // Simulated gateway fields — no real credentials are used yet.
      account: String,
      reference: String,
      simulated: { type: Boolean, default: true },
    },

    billing: {
      name: String,
      email: String,
      country: String,
      phone: String,
    },

    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    paidAt: Date,
  },
  { timestamps: true },
);

export const Order = mongoose.model('Order', orderSchema);
