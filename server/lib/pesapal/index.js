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
  console.warn(
    `[kingdom-network] PESAPAL_ENV=${wanted} but PESAPAL_CONSUMER_KEY/SECRET are missing — `
    + 'falling back to the development gateway. No money will move.',
  );
}

export const mode = wanted !== 'mock' && configured ? wanted : 'mock';
export const gateway = mode === 'mock' ? mock : live;
export const isMock = mode === 'mock';
export const ensureIpnRegistered = (...args) => gateway.ensureIpnRegistered(...args);
export { mock };
