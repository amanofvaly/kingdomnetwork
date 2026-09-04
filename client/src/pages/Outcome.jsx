import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Check, SlidersHorizontal, X } from 'lucide-react';

import { ACQUISITION, OfferingRow, OutcomeIcon } from '../components/market.jsx';
import { Empty, ErrorState, Spinner } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { useAuth } from '../lib/auth.jsx';
import { money, plural } from '../lib/format.js';

const SORTS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'issued', label: 'Most issued' },
  { value: 'fastest', label: 'Fastest to issue' },
];

const Facet = ({ on, label, sub, count, onToggle }) => (
  <button type="button" className={`filter-item ${on ? 'is-on' : ''}`} onClick={onToggle} aria-pressed={on}>
    <span className="box">{on && <Check size={12} strokeWidth={3} />}</span>
    <span className="grow" style={{ minWidth: 0 }}>
      <span className="clamp-1" style={{ display: 'block' }}>{label}</span>
      {sub && <span className="xs dim">{sub}</span>}
    </span>
    {count != null && <span className="n">{count}</span>}
  </button>
);

export const Outcome = ({ slug: slugProp }) => {
  const params0 = useParams();
  const slug = slugProp ?? params0.slug;
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { user } = useAuth();
  const { data: ent } = useApi('/me/entitlements', { skip: !user });

  const query = useMemo(() => {
    const sp = new URLSearchParams(params);
    return `/outcomes/${slug}?${sp}`;
  }, [slug, params]);

  const { data, error, loading, reload } = useApi(query);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setParams(next, { replace: true });
  };
  const toggle = (key, value) => update({ [key]: params.get(key) === value ? '' : value });

  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;
  if (loading && !data) return <div className="wrap band"><Spinner label="Loading listings" /></div>;

  const { outcome, offerings, facets, priceRange, total } = data;
  // Held credentials and live applications are different states, and the row
  // says something different for each.
  const owned = new Set((ent?.credentials ?? []).filter((c) => c.status === 'issued').map((c) => c.slug));
  const applied = new Map((ent?.applications ?? []).map((a) => [a.slug, a]));

  const active = [
    params.get('outcome') && { key: 'outcome', label: facets.outcomes?.find((o) => o.value === params.get('outcome'))?.label ?? params.get('outcome') },
    params.get('church') && { key: 'church', label: facets.churches.find((c) => c.value === params.get('church'))?.label ?? params.get('church') },
    params.get('acquisition') && { key: 'acquisition', label: ACQUISITION[params.get('acquisition')]?.label ?? params.get('acquisition') },
    params.get('destination') && { key: 'destination', label: params.get('destination') },
    params.get('maxPrice') && { key: 'maxPrice', label: `Under ${money(Number(params.get('maxPrice')))}` },
  ].filter(Boolean);

  return (
    <>
      <section className="outcome-hero">
        <div className="media" aria-hidden="true">
          <img src={outcome.coverImage} alt="" />
        </div>
        <div className="wrap outcome-hero-inner">
          <div className="stack stack-4" style={{ maxWidth: '58ch' }}>
            {outcome.slug !== 'all' && (
              <span className="row eyebrow" style={{ gap: 8 }}>
                <OutcomeIcon name={outcome.icon} size={15} /> {outcome.name}
              </span>
            )}
            <h1 style={{ fontSize: 'clamp(2rem, 3.8vw, 3rem)' }}>{outcome.verb}.</h1>
            {outcome.blurb ? <p className="lede">{outcome.blurb}</p> : null}
            {outcome.slug !== 'all' && (
              <div className="row-wrap small outcome-meta" style={{ gap: 'var(--s-5)' }}>
                <span>{plural(total, 'listing')}</span>
                <span>{plural(facets.churches.length, 'church', 'churches')}</span>
                {priceRange && <span>{money(priceRange.min)} to {money(priceRange.max)}</span>}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="wrap band-tight">
        <div className="catalogue">
          <aside className={`filters ${filtersOpen ? 'is-open' : ''}`} aria-label="Filters">
            {facets.outcomes?.length ? (
              <div className="filter-group" style={{ borderTop: 'none', paddingTop: 0 }}>
                <h5>Kind of credential</h5>
                <div className="filter-list">
                  {facets.outcomes.map((f) => (
                    <Facet key={f.value} label={f.label} count={f.count}
                      on={params.get('outcome') === f.value} onToggle={() => toggle('outcome', f.value)} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="filter-group" style={facets.outcomes?.length ? undefined : { borderTop: 'none', paddingTop: 0 }}>
              <h5>Issuing church</h5>
              <div className="filter-list">
                {facets.churches.map((f) => (
                  <Facet key={f.value} label={f.label} sub={`${f.country} · from ${money(f.from)}`} count={f.count}
                    on={params.get('church') === f.value} onToggle={() => toggle('church', f.value)} />
                ))}
              </div>
            </div>

            <div className="filter-group">
              <h5>How it is issued</h5>
              <div className="filter-list">
                {facets.acquisition.map((f) => (
                  <Facet key={f.value} label={ACQUISITION[f.value]?.label ?? f.value} count={f.count}
                    on={params.get('acquisition') === f.value} onToggle={() => toggle('acquisition', f.value)} />
                ))}
              </div>
            </div>

            {facets.destinations.length > 0 && (
              <div className="filter-group">
                <h5>Destination</h5>
                <div className="filter-list">
                  {facets.destinations.map((f) => (
                    <Facet key={f.value} label={f.value} count={f.count}
                      on={params.get('destination') === f.value} onToggle={() => toggle('destination', f.value)} />
                  ))}
                </div>
              </div>
            )}

            {priceRange && (
              <div className="filter-group">
                <h5>Price</h5>
                <div className="filter-list">
                  {[50, 100, 200].filter((p) => p > priceRange.min).map((p) => (
                    <Facet key={p} label={`Under ${money(p)}`}
                      on={params.get('maxPrice') === String(p)} onToggle={() => toggle('maxPrice', String(p))} />
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div>
            <div className="results-bar">
              <button type="button" className="btn btn-outline btn-sm filters-toggle"
                onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
                <SlidersHorizontal size={15} /> Filters{active.length ? ` (${active.length})` : ''}
              </button>
              <span className="small muted num results-count">{plural(offerings.length, 'listing')}</span>
              <label className="row small muted sort-control" style={{ gap: 8 }}>
                <span className="wide-only">Sort</span>
                <select className="select select-sm"
                  value={params.get('sort') ?? 'recommended'} onChange={(e) => update({ sort: e.target.value })}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              {active.length > 0 && (
                <div className="active-filters">
                  {active.map((a) => (
                    <button key={a.key} type="button" className="pill-clear" onClick={() => update({ [a.key]: '' })}>
                      {a.label} <X size={12} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {offerings.length === 0 ? (
              <Empty title="Nothing matched those filters"
                action={<button type="button" className="btn btn-outline btn-sm" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}>
                Try removing a filter.
              </Empty>
            ) : (
              <div>
                {offerings.map((o) => (
                  <OfferingRow key={o.slug} offering={o} owned={owned.has(o.slug)} applied={applied.get(o.slug)}
                    />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="band band-tight band-warm">
        <div className="wrap stack stack-4">
          <h2 style={{ fontSize: 'var(--text-2xl)' }}>How {outcome.name.toLowerCase()} works here</h2>
          <div className="grid grid-3">
            {Object.entries(ACQUISITION)
              .filter(([k]) => facets.acquisition.some((f) => f.value === k))
              .map(([k, a]) => {
                const Icon = a.icon;
                return (
                  <div key={k} className="feature">
                    <Icon size={20} strokeWidth={1.7} />
                    <h4>{a.label}</h4>
                    <p className="small muted">{a.help}</p>
                  </div>
                );
              })}
          </div>
          <p className="small muted" style={{ maxWidth: '70ch', margin: 0 }}>
            Each church sets its own title, its own requirements and its own price. Kingdom Network records what they
            issue and gives every credential a code anyone can check.
          </p>
        </div>
      </section>
    </>
  );
};
