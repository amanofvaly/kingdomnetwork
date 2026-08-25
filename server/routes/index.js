import { Router } from 'express';
import mongoose from 'mongoose';

import { asyncHandler } from '../middleware/asyncHandler.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

import * as auth from '../controllers/auth.controller.js';
import * as market from '../controllers/market.controller.js';
import * as checkout from '../controllers/checkout.controller.js';
import * as learning from '../controllers/learning.controller.js';
import * as passport from '../controllers/passport.controller.js';

const router = Router();
const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: { uptime: Math.round(process.uptime()), mongo: STATES[mongoose.connection.readyState] ?? 'unknown', database: mongoose.connection.name },
  });
}));

// ── marketplace (public; auth is optional so buy buttons know what you own) ──
router.get('/home', market.home);
router.get('/outcomes', market.listOutcomes);
router.get('/outcomes/:slug', market.outcomeDetail);
router.get('/search', market.search);
router.get('/suggest', market.suggest);
router.get('/offerings/:slug', optionalAuth, market.offeringDetail);
router.get('/offerings/:slug/preview.pdf', passport.previewDocument);
router.get('/churches', market.listChurches);
router.get('/churches/:slug', market.churchDetail);
router.get('/courses', learning.listCourses);
router.get('/courses/:slug', learning.courseDetail);
router.get('/verify/:code', passport.verify);

// ── accounts ──
router.post('/auth/signup', auth.signup);
router.post('/auth/login', auth.login);
router.post('/auth/guest', auth.guest);
router.get('/auth/me', requireAuth, auth.me);
router.patch('/auth/me', requireAuth, auth.updateMe);

// ── checkout ──
router.get('/payment-methods', checkout.listPaymentMethods);
router.post('/cart/price', checkout.priceCart);
router.post('/cart/cross-sell', checkout.crossSell);
router.post('/orders', requireAuth, checkout.createOrder);
router.get('/orders', requireAuth, checkout.listOrders);
router.get('/orders/:reference', requireAuth, checkout.orderDetail);

// ── the passport and its documents ──
router.get('/me/dashboard', requireAuth, learning.dashboard);
router.get('/me/entitlements', requireAuth, learning.entitlements);
router.get('/me/passport', requireAuth, passport.passport);
router.get('/me/credentials/:id/document.pdf', requireAuth, passport.downloadDocument);
router.get('/me/credentials/:id/assessment', requireAuth, passport.getAssessment);
router.post('/me/credentials/:id/assessment', requireAuth, passport.submitAssessment);

// ── coursework ──
router.get('/learn/:slug', requireAuth, learning.player);
router.post('/learn/:slug/progress', requireAuth, learning.setProgress);

export default router;
