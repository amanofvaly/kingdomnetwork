import { Router } from 'express';

import { requireAuth, requirePersonal } from '../middleware/auth.js';
import * as commerce from '../controllers/commerce.controller.js';

const router = Router();

// The basket carries materials only — coursework, books, study guides.
// Applying to a church for standing goes through /api/applications.
router.post('/cart/price', commerce.priceCart);
router.post('/cart/cross-sell', commerce.crossSell);

router.post('/orders', requireAuth, requirePersonal, commerce.createOrder);
router.get('/orders', requireAuth, requirePersonal, commerce.listOrders);
router.get('/orders/:reference', requireAuth, requirePersonal, commerce.orderDetail);

export default router;
