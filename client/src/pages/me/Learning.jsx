import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Clock, PlayCircle } from 'lucide-react';

import { AreaHero, Meter, Ring, Section, SectionHead, Tile, ZeroState } from '../../components/me/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { duration, plural } from '../../lib/format.js';
import { useApi } from '../../lib/useAsync.js';

/**
 * Coursework, sorted by whether it is still asking for something.
 *
 * What someone is halfway through matters more than what they finished, so
 * that comes first and carries the only progress figure on the page that is
 * worth a ring.
 */

const CourseTile = ({ enrollment, course, church, i, done = false }) => (
  <Tile i={i} toned>
    <Link to={`/learn/${course.slug}`} className="me-tile-art" tabIndex={-1} aria-hidden="true">
      <img src={course.coverImage} alt="" loading="lazy" />
    </Link>
    <div className="me-tile-body">
      {church ? <span className="xs dim clamp-1">{church.shortName ?? church.name}</span> : null}
      <h3 className="clamp-2"><Link to={`/learn/${course.slug}`}>{course.title}</Link></h3>
      <div className="me-tile-meta">
        {course.totalMinutes ? <span className="row" style={{ gap: 5 }}><Clock size={13} /> {duration(course.totalMinutes)}</span> : null}
        {course.lectureCount ? <span>{plural(course.lectureCount, 'lesson')}</span> : null}
      </div>

      {done ? (
        <div className="row small" style={{ gap: 7, marginTop: 'var(--s-3)', color: 'var(--aqua)' }}>
          <CheckCircle2 size={15} /> Completed
        </div>
      ) : (
        <div className="row" style={{ gap: 'var(--s-4)', marginTop: 'var(--s-3)' }}>
          <Ring value={enrollment.progress} size={48} />
          <div className="grow stack stack-2">
            <Meter value={enrollment.progress} />
            <span className="xs dim num">
              {enrollment.completedLectures.length} of {course.lectureCount} lessons
            </span>
          </div>
        </div>
      )}
    </div>
    <div className="me-tile-foot">
      <Link to={`/learn/${course.slug}`} className={`btn btn-sm btn-block ${done ? 'btn-outline' : 'btn-primary'}`}>
        <PlayCircle size={15} /> {done ? 'Revisit' : enrollment.progress > 0 ? 'Continue' : 'Start'}
      </Link>
    </div>
  </Tile>
);

export const MeLearning = () => {
  const { data, error, loading, reload } = useApi('/me/dashboard');

  if (loading) return <div className="me-wrap me-body"><Spinner /></div>;
  if (error) return <div className="me-wrap me-body"><ErrorState error={error} onRetry={reload} /></div>;

  const courses = data.courses ?? [];
  const active = courses.filter((c) => c.enrollment.status !== 'completed');
  const done = courses.filter((c) => c.enrollment.status === 'completed');

  const minutes = active.reduce((sum, c) => sum + (c.course.totalMinutes ?? 0), 0);
  const figures = [
    { value: active.length, label: 'in progress' },
    { value: done.length, label: 'completed' },
  ].filter((f) => f.value > 0);

  return (
    <>
      <AreaHero
        art="/media/scenes/hands-open-bible.webp"
        artAlt="Open hands holding a Bible"
        kicker="Learning"
        title="Your coursework."
        lede={active.length
          ? `About ${duration(minutes)} of teaching still open across ${plural(active.length, 'course')}.`
          : 'Courses unlock here when you buy them, or when a credential you applied for requires study.'}
        figures={figures}
      />

      <div className="me-wrap me-body">
        <Section tone="learning">
          <SectionHead
            title="In progress"
            lede={active.length ? 'The lesson you stopped on is where each of these will open.' : null}
            action={<Link to="/courses" className="link">Browse courses <ArrowRight size={14} /></Link>}
          />
          {active.length ? (
            <div className="me-grid me-grid-3 me-stagger">
              {active.map((c, i) => <CourseTile key={c.course.slug} {...c} i={i} />)}
            </div>
          ) : (
            <ZeroState
              title={done.length ? 'Nothing open right now' : 'No coursework yet'}
              lede={done.length
                ? 'You have finished everything unlocked to you. New coursework appears here the moment it is.'
                : 'Some credentials require study before a church will issue them, and that study appears here. Courses you buy outright do too.'}
              art="/media/scenes/open-book-library.webp"
              action={<Link to="/courses" className="btn btn-primary">Browse courses <ArrowRight size={16} /></Link>}
            />
          )}
        </Section>

        {done.length ? (
          <Section tone="learning">
            <SectionHead title="Completed" lede="Still open to you — finishing a course does not close it." />
            <div className="me-grid me-grid-3 me-stagger">
              {done.map((c, i) => <CourseTile key={c.course.slug} {...c} i={i} done />)}
            </div>
          </Section>
        ) : null}

        <Section tone="learning">
          <div className="me-card">
            <div className="me-card-in">
              <div className="row" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
                <BookOpen size={24} strokeWidth={1.6} color="var(--aqua)" />
                <div className="grow" style={{ minWidth: 240 }}>
                  <h3 style={{ fontSize: 'var(--text-lg)' }}>Study that counts towards standing</h3>
                  <p className="small muted" style={{ margin: '4px 0 0' }}>
                    Some churches require coursework before they will ordain or licence. Those courses unlock
                    automatically when your application reaches that step.
                  </p>
                </div>
                <Link to="/ordination" className="btn btn-outline">See what churches require</Link>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
};
