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
  const key = `${name}:${clientKey}`;
  const now = Date.now();

  // 1. Attempt durable throttling if MongoDB is available
  try {
    const store = getStore();
    const db = store && typeof store.getDurableDatabase === 'function' ? await store.getDurableDatabase() : null;
    if (db) {
      const col = db.collection('pastelchat_rate_limits');
      const doc = await col.findOne({ _id: key });
      let currentCount = 1;
      let resetAt = now + windowMs;

      if (!doc || !doc.resetAt || doc.resetAt <= now) {
        await col.updateOne(
          { _id: key },
          { $set: { count: 1, resetAt, updatedAt: new Date(now) } },
          { upsert: true }
        );
      } else {
        resetAt = doc.resetAt;
        const resUp = await col.findOneAndUpdate(
          { _id: key },
          { $inc: { count: 1 }, $set: { updatedAt: new Date(now) } },
          { returnDocument: 'after' }
        );
        currentCount = (resUp && resUp.value ? resUp.value.count : resUp?.count) || (doc.count + 1);
      }

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
    // If durable check fails, fall through to in-memory fallback
  }

  // 2. In-memory fallback
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + windowMs };

  bucket.count += 1;
  buckets.set(key, bucket);
  res.set('RateLimit-Limit', String(max));
  res.set('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
  res.set('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count > max) {
    res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
    return res.status(429).json({ message: 'Too many requests. Please try again later.' });
  }
  return next();
};

module.exports = rateLimit;
