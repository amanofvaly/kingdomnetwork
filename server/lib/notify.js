import { ChurchMembership } from '../models/ChurchMembership.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

import { link, mailer } from './mailer/index.js';

/**
 * Telling someone something happened.
 *
 * Every notification is written to the database whether or not it is emailed,
 * so the bell in the header and the record of what was sent are the same thing.
 * Nothing here throws: failing to notify must never roll back the action being
 * notified about.
 */

const deliver = async (notification, user) => {
  if (!notification.email?.wanted) return;

  const to = notification.email.to ?? user?.email;
  if (!to) {
    notification.email.status = 'skipped';
    await notification.save();
    return;
  }

  const result = await mailer.send({
    to,
    subject: notification.title,
    text: [notification.body, notification.link ? `\n${link(notification.link)}` : ''].filter(Boolean).join('\n'),
  });

  notification.email.status = result.ok ? 'sent' : 'failed';
  notification.email.sentAt = result.ok ? new Date() : undefined;
  notification.email.error = result.ok ? undefined : result.error;
  await notification.save();
};

export const notify = {
  /** One person. */
  async user(userId, { kind, title, body, link: target, email = true, prefKey }) {
    try {
      const user = await User.findById(userId, 'email notificationPrefs');
      if (!user) return null;

      // A preference only ever silences the email. The in-app record still exists.
      const wantsEmail = email && (prefKey ? user.notificationPrefs?.[prefKey] !== false : true);

      const notification = await Notification.create({
        userId,
        kind,
        title,
        body,
        link: target,
        email: { wanted: wantsEmail, to: user.email },
      });

      await deliver(notification, user);
      return notification;
    } catch (err) {
      console.error('[kingdom-network] notify.user failed:', err.message);
      return null;
    }
  },

  /**
   * Everyone who administers a church. Used for things a church must act on —
   * a new application, a booked interview, a gift received.
   */
  async church(churchSlug, { kind, title, body, link: target, roles, email = true }) {
    try {
      const filter = { churchSlug, status: 'active' };
      if (roles?.length) filter.role = { $in: roles };

      const memberships = await ChurchMembership.find(filter, 'userId').lean();
      const results = [];

      for (const membership of memberships) {
        if (!membership.userId) continue;
        results.push(await this.user(membership.userId, { kind, title, body, link: target, email }));
      }
      return results;
    } catch (err) {
      console.error('[kingdom-network] notify.church failed:', err.message);
      return [];
    }
  },

  /** Every platform administrator. */
  async platform({ kind, title, body, link: target }) {
    try {
      const admins = await User.find({ role: 'platform_admin' }, '_id').lean();
      for (const admin of admins) {
        await this.user(admin._id, { kind, title, body, link: target });
      }
    } catch (err) {
      console.error('[kingdom-network] notify.platform failed:', err.message);
    }
  },
};

export const listNotifications = async (userId, { unreadOnly = false, limit = 30 } = {}) =>
  Notification.find({ userId, ...(unreadOnly ? { readAt: null } : {}) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
