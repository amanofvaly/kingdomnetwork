import { asyncHandler } from '../middleware/asyncHandler.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Credential } from '../models/Credential.js';
import { Enrollment } from '../models/Enrollment.js';
import { Offering } from '../models/Offering.js';
import { Order } from '../models/Order.js';
import { paymentMethods } from '../data/payment-methods.js';

const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = (n) => Array.from({ length: n }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');

export const listPaymentMethods = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: paymentMethods });
});

/** Resolve a client basket into priced lines. Price always comes from the database. */
const resolveItems = async (items) => {
  const offeringSlugs = items.filter((i) => i.kind === 'offering').map((i) => i.slug);
  const courseSlugs = items.filter((i) => i.kind === 'course').map((i) => i.slug);

  const [offerings, courses] = await Promise.all([
    Offering.find({ slug: { $in: offeringSlugs }, published: true }),
    Course.find({ slug: { $in: courseSlugs } }),
  ]);

  const churchSlugs = [...new Set([...offerings, ...courses].map((d) => d.churchSlug))];
  const churches = await Church.find({ slug: { $in: churchSlugs } }, 'slug name shortName');
  const churchName = Object.fromEntries(churches.map((c) => [c.slug, c.shortName ?? c.name]));

  const out = [];
  for (const item of items) {
    const doc =
      item.kind === 'offering'
        ? offerings.find((o) => o.slug === item.slug)
        : courses.find((c) => c.slug === item.slug);
    if (!doc) continue;
    out.push({
      kind: item.kind,
      slug: doc.slug,
      title: doc.title,
      image: doc.coverImage,
      churchSlug: doc.churchSlug,
      churchName: churchName[doc.churchSlug] ?? doc.churchSlug,
      price: doc.price,
      compareAtPrice: doc.compareAtPrice,
      type: doc.type,
      outcome: doc.outcome,
    });
  }
  return out.filter((it, i, all) => all.findIndex((o) => o.kind === it.kind && o.slug === it.slug) === i);
};

export const priceCart = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const resolved = await resolveItems(items);
  const subtotal = resolved.reduce((n, i) => n + i.price, 0);
  const wouldBe = resolved.reduce((n, i) => n + (i.compareAtPrice ?? i.price), 0);
  res.json({
    success: true,
    data: { items: resolved, subtotal, total: subtotal, saving: Math.max(0, wouldBe - subtotal), currency: 'USD' },
  });
});

/** Things commonly bought alongside what is already in the basket. */
export const crossSell = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const have = new Set(items.filter((i) => i.kind === 'offering').map((i) => i.slug));
  const resolved = await resolveItems(items);
  const outcomes = new Set(resolved.map((i) => i.outcome).filter(Boolean));
  const churches = new Set(resolved.map((i) => i.churchSlug));

  // Ordination and certificates pair with a letter; a letter pairs with a credential.
  const wants = outcomes.has('invitation-letter')
    ? ['ordination', 'certification']
    : ['invitation-letter', 'church-affiliation'];

  const picks = await Offering.find(
    { outcome: { $in: wants }, slug: { $nin: [...have] }, published: true },
    'slug title subtitle churchSlug outcome type price compareAtPrice coverImage badge letter.destinationCity award.title',
  )
    .sort({ editorsPick: -1, issuedCount: -1 })
    .limit(6);

  const near = picks.filter((p) => churches.has(p.churchSlug));
  const rest = picks.filter((p) => !churches.has(p.churchSlug));
  const ordered = [...near, ...rest].slice(0, 3);

  const churchDocs = await Church.find({ slug: { $in: ordered.map((o) => o.churchSlug) } }, 'slug name shortName monogram country verified');
  const by = Object.fromEntries(churchDocs.map((c) => [c.slug, c]));

  res.json({ success: true, data: ordered.map((o) => ({ ...o.toObject(), church: by[o.churchSlug] ?? null })) });
});

export const createOrder = asyncHandler(async (req, res) => {
  const { items = [], payment = {}, billing = {} } = req.body ?? {};

  const method = paymentMethods.find((m) => m.id === payment.method);
  if (!method) return res.status(400).json({ success: false, message: 'Choose a payment method.' });
  if (!payment.account?.trim()) {
    return res.status(400).json({ success: false, message: `Enter your ${method.fieldLabel.toLowerCase()}.` });
  }

  const resolved = await resolveItems(items);
  if (!resolved.length) return res.status(400).json({ success: false, message: 'Your basket is empty.' });

  // Invitation letters are bought again for each trip, so they are never blocked
  // as a duplicate. Everything else you only hold once.
  const offeringSlugs = resolved.filter((i) => i.kind === 'offering' && i.type !== 'invitation-letter').map((i) => i.slug);
  const courseSlugs = resolved.filter((i) => i.kind === 'course').map((i) => i.slug);

  const [heldOfferings, heldCourses] = await Promise.all([
    Credential.find({ userId: req.user._id, offeringSlug: { $in: offeringSlugs } }, 'offeringSlug'),
    Enrollment.find({ userId: req.user._id, courseSlug: { $in: courseSlugs } }, 'courseSlug'),
  ]);
  const ownedOffering = new Set(heldOfferings.map((c) => c.offeringSlug));
  const ownedCourse = new Set(heldCourses.map((e) => e.courseSlug));

  const payable = resolved.filter((i) =>
    i.kind === 'course'
      ? !ownedCourse.has(i.slug)
      : i.type === 'invitation-letter' || !ownedOffering.has(i.slug),
  );
  if (!payable.length) {
    return res.status(409).json({ success: false, message: 'You already hold everything in this basket.' });
  }

  const subtotal = payable.reduce((n, i) => n + i.price, 0);

  const order = await Order.create({
    reference: `KN-${new Date().getFullYear()}-${randomCode(6)}`,
    userId: req.user._id,
    items: payable,
    subtotal,
    total: subtotal,
    currency: 'USD',
    payment: {
      method: method.id,
      label: method.label,
      account: String(payment.account).trim().slice(-4).padStart(8, '•'),
      reference: `SIM-${randomCode(10)}`,
      simulated: true,
    },
    billing: {
      name: billing.name?.trim() || req.user.name,
      email: billing.email?.trim() || req.user.email,
      country: billing.country?.trim(),
      phone: billing.phone?.trim(),
    },
    status: 'paid',
    paidAt: new Date(),
  });

  const issued = await grantAccess(req.user, order);
  res.status(201).json({ success: true, data: { order, issued } });
});

const KIND_BY_TYPE = {
  ordination: 'ordination',
  certificate: 'certificate',
  license: 'license',
  affiliation: 'affiliation',
  'invitation-letter': 'invitation-letter',
};

/**
 * What a paid order actually entitles. How the credential lands depends on what
 * the church said it required:
 *
 *   instant      issued now
 *   assessment   held until the buyer passes it here
 *   coursework   the courses are unlocked; issued when they are finished
 *   credentials  held until the named credentials are also held
 *   review       sent to the church, issued when they sign it
 */
const grantAccess = async (user, order) => {
  const issued = [];

  for (const item of order.items) {
    if (item.kind === 'course') {
      await Enrollment.updateOne(
        { userId: user._id, courseSlug: item.slug },
        { $setOnInsert: { userId: user._id, kind: 'course', courseSlug: item.slug, churchSlug: item.churchSlug, orderRef: order.reference, startedAt: new Date() } },
        { upsert: true },
      );
      continue;
    }

    const offering = await Offering.findOne({ slug: item.slug });
    if (!offering) continue;

    // Buying an offering unlocks the coursework it names.
    for (const courseSlug of offering.requires?.courses ?? []) {
      await Enrollment.updateOne(
        { userId: user._id, courseSlug },
        { $setOnInsert: { userId: user._id, kind: 'course', courseSlug, churchSlug: offering.churchSlug, orderRef: order.reference, startedAt: new Date() } },
        { upsert: true },
      );
    }

    const outstanding = [];
    if (offering.requires?.courses?.length) {
      const done = await Enrollment.find(
        { userId: user._id, courseSlug: { $in: offering.requires.courses }, status: 'completed' },
        'courseSlug',
      );
      const doneSet = new Set(done.map((d) => d.courseSlug));
      for (const c of offering.requires.courses) if (!doneSet.has(c)) outstanding.push(`course:${c}`);
    }
    if (offering.requires?.credentials?.length) {
      const held = await Credential.find(
        { userId: user._id, offeringSlug: { $in: offering.requires.credentials }, status: 'issued' },
        'offeringSlug',
      );
      const heldSet = new Set(held.map((h) => h.offeringSlug));
      for (const c of offering.requires.credentials) if (!heldSet.has(c)) outstanding.push(`credential:${c}`);
    }
    if (offering.requires?.assessment?.required) outstanding.push('assessment');

    const needsReview = Boolean(offering.requires?.review?.required);
    const status = outstanding.length ? 'in-progress' : needsReview ? 'in-review' : 'issued';

    const church = await Church.findOne({ slug: offering.churchSlug }, 'name shortName');

    const doc = await Credential.create({
      userId: user._id,
      credentialId: `KN-${new Date().getFullYear()}-${randomCode(8)}`,
      kind: KIND_BY_TYPE[offering.type] ?? 'certificate',
      offeringSlug: offering.slug,
      title: offering.award?.title ?? offering.title,
      postNominal: offering.award?.postNominal,
      holderName: user.name,
      churchSlug: offering.churchSlug,
      churchName: church?.shortName ?? church?.name ?? offering.churchSlug,
      destinationCountry: offering.letter?.destinationCountry,
      destinationCity: offering.letter?.destinationCity,
      purpose: offering.letter?.purpose,
      outstanding,
      status,
      issuedAt: status === 'issued' ? new Date() : undefined,
      expiresAt:
        status === 'issued' && offering.award?.validityMonths
          ? new Date(Date.now() + offering.award.validityMonths * 30 * 24 * 60 * 60 * 1000)
          : undefined,
      verifyCode: randomCode(10),
    });

    issued.push({ credentialId: doc.credentialId, title: doc.title, status: doc.status, offeringSlug: offering.slug });
  }

  return issued;
};

export const listOrders = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }) });
});

export const orderDetail = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ reference: req.params.reference, userId: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'That order was not found.' });
  const credentials = await Credential.find({ userId: req.user._id, offeringSlug: { $in: order.items.map((i) => i.slug) } });
  res.json({ success: true, data: { order, credentials } });
});
