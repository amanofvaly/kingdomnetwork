import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UserPlus } from 'lucide-react';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { Confirm, DataTable, Dialog, Input, Panel, Select, StatusPill } from '../../components/admin/kit.jsx';
import { Avatar, ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { dateShort } from '../../lib/format.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

const ROLES = [
  { value: 'owner', label: 'Owner — everything, including the team' },
  { value: 'admin', label: 'Administrator — everything but ownership' },
  { value: 'registrar', label: 'Registrar — applications and issuing' },
  { value: 'instructor', label: 'Instructor — courses and papers' },
  { value: 'finance', label: 'Finance — money and payouts' },
  { value: 'reviewer', label: 'Reviewer — reads applications, runs interviews' },
];

export const Team = () => {
  const { churchSlug } = useOutletContext();
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/team`);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [form, setForm] = useState({ email: '', role: 'registrar', title: '' });

  const invite = async () => {
    try {
      await api.post(`/manage/${churchSlug}/team`, form);
      ok('Invitation sent');
      setInviting(false);
      setForm({ email: '', role: 'registrar', title: '' });
      await reload();
    } catch (err) {
      fail(err);
    }
  };

  const changeRole = async (id, role) => {
    try {
      await api.patch(`/manage/${churchSlug}/team/${id}`, { role });
      ok('Role changed');
      await reload();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <>
      <ConsoleHeader title="Team" sub="Manage who can act for this church">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setInviting(true)}>
          <UserPlus size={15} strokeWidth={1.9} /> Invite someone
        </button>
      </ConsoleHeader>

      <div className="console-body">
        {loading ? <Spinner /> : null}
        {error ? <ErrorState error={error} onRetry={reload} /> : null}
        {data ? (
          <Panel flush>
            <DataTable
              rows={data}
              empty={{ title: 'No team members yet' }}
              columns={[
                {
                  key: 'user',
                  label: 'Person',
                  render: (r) => (
                    <span className="who">
                      <Avatar src={r.user?.avatar} name={r.user?.name ?? r.invitedEmail} />
                      <span>
                        <span className="name">{r.user?.name ?? r.invitedEmail}</span>
                        <span className="sub">{r.user?.email ?? 'Invitation not yet accepted'}</span>
                      </span>
                    </span>
                  ),
                },
                { key: 'title', label: 'Title', render: (r) => r.title ?? <span className="dim">—</span> },
                {
                  key: 'role',
                  label: 'Role',
                  render: (r) => (
                    <select className="select select-sm" value={r.role} onChange={(e) => changeRole(r.id, e.target.value)}>
                      {ROLES.map((o) => <option key={o.value} value={o.value}>{o.label.split(' — ')[0]}</option>)}
                    </select>
                  ),
                },
                { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
                { key: 'acceptedAt', label: 'Since', render: (r) => (r.acceptedAt ? dateShort(r.acceptedAt) : '—') },
                {
                  key: 'actions',
                  label: '',
                  render: (r) => (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setRemoving(r); }}>Remove</button>
                  ),
                },
              ]}
            />
          </Panel>
        ) : null}

        <Panel title="Role permissions">
          <ul className="a-problems small">
            {ROLES.map((r) => <li key={r.value}>{r.label}</li>)}
          </ul>
        </Panel>
      </div>

      <Dialog
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite someone to help"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setInviting(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={!form.email.includes('@')} onClick={invite}>Send invitation</button>
          </>
        }
      >
        <p className="muted small" style={{ marginTop: 0 }}>
          They receive an email invitation and can create an account if they need one.
        </p>
        <Input label="Email address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoFocus />
        <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={ROLES} />
        <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Dean of Studies" />
      </Dialog>

      <Confirm
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          try {
            await api.del(`/manage/${churchSlug}/team/${removing.id}`);
            ok('Removed');
            setRemoving(null);
            await reload();
          } catch (err) { fail(err); }
        }}
        title="Remove them from this church?"
        body={`${removing?.user?.name ?? removing?.invitedEmail} will lose access immediately. Their own account is untouched.`}
        confirmLabel="Remove"
      />
    </>
  );
};
