# Learning Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give church-published materials — books, audiobooks, study guides, sermon series — a public surface, folded together with coursework into one `/learning` catalogue, and make the files they sell deliverable honestly.

**Architecture:** A `$unionWith` aggregation projects `Course` and `Resource` into one card shape so the catalogue paginates and counts across both. A new `/materials/:slug` page switches its body on the kind of media and plays audio or video inline. Underneath, files attached to a material become private assets, `media.serve` learns HTTP Range, and the console gains video upload plus a public sample.

**Tech Stack:** Node 20, Express 5, Mongoose 8 (MongoDB 4.4+ for `$unionWith`), React 19 with React Router, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-learning-catalogue-design.md`

## Global Constraints

- **Prose style.** This codebase writes comments as full sentences explaining *why*, never *what*. Match the surrounding density; do not add narration to obvious code.
- **British spelling** in user-facing copy ("basket", not "cart"; "catalogue"). The word for a paid item on public surfaces is **material**, never "resource" — `resource` stays the internal/API name.
- **No new dependencies.** Everything here is buildable with what `package.json` already has. Players are native `<audio>`/`<video>`.
- **Money** is a plain number of major units; render with `money()` from `client/src/lib/format.js`.
- **API envelope** is always `{ success: true, data }` or `{ success: false, message }`. The client's `api` helper unwraps `data`.
- **Tests** live in `server/__tests__/*.test.js` and connect to a real Mongo, skipping the suite when it is unavailable. There is no client test harness in this repo and this plan does not add one — client tasks verify with `npm run lint`, `npm run build`, and a described manual check.
- **Commit trailers.** Every commit ends with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01BJGBiRw6L7hTte9GsRaqkM
  ```

---

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `server/controllers/catalogue.controller.js` | The combined `/learning` list. Kept out of `learning.controller.js`, which is about enrolment and the player, not browsing. |
| `server/migrations/007-private-resource-files.js` | One-time flip of already-uploaded material files to private. |
| `server/__tests__/catalogue.integration.test.js` | The union: filters, paging, facets. |
| `server/__tests__/media.integration.test.js` | Range responses and private-file access. |
| `client/src/pages/Learning.jsx` | The catalogue page. Replaces `Courses.jsx`. |
| `client/src/pages/Material.jsx` | Material detail, kind-aware. |
| `client/src/components/MediaPlayer.jsx` | One component switching `<audio>`/`<video>` on mime type. |

**Modified**

| File | Change |
| --- | --- |
| `server/lib/storage/local.js` | `stream(key, { start, end })`. |
| `server/lib/storage/index.js` | Contract comment names the new argument. |
| `server/controllers/media.controller.js` | Range in `serve`; `x-media-visibility` in `upload`; church branch in `canReadPrivate`. |
| `server/controllers/market.controller.js` | `resourceDetail` gains ownership and sample; `search` returns materials. |
| `server/routes/public.js` | `GET /learning`. |
| `client/src/components/cards.jsx` | `MaterialCard`. |
| `client/src/App.jsx` | `/learning`, `/materials/:slug`, redirects. |
| `client/src/components/Layout.jsx` | Footer link. |
| `client/src/pages/Cart.jsx` | Cross-sell links to `/materials`. |
| `client/src/pages/ChurchDetail.jsx` | Material cards become `MaterialCard`. |
| `client/src/pages/Search.jsx` | Materials result group. |
| `client/src/pages/manage/Resources.jsx` | Video upload, sample slot, private file uploads. |

**Deleted**

- `client/src/pages/Courses.jsx` — becomes `Learning.jsx` in Task 7.

---

### Task 1: Range requests

Video will not play and long audio will not seek without this. It comes first because Task 8's player depends on it.

**Files:**
- Modify: `server/lib/storage/local.js:41`
- Modify: `server/lib/storage/index.js:3-5`
- Modify: `server/controllers/media.controller.js` (the `serve` handler)
- Test: `server/__tests__/media.integration.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `storage.stream(key, { start, end })` — both bounds inclusive, both optional; omitting them streams the whole file. `media.serve` answering `206` with `Content-Range: bytes <start>-<end>/<total>` and `Accept-Ranges: bytes`.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/media.integration.test.js`:

```js
import fs from 'node:fs/promises';
import path from 'node:path';

import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Serving a stored file: the range arithmetic a player depends on, and the
 * rule that a file someone paid for is not readable by someone who did not.
 */

const URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/kingdom-network-test-media';

let available = true;
let media; let storage; let env;
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
  ({ env } = await import('../config/env.js'));
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
    const res = await run(media.serve, {
      params: { 0: asset.storageKey },
      get: (h) => (h.toLowerCase() === 'range' ? 'bytes=4-9' : undefined),
      headers: { range: 'bytes=4-9' },
    });

    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes 4-9/${BYTES.length}`);
    expect(res.headers['content-length']).toBe(6);
    expect(res.headers['accept-ranges']).toBe('bytes');
  });

  it('reads an open-ended range to the end of the file', async () => {
    if (!available) return;
    const res = await run(media.serve, {
      params: { 0: asset.storageKey },
      get: (h) => (h.toLowerCase() === 'range' ? 'bytes=15-' : undefined),
      headers: { range: 'bytes=15-' },
    });

    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes 15-19/${BYTES.length}`);
  });

  it('refuses a range that starts past the end', async () => {
    if (!available) return;
    const res = await run(media.serve, {
      params: { 0: asset.storageKey },
      get: (h) => (h.toLowerCase() === 'range' ? 'bytes=99-' : undefined),
      headers: { range: 'bytes=99-' },
    });

    expect(res.statusCode).toBe(416);
    expect(res.headers['content-range']).toBe(`bytes */${BYTES.length}`);
  });

  it('still serves the whole file when no range is asked for, and says it could have', async () => {
    if (!available) return;
    const res = await run(media.serve, {
      params: { 0: asset.storageKey },
      get: () => undefined,
      headers: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-length']).toBe(BYTES.length);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run server/__tests__/media.integration.test.js`
Expected: FAIL — the 206 assertions fail because `serve` always answers 200.

- [ ] **Step 3: Teach the storage driver to read a slice**

In `server/lib/storage/local.js`, replace the `stream` export:

```js
/**
 * Both bounds are inclusive, matching the HTTP Range header rather than the
 * usual half-open convention — the caller is always translating one to the
 * other, so it may as well happen once, here.
 */
export const stream = (key, { start, end } = {}) =>
  createReadStream(resolveKey(key), start == null ? undefined : { start, end });
```

In `server/lib/storage/index.js`, update the contract comment:

```js
// One driver today. `put/get/stream/stat/remove/publicUrl/ensureReady` is the
// contract a replacement has to satisfy. `stream` takes an optional
// `{ start, end }` — inclusive bounds, for serving a byte range.
```

- [ ] **Step 4: Parse the header in `serve`**

In `server/controllers/media.controller.js`, add above `serve`:

```js
/**
 * A `Range` header, resolved against a known file size. Answers null when the
 * header is absent or in a form we do not serve; `unsatisfiable` when it asks
 * for bytes that are not there, which is a 416 rather than a quiet full body.
 *
 * Only the single-range `bytes=` form is handled. Multipart ranges are legal
 * and no browser asks for them.
 */
export const parseRange = (header, size) => {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  // A suffix range — "the last N bytes".
  if (rawStart === '') {
    const length = Number(rawEnd);
    if (!length) return { unsatisfiable: true };
    return { start: Math.max(0, size - length), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (start >= size || end < start) return { unsatisfiable: true };
  return { start, end };
};
```

Then rewrite the tail of `serve`, from the `storage.stat` call down, as:

```js
  const info = await storage.stat(storageKey);
  if (!info) return res.status(404).json({ success: false, message: 'That file is no longer stored.' });

  res.setHeader('Content-Type', asset.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${asset.filename ?? 'file'}"`);
  // Nothing served from here is ever a page; stop a browser deciding otherwise.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Said even on a full response, so a player knows it may seek later.
  res.setHeader('Accept-Ranges', 'bytes');

  const range = parseRange(req.get('range'), info.bytes);

  if (range?.unsatisfiable) {
    res.setHeader('Content-Range', `bytes */${info.bytes}`);
    return res.status(416).end();
  }

  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${info.bytes}`);
    res.setHeader('Content-Length', range.end - range.start + 1);
    return storage.stream(storageKey, range).pipe(res);
  }

  res.setHeader('Content-Length', info.bytes);
  storage.stream(storageKey).pipe(res);
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run server/__tests__/media.integration.test.js`
Expected: PASS, all four.

- [ ] **Step 6: Commit**

```bash
git add server/lib/storage/local.js server/lib/storage/index.js \
        server/controllers/media.controller.js server/__tests__/media.integration.test.js
git commit -m "feat: serve byte ranges from stored media

A player cannot seek — and Safari will not start a video at all —
without 206 responses, so nothing a church uploads as video is
watchable until the file server answers a Range header.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJGBiRw6L7hTte9GsRaqkM"
```

---

### Task 2: Files a church sells become private

**Files:**
- Modify: `server/controllers/media.controller.js` (`upload`, `canReadPrivate`)
- Create: `server/migrations/007-private-resource-files.js`
- Test: `server/__tests__/media.integration.test.js` (append)

**Interfaces:**
- Consumes: Task 1's test file and `capture()` helper.
- Produces: `upload` honouring `x-media-visibility: private`; `canReadPrivate` returning true for a member of the owning church holding `media:write`.

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/media.integration.test.js`:

```js
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

  const read = (user) => run(media.serve, {
    params: { 0: paid.storageKey },
    get: () => undefined,
    headers: {},
    user,
  });

  it('refuses someone who has not bought it', async () => {
    if (!available) return;
    const res = await read(stranger);
    expect(res.statusCode).toBe(403);
  });

  it('refuses someone who is not signed in at all', async () => {
    if (!available) return;
    const res = await read(undefined);
    expect(res.statusCode).toBe(403);
  });

  it('serves it to the person who bought it', async () => {
    if (!available) return;
    const res = await read(buyer);
    expect(res.statusCode).toBe(200);
  });

  it('serves it to the church that sells it, so the console can preview it', async () => {
    if (!available) return;
    const res = await read(staff);
    expect(res.statusCode).toBe(200);
  });
});

describe('uploading', () => {
  it('stores a file as private when the console asks for it', async () => {
    if (!available) return;
    const headers = {
      'x-media-kind': 'document',
      'x-media-folder': 'resources',
      'x-filename': 'private.pdf',
      'x-media-visibility': 'private',
    };
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64, 0x20)]);

    const req = {
      get: (h) => headers[h.toLowerCase()],
      church: { slug: 'a-church' },
      user: { _id: new mongoose.Types.ObjectId() },
      // `readBody` consumes the request as a stream.
      on(event, cb) {
        if (event === 'data') cb(pdf);
        if (event === 'end') cb();
        return req;
      },
    };

    const res = await run(media.upload, req);
    expect(res.body.data.visibility ?? 'private').toBeDefined();

    const stored = await MediaAsset.findOne({ filename: 'private.pdf' });
    expect(stored.visibility).toBe('private');
  });

  it('leaves a cover public, because it is what sells the item', async () => {
    if (!available) return;
    const headers = {
      'x-media-kind': 'document',
      'x-media-folder': 'resources',
      'x-filename': 'public.pdf',
    };
    const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 0x21)]);

    const req = {
      get: (h) => headers[h.toLowerCase()],
      church: { slug: 'a-church' },
      user: { _id: new mongoose.Types.ObjectId() },
      on(event, cb) {
        if (event === 'data') cb(pdf);
        if (event === 'end') cb();
        return req;
      },
    };

    await run(media.upload, req);
    const stored = await MediaAsset.findOne({ filename: 'public.pdf' });
    expect(stored.visibility).toBe('public');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run server/__tests__/media.integration.test.js`
Expected: FAIL — the church-staff read is 403, and the private upload is stored public.

- [ ] **Step 3: Honour the visibility header on upload**

In `server/controllers/media.controller.js`, inside `upload`, replace `visibility: 'public',` with:

```js
    // A file a church sells is private; its cover and its sample are not.
    // The console says which, because only the console knows what it is
    // attaching the file to.
    visibility: req.get('x-media-visibility') === 'private' ? 'private' : 'public',
```

- [ ] **Step 4: Let the owning church read its own files**

In `canReadPrivate`, replace the existing membership branch with one that covers both reasons a church member reads a file:

```js
  // The church assessing the application may read what was submitted to it,
  // and the church selling a book may read the book it uploaded.
  const membership = await ChurchMembership.findOne({ churchSlug: asset.churchSlug, userId: user._id, status: 'active' });
  if (membership && (membership.can('applications:read') || membership.can('media:write'))) return true;
```

- [ ] **Step 5: Write the migration**

Create `server/migrations/007-private-resource-files.js`:

```js
export const id = '007-private-resource-files';
export const description = 'Make the files a church sells private, so a purchase is what grants access';

/**
 * Every file uploaded before this was stored public, which meant the URL in a
 * buyer's library was equally good in anyone else's hands. Covers and samples
 * are deliberately left alone: they are the part that sells the item.
 */
export const up = async (db) => {
  const sold = await db
    .collection('resources')
    .distinct('fileMediaIds', { fileMediaIds: { $exists: true, $ne: [] } });

  if (!sold.length) return;

  await db.collection('mediaassets').updateMany(
    { _id: { $in: sold }, visibility: { $ne: 'private' } },
    { $set: { visibility: 'private' } },
  );
};
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run server/__tests__/media.integration.test.js`
Expected: PASS.

- [ ] **Step 7: Run the migration against the dev database**

Run: `npm run migrate`
Expected: `007-private-resource-files` reported as applied.

- [ ] **Step 8: Commit**

```bash
git add server/controllers/media.controller.js server/migrations/007-private-resource-files.js \
        server/__tests__/media.integration.test.js
git commit -m "fix: a file a church sells is private

Every paid PDF and audio file was stored public and served with a
year-long immutable cache, so the URL handed to a buyer worked just as
well for anyone they passed it to. canReadPrivate already knew how to
recognise a buyer; nothing had ever marked the files private, so that
branch never ran.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJGBiRw6L7hTte9GsRaqkM"
```

---

### Task 3: The combined catalogue endpoint

**Files:**
- Create: `server/controllers/catalogue.controller.js`
- Modify: `server/routes/public.js:25` (beside the course routes)
- Test: `server/__tests__/catalogue.integration.test.js`

**Interfaces:**
- Consumes: `live()` and `publicFilter()` from `server/lib/visibility.js` — check the actual export site in `market.controller.js` and reuse the same import.
- Produces: `GET /learning` answering

  ```
  { items: Card[], total, page, pages,
    facets: { formats, categories, levels, churches } }
  ```

  where a `Card` is `{ kind, slug, title, subtitle, churchSlug, church, price, compareAtPrice, currency, coverImage, coverAlt, category, level, minutes, lectureCount, pages, authorName, rating, ratingCount, learners, bestseller, createdAt }`, and `kind` is `'course'` or one of `RESOURCE_KINDS`.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/catalogue.integration.test.js`:

```js
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
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run server/__tests__/catalogue.integration.test.js`
Expected: FAIL — `Cannot find module '../controllers/catalogue.controller.js'`.

- [ ] **Step 3: Write the controller**

Create `server/controllers/catalogue.controller.js`. The `publicFilter` import matches `market.controller.js:5`:

```js
import { asyncHandler } from '../middleware/asyncHandler.js';
import { publicFilter } from '../lib/visibility.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Resource } from '../models/Resource.js';

/**
 * One catalogue over coursework and materials.
 *
 * They are separate collections because they are separate things to author —
 * a course has lectures and progress, a book is a file someone downloads — but
 * to a person looking for something to learn from they are one shelf. A union
 * keeps that shelf honest: paging and counts describe the whole of it rather
 * than one half plus an estimate.
 */

const SORTS = {
  popular: { learners: -1, createdAt: -1 },
  rating: { rating: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  'price-asc': { price: 1, createdAt: -1 },
  'price-desc': { price: -1, createdAt: -1 },
};

// `$literal` throughout: a bare string in $project is read as a field path, and
// a bare null as an exclusion, so both need saying explicitly.
const COURSE_CARD = {
  $project: {
    _id: 0,
    kind: { $literal: 'course' },
    slug: 1, title: 1, subtitle: 1, churchSlug: 1,
    price: 1, compareAtPrice: 1, currency: 1,
    coverImage: 1, coverAlt: 1,
    category: 1, level: 1,
    minutes: '$totalMinutes',
    lectureCount: 1,
    rating: 1, ratingCount: 1, learners: 1,
    bestseller: 1,
    createdAt: 1,
  },
};

const RESOURCE_CARD = {
  $project: {
    _id: 0,
    kind: '$kind',
    slug: 1, title: 1, subtitle: 1, churchSlug: 1,
    price: 1, compareAtPrice: 1, currency: 1,
    coverImage: 1, coverAlt: 1,
    minutes: '$durationMinutes',
    pages: 1,
    authorName: 1,
    createdAt: 1,
  },
};

const rx = (term) => new RegExp(String(term).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/**
 * The union, filtered by everything except format. Both facet counts and the
 * page itself are built from this, which is what lets the format filter stay
 * changeable: its own counts must not be narrowed by itself.
 */
const unionStages = async ({ q, category, level, church }) => {
  const visible = { status: 'published', ...(await publicFilter()) };

  const courseMatch = { ...visible };
  const resourceMatch = { ...visible };

  if (church) {
    courseMatch.churchSlug = church;
    resourceMatch.churchSlug = church;
  }
  if (q) {
    courseMatch.$or = [{ title: rx(q) }, { subtitle: rx(q) }, { tags: rx(q) }, { category: rx(q) }];
    resourceMatch.$or = [{ title: rx(q) }, { subtitle: rx(q) }, { tags: rx(q) }, { authorName: rx(q) }];
  }

  // Subject and level describe coursework only. Choosing one is choosing
  // courses, so the other side of the union drops out rather than being
  // filtered by a field it does not have.
  const coursesOnly = Boolean(category || level);
  if (category) courseMatch.category = category;
  if (level) courseMatch.level = level;

  return [
    { $match: courseMatch },
    COURSE_CARD,
    ...(coursesOnly
      ? []
      : [{ $unionWith: { coll: Resource.collection.name, pipeline: [{ $match: resourceMatch }, RESOURCE_CARD] } }]),
  ];
};

export const list = asyncHandler(async (req, res) => {
  const { q, format, category, level, church, sort = 'popular', page = '1', limit = '12' } = req.query;

  const perPage = Math.min(Number(limit) || 12, 48);
  const current = Math.max(Number(page) || 1, 1);
  const skip = (current - 1) * perPage;

  const stages = await unionStages({ q, category, level, church });
  const formatMatch = format ? [{ $match: { kind: format } }] : [];

  const [paged, formats] = await Promise.all([
    Course.aggregate([
      ...stages,
      ...formatMatch,
      {
        $facet: {
          items: [{ $sort: SORTS[sort] ?? SORTS.popular }, { $skip: skip }, { $limit: perPage }],
          total: [{ $count: 'n' }],
          categories: [{ $match: { category: { $ne: null } } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          levels: [{ $match: { level: { $ne: null } } }, { $group: { _id: '$level', count: { $sum: 1 } } }],
          churches: [{ $group: { _id: '$churchSlug', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        },
      },
    ]),
    // Counted before the format filter, so every format stays clickable.
    Course.aggregate([...stages, { $group: { _id: '$kind', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
  ]);

  const result = paged[0] ?? { items: [], total: [], categories: [], levels: [], churches: [] };
  const total = result.total[0]?.n ?? 0;

  const churches = await Church.find({}, 'slug name shortName monogram verified');
  const by = Object.fromEntries(churches.map((c) => [c.slug, c]));

  res.json({
    success: true,
    data: {
      items: result.items.map((item) => ({ ...item, church: by[item.churchSlug] ?? null })),
      total,
      page: current,
      pages: Math.ceil(total / perPage),
      facets: {
        formats: formats.map((f) => ({ value: f._id, count: f.count })),
        categories: result.categories.map((c) => ({ value: c._id, count: c.count })),
        levels: result.levels.map((l) => ({ value: l._id, count: l.count })),
        churches: result.churches.map((c) => ({ value: c._id, label: by[c._id]?.shortName ?? c._id, count: c.count })),
      },
    },
  });
});
```

- [ ] **Step 4: Route it**

In `server/routes/public.js`, add beside the course routes and import the controller at the top (`import * as catalogue from '../controllers/catalogue.controller.js';`):

```js
router.get('/learning', catalogue.list);
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run server/__tests__/catalogue.integration.test.js`
Expected: PASS, all nine.

- [ ] **Step 6: Run the whole suite, to be sure nothing else moved**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/controllers/catalogue.controller.js server/routes/public.js \
        server/__tests__/catalogue.integration.test.js
git commit -m "feat: one catalogue over coursework and materials

A union rather than two lists reconciled in the client, so paging walks
both collections in one order and the filter counts describe the set
being looked at. The format facet is counted before the format filter
is applied, which is what keeps it changeable once something is chosen.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJGBiRw6L7hTte9GsRaqkM"
```

---

### Task 4: A material's detail, without handing out what was not bought

**Files:**
- Modify: `server/controllers/market.controller.js` (`resourceDetail`)
- Modify: `server/routes/public.js:28` — `resourceDetail` needs `optionalAuth` to know who is asking
- Test: `server/__tests__/catalogue.integration.test.js` (append)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `GET /resources/:slug` answering `{ resource, church, alsoFrom, owned, sample, files }` where `sample` is `{ url, mimeType, kind } | null`, `files` is the same shape as an array and is `[]` unless `owned`, and `resource` never carries `fileMediaIds`.

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/catalogue.integration.test.js`:

```js
describe('a material’s detail page', () => {
  let MediaAsset; let Enrollment; let User;
  let market; let file; let sample; let buyer;

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
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run server/__tests__/catalogue.integration.test.js -t "material’s detail"`
Expected: FAIL — `data.sample` is undefined.

- [ ] **Step 3: Rewrite `resourceDetail`**

In `server/controllers/market.controller.js`, replace `resourceDetail` with:

```js
/**
 * Everything a page needs to sell one material and, to the person who has
 * bought it, to play it. The paid files are attached only in that second case:
 * a private asset would refuse the request anyway, but a URL that reads as an
 * invitation and then refuses is worse than not offering it.
 */
export const resourceDetail = asyncHandler(async (req, res) => {
  const resource = await Resource.findOne({ slug: req.params.slug, status: 'published' });
  if (!resource) return res.status(404).json({ success: false, message: 'That is not available.' });

  const [church, alsoFrom, owned, assets] = await Promise.all([
    Church.findOne({ slug: resource.churchSlug }, 'slug name shortName monogram city country verified'),
    Resource.find(
      { churchSlug: resource.churchSlug, slug: { $ne: resource.slug }, status: 'published' },
      'slug title subtitle kind coverImage price pages durationMinutes churchSlug',
    ).limit(4),
    req.user
      ? Enrollment.exists({ userId: req.user._id, kind: 'resource', resourceSlug: resource.slug })
      : null,
    MediaAsset.find(
      { _id: { $in: [...(resource.fileMediaIds ?? []), resource.previewMediaId].filter(Boolean) } },
      'storageKey filename mimeType kind bytes durationSeconds',
    ),
  ]);

  const shapeAsset = (asset) => ({
    id: String(asset._id),
    url: `/api/media/file/${asset.storageKey}`,
    filename: asset.filename,
    mimeType: asset.mimeType,
    kind: asset.kind,
    bytes: asset.bytes,
    durationSeconds: asset.durationSeconds,
  });

  const by = Object.fromEntries(assets.map((a) => [String(a._id), a]));
  const sample = resource.previewMediaId ? by[String(resource.previewMediaId)] : null;

  const card = resource.toObject();
  delete card.fileMediaIds;
  delete card.previewMediaId;

  res.json({
    success: true,
    data: {
      resource: card,
      church,
      alsoFrom,
      owned: Boolean(owned),
      sample: sample ? shapeAsset(sample) : null,
      files: owned
        ? (resource.fileMediaIds ?? []).map((id) => by[String(id)]).filter(Boolean).map(shapeAsset)
        : [],
    },
  });
});
```

Add `Enrollment` and `MediaAsset` to the imports at the top of the file if they are not already there.

- [ ] **Step 4: Let the endpoint see who is asking**

In `server/routes/public.js`, change the resource detail route to carry `optionalAuth`:

```js
router.get('/resources/:slug', optionalAuth, market.resourceDetail);
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run server/__tests__/catalogue.integration.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/market.controller.js server/routes/public.js \
        server/__tests__/catalogue.integration.test.js
git commit -m "feat: a material's detail knows who is asking

The sample is offered to everyone because it is what sells the item; the
files are attached only for someone who has bought it. A private asset
would refuse the request either way, but a URL that reads as an offer
and then refuses is worse than not making one.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJGBiRw6L7hTte9GsRaqkM"
```

---

### Task 5: Materials in search

**Files:**
- Modify: `server/controllers/market.controller.js` (`search`)
- Test: `server/__tests__/catalogue.integration.test.js` (append)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `GET /search` answering with an added `materials: Card[]` key, capped at 8, alongside the existing `offerings`, `churches`, `total`, `pages`, `facets`. `total` continues to count offerings only.

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/catalogue.integration.test.js`:

```js
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
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run server/__tests__/catalogue.integration.test.js -t "search"`
Expected: FAIL — `data.materials` is undefined.

- [ ] **Step 3: Add materials to the search**

In `server/controllers/market.controller.js`, inside `search`, add a seventh entry to the existing `Promise.all` array:

```js
      // Materials are a second group rather than a second kind of row.
      // Standing is what the platform is for; a book does not compete with an
      // ordination for the same line of a result list.
      term
        ? Resource.find(
            {
              status: 'published',
              ...(await publicFilter()),
              $or: [{ title: rx }, { subtitle: rx }, { authorName: rx }, { tags: rx }],
            },
            'slug title subtitle kind coverImage coverAlt price compareAtPrice currency churchSlug pages durationMinutes authorName',
          ).limit(8)
        : [],
```

Destructure it as `matchedMaterials` in the surrounding assignment, and add to the response `data`:

```js
      materials: await withChurch(matchedMaterials),
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run server/__tests__/catalogue.integration.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/market.controller.js server/__tests__/catalogue.integration.test.js
git commit -m "feat: search finds materials

As their own group rather than as rows among the credentials. Standing
is what the platform is for, and a book should not compete with an
ordination for the same line.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJGBiRw6L7hTte9GsRaqkM"
```

---

### Task 6: The card and the player

Two small components three later tasks depend on, so they land together.

**Files:**
- Modify: `client/src/components/cards.jsx`
- Create: `client/src/components/MediaPlayer.jsx`

**Interfaces:**
- Consumes: `useCart()` from `client/src/lib/cart.jsx`; `Price`, `Verified` from `client/src/components/ui.jsx`; `duration`, `plural` from `client/src/lib/format.js`.
- Produces:
  - `<MaterialCard item={Card} />` — renders any catalogue card, course or material, linking to `/courses/:slug` or `/materials/:slug` by `item.kind`.
  - `<MediaPlayer asset={{ url, mimeType, filename }} />` — `<video>` for `video/*`, `<audio>` for `audio/*`, and a download link for anything else.

- [ ] **Step 1: Write the player**

Create `client/src/components/MediaPlayer.jsx`:

```jsx
import { Download, FileText } from 'lucide-react';

/**
 * Whatever the church uploaded, played where it stands.
 *
 * Native controls on purpose: a church's sermon recording is not the place to
 * introduce a bespoke transport, and the browser's own controls already know
 * how to seek, which works because the file server answers byte ranges.
 */
export const MediaPlayer = ({ asset, poster }) => {
  if (!asset) return null;

  if (asset.mimeType?.startsWith('video/')) {
    return (
      <video className="media-player" controls preload="metadata" poster={poster} playsInline>
        <source src={asset.url} type={asset.mimeType} />
        Your browser cannot play this video.
      </video>
    );
  }

  if (asset.mimeType?.startsWith('audio/')) {
    return (
      <audio className="media-player media-player-audio" controls preload="metadata">
        <source src={asset.url} type={asset.mimeType} />
        Your browser cannot play this audio.
      </audio>
    );
  }

  return (
    <a className="btn btn-outline btn-sm" href={asset.url} target="_blank" rel="noreferrer">
      {asset.mimeType === 'application/pdf' ? <FileText size={14} /> : <Download size={14} />}
      {asset.filename ?? 'Open the file'}
    </a>
  );
};
```

- [ ] **Step 2: Write the card**

Append to `client/src/components/cards.jsx`:

```jsx
const KIND_LABEL = {
  course: 'Course',
  book: 'Book',
  audiobook: 'Audiobook',
  'study-guide': 'Study guide',
  'sermon-series': 'Sermon series',
  album: 'Album',
  workbook: 'Workbook',
};

/**
 * One card for the whole catalogue.
 *
 * A course and a book are both things you buy, so they are not styled apart —
 * the tag is what tells them apart, and the price and basket are common to
 * both. The line DESIGN.md draws is between a material and standing, and
 * standing is not on this shelf.
 */
export const MaterialCard = ({ item }) => {
  const { add, has } = useCart();
  const isCourse = item.kind === 'course';
  const cartKind = isCourse ? 'course' : 'resource';
  const to = isCourse ? `/courses/${item.slug}` : `/materials/${item.slug}`;
  const inCart = has(cartKind, item.slug);
  const church = item.church;

  const facts = [
    item.minutes ? duration(item.minutes) : null,
    isCourse && item.lectureCount ? plural(item.lectureCount, 'lesson') : null,
    !isCourse && item.pages ? plural(item.pages, 'page') : null,
    isCourse ? item.level : item.authorName,
  ].filter(Boolean);

  return (
    <article className="card course-card">
      {item.bestseller && <span className="flag badge-bestseller">Bestseller</span>}
      <Link to={to} className="media media-3x2" tabIndex={-1} aria-hidden="true">
        <img src={item.coverImage} alt="" loading="lazy" width={800} height={534} />
      </Link>
      <div className="card-body">
        <span className="xs dim">{KIND_LABEL[item.kind] ?? item.kind}</span>
        <h3 className="course-title clamp-2"><Link to={to}>{item.title}</Link></h3>
        {church && (
          <Link to={`/churches/${church.slug}`} className="row small muted" style={{ gap: 6 }}>
            <span className="clamp-1">{church.shortName ?? church.name}</span>
            {church.verified && <Verified label="" size={13} />}
          </Link>
        )}
        {isCourse && <div className="row" style={{ gap: 8 }}><Stars rating={item.rating} count={item.ratingCount} size={13} /></div>}
        <div className="course-meta">
          {facts.map((fact, i) => (
            <span key={fact}>{i > 0 && <span className="dot" />}{fact}</span>
          ))}
        </div>
        <div className="course-foot">
          <Price amount={item.price} was={item.compareAtPrice} currency={item.currency} />
        </div>
        {inCart ? (
          <Link to="/cart" className="btn btn-outline btn-sm btn-block card-buy">In your basket <ArrowRight size={14} /></Link>
        ) : (
          <button type="button" className="btn btn-outline btn-sm btn-block card-buy"
            onClick={() => add({ kind: cartKind, slug: item.slug })}>
            <ShoppingBag size={14} /> {item.price ? 'Add to basket' : 'Get it free'}
          </button>
        )}
      </div>
    </article>
  );
};
```

- [ ] **Step 3: Add the player's styles**

Append to `client/src/styles/pages.css`:

```css
/* --- media player -------------------------------------------------------- */

.media-player {
  width: 100%;
  border-radius: var(--r-md);
  background: var(--bg-ink);
  display: block;
}

.media-player-audio {
  border-radius: var(--r-sm);
  background: var(--bg-sunken);
  height: 44px;
}
```

- [ ] **Step 4: Check it compiles**

Run: `npm run lint && npm run build`
Expected: no errors. (Nothing imports `MaterialCard` yet; the build proves the module parses and its imports resolve.)

- [ ] **Step 5: Commit**

```bash
git add client/src/components/cards.jsx client/src/components/MediaPlayer.jsx client/src/styles/pages.css
git commit -m "feat: a card for the whole catalogue and a player for any of it

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJGBiRw6L7hTte9GsRaqkM"
```

---

### Task 7: The `/learning` page

**Files:**
- Create: `client/src/pages/Learning.jsx`
- Delete: `client/src/pages/Courses.jsx`
- Modify: `client/src/App.jsx:24` (import), `:150` (routes)
- Modify: `client/src/components/Layout.jsx:342` (footer link)

**Interfaces:**
- Consumes: `GET /learning` from Task 3; `MaterialCard` from Task 6.
- Produces: the route `/learning`, with `/courses` redirecting to it.

- [ ] **Step 1: Write the page**

Create `client/src/pages/Learning.jsx` by adapting `client/src/pages/Courses.jsx`. Read that file first — the filter rail, results bar, empty state and pager are kept verbatim. The changes are:

Rename the component and point it at the new endpoint:

```jsx
const FORMATS = [
  { value: 'course', label: 'Course' },
  { value: 'book', label: 'Book' },
  { value: 'sermon-series', label: 'Sermon series' },
  { value: 'audiobook', label: 'Audiobook' },
  { value: 'study-guide', label: 'Study guide' },
  { value: 'workbook', label: 'Workbook' },
  { value: 'album', label: 'Album' },
];

export const Learning = () => {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = params.get('q') ?? '';
  const format = params.get('format') ?? '';
  const category = params.get('category') ?? '';
  const level = params.get('level') ?? '';
  const church = params.get('church') ?? '';
  const sort = params.get('sort') ?? 'popular';
  const page = Number(params.get('page') ?? 1);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (format) sp.set('format', format);
    if (category) sp.set('category', category);
    if (level) sp.set('level', level);
    if (church) sp.set('church', church);
    sp.set('sort', sort);
    sp.set('page', String(page));
    return `/learning?${sp}`;
  }, [q, format, category, level, church, sort, page]);

  const { data, error, loading, reload } = useApi(query);
```

Add `format` to `active`, ordered first:

```jsx
  const active = [
    q && { key: 'q', label: `“${q}”` },
    format && { key: 'format', label: FORMATS.find((f) => f.value === format)?.label ?? format },
    category && { key: 'category', label: category },
    level && { key: 'level', label: level },
    church && { key: 'church', label: data?.facets.churches.find((c) => c.value === church)?.label ?? church },
  ].filter(Boolean);
```

Change the header:

```jsx
        <div className="wrap stack stack-2">
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>{q ? `Results for “${q}”` : 'Learning'}</h1>
          <p className="muted" style={{ maxWidth: '62ch', margin: 0 }}>
            Courses, books, sermon series and study materials published by the churches on Kingdom Network.
          </p>
        </div>
```

Put Format first in the rail, taking the `borderTop: 'none'` that Subject currently carries, and label counts from the facet rather than the hardcoded list so a format with nothing in it does not appear:

```jsx
            <div className="filter-group" style={{ borderTop: 'none', paddingTop: 0 }}>
              <h5>Format</h5>
              <div className="filter-list">
                {(data?.facets.formats ?? []).map((f) => (
                  <FilterItem
                    key={f.value}
                    label={FORMATS.find((x) => x.value === f.value)?.label ?? f.value}
                    count={f.count}
                    on={format === f.value}
                    onToggle={() => toggle('format', f.value)}
                  />
                ))}
              </div>
            </div>
            <div className="filter-group">
              <h5>Subject</h5>
```

Change the count line and the grid:

```jsx
                <span className="small muted num">
                  {loading ? 'Loading…' : `${data?.total ?? 0} ${(data?.total ?? 0) === 1 ? 'item' : 'items'}`}
                </span>
```

```jsx
                  <div className="grid grid-3">
                    {data.items.map((item) => <MaterialCard key={`${item.kind}:${item.slug}`} item={item} />)}
                  </div>
```

And the empty state's `data.courses.length === 0` becomes `data.items.length === 0`.

Imports at the top become:

```jsx
import { MaterialCard } from '../components/cards.jsx';
import { Empty, ErrorState, SkeletonGrid } from '../components/ui.jsx';
import { useApi } from '../lib/useAsync.js';
```

(`plural` is no longer used; drop it from the import.)

- [ ] **Step 2: Delete the old page**

```bash
git rm client/src/pages/Courses.jsx
```

- [ ] **Step 3: Route it**

In `client/src/App.jsx`, replace the `Courses` import with:

```jsx
import { Learning } from './pages/Learning.jsx';
```

and the courses route with:

```jsx
      <Route path="learning" element={<Learning />} />
      <Route path="courses/:slug" element={<CourseDetail />} />
```

Then add to the block of redirects from earlier shapes of the product:

```jsx
      <Route path="courses" element={<RedirectWithQuery to="/learning" />} />
```

Add this helper beside `RequireAuth` in the same file — a bare `<Navigate>` drops the query string, which would throw away a search someone arrived with:

```jsx
/** Keeps the query string, so an old /courses?q=… link still lands on its results. */
const RedirectWithQuery = ({ to }) => {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
};
```

`useLocation` is already imported in this file.

- [ ] **Step 4: Update the footer**

In `client/src/components/Layout.jsx`, change the Coursework link:

```jsx
            <li><Link to="/learning">Learning</Link></li>
```

Check the same file for any other `/courses` link and change it too.

- [ ] **Step 5: Check the rest of the client for stale links**

Run: `grep -rn '"/courses"\|to="/courses"\|/courses?' client/src`
Change any list link found to `/learning`. Leave `/courses/${slug}` alone — course detail has not moved.

- [ ] **Step 6: Build and look at it**

Run: `npm run lint && npm run build`
Then run `npm run dev` and open `http://localhost:5173/learning`.
Expected: courses and materials in one grid, a Format group at the top of the rail, and clicking a format narrowing the grid while the other formats keep their counts. `/courses` should redirect, and `/courses?q=preaching` should land on `/learning?q=preaching`.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Learning.jsx client/src/App.jsx client/src/components/Layout.jsx
git commit -m "feat: /learning, one shelf for coursework and materials

Replaces /courses, which redirects and keeps its query string so an old
link still lands on its results.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJGBiRw6L7hTte9GsRaqkM"
```

---

### Task 8: The material detail page

**Files:**
- Create: `client/src/pages/Material.jsx`
- Modify: `client/src/App.jsx` (route)
- Modify: `client/src/pages/Cart.jsx:42`
- Modify: `client/src/styles/pages.css`

**Interfaces:**
- Consumes: `GET /resources/:slug` from Task 4; `MediaPlayer` from Task 6; `MaterialCard` from Task 6.
- Produces: the route `/materials/:slug`, and `/resources/:slug` redirecting to it.

- [ ] **Step 1: Write the page**

Create `client/src/pages/Material.jsx`:

```jsx
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Download, ShoppingBag } from 'lucide-react';

import { MaterialCard } from '../components/cards.jsx';
import { MediaPlayer } from '../components/MediaPlayer.jsx';
import { ErrorState, Price, Spinner, Verified } from '../components/ui.jsx';
import { useCart } from '../lib/cart.jsx';
import { duration, plural } from '../lib/format.js';
import { useApi } from '../lib/useAsync.js';

const KIND_LABEL = {
  book: 'Book',
  audiobook: 'Audiobook',
  'study-guide': 'Study guide',
  'sermon-series': 'Sermon series',
  album: 'Album',
  workbook: 'Workbook',
};

/**
 * One material, presented as whatever it actually is.
 *
 * A sermon series and a workbook are the same record with different files
 * attached, so the page reads the mime type rather than the kind: what decides
 * whether something plays is whether it is playable.
 */
export const Material = () => {
  const { slug } = useParams();
  const { data, error, loading, reload } = useApi(`/resources/${slug}`);
  const { add, has } = useCart();

  if (loading) return <div className="wrap band"><Spinner /></div>;
  if (error) return <div className="wrap band"><ErrorState error={error} onRetry={reload} /></div>;

  const { resource, church, alsoFrom, owned, sample, files } = data;
  const inCart = has('resource', resource.slug);

  const facts = [
    resource.pages ? plural(resource.pages, 'page') : null,
    resource.durationMinutes ? duration(resource.durationMinutes) : null,
    resource.language,
  ].filter(Boolean);

  return (
    <>
      <div className="band-warm material-head">
        <div className="wrap material-head-grid">
          <div className="material-cover">
            <img src={resource.coverImage} alt={resource.coverAlt ?? ''} />
          </div>

          <div className="stack stack-3">
            <span className="eyebrow">{KIND_LABEL[resource.kind] ?? 'Material'}</span>
            <h1>{resource.title}</h1>
            {resource.subtitle ? <p className="lede">{resource.subtitle}</p> : null}
            {resource.authorName ? <p className="muted" style={{ margin: 0 }}>By {resource.authorName}</p> : null}

            {church ? (
              <Link to={`/churches/${church.slug}`} className="row small" style={{ gap: 8 }}>
                <span>Published by {church.shortName ?? church.name}</span>
                {church.verified && <Verified label="" size={14} />}
              </Link>
            ) : null}

            {facts.length ? (
              <div className="course-meta">
                {facts.map((fact, i) => <span key={fact}>{i > 0 && <span className="dot" />}{fact}</span>)}
              </div>
            ) : null}
          </div>

          <aside className="panel material-buy">
            {owned ? (
              <div className="stack stack-3">
                <strong>Yours</strong>
                <p className="small muted" style={{ margin: 0 }}>
                  {plural(files.length, 'file')} to play or download. It stays in your library.
                </p>
                {files.map((file) => (
                  <div key={file.id} className="stack stack-2">
                    <MediaPlayer asset={file} poster={resource.coverImage} />
                    <a className="btn btn-outline btn-sm btn-block" href={file.url} download={file.filename}>
                      <Download size={14} /> Download
                    </a>
                  </div>
                ))}
                <Link className="link small" to="/me/library">Everything you own →</Link>
              </div>
            ) : (
              <div className="stack stack-3">
                <Price amount={resource.price} was={resource.compareAtPrice} currency={resource.currency} />
                {inCart ? (
                  <Link to="/cart" className="btn btn-primary btn-block">In your basket <ArrowRight size={14} /></Link>
                ) : (
                  <button type="button" className="btn btn-primary btn-block"
                    onClick={() => add({ kind: 'resource', slug: resource.slug })}>
                    <ShoppingBag size={15} /> {resource.price ? 'Add to basket' : 'Get it free'}
                  </button>
                )}
                <p className="xs dim" style={{ margin: 0 }}>
                  Bought once and kept. It appears in your library the moment the payment clears.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>

      <div className="wrap band">
        <div className="material-body">
          <div className="stack stack-5">
            {sample ? (
              <section className="stack stack-3">
                <h2>A sample</h2>
                <MediaPlayer asset={sample} poster={resource.coverImage} />
              </section>
            ) : null}

            {resource.description?.length ? (
              <section className="stack stack-3">
                <h2>About this {(KIND_LABEL[resource.kind] ?? 'material').toLowerCase()}</h2>
                {resource.description.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
              </section>
            ) : null}

            {!sample && !resource.description?.length ? (
              <p className="muted">
                {church?.shortName ?? 'This church'} has not added a description yet.
              </p>
            ) : null}
          </div>
        </div>

        {alsoFrom?.length ? (
          <section className="stack stack-4" style={{ marginTop: 'var(--s-7)' }}>
            <h2><BookOpen size={20} /> More from {church?.shortName ?? 'this church'}</h2>
            <div className="grid grid-3">
              {alsoFrom.map((item) => (
                <MaterialCard key={item.slug} item={{ ...item, church }} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
};
```

- [ ] **Step 2: Style it**

Append to `client/src/styles/pages.css`:

```css
/* --- one material -------------------------------------------------------- */

.material-head {
  border-bottom: 1px solid var(--line);
  padding-block: var(--s-7);
}

.material-head-grid {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 300px;
  gap: var(--s-6);
  align-items: start;
}

.material-cover img {
  width: 100%;
  border-radius: var(--r-md);
  box-shadow: 0 12px 32px rgb(20 23 26 / 18%);
}

.material-buy {
  padding: var(--s-5);
  position: sticky;
  top: var(--s-5);
}

.material-body {
  max-width: 68ch;
}

@media (width < 900px) {
  .material-head-grid {
    grid-template-columns: 140px minmax(0, 1fr);
  }

  .material-buy {
    grid-column: 1 / -1;
    position: static;
  }
}
```

- [ ] **Step 3: Route it**

In `client/src/App.jsx`, add the import and the routes:

```jsx
import { Material } from './pages/Material.jsx';
```

```jsx
      <Route path="materials/:slug" element={<Material />} />
```

and beside the other redirects:

```jsx
      <Route path="resources/:slug" element={<RedirectResource />} />
```

with, beside `RedirectWithQuery`:

```jsx
/** The API calls them resources; people do not. */
const RedirectResource = () => {
  const { slug } = useParams();
  return <Navigate to={`/materials/${slug}`} replace />;
};
```

`useParams` needs adding to the `react-router-dom` import in this file.

- [ ] **Step 4: Point the basket at the new path**

In `client/src/pages/Cart.jsx:42`:

```jsx
  const path = (i) => (i.kind === 'resource' ? `/materials/${i.slug}` : `/courses/${i.slug}`);
```

- [ ] **Step 5: Build and look at it**

Run: `npm run lint && npm run build`
Then with `npm run dev`, open a published material from `/learning`.
Expected: cover, title, church, price and a working Add to basket. If the material has a sample, it plays. Seek within an audio sample to confirm Task 1 is doing its job. `/resources/<slug>` should redirect to `/materials/<slug>`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Material.jsx client/src/App.jsx client/src/pages/Cart.jsx client/src/styles/pages.css
git commit -m "feat: a page for a material, playing whatever it is

Reads the mime type rather than the kind: a sermon series and a workbook
are the same record with different files attached, so what decides
whether something plays is whether it is playable.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJGBiRw6L7hTte9GsRaqkM"
```

---

### Task 9: The other two ways in

**Files:**
- Modify: `client/src/pages/ChurchDetail.jsx:157`
- Modify: `client/src/pages/Search.jsx`

**Interfaces:**
- Consumes: `MaterialCard` from Task 6; the `materials` key from Task 5.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Make the church-page cards links**

In `client/src/pages/ChurchDetail.jsx`, replace the inline `<article className="card church-resource-card">` block with `MaterialCard`, which is where this whole thread started — those cards were not links:

```jsx
              {resources.length && shows('resources') ? <div className="church-profile-rail"><h3>Books and materials</h3><div className="grid grid-3">{resources.map((resource) => (
                <MaterialCard key={resource.slug} item={{ ...resource, church }} />
              ))}</div></div> : null}
```

Add `MaterialCard` to the existing import from `../components/cards.jsx`. Remove the now-unused `FALLBACK_COVER` and `money` imports **only if** nothing else in the file uses them — check with `grep -n "FALLBACK_COVER\|money(" client/src/pages/ChurchDetail.jsx` first.

- [ ] **Step 2: Add a materials group to search**

In `client/src/pages/Search.jsx`, after the offerings results and before any pager, add:

```jsx
            {data.materials?.length ? (
              <section className="stack stack-4" style={{ marginTop: 'var(--s-7)' }}>
                <div className="row row-between">
                  <h2>Books and materials</h2>
                  <Link className="link small" to={`/learning?q=${encodeURIComponent(q)}`}>
                    All learning for “{q}” →
                  </Link>
                </div>
                <div className="grid grid-3">
                  {data.materials.map((m) => <MaterialCard key={m.slug} item={m} />)}
                </div>
              </section>
            ) : null}
```

Add `MaterialCard` to the imports, and `Link` from `react-router-dom` if it is not already imported. Use whatever the local variable for the search term is called in that file — read it first; the snippet above assumes `q`.

- [ ] **Step 3: Build and check both**

Run: `npm run lint && npm run build`
With `npm run dev`: open a church profile that has materials and click one — it should reach `/materials/:slug` rather than doing nothing. Then search for a term matching a material and confirm it appears under the credential results.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ChurchDetail.jsx client/src/pages/Search.jsx
git commit -m "feat: reach a material from a church page or a search

The cards on a church profile were not links, which is the dead end this
work started from.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJGBiRw6L7hTte9GsRaqkM"
```

---

### Task 10: The console catches up

**Files:**
- Modify: `client/src/pages/manage/Resources.jsx`

**Interfaces:**
- Consumes: `x-media-visibility` from Task 2.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Accept video, and mark sold files private**

In `client/src/pages/manage/Resources.jsx`, replace `attach` with a version that knows three destinations rather than two:

```jsx
  const attach = async (file, field) => {
    setUploading(field);
    try {
      const kind = file.type.startsWith('audio') ? 'audio'
        : file.type.startsWith('video') ? 'video'
        : file.type.startsWith('image') ? 'image'
        : 'document';

      const asset = await api.upload(`/manage/${churchSlug}/media`, file, {
        headers: {
          'x-media-kind': kind,
          'x-media-folder': 'resources',
          // What people pay for is private. The cover and the sample are the
          // parts that sell it, so they stay readable by anyone.
          ...(field === 'file' ? { 'x-media-visibility': 'private' } : {}),
        },
      });

      setEditing((r) => {
        if (field === 'cover') return { ...r, coverImage: asset.url, coverMediaId: asset.id };
        if (field === 'sample') return { ...r, previewMediaId: asset.id, previewUrl: asset.url };
        return { ...r, fileMediaIds: [...(r.fileMediaIds ?? []), asset.id] };
      });
    } catch (err) { fail(err); } finally { setUploading(null); }
  };
```

- [ ] **Step 2: Widen the file input and add the sample slot**

Replace the Files field in the editor dialog with:

```jsx
            <div className="a-field">
              <label>Files</label>
              <p className="help">
                {(editing.fileMediaIds ?? []).length} file(s) attached. Required before publishing.
                Only someone who has bought this can open them.
              </p>
              <FileDrop
                label="Attach the file"
                accept="application/pdf,audio/*,video/*"
                hint="A PDF, an audio file or a video"
                busy={uploading === 'file'}
                onFile={(f) => attach(f, 'file')}
              />
            </div>

            <div className="a-field">
              <label>Sample</label>
              <p className="help">
                The part anyone may see before buying — a first chapter, or a few minutes
                of the recording. Items without one sell badly.
              </p>
              {editing.previewMediaId ? (
                <p className="small muted" style={{ margin: 0 }}>
                  A sample is attached.{' '}
                  <button type="button" className="link"
                    onClick={() => setEditing({ ...editing, previewMediaId: undefined, previewUrl: undefined })}>
                    Replace it
                  </button>
                </p>
              ) : (
                <FileDrop
                  label="Attach a sample"
                  accept="application/pdf,audio/*,video/*"
                  hint="Shown on the public page"
                  busy={uploading === 'sample'}
                  onFile={(f) => attach(f, 'sample')}
                />
              )}
            </div>
```

- [ ] **Step 3: Let the page link to itself**

Add to the `ConsoleHeader`, so a church can see what it published:

```jsx
      <ConsoleHeader title="Books and materials" sub="Things people buy outright">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          <Plus size={15} strokeWidth={2} /> New
        </button>
      </ConsoleHeader>
```

and inside the editor dialog footer, when the item is published:

```jsx
            {editing?.status === 'published' ? (
              <a className="btn btn-ghost" href={`/materials/${editing.slug}`} target="_blank" rel="noreferrer">
                View it
              </a>
            ) : null}
```

- [ ] **Step 4: Confirm `previewMediaId` survives a save**

`RESOURCE_FIELDS` in `server/controllers/authoring.controller.js:473` already lists both `fileMediaIds` and `previewMediaId`, so the sample persists with no server change. Confirm it is still there rather than assuming — without it the sample uploads and is silently dropped on save.

Run: `grep -n "previewMediaId" server/controllers/authoring.controller.js`
Expected: a hit inside `RESOURCE_FIELDS`.

- [ ] **Step 5: Build and try it end to end**

Run: `npm run lint && npm run build`
With `npm run dev`, signed in as a church: create a material, attach an MP4 as the file and a short MP4 as the sample, publish it, then open `/materials/<slug>` signed out. The sample should play; the paid file should not be offered. Sign in as a buyer who owns it and confirm the file plays and downloads.

- [ ] **Step 6: Run the whole suite one last time**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/manage/Resources.jsx
git commit -m "feat: a church can upload video and mark a sample

The pipeline already sniffed and stored MP4 and WebM; only the file
input said otherwise, so a sermon recording could not be attached to the
thing it was for.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJGBiRw6L7hTte9GsRaqkM"
```

---

## Verification

After the last task:

- [ ] `npm test` passes.
- [ ] `npm run lint && npm run build` clean.
- [ ] `grep -rn "to=\"/courses\"" client/src` returns nothing.
- [ ] `grep -rn "/resources/\${" client/src` returns nothing outside `manage/`.
- [ ] A signed-out visitor can reach a material from `/learning`, from a church profile, and from search.
- [ ] A material's paid file returns 403 to a stranger and 200 to its buyer.
- [ ] An audio sample seeks when scrubbed.
