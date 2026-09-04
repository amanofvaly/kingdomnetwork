import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/__tests__/**/*.test.js'],
    // The integration files each connect to Mongo and drop their database
    // afterwards. Running files in parallel would have them tearing down each
    // other's connection, so they go one at a time — the whole suite is a few
    // seconds either way.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
