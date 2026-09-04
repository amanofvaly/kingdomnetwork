import { Router } from 'express';

import { optionalAuth } from '../middleware/auth.js';
import * as feed from '../controllers/feed.controller.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as market from '../controllers/market.controller.js';
import * as learning from '../controllers/learning.controller.js';
import * as passport from '../controllers/passport.controller.js';
import * as donation from '../controllers/donation.controller.js';
import * as application from '../controllers/application.controller.js';

const router = Router();

// ── public browsing ──
router.get('/home', market.home);
router.get('/outcomes', market.listOutcomes);
router.get('/outcomes/:slug', market.outcomeDetail);
router.get('/search', market.search);
router.get('/suggest', market.suggest);
router.get('/offerings/:slug', optionalAuth, market.offeringDetail);
router.get('/offerings/:slug/preview.pdf', passport.previewDocument);
router.get('/churches', market.listChurches);
router.get('/churches/:slug', market.churchDetail);
router.get('/churches/:slug/posts', optionalAuth, feed.churchPosts);
router.get('/courses', learning.listCourses);
router.get('/courses/:slug', learning.courseDetail);
router.get('/resources', market.listResources);
router.get('/resources/:slug', market.resourceDetail);

// ── giving ──
router.get('/give/:slug', donation.givingPage);
router.get('/give-thanks', donation.thanks);
router.post('/give/:slug', optionalAuth, rateLimit({ windowMs: 60_000, max: 10 }), donation.give);

// ── verification: deliberately public, and rate limited so the code space
//    cannot be walked by a script ──
router.get(
  '/verify/:code',
  rateLimit({ windowMs: 60_000, max: 20, message: 'Too many verification attempts. Wait a minute and try again.' }),
  passport.verify,
);

// ── a referee answers without an account, holding only an emailed link ──
router.get('/reference/:token', application.referenceForm);
router.post('/reference/:token', rateLimit({ windowMs: 60_000, max: 5 }), application.submitReference);

export default router;
