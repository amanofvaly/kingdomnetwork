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
<title>Payment — Kingdom Network</title>
<style>
  :root { color-scheme: light }
  *,*::before,*::after { box-sizing: border-box }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:24px;
         background:
           radial-gradient(120% 80% at 12% 0%, rgba(63,47,158,.55) 0%, rgba(63,47,158,0) 60%),
           radial-gradient(110% 90% at 92% 100%, rgba(184,120,0,.42) 0%, rgba(184,120,0,0) 58%),
           linear-gradient(158deg, #0b2856 0%, #24204a 100%);
         font:15px/1.6 'Geist Variable',system-ui,-apple-system,'Segoe UI',sans-serif; color:#211e3b }

  .card { position:relative; width:100%; max-width:420px; background:#fff; border-radius:16px; overflow:hidden;
          box-shadow:0 30px 70px rgba(11,40,86,.45) }

  .top { position:relative; isolation:isolate; overflow:hidden; padding:26px 28px 22px; color:#fff;
         background:linear-gradient(152deg,#0b2856 0%,#2f4fc8 100%) }
  /* The ring, as everywhere else on this platform. */
  .top::before { content:''; position:absolute; z-index:-1; right:-30%; bottom:-58%; width:72%; aspect-ratio:1;
                 border-radius:50%; border:26px solid rgba(255,204,98,.36); transform:rotate(-12deg) }
  .kicker { font-size:10px; font-weight:760; letter-spacing:.15em; text-transform:uppercase; color:#ffe1a3 }
  .top h1 { margin:6px 0 0; font-size:23px; line-height:1.1; letter-spacing:-.035em; font-weight:700 }
  .who { margin:4px 0 0; font-size:13px; color:rgba(255,255,255,.72) }

  .amount { display:flex; align-items:baseline; justify-content:space-between; gap:16px;
            padding:20px 28px; border-bottom:1px solid #e6e1f0 }
  .amount span { font-size:13px; font-weight:500; color:#57546c }
  .amount b { font-size:32px; font-weight:700; letter-spacing:-.04em; font-variant-numeric:tabular-nums }

  .body { padding:22px 28px 26px }
  .note { display:flex; gap:10px; padding:12px 14px; border-radius:8px; background:#fff4d6; border:1px solid #ffe1a3;
          font-size:12.5px; line-height:1.55; color:#865900; margin:0 0 18px }
  .note b { display:block; font-weight:650 }
  .note code { font-family:'Geist Mono Variable',ui-monospace,monospace; font-size:11.5px;
               background:rgba(134,89,0,.1); padding:1px 5px; border-radius:4px }

  form { display:grid; gap:9px }
  button { font:inherit; font-weight:600; font-size:15px; padding:14px 22px; border-radius:8px;
           border:1px solid transparent; cursor:pointer; transition:background .18s, transform .18s 
}
  .ok { background:#073fbd; color:#fff }
  .ok:hover { background:#052c85; transform:translateY(-1px) }
  .no { background:#fff; border-color:#cec7dc; color:#57546c; font-weight:500; font-size:14px; padding:11px 22px }
  .no:hover { border-color:#bd3f59; color:#bd3f59 }
  button:focus-visible { outline:none; box-shadow:0 0 0 3px rgba(63,104,189,.35) }

  .ref { margin:16px 0 0; text-align:center; font-size:11px; color:#77738a;
         font-family:'Geist Mono Variable',ui-monospace,monospace }
</style></head><body>
<div class="card">
  <div class="top">
    <span class="kicker">Payment</span>
    <h1>${order?.description ?? 'Kingdom Network'}</h1>
    <p class="who">Kingdom Network</p>
  </div>

  <div class="amount">
    <span>Amount due</span>
    <b>${order?.currency ?? 'USD'} ${Number(order?.amount ?? 0).toFixed(2)}</b>
  </div>

  <div class="body">
    <p class="note">
      <span>
        <b>Development gateway</b>
        No Pesapal credentials are configured, so this stands in for the real checkout and no money moves.
        Set <code>PESAPAL_ENV=sandbox</code> with your demo keys to use Pesapal itself.
      </span>
    </p>

    <form method="POST" action="/api/payments/mock/${encodeURIComponent(orderTrackingId)}">
      <button class="ok" name="outcome" value="1" type="submit">Pay ${order?.currency ?? 'USD'} ${Number(order?.amount ?? 0).toFixed(2)}</button>
      <button class="no" name="outcome" value="2" type="submit">Simulate a failed payment</button>
    </form>

    <p class="ref">${order?.reference ?? ''}</p>
  </div>
</div></body></html>`;
