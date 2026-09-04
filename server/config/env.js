import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

const bool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1' || value === 'yes';
};

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pesapalEnv = process.env.PESAPAL_ENV ?? '';

export const env = {
  nodeEnv,
  isProduction,
  port: num(process.env.PORT, 4000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/kingdom-network',

  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  // Only used in development, when Vite serves the client on its own port.
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',

  // The origin Pesapal and emailed links must reach us on. In development the
  // API answers on its own port; in production one process serves both.
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? `http://localhost:${num(process.env.PORT, 4000)}`).replace(/\/+$/, ''),

  // Where a person's browser belongs after the gateway hands it back.
  //
  // Not the same as publicBaseUrl in development: Pesapal must reach the API
  // on its own port, but the app — and the session token in its localStorage —
  // lives on the Vite origin. Redirecting to the API origin lands the payer on
  // a different origin with no token, which reads as a failed payment even
  // when the money went through. In production one process serves both.
  appOrigin: isProduction
    ? (process.env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, '')
    : (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').replace(/\/+$/, ''),

  // Uploads live outside the repo tree in production, on an attached disk.
  uploadDir: process.env.UPLOAD_DIR ?? './server/uploads',

  // What the platform retains from every payment that passes through it.
  commissionPercent: num(process.env.PLATFORM_COMMISSION_PERCENT, 10),

  // Seeded demo churches and listings are hidden from public reads when false.
  demoMode: bool(process.env.DEMO_MODE, !isProduction),

  pesapal: {
    // Absent means the local mock gateway, which is how development runs.
    mode: pesapalEnv === 'live' ? 'live' : pesapalEnv === 'sandbox' ? 'sandbox' : 'mock',
    consumerKey: process.env.PESAPAL_CONSUMER_KEY ?? '',
    consumerSecret: process.env.PESAPAL_CONSUMER_SECRET ?? '',
    baseUrl: pesapalEnv === 'live' ? 'https://pay.pesapal.com/v3' : 'https://cybqa.pesapal.com/pesapalv3',
  },

  mail: {
    driver: process.env.RESEND_API_KEY ? 'resend' : 'console',
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.MAIL_FROM ?? 'Kingdom Network <no-reply@kingdom.network>',
  },
};

/**
 * Placeholders are fine on a laptop and catastrophic in production — a default
 * JWT secret means anyone who has read this repository can mint an admin token.
 * Fail at boot rather than serve a system that is quietly insecure.
 */
export const assertProductionEnv = () => {
  if (!isProduction) return;

  const missing = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('replace-with') || process.env.JWT_SECRET === 'change-me-in-production') {
    missing.push('JWT_SECRET must be set to a long random string');
  }
  if (!process.env.PUBLIC_BASE_URL) {
    missing.push('PUBLIC_BASE_URL must be set so payment callbacks and emailed links resolve');
  }

  // A gateway that is asked for but not configured falls back to the mock, and
  // the mock hands out credentials and course access for money that was never
  // taken. In production that is worse than not starting.
  if (env.pesapal.mode === 'mock') {
    missing.push('PESAPAL_ENV must be `live` (or `sandbox`) — without it payments run on the development gateway and fulfil orders for free');
  } else if (!env.pesapal.consumerKey || !env.pesapal.consumerSecret) {
    missing.push(`PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET are required when PESAPAL_ENV=${env.pesapal.mode}`);
  }

  // Pesapal calls the IPN from its own servers, so it has to be able to resolve
  // us. A loopback or plain-http origin means notifications never arrive and
  // payments hang as `pending` whenever a payer closes the tab.
  const publicUrl = process.env.PUBLIC_BASE_URL ?? '';
  if (publicUrl && !/^https:\/\//.test(publicUrl)) {
    missing.push('PUBLIC_BASE_URL must be https so Pesapal can deliver the IPN');
  }
  if (/localhost|127\.0\.0\.1|\[::1\]/.test(publicUrl)) {
    missing.push('PUBLIC_BASE_URL must be a public hostname, not loopback — Pesapal cannot reach it otherwise');
  }

  if (missing.length) {
    console.error('[kingdom-network] refusing to start:\n  - ' + missing.join('\n  - '));
    process.exit(1);
  }
};
