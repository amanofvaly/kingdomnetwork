import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ExternalLink } from 'lucide-react';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { DataTable, Dialog, Input, Pager, Panel, Stat, StatusPill, Switch, Textarea } from '../../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { dateShort, money } from '../../lib/format.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

/** Payment kinds are stored as keys; nobody reading a table wants to see them. */
const KIND_LABELS = {
  application_fee: 'Application fees',
  renewal_fee: 'Renewals',
  course: 'Coursework',
  resource: 'Books and materials',
  donation: 'Gifts',
};
const kindLabel = (kind) => KIND_LABELS[kind] ?? String(kind ?? '').replace(/_/g, ' ');

/* --- overview ----------------------------------------------------------- */

export const AdminOverview = () => {
  const { data, error, loading, reload } = useApi('/admin/overview');

  if (loading) return <div className="console-body"><Spinner /></div>;
  if (error) return <div className="console-body"><ErrorState error={error} onRetry={reload} /></div>;

  const { counts, platformFeesLast30Days, owedToChurches, totalOwed, revenueLast30Days } = data;

  return (
    <>
      <ConsoleHeader title="Dashboard" sub="Across every church" />
      <div className="console-body">
        <div className="a-stats">
          <Stat label="Churches" value={counts.churches} foot={`${counts.published} published${counts.demoChurches ? ` · ${counts.demoChurches} sample` : ''}`} />
          <Stat label="Awaiting verification" value={counts.pendingVerification} alert={counts.pendingVerification > 0} foot="Documents to check" />
          <Stat label="People" value={counts.users} />
          <Stat label="Applications" value={counts.applicationsLast30Days} foot="Started in the last 30 days" />
          <Stat label="Credentials issued" value={counts.issued} foot="In total" />
          <Stat label="Platform fees" value={money(platformFeesLast30Days)} foot="Last 30 days" />
          <Stat label="Owed to churches" value={money(totalOwed)} alert={totalOwed > 0} foot="Not yet settled" />
        </div>

        <Panel title="Outstanding balances" action={<Link className="link small" to="/admin/settlements">Settle</Link>}>
          <DataTable
            rows={owedToChurches}
            rowKey={(r) => r._id}
            empty={{ title: 'Nothing outstanding', body: 'Every completed payment has been settled.' }}
            columns={[
              { key: '_id', label: 'Church' },
              { key: 'count', label: 'Payments', align: 'right' },
              { key: 'net', label: 'Owed', align: 'right', render: (r) => <b>{money(r.net)}</b> },
            ]}
          />
        </Panel>

        <Panel title="Revenue, last 30 days">
          <DataTable
            rows={revenueLast30Days}
            rowKey={(r) => r._id}
            empty={{ title: 'Nothing yet' }}
            columns={[
              { key: '_id', label: 'Type', render: (r) => kindLabel(r._id) },
              { key: 'count', label: 'Payments', align: 'right' },
              { key: 'gross', label: 'Gross', align: 'right', render: (r) => money(r.gross) },
              { key: 'fees', label: 'Platform fee', align: 'right', render: (r) => <b>{money(r.fees)}</b> },
            ]}
          />
        </Panel>
      </div>
    </>
  );
};

/* --- churches ----------------------------------------------------------- */

export const AdminChurches = () => {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const q = params.get('q') ?? '';
  const demo = params.get('demo') ?? '';

  const { data, error, loading, reload } = useApi(`/admin/churches?${new URLSearchParams({ page: String(page), ...(q ? { q } : {}), ...(demo ? { demo } : {}) })}`);

  return (
    <>
      <ConsoleHeader title="Churches" sub={data ? `${data.total}` : ''} />
      <div className="console-body">
        <Panel flush>
          <div className="a-toolbar">
            <input
              className="input grow"
              placeholder="Search by name, address or country"
              defaultValue={q}
              onKeyDown={(e) => e.key === 'Enter' && setParams({ q: e.currentTarget.value, ...(demo ? { demo } : {}) })}
            />
            <select className="select select-sm" value={demo} onChange={(e) => setParams({ ...(q ? { q } : {}), demo: e.target.value })}>
              <option value="">Everything</option>
              <option value="false">Real churches</option>
              <option value="true">Sample content</option>
            </select>
          </div>

          {loading ? <div style={{ padding: 32 }}><Spinner /></div> : null}
          {error ? <div style={{ padding: 32 }}><ErrorState error={error} onRetry={reload} /></div> : null}

          {data ? (
            <>
              <DataTable
                rows={data.churches}
                rowKey={(r) => r.slug}
                empty={{ title: 'No matching churches' }}
                columns={[
                  {
                    key: 'name',
                    label: 'Church',
                    render: (r) => (
                      <span>
                        <span className="name" style={{ fontWeight: 500 }}>{r.name}</span>
                        <span className="sub dim xs" style={{ display: 'block' }}>{[r.city, r.country].filter(Boolean).join(', ')}</span>
                      </span>
                    ),
                  },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                  { key: 'verification', label: 'Verified', render: (r) => <StatusPill status={r.verification?.state ?? 'unverified'} /> },
                  { key: 'offeringCount', label: 'Listings', align: 'right' },
                  { key: 'applicationCount', label: 'Applications', align: 'right' },
                  { key: 'demo', label: '', render: (r) => (r.demo ? <span className="pill pill-neutral">Sample</span> : null) },
                  {
                    key: 'actions',
                    label: '',
                    render: (r) => (
                      <span className="row" style={{ gap: 6 }}>
                        <Link className="btn btn-ghost btn-sm" to={`/manage/${r.slug}`}>Console</Link>
                        <a className="btn btn-ghost btn-sm" href={`/churches/${r.slug}`} target="_blank" rel="noreferrer">
                          <ExternalLink size={13} strokeWidth={1.8} />
                        </a>
                      </span>
                    ),
                  },
                ]}
              />
              <div style={{ padding: 'var(--s-4)' }}><Pager page={data.page} pages={data.pages} onPage={setPage} /></div>
            </>
          ) : null}
        </Panel>
      </div>
    </>
  );
};

/* --- verification ------------------------------------------------------- */

export const AdminVerification = () => {
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi('/admin/verification');
  const [deciding, setDeciding] = useState(null);
  const [notes, setNotes] = useState('');

  const decide = async (state) => {
    try {
      await api.post(`/admin/verification/${deciding.slug}`, { state, notes });
      ok(state === 'verified' ? 'Verified' : 'Rejected');
      setDeciding(null);
      setNotes('');
      await reload();
    } catch (err) { fail(err); }
  };

  return (
    <>
      <ConsoleHeader title="Verification" sub="Churches awaiting verification" />
      <div className="console-body">
        {loading ? <Spinner /> : null}
        {error ? <ErrorState error={error} onRetry={reload} /> : null}

        {data && !data.length ? (
          <div className="a-empty">
            <h3>Nothing to review</h3>
            <p className="muted small" style={{ maxWidth: 460 }}>
              Confirms we have checked the church's registration documents. Grants no additional permissions.
            </p>
          </div>
        ) : null}

        {(data ?? []).map((church) => (
          <Panel
            key={church.slug}
            title={church.name}
            action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setDeciding(church)}>Review</button>}
          >
            <dl className="a-kv">
              <dt>Where</dt><dd>{[church.city, church.country].filter(Boolean).join(', ')}</dd>
              <dt>Registered as</dt><dd>{church.legal?.registeredName ?? <span className="dim">Not given</span>}</dd>
              <dt>Registration number</dt><dd>{church.legal?.registrationNumber ?? <span className="dim">Not given</span>}</dd>
              <dt>Contact</dt><dd>{church.contact?.email ?? '—'}</dd>
              <dt>Website</dt><dd>{church.website ?? <span className="dim">None</span>}</dd>
              <dt>Asked on</dt><dd>{dateShort(church.verification?.submittedAt)}</dd>
            </dl>

            <div className="stack stack-2" style={{ marginTop: 16 }}>
              {(church.verification?.documents ?? []).map((doc, i) => (
                <div key={i} className="row row-between panel" style={{ padding: '8px 12px' }}>
                  <span className="small">{doc.label} — {doc.filename ?? 'file'}</span>
                  {doc.url ? <a className="btn btn-ghost btn-sm" href={doc.url} target="_blank" rel="noreferrer">Open</a> : null}
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      <Dialog
        open={Boolean(deciding)}
        onClose={() => setDeciding(null)}
        title={`Verify ${deciding?.name ?? ''}?`}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDeciding(null)}>Cancel</button>
            <button type="button" className="btn btn-outline" disabled={!notes.trim()} onClick={() => decide('rejected')}>Reject</button>
            <button type="button" className="btn btn-primary" onClick={() => decide('verified')}>Grant the badge</button>
          </>
        }
      >
        <p className="muted small" style={{ marginTop: 0 }}>
          Rejecting requires a reason the church can act on.
        </p>
        <Textarea label="Notes to the church" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Dialog>
    </>
  );
};

/* --- people ------------------------------------------------------------- */

export const AdminUsers = () => {
  const { ok, fail } = useToast();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const q = params.get('q') ?? '';
  const { data, error, loading, reload } = useApi(`/admin/users?${new URLSearchParams({ page: String(page), ...(q ? { q } : {}) })}`);

  const update = async (id, patch) => {
    try {
      await api.patch(`/admin/users/${id}`, patch);
      ok('Updated');
      await reload();
    } catch (err) { fail(err); }
  };

  return (
    <>
      <ConsoleHeader title="People" sub={data ? `${data.total} accounts` : ''} />
      <div className="console-body">
        <Panel flush>
          <div className="a-toolbar">
            <input className="input grow" placeholder="Search by name or email" defaultValue={q} onKeyDown={(e) => e.key === 'Enter' && setParams({ q: e.currentTarget.value })} />
          </div>
          {loading ? <div style={{ padding: 32 }}><Spinner /></div> : null}
          {error ? <div style={{ padding: 32 }}><ErrorState error={error} onRetry={reload} /></div> : null}
          {data ? (
            <>
              <DataTable
                rows={data.users}
                rowKey={(r) => r._id}
                empty={{ title: 'No matching accounts' }}
                columns={[
                  { key: 'name', label: 'Person', render: (r) => <span><span className="name" style={{ fontWeight: 500 }}>{r.name}</span><span className="sub dim xs" style={{ display: 'block' }}>{r.email}</span></span> },
                  { key: 'role', label: 'Platform role', render: (r) => <StatusPill status={r.role === 'platform_admin' ? 'active' : 'draft'} label={r.role === 'platform_admin' ? 'Administrator' : 'Member'} /> },
                  { key: 'memberships', label: 'Churches', render: (r) => (r.memberships?.length ? r.memberships.map((m) => `${m.churchSlug} (${m.role})`).join(', ') : <span className="dim">—</span>) },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                  { key: 'lastLoginAt', label: 'Last seen', render: (r) => (r.lastLoginAt ? dateShort(r.lastLoginAt) : <span className="dim">Never</span>) },
                  {
                    key: 'actions',
                    label: '',
                    render: (r) => (
                      <span className="row" style={{ gap: 6 }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => update(r._id, { role: r.role === 'platform_admin' ? 'member' : 'platform_admin' })}>
                          {r.role === 'platform_admin' ? 'Demote' : 'Make admin'}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => update(r._id, { status: r.status === 'suspended' ? 'active' : 'suspended' })}>
                          {r.status === 'suspended' ? 'Restore' : 'Suspend'}
                        </button>
                      </span>
                    ),
                  },
                ]}
              />
              <div style={{ padding: 'var(--s-4)' }}><Pager page={data.page} pages={data.pages} onPage={setPage} /></div>
            </>
          ) : null}
        </Panel>
      </div>
    </>
  );
};

/* --- payments and settlements ------------------------------------------- */

export const AdminPayments = () => {
  const [page, setPage] = useState(1);
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const { data, error, loading, reload } = useApi(`/admin/payments?${new URLSearchParams({ page: String(page), ...(status ? { status } : {}) })}`);

  return (
    <>
      <ConsoleHeader title="Payments" sub={data ? `${data.total}` : ''} />
      <div className="console-body">
        {data ? (
          <div className="a-stats">
            <Stat label="Gross" value={money(data.totals.gross)} />
            <Stat label="Platform fees" value={money(data.totals.fees)} />
            <Stat label="To churches" value={money(data.totals.net)} />
          </div>
        ) : null}

        <Panel flush>
          <div className="a-toolbar">
            <select className="select select-sm" value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}>
              <option value="">Every status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          {loading ? <div style={{ padding: 32 }}><Spinner /></div> : null}
          {error ? <div style={{ padding: 32 }}><ErrorState error={error} onRetry={reload} /></div> : null}
          {data ? (
            <>
              <DataTable
                rows={data.payments}
                rowKey={(r) => r.reference}
                empty={{ title: 'No payments' }}
                columns={[
                  { key: 'reference', label: 'Reference', render: (r) => <code className="small">{r.reference}</code> },
                  { key: 'churchSlug', label: 'Church' },
                  { key: 'kind', label: 'Type', render: (r) => <span className="small">{kindLabel(r.kind)}</span> },
                  { key: 'payer', label: 'From', render: (r) => r.payer?.name ?? r.payer?.email ?? '—' },
                  { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
                  { key: 'platformFee', label: 'Fee', align: 'right', render: (r) => money(r.platformFee) },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                  { key: 'settlementRef', label: 'Settled', render: (r) => (r.settlementRef ? <code className="small">{r.settlementRef}</code> : <span className="dim">Not yet</span>) },
                ]}
              />
              <div style={{ padding: 'var(--s-4)' }}><Pager page={data.page} pages={data.pages} onPage={setPage} /></div>
            </>
          ) : null}
        </Panel>
      </div>
    </>
  );
};

export const AdminSettlements = () => {
  const { ok, fail } = useToast();
  const owed = useApi('/admin/owed');
  const settlements = useApi('/admin/settlements');
  const [paying, setPaying] = useState(null);
  const [form, setForm] = useState({ externalRef: '', notes: '' });
  const [busy, setBusy] = useState(false);

  const prepare = async (churchSlug) => {
    try {
      await api.post('/admin/settlements', { churchSlug });
      ok('Payout run prepared');
      await Promise.all([owed.reload(), settlements.reload()]);
    } catch (err) { fail(err); }
  };

  const markPaid = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/settlements/${paying.reference}/paid`, form);
      ok('Recorded as paid');
      setPaying(null);
      setForm({ externalRef: '', notes: '' });
      await Promise.all([owed.reload(), settlements.reload()]);
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  return (
    <>
      <ConsoleHeader title="Settlements" sub="What churches are owed, and what has been sent" />
      <div className="console-body">
        <Panel title="Outstanding balances" flush>
          {owed.loading ? <div style={{ padding: 32 }}><Spinner /></div> : null}
          {owed.data ? (
            <DataTable
              rows={owed.data}
              rowKey={(r) => r.churchSlug}
              empty={{ title: 'Nothing outstanding', body: 'Every completed payment has been settled.' }}
              columns={[
                { key: 'church', label: 'Church', render: (r) => r.church?.name ?? r.churchSlug },
                { key: 'count', label: 'Payments', align: 'right' },
                { key: 'gross', label: 'Gross', align: 'right', render: (r) => money(r.gross) },
                { key: 'fees', label: 'Fee kept', align: 'right', render: (r) => money(r.fees) },
                { key: 'net', label: 'Owed', align: 'right', render: (r) => <b>{money(r.net)}</b> },
                { key: 'oldest', label: 'Oldest', render: (r) => dateShort(r.oldest) },
                {
                  key: 'actions',
                  label: '',
                  render: (r) => (
                    r.payable ? (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => prepare(r.churchSlug)}>Prepare payout</button>
                    ) : (
                      <span className="pill pill-wait" title="This church has not given payout details">
                        <AlertTriangle size={11} strokeWidth={2} /> No account
                      </span>
                    )
                  ),
                },
              ]}
            />
          ) : null}
        </Panel>

        <Panel title="Payout runs" flush>
          {settlements.data ? (
            <DataTable
              rows={settlements.data}
              rowKey={(r) => r.reference}
              empty={{ title: 'No payouts yet' }}
              columns={[
                { key: 'reference', label: 'Reference', render: (r) => <code className="small">{r.reference}</code> },
                { key: 'church', label: 'Church', render: (r) => r.church?.name ?? r.churchSlug },
                { key: 'paymentCount', label: 'Payments', align: 'right' },
                { key: 'net', label: 'Amount', align: 'right', render: (r) => <b>{money(r.net)}</b> },
                { key: 'destination', label: 'To', render: (r) => <span className="small">{r.method} {r.destination}</span> },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                { key: 'externalRef', label: 'Transfer', render: (r) => r.externalRef ?? <span className="dim">—</span> },
                {
                  key: 'actions',
                  label: '',
                  render: (r) => (
                    r.status === 'pending' ? (
                      <span className="row" style={{ gap: 6 }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setPaying(r)}>Mark paid</button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            try { await api.post(`/admin/settlements/${r.reference}/cancel`); ok('Cancelled'); await Promise.all([owed.reload(), settlements.reload()]); }
                            catch (err) { fail(err); }
                          }}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : null
                  ),
                },
              ]}
            />
          ) : null}
        </Panel>
      </div>

      <Dialog
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        title={`Record the payout to ${paying?.church?.name ?? ''}`}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setPaying(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy || !form.externalRef.trim()} onClick={markPaid}>
              {busy ? 'Recording…' : 'Mark as paid'}
            </button>
          </>
        }
      >
        <p className="muted small" style={{ marginTop: 0 }}>
          Transfer {money(paying?.net ?? 0)} to {paying?.destination}, then record it here.
        </p>
        <Input label="Transfer reference" help="Required, so this can be traced later." value={form.externalRef} onChange={(e) => setForm({ ...form, externalRef: e.target.value })} autoFocus />
        <Textarea label="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Dialog>
    </>
  );
};

/* --- settings and audit -------------------------------------------------- */

export const AdminSettings = () => {
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi('/admin/settings');

  // Each control writes on blur and the panel re-reads, so there is no draft to
  // hold: nothing here is a multi-field form where a half-saved state matters.
  const save = async (patch) => {
    try {
      await api.patch('/admin/settings', patch);
      ok('Saved');
      await reload();
    } catch (err) { fail(err); }
  };

  if (loading || !data) return <div className="console-body"><Spinner /></div>;
  if (error) return <div className="console-body"><ErrorState error={error} onRetry={reload} /></div>;

  return (
    <>
      <ConsoleHeader title="Platform settings" />
      <div className="console-body">
        <Panel title="Commission">
          <p className="muted small" style={{ marginTop: 0 }}>
            The percentage retained from every payment before settling with a church. It is frozen onto each payment
            as it completes, so changing it never alters what a church was already owed.
          </p>
          <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
            <Input
              label="Percent"
              type="number"
              min="0"
              max="50"
              defaultValue={data.commissionPercent}
              onBlur={(e) => save({ commissionPercent: Number(e.target.value) })}
            />
          </div>
        </Panel>

        <Panel title="Sample content">
          <Switch
            label="Show sample content"
            help="Sample churches and listings. Turning this off hides them from every public page."
            checked={data.demoMode !== false}
            onChange={(demoMode) => save({ demoMode })}
          />
        </Panel>

        <Panel title="Payments">
          <dl className="a-kv">
            <dt>Gateway</dt>
            <dd>
              {data.pesapal?.configured ? 'Pesapal' : 'The local development gateway'}
              {data.pesapal?.configured ? null : <span className="dim small" style={{ display: 'block' }}>No Pesapal credentials configured. Payments are simulated.</span>}
            </dd>
            <dt>Notification URL</dt><dd>{data.pesapal?.ipnUrl ?? <span className="dim">Not registered</span>}</dd>
            <dt>Notification id</dt><dd>{data.pesapal?.ipnId ? <code className="small">{data.pesapal.ipnId}</code> : <span className="dim">—</span>}</dd>
          </dl>
        </Panel>
      </div>
    </>
  );
};

export const AdminAudit = () => {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(`/admin/audit?page=${page}`);

  return (
    <>
      <ConsoleHeader title="Audit trail" sub="Who did what, and when" />
      <div className="console-body">
        <Panel flush>
          {loading ? <div style={{ padding: 32 }}><Spinner /></div> : null}
          {error ? <div style={{ padding: 32 }}><ErrorState error={error} onRetry={reload} /></div> : null}
          {data ? (
            <>
              <DataTable
                rows={data.entries}
                rowKey={(r) => r._id}
                empty={{ title: 'Nothing recorded yet' }}
                columns={[
                  { key: 'createdAt', label: 'When', render: (r) => new Date(r.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) },
                  { key: 'action', label: 'Description', render: (r) => <code className="small">{r.action}</code> },
                  { key: 'actorId', label: 'Who', render: (r) => r.actorId?.name ?? r.actorRole ?? 'system' },
                  { key: 'churchSlug', label: 'Church', render: (r) => r.churchSlug ?? <span className="dim">—</span> },
                  { key: 'note', label: 'Note', render: (r) => <span className="small clamp-1">{r.note ?? ''}</span> },
                ]}
              />
              <div style={{ padding: 'var(--s-4)' }}><Pager page={data.page} pages={data.pages} onPage={setPage} /></div>
            </>
          ) : null}
        </Panel>
      </div>
    </>
  );
};

export const AdminApplications = () => {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(`/admin/applications?page=${page}`);

  return (
    <>
      <ConsoleHeader title="Applications" sub="Across every church" />
      <div className="console-body">
        <Panel flush>
          {loading ? <div style={{ padding: 32 }}><Spinner /></div> : null}
          {error ? <div style={{ padding: 32 }}><ErrorState error={error} onRetry={reload} /></div> : null}
          {data ? (
            <>
              <DataTable
                rows={data.applications}
                rowKey={(r) => r.reference}
                empty={{ title: 'No applications yet' }}
                columns={[
                  { key: 'reference', label: 'Reference', render: (r) => <code className="small">{r.reference}</code> },
                  { key: 'userId', label: 'Applicant', render: (r) => r.userId?.name ?? '—' },
                  { key: 'churchSlug', label: 'Church' },
                  { key: 'offeringTitle', label: 'For' },
                  { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                  { key: 'submittedAt', label: 'Submitted', render: (r) => (r.submittedAt ? dateShort(r.submittedAt) : '—') },
                ]}
              />
              <div style={{ padding: 'var(--s-4)' }}><Pager page={data.page} pages={data.pages} onPage={setPage} /></div>
            </>
          ) : null}
        </Panel>
      </div>
    </>
  );
};

/* --- merchandising ------------------------------------------------------- */

export const AdminMerchandising = () => {
  const { ok, fail } = useToast();
  const [q, setQ] = useState('');
  const { data, error, loading } = useApi(`/search?limit=40${q ? `&q=${encodeURIComponent(q)}` : ''}`);

  const set = async (slug, patch) => {
    try {
      await api.post(`/admin/offerings/${slug}/merchandising`, patch);
      ok('Updated');
    } catch (err) { fail(err); }
  };

  return (
    <>
      <ConsoleHeader title="Merchandising" sub="Promoted listings across the network" />
      <div className="console-body">
        <div className="notice">
          <strong>Not applied to credentials.</strong> Discounts and badges are removed from ordinations,
          licences, certificates and diplomas, whatever is set here.
        </div>
        <Panel flush>
          <div className="a-toolbar">
            <input className="input grow" placeholder="Search listings" onKeyDown={(e) => e.key === 'Enter' && setQ(e.currentTarget.value)} />
          </div>
          {loading ? <div style={{ padding: 32 }}><Spinner /></div> : null}
          {error ? <div style={{ padding: 32 }}><ErrorState error={error} /></div> : null}
          {data ? (
            <DataTable
              rows={data.offerings}
              rowKey={(r) => r.slug}
              empty={{ title: 'Nothing matches' }}
              columns={[
                { key: 'title', label: 'Listing', render: (r) => <span>{r.title}<span className="dim xs" style={{ display: 'block' }}>{r.church?.shortName ?? r.churchSlug}</span></span> },
                { key: 'type', label: 'Kind', render: (r) => <span className="small dim">{r.type}</span> },
                { key: 'featured', label: 'Featured', render: (r) => <input type="checkbox" defaultChecked={r.featured} onChange={(e) => set(r.slug, { featured: e.target.checked })} /> },
                { key: 'editorsPick', label: "Editors' pick", render: (r) => <input type="checkbox" defaultChecked={r.editorsPick} onChange={(e) => set(r.slug, { editorsPick: e.target.checked })} /> },
                { key: 'boost', label: 'Boost', align: 'right', render: (r) => <input className="input" type="number" min="0" max="100" style={{ width: 72 }} defaultValue={r.boost ?? 0} onBlur={(e) => set(r.slug, { boost: Number(e.target.value) })} /> },
              ]}
            />
          ) : null}
        </Panel>
      </div>
    </>
  );
};
