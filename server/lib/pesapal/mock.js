import { env } from '../../config/env.js';

/**
 * A stand-in gateway for development.
 *
 * Without Pesapal credentials the whole payment path would be untestable, so
 * this serves a page that looks like a redirect, lets a developer choose an
 * outcome, and then calls our own IPN exactly as Pesapal would. The point is
 * that every line of `payment.controller.js` runs the same way it will in
 * production — the only difference is who calls the IPN.
 */

const pending = new Map();

export const submitOrder = async ({ reference, amount, currency, description, callbackUrl }) => {
  const orderTrackingId = `MOCK-${reference}`;
  pending.set(orderTrackingId, { reference, amount, currency, description, callbackUrl, statusCode: 0 });

  return {
    orderTrackingId,
    merchantReference: reference,
    redirectUrl: `${env.publicBaseUrl}/api/payments/mock/${encodeURIComponent(orderTrackingId)}`,
  };
};

export const setOutcome = (orderTrackingId, statusCode) => {
  const order = pending.get(orderTrackingId);
  if (order) order.statusCode = statusCode;
  return order;
};

export const transactionStatus = async (orderTrackingId) => {
  const order = pending.get(orderTrackingId);
  const statusCode = order?.statusCode ?? 0;
  const state = { 0: 'invalid', 1: 'completed', 2: 'failed', 3: 'reversed' }[statusCode];

  return {
    statusCode,
    state,
    description: state.toUpperCase(),
    confirmationCode: statusCode === 1 ? `MOCKCONF${String(Date.now()).slice(-6)}` : undefined,
    paymentMethod: 'MockMoney',
    paymentAccount: '•••• 4242',
    amount: order?.amount,
    currency: order?.currency,
    merchantReference: order?.reference,
    raw: { mock: true, statusCode },
  };
};

export const get = (orderTrackingId) => pending.get(orderTrackingId);

export const ensureIpnRegistered = async () => 'mock-ipn-id';

export const refund = async () => ({ status: '200', message: 'Mock refund accepted' });

/** The page a developer lands on instead of Pesapal's. */
export const payPage = (orderTrackingId, order) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mock gateway — Kingdom Network</title>
<style>
  :root { color-scheme: light }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#f5f2ff;
         font:15px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif; color:#211e3b }
  .card { background:#fff; border:1px solid #e6e1f0; border-radius:10px; padding:32px; max-width:420px; width:calc(100% - 32px);
          box-shadow:0 10px 28px rgba(45,39,91,.12) }
  h1 { font-size:22px; margin:0 0 4px; letter-spacing:-.02em }
  .note { background:#fff4d6; border:1px solid #ffe1a3; border-radius:6px; padding:12px; font-size:13px; margin:0 0 20px }
  dl { display:grid; grid-template-columns:auto 1fr; gap:6px 16px; margin:0 0 24px; font-size:14px }
  dt { color:#57546c } dd { margin:0; text-align:right; font-variant-numeric:tabular-nums }
  .amount { font-size:22px; font-weight:600 }
  form { display:grid; gap:8px }
  button { font:inherit; font-weight:500; padding:12px 24px; border-radius:6px; border:1px solid transparent; cursor:pointer }
  .ok { background:#3157a4; color:#fff } .no { background:#fff; border-color:#cec7dc; color:#211e3b }
  button:focus-visible { outline:none; box-shadow:0 0 0 3px rgba(63,104,189,.3) }
</style></head><body>
<div class="card">
  <p class="note"><strong>Development gateway.</strong> Pesapal credentials are not configured, so this page stands in for the real one. No money moves.</p>
  <h1>${order?.description ?? 'Payment'}</h1>
  <dl>
    <dt>Reference</dt><dd>${order?.reference ?? ''}</dd>
    <dt>Amount</dt><dd class="amount">${order?.currency ?? 'USD'} ${Number(order?.amount ?? 0).toFixed(2)}</dd>
  </dl>
  <form method="POST" action="/api/payments/mock/${encodeURIComponent(orderTrackingId)}">
    <button class="ok" name="outcome" value="1" type="submit">Pay successfully</button>
    <button class="no" name="outcome" value="2" type="submit">Simulate a failed payment</button>
  </form>
</div></body></html>`;
