import crypto from 'node:crypto';

import { asyncHandler } from '../middleware/asyncHandler.js';
import { audit } from '../lib/audit.js';
import { ONBOARDING_STEPS, SECTION_TYPES, sectionsFor } from '../lib/churchPage.js';
import { slugify } from '../lib/derive.js';
import { token as makeToken } from '../lib/ids.js';
import { link, mailer } from '../lib/mailer/index.js';
import { notify } from '../lib/notify.js';
import { proposeSlug } from '../lib/slugs.js';
import { Application } from '../models/Application.js';
import { Church } from '../models/Church.js';
import { ChurchMembership, CHURCH_ROLES } from '../models/ChurchMembership.js';
import { Course } from '../models/Course.js';
import { Credential } from '../models/Credential.js';
import { Interview } from '../models/Interview.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { Offering } from '../models/Offering.js';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';

/**
 * Onboarding a church, and everything it manages about itself afterwards.
 *
 * A church publishes the moment it finishes; nothing waits on us to approve it.
 * Verification is a badge a platform administrator grants after checking
 * registration documents, and it changes what visitors are told — not what the
 * church is permitted to do.
 */

/** Payout details are held encrypted; only the last four are ever rendered. */
const secretKey = () => crypto.createHash('sha256').update(process.env.JWT_SECRET ?? 'change-me-in-production').digest();

const encrypt = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
};

export const decrypt = (packed) => {
  try {
    const [iv, tag, data] = String(packed).split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
};

/* ── onboarding ────────────────────────────────────────────────────────── */

/**
 * Step one creates the church and makes the caller its owner. Every later step
 * writes only the fields it owns, so a church can leave and come back without
 * a half-finished form overwriting something it filled in earlier.
 */
export const beginOnboarding = asyncHandler(async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ success: false, message: 'What is the church called?' });

  const existing = await ChurchMembership.findOne({ userId: req.user._id, role: 'owner', status: 'active' });
  if (existing) {
    const church = await Church.findOne({ slug: existing.churchSlug });
    if (church?.onboarding?.completedAt == null) {
      return res.json({ success: true, data: { churchSlug: church.slug, resumed: true, step: church.onboarding?.currentStep ?? 1 } });
    }
  }

  const slug = await proposeSlug(Church, name, { suffix: false });

  const church = await Church.create({
    slug,
    name,
    shortName: name.split(/\s+/).slice(0, 2).join(' '),
    monogram: name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    ownerId: req.user._id,
    status: 'draft',
    demo: false,
    onboarding: { currentStep: 2, completedSteps: [1], startedAt: new Date() },
    verification: { state: 'unverified' },
  });

  await ChurchMembership.create({
    churchSlug: church.slug,
    userId: req.user._id,
    role: 'owner',
    status: 'active',
    acceptedAt: new Date(),
    title: String(req.body?.yourRole ?? '').trim().slice(0, 120) || undefined,
  });

  req.user.churchSlug = church.slug;
  await req.user.save();

  await audit(req, { action: 'church:created', entity: 'Church', entityId: church._id, churchSlug: church.slug });

  res.status(201).json({ success: true, data: { churchSlug: church.slug, step: 2 } });
});

export const onboardingState = asyncHandler(async (req, res) => {
  const church = req.church;
  res.json({
    success: true,
    data: {
      church: church.toObject(),
      steps: ONBOARDING_STEPS,
      currentStep: church.onboarding?.currentStep ?? 1,
      completedSteps: church.onboarding?.completedSteps ?? [],
      completedAt: church.onboarding?.completedAt,
      status: church.status,
    },
  });
});

export const saveOnboardingStep = asyncHandler(async (req, res) => {
  const step = ONBOARDING_STEPS.find((s) => s.key === req.params.step);
  if (!step) return res.status(404).json({ success: false, message: 'There is no such step.' });

  const church = req.church;

  for (const field of step.fields) {
    if (req.body?.[field] === undefined) continue;
    // The slug is frozen once a church is published, so renaming later changes
    // the name only — every requirement that points here still resolves.
    if (field === 'name' && church.publishedAt) {
      church.name = String(req.body.name).trim();
      continue;
    }
    church[field] = req.body[field];
  }

  if (step.key === 'payouts' && req.body?.payout?.accountRef) {
    const raw = String(req.body.payout.accountRef).trim();
    church.payout.accountRefEncrypted = encrypt(raw);
    church.payout.accountRefMasked = `•••• ${raw.slice(-4)}`;
    church.payout.confirmedAt = new Date();
  }

  const completed = new Set(church.onboarding?.completedSteps ?? []);
  completed.add(step.step);
  church.onboarding.completedSteps = [...completed].sort((a, b) => a - b);
  church.onboarding.currentStep = Math.max(church.onboarding.currentStep ?? 1, Math.min(step.step + 1, 10));

  await church.save();
  res.json({ success: true, data: { church: church.toObject(), currentStep: church.onboarding.currentStep } });
});

export const publishChurch = asyncHandler(async (req, res) => {
  const church = req.church;

  const missing = [];
  if (!church.name?.trim()) missing.push('the church’s name');
  if (!church.city || !church.country) missing.push('where it is');
  if (!church.contact?.email) missing.push('a contact email address');
  if (!church.about?.trim()) missing.push('a description of the church');

  if (missing.length) {
    return res.status(400).json({
      success: false,
      message: `Before publishing, add ${missing.join(', ')}.`,
      data: { missing },
    });
  }

  church.status = 'published';
  church.publishedAt = church.publishedAt ?? new Date();
  church.onboarding.completedAt = church.onboarding.completedAt ?? new Date();
  church.onboarding.currentStep = 10;
  church.onboarding.completedSteps = [...new Set([...(church.onboarding.completedSteps ?? []), 10])];
  await church.save();

  await audit(req, { action: 'church:published', entity: 'Church', entityId: church._id, churchSlug: church.slug });
  await notify.platform({
    kind: 'church:published',
    title: `${church.name} has published`,
    body: `${church.city ?? ''}${church.city && church.country ? ', ' : ''}${church.country ?? ''}`.trim() || undefined,
    link: `/admin/churches/${church.slug}`,
  });

  res.json({ success: true, data: { slug: church.slug, status: church.status, publishedAt: church.publishedAt } });
});

/* ── the church's own record ───────────────────────────────────────────── */

export const profile = asyncHandler(async (req, res) => {
  const church = req.church.toObject();
  delete church.payout?.accountRefEncrypted;

  const [offerings, courses, applications, credentials] = await Promise.all([
    Offering.countDocuments({ churchSlug: req.church.slug }),
    Course.countDocuments({ churchSlug: req.church.slug }),
    Application.countDocuments({ churchSlug: req.church.slug }),
    Credential.countDocuments({ churchSlug: req.church.slug, status: 'issued' }),
  ]);

  res.json({
    success: true,
    data: { church, counts: { offerings, courses, applications, credentials }, membership: req.membership },
  });
});

const PROFILE_FIELDS = [
  'name', 'shortName', 'tagline', 'about', 'story', 'statementOfFaith', 'city', 'country', 'region',
  'timezone', 'website', 'foundedYear', 'denomination', 'tradition', 'legal', 'contact', 'serviceTimes',
  'coverImage', 'coverAlt', 'portraitImage', 'logoImage', 'monogram', 'galleryMediaIds', 'leaders',
  'signatory', 'specialties', 'languages', 'deliveryModes',
];

export const updateProfile = asyncHandler(async (req, res) => {
  const church = req.church;
  for (const field of PROFILE_FIELDS) {
    if (req.body?.[field] !== undefined) church[field] = req.body[field];
  }
  await church.save();
  await audit(req, { action: 'church:updated', entity: 'Church', entityId: church._id, churchSlug: church.slug });
  res.json({ success: true, data: church.toObject() });
});

/* ── the public page ───────────────────────────────────────────────────── */

export const getPage = asyncHandler(async (req, res) => {
  const sections = sectionsFor(req.church);
  const mediaIds = sections.flatMap((s) => s.data?.mediaIds ?? []);
  const media = mediaIds.length ? await MediaAsset.find({ _id: { $in: mediaIds } }, 'storageKey filename alt') : [];

  res.json({
    success: true,
    data: {
      accent: req.church.page?.accent,
      sections,
      types: SECTION_TYPES,
      media: media.map((m) => ({ id: m._id, url: `/api/media/file/${m.storageKey}`, alt: m.alt, filename: m.filename })),
    },
  });
});

export const updatePage = asyncHandler(async (req, res) => {
  const incoming = Array.isArray(req.body?.sections) ? req.body.sections : null;
  if (!incoming) return res.status(400).json({ success: false, message: 'Send the sections to save.' });

  const seen = new Set();
  const sections = incoming
    .filter((s) => SECTION_TYPES[s.type])
    .filter((s) => {
      // One block per type: two "About" sections would have nothing to say
      // differently, since both render the same underlying field.
      if (seen.has(s.type)) return false;
      seen.add(s.type);
      return true;
    })
    .map((s, i) => ({
      id: s.id ?? s.type,
      type: s.type,
      order: i,
      visible: s.visible !== false,
      data: SECTION_TYPES[s.type].managed === 'auto' ? {} : s.data ?? {},
    }));

  req.church.page = { accent: req.body?.accent ?? req.church.page?.accent, sections };
  await req.church.save();

  res.json({ success: true, data: { sections: sectionsFor(req.church) } });
});

/* ── donations settings ────────────────────────────────────────────────── */

export const updateDonations = asyncHandler(async (req, res) => {
  const church = req.church;
  const body = req.body ?? {};

  if (typeof body.enabled === 'boolean') church.donations.enabled = body.enabled;
  for (const key of ['headline', 'blurb', 'thankYouMessage']) {
    if (typeof body[key] === 'string') church.donations[key] = body[key].trim().slice(0, 1000);
  }
  if (typeof body.allowCustom === 'boolean') church.donations.allowCustom = body.allowCustom;
  if (typeof body.allowAnonymous === 'boolean') church.donations.allowAnonymous = body.allowAnonymous;
  if (typeof body.showRecentGifts === 'boolean') church.donations.showRecentGifts = body.showRecentGifts;
  if (Number.isFinite(body.minAmount)) church.donations.minAmount = Math.max(1, Math.round(body.minAmount));

  if (Array.isArray(body.suggestedAmounts)) {
    church.donations.suggestedAmounts = body.suggestedAmounts
      .map((n) => Math.round(Number(n)))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 6);
  }

  if (Array.isArray(body.causes)) {
    church.donations.causes = body.causes.slice(0, 20).map((c) => {
      const existing = church.donations.causes?.find((x) => x.id === c.id);
      return {
        id: c.id ?? slugify(c.title ?? 'cause') ?? String(Date.now()),
        title: String(c.title ?? '').trim().slice(0, 160),
        blurb: String(c.blurb ?? '').trim().slice(0, 1000),
        mediaId: c.mediaId ?? existing?.mediaId,
        goalAmount: Number.isFinite(c.goalAmount) ? c.goalAmount : undefined,
        // Never taken from the client: this is the total actually received.
        raisedAmount: existing?.raisedAmount ?? 0,
        active: c.active !== false,
      };
    });
  }

  await church.save();
  res.json({ success: true, data: church.donations });
});

/* ── verification ──────────────────────────────────────────────────────── */

export const submitVerification = asyncHandler(async (req, res) => {
  const church = req.church;
  const documents = Array.isArray(req.body?.documents) ? req.body.documents : [];

  if (!documents.length) {
    return res.status(400).json({ success: false, message: 'Attach at least one registration document.' });
  }

  church.verification.documents = documents.slice(0, 10).map((d) => ({
    label: String(d.label ?? 'Document').slice(0, 160),
    mediaId: d.mediaId,
    uploadedAt: new Date(),
  }));
  church.verification.state = 'pending';
  church.verification.submittedAt = new Date();
  church.verification.notes = undefined;
  await church.save();

  await notify.platform({
    kind: 'verification:submitted',
    title: `${church.name} has asked to be verified`,
    body: `${church.verification.documents.length} document(s) attached.`,
    link: `/admin/verification`,
  });

  res.json({ success: true, data: church.verification });
});

/* ── the team ──────────────────────────────────────────────────────────── */

export const listTeam = asyncHandler(async (req, res) => {
  const memberships = await ChurchMembership.find({ churchSlug: req.church.slug }).sort({ createdAt: 1 }).lean();
  const users = await User.find(
    { _id: { $in: memberships.map((m) => m.userId).filter(Boolean) } },
    'name email avatar lastLoginAt',
  ).lean();
  const by = Object.fromEntries(users.map((u) => [String(u._id), u]));

  res.json({
    success: true,
    data: memberships.map((m) => ({
      id: m._id,
      role: m.role,
      title: m.title,
      status: m.status,
      invitedEmail: m.invitedEmail,
      acceptedAt: m.acceptedAt,
      user: m.userId ? by[String(m.userId)] ?? null : null,
    })),
    meta: { roles: CHURCH_ROLES },
  });
});

export const invite = asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  const role = CHURCH_ROLES.includes(req.body?.role) ? req.body.role : null;

  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  if (!role) return res.status(400).json({ success: false, message: `Choose a role: ${CHURCH_ROLES.join(', ')}.` });
  // Only an owner can make another owner; otherwise an administrator could
  // promote themselves past the person who signed the church up.
  if (role === 'owner' && req.membership?.role !== 'owner' && !req.actingAsPlatformAdmin) {
    return res.status(403).json({ success: false, message: 'Only an owner can add another owner.' });
  }

  const user = await User.findOne({ email });
  if (user) {
    const existing = await ChurchMembership.findOne({ churchSlug: req.church.slug, userId: user._id });
    if (existing) return res.status(409).json({ success: false, message: 'They already have a role at this church.' });
  }

  const rawToken = makeToken(24);
  const membership = await ChurchMembership.create({
    churchSlug: req.church.slug,
    userId: user?._id,
    role,
    title: String(req.body?.title ?? '').trim().slice(0, 120) || undefined,
    status: 'invited',
    invitedEmail: email,
    invitedBy: req.user._id,
    inviteToken: rawToken,
    inviteExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });

  await mailer.send({
    to: email,
    subject: `You have been invited to help administer ${req.church.name}`,
    text: [
      `${req.user.name} has invited you to work on ${req.church.name} on Kingdom Network, as ${role}.`,
      '',
      'Accept the invitation here:',
      link(`/invite/${rawToken}`),
      '',
      'The invitation expires in fourteen days.',
    ].join('\n'),
  });

  await audit(req, { action: 'team:invited', entity: 'ChurchMembership', entityId: membership._id, after: { email, role } });

  res.status(201).json({ success: true, data: { id: membership._id, email, role, status: 'invited' } });
});

export const acceptInvite = asyncHandler(async (req, res) => {
  const membership = await ChurchMembership.findOne({
    inviteToken: req.params.token,
    status: 'invited',
    inviteExpiresAt: { $gt: new Date() },
  }).select('+inviteToken');

  if (!membership) {
    return res.status(404).json({ success: false, message: 'That invitation is not valid or has expired.' });
  }
  if (membership.invitedEmail && membership.invitedEmail !== req.user.email) {
    return res.status(403).json({
      success: false,
      message: `That invitation was sent to ${membership.invitedEmail}. Sign in with that address to accept it.`,
    });
  }

  membership.userId = req.user._id;
  membership.status = 'active';
  membership.acceptedAt = new Date();
  membership.inviteToken = undefined;
  await membership.save();

  req.user.churchSlug = membership.churchSlug;
  await req.user.save();

  const church = await Church.findOne({ slug: membership.churchSlug }, 'slug name shortName monogram');
  res.json({ success: true, data: { churchSlug: membership.churchSlug, role: membership.role, church } });
});

export const updateMember = asyncHandler(async (req, res) => {
  const membership = await ChurchMembership.findOne({ _id: req.params.id, churchSlug: req.church.slug });
  if (!membership) return res.status(404).json({ success: false, message: 'That person is not on this team.' });

  if (req.body?.role && CHURCH_ROLES.includes(req.body.role)) {
    if ((membership.role === 'owner' || req.body.role === 'owner') && req.membership?.role !== 'owner' && !req.actingAsPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'Only an owner can change an owner’s role.' });
    }
    membership.role = req.body.role;
  }
  if (typeof req.body?.title === 'string') membership.title = req.body.title.trim().slice(0, 120);
  if (['active', 'suspended'].includes(req.body?.status)) membership.status = req.body.status;

  // A church without an owner cannot be administered by anyone.
  if (membership.role !== 'owner' || membership.status !== 'active') {
    const owners = await ChurchMembership.countDocuments({
      churchSlug: req.church.slug,
      role: 'owner',
      status: 'active',
      _id: { $ne: membership._id },
    });
    if (!owners) {
      return res.status(409).json({ success: false, message: 'A church must always have one active owner.' });
    }
  }

  await membership.save();
  await audit(req, { action: 'team:updated', entity: 'ChurchMembership', entityId: membership._id, after: { role: membership.role, status: membership.status } });

  res.json({ success: true, data: { id: membership._id, role: membership.role, status: membership.status } });
});

export const removeMember = asyncHandler(async (req, res) => {
  const membership = await ChurchMembership.findOne({ _id: req.params.id, churchSlug: req.church.slug });
  if (!membership) return res.status(404).json({ success: false, message: 'That person is not on this team.' });

  if (membership.role === 'owner') {
    const owners = await ChurchMembership.countDocuments({ churchSlug: req.church.slug, role: 'owner', status: 'active' });
    if (owners <= 1) return res.status(409).json({ success: false, message: 'A church must always have one active owner.' });
  }

  await membership.deleteOne();
  await audit(req, { action: 'team:removed', entity: 'ChurchMembership', entityId: membership._id });
  res.json({ success: true, data: { removed: true } });
});

/* ── the console's front page ──────────────────────────────────────────── */

export const overview = asyncHandler(async (req, res) => {
  const slug = req.church.slug;
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [waiting, decided, upcoming, issued, revenue, drafts] = await Promise.all([
    Application.find(
      { churchSlug: slug, status: { $in: ['submitted', 'under_review', 'final_review', 'info_requested'] } },
      'reference offeringTitle status submittedAt userId updatedAt',
    ).sort({ submittedAt: 1 }).limit(10).populate('userId', 'name avatar'),
    Application.countDocuments({ churchSlug: slug, decidedAt: { $gte: monthAgo } }),
    Interview.find({ churchSlug: slug, status: { $in: ['scheduled', 'rescheduled'] }, scheduledFor: { $gte: new Date() } })
      .sort({ scheduledFor: 1 })
      .limit(5)
      .populate('userId', 'name avatar'),
    Credential.countDocuments({ churchSlug: slug, status: 'issued' }),
    Payment.aggregate([
      { $match: { churchSlug: slug, status: 'completed', completedAt: { $gte: monthAgo } } },
      { $group: { _id: '$kind', gross: { $sum: '$amount' }, net: { $sum: '$netToChurch' }, count: { $sum: 1 } } },
    ]),
    Offering.countDocuments({ churchSlug: slug, status: 'draft' }),
  ]);

  res.json({
    success: true,
    data: {
      church: { slug, name: req.church.name, status: req.church.status, verification: req.church.verification?.state },
      waiting: waiting.map((a) => ({
        reference: a.reference,
        offeringTitle: a.offeringTitle,
        status: a.status,
        submittedAt: a.submittedAt,
        applicant: a.userId ? { name: a.userId.name, avatar: a.userId.avatar } : null,
        // How long it has sat with the church, which is the number that matters.
        waitingDays: a.submittedAt ? Math.floor((Date.now() - a.submittedAt) / 86400000) : null,
      })),
      upcoming: upcoming.map((i) => ({
        id: i._id,
        scheduledFor: i.scheduledFor,
        provider: i.provider,
        joinUrl: i.joinUrl,
        applicant: i.userId ? { name: i.userId.name, avatar: i.userId.avatar } : null,
      })),
      stats: {
        waiting: waiting.length,
        decidedLast30Days: decided,
        issued,
        draftListings: drafts,
        revenueLast30Days: revenue.reduce((n, r) => n + r.net, 0),
        revenueByKind: revenue,
      },
    },
  });
});
