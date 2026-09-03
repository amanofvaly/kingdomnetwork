import mongoose from 'mongoose';

/**
 * When a church is available to interview, and where the conversation happens.
 *
 * The platform deliberately does not host the call. A church already has Zoom,
 * Meet, Teams or a phone, and forcing a video provider on ministries with poor
 * bandwidth would exclude exactly the people this is built for. So a slot
 * carries whatever joining instructions the church pastes in, and the platform
 * owns the scheduling, the reminders and the record of what was decided.
 */

export const INTERVIEW_PROVIDERS = ['zoom', 'google-meet', 'teams', 'whatsapp', 'phone', 'in-person', 'other'];

const slotSchema = new mongoose.Schema(
  {
    churchSlug: { type: String, required: true, index: true },
    offeringSlug: { type: String, index: true },

    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    timezone: String,

    capacity: { type: Number, default: 1, min: 1 },
    bookedCount: { type: Number, default: 0 },

    panel: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    panelNames: [String],

    provider: { type: String, enum: INTERVIEW_PROVIDERS, default: 'other' },
    joinUrl: String,
    dialIn: String,
    location: String,
    instructions: String,

    status: { type: String, enum: ['open', 'full', 'closed'], default: 'open', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

slotSchema.index({ churchSlug: 1, startsAt: 1 });

slotSchema.methods.isBookable = function isBookable() {
  return this.status === 'open' && this.bookedCount < this.capacity && this.startsAt > new Date();
};

export const InterviewSlot = mongoose.model('InterviewSlot', slotSchema);
