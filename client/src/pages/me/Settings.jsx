import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Check, KeyRound, LogOut, ShieldAlert } from 'lucide-react';

import { AreaHero, Section, SectionHead } from '../../components/me/kit.jsx';
import { api } from '../../lib/api.js';
import { dateLong } from '../../lib/format.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';

/**
 * Sign-in and what you are told about.
 *
 * Both halves of this page speak to an endpoint that already accepted them.
 * The password change and every notification preference were implemented on
 * the server and had no control anywhere in the client.
 */

const PREFS = [
  ['applicationUpdates', 'Application updates', 'A church asks you for something, marks your paper, or reaches a decision.'],
  ['interviewReminders', 'Interview reminders', 'Before an interview you have booked.'],
  ['courseProgress', 'Course progress', 'Occasional nudges about coursework you have started but not finished.'],
  ['marketing', 'News from Kingdom Network', 'New churches, new credentials, and what the platform is doing. Off by default.'],
];

const Toggle = ({ on, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={() => onChange(!on)}
    style={{
      flex: 'none', width: 46, height: 27, padding: 3,
      borderRadius: 'var(--r-full)',
      background: on ? 'var(--green-700)' : 'var(--line-strong)',
      transition: 'background-color var(--dur-1)',
    }}
  >
    <span
      style={{
        display: 'block', width: 21, height: 21, borderRadius: '50%', background: '#fff',
        transform: on ? 'translateX(19px)' : 'none',
        transition: 'transform var(--dur-1) var(--ease-soft)',
      }}
    />
  </button>
);

export const MeSettings = () => {
  const { user, setUser, logout } = useAuth();
  const { ok, fail } = useToast();

  const [prefs, setPrefs] = useState(() => ({
    applicationUpdates: user.notificationPrefs?.applicationUpdates ?? true,
    interviewReminders: user.notificationPrefs?.interviewReminders ?? true,
    courseProgress: user.notificationPrefs?.courseProgress ?? true,
    marketing: user.notificationPrefs?.marketing ?? false,
  }));
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', password: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwDone, setPwDone] = useState(false);

  const savePrefs = async () => {
    setPrefsBusy(true);
    try {
      const updated = await api.patch('/auth/me', { notificationPrefs: prefs });
      setUser(updated);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2600);
      ok('Preferences saved.');
    } catch (err) {
      fail(err);
    } finally {
      setPrefsBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pw.password.length < 8) return setPwError('Use a password of at least 8 characters.');
    if (pw.password !== pw.confirm) return setPwError('Those two passwords do not match.');

    setPwBusy(true);
    try {
      const updated = await api.patch('/auth/me', {
        currentPassword: pw.currentPassword,
        password: pw.password,
      });
      setUser(updated);
      setPw({ currentPassword: '', password: '', confirm: '' });
      setPwDone(true);
      setTimeout(() => setPwDone(false), 3000);
      ok('Password changed.');
    } catch (err) {
      // The server distinguishes a wrong current password from everything
      // else, and that distinction is the useful part.
      setPwError(err?.message ?? 'That did not work.');
    } finally {
      setPwBusy(false);
    }
    return undefined;
  };

  return (
    <>
      <AreaHero
        art="/media/scenes/open-notebook.webp"
        artAlt="An open notebook on a desk"
        kicker="Settings"
        title="Sign-in and alerts."
        lede="How you get into your account, and what this network is allowed to tell you about."
      />

      <div className="me-wrap me-body">
        <Section tone="settings">
          <SectionHead title="Your account" />
          <div className="me-card">
            <div className="me-card-in">
              <div className="me-switch">
                <div className="me-switch-copy">
                  <b>{user.email}</b>
                  <span>
                    {user.emailVerified
                      ? 'This address is confirmed.'
                      : 'This address has not been confirmed yet.'}
                  </span>
                </div>
                {user.emailVerified ? (
                  <span className="tag tag-green"><BadgeCheck size={12} /> Confirmed</span>
                ) : (
                  <span className="tag tag-gold">Unconfirmed</span>
                )}
              </div>
              <div className="me-switch">
                <div className="me-switch-copy">
                  <b>Personal account</b>
                  <span>
                    A church is registered separately and signs in separately — an account is one or the
                    other, never both. <Link className="link" to="/church/register">Register a church</Link>
                  </span>
                </div>
              </div>
              <div className="me-switch">
                <div className="me-switch-copy">
                  <b>Member since</b>
                  <span>{dateLong(user.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section tone="settings">
          <SectionHead title="Password" lede="Changing it requires the one you use now." />
          <div className="me-card">
            <form className="me-card-in" onSubmit={savePassword}>
              {pwError ? (
                <div className="notice notice-red">
                  <ShieldAlert size={15} />
                  <span>{pwError}</span>
                </div>
              ) : null}

              {user.hasPassword ? (
                <label className="field">
                  <span>Current password</span>
                  <input
                    className="input"
                    type="password"
                    autoComplete="current-password"
                    value={pw.currentPassword}
                    onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
                    required
                  />
                </label>
              ) : (
                <div className="notice notice-gold">
                  <KeyRound size={15} />
                  <span>Your account has no password yet. Set one and you can sign in with it from anywhere.</span>
                </div>
              )}

              <div className="me-pair">
                <label className="field">
                  <span>New password</span>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    minLength="8"
                    value={pw.password}
                    onChange={(e) => setPw((p) => ({ ...p, password: e.target.value }))}
                    required
                  />
                  <small className="xs dim">At least 8 characters.</small>
                </label>
                <label className="field">
                  <span>Confirm new password</span>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={pw.confirm}
                    onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                    required
                  />
                </label>
              </div>

              <div>
                <button className="btn btn-primary" disabled={pwBusy}>
                  {pwDone ? <><Check size={16} /> Changed</> : <><KeyRound size={16} /> {pwBusy ? 'Changing…' : 'Change password'}</>}
                </button>
              </div>
            </form>
          </div>
        </Section>

        <Section tone="settings">
          <SectionHead title="What we tell you about" lede="These control email. Everything still appears in your inbox here." />
          <div className="me-card">
            <div className="me-card-in">
              {PREFS.map(([key, label, help]) => (
                <div key={key} className="me-switch">
                  <div className="me-switch-copy">
                    <b>{label}</b>
                    <span>{help}</span>
                  </div>
                  <Toggle
                    on={prefs[key]}
                    label={label}
                    onChange={(next) => setPrefs((p) => ({ ...p, [key]: next }))}
                  />
                </div>
              ))}
              <div>
                <button type="button" className="btn btn-primary" onClick={savePrefs} disabled={prefsBusy}>
                  {prefsSaved ? <><Check size={16} /> Saved</> : prefsBusy ? 'Saving…' : 'Save preferences'}
                </button>
              </div>
            </div>
          </div>
        </Section>

        <Section tone="settings">
          <div className="me-card">
            <div className="me-card-in">
              <div className="row-between" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                <div className="me-switch-copy">
                  <b>Sign out</b>
                  <span>You will need your password to get back in.</span>
                </div>
                <button type="button" className="btn btn-outline" onClick={logout}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
};
