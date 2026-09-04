import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import { runMigrations } from '../migrations/runner.js';

const run = async () => {
  await connectDB();
  await runMigrations();
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('[kingdom-network] migration failed:', err);
  process.exit(1);
});
