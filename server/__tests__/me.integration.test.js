import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * The three things a person had done but could not see, and the boundary that
 * matters most now that a bought file can be opened at all: one person's
 * purchase must never unlock it for anybody else.
 */

const URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/kingdom-network-test-me';

let available = true;
let me; let media;
let Application; let Church; let Enrollment; let Interview; let MediaAsset; let Payment; let Resource; let User;

beforeAll(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
  } catch {
    available = false;
    return;
  }
  me = await import('../controllers/me.controller.js');
  media = await import('../controllers/media.controller.js');
  ({ Application } = await import('../models/Application.js'));
  ({ Church } = await import('../models/Church.js'));
  ({ Enrollment } = await import('../models/Enrollment.js'));
  ({ Interview } = await import('../models/Interview.js'));
  ({ MediaAsset } = await import('../models/MediaAsset.js'));
  ({ Payment } = await import('../models/Payment.js'));
  ({ Resource } = await import('../models/Resource.js'));
  ({ User } = await import('../models/User.js'));
}, 20000);

afterAll(async () => {
  if (!available) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

/** Enough of an Express response to see what a handler decided. */
const capture = () => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
    setHeader(k, v) { res.headers[k] = v; },
  };
  return res;
};

const run = async (handler, req) => {
  const res = capture();
  await handler(req, res, (err) => { if (err) throw err; });
  return res;
};

let reader; let stranger;

beforeEach(async () => {
  if (!available) return;
  await Promise.all([
    Application.deleteMany({}), Church.deleteMany({}), Enrollment.deleteMany({}), Interview.deleteMany({}),
    MediaAsset.deleteMany({}), Payment.deleteMany({}), Resource.deleteMany({}), User.deleteMany({}),
  ]);

  reader = await User.create({ name: 'Esther Nabwire', email: `e${Date.now()}@example.test` });
  stranger = await User.create({ name: 'Someone Else', email: `s${Date.now()}@example.test` });
  await Church.create({ slug: 'a-church', name: 'A Church' });
});

const pay = (over = {}) => Payment.create({
  reference: `PAY-${Math.random().toString(36).slice(2, 9)}`,
  kind: 'donation',
  churchSlug: 'a-church',
  amount: 50,
  status: 'completed',
  ...over,
});

describe('the statement', () => {
  it('shows a gift, which orders never could', async () => {
    if (!available) return;
    await pay({ userId: reader._id, kind: 'donation', amount: 40, donation: { causeTitle: 'Roof fund' } });

    const res = await run(me.statement, { user: reader });
    expect(res.body.data.entries).toHaveLength(1);
    expect(res.body.data.entries[0].cause).toBe('Roof fund');
    expect(res.body.data.entries[0].kindLabel).toBe('Gift');
    expect(res.body.data.totals.given).toBe(40);
    expect(res.body.data.totals.giftCount).toBe(1);
  });

  it('adds fees and purchases into what was paid, but not into what was given', async () => {
    if (!available) return;
    await pay({ userId: reader._id, kind: 'donation', amount: 30 });
    await pay({ userId: reader._id, kind: 'application_fee', amount: 45 });
    await pay({ userId: reader._id, kind: 'resource', amount: 25 });

    const { totals } = (await run(me.statement, { user: reader })).body.data;
    expect(totals.paid).toBe(100);
    expect(totals.given).toBe(30);
  });

  it('leaves out what was never completed, and what belongs to someone else', async () => {
    if (!available) return;
    await pay({ userId: reader._id, amount: 10, status: 'created' });
    await pay({ userId: stranger._id, amount: 999 });

    const res = await run(me.statement, { user: reader });
    expect(res.body.data.entries).toHaveLength(0);
    expect(res.body.data.totals.paid).toBe(0);
  });
});

describe('the library', () => {
  const sell = async (buyer) => {
    const file = await MediaAsset.create({
      churchSlug: 'a-church', kind: 'document', mimeType: 'application/pdf',
      storageKey: `a-church/${Math.random().toString(36).slice(2)}.pdf`,
      filename: 'the-book.pdf', bytes: 2048, visibility: 'private',
    });
    const resource = await Resource.create({
      slug: `book-${Math.random().toString(36).slice(2, 7)}`,
      churchSlug: 'a-church', title: 'A Book Worth Reading', price: 12,
      status: 'published', fileMediaIds: [file._id],
    });
    if (buyer) {
      await Enrollment.create({ userId: buyer._id, kind: 'resource', resourceSlug: resource.slug, churchSlug: 'a-church' });
    }
    return { file, resource };
  };

  it('hands back the file that was bought', async () => {
    if (!available) return;
    const { file } = await sell(reader);

    const { items } = (await run(me.library, { user: reader })).body.data;
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('A Book Worth Reading');
    expect(items[0].files).toHaveLength(1);
    expect(items[0].files[0].url).toBe(`/api/media/file/${file.storageKey}`);
  });

  it('is empty for someone who bought nothing', async () => {
    if (!available) return;
    await sell(reader);
    expect((await run(me.library, { user: stranger })).body.data.items).toHaveLength(0);
  });

  it('says nothing about a book the church has not attached a file to', async () => {
    if (!available) return;
    const resource = await Resource.create({
      slug: 'fileless', churchSlug: 'a-church', title: 'Not Uploaded Yet', price: 5, status: 'published',
    });
    await Enrollment.create({ userId: reader._id, kind: 'resource', resourceSlug: resource.slug });

    const { items } = (await run(me.library, { user: reader })).body.data;
    expect(items).toHaveLength(1);
    expect(items[0].files).toEqual([]);
  });

  /**
   * The read check runs before the file is looked for, so a refusal is a 403
   * and a permission is whatever the store says next — here a 404, because
   * nothing was ever written to disk. That difference is the boundary.
   */
  it('will not open one person\'s purchase for another', async () => {
    if (!available) return;
    const { file } = await sell(reader);

    const denied = await run(media.serve, { params: { 0: file.storageKey }, user: stranger });
    expect(denied.statusCode).toBe(403);

    const allowed = await run(media.serve, { params: { 0: file.storageKey }, user: reader });
    expect(allowed.statusCode).toBe(404);
  });

  it('will not open it for a signed-out stranger either', async () => {
    if (!available) return;
    const { file } = await sell(reader);
    const res = await run(media.serve, { params: { 0: file.storageKey }, user: null });
    expect(res.statusCode).toBe(403);
  });
});

describe('interviews', () => {
  const book = async (when, over = {}) => {
    const application = await Application.create({
      reference: `APP-${Math.random().toString(36).slice(2, 8)}`,
      userId: reader._id, churchSlug: 'a-church',
      offeringSlug: 'ordained-minister', offeringTitle: 'Ordained Minister',
    });
    return Interview.create({
      applicationId: application._id, churchSlug: 'a-church', userId: reader._id,
      scheduledFor: when, joinUrl: 'https://example.test/room', ...over,
    });
  };

  it('separates what is ahead from what is behind', async () => {
    if (!available) return;
    const day = 24 * 60 * 60 * 1000;
    await book(new Date(Date.now() + 3 * day));
    await book(new Date(Date.now() - 3 * day));

    const { upcoming, past } = (await run(me.interviews, { user: reader })).body.data;
    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(1);
    expect(upcoming[0].offeringTitle).toBe('Ordained Minister');
    expect(upcoming[0].calendarUrl).toContain('/calendar.ics');
  });

  it('treats a completed interview as behind, whenever it was scheduled', async () => {
    if (!available) return;
    await book(new Date(Date.now() + 24 * 60 * 60 * 1000), { status: 'completed', outcome: 'pass' });

    const { upcoming, past } = (await run(me.interviews, { user: reader })).body.data;
    expect(upcoming).toHaveLength(0);
    expect(past).toHaveLength(1);
    expect(past[0].outcome).toBe('pass');
  });

  it('shows nobody else\'s', async () => {
    if (!available) return;
    await book(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const { upcoming, past } = (await run(me.interviews, { user: stranger })).body.data;
    expect(upcoming).toHaveLength(0);
    expect(past).toHaveLength(0);
  });

  it('leaves a cancelled interview out entirely', async () => {
    if (!available) return;
    await book(new Date(Date.now() + 24 * 60 * 60 * 1000), { status: 'cancelled' });
    const { upcoming, past } = (await run(me.interviews, { user: reader })).body.data;
    expect(upcoming).toHaveLength(0);
    expect(past).toHaveLength(0);
  });
});
