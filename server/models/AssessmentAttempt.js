import mongoose from 'mongoose';

/**
 * One sitting of one paper.
 *
 * Previously a pass was recorded by writing the string
 * `'assessment:passed score:85'` into the credential's free-text notes field
 * and checking it later with `String.includes`. There was no record of what was
 * asked, what was answered, when, or how many times.
 */
const attemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', index: true },
    assessmentSlug: { type: String, required: true, index: true },
    churchSlug: { type: String, index: true },

    attemptNumber: { type: Number, default: 1 },

    // The paper as served, so a review shows what this person actually sat even
    // if the bank has been edited since.
    served: [
      new mongoose.Schema(
        {
          key: String,
          type: String,
          prompt: String,
          options: [String],
          points: Number,
          // Correct option indexes after any shuffle was applied.
          answers: [Number],
          accepted: [String],
          explanation: String,
        },
        { _id: false },
      ),
    ],

    responses: [
      new mongoose.Schema(
        {
          key: String,
          chosen: [Number],
          text: String,
          correct: Boolean,
          awarded: Number,
          graderNote: String,
        },
        { _id: false },
      ),
    ],

    autoScore: Number,
    manualScore: Number,
    score: Number,
    passMark: Number,
    passed: { type: Boolean, default: false, index: true },

    status: {
      type: String,
      enum: ['in-progress', 'submitted', 'awaiting-grading', 'graded', 'abandoned'],
      default: 'in-progress',
      index: true,
    },

    startedAt: { type: Date, default: Date.now },
    dueAt: Date,
    submittedAt: Date,
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gradedAt: Date,
    feedback: String,
  },
  { timestamps: true },
);

attemptSchema.index({ userId: 1, assessmentSlug: 1, attemptNumber: -1 });

export const AssessmentAttempt = mongoose.model('AssessmentAttempt', attemptSchema);
