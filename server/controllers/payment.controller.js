import { env } from '../config/env.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { recordPayment, splitFee } from '../lib/ledger.js';
import { mailer } from '../lib/mailer/index.js';
import { notify } from '../lib/notify.js';
import { gateway, isMock, mock } from '../lib/pesapal/index.js';
import { reference as makeReference } from '../lib/ids.js';
import { sendReferenceRequests } from './application.controller.js';
import { advance } from '../lib/workflow.js';
import { Application } from '../models/Application.js';
import { Church } from '../models/Church.js';
import { Enrollment } from '../models/Enrollment.js';
import { Offering } from '../models/Offering.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PlatformSettings } from '../models/PlatformSettings.js';

/**
 * Money in.
 *
 * Pesapal tells us that an order changed, never what it changed to — the
 * callback the browser returns on and the server-to-server IPN both carry only
 * an order tracking id. So both paths do the same thing: fetch the real status,
 * then hand it to `applyPaymentResult`, which is written to be safe to run
 * twice. That matters, because the two arrive at roughly the same moment and
 * whichever wins must not be able to issue anything twice.
 */

const commissionFor = async (church) => {
  if (church?.commissionPercentOverride != null) return church.commissionPercentOverride;
  const settings = await PlatformSettings.load();
  return settings.commissionPercent ?? env.commissionPercent;
};

const splitName = (name) => {
  const parts = String(name ?? '').trim().split(/\s+/);
  return { firstName: parts[0] ?? undefined, lastName: parts.length > 1 ? parts.slice(1).join(' ') : undefined };
};

/**
 * Create the gateway order and return where to send the payer.
 * Never trusts a client-supplied amount — every figure is re-read here.
 */
export const createPayment = async ({ kind, amount, description, churchSlug, user, payer, applicationId, orderRef, donation }) => {
  const church = await Church.findOne({ slug: churchSlug }, 'slug name shortName commissionPercentOverride');
  const commissionPercent = await commissionFor(church);
  const { platformFee, netToChurch } = splitFee(amount, commissionPercent);

  const payment = await Payment.create({
    reference: makeReference('PAY'),
    kind,
    userId: user?._id,
    churchSlug,
    applicationId,
    orderRef,
    donation,
    description,
    amount,
    currency: 'USD',
    commissionPercent,
    platformFee,
    netToChurch,
    status: 'created',
    provider: isMock ? 'mock' : 'pesapal',
    payer: {
      name: payer?.name ?? user?.name,
      email: payer?.email ?? user?.email,
      phone: payer?.phone ?? user?.phone,
      country: payer?.country ?? user?.country,
    },
  });

  const { firstName, lastName } = splitName(payment.payer.name);

  const order = await gateway.submitOrder({
    reference: payment.reference,
    amount,
    currency: 'USD',
    description,
    payer: { email: payment.payer.email, phone: payment.payer.phone, firstName, lastName },
    callbackUrl: `${env.publicBaseUrl}/api/payments/callback`,
    cancellationUrl: `${env.publicBaseUrl}/api/payments/cancelled?ref=${payment.reference}`,
  });

  payment.pesapal = {
    orderTrackingId: order.orderTrackingId,
    merchantReference: order.merchantReference,
    redirectUrl: order.redirectUrl,
  };
  payment.status = 'pending';
  await payment.save();

  return payment;
};

/**
 * The one place a payment's outcome is acted on.
 *
 * The IPN and the browser callback both land here, at roughly the same moment,
 * for the same payment. Reading the status and then writing it would let both
 * pass the guard and fulfil the order twice — so the transition to `completed`
 * is a single conditional update, and only the caller whose update actually
 * matched goes on to credit the ledger and fulfil.
 */
export const applyPaymentResult = async (payment, status) => {
  const gateway = {
    ...(payment.pesapal?.toObject?.() ?? payment.pesapal),
    confirmationCode: status.confirmationCode,
    paymentMethod: status.paymentMethod,
    paymentAccount: status.paymentAccount,
    statusCode: status.statusCode,
    statusDescription: status.description,
    lastCheckedAt: new Date(),
  };

  if (status.state !== 'completed') {
    // A late "invalid" or "failed" notification must not undo a payment that
    // has already completed and been fulfilled.
    const settled = ['completed', 'refunded'].includes(payment.status);
    payment.pesapal = gateway;
    if (!settled) {
      payment.status = status.state === 'reversed' ? 'reversed' : status.state === 'failed' ? 'failed' : 'pending';
    }
    await payment.save();
    return { payment, changed: false };
  }

  // Pesapal is the authority on what was actually paid. If it differs from what
  // we asked for, record the real figure and re-split the fee against it.
  const amount = status.amount != null && Math.abs(Number(status.amount) - payment.amount) > 0.009
    ? Number(status.amount)
    : payment.amount;
  const { platformFee, netToChurch } = splitFee(amount, payment.commissionPercent);

  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $nin: ['completed', 'refunded'] } },
    {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        amount,
        platformFee,
        netToChurch,
        pesapal: gateway,
        ...(payment.ipnEvents?.length ? { ipnEvents: payment.ipnEvents } : {}),
      },
    },
    { new: true },
  );

  if (!claimed) {
    // Someone else got there first. Record what the gateway told us and stop.
    const current = await Payment.findById(payment._id);
    if (current) {
      current.pesapal = gateway;
      await current.save();
      return { payment: current, changed: false };
    }
    return { payment, changed: false };
  }

  await recordPayment(claimed);
  await fulfil(claimed);

  return { payment: claimed, changed: true };
};

/** What a completed payment entitles. Never issues a credential. */
const fulfil = async (payment) => {
  if (payment.kind === 'application_fee') {
    const application = await Application.findById(payment.applicationId);
    if (!application || application.paymentRef) return;

    application.paymentRef = payment.reference;
    application.submittedAt = application.submittedAt ?? new Date();
    application.log({ event: 'fee:paid', note: `$${payment.amount.toFixed(2)}`, actorRole: 'applicant', visibility: 'both' });

    const offering = await Offering.findOne({ slug: application.offeringSlug });
    await advance(application, { offering, event: 'application:submitted' });
    await sendReferenceRequests(application);

    await notify.church(application.churchSlug, {
      kind: 'application:submitted',
      title: `New application for ${application.offeringTitle}`,
      body: 'The application fee has been paid.',
      link: `/manage/${application.churchSlug}/applicants/${application.reference}`,
    });
    return;
  }

  if (payment.kind === 'course' || payment.kind === 'resource') {
    const order = await Order.findOne({ reference: payment.orderRef });
    if (!order) return;

    for (const item of order.items) {
      if (item.churchSlug !== payment.churchSlug) continue;
      const key = item.kind === 'course' ? { courseSlug: item.slug } : { resourceSlug: item.slug };
      await Enrollment.updateOne(
        { userId: order.userId, ...key },
        {
          $setOnInsert: {
            userId: order.userId,
            kind: item.kind,
            ...key,
            churchSlug: item.churchSlug,
            orderRef: order.reference,
            startedAt: new Date(),
          },
        },
        { upsert: true },
      );
    }

    // An order can span several churches and therefore several payments; it is
    // only paid once every one of them has cleared.
    const payments = await Payment.find({ reference: { $in: order.paymentRefs } }, 'status');
    if (payments.every((p) => p.status === 'completed')) {
      order.status = 'paid';
      order.paidAt = new Date();
      await order.save();
    }
    return;
  }

  if (payment.kind === 'donation') {
    if (payment.donation?.causeId) {
      await Church.updateOne(
        { slug: payment.churchSlug, 'donations.causes.id': payment.donation.causeId },
        { $inc: { 'donations.causes.$.raisedAmount': payment.amount } },
      );
    }

    if (payment.payer?.email) {
      const church = await Church.findOne({ slug: payment.churchSlug }, 'name shortName');
      await mailer.send({
        to: payment.payer.email,
        subject: `Thank you — your gift to ${church?.name ?? 'the church'}`,
        text: [
          `Your gift of $${payment.amount.toFixed(2)} to ${church?.name ?? payment.churchSlug} has been received.`,
          payment.donation?.causeTitle ? `Toward: ${payment.donation.causeTitle}` : '',
          '',
          `Reference: ${payment.reference}`,
          '',
          'Gifts are collected by Kingdom Network on behalf of the receiving church and passed to it after the platform’s stated fee. Kingdom Network is not a registered charity and cannot issue tax receipts; ask the church what it can provide.',
        ].filter(Boolean).join('\n'),
      });
    }

    await notify.church(payment.churchSlug, {
      kind: 'donation:received',
      title: `A gift of $${payment.amount.toFixed(2)}`,
      body: payment.donation?.anonymous ? 'From an anonymous giver.' : `From ${payment.payer?.name ?? 'a giver'}.`,
      link: `/manage/${payment.churchSlug}/donations`,
    });
  }
};

/**
 * Start paying an application fee.
 *
 * Lives here rather than in the application controller so that the module that
 * owns money is the only one that creates a Payment — and so the two files do
 * not import each other.
 */
export const payApplicationFee = asyncHandler(async (req, res) => {
  const application = await Application.findOne({ reference: req.params.reference, userId: req.user._id });
  if (!application) return res.status(404).json({ success: false, message: 'That application was not found.' });
  if (application.paymentRef) {
    const existing = await Payment.findOne({ reference: application.paymentRef });
    if (existing?.status === 'completed') {
      return res.status(409).json({ success: false, message: 'The fee for this application has already been paid.' });
    }
    // An abandoned attempt should not block a second try.
    if (existing && ['pending', 'created'].includes(existing.status)) {
      return res.json({ success: true, data: { reference: existing.reference, redirectUrl: existing.pesapal?.redirectUrl, amount: existing.amount } });
    }
  }

  const offering = await Offering.findOne({ slug: application.offeringSlug });
  const amount = offering?.fee?.amount ?? 0;
  if (amount <= 0) return res.status(400).json({ success: false, message: 'There is no fee to pay for this.' });

  const payment = await createPayment({
    kind: 'application_fee',
    amount,
    description: `${offering.fee?.label ?? 'Application fee'} — ${offering.title}`.slice(0, 100),
    churchSlug: application.churchSlug,
    user: req.user,
    applicationId: application._id,
  });

  res.status(201).json({
    success: true,
    data: { reference: payment.reference, redirectUrl: payment.pesapal.redirectUrl, amount: payment.amount },
  });
});

/** Fetch the truth from the gateway and act on it. */
const refresh = async (payment) => {
  if (!payment.pesapal?.orderTrackingId) return { payment, changed: false };
  const status = await gateway.transactionStatus(payment.pesapal.orderTrackingId);
  payment.ipnEvents.push({ at: new Date(), raw: status.raw });
  return applyPaymentResult(payment, status);
};

/**
 * Pesapal's server-to-server notification. It must answer with this exact JSON
 * echo or Pesapal treats the notification as failed and keeps retrying.
 */
export const ipn = asyncHandler(async (req, res) => {
  const orderTrackingId = req.query.OrderTrackingId ?? req.body?.OrderTrackingId;
  const merchantReference = req.query.OrderMerchantReference ?? req.body?.OrderMerchantReference;
  const notificationType = req.query.OrderNotificationType ?? req.body?.OrderNotificationType;

  const reply = {
    orderNotificationType: notificationType ?? 'IPNCHANGE',
    orderTrackingId,
    orderMerchantReference: merchantReference,
    status: 200,
  };

  const payment = await Payment.findOne({
    $or: [{ 'pesapal.orderTrackingId': orderTrackingId }, { reference: merchantReference }],
  });

  if (!payment) {
    console.warn('[kingdom-network] IPN for an unknown payment:', orderTrackingId, merchantReference);
    // Still a 200: a non-200 makes Pesapal retry forever for an order we will
    // never recognise.
    return res.json({ ...reply, status: 500 });
  }

  try {
    await refresh(payment);
  } catch (err) {
    console.error('[kingdom-network] IPN handling failed:', err.message);
    return res.json({ ...reply, status: 500 });
  }

  res.json(reply);
});

/** Where the payer's browser comes back to. Redirects into the app. */
export const callback = asyncHandler(async (req, res) => {
  const orderTrackingId = req.query.OrderTrackingId;
  const merchantReference = req.query.OrderMerchantReference;

  const payment = await Payment.findOne({
    $or: [{ 'pesapal.orderTrackingId': orderTrackingId }, { reference: merchantReference }],
  });

  if (!payment) return res.redirect('/payment/not-found');

  try {
    await refresh(payment);
  } catch (err) {
    console.error('[kingdom-network] callback status check failed:', err.message);
  }

  res.redirect(await destinationFor(payment));
});

const destinationFor = async (payment) => {
  const state = payment.status === 'completed' ? 'paid' : payment.status;

  switch (payment.kind) {
    case 'application_fee':
    case 'renewal_fee': {
      // The payer is sent back to their application, which is addressed by its
      // own reference rather than the payment's.
      const application = await Application.findById(payment.applicationId, 'reference');
      return application
        ? `/applications/${application.reference}?state=${state}`
        : `/applications?state=${state}`;
    }
    case 'donation':
      return `/give/${payment.churchSlug}/thanks?ref=${payment.reference}&state=${state}`;
    default:
      return `/orders/${payment.orderRef}?state=${state}`;
  }
};

export const cancelled = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ reference: req.query.ref });
  if (payment && payment.status === 'pending') {
    payment.status = 'failed';
    payment.pesapal.statusDescription = 'Cancelled by the payer';
    await payment.save();
  }
  res.redirect(payment ? await destinationFor(payment) : '/');
});

/** A support tool: re-poll the gateway for a payment that looks stuck. */
export const refreshPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ reference: req.params.reference });
  if (!payment) return res.status(404).json({ success: false, message: 'No such payment.' });

  const isOwner = payment.userId && String(payment.userId) === String(req.user._id);
  if (!isOwner && req.user.role !== 'platform_admin') {
    return res.status(403).json({ success: false, message: 'That payment is not yours.' });
  }

  const { payment: updated } = await refresh(payment);
  res.json({ success: true, data: { reference: updated.reference, status: updated.status, amount: updated.amount } });
});

/* ── the development gateway ───────────────────────────────────────────── */

export const mockPayPage = asyncHandler(async (req, res) => {
  if (!isMock) return res.status(404).json({ success: false, message: 'Not found.' });
  const order = mock.get(req.params.orderTrackingId);
  if (!order) return res.status(404).send('Unknown mock order.');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(mock.payPage(req.params.orderTrackingId, order));
});

export const mockPay = asyncHandler(async (req, res) => {
  if (!isMock) return res.status(404).json({ success: false, message: 'Not found.' });

  const { orderTrackingId } = req.params;
  const order = mock.setOutcome(orderTrackingId, Number(req.body?.outcome ?? 1));
  if (!order) return res.status(404).send('Unknown mock order.');

  // Call our own IPN exactly as Pesapal would, so the same code path runs.
  await fetch(
    `${env.publicBaseUrl}/api/payments/ipn?OrderTrackingId=${encodeURIComponent(orderTrackingId)}` +
      `&OrderMerchantReference=${encodeURIComponent(order.reference)}&OrderNotificationType=IPNCHANGE`,
  ).catch((err) => console.error('[kingdom-network] mock IPN call failed:', err.message));

  res.redirect(`${env.publicBaseUrl}/api/payments/callback?OrderTrackingId=${encodeURIComponent(orderTrackingId)}`);
});

