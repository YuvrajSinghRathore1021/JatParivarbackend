// backend/src/routes/admin/news.routes.js
import { Router } from 'express'
import { NewsItem } from '../../models/NewsItem.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

const slugify = (value = '') =>
  value.toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `news-${Date.now()}`

const serialize = (item) => ({
  id: item._id,
  slug: item.slug,
  titleEn: item.titleEn,
  titleHi: item.titleHi,
  excerptEn: item.excerptEn,
  excerptHi: item.excerptHi,
  bodyEn: item.bodyEn,
  bodyHi: item.bodyHi,
  heroImageUrl: item.heroImageUrl,
  published: item.published,
  publishedAt: item.publishedAt,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
})

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { status, search } = req.query
  const filter = {}
  if (status === 'published') filter.published = true
  if (status === 'draft') filter.published = false
  if (search) filter.titleEn = new RegExp(search, 'i')
  const items = await NewsItem.find(filter).sort('-createdAt')
  res.json({ data: items.map(serialize) })
}))

router.post('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  if (!body.titleEn) return res.status(400).json({ error: 'titleEn required' })
  body.slug = body.slug || slugify(body.titleEn)
  const item = await NewsItem.create({ ...body, createdBy: req.admin._id })
  await logAudit({
    admin: req.admin,
    entityType: 'news',
    entityId: item._id,
    action: 'create',
    summary: `Created news ${item.titleEn}`,
    after: serialize(item)
  })
  res.status(201).json({ data: serialize(item) })
}))

router.patch('/:id', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const item = await NewsItem.findById(req.params.id)
  if (!item) return res.status(404).json({ error: 'News not found' })
  const before = serialize(item)
  Object.assign(item, req.body)
  if (req.body.titleEn && !req.body.slug) {
    item.slug = slugify(req.body.titleEn)
  }
  if (req.body.published === true && !item.publishedAt) {
    item.publishedAt = new Date()
  }
  if (req.body.published === false) {
    item.publishedAt = null
  }
  await item.save()
  await logAudit({
    admin: req.admin,
    entityType: 'news',
    entityId: item._id,
    action: 'update',
    summary: `Updated news ${item.titleEn}`,
    before,
    after: serialize(item)
  })
  res.json({ data: serialize(item) })
}))

router.delete('/:id', requireRole('SUPER_ADMIN'), ah(async (req, res) => {
  const item = await NewsItem.findById(req.params.id)
  if (!item) return res.status(404).json({ error: 'News not found' })
  await item.deleteOne()
  await logAudit({
    admin: req.admin,
    entityType: 'news',
    entityId: item._id,
    action: 'delete',
    summary: `Deleted news ${item.titleEn}`,
    before: serialize(item)
  })
  res.status(204).end()
}))

export default router
