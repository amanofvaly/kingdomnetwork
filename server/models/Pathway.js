import mongoose from 'mongoose';

const stepSchema = new mongoose.Schema(
  {
    order: Number,
    kind: { type: String, enum: ['course', 'review', 'exam', 'practicum', 'interview'], default: 'course' },
    courseSlug: String,
    title: { type: String, required: true },
    description: String,
    weeks: Number,
    required: { type: Boolean, default: true },
  },
  { _id: false },
);

const pathwaySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    subtitle: String,
    description: [String],

    churchSlug: { type: String, required: true, index: true },
    category: { type: String, default: 'Ordination' },

    coverImage: String,
    coverAlt: String,

    price: { type: Number, required: true },
    compareAtPrice: Number,
    currency: { type: String, default: 'USD' },

    months: Number,
    level: String,
    rating: Number,
    ratingCount: Number,
    learners: Number,

    steps: [stepSchema],
    eligibility: [String],
    outcomes: [String],

    award: {
      title: String,
      kind: { type: String, default: 'Ordination' },
      description: String,
    },

    demo: { type: Boolean, default: true },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Pathway = mongoose.model('Pathway', pathwaySchema);
