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

// PUT /users/me - Update own profile (avatar, chatBackground)
router.put('/me', authMiddleware, (req, res) => {
  const allowed = {};
  if (typeof req.body.avatar === 'string') allowed.avatar = req.body.avatar.slice(0, 500);
  if (typeof req.body.chatBackground === 'string') allowed.chatBackground = req.body.chatBackground.slice(0, 50);
  const user = updateUser(req.user._id, allowed);
  res.json({ ...userPublic(user), loginCode: user.loginCode });
});

module.exports = router;
