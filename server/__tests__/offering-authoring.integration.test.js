import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * What a church actually goes through to put a credential up: create it, say
 * what it requires, publish it. The thing worth pinning down is that the
 * church answers each question once — the comparison page a listing competes
 * on follows from what kind of thing it is, and cannot be contradicted.
 */

const URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/kingdom-network-test-authoring';

let available = true;
let authoring;
let Church; let Offering; let User;
let church; let user;

beforeAll(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
  } catch {
    available = false;
    return;
  }
  authoring = await import('../controllers/authoring.controller.js');
  ({ Church } = await import('../models/Church.js'));
  ({ Offering } = await import('../models/Offering.js'));
  ({ User } = await import('../models/User.js'));
}, 20000);

afterAll(async () => {
  if (!available) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const run = async (handler, req) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
  };
  await handler(req, res, (err) => { if (err) throw err; });
  return res;
};

const create = (body) => run(authoring.createOffering, { body, church, user });
const update = (slug, body) => run(authoring.updateOffering, { body, church, user, params: { slug } });

beforeEach(async () => {
  if (!available) return;
  await Promise.all([Church.deleteMany({}), Offering.deleteMany({}), User.deleteMany({})]);
  church = await Church.create({ slug: 'a-church', name: 'A Church' });
  user = await User.create({ name: 'The Registrar', email: `r${Date.now()}@example.test` });
});

describe('creating a credential', () => {
  it('asks for a title and a kind, and files it on the right page itself', async () => {
    if (!available) return;
    const res = await create({ title: 'Ordained Minister', type: 'ordination' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.outcome).toBe('ordination');
    expect(res.body.data.status).toBe('draft');
  });

  it('files the kinds that share a page under that one page', async () => {
    if (!available) return;
    const certificate = await create({ title: 'Chaplaincy Certificate', type: 'certificate' });
    const diploma = await create({ title: 'Diploma in Ministry', type: 'diploma' });

    expect(certificate.body.data.outcome).toBe('certification');
    expect(diploma.body.data.outcome).toBe('certification');
  });

  it('ignores a comparison page sent by a client, because it is not asked for', async () => {
    if (!available) return;
    const res = await create({ title: 'Chaplaincy Certificate', type: 'certificate', outcome: 'ordination' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.outcome).toBe('certification');
  });

  it('refuses a kind of credential the platform does not have', async () => {
    if (!available) return;
    const res = await create({ title: 'Knighthood', type: 'knighthood' });

    expect(res.statusCode).toBe(400);
    expect(await Offering.countDocuments()).toBe(0);
  });

  it('still refuses a listing with no title', async () => {
    if (!available) return;
    expect((await create({ type: 'certificate' })).statusCode).toBe(400);
  });
});

describe('changing a credential in the builder', () => {
  it('moves the listing to the page its new kind belongs on', async () => {
    if (!available) return;
    const { body } = await create({ title: 'Chaplaincy Certificate', type: 'certificate' });

    const res = await update(body.data.slug, { type: 'ordination' });
    expect(res.body.data.offering.outcome).toBe('ordination');
  });

  it('keeps the church’s choice for the one kind that fits two pages', async () => {
    if (!available) return;
    const { body } = await create({ title: 'Letter of Standing', type: 'letter-of-standing' });
    expect(body.data.outcome).toBe('ministry-license');

    const res = await update(body.data.slug, { outcome: 'church-affiliation' });
    expect(res.body.data.offering.outcome).toBe('church-affiliation');
  });

  it('corrects a page the kind cannot be compared on rather than storing it', async () => {
    if (!available) return;
    const { body } = await create({ title: 'Chaplaincy Certificate', type: 'certificate' });

    const res = await update(body.data.slug, { outcome: 'invitation-letter' });
    expect(res.body.data.offering.outcome).toBe('certification');
    expect(res.body.data.problems).not.toContain(
      'This listing is filed under an outcome its kind cannot be compared under.',
    );
  });

  it('refuses a kind of credential the platform does not have', async () => {
    if (!available) return;
    const { body } = await create({ title: 'Chaplaincy Certificate', type: 'certificate' });

    const res = await update(body.data.slug, { type: 'knighthood' });
    expect(res.statusCode).toBe(400);
    expect((await Offering.findOne({ slug: body.data.slug })).type).toBe('certificate');
  });
});

describe('what a new credential still owes before it can be published', () => {
  it('starts behind a church decision, and says what is missing', async () => {
    if (!available) return;
    const { body } = await create({ title: 'Chaplaincy Certificate', type: 'certificate' });
    const offering = await Offering.findOne({ slug: body.data.slug });

    // The model puts a review behind every listing that has no other decision.
    expect(offering.requires.review.required).toBe(true);
    expect(offering.acquisition).toBe('review');

    const { body: saved } = await update(body.data.slug, { subtitle: 'For hospital chaplains.' });
    expect(saved.data.problems).toContain('Write the disclosure: what this confers, and what it does not.');
  });

  it('holds an ordination to a live face-to-face interview from the moment it exists', async () => {
    if (!available) return;
    const { body } = await create({ title: 'Ordained Minister', type: 'ordination' });
    const offering = await Offering.findOne({ slug: body.data.slug });

    expect(offering.requires.interview.required).toBe(true);
    expect(offering.requires.interview.faceToFace).toBe(true);
  });
});
