import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as auth from '../controllers/auth.controller.js';
import * as church from '../controllers/church.controller.js';
import * as notifications from '../controllers/notification.controller.js';

const router = Router();

// Sign-in attempts are limited per address as well as per caller, so a
// distributed attempt on one account is slowed too.
const byEmail = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  key: (req) => `login:${String(req.body?.email ?? '').toLowerCase()}:${req.ip}`,
  message: 'Too many sign-in attempts. Wait fifteen minutes and try again.',
});

router.post('/auth/signup', rateLimit({ windowMs: 60 * 60_000, max: 10 }), auth.signup);
router.post('/auth/login', byEmail, auth.login);
router.post('/auth/guest', rateLimit({ windowMs: 60 * 60_000, max: 10 }), auth.guest);
router.post('/auth/forgot-password', rateLimit({ windowMs: 60 * 60_000, max: 5 }), auth.requestPasswordReset);
router.post('/auth/reset-password', rateLimit({ windowMs: 60 * 60_000, max: 10 }), auth.resetPassword);

router.get('/auth/me', requireAuth, auth.me);
router.patch('/auth/me', requireAuth, auth.updateMe);

router.get('/me/notifications', requireAuth, notifications.list);
router.post('/me/notifications/read', requireAuth, notifications.markRead);

// Accepting an invitation to help administer a church.
router.post('/invites/:token/accept', requireAuth, church.acceptInvite);

export default router;
