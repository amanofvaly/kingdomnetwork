import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { Checkbox, DataTable, Input, Money, Panel, RepeatableList, Stat, Switch, Textarea } from '../../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { dateShort, money } from '../../lib/format.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

export const Donations = () => {
  const { churchSlug } = useOutletContext();
  const { ok, fail } = useToast();
  const gifts = useApi(`/manage/${churchSlug}/donations`);
  const profile = useApi(`/manage/${churchSlug}/profile`);
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (profile.data?.church) setSettings(profile.data.church.donations ?? { enabled: false }); }, [profile.data]);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/manage/${churchSlug}/donations`, settings);
      ok('Saved');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  if (!settings) return <div className="console-body"><Spinner /></div>;

  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <>
      <ConsoleHeader title="Giving" sub="Gifts made through your page">
        {settings.enabled ? (
          <a className="btn btn-ghost btn-sm" href={`/give/${churchSlug}`} target="_blank" rel="noreferrer">
            View <ExternalLink size={14} strokeWidth={1.8} />
          </a>
        ) : null}
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </ConsoleHeader>

      <div className="console-body">
        {gifts.data ? (
          <div className="a-stats">
            <Stat label="Received" value={money(gifts.data.donations.reduce((n, g) => n + g.amount, 0))} foot={`${gifts.data.total} gift${gifts.data.total === 1 ? '' : 's'}`} />
            {(gifts.data.byCause ?? []).slice(0, 3).map((c) => (
              <Stat key={c._id ?? 'general'} label={c.title ?? 'General fund'} value={money(c.total)} foot={`${c.count} gift${c.count === 1 ? '' : 's'}`} />
            ))}
          </div>
        ) : null}

        <Panel title="Settings">
          <div className="a-form">
            <Switch
              label="Receive gifts through your page"
              help="Adds a donations section and a shareable link."
              checked={settings.enabled}
              onChange={(enabled) => set({ enabled })}
            />

            {settings.enabled ? (
              <>
                <Input label="Headline" value={settings.headline ?? ''} onChange={(e) => set({ headline: e.target.value })} />
                <Textarea label="Description" rows={3} value={settings.blurb ?? ''} onChange={(e) => set({ blurb: e.target.value })} />
                <div className="a-row">
                  <Input
                    label="Suggested amounts"
                    help="Comma separated, in US dollars."
                    value={(settings.suggestedAmounts ?? []).join(', ')}
                    onChange={(e) => set({ suggestedAmounts: e.target.value.split(',').map((s) => Number(s.trim())).filter(Boolean) })}
                  />
                  <Money label="Minimum donation" value={settings.minAmount ?? 5} onChange={(minAmount) => set({ minAmount })} />
                </div>
                <div className="a-row">
                  <Checkbox label="Let people enter their own amount" checked={settings.allowCustom !== false} onChange={(allowCustom) => set({ allowCustom })} />
                  <Checkbox label="Allow anonymous gifts" checked={settings.allowAnonymous !== false} onChange={(allowAnonymous) => set({ allowAnonymous })} />
                  <Checkbox
                    label="Show recent givers on the page"
                    help="Names only, where the donor agreed. Amounts are never shown."
                    checked={settings.showRecentGifts}
                    onChange={(showRecentGifts) => set({ showRecentGifts })}
                  />
                </div>
                <Textarea label="Thank-you message" rows={2} value={settings.thankYouMessage ?? ''} onChange={(e) => set({ thankYouMessage: e.target.value })} />

                <RepeatableList
                  items={settings.causes ?? []}
                  onChange={(causes) => set({ causes })}
                  makeItem={() => ({ id: `cause-${Date.now()}`, title: '', blurb: '', active: true })}
                  addLabel="Add a fund"
                  title={(c) => c.title || 'New cause'}
                  empty="Donations go to your general fund unless you add one."
                  renderItem={(cause, i, update) => (
                    <>
                      <Input label="Name" value={cause.title ?? ''} onChange={(e) => update({ ...cause, title: e.target.value })} />
                      <Textarea label="Description" rows={2} value={cause.blurb ?? ''} onChange={(e) => update({ ...cause, blurb: e.target.value })} />
                      <div className="a-row">
                        <Money label="Goal" value={cause.goalAmount} onChange={(goalAmount) => update({ ...cause, goalAmount })} />
                        <div className="a-field">
                          <label>Raised so far</label>
                          <p className="strong" style={{ margin: 0 }}>{money(cause.raisedAmount ?? 0)}</p>
                        </div>
                        <Checkbox label="Active" checked={cause.active !== false} onChange={(active) => update({ ...cause, active })} />
                      </div>
                    </>
                  )}
                />
              </>
            ) : null}
          </div>
        </Panel>

        <Panel title="Gifts received" flush>
          {gifts.loading ? <div style={{ padding: 32 }}><Spinner /></div> : null}
          {gifts.error ? <div style={{ padding: 32 }}><ErrorState error={gifts.error} onRetry={gifts.reload} /></div> : null}
          {gifts.data ? (
            <DataTable
              rows={gifts.data.donations}
              rowKey={(r) => r.reference}
              empty={{ title: 'No gifts yet', body: 'Donations appear here along with any message from the donor.' }}
              columns={[
                { key: 'giver', label: 'From', render: (r) => <span>{r.giver.name}{r.giver.country ? <span className="dim xs" style={{ display: 'block' }}>{r.giver.country}</span> : null}</span> },
                { key: 'cause', label: 'Toward', render: (r) => r.cause ?? <span className="dim">General fund</span> },
                { key: 'message', label: 'Message', render: (r) => (r.message ? <span className="small clamp-2">{r.message}</span> : <span className="dim">—</span>) },
                { key: 'completedAt', label: 'When', render: (r) => dateShort(r.completedAt) },
                { key: 'amount', label: 'Gift', align: 'right', render: (r) => money(r.amount) },
                { key: 'netToChurch', label: 'Yours', align: 'right', render: (r) => <b>{money(r.netToChurch)}</b> },
              ]}
            />
          ) : null}
        </Panel>
      </div>
    </>
  );
};
