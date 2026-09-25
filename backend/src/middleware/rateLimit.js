const buckets = new Map();

const cleanup = () => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

setInterval(cleanup, 60_000).unref();

const getClientKey = (req) => {
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

let storeDb = null;
function getStore() {
  if (!storeDb) {
    try {
      storeDb = require('../db/store');
    } catch (_) {}
  }
  return storeDb;
}

const rateLimit = ({ windowMs = 15 * 60_000, max = 20, name = 'request' } = {}) => async (req, res, next) => {
  const clientKey = getClientKey(req);
  const now = Date.now();
  const windowIndex = Math.floor(now / windowMs);
  const key = `${name}:${clientKey}:${windowIndex}`;
  const resetAt = (windowIndex + 1) * windowMs;

  // 1. Attempt atomic durable throttling if MongoDB is configured
  let durableError = null;
  try {
    const store = getStore();
    const db = store && typeof store.getDurableDatabase === 'function' ? await store.getDurableDatabase() : null;
    if (db) {
      const col = db.collection('pastelchat_rate_limits');
      // ATOMIC: Single findOneAndUpdate with $inc eliminates read-then-upsert race condition.
      const resUp = await col.findOneAndUpdate(
        { _id: key },
        {
          $inc: { count: 1 },
          $setOnInsert: {
            resetAt,
            createdAt: new Date(now),
            name,
            clientKey
          },
          $set: { updatedAt: new Date(now) }
        },
        { upsert: true, returnDocument: 'after' }
      );

      const doc = resUp?.value || resUp;
      const currentCount = doc?.count || 1;

      res.set('RateLimit-Limit', String(max));
      res.set('RateLimit-Remaining', String(Math.max(0, max - currentCount)));
      res.set('RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

      if (currentCount > max) {
        res.set('Retry-After', String(Math.ceil((resetAt - now) / 1000)));
        return res.status(429).json({ message: 'Too many requests. Please try again later.' });
      }

      return next();
    }
  } catch (err) {
    durableError = err;
  }

  // SECURITY: In production, do NOT silently fall back to weak process-local in-memory buckets.
  // Fail safely if durable rate limiting is unavailable.
  if (process.env.NODE_ENV === 'production') {
    console.error('[RateLimit] Durable rate limit store unavailable in production:', durableError?.message || 'Database not connected');
    return res.status(503).json({ message: 'Service temporarily unavailable. Please try again shortly.' });
  }

  // 2. In-memory fallback (strictly for development / test environments)
  const current = buckets.get(key) || { count: 0, resetAt };
  current.count += 1;
  buckets.set(key, current);

  res.set('RateLimit-Limit', String(max));
  res.set('RateLimit-Remaining', String(Math.max(0, max - current.count)));
  res.set('RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
  if (current.count > max) {
    res.set('Retry-After', String(Math.ceil((resetAt - now) / 1000)));
    return res.status(429).json({ message: 'Too many requests. Please try again later.' });
  }
  return next();
};

module.exports = rateLimit;
