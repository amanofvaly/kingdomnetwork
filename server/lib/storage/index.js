import * as local from './local.js';

// One driver today. `put/get/stream/stat/remove/publicUrl/ensureReady` is the
// contract a replacement has to satisfy. `stream` takes an optional
// `{ start, end }` — inclusive bounds, for serving a byte range.
export const storage = local;
