const { findUserById, findSession, touchSession, createSession, revokeSession, findAccessCodeById, accessCodeView } = require('../db/store');
const { issueToken, verifyToken } = require('../config/auth');

function createUserToken(user, sessionOptions = {}) {
  return issueToken(user, createSession, sessionOptions);
}

function authenticateToken(token) {
  const decoded = verifyToken(token);
  if (!decoded?.userId || !decoded?.sid) return null;
  const user = findUserById(decoded.userId);
  const session = findSession(decoded.sid);
  if (!user || !session || session.userId !== user._id || new Date(session.expiresAt) <= new Date()) return null;
  if (Number(user.authVersion || 0) !== Number(decoded.ver || 0) || user.isSuspended || session.revokedAt) return null;
  if (session.accessCodeId) {
    const accessCode = findAccessCodeById(session.accessCodeId);
    if (!accessCode || accessCodeView(accessCode).status !== 'Active') return null;
  }
  touchSession(session._id);
  const adminRole = session.adminRole || (user.isAdmin === true ? 'OWNER' : null);
  return { user, session, decoded, adminRole };
}

module.exports = { createUserToken, authenticateToken, revokeSession };
