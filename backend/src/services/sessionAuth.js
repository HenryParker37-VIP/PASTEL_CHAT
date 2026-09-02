const { findUserById, findSession, touchSession, createSession, revokeSession } = require('../db/store');
const { issueToken, verifyToken } = require('../config/auth');

function createUserToken(user) {
  return issueToken(user, createSession);
}

function authenticateToken(token) {
  const decoded = verifyToken(token);
  if (!decoded?.userId || !decoded?.sid) return null;
  const user = findUserById(decoded.userId);
  const session = findSession(decoded.sid);
  if (!user || !session || session.userId !== user._id || new Date(session.expiresAt) <= new Date()) return null;
  if (Number(user.authVersion || 0) !== Number(decoded.ver || 0) || user.isSuspended) return null;
  touchSession(session._id);
  return { user, session, decoded };
}

module.exports = { createUserToken, authenticateToken, revokeSession };
