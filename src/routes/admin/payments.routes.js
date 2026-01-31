// backend/src/routes/admin/payments.routes.js
import { Router } from 'express'
import mongoose from 'mongoose'
import { Payment } from '../../models/Payment.js'
import { Plan } from '../../models/Plan.js'
import { PreSignup } from '../../models/PreSignup.js'
import { User } from '../../models/User.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

const getPayer = (doc) => {
  const user = doc?.userId && typeof doc.userId === 'object' ? doc.userId : null
  const pre = doc?.preSignupId && typeof doc.preSignupId === 'object' ? doc.preSignupId : null

  if (user) {
    return {
      type: 'user',
      id: user._id,
      name: user.displayName || user.name || '',
      phone: user.phone || ''
    }
  }

  if (pre) {
    const form = pre.form && typeof pre.form === 'object' ? pre.form : {}
    const name =
      (form.displayName || form.name || form.fullName || form.fullname || '').toString().trim()
    return {
      type: 'preSignup',
      id: pre._id,
      name,
      phone: pre.phone || ''
    }
  }

  return null
}

const serialize = (doc) => {
  const payer = getPayer(doc)
  return {
  id: doc._id,
  userId: doc?.userId && typeof doc.userId === 'object' ? doc.userId._id : doc.userId,
  payer,
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
  }
}

const isObjectIdString = (value) =>
  typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)

const buildPlanFilter = async (raw) => {
  const value = (raw || '').toString().trim()
  if (!value) return null

  if (isObjectIdString(value)) {
    return { planId: new mongoose.Types.ObjectId(value) }
  }

  const code = value.toLowerCase()
  const maybePlan = await Plan.findOne({ code }).select('_id code titleEn titleHi').lean()
  const regex = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

  if (!maybePlan) {
    return { planTitle: regex }
  }

  const or = [{ planId: maybePlan._id }, { planTitle: regex }]
  if (maybePlan.titleEn) {
    or.push({ planTitle: new RegExp(maybePlan.titleEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
  }
  if (maybePlan.titleHi) {
    or.push({ planTitle: new RegExp(maybePlan.titleHi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
  }

  return { $or: or }
}

router.get('/', requireRole('SUPER_ADMIN', 'FINANCE_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { page = 1, pageSize = 20, status, planId, plan, from, to, search } = req.query
  const filter = {}
  if (status) filter.status = status

  const planQuery = planId || plan
  if (planQuery) {
    const planFilter = await buildPlanFilter(planQuery)
    if (planFilter?.$or) {
      filter.$or = [...(filter.$or || []), ...planFilter.$or]
    } else if (planFilter) {
      Object.assign(filter, planFilter)
    }
  }

  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'i')

    const [users, preSignups] = await Promise.all([
      User.find({
        $or: [
          { name: regex },
          { displayName: regex },
          { email: regex },
          { phone: regex },
          { alternatePhone: regex },
        ]
      }).select('_id').limit(500).lean(),
      PreSignup.find({
        $or: [
          { phone: regex },
          { 'form.name': regex },
          { 'form.fullName': regex },
          { 'form.displayName': regex },
        ]
      }).select('_id').limit(500).lean(),
    ])

    const userIds = users.map((u) => u._id)
    const preSignupIds = preSignups.map((p) => p._id)

    filter.$or = [
      ...(filter.$or || []),
      { orderId: regex },
      { merchantTransactionId: regex },
      { planTitle: regex },
      { notes: regex },
      ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
      ...(preSignupIds.length ? [{ preSignupId: { $in: preSignupIds } }] : []),
    ]
  }
  const parsedPage = Math.max(1, parseInt(page, 10) || 1)
  const parsedPageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
  const skip = (parsedPage - 1) * parsedPageSize
  const [rows, total] = await Promise.all([
    Payment.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(parsedPageSize)
      .populate({ path: 'userId', select: 'name displayName phone' })
      .populate({ path: 'preSignupId', select: 'phone form' }),
    Payment.countDocuments(filter)
  ])
  res.json({ data: rows.map(serialize), meta: { total, page: parsedPage, pageSize: parsedPageSize } })
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
