const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { createFeedback, createReport, findUserById } = require('../db/store');

// POST /feedback - Submit a bug report or feedback
// Note: in production this would send email to the creator via SMTP.
// For now it logs to console and stores in DB. Creator can read db.json feedback[].
router.post('/', authMiddleware, rateLimit({ name: 'feedback', max: 10 }), (req, res) => {
  const { type = 'bug', message = '' } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ message: 'Message required' });
  if (String(message).trim().length > 2000) return res.status(400).json({ message: 'Message too long' });
  const t = ['bug', 'feedback', 'feature'].includes(type) ? type : 'feedback';
  const fb = createFeedback(req.user._id, t, String(message).trim());
  // TODO: Email Nguyen Manh Tuan Hung (Henry Parker) via SMTP when configured
  res.json({ success: true, id: fb._id });
});

router.post('/report', authMiddleware, rateLimit({ name: 'report', max: 5 }), (req, res) => {
  const { reportedUserId, entityType, entityId, category = 'other', description = '', evidence = null } = req.body || {};
  const categories = ['spam', 'harassment', 'impersonation', 'inappropriate', 'privacy_safety', 'account_behavior', 'other'];
  if (!categories.includes(category) || !String(description).trim() || String(description).trim().length > 2000) return res.status(400).json({ message: 'A valid category and description are required' });
  if (reportedUserId && !findUserById(reportedUserId)) return res.status(404).json({ message: 'Reported user not found' });
  const report = createReport({ reporterId: req.user._id, reportedUserId, entityType, entityId, category, description: String(description).trim(), evidence });
  res.status(201).json({ success: true, id: report._id });
});

module.exports = router;
