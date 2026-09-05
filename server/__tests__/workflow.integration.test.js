import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * The state machine behind an application, and the one rule that matters most:
 * a credential is only ever minted by an explicit church decision. Money
 * arriving must never be enough.
 */

const URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/kingdom-network-test-workflow';

let available = true;
let advance; let decide; let issue;
let Application; let Church; let Credential; let Enrollment; let Interview; let Offering; let User;

beforeAll(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
  } catch {
    available = false;
    return;
  }
  ({ advance, decide, issue } = await import('../lib/workflow.js'));
  ({ Application } = await import('../models/Application.js'));
  ({ Church } = await import('../models/Church.js'));
  ({ Credential } = await import('../models/Credential.js'));
  ({ Enrollment } = await import('../models/Enrollment.js'));
  ({ Interview } = await import('../models/Interview.js'));
  ({ Offering } = await import('../models/Offering.js'));
  ({ User } = await import('../models/User.js'));
}, 20000);

afterAll(async () => {
  if (!available) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

let user;
let offering;

beforeEach(async () => {
  if (!available) return;
  await Promise.all([
    Application.deleteMany({}), Credential.deleteMany({}), Enrollment.deleteMany({}),
    Interview.deleteMany({}), Offering.deleteMany({}), User.deleteMany({}), Church.deleteMany({}),
  ]);

  user = await User.create({ name: 'Moses Kirabo', email: `m${Date.now()}@example.test` });
  await Church.create({ slug: 'a-church', name: 'A Church', signatory: { name: 'The Bishop', title: 'Bishop' } });

  offering = new Offering({
    slug: 'ordained-minister',
    churchSlug: 'a-church',
    type: 'ordination',
    outcome: 'ordination',
    title: 'Ordained Minister',
    price: 45,
    fee: { amount: 45, refundPolicy: 'Stated.' },
    disclosure: 'A statement.',
    status: 'published',
    award: { title: 'Ordained Minister', postNominal: 'Rev.', validityMonths: 24 },
    requires: { courses: ['a-course'], review: { required: true } },
  });
  await offering.save();
});

/**
 * Ordination carries a floor the Offering model enforces on save: a live
 * face-to-face meeting, always. So an ordination application cannot reach the
 * church's final review on coursework and a fee alone — the interview has to
 * have happened and passed.
 */
const passInterview = async (application) => {
  const interview = await Interview.create({
    applicationId: application._id,
    churchSlug: 'a-church',
    userId: user._id,
    scheduledFor: new Date(Date.now() - 86_400_000),
    status: 'completed',
    provider: 'zoom',
    outcome: 'pass',
  });
  // The workflow reads the interview through the application's own pointer,
  // not by searching for one, so booking has to be recorded on both sides.
  await Application.updateOne({ _id: application._id }, { $set: { interviewId: interview._id } });
};

const startApplication = async () => {
  const application = await Application.create({
    reference: `APP-${Math.random().toString(36).slice(2, 8)}`,
    userId: user._id,
    churchSlug: 'a-church',
    offeringSlug: offering.slug,
    offeringTitle: offering.title,
    status: 'draft',
  });
  const { application: advanced } = await advance(application, { offering });
  return advanced;
};

describe.skipIf(!available)('the application state machine', () => {
  it('stays a draft until it is actually sent', async () => {
    const application = await startApplication();
    expect(application.status).toBe('draft');
  });

  it('waits at the fee before the church sees anything', async () => {
    const started = await startApplication();
    await Application.updateOne({ _id: started._id }, { $set: { submittedAt: new Date() } });
    const { application: after } = await advance(await Application.findById(started._id), { offering });
    expect(after.status).toBe('fee_pending');
  });

  /** A credential with no fee is submitted directly, never through fee_pending. */
  it('submits straight through when there is nothing to pay', async () => {
    offering.fee.amount = 0;
    offering.price = 0;
    await offering.save();

    const started = await startApplication();
    await Application.updateOne({ _id: started._id }, { $set: { submittedAt: new Date() } });
    const { application: after } = await advance(await Application.findById(started._id), { offering });
    expect(after.status).toBe('coursework');
  });

  it('names the state after the tallest thing still in the way', async () => {
    const started = await startApplication();
    await Application.updateOne(
      { _id: started._id },
      { $set: { paymentRef: 'PAY-1', submittedAt: new Date() } },
    );

    const { application: onCoursework } = await advance(await Application.findById(started._id), { offering });
    expect(onCoursework.status).toBe('coursework');

    await Enrollment.create({ userId: user._id, courseSlug: 'a-course', status: 'completed', progress: 100 });
    const { application: onInterview } = await advance(await Application.findById(started._id), { offering });
    expect(onInterview.status).toBe('interview');

    await passInterview(started);
    const { application: awaitingChurch } = await advance(await Application.findById(started._id), { offering });
    expect(awaitingChurch.status).toBe('final_review');
  });

  it('keeps a waiver through a recomputation', async () => {
    const started = await startApplication();
    await Application.updateOne(
      { _id: started._id },
      { $set: { paymentRef: 'PAY-1', submittedAt: new Date() } },
    );
    const { application } = await advance(await Application.findById(started._id), { offering });

    const step = application.steps.find((s) => s.type === 'course');
    step.status = 'waived';
    step.waiverReason = 'Twenty years of service.';
    await application.save();

    await passInterview(application);
    const { application: after } = await advance(await Application.findById(application._id), { offering });
    const again = after.steps.find((s) => s.type === 'course');
    expect(again.status).toBe('waived');
    expect(again.waiverReason).toBe('Twenty years of service.');
    expect(after.status).toBe('final_review');
  });
});

describe.skipIf(!available)('issuing', () => {
  /**
   * Each step reloads the document, the way a request handler does — holding
   * one instance across several saves is not how any of this runs in practice.
   */
  const ready = async () => {
    const started = await startApplication();
    await Enrollment.create({ userId: user._id, courseSlug: 'a-course', status: 'completed', progress: 100 });
    await Application.updateOne(
      { _id: started._id },
      { $set: { paymentRef: 'PAY-1', submittedAt: new Date() } },
    );
    await passInterview(started);
    const { application } = await advance(await Application.findById(started._id), { offering });
    return application;
  };

  it('mints nothing until a church actually decides', async () => {
    const application = await ready();
    expect(application.status).toBe('final_review');
    expect(await Credential.countDocuments({})).toBe(0);
  });

  it('issues on approval, with the church’s signatory on it', async () => {
    const application = await ready();
    const { credential } = await decide(application, { outcome: 'approved', actor: user });

    expect(credential.title).toBe('Ordained Minister');
    expect(credential.postNominal).toBe('Rev.');
    expect(credential.holderName).toBe('Moses Kirabo');
    expect(credential.signatory.name).toBe('The Bishop');
    expect(credential.verifyCode).toHaveLength(10);
    expect(application.status).toBe('issued');
  });

  /** Two years means the same date two years later, not 24 blocks of 30 days. */
  it('expires on the calendar date, not 30-day months', async () => {
    const application = await ready();
    const { credential } = await decide(application, { outcome: 'approved', actor: user });

    const issued = new Date(credential.issuedAt);
    const expires = new Date(credential.expiresAt);
    expect(expires.getFullYear()).toBe(issued.getFullYear() + 2);
    expect(expires.getMonth()).toBe(issued.getMonth());
    expect(expires.getDate()).toBe(issued.getDate());
  });

  it('never issues twice for one application', async () => {
    const application = await ready();
    await decide(application, { outcome: 'approved', actor: user });
    await issue(await Application.findById(application._id), { actor: user });

    expect(await Credential.countDocuments({ applicationId: application._id })).toBe(1);
  });

  it('issues nothing when declined, and records why', async () => {
    const application = await ready();
    const { credential } = await decide(application, {
      outcome: 'declined', actor: user, publicNote: 'Not this year.',
    });

    expect(credential).toBeNull();
    expect(application.status).toBe('declined');
    expect(application.decision.publicNote).toBe('Not this year.');
    expect(await Credential.countDocuments({})).toBe(0);
  });

  it('keeps an internal note off the applicant’s timeline', async () => {
    const application = await ready();
    await decide(application, {
      outcome: 'declined', actor: user, publicNote: 'Not this year.', internalNote: 'Concerns raised by the board.',
    });

    const applicantSees = application.timeline.filter((t) => t.visibility !== 'church');
    expect(applicantSees.some((t) => t.note === 'Concerns raised by the board.')).toBe(false);
    expect(application.timeline.some((t) => t.note === 'Concerns raised by the board.')).toBe(true);
  });

  it('counts the issue against the listing', async () => {
    const application = await ready();
    await decide(application, { outcome: 'approved', actor: user });
    expect((await Offering.findOne({ slug: offering.slug })).issuedCount).toBe(1);
  });
});
