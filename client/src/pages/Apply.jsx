import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, FileText, Lock, ShieldCheck } from 'lucide-react';

import { Checkbox, FileDrop, Input, Textarea } from '../components/admin/kit.jsx';
import { Monogram, Spinner, Verified } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { money } from '../lib/format.js';
import { useToast } from '../lib/toast.jsx';
import { useApi } from '../lib/useAsync.js';

/**
 * Applying to a church.
 *
 * Not a checkout. There is no basket, no cross-sell, no discount and no
 * "buy now" anywhere on this page — because none of those things are honest
 * about what is happening. Someone is asking a church to recognise them, and
 * the fee is what the church charges to consider it.
 */

const STAGES = ['requirements', 'about', 'agree', 'documents', 'references', 'pay'];

export const Apply = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const { fail } = useToast();

  const listing = useApi(`/offerings/${slug}`);
  const [application, setApplication] = useState(null);
  const [stage, setStage] = useState('requirements');
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState({});
  const [agreed, setAgreed] = useState([]);
  const [referees, setReferees] = useState([]);

  const offering = listing.data?.offering;
  const church = listing.data?.church;

  useEffect(() => {
    if (!offering || !user || application) return;
    api.post('/applications', { offeringSlug: slug })
      .then((created) => {
        setApplication(created);
        setAnswers(created.answers ?? {});
        setAgreed((created.attestations ?? []).filter((a) => a.agreedAt).map((a) => a.key));
        setReferees((created.references ?? []).map((r) => ({ key: r.key, name: r.name ?? '', email: r.email ?? '', relationship: r.relationship ?? '' })));
      })
      .catch(fail);
  }, [offering, user, slug, application, fail]);

  if (!ready || listing.loading) return <div className="wrap band"><Spinner /></div>;
  if (listing.error || !offering) return <div className="wrap band"><p className="lede">That listing does not exist.</p></div>;

  if (!user) {
    return (
      <div className="wrap band">
        <div className="wrap-narrow stack stack-4">
          <span className="eyebrow">Applying to {church?.name}</span>
          <h1>You need an account first.</h1>
          <p className="lede">
            Applications are linked to your account.
          </p>
          <div className="row" style={{ gap: 12 }}>
            <Link className="btn btn-primary" to="/signup" state={{ from: `/apply/${slug}` }}>Create an account</Link>
            <Link className="btn btn-outline" to="/login" state={{ from: `/apply/${slug}` }}>Sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!application) return <div className="wrap band"><Spinner /></div>;

  const form = offering.applicationForm ?? [];
  const attestations = offering.requires?.attestations ?? [];
  const documents = application.documents ?? [];
  const references = offering.requires?.references ?? [];
  const fee = offering.fee?.amount ?? 0;

  const stages = STAGES.filter((s) =>
    s === 'requirements' || s === 'pay'
    || (s === 'about' && form.length)
    || (s === 'agree' && attestations.length)
    || (s === 'documents' && documents.length)
    || (s === 'references' && references.length));

  const at = stages.indexOf(stage);

  const persist = async (extra = {}) => {
    setBusy(true);
    try {
      const saved = await api.patch(`/applications/${application.reference}`, {
        answers,
        attestations: agreed,
        references: referees,
        ...extra,
      });
      setApplication(saved);
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const advance = async () => {
    if (stage !== 'requirements' && !(await persist())) return;
    const nextStage = stages[at + 1];
    if (nextStage) setStage(nextStage);
  };

  const submit = async () => {
    if (!(await persist())) return;
    setBusy(true);
    try {
      const result = await api.post(`/applications/${application.reference}/submit`);
      if (result.requiresPayment) {
        const intent = await api.post(`/applications/${application.reference}/pay`);
        window.location.href = intent.redirectUrl;
        return;
      }
      navigate(`/applications/${application.reference}`);
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="band band-warm">
        <div className="wrap wrap-narrow stack stack-3">
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <Monogram text={church?.monogram} />
            <div className="stack" style={{ gap: 0 }}>
              <span className="small">{church?.name} {church?.verified ? <Verified /> : null}</span>
              <span className="dim xs">{[church?.city, church?.country].filter(Boolean).join(', ')}</span>
            </div>
          </div>
          <h1>Apply for {offering.title}</h1>
          <p className="lede">{offering.subtitle}</p>
        </div>
      </div>

      <div className="wrap band">
        <div className="wizard">
          <nav className="wizard-rail" aria-label="Steps">
            {stages.map((s, i) => (
              <button
                key={s}
                type="button"
                className={`wizard-step ${s === stage ? 'is-current' : ''} ${i < at ? 'is-done' : ''}`}
                onClick={() => i <= at && setStage(s)}
                disabled={i > at}
              >
                <span className="n">{i < at ? <Check size={13} strokeWidth={2.6} /> : i + 1}</span>
                <span>{LABELS[s]}</span>
              </button>
            ))}
          </nav>

          <div>
            <div className="wizard-panel">
              {stage === 'requirements' ? (
                <Requirements offering={offering} steps={listing.data.requirements?.steps ?? []} eligibility={listing.data.requirements?.eligibility ?? []} disclosures={listing.data.disclosures ?? []} />
              ) : null}

              {stage === 'about' ? (
                <div className="a-form">
                  <h2 style={{ marginTop: 0 }}>Application form</h2>
                  {form.map((field) => (
                    field.type === 'textarea' ? (
                      <Textarea key={field.key} label={field.label} help={field.help} rows={4} value={answers[field.key] ?? ''} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })} />
                    ) : field.type === 'select' ? (
                      <div key={field.key} className="a-field">
                        <label>{field.label}</label>
                        <select className="select" value={answers[field.key] ?? ''} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}>
                          <option value="">Choose one</option>
                          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                        {field.help ? <span className="help">{field.help}</span> : null}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <Checkbox key={field.key} label={field.label} help={field.help} checked={Boolean(answers[field.key])} onChange={(v) => setAnswers({ ...answers, [field.key]: v })} />
                    ) : (
                      <Input key={field.key} label={field.label} help={field.help} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} value={answers[field.key] ?? ''} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })} />
                    )
                  ))}
                </div>
              ) : null}

              {stage === 'agree' ? (
                <div className="a-form">
                  <h2 style={{ marginTop: 0 }}>Terms and agreements</h2>
                  <p className="muted">Read each statement before agreeing.</p>
                  {attestations.map((a) => (
                    <Checkbox
                      key={a.key}
                      label={a.statement}
                      checked={agreed.includes(a.key)}
                      onChange={(on) => setAgreed(on ? [...agreed, a.key] : agreed.filter((k) => k !== a.key))}
                    />
                  ))}
                </div>
              ) : null}

              {stage === 'documents' ? (
                <div className="a-form">
                  <h2 style={{ marginTop: 0 }}>Documents</h2>
                  <p className="muted">
                    Only you and this church can access these files.
                  </p>
                  {documents.map((doc) => {
                    const spec = (offering.requires?.documents ?? []).find((d) => d.key === doc.key);
                    return (
                      <div key={doc.key} className="a-field">
                        <label>{doc.label ?? doc.key}{spec?.required === false ? ' (optional)' : ''}</label>
                        {spec?.description ? <span className="help">{spec.description}</span> : null}
                        {doc.mediaId ? (
                          <div className="row row-between panel" style={{ padding: '10px 14px' }}>
                            <span className="row small" style={{ gap: 8 }}>
                              <FileText size={15} strokeWidth={1.8} /> {doc.media?.filename ?? 'Uploaded'}
                            </span>
                            <span className="pill pill-good"><Check size={11} strokeWidth={3} /> Sent</span>
                          </div>
                        ) : (
                          <FileDrop
                            label="Choose a file"
                            hint="A PDF or a photograph, up to 20MB"
                            accept="application/pdf,image/*"
                            onFile={async (file) => {
                              setBusy(true);
                              try {
                                const updated = await api.upload(`/applications/${application.reference}/documents/${doc.key}`, file);
                                setApplication(updated);
                              } catch (err) { fail(err); } finally { setBusy(false); }
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {stage === 'references' ? (
                <div className="a-form">
                  <h2 style={{ marginTop: 0 }}>References</h2>
                  <p className="muted">
                    Referees receive an email link and reply directly to the church.
                  </p>
                  {references.map((spec) => {
                    const value = referees.find((r) => r.key === spec.key) ?? { key: spec.key, name: '', email: '', relationship: spec.relationship ?? '' };
                    const update = (patch) => setReferees(referees.some((r) => r.key === spec.key)
                      ? referees.map((r) => (r.key === spec.key ? { ...r, ...patch } : r))
                      : [...referees, { ...value, ...patch }]);
                    return (
                      <fieldset key={spec.key} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 'var(--s-4)' }}>
                        <legend className="eyebrow">{spec.label}</legend>
                        <div className="a-row">
                          <Input label="Name" value={value.name} onChange={(e) => update({ name: e.target.value })} />
                          <Input label="Email" type="email" value={value.email} onChange={(e) => update({ email: e.target.value })} />
                          <Input label="Relationship" value={value.relationship} onChange={(e) => update({ relationship: e.target.value })} />
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              ) : null}

              {stage === 'pay' ? (
                <div className="a-form">
                  <h2 style={{ marginTop: 0 }}>{fee > 0 ? 'The application fee' : 'Submit your application'}</h2>

                  {fee > 0 ? (
                    <>
                      <div className="panel panel-warm" style={{ padding: 'var(--s-5)' }}>
                        <div className="row row-between">
                          <span>{offering.fee?.label ?? 'Application fee'}</span>
                          <b className="price-big">{money(fee)}</b>
                        </div>
                      </div>

                      <div className="notice">
                        <strong>About this fee</strong>
                        <p style={{ margin: '4px 0 0' }}>
                          Covers {church?.name}'s assessment of your application. It does not guarantee the
                          credential, and the church may still decline.
                        </p>
                      </div>

                      {offering.fee?.refundPolicy ? (
                        <div className="notice">
                          <strong>Refund policy</strong>
                          <p style={{ margin: '4px 0 0' }}>{offering.fee.refundPolicy}</p>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="muted">No fee is required. Your application goes directly to the church.</p>
                  )}

                  <p className="dim small">
                    <Lock size={13} strokeWidth={1.8} style={{ verticalAlign: -2 }} /> Payment is handled by Pesapal.
                    Kingdom Network never sees your card or wallet details.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="wizard-foot">
              {at > 0 ? (
                <button type="button" className="btn btn-ghost" onClick={() => setStage(stages[at - 1])}>Back</button>
              ) : (
                <Link className="btn btn-ghost" to={`/listing/${slug}`}>Back to the listing</Link>
              )}

              {stage === 'pay' ? (
                <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={busy}>
                  {busy ? 'One moment…' : fee > 0 ? `Pay ${money(fee)} and apply` : 'Send my application'}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={advance} disabled={busy}>
                  Continue <ArrowRight size={16} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const LABELS = {
  requirements: 'Requirements',
  about: 'Your details',
  agree: 'Agreements',
  documents: 'Documents',
  references: 'References',
  pay: 'Apply',
};

const Requirements = ({ offering, steps, eligibility, disclosures }) => (
  <div className="stack stack-5">
    <div>
      <h2 style={{ marginTop: 0 }}>What {offering.award?.title ?? offering.title} requires</h2>
      <p className="muted">
        Complete each requirement before the church reviews your application. Progress is saved automatically.
      </p>
      <div className="checklist">
        {steps.map((s) => (
          <div key={s.key} className={`check-step ${s.status === 'complete' ? 'is-complete' : ''}`}>
            <span className="mark">{s.status === 'complete' ? <Check size={12} strokeWidth={3} /> : null}</span>
            <span className="body">
              <span className="label">{s.course?.title ?? s.offering?.title ?? s.label}</span>
              {s.detail ? <span className="detail">{s.detail}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>

    {eligibility?.length ? (
      <div>
        <h3 className="eyebrow">Additional requirements</h3>
        <ul className="a-problems">{eligibility.map((e) => <li key={e}>{e}</li>)}</ul>
      </div>
    ) : null}

    <div className="stack stack-2">
      <h3 className="eyebrow"><ShieldCheck size={13} strokeWidth={1.9} style={{ verticalAlign: -2 }} /> Important information</h3>
      {disclosures.map((d, i) => (
        <p key={i} className="small muted" style={{ margin: 0 }}>{d}</p>
      ))}
    </div>
  </div>
);
