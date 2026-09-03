import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Pesapal tells us an order changed, never what it changed to — so the browser
 * callback and the server-to-server IPN both fetch the status and hand it to
 * one handler. They arrive at roughly the same moment. If that handler is not
 * safe to run twice, the second one enrols the buyer again and credits the
 * church's ledger again.
 *
 * This runs against a scratch database on a local mongod. It is skipped
 * entirely when one is not reachable, so the suite still passes on a machine
 * without Mongo.
 */

const URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/kingdom-network-test-payments';

let available = true;
let applyPaymentResult;
let Payment;
let LedgerEntry;
let balanceFor;

beforeAll(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
  } catch {
    available = false;
    return;
  }
  ({ applyPaymentResult } = await import('../controllers/payment.controller.js'));
  ({ Payment } = await import('../models/Payment.js'));
  ({ LedgerEntry } = await import('../models/LedgerEntry.js'));
  ({ balanceFor } = await import('../lib/ledger.js'));
}, 20000);

afterAll(async () => {
  if (!available) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!available) return;
  await Promise.all([Payment.deleteMany({}), LedgerEntry.deleteMany({})]);
});

const completed = (amount = 60) => ({
  statusCode: 1,
  state: 'completed',
  description: 'COMPLETED',
  confirmationCode: 'CONF123',
  paymentMethod: 'MPESA',
  amount,
  raw: {},
});

const makePayment = (over = {}) =>
  Payment.create({
    reference: `PAY-TEST-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'donation',
    churchSlug: 'a-church',
    description: 'A gift',
    amount: 60,
    commissionPercent: 10,
    platformFee: 6,
    netToChurch: 54,
    status: 'pending',
    payer: {},
    pesapal: { orderTrackingId: 'OT-1' },
    ...over,
  });

describe.skipIf(!available)('applying a payment result', () => {
  it('credits the church exactly once when the IPN and the callback race', async () => {
    const payment = await makePayment();

    const [first, second] = await Promise.all([
      applyPaymentResult(payment, completed()),
      applyPaymentResult(await Payment.findById(payment._id), completed()),
    ]);

    const changed = [first, second].filter((r) => r.changed);
    expect(changed).toHaveLength(1);

    expect(await balanceFor('a-church')).toBe(54);
    expect(await LedgerEntry.countDocuments({ paymentRef: payment.reference, type: 'credit' })).toBe(1);
    expect(await LedgerEntry.countDocuments({ paymentRef: payment.reference, type: 'fee' })).toBe(1);
  });

  it('is safe to run again on a payment already completed', async () => {
    const payment = await makePayment();
    await applyPaymentResult(payment, completed());
    const again = await applyPaymentResult(await Payment.findById(payment._id), completed());

    expect(again.changed).toBe(false);
    expect(await balanceFor('a-church')).toBe(54);
  });

  it('records a failure without crediting anything', async () => {
    const payment = await makePayment();
    const { payment: saved } = await applyPaymentResult(payment, { ...completed(), statusCode: 2, state: 'failed' });

    expect(saved.status).toBe('failed');
    expect(await balanceFor('a-church')).toBe(0);
  });

  it('records a reversal as reversed rather than merely pending', async () => {
    const payment = await makePayment();
    const { payment: saved } = await applyPaymentResult(payment, { ...completed(), statusCode: 3, state: 'reversed' });
    expect(saved.status).toBe('reversed');
  });

  /** Pesapal is the authority on what was actually taken, not our own record. */
  it('trusts the gateway’s amount over ours, and re-splits the fee against it', async () => {
    const payment = await makePayment();
    await applyPaymentResult(payment, completed(50));

    const saved = await Payment.findById(payment._id);
    expect(saved.amount).toBe(50);
    expect(saved.platformFee).toBe(5);
    expect(saved.netToChurch).toBe(45);
    expect(await balanceFor('a-church')).toBe(45);
  });

  it('does not undo a completed payment when a later notification says invalid', async () => {
    const payment = await makePayment();
    await applyPaymentResult(payment, completed());
    const { payment: saved } = await applyPaymentResult(
      await Payment.findById(payment._id),
      { ...completed(), statusCode: 0, state: 'invalid' },
    );

    expect(saved.status).toBe('completed');
    expect(await balanceFor('a-church')).toBe(54);
  });
});

describe.skipIf(!available)('the ledger', () => {
  it('adds up correctly when several payments to one church land together', async () => {
    const payments = await Promise.all([makePayment(), makePayment(), makePayment()]);
    await Promise.all(payments.map((p) => applyPaymentResult(p, completed())));

    // Three gifts of $60, less 10% on each.
    expect(await balanceFor('a-church')).toBe(162);
    expect(await LedgerEntry.countDocuments({ churchSlug: 'a-church', type: 'credit' })).toBe(3);
    expect(await LedgerEntry.countDocuments({ churchSlug: 'a-church', type: 'fee' })).toBe(3);
  });

  it('keeps churches’ accounts separate', async () => {
    await applyPaymentResult(await makePayment(), completed());
    await applyPaymentResult(await makePayment({ churchSlug: 'another-church' }), completed());

    expect(await balanceFor('a-church')).toBe(54);
    expect(await balanceFor('another-church')).toBe(54);
  });
});
