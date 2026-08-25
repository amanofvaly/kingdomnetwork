import { Link } from 'react-router-dom';
import { Award, BookOpen, Clock, GraduationCap, IdCard, PlayCircle } from 'lucide-react';

import { Empty, ErrorState, Monogram, Spinner } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
import { useAuth } from '../lib/auth.jsx';
import { duration, plural } from '../lib/format.js';

const StatTile = ({ icon: Icon, value, label }) => (
  <div className="stat row" style={{ gap: 'var(--s-3)' }}>
    <Icon size={20} strokeWidth={1.7} color="var(--green-700)" />
    <div><strong className="num">{value}</strong><span>{label}</span></div>
  </div>
);

export const Dashboard = () => {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi('/me/dashboard');

  if (loading) return <div className="wrap band"><Spinner label="Loading your learning" /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const active = data.courses.filter((c) => c.enrollment.status !== 'completed');
  const done = data.courses.filter((c) => c.enrollment.status === 'completed');

  return (
    <>
      <div className="band-warm" style={{ borderBottom: '1px solid var(--line)', paddingBlock: 'var(--s-6)' }}>
        <div className="wrap stack stack-5">
          <div className="stack stack-2">
            <span className="eyebrow">My learning</span>
            <h1 style={{ fontSize: 'var(--text-3xl)' }}>{user.name.split(' ')[0]}, here is where you are.</h1>
          </div>
          <div className="stat-row">
            <StatTile icon={BookOpen} value={data.stats.enrolled} label="courses enrolled" />
            <StatTile icon={GraduationCap} value={data.stats.completed} label="completed" />
            <StatTile icon={Award} value={data.stats.credentials} label="credentials issued" />
            <StatTile icon={Clock} value={duration(data.stats.minutes)} label="of material" />
          </div>
        </div>
      </div>

      <div className="wrap band-tight stack stack-7">
        <section className="stack stack-5">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>In progress</h2>
              <p>Pick up where you left off.</p>
            </div>
            <Link to="/courses" className="link">Find another course</Link>
          </div>

          {active.length === 0 ? (
            <Empty icon={BookOpen} title="Nothing in progress"
              action={<Link to="/courses" className="btn btn-primary">Browse courses</Link>}>
              {done.length > 0 ? 'You have finished everything you are enrolled on.' : 'Enrol on a course and it will appear here.'}
            </Empty>
          ) : (
            <div className="grid grid-3">
              {active.map(({ enrollment, course, church }) => (
                <article key={course.slug} className="card course-card">
                  <Link to={`/learn/${course.slug}`} className="media media-3x2" tabIndex={-1} aria-hidden="true">
                    <img src={course.coverImage} alt="" loading="lazy" />
                  </Link>
                  <div className="card-body">
                    {church && (
                      <div className="row" style={{ gap: 8 }}>
                        <Monogram text={church.monogram} size="monogram-sm" />
                        <span className="xs dim clamp-1">{church.shortName ?? church.name}</span>
                      </div>
                    )}
                    <h3 className="course-title clamp-2"><Link to={`/learn/${course.slug}`}>{course.title}</Link></h3>
                    <div className="stack stack-2" style={{ marginTop: 'auto', paddingTop: 'var(--s-3)' }}>
                      <div className="row-between xs dim">
                        <span>{enrollment.progress}% complete</span>
                        <span className="num">{enrollment.completedLectures.length}/{course.lectureCount}</span>
                      </div>
                      <div className="progress"><span style={{ width: `${enrollment.progress}%` }} /></div>
                      <Link to={`/learn/${course.slug}`} className="btn btn-primary btn-sm btn-block" style={{ marginTop: 6 }}>
                        <PlayCircle size={15} /> {enrollment.progress > 0 ? 'Continue' : 'Start course'}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {data.pathways.length > 0 && (
          <section className="stack stack-5">
            <h2 style={{ fontSize: 'var(--text-2xl)' }}>Pathways</h2>
            <div className="stack stack-4">
              {data.pathways.map(({ pathway, coursesDone, coursesTotal }) => (
                <div key={pathway.slug} className="panel row-between" style={{ gap: 'var(--s-5)', flexWrap: 'wrap' }}>
                  <div className="row" style={{ gap: 'var(--s-4)' }}>
                    <span className="media" style={{ width: 96, aspectRatio: '3/2', flex: 'none' }}>
                      <img src={pathway.coverImage} alt="" loading="lazy" />
                    </span>
                    <div className="stack stack-2">
                      <h4><Link to={`/pathways/${pathway.slug}`}>{pathway.title}</Link></h4>
                      <span className="small muted">{coursesDone} of {plural(coursesTotal, 'taught course')} complete</span>
                      <div className="progress" style={{ width: 220, maxWidth: '100%' }}>
                        <span style={{ width: `${coursesTotal ? (coursesDone / coursesTotal) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                  <span className="tag tag-gold"><Award size={12} />{pathway.award?.title}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {done.length > 0 && (
          <section className="stack stack-5">
            <h2 style={{ fontSize: 'var(--text-2xl)' }}>Completed</h2>
            <div className="grid grid-4">
              {done.map(({ course }) => (
                <article key={course.slug} className="card course-card">
                  <Link to={`/learn/${course.slug}`} className="media media-3x2" tabIndex={-1} aria-hidden="true">
                    <img src={course.coverImage} alt="" loading="lazy" />
                  </Link>
                  <div className="card-body">
                    <span className="tag tag-green" style={{ alignSelf: 'flex-start' }}>Completed</span>
                    <h3 className="course-title clamp-2"><Link to={`/learn/${course.slug}`}>{course.title}</Link></h3>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="panel panel-warm row-between" style={{ gap: 'var(--s-5)', flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 'var(--s-4)' }}>
            <IdCard size={26} strokeWidth={1.6} color="var(--green-700)" />
            <div>
              <h4>Digital Minister Passport</h4>
              <p className="small muted" style={{ margin: 0 }}>
                {data.stats.credentials > 0
                  ? `${plural(data.stats.credentials, 'credential')} issued and ${data.credentials.length - data.stats.credentials} in progress.`
                  : 'Your certificates and titles will be recorded here as churches issue them.'}
              </p>
            </div>
          </div>
          <Link to="/passport" className="btn btn-outline">Open passport</Link>
        </section>
      </div>
    </>
  );
};
