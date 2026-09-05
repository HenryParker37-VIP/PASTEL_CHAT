const { app } = require('../backend/src/app');
const storeDb = require('../backend/src/db/store');

let readyPromise = null;

module.exports = async (req, res) => {
  if (!readyPromise) {
    readyPromise = storeDb.ready.catch((err) => {
      console.error('[Vercel Serverless] Store hydration warning:', err.message);
    });
  }
  await readyPromise;
  return app(req, res);
};
