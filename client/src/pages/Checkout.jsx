import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Landmark, Lock, Smartphone, Wallet } from 'lucide-react';

import { ErrorState, Spinner } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { useApi } from '../lib/useAsync.js';
import { useAuth } from '../lib/auth.jsx';
import { useCart } from '../lib/cart.jsx';
import { money, plural } from '../lib/format.js';

const ICONS = { smartphone: Smartphone, 'credit-card': CreditCard, wallet: Wallet, landmark: Landmark };

export const Checkout = () => {
  const { items, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: methods, error: methodsError } = useApi('/payment-methods');
  const [priced, setPriced] = useState(null);
  const [method, setMethod] = useState(null);
  const [account, setAccount] = useState('');
  const [extras, setExtras] = useState({});
  const [billing, setBilling] = useState({ name: '', email: '', country: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState(null);

  useEffect(() => {
    if (user) setBilling((b) => ({ ...b, name: b.name || user.name, email: b.email || user.email, country: b.country || user.country || '' }));
  }, [user]);

  useEffect(() => {
    if (!items.length) return;
    api.post('/cart/price', { items }).then(setPriced).catch(() => setPriced(null));
  }, [items]);

  useEffect(() => {
    if (methods && !method) setMethod(methods[0]);
  }, [methods, method]);

  const selected = useMemo(() => methods?.find((m) => m.id === method?.id) ?? null, [methods, method]);

  if (!items.length) {
    return (
      <div className="wrap band stack stack-4" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)' }}>There is nothing to pay for</h1>
        <Link to="/courses" className="btn btn-primary">Browse courses</Link>
      </div>
    );
  }
  if (methodsError) return <div className="wrap band"><ErrorState error={methodsError} /></div>;
  if (!methods || !priced) return <div className="wrap band"><Spinner label="Preparing checkout" /></div>;

  const validate = () => {
    const next = {};
    if (!billing.name.trim()) next.name = 'Enter the name on the account.';
    if (!/^\S+@\S+\.\S+$/.test(billing.email)) next.email = 'Enter a valid email address.';
    if (!account.trim()) next.account = `Enter your ${selected.fieldLabel.toLowerCase()}.`;
    else if (selected.pattern && !new RegExp(selected.pattern).test(account.replace(/\s+/g, selected.id === 'card' ? ' ' : ''))) {
      next.account = selected.patternHint;
    }
    for (const f of selected.extraFields ?? []) {
      const v = extras[f.name] ?? '';
      if (!v.trim()) next[f.name] = `Enter the ${f.label.toLowerCase()}.`;
      else if (f.pattern && !new RegExp(f.pattern).test(v)) next[f.name] = f.hint;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setFailure(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Stand-in for the gateway round trip until real credentials are wired up.
      await new Promise((r) => setTimeout(r, 1200));
      const order = await api.post('/orders', {
        items,
        payment: { method: selected.id, account },
        billing,
      });
      clear();
      navigate(`/orders/${order.reference}`, { replace: true });
    } catch (err) {
      setFailure(err instanceof ApiError ? err.message : 'The payment could not be completed.');
      setSubmitting(false);
    }
  };

  return (
    <div className="wrap band-tight stack stack-6">
      <div className="stack stack-2">
        <h1 style={{ fontSize: 'var(--text-3xl)' }}>Checkout</h1>
        <p className="muted" style={{ margin: 0 }}>{plural(priced.items.length, 'item')} · {money(priced.total)}</p>
      </div>

      <form className="two-col" onSubmit={submit} noValidate>
        <div className="stack stack-6">
          <section className="stack stack-4">
            <h3>Your details</h3>
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="bname">Full name</label>
                <input id="bname" className="input" value={billing.name} aria-invalid={!!errors.name}
                  onChange={(e) => setBilling({ ...billing, name: e.target.value })} autoComplete="name" />
                {errors.name && <span className="err">{errors.name}</span>}
              </div>
              <div className="field">
                <label htmlFor="bemail">Email</label>
                <input id="bemail" className="input" type="email" value={billing.email} aria-invalid={!!errors.email}
                  onChange={(e) => setBilling({ ...billing, email: e.target.value })} autoComplete="email" />
                {errors.email && <span className="err">{errors.email}</span>}
              </div>
              <div className="field">
                <label htmlFor="bcountry">Country</label>
                <input id="bcountry" className="input" value={billing.country}
                  onChange={(e) => setBilling({ ...billing, country: e.target.value })} autoComplete="country-name" />
              </div>
              <div className="field">
                <label htmlFor="bphone">Phone <span className="dim">(optional)</span></label>
                <input id="bphone" className="input" value={billing.phone}
                  onChange={(e) => setBilling({ ...billing, phone: e.target.value })} autoComplete="tel" />
              </div>
            </div>
          </section>

          <section className="stack stack-4">
            <h3>How would you like to pay?</h3>
            <div className="pay-grid" role="radiogroup" aria-label="Payment method">
              {methods.map((m) => {
                const Icon = ICONS[m.icon] ?? Wallet;
                const on = selected?.id === m.id;
                return (
                  <button key={m.id} type="button" role="radio" aria-checked={on}
                    className={`radio-card ${on ? 'is-on' : ''}`}
                    onClick={() => { setMethod(m); setAccount(''); setExtras({}); setErrors({}); }}>
                    <span className="radio-dot" aria-hidden="true" />
                    <span className="grow stack stack-1">
                      <span className="row" style={{ gap: 8 }}>
                        <Icon size={17} strokeWidth={1.7} />
                        <span className="strong small">{m.label}</span>
                      </span>
                      <span className="xs dim">{m.regions.join(' · ')}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="panel panel-warm stack stack-4">
                <p className="small muted" style={{ margin: 0 }}>{selected.blurb}</p>
                <div className="field">
                  <label htmlFor="account">{selected.fieldLabel}</label>
                  <input id="account" className="input" value={account} placeholder={selected.placeholder}
                    aria-invalid={!!errors.account} onChange={(e) => setAccount(e.target.value)}
                    inputMode={selected.id === 'card' ? 'numeric' : undefined} autoComplete="off" />
                  {errors.account ? <span className="err">{errors.account}</span> : <span className="hint">{selected.patternHint}</span>}
                </div>
                {selected.extraFields?.length > 0 && (
                  <div className="grid grid-2">
                    {selected.extraFields.map((f) => (
                      <div key={f.name} className="field">
                        <label htmlFor={f.name}>{f.label}</label>
                        <input id={f.name} className="input" placeholder={f.placeholder} value={extras[f.name] ?? ''}
                          aria-invalid={!!errors[f.name]} onChange={(e) => setExtras({ ...extras, [f.name]: e.target.value })} autoComplete="off" />
                        {errors[f.name] && <span className="err">{errors[f.name]}</span>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="notice">
                  <Lock size={15} />
                  <span>
                    Payments run against a built-in simulator while gateway credentials are being set up.
                    No money moves and no card or wallet details are stored — only the last four characters
                    are kept on the order record.
                  </span>
                </div>
              </div>
            )}
          </section>

          {failure && <div className="notice notice-red"><span>{failure}</span></div>}
        </div>

        <aside className="summary panel stack stack-4">
          <h4>Order summary</h4>
          <div className="stack stack-3">
            {priced.items.map((i) => (
              <div key={`${i.kind}-${i.slug}`} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <span className="media" style={{ width: 52, aspectRatio: '3/2', flex: 'none' }}>
                  <img src={i.image} alt="" loading="lazy" />
                </span>
                <span className="grow">
                  <span className="small clamp-2" style={{ display: 'block', lineHeight: 1.35 }}>{i.title}</span>
                  <span className="xs dim">{i.churchName}</span>
                </span>
                <span className="small num strong">{money(i.price)}</span>
              </div>
            ))}
          </div>
          <div className="stack stack-3" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
            <div className="total-row"><span>Subtotal</span><span className="num">{money(priced.subtotal)}</span></div>
            <div className="total-row"><span>Taxes</span><span className="num">{money(0)}</span></div>
            <div className="total-row grand"><span>Total</span><span className="num">{money(priced.total)}</span></div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
            {submitting ? <><span className="spinner" /> Processing…</> : <>Pay {money(priced.total)}</>}
          </button>
          <p className="xs dim" style={{ margin: 0 }}>
            Access opens immediately after payment and stays open for life.
          </p>
        </aside>
      </form>
    </div>
  );
};
