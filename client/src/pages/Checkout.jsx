import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

import { Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useCart } from '../lib/cart.jsx';
import { money } from '../lib/format.js';

/**
 * Paying for materials — coursework and books.
 *
 * Credentials do not come through here; applying to a church for standing has
 * its own flow. The payment itself happens at Pesapal, so this page collects
 * only what the gateway needs and then hands the browser over.
 */
export const Checkout = () => {
  const { items, clear } = useCart();
  const { user, adopt } = useAuth();
  const navigate = useNavigate();

  const [priced, setPriced] = useState(null);
  const [details, setDetails] = useState({ name: '', email: '', password: '', country: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  useEffect(() => {
    if (user) {
      setDetails((d) => ({
        ...d,
        name: d.name || user.name,
        email: d.email || user.email,
        country: d.country || user.country || '',
        phone: d.phone || user.phone || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    if (items.length) api.post('/cart/price', { items }).then(setPriced).catch(() => setPriced(null));
  }, [items]);

  const needsPassword = !user || user.hasPassword === false;

  if (!items.length) {
    return (
      <div className="wrap band stack stack-4" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)' }}>There is nothing to pay for</h1>
        <Link to="/courses" className="btn btn-primary">Browse the coursework</Link>
      </div>
    );
  }
  if (!priced) return <div className="wrap band"><Spinner label="Preparing checkout" /></div>;

  const validate = () => {
    const next = {};
    if (!details.name.trim()) next.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(details.email)) next.email = 'Enter a valid email address.';
    if (needsPassword && details.password.length < 8) next.password = 'Use at least 8 characters.';
    if (!details.email && !details.phone) next.phone = 'Leave an email address or a phone number.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setFailure(null);
    if (!validate()) return;

    setBusy(true);
    try {
      // An account has to exist before an order can belong to anyone.
      if (!user) {
        adopt(await api.post('/auth/guest', {
          name: details.name.trim(),
          email: details.email.trim(),
          password: details.password,
          country: details.country.trim(),
        }));
      } else if (user.hasPassword === false) {
        await api.patch('/auth/me', { password: details.password });
      }

      const result = await api.post('/orders', {
        items,
        billing: { name: details.name.trim(), email: details.email.trim(), country: details.country.trim(), phone: details.phone.trim() },
      });

      clear();

      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      navigate(`/orders/${result.order.reference}`);
    } catch (err) {
      setFailure(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="wrap band-tight stack stack-6" onSubmit={submit}>
      <h1 style={{ fontSize: 'var(--text-3xl)' }}>Checkout</h1>

      <div className="two-col">
        <div className="stack stack-6">
          {failure ? <div className="notice notice-red">{failure}</div> : null}

          <section className="stack stack-4">
            <h2 style={{ fontSize: 'var(--text-xl)' }}>Your details</h2>

            {user ? (
              <div className="panel row row-between" style={{ padding: 'var(--s-4)' }}>
                <span className="small">Signed in as <b>{user.email}</b></span>
              </div>
            ) : null}

            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input id="name" className="input" value={details.name} aria-invalid={!!errors.name}
                  onChange={(e) => setDetails({ ...details, name: e.target.value })} autoComplete="name" />
                {errors.name && <span className="err">{errors.name}</span>}
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" className="input" type="email" value={details.email} aria-invalid={!!errors.email}
                  onChange={(e) => setDetails({ ...details, email: e.target.value })} autoComplete="email" readOnly={Boolean(user)} />
                {errors.email && <span className="err">{errors.email}</span>}
              </div>
              <div className="field">
                <label htmlFor="country">Country</label>
                <input id="country" className="input" value={details.country}
                  onChange={(e) => setDetails({ ...details, country: e.target.value })} autoComplete="country-name" />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" className="input" value={details.phone} aria-invalid={!!errors.phone}
                  onChange={(e) => setDetails({ ...details, phone: e.target.value })} autoComplete="tel" />
                {errors.phone ? <span className="err">{errors.phone}</span> : <span className="hint">Used by the payment provider to reach you.</span>}
              </div>
              {needsPassword ? (
                <div className="field">
                  <label htmlFor="password">{user ? 'Set a password' : 'Choose a password'}</label>
                  <input id="password" className="input" type="password" value={details.password} aria-invalid={!!errors.password}
                    onChange={(e) => setDetails({ ...details, password: e.target.value })} autoComplete="new-password" />
                  {errors.password ? <span className="err">{errors.password}</span> : <span className="hint">At least 8 characters.</span>}
                </div>
              ) : null}
            </div>
          </section>

          <section className="stack stack-4">
            <h2 style={{ fontSize: 'var(--text-xl)' }}>How you pay</h2>
            <div className="panel panel-warm stack stack-3">
              <p className="small" style={{ margin: 0 }}>
                Payment is handled by <b>Pesapal</b>. When you continue you are taken there to choose how to
                pay — M-Pesa, Airtel Money, MTN MoMo, a card, or a bank transfer — and returned here afterwards.
              </p>
              <p className="xs dim row" style={{ margin: 0, gap: 6 }}>
                <Lock size={13} strokeWidth={1.8} /> Kingdom Network never sees your card or wallet details.
              </p>
            </div>
          </section>
        </div>

        <aside>
          <div className="summary">
            <h3>Your order</h3>
            <ul className="stack stack-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {priced.items.map((i) => (
                <li key={`${i.kind}-${i.slug}`} className="row row-between small">
                  <span className="clamp-1" style={{ minWidth: 0 }}>{i.title}</span>
                  <b className="num">{money(i.price)}</b>
                </li>
              ))}
            </ul>
            <div className="row row-between" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
              <span className="strong">Total</span>
              <span className="price-big">{money(priced.total)}</span>
            </div>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? 'One moment…' : `Continue to pay ${money(priced.total)}`}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
};
