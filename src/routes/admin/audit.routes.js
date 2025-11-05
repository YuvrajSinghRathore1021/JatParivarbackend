// backend/src/routes/admin/audit.routes.js
import { Router } from 'express'
import { AuditLog } from '../../models/AuditLog.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'

const router = Router()

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN', 'FINANCE_ADMIN'), ah(async (req, res) => {
  const { page = 1, pageSize = 20, entityType, actorAdminId } = req.query
  const filter = {}
  if (entityType) filter.entityType = entityType
  if (actorAdminId) filter.actorAdminId = actorAdminId
  const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10)
  const [rows, total] = await Promise.all([
    AuditLog.find(filter).sort('-createdAt').skip(skip).limit(parseInt(pageSize, 10)),
    AuditLog.countDocuments(filter)
  ])
  res.json({
    data: rows,
    meta: {
      total,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10)
    }
  })
}))

export default router
