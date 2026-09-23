const { app } = require('../backend/src/app');
const storeDb = require('../backend/src/db/store');

let readyPromise = null;
let lastHydrateAt = 0;

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

  // If connected to MongoDB, periodically re-sync state across lambda instances (e.g. every 2s)
  const now = Date.now();
  if (storeDb.isDurableStorageEnabled() && now - lastHydrateAt > 2000) {
    lastHydrateAt = now;
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
    if (storeDb.isDurableStorageEnabled()) {
      storeDb.flushPersist()
        .catch((err) => console.error('[Vercel Serverless] Flush error:', err.message))
        .finally(finish);
    } else {
      finish();
    }
  };

  return app(req, res);
};
