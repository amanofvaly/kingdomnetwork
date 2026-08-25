import { asyncHandler } from '../middleware/asyncHandler.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Credential } from '../models/Credential.js';
import { Enrollment } from '../models/Enrollment.js';
import { Order } from '../models/Order.js';
import { Pathway } from '../models/Pathway.js';
import { paymentMethods } from '../data/payment-methods.js';

const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = (n) => Array.from({ length: n }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');

export const listPaymentMethods = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: paymentMethods });
});

/**
 * Resolve a client cart into priced line items using the database as the
 * only source of truth for price. Client-supplied prices are ignored.
 */
export const priceCart = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const resolved = await resolveItems(items);
  const subtotal = resolved.reduce((n, i) => n + i.price, 0);
  res.json({ success: true, data: { items: resolved, subtotal, total: subtotal, currency: 'USD' } });
});

const resolveItems = async (items) => {
  const courseSlugs = items.filter((i) => i.kind === 'course').map((i) => i.slug);
  const pathwaySlugs = items.filter((i) => i.kind === 'pathway').map((i) => i.slug);

  const [courses, pathwayDocs] = await Promise.all([
    Course.find({ slug: { $in: courseSlugs } }),
    Pathway.find({ slug: { $in: pathwaySlugs } }),
  ]);

  const churchSlugs = [...new Set([...courses, ...pathwayDocs].map((d) => d.churchSlug))];
  const churches = await Church.find({ slug: { $in: churchSlugs } }, 'slug name shortName');
  const churchName = Object.fromEntries(churches.map((c) => [c.slug, c.shortName ?? c.name]));

  const out = [];
  for (const item of items) {
    const doc =
      item.kind === 'course'
        ? courses.find((c) => c.slug === item.slug)
        : pathwayDocs.find((p) => p.slug === item.slug);
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
    });
  }
  // One of each — a cart of learning products has no quantities.
  return out.filter((item, i, all) => all.findIndex((o) => o.kind === item.kind && o.slug === item.slug) === i);
};

export const createOrder = asyncHandler(async (req, res) => {
  const { items = [], payment = {}, billing = {} } = req.body ?? {};

  const method = paymentMethods.find((m) => m.id === payment.method);
  if (!method) return res.status(400).json({ success: false, message: 'Choose a payment method.' });
  if (!payment.account?.trim()) {
    return res.status(400).json({ success: false, message: `Enter your ${method.fieldLabel.toLowerCase()}.` });
  }

  const resolved = await resolveItems(items);
  if (!resolved.length) return res.status(400).json({ success: false, message: 'Your basket is empty.' });

  const already = await Enrollment.find({
    userId: req.user._id,
    $or: [
      { courseSlug: { $in: resolved.filter((i) => i.kind === 'course').map((i) => i.slug) } },
      { pathwaySlug: { $in: resolved.filter((i) => i.kind === 'pathway').map((i) => i.slug) } },
    ],
  });
  const ownedCourse = new Set(already.map((e) => e.courseSlug).filter(Boolean));
  const ownedPathway = new Set(already.map((e) => e.pathwaySlug).filter(Boolean));

  const payable = resolved.filter((i) =>
    i.kind === 'course' ? !ownedCourse.has(i.slug) : !ownedPathway.has(i.slug),
  );
  if (!payable.length) {
    return res.status(409).json({ success: false, message: 'You already have access to everything in this basket.' });
  }

  const subtotal = payable.reduce((n, i) => n + i.price, 0);
  const reference = `KN-${new Date().getFullYear()}-${randomCode(6)}`;

  const order = await Order.create({
    reference,
    userId: req.user._id,
    items: payable,
    subtotal,
    total: subtotal,
    currency: 'USD',
    payment: {
      method: method.id,
      label: method.label,
      // Only the last four characters of the payer identifier are retained.
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

  await grantAccess(req.user, order);

  res.status(201).json({ success: true, data: order });
});

/** Create the enrolments and in-progress credentials a paid order entitles. */
const grantAccess = async (user, order) => {
  for (const item of order.items) {
    if (item.kind === 'course') {
      await Enrollment.updateOne(
        { userId: user._id, courseSlug: item.slug },
        {
          $setOnInsert: {
            userId: user._id,
            kind: 'course',
            courseSlug: item.slug,
            churchSlug: item.churchSlug,
            orderRef: order.reference,
            startedAt: new Date(),
          },
        },
        { upsert: true },
      );

      const course = await Course.findOne({ slug: item.slug }, 'certificate title churchSlug');
      if (course?.certificate?.awarded) {
        await Credential.updateOne(
          { userId: user._id, courseSlug: item.slug },
          {
            $setOnInsert: {
              userId: user._id,
              credentialId: `KN-${new Date().getFullYear()}-${randomCode(8)}`,
              kind: 'certificate',
              title: course.certificate.title ?? course.title,
              holderName: user.name,
              churchSlug: item.churchSlug,
              churchName: item.churchName,
              courseSlug: item.slug,
              status: 'in-progress',
              verifyCode: randomCode(10),
            },
          },
          { upsert: true },
        );
      }
    } else {
      const pathway = await Pathway.findOne({ slug: item.slug });
      await Enrollment.updateOne(
        { userId: user._id, pathwaySlug: item.slug },
        {
          $setOnInsert: {
            userId: user._id,
            kind: 'pathway',
            pathwaySlug: item.slug,
            churchSlug: item.churchSlug,
            orderRef: order.reference,
            startedAt: new Date(),
          },
        },
        { upsert: true },
      );

      // A pathway includes its taught courses.
      for (const step of pathway?.steps ?? []) {
        if (!step.courseSlug) continue;
        await Enrollment.updateOne(
          { userId: user._id, courseSlug: step.courseSlug },
          {
            $setOnInsert: {
              userId: user._id,
              kind: 'course',
              courseSlug: step.courseSlug,
              churchSlug: item.churchSlug,
              orderRef: order.reference,
              startedAt: new Date(),
            },
          },
          { upsert: true },
        );
      }

      if (pathway?.award?.title) {
        await Credential.updateOne(
          { userId: user._id, pathwaySlug: item.slug },
          {
            $setOnInsert: {
              userId: user._id,
              credentialId: `KN-${new Date().getFullYear()}-${randomCode(8)}`,
              kind: pathway.award.kind === 'Ordination' ? 'ordination' : 'certificate',
              title: pathway.award.title,
              holderName: user.name,
              churchSlug: item.churchSlug,
              churchName: item.churchName,
              pathwaySlug: item.slug,
              status: 'in-progress',
              verifyCode: randomCode(10),
            },
          },
          { upsert: true },
        );
      }
    }
  }
};

export const listOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: orders });
});

export const orderDetail = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ reference: req.params.reference, userId: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'That order was not found.' });
  res.json({ success: true, data: order });
});
