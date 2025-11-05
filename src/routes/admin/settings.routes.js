// backend/src/routes/admin/settings.routes.js
import { Router } from 'express'
import { Setting } from '../../models/Setting.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const settings = await Setting.find({})
  const data = {}
  for (const setting of settings) {
    data[setting.key] = setting.value
  }
  res.json({ data })
}))

router.patch('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const updates = req.body || {}
  const entries = Object.entries(updates)
  const results = {}
  for (const [key, value] of entries) {
    const doc = await Setting.findOneAndUpdate({ key }, { value, updatedBy: req.admin._id }, { new: true, upsert: true })
    results[key] = doc.value
    await logAudit({
      admin: req.admin,
      entityType: 'setting',
      entityId: doc._id,
      action: 'update',
      summary: `Updated setting ${key}`,
      after: doc.value
    })
  }
  res.json({ data: results })
}))

export default router