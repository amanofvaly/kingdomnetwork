import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Avatar } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { dateLong } from '../lib/format.js';

export const Account = () => {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user.name ?? '', country: user.country ?? '', city: user.city ?? '',
    phone: user.phone ?? '', ministryRole: user.ministryRole ?? '', bio: user.bio ?? '',
  });
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setStatus(null);
    setBusy(true);
    try {
      const updated = await api.patch('/auth/me', form);
      setUser(updated);
      setStatus({ ok: true, message: 'Your details have been saved.' });
    } catch (err) {
      setStatus({ ok: false, message: err instanceof ApiError ? err.message : 'Could not save your details.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap band-tight">
      <div className="wrap-narrow stack stack-6" style={{ padding: 0, margin: '0 auto' }}>
        <div className="row" style={{ gap: 'var(--s-4)' }}>
          <Avatar src={user.avatar} name={user.name} size={56} />
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)' }}>Account</h1>
            <p className="small muted" style={{ margin: 0 }}>{user.email} · joined {dateLong(user.createdAt)}</p>
          </div>
        </div>

        <form className="panel stack stack-5" onSubmit={submit}>
          {status && <div className={`notice ${status.ok ? 'notice-green' : 'notice-red'}`}><span>{status.message}</span></div>}
          <div className="field">
            <label htmlFor="aname">Full name</label>
            <input id="aname" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <span className="hint">This is the name printed on any credential a church issues to you.</span>
          </div>
          <div className="grid grid-2" style={{ gap: 'var(--s-4)' }}>
            <div className="field">
              <label htmlFor="acountry">Country</label>
              <input id="acountry" className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="acity">City</label>
              <input id="acity" className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="aphone">Phone</label>
              <input id="aphone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="arole">Ministry role</label>
              <input id="arole" className="input" value={form.ministryRole} onChange={(e) => setForm({ ...form, ministryRole: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="abio">About you</label>
            <textarea id="abio" className="textarea" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Where you serve and what you are studying toward." />
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy}>
            {busy ? <span className="spinner" /> : 'Save changes'}
          </button>
        </form>

        <div className="panel panel-warm row-between" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
          <div>
            <h4>Your credentials</h4>
            <p className="small muted" style={{ margin: 0 }}>Certificates and titles issued to you by churches.</p>
          </div>
          <Link to="/passport" className="btn btn-outline">Open passport</Link>
        </div>
      </div>
    </div>
  );
};
