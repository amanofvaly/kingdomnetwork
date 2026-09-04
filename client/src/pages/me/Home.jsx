import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Award, BookOpen, CalendarClock, Compass, FileCheck2, IdCard, Loader2,
  Route as RouteIcon, Sparkles, UserRoundPen,
} from 'lucide-react';

import { Pathway, Section, SectionHead, ZeroState } from '../../components/me/kit.jsx';
import { PostCard, StoryRail, SuggestionRow } from '../../components/me/feed.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useAsync.js';
import { useAuth } from '../../lib/auth.jsx';

/**
 * Home is the feed.
 *
 * This is a social surface now, so the front door is what the churches you
 * follow have been saying — not a summary of your own paperwork. What you have
 * open still leads the page, but as a rail you thumb past rather than a wall
 * of panels; the detail lives in Journey, Passport and Learning.
 *
 * Following nobody is where every account starts, so the server answers with a
 * discovery feed rather than nothing, and this says so plainly.
 */

const firstNameOf = (name = '') => name.split(/\s+/)[0] || 'friend';

/** States where the church holds the ball, so the pill reports rather than invites. */
const WAITING = new Set(['submitted', 'under_review', 'final_review', 'approved']);

/** What each waiting application is actually asking of this person. */
const ACTION = {
  fee_pending: 'Pay the fee',
  draft: 'Finish applying',
  info_requested: 'Reply',
  coursework: 'Study',
  assessment: 'Sit the paper',
  interview: 'Book a time',
  submitted: 'With the church',
  under_review: 'Under review',
  final_review: 'Under review',
  approved: 'Approved',
};

/**
 * The rail: everything this person can act on, as cards.
 *
 * `Continue` is under way, `Start` has never been opened. Both refer only to
 * things already theirs — nothing from the catalogue reaches this rail.
 *
 * One card per application, and its verb comes from the step actually next in
 * the queue, not from the status. Emitting a card per outstanding step would
 * offer to book an interview that is still sitting behind an unpaid fee.
 */

/** The imperative for whatever the application is waiting on. */
const stepVerb = (step, status) => {
  if (!step) return WAITING.has(status) ? (ACTION[status] ?? 'Open') : 'Open';
  switch (step.type) {
    case 'fee': return 'Pay the fee';
    case 'course': return (step.progress ?? 0) > 0 ? 'Continue' : 'Start the course';
    case 'assessment': return 'Sit the paper';
    case 'interview': return step.meta?.booked ? 'See details' : 'Book a time';
    case 'document': return 'Send it';
    case 'reference': return 'Add referees';
    case 'review': return 'Under review';
    default: return ACTION[status] ?? 'Open';
  }
};

const storiesFrom = (dash) => {
  if (!dash) return [];
  const stories = [];
  const seenCourse = new Set();

  for (const a of dash.pending ?? []) {
    // The server hands back only outstanding steps, in order, so the first is
    // the one thing this person can actually move today.
    const next = a.steps?.[0];
    const resting = !next || next.type === 'review' || WAITING.has(a.status);
    stories.push({
      key: a.reference,
      to: `/applications/${a.reference}`,
      label: a.offering?.title ?? a.offeringTitle,
      action: stepVerb(next, a.status),
      waiting: resting,
      starter: !resting && next?.type !== 'fee' && !(next?.progress > 0),
      percent: next?.progress ?? 0,
      image: a.offering?.coverImage,
      icon: <RouteIcon size={14} />,
    });
  }

  // Coursework this person owns. Available whatever an application is doing,
  // so it earns its own card — and a course at zero is a start, not a resume.
  for (const { course, enrollment } of dash.courses ?? []) {
    if (enrollment.status === 'completed') continue;
    if (seenCourse.has(course.slug)) continue;
    seenCourse.add(course.slug);
    const begun = (enrollment.progress ?? 0) > 0;
    stories.push({
      key: `course-${course.slug}`,
      to: `/learn/${course.slug}`,
      label: course.title,
      action: begun ? 'Continue' : 'Start',
      starter: !begun,
      percent: enrollment.progress ?? 0,
      image: course.coverImage,
      icon: <BookOpen size={14} />,
    });
  }

  return stories;
};

/* --- a person with nothing and nobody ------------------------------------ */

const FirstRun = ({ user }) => (
  <div className="me-first">

    <div className="me-wrap me-body">
      <Section tone="home">
        <SectionHead
          title="Three ways to begin"
          lede="Any one of these starts the record. You can come back to the others whenever you like."
        />
        <div className="me-grid me-grid-3 me-stagger">
          <Pathway
            i={0}
            to="/churches"
            art="/media/scenes/church-sanctuary.webp"
            icon={<Compass size={20} strokeWidth={1.7} />}
            title="Follow a church"
            lede="Their gatherings, their teaching and everything new they issue, gathered into one feed."
            note="Find churches"
          />
          <Pathway
            i={1}
            to="/ordination"
            art="/media/scenes/graduation-caps.webp"
            icon={<Award size={20} strokeWidth={1.7} />}
            title="Seek standing"
            lede="Ordination, licensing, certification or affiliation — granted by a church on this network."
            note="Find a credential"
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
    </div>
  </div>
);

/* --- the feed ------------------------------------------------------------ */

export const MeHome = () => {
  const { user } = useAuth();

  const dash = useApi('/me/dashboard');
  const suggest = useApi('/me/suggestions');

  const [posts, setPosts] = useState(null);
  const [state, setState] = useState({ loading: true, error: null, page: 1, more: false, discovery: false });

  const load = useCallback(async (page) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get(`/me/feed?page=${page}`);
      setPosts((current) => (page === 1 ? data.posts : [...(current ?? []), ...data.posts]));
      setState({ loading: false, error: null, page, more: data.more, discovery: data.discovery });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const stories = storiesFrom(dash.data);
  const stats = dash.data?.stats;
  // Nothing done, nothing bought, nobody followed: show the way in instead.
  const isFirstRun = Boolean(
    stats && posts && !suggest.loading
    && stats.issued === 0 && stats.waiting === 0 && stats.courses === 0
    && posts.length === 0,
  );

  if (state.loading && !posts) return <div className="me-wrap me-body"><Spinner /></div>;
  if (state.error && !posts) {
    return <div className="me-wrap me-body"><ErrorState error={state.error} onRetry={() => load(1)} /></div>;
  }
  if (isFirstRun) return <FirstRun user={user} />;

  const suggestions = (suggest.data?.churches ?? []).filter((c) => !c.following).slice(0, 5);

  return (
    <>
      <div className="me-wrap me-feed-body">
        <div className="me-feed">
          <div className="me-feed-col">
            {/* Inside the column, not above the grid: spanning the full width
                would push the aside down by the height of the whole rail. */}
            {stories.length ? <StoryRail items={stories} /> : null}



            {posts?.length ? (
              posts.map((post) => <PostCard key={post.id} post={post} />)
            ) : (
              <ZeroState
                title="Nothing in your feed yet"
                lede="The churches you follow post their gatherings, their teaching and everything new they issue. Follow one and it will all land here."
                art="/media/scenes/congregation-gathering.webp"
                action={<Link to="/churches" className="btn btn-primary">Find churches <ArrowRight size={16} /></Link>}
              />
            )}

            {state.more ? (
              <button
                type="button"
                className="btn btn-outline btn-block"
                onClick={() => load(state.page + 1)}
                disabled={state.loading}
              >
                {state.loading ? <><Loader2 size={16} className="spin" /> Loading…</> : 'Show more'}
              </button>
            ) : null}
          </div>

          <aside className="me-feed-aside">
            {suggestions.length ? (
              <div className="me-card">
                <div className="me-card-in">
                  <div className="me-card-head">
                    <h3>Churches to follow</h3>
                  </div>
                  <div className="me-suggest">
                    {suggestions.map((c) => (
                      <SuggestionRow key={c.slug} church={c} onChange={() => suggest.reload()} />
                    ))}
                  </div>
                  <Link to="/churches" className="link small">See all churches <ArrowRight size={13} /></Link>
                </div>
              </div>
            ) : null}

            <div className="me-card">
              <div className="me-card-in">
                <div className="me-card-head">
                  <h3>Your Digital Passport</h3>
                  <p>
                    {stats?.issued
                      ? `${stats.issued} document${stats.issued === 1 ? '' : 's'} in your name.`
                      : 'Documents appear here as churches issue them.'}
                  </p>
                </div>
                <Link to="/me/passport" className="btn btn-outline btn-block">
                  <IdCard size={15} /> Open Digital Passport
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
};
