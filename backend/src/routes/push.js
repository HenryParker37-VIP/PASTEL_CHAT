const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { storePushSubscription, removePushSubscription, getPushSubscriptions } = require('../db/store');
const { sendTestPush, getVapidPublicKey } = require('../services/pushService');

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
  const publicKey = getVapidPublicKey() || process.env.VAPID_PUBLIC_KEY || '';
  res.json({ publicKey });
});

// Store push subscription for the authenticated user
router.post('/subscribe', auth, (req, res) => {
  const { subscription, language } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  storePushSubscription(req.user._id, { ...subscription, language: language === 'vi' ? 'vi' : 'en' });
  res.json({ ok: true });
});

// Remove a push subscription (e.g. on logout or disabling notifications)
router.post('/unsubscribe', auth, (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) removePushSubscription(req.user._id, endpoint);
  res.json({ ok: true });
});

// Send a test push notification to the current user's registered devices
router.post('/send-test', auth, async (req, res) => {
  try {
    const subs = getPushSubscriptions(req.user._id);
    if (!subs || subs.length === 0) {
      return res.status(400).json({ error: 'No active push subscriptions found for this account. Please enable notifications first.' });
    }
    const result = await sendTestPush(req.user._id);
    res.json({ ok: true, result });
  } catch (err) {
    console.error('[Push] send-test failed:', err.message);
    res.status(500).json({ error: 'Failed to send test push notification' });
  }
});

module.exports = router;
