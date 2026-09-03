import { Router } from 'express';

import { requireAuth, requirePersonal } from '../middleware/auth.js';
import * as application from '../controllers/application.controller.js';
import * as assessment from '../controllers/assessment.controller.js';
import * as interview from '../controllers/interview.controller.js';
import * as learning from '../controllers/learning.controller.js';
import * as passport from '../controllers/passport.controller.js';
import * as payment from '../controllers/payment.controller.js';

const router = Router();

// Scoped to the paths this file owns, not applied blanket: a router mounted
// without a prefix runs its middleware for every request that reaches it, which
// would put a sign-in wall in front of the Pesapal IPN further down the chain.
router.use('/applications', requireAuth, requirePersonal);
router.use('/interviews', requireAuth, requirePersonal);
router.use('/me', requireAuth, requirePersonal);
router.use('/learn', requireAuth, requirePersonal);

// ── applying ──
router.get('/applications', application.list);
router.post('/applications', application.start);
router.get('/applications/:reference', application.detail);
router.patch('/applications/:reference', application.update);
router.post('/applications/:reference/documents/:key', application.uploadDocument);
router.post('/applications/:reference/submit', application.submit);
router.post('/applications/:reference/pay', payment.payApplicationFee);
router.post('/applications/:reference/withdraw', application.withdraw);

// ── sitting the paper ──
router.get('/applications/:reference/assessment', assessment.getPaper);
router.post('/applications/:reference/assessment', assessment.submitPaper);

// ── the interview ──
router.get('/applications/:reference/slots', interview.availableSlots);
router.post('/applications/:reference/interview', interview.book);
router.get('/interviews/:id/calendar.ics', interview.calendar);

// ── the passport and its documents ──
router.get('/me/dashboard', learning.dashboard);
router.get('/me/entitlements', learning.entitlements);
router.get('/me/passport', passport.passport);
router.get('/me/credentials/:id/document.pdf', passport.downloadDocument);

// ── coursework ──
router.get('/learn/:slug', learning.player);
router.post('/learn/:slug/progress', learning.setProgress);

export default router;
