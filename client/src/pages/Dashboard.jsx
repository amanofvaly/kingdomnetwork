import { Link } from 'react-router-dom';
import { Award, BookOpen, Clock, Download, FileCheck2, IdCard, PlayCircle } from 'lucide-react';

import { Empty, ErrorState, Spinner } from '../components/ui.jsx';
import { StatusPill } from '../components/admin/kit.jsx';
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
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>Your applications</h2>
              <p className="small muted">What each church is still waiting on from you.</p>
            </div>
            <div className="stack stack-4">
              {data.pending.map((a) => (
                <div key={a.reference} className="panel stack stack-4">
                  <div className="row-between" style={{ flexWrap: 'wrap', gap: 'var(--s-3)' }}>
                    <div className="row" style={{ gap: 'var(--s-4)' }}>
                      {a.offering?.coverImage && (
                        <span className="media" style={{ width: 84, aspectRatio: '3/2', flex: 'none' }}>
                          <img src={a.offering.coverImage} alt="" loading="lazy" />
                        </span>
                      )}
                      <div>
                        <h4><Link to={`/applications/${a.reference}`}>{a.offeringTitle}</Link></h4>
                        <span className="small muted">{a.church?.name}</span>
                      </div>
                    </div>
                    <StatusPill status={a.status} />
                  </div>

                  {a.infoRequest ? (
                    <div className="notice notice-gold">
                      <Clock size={15} />
                      <span>{a.church?.name} has asked you for something. {a.infoRequest.message}</span>
                    </div>
                  ) : null}

                  {a.steps.length ? (
                    <div className="stack stack-3" style={{ paddingTop: 'var(--s-3)', borderTop: '1px solid var(--line)' }}>
                      {a.steps.slice(0, 4).map((b) =>
                        b.type === 'assessment' ? (
                          <div key={b.key} className="row-between" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                            <span className="row small" style={{ gap: 8 }}><FileCheck2 size={15} /> {b.label}</span>
                            <Link to={`/applications/${a.reference}/assessment`} className="btn btn-primary btn-sm">Sit the paper</Link>
                          </div>
                        ) : b.type === 'interview' ? (
                          <div key={b.key} className="row-between" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                            <span className="row small" style={{ gap: 8 }}><Clock size={15} /> {b.label}</span>
                            <Link to={`/applications/${a.reference}/interview`} className="btn btn-primary btn-sm">
                              {b.meta?.booked ? 'Details' : 'Book a time'}
                            </Link>
                          </div>
                        ) : b.type === 'course' && b.course ? (
                          <div key={b.key} className="row-between" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                            <span className="grow stack stack-1" style={{ minWidth: 200 }}>
                              <span className="row small" style={{ gap: 8 }}>
                                <BookOpen size={15} /><span className="grow clamp-1">{b.course.title}</span>
                                <span className="xs dim num">{b.progress ?? 0}%</span>
                              </span>
                              <span className="progress"><span style={{ width: `${b.progress ?? 0}%` }} /></span>
                            </span>
                            <Link to={`/learn/${b.course.slug}`} className="btn btn-outline btn-sm">
                              <PlayCircle size={14} /> {(b.progress ?? 0) > 0 ? 'Continue' : 'Start'}
                            </Link>
                          </div>
                        ) : b.type === 'credential' && b.offering ? (
                          <div key={b.key} className="row-between" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                            <span className="row small" style={{ gap: 8 }}>
                              <Award size={15} /> {b.offering.title} <span className="dim">— required first</span>
                            </span>
                            <Link to={`/listing/${b.offering.slug}`} className="btn btn-primary btn-sm">
                              {b.offering.fee?.amount ? money(b.offering.fee.amount) : 'View'}
                            </Link>
                          </div>
                        ) : b.type === 'review' ? (
                          <div key={b.key} className="row small row" style={{ gap: 8 }}>
                            <Clock size={15} /> {a.church?.name} is reading your application. {b.detail ?? ''}
                          </div>
                        ) : (
                          <div key={b.key} className="row-between" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                            <span className="row small" style={{ gap: 8 }}><FileCheck2 size={15} /> {b.label}</span>
                            <Link to={`/applications/${a.reference}`} className="btn btn-outline btn-sm">Open</Link>
                          </div>
                        ),
                      )}
                      {a.steps.length > 4 ? (
                        <Link className="link small" to={`/applications/${a.reference}`}>
                          And {a.steps.length - 4} more
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
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
