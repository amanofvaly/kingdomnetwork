import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../lib/auth.jsx';
import { ApiError } from '../lib/api.js';

const ART = {
  login: { src: '/media/scenes/church-sanctuary.webp', alt: 'Inside a church sanctuary ready for a gathering' },
  signup: { src: '/media/scenes/hands-open-bible.webp', alt: 'Hands opening a Bible in preparation for ministry' },
};

const Shell = ({ mode, title, lede, children, footer }) => (
  <div className="auth-split">
    <div className="auth-form">
      <div className="stack stack-5">
        <div className="stack stack-2">
          <h1 style={{ fontSize: 'var(--text-2xl)' }}>{title}</h1>
          <p className="muted" style={{ margin: 0 }}>{lede}</p>
        </div>
        {children}
        <p className="small muted" style={{ margin: 0 }}>{footer}</p>
      </div>
    </div>
    <div className="auth-art">
      <img src={ART[mode].src} alt={ART[mode].alt} />
    </div>
  </div>
);

const useAfterAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return () => navigate(location.state?.from ?? '/me', { replace: true });
};

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await login(form);
      if (session.user?.role === 'platform_admin') {
        navigate('/admin', { replace: true });
      } else if (session.user?.accountKind === 'church' && session.memberships?.[0]) {
        navigate(`/manage/${session.memberships[0].churchSlug}`, { replace: true });
      } else {
        navigate(location.state?.from ?? '/me', { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign you in.');
      setBusy(false);
    }
  };

  return (
    <Shell mode="login" title="Sign in" lede="Access your personal or church account."
      footer={<>New here? <Link to="/signup" className="link">Create an account</Link>.</>}>
      <form className="stack stack-4" onSubmit={submit} noValidate>
        {error && <div className="notice notice-red"><span>{error}</span></div>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" required
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="current-password" required
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <span className="spinner" /> : 'Sign in'}
        </button>
      </form>
    </Shell>
  );
};

export const Signup = () => {
  const { signup } = useAuth();
  const after = useAfterAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', country: '', ministryRole: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) { setError('Use a password of at least 8 characters.'); return; }
    setBusy(true);
    try {
      await signup(form);
      after();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account.');
      setBusy(false);
    }
  };

  return (
    <Shell mode="signup" title="Create your account" lede="Enrol on courses, track progress and hold your credentials in one place."
      footer={<>Already have an account? <Link to="/login" className="link">Sign in</Link>.</>}>
      <form className="stack stack-4" onSubmit={submit} noValidate>
        {error && <div className="notice notice-red"><span>{error}</span></div>}
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" className="input" autoComplete="name" required
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="semail">Email</label>
          <input id="semail" className="input" type="email" autoComplete="email" required
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="spassword">Password</label>
          <input id="spassword" className="input" type="password" autoComplete="new-password" required
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <span className="hint">At least 8 characters.</span>
        </div>
        <div className="grid grid-2" style={{ gap: 'var(--s-4)' }}>
          <div className="field">
            <label htmlFor="country">Country <span className="dim">(optional)</span></label>
            <input id="country" className="input" autoComplete="country-name"
              value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="role">Ministry role <span className="dim">(optional)</span></label>
            <input id="role" className="input" placeholder="Pastor, elder, student…"
              value={form.ministryRole} onChange={(e) => setForm({ ...form, ministryRole: e.target.value })} />
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <span className="spinner" /> : 'Create account'}
        </button>
      </form>
    </Shell>
  );
};
