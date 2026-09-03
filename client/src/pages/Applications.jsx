import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarClock, Check, FileText, X } from 'lucide-react';

import { FileDrop, StatusPill, Textarea } from '../components/admin/kit.jsx';
import { ErrorState, Monogram, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { dateShort, money } from '../lib/format.js';
import { useToast } from '../lib/toast.jsx';
import { useApi } from '../lib/useAsync.js';

/**
 * One application, in full.
 *
 * The list that used to sit alongside this is now /me/journey, where it can
 * show what is outstanding rather than only what exists.
 */

export const ApplicationDetail = () => {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi(`/applications/${reference}`);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');

  if (loading) return <div className="wrap band"><Spinner /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const a = data;
  const paidJustNow = params.get('state') === 'paid';

  const answerInfoRequest = async () => {
    setBusy(true);
    try {
      await api.patch(`/applications/${reference}`, { resolveInfoRequest: true });
      ok('Sent back to the church');
      setReply('');
      await reload();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const payNow = async () => {
    setBusy(true);
    try {
      const intent = await api.post(`/applications/${reference}/pay`);
      window.location.href = intent.redirectUrl;
    } catch (err) { fail(err); setBusy(false); }
  };

  return (
    <>
      <div className="band band-warm">
        <div className="wrap stack stack-3">
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <Monogram text={a.church?.monogram} />
            <div className="stack" style={{ gap: 0 }}>
              <span className="small">{a.church?.name}</span>
              <span className="dim xs">{reference}</span>
            </div>
          </div>
          <div className="row row-between" style={{ alignItems: 'flex-end' }}>
            <h1 style={{ margin: 0 }}>{a.offeringTitle}</h1>
            <StatusPill status={a.status} />
          </div>
        </div>
      </div>

      <div className="wrap band">
        <div className="detail-grid">
          <div className="stack stack-5">
            {paidJustNow && a.paymentRef ? (
              <div className="notice notice-green">
                <strong>Payment received. Your application is with {a.church?.name}.</strong>
                <p style={{ margin: '4px 0 0' }}>
                  The church will now review your application.
                </p>
              </div>
            ) : null}

            {a.decision ? (
              <div className={`notice ${a.decision.outcome === 'approved' ? 'notice-green' : a.decision.outcome === 'declined' ? 'notice-red' : 'notice-gold'}`}>
                <strong>
                  {a.decision.outcome === 'approved' ? 'Approved and issued'
                    : a.decision.outcome === 'declined' ? 'The church has declined this application'
                      : 'Deferred for now'}
                </strong>
                {a.decision.note ? <p style={{ margin: '4px 0 0' }}>{a.decision.note}</p> : null}
                {a.credentialId ? (
                  <p style={{ margin: '8px 0 0' }}>
                    <Link className="btn btn-primary btn-sm" to="/me/passport">Open your passport</Link>
                  </p>
                ) : null}
              </div>
            ) : null}

            {a.infoRequest ? (
              <div className="notice notice-gold">
                <strong>{a.church?.name} has requested more information.</strong>
                <p style={{ margin: '4px 0 8px' }}>{a.infoRequest.message}</p>
                <Textarea label="Your reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
                <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={answerInfoRequest} disabled={busy}>
                  I have dealt with this
                </button>
              </div>
            ) : null}

            <section>
              <h2>Requirements</h2>
              <div className="checklist">
                {a.steps.map((s) => {
                  const done = s.status === 'complete' || s.status === 'waived';
                  return (
                    <div key={s.key} className={`check-step ${done ? (s.status === 'waived' ? 'is-waived' : 'is-complete') : ''} ${s.status === 'failed' ? 'is-failed' : ''}`}>
                      <span className="mark">
                        {done ? <Check size={12} strokeWidth={3} /> : s.status === 'failed' ? <X size={12} strokeWidth={3} /> : null}
                      </span>
                      <span className="body">
                        <span className="label">{s.course?.title ?? s.offering?.title ?? s.label}</span>
                        {s.detail ? <span className="detail">{s.detail}</span> : null}
                        {s.waiverReason ? <span className="waiver">The church waived this — {s.waiverReason}</span> : null}
                      </span>
                      {!done ? <StepAction step={s} application={a} reference={reference} onPay={payNow} busy={busy} reload={reload} /> : null}
                    </div>
                  );
                })}
              </div>
            </section>

            {a.documents?.length ? (
              <section>
                <h2>Your documents</h2>
                <div className="stack stack-2">
                  {a.documents.map((d) => (
                    <div key={d.key} className="row row-between panel" style={{ padding: '10px 14px' }}>
                      <span className="row small" style={{ gap: 8 }}>
                        <FileText size={15} strokeWidth={1.8} />
                        <span>
                          {d.label ?? d.key}
                          {d.note ? <span className="dim xs" style={{ display: 'block' }}>{d.note}</span> : null}
                        </span>
                      </span>
                      <span className="row" style={{ gap: 8 }}>
                        <StatusPill status={d.status} />
                        {d.status === 'rejected' ? (
                          <FileDrop
                            label="Send another"
                            accept="application/pdf,image/*"
                            onFile={async (file) => {
                              try { await api.upload(`/applications/${reference}/documents/${d.key}`, file); await reload(); ok('Sent'); }
                              catch (err) { fail(err); }
                            }}
                          />
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2>Activity</h2>
              <div className="timeline">
                {a.timeline.map((t, i) => (
                  <div key={i} className={`timeline-entry ${t.actorRole === 'church' ? 'is-church' : ''}`}>
                    <div className="when">{new Date(t.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    <div>{EVENTS[t.event] ?? t.event}</div>
                    {t.note ? <div className="note small">{t.note}</div> : null}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside>
            <div className="buy-card">
              <h3 style={{ marginTop: 0 }}>Progress</h3>
              <span className="progress"><span style={{ width: `${a.summary.percent}%` }} /></span>
              <p className="dim small" style={{ margin: '8px 0 16px' }}>{a.summary.complete} of {a.summary.total} requirements met</p>

              {a.summary.next ? (
                <p className="small"><b>Next:</b> {a.summary.next.label}</p>
              ) : a.decision ? null : (
                <p className="small">Everything is met. It is with the church now.</p>
              )}

              {a.offering?.fee?.amount && !a.paymentRef ? (
                <button type="button" className="btn btn-primary btn-block" onClick={payNow} disabled={busy}>
                  Pay {money(a.offering.fee.amount)} and apply
                </button>
              ) : null}

              <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: 'var(--s-4) 0' }} />
              <dl className="a-kv small">
                <dt>Reference</dt><dd>{reference}</dd>
                <dt>Started</dt><dd>{dateShort(a.createdAt)}</dd>
                {a.submittedAt ? <><dt>Submitted</dt><dd>{dateShort(a.submittedAt)}</dd></> : null}
              </dl>
            </div>

            {a.disclosures?.length ? (
              <div className="panel" style={{ marginTop: 'var(--s-4)', padding: 'var(--s-4)' }}>
                <h4 className="eyebrow" style={{ marginTop: 0 }}>Important information</h4>
                {a.disclosures.map((d, i) => <p key={i} className="dim xs">{d}</p>)}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
};

const StepAction = ({ step, application, reference, onPay, busy }) => {
  if (step.type === 'fee') {
    return <button type="button" className="btn btn-primary btn-sm" onClick={onPay} disabled={busy}>Pay</button>;
  }
  if (step.type === 'course' && step.course) {
    return <Link className="btn btn-outline btn-sm" to={`/learn/${step.course.slug}`}>Continue</Link>;
  }
  if (step.type === 'credential' && step.offering) {
    return <Link className="btn btn-outline btn-sm" to={`/listing/${step.offering.slug}`}>Apply for it</Link>;
  }
  if (step.type === 'assessment') {
    return <Link className="btn btn-primary btn-sm" to={`/applications/${reference}/assessment`}>Sit the paper</Link>;
  }
  if (step.type === 'interview') {
    return step.meta?.booked
      ? <Link className="btn btn-outline btn-sm" to={`/applications/${reference}/interview`}><CalendarClock size={14} strokeWidth={1.8} /> Details</Link>
      : <Link className="btn btn-primary btn-sm" to={`/applications/${reference}/interview`}>Book a time</Link>;
  }
  if (step.type === 'document' || step.type === 'reference' || step.type === 'form' || step.type === 'attestation') {
    return <Link className="btn btn-outline btn-sm" to={`/apply/${application.offeringSlug}`}>Finish this</Link>;
  }
  return null;
};

const EVENTS = {
  'application:started': 'You started this application',
  'application:submitted': 'You submitted it',
  'fee:paid': 'Your fee was received',
  'document:uploaded': 'You sent a document',
  'document:accepted': 'The church accepted a document',
  'document:rejected': 'The church asked for a different document',
  'assessment:started': 'You started the paper',
  'assessment:passed': 'You passed the paper',
  'assessment:failed': 'You did not pass the paper',
  'interview:booked': 'You booked an interview',
  'interview:rescheduled': 'The interview moved',
  'interview:completed': 'The interview was held',
  'requirement:waived': 'The church waived a requirement',
  'info:requested': 'The church asked you for something',
  'info:answered': 'You replied',
  'decision:approved': 'Approved',
  'decision:declined': 'Declined',
  'decision:deferred': 'Deferred',
  'credential:issued': 'Your credential was issued',
};
