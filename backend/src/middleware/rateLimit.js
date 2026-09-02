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

const rateLimit = ({ windowMs = 15 * 60_000, max = 20, name = 'request' } = {}) => (req, res, next) => {
  const key = `${name}:${getClientKey(req)}`;
  const now = Date.now();
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
