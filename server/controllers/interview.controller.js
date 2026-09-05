import { offeringForApplication } from '../lib/applicationTerms.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { interviewIcs } from '../lib/ics.js';
import { link, mailer } from '../lib/mailer/index.js';
import { notify } from '../lib/notify.js';
import { advance } from '../lib/workflow.js';
import { Application } from '../models/Application.js';
import { Church } from '../models/Church.js';
import { Interview } from '../models/Interview.js';
import { InterviewSlot } from '../models/InterviewSlot.js';

const FACE_TO_FACE_PROVIDERS = ['zoom', 'google-meet', 'teams', 'whatsapp', 'in-person'];

/**
 * Booking the conversation.
 *
 * The platform does not host the call. A church already has whatever it uses,
 * and imposing a video provider on ministries with poor bandwidth would exclude
 * the people this exists for — so a slot carries whatever joining instructions
 * the church pastes in, and the platform owns the scheduling, the reminders and
 * the record of what was decided.
 */

const describe = (interview) => {
  switch (interview.provider) {
    case 'phone':
      return interview.dialIn ? `By phone: ${interview.dialIn}` : 'By phone. The church will call you.';
    case 'in-person':
      return interview.location ? `In person at ${interview.location}` : 'In person.';
    case 'whatsapp':
      return interview.dialIn ? `WhatsApp video to ${interview.dialIn}` : 'By WhatsApp video.';
    default:
      return interview.joinUrl ? `Join at ${interview.joinUrl}` : 'The church will send joining details.';
  }
};

/** Slots an applicant can actually book for their application. */
export const availableSlots = asyncHandler(async (req, res) => {
  const application = await Application.findOne({ reference: req.params.reference, userId: req.user._id });
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });

  const offering = await offeringForApplication(application);
  const providerFilter = offering?.requires?.interview?.faceToFace
    ? { provider: { $in: FACE_TO_FACE_PROVIDERS } }
    : {};

  const slots = await InterviewSlot.find({
    churchSlug: application.churchSlug,
    ...providerFilter,
    status: 'open',
    startsAt: { $gt: new Date() },
    $or: [{ offeringSlug: application.offeringSlug }, { offeringSlug: { $in: [null, ''] } }, { offeringSlug: { $exists: false } }],
  })
    .sort({ startsAt: 1 })
    .limit(100);

  const existing = application.interviewId ? await Interview.findById(application.interviewId) : null;

  res.json({
    success: true,
    data: {
      booked: existing
        ? {
            id: existing._id,
            scheduledFor: existing.scheduledFor,
            durationMinutes: existing.durationMinutes,
            provider: existing.provider,
            joining: describe(existing),
            joinUrl: existing.joinUrl,
            status: existing.status,
            panelNames: existing.panelNames,
          }
        : null,
      slots: slots
        .filter((s) => s.bookedCount < s.capacity)
        .map((s) => ({
          id: s._id,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          timezone: s.timezone,
          provider: s.provider,
          panelNames: s.panelNames,
          remaining: s.capacity - s.bookedCount,
        })),
    },
  });
});

export const book = asyncHandler(async (req, res) => {
  const application = await Application.findOne({ reference: req.params.reference, userId: req.user._id });
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });

  const offering = await offeringForApplication(application);
  if (!offering?.requires?.interview?.required) {
    return res.status(400).json({ success: false, message: 'This application does not require an interview.' });
  }

  const providerFilter = offering.requires.interview.faceToFace
    ? { provider: { $in: FACE_TO_FACE_PROVIDERS } }
    : {};

  // Claim a place atomically. Two applicants clicking the last slot at the same
  // moment must not both get it, and a conditional update is the only thing
  // standing between them without a transaction.
  const slot = await InterviewSlot.findOneAndUpdate(
    { _id: req.body?.slotId, ...providerFilter, status: 'open', startsAt: { $gt: new Date() }, $expr: { $lt: ['$bookedCount', '$capacity'] } },
    { $inc: { bookedCount: 1 } },
    { new: true },
  );

  if (!slot) {
    return res.status(409).json({ success: false, message: 'That time has just been taken. Choose another.' });
  }
  if (slot.bookedCount >= slot.capacity) {
    slot.status = 'full';
    await slot.save();
  }

  const previous = application.interviewId ? await Interview.findById(application.interviewId) : null;
  if (previous && previous.status !== 'cancelled') {
    previous.status = 'cancelled';
    await previous.save();
    await InterviewSlot.updateOne({ _id: previous.slotId }, { $inc: { bookedCount: -1 }, $set: { status: 'open' } });
  }

  const interview = await Interview.create({
    applicationId: application._id,
    slotId: slot._id,
    churchSlug: application.churchSlug,
    userId: req.user._id,
    scheduledFor: slot.startsAt,
    timezone: slot.timezone,
    durationMinutes: Math.max(5, Math.round((slot.endsAt - slot.startsAt) / 60000)),
    // Copied from the slot so a later edit to the slot cannot change where
    // someone was already told to turn up.
    provider: slot.provider,
    joinUrl: slot.joinUrl,
    dialIn: slot.dialIn,
    location: slot.location,
    instructions: slot.instructions,
    panel: slot.panel,
    panelNames: slot.panelNames,
    status: previous ? 'rescheduled' : 'scheduled',
    rescheduleCount: previous ? (previous.rescheduleCount ?? 0) + 1 : 0,
  });

  application.interviewId = interview._id;
  application.log({
    event: previous ? 'interview:rescheduled' : 'interview:booked',
    note: new Date(slot.startsAt).toISOString(),
    actorId: req.user._id,
    actorRole: 'applicant',
    visibility: 'both',
  });
  await advance(application, { offering });

  const church = await Church.findOne({ slug: application.churchSlug }, 'name shortName contact');

  await mailer.send({
    to: req.user.email,
    subject: `Interview booked — ${application.offeringTitle}`,
    text: [
      `Your interview with ${church?.name ?? application.churchSlug} is booked.`,
      '',
      `When:  ${new Date(slot.startsAt).toUTCString()}`,
      `How:   ${describe(interview)}`,
      interview.instructions ? `\n${interview.instructions}` : '',
      '',
      `Your application: ${link(`/applications/${application.reference}`)}`,
    ].filter(Boolean).join('\n'),
  });

  await notify.church(application.churchSlug, {
    kind: 'interview:booked',
    title: `Interview booked for ${application.offeringTitle}`,
    body: `${req.user.name} booked ${new Date(slot.startsAt).toUTCString()}.`,
    link: `/manage/${application.churchSlug}/interviews`,
  });

  res.status(201).json({
    success: true,
    data: {
      id: interview._id,
      scheduledFor: interview.scheduledFor,
      durationMinutes: interview.durationMinutes,
      provider: interview.provider,
      joining: describe(interview),
      joinUrl: interview.joinUrl,
    },
  });
});

/** The calendar file, for either side of the conversation. */
export const calendar = asyncHandler(async (req, res) => {
  const interview = await Interview.findById(req.params.id);
  if (!interview) return res.status(404).json({ success: false, message: 'That interview was not found.' });

  const isApplicant = String(interview.userId) === String(req.user._id);
  const onPanel = (interview.panel ?? []).some((id) => String(id) === String(req.user._id));
  if (!isApplicant && !onPanel && req.user.role !== 'platform_admin') {
    return res.status(403).json({ success: false, message: 'That interview is not yours.' });
  }

  const application = await Application.findById(interview.applicationId, 'offeringTitle churchSlug reference');
  const church = await Church.findOne({ slug: interview.churchSlug }, 'name contact.email');

  const ics = interviewIcs({
    uid: `interview-${interview._id}@kingdom.network`,
    startsAt: interview.scheduledFor,
    durationMinutes: interview.durationMinutes,
    summary: `Interview — ${application?.offeringTitle ?? 'Kingdom Network'}`,
    description: [describe(interview), interview.instructions].filter(Boolean).join('\n'),
    location: interview.location ?? interview.joinUrl,
    organiser: church?.contact?.email ? { name: church.name, email: church.contact.email } : null,
  });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="interview.ics"');
  res.send(ics);
});
