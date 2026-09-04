import mongoose from 'mongoose';

import { assignCurriculumKeys, tallyCurriculum } from '../lib/derive.js';

/**
 * Coursework a church teaches. Course → Section → Lecture.
 *
 * `key` on sections and lectures is the important field. Progress is stored
 * against lecture keys, and keys used to be derived from the lecture's title —
 * so retitling a lesson silently orphaned every learner's progress. Keys are
 * now generated once and never change; the title is free to.
 */

const questionSchema = new mongoose.Schema(
  {
    prompt: String,
    options: [String],
    answer: Number,
    explanation: String,
  },
  { _id: false },
);

const lectureSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    // The title-derived identifier the original catalogue used. Kept so seeded
    // content and old links still resolve; `key` is what progress is stored on.
    id: String,
    title: { type: String, required: true },
    kind: {
      type: String,
      enum: ['video', 'reading', 'audio', 'quiz', 'assignment', 'live-session'],
      default: 'video',
    },
    minutes: { type: Number, default: 0 },
    preview: { type: Boolean, default: false },
    summary: String,

    // Reading lectures carry their body inline; video and audio carry a source.
    body: [String],
    source: String,
    mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },

    questions: [questionSchema],

    assignment: {
      brief: String,
      rubric: [
        new mongoose.Schema({ criterion: String, outOf: Number, guidance: String }, { _id: false }),
      ],
      submissionTypes: [String],
      dueDays: Number,
    },

    liveSession: {
      startsAt: Date,
      provider: String,
      joinUrl: String,
      instructions: String,
    },
  },
  { _id: false },
);

const sectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    id: String,
    title: { type: String, required: true },
    summary: String,
    lectures: [lectureSchema],
  },
  { _id: false },
);

const courseSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    slugHistory: [String],
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
    coverMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' },

    rating: Number,
    ratingCount: Number,
    learners: Number,

    totalMinutes: Number,
    lectureCount: Number,
    articleCount: Number,
    resourceCount: Number,
    quizCount: Number,
    creditUnits: Number,

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
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    publishedAt: Date,
    published: { type: Boolean, default: false, index: true },
    version: { type: Number, default: 1 },
    demo: { type: Boolean, default: false, index: true },
    authoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// `language_override` points at a field that does not exist, so Mongo stops
// reading `language` as a stemmer to use. That field means the language the
// teaching is in — Luganda, Runyankole, Swahili — and most of those have no
// stemmer, which would otherwise make the document unsaveable.
courseSchema.index(
  { title: 'text', subtitle: 'text', tags: 'text' },
  { language_override: 'textLanguage' },
);
courseSchema.index({ churchSlug: 1, status: 1 });

courseSchema.pre('save', function derive(next) {
  if (this.isModified('curriculum')) {
    this.curriculum = assignCurriculumKeys(this.curriculum);
    Object.assign(this, tallyCurriculum(this.curriculum));
    if (!this.isNew) this.version += 1;
  }
  this.published = this.status === 'published';
  next();
});

export const Course = mongoose.model('Course', courseSchema);
