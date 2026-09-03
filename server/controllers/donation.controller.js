import { asyncHandler } from '../middleware/asyncHandler.js';
import { PLATFORM_DISCLOSURES } from '../lib/disclosures.js';
import { createPayment } from './payment.controller.js';
import { Church } from '../models/Church.js';
import { Payment } from '../models/Payment.js';
import { PlatformSettings } from '../models/PlatformSettings.js';

/**
 * Giving to a church through its page.
 *
 * No account is required — asking someone to register before they can give is
 * a barrier with no purpose. What the platform keeps is stated on the form
 * rather than buried, because a giver intending the money for a church should
 * be told what actually reaches it.
 */

export const givingPage = asyncHandler(async (req, res) => {
  const church = await Church.findOne(
    { slug: req.params.slug, status: 'published' },
    'slug name shortName monogram tagline city country coverImage coverAlt verified donations demo',
  );

  if (!church || !church.donations?.enabled) {
    return res.status(404).json({ success: false, message: 'This church is not receiving gifts here.' });
  }

  const settings = await PlatformSettings.load();
  const causes = (church.donations.causes ?? []).filter((c) => c.active);

  const recent = church.donations.showRecentGifts
    ? await Payment.find(
        { churchSlug: church.slug, kind: 'donation', status: 'completed' },
        'amount completedAt donation.anonymous donation.displayName donation.causeTitle donation.consentToDisplay payer.name payer.country',
      )
        .sort({ completedAt: -1 })
        .limit(8)
        .lean()
    : [];

  res.json({
    success: true,
    data: {
      church,
      causes,
      suggestedAmounts: church.donations.suggestedAmounts,
      allowCustom: church.donations.allowCustom,
      allowAnonymous: church.donations.allowAnonymous,
      minAmount: church.donations.minAmount ?? 5,
      headline: church.donations.headline,
      blurb: church.donations.blurb,
      commissionPercent: church.commissionPercentOverride ?? settings.commissionPercent,
      disclosure: PLATFORM_DISCLOSURES.donation,
      recent: recent
        // Only gifts whose giver agreed to be named appear, and never an amount
        // attached to a name that was not offered.
        .filter((g) => g.donation?.consentToDisplay && !g.donation?.anonymous)
        .map((g) => ({
          name: g.donation?.displayName ?? g.payer?.name,
          country: g.payer?.country,
          cause: g.donation?.causeTitle,
          at: g.completedAt,
        })),
    },
  });
});

export const give = asyncHandler(async (req, res) => {
  const church = await Church.findOne({ slug: req.params.slug, status: 'published' });
  if (!church?.donations?.enabled) {
    return res.status(404).json({ success: false, message: 'This church is not receiving gifts here.' });
  }

  const amount = Math.round(Number(req.body?.amount) * 100) / 100;
  const minimum = church.donations.minAmount ?? 5;

  if (!Number.isFinite(amount) || amount < minimum) {
    return res.status(400).json({ success: false, message: `The smallest gift is $${minimum}.` });
  }
  if (amount > 100000) {
    return res.status(400).json({ success: false, message: 'For a gift that size, contact the church directly.' });
  }

  const cause = req.body?.causeId
    ? (church.donations.causes ?? []).find((c) => c.id === req.body.causeId && c.active)
    : null;
  if (req.body?.causeId && !cause) {
    return res.status(400).json({ success: false, message: 'That is not something this church is currently raising for.' });
  }

  const anonymous = church.donations.allowAnonymous && req.body?.anonymous === true;

  const email = String(req.body?.email ?? req.user?.email ?? '').toLowerCase().trim();
  const phone = String(req.body?.phone ?? req.user?.phone ?? '').trim();
  // Pesapal needs one of the two to reach the payer.
  if (!email && !phone) {
    return res.status(400).json({ success: false, message: 'Leave an email address or a phone number so we can send your receipt.' });
  }

  const payment = await createPayment({
    kind: 'donation',
    amount,
    description: cause ? `Gift — ${cause.title}` : `Gift to ${church.shortName ?? church.name}`,
    churchSlug: church.slug,
    user: req.user,
    payer: {
      name: anonymous ? 'Anonymous' : String(req.body?.name ?? req.user?.name ?? '').trim().slice(0, 120),
      email,
      phone,
      country: String(req.body?.country ?? req.user?.country ?? '').trim(),
    },
    donation: {
      causeId: cause?.id,
      causeTitle: cause?.title,
      message: String(req.body?.message ?? '').trim().slice(0, 1000),
      anonymous,
      displayName: anonymous ? undefined : String(req.body?.displayName ?? req.body?.name ?? '').trim().slice(0, 120),
      consentToDisplay: !anonymous && req.body?.consentToDisplay === true,
    },
  });

  res.status(201).json({
    success: true,
    data: { reference: payment.reference, redirectUrl: payment.pesapal.redirectUrl, amount: payment.amount },
  });
});

/** The page a giver lands on when they come back from the gateway. */
export const thanks = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ reference: req.query.ref, kind: 'donation' });
  if (!payment) return res.status(404).json({ success: false, message: 'We could not find that gift.' });

  const church = await Church.findOne({ slug: payment.churchSlug }, 'slug name shortName monogram donations.thankYouMessage');

  res.json({
    success: true,
    data: {
      reference: payment.reference,
      amount: payment.amount,
      status: payment.status,
      cause: payment.donation?.causeTitle,
      church,
      message: church?.donations?.thankYouMessage,
      disclosure: PLATFORM_DISCLOSURES.donation,
    },
  });
});
