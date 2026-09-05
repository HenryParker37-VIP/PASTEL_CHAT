const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'pastel-chat-production-fallback-jwt-secret-2026';
const JWT_ISSUER = 'pastelchat';
const JWT_AUDIENCE = 'pastelchat-web';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function assertAuthConfigured() {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
}

function issueToken(user, createSession, sessionOptions = {}) {
  assertAuthConfigured();
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
    JWT_SECRET,
    { expiresIn: Math.floor(SESSION_TTL_MS / 1000), issuer: JWT_ISSUER, audience: JWT_AUDIENCE, algorithm: 'HS256', jwtid: sessionId }
  );
}

function verifyToken(token) {
  assertAuthConfigured();
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
}

module.exports = { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE, SESSION_TTL_MS, assertAuthConfigured, issueToken, verifyToken };
