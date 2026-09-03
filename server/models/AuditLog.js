import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: String,
    churchSlug: { type: String, index: true },

    action: { type: String, required: true, index: true },
    entity: { type: String, index: true },
    entityId: { type: String, index: true },

    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    note: String,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditSchema);
