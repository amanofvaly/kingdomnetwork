import { LedgerEntry } from '../models/LedgerEntry.js';

/**
 * A church's running account with the platform.
 *
 * Append-only. The balance is the last entry's `balanceAfter` rather than a sum
 * recomputed on read, so what a church is shown can always be explained line by
 * line — and a bug in one write cannot silently change every historical figure.
 */

const round = (n) => Math.round(n * 100) / 100;

/**
 * Summed rather than read off the newest row.
 *
 * `balanceAfter` is a snapshot written at insert time, and two entries created
 * in the same instant can compute it from the same starting point. The sum
 * cannot: it is right whatever order the writes interleaved in.
 */
export const balanceFor = async (churchSlug) => {
  const [row] = await LedgerEntry.aggregate([
    { $match: { churchSlug } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return round(row?.total ?? 0);
};

const append = async (churchSlug, entry) => {
  const balanceAfter = round((await balanceFor(churchSlug)) + entry.amount);
  try {
    return await LedgerEntry.create({ churchSlug, ...entry, balanceAfter });
  } catch (err) {
    // The unique index on (paymentRef, type) is the last line of defence
    // against a payment being credited twice. Hitting it is not an error.
    if (err.code === 11000) return null;
    throw err;
  }
};

/**
 * A completed payment: the church is credited the gross and debited the
 * platform's fee, as two lines rather than one net figure, so a church can see
 * what was taken and why.
 */
export const recordPayment = async (payment) => {
  const credit = await append(payment.churchSlug, {
    type: 'credit',
    amount: round(payment.amount),
    paymentRef: payment.reference,
    description: payment.description ?? payment.kind,
  });

  if (payment.platformFee > 0) {
    await append(payment.churchSlug, {
      type: 'fee',
      amount: -round(payment.platformFee),
      paymentRef: payment.reference,
      description: `Platform fee (${payment.commissionPercent}%)`,
    });
  }

  return credit;
};

export const recordRefund = async (payment) =>
  append(payment.churchSlug, {
    type: 'refund',
    amount: -round(payment.netToChurch),
    paymentRef: payment.reference,
    description: `Refunded — ${payment.refundReason ?? 'no reason given'}`,
  });

export const recordSettlement = async (settlement, actorId) =>
  append(settlement.churchSlug, {
    type: 'settlement',
    amount: -round(settlement.net),
    settlementRef: settlement.reference,
    description: `Settled ${settlement.paymentCount} payment${settlement.paymentCount === 1 ? '' : 's'}`,
    createdBy: actorId,
  });

export const recordAdjustment = async (churchSlug, { amount, description, actorId }) =>
  append(churchSlug, { type: 'adjustment', amount: round(amount), description, createdBy: actorId });

/** Split an amount into what the platform keeps and what the church is owed. */
export const splitFee = (amount, commissionPercent) => {
  const platformFee = round((amount * commissionPercent) / 100);
  return { platformFee, netToChurch: round(amount - platformFee) };
};
