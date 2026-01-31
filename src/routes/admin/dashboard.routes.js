// backend/src/routes/admin/dashboard.routes.js
import { Router } from 'express'
import { User } from '../../models/User.js'
import { Payment } from '../../models/Payment.js'
import { AuditLog } from '../../models/AuditLog.js'
import { Plan } from '../../models/Plan.js'
import { ah } from '../../utils/asyncHandler.js'

const router = Router()

router.get('/summary', ah(async (req, res) => {
  // Include legacy "member" role so existing records still count until migrated.
  const memberRoles = ['founder', 'management', 'member', 'sadharan']
  const activeMemberFilter = { role: { $in: memberRoles }, status: 'active' }

  const [membersCount, founderCount, paymentsToday, plans] = await Promise.all([
    User.countDocuments(activeMemberFilter),
    User.countDocuments({ role: 'founder', status: 'active' }),
    Payment.aggregate([
      { $match: { createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }, status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]),
    Plan.find({ code: { $in: ['founder', 'management', 'member', 'sadharan'] } })
  ])

  const planBreakup = await User.aggregate([
    { $match: { ...activeMemberFilter, planId: { $ne: null } } },
    { $group: { _id: '$planId', count: { $sum: 1 } } }
  ])

  const paymentsMetrics = paymentsToday[0] || { total: 0, count: 0 }

  // Normalize legacy plan code "member" -> "management" and dedupe in the dashboard UI.
  // If both plans exist, show only Management and add counts together.
  const byCode = new Map()
  for (const plan of plans || []) {
    const rawCode = String(plan.code || '').toLowerCase()
    const code = rawCode === 'member' ? 'management' : rawCode
    if (!code) continue

    const members = planBreakup.find((p) => p._id?.toString() === plan._id.toString())?.count || 0
    const existing = byCode.get(code)
    if (!existing) {
      byCode.set(code, { plan, members })
      continue
    }
    // Prefer the real management plan over legacy member when both exist.
    if (existing.plan?.code === 'management' && rawCode === 'member') {
      existing.members += members
      continue
    }
    if (existing.plan?.code === 'member' && rawCode === 'management') {
      byCode.set(code, { plan, members: existing.members + members })
      continue
    }
    existing.members += members
  }

  res.json({
    membersCount,
    founderCount,
    paymentsToday: paymentsMetrics,
    plans: Array.from(byCode.values()).map(({ plan, members }) => ({
      id: plan._id,
      titleEn: plan.titleEn,
      price: plan.price,
      members
    }))
  })
}))

router.get('/activity', ah(async (req, res) => {
  const logs = await AuditLog.find({ actorAdminId: req.admin._id }).sort('-createdAt').limit(20)
  res.json(logs)
}))

export default router
