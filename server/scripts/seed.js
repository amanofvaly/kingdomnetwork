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
  ]);

  if (wipeAll) {
    await Promise.all([
      User.deleteMany({}),
      Order.deleteMany({}),
      Enrollment.deleteMany({}),
      Credential.deleteMany({}),
      Application.deleteMany({}),
      ChurchMembership.deleteMany({}),
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
