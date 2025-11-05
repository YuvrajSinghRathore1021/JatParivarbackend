// backend/src/routes/admin/payments.routes.js
import { Router } from 'express'
import { Payment } from '../../models/Payment.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

const serialize = (doc) => ({
  id: doc._id,
  userId: doc.userId,
  planId: doc.planId,
  planTitle: doc.planTitle,
  amount: doc.amount,
  currency: doc.currency,
  status: doc.status,
  provider: doc.provider,
  orderId: doc.orderId,
  merchantTransactionId: doc.merchantTransactionId,
  leaderboardVisible: doc.leaderboardVisible,
  notes: doc.notes,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  reconciledAt: doc.reconciledAt
})

router.get('/', requireRole('SUPER_ADMIN', 'FINANCE_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { page = 1, pageSize = 20, status, planId, from, to, search } = req.query
  const filter = {}
  if (status) filter.status = status
  if (planId) filter.planId = planId
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }
  if (search) {
    const regex = new RegExp(search, 'i')
    filter.$or = [
      { orderId: regex },
      { merchantTransactionId: regex }
    ]
  }
  const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10)
  const [rows, total] = await Promise.all([
    Payment.find(filter).sort('-createdAt').skip(skip).limit(parseInt(pageSize, 10)),
    Payment.countDocuments(filter)
  ])
  res.json({ data: rows.map(serialize), meta: { total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) } })
}))

router.get('/:id', requireRole('SUPER_ADMIN', 'FINANCE_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  res.json({ data: serialize(payment) })
}))

router.patch('/:id/status', requireRole('SUPER_ADMIN', 'FINANCE_ADMIN'), ah(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  const { status, notes } = req.body
  if (!['created', 'pending', 'success', 'failed', 'refunded'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  const before = serialize(payment)
  payment.status = status
  payment.notes = notes
  payment.reconciledAt = new Date()
  payment.reconciledBy = req.admin._id
  await payment.save()
  await logAudit({
    admin: req.admin,
    entityType: 'payment',
    entityId: payment._id,
    action: 'update',
    summary: `Payment marked ${status}`,
    before,
    after: serialize(payment)
  })
  res.json({ data: serialize(payment) })
}))

router.patch('/:id/leaderboard', requireRole('SUPER_ADMIN', 'FINANCE_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  const before = serialize(payment)
  payment.leaderboardVisible = !!req.body.visible
  await payment.save()
  await logAudit({
    admin: req.admin,
    entityType: 'payment',
    entityId: payment._id,
    action: 'status',
    summary: `Leaderboard visibility ${payment.leaderboardVisible}`,
    before,
    after: serialize(payment)
  })
  res.json({ data: serialize(payment) })
}))

router.post('/manual', requireRole('SUPER_ADMIN', 'FINANCE_ADMIN'), ah(async (req, res) => {
  const { userId, amount, planId, notes } = req.body
  if (!userId || !amount) {
    return res.status(400).json({ error: 'userId and amount required' })
  }
  const doc = await Payment.create({
    userId,
    amount,
    planId,
    planTitle: req.body.planTitle,
    status: req.body.status || 'success',
    provider: 'manual',
    notes,
    orderId: req.body.orderId || `MAN-${Date.now()}`
  })
  await logAudit({
    admin: req.admin,
    entityType: 'payment',
    entityId: doc._id,
    action: 'create',
    summary: 'Manual payment recorded',
    after: serialize(doc)
  })
  res.status(201).json({ data: serialize(doc) })
}))

export default router
