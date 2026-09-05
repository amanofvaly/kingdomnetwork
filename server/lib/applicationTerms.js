import { Offering } from '../models/Offering.js';

export const CLOSED_APPLICATIONS = ['issued', 'declined', 'withdrawn', 'expired'];
export const OPEN_APPLICATIONS = ['draft', 'fee_pending', 'submitted', 'under_review', 'info_requested', 'coursework', 'assessment', 'interview', 'final_review', 'approved'];
export const applicationEditable = (application) => ![...CLOSED_APPLICATIONS, 'approved'].includes(application.status);
export const validCredentialFilter = (now = new Date()) => ({
  status: 'issued', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
});

// Each applicant keeps the terms they saw when they began. Historical records
// are captured before authoring changes and by the accompanying migration.
export const snapshotOffering = (offering) => {
  const { _id, __v, admissions, ...terms } = offering.toObject?.() ?? offering;
  return terms;
};
export const offeringForApplication = async (application, fallback) => {
  if (application.offeringSnapshot) return application.offeringSnapshot;
  const offering = fallback ?? await Offering.findOne({ slug: application.offeringSlug });
  if (offering) application.offeringSnapshot = snapshotOffering(offering);
  return application.offeringSnapshot ?? null;
};
