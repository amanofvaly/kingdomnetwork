import { Router } from 'express';

import { requireAuth, requireChurchRole } from '../middleware/auth.js';
import * as church from '../controllers/church.controller.js';
import * as media from '../controllers/media.controller.js';
import * as authoring from '../controllers/authoring.controller.js';
import * as applicants from '../controllers/applicants.controller.js';
import * as finance from '../controllers/finance.controller.js';
import * as feed from '../controllers/feed.controller.js';

/**
 * The church console. Everything under here is scoped to one church by
 * `:churchSlug`, and every route names the permission it needs — see
 * CHURCH_ROLE_GRANTS in `server/models/ChurchMembership.js`.
 */
const router = Router();

// Path-scoped, for the reason given in `apply.js`.
router.use('/manage', requireAuth);

// Starting onboarding has no church to be scoped to yet.
router.post('/manage/start', church.beginOnboarding);

const scoped = Router({ mergeParams: true });
router.use('/manage/:churchSlug', scoped);

// ── onboarding ──
scoped.get('/onboarding', requireChurchRole('church:edit'), church.onboardingState);
scoped.patch('/onboarding/:step', requireChurchRole('church:edit'), church.saveOnboardingStep);
scoped.post('/publish', requireChurchRole('church:publish'), church.publishChurch);

// ── the console ──
scoped.get('/overview', requireChurchRole('applications:read'), church.overview);
scoped.get('/profile', requireChurchRole('church:edit'), church.profile);
scoped.patch('/profile', requireChurchRole('church:edit'), church.updateProfile);
scoped.get('/page', requireChurchRole('page:edit'), church.getPage);
scoped.put('/page', requireChurchRole('page:edit'), church.updatePage);
scoped.patch('/donations', requireChurchRole('church:edit'), church.updateDonations);
scoped.post('/verification', requireChurchRole('church:edit'), church.submitVerification);

// ── what the church says to the people who follow it ──
scoped.get('/posts', requireChurchRole('church:edit'), feed.listChurchPosts);
scoped.post('/posts', requireChurchRole('church:edit'), feed.createChurchPost);
scoped.patch('/posts/:id', requireChurchRole('church:edit'), feed.updateChurchPost);
scoped.delete('/posts/:id', requireChurchRole('church:edit'), feed.removeChurchPost);

// ── the team ──
scoped.get('/team', requireChurchRole('people:write'), church.listTeam);
scoped.post('/team', requireChurchRole('people:write'), church.invite);
scoped.patch('/team/:id', requireChurchRole('people:write'), church.updateMember);
scoped.delete('/team/:id', requireChurchRole('people:write'), church.removeMember);

// ── media ──
scoped.get('/media', requireChurchRole('media:write'), media.list);
scoped.post('/media', requireChurchRole('media:write'), media.upload);
scoped.patch('/media/:id', requireChurchRole('media:write'), media.update);
scoped.delete('/media/:id', requireChurchRole('media:write'), media.remove);

// ── what the church issues ──
scoped.get('/offerings', requireChurchRole('authoring:write'), authoring.listOfferings);
scoped.post('/offerings', requireChurchRole('authoring:write'), authoring.createOffering);
scoped.post('/offerings/preview', requireChurchRole('authoring:write'), authoring.previewRequirements);
scoped.get('/offerings/:slug', requireChurchRole('authoring:write'), authoring.getOffering);
scoped.patch('/offerings/:slug', requireChurchRole('authoring:write'), authoring.updateOffering);
scoped.post('/offerings/:slug/status', requireChurchRole('church:publish'), authoring.publishOffering);

// ── coursework ──
scoped.get('/courses', requireChurchRole('authoring:write'), authoring.listCourses);
scoped.post('/courses', requireChurchRole('authoring:write'), authoring.createCourse);
scoped.get('/courses/:slug', requireChurchRole('authoring:write'), authoring.getCourse);
scoped.patch('/courses/:slug', requireChurchRole('authoring:write'), authoring.updateCourse);
scoped.post('/courses/:slug/status', requireChurchRole('authoring:write'), authoring.publishCourse);

// ── papers ──
scoped.get('/assessments', requireChurchRole('authoring:write'), authoring.listAssessments);
scoped.post('/assessments', requireChurchRole('authoring:write'), authoring.createAssessment);
scoped.get('/assessments/:slug', requireChurchRole('authoring:write'), authoring.getAssessment);
scoped.patch('/assessments/:slug', requireChurchRole('authoring:write'), authoring.updateAssessment);
scoped.post('/assessments/:slug/status', requireChurchRole('authoring:write'), authoring.publishAssessment);

// ── books and materials ──
scoped.get('/resources', requireChurchRole('authoring:write'), authoring.listResources);
scoped.post('/resources', requireChurchRole('authoring:write'), authoring.createResource);
scoped.patch('/resources/:slug', requireChurchRole('authoring:write'), authoring.updateResource);

// ── interview availability ──
scoped.get('/slots', requireChurchRole('interviews:write'), authoring.listSlots);
scoped.post('/slots', requireChurchRole('interviews:write'), authoring.createSlots);
scoped.patch('/slots/:id', requireChurchRole('interviews:write'), authoring.updateSlot);
scoped.delete('/slots/:id', requireChurchRole('interviews:write'), authoring.deleteSlot);

// ── applicants ──
scoped.get('/applicants', requireChurchRole('applications:read'), applicants.list);
scoped.get('/applicants/:reference', requireChurchRole('applications:read'), applicants.detail);
scoped.post('/applicants/:reference/documents/:key', requireChurchRole('applications:decide'), applicants.reviewDocument);
scoped.post('/applicants/:reference/info', requireChurchRole('applications:decide'), applicants.requestInfo);
scoped.post('/applicants/:reference/steps/:key/waive', requireChurchRole('applications:decide'), applicants.waiveStep);
scoped.post('/applicants/:reference/attempts/:attemptId/grade', requireChurchRole('applications:decide'), applicants.gradeAttempt);
scoped.post('/applicants/:reference/interview', requireChurchRole('interviews:write'), applicants.recordInterviewOutcome);
scoped.post('/applicants/:reference/note', requireChurchRole('applications:read'), applicants.addNote);
scoped.post('/applicants/:reference/decide', requireChurchRole('issuance:write'), applicants.decide);

// ── money ──
scoped.get('/finance', requireChurchRole('finance:read'), finance.summary);
scoped.get('/finance/ledger', requireChurchRole('finance:read'), finance.ledger);
scoped.get('/finance/payments', requireChurchRole('finance:read'), finance.payments);
scoped.get('/donations', requireChurchRole('donations:read'), finance.donations);

export default router;
