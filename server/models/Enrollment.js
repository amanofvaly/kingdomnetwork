import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['course', 'offering', 'resource'], default: 'course' },

    courseSlug: { type: String, index: true },
    offeringSlug: { type: String, index: true },
    resourceSlug: { type: String, index: true },
    churchSlug: String,

    orderRef: String,
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', index: true },

    // Stable lecture keys, not title-derived paths — see Course.
    completedLectures: { type: [String], default: [] },
    lastLectureKey: String,
    progress: { type: Number, default: 0 },
    creditUnitsEarned: Number,

    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    certificateIssuedAt: Date,
  },
  { timestamps: true },
);

// A compound *sparse* index still indexes a document when only the second
// field is missing, so every course enrolment would collide on a null slug.
// Partial filters index only the rows that carry the slug.
enrollmentSchema.index(
  { userId: 1, courseSlug: 1 },
  { unique: true, partialFilterExpression: { courseSlug: { $type: 'string' } } },
);
enrollmentSchema.index(
  { userId: 1, offeringSlug: 1 },
  { unique: true, partialFilterExpression: { offeringSlug: { $type: 'string' } } },
);
enrollmentSchema.index(
  { userId: 1, resourceSlug: 1 },
  { unique: true, partialFilterExpression: { resourceSlug: { $type: 'string' } } },
);

export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
