import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, CalendarClock, Check, FileCheck2, FileText, Gavel, Hourglass,
  IdCard, Paperclip, Receipt, ShieldCheck, Sparkles, UserRoundCheck, X,
} from 'lucide-react';

import { ErrorState, Monogram, Spinner, Verified } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { dateShort, money } from '../lib/format.js';
import { useToast } from '../lib/toast.jsx';
import { useApi } from '../lib/useAsync.js';

/**
 * One application, in full.
 *
 * This is the workspace, not a receipt. Someone has asked a church to
 * recognise them and the answer arrives over weeks, so the page answers one
 * question above everything else: what can I do about it today. That leads,
 * the path they are on follows, and history sits beneath both.
 *
 * Nothing here comes from the admin kit. A page a minister sees while waiting
 * on a decision should not be built out of the same parts as a console.
 */

/* --- how each kind of step presents -------------------------------------- */

const ICON = { size: 14, strokeWidth: 2 };

const STEP_ICON = {
  fee: <Receipt {...ICON} />,
  course: <BookOpen {...ICON} />,
  assessment: <FileCheck2 {...ICON} />,
  interview: <CalendarClock {...ICON} />,
  credential: <IdCard {...ICON} />,
  document: <Paperclip {...ICON} />,
  reference: <UserRoundCheck {...ICON} />,
  attestation: <ShieldCheck {...ICON} />,
  form: <FileText {...ICON} />,
  review: <Gavel {...ICON} />,
};

/**
 * The imperative for a step, in the applicant's own terms.
 *
 * `title` leads the card at the top of the page, so it says what to do rather
 * than naming a category — "Pay the application fee", never "Fee".
 */
const stepAction = (step, { reference, application, onPay, busy }) => {
  switch (step.type) {
    case 'fee':
      return {
        title: 'Pay the application fee',
        cta: (
          <button type="button" className="btn btn-primary btn-lg" onClick={onPay} disabled={busy}>
            Pay {money(step.meta?.amount ?? application.offering?.fee?.amount ?? 0)} and apply <ArrowRight size={16} />
          </button>
        ),
        fine: application.offering?.fee?.refundable === false
          ? 'The fee is not refunded once the church has begun its review.'
          : null,
      };
    case 'course':
      return {
        title: step.course ? `Work through ${step.course.title}` : 'Complete the required coursework',
        cta: step.course ? (
          <Link className="btn btn-primary btn-lg" to={`/learn/${step.course.slug}`}>
            {step.progress > 0 ? 'Continue the course' : 'Start the course'} <ArrowRight size={16} />
          </Link>
        ) : null,
      };
    case 'assessment':
      return {
        title: 'Sit the paper',
        cta: (
          <Link className="btn btn-primary btn-lg" to={`/applications/${reference}/assessment`}>
            Sit the paper <ArrowRight size={16} />
          </Link>
        ),
      };
    case 'interview':
      return step.meta?.booked
        ? {
            title: 'Your interview is booked',
            cta: (
              <Link className="btn btn-outline btn-lg" to={`/applications/${reference}/interview`}>
                <CalendarClock size={16} /> See the details
              </Link>
            ),
          }
        : {
            title: 'Book your interview',
            cta: (
              <Link className="btn btn-primary btn-lg" to={`/applications/${reference}/interview`}>
                Choose a time <ArrowRight size={16} />
              </Link>
            ),
          };
    case 'credential':
      return {
        title: step.offering ? `Hold ${step.offering.title} first` : 'Hold the required credential first',
        cta: step.offering ? (
          <Link className="btn btn-outline btn-lg" to={`/listing/${step.offering.slug}`}>
            Apply for it <ArrowRight size={16} />
          </Link>
        ) : null,
      };
    case 'review':
      return { title: 'With the church', cta: null, resting: true };
    default:
      return {
        title: step.label ?? 'Finish this step',
        cta: (
          <Link className="btn btn-primary btn-lg" to={`/apply/${application.offeringSlug}`}>
            Finish this <ArrowRight size={16} />
          </Link>
        ),
      };
  }
};

/** The same imperative, shrunk to sit beside a step on the path. */
const stepLink = (step, { reference, application }) => {
  switch (step.type) {
    case 'course':
      return step.course
        ? <Link className="btn btn-outline btn-sm" to={`/learn/${step.course.slug}`}>{step.progress > 0 ? 'Continue' : 'Start'}</Link>
        : null;
    case 'assessment':
      return <Link className="btn btn-outline btn-sm" to={`/applications/${reference}/assessment`}>Sit the paper</Link>;
    case 'interview':
      return (
        <Link className="btn btn-outline btn-sm" to={`/applications/${reference}/interview`}>
          {step.meta?.booked ? 'Details' : 'Book a time'}
        </Link>
      );
    case 'credential':
      return step.offering
        ? <Link className="btn btn-outline btn-sm" to={`/listing/${step.offering.slug}`}>Apply for it</Link>
        : null;
    case 'document':
    case 'reference':
    case 'form':
    case 'attestation':
      return <Link className="btn btn-outline btn-sm" to={`/apply/${application.offeringSlug}`}>Finish this</Link>;
    default:
      return null;
  }
};

const STATUS_TONE = {
  fee_pending: ['Fee due', 'ap-status-wait'],
  draft: ['Draft', ''],
  submitted: ['Submitted', 'ap-status-good'],
  under_review: ['Under review', ''],
  info_requested: ['Needs your reply', 'ap-status-wait'],
  coursework: ['Coursework', 'ap-status-wait'],
  assessment: ['Paper to sit', 'ap-status-wait'],
  interview: ['Interview', 'ap-status-wait'],
  final_review: ['Final review', ''],
  approved: ['Approved', 'ap-status-good'],
  issued: ['Issued', 'ap-status-good'],
  declined: ['Declined', 'ap-status-stop'],
  withdrawn: ['Withdrawn', ''],
  expired: ['Expired', 'ap-status-stop'],
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

/* --- pieces --------------------------------------------------------------- */

const FilePick = ({ label, onFile, busy }) => {
  const input = useRef(null);
  return (
    <label className="ap-drop">
      <Paperclip size={14} strokeWidth={2} />
      {busy ? 'Sending…' : label}
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/*"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          if (input.current) input.current.value = '';
        }}
      />
    </label>
  );
};

const settled = (s) => s.status === 'complete' || s.status === 'waived';

/* --- the page ------------------------------------------------------------- */

export const ApplicationDetail = () => {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi(`/applications/${reference}`);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [reply, setReply] = useState('');

  if (loading) return <div className="wrap band"><Spinner label="Loading your application" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const a = data;
  const paidJustNow = params.get('state') === 'paid';
  const [statusLabel, statusTone] = STATUS_TONE[a.status] ?? [a.status, ''];

  const payNow = async () => {
    setBusy(true);
    try {
      const intent = await api.post(`/applications/${reference}/pay`);
      window.location.href = intent.redirectUrl;
    } catch (err) { fail(err); setBusy(false); }
  };

  const answerInfoRequest = async () => {
    setBusy(true);
    try {
      await api.patch(`/applications/${reference}`, { resolveInfoRequest: true });
      ok('Sent back to the church');
      setReply('');
      await reload();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const sendDocument = async (key, file) => {
    setUploading(key);
    try {
      await api.upload(`/applications/${reference}/documents/${key}`, file);
      await reload();
      ok('Sent');
    } catch (err) { fail(err); } finally { setUploading(null); }
  };

  const next = a.summary.next;
  const lead = a.decision ? null : next ? stepAction(next, { reference, application: a, onPay: payNow, busy }) : null;

  return (
    <div className="ap">
      <header className="ap-hero">
        {a.offering?.coverImage ? <img className="ap-hero-art" src={a.offering.coverImage} alt="" /> : null}
        <div className="ap-col">
          <Link to="/me/journey" className="ap-back"><ArrowLeft size={15} /> Your journey</Link>

          <div className="ap-church">
            <Monogram text={a.church?.monogram} />
            <span className="ap-church-name">
              {a.church?.name}
              {a.church?.verified ? <Verified label="" size={13} /> : null}
              <span className="ap-church-where">
                {[a.church?.city, a.church?.country].filter(Boolean).join(', ')}
              </span>
            </span>
          </div>

          <h1 className="ap-title">{a.offeringTitle}</h1>

          <div className="ap-hero-foot">
            <span className={`ap-status ${statusTone}`}>{statusLabel}</span>
            <span className="ap-ref">{reference}</span>
          </div>
        </div>
      </header>

      <div className="ap-col">
        {/* What to do today. Everything else on this page is context for it. */}
        {lead ? (
          <section className={`ap-next ${lead.resting ? 'ap-next-resting' : ''}`}>
            <span className="ap-next-eyebrow">
              {lead.resting ? <><Hourglass size={12} strokeWidth={2.4} /> Waiting</> : <><Sparkles size={12} strokeWidth={2.4} /> Next step</>}
            </span>
            <div>
              <h2>{lead.title}</h2>
              {next.detail ? <p>{next.detail}</p> : null}
            </div>
            {lead.cta ? <div className="ap-next-act">{lead.cta}</div> : null}
            {lead.fine ? <p className="ap-next-fine">{lead.fine}</p> : null}
          </section>
        ) : null}

        {a.decision ? (
          <section className={`ap-note ${a.decision.outcome === 'approved' ? 'ap-note-good' : a.decision.outcome === 'declined' ? 'ap-note-stop' : 'ap-note-ask'}`}>
            <strong>
              {a.decision.outcome === 'approved' ? 'Approved and issued'
                : a.decision.outcome === 'declined' ? `${a.church?.name} has declined this application`
                  : 'Deferred for now'}
            </strong>
            {a.decision.note ? <p>{a.decision.note}</p> : null}
            {a.credentialId ? (
              <div><Link className="btn btn-primary btn-sm" to="/me/passport"><IdCard size={14} /> Open your passport</Link></div>
            ) : null}
          </section>
        ) : null}

        {paidJustNow && a.paymentRef ? (
          <section className="ap-note ap-note-good">
            <strong>Payment received. Your application is with {a.church?.name}.</strong>
            <p>They will review it and you will see every move on this page.</p>
          </section>
        ) : null}

        {a.infoRequest ? (
          <section className="ap-note ap-note-ask">
            <strong>{a.church?.name} has asked you for something.</strong>
            <p>{a.infoRequest.message}</p>
            <textarea
              className="ap-reply"
              rows={3}
              value={reply}
              placeholder="Your reply to the church"
              onChange={(e) => setReply(e.target.value)}
            />
            <div>
              <button type="button" className="btn btn-primary btn-sm" onClick={answerInfoRequest} disabled={busy}>
                I have dealt with this
              </button>
            </div>
          </section>
        ) : null}

        <div className="ap-progress">
          <div className="ap-progress-bar">
            <span style={{ width: `${a.summary.percent}%` }} />
          </div>
          <span className="ap-progress-count">{a.summary.complete} of {a.summary.total} met</span>
        </div>

        <section className="ap-section">
          <div className="ap-section-head">
            <h3>What this church asks of you</h3>
          </div>
          <div className="ap-path">
            {a.steps.map((s) => {
              const done = settled(s);
              const isNext = !done && next?.key === s.key;
              const state = s.status === 'failed' ? 'is-failed'
                : s.status === 'waived' ? 'is-waived'
                  : done ? 'is-done'
                    : isNext ? 'is-now' : '';
              const act = done ? null : stepLink(s, { reference, application: a });
              return (
                <div key={s.key} className={`ap-step ${state}`}>
                  <span className="ap-node">
                    {done ? <Check size={14} strokeWidth={3} />
                      : s.status === 'failed' ? <X size={14} strokeWidth={3} />
                        : STEP_ICON[s.type] ?? null}
                  </span>
                  <div className="ap-step-body">
                    <span className="ap-step-label">{s.course?.title ?? s.offering?.title ?? s.label}</span>
                    {s.detail ? <span className="ap-step-detail">{s.detail}</span> : null}
                    {s.waiverReason ? <span className="ap-step-waiver">Waived by the church — {s.waiverReason}</span> : null}
                    {act ? <div className="ap-step-act">{act}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {a.documents?.length ? (
          <section className="ap-section">
            <div className="ap-section-head">
              <h3>Your documents</h3>
              <span>Only you and {a.church?.shortName ?? a.church?.name} can open these</span>
            </div>
            <div className="ap-docs">
              {a.documents.map((d) => (
                <div key={d.key} className="ap-doc">
                  <FileText size={17} strokeWidth={1.7} color="var(--ink-3)" />
                  <div className="ap-doc-body">
                    <span className="ap-doc-label">{d.label ?? d.key}</span>
                    {d.note ? <span className="ap-doc-note">{d.note}</span> : null}
                    {d.media?.filename ? <span className="ap-doc-note">{d.media.filename}</span> : null}
                  </div>
                  {d.status === 'rejected' ? (
                    <FilePick label="Send another" busy={uploading === d.key} onFile={(f) => sendDocument(d.key, f)} />
                  ) : d.mediaId ? (
                    <span className={`ap-doc-state ${d.status === 'accepted' ? 'is-accepted' : ''}`}>
                      {d.status === 'accepted' ? 'Accepted' : 'Sent'}
                    </span>
                  ) : (
                    <FilePick label="Choose a file" busy={uploading === d.key} onFile={(f) => sendDocument(d.key, f)} />
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {a.timeline?.length ? (
          <section className="ap-section">
            <div className="ap-section-head">
              <h3>Activity</h3>
            </div>
            <div className="ap-history">
              {a.timeline.map((t, i) => (
                <div key={`${t.event}-${i}`} className={`ap-event ${t.actorRole === 'church' ? 'is-church' : ''}`}>
                  <span className="ap-event-when">
                    {new Date(t.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  {EVENTS[t.event] ?? t.event}
                  {t.note ? <span className="ap-event-note">{t.note}</span> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="ap-meta">
          <span>Reference <b>{reference}</b></span>
          <span>Started <b>{dateShort(a.createdAt)}</b></span>
          {a.submittedAt ? <span>Submitted <b>{dateShort(a.submittedAt)}</b></span> : null}
        </div>

        {a.disclosures?.length ? (
          <div className="ap-fine">
            {a.disclosures.map((d, i) => <p key={i}>{d}</p>)}
          </div>
        ) : null}
      </div>
    </div>
  );
};
