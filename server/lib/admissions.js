import { Offering } from '../models/Offering.js';

const conflict = (message) => Object.assign(new Error(message), { status: 409 });
export const intakeWindow = (offering, now = new Date()) => (offering.intake?.windows ?? []).find((w) =>
  w.opensAt && w.closesAt && new Date(w.opensAt) <= now && new Date(w.closesAt) >= now);
const windowKey = (w) => w?.key ?? (w ? `${new Date(w.opensAt).toISOString()}/${new Date(w.closesAt).toISOString()}` : 'rolling');

export const admissionAvailability = (offering, now = new Date()) => {
  const window = intakeWindow(offering, now);
  const records = offering.admissions ?? [];
  if (offering.intake?.mode === 'windows' && !window) return { open: false, message: 'Applications are closed. Check the intake dates for the next opening.' };
  const used = records.filter((a) => a.window === windowKey(window)).length;
  const remaining = Math.min(offering.capacity == null ? Infinity : offering.capacity - records.length, window?.seats == null ? Infinity : window.seats - used);
  return { open: remaining > 0, remaining: Number.isFinite(remaining) ? Math.max(0, remaining) : null,
    message: remaining <= 0 ? 'All places have been filled. Contact the church about its next intake.' : null };
};

// Reserve on submission, before any gateway order is created. The conditional
// write counts and adds in one operation, so simultaneous applicants cannot
// take the same final place. Retrying an application never takes another place.
export const reserveAdmission = async (application) => {
  if (application.renewalOf) return;
  const offering = await Offering.findOne({ slug: application.offeringSlug }).select('+admissions');
  if (!offering) throw conflict('This listing is no longer available. Contact the church.');
  const held = offering.admissions.find((a) => String(a.applicationId) === String(application._id));
  if (held) { application.admissionWindow = held.window; return; }
  if (offering.status !== 'published') throw conflict('This listing is not accepting applications. Your draft has been kept.');
  const available = admissionAvailability(offering);
  if (!available.open) throw conflict(available.message);
  const window = intakeWindow(offering);
  const key = windowKey(window);
  const admissions = { $ifNull: ['$admissions', []] };
  const checks = [];
  if (offering.capacity != null) checks.push({ $lt: [{ $size: admissions }, '$capacity'] });
  if (window?.seats != null) checks.push({ $lt: [{ $size: { $filter: { input: admissions, as: 'a', cond: { $eq: ['$$a.window', key] } } } }, window.seats] });
  const reserved = await Offering.findOneAndUpdate({
    _id: offering._id, status: 'published', capacity: offering.capacity ?? null,
    'intake.mode': offering.intake?.mode ?? 'rolling', 'intake.windows': offering.intake?.windows ?? [],
    'admissions.applicationId': { $ne: application._id },
    ...(checks.length ? { $expr: { $and: checks } } : {}),
  }, { $push: { admissions: { applicationId: application._id, window: key } } });
  if (!reserved) {
    const retry = await Offering.exists({ _id: offering._id, 'admissions.applicationId': application._id });
    if (!retry) throw conflict('Availability just changed. Please submit again to check for a place.');
  }
  application.admissionWindow = key;
};
export const releaseAdmission = (application) => Offering.updateOne({ slug: application.offeringSlug }, { $pull: { admissions: { applicationId: application._id } } });
