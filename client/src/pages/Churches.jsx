import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';

import { ChurchCard } from '../components/cards.jsx';
import { Empty, ErrorState, SkeletonGrid } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { plural } from '../lib/format.js';

export const Churches = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const region = params.get('region') ?? '';

  const sp = new URLSearchParams();
  if (q) sp.set('q', q);
  if (region) sp.set('region', region);
  const { data, error, loading, reload } = useApi(`/churches?${sp}`);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setParams(next, { replace: true });
  };

  return (
    <>
      <section className="band-warm" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ paddingBlock: 'var(--s-7)' }}>
          <div className="stack stack-5">
            <div className="stack stack-3" style={{ maxWidth: '60ch' }}>
              <h1 style={{ fontSize: 'clamp(2rem, 3.6vw, 2.9rem)' }}>Churches</h1>
              <p className="lede">
                Browse the directory of churches and ministries.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap band-tight stack stack-5">
        <div className="results-bar">
          <div className="row-wrap" style={{ gap: 8 }}>
            <button type="button" className={`chip ${!region ? 'is-on' : ''}`} onClick={() => update({ region: '' })}>All regions</button>
            {(data?.regions ?? []).map((r) => (
              <button key={r.value} type="button" className={`chip ${region === r.value ? 'is-on' : ''}`} onClick={() => update({ region: r.value })}>
                {r.value} <span className="xs dim">{r.count}</span>
              </button>
            ))}
          </div>
          {q && (
            <button type="button" className="pill-clear" onClick={() => update({ q: '' })}>
              “{q}” <X size={12} />
            </button>
          )}
        </div>

        {error ? <ErrorState error={error} onRetry={reload} />
          : loading ? <SkeletonGrid count={8} />
          : data.churches.length === 0 ? (
            <Empty title="No churches matched" action={<button type="button" className="btn btn-outline btn-sm" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}>
              Try a different search term or region.
            </Empty>
          ) : (
            <>
              <span className="small muted num">{plural(data.churches.length, 'church', 'churches')}</span>
              <div className="grid grid-4 church-directory-grid">
                {data.churches.map((c) => <ChurchCard key={c.slug} church={c} />)}
              </div>
            </>
          )}
      </div>
    </>
  );
};
