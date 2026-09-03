import { Router } from 'express';
import express from 'express';

import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as payment from '../controllers/payment.controller.js';

const router = Router();

// Pesapal calls these; neither carries a session, and neither carries the
// payment status either — both handlers fetch it from the gateway.
router.get('/payments/ipn', payment.ipn);
router.post('/payments/ipn', payment.ipn);
router.get('/payments/callback', payment.callback);
router.get('/payments/cancelled', payment.cancelled);

router.post('/payments/:reference/refresh', requireAuth, rateLimit({ windowMs: 60_000, max: 20 }), payment.refreshPayment);

// The development gateway, which stands in when no credentials are configured.
router.get('/payments/mock/:orderTrackingId', payment.mockPayPage);
router.post('/payments/mock/:orderTrackingId', express.urlencoded({ extended: false }), payment.mockPay);

export default router;
