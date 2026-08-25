import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react';

import { Empty, Price, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useCart } from '../lib/cart.jsx';
import { money, plural } from '../lib/format.js';

export const Cart = () => {
  const { items, remove } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [priced, setPriced] = useState(null);
  const [loading, setLoading] = useState(items.length > 0);

  useEffect(() => {
    if (!items.length) { setPriced(null); setLoading(false); return; }
    setLoading(true);
    api.post('/cart/price', { items })
      .then(setPriced)
      .catch(() => setPriced(null))
      .finally(() => setLoading(false));
  }, [items]);

  if (!items.length) {
    return (
      <div className="wrap band">
        <Empty
          icon={ShoppingBag}
          title="Your basket is empty"
          action={<Link to="/courses" className="btn btn-primary">Browse courses</Link>}
        >
          Add a course or a credential pathway and it will show up here.
        </Empty>
      </div>
    );
  }

  return (
    <div className="wrap band-tight stack stack-6">
      <h1 style={{ fontSize: 'var(--text-3xl)' }}>Basket</h1>

      {loading ? <Spinner /> : (
        <div className="two-col">
          <div>
            <span className="small muted num">{plural(priced?.items.length ?? 0, 'item')}</span>
            <div style={{ marginTop: 'var(--s-4)' }}>
              {(priced?.items ?? []).map((item) => (
                <div key={`${item.kind}-${item.slug}`} className="line-item">
                  <Link to={`/${item.kind === 'course' ? 'courses' : 'pathways'}/${item.slug}`} className="media media-3x2">
                    <img src={item.image} alt="" loading="lazy" />
                  </Link>
                  <div className="stack stack-2">
                    <span className="xs dim">{item.kind === 'pathway' ? 'Credential pathway' : 'Course'}</span>
                    <h4>
                      <Link to={`/${item.kind === 'course' ? 'courses' : 'pathways'}/${item.slug}`}>{item.title}</Link>
                    </h4>
                    <span className="small muted">{item.churchName}</span>
                    <button type="button" className="link small" style={{ color: 'var(--red-600)', alignSelf: 'flex-start' }}
                      onClick={() => remove(item.kind, item.slug)}>
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                  <div className="li-price"><Price amount={item.price} was={item.compareAtPrice} /></div>
                </div>
              ))}
            </div>
          </div>

          <aside className="summary panel stack stack-4">
            <h4>Order summary</h4>
            <div className="stack stack-3">
              <div className="total-row"><span>Subtotal</span><span className="num">{money(priced?.subtotal ?? 0)}</span></div>
              <div className="total-row"><span>Taxes</span><span className="dim">Calculated at checkout</span></div>
              <div className="total-row grand"><span>Total</span><span className="num">{money(priced?.total ?? 0)}</span></div>
            </div>
            <button type="button" className="btn btn-primary btn-lg btn-block"
              onClick={() => navigate(user ? '/checkout' : '/login', user ? undefined : { state: { from: '/checkout' } })}>
              {user ? 'Go to checkout' : 'Sign in to check out'} <ArrowRight size={16} />
            </button>
            <p className="xs dim" style={{ margin: 0 }}>
              Pay with M-Pesa, Airtel Money, MTN MoMo, card, PayPal or bank transfer.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
};
