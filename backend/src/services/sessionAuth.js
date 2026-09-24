const { findUserById, findSession, touchSession, createSession, createUser, revokeSession, findAccessCodeById, accessCodeView } = require('../db/store');
const { issueToken, verifyToken } = require('../config/auth');
const { isReadOnlyMode } = require('../config/runtimeMode');

function createUserToken(user, sessionOptions = {}) {
  return issueToken(user, createSession, sessionOptions);
}

function authenticateToken(token) {
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  const readOnly = isReadOnlyMode();

  let user = findUserById(decoded.userId);
  if (!user && decoded.name && !readOnly) {
    user = createUser({
      _id: decoded.userId,
      name: decoded.name,
      loginCode: decoded.loginCode,
      avatar: decoded.avatar,
      isAdmin: Boolean(decoded.isAdmin),
      loginMethod: decoded.loginMethod || 'code'
    });
  }
  if (!user || user.isSuspended) return null;
  if (Number(user.authVersion || 0) !== Number(decoded.ver || 0)) return null;

  const sid = decoded.sid || `sess-${decoded.userId}`;
  let session = findSession(sid);
  if (!session) {
    if (readOnly) return null;
    const exp = decoded.exp ? new Date(decoded.exp * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    session = createSession({
      _id: sid,
      userId: user._id,
      expiresAt: exp,
      adminRole: user.isAdmin ? 'OWNER' : null
    });
  }

  if (session.revokedAt || new Date(session.expiresAt) <= new Date()) return null;
  if (session.accessCodeId) {
    const accessCode = findAccessCodeById(session.accessCodeId);
    if (!accessCode || accessCodeView(accessCode).status !== 'Active') return null;
  }
  if (!readOnly) touchSession(session._id);
  const adminRole = session.adminRole || (user.isAdmin === true ? 'OWNER' : null);
  return { user, session, decoded, adminRole };
}

module.exports = { createUserToken, authenticateToken, revokeSession };
