import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * One catalogue over two collections. The things worth pinning down are the
 * ones a union gets wrong quietly: that paging walks both sides in one order,
 * and that a filter's counts describe the set you are actually looking at.
 */

const URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/kingdom-network-test-catalogue';

let available = true;
let catalogue;
let Church; let Course; let Resource;

beforeAll(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
  } catch {
    available = false;
    return;
  }
  catalogue = await import('../controllers/catalogue.controller.js');
  ({ Church } = await import('../models/Church.js'));
  ({ Course } = await import('../models/Course.js'));
  ({ Resource } = await import('../models/Resource.js'));
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
  return res.body.data;
};

beforeEach(async () => {
  if (!available) return;
  await Promise.all([Church.deleteMany({}), Course.deleteMany({}), Resource.deleteMany({})]);

  await Church.create({ slug: 'grace', name: 'Grace Bible Church', shortName: 'Grace', status: 'published' });
  await Church.create({ slug: 'hope', name: 'Hope Ministries', shortName: 'Hope', status: 'published' });

  await Course.create([
    { slug: 'homiletics', title: 'Homiletics', churchSlug: 'grace', price: 40, status: 'published', category: 'Preaching', level: 'Beginner', learners: 90, totalMinutes: 120 },
    { slug: 'hermeneutics', title: 'Hermeneutics', churchSlug: 'grace', price: 60, status: 'published', category: 'Bible', level: 'Advanced', learners: 50, totalMinutes: 300 },
    { slug: 'draft-course', title: 'Not ready', churchSlug: 'grace', price: 10, status: 'draft', category: 'Bible', level: 'Beginner' },
  ]);

  await Resource.create([
    { slug: 'psalms-book', kind: 'book', title: 'Psalms', churchSlug: 'grace', price: 12, status: 'published', pages: 210 },
    { slug: 'romans-series', kind: 'sermon-series', title: 'Romans', churchSlug: 'hope', price: 0, status: 'published', durationMinutes: 400 },
    { slug: 'draft-book', kind: 'book', title: 'Unfinished', churchSlug: 'hope', price: 5, status: 'draft' },
  ]);
});

const ask = (query = {}) => run(catalogue.list, { query });

describe('the combined catalogue', () => {
  it('returns courses and materials together, and nothing unpublished', async () => {
    if (!available) return;
    const data = await ask();

    expect(data.total).toBe(4);
    expect(data.items.map((i) => i.slug).sort()).toEqual(
      ['hermeneutics', 'homiletics', 'psalms-book', 'romans-series'],
    );
  });

  it('tags each item with what it is', async () => {
    if (!available) return;
    const data = await ask();
    const by = Object.fromEntries(data.items.map((i) => [i.slug, i.kind]));

    expect(by.homiletics).toBe('course');
    expect(by['psalms-book']).toBe('book');
    expect(by['romans-series']).toBe('sermon-series');
  });

  it('narrows to one format', async () => {
    if (!available) return;
    const data = await ask({ format: 'book' });

    expect(data.total).toBe(1);
    expect(data.items[0].slug).toBe('psalms-book');
  });

  it('counts every format even while one is selected, so the filter can be changed', async () => {
    if (!available) return;
    const data = await ask({ format: 'book' });
    const counts = Object.fromEntries(data.facets.formats.map((f) => [f.value, f.count]));

    expect(counts.course).toBe(2);
    expect(counts.book).toBe(1);
    expect(counts['sermon-series']).toBe(1);
  });

  it('pages across both collections in one order', async () => {
    if (!available) return;
    const first = await ask({ sort: 'price-asc', limit: '2', page: '1' });
    const second = await ask({ sort: 'price-asc', limit: '2', page: '2' });

    expect(first.pages).toBe(2);
    expect(first.items.map((i) => i.slug)).toEqual(['romans-series', 'psalms-book']);
    expect(second.items.map((i) => i.slug)).toEqual(['homiletics', 'hermeneutics']);
  });

  it('filters by church across both', async () => {
    if (!available) return;
    const data = await ask({ church: 'hope' });

    expect(data.items.map((i) => i.slug)).toEqual(['romans-series']);
  });

  it('names the church on every card, because nobody buys from nobody', async () => {
    if (!available) return;
    const data = await ask({ format: 'book' });

    expect(data.items[0].church.shortName).toBe('Grace');
  });

  it('searching matches a material by title', async () => {
    if (!available) return;
    const data = await ask({ q: 'psalms' });

    expect(data.items.map((i) => i.slug)).toEqual(['psalms-book']);
  });

  it('a course-only filter narrows to courses', async () => {
    if (!available) return;
    const data = await ask({ level: 'Advanced' });

    expect(data.items.map((i) => i.slug)).toEqual(['hermeneutics']);
  });

  it('carries the facts each kind is described by', async () => {
    if (!available) return;
    const data = await ask();
    const by = Object.fromEntries(data.items.map((i) => [i.slug, i]));

    expect(by.homiletics.minutes).toBe(120);
    expect(by['psalms-book'].pages).toBe(210);
    expect(by['romans-series'].minutes).toBe(400);
  });
});

describe('a material’s detail page', () => {
  let MediaAsset; let Enrollment; let User; let market;
  let file; let sample; let buyer;

  beforeEach(async () => {
    if (!available) return;
    market = await import('../controllers/market.controller.js');
    ({ MediaAsset } = await import('../models/MediaAsset.js'));
    ({ Enrollment } = await import('../models/Enrollment.js'));
    ({ User } = await import('../models/User.js'));

    await Promise.all([MediaAsset.deleteMany({}), Enrollment.deleteMany({}), User.deleteMany({})]);

    file = await MediaAsset.create({
      storageKey: 'grace/resources/full.mp3', churchSlug: 'grace', kind: 'audio',
      mimeType: 'audio/mpeg', filename: 'full.mp3', bytes: 10, checksum: 'full', visibility: 'private',
    });
    sample = await MediaAsset.create({
      storageKey: 'grace/resources/sample.mp3', churchSlug: 'grace', kind: 'audio',
      mimeType: 'audio/mpeg', filename: 'sample.mp3', bytes: 5, checksum: 'sample', visibility: 'public',
    });

    await Resource.updateOne(
      { slug: 'psalms-book' },
      { $set: { fileMediaIds: [file._id], previewMediaId: sample._id } },
    );

    buyer = await User.create({ name: 'Buyer', email: 'b@example.com' });
  });

  const detail = (user) => run(market.resourceDetail, { params: { slug: 'psalms-book' }, user });

  it('offers the sample to anyone', async () => {
    if (!available) return;
    const data = await detail(undefined);

    expect(data.sample.url).toContain(sample.storageKey);
    expect(data.sample.mimeType).toBe('audio/mpeg');
  });

  it('does not hand the paid file to someone who has not bought it', async () => {
    if (!available) return;
    const data = await detail(undefined);

    expect(data.owned).toBe(false);
    expect(data.files).toEqual([]);
    expect(JSON.stringify(data)).not.toContain('full.mp3');
  });

  it('hands over the files once it has been bought', async () => {
    if (!available) return;
    await Enrollment.create({ userId: buyer._id, kind: 'resource', resourceSlug: 'psalms-book', churchSlug: 'grace' });
    const data = await detail(buyer);

    expect(data.owned).toBe(true);
    expect(data.files).toHaveLength(1);
    expect(data.files[0].url).toContain(file.storageKey);
  });

  it('still names the church that published it', async () => {
    if (!available) return;
    const data = await detail(undefined);

    expect(data.church.shortName).toBe('Grace');
  });
});

describe('search', () => {
  it('finds a material as well as a credential, without mixing the counts', async () => {
    if (!available) return;
    const market = await import('../controllers/market.controller.js');
    const data = await run(market.search, { query: { q: 'psalms' }, user: null });

    expect(data.materials.map((m) => m.slug)).toEqual(['psalms-book']);
    // `total` is the credential count; materials are a separate group, so a
    // search that matches only a book must not claim a credential result.
    expect(data.total).toBe(0);
  });

  it('returns no materials when nothing was searched for', async () => {
    if (!available) return;
    const market = await import('../controllers/market.controller.js');
    const data = await run(market.search, { query: {}, user: null });

    expect(data.materials).toEqual([]);
  });

  it('names the church on a material it found', async () => {
    if (!available) return;
    const market = await import('../controllers/market.controller.js');
    const data = await run(market.search, { query: { q: 'psalms' }, user: null });

    expect(data.materials[0].church.shortName).toBe('Grace');
  });
});
