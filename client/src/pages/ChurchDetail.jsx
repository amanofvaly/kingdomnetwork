import { Link, useParams } from 'react-router-dom';
import { Calendar, ExternalLink, GraduationCap, MapPin, Users } from 'lucide-react';

import { CourseCard } from '../components/cards.jsx';
import { OfferingCard } from '../components/market.jsx';
import { Breadcrumbs, ErrorState, Monogram, Spinner, Stars, Verified } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { compact, money, plural } from '../lib/format.js';

export const ChurchDetail = () => {
  const { slug } = useParams();
  const { data, error, loading, reload } = useApi(`/churches/${slug}`);

  if (loading) return <div className="wrap band"><Spinner label="Loading church" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { church, listings, courses, faculty, resources, donations, gallery, sections } = data;

  // The church controls the order of its own page, and can hide blocks it does
  // not want. `visible` keeps the rendering below honest about that.
  const visible = new Set((sections ?? []).filter((x) => x.visible !== false).map((x) => x.type));
  const shows = (type) => !sections?.length || visible.has(type);

  return (
    <>
      <div className="church-hero">
        <div className="media">
          <img src={church.coverImage} alt={church.coverAlt} width={1600} height={1067} fetchPriority="high" />
        </div>
      </div>

      <div className="wrap" style={{ paddingBlock: 'var(--s-6)' }}>
        <div className="stack stack-5">
          <Breadcrumbs trail={[{ label: 'Churches', to: '/churches' }, { label: church.name }]} />
          <div className="church-headline">
            <div className="stack stack-4">
              <div className="row" style={{ gap: 'var(--s-4)', alignItems: 'flex-start' }}>
                <Monogram text={church.monogram} size="monogram-lg" />
                <div className="stack stack-2">
                  <h1 style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.6rem)' }}>{church.name}</h1>
                  <div className="row-wrap small muted" style={{ gap: 'var(--s-4)' }}>
                    <span className="row" style={{ gap: 5 }}><MapPin size={14} />{church.city}, {church.country}</span>
                    <span className="row" style={{ gap: 5 }}><Calendar size={14} />Founded {church.foundedYear}</span>
                    {church.verified && <Verified label="Verified church" />}
                  </div>
                </div>
              </div>
              <p className="lede" style={{ maxWidth: '64ch' }}>{church.tagline}</p>
              <div className="row-wrap" style={{ gap: 8 }}>
                {church.specialties.map((s) => <span key={s} className="tag">{s}</span>)}
              </div>
              <div className="row-wrap" style={{ gap: 'var(--s-4)' }}>
                <Stars rating={church.rating} count={church.ratingCount} size={15} />
                {church.website && (
                  <a className="link small" href={`https://${church.website}`} target="_blank" rel="noreferrer noopener">
                    {church.website} <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>

            <div className="panel panel-warm stack stack-4">
              <h5>Teaching at a glance</h5>
              <div className="stack stack-3">
                {[
                  ['Languages', church.languages.join(', ')],
                  ['Delivery', church.deliveryModes.join(', ')],
                  ['Region', church.region],
                ].map(([k, v]) => (
                  <div key={k} className="stack" style={{ gap: 2 }}>
                    <span className="xs dim">{k}</span>
                    <span className="small">{v}</span>
                  </div>
                ))}
              </div>
              <Link to={`/courses?church=${church.slug}`} className="btn btn-primary btn-block btn-sm">
                See {plural(listings.length, 'listing')}
              </Link>
            </div>
          </div>

          <div className="stat-row">
            <div className="stat"><strong className="num">{compact(church.stats.learners)}</strong><span>learners enrolled</span></div>
            <div className="stat"><strong className="num">{church.stats.courses}</strong><span>courses published</span></div>
            <div className="stat"><strong className="num">{compact(church.stats.credentialsIssued)}</strong><span>credentials issued</span></div>
            <div className="stat"><strong className="num">{church.stats.yearsTeaching}</strong><span>years teaching</span></div>
          </div>
        </div>
      </div>

      <section className="band band-tight band-warm">
        <div className="wrap">
          <div className="detail-grid">
            <div className="stack stack-5">
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>About {church.shortName ?? church.name}</h2>
              <p className="lede" style={{ maxWidth: '66ch' }}>{church.about}</p>
              <div className="prose" style={{ maxWidth: '66ch' }}>
                {church.story.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </div>
            <figure className="media media-4x3" style={{ margin: 0 }}>
              <img src={church.portraitImage} alt="" width={1600} height={1067} loading="lazy" />
            </figure>
          </div>
        </div>
      </section>

      {church.leaders?.length > 0 && (
        <section className="band band-tight">
          <div className="wrap stack stack-5">
            <h2 style={{ fontSize: 'var(--text-2xl)' }}>Leadership</h2>
            <div className="grid grid-2">
              {church.leaders.map((l) => (
                <div key={l.name} className="leader">
                  <img className="avatar" src={l.image} alt="" width={84} height={84} style={{ width: 84, height: 84 }} loading="lazy" />
                  <div className="stack stack-2">
                    <div>
                      <h4>{l.name}</h4>
                      <p className="small dim" style={{ margin: 0 }}>{l.title}</p>
                    </div>
                    <p className="small muted" style={{ margin: 0 }}>{l.bio}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {listings.length > 0 && shows('whatWeIssue') && (
        <section className="band band-tight band-sunken">
          <div className="wrap stack stack-5">
            <div className="rail-head">
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)' }}>Credentials offered</h2>
                <p className="small muted" style={{ margin: '4px 0 0' }}>
                  {plural(listings.length, 'listing')}, each with the requirements and the fee this ministry sets itself.
                </p>
              </div>
            </div>
            <div className="grid grid-4">
              {listings.map((o) => <OfferingCard key={o.slug} offering={o} showOutcome />)}
            </div>
          </div>
        </section>
      )}

      {courses.length > 0 && shows('courses') && (
        <section className="band band-tight">
          <div className="wrap stack stack-5">
            <div>
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>Coursework</h2>
              <p className="small muted">Courses taught by this church.</p>
            </div>
            <div className="grid grid-4">
              {courses.map((c) => <CourseCard key={c.slug} course={{ ...c, church }} />)}
            </div>
          </div>
        </section>
      )}

      {faculty.length > 0 && shows('faculty') && (
        <section className="band band-tight band-warm">
          <div className="wrap stack stack-5">
            <h2 style={{ fontSize: 'var(--text-2xl)' }}>Faculty</h2>
            <div className="grid grid-2">
              {faculty.map((t) => (
                <div key={t.slug} className="leader">
                  <img className="avatar" src={t.image} alt="" width={84} height={84} style={{ width: 84, height: 84 }} loading="lazy" />
                  <div className="stack stack-2">
                    <div>
                      <h4>{t.name}</h4>
                      <p className="small dim" style={{ margin: 0 }}>{t.title}</p>
                    </div>
                    <div className="row-wrap small muted" style={{ gap: 'var(--s-4)' }}>
                      <Stars rating={t.rating} size={13} />
                      <span className="row" style={{ gap: 5 }}><Users size={13} />{compact(t.learners)}</span>
                      <span className="row" style={{ gap: 5 }}><GraduationCap size={13} />{t.yearsExperience} years</span>
                    </div>
                    <p className="small muted" style={{ margin: 0 }}>{t.bio}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {resources?.length > 0 && shows('resources') && (
        <section className="band band-tight">
          <div className="wrap stack stack-5">
            <h2 style={{ fontSize: 'var(--text-2xl)' }}>Books and materials</h2>
            <div className="grid grid-4">
              {resources.map((r) => (
                <article key={r.slug} className="card">
                  {r.coverImage ? (
                    <span className="media media-3x2"><img src={r.coverImage} alt="" loading="lazy" /></span>
                  ) : null}
                  <div className="card-body">
                    <span className="xs dim">{r.kind?.replace('-', ' ')}</span>
                    <h4 className="clamp-2">{r.title}</h4>
                    {r.subtitle ? <p className="small muted clamp-2">{r.subtitle}</p> : null}
                    <div className="offer-foot">
                      <span className="price-big">{r.price ? money(r.price) : 'Free'}</span>
                      {r.pages ? <span className="xs dim">{r.pages} pages</span> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {gallery?.length > 0 && shows('gallery') && (
        <section className="band band-tight">
          <div className="wrap stack stack-5">
            <h2 style={{ fontSize: 'var(--text-2xl)' }}>The church</h2>
            <div className="grid grid-4">
              {gallery.map((g) => (
                <span key={g.id} className="media media-3x2">
                  <img src={g.url} alt={g.alt ?? ''} loading="lazy" />
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {donations?.enabled && shows('donate') && (
        <section className="band band-tight band-sunken">
          <div className="wrap stack stack-5">
            <div className="stack stack-2" style={{ maxWidth: '62ch' }}>
              <span className="eyebrow">Give</span>
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>
                {donations.headline ?? `Support ${church.shortName ?? church.name}`}
              </h2>
              {donations.blurb ? <p className="lede">{donations.blurb}</p> : null}
            </div>

            {donations.causes?.length > 0 && (
              <div className="grid grid-3">
                {donations.causes.map((c) => (
                  <div key={c.id} className="panel stack stack-3">
                    <h4>{c.title}</h4>
                    {c.blurb ? <p className="small muted" style={{ margin: 0 }}>{c.blurb}</p> : null}
                    {c.goalAmount ? (
                      <div className="stack stack-1">
                        <span className="progress">
                          <span style={{ width: `${Math.min(100, ((c.raisedAmount ?? 0) / c.goalAmount) * 100)}%` }} />
                        </span>
                        <span className="xs dim">{money(c.raisedAmount ?? 0)} of {money(c.goalAmount)}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            <Link to={`/give/${church.slug}`} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              Give to {church.shortName ?? church.name}
            </Link>
          </div>
        </section>
      )}
    </>
  );
};
