import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, ShoppingBag, Trash2 } from 'lucide-react';

import { Empty, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useCart } from '../lib/cart.jsx';
import { money, plural } from '../lib/format.js';

export const Cart = () => {
  const { items, remove, add, has } = useCart();
  const navigate = useNavigate();
  const [priced, setPriced] = useState(null);
  const [also, setAlso] = useState([]);
  const [loading, setLoading] = useState(items.length > 0);

  useEffect(() => {
    if (!items.length) { setPriced(null); setAlso([]); setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.post('/cart/price', { items }),
      api.post('/cart/cross-sell', { items }).catch(() => []),
    ])
      .then(([p, x]) => { setPriced(p); setAlso(x); })
      .catch(() => setPriced(null))
      .finally(() => setLoading(false));
  }, [items]);

  if (!items.length) {
    return (
      <div className="wrap band">
        <Empty icon={ShoppingBag} title="Your basket is empty"
          action={<Link to="/ordination" className="btn btn-primary">Browse the marketplace</Link>}>
          Add a credential, a licence or an invitation and it shows up here.
        </Empty>
      </div>
    );
  }

  const path = (i) => (i.kind === 'offering' ? `/listing/${i.slug}` : `/courses/${i.slug}`);

  return (
    <div className="wrap band-tight stack stack-6">
      <h1 style={{ fontSize: 'var(--text-3xl)' }}>Basket</h1>

      {loading ? <Spinner /> : (
        <div className="two-col">
          <div className="stack stack-6">
            <div>
              <span className="small muted num">{plural(priced?.items.length ?? 0, 'item')}</span>
              <div style={{ marginTop: 'var(--s-4)' }}>
                {(priced?.items ?? []).map((item) => (
                  <div key={`${item.kind}-${item.slug}`} className="line-item">
                    <Link to={path(item)} className="media media-3x2">
                      <img src={item.image} alt="" loading="lazy" />
                    </Link>
                    <div className="stack stack-2">
                      <span className="xs dim">{item.kind === 'course' ? 'Course' : item.outcome?.replace('-', ' ')}</span>
                      <h4><Link to={path(item)}>{item.title}</Link></h4>
                      <span className="small muted">{item.churchName}</span>
                      <button type="button" className="link small" style={{ color: 'var(--red-600)', alignSelf: 'flex-start' }}
                        onClick={() => remove(item.kind, item.slug)}>
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                    <div className="li-price row" style={{ gap: 8, alignItems: 'baseline' }}>
                      <span className="price-big">{money(item.price)}</span>
                      {item.compareAtPrice > item.price && <span className="price-was">{money(item.compareAtPrice)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {also.length > 0 && (
              <section className="stack stack-4">
                <div>
                  <h3>Often bought with this</h3>
                  <p className="small muted" style={{ margin: '4px 0 0' }}>
                    Ministers who buy what is in your basket usually add one of these.
                  </p>
                </div>
                <div className="stack stack-3">
                  {also.map((o) => (
                    <div key={o.slug} className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--s-4)', padding: 'var(--s-3)' }}>
                      <Link to={`/listing/${o.slug}`} className="media" style={{ width: 84, aspectRatio: '3/2', flex: 'none' }}>
                        <img src={o.coverImage} alt="" loading="lazy" />
                      </Link>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <Link to={`/listing/${o.slug}`} className="small strong clamp-1" style={{ display: 'block' }}>{o.title}</Link>
                        <span className="xs dim">{o.church?.shortName ?? o.churchSlug}{o.letter?.destinationCity ? ` · ${o.letter.destinationCity}` : ''}</span>
                      </div>
                      <span className="price-big" style={{ flex: 'none' }}>{money(o.price)}</span>
                      <button type="button" className="btn btn-outline btn-sm" style={{ flex: 'none' }}
                        disabled={has('offering', o.slug)}
                        onClick={() => add({ kind: 'offering', slug: o.slug })}>
                        <Plus size={14} /> {has('offering', o.slug) ? 'Added' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
                {also.length > 1 && (
                  <button type="button" className="btn btn-outline" style={{ alignSelf: 'flex-start' }}
                    onClick={() => also.forEach((o) => add({ kind: 'offering', slug: o.slug }))}>
                    Add all {money(also.reduce((n, o) => n + o.price, 0))}
                  </button>
                )}
              </section>
            )}
          </div>

          <aside className="summary panel stack stack-4">
            <h4>Order summary</h4>
            <div className="stack stack-3">
              <div className="total-row"><span>Subtotal</span><span className="num">{money(priced?.subtotal ?? 0)}</span></div>
              {priced?.saving > 0 && (
                <div className="total-row" style={{ color: 'var(--red-600)' }}>
                  <span>Launch discount</span><span className="num">−{money(priced.saving)}</span>
                </div>
              )}
              <div className="total-row grand"><span>Total</span><span className="num">{money(priced?.total ?? 0)}</span></div>
            </div>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => navigate('/checkout')}>
              Checkout <ArrowRight size={16} />
            </button>
            <p className="xs dim" style={{ margin: 0 }}>
              You will not be charged yet. Pay with M-Pesa, Airtel Money, MTN MoMo or card.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
};
