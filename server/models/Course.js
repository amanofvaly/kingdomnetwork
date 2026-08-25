import mongoose from 'mongoose';

const lectureSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    kind: { type: String, enum: ['video', 'reading', 'audio', 'quiz', 'assignment'], default: 'video' },
    minutes: { type: Number, default: 0 },
    preview: { type: Boolean, default: false },
    summary: String,
    // Reading lectures carry their body inline; video/audio carry a source.
    body: [String],
    source: String,
    questions: [
      new mongoose.Schema(
        {
          prompt: String,
          options: [String],
          answer: Number,
          explanation: String,
        },
        { _id: false },
      ),
    ],
  },
  { _id: false },
);

const sectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    summary: String,
    lectures: [lectureSchema],
  },
  { _id: false },
);

const courseSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    subtitle: String,
    description: [String],

    churchSlug: { type: String, required: true, index: true },
    instructorSlugs: [String],

    category: { type: String, index: true },
    subcategory: String,
    level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'All levels'], default: 'All levels' },
    language: { type: String, default: 'English' },
    captions: [String],
    tags: { type: [String], index: true },

    price: { type: Number, required: true },
    compareAtPrice: Number,
    currency: { type: String, default: 'USD' },

    coverImage: String,
    coverAlt: String,

    rating: Number,
    ratingCount: Number,
    learners: Number,

    totalMinutes: Number,
    lectureCount: Number,
    articleCount: Number,
    resourceCount: Number,
    quizCount: Number,

    updatedMonth: String,

    outcomes: [String],
    requirements: [String],
    audience: [String],
    includes: [String],

    curriculum: [sectionSchema],

    certificate: {
      awarded: { type: Boolean, default: true },
      title: String,
      kind: { type: String, default: 'Certificate' },
      description: String,
    },

    bestseller: { type: Boolean, default: false },
    demo: { type: Boolean, default: true },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
);

courseSchema.index({ title: 'text', subtitle: 'text', tags: 'text' });

export const Course = mongoose.model('Course', courseSchema);
