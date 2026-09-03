import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarCheck, CalendarClock, Video } from 'lucide-react';

import { ErrorState, Spinner } from '../components/ui.jsx';
import { api, getToken } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { useApi } from '../lib/useAsync.js';

/**
 * Booking the conversation.
 *
 * The church names the time and pastes whatever it already uses to meet; the
 * platform just holds the diary. No video provider is imposed on anyone.
 */
/**
 * The calendar route is behind bearer auth, so the file cannot be an ordinary
 * link — fetch it with the token and hand the browser a blob.
 */
const downloadCalendar = async (id, onError) => {
  try {
    const res = await fetch(`/api/interviews/${id}/calendar.ics`, {
      headers: { authorization: `Bearer ${getToken() ?? ''}` },
    });
    if (!res.ok) throw new Error('That calendar file could not be built.');

    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'interview.ics';
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    onError(err);
  }
};

export const InterviewBooking = () => {
  const { reference } = useParams();
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi(`/applications/${reference}/slots`);
  const [busy, setBusy] = useState(null);

  if (loading) return <div className="wrap band"><Spinner /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const book = async (slotId) => {
    setBusy(slotId);
    try {
      await api.post(`/applications/${reference}/interview`, { slotId });
      ok('Booked — check your email');
      await reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const byDay = {};
  for (const slot of data.slots ?? []) {
    const day = new Date(slot.startsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    (byDay[day] ??= []).push(slot);
  }

  return (
    <div className="wrap band">
      <div className="wrap-narrow stack stack-5">
        <div className="stack stack-2">
          <span className="eyebrow">Your interview</span>
          <h1>{data.booked ? 'You are booked in' : 'Choose a time'}</h1>
        </div>

        {data.booked ? (
          <div className="panel panel-warm stack stack-3" style={{ padding: 'var(--s-5)' }}>
            <p className="strong" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
              <CalendarCheck size={18} strokeWidth={1.8} style={{ verticalAlign: -3 }} />
              {' '}
              {new Date(data.booked.scheduledFor).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
            <p className="muted" style={{ margin: 0 }}>
              {data.booked.durationMinutes} minutes{data.booked.panelNames?.length ? ` with ${data.booked.panelNames.join(' and ')}` : ''}. {data.booked.joining}
            </p>
            <div className="row" style={{ gap: 12 }}>
              {data.booked.joinUrl ? (
                <a className="btn btn-primary" href={data.booked.joinUrl} target="_blank" rel="noreferrer">
                  <Video size={16} strokeWidth={1.8} /> Join when it is time
                </a>
              ) : null}
              <button type="button" className="btn btn-outline" onClick={() => downloadCalendar(data.booked.id, fail)}>
                Add to your calendar
              </button>
            </div>
            <p className="dim small" style={{ margin: 0 }}>
              Choose another time below to reschedule.
            </p>
          </div>
        ) : null}

        {Object.keys(byDay).length ? (
          Object.entries(byDay).map(([day, slots]) => (
            <section key={day}>
              <h2 style={{ fontSize: 'var(--text-lg)' }}>{day}</h2>
              <div className="row row-wrap" style={{ gap: 10 }}>
                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    className="btn btn-outline"
                    onClick={() => book(slot.id)}
                    disabled={busy === slot.id}
                  >
                    <CalendarClock size={15} strokeWidth={1.8} />
                    {new Date(slot.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    {slot.remaining > 1 ? <span className="dim xs"> · {slot.remaining} places</span> : null}
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="notice notice-gold">
            <strong>The church has not published any times yet.</strong>
            <p style={{ margin: '4px 0 0' }}>
              They will be in touch, or you can ask them directly. Nothing else on your application is held up by
              this in the meantime.
            </p>
          </div>
        )}

        <Link className="link" to={`/applications/${reference}`}>Back to your application</Link>
      </div>
    </div>
  );
};
