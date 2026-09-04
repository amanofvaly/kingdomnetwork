import { env } from '../../config/env.js';
import { PlatformSettings } from '../../models/PlatformSettings.js';

/**
 * Pesapal API 3.0.
 *
 * Two things about this API shape everything else:
 *
 *  1. The access token lasts five minutes. It is cached in memory and refreshed
 *     early; it is never persisted, because a stored token is almost always an
 *     expired one.
 *  2. Neither the browser callback nor the IPN carries the payment status. Both
 *     only tell you which order changed. The status must always be fetched with
 *     GetTransactionStatus — which is why `payment.controller.js` funnels both
 *     into one idempotent handler.
 */

const base = env.pesapal.baseUrl;

let cached = { token: null, expiresAt: 0 };

const request = async (path, { method = 'POST', body, token, query, tolerate = [] } = {}) => {
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

  const res = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await res.json().catch(() => null);

  // Pesapal answers 200 with an `error` object rather than an error status, so
  // the body has to be inspected even on success. Some of those `errors` are
  // not failures at all — see `tolerate`, which names the codes the caller
  // would rather read than be thrown.
  const code = payload?.error?.code;
  if (!res.ok || (code && !tolerate.includes(code))) {
    const detail = payload?.error?.message ?? payload?.message ?? `HTTP ${res.status}`;
    throw Object.assign(new Error(`Pesapal: ${detail}`), { status: 502, pesapal: payload });
  }

  return payload;
};

export const accessToken = async () => {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token;

  const payload = await request('/api/Auth/RequestToken', {
    body: { consumer_key: env.pesapal.consumerKey, consumer_secret: env.pesapal.consumerSecret },
  });

  if (!payload?.token) throw new Error('Pesapal did not return an access token.');

  // Valid for five minutes; refreshed at four so a request in flight cannot
  // expire mid-call.
  cached = { token: payload.token, expiresAt: Date.now() + 4 * 60 * 1000 };
  return cached.token;
};

/**
 * Register the URL Pesapal calls when a transaction changes, and remember the
 * id it gives back — every order has to quote it. Registering the same URL
 * twice is harmless, so this is safe to call on every boot, but the stored id
 * means it normally does nothing.
 */
export const ensureIpnRegistered = async () => {
  const settings = await PlatformSettings.load();
  const url = `${env.publicBaseUrl}/api/payments/ipn`;

  if (settings.pesapal?.ipnId && settings.pesapal?.ipnUrl === url) {
    return settings.pesapal.ipnId;
  }

  const payload = await request('/api/URLSetup/RegisterIPN', {
    token: await accessToken(),
    body: { url, ipn_notification_type: 'GET' },
  });

  settings.pesapal = { ipnId: payload.ipn_id, ipnUrl: url, registeredAt: new Date() };
  await settings.save();

  console.log(`[kingdom-network] Pesapal IPN registered: ${payload.ipn_id} → ${url}`);
  return payload.ipn_id;
};

/** Pesapal accepts a limited character set, and truncates nothing for you. */
const cleanReference = (ref) => String(ref).replace(/[^A-Za-z0-9\-_.:]/g, '-').slice(0, 50);
const cleanDescription = (text) => String(text ?? 'Kingdom Network').replace(/\s+/g, ' ').trim().slice(0, 100);

export const submitOrder = async ({ reference, amount, currency = 'USD', description, payer, callbackUrl, cancellationUrl }) => {
  const notificationId = await ensureIpnRegistered();

  const payload = await request('/api/Transactions/SubmitOrderRequest', {
    token: await accessToken(),
    body: {
      id: cleanReference(reference),
      currency,
      amount: Number(amount),
      description: cleanDescription(description),
      callback_url: callbackUrl,
      cancellation_url: cancellationUrl,
      notification_id: notificationId,
      billing_address: {
        email_address: payer?.email || undefined,
        phone_number: payer?.phone || undefined,
        first_name: payer?.firstName || undefined,
        last_name: payer?.lastName || undefined,
        country_code: payer?.countryCode || undefined,
      },
    },
  });

  return {
    orderTrackingId: payload.order_tracking_id,
    merchantReference: payload.merchant_reference,
    redirectUrl: payload.redirect_url,
  };
};

/** 0 INVALID · 1 COMPLETED · 2 FAILED · 3 REVERSED */
export const STATUS_CODES = { 0: 'invalid', 1: 'completed', 2: 'failed', 3: 'reversed' };

export const transactionStatus = async (orderTrackingId) => {
  const payload = await request('/api/Transactions/GetTransactionStatus', {
    method: 'GET',
    token: await accessToken(),
    query: { orderTrackingId },
    // An order nobody has paid yet answers with `payment_details_not_found`
    // alongside a perfectly good status_code of 0 — which is the normal state of
    // every order between submission and payment, not a failure. Throwing on it
    // meant the browser callback threw for every payer who had not finished, and
    // the IPN answered Pesapal with 500 and earned itself an endless retry.
    // A genuinely bad id is a different code, and still throws.
    tolerate: ['payment_details_not_found'],
  });

  return {
    statusCode: payload.status_code,
    state: STATUS_CODES[payload.status_code] ?? 'unknown',
    description: payload.payment_status_description,
    confirmationCode: payload.confirmation_code,
    paymentMethod: payload.payment_method,
    paymentAccount: payload.payment_account,
    amount: payload.amount,
    currency: payload.currency,
    merchantReference: payload.merchant_reference,
    raw: payload,
  };
};

export const refund = async ({ confirmationCode, amount, username, remarks }) =>
  request('/api/Transactions/RefundRequest', {
    token: await accessToken(),
    body: { confirmation_code: confirmationCode, amount: String(amount), username, remarks },
  });

/** Only for tests — the module-level cache would otherwise leak between them. */
export const resetTokenCache = () => {
  cached = { token: null, expiresAt: 0 };
};
