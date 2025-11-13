import { Router } from 'express'
import { Institution } from '../../models/Institution.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

const serialize = (doc) => ({
  id: doc._id,
  kind: doc.kind,
  titleEn: doc.titleEn,
  titleHi: doc.titleHi,
  descriptionEn: doc.descriptionEn,
  descriptionHi: doc.descriptionHi,
  addressEn: doc.addressEn,
  addressHi: doc.addressHi,
  state: doc.state,
  district: doc.district,
  city: doc.city,
  pin: doc.pin,
  amenities: doc.amenities,
  contact: doc.contact,
  images: doc.images,
  addressEn: doc.addressEn,
  addressHi: doc.addressHi,
  published: !!doc.published,
  approved: !!doc.approved,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
})

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { kind, published, search } = req.query
  const filter = {}
  if (kind) filter.kind = kind
  if (published === 'true') filter.published = true
  if (published === 'false') filter.published = false
  if (search) {
    const regex = new RegExp(search, 'i')
    filter.$or = [{ titleEn: regex }, { titleHi: regex }, { city: regex }, { state: regex }]
  }
  const list = await Institution.find(filter).sort('-createdAt')
  res.json({ data: list.map(serialize) })
}))

// Admin-created entries can be approved immediately.
router.post('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  if (!body.titleEn || !body.kind) {
    return res.status(400).json({ error: 'Title and kind required' })
  }
  const doc = await Institution.create({ ...body, approved: body.approved ?? true })
  await logAudit({
    admin: req.admin,
    entityType: 'institution',
    entityId: doc._id,
    action: 'create',
    summary: `Created ${doc.kind} ${doc.titleEn}`,
    after: serialize(doc)
  })
  res.status(201).json({ data: serialize(doc) })
}))

router.patch('/:id', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const doc = await Institution.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Not found' })
  const before = serialize(doc)
  Object.assign(doc, req.body)
  await doc.save()
  await logAudit({
    admin: req.admin,
    entityType: 'institution',
    entityId: doc._id,
    action: 'update',
    summary: `Updated ${doc.kind} ${doc.titleEn}`,
    before,
    after: serialize(doc)
  })
  res.json({ data: serialize(doc) })
}))

// ✅ Publish also auto-approves unless explicitly overridden
router.patch('/:id/publish', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const doc = await Institution.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Not found' })
  const before = serialize(doc)

  const wantPublished = !!req.body.published
  doc.published = wantPublished

  if (req.body.approved !== undefined) {
    doc.approved = !!req.body.approved
  } else if (wantPublished) {
    doc.approved = true
  }

  await doc.save()
  await logAudit({
    admin: req.admin,
    entityType: 'institution',
    entityId: doc._id,
    action: 'status',
    summary: `Updated publish ${doc.published} approved ${doc.approved}`,
    before,
    after: serialize(doc)
  })
  res.json({ data: serialize(doc) })
}))

// explicit approve toggle (used by admin UI quick action)
router.patch('/:id/approve', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const doc = await Institution.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Not found' })
  const before = serialize(doc)
  doc.approved = !!req.body.approved
  await doc.save()
  await logAudit({
    admin: req.admin,
    entityType: 'institution',
    entityId: doc._id,
    action: 'status',
    summary: `Updated approve ${doc.approved}`,
    before,
    after: serialize(doc)
  })
  res.json({ data: serialize(doc) })
}))

router.delete('/:id', requireRole('SUPER_ADMIN'), ah(async (req, res) => {
  const doc = await Institution.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Not found' })
  await doc.deleteOne()
  await logAudit({
    admin: req.admin,
    entityType: 'institution',
    entityId: doc._id,
    action: 'delete',
    summary: `Deleted ${doc.kind} ${doc.titleEn}`,
    before: serialize(doc)
  })
  res.status(204).end()
}))

export default router
