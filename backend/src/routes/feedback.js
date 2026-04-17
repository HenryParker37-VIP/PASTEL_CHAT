const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { createFeedback } = require('../db/store');

// POST /feedback - Submit a bug report or feedback
// Note: in production this would send email to the creator via SMTP.
// For now it logs to console and stores in DB. Creator can read db.json feedback[].
router.post('/', authMiddleware, (req, res) => {
  const { type = 'bug', message = '' } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ message: 'Message required' });
  const t = ['bug', 'feedback', 'feature'].includes(type) ? type : 'feedback';
  const fb = createFeedback(req.user._id, t, message.trim());
  // TODO: Email Nguyen Manh Tuan Hung (Henry Parker) via SMTP when configured
  res.json({ success: true, id: fb._id });
});

module.exports = router;
