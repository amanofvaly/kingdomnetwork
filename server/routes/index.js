import { Router } from 'express';
import mongoose from 'mongoose';

import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

import * as auth from '../controllers/auth.controller.js';
import * as catalog from '../controllers/catalog.controller.js';
import * as checkout from '../controllers/checkout.controller.js';
import * as learning from '../controllers/learning.controller.js';

const router = Router();

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      data: {
        uptime: Math.round(process.uptime()),
        mongo: STATES[mongoose.connection.readyState] ?? 'unknown',
        database: mongoose.connection.name,
      },
    });
  }),
);

// --- catalogue (public) ----------------------------------------------------
router.get('/home', catalog.home);
router.get('/categories', catalog.listCategories);
router.get('/search', catalog.search);
router.get('/courses', catalog.listCourses);
router.get('/courses/:slug', catalog.courseDetail);
router.get('/pathways', catalog.listPathways);
router.get('/pathways/:slug', catalog.pathwayDetail);
router.get('/churches', catalog.listChurches);
router.get('/churches/:slug', catalog.churchDetail);
router.get('/verify/:code', learning.verifyCredential);

// --- accounts --------------------------------------------------------------
router.post('/auth/signup', auth.signup);
router.post('/auth/login', auth.login);
router.get('/auth/me', requireAuth, auth.me);
router.patch('/auth/me', requireAuth, auth.updateMe);

// --- checkout --------------------------------------------------------------
router.get('/payment-methods', checkout.listPaymentMethods);
router.post('/cart/price', checkout.priceCart);
router.post('/orders', requireAuth, checkout.createOrder);
router.get('/orders', requireAuth, checkout.listOrders);
router.get('/orders/:reference', requireAuth, checkout.orderDetail);

// --- learning --------------------------------------------------------------
router.get('/me/dashboard', requireAuth, learning.dashboard);
router.get('/me/entitlements', requireAuth, learning.entitlements);
router.get('/me/passport', requireAuth, learning.passport);
router.get('/learn/:slug', requireAuth, learning.player);
router.post('/learn/:slug/progress', requireAuth, learning.setProgress);

export default router;
