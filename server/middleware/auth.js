import { readToken, tokenFromRequest } from '../lib/auth.js';
import { Church } from '../models/Church.js';
import { ChurchMembership, CHURCH_ROLE_GRANTS } from '../models/ChurchMembership.js';
import { User } from '../models/User.js';

const load = async (req) => {
  const token = tokenFromRequest(req);
  const payload = token ? readToken(token) : null;
  if (!payload) return null;

  const user = await User.findById(payload.sub).select('+passwordHash');
  if (!user || user.status === 'suspended') return null;
  return user;
};

/** Attaches req.user when a valid token is present. Never rejects. */
export const optionalAuth = async (req, _res, next) => {
  try {
    req.user = (await load(req)) ?? undefined;
  } catch {
    req.user = undefined;
  }
  next();
};

/** Rejects with 401 unless a valid token resolves to a live user. */
export const requireAuth = async (req, res, next) => {
  const user = await load(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Sign in to continue.' });
  }
  req.user = user;
  next();
};

export const requirePlatformAdmin = (req, res, next) => {
  if (req.user?.role !== 'platform_admin') {
    return res.status(403).json({ success: false, message: 'This area is for platform administrators.' });
  }
  next();
};

/**
 * Resolves `:churchSlug` into `req.church` and the caller's `req.membership`,
 * then checks the permission.
 *
 * A platform administrator passes without a membership — they administer every
 * church by definition — but `req.membership` stays null so anything that
 * records who acted can tell the difference between an owner and an
 * administrator acting on a church's behalf.
 */
export const requireChurchRole = (permission) => async (req, res, next) => {
  const slug = req.params.churchSlug ?? req.params.slug;
  if (!slug) {
    return res.status(400).json({ success: false, message: 'No church was named in that request.' });
  }

  const church = await Church.findOne({ slug });
  if (!church) {
    return res.status(404).json({ success: false, message: 'That church was not found.' });
  }
  req.church = church;

  if (req.user?.role === 'platform_admin') {
    req.membership = null;
    req.actingAsPlatformAdmin = true;
    return next();
  }

  const membership = await ChurchMembership.findOne({
    churchSlug: slug,
    userId: req.user?._id,
    status: 'active',
  });

  if (!membership) {
    return res.status(403).json({ success: false, message: 'You do not administer this church.' });
  }

  if (permission && !membership.can(permission)) {
    const roles = Object.entries(CHURCH_ROLE_GRANTS)
      .filter(([, grants]) => grants.includes('*') || grants.includes(permission))
      .map(([role]) => role);
    return res.status(403).json({
      success: false,
      message: `Your role cannot do this. It needs one of: ${roles.join(', ')}.`,
    });
  }

  req.membership = membership;
  next();
};
