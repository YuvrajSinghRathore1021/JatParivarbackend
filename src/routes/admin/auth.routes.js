// backend/src/routes/admin/auth.routes.js
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { Admin } from '../../models/Admin.js'
import { AuditLog } from '../../models/AuditLog.js'
import { ah } from '../../utils/asyncHandler.js'
import { signAdminToken } from '../../utils/adminTokens.js'
import { adminAuth } from '../../middleware/adminAuth.js'

const router = Router()

const serializeAdmin = (admin) => ({
  id: admin._id,
  phone: admin.phone,
  email: admin.email,
  name: admin.name,
  roles: admin.roles,
  status: admin.status,
  lastLoginAt: admin.lastLoginAt,
  createdAt: admin.createdAt,
  updatedAt: admin.updatedAt
})

router.post('/login', ah(async (req, res) => {
  const { phone, password, otp } = req.body
  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password required' })
  }
  const admin = await Admin.findOne({ phone })
  if (!admin || admin.status !== 'active' || admin.deletedAt) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  const ok = await admin.comparePassword(password)
  if (!ok) {
    await AuditLog.record({
      actorAdminId: admin._id,
      entityType: 'admin',
      entityId: admin._id.toString(),
      action: 'login',
      summary: 'Failed admin login'
    })
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  admin.lastLoginAt = new Date()
  await admin.save()
  await AuditLog.record({
    actorAdminId: admin._id,
    entityType: 'admin',
    entityId: admin._id.toString(),
    action: 'login',
    summary: 'Admin login success'
  })
  const token = signAdminToken(admin)
  res.json({ token, admin: serializeAdmin(admin) })
}))

router.post('/logout', adminAuth, ah(async (req, res) => {
  req.admin.sessionVersion += 1
  await req.admin.save()
  await AuditLog.record({
    actorAdminId: req.admin._id,
    entityType: 'admin',
    entityId: req.admin._id.toString(),
    action: 'logout',
    summary: 'Admin logout'
  })
  res.status(204).end()
}))

router.get('/me', adminAuth, ah(async (req, res) => {
  res.json({ admin: serializeAdmin(req.admin) })
}))

router.patch('/me/password', adminAuth, ah(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password too short' })
  }
  const ok = await req.admin.comparePassword(currentPassword || '')
  if (!ok) {
    return res.status(400).json({ error: 'Current password incorrect' })
  }
  req.admin.passwordHash = await bcrypt.hash(newPassword, 10)
  req.admin.mustChangePassword = false
  req.admin.sessionVersion += 1
  await req.admin.save()
  await AuditLog.record({
    actorAdminId: req.admin._id,
    entityType: 'admin',
    entityId: req.admin._id.toString(),
    action: 'update',
    summary: 'Updated own password'
  })
  res.status(204).end()
}))

export default router
