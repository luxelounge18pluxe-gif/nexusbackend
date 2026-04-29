const jwt = require('jsonwebtoken');
const { findUserById, sanitizeUser } = require('../model/user');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findUserById(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'Invalid authorization token' });
    }
    req.user = sanitizeUser(user);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authorization token' });
  }
};
