import mongoose from 'mongoose';

/**
 * One row per thing a person should be told about, whether or not it is also
 * emailed. Keeping the email attempt on the same row means a failed send is
 * visible rather than silent.
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    churchSlug: { type: String, index: true },

    kind: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: String,
    link: String,

    readAt: Date,

    email: {
      wanted: { type: Boolean, default: false },
      to: String,
      status: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
      sentAt: Date,
      error: String,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
