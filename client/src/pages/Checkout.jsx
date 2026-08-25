import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Landmark, Lock, Smartphone, Users, Wallet } from 'lucide-react';

import { ErrorState, Spinner } from '../components/ui.jsx';
import { api, ApiError, setToken } from '../lib/api.js';
import { useApi } from '../lib/useAsync.js';
import { useAuth } from '../lib/auth.jsx';
import { useCart } from '../lib/cart.jsx';
import { money, plural } from '../lib/format.js';

const ICONS = { smartphone: Smartphone, 'credit-card': CreditCard, wallet: Wallet, landmark: Landmark };

export const Checkout = () => {
  const { items, clear } = useCart();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const { data: methods, error: methodsError } = useApi('/payment-methods');
  const [priced, setPriced] = useState(null);
  const [method, setMethod] = useState(null);
  const [account, setAccount] = useState('');
  const [extras, setExtras] = useState({});
  const [details, setDetails] = useState({ name: '', email: '', phone: '', country: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  useEffect(() => {
    if (user) setDetails((d) => ({ ...d, name: d.name || user.name, email: d.email || user.email, phone: d.phone || user.phone || '', country: d.country || user.country || '' }));
  }, [user]);

  useEffect(() => {
    if (items.length) api.post('/cart/price', { items }).then(setPriced).catch(() => setPriced(null));
  }, [items]);

  useEffect(() => { if (methods && !method) setMethod(methods[0]); }, [methods, method]);

  const selected = useMemo(() => methods?.find((m) => m.id === method?.id) ?? null, [methods, method]);

  if (!items.length) {
    return (
      <div className="wrap band stack stack-4" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)' }}>There is nothing to pay for</h1>
        <Link to="/ordination" className="btn btn-primary">Browse the marketplace</Link>
      </div>
    );
  }
  if (methodsError) return <div className="wrap band"><ErrorState error={methodsError} /></div>;
  if (!methods || !priced) return <div className="wrap band"><Spinner label="Preparing checkout" /></div>;

  const validate = () => {
    const next = {};
    if (!details.name.trim()) next.name = 'Enter the name that goes on your documents.';
    if (!/^\S+@\S+\.\S+$/.test(details.email)) next.email = 'Enter a valid email address.';
    if (!details.phone.trim()) next.phone = 'Enter a phone number so the church can reach you.';
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
    setBusy(true);
    try {
      // No account yet? One is created behind the purchase.
      if (!user) {
        const acct = await api.post('/auth/guest', details);
        setToken(acct.token);
        setUser(acct.user);
      }
      await new Promise((r) => setTimeout(r, 1100));
      const { order } = await api.post('/orders', {
        items,
        payment: { method: selected.id, account },
        billing: details,
      });
      clear();
      navigate(`/orders/${order.reference}`, { replace: true });
    } catch (err) {
      setFailure(err instanceof ApiError ? err.message : 'The payment could not be completed.');
      setBusy(false);
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
            <div>
              <h3>Your details</h3>
              <p className="small muted" style={{ margin: '4px 0 0' }}>
                Your full name is printed on every document a church issues to you, so check the spelling.
                {!user && ' We create your account from this — there is no password to set.'}
              </p>
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="cname">Full name</label>
                <input id="cname" className="input" value={details.name} aria-invalid={!!errors.name}
                  onChange={(e) => setDetails({ ...details, name: e.target.value })} autoComplete="name" />
                {errors.name && <span className="err">{errors.name}</span>}
              </div>
              <div className="field">
                <label htmlFor="cphone">Phone number</label>
                <input id="cphone" className="input" value={details.phone} aria-invalid={!!errors.phone}
                  onChange={(e) => setDetails({ ...details, phone: e.target.value })} autoComplete="tel" inputMode="tel" />
                {errors.phone && <span className="err">{errors.phone}</span>}
              </div>
              <div className="field">
                <label htmlFor="cemail">Email</label>
                <input id="cemail" className="input" type="email" value={details.email} aria-invalid={!!errors.email}
                  onChange={(e) => setDetails({ ...details, email: e.target.value })} autoComplete="email" />
                {errors.email && <span className="err">{errors.email}</span>}
              </div>
              <div className="field">
                <label htmlFor="ccountry">Country</label>
                <input id="ccountry" className="input" value={details.country}
                  onChange={(e) => setDetails({ ...details, country: e.target.value })} autoComplete="country-name" />
              </div>
            </div>
            {!user && (
              <p className="xs dim" style={{ margin: 0 }}>
                Already have an account? <Link to="/login" state={{ from: '/checkout' }} className="link xs">Sign in</Link>.
              </p>
            )}
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
                    aria-invalid={!!errors.account} onChange={(e) => setAccount(e.target.value)} autoComplete="off" />
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
                    Payments run against a simulator while gateway credentials are set up. No money moves, and only
                    the last four characters of what you enter are kept on the order.
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
            <div className="total-row"><span>Subtotal</span><span className="num">{money(priced.subtotal + priced.saving)}</span></div>
            {priced.saving > 0 && (
              <div className="total-row" style={{ color: 'var(--red-600)' }}>
                <span>Launch discount</span><span className="num">−{money(priced.saving)}</span>
              </div>
            )}
            <div className="total-row grand"><span>Total</span><span className="num">{money(priced.total)}</span></div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? <><span className="spinner" /> Processing…</> : <>Pay {money(priced.total)}</>}
          </button>
          <div className="notice" style={{ padding: 'var(--s-3)' }}>
            <Users size={15} />
            <span className="xs">Ministers in 14 countries were issued credentials through Kingdom Network this week.</span>
          </div>
        </aside>
      </form>
    </div>
  );
};
