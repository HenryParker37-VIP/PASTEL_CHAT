const { app } = require('../backend/src/app');
const storeDb = require('../backend/src/db/store');

let readyPromise = null;
let lastHydrateAt = 0;

module.exports = async (req, res) => {
  const rawUrl = req.url || '';
  const pathOnly = rawUrl.split('?')[0];
  const isHealthOrDiagnostic = pathOnly === '/health' || pathOnly === '/api/version' || req.path === '/health' || req.path === '/api/version';

  // Fast-path health probes immediately so monitoring/readiness never blocks
  if (isHealthOrDiagnostic) {
    return app(req, res);
  }

  // Ensure durable store hydration is resolved before processing application traffic
  if (!readyPromise) {
    readyPromise = Promise.resolve(storeDb.ready).then(() => {
      lastHydrateAt = Date.now();
    }).catch((err) => {
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

  // Re-sync across lambdas at most once every 1.5 seconds
  const now = Date.now();
  if (storeDb.isDurableStorageEnabled() && now - lastHydrateAt > 1500) {
    lastHydrateAt = now;
    try {
      await storeDb.hydrateFromDurableStore();
    } catch (err) {
      console.warn('[Vercel Serverless] Sync warning:', err.message);
    }
  }

  // Intercept res.end to guarantee MongoDB writes complete before serverless container pauses
  let ended = false;
  const originalEnd = res.end;
  res.end = function (...args) {
    if (ended) return;
    ended = true;
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
