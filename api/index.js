const { app } = require('../backend/src/app');
const storeDb = require('../backend/src/db/store');

let readyPromise = null;

module.exports = async (req, res) => {
  if (!readyPromise) {
    readyPromise = storeDb.ready.catch((err) => {
      console.error('[Vercel Serverless] Store hydration failed:', err.message);
    });
  }
  await readyPromise;

  // Vercel functions have no shared, durable filesystem. Refuse to handle
  // authenticated product traffic until the durable store is ready so that
  // account discovery, requests, and friendships cannot silently disappear.
  if (storeDb.isDurableStorageRequired() && !storeDb.isDurableStorageEnabled()) {
    return res.status(503).json({
      status: 'unavailable',
      storage: 'durable-storage-required',
      message: 'Pastel Chat storage is temporarily unavailable. Please try again shortly.'
    });
  }

  const isHealthCheck = req.url === '/health' || req.path === '/health';
  if (isHealthCheck) {
    return app(req, res);
  }

  // A Vercel request can land on a different warm lambda than the previous
  // request. Reload the durable snapshot before every request so a newly
  // registered user, pending request, or accepted friendship is immediately
  // visible instead of waiting for a per-instance refresh interval.
  if (storeDb.isDurableStorageEnabled()) {
    try {
      await storeDb.hydrateFromDurableStore();
    } catch (err) {
      console.warn('[Vercel Serverless] Sync warning:', err.message);
    }
  }

  // Intercept res.end to guarantee MongoDB writes complete before serverless container pauses
  const originalEnd = res.end;
  res.end = function (...args) {
    const finish = () => originalEnd.apply(res, args);
    if (storeDb.isDurableStorageEnabled() && storeDb.isDirty?.()) {
      storeDb.flushPersist()
        .catch((err) => console.error('[Vercel Serverless] Flush error:', err.message))
        .finally(finish);
    } else {
      finish();
    }
  };

  return app(req, res);
};
