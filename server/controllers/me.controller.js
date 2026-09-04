import { asyncHandler } from '../middleware/asyncHandler.js';
import { Application } from '../models/Application.js';
import { Church } from '../models/Church.js';
import { Enrollment } from '../models/Enrollment.js';
import { Interview } from '../models/Interview.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { Payment } from '../models/Payment.js';
import { Resource } from '../models/Resource.js';

/**
 * The three things a person could already be recorded as having done, but
 * could not see.
 *
 * Each of these reads data the platform has always written. Nothing here is a
 * new concept — it is the missing half of features that were only ever built
 * from the church's side.
 */

const churchIndex = async () => {
  const churches = await Church.find({}, 'slug name shortName monogram verified city country');
  return Object.fromEntries(churches.map((c) => [c.slug, c]));
};

/* --- what you own ------------------------------------------------------- */

/**
 * Books and materials, with the files attached.
 *
 * A resource's files are private assets, so they are served through the one
 * media route that checks who is asking; all this does is name them. Without
 * it a purchase wrote an enrolment and handed back nothing to open.
 */
export const library = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ userId: req.user._id, kind: 'resource' }).sort({ createdAt: -1 });
  const slugs = enrollments.map((e) => e.resourceSlug).filter(Boolean);

  const [resources, churchBy] = await Promise.all([
    Resource.find(
      { slug: { $in: slugs } },
      'slug churchSlug kind title subtitle authorName coverImage coverAlt pages durationMinutes language fileMediaIds',
    ),
    churchIndex(),
  ]);

  const resourceBy = Object.fromEntries(resources.map((r) => [r.slug, r]));
  const fileIds = resources.flatMap((r) => r.fileMediaIds ?? []);
  const assets = await MediaAsset.find({ _id: { $in: fileIds } }, 'kind mimeType filename bytes storageKey durationSeconds');
  const assetBy = Object.fromEntries(assets.map((a) => [String(a._id), a]));

  const items = enrollments
    .map((e) => {
      const resource = resourceBy[e.resourceSlug];
      if (!resource) return null;
      return {
        slug: resource.slug,
        kind: resource.kind,
        title: resource.title,
        subtitle: resource.subtitle,
        authorName: resource.authorName,
        coverImage: resource.coverImage,
        coverAlt: resource.coverAlt,
        pages: resource.pages,
        durationMinutes: resource.durationMinutes,
        language: resource.language,
        church: churchBy[resource.churchSlug] ?? null,
        boughtAt: e.createdAt,
        orderRef: e.orderRef ?? null,
        files: (resource.fileMediaIds ?? [])
          .map((id) => assetBy[String(id)])
          .filter(Boolean)
          .map((a) => ({
            id: String(a._id),
            filename: a.filename,
            kind: a.kind,
            mimeType: a.mimeType,
            bytes: a.bytes,
            durationSeconds: a.durationSeconds,
            url: `/api/media/file/${a.storageKey}`,
          })),
      };
    })
    .filter(Boolean);

  res.json({ success: true, data: { items } });
});

/* --- what you have paid -------------------------------------------------- */

const STATEMENT_KINDS = {
  application_fee: 'Application fee',
  renewal_fee: 'Renewal fee',
  course: 'Course',
  resource: 'Material',
  donation: 'Gift',
};

/**
 * Everything this person has paid, gifts included.
 *
 * Orders only ever covered materials, so a gift given to a church left no
 * trace anywhere the giver could reach. The church's own ledger is not shown
 * here: what a church nets from a gift is the church's business, not the
 * giver's, so `platformFee` and `netToChurch` stay out of this.
 */
export const statement = asyncHandler(async (req, res) => {
  const [payments, churchBy] = await Promise.all([
    Payment.find(
      { userId: req.user._id, status: { $in: ['pending', 'completed', 'refunded', 'reversed'] } },
      'reference kind churchSlug description amount currency status donation completedAt refundedAt createdAt',
    ).sort({ createdAt: -1 }),
    churchIndex(),
  ]);

  const entries = payments.map((p) => ({
    reference: p.reference,
    kind: p.kind,
    kindLabel: STATEMENT_KINDS[p.kind] ?? p.kind,
    description: p.description,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    church: churchBy[p.churchSlug] ?? null,
    cause: p.kind === 'donation' ? p.donation?.causeTitle ?? null : null,
    message: p.kind === 'donation' ? p.donation?.message ?? null : null,
    at: p.completedAt ?? p.createdAt,
    refundedAt: p.refundedAt ?? null,
  }));

  const settled = entries.filter((e) => e.status === 'completed');
  const gifts = settled.filter((e) => e.kind === 'donation');

  res.json({
    success: true,
    data: {
      entries,
      totals: {
        given: gifts.reduce((sum, e) => sum + e.amount, 0),
        giftCount: gifts.length,
        paid: settled.reduce((sum, e) => sum + e.amount, 0),
        churchesGivenTo: new Set(gifts.map((e) => e.church?.slug).filter(Boolean)).size,
        currency: settled[0]?.currency ?? 'USD',
      },
    },
  });
});

/* --- where you are expected --------------------------------------------- */

/**
 * Interviews across every application, not buried inside one of them.
 *
 * The calendar export already exists at /interviews/:id/calendar.ics, so this
 * only has to say which interviews there are.
 */
export const interviews = asyncHandler(async (req, res) => {
  const booked = await Interview.find({
    userId: req.user._id,
    status: { $in: ['scheduled', 'rescheduled', 'completed'] },
  }).sort({ scheduledFor: 1 });

  const [applications, churchBy] = await Promise.all([
    Application.find({ _id: { $in: booked.map((i) => i.applicationId) } }, 'reference offeringTitle offeringSlug'),
    churchIndex(),
  ]);
  const appBy = Object.fromEntries(applications.map((a) => [String(a._id), a]));

  const now = new Date();
  const shaped = booked.map((i) => {
    const application = appBy[String(i.applicationId)] ?? null;
    return {
      id: String(i._id),
      scheduledFor: i.scheduledFor,
      timezone: i.timezone,
      durationMinutes: i.durationMinutes,
      provider: i.provider,
      joinUrl: i.joinUrl,
      dialIn: i.dialIn,
      location: i.location,
      instructions: i.instructions,
      panelNames: i.panelNames ?? [],
      status: i.status,
      outcome: i.outcome ?? null,
      past: Boolean(i.scheduledFor && new Date(i.scheduledFor) < now),
      church: churchBy[i.churchSlug] ?? null,
      reference: application?.reference ?? null,
      offeringTitle: application?.offeringTitle ?? null,
      calendarUrl: `/api/interviews/${i._id}/calendar.ics`,
    };
  });

  res.json({
    success: true,
    data: {
      upcoming: shaped.filter((i) => !i.past && i.status !== 'completed'),
      past: shaped.filter((i) => i.past || i.status === 'completed').reverse(),
    },
  });
});
