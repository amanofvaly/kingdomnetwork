import { slugify } from './derive.js';

/**
 * Slugs are the foreign key for the entire requirement graph: an offering at
 * one church names the courses and the credentials of another purely by slug,
 * with no referential integrity behind it. That was safe while the catalogue
 * was seeded from one file. It stops being safe the moment a church can rename
 * its own listing — a rename would silently break every other church that
 * requires it.
 *
 * So: a slug is proposed from the title once, made unique, and frozen at the
 * creation. Retitling changes the title only.
 */

export const proposeSlug = async (Model, title, { churchSlug, suffix = true } = {}) => {
  const base = slugify(title) || 'listing';
  const stem = suffix && churchSlug ? `${base}-${churchSlug}`.slice(0, 90) : base;

  let candidate = stem;
  for (let n = 2; n < 200; n += 1) {
    const taken = await Model.exists({ slug: candidate });
    if (!taken) return candidate;
    candidate = `${stem}-${n}`;
  }
  throw new Error(`Could not find a free slug for "${title}".`);
};

/**
 * Everything that would break if this offering went away. Returned so the
 * church is told which other listings depend on it, rather than discovering it
 * later as a broken requirement.
 */
export const dependantsOfOffering = async (Offering, slug) => {
  const dependants = await Offering.find(
    {
      slug: { $ne: slug },
      $or: [
        { 'requires.credentials': slug },
        { 'requires.credentialGroups.offeringSlugs': slug },
      ],
    },
    'slug title churchSlug',
  ).lean();

  return dependants;
};

export const dependantsOfCourse = async (Offering, Course, slug) => {
  const [offerings, outlines] = await Promise.all([
    Offering.find(
      {
        $or: [
          { 'requires.courses': slug },
          { 'requires.courseGroups.courseSlugs': slug },
        ],
      },
      'slug title churchSlug',
    ).lean(),
    Offering.find({ 'curriculumOutline.courseSlugs': slug }, 'slug title churchSlug').lean(),
  ]);

  const seen = new Set();
  return [...offerings, ...outlines].filter((o) => {
    if (seen.has(o.slug)) return false;
    seen.add(o.slug);
    return true;
  });
};

/**
 * A credential that requires itself, directly or through a chain, can never be
 * issued. Walks the requirement graph from `slug` and reports the first cycle.
 */
export const findRequirementCycle = async (Offering, slug, proposedRequirements = []) => {
  const adjacency = new Map([[slug, [...proposedRequirements]]]);
  const state = new Map();
  const requirementsOf = async (current) => {
    if (adjacency.has(current)) return adjacency.get(current);
    const doc = await Offering.findOne({ slug: current }, 'requires.credentials requires.credentialGroups').lean();
    const direct = doc?.requires?.credentials ?? [];
    const grouped = (doc?.requires?.credentialGroups ?? []).flatMap((g) => g.offeringSlugs ?? []);
    const all = [...new Set([...direct, ...grouped])];
    adjacency.set(current, all);
    return all;
  };

  const frames = [{ node: slug, children: await requirementsOf(slug), index: 0 }];
  state.set(slug, 'visiting');
  while (frames.length) {
    const frame = frames[frames.length - 1];
    if (frame.index >= frame.children.length) {
      state.set(frame.node, 'done');
      frames.pop();
      continue;
    }
    const next = frame.children[frame.index++];
    if (state.get(next) === 'visiting') {
      const path = frames.map((f) => f.node);
      return [...path.slice(path.indexOf(next)), next];
    }
    if (state.get(next) !== 'done') {
      state.set(next, 'visiting');
      frames.push({ node: next, children: await requirementsOf(next), index: 0 });
    }
  }
  return null;
};
