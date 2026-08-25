import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, IdCard, PlayCircle } from 'lucide-react';

import { ErrorState, Spinner } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { dateLong, money, plural } from '../lib/format.js';

export const OrderConfirmation = () => {
  const { reference } = useParams();
  const { data: order, error, loading, reload } = useApi(`/orders/${reference}`);

  if (loading) return <div className="wrap band"><Spinner label="Loading your order" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const first = order.items[0];

  return (
    <div className="wrap band-tight">
      <div className="wrap-narrow stack stack-6" style={{ padding: 0, margin: '0 auto' }}>
        <div className="stack stack-4" style={{ alignItems: 'center', textAlign: 'center' }}>
          <CheckCircle2 size={44} strokeWidth={1.5} color="var(--green-600)" />
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>You are enrolled.</h1>
          <p className="lede" style={{ maxWidth: '48ch' }}>
            {plural(order.items.length, 'item')} paid with {order.payment.label}. Your access is open now and
            any certificate you earn will appear in your Minister Passport.
          </p>
          <div className="row-wrap" style={{ gap: 12, justifyContent: 'center' }}>
            {first?.kind === 'course' ? (
              <Link to={`/learn/${first.slug}`} className="btn btn-primary btn-lg"><PlayCircle size={18} /> Start learning</Link>
            ) : (
              <Link to="/dashboard" className="btn btn-primary btn-lg">Go to my learning</Link>
            )}
            <Link to="/passport" className="btn btn-outline btn-lg"><IdCard size={17} /> View passport</Link>
          </div>
        </div>

        <div className="panel stack stack-5">
          <div className="row-between">
            <div>
              <h4>Order {order.reference}</h4>
              <span className="small dim">{dateLong(order.paidAt ?? order.createdAt)}</span>
            </div>
            <span className="tag tag-green">Paid</span>
          </div>

          <div>
            {order.items.map((i) => (
              <div key={`${i.kind}-${i.slug}`} className="line-item">
                <Link to={`/${i.kind === 'course' ? 'courses' : 'pathways'}/${i.slug}`} className="media media-3x2">
                  <img src={i.image} alt="" loading="lazy" />
                </Link>
                <div className="stack stack-2">
                  <span className="xs dim">{i.kind === 'pathway' ? 'Credential pathway' : 'Course'}</span>
                  <h5><Link to={`/${i.kind === 'course' ? 'courses' : 'pathways'}/${i.slug}`}>{i.title}</Link></h5>
                  <span className="small muted">{i.churchName}</span>
                  {i.kind === 'course' && (
                    <Link to={`/learn/${i.slug}`} className="link small" style={{ alignSelf: 'flex-start' }}>
                      Open course <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
                <span className="li-price num strong">{money(i.price)}</span>
              </div>
            ))}
          </div>

          <div className="stack stack-3" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
            <div className="total-row"><span>Subtotal</span><span className="num">{money(order.subtotal)}</span></div>
            <div className="total-row"><span>Paid with</span><span>{order.payment.label} {order.payment.account}</span></div>
            <div className="total-row"><span>Payment reference</span><span className="num" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{order.payment.reference}</span></div>
            <div className="total-row grand"><span>Total</span><span className="num">{money(order.total, order.currency)}</span></div>
          </div>

          {order.payment.simulated && (
            <div className="notice">
              <span>
                This payment ran through the built-in simulator. Live gateway credentials replace it without
                any change to this flow.
              </span>
            </div>
          )}
        </div>

        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to="/orders" className="link small">All orders <ArrowRight size={14} /></Link>
        </div>
      </div>
    </div>
  );
};
