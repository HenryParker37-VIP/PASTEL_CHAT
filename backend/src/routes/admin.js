const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { store } = require('../db/store');

// GET /admin/dashboard - Fetch user list and feedback requests for the admin
router.get('/dashboard', authMiddleware, (req, res) => {
  // Security check: only allow Admin user
  if (req.user.loginCode !== 'ADMN-0307' && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // Sanitize user list: hide login codes for regular users for privacy
  const sanitizedUsers = store.users.map(u => ({
    _id: u._id,
    name: u.name,
    avatar: u.avatar,
    createdAt: u.createdAt,
    lastSeen: u.lastSeen,
    isOnline: u.isOnline,
    isAdmin: !!u.isAdmin
  })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first

  res.json({
    users: sanitizedUsers,
    feedback: store.feedback.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  });
});

module.exports = router;
