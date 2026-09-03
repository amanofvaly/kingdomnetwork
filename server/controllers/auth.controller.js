import crypto from 'node:crypto';

import { asyncHandler } from '../middleware/asyncHandler.js';
import { hashPassword, signToken, verifyPassword } from '../lib/auth.js';
import { link, mailer } from '../lib/mailer/index.js';
import { token as randomToken } from '../lib/ids.js';
import { Church } from '../models/Church.js';
import { ChurchMembership, CHURCH_ROLE_GRANTS } from '../models/ChurchMembership.js';
import { User } from '../models/User.js';

const AVATARS = [
  'p-woman-bun', 'p-man-blue-shirt', 'p-woman-striped', 'p-man-teal-shirt',
  'p-woman-foliage', 'p-young-man-park', 'p-woman-office', 'p-man-glasses-tee',
];

const avatarUrl = () => `/media/people/${AVATARS[Math.floor(Math.random() * AVATARS.length)]}@200.webp`;

/** Reset tokens are stored hashed, so a database read cannot be used to reset. */
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/**
 * The account, plus the churches it may act for. The client uses `memberships`
 * to decide whether to show the church console at all — authority lives in
 * ChurchMembership, never on the account itself.
 */
const sessionFor = async (user) => {
  const memberships = await ChurchMembership.find({ userId: user._id, status: 'active' }).lean();
  const churches = memberships.length
    ? await Church.find({ slug: { $in: memberships.map((m) => m.churchSlug) } }, 'slug name shortName monogram verified status').lean()
    : [];
  const bySlug = Object.fromEntries(churches.map((c) => [c.slug, c]));

  return {
    token: signToken(user),
    user: user.toPublic(),
    memberships: memberships.map((m) => ({
      churchSlug: m.churchSlug,
      role: m.role,
      permissions: CHURCH_ROLE_GRANTS[m.role] ?? [],
      church: bySlug[m.churchSlug] ?? null,
    })),
  };
};

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, country, ministryRole } = req.body ?? {};

  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Enter your name.' });
  if (!/^\S+@\S+\.\S+$/.test(email ?? '')) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Use a password of at least 8 characters.' });
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) return res.status(409).json({ success: false, message: 'An account already uses that email.' });

  // Signing up never grants authority over a church. That comes from completing
  // onboarding, which creates the church and the owning membership together, or
  // from being invited by someone who already administers one.
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash: await hashPassword(password),
    country: country?.trim() || undefined,
    ministryRole: ministryRole?.trim() || undefined,
    role: 'member',
    avatar: avatarUrl(),
  });

  res.status(201).json({ success: true, data: await sessionFor(user) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Enter your email and password.' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

  if (user?.status === 'suspended') {
    return res.status(403).json({ success: false, message: 'This account has been suspended. Contact support.' });
  }
  if (user && !user.passwordHash) {
    return res.status(409).json({
      success: false,
      message: 'That email has no password set. Use the reset link to set one.',
    });
  }
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ success: false, message: 'That email and password do not match.' });
  }

  user.lastLoginAt = new Date();
  await user.save();

  res.json({ success: true, data: await sessionFor(user) });
});

/**
 * An account created behind a purchase of materials, from the same details form
 * the buyer is already filling in. Only ever reached from the basket checkout —
 * applying for a credential requires a real account first.
 */
export const guest = asyncHandler(async (req, res) => {
  const { name, email, password, country } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Enter your full name.' });
  if (!/^\S+@\S+\.\S+$/.test(email ?? '')) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Use a password of at least 8 characters.' });
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  if (existing) {
    if (existing.passwordHash) {
      return res.status(409).json({ success: false, message: 'An account already uses that email. Sign in to continue.' });
    }
    existing.passwordHash = await hashPassword(password);
    if (country?.trim()) existing.country = country.trim();
    await existing.save();
    return res.json({ success: true, data: await sessionFor(existing) });
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash: await hashPassword(password),
    country: country?.trim() || undefined,
    role: 'member',
    avatar: avatarUrl(),
  });

  res.status(201).json({ success: true, data: await sessionFor(user) });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await sessionFor(req.user) });
});

export const updateMe = asyncHandler(async (req, res) => {
  const allowed = ['name', 'country', 'city', 'phone', 'timezone', 'ministryRole', 'bio'];
  for (const key of allowed) {
    if (typeof req.body?.[key] === 'string') req.user[key] = req.body[key].trim();
  }

  if (req.body?.ministry && typeof req.body.ministry === 'object') {
    req.user.ministry = { ...req.user.ministry?.toObject?.(), ...req.body.ministry };
  }
  if (req.body?.notificationPrefs && typeof req.body.notificationPrefs === 'object') {
    req.user.notificationPrefs = { ...req.user.notificationPrefs?.toObject?.(), ...req.body.notificationPrefs };
  }

  if (typeof req.body?.password === 'string') {
    if (req.body.password.length < 8) {
      return res.status(400).json({ success: false, message: 'Use a password of at least 8 characters.' });
    }
    // Changing a password you already have requires proving you know it.
    if (req.user.passwordHash) {
      const ok = typeof req.body.currentPassword === 'string'
        && (await verifyPassword(req.body.currentPassword, req.user.passwordHash));
      if (!ok) return res.status(403).json({ success: false, message: 'That is not your current password.' });
    }
    req.user.passwordHash = await hashPassword(req.body.password);
  }

  await req.user.save();
  res.json({ success: true, data: req.user.toPublic() });
});

/**
 * Always answers the same way, whether or not the address is known. Telling a
 * stranger which addresses have accounts is a disclosure in itself.
 */
export const requestPasswordReset = asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  const reply = { success: true, data: { sent: true } };

  if (!/^\S+@\S+\.\S+$/.test(email)) return res.json(reply);

  const user = await User.findOne({ email });
  if (!user) return res.json(reply);

  const raw = randomToken();
  user.passwordResetToken = hashToken(raw);
  user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  await mailer.send({
    to: user.email,
    subject: 'Reset your Kingdom Network password',
    text: [
      `Someone asked to reset the password for ${user.email}.`,
      '',
      `Open this link within the hour to choose a new one:`,
      link(`/reset-password?token=${raw}`),
      '',
      'If it was not you, ignore this message. Nothing has changed.',
    ].join('\n'),
  });

  res.json(reply);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body ?? {};
  if (!token) return res.status(400).json({ success: false, message: 'That reset link is not valid.' });
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Use a password of at least 8 characters.' });
  }

  const user = await User.findOne({
    passwordResetToken: hashToken(String(token)),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordHash +passwordResetToken +passwordResetExpiresAt');

  if (!user) {
    return res.status(400).json({ success: false, message: 'That reset link has expired. Ask for another.' });
  }

  user.passwordHash = await hashPassword(password);
  user.passwordResetToken = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  res.json({ success: true, data: await sessionFor(user) });
});
