// Reseeds the marketplace catalogue. Leaves user-owned collections
// (users, orders, enrolments, credentials) untouched unless --all is passed.
import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { churches, instructors, courses, offerings, outcomes, reviews, categories } from '../data/index.js';
import { Church } from '../models/Church.js';
import { Instructor } from '../models/Instructor.js';
import { Course } from '../models/Course.js';
import { Offering } from '../models/Offering.js';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { Enrollment } from '../models/Enrollment.js';
import { Credential } from '../models/Credential.js';

const wipeAll = process.argv.includes('--all');

const run = async () => {
  await mongoose.connect(env.mongoUri);
  console.log(`connected to ${mongoose.connection.name}`);

  await Promise.all([
    Church.deleteMany({}),
    Instructor.deleteMany({}),
    Course.deleteMany({}),
    Offering.deleteMany({}),
    Review.deleteMany({}),
  ]);

  if (wipeAll) {
    await Promise.all([User.deleteMany({}), Order.deleteMany({}), Enrollment.deleteMany({}), Credential.deleteMany({})]);
    console.log('cleared user-owned collections (--all)');
  }

  const now = Date.now();
  const dated = reviews.map((r) => ({
    ...r,
    createdAt: new Date(now - (r.monthsAgo ?? 1) * 30 * 24 * 60 * 60 * 1000),
  }));

  await Church.insertMany(churches);
  await Instructor.insertMany(instructors);
  await Course.insertMany(courses);
  await Offering.insertMany(offerings);
  await Review.insertMany(dated);

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

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
