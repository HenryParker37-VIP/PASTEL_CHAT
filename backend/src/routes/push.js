const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { storePushSubscription, removePushSubscription } = require('../db/store');

// Store push subscription for the authenticated user
router.post('/subscribe', auth, (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  storePushSubscription(req.user._id, subscription);
  res.json({ ok: true });
});

// Remove a push subscription (e.g. on logout)
router.post('/unsubscribe', auth, (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) removePushSubscription(req.user._id, endpoint);
  res.json({ ok: true });
});

module.exports = router;
