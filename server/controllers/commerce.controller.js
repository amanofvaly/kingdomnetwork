import { asyncHandler } from '../middleware/asyncHandler.js';
import { reference as makeReference } from '../lib/ids.js';
import { publicFilter } from '../lib/visibility.js';
import { createPayment } from './payment.controller.js';
import { Church } from '../models/Church.js';
import { Course } from '../models/Course.js';
import { Enrollment } from '../models/Enrollment.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { Resource } from '../models/Resource.js';

/**
 * Buying materials: coursework, books, study guides.
 *
 * Credentials do not come through here. Applying to a church for standing is
 * not a basket transaction, and keeping the two apart is what stops the
 * commerce language — prices struck through, "add to basket", cross-sell —
 * reaching anything that confers a title. See `application.controller.js`.
 */

const resolveItems = async (items) => {
  const wanted = Array.isArray(items) ? items.slice(0, 40) : [];
  const courseSlugs = wanted.filter((i) => i.kind === 'course').map((i) => i.slug);
  const resourceSlugs = wanted.filter((i) => i.kind === 'resource').map((i) => i.slug);
  const visible = await publicFilter();

  const [courses, resources] = await Promise.all([
    Course.find({ slug: { $in: courseSlugs }, status: 'published', ...visible }),
    Resource.find({ slug: { $in: resourceSlugs }, status: 'published', ...visible }),
  ]);

  const churchSlugs = [...new Set([...courses, ...resources].map((d) => d.churchSlug))];
  const churches = await Church.find({ slug: { $in: churchSlugs } }, 'slug name shortName');
  const churchName = Object.fromEntries(churches.map((c) => [c.slug, c.shortName ?? c.name]));

  const out = [];
  for (const item of wanted) {
    const doc =
      item.kind === 'course'
        ? courses.find((c) => c.slug === item.slug)
        : resources.find((r) => r.slug === item.slug);
    if (!doc) continue;

    out.push({
      kind: item.kind,
      slug: doc.slug,
      title: doc.title,
      image: doc.coverImage,
      churchSlug: doc.churchSlug,
      churchName: churchName[doc.churchSlug] ?? doc.churchSlug,
      // The price always comes from the database, never from the client.
      price: doc.price,
      compareAtPrice: doc.compareAtPrice,
      type: item.kind === 'resource' ? doc.kind : undefined,
    });
  }

  return out.filter((it, i, all) => all.findIndex((o) => o.kind === it.kind && o.slug === it.slug) === i);
};

export const priceCart = asyncHandler(async (req, res) => {
  const resolved = await resolveItems(req.body?.items);
  const subtotal = resolved.reduce((n, i) => n + i.price, 0);
  const wouldBe = resolved.reduce((n, i) => n + (i.compareAtPrice ?? i.price), 0);

  res.json({
    success: true,
    data: { items: resolved, subtotal, total: subtotal, saving: Math.max(0, wouldBe - subtotal), currency: 'USD' },
  });
});

/** Other materials from the same churches. Never a credential. */
export const crossSell = asyncHandler(async (req, res) => {
  const resolved = await resolveItems(req.body?.items);
  const have = new Set(resolved.map((i) => `${i.kind}:${i.slug}`));
  const churches = [...new Set(resolved.map((i) => i.churchSlug))];
  const visible = await publicFilter();

  const [courses, resources] = await Promise.all([
    Course.find(
      { churchSlug: { $in: churches }, status: 'published', ...visible },
      'slug title subtitle churchSlug price compareAtPrice coverImage level totalMinutes',
    ).sort({ learners: -1 }).limit(6),
    Resource.find(
      { churchSlug: { $in: churches }, status: 'published', ...visible },
      'slug title subtitle churchSlug price compareAtPrice coverImage kind',
    ).limit(6),
  ]);

  const picks = [
    ...courses.map((c) => ({ ...c.toObject(), kind: 'course' })),
    ...resources.map((r) => ({ ...r.toObject(), kind: 'resource' })),
  ]
    .filter((p) => !have.has(`${p.kind}:${p.slug}`))
    .slice(0, 3);

  res.json({ success: true, data: picks });
});

/**
 * Place the order and hand back where to pay.
 *
 * A basket can span several churches, and each church is owed its own money —
 * so one Pesapal order is created per church and the order is only paid once
 * all of them have cleared.
 */
export const createOrder = asyncHandler(async (req, res) => {
  const resolved = await resolveItems(req.body?.items);
  if (!resolved.length) return res.status(400).json({ success: false, message: 'Your basket is empty.' });

  const [ownedCourses, ownedResources] = await Promise.all([
    Enrollment.find({ userId: req.user._id, courseSlug: { $in: resolved.map((i) => i.slug) } }, 'courseSlug'),
    Enrollment.find({ userId: req.user._id, resourceSlug: { $in: resolved.map((i) => i.slug) } }, 'resourceSlug'),
  ]);
  const owned = new Set([
    ...ownedCourses.map((e) => `course:${e.courseSlug}`),
    ...ownedResources.map((e) => `resource:${e.resourceSlug}`),
  ]);

  const payable = resolved.filter((i) => !owned.has(`${i.kind}:${i.slug}`));
  if (!payable.length) {
    return res.status(409).json({ success: false, message: 'You already have everything in this basket.' });
  }

  const subtotal = payable.reduce((n, i) => n + i.price, 0);

  const order = await Order.create({
    reference: makeReference('KN'),
    userId: req.user._id,
    items: payable,
    subtotal,
    total: subtotal,
    currency: 'USD',
    billing: {
      name: req.body?.billing?.name?.trim() || req.user.name,
      email: req.body?.billing?.email?.trim() || req.user.email,
      country: req.body?.billing?.country?.trim(),
      phone: req.body?.billing?.phone?.trim(),
    },
    status: 'pending',
  });

  // Free materials need no gateway trip at all.
  if (subtotal === 0) {
    for (const item of payable) {
      const key = item.kind === 'course' ? { courseSlug: item.slug } : { resourceSlug: item.slug };
      await Enrollment.updateOne(
        { userId: req.user._id, ...key },
        { $setOnInsert: { userId: req.user._id, kind: item.kind, ...key, churchSlug: item.churchSlug, orderRef: order.reference, startedAt: new Date() } },
        { upsert: true },
      );
    }
    order.status = 'paid';
    order.paidAt = new Date();
    await order.save();
    return res.status(201).json({ success: true, data: { order, redirectUrl: null } });
  }

  const byChurch = new Map();
  for (const item of payable) {
    byChurch.set(item.churchSlug, (byChurch.get(item.churchSlug) ?? 0) + item.price);
  }

  const payments = [];
  for (const [churchSlug, amount] of byChurch) {
    payments.push(
      await createPayment({
        kind: payable.find((i) => i.churchSlug === churchSlug)?.kind === 'resource' ? 'resource' : 'course',
        amount,
        description: `Kingdom Network order ${order.reference}`,
        churchSlug,
        user: req.user,
        payer: order.billing,
        orderRef: order.reference,
      }),
    );
  }

  order.paymentRefs = payments.map((p) => p.reference);
  await order.save();

  res.status(201).json({
    success: true,
    data: {
      order,
      // A basket spanning two churches needs two trips to the gateway; the
      // client walks them in turn.
      payments: payments.map((p) => ({ reference: p.reference, churchSlug: p.churchSlug, amount: p.amount, redirectUrl: p.pesapal.redirectUrl })),
      redirectUrl: payments[0]?.pesapal?.redirectUrl ?? null,
    },
  });
});

export const listOrders = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }) });
});

export const orderDetail = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ reference: req.params.reference, userId: req.user._id });
  if (!order) return res.status(404).json({ success: false, message: 'That order was not found.' });

  const [payments, enrollments] = await Promise.all([
    Payment.find({ reference: { $in: order.paymentRefs ?? [] } }, 'reference status amount churchSlug pesapal.redirectUrl pesapal.paymentMethod'),
    Enrollment.find({ userId: req.user._id, orderRef: order.reference }),
  ]);

  res.json({ success: true, data: { order, payments, enrollments } });
});
