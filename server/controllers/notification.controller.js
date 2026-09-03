import { asyncHandler } from '../middleware/asyncHandler.js';
import { listNotifications } from '../lib/notify.js';
import { Notification } from '../models/Notification.js';

export const list = asyncHandler(async (req, res) => {
  const [notifications, unread] = await Promise.all([
    listNotifications(req.user._id, { unreadOnly: req.query.unread === 'true' }),
    Notification.countDocuments({ userId: req.user._id, readAt: null }),
  ]);

  res.json({ success: true, data: { notifications, unread } });
});

export const markRead = asyncHandler(async (req, res) => {
  // No ids means everything; otherwise only the ones named, and only this
  // person's — an id from someone else's list matches nothing.
  const filter = { userId: req.user._id, readAt: null };
  if (Array.isArray(req.body?.ids) && req.body.ids.length) filter._id = { $in: req.body.ids };

  const result = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  res.json({ success: true, data: { marked: result.modifiedCount } });
});
