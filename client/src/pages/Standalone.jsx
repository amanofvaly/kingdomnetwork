import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';

import { Input, Textarea } from '../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { useApi } from '../lib/useAsync.js';

/**
 * Three small pages reached by an emailed link: answering a reference request,
 * accepting an invitation to help administer a church, and setting a new
 * password.
 */

/* --- a referee answers, holding only a link ----------------------------- */

export const ReferenceForm = () => {
  const { token } = useParams();
  const { fail } = useToast();
  const { data, error, loading } = useApi(`/reference/${token}`);
  const [response, setResponse] = useState('');
  const [recommend, setRecommend] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="wrap band"><Spinner /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} /></div>;

  if (done || data.alreadyAnswered) {
    return (
      <div className="wrap band">
        <div className="wrap-narrow stack stack-3" style={{ textAlign: 'center', alignItems: 'center' }}>
          <span className="pill pill-good"><Check size={11} strokeWidth={3} /> Sent</span>
          <h1>Thank you.</h1>
          <p className="lede">Your response has been sent.</p>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/reference/${token}`, { recommend, response });
      setDone(true);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap band">
      <div className="wrap-narrow stack stack-5">
        <div className="stack stack-2">
          <span className="eyebrow">A reference request</span>
          <h1>{data.applicantName} has named you.</h1>
          <p className="lede">
            They have applied to {data.churchName} for {data.offeringTitle}
            {data.relationship ? `, and named you as their ${data.relationship}` : ''}. Your answer goes to the
            church, not to them.
          </p>
        </div>

        <div className="a-form panel" style={{ padding: 'var(--s-5)' }}>
          <div className="a-field">
            <label>Would you recommend them?</label>
            <div className="stack stack-2">
              {[
                { value: 'yes', label: 'Yes, without reservation' },
                { value: 'reservations', label: 'Yes, with reservations' },
                { value: 'no', label: 'No' },
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`radio-card ${recommend === o.value ? 'is-chosen' : ''}`}
                  onClick={() => setRecommend(o.value)}
                  style={{ textAlign: 'left', width: '100%' }}
                >
                  <span className="radio-dot" />
                  <span>{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Textarea
            label="Your comments"
            help="Only the church reads this."
            rows={6}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />

          <button type="button" className="btn btn-primary" disabled={busy || !recommend} onClick={submit}>
            {busy ? 'Sending…' : 'Send my answer'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* --- accepting an invitation ------------------------------------------- */

export const AcceptInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, ready, refresh } = useAuth();
  const { fail } = useToast();
  const [busy, setBusy] = useState(false);

  if (!ready) return <div className="wrap band"><Spinner /></div>;

  if (!user) {
    return (
      <div className="wrap band">
        <div className="wrap-narrow stack stack-4">
          <h1>Sign in to accept</h1>
          <p className="lede">Use the address the invitation was sent to.</p>
          <div className="row" style={{ gap: 12 }}>
            <Link className="btn btn-primary" to="/login" state={{ from: `/invite/${token}` }}>Sign in</Link>
            <Link className="btn btn-outline" to="/signup" state={{ from: `/invite/${token}` }}>Create an account</Link>
          </div>
        </div>
      </div>
    );
  }

  const accept = async () => {
    setBusy(true);
    try {
      const result = await api.post(`/invites/${token}/accept`);
      await refresh();
      navigate(`/manage/${result.churchSlug}`);
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  return (
    <div className="wrap band">
      <div className="wrap-narrow stack stack-4">
        <h1>Accept the invitation</h1>
        <p className="lede">You are signed in as {user.email}.</p>
        <button type="button" className="btn btn-primary" onClick={accept} disabled={busy}>
          {busy ? 'Accepting…' : 'Accept'}
        </button>
      </div>
    </div>
  );
};

/* --- password reset ----------------------------------------------------- */

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    // Answers the same way whether or not the address is known, so this never
    // reveals which addresses have accounts.
    await api.post('/auth/forgot-password', { email }).catch(() => {});
    setSent(true);
    setBusy(false);
  };

  return (
    <div className="wrap band">
      <div className="wrap-narrow stack stack-4">
        <h1>Reset your password</h1>
        {sent ? (
          <p className="lede">
            If an account uses {email}, a link is on its way. It works for one hour.
          </p>
        ) : (
          <form className="a-form" onSubmit={submit}>
            <Input label="Your email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send me a link'}</button>
          </form>
        )}
        <Link className="link" to="/login">Back to signing in</Link>
      </div>
    </div>
  );
};

export const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { adopt } = useAuth();
  const { fail } = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      adopt(await api.post('/auth/reset-password', { token: params.get('token'), password }));
      navigate('/me');
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  return (
    <div className="wrap band">
      <div className="wrap-narrow stack stack-4">
        <h1>Choose a new password</h1>
        <form className="a-form" onSubmit={submit}>
          <Input
            label="New password"
            type="password"
            minLength={8}
            help="At least eight characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          <button className="btn btn-primary" disabled={busy || password.length < 8}>
            {busy ? 'Saving…' : 'Save and sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
