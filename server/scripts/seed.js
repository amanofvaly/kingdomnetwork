// Reseeds the demonstration catalogue. Leaves user-owned collections
// (users, orders, enrolments, credentials, applications) untouched unless
// --all is passed.
//
// Everything written here carries `demo: true`. Seven of the twelve ministries
// are real organisations named in PRODUCT.md as prospective partners; the
// listings, prices, photography and issue counts attached to them are
// placeholder content those ministries have not supplied. Turning DEMO_MODE off
// hides all of it from every public read.
import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { churches, instructors, courses, offerings, outcomes, reviews, categories } from '../data/index.js';
import { posts as churchPosts } from '../data/posts.js';
import { hashPassword } from '../lib/auth.js';
import { runMigrations } from '../migrations/runner.js';
import { Church } from '../models/Church.js';
import { ChurchMembership } from '../models/ChurchMembership.js';
import { Instructor } from '../models/Instructor.js';
import { Course } from '../models/Course.js';
import { Offering } from '../models/Offering.js';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { Enrollment } from '../models/Enrollment.js';
import { Credential } from '../models/Credential.js';
import { Application } from '../models/Application.js';
import { PlatformSettings } from '../models/PlatformSettings.js';
import { Post } from '../models/Post.js';
import { Follow } from '../models/Follow.js';
import { Reaction } from '../models/Reaction.js';

const wipeAll = process.argv.includes('--all');
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'kingdom-demo-2026';

/**
 * Accounts that make the console reachable on a fresh database. Only ever
 * created outside production, and always with `demo` credentials that are
 * printed to the console rather than hidden.
 */
const seedAccounts = async () => {
  if (env.isProduction) return null;

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const admin = await User.findOneAndUpdate(
    { email: 'admin@kingdom.network' },
    {
      $set: { role: 'platform_admin', name: 'Platform Administrator', status: 'active' },
      $setOnInsert: { passwordHash },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const owners = [];
  for (const church of churches) {
    const email = `owner@${church.slug}.demo`;
    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: { name: church.leaders?.[0]?.name ?? `${church.shortName ?? church.name} Administrator`, churchSlug: church.slug, status: 'active' },
        $setOnInsert: { passwordHash, role: 'member' },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await ChurchMembership.findOneAndUpdate(
      { churchSlug: church.slug, userId: user._id },
      { $set: { role: 'owner', status: 'active', acceptedAt: new Date(), title: church.leaders?.[0]?.title } },
      { upsert: true, setDefaultsOnInsert: true },
    );

    owners.push(email);
  }

  return { admin: admin.email, owners, password: DEMO_PASSWORD };
};

/**
 * A feed with something in it.
 *
 * Three kinds of post, because a feed showing only one of them does not
 * demonstrate a feed. Community members are created here so credential posts
 * have a real author and a real credential behind them rather than a name
 * printed onto a row.
 */
const MEMBERS = [
  { name: 'Grace Achieng', email: 'grace@member.demo', avatar: '/media/people/p-woman-blazer.webp', ministryRole: 'Church planter',
    credential: { id: 'KN-DEMO-A1', title: 'Ordained Minister', kind: 'ordination', churchSlug: 'grace-covenant-institute' },
    caption: 'Three years of study, two of them while working nights. Set apart on Sunday. To God be the glory.',
    daysAgo: 3, reactions: { amen: 94, pray: 11, love: 76, celebrate: 118 } },
  { name: 'Samuel Otieno', email: 'samuel@member.demo', avatar: '/media/people/p-man-dark-beard.webp', ministryRole: 'Associate pastor',
    credential: { id: 'KN-DEMO-A2', title: 'Certificate in Pastoral Theology', kind: 'certificate', churchSlug: 'new-horizon-bible-college' },
    caption: 'Finished the pastoral theology certificate. The module on grief changed how I sit with people.',
    daysAgo: 7, reactions: { amen: 41, pray: 6, love: 52, celebrate: 37 } },
  { name: 'Ruth Wanjiru', email: 'ruth@member.demo', avatar: '/media/people/p-woman-bun.webp', ministryRole: 'Childrens ministry lead',
    credential: { id: 'KN-DEMO-A3', title: 'Ministry Licence', kind: 'license', churchSlug: 'faith-life-church' },
    caption: 'Licensed this week. Same work, same children, same Tuesdays — but it is good to be recognised.',
    daysAgo: 11, reactions: { amen: 28, pray: 4, love: 45, celebrate: 30 } },
];

const ago = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const total = (r) => Object.values(r).reduce((n, v) => n + v, 0);

const seedFeed = async (passwordHash) => {
  const rows = [];

  for (const p of churchPosts) {
    rows.push({
      kind: 'update', authorKind: 'church', churchSlug: p.churchSlug,
      body: p.body, images: p.images ?? [],
      demoReactions: p.reactions, reactionCounts: p.reactions, reactionTotal: total(p.reactions),
      publishedAt: ago(p.daysAgo), demo: true,
    });
  }

  // A handful of the published listings, announced the way a real one would be.
  const announced = offerings.filter((o) => o.status === 'published').slice(0, 4);
  announced.forEach((o, i) => {
    const reactions = { amen: 9 + i * 4, pray: 3, love: 7 + i * 2, celebrate: 5 + i };
    rows.push({
      kind: 'offering', authorKind: 'church', churchSlug: o.churchSlug, offeringSlug: o.slug,
      body: o.summary ?? '',
      images: o.coverImage ? [{ url: o.coverImage, alt: o.coverAlt ?? '' }] : [],
      demoReactions: reactions, reactionCounts: reactions, reactionTotal: total(reactions),
      publishedAt: ago(9 + i * 3), demo: true,
    });
  });

  if (!env.isProduction) {
    for (const m of MEMBERS) {
      const user = await User.findOneAndUpdate(
        { email: m.email },
        {
          $set: { name: m.name, avatar: m.avatar, ministryRole: m.ministryRole, accountKind: 'personal', status: 'active' },
          $setOnInsert: { passwordHash, role: 'member' },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      await Credential.findOneAndUpdate(
        { credentialId: m.credential.id },
        {
          $set: {
            userId: user._id, title: m.credential.title, kind: m.credential.kind,
            churchSlug: m.credential.churchSlug, status: 'issued',
            issuedAt: ago(m.daysAgo + 1), verifyCode: m.credential.id.replace(/-/g, ''),
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );

      rows.push({
        kind: 'credential', authorKind: 'user', userId: user._id,
        churchSlug: m.credential.churchSlug, credentialId: m.credential.id,
        body: m.caption,
        demoReactions: m.reactions, reactionCounts: m.reactions, reactionTotal: total(m.reactions),
        publishedAt: ago(m.daysAgo), demo: true,
      });
    }
  }

  await Post.insertMany(rows);
  return rows.length;
};

const run = async () => {
  await mongoose.connect(env.mongoUri);
  console.log(`connected to ${mongoose.connection.name}`);

  await runMigrations({ quiet: true });

  await Promise.all([
    Church.deleteMany({ demo: true }),
    Instructor.deleteMany({}),
    Course.deleteMany({ demo: true }),
    Offering.deleteMany({ demo: true }),
    Review.deleteMany({ demo: true }),
    Post.deleteMany({ demo: true }),
  ]);

  if (wipeAll) {
    await Promise.all([
      User.deleteMany({}),
      Order.deleteMany({}),
      Enrollment.deleteMany({}),
      Credential.deleteMany({}),
      Application.deleteMany({}),
      ChurchMembership.deleteMany({}),
      Follow.deleteMany({}),
      Reaction.deleteMany({}),
    ]);
    console.log('cleared user-owned collections (--all)');
  }

  const now = Date.now();
  const dated = reviews.map((r) => ({
    ...r,
    demo: true,
    createdAt: new Date(now - (r.monthsAgo ?? 1) * 30 * 24 * 60 * 60 * 1000),
  }));

  await Church.insertMany(
    churches.map((c) => ({
      ...c,
      demo: true,
      status: 'published',
      publishedAt: new Date(),
      verification: { state: c.verified ? 'verified' : 'unverified' },
      onboarding: { currentStep: 10, completedSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], completedAt: new Date() },
      signatory: c.leaders?.[0] ? { name: c.leaders[0].name, title: c.leaders[0].title } : undefined,
    })),
  );
  await Instructor.insertMany(instructors);
  await Course.insertMany(courses);
  await Offering.insertMany(offerings);
  await Review.insertMany(dated);

  await PlatformSettings.load();
  const accounts = await seedAccounts();
  const feedPosts = await seedFeed(await hashPassword(DEMO_PASSWORD));

  const lectures = courses.reduce(
    (n, c) => n + c.curriculum.reduce((m, s) => m + s.lectures.length, 0),
    0,
  );

  console.log(
    [
      `churches      ${churches.length}`,
      `instructors   ${instructors.length}`,
      `courses       ${courses.length}  (${lectures} lectures)`,
      `offerings     ${offerings.length}  (${outcomes.length} outcomes)`,
      `reviews       ${dated.length}`,
      `categories    ${categories.length}`,
      `posts         ${feedPosts}`,
    ].join('\n'),
  );

  if (accounts) {
    console.log(
      [
        '',
        'demo sign-ins (development only)',
        `  platform admin  ${accounts.admin}`,
        `  church owners   ${accounts.owners[0]}  (and one per church)`,
        `  password        ${accounts.password}`,
      ].join('\n'),
    );
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
