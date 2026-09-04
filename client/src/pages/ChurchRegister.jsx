import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Church, Eye, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import registrationArt from '../assets/church-registration-services.png';
import { ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const empty = {
  churchName: '',
  yourName: '',
  email: '',
  password: '',
  city: '',
  country: '',
  about: '',
};

const Field = ({ label, hint, ...props }) => (
  <label className="church-register-field">
    <span>{label}</span>
    <input {...props} />
    {hint ? <small>{hint}</small> : null}
  </label>
);

export const ChurchRegister = () => {
  const navigate = useNavigate();
  const { user, ready, logout, registerChurch } = useAuth();
  const [form, setForm] = useState(empty);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const initials = useMemo(
    () => form.churchName.trim().split(/\s+/).filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase() || 'KN',
    [form.churchName],
  );

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const session = await registerChurch(form);
      navigate(`/manage/${session.memberships[0].churchSlug}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not register your church. Please try again.');
      setBusy(false);
    }
  };

  if (!ready) return <div className="church-register-loading" aria-label="Loading" />;

  if (user) {
    return (
      <main className="church-register church-register-separate">
        <section className="church-register-separate-art">
          <img src={registrationArt} alt="A cross illuminated by vivid blue, gold and red light" />
        </section>
        <section className="church-register-separate-copy">
          <Link to="/" className="church-register-back"><ArrowLeft size={17} /> Kingdom Network</Link>
          <div>
            <h1>Church registration uses a separate account.</h1>
            <p>Your personal account stays separate. Sign out before registering a church on Kingdom Network.</p>
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={logout}>
            Sign out and continue <ArrowRight size={17} />
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={`church-register ${started ? 'is-started' : ''}`}>
      <header className="church-register-header">
        <Link to="/" className="brand">
          <img className="brand-mark" src="/brand-mark-white.png" alt="" width="26" height="32" />
          <span className="brand-name">Kingdom Network</span>
        </Link>
        <Link to="/login" className="church-register-signin">Sign in</Link>
      </header>

      <section className="church-register-intro" aria-hidden={started}>
        <img src={registrationArt} alt="A cross illuminated by vivid blue, gold and red light" />
        <div className="church-register-intro-shade" />
        <div className="church-register-intro-copy">
          <h1>
            <span>“Entrust to faithful men who will teach others also.”</span>
            <cite>2 Timothy 2:2</cite>
          </h1>
          <div className="church-register-intro-bottom">
            <p>
              Help people discover your church, understand its ministry, and stay connected
              with your community. Receive contributions and manage everything from one dashboard.
            </p>
            <button type="button" className="church-register-begin" onClick={() => setStarted(true)}>
              Get started <ArrowRight size={19} />
            </button>
          </div>
        </div>
      </section>

      <section className="church-register-workspace" aria-hidden={!started}>
        <div className="church-register-editor">
          <button type="button" className="church-register-back" onClick={() => setStarted(false)}>
            <ArrowLeft size={17} /> Back
          </button>

          <div className="church-register-heading">
            <h1>Set up your church profile.</h1>
            <p>Provide basic details and we'll create a page where people can discover your church and connect with it.</p>
          </div>

          <form onSubmit={submit} className="church-register-form">
            {error ? <div className="church-register-error" role="alert">{error}</div> : null}

            <div className="church-register-group">
              <Field label="Church name" value={form.churchName} onChange={set('churchName')} autoComplete="organization" required autoFocus />
              <div className="church-register-pair">
                <Field label="City" value={form.city} onChange={set('city')} autoComplete="address-level2" required />
                <Field label="Country" value={form.country} onChange={set('country')} autoComplete="country-name" required />
              </div>
              <label className="church-register-field">
                <span>What should people know about your church?</span>
                <textarea value={form.about} onChange={set('about')} rows="3" maxLength="420" required
                  placeholder="A warm, clear introduction to your church and its ministry." />
                <small>{form.about.length}/420 · You can refine this later.</small>
              </label>
            </div>

            <div className="church-register-access">
              <div className="church-register-access-title">
                <span>Sign-in details</span>
                <small>You will use this email and password to sign in and manage your church page.</small>
              </div>
              <Field label="Your name" value={form.yourName} onChange={set('yourName')} autoComplete="name" required />
              <Field label="Your email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
              <Field label="Password" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" minLength="8" required hint="At least 8 characters" />
            </div>

            <button className="church-register-submit" disabled={busy}>
              <span>{busy ? 'Publishing your church…' : 'Publish church page'}</span>
              {busy ? <span className="spinner" /> : <ArrowRight size={19} />}
            </button>
            <p className="church-register-promise"><Check size={15} /> Your page goes live now. Add offerings, photos and details from the dashboard.</p>
          </form>
        </div>

        <aside className="church-register-preview" aria-label="Preview of your church page">
          <div className="church-register-preview-label"><Eye size={15} /> You will be able to add more details later</div>
          <div className="church-register-page">
            <div className="church-register-page-hero">
              <img src={registrationArt} alt="" />
              <div className="church-register-page-overlay" />
              <div className="church-register-page-copy">
                <span className="church-register-monogram">{initials}</span>
                <h2>{form.churchName || 'Your church name'}</h2>
                <span className="church-register-location"><MapPin size={14} /> {[form.city, form.country].filter(Boolean).join(', ') || 'Your location'}</span>
              </div>
            </div>
            <div className="church-register-page-body">
              <div>
                <span className="church-register-page-rule" />
                <h3>Welcome</h3>
              </div>
              <p>{form.about || 'Your introduction will appear here—a clear first welcome for everyone who finds your church.'}</p>
              <div className="church-register-page-foot">
                <span><Church size={16} /> Church profile</span>
                <span>Kingdom Network</span>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
};
