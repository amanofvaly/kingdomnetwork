import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, SlidersHorizontal, X } from 'lucide-react';

import { MaterialCard } from '../components/cards.jsx';
import { Empty, ErrorState, SkeletonGrid } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';

/**
 * Everything a church teaches or sells, on one shelf.
 *
 * Coursework and materials are separate collections because they are separate
 * things to author, but to someone looking for something to learn from they are
 * one list — so the split shows up as a filter rather than as two pages.
 */

// Newest leads, and is the default: only courses carry enrolments, so ranking
// the shelf by them would hide every book behind every course.
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most enrolled' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
];

const FORMATS = [
  { value: 'course', label: 'Course' },
  { value: 'book', label: 'Book' },
  { value: 'sermon-series', label: 'Sermon series' },
  { value: 'audiobook', label: 'Audiobook' },
  { value: 'study-guide', label: 'Study guide' },
  { value: 'workbook', label: 'Workbook' },
  { value: 'album', label: 'Album' },
];

const FilterItem = ({ on, label, count, onToggle }) => (
  <button type="button" className={`filter-item ${on ? 'is-on' : ''}`} onClick={onToggle} aria-pressed={on}>
    <span className="box">{on && <Check size={12} strokeWidth={3} />}</span>
    <span className="grow clamp-1">{label}</span>
    {count != null && <span className="n">{count}</span>}
  </button>
);

/**
 * A group disappears when it has nothing to offer.
 *
 * Subject and level describe coursework only, so choosing Book or Sermon
 * series empties them — and a heading with no options under it reads as a
 * filter that is broken rather than one that does not apply here.
 */
const FilterGroup = ({ title, options, selected, onToggle, label = (v) => v, first }) => {
  if (!options?.length) return null;
  return (
    <div className="filter-group" style={first ? { borderTop: 'none', paddingTop: 0 } : undefined}>
      <h5>{title}</h5>
      <div className="filter-list">
        {options.map((f) => (
          <FilterItem
            key={f.value}
            label={label(f)}
            count={f.count}
            on={selected === f.value}
            onToggle={() => onToggle(f.value)}
          />
        ))}
      </div>
    </div>
  );
};

export const Learning = () => {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = params.get('q') ?? '';
  const format = params.get('format') ?? '';
  const price = params.get('price') ?? '';
  const category = params.get('category') ?? '';
  const level = params.get('level') ?? '';
  const church = params.get('church') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const page = Number(params.get('page') ?? 1);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (format) sp.set('format', format);
    if (price) sp.set('price', price);
    if (category) sp.set('category', category);
    if (level) sp.set('level', level);
    if (church) sp.set('church', church);
    sp.set('sort', sort);
    sp.set('page', String(page));
    return `/learning?${sp}`;
  }, [q, format, price, category, level, church, sort, page]);

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

  const label = (value) => FORMATS.find((f) => f.value === value)?.label ?? value;

  const active = [
    q && { key: 'q', label: `“${q}”` },
    format && { key: 'format', label: label(format) },
    price === 'free' && { key: 'price', label: 'Free' },
    category && { key: 'category', label: category },
    level && { key: 'level', label: level },
    church && { key: 'church', label: data?.facets.churches.find((c) => c.value === church)?.label ?? church },
  ].filter(Boolean);

  const total = data?.total ?? 0;

  return (
    <>
      <div className="band-warm" style={{ borderBottom: '1px solid var(--line)', paddingBlock: 'var(--s-6)' }}>
        <div className="wrap stack stack-2">
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>{q ? `Results for “${q}”` : 'Learning'}</h1>
          <p className="muted" style={{ maxWidth: '62ch', margin: 0 }}>
            Courses, books, sermon series and study materials published by the churches on Kingdom Network.
          </p>
        </div>
      </div>

      <div className="wrap band-tight">
        <div className="catalogue">
          <aside className={`filters ${filtersOpen ? 'is-open' : ''}`} aria-label="Filters">
            <FilterGroup
              first
              title="Cost"
              options={data?.facets.costs}
              selected={price}
              label={(f) => f.label}
              onToggle={(v) => update({ price: v })}
            />
            <FilterGroup
              title="Format"
              options={data?.facets.formats}
              selected={format}
              label={(f) => label(f.value)}
              onToggle={(v) => toggle('format', v)}
            />
            <FilterGroup
              title="Subject"
              options={data?.facets.categories}
              selected={category}
              label={(f) => f.value}
              onToggle={(v) => toggle('category', v)}
            />
            <FilterGroup
              title="Level"
              options={data?.facets.levels}
              selected={level}
              label={(f) => f.value}
              onToggle={(v) => toggle('level', v)}
            />
            <FilterGroup
              title="Issuing church"
              options={data?.facets.churches}
              selected={church}
              label={(f) => f.label}
              onToggle={(v) => toggle('church', v)}
            />
          </aside>

          <div>
            <div className="results-bar">
              <div className="row-wrap" style={{ gap: 10 }}>
                <button type="button" className="btn btn-outline btn-sm filters-toggle" onClick={() => setFiltersOpen((v) => !v)}>
                  <SlidersHorizontal size={15} /> Filters
                </button>
                <span className="small muted num">
                  {loading ? 'Loading…' : `${total} ${total === 1 ? 'item' : 'items'}`}
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
              : data.items.length === 0 ? (
                <Empty
                  title="Nothing matched those filters"
                  action={<button type="button" className="btn btn-outline btn-sm" onClick={() => setParams({}, { replace: true })}>Clear all filters</button>}
                >
                  Try removing a filter, or search for a different subject.
                </Empty>
              ) : (
                <>
                  <div className="grid grid-3">
                    {data.items.map((item) => <MaterialCard key={`${item.kind}:${item.slug}`} item={item} />)}
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
