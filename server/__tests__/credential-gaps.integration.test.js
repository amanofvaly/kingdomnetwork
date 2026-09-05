import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Application } from '../models/Application.js';
import { Offering } from '../models/Offering.js';
import { Credential } from '../models/Credential.js';
import { Course } from '../models/Course.js';
import { Church } from '../models/Church.js';
import { User } from '../models/User.js';
import { Assessment } from '../models/Assessment.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { InterviewSlot } from '../models/InterviewSlot.js';
import { Interview } from '../models/Interview.js';
import { Post } from '../models/Post.js';
import { advance, buildSteps, contextFor, decide, issue } from '../lib/workflow.js';
import { evaluate, summarise } from '../lib/requirements.js';
import { offeringProblems } from '../lib/offeringReadiness.js';
import { reserveAdmission, releaseAdmission } from '../lib/admissions.js';
import { presentSteps } from '../lib/requirementPresentation.js';
import { snapshotOffering } from '../lib/applicationTerms.js';
import * as authoring from '../controllers/authoring.controller.js';
import * as applications from '../controllers/application.controller.js';
import * as applicants from '../controllers/applicants.controller.js';
import * as assessments from '../controllers/assessment.controller.js';
import { up as migrateIntegrity } from '../migrations/010-application-terms-and-integrity.js';
import { applyPaymentResult } from '../controllers/payment.controller.js';
import { Payment } from '../models/Payment.js';
import { mailer } from '../lib/mailer/index.js';

const URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/kingdom-network-test-gaps';
let user, church, offering;
const run = async (handler, req = {}) => {
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
  await handler({ user, church, params: {}, body: {}, ...req }, res, (err) => { if (err) throw err; });
  return res;
};
const application = (extra = {}) => Application.create({ reference: `APP-${new mongoose.Types.ObjectId()}`, userId: user._id, churchSlug: church.slug, offeringSlug: offering.slug, offeringTitle: offering.title, offeringSnapshot: snapshotOffering(offering), status: 'draft', ...extra });
const publish = () => run(authoring.publishOffering, { params: { slug: offering.slug }, body: { status: 'published' } });
beforeAll(async () => {
  // This suite fails loudly if MongoDB cannot be reached; never report a skipped
  // integration body as a passing regression.
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
  await Promise.all([Application.init(), Credential.init(), Offering.init()]);
  vi.spyOn(mailer, 'send').mockResolvedValue({ ok: true });
});
afterAll(async () => { vi.restoreAllMocks(); if (mongoose.connection.readyState) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
beforeEach(async () => {
  await Promise.all([Application, Credential, Offering, Course, Church, User, Assessment, AssessmentAttempt, InterviewSlot, Interview, Post].map((m) => m.deleteMany({})));
  church = await Church.create({ slug: 'test-church', name: 'Test Church' });
  user = await User.create({ name: 'Applicant', email: 'applicant@example.test' });
  offering = await Offering.create({ slug: 'certificate', churchSlug: church.slug, title: 'Certificate', subtitle: 'A real announcement.', type: 'certificate', outcome: 'certification', disclosure: 'Church standing.', price: 0, fee: { amount: 0 }, status: 'published', requires: { review: { required: true } } });
});

describe('publishable and achievable requirements', () => {
  it('rejects unknown prerequisite slugs on save', async () => {
    const res = await run(authoring.updateOffering, { params: { slug: offering.slug }, body: { requires: { credentials: ['typo'] } } });
    expect(res.statusCode).toBe(400); expect(res.body.message).toContain('does not exist');
  });
  it('reports both dates for an empty window', async () => {
    offering.intake = { mode: 'windows', windows: [{}] }; await offering.save();
    expect((await publish()).body.message).toContain('both opening and closing dates');
  });
  it('rejects an impossible or duplicate prerequisite group', async () => {
    const r = { credentialGroups: [{ mode: 'atLeast', count: 2, offeringSlugs: ['one', 'one'] }] };
    expect(evaluate({ requires: r }, { heldCredentials: new Set(['one']) }).steps[0].status).toBe('pending');
    offering.requires.credentialGroups = [{ mode: 'atLeast', count: 2, offeringSlugs: [] }];
    expect((await offeringProblems(offering)).join(' ')).toContain('needs at least one choice');
  });
  it('does not double-count credit units', () => {
    const steps = evaluate({ requires: { credentialGroups: [{ creditUnits: 6, offeringSlugs: ['one', 'one'] }] } }, { heldCredentials: new Set(['one']), creditsFor: () => 3 }).steps;
    expect(steps[0].status).toBe('pending'); expect(steps[0].detail).toBe('3 of 6 credits');
  });
  it('requires a published assessment', async () => {
    offering.requires.assessment = { required: true }; offering.assessmentSlug = 'draft-paper'; await offering.save();
    await Assessment.create({ slug: 'draft-paper', churchSlug: church.slug, title: 'Draft', status: 'draft' });
    expect((await publish()).body.message).toContain('Publish the selected assessment');
  });
  it('requires a compatible available interview slot', async () => {
    offering.type = 'ordination'; await offering.save();
    await InterviewSlot.create({ churchSlug: church.slug, provider: 'phone', startsAt: new Date(Date.now() + 3600000), endsAt: new Date(Date.now() + 7200000) });
    expect((await publish()).body.message).toContain('video or in-person');
    await InterviewSlot.updateMany({}, { provider: 'zoom' });
    expect((await publish()).statusCode).toBe(200);
  });
  it('announces the subtitle', async () => {
    await publish(); expect((await Post.findOne({ offeringSlug: offering.slug })).body).toBe(offering.subtitle);
  });
  it('blocks unpublishing a prerequisite even with force', async () => {
    await Offering.create({ slug: 'next', title: 'Next', churchSlug: church.slug, type: 'certificate', outcome: 'certification', price: 0, requires: { credentials: [offering.slug] } });
    expect((await run(authoring.publishOffering, { params: { slug: offering.slug }, body: { status: 'draft', force: true } })).statusCode).toBe(409);
  });
  it('blocks unpublishing an assessment in use', async () => {
    const paper = await Assessment.create({ slug: 'paper', title: 'Paper', churchSlug: church.slug, status: 'published' });
    offering.assessmentSlug = paper.slug; await offering.save();
    expect((await run(authoring.publishAssessment, { params: { slug: paper.slug }, body: { status: 'draft' } })).statusCode).toBe(409);
  });
  it('keeps slugs immutable when the title changes', async () => {
    offering.slug = 'different'; offering.title = 'New title'; await offering.save();
    expect((await Offering.findById(offering._id)).slug).toBe('certificate');
  });
});

describe('honest checklists and editing', () => {
  it('optional requirements never block a church decision', async () => {
    offering.requires.documents = [{ key: 'extra', label: 'Extra', required: false }]; await offering.save();
    const app = await application({ submittedAt: new Date() });
    const result = await advance(app); expect(result.summary.readyForDecision).toBe(true);
    expect((await decide(app, { outcome: 'approved', actor: user })).credential).toBeTruthy();
  });
  it('a required checkbox is not answered by false', () => {
    const result = evaluate({ applicationForm: [{ key: 'agree', type: 'checkbox', required: true }] }, { application: { answers: { agree: false } } });
    expect(result.steps[0].status).toBe('pending');
  });
  it('allows answers while coursework is outstanding', async () => {
    offering.requires.courses = ['course']; offering.applicationForm = [{ key: 'answer', label: 'Answer', required: true }]; await offering.save();
    const app = await application({ status: 'coursework', submittedAt: new Date() });
    const res = await run(applications.update, { params: { reference: app.reference }, body: { answers: { answer: 'My answer' } } });
    expect(res.statusCode).toBe(200); expect(res.body.data.answers.answer).toBe('My answer');
  });
  it('saves an information-request reply in the timeline', async () => {
    const app = await application({ status: 'info_requested', infoRequest: { requestedAt: new Date(), message: 'Explain' } });
    await run(applications.update, { params: { reference: app.reference }, body: { resolveInfoRequest: true, reply: 'Here is my explanation.' } });
    expect((await Application.findById(app._id)).timeline.some((t) => t.note === 'Here is my explanation.')).toBe(true);
  });
  it('hydrates individual and grouped titles for both requirement types', async () => {
    await Course.create({ slug: 'course', title: 'Course title', churchSlug: church.slug, price: 0 });
    const steps = evaluate({ requires: { credentials: [offering.slug], courseGroups: [{ mode: 'any', courseSlugs: ['course'] }] } }).steps;
    const result = await presentSteps(steps);
    expect(result[0].label).toBe('Certificate'); expect(result[1].options[0].title).toBe('Course title');
  });
  it('excludes expired credentials from prerequisites', async () => {
    await Credential.create({ userId: user._id, credentialId: 'OLD', offeringSlug: 'old', title: 'Old', status: 'issued', expiresAt: new Date(Date.now() - 1000) });
    const context = await contextFor(await application(), offering);
    expect(context.heldCredentials.has('old')).toBe(false);
  });
  it('keeps original requirements after an offering edit', async () => {
    const app = await application({ submittedAt: new Date() });
    offering.requires.courses = ['new-course']; await offering.save();
    await advance(app);
    expect(app.steps.some((s) => s.type === 'course')).toBe(false);
  });
  it('keeps group waivers tied to their stable identity', () => {
    const app = { steps: [{ key: 'credentialGroup:first', status: 'waived', waiverReason: 'Prior service' }] };
    const terms = { requires: { credentialGroups: [{ key: 'second', mode: 'any', offeringSlugs: ['b'] }, { key: 'first', mode: 'any', offeringSlugs: ['a'] }] } };
    const steps = buildSteps(app, terms, {});
    expect(steps[0].status).toBe('pending'); expect(steps[1].status).toBe('waived');
  });
});

describe('approval invariants', () => {
  it('refuses direct issue without a persisted church decision', async () => {
    await expect(issue(await application(), { actor: user })).rejects.toThrow('recorded church approval');
    expect(await Credential.countDocuments()).toBe(0);
  });
  it('does not accept overrideOutstanding', async () => {
    offering.requires.documents = [{ key: 'required', label: 'Evidence' }]; await offering.save();
    const app = await application({ status: 'under_review', submittedAt: new Date() });
    const res = await run(applicants.decide, { params: { reference: app.reference }, body: { outcome: 'approved', overrideOutstanding: true } });
    expect(res.statusCode).toBe(409); expect(await Credential.countDocuments()).toBe(0);
  });
  it('cannot waive an ordination interview', async () => {
    offering.type = 'ordination'; await offering.save(); const app = await application(); await advance(app);
    const res = await run(applicants.waiveStep, { params: { reference: app.reference, key: 'interview' }, body: { reason: 'Please skip' } });
    expect(res.statusCode).toBe(400); expect(res.body.message).toContain('cannot be waived');
  });
  it('ignores an old ordination interview waiver', async () => {
    const steps = buildSteps({ steps: [{ key: 'interview', status: 'waived' }] }, { type: 'ordination', requires: { interview: { required: true } } }, {});
    expect(steps[0].status).toBe('pending');
  });
  it('only one concurrent approval issues a credential', async () => {
    const app = await application({ status: 'final_review', submittedAt: new Date() });
    const copies = await Promise.all([Application.findById(app._id), Application.findById(app._id)]);
    const results = await Promise.allSettled(copies.map((a) => decide(a, { outcome: 'approved', actor: user })));
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    expect(await Credential.countDocuments({ applicationId: app._id })).toBe(1);
  });
  it('recovers approval interrupted before issuance on refresh', async () => {
    const app = await application({ status: 'approved', submittedAt: new Date(), decision: { outcome: 'approved', by: user._id, at: new Date() } });
    await advance(app); expect(app.status).toBe('issued'); expect(await Credential.countDocuments()).toBe(1);
  });
});

describe('places, repeated applications and renewal', () => {
  it('atomically admits only one applicant for the final place', async () => {
    offering.capacity = 1; await offering.save();
    const apps = await Promise.all([application(), application({ userId: new mongoose.Types.ObjectId() })]);
    const results = await Promise.allSettled(apps.map(reserveAdmission));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const winner = apps[results.findIndex((r) => r.status === 'fulfilled')];
    await reserveAdmission(winner);
    expect((await Offering.findById(offering._id).select('+admissions')).admissions).toHaveLength(1);
    await releaseAdmission(winner);
    await reserveAdmission(apps[results.findIndex((r) => r.status === 'rejected')]);
  });
  it('enforces intake seats as well as total capacity', async () => {
    offering.capacity = 10; offering.intake = { mode: 'windows', windows: [{ key: 'now', opensAt: new Date(Date.now() - 1000), closesAt: new Date(Date.now() + 3600000), seats: 1 }] }; await offering.save();
    await reserveAdmission(await application());
    await expect(reserveAdmission(await application({ userId: new mongoose.Types.ObjectId() }))).rejects.toThrow('All places');
  });
  it('rechecks intake when submitting a previously saved draft', async () => {
    const app = await application();
    offering.intake = { mode: 'windows', windows: [{ opensAt: new Date(Date.now() - 3600000), closesAt: new Date(Date.now() - 1000) }] }; await offering.save();
    await expect(run(applications.submit, { params: { reference: app.reference } })).rejects.toThrow('Applications are closed');
  });
  it('allows another invitation letter after one was issued', async () => {
    offering.type = 'invitation-letter'; offering.letter = { destinationCountry: 'Kenya' }; await offering.save();
    await application({ status: 'issued' });
    const res = await run(applications.start, { body: { offeringSlug: offering.slug } });
    expect(res.statusCode).toBe(201); expect(await Application.countDocuments()).toBe(2);
  });
  it('starts a reviewed renewal with its own fee and evidence requirement', async () => {
    offering.award = { renewable: true, validityMonths: 12 }; offering.renewal = { required: true, everyMonths: 12, continuingEducationHours: 20 }; offering.fee.renewalAmount = 10; await offering.save();
    await Credential.create({ credentialId: 'RENEW-ME', userId: user._id, offeringSlug: offering.slug, title: 'Old credential', status: 'expired' });
    const res = await run(applications.start, { body: { offeringSlug: offering.slug, renewalOf: 'RENEW-ME' } });
    expect(res.statusCode).toBe(201); expect(res.body.data.renewalOf).toBe('RENEW-ME'); expect(res.body.data.offering.fee.amount).toBe(10);
    expect(res.body.data.documents[0].label).toContain('20 hours');
    expect(res.body.data.steps.some((s) => s.type === 'review')).toBe(true);
  });
  it('does not borrow a pass from another application using the same paper', async () => {
    const paper = await Assessment.create({ slug: 'paper', churchSlug: church.slug, title: 'Paper', status: 'published', questions: [{ key: 'q', type: 'single', prompt: 'Yes?', options: ['Yes', 'No'], answers: [0] }] });
    offering.assessmentSlug = paper.slug; offering.requires.assessment = { required: true }; await offering.save();
    await AssessmentAttempt.create({ applicationId: new mongoose.Types.ObjectId(), userId: user._id, assessmentSlug: paper.slug, churchSlug: church.slug, attemptNumber: 1, status: 'graded', passed: true, score: 100 });
    const app = await application();
    const res = await run(assessments.getPaper, { params: { reference: app.reference } });
    expect(res.body.data.passed).not.toBe(true); expect(res.body.data.attemptId).toBeTruthy();
    expect((await Application.findById(app._id)).attemptIds).toHaveLength(1);
  });
  it('a renewal payment advances the application but never issues the credential', async () => {
    offering.fee.amount = 10; await offering.save();
    const app = await application({ renewalOf: 'OLDER-CREDENTIAL', status: 'fee_pending' });
    const payment = await Payment.create({ reference: 'PAY-RENEW', userId: user._id, applicationId: app._id, churchSlug: church.slug, kind: 'renewal_fee', amount: 10, currency: 'USD', status: 'pending', commissionPercent: 10 });
    await applyPaymentResult(payment, { state: 'completed', amount: 10 });
    const after = await Application.findById(app._id);
    expect(after.paymentRef).toBe('PAY-RENEW'); expect(after.status).toBe('final_review');
    expect(await Credential.countDocuments()).toBe(0);
  });
  it('preserves a sent referee token when application details are edited', async () => {
    offering.requires.references = [{ key: 'pastor', label: 'Pastor' }]; await offering.save();
    const app = await application({ references: [{ key: 'pastor', name: 'Pastor', email: 'pastor@example.test', token: 'private-link', status: 'sent' }] });
    await run(applications.update, { params: { reference: app.reference }, body: { references: [{ key: 'pastor', name: 'Pastor', email: 'pastor@example.test' }] } });
    expect((await Application.findById(app._id).select('+references.token')).references[0].token).toBe('private-link');
  });
  it('backfills legacy terms and admissions and can migrate twice', async () => {
    const app = await application({ status: 'under_review', submittedAt: new Date() });
    await Application.updateOne({ _id: app._id }, { $unset: { offeringSnapshot: 1 } });
    await migrateIntegrity(mongoose.connection.db); await migrateIntegrity(mongoose.connection.db);
    expect((await Application.findById(app._id)).offeringSnapshot.title).toBe(offering.title);
    expect((await Offering.findById(offering._id).select('+admissions')).admissions).toHaveLength(1);
  });

});
