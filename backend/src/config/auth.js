const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const COMPROMISED_SECRETS = new Set([
  'pastel-chat-production-fallback-jwt-secret-2026',
  'pastel-chat-development-secret'
]);

function getJwtSecret() {
  const envSecret = (process.env.JWT_SECRET || '').trim();
  if (process.env.NODE_ENV === 'production') {
    if (!envSecret || COMPROMISED_SECRETS.has(envSecret)) {
      throw new Error('JWT_SECRET is not configured or uses an insecure fallback in production');
    }
    return envSecret;
  }
  if (envSecret && !COMPROMISED_SECRETS.has(envSecret)) {
    return envSecret;
  }
  return envSecret || 'dev-only-secret-do-not-use-in-production';
}

const JWT_ISSUER = 'pastelchat';
const JWT_AUDIENCE = 'pastelchat-web';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function assertAuthConfigured() {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (!secret) throw new Error('JWT_SECRET is not configured');
  if (COMPROMISED_SECRETS.has(secret)) {
    throw new Error('JWT_SECRET is set to an insecure compromised fallback');
  }
}

function issueToken(user, createSession, sessionOptions = {}) {
  assertAuthConfigured();
  const secret = getJwtSecret();
  const sessionId = crypto.randomBytes(18).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  if (typeof createSession === 'function') {
    createSession({ _id: sessionId, userId: user._id, expiresAt, ...sessionOptions });
  }
  return jwt.sign(
    {
      userId: user._id,
      name: user.name,
      loginCode: user.loginCode,
      avatar: user.avatar,
      isAdmin: Boolean(user.isAdmin),
      loginMethod: user.loginMethod || 'code',
      sid: sessionId,
      ver: Number(user.authVersion || 0)
    },
    secret,
    { expiresIn: Math.floor(SESSION_TTL_MS / 1000), issuer: JWT_ISSUER, audience: JWT_AUDIENCE, algorithm: 'HS256', jwtid: sessionId }
  );
}

function verifyToken(token) {
  assertAuthConfigured();
  const secret = getJwtSecret();
  return jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
}

module.exports = {
  get JWT_SECRET() { return getJwtSecret(); },
  JWT_ISSUER,
  JWT_AUDIENCE,
  SESSION_TTL_MS,
  assertAuthConfigured,
  issueToken,
  verifyToken
};
