const { app } = require('../backend/src/app');
const storeDb = require('../backend/src/db/store');

let readyPromise = null;
let lastHydrateAt = 0;

module.exports = async (req, res) => {
  const rawUrl = req.url || '';
  const pathOnly = rawUrl.split('?')[0];
  const isVersion = pathOnly === '/api/version' || req.path === '/api/version';

  // Version is independent of storage. Health must wait for durable hydration.
  if (isVersion) {
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

  if (storeDb.isDurableStorageRequired() && !storeDb.isDurableStorageEnabled()) {
    return res.status(503).json({ status: 'unavailable', message: 'Durable storage is temporarily unavailable' });
  }

  // Messages live in per-message documents. Refresh them on every request;
  // the snapshot throttle must never hide another worker's new message.
  if (storeDb.isDurableStorageEnabled()) {
    try {
      await storeDb.refreshDurableMessages();
    } catch (err) {
      console.error('[Vercel Serverless] Message refresh failed:', err.message);
      return res.status(503).json({ status: 'unavailable', message: 'Message storage is temporarily unavailable' });
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
        .then(finish)
        .catch((err) => {
          console.error('[Vercel Serverless] Flush error:', err.message);
          if (res.headersSent) return finish();
          res.statusCode = 503;
          res.removeHeader?.('Content-Length');
          res.setHeader?.('Content-Type', 'application/json');
          originalEnd.call(res, JSON.stringify({ status: 'unavailable', message: 'Storage write failed' }));
        });
    } else {
      finish();
    }
  };

  return app(req, res);
};
