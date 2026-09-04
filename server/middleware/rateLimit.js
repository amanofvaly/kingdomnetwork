/**
 * A fixed-window limiter held in memory.
 *
 * Deliberately not a dependency: the endpoints worth protecting here are sign
 * in, payment creation, reference responses and credential verification, and
 * for a single Node process a Map of counters is honest and sufficient. Running
 * more than one instance would want a shared store, which is the point at which
 * this should be replaced rather than tuned.
 */
const buckets = new Map();

let lastSweep = Date.now();
const sweep = (now) => {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

export const rateLimit = ({ windowMs = 60_000, max = 30, key: keyFn, message } = {}) => (req, res, next) => {
  const now = Date.now();
  sweep(now);

  const id = keyFn ? keyFn(req) : `${req.ip}:${req.baseUrl}${req.path}`;
  const bucket = buckets.get(id);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return next();
  }

  bucket.count += 1;
  if (bucket.count > max) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      success: false,
      message: message ?? `Too many attempts. Try again in ${retryAfter} seconds.`,
    });
  }

  next();
};
