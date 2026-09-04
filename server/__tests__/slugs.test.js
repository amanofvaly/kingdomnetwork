import { describe, expect, it } from 'vitest';

import { dependantsOfOffering, findRequirementCycle, proposeSlug } from '../lib/slugs.js';
import { disclosuresFor } from '../lib/disclosures.js';

/**
 * A stand-in for a Mongoose model. Only the four calls these helpers make are
 * implemented, which is enough to pin the graph logic without a database.
 */
const fakeModel = (rows) => ({
  rows,
  exists: async (query) => {
    const wanted = query.$or?.[0]?.slug ?? query.slug;
    return rows.some((r) => r.slug === wanted) ? { _id: wanted } : null;
  },
  findOne: (query) => ({
    lean: async () => rows.find((r) => r.slug === query.slug) ?? null,
  }),
  find: (query) => ({
    lean: async () => rows.filter((r) => {
      const needle = query.$or?.[0]?.['requires.credentials'];
      return r.slug !== query.slug?.$ne && (r.requires?.credentials ?? []).includes(needle);
    }),
  }),
});

describe('proposing a slug', () => {
  it('scopes it to the church, so two churches may use the same title', async () => {
    const model = fakeModel([]);
    expect(await proposeSlug(model, 'Ordained Minister', { churchSlug: 'faith-life' }))
      .toBe('ordained-minister-faith-life');
  });

  it('finds a free one rather than colliding', async () => {
    const model = fakeModel([{ slug: 'ordained-minister-faith-life' }]);
    expect(await proposeSlug(model, 'Ordained Minister', { churchSlug: 'faith-life' }))
      .toBe('ordained-minister-faith-life-2');
  });
});

describe('cycles in the requirement graph', () => {
  /**
   * A credential that ends up requiring itself can never be issued, and the
   * graph runs across churches, so the loop can be several hops long.
   */
  it('catches a listing that requires itself', async () => {
    const model = fakeModel([{ slug: 'a', requires: { credentials: [] } }]);
    expect(await findRequirementCycle(model, 'a', ['a'])).toEqual(['a', 'a']);
  });

  it('catches a loop that runs through two other churches', async () => {
    const model = fakeModel([
      { slug: 'b', requires: { credentials: ['c'] } },
      { slug: 'c', requires: { credentials: ['a'] } },
    ]);
    expect(await findRequirementCycle(model, 'a', ['b'])).toEqual(['a', 'b', 'c', 'a']);
  });

  it('leaves an honest chain alone', async () => {
    const model = fakeModel([
      { slug: 'b', requires: { credentials: ['c'] } },
      { slug: 'c', requires: { credentials: [] } },
    ]);
    expect(await findRequirementCycle(model, 'a', ['b'])).toBeNull();
  });

  it('looks inside groups, not only direct requirements', async () => {
    const model = fakeModel([{ slug: 'b', requires: { credentialGroups: [{ offeringSlugs: ['a'] }] } }]);
    expect(await findRequirementCycle(model, 'a', ['b'])).toEqual(['a', 'b', 'a']);
  });
});

describe('dependants', () => {
  it('reports what would break if a listing went away', async () => {
    const model = fakeModel([
      { slug: 'senior', requires: { credentials: ['ordination'] } },
      { slug: 'unrelated', requires: { credentials: [] } },
    ]);
    const dependants = await dependantsOfOffering(model, 'ordination');
    expect(dependants.map((d) => d.slug)).toEqual(['senior']);
  });
});

describe('what a listing must disclose', () => {
  it('always states the platform’s own position, alongside the church’s', () => {
    const lines = disclosuresFor({ type: 'ordination', price: 45, disclosure: 'Our own words.' });
    expect(lines[0]).toBe('Our own words.');
    expect(lines.join(' ')).toContain('does not accredit, validate or endorse any church');
    expect(lines.join(' ')).toContain('varies by country');
    expect(lines.join(' ')).toContain('Paying it begins a process');
  });

  it('says plainly that an invitation letter is not a visa', () => {
    const lines = disclosuresFor({ type: 'invitation-letter', price: 95 });
    expect(lines.join(' ')).toContain('it is not a visa');
    expect(lines.join(' ')).toContain('does not guarantee that a visa will be granted');
  });

  it('marks demonstration content as such', () => {
    expect(disclosuresFor({ type: 'certificate', demo: true })[0]).toContain('Demonstration content');
  });

  it('omits the fee statement where there is no fee', () => {
    expect(disclosuresFor({ type: 'certificate', price: 0 }).join(' ')).not.toContain('Paying it begins');
  });
});
