import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BadgeCheck, Check, SlidersHorizontal, X } from 'lucide-react';

import { ACQUISITION, OfferingCard } from '../components/market.jsx';
import { MaterialCard } from '../components/cards.jsx';
import { FilterSheet } from '../components/FilterSheet.jsx';
import { ChurchMark, Empty, ErrorState, SkeletonGrid } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { plural } from '../lib/format.js';

const SORTS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'issued', label: 'Most issued' },
];

export const Search = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';

  /**
   * Credentials and materials are counted apart because they are different
   * kinds of thing — but a bare "0 listings" printed above a book someone can
   * plainly see is not a count, it is a contradiction.
   */
  const found = (data) => [
    plural(data?.total ?? 0, 'listing'),
    data?.materials?.length ? plural(data.materials.length, 'material') : null,
  ].filter(Boolean).join(' and ');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useMemo(() => `/search?${new URLSearchParams(params)}`, [params]);
  const { data, error, loading, reload } = useApi(query);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  const toggle = (key, value) => update({ [key]: params.get(key) === value ? '' : value });

  const Facet = ({ on, label, count, onToggle }) => (
    <button type="button" className={`filter-item ${on ? 'is-on' : ''}`} onClick={onToggle} aria-pressed={on}>
      <span className="box">{on && <Check size={12} strokeWidth={3} />}</span>
      <span className="grow clamp-1">{label}</span>
      {count != null && <span className="n">{count}</span>}
    </button>
  );

  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const page = Number(params.get('page') ?? 1);

  return (
    <>
      <div className="band-warm" style={{ borderBottom: '1px solid var(--line)', paddingBlock: 'var(--s-6)' }}>
        <div className="wrap stack stack-2">
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>{q ? `“${q}”` : 'Browse everything'}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {loading ? 'Searching…' : `${found(data)} from churches worldwide`}
          </p>
        </div>
      </div>

      <div className="wrap band-tight">
        <div className="catalogue">
          <FilterSheet
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            onClear={() => setParams({}, { replace: true })}
          >
            <div className="filter-group" style={{ borderTop: 'none', paddingTop: 0 }}>
              <h5>Service or outcome</h5>
              <div className="filter-list">
                {(data?.facets.outcomes ?? []).map((f) => (
                  <Facet key={f.value} label={f.label} count={f.count}
                    on={params.get('outcome') === f.value} onToggle={() => toggle('outcome', f.value)} />
                ))}
              </div>
            </div>
            <div className="filter-group">
              <h5>How it is issued</h5>
              <div className="filter-list">
                {(data?.facets.acquisition ?? []).map((f) => (
                  <Facet key={f.value} label={ACQUISITION[f.value]?.label ?? f.value} count={f.count}
                    on={params.get('acquisition') === f.value} onToggle={() => toggle('acquisition', f.value)} />
                ))}
              </div>
            </div>
            <div className="filter-group">
              <h5>Issuing church</h5>
              <div className="filter-list">
                {(data?.facets.churches ?? []).map((f) => (
                  <Facet key={f.value} label={f.label} count={f.count}
                    on={params.get('church') === f.value} onToggle={() => toggle('church', f.value)} />
                ))}
              </div>
            </div>
          </FilterSheet>

          <div className="stack stack-5">
            {data?.churches?.length > 0 && (
              <div className="panel panel-warm stack stack-3">
                <h5>Churches matching “{q}”</h5>
                <div className="church-strip">
                  {data.churches.map((c) => (
                    <Link key={c.slug} to={`/churches/${c.slug}`} className="church-chip">
                      <ChurchMark church={c} />
                      <span>
                        <span className="small strong clamp-1" style={{ display: 'block' }}>{c.shortName ?? c.name}</span>
                        <span className="xs dim row" style={{ gap: 4 }}>
                          {c.city}, {c.country}
                          {c.verified && <BadgeCheck size={11} style={{ color: 'var(--blue-600)' }} />}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="results-bar">
              <button type="button" className="btn btn-outline btn-sm filters-toggle"
                onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen}>
                <SlidersHorizontal size={15} /> Filters
              </button>
              <span className="small muted num results-count">
                {loading ? '\u00a0' : found(data)}
              </span>
              <label className="row small muted sort-control" style={{ gap: 8 }}>
                <span className="wide-only">Sort</span>
                <select className="select select-sm"
                  value={params.get('sort') ?? 'recommended'} onChange={(e) => update({ sort: e.target.value })}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <div className="active-filters">
                {['outcome', 'acquisition', 'church', 'q'].map((k) => params.get(k) && (
                  <button key={k} type="button" className="pill-clear" onClick={() => update({ [k]: '' })}>
                    {k === 'q' ? `“${params.get(k)}”` : params.get(k)} <X size={12} />
                  </button>
                ))}
              </div>
            </div>

            {loading ? <SkeletonGrid count={9} cols="grid-3" />
              : data.offerings.length === 0 && !data.materials?.length ? (
                <Empty title="Nothing matched"
                  action={<button type="button" className="btn btn-outline btn-sm" onClick={() => setParams({}, { replace: true })}>Clear everything</button>}>
                  Try a different term, or clear the filters.
                </Empty>
              ) : (
                <>
                  <div className="grid grid-3">
                    {data.offerings.map((o) => <OfferingCard key={o.slug} offering={o} />)}
                  </div>
                  {data.pages > 1 && (
                    <nav className="pager" aria-label="Pagination">
                      <button type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button>
                      {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" className={n === page ? 'is-on' : ''} onClick={() => update({ page: String(n) })}>{n}</button>
                      ))}
                      <button type="button" disabled={page >= data.pages} onClick={() => update({ page: String(page + 1) })}>Next</button>
                    </nav>
                  )}

                  {/* Their own group, not rows among the credentials: standing
                      is what this platform is for, and a book should not
                      compete with an ordination for the same line. */}
                  {data.materials?.length ? (
                    <section className="stack stack-4" style={{ marginTop: 'var(--s-7)' }}>
                      <div className="row row-between">
                        <h2>Books and materials</h2>
                        <Link className="link small" to={`/learning?q=${encodeURIComponent(q)}`}>
                          All learning for “{q}” →
                        </Link>
                      </div>
                      <div className="grid grid-3">
                        {data.materials.map((m) => <MaterialCard key={m.slug} item={m} />)}
                      </div>
                    </section>
                  ) : null}
                </>
              )}
          </div>
        </div>
      </div>
    </>
  );
};
