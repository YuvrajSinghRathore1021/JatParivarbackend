// backend/src/middleware/adminAuth.js
import jwt from 'jsonwebtoken'
import { Admin } from '../models/Admin.js'
import { CONFIG } from '../config/env.js'

export const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'Unauthenticated' })
    }
    const payload = jwt.verify(token, CONFIG.ADMIN_JWT_SECRET || CONFIG.JWT_SECRET)
    const admin = await Admin.findById(payload.id)
    if (!admin || admin.status !== 'active' || admin.deletedAt) {
      return res.status(401).json({ error: 'Unauthenticated' })
    }
    if (payload.sessionVersion !== admin.sessionVersion) {
      return res.status(401).json({ error: 'Session expired' })
    }
    req.admin = admin
    next()
  } catch (err) {
    console.error(err)
    return res.status(401).json({ error: 'Unauthenticated' })
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({ error: 'Unauthenticated' })
  }
  if (req.admin.roles.includes('SUPER_ADMIN')) {
    return next()
  }
  const allowed = roles.some(r => req.admin.roles.includes(r))
  if (!allowed) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}
