import { asyncHandler } from '../middleware/asyncHandler.js';
import { balanceFor } from '../lib/ledger.js';
import { LedgerEntry } from '../models/LedgerEntry.js';
import { Payment } from '../models/Payment.js';
import { PlatformSettings } from '../models/PlatformSettings.js';
import { Settlement } from '../models/Settlement.js';

/**
 * What a church has taken, what the platform kept, and what it is still owed.
 *
 * Money reaches the platform's own Pesapal account, because Pesapal has no
 * split-payment facility. So the honest presentation is a balance the platform
 * owes, settled by a named administrator who records the payout here.
 */

export const summary = asyncHandler(async (req, res) => {
  const slug = req.church.slug;
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [balance, settings, totals, recent, awaiting, settlements] = await Promise.all([
    balanceFor(slug),
    PlatformSettings.load(),
    Payment.aggregate([
      { $match: { churchSlug: slug, status: 'completed' } },
      {
        $group: {
          _id: '$kind',
          count: { $sum: 1 },
          gross: { $sum: '$amount' },
          fees: { $sum: '$platformFee' },
          net: { $sum: '$netToChurch' },
        },
      },
    ]),
    Payment.find({ churchSlug: slug, status: 'completed', completedAt: { $gte: monthAgo } })
      .sort({ completedAt: -1 })
      .limit(20)
      .lean(),
    Payment.aggregate([
      { $match: { churchSlug: slug, status: 'completed', settlementRef: { $in: [null, undefined] } } },
      { $group: { _id: null, count: { $sum: 1 }, net: { $sum: '$netToChurch' } } },
    ]),
    Settlement.find({ churchSlug: slug }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  res.json({
    success: true,
    data: {
      balance,
      commissionPercent: req.church.commissionPercentOverride ?? settings.commissionPercent,
      unsettled: { count: awaiting[0]?.count ?? 0, net: awaiting[0]?.net ?? 0 },
      totals,
      recent: recent.map((p) => ({
        reference: p.reference,
        kind: p.kind,
        description: p.description,
        amount: p.amount,
        platformFee: p.platformFee,
        netToChurch: p.netToChurch,
        completedAt: p.completedAt,
        payer: p.donation?.anonymous ? { name: 'Anonymous' } : { name: p.payer?.name },
        settled: Boolean(p.settlementRef),
      })),
      settlements,
      payout: {
        method: req.church.payout?.method,
        accountName: req.church.payout?.accountName,
        accountRefMasked: req.church.payout?.accountRefMasked,
        bankName: req.church.payout?.bankName,
        confirmedAt: req.church.payout?.confirmedAt,
      },
    },
  });
});

export const ledger = asyncHandler(async (req, res) => {
  const { page = '1', limit = '50' } = req.query;
  const perPage = Math.min(Number(limit) || 50, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const [entries, total] = await Promise.all([
    LedgerEntry.find({ churchSlug: req.church.slug }).sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
    LedgerEntry.countDocuments({ churchSlug: req.church.slug }),
  ]);

  res.json({ success: true, data: { entries, total, page: Number(page) || 1, pages: Math.ceil(total / perPage) } });
});

export const payments = asyncHandler(async (req, res) => {
  const { kind, status = 'completed', page = '1', limit = '50' } = req.query;
  const filter = { churchSlug: req.church.slug };
  if (kind) filter.kind = kind;
  if (status) filter.status = status;

  const perPage = Math.min(Number(limit) || 50, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
    Payment.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      payments: items.map((p) => ({
        reference: p.reference,
        kind: p.kind,
        description: p.description,
        amount: p.amount,
        platformFee: p.platformFee,
        netToChurch: p.netToChurch,
        status: p.status,
        method: p.pesapal?.paymentMethod,
        completedAt: p.completedAt,
        createdAt: p.createdAt,
        settlementRef: p.settlementRef,
        payer: p.donation?.anonymous ? { name: 'Anonymous' } : p.payer,
      })),
      total,
      page: Number(page) || 1,
      pages: Math.ceil(total / perPage),
    },
  });
});

/** Gifts received, with donor messages. */
export const donations = asyncHandler(async (req, res) => {
  const { page = '1', limit = '30' } = req.query;
  const perPage = Math.min(Number(limit) || 30, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const filter = { churchSlug: req.church.slug, kind: 'donation', status: 'completed' };

  const [gifts, total, byCause] = await Promise.all([
    Payment.find(filter).sort({ completedAt: -1 }).skip(skip).limit(perPage).lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([
      { $match: filter },
      { $group: { _id: '$donation.causeId', title: { $first: '$donation.causeTitle' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      donations: gifts.map((g) => ({
        reference: g.reference,
        amount: g.amount,
        netToChurch: g.netToChurch,
        completedAt: g.completedAt,
        cause: g.donation?.causeTitle,
        message: g.donation?.message,
        // An anonymous giver is anonymous to the church too, not merely to the page.
        giver: g.donation?.anonymous
          ? { name: 'Anonymous', anonymous: true }
          : { name: g.payer?.name, email: g.payer?.email, country: g.payer?.country },
      })),
      total,
      page: Number(page) || 1,
      pages: Math.ceil(total / perPage),
      byCause,
    },
  });
});
