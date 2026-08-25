import { Link } from 'react-router-dom';
import { Award, BookOpen, Clock, Download, FileCheck2, IdCard, PlayCircle } from 'lucide-react';

import { Empty, ErrorState, Spinner } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { useAuth } from '../lib/auth.jsx';
import { money, plural } from '../lib/format.js';

const Stat = ({ icon: Icon, value, label }) => (
  <div className="stat row" style={{ gap: 'var(--s-3)' }}>
    <Icon size={20} strokeWidth={1.7} color="var(--green-700)" />
    <div><strong className="num">{value}</strong><span>{label}</span></div>
  </div>
);

export const Dashboard = () => {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi('/me/dashboard');

  if (loading) return <div className="wrap band"><Spinner /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const active = data.courses.filter((c) => c.enrollment.status !== 'completed');

  return (
    <>
      <div className="band-warm" style={{ borderBottom: '1px solid var(--line)', paddingBlock: 'var(--s-6)' }}>
        <div className="wrap stack stack-5">
          <div className="stack stack-2">
            <span className="eyebrow">Your account</span>
            <h1 style={{ fontSize: 'var(--text-3xl)' }}>{user.name.split(' ')[0]}, here is where you stand.</h1>
          </div>
          <div className="stat-row">
            <Stat icon={Award} value={data.stats.issued} label="credentials issued" />
            <Stat icon={Clock} value={data.stats.waiting} label="waiting to be issued" />
            <Stat icon={BookOpen} value={data.stats.courses} label="courses unlocked" />
            <Stat icon={FileCheck2} value={data.stats.completed} label="courses completed" />
          </div>
        </div>
      </div>

      <div className="wrap band-tight stack stack-7">
        {data.pending.length > 0 && (
          <section className="stack stack-5">
            <div>
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>Finish these to be issued</h2>
              <p className="small muted">You have paid for these. Here is what each one is still waiting on.</p>
            </div>
            <div className="stack stack-4">
              {data.pending.map(({ credential: c, offering, church, blockers }) => (
                <div key={c.credentialId} className="panel stack stack-4">
                  <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--s-3)' }}>
                    <div className="row" style={{ gap: 'var(--s-4)' }}>
                      {offering?.coverImage && (
                        <span className="media" style={{ width: 84, aspectRatio: '3/2', flex: 'none' }}>
                          <img src={offering.coverImage} alt="" loading="lazy" />
                        </span>
                      )}
                      <div>
                        <h4>{c.title}</h4>
                        <span className="small muted">{church?.name ?? c.churchName}</span>
                      </div>
                    </div>
                    <span className={`tag ${c.status === 'in-review' ? 'tag-gold' : ''}`}>
                      {c.status === 'in-review' ? 'With the church' : 'Not yet issued'}
                    </span>
                  </div>

                  {c.status === 'in-review' ? (
                    <div className="notice notice-gold">
                      <Clock size={15} />
                      <span>{church?.name ?? c.churchName} is reviewing your submission and will sign it.</span>
                    </div>
                  ) : (
                    <div className="stack stack-3" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
                      {blockers.map((b, i) =>
                        b.kind === 'assessment' ? (
                          <div key={i} className="row-between" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                            <span className="row small" style={{ gap: 8 }}><FileCheck2 size={15} /> Assessment not yet passed</span>
                            <Link to={`/assessment/${c.credentialId}`} className="btn btn-primary btn-sm">Take the assessment</Link>
                          </div>
                        ) : b.kind === 'course' ? (
                          <div key={i} className="row-between" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                            <span className="grow stack stack-1" style={{ minWidth: 200 }}>
                              <span className="row small" style={{ gap: 8 }}>
                                <BookOpen size={15} /><span className="grow clamp-1">{b.course?.title ?? b.slug}</span>
                                <span className="xs dim num">{b.progress}%</span>
                              </span>
                              <span className="progress"><span style={{ width: `${b.progress}%` }} /></span>
                            </span>
                            <Link to={`/learn/${b.slug}`} className="btn btn-outline btn-sm">
                              <PlayCircle size={14} /> {b.progress > 0 ? 'Continue' : 'Start'}
                            </Link>
                          </div>
                        ) : (
                          <div key={i} className="row-between" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                            <span className="row small" style={{ gap: 8 }}>
                              <Award size={15} /> {b.offering?.title ?? b.slug} <span className="dim">— required credential</span>
                            </span>
                            <Link to={`/listing/${b.slug}`} className="btn btn-primary btn-sm">
                              {b.offering ? money(b.offering.price) : 'View'}
                            </Link>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="stack stack-5">
          <div className="rail-head">
            <div>
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>Your coursework</h2>
              <p className="small muted" style={{ margin: '4px 0 0' }}>Courses unlocked by what you have bought.</p>
            </div>
            <Link to="/courses" className="link">Browse courses</Link>
          </div>

          {active.length === 0 && data.courses.length === 0 ? (
            <Empty icon={BookOpen} title="No coursework yet"
              action={<Link to="/ordination" className="btn btn-primary">Browse credentials</Link>}>
              Credentials that require study unlock their courses here when you buy them.
            </Empty>
          ) : (
            <div className="grid grid-3">
              {data.courses.map(({ enrollment, course, church }) => (
                <article key={course.slug} className="card offer-card">
                  <Link to={`/learn/${course.slug}`} className="media media-3x2" tabIndex={-1} aria-hidden="true">
                    <img src={course.coverImage} alt="" loading="lazy" />
                  </Link>
                  <div className="card-body">
                    {church && <span className="xs dim clamp-1">{church.shortName ?? church.name}</span>}
                    <h3 className="offer-title clamp-2"><Link to={`/learn/${course.slug}`}>{course.title}</Link></h3>
                    <div className="stack stack-2" style={{ marginTop: 'auto', paddingTop: 'var(--s-3)' }}>
                      <div className="row-between xs dim">
                        <span>{enrollment.progress}% complete</span>
                        <span className="num">{enrollment.completedLectures.length}/{course.lectureCount}</span>
                      </div>
                      <div className="progress"><span style={{ width: `${enrollment.progress}%` }} /></div>
                      <Link to={`/learn/${course.slug}`} className="btn btn-primary btn-sm btn-block" style={{ marginTop: 6 }}>
                        <PlayCircle size={15} /> {enrollment.progress > 0 ? 'Continue' : 'Start'}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel panel-warm row-between" style={{ gap: 'var(--s-5)', flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 'var(--s-4)' }}>
            <IdCard size={26} strokeWidth={1.6} color="var(--green-700)" />
            <div>
              <h4>Digital Minister Passport</h4>
              <p className="small muted" style={{ margin: 0 }}>
                {data.stats.issued > 0
                  ? `${plural(data.stats.issued, 'document')} ready to download.`
                  : 'Your documents appear here as churches issue them.'}
              </p>
            </div>
          </div>
          <Link to="/passport" className="btn btn-outline"><Download size={16} /> Open passport</Link>
        </section>
      </div>
    </>
  );
};
