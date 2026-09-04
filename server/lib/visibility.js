import { PlatformSettings } from '../models/PlatformSettings.js';

/**
 * The seeded catalogue is demonstration content — twelve ministries, seven of
 * them real organisations carrying prices and statistics they never supplied.
 * When demo mode is off it disappears from every public read rather than being
 * merely unlinked, so there is one switch and no way to reach it by URL.
 *
 * Cached briefly because it is consulted on every catalogue query.
 */
let cached = { value: null, at: 0 };
const TTL = 30_000;

export const demoModeOn = async () => {
  const now = Date.now();
  if (cached.value !== null && now - cached.at < TTL) return cached.value;

  const settings = await PlatformSettings.load();
  cached = { value: settings.demoMode !== false, at: now };
  return cached.value;
};

/** Call after a platform administrator changes the setting. */
export const clearVisibilityCache = () => {
  cached = { value: null, at: 0 };
};

/** Merge into any public catalogue query. */
export const publicFilter = async () => (await demoModeOn() ? {} : { demo: { $ne: true } });
