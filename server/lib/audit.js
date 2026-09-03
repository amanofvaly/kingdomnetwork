import { AuditLog } from '../models/AuditLog.js';

/**
 * Who did what, to which record, and what changed. A platform that issues
 * ministerial standing has to be able to answer that question years later,
 * so issuance, revocation, waivers, decisions, settlements, role changes and
 * verification all write here.
 *
 * Never throws: an audit failure must not roll back the action it describes.
 */
export const audit = async (req, { action, entity, entityId, churchSlug, before, after, note }) => {
  try {
    await AuditLog.create({
      actorId: req?.user?._id ?? null,
      actorRole: req?.membership?.role ?? req?.user?.role ?? 'system',
      churchSlug: churchSlug ?? req?.church?.slug ?? null,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      before,
      after,
      note,
      ip: req?.ip,
    });
  } catch (err) {
    console.error('[kingdom-network] audit write failed:', err.message);
  }
};
