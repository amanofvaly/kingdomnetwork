import { asyncHandler } from '../middleware/asyncHandler.js';
import { audit } from '../lib/audit.js';
import { reference as makeReference } from '../lib/ids.js';
import { balanceFor, recordSettlement } from '../lib/ledger.js';
import { notify } from '../lib/notify.js';
import { isMock, mode as pesapalMode } from '../lib/pesapal/index.js';
import { clearVisibilityCache } from '../lib/visibility.js';
import { Application } from '../models/Application.js';
import { AuditLog } from '../models/AuditLog.js';
import { Church } from '../models/Church.js';
import { ChurchMembership } from '../models/ChurchMembership.js';
import { Credential } from '../models/Credential.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { Offering } from '../models/Offering.js';
import { Payment } from '../models/Payment.js';
import { PlatformSettings } from '../models/PlatformSettings.js';
import { Settlement } from '../models/Settlement.js';
import { User } from '../models/User.js';

/**
 * The platform's own console.
 *
 * Two things here are the platform's alone and no church's: granting the
 * verified badge, and settling what churches are owed. Everything else is
 * oversight — being able to see across churches when something goes wrong.
 */

export const overview = asyncHandler(async (req, res) => {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [churches, published, demoChurches, pendingVerification, users, applications, issued, revenue, owed] = await Promise.all([
    Church.countDocuments({ demo: { $ne: true } }),
    Church.countDocuments({ status: 'published', demo: { $ne: true } }),
    Church.countDocuments({ demo: true }),
    Church.countDocuments({ 'verification.state': 'pending' }),
    User.countDocuments({}),
    Application.countDocuments({ createdAt: { $gte: monthAgo } }),
    Credential.countDocuments({ status: 'issued' }),
    Payment.aggregate([
      { $match: { status: 'completed', completedAt: { $gte: monthAgo } } },
      { $group: { _id: '$kind', gross: { $sum: '$amount' }, fees: { $sum: '$platformFee' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'completed', settlementRef: { $in: [null, undefined] } } },
      { $group: { _id: '$churchSlug', net: { $sum: '$netToChurch' }, count: { $sum: 1 } } },
      { $sort: { net: -1 } },
      { $limit: 20 },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      counts: { churches, published, demoChurches, pendingVerification, users, applicationsLast30Days: applications, issued },
      revenueLast30Days: revenue,
      platformFeesLast30Days: revenue.reduce((n, r) => n + r.fees, 0),
      owedToChurches: owed,
      totalOwed: owed.reduce((n, o) => n + o.net, 0),
    },
  });
});

/* ── churches and verification ─────────────────────────────────────────── */

export const listChurches = asyncHandler(async (req, res) => {
  const { q, status, verification, demo, page = '1', limit = '30' } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (verification) filter['verification.state'] = verification;
  if (demo === 'false') filter.demo = { $ne: true };
  if (demo === 'true') filter.demo = true;
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { slug: rx }, { city: rx }, { country: rx }];
  }

  const perPage = Math.min(Number(limit) || 30, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const [churches, total] = await Promise.all([
    Church.find(filter, 'slug name shortName city country status verification demo publishedAt createdAt ownerId monogram')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
    Church.countDocuments(filter),
  ]);

  const slugs = churches.map((c) => c.slug);
  const [offerings, apps] = await Promise.all([
    Offering.aggregate([{ $match: { churchSlug: { $in: slugs } } }, { $group: { _id: '$churchSlug', count: { $sum: 1 } } }]),
    Application.aggregate([{ $match: { churchSlug: { $in: slugs } } }, { $group: { _id: '$churchSlug', count: { $sum: 1 } } }]),
  ]);
  const offeringBy = Object.fromEntries(offerings.map((o) => [o._id, o.count]));
  const appBy = Object.fromEntries(apps.map((a) => [a._id, a.count]));

  res.json({
    success: true,
    data: {
      churches: churches.map((c) => ({ ...c, offeringCount: offeringBy[c.slug] ?? 0, applicationCount: appBy[c.slug] ?? 0 })),
      total,
      page: Number(page) || 1,
      pages: Math.ceil(total / perPage),
    },
  });
});

export const verificationQueue = asyncHandler(async (req, res) => {
  const churches = await Church.find(
    { 'verification.state': { $in: ['pending', 'rejected'] } },
    'slug name city country verification legal contact website createdAt',
  )
    .sort({ 'verification.submittedAt': 1 })
    .populate('verification.documents.mediaId', 'storageKey filename mimeType')
    .lean();

  res.json({
    success: true,
    data: churches.map((c) => ({
      ...c,
      verification: {
        ...c.verification,
        documents: (c.verification?.documents ?? []).map((d) => ({
          label: d.label,
          uploadedAt: d.uploadedAt,
          url: d.mediaId?.storageKey ? `/api/media/file/${d.mediaId.storageKey}` : null,
          filename: d.mediaId?.filename,
        })),
      },
    })),
  });
});

/**
 * Grant or withhold the badge. This is a statement the platform makes to
 * visitors about documents it has actually seen, so a rejection has to carry a
 * reason the church can act on.
 */
export const decideVerification = asyncHandler(async (req, res) => {
  const church = await Church.findOne({ slug: req.params.slug });
  if (!church) return res.status(404).json({ success: false, message: 'That church was not found.' });

  const state = req.body?.state;
  if (!['verified', 'rejected', 'unverified'].includes(state)) {
    return res.status(400).json({ success: false, message: 'Set the state to verified, rejected or unverified.' });
  }
  if (state === 'rejected' && !String(req.body?.notes ?? '').trim()) {
    return res.status(400).json({ success: false, message: 'Say why, so the church can put it right.' });
  }

  church.verification.state = state;
  church.verification.reviewedBy = req.user._id;
  church.verification.reviewedAt = new Date();
  church.verification.notes = String(req.body?.notes ?? '').slice(0, 2000) || undefined;
  await church.save();

  await audit(req, { action: `verification:${state}`, entity: 'Church', entityId: church._id, churchSlug: church.slug, after: { state } });

  await notify.church(church.slug, {
    kind: `verification:${state}`,
    title:
      state === 'verified'
        ? 'Your church has been verified'
        : state === 'rejected'
          ? 'Your verification needs more'
          : 'Verification withdrawn',
    body: church.verification.notes,
    link: `/manage/${church.slug}/settings`,
  });

  res.json({ success: true, data: { slug: church.slug, verification: church.verification } });
});

export const setChurchStatus = asyncHandler(async (req, res) => {
  const church = await Church.findOne({ slug: req.params.slug });
  if (!church) return res.status(404).json({ success: false, message: 'That church was not found.' });

  if (!['published', 'suspended', 'draft'].includes(req.body?.status)) {
    return res.status(400).json({ success: false, message: 'Set the status to published, suspended or draft.' });
  }
  if (req.body.status === 'suspended' && !String(req.body?.reason ?? '').trim()) {
    return res.status(400).json({ success: false, message: 'Suspending a church needs a reason on the record.' });
  }

  const before = church.status;
  church.status = req.body.status;
  await church.save();

  await audit(req, {
    action: 'church:status',
    entity: 'Church',
    entityId: church._id,
    churchSlug: church.slug,
    before: { status: before },
    after: { status: church.status },
    note: req.body?.reason,
  });

  res.json({ success: true, data: { slug: church.slug, status: church.status } });
});

/* ── people ────────────────────────────────────────────────────────────── */

export const listUsers = asyncHandler(async (req, res) => {
  const { q, role, status, page = '1', limit = '30' } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const perPage = Math.min(Number(limit) || 30, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const [users, total] = await Promise.all([
    User.find(filter, 'name email role status country avatar createdAt lastLoginAt churchSlug').sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
    User.countDocuments(filter),
  ]);

  const memberships = await ChurchMembership.find({ userId: { $in: users.map((u) => u._id) } }, 'userId churchSlug role status').lean();
  const byUser = new Map();
  for (const m of memberships) {
    const list = byUser.get(String(m.userId)) ?? [];
    list.push({ churchSlug: m.churchSlug, role: m.role, status: m.status });
    byUser.set(String(m.userId), list);
  }

  res.json({
    success: true,
    data: {
      users: users.map((u) => ({ ...u, memberships: byUser.get(String(u._id)) ?? [] })),
      total,
      page: Number(page) || 1,
      pages: Math.ceil(total / perPage),
    },
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'No such account.' });

  // The last administrator cannot demote or suspend themselves out of the
  // console, which would leave nobody able to administer the platform.
  const losingAdmin = user.role === 'platform_admin' && (req.body?.role === 'member' || req.body?.status === 'suspended');
  if (losingAdmin) {
    const others = await User.countDocuments({ role: 'platform_admin', status: 'active', _id: { $ne: user._id } });
    if (!others) {
      return res.status(409).json({ success: false, message: 'There must always be one active platform administrator.' });
    }
  }

  if (['member', 'platform_admin'].includes(req.body?.role)) user.role = req.body.role;
  if (['active', 'suspended'].includes(req.body?.status)) user.status = req.body.status;
  await user.save();

  await audit(req, { action: 'user:updated', entity: 'User', entityId: user._id, after: { role: user.role, status: user.status } });
  res.json({ success: true, data: user.toPublic() });
});

/* ── money ─────────────────────────────────────────────────────────────── */

export const listPayments = asyncHandler(async (req, res) => {
  const { q, kind, status, church, settled, page = '1', limit = '50' } = req.query;
  const filter = {};
  if (kind) filter.kind = kind;
  if (status) filter.status = status;
  if (church) filter.churchSlug = church;
  if (settled === 'false') filter.settlementRef = { $in: [null, undefined] };
  if (settled === 'true') filter.settlementRef = { $nin: [null, undefined] };
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ reference: rx }, { 'payer.email': rx }, { 'pesapal.orderTrackingId': rx }, { 'pesapal.confirmationCode': rx }];
  }

  const perPage = Math.min(Number(limit) || 50, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const [payments, total, totals] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: filter }, { $group: { _id: null, gross: { $sum: '$amount' }, fees: { $sum: '$platformFee' }, net: { $sum: '$netToChurch' } } }]),
  ]);

  res.json({
    success: true,
    data: { payments, total, page: Number(page) || 1, pages: Math.ceil(total / perPage), totals: totals[0] ?? { gross: 0, fees: 0, net: 0 } },
  });
});

/** What each church is owed right now. The starting point for a payout run. */
export const owed = asyncHandler(async (req, res) => {
  const rows = await Payment.aggregate([
    { $match: { status: 'completed', settlementRef: { $in: [null, undefined] } } },
    {
      $group: {
        _id: '$churchSlug',
        count: { $sum: 1 },
        gross: { $sum: '$amount' },
        fees: { $sum: '$platformFee' },
        net: { $sum: '$netToChurch' },
        oldest: { $min: '$completedAt' },
      },
    },
    { $sort: { net: -1 } },
  ]);

  const churches = await Church.find({ slug: { $in: rows.map((r) => r._id) } }, 'slug name shortName payout verification.state').lean();
  const by = Object.fromEntries(churches.map((c) => [c.slug, c]));

  res.json({
    success: true,
    data: rows.map((r) => ({
      churchSlug: r._id,
      church: by[r._id] ?? null,
      count: r.count,
      gross: r.gross,
      fees: r.fees,
      net: r.net,
      oldest: r.oldest,
      // A payout cannot be made to a church that has not given its details.
      payable: Boolean(by[r._id]?.payout?.accountRefMasked),
    })),
  });
});

/**
 * Build a payout run. Gathers every completed payment for a church that is not
 * already in a settlement and freezes the totals onto the record.
 */
export const prepareSettlement = asyncHandler(async (req, res) => {
  const churchSlug = req.body?.churchSlug;
  const church = await Church.findOne({ slug: churchSlug });
  if (!church) return res.status(404).json({ success: false, message: 'That church was not found.' });

  const filter = { churchSlug, status: 'completed', settlementRef: { $in: [null, undefined] } };
  if (req.body?.periodEnd) filter.completedAt = { $lte: new Date(req.body.periodEnd) };

  const payments = await Payment.find(filter, 'reference amount platformFee netToChurch completedAt').lean();
  if (!payments.length) {
    return res.status(409).json({ success: false, message: 'There is nothing outstanding for this church.' });
  }

  const round = (n) => Math.round(n * 100) / 100;
  const gross = round(payments.reduce((n, p) => n + p.amount, 0));
  const platformFee = round(payments.reduce((n, p) => n + p.platformFee, 0));
  const net = round(payments.reduce((n, p) => n + p.netToChurch, 0));

  const settlement = await Settlement.create({
    reference: makeReference('SET'),
    churchSlug,
    periodStart: payments.reduce((min, p) => (p.completedAt < min ? p.completedAt : min), payments[0].completedAt),
    periodEnd: payments.reduce((max, p) => (p.completedAt > max ? p.completedAt : max), payments[0].completedAt),
    paymentRefs: payments.map((p) => p.reference),
    paymentCount: payments.length,
    gross,
    platformFee,
    net,
    status: 'pending',
    method: church.payout?.method,
    destination: church.payout?.accountRefMasked,
    preparedBy: req.user._id,
  });

  // Claim the payments immediately so a second run cannot include them too.
  await Payment.updateMany(
    { reference: { $in: settlement.paymentRefs } },
    { $set: { settlementRef: settlement.reference } },
  );

  await audit(req, { action: 'settlement:prepared', entity: 'Settlement', entityId: settlement._id, churchSlug, after: { net, count: payments.length } });

  res.status(201).json({ success: true, data: settlement.toObject() });
});

export const listSettlements = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.church) filter.churchSlug = req.query.church;
  if (req.query.status) filter.status = req.query.status;

  const settlements = await Settlement.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  const churches = await Church.find({ slug: { $in: settlements.map((s) => s.churchSlug) } }, 'slug name shortName payout').lean();
  const by = Object.fromEntries(churches.map((c) => [c.slug, c]));

  res.json({ success: true, data: settlements.map((s) => ({ ...s, church: by[s.churchSlug] ?? null })) });
});

/** Record that the payout was actually made, off the platform. */
export const markSettlementPaid = asyncHandler(async (req, res) => {
  const settlement = await Settlement.findOne({ reference: req.params.reference });
  if (!settlement) return res.status(404).json({ success: false, message: 'No such settlement.' });
  if (settlement.status === 'paid') return res.status(409).json({ success: false, message: 'That settlement is already marked paid.' });

  const externalRef = String(req.body?.externalRef ?? '').trim();
  if (!externalRef) {
    return res.status(400).json({ success: false, message: 'Record the transfer reference, so this can be traced later.' });
  }

  settlement.status = 'paid';
  settlement.externalRef = externalRef.slice(0, 200);
  settlement.method = req.body?.method ?? settlement.method;
  settlement.evidenceMediaId = req.body?.evidenceMediaId ?? undefined;
  settlement.notes = String(req.body?.notes ?? '').slice(0, 2000) || undefined;
  settlement.markedBy = req.user._id;
  settlement.paidAt = new Date();
  await settlement.save();

  await recordSettlement(settlement, req.user._id);
  await audit(req, { action: 'settlement:paid', entity: 'Settlement', entityId: settlement._id, churchSlug: settlement.churchSlug, after: { externalRef, net: settlement.net } });

  await notify.church(settlement.churchSlug, {
    kind: 'settlement:paid',
    title: `A payout of $${settlement.net.toFixed(2)} has been sent`,
    body: `Covering ${settlement.paymentCount} payment${settlement.paymentCount === 1 ? '' : 's'}. Reference ${externalRef}.`,
    link: `/manage/${settlement.churchSlug}/finance`,
    roles: ['owner', 'admin', 'finance'],
  });

  res.json({ success: true, data: { reference: settlement.reference, status: settlement.status, balance: await balanceFor(settlement.churchSlug) } });
});

export const cancelSettlement = asyncHandler(async (req, res) => {
  const settlement = await Settlement.findOne({ reference: req.params.reference });
  if (!settlement) return res.status(404).json({ success: false, message: 'No such settlement.' });
  if (settlement.status === 'paid') {
    return res.status(409).json({ success: false, message: 'A paid settlement cannot be cancelled. Record an adjustment instead.' });
  }

  // Release the payments back into the unsettled pool.
  await Payment.updateMany({ settlementRef: settlement.reference }, { $unset: { settlementRef: '' } });
  settlement.status = 'cancelled';
  await settlement.save();

  await audit(req, { action: 'settlement:cancelled', entity: 'Settlement', entityId: settlement._id, churchSlug: settlement.churchSlug });
  res.json({ success: true, data: { reference: settlement.reference, status: settlement.status } });
});

export const churchLedger = asyncHandler(async (req, res) => {
  const entries = await LedgerEntry.find({ churchSlug: req.params.slug }).sort({ createdAt: -1 }).limit(500).lean();
  res.json({ success: true, data: { entries, balance: await balanceFor(req.params.slug) } });
});

/* ── settings and merchandising ────────────────────────────────────────── */

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await PlatformSettings.load();
  res.json({
    success: true,
    data: {
      ...settings.toObject(),
      pesapal: {
        ...settings.pesapal?.toObject?.(),
        // Which gateway is taking money. `sandbox` is real Pesapal against test
        // keys, so it is configured but still moves nothing — an administrator
        // has to be able to tell it from `live`. Credentials are never echoed.
        mode: pesapalMode,
        configured: !isMock,
        movesRealMoney: pesapalMode === 'live',
      },
    },
  });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await PlatformSettings.load();

  if (Number.isFinite(req.body?.commissionPercent)) {
    const percent = Number(req.body.commissionPercent);
    if (percent < 0 || percent > 50) {
      return res.status(400).json({ success: false, message: 'The commission must be between 0 and 50 percent.' });
    }
    settings.commissionPercent = percent;
  }

  if (typeof req.body?.demoMode === 'boolean') {
    settings.demoMode = req.body.demoMode;
    clearVisibilityCache();
  }
  if (req.body?.disclosures) settings.disclosures = { ...settings.disclosures?.toObject?.(), ...req.body.disclosures };
  if (req.body?.features) settings.features = { ...settings.features?.toObject?.(), ...req.body.features };
  if (Array.isArray(req.body?.homeSlots)) settings.homeSlots = req.body.homeSlots.slice(0, 12);

  await settings.save();
  await audit(req, { action: 'settings:updated', entity: 'PlatformSettings', after: { commissionPercent: settings.commissionPercent, demoMode: settings.demoMode } });

  res.json({ success: true, data: settings.toObject() });
});

/** Platform merchandising. Never applied to something that confers standing. */
export const setMerchandising = asyncHandler(async (req, res) => {
  const offering = await Offering.findOne({ slug: req.params.slug });
  if (!offering) return res.status(404).json({ success: false, message: 'That listing was not found.' });

  for (const field of ['featured', 'editorsPick']) {
    if (typeof req.body?.[field] === 'boolean') offering[field] = req.body[field];
  }
  if (Number.isFinite(req.body?.boost)) offering.boost = Math.max(0, Math.min(100, Math.round(req.body.boost)));
  if (typeof req.body?.badge === 'string') offering.badge = req.body.badge.trim().slice(0, 40) || undefined;

  await offering.save();
  await audit(req, { action: 'merchandising:set', entity: 'Offering', entityId: offering._id, churchSlug: offering.churchSlug, after: { featured: offering.featured, boost: offering.boost } });

  res.json({ success: true, data: { slug: offering.slug, featured: offering.featured, editorsPick: offering.editorsPick, boost: offering.boost, badge: offering.badge } });
});

export const listAudit = asyncHandler(async (req, res) => {
  const { action, church, entity, page = '1', limit = '50' } = req.query;
  const filter = {};
  if (action) filter.action = new RegExp(`^${String(action).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  if (church) filter.churchSlug = church;
  if (entity) filter.entity = entity;

  const perPage = Math.min(Number(limit) || 50, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const [entries, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage).populate('actorId', 'name email').lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ success: true, data: { entries, total, page: Number(page) || 1, pages: Math.ceil(total / perPage) } });
});

/** Cross-church oversight, for when something has gone wrong. */
export const listApplications = asyncHandler(async (req, res) => {
  const { status, church, page = '1', limit = '50' } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (church) filter.churchSlug = church;

  const perPage = Math.min(Number(limit) || 50, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const [applications, total] = await Promise.all([
    Application.find(filter, 'reference churchSlug offeringSlug offeringTitle status submittedAt decidedAt credentialId')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(perPage)
      .populate('userId', 'name email')
      .lean(),
    Application.countDocuments(filter),
  ]);

  res.json({ success: true, data: { applications, total, page: Number(page) || 1, pages: Math.ceil(total / perPage) } });
});
