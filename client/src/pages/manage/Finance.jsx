import { useOutletContext } from 'react-router-dom';
import { Link } from 'react-router-dom';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { DataTable, Panel, Stat, StatusPill } from '../../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { dateShort, money } from '../../lib/format.js';
import { useApi } from '../../lib/useAsync.js';

const KIND_LABELS = {
  application_fee: 'Application fee',
  renewal_fee: 'Renewal',
  course: 'Coursework',
  resource: 'Materials',
  donation: 'Gift',
};

export const Finance = () => {
  const { churchSlug } = useOutletContext();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/finance`);
  const ledger = useApi(`/manage/${churchSlug}/finance/ledger`);

  if (loading) return <div className="console-body"><Spinner /></div>;
  if (error) return <div className="console-body"><ErrorState error={error} onRetry={reload} /></div>;

  return (
    <>
      <ConsoleHeader title="Finance" sub={`Kingdom Network keeps ${data.commissionPercent}% of what comes in`} />

      <div className="console-body">
        <div className="a-stats">
          <Stat label="Owed to you" value={money(data.balance)} foot="Not yet settled" alert={data.balance > 0} />
          <Stat label="Waiting to settle" value={data.unsettled.count} foot={`${money(data.unsettled.net)} across those payments`} />
          {data.totals.map((t) => (
            <Stat key={t._id} label={KIND_LABELS[t._id] ?? t._id} value={money(t.net)} foot={`${t.count} payment${t.count === 1 ? '' : 's'} · ${money(t.fees)} fee`} />
          ))}
        </div>

        {!data.payout?.accountRefMasked ? (
          <div className="notice notice-gold">
            <strong>Payout details missing</strong>{' '}
            Add the account money should reach in <Link to={`/manage/${churchSlug}/settings`}>your settings</Link>.
          </div>
        ) : (
          <div className="notice">
            <strong>Paid to {data.payout.accountName}</strong> · {data.payout.method} {data.payout.accountRefMasked}
          </div>
        )}

        <Panel title="Recent payments" flush>
          <DataTable
            rows={data.recent}
            rowKey={(r) => r.reference}
            empty={{ title: 'Nothing received yet', body: 'Application fees, course sales and donations appear here once they clear.' }}
            columns={[
              { key: 'kind', label: 'Description', render: (r) => <span>{KIND_LABELS[r.kind] ?? r.kind}<span className="dim xs" style={{ display: 'block' }}>{r.description}</span></span> },
              { key: 'payer', label: 'From', render: (r) => r.payer?.name ?? '—' },
              { key: 'completedAt', label: 'When', render: (r) => dateShort(r.completedAt) },
              { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
              { key: 'platformFee', label: 'Fee', align: 'right', render: (r) => <span className="dim">−{money(r.platformFee)}</span> },
              { key: 'netToChurch', label: 'Yours', align: 'right', render: (r) => <b>{money(r.netToChurch)}</b> },
              { key: 'settled', label: '', render: (r) => (r.settled ? <StatusPill status="paid" label="Settled" /> : <StatusPill status="pending" label="Owed" />) },
            ]}
          />
        </Panel>

        <Panel title="Payouts" flush>
          <DataTable
            rows={data.settlements}
            rowKey={(r) => r.reference}
            empty={{ title: 'No payouts yet', body: 'Each payout is recorded here with its transfer reference.' }}
            columns={[
              { key: 'reference', label: 'Reference' },
              { key: 'paymentCount', label: 'Payments', align: 'right' },
              { key: 'gross', label: 'Gross', align: 'right', render: (r) => money(r.gross) },
              { key: 'platformFee', label: 'Fee', align: 'right', render: (r) => <span className="dim">−{money(r.platformFee)}</span> },
              { key: 'net', label: 'Paid', align: 'right', render: (r) => <b>{money(r.net)}</b> },
              { key: 'externalRef', label: 'Transfer', render: (r) => r.externalRef ?? '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
            ]}
          />
        </Panel>

        <Panel title="Transaction history" flush>
          {ledger.data ? (
            <DataTable
              rows={ledger.data.entries}
              rowKey={(r) => r._id}
              empty={{ title: 'Nothing recorded yet' }}
              columns={[
                { key: 'createdAt', label: 'When', render: (r) => dateShort(r.createdAt) },
                { key: 'description', label: 'Description' },
                { key: 'type', label: 'Kind', render: (r) => <span className="dim small">{r.type}</span> },
                { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className={`a-money ${r.amount < 0 ? 'is-negative' : ''}`}>{r.amount < 0 ? '−' : ''}{money(Math.abs(r.amount))}</span> },
                { key: 'balanceAfter', label: 'Balance', align: 'right', render: (r) => <b className="a-money">{money(r.balanceAfter)}</b> },
              ]}
            />
          ) : <div style={{ padding: 32 }}><Spinner /></div>}
        </Panel>
      </div>
    </>
  );
};
