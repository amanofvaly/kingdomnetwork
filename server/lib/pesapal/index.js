import { env } from '../../config/env.js';

import * as live from './client.js';
import * as mock from './mock.js';

/**
 * The live client when credentials are configured, the local mock otherwise.
 * Both expose the same four calls, so nothing downstream knows the difference.
 */
export const gateway = env.pesapal.mode === 'mock' ? mock : live;
export const isMock = env.pesapal.mode === 'mock';
export const ensureIpnRegistered = (...args) => gateway.ensureIpnRegistered(...args);
export { mock };
