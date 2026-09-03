import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import * as commerce from '../controllers/commerce.controller.js';

const router = Router();

// The basket carries materials only — coursework, books, study guides.
// Applying to a church for standing goes through /api/applications.
router.post('/cart/price', commerce.priceCart);
router.post('/cart/cross-sell', commerce.crossSell);

router.post('/orders', requireAuth, commerce.createOrder);
router.get('/orders', requireAuth, commerce.listOrders);
router.get('/orders/:reference', requireAuth, commerce.orderDetail);

export default router;
