import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['course', 'offering'], default: 'course' },
    courseSlug: { type: String, index: true },
    offeringSlug: { type: String, index: true },
    churchSlug: String,
    orderRef: String,

    completedLectures: { type: [String], default: [] },
    lastLectureId: String,
    progress: { type: Number, default: 0 },

    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
  },
  { timestamps: true },
);

// A compound *sparse* index still indexes a document when only the second
// field is missing, so every course enrolment would collide on
// `pathwaySlug: null`. Partial filters index only the rows that carry the slug.
enrollmentSchema.index(
  { userId: 1, courseSlug: 1 },
  { unique: true, partialFilterExpression: { courseSlug: { $type: 'string' } } },
);
enrollmentSchema.index(
  { userId: 1, offeringSlug: 1 },
  { unique: true, partialFilterExpression: { offeringSlug: { $type: 'string' } } },
);

export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
