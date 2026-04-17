const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const {
  findUser,
  findUserById,
  findUserByName,
  isNameTaken,
  createUser,
  updateUser,
  generateLoginCode,
  userPublic
} = require('../db/store');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'pastel-chat-secret';

function defaultAvatar(seed) {
  const safe = encodeURIComponent((seed || 'guest').toLowerCase().trim());
  return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${safe}&backgroundColor=ffb6c1,add8e6,dda0dd,ffe4e1&radius=50`;
}
function issueToken(user) {
  return jwt.sign({ userId: user._id, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
}

// POST /auth/register - Create new user, return unique login code + JWT
router.post('/register', (req, res) => {
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

    res.json({
      token: issueToken(user),
      user: { ...userPublic(user), loginCode: user.loginCode }
    });
  } catch (error) {
    console.error('[Auth] Register error:', error.message);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// POST /auth/login - Login with code
router.post('/login', (req, res) => {
  try {
    const { loginCode } = req.body;
    let code = (loginCode || '').trim().toUpperCase();
    
    // Automatically inject the hyphen for 8-character strings missing it
    if (code.length === 8 && !code.includes('-')) {
      code = code.slice(0, 4) + '-' + code.slice(4);
    }

    if (!code) return res.status(400).json({ message: 'Login code is required' });

    const user = findUser({ loginCode: code });
    if (!user) return res.status(401).json({ message: 'Invalid login code' });

    res.json({
      token: issueToken(user),
      user: { ...userPublic(user), loginCode: user.loginCode }
    });
  } catch (error) {
    console.error('[Auth] Login error:', error.message);
    res.status(500).json({ message: 'Login failed' });
  }
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
  res.json({ ...userPublic(req.user), loginCode: req.user.loginCode });
});

module.exports = router;
