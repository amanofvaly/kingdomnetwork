import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CalendarPlus, Trash2, Video } from 'lucide-react';

import { ConsoleHeader } from '../../components/admin/Shell.jsx';
import { Dialog, Input, Panel, Select, StatusPill, Textarea } from '../../components/admin/kit.jsx';
import { Avatar, ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { useApi } from '../../lib/useAsync.js';

/**
 * When the church is free, and where the conversation happens.
 *
 * The platform hosts nothing. A church pastes whatever it already uses — a
 * Zoom room, a Meet link, a WhatsApp number, an address — and the platform
 * handles the times, the bookings, the reminders and the record.
 */

const PROVIDERS = [
  { value: 'zoom', label: 'Zoom' },
  { value: 'google-meet', label: 'Google Meet' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'whatsapp', label: 'WhatsApp video' },
  { value: 'phone', label: 'Telephone' },
  { value: 'in-person', label: 'In person' },
  { value: 'other', label: 'Something else' },
];

const day = (d) => new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const time = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export const Interviews = () => {
  const { churchSlug } = useOutletContext();
  const { ok, fail } = useToast();
  const { data, error, loading, reload } = useApi(`/manage/${churchSlug}/slots`);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    date: '', start: '09:00', durationMinutes: 30, count: 1, capacity: 1,
    provider: 'zoom', joinUrl: '', dialIn: '', location: '', instructions: '', panelNames: '',
  });

  const create = async () => {
    const slots = [];
    for (let i = 0; i < Number(form.count || 1); i += 1) {
      const startsAt = new Date(`${form.date}T${form.start}`);
      startsAt.setMinutes(startsAt.getMinutes() + i * Number(form.durationMinutes));
      slots.push({
        startsAt: startsAt.toISOString(),
        durationMinutes: Number(form.durationMinutes),
        capacity: Number(form.capacity),
        provider: form.provider,
        joinUrl: form.joinUrl || undefined,
        dialIn: form.dialIn || undefined,
        location: form.location || undefined,
        instructions: form.instructions || undefined,
        panelNames: form.panelNames ? form.panelNames.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
    }
    try {
      await api.post(`/manage/${churchSlug}/slots`, { slots });
      ok(`${slots.length} time${slots.length === 1 ? '' : 's'} published`);
      setAdding(false);
      await reload();
    } catch (err) {
      fail(err);
    }
  };

  const byDay = {};
  for (const slot of data ?? []) {
    (byDay[day(slot.startsAt)] ??= []).push(slot);
  }

  return (
    <>
      <ConsoleHeader title="Interviews" sub="Your availability and bookings">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
          <CalendarPlus size={15} strokeWidth={1.9} /> Publish times
        </button>
      </ConsoleHeader>

      <div className="console-body">
        {loading ? <Spinner /> : null}
        {error ? <ErrorState error={error} onRetry={reload} /> : null}

        {data && !data.length ? (
          <div className="a-empty">
            <h3>No availability published</h3>
            <p className="muted small" style={{ maxWidth: 460 }}>
              An applicant whose credential requires an interview cannot get past that step until you publish times
              they can book. Use whatever you already use to meet — the platform only handles the diary.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>Publish some times</button>
          </div>
        ) : null}

        {Object.entries(byDay).map(([label, slots]) => (
          <Panel key={label} title={label}>
            <div className="stack stack-2">
              {slots.map((slot) => (
                <div key={slot._id} className="panel" style={{ padding: '12px 14px' }}>
                  <div className="row row-between">
                    <span className="row" style={{ gap: 12 }}>
                      <b>{time(slot.startsAt)}–{time(slot.endsAt)}</b>
                      <span className="dim small">{PROVIDERS.find((p) => p.value === slot.provider)?.label}</span>
                      <span className="dim small">{slot.bookedCount}/{slot.capacity} booked</span>
                    </span>
                    <span className="row" style={{ gap: 8 }}>
                      {slot.joinUrl ? (
                        <a className="btn btn-ghost btn-sm" href={slot.joinUrl} target="_blank" rel="noreferrer">
                          <Video size={14} strokeWidth={1.8} /> Open room
                        </a>
                      ) : null}
                      {slot.bookedCount === 0 ? (
                        <button
                          type="button"
                          className="a-icon-btn danger"
                          onClick={async () => {
                            try { await api.del(`/manage/${churchSlug}/slots/${slot._id}`); await reload(); }
                            catch (err) { fail(err); }
                          }}
                        >
                          <Trash2 size={14} strokeWidth={1.8} />
                        </button>
                      ) : null}
                    </span>
                  </div>

                  {slot.bookings?.length ? (
                    <div className="stack stack-1" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                      {slot.bookings.map((b) => (
                        <div key={b.id} className="row row-between">
                          <span className="row" style={{ gap: 8 }}>
                            <Avatar src={b.applicant?.avatar} name={b.applicant?.name} />
                            <span className="stack" style={{ gap: 0 }}>
                              <b className="small">{b.applicant?.name}</b>
                              <span className="dim xs">{b.offeringTitle}</span>
                            </span>
                          </span>
                          <StatusPill status={b.outcome ?? b.status} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add availability"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={!form.date} onClick={create}>Publish</button>
          </>
        }
      >
        <div className="a-row">
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label="Start time" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
        </div>
        <div className="a-row">
          <Input label="Duration (minutes)" type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
          <Input label="Number of slots" type="number" min="1" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} />
          <Input label="People per slot" type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        </div>

        <Select label="Meeting method" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} options={PROVIDERS} />

        {['zoom', 'google-meet', 'teams', 'other'].includes(form.provider) ? (
          <Input
            label="Meeting link"
            help="Shown to the applicant when they book."
            value={form.joinUrl}
            onChange={(e) => setForm({ ...form, joinUrl: e.target.value })}
            placeholder="https://zoom.us/j/…"
          />
        ) : null}
        {['phone', 'whatsapp'].includes(form.provider) ? (
          <Input label="Phone number" value={form.dialIn} onChange={(e) => setForm({ ...form, dialIn: e.target.value })} />
        ) : null}
        {form.provider === 'in-person' ? (
          <Input label="Where" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        ) : null}

        <Input label="Panel members" help="Comma separated." value={form.panelNames} onChange={(e) => setForm({ ...form, panelNames: e.target.value })} placeholder="Henry Byamukama, Grace Nakato" />
        <Textarea label="Instructions for the applicant" rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
      </Dialog>
    </>
  );
};
