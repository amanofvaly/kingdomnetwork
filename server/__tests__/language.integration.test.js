import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * A text index reads each document's `language` field to decide how to stem it,
 * so a course taught in Luganda cannot be saved unless the index is told to
 * look somewhere else. The field means the language of the teaching, not a
 * stemmer to use, and most of the languages this platform serves have no
 * stemmer at all.
 */

const URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/kingdom-network-test-language';

let available = true;
let Course; let Resource;

beforeAll(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
  } catch {
    available = false;
    return;
  }
  ({ Course } = await import('../models/Course.js'));
  ({ Resource } = await import('../models/Resource.js'));
  // Indexes are built lazily; these tests are about them, so wait for them.
  await Promise.all([Course.init(), Resource.init()]);
}, 20000);

afterAll(async () => {
  if (!available) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!available) return;
  await Promise.all([Course.deleteMany({}), Resource.deleteMany({})]);
});

describe('teaching in a language Mongo has never heard of', () => {
  it('saves a material recorded in Luganda', async () => {
    if (!available) return;
    await expect(Resource.create({
      slug: 'songs-of-the-village-church', churchSlug: 'ndw', title: 'Songs of the Village Church',
      price: 7, language: 'Luganda',
    })).resolves.toBeTruthy();
  });

  it('saves a course taught in Runyankole', async () => {
    if (!available) return;
    await expect(Course.create({
      slug: 'ebyafayo', churchSlug: 'ndw', title: 'Ebyafayo by’Ekanisa',
      price: 0, language: 'Runyankole',
    })).resolves.toBeTruthy();
  });

  it('still finds a material by title', async () => {
    if (!available) return;
    await Resource.create({
      slug: 'shepherds-handbook', churchSlug: 'ndw', title: 'The Shepherd’s Handbook',
      price: 14, language: 'Swahili',
    });

    const found = await Resource.find({ $text: { $search: 'Shepherd' } });
    expect(found.map((r) => r.slug)).toEqual(['shepherds-handbook']);
  });
});
