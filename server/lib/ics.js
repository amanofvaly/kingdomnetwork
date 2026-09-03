/**
 * A calendar file for an interview.
 *
 * Written by hand rather than pulled from a package: this needs one event with
 * a handful of fields, and RFC 5545's rules about line folding and escaping are
 * short enough to follow directly.
 */

const stamp = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const escape = (text) =>
  String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// Content lines are folded at 75 octets, with a space beginning each
// continuation. Calendar clients reject longer lines outright.
const fold = (line) => {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const parts = [];
  let start = 0;
  while (start < bytes.length) {
    const limit = start === 0 ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);
    // Do not split a multi-byte character across the fold.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    parts.push((start === 0 ? '' : ' ') + bytes.subarray(start, end).toString('utf8'));
    start = end;
  }
  return parts.join('\r\n');
};

export const interviewIcs = ({ uid, startsAt, durationMinutes = 30, summary, description, location, organiser }) => {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kingdom Network//Interview//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${escape(uid)}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(summary)}`,
    description ? `DESCRIPTION:${escape(description)}` : null,
    location ? `LOCATION:${escape(location)}` : null,
    organiser ? `ORGANIZER;CN=${escape(organiser.name)}:mailto:${escape(organiser.email)}` : null,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Interview in one hour',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.map(fold).join('\r\n') + '\r\n';
};
