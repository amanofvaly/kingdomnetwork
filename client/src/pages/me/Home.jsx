import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Award, BookOpen, Compass, Download, IdCard, PlayCircle, UserRoundPen,
} from 'lucide-react';

import { AreaHero, Meter, PassportBook, Pathway, Section, SectionHead, Tile, ZeroState } from '../../components/me/kit.jsx';
import { ApplicationTile } from '../../components/me/application.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { plural } from '../../lib/format.js';
import { useApi } from '../../lib/useAsync.js';
import { useAuth } from '../../lib/auth.jsx';

/**
 * The front door.
 *
 * Two faces of one surface. Before anything has happened there is nothing
 * honest to summarise, so this shows the way in instead — art, three ways to
 * begin, and a passport with its pages still blank. Once the first thing
 * lands, the same surface becomes the working home, in place rather than by
 * navigating somewhere else.
 */

const HOUR_ART = [
  { until: 12, greet: 'Good morning', art: '/media/scenes/sunrise-arms-raised.webp' },
  { until: 17, greet: 'Good afternoon', art: '/media/scenes/congregation-gathering.webp' },
  { until: 24, greet: 'Good evening', art: '/media/scenes/hands-raised-dark.webp' },
];

const timeOfDay = () => HOUR_ART.find((h) => new Date().getHours() < h.until) ?? HOUR_ART[2];

const firstNameOf = (name = '') => name.split(/\s+/)[0] || 'friend';

/* --- before anything has happened ---------------------------------------- */

const FirstRun = ({ user }) => (
  <div className="me-first">
    <AreaHero
      tall
      art="/media/scenes/sunrise-arms-raised.webp"
      artAlt="Arms raised towards a sunrise"
      kicker="Welcome"
      title={`Welcome, ${firstNameOf(user.name)}.`}
      lede="Your passport is empty, and that is exactly right for today. Everything you study, apply for and are granted will gather here."
    />

    <div className="me-wrap me-body">
      <Section tone="home">
        <SectionHead
          title="Three ways to begin"
          lede="Any one of these starts the record. You can come back to the others whenever you like."
        />
        <div className="me-grid me-grid-3 me-stagger">
          <Pathway
            i={0}
            to="/ordination"
            art="/media/scenes/church-sanctuary.webp"
            icon={<Award size={20} strokeWidth={1.7} />}
            title="Seek standing"
            lede="Ordination, licensing, certification or affiliation — issued by a church on this network."
            note="Find a credential"
          />
          <Pathway
            i={1}
            to="/courses"
            art="/media/scenes/open-book-library.webp"
            icon={<BookOpen size={20} strokeWidth={1.7} />}
            title="Study a course"
            lede="Coursework taught by the churches themselves. Some of it counts towards standing."
            note="Browse courses"
          />
          <Pathway
            i={2}
            to="/me/profile"
            art="/media/scenes/handshake.webp"
            icon={<UserRoundPen size={20} strokeWidth={1.7} />}
            title="Complete your profile"
            lede="Where you serve and how long you have served. Churches read this when you apply."
            note="About two minutes"
          />
        </div>
      </Section>

      <Section tone="passport">
        <SectionHead
          title="Your passport, unstamped"
          lede="Every credential a church issues you lands here — downloadable, and verifiable by anyone you show it to."
        />
        <PassportBook
          holder={user.name}
          role={user.ministryRole || 'No standing recorded yet'}
          slots={4}
        >
          <div className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap', paddingTop: 'var(--s-2)' }}>
            <Link to="/churches" className="btn btn-inverse">
              <Compass size={16} /> Find a church
            </Link>
            <Link to="/verify" className="btn btn-inverse-outline">See how verification works</Link>
          </div>
        </PassportBook>
      </Section>
    </div>
  </div>
);

/* --- once there is something to show ------------------------------------- */

const Live = ({ user, data }) => {
  const { greet, art } = timeOfDay();
  const { stats, pending, courses, credentials } = data;

  const active = courses.filter((c) => c.enrollment.status !== 'completed');
  const issued = credentials.filter((c) => c.status === 'issued');
  const figures = [
    { value: stats.issued, label: 'issued' },
    { value: stats.waiting, label: 'in progress' },
    { value: stats.courses, label: 'courses' },
    { value: stats.completed, label: 'completed' },
  ].filter((f) => f.value > 0);

  return (
    <div className="me-live">
      <AreaHero
        art={art}
        artAlt=""
        kicker={greet}
        title={`${firstNameOf(user.name)}, here is where you stand.`}
        figures={figures}
      />

      <div className="me-wrap me-body">
        <Section tone="journey">
          <SectionHead
            title={pending.length ? 'Waiting on you' : 'Your journey'}
            lede={pending.length
              ? 'What each church is still waiting on before it can issue.'
              : 'Nothing is outstanding right now.'}
            action={pending.length ? <Link to="/me/journey" className="link">See the full journey <ArrowRight size={14} /></Link> : null}
          />
          {pending.length ? (
            <div className="me-grid me-stagger">
              {pending.slice(0, 2).map((a, i) => <ApplicationTile key={a.reference} app={a} i={i} />)}
            </div>
          ) : (
            <ZeroState
              title="Nothing is waiting on you"
              lede="When you apply to a church for standing, every step it asks of you will appear here in order."
              art="/media/scenes/seminar-room.webp"
              action={<Link to="/ordination" className="btn btn-primary">Find a credential <ArrowRight size={16} /></Link>}
            />
          )}
        </Section>

        <Section tone="learning">
          <SectionHead
            title="Your learning"
            lede="Courses unlocked by what you have bought or been assigned."
            action={<Link to="/me/learning" className="link">All learning <ArrowRight size={14} /></Link>}
          />
          {courses.length ? (
            <div className="me-grid me-grid-3 me-stagger">
              {(active.length ? active : courses).slice(0, 3).map(({ enrollment, course, church }, i) => (
                <Tile key={course.slug} i={i} toned>
                  <Link to={`/learn/${course.slug}`} className="me-tile-art" tabIndex={-1} aria-hidden="true">
                    <img src={course.coverImage} alt="" loading="lazy" />
                  </Link>
                  <div className="me-tile-body">
                    {church ? <span className="xs dim clamp-1">{church.shortName ?? church.name}</span> : null}
                    <h3 className="clamp-2"><Link to={`/learn/${course.slug}`}>{course.title}</Link></h3>
                    <div className="stack stack-2" style={{ marginTop: 'var(--s-3)' }}>
                      <Meter value={enrollment.progress} />
                      <div className="row-between xs dim">
                        <span className="num">{enrollment.progress}% complete</span>
                        <span className="num">{enrollment.completedLectures.length}/{course.lectureCount}</span>
                      </div>
                    </div>
                  </div>
                  <div className="me-tile-foot">
                    <Link to={`/learn/${course.slug}`} className="btn btn-primary btn-sm btn-block">
                      <PlayCircle size={15} /> {enrollment.progress > 0 ? 'Continue' : 'Start'}
                    </Link>
                  </div>
                </Tile>
              ))}
            </div>
          ) : (
            <ZeroState
              title="No coursework yet"
              lede="Credentials that require study unlock their courses here, and anything you buy from a church lands here too."
              art="/media/scenes/open-book-library.webp"
              action={<Link to="/courses" className="btn btn-primary">Browse courses <ArrowRight size={16} /></Link>}
            />
          )}
        </Section>

        <Section tone="passport">
          <SectionHead
            title="Your passport"
            lede={issued.length
              ? `${plural(issued.length, 'document')} ready to download and verify.`
              : 'Documents appear here as churches issue them.'}
            action={<Link to="/me/passport" className="link">Open passport <ArrowRight size={14} /></Link>}
          />
          <PassportBook
            holder={user.name}
            role={user.ministryRole || 'Ministry standing held on this network'}
            slots={Math.max(4, issued.length)}
            stamps={issued.slice(0, 6).map((c) => ({
              key: c._id ?? c.verifyCode,
              label: c.offeringTitle ?? c.kind,
              title: `${c.offeringTitle ?? c.kind} — ${c.church?.name ?? ''}`,
              icon: <Award size={16} strokeWidth={1.7} />,
            }))}
          >
            <div className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap', paddingTop: 'var(--s-2)' }}>
              <Link to="/me/passport" className="btn btn-inverse">
                {issued.length ? <><Download size={16} /> Download documents</> : <><IdCard size={16} /> Open passport</>}
              </Link>
            </div>
          </PassportBook>
        </Section>
      </div>
    </div>
  );
};

/* --- the surface --------------------------------------------------------- */

export const MeHome = () => {
  const { user } = useAuth();
  const dash = useApi('/me/dashboard');
  const orders = useApi('/orders');

  const loading = dash.loading || orders.loading;
  const error = dash.error ?? orders.error;

  const data = dash.data;
  const isFirstRun = Boolean(
    data && !orders.loading
    && data.stats.issued === 0 && data.stats.waiting === 0 && data.stats.courses === 0
    && (orders.data?.length ?? 0) === 0,
  );

  // When the first thing lands, the welcome gives way to the working home on
  // the same surface rather than by swapping pages.
  const was = useRef(null);
  const [arriving, setArriving] = useState(false);
  useEffect(() => {
    if (loading || !data) return undefined;
    if (was.current === true && isFirstRun === false) {
      setArriving(true);
      const t = setTimeout(() => setArriving(false), 1100);
      was.current = isFirstRun;
      return () => clearTimeout(t);
    }
    was.current = isFirstRun;
    return undefined;
  }, [isFirstRun, loading, data]);

  if (loading) return <div className="me-wrap me-body"><Spinner /></div>;
  if (error) {
    return (
      <div className="me-wrap me-body">
        <ErrorState error={error} onRetry={() => { dash.reload(); orders.reload(); }} />
      </div>
    );
  }

  return (
    <div className={arriving ? 'me-arrive' : ''}>
      {isFirstRun ? <FirstRun user={user} /> : <Live user={user} data={data} />}
    </div>
  );
};
