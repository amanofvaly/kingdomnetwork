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
  if (env.pesapal.mode === 'live' && (!env.pesapal.consumerKey || !env.pesapal.consumerSecret)) {
    missing.push('PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET are required when PESAPAL_ENV=live');
  }

  if (missing.length) {
    console.error('[kingdom-network] refusing to start:\n  - ' + missing.join('\n  - '));
    process.exit(1);
  }
};
