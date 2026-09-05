import { Router } from 'express';
import mongoose from 'mongoose';

import { asyncHandler } from '../middleware/asyncHandler.js';
import { optionalAuth } from '../middleware/auth.js';
import { imageHandler } from '../lib/og/http.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as media from '../controllers/media.controller.js';

import publicRoutes from './public.js';
import accountRoutes from './account.js';
import applyRoutes from './apply.js';
import commerceRoutes from './commerce.js';
import paymentRoutes from './payments.js';
import manageRoutes from './manage.js';
import adminRoutes from './admin.js';

const router = Router();
const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: {
      uptime: Math.round(process.uptime()),
      mongo: STATES[mongoose.connection.readyState] ?? 'unknown',
      database: mongoose.connection.name,
    },
  });
}));

/**
 * Every stored file is read through here, so the public/private distinction is
 * enforced in one place rather than being a property of where a file was
 * written. Auth is optional: a church's cover photograph needs none, and an
 * applicant's passport scan is checked inside the handler.
 */
router.get(/^\/media\/file\/(.+)$/, optionalAuth, media.serve);

const og = Router();
og.use(rateLimit({ max: 90, key: (req) => `og:${req.ip}` }));
og.get('/default.png', imageHandler());
og.get('/:type/:slug.png', imageHandler());
router.use('/og', og);

router.use(publicRoutes);
router.use(accountRoutes);
router.use(applyRoutes);
router.use(commerceRoutes);
router.use(paymentRoutes);
router.use(manageRoutes);
router.use(adminRoutes);

export default router;
