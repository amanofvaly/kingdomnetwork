import { asyncHandler } from '../middleware/asyncHandler.js';
import { hashPassword, signToken, verifyPassword } from '../lib/auth.js';
import { User } from '../models/User.js';

const AVATARS = [
  'p-woman-bun', 'p-man-blue-shirt', 'p-woman-striped', 'p-man-teal-shirt',
  'p-woman-foliage', 'p-young-man-park', 'p-woman-office', 'p-man-glasses-tee',
];

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, country, ministryRole, role, churchSlug } = req.body ?? {};

  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Enter your name.' });
  if (!email?.trim()) return res.status(400).json({ success: false, message: 'Enter your email address.' });
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Use a password of at least 8 characters.' });
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) return res.status(409).json({ success: false, message: 'An account already uses that email.' });

  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash: await hashPassword(password),
    country: country?.trim() || undefined,
    ministryRole: ministryRole?.trim() || undefined,
    role: role === 'church' ? 'church' : 'learner',
    churchSlug: role === 'church' ? churchSlug ?? null : null,
    avatar: `/media/people/${avatar}@200.webp`,
  });

  res.status(201).json({ success: true, data: { token: signToken(user), user: user.toPublic() } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Enter your email and password.' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ success: false, message: 'That email and password do not match.' });
  }

  res.json({ success: true, data: { token: signToken(user), user: user.toPublic() } });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user.toPublic() });
});

export const updateMe = asyncHandler(async (req, res) => {
  const allowed = ['name', 'country', 'city', 'phone', 'ministryRole', 'bio'];
  for (const key of allowed) {
    if (typeof req.body?.[key] === 'string') req.user[key] = req.body[key].trim();
  }
  await req.user.save();
  res.json({ success: true, data: req.user.toPublic() });
});
