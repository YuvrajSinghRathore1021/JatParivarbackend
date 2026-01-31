// backend/src/routes/admin/admins.routes.js
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { Admin } from '../../models/Admin.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

const serializeAdmin = (admin) => ({
  id: admin._id,
  phone: admin.phone,
  email: admin.email,
  name: admin.name,
  roles: admin.roles,
  status: admin.status,
  mustChangePassword: admin.mustChangePassword,
  lastLoginAt: admin.lastLoginAt,
  createdAt: admin.createdAt,
  updatedAt: admin.updatedAt,
})

const allowedRoles = new Set(['SUPER_ADMIN', 'CONTENT_ADMIN', 'FINANCE_ADMIN'])

const normalizePhone = (value) => (value || '').toString().trim()

router.get('/', requireRole('SUPER_ADMIN'), ah(async (_req, res) => {
  const admins = await Admin.find({ deletedAt: { $exists: false } })
    .sort({ createdAt: -1 })
    .lean()
  res.json({ admins: admins.map((a) => serializeAdmin(a)) })
}))

router.post('/', requireRole('SUPER_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  const phone = normalizePhone(body.phone)
  const name = (body.name || '').toString().trim()
  const password = (body.password || '').toString()

  if (!phone || !name || !password) {
    return res.status(400).json({ error: 'Phone, name, and password are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password too short' })
  }

  const roles = Array.isArray(body.roles) && body.roles.length
    ? Array.from(new Set(body.roles.map((r) => String(r).trim()).filter((r) => allowedRoles.has(r))))
    : ['SUPER_ADMIN']

  const existing = await Admin.findOne({ phone })
  if (existing && !existing.deletedAt) {
    return res.status(400).json({ error: 'Phone already in use' })
  }
  if (existing && existing.deletedAt) {
    existing.name = name
    existing.email = body.email ? String(body.email).trim() : undefined
    existing.roles = roles
    existing.status = 'active'
    existing.mustChangePassword = true
    existing.passwordHash = await bcrypt.hash(password, 10)
    existing.sessionVersion += 1
    existing.deletedAt = undefined
    await existing.save()

    await logAudit({
      admin: req.admin,
      entityType: 'admin',
      entityId: existing._id.toString(),
      action: 'update',
      summary: `Restored admin ${existing.phone}`,
      after: serializeAdmin(existing),
    })

    return res.status(200).json({ admin: serializeAdmin(existing) })
  }

  const admin = await Admin.create({
    phone,
    name,
    email: body.email ? String(body.email).trim() : undefined,
    roles,
    status: 'active',
    mustChangePassword: true,
    passwordHash: await bcrypt.hash(password, 10),
  })

  await logAudit({
    admin: req.admin,
    entityType: 'admin',
    entityId: admin._id.toString(),
    action: 'create',
    summary: `Created admin ${admin.phone}`,
  })

  res.status(201).json({ admin: serializeAdmin(admin) })
}))

router.patch('/:id', requireRole('SUPER_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  const admin = await Admin.findById(req.params.id)
  if (!admin || admin.deletedAt) return res.status(404).json({ error: 'Admin not found' })

  // Prevent locking yourself out accidentally.
  if (req.admin && admin._id.toString() === req.admin._id.toString()) {
    if (body.status && body.status !== 'active') {
      return res.status(400).json({ error: 'Cannot change your own status' })
    }
    if (body.deletedAt) {
      return res.status(400).json({ error: 'Cannot delete your own admin' })
    }
  }

  const before = serializeAdmin(admin)

  if (typeof body.name === 'string') admin.name = body.name.trim()
  if (typeof body.email === 'string') admin.email = body.email.trim()
  if (typeof body.status === 'string') {
    if (!['active', 'suspended'].includes(body.status)) return res.status(400).json({ error: 'Invalid status' })
    admin.status = body.status
  }
  if (Array.isArray(body.roles)) {
    const next = Array.from(new Set(body.roles.map((r) => String(r).trim()).filter((r) => allowedRoles.has(r))))
    admin.roles = next.length ? next : ['SUPER_ADMIN']
  }
  if (body.password) {
    const password = String(body.password)
    if (password.length < 8) return res.status(400).json({ error: 'Password too short' })
    admin.passwordHash = await bcrypt.hash(password, 10)
    admin.mustChangePassword = true
    admin.sessionVersion += 1
  }

  await admin.save()

  await logAudit({
    admin: req.admin,
    entityType: 'admin',
    entityId: admin._id.toString(),
    action: 'update',
    summary: `Updated admin ${admin.phone}`,
    before,
    after: serializeAdmin(admin),
  })

  res.json({ admin: serializeAdmin(admin) })
}))

router.delete('/:id', requireRole('SUPER_ADMIN'), ah(async (req, res) => {
  const admin = await Admin.findById(req.params.id)
  if (!admin || admin.deletedAt) return res.status(404).json({ error: 'Admin not found' })

  if (req.admin && admin._id.toString() === req.admin._id.toString()) {
    return res.status(400).json({ error: 'Cannot delete your own admin' })
  }

  const before = serializeAdmin(admin)
  admin.deletedAt = new Date()
  admin.status = 'suspended'
  admin.sessionVersion += 1
  await admin.save()

  await logAudit({
    admin: req.admin,
    entityType: 'admin',
    entityId: admin._id.toString(),
    action: 'delete',
    summary: `Deleted admin ${admin.phone}`,
    before,
    after: serializeAdmin(admin),
  })

  res.status(204).end()
}))

export default router
