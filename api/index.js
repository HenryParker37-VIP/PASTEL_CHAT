const { app } = require('../backend/src/app');
const storeDb = require('../backend/src/db/store');

module.exports = async (req, res) => {
  // If durable store is not yet enabled/connected, attempt to connect and hydrate
  let justHydrated = false;
  if (!storeDb.isDurableStorageEnabled()) {
    try {
      await storeDb.hydrateFromDurableStore();
      justHydrated = true;
    } catch (err) {
      console.error('[Vercel Serverless] Store hydration failed:', err.message);
    }
  }

  const rawUrl = req.url || '';
  const pathOnly = rawUrl.split('?')[0];
  const isHealthOrDiagnostic = pathOnly === '/health' || pathOnly === '/api/version' || req.path === '/health' || req.path === '/api/version';

  // Vercel functions have no shared, durable filesystem. Refuse to handle
  // authenticated product traffic until the durable store is ready so that
  // account discovery, requests, and friendships cannot silently disappear.
  if (storeDb.isDurableStorageRequired() && !storeDb.isDurableStorageEnabled()) {
    if (isHealthOrDiagnostic) {
      return app(req, res);
    }
    return res.status(503).json({
      status: 'unavailable',
      storage: 'durable-storage-required',
      message: 'Pastel Chat storage is temporarily unavailable. Please try again shortly.'
    });
  }

  if (isHealthOrDiagnostic) {
    return app(req, res);
  }

  // A Vercel request can land on a different warm lambda than the previous
  // request. Reload the durable snapshot before every request so a newly
  // registered user, pending request, or accepted friendship is immediately
  // visible instead of waiting for a per-instance refresh interval.
  if (storeDb.isDurableStorageEnabled() && !justHydrated) {
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
