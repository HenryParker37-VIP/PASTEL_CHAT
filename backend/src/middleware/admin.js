const authMiddleware = require('./auth');

const requireAdmin = [authMiddleware, (req, res, next) => {
  if (req.user?.isAdmin !== true) return res.status(403).json({ message: 'Admin permission required' });
  return next();
}];

module.exports = requireAdmin;
