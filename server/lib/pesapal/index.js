import { env } from '../../config/env.js';

import * as live from './client.js';
import * as mock from './mock.js';

/**
 * The live client when credentials are configured, the local mock otherwise.
 * Both expose the same four calls, so nothing downstream knows the difference.
 *
 * Asking for sandbox or live without keys is a misconfiguration rather than an
 * intention, and Pesapal answers it with an opaque auth failure at the moment
 * someone tries to pay. Better to say so at boot and keep the development
 * gateway, which at least works.
 */
const wanted = env.pesapal.mode;
const configured = Boolean(env.pesapal.consumerKey && env.pesapal.consumerSecret);

if (wanted !== 'mock' && !configured) {
  const message = `PESAPAL_ENV=${wanted} but PESAPAL_CONSUMER_KEY/SECRET are missing`;

  // On a laptop this is a nuisance worth a warning. In production the mock
  // fulfils orders — issuing credentials and course access — for money that was
  // never taken, so it must never be reached by accident.
  if (env.isProduction) {
    console.error(`[kingdom-network] refusing to start: ${message}.`);
    process.exit(1);
  }

  console.warn(
    `[kingdom-network] ${message} — falling back to the development gateway. No money will move.`,
  );
}

export const mode = wanted !== 'mock' && configured ? wanted : 'mock';
export const gateway = mode === 'mock' ? mock : live;
export const isMock = mode === 'mock';

// Which gateway is actually taking money is the single most consequential fact
// about a running instance, and it was previously only visible by its absence.
console.log(
  mode === 'mock'
    ? '[kingdom-network] payments: development gateway — no money moves'
    : `[kingdom-network] payments: Pesapal ${mode} (${env.pesapal.baseUrl})`,
);
export const ensureIpnRegistered = (...args) => gateway.ensureIpnRegistered(...args);
export { mock };
