import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, CalendarClock, FileCheck2, FileText, IdCard, Lock, Receipt,
  ShieldCheck, UserRoundCheck,
} from 'lucide-react';

import { ChurchMark, Spinner, Verified } from '../components/ui.jsx';
import { ApiError, api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { money } from '../lib/format.js';
import { useApi } from '../lib/useAsync.js';

/**
 * Applying to a church.
 *
 * Not a checkout, and no longer a wizard. There is one screen: who is being
 * asked, what they will ask of you, what it costs to be considered, and a
 * single button.
 *
 * Everything a church actually requires — coursework, a paper, an interview,
 * documents, referees — is worked through afterwards, from the application
 * workspace, over days or weeks. Collecting it here would frame a relationship
 * that unfolds over months as a form to finish in one sitting, which is what
 * made the old six-stage version feel so long.
 */

const ICON = { size: 13, strokeWidth: 2 };

const ASK_ICON = {
  fee: <Receipt {...ICON} />,
  course: <BookOpen {...ICON} />,
  assessment: <FileCheck2 {...ICON} />,
  interview: <CalendarClock {...ICON} />,
  credential: <IdCard {...ICON} />,
  document: <FileText {...ICON} />,
  reference: <UserRoundCheck {...ICON} />,
  attestation: <ShieldCheck {...ICON} />,
  form: <FileText {...ICON} />,
  review: <ShieldCheck {...ICON} />,
};

export const Apply = () => {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const renewalOf = params.get('renew');
  const navigate = useNavigate();
  const { user, ready, adopt, login } = useAuth();
  const listing = useApi(`/offerings/${slug}`);

  const [account, setAccount] = useState({ name: '', email: '', password: '' });
  // A signed-out visitor may be new here or simply logged out. Both belong on
  // this screen; sending either one away to /login costs the application.
  const [returning, setReturning] = useState(false);
  const [agreed, setAgreed] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!ready || listing.loading) return <div className="wrap band"><Spinner label="Loading" /></div>;
  if (listing.error || !listing.data?.offering) {
    return <div className="wrap band"><p className="lede">That listing does not exist.</p></div>;
  }

  const { offering, church, requirements, disclosures = [] } = listing.data;
  const fee = renewalOf ? offering.fee?.renewalAmount ?? 0 : offering.fee?.amount ?? 0;
  const attestations = offering.requires?.attestations ?? [];
  // The fee is what this screen is for; the rest is what comes after it.
  const asks = (requirements?.steps ?? []).filter((s) => s.type !== 'fee');

  const set = (key) => (e) => setAccount((a) => ({ ...a, [key]: e.target.value }));
  const allAgreed = attestations.every((a) => a.required === false || agreed.includes(a.key));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // An application has to belong to somebody, so a signed-out applicant
      // signs in or is given an account here rather than being sent away.
      if (!user) {
        if (returning) {
          await login({ email: account.email.trim(), password: account.password });
        } else {
          adopt(await api.post('/auth/guest', {
            name: account.name.trim(),
            email: account.email.trim(),
            password: account.password,
          }));
        }
      }

      const application = await api.post('/applications', { offeringSlug: slug, ...(renewalOf ? { renewalOf } : {}) });

      if (!['draft', 'fee_pending'].includes(application.status)) { navigate(`/applications/${application.reference}`); return; }
      if (attestations.length) {
        await api.patch(`/applications/${application.reference}`, { attestations: agreed });
      }

      const result = await api.post(`/applications/${application.reference}/submit`);

      if (result.requiresPayment) {
        const intent = await api.post(`/applications/${application.reference}/pay`);
        window.location.href = intent.redirectUrl;
        return;
      }
      navigate(`/applications/${application.reference}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not start your application. Please try again.');
      setBusy(false);
    }
  };

  return (
    <main className="ap-apply">
      <section className="aw-face">
        {offering.coverImage ? <img className="aw-face-art" src={offering.coverImage} alt="" /> : null}

        <Link to={`/listing/${slug}`} className="aw-back"><ArrowLeft size={15} /> Back to the listing</Link>

        <div className="aw-church">
          <ChurchMark church={church} />
          <span className="aw-church-name">
            {church?.name}
            {church?.verified ? <Verified label="" size={13} /> : null}
            <span className="aw-church-where">{[church?.city, church?.country].filter(Boolean).join(', ')}</span>
          </span>
        </div>

        <div>
          <span className="aw-kicker">{renewalOf ? 'Applying to renew' : 'Applying for'}</span>
          <h1 className="aw-title">{offering.award?.title ?? offering.title}</h1>
        </div>

        {asks.length ? (
          <div className="aw-asks">
            <span className="aw-asks-head">What {church?.shortName ?? 'this church'} will ask of you</span>
            {asks.map((s) => (
              <span key={s.key} className="aw-ask">
                <span>{ASK_ICON[s.type] ?? <ShieldCheck {...ICON} />}</span>
                <span>{s.course?.title ?? s.offering?.title ?? s.label}</span>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <form className="aw-form" onSubmit={submit}>
        <div className="aw-form-in">
          {renewalOf ? <p className="notice">The church reviews each renewal. Your existing credential stays on record. {offering.renewal?.continuingEducationHours > 0 ? `You will need evidence of ${offering.renewal.continuingEducationHours} hours of continuing education.` : ''}</p> : null}
          {!renewalOf && listing.data.availability?.open === false ? <p className="notice notice-gold">{listing.data.availability.message}</p> : null}
          {fee > 0 ? (
            <div className="aw-fee">
              <div className="aw-fee-row">
                <span>{renewalOf ? 'Renewal application fee' : offering.fee?.label ?? 'Application fee'}</span>
                <span className="aw-fee-amount">{money(fee, offering.fee?.currency)}</span>
              </div>
              <p>
                Buys their assessment, not the credential.
                {offering.fee?.refundable === false ? ' Non-refundable once review begins.' : ''}
              </p>
            </div>
          ) : (
            <div className="aw-free">No fee. Your application goes directly to the church.</div>
          )}

          {!user ? (
            <div className="aw-group">
              <div className="aw-group-head">
                <b>{returning ? 'Sign in to apply' : 'Your details'}</b>

              </div>
              {returning ? null : (
                <label className="aw-field">
                  <span>Your name</span>
                  <input value={account.name} onChange={set('name')} autoComplete="name" required />
                </label>
              )}
              <div className="aw-pair">
                <label className="aw-field">
                  <span>Email</span>
                  <input type="email" value={account.email} onChange={set('email')} autoComplete="email" required />
                </label>
                <label className="aw-field">
                  <span>Password</span>
                  <input type="password" value={account.password} onChange={set('password')}
                    autoComplete={returning ? 'current-password' : 'new-password'}
                    minLength={returning ? undefined : 8} required />
                  {returning ? null : <small>At least 8 characters</small>}
                </label>
              </div>
              <button type="button" className="aw-switch" onClick={() => { setReturning((v) => !v); setError(''); }}>
                {returning ? 'New here? Create an account instead' : 'Already have an account? Sign in'}
              </button>
            </div>
          ) : null}

          {attestations.length ? (
            <div className="aw-group">
              <div className="aw-group-head"><b>Before you apply</b></div>
              {attestations.map((a) => (
                <label key={a.key} className="aw-attest">
                  <input
                    type="checkbox"
                    checked={agreed.includes(a.key)}
                    onChange={(e) => setAgreed(e.target.checked
                      ? [...agreed, a.key]
                      : agreed.filter((k) => k !== a.key))}
                  />
                  <span>{a.statement}</span>
                </label>
              ))}
            </div>
          ) : null}

          {error ? <div className="aw-error" role="alert">{error}</div> : null}

          <button className="aw-go" disabled={busy || !allAgreed || (!renewalOf && listing.data.availability?.open === false)}>
            {busy ? 'One moment…' : fee > 0 ? `Pay ${money(fee, offering.fee?.currency)} and apply` : 'Send my application'}
            {busy ? null : <ArrowRight size={17} strokeWidth={2.2} />}
          </button>

          {fee > 0 ? (
            <p className="aw-secure">
              <Lock size={13} strokeWidth={1.9} /> Handled by Pesapal. Kingdom Network never sees your card details.
            </p>
          ) : null}

          {disclosures.length ? (
            <details className="aw-fine">
              <summary>What you should know</summary>
              {disclosures.map((d, i) => <p key={i}>{d}</p>)}
            </details>
          ) : null}
        </div>
      </form>
    </main>
  );
};
