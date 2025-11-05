// backend/src/utils/audit.js
import { AuditLog } from '../models/AuditLog.js'

export const logAudit = async ({ admin, user, entityType, entityId, action, summary, before, after, metadata }) => {
  return AuditLog.record({
    actorAdminId: admin ? admin._id : undefined,
    actorUserId: user ? user._id : undefined,
    entityType,
    entityId: entityId?.toString?.() || entityId,
    action,
    summary,
    before,
    after,
    metadata
  })
}