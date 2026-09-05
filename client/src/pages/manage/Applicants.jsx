import { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Check, Download, FileText, MessageSquare, ShieldQuestion, X } from 'lucide-react';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { DataTable, Dialog, Drawer, Input, Pager, Panel, StatusPill, Textarea } from '../../components/admin/kit.jsx';
import { Avatar, ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { dateShort } from '../../lib/format.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

/**
 * The church's queue, and the drawer where an application is actually decided.
 *
 * Every credential in the old system that reached "with the church" stayed
 * there forever, because nothing existed to sign one off. This is that.
 */

const STATUS_OPTIONS = [
  { value: '', label: 'Every status' },
  { value: 'submitted,under_review,final_review,info_requested', label: 'Waiting on you' },
  { value: 'coursework', label: 'Doing coursework' },
  { value: 'assessment', label: 'Sitting the paper' },
  { value: 'interview', label: 'Interview booked' },
  { value: 'issued', label: 'Issued' },
  { value: 'declined', label: 'Declined' },
];

export const Applicants = () => {
  const { churchSlug } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);

  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';
  const open = params.get('open');

  const query = new URLSearchParams({ page: String(page), ...(status ? { status } : {}), ...(q ? { q } : {}) });
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/applicants?${query}`);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setPage(1);
  };

  return (
    <>
      <ConsoleHeader title="Applicants" sub={data ? `${data.total} application${data.total === 1 ? '' : 's'}` : ''} />

      <div className="console-body">
        <Panel flush>
          <div className="a-toolbar">
            <input
              className="input grow"
              placeholder="Search by reference or what they applied for"
              defaultValue={q}
              onKeyDown={(e) => e.key === 'Enter' && setParam('q', e.currentTarget.value)}
            />
            <select className="select select-sm" value={status} onChange={(e) => setParam('status', e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {loading ? <div style={{ padding: 32 }}><Spinner /></div> : null}
          {error ? <div style={{ padding: 32 }}><ErrorState error={error} onRetry={reload} /></div> : null}

          {data ? (
            <>
              <DataTable
                rows={data.applications}
                rowKey={(r) => r.reference}
                onRowClick={(row) => setParam('open', row.reference)}
                empty={{
                  title: q || status ? 'Nothing matches that' : 'No applications yet',
                  body: q || status
                    ? 'Try a different search or clear the filter.'
                    : 'Applicants and their submissions appear here.',
                }}
                columns={[
                  {
                    key: 'applicant',
                    label: 'Applicant',
                    render: (r) => (
                      <span className="who">
                        <Avatar src={r.applicant?.avatar} name={r.applicant?.name} />
                        <span>
                          <span className="name">{r.applicant?.name ?? '—'}</span>
                          <span className="sub">{r.applicant?.country ?? r.applicant?.email}</span>
                        </span>
                      </span>
                    ),
                  },
                  { key: 'offeringTitle', label: 'Credential', render: (r) => <span className="clamp-1">{r.offeringTitle}</span> },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                  {
                    key: 'progress',
                    label: 'Requirements',
                    render: (r) => (
                      <span className="small">
                        <span className="progress" style={{ width: 80, display: 'inline-block', verticalAlign: -3 }}>
                          <span style={{ width: `${r.summary.percent}%` }} />
                        </span>{' '}
                        <span className="dim">{r.summary.complete}/{r.summary.total}</span>
                      </span>
                    ),
                  },
                  {
                    key: 'waiting',
                    label: 'Waiting',
                    align: 'right',
                    render: (r) =>
                      r.waitingDays == null ? <span className="dim">—</span>
                        : <span className={r.waitingOnChurch && r.waitingDays > 14 ? 'strong' : ''}>{r.waitingDays}d</span>,
                  },
                ]}
              />
              <div style={{ padding: 'var(--s-4)' }}>
                <Pager page={data.page} pages={data.pages} onPage={setPage} />
              </div>
            </>
          ) : null}
        </Panel>
      </div>

      {open ? (
        <ApplicantDrawer
          churchSlug={churchSlug}
          reference={open}
          onClose={() => setParam('open', null)}
          onChanged={reload}
        />
      ) : null}
    </>
  );
};

/* --- the drawer --------------------------------------------------------- */

const ApplicantDrawer = ({ churchSlug, reference, onClose, onChanged }) => {
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/applicants/${reference}`);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      if (message) ok(message);
      await reload();
      onChanged?.();
      setDialog(null);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const a = data;

  return (
    <Drawer
      open
      onClose={onClose}
      title={a?.applicant?.name ?? reference}
      subtitle={a ? `${a.offeringTitle} · ${reference}` : ''}
      footer={
        a && !['issued', 'declined', 'withdrawn'].includes(a.status) ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog('info')}>
              <MessageSquare size={15} strokeWidth={1.8} /> Request information
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setDialog('decline')}>Decline</button>
            <button type="button" className="btn btn-primary" onClick={() => setDialog('approve')}>Approve and issue</button>
          </>
        ) : null
      }
    >
      {loading ? <Spinner /> : null}
      {error ? <ErrorState error={error} onRetry={reload} /> : null}

      {a ? (
        <>
          <div className="row row-between">
            <StatusPill status={a.status} />
            {a.credentialId ? <span className="small dim">Issued as {a.credentialId}</span> : null}
          </div>

          {a.infoRequest?.requestedAt && !a.infoRequest?.resolvedAt ? (
            <div className="notice notice-gold">
              <strong>Information requested</strong>
              <p style={{ margin: '4px 0 0' }}>{a.infoRequest.message}</p>
            </div>
          ) : null}

          <section>
            <h3 className="eyebrow">Applicant</h3>
            <dl className="a-kv">
              <dt>Email</dt><dd>{a.applicant?.email}</dd>
              {a.applicant?.phone ? <><dt>Phone</dt><dd>{a.applicant.phone}</dd></> : null}
              {a.applicant?.country ? <><dt>Where</dt><dd>{[a.applicant.city, a.applicant.country].filter(Boolean).join(', ')}</dd></> : null}
              {a.applicant?.ministryRole ? <><dt>Role</dt><dd>{a.applicant.ministryRole}</dd></> : null}
              {a.applicant?.ministry?.yearsInMinistry ? <><dt>In ministry</dt><dd>{a.applicant.ministry.yearsInMinistry} years</dd></> : null}
              {a.applicant?.ministry?.congregation ? <><dt>Congregation</dt><dd>{a.applicant.ministry.congregation}</dd></> : null}
              <dt>Account since</dt><dd>{dateShort(a.applicant?.createdAt)}</dd>
            </dl>
          </section>

          <section>
            <h3 className="eyebrow">Requirements</h3>
            <div className="checklist">
              {a.steps.map((s) => (
                <div key={s.key} className={`check-step ${s.status === 'complete' ? 'is-complete' : s.status === 'waived' ? 'is-waived' : s.status === 'failed' ? 'is-failed' : ''}`}>
                  <span className="mark">{s.status === 'complete' || s.status === 'waived' ? <Check size={12} strokeWidth={3} /> : s.status === 'failed' ? <X size={12} strokeWidth={3} /> : null}</span>
                  <span className="body">
                    <span className="label">{s.course?.title ?? s.offering?.title ?? s.label}</span>
                    {s.meta?.required === false ? <span className="detail">Optional</span> : null}
                    {s.meta?.nonWaivable ? <span className="detail">Required for ordination · cannot be waived</span> : null}
                    {s.detail ? <span className="detail">{s.detail}</span> : null}
                    {s.waiverReason ? <span className="waiver">Waived — {s.waiverReason}</span> : null}
                  </span>
                  {s.status !== 'complete' && s.status !== 'waived' && s.type !== 'fee' && s.type !== 'review' && !s.meta?.nonWaivable ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ waive: s })}>
                      Waive
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {Object.keys(a.answers ?? {}).length ? (
            <section>
              <h3 className="eyebrow">Application answers</h3>
              <dl className="a-kv">
                {(a.offering?.applicationForm ?? []).map((f) => (
                  <span key={f.key} style={{ display: 'contents' }}>
                    <dt>{f.label}</dt>
                    <dd>{String(a.answers[f.key] ?? '—')}</dd>
                  </span>
                ))}
              </dl>
            </section>
          ) : null}

          {a.documents?.length ? (
            <section>
              <h3 className="eyebrow">Documents</h3>
              <div className="stack stack-2">
                {a.documents.map((d) => (
                  <div key={d.key} className="row row-between panel" style={{ padding: '10px 14px', gap: 12 }}>
                    <span className="row" style={{ gap: 10, minWidth: 0 }}>
                      <FileText size={16} strokeWidth={1.7} />
                      <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                        <b className="small clamp-1">{d.label ?? d.key}</b>
                        <span className="dim xs">{d.media?.filename ?? 'Nothing uploaded yet'}</span>
                      </span>
                    </span>
                    <span className="row" style={{ gap: 8 }}>
                      <StatusPill status={d.status} />
                      {d.media ? (
                        <a className="btn btn-ghost btn-sm" href={d.media.url} target="_blank" rel="noreferrer">
                          <Download size={14} strokeWidth={1.8} /> Open
                        </a>
                      ) : null}
                      {d.media && d.status === 'pending' ? (
                        <>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => act(() => api.post(`/manage/${churchSlug}/applicants/${reference}/documents/${d.key}`, { status: 'accepted' }), 'Accepted')}>
                            Accept
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ reject: d })}>
                            Reject
                          </button>
                        </>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {a.references?.length ? (
            <section>
              <h3 className="eyebrow">References</h3>
              <div className="stack stack-2">
                {a.references.map((r) => (
                  <div key={r.key} className="panel" style={{ padding: '12px 14px' }}>
                    <div className="row row-between">
                      <b className="small">{r.name || 'Not named yet'}{r.relationship ? ` · ${r.relationship}` : ''}</b>
                      <StatusPill status={r.status} />
                    </div>
                    {r.response ? (
                      <p className="small" style={{ margin: '8px 0 0' }}>
                        <span className={`pill pill-${r.recommend === 'yes' ? 'good' : r.recommend === 'no' ? 'bad' : 'wait'}`}>
                          {r.recommend === 'yes' ? 'Recommends' : r.recommend === 'no' ? 'Does not recommend' : 'With reservations'}
                        </span>{' '}
                        {r.response}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {a.attempts?.length ? (
            <section>
              <h3 className="eyebrow">Assessment</h3>
              <div className="stack stack-2">
                {a.attempts.map((t) => (
                  <div key={t._id} className="row row-between panel" style={{ padding: '10px 14px' }}>
                    <span className="small">Attempt {t.attemptNumber} · {dateShort(t.submittedAt ?? t.startedAt)}</span>
                    <span className="row" style={{ gap: 10 }}>
                      {t.score != null ? <b className="small">{t.score}%</b> : null}
                      <StatusPill status={t.status === 'awaiting-grading' ? 'pending' : t.passed ? 'complete' : 'failed'} label={t.status === 'awaiting-grading' ? 'Needs marking' : t.passed ? 'Passed' : 'Not passed'} />
                      {t.status === 'awaiting-grading' ? (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setDialog({ grade: t })}>Grade</button>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {a.interview ? (
            <section>
              <h3 className="eyebrow">Interview</h3>
              <div className="panel" style={{ padding: '12px 14px' }}>
                <div className="row row-between">
                  <b className="small">{new Date(a.interview.scheduledFor).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}</b>
                  <StatusPill status={a.interview.outcome ?? a.interview.status} />
                </div>
                <p className="dim xs" style={{ margin: '4px 0 0' }}>
                  {a.interview.provider}{a.interview.joinUrl ? ` · ${a.interview.joinUrl}` : ''}
                </p>
                {a.interview.notes ? <p className="small" style={{ margin: '8px 0 0' }}>{a.interview.notes}</p> : null}
                {!a.interview.outcome ? (
                  <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => setDialog('interview')}>
                    Record how it went
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <section>
            <div className="row row-between" style={{ marginBottom: 8 }}>
              <h3 className="eyebrow" style={{ margin: 0 }}>Activity</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog('note')}>Add a note</button>
            </div>
            <div className="timeline">
              {a.timeline.map((t, i) => (
                <div key={i} className={`timeline-entry ${t.actorRole === 'church' ? 'is-church' : ''} ${t.visibility === 'church' ? 'is-internal' : ''}`}>
                  <div className="when">{new Date(t.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{t.visibility === 'church' ? ' · only you can see this' : ''}</div>
                  <div>{EVENTS[t.event] ?? t.event}</div>
                  {t.note ? <div className="note small">{t.note}</div> : null}
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <ActionDialogs
        dialog={dialog}
        setDialog={setDialog}
        busy={busy}
        act={act}
        churchSlug={churchSlug}
        reference={reference}
        application={a}
      />
    </Drawer>
  );
};

const EVENTS = {
  'application:started': 'Application started',
  'application:submitted': 'Application submitted',
  'application:withdrawn': 'Withdrawn by the applicant',
  'fee:paid': 'Application fee paid',
  'document:uploaded': 'Document uploaded',
  'document:accepted': 'Document accepted',
  'document:rejected': 'Document rejected',
  'reference:received': 'A reference came back',
  'assessment:started': 'Started the paper',
  'assessment:submitted': 'Submitted the paper',
  'assessment:passed': 'Passed the paper',
  'assessment:failed': 'Did not pass the paper',
  'interview:booked': 'Interview booked',
  'interview:rescheduled': 'Interview moved',
  'interview:completed': 'Interview held',
  'interview:pass': 'Interview passed',
  'interview:fail': 'Interview not passed',
  'requirement:waived': 'A requirement was waived',
  'info:requested': 'More information asked for',
  'info:answered': 'The applicant answered',
  'decision:approved': 'Approved',
  'decision:declined': 'Declined',
  'decision:deferred': 'Deferred',
  'credential:issued': 'Credential issued',
  note: 'Note',
};

const ActionDialogs = ({ dialog, setDialog, busy, act, churchSlug, reference, application }) => {
  const [text, setText] = useState('');
  const [second, setSecond] = useState('');
  const [scores, setScores] = useState({});

  useEffect(() => { setText(''); setSecond(''); setScores({}); }, [dialog]);

  const base = `/manage/${churchSlug}/applicants/${reference}`;

  if (dialog === 'info') {
    return (
      <Dialog
        open
        onClose={() => setDialog(null)}
        title="Request information information"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => act(() => api.post(`${base}/info`, { message: text }), 'Sent')}>
              Send
            </button>
          </>
        }
      >
        <p className="muted small" style={{ marginTop: 0 }}>The applicant is emailed and the application pauses until they reply.</p>
        <Textarea label="What do you need?" value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus />
      </Dialog>
    );
  }

  if (dialog === 'note') {
    return (
      <Dialog
        open
        onClose={() => setDialog(null)}
        title="Add an internal note"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => act(() => api.post(`${base}/note`, { note: text }), 'Noted')}>Save</button>
          </>
        }
      >
        <p className="muted small" style={{ marginTop: 0 }}>Internal only.</p>
        <Textarea label="Note" value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus />
      </Dialog>
    );
  }

  if (dialog === 'interview') {
    return (
      <Dialog
        open
        onClose={() => setDialog(null)}
        title="Record interview outcome"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => act(() => api.post(`${base}/interview`, { outcome: 'fail', notes: text }), 'Recorded')}>Did not pass</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.post(`${base}/interview`, { outcome: 'pass', notes: text }), 'Recorded')}>Passed</button>
          </>
        }
      >
        <Textarea label="Notes" help="Internal only." value={text} onChange={(e) => setText(e.target.value)} rows={5} autoFocus />
      </Dialog>
    );
  }

  if (dialog === 'approve') {
    const outstanding = (application?.steps ?? []).filter((s) => s.meta?.required !== false && s.status !== 'complete' && s.status !== 'waived' && s.type !== 'review');
    return (
      <Dialog
        open
        onClose={() => setDialog(null)}
        title="Approve and issue"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || outstanding.length > 0}
              onClick={() => act(() => api.post(`${base}/decide`, { outcome: 'approved', publicNote: text }), 'Issued')}
            >
              Approve and issue
            </button>
          </>
        }
      >
        {outstanding.length ? (
          <div className="notice notice-gold">
            <strong>{outstanding.length} requirement{outstanding.length === 1 ? ' is' : 's are'} still outstanding.</strong>
            <p style={{ margin: '4px 0 0' }}>
              Complete outstanding requirements or record a waiver where permitted. Ordination interviews must be completed.
            </p>
            <ul className="a-problems">{outstanding.map((s) => <li key={s.key}>{s.course?.title ?? s.offering?.title ?? s.label}</li>)}</ul>
          </div>
        ) : (
          <p className="muted small" style={{ marginTop: 0 }}>
            The credential is issued immediately and the certificate generated in your name.
          </p>
        )}
        <Textarea label="Message to the applicant" help="Shown to the applicant with the decision." value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      </Dialog>
    );
  }

  if (dialog === 'decline') {
    return (
      <Dialog
        open
        onClose={() => setDialog(null)}
        title="Decline this application"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-dark" disabled={busy || !text.trim()} onClick={() => act(() => api.post(`${base}/decide`, { outcome: 'declined', publicNote: text, internalNote: second }), 'Declined')}>
              Decline
            </button>
          </>
        }
      >
        <Textarea
          label="Reason (shown to the applicant)"
          help="Required. The applicant needs to know why."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          autoFocus
        />
        <Textarea label="Internal note" help="Internal only." value={second} onChange={(e) => setSecond(e.target.value)} rows={2} />
      </Dialog>
    );
  }

  if (dialog?.waive) {
    return (
      <Dialog
        open
        onClose={() => setDialog(null)}
        title={`Waive: ${dialog.waive.course?.title ?? dialog.waive.offering?.title ?? dialog.waive.label}`}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => act(() => api.post(`${base}/steps/${encodeURIComponent(dialog.waive.key)}/waive`, { reason: text }), 'Waived')}>
              Waive it
            </button>
          </>
        }
      >
        <p className="muted small" style={{ marginTop: 0 }}>
          <ShieldQuestion size={14} strokeWidth={1.8} style={{ verticalAlign: -2 }} /> Recorded with your name and reason. Visible to the applicant.
        </p>
        <Textarea label="Reason" value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />
      </Dialog>
    );
  }

  if (dialog?.reject) {
    return (
      <Dialog
        open
        onClose={() => setDialog(null)}
        title={`Reject: ${dialog.reject.label ?? dialog.reject.key}`}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-dark" disabled={busy || !text.trim()} onClick={() => act(() => api.post(`${base}/documents/${dialog.reject.key}`, { status: 'rejected', note: text }), 'Rejected')}>
              Reject and ask again
            </button>
          </>
        }
      >
        <Textarea label="Reason for rejection" help="Sent to the applicant." value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />
      </Dialog>
    );
  }

  if (dialog?.grade) {
    const essays = (dialog.grade.served ?? []).filter((q) => q.type === 'essay');
    return (
      <Dialog
        open
        wide
        onClose={() => setDialog(null)}
        title={`Mark attempt ${dialog.grade.attemptNumber}`}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => act(
                () => api.post(`${base}/attempts/${dialog.grade._id}/grade`, {
                  scores: essays.map((q) => ({ key: q.key, awarded: Number(scores[q.key] ?? 0) })),
                  feedback: text,
                }),
                'Marked',
              )}
            >
              Save the mark
            </button>
          </>
        }
      >
        {essays.map((q) => {
          const answer = (dialog.grade.responses ?? []).find((r) => r.key === q.key);
          return (
            <div key={q.key} className="panel" style={{ padding: 'var(--s-4)' }}>
              <b className="small">{q.prompt}</b>
              <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{answer?.text || <span className="dim">Left blank.</span>}</p>
              {q.rubric?.length ? (
                <ul className="a-problems small">{q.rubric.map((r) => <li key={r}>{r}</li>)}</ul>
              ) : null}
              <Input
                type="number"
                min="0"
                max={q.points ?? 1}
                label={`Marks out of ${q.points ?? 1}`}
                value={scores[q.key] ?? ''}
                onChange={(e) => setScores({ ...scores, [q.key]: e.target.value })}
              />
            </div>
          );
        })}
        <Textarea label="Feedback" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      </Dialog>
    );
  }

  return null;
};
