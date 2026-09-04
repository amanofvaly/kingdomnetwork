import { Link } from 'react-router-dom';
import {
  ArrowRight, CalendarClock, CalendarPlus, ExternalLink, History, Video,
} from 'lucide-react';

import { Section, SectionHead, ZeroState } from '../../components/me/kit.jsx';
import { ApplicationTile, StatusTag } from '../../components/me/application.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { dateShort, dateTime } from '../../lib/format.js';
import { useApi } from '../../lib/useAsync.js';

/**
 * Everything in flight, in one place.
 *
 * Three questions, in the order they matter: what is waiting on you, where are
 * you expected, and what has already happened. Interviews live here rather
 * than inside a single application, because "when am I next expected
 * somewhere" is not a question about one application.
 */

const DECIDED = new Set(['issued', 'declined', 'withdrawn', 'expired']);

const InterviewRow = ({ interview: v, i }) => (
  <div className="me-row" style={{ '--i': i }}>
    <span
      aria-hidden="true"
      style={{
        display: 'grid', placeItems: 'center', flex: 'none', width: 46, height: 46,
        borderRadius: 'var(--r-md)', background: 'var(--tone-soft)', color: 'var(--tone)',
      }}
    >
      <CalendarClock size={20} strokeWidth={1.7} />
    </span>
    <div className="me-row-main">
      <b className="clamp-1">{v.offeringTitle ?? 'Interview'}</b>
      <span className="clamp-1">
        {v.church?.name}
        {v.scheduledFor ? ` · ${dateTime(v.scheduledFor)}` : ''}
        {v.timezone ? ` (${v.timezone})` : ''}
      </span>
    </div>
    <div className="me-row-end">
      {v.joinUrl ? (
        <a href={v.joinUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
          <Video size={14} /> Join
        </a>
      ) : null}
      <a href={v.calendarUrl} className="btn btn-outline btn-sm">
        <CalendarPlus size={14} /> Calendar
      </a>
      {v.reference ? (
        <Link to={`/applications/${v.reference}`} className="btn btn-ghost btn-sm" aria-label="Open the application">
          <ExternalLink size={14} />
        </Link>
      ) : null}
    </div>
  </div>
);

export const MeJourney = () => {
  const dash = useApi('/me/dashboard');
  const list = useApi('/applications');
  const iv = useApi('/me/interviews');

  if (dash.loading || list.loading || iv.loading) return <div className="me-wrap me-body"><Spinner /></div>;
  const error = dash.error ?? list.error ?? iv.error;
  if (error) {
    return (
      <div className="me-wrap me-body">
        <ErrorState error={error} onRetry={() => { dash.reload(); list.reload(); iv.reload(); }} />
      </div>
    );
  }

  const pending = dash.data.pending ?? [];
  const all = list.data ?? [];
  const upcoming = iv.data.upcoming ?? [];
  const past = iv.data.past ?? [];
  const history = all.filter((a) => DECIDED.has(a.status));

  const figures = [
    { value: pending.length, label: 'in progress' },
    { value: upcoming.length, label: 'interviews booked' },
    { value: history.length, label: 'decided' },
  ].filter((f) => f.value > 0);

  return (
    <>

      <div className="me-wrap me-body">
        <Section tone="journey">
          <SectionHead
            title="Waiting on you"
            lede={pending.length ? 'The first step in each is the one you can do now.' : null}
          />
          {pending.length ? (
            <div className="me-grid me-stagger">
              {pending.map((a, i) => <ApplicationTile key={a.reference} app={a} limit={6} i={i} />)}
            </div>
          ) : (
            <ZeroState
              title="Nothing is waiting on you"
              lede="Apply to a church for ordination, licensing, certification or affiliation, and every step it asks of you appears here."
              art="/media/scenes/church-sanctuary.webp"
              action={<Link to="/ordination" className="btn btn-primary">Find a credential <ArrowRight size={16} /></Link>}
            />
          )}
        </Section>

        <Section tone="journey">
          <SectionHead title="Interviews" lede="Across every application you have open." />
          {upcoming.length || past.length ? (
            <div className="me-list me-stagger">
              {upcoming.map((v, i) => <InterviewRow key={v.id} interview={v} i={i} />)}
              {past.length ? (
                <div className="row small muted" style={{ gap: 8, paddingTop: 'var(--s-4)' }}>
                  <History size={14} /> Earlier
                </div>
              ) : null}
              {past.map((v, i) => <InterviewRow key={v.id} interview={v} i={upcoming.length + i} />)}
            </div>
          ) : (
            <ZeroState
              small
              title="No interviews booked"
              lede="If a church wants to meet you, the times it offers will appear here and you can pick one."
            />
          )}
        </Section>

        {history.length ? (
          <Section tone="journey">
            <SectionHead title="Past applications" lede="Applications that have reached an outcome." />
            <div className="me-list me-stagger">
              {history.map((a, i) => (
                <div key={a.reference} className="me-row" style={{ '--i': i }}>
                  {a.offering?.coverImage ? (
                    <div className="me-row-art"><img src={a.offering.coverImage} alt="" loading="lazy" /></div>
                  ) : null}
                  <div className="me-row-main">
                    <b className="clamp-1">{a.offeringTitle}</b>
                    <span className="clamp-1">{a.church?.name} · {dateShort(a.updatedAt)}</span>
                  </div>
                  <div className="me-row-end">
                    <StatusTag status={a.status} />
                    <Link to={`/applications/${a.reference}`} className="btn btn-outline btn-sm">Open</Link>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </>
  );
};
