import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, CheckCheck, MailWarning } from 'lucide-react';

import { AreaHero, Section, SectionHead, ZeroState } from '../../components/me/kit.jsx';
import { ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { dateTime } from '../../lib/format.js';
import { useApi } from '../../lib/useAsync.js';
import { useToast } from '../../lib/toast.jsx';

/**
 * The notifications this platform has been writing all along.
 *
 * Every one of these rows already existed — decisions, requests, marked
 * papers, booked interviews — and until now the only way to learn about any of
 * it was an email, or noticing that an application had changed. The read
 * state and the counts were already there too.
 */

const Note = ({ note, i, onRead }) => {
  const unread = !note.readAt;
  const body = (
    <>
      <span className="me-note-mark">
        <Bell size={16} strokeWidth={1.8} />
      </span>
      <div className="me-note-copy">
        <b>{note.title}</b>
        {note.body ? <p>{note.body}</p> : null}
        <span className="me-note-when">
          {dateTime(note.createdAt)}
          {note.email?.status === 'failed' ? (
            <span className="row" style={{ display: 'inline-flex', gap: 5, marginLeft: 8, color: 'var(--red-600)' }}>
              <MailWarning size={12} /> the email could not be delivered
            </span>
          ) : null}
        </span>
      </div>
    </>
  );

  const className = `me-note ${unread ? 'me-note-unread' : ''}`;

  return note.link ? (
    <Link to={note.link} className={className} style={{ '--i': i }} onClick={() => unread && onRead(note._id)}>
      {body}
    </Link>
  ) : (
    <div className={className} style={{ '--i': i }}>{body}</div>
  );
};

export const MeInbox = () => {
  const { data, error, loading, reload } = useApi('/me/notifications');
  const { fail } = useToast();
  const [busy, setBusy] = useState(false);

  const markAll = async () => {
    setBusy(true);
    try {
      await api.post('/me/notifications/read', {});
      reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const markOne = async (id) => {
    try {
      await api.post('/me/notifications/read', { ids: [id] });
      reload();
    } catch {
      // Following the link matters more than the read flag; stay quiet.
    }
  };

  if (loading) return <div className="me-wrap me-body"><Spinner /></div>;
  if (error) return <div className="me-wrap me-body"><ErrorState error={error} onRetry={reload} /></div>;

  const notes = data.notifications ?? [];
  const unread = data.unread ?? 0;

  return (
    <>
      <AreaHero
        art="/media/scenes/discussion-table.webp"
        artAlt="People talking around a table"
        kicker="Inbox"
        title="Your notifications."
        lede={notes.length
          ? 'Everything the churches you deal with have told you, newest first.'
          : 'When a church asks you for something, marks your paper or reaches a decision, it will appear here.'}
      />

      <div className="me-wrap me-body">
        <Section tone="inbox">
          <SectionHead
            title="Notifications"
            lede={notes.length ? 'The same messages that were emailed to you.' : null}
            action={unread ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={markAll} disabled={busy}>
                <CheckCheck size={15} /> {busy ? 'Marking…' : 'Mark all read'}
              </button>
            ) : null}
          />
          {notes.length ? (
            <div className="me-list me-stagger">
              {notes.map((n, i) => <Note key={n._id} note={n} i={i} onRead={markOne} />)}
            </div>
          ) : (
            <ZeroState
              title="No notifications yet"
              lede="This fills up once you are dealing with a church — a request for a document, a marked paper, a booked interview, a decision."
              art="/media/scenes/table-meeting.webp"
              action={<Link to="/ordination" className="btn btn-primary">Find a credential <ArrowRight size={16} /></Link>}
            />
          )}
        </Section>
      </div>
    </>
  );
};
