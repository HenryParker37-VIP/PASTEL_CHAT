const authMiddleware = require('./auth');
const { createAuditLog } = require('../db/store');

function isAdminRequest(req) {
  return req.user?.isAdmin === true && ['OWNER', 'DEMO'].includes(req.adminRole);
}

function requireAdminRole(req, res, next) {
  if (!isAdminRequest(req)) return res.status(403).json({ message: 'Admin permission required' });
  return next();
}

function requireOwnerRole(req, res, next) {
  if (!isAdminRequest(req)) return res.status(403).json({ message: 'Admin permission required' });
  if (req.adminRole !== 'OWNER') {
    createAuditLog({
      adminId: req.user._id,
      action: 'demo_privileged_denied',
      targetType: 'route',
      targetId: req.path,
      metadata: { method: req.method, role: req.adminRole }
    });
    return res.status(403).json({ message: 'Owner access required' });
  }
  return next();
}

const requireAdmin = [authMiddleware, requireAdminRole];
const requireOwner = [authMiddleware, requireOwnerRole];

module.exports = requireAdmin;
module.exports.requireOwner = requireOwner;
