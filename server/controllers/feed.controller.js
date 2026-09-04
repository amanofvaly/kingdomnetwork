import { asyncHandler } from '../middleware/asyncHandler.js';
import { Church } from '../models/Church.js';
import { Credential } from '../models/Credential.js';
import { Follow } from '../models/Follow.js';
import { Offering } from '../models/Offering.js';
import { Post, REACTIONS } from '../models/Post.js';
import { Reaction } from '../models/Reaction.js';
import { User } from '../models/User.js';

/**
 * The feed, and the two relationships it is built out of: who you follow, and
 * what you thought of what they said.
 *
 * The one rule worth stating up front: a signed-in person must never be shown
 * an empty feed. Following nobody is the normal state of a new account, not an
 * error, so the feed falls back to the most popular recent posts and tells the
 * reader that is what they are looking at.
 */

const PAGE = 12;

const churchIndex = async (slugs) => {
  const churches = await Church.find(
    slugs ? { slug: { $in: slugs } } : {},
    'slug name shortName monogram logoImage verified city country coverImage leaders',
  );
  return Object.fromEntries(churches.map((c) => [c.slug, c]));
};

/** Everything the client needs to draw one post, and nothing it does not. */
const shape = (post, { churchBy, userBy, offeringBy, credentialBy, mine }) => {
  const church = churchBy[post.churchSlug] ?? null;
  const author = post.authorKind === 'user'
    ? (() => {
      const u = userBy[String(post.userId)];
      return u ? { kind: 'user', name: u.name, avatar: u.avatar, role: u.ministryRole } : null;
    })()
    : church
      ? { kind: 'church', name: church.name, shortName: church.shortName, logoImage: church.logoImage, verified: church.verified, slug: church.slug }
      : null;

  const offering = post.offeringSlug ? offeringBy[post.offeringSlug] ?? null : null;
  const credential = post.credentialId ? credentialBy[post.credentialId] ?? null : null;

  return {
    id: String(post._id),
    kind: post.kind,
    author,
    church: church && { slug: church.slug, name: church.name, shortName: church.shortName, logoImage: church.logoImage, verified: church.verified },
    body: post.body ?? '',
    images: post.images ?? [],
    offering: offering && {
      slug: offering.slug, title: offering.title, type: offering.type, outcome: offering.outcome,
      coverImage: offering.coverImage, fee: offering.fee, price: offering.price,
    },
    credential: credential && {
      credentialId: credential.credentialId,
      title: credential.title,
      kind: credential.kind,
      issuedAt: credential.issuedAt,
      verifyCode: credential.verifyCode,
      // The certificate is drawn from these, so it carries the same issuer,
      // seal and signatory as the document itself.
      holderName: userBy[String(post.userId)]?.name ?? '',
      church: church && {
        name: church.name, city: church.city, country: church.country,
        monogram: church.monogram, signatory: church.leaders?.[0] ?? null,
      },
    },
    reactionCounts: post.reactionCounts ?? {},
    reactionTotal: post.reactionTotal ?? 0,
    myReaction: mine[String(post._id)] ?? null,
    publishedAt: post.publishedAt,
  };
};

/** Hydrate a page of posts in a fixed number of queries, whatever its length. */
const hydrate = async (posts, viewerId) => {
  if (!posts.length) return [];

  const [churchBy, users, offerings, credentials, reactions] = await Promise.all([
    churchIndex([...new Set(posts.map((p) => p.churchSlug).filter(Boolean))]),
    User.find({ _id: { $in: posts.map((p) => p.userId).filter(Boolean) } }, 'name avatar ministryRole'),
    Offering.find({ slug: { $in: posts.map((p) => p.offeringSlug).filter(Boolean) } }, 'slug title type outcome coverImage fee price'),
    Credential.find({ credentialId: { $in: posts.map((p) => p.credentialId).filter(Boolean) } }, 'credentialId title kind issuedAt verifyCode'),
    viewerId ? Reaction.find({ userId: viewerId, postId: { $in: posts.map((p) => p._id) } }) : [],
  ]);

  const ctx = {
    churchBy,
    userBy: Object.fromEntries(users.map((u) => [String(u._id), u])),
    offeringBy: Object.fromEntries(offerings.map((o) => [o.slug, o])),
    credentialBy: Object.fromEntries(credentials.map((c) => [c.credentialId, c])),
    mine: Object.fromEntries(reactions.map((r) => [String(r.postId), r.type])),
  };
  return posts.map((p) => shape(p, ctx));
};

export const feed = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const follows = await Follow.find({ userId: req.user._id }, 'churchSlug');
  const slugs = follows.map((f) => f.churchSlug);

  // Following nobody is where every account starts. Rather than an empty
  // screen, show the most popular recent posts — and say so, so it is not
  // mistaken for a feed of churches they chose.
  const discovery = slugs.length === 0;
  const filter = { status: 'published' };
  if (!discovery) filter.$or = [{ churchSlug: { $in: slugs } }, { userId: req.user._id }];

  const sort = discovery ? { reactionTotal: -1, publishedAt: -1 } : { publishedAt: -1 };
  const posts = await Post.find(filter).sort(sort).skip((page - 1) * PAGE).limit(PAGE + 1);

  const more = posts.length > PAGE;
  res.json({
    success: true,
    data: {
      posts: await hydrate(posts.slice(0, PAGE), req.user._id),
      discovery,
      following: slugs,
      page,
      more,
    },
  });
});

export const churchPosts = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const posts = await Post.find({ churchSlug: req.params.slug, status: 'published' })
    .sort({ publishedAt: -1 })
    .skip((page - 1) * PAGE)
    .limit(PAGE + 1);

  res.json({
    success: true,
    data: { posts: await hydrate(posts.slice(0, PAGE), req.user?._id ?? null), page, more: posts.length > PAGE },
  });
});

/* --- following ----------------------------------------------------------- */

export const following = asyncHandler(async (req, res) => {
  const follows = await Follow.find({ userId: req.user._id }).sort({ createdAt: -1 });
  const churchBy = await churchIndex(follows.map((f) => f.churchSlug));
  res.json({
    success: true,
    data: {
      churches: follows.map((f) => churchBy[f.churchSlug]).filter(Boolean),
      slugs: follows.map((f) => f.churchSlug),
    },
  });
});

export const follow = asyncHandler(async (req, res) => {
  const church = await Church.findOne({ slug: req.params.churchSlug }, 'slug');
  if (!church) return res.status(404).json({ success: false, message: 'That church does not exist.' });

  // Following twice is the same as following once, not an error.
  await Follow.updateOne(
    { userId: req.user._id, churchSlug: church.slug },
    { $setOnInsert: { userId: req.user._id, churchSlug: church.slug } },
    { upsert: true },
  );
  const followers = await Follow.countDocuments({ churchSlug: church.slug });
  res.json({ success: true, data: { following: true, churchSlug: church.slug, followers } });
});

export const unfollow = asyncHandler(async (req, res) => {
  await Follow.deleteOne({ userId: req.user._id, churchSlug: req.params.churchSlug });
  const followers = await Follow.countDocuments({ churchSlug: req.params.churchSlug });
  res.json({ success: true, data: { following: false, churchSlug: req.params.churchSlug, followers } });
});

/** Churches worth following, most-followed first, excluding the ones already. */
export const suggestions = asyncHandler(async (req, res) => {
  const [follows, churches] = await Promise.all([
    Follow.find({ userId: req.user._id }, 'churchSlug'),
    Church.find({}, 'slug name shortName logoImage verified city country coverImage'),
  ]);
  const mine = new Set(follows.map((f) => f.churchSlug));

  const counts = await Follow.aggregate([{ $group: { _id: '$churchSlug', n: { $sum: 1 } } }]);
  const countBy = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  const postCounts = await Post.aggregate([
    { $match: { status: 'published' } },
    { $group: { _id: '$churchSlug', n: { $sum: 1 } } },
  ]);
  const postBy = Object.fromEntries(postCounts.map((c) => [c._id, c.n]));

  const shaped = churches
    .map((c) => ({
      slug: c.slug, name: c.name, shortName: c.shortName, logoImage: c.logoImage,
      verified: c.verified, city: c.city, country: c.country, coverImage: c.coverImage,
      followers: countBy[c.slug] ?? 0,
      posts: postBy[c.slug] ?? 0,
      following: mine.has(c.slug),
    }))
    .sort((a, b) => b.followers - a.followers || b.posts - a.posts);

  res.json({ success: true, data: { churches: shaped } });
});

/* --- reacting ------------------------------------------------------------ */

/** Recount from the Reaction rows rather than incrementing, so the denormalised
 *  counts can never drift away from the truth. */
const recount = async (postId) => {
  const [rows, post] = await Promise.all([
    Reaction.aggregate([{ $match: { postId } }, { $group: { _id: '$type', n: { $sum: 1 } } }]),
    Post.findById(postId, 'demoReactions'),
  ]);

  const base = post?.demoReactions ?? {};
  const counts = Object.fromEntries(REACTIONS.map((r) => [r, base[r] ?? 0]));
  let total = REACTIONS.reduce((n, r) => n + (base[r] ?? 0), 0);
  for (const row of rows) {
    if (counts[row._id] !== undefined) counts[row._id] += row.n;
    total += row.n;
  }
  await Post.updateOne({ _id: postId }, { $set: { reactionCounts: counts, reactionTotal: total } });
  return { counts, total };
};

export const react = asyncHandler(async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, status: 'published' });
  if (!post) return res.status(404).json({ success: false, message: 'That post was not found.' });

  const type = req.body?.type ?? null;
  if (type !== null && !REACTIONS.includes(type)) {
    return res.status(400).json({ success: false, message: 'That is not a reaction.' });
  }

  if (type === null) {
    await Reaction.deleteOne({ userId: req.user._id, postId: post._id });
  } else {
    await Reaction.updateOne(
      { userId: req.user._id, postId: post._id },
      { $set: { type } },
      { upsert: true },
    );
  }

  const { counts, total } = await recount(post._id);
  res.json({ success: true, data: { myReaction: type, reactionCounts: counts, reactionTotal: total } });
});

/* --- sharing what you were granted --------------------------------------- */

export const shareCredential = asyncHandler(async (req, res) => {
  const credential = await Credential.findOne({ credentialId: req.params.id, userId: req.user._id });
  if (!credential) return res.status(404).json({ success: false, message: 'That credential is not yours.' });
  if (credential.status !== 'issued') {
    return res.status(400).json({ success: false, message: 'Only an issued credential can be shared.' });
  }

  const existing = await Post.findOne({ credentialId: credential.credentialId, userId: req.user._id });
  if (existing) return res.status(409).json({ success: false, message: 'You have already shared this one.' });

  const post = await Post.create({
    kind: 'credential',
    authorKind: 'user',
    userId: req.user._id,
    churchSlug: credential.churchSlug,
    credentialId: credential.credentialId,
    body: String(req.body?.caption ?? '').slice(0, 2000),
  });

  res.status(201).json({ success: true, data: (await hydrate([post], req.user._id))[0] });
});

/** Which of this person's credentials are already on the feed. */
export const sharedCredentials = asyncHandler(async (req, res) => {
  const posts = await Post.find({ userId: req.user._id, kind: 'credential' }, 'credentialId');
  res.json({ success: true, data: { credentialIds: posts.map((p) => p.credentialId) } });
});

/* --- the church side ----------------------------------------------------- */

export const listChurchPosts = asyncHandler(async (req, res) => {
  // Removed means removed. A church that deleted a post should not keep
  // seeing it in the one place it went to delete it.
  const posts = await Post.find({ churchSlug: req.params.churchSlug, status: 'published' })
    .sort({ publishedAt: -1 })
    .limit(60);
  res.json({ success: true, data: { posts: await hydrate(posts, null) } });
});

export const createChurchPost = asyncHandler(async (req, res) => {
  const body = String(req.body?.body ?? '').trim();
  const images = Array.isArray(req.body?.images) ? req.body.images.slice(0, 4) : [];
  if (!body && !images.length) {
    return res.status(400).json({ success: false, message: 'Write something, or add a picture.' });
  }

  const post = await Post.create({
    kind: 'update',
    authorKind: 'church',
    churchSlug: req.params.churchSlug,
    body: body.slice(0, 2000),
    images,
  });
  res.status(201).json({ success: true, data: (await hydrate([post], null))[0] });
});

export const updateChurchPost = asyncHandler(async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, churchSlug: req.params.churchSlug });
  if (!post) return res.status(404).json({ success: false, message: 'That post was not found.' });

  if (typeof req.body?.body === 'string') post.body = req.body.body.trim().slice(0, 2000);
  if (Array.isArray(req.body?.images)) post.images = req.body.images.slice(0, 4);
  await post.save();
  res.json({ success: true, data: (await hydrate([post], null))[0] });
});

export const removeChurchPost = asyncHandler(async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, churchSlug: req.params.churchSlug });
  if (!post) return res.status(404).json({ success: false, message: 'That post was not found.' });
  post.status = 'removed';
  await post.save();
  res.json({ success: true, data: { removed: true } });
});
