import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * The feed, and the rule it exists to keep: nobody signed in ever sees
 * nothing. Plus the one piece of arithmetic that could quietly go wrong —
 * a real reaction landing on a seeded post must add to its baseline rather
 * than replace it.
 */

const URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/kingdom-network-test-feed';

let available = true;
let feed;
let Church; let Follow; let Post; let Reaction; let User;

beforeAll(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
  } catch {
    available = false;
    return;
  }
  feed = await import('../controllers/feed.controller.js');
  ({ Church } = await import('../models/Church.js'));
  ({ Follow } = await import('../models/Follow.js'));
  ({ Post } = await import('../models/Post.js'));
  ({ Reaction } = await import('../models/Reaction.js'));
  ({ User } = await import('../models/User.js'));
}, 20000);

afterAll(async () => {
  if (!available) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const capture = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
    setHeader() {},
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
    Church.deleteMany({}), Follow.deleteMany({}), Post.deleteMany({}), Reaction.deleteMany({}), User.deleteMany({}),
  ]);
  reader = await User.create({ name: 'Esther Nabwire', email: `e${Date.now()}@example.test` });
  stranger = await User.create({ name: 'Someone Else', email: `s${Date.now()}@example.test` });
  await Church.insertMany([
    { slug: 'alpha', name: 'Alpha Church' },
    { slug: 'beta', name: 'Beta Church' },
  ]);
});

const post = (over = {}) => Post.create({
  kind: 'update', authorKind: 'church', churchSlug: 'alpha', body: 'Something', ...over,
});

describe('the feed', () => {
  it('falls back to popular posts, and says so, when you follow nobody', async () => {
    if (!available) return;
    await post({ churchSlug: 'alpha', reactionTotal: 2 });
    await post({ churchSlug: 'beta', reactionTotal: 90 });

    const { data } = (await run(feed.feed, { user: reader, query: {} })).body;
    expect(data.discovery).toBe(true);
    expect(data.posts).toHaveLength(2);
    // Ranked by what people responded to, not by whoever posted last.
    expect(data.posts[0].church.slug).toBe('beta');
  });

  it('narrows to the churches you follow once you follow one', async () => {
    if (!available) return;
    await post({ churchSlug: 'alpha' });
    await post({ churchSlug: 'beta' });
    await Follow.create({ userId: reader._id, churchSlug: 'alpha' });

    const { data } = (await run(feed.feed, { user: reader, query: {} })).body;
    expect(data.discovery).toBe(false);
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].church.slug).toBe('alpha');
  });

  it('keeps showing you your own posts even from a church you do not follow', async () => {
    if (!available) return;
    await Follow.create({ userId: reader._id, churchSlug: 'alpha' });
    await post({ kind: 'credential', authorKind: 'user', userId: reader._id, churchSlug: 'beta', credentialId: 'X1' });

    const { data } = (await run(feed.feed, { user: reader, query: {} })).body;
    expect(data.posts.map((p) => p.kind)).toContain('credential');
  });

  it('leaves a removed post out', async () => {
    if (!available) return;
    await post({ status: 'removed' });
    const { data } = (await run(feed.feed, { user: reader, query: {} })).body;
    expect(data.posts).toHaveLength(0);
  });
});

describe('following', () => {
  it('is idempotent — following twice follows once', async () => {
    if (!available) return;
    await run(feed.follow, { user: reader, params: { churchSlug: 'alpha' } });
    const second = await run(feed.follow, { user: reader, params: { churchSlug: 'alpha' } });

    expect(second.body.data.following).toBe(true);
    expect(await Follow.countDocuments({ userId: reader._id, churchSlug: 'alpha' })).toBe(1);
  });

  it('refuses a church that does not exist', async () => {
    if (!available) return;
    const res = await run(feed.follow, { user: reader, params: { churchSlug: 'nowhere' } });
    expect(res.statusCode).toBe(404);
  });

  it('unfollowing leaves nothing behind', async () => {
    if (!available) return;
    await run(feed.follow, { user: reader, params: { churchSlug: 'alpha' } });
    await run(feed.unfollow, { user: reader, params: { churchSlug: 'alpha' } });
    expect(await Follow.countDocuments({ userId: reader._id })).toBe(0);
  });
});

describe('reacting', () => {
  it('adds to a seeded baseline rather than replacing it', async () => {
    if (!available) return;
    const p = await post({
      demoReactions: { amen: 10, pray: 0, love: 0, celebrate: 0 },
      reactionCounts: { amen: 10, pray: 0, love: 0, celebrate: 0 },
      reactionTotal: 10,
    });

    const res = await run(feed.react, { user: reader, params: { id: String(p._id) }, body: { type: 'amen' } });
    expect(res.body.data.reactionCounts.amen).toBe(11);
    expect(res.body.data.reactionTotal).toBe(11);
  });

  it('changing your mind replaces rather than adds', async () => {
    if (!available) return;
    const p = await post();
    await run(feed.react, { user: reader, params: { id: String(p._id) }, body: { type: 'amen' } });
    const res = await run(feed.react, { user: reader, params: { id: String(p._id) }, body: { type: 'pray' } });

    expect(res.body.data.reactionTotal).toBe(1);
    expect(res.body.data.reactionCounts.amen).toBe(0);
    expect(res.body.data.reactionCounts.pray).toBe(1);
    expect(await Reaction.countDocuments({ userId: reader._id, postId: p._id })).toBe(1);
  });

  it('a null reaction takes yours away and leaves everyone else alone', async () => {
    if (!available) return;
    const p = await post();
    await run(feed.react, { user: reader, params: { id: String(p._id) }, body: { type: 'love' } });
    await run(feed.react, { user: stranger, params: { id: String(p._id) }, body: { type: 'love' } });
    const res = await run(feed.react, { user: reader, params: { id: String(p._id) }, body: { type: null } });

    expect(res.body.data.myReaction).toBeNull();
    expect(res.body.data.reactionTotal).toBe(1);
  });

  it('refuses a reaction that is not one', async () => {
    if (!available) return;
    const p = await post();
    const res = await run(feed.react, { user: reader, params: { id: String(p._id) }, body: { type: 'shrug' } });
    expect(res.statusCode).toBe(400);
  });

  it('reports back only your own reaction on a post', async () => {
    if (!available) return;
    const p = await post();
    await run(feed.react, { user: stranger, params: { id: String(p._id) }, body: { type: 'celebrate' } });

    const { data } = (await run(feed.feed, { user: reader, query: {} })).body;
    expect(data.posts[0].reactionTotal).toBe(1);
    expect(data.posts[0].myReaction).toBeNull();
  });
});
