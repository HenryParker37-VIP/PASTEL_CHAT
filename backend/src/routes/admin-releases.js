const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  store,
  createRelease,
  findRelease,
  notifyUsersOfRelease
} = require('../db/store');
const { sendPushToUser, getPushLanguage } = require('../services/pushService');

const isAdmin = (user) => user?.isAdmin || user?.loginCode === 'ADMN-0307';

// Protected publishing endpoint. Re-publishing a version returns the existing
// release and never creates a second notification fan-out.
router.post('/', auth, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ message: 'Forbidden' });
  const { version, title, titleVi, summary, summaryVi, features, featuresVi, fixes, fixesVi, improvements, improvementsVi, releasedAt, important, pushEnabled } = req.body || {};
  if (!version || !title) return res.status(400).json({ message: 'Version and title are required' });
  if (findRelease(version)) {
    return res.json({ release: findRelease(version), notificationsCreated: 0, duplicate: true });
  }

  const release = createRelease({ version, title, titleVi, summary, summaryVi, features, featuresVi, fixes, fixesVi, improvements, improvementsVi, releasedAt, important, pushEnabled });
  if (!release) return res.status(400).json({ message: 'Invalid release' });
  const notificationsCreated = notifyUsersOfRelease(release);
  const io = req.app.get('io');
  if (io) {
    store.users.forEach((user) => {
      const notification = store.notifications.find(item => item.userId === user._id && item.type === 'release_published' && item.data?.releaseVersion === release.version);
      if (notification) io.emit(`notify:${user._id}`, { type: 'release_published', releaseVersion: release.version, notificationId: notification._id, data: notification.data });
    });
  }

  let pushesSent = 0;
  if (release.important && release.pushEnabled) {
    await Promise.all(store.users.map(async (user) => {
      const language = getPushLanguage(user._id);
      const titleText = language === 'vi' ? `PastelChat v${release.version} đã cập nhật ✨` : `PastelChat v${release.version} is here ✨`;
      const bodyText = language === 'vi'
        ? `Phiên bản ${release.version} đã sẵn sàng. Xem các tính năng mới và nội dung đã cải thiện.`
        : `Version ${release.version} is ready. See what’s new and improved.`;
      const result = await sendPushToUser(user._id, {
        type: 'release_published',
        title: titleText,
        body: bodyText,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: `release-${release.version}`,
        url: `/whats-new/${encodeURIComponent(release.version)}`,
        data: { releaseVersion: release.version, url: `/whats-new/${encodeURIComponent(release.version)}` }
      });
      pushesSent += result?.sent || 0;
    }));
  }
  res.status(201).json({ release, notificationsCreated, pushesSent });
});

module.exports = router;
