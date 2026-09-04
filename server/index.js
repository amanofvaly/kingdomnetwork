import path from 'node:path';
import { fileURLToPath } from 'node:url';

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

import { connectDB } from './config/db.js';
import { assertProductionEnv, env } from './config/env.js';
import { runMigrations } from './migrations/runner.js';
import { storage } from './lib/storage/index.js';
import { ensureIpnRegistered } from './lib/pesapal/index.js';
import apiRoutes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../client/dist');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
// The IPN and the mock gateway aside, nothing here posts anything large; a
// media upload streams its body straight through, so it is excluded.
app.use(/^\/(?!api\/(?:manage\/[^/]+\/media$|applications\/[^/]+\/documents\/)).*/, express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

// In production the client is served by this same server, so CORS is only
// needed for the Vite dev server running on a different port.
if (!env.isProduction) {
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
app.use('/api', apiRoutes);

// ---------------------------------------------------------------------------
// Static client — the monolith can always serve the latest built SPA.
// ---------------------------------------------------------------------------
app.use(express.static(clientDist, {
  index: false,
  etag: true,
  setHeaders: (res, filePath) => {
    const isHashedBuildAsset = filePath.includes(`${path.sep}assets${path.sep}`);
    res.setHeader(
      'Cache-Control',
      env.isProduction && isHashedBuildAsset
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=0, must-revalidate',
    );
  },
}));

// Anything that is not /api/* falls through to the SPA entry point so
// client-side routing works on a hard refresh.
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  assertProductionEnv();
  await connectDB();
  await runMigrations();
  await storage.ensureReady();

  // Pesapal issues an id when a notification URL is registered, and every order
  // has to quote it. Registering is idempotent and normally a no-op.
  ensureIpnRegistered().catch((err) => {
    console.warn('[kingdom-network] could not register the Pesapal IPN URL:', err.message);
  });

  const server = app.listen(env.port, () => {
    console.log(`[kingdom-network] ${env.nodeEnv} server listening on http://localhost:${env.port}`);
  });

  const shutdown = (signal) => {
    console.log(`\n[kingdom-network] ${signal} received, shutting down...`);
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start().catch((err) => {
  console.error('[kingdom-network] failed to start:', err);
  process.exit(1);
});

export default app;
