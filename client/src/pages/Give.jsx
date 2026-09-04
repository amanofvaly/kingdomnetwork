import { useState } from 'react';
import { ArrowRight, BadgeCheck, Check, Lock } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ErrorState, ChurchMark, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { money } from '../lib/format.js';
import { useToast } from '../lib/toast.jsx';
import { useApi } from '../lib/useAsync.js';

const FALLBACK_COVER = '/media/church-registration-cross.jpg';

/**
 * Giving to a church.
 *
 * No account, and as little asked for as the payment actually needs: an amount
 * and one way to send a receipt. Everything else a giver might want to add —
 * their name, a message, whether to be listed — is real, but it is not the
 * price of giving, so it sits behind one optional disclosure rather than in the
 * way. A long form in front of someone reaching for their wallet loses gifts.
 *
 * Laid out on the same split as church registration: the church's own cover
 * carries the left, the decision sits on cream to the right.
 */
export const Give = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const { fail } = useToast();
  const { data, error, loading, reload } = useApi(`/give/${slug}`);

  const [amount, setAmount] = useState(null);
  const [custom, setCustom] = useState('');
  const [causeId, setCauseId] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', country: '', message: '' });
  const [anonymous, setAnonymous] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ownEmail, setOwnEmail] = useState(false);

  if (loading) return <div className="wrap band"><Spinner label="Loading" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { church } = data;
  const value = amount ?? (Number(custom) || 0);

  const belowMinimum = value > 0 && value < data.minAmount;
  const reachable = Boolean(form.email || form.phone || user?.email);
  const ready = value >= data.minAmount && reachable && !busy;

  const give = async () => {
    setBusy(true);
    try {
      const intent = await api.post(`/give/${slug}`, {
        amount: value,
        causeId: chosen || undefined,
        anonymous,
        consentToDisplay: consent && !anonymous,
        name: form.name || user?.name,
        email: form.email || user?.email,
        phone: form.phone,
        country: form.country || user?.country,
        message: form.message,
      });
      window.location.href = intent.redirectUrl;
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  const place = [church.city, church.country].filter(Boolean).join(', ');

  // A church may name at most four funds (MAX_CAUSES, server side), and the row
  // holds four cards. So "where it is needed most" takes a card only when there
  // is one spare — never at the cost of hiding a fund the church asked for.
  const funds = data.causes.slice(0, 4);
  const showGeneral = funds.length < 4;
  const chosen = causeId || (showGeneral ? '' : funds[0]?.id ?? '');

  return (
    <div className="give">
      <section className="give-art">
        {/* Every church resolves to an image: its own cover, or the platform's.
            A church without one used to fall through to a bare gradient. */}
        <img
          src={church.coverImage || FALLBACK_COVER}
          alt=""
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_COVER; }}
        />
        <div className="give-art-shade" />

        {/* The page's only way out, and the only mark on it. */}
        <Link to="/" className="brand give-brand">
          <img className="brand-mark" src="/brand-mark-white.png" alt="" width="26" height="32" />
          <span className="brand-name">Kingdom Network</span>
        </Link>

        <div className="give-art-copy">
          <Link to={`/churches/${slug}`} className="give-mark" aria-label={church.name}>
            <ChurchMark church={church} />
          </Link>

          {/* The church is named once, here. */}
          <h1>{data.headline ?? `Give to ${church.shortName ?? church.name}`}</h1>

          <p className="give-meta">
            {place ? <span>{place}</span> : null}
            {church.verified ? (
              <span className="give-verified">
                <BadgeCheck size={14} strokeWidth={2.2} /> Verified church
              </span>
            ) : null}
          </p>

          {data.blurb ? <p className="give-blurb">{data.blurb}</p> : null}
        </div>
      </section>

      <form className="give-form" onSubmit={(e) => { e.preventDefault(); if (ready) give(); }}>
        <div className="give-form-inner">
          <h2>Make a donation</h2>

          {data.causes.length ? (
            <section className="give-section">
              <span className="give-label">Where it goes</span>
              <div className="give-funds">
                {showGeneral ? (
                  <button
                    type="button"
                    className={`give-fund ${!chosen ? 'is-on' : ''}`}
                    aria-pressed={!chosen}
                    onClick={() => setCauseId('')}
                  >
                    <b>Where it is needed most</b>
                    <span className="give-fund-note">The church decides</span>
                  </button>
                ) : null}

                {funds.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`give-fund ${chosen === c.id ? 'is-on' : ''}`}
                    aria-pressed={chosen === c.id}
                    onClick={() => setCauseId(c.id)}
                  >
                    <b>{c.title}</b>
                    {c.goalAmount ? (
                      <>
                        <span className="progress">
                          <span style={{ width: `${Math.min(100, ((c.raisedAmount ?? 0) / c.goalAmount) * 100)}%` }} />
                        </span>
                        <span className="give-fund-note">
                          {Math.round(((c.raisedAmount ?? 0) / c.goalAmount) * 100)}% of {money(c.goalAmount)}
                        </span>
                      </>
                    ) : (
                      <span className="give-fund-note">{c.blurb ?? ''}</span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="give-section">
            <span className="give-label give-label-amount">Amount</span>
            <div className="give-amounts">
              {(data.suggestedAmounts ?? []).map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`give-amount ${amount === a ? 'is-on' : ''}`}
                  aria-pressed={amount === a}
                  onClick={() => { setAmount(a); setCustom(''); }}
                >
                  {money(a)}
                </button>
              ))}
            </div>

            {data.allowCustom ? (
              <div className={`give-custom ${custom ? 'is-on' : ''}`}>
                <span className="give-currency" aria-hidden="true">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={data.minAmount}
                  step="0.01"
                  placeholder="Another amount"
                  aria-label="Another amount"
                  value={custom}
                  onChange={(e) => { setCustom(e.target.value); setAmount(null); }}
                />
              </div>
            ) : null}

            {belowMinimum ? (
              <p className="err" style={{ marginTop: 'var(--s-3)' }}>
                The smallest gift is {money(data.minAmount)}.
              </p>
            ) : null}
          </section>

          {/* The only thing needed beyond the amount: somewhere to send the
              receipt. Everything else is optional and folded away below. */}
          {/* Signed in, the receipt address is already known — showing an empty
              box with the address greyed out as a placeholder reads as another
              question to answer. It is stated, with a way to change it. */}
          <section className="give-section">
            {user?.email && !ownEmail ? (
              <p className="give-receipt">
                <span>Receipt goes to <b>{user.email}</b></span>
                <button type="button" onClick={() => setOwnEmail(true)}>Use another</button>
              </p>
            ) : (
              <div className="field">
                <label htmlFor="give-email">Email for your receipt</label>
                <input
                  id="give-email" className="input" type="email" autoComplete="email"
                  value={form.email} autoFocus={ownEmail}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            )}
          </section>

          <details className="give-more">
            <summary>
              Add your name or a message <span>optional</span>
            </summary>

            <div className="give-more-body">
              <div className="give-fields">
                {!anonymous ? (
                  <>
                    <div className="field">
                      <label htmlFor="give-name">Your name</label>
                      <input
                        id="give-name" className="input" autoComplete="name"
                        value={form.name} placeholder={user?.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="give-country">Country</label>
                      <input
                        id="give-country" className="input" autoComplete="country-name"
                        value={form.country} placeholder={user?.country}
                        onChange={(e) => setForm({ ...form, country: e.target.value })}
                      />
                    </div>
                  </>
                ) : null}

                <div className="field field-wide">
                  <label htmlFor="give-phone">Phone</label>
                  <input
                    id="give-phone" className="input" autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  <span className="hint">Only if you would rather not leave an email.</span>
                </div>

                <div className="field field-wide">
                  <label htmlFor="give-message">Message to the church</label>
                  <textarea
                    id="give-message" className="textarea" rows={3}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                  />
                </div>
              </div>

              <div className="stack stack-3" style={{ marginTop: 'var(--s-4)' }}>
                {data.allowAnonymous ? (
                  <label className="give-check">
                    <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
                    <span>Give anonymously</span>
                    <small>Your name is not shared with the church.</small>
                  </label>
                ) : null}

                {!anonymous ? (
                  <label className="give-check">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>You may show my name on this page</span>
                    <small>Your name only. The amount is never shown.</small>
                  </label>
                ) : null}
              </div>
            </div>
          </details>

          <section className="give-close">
            {/* Sticky: the button stays reachable however far down the form
                someone has scrolled, so the gift is never more than one tap
                away. */}
            <div className="give-cta">
              <button type="submit" className="give-submit" disabled={!ready}>
                <span>{busy ? 'One moment…' : value ? `Give ${money(value)}` : 'Choose an amount'}</span>
                {busy ? <span className="spinner" /> : <ArrowRight size={19} />}
              </button>

              <p className="give-trust">
                <Lock size={12} strokeWidth={1.8} />
                Kingdom Network never sees your card or wallet details.
              </p>
            </div>

            <p className="give-fineprint">{data.disclosure}</p>
          </section>
        </div>
      </form>
    </div>
  );
};

export const GiveThanks = () => {
  const [params] = useSearchParams();
  const { slug } = useParams();
  const { data, loading } = useApi(`/give-thanks?ref=${params.get('ref') ?? ''}`);

  if (loading) return <div className="wrap band"><Spinner /></div>;

  const failed = data?.status !== 'completed';

  return (
    <div className="give-thanks">
      <div className="give-thanks-inner">
        {failed ? (
          <>
            <h1>That gift did not go through.</h1>
            <p className="lede">Nothing has been taken. You are welcome to try again.</p>
            <Link className="btn btn-primary btn-lg" to={`/give/${slug}`}>Try again</Link>
          </>
        ) : (
          <>
            <span className="pill pill-good"><Check size={13} strokeWidth={2.4} /> Received</span>
            <h1>Thank you.</h1>
            <p className="lede">
              Your gift of {money(data.amount)}{data.cause ? ` toward ${data.cause}` : ''} has reached{' '}
              {data.church?.name}. A receipt is on its way to you.
            </p>
            {data.message ? <p className="lede">{data.message}</p> : null}
            <span className="give-ref">{data.reference}</span>
            <p className="give-fineprint">{data.disclosure}</p>
            <Link className="btn btn-outline" to={`/churches/${slug}`}>
              Back to {data.church?.shortName ?? 'the church'}
            </Link>
          </>
        )}
      </div>
    </div>
  );
};
