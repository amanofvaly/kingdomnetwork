import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, SlidersHorizontal, X } from 'lucide-react';

import { CourseCard } from '../components/cards.jsx';
import { Empty, ErrorState, SkeletonGrid } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { plural } from '../lib/format.js';

const SORTS = [
  { value: 'popular', label: 'Most enrolled' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
];

const FilterItem = ({ on, label, count, onToggle }) => (
  <button type="button" className={`filter-item ${on ? 'is-on' : ''}`} onClick={onToggle} aria-pressed={on}>
    <span className="box">{on && <Check size={12} strokeWidth={3} />}</span>
    <span className="grow clamp-1">{label}</span>
    {count != null && <span className="n">{count}</span>}
  </button>
);

export const Courses = () => {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const level = params.get('level') ?? '';
  const church = params.get('church') ?? '';
  const sort = params.get('sort') ?? 'popular';
  const page = Number(params.get('page') ?? 1);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (category) sp.set('category', category);
    if (level) sp.set('level', level);
    if (church) sp.set('church', church);
    sp.set('sort', sort);
    sp.set('page', String(page));
    return `/courses?${sp}`;
  }, [q, category, level, church, sort, page]);

  const { data, error, loading, reload } = useApi(query);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const toggle = (key, value) => update({ [key]: params.get(key) === value ? '' : value });

  const active = [
    q && { key: 'q', label: `“${q}”` },
    category && { key: 'category', label: category },
    level && { key: 'level', label: level },
    church && { key: 'church', label: data?.facets.churches.find((c) => c.value === church)?.label ?? church },
  ].filter(Boolean);

  return (
    <>
      <div className="band-warm" style={{ borderBottom: '1px solid var(--line)', paddingBlock: 'var(--s-6)' }}>
        <div className="wrap stack stack-2">
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>{q ? `Results for “${q}”` : 'Courses'}</h1>
          <p className="muted" style={{ maxWidth: '62ch', margin: 0 }}>
            Every course is taught and issued by a named church. Filter by subject, level or issuing ministry.
          </p>
        </div>
      </div>

      <div className="wrap band-tight">
        <div className="catalogue">
          <aside className={`filters ${filtersOpen ? 'is-open' : ''}`} aria-label="Filters">
            <div className="filter-group" style={{ borderTop: 'none', paddingTop: 0 }}>
              <h5>Subject</h5>
              <div className="filter-list">
                {(data?.facets.categories ?? []).map((f) => (
                  <FilterItem key={f.value} label={f.value} count={f.count} on={category === f.value} onToggle={() => toggle('category', f.value)} />
                ))}
              </div>
            </div>
            <div className="filter-group">
              <h5>Level</h5>
              <div className="filter-list">
                {(data?.facets.levels ?? []).map((f) => (
                  <FilterItem key={f.value} label={f.value} count={f.count} on={level === f.value} onToggle={() => toggle('level', f.value)} />
                ))}
              </div>
            </div>
            <div className="filter-group">
              <h5>Issuing church</h5>
              <div className="filter-list">
                {(data?.facets.churches ?? []).map((f) => (
                  <FilterItem key={f.value} label={f.label} count={f.count} on={church === f.value} onToggle={() => toggle('church', f.value)} />
                ))}
              </div>
            </div>
          </aside>

          <div>
            <div className="results-bar">
              <div className="row-wrap" style={{ gap: 10 }}>
                <button type="button" className="btn btn-outline btn-sm filters-toggle" onClick={() => setFiltersOpen((v) => !v)}>
                  <SlidersHorizontal size={15} /> Filters
                </button>
                <span className="small muted num">
                  {loading ? 'Loading…' : plural(data?.total ?? 0, 'course')}
                </span>
                <div className="active-filters">
                  {active.map((a) => (
                    <button key={a.key} type="button" className="pill-clear" onClick={() => update({ [a.key]: '' })}>
                      {a.label} <X size={12} />
                    </button>
                  ))}
                </div>
              </div>

              <label className="row small muted" style={{ gap: 8 }}>
                Sort
                <select className="select select-sm" value={sort} onChange={(e) => update({ sort: e.target.value })}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>

            {error ? <ErrorState error={error} onRetry={reload} />
              : loading ? <SkeletonGrid count={9} cols="grid-3" />
              : data.courses.length === 0 ? (
                <Empty
                  title="Nothing matched those filters"
                  action={<button type="button" className="btn btn-outline btn-sm" onClick={() => setParams({}, { replace: true })}>Clear all filters</button>}
                >
                  Try removing a filter, or search for a different subject.
                </Empty>
              ) : (
                <>
                  <div className="grid grid-3">
                    {data.courses.map((c) => <CourseCard key={c.slug} course={c} />)}
                  </div>
                  {data.pages > 1 && (
                    <nav className="pager" aria-label="Pagination">
                      <button type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button>
                      {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" className={n === page ? 'is-on' : ''} onClick={() => update({ page: String(n) })} aria-current={n === page ? 'page' : undefined}>
                          {n}
                        </button>
                      ))}
                      <button type="button" disabled={page >= data.pages} onClick={() => update({ page: String(page + 1) })}>Next</button>
                    </nav>
                  )}
                </>
              )}
          </div>
        </div>
      </div>
    </>
  );
};
