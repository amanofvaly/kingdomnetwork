import { Link, useParams } from 'react-router-dom';
import { Calendar, ExternalLink, GraduationCap, MapPin, Users } from 'lucide-react';

import { CourseCard, PathwayCard } from '../components/cards.jsx';
import { Breadcrumbs, ErrorState, Monogram, Spinner, Stars, Verified } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { compact, plural } from '../lib/format.js';

export const ChurchDetail = () => {
  const { slug } = useParams();
  const { data, error, loading, reload } = useApi(`/churches/${slug}`);

  if (loading) return <div className="wrap band"><Spinner label="Loading church" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { church, courses, pathways, faculty } = data;

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
                Browse {plural(courses.length, 'course')}
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

      {courses.length > 0 && (
        <section className="band band-tight band-sunken">
          <div className="wrap stack stack-5">
            <div className="section-head" style={{ marginBottom: 0 }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-2xl)' }}>Courses from this church</h2>
                <p>{plural(courses.length, 'course')} currently published.</p>
              </div>
            </div>
            <div className="grid grid-3">
              {courses.map((c) => <CourseCard key={c.slug} course={c} />)}
            </div>
          </div>
        </section>
      )}

      {pathways.length > 0 && (
        <section className="band band-tight">
          <div className="wrap stack stack-5">
            <div>
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>Credential pathways</h2>
              <p className="small muted">Programmes that end in a title issued by {church.shortName ?? church.name}.</p>
            </div>
            <div className="grid grid-3">
              {pathways.map((p) => <PathwayCard key={p.slug} pathway={p} />)}
            </div>
          </div>
        </section>
      )}

      {faculty.length > 0 && (
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
    </>
  );
};
