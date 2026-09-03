import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Check, Clock, RefreshCw } from 'lucide-react';

import { StatusPill } from '../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { dateLong, money, plural } from '../lib/format.js';
import { useApi } from '../lib/useAsync.js';

/**
 * What happened to an order for materials.
 *
 * An order can span several churches, and each church is paid separately, so a
 * basket can be part-paid — the page says which parts cleared rather than
 * pretending the whole thing succeeded or failed.
 */
export const OrderConfirmation = () => {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const { data, error, loading, reload } = useApi(`/orders/${reference}`);

  if (loading) return <div className="wrap band"><Spinner label="Finding your order" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { order, payments, enrollments } = data;
  const paid = order.status === 'paid';
  const outstanding = (payments ?? []).filter((p) => p.status !== 'completed');
  const cancelled = params.get('state') === 'failed';

  const retry = async (p) => {
    if (p.pesapal?.redirectUrl) window.location.href = p.pesapal.redirectUrl;
    else {
      await api.post(`/payments/${p.reference}/refresh`).catch(() => {});
      reload();
    }
  };

  return (
    <div className="wrap band-tight stack stack-6">
      <div className="stack stack-3" style={{ textAlign: 'center', alignItems: 'center' }}>
        {paid ? (
          <>
            <span className="pill pill-good"><Check size={11} strokeWidth={3} /> Paid</span>
            <h1 style={{ fontSize: 'var(--text-3xl)' }}>You are enrolled.</h1>
            <p className="lede">
              {plural(enrollments?.length ?? order.items.length, 'item')} unlocked. Start whenever you like.
            </p>
          </>
        ) : cancelled ? (
          <>
            <span className="pill pill-bad">Not paid</span>
            <h1 style={{ fontSize: 'var(--text-3xl)' }}>That payment did not go through.</h1>
            <p className="lede">Nothing has been taken. You can try again below.</p>
          </>
        ) : (
          <>
            <span className="pill pill-wait"><Clock size={11} strokeWidth={2.4} /> Waiting</span>
            <h1 style={{ fontSize: 'var(--text-3xl)' }}>We are waiting for the payment.</h1>
            <p className="lede">
              Mobile money payments can take a moment to confirm.
            </p>
          </>
        )}
      </div>

      {outstanding.length > 0 && (
        <div className="panel stack stack-3">
          <h4>Still to pay</h4>
          {outstanding.map((p) => (
            <div key={p.reference} className="row row-between">
              <span className="small">{p.churchSlug} · {money(p.amount)}</span>
              <span className="row" style={{ gap: 8 }}>
                <StatusPill status={p.status} />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => retry(p)}>
                  <RefreshCw size={14} strokeWidth={1.8} /> {p.pesapal?.redirectUrl ? 'Pay now' : 'Check again'}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {enrollments?.length > 0 && (
        <section className="stack stack-4">
          <h2 style={{ fontSize: 'var(--text-2xl)' }}>Ready to start</h2>
          <div className="stack stack-3">
            {enrollments.map((e) => (
              <div key={e._id} className="panel row row-between" style={{ padding: 'var(--s-4)' }}>
                <span className="row small" style={{ gap: 10 }}>
                  <BookOpen size={16} strokeWidth={1.8} />
                  {e.courseSlug ?? e.resourceSlug}
                </span>
                {e.courseSlug ? (
                  <Link className="btn btn-primary btn-sm" to={`/learn/${e.courseSlug}`}>Start</Link>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel stack stack-3">
        <h4>Your order</h4>
        {order.items.map((i) => (
          <div key={`${i.kind}-${i.slug}`} className="total-row">
            <span>{i.title}<span className="dim small"> · {i.churchName}</span></span>
            <span>{money(i.price)}</span>
          </div>
        ))}
        <div className="total-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--s-3)' }}>
          <span className="strong">Total</span>
          <span className="strong">{money(order.total)}</span>
        </div>
        <div className="total-row"><span>Reference</span><span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{order.reference}</span></div>
        {order.paidAt ? <div className="total-row"><span>Paid</span><span>{dateLong(order.paidAt)}</span></div> : null}
        {(payments ?? []).some((p) => p.pesapal?.paymentMethod) ? (
          <div className="total-row">
            <span>Paid with</span>
            <span>{payments.map((p) => p.pesapal?.paymentMethod).filter(Boolean).join(', ')}</span>
          </div>
        ) : null}
      </section>

      <div className="row" style={{ gap: 12, justifyContent: 'center' }}>
        <Link className="btn btn-outline" to="/me/learning">My learning</Link>
        <Link className="btn btn-ghost" to="/me/library">Your library</Link>
      </div>
    </div>
  );
};
