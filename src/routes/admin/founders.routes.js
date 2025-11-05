// backend/src/routes/admin/founders.routes.js
import { Router } from 'express'
import { Person } from '../../models/Person.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

const serialize = (doc) => ({
  id: doc._id,
  role: doc.role,
  name: doc.name,
  title: doc.title,
  designation: doc.designation,
  photo: doc.photo,
  place: doc.place,
  publicNote: doc.publicNote,
  bioEn: doc.bioEn,
  bioHi: doc.bioHi,
  visible: doc.visible,
  order: doc.order,
  socials: doc.socials,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
})

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { role = 'founder', search } = req.query
  const filter = { role }
  if (search) {
    filter.name = new RegExp(search, 'i')
  }
  const list = await Person.find(filter).sort({ order: 1, createdAt: -1 })
  res.json({ data: list.map(serialize) })
}))

router.post('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  if (!body.name) return res.status(400).json({ error: 'Name required' })
  const doc = await Person.create(body)
  await logAudit({
    admin: req.admin,
    entityType: body.role || 'founder',
    entityId: doc._id,
    action: 'create',
    summary: `Created ${body.role || 'founder'} ${doc.name}`,
    after: serialize(doc)
  })
  res.status(201).json({ data: serialize(doc) })
}))

router.patch('/:id', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const doc = await Person.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Record not found' })
  const before = serialize(doc)
  Object.assign(doc, req.body)
  await doc.save()
  await logAudit({
    admin: req.admin,
    entityType: doc.role,
    entityId: doc._id,
    action: 'update',
    summary: `Updated ${doc.role} ${doc.name}`,
    before,
    after: serialize(doc)
  })
  res.json({ data: serialize(doc) })
}))

router.patch('/:id/visibility', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const doc = await Person.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Record not found' })
  const before = serialize(doc)
  doc.visible = !!req.body.visible
  await doc.save()
  await logAudit({
    admin: req.admin,
    entityType: doc.role,
    entityId: doc._id,
    action: 'status',
    summary: `Toggled visibility to ${doc.visible}`,
    before,
    after: serialize(doc)
  })
  res.json({ data: serialize(doc) })
}))

router.delete('/:id', requireRole('SUPER_ADMIN'), ah(async (req, res) => {
  const doc = await Person.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Record not found' })
  await doc.deleteOne()
  await logAudit({
    admin: req.admin,
    entityType: doc.role,
    entityId: doc._id,
    action: 'delete',
    summary: `Deleted ${doc.role} ${doc.name}`,
    before: serialize(doc)
  })
  res.status(204).end()
}))

export default router
