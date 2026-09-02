const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const fetch = require('node-fetch');
const {
  findUser,
  findUserById,
  findUserByName,
  isNameTaken,
  createUser,
  updateUser,
  generateLoginCode,
  userPublic,
  createAuditLog,
  revokeSession, findAccessCodeByCode, markAccessCodeUsed, normalizeAccessCode
} = require('../db/store');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { createUserToken } = require('../services/sessionAuth');

// Public client ID — not a secret, safe to hardcode. Must match frontend REACT_APP_GOOGLE_CLIENT_ID.
const GOOGLE_CLIENT_ID = '803433790062-2dmhg2du471q65q2biheuli604b31vgv.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function defaultAvatar(seed) {
  const safe = encodeURIComponent((seed || 'guest').toLowerCase().trim());
  return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${safe}&backgroundColor=ffb6c1,add8e6,dda0dd,ffe4e1&radius=50`;
}
function issueToken(user) { return createUserToken(user); }

function authUserView(user, adminRole = null) {
  const view = { ...userPublic(user) };
  if (user.isAdmin === true) return { ...view, isAdmin: true, adminRole: adminRole || 'OWNER' };
  return { ...view, loginCode: user.loginCode, isAdmin: false };
}

function sameSecret(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// POST /auth/register - Create new user, return unique login code + JWT
router.post('/register', rateLimit({ name: 'auth-register', max: 10 }), (req, res) => {
  try {
    const { name } = req.body;
    const trimmed = (name || '').trim();
    if (!trimmed) return res.status(400).json({ message: 'Name is required' });
    if (trimmed.length < 2) return res.status(400).json({ message: 'Name must be at least 2 characters' });
    if (trimmed.length > 30) return res.status(400).json({ message: 'Name too long (max 30)' });
    if (isNameTaken(trimmed)) return res.status(409).json({ message: 'Name already used' });

    const loginCode = generateLoginCode();
    const user = createUser({
      name: trimmed,
      loginCode,
      avatar: defaultAvatar(trimmed)
    });

    res.json({ token: issueToken(user), user: authUserView(user) });
  } catch (error) {
    console.error('[Auth] Register error:', error.message);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// POST /auth/login - Login with code
router.post('/login', rateLimit({ name: 'auth-login', max: 12 }), (req, res) => {
  try {
    const { loginCode } = req.body;
    let code = (loginCode || '').trim().toUpperCase();

    // Automatically inject the hyphen for 8-character strings missing it
    if (code.length === 8 && !code.includes('-')) {
      code = code.slice(0, 4) + '-' + code.slice(4);
    }

    if (!code) return res.status(400).json({ message: 'Login code is required' });

    const ownerCode = normalizeAccessCode(process.env.ADMIN_LOGIN_CODE);
    const demoCode = findAccessCodeByCode(code);
    let user = null;
    let adminRole = null;
    let accessCodeId = null;
    if (ownerCode && sameSecret(code, ownerCode)) {
      user = findUser({ isAdmin: true });
      adminRole = 'OWNER';
    } else if (demoCode) {
      user = findUser({ isAdmin: true });
      adminRole = 'DEMO';
      accessCodeId = demoCode._id;
    } else {
      user = findUser({ loginCode: code });
    }
    if (!user || (user.isAdmin && !adminRole)) return res.status(401).json({ message: 'Invalid login code' });
    if (user.isSuspended) return res.status(403).json({ message: 'This account is suspended' });

    if (adminRole) {
      if (demoCode) markAccessCodeUsed(demoCode._id);
      createAuditLog({ adminId: user._id, action: adminRole === 'DEMO' ? 'demo_login' : 'owner_login', targetType: 'admin', targetId: user._id, metadata: { method: 'login_code', role: adminRole } });
    }

    res.json({
      token: createUserToken(user, { adminRole, accessCodeId }),
      user: authUserView(user, adminRole)
    });
  } catch (error) {
    console.error('[Auth] Login error:', error.message);
    res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/logout', authMiddleware, (req, res) => {
  revokeSession(req.session._id);
  updateUser(req.user._id, { isOnline: false, lastSeen: new Date().toISOString() });
  res.json({ ok: true });
});

// GET /auth/check-name?name=xxx - Check if nickname is available
router.get('/check-name', (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name || name.length < 2) return res.json({ available: false, reason: 'too_short' });
  if (name.length > 30) return res.json({ available: false, reason: 'too_long' });
  const taken = isNameTaken(name);
  res.json({ available: !taken, reason: taken ? 'taken' : null });
});

// POST /auth/update-name - Change nickname (auth required)
router.post('/update-name', authMiddleware, (req, res) => {
  try {
    const trimmed = (req.body.name || '').trim();
    if (!trimmed || trimmed.length < 2) return res.status(400).json({ message: 'Name too short' });
    if (trimmed.length > 30) return res.status(400).json({ message: 'Name too long' });
    if (isNameTaken(trimmed, req.user._id)) return res.status(409).json({ message: 'Name already used' });

    const user = updateUser(req.user._id, { name: trimmed });
    res.json({ ...userPublic(user), loginCode: user.loginCode });
  } catch (error) {
    console.error('[Auth] Update name error:', error.message);
    res.status(500).json({ message: 'Update failed' });
  }
});

// GET /auth/me - Return current user (with login code for reminder)
router.get('/me', authMiddleware, (req, res) => {
  res.json(authUserView(req.user, req.adminRole));
});

// POST /auth/google - Sign in or register via Google OAuth
router.post('/google', rateLimit({ name: 'auth-google', max: 10 }), async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Google token required' });

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const googleEmail = payload.email;
    const googleName = payload.name || payload.given_name || 'PastelUser';
    const googleAvatar = payload.picture || defaultAvatar(googleName);

    // Find existing user by googleId or email
    let user = findUser({ googleId }) || findUser({ email: googleEmail });

    if (!user) {
      // New user — create account linked to Google
      let baseName = googleName.replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 20) || 'PastelUser';
      let finalName = baseName;
      let suffix = 1;
      while (isNameTaken(finalName)) {
        finalName = `${baseName}${suffix++}`;
      }
      user = createUser({
        name: finalName,
        loginCode: generateLoginCode(),
        avatar: googleAvatar,
        googleId,
        email: googleEmail,
        loginMethod: 'google',
        isGoogleVerified: true,
      });
    } else if (!user.googleId) {
      // Existing user — link Google to their account
      user = updateUser(user._id, { googleId, email: googleEmail, loginMethod: 'google', isGoogleVerified: true });
    } else {
      // Already a Google user — ensure fields are set
      if (!user.isGoogleVerified) {
        user = updateUser(user._id, { loginMethod: 'google', isGoogleVerified: true });
      }
    }

    if (user.isSuspended) return res.status(403).json({ message: 'This account is suspended' });

    res.json({
      token: issueToken(user),
      user: authUserView(user),
      isNewUser: !user.googleId,
    });
  } catch (error) {
    console.error('[OAuth] Google login error:', error.message);
    res.status(401).json({ message: 'Google authentication failed' });
  }
});

// POST /auth/microsoft - Sign in or register via Microsoft OAuth
router.post('/microsoft', rateLimit({ name: 'auth-microsoft', max: 10 }), async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Microsoft token required' });

    const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!graphRes.ok) {
      const err = await graphRes.text();
      console.error('[OAuth] Microsoft Graph error:', err);
      return res.status(401).json({ message: 'Microsoft token validation failed' });
    }
    const profile = await graphRes.json();
    const microsoftId = profile.id;
    const microsoftEmail = profile.mail || profile.userPrincipalName || '';
    const microsoftName = profile.displayName || profile.givenName || 'PastelUser';
    const microsoftAvatar = defaultAvatar(microsoftName);

    let user = findUser({ microsoftId });
    if (!user && microsoftEmail) user = findUser({ email: microsoftEmail });

    if (!user) {
      let baseName = microsoftName.replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 20) || 'PastelUser';
      let finalName = baseName;
      let suffix = 1;
      while (isNameTaken(finalName)) finalName = `${baseName}${suffix++}`;
      user = createUser({
        name: finalName,
        loginCode: generateLoginCode(),
        avatar: microsoftAvatar,
        microsoftId,
        email: microsoftEmail,
        loginMethod: 'microsoft',
      });
    } else if (!user.microsoftId) {
      user = updateUser(user._id, { microsoftId, loginMethod: 'microsoft' });
    }

    if (user.isSuspended) return res.status(403).json({ message: 'This account is suspended' });

    res.json({
      token: issueToken(user),
      user: authUserView(user),
    });
  } catch (error) {
    console.error('[OAuth] Microsoft login error:', error.message);
    res.status(401).json({ message: 'Microsoft authentication failed' });
  }
});

module.exports = router;
