// backend/src/routes/admin/plans.routes.js
import { Router } from 'express'
import { Plan } from '../../models/Plan.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

const serialize = (plan) => ({
  id: plan._id,
  code: plan.code,
  titleEn: plan.titleEn,
  titleHi: plan.titleHi,
  descriptionEn: plan.descriptionEn,
  descriptionHi: plan.descriptionHi,
  price: plan.price,
  order: plan.order,
  active: plan.active,
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt
})

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN', 'FINANCE_ADMIN'), ah(async (req, res) => {
  const plans = await Plan.find({}).sort({ order: 1, createdAt: 1 })
  res.json({ data: plans.map(serialize) })
}))

router.post('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  if (!body.titleEn || typeof body.price === 'undefined') {
    return res.status(400).json({ error: 'Title and price required' })
  }
  const plan = await Plan.create(body)
  await logAudit({
    admin: req.admin,
    entityType: 'plan',
    entityId: plan._id,
    action: 'create',
    summary: `Created plan ${plan.titleEn}`,
    after: serialize(plan)
  })
  res.status(201).json({ data: serialize(plan) })
}))

router.patch('/:id', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN', 'FINANCE_ADMIN'), ah(async (req, res) => {
  const plan = await Plan.findById(req.params.id)
  if (!plan) return res.status(404).json({ error: 'Plan not found' })
  const before = serialize(plan)
  Object.assign(plan, req.body)
  await plan.save()
  await logAudit({
    admin: req.admin,
    entityType: 'plan',
    entityId: plan._id,
    action: 'update',
    summary: `Updated plan ${plan.titleEn}`,
    before,
    after: serialize(plan)
  })
  res.json({ data: serialize(plan) })
}))

router.post('/reorder', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be array' })
  await Promise.all(ids.map((id, index) => Plan.findByIdAndUpdate(id, { order: index })))
  res.status(204).end()
}))

export default router
