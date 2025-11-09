// backend/src/routes/admin/history.routes.js
import { Router } from 'express'
import { HistoryItem } from '../../models/HistoryItem.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

const serialize = (item) => ({
  id: item._id,
  category: item.category,
  year: item.year,
  order: item.order,
  titleEn: item.titleEn,
  titleHi: item.titleHi,
  bodyEn: item.bodyEn,
  bodyHi: item.bodyHi,
  imageUrl: item.imageUrl,
  published: item.published,
  publishedAt: item.publishedAt,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
})

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { category, status } = req.query
  const filter = {}
  if (category) filter.category = category
  if (status === 'published') filter.published = true
  if (status === 'draft') filter.published = false
  const items = await HistoryItem.find(filter).sort({ order: 1, year: 1, createdAt: -1 })
  res.json({ data: items.map(serialize) })
}))

router.post('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  if (!body.titleEn) return res.status(400).json({ error: 'titleEn required' })
  const item = await HistoryItem.create({ ...body, createdBy: req.admin._id })
  await logAudit({
    admin: req.admin,
    entityType: 'history',
    entityId: item._id,
    action: 'create',
    summary: `Created history item ${item.titleEn}`,
    after: serialize(item)
  })
  res.status(201).json({ data: serialize(item) })
}))

router.patch('/:id', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const item = await HistoryItem.findById(req.params.id)
  if (!item) return res.status(404).json({ error: 'History not found' })
  const before = serialize(item)
  Object.assign(item, req.body)
  if (req.body.published === true && !item.publishedAt) {
    item.publishedAt = new Date()
  }
  if (req.body.published === false) {
    item.publishedAt = null
  }
  await item.save()
  await logAudit({
    admin: req.admin,
    entityType: 'history',
    entityId: item._id,
    action: 'update',
    summary: `Updated history item ${item.titleEn}`,
    before,
    after: serialize(item)
  })
  res.json({ data: serialize(item) })
}))

router.delete('/:id', requireRole('SUPER_ADMIN'), ah(async (req, res) => {
  const item = await HistoryItem.findById(req.params.id)
  if (!item) return res.status(404).json({ error: 'History not found' })
  await item.deleteOne()
  await logAudit({
    admin: req.admin,
    entityType: 'history',
    entityId: item._id,
    action: 'delete',
    summary: `Deleted history item ${item.titleEn}`,
    before: serialize(item)
  })
  res.status(204).end()
}))

export default router
