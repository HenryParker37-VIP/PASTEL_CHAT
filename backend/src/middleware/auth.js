const { authenticateToken } = require('../services/sessionAuth');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = String(req.headers.authorization || '');
    const match = authHeader.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) return res.status(401).json({ message: 'Authentication required' });
    const result = authenticateToken(match[1]);
    if (!result) return res.status(401).json({ message: 'Invalid or expired session' });
    req.user = result.user;
    req.session = result.session;
    req.auth = result.decoded;
    return next();
  } catch (error) {
    if (error.message === 'JWT_SECRET is not configured') return res.status(503).json({ message: 'Authentication is unavailable' });
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
};

module.exports = authMiddleware;
