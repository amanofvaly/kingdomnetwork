import { asyncHandler } from '../middleware/asyncHandler.js';
import { disclosuresFor } from '../lib/disclosures.js';
import { advanceAllFor } from '../lib/workflow.js';
import { renderDocument } from '../lib/documents.js';
import { Application } from '../models/Application.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Credential } from '../models/Credential.js';
import { Offering } from '../models/Offering.js';

/**
 * The Digital Minister Passport: everything a person has been issued, and
 * everything they have in flight.
 *
 * The old version of this file also contained the requirement engine — a
 * `settle()` function that re-derived what a credential was waiting on every
 * time the page loaded, duplicating logic that also lived in the checkout. That
 * now lives in `lib/requirements.js` and `lib/workflow.js`, and this file does
 * what its name says.
 */

const CREDENTIAL_CARD = 'credentialId title kind status offeringSlug churchSlug churchName holderName postNominal issuedAt expiresAt verifyCode renewal destinationCity destinationCountry purpose';

export const passport = asyncHandler(async (req, res) => {
  // Cheap, and keeps the passport honest: another church issuing something can
  // be the last thing an application here was waiting on.
  await advanceAllFor(req.user._id);

  const [credentials, applications, churches] = await Promise.all([
    Credential.find({ userId: req.user._id }, CREDENTIAL_CARD).sort({ issuedAt: -1 }),
    Application.find({ userId: req.user._id, status: { $nin: ['issued', 'withdrawn'] } }).sort({ updatedAt: -1 }),
    Church.find({}, 'slug name shortName monogram verified city country'),
  ]);

  const churchBy = Object.fromEntries(churches.map((c) => [c.slug, c]));
  const slugs = [...new Set([...credentials, ...applications].map((d) => d.offeringSlug).filter(Boolean))];
  const offerings = await Offering.find(
    { slug: { $in: slugs } },
    'slug title type outcome coverImage award letter price fee demo disclosure',
  );
  const offeringBy = Object.fromEntries(offerings.map((o) => [o.slug, o]));

  const now = new Date();
  const shapedCredentials = credentials.map((c) => {
    const offering = offeringBy[c.offeringSlug] ?? null;
    const expiresAt = c.expiresAt ? new Date(c.expiresAt) : null;
    return {
      ...c.toObject(),
      church: churchBy[c.churchSlug] ?? null,
      offering,
      disclosures: offering ? disclosuresFor(offering) : [],
      expired: Boolean(expiresAt && expiresAt < now),
      // Surfaced so a licence about to lapse is visible before it does.
      renewalDueInDays: c.renewal?.dueAt
        ? Math.ceil((new Date(c.renewal.dueAt) - now) / (24 * 60 * 60 * 1000))
        : null,
    };
  });

  const courseSlugs = applications.flatMap((a) =>
    (a.steps ?? []).filter((s) => s.type === 'course' && s.meta?.courseSlug).map((s) => s.meta.courseSlug),
  );
  const courses = await Course.find({ slug: { $in: courseSlugs } }, 'slug title coverImage totalMinutes lectureCount');
  const courseBy = Object.fromEntries(courses.map((c) => [c.slug, c]));

  const shapedApplications = applications.map((a) => ({
    reference: a.reference,
    status: a.status,
    offeringSlug: a.offeringSlug,
    offeringTitle: a.offeringTitle,
    offering: offeringBy[a.offeringSlug] ?? null,
    church: churchBy[a.churchSlug] ?? null,
    submittedAt: a.submittedAt,
    updatedAt: a.updatedAt,
    steps: (a.steps ?? []).map((s) => ({
      ...(s.toObject?.() ?? s),
      course: s.meta?.courseSlug ? courseBy[s.meta.courseSlug] ?? null : null,
      offering: s.meta?.offeringSlug ? offeringBy[s.meta.offeringSlug] ?? null : null,
    })),
  }));

  res.json({
    success: true,
    data: {
      holder: req.user.toPublic(),
      credentials: shapedCredentials,
      applications: shapedApplications,
      counts: {
        issued: shapedCredentials.filter((c) => c.status === 'issued' && !c.expired).length,
        expired: shapedCredentials.filter((c) => c.expired || c.status === 'expired').length,
        inProgress: shapedApplications.length,
        letters: shapedCredentials.filter((c) => c.kind === 'invitation-letter' && c.status === 'issued').length,
      },
    },
  });
});

/** The issued PDF. Only the holder can download it. */
export const downloadDocument = asyncHandler(async (req, res) => {
  const credential = await Credential.findOne({ credentialId: req.params.id, userId: req.user._id });
  if (!credential) return res.status(404).json({ success: false, message: 'That document was not found.' });
  if (credential.status === 'revoked') {
    return res.status(409).json({ success: false, message: 'This credential has been revoked by the issuing church.' });
  }

  const [church, offering] = await Promise.all([
    Church.findOne({ slug: credential.churchSlug }),
    Offering.findOne({ slug: credential.offeringSlug }),
  ]);

  const pdf = await renderDocument({ credential, church, offering, preview: false });
  const name = `${credential.title.replace(/[^a-z0-9]+/gi, '-')}-${credential.credentialId}.pdf`.toLowerCase();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Content-Length', pdf.length);
  res.end(pdf);
});

/**
 * The same document, watermarked, with any name written into it. Shown before
 * applying so a person can see what the church actually issues — not as a
 * preview of something they are about to buy, but so the artifact is not a
 * mystery until after a decision.
 */
export const previewDocument = asyncHandler(async (req, res) => {
  const offering = await Offering.findOne({ slug: req.params.slug });
  if (!offering) return res.status(404).json({ success: false, message: 'That listing does not exist.' });

  const church = await Church.findOne({ slug: offering.churchSlug });
  const holderName = String(req.query.name ?? '').trim().slice(0, 60) || 'Your Name Here';

  const credential = {
    kind: offering.type === 'invitation-letter' ? 'invitation-letter' : offering.type,
    title: offering.award?.title ?? offering.title,
    holderName,
    credentialId: 'KN-0000-PREVIEW',
    verifyCode: 'PREVIEW',
    issuedAt: new Date(),
  };

  const pdf = await renderDocument({ credential, church, offering, preview: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
  res.setHeader('Cache-Control', 'no-store');
  res.end(pdf);
});

/** Public verification of an issued credential. */
export const verify = asyncHandler(async (req, res) => {
  const credential = await Credential.findOne({ verifyCode: String(req.params.code).toUpperCase().trim() });

  if (!credential) {
    return res.status(404).json({ success: false, message: 'No credential matches that code.' });
  }

  // A revoked credential is reported as revoked rather than as missing. Someone
  // checking a document needs to be told it was withdrawn, not that it never
  // existed — that is the whole reason verification exists.
  if (credential.status === 'revoked') {
    return res.json({
      success: true,
      data: {
        state: 'revoked',
        credentialId: credential.credentialId,
        title: credential.title,
        holderName: credential.holderName,
        revokedAt: credential.revocation?.at,
        reason: credential.revocation?.publicReason,
      },
    });
  }

  const expired = credential.expiresAt && new Date(credential.expiresAt) < new Date();

  const church = await Church.findOne(
    { slug: credential.churchSlug },
    'slug name shortName monogram city country verified website',
  );

  res.json({
    success: true,
    data: {
      state: expired ? 'expired' : 'issued',
      credentialId: credential.credentialId,
      title: credential.title,
      holderName: credential.holderName,
      postNominal: credential.postNominal,
      kind: credential.kind,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
      destinationCity: credential.destinationCity,
      destinationCountry: credential.destinationCountry,
      purpose: credential.purpose,
      signatory: credential.signatory?.name ? { name: credential.signatory.name, title: credential.signatory.title } : null,
      church,
    },
  });
});
