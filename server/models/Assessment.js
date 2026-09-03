import mongoose from 'mongoose';

/**
 * A test a church writes for itself.
 *
 * The old system had one hardcoded bank of ten questions per outcome, shared by
 * every church, with the paper capped at ten no matter what the listing claimed
 * to ask. A church that credentials people has to be able to set its own paper.
 */

export const QUESTION_TYPES = ['single', 'multiple', 'true-false', 'short-answer', 'essay'];

const questionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    type: { type: String, enum: QUESTION_TYPES, default: 'single' },
    prompt: { type: String, required: true },
    help: String,
    points: { type: Number, default: 1 },

    // single / multiple / true-false
    options: [String],
    // Indexes into `options`. One entry for `single` and `true-false`.
    answers: [Number],

    // short-answer: any of these, compared case- and whitespace-insensitively.
    accepted: [String],

    // essay: graded by a person against this guidance.
    rubric: [String],

    explanation: String,
  },
  { _id: false },
);

const assessmentSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    churchSlug: { type: String, required: true, index: true },

    title: { type: String, required: true },
    description: String,
    instructions: [String],

    questions: [questionSchema],

    // How many to serve from the bank. Zero or absent means all of them.
    drawCount: { type: Number, default: 0 },
    shuffleQuestions: { type: Boolean, default: true },
    shuffleOptions: { type: Boolean, default: true },

    passMark: { type: Number, default: 70, min: 1, max: 100 },
    durationMinutes: { type: Number, default: 30 },
    attemptsAllowed: { type: Number, default: 3 },
    showAnswers: { type: String, enum: ['never', 'after-pass', 'after-each'], default: 'after-each' },

    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    authoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    demo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

assessmentSchema.virtual('requiresManualGrading').get(function requiresManualGrading() {
  return this.questions.some((q) => q.type === 'essay');
});

assessmentSchema.virtual('totalPoints').get(function totalPoints() {
  return this.questions.reduce((n, q) => n + (q.points ?? 1), 0);
});

export const Assessment = mongoose.model('Assessment', assessmentSchema);
