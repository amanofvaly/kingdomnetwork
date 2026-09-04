import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Info, Save } from 'lucide-react';

import { Section, SectionHead } from '../../components/me/kit.jsx';
import { Avatar } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';

/**
 * Who this person is, as a church reading their application would want it.
 *
 * PATCH /auth/me has always accepted every field on this page. The old
 * account form offered six of them and quietly dropped the rest, which meant
 * the biographical detail a church most wants — how long someone has served,
 * where, under whom — could be stored but never entered.
 */

const Field = ({ label, hint, as = 'input', ...props }) => {
  const Tag = as;
  return (
    <label className="field">
      <span>{label}</span>
      <Tag className={as === 'textarea' ? 'textarea' : 'input'} {...props} />
      {hint ? <small className="xs dim">{hint}</small> : null}
    </label>
  );
};

export const MeProfile = () => {
  const { user, setUser } = useAuth();
  const { ok, fail } = useToast();

  const [form, setForm] = useState({
    name: user.name ?? '',
    ministryRole: user.ministryRole ?? '',
    bio: user.bio ?? '',
    city: user.city ?? '',
    country: user.country ?? '',
    phone: user.phone ?? '',
    timezone: user.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
    ministry: {
      yearsInMinistry: user.ministry?.yearsInMinistry ?? '',
      currentRole: user.ministry?.currentRole ?? '',
      congregation: user.ministry?.congregation ?? '',
      denomination: user.ministry?.denomination ?? '',
      priorCredentials: (user.ministry?.priorCredentials ?? []).join('\n'),
    },
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setMinistry = (key) => (e) => setForm((f) => ({ ...f, ministry: { ...f.ministry, [key]: e.target.value } }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const years = String(form.ministry.yearsInMinistry).trim();
      const updated = await api.patch('/auth/me', {
        name: form.name,
        ministryRole: form.ministryRole,
        bio: form.bio,
        city: form.city,
        country: form.country,
        phone: form.phone,
        timezone: form.timezone,
        ministry: {
          yearsInMinistry: years === '' ? undefined : Number(years),
          currentRole: form.ministry.currentRole,
          congregation: form.ministry.congregation,
          denomination: form.ministry.denomination,
          priorCredentials: form.ministry.priorCredentials
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        },
      });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2600);
      ok('Profile saved.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>

      <div className="me-wrap me-body">
        <form onSubmit={submit} className="me-split">
          <div className="stack stack-5">
            <Section tone="profile">
              <SectionHead title="About you" />
              <div className="me-card">
                <div className="me-card-in">
                  <div className="row" style={{ gap: 'var(--s-4)' }}>
                    <Avatar src={user.avatar} name={user.name} size={56} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="strong">{user.email}</div>
                      <div className="xs dim">
                        {user.emailVerified ? 'Email confirmed' : 'Email not yet confirmed'}
                        {' · '}Signed up {new Date(user.createdAt).getFullYear()}
                      </div>
                    </div>
                  </div>

                  <Field label="Full name" value={form.name} onChange={set('name')} autoComplete="name" required />
                  <Field
                    label="Ministry role"
                    value={form.ministryRole}
                    onChange={set('ministryRole')}
                    placeholder="Pastor, evangelist, church planter…"
                    hint="Shown under your name throughout your area."
                  />
                  <Field
                    as="textarea"
                    label="About you"
                    rows="4"
                    maxLength="900"
                    value={form.bio}
                    onChange={set('bio')}
                    placeholder="A short account of your ministry and what you are seeking."
                    hint={`${form.bio.length}/900`}
                  />
                </div>
              </div>
            </Section>

            <Section tone="profile">
              <SectionHead
                title="Ministry"
                lede="Optional. Churches read this when they consider your application."
              />
              <div className="me-card">
                <div className="me-card-in">
                  <div className="me-pair">
                    <Field
                      label="Years in ministry"
                      type="number"
                      min="0"
                      max="80"
                      value={form.ministry.yearsInMinistry}
                      onChange={setMinistry('yearsInMinistry')}
                    />
                    <Field label="Current role" value={form.ministry.currentRole} onChange={setMinistry('currentRole')}
                      placeholder="Associate pastor" />
                  </div>
                  <div className="me-pair">
                    <Field label="Congregation" value={form.ministry.congregation} onChange={setMinistry('congregation')}
                      placeholder="Where you serve now" />
                    <Field label="Denomination" value={form.ministry.denomination} onChange={setMinistry('denomination')} />
                  </div>
                  <Field
                    as="textarea"
                    label="Credentials you already hold"
                    rows="3"
                    value={form.ministry.priorCredentials}
                    onChange={setMinistry('priorCredentials')}
                    placeholder={'One per line\nOrdained — Grace Chapel, 2019'}
                    hint="One per line. These are your own record, separate from anything issued on this network."
                  />
                </div>
              </div>
            </Section>

            <Section tone="profile">
              <SectionHead title="Location" lede="Used for interview times and to find churches near you." />
              <div className="me-card">
                <div className="me-card-in">
                  <div className="me-pair">
                    <Field label="City" value={form.city} onChange={set('city')} autoComplete="address-level2" />
                    <Field label="Country" value={form.country} onChange={set('country')} autoComplete="country-name" />
                  </div>
                  <div className="me-pair">
                    <Field label="Phone" value={form.phone} onChange={set('phone')} autoComplete="tel" />
                    <Field
                      label="Time zone"
                      value={form.timezone}
                      onChange={set('timezone')}
                      hint="Interview times are shown in this zone."
                    />
                  </div>
                </div>
              </div>
            </Section>
          </div>

          <aside className="me-split-aside">
            <div className="me-card">
              <div className="me-card-in">
                <div className="me-card-head">
                  <h3>Save changes</h3>
                  <p>Not published. Only a church you apply to can read this.</p>
                </div>
                <button className="btn btn-primary btn-block" disabled={busy}>
                  {saved ? <><Check size={16} /> Saved</> : <><Save size={16} /> {busy ? 'Saving…' : 'Save profile'}</>}
                </button>
              </div>
            </div>

            <div className="notice">
              <Info size={15} />
              <span>
                Your credentials are issued in the name on this profile. Change it before you apply, not after.
              </span>
            </div>

            <div className="me-card">
              <div className="me-card-in">
                <div className="me-card-head">
                  <h3>Settings</h3>
                  <p>Password, email and notifications.</p>
                </div>
                <Link to="/me/settings" className="btn btn-outline btn-block">
                  Open settings <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </>
  );
};
