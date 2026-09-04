import { useOutletContext } from 'react-router-dom';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { DataTable, Panel, StatusPill } from '../../components/admin/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { dateShort } from '../../lib/format.js';
import { useApi } from '../../lib/useAsync.js';

/** Everything this church has issued, and to whom. */
export const Issued = () => {
  const { churchSlug } = useOutletContext();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/applicants?status=issued&limit=100`);

  return (
    <>
      <ConsoleHeader title="Issued" sub={data ? `${data.total} credential${data.total === 1 ? '' : 's'}` : ''} />
      <div className="console-body">
        {loading ? <Spinner /> : null}
        {error ? <ErrorState error={error} onRetry={reload} /> : null}
        {data ? (
          <Panel flush>
            <DataTable
              rows={data.applications}
              rowKey={(r) => r.reference}
              empty={{
                title: 'Nothing issued yet',
                body: 'Every credential you issue is listed here with its identifier.',
              }}
              columns={[
                { key: 'applicant', label: 'Holder', render: (r) => r.applicant?.name ?? '—' },
                { key: 'offeringTitle', label: 'Credential' },
                { key: 'credentialId', label: 'Identifier', render: (r) => <code className="small">{r.credentialId}</code> },
                { key: 'updatedAt', label: 'Issued', render: (r) => dateShort(r.updatedAt) },
                { key: 'status', label: '', render: (r) => <StatusPill status={r.status} /> },
              ]}
            />
          </Panel>
        ) : null}
      </div>
    </>
  );
};
