const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/admin');
const rateLimit = require('../middleware/rateLimit');
const { store, createRelease, findRelease, notifyUsersOfRelease, createAuditLog } = require('../db/store');
const { sendPushToUser, getPushLanguage } = require('../services/pushService');

function cleanList(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 20) : [];
}

router.post('/', requireAdmin, rateLimit({ name: 'admin-release', windowMs: 5 * 60_000, max: 10 }), async (req, res) => {
  const body = req.body || {};
  const version = String(body.version || '').trim();
  const title = String(body.title || '').trim();
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version) || !title || title.length > 160) return res.status(400).json({ message: 'A valid semantic version and title are required' });
  const existing = findRelease(version);
  if (existing) return res.json({ release: existing, notificationsCreated: 0, pushesSent: 0, duplicate: true });
  if (body.pushEnabled && (!body.important || body.confirmed !== true)) return res.status(400).json({ message: 'Important push requires explicit confirmation' });
  const release = createRelease({
    version, title, titleVi: body.titleVi, summary: body.summary, summaryVi: body.summaryVi,
    features: cleanList(body.features), featuresVi: cleanList(body.featuresVi), fixes: cleanList(body.fixes), fixesVi: cleanList(body.fixesVi),
    improvements: cleanList(body.improvements), improvementsVi: cleanList(body.improvementsVi), releasedAt: body.releasedAt,
    important: body.important, pushEnabled: body.pushEnabled
  });
  if (!release) return res.status(400).json({ message: 'Invalid release' });
  const notificationsCreated = notifyUsersOfRelease(release);
  const io = req.app.get('io');
  if (io) store.users.forEach((user) => {
    const notification = store.notifications.find((item) => item.userId === user._id && item.type === 'release_published' && item.data?.releaseVersion === release.version);
    if (notification) io.emit(`notify:${user._id}`, { type: notification.type, releaseVersion: release.version, notificationId: notification._id, data: notification.data });
  });
  let pushesSent = 0;
  if (release.important && release.pushEnabled) {
    for (const user of store.users.filter((item) => !item.isSuspended)) {
      const language = getPushLanguage(user._id);
      const result = await sendPushToUser(user._id, { type: 'release_published', title: language === 'vi' ? `PastelChat v${release.version} đã cập nhật` : `PastelChat v${release.version} is here`, body: language === 'vi' ? `Phiên bản ${release.version} đã sẵn sàng.` : `Version ${release.version} is ready.`, icon: '/icons/icon-192x192.png', badge: '/icons/icon-72x72.png', tag: `release-${release.version}`, url: `/whats-new/${encodeURIComponent(release.version)}`, data: { releaseVersion: release.version, url: `/whats-new/${encodeURIComponent(release.version)}` } });
      pushesSent += result?.sent || 0;
    }
  }
  createAuditLog({ adminId: req.user._id, action: 'release_published', targetType: 'release', targetId: release._id, metadata: { version: release.version, notificationsCreated, pushesSent, important: release.important, pushEnabled: release.pushEnabled } });
  if (pushesSent) createAuditLog({ adminId: req.user._id, action: 'important_push', targetType: 'release', targetId: release._id, metadata: { pushesSent } });
  return res.status(201).json({ release, notificationsCreated, pushesSent });
});

module.exports = router;
