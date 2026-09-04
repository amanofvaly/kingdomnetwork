import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, BookOpen, ChevronRight, Church, Headphones, Plane, Search, Users } from 'lucide-react';

import { OfferingCard } from '../components/market.jsx';
import { ErrorState, SkeletonGrid } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { useCart } from '../lib/cart.jsx';
import { money } from '../lib/format.js';
import heroFeatured from '../assets/hero-featured-henry.jpg';

/**
 * The opening banner.
 *
 * The original art-directed storefront banner. The artwork is imported so Vite
 * fingerprints every revision, while real controls keep its pictured actions
 * keyboard-accessible.
 */
const Hero = ({ data }) => {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const { add } = useCart();

  const slot = data?.hero;
  const featuredSlug = 'pastoral-care-certificate-seminole';

  const buyFeatured = () => {
    add({ kind: 'offering', slug: featuredSlug });
    navigate('/checkout');
  };

  return (
    <section className="market-hero">
      <div className="wrap market-hero-inner">
        <div className="hero-copy">
          <h1>{slot?.headline ?? 'Find your next ministry step.'}</h1>
          <p className="hero-sub">
            {slot?.blurb ?? 'Discover pathways to ordination, licensing, and ministry training. Find the church community that aligns with your calling.'}
          </p>
          <form
            className="search hero-search"
            role="search"
            onSubmit={(e) => { e.preventDefault(); navigate(term.trim() ? `/search?q=${encodeURIComponent(term.trim())}` : '/search'); }}
          >
            <Search size={19} strokeWidth={1.8} color="var(--ink-3)" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} type="search"
              placeholder="What are you looking for?" aria-label="Search credentials and churches" />
            <button type="submit" className="btn btn-primary hero-search-btn" aria-label="Search">
              <Search size={17} strokeWidth={2} />
              <span className="btn-label">Search</span>
            </button>
          </form>
          <div className="hero-categories" aria-label="Popular categories">
            {data?.outcomes?.map((o) => <Link key={o.slug} to={`/${o.slug}`}>{o.name}</Link>)}
          </div>
        </div>

        <article className="hero-feature-banner">
          <img
            src={heroFeatured}
            alt="Featured Pastoral Care Certificate from Seminole Assembly, $40"
            fetchPriority="high"
          />
          <button
            type="button"
            className="hero-hotspot hero-hotspot-buy"
            onClick={buyFeatured}
            aria-label="Buy Pastoral Care Certificate now"
          />
          <Link
            to={`/listing/${featuredSlug}`}
            className="hero-hotspot hero-hotspot-details"
            aria-label="View Pastoral Care Certificate details"
          />
        </article>
      </div>
    </section>
  );
};

const OutcomeRail = ({ outcomes }) => (
  <section className="category-showcase">
    <div className="wrap category-showcase-layout">
      <div className="category-intro">
        <h2>Explore ministry pathways</h2>
        <Link to="/search" className="category-cta">Browse all listings <ArrowRight size={17} /></Link>
      </div>
      <div className="category-track-wrap">
        <nav className="category-track" aria-label="Ministry pathways">
          {outcomes.map((o, index) => (
            <Link key={o.slug} to={`/${o.slug}`} className={`category-tile category-tone-${index + 1}`}>
              <span className="category-copy">
                <b>{o.name}</b>
                <small>Explore from <strong>{o.fromPrice != null ? money(o.fromPrice) : '—'}</strong></small>
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

const CHURCH_BANNER_ICONS = [BookOpen, Church, Headphones, Users];
const CHURCH_PEOPLE = {
  'faith-life-church': '/media/churches/faith-life-pastor-speaking.jpg',
  'rock-woi': '/media/churches/rock-woi-pastor.png',
  'seminole-assembly': '/media/churches/seminole-community.webp',
  'christian-international': '/media/churches/sherilyn-hamon-miller.png',
};
const churchBannerRank = (church) => {
  if (church.slug === 'rock-woi') return 0;
  if (CHURCH_PEOPLE[church.slug]) return 1;
  return 2;
};

const ChurchBanner = ({ church, index }) => {
  const Icon = CHURCH_BANNER_ICONS[index % CHURCH_BANNER_ICONS.length];
  const specialties = church.specialties ?? [];
  const personImage = CHURCH_PEOPLE[church.slug];
  return (
    <Link
      to={`/churches/${church.slug}`}
      className={`issuer-banner issuer-palette-${(index % 12) + 1} issuer-layout-${(index % 4) + 1}`}
      aria-label={`View ${church.name}`}
    >
      <div className="issuer-banner-copy">
        <span className="issuer-kicker">Featured church</span>
        <span className="issuer-name">{church.name} {church.verified && <BadgeCheck size={19} fill="currentColor" />}</span>
        <h3>{specialties[0] ?? 'Ministry formation'}</h3>
        <span className="issuer-location">{church.city !== 'Location to confirm' ? `${church.city}, ` : ''}{church.country}</span>
      </div>
      <div className="issuer-stack" aria-hidden="true">
        <span className="issuer-stack-card issuer-stack-back">{specialties[2] ?? church.region}</span>
        <span className="issuer-stack-card issuer-stack-mid">{specialties[1] ?? 'Ministry formation'}</span>
        <span className={`issuer-stack-card issuer-stack-front ${personImage ? 'has-person' : ''}`}>
          {personImage ? (
            <img src={personImage} alt="" />
          ) : (
            <>
              <span className="issuer-symbol"><Icon size={34} strokeWidth={1.8} /></span>
              <strong>{church.shortName ?? church.name}</strong>
              <small>{church.stats?.credentialsIssued?.toLocaleString() ?? 0} credentials issued</small>
              <ArrowRight className="issuer-arrow" size={25} />
            </>
          )}
        </span>
      </div>
      <span className="issuer-track" aria-hidden="true"><i /><i /><i /></span>
    </Link>
  );
};

export const Home = () => {
  const { data, error, loading, reload } = useApi('/home');
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  return (
    <>
      <Hero data={data} />

      {!loading && data.churches.length > 0 && (
        <section className="band band-tight">
          <div className="wrap stack stack-4">
            <div className="rail-head">
              <div>
                <h2>Churches on the network</h2>
                <p className="small muted" style={{ margin: '4px 0 0' }}>
                  Every credential names the church that issued it.
                </p>
              </div>
              <Link to="/churches" className="link">All churches <ArrowRight size={15} /></Link>
            </div>
            <div className="issuer-rail-shell">
              <div className="issuer-rail">
                {[...data.churches]
                  .sort((a, b) => churchBannerRank(a) - churchBannerRank(b))
                  .map((c, index) => <ChurchBanner key={c.slug} church={c} index={index} />)}
              </div>
              <span className="issuer-swipe-cue" aria-hidden="true"><ChevronRight size={24} /></span>
            </div>
          </div>
        </section>
      )}

      <Rail
        title="Popular right now"
        sub="Start with the pathways people are choosing most."
        to="/search" toLabel="Browse everything"
        items={data?.featured ?? []} loading={loading}
      />

      {data && <OutcomeRail outcomes={data.outcomes} />}

      <section className="band band-tight">
        <div className="wrap">
          <div className="rail-head">
            <div>
              <h2 className="row" style={{ gap: 10 }}><Plane size={24} strokeWidth={1.7} /> Invitations abroad</h2>
              <p className="small muted" style={{ margin: '4px 0 0' }}>
                Invitation letters from host churches, on their own letterhead.
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
          sub="Selected by our team."
          items={data.picks} loading={false}
        />
      )}

      <section className="band-ink">
        <div className="wrap for-churches">
          <div className="stack stack-5">
            <h2>List what you already issue.</h2>
            <p className="lede" style={{ color: 'rgba(255,255,255,.74)' }}>
              Set your own titles, your own requirements and your own prices. Take payment in mobile money and
              card, sign the documents, and reach ministers who will never walk through your door.
            </p>
            <ul className="tick-list">
              <li><BadgeCheck size={16} /> Define your credentials and what each one requires</li>
              <li><BadgeCheck size={16} /> Issue certificates and letters on your own letterhead</li>
              <li><BadgeCheck size={16} /> No approval needed. Listings go live when you publish them</li>
            </ul>
            <div className="row-wrap" style={{ gap: 12 }}>
              <Link to="/church/register" className="btn btn-inverse">Register your church</Link>
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
