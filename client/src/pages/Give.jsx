import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Heart, Lock } from 'lucide-react';

import { Checkbox, Input, Textarea } from '../components/admin/kit.jsx';
import { ErrorState, ChurchMark, Spinner, Verified } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { money } from '../lib/format.js';
import { useToast } from '../lib/toast.jsx';
import { useApi } from '../lib/useAsync.js';

/**
 * Giving to a church.
 *
 * No account is asked for — requiring one before someone can give is a barrier
 * with no purpose. What the platform keeps is stated on the form rather than
 * buried, because a giver intending money for a church should be told what
 * actually reaches it.
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

  if (loading) return <div className="wrap band"><Spinner /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { church } = data;
  const value = amount ?? (Number(custom) || 0);

  const give = async () => {
    setBusy(true);
    try {
      const intent = await api.post(`/give/${slug}`, {
        amount: value,
        causeId: causeId || undefined,
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

  const cause = data.causes.find((c) => c.id === causeId);
  const reaches = value ? value * (1 - data.commissionPercent / 100) : 0;

  return (
    <>
      <div className="band band-warm">
        <div className="wrap stack stack-3">
          <Link to={`/churches/${slug}`} className="row" style={{ gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <ChurchMark church={church} />
            <span className="stack" style={{ gap: 0 }}>
              <span className="small">{church.name} {church.verified ? <Verified /> : null}</span>
              <span className="dim xs">{[church.city, church.country].filter(Boolean).join(', ')}</span>
            </span>
          </Link>
          <h1>{data.headline ?? `Give to ${church.shortName ?? church.name}`}</h1>
          {data.blurb ? <p className="lede">{data.blurb}</p> : null}
        </div>
      </div>

      <div className="wrap band">
        <div className="detail-grid">
          <div className="stack stack-5">
            {data.causes.length ? (
              <section>
                <h2>Choose a fund</h2>
                <div className="stack stack-3">
                  <button
                    type="button"
                    className={`radio-card ${!causeId ? 'is-chosen' : ''}`}
                    onClick={() => setCauseId('')}
                    style={{ textAlign: 'left', width: '100%' }}
                  >
                    <span className="radio-dot" />
                    <span>
                      <b>General fund</b>
                      <span className="dim small" style={{ display: 'block' }}>The church decides.</span>
                    </span>
                  </button>
                  {data.causes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`radio-card ${causeId === c.id ? 'is-chosen' : ''}`}
                      onClick={() => setCauseId(c.id)}
                      style={{ textAlign: 'left', width: '100%' }}
                    >
                      <span className="radio-dot" />
                      <span style={{ flex: 1 }}>
                        <b>{c.title}</b>
                        {c.blurb ? <span className="dim small" style={{ display: 'block' }}>{c.blurb}</span> : null}
                        {c.goalAmount ? (
                          <span style={{ display: 'block', marginTop: 8 }}>
                            <span className="progress"><span style={{ width: `${Math.min(100, ((c.raisedAmount ?? 0) / c.goalAmount) * 100)}%` }} /></span>
                            <span className="dim xs">{money(c.raisedAmount ?? 0)} of {money(c.goalAmount)}</span>
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2>Amount</h2>
              <div className="row row-wrap" style={{ gap: 10 }}>
                {(data.suggestedAmounts ?? []).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`btn ${amount === a ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => { setAmount(a); setCustom(''); }}
                  >
                    {money(a)}
                  </button>
                ))}
                {data.allowCustom ? (
                  <input
                    className="input"
                    type="number"
                    min={data.minAmount}
                    placeholder="Another amount"
                    style={{ maxWidth: 180 }}
                    value={custom}
                    onChange={(e) => { setCustom(e.target.value); setAmount(null); }}
                  />
                ) : null}
              </div>
              {value > 0 && value < data.minAmount ? (
                <p className="small" style={{ color: 'var(--red-600)' }}>The smallest gift is {money(data.minAmount)}.</p>
              ) : null}
            </section>

            <section className="a-form">
              <h2>Your details</h2>
              {data.allowAnonymous ? (
                <Checkbox label="Give anonymously" help="Your name is not shared with the church." checked={anonymous} onChange={setAnonymous} />
              ) : null}
              {!anonymous ? (
                <div className="a-row">
                  <Input label="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={user?.name} />
                  <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder={user?.country} />
                </div>
              ) : null}
              <div className="a-row">
                <Input label="Email" type="email" help="Your receipt will be sent here." value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={user?.email} />
                <Input label="Phone" help="Either an email or phone number is required." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <Textarea label="Message to the church" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              {!anonymous ? (
                <Checkbox label="You may show my name on this page" help="Your name only. The amount is never shown." checked={consent} onChange={setConsent} />
              ) : null}
            </section>
          </div>

          <aside>
            <div className="buy-card">
              <h3 style={{ marginTop: 0 }}><Heart size={16} strokeWidth={1.8} style={{ verticalAlign: -2 }} /> Your gift</h3>
              <dl className="a-kv" style={{ marginBottom: 'var(--s-4)' }}>
                <dt>Toward</dt><dd>{cause?.title ?? 'General fund'}</dd>
                <dt>Amount</dt><dd className="strong">{value ? money(value) : '—'}</dd>
                <dt>Platform fee</dt><dd className="dim">{value ? `−${money(value - reaches)}` : '—'}</dd>
                <dt>Reaches the church</dt><dd className="strong">{value ? money(reaches) : '—'}</dd>
              </dl>

              <button
                type="button"
                className="btn btn-primary btn-block btn-lg"
                disabled={busy || value < data.minAmount || (!form.email && !form.phone && !user?.email)}
                onClick={give}
              >
                {busy ? 'One moment…' : value ? `Give ${money(value)}` : 'Choose an amount'}
              </button>

              <p className="dim xs" style={{ marginTop: 12 }}>
                <Lock size={12} strokeWidth={1.8} style={{ verticalAlign: -2 }} /> Handled by Pesapal. Kingdom Network
                never sees your card or wallet details.
              </p>
            </div>

            <div className="panel" style={{ marginTop: 'var(--s-4)', padding: 'var(--s-4)' }}>
              <p className="dim xs" style={{ margin: 0 }}>{data.disclosure}</p>
            </div>

            {data.recent?.length ? (
              <div className="panel" style={{ marginTop: 'var(--s-4)', padding: 'var(--s-4)' }}>
                <h4 className="eyebrow" style={{ marginTop: 0 }}>Recent donors</h4>
                <ul className="stack stack-1" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {data.recent.map((g, i) => (
                    <li key={i} className="small">{g.name}{g.country ? <span className="dim"> · {g.country}</span> : null}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
};

export const GiveThanks = () => {
  const [params] = useSearchParams();
  const { slug } = useParams();
  const { data, loading } = useApi(`/give-thanks?ref=${params.get('ref') ?? ''}`);

  if (loading) return <div className="wrap band"><Spinner /></div>;

  const failed = data?.status !== 'completed';

  return (
    <div className="wrap band">
      <div className="wrap-narrow stack stack-4" style={{ textAlign: 'center', alignItems: 'center' }}>
        {failed ? (
          <>
            <h1>That gift did not go through.</h1>
            <p className="lede">Nothing has been taken. You are welcome to try again.</p>
            <Link className="btn btn-primary" to={`/give/${slug}`}>Try again</Link>
          </>
        ) : (
          <>
            <span className="pill pill-good">Received</span>
            <h1>Thank you.</h1>
            <p className="lede">
              Your gift of {money(data.amount)}{data.cause ? ` toward ${data.cause}` : ''} has reached{' '}
              {data.church?.name}. A receipt is on its way to you.
            </p>
            {data.message ? <p className="lede">{data.message}</p> : null}
            <p className="dim small">Reference {data.reference}</p>
            <p className="dim xs" style={{ maxWidth: 520 }}>{data.disclosure}</p>
            <Link className="btn btn-outline" to={`/churches/${slug}`}>Back to {data.church?.shortName ?? 'the church'}</Link>
          </>
        )}
      </div>
    </div>
  );
};
