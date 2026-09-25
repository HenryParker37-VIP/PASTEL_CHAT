const { findUserById, findSession, touchSession, createSession, createUser, revokeSession, findAccessCodeById, accessCodeView } = require('../db/store');
const { issueToken, verifyToken } = require('../config/auth');

function createUserToken(user, sessionOptions = {}) {
  return issueToken(user, createSession, sessionOptions);
}

function authenticateToken(token, { requireStoredSession = false } = {}) {
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;

  let user = findUserById(decoded.userId);
  if (!user && decoded.name && !requireStoredSession) {
    if (decoded.userId === 'user_ai_lyra' || decoded.userId?.startsWith('user_ai_') || decoded.isAI) {
      return null;
    }
    user = createUser({
      _id: decoded.userId,
      name: decoded.name,
      loginCode: decoded.loginCode,
      avatar: decoded.avatar,
      isAdmin: false, // SECURITY: Synthesized users from tokens never receive admin rights
      loginMethod: decoded.loginMethod || 'code'
    });
  }
  // SECURITY: Lyra/AI/service accounts must never be interactively authenticated
  if (!user || user.isSuspended || user.isAI || user.isService || user.aiCharacterId || user._id === 'user_ai_lyra') return null;
  if (Number(user.authVersion || 0) !== Number(decoded.ver || 0)) return null;

  const sid = decoded.sid || `sess-${decoded.userId}`;
  let session = findSession(sid);
  if (!session && requireStoredSession) return null;
  if (!session) {
    const exp = decoded.exp ? new Date(decoded.exp * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    session = createSession({
      _id: sid,
      userId: user._id,
      expiresAt: exp,
      adminRole: user.isAdmin === true ? 'OWNER' : null
    });
  }

  if (session.revokedAt || new Date(session.expiresAt) <= new Date()) return null;
  if (session.accessCodeId) {
    const accessCode = findAccessCodeById(session.accessCodeId);
    if (!accessCode || accessCodeView(accessCode).status !== 'Active') return null;
  }
  if (!requireStoredSession) touchSession(session._id);
  // SECURITY: Admin role derives strictly from server-side database user record.
  const adminRole = user.isAdmin === true ? (session.adminRole || 'OWNER') : null;
  return { user, session, decoded, adminRole };
}

module.exports = { createUserToken, authenticateToken, revokeSession };
