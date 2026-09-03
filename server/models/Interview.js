import mongoose from 'mongoose';

import { INTERVIEW_PROVIDERS } from './InterviewSlot.js';

const interviewSchema = new mongoose.Schema(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSlot', index: true },
    churchSlug: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    scheduledFor: { type: Date, index: true },
    timezone: String,
    durationMinutes: { type: Number, default: 30 },

    // Copied from the slot at booking so a later edit to the slot cannot change
    // where someone was told to turn up.
    provider: { type: String, enum: INTERVIEW_PROVIDERS, default: 'other' },
    joinUrl: String,
    dialIn: String,
    location: String,
    instructions: String,

    panel: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    panelNames: [String],

    status: {
      type: String,
      enum: ['scheduled', 'rescheduled', 'completed', 'no-show', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    outcome: { type: String, enum: ['pass', 'fail', 'defer'] },
    score: Number,
    notes: String,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedAt: Date,

    rescheduleCount: { type: Number, default: 0 },
    remindersSent: [String],
  },
  { timestamps: true },
);

interviewSchema.index({ churchSlug: 1, scheduledFor: 1, status: 1 });

export const Interview = mongoose.model('Interview', interviewSchema);
