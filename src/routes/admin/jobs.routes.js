import { Router } from 'express'
import { JobPost } from '../../models/JobPost.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

const serialize = (doc) => ({
  id: doc._id,
  userId: doc.userId,
  title: doc.title,
  description: doc.description,
  locationState: doc.locationState,
  locationCity: doc.locationCity,
  type: doc.type,
  salaryRange: doc.salaryRange,
  contactPhone: doc.contactPhone,
  approved: !!doc.approved,
  published: !!doc.published,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
})

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { approved, published, search } = req.query
  const filter = {}
  if (approved === 'true') filter.approved = true
  if (approved === 'false') filter.approved = false
  if (published === 'true') filter.published = true
  if (published === 'false') filter.published = false
  if (search) {
    const regex = new RegExp(search, 'i')
    filter.$or = [
      { title: regex },
      { locationCity: regex },
      { locationState: regex },
      { salaryRange: regex },
      { type: regex }
    ]
  }
  const list = await JobPost.find(filter).sort('-createdAt')
  res.json({ data: list.map(serialize) })
}))

router.post('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  if (!body.title) return res.status(400).json({ error: 'title required' })
  const approved = body.approved ?? !!body.published ?? true
  const doc = await JobPost.create({ ...body, approved })
  await logAudit({ admin: req.admin, entityType: 'job', entityId: doc._id, action: 'create', summary: `Created job ${doc.title}`, after: serialize(doc) })
  res.status(201).json({ data: serialize(doc) })
}))

router.patch('/:id', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const doc = await JobPost.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Job not found' })
  const before = serialize(doc)
  Object.assign(doc, req.body)
  if (req.body.published === true) doc.approved = true
  await doc.save()
  await logAudit({ admin: req.admin, entityType: 'job', entityId: doc._id, action: 'update', summary: `Updated job ${doc.title}`, before, after: serialize(doc) })
  res.json({ data: serialize(doc) })
}))

router.patch('/:id/approve', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const doc = await JobPost.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Job not found' })
  const before = serialize(doc)
  doc.approved = !!req.body.approved
  await doc.save()
  await logAudit({ admin: req.admin, entityType: 'job', entityId: doc._id, action: 'status', summary: `Approved = ${doc.approved}`, before, after: serialize(doc) })
  res.json({ data: serialize(doc) })
}))

router.patch('/:id/publish', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const doc = await JobPost.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Job not found' })
  const before = serialize(doc)
  const want = !!req.body.published
  doc.published = want
  if (want) doc.approved = true
  await doc.save()
  await logAudit({ admin: req.admin, entityType: 'job', entityId: doc._id, action: 'status', summary: `Published = ${doc.published}, Approved = ${doc.approved}`, before, after: serialize(doc) })
  res.json({ data: serialize(doc) })
}))

router.delete('/:id', requireRole('SUPER_ADMIN'), ah(async (req, res) => {
  const doc = await JobPost.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Job not found' })
  await doc.deleteOne()
  await logAudit({ admin: req.admin, entityType: 'job', entityId: doc._id, action: 'delete', summary: `Deleted job ${doc.title}`, before: serialize(doc) })
  res.status(204).end()
}))

export default router
