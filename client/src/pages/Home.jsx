import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Building2, Compass, Plane, Search, ShieldCheck } from 'lucide-react';

import { OfferingCard } from '../components/market.jsx';
import { ErrorState, SkeletonGrid } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { compact, money } from '../lib/format.js';

/**
 * A photographic banner with the offer on it, the way a storefront opens.
 * Search sits inside it because this is a marketplace, not a brochure.
 */
const Hero = () => {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');

  return (
    <section className="hero-banner">
      <div className="wrap hero-banner-inner">
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow">Church-issued learning and credentials</span>
          <h1>Grow your ministry with a church you trust.</h1>
          <p className="hero-sub">
            Find courses, ordination pathways, certificates and ministry invitations from churches around the world.
          </p>
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
          <div className="hero-actions">
            <Link to="/certification" className="hero-link"><Compass size={17} /> Browse credentials</Link>
            <Link to="/churches" className="hero-link"><Building2 size={17} /> Explore churches</Link>
          </div>
        </div>
        <div className="hero-visual">
          <img src="/media/scenes/classroom-students.webp" alt="Students learning together in a classroom" fetchPriority="high" />
          <div className="hero-proof">
            <ShieldCheck size={22} />
            <span><b>Issued by churches</b><small>Requirements and issuer shown before you enrol</small></span>
          </div>
        </div>
      </div>
    </section>
  );
};

/** Outcome navigation, carried by photographs rather than icons. */
const OutcomeRail = ({ outcomes }) => (
  <div className="wrap outcome-rail">
    {outcomes.map((o) => (
      <Link key={o.slug} to={`/${o.slug}`} className="outcome-card">
        <span className="media">
          <img src={`${o.coverImage.replace('.webp', '@800.webp')}`} alt="" loading="lazy" />
        </span>
        <span className="outcome-card-body">
          <span className="outcome-card-name">{o.name}</span>
          <span className="outcome-card-price">Explore from <b>{o.fromPrice != null ? money(o.fromPrice) : '—'}</b></span>
        </span>
      </Link>
    ))}
  </div>
);

const Rail = ({ title, sub, to, toLabel, items, loading, cols = 'grid-4' }) => (
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
          {items.map((o) => <OfferingCard key={o.slug} offering={o} showOutcome />)}
        </div>
      )}
    </div>
  </section>
);

export const Home = () => {
  const { data, error, loading, reload } = useApi('/home');
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
