const PRODUCTION_FRONTEND_ORIGIN = 'https://pastel-chat.vercel.app';

function createCorsOrigin({ persistentService = false, configuredOrigins = [], legacyOrigins = [] } = {}) {
  const allowed = new Set([...(persistentService ? [PRODUCTION_FRONTEND_ORIGIN] : legacyOrigins), ...configuredOrigins]);
  return (origin, callback) => {
    if (!origin || allowed.has(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  };
}

module.exports = { PRODUCTION_FRONTEND_ORIGIN, createCorsOrigin };
