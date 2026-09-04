import { Router } from 'express';

import { requireAuth, requirePlatformAdmin } from '../middleware/auth.js';
import * as admin from '../controllers/admin.controller.js';

const router = Router();

router.use('/admin', requireAuth, requirePlatformAdmin);

router.get('/admin/overview', admin.overview);

router.get('/admin/churches', admin.listChurches);
router.post('/admin/churches/:slug/status', admin.setChurchStatus);
router.get('/admin/verification', admin.verificationQueue);
router.post('/admin/verification/:slug', admin.decideVerification);

router.get('/admin/users', admin.listUsers);
router.patch('/admin/users/:id', admin.updateUser);

router.get('/admin/applications', admin.listApplications);

router.get('/admin/payments', admin.listPayments);
router.get('/admin/owed', admin.owed);
router.get('/admin/settlements', admin.listSettlements);
router.post('/admin/settlements', admin.prepareSettlement);
router.post('/admin/settlements/:reference/paid', admin.markSettlementPaid);
router.post('/admin/settlements/:reference/cancel', admin.cancelSettlement);
router.get('/admin/churches/:slug/ledger', admin.churchLedger);

router.get('/admin/settings', admin.getSettings);
router.patch('/admin/settings', admin.updateSettings);
router.post('/admin/offerings/:slug/merchandising', admin.setMerchandising);

router.get('/admin/audit', admin.listAudit);

export default router;
