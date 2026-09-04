import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Serving a stored file: the range arithmetic a player depends on, and the
 * rule that a file someone paid for is not readable by someone who did not.
 */

const URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/kingdom-network-test-media';

let available = true;
let media; let storage;
let MediaAsset;

beforeAll(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
  } catch {
    available = false;
    return;
  }
  media = await import('../controllers/media.controller.js');
  ({ storage } = await import('../lib/storage/index.js'));
  ({ MediaAsset } = await import('../models/MediaAsset.js'));
}, 20000);

afterAll(async () => {
  if (!available) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

/**
 * Enough of a response to be piped into. Every header these tests assert on is
 * set before the stream is attached, so nothing here waits for the body — it
 * only has to absorb the pipe without throwing.
 */
const capture = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
    setHeader(key, value) { res.headers[key.toLowerCase()] = value; return res; },
    getHeader(key) { return res.headers[key.toLowerCase()]; },
    end() { return res; },
    write() { return true; },
    on() { return res; },
    once() { return res; },
    emit() { return false; },
    removeListener() { return res; },
  };
  return res;
};

const run = async (handler, req) => {
  const res = capture();
  await handler(req, res, (err) => { if (err) throw err; });
  return res;
};

const BYTES = Buffer.from('0123456789abcdefghij');

const ask = (asset, range, user) => run(media.serve, {
  params: { 0: asset.storageKey },
  get: (header) => (header.toLowerCase() === 'range' ? range : undefined),
  headers: range ? { range } : {},
  user,
});

let asset;

beforeEach(async () => {
  if (!available) return;
  await MediaAsset.deleteMany({});
  await storage.ensureReady();
  await storage.put('a-church/resources/range-test.bin', BYTES);
  asset = await MediaAsset.create({
    storageKey: 'a-church/resources/range-test.bin',
    churchSlug: 'a-church',
    kind: 'document',
    mimeType: 'application/pdf',
    filename: 'range-test.pdf',
    bytes: BYTES.length,
    checksum: 'range-test',
    visibility: 'public',
  });
});

describe('serving a range', () => {
  it('answers a range request with 206 and only those bytes', async () => {
    if (!available) return;
    const res = await ask(asset, 'bytes=4-9');

    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes 4-9/${BYTES.length}`);
    expect(res.headers['content-length']).toBe(6);
    expect(res.headers['accept-ranges']).toBe('bytes');
  });

  it('reads an open-ended range to the end of the file', async () => {
    if (!available) return;
    const res = await ask(asset, 'bytes=15-');

    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes 15-19/${BYTES.length}`);
    expect(res.headers['content-length']).toBe(5);
  });

  it('reads a suffix range as the last bytes of the file', async () => {
    if (!available) return;
    const res = await ask(asset, 'bytes=-4');

    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes 16-19/${BYTES.length}`);
  });

  it('refuses a range that starts past the end', async () => {
    if (!available) return;
    const res = await ask(asset, 'bytes=99-');

    expect(res.statusCode).toBe(416);
    expect(res.headers['content-range']).toBe(`bytes */${BYTES.length}`);
  });

  it('still serves the whole file when no range is asked for, and says it could have', async () => {
    if (!available) return;
    const res = await ask(asset, undefined);

    expect(res.statusCode).toBe(200);
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-length']).toBe(BYTES.length);
  });
});

describe('who may read a file that was sold', () => {
  let Church; let ChurchMembership; let Enrollment; let Resource; let User;
  let paid; let buyer; let stranger; let staff;

  beforeEach(async () => {
    if (!available) return;
    ({ Church } = await import('../models/Church.js'));
    ({ ChurchMembership } = await import('../models/ChurchMembership.js'));
    ({ Enrollment } = await import('../models/Enrollment.js'));
    ({ Resource } = await import('../models/Resource.js'));
    ({ User } = await import('../models/User.js'));

    await Promise.all([
      Church.deleteMany({}), ChurchMembership.deleteMany({}),
      Enrollment.deleteMany({}), Resource.deleteMany({}), User.deleteMany({}),
    ]);

    await storage.put('a-church/resources/sold.bin', BYTES);
    paid = await MediaAsset.create({
      storageKey: 'a-church/resources/sold.bin',
      churchSlug: 'a-church',
      kind: 'document',
      mimeType: 'application/pdf',
      filename: 'sold.pdf',
      bytes: BYTES.length,
      checksum: 'sold',
      visibility: 'private',
    });

    await Church.create({ slug: 'a-church', name: 'A Church' });
    await Resource.create({
      slug: 'a-book', churchSlug: 'a-church', title: 'A Book',
      price: 10, status: 'published', fileMediaIds: [paid._id],
    });

    buyer = await User.create({ name: 'Buyer', email: 'buyer@example.com' });
    stranger = await User.create({ name: 'Stranger', email: 'stranger@example.com' });
    staff = await User.create({ name: 'Staff', email: 'staff@example.com', accountKind: 'church' });

    await Enrollment.create({ userId: buyer._id, kind: 'resource', resourceSlug: 'a-book', churchSlug: 'a-church' });
    await ChurchMembership.create({ churchSlug: 'a-church', userId: staff._id, role: 'admin', status: 'active' });
  });

  it('refuses someone who has not bought it', async () => {
    if (!available) return;
    expect((await ask(paid, undefined, stranger)).statusCode).toBe(403);
  });

  it('refuses someone who is not signed in at all', async () => {
    if (!available) return;
    expect((await ask(paid, undefined, undefined)).statusCode).toBe(403);
  });

  it('serves it to the person who bought it', async () => {
    if (!available) return;
    expect((await ask(paid, undefined, buyer)).statusCode).toBe(200);
  });

  it('serves it to the church that sells it, so the console can preview it', async () => {
    if (!available) return;
    expect((await ask(paid, undefined, staff)).statusCode).toBe(200);
  });
});

describe('uploading', () => {
  const send = (headers, body) => {
    const req = {
      get: (header) => headers[header.toLowerCase()],
      church: { slug: 'a-church' },
      user: { _id: new mongoose.Types.ObjectId() },
      // `readBody` consumes the request as a stream.
      on(event, cb) {
        if (event === 'data') cb(body);
        if (event === 'end') cb();
        return req;
      },
    };
    return run(media.upload, req);
  };

  it('stores a file as private when the console asks for it', async () => {
    if (!available) return;
    await send(
      {
        'x-media-kind': 'document',
        'x-media-folder': 'resources',
        'x-filename': 'private.pdf',
        'x-media-visibility': 'private',
      },
      Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64, 0x20)]),
    );

    const stored = await MediaAsset.findOne({ filename: 'private.pdf' });
    expect(stored.visibility).toBe('private');
  });

  it('leaves a cover public, because it is what sells the item', async () => {
    if (!available) return;
    await send(
      {
        'x-media-kind': 'document',
        'x-media-folder': 'resources',
        'x-filename': 'public.pdf',
      },
      Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 0x21)]),
    );

    const stored = await MediaAsset.findOne({ filename: 'public.pdf' });
    expect(stored.visibility).toBe('public');
  });
});
