import { describe, expect, it } from 'vitest';

import { splitFee } from '../lib/ledger.js';
import { identify, imageSize, sanitiseName } from '../lib/upload.js';
import { interviewIcs } from '../lib/ics.js';

describe('splitting a payment', () => {
  it('always adds back up to the amount taken', () => {
    for (const [amount, percent] of [[45, 10], [0.05, 10], [99.99, 12.5], [100, 0], [33.33, 7], [1, 33]]) {
      const { platformFee, netToChurch } = splitFee(amount, percent);
      expect(Math.round((platformFee + netToChurch) * 100)).toBe(Math.round(amount * 100));
    }
  });

  it('never rounds a fee up past the whole amount', () => {
    const { platformFee, netToChurch } = splitFee(0.01, 50);
    expect(platformFee).toBeLessThanOrEqual(0.01);
    expect(netToChurch).toBeGreaterThanOrEqual(0);
  });
});

describe('deciding what an uploaded file actually is', () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(8),
    Buffer.from([0, 0, 1, 0, 0, 0, 0, 200]),
    Buffer.alloc(8),
  ]);

  it('reads the bytes rather than trusting the name', () => {
    expect(identify(png).mime).toBe('image/png');
    expect(imageSize(png, 'image/png')).toEqual({ width: 256, height: 200 });
  });

  it('refuses SVG, which is a script container rather than an image', () => {
    expect(identify(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
  });

  it('refuses anything it does not recognise', () => {
    expect(identify(Buffer.from('#!/bin/sh\nrm -rf /\n'))).toBeNull();
    expect(identify(Buffer.alloc(4))).toBeNull();
  });

  it('accepts a PDF, which is what applicants send', () => {
    expect(identify(Buffer.from('%PDF-1.7\n...')).kind).toBe('document');
  });

  it('strips path traversal out of a filename', () => {
    expect(sanitiseName('../../etc/passwd')).toBe('passwd');
    expect(sanitiseName('/absolute/path.png')).toBe('path.png');
    expect(sanitiseName('')).toBe('file');
  });
});

describe('the calendar file', () => {
  const ics = interviewIcs({
    uid: 'x@y',
    startsAt: '2026-10-01T09:00:00Z',
    durationMinutes: 45,
    summary: 'Interview — Ordained Minister at a church with a very long name indeed, long enough to need folding',
    description: 'Join at https://zoom.us/j/123',
    location: 'Zoom',
  });

  it('folds every line to the 75 octets calendar clients accept', () => {
    for (const line of ics.split('\r\n')) {
      expect(Buffer.from(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('works out the end from the duration', () => {
    expect(ics).toContain('DTSTART:20261001T090000Z');
    expect(ics).toContain('DTEND:20261001T094500Z');
  });

  it('escapes the characters that would otherwise break the format', () => {
    const escaped = interviewIcs({ uid: 'a', startsAt: '2026-01-01T00:00:00Z', summary: 'A; B, C\\D' });
    expect(escaped).toContain('SUMMARY:A\; B\\, C\\\\D');
  });
});
