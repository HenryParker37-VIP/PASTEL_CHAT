const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const requireAdmin = require('../middleware/admin');
const requireOwner = requireAdmin.requireOwner;
const rateLimit = require('../middleware/rateLimit');
const {
  store, findUserById, getActiveSessionCount, updateUser, revokeUserSessions,
  createAuditLog, updateReport, createAnnouncement, createNotification, getStorageStatus,
  getReleases, createAccessCode, generateDemoAccessCode, accessCodeView, revokeAccessCode, revokeAccessCodeSessions
} = require('../db/store');
const { sendPushToUser, getPushLanguage } = require('../services/pushService');
const { appVersion, buildId } = require('../version');

const adminWriteLimit = rateLimit({ name: 'admin-write', windowMs: 5 * 60_000, max: 60 });
const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_EXPIRATIONS = { '1d': DAY_MS, '7d': 7 * DAY_MS, '30d': 30 * DAY_MS, never: null };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const isoDate = (date) => new Date(date).toISOString().slice(0, 10);
const safeDate = (value) => value ? new Date(value).toISOString() : null;

function presence(user) {
  if (user.isOnline) return 'Online';
  const lastSeen = user.lastSeen ? new Date(user.lastSeen).getTime() : 0;
  return lastSeen && Date.now() - lastSeen <= 15 * 60_000 ? 'Idle' : 'Offline';
}
function lastSeenLabel(value) {
  if (!value) return 'Never';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
function adminUserView(user) {
  const friends = store.friendships.filter((item) => item.userId === user._id).length;
  return {
    _id: user._id, name: user.name, avatar: user.avatar || '', createdAt: safeDate(user.createdAt),
    lastSeen: safeDate(user.lastSeen), lastSeenLabel: lastSeenLabel(user.lastSeen), presence: presence(user),
    status: user.status || '', isSuspended: Boolean(user.isSuspended), isAdmin: user.isAdmin === true,
    friendCount: friends, loginMethod: user.loginMethod || 'code', isGoogleVerified: Boolean(user.isGoogleVerified),
    isTestAccount: Boolean(user.isTestAccount), security: { activeSessions: getActiveSessionCount(user._id), authVersion: Number(user.authVersion || 0) }
  };
}
function ticketView(ticket, kind) {
  const reporter = findUserById(ticket.userId || ticket.reporterId);
  const reported = findUserById(ticket.reportedUserId);
  return {
    ...ticket,
    kind,
    reporter: reporter ? { _id: reporter._id, name: reporter.name, avatar: reporter.avatar || '' } : null,
    reportedUser: reported ? { _id: reported._id, name: reported.name, avatar: reported.avatar || '' } : null,
    message: String(ticket.message || ticket.description || '').slice(0, 2000),
    createdAt: safeDate(ticket.createdAt), updatedAt: safeDate(ticket.updatedAt)
  };
}
function allTickets() {
  return [
    ...store.feedback.map((ticket) => ticketView(ticket, ticket.type || 'feedback')),
    ...store.reports.map((ticket) => ticketView(ticket, 'report'))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function metricCounts() {
  const today = startOfToday();
  const active = store.users.filter((u) => u.lastSeen && new Date(u.lastSeen) >= today);
  const messages = store.messages.filter((m) => m.timestamp && new Date(m.timestamp) >= today);
  const openTickets = allTickets().filter((ticket) => !['Resolved', 'Dismissed', 'Closed'].includes(ticket.status || 'Open'));
  return {
    totalUsers: store.users.length,
    onlineNow: store.users.filter((u) => u.isOnline).length,
    idleNow: store.users.filter((u) => presence(u) === 'Idle').length,
    activeToday: active.length,
    newUsersToday: store.users.filter((u) => u.createdAt && new Date(u.createdAt) >= today).length,
    messagesToday: messages.length,
    openTickets: openTickets.length
  };
}
function analytics() {
  const result = [];
  for (let index = 6; index >= 0; index -= 1) {
    const start = new Date(Date.now() - index * DAY_MS); start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + DAY_MS);
    const between = (value) => value && new Date(value) >= start && new Date(value) < end;
    result.push({
      date: isoDate(start), registrations: store.users.filter((u) => between(u.createdAt)).length,
      activeUsers: new Set(store.users.filter((u) => between(u.lastSeen)).map((u) => u._id)).size,
      messages: store.messages.filter((m) => between(m.timestamp)).length,
      friendRequests: store.friendRequests.filter((r) => between(r.createdAt)).length,
      tickets: allTickets().filter((t) => between(t.createdAt)).length,
      reports: store.reports.filter((r) => between(r.createdAt)).length
    });
  }
  return result;
}
function health() {
  const storage = getStorageStatus();
  const frontendBuildPath = path.join(__dirname, '../../../frontend/build');
  return {
    api: { status: 'Healthy', detail: 'API responding' },
    mongodb: { status: storage.connected ? 'Healthy' : (storage.configured ? 'Unavailable' : 'Degraded'), detail: storage.connected ? 'Connected' : (storage.configured ? 'Connection unavailable' : 'MONGODB_URI not configured') },
    push: { status: process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? 'Healthy' : 'Degraded', detail: process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? 'Push keys configured' : 'Push keys not configured' },
    pwa: { status: fs.existsSync(path.join(frontendBuildPath, 'sw.js')) ? 'Healthy' : 'Unavailable', detail: fs.existsSync(path.join(frontendBuildPath, 'sw.js')) ? 'Service worker available' : 'Service worker unavailable' },
    releaseSystem: { status: 'Healthy', detail: 'Release storage and notifications available' }
  };
}
function emitNotification(io, notification) {
  if (io && notification) io.emit(`notify:${notification.userId}`, { type: notification.type, notificationId: notification._id, data: notification.data });
}
function recipientsFor(scope, selectedIds) {
  if (scope === 'test') return store.users.filter((user) => user.isTestAccount === true);
  if (scope === 'selected') return (selectedIds || []).map(findUserById).filter(Boolean).slice(0, 50);
  return store.users.filter((user) => !user.isSuspended);
}

router.get('/dashboard', requireAdmin, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const presenceFilter = String(req.query.presence || '').toLowerCase();
  const statusFilter = String(req.query.status || '').toLowerCase();
  const sort = String(req.query.sort || 'lastActive');
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  let users = store.users.filter((user) => {
    const searchable = `${user.name || ''} ${user.username || ''} ${user.loginCode || ''}`.toLowerCase();
    const matchesQuery = !q || searchable.includes(q);
    const matchesPresence = !presenceFilter || presence(user).toLowerCase() === presenceFilter;
    const matchesStatus = !statusFilter || (statusFilter === 'suspended' ? user.isSuspended === true : statusFilter === 'new' ? new Date(user.createdAt) >= new Date(Date.now() - 7 * DAY_MS) : true);
    return matchesQuery && matchesPresence && matchesStatus;
  });
  users.sort((left, right) => sort === 'name' ? String(left.name).localeCompare(String(right.name)) : sort === 'joined' ? new Date(right.createdAt) - new Date(left.createdAt) : new Date(right.lastSeen || 0) - new Date(left.lastSeen || 0));
  const total = users.length;
  users = users.slice((page - 1) * pageSize, page * pageSize).map(adminUserView);
  const tickets = allTickets();
  res.json({
    metrics: metricCounts(), version: appVersion, buildId, users, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
    tickets, health: health(), analytics: analytics(), releases: getReleases().slice(0, 12),
    announcements: store.announcements.slice(0, 12), auditLogs: store.auditLogs.slice(0, 100),
    adminRole: req.adminRole, readOnly: req.adminRole === 'DEMO'
  });
});

router.get('/access-codes', requireOwner, (req, res) => {
  return res.json({ accessCodes: store.accessCodes.map(accessCodeView) });
});

router.post('/access-codes', requireOwner, adminWriteLimit, (req, res) => {
  const expiration = String(req.body?.expiration || '7d');
  if (!Object.prototype.hasOwnProperty.call(DEMO_EXPIRATIONS, expiration)) return res.status(400).json({ message: 'A valid expiration is required' });
  const code = generateDemoAccessCode();
  const duration = DEMO_EXPIRATIONS[expiration];
  const record = createAccessCode({
    code,
    label: req.body?.label,
    expiresAt: duration ? new Date(Date.now() + duration).toISOString() : null,
    createdBy: req.user._id
  });
  createAuditLog({ adminId: req.user._id, action: 'demo_code_created', targetType: 'access_code', targetId: record._id, metadata: { label: record.label, expiration } });
  return res.status(201).json({ code, accessCode: accessCodeView(record) });
});

router.post('/access-codes/:id/revoke', requireOwner, adminWriteLimit, (req, res) => {
  const record = store.accessCodes.find((item) => item._id === req.params.id);
  if (!record) return res.status(404).json({ message: 'Access code not found' });
  revokeAccessCode(record._id);
  const sessionsRevoked = revokeAccessCodeSessions(record._id);
  createAuditLog({ adminId: req.user._id, action: 'demo_code_revoked', targetType: 'access_code', targetId: record._id, metadata: { sessionsRevoked } });
  return res.json({ accessCode: accessCodeView(record), sessionsRevoked });
});

router.get('/users/:id', requireAdmin, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ user: adminUserView(user) });
});

router.post('/users/:id/suspend', requireOwner, adminWriteLimit, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user._id === req.user._id || user.isAdmin) return res.status(403).json({ message: 'This account cannot be suspended here' });
  const reason = String(req.body?.reason || '').trim().slice(0, 240);
  updateUser(user._id, { isSuspended: true, authVersion: Number(user.authVersion || 0) + 1, suspensionReason: reason });
  const revoked = revokeUserSessions(user._id);
  createAuditLog({ adminId: req.user._id, action: 'suspend_account', targetType: 'user', targetId: user._id, metadata: { reason, sessionsRevoked: revoked } });
  return res.json({ user: adminUserView(user), sessionsRevoked: revoked });
});

router.post('/users/:id/unsuspend', requireOwner, adminWriteLimit, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  updateUser(user._id, { isSuspended: false, suspensionReason: '' });
  createAuditLog({ adminId: req.user._id, action: 'unsuspend_account', targetType: 'user', targetId: user._id, metadata: {} });
  return res.json({ user: adminUserView(user) });
});

router.post('/users/:id/force-logout', requireOwner, adminWriteLimit, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const revoked = revokeUserSessions(user._id);
  updateUser(user._id, { authVersion: Number(user.authVersion || 0) + 1 });
  createAuditLog({ adminId: req.user._id, action: 'force_logout', targetType: 'user', targetId: user._id, metadata: { sessionsRevoked: revoked } });
  return res.json({ user: adminUserView(user), sessionsRevoked: revoked });
});

router.patch('/tickets/:id', requireOwner, adminWriteLimit, (req, res) => {
  const ticket = store.feedback.find((item) => item._id === req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
  const allowedStatuses = ['Open', 'Reviewing', 'In Progress', 'Resolved', 'Closed'];
  const updates = {};
  if (req.body?.status && allowedStatuses.includes(req.body.status)) updates.status = req.body.status;
  if (req.body?.priority && ['Low', 'Normal', 'High', 'Urgent'].includes(req.body.priority)) updates.priority = req.body.priority;
  if (req.body?.adminNotes !== undefined) updates.adminNotes = String(req.body.adminNotes).slice(0, 2000);
  if (req.body?.response !== undefined) updates.response = String(req.body.response).slice(0, 2000);
  Object.assign(ticket, updates, { updatedAt: new Date().toISOString(), assignedAdminId: req.user._id });
  require('../db/store').persist();
  createAuditLog({ adminId: req.user._id, action: 'update_ticket', targetType: 'ticket', targetId: ticket._id, metadata: { status: ticket.status || 'Open', type: ticket.type || 'feedback' } });
  return res.json({ ticket: ticketView(ticket, ticket.type || 'feedback') });
});

router.patch('/reports/:id', requireOwner, adminWriteLimit, (req, res) => {
  const current = store.reports.find((item) => item._id === req.params.id);
  if (!current) return res.status(404).json({ message: 'Report not found' });
  const allowedStatuses = ['Open', 'Reviewing', 'Resolved', 'Dismissed'];
  const updates = {};
  if (req.body?.status && allowedStatuses.includes(req.body.status)) updates.status = req.body.status;
  if (req.body?.adminNotes !== undefined) updates.adminNotes = String(req.body.adminNotes).slice(0, 2000);
  if (req.body?.resolution !== undefined) updates.resolution = String(req.body.resolution).slice(0, 2000);
  const report = updateReport(current._id, { ...updates, assignedAdminId: req.user._id });
  createAuditLog({ adminId: req.user._id, action: 'moderate_report', targetType: 'report', targetId: report._id, metadata: { status: report.status } });
  return res.json({ report: ticketView(report, 'report') });
});

router.post('/announcements', requireOwner, adminWriteLimit, async (req, res) => {
  const title = String(req.body?.title || '').trim().slice(0, 160);
  const body = String(req.body?.body || '').trim().slice(0, 2000);
  const scope = String(req.body?.scope || 'test');
  const pushEnabled = Boolean(req.body?.pushEnabled);
  if (!title || !body || !['test', 'selected', 'all'].includes(scope)) return res.status(400).json({ message: 'Title, body, and a valid recipient scope are required' });
  if ((scope === 'all' || pushEnabled) && req.body?.confirmed !== true) return res.status(400).json({ message: 'Explicit confirmation is required for this announcement' });
  const recipients = recipientsFor(scope, req.body?.userIds);
  if (!recipients.length) return res.status(400).json({ message: 'No eligible recipients found' });
  const announcement = createAnnouncement({ title, body, scope, pushEnabled, createdBy: req.user._id });
  const io = req.app.get('io');
  let notificationsCreated = 0; let pushesSent = 0;
  for (const user of recipients) {
    const exists = store.notifications.some((item) => item.userId === user._id && item.type === 'admin_announcement' && item.data?.announcementId === announcement._id);
    if (!exists) {
      const notification = createNotification({ userId: user._id, type: 'admin_announcement', title, body, data: { announcementId: announcement._id, route: '/' } });
      emitNotification(io, notification); notificationsCreated += 1;
    }
    if (pushEnabled) {
      const language = getPushLanguage(user._id);
      const result = await sendPushToUser(user._id, { type: 'admin_announcement', title: language === 'vi' ? title : title, body, icon: '/icons/icon-192x192.png', badge: '/icons/icon-72x72.png', tag: `announcement-${announcement._id}`, url: '/', data: { announcementId: announcement._id, url: '/' } });
      pushesSent += result?.sent || 0;
    }
  }
  createAuditLog({ adminId: req.user._id, action: scope === 'all' ? 'mass_announcement' : 'announcement_created', targetType: 'announcement', targetId: announcement._id, metadata: { scope, recipientCount: recipients.length, notificationsCreated, pushesSent } });
  if (pushEnabled) createAuditLog({ adminId: req.user._id, action: 'important_push', targetType: 'announcement', targetId: announcement._id, metadata: { recipientCount: recipients.length, pushesSent } });
  return res.status(201).json({ announcement, recipientCount: recipients.length, notificationsCreated, pushesSent });
});

module.exports = router;
