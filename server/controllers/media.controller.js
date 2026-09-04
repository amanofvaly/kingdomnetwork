import { asyncHandler } from '../middleware/asyncHandler.js';
import { audit } from '../lib/audit.js';
import { storage } from '../lib/storage/index.js';
import { describeAccepted, MAX_BYTES, readBody, storeUpload } from '../lib/upload.js';
import { Application } from '../models/Application.js';
import { ChurchMembership } from '../models/ChurchMembership.js';
import { Enrollment } from '../models/Enrollment.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { Resource } from '../models/Resource.js';

/**
 * The church's media library, and the one route every stored file is read
 * through.
 *
 * Files are never served from a static directory. A church's cover photograph
 * and an applicant's passport scan sit in the same store, and the difference
 * between them is a field on the record — so the check has to happen on read,
 * in one place, rather than being a property of where the file was written.
 */

const CARD = 'kind mimeType filename bytes width height durationSeconds title alt tags folder visibility storageKey createdAt';

const shape = (asset) => ({
  id: asset._id,
  kind: asset.kind,
  mimeType: asset.mimeType,
  filename: asset.filename,
  bytes: asset.bytes,
  width: asset.width,
  height: asset.height,
  durationSeconds: asset.durationSeconds,
  title: asset.title,
  alt: asset.alt,
  tags: asset.tags,
  folder: asset.folder,
  visibility: asset.visibility,
  url: `/api/media/file/${asset.storageKey}`,
  createdAt: asset.createdAt,
});

export const list = asyncHandler(async (req, res) => {
  const { kind, folder, q, page = '1', limit = '40' } = req.query;

  const filter = { churchSlug: req.church.slug, visibility: 'public' };
  if (kind) filter.kind = kind;
  if (folder) filter.folder = folder;
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ filename: rx }, { title: rx }, { alt: rx }, { tags: rx }];
  }

  const perPage = Math.min(Number(limit) || 40, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

  const [assets, total, folders] = await Promise.all([
    MediaAsset.find(filter, CARD).sort({ createdAt: -1 }).skip(skip).limit(perPage),
    MediaAsset.countDocuments(filter),
    MediaAsset.aggregate([
      { $match: { churchSlug: req.church.slug, visibility: 'public' } },
      { $group: { _id: '$folder', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      assets: assets.map(shape),
      total,
      page: Number(page) || 1,
      pages: Math.ceil(total / perPage),
      folders: folders.map((f) => ({ value: f._id, count: f.count })),
    },
  });
});

/**
 * The body is the file itself, with its name and destination in headers. A
 * multipart parser would buy nothing here — there is one file per request and
 * no other fields — and would add a dependency parsing untrusted input.
 */
export const upload = asyncHandler(async (req, res) => {
  const kind = String(req.get('x-media-kind') ?? 'image');
  const limit = MAX_BYTES[kind] ?? MAX_BYTES.image;

  const buffer = await readBody(req, limit);
  if (!buffer.length) {
    return res.status(400).json({ success: false, message: `No file was received. Upload ${describeAccepted()}.` });
  }

  const folder = String(req.get('x-media-folder') ?? 'general').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'general';

  const stored = await storeUpload({
    buffer,
    filename: req.get('x-filename'),
    churchSlug: req.church.slug,
    folder,
  });

  // The same file uploaded twice is the same file. Return the existing record
  // rather than filling the library with duplicates of one logo.
  const existing = await MediaAsset.findOne({ checksum: stored.checksum, churchSlug: req.church.slug });
  if (existing) return res.json({ success: true, data: shape(existing) });

  const asset = await MediaAsset.create({
    ...stored,
    storageKey: stored.key,
    churchSlug: req.church.slug,
    uploadedBy: req.user._id,
    folder,
    visibility: 'public',
    title: req.get('x-title') ? decodeURIComponent(req.get('x-title')).slice(0, 200) : undefined,
    alt: req.get('x-alt') ? decodeURIComponent(req.get('x-alt')).slice(0, 300) : undefined,
  });

  await audit(req, { action: 'media:upload', entity: 'MediaAsset', entityId: asset._id, after: { filename: asset.filename, bytes: asset.bytes } });

  res.status(201).json({ success: true, data: shape(asset) });
});

export const update = asyncHandler(async (req, res) => {
  const asset = await MediaAsset.findOne({ _id: req.params.id, churchSlug: req.church.slug });
  if (!asset) return res.status(404).json({ success: false, message: 'That file was not found.' });

  for (const key of ['title', 'alt', 'folder']) {
    if (typeof req.body?.[key] === 'string') asset[key] = req.body[key].trim().slice(0, 300);
  }
  if (Array.isArray(req.body?.tags)) {
    asset.tags = req.body.tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 20);
  }

  await asset.save();
  res.json({ success: true, data: shape(asset) });
});

export const remove = asyncHandler(async (req, res) => {
  const asset = await MediaAsset.findOne({ _id: req.params.id, churchSlug: req.church.slug });
  if (!asset) return res.status(404).json({ success: false, message: 'That file was not found.' });

  if (asset.usage?.length && !req.query.force) {
    return res.status(409).json({
      success: false,
      message: `This file is still used in ${asset.usage.length} place${asset.usage.length === 1 ? '' : 's'}.`,
      data: { usage: asset.usage },
    });
  }

  await storage.remove(asset.storageKey);
  await asset.deleteOne();
  await audit(req, { action: 'media:delete', entity: 'MediaAsset', entityId: asset._id, before: { filename: asset.filename } });

  res.json({ success: true, data: { deleted: true } });
});

/**
 * Serve a stored file.
 *
 * Public assets are cached hard, because the storage key contains a content
 * hash and therefore never points at different bytes. Private assets — every
 * document an applicant has uploaded — are readable only by the applicant, by
 * someone who administers the church assessing them, or by a platform
 * administrator, and are never cached by an intermediary.
 */
/**
 * A `Range` header, resolved against a known file size. Answers null when the
 * header is absent or in a form we do not serve; `unsatisfiable` when it asks
 * for bytes that are not there, which is a 416 rather than a quiet full body.
 *
 * Only the single-range `bytes=` form is handled. Multipart ranges are legal
 * and no browser asks for them.
 */
export const parseRange = (header, size) => {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  // A suffix range — "the last N bytes".
  if (rawStart === '') {
    const length = Number(rawEnd);
    if (!length) return { unsatisfiable: true };
    return { start: Math.max(0, size - length), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (start >= size || end < start) return { unsatisfiable: true };
  return { start, end };
};

export const serve = asyncHandler(async (req, res) => {
  const storageKey = req.params[0];
  const asset = await MediaAsset.findOne({ storageKey });
  if (!asset) return res.status(404).json({ success: false, message: 'That file was not found.' });

  if (asset.visibility === 'private') {
    const allowed = await canReadPrivate(req.user, asset);
    if (!allowed) return res.status(403).json({ success: false, message: 'That file is not yours.' });
    res.setHeader('Cache-Control', 'private, no-store');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  const info = await storage.stat(storageKey);
  if (!info) return res.status(404).json({ success: false, message: 'That file is no longer stored.' });

  res.setHeader('Content-Type', asset.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${asset.filename ?? 'file'}"`);
  // Nothing served from here is ever a page; stop a browser deciding otherwise.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Said even on a full response, so a player knows it may seek later.
  res.setHeader('Accept-Ranges', 'bytes');

  const range = parseRange(req.get('range'), info.bytes);

  if (range?.unsatisfiable) {
    res.setHeader('Content-Range', `bytes */${info.bytes}`);
    return res.status(416).end();
  }

  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${info.bytes}`);
    res.setHeader('Content-Length', range.end - range.start + 1);
    return storage.stream(storageKey, range).pipe(res);
  }

  res.setHeader('Content-Length', info.bytes);
  storage.stream(storageKey).pipe(res);
});

const canReadPrivate = async (user, asset) => {
  if (!user) return false;
  if (user.role === 'platform_admin') return true;
  if (String(asset.uploadedBy) === String(user._id)) return true;

  // The church assessing the application may read what was submitted to it.
  const membership = await ChurchMembership.findOne({ churchSlug: asset.churchSlug, userId: user._id, status: 'active' });
  if (membership && membership.can('applications:read')) return true;

  // And the applicant may always read their own file back.
  const usage = (asset.usage ?? []).find((u) => u.entity === 'Application');
  if (usage) {
    const application = await Application.findById(usage.entityId, 'userId');
    if (application && String(application.userId) === String(user._id)) return true;
  }

  // Someone who bought a book may read the book. The file a church sells is
  // private like any other, so without this the purchase bought nothing: the
  // enrolment was written and the file stayed unreachable.
  const sold = await Resource.findOne({ fileMediaIds: asset._id }, 'slug');
  if (sold) {
    const bought = await Enrollment.findOne({ userId: user._id, resourceSlug: sold.slug });
    if (bought) return true;
  }

  return false;
};
