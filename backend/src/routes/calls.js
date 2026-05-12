const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getPendingCall, clearPendingCall } = require('../db/store');

// GET /api/calls/pending
// Returns the pending incoming call for the logged-in user (if any, within 60s TTL)
router.get('/pending', authMiddleware, (req, res) => {
  const call = getPendingCall(req.user._id);
  if (!call) return res.json({ pending: false });
  res.json({ pending: true, ...call });
});

// DELETE /api/calls/pending
// Clear pending call (answered, rejected, or timed out on client)
router.delete('/pending', authMiddleware, (req, res) => {
  clearPendingCall(req.user._id);
  res.json({ ok: true });
});

module.exports = router;
