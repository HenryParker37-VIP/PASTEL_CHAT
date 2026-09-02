const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  searchUsers,
  updateUser,
  userPublic,
  findUserById
} = require('../db/store');

// GET /users/search?q=xxx - Search users by name
router.get('/search', authMiddleware, (req, res) => {
  const query = req.query.q || '';
  const results = searchUsers(query, req.user._id);
  res.json(results);
});

// GET /users/:id - Get user profile
router.get('/:id', authMiddleware, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(userPublic(user));
});

// PUT /users/me - Update own profile (avatar, chatBackground, chatColor, bio, status)
router.put('/me', authMiddleware, (req, res) => {
  const allowed = {};
  if (typeof req.body.avatar === 'string') allowed.avatar = req.body.avatar.slice(0, 100000);
  if (typeof req.body.chatBackground === 'string') allowed.chatBackground = req.body.chatBackground.slice(0, 50);
  if (req.body.chatColor === null || typeof req.body.chatColor === 'string') allowed.chatColor = req.body.chatColor ? req.body.chatColor.slice(0, 20) : null;
  if (req.body.chatColors && typeof req.body.chatColors === 'object' && !Array.isArray(req.body.chatColors)) {
    allowed.chatColors = Object.fromEntries(
      Object.entries(req.body.chatColors)
        .filter(([friendId, color]) => /^[a-f0-9]{24}$/.test(friendId) && (color === null || typeof color === 'string'))
        .slice(0, 100)
        .map(([friendId, color]) => [friendId, color ? color.slice(0, 20) : null])
    );
  }
  if (typeof req.body.bio === 'string') allowed.bio = req.body.bio.slice(0, 120);
  if (typeof req.body.status === 'string') allowed.status = req.body.status.slice(0, 60);
  const user = updateUser(req.user._id, allowed);
  res.json({ ...userPublic(user), loginCode: user.loginCode });
});

module.exports = router;
