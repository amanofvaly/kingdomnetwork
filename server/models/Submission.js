import mongoose from 'mongoose';

/** An assignment handed in against a lecture, marked against its rubric. */
const submissionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseSlug: { type: String, required: true, index: true },
    lectureKey: { type: String, required: true, index: true },
    churchSlug: { type: String, index: true },

    text: String,
    mediaIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MediaAsset' }],

    status: {
      type: String,
      enum: ['draft', 'submitted', 'returned', 'passed', 'failed'],
      default: 'draft',
      index: true,
    },

    rubricScores: [
      new mongoose.Schema({ criterion: String, awarded: Number, outOf: Number, note: String }, { _id: false }),
    ],
    score: Number,
    feedback: String,

    submittedAt: Date,
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gradedAt: Date,
  },
  { timestamps: true },
);

submissionSchema.index({ userId: 1, courseSlug: 1, lectureKey: 1 }, { unique: true });

export const Submission = mongoose.model('Submission', submissionSchema);
