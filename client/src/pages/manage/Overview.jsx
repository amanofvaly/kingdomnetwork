import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, CalendarClock, Video } from 'lucide-react';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { Panel, Stat, StatusPill } from '../../components/admin/kit.jsx';
import { Avatar, ErrorState, Spinner } from '../../components/ui.jsx';
import { money } from '../../lib/format.js';
import { useApi } from '../../lib/useAsync.js';

const when = (date) =>
  new Date(date).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const Overview = () => {
  const { churchSlug } = useOutletContext();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/overview`);

  if (loading) return <div className="console-body"><Spinner /></div>;
  if (error) return <div className="console-body"><ErrorState error={error} onRetry={reload} /></div>;

  const { stats, waiting, upcoming, church } = data;

  return (
    <>
      <ConsoleHeader
        title="Overview"
        sub={church.status === 'draft' ? 'Your page is not published yet' : 'Your page is live'}
      >
        <Link className="btn btn-outline btn-sm" to={`/churches/${churchSlug}`}>View public page</Link>
      </ConsoleHeader>

      <div className="console-body">
        <div className="a-stats">
          <Stat label="Waiting on you" value={stats.waiting} alert={stats.waiting > 0} foot={stats.waiting ? 'Applications you have not decided' : 'Nothing outstanding'} />
          <Stat label="Decided" value={stats.decidedLast30Days} foot="In the last 30 days" />
          <Stat label="Issued" value={stats.issued} foot="Credentials in total" />
          <Stat label="Received" value={money(stats.revenueLast30Days)} foot="Net of the platform fee, last 30 days" />
        </div>

        {stats.draftListings > 0 ? (
          <div className="notice notice-gold">
            <strong>{stats.draftListings} listing{stats.draftListings === 1 ? '' : 's'} still in draft.</strong>{' '}
            Nobody can apply for something that has not been published.{' '}
            <Link to={`/manage/${churchSlug}/credentials`}>Finish them</Link>
          </div>
        ) : null}

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Panel
            title="Waiting on you"
            action={<Link className="link small" to={`/manage/${churchSlug}/applicants`}>All applicants</Link>}
          >
            {waiting.length ? (
              <div className="stack stack-2">
                {waiting.map((a) => (
                  <Link
                    key={a.reference}
                    to={`/manage/${churchSlug}/applicants?open=${a.reference}`}
                    className="row row-between panel"
                    style={{ padding: '12px 14px', textDecoration: 'none', color: 'inherit' }}
                  >
                    <span className="row" style={{ gap: 12, minWidth: 0 }}>
                      <Avatar src={a.applicant?.avatar} name={a.applicant?.name} />
                      <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                        <b className="small clamp-1">{a.applicant?.name ?? 'An applicant'}</b>
                        <span className="dim xs clamp-1">{a.offeringTitle}</span>
                      </span>
                    </span>
                    <span className="row" style={{ gap: 10 }}>
                      {a.waitingDays != null ? (
                        <span className={`xs ${a.waitingDays > 14 ? 'strong' : 'dim'}`}>
                          {a.waitingDays === 0 ? 'today' : `${a.waitingDays}d`}
                        </span>
                      ) : null}
                      <StatusPill status={a.status} />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                Nothing is waiting on a decision from you.
              </p>
            )}
          </Panel>

          <Panel
            title="Next interviews"
            action={<Link className="link small" to={`/manage/${churchSlug}/interviews`}>Availability</Link>}
          >
            {upcoming.length ? (
              <div className="stack stack-2">
                {upcoming.map((i) => (
                  <div key={i.id} className="row row-between panel" style={{ padding: '12px 14px' }}>
                    <span className="row" style={{ gap: 12, minWidth: 0 }}>
                      <Avatar src={i.applicant?.avatar} name={i.applicant?.name} />
                      <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                        <b className="small clamp-1">{i.applicant?.name}</b>
                        <span className="dim xs">
                          <CalendarClock size={12} strokeWidth={1.8} style={{ verticalAlign: -2 }} /> {when(i.scheduledFor)}
                        </span>
                      </span>
                    </span>
                    {i.joinUrl ? (
                      <a className="btn btn-outline btn-sm" href={i.joinUrl} target="_blank" rel="noreferrer">
                        <Video size={14} strokeWidth={1.8} /> Join
                      </a>
                    ) : (
                      <span className="dim xs">{i.provider}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                No interviews booked. <Link to={`/manage/${churchSlug}/interviews`}>Add availability</Link> so
                applicants can book one.
              </p>
            )}
          </Panel>
        </div>

        <Panel title="Quick actions">
          <div className="grid grid-3">
            {[
              { to: 'credentials', title: 'Add a credential', body: 'Set the requirements, the fee, and the certificate wording.' },
              { to: 'courses', title: 'Create a course', body: 'Add sections and lessons using your uploaded media.' },
              { to: 'page', title: 'Edit your page', body: 'Choose which sections appear on your public page, and in what order.' },
            ].map((card) => (
              <Link key={card.to} to={`/manage/${churchSlug}/${card.to}`} className="panel" style={{ textDecoration: 'none', color: 'inherit', padding: 'var(--s-4)' }}>
                <b className="small">{card.title}</b>
                <p className="muted small" style={{ margin: '6px 0 10px' }}>{card.body}</p>
                <span className="link small">Open <ArrowRight size={13} strokeWidth={2} style={{ verticalAlign: -2 }} /></span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
};
