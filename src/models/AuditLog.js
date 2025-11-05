// backend/src/models/AuditLog.js
import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema({
  actorAdminId: { type: mongoose.Types.ObjectId, ref: 'Admin' },
  actorUserId: { type: mongoose.Types.ObjectId, ref: 'User' },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  action: { type: String, enum: ['create', 'update', 'delete', 'status', 'login', 'logout', 'export', 'import'], required: true },
  summary: { type: String },
  before: { type: Object },
  after: { type: Object },
  metadata: { type: Object }
}, { timestamps: true })

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })
auditLogSchema.index({ actorAdminId: 1, createdAt: -1 })

auditLogSchema.statics.record = async function ({ actorAdminId, actorUserId, entityType, entityId, action, summary, before, after, metadata }) {
  return this.create({ actorAdminId, actorUserId, entityType, entityId, action, summary, before, after, metadata })
}

export const AuditLog = mongoose.model('AuditLog', auditLogSchema)
