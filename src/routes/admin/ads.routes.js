// backend/src/routes/admin/ads.routes.js
import { Router } from 'express'
import { AdCampaign } from '../../models/AdCampaign.js'
import { requireRole } from '../../middleware/adminAuth.js'
import { ah } from '../../utils/asyncHandler.js'
import { logAudit } from '../../utils/audit.js'

const router = Router()

const serialize = (ad) => ({
  id: ad._id,
  label: ad.label,
  titleEn: ad.titleEn,
  titleHi: ad.titleHi,
  descriptionEn: ad.descriptionEn,
  descriptionHi: ad.descriptionHi,
  href: ad.href,
  imageUrl: ad.imageUrl,
  variant: ad.variant,
  active: ad.active,
  startsAt: ad.startsAt,
  endsAt: ad.endsAt,
  createdAt: ad.createdAt,
  updatedAt: ad.updatedAt
})

router.get('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const ads = await AdCampaign.find({}).sort('-createdAt')
  res.json({ data: ads.map(serialize) })
}))

router.post('/', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const body = req.body || {}
  if (!body.variant) body.variant = 'billboard'
  const ad = await AdCampaign.create(body)
  await logAudit({
    admin: req.admin,
    entityType: 'ad',
    entityId: ad._id,
    action: 'create',
    summary: `Created ad ${ad.label || ad._id}`,
    after: serialize(ad)
  })
  res.status(201).json({ data: serialize(ad) })
}))

router.patch('/:id', requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), ah(async (req, res) => {
  const ad = await AdCampaign.findById(req.params.id)
  if (!ad) return res.status(404).json({ error: 'Ad not found' })
  const before = serialize(ad)
  Object.assign(ad, req.body)
  await ad.save()
  await logAudit({
    admin: req.admin,
    entityType: 'ad',
    entityId: ad._id,
    action: 'update',
    summary: `Updated ad ${ad.label || ad._id}`,
    before,
    after: serialize(ad)
  })
  res.json({ data: serialize(ad) })
}))

router.delete('/:id', requireRole('SUPER_ADMIN'), ah(async (req, res) => {
  const ad = await AdCampaign.findById(req.params.id)
  if (!ad) return res.status(404).json({ error: 'Ad not found' })
  await ad.deleteOne()
  await logAudit({
    admin: req.admin,
    entityType: 'ad',
    entityId: ad._id,
    action: 'delete',
    summary: `Deleted ad ${ad.label || ad._id}`,
    before: serialize(ad)
  })
  res.status(204).end()
}))

export default router
