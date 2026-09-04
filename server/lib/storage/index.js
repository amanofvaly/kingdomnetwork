import * as local from './local.js';

// One driver today. `put/get/stream/stat/remove/publicUrl/ensureReady` is the
// contract a replacement has to satisfy.
export const storage = local;
