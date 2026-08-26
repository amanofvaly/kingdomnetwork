import { readToken, tokenFromRequest } from '../lib/auth.js';
import { User } from '../models/User.js';

/** Attaches req.user when a valid token is present. Never rejects. */
export const optionalAuth = async (req, _res, next) => {
  const token = tokenFromRequest(req);
  if (!token) return next();
  const payload = readToken(token);
  if (!payload) return next();
  req.user = await User.findById(payload.sub).select('+passwordHash');
  next();
};

/** Rejects with 401 unless a valid token resolves to a live user. */
export const requireAuth = async (req, res, next) => {
  const token = tokenFromRequest(req);
  const payload = token ? readToken(token) : null;
  if (!payload) return res.status(401).json({ success: false, message: 'Sign in to continue.' });

  const user = await User.findById(payload.sub).select('+passwordHash');
  if (!user) return res.status(401).json({ success: false, message: 'That session is no longer valid.' });

  req.user = user;
  next();
};

/** Requires the caller to administer a church. */
export const requireChurch = (req, res, next) => {
  if (req.user?.role !== 'church' && req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'This area is for church administrators.' });
  }
  next();
};
