import { asyncHandler } from '../middleware/asyncHandler.js';
import { disclosuresFor } from '../lib/disclosures.js';
import { reference as makeReference, token as makeToken } from '../lib/ids.js';
import { link, mailer } from '../lib/mailer/index.js';
import { notify } from '../lib/notify.js';
import { summarise } from '../lib/requirements.js';
import { storeUpload, MAX_BYTES, readBody } from '../lib/upload.js';
import { advance } from '../lib/workflow.js';
import { Application } from '../models/Application.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Credential } from '../models/Credential.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { Offering } from '../models/Offering.js';

/**
 * Applying to a church for a credential.
 *
 * Deliberately not a basket. A person applies to one church for one thing, and
 * the fee they pay is the church's charge for assessing that application — so
 * there is no cart, no cross-sell and no discount anywhere in this flow.
 */

const shape = async (application, { forChurch = false } = {}) => {
  const [offering, church] = await Promise.all([
    Offering.findOne({ slug: application.offeringSlug }),
    Church.findOne({ slug: application.churchSlug }, 'slug name shortName monogram verified city country'),
  ]);

  const courseSlugs = (application.steps ?? [])
    .filter((s) => s.meta?.courseSlug)
    .map((s) => s.meta.courseSlug);
  const offeringSlugs = (application.steps ?? [])
    .flatMap((s) => (s.meta?.group ? s.meta.items ?? [] : s.meta?.offeringSlug ? [s.meta.offeringSlug] : []));

  const [courses, required, mediaAssets] = await Promise.all([
    Course.find({ slug: { $in: courseSlugs } }, 'slug title coverImage totalMinutes lectureCount churchSlug'),
    Offering.find({ slug: { $in: offeringSlugs } }, 'slug title price fee churchSlug coverImage type'),
    MediaAsset.find({ _id: { $in: (application.documents ?? []).map((d) => d.mediaId).filter(Boolean) } }, 'filename mimeType bytes'),
  ]);

  const courseBy = Object.fromEntries(courses.map((c) => [c.slug, c]));
  const requiredBy = Object.fromEntries(required.map((o) => [o.slug, o]));
  const mediaBy = Object.fromEntries(mediaAssets.map((m) => [String(m._id), m]));

  return {
    reference: application.reference,
    status: application.status,
    offeringSlug: application.offeringSlug,
    offeringTitle: application.offeringTitle,
    offering,
    church,
    disclosures: offering ? disclosuresFor(offering) : [],
    answers: application.answers ?? {},
    attestations: application.attestations ?? [],
    documents: (application.documents ?? []).map((d) => ({
      ...(d.toObject?.() ?? d),
      media: d.mediaId ? mediaBy[String(d.mediaId)] ?? null : null,
    })),
    // The referee's token is a secret that lets them answer without an account.
    references: (application.references ?? []).map((r) => {
      const { token, ...rest } = r.toObject?.() ?? r;
      void token;
      return rest;
    }),
    steps: (application.steps ?? []).map((s) => ({
      ...(s.toObject?.() ?? s),
      course: s.meta?.courseSlug ? courseBy[s.meta.courseSlug] ?? null : null,
      offering: s.meta?.offeringSlug ? requiredBy[s.meta.offeringSlug] ?? null : null,
      options: s.meta?.group ? (s.meta.items ?? []).map((slug) => requiredBy[slug] ?? courseBy[slug] ?? { slug }) : undefined,
    })),
    summary: summarise(application.steps ?? []),
    infoRequest: application.infoRequest?.requestedAt && !application.infoRequest?.resolvedAt ? application.infoRequest : null,
    decision: application.decision?.outcome
      ? {
          outcome: application.decision.outcome,
          at: application.decision.at,
          note: application.decision.publicNote,
          ...(forChurch ? { reason: application.decision.reason, internalNote: application.decision.internalNote } : {}),
        }
      : null,
    credentialId: application.credentialId,
    paymentRef: application.paymentRef,
    interviewId: application.interviewId,
    submittedAt: application.submittedAt,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    timeline: (application.timeline ?? [])
      .filter((t) => (forChurch ? true : t.visibility !== 'church'))
      .slice()
      .reverse(),
  };
};

const mine = async (req) => {
  const application = await Application.findOne({ reference: req.params.reference, userId: req.user._id });
  return application;
};

const editable = (application) =>
  ['draft', 'fee_pending', 'info_requested', 'submitted', 'under_review'].includes(application.status);

export const list = asyncHandler(async (req, res) => {
  const applications = await Application.find({ userId: req.user._id }).sort({ updatedAt: -1 });

  const [offerings, churches] = await Promise.all([
    Offering.find({ slug: { $in: applications.map((a) => a.offeringSlug) } }, 'slug title type outcome coverImage coverAlt fee price'),
    Church.find({ slug: { $in: applications.map((a) => a.churchSlug) } }, 'slug name shortName monogram verified'),
  ]);
  const offeringBy = Object.fromEntries(offerings.map((o) => [o.slug, o]));
  const churchBy = Object.fromEntries(churches.map((c) => [c.slug, c]));

  res.json({
    success: true,
    data: applications.map((a) => ({
      reference: a.reference,
      status: a.status,
      offeringSlug: a.offeringSlug,
      offeringTitle: a.offeringTitle,
      offering: offeringBy[a.offeringSlug] ?? null,
      church: churchBy[a.churchSlug] ?? null,
      summary: summarise(a.steps ?? []),
      submittedAt: a.submittedAt,
      updatedAt: a.updatedAt,
      credentialId: a.credentialId,
    })),
  });
});

export const detail = asyncHandler(async (req, res) => {
  const application = await mine(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });

  await advance(application);
  res.json({ success: true, data: await shape(application) });
});

/**
 * Begin an application. Creates a draft and works out the checklist; nothing is
 * charged and nothing is submitted until the applicant says so.
 */
export const start = asyncHandler(async (req, res) => {
  const offering = await Offering.findOne({ slug: req.body?.offeringSlug, status: 'published' });
  if (!offering) return res.status(404).json({ success: false, message: 'That listing is not open for applications.' });

  const live = await Application.findOne({
    userId: req.user._id,
    offeringSlug: offering.slug,
    status: { $nin: ['withdrawn', 'declined', 'expired'] },
  });
  if (live) {
    return res.json({ success: true, data: await shape(live), message: 'You already have an application for this.' });
  }

  // Invitation letters are the one thing bought repeatedly — a minister needs a
  // new one for each trip — so holding one never blocks applying for another.
  if (offering.type !== 'invitation-letter') {
    const held = await Credential.findOne({ userId: req.user._id, offeringSlug: offering.slug, status: 'issued' });
    if (held) {
      return res.status(409).json({ success: false, message: 'You already hold this credential.' });
    }
  }

  if (offering.intake?.mode === 'windows') {
    const now = new Date();
    const open = (offering.intake.windows ?? []).some((w) => w.opensAt <= now && w.closesAt >= now);
    if (!open) {
      return res.status(409).json({ success: false, message: 'Applications for this are not open at the moment.' });
    }
  }

  const application = await Application.create({
    reference: makeReference('APP'),
    userId: req.user._id,
    churchSlug: offering.churchSlug,
    offeringSlug: offering.slug,
    offeringTitle: offering.title,
    status: 'draft',
    attestations: (offering.requires?.attestations ?? []).map((a) => ({ key: a.key, statement: a.statement })),
    documents: (offering.requires?.documents ?? []).map((d) => ({ key: d.key, label: d.label })),
    references: (offering.requires?.references ?? []).map((r) => ({ key: r.key })),
  });

  application.log({ event: 'application:started', actorId: req.user._id, actorRole: 'applicant' });
  await advance(application, { offering });

  await Offering.updateOne({ slug: offering.slug }, { $inc: { applicationCount: 1 } });

  res.status(201).json({ success: true, data: await shape(application) });
});

/** Save form answers and attestation agreements. */
export const update = asyncHandler(async (req, res) => {
  const application = await mine(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });
  if (!editable(application)) {
    return res.status(409).json({ success: false, message: 'This application can no longer be edited.' });
  }

  const offering = await Offering.findOne({ slug: application.offeringSlug });

  if (req.body?.answers && typeof req.body.answers === 'object') {
    const allowed = new Set((offering?.applicationForm ?? []).map((f) => f.key));
    const answers = { ...(application.answers ?? {}) };
    for (const [key, value] of Object.entries(req.body.answers)) {
      if (allowed.has(key)) answers[key] = value;
    }
    application.answers = answers;
    application.markModified('answers');
  }

  if (Array.isArray(req.body?.attestations)) {
    const agreed = new Set(req.body.attestations);
    application.attestations = (offering?.requires?.attestations ?? []).map((a) => {
      const prior = application.attestations?.find((x) => x.key === a.key);
      return {
        key: a.key,
        statement: a.statement,
        agreedAt: agreed.has(a.key) ? prior?.agreedAt ?? new Date() : undefined,
      };
    });
  }

  if (Array.isArray(req.body?.references)) {
    const wanted = offering?.requires?.references ?? [];
    application.references = wanted.map((r) => {
      const given = req.body.references.find((x) => x.key === r.key) ?? {};
      const prior = application.references?.find((x) => x.key === r.key);
      // Once a referee has answered, their record is theirs and is not editable.
      if (prior?.status === 'received') return prior;
      return {
        key: r.key,
        name: String(given.name ?? '').trim().slice(0, 120),
        email: String(given.email ?? '').toLowerCase().trim().slice(0, 160),
        phone: String(given.phone ?? '').trim().slice(0, 40),
        relationship: String(given.relationship ?? r.relationship ?? '').trim().slice(0, 120),
        status: prior?.status === 'sent' ? 'sent' : 'pending',
        token: prior?.token,
        sentAt: prior?.sentAt,
      };
    });
  }

  // Answering a request for more information clears it.
  if (application.infoRequest?.requestedAt && !application.infoRequest.resolvedAt && req.body?.resolveInfoRequest) {
    application.infoRequest.resolvedAt = new Date();
    application.log({ event: 'info:answered', actorId: req.user._id, actorRole: 'applicant', visibility: 'both' });
  }

  await advance(application, { offering });
  res.json({ success: true, data: await shape(application) });
});

/**
 * Upload one of the documents the church asked for. Stored privately: an
 * applicant's passport scan must never be reachable by guessing a URL.
 */
export const uploadDocument = asyncHandler(async (req, res) => {
  const application = await mine(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });
  if (!editable(application)) {
    return res.status(409).json({ success: false, message: 'This application can no longer be edited.' });
  }

  const slot = application.documents?.find((d) => d.key === req.params.key);
  if (!slot) return res.status(404).json({ success: false, message: 'That document is not part of this application.' });

  const buffer = await readBody(req, MAX_BYTES.document);
  const stored = await storeUpload({
    buffer,
    filename: req.get('x-filename') ?? `${req.params.key}.pdf`,
    churchSlug: application.churchSlug,
    folder: `applications/${application.reference}`,
  });

  const asset = await MediaAsset.create({
    ...stored,
    storageKey: stored.key,
    uploadedBy: req.user._id,
    churchSlug: application.churchSlug,
    visibility: 'private',
    folder: `applications/${application.reference}`,
    usage: [{ entity: 'Application', entityId: String(application._id), field: req.params.key }],
  });

  slot.mediaId = asset._id;
  slot.uploadedAt = new Date();
  slot.status = 'pending';
  slot.note = undefined;

  application.log({ event: 'document:uploaded', note: slot.label ?? slot.key, actorId: req.user._id, actorRole: 'applicant' });
  await advance(application);

  res.status(201).json({ success: true, data: await shape(application) });
});

/**
 * Submit. If there is a fee, the application waits at `fee_pending` and the
 * client is told to start a payment; the church sees nothing until it clears.
 */
export const submit = asyncHandler(async (req, res) => {
  const application = await mine(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });
  if (!['draft', 'fee_pending'].includes(application.status)) {
    return res.status(409).json({ success: false, message: 'This application has already been submitted.' });
  }

  const offering = await Offering.findOne({ slug: application.offeringSlug });
  const fee = offering?.fee?.amount ?? 0;

  if (fee > 0 && !application.paymentRef) {
    application.status = 'fee_pending';
    await application.save();
    return res.json({
      success: true,
      data: { ...(await shape(application)), requiresPayment: { amount: fee, currency: offering.fee?.currency ?? 'USD' } },
    });
  }

  application.submittedAt = new Date();
  application.log({ event: 'application:submitted', actorId: req.user._id, actorRole: 'applicant', visibility: 'both' });
  await advance(application, { offering });
  await sendReferenceRequests(application);

  await notify.church(application.churchSlug, {
    kind: 'application:submitted',
    title: `New application for ${application.offeringTitle}`,
    body: `${req.user.name} has applied.`,
    link: `/manage/${application.churchSlug}/applicants/${application.reference}`,
  });

  res.json({ success: true, data: await shape(application) });
});

/** Email each named referee a link that lets them answer without an account. */
export const sendReferenceRequests = async (application) => {
  let changed = false;

  for (const ref of application.references ?? []) {
    if (!ref.email || ref.status !== 'pending') continue;

    ref.token = ref.token ?? makeToken(24);
    ref.status = 'sent';
    ref.sentAt = new Date();
    changed = true;

    const holder = await application.populate('userId');
    await mailer.send({
      to: ref.email,
      subject: `A reference request for ${holder.userId?.name ?? 'an applicant'}`,
      text: [
        `${holder.userId?.name ?? 'An applicant'} has named you as a referee in an application to a church for "${application.offeringTitle}".`,
        '',
        'You do not need an account. Open this link to answer:',
        link(`/reference/${ref.token}`),
        '',
        'If you were not expecting this, you can ignore it.',
      ].join('\n'),
    });
  }

  if (changed) await application.save();
};

export const withdraw = asyncHandler(async (req, res) => {
  const application = await mine(req);
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });
  if (['issued', 'declined', 'withdrawn'].includes(application.status)) {
    return res.status(409).json({ success: false, message: 'This application is already closed.' });
  }

  application.status = 'withdrawn';
  application.log({
    event: 'application:withdrawn',
    note: String(req.body?.reason ?? '').slice(0, 500) || undefined,
    actorId: req.user._id,
    actorRole: 'applicant',
    visibility: 'both',
  });
  await application.save();

  res.json({ success: true, data: await shape(application) });
});

/* ── the referee's side, reached by emailed token and no account ───────── */

export const referenceForm = asyncHandler(async (req, res) => {
  const application = await Application.findOne({ 'references.token': req.params.token }).select('+references.token');
  if (!application) return res.status(404).json({ success: false, message: 'That reference link is not valid.' });

  const ref = application.references.find((r) => r.token === req.params.token);
  if (ref.status === 'received') {
    return res.json({ success: true, data: { alreadyAnswered: true, respondedAt: ref.respondedAt } });
  }

  const holder = await application.populate('userId');
  const church = await Church.findOne({ slug: application.churchSlug }, 'name shortName city country');

  res.json({
    success: true,
    data: {
      applicantName: holder.userId?.name,
      offeringTitle: application.offeringTitle,
      churchName: church?.name,
      relationship: ref.relationship,
      refereeName: ref.name,
    },
  });
});

export const submitReference = asyncHandler(async (req, res) => {
  const application = await Application.findOne({ 'references.token': req.params.token }).select('+references.token');
  if (!application) return res.status(404).json({ success: false, message: 'That reference link is not valid.' });

  const ref = application.references.find((r) => r.token === req.params.token);
  if (ref.status === 'received') {
    return res.status(409).json({ success: false, message: 'You have already answered this request.' });
  }

  const recommend = ['yes', 'reservations', 'no'].includes(req.body?.recommend) ? req.body.recommend : null;
  if (!recommend) return res.status(400).json({ success: false, message: 'Say whether you recommend this person.' });

  ref.recommend = recommend;
  ref.response = String(req.body?.response ?? '').trim().slice(0, 4000);
  ref.status = 'received';
  ref.respondedAt = new Date();
  // The link is single-use: burn it once it has been answered.
  ref.token = undefined;

  application.log({ event: 'reference:received', note: ref.name, actorRole: 'referee', visibility: 'church' });
  await advance(application);

  res.json({ success: true, data: { received: true } });
});
