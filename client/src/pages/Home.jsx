import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ChevronRight, Plane, Search } from 'lucide-react';

import { OfferingCard } from '../components/market.jsx';
import { ErrorState, SkeletonGrid } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { useCart } from '../lib/cart.jsx';
import { compact, money } from '../lib/format.js';

/**
 * A photographic banner with the offer on it, the way a storefront opens.
 * Search sits inside it because this is a marketplace, not a brochure.
 */
const Hero = ({ data }) => {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const { add } = useCart();
  const featured = data?.featured?.[0];

  const buy = () => {
    if (!featured) return;
    add({ kind: 'offering', slug: featured.slug });
    navigate('/checkout');
  };

  return (
    <section className="market-hero">
      <div className="wrap market-hero-inner">
        <div className="hero-copy">
          <span className="eyebrow">Kingdom Network marketplace</span>
          <h1>Find your next ministry step.</h1>
          <p className="hero-sub">Compare church-issued courses, credentials, ordination pathways and invitations.</p>
          <form
            className="search hero-search"
            role="search"
            onSubmit={(e) => { e.preventDefault(); navigate(term.trim() ? `/search?q=${encodeURIComponent(term.trim())}` : '/search'); }}
          >
            <Search size={19} strokeWidth={1.8} color="var(--ink-3)" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} type="search"
              placeholder="What are you looking for?" aria-label="Search the marketplace" />
            <button type="submit" className="btn btn-primary hero-search-btn" aria-label="Search">
              <Search size={17} strokeWidth={2} />
              <span className="btn-label">Search</span>
            </button>
          </form>
          <div className="hero-categories" aria-label="Popular categories">
            {data?.outcomes?.map((o) => <Link key={o.slug} to={`/${o.slug}`}>{o.name}</Link>)}
          </div>
        </div>

        {featured && (
          <article className="hero-feature-banner">
            <img src="/media/hero-featured-pastoral-care.jpg"
              alt="Featured Pastoral Care Certificate from Seminole Assembly, $40" fetchPriority="high" />
            <button type="button" className="hero-hotspot hero-hotspot-buy" onClick={buy} aria-label="Buy Pastoral Care Certificate now" />
            <Link to={`/listing/${featured.slug}`} className="hero-hotspot hero-hotspot-details" aria-label="View Pastoral Care Certificate details" />
          </article>
        )}
      </div>
    </section>
  );
};

const OutcomeRail = ({ outcomes }) => (
  <section className="category-showcase">
    <div className="wrap">
      <h2>Explore ministry pathways</h2>
      <div className="category-track-wrap">
        <nav className="category-track" aria-label="Ministry pathways">
          {outcomes.map((o, index) => (
            <Link key={o.slug} to={`/${o.slug}`} className={`category-tile category-tone-${index + 1}`}>
              <span className="category-copy">
                <b>{o.name}</b>
                <small>Explore from {o.fromPrice != null ? money(o.fromPrice) : '—'}</small>
              </span>
              <span className="category-image"><img src={o.coverImage} alt="" loading="eager" /></span>
            </Link>
          ))}
          <Link to="/churches" className="category-tile category-tone-6">
            <span className="category-copy"><b>Churches</b><small>Meet the issuers</small></span>
            <span className="category-image"><img src="/media/scenes/congregation-gathering.webp" alt="" loading="eager" /></span>
          </Link>
        </nav>
        <span className="category-next" aria-hidden="true"><ChevronRight size={25} strokeWidth={2.5} /></span>
      </div>
    </div>
  </section>
);

const Rail = ({ title, sub, to, toLabel, items, loading, cols = 'grid-4', onAdd, has }) => (
  <section className="band band-tight">
    <div className="wrap">
      <div className="rail-head">
        <div>
          <h2>{title}</h2>
          {sub && <p className="small muted" style={{ margin: '4px 0 0' }}>{sub}</p>}
        </div>
        {to && <Link to={to} className="link">{toLabel} <ArrowRight size={15} /></Link>}
      </div>
      {loading ? <SkeletonGrid count={4} cols={cols} /> : (
        <div className={`grid ${cols}`}>
          {items.map((o) => <OfferingCard key={o.slug} offering={o} showOutcome onAdd={onAdd} added={has?.('offering', o.slug)} />)}
        </div>
      )}
    </div>
  </section>
);

export const Home = () => {
  const { data, error, loading, reload } = useApi('/home');
  const { add, has } = useCart();
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  return (
    <>
      <Hero data={data} />
      {data && <OutcomeRail outcomes={data.outcomes} />}

      <Rail
        title="Popular right now"
        sub="Start with the pathways people are choosing most."
        to="/search" toLabel="Browse everything"
        items={data?.featured ?? []} loading={loading}
        onAdd={(o) => add({ kind: 'offering', slug: o.slug })} has={has}
      />

      {!loading && data.churches.length > 0 && (
        <section className="band band-tight band-warm">
          <div className="wrap stack stack-4">
            <div className="rail-head">
              <div>
                <h2>The churches issuing them</h2>
                <p className="small muted" style={{ margin: '4px 0 0' }}>
                  Every credential names the ministry that signed it. Read who they are before you buy.
                </p>
              </div>
              <Link to="/churches" className="link">All churches <ArrowRight size={15} /></Link>
            </div>
            <div className="church-strip">
              {data.churches.map((c) => (
                <Link key={c.slug} to={`/churches/${c.slug}`} className="church-chip">
                  <span className="monogram">{c.monogram}</span>
                  <span>
                    <span className="small strong clamp-1" style={{ display: 'block' }}>{c.shortName ?? c.name}</span>
                    <span className="xs dim row" style={{ gap: 4 }}>
                      {c.country}
                      {c.verified && <BadgeCheck size={11} style={{ color: 'var(--green-600)' }} />}
                      · {compact(c.stats?.credentialsIssued ?? 0)} issued
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="band band-tight">
        <div className="wrap">
          <div className="rail-head">
            <div>
              <h2 className="row" style={{ gap: 10 }}><Plane size={24} strokeWidth={1.7} /> Invitations abroad</h2>
              <p className="small muted" style={{ margin: '4px 0 0' }}>
                Signed invitations from host churches, issued on their own letterhead for conferences and ministry engagements.
              </p>
            </div>
            <Link to="/invitation-letter" className="link">All invitations <ArrowRight size={15} /></Link>
          </div>
          {loading ? <SkeletonGrid count={4} /> : (
            <div className="grid grid-4">
              {data.letters.map((o) => <OfferingCard key={o.slug} offering={o} />)}
            </div>
          )}
        </div>
      </section>

      {!loading && data.picks.length > 0 && (
        <Rail
          title="Our picks"
          sub="Listings we rate for the standard behind them, not the price."
          items={data.picks} loading={false}
        />
      )}

      <section className="band-ink">
        <div className="wrap for-churches">
          <div className="stack stack-5">
            <span className="eyebrow">For churches and ministries</span>
            <h2>List what you already issue.</h2>
            <p className="lede" style={{ color: 'rgba(255,255,255,.74)' }}>
              Set your own titles, your own requirements and your own prices. Take payment in mobile money and
              card, sign the documents, and reach ministers who will never walk through your door.
            </p>
            <ul className="tick-list">
              <li><BadgeCheck size={16} /> Define your credentials and what each one requires</li>
              <li><BadgeCheck size={16} /> Issue certificates and letters on your own letterhead</li>
              <li><BadgeCheck size={16} /> Nothing to approve — your listings go live when you publish them</li>
            </ul>
            <div className="row-wrap" style={{ gap: 12 }}>
              <Link to="/teach" className="btn btn-inverse">Start listing</Link>
              <Link to="/churches" className="btn btn-inverse-outline">See who is here</Link>
            </div>
          </div>
          <figure className="media media-4x3">
            <img src="/media/scenes/seminar-room.webp" alt="A ministry teaching session in progress" width={1600} height={1067} loading="lazy" />
          </figure>
        </div>
      </section>
    </>
  );
};
