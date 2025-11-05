// backend/src/routes/admin/achievements.routes.js
import { Router } from 'express'
import { Achievement } from '../../models/Achievement.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

const serialize = (item) => ({
  id: item._id,
  textEn: item.textEn,
  textHi: item.textHi,
  order: item.order,
  active: item.active,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
})

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const items = await Achievement.find({}).sort({ order: 1, createdAt: 1 })
  res.json({ data: items.map(serialize) })
}))

router.post('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  if (!body.textEn) return res.status(400).json({ error: 'textEn required' })
  const doc = await Achievement.create(body)
  await logAudit({
    admin: req.admin,
    entityType: 'achievement',
    entityId: doc._id,
    action: 'create',
    summary: 'Created achievement',
    after: serialize(doc)
  })
  res.status(201).json({ data: serialize(doc) })
}))

router.patch('/:id', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const doc = await Achievement.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Not found' })
  const before = serialize(doc)
  Object.assign(doc, req.body)
  await doc.save()
  await logAudit({
    admin: req.admin,
    entityType: 'achievement',
    entityId: doc._id,
    action: 'update',
    summary: 'Updated achievement',
    before,
    after: serialize(doc)
  })
  res.json({ data: serialize(doc) })
}))

router.delete('/:id', requireRole('SUPER_ADMIN'), ah(async (req, res) => {
  const doc = await Achievement.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Not found' })
  await doc.deleteOne()
  await logAudit({
    admin: req.admin,
    entityType: 'achievement',
    entityId: doc._id,
    action: 'delete',
    summary: 'Deleted achievement',
    before: serialize(doc)
  })
  res.status(204).end()
}))

router.post('/reorder', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' })
  await Promise.all(ids.map((id, index) => Achievement.findByIdAndUpdate(id, { order: index })))
  res.status(204).end()
}))

export default router
