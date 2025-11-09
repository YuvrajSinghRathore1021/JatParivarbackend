// backend/src/routes/admin/founders.routes.js
import { Router } from 'express'
import { Person } from '../../models/Person.js'
import { User } from '../../models/User.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'
import { ensurePersonForUser, pruneDuplicatePersonsForRole } from '../../utils/personSync.js'

const router = Router()

const USER_PROJECTION = 'name displayName avatarUrl phone status role referralCode address publicNote planTitle planAmount'

const serialize = (doc) => {
  const user = doc.userId && typeof doc.userId === 'object' && doc.userId !== null ? doc.userId : null
  const name = doc.name || user?.displayName || user?.name || ''
  return {
    id: doc._id,
    userId: user?._id || doc.userId,
    role: doc.role,
    name,
    title: doc.title,
  designation: doc.designation,
    photo: doc.photo || user?.avatarUrl || null,
    bannerUrl: doc.bannerUrl || null,
    place: doc.place || user?.address?.city || '',
    publicNote: doc.publicNote || user?.publicNote || '',
    bioEn: doc.bioEn,
    bioHi: doc.bioHi,
  visible: doc.visible,
    order: doc.order,
    socials: doc.socials,
  createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    user: user ? {
      id: user._id,
      name: user.name,
      displayName: user.displayName,
      phone: user.phone,
      status: user.status,
      role: user.role,
      referralCode: user.referralCode,
      planTitle: user.planTitle,
      planAmount: user.planAmount
    } : null
  }
}

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { role = 'founder', search } = req.query
  const normalizedRole = role === 'management' ? 'management' : 'founder'
  const targetUserRole = normalizedRole === 'founder' ? 'founder' : 'member'
  const filter = { role: normalizedRole }
  await pruneDuplicatePersonsForRole(normalizedRole)

  let list = await Person.find(filter)
    .sort({ order: 1, createdAt: -1 })
    .populate('userId', USER_PROJECTION)

  const personUserIds = new Set(
    list
      .map((doc) => {
        const user = doc.userId && typeof doc.userId === 'object' ? doc.userId : null
        return user?._id?.toString()
      })
      .filter(Boolean)
  )

  const missingUsers = await User.find({
    role: targetUserRole,
    _id: { $nin: Array.from(personUserIds) }
  })

  if (missingUsers.length > 0) {
    await Promise.all(missingUsers.map((user) => ensurePersonForUser(user)))
    list = await Person.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .populate('userId', USER_PROJECTION)
  }

  const deduped = []
  const seenUserIds = new Set()
  for (const doc of list) {
    const uid = doc.userId && typeof doc.userId === 'object'
      ? doc.userId._id?.toString()
      : doc.userId?.toString?.()
    if (uid) {
      if (seenUserIds.has(uid)) continue
      seenUserIds.add(uid)
    }
    deduped.push(doc)
  }

  let results = deduped
  if (search) {
    const regex = new RegExp(search, 'i')
    results = list.filter((doc) => {
      const user = doc.userId && typeof doc.userId === 'object' ? doc.userId : null
      return (
        regex.test(doc.name || '') ||
        regex.test(doc.title || '') ||
        regex.test(doc.designation || '') ||
        regex.test(doc.place || '') ||
        (user?.displayName && regex.test(user.displayName)) ||
        (user?.name && regex.test(user.name)) ||
        (user?.phone && regex.test(user.phone))
      )
    })
  }

  res.json({ data: results.map(serialize) })
}))

router.post('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  if (!body.name) return res.status(400).json({ error: 'Name required' })
  const doc = await Person.create(body)
  await syncLinkedUser(doc, body)
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
  await syncLinkedUser(doc, req.body)
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

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key)

const syncLinkedUser = async (person, payload = {}) => {
  if (!person?.userId) return
  const update = {}
  if (hasOwn(payload, 'photo')) {
    update.avatarUrl = person.photo || ''
  }
  if (Object.keys(update).length === 0) return
  await User.findByIdAndUpdate(person.userId, { $set: update })
}
