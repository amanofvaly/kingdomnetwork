import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag } from 'lucide-react';

import { Empty, ErrorState, Spinner } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { dateLong, money, plural } from '../lib/format.js';

export const Orders = () => {
  const { data, error, loading, reload } = useApi('/orders');

  if (loading) return <div className="wrap band"><Spinner /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  return (
    <div className="wrap band-tight stack stack-5">
      <h1 style={{ fontSize: 'var(--text-3xl)' }}>Orders</h1>
      {data.length === 0 ? (
        <Empty icon={ShoppingBag} title="No orders yet" action={<Link to="/courses" className="btn btn-primary">Browse courses</Link>}>
          Anything you enrol on will show up here with its receipt.
        </Empty>
      ) : (
        <div className="stack stack-4">
          {data.map((o) => (
            <Link key={o.reference} to={`/orders/${o.reference}`} className="panel row-between" style={{ gap: 'var(--s-4)' }}>
              <div className="row" style={{ gap: 'var(--s-4)' }}>
                <div className="row" style={{ gap: 6 }}>
                  {o.items.slice(0, 3).map((i) => (
                    <span key={i.slug} className="media" style={{ width: 54, aspectRatio: '3/2', flex: 'none' }}>
                      <img src={i.image} alt="" loading="lazy" />
                    </span>
                  ))}
                </div>
                <div className="stack" style={{ gap: 2 }}>
                  <span className="strong small">{o.reference}</span>
                  <span className="xs dim">{dateLong(o.paidAt ?? o.createdAt)} · {plural(o.items.length, 'item')} · {o.payment.label}</span>
                </div>
              </div>
              <div className="row" style={{ gap: 'var(--s-4)' }}>
                <span className="tag tag-green">{o.status}</span>
                <span className="num strong">{money(o.total, o.currency)}</span>
                <ArrowRight size={16} color="var(--ink-3)" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
