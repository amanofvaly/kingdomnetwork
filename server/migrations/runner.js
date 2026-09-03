import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const migrationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    appliedAt: { type: Date, default: Date.now },
    durationMs: Number,
  },
  { versionKey: false },
);

export const Migration = mongoose.models.Migration ?? mongoose.model('Migration', migrationSchema);

/**
 * Migrations are plain modules exporting `{ id, description, up(db) }`, named
 * `NNN-what-it-does.js` so the filename orders them. Applying one records its
 * id, so running the set twice is a no-op. There is no `down` — a mistaken
 * migration is corrected by writing the next one.
 */
const load = async () => {
  const files = (await fs.readdir(__dirname))
    .filter((f) => /^\d{3}-.+\.js$/.test(f))
    .sort();

  const modules = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(__dirname, file)).href);
    if (!mod.id || typeof mod.up !== 'function') {
      throw new Error(`Migration ${file} must export an id and an up() function.`);
    }
    modules.push({ file, ...mod });
  }
  return modules;
};

export const runMigrations = async ({ quiet = false } = {}) => {
  const migrations = await load();
  const applied = new Set((await Migration.find({}, 'id')).map((m) => m.id));
  const pending = migrations.filter((m) => !applied.has(m.id));

  if (!pending.length) {
    if (!quiet) console.log('[kingdom-network] migrations up to date');
    return [];
  }

  const db = mongoose.connection.db;
  const ran = [];

  for (const migration of pending) {
    const started = Date.now();
    console.log(`[kingdom-network] migrating ${migration.id} — ${migration.description ?? ''}`);
    await migration.up(db);
    const durationMs = Date.now() - started;
    await Migration.create({ id: migration.id, durationMs });
    ran.push(migration.id);
    console.log(`[kingdom-network] migrated  ${migration.id} (${durationMs}ms)`);
  }

  return ran;
};
