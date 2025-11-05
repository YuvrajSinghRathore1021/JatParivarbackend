// backend/src/routes/admin/dashboard.routes.js
import { Router } from 'express'
import { User } from '../../models/User.js'
import { Payment } from '../../models/Payment.js'
import { AuditLog } from '../../models/AuditLog.js'
import { Plan } from '../../models/Plan.js'
import { ah } from '../../utils/asyncHandler.js'

const router = Router()

router.get('/summary', ah(async (req, res) => {
  const [membersCount, founderCount, paymentsToday, plans] = await Promise.all([
    User.countDocuments({ role: 'member' }),
    User.countDocuments({ role: 'founder' }),
    Payment.aggregate([
      { $match: { createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]),
    Plan.find({})
  ])

  const planBreakup = await User.aggregate([
    { $match: { planId: { $ne: null } } },
    { $group: { _id: '$planId', count: { $sum: 1 } } }
  ])

  const paymentsMetrics = paymentsToday[0] || { total: 0, count: 0 }

  res.json({
    membersCount,
    founderCount,
    paymentsToday: paymentsMetrics,
    plans: plans.map(plan => ({
      id: plan._id,
      titleEn: plan.titleEn,
      price: plan.price,
      members: planBreakup.find(p => p._id?.toString() === plan._id.toString())?.count || 0
    }))
  })
}))

router.get('/activity', ah(async (req, res) => {
  const logs = await AuditLog.find({ actorAdminId: req.admin._id }).sort('-createdAt').limit(20)
  res.json(logs)
}))

export default router
